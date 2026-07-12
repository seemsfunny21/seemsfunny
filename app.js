/* ==========================================================================
   PEGASUS WORKOUT ENGINE - v10.48 (PER-EXERCISE SET GUARD)
   Protocol: Partial Session Memory + Auto-Sort + Smart Sync Logic
   Status: FINAL STABLE | PHASE-2 ENGINE RUNTIME PATCH READY
   ========================================================================== */

var M = M || window.PegasusManifest;
var P_M = M;

window.masterUI = window.masterUI || {};

if (!M) {
    console.warn("⚠️ PEGASUS CRITICAL: Manifest not found during app.js boot.");
}

/* ===== 1. ISSUE LOGGER (DIAGNOSTIC MODE) ===== */
window.pegasusLogs = (() => { try { return JSON.parse(localStorage.getItem(P_M?.system?.logs || "pegasus_system_logs") || "[]"); } catch (e) { console.warn("⚠️ PEGASUS LOGS RESET:", e); return []; } })();
const originalError = console.error;
const originalWarn = console.warn;

console.error = function(...args) {
    window.pegasusLogs.push({ type: "ERROR", time: new Date().toLocaleTimeString('el-GR'), msg: args.join(" ") });
    localStorage.setItem(P_M?.system?.logs || "pegasus_system_logs", JSON.stringify(window.pegasusLogs.slice(-50)));
    originalError.apply(console, args);
};

console.warn = function(...args) {
    window.pegasusLogs.push({ type: "WARNING", time: new Date().toLocaleTimeString('el-GR'), msg: args.join(" ") });
    localStorage.setItem(P_M?.system?.logs || "pegasus_system_logs", JSON.stringify(window.pegasusLogs.slice(-50)));
    originalWarn.apply(console, args);
};

window.addEventListener('error', function(event) {
    console.error(`Runtime Error: ${event.message} at ${event.filename}:${event.lineno}`);
});

/* ===== 2. CORE VARIABLES ===== */
var exercises = [];
var remainingSets = [];
var currentIdx = 0;
var phase = 0; // 0: Prep, 1: Work, 2: Rest
var running = false;
var timer = null;
var totalSeconds = 0;
var remainingSeconds = 0;
var phaseRemainingSeconds = null;
var sessionActiveKcal = 0;
var muted = localStorage.getItem(P_M?.system?.mute || "pegasus_mute_state") === "true";
var TURBO_MODE = localStorage.getItem(P_M?.system?.turbo || "pegasus_turbo_state") === "true";
var SPEED = TURBO_MODE ? 10 : 1;
var userWeight = parseFloat(localStorage.getItem(P_M?.user?.weight || "pegasus_weight")) || 74;

/* ===== 2.4 KCAL HELPERS ===== */
window.getPegasusTodayDateStr = function() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

window.getPegasusLocalDateKey = function() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};


/* PEGASUS 293: per-exercise-instance daily set progress guard.
   Prevents one completed 3/3 exercise from making another exercise look complete. */
function normalizePegasusProgressName(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\u0370-\u03ff]+/g, '');
}

function getPegasusExerciseProgressKey(day, index, name) {
    const safeDay = String(day || getPegasusActiveSelectedDay?.() || '').trim() || 'day';
    const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
    return `${safeDay}|${safeIndex}|${normalizePegasusProgressName(name)}`;
}

function pegasusDailyProgressHasInstanceKeys(dailyProg) {
    const exercisesMap = dailyProg && dailyProg.exercises && typeof dailyProg.exercises === 'object'
        ? dailyProg.exercises
        : {};
    return Object.keys(exercisesMap).some(key => String(key).includes('|'));
}

function readPegasusExerciseDone(dailyProg, day, index, name) {
    const exercisesMap = dailyProg && dailyProg.exercises && typeof dailyProg.exercises === 'object'
        ? dailyProg.exercises
        : {};
    const instanceKey = getPegasusExerciseProgressKey(day, index, name);
    if (Object.prototype.hasOwnProperty.call(exercisesMap, instanceKey)) {
        return Math.max(0, Number(exercisesMap[instanceKey]) || 0);
    }

    // Legacy fallback only before this day has any per-instance entries.
    // Once instance keys exist, plain exercise-name counters are compatibility only.
    if (!pegasusDailyProgressHasInstanceKeys(dailyProg) && Object.prototype.hasOwnProperty.call(exercisesMap, name)) {
        return Math.max(0, Number(exercisesMap[name]) || 0);
    }

    return 0;
}

function writePegasusExerciseDone(exNode, name, index, done) {
    const todayStr = window.getPegasusLocalDateKey();
    let dailyProg = {};
    try { dailyProg = JSON.parse(localStorage.getItem('pegasus_daily_progress') || '{}') || {}; }
    catch (e) { dailyProg = {}; }
    if (dailyProg.date !== todayStr || !dailyProg.exercises || typeof dailyProg.exercises !== 'object') {
        dailyProg = { date: todayStr, exercises: {} };
    }

    const selectedDay = exNode?.dataset?.day || getPegasusActiveSelectedDay?.() || '';
    const rawIndex = exNode?.dataset?.index ?? index ?? currentIdx;
    const progressKey = exNode?.dataset?.progressKey || getPegasusExerciseProgressKey(selectedDay, rawIndex, name);
    const safeDone = Math.max(0, Number(done) || 0);

    dailyProg.exercises[progressKey] = safeDone;
    dailyProg.exercises[String(name || '').trim()] = safeDone; // compatibility for older read-only views
    dailyProg.updatedAt = Date.now();
    dailyProg.progressMode = 'per-exercise-instance-v293';
    localStorage.setItem('pegasus_daily_progress', JSON.stringify(dailyProg));
    return dailyProg;
}

function syncPegasusRemainingSetFromNode(index) {
    const exNode = exercises[index];
    if (!exNode) return 0;
    const total = Math.max(0, Number(exNode.dataset.total) || 0);
    const done = Math.max(0, Number(exNode.dataset.done) || 0);
    const remaining = Math.max(0, total - done);
    remainingSets[index] = remaining;
    return remaining;
}

window.getPegasusDateAliases = function(dateStr) {
    const aliases = new Set();
    const raw = String(dateStr || '').trim();
    if (raw) aliases.add(raw);

    let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
        aliases.add(`${m[3]}-${m[2]}-${m[1]}`);
        aliases.add(`${parseInt(m[1], 10)}/${parseInt(m[2], 10)}/${m[3]}`);
        aliases.add(`${m[3]}${m[2]}${m[1]}`);
    }

    m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
        aliases.add(`${m[3]}/${m[2]}/${m[1]}`);
        aliases.add(`${parseInt(m[3], 10)}/${parseInt(m[2], 10)}/${m[1]}`);
        aliases.add(`${m[1]}${m[2]}${m[3]}`);
    }

    m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const d = String(parseInt(m[1], 10)).padStart(2, '0');
        const mo = String(parseInt(m[2], 10)).padStart(2, '0');
        aliases.add(`${d}/${mo}/${m[3]}`);
        aliases.add(`${m[3]}-${mo}-${d}`);
        aliases.add(`${m[3]}${mo}${d}`);
    }

    return Array.from(aliases);
};


/* PEGASUS 135: muscle group emoji helpers */
window.getPegasusMuscleEmoji = function(group) {
    const key = String(group || '').trim();
    return ({
        'Στήθος': '🟩',
        'Πλάτη': '🪽',
        'Πόδια': '🦵',
        'Χέρια': '💪',
        'Ώμοι': '🔺',
        'Κορμός': '🧱',
        'None': '🧘',
        'Άλλο': '•'
    })[key] || '•';
};

window.formatPegasusMuscleBadge = function(group) {
    const clean = String(group || '').trim() || 'Άλλο';
    if (clean === 'None') return '🧘 Αποθεραπεία';
    return `${window.getPegasusMuscleEmoji(clean)} ${clean}`;
};

window.resolvePegasusExerciseGroup = function(exerciseName) {
    const cleanName = String(exerciseName || '').trim().replace(' ☀️', '');
    if (typeof window.getPegasusExerciseGroup === 'function') return window.getPegasusExerciseGroup(cleanName);
    const exact = window.exercisesDB?.find(ex => String(ex.name || '').trim() === cleanName);
    if (exact?.muscleGroup) return exact.muscleGroup;
    return 'Άλλο';
};

function getPegasusTimerConfig() {
    const raw = window.pegasusTimerConfig || {};
    const normalizePhase = (value, fallback) => {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const normalized = {
        prep: normalizePhase(raw.prep, 10),
        work: normalizePhase(raw.work, 45),
        rest: normalizePhase(raw.rest, 60)
    };

    window.pegasusTimerConfig = normalized;
    return normalized;
}

function getPhaseDefaultTime(targetPhase) {
    const config = getPegasusTimerConfig();
    return (targetPhase === 0) ? config.prep : (targetPhase === 1 ? config.work : config.rest);
}

function getPhaseStartingSeconds(targetPhase, currentRemaining) {
    const fallback = getPhaseDefaultTime(targetPhase);
    const parsedRemaining = Number(currentRemaining);
    if (Number.isFinite(parsedRemaining) && parsedRemaining > 0) {
        return parsedRemaining;
    }
    return fallback;
}

window.getPegasusTodayCardioOffset = function() {
    if (window.PegasusMetabolic?.getTodayCardioOffset) {
        return window.PegasusMetabolic.getTodayCardioOffset();
    }

    const dateStr = window.getPegasusTodayDateStr();
    const aliases = (typeof window.getPegasusDateAliases === "function")
        ? window.getPegasusDateAliases(dateStr)
        : [dateStr];

    let directValue = 0;
    aliases.forEach(alias => {
        const unified = parseFloat(localStorage.getItem("pegasus_cardio_kcal_" + alias));
        if (!isNaN(unified)) directValue = Math.max(directValue, unified);

        const legacy = parseFloat(localStorage.getItem((M?.workout?.cardio_offset || "pegasus_cardio_offset_sets") + "_" + alias));
        if (!isNaN(legacy)) directValue = Math.max(directValue, legacy);
    });

    let historyValue = 0;
    try {
        const history = JSON.parse(localStorage.getItem("pegasus_cardio_history") || "[]");
        const aliasSet = new Set(aliases);
        if (Array.isArray(history)) {
            history.forEach(entry => {
                if (aliasSet.has(String(entry?.date || '').trim()) || aliasSet.has(String(entry?.isoDate || entry?.dateKey || entry?.workoutKey || '').trim()) || aliasSet.has(String(entry?.compactDate || '').trim())) {
                    historyValue += parseFloat(entry?.kcal || entry?.calories || entry?.cardioKcal || 0) || 0;
                }
            });
        }
    } catch (e) {}

    return Math.round(Math.max(directValue, historyValue));
};


window.getPegasusWorkoutKcalForDate = function(dateStr) {
    const targetDate = dateStr || window.getPegasusTodayDateStr();
    const aliases = (typeof window.getPegasusDateAliases === "function")
        ? window.getPegasusDateAliases(targetDate)
        : [targetDate];

    const prefixes = ["pegasus_workout_kcal_", "pegasus_strength_kcal_", "pegasus_gym_kcal_"];
    let directValue = 0;

    aliases.forEach(alias => {
        prefixes.forEach(prefix => {
            const value = parseFloat(localStorage.getItem(prefix + alias));
            if (!isNaN(value)) directValue = Math.max(directValue, value);
        });
    });

    let historyValue = 0;
    try {
        const history = JSON.parse(localStorage.getItem("pegasus_workout_kcal_history") || "[]");
        const aliasSet = new Set(aliases.map(String));
        if (Array.isArray(history)) {
            history.forEach(entry => {
                const matches = [entry?.date, entry?.isoDate, entry?.dateKey, entry?.workoutKey, entry?.compactDate]
                    .map(v => String(v || '').trim())
                    .some(v => aliasSet.has(v));
                if (matches) historyValue += parseFloat(entry?.kcal || entry?.calories || entry?.workoutKcal || 0) || 0;
            });
        }
    } catch (e) {}

    return Math.round(Math.max(directValue, historyValue));
};

window.getPegasusTodayWorkoutKcal = function() {
    return window.getPegasusWorkoutKcalForDate(window.getPegasusTodayDateStr());
};

window.getPegasusExerciseBurnForDate = function(dateStr) {
    const cardio = (window.PegasusMetabolic?.getCardioOffsetForDate)
        ? window.PegasusMetabolic.getCardioOffsetForDate(dateStr || window.getPegasusTodayDateStr())
        : window.getPegasusTodayCardioOffset();
    const workout = (window.PegasusMetabolic?.getWorkoutBurnForDate)
        ? window.PegasusMetabolic.getWorkoutBurnForDate(dateStr || window.getPegasusTodayDateStr())
        : window.getPegasusWorkoutKcalForDate(dateStr || window.getPegasusTodayDateStr());
    return Math.round((parseFloat(cardio) || 0) + (parseFloat(workout) || 0));
};

window.getPegasusTodayExerciseBurn = function() {
    return window.getPegasusExerciseBurnForDate(window.getPegasusTodayDateStr());
};

window.recordPegasusWorkoutBurn = function(kcal, dateObj) {
    const burned = Math.round(parseFloat(kcal) || 0);
    if (burned <= 0) return 0;

    const d = dateObj instanceof Date ? dateObj : new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const iso = `${yyyy}-${mm}-${dd}`;
    const greek = `${dd}/${mm}/${yyyy}`;
    const aliases = (typeof window.getPegasusDateAliases === "function")
        ? window.getPegasusDateAliases(iso)
        : [iso, greek, `${parseInt(dd,10)}/${parseInt(mm,10)}/${yyyy}`, `${yyyy}${mm}${dd}`];

    const prefixes = ["pegasus_workout_kcal_", "pegasus_strength_kcal_", "pegasus_gym_kcal_"];
    let current = 0;
    aliases.forEach(alias => prefixes.forEach(prefix => {
        const value = parseFloat(localStorage.getItem(prefix + alias));
        if (!isNaN(value)) current = Math.max(current, value);
    }));
    const next = Math.round(current + burned);
    aliases.forEach(alias => prefixes.forEach(prefix => localStorage.setItem(prefix + alias, String(next))));

    let history = [];
    try { history = JSON.parse(localStorage.getItem("pegasus_workout_kcal_history") || "[]"); }
    catch (e) { history = []; }
    if (!Array.isArray(history)) history = [];
    history.unshift({
        date: greek,
        isoDate: iso,
        dateKey: iso,
        compactDate: `${yyyy}${mm}${dd}`,
        type: 'Προπόνηση',
        activity: 'strength',
        kcal: burned,
        calories: burned,
        recordedAt: new Date().toISOString(),
        source: 'desktop-workout-finish-v188'
    });
    localStorage.setItem("pegasus_workout_kcal_history", JSON.stringify(history.slice(0, 100)));
    localStorage.setItem("pegasus_last_workout_kcal_entry", JSON.stringify(history[0]));

    if (typeof window.getPegasusBaseDailyTarget === "function" && typeof window.getPegasusTodayExerciseBurn === "function") {
        localStorage.setItem('pegasus_effective_today_kcal', String(Math.round(window.getPegasusFinalDailyTargetFromBurn(window.getPegasusBaseDailyTarget(), window.getPegasusTodayExerciseBurn()))));
        localStorage.setItem('pegasus_effective_today_date', greek);
    }

    console.log(`🏋️ PEGASUS WORKOUT BURN: +${burned} kcal recorded for diet target (${next} kcal workout total today).`);
    return next;
};

window.getPegasusBodyGoalMode = window.getPegasusBodyGoalMode || function(settingsObj) {
    const raw = settingsObj?.bodyGoalMode || localStorage.getItem('pegasus_body_goal_mode') || 'cut';
    const v = String(raw || '').toLowerCase();
    return (v === 'bulk' || v === 'ogkos' || v === 'όγκος') ? 'bulk' : 'cut';
};

window.getPegasusBodyGoalLabel = window.getPegasusBodyGoalLabel || function(mode) {
    const isEn = (window.PegasusI18n?.getLanguage?.() || localStorage.getItem('pegasus_language') || localStorage.getItem('pegasus_lang')) === 'en';
    return window.getPegasusBodyGoalMode({ bodyGoalMode: mode }) === 'bulk' ? (isEn ? 'Bulk' : 'Όγκος') : (isEn ? 'Cutting' : 'Γράμμωση');
};

window.getPegasusExerciseRefeedForTarget = window.getPegasusExerciseRefeedForTarget || function(exerciseBurn, settingsObj) {
    const burn = Math.max(0, Math.round(parseFloat(exerciseBurn) || 0));
    const mode = window.getPegasusBodyGoalMode(settingsObj);
    if (mode === 'bulk') return burn;
    return Math.min(250, Math.round((burn * 0.15) / 50) * 50);
};

window.getPegasusFinalDailyTargetFromBurn = window.getPegasusFinalDailyTargetFromBurn || function(baseTarget, exerciseBurn, settingsObj) {
    return Math.round((parseFloat(baseTarget) || 0) + window.getPegasusExerciseRefeedForTarget(exerciseBurn, settingsObj));
};


window.getPegasusActiveDayName = window.getPegasusActiveDayName || function(settingsObj) {
    const validDays = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"];
    const normalize = (value) => {
        const raw = String(value || "").trim();
        if (!raw) return "";
        const map = {
            monday: "Δευτέρα", mon: "Δευτέρα", "δευτερα": "Δευτέρα", "δευτέρα": "Δευτέρα",
            tuesday: "Τρίτη", tue: "Τρίτη", "τριτη": "Τρίτη", "τρίτη": "Τρίτη",
            wednesday: "Τετάρτη", wed: "Τετάρτη", "τεταρτη": "Τετάρτη", "τετάρτη": "Τετάρτη",
            thursday: "Πέμπτη", thu: "Πέμπτη", "πεμπτη": "Πέμπτη", "πέμπτη": "Πέμπτη",
            friday: "Παρασκευή", fri: "Παρασκευή", "παρασκευη": "Παρασκευή", "παρασκευή": "Παρασκευή",
            saturday: "Σάββατο", sat: "Σάββατο", "σαββατο": "Σάββατο", "σάββατο": "Σάββατο",
            sunday: "Κυριακή", sun: "Κυριακή", "κυριακη": "Κυριακή", "κυριακή": "Κυριακή"
        };
        const key = raw.toLowerCase();
        return validDays.includes(raw) ? raw : (map[key] || "");
    };

    const fromSettings = normalize(settingsObj?.dayName || settingsObj?.selectedDay || settingsObj?.workoutDay);
    if (fromSettings) return fromSettings;

    try {
        const activeBtn = document.querySelector(".navbar button.active[id^='nav-']");
        const fromButton = normalize(activeBtn?.id?.replace(/^nav-/, ""));
        if (fromButton) return fromButton;
    } catch (e) {}

    try {
        const summary = (typeof window.getPegasusRuntimeSummary === "function") ? window.getPegasusRuntimeSummary() : null;
        const fromRuntime = normalize(summary?.selectedDay || summary?.workout?.selectedDay);
        if (fromRuntime) return fromRuntime;
    } catch (e) {}

    const greekDays = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
    return greekDays[new Date().getDay()];
};

window.getPegasusBaseDailyTarget = function(settingsObj) {
    const dayName = (typeof window.getPegasusActiveDayName === "function")
        ? window.getPegasusActiveDayName(settingsObj)
        : ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"][new Date().getDay()];

    const settings = settingsObj || (
        typeof window.getPegasusSettings === "function"
            ? window.getPegasusSettings()
            : { activeSplit: "IRON" }
    );

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
        case "IRON":
        case "UPPER_LOWER":
        default:
            return KCAL_WEIGHTS;
    }
};

window.getPegasusEffectiveDailyTarget = function(settingsObj) {
    const baseTarget = window.getPegasusBaseDailyTarget(settingsObj);
    const exerciseBurn = (typeof window.getPegasusTodayExerciseBurn === "function")
        ? window.getPegasusTodayExerciseBurn()
        : window.getPegasusTodayCardioOffset();
    return window.getPegasusFinalDailyTargetFromBurn(baseTarget, exerciseBurn, settingsObj);
};

/* ===== 2.5 DYNAMIC UI KCAL CONTROLLER ===== */
window.updateKcalUI = function() {
    const kcalDisplay = document.querySelector(".kcal-value");
    const kcalLabel = document.querySelector(".kcal-label");
    if (!kcalDisplay) return;

    const uiState = (typeof window.getPegasusUiState === "function")
        ? window.getPegasusUiState()
        : null;
    const summary = uiState?.summary || ((typeof window.getPegasusRuntimeSummary === "function")
        ? window.getPegasusRuntimeSummary()
        : { running, sessionKcal: sessionActiveKcal });

    const isWorkoutActive = !!summary.running;
    const liveSessionKcal = typeof summary.sessionKcal === "number" ? summary.sessionKcal : sessionActiveKcal;

    if (isWorkoutActive) {
        kcalDisplay.textContent = parseFloat(liveSessionKcal || 0).toFixed(1);
        kcalDisplay.style.color = "#FFC107";
        if (kcalLabel) kcalLabel.textContent = "Kcal προπόνησης";
    } else {
        const dailyTarget = (typeof window.getPegasusEffectiveDailyTarget === "function")
            ? window.getPegasusEffectiveDailyTarget()
            : (localStorage.getItem('pegasus_today_kcal') || "2100");

        kcalDisplay.textContent = dailyTarget;
        kcalDisplay.style.color = "#4CAF50";
        if (kcalLabel) kcalLabel.textContent = "Στόχος ημέρας (kcal)";
    }
};

/* ===== 3. AUDIO SYSTEM ===== */
let sysAudio = new Audio('videos/beep.mp3');
let audioUnlocked = false;

document.addEventListener('click', function() {
    if (!audioUnlocked) {
        sysAudio.play().then(() => {
            sysAudio.pause();
            sysAudio.currentTime = 0;
            audioUnlocked = true;
            console.log("🔊 PEGASUS OS: Audio Unlocked & Ready.");
        }).catch(err => console.warn("PEGASUS OS: Audio unlock pending user action", err));
    }
}, { once: true });

const playBeep = (volume = 1) => {
    if (!muted) {
        sysAudio.volume = volume;
        sysAudio.currentTime = 0;
        sysAudio.play().catch(e => console.log("Audio execution blocked by browser policy", e));
    }
};

/* ===== PEGASUS CORE ENGINE BRIDGE ===== */
function clonePegasusValue(value) {
    try {
        return structuredClone(value);
    } catch (e) {
        return JSON.parse(JSON.stringify(value));
    }
}

function getPegasusCoreEngine() {
    if (window.PegasusEngine && window.PegasusEngine.__isCoreEngine) {
        return window.PegasusEngine;
    }
    return null;
}

function restoreLegacyExerciseRefs(realExercises) {
    exercises = realExercises || [];
    window.exercises = exercises;
}

function buildPegasusLegacySnapshot(extra) {
    const payload = {
        exercises: isPegasusSerializableExerciseArray(exercises) ? exercises : [],
        remainingSets: Array.isArray(remainingSets) ? remainingSets.slice() : [],
        currentIdx: currentIdx,
        phase: phase,
        running: running,
        sessionKcal: sessionActiveKcal,
        totalSeconds: totalSeconds,
        remainingSeconds: remainingSeconds,
        phaseRemainingSeconds: phaseRemainingSeconds,
        turboMode: TURBO_MODE,
        speed: SPEED,
        userWeight: userWeight,
        muted: muted,
        todayDateStr: window.getPegasusTodayDateStr(),
        todayKey: window.getPegasusLocalDateKey()
    };

    if (extra && typeof extra === "object") {
        Object.keys(extra).forEach(key => {
            payload[key] = extra[key];
        });
    }

    return payload;
}

function getPegasusSessionState() {
    const engine = getPegasusCoreEngine();
    if (engine?.getSessionSnapshot) {
        return engine.getSessionSnapshot();
    }

    return {
        workout: {
            exercises,
            remainingSets,
            currentIdx,
            phase,
            running,
            sessionKcal: sessionActiveKcal
        },
        timers: {
            totalSeconds,
            remainingSeconds,
            phaseRemainingSeconds,
            turboMode: TURBO_MODE,
            speed: SPEED
        },
        user: {
            weight: userWeight,
            muted: muted
        },
        nutrition: {
            todayDateStr: window.getPegasusTodayDateStr(),
            todayKey: window.getPegasusLocalDateKey()
        }
    };
}

window.getPegasusSessionState = getPegasusSessionState;

function getPegasusProgressState() {
    const engine = getPegasusCoreEngine();
    if (engine?.getProgressSnapshot) {
        return engine.getProgressSnapshot();
    }

    const session = getPegasusSessionState();
    return {
        selectedDay: session?.workout?.selectedDay || null,
        currentIdx: session?.workout?.currentIdx ?? currentIdx,
        phase: session?.workout?.phase ?? phase,
        running: !!(session?.workout?.running ?? running),
        remainingSets: Array.isArray(session?.workout?.remainingSets) ? session.workout.remainingSets.slice() : [],
        totalSeconds: session?.timers?.totalSeconds ?? totalSeconds,
        remainingSeconds: session?.timers?.remainingSeconds ?? remainingSeconds,
        phaseRemainingSeconds: session?.timers?.phaseRemainingSeconds ?? phaseRemainingSeconds,
        sessionKcal: session?.workout?.sessionKcal ?? sessionActiveKcal
    };
}


window.getPegasusProgressState = getPegasusProgressState;

function getPegasusTimerDisplayState() {
    const engine = getPegasusCoreEngine();
    if (engine?.getTimerDisplayState) {
        return engine.getTimerDisplayState();
    }

    const progress = getPegasusProgressState();
    const total = progress?.totalSeconds ?? totalSeconds;
    const remaining = progress?.remainingSeconds ?? remainingSeconds;
    const safeTotal = total > 0 ? total : 0;
    const safeRemaining = typeof remaining === "number" ? remaining : 0;
    const minutes = Math.floor(safeRemaining / 60);
    const seconds = Math.floor(safeRemaining % 60);

    return {
        totalSeconds: safeTotal,
        remainingSeconds: safeRemaining,
        phaseRemainingSeconds: progress?.phaseRemainingSeconds ?? phaseRemainingSeconds,
        progressPercent: safeTotal > 0 ? Math.max(0, Math.min(100, ((safeTotal - safeRemaining) / safeTotal) * 100)) : 0,
        remainingText: `${minutes}:${String(seconds).padStart(2, "0")}`
    };
}

window.getPegasusTimerDisplayState = getPegasusTimerDisplayState;

function getPegasusRuntimeSummary() {
    const engine = getPegasusCoreEngine();
    if (engine?.getRuntimeSummary) {
        return engine.getRuntimeSummary();
    }

    const progress = getPegasusProgressState();
    const remainingSets = Array.isArray(progress?.remainingSets) ? progress.remainingSets : [];
    const hasRemainingWork = remainingSets.some(value => Number(value || 0) > 0);
    const hasExercises = remainingSets.length > 0;
    const isFinished = hasExercises && !hasRemainingWork;

    return {
        selectedDay: progress?.selectedDay || getPegasusActiveSelectedDay() || null,
        currentIdx: progress?.currentIdx ?? currentIdx,
        phase: progress?.phase ?? phase,
        running: !!(progress?.running ?? running),
        hasExercises,
        hasRemainingWork,
        isFinished,
        canStart: hasRemainingWork && !(progress?.running ?? running),
        canPause: !!(progress?.running ?? running),
        sessionKcal: progress?.sessionKcal ?? sessionActiveKcal,
        totalSeconds: progress?.totalSeconds ?? totalSeconds,
        remainingSeconds: progress?.remainingSeconds ?? remainingSeconds,
        progressPercent: getPegasusTimerDisplayState().progressPercent
    };
}

window.getPegasusRuntimeSummary = getPegasusRuntimeSummary;


function getPegasusControlState() {
    const engine = getPegasusCoreEngine();
    if (engine?.getControlState) {
        return engine.getControlState();
    }

    const summary = getPegasusRuntimeSummary();
    const total = Number(summary?.totalSeconds || 0);
    const remaining = Number(summary?.remainingSeconds || 0);
    const wasStarted = !!summary?.hasExercises && total > 0 && remaining < total;

    return {
        selectedDay: summary?.selectedDay ?? null,
        running: !!summary?.running,
        hasExercises: !!summary?.hasExercises,
        hasRemainingWork: !!summary?.hasRemainingWork,
        isFinished: !!summary?.isFinished,
        wasStarted,
        startLabel: summary?.running ? "Παύση" : (wasStarted ? "Συνέχεια" : "Έναρξη"),
        nextLabel: "Επόμενο",
        canStart: !!summary?.canStart,
        canPause: !!summary?.canPause,
        canNext: !!summary?.hasExercises && !!summary?.hasRemainingWork
    };
}

window.getPegasusControlState = getPegasusControlState;

function getPegasusUiState() {
    const engine = getPegasusCoreEngine();
    if (engine?.getUiState) {
        return engine.getUiState();
    }

    const progress = getPegasusProgressState();
    const phaseValue = progress?.phase ?? phase;

    return {
        selectedDay: getPegasusRuntimeSummary().selectedDay || null,
        phase: phaseValue,
        phaseName: phaseValue === 0 ? "prep" : (phaseValue === 1 ? "work" : "rest"),
        progress,
        timerDisplay: getPegasusTimerDisplayState(),
        summary: getPegasusRuntimeSummary(),
        controls: getPegasusControlState(),
        persisted: (typeof window.getPegasusPersistedProgress === "function") ? window.getPegasusPersistedProgress() : null
    };
}

window.getPegasusUiState = getPegasusUiState;


/* ===== PEGASUS 146: AUTO-SCROLL ACTIVE EXERCISE ===== */
function scrollPegasusActiveExerciseIntoView(idx = currentIdx, options = {}) {
    try {
        const list = document.getElementById("exList");
        const ex = Array.isArray(exercises) ? exercises[idx] : null;
        if (!list || !ex || typeof ex.getBoundingClientRect !== "function") return;

        const activeEl = document.activeElement;
        if (activeEl && activeEl.classList && activeEl.classList.contains("weight-input") && !options.force) {
            return;
        }

        const listRect = list.getBoundingClientRect();
        const exRect = ex.getBoundingClientRect();
        const margin = Number(options.margin || 18);
        const comfortablyVisible = exRect.top >= (listRect.top + margin) && exRect.bottom <= (listRect.bottom - margin);

        if (comfortablyVisible && !options.force) return;

        const targetTop = list.scrollTop + (exRect.top - listRect.top) - ((list.clientHeight - ex.offsetHeight) / 2);
        const maxTop = Math.max(0, list.scrollHeight - list.clientHeight);
        const nextTop = Math.max(0, Math.min(maxTop, targetTop));

        list.scrollTo({
            top: nextTop,
            behavior: options.instant ? "auto" : "smooth"
        });
    } catch (e) {
        console.warn("⚠️ PEGASUS AUTO-SCROLL: skipped", e);
    }
}
window.scrollPegasusActiveExerciseIntoView = scrollPegasusActiveExerciseIntoView;

function renderPegasusControlState() {
    const uiState = getPegasusUiState();
    const controls = uiState?.controls || getPegasusControlState();
    const startBtn = document.getElementById("btnStart");
    const nextBtn = document.getElementById("btnNext");

    if (startBtn) {
        startBtn.innerHTML = controls?.startLabel || "Έναρξη";
        startBtn.dataset.running = controls?.running ? "true" : "false";
        startBtn.dataset.started = controls?.wasStarted ? "true" : "false";
    }

    if (nextBtn) {
        nextBtn.innerHTML = controls?.nextLabel || "Επόμενο";
        nextBtn.style.opacity = controls?.canNext ? "1" : "0.65";
    }

    return controls;
}

function getPegasusActiveSelectedDay() {
    const activeBtn = document.querySelector(".navbar button.active");
    return activeBtn ? activeBtn.id.replace("nav-", "") : null;
}

function buildPegasusProgressPayload(extra) {
    const safeExtra = (extra && typeof extra === "object") ? extra : {};
    const extraWorkout = (safeExtra.workout && typeof safeExtra.workout === "object") ? safeExtra.workout : {};
    const extraTimers = (safeExtra.timers && typeof safeExtra.timers === "object") ? safeExtra.timers : {};

    const selectedDay = Object.prototype.hasOwnProperty.call(extraWorkout, "selectedDay")
        ? extraWorkout.selectedDay
        : getPegasusActiveSelectedDay();

    return {
        workout: {
            selectedDay: selectedDay ?? null,
            currentIdx,
            phase,
            running,
            remainingSets: Array.isArray(remainingSets) ? remainingSets.slice() : [],
            sessionKcal: sessionActiveKcal,
            ...extraWorkout
        },
        timers: {
            totalSeconds,
            remainingSeconds,
            phaseRemainingSeconds,
            turboMode: TURBO_MODE,
            speed: SPEED,
            ...extraTimers
        }
    };
}

function syncPegasusProgressRuntime(extra) {
    return patchPegasusEngineRuntime("PATCH_PROGRESS_RUNTIME", buildPegasusProgressPayload(extra));
}

function syncPegasusSelectedDay(selectedDay) {
    syncPegasusProgressRuntime({
        workout: {
            selectedDay: selectedDay ?? null
        }
    });
}

function dispatchPegasusWorkoutAction(actionType, extra) {
    const engine = getPegasusCoreEngine();
    if (!engine) return null;

    const payload = buildPegasusProgressPayload(extra);

    if (actionType === "WORKOUT_SELECT_DAY_RUNTIME" && engine.selectDayRuntime) return engine.selectDayRuntime(payload);
    if (actionType === "WORKOUT_START_RUNTIME" && engine.startWorkoutRuntime) return engine.startWorkoutRuntime(payload);
    if (actionType === "WORKOUT_PAUSE_RUNTIME" && engine.pauseWorkoutRuntime) return engine.pauseWorkoutRuntime(payload);
    if (actionType === "WORKOUT_NEXT_RUNTIME" && engine.nextExerciseRuntime) return engine.nextExerciseRuntime(payload);
    if (actionType === "WORKOUT_SET_COMPLETED_RUNTIME" && engine.completeSetRuntime) return engine.completeSetRuntime(payload);
    if (actionType === "WORKOUT_FINISH_RUNTIME" && engine.finishWorkoutRuntime) return engine.finishWorkoutRuntime(payload);

    return null;
}

function isPegasusDomExerciseArray(value) {
    return Array.isArray(value) && value.length > 0 && value.every(item => item && typeof item.querySelector === "function" && item.classList);
}

function isPegasusSerializableExerciseArray(value) {
    return Array.isArray(value) && value.every(item => {
        if (!item || typeof item !== "object") return false;
        if (item.nodeType || typeof item.querySelector === "function" || typeof item.classList !== "undefined") return false;
        return true;
    });
}

function applyPegasusSessionSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return snapshot;

    const workout = snapshot.workout || {};
    const timers = snapshot.timers || {};
    const user = snapshot.user || {};

    if (isPegasusDomExerciseArray(workout.exercises)) {
        exercises = workout.exercises;
        window.exercises = exercises;
    }

    if (Array.isArray(workout.remainingSets) && (workout.remainingSets.length > 0 || !Array.isArray(remainingSets) || remainingSets.length === 0)) {
        remainingSets = workout.remainingSets.slice();
        window.remainingSets = remainingSets;
    }

    currentIdx = workout.currentIdx ?? currentIdx;
    phase = workout.phase ?? phase;
    running = workout.running ?? running;
    sessionActiveKcal = workout.sessionKcal ?? sessionActiveKcal;

    totalSeconds = timers.totalSeconds ?? totalSeconds;
    remainingSeconds = timers.remainingSeconds ?? remainingSeconds;
    phaseRemainingSeconds = timers.phaseRemainingSeconds ?? phaseRemainingSeconds;
    TURBO_MODE = timers.turboMode ?? TURBO_MODE;
    SPEED = timers.speed ?? SPEED;

    userWeight = user.weight ?? userWeight;
    muted = user.muted ?? muted;

    window.currentIdx = currentIdx;
    window.phase = phase;
    window.running = running;
    window.sessionActiveKcal = sessionActiveKcal;
    window.totalSeconds = totalSeconds;
    window.remainingSeconds = remainingSeconds;
    window.phaseRemainingSeconds = phaseRemainingSeconds;
    window.TURBO_MODE = TURBO_MODE;
    window.SPEED = SPEED;
    window.userWeight = userWeight;
    window.muted = muted;

    return snapshot;
}

function applyPegasusProgressSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return snapshot;

    const workout = snapshot.workout || {};
    const timers = snapshot.timers || {};
    const user = snapshot.user || {};

    currentIdx = workout.currentIdx ?? currentIdx;
    phase = workout.phase ?? phase;
    running = workout.running ?? running;
    sessionActiveKcal = workout.sessionKcal ?? sessionActiveKcal;

    totalSeconds = timers.totalSeconds ?? totalSeconds;
    remainingSeconds = timers.remainingSeconds ?? remainingSeconds;
    phaseRemainingSeconds = timers.phaseRemainingSeconds ?? phaseRemainingSeconds;
    TURBO_MODE = timers.turboMode ?? TURBO_MODE;
    SPEED = timers.speed ?? SPEED;

    userWeight = user.weight ?? userWeight;
    muted = user.muted ?? muted;

    window.currentIdx = currentIdx;
    window.phase = phase;
    window.running = running;
    window.sessionActiveKcal = sessionActiveKcal;
    window.totalSeconds = totalSeconds;
    window.remainingSeconds = remainingSeconds;
    window.phaseRemainingSeconds = phaseRemainingSeconds;
    window.TURBO_MODE = TURBO_MODE;
    window.SPEED = SPEED;
    window.userWeight = userWeight;
    window.muted = muted;

    return snapshot;
}

function patchPegasusEngineRuntime(actionType, payload) {
    const engine = getPegasusCoreEngine();
    if (!engine) return null;

    let nextState = null;

    if (actionType === "PATCH_WORKOUT_RUNTIME" && engine.patchWorkoutRuntime) {
        nextState = engine.patchWorkoutRuntime(payload);
    } else if (actionType === "PATCH_TIMER_RUNTIME" && engine.patchTimerRuntime) {
        nextState = engine.patchTimerRuntime(payload);
    } else if (actionType === "PATCH_PROGRESS_RUNTIME" && engine.patchProgressRuntime) {
        nextState = engine.patchProgressRuntime(payload);
    } else if (actionType === "PATCH_USER_RUNTIME" && engine.patchUserRuntime) {
        nextState = engine.patchUserRuntime(payload);
    } else if (actionType === "PATCH_SESSION_RUNTIME" && engine.patchSessionRuntime) {
        nextState = engine.patchSessionRuntime(payload);
    } else if (actionType === "SET_SELECTED_DAY" && engine.setSelectedDay) {
        nextState = engine.setSelectedDay(payload?.selectedDay ?? null);
    }

    if (nextState?.workout && nextState?.timers) {
        if (actionType === "PATCH_TIMER_RUNTIME" || actionType === "PATCH_PROGRESS_RUNTIME") {
            applyPegasusProgressSnapshot(nextState);
        } else {
            applyPegasusSessionSnapshot(nextState);
        }
    }

    return nextState;
}

function patchPegasusWorkoutRuntime(payload) {
    return patchPegasusEngineRuntime("PATCH_WORKOUT_RUNTIME", payload);
}

function patchPegasusTimerRuntime(payload) {
    return patchPegasusEngineRuntime("PATCH_TIMER_RUNTIME", payload);
}

function patchPegasusUserRuntime(payload) {
    return patchPegasusEngineRuntime("PATCH_USER_RUNTIME", payload);
}

function patchPegasusSessionRuntime(payload) {
    return patchPegasusEngineRuntime("PATCH_SESSION_RUNTIME", payload);
}

function bindPegasusEngineUiBridge() {
    if (window.__pegasusEngineUiBridgeBound) return;
    const engine = getPegasusCoreEngine();
    if (!engine?.subscribe) return;

    window.__pegasusEngineUiBridgeBound = true;

    engine.subscribe((nextState, action) => {
        try {
            if (!nextState || !action) return;

            const actionType = action.type || "";
            const runtimeAction = actionType.includes("PATCH_") || actionType.includes("PHASE") || actionType.includes("WORKOUT") || actionType.includes("SYNC_") || actionType.includes("SELECT_DAY") || actionType.includes("SET_SELECTED_DAY") || actionType.includes("AUTO_INIT") || actionType.includes("BOOT");

            if (runtimeAction) {
                if (actionType === "PATCH_TIMER_RUNTIME" || actionType === "PATCH_PROGRESS_RUNTIME") {
                    applyPegasusProgressSnapshot(nextState);
                } else {
                    applyPegasusSessionSnapshot(nextState);
                }
                updateTotalBar();
                if (typeof window.updateKcalUI === "function") window.updateKcalUI();

                renderPegasusControlState();
            }
        } catch (e) {
            console.warn("⚠️ PEGASUS ENGINE UI BRIDGE WARNING:", e);
        }
    });
}

function syncEngineFromLegacy(actionType, extra) {
    const engine = getPegasusCoreEngine();
    if (!engine) return;

    const realExercises = exercises;
    const snapshot = buildPegasusLegacySnapshot(extra);

    const nextState = engine.hydrateFromLegacy
        ? engine.hydrateFromLegacy(snapshot, actionType || "HYDRATE_LEGACY_RUNTIME")
        : engine.replaceState?.({
            ...engine.getInitialState(),
            workout: {
                ...(engine.getInitialState().workout || {}),
                exercises: snapshot.exercises,
                remainingSets: snapshot.remainingSets,
                currentIdx: snapshot.currentIdx,
                phase: snapshot.phase,
                running: snapshot.running,
                selectedDay: snapshot.selectedDay ?? null,
                sessionKcal: snapshot.sessionKcal
            },
            timers: {
                ...(engine.getInitialState().timers || {}),
                totalSeconds: snapshot.totalSeconds,
                remainingSeconds: snapshot.remainingSeconds,
                phaseRemainingSeconds: snapshot.phaseRemainingSeconds,
                turboMode: snapshot.turboMode,
                speed: snapshot.speed
            },
            user: {
                ...(engine.getInitialState().user || {}),
                weight: snapshot.userWeight,
                muted: snapshot.muted
            },
            nutrition: {
                ...(engine.getInitialState().nutrition || {}),
                todayDateStr: snapshot.todayDateStr,
                todayKey: snapshot.todayKey
            }
        }, actionType || "HYDRATE_LEGACY_RUNTIME");

    if (nextState?.workout && nextState?.timers) {
        applyPegasusSessionSnapshot(nextState);
    }

    restoreLegacyExerciseRefs(realExercises);
}


function syncPegasusWorkoutRuntime(extraWorkout) {
    patchPegasusEngineRuntime("PATCH_WORKOUT_RUNTIME", {
        currentIdx,
        phase,
        running,
        remainingSets: Array.isArray(remainingSets) ? remainingSets.slice() : [],
        sessionKcal: sessionActiveKcal,
        ...(extraWorkout || {})
    });
}

function syncPegasusTimerRuntime(extraTimers) {
    patchPegasusEngineRuntime("PATCH_TIMER_RUNTIME", {
        totalSeconds,
        remainingSeconds,
        phaseRemainingSeconds,
        turboMode: TURBO_MODE,
        speed: SPEED,
        ...(extraTimers || {})
    });
}

function syncPegasusUserRuntime(extraUser) {
    patchPegasusEngineRuntime("PATCH_USER_RUNTIME", {
        weight: userWeight,
        muted: muted,
        ...(extraUser || {})
    });
}

/* ===== 3.5 SMART SYNC (AUTO-SKIP COMPLETED TARGETS) ===== */
window.syncSessionWithHistory = function() {
    console.log("🔄 PEGASUS SMART SYNC: Executing...");
    const historyKey = P_M?.workout?.weekly_history || 'pegasus_weekly_history';
    const history = JSON.parse(localStorage.getItem(historyKey) || "{}");
    const targets = (typeof window.getDynamicTargets === "function") ? window.getDynamicTargets() : {};

    exercises.forEach((exDiv, i) => {
        const exName = exDiv.querySelector(".exercise-name")?.textContent?.trim();
        const muscle = (window.exercisesDB?.find(e => e.name.trim() === exName))?.muscleGroup;

        if (muscle) {
            const doneWeekly = parseInt(history[muscle]) || 0;
            const targetWeekly = parseInt(targets[muscle]) || 0;
            if (targetWeekly > 0 && doneWeekly >= targetWeekly) {
                if (!exDiv.classList.contains("exercise-skipped") && remainingSets[i] > 0) {
                    window.toggleSkipExercise(i, true);
                }
            }
        }
    });
};



/* ===== PEGASUS 215: PERSISTENT CUSTOM EXERCISE ORDER (211 UI SAFE) ===== */
window.PEGASUS_CUSTOM_EXERCISE_ORDER_KEY = window.PEGASUS_CUSTOM_EXERCISE_ORDER_KEY || "pegasus_custom_exercise_order_v1";
window.PEGASUS_SELECTED_WORKOUT_DAY_KEY = window.PEGASUS_SELECTED_WORKOUT_DAY_KEY || "pegasus_selected_workout_day_v1";

window.getPegasusActiveWorkoutDay = function() {
    const activeBtn = document.querySelector(".navbar button.active");
    if (activeBtn && activeBtn.id) return activeBtn.id.replace("nav-", "");

    const storedDay = String(localStorage.getItem(window.PEGASUS_SELECTED_WORKOUT_DAY_KEY) || "").trim();
    if (storedDay) return storedDay;

    const summaryDay = window.getPegasusRuntimeSummary?.()?.selectedDay;
    return summaryDay || "";
};

window.getPegasusOrderDayKey = function(day) {
    const cleanDay = String(day || window.getPegasusActiveWorkoutDay() || "").trim();
    return cleanDay ? `${window.PEGASUS_CUSTOM_EXERCISE_ORDER_KEY}_${cleanDay}` : "";
};

window.readPegasusCustomExerciseOrders = function() {
    try {
        const raw = localStorage.getItem(window.PEGASUS_CUSTOM_EXERCISE_ORDER_KEY) || "{}";
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === "object") ? parsed : {};
    } catch (err) {
        console.warn("⚠️ PEGASUS ORDER: Could not read custom exercise order.", err);
        return {};
    }
};

window.savePegasusCustomExerciseOrder = function(day, names) {
    const cleanDay = String(day || window.getPegasusActiveWorkoutDay() || "").trim();
    const cleanNames = (Array.isArray(names) ? names : [])
        .map(name => String(name || "").trim())
        .filter(Boolean);

    if (!cleanDay || cleanNames.length === 0) {
        console.warn("⚠️ PEGASUS ORDER: Save skipped; missing day or exercises.", { cleanDay, cleanNames });
        return false;
    }

    const payload = { names: cleanNames, updatedAt: Date.now(), version: 215 };
    const orders = window.readPegasusCustomExerciseOrders();
    orders[cleanDay] = payload;

    localStorage.setItem(window.PEGASUS_CUSTOM_EXERCISE_ORDER_KEY, JSON.stringify(orders));
    const dayKey = window.getPegasusOrderDayKey(cleanDay);
    if (dayKey) localStorage.setItem(dayKey, JSON.stringify(payload));
    localStorage.setItem(window.PEGASUS_SELECTED_WORKOUT_DAY_KEY, cleanDay);

    if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") {
        window.PegasusCloud.push(true);
    }

    console.log(`✅ PEGASUS ORDER 215: Saved custom exercise order for ${cleanDay}.`, cleanNames);
    return true;
};

window.savePegasusCustomExerciseOrderFromDom = function(day, listEl) {
    const list = listEl || document.getElementById("exList");
    if (!list) return false;
    const names = [...list.querySelectorAll(".exercise")]
        .map(el => el.dataset.name || el.querySelector(".exercise-name")?.textContent || "")
        .map(name => String(name || "").trim())
        .filter(Boolean);
    return window.savePegasusCustomExerciseOrder(day || window.getPegasusActiveWorkoutDay(), names);
};

window.applyPegasusCustomExerciseOrder = function(day, workoutList) {
    if (!Array.isArray(workoutList) || workoutList.length <= 1) return workoutList;

    const cleanDay = String(day || window.getPegasusActiveWorkoutDay() || "").trim();
    if (!cleanDay) return workoutList;

    const aggregateSaved = window.readPegasusCustomExerciseOrders()[cleanDay];
    let localSaved = null;
    try {
        const dayKey = window.getPegasusOrderDayKey(cleanDay);
        localSaved = dayKey ? JSON.parse(localStorage.getItem(dayKey) || "null") : null;
    } catch (_) {
        localSaved = null;
    }

    const saved = (Number(localSaved?.updatedAt || 0) > Number(aggregateSaved?.updatedAt || 0)) ? localSaved : aggregateSaved;
    const savedNames = Array.isArray(saved?.names) ? saved.names.map(name => String(name || "").trim()).filter(Boolean) : [];
    if (savedNames.length === 0) return workoutList;

    const original = workoutList.slice();
    const byName = new Map();
    original.forEach(item => {
        const key = String(item?.name || "").trim();
        if (!key) return;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(item);
    });

    const ordered = [];
    savedNames.forEach(name => {
        const queue = byName.get(name);
        if (queue && queue.length) ordered.push(queue.shift());
    });

    byName.forEach(queue => { while (queue.length) ordered.push(queue.shift()); });
    return ordered.length === original.length ? ordered : workoutList;
};

window.rebuildPegasusExerciseRuntimeFromDom = function(listEl) {
    const list = listEl || document.getElementById("exList");
    if (!list) return;

    const ordered = [...list.querySelectorAll(".exercise")];
    window.exercises = ordered;
    if (typeof exercises !== "undefined") exercises = ordered;

    const nextRemaining = ordered.map(el => {
        const total = Math.max(0, parseFloat(el.dataset.total) || 0);
        const done = Math.max(0, parseFloat(el.dataset.done) || 0);
        return Math.max(0, total - done);
    });

    window.remainingSets = nextRemaining;
    if (typeof remainingSets !== "undefined") remainingSets = nextRemaining;

    ordered.forEach((el, idx) => {
        el.dataset.index = String(idx);
        const input = el.querySelector(".weight-input");
        if (input) input.id = `weight-${idx}`;
        const info = el.querySelector(".exercise-info");
        if (info && typeof window.toggleSkipExercise === "function") {
            info.onclick = function() { window.toggleSkipExercise(idx); };
        }
    });
};

window.clearPegasusCustomExerciseOrder = function(day) {
    const cleanDay = String(day || window.getPegasusActiveWorkoutDay() || "").trim();
    if (!cleanDay) return false;
    const orders = window.readPegasusCustomExerciseOrders();
    delete orders[cleanDay];
    localStorage.setItem(window.PEGASUS_CUSTOM_EXERCISE_ORDER_KEY, JSON.stringify(orders));
    const dayKey = window.getPegasusOrderDayKey(cleanDay);
    if (dayKey) localStorage.removeItem(dayKey);
    if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") window.PegasusCloud.push(true);
    console.log(`🧹 PEGASUS ORDER 215: Cleared custom exercise order for ${cleanDay}.`);
    return true;
};

/* ===== 4. NAVIGATION BINDING ===== */
function createNavbar() {
    const days = ["Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο", "Κυριακή"];
    days.forEach((d) => {
        const btn = document.getElementById(`nav-${d}`);
        if (btn) {
            btn.onclick = (e) => {
                if (e && e.isTrusted && window.PegasusCloud && typeof window.PegasusCloud.push === "function") {
                    window.PegasusCloud.push();
                }
                selectDay(btn, d);
            };
        }
    });
}

function ensurePegasusWeekendModeUi(day, listEl) {
    const list = listEl || document.getElementById("exList");
    if (!list || (day !== "Σάββατο" && day !== "Κυριακή")) return;

    if (!list.querySelector('.pegasus-weekend-mode-panel') && window.PegasusBrain?.renderWeekendModePanel) {
        window.PegasusBrain.renderWeekendModePanel(day, list, () => {
            const navBtn = document.getElementById(`nav-${day}`);
            if (typeof selectDay === "function") selectDay(navBtn, day);
        });
        const panel = list.querySelector('.pegasus-weekend-mode-panel');
        if (panel && list.firstChild !== panel) list.insertBefore(panel, list.firstChild);
    }

    const hasExercises = !!list.querySelector('.exercise');
    const existingNote = list.querySelector('.pegasus-weekend-mode-note');
    if (!hasExercises) {
        if (!existingNote) {
            const note = document.createElement('div');
            note.className = 'pegasus-weekend-mode-note';
            note.textContent = '🚴 Ποδήλατο ενεργό — δεν φορτώνει βάρη.';
            list.appendChild(note);
        }
    } else if (existingNote) {
        existingNote.remove();
    }
}
window.ensurePegasusWeekendModeUi = ensurePegasusWeekendModeUi;

function selectDay(btn, day) {
    if (typeof window.program === 'undefined' || !window.program) return;

    localStorage.setItem(window.PEGASUS_SELECTED_WORKOUT_DAY_KEY || "pegasus_selected_workout_day_v1", String(day || ""));
    window.__pegasusRenderingExerciseList = true;

    window.__pegasusSelectDayToken = (window.__pegasusSelectDayToken || 0) + 1;
    const pegasusSelectDayToken = window.__pegasusSelectDayToken;
    const isPegasusWeekendDay = (day === "Σάββατο" || day === "Κυριακή");

    document.querySelectorAll(".navbar button").forEach(b => {
        b.classList.remove("active");
        b.style.setProperty('background-color', 'transparent', 'important');
        b.style.color = "#333";
    });

    if (btn) {
        btn.classList.add("active");
        btn.style.setProperty('background-color', 'rgba(76, 175, 80, 0.1)', 'important');
        btn.style.color = "#4CAF50";
    }

    clearInterval(timer);
    timer = null;
    running = false;
    phase = 0;
    phaseRemainingSeconds = null;
    currentIdx = 0;
    sessionActiveKcal = 0;
    localStorage.setItem("pegasus_session_kcal", "0.0");

    renderPegasusControlState();

    if (typeof window.calculatePegasusDailyTarget === "function") {
        if (!window.isCalculatingTarget) {
            window.isCalculatingTarget = true;
            window.calculatePegasusDailyTarget();
            setTimeout(() => { window.isCalculatingTarget = false; }, 100);
        }
    } else if (typeof window.updateKcalUI === "function") {
        window.updateKcalUI();
    }

    const isRainy = (typeof window.isRaining === 'function') ? window.isRaining() : false;
    let rawBaseData = [];

    if (window.PegasusBrain?.getDailyWorkout) {
        rawBaseData = window.PegasusBrain.getDailyWorkout(day, {
            isRainy,
            fallback: (window.program[day]) ? [...window.program[day]] : []
        });
    } else if ((day === "Σάββατο" || day === "Κυριακή") && isRainy) {
        rawBaseData = [
            { name: "Chest Press", sets: 5, muscleGroup: "Στήθος" },
            { name: "Low Rows Seated", sets: 5, muscleGroup: "Πλάτη" },
            { name: "Ab Crunches", sets: 3, muscleGroup: "Κορμός" }
        ];
    } else {
        rawBaseData = (window.program[day]) ? [...window.program[day]] : [];
    }

    let mappedData = window.PegasusOptimizer
        ? window.PegasusOptimizer.apply(day, rawBaseData)
        : rawBaseData.map(e => ({ ...e, adjustedSets: e.sets, isCompleted: false }));

    if (mappedData.some(e => typeof e.brainOrder === "number")) {
        mappedData.sort((a, b) => (a.brainOrder ?? 999) - (b.brainOrder ?? 999));
    } else {
        mappedData.sort((a, b) => parseFloat(b.adjustedSets || b.sets) - parseFloat(a.adjustedSets || a.sets));
    }

    // PEGASUS 215: apply saved drag/drop order without changing the 211 exercise-card UI.
    if (typeof window.applyPegasusCustomExerciseOrder === "function") {
        mappedData = window.applyPegasusCustomExerciseOrder(day, mappedData);
    }

    const list = document.getElementById("exList");
    if (!list) return;
    list.innerHTML = "";
    if (window.PegasusBrain?.renderWeekendModePanel) {
        window.PegasusBrain.renderWeekendModePanel(day, list, () => selectDay(document.getElementById(`nav-${day}`), day));
    }
    ensurePegasusWeekendModeUi(day, list);
    exercises = [];
    remainingSets = [];

    const todayStr = window.getPegasusLocalDateKey();
    let dailyProg = JSON.parse(localStorage.getItem('pegasus_daily_progress') || "{}");
    if (dailyProg.date !== todayStr) dailyProg = { date: todayStr, exercises: {} };

    mappedData.forEach((e) => {
        if (!e.name || e.name === "αα" || e.adjustedSets < 0.1) return;

        const cleanName = e.name.trim();
        let finalSets = parseFloat(e.adjustedSets);
        const renderIdx = exercises.length;
        let doneSoFar = readPegasusExerciseDone(dailyProg, day, renderIdx, cleanName);
        doneSoFar = Math.min(Math.max(0, Number(doneSoFar) || 0), Math.max(0, Number(finalSets) || 0));
        let remSets = Math.max(0, finalSets - doneSoFar);

        const d = document.createElement("div");
        d.className = "exercise";
        d.dataset.name = cleanName;
        d.dataset.day = day;
        d.dataset.total = finalSets;
        d.dataset.done = doneSoFar;
        d.dataset.index = renderIdx;
        d.dataset.progressKey = getPegasusExerciseProgressKey(day, renderIdx, cleanName);

        const savedWeight = window.getSavedWeight(cleanName);
        const displayWeight = (savedWeight && savedWeight !== "") ? savedWeight : (e.weight || "");

        d.innerHTML = `
            <div class="exercise-info">
                <div class="set-counter">${doneSoFar}/${finalSets}</div>
                <div class="exercise-main">
                    <div class="exercise-name"></div>
                    <div class="exercise-muscle-badge"></div>
                </div>
                <input type="number" id="weight-${renderIdx}" class="weight-input" placeholder="kg">
            </div>
            <div class="progress-box"><div class="progress-bar"></div></div>
        `;

        const nameNode = d.querySelector(".exercise-name");
        if (nameNode) nameNode.textContent = cleanName;

        const badgeNode = d.querySelector(".exercise-muscle-badge");
        if (badgeNode) {
            const groupName = e.muscleGroup || window.resolvePegasusExerciseGroup(cleanName);
            badgeNode.textContent = window.formatPegasusMuscleBadge(groupName);
            d.dataset.group = groupName;
        }

        const weightInputEl = d.querySelector(".weight-input");
        if (weightInputEl) {
            weightInputEl.setAttribute("data-name", cleanName);
            if (displayWeight !== "") weightInputEl.value = displayWeight;

            weightInputEl.addEventListener("click", function(ev) {
                ev.stopPropagation();
            });

            weightInputEl.addEventListener("change", function() {
                window.saveWeight(cleanName, this.value);
            });
        }

        const infoNode = d.querySelector(".exercise-info");
        if (infoNode) {
            infoNode.addEventListener("click", function() {
                window.toggleSkipExercise(renderIdx);
            });
        }

        list.appendChild(d);
        exercises.push(d);
        remainingSets.push(remSets);

        if (remSets === 0) {
            d.classList.add("exercise-skipped");
            d.style.setProperty('opacity', '0.2', 'important');
            d.style.setProperty('filter', 'grayscale(100%)', 'important');
        }
    });

    if (typeof calculateTotalTime === "function") calculateTotalTime(false);
    syncPegasusSelectedDay(day);
    dispatchPegasusWorkoutAction("WORKOUT_SELECT_DAY_RUNTIME", { workout: { selectedDay: day } });

    setTimeout(() => {
        if (pegasusSelectDayToken !== window.__pegasusSelectDayToken) return;
        window.syncSessionWithHistory();
    }, 50);

    setTimeout(() => {
        if (pegasusSelectDayToken !== window.__pegasusSelectDayToken) return;
        if (typeof showVideo === "function") showVideo(0);
        if (typeof scrollPegasusActiveExerciseIntoView === "function") {
            scrollPegasusActiveExerciseIntoView(0, { force: true, instant: true });
        }
        if (exercises.length === 0) {
            if (isPegasusWeekendDay && window.PegasusBrain?.renderWeekendModePanel) {
                ensurePegasusWeekendModeUi(day, list);
            } else {
                list.innerHTML = `<div style="padding:20px; color:#666; text-align:center;">🌿 Ημέρα Αποθεραπείας (History: ${day})</div>`;
            }
        } else if (isPegasusWeekendDay) {
            ensurePegasusWeekendModeUi(day, list);
        }
    }, 150);

    setTimeout(() => {
        if (pegasusSelectDayToken === window.__pegasusSelectDayToken) {
            window.__pegasusRenderingExerciseList = false;
        }
    }, 250);
}


function isPegasusExerciseAvailable(idx) {
    const ex = exercises[idx];
    return !!(
        ex
        && ex.classList
        && !ex.classList.contains("exercise-skipped")
        && ex.getAttribute("data-active") !== "false"
        && ex.style.display !== "none"
    );
}

/* ===== 5. WORKOUT ENGINE CORE (DYNAMIC TIMER PATCH) ===== */
function startPause() {
    if (exercises.length === 0) return;

    const vid = document.getElementById("video");
    const config = getPegasusTimerConfig();
    const isFreshStart = (currentIdx === 0 && phase === 0 && totalSeconds === remainingSeconds);

    if (!running) {
        let firstAvailable = remainingSets.findIndex((sets, idx) => sets > 0 && isPegasusExerciseAvailable(idx));
        if (isFreshStart) {
            if (firstAvailable !== -1) currentIdx = firstAvailable;
        } else if (exercises[currentIdx] && exercises[currentIdx].classList.contains("exercise-skipped")) {
            if (firstAvailable !== -1) currentIdx = firstAvailable;
        }
    }

    if (!running && isFreshStart) {
        sessionActiveKcal = 0;
        localStorage.setItem("pegasus_session_kcal", "0.0");
    }

    if (vid && vid.src.includes("warmup")) {
        vid.loop = false;
        vid.pause();
    }

    running = !running;
    renderPegasusControlState();

    syncPegasusProgressRuntime();
    dispatchPegasusWorkoutAction(running ? "WORKOUT_START_RUNTIME" : "WORKOUT_PAUSE_RUNTIME");
    if (typeof window.updateKcalUI === "function") window.updateKcalUI();

    if (running) {
        if (!isFreshStart) {
            const pausedPhase = phase;
            const pausedRemaining = (phaseRemainingSeconds !== null) ? phaseRemainingSeconds : getPhaseDefaultTime(pausedPhase);

            if (pausedPhase === 0) {
                const restorePrep = Math.max(0, config.prep - pausedRemaining);
                totalSeconds += restorePrep;
                remainingSeconds += restorePrep;
                phase = 0;
            } else if (pausedPhase === 1) {
                const restoreWorkToPrep = Math.max(0, config.prep + (config.work - pausedRemaining));
                totalSeconds += restoreWorkToPrep;
                remainingSeconds += restoreWorkToPrep;
                phase = 0;
            } else if (pausedPhase === 2) {
                const skippedRest = Math.max(0, pausedRemaining);
                totalSeconds = Math.max(0, totalSeconds - skippedRest);
                remainingSeconds = Math.max(0, remainingSeconds - skippedRest);

                let nextIdx = getNextIndexCircuit();
                if (nextIdx !== -1) currentIdx = nextIdx;
                phase = 0;
            }

            phaseRemainingSeconds = null;
            updateTotalBar();

            const barFill = document.getElementById("phaseTimerFill");
            if (barFill) barFill.style.width = "0%";

            syncPegasusProgressRuntime();
        } else {
            syncPegasusProgressRuntime();
        }

        runPhase();
    } else {
        clearInterval(timer);
        timer = null;
        if (vid) vid.pause();
        hidePegasusNextExercisePreview();
        syncPegasusProgressRuntime();
        if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") window.PegasusCloud.push();
    }
}

function runPhase() {
    if (!running) return;

    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    if (remainingSets.every(s => s <= 0)) {
        finishWorkout();
        return;
    }

    const e = exercises[currentIdx];
    if (!e) return;

    const weightInput = e.querySelector(".weight-input");
    if (!weightInput) return;

    const exName = weightInput.getAttribute("data-name") || "";
    let liftedWeight = parseFloat(weightInput.value) || 0;

    let baseMET = 3.5;
    let intensityMultiplier = 1.0;
    if (exName.toLowerCase().includes("cycling") || exName.toLowerCase().includes("ποδηλασία")) {
        baseMET = 8.0;
    } else if (liftedWeight > 0) {
        intensityMultiplier = 1 + (liftedWeight / 100);
    }

    let kcalPerMin = (baseMET * intensityMultiplier * userWeight * 3.5) / 200;
    let kcalPerSecond = kcalPerMin / 60;

    exercises.forEach(ex => {
        ex.style.borderColor = "#222";
        ex.style.background = "transparent";
    });
    e.style.borderColor = "#4CAF50";
    e.style.background = "rgba(76, 175, 80, 0.1)";

    if (typeof scrollPegasusActiveExerciseIntoView === "function") {
        requestAnimationFrame(() => scrollPegasusActiveExerciseIntoView(currentIdx));
    }

    const config = getPegasusTimerConfig();
    if (phase === 2 && (!Number.isFinite(config.rest) || config.rest <= 0)) {
        phase = 0;
        syncPegasusProgressRuntime();
        dispatchPegasusWorkoutAction("WORKOUT_NEXT_RUNTIME");
        runPhase();
        return;
    }

    const phaseDefaultTime = getPhaseDefaultTime(phase);
    let t = getPhaseStartingSeconds(phase, phaseRemainingSeconds);
    phaseRemainingSeconds = t;

    let pName = (phase === 0) ? "Προετοιμασία" : (phase === 1 ? "Άσκηση" : "Διάλειμμα");
    let cssClass = (phase === 0) ? "timer-prep" : (phase === 1 ? "timer-work" : "timer-rest");

    const label = document.getElementById("phaseTimer");
    const barFill = document.getElementById("phaseTimerFill");

    if (label) {
        label.textContent = `${pName} (${Math.max(0, Math.ceil(t))})`;
        label.className = "phase-label " + cssClass;
    }

    syncPegasusProgressRuntime();

    if (phase !== 2) {
        hidePegasusNextExercisePreview();
        showVideo(currentIdx);
    } else {
        updatePegasusNextExercisePreview();
    }

    timer = setInterval(() => {
        t -= 1;
        phaseRemainingSeconds = Math.max(0, t);

        if (remainingSeconds > 0) {
            remainingSeconds -= 1;
            updateTotalBar();
        }

        if (phase === 1) {
            sessionActiveKcal += (kcalPerSecond * SPEED);
        } else if (phase === 2) {
            let restKcalPerSec = ((2.0 * userWeight * 3.5) / 200) / 60;
            sessionActiveKcal += (restKcalPerSec * SPEED);
        }

        if (label) label.textContent = `${pName} (${Math.max(0, Math.ceil(t))})`;

        if (barFill) {
            const totalPhaseTime = phaseDefaultTime || 1;
            barFill.style.width = (((totalPhaseTime - Math.max(0, t)) / totalPhaseTime) * 100) + "%";
        }

        syncPegasusProgressRuntime();
        if (typeof window.updateKcalUI === "function") window.updateKcalUI();

        if (t <= 0) {
            clearInterval(timer);
            timer = null;
            phaseRemainingSeconds = null;
            playBeep();

            if (phase === 0) {
                phase = 1;
                phaseRemainingSeconds = getPhaseDefaultTime(1);
                syncPegasusProgressRuntime();
                dispatchPegasusWorkoutAction("WORKOUT_START_RUNTIME");
                runPhase();
            } else if (phase === 1) {
                let done = parseInt(e.dataset.done) || 0;
                done++;
                e.dataset.done = done;
                remainingSets[currentIdx] = Math.max(0, parseFloat(e.dataset.total) - done);
                e.querySelector(".set-counter").textContent = `${done}/${e.dataset.total}`;

                writePegasusExerciseDone(e, exName, currentIdx, done);

                if (window.updateAchievements) window.updateAchievements(exName);
                if (window.logPegasusSet) window.logPegasusSet(exName, done);
                if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") window.PegasusCloud.push();

                phase = 2;
                phaseRemainingSeconds = getPhaseDefaultTime(2);
                syncPegasusProgressRuntime();
                dispatchPegasusWorkoutAction("WORKOUT_SET_COMPLETED_RUNTIME", {
                    workout: { phase: 2 },
                    timers: { phaseRemainingSeconds: phaseRemainingSeconds }
                });
                runPhase();
            } else {
                let next = getNextIndexCircuit();
                if (next !== -1) {
                    currentIdx = next;
                    phase = 0;
                    phaseRemainingSeconds = getPhaseDefaultTime(0);
                    syncPegasusProgressRuntime();
                    dispatchPegasusWorkoutAction("WORKOUT_NEXT_RUNTIME", {
                        workout: { phase: 0, currentIdx: currentIdx },
                        timers: { phaseRemainingSeconds: phaseRemainingSeconds }
                    });
                    runPhase();
                } else {
                    finishWorkout();
                }
            }
        }
    }, 1000 / SPEED);
}

function skipToNextExercise() {
    if (exercises.length === 0) return;

    clearInterval(timer);
    timer = null;
    phaseRemainingSeconds = null;

    if (phase === 1 && running) {
        const currentExNode = exercises[currentIdx];
        const weightInput = currentExNode ? currentExNode.querySelector(".weight-input") : null;
        const exName = weightInput ? (weightInput.getAttribute("data-name") || "") : "";

        let done = parseInt(currentExNode.dataset.done) || 0;
        done++;
        currentExNode.dataset.done = done;
        remainingSets[currentIdx] = Math.max(0, parseFloat(currentExNode.dataset.total) - done);
        currentExNode.querySelector(".set-counter").textContent = `${done}/${currentExNode.dataset.total}`;

        writePegasusExerciseDone(currentExNode, exName, currentIdx, done);

        if (window.logPegasusSet) window.logPegasusSet(exName, done);
    }

    if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") window.PegasusCloud.push();

    let nextIdx = getNextIndexCircuit();
    if (nextIdx !== -1) {
        currentIdx = nextIdx;
        phase = 0;
        syncPegasusProgressRuntime();
        dispatchPegasusWorkoutAction("WORKOUT_NEXT_RUNTIME");
        if (running) runPhase();
        else {
            showVideo(currentIdx);
            if (typeof scrollPegasusActiveExerciseIntoView === "function") {
                requestAnimationFrame(() => scrollPegasusActiveExerciseIntoView(currentIdx, { force: true }));
            }
        }
    } else {
        finishWorkout();
    }
}

function getNextIndexCircuit() {
    for (let i = 1; i <= remainingSets.length; i++) {
        let idx = (currentIdx + i) % remainingSets.length;
        const remaining = syncPegasusRemainingSetFromNode(idx);
        if (remaining > 0 && isPegasusExerciseAvailable(idx)) return idx;
    }
    return -1;
}

window.toggleSkipExercise = function(idx, auto = false) {
    const exDiv = exercises[idx];
    if (!exDiv) return;

    const originalSets = parseFloat(exDiv.dataset.total);
    const isSkipped = exDiv.classList.toggle("exercise-skipped");
    let done = parseInt(exDiv.dataset.done) || 0;

    if (isSkipped) {
        exDiv.style.setProperty('opacity', '0.2', 'important');
        exDiv.style.setProperty('filter', 'grayscale(100%)', 'important');
        remainingSets[idx] = 0;

        if (currentIdx === idx) {
            phaseRemainingSeconds = null;
        }

        if (!auto && currentIdx === idx && running) {
            clearInterval(timer);
            timer = null;

            let nextIdx = getNextIndexCircuit();
            if (nextIdx !== -1) {
                currentIdx = nextIdx;
                phase = 0;
                syncPegasusProgressRuntime();
                runPhase();
            } else {
                finishWorkout();
            }
        }
    } else {
        exDiv.style.setProperty('opacity', '1', 'important');
        exDiv.style.setProperty('filter', 'none', 'important');
        remainingSets[idx] = Math.max(0, originalSets - done);
    }

    if (typeof scrollPegasusActiveExerciseIntoView === "function") {
        requestAnimationFrame(() => scrollPegasusActiveExerciseIntoView(currentIdx));
    }

    calculateTotalTime(true);
    syncPegasusProgressRuntime();
    if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") window.PegasusCloud.push();
};

window.getActiveLifter = function() {
    if (window.partnerData && window.partnerData.isActive && window.partnerData.currentPartner !== "") {
        return window.partnerData.currentPartner;
    }
    return "ΑΓΓΕΛΟΣ";
};

window.getSavedWeight = function(exerciseName) {
    const cleanName = exerciseName.trim();
    const lifter = window.getActiveLifter();
    let allWeights = JSON.parse(localStorage.getItem(M?.workout?.exerciseWeights || "pegasus_exercise_weights") || "{}");

    if (allWeights[lifter] && allWeights[lifter][cleanName] !== undefined) return allWeights[lifter][cleanName];

    if (lifter === "ΑΓΓΕΛΟΣ") {
        let old1 = localStorage.getItem(`weight_ΑΓΓΕΛΟΣ_${cleanName}`);
        let old2 = localStorage.getItem(`weight_${cleanName}`);
        if (old1) return old1;
        if (old2) return old2;
    }
    return "";
};

window.saveWeight = function(name, val) {
    const cleanName = name.trim();
    const lifter = window.getActiveLifter();
    let allWeights = JSON.parse(localStorage.getItem(M?.workout?.exerciseWeights || "pegasus_exercise_weights") || "{}");

    if (!allWeights[lifter]) allWeights[lifter] = {};
    allWeights[lifter][cleanName] = val;
    localStorage.setItem(M?.workout?.exerciseWeights || "pegasus_exercise_weights", JSON.stringify(allWeights));

    if (lifter === "ΑΓΓΕΛΟΣ") {
        localStorage.setItem(`weight_ΑΓΓΕΛΟΣ_${cleanName}`, val);
    }

    syncPegasusUserRuntime();

    if (window.MuscleProgressUI?.render) window.MuscleProgressUI.render();
    if (window.PegasusCloud?.push) window.PegasusCloud.push();
};


function getPegasusExerciseVideoSrcByIndex(index) {
    if (typeof exercises === 'undefined' || !exercises[index]) return null;

    const weightInput = exercises[index].querySelector(".weight-input");
    if (!weightInput) return null;

    const name = (weightInput.getAttribute("data-name") || "").trim();
    if (!name) return null;

    let mappedVal = window.videoMap ? window.videoMap[name] : null;
    if (!mappedVal) mappedVal = name.replace(/\s+/g, '').toLowerCase();

    return `videos/${mappedVal}.mp4`;
}

function getPegasusKnownMediaUrls() {
    const urls = new Set();
    const mapValues = window.videoMap ? Object.values(window.videoMap) : [];

    mapValues.forEach(value => {
        const clean = String(value || '').trim();
        if (!clean) return;
        urls.add(`videos/${clean}.mp4`);
        urls.add(`images/${clean}.png`);
        urls.add(`images/${clean}.jpg`);
        urls.add(`images/${clean}.webp`);
    });

    ['warmup', 'stretching', 'cycling'].forEach(name => {
        urls.add(`videos/${name}.mp4`);
        urls.add(`images/${name}.png`);
        urls.add(`images/${name}.jpg`);
        urls.add(`images/${name}.webp`);
    });

    urls.add('videos/beep.mp3');
    urls.add('images/favicon.png');
    urls.add('images/placeholder.jpg');

    return Array.from(urls);
}

window.PegasusPermanentStorage = window.PegasusPermanentStorage || (() => {
    let resolveReady;
    let rejectReady;
    let fallbackTimer = null;

    const readyPromise = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    const state = {
        version: '294',
        started: false,
        completed: false,
        percent: 0,
        done: 0,
        total: 0,
        ok: 0,
        skipped: 0,
        bytes: 0,
        readyPromise,
        readyKey: 'pegasus_permanent_assets_ready_v294',

        getReadyMarker() {
            try {
                const raw = localStorage.getItem(this.readyKey);
                if (!raw) return null;
                const marker = JSON.parse(raw);
                if (!marker || String(marker.version || '') !== this.version) return null;
                return marker;
            } catch (_) {
                return null;
            }
        },

        setLoader(percent, data = {}) {
            this.percent = Math.max(0, Math.min(100, Number(percent) || 0));
            this.done = data.done ?? this.done;
            this.total = data.total ?? this.total;
            this.ok = data.ok ?? this.ok;
            this.skipped = data.skipped ?? this.skipped;
            this.bytes = data.bytes ?? this.bytes;

            const loaderBar = document.querySelector('.loader-bar-fill');
            const loaderText = document.querySelector('.loader-text');
            const loaderBrand = document.querySelector('.loader-branding');

            if (loaderBar) loaderBar.style.width = `${this.percent}%`;
            if (loaderText) {
                loaderText.innerHTML = `Μόνιμη τοπική αποθήκευση<span class="dots"></span> ${this.percent}%`;
            }
            if (loaderBrand && this.total) {
                loaderBrand.textContent = `${this.done}/${this.total} αρχεία`;
            }
        },

        complete(data = {}) {
            if (this.completed) return;
            this.completed = true;
            this.setLoader(100, data);
            try {
                localStorage.setItem(this.readyKey, JSON.stringify({
                    version: this.version,
                    at: Date.now(),
                    done: this.done,
                    total: this.total,
                    ok: this.ok,
                    skipped: this.skipped,
                    bytes: this.bytes
                }));
            } catch (_) {}

            const loaderText = document.querySelector('.loader-text');
            if (loaderText) loaderText.innerHTML = `Τρέχει από τοπική αποθήκευση<span class="dots"></span> 100%`;

            resolveReady(true);
        },

        async fallbackCacheInPage(urls) {
            if (!('caches' in window)) return false;

            const staticUrls = [
                './', './index.html', './style.css', './manifest.js', './dialogs.js', './i18n.js', './data.js',
                './settings.js', './optimizer.js', './pegasusBrain.js', './dynamic.js', './progressUI.js', './weather.js',
                './backup.js', './inventoryHandler.js', './pegasusCore.js', './protcrea.js', './food.js',
                './foodRegistry.js', './slotRegistry.js', './dietAdvisor.js', './dietVariation.js', './extensions.js',
                './ems.js', './cardio.js', './calendar.js', './gallery.js', './partner.js', './achievements.js',
                './dragDrop.js', './reporting.js', './metabolicEngine.js', './weightTracker.js', './app.js', './debug.js',
                './auditUI.js', './aiHandler.js', './mobile/mobile.html',
                './mobile/style.css', './mobile/diet-mobile.js', './mobile/cardio-mobile.js', './mobile/profile-mobile.js',
                './mobile/car-mobile.js', './mobile/parking-mobile.js', './mobile/inventory-mobile.js', './mobile/ems-mobile.js',
                './mobile/supplies-mobile.js', './mobile/finance-mobile.js', './mobile/social-mobile.js', './mobile/movies-mobile.js',
                './mobile/youtube-mobile.js', './mobile/weather-mobile.js', './mobile/missions-mobile.js',
                './mobile/biometrics-mobile.js', './mobile/maintenance-mobile.js', './mobile/oracle-mobile.js', './mobile/lifting-mobile.js'
            ];

            const all = Array.from(new Set([...staticUrls, ...urls]));
            const cache = await caches.open('pegasus-permanent-local-v294-page-fallback');
            let done = 0;
            let ok = 0;
            let skipped = 0;

            for (const url of all) {
                try {
                    const request = new Request(url, { credentials: 'same-origin' });
                    const existing = await cache.match(request, { ignoreSearch: true });
                    if (!existing) {
                        const response = await fetch(request, { cache: 'reload' });
                        if (response && response.ok) await cache.put(request, response.clone());
                    }
                    ok++;
                } catch (_) {
                    skipped++;
                }
                done++;
                this.setLoader(Math.round((done / all.length) * 100), { done, total: all.length, ok, skipped });
            }

            this.complete({ done, total: all.length, ok, skipped });
            return true;
        },

        start() {
            if (this.started) return this.readyPromise;
            this.started = true;

            const readyMarker = this.getReadyMarker();
            if (readyMarker) {
                this.complete({
                    done: readyMarker.done || readyMarker.total || 0,
                    total: readyMarker.total || 0,
                    ok: readyMarker.ok || readyMarker.total || 0,
                    skipped: readyMarker.skipped || 0,
                    bytes: readyMarker.bytes || 0
                });
                return this.readyPromise;
            }

            this.setLoader(0, { done: 0, total: 0, ok: 0, skipped: 0 });

            const mediaUrls = getPegasusKnownMediaUrls();

            if (navigator.storage?.persist) {
                navigator.storage.persist().then(granted => {
                    console.log(`💾 PEGASUS LOCAL STORAGE PERSISTENCE: ${granted ? 'granted' : 'browser-managed'}`);
                }).catch(() => {});
            }

            const boot = async () => {
                try {
                    if (!('serviceWorker' in navigator)) {
                        await this.fallbackCacheInPage(mediaUrls);
                        return;
                    }

                    const swPath = window.location.pathname.includes('/mobile/') ? '../sw.js' : './sw.js';
                    await navigator.serviceWorker.register(`${swPath}?v=3.36.294`);
                    const registration = await navigator.serviceWorker.ready;
                    const target = navigator.serviceWorker.controller || registration.active || registration.waiting || registration.installing;

                    if (!target) {
                        await this.fallbackCacheInPage(mediaUrls);
                        return;
                    }

                    // Safety valve: if the browser drops a SW message, do not leave PEGASUS locked forever.
                    fallbackTimer = setTimeout(() => {
                        if (!this.completed) {
                            console.warn('💾 PEGASUS LOCAL STORAGE: progress bridge timeout, releasing loader with current cache state.');
                            this.complete({ done: this.done, total: this.total || mediaUrls.length, ok: this.ok, skipped: this.skipped });
                        }
                    }, 180000);

                    target.postMessage({
                        type: 'PEGASUS_PERMANENT_CACHE_ALL',
                        mediaUrls
                    });

                    console.log(`💾 PEGASUS PERMANENT LOCAL STORAGE: downloading ${mediaUrls.length} media assets plus system files.`);
                } catch (err) {
                    console.warn('💾 PEGASUS LOCAL STORAGE: service worker path failed, using page fallback.', err);
                    await this.fallbackCacheInPage(mediaUrls);
                }
            };

            boot().catch(err => {
                console.warn('💾 PEGASUS LOCAL STORAGE: boot failed.', err);
                rejectReady(err);
            });

            return this.readyPromise;
        }
    };

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', event => {
            const data = event.data || {};

            if (data.type === 'PEGASUS_PERMANENT_CACHE_PROGRESS' || data.type === 'CACHE_PROGRESS') {
                state.setLoader(data.percent || 0, data);
            }

            if (data.type === 'PEGASUS_PERMANENT_CACHE_COMPLETE') {
                if (fallbackTimer) clearTimeout(fallbackTimer);
                state.complete(data);
            }
        });
    }

    return state;
})();

window.PegasusVideoPreloader = window.PegasusVideoPreloader || {
    loaded: new Set(),
    pending: new Set(),
    preload(src) {
        const cleanSrc = normalizePegasusVideoSrc(src) || src;
        if (!cleanSrc || this.loaded.has(cleanSrc) || this.pending.has(cleanSrc)) return Promise.resolve(true);
        this.pending.add(cleanSrc);

        const finish = (ok) => {
            this.pending.delete(cleanSrc);
            if (ok) this.loaded.add(cleanSrc);
            return ok;
        };

        // PEGASUS 225: no per-video cache queue and no READY/WAIT storm.
        // Videos are downloaded once by the permanent boot storage pipeline.
        if ('caches' in window) {
            return caches.match(cleanSrc, { ignoreSearch: true })
                .then(cached => finish(!!cached))
                .catch(() => finish(false));
        }

        return Promise.resolve(finish(false));
    }
};

window.PegasusBackgroundAssets = window.PegasusBackgroundAssets || {
    start() {
        return window.PegasusPermanentStorage?.start ? window.PegasusPermanentStorage.start() : Promise.resolve(true);
    }
};

function preloadPegasusAdjacentVideos(index) {
    if (!window.PegasusVideoPreloader) return;
    const currentSrc = getPegasusExerciseVideoSrcByIndex(index);
    const nextSrc = getPegasusExerciseVideoSrcByIndex(index + 1);
    if (currentSrc) window.PegasusVideoPreloader.preload(currentSrc);
    if (nextSrc) window.PegasusVideoPreloader.preload(nextSrc);
}

function normalizePegasusVideoSrc(src) {
    const raw = String(src || '').trim();
    if (!raw) return '';
    try {
        const url = new URL(raw, window.location.href);
        return `${url.pathname.replace(/^\//, '')}`.replace(/^seemsfunny\//, '') || raw;
    } catch (e) {
        return raw.split('?')[0];
    }
}

window.PegasusVideoWaiter = window.PegasusVideoWaiter || {
    timers: new Map(),
    attempts: new Map(),
    lastErrorAt: new Map(),
    loadingSince: new Map(),
    targets: new Map(),
    lastReadyAt: new Map(),
    ready: new Set()
};

function stopPegasusVideoWaiter(cleanSrc, vid, label, logReady = false) {
    const timer = window.PegasusVideoWaiter.timers.get(cleanSrc);
    if (timer) clearInterval(timer);
    window.PegasusVideoWaiter.timers.delete(cleanSrc);
    window.PegasusVideoWaiter.attempts.delete(cleanSrc);
    window.PegasusVideoWaiter.loadingSince.delete(cleanSrc);
    window.PegasusVideoWaiter.targets.delete(cleanSrc);
    if (logReady) {
        window.PegasusVideoWaiter.ready.add(cleanSrc);
        window.PegasusVideoWaiter.lastReadyAt.set(cleanSrc, Date.now());
    }
    if (vid && vid.dataset.pegasusWaitingFor === cleanSrc) delete vid.dataset.pegasusWaitingFor;
    if (vid && vid.dataset.pegasusLoadingCandidate === cleanSrc) delete vid.dataset.pegasusLoadingCandidate;
    if (label) label.style.color = '';
    if (logReady) console.log(`✅ PEGASUS VIDEO READY: ${cleanSrc}`);
}

function markPegasusVideoActuallyReady(src, vid, label) {
    const cleanSrc = normalizePegasusVideoSrc(src || vid?.getAttribute?.('src') || '');
    if (!cleanSrc || !vid) return;

    // A 200/206 fetch only means the file exists. The video becomes "ready" only
    // when the actual <video> element has decoded metadata/canplay without error.
    if (vid.error || vid.readyState < 1) return;

    const wasWaiting =
        window.PegasusVideoWaiter.timers.has(cleanSrc) ||
        vid?.dataset?.pegasusWaitingFor === cleanSrc ||
        vid?.dataset?.pegasusLoadingCandidate === cleanSrc;
    stopPegasusVideoWaiter(cleanSrc, vid, label, wasWaiting);
}

function attachPegasusVideoReadyHandlers(cleanSrc, vid, label) {
    if (!vid || !cleanSrc) return;
    const onReady = () => markPegasusVideoActuallyReady(cleanSrc, vid, label);
    vid.addEventListener('loadedmetadata', onReady, { once: true });
    vid.addEventListener('canplay', onReady, { once: true });
}

function loadPegasusVideoCandidate(cleanSrc, vid, label, reason = 'retry') {
    if (!cleanSrc || !vid) return;

    vid.dataset.pegasusLoadingCandidate = cleanSrc;
    window.PegasusVideoWaiter.loadingSince.set(cleanSrc, Date.now());
    window.PegasusVideoWaiter.targets.set(cleanSrc, { vid, label });
    attachPegasusVideoReadyHandlers(cleanSrc, vid, label);

    if (label) {
        label.textContent = 'Φορτώνει το σωστό βίντεο...';
        label.style.color = '#ff9800';
    }

    try { vid.pause(); } catch (_) {}
    vid.preload = 'auto';
    if (normalizePegasusVideoSrc(vid.getAttribute('src') || '') !== cleanSrc || reason === 'cache-ready') {
        vid.src = cleanSrc;
    }
    vid.load();
    vid.play().catch(() => {});
}

// PEGASUS 225: the old per-video cache-ready bridge has been removed.
// Full project/media storage is handled once at boot by PegasusPermanentStorage.

function waitForPegasusVideo(src, vid, label) {
    const cleanSrc = normalizePegasusVideoSrc(src);
    if (!cleanSrc || !vid) return;

    if (window.PegasusVideoWaiter.timers.has(cleanSrc)) return;

    vid.dataset.pegasusWaitingFor = cleanSrc;
    window.PegasusVideoWaiter.targets.set(cleanSrc, { vid, label });

    const tryLoad = async () => {
        if (vid.dataset.pegasusWaitingFor !== cleanSrc) {
            stopPegasusVideoWaiter(cleanSrc, vid, label, false);
            return;
        }

        const attempts = (window.PegasusVideoWaiter.attempts.get(cleanSrc) || 0) + 1;
        window.PegasusVideoWaiter.attempts.set(cleanSrc, attempts);

        if (label) {
            label.textContent = `Αναμονή τοπικού βίντεο... (${attempts})`;
            label.style.color = '#ff9800';
        }

        // PEGASUS 225: do not spam network probes and do not swap to warmup.
        // The permanent storage pipeline owns all downloads; this loop only
        // reconnects the requested video when it appears in local Cache Storage.
        let cached = null;
        try {
            if ('caches' in window) cached = await caches.match(cleanSrc, { ignoreSearch: true });
        } catch (_) {}

        if (cached || window.PegasusPermanentStorage?.completed) {
            const now = Date.now();
            const loadingSince = window.PegasusVideoWaiter.loadingSince.get(cleanSrc) || 0;
            if (vid.dataset.pegasusLoadingCandidate === cleanSrc && now - loadingSince < 12000) return;
            loadPegasusVideoCandidate(cleanSrc, vid, label, cached ? 'local-cache-ready' : 'storage-complete');
        }
    };

    vid.pause();
    vid.removeAttribute('src');
    vid.load();
    tryLoad();
    window.PegasusVideoWaiter.timers.set(cleanSrc, setInterval(tryLoad, 15000));
}


/* ===== PEGASUS 300: Next exercise preview during rest ===== */
function getPegasusExerciseVideoInfo(i) {
    const ex = (typeof exercises !== 'undefined') ? exercises[i] : null;
    if (!ex) return null;
    const weightInput = ex.querySelector(".weight-input");
    if (!weightInput) return null;

    const name = weightInput.getAttribute("data-name") || "";
    let mappedVal = window.videoMap ? window.videoMap[name.trim()] : null;
    if (!mappedVal) mappedVal = name.replace(/\s+/g, '').toLowerCase();

    return {
        index: i,
        name: name,
        src: `videos/${mappedVal}.mp4`
    };
}

function ensurePegasusNextExercisePreview() {
    let box = document.getElementById("nextExerciseVideoBox");
    if (!box) {
        const host = document.querySelector(".video-container");
        if (!host) return null;
        box = document.createElement("div");
        box.id = "nextExerciseVideoBox";
        box.className = "next-exercise-video-box";
        box.style.display = "none";
        box.innerHTML = `
            <div class="next-exercise-video-title" id="nextExerciseVideoTitle">Επόμενη</div>
            <video id="nextExerciseVideo" muted loop playsinline preload="metadata"></video>
        `;
        host.appendChild(box);
    }

    const vid = document.getElementById("nextExerciseVideo");
    const title = document.getElementById("nextExerciseVideoTitle");
    return { box, vid, title };
}

function hidePegasusNextExercisePreview() {
    const ui = ensurePegasusNextExercisePreview();
    if (!ui) return;
    ui.box.style.display = "none";
    ui.box.classList.remove("next-video-missing");
    if (ui.vid) {
        ui.vid.pause();
        delete ui.vid.dataset.nextExerciseSrc;
    }
}

function updatePegasusNextExercisePreview() {
    const ui = ensurePegasusNextExercisePreview();
    if (!ui || !ui.vid) return;

    if (phase !== 2 || !running) {
        hidePegasusNextExercisePreview();
        return;
    }

    const nextIdx = (typeof getNextIndexCircuit === "function") ? getNextIndexCircuit() : -1;
    if (nextIdx === -1) {
        hidePegasusNextExercisePreview();
        return;
    }

    const info = getPegasusExerciseVideoInfo(nextIdx);
    if (!info || !info.src) {
        hidePegasusNextExercisePreview();
        return;
    }

    ui.box.style.display = "block";
    ui.box.classList.remove("next-video-missing");
    if (ui.title) ui.title.textContent = `Επόμενη: ${info.name}`;

    if (ui.vid.dataset.nextExerciseSrc !== info.src) {
        ui.vid.dataset.nextExerciseSrc = info.src;
        ui.vid.onerror = () => {
            ui.box.classList.add("next-video-missing");
            if (ui.title) ui.title.textContent = `Επόμενη: ${info.name}`;
        };
        ui.vid.pause();
        ui.vid.src = info.src;
        ui.vid.load();
        if (window.PegasusVideoPreloader) window.PegasusVideoPreloader.preload(info.src);
    }

    ui.vid.play().catch(() => {});
}

function showVideo(i) {
    const vid = document.getElementById("video");
    const label = document.getElementById("phaseTimer");
    if (!vid) return;

    // PEGASUS 225: if the correct video is missing/slow, never substitute warmup
    // or another exercise. Wait for the requested local video only.
    if (!vid.dataset.pegasusVideoErrorGuard) {
        vid.dataset.pegasusVideoErrorGuard = "1";
        vid.onerror = function() {
            const currentSrc = vid.getAttribute('src') || '';
            const cleanSrc = normalizePegasusVideoSrc(currentSrc);
            if (!cleanSrc) return;

            const now = Date.now();
            const alreadyWaiting =
                vid.dataset.pegasusWaitingFor === cleanSrc ||
                window.PegasusVideoWaiter?.timers?.has(cleanSrc);

            if (!alreadyWaiting) {
                const lastErrorAt = window.PegasusVideoWaiter?.lastErrorAt?.get(cleanSrc) || 0;
                if (now - lastErrorAt > 30000) {
                    console.warn(`🎬 PEGASUS VIDEO LOCAL WAIT: ${cleanSrc} is not ready locally yet.`);
                    window.PegasusVideoWaiter?.lastErrorAt?.set(cleanSrc, now);
                }
            }

            if (label) {
                label.textContent = 'Αναμονή βίντεο...';
                label.style.color = '#ff9800';
            }

            // PEGASUS 225: when a retry loop is already active, do not recursively
            // create new loops or spam the console. The permanent local storage
            // pipeline will make the requested video available when it is ready.
            if (alreadyWaiting) return;
            waitForPegasusVideo(cleanSrc, vid, label);
        };
    }

    const activeBtn = document.querySelector(".navbar button.active");
    const currentDay = activeBtn ? activeBtn.id.replace('nav-', '') : "";
    const isRecoveryDay = (currentDay === "Δευτέρα" || currentDay === "Πέμπτη");

    if (isRecoveryDay || typeof exercises === 'undefined' || !exercises[i]) {
        const recoverySrc = "videos/stretching.mp4";
        if (vid.getAttribute('src') !== recoverySrc) {
            delete vid.dataset.pegasusWaitingFor;
            vid.pause();
            vid.src = recoverySrc;
            vid.load();
            if (window.PegasusVideoPreloader) window.PegasusVideoPreloader.preload(recoverySrc);
            vid.play().catch(e => console.log("Waiting for user..."));
            if (label && isRecoveryDay) {
                label.textContent = "Αποθεραπεία: stretching";
                label.style.color = "#00bcd4";
            }
        }
        return;
    }

    const weightInput = exercises[i].querySelector(".weight-input");
    if (!weightInput) return;

    let name = weightInput.getAttribute("data-name") || "";
    let mappedVal = window.videoMap ? window.videoMap[name.trim()] : null;
    if (!mappedVal) mappedVal = name.replace(/\s+/g, '').toLowerCase();

    const newSrc = `videos/${mappedVal}.mp4`;
    if (vid.getAttribute('src') !== newSrc) {
        const oldCleanSrc = normalizePegasusVideoSrc(vid.getAttribute('src') || '');
        if (oldCleanSrc && oldCleanSrc !== newSrc) stopPegasusVideoWaiter(oldCleanSrc, vid, label, false);
        delete vid.dataset.pegasusWaitingFor;
        vid.pause();
        vid.src = newSrc;
        vid.load();
        if (window.PegasusVideoPreloader) window.PegasusVideoPreloader.preload(newSrc);
        preloadPegasusAdjacentVideos(i);
        attachPegasusVideoReadyHandlers(newSrc, vid, label);
        vid.play().catch(() => {
            // PEGASUS 225: autoplay/user-gesture failures must not swap to warmup
            // and must not start a retry loop. The selected exercise video stays selected.
        });
    } else {
        preloadPegasusAdjacentVideos(i);
    }

    if (running && vid.paused) {
        // PEGASUS 145: Pause/Resume video recovery.
        // When resuming the same exercise, src does not change, so the old
        // showVideo branch skipped play() and the video stayed frozen.
        vid.play().catch(() => {});
    }
}

window.showVideo = showVideo;

function calculateTotalTime(isUpdate = false) {
    const config = getPegasusTimerConfig();
    let newTotal = exercises.reduce((acc, ex) => {
        if (ex.classList.contains("exercise-skipped")) return acc;
        let sets = parseFloat(ex.dataset.total) || 0;
        return acc + (sets * (config.prep + config.work + config.rest));
    }, 0);

    if (isUpdate) {
        let diff = totalSeconds - newTotal;
        totalSeconds = newTotal;
        remainingSeconds = Math.max(0, remainingSeconds - diff);
    } else {
        totalSeconds = newTotal;
        remainingSeconds = newTotal;
    }

    const timeDisplay = document.getElementById("totalProgressTime");
    if (timeDisplay) {
        const m = Math.floor(remainingSeconds / 60);
        const s = remainingSeconds % 60;
        timeDisplay.textContent = `${m}:${String(s).padStart(2, '0')}`;
    }

    syncPegasusProgressRuntime();
    updateTotalBar();
}

function updateTotalBar() {
    const bar = document.getElementById("totalProgress");
    const timeText = document.getElementById("totalProgressTime");
    const uiState = (typeof window.getPegasusUiState === "function")
        ? window.getPegasusUiState()
        : null;
    const timerDisplay = uiState?.timerDisplay || ((typeof window.getPegasusTimerDisplayState === "function")
        ? window.getPegasusTimerDisplayState()
        : { totalSeconds, remainingSeconds, progressPercent: 0, remainingText: "0:00" });

    const safeTotalSeconds = (typeof timerDisplay?.totalSeconds === "number" && timerDisplay.totalSeconds > 0) ? timerDisplay.totalSeconds : totalSeconds;
    const safeRemainingSeconds = (typeof timerDisplay?.remainingSeconds === "number") ? timerDisplay.remainingSeconds : remainingSeconds;
    if (!bar || safeTotalSeconds <= 0) return;

    const progress = typeof timerDisplay?.progressPercent === "number"
        ? timerDisplay.progressPercent
        : (((safeTotalSeconds - safeRemainingSeconds) / safeTotalSeconds) * 100);

    bar.style.width = Math.max(0, Math.min(100, progress)) + "%";

    if (timeText) {
        timeText.textContent = timerDisplay?.remainingText || `${Math.floor(safeRemainingSeconds / 60)}:${String(Math.floor(safeRemainingSeconds % 60)).padStart(2, "0")}`;
    }
}

/* ===== 7.5 STRICT METABOLIC AUTO-ADJUSTER (MULTI-PLAN) ===== */
window._isCalculatingTarget = false;

window.calculatePegasusDailyTarget = function() {
    const storedEffective = window.getPegasusEffectiveDailyTarget
        ? window.getPegasusEffectiveDailyTarget()
        : parseFloat(localStorage.getItem(M?.diet?.todayKcal || 'pegasus_today_kcal')) || 2100;

    if (window._isCalculatingTarget) {
        return storedEffective;
    }

    window._isCalculatingTarget = true;

    const settings = typeof window.getPegasusSettings === "function"
        ? window.getPegasusSettings()
        : { activeSplit: 'IRON' };

    const dynamicProtein = window.calculatePegasusBioMetrics(settings);
    const baseTarget = window.getPegasusBaseDailyTarget(settings);
    const cardioOffset = window.getPegasusTodayCardioOffset();
    const workoutBurn = (typeof window.getPegasusTodayWorkoutKcal === "function") ? window.getPegasusTodayWorkoutKcal() : 0;
    const exerciseBurn = (typeof window.getPegasusTodayExerciseBurn === "function") ? window.getPegasusTodayExerciseBurn() : cardioOffset;
    const effectiveTarget = window.getPegasusFinalDailyTargetFromBurn(baseTarget, exerciseBurn, settings);

    localStorage.setItem(M?.diet?.todayKcal || 'pegasus_today_kcal', baseTarget);
    localStorage.setItem('pegasus_effective_today_kcal', String(effectiveTarget));

    const modeLabel = window.getPegasusBodyGoalLabel ? window.getPegasusBodyGoalLabel(settings.bodyGoalMode) : (settings.bodyGoalMode || 'cut');
    const refeed = window.getPegasusExerciseRefeedForTarget ? window.getPegasusExerciseRefeedForTarget(exerciseBurn, settings) : exerciseBurn;
    console.log(`🏛️ PEGASUS OS [${settings.activeSplit || 'IRON'} / ${modeLabel}]: Στόχος Βάσης: ${baseTarget} kcal | Προπόνηση: +${workoutBurn} | Ποδηλασία: +${cardioOffset} | Καύσεις: +${exerciseBurn} | Αναπλήρωση στόχου: +${refeed} | Τελικός Στόχος: ${effectiveTarget} kcal | Πρωτεΐνη: ${dynamicProtein}g`);

    window._isCalculatingTarget = false;
    return effectiveTarget;
};

/* ===== 7.6 AUTOMATED BIO-METRIC CALCULATOR ===== */
window.calculatePegasusBioMetrics = function(settingsObj) {
    const currentSettings = settingsObj || (typeof window.getPegasusSettings === "function" ? window.getPegasusSettings() : null);

    const weight = currentSettings ? currentSettings.weight : 74;
    const multiplier = 2.17;
    const autoProtein = Math.round(weight * multiplier);

    localStorage.setItem(M?.diet?.todayProtein || 'pegasus_today_protein', autoProtein);

    return autoProtein;
};

/* ===== 8. FINISH & REPORTING ===== */
function finishWorkout() {
    if (!running && !timer && phase === 0) return;

    clearInterval(timer);
    timer = null;
    running = false;
    hidePegasusNextExercisePreview();
    phaseRemainingSeconds = null;
    remainingSeconds = 0;
    updateTotalBar();
    syncPegasusProgressRuntime();
    dispatchPegasusWorkoutAction("WORKOUT_FINISH_RUNTIME", { workout: { running: false }, timers: { remainingSeconds: 0, phaseRemainingSeconds: null } });

    const label = document.getElementById("phaseTimer");
    if (label) {
        label.textContent = "Ολοκλήρωση & τοπική αποθήκευση...";
        label.style.color = "#4CAF50";
    }

    const workoutKey = window.getPegasusLocalDateKey();

    let doneKey = P_M?.workout?.done || "pegasus_workouts_done";
    let data = JSON.parse(localStorage.getItem(doneKey) || "{}");
    data[workoutKey] = true;
    localStorage.setItem(doneKey, JSON.stringify(data));

    if (window.updateTotalWorkoutCount) window.updateTotalWorkoutCount();
    if (window.PegasusCloud?.push) window.PegasusCloud.push();
    if (typeof openExercisePreview === 'function') openExercisePreview();

    setTimeout(() => {
        if (window.PegasusReporting?.prepareAndSaveReport) {
            let sessionKcal = sessionActiveKcal;
            let currentWeekly = parseFloat(localStorage.getItem("pegasus_weekly_kcal")) || 0;
            localStorage.setItem("pegasus_weekly_kcal", (currentWeekly + sessionKcal).toFixed(1));
            if (typeof window.recordPegasusWorkoutBurn === "function") {
                window.recordPegasusWorkoutBurn(sessionKcal);
            }

            window.PegasusReporting.prepareAndSaveReport(sessionKcal.toFixed(1));
            sessionActiveKcal = 0;
            localStorage.setItem("pegasus_session_kcal", "0.0");
            syncPegasusProgressRuntime();
        }

        const list = document.getElementById("exList");
        if (list) {
            list.innerHTML = `<div style="padding:20px; color:#4CAF50; text-align:center; font-weight:bold; font-size:16px;">✅ Η προπόνηση ολοκληρώθηκε επιτυχώς</div>`;
        }

        const vid = document.getElementById("video");
        if (vid) {
            vid.pause();
            vid.src = "videos/stretching.mp4";
            vid.load();
            vid.play().catch(() => console.log("Auto-play prevented"));
        }

        renderPegasusControlState();
        if (label) {
            label.textContent = "Αποθεραπεία: stretching";
            label.style.color = "#00bcd4";
        }

        if (window.MuscleProgressUI?.render) window.MuscleProgressUI.render(true);
        if (typeof window.updateFoodUI === "function") window.updateFoodUI();
        if (typeof window.updateKcalUI === "function") window.updateKcalUI();

        console.log("🎯 PEGASUS OS: Session Successfully Terminated.");
    }, 3000);
}

function openExercisePreview() {
    const activeBtn = document.querySelector(".navbar button.active");
    if (!activeBtn) { if (window.pegasusAlert) window.pegasusAlert("Παρακαλώ επίλεξε πρώτα μια ημέρα!"); else alert("Παρακαλώ επίλεξε πρώτα μια ημέρα!"); return; }

    const currentDay = activeBtn.id.replace('nav-', '');
    const isRainy = (typeof window.isRaining === 'function') ? window.isRaining() : false;

    let rawData = window.PegasusBrain?.getDailyWorkout
        ? window.PegasusBrain.getDailyWorkout(currentDay, {
            isRainy,
            fallback: ((window.program && window.program[currentDay]) ? [...window.program[currentDay]] : [])
        })
        : ((typeof window.calculateDailyProgram !== 'undefined')
            ? window.calculateDailyProgram(currentDay, isRainy)
            : ((window.program && window.program[currentDay]) ? [...window.program[currentDay]] : []));

    // PEGASUS 183: Preview mirrors the dynamic weekly brain plan.

    const dayExercises = window.PegasusOptimizer
        ? window.PegasusOptimizer.apply(currentDay, rawData)
        : rawData.map(e => ({ ...e, adjustedSets: e.sets }));

    if (dayExercises.some(e => typeof e.brainOrder === "number")) {
        dayExercises.sort((a, b) => (a.brainOrder ?? 999) - (b.brainOrder ?? 999));
    }

    const panel = document.getElementById('previewPanel');
    const content = document.getElementById('previewContent');
    const muscleContainer = document.getElementById('muscleProgressContainer');

    if (!panel || !content) return;

    panel.style.display = 'block';
    content.innerHTML = '';
    if (muscleContainer) muscleContainer.innerHTML = '';

    dayExercises.filter(ex => (ex.adjustedSets || ex.sets) > 0).forEach((ex) => {
        const cleanName = ex.name.trim();
        let imgBase = window.videoMap ? window.videoMap[cleanName] : null;
        if (!imgBase) imgBase = cleanName.replace(/\s+/g, '').toLowerCase();

        const imgPath = (imgBase === "cycling") ? `images/${imgBase}.jpg` : `images/${imgBase}.png`;
        content.innerHTML += `
            <div class="preview-item">
                <img src="${imgPath}" onerror="this.onerror=null; this.src='images/placeholder.jpg';" alt="${cleanName}">
                <p>${cleanName} (${ex.adjustedSets || ex.sets} set)</p>
                <div class="exercise-muscle-badge preview-muscle-badge">${window.formatPegasusMuscleBadge(ex.muscleGroup || window.resolvePegasusExerciseGroup(cleanName))}</div>
            </div>
        `;
    });

    if (typeof window.forcePegasusRender === "function") {
        setTimeout(() => window.forcePegasusRender(), 50);
    }
}

window.openExercisePreview = openExercisePreview;

/* ===== 10. TRACKING ===== */
window.logPegasusSet = function(exName, absoluteDone = null) {
    const strictGroups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];
    const historyKey = P_M?.workout?.weekly_history || 'pegasus_weekly_history';
    const ledgerKey = 'pegasus_weekly_history_counted_v2';
    const weekKeyName = 'pegasus_weekly_history_week_key';

    const safeRead = (key, fallback) => {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || 'null');
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    };

    const getWeekKey = () => {
        const d = new Date();
        const start = new Date(d);
        const daysSinceSaturday = (d.getDay() + 1) % 7;
        start.setHours(6, 0, 0, 0);
        start.setDate(d.getDate() - daysSinceSaturday);
        if (d.getDay() === 6 && d.getTime() < start.getTime()) start.setDate(start.getDate() - 7);
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    };

    const normalizeName = value => String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\u0370-\u03ff]+/g, '');

    const emptyHistory = () => ({
        "Στήθος": 0,
        "Πλάτη": 0,
        "Πόδια": 0,
        "Χέρια": 0,
        "Ώμοι": 0,
        "Κορμός": 0
    });

    const cleanName = String(exName || '').trim();
    if (!cleanName) return false;

    let muscle = window.resolvePegasusExerciseGroup ? window.resolvePegasusExerciseGroup(cleanName) : (
        window.exercisesDB?.find(ex => String(ex.name || '').trim() === cleanName)?.muscleGroup || 'Άλλο'
    );

    const upperName = cleanName.toUpperCase();
    let perSetValue = 1;

    if (upperName.includes('Ποδηλασία') || upperName.includes('CYCLING')) {
        muscle = 'Πόδια';
        perSetValue = 24;
    } else if (upperName.includes('EMS ποδιών') || upperName.includes('EMS LEGS')) {
        muscle = 'Πόδια';
        perSetValue = 6;
    } else if (upperName.includes('STRETCHING') || muscle === 'None') {
        return false;
    }

    if (!strictGroups.includes(muscle)) {
        console.warn('⚠️ PEGASUS WEEKLY HISTORY: Unknown muscle group, set not counted:', cleanName);
        return false;
    }

    const todayKey = window.getPegasusLocalDateKey ? window.getPegasusLocalDateKey() : new Date().toISOString().slice(0, 10);
    const weekKey = getWeekKey();
    const rawHistory = safeRead(historyKey, emptyHistory());
    const history = emptyHistory();
    strictGroups.forEach(group => {
        const value = Number(rawHistory?.[group]);
        history[group] = Number.isFinite(value) ? Math.max(0, value) : 0;
    });

    let ledger = safeRead(ledgerKey, { weekKey, exercises: {} });
    if (!ledger || ledger.weekKey !== weekKey || typeof ledger.exercises !== 'object') {
        ledger = { weekKey, exercises: {}, initializedAt: Date.now() };
    }

    const ledgerExerciseKey = `${todayKey}|${normalizeName(cleanName)}`;
    const previousCounted = Math.max(0, Number(ledger.exercises[ledgerExerciseKey]) || 0);
    const nextCounted = Number.isFinite(Number(absoluteDone)) && Number(absoluteDone) >= 0
        ? Math.max(0, Number(absoluteDone))
        : previousCounted + 1;
    const deltaSets = Math.max(0, nextCounted - previousCounted);

    if (deltaSets <= 0) {
        return false;
    }

    const target = parseFloat((window.PegasusOptimizer?.getTargets?.() || JSON.parse(localStorage.getItem(P_M?.workout?.muscleTargets || 'pegasus_muscle_targets') || '{}'))?.[muscle]) || Infinity;
    const addValue = muscle === 'Πόδια' ? Math.max(0, Math.min(deltaSets * perSetValue, target - (Number(history[muscle]) || 0))) : deltaSets * perSetValue;
    if (addValue <= 0) {
        ledger.exercises[ledgerExerciseKey] = nextCounted;
        localStorage.setItem(ledgerKey, JSON.stringify(ledger));
        return false;
    }

    if (window.PegasusBrain?.recordWeekendCarryover) {
        try { window.PegasusBrain.recordWeekendCarryover(cleanName, muscle, addValue, todayKey); } catch (e) { console.warn("⚠️ PEGASUS BRAIN: carry-over logging skipped.", e); }
    }

    history[muscle] = Math.max(0, Number(history[muscle] || 0)) + addValue;
    localStorage.setItem(historyKey, JSON.stringify(history));
    localStorage.setItem(weekKeyName, weekKey);

    ledger.exercises[ledgerExerciseKey] = nextCounted;
    ledger.updatedAt = Date.now();
    localStorage.setItem(ledgerKey, JSON.stringify(ledger));

    window.dispatchEvent(new CustomEvent('pegasus_weekly_history_updated', {
        detail: { exercise: cleanName, muscle, value: addValue, deltaSets, history: { ...history } }
    }));

    if (window.MuscleProgressUI?.render) setTimeout(() => window.MuscleProgressUI.render(true), 50);
    return true;
};


/* ===== PEGASUS WEEKLY PROGRESS COMPAT ===== */
(function installPegasusWeeklyProgressCompat() {
    if (window.PegasusWeeklyProgress?.installed) return;

    const groups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];
    const historyKey = () => window.PegasusManifest?.workout?.weekly_history || "pegasus_weekly_history";
    const ledgerKey = "pegasus_weekly_history_counted_v2";

    const normalize = value => String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\u0370-\u03ff]+/g, "");

    const empty = () => ({ "Στήθος": 0, "Πλάτη": 0, "Πόδια": 0, "Χέρια": 0, "Ώμοι": 0, "Κορμός": 0 });

    function safeObject(key, fallback) {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || "null");
            return parsed && typeof parsed === "object" ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function weekKey() {
        const d = new Date();
        const start = new Date(d);
        const daysSinceSaturday = (d.getDay() + 1) % 7;
        start.setHours(6, 0, 0, 0);
        start.setDate(d.getDate() - daysSinceSaturday);
        if (d.getDay() === 6 && d.getTime() < start.getTime()) start.setDate(start.getDate() - 7);
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    }

    function todayKey() {
        if (typeof window.getPegasusLocalDateKey === "function") return window.getPegasusLocalDateKey();
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function readHistory() {
        const raw = safeObject(historyKey(), {});
        const out = empty();
        groups.forEach(group => {
            const value = Number(raw?.[group]);
            out[group] = Number.isFinite(value) ? Math.max(0, value) : 0;
        });
        return out;
    }

    function writeHistory(history) {
        const out = empty();
        groups.forEach(group => {
            const value = Number(history?.[group]);
            out[group] = Number.isFinite(value) ? Math.max(0, value) : 0;
        });
        localStorage.setItem(historyKey(), JSON.stringify(out));
        localStorage.setItem("pegasus_weekly_history_week_key", weekKey());
        return out;
    }

    function readTargets() {
        const fallback = { "Στήθος": 16, "Πλάτη": 20, "Πόδια": 8, "Χέρια": 17, "Ώμοι": 3, "Κορμός": 10 };
        try {
            const dynamic = window.PegasusOptimizer?.getTargets?.();
            return dynamic && typeof dynamic === "object" ? { ...fallback, ...dynamic } : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function resolveGroup(name) {
        if (typeof window.resolvePegasusExerciseGroup === "function") {
            const resolved = window.resolvePegasusExerciseGroup(name);
            if (groups.includes(resolved)) return resolved;
        }
        const clean = normalize(name);
        const aliases = [
            { group: "Στήθος", keys: ["chest", "press", "fly", "pushup", "pushups", "στηθος"] },
            { group: "Πλάτη", keys: ["lat", "row", "pulldown", "back", "πλατη"] },
            { group: "Πόδια", keys: ["leg", "legs", "cycling", "bike", "ποδηλα", "ποδια"] },
            { group: "Χέρια", keys: ["bicep", "tricep", "curl", "χερια"] },
            { group: "Ώμοι", keys: ["upright", "shoulder", "ωμοι"] },
            { group: "Κορμός", keys: ["ab", "crunch", "plank", "situp", "knee", "core", "raise", "κορμος", "κοιλιακ"] }
        ];
        return aliases.find(item => item.keys.some(key => clean.includes(normalize(key))))?.group || "";
    }

    function setValue(name, group) {
        const upper = String(name || "").toUpperCase();
        if (upper.includes("ΠΟΔΗΛΑΣΙΑ") || upper.includes("CYCLING")) return 24;
        if (upper.includes("EMS ΠΟΔΙΩΝ") || upper.includes("EMS LEGS")) return 6;
        if (upper.includes("STRETCHING") || group === "None") return 0;
        return 1;
    }

    function readLedger() {
        const wk = weekKey();
        const ledger = safeObject(ledgerKey, null);
        if (!ledger || ledger.weekKey !== wk || typeof ledger.exercises !== "object") {
            return { weekKey: wk, exercises: {}, initializedAt: Date.now() };
        }
        return ledger;
    }

    function computeFromLedger(ledger = readLedger()) {
        const totals = empty();
        if (!ledger || ledger.weekKey !== weekKey() || typeof ledger.exercises !== "object") return totals;
        Object.entries(ledger.exercises).forEach(([key, rawCount]) => {
            const count = Math.max(0, Number(rawCount) || 0);
            if (!count) return;
            const name = String(key || "").split("|").slice(1).join("|");
            const group = resolveGroup(name);
            if (!groups.includes(group)) return;
            totals[group] += count * setValue(name, group);
        });
        const targets = readTargets();
        groups.forEach(group => {
            const target = Math.max(0, Number(targets[group]) || 0);
            if (target > 0) totals[group] = Math.min(totals[group], target);
        });
        return totals;
    }

    function repairFromLedger(options = {}) {
        const ledgerTotals = computeFromLedger();
        const current = readHistory();
        const next = { ...current };
        let changed = false;
        groups.forEach(group => {
            const value = Math.max(0, Number(ledgerTotals[group]) || 0);
            if (value > Math.max(0, Number(current[group]) || 0)) {
                next[group] = value;
                changed = true;
            }
        });
        if (!changed) return false;
        const clean = writeHistory(next);
        window.dispatchEvent(new CustomEvent("pegasus_weekly_history_updated", { detail: { source: options.source || "ledger-repair", history: clean } }));
        if (window.MuscleProgressUI?.render) setTimeout(() => window.MuscleProgressUI.render(true), 50);
        if (window.PegasusCloud?.push && options.push !== false) setTimeout(() => window.PegasusCloud.push(), 120);
        return true;
    }

    function reconcile(options = {}) {
        return repairFromLedger({ source: options.source || "weekly-reconcile", push: options.push });
    }

    window.reconcilePegasusWeeklyHistoryFromDailyProgress = reconcile;
    window.PegasusWeeklyProgress = {
        installed: true,
        recordSet: (...args) => typeof window.logPegasusSet === "function" ? window.logPegasusSet(...args) : false,
        reconcile,
        repairFromLedger,
        computeFromLedger,
        hasCurrentWeekLedgerEntries: () => Object.values(readLedger().exercises || {}).some(value => Number(value) > 0),
        resolveMuscleGroup: resolveGroup,
        readHistory
    };
})();


window.updateTotalWorkoutCount = function() {
    const data = JSON.parse(localStorage.getItem(P_M?.workout?.done || "pegasus_workouts_done") || "{}");
    const count = Object.keys(data).length;
    localStorage.setItem(P_M?.workout?.total || "pegasus_total_workouts", count);
    const display = document.getElementById("totalWorkoutsDisplay");
    if (display) {
        const lang = (typeof window.PegasusI18n?.getLanguage === "function") ? window.PegasusI18n.getLanguage() : (localStorage.getItem('pegasus_language') || 'gr');
        display.textContent = `${lang === 'en' ? 'Workouts' : 'Προπονήσεις'}: ${count}`;
    }
};

/* ===== 11. BOOT SEQUENCE ===== */
window.enforcePegasusSaturdayWeeklyReset = function(options = {}) {
    const source = options.source || 'unknown';
    const pushAfterReset = options.push !== false;
    const now = new Date();
    const isSaturdayResetWindow = now.getDay() === 6 && now.getHours() >= 6;
    if (!isSaturdayResetWindow) return false;

    const pad = value => String(value).padStart(2, '0');
    const todayDateStr = (typeof window.getPegasusLocalDateKey === 'function')
        ? window.getPegasusLocalDateKey()
        : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const weekStart = new Date(now);
    const daysSinceSaturday = (now.getDay() + 1) % 7;
    weekStart.setHours(6, 0, 0, 0);
    weekStart.setDate(now.getDate() - daysSinceSaturday);
    if (now.getDay() === 6 && now.getTime() < weekStart.getTime()) weekStart.setDate(weekStart.getDate() - 7);
    const currentWeekKey = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;

    const historyKey = window.PegasusManifest?.workout?.weekly_history || 'pegasus_weekly_history';
    const ledgerKey = 'pegasus_weekly_history_counted_v2';
    const weekKeyName = 'pegasus_weekly_history_week_key';
    const groups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];
    const freshHistory = { "Στήθος": 0, "Πλάτη": 0, "Πόδια": 0, "Χέρια": 0, "Ώμοι": 0, "Κορμός": 0 };

    const safeRead = (key, fallback) => {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || 'null');
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (err) {
            return fallback;
        }
    };

    const history = safeRead(historyKey, freshHistory);
    const ledger = safeRead(ledgerKey, null);
    const daily = safeRead('pegasus_daily_progress', null);
    const storedWeek = String(localStorage.getItem(weekKeyName) || '').trim();
    const lastReset = localStorage.getItem('pegasus_last_reset');

    const getLocalDateVariants = (dateObj = now) => {
        const yyyy = dateObj.getFullYear();
        const mm = pad(dateObj.getMonth() + 1);
        const dd = pad(dateObj.getDate());
        return new Set([
            `${yyyy}-${mm}-${dd}`,
            `${dd}/${mm}/${yyyy}`,
            `${Number(dd)}/${Number(mm)}/${yyyy}`,
            `${yyyy}${mm}${dd}`
        ]);
    };

    const todayDateVariants = getLocalDateVariants(now);
    const hasLedgerEntriesForToday = ledger?.weekKey === currentWeekKey
        && ledger.exercises
        && typeof ledger.exercises === 'object'
        && Object.entries(ledger.exercises).some(([entryKey, value]) => {
            const count = Math.max(0, Number(value) || 0);
            if (count <= 0) return false;
            const entryDate = String(entryKey || '').split('|')[0];
            return todayDateVariants.has(entryDate);
        });

    const hasTodayDaily = daily?.date === todayDateStr
        && daily.exercises
        && typeof daily.exercises === 'object'
        && Object.values(daily.exercises).some(value => Math.max(0, Number(value) || 0) > 0);

    const visibleTotal = groups.reduce((sum, group) => sum + Math.max(0, Number(history?.[group]) || 0), 0);
    const staleWeek = !!storedWeek && storedWeek !== currentWeekKey;
    const resetAppliedWeek = String(localStorage.getItem('pegasus_saturday_reset_applied_week_key') || localStorage.getItem('pegasus_monday_reset_applied_week_key') || '').trim();
    const needsReset = resetAppliedWeek !== currentWeekKey || lastReset !== todayDateStr || staleWeek;

    if (!needsReset) return false;

    if (hasLedgerEntriesForToday || hasTodayDaily) {
        localStorage.setItem(weekKeyName, currentWeekKey);
        localStorage.setItem('pegasus_last_reset', todayDateStr);
        localStorage.setItem('pegasus_last_reset_timestamp', todayDateStr);
        localStorage.setItem('pegasus_saturday_reset_applied_week_key', currentWeekKey);
        localStorage.setItem('pegasus_saturday_reset_applied_at', String(Date.now()));
        // legacy guards kept for cloud compatibility
        localStorage.setItem('pegasus_monday_reset_applied_week_key', currentWeekKey);
        localStorage.setItem('pegasus_monday_reset_applied_at', String(Date.now()));
        if (window.PegasusWeeklyProgress?.repairFromLedger) {
            setTimeout(() => window.PegasusWeeklyProgress.repairFromLedger({ source: `saturday-reset-guard:${source}` }), 100);
        }
        console.log('🛡️ PEGASUS RESET: Skipped Saturday zero because real Saturday sets already exist.', { source, currentWeekKey });
        return false;
    }

    localStorage.setItem(historyKey, JSON.stringify(freshHistory));
    localStorage.setItem(weekKeyName, currentWeekKey);
    localStorage.removeItem(ledgerKey);
    localStorage.setItem('pegasus_weekly_kcal', '0.0');
    localStorage.setItem('pegasus_last_reset', todayDateStr);
    localStorage.setItem('pegasus_last_reset_timestamp', todayDateStr);
    localStorage.setItem('pegasus_saturday_reset_applied_week_key', currentWeekKey);
    localStorage.setItem('pegasus_saturday_reset_applied_at', String(Date.now()));
    // legacy guards kept for cloud compatibility
    localStorage.setItem('pegasus_monday_reset_applied_week_key', currentWeekKey);
    localStorage.setItem('pegasus_monday_reset_applied_at', String(Date.now()));

    window.dispatchEvent(new CustomEvent('pegasus_weekly_history_updated', {
        detail: { source: `saturday-reset:${source}`, history: { ...freshHistory }, weekKey: currentWeekKey }
    }));

    if (window.MuscleProgressUI?.render) setTimeout(() => window.MuscleProgressUI.render(true), 50);
    if (typeof window.renderPreview === 'function') setTimeout(() => window.renderPreview(), 80);
    if (pushAfterReset && window.PegasusCloud?.push) setTimeout(() => window.PegasusCloud.push(true), 150);

    console.log('🛡️ PEGASUS RESET: Saturday weekly progress reset applied.', { source, currentWeekKey, previousStoredWeek: storedWeek || null, previousTotal: visibleTotal });
    return true;
};

// Backwards-compatible alias for older call sites.
window.enforcePegasusMondayWeeklyReset = window.enforcePegasusSaturdayWeeklyReset;


window.onload = () => {
    const greekDays = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
    const todayObj = new Date();
    const todayName = greekDays[todayObj.getDay()];

    try {
        window.enforcePegasusMondayWeeklyReset?.({ source: 'boot-pre-cloud', push: false });
    } catch (e) {
        console.error("🛡️ PEGASUS RESET ERROR:", e);
    }

    setTimeout(() => {
        if (window.PegasusCloud?.getMasterWeight && window.PegasusWeight) {
            window.PegasusWeight.alignWithCloud(window.PegasusCloud.getMasterWeight());
        }
    }, 2000);

    if (typeof emailjs !== 'undefined') emailjs.init('qsfyDrneUHP7zEFui');

    const importInput = document.getElementById('importFileTools');
    if (importInput) importInput.onchange = (e) => window.importPegasusData(e);

    bindPegasusEngineUiBridge();
    syncEngineFromLegacy("BOOT_FROM_LEGACY", { selectedDay: todayName });

    createNavbar();
    if (window.updateTotalWorkoutCount) window.updateTotalWorkoutCount();
    if (window.updateKoukiBalance) window.updateKoukiBalance();

    if (typeof window.calculatePegasusDailyTarget === "function") {
        window.calculatePegasusDailyTarget();
    } else if (typeof window.updateKcalUI === "function") {
        window.updateKcalUI();
    }

    async function pullFreshPegasusCloudForPanel(source, afterPull) {
        // v19.01 local-only: no cloud pull before panels.
        if (typeof afterPull === "function") afterPull();
    }

    window.masterUI = {
        "btnStart": startPause,
        "btnNext": skipToNextExercise,
        "btnWarmup": () => {
            const vid = document.getElementById("video");
            if (!vid) return;
            if (!vid.src.includes("warmup.mp4")) {
                vid.pause();
                vid.src = "videos/warmup.mp4";
                vid.load();
                vid.play().catch(e => console.log(e));
            } else {
                vid.pause();
                if (typeof window.showVideo === "function" && window.exercises && window.exercises.length > 0) {
                    window.currentIdx = 0;
                    window.phase = 0;
                    patchPegasusWorkoutRuntime({ currentIdx: 0, phase: 0, running: running, sessionKcal: sessionActiveKcal });
                    window.showVideo(0);
                }
            }
        },
        "btnTurboTools": () => {
            window.TURBO_MODE = !window.TURBO_MODE;
            window.SPEED = window.TURBO_MODE ? 10 : 1;
            TURBO_MODE = window.TURBO_MODE;
            SPEED = window.SPEED;
            patchPegasusTimerRuntime({ turboMode: TURBO_MODE, speed: SPEED });

            const btn = document.getElementById('btnTurboTools');
            if (btn) {
                btn.textContent = window.TURBO_MODE ? "🚀 TURBO: Ενεργό" : "🚀 Turbo: ανενεργό";
                btn.style.color = window.TURBO_MODE ? "#ff4444" : "#4CAF50";
            }
        },
        "btnMuteTools": () => {
            window.muted = !window.muted;
            muted = window.muted;
            patchPegasusUserRuntime({ muted: muted, weight: userWeight });

            const btn = document.getElementById('btnMuteTools');
            if (btn) {
                btn.textContent = window.muted ? "🔇 Ήχος: σίγαση" : "🔊 Ήχος: ενεργός";
                btn.style.color = window.muted ? "#888" : "#4CAF50";
            }
        },
        "btnPartnerMode": () => {
            if (typeof window.togglePartnerMode === 'function') window.togglePartnerMode();
        },
        "btnImportData": () => {
            const f = document.getElementById('importFileTools');
            if (f) f.click();
        },
        "btnExportData": () => {
            if (window.exportPegasusData) window.exportPegasusData();
        },
        "btnMasterVault": () => {
            if (typeof window.handleDesktopSyncOpen === 'function') {
                window.handleDesktopSyncOpen();
                return;
            }
            const m = document.getElementById('pinModal');
            if (m) m.style.display = 'flex';
        },
        "btnPlanSelector": () => { if (window.openPegasusPlanModal) window.openPegasusPlanModal(); },
        "btnCalendarUI": { panel: "calendarPanel", init: window.renderCalendar },
        "btnAchUI": { panel: "achievementsPanel", init: window.renderAchievements },
        "btnSettingsUI": { panel: "settingsPanel", init: window.initSettingsUI },
        "btnFoodUI": { panel: "foodPanel", init: () => pullFreshPegasusCloudForPanel("food", () => {
            if (typeof window.updateFoodUI === "function") window.updateFoodUI();
        }) },
        "btnProposalsUI": () => {
            if (window.PegasusDietAdvisor?.renderAdvisorUI) window.renderAdvisorUI();
            else { if (window.pegasusAlert) window.pegasusAlert("Σφάλμα: Το dietAdvisor.js δεν έχει φορτωθεί σωστά."); else alert("Σφάλμα: Το dietAdvisor.js δεν έχει φορτωθεί σωστά."); }
        },
        "btnToolsUI": { panel: "toolsPanel", init: null },
        "btnPreviewUI": { panel: "previewPanel", init: () => {
            // PEGASUS 206: Preview opens instantly from local state.
            // No forced cloud pull/sync on Preview button press.
            if (typeof window.renderPreview === "function") window.renderPreview();
            else if (typeof openExercisePreview === "function") openExercisePreview();
            if (window.MuscleProgressUI?.render) window.MuscleProgressUI.render(true);
        } },
        "btnOpenGallery": { panel: "galleryPanel", init: () => { if (window.GalleryEngine) window.GalleryEngine.render(); } },
        "btnCardio": { panel: "cardioPanel", init: () => { if (window.PegasusCardio) window.PegasusCardio.open(); } },
        "btnEMS": { panel: "emsModal", init: window.logEMSData },
        "btnManualEmail": () => {
            if (window.PegasusReporting?.checkAndSendMorningReport) window.PegasusReporting.checkAndSendMorningReport(true);
            else { if (window.pegasusAlert) window.pegasusAlert("Reporting Engine Offline"); else alert("Reporting Engine Offline"); }
        },
        "btnSaveSettings": () => {
            if (typeof window.savePegasusSettingsGlobal === "function") {
                window.savePegasusSettingsGlobal();
            } else {
                const weightVal = document.getElementById("userWeightInput")?.value || 74;
                if (window.PegasusWeight?.save) window.PegasusWeight.save(weightVal);
                else localStorage.setItem(P_M?.user?.weight || "pegasus_weight", weightVal);
                if (window.PegasusCloud?.push) window.PegasusCloud.push(true);
                setTimeout(() => { location.reload(); }, 300);
            }
        }
    };

    Object.keys(window.masterUI).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                const target = window.masterUI[btnId];

                if (!btnId.includes("Save") && !btnId.includes("Start") && btnId !== "btnProposalsUI") {
                    document.querySelectorAll('.pegasus-panel, #emsModal').forEach(p => p.style.display = "none");
                }

                if (typeof target === 'function') {
                    target();
                } else if (target && target.panel) {
                    const el = document.getElementById(target.panel);
                    if (el) {
                        el.style.display = "block";
                        if (target.init) target.init();
                    }
                }
            };
        }
    });

    setTimeout(() => {
        document.querySelectorAll(".navbar button").forEach(b => {
            if (b.id.replace('nav-', '') === todayName) {
                if (typeof selectDay === "function") {
                    selectDay(b, todayName);
                    setTimeout(() => {
                        if (typeof exercises !== 'undefined') {
                            currentIdx = remainingSets.findIndex((sets, idx) => sets > 0 && !exercises[idx]?.classList.contains("exercise-skipped"));
                            if (currentIdx === -1) currentIdx = 0;
                            syncPegasusSelectedDay(todayName);
                            console.log("🚀 PEGASUS: Circuit Auto-Initialized for Today.");
                        }
                    }, 150);
                }
            }
        });
    }, 400);

    if (window.PegasusUI?.init) window.PegasusUI.init();

    // PEGASUS 237: hold the visible initialization screen until all known
    // same-origin system/media files are stored in the permanent local cache.
    const storageReady = window.PegasusBackgroundAssets?.start
        ? window.PegasusBackgroundAssets.start()
        : Promise.resolve(true);

    const minimumLoaderTime = new Promise(resolve => setTimeout(resolve, 600));

    Promise.allSettled([storageReady, minimumLoaderTime]).then(() => {
        const loader = document.getElementById('pegasus-loader');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
        }

        syncPegasusSelectedDay(todayName);

        if (typeof window.updateKcalUI === "function") {
            window.updateKcalUI();
        }

        syncPegasusProgressRuntime();
        syncPegasusUserRuntime();
        renderPegasusControlState();

        console.log("🛡️ PEGASUS OS: Permanent local initialization complete. Welcome back, Angelos.");
    });
};


window.getPegasusSessionState = window.getPegasusSessionState || function() {
    return window.PegasusEngine?.getSessionSnapshot ? window.PegasusEngine.getSessionSnapshot() : null;
};

window.getPegasusReplayProgress = window.getPegasusReplayProgress || function(limit) {
    return window.PegasusEngine?.replayProgress ? window.PegasusEngine.replayProgress(limit) : null;
};

window.getPegasusPersistedProgress = window.getPegasusPersistedProgress || function() {
    return window.PegasusEngine?.getPersistedRuntime ? window.PegasusEngine.getPersistedRuntime() : null;
};

window.restorePegasusPersistedProgress = window.restorePegasusPersistedProgress || function() {
    return window.PegasusEngine?.restorePersistedRuntime ? window.PegasusEngine.restorePersistedRuntime() : null;
};

window.clearPegasusPersistedProgress = window.clearPegasusPersistedProgress || function() {
    return window.PegasusEngine?.clearPersistedRuntime ? window.PegasusEngine.clearPersistedRuntime() : null;
};

window.PegasusDebug = {
    state: () => ({ exercises, remainingSets, currentIdx, running, phase, phaseRemainingSeconds }),
    session: () => (typeof window.getPegasusSessionState === "function" ? window.getPegasusSessionState() : null),
    progress: () => (typeof window.getPegasusProgressState === "function" ? window.getPegasusProgressState() : null),
    summary: () => (typeof window.getPegasusRuntimeSummary === "function" ? window.getPegasusRuntimeSummary() : null),
    timerDisplay: () => (typeof window.getPegasusTimerDisplayState === "function" ? window.getPegasusTimerDisplayState() : null),
    controls: () => (typeof window.getPegasusControlState === "function" ? window.getPegasusControlState() : null),
    uiState: () => (typeof window.getPegasusUiState === "function" ? window.getPegasusUiState() : null),
    replayProgress: (limit) => (typeof window.getPegasusReplayProgress === "function" ? window.getPegasusReplayProgress(limit) : null),
    persistedProgress: () => (typeof window.getPegasusPersistedProgress === "function" ? window.getPegasusPersistedProgress() : null),
    restorePersistedProgress: () => (typeof window.restorePegasusPersistedProgress === "function" ? window.restorePegasusPersistedProgress() : null),
    clearPersistedProgress: () => (typeof window.clearPegasusPersistedProgress === "function" ? window.clearPegasusPersistedProgress() : null),
    actions: (limit) => (window.PegasusEngine?.getActionTypes ? window.PegasusEngine.getActionTypes(limit || 25) : ((window.PegasusEngine?.getEventBuffer ? window.PegasusEngine.getEventBuffer() : []).slice(-(limit || 25)).map(ev => ev.type))),
    actionEntries: (limit) => (window.PegasusEngine?.getActionEntries ? window.PegasusEngine.getActionEntries(limit || 25) : []),
    checkpoints: (limit) => (window.PegasusEngine?.getCheckpoints ? window.PegasusEngine.getCheckpoints(limit || 10) : []),
    workoutActions: (limit) => (window.PegasusEngine?.getWorkoutActionTypes ? window.PegasusEngine.getWorkoutActionTypes(limit || 25) : []),
    workout: () => (window.PegasusEngine?.getWorkoutState ? window.PegasusEngine.getWorkoutState() : null),
    timers: () => (window.PegasusEngine?.getTimerState ? window.PegasusEngine.getTimerState() : null),
    user: () => (window.PegasusEngine?.getUserState ? window.PegasusEngine.getUserState() : null),
    engineState: () => (window.PegasusEngine?.getState ? window.PegasusEngine.getState() : null),
    replay: (limit) => (window.PegasusEngine?.replay ? window.PegasusEngine.replay(limit) : null),
    manifest: () => P_M,
    testImage: (name) => {
        const testImg = new Image();
        testImg.onload = () => console.log(`%c ✅ ASSET FOUND: ${name}.png`, "color: #4CAF50; font-weight: bold;");
        testImg.onerror = () => console.error(`%c ❌ ASSET 404: ${name}.png is missing from GitHub!`, "color: #ff4444;");
        testImg.src = `images/${name}.png`;
    },
    logs: () => window.pegasusLogs
};
