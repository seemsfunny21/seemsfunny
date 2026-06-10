/* ========================================================================== 
   PEGASUS BRAIN - v1.0.299 (CLASSIC FIXED 40-MIN TUE/WED/FRI SPLIT)
   Purpose: Pegasus MS-600 + floor-only weekly training plan, weekend carry-over,
   recovery guard, cycling-aware leg policy, focused split days, and 45-minute circuit spacing.
   ========================================================================== */
(function installPegasusBrain() {
    const STRICT_GROUPS = ["Στήθος", "Πλάτη", "Πόδια", "Χέρια", "Ώμοι", "Κορμός"];
    const RECOVERY_DAYS = new Set(["Δευτέρα", "Πέμπτη"]);
    const WEEKEND_DAYS = new Set(["Σάββατο", "Κυριακή"]);
    const DAY_INDEX = { "Κυριακή": 0, "Δευτέρα": 1, "Τρίτη": 2, "Τετάρτη": 3, "Πέμπτη": 4, "Παρασκευή": 5, "Σάββατο": 6 };
    const DAY_FROM_INDEX = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

    // PEGASUS 215: Real exercise pool is restricted to what exists on the
    // Pegasus MS-600 plus floor/core work. Cut/Bulk share the same smart order;
    // the difference is the user's selected controllable weight/intensity.
    const DEFAULT_TARGETS_215 = { "Στήθος": 16, "Πλάτη": 20, "Πόδια": 8, "Χέρια": 17, "Ώμοι": 3, "Κορμός": 10 };
    const MIN_WORKOUT_MINUTES = 40;

    const exerciseMeta = {
        "Chest Press": { kind: "weighted", station: "seat", family: "chest_press" },
        "Chest Flys": { kind: "weighted", station: "seat", family: "chest_fly" },
        "Pushups": { kind: "floor", station: "floor", family: "pushup" },
        "Lat Pulldowns": { kind: "weighted", station: "seat_high", family: "lat_pulldown" },
        "Lat Pulldowns Close": { kind: "weighted", station: "seat_high", family: "lat_pulldown_close" },
        "Seated Rows": { kind: "weighted", station: "seat_mid", family: "seated_row" },
        "Low Rows Seated": { kind: "weighted", station: "floor_low", family: "low_row" },
        "Reverse Grip Cable Row": { kind: "weighted", station: "floor_low", family: "low_row" },
        "Bent Over Rows": { kind: "weighted", station: "standing_low", family: "bent_row" },
        "Straight Arm Pulldowns": { kind: "weighted", station: "standing_high", family: "straight_arm_pulldown" },
        "Upright Rows": { kind: "weighted", station: "standing_low", family: "upright_row" },
        "Bicep Curls": { kind: "weighted", station: "standing_low", family: "bicep_curl" },
        "Preacher Bicep Curls": { kind: "weighted", station: "preacher", family: "preacher_curl" },
        "Tricep Pulldowns": { kind: "weighted", station: "standing_high", family: "tricep_pulldown" },
        "Ab Crunches": { kind: "weighted", station: "seat_high", family: "cable_ab_crunch" },
        "Situps": { kind: "floor", station: "floor", family: "situp" },
        "Plank": { kind: "floor", station: "floor", family: "plank" },
        "Reverse Crunch": { kind: "floor", station: "floor", family: "reverse_crunch" },
        "Lying Knee Raise": { kind: "floor", station: "floor", family: "lying_knee_raise" },
        "Leg Raise Hip Lift": { kind: "floor", station: "floor", family: "leg_raise_hip_lift" },
        "Leg Extensions": { kind: "weighted", station: "seat_leg", family: "leg_extension" },
        "Stretching": { kind: "floor", station: "floor", family: "stretching" }
    };

    const templatesByDay = {
        "Τρίτη": {
            "Στήθος": ["Chest Press", "Chest Flys", "Pushups"],
            "Πλάτη": ["Lat Pulldowns", "Low Rows Seated", "Straight Arm Pulldowns"],
            "Χέρια": ["Tricep Pulldowns", "Bicep Curls"],
            "Ώμοι": ["Upright Rows"],
            "Κορμός": ["Plank", "Ab Crunches", "Reverse Crunch"]
        },
        "Τετάρτη": {
            "Στήθος": ["Chest Press", "Pushups", "Chest Flys"],
            "Πλάτη": ["Seated Rows", "Reverse Grip Cable Row", "Bent Over Rows"],
            "Χέρια": ["Bicep Curls", "Preacher Bicep Curls", "Tricep Pulldowns"],
            "Ώμοι": ["Upright Rows"],
            "Κορμός": ["Lying Knee Raise", "Plank", "Situps", "Leg Raise Hip Lift"],
            "Πόδια": ["Leg Extensions"]
        },
        "Παρασκευή": {
            "Στήθος": ["Chest Flys", "Chest Press", "Pushups"],
            "Πλάτη": ["Lat Pulldowns Close", "Bent Over Rows", "Straight Arm Pulldowns"],
            "Χέρια": ["Tricep Pulldowns", "Preacher Bicep Curls", "Bicep Curls"],
            "Ώμοι": ["Upright Rows"],
            "Κορμός": ["Ab Crunches", "Plank", "Leg Raise Hip Lift", "Reverse Crunch"]
        },
        "Σάββατο": {
            "Στήθος": ["Pushups", "Chest Press"],
            "Πλάτη": ["Low Rows Seated", "Straight Arm Pulldowns"],
            "Χέρια": ["Bicep Curls", "Tricep Pulldowns"],
            "Ώμοι": ["Upright Rows"],
            "Κορμός": ["Plank", "Reverse Crunch", "Situps"]
        },
        "Κυριακή": {
            "Στήθος": ["Chest Press", "Chest Flys"],
            "Πλάτη": ["Lat Pulldowns", "Seated Rows"],
            "Χέρια": ["Preacher Bicep Curls", "Tricep Pulldowns"],
            "Ώμοι": ["Upright Rows"],
            "Κορμός": ["Ab Crunches", "Leg Raise Hip Lift", "Lying Knee Raise"]
        }
    };

    const defaultTemplates = {
        "Στήθος": templatesByDay["Τρίτη"]["Στήθος"].map(name => ({ name, weight: weightFor(name) })),
        "Πλάτη": ["Lat Pulldowns", "Seated Rows", "Low Rows Seated", "Straight Arm Pulldowns", "Bent Over Rows", "Lat Pulldowns Close", "Reverse Grip Cable Row"].map(name => ({ name, weight: weightFor(name) })),
        "Πόδια": [{ name: "Leg Extensions", weight: weightFor("Leg Extensions") }],
        "Χέρια": ["Bicep Curls", "Tricep Pulldowns", "Preacher Bicep Curls"].map(name => ({ name, weight: weightFor(name) })),
        "Ώμοι": [{ name: "Upright Rows", weight: weightFor("Upright Rows") }],
        "Κορμός": ["Ab Crunches", "Plank", "Leg Raise Hip Lift", "Lying Knee Raise", "Reverse Crunch", "Situps"].map(name => ({ name, weight: weightFor(name) }))
    };

    const sessionBlueprints = {
        // PEGASUS 215: focused split. Δεν γεμίζουμε κάθε ημέρα με όλες τις μυϊκές ομάδες.
        // Τα sets μπαίνουν σε λίγες ασκήσεις/οικογένειες ώστε να μη βλέπεις 2 σετ από όλα.
        "Τρίτη": [
            ["Στήθος", 12], ["Χέρια", 4], ["Ώμοι", 3], ["Κορμός", 3]
        ],
        "Τετάρτη_CYCLING": [
            ["Πλάτη", 12], ["Χέρια", 7], ["Κορμός", 3]
        ],
        "Τετάρτη_LEGS": [
            ["Πόδια", 6], ["Πλάτη", 9], ["Χέρια", 4], ["Κορμός", 3]
        ],
        "Παρασκευή": [
            ["Στήθος", 4], ["Πλάτη", 8], ["Χέρια", 6], ["Κορμός", 4]
        ],
        "Σάββατο_WEIGHTS": [
            ["Κορμός", 6], ["Χέρια", 4], ["Ώμοι", 3], ["Στήθος", 3], ["Πλάτη", 2]
        ],
        "Σάββατο_BIKE_WEIGHTS": [
            ["Κορμός", 5], ["Χέρια", 3], ["Ώμοι", 2], ["Στήθος", 2]
        ],
        "Κυριακή_WEIGHTS": [
            ["Πλάτη", 5], ["Στήθος", 5], ["Κορμός", 4], ["Χέρια", 2], ["Ώμοι", 2]
        ],
        "Κυριακή_BIKE_WEIGHTS": [
            ["Πλάτη", 4], ["Στήθος", 3], ["Κορμός", 3], ["Χέρια", 2]
        ]
    };


    const CLASSIC_FIXED_MAIN_SPLIT = {
        // PEGASUS 299: fixed classic 40-minute split. These days no longer shrink
        // when weekly progress bars are already partly/full completed. Progress bars
        // only record what was done; they do not decide whether Tue/Wed/Fri exists.
        "Τρίτη": [
            { name: "Chest Press", sets: 4, muscleGroup: "Στήθος" },
            { name: "Chest Flys", sets: 4, muscleGroup: "Στήθος" },
            { name: "Pushups", sets: 4, muscleGroup: "Στήθος" },
            { name: "Tricep Pulldowns", sets: 4, muscleGroup: "Χέρια" },
            { name: "Upright Rows", sets: 3, muscleGroup: "Ώμοι" },
            { name: "Plank", sets: 3, muscleGroup: "Κορμός" }
        ],
        "Τετάρτη": [
            { name: "Lat Pulldowns", sets: 4, muscleGroup: "Πλάτη" },
            { name: "Seated Rows", sets: 4, muscleGroup: "Πλάτη" },
            { name: "Straight Arm Pulldowns", sets: 4, muscleGroup: "Πλάτη" },
            { name: "Bicep Curls", sets: 4, muscleGroup: "Χέρια" },
            { name: "Preacher Bicep Curls", sets: 3, muscleGroup: "Χέρια" },
            { name: "Lying Knee Raise", sets: 3, muscleGroup: "Κορμός" }
        ],
        "Παρασκευή": [
            { name: "Chest Press", sets: 4, muscleGroup: "Στήθος" },
            { name: "Lat Pulldowns Close", sets: 4, muscleGroup: "Πλάτη" },
            { name: "Bent Over Rows", sets: 4, muscleGroup: "Πλάτη" },
            { name: "Bicep Curls", sets: 3, muscleGroup: "Χέρια" },
            { name: "Tricep Pulldowns", sets: 3, muscleGroup: "Χέρια" },
            { name: "Ab Crunches", sets: 2, muscleGroup: "Κορμός" },
            { name: "Leg Raise Hip Lift", sets: 2, muscleGroup: "Κορμός" }
        ]
    };

    const CLASSIC_FIXED_TARGETS_299 = { "Στήθος": 16, "Πλάτη": 20, "Πόδια": 8, "Χέρια": 17, "Ώμοι": 3, "Κορμός": 10 };

    function applyClassicTargetsMigration() {
        try {
            const flag = "pegasus_classic_fixed_split_targets_v299";
            if (localStorage.getItem(flag) === "done") return;
            const key = window.PegasusManifest?.workout?.muscleTargets || "pegasus_muscle_targets";
            localStorage.setItem(`pegasus_targets_backup_before_classic_v299_${Date.now()}`, localStorage.getItem(key) || "");
            localStorage.setItem(key, JSON.stringify(CLASSIC_FIXED_TARGETS_299));
            localStorage.setItem(flag, "done");
            localStorage.setItem("pegasus_custom_weekly_targets_enabled", "true");
            localStorage.setItem("pegasus_custom_weekly_targets_updated_at", String(Date.now()));
        } catch (e) {
            console.warn("PEGASUS BRAIN: classic target migration skipped", e);
        }
    }

    applyClassicTargetsMigration();

    function cloneClassicFixedWorkout(day) {
        const source = CLASSIC_FIXED_MAIN_SPLIT[day];
        if (!Array.isArray(source)) return null;
        return source.map((ex, index) => ({
            ...ex,
            weight: weightFor(ex.name),
            brainManaged: true,
            brainFixedSplit: true,
            brainMinimumTopUp: true,
            brainReason: "Κλασικό σταθερό 40λεπτο πρόγραμμα Τρίτη/Τετάρτη/Παρασκευή",
            brainOrder: index
        }));
    }

    function weightFor(name) {
        const weights = {
            "Chest Press": "54",
            "Chest Flys": "42",
            "Pushups": "0",
            "Lat Pulldowns": "36",
            "Lat Pulldowns Close": "36",
            "Seated Rows": "66",
            "Low Rows Seated": "36",
            "Reverse Grip Cable Row": "36",
            "Bent Over Rows": "36",
            "Straight Arm Pulldowns": "30",
            "Upright Rows": "30",
            "Bicep Curls": "30",
            "Preacher Bicep Curls": "30",
            "Tricep Pulldowns": "20",
            "Ab Crunches": "30",
            "Situps": "0",
            "Plank": "0",
            "Reverse Crunch": "0",
            "Lying Knee Raise": "0",
            "Leg Raise Hip Lift": "0",
            "Leg Extensions": "0",
            "Stretching": "0"
        };
        return weights[name] ?? "0";
    }

    function safeJson(raw, fallback) {
        try {
            const parsed = JSON.parse(raw || "null");
            return parsed && typeof parsed === "object" ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function normalizeGreekDate(d = new Date()) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function dateFromKey(key) {
        const d = new Date(`${key}T12:00:00`);
        return Number.isNaN(d.getTime()) ? new Date() : d;
    }

    function addDays(dateOrKey, days) {
        const d = typeof dateOrKey === "string" ? dateFromKey(dateOrKey) : new Date(dateOrKey);
        d.setDate(d.getDate() + days);
        return d;
    }

    function getWeekKey(date = new Date()) {
        const d = typeof date === "string" ? dateFromKey(date) : new Date(date);
        const start = new Date(d);
        const daysSinceSaturday = (d.getDay() + 1) % 7;
        start.setHours(6, 0, 0, 0);
        start.setDate(d.getDate() - daysSinceSaturday);
        if (d.getDay() === 6 && d.getTime() < start.getTime()) start.setDate(start.getDate() - 7);
        return normalizeGreekDate(start);
    }

    function getNextWeekKey(date = new Date()) {
        return getWeekKey(addDays(date, 7));
    }

    function getDayName(date = new Date()) {
        const d = typeof date === "string" ? dateFromKey(date) : date;
        return DAY_FROM_INDEX[d.getDay()];
    }

    function emptyGroups(value = 0) {
        return STRICT_GROUPS.reduce((acc, group) => {
            acc[group] = value;
            return acc;
        }, {});
    }

    function getHistory() {
        const key = window.PegasusManifest?.workout?.weekly_history || "pegasus_weekly_history";
        const raw = safeJson(localStorage.getItem(key), {});
        const next = emptyGroups(0);
        STRICT_GROUPS.forEach(group => {
            const value = Number(raw?.[group]);
            next[group] = Number.isFinite(value) ? Math.max(0, value) : 0;
        });
        return next;
    }

    function getTargets() {
        if (window.PegasusOptimizer?.getTargets) return window.PegasusOptimizer.getTargets();
        const key = window.PegasusManifest?.workout?.muscleTargets || "pegasus_muscle_targets";
        return safeJson(localStorage.getItem(key), DEFAULT_TARGETS_215) || DEFAULT_TARGETS_215;
    }

    function normalizedName(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\u0370-\u03ff]+/g, "");
    }

    function resolveGroup(name, fallback = "Άλλο") {
        if (typeof window.resolvePegasusExerciseGroup === "function") return window.resolvePegasusExerciseGroup(name);
        if (typeof window.getPegasusExerciseGroup === "function") return window.getPegasusExerciseGroup(name);
        const exact = window.exercisesDB?.find(ex => String(ex.name || "").trim() === String(name || "").trim());
        return exact?.muscleGroup || fallback;
    }

    function getLedger() {
        return safeJson(localStorage.getItem("pegasus_weekly_history_counted_v2"), { weekKey: getWeekKey(), exercises: {} }) || { weekKey: getWeekKey(), exercises: {} };
    }

    function getGroupsFromLedgerDate(dateKey) {
        const ledger = getLedger();
        const result = new Set();
        const exercises = ledger?.exercises && typeof ledger.exercises === "object" ? ledger.exercises : {};
        Object.keys(exercises).forEach(key => {
            if (!key.startsWith(`${dateKey}|`)) return;
            const count = Number(exercises[key]) || 0;
            if (count <= 0) return;
            const norm = key.split("|").slice(1).join("|");
            const match = window.exercisesDB?.find(ex => normalizedName(ex.name) === norm);
            const group = match?.muscleGroup || resolveGroup(norm, "Άλλο");
            if (STRICT_GROUPS.includes(group)) result.add(group);
        });
        return result;
    }

    function getWeekendCarryover() {
        const store = safeJson(localStorage.getItem("pegasus_weekend_carryover_v1"), { weeks: {} }) || { weeks: {} };
        const weekKey = getWeekKey();
        const entry = store.weeks?.[weekKey] || null;
        const groups = emptyGroups(0);
        if (entry?.groups && typeof entry.groups === "object") {
            STRICT_GROUPS.forEach(group => {
                const value = Number(entry.groups[group]);
                groups[group] = Number.isFinite(value) ? Math.max(0, value) : 0;
            });
        }
        return { weekKey, groups, raw: entry };
    }

    function dateAliasesFromDate(date) {
        const d = date instanceof Date ? new Date(date) : dateFromKey(date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const m = String(d.getMonth() + 1);
        const day = String(d.getDate());
        return [`${yyyy}-${mm}-${dd}`, `${dd}/${mm}/${yyyy}`, `${day}/${m}/${yyyy}`, `${yyyy}${mm}${dd}`];
    }

    function readMaxNumber(prefixes, aliases) {
        let max = 0;
        prefixes.forEach(prefix => {
            aliases.forEach(alias => {
                const value = Number(localStorage.getItem(prefix + alias));
                if (Number.isFinite(value) && value > max) max = value;
            });
        });
        return max;
    }

    function getCycleDatesForWeek(weekKey = getWeekKey()) {
        const saturday = dateFromKey(weekKey);
        return Array.from({ length: 7 }, (_, index) => addDays(saturday, index));
    }

    function entryMatchesDate(entry, aliases) {
        const text = JSON.stringify(entry || {});
        return aliases.some(alias => text.includes(alias));
    }

    function getCurrentWeekWeekendCyclingLoad() {
        const weekKey = getWeekKey();
        const cycleDates = getCycleDatesForWeek(weekKey);
        const kcalPrefixes = ["pegasus_cardio_kcal_", "pegasus_cardio_offset_sets_"];
        const kmPrefixes = ["pegasus_cardio_km_", "pegasus_cardio_distance_", "pegasus_cardio_kilometers_"];
        let totalKcal = 0;
        let totalKm = 0;
        let entries = 0;

        cycleDates.forEach(date => {
            const aliases = dateAliasesFromDate(date);
            totalKcal += readMaxNumber(kcalPrefixes, aliases);
            totalKm += readMaxNumber(kmPrefixes, aliases);
        });

        const history = safeJson(localStorage.getItem("pegasus_cardio_history"), []);
        if (Array.isArray(history)) {
            cycleDates.forEach(date => {
                const aliases = dateAliasesFromDate(date);
                history.forEach(entry => {
                    if (!entryMatchesDate(entry, aliases)) return;
                    const typeText = `${entry?.type || ""} ${entry?.activity || ""} ${entry?.mode || ""}`.toLowerCase();
                    if (typeText && !/(cycling|bike|ποδηλα)/i.test(typeText)) return;
                    const km = Number(entry?.km ?? entry?.distance ?? entry?.distanceKm ?? entry?.kilometers ?? 0) || 0;
                    const kcal = Number(entry?.kcal ?? entry?.calories ?? entry?.cardioKcal ?? entry?.burnedKcal ?? 0) || 0;
                    if (km > 0 || kcal > 0) {
                        totalKm += km;
                        totalKcal += kcal;
                        entries += 1;
                    }
                });
            });
        }

        const hasCycling = totalKm >= 10 || totalKcal >= 300 || entries > 0;
        return { hasCycling, totalKm, totalKcal, entries, weekKey };
    }

    function canTrainLegsOnDay(day) {
        const cyclingLoad = getCurrentWeekWeekendCyclingLoad();
        // If any cycling exists in the current cycle, legs are covered by cycling.
        // If there is no cycling, legs are allowed only on Wednesday.
        return !cyclingLoad.hasCycling && day === "Τετάρτη";
    }

    function getWeekendMode(day) {
        if (!WEEKEND_DAYS.has(day)) return "core";
        const today = window.getPegasusLocalDateKey ? window.getPegasusLocalDateKey() : normalizeGreekDate();
        const dateKey = (getDayName(today) === day) ? today : normalizeGreekDate();
        const datedKey = `pegasus_weekend_training_mode_${dateKey}`;
        return localStorage.getItem(datedKey) || localStorage.getItem(`pegasus_weekend_training_mode_${day}`) || "bike";
    }

    function setWeekendMode(day, mode) {
        if (!WEEKEND_DAYS.has(day)) return;
        const allowed = ["bike", "bike_weights", "weights"];
        const next = allowed.includes(mode) ? mode : "bike";
        const today = window.getPegasusLocalDateKey ? window.getPegasusLocalDateKey() : normalizeGreekDate();
        const dateKey = (getDayName(today) === day) ? today : normalizeGreekDate();
        localStorage.setItem(`pegasus_weekend_training_mode_${dateKey}`, next);
        localStorage.setItem(`pegasus_weekend_training_mode_${day}`, next);
        if (window.PegasusCloud?.push) {
            try { window.PegasusCloud.push(true); } catch (e) {}
        }
    }

    function getPlannedTemplateGroups(day) {
        if (RECOVERY_DAYS.has(day)) return [];
        const mode = getWeekendMode(day);
        if (WEEKEND_DAYS.has(day) && mode === "bike") return [];
        const blueprint = resolveSessionBlueprint(day, canTrainLegsOnDay(day), mode);
        return blueprint.map(([group]) => group);
    }

    function getPreviousDateKeyForDay(day) {
        const today = window.getPegasusLocalDateKey ? window.getPegasusLocalDateKey() : normalizeGreekDate();
        const todayName = getDayName(today);
        const targetIdx = DAY_INDEX[day];
        const todayIdx = DAY_INDEX[todayName];
        if (typeof targetIdx !== "number" || typeof todayIdx !== "number") return normalizeGreekDate(addDays(today, -1));
        const diff = targetIdx - todayIdx;
        const targetDate = addDays(today, diff);
        return normalizeGreekDate(addDays(targetDate, -1));
    }

    function getBlockedGroups(day) {
        const blocked = new Set();
        const prevDateKey = getPreviousDateKeyForDay(day);
        getGroupsFromLedgerDate(prevDateKey).forEach(group => blocked.add(group));
        return blocked;
    }

    function computeRemaining({ includeCarryover = true } = {}) {
        const targets = getTargets();
        const history = getHistory();
        const carry = includeCarryover ? getWeekendCarryover().groups : emptyGroups(0);
        const weekendCycling = getCurrentWeekWeekendCyclingLoad();
        const remaining = emptyGroups(0);
        STRICT_GROUPS.forEach(group => {
            const target = Math.max(0, Number(targets[group]) || 0);
            let done = Math.max(0, Number(history[group]) || 0);
            if (group === "Πόδια" && weekendCycling.hasCycling) done = Math.max(done, target);
            const carried = Math.max(0, Number(carry[group]) || 0);
            remaining[group] = Math.max(0, target - done - carried);
        });
        return { targets, history, carry, remaining, weekendCycling };
    }

    function getSessionLimit(day, mode) {
        // 45-minute target: 10s prep + 45s work + 60s rest ≈ 115s/block.
        if (day === "Τρίτη" || day === "Τετάρτη" || day === "Παρασκευή") return 22;
        if (day === "Σάββατο" || day === "Κυριακή") {
            if (mode === "bike_weights") return 12;
            if (mode === "weights") return 18;
            return 0;
        }
        return 0;
    }

    function getTimerSeconds() {
        const workoutKeys = window.PegasusManifest?.workout || {};
        const work = Math.max(10, Math.min(120, parseInt(localStorage.getItem(workoutKeys.ex_time || "pegasus_ex_time"), 10) || 45));
        const rest = Math.max(10, Math.min(180, parseInt(localStorage.getItem(workoutKeys.rest_time || "pegasus_rest_time"), 10) || 60));
        return { prep: 10, work, rest, block: 10 + work + rest };
    }

    function getMinimumSetBlocks(day, mode) {
        if (RECOVERY_DAYS.has(day)) return 0;
        if (WEEKEND_DAYS.has(day) && mode === "bike") return 0;
        const limit = getSessionLimit(day, mode);
        if (limit <= 0) return 0;
        const timer = getTimerSeconds();
        return Math.min(limit, Math.max(1, Math.ceil((MIN_WORKOUT_MINUTES * 60) / Math.max(30, timer.block))));
    }

    function getSetTotal(list) {
        return (Array.isArray(list) ? list : []).reduce((sum, ex) => sum + Math.max(0, Math.round(Number(ex?.sets) || 0)), 0);
    }

    function addOrTopUpExercise(list, name, group, addSets, reason) {
        const cleanName = String(name || "").trim();
        const amount = Math.max(0, Math.round(Number(addSets) || 0));
        if (!cleanName || amount <= 0) return 0;
        const existing = list.find(ex => String(ex?.name || "").trim() === cleanName);
        if (existing) {
            existing.sets = Math.max(0, Math.round(Number(existing.sets) || 0)) + amount;
            existing.brainReason = `${existing.brainReason || ""} · ${reason || "40λεπτο συμπλήρωμα"}`.trim();
        } else {
            list.push({
                name: cleanName,
                sets: amount,
                muscleGroup: group,
                weight: weightFor(cleanName),
                brainManaged: true,
                brainMinimumTopUp: true,
                brainReason: reason || "40λεπτο συμπλήρωμα",
                brainOrder: list.length
            });
        }
        return amount;
    }

    function enforceMinimumWorkoutDuration(day, list, blueprint, blocked, limit, allowLegs, mode) {
        if (!Array.isArray(list) || !blueprint?.length) return list;
        const minimumBlocks = getMinimumSetBlocks(day, mode);
        if (minimumBlocks <= 0) return list;
        let currentBlocks = getSetTotal(list);
        if (currentBlocks >= minimumBlocks) return list;

        const allowedBlueprint = blueprint.filter(([group]) => {
            if (group === "Πόδια" && !allowLegs) return false;
            if (blocked?.has?.(group)) return false;
            return STRICT_GROUPS.includes(group);
        });

        // First pass: add missing exercises from the planned day groups, up to 4 sets each.
        for (const [group] of allowedBlueprint) {
            if (currentBlocks >= minimumBlocks || currentBlocks >= limit) break;
            const names = (templatesByDay[day]?.[group] || defaultTemplates[group]?.map(ex => ex.name) || []);
            for (const name of names) {
                if (currentBlocks >= minimumBlocks || currentBlocks >= limit) break;
                const exists = list.some(ex => String(ex?.name || "").trim() === name);
                if (exists) continue;
                const add = Math.min(4, minimumBlocks - currentBlocks, limit - currentBlocks);
                currentBlocks += addOrTopUpExercise(list, name, group, add, `Ελάχιστη διάρκεια ${MIN_WORKOUT_MINUTES} λεπτών`);
            }
        }

        // Second pass: top up existing rows to 4 sets before making anything very long.
        for (const ex of list) {
            if (currentBlocks >= minimumBlocks || currentBlocks >= limit) break;
            const group = ex?.muscleGroup || resolveGroup(ex?.name, "Άλλο");
            if (group === "Πόδια" && !allowLegs) continue;
            if (!STRICT_GROUPS.includes(group)) continue;
            const current = Math.max(0, Math.round(Number(ex.sets) || 0));
            const room = Math.max(0, 4 - current);
            if (room <= 0) continue;
            const add = Math.min(room, minimumBlocks - currentBlocks, limit - currentBlocks);
            ex.sets = current + add;
            ex.brainMinimumTopUp = true;
            ex.brainReason = `${ex.brainReason || ""} · Ελάχιστη διάρκεια ${MIN_WORKOUT_MINUTES} λεπτών`.trim();
            currentBlocks += add;
        }

        // Final pass: if the week is almost complete and only a few exercises exist, allow 5-set rows.
        for (const ex of list) {
            if (currentBlocks >= minimumBlocks || currentBlocks >= limit) break;
            const group = ex?.muscleGroup || resolveGroup(ex?.name, "Άλλο");
            if (group === "Πόδια" && !allowLegs) continue;
            if (!STRICT_GROUPS.includes(group)) continue;
            const current = Math.max(0, Math.round(Number(ex.sets) || 0));
            const room = Math.max(0, 5 - current);
            if (room <= 0) continue;
            const add = Math.min(room, minimumBlocks - currentBlocks, limit - currentBlocks);
            ex.sets = current + add;
            ex.brainMinimumTopUp = true;
            ex.brainReason = `${ex.brainReason || ""} · Ελάχιστη διάρκεια ${MIN_WORKOUT_MINUTES} λεπτών`.trim();
            currentBlocks += add;
        }

        return list;
    }

    function resolveSessionBlueprint(day, allowLegs, mode) {
        if (day === "Τετάρτη") return sessionBlueprints[allowLegs ? "Τετάρτη_LEGS" : "Τετάρτη_CYCLING"];
        if (day === "Σάββατο") return sessionBlueprints[mode === "bike_weights" ? "Σάββατο_BIKE_WEIGHTS" : "Σάββατο_WEIGHTS"];
        if (day === "Κυριακή") return sessionBlueprints[mode === "bike_weights" ? "Κυριακή_BIKE_WEIGHTS" : "Κυριακή_WEIGHTS"];
        return sessionBlueprints[day] || [];
    }

    function getExerciseKind(ex) {
        const meta = exerciseMeta[ex?.name || ""];
        if (meta?.kind) return meta.kind;
        const name = normalizedName(ex?.name || "");
        const weight = Number(ex?.weight);
        const floorNames = new Set(["pushups", "plank", "legraisehiplift", "lyingkneeraise", "reversecrunch", "situps", "stretching"]);
        if (floorNames.has(name)) return "floor";
        if ((ex?.muscleGroup === "Κορμός" || ex?.muscleGroup === "None") && (!Number.isFinite(weight) || weight <= 0)) return "floor";
        return "weighted";
    }

    function getExerciseFamily(ex) {
        return exerciseMeta[ex?.name || ""]?.family || normalizedName(ex?.name || "");
    }

    function getExerciseStation(ex) {
        return exerciseMeta[ex?.name || ""]?.station || getExerciseKind(ex);
    }

    function splitSets(setsNeeded, names, group) {
        const total = Math.max(0, Math.round(setsNeeded));
        if (total <= 0 || !names.length) return [];

        // PEGASUS 215: keep fewer exercises with meaningful volume.
        // Example: 12 chest sets -> 4/4/4, 7 arm sets -> 4/3.
        // This fixes the old "2 sets from every exercise" feeling.
        const count = Math.min(names.length, Math.max(1, Math.ceil(total / 4)));
        const chosen = names.slice(0, count);
        const base = Math.floor(total / count);
        let extra = total % count;
        return chosen.map(name => {
            const sets = base + (extra > 0 ? 1 : 0);
            extra -= 1;
            return { name, sets, muscleGroup: group, weight: weightFor(name) };
        }).filter(ex => ex.sets > 0);
    }

    function chooseExercisesForGroup(group, setsNeeded, context) {
        const names = (templatesByDay[context.day]?.[group] || defaultTemplates[group]?.map(ex => ex.name) || []).slice();
        if (!names.length || setsNeeded <= 0) return [];
        return splitSets(setsNeeded, names, group);
    }

    function removeConflictingRowVariations(list) {
        const hasLow = list.some(ex => ex.name === "Low Rows Seated");
        if (!hasLow) return list;
        return list.filter(ex => ex.name !== "Reverse Grip Cable Row");
    }

    function mergeDuplicateExerciseNames(list) {
        const map = new Map();
        (Array.isArray(list) ? list : []).forEach(ex => {
            const key = String(ex?.name || "").trim();
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, { ...ex, sets: Math.max(0, Number(ex.sets) || 0) });
            } else {
                const existing = map.get(key);
                existing.sets = Math.max(0, Number(existing.sets) || 0) + Math.max(0, Number(ex.sets) || 0);
                existing.brainReason = `${existing.brainReason || ""} + ${ex.brainReason || ""}`.trim();
            }
        });
        return Array.from(map.values()).filter(ex => ex.sets > 0);
    }

    function balanceExerciseOrder(list) {
        const pending = removeConflictingRowVariations(Array.isArray(list) ? list : [])
            .map((ex, index) => ({ ...ex, __originalOrder: index }));
        if (pending.length <= 2) return pending.map(({ __originalOrder, ...ex }) => ex);

        const result = [];
        const runLength = (kind) => {
            let count = 0;
            for (let i = result.length - 1; i >= 0; i--) {
                if (getExerciseKind(result[i]) !== kind) break;
                count += 1;
            }
            return count;
        };

        while (pending.length) {
            const last = result[result.length - 1] || null;
            const beforeLast = result[result.length - 2] || null;
            let bestIndex = 0;
            let bestScore = Infinity;

            pending.forEach((ex, index) => {
                const kind = getExerciseKind(ex);
                const family = getExerciseFamily(ex);
                const station = getExerciseStation(ex);
                let score = 0;

                if (last) {
                    const lastKind = getExerciseKind(last);
                    if (kind === lastKind) score += 12;
                    if (runLength(kind) >= 2) score += 220;
                    if (ex.muscleGroup && ex.muscleGroup === last.muscleGroup) score += 100;
                    if (family && family === getExerciseFamily(last)) score += 140;
                    if (station && station === getExerciseStation(last)) score += 10; // avoid same setup when muscles also collide
                    if (kind !== lastKind) score -= 14;
                }

                if (beforeLast) {
                    if (ex.muscleGroup && ex.muscleGroup === beforeLast.muscleGroup) score += 25;
                    if (family && family === getExerciseFamily(beforeLast)) score += 45;
                }

                if (kind === "floor" && last && getExerciseKind(last) === "weighted") score -= 10;
                if (kind === "weighted" && last && getExerciseKind(last) === "floor") score -= 10;
                score += (ex.__originalOrder || 0) * 0.01;

                if (score < bestScore) {
                    bestScore = score;
                    bestIndex = index;
                }
            });

            result.push(pending.splice(bestIndex, 1)[0]);
        }

        return result.map(({ __originalOrder, ...ex }) => ex);
    }

    function buildFromBlueprint(day, blueprint, remaining, blocked, limit, allowLegs, mode) {
        const exercises = [];
        let allocated = 0;

        blueprint.forEach(([group, desired]) => {
            if (allocated >= limit) return;
            if (group === "Πόδια" && !allowLegs) return;
            if (blocked.has(group)) return;
            const need = Math.max(0, Math.round(remaining[group] || 0));
            if (need <= 0) return;
            const toAllocate = Math.min(desired, need, Math.max(0, limit - allocated));
            if (toAllocate <= 0) return;
            chooseExercisesForGroup(group, toAllocate, { day, mode }).forEach(ex => {
                exercises.push({
                    ...ex,
                    brainManaged: true,
                    brainReason: `${group}: MS-600 στόχος ${desired}, λείπουν ${need}, δόθηκαν ${toAllocate}`,
                    brainOrder: exercises.length
                });
            });
            allocated += toAllocate;
        });

        // PEGASUS 215: no broad top-up across all muscles.
        // Focused split days are intentional; if weekly targets are almost complete,
        // the day can become lighter instead of adding 2-set fillers from everything.

        return exercises;
    }

    function getDailyWorkout(day, options = {}) {
        if (RECOVERY_DAYS.has(day)) {
            return [{ name: "Stretching", sets: 1, muscleGroup: "None", weight: "0", brainReason: "recovery-day", brainOrder: 0 }];
        }

        const mode = getWeekendMode(day);
        if (WEEKEND_DAYS.has(day) && mode === "bike") return [];

        const fixedMain = cloneClassicFixedWorkout(day);
        if (fixedMain) {
            return balanceExerciseOrder(fixedMain).map((ex, index) => ({
                ...ex,
                brainOrder: index,
                brainRestAware: true,
                brainEquipmentAware: true
            }));
        }

        const { remaining } = computeRemaining({ includeCarryover: true });
        // PEGASUS 220: the old previous-day recovery guard was too aggressive for
        // the focused IRON split. Tuesday PUSH logged "Χέρια" and "Κορμός", so
        // Wednesday PULL could collapse to only 12 back sets. Main split days must
        // keep their planned accessories; rest is handled by the split/order itself.
        const blocked = (day === "Τρίτη" || day === "Τετάρτη" || day === "Παρασκευή")
            ? new Set()
            : getBlockedGroups(day);
        const allowLegs = canTrainLegsOnDay(day);
        const limit = getSessionLimit(day, mode);
        const blueprint = resolveSessionBlueprint(day, allowLegs, mode);
        let exercises = buildFromBlueprint(day, blueprint, remaining, blocked, limit, allowLegs, mode);
        exercises = enforceMinimumWorkoutDuration(day, exercises, blueprint, blocked, limit, allowLegs, mode);

        if (options.isRainy && WEEKEND_DAYS.has(day) && !exercises.length) {
            exercises = [
                { name: "Chest Press", sets: 4, muscleGroup: "Στήθος", weight: weightFor("Chest Press"), brainManaged: true, brainOrder: 0 },
                { name: "Seated Rows", sets: 4, muscleGroup: "Πλάτη", weight: weightFor("Seated Rows"), brainManaged: true, brainOrder: 1 },
                { name: "Ab Crunches", sets: 3, muscleGroup: "Κορμός", weight: weightFor("Ab Crunches"), brainManaged: true, brainOrder: 2 }
            ];
        }

        exercises = mergeDuplicateExerciseNames(exercises);

        return balanceExerciseOrder(exercises).map((ex, index) => ({
            ...ex,
            brainOrder: index,
            brainRestAware: true,
            brainEquipmentAware: true
        }));
    }

    function recordWeekendCarryover(exName, muscle, setValue, dateKey = null) {
        const todayKey = dateKey || (window.getPegasusLocalDateKey ? window.getPegasusLocalDateKey() : normalizeGreekDate());
        const dayName = getDayName(todayKey);
        if (!WEEKEND_DAYS.has(dayName)) return false;

        const group = STRICT_GROUPS.includes(muscle) ? muscle : resolveGroup(exName, "Άλλο");
        if (!STRICT_GROUPS.includes(group)) return false;

        const value = Math.max(0, Number(setValue) || 0);
        if (value <= 0) return false;

        const nextWeekKey = getNextWeekKey(todayKey);
        const store = safeJson(localStorage.getItem("pegasus_weekend_carryover_v1"), { weeks: {} }) || { weeks: {} };
        if (!store.weeks || typeof store.weeks !== "object") store.weeks = {};
        if (!store.weeks[nextWeekKey]) store.weeks[nextWeekKey] = { weekKey: nextWeekKey, groups: emptyGroups(0), dates: {}, updatedAt: Date.now() };
        const entry = store.weeks[nextWeekKey];
        if (!entry.groups || typeof entry.groups !== "object") entry.groups = emptyGroups(0);
        if (!entry.dates || typeof entry.dates !== "object") entry.dates = {};
        if (!entry.dates[todayKey]) entry.dates[todayKey] = emptyGroups(0);

        entry.groups[group] = Math.max(0, Number(entry.groups[group] || 0)) + value;
        entry.dates[todayKey][group] = Math.max(0, Number(entry.dates[todayKey][group] || 0)) + value;
        entry.updatedAt = Date.now();
        entry.sourceWeekKey = getWeekKey(todayKey);
        store.updatedAt = Date.now();

        Object.keys(store.weeks).forEach(key => {
            const ageDays = (new Date() - dateFromKey(key)) / 86400000;
            if (ageDays > 21) delete store.weeks[key];
        });

        localStorage.setItem("pegasus_weekend_carryover_v1", JSON.stringify(store));
        return true;
    }

    function renderWeekendModePanel(day, container, onChange) {
        if (!WEEKEND_DAYS.has(day) || !container) return;
        const mode = getWeekendMode(day);
        const panel = document.createElement("div");
        panel.className = "pegasus-weekend-mode-panel";
        panel.innerHTML = `
            <div class="pegasus-weekend-mode-title">Σ/Κ</div>
            <div class="pegasus-weekend-mode-options">
                <button type="button" data-mode="bike" class="${mode === "bike" ? "active" : ""}">🚴 Ποδήλατο</button>
                <button type="button" data-mode="bike_weights" class="${mode === "bike_weights" ? "active" : ""}">⚡ Ποδ. + βάρη</button>
                <button type="button" data-mode="weights" class="${mode === "weights" ? "active" : ""}">🏋️ Βάρη</button>
            </div>
        `;
        panel.querySelectorAll("button[data-mode]").forEach(btn => {
            btn.addEventListener("click", () => {
                setWeekendMode(day, btn.dataset.mode);
                if (typeof onChange === "function") onChange();
            });
        });
        container.appendChild(panel);
    }

    function isManagedDay(day) {
        return ["Τρίτη", "Τετάρτη", "Παρασκευή", "Σάββατο", "Κυριακή", "Δευτέρα", "Πέμπτη"].includes(day);
    }

    window.PegasusBrain = {
        version: "1.0.299",
        groups: STRICT_GROUPS.slice(),
        getWeekKey,
        getNextWeekKey,
        getDayName,
        getTargets,
        getHistory,
        getWeekendMode,
        setWeekendMode,
        getWeekendCarryover,
        getCurrentWeekWeekendCyclingLoad,
        canTrainLegsOnDay,
        computeRemaining,
        getDailyWorkout,
        recordWeekendCarryover,
        renderWeekendModePanel,
        isManagedDay
    };

    console.log("🧠 PEGASUS BRAIN: MS-600 planner active (v1.0.299, classic fixed Tue/Wed/Fri 40-min split).");
})();
