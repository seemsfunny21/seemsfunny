/* ==========================================================================
   PEGASUS GALLERY ENGINE - INDEXEDDB EDITION (v5.2 GLOBAL SYNC)
   Protocol: Strict Data Analyst - IndexedDB Promise Wrapper & Date Padding
   Status: FINAL STABLE | FIXED: PROMISE RESOLUTION & CLOUD DELETE SYNC
   ========================================================================== */

window.GalleryEngine = {
    dbName: "PegasusLevels",
    dbVersion: 1,
    db: null,
    selectedPhotos: [],

    async init() {
        const request = indexedDB.open(this.dbName, this.dbVersion);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("photos")) {
                db.createObjectStore("photos", { keyPath: "id" });
            }
        };
        request.onsuccess = (e) => {
            this.db = e.target.result;
            console.log("📸 PEGASUS: Gallery Engine (IndexedDB) Online.");
            this.setupUI();
        };
        request.onerror = (e) => {
            console.error("❌ PEGASUS: Gallery Database Error", e);
        };
    },

    setupUI() {
        const btnOpen = document.getElementById('btnOpenGallery');
        if (btnOpen) {
            btnOpen.onclick = (e) => {
                if(e) e.stopPropagation();
                const tools = document.getElementById('toolsPanel');
                if (tools) tools.style.display = 'none';
                const gp = document.getElementById('galleryPanel');
                if (gp) {
                    gp.style.display = 'block';
                    this.render();
                }
            };
        }
    },

    async handleUpload(event) {
        const file = event.target.files[0];
        if (!file || !this.db) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            // 🎯 FIXED: Unified Date Padding Protocol
            const now = new Date();
            const d = String(now.getDate()).padStart(2, '0');
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const dateStr = `${d}/${m}/${now.getFullYear()}`;

            // 🎯 FIXED: Proper Promise wrapper for IndexedDB operations
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction("photos", "readwrite");
                const store = tx.objectStore("photos");
                const request = store.add({
                    id: Date.now(),
                    date: dateStr,
                    src: e.target.result // Base64
                });

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            this.render();

            // Αυτόματο Push στο Cloud μετά το upload
            if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") {
                window.PegasusCloud.push(true);
            }
        };
        reader.readAsDataURL(file);
    },

    async render() {
        const container = document.getElementById('progressTimeline');
        if (!container || !this.db) return;

        const photos = await new Promise((resolve) => {
            const tx = this.db.transaction("photos", "readonly");
            const store = tx.objectStore("photos");
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result.reverse());
            req.onerror = () => resolve([]); // Ασφαλής επιστροφή κενού πίνακα σε σφάλμα
        });

        if (photos.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; opacity:0.5;">Καμία φωτογραφία προόδου.</p>`;
            return;
        }

        // 🎯 FIXED: Προσθήκη "window." στις inline κλήσεις (Scope Shielding)
        container.innerHTML = `
            <div id="comparisonZone" style="display:none; margin-bottom:20px; padding:10px; background:#1a1a1a; border-radius:8px; border:1px solid #4CAF50;">
                <h4 style="margin:0 0 10px 0; font-size:12px; color:#4CAF50; text-align:center; letter-spacing:1px;">ΣΥΓΚΡΙΣΗ PROGRESS</h4>
                <div id="comparisonFlex" style="display:flex; gap:5px;"></div>
                <button onclick="window.GalleryEngine.clearComparison()" style="width:100%; margin-top:10px; background:none; border:1px solid #555; color:#aaa; cursor:pointer; font-size:10px; padding:8px; border-radius:4px; transition: 0.2s;">ΑΚΥΡΩΣΗ ΣΥΓΚΡΙΣΗΣ</button>
            </div>
            <div class="photos-grid" style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                ${photos.map(p => `
                    <div class="timeline-item" style="border-left: 2px solid #4CAF50; padding-left: 15px; margin-bottom: 25px; position:relative; background: #111; padding: 10px; border-radius: 0 8px 8px 0;">
                        <div style="font-size:12px; color:#4CAF50; font-weight:bold; margin-bottom:8px; letter-spacing:1px;">📅 ${p.date}</div>
                        <img src="${p.src}" style="width:100%; border-radius:8px; cursor:pointer; border: 1px solid #333;" onclick="window.GalleryEngine.selectForComparison('${p.src}', '${p.date}')">
                        <button onclick="window.GalleryEngine.delete(${p.id})" style="position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.8); border:1px solid #ff4444; color:#ff4444; cursor:pointer; font-weight:bold; padding:5px; border-radius:5px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; transition:0.2s;">✕</button>
                    </div>
                `).join('')}
            </div>
        `;
    },

    selectForComparison(src, date) {
        if (this.selectedPhotos.length < 2) {
            this.selectedPhotos.push({ src, date });
            this.updateComparisonUI();
        } else {
            alert("PEGASUS STRICT: Μπορείς να συγκρίνεις μόνο 2 φωτογραφίες τη φορά.");
        }
    },

    updateComparisonUI() {
        const zone = document.getElementById('comparisonZone');
        const flex = document.getElementById('comparisonFlex');
        if (!zone || !flex) return;

        zone.style.display = 'block';

        let html = '';
        this.selectedPhotos.forEach((p, i) => {
            const label = i === 0 ? 'BEFORE' : 'AFTER';
            const color = i === 0 ? '#aaa' : '#4CAF50';
            html += `
                <div style="flex:1; text-align:center;">
                    <div style="font-size:11px; font-weight:bold; letter-spacing:1px; margin-bottom:5px; color:${color}">${label}</div>
                    <img src="${p.src}" style="width:100%; height:200px; object-fit:cover; border:1px solid ${color}; border-radius:6px;">
                    <div style="font-size:9px; color:#666; margin-top:4px;">${p.date}</div>
                </div>
            `;
        });
        flex.innerHTML = html;
    },

    clearComparison() {
        this.selectedPhotos = [];
        this.render();
    },

    async delete(id) {
        if (!confirm("🚨 Επιβεβαίωση: Οριστική διαγραφή φωτογραφίας;")) return;

        // 🎯 FIXED: Proper Promise wrapper for IndexedDB Delete
        await new Promise((resolve, reject) => {
            const tx = this.db.transaction("photos", "readwrite");
            const request = tx.objectStore("photos").delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        this.render();

        // 🎯 FIXED: Missing Cloud Sync on Delete (Anti-Zombie Protocol)
        if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") {
            window.PegasusCloud.push(true);
        }
    }
};

// Global Handlers
window.handlePhotoUpload = (e) => window.GalleryEngine.handleUpload(e);

document.addEventListener('DOMContentLoaded', () => {
    window.GalleryEngine.init();
});
