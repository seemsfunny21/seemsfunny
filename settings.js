/* ==========================================================================
   📦 PEGASUS SETTINGS ENGINE - v4.7 (PEGASUS 211 MS-600 TARGET REBALANCE)
   Protocol: Strict Data Analyst | Zero Logic Loss | Split Integration
   Status: FINAL STABLE | FIXED: SPLIT SELECTION SYNC
   ========================================================================== */

// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;

const DEFAULT_SETTINGS = {
    weight: 74,
    height: 187,
    age: 38,
    gender: 'male',
    goalKcal: 2800,
    goalProtein: 160,
    exTime: 45,
    restTime: 60,
    activeSplit: 'IRON',
    bodyGoalMode: 'cut',
    muscleTargets: {
        "Στήθος": 14,
        "Πλάτη": 16,
        "Πόδια": 8,
        "Χέρια": 12,
        "Ώμοι": 8,
        "Κορμός": 16
    }
};

const PEGASUS_211_TARGETS = {
    "Στήθος": 14,
    "Πλάτη": 16,
    "Πόδια": 8,
    "Χέρια": 12,
    "Ώμοι": 8,
    "Κορμός": 16
};

function getPegasusWeekKeyForTargets() {
    return window.PegasusWeekClock.weekKey();
}

function migratePegasus211MuscleTargets() {
    const key = M?.workout?.muscleTargets || "pegasus_muscle_targets";
    const marker = "pegasus_targets_rebalanced_v211";
    if (localStorage.getItem(marker) === "done") return;

    let current = null;
    try {
        current = JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
        current = null;
    }

    const oldDefault = { "Στήθος": 24, "Πλάτη": 24, "Πόδια": 24, "Χέρια": 16, "Ώμοι": 16, "Κορμός": 12 };
    const v134Default = { "Στήθος": 16, "Πλάτη": 16, "Πόδια": 24, "Χέρια": 14, "Ώμοι": 12, "Κορμός": 18 };
    const groups = Object.keys(PEGASUS_211_TARGETS);
    const missing = !current || typeof current !== "object";
    const looksOldDefault = !missing && groups.every(group => Number(current[group]) === Number(oldDefault[group]));
    const looksV134Default = !missing && groups.every(group => Number(current[group]) === Number(v134Default[group]));
    const looksGeneratedFromOldProgram = !missing &&
        Number(current["Στήθος"]) >= 20 &&
        Number(current["Πλάτη"]) >= 20 &&
        Number(current["Χέρια"]) >= 16 &&
        Number(current["Ώμοι"]) >= 16 &&
        Number(current["Κορμός"]) <= 14;

    if (missing || looksOldDefault || looksV134Default || looksGeneratedFromOldProgram) {
        localStorage.setItem(key, JSON.stringify(PEGASUS_211_TARGETS));
        console.log("✅ PEGASUS 211: MS-600 weekly muscle targets rebalanced.", PEGASUS_211_TARGETS);
    }

    localStorage.setItem(marker, "done");
}

try { migratePegasus211MuscleTargets(); } catch (e) { console.warn("PEGASUS 211 target migration skipped.", e); }

function clonePegasusSettings(value) {
    try {
        return structuredClone(value);
    } catch (e) {
        return JSON.parse(JSON.stringify(value));
    }
}

function getPegasusGoalKcalKey() {
    return M?.diet?.goalKcal || "pegasus_goal_kcal";
}

function getPegasusLegacyTodayKcalKey() {
    return M?.diet?.todayKcal || "pegasus_today_kcal";
}

function getPegasusEffectiveTodayKcalKey() {
    return M?.diet?.effectiveTodayKcal || "pegasus_effective_today_kcal";
}

function isValidPegasusKcal(value) {
    return Number.isFinite(value) && value >= 1000 && value <= 6000;
}

function resolvePegasusManualGoalKcal() {
    const manualKey = getPegasusGoalKcalKey();
    const legacyKey = getPegasusLegacyTodayKcalKey();

    const manual = parseInt(localStorage.getItem(manualKey), 10);
    const legacy = parseInt(localStorage.getItem(legacyKey), 10);
    const looksLikeRuntimeTarget = isValidPegasusKcal(legacy) && legacy > 3200;

    if (isValidPegasusKcal(manual)) {
        if (looksLikeRuntimeTarget) {
            localStorage.setItem(legacyKey, String(manual));
        }
        return manual;
    }

    const resolved = (isValidPegasusKcal(legacy) && !looksLikeRuntimeTarget)
        ? legacy
        : DEFAULT_SETTINGS.goalKcal;

    localStorage.setItem(manualKey, String(resolved));

    // Keep legacy pegasus_today_kcal as a manual/settings mirror only.
    // Runtime-computed targets are stored in pegasus_effective_today_kcal.
    if (!isValidPegasusKcal(legacy) || looksLikeRuntimeTarget) {
        localStorage.setItem(legacyKey, String(resolved));
    }

    return resolved;
}

window.getPegasusManualKcalTarget = resolvePegasusManualGoalKcal;
window.getPegasusGoalKcalKey = getPegasusGoalKcalKey;
window.getPegasusEffectiveTodayKcalKey = getPegasusEffectiveTodayKcalKey;

function normalizePegasusBodyGoalMode(value) {
    const v = String(value || '').toLowerCase();
    return (v === 'bulk' || v === 'ogkos' || v === 'όγκος') ? 'bulk' : 'cut';
}

window.getPegasusBodyGoalMode = function(settingsObj) {
    return normalizePegasusBodyGoalMode(
        settingsObj?.bodyGoalMode ||
        localStorage.getItem('pegasus_body_goal_mode') ||
        DEFAULT_SETTINGS.bodyGoalMode
    );
};

window.getPegasusBodyGoalLabel = function(mode) {
    const isEn = (window.PegasusI18n?.getLanguage?.() || localStorage.getItem('pegasus_language') || localStorage.getItem('pegasus_lang')) === 'en';
    return normalizePegasusBodyGoalMode(mode) === 'bulk' ? (isEn ? 'Bulk' : 'Όγκος') : (isEn ? 'Cutting' : 'Γράμμωση');
};

window.setPegasusBodyGoalModeUI = function(mode) {
    const normalized = normalizePegasusBodyGoalMode(mode);
    const hidden = document.getElementById('bodyGoalModeInput');
    if (hidden) hidden.value = normalized;
    document.querySelectorAll('[data-body-goal-mode]').forEach(btn => {
        const mode = btn.getAttribute('data-body-goal-mode');
        const active = mode === normalized;
        const isEnLabel = (window.PegasusI18n?.getLanguage?.() || localStorage.getItem('pegasus_language') || localStorage.getItem('pegasus_lang')) === 'en';
        btn.textContent = isEnLabel ? (mode === 'bulk' ? 'Bulk' : 'Cutting') : (mode === 'bulk' ? 'Όγκος' : 'Γράμμωση');
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.style.background = active ? 'linear-gradient(180deg, rgba(76,175,80,.45), rgba(0,0,0,.85))' : 'rgba(0,0,0,.55)';
        btn.style.borderColor = active ? '#00ff66' : '#2f7d32';
        btn.style.boxShadow = active ? '0 0 12px rgba(0,255,102,.35)' : 'none';
        btn.style.color = active ? '#d8ffe0' : '#7ce184';
        btn.style.fontSize = '12px';
        btn.style.fontWeight = '700';
        btn.style.width = '100%';
        btn.style.minHeight = '26px';
        btn.style.padding = '3px 8px';
        btn.style.lineHeight = '1.15';
    });
};

/**
 * 1. GLOBAL ACCESSOR
 */
window.getPegasusSettings = function() {
    try {
        const u = M?.user || {};
        const d = M?.diet || {};
        const w = M?.workout || {};

        const storedTargetsStr = localStorage.getItem(w.muscleTargets || "pegasus_muscle_targets");
        let storedTargets = null;

        if (storedTargetsStr) {
            try {
                storedTargets = JSON.parse(storedTargetsStr);
            } catch (e) {}
        }

        return {
            weight: parseFloat(localStorage.getItem(u.weight || "pegasus_weight")) || DEFAULT_SETTINGS.weight,
            height: parseFloat(localStorage.getItem(u.height || "pegasus_height")) || DEFAULT_SETTINGS.height,
            age: parseInt(localStorage.getItem(u.age || "pegasus_age"), 10) || DEFAULT_SETTINGS.age,
            gender: localStorage.getItem(u.gender || "pegasus_gender") || DEFAULT_SETTINGS.gender,
            goalKcal: resolvePegasusManualGoalKcal(),
            goalProtein: parseInt(localStorage.getItem(d.goalProtein || 'pegasus_goal_protein'), 10) || parseInt(localStorage.getItem(d.todayProtein || "pegasus_today_protein"), 10) || DEFAULT_SETTINGS.goalProtein,
            exTime: parseInt(localStorage.getItem(w.ex_time || "pegasus_ex_time"), 10) || DEFAULT_SETTINGS.exTime,
            restTime: parseInt(localStorage.getItem(w.rest_time || "pegasus_rest_time"), 10) || DEFAULT_SETTINGS.restTime,
            activeSplit: localStorage.getItem('pegasus_active_plan') || DEFAULT_SETTINGS.activeSplit,
            bodyGoalMode: window.getPegasusBodyGoalMode ? window.getPegasusBodyGoalMode() : (localStorage.getItem('pegasus_body_goal_mode') || DEFAULT_SETTINGS.bodyGoalMode),
            muscleTargets: storedTargets || clonePegasusSettings(DEFAULT_SETTINGS.muscleTargets)
        };
    } catch (e) {
        console.warn("PEGASUS: Settings corruption detected.", e);
        return clonePegasusSettings(DEFAULT_SETTINGS);
    }
};

/**
 * 2. LIVE BMR CALCULATOR
 */
window.calculateBMR = function() {
    const w = parseFloat(document.getElementById("userWeightInput")?.value);
    const h = parseFloat(document.getElementById("userHeightInput")?.value);
    const a = parseInt(document.getElementById("userAgeInput")?.value, 10);
    const g = document.getElementById("userGenderInput")?.value;
    const bmrDisplay = document.getElementById("maintenanceKcalDisplay");

    if (!w || !h || !a) return;

    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr = (g === "male") ? bmr + 5 : bmr - 161;
    const tdee = Math.round(bmr * 1.55);

    if (bmrDisplay) bmrDisplay.textContent = `Συντήρηση (TDEE): ${tdee} kcal`;
};

/**
 * 2.5 RUNTIME BRIDGE
 */
window.applyPegasusRuntimeSettings = function(settingsObj) {
    const s = settingsObj || window.getPegasusSettings();

    window.pegasusTimerConfig = {
        prep: 10,
        work: parseInt(s.exTime, 10) || DEFAULT_SETTINGS.exTime,
        rest: parseInt(s.restTime, 10) || DEFAULT_SETTINGS.restTime
    };

    if (typeof window.userWeight !== "undefined") {
        window.userWeight = parseFloat(s.weight) || DEFAULT_SETTINGS.weight;
    }

    if (window.PegasusEngine?.dispatch) {
        window.PegasusEngine.dispatch({
            type: "SYNC_WEIGHT",
            payload: { weight: parseFloat(s.weight) || DEFAULT_SETTINGS.weight }
        });

        window.PegasusEngine.dispatch({
            type: "SET_TIMER_STATE",
            payload: {
                totalSeconds: window.totalSeconds || 0,
                remainingSeconds: window.remainingSeconds || 0,
                phaseRemainingSeconds: window.phaseRemainingSeconds ?? null
            }
        });
    }
};

/**
 * 3. UI INITIALIZER (With Split Mapping)
 */
window.initSettingsUI = function() {
    const s = window.getPegasusSettings();

    const fields = {
        "userWeightInput": s.weight,
        "userHeightInput": s.height,
        "userAgeInput": s.age,
        "userGenderInput": s.gender,
        "goalKcalInput": s.goalKcal,
        "goalProteinInput": s.goalProtein,
        "exerciseTimeInput": s.exTime,
        "restTimeInput": s.restTime,
        "activeSplitSelector": s.activeSplit,
        "bodyGoalModeInput": s.bodyGoalMode
    };

    for (let id in fields) {
        const el = document.getElementById(id);
        if (el) el.value = fields[id];
    }

    if (typeof window.setPegasusBodyGoalModeUI === 'function') {
        window.setPegasusBodyGoalModeUI(s.bodyGoalMode || DEFAULT_SETTINGS.bodyGoalMode);
    }

    document.querySelectorAll('[data-body-goal-mode]').forEach(btn => {
        btn.onclick = () => window.setPegasusBodyGoalModeUI(btn.getAttribute('data-body-goal-mode'));
    });

    ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"].forEach(m => {
        const el = document.getElementById(`target${m}Input`);
        if (el) el.value = s.muscleTargets[m] || DEFAULT_SETTINGS.muscleTargets[m];
    });

    ["userWeightInput", "userHeightInput", "userAgeInput", "userGenderInput"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = window.calculateBMR;
    });

    window.applyPegasusRuntimeSettings(s);
    window.calculateBMR();
};

/**
 * 4. MASTER SAVE LOGIC (Cross-File Impact Audit Compliant)
 */
window.savePegasusSettingsGlobal = function() {
    try {
        const u = M?.user || {};
        const d = M?.diet || {};
        const w = M?.workout || {};
        const currentSettings = window.getPegasusSettings();

        const getValue = (id, fallback) => {
            const el = document.getElementById(id);
            return (el && el.value !== "") ? el.value : fallback;
        };

        const newSettings = {
            weight: parseFloat(getValue("userWeightInput", currentSettings.weight)) || currentSettings.weight || DEFAULT_SETTINGS.weight,
            height: parseFloat(getValue("userHeightInput", currentSettings.height)) || currentSettings.height || DEFAULT_SETTINGS.height,
            age: parseInt(getValue("userAgeInput", currentSettings.age), 10) || currentSettings.age || DEFAULT_SETTINGS.age,
            gender: getValue("userGenderInput", currentSettings.gender || DEFAULT_SETTINGS.gender),
            goalKcal: parseInt(getValue("goalKcalInput", currentSettings.goalKcal), 10) || currentSettings.goalKcal || DEFAULT_SETTINGS.goalKcal,
            goalProtein: parseInt(getValue("goalProteinInput", currentSettings.goalProtein), 10) || currentSettings.goalProtein || DEFAULT_SETTINGS.goalProtein,
            exTime: parseInt(getValue("exerciseTimeInput", currentSettings.exTime), 10) || currentSettings.exTime || DEFAULT_SETTINGS.exTime,
            restTime: parseInt(getValue("restTimeInput", currentSettings.restTime), 10) || currentSettings.restTime || DEFAULT_SETTINGS.restTime,
            activeSplit: getValue("activeSplitSelector", currentSettings.activeSplit || DEFAULT_SETTINGS.activeSplit),
            bodyGoalMode: normalizePegasusBodyGoalMode(getValue("bodyGoalModeInput", currentSettings.bodyGoalMode || DEFAULT_SETTINGS.bodyGoalMode)),
            muscleTargets: {}
        };

        ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"].forEach(m => {
            const el = document.getElementById(`target${m}Input`);
            const val = el ? parseInt(el.value, 10) : NaN;
            newSettings.muscleTargets[m] = isNaN(val) ? DEFAULT_SETTINGS.muscleTargets[m] : val;
        });

        // Core Identity
        localStorage.setItem(u.weight || "pegasus_weight", String(newSettings.weight));
        localStorage.setItem(u.height || "pegasus_height", String(newSettings.height));
        localStorage.setItem(u.age || "pegasus_age", String(newSettings.age));
        localStorage.setItem(u.gender || "pegasus_gender", newSettings.gender);
        localStorage.setItem('pegasus_body_goal_mode', newSettings.bodyGoalMode);
        localStorage.setItem('pegasus_body_goal_mode_label', window.getPegasusBodyGoalLabel ? window.getPegasusBodyGoalLabel(newSettings.bodyGoalMode) : newSettings.bodyGoalMode);

        // Nutrition & Time
        localStorage.setItem(d.goalKcal || "pegasus_goal_kcal", String(newSettings.goalKcal));
        localStorage.setItem(d.todayKcal || "pegasus_today_kcal", String(newSettings.goalKcal));
        localStorage.setItem(d.goalProtein || 'pegasus_goal_protein', String(newSettings.goalProtein));
        localStorage.setItem(d.todayProtein || "pegasus_today_protein", String(newSettings.goalProtein));
        localStorage.setItem(w.ex_time || "pegasus_ex_time", String(newSettings.exTime));
        localStorage.setItem(w.rest_time || "pegasus_rest_time", String(newSettings.restTime));

        // Active Split
        localStorage.setItem('pegasus_active_plan', newSettings.activeSplit);

        // Muscle Targets
        localStorage.setItem(
            w.muscleTargets || "pegasus_muscle_targets",
            JSON.stringify(newSettings.muscleTargets)
        );

        window.applyPegasusRuntimeSettings(newSettings);

        if (window.PegasusEngine?.dispatch) {
            window.PegasusEngine.dispatch({
                type: "PLAN_CHANGED",
                payload: { planKey: newSettings.activeSplit }
            });
        }

        if (window.PegasusCloud?.push) window.PegasusCloud.push(true);

        alert("✅ Pegasus Settings: Συγχρονισμός ολοκληρώθηκε!");
        location.reload();
    } catch (err) {
        console.error("❌ PEGASUS SAVE FAILURE:", err);
        alert("Κρίσιμο σφάλμα κατά την αποθήκευση.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.applyPegasusRuntimeSettings(window.getPegasusSettings());
});
