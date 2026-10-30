/* ==========================================================================
   PEGASUS DYNAMIC OPTIMIZER - v1.7 (45-MIN REST-AWARE / WEEKEND PANEL SAFE)
   Protocol: Strict 45-Minute Window Enforcement & DOM Shielding
   Strategy: PegasusBrain owns order; Dynamic only enforces visibility/time cap
   Status: FINAL STABLE | PEGASUS 223
   ========================================================================== */

window.PegasusDynamic = {
    maxMinutes: 45,
    setDuration: 1.9, // ~45 λεπτά για 23-24 ποιοτικά σετ

    getExerciseMuscle: function(ex) {
        return ex?.dataset?.group
            || ex?.dataset?.muscle
            || ex?.getAttribute?.("data-group")
            || ex?.getAttribute?.("data-muscle")
            || ex?.querySelector?.(".exercise-muscle-badge")?.textContent?.trim()
            || ex?.querySelector?.("[data-muscle]")?.getAttribute?.("data-muscle")
            || "";
    },

    getExerciseSets: function(ex) {
        const raw = ex?.dataset?.total || ex?.dataset?.sets || ex?.getAttribute?.("data-sets");
        const value = parseFloat(raw);
        return Number.isFinite(value) ? value : 4;
    },

    markHidden: function(ex) {
        ex.style.display = "none";
        ex.setAttribute("data-active", "false");
        const idx = Number(ex.dataset?.index);
        if (Number.isInteger(idx) && Array.isArray(window.remainingSets)) {
            window.remainingSets[idx] = 0;
        }
    },

    markVisible: function(ex) {
        ex.style.display = "";
        ex.style.flexDirection = "";
        ex.setAttribute("data-active", "true");
        ex.style.opacity = "1";
    },

    optimize: function() {
        console.log("⏱️ DYNAMIC ENGINE: Calculating Time Budget...");

        const activeDay = (typeof window.getPegasusActiveDayName === "function")
            ? window.getPegasusActiveDayName()
            : (document.querySelector(".navbar button.active[id^='nav-']")?.id || "").replace(/^nav-/, "");

        const allowLegs = (typeof window.PegasusBrain?.canTrainLegsOnDay === "function")
            ? window.PegasusBrain.canTrainLegsOnDay(activeDay)
            : activeDay === "Τετάρτη";

        const container = document.getElementById("exList");

        if (!window.exercises || window.exercises.length === 0) {
            if ((activeDay === "Σάββατο" || activeDay === "Κυριακή") && typeof window.ensurePegasusWeekendModeUi === "function") {
                window.ensurePegasusWeekendModeUi(activeDay, container);
                console.log("✅ DYNAMIC UI: Weekend mode controls preserved (0 weight sets).");
            }
            return;
        }

        // PEGASUS 211: Do not sort here. PegasusBrain already builds the rest-aware order.
        // Re-sorting at DOM level can desync timers/click handlers and destroy recovery spacing.
        let totalSets = 0;
        const fragment = document.createDocumentFragment();
        const ordered = Array.from(window.exercises);

        ordered.forEach(ex => {
            const muscle = this.getExerciseMuscle(ex);
            // The fixed Saturday session explicitly contains Leg Extensions.
            // canTrainLegsOnDay() governs optional leg work, not exercises already
            // prescribed in Saturday's fixed plan. Never hide that one card on
            // the delayed 300ms optimize pass (or subsequent recalculations).
            const isFixedSaturdayLegExtensions = activeDay === "Σάββατο"
                && ex.dataset?.name === "Leg Extensions";
            if (muscle === "Πόδια" && !allowLegs && !isFixedSaturdayLegExtensions) {
                this.markHidden(ex);
                fragment.appendChild(ex);
                return;
            }

            const sets = this.getExerciseSets(ex);
            const nameText = ex.dataset?.name || ex.querySelector?.(".exercise-name")?.textContent || ex.textContent || "";
            const isStretching = /stretching|διατάσεις/i.test(nameText);
            const cost = isStretching ? 2 : (sets * this.setDuration);

            if ((totalSets * this.setDuration) + cost <= this.maxMinutes) {
                if (!isStretching) totalSets += sets;
                this.markVisible(ex);
                fragment.appendChild(ex);
            } else {
                this.markHidden(ex);
                console.log("✂️ Time Cap: Removed exercise to enforce 45-min window.");
                fragment.appendChild(ex);
            }
        });

        if (container) {
            // PEGASUS 223: keep weekend mode controls visible.
            // The dynamic optimizer owns only exercise cards; it must not wipe
            // PegasusBrain UI chrome such as the Σ/Κ Ποδήλατο / Ποδ. + βάρη / Βάρη panel.
            const preservedBefore = [];
            const preservedAfter = [];
            Array.from(container.children).forEach(node => {
                if (node.classList && node.classList.contains("exercise")) return;
                if (node.classList && node.classList.contains("pegasus-weekend-mode-note")) preservedAfter.push(node);
                else preservedBefore.push(node);
            });

            container.innerHTML = "";
            preservedBefore.forEach(node => container.appendChild(node));
            container.appendChild(fragment);
            preservedAfter.forEach(node => container.appendChild(node));
        }

        const totalMins = Math.round(totalSets * this.setDuration);
        console.log(`✅ DYNAMIC UI: Final Plan - ${totalSets} sets (~${totalMins} mins)`);

        if (window.PegasusLogger && totalMins > 42) {
            window.PegasusLogger.log(`Time Budget Critical: ${totalMins}/45 mins allocated.`, "INFO");
        }
    }
};

// Listener για αλλαγή ημέρας (Debounce)
let optimizeTimeout;
document.addEventListener('click', (e) => {
    if (e.target.closest('.navbar button') || e.target.closest('.day-selector')) {
        clearTimeout(optimizeTimeout);
        optimizeTimeout = setTimeout(() => {
            if (typeof window.PegasusDynamic !== "undefined") window.PegasusDynamic.optimize();
        }, 300);
    }
});
