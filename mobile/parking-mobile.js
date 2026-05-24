/* ===== PEGASUS PARKING TRACKER MODULE v2.1.283 (Original Manual Text Version Restored) ===== */
window.PegasusParking = {
    _escape: function(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    _asText: function(value) {
        if (value == null) return "";
        if (typeof value === "string") return value.trim();
        if (typeof value === "number") return String(value);
        if (typeof value === "object") {
            const lat = Number(value.lat);
            const lon = Number(value.lon);
            return String(
                value.loc ||
                value.addressLabel ||
                value.streetLabel ||
                value.label ||
                value.name ||
                ((Number.isFinite(lat) && Number.isFinite(lon)) ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : "")
            ).trim();
        }
        return String(value).trim();
    },

    _readHistory: function() {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('pegasus_parking_history')) || [];
        } catch(e) { history = []; }

        const seen = new Set();
        return history
            .map(item => this._asText(item))
            .filter(Boolean)
            .filter(item => {
                const key = item.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 10);
    },

    save: async function() {
        const inputEl = document.getElementById('parkingInput');
        const location = inputEl ? inputEl.value.trim() : "";
        if (!location) return;

        // 1. Αποθήκευση ως JSON Object, όπως στην αρχική μορφή του Parking.
        const parkingData = {
            loc: location,
            ts: new Date().toLocaleString('el-GR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
        };
        localStorage.setItem('pegasus_parking_loc', JSON.stringify(parkingData));

        // 2. Ενημέρωση Ιστορικού (10 Θέσεις)
        let history = this._readHistory();
        history = history.filter(item => item.toLowerCase() !== location.toLowerCase());
        history.unshift(location);
        if (history.length > 10) history = history.slice(0, 10);
        localStorage.setItem('pegasus_parking_history', JSON.stringify(history));

        this.updateUI();

        // 3. Force Cloud Push, όπως στην αρχική μορφή.
        if (window.PegasusCloud && window.PegasusCloud.push) {
            if (typeof setSyncStatus === "function") setSyncStatus('Αποστολή...');
            try { await window.PegasusCloud.push(); } catch (e) { console.warn('Parking cloud push failed:', e); }
            if (typeof setSyncStatus === "function") setSyncStatus('online');
        }

        if (inputEl) inputEl.value = "";
        if (typeof openView === "function") openView('home');
    },

    updateUI: function() {
        let locToDisplay = "--";
        const rawData = localStorage.getItem('pegasus_parking_loc');

        if (rawData) {
            if (rawData === "[object Object]") {
                console.warn("Parking UI: Detected corrupted [object Object]. Resetting.");
                localStorage.removeItem('pegasus_parking_loc');
            } else {
                try {
                    const parsed = JSON.parse(rawData);
                    locToDisplay = this._asText(parsed) || "--";
                } catch(e) {
                    locToDisplay = this._asText(rawData) || "--";
                }
            }
        }

        const statusEl = document.getElementById('parkingStatus');
        if (statusEl) {
            statusEl.textContent = `Πάρκινγκ: ${locToDisplay}`;
        }

        this.renderHistory();
    },

    renderHistory: function() {
        const history = this._readHistory();
        const container = document.getElementById('parkingHistoryList');
        if (!container) return;

        localStorage.setItem('pegasus_parking_history', JSON.stringify(history));

        container.innerHTML = history.map(loc => {
            const escaped = this._escape(loc);
            return `
                <div class="log-item" data-parking-loc="${escaped}" onclick="document.getElementById('parkingInput').value=this.dataset.parkingLoc || ''; window.PegasusParking.save();" style="cursor:pointer; border-color:rgba(255, 152, 0, 0.4); margin-bottom:8px;">
                    <div style="font-size:13px; font-weight:800; color:#fff;">📍 ${escaped}</div>
                </div>
            `;
        }).join('');
    }
};

/* === PEGASUS SYNC ALIGNMENT === */
window.addEventListener('pegasus_sync_complete', () => {
    console.log("📍 Parking: Cloud Sync Complete. Refreshing UI...");
    window.PegasusParking.updateUI();
});

document.addEventListener('DOMContentLoaded', () => {
    window.PegasusParking.updateUI();
    setTimeout(() => window.PegasusParking.updateUI(), 2000);
});
