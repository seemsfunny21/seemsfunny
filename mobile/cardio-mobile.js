/* ==========================================================================
   PEGASUS OS - CARDIO MODULE (MOBILE EDITION v14.7 CANONICAL CARDIO SAVE)
   Protocol: Canonical km/kcal aliases, auto-kcal estimate, history logging & forced cloud push
   Status: FINAL STABLE | FIXED: MOBILE BIKE KM/KCAL RECORD ALWAYS WRITTEN
   ========================================================================== */

(function() {
    const CARDIO_KCAL_PER_KM = 26.8; // calibrated from previous Pegasus cycling logs (~830 kcal / 31km)

    function pad(n) { return String(n).padStart(2, '0'); }

    function getDateBundle(date = new Date()) {
        const d = pad(date.getDate());
        const m = pad(date.getMonth() + 1);
        const y = date.getFullYear();
        const dd = String(date.getDate());
        const mm = String(date.getMonth() + 1);
        return {
            dateStr: `${d}/${m}/${y}`,
            iso: `${y}-${m}-${d}`,
            unpadded: `${dd}/${mm}/${y}`,
            compact: `${y}${m}${d}`,
            weekKey: `${y}-${m}-${d}`,
            aliases: Array.from(new Set([`${d}/${m}/${y}`, `${y}-${m}-${d}`, `${dd}/${mm}/${y}`, `${y}${m}${d}`]))
        };
    }

    function readNumber(key) {
        const value = parseFloat(localStorage.getItem(key));
        return Number.isFinite(value) ? value : 0;
    }

    function maxExisting(prefixes, aliases) {
        let value = 0;
        prefixes.forEach(prefix => {
            aliases.forEach(alias => {
                value = Math.max(value, readNumber(prefix + alias));
            });
        });
        return value;
    }

    function writeAliases(prefixes, aliases, value) {
        const normalized = Number(value || 0).toFixed(1);
        prefixes.forEach(prefix => {
            aliases.forEach(alias => localStorage.setItem(prefix + alias, normalized));
        });
    }

    function readHistory() {
        try {
            const parsed = JSON.parse(localStorage.getItem('pegasus_cardio_history') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writeHistory(entry) {
        const history = readHistory();
        const signature = `${entry.isoDate}|${entry.type}|${entry.km}|${entry.kcal}`;
        const withoutDuplicate = history.filter(item => {
            const itemSig = `${item?.isoDate || item?.dateKey || item?.workoutKey || ''}|${item?.type || ''}|${item?.km || item?.distanceKm || ''}|${item?.kcal || item?.calories || ''}`;
            return itemSig !== signature;
        });
        withoutDuplicate.unshift(entry);
        localStorage.setItem('pegasus_cardio_history', JSON.stringify(withoutDuplicate.slice(0, 80)));
    }

    async function forceCardioPush() {
        let pushed = false;
        try {
            if (window.PegasusCloud?.push) {
                const result = await window.PegasusCloud.push(true);
                pushed = result !== false;
            }
        } catch (e) {
            console.warn('⚠️ PEGASUS CARDIO: immediate push failed, retry queued.', e);
        }

        if (!pushed && window.PegasusCloud?.syncNow) {
            try {
                const result = await window.PegasusCloud.syncNow(true);
                pushed = result !== false;
            } catch (e) {}
        }

        if (window.PegasusCloud?.push) {
            setTimeout(() => { try { window.PegasusCloud.push(true); } catch (e) {} }, 1200);
            setTimeout(() => { try { window.PegasusCloud.push(true); } catch (e) {} }, 4000);
        }
    }

    function refreshCardioUI() {
        if (window.PegasusDiet && typeof window.PegasusDiet.updateUI === 'function') window.PegasusDiet.updateUI();
        if (typeof window.updateFoodUI === 'function') window.updateFoodUI();
        if (typeof window.renderFood === 'function') window.renderFood();
        if (typeof window.updateKcalUI === 'function') window.updateKcalUI();
        if (window.PegasusMetabolic?.renderUI) window.PegasusMetabolic.renderUI();
        if (window.MuscleProgressUI?.render) window.MuscleProgressUI.render();
    }

    window.PegasusCardio = {
        save: async function() {
            if (window.__pegasusMobileCardioSaving) return;
            window.__pegasusMobileCardioSaving = true;

            try {
                const kmEl = document.getElementById('cdKm');
                const kcalEl = document.getElementById('cdKcalBurned');

                const km = parseFloat((kmEl?.value || '').replace(',', '.')) || 0;
                const inputKcal = parseFloat((kcalEl?.value || '').replace(',', '.')) || 0;
                const estimatedKcal = km > 0 ? Math.round(km * CARDIO_KCAL_PER_KM) : 0;
                const burnedKcal = inputKcal > 0 ? inputKcal : estimatedKcal;

                if (km <= 0 && burnedKcal <= 0) {
                    alert('Συμπλήρωσε χιλιόμετρα ή θερμίδες ποδηλασίας.');
                    return;
                }

                const date = getDateBundle(new Date());
                const aliases = date.aliases;
                const cardioOffsetBase = window.PegasusManifest?.workout?.cardio_offset || 'pegasus_cardio_offset_sets';

                /* --- 1. LEG LOAD / WEEKLY PROGRESS --- */
                const maxCyclingCredit = 8;
                const credit = km > 0
                    ? Math.max(0, Math.min(maxCyclingCredit, km >= 15 ? maxCyclingCredit : Math.round(Math.max(0, km) / 2)))
                    : 0;

                if (credit > 0) {
                    let history = JSON.parse(localStorage.getItem('pegasus_weekly_history') || '{}');
                    if (!history || typeof history !== 'object') history = {};
                    const currentLegSets = Math.max(0, parseInt(history['Πόδια'] || 0, 10));
                    history['Πόδια'] = currentLegSets + credit;
                    localStorage.setItem('pegasus_weekly_history', JSON.stringify(history));

                    const weekDate = new Date();
                    const weekStart = new Date(weekDate);
                    const daysSinceSaturday = (weekDate.getDay() + 1) % 7;
                    weekStart.setHours(6, 0, 0, 0);
                    weekStart.setDate(weekDate.getDate() - daysSinceSaturday);
                    if (weekDate.getDay() === 6 && weekDate.getTime() < weekStart.getTime()) weekStart.setDate(weekStart.getDate() - 7);
                    const weekKey = `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
                    localStorage.setItem('pegasus_weekly_history_week_key', weekKey);

                    if (window.PegasusBrain?.recordWeekendCarryover) {
                        try { window.PegasusBrain.recordWeekendCarryover('Ποδηλασία', 'Πόδια', credit, date.iso); }
                        catch (e) { console.warn('⚠️ PEGASUS BRAIN: mobile cycling carry-over skipped.', e); }
                    }

                    let stats = JSON.parse(localStorage.getItem('pegasus_stats') || '{}');
                    if (!stats || typeof stats !== 'object') stats = {};
                    if (typeof stats.totalSets !== 'number') stats.totalSets = 0;
                    if (!stats.exerciseHistory || typeof stats.exerciseHistory !== 'object') stats.exerciseHistory = {};
                    stats.totalSets += credit;
                    stats.exerciseHistory['Ποδηλασία'] = (stats.exerciseHistory['Ποδηλασία'] || 0) + credit;
                    localStorage.setItem('pegasus_stats', JSON.stringify(stats));

                    window.dispatchEvent?.(new CustomEvent('pegasus_weekly_history_updated', { detail: { source: 'mobile-cardio', history: { ...history } } }));
                }

                /* --- 2. CANONICAL CARDIO KCAL/KM STORAGE --- */
                const kcalPrefixes = ['pegasus_cardio_kcal_', `${cardioOffsetBase}_`, 'pegasus_cardio_offset_sets_'];
                const kmPrefixes = ['pegasus_cardio_km_', 'pegasus_cardio_distance_', 'pegasus_cardio_kilometers_'];

                if (burnedKcal > 0) {
                    const currentKcal = maxExisting(kcalPrefixes, aliases);
                    const nextKcal = currentKcal + burnedKcal;
                    writeAliases(kcalPrefixes, aliases, nextKcal);

                    const weeklyKcalKey = window.PegasusManifest?.diet?.weeklyKcal || 'pegasus_weekly_kcal';
                    const weeklyKcal = parseFloat(localStorage.getItem(weeklyKcalKey)) || 0;
                    localStorage.setItem(weeklyKcalKey, (weeklyKcal + burnedKcal).toFixed(1));
                    const baseTarget = (typeof window.getPegasusBaseDailyTarget === 'function')
                        ? window.getPegasusBaseDailyTarget()
                        : (parseFloat(localStorage.getItem('pegasus_goal_kcal')) || parseFloat(localStorage.getItem('pegasus_today_kcal')) || 2800);
                    const exerciseBurn = (typeof window.getPegasusTodayExerciseBurn === 'function')
                        ? window.getPegasusTodayExerciseBurn()
                        : nextKcal;
                    const effectiveTarget = (typeof window.getPegasusFinalDailyTargetFromBurn === 'function')
                        ? window.getPegasusFinalDailyTargetFromBurn(baseTarget, exerciseBurn)
                        : Math.round(baseTarget + exerciseBurn);
                    localStorage.setItem('pegasus_effective_today_kcal', String(effectiveTarget));
                    localStorage.setItem('pegasus_effective_today_date', date.dateStr);
                }

                if (km > 0) {
                    const currentKm = maxExisting(kmPrefixes, aliases);
                    writeAliases(kmPrefixes, aliases, currentKm + km);
                }

                /* --- 3. HISTORY + LAST SNAPSHOT --- */
                const entry = {
                    date: date.dateStr,
                    isoDate: date.iso,
                    dateKey: date.iso,
                    compactDate: date.compact,
                    type: 'Ποδηλασία',
                    activity: 'cycling',
                    km,
                    distanceKm: km,
                    kcal: burnedKcal,
                    calories: burnedKcal,
                    estimatedKcal: inputKcal <= 0 && estimatedKcal > 0,
                    legSets: credit,
                    recordedAt: new Date().toISOString(),
                    source: 'mobile-cardio-v14.8'
                };
                writeHistory(entry);
                localStorage.setItem('pegasus_last_cardio_entry', JSON.stringify(entry));

                /* --- 4. CALENDAR: CYCLING IS SEPARATE FROM WEIGHTS --- */
                if (km > 0 || burnedKcal > 0) {
                    const cyclingDoneKey = 'pegasus_cycling_done';
                    let cyclingData = {};
                    try {
                        const parsed = JSON.parse(localStorage.getItem(cyclingDoneKey) || '{}');
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) cyclingData = parsed;
                    } catch (_) {}
                    cyclingData[date.iso] = true;
                    localStorage.setItem(cyclingDoneKey, JSON.stringify(cyclingData));
                }

                refreshCardioUI();

                if (kmEl) kmEl.value = '';
                if (kcalEl) kcalEl.value = '';

                console.log(`🚴 CARDIO MOBILE: ${km}km | +${burnedKcal} kcal | +${credit} leg sets | aliases:`, aliases);
                await forceCardioPush();

                if (typeof openView === 'function') openView('home');
            } finally {
                setTimeout(() => { window.__pegasusMobileCardioSaving = false; }, 500);
            }
        }
    };
})();
