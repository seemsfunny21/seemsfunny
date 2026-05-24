/* ==========================================================================
   💬 PEGASUS MODULE: BEHAVIORAL TRACKER (SOCIAL METRICS v1.7)
   Protocol: Fortress Security, Permanent Add Form, Anti-Tabnabbing & PIN Lock
   ========================================================================== */

(function() {
    const SOCIAL_DATA_KEY = 'pegasus_social_v1';
    let currentSearchTerm = "";
    let currentSortOrder = "DESC";
    let isUnlocked = false; // 🔒 GLOBAL SECURITY STATE

    // 🛡️ Data Sanitization Engine (XSS Protection)
    const sanitizeHTML = (str) => {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
            }[tag] || tag)
        );
    };

    window.PegasusSocial = {
        // 🛡️ SECURITY ENGINE
        verifyPin: function() {
            const input = document.getElementById('socialPinInput').value;
            let masterPin = localStorage.getItem('pegasus_master_pin');

            // 1. First-Time Setup
            if (!masterPin) {
                if (input.length < 4) {
                    alert("Το PIN πρέπει να έχει τουλάχιστον 4 ψηφία.");
                    return;
                }
                localStorage.setItem('pegasus_master_pin', input);
                alert("✅ Το Master PIN ορίστηκε επιτυχώς! Απομνημόνευσέ το.");
                masterPin = input;
            }

            // 2. Strict Verification
            if (input === masterPin) {
                isUnlocked = true;
                document.getElementById('socialLockScreen').style.display = 'none';
                document.getElementById('socialSecureArea').style.display = 'block';
                document.getElementById('socialPinInput').value = '';
                document.getElementById('pinError').style.display = 'none';

                this.handleSearch(""); // Reset search and Load Data
                this.ensureAddFormOpen();
            } else {
                // 🛑 UNAUTHORIZED ACCESS: Lockdown Mode
                isUnlocked = false;
                document.getElementById('pinError').style.display = 'block';
                document.getElementById('socialPinInput').value = '';

                // Ghost DOM Purge
                const container = document.getElementById('social-content');
                if (container) container.innerHTML = '';
            }
        },

        lockVault: function() {
            isUnlocked = false;
            document.getElementById('socialLockScreen').style.display = 'flex';
            document.getElementById('socialSecureArea').style.display = 'none';
            document.getElementById('socialPinInput').value = '';
            document.getElementById('pinError').style.display = 'none';

            // 🛡️ GHOST DOM PURGE
            const container = document.getElementById('social-content');
            if (container) container.innerHTML = '';
            currentSearchTerm = ""; // Reset memory
        },

        // --- CORE LOGIC ---
        setRating: function(id, newRating) {
            if (!isUnlocked) return;
            let entities = JSON.parse(localStorage.getItem(SOCIAL_DATA_KEY)) || [];
            const idx = entities.findIndex(e => e.id === id);
            if (idx === -1) return;

            entities[idx].rating = newRating;
            this.saveAndRender(entities);
        },

        editEntry: function(id) {
            if (!isUnlocked) return;
            let entities = JSON.parse(localStorage.getItem(SOCIAL_DATA_KEY)) || [];
            const idx = entities.findIndex(e => e.id === id);
            if (idx === -1) return;

            const newVal = prompt("Επεξεργασία (Όνομα & Link):", entities[idx].name);
            if (newVal !== null && newVal.trim() !== '') {
                entities[idx].name = sanitizeHTML(newVal.trim());
                this.saveAndRender(entities);
            }
        },

        deleteEntry: function(id) {
            if (!isUnlocked) return;
            if(confirm('Οριστική διαγραφή αυτής της εγγραφής;')) {
                let entities = JSON.parse(localStorage.getItem(SOCIAL_DATA_KEY)) || [];
                entities = entities.filter(e => e.id !== id);
                this.saveAndRender(entities);
            }
        },

        ensureAddFormOpen: function() {
            const form = document.getElementById('addSocialForm');
            const btn = document.getElementById('btnAddSocial');

            if (form) {
                form.style.display = 'block';
            }

            if (btn) {
                btn.innerHTML = '+ Νέα εγγραφή';
                btn.style.background = 'var(--main)';
                btn.style.color = '#000';
            }

            const input = document.getElementById('newSocialName');
            if (input) setTimeout(() => input.focus(), 0);
        },

        toggleAddForm: function() {
            // Kept as a compatibility alias: the add form is permanently open.
            this.ensureAddFormOpen();
        },

        addNewEntry: function() {
            if (!isUnlocked) return;
            const name = document.getElementById('newSocialName').value;
            if(!name || name.trim() === '') return;

            let entities = JSON.parse(localStorage.getItem(SOCIAL_DATA_KEY)) || [];

            const newEntry = {
                id: 'soc_' + Date.now(),
                name: sanitizeHTML(name.trim()), // 🛡️ XSS Check
                rating: 0,
                dateAdded: new Date().toLocaleDateString('el-GR')
            };

            entities.unshift(newEntry);
            this.saveAndRender(entities);
            document.getElementById('newSocialName').value = '';
            this.ensureAddFormOpen();
        },

        handleSearch: function(term) {
            currentSearchTerm = term.toLowerCase().trim();
            window.renderSocialContent();
        },

        toggleSort: function() {
            currentSortOrder = (currentSortOrder === "DESC") ? "ASC" : "DESC";
            window.renderSocialContent();
        },

        saveAndRender: function(data) {
            localStorage.setItem(SOCIAL_DATA_KEY, JSON.stringify(data));
            window.renderSocialContent();
            if (window.PegasusCloud && typeof window.PegasusCloud.push === 'function') {
                window.PegasusCloud.push();
            }
        }
    };

    function injectViewLayer() {
        if (document.getElementById('social')) return;
        const viewDiv = document.createElement('div');
        viewDiv.id = 'social';
        viewDiv.className = 'view';

        viewDiv.innerHTML = `
            <button class="btn-back" onclick="window.PegasusSocial.lockVault(); openView('home')">◀ Επιστροφή</button>

            <div id="socialLockScreen" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; text-align: center;">
                <div style="font-size: 50px; margin-bottom: 15px;">🔒</div>
                <h2 style="color: #ff4444; letter-spacing: 2px; margin-bottom: 5px; font-weight: 900;">Secure vault</h2>
                <p style="color: #666; font-size: 11px; margin-bottom: 25px; max-width: 250px;">Αυστηρά προσωπικά δεδομένα. Απαιτείται επιβεβαίωση ταυτότητας.</p>

                <input type="password" id="socialPinInput" placeholder="••••"
                       inputmode="numeric" maxlength="4"
                       onkeypress="if(event.key === 'Enter') window.PegasusSocial.verifyPin()"
                       style="text-align: center; font-size: 30px; letter-spacing: 8px; width: 150px; background: #0a0a0a; color: #00ff41; border: 2px solid #333; border-radius: 12px; padding: 15px; margin-bottom: 20px;">

                <button class="primary-btn" onclick="window.PegasusSocial.verifyPin()" style="width: 150px; padding: 15px; font-size: 14px;">Ξεκλείδωμα</button>
                <p id="pinError" style="color: #ff4444; font-size: 12px; margin-top: 15px; display: none; font-weight: bold;">❌ Λάθος PIN. Προσπαθήστε ξανά.</p>
            </div>

            <div id="socialSecureArea" style="display: none;">
                <div style="margin-bottom: 15px;">
                    <input type="text" id="socialSearchInput"
                           placeholder="🔍 Αναζήτηση επαφής..."
                           onkeyup="window.PegasusSocial.handleSearch(this.value)"
                           style="width: 100%; background: #000; color: var(--main); border: 1px solid #333; padding: 12px; border-radius: 12px; font-family: inherit; box-sizing: border-box; text-align: center;">
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button id="btnSortSocial" class="secondary-btn" style="flex: 1; margin: 0; padding: 8px 5px; font-size: 10px; border-radius: 8px; background: transparent; border: 1px solid #00ff41; color: #00ff41; font-weight: 900;" onclick="window.PegasusSocial.toggleSort()">
                        🔽 Υψηλή βαθμολογία
                    </button>
                    <button id="btnAddSocial" class="primary-btn" style="flex: 1; margin: 0; padding: 8px 5px; font-size: 11px; border-radius: 8px; color: #000;" onclick="window.PegasusSocial.ensureAddFormOpen()">
                        + Νέα εγγραφή
                    </button>
                </div>

                <div id="addSocialForm" class="mini-card" style="display: block; border-color: var(--main); margin-bottom: 20px; padding: 15px;">
                    <input type="text" id="newSocialName" placeholder="Όνομα & Link Προφίλ..." style="margin-bottom: 15px; border: 2px solid #444;">
                    <button class="primary-btn" onclick="window.PegasusSocial.addNewEntry()">Αποθήκευση</button>
                </div>

                <div id="social-content" style="width: 100%; display: flex; flex-direction: column; gap: 15px; padding-bottom: 80px;"></div>
            </div>
        `;
        document.body.appendChild(viewDiv);
    }

    window.renderSocialContent = function() {
        if (!isUnlocked) return; // 🛑 Αποτροπή render αν το vault είναι κλειδωμένο

        const container = document.getElementById('social-content');
        if (!container) return;

        let entities = JSON.parse(localStorage.getItem(SOCIAL_DATA_KEY)) || [];

        if (currentSearchTerm !== "") {
            entities = entities.filter(item => item.name.toLowerCase().includes(currentSearchTerm));
        }

        entities.sort((a, b) => {
            if (currentSortOrder === "DESC") return b.rating - a.rating;
            else return a.rating - b.rating;
        });

        const sortBtn = document.getElementById('btnSortSocial');
        if (sortBtn) {
            sortBtn.innerHTML = currentSortOrder === "DESC" ? "🔽 Υψηλή βαθμολογία" : "🔼 Χαμηλή βαθμολογία";
            sortBtn.style.color = currentSortOrder === "DESC" ? "#00ff41" : "#ff4444";
            sortBtn.style.borderColor = currentSortOrder === "DESC" ? "#00ff41" : "#ff4444";
        }

        container.innerHTML = entities.map(item => {
            let activeColor = '#555';
            let labelText = 'Αξιολογήστε';

            if (item.rating > 0) {
                if (item.rating <= 3) { activeColor = '#ff4444'; labelText = 'Χαμηλή επικοινωνία'; }
                else if (item.rating <= 7) { activeColor = '#ffbb33'; labelText = 'Κανονική ροή'; }
                else { activeColor = '#00ff41'; labelText = 'Υψηλή ομιλητικότητα'; }
            }

            let displayName = item.name;
            let linkIconHtml = '';
            const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
            const urlMatch = item.name.match(urlRegex);

            if (urlMatch) {
                let hrefUrl = urlMatch[0].startsWith('http') ? urlMatch[0] : 'https://' + urlMatch[0];
                let lowUrl = hrefUrl.toLowerCase();

                let platformName = "LINK";
                let platformBg = "#555";
                let platformTxt = "#fff";

                if (lowUrl.includes("facebook.com") || lowUrl.includes("fb.com")) {
                    platformName = "FB PROFILE";
                    platformBg = "#1877F2";
                } else if (lowUrl.includes("instagram.com")) {
                    platformName = "INSTA PROFILE";
                    platformBg = "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)";
                } else if (lowUrl.includes("tiktok.com")) {
                    platformName = "TIKTOK PROFILE";
                    platformBg = "#000000";
                    platformTxt = "#00f2fe";
                } else if (lowUrl.includes("linkedin.com")) {
                    platformName = "LINKEDIN";
                    platformBg = "#0A66C2";
                }

                displayName = item.name.replace(urlMatch[0], '').trim();
                if (displayName === '') displayName = "Άγνωστη Επαφή";

                // 🛡️ ANTI-TABNABBING: Προστέθηκε rel="noopener noreferrer"
                linkIconHtml = `
                    <a href="${hrefUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"
                       style="margin-left: 10px; background: ${platformBg}; color: ${platformTxt}; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 900; letter-spacing: 0.5px; text-decoration: none; display: inline-flex; align-items: center; vertical-align: middle; box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                        🔗 ${platformName}
                    </a>
                `;
            }

            let scaleHtml = '<div style="display: flex; gap: 4px; margin-top: 12px;">';
            for (let i = 1; i <= 10; i++) {
                let isActive = i <= item.rating;
                let bg = isActive ? activeColor : 'rgba(255,255,255,0.03)';
                let textCol = isActive ? '#000' : '#666';
                let border = isActive ? 'none' : '1px solid #333';
                scaleHtml += `
                    <div onclick="window.PegasusSocial.setRating('${item.id}', ${i})"
                         style="flex: 1; height: 35px; display: flex; align-items: center; justify-content: center;
                                background: ${bg}; color: ${textCol}; border: ${border}; border-radius: 6px;
                                font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.2s;">
                        ${i}
                    </div>
                `;
            }
            scaleHtml += '</div>';

            return `
                <div class="mini-card" style="border-left: 4px solid ${activeColor}; padding: 15px; background: rgba(15,15,15,0.95);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="font-weight: 900; font-size: 18px; color: #fff; display: flex; align-items: center; flex-wrap: wrap;">
                                ${displayName} ${linkIconHtml}
                            </div>
                            <div style="font-size: 10px; color: ${activeColor}; font-weight: 900; margin-top: 4px; letter-spacing: 1px;">
                                [ ${labelText} ]
                            </div>
                        </div>

                        <div style="display: flex; gap: 6px;">
                            <button onclick="window.PegasusSocial.editEntry('${item.id}')"
                                    style="background: rgba(255,255,255,0.05); border: 1px solid #444; color: #ccc; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;">
                                ⚙️
                            </button>
                            <button onclick="window.PegasusSocial.deleteEntry('${item.id}')"
                                    style="background: rgba(255,68,68,0.1); border: 1px solid #ff4444; color: #ff4444; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;">
                                🗑️
                            </button>
                        </div>
                    </div>
                    ${scaleHtml}
                </div>
            `;
        }).join('');

        if (entities.length === 0) {
            container.innerHTML = `<div style="color:#555; font-size:12px; text-align:center; margin-top:30px; font-weight:800;">
                ${currentSearchTerm === "" ? "Καμία εγγραφή στη βάση" : "Δεν βρέθηκαν αποτελέσματα"}
            </div>`;
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        injectViewLayer();
        // 🔒 ΣΙΩΠΗΛΗ ΕΚΚΙΝΗΣΗ: Το renderSocialContent ΔΕΝ καλείται εδώ!
        if (window.registerPegasusModule) {
            window.registerPegasusModule({ id: 'social', label: 'Επαφές', icon: '💬' });
        }
    });
})();
