/* ==========================================================================
   PEGASUS DYNAMIC OPTIMIZER - v3.3 (PEGASUS 299 CLASSIC FIXED SPLIT SAFE)
   Protocol: Monday 00:00 Greece Week Reset, 8-Set Cycling Credit & MS-600 Mapping
   Status: FINAL STABLE | ZERO-BUG VERIFIED
   ========================================================================== */

// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;

window.PegasusOptimizer = {
    getDefaultTargets: function() {
        return {
            "Στήθος": 16,
            "Πλάτη": 20,
            "Πόδια": 8,
            "Χέρια": 17,
            "Ώμοι": 3,
            "Κορμός": 10
        };
    },

    getTargets: function() {
        try {
            const targetsKey = M?.workout?.muscleTargets || "pegasus_muscle_targets";
            const stored = localStorage.getItem(targetsKey);
            const parsed = stored ? JSON.parse(stored) : null;
            return parsed && typeof parsed === "object" ? parsed : this.getDefaultTargets();
        } catch (e) {
            return this.getDefaultTargets();
        }
    },

    getProgressSnapshot: function() {
        const historyKey = M?.workout?.weekly_history || 'pegasus_weekly_history';
        try {
            const parsed = JSON.parse(localStorage.getItem(historyKey) || "{}");
            return (parsed && typeof parsed === "object") ? parsed : {};
        } catch (e) {
            return {};
        }
    },

    getEmptyProgress: function() {
        return {
            "Στήθος": 0,
            "Πλάτη": 0,
            "Ώμοι": 0,
            "Χέρια": 0,
            "Κορμός": 0,
            "Πόδια": 0
        };
    },

    getCurrentWeekKey: function() {
        return window.PegasusWeekClock.weekKey();
    },

    apply: function(day, sessionExercises) {
        const historyKey = M?.workout?.weekly_history || 'pegasus_weekly_history';
        let progress = this.getProgressSnapshot();

        // Week rollover is owned exclusively by the canonical Monday reset.
        // Never reset independently on Saturday or based on a stale daily marker.
        window.enforcePegasusMondayWeeklyReset?.({ source: 'optimizer-apply', push: false });
        progress = this.getProgressSnapshot();

        let sessionTracker = { ...progress };
        const currentTargets = this.getTargets();
        let mappedData = (sessionExercises || []).map(ex => this.calculateExercise(ex, sessionTracker, currentTargets));

        const getActiveMins = (data) => data.reduce((sum, ex) => sum + (ex.adjustedSets > 0 ? (ex.adjustedSets * 1.9) : 0), 0);
        let currentMinutes = getActiveMins(mappedData);

        // PEGASUS 183: legacy filler only when PegasusBrain is absent.
        // The Brain now owns weekly distribution, Fri/Sat/Sun adjacency and exact remaining sets.
        if (!window.PegasusBrain?.isManagedDay?.(day) && (day === "Παρασκευή" || day === "Σάββατο" || day === "Κυριακή") && currentMinutes < 40) {
            const priorities = {
                "Παρασκευή": ["Πλάτη", "Ώμοι", "Χέρια", "Κορμός"],
                "Σάββατο": ["Κορμός", "Στήθος"],
                "Κυριακή": ["Στήθος", "Χέρια", "Κορμός", "Πλάτη"]
            };
            const searchGroups = priorities[day] || ["Κορμός"];

            for (let groupName of searchGroups) {
                if (currentMinutes >= 45) break;
                if (!window.exercisesDB) break;

                const potentialEx = window.exercisesDB.filter(ex => ex.muscleGroup === groupName);

                for (let sEx of potentialEx) {
                    if (currentMinutes >= 45) break;
                    if (sEx.name.includes("Ποδηλασία") || sEx.name.includes("Cycling") || sEx.name.includes("Stretching") || sEx.name.includes("Warmup")) continue;
                    // PEGASUS 134: Τα πόδια συμπληρώνονται μόνο από cycling Σ/Κ, ποτέ με gym-leg filler.
                    if (sEx.muscleGroup === "Πόδια") continue;

                    const done = sessionTracker[groupName] || 0;
                    const target = currentTargets[groupName] || 24;

                    if (done < target && !mappedData.some(m => m.name.trim() === sEx.name.trim())) {
                        let spilloverEx = this.calculateExercise({ ...sEx, sets: 5 }, sessionTracker, currentTargets);
                        if (spilloverEx.adjustedSets > 0) {
                            spilloverEx.isSpillover = true;
                            mappedData.push(spilloverEx);
                            currentMinutes = getActiveMins(mappedData);
                        }
                    }
                }
            }
        }

        if (window.PegasusEngine?.dispatch) {
            window.PegasusEngine.dispatch({
                type: "OPTIMIZER_APPLIED",
                payload: {
                    day: day,
                    totalExercises: mappedData.length,
                    activeMinutes: currentMinutes
                }
            });
        }

        return mappedData;
    },

    calculateExercise: function(ex, tracker, currentTargets) {
        const group = this.getGroup(ex.name);
        const target = currentTargets[group] || 24;
        const remaining = target - (tracker[group] || 0);

        // PEGASUS 296: Brain minimum-duration top-up is intentional maintenance volume.
        // It must not be cut back to 0 just because the weekly target is almost complete.
        let finalSets = (ex.brainFixedSplit || ex.brainMinimumTopUp)
            ? Math.max(1, Math.round(Number(ex.sets) || 1))
            : ((remaining <= 0) ? 0 : (ex.sets > remaining ? remaining : ex.sets));

        // 🚴 PEGASUS 137: Cycling credits are capped by the remaining leg target.
        // Η άσκηση εμφανίζεται αν λείπει ΕΣΤΩ ΚΑΙ 1 σετ (remaining > 0)
        const isCycling = ex.name.includes("Ποδηλασία") || ex.name.includes("Cycling");

        if (isCycling) {
            finalSets = (remaining > 0) ? 1 : 0;
        }

        if (finalSets > 0) {
            // Cycling fills only the remaining leg target; it never overshoots 24/24.
            tracker[group] = (tracker[group] || 0) + (isCycling ? Math.max(0, remaining) : finalSets);
        }

        return {
            ...ex,
            adjustedSets: finalSets,
            isCompleted: !(ex.brainFixedSplit || ex.brainMinimumTopUp) && remaining <= 0,
            muscleGroup: group
        };
    },

    getGroup: function(name) {
        const cleanName = String(name || "").trim().replace(" ☀️", "");

        if (typeof window.getPegasusExerciseGroup === "function") {
            return window.getPegasusExerciseGroup(cleanName);
        }

        if (window.exercisesDB) {
            const match = window.exercisesDB.find(ex => ex.name === cleanName);
            if (match) return match.muscleGroup;
        }

        const n = cleanName.toLowerCase();

        // Keyword Mapping Logic
        if (n.includes("στήθος") || n.includes("chest") || n.includes("pushups")) return "Στήθος";
        if (n.includes("πλάτη") || n.includes("row") || n.includes("pulldown") || n.includes("back")) return "Πλάτη";

        // 🎯 FIXED Priority: "leg raise" -> Κορμός, "lateral raise" -> Ώμοι
        if (n.includes("leg raise")) return "Κορμός";
        if (n.includes("πόδια") || n.includes("leg") || n.includes("kickbacks") || n.includes("cycling") || n.includes("ποδηλασία")) return "Πόδια";
        if (n.includes("χέρια") || n.includes("bicep") || n.includes("tricep") || n.includes("curls")) return "Χέρια";

        if (n.includes("ώμοι") || n.includes("shoulder") || n.includes("upright") || n.includes("lateral")) return "Ώμοι";
        if (n.includes("κορμός") || n.includes("abs") || n.includes("crunch") || n.includes("plank") || n.includes("raise")) return "Κορμός";

        return "Άλλο";
    }
};
