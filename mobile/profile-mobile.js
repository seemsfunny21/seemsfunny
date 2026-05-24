/* ==========================================================================
   PEGASUS OS - PROFILE & NOTES MODULE (MOBILE EDITION v14.3 QUIET SAVE + TAXISNET)
   Protocol: Document Recovery & Tactical Notes Integration
   Features: Specs Loading, Auto-Sync, Note Management
   Status: FINAL STABLE | FIXED: NOISY LOGS + SAFE STORAGE + CLEAN UI LOAD
   ========================================================================== */

window.PegasusProfile = {
    _lastSpecsSnapshot: "",

    safeParse: function(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            console.warn(`⚠️ PROFILE: Corrupted storage at ${key}`, e);
            return fallback;
        }
    },

    // 1. Φόρτωση Εγγράφων (ADT, AFM, AMKA κλπ) από το LocalStorage
    load: function(forceLog = false) {
        const specs = this.safeParse('pegasus_user_specs', {}) || {};

        const snapshot = JSON.stringify(specs);
        if (forceLog || this._lastSpecsSnapshot !== snapshot) {
            console.log("👤 PEGASUS PROFILE: Data loaded.");
            this._lastSpecsSnapshot = snapshot;
        }

        const fields = {
            pPA: specs.pa,
            pADT: specs.adt,
            pAFM: specs.afm,
            pAMKA: specs.amka,
            pIban: specs.iban,
            pTaxisnet: specs.taxisnet
        };

        Object.keys(fields).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = fields[id] || "";
        });

        this.renderNotes();
    },

    // 2. Αποθήκευση Προσωπικών Στοιχείων
    saveSpecs: async function() {
        const specs = {
            pa: document.getElementById('pPA')?.value?.trim() || "",
            adt: document.getElementById('pADT')?.value?.trim() || "",
            afm: document.getElementById('pAFM')?.value?.trim() || "",
            amka: document.getElementById('pAMKA')?.value?.trim() || "",
            iban: document.getElementById('pIban')?.value?.trim() || "",
            taxisnet: document.getElementById('pTaxisnet')?.value?.trim() || ""
        };

        localStorage.setItem('pegasus_user_specs', JSON.stringify(specs));
        this._lastSpecsSnapshot = JSON.stringify(specs);

        document.querySelectorAll('#profile input').forEach(el => {
            el.setAttribute('readonly', true);
            el.style.border = "";
        });

        console.log("✅ PROFILE: Specs secured locally.");

        console.log("🔒 PROFILE: Local-only documents saved. No cloud sync.");

        this.setBackupStatus("✅ Τα προσωπικά στοιχεία αποθηκεύτηκαν.", "ok");
    },



    setBackupStatus: function(message, tone = "info") {
        const el = document.getElementById("profileBackupStatus");
        if (!el) return;
        const color = tone === "ok" ? "var(--main)" : (tone === "error" ? "#ff4444" : "#777");
        el.style.color = color;
        el.textContent = message || "";
        if (message) setTimeout(() => {
            if (el.textContent === message) el.textContent = "";
        }, 4500);
    },

    makeBackupFilename: function() {
        const d = new Date();
        const pad = n => String(n).padStart(2, "0");
        return `pegasus-documents-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
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

    backupSpecs: function() {
        const specs = this.safeParse("pegasus_user_specs", {}) || {};
        const payload = {
            type: "pegasus-documents-local-backup-v1",
            module: "profile",
            createdAt: new Date().toISOString(),
            storage: {
                pegasus_user_specs: specs
            }
        };

        this.downloadJSON(this.makeBackupFilename(), payload);
        this.setBackupStatus("✅ Αντίγραφο εγγράφων έτοιμο.", "ok");
        console.log("💾 PEGASUS PROFILE LOCAL COPY:", payload);
    },

    restoreSpecs: function() {
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
                const specs = storage.pegasus_user_specs || payload.pegasus_user_specs || null;

                if (!specs || typeof specs !== "object" || Array.isArray(specs)) {
                    throw new Error("Το αρχείο δεν έχει έγκυρα προσωπικά έγγραφα Pegasus.");
                }

                const clean = {
                    pa: String(specs.pa || ""),
                    adt: String(specs.adt || ""),
                    afm: String(specs.afm || ""),
                    amka: String(specs.amka || ""),
                    iban: String(specs.iban || ""),
                    taxisnet: String(specs.taxisnet || specs.taxis || "")
                };

                localStorage.setItem("pegasus_user_specs", JSON.stringify(clean));
                this._lastSpecsSnapshot = JSON.stringify(clean);
                this.load(true);
                document.querySelectorAll('#profile input').forEach(el => {
                    el.setAttribute('readonly', true);
                    el.style.border = "";
                });
                this.setBackupStatus("✅ Επαναφορά εγγράφων ολοκληρώθηκε τοπικά.", "ok");
                console.log("♻️ PEGASUS PROFILE RESTORE OK:", clean);
            } catch (e) {
                console.warn("❌ PEGASUS PROFILE RESTORE FAILED:", e);
                this.setBackupStatus("❌ Λάθος αρχείο αντιγράφου εγγράφων.", "error");
            }
        });

        document.body.appendChild(input);
        input.click();
    },

    // 3. Προσθήκη Νέας Σημείωσης
    addNote: async function() {
        const dateVal = document.getElementById('nDate')?.value || new Date().toLocaleDateString('el-GR');
        const textInput = document.getElementById('nText');
        const textVal = textInput?.value?.trim() || "";

        if (!textVal) return;

        let list = this.safeParse("pegasus_notes", []) || [];
        list.unshift({ d: dateVal, t: textVal });

        localStorage.setItem("pegasus_notes", JSON.stringify(list));

        if (textInput) textInput.value = "";

        this.renderNotes();

        if (window.PegasusCloud) {
            await window.PegasusCloud.push(true);
        }
    },

    // 4. Διαγραφή Σημείωσης
    deleteNote: async function(idx) {
        if (!confirm("Διαγραφή σημείωσης;")) return;

        let list = this.safeParse("pegasus_notes", []) || [];

        if (idx < 0 || idx >= list.length) return;

        list.splice(idx, 1);
        localStorage.setItem("pegasus_notes", JSON.stringify(list));

        this.renderNotes();

        if (window.PegasusCloud) {
            await window.PegasusCloud.push(true);
        }
    },

    // 5. Rendering του UI των Σημειώσεων
    renderNotes: function() {
        const list = this.safeParse("pegasus_notes", []) || [];
        const container = document.getElementById("notesList");
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = `<div style="color:#555; font-size:12px; margin-top:10px;">Δεν υπάρχουν σημειώσεις.</div>`;
            return;
        }

        container.innerHTML = list.map((i, idx) => `
            <div class="log-item" style="border-left: 4px solid var(--main); margin-bottom: 12px; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                    <span style="font-size:11px; color:var(--main); font-weight:900; letter-spacing:1px;">📅 ${i.d || "-"}</span>
                    <button onclick="window.PegasusProfile.deleteNote(${idx})" style="background:none; border:none; color:var(--danger, #ff4444); font-size:16px; font-weight:bold; cursor:pointer;">✕</button>
                </div>
                <div style="font-size:15px; color:#fff; line-height:1.5; text-align:left;">${i.t || ""}</div>
            </div>
        `).join('');
    }
};
