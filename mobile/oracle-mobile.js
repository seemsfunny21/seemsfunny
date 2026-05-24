/* ==========================================================================
   🧠 PEGASUS MODULE: ORACLE (v2.3 - STATIC HOME HEADER)
   Protocol: Color-Synced Text, Left Alignment, No-Header UI
   ========================================================================== */

(function() {
    window.PegasusOracle = {
        analyzeData: function() {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            const supplies = JSON.parse(localStorage.getItem('pegasus_supplies_v1')) || [];
            const maint = JSON.parse(localStorage.getItem('pegasus_maintenance_v1')) || [];
            const bio = JSON.parse(localStorage.getItem('pegasus_biometrics_v1')) || [];
            const missions = JSON.parse(localStorage.getItem('pegasus_missions_v1')) || [];

            // --- 1. ΥΠΝΟΣ & ΣΤΟΧΟΙ (🟢 / 🟠 / 🔴) ---
            let sleep = 0; if (bio.length > 0) sleep = bio[0].sleep;
            let completed = missions.filter(m => m.completed).length;
            let pct = missions.length > 0 ? (completed / missions.length) * 100 : 0;

            let row1 = { icon: '🟢', color: '#00ff41', txt: "Όλα τα συστήματα λειτουργούν φυσιολογικά." };

            if (sleep >= 9) {
                row1 = { icon: '🟢', color: '#00ff41', txt: `Εξαιρετική ανάρρωση (Ύπνος ${sleep}/10). Έτοιμος για προπόνηση!` };
            } else if (sleep >= 6) {
                row1 = { icon: '🟠', color: '#ffbb33', txt: `Μέτρια ανάρρωση (Ύπνος ${sleep}/10). Προσοχή στην ένταση.` };
            } else if (sleep > 0) {
                row1 = { icon: '🔴', color: '#ff4444', txt: `Κακός ύπνος (${sleep}/10). Προτεραιότητα στην ξεκούραση.` };
            } else if (pct >= 80) {
                row1 = { icon: '🟢', color: '#00ff41', txt: `Υψηλή πειθαρχία: ${Math.round(pct)}% των στόχων ολοκληρώθηκαν.` };
            }

            // --- 2. ΕΠΙΚΕΙΜΕΝΑ ΚΑΘΗΚΟΝΤΑ (🟠) ---
            let low = supplies.filter(s => { const r = s.amount/s.portion; return r > 0 && r <= 1.1; }).map(s => s.label);
            let todayMaint = maint.filter(t => Math.ceil(((t.lastDone + (t.interval * oneDay)) - now) / oneDay) === 0).map(t => t.label);

            let warningTxt = "Κανένα επικείμενο καθήκον.";
            let hasWarning = low.length > 0 || todayMaint.length > 0;

            if (hasWarning) {
                let parts = [];
                if (low.length > 0) parts.push(`Οριακά: ${low.join(', ')}`);
                if (todayMaint.length > 0) parts.push(`Σήμερα: ${todayMaint.join(', ')}`);
                warningTxt = parts.join(" | ");
            }

            // --- 3. ΚΡΙΣΙΜΑ (🔴) ---
            let empty = supplies.filter(s => (s.amount/s.portion) <= 0).map(s => s.label);
            let overdue = maint.filter(t => Math.ceil(((t.lastDone + (t.interval * oneDay)) - now) / oneDay) < 0).map(t => t.label);

            let criticalTxt = "Καμία κρίσιμη προειδοποίηση.";
            let hasCritical = empty.length > 0 || overdue.length > 0;

            if (hasCritical) {
                let parts = [];
                if (empty.length > 0) {
                    const verb = empty.length === 1 ? "Εξαντλήθηκε" : "Εξαντλήθηκαν";
                    parts.push(`${verb}: ${empty.join(', ')}`);
                }
                if (overdue.length > 0) {
                    const verb = overdue.length === 1 ? "Εργασία" : "Εργασίες";
                    parts.push(`Εκτός χρόνου ${verb}: ${overdue.join(', ')}`);
                }
                criticalTxt = parts.join(" | ");
            }

            return [
                row1,
                { icon: '🟠', color: hasWarning ? '#ffbb33' : '#666', txt: warningTxt, active: hasWarning },
                { icon: '🔴', color: hasCritical ? '#ff4444' : '#666', txt: criticalTxt, active: hasCritical }
            ];
        },

        injectDashboard: function() {
            const staticHost = document.getElementById('mobileStaticDashboard');
            const grid = document.getElementById('dynamic-grid');
            const host = staticHost || grid;
            if (!host) return;

            const existing = document.getElementById('oracle-dashboard');
            if (existing) existing.remove();

            const rows = this.analyzeData();
            const dashboard = document.createElement('div');
            dashboard.id = 'oracle-dashboard';

            dashboard.style.cssText = `
                width: 100%;
                grid-column: 1 / -1;
                background: linear-gradient(145deg, rgba(15,15,15,0.95) 0%, rgba(5,5,5,0.95) 100%);
                border: 1px solid var(--main);
                border-radius: 16px;
                padding: 15px;
                margin: 0 0 12px 0;
                display: flex;
                flex-direction: column;
                gap: 10px;
                box-sizing: border-box;
            `;

            dashboard.innerHTML = rows.map(row => `
                <div style="display: flex; align-items: flex-start; gap: 10px; width: 100%;">
                    <div style="font-size: 16px; margin-top: -2px; flex-shrink: 0;">${row.icon}</div>
                    <div style="font-size: 11px; color: ${row.color}; font-weight: 700; line-height: 1.4; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                        ${row.txt}
                    </div>
                </div>
            `).join('');

            if (staticHost) {
                staticHost.innerHTML = "";
                staticHost.appendChild(dashboard);
            } else if (grid) {
                grid.insertBefore(dashboard, grid.firstChild);
            }
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        if (window.PegasusMobileUI) {
            const originalRender = window.PegasusMobileUI.render;
            window.PegasusMobileUI.render = function() {
                originalRender.apply(this, arguments);
                setTimeout(() => window.PegasusOracle.injectDashboard(), 50);
            };
            setTimeout(() => window.PegasusOracle.injectDashboard(), 100);
        }
    });
})();

/* ==========================================================================
   ☀️ PEGASUS MODULE: MORNING CHECK-IN PROTOCOL
   Status: DISABLED - replaced by Body auto check-in after 05:00
   ========================================================================== */

(function() {
    // PEGASUS 172: No morning weight notification.
    // The morning flow now opens the Σώμα module directly via biometrics-mobile.js.
})();
