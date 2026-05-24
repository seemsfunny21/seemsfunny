/* ==========================================================================
   PEGASUS REPORTING SYSTEM - V4.5.265 (EMAIL SAFE DISPATCH + MOBILE SUPPORT)
   Protocol: Daily Send Lock, Syntax Validation & Date Padding Alignment
   Status: FINAL STABLE | FIXED: EMAILJS READY WAIT + SAFE BACKUP SIZE
   ========================================================================== */

// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;

const PegasusReporting = {
    storageKey: M?.system?.dailySummary || "pegasus_daily_summary",
    pendingReportKey: M?.system?.pendingReport || "pegasus_pending_report",
    historyKey: M?.workout?.weekly_history || "pegasus_weekly_history",
    lastSentKey: M?.system?.lastEmailSentDate || "pegasus_last_email_sent_date",
    emailServiceId: "service_4znxhn4",
    emailTemplateId: "template_e1cqkme",
    emailPublicKey: "qsfyDrneUHP7zEFui",
    emailStatusKey: "pegasus_last_email_status_v1",
    sendingLockKey: "pegasus_email_sending_lock_v1",
    maxInlineBackupChars: 8000,
    maxAdviceChars: 12000,
    _emailInitDone: false,

    setEmailStatus: function(status, detail = {}) {
        try {
            localStorage.setItem(this.emailStatusKey, JSON.stringify({
                status,
                detail,
                at: new Date().toISOString()
            }));
        } catch (_) {}
    },

    markEmailButton: function(state) {
        const btn = document.getElementById('btnManualEmail');
        if (!btn) return;
        if (state === 'sending') {
            btn.style.background = '#ffb300';
            btn.style.color = '#000';
            btn.textContent = 'Στέλνεται';
        } else if (state === 'success') {
            btn.style.background = '#4CAF50';
            btn.style.color = '#000';
            btn.textContent = 'Επιτυχία';
            setTimeout(() => {
                btn.style.background = '';
                btn.style.color = '';
                btn.textContent = 'EMAIL';
            }, 3000);
        } else if (state === 'error') {
            btn.style.background = '#ff4444';
            btn.style.color = '#fff';
            btn.textContent = 'Σφάλμα';
            setTimeout(() => {
                btn.style.background = '';
                btn.style.color = '';
                btn.textContent = 'EMAIL';
            }, 3500);
        }
    },

    ensureEmailReady: function(timeoutMs = 8000) {
        return new Promise((resolve) => {
            const start = Date.now();
            const tryInit = () => {
                if (typeof window.emailjs !== 'undefined' || typeof emailjs !== 'undefined') {
                    try {
                        const api = window.emailjs || emailjs;
                        if (!this._emailInitDone && api?.init) {
                            api.init(this.emailPublicKey);
                            this._emailInitDone = true;
                        }
                        resolve(true);
                    } catch (e) {
                        console.warn('⚠️ PEGASUS EMAIL: EmailJS init warning.', e);
                        resolve(true);
                    }
                    return;
                }
                if (Date.now() - start >= timeoutMs) {
                    resolve(false);
                    return;
                }
                setTimeout(tryInit, 250);
            };
            tryInit();
        });
    },

    getTodayDateParts: function(dateObj = new Date()) {
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();

        return {
            d,
            m,
            y,
            display: `${d}/${m}/${y}`,
            displayDots: `${d}.${m}.${y}`,
            subjectSafe: `${d}-${m}-${y}`,
            workoutKey: `${y}-${m}-${d}`
        };
    },

    getFoodLogForDate: function(displayDateStr) {
        const logPrefix = M?.nutrition?.log_prefix || "food_log_";
        try {
            const raw = localStorage.getItem(logPrefix + displayDateStr);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    getCardioSummaryForDate: function(displayDateStr) {
        try {
            const directRaw = localStorage.getItem("cardio_log_" + displayDateStr);
            if (directRaw) {
                const parsed = JSON.parse(directRaw);
                if (parsed) return parsed;
            }
        } catch (e) {}

        try {
            const history = JSON.parse(localStorage.getItem("pegasus_cardio_history") || "[]");
            if (Array.isArray(history)) {
                const match = history.find(item => item && item.date === displayDateStr);
                if (match) return match;
            }
        } catch (e) {}

        return null;
    },

    getProteinTargets: function() {
        const goalKey = M?.diet?.goalProtein || 'pegasus_goal_protein';
        const todayKey = M?.diet?.todayProtein || 'pegasus_today_protein';
        const goalProtein = parseFloat(localStorage.getItem(goalKey) || localStorage.getItem(todayKey) || '160') || 160;
        const consumedProtein = parseFloat(localStorage.getItem(M?.diet?.consumedProtein || 'pegasus_today_protein_consumed') || '0') || 0;
        return {
            goalProtein: Math.round(goalProtein),
            consumedProtein: Math.round(consumedProtein)
        };
    },

    saveWorkout: function(kcalVal, memoryData = null) {
        console.log("PEGASUS: Workout save triggered. Queuing for morning...");
        this.prepareAndSaveReport(kcalVal, memoryData);
    },

    prepareAndSaveReport: function(kcal, sessionData = null) {
        let dailyMax = {};

        const sourceData = sessionData || Array.from(document.querySelectorAll('.exercise'))
            .map(node => ({
                name: node.querySelector('.exercise-name')?.textContent?.trim()?.replace(" ☀️", "") || "",
                weight: parseFloat(node.querySelector('.weight-input')?.value) || 0,
                done: parseInt(node.dataset.done || 0, 10),
                group: node.dataset.group
            }))
            .filter(ex => ex.name && ex.done > 0);

        if (sourceData && sourceData.length > 0) {
            sourceData.forEach(ex => {
                if (!dailyMax[ex.name] || ex.weight > dailyMax[ex.name]) dailyMax[ex.name] = ex.weight;
            });
        }

        // PEGASUS 159 FIX:
        // Weekly muscle progress is now written only by the completed-set logger
        // (window.logPegasusSet / PegasusWeeklyProgress counted ledger). Reporting must
        // never mutate pegasus_weekly_history, otherwise every finished workout is counted
        // once during the session and again when the report is prepared.

        let summary = Object.entries(dailyMax).map(([name, weight]) => `• ${name}: ${weight}kg`);
        const today = new Date();
        const dateParts = this.getTodayDateParts(today);

        const targetFood = this.getFoodLogForDate(dateParts.display);
        const cardioData = this.getCardioSummaryForDate(dateParts.display);

        const isRecovery = (today.getDay() === 1 || today.getDay() === 4);

        const recovery = isRecovery
            ? { msg: "Recovery Day Active", nutrition: "Focus on hydration & stretching" }
            : { msg: "Training Day", nutrition: "High protein intake required" };

        const resolvedKcal =
            kcal ||
            localStorage.getItem(M?.diet?.todayKcal || "pegasus_today_kcal") ||
            localStorage.getItem(M?.diet?.session_kcal || "pegasus_session_kcal") ||
            "0.0";

        const totalFoodKcal = targetFood.reduce((sum, f) => sum + parseFloat(f.kcal || 0), 0);
        const totalFoodProtein = targetFood.reduce((sum, f) => sum + parseFloat(f.protein || 0), 0);
        const proteinTargets = this.getProteinTargets();

        const cardioSummary = cardioData
            ? `🚲 ${cardioData.km || 0}km${cardioData.route ? ` (${cardioData.route})` : ""}${cardioData.kcal ? ` | ${cardioData.kcal} kcal` : ""}`
            : "No cardio";

        const pendingData = {
            dateSent: dateParts.display,
            reportDateDisplay: dateParts.display,
            templateParams: {
                name: "ΑΓΓΕΛΟΣ",

                // Use subject-safe numeric date anywhere a subject template may reuse the date field.
                workout_date: dateParts.subjectSafe,
                workout_date_display: dateParts.display,
                report_date_display: dateParts.display,
                report_date_subject: dateParts.subjectSafe,

                // ASCII-safe date/subject params for EmailJS subject
                workout_date_subject: dateParts.subjectSafe,
                subject_date: dateParts.subjectSafe,
                email_subject: `PEGASUS REPORT - ${dateParts.subjectSafe}`,
                subject: `PEGASUS REPORT - ${dateParts.subjectSafe}`,
                subject_line: `PEGASUS REPORT - ${dateParts.subjectSafe}`,
                report_subject: `PEGASUS REPORT - ${dateParts.subjectSafe}`,

                calories: resolvedKcal,
                weights_summary: summary.length > 0 ? summary.join("\n") : "Workout data committed.",
                food_summary: targetFood.length > 0 ? targetFood.map(f => `• ${f.name} (${f.kcal}kcal)`).join("\n") : "No food logged",
                cardio_activity: cardioSummary,
                total_food_kcal: Math.round(totalFoodKcal),
                food_protein_total: Math.round(totalFoodProtein),
                total_food_protein: Math.round(totalFoodProtein),
                protein_total: Math.round(totalFoodProtein),
                total_protein: Math.round(totalFoodProtein),
                consumed_protein: proteinTargets.consumedProtein,
                goal_protein: proteinTargets.goalProtein,
                protein_goal: proteinTargets.goalProtein,
                protein_summary_text: `${Math.round(totalFoodProtein)}g / ${proteinTargets.goalProtein}g`,
                recovery_status: recovery.msg || "Updated",
                nutrition_advice: recovery.nutrition || "Maintain macro balance"
            }
        };

        localStorage.setItem(this.pendingReportKey, JSON.stringify(pendingData));
        console.log("✅ PEGASUS: Data Queued. Will be sent tomorrow morning.");

        if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") {
            window.PegasusCloud.push(true);
        }
    },

    attachMorningBackup: function(pending, context = {}) {
        const safePending = pending && typeof pending === "object" ? pending : {};
        safePending.templateParams = safePending.templateParams && typeof safePending.templateParams === "object"
            ? safePending.templateParams
            : {};

        const params = safePending.templateParams;
        const reportDate = context.reportDate || params.report_date_display || safePending.reportDateDisplay || safePending.dateSent || "unknown";

        try {
            const snapshot = window.PegasusBackup?.buildMorningEmailSnapshot
                ? window.PegasusBackup.buildMorningEmailSnapshot({ reportDate })
                : {
                    schema: "PEGASUS_BACKUP_FALLBACK_V237",
                    createdAt: new Date().toISOString(),
                    reason: "morning-report-email-fallback",
                    localStorage: {}
                };

            if (!window.PegasusBackup?.buildMorningEmailSnapshot) {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (!key) continue;
                    if (/(vault|pin|master|secret|hash|wrapped|api[_-]?key|gemini|openai|token|backup|runtime|error_log|system_logs)/i.test(key)) continue;
                    if (/^(pegasus_|peg_|food_log_|cardio_log_|weight_|kouki_)/.test(key)) {
                        snapshot.localStorage[key] = localStorage.getItem(key);
                    }
                }
                snapshot.meta = { keyCount: Object.keys(snapshot.localStorage).length, mode: "fallback" };
            }

            const packed = window.PegasusBackup?.stringifyForEmail
                ? window.PegasusBackup.stringifyForEmail(snapshot, this.maxInlineBackupChars)
                : { inline: JSON.stringify(snapshot).slice(0, this.maxInlineBackupChars), chars: JSON.stringify(snapshot).length, bytes: JSON.stringify(snapshot).length, truncated: JSON.stringify(snapshot).length > this.maxInlineBackupChars };

            const keyCount = snapshot?.meta?.keyCount || Object.keys(snapshot.localStorage || {}).length;
            const largestKeys = Array.isArray(snapshot?.meta?.largestKeys)
                ? snapshot.meta.largestKeys.slice(0, 8).map(k => `${k.key || '?'}:${k.bytes || 0}b`).join(', ')
                : '';
            const backupHeader = [
                "",
                "==== PEGASUS DAILY BACKUP SUMMARY ====" ,
                `Ημερομηνία report: ${reportDate}`,
                `Schema: ${snapshot.schema || "PEGASUS_BACKUP_V237"}`,
                `Κλειδιά δεδομένων: ${keyCount}`,
                `Μέγεθος JSON: ${packed.bytes} bytes / ${packed.chars} chars`,
                "Email-safe mode: το email κρατά μικρό summary για να μην μπλοκάρεται η αποστολή.",
                largestKeys ? `Μεγαλύτερα keys: ${largestKeys}` : "",
                "Δεν περιλαμβάνονται PIN, master keys, API keys, runtime logs ή παλιά backup."
            ].filter(Boolean).join("\n");

            params.backup_summary = `PEGASUS backup summary: ${keyCount} keys | ${packed.bytes} bytes | email_safe=YES`;
            const compactBackupParam = String(packed.inline || '').slice(0, this.maxInlineBackupChars);
            params.backup_json = compactBackupParam;
            params.pegasus_backup_json = compactBackupParam;
            params.backup_schema = snapshot.schema || "PEGASUS_BACKUP_V237";
            params.backup_key_count = keyCount;
            params.backup_size_bytes = packed.bytes;
            params.backup_truncated = packed.truncated ? "YES" : "NO";

            // PEGASUS 265: do not inject huge JSON into the visible advice field.
            // Large EmailJS params were the most likely reason reports stopped arriving.
            const originalAdvice = String(params.nutrition_advice || "Maintain macro balance");
            const mergedAdvice = originalAdvice.includes("PEGASUS DAILY BACKUP")
                ? originalAdvice
                : originalAdvice + "\n" + backupHeader;
            params.nutrition_advice = mergedAdvice.slice(0, this.maxAdviceChars);

            safePending.backupAttached = true;
            safePending.backupMeta = {
                schema: snapshot.schema || "PEGASUS_BACKUP_V237",
                keyCount,
                bytes: packed.bytes,
                chars: packed.chars,
                truncated: packed.truncated,
                attachedAt: new Date().toISOString()
            };

            console.log(`💾 PEGASUS REPORT: Daily backup attached (${keyCount} keys, ${packed.bytes} bytes).`);
        } catch (e) {
            console.warn("⚠️ PEGASUS REPORT: Backup attachment failed, sending report without backup.", e);
            params.backup_summary = "Backup attachment failed: " + (e?.message || e);
            safePending.backupAttached = false;
        }

        return safePending;
    },

    sendPreparedReport: async function(pending, dateParts, options = {}) {
        const now = Date.now();
        const lockRaw = localStorage.getItem(this.sendingLockKey);
        const lockTs = parseInt(lockRaw || '0', 10) || 0;
        if (!options.forceSend && lockTs && (now - lockTs < 120000)) {
            console.log('🛡️ PEGASUS EMAIL: send already in progress, skipping duplicate.');
            return false;
        }

        localStorage.setItem(this.sendingLockKey, String(now));
        this.markEmailButton('sending');
        this.setEmailStatus('sending', { reportDate: pending?.reportDateDisplay || pending?.dateSent || dateParts?.display });

        try {
            const ready = await this.ensureEmailReady(9000);
            if (!ready) {
                console.warn('❌ PEGASUS EMAIL: EmailJS did not load. Pending report kept for retry.');
                this.setEmailStatus('emailjs_not_loaded', { reportDate: pending?.reportDateDisplay || pending?.dateSent || dateParts?.display });
                this.markEmailButton('error');
                return false;
            }

            const api = window.emailjs || emailjs;
            console.log('⏳ PEGASUS: Transmitting Morning Report via EmailJS...');
            await api.send(this.emailServiceId, this.emailTemplateId, pending.templateParams);

            console.log('✅ PEGASUS: Morning Report Sent Successfully.');
            localStorage.setItem(this.lastSentKey, dateParts.subjectSafe);
            localStorage.removeItem(this.pendingReportKey);
            localStorage.removeItem(this.sendingLockKey);
            this.setEmailStatus('sent', { reportDate: pending?.reportDateDisplay || pending?.dateSent || dateParts?.display });
            this.markEmailButton('success');

            if (window.PegasusCloud?.push) {
                try { window.PegasusCloud.push(true); } catch (_) {}
            }
            return true;
        } catch (err) {
            localStorage.removeItem(this.sendingLockKey);
            const message = err?.text || err?.message || String(err || 'unknown');
            console.error('❌ PEGASUS: Email Error', err);
            this.setEmailStatus('error', { message, reportDate: pending?.reportDateDisplay || pending?.dateSent || dateParts?.display });
            this.markEmailButton('error');
            return false;
        }
    },

    checkAndSendMorningReport: function(forceSend = false) {
        const rawData = localStorage.getItem(this.pendingReportKey);

        if (!rawData) {
            if (forceSend) console.warn("PEGASUS: Δεν υπάρχουν δεδομένα προς αποστολή.");
            return;
        }

        let pending = null;
        try {
            pending = JSON.parse(rawData);
        } catch (e) {
            console.error("PEGASUS: Pending report corrupted.", e);
            return;
        }

        const today = new Date();
        const dateParts = this.getTodayDateParts(today);
        const currentHour = today.getHours();

        // 🔒 Έλεγχος Κλειδαριάς Ημέρας
        const lastSentDate = localStorage.getItem(this.lastSentKey);

        if (!forceSend) {
            // Αν έχουμε ήδη στείλει email σήμερα, ΣΤΑΜΑΤΑ!
            if (lastSentDate === dateParts.subjectSafe) {
                console.log("🛡️ PEGASUS: Morning report already sent today. Dispatch locked.");
                return;
            }

            const isMorningWindow = currentHour >= 5 && currentHour <= 11;
            const isOldReport = pending.dateSent !== dateParts.display;

            if (!isMorningWindow && !isOldReport) {
                console.log("⏳ PEGASUS: Report pending. Waiting for the morning window...");
                return;
            }
        }

        pending = this.attachMorningBackup(pending, { reportDate: pending.reportDateDisplay || pending.dateSent || dateParts.display, forceSend });
        try {
            localStorage.setItem(this.pendingReportKey, JSON.stringify(pending));
        } catch (e) {
            console.warn("⚠️ PEGASUS REPORT: Could not persist backup-enriched pending report.", e);
        }

        this.sendPreparedReport(pending, dateParts, { forceSend });
    }
};

window.PegasusReporting = PegasusReporting;

// ==========================================================================
// 🚀 PEGASUS BOOT SEQUENCE: Αυτόματος Έλεγχος Πρωινής Αναφοράς στο άνοιγμα
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        if (window.PegasusReporting) {
            window.PegasusReporting.checkAndSendMorningReport(false);
        }
    }, 3000);
});


/* ===== CONSOLIDATED FROM reportingDietFinalizePatch.js ===== */
/* ==========================================================================
   PEGASUS REPORTING DIET FINALIZE PATCH - v1.0
   Protocol: Previous-Day Nutrition Refresh For Morning Email
   Status: STABLE | FIXED: Morning report now refreshes yesterday food log/cardio before send
   ========================================================================== */

(function () {
    const M = window.PegasusManifest || window.M || {};

    function parseDisplayDate(displayDateStr) {
        if (!displayDateStr || typeof displayDateStr !== 'string') return null;
        const parts = displayDateStr.split('/');
        if (parts.length !== 3) return null;
        const [dd, mm, yyyy] = parts.map(v => parseInt(v, 10));
        if (!dd || !mm || !yyyy) return null;
        const dt = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function getRecoveryForDate(displayDateStr) {
        const dt = parseDisplayDate(displayDateStr);
        const day = dt ? dt.getDay() : null;
        const isRecovery = day === 1 || day === 4;
        return isRecovery
            ? { msg: 'Recovery Day Active', nutrition: 'Focus on hydration & stretching' }
            : { msg: 'Training Day', nutrition: 'High protein intake required' };
    }

    function getFoodSummaryForDate(displayDateStr) {
        const logPrefix = M?.nutrition?.log_prefix || 'food_log_';
        let items = [];

        try {
            const raw = localStorage.getItem(logPrefix + displayDateStr);
            items = raw ? JSON.parse(raw) : [];
        } catch (e) {
            items = [];
        }

        if (!Array.isArray(items)) items = [];

        const totalFoodKcal = items.reduce((sum, item) => sum + (parseFloat(item?.kcal) || 0), 0);
        const totalFoodProtein = items.reduce((sum, item) => sum + (parseFloat(item?.protein) || 0), 0);

        return {
            items,
            totalFoodKcal,
            totalFoodProtein,
            foodSummary: items.length > 0
                ? items.map(item => `• ${item?.name || 'Food'} (${parseFloat(item?.kcal || 0) || 0}kcal)`).join('\n')
                : 'No food logged'
        };
    }

    function getCardioSummaryForDate(reporting, displayDateStr) {
        const cardioData = typeof reporting.getCardioSummaryForDate === 'function'
            ? reporting.getCardioSummaryForDate(displayDateStr)
            : null;

        return cardioData
            ? `🚲 ${cardioData.km || 0}km${cardioData.route ? ` (${cardioData.route})` : ''}${cardioData.kcal ? ` | ${cardioData.kcal} kcal` : ''}`
            : 'No cardio';
    }

    function enrichPendingReportForReportDate(reporting, pending) {
        if (!pending || !pending.templateParams) return pending;

        const reportDateDisplay = pending.reportDateDisplay || pending.dateSent || pending.templateParams.workout_date_display || pending.templateParams.report_date_display || pending.templateParams.workout_date;
        if (!reportDateDisplay) return pending;

        const reportDateObj = parseDisplayDate(reportDateDisplay);
        const reportDateParts = reporting.getTodayDateParts(reportDateObj || new Date());
        const nutrition = getFoodSummaryForDate(reportDateDisplay);
        const recovery = getRecoveryForDate(reportDateDisplay);
        const cardioSummary = getCardioSummaryForDate(reporting, reportDateDisplay);
        const proteinTargets = reporting.getProteinTargets();

        const enriched = JSON.parse(JSON.stringify(pending));
        enriched.reportDateDisplay = reportDateDisplay;
        enriched.templateParams.workout_date = reportDateParts.subjectSafe;
        enriched.templateParams.workout_date_display = reportDateDisplay;
        enriched.templateParams.report_date_display = reportDateDisplay;
        enriched.templateParams.report_date_subject = reportDateParts.subjectSafe;
        enriched.templateParams.workout_date_subject = reportDateParts.subjectSafe;
        enriched.templateParams.subject_date = reportDateParts.subjectSafe;
        enriched.templateParams.email_subject = `PEGASUS REPORT - ${reportDateParts.subjectSafe}`;
        enriched.templateParams.subject = `PEGASUS REPORT - ${reportDateParts.subjectSafe}`;
        enriched.templateParams.subject_line = `PEGASUS REPORT - ${reportDateParts.subjectSafe}`;
        enriched.templateParams.report_subject = `PEGASUS REPORT - ${reportDateParts.subjectSafe}`;
        enriched.templateParams.food_summary = nutrition.foodSummary;
        enriched.templateParams.total_food_kcal = Math.round(nutrition.totalFoodKcal);
        enriched.templateParams.food_protein_total = Math.round(nutrition.totalFoodProtein);
        enriched.templateParams.total_food_protein = Math.round(nutrition.totalFoodProtein);
        enriched.templateParams.protein_total = Math.round(nutrition.totalFoodProtein);
        enriched.templateParams.total_protein = Math.round(nutrition.totalFoodProtein);
        enriched.templateParams.consumed_protein = proteinTargets.consumedProtein;
        enriched.templateParams.goal_protein = proteinTargets.goalProtein;
        enriched.templateParams.protein_goal = proteinTargets.goalProtein;
        enriched.templateParams.protein_summary_text = `${Math.round(nutrition.totalFoodProtein)}g / ${proteinTargets.goalProtein}g`;
        enriched.templateParams.cardio_activity = cardioSummary;
        enriched.templateParams.recovery_status = recovery.msg || 'Updated';
        enriched.templateParams.nutrition_advice = recovery.nutrition || 'Maintain macro balance';
        enriched.templateParams.report_refresh_mode = 'previous-day-finalized';
        enriched.nutritionRefreshedAt = new Date().toISOString();

        return enriched;
    }

    function installPatch() {
        if (!window.PegasusReporting || window.PegasusReporting.__dietFinalizePatchInstalled) return;

        const reporting = window.PegasusReporting;
        const originalPrepare = typeof reporting.prepareAndSaveReport === 'function'
            ? reporting.prepareAndSaveReport.bind(reporting)
            : null;
        const originalCheck = typeof reporting.checkAndSendMorningReport === 'function'
            ? reporting.checkAndSendMorningReport.bind(reporting)
            : null;

        reporting.enrichPendingReportForReportDate = function (pending) {
            return enrichPendingReportForReportDate(this, pending);
        };

        reporting.refreshPendingNutritionNow = function () {
            try {
                const raw = localStorage.getItem(this.pendingReportKey);
                if (!raw) return null;
                const pending = JSON.parse(raw);
                const refreshed = this.enrichPendingReportForReportDate(pending);
                localStorage.setItem(this.pendingReportKey, JSON.stringify(refreshed));
                return refreshed;
            } catch (e) {
                console.warn('PEGASUS REPORT DIET PATCH: Refresh pending nutrition failed.', e);
                return null;
            }
        };

        if (originalPrepare) {
            reporting.prepareAndSaveReport = function (kcal, sessionData = null) {
                const result = originalPrepare(kcal, sessionData);
                try {
                    const raw = localStorage.getItem(this.pendingReportKey);
                    if (raw) {
                        const pending = JSON.parse(raw);
                        pending.reportDateDisplay = pending.reportDateDisplay || pending.dateSent || pending?.templateParams?.workout_date;
                        pending.pendingNutritionMode = 'refresh-on-send';
                        localStorage.setItem(this.pendingReportKey, JSON.stringify(pending));
                    }
                } catch (e) {
                    console.warn('PEGASUS REPORT DIET PATCH: Could not mark pending report for nutrition refresh.', e);
                }
                return result;
            };
        }

        if (originalCheck) {
            reporting.checkAndSendMorningReport = function (forceSend = false) {
                try {
                    this.refreshPendingNutritionNow();
                } catch (e) {
                    console.warn('PEGASUS REPORT DIET PATCH: Pre-send nutrition refresh skipped.', e);
                }
                return originalCheck(forceSend);
            };
        }

        reporting.__dietFinalizePatchInstalled = true;
        console.log('🍽️ PEGASUS REPORT DIET PATCH: Previous-day nutrition finalizer active.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installPatch, { once: true });
    } else {
        installPatch();
    }
})();
