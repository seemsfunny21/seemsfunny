/* ==========================================================================
   PEGASUS OS - MASTER MANIFEST & REGISTRY (v19.02 LOCAL-ONLY)
   Protocol: Global Variable Re-declaration (Unlock M)
   Status: THE SINGLE SOURCE OF TRUTH | HARDENED: KEY CONSISTENCY + AUDIT SAFETY
   ========================================================================== */

window.PegasusManifest = {
    // ---------------------------------------------------------
    // 1. FORENSIC METADATA
    // ---------------------------------------------------------
    metadata: {
        os: "Pegasus OS",
        author: "Angelos & Gemini",
        last_update: "2026-05-09",
        logic_protocol: "Zero-Bug Simulation & Global Scope Shielding",
        engine_version: "v19.02 Local-only activity calendar"
    },

    // ---------------------------------------------------------
    // 2. EXECUTABLE DATA KEYS (Το Λεξικό της Μνήμης)
    // ---------------------------------------------------------
    system: {
        logs: "pegasus_system_logs",
        mute: "pegasus_mute_state",
        turbo: "pegasus_turbo_state",
        lastReset: "pegasus_last_reset",
        lastResetTimestamp: "pegasus_last_reset_timestamp",
        vaultPin: "pegasus_vault_pin",
        vaultData: "pegasus_vault_data",
        vaultTime: "pegasus_vault_time",
        geminiKey: "pegasus_gemini_key",
        errorLog: "pegasus_error_log",
        cmdTrace: "pegasus_command_trace",
        stats: "pegasus_stats",
        lastPush: "pegasus_last_push",
        lastReport: "pegasus_last_auto_report",
        lastEmailSent: "pegasus_last_email_sent_date",
        weatherCode: "pegasus_weather_code"
    },

    user: {
        weight: "pegasus_weight",
        weightHistory: "pegasus_weight_history",
        legacyWeight: "weight_ΑΓΓΕΛΟΣ",
        age: "pegasus_age",
        height: "pegasus_height",
        gender: "pegasus_gender",
        specs: "pegasus_user_specs",
        notes: "pegasus_notes",
        contacts: "pegasus_contacts",
        partners: "pegasus_partners_list"
    },

    workout: {
        weekly_history: "pegasus_weekly_history",
        done: "pegasus_workouts_done",
        cycling_done: "pegasus_cycling_done",
        total: "pegasus_total_workouts",

        // legacy compatibility key base
        cardio_offset: "pegasus_cardio_offset_sets",

        // canonical per-day cardio key prefix
        cardio_daily_prefix: "pegasus_cardio_kcal_",

        cardio_history: "pegasus_cardio_history",
        activePlan: "pegasus_active_plan",
        muscleTargets: "pegasus_muscle_targets",
        calendarHistory: "pegasus_calendar_history",
        exerciseWeights: "pegasus_exercise_weights",
        ex_time: "pegasus_ex_time",
        rest_time: "pegasus_rest_time",
        weekendCarryover: "pegasus_weekend_carryover_v1"
    },

    nutrition: {
        log_prefix: "food_log_"
    },

    diet: {
        weekly_kcal: "pegasus_weekly_kcal",
        weeklyKcal: "pegasus_weekly_kcal",      // alias compatibility

        session_kcal: "pegasus_session_kcal",
        sessionKcal: "pegasus_session_kcal",    // alias compatibility

        inventory: "pegasus_supp_inventory",
        foodLibrary: "pegasus_food_library",
        todayKcal: "pegasus_today_kcal",
        todayProtein: "pegasus_today_protein",
        bodyGoalMode: "pegasus_body_goal_mode"
    },

    kouki: {
        agreement: "kouki_agreement_log",
        totalMeals: "kouki_meals_total",
        remaining: "kouki_meals_remaining",
        totalStock: "kouki_total_stock"
    },

    car: {
        identity: "pegasus_car_identity",
        dates: "pegasus_car_dates",
        service: "pegasus_car_service",
        legacySpecs: "pegasus_car_specs",
        legacyService: "peg_car_service",
        legacyDates: "peg_car_dates"
    },

    parking: {
        loc: "pegasus_parking_loc",
        history: "pegasus_parking_history"
    },

    // ---------------------------------------------------------
    // 3. SYSTEM ARCHITECTURE
    // ---------------------------------------------------------
    architecture: {
        "manifest.js": "Κεντρικός ορισμός LocalStorage keys & System Blueprint.",
        "app.js": "Master Orchestrator / Event Bus (UI & Workout Timer).",
        "food.js": "Nutrition Logic & Συμφωνία 30 Γευμάτων (Κούκι).",
        "protcrea.js": "Inventory Guard (Πρωτεΐνη 2500g / Κρεατίνη 1000g).",
        "weightTracker.js": "Biometric Trend Analyzer (Moving Average).",
        "dietAdvisor.js": "Nutritional Intelligence Engine (Gap Analysis).",
        "optimizer.js": "AI Training Volumizer (Dynamic Set Adjustment).",
        "pegasusBrain.js": "Dynamic Weekly Planner, carry-over and recovery guard.",
        "cardio.js": "Cardio Engine (+18 σετ πόδια & Kcal target modifier).",
        "auditUI.js": "Real-time System Integrity Monitor & Diagnostic Tool.",
        "debug.js": "Tracer, health checks, calorie audit and runtime diagnostics.",
        "car.js": "Vehicle Management Module.",
        "parking.js": "Manual Parking Notes & Recent Locations Module.",
        "mobile/mobile.html": "Mobile shell and local-only data management hub.",
        "dragDrop.js": "UI Window Positioning Memory.",
        "ems.js": "Electro-Muscle Stimulation Tracker.",
        "partner.js": "Smart Co-Lifter Logic & Dual Weight Memory.",
        "reporting.js": "EmailJS Automated Morning Dispatcher."
    },

    // ---------------------------------------------------------
    // 4. CONSOLE FORENSIC TOOLS
    // ---------------------------------------------------------
    inspect: function() {
        console.log("%c 🏛️ PEGASUS OS FULL SYSTEM INSPECTION", "color: #00ff41; font-size: 20px; font-weight: bold;");
        console.table(this.metadata);
        console.log("%c 📂 ARCHITECTURE:", "color: #f39c12; font-weight: bold;");
        console.table(this.architecture);
    },

    whereIs: function(query) {
        const q = String(query || "").toLowerCase();

        for (let file in this.architecture) {
            if (this.architecture[file].toLowerCase().includes(q)) {
                return `📍 Η λογική '${query}' βρίσκεται στο: ${file}`;
            }
        }

        return "❌ Δεν βρέθηκε αναφορά στο System Blueprint.";
    },

    auditData: function() {
        console.log("%c🔍 PEGASUS DATA AUDIT STARTING...", "color: #00bcd4; font-weight: bold; font-size: 14px;");

        const manifestStr = JSON.stringify(this);
        const legacyCardioPrefix = (this.workout?.cardio_offset || "pegasus_cardio_offset_sets") + "_";
        const canonicalCardioPrefix = this.workout?.cardio_daily_prefix || "pegasus_cardio_kcal_";

        let orphanKeys = [];
        let validKeys = [];

        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (!key) continue;

            if (
                key.startsWith("food_log_") ||
                key.startsWith("weight_") ||
                key.startsWith("pegasus_weight_") ||
                key.startsWith(canonicalCardioPrefix) ||
                key.startsWith(legacyCardioPrefix) ||
                key.startsWith("pegasus_pos_") ||
                key.startsWith("pegasus_weekend_training_mode_") ||
                key.startsWith("pegasus_routine_injected_") ||
                key.startsWith("pegasus_history_") ||
                key.startsWith("pegasus_day_status_") ||
                key.startsWith("cardio_log_")
            ) {
                validKeys.push(key);
                continue;
            }

            if (manifestStr.includes(`"${key}"`)) {
                validKeys.push(key);
            } else {
                orphanKeys.push(key);
            }
        }

        console.log(`✅ Καταγεγραμμένα & Έγκυρα Κλειδιά: ${validKeys.length}`);

        if (orphanKeys.length > 0) {
            console.warn(`⚠️ Προσοχή: Βρέθηκαν ${orphanKeys.length} Ορφανά Κλειδιά!`);
            console.table(orphanKeys.map(k => ({ "Ορφανό Κλειδί": k })));
        } else {
            console.log("%c🛡️ Σύστημα καθαρό.", "color: #4CAF50; font-weight: bold;");
        }
    }
};

// 🛡️ ΤΟ ΚΛΕΙΔΙ ΤΟΥ UNLOCK
var M = window.PegasusManifest;

console.log("🏛️ PEGASUS MANIFEST v19.02 LOADED. ACTIVITY COLORS READY.");


/* PEGASUS 303 - Canonical Monday 00:00 Europe/Athens weekly clock.
   The same key is used by desktop, mobile modules and the dormant cloud bridge. */
window.PegasusWeekClock = Object.freeze({
    dateKey(date = new Date()) {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit"
        }).formatToParts(date);
        const pick = type => parts.find(part => part.type === type)?.value;
        return `${pick("year")}-${pick("month")}-${pick("day")}`;
    },
    weekKey(date = new Date()) {
        const dateKey = this.dateKey(date);
        const [year, month, day] = dateKey.split("-").map(Number);
        const midnightUTC = new Date(Date.UTC(year, month - 1, day));
        const daysSinceMonday = (midnightUTC.getUTCDay() + 6) % 7;
        midnightUTC.setUTCDate(midnightUTC.getUTCDate() - daysSinceMonday);
        return `${midnightUTC.getUTCFullYear()}-${String(midnightUTC.getUTCMonth() + 1).padStart(2, "0")}-${String(midnightUTC.getUTCDate()).padStart(2, "0")}`;
    }
});


/* Shared weekly progress rollover. Loaded on both desktop and mobile. */
window.enforcePegasusMondayWeeklyReset = function(options = {}) {
    const source = options.source || 'unknown';
    const currentWeekKey = window.PegasusWeekClock.weekKey();
    const todayDateStr = window.PegasusWeekClock.dateKey();
    const historyKey = window.PegasusManifest?.workout?.weekly_history || 'pegasus_weekly_history';
    const ledgerKey = 'pegasus_weekly_history_counted_v2';
    const weekKeyName = 'pegasus_weekly_history_week_key';
    const appliedKey = 'pegasus_monday_reset_applied_week_key';
    const appliedAtKey = 'pegasus_monday_reset_applied_at';
    const archiveKey = 'pegasus_weekly_history_archive_v1';
    const freshHistory = { "Στήθος": 0, "Πλάτη": 0, "Πόδια": 0, "Χέρια": 0, "Ώμοι": 0, "Κορμός": 0 };
    const safeRead = (key, fallback) => {
        try {
            const data = JSON.parse(localStorage.getItem(key) || 'null');
            return data && typeof data === 'object' ? data : fallback;
        } catch (_) { return fallback; }
    };
    const storedWeek = String(localStorage.getItem(weekKeyName) || '').trim();
    const appliedWeek = String(localStorage.getItem(appliedKey) || '').trim();
    const ledger = safeRead(ledgerKey, null);

    // A device that stayed shut on Monday still rolls over the first time it opens.
    // Repeated checks during the week must never clear today's real workouts.
    if (appliedWeek === currentWeekKey && storedWeek === currentWeekKey) return false;

    // On upgrade, a current-week ledger may already contain legitimate exercises.
    // Never discard them just because the reset marker was introduced in v303.
    const currentLedger = ledger?.weekKey === currentWeekKey
        && ledger.exercises && typeof ledger.exercises === 'object';
    const hasCurrentSets = currentLedger && Object.values(ledger.exercises)
        .some(value => Math.max(0, Number(value) || 0) > 0);
    const previous = safeRead(historyKey, freshHistory);
    const oldTotal = Object.values(freshHistory).reduce((sum, _v, index) =>
        sum + Math.max(0, Number(previous?.[Object.keys(freshHistory)[index]]) || 0), 0);
    const previousWeek = storedWeek || (ledger?.weekKey && ledger.weekKey !== currentWeekKey ? ledger.weekKey : 'legacy-unknown');

    if (storedWeek !== currentWeekKey) {
        // Retain a snapshot, plus the normal calendar/workout/statistics records.
        if (oldTotal > 0) {
            const archive = safeRead(archiveKey, {});
            if (!archive[previousWeek]) {
                archive[previousWeek] = { history: previous, archivedAt: Date.now(), reason: 'monday-week-rollover' };
                localStorage.setItem(archiveKey, JSON.stringify(archive));
            }
        }
        // If current-week exercises exist, reconstruct from the current-week ledger.
        // Otherwise start at zero; old Saturday-based entries must not come back.
        const keepCurrent = hasCurrentSets && window.PegasusWeeklyProgress?.computeFromLedger;
        const nextHistory = keepCurrent
            ? window.PegasusWeeklyProgress.computeFromLedger(ledger)
            : freshHistory;
        localStorage.setItem(historyKey, JSON.stringify(nextHistory));
        if (!currentLedger) {
            localStorage.setItem(ledgerKey, JSON.stringify({
                weekKey: currentWeekKey, exercises: {}, initializedAt: Date.now(), updatedAt: Date.now()
            }));
        }
        localStorage.setItem('pegasus_weekly_kcal', '0.0');
    }

    localStorage.setItem(weekKeyName, currentWeekKey);
    localStorage.setItem(appliedKey, currentWeekKey);
    localStorage.setItem(appliedAtKey, String(Date.now()));
    localStorage.setItem('pegasus_last_reset', todayDateStr);
    localStorage.setItem('pegasus_last_reset_timestamp', todayDateStr);

    window.dispatchEvent(new CustomEvent('pegasus_weekly_history_updated', {
        detail: { source: `monday-reset:${source}`, weekKey: currentWeekKey }
    }));
    if (window.MuscleProgressUI?.render) setTimeout(() => window.MuscleProgressUI.render(true), 50);
    if (typeof window.renderPreview === 'function') setTimeout(() => window.renderPreview(), 80);
    if (options.push !== false && window.PegasusCloud?.push) setTimeout(() => window.PegasusCloud.push(true), 150);
    console.log('🛡️ PEGASUS: Monday 00:00 Greece weekly progress applied.', { source, currentWeekKey, previousWeek: storedWeek });
    return true;
};

// Compatibility for older callers; no Saturday reset is performed.
window.enforcePegasusSaturdayWeeklyReset = window.enforcePegasusMondayWeeklyReset;
