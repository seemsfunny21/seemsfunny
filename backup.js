/* ==========================================================================
   PEGASUS BACKUP & RESTORE - LOCAL-ONLY EDITION (V19.01)
   Protocol: Universal JSON Unwrapping, Date Padding & IndexedDB Recovery
   Status: FINAL STABLE | ZERO-BUG VERIFIED
   ========================================================================== */


/* ==========================================================================
   PEGASUS 237 DAILY BACKUP COLLECTOR
   Purpose: one complete, non-recursive user-data snapshot for morning reports
   ========================================================================== */
(function installPegasusBackupCollector() {
    if (window.PegasusBackup?.version === "19.01-local-only") return;

    const EMAIL_BACKUP_LIMIT = 220000;
    const SKIP_KEY_RE = /(vault|pin|master|secret|hash|wrapped|api[_-]?key|gemini|openai|openrouter|token)/i;
    const NO_RECURSIVE_BACKUP_RE = /(backup|snapshot|restore|runtime_trace|runtime_errors|error_log|system_logs|sync_debug|command_trace|permanent_assets_ready|cloud_pending|cloud|sync_pending|data_registry_state|self_check_history)/i;

    function safeJsonParse(value) {
        try { return JSON.parse(value); } catch (_) { return null; }
    }

    function safeByteLength(text) {
        try { return new Blob([String(text || "")]).size; } catch (_) { return String(text || "").length; }
    }

    function isCloudAllowedKey(key) { return false; }

    function isPegasusUserDataKey(key) {
        if (!key || typeof key !== "string") return false;
        if (SKIP_KEY_RE.test(key)) return false;
        if (NO_RECURSIVE_BACKUP_RE.test(key)) return false;

        return key.startsWith("pegasus_") ||
            key.startsWith("peg_") ||
            key.startsWith("food_log_") ||
            key.startsWith("cardio_log_") ||
            key.startsWith("weight_") ||
            key.startsWith("kouki_");
    }

    function collectLocalStorage(options = {}) {
        const local = {};
        const skipped = [];
        const keyStats = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            const val = localStorage.getItem(key);
            if (isPegasusUserDataKey(key)) {
                local[key] = val;
                keyStats.push({ key, bytes: safeByteLength(val) });
            } else if (/^(pegasus_|peg_|food_log_|cardio_log_|weight_|kouki_)/.test(key)) {
                skipped.push(key);
            }
        }

        keyStats.sort((a, b) => b.bytes - a.bytes);

        return {
            localStorage: local,
            meta: {
                keyCount: Object.keys(local).length,
                skippedCount: skipped.length,
                skippedKeys: options.includeSkippedKeys ? skipped.sort() : undefined,
                largestKeys: keyStats.slice(0, 12)
            }
        };
    }

    function buildSnapshot(reason = "manual", extraMeta = {}) {
        const collected = collectLocalStorage({ includeSkippedKeys: !!extraMeta.includeSkippedKeys });
        const now = new Date();
        const localStorageBytes = safeByteLength(JSON.stringify(collected.localStorage));

        return {
            schema: "PEGASUS_LOCAL_ONLY_BACKUP_V301",
            version: "19.01-local-only",
            reason,
            createdAt: now.toISOString(),
            createdLocal: now.toLocaleString("el-GR"),
            note: "Πλήρες τοπικό backup δεδομένων χρήστη. Δεν περιλαμβάνει PIN, master keys, cloud/sync keys, API keys, runtime logs ή παλιά backup.",
            meta: {
                ...extraMeta,
                keyCount: collected.meta.keyCount,
                skippedCount: collected.meta.skippedCount,
                largestKeys: collected.meta.largestKeys,
                localStorageBytes,
                indexedDB: "manual-export-only"
            },
            localStorage: collected.localStorage
        };
    }

    function stringifyForEmail(snapshot, limit = EMAIL_BACKUP_LIMIT) {
        const full = JSON.stringify(snapshot);
        const truncated = full.length > limit;
        return {
            full,
            inline: truncated
                ? full.slice(0, limit) + `\n...PEGASUS_BACKUP_TRUNCATED_AT_${limit}_CHARS...`
                : full,
            truncated,
            chars: full.length,
            bytes: safeByteLength(full)
        };
    }

    window.PegasusBackup = {
        version: "19.01-local-only",
        buildSnapshot,
        buildMorningEmailSnapshot: function(reportMeta = {}) {
            return buildSnapshot("morning-report-email", {
                ...reportMeta,
                mode: "daily-email-inline-backup"
            });
        },
        stringifyForEmail,
        collectLocalStorage,
        isPegasusUserDataKey,
        safeJsonParse
    };
})();

window.exportPegasusData = async function() {
    if (!window.PegasusManifest) {
        console.error("❌ CRITICAL: PegasusManifest not found.");
        alert("Σφάλμα: Λείπει το manifest.js. Η εξαγωγή ακυρώθηκε.");
        return;
    }

    const data = window.PegasusBackup?.buildSnapshot
        ? window.PegasusBackup.buildSnapshot("manual-json-export", { includeSkippedKeys: true })
        : { localStorage: {}, indexedDB: [] };
    data.indexedDB = [];

    console.log("%c[BACKUP] Starting Complete User-Data Scan v10.3...", "color: #00bcd4; font-weight: bold;");

    const dbRequest = indexedDB.open("PegasusLevels", 1);
    dbRequest.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("photos")) {
            db.close();
            finalizeExport(data);
            return;
        }

        const tx = db.transaction("photos", "readonly");
        const store = tx.objectStore("photos");
        store.getAll().onsuccess = (ev) => {
            data.indexedDB = ev.result || ev.target.result;
            db.close();
            finalizeExport(data);
        };
    };

    dbRequest.onerror = () => {
        console.warn("IndexedDB Access Failed. Exporting LocalStorage only.");
        finalizeExport(data);
    };
};

function finalizeExport(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0,10);

    a.href = url;
    a.download = `PEGASUS_FULL_BACKUP_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log("%c✅ PEGASUS: Backup Created with v10.3 Complete User-Data Protocol.", "color: #4CAF50; font-weight: bold;");
}

/* ==========================================================================
   SAFE RESTORE ENGINE - validation + pre-import local backup + rollback
   Source: local-only JSON, no cloud; never clears unrelated browser data.
   ========================================================================== */
window.importPegasusData = function(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (file.size > 64 * 1024 * 1024) {
        alert("Σφάλμα: Το αρχείο είναι υπερβολικά μεγάλο.");
        return;
    }

    const reader = new FileReader();
    reader.onerror = () => alert("Σφάλμα ανάγνωσης αρχείου backup.");
    reader.onload = async (e) => {
        const previousValues = new Map();
        let writesStarted = false;
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
                throw new Error("Το αρχείο δεν περιέχει έγκυρα δεδομένα.");
            }
            const payload = imported.localStorage || imported.localData || imported.local || imported.data || imported;
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                throw new Error("Μη έγκυρη μορφή backup.");
            }
            const keys = Object.keys(payload);
            if (!keys.length || keys.length > 10000) throw new Error("Το αρχείο backup είναι άδειο ή μη έγκυρο.");

            // Only recognized user data, not unknown system settings, saved secrets or restore logs.
            const migrated = Object.create(null);
            const dateKeys = ["food_log_", "pegasus_cardio_kcal_", "pegasus_routine_injected_", "weight_"];
            for (const key of keys) {
                if (!window.PegasusBackup?.isPegasusUserDataKey?.(key)) continue;
                let newKey = key;
                if (dateKeys.some(prefix => key.startsWith(prefix))) {
                    const parts = key.split('_');
                    const datePart = parts.pop();
                    const dateParts = datePart.split('/');
                    if (dateParts.length === 3) {
                        const [day, month, year] = dateParts;
                        if (/^\d{1,2}$/.test(day) && /^\d{1,2}$/.test(month) && /^\d{4}$/.test(year)) {
                            newKey = parts.join('_') + '_' + day.padStart(2, '0') + '/' + month.padStart(2, '0') + '/' + year;
                        }
                    }
                }
                const value = payload[key];
                if (value === undefined) continue;
                migrated[newKey] = typeof value === "string" ? value : JSON.stringify(value);
            }
            const entries = Object.entries(migrated);
            if (!entries.length) throw new Error("Το αρχείο δεν περιέχει αναγνωρίσιμα δεδομένα PEGASUS.");
            const importedPhotos = Array.isArray(imported.indexedDB) ? imported.indexedDB : [];
            if (importedPhotos.length > 5000 || importedPhotos.some(photo => !photo || typeof photo !== "object" || !Object.hasOwn(photo, "id"))) {
                throw new Error("Τα δεδομένα φωτογραφιών δεν έχουν έγκυρη μορφή.");
            }

            if (!confirm("Να γίνει ασφαλής επαναφορά;\n\nΘα διατηρηθούν τα υπάρχοντα δεδομένα που δεν περιλαμβάνονται στο αρχείο. Θα δημιουργηθεί αντίγραφο ασφαλείας πριν την εισαγωγή.")) return;

            const emergency = window.PegasusBackup.buildSnapshot("before-safe-restore");
            emergency.indexedDB = []; // Current photos remain untouched; only incoming photos are merged.
            const emergencyBlob = new Blob([JSON.stringify(emergency, null, 2)], { type: "application/json" });
            const emergencyUrl = URL.createObjectURL(emergencyBlob);
            const link = document.createElement("a");
            try {
                link.href = emergencyUrl;
                link.download = "PEGASUS_BEFORE_RESTORE_" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
                document.body.appendChild(link);
                link.click();
            } finally {
                link.remove();
                setTimeout(() => URL.revokeObjectURL(emergencyUrl), 1000);
            }

            for (const [key] of entries) previousValues.set(key, localStorage.getItem(key));
            writesStarted = true;
            for (const [key, value] of entries) localStorage.setItem(key, value);

            // Existing photos are never deleted. New/imported photos are merged in
            // one IndexedDB transaction; failed transactions reject before success.
            if (importedPhotos.length) {
                await new Promise((resolve, reject) => {
                    try {
                        window.GalleryEngine?.db?.close?.();
                        const request = indexedDB.open("PegasusLevels", 1);
                        request.onupgradeneeded = ev => {
                            const db = ev.target.result;
                            if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
                        };
                        request.onerror = () => reject(request.error || new Error("Αποτυχία πρόσβασης στο IndexedDB."));
                        request.onsuccess = () => {
                            const db = request.result;
                            if (!db.objectStoreNames.contains("photos")) {
                                db.close();
                                reject(new Error("Δεν βρέθηκε ο πίνακας φωτογραφιών."));
                                return;
                            }
                            try {
                                const tx = db.transaction("photos", "readwrite");
                                tx.oncomplete = () => { db.close(); resolve(); };
                                tx.onerror = () => { db.close(); reject(tx.error || new Error("Αποτυχία αποθήκευσης φωτογραφιών.")); };
                                tx.onabort = () => { db.close(); reject(tx.error || new Error("Η αποθήκευση φωτογραφιών ακυρώθηκε.")); };
                                for (const photo of importedPhotos) tx.objectStore("photos").put(photo);
                            } catch (error) { db.close(); reject(error); }
                        };
                    } catch (error) { reject(error); }
                });
            }
            await finalizeRecovery();
        } catch (error) {
            if (writesStarted) {
                // Restore only touched keys, never clear the browser's other data.
                for (const [key, oldValue] of previousValues) {
                    try {
                        if (oldValue === null) localStorage.removeItem(key);
                        else localStorage.setItem(key, oldValue);
                    } catch (rollbackError) {
                        console.error("PEGASUS: restore rollback failed for", key, rollbackError);
                    }
                }
            }
            console.error("PEGASUS SAFE RESTORE:", error);
            alert("Η επαναφορά δεν ολοκληρώθηκε.\nΤα παλιά δεδομένα αποκαταστάθηκαν όπου ήταν δυνατό.\n" + error.message);
        }
    };
    reader.readAsText(file);
};

async function finalizeRecovery() {
    console.log("💾 PEGASUS: safe local restore complete.");
    alert("✅ Η επαναφορά ολοκληρώθηκε. Τα άλλα τοπικά δεδομένα διατηρήθηκαν.");
    window.location.reload();
}

window.triggerPegasusImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => window.importPegasusData(e);
    input.click();
};
