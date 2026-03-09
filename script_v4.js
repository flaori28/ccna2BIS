/**
 * CCNA 2 Exam Trainer - Core Logic v3.1 (Final)
 * Includes robust error handling and click-to-move for mobile.
 */

const App = {
    state: {
        questions: [],
        currentSeries: null,
        currentChunkSize: 60, // Default to exam mode
        currentTitle: '',
        currentQuestions: [],
        userHistory: [],
        view: 'dashboard',
        selectedDraggable: null // for click-to-move fallback
    },

    init: function() {
        console.log("App Initializing...");
        // Global Error Handler
        window.onerror = function(msg, url, line, col, error) {
            const errBox = document.createElement('div');
            errBox.style.cssText = "position:fixed; top:0; left:0; width:100%; background:red; color:white; z-index:9999; padding:10px;";
            errBox.innerText = `Erreur JS: ${msg} (Ligne ${line})`;
            document.body.prepend(errBox);
            return false;
        };

        const loader = document.getElementById('global-stats');
        if (loader) loader.innerHTML = '<span>Initialisation...</span>';

        try {
            this.loadHistory();
            this.loadData();
            this.setupNavigation();
            this.renderstats();
        } catch (err) {
            console.error("Init Error", err);
            if (loader) loader.innerHTML = `<span style="color:red">Erreur !</span>`;
            alert("Erreur de chargement: " + err.message);
        }
    },

    loadData: function() {
        const grid = document.getElementById('series-list');
        
        if (typeof allQuestions !== 'undefined' && Array.isArray(allQuestions)) {
            // SHUFFLE QUESTIONS GLOBALLY TO MIX THEM
            try {
                if (allQuestions.length === 0) {
                     throw new Error("Le fichier de questions est vide (0 questions).");
                }
                this.state.questions = this.shuffleArray([...allQuestions]);
                this.renderSeriesList();
            } catch (e) {
                console.error("Error processing questions:", e);
                if (grid) grid.innerHTML = `<p style='color:red; user-select:text;'>Erreur critique lors du traitement des questions: ${e.message}</p>`;
            }
        } else {
            console.error("Data source 'allQuestions' not found!");
            if (grid) grid.innerHTML = "<p style='color:red; font-weight:bold; padding:20px; border:1px solid red;'>ERREUR: Les questions (data_final.js) ne sont pas chargées. Vérifiez votre connexion ou l'URL.</p>";
            
            // Allow retry
            const retryBtn = document.createElement('button');
            retryBtn.textContent = "Réessayer le chargement";
            retryBtn.onclick = () => window.location.reload();
            retryBtn.style.marginTop = "10px";
            if (grid) grid.appendChild(retryBtn);
        }
    },
    
    // Fisher-Yates Shuffle
    shuffleArray: function(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    loadHistory: function() {
        try {
            const raw = localStorage.getItem('ccna2_history');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.state.userHistory = parsed;
                } else {
                    console.warn("History format invalid (not an array), resetting.");
                    this.state.userHistory = [];
                }
            } else {
                this.state.userHistory = [];
            }
        } catch (e) {
            console.warn("History access failed or corrupted (Private Mode?):", e);
            this.state.userHistory = [];
        }
    },

    saveHistory: function(result) {
        try {
            if (!Array.isArray(this.state.userHistory)) this.state.userHistory = [];
            this.state.userHistory.push(result);
            localStorage.setItem('ccna2_history', JSON.stringify(this.state.userHistory));
        } catch(e) {
            console.warn("Could not save history:", e);
        }
        this.renderstats();
    },

    renderstats: function() {
        try {
            const history = this.state.userHistory || [];
            if (!Array.isArray(history)) {
                 // Should be caught by loadHistory but safe guard
                 return;
            }
            
            const totalAttempts = history.length;
            let totalScore = 0;
            let maxScore = 0;
            
            history.forEach(h => {
                if (h && typeof h.score === 'number' && typeof h.total === 'number') {
                    totalScore += h.score;
                    maxScore += h.total;
                }
            });

            const avg = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
            
            // Header Mini Stats
            const headerStats = document.getElementById('global-stats');
            if (headerStats) headerStats.textContent = `Moyenne Globale: ${avg}%`;

            // Dashboard Stats
            const dash = document.getElementById('stats-dashboard');
            if (dash) {
                dash.innerHTML = `
                    <div class="stat-metric">
                        <h3>${avg}%</h3>
                        <span>Moyenne</span>
                    </div>
                    <div class="stat-metric">
                        <h3>${totalAttempts}</h3>
                        <span>Examens Terminés</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error("renderStats Error:", error);
            const headerStats = document.getElementById('global-stats');
            if (headerStats) headerStats.textContent = "Erreur Stats";
        }
    },

    renderSeriesList: function() {
        const grid = document.getElementById('series-list');
        if (!grid) return;
        grid.innerHTML = '';

        const totalQ = this.state.questions.length;

        // --- CUSTOM TAB CONTAINER ---
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tab-container';
        
        const btnExamTab = document.createElement('button');
        btnExamTab.textContent = "Mode Examen (60)";
        btnExamTab.className = 'btn-tab';
        
        const btnTrainTab = document.createElement('button');
        btnTrainTab.textContent = "Mode Série (10)";
        btnTrainTab.className = 'btn-tab active';

        tabsContainer.appendChild(btnExamTab);
        tabsContainer.appendChild(btnTrainTab);
        grid.appendChild(tabsContainer);

        // --- CONTENT CONTAINER ---
        const contentContainer = document.createElement('div');
        contentContainer.className = 'series-grid'; // Use grid layout
        contentContainer.style.width = '100%';
        grid.appendChild(contentContainer);

        const renderExamMode = () => {
            contentContainer.innerHTML = '';
            
            // Tab Styles
            btnExamTab.classList.add('active');
            btnExamTab.classList.remove('btn-tab-inactive');
            btnTrainTab.classList.remove('active');
            
            const chunkExam = 60;
            const totalExams = Math.ceil(totalQ / chunkExam);

            if(totalExams === 0) {
                 contentContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Aucune question disponible.</p>';
                 return;
            }

            for (let i = 1; i <= totalExams; i++) {
                const btn = document.createElement('div');
                btn.className = 'btn-series';
                // Distinctive styling for Exams
                btn.style.borderLeft = '6px solid #0078d4';
                btn.innerHTML = `
                    <h4 style="color:#0078d4"><i class="fas fa-file-contract"></i> Examen ${i}</h4>
                    <span style="display:block; margin-top:5px; font-weight:500;">60 Questions</span>
                    <span style="font-size:0.8rem; color:#888;">Index: ${(i-1)*chunkExam + 1}-${Math.min(i*chunkExam, totalQ)}</span>
                `;
                btn.onclick = () => this.startSeries(i, 60, `Examen Blanc ${i}`);
                contentContainer.appendChild(btn);
            }
        };

        const renderTrainMode = () => {
            contentContainer.innerHTML = '';

            // Tab Styles
            btnTrainTab.classList.add('active');
            btnExamTab.classList.remove('active');

            const chunkTrain = 10;
            const totalTrain = Math.ceil(totalQ / chunkTrain);

            if(totalTrain === 0) {
                 contentContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">Aucune question disponible.</p>';
                 return;
            }

            for (let i = 1; i <= totalTrain; i++) {
                const btn = document.createElement('div');
                btn.className = 'btn-series';
                // Distinctive styling for Training
                btn.style.borderLeft = '6px solid #107c10'; 
                btn.innerHTML = `
                    <h4 style="color:#107c10"><i class="fas fa-bolt"></i> Série ${i}</h4>
                    <span style="display:block; margin-top:5px; font-weight:500;">10 Questions</span>
                    <span style="font-size:0.8rem; color:#888;">Index: ${(i-1)*chunkTrain + 1}-${Math.min(i*chunkTrain, totalQ)}</span>
                `;
                btn.onclick = () => this.startSeries(i, 10, `Série ${i}`);
                contentContainer.appendChild(btn);
            }
        };

        // Bind clicks
        btnExamTab.onclick = renderExamMode;
        btnTrainTab.onclick = renderTrainMode;

        // Default view
        renderTrainMode(); 
    },

    startSeries: function(id, size = 60, title = 'Quiz') {
        this.state.currentSeries = id;
        this.state.currentChunkSize = size;
        this.state.currentTitle = title;
        
        const startIdx = (id - 1) * size;
        this.state.currentQuestions = this.state.questions.slice(startIdx, startIdx + size);
        
        this.switchView('quiz');
        document.getElementById('quiz-title').textContent = title;
        
        const prog = document.getElementById('quiz-progress-text');
        if(prog) prog.textContent = `${this.state.currentQuestions.length} Questions`;
        
        this.renderQuizForm();
        window.scrollTo(0,0);
    },

    renderQuizForm: function() {
        const container = document.getElementById('questions-container');
        if(!container) return;
        container.innerHTML = '';

        if(this.state.currentQuestions.length === 0) {
            container.innerHTML = '<p class="error-msg">Aucune question dans cette série.</p>';
            return;
        }

        this.state.currentQuestions.forEach((q, index) => {
            try {
                const card = document.createElement('div');
                card.className = 'q-card';
                card.dataset.id = q.id;
                card.dataset.index = index;

                // Header: Question Text & Image
                let html = `<h3>${index+1}. ${q.question}</h3>`;
                if (q.image) {
                    html += `<img src="${q.image}" style="max-width:100%; border-radius:4px; margin-bottom:15px;" loading="lazy">`;
                }

                // Body: Options or Match
                html += '<div class="q-body">';
                
                if (q.type === 'match' || (q.match_pairs && Array.isArray(q.match_pairs) && q.match_pairs.length > 0)) {
                    // RENDER MATCH
                    html += this.renderMatchQuestion(q, index);
                } else {
                    // RENDER STANDARD
                    html += this.renderStandardOptions(q, index);
                }
                
                html += '</div>';

                // Footer: Explanation (Hidden)
                if (q.explanation) {
                    html += `<div class="explanation-box" id="expl-${index}">${q.explanation}</div>`;
                }

                card.innerHTML = html;
                container.appendChild(card);
            } catch(e) {
                console.warn(`Skipping malformed question #${q.id}:`, e);
                const errDiv = document.createElement('div');
                errDiv.style.color = 'red';
                errDiv.style.padding = '10px';
                errDiv.innerText = `Erreur d'affichage question #${index+1} (ID: ${q.id})`;
                container.appendChild(errDiv);
            }
        });

        // Re-init Drag & Drop listeners
        setTimeout(() => this.initDragDrop(), 100);
    },

    renderMatchQuestion: function(q, qIndex) {
        let leftRows = '';
        let rightItems = '';
        
        // Prepare Right Items (Shuffle)
        const terms = q.match_pairs.map((p, i) => ({ term: p.term, id: i }));
        terms.sort(() => Math.random() - 0.5);

        q.match_pairs.forEach((pair, idx) => {
            leftRows += `
                <div class="match-row" data-correct-term="${pair.term}">
                    <span>${pair.definition}</span>
                    <div class="target-zone" data-zone-id="${q.id}-${idx}"></div>
                </div>
            `;
        });

        terms.forEach((item, idx) => {
             rightItems += `
                <div class="draggable-item" draggable="true" id="drag-${q.id}-${item.id}" data-term="${item.term}">
                    ${item.term}
                </div>
             `;
        });

        return `
            <div class="match-area">
                <div class="match-rows">${leftRows}</div>
                <div class="draggable-bank" id="bank-${q.id}">${rightItems}</div>
            </div>
        `;
    },

    renderStandardOptions: function(q, qIndex) {
        let html = '<div class="options-list">';
        const isMulti = q.correct && q.correct.length > 1;
        const type = isMulti ? 'checkbox' : 'radio';

        if (!q.options || q.options.length === 0) {
            return '<p><i>Aucune option disponible.</i></p>';
        }

        q.options.forEach((opt, idx) => {
            html += `
                <label class="opt-item">
                    <input type="${type}" name="q-${qIndex}" value="${idx}">
                    ${opt}
                </label>
            `;
        });
        html += '</div>';
        return html;
    },

    validate: function() {
        let score = 0;
        const cards = document.querySelectorAll('.q-card');
        
        cards.forEach(card => {
            const index = parseInt(card.dataset.index);
            const q = this.state.currentQuestions[index];
            let isCorrect = false;

            // Clean previous styles
            card.querySelectorAll('.opt-item').forEach(el => el.classList.remove('correct-highlight', 'wrong-highlight', 'missed-highlight'));
            
            if (q.type === 'match' || (q.match_pairs && q.match_pairs.length > 0)) {
                // Validate Match
                const rows = card.querySelectorAll('.match-row');
                let rowCorrectCount = 0;
                rows.forEach(row => {
                    const target = row.dataset.correctTerm;
                    const zone = row.querySelector('.target-zone');
                    const item = zone.querySelector('.draggable-item');
                    
                    if (item) {
                        if (item.dataset.term === target) {
                            zone.style.borderColor = 'green';
                            zone.style.background = '#d4edda';
                            rowCorrectCount++;
                        } else {
                            zone.style.borderColor = 'red';
                            zone.style.background = '#f8d7da';
                        }
                    } else {
                        zone.style.borderColor = 'orange'; // Missed
                    }
                });
                if (rowCorrectCount === rows.length) isCorrect = true;

            } else {
                // Validate Standard
                const inputs = card.querySelectorAll(`input[name="q-${index}"]`);
                let userSelected = [];
                inputs.forEach(inp => { if (inp.checked) userSelected.push(parseInt(inp.value)); });
                
                const correctIndices = q.correct || [];
                
                // Check Logic
                const correctSet = new Set(correctIndices);
                const userSet = new Set(userSelected);
                
                // Strict equality for score
                if (userSelected.length === correctIndices.length && userSelected.every(v => correctSet.has(v))) {
                    isCorrect = true;
                }

                // Visual Feedback
                inputs.forEach(inp => {
                    const val = parseInt(inp.value);
                    const parent = inp.closest('.opt-item');
                    
                    if (correctSet.has(val)) {
                        parent.classList.add('correct-highlight'); // It was a correct answer
                        if (!userSet.has(val)) parent.classList.add('missed-highlight'); // But user missed it
                    } else if (userSet.has(val)) {
                        parent.classList.add('wrong-highlight'); // User selected wrong
                    }
                });
            }

            if (isCorrect) score++;

            // Show explanation
            const expl = card.querySelector('.explanation-box');
            if (expl) expl.classList.add('visible');
        });

        // Save & Show Result (Wait 500ms for UX)
        setTimeout(() => {
             this.showResults(score, this.state.currentQuestions.length);
        }, 500);
    },

    showResults: function(score, total) {
        this.saveHistory({
            seriesId: this.state.currentSeries,
            score: score,
            total: total,
            date: new Date().toISOString()
        });

        this.switchView('results');
        
        const circle = document.getElementById('score-circle');
        const display = document.getElementById('score-display');
        const msg = document.getElementById('result-message');
        
        const pct = Math.round((score/total)*100);
        display.textContent = `${pct}%`;
        
        // Color
        if (pct === 100) circle.style.background = '#107c10'; // Green
        else if (pct >= 80) circle.style.background = '#2b88d8'; // Blue
        else if (pct >= 50) circle.style.background = '#ffb900'; // Orange
        else circle.style.background = '#d13438'; // Red

        msg.innerHTML = `Vous avez obtenu <b>${score}</b> sur <b>${total}</b>.<br>`;
        if (pct < 50) msg.innerHTML += "N'hésitez pas à revoir le cours.";
        else if (pct < 80) msg.innerHTML += "Bon travail, continuez ainsi !";
        else msg.innerHTML += "Excellent résultat !";
    },

    initDragDrop: function() {
        const draggables = document.querySelectorAll('.draggable-item');
        const dropzones = document.querySelectorAll('.target-zone, .draggable-bank');

        // Click-to-move Logic (Mobile Friendly)
        const handleItemClick = (e) => {
            e.stopPropagation(); // prevent bubbling to zone
            const item = e.currentTarget;
            
            // Remove previous selection style
            if (this.state.selectedDraggable) {
                this.state.selectedDraggable.classList.remove('selected-item');
            }

            // Toggle selection
            if (this.state.selectedDraggable === item) {
                this.state.selectedDraggable = null;
            } else {
                this.state.selectedDraggable = item;
                item.classList.add('selected-item');
            }
        };

        const handleZoneClick = (e) => {
             const zone = e.currentTarget;
             const selected = this.state.selectedDraggable;
             
             if (selected) {
                 // Logic from drop handler
                 if (zone.classList.contains('target-zone')) {
                    if (zone.children.length > 0) {
                        const existing = zone.children[0];
                        const bankId = zone.closest('.match-area').querySelector('.draggable-bank').id;
                        document.getElementById(bankId).appendChild(existing);
                    }
                    zone.appendChild(selected);
                 } else if (zone.classList.contains('draggable-bank')) {
                    zone.appendChild(selected);
                 }
                 
                 // Clear selection
                 selected.classList.remove('selected-item');
                 this.state.selectedDraggable = null;
             }
        };

        draggables.forEach(d => {
            d.draggable = true;
            d.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', e.target.id);
                setTimeout(() => {
                    e.target.style.opacity = '0.5';
                }, 0);
            });
            d.addEventListener('dragend', (e) => {
                e.target.style.opacity = '1';
                e.target.style.display = 'block';
            });
            // Add click listener
            d.addEventListener('click', handleItemClick);
        });

        dropzones.forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('drag-hover');
            });
            
            zone.addEventListener('dragleave', (e) => {
                zone.classList.remove('drag-hover');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('drag-hover');
                try {
                    const id = e.dataTransfer.getData('text/plain');
                    const draggable = document.getElementById(id);
                    
                    if (!draggable) return;

                    // Scenario: Dropping into a Target Zone (Answer slot)
                    if (zone.classList.contains('target-zone')) {
                        // Check if occupied
                        if (zone.children.length > 0) {
                            // Move existing item back to bank
                            const existing = zone.children[0];
                            const matchArea = zone.closest('.match-area');
                            if(matchArea) {
                                const bank = matchArea.querySelector('.draggable-bank');
                                if(bank) bank.appendChild(existing);
                            }
                        }
                        zone.appendChild(draggable);
                    } 
                    // Scenario: Dropping back into Bank
                    else if (zone.classList.contains('draggable-bank')) {
                        zone.appendChild(draggable);
                    }
                    
                    draggable.style.opacity = '1';
                    draggable.style.display = 'block';
                } catch(err) {
                    console.error("Drop Error", err);
                }
            });
            // Add click listener
            zone.addEventListener('click', handleZoneClick);
        });
    },

    switchView: function(viewName) {
        document.querySelectorAll('main > section').forEach(el => el.classList.remove('active-view'));
        document.querySelectorAll('main > section').forEach(el => el.classList.add('hidden-view'));
        
        const target = document.getElementById(`view-${viewName}`);
        if(target) {
            target.classList.remove('hidden-view');
            target.classList.add('active-view');
        }
        this.state.view = viewName;
    },
    
    setupNavigation: function() {
        document.getElementById('btn-validate').addEventListener('click', () => this.validate());
    }
};


// Global Helpers
function showDashboard() {
    App.switchView('dashboard');
    App.renderstats(); // refresh
}

function retryCurrentQuiz() {
    App.startSeries(App.state.currentSeries, App.state.currentChunkSize, App.state.currentTitle);
}

function resetAllData() {
    if(confirm("Voulez-vous vraiment effacer tout votre historique ?")) {
        localStorage.removeItem('ccna2_history');
        location.reload();
    }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    try {
        App.init();
    } catch (e) {
        console.error("Critical App Crash:", e);
        document.body.innerHTML = `<div style="padding:20px; color:red;">
            <h2>Erreur Critique</h2>
            <p>Le site n'a pas pu charger correctement.</p>
            <pre>${e.message}</pre>
        </div>`;
    }
});
