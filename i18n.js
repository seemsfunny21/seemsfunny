/* ==========================================================================
   PEGASUS I18N - v1.2 BODY GOAL LANGUAGE POLISH
   Protocol: GR / EN Runtime Translation Layer
   ========================================================================== */
(function() {
    const LANG_KEY = 'pegasus_language';
    const LEGACY_LANG_KEY = 'pegasus_lang';
    const exactPairs = [
        ['Εργαλεία PEGASUS', 'PEGASUS TOOLS'], ['Σύστημα συνεργάτη', 'PARTNER SYSTEM'], ['Όνομα συνεργάτη...', 'Partner name...'],
        ['Συνεργάτης: ανενεργός', 'PARTNER: OFF'], ['📅 Τύπος προγράμματος', '📅 PROGRAM TYPE'], ['🔊 Ήχος: ενεργός', '🔊 SOUND: ON'],
        ['🔇 Ήχος: σίγαση', '🔇 SOUND: MUTED'], ['🚀 Turbo: ανενεργό', '🚀 TURBO: OFF'], ['🚀 TURBO: Ενεργό', '🚀 TURBO: ON'],
        ['💾 Αποθήκευση αρχείου', '💾 SAVE FILE'], ['📂 Φόρτωση αρχείου', '📂 LOAD FILE'], ['🔐 Συγχρονισμός', '🔐 SYNC'],
        ['⚡ Καταγραφή EMS', '⚡ EMS log'], ['🔍 Έλεγχος PEGASUS', '🔍 PEGASUS CHECK'], ['➕ Ανέβασε φωτογραφία (JPG/PNG)', '➕ Upload photo (JPG/PNG)'],
        ['Εβδομαδιαίοι στόχοι σετ', 'Weekly set targets'], ['PEGASUS STRICT: Συμπλήρωσε έγκυρα Χιλιόμετρα και Θερμίδες.', 'PEGASUS STRICT: Enter valid Distance and Calories.'],
        ['✅ Καταχωρήθηκε!', '✅ SAVED!'], ['PEGASUS STRICT: Συμπλήρωσε Φαγητό και Θερμίδες!', 'PEGASUS STRICT: Fill Food and Calories!'],
        ['PEGASUS STRICT: Μπορείς να συγκρίνεις μόνο 2 φωτογραφίες τη φορά.', 'PEGASUS STRICT: You can compare only 2 photos at a time.'],
        ['PEGASUS STRICT: Γράψε ένα έγκυρο όνομα συνεργάτη!', 'PEGASUS STRICT: Enter a valid partner name!'], ['Σφάλμα: Το dietAdvisor.js δεν έχει φορτωθεί σωστά.', 'Error: dietAdvisor.js did not load correctly.'],
        ['PEGASUS STRICT: Παρακαλώ εισάγετε ένα έγκυρο βάρος (30-250 kg).', 'PEGASUS STRICT: Please enter a valid weight (30-250 kg).'], ['Σφάλμα: Συμπλήρωσε Άσκηση, Κιλά και Επαναλήψεις.', 'ERROR: Fill Exercise, Weight and Reps.'],
        ['Προθέρμανση', 'Warmup'], ['Έναρξη', 'Start'], ['Παύση', 'Pause'], ['Συνέχεια', 'Continue'], ['Επόμενο', 'Next'],
        ['Ημερολόγιο', 'Calendar'], ['Επιτεύγματα', 'Achievements'], ['Διατροφή', 'Nutrition'], ['Προεπισκόπηση', 'PREVIEW'],
        ['Ρυθμίσεις', 'Settings'], ['EMAIL', 'EMAIL'], ['⚙️ Εργαλεία', '⚙️ TOOLS'], ['GR / EN', 'EN / GR'],
        ['Προπονήσεις:', 'Workouts:'], ['Γκαλερί προόδου', 'PROGRESS GALLERY'], ['Ημερολόγιο PEGASUS', 'PEGASUS CALENDAR'],
        ['Ρυθμίσεις PEGASUS', 'PEGASUS SETTINGS'], ['Βάρος (kg)', 'Weight (kg)'], ['Ύψος (cm)', 'Height (cm)'],
        ['Ηλικία', 'Age'], ['Φύλο', 'Gender'], ['Άνδρας', 'Male'], ['Γυναίκα', 'Female'], ['Γράμμωση', 'Cutting'], ['Όγκος', 'Bulk'], ['Στόχος Kcal', 'Kcal Goal'],
        ['Πρωτεΐνη (g)', 'Protein (g)'], ['Στήθος', 'Chest'], ['Πλάτη', 'Back'], ['Πόδια', 'Legs'], ['Χέρια', 'Arms'],
        ['Ώμοι', 'Shoulders'], ['Κορμός', 'Core'], ['Αποθήκευση', 'SAVE'], ['Ημερολόγιο Διατροφής', 'Nutrition Log'],
        ['Θερμίδες', 'Calories'], ['Πρωτεΐνη', 'Protein'], ['Υπόλοιπο', 'Remaining'], ['Γεύματα', 'Meals'],
        ['Φαγητό', 'Food'], ['Σήμερα', 'Today'], ['Συχνές Επιλογές', 'Frequent Choices'], ['🔍 Αναζήτηση...', '🔍 Search...'],
        ['Μενού Κούκι', 'KOUKI MENU'], ['Επισκόπηση & πρόοδος', 'PREVIEW & PROGRESS'], ['Ασκήσεις ημέρας', "TODAY'S EXERCISES"],
        ['Καταγραφή ποδηλασίας', 'Cycling log'], ['Χιλιόμετρα (km):', 'Distance (KM):'], ['Θερμίδες (kcal):', 'Calories (KCAL):'],
        ['Άκυρο', 'CANCEL'], ['Ημερομηνία Τετάρτης:', 'WEDNESDAY DATE:'], ['Μέση ένταση (avg %):', 'AVERAGE INTENSITY (AVG %):'],
        ['Θερμίδες (e-kcal):', 'Calories (e-Kcal):'], ['Επιλογή προγράμματος', 'Choose Program'], ['5 Ημέρες Βάρη', '5 Days Weights'],
        ['Βάρη + IMS Τετάρτη', 'Weights + IMS Wednesday'], ['Βάρη + Ποδήλατο ΣΚ', 'Weights + Weekend Bike'], ['Βάρη + ems + ποδήλατο', 'Weights + EMS + Bike'],
        ['Ασφαλής ταυτοποίηση', 'SECURE AUTHENTICATION'], ['Απασφάλιση συστήματος', 'UNLOCK SYSTEM'], ['Επιστροφή / άκυρο', 'BACK / CANCEL'],
        ['Offline MODE', 'Offline MODE'], ['Λειτουργία offline', 'Offline MODE'], ['Απασφάλιση', 'UNLOCK'], ['Σύστημα έτοιμο', 'SYSTEM READY'],
        ['Συγχρονισμός...', 'SYNCING...'], ['Σφάλμα SYNC', 'SYNC ERROR'], ['Λάθος PIN', 'WRONG PIN'], ['Αερόβια', 'Cardio'],
        ['Γεύματα', 'Meals'], ['Στόχοι', 'Targets'], ['Έγγραφα', 'Documents'], ['Όχημα', 'Vehicle'], ['Σημειώσεις', 'Notes'],
        ['Απόθεμα συμπληρωμάτων', 'Supplement stock'], ['Πρωτεΐνη whey', 'Whey protein'], ['Κρεατίνη', 'Creatine'], ['Αναπλήρωση', 'REFILL'],
        ['Ρυθμίσεις & βάρος', 'SETTINGS & WEIGHT'], ['Λήψη backup', 'DOWNLOAD BACKUP'], ['Επαναφορά data', 'RESTORE DATA'], ['Γενικό reset συστήματος', 'FULL SYSTEM RESET'],
        ['Συντήρηση (TDEE): -- kcal', 'Συντήρηση (TDEE): -- kcal'], ['Μέσος όρος εβδομάδας: -- kg', 'Weekly Avg: -- kg'], ['Αναμονή δεδομένων...', 'Waiting for data...'],
        ['Online', 'Online'], ['Offline', 'Offline'], ['LOCKED', 'LOCKED'], ['Advisor Offline', 'Advisor Offline'], ['αρχικοποιηση συστηματος', 'system initialization'],
        ['Καιρός', 'Weather'], ['Ανανέωση', 'Refresh'], ['Άνεμος', 'Wind'], ['Ενημέρωση', 'Updated'], ['Φόρτωση καιρού...', 'Loading weather...'],
        ['Δεν υπάρχουν ακόμη δεδομένα καιρού.', 'No weather data yet.'], ['Καιρός ΟΚ για πρόγραμμα/ποδήλατο.', 'Weather OK for training/bike.'],
        ['Προσοχή: πιθανή βροχή. Κράτα indoor επιλογή.', 'Caution: possible rain. Keep indoor option.'], ['Πολύς αέρας. Το ποδήλατο θέλει προσοχή.', 'Strong wind. Bike needs caution.'],
        ['Μέτριος αέρας. Ρύθμισε ένταση ποδηλάτου.', 'Moderate wind. Adjust bike intensity.'],
        ['Δευτέρα','Monday'], ['Τρίτη','Tuesday'], ['Τετάρτη','Wednesday'], ['Πέμπτη','Thursday'], ['Παρασκευή','Friday'], ['Σάββατο','Saturday'], ['Κυριακή','Sunday'],
        ['Δευτέρα','MONDAY'], ['Τρίτη','TUESDAY'], ['Τετάρτη','WEDNESDAY'], ['Πέμπτη','THURSDAY'], ['Παρασκευή','FRIDAY'], ['Σάββατο','SATURDAY'], ['Κυριακή','SUNDAY']
    ];

    // PEGASUS 195: Unified UI translation registry for dynamically rendered desktop labels.
    const extraExactPairs = [
        ['Εργαλεία PEGASUS', 'PEGASUS Tools'], ['Εργαλεία Pegasus', 'PEGASUS Tools'], ['PEGASUS Tools', 'PEGASUS Tools'],
        ['Ρυθμίσεις PEGASUS', 'PEGASUS Settings'], ['Ρυθμίσεις Pegasus', 'PEGASUS Settings'], ['PEGASUS Settings', 'PEGASUS Settings'],
        ['Επίπεδο & επιτεύγματα', 'Level & Achievements'], ['Επίπεδο και επιτεύγματα', 'Level & Achievements'],
        ['Προεπισκόπηση', 'Preview'], ['Επισκόπηση & πρόοδος', 'Preview & progress'], ['Ασκήσεις ημέρας', "Today's exercises"],
        ['Σύστημα συνεργάτη', 'Partner system'], ['Όνομα συνεργάτη...', 'Partner name...'], ['Συνεργάτης: ανενεργός', 'Partner: inactive'],
        ['Συνεργάτης: ενεργός', 'Partner: active'], ['Τύπος προγράμματος', 'Program type'], ['Ήχος: ενεργός', 'Sound: active'],
        ['Ήχος: σίγαση', 'Sound: muted'], ['Turbo: ανενεργό', 'Turbo: inactive'], ['Turbo: ενεργό', 'Turbo: active'],
        ['Αποθήκευση αρχείου', 'Save file'], ['Φόρτωση αρχείου', 'Load file'], ['Cloud: συνδεδεμένο', 'Cloud: connected'],
        ['Γκαλερί προόδου', 'Progress gallery'], ['Καταγραφή EMS', 'EMS log'], ['System: Stable (100%)', 'System: Stable (100%)'],
        ['Σύστημα: σταθερό (100%)', 'System: Stable (100%)'], ['Συντήρηση (TDEE): -- kcal', 'Maintenance (TDEE): -- kcal'],
        ['Μέσος όρος εβδομάδας: -- kg', 'Weekly avg: -- kg'], ['Στόχος kcal', 'Kcal goal'], ['Στόχος Kcal', 'Kcal goal'],
        ['Στόχος θερμίδων', 'Kcal goal'], ['Στόχος πρωτεΐνης', 'Protein goal'], ['Εβδομαδιαίοι στόχοι σετ', 'Weekly set targets'],
        ['Εβδομαδιαιοι στοχοι σετ', 'Weekly set targets'], ['Σώσιμο', 'Save'], ['Αποθήκευση', 'Save'],
        ['Προθέρμανση', 'Warmup'], ['Έναρξη', 'Start'], ['Επόμενο', 'Next'], ['Ημερολόγιο', 'Calendar'],
        ['Επιτεύγματα', 'Achievements'], ['Διατροφή', 'Nutrition'], ['Ρυθμίσεις', 'Settings'], ['Email', 'Email'],
        ['Εργαλεία', 'Tools'], ['Προπονήσεις:', 'Workouts:'], ['Θερμίδες', 'Calories'], ['Πρωτεΐνη', 'Protein'],
        ['Υπόλοιπο', 'Remaining'], ['Γεύματα', 'Meals'], ['Φαγητό', 'Food'], ['Συχνές επιλογές', 'Frequent choices'],
        ['Μενού Κούκι', 'Kouki menu'], ['Μόνο ποδήλατο', 'Bike only'], ['Ποδήλατο', 'Bike'], ['Ποδ. + βάρη', 'Bike + weights'],
        ['Βάρη', 'Weights'], ['Μόνο βάρη', 'Weights only'], ['Σ/Κ', 'Weekend'], ['Weekend training mode', 'Weekend training mode'],
        ['Μόνο ποδήλατο ενεργό — δεν φορτώνει βάρη. Διάλεξε άλλο mode για προπόνηση.', 'Bike only active — no weights loaded. Choose another mode for training.'],
        ['Μόνο ποδήλατο ενεργό — δεν φορτώνει βάρη.', 'Bike only active — no weights loaded.'],
        ['Δευτέρα', 'Monday'], ['Τρίτη', 'Tuesday'], ['Τετάρτη', 'Wednesday'], ['Πέμπτη', 'Thursday'], ['Παρασκευή', 'Friday'], ['Σάββατο', 'Saturday'], ['Κυριακή', 'Sunday'],
        ['Βάρος (kg)', 'Weight (kg)'], ['Ύψος (cm)', 'Height (cm)'], ['Ηλικία', 'Age'], ['Φύλο', 'Gender'], ['Άνδρας', 'Male'], ['Γυναίκα', 'Female'],
        ['Γράμμωση', 'Cutting'], ['Όγκος', 'Bulk'],
        ['Στήθος', 'Chest'], ['Πλάτη', 'Back'], ['Πόδια', 'Legs'], ['Χέρια', 'Arms'], ['Ώμοι', 'Shoulders'], ['Κορμός', 'Core']
    ];
    extraExactPairs.forEach(pair => exactPairs.push(pair));



    const phrasePairs = [
        ['Συνεργάτης:', 'PARTNER:'], ['Ανενεργός', 'OFF'], ['Ενεργός', 'ON'],
        ['Συνεργάτης:', 'Partner:'], ['ανενεργός', 'inactive'], ['ενεργός', 'active'],
        ['Προθέρμανση', 'Warmup'], ['Έναρξη', 'Start'], ['Επόμενο', 'Next'], ['Ημερολόγιο', 'Calendar'],
        ['Επιτεύγματα', 'Achievements'], ['Διατροφή', 'Nutrition'], ['Ρυθμίσεις', 'Settings'], ['Εργαλεία', 'Tools'],
        ['Προεπισκόπηση', 'Preview'], ['Προπονήσεις:', 'Workouts:'], ['Συντήρηση (TDEE):', 'Maintenance (TDEE):'],
        ['Μέσος όρος εβδομάδας:', 'Weekly Avg:'], ['Βάρος (kg)', 'Weight (kg)'], ['Ύψος (cm)', 'Height (cm)'],
        ['Ηλικία', 'Age'], ['Φύλο', 'Gender'], ['Άνδρας', 'Male'], ['Γυναίκα', 'Female'],
        ['Γράμμωση', 'Cutting'], ['Όγκος', 'Bulk'],
        ['Στόχος kcal', 'Kcal Goal'], ['Στόχος kcal', 'Kcal goal'], ['Πρωτεΐνη (g)', 'Protein (g)'],
        ['Εβδομαδιαίοι στόχοι σετ', 'Weekly set targets'], ['Επισκόπηση & πρόοδος', 'Preview & progress'],
        ['Ασκήσεις ημέρας', "Today's exercises"], ['Στήθος', 'Chest'], ['Πλάτη', 'Back'], ['Πόδια', 'Legs'],
        ['Χέρια', 'Arms'], ['Ώμοι', 'Shoulders'], ['Κορμός', 'Core'], ['Μόνο ποδήλατο', 'Bike only'],
        ['Ποδ. + βάρη', 'Bike + weights'], ['Μόνο βάρη', 'Weights only'], ['Βάρη', 'Weights'], ['Ποδήλατο', 'Bike'],
        ['Συντήρηση (TDEE):', 'Maintenance (TDEE):'], ['M.O. Εβδομάδας:', 'Weekly Avg:'],
        ['Ήχος:', 'SOUND:'], ['Τύπος προγράμματος', 'PROGRAM TYPE'], ['Συγχρονισμός', 'SYNC'],
        ['Καταγραφή EMS', 'EMS log'], ['Καταγραφή ποδηλασίας', 'Cycling log'],
        ['Χιλιόμετρα', 'Distance'], ['Θερμίδες', 'Calories'], ['Πρωτεΐνη', 'Protein'],
        ['Αποθήκευση', 'SAVE'], ['Άκυρο', 'CANCEL'], ['Εβδομαδιαία στόχευση', 'WEEKLY TARGETING'],
        ['Προσωπικά έγγραφα', 'PERSONAL DOCUMENTS'], ['Στοιχεία οχήματος', 'VEHICLE DETAILS'],
        ['Ημερομηνίες & σέρβις', 'DATES & SERVICE'], ['Προσωπικές σημειώσεις', 'PERSONAL NOTES']
    ];

    const exercisePairs = [
        ['Πιέσεις στήθους','Chest Press'], ['Εκτάσεις στήθους','Chest Flys'], ['Κάμψεις','Pushups'],
        ['Τροχαλία πλάτης','Lat Pulldowns'], ['Κλειστή τροχαλία πλάτης','Lat Pulldowns Close'],
        ['Κωπηλατική καθιστή','Seated Rows'], ['Χαμηλή κωπηλατική καθιστή','Low Rows Seated'], ['Ανάποδη λαβή κωπηλατική τροχαλίας','Reverse Grip Cable Row'],
        ['Κωπηλατική σκυφτή','Bent Over Rows'], ['Τροχαλία με ίσια χέρια','Straight Arm Pulldowns'],
        ['Όρθια κωπηλατική','Upright Rows'], ['Κάμψεις δικεφάλων','Bicep Curls'],
        ['Κάμψεις δικεφάλων στο μαξιλάρι','Preacher Bicep Curls'], ['Πιέσεις τρικεφάλων','Tricep Pulldowns'],
        ['Κοιλιακοί crunch','Ab Crunches'], ['Κοιλιακοί sit-up','Situps'], ['Σανίδα','Plank'], ['Αντίστροφοι κοιλιακοί','Reverse Crunch'],
        ['Άρσεις γονάτων ξαπλωτός','Lying Knee Raise'], ['Άρσεις ποδιών με ανύψωση λεκάνης','Leg Raise Hip Lift'],
        ['Εκτάσεις ποδιών','Leg Extensions'], ['Ποδηλασία','Cycling'], ['Διατάσεις','Stretching'], ['Προπόνηση EMS','EMS Training']
    ];

    const lookup = new Map();
    exactPairs.forEach((pair) => {
        if (!Array.isArray(pair) || pair.length < 2) return;
        lookup.set(pair[0], pair);
        lookup.set(pair[1], pair);
    });

    const exerciseLookup = new Map();
    exercisePairs.forEach((pair) => {
        exerciseLookup.set(pair[0], pair);
        exerciseLookup.set(pair[1], pair);
    });

    function getLanguage() { return localStorage.getItem(LANG_KEY) || localStorage.getItem(LEGACY_LANG_KEY) || 'gr'; }
    function setLanguage(lang) {
        const safeLang = lang === 'en' ? 'en' : 'gr';
        localStorage.setItem(LANG_KEY, safeLang);
        localStorage.setItem(LEGACY_LANG_KEY, safeLang);
        applyLanguage();
        try { window.dispatchEvent(new CustomEvent('pegasus_language_changed', { detail: { lang: safeLang } })); } catch (_) {}
    }

    function translatePairText(text, pair, lang) {
        return lang === 'en' ? pair[1] : pair[0];
    }

    function escapeRegex(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function replacePhraseSafely(text, from, to) {
        if (!from || !String(text).includes(from)) return text;

        // PEGASUS 139 FIX: do not translate short English status tokens inside
        // program names such as IRON or EMS only. Previously ON -> Ενεργός
        // corrupted labels into IRENERGOS / ENERGOSLY.
        if (/^[A-Za-z]{1,3}$/.test(from)) {
            const re = new RegExp('(^|[^A-Za-z])(' + escapeRegex(from) + ')(?=$|[^A-Za-z])', 'g');
            return String(text).replace(re, function(match, prefix) {
                return prefix + to;
            });
        }

        return String(text).split(from).join(to);
    }

    function shouldSkipI18n(node) {
        const el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        return !!el?.closest?.('[data-no-i18n="true"], .no-i18n');
    }

    function translateLoose(text, forcedLang) {
        const lang = forcedLang || getLanguage();
        const raw = String(text ?? '');
        const trimmed = raw.trim();
        if (!trimmed) return raw;

        const pair = lookup.get(trimmed) || lookup.get(trimmed.toLocaleUpperCase('el-GR')) || lookup.get(trimmed.toLocaleLowerCase('el-GR'));
        if (pair) return raw.replace(trimmed, translatePairText(trimmed, pair, lang));

        let translated = raw;
        // PEGASUS 196: Exercise names stay English-only in both GR and EN modes.
        // If an older rendered/cache label contains a Greek exercise name, normalize it back to English.
        exercisePairs.forEach((exercisePair) => {
            translated = replacePhraseSafely(translated, exercisePair[0], exercisePair[1]);
        });
        phrasePairs.forEach((phrasePair) => {
            const from = lang === 'en' ? phrasePair[0] : phrasePair[1];
            const to = lang === 'en' ? phrasePair[1] : phrasePair[0];
            translated = replacePhraseSafely(translated, from, to);
        });
        return translated;
    }

    function getExerciseDisplayName(name, forcedLang) {
        const raw = String(name ?? '').trim();
        const pair = exerciseLookup.get(raw);
        // PEGASUS 196: exercises are product/workout identifiers, so display them in English only.
        return pair ? pair[1] : raw;
    }

    function translateTextNode(node) {
        if (!node?.nodeValue) return;
        if (shouldSkipI18n(node)) return;
        const parent = node.parentElement;
        if (!parent || ['SCRIPT','STYLE','TEXTAREA'].includes(parent.tagName)) return;
        const translated = translateLoose(node.nodeValue);
        if (translated !== node.nodeValue) node.nodeValue = translated;
    }

    function translateElementAttributes(el) {
        if (shouldSkipI18n(el)) return;
        ['placeholder', 'title', 'aria-label'].forEach(attr => {
            const val = el.getAttribute?.(attr);
            if (!val) return;
            const translated = translateLoose(val);
            if (translated !== val) el.setAttribute(attr, translated);
        });
        if (el.tagName === 'INPUT') {
            const type = (el.getAttribute('type') || '').toLowerCase();
            if (['button','submit','reset'].includes(type) && el.value) {
                const translated = translateLoose(el.value);
                if (translated !== el.value) el.value = translated;
            }
        }
        if (el.dataset?.i18nKind === 'exercise' && el.dataset.i18nSource) {
            el.textContent = getExerciseDisplayName(el.dataset.i18nSource);
        }
    }

    function walkAndTranslate(root) {
        if (!root || !document.body) return;
        if (root.nodeType === Node.TEXT_NODE) { translateTextNode(root); return; }
        if (root.nodeType !== Node.ELEMENT_NODE) return;
        if (shouldSkipI18n(root)) return;
        translateElementAttributes(root);
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
        let node = walker.currentNode;
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
            else if (node.nodeType === Node.ELEMENT_NODE) translateElementAttributes(node);
            node = walker.nextNode();
        }
    }

    function updateLangButtons() {
        document.querySelectorAll('#btnLangToggle, .pegasus-lang-toggle').forEach(btn => {
            btn.textContent = 'En/Gr';
            btn.style.display = '';
            btn.style.alignItems = '';
            btn.style.justifyContent = '';
            btn.style.gap = '';
            btn.style.padding = '';
            btn.setAttribute('aria-label', 'En/Gr');
            btn.title = 'En/Gr';
        });
    }

    function applyBodyGoalLanguage(lang) {
        document.querySelectorAll('[data-body-goal-mode]').forEach(btn => {
            const mode = btn.getAttribute('data-body-goal-mode');
            btn.textContent = lang === 'en'
                ? (mode === 'bulk' ? 'Bulk' : 'Cutting')
                : (mode === 'bulk' ? 'Όγκος' : 'Γράμμωση');
        });
    }



    function applyTargetedDesktopTranslations(lang) {
        const galleryBtn = document.getElementById('btnOpenGallery');
        if (galleryBtn) galleryBtn.textContent = lang === 'en' ? '🖼️ Progress gallery' : '🖼️ Γκαλερί προόδου';

        const galleryTitle = document.querySelector('#galleryPanel h3');
        if (galleryTitle) galleryTitle.textContent = lang === 'en' ? 'Progress gallery' : 'Γκαλερί προόδου';

        const cardioTitle = document.querySelector('#cardioPanel h3');
        if (cardioTitle) cardioTitle.innerHTML = lang === 'en'
            ? '🚴<br>Cycling<br>log'
            : '🚴<br>Καταγραφή<br>ποδηλασίας';
    }

    function refreshViews() {
        try {
            window.refreshAllUI?.();
            window.updateFoodUI?.();
            window.renderFood?.();
            window.renderCalendar?.();
            window.renderAchievements?.();
            window.renderLiftingContent?.();
            window.updateSuppUI?.();
            window.PegasusInventory?.updateUI?.();
            window.PegasusInventoryPC?.updateUI?.();
            window.PegasusDiet?.updateUI?.();
            window.PegasusDiet?.renderDailyKouki?.();
            window.PegasusMobileUI?.render?.();
        } catch (e) {
            console.warn('PEGASUS I18N refresh warning', e);
        }
    }

    function applyLanguage() {
        try {
            const lang = getLanguage();
            document.documentElement.lang = lang === 'en' ? 'en' : 'el';
            walkAndTranslate(document.body);
            applyTargetedDesktopTranslations(lang);
            applyBodyGoalLanguage(lang);
            updateLangButtons();
            refreshViews();
            [60, 250, 800].forEach(delay => setTimeout(() => {
                walkAndTranslate(document.body);
                applyTargetedDesktopTranslations(lang);
                applyBodyGoalLanguage(lang);
                try { window.normalizePegasusUILabels?.(document.body); } catch (_) {}
            }, delay));
        } catch (e) {
            console.warn('PEGASUS I18N apply warning', e);
        }
    }

    const observer = new MutationObserver(muts => {
        muts.forEach(m => {
            m.addedNodes.forEach(node => walkAndTranslate(node));
            if (m.type === 'characterData') translateTextNode(m.target);
        });
    });

    function toggleLanguage() { setLanguage(getLanguage() === 'en' ? 'gr' : 'en'); }

    window.PegasusI18n = { getLanguage, setLanguage, toggleLanguage, applyLanguage, translateLoose, getExerciseDisplayName };
    window.t = translateLoose;
    window.tr = translateLoose;
    window.getPegasusExerciseDisplayName = getExerciseDisplayName;
    window.translatePegasusUI = applyLanguage;
    window.setPegasusLanguage = setLanguage;
    window.togglePegasusLanguage = toggleLanguage;

    document.addEventListener('DOMContentLoaded', () => {
        updateLangButtons();
        applyBodyGoalLanguage(getLanguage());
        applyLanguage();
        if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        document.querySelectorAll('#btnLangToggle, .pegasus-lang-toggle').forEach(btn => {
            if (!btn.dataset.i18nBound) {
                btn.dataset.i18nBound = 'true';
                btn.addEventListener('click', () => toggleLanguage());
            }
        });
    });
})();
