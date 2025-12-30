// --- DEBUG LOGGER (Mobile Safe) ---
const debugBox = document.createElement('div');
debugBox.style.position = 'fixed';
debugBox.style.top = '0';
debugBox.style.left = '0';
debugBox.style.width = '100%';
debugBox.style.maxHeight = '80px';
debugBox.style.overflowY = 'scroll';
debugBox.style.background = 'rgba(0,0,0,0.8)';
debugBox.style.color = '#00ff00';
debugBox.style.zIndex = '9999';
debugBox.style.fontSize = '10px';
debugBox.style.pointerEvents = 'none';
document.body.appendChild(debugBox);

function log(msg) {
    const d = new Date();
    const ts = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
    const p = document.createElement('div');
    p.textContent = `[${ts}] ${msg}`;
    debugBox.insertBefore(p, debugBox.firstChild);
    console.log(msg);
}

window.onerror = (msg) => log("ERR: " + msg);

// --- CONFIG ---
const GAME_DURATION_PER_QUESTION = 20;
const POINTS_PER_QUESTION = 200;

// --- DOM ELEMENTS (Unified) ---
const el = (id) => document.getElementById(id);
const startScreen = el('start-screen');
const gameScreen = el('game-screen');
const resultScreen = el('result-screen');
const timerFill = el('timer-fill');
const scoreDisplay = el('score-display');
const questionCounter = el('question-counter');
const questionText = el('question-text');
const poolContainer = el('pool-container');
const answerContainer = el('answer-container');
const checkBtn = el('check-btn');
const clearBtn = el('clear-btn');
const nextBtn = el('next-btn');
const feedbackMsg = el('feedback-msg');
const replayBtn = el('replay-btn');
const finalScoreDisplay = el('final-score-display');
const rankDisplay = el('rank-display');

// --- DATA ---
const QUESTIONS = [
    { text: "コミック売り場はどこですか？", audio: "Where are the comics?", sentence: "Go straight down this aisle and it's on your left" },
    { text: "ここは何階ですか？", audio: "What floor is this?", sentence: "This is the third floor" },
    { text: "ここから新館に行けますか？", audio: "Can I go to the new building from here?", sentence: "The third floor is not connected to the new building" },
    { text: "2階へはどう行けばいいですか？", audio: "How do I get to the 2nd floor?", sentence: "Take the escalator down to the second floor" },
    { text: "エスカレーターはどこですか？", audio: "Where is the escalator?", sentence: "The escalator is over there" },
    { text: "（商品画像を見せて）これありますか？", audio: "Do you have this?", sentence: "We don't have it" },
    { text: "電気屋さんはどこですか？", audio: "Where is the electronics store?", sentence: "The electronics store is on the fourth floor of the new building" },
    { text: "これ、免税になりますか？", audio: "Is this tax-free?", sentence: "It's not a duty-free shop" },
    { text: "この価格は税込みですか？", audio: "Is tax included in this price?", sentence: "Yes tax is included" },
    { text: "プレゼント包装できますか？", audio: "Can you wrap this for a gift?", sentence: "Certainly free of charge" },
    { text: "クレジットカード使えますか？", audio: "Do you accept credit cards?", sentence: "Yes we do" },
    { text: "返品できますか？", audio: "Can I return this?", sentence: "I'm sorry we don't accept returns" },
    { text: "交通系ICカードは使えますか？", audio: "Can I use Suica or Pasmo?", sentence: "Yes you can use transportation IC cards" },
    { text: "営業時間は何時までですか？", audio: "What time do you close?", sentence: "We are open until nine PM" },
    { text: "（本を指して）一番人気はどれですか？", audio: "Which one is the most popular?", sentence: "This novel is the number one bestseller" },
    { text: "文房具は置いていますか？", audio: "Do you sell stationery?", sentence: "Stationery is on the left side of the store" },
    { text: "袋はいりますか？（店員役として）", audio: "Do you need a bag?", sentence: "Plastic bags cost five yen" }
];

const ENCOURAGEMENT = ["完璧！🎉", "素晴らしい！⭐", "すごい！🌟", "よくできました！💯", "最高！✨", "その調子！🔥", "天才！💎", "パーフェクト！🏆"];

// --- STATE ---
let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let timerInterval = null;
let timeLeft = 0;
let currentWords = [];
let selectedWordIds = [];
let isChecking = false; // Guard against double submission

// --- AUDIO (Safe Wrapper) ---
let synth = window.speechSynthesis;
function safeSpeak(text, rate = 1.0) {
    if (!synth) {
        log("Skip speak: No synth");
        return;
    }
    try {
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = rate;
        const voices = synth.getVoices();
        const en = voices.find(v => v.lang.startsWith('en'));
        if (en) u.voice = en;
        synth.speak(u);
        log("Speaking: " + text.substring(0, 5) + "...");
    } catch (e) {
        log("Speak ERR: " + e.message);
    }
}

// --- INIT ---
function initGame() {
    log("Init Game");
    // Unlock Audio
    if (synth) {
        try {
            const u = new SpeechSynthesisUtterance("Start");
            u.volume = 0;
            synth.resume();
            synth.speak(u);
        } catch (e) { log("Unlock ERR"); }
    }

    score = 0;
    currentQuestionIndex = 0;

    // Fisher-Yates Shuffle
    const shuffled = [...QUESTIONS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Take first 10 ? Or all? Let's take 10 for the game length count
    // The user wants recycling, so we start with 10 but might grow if wrong.
    currentQuestions = shuffled.slice(0, 10).map(q => ({ ...q, answeredCorrectly: false })); // Clone to avoid mutation of constant

    startScreen.classList.add('hidden');
    startScreen.classList.remove('active');
    resultScreen.classList.add('hidden');
    resultScreen.classList.remove('active');

    gameScreen.classList.remove('hidden');
    gameScreen.classList.add('active');

    updateScoreUI();
    loadQuestion();
}

// --- GAME LOOP ---
function loadQuestion() {
    log("Load Q: " + currentQuestionIndex);
    if (currentQuestionIndex >= currentQuestions.length) {
        log("Game Over");
        showResults();
        return;
    }

    const qData = currentQuestions[currentQuestionIndex];
    questionText.textContent = qData.text;

    // Counter
    const total = currentQuestions.length;
    // Just a simple X/Y. If recycled, Y might grow or we just show progress.
    // User asked for recycling incorrects. 
    questionCounter.textContent = `${currentQuestionIndex + 1}/${total}`;

    // Reset UI
    selectedWordIds = [];
    isChecking = false;

    nextBtn.classList.add('hidden');

    checkBtn.classList.remove('hidden');
    checkBtn.disabled = true;

    clearBtn.classList.remove('hidden');

    feedbackMsg.classList.add('hidden');
    feedbackMsg.className = 'feedback hidden';

    // Words
    const rawWords = qData.sentence.split(' ');
    currentWords = rawWords.map((w, i) => ({ id: i, text: w, selected: false }));

    renderUI();

    // Timer
    timeLeft = GAME_DURATION_PER_QUESTION;
    updateTimerUI();
    startTimer();

    // Audio Prompt
    setTimeout(() => safeSpeak(qData.audio, 1.0), 500);
}

function renderUI() {
    // 1. Pool
    poolContainer.innerHTML = '';
    const unselected = currentWords.filter(w => !w.selected);
    const displayPool = [...unselected].sort((a, b) => a.text.localeCompare(b.text));

    displayPool.forEach(w => {
        const card = createCard(w, false);
        poolContainer.appendChild(card);
    });

    // 2. Answer
    answerContainer.innerHTML = '';
    selectedWordIds.forEach(id => {
        const w = currentWords.find(cw => cw.id === id);
        if (w) {
            const card = createCard(w, true);
            answerContainer.appendChild(card);
        }
    });

    // 3. Check Btn
    checkBtn.disabled = (selectedWordIds.length === 0);
}

function createCard(word, inAnswer) {
    const div = document.createElement('div');
    div.classList.add('word-card');
    div.textContent = word.text;

    // Safer Tap Event
    div.onclick = (e) => {
        if (isChecking) return;
        if (!checkBtn.classList.contains('hidden')) { // Only if editing
            if (inAnswer) {
                word.selected = false;
                selectedWordIds = selectedWordIds.filter(id => id !== word.id);
            } else {
                word.selected = true;
                selectedWordIds.push(word.id);
            }
            renderUI();
        }
    };
    return div;
}

// --- LOGIC ---
function checkAnswer() {
    log("Check Btn Clicked");
    if (isChecking) return;
    isChecking = true;

    try {
        const qData = currentQuestions[currentQuestionIndex];

        // Robust Builder
        const built = selectedWordIds
            .map(id => currentWords.find(w => w.id === id))
            .filter(w => w) // Not undefined
            .map(w => w.text)
            .join(' ');

        log(`Built: "${built}"`);

        const norm = (s) => s.replace(/[.,?!]/g, '').toLowerCase().trim();
        const isCorrect = (norm(built) === norm(qData.sentence));

        log(`Result: ${isCorrect}`);

        if (isCorrect) {
            // Success
            qData.answeredCorrectly = true;
            feedbackMsg.textContent = ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)];
            feedbackMsg.classList.remove('hidden', 'error');
            feedbackMsg.classList.add('success');

            document.querySelectorAll('.answer-box .word-card').forEach(c => c.classList.add('success'));

            score += Math.ceil(POINTS_PER_QUESTION + (timeLeft * 10));
            updateScoreUI();

            // Speak result
            safeSpeak(built, 1.0);

            finishQuestion(true);
        } else {
            // Fail
            feedbackMsg.textContent = "Try Again!";
            feedbackMsg.classList.remove('hidden', 'success');
            feedbackMsg.classList.add('error');

            isChecking = false; // Allow retry
            setTimeout(() => {
                if (!isChecking) feedbackMsg.classList.add('hidden'); // Hide only if not checking again
            }, 1500);
        }

    } catch (e) {
        log("Check CRASH: " + e.message);
        // Force finish to avoid stuck
        isChecking = false;
        finishQuestion(false); // Fail safe
    }
}

function finishQuestion(isSuccess) {
    log("FinishQ: " + isSuccess);
    clearInterval(timerInterval);

    checkBtn.classList.add('hidden');
    clearBtn.classList.add('hidden');

    if (!isSuccess) {
        // Recycle: user wants wrong questions to go to end of queue?
        // Wait, logic says "Wait until correct" usually, OR recycle.
        // User request: "問題を間違えた場合...キューの末尾へ"
        // But here we are in 'checkAnswer'. If it was wrong, we allow retry?
        // Or do we treat "Time Up" as the only failure that recycles? 
        // User said: "Check Answer... if Correct -> Next. if Wrong -> Try Again".
        // BUT "Additional Spec": if wrong... recycle. 
        // This implies "Give up" or "Move on"? 
        // Usually "Try Again" means stay on same question.
        // Let's assume: Time Up -> Recycle. 
        // User said: "正解するまで繰り返す". 
        // If I stay on the screen until correct, that's one way.
        // If I skip and come back, that's another.
        // Given "Try Again" message, usually you stay.
        // Let's stick to "Stay until time up". If Time Up, then Recycle.

        // If this function is called with false (Time Up), we recycle.
        const currentQ = currentQuestions[currentQuestionIndex];
        currentQuestions.push(currentQ); // Add to end
        log("Recycled Question");
    }

    log("Show Next Btn");
    nextBtn.classList.remove('hidden');
    // Force Reflow?
    void nextBtn.offsetWidth;
}

function handleTimeout() {
    log("Time Up");
    feedbackMsg.textContent = "Time's Up! Correct: " + currentQuestions[currentQuestionIndex].sentence;
    feedbackMsg.classList.remove('hidden', 'error');
    safeSpeak(currentQuestions[currentQuestionIndex].sentence);

    // Treat as finished (wrong)
    finishQuestion(false);
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeout();
        }
        updateTimerUI();
    }, 100);
}

function updateTimerUI() {
    const pct = (timeLeft / GAME_DURATION_PER_QUESTION) * 100;
    timerFill.style.width = `${Math.max(0, pct)}%`;
}

function updateScoreUI() {
    scoreDisplay.textContent = score;
}

function showResults() {
    gameScreen.classList.add('hidden');
    gameScreen.classList.remove('active');
    resultScreen.classList.remove('hidden');
    resultScreen.classList.add('active');
    finalScoreDisplay.textContent = score;
}


// --- EVENTS (Safe Binding) ---
function onTouch(btn, handler) {
    if (!btn) return;
    // Removing old listeners is hard without named functions, but we are replacing the file so it's fresh.

    // Pointer Events for robust mobile handling
    btn.addEventListener('pointerup', (e) => {
        e.preventDefault();
        handler(e);
    });
}

onTouch(checkBtn, checkAnswer);

onTouch(nextBtn, () => {
    log("Next Clicked");
    currentQuestionIndex++;
    loadQuestion();
});

onTouch(startScreen.querySelector('#start-btn'), initGame); // start-btn ID might be inside screen
onTouch(replayBtn, () => {
    const q = currentQuestions[currentQuestionIndex];
    if (q) safeSpeak(q.audio);
});
onTouch(clearBtn, () => {
    currentWords.forEach(w => w.selected = false);
    renderUI();
});

// Retry on result
onTouch(document.getElementById('retry-btn'), initGame); // Ensure ID exists

log("Script Loaded v2");
