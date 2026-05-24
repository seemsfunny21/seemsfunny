/* ==========================================================================
   PEGASUS CLOUD VAULT - SINGLE USER SECURE SYNC (v22.3 DATA GUARD + REPAIR PUSH)
   STATUS: SINGLE-USER | LOCAL-ONLY PRIVATES | DAILY 07:00 LOCK | Offline QUEUE
   ========================================================================== */

const PegasusCloud = {
    config: {
        binId: "69b6757ab7ec241ddc6d7230",
        encryptedPart: "$2a$10$oU/TyQjSeNEVr/k5dnFS8ulKZkbb9gUWd5xuXijAYFCBijuXrYAFC",
        syncThrottle: 2000,
        pullInterval: 30000,
        dailyUnlockHour: 7,
        cryptoIterations: 120000
    },

    storage: {
        lastPush: "pegasus_last_push",
        validUntil: "pegasus_vault_valid_until",
        masterHash: "pegasus_vault_master_hash",
        wrappedMaster: "pegasus_vault_master_wrapped",
        deviceSecret: "pegasus_vault_device_secret",
        pendingQueue: "pegasus_cloud_pending_v1",
        localPinHash: "pegasus_vault_pin_hash_local",
        approvedDevice: "pegasus_device_approved",
        desktopApproved: "pegasus_desktop_device_approved",
        legacyPin: "pegasus_vault_pin",
        legacyTime: "pegasus_vault_time",
        geminiKey: "pegasus_gemini_key",
        openaiKey: "pegasus_openai_key",
        openrouterKey: "pegasus_openrouter_key",
        protectedContactsState: "pegasus_protected_contacts_state",
        protectedContactsRepair: "pegasus_protected_contacts_repair",
        dataGuardRepair: "pegasus_cloud_data_guard_repair_needed_v1"
    },

    isUnlocked: false,
    hasSuccessfullyPulled: false,
    isPulling: false,
    isPushing: false,
    isApplyingRemote: false,

    userKey: "",
    masterKey: "",
    syncInterval: null,
    pushTimeout: null,
    lastPushTs: null,
    lastUiRefreshTs: 0,
    lastStatus: null,
    restorePromise: null,
    hasApprovedRestoreCompleted: false,

    engine: null,

    attachEngine(engineInstance) {
        if (!engineInstance) return;
        this.engine = engineInstance;
        console.log("🧠 CLOUD: Engine attached");
    },

    /* =========================
       📱 MOBILE 30s CADENCE GUARD
       Mobile owns sync timing through mobile.html. This prevents background
       focus/visibility/storage pushes from firing before the visible countdown.
    ========================= */
    isMobileRuntime() {
        return !!(typeof window !== "undefined" && window.PEGASUS_IS_MOBILE);
    },

    getMobileCadenceMs() {
        return Math.max(10000, Number(this.config?.pullInterval || 30000));
    },

    getMobileNextSyncAt() {
        if (typeof window === "undefined") return 0;
        return Number(window.__pegasusMobileNextSyncAt || 0);
    },

    setMobileNextSyncAt(ts) {
        if (typeof window === "undefined") return;
        window.__pegasusMobileNextSyncAt = Number(ts || 0);
    },

    markMobileSyncComplete() {
        if (!this.isMobileRuntime()) return;
        this.setMobileNextSyncAt(Date.now() + this.getMobileCadenceMs());
    },

    shouldDeferMobileCadence(reason) {
        if (!this.isMobileRuntime()) return false;
        if (typeof window === "undefined") return false;

        // The mobile heartbeat sets this while the countdown has reached 00s.
        if (window.__pegasusMobileCadencePermit === true) return false;

        // Before mobile.html initializes its counter, allow the first boot/auto-unlock sync.
        const nextAt = this.getMobileNextSyncAt();
        if (!nextAt) return false;

        const now = Date.now();
        if (now >= nextAt) return false;

        const remainingSec = Math.ceil((nextAt - now) / 1000);
        try {
            this.traceStep("cloudSync", "mobile-cadence", "DEFERRED", `${reason || "sync"}:${remainingSec}s`);
        } catch (_) {}
        return true;
    },

    traceStep(moduleName, action, status, extra) {
        try { window.PegasusRuntimeMonitor?.trace?.(moduleName, action, status, extra); } catch (_) {}
    },

    traceError(moduleName, action, error, extra) {
        try { window.PegasusRuntimeMonitor?.capture?.(moduleName, action, error, extra); } catch (_) {}
    },

    getTodayKey() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    },

    getNextUnlockTs() {
        const now = new Date();
        const next = new Date(now);
        next.setHours(this.config.dailyUnlockHour, 0, 0, 0);

        if (now.getTime() >= next.getTime()) {
            next.setDate(next.getDate() + 1);
        }

        return next.getTime();
    },

    hasValidSession() {
        const validUntil = parseInt(localStorage.getItem(this.storage.validUntil) || "0", 10);
        return Number.isFinite(validUntil) && validUntil > Date.now();
    },

    canAutoUnlock() {
        return this.hasValidSession() && !!localStorage.getItem(this.storage.wrappedMaster);
    },

    hasApprovedDevice() {
        return String(localStorage.getItem(this.storage.approvedDevice) || localStorage.getItem(this.storage.desktopApproved) || "") === "1";
    },

    markApprovedDevice() {
        this.safeSetLocal(this.storage.approvedDevice, "1");
        this.safeSetLocal(this.storage.desktopApproved, "1");
    },

    getProtectedContactsSignature(envelope) {
        if (!envelope || typeof envelope !== "object") return "";
        const data = String(envelope?.data || "");
        return [
            String(envelope?.iv || ""),
            String(envelope?.salt || ""),
            String(data.length),
            String(data.slice(0, 32))
        ].join("|");
    },

    hasLocalProtectedStorage() {
        return this.getLocalManagedKeys({ includeProtected: true }).some(key => this.isProtectedStorageKey(key));
    },

    hasProtectedRepairPending() {
        return String(localStorage.getItem(this.storage.protectedContactsRepair) || "") === "1";
    },

    markProtectedRepairPending() {
        this.safeSetLocal(this.storage.protectedContactsRepair, "1");
    },

    clearProtectedRepairPending() {
        this.safeRemoveLocal(this.storage.protectedContactsRepair);
    },

    hasDataGuardRepairPending() {
        return String(localStorage.getItem(this.storage.dataGuardRepair) || "") === "1";
    },

    markDataGuardRepairPending(reason = "thin-remote-payload") {
        const marker = {
            reason: String(reason || "thin-remote-payload"),
            at: Date.now(),
            iso: new Date().toISOString()
        };
        this.safeSetLocal(this.storage.dataGuardRepair, "1");
        this.safeSetLocal("pegasus_cloud_data_guard_repair_meta_v1", JSON.stringify(marker));
    },

    clearDataGuardRepairPending() {
        this.safeRemoveLocal(this.storage.dataGuardRepair);
        this.safeRemoveLocal("pegasus_cloud_data_guard_repair_meta_v1");
    },

    markProtectedContactsUnavailable(envelope) {
        const marker = {
            sig: this.getProtectedContactsSignature(envelope),
            masterHash: String(localStorage.getItem(this.storage.masterHash) || ""),
            at: Date.now()
        };
        this.safeSetLocal(this.storage.protectedContactsState, JSON.stringify(marker));
        if (this.hasLocalProtectedStorage()) {
            this.markProtectedRepairPending();
        }
    },

    clearProtectedContactsUnavailable() {
        this.safeRemoveLocal(this.storage.protectedContactsState);
        this.clearProtectedRepairPending();
    },

    shouldSkipProtectedContactsDecrypt(envelope) {
        try {
            const raw = localStorage.getItem(this.storage.protectedContactsState);
            if (!raw) return false;
            const marker = JSON.parse(raw);
            if (!marker || typeof marker !== "object") return false;
            const currentMasterHash = String(localStorage.getItem(this.storage.masterHash) || "");
            if (!currentMasterHash || marker.masterHash !== currentMasterHash) return false;
            return marker.sig && marker.sig === this.getProtectedContactsSignature(envelope);
        } catch (e) {
            return false;
        }
    },


    needsPinBindingRepair() {
        const localPinHash = String(localStorage.getItem(this.storage.localPinHash) || '').trim();
        return this.hasApprovedDevice() && !localPinHash;
    },

    canRestoreApprovedDevice() {
        const hasMaterials = !!localStorage.getItem(this.storage.wrappedMaster) && !!localStorage.getItem(this.storage.deviceSecret);
        if (!hasMaterials) return false;
        return this.hasApprovedDevice() || this.hasValidSession() || !!localStorage.getItem(this.storage.localPinHash);
    },

    getSyncedExactKeys() {
        const baseKeys = [
            "pegasus_weight",
            "pegasus_weight_history",
            "pegasus_age",
            "pegasus_height",
            "pegasus_gender",
            "pegasus_language",
            "pegasus_lang",
            "pegasus_weekly_history",
            "pegasus_weekly_history_week_key",
            "pegasus_weekly_history_counted_v2",
            "pegasus_manual_weekly_adjustments_v1",
            "pegasus_weekend_carryover_v1",
            "pegasus_workouts_done",
            "pegasus_total_workouts",
            "pegasus_active_plan",
            "pegasus_muscle_targets",
            "pegasus_calendar_history",
            "pegasus_exercise_weights",
            "pegasus_lifting_v1",
            "pegasus_custom_exercise_order_v1",
            "pegasus_ex_time",
            "pegasus_rest_time",
            "pegasus_weekly_kcal",
            "pegasus_session_kcal",
            "pegasus_supp_inventory",
            "pegasus_food_library",
            "pegasus_goal_kcal",
            "pegasus_body_goal_mode",
            "pegasus_body_goal_mode_label",
            "pegasus_today_kcal",
            "pegasus_effective_today_kcal",
            "pegasus_effective_today_date",
            "pegasus_workout_kcal_history",
            "pegasus_last_workout_kcal_entry",
            "pegasus_today_protein",
            "pegasus_cardio_history",
            "pegasus_daily_progress",
            "pegasus_notes",
            "pegasus_partners_list",
            "pegasus_finance_v1",
            "pegasus_maintenance_v1",
            "pegasus_movies_v1",
            "pegasus_youtube_v1",
            "pegasus_missions_v1",
            "pegasus_biometrics_v1",
            "pegasus_supplies_v1",
            "pegasus_morning_checkin",
            "pegasus_stats",
            "pegasus_goal_protein",
            "pegasus_today_protein_consumed",
            "pegasus_weather_code",
            "pegasus_mute_state",
            "pegasus_turbo_state",
            "pegasus_last_reset",
            "pegasus_command_trace",
            "pegasus_car_service",
            "peg_car_service",
            "pegasus_parking_loc",
            "pegasus_parking_history",
            "kouki_agreement_log",
            "kouki_meals_total",
            "kouki_meals_remaining",
            "kouki_total_stock"
        ];

        const dynamicKeys = window.PegasusMobileDataRegistry?.getGeneralExactKeys?.() || [];
        return Array.from(new Set([...baseKeys, ...dynamicKeys]));
    },

    getSyncedPrefixes() {
        const basePrefixes = [
            "food_log_",
            "pegasus_cardio_kcal_",
            "pegasus_cardio_offset_sets_",
            "pegasus_cardio_km_",
            "pegasus_cardio_distance_",
            "pegasus_cardio_kilometers_",
            "pegasus_workout_kcal_",
            "pegasus_strength_kcal_",
            "pegasus_gym_kcal_",
            "pegasus_weekend_training_mode_",
            "weight_",
            "pegasus_weight_",
            "pegasus_routine_injected_",
            "pegasus_history_",
            "pegasus_day_status_",
            "pegasus_pos_",
            "cardio_log_"
        ];

        const dynamicPrefixes = window.PegasusMobileDataRegistry?.getGeneralPrefixes?.() || [];
        return Array.from(new Set([...basePrefixes, ...dynamicPrefixes]));
    },

    getProtectedExactKeys() {
        const baseKeys = [
            "pegasus_social_v1",
            "pegasus_contacts"
        ];
        const dynamicKeys = window.PegasusMobileDataRegistry?.getProtectedExactKeys?.() || [];
        return Array.from(new Set([...baseKeys, ...dynamicKeys]));
    },

    getLocalOnlyKeys() {
        const baseKeys = [
            "pegasus_user_specs",
            "pegasus_car_identity",
            "pegasus_car_dates",
            "pegasus_car_specs",
            "peg_car_dates",
            "pegasus_car_service",
            "peg_car_service",
            "pegasus_master_pin",
            "pegasus_mobile_ghost_order_v1",
        ];
        const dynamicKeys = window.PegasusMobileDataRegistry?.getLocalOnlyExactKeys?.() || [];
        return Array.from(new Set([...baseKeys, ...dynamicKeys]));
    },

    getInternalStorageKeys() {
        const baseKeys = [
            this.storage.lastPush,
            this.storage.validUntil,
            this.storage.masterHash,
            this.storage.wrappedMaster,
            this.storage.deviceSecret,
            this.storage.pendingQueue,
            this.storage.localPinHash,
            this.storage.protectedContactsState,
            this.storage.protectedContactsRepair,
            this.storage.dataGuardRepair,
            "pegasus_cloud_data_guard_repair_meta_v1",
            this.storage.legacyPin,
            this.storage.legacyTime,
            this.storage.geminiKey,
            this.storage.openaiKey,
            this.storage.openrouterKey
        ];
        const dynamicKeys = window.PegasusMobileDataRegistry?.getInternalKeys?.() || [];
        return Array.from(new Set([...baseKeys, ...dynamicKeys]));
    },

    isInternalStorageKey(key) {
        if (!key) return false;
        return this.getInternalStorageKeys().includes(key);
    },

    isLocalOnlyStorageKey(key) {
        if (!key) return false;
        return this.getLocalOnlyKeys().includes(key);
    },

    isProtectedStorageKey(key) {
        if (!key) return false;
        return this.getProtectedExactKeys().includes(key);
    },

    isSensitiveStorageKey(key) {
        if (!key) return false;
        if (this.isInternalStorageKey(key)) return true;
        if (this.isLocalOnlyStorageKey(key)) return true;
        return /(vault|token|secret|api[_-]?key|gemini[_-]?key|master[_-]?key)/i.test(key);
    },

    isGeneralStorageKey(key) {
        if (!key) return false;
        if (this.isSensitiveStorageKey(key)) return false;
        if (this.getSyncedExactKeys().includes(key)) return true;
        return this.getSyncedPrefixes().some(prefix => key.startsWith(prefix));
    },

    isAllowedStorageKey(key) {
        if (!key) return false;
        if (this.isGeneralStorageKey(key)) return true;
        return this.isProtectedStorageKey(key);
    },

    isExportBlockedKey(key) {
        if (!key) return true;
        if (this.isInternalStorageKey(key)) return true;
        if (this.isLocalOnlyStorageKey(key)) return true;
        if (this.isProtectedStorageKey(key)) return true;
        return false;
    },


    /* =========================
       🛡️ DATA LOSS GUARD
       Remote pulls are now merge-first. Missing keys are treated as "remote
       did not know about this key", not as a delete command. This protects
       against thin/manual JSONBin overwrites that only contain a few fields.
    ========================= */
    getDataGuardCriticalKeys() {
        return [
            "pegasus_biometrics_v1",
            "pegasus_car_service",
            "peg_car_service",
            "pegasus_exercise_weights",
            "pegasus_lifting_v1",
            "pegasus_notes",
            "pegasus_finance_v1",
            "pegasus_supplies_v1",
            "pegasus_movies_v1",
            "pegasus_youtube_v1",
            "pegasus_social_v1",
            "pegasus_contacts",
            "pegasus_food_library",
            "pegasus_cardio_history",
            "pegasus_workout_kcal_history",
            "pegasus_calendar_history",
            "pegasus_weekly_history",
            "pegasus_weekly_history_counted_v2",
            "pegasus_daily_progress",
            "pegasus_stats"
        ];
    },

    safeParseAny(value, fallback = null) {
        try {
            if (value && typeof value === "object") return value;
            return JSON.parse(String(value || "null"));
        } catch (e) {
            return fallback;
        }
    },

    isEmptySyncValue(value) {
        if (value === null || value === undefined) return true;
        const raw = String(value).trim();
        if (!raw || raw === "null" || raw === "undefined") return true;
        if (raw === "[]" || raw === "{}") return true;

        const parsed = this.safeParseAny(raw, undefined);
        if (Array.isArray(parsed)) return parsed.length === 0;
        if (parsed && typeof parsed === "object") return Object.keys(parsed).length === 0;
        return false;
    },

    hasMeaningfulSyncValue(value) {
        return !this.isEmptySyncValue(value);
    },

    shouldPreserveLocalAgainstRemoteValue(key, localValue, remoteValue) {
        const k = String(key || "");
        if (!k) return false;

        const critical = this.getDataGuardCriticalKeys().includes(k)
            || k.startsWith("weight_")
            || k.startsWith("pegasus_weight_")
            || k.startsWith("food_log_")
            || k.startsWith("pegasus_cardio_kcal_")
            || k.startsWith("pegasus_workout_kcal_")
            || k.startsWith("pegasus_strength_kcal_")
            || k.startsWith("pegasus_gym_kcal_");

        if (!critical) return false;
        return this.hasMeaningfulSyncValue(localValue) && this.isEmptySyncValue(remoteValue);
    },

    isRemotePayloadThin(remoteStorage = {}, remoteProtectedStorage = {}) {
        const remoteKeys = [
            ...Object.keys(remoteStorage || {}),
            ...Object.keys(remoteProtectedStorage || {})
        ];
        const localKeys = this.getLocalManagedKeys({ includeProtected: true });
        const localCriticalCount = this.getDataGuardCriticalKeys()
            .filter(key => this.hasMeaningfulSyncValue(localStorage.getItem(key))).length;

        if (!remoteKeys.length && localKeys.length > 0) return true;
        if (remoteKeys.length < 8 && localCriticalCount >= 3) return true;
        if (remoteKeys.length < Math.max(8, Math.floor(localKeys.length * 0.20)) && localKeys.length >= 20) return true;
        return false;
    },

    saveDataGuardSnapshot(reason = "unknown", extra = {}) {
        try {
            const now = Date.now();
            const snapshot = {
                reason,
                at: now,
                iso: new Date(now).toISOString(),
                extra,
                storage: {}
            };

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                if (this.isInternalStorageKey(key)) continue;
                if (/(vault|pin|master|secret|hash|wrapped|api[_-]?key|gemini|openai|openrouter)/i.test(key)) continue;
                if (this.isAllowedStorageKey(key) || this.isLocalOnlyStorageKey(key)) {
                    const value = localStorage.getItem(key);
                    if (this.hasMeaningfulSyncValue(value)) snapshot.storage[key] = value;
                }
            }

            const latest = localStorage.getItem("pegasus_cloud_guard_snapshot_latest_v1");
            const prev = localStorage.getItem("pegasus_cloud_guard_snapshot_prev_v1");
            if (prev) this.safeSetLocal("pegasus_cloud_guard_snapshot_older_v1", prev);
            if (latest) this.safeSetLocal("pegasus_cloud_guard_snapshot_prev_v1", latest);
            this.safeSetLocal("pegasus_cloud_guard_snapshot_latest_v1", JSON.stringify(snapshot));
            return snapshot;
        } catch (e) {
            console.warn("⚠️ CLOUD DATA GUARD: snapshot skipped.", e);
            return null;
        }
    },

    mapLegacyCloudRecordToStorage(cloud) {
        const generalStorage = {};
        const protectedStorage = {};
        if (!cloud || typeof cloud !== "object") {
            return { generalStorage, protectedStorage };
        }

        const putGeneral = (remoteKey, localKey) => {
            if (Object.prototype.hasOwnProperty.call(cloud, remoteKey) && this.isGeneralStorageKey(localKey)) {
                generalStorage[localKey] = (typeof cloud[remoteKey] === "string") ? cloud[remoteKey] : JSON.stringify(cloud[remoteKey]);
            }
        };
        const putProtected = (remoteKey, localKey) => {
            if (Object.prototype.hasOwnProperty.call(cloud, remoteKey) && this.isProtectedStorageKey(localKey)) {
                protectedStorage[localKey] = (typeof cloud[remoteKey] === "string") ? cloud[remoteKey] : JSON.stringify(cloud[remoteKey]);
            }
        };

        putGeneral("car_service", "pegasus_car_service");
        putGeneral("service", "pegasus_car_service");
        putGeneral("peg_car_service", "peg_car_service");
        putGeneral("kcal", "pegasus_today_kcal");
        putGeneral("protein", "pegasus_today_protein");
        putGeneral("supp_inventory", "pegasus_supp_inventory");
        putGeneral("weekly_history", "pegasus_weekly_history");
        putGeneral("food_library", "pegasus_food_library");
        putGeneral("car_dates", "pegasus_car_dates");
        putGeneral("car_specs", "pegasus_car_specs");
        putGeneral("parking_loc", "pegasus_parking_loc");
        putGeneral("parking_history", "pegasus_parking_history");
        putGeneral("biometrics", "pegasus_biometrics_v1");
        putGeneral("exercise_weights", "pegasus_exercise_weights");
        putProtected("peg_contacts", "pegasus_contacts");
        putProtected("contacts", "pegasus_contacts");
        putProtected("social", "pegasus_social_v1");

        return { generalStorage, protectedStorage };
    },

    shouldApplyRemoteDeletion(key, remotePayload) {
        // Future-proof explicit deletion channel only. Missing keys alone must
        // never delete local data again.
        const deleted = Array.isArray(remotePayload?.deletedKeys) ? remotePayload.deletedKeys : [];
        if (!deleted.length || deleted.length > 20) return false;
        if (!deleted.includes(key)) return false;
        if (this.getDataGuardCriticalKeys().includes(key)) return false;
        return true;
    },


    getPegasusCurrentWeekKey() {
        const d = new Date();
        const start = new Date(d);
        const daysSinceSaturday = (d.getDay() + 1) % 7;
        start.setHours(6, 0, 0, 0);
        start.setDate(d.getDate() - daysSinceSaturday);
        if (d.getDay() === 6 && d.getTime() < start.getTime()) start.setDate(start.getDate() - 7);
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    },

    safeParseStorageObject(value, fallback = {}) {
        try {
            if (value && typeof value === "object") return value;
            const parsed = JSON.parse(value || "null");
            return parsed && typeof parsed === "object" ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    },

    normalizeWeeklyHistoryObject(value) {
        const groups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];
        const parsed = this.safeParseStorageObject(value, {});
        const clean = {};
        groups.forEach(group => {
            const amount = Number(parsed?.[group]);
            clean[group] = Number.isFinite(amount) ? Math.max(0, amount) : 0;
        });
        return clean;
    },

    getWeeklyHistoryTotalValue(history) {
        return Object.values(history || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    },

    isWeeklyProgressKey(key) {
        return [
            "pegasus_weekly_history",
            "pegasus_weekly_history_week_key",
            "pegasus_weekly_history_counted_v2"
        ].includes(String(key || ""));
    },

    shouldBlockBootWeeklyWrite(key, value, type = "set") {
        if (!this.isWeeklyProgressKey(key)) return false;
        if (this.hasSuccessfullyPulled) return false;
        if (!this.canRestoreApprovedDevice?.()) return false;
        if (!navigator.onLine) return false;

        if (key === "pegasus_weekly_history") {
            const incomingTotal = this.getWeeklyHistoryTotalValue(this.normalizeWeeklyHistoryObject(value));
            return incomingTotal === 0;
        }

        if (key === "pegasus_weekly_history_counted_v2") {
            if (type === "remove") return true;
            const ledger = this.safeParseStorageObject(value, null);
            const currentWeek = this.getPegasusCurrentWeekKey();
            const hasSets = ledger?.weekKey === currentWeek
                && ledger.exercises
                && typeof ledger.exercises === "object"
                && Object.values(ledger.exercises).some(count => Math.max(0, Number(count) || 0) > 0);
            return !hasSets;
        }

        return false;
    },

    normalizeWeeklyExerciseName(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\u0370-\u03ff]+/g, "");
    },

    resolveWeeklyLedgerMuscle(exerciseName) {
        const groups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];
        const cleanName = this.normalizeWeeklyExerciseName(exerciseName);
        if (!cleanName) return "";

        const records = [];
        if (Array.isArray(window.exercisesDB)) records.push(...window.exercisesDB);
        if (window.program && typeof window.program === "object") {
            Object.values(window.program).forEach(items => {
                if (Array.isArray(items)) records.push(...items);
            });
        }

        const record = records.find(item => {
            const itemName = this.normalizeWeeklyExerciseName(item?.name);
            return itemName && (itemName === cleanName || cleanName.includes(itemName) || itemName.includes(cleanName));
        });
        if (groups.includes(record?.muscleGroup)) return record.muscleGroup;

        const aliases = [
            { group: "Στήθος", keys: ["chest", "press", "fly", "pushup", "pushups", "στηθος"] },
            { group: "Πλάτη", keys: ["lat", "row", "pulldown", "back", "πλατη"] },
            { group: "Πόδια", keys: ["leg", "legs", "cycling", "bike", "ποδηλα", "ποδια"] },
            { group: "Χέρια", keys: ["bicep", "tricep", "curl", "χερια"] },
            { group: "Ώμοι", keys: ["upright", "shoulder", "ωμοι"] },
            { group: "Κορμός", keys: ["ab", "crunch", "plank", "situp", "knee", "core", "raise", "κορμος", "κοιλιακ"] }
        ];
        const alias = aliases.find(entry => entry.keys.some(key => cleanName.includes(this.normalizeWeeklyExerciseName(key))));
        return alias?.group || "";
    },

    getWeeklyLedgerSetValue(exerciseName, muscle) {
        const upper = String(exerciseName || "").toUpperCase();
        if (upper.includes("Ποδηλασία") || upper.includes("CYCLING")) return 24;
        if (upper.includes("EMS ποδιών") || upper.includes("EMS LEGS")) return 6;
        if (upper.includes("STRETCHING") || muscle === "None") return 0;
        return 1;
    },

    weeklyHistoryFromLedgerValue(ledgerValue) {
        const currentWeek = this.getPegasusCurrentWeekKey();
        const ledger = this.safeParseStorageObject(ledgerValue, null);
        const totals = this.normalizeWeeklyHistoryObject({});
        if (!ledger || ledger.weekKey !== currentWeek || !ledger.exercises || typeof ledger.exercises !== "object") return totals;

        const parseLedgerDate = key => {
            const raw = String(key || "").split("|")[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`);
            if (/^\d{8}$/.test(raw)) return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`);
            const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (m) return new Date(`${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}T00:00:00`);
            return null;
        };
        const weekStart = new Date(`${currentWeek}T00:00:00`);
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);

        Object.entries(ledger.exercises).forEach(([key, rawCount]) => {
            const count = Math.max(0, Number(rawCount) || 0);
            if (count <= 0) return;
            const entryDate = parseLedgerDate(key);
            if (entryDate && (entryDate < weekStart || entryDate >= tomorrow)) return;
            const parts = String(key || "").split("|");
            const exerciseName = parts.length > 1 ? parts.slice(1).join("|") : String(key || "");
            const muscle = this.resolveWeeklyLedgerMuscle(exerciseName);
            if (!Object.prototype.hasOwnProperty.call(totals, muscle)) return;
            const setValue = this.getWeeklyLedgerSetValue(exerciseName, muscle);
            if (setValue <= 0) return;
            totals[muscle] = Math.max(0, Number(totals[muscle] || 0)) + (count * setValue);
        });

        const targets = this.safeParseStorageObject(localStorage.getItem("pegasus_muscle_targets"), { "Στήθος": 14, "Πλάτη": 16, "Πόδια": 8, "Χέρια": 12, "Ώμοι": 8, "Κορμός": 16 });
        Object.keys(totals).forEach(group => {
            const target = Math.max(0, Number(targets?.[group]) || 0);
            if (target > 0) totals[group] = Math.min(totals[group], target);
        });

        return totals;
    },

    maxWeeklyHistories(...items) {
        const merged = this.normalizeWeeklyHistoryObject({});
        items.forEach(item => {
            const clean = this.normalizeWeeklyHistoryObject(item);
            Object.keys(merged).forEach(group => {
                merged[group] = Math.max(Number(merged[group] || 0), Number(clean[group] || 0));
            });
        });
        return merged;
    },

    mergeWeeklyHistoryValue(localValue, remoteValue) {
        const localHistory = this.normalizeWeeklyHistoryObject(localValue);
        const remoteHistory = this.normalizeWeeklyHistoryObject(remoteValue);
        const currentWeek = this.getPegasusCurrentWeekKey();

        const remoteStorage = this._remoteStorageMergeContext || {};
        const remoteWeek = String(remoteStorage.pegasus_weekly_history_week_key || "").trim();
        const localWeek = String(localStorage.getItem("pegasus_weekly_history_week_key") || currentWeek).trim();
        const localLedgerHistory = this.weeklyHistoryFromLedgerValue(localStorage.getItem("pegasus_weekly_history_counted_v2"));
        const remoteLedgerHistory = this.weeklyHistoryFromLedgerValue(remoteStorage.pegasus_weekly_history_counted_v2);
        const localCandidate = this.maxWeeklyHistories(localHistory, localLedgerHistory);
        const remoteCandidate = this.maxWeeklyHistories(remoteHistory, remoteLedgerHistory);
        const localTotal = this.getWeeklyHistoryTotalValue(localCandidate);
        const remoteTotal = this.getWeeklyHistoryTotalValue(remoteCandidate);
        const resetWeek = String(localStorage.getItem("pegasus_saturday_reset_applied_week_key") || localStorage.getItem("pegasus_monday_reset_applied_week_key") || "").trim();
        const resetAt = Math.max(0, Number(localStorage.getItem("pegasus_saturday_reset_applied_at") || localStorage.getItem("pegasus_monday_reset_applied_at")) || 0);
        const remoteLedgerRaw = this.safeParseStorageObject(remoteStorage.pegasus_weekly_history_counted_v2, null);
        const remoteUpdatedAt = Math.max(0, Number(remoteLedgerRaw?.updatedAt) || 0, Number(remoteLedgerRaw?.createdAt) || 0);

        const remoteHasCurrentWeekEntries = (() => {
            if (!remoteLedgerRaw || remoteLedgerRaw.weekKey !== currentWeek || !remoteLedgerRaw.exercises || typeof remoteLedgerRaw.exercises !== "object") return false;
            const start = new Date(`${currentWeek}T00:00:00`);
            const end = new Date();
            end.setHours(0, 0, 0, 0);
            end.setDate(end.getDate() + 1);
            const parseDate = key => {
                const raw = String(key || "").split("|")[0];
                if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`);
                if (/^\d{8}$/.test(raw)) return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`);
                const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (m) return new Date(`${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}T00:00:00`);
                return null;
            };
            return Object.entries(remoteLedgerRaw.exercises).some(([entryKey, value]) => {
                const count = Math.max(0, Number(value) || 0);
                if (count <= 0) return false;
                const entryDate = parseDate(entryKey);
                return !!entryDate && entryDate >= start && entryDate < end;
            });
        })();

        // PEGASUS 204: after a Saturday zero reset, do not re-import same-week stale totals.
        // A same-week ledger is trusted only when it contains entries dated inside the actual current week.
        if (resetWeek === currentWeek && localTotal === 0 && remoteTotal > 0 && (!remoteHasCurrentWeekEntries || !remoteUpdatedAt || remoteUpdatedAt <= resetAt)) {
            localStorage.setItem("pegasus_weekly_history_week_key", currentWeek);
            return JSON.stringify(this.normalizeWeeklyHistoryObject({}));
        }

        // If local has already moved into the current week, never re-import an older remote week,
        // even when the current local value is zero after a Saturday reset.
        if (localWeek === currentWeek && remoteWeek && remoteWeek !== currentWeek) {
            localStorage.setItem("pegasus_weekly_history_week_key", currentWeek);
            return JSON.stringify(localCandidate);
        }

        // If both sides are from an older week, start the new week clean instead of carrying
        // last week's completed muscle totals into the new Saturday cycle.
        if (localWeek && remoteWeek && localWeek !== currentWeek && remoteWeek !== currentWeek) {
            localStorage.setItem("pegasus_weekly_history_week_key", currentWeek);
            return JSON.stringify(this.normalizeWeeklyHistoryObject({}));
        }

        // Current-week remote can initialize a fresh local device, but it may need ledger repair.
        if (remoteWeek === currentWeek && localWeek !== currentWeek) {
            localStorage.setItem("pegasus_weekly_history_week_key", currentWeek);
            return JSON.stringify(remoteCandidate);
        }

        // Same/unknown current week: merge by max per muscle group, including counted ledger totals.
        const merged = this.maxWeeklyHistories(localCandidate, remoteCandidate);

        // Extra guard: if remote is all-zero and local has data, keep local candidate.
        if (remoteTotal === 0 && localTotal > 0) return JSON.stringify(localCandidate);

        localStorage.setItem("pegasus_weekly_history_week_key", currentWeek);
        return JSON.stringify(merged);
    },

    mergeWeeklyLedgerValue(localValue, remoteValue) {
        const currentWeek = this.getPegasusCurrentWeekKey();
        const local = this.safeParseStorageObject(localValue, null);
        const remote = this.safeParseStorageObject(remoteValue, null);

        const localWeek = String(local?.weekKey || localStorage.getItem("pegasus_weekly_history_week_key") || currentWeek);
        const remoteWeek = String(remote?.weekKey || this._remoteStorageMergeContext?.pegasus_weekly_history_week_key || currentWeek);
        const resetWeek = String(localStorage.getItem("pegasus_saturday_reset_applied_week_key") || localStorage.getItem("pegasus_monday_reset_applied_week_key") || "").trim();
        const resetAt = Math.max(0, Number(localStorage.getItem("pegasus_saturday_reset_applied_at") || localStorage.getItem("pegasus_monday_reset_applied_at")) || 0);
        const localHasValues = !!(local?.exercises && typeof local.exercises === "object" && Object.values(local.exercises).some(count => Math.max(0, Number(count) || 0) > 0));
        const remoteHasValues = !!(remote?.exercises && typeof remote.exercises === "object" && Object.values(remote.exercises).some(count => Math.max(0, Number(count) || 0) > 0));
        const remoteUpdatedAt = Math.max(0, Number(remote?.updatedAt) || 0, Number(remote?.createdAt) || 0);

        if (resetWeek === currentWeek && !localHasValues && remoteHasValues && (!remoteUpdatedAt || remoteUpdatedAt <= resetAt)) {
            return JSON.stringify({ weekKey: currentWeek, exercises: {}, updatedAt: Math.max(resetAt, Date.now()) });
        }

        if (localWeek === currentWeek && remoteWeek !== currentWeek) {
            return JSON.stringify({
                weekKey: currentWeek,
                exercises: local?.exercises && typeof local.exercises === "object" ? local.exercises : {},
                updatedAt: Math.max(Number(local?.updatedAt) || 0, Date.now())
            });
        }

        if (localWeek !== currentWeek && remoteWeek !== currentWeek) {
            return JSON.stringify({
                weekKey: currentWeek,
                exercises: {},
                updatedAt: Date.now()
            });
        }

        if (remoteWeek === currentWeek && localWeek !== currentWeek) {
            return JSON.stringify({
                weekKey: currentWeek,
                exercises: remote?.exercises && typeof remote.exercises === "object" ? remote.exercises : {},
                updatedAt: Math.max(Number(remote?.updatedAt) || 0, Date.now())
            });
        }

        const merged = {
            weekKey: currentWeek,
            exercises: {},
            updatedAt: Math.max(Number(local?.updatedAt) || 0, Number(remote?.updatedAt) || 0, Date.now())
        };

        const apply = (obj) => {
            if (!obj?.exercises || typeof obj.exercises !== "object") return;
            Object.entries(obj.exercises).forEach(([key, count]) => {
                const value = Math.max(0, Number(count) || 0);
                merged.exercises[key] = Math.max(Number(merged.exercises[key] || 0), value);
            });
        };

        apply(local);
        apply(remote);

        return JSON.stringify(merged);
    },

    mergeMuscleTargetsValue(localValue, remoteValue) {
        const nextDefaults = { "Στήθος": 14, "Πλάτη": 16, "Πόδια": 8, "Χέρια": 12, "Ώμοι": 8, "Κορμός": 16 };
        const oldDefaults = { "Στήθος": 16, "Πλάτη": 16, "Πόδια": 24, "Χέρια": 14, "Ώμοι": 12, "Κορμός": 18 };
        const legacyDefaults = { "Στήθος": 24, "Πλάτη": 24, "Πόδια": 24, "Χέρια": 16, "Ώμοι": 16, "Κορμός": 12 };
        const groups = Object.keys(nextDefaults);
        const local = this.safeParseStorageObject(localValue, null);
        const remote = this.safeParseStorageObject(remoteValue, null);

        const looksOld = obj => obj && (groups.every(group => Number(obj[group]) === Number(oldDefaults[group])) || groups.every(group => Number(obj[group]) === Number(legacyDefaults[group])));
        const clean = obj => {
            const out = { ...nextDefaults };
            if (obj && typeof obj === "object") {
                groups.forEach(group => {
                    const value = Number(obj[group]);
                    if (Number.isFinite(value) && value > 0) out[group] = value;
                });
            }
            return out;
        };

        if (looksOld(remote)) return JSON.stringify(clean(local || nextDefaults));
        if (looksOld(local)) return JSON.stringify(clean(remote || nextDefaults));
        return JSON.stringify(clean(remote || local || nextDefaults));
    },


    normalizeSupplementInventoryValue(value) {
        const parsed = this.safeParseStorageObject(value, null);
        const cleanNumber = (v, fallback = 0) => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 0 ? n : fallback;
        };
        const baseUpdatedAt = Math.max(0, Number(parsed?.updatedAt) || 0, Number(parsed?.ts) || 0);

        const hasProtTs = Number(parsed?.protUpdatedAt) > 0;
        const hasCreaTs = Number(parsed?.creaUpdatedAt) > 0;
        return {
            prot: cleanNumber(parsed?.prot, 0),
            crea: cleanNumber(parsed?.crea, 0),
            updatedAt: baseUpdatedAt,
            protUpdatedAt: hasProtTs ? Math.max(0, Number(parsed?.protUpdatedAt) || 0) : baseUpdatedAt,
            creaUpdatedAt: hasCreaTs ? Math.max(0, Number(parsed?.creaUpdatedAt) || 0) : baseUpdatedAt,
            syncVersion: Number(parsed?.syncVersion) || 1
        };
    },

    mergeSupplementInventoryValue(localValue, remoteValue) {
        const local = this.normalizeSupplementInventoryValue(localValue);
        const remote = this.normalizeSupplementInventoryValue(remoteValue);
        const chooseField = (field) => {
            const tsField = `${field}UpdatedAt`;
            const localTs = Math.max(0, Number(local?.[tsField]) || 0);
            const remoteTs = Math.max(0, Number(remote?.[tsField]) || 0);

            if (localTs > remoteTs) return { value: local[field], ts: localTs };
            if (remoteTs > localTs) return { value: remote[field], ts: remoteTs };

            // Legacy/no-metadata fallback: keep the existing Pegasus behavior and trust remote.
            return { value: remote[field], ts: Math.max(localTs, remoteTs) };
        };

        const prot = chooseField('prot');
        const crea = chooseField('crea');
        const merged = {
            prot: Math.max(0, Number(prot.value) || 0),
            crea: Math.max(0, Number(crea.value) || 0),
            updatedAt: Math.max(prot.ts, crea.ts, Number(local.updatedAt) || 0, Number(remote.updatedAt) || 0),
            protUpdatedAt: prot.ts || Math.max(Number(local.protUpdatedAt) || 0, Number(remote.protUpdatedAt) || 0),
            creaUpdatedAt: crea.ts || Math.max(Number(local.creaUpdatedAt) || 0, Number(remote.creaUpdatedAt) || 0),
            syncVersion: 2
        };

        try {
            this.safeSetLocal?.('pegasus_prot_stock', String(merged.prot));
            this.safeSetLocal?.('pegasus_crea_stock', String(merged.crea));
        } catch (_) {}

        return JSON.stringify(merged);
    },


    isSupplementInventoryStorageKey(key) {
        return key === "pegasus_supp_inventory" || key === "pegasus_prot_stock" || key === "pegasus_crea_stock";
    },

    shouldBlockDesktopBootSupplementWrite(key) {
        // PEGASUS 239: Desktop UI modules can rewrite supplement stock on boot
        // from stale localStorage/legacy labels before the first cloud pull.
        // Those writes must NOT become pending cloud changes, otherwise the PC
        // becomes the source of truth and overwrites a newer mobile refill.
        if (!this.isSupplementInventoryStorageKey(key)) return false;
        if (this.isMobileRuntime?.()) return false;
        if (this.hasSuccessfullyPulled) return false;
        if (!this.canRestoreApprovedDevice?.()) return false;
        return true;
    },

    pruneDesktopBootSupplementPending(reason = "desktop-boot-supplement-prune") {
        if (this.isMobileRuntime?.()) return false;
        if (this.hasSuccessfullyPulled) return false;
        if (!this.canRestoreApprovedDevice?.()) return false;

        const queue = this.loadPendingChanges();
        if (!queue || typeof queue !== "object") return false;

        let changed = false;
        for (const key of ["pegasus_supp_inventory", "pegasus_prot_stock", "pegasus_crea_stock"]) {
            if (Object.prototype.hasOwnProperty.call(queue, key)) {
                delete queue[key];
                changed = true;
            }
        }

        if (changed) {
            this.savePendingChanges(queue);
            try {
                console.warn("🛡️ CLOUD: Removed stale desktop boot supplement pending write before first pull.", reason);
            } catch (_) {}
        }

        return changed;
    },

    async mergeRemoteSupplementInventoryIntoLocal(remoteRecord, reason = "pre-push-inventory-merge") {
        // Last line of defence before a PUT: even if the desktop has a stale
        // pending snapshot, merge the current cloud supplement object into local
        // and push only the per-field newest inventory.
        if (!remoteRecord) return false;
        try {
            const remotePayload = await this.extractCloudPayload(remoteRecord);
            const remoteStorage = (remotePayload?.storage && typeof remotePayload.storage === "object") ? remotePayload.storage : {};
            if (!Object.prototype.hasOwnProperty.call(remoteStorage, "pegasus_supp_inventory")) return false;

            const currentLocal = localStorage.getItem("pegasus_supp_inventory");
            const mergedValue = this.mergeSupplementInventoryValue(currentLocal, remoteStorage.pegasus_supp_inventory);
            if (mergedValue && mergedValue !== currentLocal) {
                this.isApplyingRemote = true;
                try {
                    this.safeSetLocal("pegasus_supp_inventory", mergedValue);
                } finally {
                    this.isApplyingRemote = false;
                }
                try {
                    console.warn("🛡️ CLOUD: Supplement inventory merged with cloud before push.", reason);
                } catch (_) {}
                return true;
            }
        } catch (e) {
            try { console.warn("⚠️ CLOUD: Pre-push supplement merge skipped.", e); } catch (_) {}
        }
        return false;
    },

    mergeManagedStorageValue(key, localValue, remoteValue) {
        if (this.shouldPreserveLocalAgainstRemoteValue(key, localValue, remoteValue)) {
            try {
                console.warn("🛡️ CLOUD DATA GUARD: Preserved local non-empty value over empty remote for", key);
            } catch (_) {}
            return localValue;
        }
        if (key === "pegasus_weekly_history") {
            return this.mergeWeeklyHistoryValue(localValue, remoteValue);
        }
        if (key === "pegasus_weekly_history_counted_v2") {
            return this.mergeWeeklyLedgerValue(localValue, remoteValue);
        }
        if (key === "pegasus_weekly_history_week_key") {
            const currentWeek = this.getPegasusCurrentWeekKey();
            const localWeek = String(localValue || "").trim();
            const remoteWeek = String(remoteValue || "").trim();
            if (localWeek === currentWeek || remoteWeek === currentWeek) return currentWeek;
            return remoteWeek || localWeek || currentWeek;
        }
        if (key === "pegasus_muscle_targets") {
            return this.mergeMuscleTargetsValue(localValue, remoteValue);
        }
        if (key === "pegasus_supp_inventory") {
            return this.mergeSupplementInventoryValue(localValue, remoteValue);
        }
        const registry = window.PegasusMobileDataRegistry;
        if (!registry?.getDescriptor?.(key)) return remoteValue;
        return registry.mergeManagedRawValue(key, localValue, remoteValue);
    },

    shouldPreserveManagedKeyOnRemoteMissing(key) {
        // PEGASUS 235: Missing from remote means "not included in that cloud payload".
        // It is no longer interpreted as a delete, because a manual/thin JSONBin PUT
        // can omit most app keys and would otherwise wipe local data.
        return true;
    },

    getApprovalPinHash(record) {
        if (!record || typeof record !== "object") return "";
        return String(record?.approval?.pin_hash || record?.pin_hash || "").trim();
    },

    getApprovalMasterHash(record) {
        if (!record || typeof record !== "object") return "";
        return String(record?.approval?.master_hash || record?.master_hash || "").trim();
    },

    emitSyncStatus(status, force = false) {
        if (typeof window === "undefined") return;
        if (!status) return;

        if (!force && this.lastStatus === status) return;
        this.lastStatus = status;

        window.dispatchEvent(new CustomEvent("pegasus_sync_status", {
            detail: { status }
        }));
    },

    safeSetLocal(key, value) {
        const normalized = (typeof value === "string") ? value : JSON.stringify(value);
        if (window.originalSetItem) {
            window.originalSetItem.call(localStorage, key, normalized);
        } else {
            localStorage.setItem(key, normalized);
        }
    },

    safeRemoveLocal(key) {
        if (window.originalRemoveItem) {
            window.originalRemoveItem.call(localStorage, key);
        } else {
            localStorage.removeItem(key);
        }
    },

    safeCall(fn) {
        try {
            if (typeof fn === "function") fn();
        } catch (e) {
            console.warn("⚠️ UI SAFE CALL ERROR:", e);
        }
    },

    async hashString(value) {
        const input = String(value || "");

        try {
            if (globalThis.crypto?.subtle && typeof TextEncoder !== "undefined") {
                const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
                return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
            }
        } catch (e) {
            console.warn("⚠️ CLOUD: subtle hash fallback.", e);
        }

        let hash = 5381;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
        }
        return `fallback_${(hash >>> 0).toString(16)}`;
    },

    async matchesStoredMasterKey(masterKey) {
        const clean = String(masterKey || "").trim();
        if (!clean) return false;

        const storedHash = localStorage.getItem(this.storage.masterHash);
        if (!storedHash) return true;

        const incomingHash = await this.hashString(clean);
        return storedHash === incomingHash;
    },

    async fetchLatestRecord() {
        const effectiveKey = this.userKey || this.config.encryptedPart;
        const res = await fetch(
            `https://api.jsonbin.io/v3/b/${this.config.binId}/latest?nocache=${Date.now()}`,
            {
                headers: {
                    "X-Master-Key": effectiveKey,
                    "X-Bin-Meta": "false"
                }
            }
        );

        if (!res.ok) throw new Error("Fetch latest failed");

        const data = await res.json();
        return data.record || data;
    },

    normalizeEngineEvent(event) {
        if (!event) return null;

        const raw = (event.action && !event.type) ? event.action : event;
        if (!raw || typeof raw !== "object") return null;
        if (!raw.type) return null;

        const normalized = { ...raw };

        if (typeof raw.__ts === "number") {
            normalized.__ts = raw.__ts;
        } else if (typeof event.__ts === "number") {
            normalized.__ts = event.__ts;
        } else if (typeof event.time === "number") {
            normalized.__ts = event.time;
        }

        return normalized;
    },

    getEventHash(event) {
        const normalized = this.normalizeEngineEvent(event);
        if (!normalized) return "";

        const hashable = { ...normalized };
        delete hashable.__ts;

        try {
            return JSON.stringify(hashable);
        } catch (e) {
            return "";
        }
    },

    getBoundedEvents() {
        const events = this.engine?.getEventBuffer?.() || [];
        if (!Array.isArray(events)) return [];

        return events
            .map(ev => this.normalizeEngineEvent(ev))
            .filter(Boolean)
            .slice(-100);
    },

    async validatePin(pin, cloudRecord = null) {
        const clean = String(pin || "").trim();
        if (!clean || clean.length < 4) return false;

        const candidateHash = await this.hashString(clean);
        const remoteHash = this.getApprovalPinHash(cloudRecord);
        const localHash = String(localStorage.getItem(this.storage.localPinHash) || "").trim();

        if (remoteHash && remoteHash === candidateHash) return true;
        if (localHash && localHash === candidateHash) return true;

        return false;
    },

    async canSecureRebindPinWithMaster(masterKey, cloudRecord = null) {
        const cleanMaster = String(masterKey || "").trim();
        if (!cleanMaster || !cloudRecord) return false;

        const prevMaster = this.masterKey;

        try {
            const candidateMasterHash = await this.hashString(cleanMaster);
            const remoteMasterHash = this.getApprovalMasterHash(cloudRecord);
            if (remoteMasterHash && candidateMasterHash === remoteMasterHash) {
                return true;
            }

            this.masterKey = cleanMaster;

            if (cloudRecord?.protected?.contacts) {
                await this.decryptCloudPayload(cloudRecord.protected.contacts);
                return true;
            }

            if (cloudRecord?.__pegasus_secure_v1 && cloudRecord?.secure_payload) {
                await this.decryptCloudPayload(cloudRecord.secure_payload);
                return true;
            }

            if (this.hasApprovedDevice()) {
                return await this.matchesStoredMasterKey(cleanMaster);
            }

            return false;
        } catch (e) {
            return false;
        } finally {
            this.masterKey = prevMaster;
        }
    },

    loadPendingChanges() {
        try {
            const raw = localStorage.getItem(this.storage.pendingQueue);
            const parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === "object") ? parsed : {};
        } catch (e) {
            return {};
        }
    },

    savePendingChanges(queue) {
        const normalized = (queue && typeof queue === "object") ? queue : {};
        this.safeSetLocal(this.storage.pendingQueue, JSON.stringify(normalized));
    },

    hasPendingChanges() {
        return Object.keys(this.loadPendingChanges()).length > 0;
    },

    queuePendingChange(key, value, type = "set") {
        if (!this.isAllowedStorageKey(key)) return;
        if (this.shouldBlockDesktopBootSupplementWrite?.(key)) {
            this.pruneDesktopBootSupplementPending?.("queuePendingChange:block");
            try { this.tryApprovedDeviceUnlock?.(); } catch (_) {}
            return;
        }

        const queue = this.loadPendingChanges();
        queue[key] = {
            type,
            value: type === "set" ? String(value) : null,
            ts: Date.now()
        };
        this.savePendingChanges(queue);
    },

    clearPendingChanges() {
        this.savePendingChanges({});
    },

    pruneStalePendingChanges(remoteTs) {
        const queue = this.loadPendingChanges();
        if (!queue || typeof queue !== "object") return false;

        const remoteMillis = Number(remoteTs);
        if (!Number.isFinite(remoteMillis) || remoteMillis <= 0) return false;

        let changed = false;
        for (const [key, entry] of Object.entries(queue)) {
            const entryTs = Number(entry?.ts || 0);
            if (Number.isFinite(entryTs) && entryTs > 0 && entryTs <= remoteMillis) {
                delete queue[key];
                changed = true;
            }
        }

        if (changed) {
            this.savePendingChanges(queue);
        }

        return changed;
    },

    applyPendingChangesToLocal() {
        const queue = this.loadPendingChanges();
        const entries = Object.entries(queue);
        if (!entries.length) return false;

        this.isApplyingRemote = true;
        let changed = false;
        try {
            for (const [key, entry] of entries) {
                if (!this.isAllowedStorageKey(key)) continue;

                if (entry?.type === "remove") {
                    if (this.isWeeklyProgressKey(key)) {
                        const localValue = localStorage.getItem(key);
                        if (key === "pegasus_weekly_history_counted_v2") {
                            const localLedger = this.safeParseStorageObject(localValue, null);
                            const hasLocalCurrentSets = localLedger?.weekKey === this.getPegasusCurrentWeekKey()
                                && localLedger.exercises
                                && typeof localLedger.exercises === "object"
                                && Object.values(localLedger.exercises).some(count => Math.max(0, Number(count) || 0) > 0);
                            if (hasLocalCurrentSets) continue;
                        }
                    }
                    this.safeRemoveLocal(key);
                    changed = true;
                } else if (typeof entry?.value === "string") {
                    const currentLocal = localStorage.getItem(key);
                    const shouldMergePending = this.isWeeklyProgressKey(key) ||
                        key === "pegasus_supp_inventory" ||
                        key === "pegasus_muscle_targets";
                    const nextValue = shouldMergePending
                        ? this.mergeManagedStorageValue(key, currentLocal, entry.value)
                        : entry.value;
                    if (nextValue !== currentLocal) {
                        this.safeSetLocal(key, nextValue);
                        changed = true;
                    }
                }
            }
        } finally {
            this.isApplyingRemote = false;
        }

        return changed;
    },

    getLocalManagedKeys(options = {}) {
        const includeProtected = options.includeProtected !== false;
        const keys = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (this.isGeneralStorageKey(key)) {
                keys.push(key);
                continue;
            }
            if (includeProtected && this.isProtectedStorageKey(key)) {
                keys.push(key);
            }
        }

        return keys;
    },

    collectStorageSnapshot(options = {}) {
        const includeProtected = options.includeProtected !== false;
        const general = {};
        const protectedStorage = {};

        for (const key of this.getLocalManagedKeys({ includeProtected })) {
            const value = localStorage.getItem(key);
            if (this.isProtectedStorageKey(key)) {
                protectedStorage[key] = value;
            } else {
                general[key] = value;
            }
        }

        return { general, protectedStorage };
    },

    toBase64(bytes) {
        let binary = "";
        const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
        return btoa(binary);
    },

    fromBase64(str) {
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    },

    randomBytes(length = 16) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return bytes;
    },

    async deriveAesKey(secret, saltBytes, usage = ["encrypt", "decrypt"]) {
        const encoder = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            "raw",
            encoder.encode(String(secret || "")),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: saltBytes,
                iterations: this.config.cryptoIterations,
                hash: "SHA-256"
            },
            baseKey,
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            usage
        );
    },

    async encryptString(secret, plainText) {
        const encoder = new TextEncoder();
        const iv = this.randomBytes(12);
        const salt = this.randomBytes(16);
        const key = await this.deriveAesKey(secret, salt);
        const cipher = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encoder.encode(String(plainText || ""))
        );

        return {
            v: 1,
            salt: this.toBase64(salt),
            iv: this.toBase64(iv),
            data: this.toBase64(new Uint8Array(cipher))
        };
    },

    async decryptString(secret, envelope) {
        if (!envelope?.salt || !envelope?.iv || !envelope?.data) {
            throw new Error("INVALID_ENVELOPE");
        }

        const key = await this.deriveAesKey(secret, this.fromBase64(envelope.salt));
        const plainBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: this.fromBase64(envelope.iv) },
            key,
            this.fromBase64(envelope.data)
        );

        return new TextDecoder().decode(plainBuffer);
    },

    getOrCreateDeviceSecret() {
        let secret = localStorage.getItem(this.storage.deviceSecret);
        if (secret) return secret;

        secret = this.toBase64(this.randomBytes(32));
        this.safeSetLocal(this.storage.deviceSecret, secret);
        return secret;
    },

    async storeWrappedMaster(masterKey) {
        const secret = this.getOrCreateDeviceSecret();
        const wrapped = await this.encryptString(secret, masterKey);
        this.safeSetLocal(this.storage.wrappedMaster, JSON.stringify(wrapped));
    },

    async getStoredMasterKey() {
        const wrappedRaw = localStorage.getItem(this.storage.wrappedMaster);
        if (!wrappedRaw) return "";

        try {
            const wrapped = JSON.parse(wrappedRaw);
            const secret = this.getOrCreateDeviceSecret();
            return await this.decryptString(secret, wrapped);
        } catch (e) {
            console.warn("⚠️ CLOUD: Wrapped master unavailable.", e);
            return "";
        }
    },

    async encryptCloudPayload(payload) {
        return this.encryptString(this.masterKey, JSON.stringify(payload || {}));
    },

    async decryptCloudPayload(envelope) {
        try {
            const text = await this.decryptString(this.masterKey, envelope);
            return JSON.parse(text || "{}");
        } catch (e) {
            throw new Error("INVALID_MASTER_KEY");
        }
    },

    async extractCloudPayload(cloud) {
        if (cloud?.__pegasus_secure_v1 && cloud?.secure_payload) {
            if (!this.masterKey) {
                throw new Error("INVALID_MASTER_KEY");
            }
            const legacySecure = await this.decryptCloudPayload(cloud.secure_payload);
            return {
                storage: (legacySecure?.storage && typeof legacySecure.storage === "object") ? legacySecure.storage : {},
                protectedStorage: (legacySecure?.protectedStorage && typeof legacySecure.protectedStorage === "object") ? legacySecure.protectedStorage : {},
                events: Array.isArray(legacySecure?.events || cloud?.__events__) ? (legacySecure?.events || cloud.__events__) : [],
                hasProtectedPayload: !!(legacySecure?.protectedStorage && Object.keys(legacySecure.protectedStorage).length)
            };
        }

        const generalStorage = {};
        let protectedStorage = {};
        let hasProtectedPayload = false;

        if (cloud?.__pegasus_plain_v3 && cloud?.storage && typeof cloud.storage === "object") {
            Object.assign(generalStorage, cloud.storage);

            const protectedContacts = cloud?.protected?.contacts;
            if (protectedContacts) {
                hasProtectedPayload = true;
                if (!this.masterKey) {
                    console.warn("⚠️ CLOUD: Protected contacts present but master key is unavailable. Continuing with general storage only.");
                } else if (this.shouldSkipProtectedContactsDecrypt(protectedContacts)) {
                    protectedStorage = {};
                } else {
                    try {
                        const decryptedContacts = await this.decryptCloudPayload(protectedContacts);
                        if (decryptedContacts && typeof decryptedContacts === "object") {
                            protectedStorage = (decryptedContacts.storage && typeof decryptedContacts.storage === "object")
                                ? decryptedContacts.storage
                                : decryptedContacts;
                        }
                        this.clearProtectedContactsUnavailable();
                    } catch (e) {
                        this.markProtectedContactsUnavailable(protectedContacts);
                        if (this.hasLocalProtectedStorage() || this.hasProtectedRepairPending()) {
                            console.warn("⚠️ CLOUD: Protected contacts bucket unavailable for this unlock. Continuing with general storage only.", e);
                        }
                        protectedStorage = {};
                    }
                }
            } else {
                this.clearProtectedContactsUnavailable();
                if (this.hasLocalProtectedStorage()) {
                    this.markProtectedRepairPending();
                }
            }

            return {
                storage: generalStorage,
                protectedStorage,
                events: Array.isArray(cloud?.__events__) ? cloud.__events__ : [],
                hasProtectedPayload,
                deletedKeys: Array.isArray(cloud?.__deleted_keys__) ? cloud.__deleted_keys__ : []
            };
        }

        if (cloud?.__pegasus_plain_v2 && cloud?.storage && typeof cloud.storage === "object") {
            return {
                storage: cloud.storage,
                protectedStorage: {},
                events: Array.isArray(cloud?.__events__) ? cloud.__events__ : [],
                hasProtectedPayload: false,
                deletedKeys: Array.isArray(cloud?.__deleted_keys__) ? cloud.__deleted_keys__ : []
            };
        }

        if (cloud && typeof cloud === "object") {
            const legacyMapped = this.mapLegacyCloudRecordToStorage(cloud);
            Object.assign(generalStorage, legacyMapped.generalStorage || {});
            Object.assign(protectedStorage, legacyMapped.protectedStorage || {});

            for (const key of Object.keys(cloud)) {
                if (this.isGeneralStorageKey(key)) {
                    generalStorage[key] = (typeof cloud[key] === "string") ? cloud[key] : JSON.stringify(cloud[key]);
                }
                if (this.isProtectedStorageKey(key)) {
                    protectedStorage[key] = (typeof cloud[key] === "string") ? cloud[key] : JSON.stringify(cloud[key]);
                }
            }
        }

        return {
            storage: generalStorage,
            protectedStorage,
            events: Array.isArray(cloud?.__events__) ? cloud.__events__ : [],
            hasProtectedPayload: Object.keys(protectedStorage || {}).length > 0,
            legacyThinPayload: true
        };
    },

    setValidSessionWindow() {
        this.safeSetLocal(this.storage.validUntil, this.getNextUnlockTs().toString());
        this.safeRemoveLocal(this.storage.legacyPin);
        this.safeRemoveLocal(this.storage.legacyTime);
    },

    clearLocalSecurityState(options = {}) {
        const preserveDeviceSecret = options.preserveDeviceSecret === true;
        const preserveWrappedMaster = options.preserveWrappedMaster === true;
        const preserveMasterHash = options.preserveMasterHash !== false;

        this.safeRemoveLocal(this.storage.validUntil);
        this.safeRemoveLocal(this.storage.lastPush);
        this.safeRemoveLocal(this.storage.pendingQueue);
        this.safeRemoveLocal(this.storage.localPinHash);
        this.safeRemoveLocal(this.storage.protectedContactsState);
        this.safeRemoveLocal(this.storage.protectedContactsRepair);
        this.clearDataGuardRepairPending();
        this.safeRemoveLocal(this.storage.approvedDevice);
        this.safeRemoveLocal(this.storage.desktopApproved);
        this.safeRemoveLocal(this.storage.legacyPin);
        this.safeRemoveLocal(this.storage.legacyTime);

        if (!preserveMasterHash) this.safeRemoveLocal(this.storage.masterHash);
        if (!preserveWrappedMaster) this.safeRemoveLocal(this.storage.wrappedMaster);
        if (!preserveDeviceSecret) this.safeRemoveLocal(this.storage.deviceSecret);

        this.isUnlocked = false;
        this.hasSuccessfullyPulled = false;
        this.masterKey = "";
        this.userKey = "";
        this.restorePromise = null;
        this.hasApprovedRestoreCompleted = false;
        this.emitSyncStatus("locked", true);
    },

    async restoreApprovedDevice(options = {}) {
        this.traceStep("cloudSync", "restoreApprovedDevice", "START", options?.requireValidWindow ? "AUTO" : "APPROVED");
        const opts = {
            requireValidWindow: true,
            logLabel: "Auto-unlocked",
            ...options
        };

        if (this.isUnlocked && this.hasApprovedRestoreCompleted) {
            return true;
        }

        if (this.restorePromise) {
            return this.restorePromise;
        }

        this.restorePromise = (async () => {
            if (opts.requireValidWindow) {
                if (!this.canAutoUnlock()) return false;
            } else {
                if (!this.canRestoreApprovedDevice()) return false;
            }

            const restoredMaster = await this.getStoredMasterKey();
            if (!restoredMaster) return false;

            const prevState = {
                isUnlocked: this.isUnlocked,
                hasSuccessfullyPulled: this.hasSuccessfullyPulled,
                userKey: this.userKey,
                masterKey: this.masterKey,
                hasApprovedRestoreCompleted: this.hasApprovedRestoreCompleted
            };

            this.userKey = this.config.encryptedPart;
            this.isUnlocked = true;
            this.masterKey = restoredMaster;
            this.emitSyncStatus(navigator.onLine ? "syncing" : "offline", true);

            try {
                const repairedMasterHash = await this.hashString(restoredMaster);
                this.safeSetLocal(this.storage.masterHash, repairedMasterHash);
                this.setValidSessionWindow();
                this.markApprovedDevice();

                if (navigator.onLine) {
                    let approvalRecord = null;
                    try {
                        approvalRecord = await this.fetchLatestRecord();
                    } catch (e) {
                        approvalRecord = null;
                    }
                    const remotePinHash = this.getApprovalPinHash(approvalRecord);
                    if (remotePinHash && !localStorage.getItem(this.storage.localPinHash)) {
                        this.safeSetLocal(this.storage.localPinHash, remotePinHash);
                    }
                    await this.pull(true);
                } else {
                    this.hasSuccessfullyPulled = !!localStorage.getItem(this.storage.lastPush);
                }

                this.startAutoSync();

                if (navigator.onLine && (this.hasPendingChanges() || this.hasProtectedRepairPending() || this.hasDataGuardRepairPending())) {
                    await this._doPush();
                }

                this.hasApprovedRestoreCompleted = true;
                console.log(`🔓 CLOUD: ${opts.logLabel}`);
                this.emitSyncStatus(navigator.onLine ? "online" : "offline", true);
                return true;
            } catch (e) {
                this.isUnlocked = prevState.isUnlocked;
                this.hasSuccessfullyPulled = prevState.hasSuccessfullyPulled;
                this.userKey = prevState.userKey;
                this.masterKey = prevState.masterKey;
                this.hasApprovedRestoreCompleted = prevState.hasApprovedRestoreCompleted;
                this.emitSyncStatus("locked", true);
                console.warn(`⚠️ CLOUD: ${opts.logLabel} failed.`, e);
                return false;
            } finally {
                this.restorePromise = null;
            }
        })();

        return this.restorePromise;
    },

    async tryAutoUnlock() {
        return this.restoreApprovedDevice({ requireValidWindow: true, logLabel: "Auto-unlocked" });
    },

    async tryApprovedDeviceUnlock() {
        if (this.isUnlocked && this.hasApprovedRestoreCompleted) return true;
        return this.restoreApprovedDevice({ requireValidWindow: false, logLabel: "Approved device restored" });
    },

    /* =========================
       🔓 UNLOCK
    ========================= */
    async unlock(pin, masterKey, options = {}) {
        this.traceStep("cloudSync", "unlock", "START", options?.autoUnlock ? "AUTO" : "MANUAL");
        if (this.isUnlocked) return true;

        const opts = {
            skipPinCheck: false,
            persistSession: true,
            autoUnlock: false,
            deferPostUnlockSync: false,
            ...options
        };

        const cleanPin = String(pin || "").trim();
        const cleanMaster = String(masterKey || "").trim();
        if (!cleanMaster) return false;

        const storedMasterHash = String(localStorage.getItem(this.storage.masterHash) || "").trim();
        const localPinHash = String(localStorage.getItem(this.storage.localPinHash) || "").trim();
        const candidatePinHash = cleanPin ? await this.hashString(cleanPin) : "";
        const candidateMasterHash = await this.hashString(cleanMaster);
        const trustedLocalMaster = storedMasterHash ? (await this.matchesStoredMasterKey(cleanMaster)) : false;
        const storedMasterMatches = storedMasterHash ? trustedLocalMaster : true;
        const fastLocalApproval = !!(opts.deferPostUnlockSync && candidatePinHash && localPinHash && candidatePinHash === localPinHash && trustedLocalMaster);

        const prevUserKey = this.userKey;
        this.userKey = this.config.encryptedPart;

        let cloudRecord = null;
        if (navigator.onLine && !fastLocalApproval) {
            try {
                cloudRecord = await this.fetchLatestRecord();
            } catch (e) {
                console.warn("⚠️ CLOUD: Approval fetch fallback.", e);
            }
        }

        const remotePinHash = this.getApprovalPinHash(cloudRecord);
        const hasBoundPin = !!(remotePinHash || localPinHash);
        let pinAccepted = !!opts.skipPinCheck || fastLocalApproval;

        if (!pinAccepted) {
            pinAccepted = await this.validatePin(cleanPin, cloudRecord);

            const canRepairMissingPinBinding = !pinAccepted
                && !hasBoundPin
                && cleanPin.length >= 4
                && trustedLocalMaster
                && this.hasApprovedDevice();

            const canSecureRebindFreshDevice = !pinAccepted
                && !hasBoundPin
                && cleanPin.length >= 4
                && await this.canSecureRebindPinWithMaster(cleanMaster, cloudRecord);

            const canSecureRebindExistingBinding = !pinAccepted
                && hasBoundPin
                && cleanPin.length >= 4
                && await this.canSecureRebindPinWithMaster(cleanMaster, cloudRecord);

            if (canRepairMissingPinBinding) {
                console.warn("⚠️ CLOUD: Approval PIN binding missing on trusted approved device. Rebinding with current PIN.");
                this.traceStep("cloudSync", "unlock", "REBIND_ALLOWED", "MISSING_PIN_BINDING_APPROVED_DEVICE");
                pinAccepted = true;
            } else if (canSecureRebindFreshDevice) {
                console.warn("⚠️ CLOUD: Fresh-device PIN binding rebuilt from successful master-key validation.");
                const remoteMasterHash = this.getApprovalMasterHash(cloudRecord);
                const rebindReason = remoteMasterHash
                    ? "MISSING_PIN_BINDING_MASTER_HASH"
                    : (cloudRecord ? "MISSING_PIN_BINDING_LEGACY_MIGRATION" : "MISSING_PIN_BINDING_FRESH_MASTER_ONLY");
                this.traceStep("cloudSync", "unlock", "REBIND_ALLOWED", rebindReason);
                pinAccepted = true;
            } else if (canSecureRebindExistingBinding) {
                console.warn("⚠️ CLOUD: Approval PIN mismatch repaired from successful master-key validation. Rebinding with current PIN.");
                this.traceStep("cloudSync", "unlock", "REBIND_ALLOWED", "PIN_MISMATCH_MASTER_HASH");
                pinAccepted = true;
            }
        }

        if (!pinAccepted) {
            this.traceStep("cloudSync", "unlock", "PIN_REJECTED", hasBoundPin ? "PIN_MISMATCH" : "PIN_BINDING_MISSING");
            this.userKey = prevUserKey;
            return false;
        }

        const prevState = {
            isUnlocked: this.isUnlocked,
            hasSuccessfullyPulled: this.hasSuccessfullyPulled,
            userKey: prevUserKey,
            masterKey: this.masterKey
        };

        this.userKey = this.config.encryptedPart;
        this.masterKey = cleanMaster;
        this.isUnlocked = true;
        this.emitSyncStatus(navigator.onLine ? "syncing" : "offline", true);

        let sessionMaterialsPersisted = false;

        try {
            this.safeSetLocal(this.storage.masterHash, candidateMasterHash);
            if (candidatePinHash) {
                this.safeSetLocal(this.storage.localPinHash, candidatePinHash);
            }
            await this.storeWrappedMaster(cleanMaster);
            this.markApprovedDevice();

            if (opts.persistSession) {
                this.setValidSessionWindow();
            }
            sessionMaterialsPersisted = true;

            if (navigator.onLine) {
                if (!fastLocalApproval) {
                    try {
                        await this.pull(true);
                    } catch (e) {
                        if (String(e?.message || "") === "INVALID_MASTER_KEY") {
                            throw e;
                        }
                        console.warn("⚠️ CLOUD: Soft unlock sync error.", e);
                    }
                } else {
                    this.hasSuccessfullyPulled = !!localStorage.getItem(this.storage.lastPush);
                }
            } else {
                this.hasSuccessfullyPulled = !!localStorage.getItem(this.storage.lastPush);
            }

            this.startAutoSync();

            if (navigator.onLine) {
                if (opts.deferPostUnlockSync || fastLocalApproval) {
                    setTimeout(() => {
                        this.syncNow(true).catch(e => console.error("❌ DEFERRED SYNC ERROR:", e));
                    }, 0);
                } else if (this.hasPendingChanges() || this.hasProtectedRepairPending()) {
                    await this._doPush();
                }
            }

            if (!storedMasterMatches) {
                console.warn("⚠️ CLOUD: Stored master hash repaired from successful unlock.");
            }
            this.hasApprovedRestoreCompleted = true;
            console.log(opts.autoUnlock ? "🔓 CLOUD: Auto-unlocked" : "🔓 CLOUD: Unlocked");
            this.traceStep("cloudSync", "unlock", "SUCCESS", opts.autoUnlock ? "AUTO" : "MANUAL");
            this.emitSyncStatus(navigator.onLine ? "online" : "offline", true);
            return true;
        } catch (e) {
            this.isUnlocked = prevState.isUnlocked;
            this.hasSuccessfullyPulled = prevState.hasSuccessfullyPulled;
            this.userKey = prevState.userKey;
            this.masterKey = prevState.masterKey;
            if (String(e?.message || "") === "INVALID_MASTER_KEY" && sessionMaterialsPersisted) {
                this.safeRemoveLocal(this.storage.validUntil);
                this.safeRemoveLocal(this.storage.wrappedMaster);
                if (!storedMasterHash) this.safeRemoveLocal(this.storage.masterHash);
            }
            this.hasApprovedRestoreCompleted = false;
            this.emitSyncStatus("locked", true);
            if (String(e?.message || "") === "INVALID_MASTER_KEY") return false;
            this.traceError("cloudSync", "unlock", e);
            console.error("❌ UNLOCK ERROR:", e);
            return false;
        }
    },

    /* =========================
       📥 PULL (SECURE + QUEUE SAFE)
    ========================= */
    async pull(silent = false) {
        this.traceStep("cloudSync", "pull", "START", silent ? "SILENT" : "VERBOSE");
        if (!this.isUnlocked || this.isPulling) return false;

        if (!navigator.onLine) {
            this.emitSyncStatus("offline", true);
            return false;
        }

        this.isPulling = true;
        this.emitSyncStatus("syncing", true);

        let changed = false;
        let finalStatus = "online";

        try {
            const cloud = await this.fetchLatestRecord();
            const lastLocal = parseInt(localStorage.getItem(this.storage.lastPush) || "0", 10);
            const remoteTs = parseInt(cloud?.last_update_ts || "0", 10);
            let pendingExists = this.hasPendingChanges();

            if (!remoteTs) {
                this.hasSuccessfullyPulled = true;
                if (pendingExists) {
                    this.applyPendingChangesToLocal();
                }
                return false;
            }

            if (remoteTs !== lastLocal) {
                if (remoteTs > lastLocal && pendingExists) {
                    this.pruneStalePendingChanges(remoteTs);
                    pendingExists = this.hasPendingChanges();
                }

                const remotePayload = await this.extractCloudPayload(cloud);
                const remoteStorage = (remotePayload?.storage && typeof remotePayload.storage === "object") ? remotePayload.storage : {};
                const remoteProtectedStorage = (remotePayload?.protectedStorage && typeof remotePayload.protectedStorage === "object") ? remotePayload.protectedStorage : {};
                const remoteEvents = Array.isArray(remotePayload?.events) ? remotePayload.events : [];
                const hasProtectedPayload = remotePayload?.hasProtectedPayload === true;
                const remoteDeletedKeys = Array.isArray(remotePayload?.deletedKeys) ? remotePayload.deletedKeys : [];

                if (Object.prototype.hasOwnProperty.call(remoteStorage, "pegasus_supp_inventory")) {
                    this.pruneDesktopBootSupplementPending?.("pull:remote-has-supp-inventory");
                    pendingExists = this.hasPendingChanges();
                }

                const remoteIsThin = this.isRemotePayloadThin(remoteStorage, remoteProtectedStorage);

                this.saveDataGuardSnapshot("before-cloud-pull", {
                    remoteTs,
                    lastLocal,
                    remoteKeys: Object.keys(remoteStorage).length,
                    remoteProtectedKeys: Object.keys(remoteProtectedStorage).length,
                    remoteIsThin
                });

                if (remoteIsThin) {
                    console.warn("🛡️ CLOUD DATA GUARD: Thin/partial cloud payload detected. Merge-only mode active; no local keys will be deleted.");

                    const localCriticalKeys = this.getDataGuardCriticalKeys()
                        .filter(key => this.hasMeaningfulSyncValue(localStorage.getItem(key)));
                    const missingCriticalKeys = localCriticalKeys
                        .filter(key => !Object.prototype.hasOwnProperty.call(remoteStorage, key) && !Object.prototype.hasOwnProperty.call(remoteProtectedStorage, key));

                    if (missingCriticalKeys.length > 0 || Object.keys(remoteStorage).length < this.getLocalManagedKeys({ includeProtected: true }).length) {
                        this.markDataGuardRepairPending("thin-remote-payload");
                        console.warn("🛡️ CLOUD DATA GUARD: Full repair push armed after safe merge.", {
                            missingCriticalKeys: missingCriticalKeys.slice(0, 12),
                            remoteKeys: Object.keys(remoteStorage).length,
                            localManagedKeys: this.getLocalManagedKeys({ includeProtected: true }).length
                        });
                    }
                }

                console.log("☁️ CLOUD: Syncing latest version...");
                changed = true;

                this.isApplyingRemote = true;
                this._remoteStorageMergeContext = remoteStorage;
                try {
                    const localGeneralKeys = this.getLocalManagedKeys({ includeProtected: false });
                    const remoteGeneralKeys = new Set(Object.keys(remoteStorage));

                    for (const key of localGeneralKeys) {
                        if (!remoteGeneralKeys.has(key)) {
                            if (this.shouldApplyRemoteDeletion(key, { deletedKeys: remoteDeletedKeys })) {
                                this.safeRemoveLocal(key);
                            } else {
                                continue;
                            }
                        }
                    }

                    for (const [key, value] of Object.entries(remoteStorage)) {
                        if (this.isGeneralStorageKey(key)) {
                            const mergedValue = this.mergeManagedStorageValue(key, localStorage.getItem(key), value);
                            this.safeSetLocal(key, mergedValue);
                        }
                    }

                    if (hasProtectedPayload) {
                        const localProtectedKeys = this.getLocalManagedKeys({ includeProtected: true }).filter(k => this.isProtectedStorageKey(k));
                        const remoteProtectedKeys = new Set(Object.keys(remoteProtectedStorage));

                        for (const key of localProtectedKeys) {
                            if (!remoteProtectedKeys.has(key)) {
                                if (this.shouldApplyRemoteDeletion(key, { deletedKeys: remoteDeletedKeys })) {
                                    this.safeRemoveLocal(key);
                                } else {
                                    continue;
                                }
                            }
                        }

                        for (const [key, value] of Object.entries(remoteProtectedStorage)) {
                            if (this.isProtectedStorageKey(key)) {
                                const mergedValue = this.mergeManagedStorageValue(key, localStorage.getItem(key), value);
                                this.safeSetLocal(key, mergedValue);
                            }
                        }
                    }
                } finally {
                    this._remoteStorageMergeContext = null;
                    this.isApplyingRemote = false;
                }

                if (this.engine && remoteEvents.length) {
                    try {
                        const existingBuffer = this.engine.getEventBuffer?.() || [];
                        const existingHashes = new Set(
                            existingBuffer
                                .map(ev => this.getEventHash(ev))
                                .filter(Boolean)
                        );

                        for (const remoteEvent of remoteEvents.slice(-100)) {
                            const normalizedEvent = this.normalizeEngineEvent(remoteEvent);
                            if (!normalizedEvent) continue;

                            const eventHash = this.getEventHash(normalizedEvent);
                            if (!eventHash || existingHashes.has(eventHash)) continue;

                            this.engine.dispatch(normalizedEvent);
                            existingHashes.add(eventHash);
                        }
                    } catch (e) {
                        console.warn("⚠️ ENGINE BRIDGE ERROR:", e);
                    }
                }

                this.safeSetLocal(this.storage.lastPush, remoteTs.toString());
            }

            this.hasSuccessfullyPulled = true;

            try {
                if (typeof window.enforcePegasusSaturdayWeeklyReset === "function") {
                    window.enforcePegasusSaturdayWeeklyReset({ source: "cloud-pull-complete", push: false });
                } else if (typeof window.enforcePegasusMondayWeeklyReset === "function") {
                    window.enforcePegasusMondayWeeklyReset({ source: "cloud-pull-complete", push: false });
                }
            } catch (resetError) {
                console.warn("⚠️ CLOUD: Saturday reset check after pull skipped.", resetError);
            }

            if (pendingExists) {
                changed = this.applyPendingChangesToLocal() || changed;
            }

            if (!silent && changed) {
                console.log("📥 CLOUD: Pull OK");
            }

            this.traceStep("cloudSync", "pull", changed ? "CHANGED" : "DONE");
            return changed;
        } catch (e) {
            if (String(e?.message || "") === "INVALID_MASTER_KEY") {
                finalStatus = "locked";
                throw e;
            }

            const isTransientFetchError = (e instanceof TypeError) || /failed to fetch|network|load failed/i.test(String(e?.message || e || ""));
            if (isTransientFetchError) {
                console.warn("⚠️ CLOUD: Pull προσωρινά απέτυχε — θα ξαναδοκιμάσει στο επόμενο sync.", e);
            } else {
                this.traceError("cloudSync", "pull", e);
                console.error("❌ PULL ERROR:", e);
            }
            finalStatus = navigator.onLine ? (isTransientFetchError ? "online" : "error") : "offline";
            return false;
        } finally {
            this.isPulling = false;
            if (this.isMobileRuntime?.() && finalStatus === "online") {
                this.markMobileSyncComplete?.();
            }

            if (changed) {
                setTimeout(() => {
                    this.triggerUIUpdate();
                }, 0);
            }

            this.emitSyncStatus(finalStatus, true);
        }
    },

    /* =========================
       🔁 SYNC NOW
    ========================= */
    async syncNow(silent = false) {
        this.traceStep("cloudSync", "syncNow", "START", silent ? "SILENT" : "VERBOSE");
        if (this.shouldDeferMobileCadence?.("syncNow")) return false;
        if (!this.isUnlocked) {
            if (this.canRestoreApprovedDevice()) {
                const restored = await this.tryApprovedDeviceUnlock();
                if (!restored) return false;
            } else {
                return false;
            }
        }
        if (this.isPulling || this.isPushing) return false;
        if (!navigator.onLine) {
            this.emitSyncStatus("offline", true);
            return false;
        }

        const changed = await this.pull(silent);

        if (this.hasPendingChanges() || this.hasProtectedRepairPending() || this.hasDataGuardRepairPending()) {
            const pushed = await this._doPush();
            this.traceStep("cloudSync", "syncNow", pushed ? "PUSHED" : "PULL_ONLY");
            return !!(changed || pushed);
        }

        this.traceStep("cloudSync", "syncNow", changed ? "CHANGED" : "NO_CHANGE");
        return !!changed;
    },

    /* =========================
       📤 PUSH (ENCRYPTED SNAPSHOT)
    ========================= */
    push(force = false) {
        if (this.shouldDeferMobileCadence?.(force ? "push-force" : "push")) return false;
        if (!this.isUnlocked) {
            if (this.canRestoreApprovedDevice()) {
                return this.tryApprovedDeviceUnlock().then(ok => {
                    if (!ok) return false;
                    return this.push(force);
                });
            }
            return false;
        }
        if (this.isPulling || this.isPushing) return false;

        if (!navigator.onLine) {
            this.emitSyncStatus("offline", true);
            return false;
        }

        if (force) {
            return this._doPush();
        }

        if (this.pushTimeout) clearTimeout(this.pushTimeout);

        this.pushTimeout = setTimeout(() => {
            if (
                this.isUnlocked &&
                !this.isPulling &&
                !this.isPushing &&
                navigator.onLine
            ) {
                this._doPush();
            }
        }, this.config.syncThrottle);
    },

    async _doPush() {
        this.traceStep("cloudSync", "push", "START");
        if (this.shouldDeferMobileCadence?.("_doPush")) return false;
        if (!this.isUnlocked) return false;
        if (!navigator.onLine) {
            this.emitSyncStatus("offline", true);
            return false;
        }

        // PEGASUS 182: an approved device must pull once before its first push.
        // This prevents stale desktop boot/reset zeros from overwriting the real current-week cloud state.
        if (!this.hasSuccessfullyPulled && this.canRestoreApprovedDevice?.() && !this.isPulling) {
            await this.pull(true);
        }

        this.isPushing = true;
        this.emitSyncStatus("syncing", true);

        let finalStatus = "online";

        try {
            const remote = await this.fetchLatestRecord();
            const remoteTs = parseInt(remote?.last_update_ts || "0", 10);
            const localTs = parseInt(localStorage.getItem(this.storage.lastPush) || "0", 10);
            this.pruneDesktopBootSupplementPending?.("push:before-pending-read");
            const pendingQueueBeforePush = this.loadPendingChanges();
            const pendingExists = Object.keys(pendingQueueBeforePush).length > 0;
            const protectedRepairPending = this.hasProtectedRepairPending();
            const dataGuardRepairPending = this.hasDataGuardRepairPending();
            const deletedKeys = Object.entries(pendingQueueBeforePush)
                .filter(([key, entry]) => entry?.type === "remove" && this.isAllowedStorageKey(key) && !this.getDataGuardCriticalKeys().includes(key))
                .map(([key]) => key)
                .slice(0, 20);

            if (remoteTs && remoteTs > localTs) {
                console.warn("⚠️ CLOUD: Remote is newer than local. Pulling before push...");
                await this.pull(true);
                const repairStillPending = this.hasDataGuardRepairPending();
                if (!pendingExists && !protectedRepairPending && !repairStillPending) return false;
            }

            await this.mergeRemoteSupplementInventoryIntoLocal?.(remote, "push:before-apply-pending");

            if (this.hasPendingChanges()) {
                this.applyPendingChangesToLocal();
                await this.mergeRemoteSupplementInventoryIntoLocal?.(remote, "push:after-apply-pending");
            }

            const ts = Date.now().toString();
            if (this.lastPushTs === ts) return true;
            this.lastPushTs = ts;

            try {
                window.PegasusMobileDataRegistry?.saveSafetySnapshot?.("cloud-push", { minIntervalMs: 15000 });
            } catch (e) {
                console.warn("⚠️ CLOUD: Mobile safety snapshot skipped.", e);
            }

            const snapshot = this.collectStorageSnapshot({ includeProtected: true });
            const storage = snapshot.general || {};
            const protectedStorage = snapshot.protectedStorage || {};
            const localManagedCount = this.getLocalManagedKeys({ includeProtected: true }).length;
            if (localManagedCount >= 20 && Object.keys(storage).length < 8) {
                this.saveDataGuardSnapshot("push-aborted-thin-local-snapshot", { localManagedCount, storageKeys: Object.keys(storage).length });
                throw new Error("DATA_GUARD_ABORT_THIN_PUSH_PAYLOAD");
            }
            const protectedPayload = Object.keys(protectedStorage).length
                ? await this.encryptCloudPayload({ storage: protectedStorage })
                : null;

            const payload = {
                last_update_ts: ts,
                last_update_date: this.getTodayKey(),
                __pegasus_plain_v3: true,
                approval: {
                    pin_hash: localStorage.getItem(this.storage.localPinHash) || "",
                    master_hash: localStorage.getItem(this.storage.masterHash) || ""
                },
                storage,
                protected: {
                    contacts: protectedPayload
                },
                __deleted_keys__: deletedKeys,
                __data_guard_v1: {
                    storageKeys: Object.keys(storage).length,
                    protectedKeys: Object.keys(protectedStorage).length,
                    generatedAt: ts
                },
                __events__: this.getBoundedEvents()
            };

            const res = await fetch(
                `https://api.jsonbin.io/v3/b/${this.config.binId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Master-Key": this.userKey,
                        "X-Bin-Meta": "false"
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!res.ok) throw new Error("Push failed");

            this.safeSetLocal(this.storage.lastPush, ts);
            this.clearPendingChanges();
            this.clearProtectedRepairPending();
            this.clearDataGuardRepairPending();
            console.log("📤 CLOUD: Secure Sync OK");
            this.traceStep("cloudSync", "push", "SUCCESS");
            return true;
        } catch (e) {
            this.traceError("cloudSync", "push", e);
            console.error("❌ PUSH ERROR:", e);
            finalStatus = navigator.onLine ? "error" : "offline";
            return false;
        } finally {
            this.isPushing = false;
            if (this.isMobileRuntime?.() && finalStatus === "online") {
                this.markMobileSyncComplete?.();
            }
            this.emitSyncStatus(finalStatus, true);
        }
    },

    /* =========================
       🖥️ UI UPDATE
    ========================= */
    triggerUIUpdate() {
        if (typeof window === "undefined") return;

        const now = Date.now();
        if (now - this.lastUiRefreshTs < 250) return;
        this.lastUiRefreshTs = now;

        try {
            window.dispatchEvent(new CustomEvent("pegasus_sync_complete"));
        } catch (e) {
            console.warn("⚠️ SYNC COMPLETE EVENT ERROR:", e);
        }

        this.safeCall(() => {
            if (typeof refreshAllUI === "function") refreshAllUI();
        });

        this.safeCall(() => {
            if (typeof updateFoodUI === "function") updateFoodUI();
        });

        this.safeCall(() => {
            if (typeof renderFood === "function") renderFood();
        });

        this.safeCall(() => {
            if (typeof updateSuppUI === "function") updateSuppUI();
        });

        this.safeCall(() => {
            if (typeof renderLiftingContent === "function") renderLiftingContent();
        });

        this.safeCall(() => {
            if (typeof updateKcalUI === "function") updateKcalUI();
        });

        this.safeCall(() => {
            if (typeof renderCalendar === "function") renderCalendar();
        });

        this.safeCall(() => {
            if (window.MuscleProgressUI?.render) window.MuscleProgressUI.render(true);
        });

        this.safeCall(() => {
            if (window.PegasusDiet?.updateUI) window.PegasusDiet.updateUI();
        });

        this.safeCall(() => {
            if (window.PegasusFinance?.render) window.PegasusFinance.render();
        });

        setTimeout(() => {
            this.safeCall(() => {
                if (typeof updateKcalUI === "function") updateKcalUI();
            });
        }, 120);
    },

    /* =========================
       🔁 AUTO SYNC
    ========================= */
    startAutoSync() {
        if (this.syncInterval) clearInterval(this.syncInterval);

        if (this.isMobileRuntime?.()) {
            this.syncInterval = null;
            this.traceStep("cloudSync", "startAutoSync", "MOBILE_CADENCE_OWNER");
            return;
        }

        this.syncInterval = setInterval(() => {
            if (!this.isUnlocked) return;
            if (this.isPulling || this.isPushing) return;
            if (document.hidden) return;

            if (!navigator.onLine) {
                this.emitSyncStatus("offline", true);
                return;
            }

            this.syncNow(true);
        }, this.config.pullInterval);
    }
};

/* =========================
   STORAGE INTERCEPTORS
========================= */
if (!window.originalSetItem) {
    window.originalSetItem = localStorage.setItem;

    localStorage.setItem = function(key, value) {
        window.originalSetItem.apply(this, arguments);

        const cloud = window.PegasusCloud;
        if (!cloud) return;
        if (cloud.isApplyingRemote) return;
        if (!cloud.isAllowedStorageKey(key)) return;
        if (cloud.isInternalStorageKey(key)) return;
        if (!cloud.isUnlocked && !cloud.canRestoreApprovedDevice?.()) return;

        queueMicrotask(() => {
            if (cloud.shouldBlockBootWeeklyWrite?.(key, value, "set")) {
                try { cloud.tryApprovedDeviceUnlock?.(); } catch (e) {}
                console.warn("🛡️ CLOUD: Blocked boot weekly zero write before initial pull:", key);
                return;
            }
            if (cloud.shouldBlockDesktopBootSupplementWrite?.(key)) {
                cloud.pruneDesktopBootSupplementPending?.("interceptor:setItem");
                try { cloud.tryApprovedDeviceUnlock?.(); } catch (e) {}
                console.warn("🛡️ CLOUD: Blocked desktop boot supplement write before initial pull:", key);
                return;
            }
            cloud.queuePendingChange(key, value, "set");
            if (!cloud.isUnlocked) return;
            cloud.push();
        });
    };
}

if (!window.originalRemoveItem) {
    window.originalRemoveItem = localStorage.removeItem;

    localStorage.removeItem = function(key) {
        const shouldQueue = (
            !!window.PegasusCloud &&
            (window.PegasusCloud.isUnlocked || window.PegasusCloud.canRestoreApprovedDevice?.()) &&
            !window.PegasusCloud.isApplyingRemote &&
            window.PegasusCloud.isAllowedStorageKey(key) &&
            !window.PegasusCloud.isInternalStorageKey(key)
        );

        window.originalRemoveItem.apply(this, arguments);

        if (shouldQueue) {
            queueMicrotask(() => {
                if (window.PegasusCloud.shouldBlockBootWeeklyWrite?.(key, null, "remove")) {
                    try { window.PegasusCloud.tryApprovedDeviceUnlock?.(); } catch (e) {}
                    console.warn("🛡️ CLOUD: Blocked boot weekly remove before initial pull:", key);
                    return;
                }
                if (window.PegasusCloud.shouldBlockDesktopBootSupplementWrite?.(key)) {
                    window.PegasusCloud.pruneDesktopBootSupplementPending?.("interceptor:removeItem");
                    try { window.PegasusCloud.tryApprovedDeviceUnlock?.(); } catch (e) {}
                    console.warn("🛡️ CLOUD: Blocked desktop boot supplement remove before initial pull:", key);
                    return;
                }
                window.PegasusCloud.queuePendingChange(key, null, "remove");
                if (!window.PegasusCloud.isUnlocked) return;
                window.PegasusCloud.push();
            });
        }
    };
}

/* =========================
   CROSS TAB SYNC
========================= */
window.addEventListener("storage", (e) => {
    if (!e.key) return;

    if (PegasusCloud.isAllowedStorageKey(e.key)) {
        PegasusCloud.triggerUIUpdate();
    }
});

/* =========================
   FOCUS / VISIBILITY / NETWORK SYNC
========================= */
window.addEventListener("focus", () => {
    if (window.PegasusCloud?.isMobileRuntime?.()) return;
    if (window.PegasusCloud?.isUnlocked && navigator.onLine) {
        window.PegasusCloud.syncNow(true);
    }
});

document.addEventListener("visibilitychange", () => {
    if (window.PegasusCloud?.isMobileRuntime?.()) return;
    if (!document.hidden && window.PegasusCloud?.isUnlocked && navigator.onLine) {
        window.PegasusCloud.syncNow(true);
    }
});

window.addEventListener("online", () => {
    if (window.PegasusCloud?.isMobileRuntime?.()) return;
    if (window.PegasusCloud?.isUnlocked) {
        window.PegasusCloud.syncNow(true);
    }
});

window.addEventListener("offline", () => {
    PegasusCloud.emitSyncStatus("offline", true);
});

/* =========================
   ENGINE ATTACH ONLY
========================= */
window.addEventListener("load", () => {
    if (window.PegasusEngine && !PegasusCloud.engine) {
        PegasusCloud.attachEngine(window.PegasusEngine);
    }
});

window.PegasusCloud = PegasusCloud;


/* ===== CONSOLIDATED FROM syncHardening.js ===== */
/* ==========================================================================
   PEGASUS SYNC HARDENING
   Adds public-entry guards, deferred sync recovery, and richer sync diagnostics
   without changing the visible UI flow.
   ========================================================================== */

(function () {
    function installSyncHardening() {
        const cloud = window.PegasusCloud;
        if (!cloud || cloud.__syncHardeningInstalled) return;

        const state = {
            phase: cloud.isUnlocked ? "online" : "locked",
            lastCoarseStatus: cloud.lastStatus || (cloud.isUnlocked ? "online" : "locked"),
            lastTransitionAt: Date.now(),
            lastReason: "install",
            lastRequestedAction: null,
            restoreInFlight: false,
            deferredPush: false,
            deferredSync: false,
            blockedRequest: null,
            flushTimer: null,
            recentNotes: [],
            counters: {
                blockedPush: 0,
                blockedSync: 0,
                deferredFlush: 0,
                restoreCalls: 0,
                restoreBlockedPush: 0,
                pullDuringPush: 0,
                pushQueued: 0,
                phaseCorrections: 0,
                deferredRetries: 0
            }
        };

        const originalEmitSyncStatus = cloud.emitSyncStatus.bind(cloud);
        const originalPush = cloud.push.bind(cloud);
        const originalDoPush = cloud._doPush.bind(cloud);
        const originalPull = cloud.pull.bind(cloud);
        const originalSyncNow = cloud.syncNow.bind(cloud);
        const originalRestoreApprovedDevice = cloud.restoreApprovedDevice.bind(cloud);

        function isOnline() {
            return typeof navigator === "undefined" ? true : !!navigator.onLine;
        }

        function hasDeferredWork() {
            return !!(state.deferredPush || state.deferredSync);
        }

        function trace(status, extra) {
            try {
                window.PegasusRuntimeMonitor?.trace?.("syncHardening", "state", status, extra);
            } catch (_) {}
        }

        function capture(action, error, extra) {
            try {
                window.PegasusRuntimeMonitor?.capture?.("syncHardening", action, error, extra);
            } catch (_) {}
        }

        function addNote(type, extra) {
            state.recentNotes.push({
                type,
                at: new Date().toISOString(),
                extra: extra || null
            });
            if (state.recentNotes.length > 25) {
                state.recentNotes = state.recentNotes.slice(-25);
            }
        }

        function currentSnapshot() {
            let pendingChanges = false;
            let protectedRepairPending = false;
            try {
                pendingChanges = !!cloud.hasPendingChanges?.();
                protectedRepairPending = !!cloud.hasProtectedRepairPending?.();
            } catch (_) {}

            return {
                phase: state.phase,
                coarseStatus: state.lastCoarseStatus,
                lastTransitionAt: new Date(state.lastTransitionAt).toISOString(),
                lastReason: state.lastReason,
                lastRequestedAction: state.lastRequestedAction,
                flags: {
                    isUnlocked: !!cloud.isUnlocked,
                    isPulling: !!cloud.isPulling,
                    isPushing: !!cloud.isPushing,
                    isApplyingRemote: !!cloud.isApplyingRemote,
                    restoreInFlight: !!state.restoreInFlight,
                    approvedRestoreCompleted: !!cloud.hasApprovedRestoreCompleted,
                    pendingChanges,
                    protectedRepairPending,
                    online: isOnline()
                },
                deferred: {
                    push: !!state.deferredPush,
                    sync: !!state.deferredSync,
                    blockedRequest: state.blockedRequest ? { ...state.blockedRequest } : null
                },
                counters: { ...state.counters },
                recentNotes: state.recentNotes.slice(-10)
            };
        }

        function dispatchStateEvent(source) {
            try {
                window.dispatchEvent(new CustomEvent("pegasus_sync_state", {
                    detail: {
                        source: source || "syncHardening",
                        snapshot: currentSnapshot()
                    }
                }));
            } catch (_) {}
        }

        function setPhase(phase, reason, extra) {
            if (!phase) return;
            state.phase = phase;
            state.lastReason = reason || state.lastReason || "update";
            state.lastTransitionAt = Date.now();
            trace(phase, { reason: state.lastReason, ...(extra || {}) });
            dispatchStateEvent(reason || "syncHardening");
        }

        function derivePhase() {
            if (state.restoreInFlight) return "restoring";
            if (cloud.isPushing) return "pushing";
            if (cloud.isPulling) return "pulling";
            if (!cloud.isUnlocked) return "locked";
            if (!isOnline()) return "offline";
            if (state.lastCoarseStatus === "error") return "error";
            if (hasDeferredWork()) return "recovering";
            if (state.lastCoarseStatus === "syncing") return "syncing";
            return "online";
        }

        function syncDerivedPhase(reason, extra) {
            const nextPhase = derivePhase();
            if (state.phase !== nextPhase) {
                state.counters.phaseCorrections += 1;
            }
            setPhase(nextPhase, reason, extra);
            return nextPhase;
        }

        function rememberBlockedRequest(action, reason, extra) {
            state.blockedRequest = {
                action,
                reason,
                at: new Date().toISOString(),
                extra: extra || null
            };
        }

        function clearBlockedRequest(noteType) {
            if (!state.blockedRequest) return;
            addNote(noteType || "blocked_request_cleared", {
                action: state.blockedRequest.action,
                reason: state.blockedRequest.reason
            });
            state.blockedRequest = null;
        }

        async function flushDeferred(reason) {
            if (state.flushTimer) {
                clearTimeout(state.flushTimer);
                state.flushTimer = null;
            }

            if (state.restoreInFlight || cloud.isPulling || cloud.isPushing) {
                if (hasDeferredWork()) {
                    state.counters.deferredRetries += 1;
                    scheduleDeferredFlush(`${reason || "flush"}:busy_retry`, 180);
                }
                return false;
            }

            if (!cloud.isUnlocked || !isOnline()) {
                syncDerivedPhase(reason || "flushDeferred:waiting");
                return false;
            }

            const shouldSync = state.deferredSync;
            const shouldPush = !shouldSync && state.deferredPush;
            if (!shouldSync && !shouldPush) {
                clearBlockedRequest("deferred_already_clear");
                syncDerivedPhase(reason || "flushDeferred:idle");
                return false;
            }

            state.deferredSync = false;
            state.deferredPush = false;
            state.counters.deferredFlush += 1;
            addNote("deferred_flush", { reason, action: shouldSync ? "syncNow" : "push" });
            clearBlockedRequest("deferred_flush_started");
            setPhase("recovering", reason || "deferred_flush", { action: shouldSync ? "syncNow" : "push" });

            try {
                if (shouldSync) {
                    return await originalSyncNow(true);
                }
                return await originalPush(true);
            } catch (error) {
                capture("flushDeferred", error, { reason, shouldSync, shouldPush });
                return false;
            } finally {
                syncDerivedPhase("flushDeferred:done");
            }
        }

        function scheduleDeferredFlush(reason, delay = 140) {
            if (state.flushTimer) clearTimeout(state.flushTimer);
            state.flushTimer = setTimeout(() => {
                flushDeferred(reason);
            }, delay);
        }

        cloud.emitSyncStatus = function patchedEmitSyncStatus(status, force = false) {
            const result = originalEmitSyncStatus(status, force);
            state.lastCoarseStatus = status;
            syncDerivedPhase("emitSyncStatus", { status, force: !!force });
            if (hasDeferredWork() && !state.restoreInFlight && !cloud.isPulling && !cloud.isPushing && cloud.isUnlocked && isOnline()) {
                scheduleDeferredFlush("emitSyncStatus:ready");
            }
            return result;
        };

        cloud.restoreApprovedDevice = async function patchedRestoreApprovedDevice(options = {}) {
            state.restoreInFlight = true;
            state.counters.restoreCalls += 1;
            state.lastRequestedAction = "restoreApprovedDevice";
            setPhase("restoring", "restoreApprovedDevice:start", { requireValidWindow: options?.requireValidWindow !== false });

            try {
                const result = await originalRestoreApprovedDevice(options);
                addNote("restore_complete", { result: !!result });
                syncDerivedPhase("restoreApprovedDevice:done", { result: !!result });
                return result;
            } catch (error) {
                capture("restoreApprovedDevice", error, options);
                setPhase("error", "restoreApprovedDevice:error");
                throw error;
            } finally {
                state.restoreInFlight = false;
                if (hasDeferredWork()) {
                    scheduleDeferredFlush("restore_complete");
                } else {
                    syncDerivedPhase("restoreApprovedDevice:finalize");
                }
            }
        };

        cloud.pull = async function patchedPull(silent = false) {
            state.lastRequestedAction = "pull";
            if (cloud.isPushing) {
                state.counters.pullDuringPush += 1;
                addNote("pull_during_push", { silent: !!silent });
            }
            setPhase("pulling", "pull:start", { silent: !!silent, withinPush: !!cloud.isPushing });

            try {
                return await originalPull(silent);
            } catch (error) {
                capture("pull", error, { silent });
                setPhase("error", "pull:error");
                throw error;
            } finally {
                if (hasDeferredWork()) {
                    scheduleDeferredFlush("pull_complete");
                } else {
                    syncDerivedPhase("pull:done", { silent: !!silent });
                }
            }
        };

        cloud.syncNow = async function patchedSyncNow(silent = false) {
            state.lastRequestedAction = "syncNow";
            if (state.restoreInFlight || cloud.isPulling || cloud.isPushing) {
                state.deferredSync = true;
                state.counters.blockedSync += 1;
                rememberBlockedRequest("syncNow", "syncNow:busy", {
                    silent: !!silent,
                    restoreInFlight: !!state.restoreInFlight,
                    isPulling: !!cloud.isPulling,
                    isPushing: !!cloud.isPushing
                });
                addNote("sync_blocked", {
                    silent: !!silent,
                    restoreInFlight: !!state.restoreInFlight,
                    isPulling: !!cloud.isPulling,
                    isPushing: !!cloud.isPushing
                });
                syncDerivedPhase("syncNow:busy", { silent: !!silent, deferredAction: "syncNow" });
                return false;
            }

            clearBlockedRequest("sync_request_started");
            setPhase("syncing", "syncNow:start", { silent: !!silent });
            try {
                return await originalSyncNow(silent);
            } catch (error) {
                capture("syncNow", error, { silent });
                setPhase("error", "syncNow:error");
                throw error;
            } finally {
                if (hasDeferredWork()) {
                    scheduleDeferredFlush("syncNow_complete");
                } else {
                    syncDerivedPhase("syncNow:done", { silent: !!silent });
                }
            }
        };

        cloud.push = function patchedPush(force = false) {
            state.lastRequestedAction = force ? "push(force)" : "push";

            if (state.restoreInFlight) {
                state.deferredPush = true;
                state.counters.blockedPush += 1;
                state.counters.restoreBlockedPush += 1;
                rememberBlockedRequest("push", "push:restore_in_flight", { force: !!force });
                addNote("push_blocked_restore", { force: !!force });
                syncDerivedPhase("push:restore_in_flight", { force: !!force, deferredAction: "push" });
                return false;
            }

            if (cloud.isPulling || cloud.isPushing) {
                state.deferredPush = true;
                state.counters.blockedPush += 1;
                rememberBlockedRequest("push", "push:busy", {
                    force: !!force,
                    isPulling: !!cloud.isPulling,
                    isPushing: !!cloud.isPushing
                });
                addNote("push_blocked_busy", {
                    force: !!force,
                    isPulling: !!cloud.isPulling,
                    isPushing: !!cloud.isPushing
                });
                syncDerivedPhase("push:busy", { force: !!force, deferredAction: "push" });
                return false;
            }

            clearBlockedRequest(force ? "forced_push_started" : "queued_push_started");
            if (!force) {
                state.counters.pushQueued += 1;
                setPhase("syncing", "push:queued", { force: false });
            } else {
                setPhase("pushing", "push:start", { force: true });
            }

            return originalPush(force);
        };

        cloud._doPush = async function patchedDoPush() {
            state.lastRequestedAction = "_doPush";
            if (state.restoreInFlight) {
                state.deferredPush = true;
                state.counters.blockedPush += 1;
                rememberBlockedRequest("push", "_doPush:restore_in_flight", null);
                addNote("doPush_blocked_restore", null);
                syncDerivedPhase("_doPush:restore_in_flight", { deferredAction: "push" });
                return false;
            }

            clearBlockedRequest("doPush_started");
            setPhase("pushing", "_doPush:start", {
                pendingChanges: !!cloud.hasPendingChanges?.(),
                protectedRepairPending: !!cloud.hasProtectedRepairPending?.()
            });

            try {
                return await originalDoPush();
            } catch (error) {
                capture("_doPush", error);
                setPhase("error", "_doPush:error");
                throw error;
            } finally {
                if (hasDeferredWork()) {
                    scheduleDeferredFlush("push_complete");
                } else {
                    syncDerivedPhase("_doPush:done");
                }
            }
        };

        window.PegasusSyncHardening = {
            getState() {
                return currentSnapshot();
            },
            summary() {
                const snapshot = currentSnapshot();
                console.log("🛡️ PEGASUS SYNC HARDENING", snapshot);
                return snapshot;
            },
            getRecentNotes() {
                return state.recentNotes.slice();
            },
            async flushDeferredNow() {
                return await flushDeferred("manual_flush");
            }
        };

        window.addEventListener("online", () => {
            if (hasDeferredWork()) {
                scheduleDeferredFlush("browser_online", 60);
            } else {
                syncDerivedPhase("browser_online");
            }
        });

        window.addEventListener("offline", () => {
            syncDerivedPhase("browser_offline");
        });

        cloud.__syncHardeningInstalled = true;
        cloud.__syncHardeningState = state;
        addNote("installed", { phase: state.phase });
        syncDerivedPhase("install");
        console.log("🛡️ PEGASUS SYNC HARDENING: Active");
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", installSyncHardening, { once: true });
    } else {
        installSyncHardening();
    }
})();


/* ===== CONSOLIDATED FROM syncEdgeHardening.js ===== */
/* ==========================================================================
   PEGASUS SYNC EDGE HARDENING
   Cross-tab lease coordination, silent-trigger dedupe, and reconnect guards
   for safer sync behavior in multi-tab and fresh-session scenarios.
   ========================================================================== */

(function () {
    function installSyncEdgeHardening() {
        const cloud = window.PegasusCloud;
        if (!cloud || cloud.__syncEdgeHardeningInstalled) return;

        const STORAGE_KEY = "pegasus_sync_edge_lease_v1";
        const TAB_ID = `tab_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        const LEASE_TTL_MS = 9000;
        const LEASE_REFRESH_MS = 2000;
        const SILENT_SYNC_DEDUPE_MS = 1400;
        const PUSH_DEDUPE_MS = 500;
        const RETRY_JITTER_MS = 160;

        const state = {
            tabId: TAB_ID,
            installedAt: new Date().toISOString(),
            activeLeaseAction: null,
            leaseRefreshTimer: null,
            deferredSyncTimer: null,
            deferredPushTimer: null,
            lastSilentSyncAt: 0,
            lastPushRequestAt: 0,
            lastLeaseAt: 0,
            recentNotes: [],
            counters: {
                leaseAcquired: 0,
                leaseReleased: 0,
                leaseBlockedSync: 0,
                leaseBlockedPush: 0,
                silentSyncDeduped: 0,
                pushDeduped: 0,
                deferredSyncScheduled: 0,
                deferredPushScheduled: 0,
                onlineResyncQueued: 0,
                foreignLeaseObserved: 0
            }
        };

        const originalSyncNow = cloud.syncNow.bind(cloud);
        const originalDoPush = cloud._doPush.bind(cloud);
        const originalRestoreApprovedDevice = cloud.restoreApprovedDevice.bind(cloud);
        const originalPush = cloud.push.bind(cloud);

        function now() {
            return Date.now();
        }

        function isOnline() {
            return typeof navigator === "undefined" ? true : !!navigator.onLine;
        }

        function addNote(type, extra) {
            state.recentNotes.push({ type, at: new Date().toISOString(), extra: extra || null });
            if (state.recentNotes.length > 30) {
                state.recentNotes = state.recentNotes.slice(-30);
            }
        }

        function trace(action, status, extra) {
            try {
                window.PegasusRuntimeMonitor?.trace?.("syncEdgeHardening", action, status, extra);
            } catch (_) {}
        }

        function capture(action, error, extra) {
            try {
                window.PegasusRuntimeMonitor?.capture?.("syncEdgeHardening", action, error, extra);
            } catch (_) {}
        }

        function safeParseLease(raw) {
            if (!raw) return null;
            try {
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== "object") return null;
                return parsed;
            } catch (_) {
                return null;
            }
        }

        function readLease() {
            return safeParseLease(localStorage.getItem(STORAGE_KEY));
        }

        function isLeaseValid(lease) {
            return !!lease && Number.isFinite(Number(lease.expiresAt)) && Number(lease.expiresAt) > now();
        }

        function isOwnLease(lease) {
            return !!lease && lease.owner === TAB_ID;
        }

        function clearLeaseIfOwned(reason) {
            const lease = readLease();
            if (!isOwnLease(lease)) return false;
            localStorage.removeItem(STORAGE_KEY);
            state.activeLeaseAction = null;
            state.lastLeaseAt = now();
            if (state.leaseRefreshTimer) {
                clearInterval(state.leaseRefreshTimer);
                state.leaseRefreshTimer = null;
            }
            state.counters.leaseReleased += 1;
            addNote("lease_released", { reason, action: lease?.action || null });
            trace("lease", "RELEASED", { reason, action: lease?.action || null });
            return true;
        }

        function writeLease(action) {
            const lease = {
                owner: TAB_ID,
                action,
                createdAt: now(),
                updatedAt: now(),
                expiresAt: now() + LEASE_TTL_MS,
                hidden: !!document.hidden
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lease));
            return lease;
        }

        function acquireLease(action) {
            const existing = readLease();
            if (isLeaseValid(existing) && !isOwnLease(existing)) {
                state.counters.foreignLeaseObserved += 1;
                return { ok: false, lease: existing };
            }

            const written = writeLease(action);
            const confirmed = readLease();
            if (isOwnLease(confirmed)) {
                state.activeLeaseAction = action;
                state.lastLeaseAt = now();
                state.counters.leaseAcquired += 1;
                if (state.leaseRefreshTimer) clearInterval(state.leaseRefreshTimer);
                state.leaseRefreshTimer = setInterval(() => {
                    const latest = readLease();
                    if (!isOwnLease(latest)) {
                        clearInterval(state.leaseRefreshTimer);
                        state.leaseRefreshTimer = null;
                        return;
                    }
                    try {
                        writeLease(state.activeLeaseAction || action);
                    } catch (_) {}
                }, LEASE_REFRESH_MS);
                addNote("lease_acquired", { action });
                trace("lease", "ACQUIRED", { action });
                return { ok: true, lease: confirmed || written };
            }

            return { ok: false, lease: confirmed || written };
        }

        function computeRetryDelay(lease) {
            if (!lease || !Number.isFinite(Number(lease.expiresAt))) return 1200;
            return Math.max(350, Math.min(2400, Number(lease.expiresAt) - now() + RETRY_JITTER_MS));
        }

        function scheduleDeferredSync(reason, delay) {
            if (state.deferredSyncTimer) clearTimeout(state.deferredSyncTimer);
            state.counters.deferredSyncScheduled += 1;
            addNote("deferred_sync_scheduled", { reason, delay });
            state.deferredSyncTimer = setTimeout(() => {
                state.deferredSyncTimer = null;
                if (!cloud.isUnlocked || !isOnline()) return;
                cloud.syncNow(true).catch?.(() => {});
            }, delay);
        }

        function scheduleDeferredPush(reason, delay, force) {
            if (state.deferredPushTimer) clearTimeout(state.deferredPushTimer);
            state.counters.deferredPushScheduled += 1;
            addNote("deferred_push_scheduled", { reason, delay, force: !!force });
            state.deferredPushTimer = setTimeout(() => {
                state.deferredPushTimer = null;
                if (!cloud.isUnlocked || !isOnline()) return;
                cloud.push(!!force);
            }, delay);
        }

        function observeForeignLease(action, lease, kind) {
            const delay = computeRetryDelay(lease);
            addNote("foreign_lease_observed", {
                action,
                kind,
                leaseOwner: lease?.owner || null,
                leaseAction: lease?.action || null,
                retryDelay: delay
            });
            trace(action, "LEASE_BLOCKED", {
                kind,
                leaseOwner: lease?.owner || null,
                leaseAction: lease?.action || null,
                retryDelay: delay
            });
            return delay;
        }

        cloud.restoreApprovedDevice = async function patchedRestoreApprovedDevice(options = {}) {
            const leaseAttempt = acquireLease("restoreApprovedDevice");
            if (!leaseAttempt.ok) {
                const delay = observeForeignLease("restoreApprovedDevice", leaseAttempt.lease, "restore");
                state.counters.leaseBlockedSync += 1;
                scheduleDeferredSync("restore_foreign_lease", delay);
                return false;
            }

            try {
                return await originalRestoreApprovedDevice(options);
            } catch (error) {
                capture("restoreApprovedDevice", error, options);
                throw error;
            } finally {
                clearLeaseIfOwned("restoreApprovedDevice:done");
            }
        };

        cloud.syncNow = async function patchedSyncNow(silent = false) {
            const ts = now();
            if (silent && (ts - state.lastSilentSyncAt) < SILENT_SYNC_DEDUPE_MS && !cloud.hasPendingChanges?.()) {
                state.counters.silentSyncDeduped += 1;
                addNote("silent_sync_deduped", { deltaMs: ts - state.lastSilentSyncAt });
                trace("syncNow", "DEDUPED", { silent: true, deltaMs: ts - state.lastSilentSyncAt });
                return false;
            }
            if (silent) state.lastSilentSyncAt = ts;

            const leaseAttempt = acquireLease("syncNow");
            if (!leaseAttempt.ok) {
                state.counters.leaseBlockedSync += 1;
                const delay = observeForeignLease("syncNow", leaseAttempt.lease, "sync");
                scheduleDeferredSync("sync_foreign_lease", delay);
                return false;
            }

            try {
                return await originalSyncNow(silent);
            } catch (error) {
                capture("syncNow", error, { silent: !!silent });
                throw error;
            } finally {
                clearLeaseIfOwned("syncNow:done");
            }
        };

        cloud.push = function patchedPush(force = false) {
            const ts = now();
            if (!force && (ts - state.lastPushRequestAt) < PUSH_DEDUPE_MS) {
                state.counters.pushDeduped += 1;
                addNote("push_deduped", { deltaMs: ts - state.lastPushRequestAt });
                trace("push", "DEDUPED", { force: false, deltaMs: ts - state.lastPushRequestAt });
                return false;
            }
            state.lastPushRequestAt = ts;

            const activeForeignLease = readLease();
            if (isLeaseValid(activeForeignLease) && !isOwnLease(activeForeignLease)) {
                state.counters.leaseBlockedPush += 1;
                const delay = observeForeignLease("push", activeForeignLease, "push");
                scheduleDeferredPush("push_foreign_lease", delay, force);
                return false;
            }

            return originalPush(force);
        };

        cloud._doPush = async function patchedDoPush() {
            const leaseAttempt = acquireLease("_doPush");
            if (!leaseAttempt.ok) {
                state.counters.leaseBlockedPush += 1;
                const delay = observeForeignLease("_doPush", leaseAttempt.lease, "push");
                scheduleDeferredPush("doPush_foreign_lease", delay, true);
                return false;
            }

            try {
                return await originalDoPush();
            } catch (error) {
                capture("_doPush", error);
                throw error;
            } finally {
                clearLeaseIfOwned("_doPush:done");
            }
        };

        function scheduleOnlineRecovery(reason) {
            if (!cloud.isUnlocked || !isOnline()) return;
            state.counters.onlineResyncQueued += 1;
            addNote("online_recovery_scheduled", { reason });
            setTimeout(() => {
                if (!cloud.isUnlocked || !isOnline()) return;
                cloud.syncNow(true).catch?.(() => {});
            }, 220);
        }

        window.PegasusSyncEdgeHardening = {
            getState() {
                return {
                    tabId: TAB_ID,
                    installedAt: state.installedAt,
                    activeLeaseAction: state.activeLeaseAction,
                    hasDeferredSync: !!state.deferredSyncTimer,
                    hasDeferredPush: !!state.deferredPushTimer,
                    latestLease: readLease(),
                    counters: { ...state.counters },
                    recentNotes: state.recentNotes.slice(-12)
                };
            },
            summary() {
                const snapshot = this.getState();
                console.log("🛡️ PEGASUS SYNC EDGE HARDENING", snapshot);
                return snapshot;
            },
            getRecentNotes() {
                return state.recentNotes.slice();
            },
            releaseLease(reason = "manual_release") {
                return clearLeaseIfOwned(reason);
            }
        };

        window.addEventListener("storage", (e) => {
            if (e.key !== STORAGE_KEY || !e.newValue) return;
            const lease = safeParseLease(e.newValue);
            if (isLeaseValid(lease) && !isOwnLease(lease)) {
                addNote("storage_foreign_lease", { owner: lease.owner, action: lease.action || null });
            }
        });

        window.addEventListener("online", () => {
            scheduleOnlineRecovery("browser_online");
        });

        window.addEventListener("pagehide", () => {
            clearLeaseIfOwned("pagehide");
        });

        window.addEventListener("beforeunload", () => {
            clearLeaseIfOwned("beforeunload");
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden && cloud.isUnlocked && isOnline()) {
                scheduleOnlineRecovery("visibility_recovered");
            }
        });

        setInterval(() => {
            const lease = readLease();
            if (!isOwnLease(lease) && state.leaseRefreshTimer) {
                clearInterval(state.leaseRefreshTimer);
                state.leaseRefreshTimer = null;
                state.activeLeaseAction = null;
            }
            if (isOwnLease(lease) && !cloud.isPulling && !cloud.isPushing && !window.PegasusSyncHardening?.getState?.().flags?.restoreInFlight) {
                clearLeaseIfOwned("watchdog_idle_cleanup");
            }
        }, 4500);

        cloud.__syncEdgeHardeningInstalled = true;
        cloud.__syncEdgeHardeningState = state;
        addNote("installed", { tabId: TAB_ID });
        console.log("🧷 PEGASUS SYNC EDGE HARDENING: Active");
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", installSyncEdgeHardening, { once: true });
    } else {
        installSyncEdgeHardening();
    }
})();


/* ===== CONSOLIDATED FROM syncDiagnostics.js ===== */
/* ==========================================================================
   PEGASUS SYNC DIAGNOSTICS
   Observability layer for sync hardening and edge hardening.
   Adds combined summaries, lightweight history, and clearer classification
   without changing the sync flow or visible UI.
   ========================================================================== */

(function () {
    const MAX_HISTORY = 180;
    const POLL_MS = 1200;

    function nowIso() {
        return new Date().toISOString();
    }

    function getCloud() {
        return window.PegasusCloud || null;
    }

    function getHardening() {
        try {
            return window.PegasusSyncHardening?.getState?.() || null;
        } catch (_) {
            return null;
        }
    }

    function getEdge() {
        try {
            return window.PegasusSyncEdgeHardening?.getState?.() || null;
        } catch (_) {
            return null;
        }
    }

    function safeLastPushStorage(cloud) {
        try {
            const key = cloud?.storage?.lastPush;
            if (!key) return null;
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = parseInt(raw, 10);
            return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
        } catch (_) {
            return null;
        }
    }

    function toIso(value) {
        if (!Number.isFinite(Number(value))) return null;
        try {
            return new Date(Number(value)).toISOString();
        } catch (_) {
            return null;
        }
    }

    function shallowSignature(obj) {
        try {
            return JSON.stringify(obj || null);
        } catch (_) {
            return String(Date.now());
        }
    }

    function classifySummary(snapshot) {
        const phase = String(snapshot?.sync?.phase || "unknown");
        const coarseStatus = String(snapshot?.sync?.coarseStatus || "unknown");
        const flags = snapshot?.sync?.flags || {};
        const deferred = snapshot?.sync?.deferred || {};
        const lease = snapshot?.lease || {};

        if (phase === "error" || coarseStatus === "error") {
            return { level: "error", label: "sync_error", reason: "Sync layer reported error state." };
        }

        if (phase === "offline" || flags.online === false) {
            return { level: "warning", label: "offline_wait", reason: "Browser is offline, sync work is paused." };
        }

        if (phase === "locked" && (deferred.push || deferred.sync)) {
            return { level: "warning", label: "locked_with_queue", reason: "Sync queue exists while vault is locked." };
        }

        if (lease.hasForeignLease && (lease.hasDeferredPush || lease.hasDeferredSync)) {
            return { level: "guard", label: "foreign_lease_deferred", reason: "Another tab owns the lease, work is deferred safely." };
        }

        if (deferred.push || deferred.sync || deferred.blockedRequest) {
            return { level: "guard", label: "local_queue_guard", reason: "A local sync request was safely deferred while busy." };
        }

        if (["restoring", "recovering"].includes(phase)) {
            return { level: "recovery", label: phase, reason: "Sync layer is recovering or restoring session state." };
        }

        if (["pulling", "pushing", "syncing"].includes(phase)) {
            return { level: "info", label: phase, reason: "Sync layer is actively processing normal work." };
        }

        if (phase === "online" && coarseStatus === "online") {
            return { level: "ok", label: "healthy_online", reason: "Sync layer is idle and healthy." };
        }

        return { level: "info", label: phase || "unknown", reason: "Sync state is stable but not specially classified." };
    }

    function buildSnapshot() {
        const cloud = getCloud();
        const hardening = getHardening();
        const edge = getEdge();
        const lease = edge?.latestLease || null;
        const currentTabId = edge?.tabId || null;
        const cloudLastPushTs = toIso(cloud?.lastPushTs);
        const summary = {
            capturedAt: nowIso(),
            currentTabId,
            sync: hardening ? {
                phase: hardening.phase,
                coarseStatus: hardening.coarseStatus,
                lastTransitionAt: hardening.lastTransitionAt,
                lastReason: hardening.lastReason,
                lastRequestedAction: hardening.lastRequestedAction,
                flags: { ...(hardening.flags || {}) },
                deferred: {
                    push: !!hardening?.deferred?.push,
                    sync: !!hardening?.deferred?.sync,
                    blockedRequest: hardening?.deferred?.blockedRequest || null
                },
                counters: { ...(hardening.counters || {}) }
            } : null,
            lease: {
                owner: lease?.owner || null,
                action: lease?.action || null,
                expiresAt: lease?.expiresAt ? toIso(lease.expiresAt) : null,
                hidden: lease?.hidden ?? null,
                currentTabOwnsLease: !!(lease?.owner && currentTabId && lease.owner === currentTabId),
                hasForeignLease: !!(lease?.owner && currentTabId && lease.owner !== currentTabId),
                activeLeaseAction: edge?.activeLeaseAction || null,
                hasDeferredSync: !!edge?.hasDeferredSync,
                hasDeferredPush: !!edge?.hasDeferredPush,
                counters: { ...(edge?.counters || {}) }
            },
            cloud: cloud ? {
                isUnlocked: !!cloud.isUnlocked,
                isPulling: !!cloud.isPulling,
                isPushing: !!cloud.isPushing,
                isApplyingRemote: !!cloud.isApplyingRemote,
                hasApprovedRestoreCompleted: !!cloud.hasApprovedRestoreCompleted,
                hasSuccessfullyPulled: !!cloud.hasSuccessfullyPulled,
                lastStatus: cloud.lastStatus || null,
                lastPushTs: cloudLastPushTs,
                lastPushStorage: safeLastPushStorage(cloud)
            } : null
        };
        summary.classification = classifySummary(summary);
        return summary;
    }

    const state = {
        installedAt: nowIso(),
        history: [],
        lastSummarySignature: null,
        lastEdgeSignature: null,
        lastHistoryId: 0,
        lastHealthyOnlineAt: null,
        lastLeaseOwner: null,
        pollTimer: null
    };

    function trimHistory() {
        if (state.history.length > MAX_HISTORY) {
            state.history = state.history.slice(-MAX_HISTORY);
        }
    }

    function pushHistory(entry) {
        state.lastHistoryId += 1;
        state.history.push({
            id: state.lastHistoryId,
            at: nowIso(),
            ...entry
        });
        trimHistory();
    }

    function trace(status, extra) {
        try {
            window.PegasusRuntimeMonitor?.trace?.("syncDiagnostics", "observe", status, extra);
        } catch (_) {}
    }

    function recordSummaryChange(source, summary, extras) {
        if (!summary) return;
        const signature = shallowSignature({
            phase: summary?.sync?.phase,
            coarseStatus: summary?.sync?.coarseStatus,
            reason: summary?.sync?.lastReason,
            requested: summary?.sync?.lastRequestedAction,
            deferred: summary?.sync?.deferred,
            leaseOwner: summary?.lease?.owner,
            leaseAction: summary?.lease?.action,
            activeLeaseAction: summary?.lease?.activeLeaseAction,
            edgeDeferredSync: summary?.lease?.hasDeferredSync,
            edgeDeferredPush: summary?.lease?.hasDeferredPush,
            unlocked: summary?.cloud?.isUnlocked,
            pulling: summary?.cloud?.isPulling,
            pushing: summary?.cloud?.isPushing,
            lastStatus: summary?.cloud?.lastStatus,
            classification: summary?.classification
        });

        if (signature === state.lastSummarySignature) return;
        state.lastSummarySignature = signature;

        if (summary?.classification?.label === "healthy_online") {
            state.lastHealthyOnlineAt = nowIso();
        }

        pushHistory({
            source: source || "summary",
            kind: "summary_change",
            level: summary?.classification?.level || "info",
            label: summary?.classification?.label || "summary",
            detail: {
                reason: summary?.sync?.lastReason || null,
                requestedAction: summary?.sync?.lastRequestedAction || null,
                phase: summary?.sync?.phase || null,
                coarseStatus: summary?.sync?.coarseStatus || null,
                leaseOwner: summary?.lease?.owner || null,
                leaseAction: summary?.lease?.action || null,
                currentTabOwnsLease: !!summary?.lease?.currentTabOwnsLease,
                deferred: {
                    hardeningPush: !!summary?.sync?.deferred?.push,
                    hardeningSync: !!summary?.sync?.deferred?.sync,
                    edgePush: !!summary?.lease?.hasDeferredPush,
                    edgeSync: !!summary?.lease?.hasDeferredSync
                },
                extra: extras || null
            }
        });
    }

    function recordEdgeNotes(reason) {
        const edge = getEdge();
        if (!edge) return;
        const signature = shallowSignature({
            owner: edge?.latestLease?.owner || null,
            action: edge?.latestLease?.action || null,
            expiresAt: edge?.latestLease?.expiresAt || null,
            activeLeaseAction: edge?.activeLeaseAction || null,
            hasDeferredSync: !!edge?.hasDeferredSync,
            hasDeferredPush: !!edge?.hasDeferredPush,
            counters: edge?.counters || null,
            noteTail: (edge?.recentNotes || []).slice(-3)
        });

        if (signature === state.lastEdgeSignature) return;
        state.lastEdgeSignature = signature;

        const leaseOwner = edge?.latestLease?.owner || null;
        if (leaseOwner !== state.lastLeaseOwner) {
            pushHistory({
                source: "syncEdgeHardening",
                kind: "lease_owner_change",
                level: leaseOwner ? "info" : "recovery",
                label: leaseOwner ? "lease_acquired_somewhere" : "lease_released",
                detail: {
                    reason: reason || "poll",
                    previousOwner: state.lastLeaseOwner,
                    leaseOwner,
                    leaseAction: edge?.latestLease?.action || null,
                    currentTabId: edge?.tabId || null
                }
            });
            state.lastLeaseOwner = leaseOwner;
        }

        const recent = edge?.recentNotes || [];
        const note = recent.length ? recent[recent.length - 1] : null;
        if (note) {
            pushHistory({
                source: "syncEdgeHardening",
                kind: "edge_note",
                level: /foreign_lease|deduped|scheduled/.test(String(note.type || "")) ? "guard" : "info",
                label: note.type || "edge_note",
                detail: {
                    reason: reason || "poll",
                    note
                }
            });
        }
    }

    function recordBrowserEvent(type, detail) {
        pushHistory({
            source: "browser",
            kind: "browser_event",
            level: type === "offline" ? "warning" : "info",
            label: type,
            detail: detail || null
        });
    }

    function buildPublicState() {
        const summary = buildSnapshot();
        return {
            installedAt: state.installedAt,
            lastHealthyOnlineAt: state.lastHealthyOnlineAt,
            summary,
            historySize: state.history.length
        };
    }

    function installSyncDiagnostics() {
        if (window.PegasusSyncDiagnostics) return;

        window.addEventListener("pegasus_sync_state", (event) => {
            const summary = buildSnapshot();
            recordSummaryChange(event?.detail?.source || "syncHardening", summary, {
                eventSource: event?.detail?.source || null
            });
            trace("state_event", {
                phase: summary?.sync?.phase || null,
                classification: summary?.classification?.label || null
            });
        });

        window.addEventListener("online", () => {
            recordBrowserEvent("online", { hidden: !!document.hidden });
            recordSummaryChange("browser_online", buildSnapshot());
        });

        window.addEventListener("offline", () => {
            recordBrowserEvent("offline", { hidden: !!document.hidden });
            recordSummaryChange("browser_offline", buildSnapshot());
        });

        window.addEventListener("pagehide", () => {
            recordBrowserEvent("pagehide", { hidden: !!document.hidden });
        });

        document.addEventListener("visibilitychange", () => {
            recordBrowserEvent("visibilitychange", { hidden: !!document.hidden });
            recordSummaryChange("visibilitychange", buildSnapshot(), { hidden: !!document.hidden });
        });

        window.addEventListener("storage", (e) => {
            if (!e?.key || String(e.key).indexOf("pegasus_sync_lease") === -1) return;
            pushHistory({
                source: "browser",
                kind: "storage_event",
                level: "info",
                label: "lease_storage_event",
                detail: {
                    key: e.key,
                    hasNewValue: !!e.newValue,
                    hasOldValue: !!e.oldValue
                }
            });
            recordEdgeNotes("storage_event");
            recordSummaryChange("storage_event", buildSnapshot());
        });

        state.pollTimer = setInterval(() => {
            recordEdgeNotes("poll");
            recordSummaryChange("poll", buildSnapshot());
        }, POLL_MS);

        window.PegasusSyncDiagnostics = {
            getState() {
                return buildPublicState();
            },
            summary() {
                const snapshot = buildSnapshot();
                console.log("🧭 PEGASUS SYNC DIAGNOSTICS", snapshot);
                return snapshot;
            },
            history(limit = 30) {
                const n = Math.max(1, Math.min(120, Number(limit) || 30));
                return state.history.slice(-n);
            },
            recent(limit = 12) {
                return this.history(limit || 12);
            },
            leaseView() {
                const summary = buildSnapshot();
                return {
                    currentTabId: summary.currentTabId,
                    owner: summary.lease.owner,
                    action: summary.lease.action,
                    expiresAt: summary.lease.expiresAt,
                    currentTabOwnsLease: summary.lease.currentTabOwnsLease,
                    hasForeignLease: summary.lease.hasForeignLease,
                    activeLeaseAction: summary.lease.activeLeaseAction,
                    hasDeferredSync: summary.lease.hasDeferredSync,
                    hasDeferredPush: summary.lease.hasDeferredPush
                };
            },
            classifyCurrent() {
                const summary = buildSnapshot();
                return {
                    classification: summary.classification,
                    phase: summary?.sync?.phase || null,
                    coarseStatus: summary?.sync?.coarseStatus || null,
                    reason: summary?.sync?.lastReason || null
                };
            }
        };

        recordBrowserEvent("diagnostics_installed", { installedAt: state.installedAt });
        recordSummaryChange("install", buildSnapshot());
        recordEdgeNotes("install");
        console.log("🧭 PEGASUS SYNC DIAGNOSTICS: Active");
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", installSyncDiagnostics, { once: true });
    } else {
        installSyncDiagnostics();
    }
})();
