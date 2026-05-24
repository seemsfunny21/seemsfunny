/* ==========================================================================
   PEGASUS CORE ENGINE - v1.2
   Protocol: Global Store + Reducer + Event Buffer + Legacy State Bridge
   Status: FOUNDATION STABLE | RUNTIME PATCH ACTIONS READY
   ========================================================================== */

(function() {
    if (window.PegasusEngine && window.PegasusEngine.__isCoreEngine) {
        return;
    }

    function clone(value) {
        try {
            return structuredClone(value);
        } catch (e) {
            return JSON.parse(JSON.stringify(value));
        }
    }

    function getTodayDateStr() {
        if (typeof window.getPegasusTodayDateStr === "function") {
            return window.getPegasusTodayDateStr();
        }

        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    function getLocalDateKey() {
        if (typeof window.getPegasusLocalDateKey === "function") {
            return window.getPegasusLocalDateKey();
        }

        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function getInitialState() {
        return {
            workout: {
                exercises: [],
                remainingSets: [],
                currentIdx: 0,
                phase: 0, // 0 prep, 1 work, 2 rest
                running: false,
                selectedDay: null,
                sessionKcal: 0,
                weights: {}
            },
            timers: {
                totalSeconds: 0,
                remainingSeconds: 0,
                phaseRemainingSeconds: null,
                turboMode: (localStorage.getItem("pegasus_turbo_state") === "true"),
                speed: (localStorage.getItem("pegasus_turbo_state") === "true") ? 10 : 1
            },
            user: {
                weight: parseFloat(localStorage.getItem("pegasus_weight")) || 74,
                muted: localStorage.getItem("pegasus_mute_state") === "true"
            },
            nutrition: {
                todayDateStr: getTodayDateStr(),
                todayKey: getLocalDateKey()
            },
            meta: {
                updatedAt: Date.now(),
                lastAction: null,
                version: 1
            }
        };
    }

    const PROGRESS_PERSIST_KEY = "pegasus_engine_progress_runtime_v1";

    let state = getInitialState();
    let listeners = [];
    let eventBuffer = window._pegasusEventBuffer || [];
    let checkpoints = window._pegasusCheckpoints || [];

    function buildProgressSnapshotFromState(sourceState) {
        const ref = sourceState || state || getInitialState();
        return {
            selectedDay: ref?.workout?.selectedDay || null,
            currentIdx: ref?.workout?.currentIdx ?? 0,
            phase: ref?.workout?.phase ?? 0,
            running: !!ref?.workout?.running,
            remainingSets: clone(ref?.workout?.remainingSets || []),
            totalSeconds: ref?.timers?.totalSeconds ?? 0,
            remainingSeconds: ref?.timers?.remainingSeconds ?? 0,
            phaseRemainingSeconds: ref?.timers?.phaseRemainingSeconds ?? null,
            sessionKcal: ref?.workout?.sessionKcal ?? 0
        };
    }

    function buildPersistableProgressFromState(sourceState) {
        const ref = sourceState || state || getInitialState();
        return {
            selectedDay: ref?.workout?.selectedDay || null,
            currentIdx: ref?.workout?.currentIdx ?? 0,
            phase: ref?.workout?.phase ?? 0,
            running: !!ref?.workout?.running,
            remainingSets: clone(ref?.workout?.remainingSets || []),
            totalSeconds: ref?.timers?.totalSeconds ?? 0,
            remainingSeconds: ref?.timers?.remainingSeconds ?? 0,
            phaseRemainingSeconds: ref?.timers?.phaseRemainingSeconds ?? null,
            sessionKcal: ref?.workout?.sessionKcal ?? 0,
            turboMode: ref?.timers?.turboMode ?? false,
            speed: ref?.timers?.speed ?? 1,
            userWeight: ref?.user?.weight ?? 74,
            muted: ref?.user?.muted ?? false,
            todayDateStr: ref?.nutrition?.todayDateStr || getTodayDateStr(),
            todayKey: ref?.nutrition?.todayKey || getLocalDateKey(),
            savedAt: Date.now(),
            sourceAction: ref?.meta?.lastAction || null
        };
    }

    function getPersistedRuntime() {
        try {
            const raw = localStorage.getItem(PROGRESS_PERSIST_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    function savePersistedRuntime(label, sourceState) {
        const entry = buildPersistableProgressFromState(sourceState || state);
        entry.label = label || entry.sourceAction || "PERSIST_RUNTIME";

        try {
            localStorage.setItem(PROGRESS_PERSIST_KEY, JSON.stringify(entry));
        } catch (e) {
            console.warn("⚠️ PEGASUS CORE: Persist warning", e);
        }

        return clone(entry);
    }

    function clearPersistedRuntime() {
        try {
            localStorage.removeItem(PROGRESS_PERSIST_KEY);
            return true;
        } catch (e) {
            return false;
        }
    }

    function restorePersistedRuntime() {
        const snapshot = getPersistedRuntime();
        if (!snapshot) return null;

        return dispatch({
            type: "RESTORE_PERSISTED_PROGRESS",
            payload: clone(snapshot)
        });
    }

    function shouldAutoCheckpoint(actionType) {
        return /^WORKOUT_.*_RUNTIME$/.test(actionType || "");
    }

    function shouldPersistRuntime(actionType) {
        return /^WORKOUT_.*_RUNTIME$/.test(actionType || "") || actionType === "PATCH_PROGRESS_RUNTIME" || actionType === "SET_SELECTED_DAY" || actionType === "PATCH_USER_RUNTIME" || actionType === "RESTORE_PERSISTED_PROGRESS";
    }

    function createCheckpoint(label, sourceState) {
        const entry = {
            label: label || (sourceState?.meta?.lastAction || state?.meta?.lastAction || "CHECKPOINT"),
            ts: Date.now(),
            progress: buildProgressSnapshotFromState(sourceState || state),
            meta: clone((sourceState || state)?.meta || {})
        };

        checkpoints.push(entry);
        if (checkpoints.length > 40) checkpoints = checkpoints.slice(-40);
        window._pegasusCheckpoints = checkpoints;
        return clone(entry);
    }

    function pushEventBuffer(action) {
        eventBuffer.push({
            ...clone(action),
            __ts: Date.now()
        });

        if (eventBuffer.length > 300) {
            eventBuffer = eventBuffer.slice(-300);
        }

        window._pegasusEventBuffer = eventBuffer;
    }


    function isSerializableExerciseArray(value) {
        return Array.isArray(value) && value.length > 0 && value.every(item => {
            if (!item || typeof item !== "object") return false;
            if (item.nodeType || typeof item.querySelector === "function" || typeof item.classList !== "undefined") return false;
            return true;
        });
    }

    function isDomExerciseArray(value) {
        return Array.isArray(value) && value.length > 0 && value.every(item => item && typeof item.querySelector === "function" && item.classList);
    }

    function applyHydrationSnapshot(next, payload) {
        const snapshot = payload || {};

        if (isSerializableExerciseArray(snapshot.exercises)) {
            next.workout.exercises = clone(snapshot.exercises);
        }
        next.workout.remainingSets = clone(snapshot.remainingSets || next.workout.remainingSets || []);
        next.workout.currentIdx = snapshot.currentIdx ?? next.workout.currentIdx;
        next.workout.phase = snapshot.phase ?? next.workout.phase;
        next.workout.running = snapshot.running ?? next.workout.running;
        next.workout.sessionKcal = snapshot.sessionKcal ?? next.workout.sessionKcal;
        next.workout.selectedDay = snapshot.selectedDay ?? next.workout.selectedDay;
        next.workout.weights = clone(snapshot.weights || next.workout.weights || {});

        next.timers.totalSeconds = snapshot.totalSeconds ?? next.timers.totalSeconds;
        next.timers.remainingSeconds = snapshot.remainingSeconds ?? next.timers.remainingSeconds;
        next.timers.phaseRemainingSeconds = snapshot.phaseRemainingSeconds ?? next.timers.phaseRemainingSeconds;
        next.timers.turboMode = snapshot.turboMode ?? next.timers.turboMode;
        next.timers.speed = snapshot.speed ?? next.timers.speed;

        next.user.weight = snapshot.userWeight ?? snapshot.weight ?? next.user.weight;
        next.user.muted = snapshot.muted ?? next.user.muted;

        next.nutrition.todayDateStr = snapshot.todayDateStr ?? getTodayDateStr();
        next.nutrition.todayKey = snapshot.todayKey ?? getLocalDateKey();
    }

    function reducer(currentState, action) {
        const prev = currentState;
        const next = clone(prev);

        if (!action || !action.type) {
            next.meta.updatedAt = Date.now();
            next.meta.lastAction = "UNKNOWN";
            return next;
        }

        switch (action.type) {
            case "BOOT_FROM_LEGACY":
            case "SYNC_LEGACY":
            case "HYDRATE_LEGACY_RUNTIME":
            case "SELECT_DAY":
            case "START_WORKOUT":
            case "PAUSE_WORKOUT":
            case "RESUME_FROM_PREP":
            case "PHASE_START":
            case "PHASE_TICK":
            case "PHASE_COMPLETE_PREP":
            case "SET_COMPLETED":
            case "REST_COMPLETE_NEXT":
            case "SKIP_EXERCISE":
            case "TOGGLE_SKIP_EXERCISE":
            case "SAVE_WEIGHT":
            case "AUTO_INIT_TODAY":
            case "WORKOUT_FINISHED":
            case "WORKOUT_REPORT_SAVED":
            case "BOOT_COMPLETE":
            case "SYNC_MUTED":
            case "SYNC_TURBO":
            case "WARMUP_RETURN":
                applyHydrationSnapshot(next, action.payload);
                break;

            case "WORKOUT_SELECT_DAY_RUNTIME":
            case "WORKOUT_START_RUNTIME":
            case "WORKOUT_PAUSE_RUNTIME":
            case "WORKOUT_NEXT_RUNTIME":
            case "WORKOUT_SET_COMPLETED_RUNTIME":
            case "WORKOUT_FINISH_RUNTIME":
            case "RESTORE_PERSISTED_PROGRESS":
                applyHydrationSnapshot(next, action.payload);
                break;

            case "SET_CURRENT_INDEX":
                next.workout.currentIdx = action.payload?.currentIdx ?? next.workout.currentIdx;
                break;

            case "SET_PHASE":
                next.workout.phase = action.payload?.phase ?? next.workout.phase;
                break;

            case "SET_RUNNING":
                next.workout.running = !!action.payload?.running;
                break;

            case "SET_SESSION_KCAL":
                next.workout.sessionKcal = action.payload?.sessionKcal ?? next.workout.sessionKcal;
                break;

            case "ADD_SESSION_KCAL":
                next.workout.sessionKcal = (next.workout.sessionKcal || 0) + (action.payload?.amount || 0);
                break;

            case "SET_TOTAL_SECONDS":
                next.timers.totalSeconds = action.payload?.totalSeconds ?? next.timers.totalSeconds;
                break;

            case "SET_Remaining_SECONDS":
                next.timers.remainingSeconds = action.payload?.remainingSeconds ?? next.timers.remainingSeconds;
                break;

            case "SET_PHASE_Remaining":
                next.timers.phaseRemainingSeconds = action.payload?.phaseRemainingSeconds ?? next.timers.phaseRemainingSeconds;
                break;

            case "SET_TIMER_STATE":
                next.timers.totalSeconds = action.payload?.totalSeconds ?? next.timers.totalSeconds;
                next.timers.remainingSeconds = action.payload?.remainingSeconds ?? next.timers.remainingSeconds;
                next.timers.phaseRemainingSeconds = action.payload?.phaseRemainingSeconds ?? next.timers.phaseRemainingSeconds;
                break;

            case "SET_Remaining_SETS":
                next.workout.remainingSets = clone(action.payload?.remainingSets || next.workout.remainingSets);
                break;

            case "SET_EXERCISES":
                next.workout.exercises = clone(action.payload?.exercises || next.workout.exercises);
                break;

            case "SYNC_WEIGHT":
                next.user.weight = action.payload?.weight ?? next.user.weight;
                break;

            case "SET_SELECTED_DAY":
                next.workout.selectedDay = action.payload?.selectedDay ?? next.workout.selectedDay;
                break;

            case "PATCH_WORKOUT_RUNTIME":
                if (action.payload && typeof action.payload === "object") {
                    Object.assign(next.workout, clone(action.payload));
                }
                break;

            case "PATCH_TIMER_RUNTIME":
                if (action.payload && typeof action.payload === "object") {
                    Object.assign(next.timers, clone(action.payload));
                }
                break;

            case "PATCH_PROGRESS_RUNTIME":
                if (action.payload && typeof action.payload === "object") {
                    if (action.payload.workout && typeof action.payload.workout === "object") {
                        Object.assign(next.workout, clone(action.payload.workout));
                    }
                    if (action.payload.timers && typeof action.payload.timers === "object") {
                        Object.assign(next.timers, clone(action.payload.timers));
                    }
                }
                break;

            case "PATCH_USER_RUNTIME":
                if (action.payload && typeof action.payload === "object") {
                    Object.assign(next.user, clone(action.payload));
                }
                break;

            case "PATCH_SESSION_RUNTIME":
                if (action.payload && typeof action.payload === "object") {
                    if (action.payload.workout) Object.assign(next.workout, clone(action.payload.workout));
                    if (action.payload.timers) Object.assign(next.timers, clone(action.payload.timers));
                    if (action.payload.user) Object.assign(next.user, clone(action.payload.user));
                    if (action.payload.nutrition) Object.assign(next.nutrition, clone(action.payload.nutrition));
                }
                break;

            case "RESET_WORKOUT_RUNTIME":
                next.workout.currentIdx = 0;
                next.workout.phase = 0;
                next.workout.running = false;
                next.workout.sessionKcal = 0;
                next.timers.phaseRemainingSeconds = null;
                break;
        }

        next.meta.updatedAt = Date.now();
        next.meta.lastAction = action.type;

        return next;
    }

    function syncLegacyGlobals(nextState) {
        try {
            if (typeof window.exercises !== "undefined" && isDomExerciseArray(nextState.workout.exercises)) {
                window.exercises = nextState.workout.exercises;
            }
            if (
                typeof window.remainingSets !== "undefined" &&
                Array.isArray(nextState.workout.remainingSets) &&
                (nextState.workout.remainingSets.length > 0 || !Array.isArray(window.remainingSets) || window.remainingSets.length === 0)
            ) {
                window.remainingSets = nextState.workout.remainingSets;
            }
            if (typeof window.currentIdx !== "undefined") window.currentIdx = nextState.workout.currentIdx;
            if (typeof window.phase !== "undefined") window.phase = nextState.workout.phase;
            if (typeof window.running !== "undefined") window.running = nextState.workout.running;
            if (typeof window.totalSeconds !== "undefined") window.totalSeconds = nextState.timers.totalSeconds;
            if (typeof window.remainingSeconds !== "undefined") window.remainingSeconds = nextState.timers.remainingSeconds;
            if (typeof window.phaseRemainingSeconds !== "undefined") window.phaseRemainingSeconds = nextState.timers.phaseRemainingSeconds;
            if (typeof window.sessionActiveKcal !== "undefined") window.sessionActiveKcal = nextState.workout.sessionKcal;
            if (typeof window.userWeight !== "undefined") window.userWeight = nextState.user.weight;
            if (typeof window.muted !== "undefined") window.muted = nextState.user.muted;
            if (typeof window.TURBO_MODE !== "undefined") window.TURBO_MODE = nextState.timers.turboMode;
            if (typeof window.SPEED !== "undefined") window.SPEED = nextState.timers.speed;
        } catch (e) {
            console.warn("⚠️ PEGASUS CORE: Legacy sync warning", e);
        }
    }

    function dispatch(action) {
        const normalizedAction = action && action.type
            ? action
            : { type: "UNKNOWN_ACTION", payload: { raw: action } };

        state = reducer(state, normalizedAction);
        pushEventBuffer(normalizedAction);
        syncLegacyGlobals(state);
        if (shouldAutoCheckpoint(normalizedAction.type)) createCheckpoint(normalizedAction.type, state);
        if (shouldPersistRuntime(normalizedAction.type)) savePersistedRuntime(normalizedAction.type, state);

        listeners.forEach(fn => {
            try {
                fn(state, normalizedAction);
            } catch (e) {
                console.warn("⚠️ PEGASUS CORE LISTENER ERROR:", e);
            }
        });

        return state;
    }

    function getState() {
        return state;
    }

    function subscribe(fn) {
        if (typeof fn !== "function") return function() {};
        listeners.push(fn);

        return function unsubscribe() {
            listeners = listeners.filter(listener => listener !== fn);
        };
    }

    function replaceState(nextState, metaActionType = "REPLACE_STATE") {
        state = clone(nextState || getInitialState());
        pushEventBuffer({ type: metaActionType });
        syncLegacyGlobals(state);

        listeners.forEach(fn => {
            try {
                fn(state, { type: metaActionType });
            } catch (e) {
                console.warn("⚠️ PEGASUS CORE LISTENER ERROR:", e);
            }
        });

        return state;
    }

    function getEventBuffer() {
        return eventBuffer || [];
    }

    function clearEventBuffer() {
        eventBuffer = [];
        window._pegasusEventBuffer = [];
    }

    function replay(limit) {
        const events = (eventBuffer || []).slice(-(limit || eventBuffer.length));
        let replayState = getInitialState();

        events.forEach(ev => {
            const cleanEvent = clone(ev);
            delete cleanEvent.__ts;
            replayState = reducer(replayState, cleanEvent);
        });

        return replayState;
    }

    function hydrateFromLegacy(snapshot, actionType) {
        return dispatch({
            type: actionType || "HYDRATE_LEGACY_RUNTIME",
            payload: clone(snapshot || {})
        });
    }

    function getWorkoutState() {
        return clone(state.workout || {});
    }

    function getTimerState() {
        return clone(state.timers || {});
    }

    function getUserState() {
        return clone(state.user || {});
    }

    function getSessionSnapshot() {
        return {
            workout: getWorkoutState(),
            timers: getTimerState(),
            user: getUserState(),
            nutrition: clone(state.nutrition || {}),
            meta: clone(state.meta || {})
        };
    }

    function patchWorkoutRuntime(payload) {
        return dispatch({ type: "PATCH_WORKOUT_RUNTIME", payload: clone(payload || {}) });
    }

    function patchTimerRuntime(payload) {
        return dispatch({ type: "PATCH_TIMER_RUNTIME", payload: clone(payload || {}) });
    }

    function patchProgressRuntime(payload) {
        return dispatch({ type: "PATCH_PROGRESS_RUNTIME", payload: clone(payload || {}) });
    }

    function patchUserRuntime(payload) {
        return dispatch({ type: "PATCH_USER_RUNTIME", payload: clone(payload || {}) });
    }

    function patchSessionRuntime(payload) {
        return dispatch({ type: "PATCH_SESSION_RUNTIME", payload: clone(payload || {}) });
    }

    function setSelectedDay(selectedDay) {
        return dispatch({ type: "SET_SELECTED_DAY", payload: { selectedDay } });
    }

    function getSelectedDay() {
        return state?.workout?.selectedDay || null;
    }

    function getProgressSnapshot() {
        return buildProgressSnapshotFromState(state);
    }

    function getActionEntries(limit) {
        const entries = eventBuffer || [];
        return clone(entries.slice(-(limit || entries.length)));
    }

    function getActionTypes(limit) {
        return getActionEntries(limit).map(entry => entry.type);
    }

    function getWorkoutActionTypes(limit) {
        return getActionTypes(limit).filter(type => /^WORKOUT_/.test(type || ""));
    }

    function getCheckpoints(limit) {
        const items = checkpoints || [];
        return clone(items.slice(-(limit || items.length)));
    }

    function clearCheckpoints() {
        checkpoints = [];
        window._pegasusCheckpoints = [];
    }

    function replayProgress(limit) {
        return buildProgressSnapshotFromState(replay(limit));
    }

    function selectDayRuntime(payload) {
        return dispatch({ type: "WORKOUT_SELECT_DAY_RUNTIME", payload: clone(payload || {}) });
    }

    function startWorkoutRuntime(payload) {
        return dispatch({ type: "WORKOUT_START_RUNTIME", payload: clone(payload || {}) });
    }

    function pauseWorkoutRuntime(payload) {
        return dispatch({ type: "WORKOUT_PAUSE_RUNTIME", payload: clone(payload || {}) });
    }

    function nextExerciseRuntime(payload) {
        return dispatch({ type: "WORKOUT_NEXT_RUNTIME", payload: clone(payload || {}) });
    }

    function completeSetRuntime(payload) {
        return dispatch({ type: "WORKOUT_SET_COMPLETED_RUNTIME", payload: clone(payload || {}) });
    }

    function finishWorkoutRuntime(payload) {
        return dispatch({ type: "WORKOUT_FINISH_RUNTIME", payload: clone(payload || {}) });
    }


    function getProgressPercent(sourceState) {
        const snap = buildProgressSnapshotFromState(sourceState || state);
        const total = snap.totalSeconds || 0;
        const remaining = snap.remainingSeconds || 0;
        if (total <= 0) return 0;
        return Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
    }

    function getTimerDisplayState() {
        const snap = buildProgressSnapshotFromState(state);
        const remaining = typeof snap.remainingSeconds === "number" ? snap.remainingSeconds : 0;
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.floor(remaining % 60);

        return {
            totalSeconds: snap.totalSeconds || 0,
            remainingSeconds: remaining,
            phaseRemainingSeconds: snap.phaseRemainingSeconds,
            progressPercent: getProgressPercent(state),
            remainingText: `${minutes}:${String(seconds).padStart(2, "0")}`
        };
    }

    function getRuntimeSummary() {
        const snap = buildProgressSnapshotFromState(state);
        const remainingSets = Array.isArray(snap.remainingSets) ? snap.remainingSets : [];
        const hasRemainingWork = remainingSets.some(value => Number(value || 0) > 0);
        const hasExercises = remainingSets.length > 0;
        const isFinished = hasExercises && !hasRemainingWork;

        return {
            selectedDay: snap.selectedDay || null,
            currentIdx: snap.currentIdx ?? 0,
            phase: snap.phase ?? 0,
            running: !!snap.running,
            hasExercises,
            hasRemainingWork,
            isFinished,
            canStart: hasRemainingWork && !snap.running,
            canPause: !!snap.running,
            sessionKcal: snap.sessionKcal || 0,
            totalSeconds: snap.totalSeconds || 0,
            remainingSeconds: snap.remainingSeconds || 0,
            progressPercent: getProgressPercent(state)
        };
    }


    function getControlState() {
        const summary = getRuntimeSummary();
        const totalSeconds = Number(summary.totalSeconds || 0);
        const remainingSeconds = Number(summary.remainingSeconds || 0);
        const hasExercises = !!summary.hasExercises;
        const hasRemainingWork = !!summary.hasRemainingWork;
        const wasStarted = hasExercises && totalSeconds > 0 && remainingSeconds < totalSeconds;

        return {
            selectedDay: summary.selectedDay || null,
            running: !!summary.running,
            hasExercises,
            hasRemainingWork,
            isFinished: !!summary.isFinished,
            wasStarted,
            startLabel: summary.running ? "Παύση" : (wasStarted ? "Συνέχεια" : "Έναρξη"),
            nextLabel: "Επόμενο",
            canStart: hasExercises && hasRemainingWork && !summary.running,
            canPause: !!summary.running,
            canNext: hasExercises && hasRemainingWork
        };
    }

    function getUiState() {
        const progress = getProgressSnapshot();
        const timerDisplay = getTimerDisplayState();
        const summary = getRuntimeSummary();
        const controls = getControlState();
        const phaseIndex = Number(progress?.phase ?? 0);
        const phaseName = phaseIndex === 0 ? "prep" : (phaseIndex === 1 ? "work" : "rest");

        return {
            selectedDay: summary.selectedDay || controls.selectedDay || progress.selectedDay || null,
            phase: phaseIndex,
            phaseName,
            progress,
            timerDisplay,
            summary,
            controls,
            persisted: getPersistedRuntime()
        };
    }

    window.PegasusEngine = {
        __isCoreEngine: true,
        dispatch,
        getState,
        subscribe,
        replaceState,
        hydrateFromLegacy,
        patchWorkoutRuntime,
        patchTimerRuntime,
        patchProgressRuntime,
        patchUserRuntime,
        patchSessionRuntime,
        getPersistedRuntime,
        savePersistedRuntime,
        restorePersistedRuntime,
        clearPersistedRuntime,
        selectDayRuntime,
        startWorkoutRuntime,
        pauseWorkoutRuntime,
        nextExerciseRuntime,
        completeSetRuntime,
        finishWorkoutRuntime,
        setSelectedDay,
        getSelectedDay,
        getProgressSnapshot,
        getTimerDisplayState,
        getRuntimeSummary,
        getControlState,
        getUiState,
        getActionEntries,
        getActionTypes,
        getWorkoutActionTypes,
        getCheckpoints,
        createCheckpoint,
        clearCheckpoints,
        replayProgress,
        getWorkoutState,
        getTimerState,
        getUserState,
        getSessionSnapshot,
        getEventBuffer,
        clearEventBuffer,
        replay,
        getInitialState
    };

    window._pegasusEventBuffer = eventBuffer;
    window._pegasusCheckpoints = checkpoints;

    console.log("🧠 PEGASUS CORE: Engine initialized.");
})();
