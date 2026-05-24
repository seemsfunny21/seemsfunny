/* ==========================================================================
   📦 PEGASUS MODULE: DYNAMIC INVENTORY & AUTO-CRON SYSTEM (v4.1)
   Protocol: Automated Daily Depletion + Restored Maximalist UI
   ========================================================================== */

(function() {
    const SUPPLIES_DATA_KEY = 'pegasus_supplies_v1';
    const LAST_AUTO_SYNC_KEY = 'pegasus_supplies_last_sync';

    const defaultSupplies = [
        { id: 'yog', label: 'Γιαούρτι', amount: 1000, unit: 'g', portion: 250, refill: 1000, icon: '🥣' },
        { id: 'ban', label: 'Μπανάνες', amount: 5, unit: 'τεμ', portion: 1, refill: 5, icon: '🍌' },
        { id: 'amyg', label: 'Αμύγδαλα', amount: 500, unit: 'g', portion: 30, refill: 500, icon: '🥜' },
        { id: 'honey', label: 'Μέλι', amount: 1000, unit: 'g', portion: 20, refill: 1000, icon: '🍯' },
        { id: 'eggs', label: 'Αυγά', amount: 30, unit: 'τεμ', portion: 3, refill: 30, icon: '🥚' }
    ];

    window.PegasusSupplies = {
        // 🚀 ΑΥΤΟΜΑΤΗ ΑΦΑΙΡΕΣΗ ΒΑΣΕΙ ΗΜΕΡΟΜΗΝΙΑΣ
        checkAndAutomate: function() {
            const now = new Date();
            const todayStr = now.toDateString();
            const lastSync = localStorage.getItem(LAST_AUTO_SYNC_KEY);

            if (lastSync === todayStr) return; // Ήδη ενημερωμένο για σήμερα

            let supplies = JSON.parse(localStorage.getItem(SUPPLIES_DATA_KEY)) || defaultSupplies;

            let daysDiff = 1;
            if (lastSync) {
                const lastDate = new Date(lastSync);
                const timeDiff = now.getTime() - lastDate.getTime();
                daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
            }

            if (daysDiff > 0) {
                console.log(`⚡ PEGASUS AUTO-INVENTORY: Αφαίρεση αποθεμάτων για ${daysDiff} ημέρες.`);
                supplies = supplies.map(item => {
                    const totalConsumption = item.portion * daysDiff;
                    return {
                        ...item,
                        amount: Math.max(0, item.amount - totalConsumption)
                    };
                });

                localStorage.setItem(LAST_AUTO_SYNC_KEY, todayStr);
                this.saveAndRender(supplies);
            }
        },

        updateAmount: function(id, type) {
            let supplies = JSON.parse(localStorage.getItem(SUPPLIES_DATA_KEY)) || defaultSupplies;
            const idx = supplies.findIndex(i => i.id === id);
            if (idx === -1) return;

            if (type === 'consume') {
                supplies[idx].amount = Math.max(0, supplies[idx].amount - supplies[idx].portion);
            } else if (type === 'refill') {
                supplies[idx].amount += supplies[idx].refill;
            }

            this.saveAndRender(supplies);
        },

        setManualAmount: function(id) {
            let supplies = JSON.parse(localStorage.getItem(SUPPLIES_DATA_KEY)) || defaultSupplies;
            const idx = supplies.findIndex(i => i.id === id);

            const newVal = prompt(`Ενημέρωση αποθέματος για: ${supplies[idx].label} (${supplies[idx].unit})`, supplies[idx].amount);

            if (newVal !== null && !isNaN(newVal) && newVal.trim() !== '') {
                supplies[idx].amount = parseFloat(newVal);
                this.saveAndRender(supplies);
            }
        },

        deleteItem: function(id) {
            if(confirm('Διαγραφή αυτού του προϊόντος από τη βάση;')) {
                let supplies = JSON.parse(localStorage.getItem(SUPPLIES_DATA_KEY)) || defaultSupplies;
                supplies = supplies.filter(i => i.id !== id);
                this.saveAndRender(supplies);
            }
        },

        toggleAddForm: function() {
            const form = document.getElementById('addSupplyForm');
            const btn = document.getElementById('btnAddSupply');
            if(form.style.display === 'none') {
                form.style.display = 'block';
                btn.innerHTML = 'Χ Κλείσιμο';
                btn.style.background = '#ff4444';
            } else {
                form.style.display = 'none';
                btn.innerHTML = '+ Νέο προϊόν';
                btn.style.background = 'var(--main)';
            }
        },

        addNewItem: function() {
            const icon = document.getElementById('newIcon').value || '📦';
            const label = document.getElementById('newLabel').value;
            const unit = document.getElementById('newUnit').value || 'τεμ';
            const refill = parseFloat(document.getElementById('newRefill').value);
            const portion = parseFloat(document.getElementById('newPortion').value);

            if(!label || isNaN(refill) || isNaN(portion)) {
                alert('Παρακαλώ συμπληρώστε Όνομα, Σύνολο Αγοράς και Δόση Κατανάλωσης.');
                return;
            }

            let supplies = JSON.parse(localStorage.getItem(SUPPLIES_DATA_KEY)) || defaultSupplies;

            const newItem = {
                id: 'sup_' + Date.now(),
                label: label,
                amount: refill,
                unit: unit,
                portion: portion,
                refill: refill,
                icon: icon
            };

            supplies.push(newItem);
            this.saveAndRender(supplies);

            document.getElementById('newIcon').value = '';
            document.getElementById('newLabel').value = '';
            document.getElementById('newUnit').value = '';
            document.getElementById('newRefill').value = '';
            document.getElementById('newPortion').value = '';
            this.toggleAddForm();
        },

        saveAndRender: function(data) {
            localStorage.setItem(SUPPLIES_DATA_KEY, JSON.stringify(data));
            if (typeof window.renderSuppliesContent === 'function') window.renderSuppliesContent();
            if (window.PegasusCloud && typeof window.PegasusCloud.push === 'function') {
                window.PegasusCloud.push();
            }
        }
    };

    function injectViewLayer() {
        if (document.getElementById('supplies')) return;
        const viewDiv = document.createElement('div');
        viewDiv.id = 'supplies';
        viewDiv.className = 'view';

        viewDiv.innerHTML = `
            <button class="btn-back" onclick="openView('home')">◀ Επιστροφή</button>
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
                <button id="btnAddSupply" class="primary-btn" style="width: auto; margin: 0 auto; padding: 7px 14px; font-size: 10px; border-radius: 8px;" onclick="window.PegasusSupplies.toggleAddForm()">
                    + Νέο προϊόν
                </button>
            </div>

            <div id="addSupplyForm" class="mini-card" style="display: none; border-color: var(--main); margin-bottom: 20px; padding: 15px;">
                <div style="font-size: 11px; font-weight: 900; color: var(--main); margin-bottom: 10px; text-align: center;">ΔΗΜΙΟΥΡΓΙΑ ΝΕΟΥ ΑΠΟΘΕΜΑΤΟΣ</div>
                <div class="compact-grid" style="margin-bottom: 10px;">
                    <input type="text" id="newIcon" placeholder="Εικονίδιο (π.χ. 🥛)" maxlength="2">
                    <input type="text" id="newLabel" placeholder="Όνομα (π.χ. Γάλα)">
                </div>
                <div class="compact-grid" style="margin-bottom: 10px;">
                    <input type="number" id="newRefill" placeholder="Σύνολο Αγοράς (π.χ. 1000)" inputmode="decimal">
                    <input type="text" id="newUnit" placeholder="Μονάδα (π.χ. ml, g, τεμ)">
                </div>
                <input type="number" id="newPortion" placeholder="Αφαίρεση ανά δόση (π.χ. 250)" inputmode="decimal" style="margin-bottom: 10px;">

                <button class="primary-btn" onclick="window.PegasusSupplies.addNewItem()">Αποθήκευση στη βάση</button>
            </div>

            <div id="supplies-content" style="width: 100%; display: flex; flex-direction: column; gap: 12px; padding-bottom: 80px;"></div>
        `;
        document.body.appendChild(viewDiv);
    }

    window.renderSuppliesContent = function() {
        const container = document.getElementById('supplies-content');
        if (!container) return;

        const supplies = JSON.parse(localStorage.getItem(SUPPLIES_DATA_KEY)) || defaultSupplies;

        container.innerHTML = supplies.map(item => {
            const pct = (item.amount / item.refill) * 100;
            const statusColor = pct < 15 ? '#ff4444' : (pct < 40 ? '#ffbb33' : '#00ff41');

            return `
                <div class="mini-card" style="border-left: 4px solid ${statusColor}; padding: 15px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: 900; font-size: 16px; color: #fff;">${item.icon} ${item.label}</div>
                            <div style="font-size: 11px; color: #555; font-weight: 800;">
                                ΣΥΝΟΛΟ: <span style="color:${statusColor}">${item.amount}${item.unit}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="window.PegasusSupplies.setManualAmount('${item.id}')"
                                    style="background: rgba(255,255,255,0.05); border: 1px solid #333; color: #777; border-radius: 8px; padding: 5px 8px; font-size: 12px; cursor: pointer;">
                                ⚙️
                            </button>
                            <button onclick="window.PegasusSupplies.deleteItem('${item.id}')"
                                    style="background: rgba(255,68,68,0.1); border: 1px solid #ff4444; color: #ff4444; border-radius: 8px; padding: 5px 8px; font-size: 12px; cursor: pointer;">
                                🗑️
                            </button>
                        </div>
                    </div>

                    <div class="bar-bg" style="height: 4px; margin-bottom: 12px;">
                        <div class="bar-fill" style="width: ${Math.min(pct, 100)}%; background: ${statusColor};"></div>
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button class="secondary-btn" style="flex: 2; padding: 10px; font-size: 10px; border-color: #222;"
                                onclick="window.PegasusSupplies.updateAmount('${item.id}', 'consume')">
                            -${item.portion}${item.unit}
                        </button>
                        <button class="primary-btn" style="flex: 1; padding: 10px; font-size: 10px;"
                                onclick="window.PegasusSupplies.updateAmount('${item.id}', 'refill')">
                            +${item.refill}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    document.addEventListener("DOMContentLoaded", () => {
        injectViewLayer();
        window.PegasusSupplies.checkAndAutomate();
        window.renderSuppliesContent();
        if (window.registerPegasusModule) {
            window.registerPegasusModule({ id: 'supplies', label: 'Αποθέματα', icon: '📦' });
        }
    });
})();
