/* ==========================================================================
   📦 PEGASUS DATA ENGINE - v17.11 (PEGASUS 218 USER VIDEO FIX)
   Protocol: 10" Prep | 45" Work | 60" Rest
   Status: PRODUCTION READY (MS-600 Final Mapping)
   ========================================================================== */

var M = M || window.PegasusManifest;

// 1. DEFAULT PLAN (Rest & Stretching Days)
window.program = {
    "Δευτέρα": [{ name: "Stretching", sets: 1, muscleGroup: "None", weight: "0" }],
    "Τρίτη": [], "Τετάρτη": [],
    "Πέμπτη": [{ name: "Stretching", sets: 1, muscleGroup: "None", weight: "0" }],
    "Παρασκευή": [], "Σάββατο": [], "Κυριακή": []
};

// 2. MASTER EXERCISES DATABASE (PEGASUS 215 MS-600 + FLOOR ONLY)
window.exercisesDB = [
    { name: "Chest Press", muscleGroup: "Στήθος" },
    { name: "Chest Flys", muscleGroup: "Στήθος" },
    { name: "Pushups", muscleGroup: "Στήθος" },
    { name: "Lat Pulldowns", muscleGroup: "Πλάτη" },
    { name: "Lat Pulldowns Close", muscleGroup: "Πλάτη" },
    { name: "Seated Rows", muscleGroup: "Πλάτη" },
    { name: "Low Rows Seated", muscleGroup: "Πλάτη" },
    { name: "Reverse Grip Cable Row", muscleGroup: "Πλάτη" },
    { name: "Bent Over Rows", muscleGroup: "Πλάτη" },
    { name: "Straight Arm Pulldowns", muscleGroup: "Πλάτη" },
    { name: "Upright Rows", muscleGroup: "Ώμοι" },
    { name: "Bicep Curls", muscleGroup: "Χέρια" },
    { name: "Preacher Bicep Curls", muscleGroup: "Χέρια" },
    { name: "Tricep Pulldowns", muscleGroup: "Χέρια" },
    { name: "Ab Crunches", muscleGroup: "Κορμός" },
    { name: "Situps", muscleGroup: "Κορμός" },
    { name: "Plank", muscleGroup: "Κορμός" },
    { name: "Reverse Crunch", muscleGroup: "Κορμός" },
    { name: "Lying Knee Raise", muscleGroup: "Κορμός" },
    { name: "Leg Raise Hip Lift", muscleGroup: "Κορμός" },
    { name: "Leg Extensions", muscleGroup: "Πόδια" },
    { name: "Cycling", muscleGroup: "Πόδια" },
    { name: "EMS Training", muscleGroup: "Πλάτη" },
    { name: "Stretching", muscleGroup: "None" }
];

// 3. ASSET MAPPING (VIDEO SYNC)
window.videoMap = {
    "Chest Press": "chestpress",
    "Chest Flys": "chestflys",
    "Pushups": "pushups",
    "Lat Pulldowns": "latpulldowns",
    "Lat Pulldowns Close": "latpulldownsclose",
    "Seated Rows": "reverseseatedrows",
    "Low Rows Seated": "lowrowsseated",
    "Reverse Grip Cable Row": "reversegripcablerow", // PEGASUS 218: user-provided valid MP4
    "Bent Over Rows": "bentoverrows",
    "Straight Arm Pulldowns": "straightarmpulldowns",
    "Upright Rows": "uprightrows",
    "Bicep Curls": "bicepcurls",
    "Preacher Bicep Curls": "preacherbicepcurls",
    "Tricep Pulldowns": "triceppulldowns",
    "Ab Crunches": "abcrunches",
    "Situps": "situps",
    "Plank": "plank",
    "Reverse Crunch": "reversecrunch",
    "Lying Knee Raise": "lyingkneeraise",
    "Leg Raise Hip Lift": "legraisehiplift",
    "Leg Extensions": "legextensions",
    "Cycling": "cycling",
    "EMS Training": "ems",
    "Stretching": "stretching"
};

// 4. PEGASUS ENGINE (PROGRAMS REBALANCED FOR ABS PRIORITY & CYCLING)
window.getPegasusActivePlan = function() {
    return localStorage.getItem('pegasus_active_plan') || 'IRON';
};

function renderPegasusPlanSelectorContent(modal) {
    const activePlan = window.getPegasusActivePlan();
    const plans = [
        { key: 'IRON', title: 'IRON', desc: 'Push / Pull / Upper + Ποδήλατο', color: '#4CAF50' },
        { key: 'EMS_ONLY', title: 'EMS only', desc: 'Βάρη + IMS / EMS', color: '#00bcd4' },
        { key: 'BIKE_ONLY', title: 'Bike only', desc: 'Βάρη + Ποδήλατο Σ/Κ', color: '#ff9800' },
        { key: 'HYBRID', title: 'HYBRID', desc: 'Βάρη + EMS + Ποδήλατο', color: '#e91e63' }
    ];

    modal.setAttribute('data-no-i18n', 'true');
    modal.innerHTML = `
        <button type="button" onclick="window.closePegasusPlanModal()" class="pegasus-plan-close">✕</button>
        <h3 class="pegasus-plan-title">Επιλογή προγράμματος</h3>
        <div class="pegasus-plan-grid">
            ${plans.map(plan => `
                <button type="button" onclick="window.setPegasusPlan('${plan.key}')" class="pegasus-plan-option${activePlan === plan.key ? ' selected' : ''}" style="--plan-color:${plan.color};">
                    <span class="pegasus-plan-name">${plan.title}</span>
                    <small class="pegasus-plan-desc">${plan.desc}</small>
                    ${activePlan === plan.key ? '<em class="pegasus-plan-selected">✓ Επιλεγμένο</em>' : ''}
                </button>
            `).join('')}
        </div>
    `;
}

window.openPegasusPlanModal = function() {
    let modal = document.getElementById('planModal');

    // PEGASUS 139 FIX: always normalize the legacy selector into one stable,
    // no-i18n modal so labels like IRON / EMS only / Bike only never become
    // IRENERGOS / ENERGOSLY and the panel always appears above the workout UI.
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'planModal';
        modal.className = 'pegasus-panel';
        document.body.appendChild(modal);
    }

    renderPegasusPlanSelectorContent(modal);

    document.querySelectorAll('.pegasus-panel, #emsModal').forEach(panel => {
        if (panel !== modal) panel.style.display = 'none';
    });

    Object.assign(modal.style, {
        display: 'block',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '580px',
        maxWidth: '94vw',
        maxHeight: '88vh',
        overflowY: 'auto',
        padding: '35px 25px',
        zIndex: '100500',
        border: '2px solid #4CAF50',
        boxShadow: '0 0 45px rgba(76, 175, 80, 0.35), 0 0 0 9999px rgba(0,0,0,0.72)',
        background: '#0a0a0a',
        borderRadius: '20px',
        boxSizing: 'border-box'
    });

    console.log('✅ PEGASUS PLAN: Selector opened.');
    return true;
};

window.closePegasusPlanModal = window.closePegasusPlanModal || function() {
    const modal = document.getElementById('planModal');
    if (modal) modal.style.display = 'none';
};

window.setPegasusPlan = function(planKey) {
    const allowedPlans = ['IRON', 'EMS_ONLY', 'BIKE_ONLY', 'HYBRID'];
    const nextPlan = allowedPlans.includes(planKey) ? planKey : 'IRON';

    localStorage.setItem('pegasus_active_plan', nextPlan);

    try {
        const settingsKey = window.PegasusManifest?.settings?.main || 'pegasus_settings';
        const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        settings.activeSplit = nextPlan;
        localStorage.setItem(settingsKey, JSON.stringify(settings));
    } catch (e) {
        console.warn('⚠️ PEGASUS PLAN: settings activeSplit sync skipped.', e);
    }

    if (window.PegasusEngine?.dispatch) {
        try {
            window.PegasusEngine.dispatch({
                type: 'PLAN_CHANGED',
                payload: { planKey: nextPlan }
            });
        } catch (e) {
            console.warn('⚠️ PEGASUS PLAN: engine dispatch skipped.', e);
        }
    }

    try { window.closePegasusPlanModal?.(); } catch (e) {}

    if (window.PegasusCloud?.push) {
        try { window.PegasusCloud.push(true); } catch (e) { console.warn('⚠️ PEGASUS PLAN: cloud push skipped.', e); }
    }

    setTimeout(() => window.location.reload(), 350);
};

(function installPegasusPlanButtonFallback() {
    function bind() {
        const btn = document.getElementById('btnPlanSelector');
        if (!btn || btn.__pegasusPlanBound) return;
        btn.__pegasusPlanBound = true;
        btn.addEventListener('click', function(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            window.openPegasusPlanModal?.();
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind, { once: true });
    } else {
        bind();
    }
    window.addEventListener('load', bind, { once: true });
})();

(function applyPegasusSplit() {
    const activePlan = window.getPegasusActivePlan();
    const days = {
        // PEGASUS 215: IRON is now a focused split, not full-body every day.
        // 45λεπτο: λίγες ασκήσεις ανά session με 3-4 σετ, όχι 2 σετ από όλες.
        // Γράμμωση/Όγκος μοιράζονται το ίδιο split· αλλάζει η ένταση/κιλά του χρήστη.
        iron_tuesday: [
            // PUSH: στήθος + τρικέφαλα/ώμοι + μικρός κορμός
            { name: "Chest Press", sets: 4, muscleGroup: "Στήθος", weight: "54" },
            { name: "Chest Flys", sets: 4, muscleGroup: "Στήθος", weight: "42" },
            { name: "Pushups", sets: 4, muscleGroup: "Στήθος", weight: "0" },
            { name: "Tricep Pulldowns", sets: 4, muscleGroup: "Χέρια", weight: "20" },
            { name: "Upright Rows", sets: 3, muscleGroup: "Ώμοι", weight: "30" },
            { name: "Plank", sets: 3, muscleGroup: "Κορμός", weight: "0" }
        ],
        iron_wednesday: [
            // PULL: πλάτη + δικέφαλα + κορμός. Leg Extensions μπαίνουν μόνο όταν δεν υπάρχει ποδηλασία.
            { name: "Lat Pulldowns", sets: 4, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Seated Rows", sets: 4, muscleGroup: "Πλάτη", weight: "66" },
            { name: "Straight Arm Pulldowns", sets: 4, muscleGroup: "Πλάτη", weight: "30" },
            { name: "Bicep Curls", sets: 4, muscleGroup: "Χέρια", weight: "30" },
            { name: "Preacher Bicep Curls", sets: 3, muscleGroup: "Χέρια", weight: "30" },
            { name: "Lying Knee Raise", sets: 3, muscleGroup: "Κορμός", weight: "0" }
        ],
        iron_friday: [
            // UPPER BALANCE: δεύτερο ερέθισμα στήθους/πλάτης + χέρια/κορμός
            { name: "Chest Press", sets: 4, muscleGroup: "Στήθος", weight: "54" },
            { name: "Lat Pulldowns Close", sets: 4, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Bent Over Rows", sets: 4, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Bicep Curls", sets: 3, muscleGroup: "Χέρια", weight: "30" },
            { name: "Tricep Pulldowns", sets: 3, muscleGroup: "Χέρια", weight: "20" },
            { name: "Ab Crunches", sets: 2, muscleGroup: "Κορμός", weight: "30" },
            { name: "Leg Raise Hip Lift", sets: 2, muscleGroup: "Κορμός", weight: "0" }
        ],
        // Cycling is logged through the Cardio module (km/kcal), not as a workout exercise.
        iron_saturday: [],
        iron_sunday: [
            { name: "Upright Rows", sets: 4, muscleGroup: "Ώμοι", weight: "30" }
        ],
        ems_wednesday: [
            { name: "EMS Training", sets: 1, muscleGroup: "Πλάτη", weight: "0" },
            { name: "Upright Rows", sets: 3, muscleGroup: "Ώμοι", weight: "30" },
            { name: "Bicep Curls", sets: 3, muscleGroup: "Χέρια", weight: "30" },
            { name: "Tricep Pulldowns", sets: 3, muscleGroup: "Χέρια", weight: "20" },
            { name: "Lying Knee Raise", sets: 3, muscleGroup: "Κορμός", weight: "0" },
            { name: "Plank", sets: 3, muscleGroup: "Κορμός", weight: "0" }
        ],
        ems_only_sunday: [
            { name: "Chest Press", sets: 3, muscleGroup: "Στήθος", weight: "54" },
            { name: "Lat Pulldowns Close", sets: 3, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Bicep Curls", sets: 3, muscleGroup: "Χέρια", weight: "30" },
            { name: "Tricep Pulldowns", sets: 3, muscleGroup: "Χέρια", weight: "20" },
            { name: "Leg Raise Hip Lift", sets: 4, muscleGroup: "Κορμός", weight: "0" },
            { name: "Reverse Crunch", sets: 3, muscleGroup: "Κορμός", weight: "0" }
        ],
        bike_only_tuesday: [
            { name: "Chest Press", sets: 4, muscleGroup: "Στήθος", weight: "54" },
            { name: "Chest Flys", sets: 4, muscleGroup: "Στήθος", weight: "42" },
            { name: "Pushups", sets: 4, muscleGroup: "Στήθος", weight: "0" },
            { name: "Tricep Pulldowns", sets: 4, muscleGroup: "Χέρια", weight: "20" },
            { name: "Upright Rows", sets: 3, muscleGroup: "Ώμοι", weight: "30" },
            { name: "Plank", sets: 3, muscleGroup: "Κορμός", weight: "0" }
        ],
        bike_only_wednesday: [
            { name: "Lat Pulldowns", sets: 4, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Seated Rows", sets: 4, muscleGroup: "Πλάτη", weight: "66" },
            { name: "Straight Arm Pulldowns", sets: 4, muscleGroup: "Πλάτη", weight: "30" },
            { name: "Bicep Curls", sets: 4, muscleGroup: "Χέρια", weight: "30" },
            { name: "Preacher Bicep Curls", sets: 3, muscleGroup: "Χέρια", weight: "30" },
            { name: "Lying Knee Raise", sets: 3, muscleGroup: "Κορμός", weight: "0" }
        ],
        bike_only_friday: [
            { name: "Chest Press", sets: 4, muscleGroup: "Στήθος", weight: "54" },
            { name: "Lat Pulldowns Close", sets: 4, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Bent Over Rows", sets: 4, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Bicep Curls", sets: 3, muscleGroup: "Χέρια", weight: "30" },
            { name: "Tricep Pulldowns", sets: 3, muscleGroup: "Χέρια", weight: "20" },
            { name: "Ab Crunches", sets: 2, muscleGroup: "Κορμός", weight: "30" },
            { name: "Leg Raise Hip Lift", sets: 2, muscleGroup: "Κορμός", weight: "0" }
        ],
        hybrid_tuesday: [
            { name: "Chest Press", sets: 5, muscleGroup: "Στήθος", weight: "54" },
            { name: "Chest Flys", sets: 3, muscleGroup: "Στήθος", weight: "42" },
            { name: "Lat Pulldowns", sets: 4, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Seated Rows", sets: 3, muscleGroup: "Πλάτη", weight: "66" },
            { name: "Ab Crunches", sets: 4, muscleGroup: "Κορμός", weight: "30" },
            { name: "Plank", sets: 3, muscleGroup: "Κορμός", weight: "0" }
        ],
        hybrid_friday: [
            { name: "Pushups", sets: 4, muscleGroup: "Στήθος", weight: "0" },
            { name: "Upright Rows", sets: 4, muscleGroup: "Ώμοι", weight: "30" },
            { name: "Bicep Curls", sets: 3, muscleGroup: "Χέρια", weight: "30" },
            { name: "Tricep Pulldowns", sets: 3, muscleGroup: "Χέρια", weight: "20" },
            { name: "Low Rows Seated", sets: 3, muscleGroup: "Πλάτη", weight: "36" },
            { name: "Leg Raise Hip Lift", sets: 4, muscleGroup: "Κορμός", weight: "0" }
        ],
        // Cycling is logged through the Cardio module (km/kcal), not as a workout exercise.
        bike_saturday: [],
        bike_sunday: [
            { name: "Upright Rows", sets: 4, muscleGroup: "Ώμοι", weight: "30" }
        ]
    };

    if (activePlan === 'IRON') {
        window.program["Τρίτη"] = days.iron_tuesday;
        window.program["Τετάρτη"] = days.iron_wednesday;
        window.program["Παρασκευή"] = days.iron_friday;
        window.program["Σάββατο"] = days.iron_saturday;
        window.program["Κυριακή"] = days.iron_sunday;
    } else if (activePlan === 'EMS_ONLY') {
        window.program["Τρίτη"] = days.iron_tuesday;
        window.program["Τετάρτη"] = days.ems_wednesday;
        window.program["Παρασκευή"] = days.iron_friday;
        window.program["Σάββατο"] = days.iron_saturday;
        window.program["Κυριακή"] = days.ems_only_sunday;
    } else if (activePlan === 'BIKE_ONLY') {
        window.program["Τρίτη"] = days.bike_only_tuesday;
        window.program["Τετάρτη"] = days.bike_only_wednesday;
        window.program["Παρασκευή"] = days.bike_only_friday;
        window.program["Σάββατο"] = days.bike_saturday;
        window.program["Κυριακή"] = days.bike_sunday;
    } else if (activePlan === 'HYBRID') {
        window.program["Τρίτη"] = days.hybrid_tuesday;
        window.program["Τετάρτη"] = days.ems_wednesday;
        window.program["Παρασκευή"] = days.hybrid_friday;
        window.program["Σάββατο"] = days.bike_saturday;
        window.program["Κυριακή"] = days.bike_sunday;
    }
})();

// Shared helpers for engine / reporting / optimizer
window.getPegasusExerciseGroup = function(exerciseName) {
    const cleanName = String(exerciseName || "").trim().replace(" ☀️", "");
    const exact = window.exercisesDB.find(ex => ex.name === cleanName);
    if (exact) return exact.muscleGroup;

    const n = cleanName.toLowerCase();

    if (n.includes("chest") || n.includes("pushups")) return "Στήθος";
    if (n.includes("lat") || n.includes("row") || n.includes("pulldown") || n.includes("back")) return "Πλάτη";
    if (n.includes("upright") || n.includes("shoulder")) return "Ώμοι";
    if (n.includes("bicep") || n.includes("tricep") || n.includes("curl")) return "Χέρια";
    if (n.includes("ab") || n.includes("situp") || n.includes("plank") || n.includes("crunch") || n.includes("raise")) return "Κορμός";
    if (n.includes("leg") || n.includes("cycling")) return "Πόδια";
    if (n.includes("stretch")) return "None";
    if (n.includes("ems")) return "Πλάτη";

    return "Άλλο";
};

window.getPegasusProgramSnapshot = function(dayName) {
    const buildDynamicDay = (day) => {
        try {
            if (day && window.PegasusBrain?.getDailyWorkout) {
                const raw = window.PegasusBrain.getDailyWorkout(day, {
                    isRainy: typeof window.isRaining === "function" ? window.isRaining() : false,
                    fallback: Array.isArray(window.program?.[day]) ? [...window.program[day]] : []
                }) || [];
                const mapped = window.PegasusOptimizer?.apply
                    ? window.PegasusOptimizer.apply(day, raw)
                    : raw.map(ex => ({ ...ex, adjustedSets: ex.sets }));
                return mapped
                    .filter(ex => String(ex?.name || "").trim() && Number(ex?.adjustedSets ?? ex?.sets ?? 0) > 0)
                    .sort((a, b) => (a.brainOrder ?? 999) - (b.brainOrder ?? 999))
                    .map(ex => ({
                        ...ex,
                        sets: Number(ex.adjustedSets ?? ex.sets ?? 0) || 0,
                        targetSets: Number(ex.adjustedSets ?? ex.sets ?? 0) || 0,
                        muscleGroup: ex.muscleGroup || window.getPegasusExerciseGroup?.(ex.name)
                    }));
            }
        } catch (e) {
            console.warn("PEGASUS PROGRAM SNAPSHOT: Dynamic plan fallback used.", e);
        }
        return Array.isArray(window.program?.[day]) ? window.program[day].map(ex => ({ ...ex })) : [];
    };

    if (dayName) return buildDynamicDay(dayName);

    const snapshot = {};
    Object.keys(window.program || {}).forEach(day => {
        snapshot[day] = buildDynamicDay(day);
    });
    return snapshot;
};


// 4.5 MUSCLE BADGE HELPERS (PEGASUS 134)
window.PegasusMuscleEmojiMap = {
    "Στήθος": "🟩",
    "Πλάτη": "🪽",
    "Πόδια": "🦵",
    "Χέρια": "💪",
    "Ώμοι": "🔺",
    "Κορμός": "🧱",
    "None": "🌿",
    "Άλλο": "▫️"
};

window.getPegasusMuscleEmoji = function(group) {
    return window.PegasusMuscleEmojiMap[group] || window.PegasusMuscleEmojiMap["Άλλο"];
};

window.getPegasusMuscleBadge = function(exerciseOrGroup) {
    const group = (typeof exerciseOrGroup === "string" && window.PegasusMuscleEmojiMap[exerciseOrGroup])
        ? exerciseOrGroup
        : window.getPegasusExerciseGroup(exerciseOrGroup?.name || exerciseOrGroup || "");
    if (!group || group === "None") return "";
    return `${window.getPegasusMuscleEmoji(group)} ${group}`;
};

// 5. KOUKI MENU CONSOLIDATION
window.PegasusKoukiDB = [
    { name: "Μουσακάς", type: "carb", price: 6.00, kcal: 830, protein: 26, side: false },
    { name: "Παστίτσιο", type: "carb", price: 6.00, kcal: 750, protein: 35, side: false },
    { name: "Μπακαλιάρος σκορδαλιά", type: "psari", price: 6.50, kcal: 550, protein: 35 },
    { name: "Κοτόσουπα", type: "soup", price: 4.50, kcal: 400, protein: 30 },
    { name: "Μοσχάρι κοκκινιστό", type: "kreas", price: 6.50, kcal: 640, protein: 45 },
    { name: "Μοσχάρι γιουβέτσι", type: "kreas", price: 6.50, kcal: 640, protein: 45 },
    { name: "Γεμιστά με ρύζι", type: "ladero", price: 5.00, kcal: 450, protein: 10 },
    { name: "Φασολάδα", type: "ospro", price: 4.50, kcal: 400, protein: 18 },
    { name: "Γίγαντες πλακί", type: "ospro", price: 6.00, kcal: 500, protein: 20 },
    { name: "Μπάμιες με κοτόπουλο", type: "poulika", price: 6.00, kcal: 520, protein: 45 },
    { name: "Μακαρόνια με κιμά", type: "carb", price: 5.50, kcal: 600, protein: 30, side: false },
    { name: "Φασολάκια", type: "ladero", price: 4.50, kcal: 350, protein: 8 },
    { name: "Κοτόπουλο αλά κρεμ", type: "poulika", price: 6.00, kcal: 620, protein: 50 },
    { name: "Κοτόπουλο γλυκόξινο", type: "poulika", price: 6.00, kcal: 580, protein: 48 },
    { name: "Κοτόπουλο φούρνου", type: "poulika", price: 6.00, kcal: 600, protein: 52 },
    { name: "Μπριζόλα χοιρινή", type: "kreas", price: 6.00, kcal: 550, protein: 42 },
    { name: "Μπριζόλα μοσχαρίσια", type: "kreas", price: 8.50, kcal: 600, protein: 50 },
    { name: "Μπιφτέκι μοσχαρίσιο", type: "kreas", price: 6.00, kcal: 520, protein: 42 },
    { name: "Μπριάμ", type: "ladero", price: 5.50, kcal: 420, protein: 9 },
    { name: "Λαχανόπιτα", type: "pita", price: 2.00, kcal: 340, protein: 10, side: false },
    { name: "Γαλατόπιτα", type: "dessert", price: 2.00, kcal: 330, protein: 9, side: false },
    { name: "Αλευρόπιτα", type: "pita", price: 1.50, kcal: 300, protein: 8, side: false },
    { name: "Κανελόνια", type: "carb", price: 6.00, kcal: 700, protein: 28, side: false },
    { name: "Αρακάς", type: "ladero", price: 4.50, kcal: 380, protein: 12 },
    { name: "Ρεβύθια πλακί", type: "ospro", price: 5.00, kcal: 480, protein: 19 },
    { name: "Γεμιστά με κιμά", type: "kreas", price: 6.00, kcal: 550, protein: 30 },
    { name: "Κεφτεδάκια τηγανητά", type: "kreas", price: 6.50, kcal: 600, protein: 35 },
    { name: "Γιουβαρλάκια", type: "kreas", price: 5.50, kcal: 520, protein: 32 },
    { name: "Σνίτσελ κοτόπουλο", type: "poulika", price: 6.00, kcal: 650, protein: 45 },
    { name: "Κοντοσούβλι κοτόπουλο", type: "poulika", price: 6.00, kcal: 560, protein: 50 },
    { name: "Λαζάνια με κιμά", type: "carb", price: 6.00, kcal: 720, protein: 32, side: false },
    { name: "Μοσχάρι βραστό", type: "kreas", price: 6.00, kcal: 640, protein: 45 },
    { name: "Μπιφτέκι κοτόπουλο", type: "poulika", price: 6.00, kcal: 480, protein: 45 },
    { name: "Γίγαντες με χόρτα", type: "ospro", price: 6.00, kcal: 500, protein: 20 },
    { name: "Χταπόδι με κοφτό μακαρονάκι", type: "psari", price: 7.00, kcal: 620, protein: 34, side: false },
    { name: "Σακές", type: "ladero", price: 4.50, kcal: 420, protein: 14 },
    { name: "Σολομός φούρνου", type: "psari", price: 8.00, kcal: 550, protein: 40 },
    { name: "Μπατσαρία", type: "pita", price: 2.00, kcal: 320, protein: 10, side: false },
    { name: "Κοτόπιτα", type: "pita", price: 2.50, kcal: 420, protein: 20, side: false },
    { name: "Μοσχάρι με μελιτζάνες", type: "kreas", price: 6.50, kcal: 640, protein: 45 },
    { name: "Σουπιές με σπανάκι", type: "psari", price: 7.00, kcal: 450, protein: 35 },
    { name: "Μελιτζάνες ιμάμ", type: "ladero", price: 6.00, kcal: 520, protein: 12 },
    { name: "Γαριδομακαρονάδα", type: "psari", price: 6.50, kcal: 650, protein: 30, side: false },
    { name: "Φιλέτο κοτόπουλο με καρότα", type: "poulika", price: 6.00, kcal: 420, protein: 48 },
    { name: "Μακαρονόπιτα", type: "pita", price: 2.00, kcal: 450, protein: 15, side: false },
    { name: "Λαζάνια με κοτόπουλο", type: "carb", price: 6.00, kcal: 700, protein: 34 },
    { name: "Παπουτσάκια", type: "ladero", price: 6.00, kcal: 580, protein: 20 },
    { name: "Σπανακόρυζο", type: "ladero", price: 4.50, kcal: 390, protein: 10 },
    { name: "Μπιφτέκι γεμιστό", type: "kreas", price: 6.50, kcal: 520, protein: 42 },
    { name: "Σουτζουκάκια", type: "kreas", price: 6.50, kcal: 620, protein: 35 },
    { name: "Ογκρατέν ζυμαρικών", type: "carb", price: 6.00, kcal: 650, protein: 24, side: false },
    { name: "Μπακαλιάρος με κρεμμύδια", type: "psari", price: 6.00, kcal: 550, protein: 35 },
    { name: "Μπάμιες", type: "ladero", price: 5.00, kcal: 360, protein: 8 },
    { name: "Γεμιστά κολοκυθάκια", type: "ladero", price: 6.00, kcal: 430, protein: 10 },
    { name: "Τσιπούρα φούρνου", type: "psari", price: 8.00, kcal: 520, protein: 42 },
    { name: "Αρνί με πατάτες", type: "kreas", price: 7.50, kcal: 750, protein: 45 },
    { name: "Κοντοσούβλι χοιρινό", type: "kreas", price: 6.00, kcal: 640, protein: 45 },
    { name: "Πέρκα φούρνου", type: "psari", price: 7.00, kcal: 500, protein: 40 }
];

// 6. DYNAMIC WEEKLY BRIDGE & HELPERS
(function buildWeeklyMenu() {
    const rawMenu = {
        "Monday": ["Μουσακάς", "Παστίτσιο", "Μπακαλιάρος σκορδαλιά", "Κοτόσουπα", "Μοσχάρι κοκκινιστό", "Μοσχάρι γιουβέτσι", "Γεμιστά με ρύζι", "Φασολάδα", "Γίγαντες πλακί", "Μπάμιες με κοτόπουλο", "Μακαρόνια με κιμά", "Φασολάκια", "Κοτόπουλο αλά κρεμ", "Κοτόπουλο γλυκόξινο", "Κοτόπουλο φούρνου", "Μπριζόλα χοιρινή", "Μπριζόλα μοσχαρίσια", "Μπιφτέκι μοσχαρίσιο", "Μπριάμ", "Λαχανόπιτα", "Γαλατόπιτα", "Αλευρόπιτα"],
        "Tuesday": ["Μουσακάς", "Παστίτσιο", "Κανελόνια", "Αρακάς", "Ρεβύθια πλακί", "Γεμιστά με κιμά", "Μοσχάρι κοκκινιστό", "Κεφτεδάκια τηγανητά", "Γιουβαρλάκια", "Μακαρόνια με κιμά", "Σνίτσελ κοτόπουλο", "Κοντοσούβλι κοτόπουλο", "Κοτόπουλο αλά κρεμ", "Κοτόπουλο γλυκόξινο", "Κοτόπουλο φούρνου", "Μπριζόλα χοιρινή", "Μπριζόλα μοσχαρίσια", "Λαχανόπιτα", "Γαλατόπιτα", "Αλευρόπιτα"],
        "Wednesday": ["Μουσακάς", "Παστίτσιο", "Λαζάνια με κιμά", "Μοσχάρι βραστό", "Μπιφτέκι κοτόπουλο", "Γίγαντες με χόρτα", "Χταπόδι με κοφτό μακαρονάκι", "Μακαρόνια με κιμά", "Γεμιστά με ρύζι", "Μοσχάρι κοκκινιστό", "Μοσχάρι γιουβέτσι", "Σακές", "Σολομός φούρνου", "Κοτόπουλο φούρνου", "Κοτόπουλο αλά κρεμ", "Κοτόπουλο γλυκόξινο", "Μπατσαρία", "Κοτόπιτα", "Γαλατόπιτα"],
        "Thursday": ["Μουσακάς", "Παστίτσιο", "Κανελόνια", "Κεφτεδάκια τηγανητά", "Μοσχάρι με μελιτζάνες", "Γεμιστά με κιμά", "Σουπιές με σπανάκι", "Φασολάκια", "Μελιτζάνες ιμάμ", "Κοτόσουπα", "Γαριδομακαρονάδα", "Μοσχάρι κοκκινιστό", "Μακαρόνια με κιμά", "Κοτόπουλο φούρνου", "Μπριζόλα χοιρινή", "Μπριζόλα μοσχαρίσια", "Φιλέτο κοτόπουλο με καρότα", "Λαχανόπιτα", "Μακαρονόπιτα", "Αλευρόπιτα"],
        "Friday": ["Μουσακάς", "Παστίτσιο", "Λαζάνια με κοτόπουλο", "Μπακαλιάρος σκορδαλιά", "Παπουτσάκια", "Φασολάδα", "Σπανακόρυζο", "Γεμιστά με ρύζι", "Μπιφτέκι γεμιστό", "Γίγαντες πλακί", "Μοσχάρι γιουβέτσι", "Μοσχάρι κοκκινιστό", "Κοτόπουλο φούρνου", "Μακαρόνια με κιμά", "Σουτζουκάκια", "Κοτόσουπα", "Κοτόπουλο αλά κρεμ", "Κοτόπουλο γλυκόξινο", "Λαχανόπιτα", "Κοτόπιτα", "Αλευρόπιτα"],
        "Saturday": ["Μουσακάς", "Παστίτσιο", "Ογκρατέν ζυμαρικών", "Μπακαλιάρος με κρεμμύδια", "Μπάμιες", "Γεμιστά με ρύζι", "Μπιφτέκι κοτόπουλο", "Γεμιστά κολοκυθάκια", "Γιουβαρλάκια", "Τσιπούρα φούρνου", "Αρνί με πατάτες", "Μοσχάρι γιουβέτσι", "Κοτόπουλο φούρνου", "Μοσχάρι κοκκινιστό", "Κοντοσούβλι χοιρινό", "Μακαρόνια με κιμά", "Λαχανόπιτα", "Γαλατόπιτα", "Αλευρόπιτα"],
        "Sunday": ["Μουσακάς", "Παστίτσιο", "Κανελόνια", "Μοσχάρι γιουβέτσι", "Μοσχάρι κοκκινιστό", "Γίγαντες με χόρτα", "Κοτόσουπα", "Πέρκα φούρνου", "Μπιφτέκι γεμιστό", "Κεφτεδάκια τηγανητά", "Γαριδομακαρονάδα", "Μακαρόνια με κιμά", "Κοτόπουλο φούρνου", "Μπριζόλα χοιρινή", "Μπριζόλα μοσχαρίσια", "Λαχανόπιτα", "Γαλατόπιτα", "Αλευρόπιτα"]
    };

    window.KOUKI_MASTER_MENU = {};
    for (const day in rawMenu) {
        window.KOUKI_MASTER_MENU[day] = rawMenu[day].map(foodName => {
            const data = window.PegasusKoukiDB.find(f => f.name === foodName) || { price: 6.00, type: "kreas", kcal: 550, protein: 30 };
            return { n: foodName, p: data.price, t: data.type, kcal: data.kcal, protein: data.protein, side: data.side };
        });
    }
})();

window.getPegasusMacros = function(foodName, fallbackType) {
    const item = window.PegasusKoukiDB.find(f => f.name === foodName || f.name.includes(foodName));
    const type = item ? item.type : fallbackType;
    const noSideTypes = ["carb", "soup", "pita", "dessert"];
    const needsRice = item?.side === false ? false : !noSideTypes.includes(type);
    const riceKcal = needsRice ? 280 : 0;
    const riceProt = needsRice ? 6 : 0;

    if (item) {
        return {
            kcal: item.kcal + riceKcal,
            protein: item.protein + riceProt
        };
    }

    let p = (type === 'kreas' || type === 'poulika') ? 45 : (type === 'ospro' ? 18 : 25);
    return { kcal: 550 + riceKcal, protein: p + riceProt };
};

window.getDynamicTargets = function() {
    const fallbackTargets = { "Στήθος": 16, "Πλάτη": 20, "Ώμοι": 3, "Χέρια": 17, "Πόδια": 8, "Κορμός": 10 };
    try {
        const key = window.PegasusManifest?.workout?.muscleTargets || "pegasus_muscle_targets";
        const stored = JSON.parse(localStorage.getItem(key) || "null");
        return stored && typeof stored === "object" ? { ...fallbackTargets, ...stored } : fallbackTargets;
    } catch (e) {
        return fallbackTargets;
    }
};
