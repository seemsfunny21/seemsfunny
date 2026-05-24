/* ==========================================================================
   🎯 PEGASUS MODULE: DAILY MISSION CONTROL (v1.3 MAXIMALIST)
   Protocol: Habit Tracking, Safe Date Formats & Instant Mobile Sync
   Status: FINAL STABLE | FIXED: UNIFIED DATE PADDING FOR RESET LOGIC
   ========================================================================== */

(function() {
    const MISSIONS_DATA_KEY = 'pegasus_missions_v1';
    const MISSIONS_DATE_KEY = 'pegasus_missions_date';

    // 🎯 FIXED: Strict Date Padding Protocol (DD/MM/YYYY)
    const getStrictDateStr = () => {
        const d = new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}/${d.getFullYear()}`;
    };

    window.PegasusMissions = {
        checkDailyReset: function() {
            const today = getStrictDateStr();
            const lastSavedDate = localStorage.getItem(MISSIONS_DATE_KEY);

            // Αν η ημερομηνία άλλαξε, μηδενίζουμε τις αποστολές για τη νέα μέρα
            if (lastSavedDate !== today) {
                console.log("🎯 MISSIONS: New day detected. Resetting progress...");
                let missions = JSON.parse(localStorage.getItem(MISSIONS_DATA_KEY)) || [];
                missions.forEach(m => m.completed = false);

                localStorage.setItem(MISSIONS_DATA_KEY, JSON.stringify(missions));
                localStorage.setItem(MISSIONS_DATE_KEY, today);
            }
        },

        toggleMission: function(id) {
            let missions = JSON.parse(localStorage.getItem(MISSIONS_DATA_KEY)) || [];
            const idx = missions.findIndex(m => m.id === id);
            if (idx === -1) return;

            missions[idx].completed = !missions[idx].completed;
            this.saveAndRender(missions);
        },

        toggleAddForm: function() {
            const form = document.getElementById('addMissionForm');
            const btn = document.getElementById('btnAddMission');
            if(!form || !btn) return;

            if(form.style.display === 'none') {
                form.style.display = 'block';
                btn.innerHTML = 'Χ Κλείσιμο';
                btn.style.background = '#ff4444';
            } else {
                form.style.display = 'none';
                btn.innerHTML = '+ Νέος στόχος';
                btn.style.background = 'var(--main)';
            }
        },

        addNewMission: function() {
            const titleInput = document.getElementById('newMissionTitle');
            const title = titleInput ? titleInput.value : "";

            if(!title || title.trim() === '') {
                alert('Παρακαλώ εισάγετε τον τίτλο του στόχου.');
                return;
            }

            let missions = JSON.parse(localStorage.getItem(MISSIONS_DATA_KEY)) || [];

            const newEntry = {
                id: 'mis_' + Date.now(),
                title: title.trim(),
                completed: false
            };

            missions.push(newEntry);
            this.saveAndRender(missions);
            this.toggleAddForm();

            if(titleInput) titleInput.value = '';
        },

        deleteMission: function(id) {
            if(confirm('Διαγραφή αυτού του Ημερήσιου Στόχου;')) {
                let missions = JSON.parse(localStorage.getItem(MISSIONS_DATA_KEY)) || [];
                missions = missions.filter(m => m.id !== id);
                this.saveAndRender(missions);
            }
        },

        saveAndRender: async function(data) {
            localStorage.setItem(MISSIONS_DATA_KEY, JSON.stringify(data));
            localStorage.setItem(MISSIONS_DATE_KEY, getStrictDateStr());

            window.renderMissionsContent();

            // 🛡️ Instant Cloud Sync για το Mobile Interface
            if (window.PegasusCloud && typeof window.PegasusCloud.push === 'function') {
                await window.PegasusCloud.push(true);
            }
        }
    };

    function injectViewLayer() {
        if (document.getElementById('missions')) return;
        const viewDiv = document.createElement('div');
        viewDiv.id = 'missions';
        viewDiv.className = 'view';

        viewDiv.innerHTML = `
            <button class="btn-back" onclick="openView('home')">◀ Επιστροφή</button>
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
                <button id="btnAddMission" class="primary-btn" style="width: auto; margin: 0 auto; padding: 7px 14px; font-size: 10px; border-radius: 8px;" onclick="window.PegasusMissions.toggleAddForm()">
                    + Νέος στόχος
                </button>
            </div>

            <div id="addMissionForm" class="mini-card" style="display: none; border-color: var(--main); margin-bottom: 20px; padding: 15px;">
                <div style="font-size: 11px; font-weight: 900; color: var(--main); margin-bottom: 10px; text-align: center;">Νέα συνήθεια</div>
                <input type="text" id="newMissionTitle" placeholder="π.χ. Διάβασμα 30 Λεπτά..." style="margin-bottom: 15px; border: 2px solid #444;">
                <button class="primary-btn" onclick="window.PegasusMissions.addNewMission()">Προσθήκη</button>
            </div>

            <div class="mini-card" style="padding: 20px; text-align: center; border-color: #222; background: rgba(20,20,20,0.8); margin-bottom: 20px;">
                <div id="missionDate" style="font-size: 10px; color: #777; font-weight: 800; letter-spacing: 2px; margin-bottom: 5px;">Σήμερα</div>
                <div id="missionPctTxt" style="font-size: 32px; font-weight: 900; color: var(--main); margin-bottom: 10px; text-shadow: 0 0 10px rgba(0,255,65,0.2);">0%</div>
                <div class="bar-bg" style="height: 8px;"><div id="missionProgressBar" class="bar-fill" style="width: 0%;"></div></div>
            </div>

            <div id="missions-content" style="width: 100%; display: flex; flex-direction: column; gap: 8px; padding-bottom: 80px;"></div>
        `;
        document.body.appendChild(viewDiv);
    }

    window.renderMissionsContent = function() {
        const container = document.getElementById('missions-content');
        const pctTxt = document.getElementById('missionPctTxt');
        const progressBar = document.getElementById('missionProgressBar');
        const dateTxt = document.getElementById('missionDate');

        if (!container) return;

        window.PegasusMissions.checkDailyReset();

        const missions = JSON.parse(localStorage.getItem(MISSIONS_DATA_KEY)) || [];

        if (dateTxt) dateTxt.textContent = getStrictDateStr();

        let completedCount = 0;
        let html = '';

        missions.forEach(mission => {
            if (mission.completed) completedCount++;

            const isDone = mission.completed;
            const bgColor = isDone ? 'rgba(0,255,65,0.1)' : 'rgba(15,15,15,0.95)';
            const borderColor = isDone ? 'var(--main)' : '#333';
            const icon = isDone ? '✅' : '⬜';
            const textStyle = isDone ? 'text-decoration: line-through; color: #777;' : 'color: #fff;';

            html += `
                <div class="mini-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-color: ${borderColor}; background: ${bgColor}; transition: all 0.3s ease;">
                    <div style="display: flex; align-items: center; gap: 15px; flex: 1; cursor: pointer;" onclick="window.PegasusMissions.toggleMission('${mission.id}')">
                        <div style="font-size: 20px;">${icon}</div>
                        <div style="font-size: 14px; font-weight: 800; ${textStyle}">${mission.title}</div>
                    </div>
                    <button onclick="window.PegasusMissions.deleteMission('${mission.id}')"
                            style="background: transparent; border: none; color: #555; font-size: 14px; padding: 5px; cursor: pointer;">
                        🗑️
                    </button>
                </div>
            `;
        });

        const total = missions.length;
        let percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

        if (pctTxt) pctTxt.textContent = `${percentage}%`;
        if (progressBar) progressBar.style.width = `${percentage}%`;

        if (percentage === 100 && total > 0) {
            if(pctTxt) {
                pctTxt.style.color = '#00ff41';
                pctTxt.style.textShadow = '0 0 20px rgba(0,255,65,0.6)';
            }
        } else {
            if(pctTxt) {
                pctTxt.style.color = 'var(--main)';
                pctTxt.style.textShadow = '0 0 10px rgba(0,255,65,0.2)';
            }
        }

        container.innerHTML = html || '<div style="color:#555; font-size:11px; text-align:center; margin-top:20px;">Δεν έχεις ορίσει δραστηριότητες</div>';
    };

    document.addEventListener("DOMContentLoaded", () => {
        injectViewLayer();
        window.renderMissionsContent();

        if (window.registerPegasusModule) {
            window.registerPegasusModule({
                id: 'missions',
                label: 'Δραστηριότητες',
                icon: '📋'
            });
        }
    });
})();
