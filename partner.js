/* ==========================================================================
   PEGASUS PARTNER ENGINE - ULTIMATE SMART LIST (STRICT v16.2 PATCHED)
   Protocol: Global Scope Shielding, State Reset & Cloud Sync
   Status: FINAL STABLE | FIXED: STATE BLEED & REFERENCE ERRORS
   ========================================================================== */

// 🛡️ Global Safe Declaration
var M = M || window.PegasusManifest;

// 🎯 FIXED: Σύνδεση στο window για να είναι προσβάσιμο από παντού (app.js)
window.partnerData = {
    isActive: false,
    currentPartner: "",
    isUser1Turn: true
};

// 1. Ενεργοποίηση / ΑΠΕνεργοποίηση
window.togglePartnerMode = function() {
    const nameInput = document.getElementById('partnerNameInput');
    const btn = document.getElementById('btnPartnerMode');

    if (!window.partnerData.isActive) {
        let rawName = nameInput ? nameInput.value.trim() : "";
        let upperName = rawName.toLocaleUpperCase('el-GR');

        if (rawName === "" || upperName === "ANGELOS" || upperName === "ΑΓΓΕΛΟΣ" || upperName === "ZZ") {
            alert("PEGASUS STRICT: Γράψε ένα έγκυρο όνομα συνεργάτη!");
            return;
        }

        window.partnerData.isActive = true;
        window.partnerData.currentPartner = upperName;
        window.partnerData.isUser1Turn = true; // Ο ΑΓΓΕΛΟΣ ξεκινάει πάντα πρώτος

        // Αποθήκευση ΣΤΗ ΛΙΣΤΑ ΟΝΟΜΑΤΩΝ
        window.savePartnerNameToList(upperName);
        window.updatePartnerDatalist();

        if (btn) {
            btn.textContent = `Συνεργάτης: ${upperName} (ON)`;
            btn.style.background = "#4CAF50";
            btn.style.color = "#000";
        }
        if (nameInput) nameInput.disabled = true;

        console.log(`🤝 PARTNER MODE: Activated with ${upperName}`);

    } else {
        // 🎯 FIXED: Πλήρες State Reset για αποφυγή Data Bleed
        window.partnerData.isActive = false;
        window.partnerData.currentPartner = "";
        window.partnerData.isUser1Turn = true; // Κλείδωμα πίσω στον Άγγελο

        if (btn) {
            btn.textContent = "Συνεργάτης: ανενεργός";
            btn.style.background = "#222";
            btn.style.color = "#4CAF50";
        }
        if (nameInput) {
            nameInput.disabled = false;
            nameInput.value = "";
        }

        console.log("🤝 PARTNER MODE: Deactivated. System reverted to Master User.");
    }
};

// 2. Αποθήκευση ΟΝΟΜΑΤΟΣ ΣΕ ΕΙΔΙΚΗ ΛΙΣΤΑ
window.savePartnerNameToList = function(name) {
  const listKey = M?.workout?.partnersList || "pegasus_partners_list";
let list = JSON.parse(localStorage.getItem(listKey) || "[]");
    if (!list.includes(name)) {
        list.push(name);
     localStorage.setItem(listKey, JSON.stringify(list));

        // 🎯 FIXED: Cloud Sync για μεταφορά των ονομάτων στο κινητό
        if (window.PegasusCloud && typeof window.PegasusCloud.push === "function") {
            window.PegasusCloud.push(true);
        }
    }
};

// 3. ΑΝΑΝΕΩΣΗ ΤΗΣ ΛΙΣΤΑΣ ΠΡΟΤΑΣΕΩΝ
window.updatePartnerDatalist = function() {
    const dataList = document.getElementById('partnerList');
    if (!dataList) return;

    // Περνάμε τα ονόματα από 2 φίλτρα για να είμαστε σίγουροι
    let partnerNames = new Set();

    // Φίλτρο Α: Από την ειδική λίστα ονομάτων (Μπλοκάρει Λατινικά & Ελληνικά)
    const listKey = M?.workout?.partnersList || "pegasus_partners_list";
let list = JSON.parse(localStorage.getItem(listKey) || "[]");
    list.forEach(n => {
        if(n !== "ZZ" && n !== "ANGELOS" && n !== "ΑΓΓΕΛΟΣ") partnerNames.add(n);
    });

    // Φίλτρο Β: Από υπάρχοντα βάρη (για παλιούς συνεργάτες)
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith("weight_") && !key.startsWith("weight_ANGELOS_") && !key.startsWith("weight_ΑΓΓΕΛΟΣ_")) {
            const parts = key.split('_');
            if (parts.length >= 3) {
                const foundName = parts[1];
                if (foundName !== "ANGELOS" && foundName !== "ΑΓΓΕΛΟΣ" && foundName !== "" && foundName !== "ZZ") {
                    partnerNames.add(foundName);
                }
            }
        }
    });

    dataList.innerHTML = "";
    partnerNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        dataList.appendChild(option);
    });
};

// 4. Αποθήκευση / ΦΟΡΤΩΣΗ ΚΙΛΩΝ
window.savePartnerWeight = function(exerciseName, weight) {
    if (!exerciseName) return;

    // 🎯 Ενιαία Ελληνική ονοματολογία ID ("ΑΓΓΕΛΟΣ")
    const userKey = window.partnerData.isUser1Turn ? "ΑΓΓΕΛΟΣ" : window.partnerData.currentPartner;
    localStorage.setItem(`weight_${userKey}_${exerciseName.trim()}`, weight);

    // Legacy support: Αποθηκεύουμε και στο γενικό κλειδί αν είναι ο ΑΓΓΕΛΟΣ
    if (window.partnerData.isUser1Turn) {
        localStorage.setItem(`weight_${exerciseName.trim()}`, weight);
    }
};

window.loadPartnerWeight = function(exerciseName) {
    if (!exerciseName) return "";

    // 🎯 Ενιαία Ελληνική ονοματολογία ID ("ΑΓΓΕΛΟΣ")
    const userKey = window.partnerData.isUser1Turn ? "ΑΓΓΕΛΟΣ" : window.partnerData.currentPartner;

    // Διαβάζει πρώτα από το Partner Key, μετά από το Legacy Key
    return localStorage.getItem(`weight_${userKey}_${exerciseName.trim()}`) ||
           localStorage.getItem(`weight_${exerciseName.trim()}`) || "";
};

// 5. INITIALIZATION
window.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('partnerNameInput');
    if (nameInput) nameInput.value = "";
    window.updatePartnerDatalist();
});
