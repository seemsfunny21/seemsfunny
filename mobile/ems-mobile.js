/* ==========================================================================
   PEGASUS OS - EMS MODULE (MOBILE EDITION v14.3 MAXIMALIST)
   Protocol: Full Body Stimulation, Cardio Guard & Achievement Sync
   Status: FINAL STABLE | FIXED: CROSS-PLATFORM CARDIO GUARD & DATE PADDING
   ========================================================================== */

window.PegasusEMS = {
    timer: null,
    seconds: 1500, // 25 λεπτά Baseline

    start: function() {
        if (this.timer) return;
        this.timer = setInterval(() => this.tick(), 1000);
        const controls = document.getElementById('emsTimeControls');
        if (controls) controls.style.display = 'grid';
        console.log("⚡ EMS: Session Started. Tactical Timer Active.");
    },

    tick: function() {
        if (this.seconds <= 0) {
            clearInterval(this.timer);
            this.complete();
            return;
        }
        this.seconds--;
        this.updateUI();
    },

    adjust: function(secs) {
        this.seconds = Math.max(0, this.seconds + secs);
        this.updateUI();
    },

    updateUI: function() {
        const min = String(Math.floor(this.seconds/60)).padStart(2,'0');
        const sec = String(this.seconds%60).padStart(2,'0');

        const timerEl = document.getElementById('phaseTimer');
        const fillEl = document.getElementById('phaseProgressFill');

        if (timerEl) timerEl.textContent = `${min}:${sec}`;
        if (fillEl) {
            const pct = (this.seconds / 1500) * 100;
            fillEl.style.width = `${100 - pct}%`;
        }
    },

    complete: async function() {
        console.log("⚡ EMS: Session Completed. Running Final Pulse Protocol...");

        window.enforcePegasusMondayWeeklyReset?.({ source: 'mobile-progress', push: false });

        // --- 0. DATA SOURCE RECOVERY ---
        let h = JSON.parse(localStorage.getItem('pegasus_weekly_history')) || {};
        const groups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];

        // --- 0.1 DATE PREPARATION (UNIFIED PADDING PROTOCOL) ---
        const rawDate = new Date();
        const dStr = String(rawDate.getDate()).padStart(2, '0');
        const mStr = String(rawDate.getMonth() + 1).padStart(2, '0');
        const dateStr = `${dStr}/${mStr}/${rawDate.getFullYear()}`;

        // --- 1. CARDIO GUARD: Έλεγχος αν έγινε ποδήλατο σήμερα (PC ή Mobile) ---
        const hasCardio = localStorage.getItem("pegasus_cardio_kcal_" + dateStr);

        groups.forEach(g => {
            if (g === "Πόδια" && hasCardio) {
                console.log("⚡ EMS: Skipping Legs (Already covered by Cardio today).");
                // Αν έχει γίνει cardio, το EMS πιστώνει 0 στα πόδια για αποφυγή Overtraining
            } else {
                h[g] = (h[g] || 0) + 6; // Πίστωση 6 σετ ανά ομάδα (Σύνολο 36 ή 30)
            }
        });

        // --- 2. 🏆 ACHIEVEMENT SYNC (XP/LIFETIME STATS) ---
        // Το EMS θεωρείται Full Body Session (36 sets total)
        let stats = JSON.parse(localStorage.getItem('pegasus_stats')) || { totalSets: 0, exerciseHistory: {} };
        stats.totalSets = (stats.totalSets || 0) + 36;
        localStorage.setItem('pegasus_stats', JSON.stringify(stats));

        // --- 3. FINAL SAVE & SYNC ---
        localStorage.setItem('pegasus_weekly_history', JSON.stringify(h));
        const weekKey = window.PegasusWeekClock.weekKey(rawDate);
        localStorage.setItem('pegasus_weekly_history_week_key', weekKey);
        window.dispatchEvent?.(new CustomEvent('pegasus_weekly_history_updated', { detail: { source: 'mobile-ems', history: { ...h } } }));

        alert("⚡ EMS SESSION COMPLETE!\n36 Sets added to XP.\nLeg sets skipped if cardio was detected.");

        if (window.PegasusCloud) {
            // Χρήση true για άμεσο συγχρονισμό μετά από μεγάλο session
            await window.PegasusCloud.push(true);
        }

        if (typeof openView === "function") openView('home');
        location.reload(); // Refresh για ενημέρωση των progress bars
    }
};
