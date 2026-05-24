/* ==========================================================================
   🧬 PEGASUS MODULE: BIO-METRICS & RECOVERY TRACKER (v1.3)
   Protocol: Daily Tri-Metric Heatmap, 05:00 Auto Check-In & Cloud Sync
   Status: MEMORY PROTECTED | SYNTAX VERIFIED
   ========================================================================== */

(function() {
    const BIO_DATA_KEY = 'pegasus_biometrics_v1';

    // 1. Μηχανή Δεδομένων
    function getTodayLabel() {
        return new Date().toLocaleDateString('el-GR');
    }

    function loadEntries() {
        try {
            const raw = JSON.parse(localStorage.getItem(BIO_DATA_KEY) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (e) {
            console.error('PEGASUS BIO: Failed to parse entries.', e);
            return [];
        }
    }

    function isComplete(entry) {
        return !!entry && Number(entry.sleep) > 0 && Number(entry.energy) > 0 && Number(entry.recovery) > 0;
    }

    window.PegasusBio = {
        autoOpenHour: 5,
        autoOpenedDate: null,

        setMetric: function(id, metricType, value) {
            let entries = loadEntries();
            const idx = entries.findIndex(e => e.id === id);
            if (idx === -1) return;

            entries[idx][metricType] = value;
            const updatedEntry = entries[idx];
            this.saveAndRender(entries);

            if (updatedEntry.date === getTodayLabel() && isComplete(updatedEntry)) {
                this.autoOpenedDate = updatedEntry.date;
                setTimeout(() => {
                    if (typeof window.openView === 'function') window.openView('home');
                }, 280);
            }
        },

        ensureTodayEntry: function(options = {}) {
            let entries = loadEntries();
            const today = getTodayLabel();
            let entry = entries.find(e => e.date === today);

            if (entry) {
                if (!options.silent && isComplete(entry)) {
                    alert('Υπάρχει ήδη πλήρης καταγραφή για σήμερα. Μπορείς να την επεξεργαστείς.');
                }
                return entry;
            }

            entry = {
                id: 'bio_' + Date.now(),
                date: today,
                sleep: 0,
                energy: 0,
                recovery: 0
            };

            entries.unshift(entry);
            this.saveAndRender(entries);
            return entry;
        },

        addNewEntry: function() {
            let entries = loadEntries();
            const today = getTodayLabel();
            const existing = entries.find(e => e.date === today);

            if (existing) {
                alert('Υπάρχει ήδη καταγραφή για σήμερα. Μπορείς να την επεξεργαστείς.');
                return;
            }

            this.ensureTodayEntry({ silent: true });
        },

        deleteEntry: function(id) {
            if(confirm('Διαγραφή της βιομετρικής καταγραφής;')) {
                let entries = loadEntries();
                entries = entries.filter(e => e.id !== id);
                this.saveAndRender(entries);
            }
        },

        getTodayEntry: function() {
            const today = getTodayLabel();
            return loadEntries().find(e => e.date === today) || null;
        },

        runMorningAutoOpen: function(retryCount = 0) {
            const now = new Date();
            const today = getTodayLabel();
            const pinModal = document.getElementById('pinModal');
            const pinVisible = pinModal && pinModal.style.display !== 'none' && getComputedStyle(pinModal).display !== 'none';

            if (now.getHours() < this.autoOpenHour) return;

            if (pinVisible && retryCount < 20) {
                setTimeout(() => this.runMorningAutoOpen(retryCount + 1), 500);
                return;
            }

            if (this.autoOpenedDate === today) return;

            const current = this.getTodayEntry();
            if (isComplete(current)) return;

            this.ensureTodayEntry({ silent: true });
            this.autoOpenedDate = today;

            setTimeout(() => {
                if (typeof window.openView === 'function') {
                    window.openView('biometrics');
                    setTimeout(() => {
                        document.getElementById('bio-content')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                    }, 80);
                }
            }, 120);
        },

        saveAndRender: function(data) {
            // 🛡️ MEMORY CAP: Αποτροπή QuotaExceededError (Κρατάει τις τελευταίες 100 εγγραφές)
            if (Array.isArray(data)) {
                data = data.slice(0, 100);
            }

            localStorage.setItem(BIO_DATA_KEY, JSON.stringify(data));
            window.renderBioContent();

            // ☁️ REAL-TIME CLOUD TRIGGER (Immediate Sync)
            if (window.PegasusCloud && typeof window.PegasusCloud.push === 'function') {
                window.PegasusCloud.push(true);
            }
        }
    };

    // 2. Κατασκευαστής Οθόνης (View Injector)
    function injectViewLayer() {
        if (document.getElementById('biometrics')) return;
        const viewDiv = document.createElement('div');
        viewDiv.id = 'biometrics';
        viewDiv.className = 'view';

        viewDiv.innerHTML = `
            <button class="btn-back" onclick="openView('home')">◀ Επιστροφή</button>
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
                <button class="primary-btn" style="width: auto; margin: 0 auto; padding: 7px 14px; font-size: 10px; border-radius: 8px;" onclick="window.PegasusBio.addNewEntry()">
                    + Σημερινή μέτρηση
                </button>
            </div>
            <div id="bio-content" style="width: 100%; display: flex; flex-direction: column; gap: 15px; padding-bottom: 80px;"></div>
        `;
        document.body.appendChild(viewDiv);
    }

    // 3. Rendering Engine & Nexus Data Correlation
    window.renderBioContent = function() {
        const container = document.getElementById('bio-content');
        if (!container) return;

        const entries = JSON.parse(localStorage.getItem(BIO_DATA_KEY)) || [];
        let html = '';

        // --- 🧠 PEGASUS NEXUS: Cross-Data Correlation ---
        try {
            const history = JSON.parse(localStorage.getItem('pegasus_weekly_history')) || {};
            const targets = { "Στήθος": 14, "Πλάτη": 16, "Πόδια": 8, "Χέρια": 12, "Ώμοι": 8, "Κορμός": 16 };

            let currentLoad = 0;
            let totalCapacity = 116;

            Object.keys(targets).forEach(k => { currentLoad += (history[k] || 0); });
            let strainPct = Math.min(100, Math.round((currentLoad / totalCapacity) * 100));

            let sleepSum = 0;
            let days = Math.min(3, entries.length);
            for(let i=0; i<days; i++) sleepSum += entries[i].sleep;
            let avgSleep = days > 0 ? (sleepSum / days).toFixed(1) : 0;

            if (days > 0) {
                let color = "var(--main)";
                let msg = "Βέλτιστη αναλογία προπόνησης / αποθεραπείας.";

                if (strainPct > 65 && avgSleep < 6) {
                    color = "#ff4444";
                    msg = "🚨 Κρίσιμο: Υψηλό μυϊκό φορτίο με κακή ποιότητα ύπνου. Αυξημένος κίνδυνος τραυματισμού.";
                } else if (strainPct < 30 && avgSleep >= 7) {
                    color = "#00bcd4";
                    msg = "⚡ Πλήρης ανάρρωση: Το ΚΝΣ είναι έτοιμο για μέγιστη υπερφόρτωση.";
                }

                html += `
                    <div class="mini-card" style="border: 1px solid ${color}; background: rgba(15,15,15,0.95); margin-bottom: 25px;">
                        <div style="font-size: 10px; color: ${color}; font-weight: 900; letter-spacing: 2px; margin-bottom: 10px;">🧠 PEGASUS Nexus insight</div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 11px; color: #fff; font-weight: 900;">
                            <div>Μυϊκή κόπωση: <span style="color:#ffbb33;">${strainPct}%</span></div>
                            <div>Μ.ο. ύπνου: <span style="color:#00bcd4;">${avgSleep}/10</span></div>
                        </div>
                        <div style="font-size: 11px; color: #aaa; line-height: 1.5; font-weight: 600;">${msg}</div>
                    </div>
                `;
            }
        } catch (e) { console.error("Nexus Failed:", e); }

        // --- Bio-Cards Generation ---
        html += entries.map(item => {
            let totalScore = 0, divisor = 0;
            if(item.sleep > 0) { totalScore += item.sleep; divisor++; }
            if(item.energy > 0) { totalScore += item.energy; divisor++; }
            if(item.recovery > 0) { totalScore += item.recovery; divisor++; }

            let avg = divisor > 0 ? (totalScore / divisor).toFixed(1) : '0.0';
            let avgColor = avg >= 7 ? '#00ff41' : (avg >= 4 ? '#ffbb33' : '#ff4444');

            const buildScale = (metricName, currentValue, colorHex) => {
                let scaleHtml = '<div style="display: flex; gap: 4px; margin-top: 8px; margin-bottom: 12px;">';
                for (let i = 1; i <= 10; i++) {
                    let isActive = i <= currentValue;
                    let bg = isActive ? colorHex : 'rgba(255,255,255,0.03)';
                    let textCol = isActive ? '#000' : '#666';
                    scaleHtml += `
                        <div onclick="window.PegasusBio.setMetric('${item.id}', '${metricName}', ${i})"
                             style="flex: 1; height: 30px; display: flex; align-items: center; justify-content: center;
                                    background: ${bg}; color: ${textCol}; border: 1px solid #333; border-radius: 4px;
                                    font-weight: 900; font-size: 12px; cursor: pointer;">
                            ${i}
                        </div>`;
                }
                scaleHtml += '</div>';
                return scaleHtml;
            };

            return `
                <div class="mini-card" style="border-left: 4px solid ${avgColor}; padding: 15px; background: rgba(15,15,15,0.95);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div>
                            <div style="font-weight: 900; font-size: 18px; color: #fff;">${item.date}</div>
                            <div style="font-size: 10px; color: ${avgColor}; font-weight: 900; margin-top: 4px;">Μ.ο. απόδοσης: ${avg}/10</div>
                        </div>
                        <button onclick="window.PegasusBio.deleteEntry('${item.id}')"
                                style="background: rgba(255,68,68,0.1); border: 1px solid #ff4444; color: #ff4444; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;">🗑️</button>
                    </div>
                    <div style="font-size: 10px; color: #00bcd4; font-weight: 900;">💤 Ποιότητα ύπνου</div>
                    ${buildScale('sleep', item.sleep, '#00bcd4')}
                    <div style="font-size: 10px; color: #ffbb33; font-weight: 900;">⚡ Επίπεδα ενέργειας</div>
                    ${buildScale('energy', item.energy, '#ffbb33')}
                    <div style="font-size: 10px; color: #00ff41; font-weight: 900;">🛡️ Αποθεραπεία (DOMS)</div>
                    ${buildScale('recovery', item.recovery, '#00ff41')}
                </div>
            `;
        }).join('');

        container.innerHTML = html || '<div style="color:#555; text-align:center; margin-top:30px;">Καμία καταγραφή</div>';
    };

    // 4. Boot Sequence
    document.addEventListener("DOMContentLoaded", () => {
        injectViewLayer();
        window.renderBioContent();
        if (window.registerPegasusModule) {
            window.registerPegasusModule({ id: 'biometrics', label: 'Σώμα', icon: '🧬' });
        }

        setTimeout(() => window.PegasusBio?.runMorningAutoOpen?.(), 900);
        window.addEventListener('pegasus_sync_complete', () => {
            setTimeout(() => window.PegasusBio?.runMorningAutoOpen?.(), 350);
        });
    });
})();
