/* ==========================================================================
   🎬 PEGASUS MODULE: CINEMA & ENTERTAINMENT TRACKER (v1.0)
   Protocol: Watchlist Funnel & Binary Evaluation
   ========================================================================== */

(function() {
    const MOVIES_DATA_KEY = 'pegasus_movies_v1';

    // 1. Μηχανή Δεδομένων (State & CRUD Logic)
    window.PegasusMovies = {
        toggleAddForm: function() {
            const form = document.getElementById('addMovieForm');
            const btn = document.getElementById('btnAddMovie');
            if(form.style.display === 'none') {
                form.style.display = 'block';
                btn.innerHTML = 'Χ Κλείσιμο';
                btn.style.background = '#ff4444';
            } else {
                form.style.display = 'none';
                btn.innerHTML = '+ Νέα ταινία';
                btn.style.background = 'var(--main)';
            }
        },

        addNewMovie: function() {
            const title = document.getElementById('newMovieTitle').value;

            if(!title || title.trim() === '') {
                alert('Σφάλμα: Εισάγετε τον τίτλο της ταινίας.');
                return;
            }

            let movies = JSON.parse(localStorage.getItem(MOVIES_DATA_KEY)) || [];

            const newEntry = {
                id: 'mov_' + Date.now(),
                title: title.trim(),
                status: 'pending', // pending, liked, disliked
                dateAdded: new Date().toLocaleDateString('el-GR'),
                dateWatched: null
            };

            movies.unshift(newEntry);
            this.saveAndRender(movies);
            this.toggleAddForm();

            document.getElementById('newMovieTitle').value = '';
        },

        evaluateMovie: function(id, evaluation) {
            let movies = JSON.parse(localStorage.getItem(MOVIES_DATA_KEY)) || [];
            const idx = movies.findIndex(m => m.id === id);
            if (idx === -1) return;

            movies[idx].status = evaluation; // 'liked' ή 'disliked'
            movies[idx].dateWatched = new Date().toLocaleDateString('el-GR');

            this.saveAndRender(movies);
        },

        deleteMovie: function(id) {
            if(confirm('Διαγραφή αυτής της ταινίας από τη βάση δεδομένων;')) {
                let movies = JSON.parse(localStorage.getItem(MOVIES_DATA_KEY)) || [];
                movies = movies.filter(m => m.id !== id);
                this.saveAndRender(movies);
            }
        },

saveAndRender: function(data) {
            // 1. Αποθηκεύει τοπικά για ταχύτητα (Offline mode)
            localStorage.setItem(MOVIES_DATA_KEY, JSON.stringify(data));

            // 2. Ενημερώνει την οθόνη ακαριαία
            window.renderMoviesContent();

            // 3. ☁️ REAL-TIME CLOUD TRIGGER: Στέλνει τα δεδομένα στο Cloud!
            if (window.PegasusCloud) {
                if (typeof window.PegasusCloud.upload === 'function') window.PegasusCloud.upload();
                else if (typeof window.PegasusCloud.sync === 'function') window.PegasusCloud.sync();
                else if (typeof window.PegasusCloud.save === 'function') window.PegasusCloud.save();
                else if (typeof window.PegasusCloud.push === 'function') window.PegasusCloud.push();
            }
        }
    };

    // 2. Κατασκευαστής Οθόνης (View Injector)
    function injectViewLayer() {
        if (document.getElementById('movies')) return;
        const viewDiv = document.createElement('div');
        viewDiv.id = 'movies';
        viewDiv.className = 'view';

        viewDiv.innerHTML = `
            <button class="btn-back" onclick="openView('home')">◀ Επιστροφή</button>
            <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
                <button id="btnAddMovie" class="primary-btn" style="width: auto; margin: 0 auto; padding: 7px 14px; font-size: 10px; border-radius: 8px;" onclick="window.PegasusMovies.toggleAddForm()">
                    + Νέα ταινία
                </button>
            </div>

            <div id="addMovieForm" class="mini-card" style="display: none; border-color: var(--main); margin-bottom: 20px; padding: 15px;">
                <div style="font-size: 11px; font-weight: 900; color: var(--main); margin-bottom: 10px; text-align: center;">Καταχώρηση στη watchlist</div>
                <input type="text" id="newMovieTitle" placeholder="Τίτλος Ταινίας ή Σειράς..." style="margin-bottom: 15px; border: 2px solid #444;">
                <button class="primary-btn" onclick="window.PegasusMovies.addNewMovie()">Προσθήκη</button>
            </div>

            <div class="section-title" style="margin-top: 10px; color: var(--main);">👀 Προσεχώς (watchlist)</div>
            <div id="movies-watchlist" style="width: 100%; display: flex; flex-direction: column; gap: 10px; margin-bottom: 30px;"></div>

            <div class="section-title" style="color: #555;">✅ Ιστορικό προβολών</div>
            <div id="movies-history" style="width: 100%; display: flex; flex-direction: column; gap: 10px; padding-bottom: 80px;"></div>
        `;
        document.body.appendChild(viewDiv);
    }

    // 3. Rendering Engine (Διαχωρισμός Δεδομένων)
    window.renderMoviesContent = function() {
        const watchlistContainer = document.getElementById('movies-watchlist');
        const historyContainer = document.getElementById('movies-history');
        if (!watchlistContainer || !historyContainer) return;

        const movies = JSON.parse(localStorage.getItem(MOVIES_DATA_KEY)) || [];

        let watchlistHtml = '';
        let historyHtml = '';

        movies.forEach(movie => {
            if (movie.status === 'pending') {
                // RENDER: WATCHLIST
                watchlistHtml += `
                    <div class="mini-card" style="border-left: 4px solid var(--main); padding: 15px; background: rgba(15,15,15,0.95);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                            <div>
                                <div style="font-weight: 900; font-size: 16px; color: #fff;">${movie.title}</div>
                                <div style="font-size: 9px; color: #777; margin-top: 4px;">Προστέθηκε: ${movie.dateAdded}</div>
                            </div>
                            <button onclick="window.PegasusMovies.deleteMovie('${movie.id}')"
                                    style="background: transparent; border: none; color: #ff4444; font-size: 16px; padding: 0 5px; cursor: pointer;">🗑️</button>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="primary-btn" style="flex: 1; padding: 10px; font-size: 11px; background: #008f25; border: 1px solid #00ff41; color: #fff;"
                                    onclick="window.PegasusMovies.evaluateMovie('${movie.id}', 'liked')">
                                👍 Μου άρεσε
                            </button>
                            <button class="primary-btn" style="flex: 1; padding: 10px; font-size: 11px; background: #8f0000; border: 1px solid #ff4444; color: #fff;"
                                    onclick="window.PegasusMovies.evaluateMovie('${movie.id}', 'disliked')">
                                👎 Χάλια
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // RENDER: HISTORY
                const isLiked = movie.status === 'liked';
                const borderColor = isLiked ? '#00ff41' : '#ff4444';
                const icon = isLiked ? '👍' : '👎';

                historyHtml += `
                    <div class="mini-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-left: 4px solid ${borderColor}; opacity: 0.8;">
                        <div style="text-align: left;">
                            <div style="font-size: 14px; font-weight: 900; color: #fff; margin-bottom: 2px;">${icon} ${movie.title}</div>
                            <div style="font-size: 9px; color: #555;">Είδατε: ${movie.dateWatched}</div>
                        </div>
                        <button onclick="window.PegasusMovies.deleteMovie('${movie.id}')"
                                style="background: rgba(255,68,68,0.1); border: 1px solid #ff4444; color: #ff4444; border-radius: 8px; padding: 6px 10px; font-size: 12px; cursor: pointer;">
                            🗑️
                        </button>
                    </div>
                `;
            }
        });

        watchlistContainer.innerHTML = watchlistHtml || '<div style="color:#555; font-size:11px; text-align:center;">Η λίστα είναι άδεια</div>';
        historyContainer.innerHTML = historyHtml || '<div style="color:#333; font-size:11px; text-align:center;">Κανένα ιστορικό προβολών</div>';
    };

    // 4. Boot Sequence
    document.addEventListener("DOMContentLoaded", () => {
        injectViewLayer();
        window.renderMoviesContent();

        if (window.registerPegasusModule) {
            window.registerPegasusModule({
                id: 'movies',
                label: 'Ταινίες',
                icon: '🎬'
            });
        }
    });
})();
