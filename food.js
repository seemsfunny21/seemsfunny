/* ==========================================================================
   PEGASUS FOOD ENGINE - v10.1 (CARDIO TARGET PULL PATCH)
   Protocol: Shared Metabolic Helpers + Strict Date Mapping + Safe Diet Targets
   Status: FINAL STABLE | DESKTOP/MOBILE TARGET CORE UNIFIED
   ========================================================================== */

var M = M || window.PegasusManifest;
if (!M) console.error("❌ CRITICAL: PegasusManifest missing in food.js");

if (!(window.currentFoodDate instanceof Date) || isNaN(window.currentFoodDate.getTime())) {
    window.currentFoodDate = new Date();
}
window.lastKnownSystemDate = new Date().toDateString();

document.addEventListener('DOMContentLoaded', () => {
    updateFoodUI();

    const btnAdd = document.getElementById('btnAddFood');
    if (btnAdd) {
        btnAdd.onclick = () => {
            const nameEl = document.getElementById('foodName');
            const kcalEl = document.getElementById('foodKcal');
            const protEl = document.getElementById('foodNote');

            const name = nameEl?.value;
            const kcal = kcalEl?.value;
            const protein = protEl?.value || 0;

            if (name && kcal) {
                addFoodItem(name, kcal, protein);
                if (nameEl) nameEl.value = "";
                if (kcalEl) kcalEl.value = "";
                if (protEl) protEl.value = "";
            } else {
                alert("PEGASUS STRICT: Συμπλήρωσε Φαγητό και Θερμίδες!");
            }
        };
    }

    const prevBtn = document.getElementById('btnPrevDay');
    const nextBtn = document.getElementById('btnNextDay');
    if (prevBtn) prevBtn.onclick = () => changeFoodDate(-1);
    if (nextBtn) nextBtn.onclick = () => changeFoodDate(1);

    const btnFoodUI = document.getElementById('btnFoodUI');
    if (btnFoodUI) {
        btnFoodUI.addEventListener('click', () => {
            setTimeout(window.renderKoukiMenu, 300);
        });
    }

    const searchInput = document.getElementById('librarySearch');
    if (searchInput) {
        searchInput.oninput = () => window.filterLibrary();
    }
});

window.addEventListener("pegasus_sync_complete", () => {
    const panel = document.getElementById("foodPanel");
    if (panel && panel.style.display !== "none") {
        window.updateFoodUI?.();
        window.updateKcalUI?.();
        window.PegasusMetabolic?.renderUI?.();
    }
});

function changeFoodDate(days) {
    window.currentFoodDate.setDate(window.currentFoodDate.getDate() + days);
    updateFoodUI();
}

/* ===== DATE HELPERS ===== */
function getPegasusDateParts(dateObj) {
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = dateObj.getFullYear();
    return { d, m, y };
}

function getPegasusDateStr(dateObj) {
    const parts = getPegasusDateParts(dateObj);
    return `${parts.d}/${parts.m}/${parts.y}`;
}

function getWorkoutDateKey(dateObj) {
    const parts = getPegasusDateParts(dateObj);
    return `${parts.y}-${parts.m}-${parts.d}`;
}

/* ===== STRICT DATE BRIDGE ===== */
window.getStrictDateStr = function() {
    const currentSystemDate = new Date().toDateString();

    if (window.lastKnownSystemDate !== currentSystemDate) {
        window.currentFoodDate = new Date();
        window.lastKnownSystemDate = currentSystemDate;
        console.log("🛡️ PEGASUS GUARD: Midnight Rollover Executed.");
    }

    const d = window.currentFoodDate || new Date();
    return getPegasusDateStr(d);
};

function getDynamicBMR() {
    const wKey = M?.user?.weight || "pegasus_weight";
    const hKey = M?.user?.height || "pegasus_height";
    const aKey = M?.user?.age || "pegasus_age";
    const gKey = M?.user?.gender || "pegasus_gender";

    const w = parseFloat(localStorage.getItem(wKey)) || 74;
    const h = parseFloat(localStorage.getItem(hKey)) || 187;
    const a = parseInt(localStorage.getItem(aKey)) || 38;
    const g = localStorage.getItem(gKey) || "male";

    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    return (g === "male") ? bmr + 5 : bmr - 161;
}

/* ===== UNIFIED DIET TARGET HELPERS ===== */
function getCardioOffsetForDate(dateObj) {
    const targetDate = dateObj || new Date();

    const todayStr = getPegasusDateStr(new Date());
    const requestedStr = getPegasusDateStr(targetDate);
    const requestedKey = getWorkoutDateKey(targetDate);

    if (requestedStr === todayStr && typeof window.getPegasusTodayCardioOffset === "function") {
        return window.getPegasusTodayCardioOffset();
    }

    if (window.PegasusMetabolic?.getCardioOffsetForDate) {
        return window.PegasusMetabolic.getCardioOffsetForDate(requestedStr);
    }

    const aliases = Array.from(new Set([requestedStr, requestedKey]));
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
        if (Array.isArray(history)) {
            const aliasSet = new Set(aliases);
            history.forEach(entry => {
                if (aliasSet.has(String(entry?.date || '').trim())) {
                    historyValue += parseFloat(entry?.kcal || 0) || 0;
                }
            });
        }
    } catch (e) {}

    return Math.round(Math.max(directValue, historyValue));
}

function getWorkoutBurnForDate(dateObj) {
    const targetDate = dateObj || new Date();
    const requestedStr = getPegasusDateStr(targetDate);
    const requestedKey = getWorkoutDateKey(targetDate);

    if (window.PegasusMetabolic?.getWorkoutBurnForDate) {
        return window.PegasusMetabolic.getWorkoutBurnForDate(requestedStr);
    }

    if (typeof window.getPegasusWorkoutKcalForDate === "function") {
        return window.getPegasusWorkoutKcalForDate(requestedStr);
    }

    const aliases = Array.from(new Set([requestedStr, requestedKey]));
    const prefixes = ["pegasus_workout_kcal_", "pegasus_strength_kcal_", "pegasus_gym_kcal_"];
    let directValue = 0;
    aliases.forEach(alias => prefixes.forEach(prefix => {
        const value = parseFloat(localStorage.getItem(prefix + alias));
        if (!isNaN(value)) directValue = Math.max(directValue, value);
    }));
    return Math.round(directValue);
}

function getExerciseBurnForDate(dateObj) {
    const targetDate = dateObj || new Date();
    const requestedStr = getPegasusDateStr(targetDate);

    if (window.PegasusMetabolic?.getExerciseBurnForDate) {
        return window.PegasusMetabolic.getExerciseBurnForDate(requestedStr);
    }

    if (typeof window.getPegasusExerciseBurnForDate === "function") {
        return window.getPegasusExerciseBurnForDate(requestedStr);
    }

    return Math.round(getCardioOffsetForDate(targetDate) + getWorkoutBurnForDate(targetDate));
}

function getBaseDietTargetForDate(dateObj) {
    const targetDate = dateObj || new Date();

    const todayStr = getPegasusDateStr(new Date());
    const requestedStr = getPegasusDateStr(targetDate);

    if (requestedStr === todayStr && typeof window.getPegasusBaseDailyTarget === "function") {
        return window.getPegasusBaseDailyTarget();
    }

    const greekDays = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
    const dayName = greekDays[targetDate.getDay()];

    const settings = (typeof window.getPegasusSettings === "function")
        ? window.getPegasusSettings()
        : { activeSplit: "IRON" };

    const activePlan = settings.activeSplit || "IRON";

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
}

function calculateDailyCalorieTarget(dateObj) {
    const targetDate = dateObj || new Date();

    const todayStr = getPegasusDateStr(new Date());
    const requestedStr = getPegasusDateStr(targetDate);

    if (requestedStr === todayStr && typeof window.getPegasusEffectiveDailyTarget === "function") {
        return window.getPegasusEffectiveDailyTarget();
    }

    const baseTarget = getBaseDietTargetForDate(targetDate);
    const exerciseBurn = getExerciseBurnForDate(targetDate);
    if (typeof window.getPegasusFinalDailyTargetFromBurn === 'function') {
        return window.getPegasusFinalDailyTargetFromBurn(baseTarget, exerciseBurn);
    }
    return Math.round(baseTarget + exerciseBurn);
}

window.updateFoodUI = function() {
    const dateStr = window.getStrictDateStr();
    const display = document.getElementById('currentFoodDateDisplay');
    if (display) display.textContent = dateStr;

    const logPrefix = M?.nutrition?.log_prefix || "food_log_";
    const logKey = logPrefix + dateStr;
    const foodLog = JSON.parse(localStorage.getItem(logKey) || "[]");

    const listContainer = document.getElementById('todayFoodList');
    if (!listContainer) return;

    listContainer.innerHTML = "";
    let totalKcal = 0;
    let totalProtein = 0;

    foodLog.forEach((item, index) => {
        totalKcal += parseFloat(item.kcal) || 0;
        totalProtein += parseFloat(item.protein) || 0;

        const div = document.createElement('div');
        div.className = 'food-item';
        div.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#111; padding:10px; margin-bottom:5px; border-left:3px solid #4CAF50; border-radius:4px;";

        const infoWrap = document.createElement('div');
        infoWrap.style.cssText = "display: flex; flex-direction: column; flex: 1;";

        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = "font-weight: bold; color: #eee; font-size: 14px;";
        nameSpan.textContent = item.name;

        const metaSpan = document.createElement('span');
        metaSpan.style.cssText = "font-size: 11px; color: #4CAF50;";
        metaSpan.textContent = `${item.kcal} kcal | ${item.protein}g P`;

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', () => {
            window.deleteFoodItem(index);
        });

        infoWrap.appendChild(nameSpan);
        infoWrap.appendChild(metaSpan);
        div.appendChild(infoWrap);
        div.appendChild(delBtn);

        listContainer.appendChild(div);
    });

    const todayProtKey = M?.diet?.todayProtein || "pegasus_today_protein";
    localStorage.setItem(todayProtKey, totalProtein.toFixed(0));

    const kcalNum = document.getElementById('todayTotalKcal');
    if (kcalNum) kcalNum.textContent = totalKcal.toFixed(0);

    updateProgressBars(totalKcal, totalProtein);

    if (typeof window.filterLibrary === "function") window.filterLibrary();
    if (typeof window.renderKoukiMenu === "function") window.renderKoukiMenu();
};

window.PegasusRoutineNames = window.PegasusRoutineNames || [
    "Γιαούρτι 2% + Whey (Ρουτίνα)",
    "3 Αυγά (Ρουτίνα)",
    "Πρωτεΐνη 1 Scoop (Ρουτίνα)",
    "Κρεατίνη 5g (Ρουτίνα)"
];

window.normalizePegasusRoutineName = window.normalizePegasusRoutineName || function(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
};

window.isPegasusRoutineName = window.isPegasusRoutineName || function(value) {
    const clean = window.normalizePegasusRoutineName(value);
    return window.PegasusRoutineNames.some(name => window.normalizePegasusRoutineName(name) === clean);
};

window.dedupePegasusRoutineLog = window.dedupePegasusRoutineLog || function(foodLog) {
    const routineSet = new Set(window.PegasusRoutineNames.map(window.normalizePegasusRoutineName));
    const seen = new Set();
    const cleaned = [];
    const removed = [];

    (Array.isArray(foodLog) ? foodLog : []).forEach(item => {
        const clean = window.normalizePegasusRoutineName(item?.name);
        if (routineSet.has(clean)) {
            if (seen.has(clean)) {
                removed.push(item);
                return;
            }
            seen.add(clean);
        }
        cleaned.push(item);
    });

    return { cleaned, removed };
};

window.addFoodItem = function(name, kcal, protein) {
    const dateStr = window.getStrictDateStr();
    const logPrefix = M?.nutrition?.log_prefix || "food_log_";
    const logKey = logPrefix + dateStr;
    let foodLog = JSON.parse(localStorage.getItem(logKey) || "[]");

    const routineDedupe = window.dedupePegasusRoutineLog(foodLog);
    foodLog = routineDedupe.cleaned;

    if (routineDedupe.removed.length) {
        localStorage.setItem(logKey, JSON.stringify(foodLog));
        console.warn(`🧹 PEGASUS PC: Removed ${routineDedupe.removed.length} duplicate routine entries before add.`);
    }

    if (window.isPegasusRoutineName(name)) {
        const cleanName = window.normalizePegasusRoutineName(name);
        const alreadyExists = foodLog.some(item => window.normalizePegasusRoutineName(item?.name) === cleanName);
        if (alreadyExists) {
            localStorage.setItem("pegasus_routine_injected_" + dateStr, "true");
            window.updateFoodUI();
            return false;
        }
    }

    foodLog.unshift({
        name: name,
        kcal: parseFloat(kcal),
        protein: parseFloat(protein || 0)
    });

    localStorage.setItem(logKey, JSON.stringify(foodLog));

    if (window.PegasusInventoryPC) {
        window.PegasusInventoryPC.processEntry(name);
    } else {
        if (String(name || "").toLowerCase().includes("πρωτεΐνη") && window.consumeSupp) {
            window.consumeSupp('prot', 30, false);
        }
    }

    if (typeof window.addToLibrary === "function") window.addToLibrary(name, kcal, protein);

    const searchInput = document.getElementById('librarySearch');
    if (searchInput) searchInput.value = "";

    window.updateFoodUI();
    if (window.PegasusCloud) window.PegasusCloud.push(true);
    return true;
};

window.deleteFoodItem = function(index) {
    const dateStr = window.getStrictDateStr();
    const logPrefix = M?.nutrition?.log_prefix || "food_log_";
    const logKey = logPrefix + dateStr;

    let foodLog = JSON.parse(localStorage.getItem(logKey) || "[]");
    const removedItem = foodLog.splice(index, 1)[0];

    if (removedItem?.name) {
        if (window.PegasusInventoryPC?.restoreEntry) {
            window.PegasusInventoryPC.restoreEntry(removedItem.name);
        } else if (window.PegasusInventory?.restoreEntry) {
            window.PegasusInventory.restoreEntry(removedItem.name);
        } else if (window.restoreFoodEntry) {
            window.restoreFoodEntry(removedItem.name);
        }
    }

    localStorage.setItem(logKey, JSON.stringify(foodLog));

    window.updateFoodUI();
    if (window.PegasusCloud) window.PegasusCloud.push(true);
};

function updateProgressBars(kcal, protein) {
    const goalKcal = calculateDailyCalorieTarget(window.currentFoodDate);
    const goalProtein = 160;

    const kBar = document.getElementById('kcalBar');
    const pBar = document.getElementById('proteinBar');

    if (kBar) {
        const kcalRatio = goalKcal > 0 ? Math.min((kcal / goalKcal) * 100, 100) : 0;
        kBar.style.width = kcalRatio + "%";
    }

    if (pBar) {
        const protRatio = goalProtein > 0 ? Math.min((protein / goalProtein) * 100, 100) : 0;
        pBar.style.width = protRatio + "%";
    }

    const kStat = document.getElementById('kcalStatus');
    const pStat = document.getElementById('proteinStatus');

    if (kStat) {
        kStat.textContent = `${Math.round(kcal)} / ${goalKcal} kcal`;
        const burn = getExerciseBurnForDate(window.currentFoodDate || new Date());
        const cardio = getCardioOffsetForDate(window.currentFoodDate || new Date());
        const workout = getWorkoutBurnForDate(window.currentFoodDate || new Date());
        const modeLabel = window.getPegasusBodyGoalLabel ? window.getPegasusBodyGoalLabel() : ((window.PegasusI18n?.getLanguage?.() || localStorage.getItem('pegasus_language')) === 'en' ? 'Cutting' : 'Γράμμωση');
        const refeed = window.getPegasusExerciseRefeedForTarget ? window.getPegasusExerciseRefeedForTarget(burn) : burn;
        kStat.title = `${modeLabel}: βάση + αναπλήρωση ${refeed} kcal από καύσεις ${burn} kcal (προπόνηση ${workout}, ποδηλασία ${cardio})`;
    }
    if (pStat) pStat.textContent = `${Math.round(protein)} / ${goalProtein}g`;
}

/* === PEGASUS FOOD ENGINE: DYNAMIC KOUKI INTEGRATION (v10.0) === */
window.renderKoukiMenu = function() {
    const container = document.getElementById('koukiQuickMenu');
    if (!container) return;

    const daysMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetDate = window.currentFoodDate || new Date();
    const targetDayKey = daysMap[targetDate.getDay()];

    const greekDays = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
    const targetDayName = greekDays[targetDate.getDay()];

    const todayMenu = (typeof KOUKI_MASTER_MENU !== 'undefined') ? KOUKI_MASTER_MENU[targetDayKey] : [];

    container.innerHTML = `
        <h4 style="color: #4CAF50; border-bottom: 1px solid #333; padding-bottom: 5px; margin-top: 15px; font-size: 13px; font-weight: bold;">📍 ${targetDayName.toUpperCase()} (ΚΟΥΚΙ)</h4>
        <div id="koukiQuickMenuGrid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; width: 100%;"></div>
    `;

    const grid = document.getElementById('koukiQuickMenuGrid');
    if (!grid) return;

    todayMenu.forEach(item => {
        let protein, kcal;

        if (typeof window.getPegasusMacros === "function") {
            const macros = window.getPegasusMacros(item.n, item.t);
            protein = macros.protein;
            kcal = macros.kcal;
        } else {
            protein = (item.t === 'kreas' || item.t === 'poulika') ? 45 : (item.t === 'ospro' ? 18 : 25);
            kcal = (item.p >= 6.5) ? 680 : 520;
            if (item.n === "Μουσακάς") { kcal = 830; protein = 26; }
            if (item.n === "Παστίτσιο") { kcal = 750; protein = 35; }
        }

        const btn = document.createElement('button');
        btn.style.cssText = "background: #0a0a0a; border: 1px solid #333; color: #eee; padding: 12px 10px; border-radius: 8px; font-size: 11px; cursor: pointer; text-align: left; transition: 0.2s;";

        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = "color: #eee; font-weight: bold; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px;";
        titleDiv.textContent = item.n;

        const metaWrap = document.createElement('div');
        metaWrap.style.cssText = "display: flex; flex-direction: column; gap: 3px;";

        const kcalSpan = document.createElement('span');
        kcalSpan.style.cssText = "color: #4CAF50; font-weight: bold; font-size: 10px; letter-spacing: 0.5px;";
        kcalSpan.textContent = `🔥 ${kcal} KCAL`;

        const proteinSpan = document.createElement('span');
        proteinSpan.style.cssText = "color: #81C784; font-weight: bold; font-size: 10px; letter-spacing: 0.5px;";
        proteinSpan.textContent = `🍗 ${protein}G Protein`;

        metaWrap.appendChild(kcalSpan);
        metaWrap.appendChild(proteinSpan);
        btn.appendChild(titleDiv);
        btn.appendChild(metaWrap);

        btn.addEventListener('click', () => {
            window.addFoodItem(`${item.n} (Κούκι)`, kcal, protein);
        });

        grid.appendChild(btn);
    });
};

window.addQuickFood = function(name, kcal, protein) {
    const nameInp = document.getElementById('foodName');
    const kcalInp = document.getElementById('foodKcal');
    const protInp = document.getElementById('foodNote');
    const addBtn = document.getElementById('btnAddFood');

    if (nameInp && kcalInp && protInp && addBtn) {
        nameInp.value = name;
        kcalInp.value = kcal;
        protInp.value = protein;
        addBtn.click();
    }
};

window.filterLibrary = function() {
    const searchTerm = document.getElementById('librarySearch')?.value.toLowerCase() || "";
    const libKey = M?.diet?.foodLibrary || "pegasus_food_library";
    const library = JSON.parse(localStorage.getItem(libKey) || "[]");

    const libContainer = document.getElementById('libraryFoodList');
    if (!libContainer) return;

    libContainer.innerHTML = "";

    library
        .filter(item => item.name.toLowerCase().includes(searchTerm))
        .forEach(item => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#111; padding:10px; margin-bottom:5px; border:1px solid #4CAF50; border-radius:4px;";

            const clickable = document.createElement('div');
            clickable.style.cssText = "display: flex; flex-direction: column; flex: 1; cursor: pointer;";

            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = "font-weight: bold; color: #eee; font-size: 14px;";
            nameSpan.textContent = `+ ${item.name}`;

            const metaSpan = document.createElement('span');
            metaSpan.style.cssText = "font-size: 11px; color: #4CAF50;";
            metaSpan.textContent = `${item.kcal} kcal | ${item.protein || 0}g P`;

            clickable.appendChild(nameSpan);
            clickable.appendChild(metaSpan);
            clickable.addEventListener('click', () => {
                window.addFoodItem(item.name, item.kcal, item.protein);
            });

            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.textContent = '✕';
            delBtn.addEventListener('click', () => {
                window.removeFromLibrary(item.name);
            });

            wrapper.appendChild(clickable);
            wrapper.appendChild(delBtn);
            libContainer.appendChild(wrapper);
        });
};

window.addToLibrary = function(name, kcal, protein) {
    const libKey = M?.diet?.foodLibrary || "pegasus_food_library";
    let library = JSON.parse(localStorage.getItem(libKey) || "[]");

    if (!library.some(item => item.name.toLowerCase() === name.toLowerCase())) {
        library.push({
            name: name,
            kcal: kcal,
            protein: parseFloat(protein || 0)
        });
        localStorage.setItem(libKey, JSON.stringify(library));
    }
};

window.removeFromLibrary = function(name) {
    const libKey = M?.diet?.foodLibrary || "pegasus_food_library";
    let library = JSON.parse(localStorage.getItem(libKey) || "[]");

    library = library.filter(item => item.name !== name);
    localStorage.setItem(libKey, JSON.stringify(library));
    window.filterLibrary();
};

window.renderFood = window.updateFoodUI;
