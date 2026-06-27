/* ==========================================================================
   PEGASUS OS - MASTER MANIFEST & REGISTRY (v19.00)
   Protocol: Global Variable Re-declaration (Unlock M)
   Status: THE SINGLE SOURCE OF TRUTH | HARDENED: KEY CONSISTENCY + AUDIT SAFETY
   ========================================================================== */

window.PegasusManifest = {
    // ---------------------------------------------------------
    // 1. FORENSIC METADATA
    // ---------------------------------------------------------
    metadata: {
        os: "Pegasus OS",
        author: "Angelos & Gemini",
        last_update: "2026-05-09",
        logic_protocol: "Zero-Bug Simulation & Global Scope Shielding",
        engine_version: "v19.00 Next exercise video preview during rest"
    },

    // ---------------------------------------------------------
    // 2. EXECUTABLE DATA KEYS (Το Λεξικό της Μνήμης)
    // ---------------------------------------------------------
    system: {
        logs: "pegasus_system_logs",
        mute: "pegasus_mute_state",
        turbo: "pegasus_turbo_state",
        lastReset: "pegasus_last_reset",
        lastResetTimestamp: "pegasus_last_reset_timestamp",
        vaultPin: "pegasus_vault_pin",
        vaultData: "pegasus_vault_data",
        vaultTime: "pegasus_vault_time",
        geminiKey: "pegasus_gemini_key",
        errorLog: "pegasus_error_log",
        cmdTrace: "pegasus_command_trace",
        stats: "pegasus_stats",
        lastPush: "pegasus_last_push",
        lastReport: "pegasus_last_auto_report",
        lastEmailSent: "pegasus_last_email_sent_date",
        weatherCode: "pegasus_weather_code"
    },

    user: {
        weight: "pegasus_weight",
        weightHistory: "pegasus_weight_history",
        legacyWeight: "weight_ΑΓΓΕΛΟΣ",
        age: "pegasus_age",
        height: "pegasus_height",
        gender: "pegasus_gender",
        specs: "pegasus_user_specs",
        notes: "pegasus_notes",
        contacts: "pegasus_contacts",
        partners: "pegasus_partners_list"
    },

    workout: {
        weekly_history: "pegasus_weekly_history",
        done: "pegasus_workouts_done",
        total: "pegasus_total_workouts",

        // legacy compatibility key base
        cardio_offset: "pegasus_cardio_offset_sets",

        // canonical per-day cardio key prefix
        cardio_daily_prefix: "pegasus_cardio_kcal_",

        cardio_history: "pegasus_cardio_history",
        activePlan: "pegasus_active_plan",
        muscleTargets: "pegasus_muscle_targets",
        calendarHistory: "pegasus_calendar_history",
        exerciseWeights: "pegasus_exercise_weights",
        ex_time: "pegasus_ex_time",
        rest_time: "pegasus_rest_time",
        weekendCarryover: "pegasus_weekend_carryover_v1"
    },

    nutrition: {
        log_prefix: "food_log_"
    },

    diet: {
        weekly_kcal: "pegasus_weekly_kcal",
        weeklyKcal: "pegasus_weekly_kcal",      // alias compatibility

        session_kcal: "pegasus_session_kcal",
        sessionKcal: "pegasus_session_kcal",    // alias compatibility

        inventory: "pegasus_supp_inventory",
        foodLibrary: "pegasus_food_library",
        todayKcal: "pegasus_today_kcal",
        todayProtein: "pegasus_today_protein",
        bodyGoalMode: "pegasus_body_goal_mode"
    },

    kouki: {
        agreement: "kouki_agreement_log",
        totalMeals: "kouki_meals_total",
        remaining: "kouki_meals_remaining",
        totalStock: "kouki_total_stock"
    },

    car: {
        identity: "pegasus_car_identity",
        dates: "pegasus_car_dates",
        service: "pegasus_car_service",
        legacySpecs: "pegasus_car_specs",
        legacyService: "peg_car_service",
        legacyDates: "peg_car_dates"
    },

    parking: {
        loc: "pegasus_parking_loc",
        history: "pegasus_parking_history"
    },

    // ---------------------------------------------------------
    // 3. SYSTEM ARCHITECTURE
    // ---------------------------------------------------------
    architecture: {
        "manifest.js": "Κεντρικός ορισμός LocalStorage keys & System Blueprint.",
        "app.js": "Master Orchestrator / Event Bus (UI & Workout Timer).",
        "food.js": "Nutrition Logic & Συμφωνία 30 Γευμάτων (Κούκι).",
        "protcrea.js": "Inventory Guard (Πρωτεΐνη 2500g / Κρεατίνη 1000g).",
        "weightTracker.js": "Biometric Trend Analyzer (Moving Average).",
        "dietAdvisor.js": "Nutritional Intelligence Engine (Gap Analysis).",
        "optimizer.js": "AI Training Volumizer (Dynamic Set Adjustment).",
        "pegasusBrain.js": "Dynamic Weekly Planner, carry-over and recovery guard.",
        "cloudSync.js": "Security & Persistence Layer (API & Vault PIN).",
        "cardio.js": "Cardio Engine (+18 σετ πόδια & Kcal target modifier).",
        "auditUI.js": "Real-time System Integrity Monitor & Diagnostic Tool.",
        "debug.js": "Tracer, health checks, calorie audit and runtime diagnostics.",
        "car.js": "Vehicle Management Module.",
        "parking.js": "Manual Parking Notes & Recent Locations Module.",
        "mobile/mobile.html": "Mobile shell, unlock flow, silent local master-key and data management hub.",
        "dragDrop.js": "UI Window Positioning Memory.",
        "ems.js": "Electro-Muscle Stimulation Tracker & Sync.",
        "partner.js": "Smart Co-Lifter Logic & Dual Weight Memory.",
        "reporting.js": "EmailJS Automated Morning Dispatcher."
    },

    // ---------------------------------------------------------
    // 4. CONSOLE FORENSIC TOOLS
    // ---------------------------------------------------------
    inspect: function() {
        console.log("%c 🏛️ PEGASUS OS FULL SYSTEM INSPECTION", "color: #00ff41; font-size: 20px; font-weight: bold;");
        console.table(this.metadata);
        console.log("%c 📂 ARCHITECTURE:", "color: #f39c12; font-weight: bold;");
        console.table(this.architecture);
    },

    whereIs: function(query) {
        const q = String(query || "").toLowerCase();

        for (let file in this.architecture) {
            if (this.architecture[file].toLowerCase().includes(q)) {
                return `📍 Η λογική '${query}' βρίσκεται στο: ${file}`;
            }
        }

        return "❌ Δεν βρέθηκε αναφορά στο System Blueprint.";
    },

    auditData: function() {
        console.log("%c🔍 PEGASUS DATA AUDIT STARTING...", "color: #00bcd4; font-weight: bold; font-size: 14px;");

        const manifestStr = JSON.stringify(this);
        const legacyCardioPrefix = (this.workout?.cardio_offset || "pegasus_cardio_offset_sets") + "_";
        const canonicalCardioPrefix = this.workout?.cardio_daily_prefix || "pegasus_cardio_kcal_";

        let orphanKeys = [];
        let validKeys = [];

        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (!key) continue;

            if (
                key.startsWith("food_log_") ||
                key.startsWith("weight_") ||
                key.startsWith("pegasus_weight_") ||
                key.startsWith(canonicalCardioPrefix) ||
                key.startsWith(legacyCardioPrefix) ||
                key.startsWith("pegasus_pos_") ||
                key.startsWith("pegasus_weekend_training_mode_") ||
                key.startsWith("pegasus_routine_injected_") ||
                key.startsWith("pegasus_history_") ||
                key.startsWith("pegasus_day_status_") ||
                key.startsWith("cardio_log_")
            ) {
                validKeys.push(key);
                continue;
            }

            if (manifestStr.includes(`"${key}"`)) {
                validKeys.push(key);
            } else {
                orphanKeys.push(key);
            }
        }

        console.log(`✅ Καταγεγραμμένα & Έγκυρα Κλειδιά: ${validKeys.length}`);

        if (orphanKeys.length > 0) {
            console.warn(`⚠️ Προσοχή: Βρέθηκαν ${orphanKeys.length} Ορφανά Κλειδιά!`);
            console.table(orphanKeys.map(k => ({ "Ορφανό Κλειδί": k })));
        } else {
            console.log("%c🛡️ Σύστημα καθαρό.", "color: #4CAF50; font-weight: bold;");
        }
    }
};

// 🛡️ ΤΟ ΚΛΕΙΔΙ ΤΟΥ UNLOCK
var M = window.PegasusManifest;

console.log("🏛️ PEGASUS MANIFEST v19.00 LOADED. NEXT EXERCISE PREVIEW READY.");
