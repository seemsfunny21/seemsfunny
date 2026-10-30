/* ==========================================================================
   PEGASUS MUSCLE PROGRESS VISUALIZER - v7.8 (STRICT WEEKLY PREVIEW FIX)
   Protocol: Weekly Accumulated Progress, Dynamic Targets & No Daily-Live Badges
   Status: FINAL STABLE | FIXED: PREVIEW READS WEEKLY HISTORY ONLY
   ========================================================================== */

// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;

window.MuscleProgressUI = {
    lastDataHash: null,

    ensureStyles() {
        if (document.getElementById("pegasus-weekly-progress-style")) return;

        const style = document.createElement("style");
        style.id = "pegasus-weekly-progress-style";
        style.textContent = `
            .pegasus-weekly-progress-card {
                background: rgba(0,0,0,0.85);
                border: 1px solid rgba(0,255,65,0.27);
                border-radius: 12px;
                padding: 15px;
                width: 100%;
                box-sizing: border-box;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                gap: 14px;
            }

            .pegasus-weekly-progress-title-wrap {
                display: flex;
                justify-content: center;
                margin-bottom: 2px;
            }

            .pegasus-weekly-progress-title {
                font-size: var(--pg-font-status, 11px);
                font-weight: 900;
                letter-spacing: 0.08em;
                color: var(--main, #00ff41);
                background: rgba(0,255,65,0.08);
                border: 1px solid rgba(0,255,65,0.2);
                border-radius: 999px;
                padding: 4px 10px;
            }

            .pegasus-weekly-progress-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }

            .pegasus-weekly-progress-item {
                background: rgba(255,255,255,0.03);
                padding: 6px 8px;
                border-radius: 6px;
                border: 1px solid #222;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .pegasus-weekly-progress-label {
                display: flex;
                justify-content: space-between;
                color: #aaa;
                margin-bottom: 3px;
                font-weight: 800;
                text-transform: none;
                font-size: var(--pg-font-status, 11px);
            }

            .pegasus-weekly-progress-value {
                color: var(--main, #00ff41);
            }

            .pegasus-weekly-progress-track {
                width: 100%;
                height: 4px;
                background: #111;
                border-radius: 2px;
                overflow: hidden;
                border: 0.5px solid #333;
            }

            .pegasus-weekly-progress-fill {
                height: 100%;
                background: var(--main, #00ff41);
                box-shadow: 0 0 6px rgba(0,255,65,0.67);
                transition: width 1.2s cubic-bezier(0.17, 0.67, 0.83, 0.67);
            }
        `;
        document.head.appendChild(style);
    },

    init() {
        try {
            this.checkWeeklyReset();
            setTimeout(() => this.render(true), 500);

            setInterval(() => {
                this.checkWeeklyReset();
                this.render();
            }, 3000);
        } catch (e) {
            console.error("❌ PEGASUS UI: Initialization failed", e);
        }
    },

    calculateStats() {
        if (window.PegasusWeeklyProgress?.reconcile) {
            try { window.PegasusWeeklyProgress.reconcile({ source: "progress-ui-render", push: false }); } catch (e) {}
        } else if (typeof window.reconcilePegasusWeeklyHistoryFromDailyProgress === "function") {
            try { window.reconcilePegasusWeeklyHistoryFromDailyProgress({ source: "progress-ui-render", push: false }); } catch (e) {}
        }

        const strictGroups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];
        const emptyMap = () => ({ "Στήθος": 0, "Πλάτη": 0, "Πόδια": 0, "Χέρια": 0, "Ώμοι": 0, "Κορμός": 0 });

        const safeJson = (raw, fallback) => {
            try {
                const parsed = JSON.parse(raw || "{}");
                return parsed && typeof parsed === "object" ? parsed : fallback;
            } catch (e) {
                return fallback;
            }
        };

        const normalizeMap = (source, fallback) => {
            const base = emptyMap();
            strictGroups.forEach(group => {
                const value = parseFloat(source?.[group]);
                const fallbackValue = parseFloat(fallback?.[group]);
                base[group] = Math.max(0, Number.isFinite(value) ? value : (Number.isFinite(fallbackValue) ? fallbackValue : 0));
            });
            return base;
        };

        const historyKey = M?.workout?.weekly_history || "pegasus_weekly_history";
        const targetsKey = M?.workout?.muscleTargets || "pegasus_muscle_targets";

        const storedHistory = safeJson(localStorage.getItem(historyKey), emptyMap());
        const history = normalizeMap(storedHistory, emptyMap());

        let rawTargets = null;
        if (window.PegasusOptimizer && typeof window.PegasusOptimizer.getTargets === "function") {
            rawTargets = window.PegasusOptimizer.getTargets();
        } else if (typeof window.getDynamicTargets === "function") {
            rawTargets = window.getDynamicTargets();
        } else {
            rawTargets = safeJson(localStorage.getItem(targetsKey), null);
        }

        const fallbackTargets = {
            "Στήθος": 14,
            "Πλάτη": 16,
            "Πόδια": 8,
            "Χέρια": 12,
            "Ώμοι": 8,
            "Κορμός": 16
        };
        const targets = normalizeMap(rawTargets, fallbackTargets);

        return { history, targets, source: "weekly_accumulated" };
    },

    getActiveExercises() {
        const activeExerciseElements = document.querySelectorAll(".exercise");

        return Array.from(activeExerciseElements)
            .map(el => {
                const total = Math.max(0, parseFloat(el.dataset.total) || 0);
                const done = Math.max(0, parseFloat(el.dataset.done) || 0);
                return {
                    name: el.querySelector(".exercise-name")?.innerText?.trim() || "",
                    isSkipped: el.classList.contains("exercise-skipped"),
                    total,
                    done,
                    isCompleted: total > 0 && done >= total
                };
            })
            .filter(ex => ex.name !== "");
    },

    getImagePath(exerciseName) {
        const cleanName = exerciseName
            .split("(")[0]
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "")
            .replace(/[^\w\u0370-\u03FF]+/g, "");

        const mappedVal = window.videoMap ? window.videoMap[exerciseName.trim()] : null;
        const imgBase = mappedVal || cleanName;

        return `images/${imgBase}.png`;
    },

    render(force = false) {
        this.ensureStyles();
        const container = document.getElementById("muscleProgressContainer");
        if (!container) return;

        const { history, targets, source } = this.calculateStats();
        // PEGASUS 206: Preview must not show a sync-wait state or trigger cloud work.
        // It renders the current local weekly state immediately, including clean 0/target after reset.
        const historyTotal = Object.values(history || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);

        const activeExercises = this.getActiveExercises();

        const currentHash =
            JSON.stringify(history) +
            JSON.stringify(targets) +
            JSON.stringify(activeExercises);

        if (!force && this.lastDataHash === currentHash) return;
        this.lastDataHash = currentHash;

        const pegasusGreen = "#00ff41";

        let htmlString = `
        <div class="pegasus-weekly-progress-card">
            <div class="pegasus-weekly-progress-grid">`;

        const strictGroups = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];

        strictGroups.forEach(name => {
            const target = parseInt(targets[name]) || 0;
            const done = parseInt(history[name]) || 0;
            const percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
            const isDone = target > 0 && done >= target;

            htmlString += `
            <div class="pegasus-weekly-progress-item">
                <div class="pegasus-weekly-progress-label">
                    <span>${name}</span>
                    <span class="pegasus-weekly-progress-value">${done}/${target}${isDone ? " 🎯" : ""}</span>
                </div>
                <div class="pegasus-weekly-progress-track">
                    <div class="pegasus-weekly-progress-fill" style="width: ${percent}%;"></div>
                </div>
            </div>`;
        });

        htmlString += `</div>`;

        // Strict weekly preview: no daily-live exercise/set badges here.
        // The exercise thumbnails remain in #previewContent; this box stays weekly-only.

        htmlString += `</div>`;

        htmlString = htmlString.replace(/font-size:\s*[^;"]+;?/g, "");
        container.innerHTML = htmlString;
        container.style.display = "block";
    },

    checkWeeklyReset() {
        window.enforcePegasusMondayWeeklyReset?.({ source: 'progress-ui', push: true });
    }
};

// 🚀 Εκκίνηση
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.MuscleProgressUI.init());
} else {
    window.MuscleProgressUI.init();
}


