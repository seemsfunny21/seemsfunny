/* ==========================================================================
   PEGASUS DIET ADVISOR - v2.3 (KOUKI DAILY MENU ROUTING)
   Protocol: 14-Day Nutrition Gap Scoring + Daily Kouki Menu Recommendations
   ========================================================================== */
(function() {
    var M = M || window.PegasusManifest;
    const HISTORY_DAYS = 14;

    function getLang() {
        try {
            return window.PegasusI18n?.getLanguage?.() || localStorage.getItem('pegasus_language') || localStorage.getItem('pegasus_lang') || 'gr';
        } catch (e) {
            return 'gr';
        }
    }

    function isEn() {
        return getLang() === 'en';
    }

    function t(gr, en) {
        return isEn() ? en : gr;
    }

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function formatDate(dateObj) {
        return `${pad2(dateObj.getDate())}/${pad2(dateObj.getMonth() + 1)}/${dateObj.getFullYear()}`;
    }

    function normalize(value) {
        if (window.PegasusFoodRegistry?.normalize) return window.PegasusFoodRegistry.normalize(value);
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\([^)]*\)/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getDateStr() {
        if (typeof window.PegasusDiet?.getStrictDateStr === 'function') return window.PegasusDiet.getStrictDateStr();
        if (typeof window.getStrictDateStr === 'function') return window.getStrictDateStr();
        if (typeof window.getPegasusTodayDateStr === 'function') return window.getPegasusTodayDateStr();

        return formatDate(new Date());
    }

    function getFoodLogByDate(dateStr) {
        const prefix = M?.nutrition?.log_prefix || M?.diet?.log_prefix || 'food_log_';
        try {
            const parsed = JSON.parse(localStorage.getItem(prefix + dateStr) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function getFoodLog() {
        return getFoodLogByDate(getDateStr());
    }

    function getRecentHistory(days = HISTORY_DAYS) {
        const out = [];
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setHours(12, 0, 0, 0);
            d.setDate(d.getDate() - i);
            const dateStr = formatDate(d);
            out.push({ dateStr, log: getFoodLogByDate(dateStr) });
        }
        return out;
    }

    function hasAny(text, tokens) {
        return tokens.some(token => text.includes(token));
    }

    function classifyFood(name, type) {
        const rawName = String(name || '');
        const rawType = String(type || '');
        const key = normalize(`${rawName} ${rawType}`);
        const matched = window.PegasusFoodRegistry?.matchItem?.(rawName);
        const family = matched?.family || '';
        const categories = new Set();

        if (family) categories.add(family);

        if (
            family === 'greens' ||
            hasAny(key, ['χορτ', 'σπανακι', 'μπροκολ', 'πρασιν', 'λαχανο', 'μαρουλ', 'σαλατα πρασιν'])
        ) categories.add('greens');

        if (
            family === 'legumes' ||
            rawType === 'ospro' ||
            hasAny(key, ['φασολ', 'ρεβυθ', 'ρεβιθ', 'φακες', 'γιγαντ', 'οσπρ'])
        ) categories.add('legumes');

        if (
            family === 'veg_meals' ||
            rawType === 'ladero' ||
            hasAny(key, ['λαχαν', 'λαδερα', 'φασολακια', 'αρακας', 'μπαμι', 'γεμιστα', 'παπουτσακια'])
        ) categories.add('veg');

        if (
            family === 'fish_seafood' ||
            rawType === 'psari' ||
            hasAny(key, ['ψαρ', 'σολομ', 'μπακαλιαρ', 'περκα', 'γαριδ', 'σουπι', 'θαλασσιν'])
        ) categories.add('fish');

        if (
            rawType === 'poulika' ||
            hasAny(key, ['κοτοπουλ', 'σνιτσελ κοτο', 'μπιφτεκι κοτο', 'chicken'])
        ) {
            categories.add('chicken');
            categories.add('meat_main');
        }

        if (
            rawType === 'kreas' ||
            hasAny(key, ['μοσχ', 'χοιρ', 'αρν', 'κιμα', 'κεφτε', 'σουτζουκ', 'γιουβαρ', 'μπριζολ', 'μπιφτεκ'])
        ) {
            categories.add('red_meat');
            categories.add('meat_main');
        }

        if (family === 'fruit' || hasAny(key, ['μηλο', 'πορτοκαλ', 'μπανανα', 'φρουτ', 'αχλαδ', 'ακτινιδ', 'καρπουζ', 'πεπον'])) categories.add('fruit');
        if (family === 'eggs' || hasAny(key, ['αυγ', 'αβγ', 'egg'])) categories.add('eggs');
        if (family === 'yogurt' || family === 'dairy_drinks' || family === 'cottage_soft_cheese' || hasAny(key, ['γιαουρτ', 'κεφιρ', 'cottage', 'τυρ'])) categories.add('dairy');
        if (family === 'whey' || hasAny(key, ['whey', 'πρωτειν', 'πρωτεινη'])) categories.add('whey');
        if (family === 'outside_meals' || hasAny(key, ['γυρο', 'πιτσα', 'burger', 'κρεπα', 'club', 'wrap', 'σουβλακ'])) categories.add('outside');
        if (rawType === 'carb' || rawType === 'pita' || rawType === 'dessert' || hasAny(key, ['μακαρον', 'παστιτσιο', 'μουσακα', 'λαζαν', 'κανελον', 'πιτα'])) categories.add('carb');

        return {
            family: family || (categories.has('chicken') || categories.has('red_meat') ? 'meat_main' : 'other'),
            label: matched?.label || rawName,
            categories: Array.from(categories)
        };
    }

    function getTotals() {
        const log = getFoodLog();
        return log.reduce((acc, item) => {
            acc.kcal += parseFloat(item?.kcal || 0) || 0;
            acc.protein += parseFloat(item?.protein || 0) || 0;
            return acc;
        }, { kcal: 0, protein: 0, log: log });
    }

    function getTargets() {
        let kcal = 2800;
        let protein = 160;

        try {
            const settings = typeof window.getPegasusSettings === 'function' ? window.getPegasusSettings() : null;
            if (settings?.goalKcal) kcal = parseFloat(settings.goalKcal) || kcal;
            if (settings?.goalProtein) protein = parseFloat(settings.goalProtein) || protein;
        } catch (e) {}

        if (typeof window.PegasusDiet?.getEffectiveTarget === 'function') {
            kcal = parseFloat(window.PegasusDiet.getEffectiveTarget()) || kcal;
        } else if (typeof window.getPegasusEffectiveDailyTarget === 'function') {
            kcal = parseFloat(window.getPegasusEffectiveDailyTarget()) || kcal;
        } else {
            kcal = parseFloat(localStorage.getItem(M?.diet?.todayKcal || 'pegasus_today_kcal')) || kcal;
        }

        return { kcal: Math.round(kcal), protein: Math.round(protein) };
    }

    function getTodayDayKey() {
        const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return daysMap[new Date().getDay()];
    }

    function getMacros(name, type, fallbackKcal, fallbackProtein) {
        if (Number.isFinite(Number(fallbackKcal)) || Number.isFinite(Number(fallbackProtein))) {
            return {
                kcal: parseFloat(fallbackKcal || 0) || 0,
                protein: parseFloat(fallbackProtein || 0) || 0
            };
        }

        if (typeof window.getPegasusMacros === 'function') {
            const macros = window.getPegasusMacros(name, type);
            return {
                kcal: parseFloat(macros?.kcal || 0) || 0,
                protein: parseFloat(macros?.protein || 0) || 0
            };
        }

        return {
            kcal: parseFloat(fallbackKcal || 550) || 550,
            protein: parseFloat(fallbackProtein || 35) || 35
        };
    }

    function pushCandidate(list, seen, raw, source = 'kouki') {
        const name = String(raw?.name || raw?.n || '').trim();
        if (!name) return;
        const key = normalize(name);
        if (!key || seen.has(key)) return;

        const type = raw?.t || raw?.type || raw?.family || 'kreas';
        const macros = getMacros(name, type, raw?.kcal, raw?.protein);
        if (!macros.kcal && !macros.protein) return;

        const cls = classifyFood(name, type);
        const price = Number(raw?.price ?? raw?.p);
        seen.add(key);
        list.push({
            n: name,
            t: type,
            kcal: Math.round(macros.kcal),
            protein: Math.round(macros.protein),
            price: Number.isFinite(price) ? price : null,
            source,
            sourceLabel: source === 'today' ? t('Κούκι σήμερα', 'Kouki today') : (source === 'rotation' ? t('Εναλλακτική', 'Alternative') : 'Kouki'),
            family: cls.family,
            categories: cls.categories,
            key
        });
    }

    function getCandidates() {
        const candidates = [];
        const seen = new Set();
        const todayKey = getTodayDayKey();
        const todayMenu = window.KOUKI_MASTER_MENU?.[todayKey] || [];

        // Main rule: when Kouki has a menu for the current day, the advisor ranks
        // only today's actual dishes. This keeps recommendations tied to the day
        // instead of suggesting food from another weekday.
        if (todayMenu.length) {
            todayMenu.forEach(item => pushCandidate(candidates, seen, item, 'today'));
            return candidates;
        }

        // Fallback only if the daily Kouki menu is unavailable.
        [
            { name: 'Χόρτα / πράσινα', type: 'greens', kcal: 120, protein: 5 },
            { name: 'Φασόλια / Φασολάδα', type: 'ospro', kcal: 400, protein: 18 },
            { name: 'Ρεβύθια / όσπρια', type: 'ospro', kcal: 480, protein: 19 },
            { name: 'Φασολάκια / λαδερό', type: 'ladero', kcal: 350, protein: 8 },
            { name: 'Ψάρι / θαλασσινά', type: 'psari', kcal: 500, protein: 40 },
            { name: 'Φρούτο', type: 'fruit', kcal: 80, protein: 1 },
            { name: 'Γιαούρτι', type: 'yogurt', kcal: 180, protein: 20 }
        ].forEach(item => pushCandidate(candidates, seen, item, 'rotation'));

        const dbMenu = Array.isArray(window.PegasusKoukiDB) ? window.PegasusKoukiDB : [];
        dbMenu.forEach(item => pushCandidate(candidates, seen, item, 'kouki'));

        const registryPools = ['kouki_main', 'dinner', 'work', 'breakfast', 'fruit', 'outside'];
        registryPools.forEach(pool => {
            const opts = window.PegasusFoodRegistry?.getCandidates?.(pool, 25, { allowSameFamily: true, environment: pool === 'work' ? 'work' : 'home' }) || [];
            opts.forEach(item => pushCandidate(candidates, seen, item, 'registry'));
        });

        try {
            const libKey = M?.diet?.foodLibrary || 'pegasus_food_library';
            const library = JSON.parse(localStorage.getItem(libKey) || '[]');
            if (Array.isArray(library)) library.forEach(item => pushCandidate(candidates, seen, item, 'library'));
        } catch (e) {}

        return candidates;
    }

    function countHistory(history) {
        const itemCounts = {};
        const itemLabels = {};
        const itemTypes = {};
        const familyCounts = {};
        const categoryCounts = {};
        const categoryDays = {};
        const daySummaries = [];
        const totalItems = history.reduce((sum, day) => sum + (Array.isArray(day.log) ? day.log.length : 0), 0);

        history.forEach(day => {
            const seenCategoriesToday = new Set();
            const seenFamiliesToday = new Set();
            (day.log || []).forEach(item => {
                const name = String(item?.name || item?.n || '').trim();
                if (!name) return;
                const type = item?.t || item?.type || '';
                const key = normalize(name);
                const cls = classifyFood(name, type);

                itemCounts[key] = (itemCounts[key] || 0) + 1;
                if (!itemLabels[key]) itemLabels[key] = name;
                if (!itemTypes[key]) itemTypes[key] = type;
                familyCounts[cls.family] = (familyCounts[cls.family] || 0) + 1;
                if (cls.family) seenFamiliesToday.add(cls.family);
                (cls.categories || []).forEach(cat => {
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                    seenCategoriesToday.add(cat);
                });
            });
            seenCategoriesToday.forEach(cat => {
                categoryDays[cat] = (categoryDays[cat] || 0) + 1;
            });
            daySummaries.push({
                dateStr: day.dateStr,
                items: Array.isArray(day.log) ? day.log.length : 0,
                categories: Array.from(seenCategoriesToday),
                families: Array.from(seenFamiliesToday)
            });
        });

        return { itemCounts, itemLabels, itemTypes, familyCounts, categoryCounts, categoryDays, daySummaries, totalItems, days: history.length };
    }

    function missingLabel(cat) {
        const labels = {
            greens: t('χόρτα/πράσινα', 'greens'),
            legumes: t('όσπρια/φασόλια', 'legumes/beans'),
            fish: t('ψάρι/θαλασσινά', 'fish/seafood'),
            veg: t('λαχανικά/λαδερά', 'vegetables'),
            fruit: t('φρούτα', 'fruit')
        };
        return labels[cat] || cat;
    }

    function getPriorityBoost(item, stats) {
        const cats = new Set(item.categories || []);
        let boost = 0;
        const reasons = [];

        const rules = [
            { cat: 'greens', maxDays: 1, boost: 260 },
            { cat: 'legumes', maxDays: 1, boost: 240 },
            { cat: 'fish', maxDays: 1, boost: 170 },
            { cat: 'veg', maxDays: 2, boost: 110 },
            { cat: 'fruit', maxDays: 3, boost: 70 }
        ];

        rules.forEach(rule => {
            const daysSeen = Number(stats.categoryDays[rule.cat] || 0);
            if (daysSeen <= rule.maxDays && cats.has(rule.cat)) {
                boost += rule.boost;
                reasons.push(t(
                    `Προτεραιότητα: ${missingLabel(rule.cat)} μόνο ${daysSeen}/${HISTORY_DAYS} ημέρες.`,
                    `Priority: ${missingLabel(rule.cat)} only ${daysSeen}/${HISTORY_DAYS} days.`
                ));
            }
        });

        return { boost, reasons };
    }

    function getRepeatPenalty(item, stats) {
        const cats = new Set(item.categories || []);
        const itemCount = Number(stats.itemCounts[item.key] || 0);
        const familyCount = Number(stats.familyCounts[item.family] || 0);
        let penalty = itemCount * 42 + familyCount * 18;
        const notes = [];

        if (itemCount >= 2) {
            notes.push(t(`Το ίδιο φαγητό μπήκε ${itemCount} φορές στο 14ήμερο.`, `Same food appeared ${itemCount} times in 14 days.`));
        }

        const chickenCount = Number(stats.categoryCounts.chicken || 0);
        const meatCount = Number(stats.categoryCounts.meat_main || 0);
        if (cats.has('chicken') && chickenCount >= 4) {
            penalty += chickenCount * 38;
            notes.push(t(`Κοτόπουλο/πουλερικά ${chickenCount} φορές — πέφτει χαμηλότερα.`, `Chicken/poultry ${chickenCount} times — ranked lower.`));
        } else if (cats.has('meat_main') && meatCount >= 6) {
            penalty += meatCount * 20;
            notes.push(t(`Κρέας/κύρια πρωτεΐνη ${meatCount} φορές — θέλει εναλλαγή.`, `Meat/main protein ${meatCount} times — rotation needed.`));
        }

        return { penalty, notes, itemCount, familyCount, chickenCount, meatCount };
    }

    function scoreCandidate(item, needKcal, needProtein, stats) {
        const kcal = Number(item.kcal || 0);
        const protein = Number(item.protein || 0);
        const proteinDensity = protein / Math.max(kcal, 1);
        const kcalFit = needKcal > 0 ? Math.min(kcal, needKcal) : Math.max(0, 350 - Math.abs(kcal - 350));
        const proteinFit = needProtein > 0 ? Math.min(protein, needProtein) : protein;
        const kcalOvershoot = Math.max(0, kcal - Math.max(needKcal, 1));
        const priority = getPriorityBoost(item, stats);
        const repeat = getRepeatPenalty(item, stats);

        const macroScore = (
            proteinFit * 4.5 +
            (kcalFit / 45) +
            (proteinDensity * 150) -
            (kcalOvershoot / 100)
        );

        const practicalBonus = item.source === 'today' ? 55 : (item.source === 'rotation' ? 18 : 0);
        const score = macroScore + priority.boost + practicalBonus - repeat.penalty;

        let tone = 'orange';
        let toneLabel = item.source === 'today' ? t('Σήμερα Κούκι', 'TODAY AT KOUKI') : t('ΟΚ επιλογή', 'OK OPTION');
        if (priority.boost >= 160) {
            tone = 'green';
            toneLabel = item.source === 'today' ? t('Σημερινή προτεραιότητα', 'TODAY PRIORITY') : t('Προτείνεται πρώτα', 'FIRST CHOICE');
        }
        if (repeat.penalty >= 180 && priority.boost < 120) {
            tone = 'red';
            toneLabel = item.source === 'today' ? t('Τελευταία από σήμερα', 'LAST FROM TODAY') : t('Τελευταία επιλογή', 'LAST OPTION');
        }

        const reason = [...priority.reasons, ...repeat.notes].slice(0, 2).join(' ')
            || t('Καλή ισορροπία για τους σημερινούς στόχους.', 'Good fit for today\'s targets.');

        return { score, reason, tone, toneLabel, priorityBoost: priority.boost, repeatPenalty: repeat.penalty };
    }

    function getHistoryCategoryProfiles() {
        return [
            { cat: 'greens', label: t('Χόρτα / πράσινα', 'Greens'), targetDays: 3, icon: '🥬' },
            { cat: 'legumes', label: t('Όσπρια / φασόλια', 'Legumes / beans'), targetDays: 2, icon: '🫘' },
            { cat: 'fish', label: t('Ψάρι / θαλασσινά', 'Fish / seafood'), targetDays: 2, icon: '🐟' },
            { cat: 'veg', label: t('Λαχανικά / λαδερά', 'Vegetables'), targetDays: 4, icon: '🥗' },
            { cat: 'fruit', label: t('Φρούτα', 'Fruit'), targetDays: 4, icon: '🍎' },
            { cat: 'dairy', label: t('Γαλακτοκομικά', 'Dairy'), targetDays: 3, icon: '🥛' },
            { cat: 'eggs', label: t('Αυγά', 'Eggs'), targetDays: 2, icon: '🥚' }
        ];
    }

    function getRepeatedCategoryProfiles() {
        return [
            { cat: 'chicken', label: t('Κοτόπουλο / πουλερικά', 'Chicken / poultry'), maxCount: 4, icon: '🍗' },
            { cat: 'red_meat', label: t('Κόκκινο κρέας', 'Red meat'), maxCount: 4, icon: '🥩' },
            { cat: 'outside', label: t('Έτοιμο / έξω φαγητό', 'Outside food'), maxCount: 2, icon: '🍔' },
            { cat: 'carb', label: t('Βαριά ζυμαρικά / φούρνου', 'Heavy pasta / oven meals'), maxCount: 4, icon: '🍝' }
        ];
    }

    function buildHistoryInsights(stats) {
        const categories = getHistoryCategoryProfiles().map(profile => {
            const daysSeen = Number(stats.categoryDays[profile.cat] || 0);
            const count = Number(stats.categoryCounts[profile.cat] || 0);
            const gap = Math.max(0, profile.targetDays - daysSeen);
            let tone = 'ok';
            if (gap >= 2) tone = 'priority';
            else if (gap === 1) tone = 'watch';
            return {
                ...profile,
                daysSeen,
                count,
                gap,
                tone,
                line: `${profile.label}: ${daysSeen}/${HISTORY_DAYS}`
            };
        });

        const missing = categories
            .filter(item => item.gap > 0)
            .sort((a, b) => (b.gap - a.gap) || (a.daysSeen - b.daysSeen));

        const repeatedCategories = getRepeatedCategoryProfiles()
            .map(profile => {
                const count = Number(stats.categoryCounts[profile.cat] || 0);
                const excess = Math.max(0, count - profile.maxCount);
                return { ...profile, count, excess, tone: excess > 0 ? 'limit' : 'ok' };
            })
            .filter(item => item.count >= item.maxCount)
            .sort((a, b) => (b.excess - a.excess) || (b.count - a.count));

        const repeatedFoods = Object.entries(stats.itemCounts || {})
            .map(([key, count]) => ({
                key,
                count: Number(count) || 0,
                label: stats.itemLabels?.[key] || key,
                type: stats.itemTypes?.[key] || ''
            }))
            .filter(item => item.count >= 2)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            categories,
            missing: missing.slice(0, 5),
            repeatedCategories: repeatedCategories.slice(0, 4),
            repeatedFoods,
            daySummaries: stats.daySummaries || []
        };
    }

    function analyzeAndRecommend() {
        const consumed = getTotals();
        const targets = getTargets();
        const needKcal = Math.max(0, targets.kcal - consumed.kcal);
        const needProtein = Math.max(0, targets.protein - consumed.protein);
        const history = getRecentHistory(HISTORY_DAYS);
        const stats = countHistory(history);

        const ranked = getCandidates()
            .map(item => ({ ...item, ...scoreCandidate(item, needKcal, needProtein, stats) }))
            .sort((a, b) => b.score - a.score);

        // Keep the top recommendations, but also keep one low-ranked repeated chicken/meat
        // option when relevant, so the user can see why it is last.
        const top = ranked.slice(0, 6);
        const repeatedLast = ranked
            .filter(item => item.tone === 'red')
            .sort((a, b) => b.repeatPenalty - a.repeatPenalty)[0];

        if (repeatedLast && !top.some(item => item.key === repeatedLast.key)) {
            top.push(repeatedLast);
        }

        const options = top
            .slice(0, 7)
            .sort((a, b) => {
                const toneOrder = { green: 0, orange: 1, red: 2 };
                const ta = toneOrder[a.tone] ?? 1;
                const tb = toneOrder[b.tone] ?? 1;
                if (ta !== tb) return ta - tb;
                return b.score - a.score;
            })
            .map(item => ({
                n: item.n,
                t: item.t,
                kcal: item.kcal,
                protein: item.protein,
                price: item.price,
                source: item.source,
                sourceLabel: item.sourceLabel,
                reason: item.reason,
                tone: item.tone,
                toneLabel: item.toneLabel,
                score: Math.round(item.score)
            }));

        return {
            options,
            consumed: { kcal: Math.round(consumed.kcal), protein: Math.round(consumed.protein) },
            targets,
            deficits: { kcal: needKcal, protein: needProtein },
            history: {
                days: HISTORY_DAYS,
                categoryDays: stats.categoryDays,
                categoryCounts: stats.categoryCounts,
                totalItems: stats.totalItems
            },
            historyInsights: buildHistoryInsights(stats)
        };
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    function buildAdvisorHtml(advice, closeButton = true) {
        const esc = escapeHtml;
        const insights = advice.historyInsights || {};
        const cards = (insights.categories || []).slice(0, 7).map(item => `
            <div class="advisor-history-card ${esc(item.tone || 'ok')}">
                <div class="advisor-history-icon">${esc(item.icon || '•')}</div>
                <div class="advisor-history-main">
                    <div class="advisor-history-label">${esc(item.label)}</div>
                    <div class="advisor-history-count">${esc(item.daysSeen)}/${HISTORY_DAYS} ${t('ημέρες', 'days')}</div>
                </div>
            </div>
        `).join('');

        const repeated = (insights.repeatedCategories || []).length
            ? `<div class="advisor-repeat-strip">${(insights.repeatedCategories || []).map(item => `<span>${esc(item.icon || '•')} ${esc(item.label)}: ${esc(item.count)}x</span>`).join('')}</div>`
            : '';

        const options = (advice.options || []).map((opt, index) => {
            const tone = ['green', 'orange', 'red'].includes(opt?.tone) ? opt.tone : 'orange';
            return `
                <div class="advisor-option-card ${tone}">
                    <div class="advisor-option-rank">${index + 1}</div>
                    <div class="advisor-option-body">
                        ${opt.toneLabel ? `<div class="advisor-option-badge ${tone}">${esc(opt.toneLabel)}</div>` : ''}
                        <div class="advisor-option-name">${esc(opt.n)}</div>
                        <div class="advisor-option-macros">🔥 ${Number(opt.kcal) || 0} kcal | 🍗 ${Number(opt.protein) || 0}g${opt.price !== null && opt.price !== undefined && Number.isFinite(Number(opt.price)) ? ` | 💶 ${Number(opt.price).toFixed(2)}€` : ''}</div>
                        ${opt.sourceLabel ? `<div class="advisor-option-source">📍 ${esc(opt.sourceLabel)}</div>` : ''}
                        ${opt.reason ? `<div class="advisor-option-reason">${esc(opt.reason)}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="advisor-panel pegasus-advisor-rich">
                <div class="advisor-header-row">
                    <div>
                        <div class="advisor-title">🧠 PEGASUS ADVISOR</div>
                        <div class="advisor-subtitle">${t('Προτάσεις διατροφής', 'Nutrition recommendations')}</div>
                    </div>
                    ${closeButton ? `<button class="advisor-close-btn" onclick="window.closePegasusAdvisorModal?.()">×</button>` : ''}
                </div>
                ${cards ? `<div class="advisor-history-grid">${cards}</div>` : ''}
                ${repeated}
                <div class="advisor-options">${options}</div>
            </div>
        `;
    }

    function renderAdvisorUI() {
        const advice = analyzeAndRecommend();
        let overlay = document.getElementById('pegasusAdvisorModal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pegasusAdvisorModal';
            overlay.className = 'pegasus-advisor-overlay';
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `<div class="pegasus-advisor-modal">${buildAdvisorHtml(advice, true)}</div>`;
        overlay.style.display = 'flex';
        return true;
    }

    window.closePegasusAdvisorModal = function() {
        const overlay = document.getElementById('pegasusAdvisorModal');
        if (overlay) overlay.style.display = 'none';
    };


    window.PegasusDietAdvisor = {
        analyzeAndRecommend,
        renderAdvisorUI,
        classifyFood,
        getRecentHistory,
        countHistory,
        buildHistoryInsights,
        buildAdvisorHtml
    };
    window.renderAdvisorUI = renderAdvisorUI;
})();
