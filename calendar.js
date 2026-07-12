/* ==========================================================================
   PEGASUS CALENDAR SYSTEM - v8.2 (ACTIVITY COLORS)
   Protocol: Separate strength/cycling history, data-over-plan priority
   Status: LOCAL-ONLY | WEIGHTS GREEN | CYCLING ORANGE | BOTH SPLIT
   ========================================================================== */

// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
window.selectedCalendarDate = null;

(function installPegasusCalendarActivityBridge() {
    const pad = value => String(value).padStart(2, "0");

    function safeObject(raw) {
        try {
            const parsed = JSON.parse(raw || "{}");
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function toIsoDate(value) {
        const text = String(value || "").trim();
        let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (match) return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;

        match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) return `${match[3]}-${pad(match[2])}-${pad(match[1])}`;

        match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (match) return `${match[1]}-${match[2]}-${match[3]}`;

        return "";
    }

    function readCyclingDays() {
        const cyclingKey = M?.workout?.cycling_done || "pegasus_cycling_done";
        const cycling = safeObject(localStorage.getItem(cyclingKey));
        let changed = false;

        // Backfill old cardio entries so previous rides also receive the new orange color.
        try {
            const historyKey = M?.workout?.cardio_history || "pegasus_cardio_history";
            const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
            if (Array.isArray(history)) {
                history.forEach(entry => {
                    const iso = [entry?.isoDate, entry?.dateKey, entry?.workoutKey, entry?.compactDate, entry?.date]
                        .map(toIsoDate)
                        .find(Boolean);
                    const km = Number(entry?.km ?? entry?.distanceKm ?? 0) || 0;
                    const kcal = Number(entry?.kcal ?? entry?.calories ?? 0) || 0;
                    if (iso && (km > 0 || kcal > 0) && cycling[iso] !== true) {
                        cycling[iso] = true;
                        changed = true;
                    }
                });
            }
        } catch (_) {}

        if (changed) localStorage.setItem(cyclingKey, JSON.stringify(cycling));
        return cycling;
    }

    window.getPegasusCyclingDays = readCyclingDays;
})();

window.renderCalendar = function() {
    const el = document.getElementById("calendarContent");
    if (!el) return;

    const doneKey = M?.workout?.done || "pegasus_workouts_done";
    let strengthData = {};
    try {
        const parsed = JSON.parse(localStorage.getItem(doneKey) || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) strengthData = parsed;
    } catch (_) {}

    const cyclingData = typeof window.getPegasusCyclingDays === "function"
        ? window.getPegasusCyclingDays()
        : {};

    const now = new Date();
    const todayNormalized = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:#4CAF50;background:#111;padding:8px;border-radius:5px;border:1px solid #333;">
        <span id="prevMonth" style="cursor:pointer;padding:0 10px;font-weight:bold;user-select:none;">&#8592;</span>
        <span style="text-transform:capitalize;font-weight:bold;letter-spacing:1px;">${new Date(currentYear, currentMonth).toLocaleString("el-GR", { month: "long" })} ${currentYear}</span>
        <span id="nextMonth" style="cursor:pointer;padding:0 10px;font-weight:bold;user-select:none;">&#8594;</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px 10px;margin:0 0 10px;font-size:9px;font-weight:900;letter-spacing:.25px;">
        <span style="color:#4CAF50;">● Βάρη</span>
        <span style="color:#ff9800;">● Ποδήλατο</span>
        <span style="color:#b4c8ff;">● Ρεπό Δ/Π</span>
        <span style="color:#ff6b6b;">● Χαμένη</span>
        <span style="color:#FFD700;">□ Σήμερα</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
    `;

    const weekHeaders = ["Κ","Δ","Τ","Τ","Π","Π","Σ"];
    weekHeaders.forEach(dayName => {
        html += `<div style="text-align:center;opacity:.6;color:#4CAF50;font-size:11px;font-weight:900;">${dayName}</div>`;
    });

    for (let i = 0; i < firstDayOfMonth; i++) html += `<div></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const loopDate = new Date(currentYear, currentMonth, day);
        const loopDateTime = loopDate.getTime();
        const dayOfWeek = loopDate.getDay();

        const dStr = String(day).padStart(2, "0");
        const mStr = String(currentMonth + 1).padStart(2, "0");
        const activityKey = `${currentYear}-${mStr}-${dStr}`;
        const foodDateString = `${dStr}/${mStr}/${currentYear}`;

        const hasStrength = strengthData[activityKey] === true;
        const hasCycling = cyclingData[activityKey] === true;
        const isRecoveryDay = dayOfWeek === 1 || dayOfWeek === 4;

        let bg = "#1a1a1a";
        let border = "1px solid #333";
        let color = "#fff";
        let glow = "none";
        let title = "";

        // Strict activity priority: both > weights > cycling > recovery > missed.
        if (hasStrength && hasCycling) {
            bg = "linear-gradient(135deg,#4CAF50 0%,#4CAF50 49%,#ff9800 51%,#ff9800 100%)";
            border = "1px solid #f5c04a";
            color = "#000";
            title = "Βάρη και ποδηλασία";
        } else if (hasStrength) {
            bg = "#4CAF50";
            border = "1px solid #4CAF50";
            color = "#000";
            title = "Ολοκληρωμένη προπόνηση με βάρη";
        } else if (hasCycling) {
            bg = "#ff9800";
            border = "1px solid #ffb74d";
            color = "#111";
            title = "Καταγεγραμμένη ποδηλασία";
        } else if (isRecoveryDay) {
            bg = "#1e3a5f";
            border = "1px solid #64B5F6";
            title = "Ημέρα χωρίς βάρη";
        } else if (loopDateTime < todayNormalized) {
            bg = "#b71c1c";
            border = "1px solid #ff5252";
            title = "Προγραμματισμένη προπόνηση που δεν καταγράφηκε";
        }

        // Today keeps its real activity color and receives only a gold frame.
        if (loopDateTime === todayNormalized) {
            border = "2px solid #FFD700";
            glow = "0 0 10px rgba(255,215,0,.38)";
            if (!hasStrength && !hasCycling && !isRecoveryDay) color = "#FFD700";
            title = title ? `${title} — Σήμερα` : "Σήμερα";
        }

        // Selected date keeps the activity color; only the focus ring changes.
        if (window.selectedCalendarDate === foodDateString) {
            border = "2px solid #00ff41";
            glow = "0 0 10px rgba(0,255,65,.42)";
        }

        html += `<div data-activity-date="${activityKey}" data-strength="${hasStrength}" data-cycling="${hasCycling}"
                    title="${title}"
                    style="background:${bg};border:${border};color:${color};padding:8px 0;text-align:center;border-radius:6px;font-size:13px;cursor:pointer;font-weight:bold;box-shadow:${glow};transition:.2s;"
                    onclick="window.viewFoodFromCalendar('${foodDateString}')">${day}</div>`;
    }

    html += `</div>`;
    el.innerHTML = html;

    const pBtn = document.getElementById("prevMonth");
    const nBtn = document.getElementById("nextMonth");

    if (pBtn) pBtn.onclick = event => {
        event.stopPropagation();
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        window.renderCalendar();
    };

    if (nBtn) nBtn.onclick = event => {
        event.stopPropagation();
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        window.renderCalendar();
    };
};

/* --- ΣΥΝΔΕΣΗ ΗΜΕΡΟΛΟΓΙΟΥ ΜΕ DIET PANEL (STRICT SYNC) --- */
window.viewFoodFromCalendar = function(dateStr) {
    const parts = dateStr.split('/');
    const selectedDate = new Date(parts[2], parts[1] - 1, parts[0]);

    window.selectedCalendarDate = dateStr;
    window.currentFoodDate = selectedDate;
    window.renderCalendar();

    document.querySelectorAll(".pegasus-panel").forEach(panel => panel.style.display = "none");

    const foodPanel = document.getElementById("foodPanel");
    if (foodPanel) {
        foodPanel.style.display = "block";

        if (typeof window.updateFoodUI === "function") window.updateFoodUI();
        else if (window.renderFood) window.renderFood();

        setTimeout(() => {
            const crossBtn = document.getElementById("btnAddFood");
            if (crossBtn) {
                crossBtn.style.setProperty('color', '#4CAF50', 'important');
                crossBtn.style.setProperty('border-color', '#4CAF50', 'important');
            }
        }, 50);
    }
};
