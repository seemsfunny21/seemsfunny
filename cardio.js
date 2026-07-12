/* ==========================================================================
   PEGASUS OS - CARDIO & CYCLING AUTOMATION ENGINE (v2.4)
   Protocol: Unified Cardio Offset, Desktop/Mobile Diet Sync & Muscle Sync
   Status: FINAL STABLE | FIXED: UNCAPPED CYCLING LOAD + IMMEDIATE PUSH
   ========================================================================== */

// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;

function getPegasusLocalInputDate() {
    if (typeof window.getPegasusLocalDateKey === "function") {
        return window.getPegasusLocalDateKey();
    }

    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


function getPegasusCardioDateAliasesFromParts(d, m, y) {
    const dd = String(parseInt(d, 10));
    const mm = String(parseInt(m, 10));
    const paddedD = String(d).padStart(2, '0');
    const paddedM = String(m).padStart(2, '0');
    return Array.from(new Set([
        `${paddedD}/${paddedM}/${y}`,
        `${y}-${paddedM}-${paddedD}`,
        `${dd}/${mm}/${y}`,
        `${y}${paddedM}${paddedD}`
    ]));
}

function pegasusReadMaxNumber(prefixes, aliases) {
    let value = 0;
    prefixes.forEach(prefix => aliases.forEach(alias => {
        const parsed = parseFloat(localStorage.getItem(prefix + alias));
        if (!isNaN(parsed)) value = Math.max(value, parsed);
    }));
    return value;
}

function pegasusWriteAliasNumbers(prefixes, aliases, value) {
    const normalized = Number(value || 0).toFixed(1);
    prefixes.forEach(prefix => aliases.forEach(alias => localStorage.setItem(prefix + alias, normalized)));
}

window.PegasusCardio = {
    open: function() {
        const panel = document.getElementById('cardioPanel');
        if (panel) panel.style.display = 'block';

        const kmInput = document.getElementById('cKm');
        const kcalInput = document.getElementById('cKcal');
        if (kmInput) kmInput.value = "";
        if (kcalInput) kcalInput.value = "";

        const today = getPegasusLocalInputDate();
        const dateInput = document.getElementById('cDate');
        if (dateInput) dateInput.value = today;

        const routeInput = document.getElementById('cRoute');
        if (routeInput) routeInput.value = "Ποδηλασία";

        const timeInput = document.getElementById('cTime');
        if (timeInput) timeInput.value = "Auto";
    },

    close: function() {
        const panel = document.getElementById('cardioPanel');
        if (panel) panel.style.display = 'none';
    }
};

window.saveCardioData = async function() {
    const kmEl = document.getElementById('cKm');
    const kcalEl = document.getElementById('cKcal');
    const dateEl = document.getElementById('cDate');

    const rawKm = (kmEl?.value || "").replace(',', '.');
    const rawKcal = (kcalEl?.value || "").replace(',', '.');

    const km = parseFloat(rawKm);
    const kcal = parseFloat(rawKcal);

    if (isNaN(km) || isNaN(kcal) || km <= 0 || kcal <= 0) {
        alert("PEGASUS STRICT: Συμπλήρωσε έγκυρα Χιλιόμετρα και Θερμίδες.");
        return;
    }

    console.log("🚴 CARDIO ENGINE: Executing Global Sync Protocol...");

    /* --- 0. DATE PREPARATION (UNIFIED PADDING PROTOCOL) --- */
    let rawDate = new Date();

    if (dateEl && dateEl.value) {
        const parsed = new Date(dateEl.value + "T12:00:00");
        if (!isNaN(parsed.getTime())) rawDate = parsed;
    }

    const d = String(rawDate.getDate()).padStart(2, '0');
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const y = rawDate.getFullYear();

    const dateStr = `${d}/${m}/${y}`;
    const workoutKey = `${y}-${m}-${d}`;

    /* --- 1. ΜΥΪΚΗ ΟΜΑΔΑ & XP (LIFETIME STATS) --- */
    const maxCyclingCredit = 8;
    const historyKey = M?.workout?.weekly_history || 'pegasus_weekly_history';
    const targetsKey = M?.workout?.muscleTargets || 'pegasus_muscle_targets';
    const statsKey = M?.system?.stats || 'pegasus_stats';

    let historySets = JSON.parse(localStorage.getItem(historyKey) || "{}");
    const currentLegSets = Math.max(0, parseInt(historySets["Πόδια"] || 0, 10));
    const credit = Math.max(0, Math.min(maxCyclingCredit, km >= 15 ? maxCyclingCredit : Math.round(Math.max(0, km) / 2)));

    const carryoverCredit = credit;
    if (window.PegasusBrain?.recordWeekendCarryover) {
        try { window.PegasusBrain.recordWeekendCarryover("Ποδηλασία", "Πόδια", carryoverCredit, workoutKey); } catch (e) { console.warn("⚠️ PEGASUS BRAIN: cycling carry-over skipped.", e); }
    }

    historySets["Πόδια"] = currentLegSets + credit;
    localStorage.setItem(historyKey, JSON.stringify(historySets));

    let stats = JSON.parse(localStorage.getItem(statsKey) || "{}");
    if (!stats || typeof stats !== "object") stats = {};
    if (typeof stats.totalSets !== "number") stats.totalSets = 0;
    if (!stats.exerciseHistory || typeof stats.exerciseHistory !== "object") stats.exerciseHistory = {};

    stats.totalSets += credit;
    stats.exerciseHistory["Ποδηλασία"] = (stats.exerciseHistory["Ποδηλασία"] || 0) + credit;
    localStorage.setItem(statsKey, JSON.stringify(stats));

    /* --- 2. ΕΝΕΡΓΕΙΑΚΟ ΙΣΟΖΥΓΙΟ (UNIFIED METABOLIC SYNC) --- */
    const weeklyKcalKey = M?.diet?.weeklyKcal || "pegasus_weekly_kcal";

    let currentWeekly = parseFloat(localStorage.getItem(weeklyKcalKey)) || 0;
    localStorage.setItem(weeklyKcalKey, (currentWeekly + kcal).toFixed(1));

    // Γράφουμε όλα τα date aliases ώστε mobile + desktop + cloud να συμφωνούν
    const aliases = getPegasusCardioDateAliasesFromParts(d, m, y);
    const cardioOffsetBase = M?.workout?.cardio_offset || "pegasus_cardio_offset_sets";
    const kcalPrefixes = ["pegasus_cardio_kcal_", `${cardioOffsetBase}_`, "pegasus_cardio_offset_sets_"];
    const kmPrefixes = ["pegasus_cardio_km_", "pegasus_cardio_distance_", "pegasus_cardio_kilometers_"];

    const nextKcal = pegasusReadMaxNumber(kcalPrefixes, aliases) + Number(kcal);
    pegasusWriteAliasNumbers(kcalPrefixes, aliases, nextKcal);

    const nextKm = pegasusReadMaxNumber(kmPrefixes, aliases) + Number(km);
    pegasusWriteAliasNumbers(kmPrefixes, aliases, nextKm);

    console.log(`🔥 CARDIO SYNC: aliases = ${aliases.join(', ')} | kcal=${nextKcal.toFixed(1)} | km=${nextKm.toFixed(1)}`);

    /* --- 3. CALENDAR SYNC (CYCLING IS SEPARATE FROM WEIGHTS) --- */
    if (km > 0 || kcal > 0) {
        const cyclingDoneKey = M?.workout?.cycling_done || "pegasus_cycling_done";
        let cyclingData = {};
        try {
            const parsed = JSON.parse(localStorage.getItem(cyclingDoneKey) || "{}");
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) cyclingData = parsed;
        } catch (_) {}

        cyclingData[workoutKey] = true;
        localStorage.setItem(cyclingDoneKey, JSON.stringify(cyclingData));

        console.log(`🚴 CALENDAR: Cycling marked orange (${workoutKey}).`);
    }

    /* --- 4. ΙΣΤΟΡΙΚΟ ΚαταγραφήΣ (50 entries max) --- */
    let historyLog = JSON.parse(localStorage.getItem("pegasus_cardio_history") || "[]");
    if (!Array.isArray(historyLog)) historyLog = [];

    historyLog.unshift({
        date: dateStr,
        isoDate: workoutKey,
        dateKey: workoutKey,
        compactDate: `${y}${m}${d}`,
        type: "Ποδηλασία",
        activity: "cycling",
        km: km,
        distanceKm: km,
        kcal: kcal,
        calories: kcal,
        legSets: credit,
        recordedAt: new Date().toISOString(),
        source: "desktop-cardio-v2.5"
    });

    localStorage.setItem("pegasus_cardio_history", JSON.stringify(historyLog.slice(0, 50)));

    /* --- 5. UI REFRESH --- */
    alert(`✅ Καταχωρήθηκε!
Θερμίδες: ${kcal} kcal
Πόδια: +${credit} σετ από ποδηλασία.`);

    window.PegasusCardio.close();

    if (typeof window.refreshAllUI === "function") window.refreshAllUI();
    if (window.MuscleProgressUI?.render) window.MuscleProgressUI.render();
    if (typeof window.updateFoodUI === "function") window.updateFoodUI();
    if (typeof window.renderFood === "function") window.renderFood();
    if (typeof window.updateKcalUI === "function") window.updateKcalUI();
    if (window.PegasusMetabolic?.renderUI) window.PegasusMetabolic.renderUI();
    if (typeof window.renderCalendar === "function") window.renderCalendar();

    /* --- 6. CLOUD PUSH --- */
    const forceCardioPush = async () => {
        let pushed = false;
        try {
            if (window.PegasusCloud?.push) pushed = await window.PegasusCloud.push(true);
        } catch (e) {
            console.warn("⚠️ PEGASUS CARDIO: immediate push failed, retry queued.", e);
        }
        if (!pushed && window.PegasusCloud?.syncNow) {
            try { pushed = await window.PegasusCloud.syncNow(true); } catch (e) {}
        }
        if (!pushed && window.PegasusCloud?.push) {
            setTimeout(() => { try { window.PegasusCloud.push(true); } catch (e) {} }, 1200);
        }
    };
    await forceCardioPush();
};
