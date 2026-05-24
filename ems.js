/* ==========================================================================
   PEGASUS EMS MODULE - v10.2 STABLE (FULL SYNC EDITION)
   Protocol: Strict Data Analyst - Zero Logic Loss - Calendar Aligned
   Status: FINAL STABLE | FIXED: CALENDAR SYNC & KCAL BALANCE
   ========================================================================== */
// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;
/**
 * 1. ΗΜΕΡΟΛΟΓΙΑΚΟΣ ΥΠΟΛΟΓΙΣΜΟΣ (HTML5 Date Input Format)
 */
function getTargetWednesday() {
    const now = new Date();
    let currentDay = now.getDay();
    if (currentDay === 0) currentDay = 7;

    // Αν σήμερα δεν είναι Τετάρτη, βρίσκει την κοντινότερη
    const diff = 3 - currentDay;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);

    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    // 🎯 FIXED: Απαιτείται YYYY-MM-DD για τα HTML5 type="date" inputs
    return `${year}-${month}-${day}`;
}

/**
 * 2. ΕΚΚΙΝΗΣΗ UI
 */
window.logEMSData = function() {
    console.log("⚡ PEGASUS: EMS Entry Triggered.");

    const toolsPanel = document.getElementById('toolsPanel');
    if (toolsPanel) toolsPanel.style.display = 'none';

    // Χρησιμοποιούμε το Modal που ήδη υπάρχει στο HTML, αλλιώς το δημιουργούμε
    const emsModal = document.getElementById('emsModal') || createEMSModal();

    const dateInput = document.getElementById('emsDate');
    const avgInput = document.getElementById('emsAvg');
    const kcalInput = document.getElementById('emsKcal');

    if (dateInput) dateInput.value = getTargetWednesday();
    if (avgInput) avgInput.value = "";
    if (kcalInput) kcalInput.value = "";

    emsModal.style.display = 'block';
    setTimeout(() => { if(avgInput) avgInput.focus(); }, 100);
};

/**
 * 3. Αποθήκευση ΚΑΙ Συγχρονισμός (FIXED)
 */
window.saveEMSFinal = async function() {
    // 🛡️ Global Safe Declaration (Inside function for extra safety)
    var M = M || window.PegasusManifest;

    const dateInput = document.getElementById('emsDate');
    const avgInput = document.getElementById('emsAvg');
    const kcalInput = document.getElementById('emsKcal');

    const dateStr = dateInput ? dateInput.value : "";
    const avgStr = avgInput ? avgInput.value.replace(',', '.') : "";
    const kcalStr = kcalInput ? kcalInput.value.replace(',', '.') : "";

    const avg = parseFloat(avgStr);
    const kcal = parseFloat(kcalStr);

    if (!dateStr || isNaN(avg) || isNaN(kcal)) {
        alert("Αποτυχία: Εισάγετε έγκυρα αριθμητικά δεδομένα.");
        return;
    }

    // 🎯 MANIFEST ALIGNMENT: Δυναμική ανάκτηση κλειδιών
    const weeklyKey = M?.workout?.weekly_history || 'pegasus_weekly_history';
    const weeklyKcalKey = M?.diet?.weeklyKcal || "pegasus_weekly_kcal";
    const workoutsDoneKey = M?.workout?.done || "pegasus_workouts_done";

    // 1. Πίστωση Σετ (EMS Full Body: +6 σε κάθε βασική ομάδα)
    let weeklyStats = JSON.parse(localStorage.getItem(weeklyKey)) || {
        "Στήθος": 0, "Πλάτη": 0, "Πόδια": 0, "Χέρια": 0, "Ώμοι": 0, "Κορμός": 0
    };
    const groups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];
    groups.forEach(group => {
        weeklyStats[group] = (weeklyStats[group] || 0) + 6;
    });
    localStorage.setItem(weeklyKey, JSON.stringify(weeklyStats));

    // 2. Ενημέρωση Εβδομαδιαίων Θερμίδων
    let currentWeeklyKcal = parseFloat(localStorage.getItem(weeklyKcalKey)) || 0;
    localStorage.setItem(weeklyKcalKey, (currentWeeklyKcal + kcal).toFixed(1));

    // 3. Καταγραφή στο Calendar (Marking Wednesday as Green)
    let workoutsDone = JSON.parse(localStorage.getItem(workoutsDoneKey) || "{}");
    workoutsDone[dateStr] = true;
    localStorage.setItem(workoutsDoneKey, JSON.stringify(workoutsDone));

    // 4. Achievement & Stats Bridge
    if (typeof window.updateTotalWorkoutCount === "function") window.updateTotalWorkoutCount();

    try {
        if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") {
            await window.PegasusCloud.push(true);
        }

        alert(`⚡ PEGASUS SYNC: Πιστώθηκαν 36 σετ.\nΚαύση: ${kcal} kcal.\nΗ Τετάρτη ολοκληρώθηκε!`);

        window.closeEMSModal();

        // UI Refresh
        if (typeof window.updateKcalUI === "function") window.updateKcalUI();
        if (typeof window.renderCalendar === "function") window.renderCalendar();
        if (window.MuscleProgressUI && typeof window.MuscleProgressUI.render === "function") window.MuscleProgressUI.render();

    } catch (e) {
        console.error("EMS Save Error:", e);
        alert("Σφάλμα κατά τον συγχρονισμό.");
    }
};

window.closeEMSModal = function() {
    const modal = document.getElementById('emsModal');
    if (modal) modal.style.display = 'none';
};

// Fallback δημιουργός Modal σε περίπτωση που σβηστεί από το HTML
function createEMSModal() {
    let div = document.getElementById('emsModal');
    if (div) return div;

    div = document.createElement('div');
    div.id = 'emsModal';
    div.className = 'pegasus-panel';
    div.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#0a0a0a; border:2px solid #4CAF50; padding:25px; border-radius:15px; z-index:99999; width:320px; text-align:center; box-shadow: 0 0 30px rgba(0,0,0,1); color:white; display:none;";

    div.innerHTML = `
        <h3 style="color:#4CAF50; margin-top:0;">⚡ Καταγραφή EMS</h3>
        <div style="margin-top:15px;">
            <label style="color:#888; font-size:11px; display:block; margin-bottom:5px;">ΗΜΕΡΟΜΗΝΙΑ (YYYY-MM-DD):</label>
            <input type="date" id="emsDate" style="width:100%; background:#000; color:#4CAF50; border:1px solid #4CAF50; padding:10px; border-radius:5px; box-sizing:border-box; text-align:center;">
        </div>
        <div style="margin-top:15px;">
            <label style="color:#888; font-size:11px; display:block; margin-bottom:5px;">ΜΕΣΗ ΕΝΤΑΣΗ (%):</label>
            <input type="number" id="emsAvg" step="0.1" style="width:100%; background:#000; color:#4CAF50; border:1px solid #4CAF50; padding:10px; border-radius:5px; box-sizing:border-box; text-align:center;">
        </div>
        <div style="margin-top:15px;">
            <label style="color:#888; font-size:11px; display:block; margin-bottom:5px;">Θερμίδες (kcal):</label>
            <input type="number" id="emsKcal" style="width:100%; background:#000; color:#4CAF50; border:1px solid #4CAF50; padding:10px; border-radius:5px; box-sizing:border-box; text-align:center; margin-bottom:20px;">
        </div>
        <div style="display:flex; gap:10px;">
            <button onclick="saveEMSFinal()" style="flex:1; background:#4CAF50; color:black; border:none; padding:12px; border-radius:5px; cursor:pointer; font-weight:bold;">Αποθήκευση</button>
            <button onclick="closeEMSModal()" style="flex:1; background:#333; color:white; border:none; padding:12px; border-radius:5px; cursor:pointer;">Άκυρο</button>
        </div>
    `;
    document.body.appendChild(div);

    // Binding the click event since it's dynamically created
    div.querySelector('button[onclick="saveEMSFinal()"]').onclick = window.saveEMSFinal;
    div.querySelector('button[onclick="closeEMSModal()"]').onclick = window.closeEMSModal;

    return div;
}

// Διασφάλιση σύνδεσης του κουμπιού από το HTML με την εντολή UI
document.addEventListener('DOMContentLoaded', () => {
    const btnEMS = document.getElementById('btnSaveEMS');
    if (btnEMS) btnEMS.onclick = window.saveEMSFinal;

    const btnClose = document.getElementById('btnCloseEMS');
    if (btnClose) btnClose.onclick = window.closeEMSModal;
});
