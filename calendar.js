/* ==========================================================================
   PEGASUS CALENDAR SYSTEM - v8.1 (MANIFEST ALIGNED)
   Protocol: Data Over Plan Priority, Normalized Date Sync & Padding Alignment
   Status: FINAL STABLE | FIXED: TIMEZONE TRAP & MANIFEST SYNC
   ========================================================================== */


// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
window.selectedCalendarDate = null;

window.renderCalendar = function() {
    const el = document.getElementById("calendarContent");
    if (!el) return;

    // 🎯 FIXED: Δυναμική ανάκτηση από Manifest
  const doneKey = M?.workout?.done || "pegasus_workouts_done";
    const data = JSON.parse(localStorage.getItem(doneKey) || "{}");

    const now = new Date();
    // Κανονικοποίηση "Σήμερα" στο Midnight για ασφαλή σύγκριση
    const todayNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;color:#4CAF50;background:#111;padding:8px;border-radius:5px;border:1px solid #333;">
        <span id="prevMonth" style="cursor:pointer;padding:0 10px; font-weight:bold; user-select:none;">&#8592;</span>
        <span style="text-transform: capitalize; font-weight:bold; letter-spacing:1px;">${new Date(currentYear, currentMonth).toLocaleString("el-GR", { month: "long" })} ${currentYear}</span>
        <span id="nextMonth" style="cursor:pointer;padding:0 10px; font-weight:bold; user-select:none;">&#8594;</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
    `;

    const weekHeaders = ["Κ","Δ","Τ","Τ","Π","Π","Σ"];
    weekHeaders.forEach(d => html += `<div style="text-align:center;opacity:.6;color:#4CAF50;font-size:11px;font-weight:900;">${d}</div>`);

    // Κενά για την αρχή του μήνα
    for (let i = 0; i < firstDayOfMonth; i++) html += `<div></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const loopDate = new Date(currentYear, currentMonth, day);
        const loopDateTime = loopDate.getTime();
        const dayOfWeek = loopDate.getDay();

        // 🎯 UNIFIED PADDING PROTOCOL
        const dStr = String(day).padStart(2, '0');
        const mStr = String(currentMonth + 1).padStart(2, '0');
        const workoutKey = `${currentYear}-${mStr}-${dStr}`;
        const foodDateString = `${dStr}/${mStr}/${currentYear}`;

        let bg = "#1a1a1a";
        let border = "1px solid #333";
        let color = "#fff";
        let glow = "none";

        const isRecoveryDay = (dayOfWeek === 1 || dayOfWeek === 4);

        // --- STRICT PRIORITY RENDERING ---
        if (data[workoutKey] === true) {
            // 1. Επιτυχία (Προπόνηση): ΠΡΑΣΙΝΟ
            bg = "#4CAF50";
            border = "1px solid #4CAF50";
            color = "#000";
        }
        else if (isRecoveryDay) {
            // 2. ΠΛΑΝΟ ΑΠΟΘΕΡΑΠΕΙΑΣ: ΜΠΛΕ
            bg = "#1e3a5f";
            border = "1px solid #64B5F6";
        }
        else if (loopDateTime < todayNormalized) {
            // 3. ΠΑΡΕΛΘΟΝ & ΧΑΣΙΜΟ (Όχι προπόνηση/Όχι recovery): ΚΟΚΚΙΝΟ
            bg = "#b71c1c";
            border = "1px solid #ff5252";
        }

        // Highlight Σήμερα (Χρυσό περίγραμμα)
        if (loopDateTime === todayNormalized) {
            border = "2px solid #FFD700";
            glow = "0 0 10px rgba(255, 215, 0, 0.3)";
            if (bg === "#1a1a1a") color = "#FFD700";
        }

        // Highlight Επιλεγμένης Μέρας (Focus - Green Matrix)
        if (window.selectedCalendarDate === foodDateString) {
            border = "2px solid #00ff41";
            bg = "#002200";
            color = "#00ff41";
        }

        html += `<div style="background:${bg};border:${border};color:${color};padding:8px 0;text-align:center;border-radius:6px;font-size:13px;cursor:pointer;font-weight:bold;box-shadow:${glow};transition:0.2s;"
                    onclick="window.viewFoodFromCalendar('${foodDateString}')">
                    ${day}
                 </div>`;
    }

    html += `</div>`;
    el.innerHTML = html;

    // 🎯 FIXED: Re-binding listeners with cleanup logic
    const pBtn = document.getElementById("prevMonth");
    const nBtn = document.getElementById("nextMonth");

    if (pBtn) pBtn.onclick = (e) => {
        e.stopPropagation(); currentMonth--;
        if(currentMonth < 0){ currentMonth = 11; currentYear--; }
        window.renderCalendar();
    };
    if (nBtn) nBtn.onclick = (e) => {
        e.stopPropagation(); currentMonth++;
        if(currentMonth > 11){ currentMonth = 0; currentYear++; }
        window.renderCalendar();
    };
};

/* --- ΣΥΝΔΕΣΗ ΗΜΕΡΟΛΟΓΙΟΥ ΜΕ DIET PANEL (STRICT SYNC) --- */
window.viewFoodFromCalendar = function(dateStr) {
    const parts = dateStr.split('/');
    const selectedDate = new Date(parts[2], parts[1] - 1, parts[0]);

    // Ενημέρωση focus
    window.selectedCalendarDate = dateStr;
    window.currentFoodDate = selectedDate;

    // Re-render calendar για να φανεί η επιλογή
    window.renderCalendar();

    // Κλείσιμο panels και άνοιγμα Food
    document.querySelectorAll(".pegasus-panel").forEach(p => p.style.display = "none");

    const foodPanel = document.getElementById("foodPanel");
    if (foodPanel) {
        foodPanel.style.display = "block";

        // 🎯 FIXED: Ασφαλής κλήση UI update
        if (typeof window.updateFoodUI === "function") {
            window.updateFoodUI();
        } else if (window.renderFood) {
            window.renderFood();
        }

        // Pegasus Green Force UI Adjustment
        setTimeout(() => {
            const crossBtn = document.getElementById("btnAddFood");
            if (crossBtn) {
                crossBtn.style.setProperty('color', '#4CAF50', 'important');
                crossBtn.style.setProperty('border-color', '#4CAF50', 'important');
            }
        }, 50);
    }
};
