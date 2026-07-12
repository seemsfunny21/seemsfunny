/* ==========================================================================
   PEGASUS COMMAND TRACER & HEALTH - v5.4 (DOUBLE-CARDIO FIX)
   Protocol: Scope Isolation, Global Var Protection & Dynamic Metabolic Audit
   Status: FINAL STABLE | FIXED: EFFECTIVE TARGET DOUBLE COUNT
   ========================================================================== */

// 🛡️ Χρήση var για να μην "σκάει" αν δηλωθεί σε πολλά αρχεία
var M = M || window.PegasusManifest;

window.PegasusTracer = {
    logs: JSON.parse(localStorage.getItem("pegasus_command_trace") || "[]"),

    log: function(btnId, step, status, details = "") {
        const entry = {
            timestamp: new Date().toLocaleTimeString('el-GR'),
            button: btnId,
            step: step,
            status: status,
            details: details
        };

        this.logs.push(entry);
        if (this.logs.length > 100) this.logs.shift();

        localStorage.setItem("pegasus_command_trace", JSON.stringify(this.logs));

        const color = status === "ERROR" ? "#FF5252" : (status === "SUCCESS" ? "#4CAF50" : "#FFC107");
        console.log(`%c[TRACER] ${btnId} > ${step} > ${status}`, `color: ${color}; font-weight: bold;`, details);
    },

    printLastTrace: function() {
        console.table(this.logs.slice(-10));
    },

    clear: function() {
        this.logs = [];
        localStorage.removeItem("pegasus_command_trace");
        console.log("🛡️ PEGASUS: Trace Log Cleared.");
    }
};

/* ==========================================================================
   PEGASUS HEALTH & LOGGER SYSTEM
   ========================================================================== */
window.PegasusLogger = {
    CONFIG: {
        MAX_ENTRIES: 50,
        getKey: function() {
            return window.PegasusManifest?.system?.errorLog || "pegasus_error_log";
        }
    },

    log: function(message, type = "ERROR") {
        const key = this.CONFIG.getKey();
        try {
            let logs = JSON.parse(localStorage.getItem(key) || "[]");
            const entry = {
                timestamp: new Date().toLocaleString('el-GR'),
                type: type,
                msg: message,
                device: (window.innerWidth <= 800) ? "Mobile" : "Desktop"
            };

            logs.unshift(entry);
            if (logs.length > this.CONFIG.MAX_ENTRIES) logs.pop();

            localStorage.setItem(key, JSON.stringify(logs));
            console.log(`%c[PEGASUS ${type}]: ${message}`, "color: #ff4444; font-weight: bold;");
        } catch (e) {
            console.error("Logger Internal Failure:", e);
        }
    },

    getLogs: function() {
        return JSON.parse(localStorage.getItem(this.CONFIG.getKey()) || "[]");
    }
};

/* ==========================================================================
   DYNAMIC METABOLIC HELPERS
   ========================================================================== */
window.PegasusDebugHelpers = {
    getTodayDateStr: function() {
        if (typeof window.getPegasusTodayDateStr === "function") {
            return window.getPegasusTodayDateStr();
        }

        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    },

    getTodayCardioOffset: function() {
        if (typeof window.getPegasusTodayCardioOffset === "function") {
            const val = parseFloat(window.getPegasusTodayCardioOffset());
            return isNaN(val) ? 0 : val;
        }

        const dateStr = this.getTodayDateStr();

        const unified = parseFloat(localStorage.getItem("pegasus_cardio_kcal_" + dateStr));
        if (!isNaN(unified)) return unified;

        const legacy = parseFloat(localStorage.getItem((window.PegasusManifest?.workout?.cardio_offset || "pegasus_cardio_offset_sets") + "_" + dateStr));
        if (!isNaN(legacy)) return legacy;

        return 0;
    },

    getBaseTarget: function() {
        if (typeof window.getPegasusBaseDailyTarget === "function") {
            const val = parseFloat(window.getPegasusBaseDailyTarget());
            return isNaN(val) ? 2800 : val;
        }

        const dayName = (typeof window.getPegasusActiveDayName === "function")
            ? window.getPegasusActiveDayName()
            : ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"][new Date().getDay()];

        const settings = (typeof window.getPegasusSettings === "function")
            ? window.getPegasusSettings()
            : { activeSplit: "IRON" };

        const activePlan = settings?.activeSplit || "IRON";

        const KCAL_REST = 2100;
        const KCAL_WEIGHTS = 2800;
        const KCAL_EMS = 2700;
        const KCAL_BIKE = 3100;

        if (dayName === "Δευτέρα" || dayName === "Πέμπτη") return KCAL_REST;

        switch (activePlan) {
            case "EMS_ONLY":
                return dayName === "Τετάρτη" ? KCAL_EMS : KCAL_WEIGHTS;
            case "BIKE_ONLY":
                return (dayName === "Σάββατο" || dayName === "Κυριακή") ? KCAL_BIKE : KCAL_WEIGHTS;
            case "HYBRID":
                if (dayName === "Τετάρτη") return KCAL_EMS;
                if (dayName === "Σάββατο" || dayName === "Κυριακή") return KCAL_BIKE;
                return KCAL_WEIGHTS;
            case "UPPER_LOWER":
            case "IRON":
            default:
                return KCAL_WEIGHTS;
        }
    },

    getEffectiveTarget: function() {
        if (typeof window.getPegasusEffectiveDailyTarget === "function") {
            const target = parseFloat(window.getPegasusEffectiveDailyTarget());
            return Math.round(isNaN(target) ? 2800 : target);
        }

        const base = this.getBaseTarget();
        const cardio = this.getTodayCardioOffset();
        return (typeof window.getPegasusFinalDailyTargetFromBurn === 'function')
            ? window.getPegasusFinalDailyTargetFromBurn(base, cardio)
            : Math.round(base + cardio);
    },

    getEngineState: function() {
        try {
            return window.PegasusEngine?.getState?.() || null;
        } catch (e) {
            return null;
        }
    },

    isEngineReady: function() {
        return !!(window.PegasusEngine && window.PegasusEngine.__isCoreEngine);
    },

    getWorkoutRunning: function() {
        const state = this.getEngineState();
        if (!state) return false;

        if (typeof state.workout?.running === "boolean") return state.workout.running;
        if (typeof state.running === "boolean") return state.running;

        return false;
    },

    getSessionKcal: function() {
        const state = this.getEngineState();
        if (!state) return 0;

        if (typeof state.workout?.sessionKcal === "number") return state.workout.sessionKcal;
        if (typeof state.sessionActiveKcal === "number") return state.sessionActiveKcal;

        return 0;
    },

    getEventBufferSize: function() {
        try {
            const events = window.PegasusEngine?.getEventBuffer?.() || [];
            return Array.isArray(events) ? events.length : 0;
        } catch (e) {
            return 0;
        }
    },

    replayPreview: function(limit = 20) {
        try {
            if (!window.PegasusEngine?.replay) return null;
            return window.PegasusEngine.replay(limit);
        } catch (e) {
            console.error("PEGASUS DEBUG: Replay preview failed.", e);
            return null;
        }
    }
};

/**
 * 2. CALORIE LOGIC VALIDATION
 * BMR = (10 × weight) + (6.25 × height) - (5 × age) + 5
 */
window.verifyCalorieLogic = () => {
    const baseline = { age: 38, height: 187, weight: 74 };
    const weightKey = window.PegasusManifest?.user?.weight || "pegasus_weight";
    const currentWeight = parseFloat(localStorage.getItem(weightKey)) || 0;

    const activeWeight = currentWeight > 0 ? currentWeight : baseline.weight;
    const bmr = (10 * activeWeight) + (6.25 * baseline.height) - (5 * baseline.age) + 5;
    const tdee = Math.round(bmr * 1.55);

    const baseTarget = window.PegasusDebugHelpers.getBaseTarget();
    const cardioOffset = window.PegasusDebugHelpers.getTodayCardioOffset();
    const target = window.PegasusDebugHelpers.getEffectiveTarget();

    console.log(`%c--- CALORIE AUDIT (DYNAMIC) ---`, 'color: #ff9800; font-weight: bold;');
    console.table({
        "0": { Parameter: "Active Weight", Value: `${activeWeight} kg`, Status: "OK" },
        "1": { Parameter: "BMR (Current)", Value: `${bmr.toFixed(0)} kcal`, Status: "NOMINAL" },
        "2": { Parameter: "TDEE (1.55x)", Value: `${tdee} kcal`, Status: "NOMINAL" },
        "3": { Parameter: "Base Strategy", Value: `${baseTarget} kcal`, Status: "PLAN-DRIVEN" },
        "4": { Parameter: "Cardio Offset", Value: `${cardioOffset} kcal`, Status: cardioOffset > 0 ? "ADDED" : "NONE" },
        "5": { Parameter: "Effective Target", Value: `${target} kcal`, Status: "DYNAMIC" }
    });

    if (currentWeight > 150 || (currentWeight < 40 && currentWeight !== 0)) {
        window.PegasusLogger.log(`Extreme weight detected (${currentWeight}kg).`, "WARNING");
        return false;
    }

    return true;
};

/**
 * 3. CORE HEALTH CHECK
 */
window.pegasusHealthCheck = async function() {
    console.log("%c--- PEGASUS HEALTH CHECK v5.4 ---", "color: #4CAF50; font-weight: bold;");
    let errors = [];
    let warnings = [];

    const isMobile = window.location.pathname.includes("mobile.html") || window.innerWidth <= 800;

    if (typeof window.program === 'undefined') errors.push("Critical: data.js not loaded.");
    if (!window.PegasusManifest) errors.push("Critical: manifest.js missing.");
    if (!window.PegasusDebugHelpers.isEngineReady()) errors.push("Critical: pegasusCore.js not loaded.");

    const lastPush = localStorage.getItem("pegasus_last_push");
    

    const essential = isMobile
        ? ["sync-indicator"]
        : ["btnStart", "exList", "totalProgress", "muscleProgressContainer"];

    essential.forEach(id => {
        if (!document.getElementById(id)) errors.push(`UI Missing: ${id}`);
    });

    const ok = window.verifyCalorieLogic();
    if (!ok) warnings.push("Calorie logic returned warning state.");

    const effectiveTarget = window.PegasusDebugHelpers.getEffectiveTarget();
    if (effectiveTarget < 1800 || effectiveTarget > 3800) {
        warnings.push(`Metabolic target out of expected range: ${effectiveTarget} kcal`);
    }

    const engineState = window.PegasusDebugHelpers.getEngineState();
    if (!engineState) {
        warnings.push("Engine state unavailable.");
    } else {
        const bufferSize = window.PegasusDebugHelpers.getEventBufferSize();
        if (bufferSize <= 0) warnings.push("Engine event buffer is empty.");
    }

    if (errors.length === 0 && warnings.length === 0) {
        console.log("%c✅ System Healthy & Aligned", "color: #4CAF50; font-weight: bold;");
    } else {
        errors.forEach(err => window.PegasusLogger.log(err, "HEALTH_CRITICAL"));
        warnings.forEach(wrn => console.warn("⚠️ " + wrn));
    }
};

/* ==========================================================================
   PEGASUS GARBAGE COLLECTOR (UNIVERSAL)
   ========================================================================== */
window.PegasusGarbageCollector = {
    retentionDays: 60,

    run: function() {
        const now = Date.now();
        let deletedCount = 0;
        let keysToDelete = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            const isDaily =
                key.startsWith("food_log_") ||
                key.startsWith("pegasus_cardio_kcal_") ||
                key.startsWith("pegasus_history_") ||
                key.startsWith("pegasus_routine_injected_");

            if (isDaily) {
                const datePart = key.split('_').pop();
                let logDate;

                if (datePart.includes('/')) {
                    const p = datePart.split('/');
                    logDate = new Date(p[2], p[1] - 1, p[0]).getTime();
                } else if (datePart.includes('-')) {
                    logDate = new Date(datePart).getTime();
                }

                if (logDate && (now - logDate > (this.retentionDays * 86400000))) {
                    keysToDelete.push(key);
                }
            }
        }

        keysToDelete.forEach(k => {
            localStorage.removeItem(k);
            deletedCount++;
        });

        if (deletedCount > 0) console.log(`🧹 GC: Removed ${deletedCount} legacy records.`);
    }
};

/* ==========================================================================
   EVENT BRIDGES
   ========================================================================== */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn && btn.id) {
        window.PegasusTracer.log(btn.id, "DOM_CLICK", "START", `Button Text: ${btn.textContent.trim()}`);
    }
}, true);

window.addEventListener('error', (e) => {
    window.PegasusLogger.log(`Runtime: ${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`, "RUNTIME_ERROR");
});

setTimeout(() => {
    if (window.PegasusGarbageCollector) window.PegasusGarbageCollector.run();
    window.pegasusHealthCheck();
}, 5000);
