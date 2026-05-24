/* ==========================================================================
   PEGASUS OS - VEHICLE MODULE (v15.4 - QUIET SAVE + CLEAN SERVICE TEXT)
   Protocol: Strict Manifest Governance, Legacy Bridging & Date Safe Format
   ========================================================================== */

const CAR_M = window.PegasusManifest || { car: { identity: "pegasus_car_identity", dates: "pegasus_car_dates", service: "pegasus_car_service", legacySpecs: "pegasus_car_specs", legacyService: "peg_car_service", legacyDates: "peg_car_dates" }};

window.PegasusCar = {
    saveSpecs: async function() {
        console.log("🚗 CAR: Initiating Save Protocol...");

        const identity = {
            plate: document.getElementById('carPlate')?.value || "",
            model: document.getElementById('carModel')?.value || "",
            vin: document.getElementById('carVin')?.value || "",
            eng: document.getElementById('carEngine')?.value || "",
            pwr: document.getElementById('carPower')?.value || ""
        };

        const dates = {
            ins: document.getElementById('carIns')?.value || "",
            kteo: document.getElementById('carKteo')?.value || "",
            srv: document.getElementById('carSrv')?.value || ""
        };

        localStorage.setItem(CAR_M.car.identity, JSON.stringify(identity));
        localStorage.setItem(CAR_M.car.dates, JSON.stringify(dates));
        localStorage.setItem(CAR_M.car.legacySpecs, JSON.stringify(identity));

        document.querySelectorAll('#car input').forEach(el => el.setAttribute('readonly', true));

        console.log("🔒 CAR: Vehicle data saved locally only. No cloud sync.");

        this.load();
        this.setBackupStatus("✅ Τα στοιχεία οχήματος αποθηκεύτηκαν.", "ok");
    },



    safeParseKey: function(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            console.warn("⚠️ CAR: Corrupted storage", key, e);
            return fallback;
        }
    },

    setBackupStatus: function(message, tone = "info") {
        const el = document.getElementById("carBackupStatus");
        if (!el) return;
        el.style.color = tone === "ok" ? "var(--main)" : (tone === "error" ? "#ff4444" : "#777");
        el.textContent = message || "";
        if (message) setTimeout(() => {
            if (el.textContent === message) el.textContent = "";
        }, 4500);
    },

    makeBackupFilename: function() {
        const d = new Date();
        const pad = n => String(n).padStart(2, "0");
        return `pegasus-vehicle-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    },

    downloadJSON: function(filename, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    },

    backupLocal: function() {
        const identity = this.safeParseKey(CAR_M.car.identity, {}) || this.safeParseKey(CAR_M.car.legacySpecs, {}) || {};
        const dates = this.safeParseKey(CAR_M.car.dates, {}) || this.safeParseKey(CAR_M.car.legacyDates, {}) || {};
        const service = this.safeParseKey(CAR_M.car.service, []) || this.safeParseKey(CAR_M.car.legacyService, []) || [];

        const payload = {
            type: "pegasus-vehicle-local-backup-v1",
            module: "car",
            createdAt: new Date().toISOString(),
            storage: {
                [CAR_M.car.identity]: identity,
                [CAR_M.car.dates]: dates,
                [CAR_M.car.service]: Array.isArray(service) ? service : []
            }
        };

        this.downloadJSON(this.makeBackupFilename(), payload);
        this.setBackupStatus("✅ Αντίγραφο οχήματος έτοιμο.", "ok");
        console.log("💾 PEGASUS CAR LOCAL COPY:", payload);
    },

    restoreLocal: function() {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.style.display = "none";

        input.addEventListener("change", async () => {
            const file = input.files && input.files[0];
            input.remove();
            if (!file) return;

            try {
                const text = await file.text();
                const payload = JSON.parse(text);
                const storage = payload?.storage || payload || {};

                const identity = storage[CAR_M.car.identity] || storage.pegasus_car_identity || storage.pegasus_car_specs || payload.identity || null;
                const dates = storage[CAR_M.car.dates] || storage.pegasus_car_dates || storage.peg_car_dates || payload.dates || null;
                const service = storage[CAR_M.car.service] || storage.pegasus_car_service || storage.peg_car_service || payload.service || [];

                if ((!identity || typeof identity !== "object") && (!dates || typeof dates !== "object") && !Array.isArray(service)) {
                    throw new Error("Το αρχείο δεν έχει έγκυρα στοιχεία οχήματος Pegasus.");
                }

                const cleanIdentity = {
                    plate: String(identity?.plate || ""),
                    model: String(identity?.model || ""),
                    vin: String(identity?.vin || ""),
                    eng: String(identity?.eng || ""),
                    pwr: String(identity?.pwr || "")
                };

                const cleanDates = {
                    ins: String(dates?.ins || ""),
                    kteo: String(dates?.kteo || ""),
                    srv: String(dates?.srv || "")
                };

                const cleanService = Array.isArray(service) ? service.map(item => ({
                    t: String(item?.t || item?.task || ""),
                    k: String(item?.k || item?.km || ""),
                    d: String(item?.d || item?.date || "")
                })).filter(item => item.t || item.k || item.d) : [];

                localStorage.setItem(CAR_M.car.identity, JSON.stringify(cleanIdentity));
                localStorage.setItem(CAR_M.car.dates, JSON.stringify(cleanDates));
                localStorage.setItem(CAR_M.car.legacySpecs, JSON.stringify(cleanIdentity));
                localStorage.setItem(CAR_M.car.legacyDates, JSON.stringify(cleanDates));
                localStorage.setItem(CAR_M.car.service, JSON.stringify(cleanService));
                localStorage.setItem(CAR_M.car.legacyService, JSON.stringify(cleanService));

                this.load();
                document.querySelectorAll('#car input').forEach(el => {
                    el.setAttribute('readonly', true);
                    el.style.border = "";
                });
                this.setBackupStatus("✅ Επαναφορά οχήματος ολοκληρώθηκε τοπικά.", "ok");
                console.log("♻️ PEGASUS CAR RESTORE OK:", { identity: cleanIdentity, dates: cleanDates, service: cleanService });
            } catch (e) {
                console.warn("❌ PEGASUS CAR RESTORE FAILED:", e);
                this.setBackupStatus("❌ Λάθος αρχείο αντιγράφου οχήματος.", "error");
            }
        });

        document.body.appendChild(input);
        input.click();
    },

    load: function() {
        const identity = JSON.parse(localStorage.getItem(CAR_M.car.identity)) ||
                         JSON.parse(localStorage.getItem(CAR_M.car.legacySpecs)) || {};

        const dates = JSON.parse(localStorage.getItem(CAR_M.car.dates)) ||
                      JSON.parse(localStorage.getItem(CAR_M.car.legacyDates)) || {};

        const fields = {
            'carPlate': identity.plate, 'carModel': identity.model,
            'carVin': identity.vin, 'carEngine': identity.eng,
            'carPower': identity.pwr, 'carIns': dates.ins,
            'carKteo': dates.kteo, 'carSrv': dates.srv
        };

        for (let id in fields) {
            const el = document.getElementById(id);
            if (el) el.value = fields[id] || "";
        }
        this.renderServiceLog();
    },

    addService: async function() {
        const t = document.getElementById('srvTask')?.value;
        const k = document.getElementById('srvKm')?.value;
        if (!t || !k) return;

        let logs = JSON.parse(localStorage.getItem(CAR_M.car.service)) || [];

        // 🛡️ DATE FORMAT FIX: Αποφυγή el-GR format trap
        const rawDate = new Date();
        const dateStrSafe = `${rawDate.getDate()}/${rawDate.getMonth() + 1}/${rawDate.getFullYear()}`;

        logs.unshift({ t: String(t).trim(), k: k.toLocaleString('el-GR'), d: dateStrSafe });

        localStorage.setItem(CAR_M.car.service, JSON.stringify(logs));

        if(document.getElementById('srvTask')) document.getElementById('srvTask').value = "";
        if(document.getElementById('srvKm')) document.getElementById('srvKm').value = "";

        this.renderServiceLog();
        console.log("🔒 CAR: Service log saved locally only. No cloud sync.");
    },

    renderServiceLog: function() {
        let logs = JSON.parse(localStorage.getItem(CAR_M.car.service));

        if (!logs || logs.length === 0) {
            logs = JSON.parse(localStorage.getItem(CAR_M.car.legacyService)) || [];
            if (logs.length > 0) localStorage.setItem(CAR_M.car.service, JSON.stringify(logs));
        }

        const container = document.getElementById("serviceLogList");
        if (!container) return;

        if (logs.length === 0) {
            container.innerHTML = `<div style="color:#555; font-size:12px; margin-top:10px;">Δεν υπάρχει καταγεγραμμένο ιστορικό.</div>`;
            return;
        }

        container.innerHTML = logs.map((i, idx) => `
            <div class="log-item" style="border-left: 4px solid var(--main); margin-bottom: 10px; padding: 12px; background: rgba(255,255,255,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="font-weight:900; font-size:13px; color:#fff; text-align:left; flex:1;">${i.t}</div>
                    <button onclick="window.PegasusCar.deleteLog(${idx})" style="background:none; border:none; color:var(--danger); font-weight:bold; padding: 0 5px;">✕</button>
                </div>
                <div style="font-size:11px; color:var(--main); font-weight:800; margin-top:5px; text-align:left;">
                    📍 ${i.k} KM | 📅 ${i.d}
                </div>
            </div>
        `).join('');
    },

    deleteLog: async function(idx) {
        if(!confirm("Οριστική διαγραφή αυτής της εργασίας;")) return;
        let logs = JSON.parse(localStorage.getItem(CAR_M.car.service)) || [];
        logs.splice(idx, 1);
        localStorage.setItem(CAR_M.car.service, JSON.stringify(logs));

        this.renderServiceLog();
        console.log("🔒 CAR: Service log deleted locally only. No cloud sync.");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.PegasusCar.load(), 1500);
});

if (typeof window.registerPegasusModule === "function") {
    window.registerPegasusModule({ id: 'car', icon: '🚗', label: 'Όχημα' });
}
