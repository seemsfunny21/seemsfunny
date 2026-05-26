/* ======================================================================
   PEGASUS MOBILE LIFTING - Workout Weight Mirror Library (v1.6.293)
   Purpose: show current workout exercises + saved weights, keep manual log
   ====================================================================== */
(function() {
    "use strict";

    const LIFTING_DATA_KEY = "pegasus_lifting_v1";
    const EXERCISE_WEIGHTS_KEY = "pegasus_exercise_weights";
    const DAILY_PROGRESS_KEY = "pegasus_daily_progress";
    const LAST_STRENGTH_ROWS_KEY = "pegasus_mobile_lifting_last_strength_rows_v1";
    const DAY_NAMES = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

    function safeReadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed ?? fallback;
        } catch (e) {
            return fallback;
        }
    }

    function safeWriteJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>'"]/g, ch => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"
        }[ch]));
    }

    function getDateDisplay() {
        return new Date().toLocaleDateString('el-GR');
    }

    function getDateKey() {
        if (typeof window.getPegasusLocalDateKey === "function") {
            return window.getPegasusLocalDateKey();
        }
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function normalizeExerciseName(name) {
        return String(name || "").trim();
    }

    function compactExerciseName(name) {
        return normalizeExerciseName(name)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\p{L}\p{N}]+/gu, "")
            .toLowerCase();
    }


    function getExerciseImageCandidates(name) {
        const raw = normalizeExerciseName(name);
        const bases = [];
        const seenBases = new Set();

        const addBase = (value) => {
            const clean = String(value || "").trim();
            if (!clean) return;
            const key = clean.toLowerCase();
            if (seenBases.has(key)) return;
            seenBases.add(key);
            bases.push(clean);
        };

        const addMapped = (value) => {
            const clean = normalizeExerciseName(value);
            if (!clean) return;
            if (window.videoMap && window.videoMap[clean]) addBase(window.videoMap[clean]);
            addBase(clean.replace(/\s+/g, "").toLowerCase());
            addBase(clean.toLowerCase().replace(/[^a-z0-9\u0370-\u03ff]+/g, "-"));
        };

        addMapped(raw);
        getExerciseAliasSet(raw).forEach(addMapped);

        const urls = [];
        const seenUrls = new Set();
        const addUrl = (url) => {
            const clean = String(url || "").trim();
            if (!clean || seenUrls.has(clean)) return;
            seenUrls.add(clean);
            urls.push(clean);
        };

        bases.forEach(base => {
            const clean = String(base || "").replace(/^\.\.\/images\//, "").replace(/^images\//, "");
            if (!clean) return;
            const hasExtension = /\.(png|jpe?g|webp|gif|svg)$/i.test(clean);
            if (hasExtension) {
                addUrl(`../images/${clean}`);
                return;
            }
            addUrl(`../images/${clean}.webp`);
            addUrl(`../images/${clean}.png`);
            addUrl(`../images/${clean}.jpg`);
            addUrl(`../images/${clean}.jpeg`);
        });

        addUrl("../images/placeholder.jpg");
        addUrl("../images/favicon.png");
        return urls;
    }

    function getExerciseThumbFallbackSvg(name) {
        const label = String(name || "P").trim().slice(0, 1).toUpperCase() || "P";
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
                <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="#00ff41" stop-opacity="0.28"/>
                        <stop offset="1" stop-color="#071107" stop-opacity="1"/>
                    </linearGradient>
                </defs>
                <rect width="96" height="96" rx="22" fill="#050805"/>
                <rect x="5" y="5" width="86" height="86" rx="19" fill="url(#g)" stroke="#00ff41" stroke-opacity="0.42"/>
                <path d="M20 49h10m36 0h10M31 40v18m34-18v18M37 45h22v8H37z" stroke="#d9ffe2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.95"/>
                <text x="48" y="79" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#00ff41">${escapeHtml(label)}</text>
            </svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function renderExerciseThumb(name) {
        const candidates = getExerciseImageCandidates(name);
        const first = candidates[0] || getExerciseThumbFallbackSvg(name);
        return `
            <button type="button" class="pegasus-ex-thumb" aria-label="Μεγέθυνση εικόνας ${escapeHtml(name)}" data-thumb-name="${escapeHtml(name)}">
                <img src="${escapeHtml(first)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async" data-thumb-index="0" data-thumb-name="${escapeHtml(name)}" data-thumb-candidates="${escapeHtml(candidates.join('|'))}">
            </button>`;
    }

    function handleExerciseThumbError(img) {
        if (!img) return;
        const candidates = String(img.dataset.thumbCandidates || "").split("|").filter(Boolean);
        const current = Number(img.dataset.thumbIndex || 0) || 0;
        const next = current + 1;
        if (next < candidates.length) {
            img.dataset.thumbIndex = String(next);
            img.src = candidates[next];
            return;
        }
        img.onerror = null;
        img.src = getExerciseThumbFallbackSvg(img.dataset.thumbName || "Pegasus");
        img.classList.add("is-placeholder");
    }

    function openExerciseThumbZoom(img) {
        if (!img) return;
        const name = img.dataset.thumbName || img.alt || "Άσκηση";
        const src = img.currentSrc || img.src || getExerciseThumbFallbackSvg(name);
        const existing = document.getElementById("pegasusExerciseZoomOverlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.id = "pegasusExerciseZoomOverlay";
        overlay.className = "pegasus-ex-zoom-overlay";
        overlay.innerHTML = `
            <div class="pegasus-ex-zoom-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(name)}">
                <button type="button" class="pegasus-ex-zoom-close" aria-label="Κλείσιμο">×</button>
                <img class="pegasus-ex-zoom-img" src="${escapeHtml(src)}" alt="${escapeHtml(name)}">
                <div class="pegasus-ex-zoom-title">${escapeHtml(name)}</div>
            </div>`;

        const close = () => overlay.remove();
        overlay.addEventListener("click", event => {
            if (event.target === overlay || event.target.closest(".pegasus-ex-zoom-close")) close();
        });
        document.addEventListener("keydown", function onKey(event) {
            if (event.key === "Escape") {
                close();
                document.removeEventListener("keydown", onKey);
            }
        });
        document.body.appendChild(overlay);
    }

    function bindExerciseThumbs(container) {
        if (!container) return;
        container.querySelectorAll('.pegasus-ex-thumb img').forEach(img => {
            img.onerror = () => handleExerciseThumbError(img);
        });
        container.querySelectorAll('.pegasus-ex-thumb').forEach(button => {
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const img = button.querySelector('img');
                openExerciseThumbZoom(img);
            });
        });
    }

    function isRealPositiveWeight(value) {
        const text = String(value ?? "").trim();
        if (!text) return false;
        const n = Number(text.replace(",", "."));
        return Number.isFinite(n) && n > 0;
    }

    function normalizeWeightValue(value) {
        if (!isRealPositiveWeight(value)) return "";
        const text = String(value ?? "").trim().replace(",", ".");
        const n = Number(text);
        return Number.isInteger(n) ? String(n) : String(n);
    }

    const WEIGHT_ALIAS_PAIRS = [
        ["LowSeatedRow", "Low Rows Seated"],
        ["LowRowsSeated", "Low Rows Seated"],
        ["ReverseSeatedRows", "Reverse Grip Cable Row"],
        ["ReverseGripCableRow", "Reverse Grip Cable Row"],
        ["ReverseGripRows", "Reverse Grip Cable Row"],
        ["SeatedRows", "Low Rows Seated"],
        ["LatPulldowns", "Lat Pulldowns"],
        ["LatPulldown", "Lat Pulldowns"],
        ["WidePulldowns", "Wide Pulldowns"],
        ["BehindtheNeckPulldown", "Behind the Neck Pulldown"],
        ["BehindTheNeckPulldown", "Behind the Neck Pulldown"],
        ["ChestPress", "Chest Press"],
        ["ChestFlys", "Chest Flys"],
        ["ChestFly", "Chest Flys"],
        ["TricepPulldowns", "Tricep Pulldowns"],
        ["TricepsPulldowns", "Tricep Pulldowns"],
        ["BicepCurls", "Bicep Curls"],
        ["PreacherBicepCurls", "Preacher Bicep Curls"],
        ["UprightRows", "Upright Rows"],
        ["BentOverRows", "Bent Over Rows"],
        ["AbCrunches", "Ab Crunches"],
        ["LyingKneeRaise", "Lying Knee Raise"],
        ["LegRaiseHipLift", "Leg Raise Hip Lift"],
        ["LegExtensions", "Leg Extensions"],
        ["Pushups", "Pushups"],
        ["PushUps", "Pushups"],
        ["Situps", "Situps"],
        ["SitUps", "Situps"],
        ["StraightArmPulldowns", "Straight Arm Pulldowns"]
    ];

    const WEIGHT_ALIAS_BY_COMPACT = (() => {
        const map = Object.create(null);
        WEIGHT_ALIAS_PAIRS.forEach(([alias, canonical]) => {
            const aliasCompact = compactExerciseName(alias);
            const canonicalCompact = compactExerciseName(canonical);
            map[aliasCompact] = canonicalCompact;
            map[canonicalCompact] = canonicalCompact;
        });
        return map;
    })();

    function canonicalCompactName(name) {
        const compact = compactExerciseName(name);
        return WEIGHT_ALIAS_BY_COMPACT[compact] || compact;
    }

    function getExerciseAliasSet(name) {
        const raw = normalizeExerciseName(name);
        const compact = compactExerciseName(raw);
        const canonicalCompact = canonicalCompactName(raw);
        const out = new Set([raw, compact, canonicalCompact]);

        WEIGHT_ALIAS_PAIRS.forEach(([alias, canonical]) => {
            const aliasCompact = compactExerciseName(alias);
            const canonicalNameCompact = compactExerciseName(canonical);
            if (aliasCompact === compact || canonicalNameCompact === compact || aliasCompact === canonicalCompact || canonicalNameCompact === canonicalCompact) {
                out.add(alias);
                out.add(canonical);
                out.add(aliasCompact);
                out.add(canonicalNameCompact);
            }
        });

        return out;
    }

    function isLegacyTestEntry(entry) {
        const text = normalizeExerciseName(entry?.exercise || entry?.name).toLowerCase();
        if (!text) return true;
        return /(^|\s)(test|aa|αα)(\s|$)/i.test(text) || /τεστ|δοκιμ/.test(text);
    }

    function readLogs() {
        const data = safeReadJSON(LIFTING_DATA_KEY, []);
        return Array.isArray(data) ? data : [];
    }

    function writeLogs(logs) {
        safeWriteJSON(LIFTING_DATA_KEY, logs);
    }

    function cleanupLegacyTestData() {
        const logs = readLogs();
        const cleaned = logs.filter(entry => !isLegacyTestEntry(entry));
        if (cleaned.length !== logs.length) writeLogs(cleaned);
        return cleaned;
    }

    function getActiveLifterName() {
        try {
            if (typeof window.getActiveLifter === "function") {
                const lifter = normalizeExerciseName(window.getActiveLifter());
                if (lifter && !/^(aa|test|τεστ|δοκιμ)/i.test(lifter)) return lifter;
            }
        } catch (e) {}
        return "ΑΓΓΕΛΟΣ";
    }

    function getBestWeightProfile(allWeights) {
        const active = getActiveLifterName();
        const priority = [active, "ΑΓΓΕΛΟΣ", "ANGELOS", "default"];
        const seen = new Set();
        const profiles = [];

        priority.forEach(name => {
            if (name && !seen.has(name)) {
                seen.add(name);
                profiles.push(name);
            }
        });

        Object.keys(allWeights || {}).forEach(name => {
            if (name && !seen.has(name) && !/^(aa|test|τεστ|δοκιμ)/i.test(name)) {
                seen.add(name);
                profiles.push(name);
            }
        });

        profiles.sort((a, b) => {
            const ca = Object.values(allWeights?.[a] || {}).filter(isRealPositiveWeight).length;
            const cb = Object.values(allWeights?.[b] || {}).filter(isRealPositiveWeight).length;
            const pa = priority.includes(a) ? 10 : 0;
            const pb = priority.includes(b) ? 10 : 0;
            return (cb + pb) - (ca + pa);
        });

        return profiles;
    }

    function findWeightInObject(obj, exerciseName) {
        if (!obj || typeof obj !== "object") return "";
        const aliases = getExerciseAliasSet(exerciseName);
        const wanted = new Set([...aliases].map(canonicalCompactName));

        for (const key of Object.keys(obj)) {
            if (!isRealPositiveWeight(obj[key])) continue;
            if (key === exerciseName || aliases.has(key) || wanted.has(canonicalCompactName(key))) {
                return normalizeWeightValue(obj[key]);
            }
        }
        return "";
    }

    function readSavedWeight(exerciseName, fallback) {
        const cleanName = normalizeExerciseName(exerciseName);
        if (!cleanName) return isRealPositiveWeight(fallback) ? normalizeWeightValue(fallback) : "";

        const allWeights = safeReadJSON(EXERCISE_WEIGHTS_KEY, {});
        const profiles = getBestWeightProfile(allWeights);

        for (const profile of profiles) {
            const value = findWeightInObject(allWeights?.[profile], cleanName);
            if (isRealPositiveWeight(value)) return normalizeWeightValue(value);
        }

        const aliases = getExerciseAliasSet(cleanName);
        const profileNames = [getActiveLifterName(), "ΑΓΓΕΛΟΣ", "ANGELOS", "ΕΓΩ", "default"];
        const directKeys = [];

        profileNames.forEach(profile => {
            aliases.forEach(alias => {
                directKeys.push(`weight_${profile}_${alias}`);
                directKeys.push(`pegasus_weight_${profile}_${alias}`);
            });
        });
        aliases.forEach(alias => directKeys.push(`weight_${alias}`));

        for (const key of directKeys) {
            const raw = localStorage.getItem(key);
            if (isRealPositiveWeight(raw)) return normalizeWeightValue(raw);
        }

        const wanted = new Set([...aliases].map(canonicalCompactName));
        const scanned = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !/(^weight_|^pegasus_weight_)/i.test(key)) continue;
            if (/(^|_)aa_/i.test(key) || /test|τεστ|δοκιμ/i.test(key)) continue;
            const raw = localStorage.getItem(key);
            if (!isRealPositiveWeight(raw)) continue;
            const suffix = key.replace(/^pegasus_weight_[^_]+_/i, "").replace(/^weight_[^_]+_/i, "").replace(/^weight_/i, "");
            if (wanted.has(canonicalCompactName(suffix))) {
                scanned.push({ key, value: normalizeWeightValue(raw), priority: key.includes("ΑΓΓΕΛΟΣ") ? 2 : key.includes("ΕΓΩ") ? 1 : 0 });
            }
        }
        scanned.sort((a, b) => b.priority - a.priority);
        if (scanned[0]) return scanned[0].value;

        return isRealPositiveWeight(fallback) ? normalizeWeightValue(fallback) : "";
    }

    function writeWeightAliases(exerciseName, weight) {
        const cleanName = normalizeExerciseName(exerciseName);
        const value = normalizeWeightValue(weight);
        if (!cleanName || !value) return 0;

        const allWeights = safeReadJSON(EXERCISE_WEIGHTS_KEY, {});
        const active = getActiveLifterName();
        const profile = (allWeights?.[active] && Object.values(allWeights[active]).some(isRealPositiveWeight)) ? active : "ΑΓΓΕΛΟΣ";
        const aliases = getExerciseAliasSet(cleanName);
        const next = (allWeights && typeof allWeights === "object" && !Array.isArray(allWeights)) ? { ...allWeights } : {};
        next[profile] = { ...(next[profile] || {}) };

        if (!isRealPositiveWeight(next[profile][cleanName])) {
            next[profile][cleanName] = value;
        }

        let changed = 0;
        aliases.forEach(alias => {
            const compact = String(alias || "").replace(/[^\p{L}\p{N}]+/gu, "");
            const keys = [
                `weight_${profile}_${alias}`,
                `pegasus_weight_${profile}_${compact}`,
                `pegasus_weight_ΕΓΩ_${compact}`
            ];
            keys.forEach(key => {
                const current = localStorage.getItem(key);
                if (!isRealPositiveWeight(current)) {
                    localStorage.setItem(key, value);
                    changed++;
                }
            });
        });

        safeWriteJSON(EXERCISE_WEIGHTS_KEY, next);
        return changed;
    }

    function repairAllWeightAliases() {
        const allWeights = safeReadJSON(EXERCISE_WEIGHTS_KEY, {});
        const profiles = getBestWeightProfile(allWeights);
        let repaired = 0;

        for (const profile of profiles) {
            const data = allWeights?.[profile];
            if (!data || typeof data !== "object") continue;
            Object.entries(data).forEach(([exercise, weight]) => {
                if (isRealPositiveWeight(weight)) repaired += writeWeightAliases(exercise, weight);
            });
            if (Object.values(data).some(isRealPositiveWeight)) break;
        }

        const marker = `pegasus_lifting_weight_repair_v225_${getDateKey()}`;
        if (repaired > 0 || !localStorage.getItem(marker)) {
            localStorage.setItem(marker, JSON.stringify({ at: Date.now(), repaired }));
        }
        if (repaired > 0) console.log(`🏋️ PEGASUS MOBILE LIFTING: repaired ${repaired} weight alias keys.`);
        return repaired;
    }


    function getCanonicalDisplayName(name) {
        const raw = normalizeExerciseName(name);
        if (!raw) return "";
        const rawCompact = canonicalCompactName(raw);
        for (const [alias, canonical] of WEIGHT_ALIAS_PAIRS) {
            if (canonicalCompactName(alias) === rawCompact || canonicalCompactName(canonical) === rawCompact) {
                return canonical;
            }
        }
        // Convert compact legacy suffixes like ChestPress only when an exact alias was not found.
        return raw
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/_/g, " ")
            .trim();
    }

    function addSavedWeightRow(map, name, weight, options = {}) {
        const value = normalizeWeightValue(weight);
        const canonical = getCanonicalDisplayName(name);
        if (!canonical || !value || isLegacyTestEntry({ exercise: canonical })) return;
        const key = canonicalCompactName(canonical);
        const current = map.get(key);
        const nextPriority = Number(options.priority || 0);
        const currentPriority = Number(current?.priority || 0);
        const group = getExerciseGroup(canonical, options.group || current?.group || "--");
        if (!current || nextPriority >= currentPriority || !isRealPositiveWeight(current.weight)) {
            map.set(key, {
                name: canonical,
                group,
                sets: Number(options.sets || current?.sets || 0) || 0,
                done: Number(options.done || current?.done || 0) || 0,
                weight: value,
                source: options.source || current?.source || "saved",
                priority: nextPriority
            });
        }
    }

    function collectProgramExercises() {
        const rows = [];
        try {
            const program = window.program || {};
            Object.keys(program).forEach(day => {
                const list = Array.isArray(program[day]) ? program[day] : [];
                list.forEach((exercise, index) => {
                    if (!shouldShowWorkoutExercise(exercise)) return;
                    const name = normalizeExerciseName(exercise.name || exercise.exercise);
                    rows.push({
                        day,
                        index,
                        name,
                        group: getExerciseGroup(name, exercise.muscleGroup),
                        sets: Number(exercise.sets || exercise.targetSets || 0) || 0,
                        weight: exercise.weight || ""
                    });
                });
            });
        } catch (e) {}
        return rows;
    }

    function getSavedWeightRows(limit = 80) {
        const map = new Map();

        collectProgramExercises().forEach((exercise, index) => {
            const saved = readSavedWeight(exercise.name, exercise.weight || "");
            if (isRealPositiveWeight(saved)) {
                addSavedWeightRow(map, exercise.name, saved, {
                    group: exercise.group,
                    sets: exercise.sets,
                    source: "program",
                    priority: 80 - Math.min(index, 40)
                });
            }
        });

        const allWeights = safeReadJSON(EXERCISE_WEIGHTS_KEY, {});
        getBestWeightProfile(allWeights).forEach((profile, profileIndex) => {
            const data = allWeights?.[profile];
            if (!data || typeof data !== "object") return;
            Object.entries(data).forEach(([exercise, weight]) => {
                addSavedWeightRow(map, exercise, weight, {
                    source: profile,
                    priority: 60 - profileIndex
                });
            });
        });

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !/(^weight_|^pegasus_weight_)/i.test(key)) continue;
            if (/(^|_)aa_/i.test(key) || /test|τεστ|δοκιμ/i.test(key)) continue;
            const raw = localStorage.getItem(key);
            if (!isRealPositiveWeight(raw)) continue;
            const suffix = key
                .replace(/^pegasus_weight_[^_]+_/i, "")
                .replace(/^weight_[^_]+_/i, "")
                .replace(/^weight_/i, "");
            addSavedWeightRow(map, suffix, raw, {
                source: key.includes("ΑΓΓΕΛΟΣ") ? "legacy-angelos" : "legacy",
                priority: key.includes("ΑΓΓΕΛΟΣ") ? 55 : 45
            });
        }

        const rows = Array.from(map.values())
            .filter(row => isRealPositiveWeight(row.weight))
            .sort((a, b) => {
                const pa = Number(a.priority || 0);
                const pb = Number(b.priority || 0);
                if (pb !== pa) return pb - pa;
                return a.name.localeCompare(b.name, 'el');
            })
            .slice(0, limit)
            .map(({ priority, ...row }) => row);

        return rows;
    }

    function rememberStrengthRows(rows) {
        if (!Array.isArray(rows) || !rows.length) return;
        const withWeights = rows.filter(row => isRealPositiveWeight(row.weight));
        if (!withWeights.length) return;
        try {
            safeWriteJSON(LAST_STRENGTH_ROWS_KEY, {
                at: Date.now(),
                day: getSelectedDayName(),
                rows: withWeights.slice(0, 24)
            });
        } catch (e) {}
    }

    function readLastStrengthRows() {
        const payload = safeReadJSON(LAST_STRENGTH_ROWS_KEY, null);
        if (!payload || !Array.isArray(payload.rows)) return [];
        return payload.rows
            .filter(row => row && normalizeExerciseName(row.name) && isRealPositiveWeight(row.weight))
            .map(row => ({
                name: getCanonicalDisplayName(row.name),
                group: getExerciseGroup(row.name, row.group),
                sets: Number(row.sets || 0) || 0,
                done: Number(row.done || 0) || 0,
                weight: normalizeWeightValue(row.weight),
                source: "last-strength"
            }));
    }

    function getDisplayRowsForWorkout() {
        const selectedDay = getSelectedDayName();
        const planRows = getWorkoutExercises();
        if (planRows.length) {
            rememberStrengthRows(planRows);
            return { selectedDay, rows: planRows, mode: "plan" };
        }

        const savedRows = getSavedWeightRows(40);
        if (savedRows.length) {
            return { selectedDay, rows: savedRows, mode: "saved" };
        }

        const lastRows = readLastStrengthRows();
        if (lastRows.length) {
            return { selectedDay, rows: lastRows, mode: "last" };
        }

        return { selectedDay, rows: [], mode: "empty" };
    }

    function getSelectedDayName() {
        try {
            if (window.PegasusEngine && typeof window.PegasusEngine.getSnapshot === "function") {
                const snap = window.PegasusEngine.getSnapshot();
                if (snap?.workout?.selectedDay) return snap.workout.selectedDay;
            }
            if (window.PegasusEngine && typeof window.PegasusEngine.getSelectedDay === "function") {
                const day = window.PegasusEngine.getSelectedDay();
                if (day) return day;
            }
        } catch (e) {}
        return DAY_NAMES[new Date().getDay()];
    }

    function getExerciseGroup(name, fallback) {
        try {
            if (typeof window.getPegasusExerciseGroup === "function") {
                const group = window.getPegasusExerciseGroup(name);
                if (group && group !== "Unknown") return group;
            }
        } catch (e) {}
        return fallback || "--";
    }

    function shouldShowWorkoutExercise(exercise) {
        const name = normalizeExerciseName(exercise?.name || exercise?.exercise);
        if (!name || isLegacyTestEntry({ exercise: name })) return false;
        const group = String(exercise?.muscleGroup || getExerciseGroup(name, "")).toLowerCase();
        if (group === "none" || group === "--") return false;
        if (/cycling|ποδήλα|cardio|stretch|διατάσ|ems/i.test(name)) return false;
        return true;
    }

    function normalizeProgressName(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\u0370-\u03ff]+/g, '');
    }

    function getExerciseProgressKey(day, index, name) {
        const safeDay = String(day || '').trim() || 'day';
        const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
        return `${safeDay}|${safeIndex}|${normalizeProgressName(name)}`;
    }

    function dailyProgressHasInstanceKeys(daily) {
        const map = daily?.exercises && typeof daily.exercises === 'object' ? daily.exercises : {};
        return Object.keys(map).some(key => String(key).includes('|'));
    }

    function getTodayDoneSets(name, index, day) {
        const daily = safeReadJSON(DAILY_PROGRESS_KEY, {});
        const todayKey = getDateKey();
        const todayDisplay = getDateDisplay();
        const isToday = daily?.date === todayKey || daily?.date === todayDisplay;
        if (!isToday || !daily?.exercises) return 0;

        const instanceKey = getExerciseProgressKey(day || getSelectedDayName(), index, name);
        if (Object.prototype.hasOwnProperty.call(daily.exercises, instanceKey)) {
            return Number(daily.exercises[instanceKey] || 0) || 0;
        }

        if (!dailyProgressHasInstanceKeys(daily)) {
            return Number(daily.exercises[name] || 0) || 0;
        }

        return 0;
    }

    function getWorkoutExercises() {
        const selectedDay = getSelectedDayName();
        let raw = [];

        try {
            if (typeof window.getPegasusProgramSnapshot === "function") {
                raw = window.getPegasusProgramSnapshot(selectedDay) || [];
            } else if (window.program && Array.isArray(window.program[selectedDay])) {
                raw = window.program[selectedDay];
            }
        } catch (e) {
            raw = [];
        }

        return raw
            .filter(shouldShowWorkoutExercise)
            .map((exercise, index) => {
                const name = normalizeExerciseName(exercise.name || exercise.exercise);
                const sets = Number(exercise.sets || exercise.targetSets || 0) || 0;
                const weight = readSavedWeight(name, exercise.weight || "");
                return {
                    name,
                    group: getExerciseGroup(name, exercise.muscleGroup),
                    sets,
                    done: getTodayDoneSets(name, index, selectedDay),
                    weight
                };
            });
    }

    function prefillExercise(name, weight) {
        const nameInput = document.getElementById('liftName');
        const weightInput = document.getElementById('liftWeight');
        if (nameInput) nameInput.value = name || "";
        if (weightInput && weight !== undefined && weight !== null && String(weight).trim() !== "") {
            weightInput.value = weight;
        }
        document.getElementById('liftReps')?.focus();
    }

    function renderWorkoutPlan() {
        const container = document.getElementById('lift-plan');
        if (!container) return;

        const display = getDisplayRowsForWorkout();
        const selectedDay = display.selectedDay;
        const rows = display.rows;
        const mode = display.mode;

        if (!rows.length) {
            container.innerHTML = `
                <div style="padding: 12px; border: 1px dashed var(--border); border-radius: 12px; color: var(--muted); font-size: 11px; text-align: center;">
                    Δεν βρέθηκαν ασκήσεις ή αποθηκευμένα κιλά για ${escapeHtml(selectedDay)}.
                </div>`;
            return;
        }

        const notice = mode === "plan" ? "" : `
            <div style="padding:10px; margin-bottom:10px; border:1px solid rgba(0,255,65,0.25); border-radius:12px; background:rgba(0,255,65,0.07); color:var(--main); font-size:10px; font-weight:900; line-height:1.45;">
                ${mode === "last"
                    ? `Σήμερα (${escapeHtml(selectedDay)}) δεν έχει ασκήσεις με βάρη. Δείχνω την τελευταία διαθέσιμη προπόνηση με κιλά.`
                    : `Σήμερα (${escapeHtml(selectedDay)}) είναι χωρίς βάρη/αποθεραπεία. Τα κιλά δεν χάθηκαν — δείχνω τη βιβλιοθήκη αποθηκευμένων βαρών.`}
            </div>`;

        container.innerHTML = notice + rows.map((row, index) => {
            const doneTxt = row.sets ? `${row.done}/${row.sets}` : `${row.done || 0}`;
            const subTxt = mode === "plan"
                ? `${escapeHtml(row.group)} • Σετ σήμερα ${escapeHtml(doneTxt)}`
                : `${escapeHtml(row.group)} • Αποθηκευμένα κιλά`;
            const weightTxt = row.weight !== "" ? `${escapeHtml(row.weight)} kg` : "-- kg";
            return `
                <button class="lift-plan-row" data-index="${index}" style="width:100%; margin-bottom:8px; text-align:left; border:1px solid var(--border); background:rgba(0,255,65,0.05); color:#fff; border-radius:12px; padding:10px; display:flex; justify-content:space-between; gap:8px; align-items:center;">
                    <span style="display:flex; flex-direction:column; gap:3px; min-width:0;">
                        <b style="color:var(--main); font-size:12px; white-space:normal;">${escapeHtml(row.name)}</b>
                        <small style="color:var(--muted); font-size:9px;">${subTxt}</small>
                    </span>
                    <span style="font-size:13px; font-weight:900; color:#fff; white-space:nowrap;">${weightTxt}</span>
                </button>`;
        }).join('');

        container.querySelectorAll('.lift-plan-row').forEach(button => {
            button.addEventListener('click', () => {
                const row = rows[Number(button.dataset.index)];
                if (row) prefillExercise(row.name, row.weight);
            });
        });
    }

    function renderManualLogs() {
        const todayBox = document.getElementById('lift-today');
        const historyBox = document.getElementById('lift-history');
        if (!todayBox || !historyBox) return;

        const logs = cleanupLegacyTestData();
        const today = getDateDisplay();
        const todayLogs = logs.filter(l => l.date === today);
        const pastLogs = logs.filter(l => l.date !== today);

        todayBox.innerHTML = todayLogs.length ? todayLogs.map(l => `
            <div style="display:flex; justify-content:space-between; align-items:center; border:1px solid var(--border); border-radius:12px; padding:9px; margin-bottom:7px; background:rgba(0,0,0,0.45);">
                <span style="display:flex; flex-direction:column; gap:2px;">
                    <b style="color:var(--main); font-size:12px;">${escapeHtml(l.exercise)}</b>
                    <small style="color:var(--muted); font-size:9px;">${escapeHtml(l.weight)}kg × ${escapeHtml(l.reps)} reps</small>
                </span>
                <button onclick="window.PegasusLifting.deleteSet('${escapeHtml(l.id)}')" style="background:transparent; color:#ff4b4b; border:1px solid #ff4b4b; border-radius:8px; padding:5px 7px; font-size:10px;">Διαγρ.</button>
            </div>
        `).join('') : `<div style="color:var(--muted); font-size:11px; text-align:center; padding:10px;">Δεν έχεις χειροκίνητη καταγραφή σήμερα.</div>`;

        const prMap = {};
        pastLogs.forEach(l => {
            const name = getCanonicalDisplayName(l.exercise);
            const weight = Number(String(l.weight || 0).replace(',', '.')) || 0;
            if (!name || !weight) return;
            prMap[name] = Math.max(prMap[name] || 0, weight);
        });
        getSavedWeightRows(100).forEach(row => {
            const name = getCanonicalDisplayName(row.name);
            const weight = Number(String(row.weight || 0).replace(',', '.')) || 0;
            if (!name || !weight) return;
            prMap[name] = Math.max(prMap[name] || 0, weight);
        });

        const prs = Object.entries(prMap).sort((a, b) => a[0].localeCompare(b[0], 'el'));
        historyBox.innerHTML = prs.length ? prs.map(([name, max]) => `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(0,255,65,0.15); padding:7px 0; font-size:11px;">
                <span>${escapeHtml(name)}</span><b style="color:var(--main);">${escapeHtml(max)}kg</b>
            </div>
        `).join('') : `<div style="color:var(--muted); font-size:11px; text-align:center; padding:10px;">Δεν υπάρχει ιστορικό βαρών.</div>`;
    }


    function renderTargetEmpty(container, message) {
        if (!container) return;
        container.innerHTML = `
            <div style="padding: 12px; border: 1px dashed var(--border); border-radius: 14px; color: var(--muted); font-size: 11px; text-align: center; line-height: 1.45; background: rgba(0,0,0,0.35);">
                ${escapeHtml(message)}
            </div>`;
    }

    function renderTargetsDayExercises() {
        const container = document.getElementById('mobile-target-day-exercises');
        if (!container) return;

        const selectedDay = getSelectedDayName();
        const rows = getWorkoutExercises();

        if (!rows.length) {
            renderTargetEmpty(container, 'Αποθεραπεία');
            return;
        }

        rememberStrengthRows(rows);
        container.innerHTML = rows.map(row => {
            const doneTxt = row.sets ? `${Number(row.done || 0)}/${Number(row.sets || 0)}` : `${Number(row.done || 0)}`;
            const weightTxt = row.weight !== "" ? `${escapeHtml(row.weight)} kg` : "-- kg";
            return `
                <div class="mini-card pegasus-target-exercise-row">
                    <span class="pegasus-target-exercise-info">
                        <b>${escapeHtml(row.name)}</b>
                        <small>${escapeHtml(row.group)} • Σετ ${escapeHtml(doneTxt)}</small>
                    </span>
                    ${renderExerciseThumb(row.name)}
                    <span class="pegasus-target-exercise-weight">${weightTxt}</span>
                </div>`;
        }).join('');

        bindExerciseThumbs(container);
    }

    function renderTargetsSavedWeights() {
        const container = document.getElementById('mobile-target-saved-weights');
        if (!container) return;

        const rows = getSavedWeightRows(150);
        if (!rows.length) {
            renderTargetEmpty(container, 'Δεν βρέθηκαν αποθηκευμένα κιλά. Μόλις περάσει προπόνηση/βάρος από desktop ή mobile, θα εμφανιστεί εδώ.');
            return;
        }

        container.innerHTML = rows.map(row => `
            <div class="mini-card pegasus-target-exercise-row">
                <span class="pegasus-target-exercise-info">
                    <b>${escapeHtml(row.name)}</b>
                    <small>${escapeHtml(row.group || '--')} • Αποθηκευμένα κιλά</small>
                </span>
                ${renderExerciseThumb(row.name)}
                <span class="pegasus-target-exercise-weight">${escapeHtml(row.weight)} kg</span>
            </div>
        `).join('');

        bindExerciseThumbs(container);
    }

    function renderTargetsPanel() {
        cleanupLegacyTestData();
        repairAllWeightAliases();
        renderTargetsDayExercises();
        renderTargetsSavedWeights();
    }

    window.PegasusLifting = {
        isLocked: false,

        cleanupLegacyTestData,
        repairAllWeightAliases,
        readSavedWeight,
        getSavedWeightRows,
        getWorkoutExercises,
        renderTargetsPanel,
        renderTargetsDayExercises,
        renderTargetsSavedWeights,
        renderExerciseThumb,
        handleExerciseThumbError,
        prefillExercise,

        addSet: function() {
            if (this.isLocked) return;
            this.isLocked = true;

            try {
                const name = normalizeExerciseName(document.getElementById('liftName')?.value);
                const weight = String(document.getElementById('liftWeight')?.value || "").trim();
                const reps = String(document.getElementById('liftReps')?.value || "").trim();

                if (!name || !weight || !reps || isLegacyTestEntry({ exercise: name })) {
                    alert('Συμπλήρωσε πραγματική άσκηση, κιλά και επαναλήψεις.');
                    return;
                }

                const logs = cleanupLegacyTestData();
                logs.unshift({
                    id: `lift_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                    date: getDateDisplay(),
                    date_key: getDateKey(),
                    timestamp: new Date().toISOString(),
                    exercise: name,
                    weight,
                    reps
                });

                writeLogs(logs);
                writeWeightAliases(name, weight);

                const nameInput = document.getElementById('liftName');
                const weightInput = document.getElementById('liftWeight');
                const repsInput = document.getElementById('liftReps');
                if (nameInput) nameInput.value = '';
                if (weightInput) weightInput.value = '';
                if (repsInput) repsInput.value = '';

                window.renderLiftingContent();
                if (window.PegasusCloud && typeof window.PegasusCloud.push === 'function') {
                    window.PegasusCloud.push(true);
                }
            } finally {
                this.isLocked = false;
            }
        },

        deleteSet: function(id) {
            if (!confirm('Διαγραφή καταγραφής;')) return;
            const logs = cleanupLegacyTestData().filter(l => l.id !== id);
            writeLogs(logs);
            window.renderLiftingContent();
            if (window.PegasusCloud && typeof window.PegasusCloud.push === 'function') {
                window.PegasusCloud.push(true);
            }
        },

        saveAndRender: function(data) {
            const clean = Array.isArray(data) ? data.filter(entry => !isLegacyTestEntry(entry)) : [];
            writeLogs(clean);
            window.renderLiftingContent();
            if (window.PegasusCloud && typeof window.PegasusCloud.push === 'function') {
                window.PegasusCloud.push(true);
            }
        }
    };

    function injectViewLayer() {
        if (document.getElementById('lifting')) return;
        const layer = document.createElement('div');
        layer.className = 'view';
        layer.id = 'lifting';
        layer.innerHTML = `
            <button class="btn-back" onclick="openView('home')">◀ Επιστροφή</button>
            <div class="view-title">🏋️ Βάρη</div>
            <div style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
                <div style="border:1px solid var(--border); border-radius:16px; padding:12px; background:rgba(0,0,0,0.45);">
                    <div style="font-size:11px; color:var(--main); font-weight:900; margin-bottom:8px;">+ Χειροκίνητη καταγραφή</div>
                    <input id="liftName" placeholder="Άσκηση" style="width:100%; margin-bottom:8px; padding:10px; border-radius:10px; border:1px solid var(--border); background:#050505; color:#fff; box-sizing:border-box;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <input id="liftWeight" type="number" inputmode="decimal" placeholder="Κιλά" style="padding:10px; border-radius:10px; border:1px solid var(--border); background:#050505; color:#fff;">
                        <input id="liftReps" type="number" inputmode="numeric" placeholder="Επαναλ." style="padding:10px; border-radius:10px; border:1px solid var(--border); background:#050505; color:#fff;">
                    </div>
                    <button onclick="window.PegasusLifting.addSet()" style="width:100%; margin-top:10px; padding:11px; border-radius:12px; border:1px solid var(--main); background:rgba(0,255,65,0.12); color:var(--main); font-weight:900;">Προσθήκη σετ</button>
                </div>

                <div>
                    <div style="font-size:11px; color:var(--main); font-weight:900; margin-bottom:8px;">Ασκήσεις προπόνησης</div>
                    <div id="lift-plan"></div>
                </div>

                <div>
                    <div style="font-size:11px; color:var(--main); font-weight:900; margin-bottom:8px;">Σημερινή καταγραφή</div>
                    <div id="lift-today"></div>
                </div>

                <div>
                    <div style="font-size:11px; color:var(--main); font-weight:900; margin-bottom:8px;">Ιστορικό / PR</div>
                    <div id="lift-history"></div>
                </div>
            </div>
        `;
        (document.querySelector('.mobile-wrapper') || document.body).appendChild(layer);
    }

    window.renderLiftingContent = function() {
        cleanupLegacyTestData();
        repairAllWeightAliases();
        renderWorkoutPlan();
        renderManualLogs();
        renderTargetsPanel();
    };

    document.addEventListener('DOMContentLoaded', () => {
        // PEGASUS 228: the standalone mobile “Βάρη” category is removed.
        // The weight library stays active and is rendered inside Στόχοι.
        cleanupLegacyTestData();
        repairAllWeightAliases();
        renderTargetsPanel();
    });

    document.addEventListener('pegasus_sync_complete', () => {
        repairAllWeightAliases();
        cleanupLegacyTestData();
        if (document.getElementById('preview')?.classList.contains('active')) {
            renderTargetsPanel();
        }
        if (document.getElementById('lifting')?.classList.contains('active')) {
            window.renderLiftingContent();
        }
    });

    console.log('🏋️ PEGASUS MOBILE LIFTING: Targets-integrated weight library active (v1.6.293).');
})();
