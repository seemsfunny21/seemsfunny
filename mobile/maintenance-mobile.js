/* ==========================================================================
   ⚙️ PEGASUS MODULE: PERIODIC MAINTENANCE PROTOCOL (v1.0)
   Protocol: Recursive Task Scheduling & Countdown Logic
   ========================================================================== */

(function() {
    const MAINTENANCE_DATA_KEY = 'pegasus_maintenance_v1';

    window.PegasusMaintenance = {
        toggleAddForm: function() {
            const form = document.getElementById('addMaintForm');
            const btn = document.getElementById('btnAddMaint');
            if(form.style.display === 'none') {
                form.style.display = 'block';
                btn.innerHTML = 'Χ Κλείσιμο';
                btn.style.background = '#ff4444';
            } else {
                form.style.display = 'none';
                btn.innerHTML = '+ Νέο καθήκον';
                btn.style.background = 'var(--main)';
            }
        },

        addNewTask: function() {
            const label = document.getElementById('maintLabel').value;
            const days = parseInt(document.getElementById('maintDays').value);

            if(!label || isNaN(days)) {
                alert('Σφάλμα: Εισάγετε Περιγραφή και Συχνότητα (Ημέρες).');
                return;
            }

            let tasks = JSON.parse(localStorage.getItem(MAINTENANCE_DATA_KEY)) || [];

            const newEntry = {
                id: 'maint_' + Date.now(),
                label: label.trim(),
                interval: days,
                lastDone: Date.now() // Ξεκινάει από σήμερα
            };

            tasks.push(newEntry);
            this.saveAndRender(tasks);
            this.toggleAddForm();
            document.getElementById('maintLabel').value = '';
            document.getElementById('maintDays').value = '';
        },

        resetTask: function(id) {
            let tasks = JSON.parse(localStorage.getItem(MAINTENANCE_DATA_KEY)) || [];
            const idx = tasks.findIndex(t => t.id === id);
            if (idx === -1) return;

            tasks[idx].lastDone = Date.now();
            this.saveAndRender(tasks);
        },

        deleteTask: function(id) {
            if(confirm('Οριστική διαγραφή αυτού του καθήκοντος;')) {
                let tasks = JSON.parse(localStorage.getItem(MAINTENANCE_DATA_KEY)) || [];
                tasks = tasks.filter(t => t.id !== id);
                this.saveAndRender(tasks);
            }
        },

        saveAndRender: function(data) {
            localStorage.setItem(MAINTENANCE_DATA_KEY, JSON.stringify(data));
            window.renderMaintenanceContent();

            if (window.PegasusCloud && typeof window.PegasusCloud.push === 'function') {
                window.PegasusCloud.push(true); // 🛡️ FIX: Aκαριαίο Cloud Sync
            }
        }
    };

    function injectViewLayer() {
        if (document.getElementById('maintenance')) return;
        const viewDiv = document.createElement('div');
        viewDiv.id = 'maintenance';
        viewDiv.className = 'view';

        viewDiv.innerHTML = `
            <button class="btn-back" onclick="openView('home')">◀ Επιστροφή</button>
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
                <button id="btnAddMaint" class="primary-btn" style="width: auto; margin: 0 auto; padding: 7px 14px; font-size: 10px; border-radius: 8px;" onclick="window.PegasusMaintenance.toggleAddForm()">
                    + Νέο καθήκον
                </button>
            </div>

            <div id="addMaintForm" class="mini-card" style="display: none; border-color: var(--main); margin-bottom: 20px; padding: 15px;">
                <input type="text" id="maintLabel" placeholder="Περιγραφή (π.χ. Καθαρισμός Ποδηλάτου)" style="margin-bottom: 10px; border: 2px solid #444;">
                <input type="number" id="maintDays" placeholder="Συχνότητα σε Ημέρες (π.χ. 14)" inputmode="numeric" style="margin-bottom: 15px; border: 2px solid #444;">
                <button class="primary-btn" onclick="window.PegasusMaintenance.addNewTask()">Έναρξη πρωτοκόλλου</button>
            </div>

            <div id="maint-content" style="width: 100%; display: flex; flex-direction: column; gap: 12px; padding-bottom: 80px;"></div>
        `;
        document.body.appendChild(viewDiv);
    }

    // 4. Rendering Engine (Σχεδίαση Λίστας - V1.1 CALENDAR SYNC)
    window.renderMaintenanceContent = function() {
        const container = document.getElementById('maint-content');
        if (!container) return;

        const tasks = JSON.parse(localStorage.getItem(MAINTENANCE_DATA_KEY)) || [];

        // 🚀 ΝΕΑ ΛΟΓΙΚΗ: Ημερολογιακός Υπολογισμός (Μεσάνυχτα)
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Σημερινή ημέρα ακριβώς τα μεσάνυχτα

        container.innerHTML = tasks.map(task => {
            const lastDoneDate = new Date(task.lastDone);
            lastDoneDate.setHours(0, 0, 0, 0); // Ημέρα τελευταίας εκτέλεσης τα μεσάνυχτα

            const oneDay = 24 * 60 * 60 * 1000; // Χιλιοστά του δευτερολέπτου σε 1 μέρα

            // Υπολογισμός πραγματικών ημερολογιακών ημερών που πέρασαν
            const daysElapsed = Math.floor((now.getTime() - lastDoneDate.getTime()) / oneDay);
            const diffDays = task.interval - daysElapsed;

            let statusColor = '#00ff41';
            let statusTxt = `${diffDays} ημέρες`;

            if (diffDays <= 0) {
                statusColor = '#ff4444';
                statusTxt = 'Λήξη - εκτέλεση τώρα';
            } else if (diffDays <= 2) {
                statusColor = '#ffbb33';
                statusTxt = 'Προσεχώς';
            }

            // Υπολογισμός ποσοστού για την μπάρα
            const pct = Math.max(0, Math.min(100, (diffDays / task.interval) * 100));

            return `
                <div class="mini-card" style="border-left: 4px solid ${statusColor}; padding: 15px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: 900; font-size: 14px; color: #fff; text-transform: none;">${task.label}</div>
                            <div style="font-size: 10px; color: ${statusColor}; font-weight: 800; margin-top: 2px;">Κατάσταση: ${statusTxt}</div>
                        </div>
                        <button onclick="window.PegasusMaintenance.deleteTask('${task.id}')" style="background:none; border:none; color:#333; font-size:12px; cursor: pointer;">🗑️</button>
                    </div>

                    <div class="bar-bg" style="height: 4px; margin-bottom: 15px;">
                        <div class="bar-fill" style="width: ${pct}%; background: ${statusColor}; transition: width 0.5s ease;"></div>
                    </div>

                    <button class="primary-btn" style="padding: 10px; font-size: 11px; background: rgba(0,255,65,0.05); border-color: ${statusColor}; color: ${statusColor};"
                            onclick="window.PegasusMaintenance.resetTask('${task.id}')">
                        ✅ Ολοκληρώθηκε (reset)
                    </button>
                </div>
            `;
        }).join('');
    };

    document.addEventListener("DOMContentLoaded", () => {
        injectViewLayer();
        window.renderMaintenanceContent();
        if (window.registerPegasusModule) {
            window.registerPegasusModule({ id: 'maintenance', label: 'Συντήρηση', icon: '⚙️' });
        }
    });
})();
