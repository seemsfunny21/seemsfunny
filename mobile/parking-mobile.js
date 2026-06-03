/* ===== PEGASUS PARKING TRACKER MODULE v2.2.296 (Manual Parking + Recent Date) ===== */
window.PegasusParking = {
    _escape: function(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    _formatStamp: function(date = new Date()) {
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) return '';
        const day = d.toLocaleDateString('el-GR', { weekday: 'long' });
        const full = d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const time = d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
        return `${day} ${full}, ${time}`;
    },

    _asEntry: function(value) {
        if (value == null) return null;
        if (typeof value === 'string' || typeof value === 'number') {
            const loc = String(value).trim();
            return loc ? { loc, ts: '' } : null;
        }
        if (typeof value === 'object') {
            const loc = String(value.loc || value.label || value.name || '').trim();
            if (!loc) return null;
            return {
                loc,
                ts: String(value.ts || value.addedAtText || value.dateText || '').trim(),
                addedAt: value.addedAt || value.updatedAt || null
            };
        }
        const loc = String(value).trim();
        return loc ? { loc, ts: '' } : null;
    },

    _readCurrent: function() {
        const rawData = localStorage.getItem('pegasus_parking_loc');
        if (!rawData) return null;
        if (rawData === '[object Object]') {
            localStorage.removeItem('pegasus_parking_loc');
            return null;
        }
        try {
            return this._asEntry(JSON.parse(rawData));
        } catch (_) {
            return this._asEntry(rawData);
        }
    },

    _writeCurrent: function(entry) {
        localStorage.setItem('pegasus_parking_loc', JSON.stringify(entry));
    },

    _readHistory: function() {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('pegasus_parking_history')) || [];
        } catch(e) { history = []; }

        const seen = new Set();
        return history
            .map(item => this._asEntry(item))
            .filter(Boolean)
            .filter(entry => {
                const key = entry.loc.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 10);
    },

    save: async function(locationOverride = null) {
        const inputEl = document.getElementById('parkingInput');
        const location = String(locationOverride || (inputEl ? inputEl.value : '') || '').trim();
        if (!location) return;

        const entry = {
            loc: location,
            ts: this._formatStamp(new Date()),
            addedAt: new Date().toISOString()
        };
        this._writeCurrent(entry);

        let history = this._readHistory();
        history = history.filter(item => item.loc.toLowerCase() !== location.toLowerCase());
        history.unshift(entry);
        if (history.length > 10) history = history.slice(0, 10);
        localStorage.setItem('pegasus_parking_history', JSON.stringify(history));

        this.updateUI();

        if (window.PegasusCloud && window.PegasusCloud.push) {
            if (typeof setSyncStatus === 'function') setSyncStatus('Αποστολή...');
            try { await window.PegasusCloud.push(); } catch (e) { console.warn('Parking cloud push failed:', e); }
            if (typeof setSyncStatus === 'function') setSyncStatus('online');
        }

        if (inputEl) inputEl.value = '';
        if (typeof openView === 'function') openView('home');
    },

    selectRecent: function(location) {
        const loc = String(location || '').trim();
        if (!loc) return;
        this.save(loc);
    },

    updateUI: function() {
        const current = this._readCurrent();
        const locToDisplay = current?.loc || '--';
        const dateText = current?.ts || '';

        const statusEl = document.getElementById('parkingStatus');
        if (statusEl) {
            statusEl.textContent = `Πάρκινγκ: ${locToDisplay}`;
        }

        const currentEl = document.getElementById('parkingCurrentInfo');
        if (currentEl) {
            currentEl.innerHTML = `
                <div style="font-size:13px; font-weight:900; color:#fff;">📍 ${this._escape(locToDisplay)}</div>
                ${dateText ? `<div style="font-size:10px; color:#aaa; margin-top:4px;">Τελευταία προσθήκη: ${this._escape(dateText)}</div>` : ''}
            `;
        }

        this.renderHistory();
    },

    renderHistory: function() {
        const history = this._readHistory();
        const container = document.getElementById('parkingHistoryList');
        if (!container) return;

        localStorage.setItem('pegasus_parking_history', JSON.stringify(history));

        container.innerHTML = history.map(entry => {
            const loc = this._escape(entry.loc);
            const ts = this._escape(entry.ts || '');
            return `
                <div class="log-item" data-parking-loc="${loc}" onclick="window.PegasusParking.selectRecent(this.dataset.parkingLoc || '');" style="cursor:pointer; border-color:rgba(255, 152, 0, 0.4); margin-bottom:8px; width:100%; box-sizing:border-box;">
                    <div style="font-size:13px; font-weight:800; color:#fff;">📍 ${loc}</div>
                    ${ts ? `<div style="font-size:10px; color:#aaa; margin-top:4px;">${ts}</div>` : ''}
                </div>
            `;
        }).join('');
    }
};

/* === PEGASUS SYNC ALIGNMENT === */
window.addEventListener('pegasus_sync_complete', () => {
    console.log('📍 Parking: Cloud Sync Complete. Refreshing UI...');
    window.PegasusParking.updateUI();
});

document.addEventListener('DOMContentLoaded', () => {
    window.PegasusParking.updateUI();
    setTimeout(() => window.PegasusParking.updateUI(), 2000);
});
