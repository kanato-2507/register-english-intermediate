// Game Configuration
const GAME_DURATION_PER_QUESTION = 20; // Longer time for building
const POINTS_PER_QUESTION = 200;

// Quiz Data - Station Bookstore (Intermediate)
const QUESTIONS = [
    {
        text: "コミック売り場はどこですか？",
        audio: "Where are the comics?",
        sentence: "Go straight down this aisle and it's on your left"
    },
    {
        text: "ここは何階ですか？",
        audio: "What floor is this?",
        sentence: "This is the third floor"
    },
    {
        text: "ここから新館に行けますか？",
        audio: "Can I go to the new building from here?",
        sentence: "The third floor is not connected to the new building"
    },
    {
        text: "2階へはどう行けばいいですか？",
        audio: "How do I get to the 2nd floor?",
        sentence: "Take the escalator down to the second floor"
    },
    {
        text: "エスカレーターはどこですか？",
        audio: "Where is the escalator?",
        sentence: "The escalator is over there"
    },
    {
        text: "（商品画像を見せて）これありますか？",
        audio: "Do you have this?",
        sentence: "We don't have it"
    },
    {
        text: "電気屋さんはどこですか？",
        audio: "Where is the electronics store?",
        sentence: "The electronics store is on the fourth floor of the new building"
    },
    {
        text: "これ、免税になりますか？",
        audio: "Is this tax-free?",
        sentence: "It's not a duty-free shop"
    },
    {
        text: "この価格は税込みですか？",
        audio: "Is tax included in this price?",
        sentence: "Yes tax is included"
    },
    {
        text: "プレゼント包装できますか？",
        audio: "Can you wrap this for a gift?",
        sentence: "Certainly free of charge"
    },
    {
        text: "クレジットカード使えますか？",
        audio: "Do you accept credit cards?",
        sentence: "Yes we do"
    },
    {
        text: "返品できますか？",
        audio: "Can I return this?",
        sentence: "I'm sorry we don't accept returns"
    },
    {
        text: "交通系ICカードは使えますか？",
        audio: "Can I use Suica or Pasmo?",
        sentence: "Yes you can use transportation IC cards"
    },
    {
        text: "営業時間は何時までですか？",
        audio: "What time do you close?",
        sentence: "We are open from ten AM to eight PM"
    },
    {
        text: "（本を指して）一番人気はどれですか？",
        audio: "Which one is the most popular?",
        sentence: "This novel is the number one bestseller"
    },
    {
        text: "文房具は置いていますか？",
        audio: "Do you sell stationery?",
        sentence: "Stationery is on the left side of the store"
    },
    {
        text: "袋はいりますか？（店員役として）",
        audio: "Do you need a bag?",
        sentence: "Plastic bags cost five yen"
    }
];

// Game State
let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let timerInterval = null;
let timeLeft = 0;
let currentWords = []; // Array of word objects {id, text, selected}
let selectedWordIds = []; // Order of Ids in the answer box

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');
const timerFill = document.getElementById('timer-fill');
const scoreDisplay = document.getElementById('score-display');
const questionCounter = document.getElementById('question-counter');
const questionText = document.getElementById('question-text');
const poolContainer = document.getElementById('pool-container');
const answerContainer = document.getElementById('answer-container');
const checkBtn = document.getElementById('check-btn');
const clearBtn = document.getElementById('clear-btn');
const nextBtn = document.getElementById('next-btn');
const feedbackMsg = document.getElementById('feedback-msg');
const replayBtn = document.getElementById('replay-btn');
const finalScoreDisplay = document.getElementById('final-score-display');
const rankDisplay = document.getElementById('rank-display');

// Encouragement Messages
const ENCOURAGEMENT = [
    "完璧！🎉",
    "素晴らしい！⭐",
    "すごい！🌟",
    "よくできました！💯",
    "最高！✨",
    "その調子！🔥",
    "天才！💎",
    "パーフェクト！🏆"
];

// Audio - Safe Guarded
let synth = null;
try {
    synth = window.speechSynthesis;
} catch (e) {
    console.warn("Speech Synthesis not supported", e);
}

function speak(text, rate = 1.0) {
    if (synth) {
        try {
            // log(`Speak called: ${text.substring(0, 10)}...`);
            synth.cancel();

            const utterThis = new SpeechSynthesisUtterance(text);
            const voices = synth.getVoices();
            // log(`Voices avail: ${voices.length}`);

            const enVoice = voices.find(v => v.lang.startsWith('en'));
            if (enVoice) {
                utterThis.voice = enVoice;
                // log(`Voice: ${enVoice.name}`);
            } else {
                // log('No EN voice, using default');
            }

            utterThis.rate = rate;

            utterThis.onstart = () => { };
            utterThis.onend = () => { };
            utterThis.onerror = (e) => { };

            synth.speak(utterThis);
        } catch (e) {
            // log(`Speak Exception: ${e.message}`);
        }
    } else {
        // log('Synth not available');
    }
}

// Safely assign onvoiceschanged
if (synth) {
    synth.onvoiceschanged = () => {
        // log(`Voices changed: ${synth.getVoices().length}`);
    };
}

// Init
function initGame() {
    // Unlock Audio Context immediately on user interaction
    if (synth) {
        // Just speak empty or short to "warm up"
        const u = new SpeechSynthesisUtterance("Let's start");
        u.volume = 0; // Silent start if preferred, or audible
        u.rate = 1.0;
        synth.resume(); // CRITICAL for Chrome/Safari unlock
        synth.speak(u);
    }

    score = 0;
    currentQuestionIndex = 0;
    // Select 10 random questions from the pool
    // Fisher-Yates Shuffle for better randomness
    const shuffled = [...QUESTIONS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    currentQuestions = shuffled.slice(0, 10);
    updateScoreUI();

    // Check Audio Support and Warn if missing
    if (!synth) {
        alert("Audio is not supported in this browser.\nPlease try Chrome or Safari for full experience.");
    }

    startScreen.classList.remove('active');
    startScreen.classList.add('hidden');
    resultScreen.classList.remove('active');
    resultScreen.classList.add('hidden');

    gameScreen.classList.remove('hidden');
    gameScreen.classList.add('active');

    loadQuestion();
}

function loadQuestion() {
    if (currentQuestionIndex >= currentQuestions.length) {
        showResults();
        return;
    }

    const qData = currentQuestions[currentQuestionIndex];
    questionText.textContent = qData.text;

    // Update question counter
    // Retry Mode Detection
    const initialTotal = 10;
    const isRetry = currentQuestionIndex >= initialTotal;
    const appContainer = document.querySelector('.app-container');

    if (isRetry) {
        appContainer.classList.add('retry-mode');
        // Counter can just show "Retry Phase" or just keep the number
        // CSS adds "RETRY" prefix so we just keep "11/10" or similar
        questionCounter.textContent = `${currentQuestionIndex + 1}/${initialTotal}`;
    } else {
        appContainer.classList.remove('retry-mode');
        questionCounter.textContent = `${currentQuestionIndex + 1}/${initialTotal}`;
    }

    // Reset State
    selectedWordIds = [];
    nextBtn.classList.add('hidden');
    checkBtn.classList.remove('hidden');
    clearBtn.classList.remove('hidden'); // Show reset
    checkBtn.disabled = true;
    feedbackMsg.classList.add('hidden');
    feedbackMsg.className = 'feedback hidden'; // reset error class

    // Prepare Words
    // Remove punctuation for easier matching, or keep it?
    // Let's split by space.
    const rawWords = qData.sentence.split(' ');
    currentWords = rawWords.map((w, i) => ({
        id: i,
        text: w,
        selected: false
    }));

    // Shuffle words for pool
    // Need a separate shuffled array for display, but link back to IDs?
    renderUI();

    timeLeft = GAME_DURATION_PER_QUESTION;
    updateTimerUI();
    startTimer();

    // Speak prompt
    // On mobile, setTimeout might lose the 'user gesture' token, 
    // but since we primed it in initGame, it might be okay.
    // Reducing delay to ensure it feels responsive.
    // Reducing delay to ensure it feels responsive.
    setTimeout(() => speak(qData.audio, 1.0), 300);
}

function renderUI() {
    // 1. Render Pool (Show only unselected words)
    poolContainer.innerHTML = '';

    // We want the pool order to remain somewhat consistent or shuffled? 
    // Capturing initial shuffle order would be better.
    // For now, let's just filter unselected items.

    const unselectedWords = currentWords.filter(w => !w.selected);
    // Shuffle only on first load? Nay, shuffle always looks cleaner.
    // Ideally we shuffle ONCE per question.

    // Quick fix: Just show unselected words shuffled or in consistent ID order?
    // Let's Shuffle the DISPLAY list.
    const displayPool = [...unselectedWords].sort((a, b) => a.text.localeCompare(b.text)); // Alphabetical for extra challenge? Or Random?

    displayPool.forEach(word => {
        const card = createWordCard(word, false);
        poolContainer.appendChild(card);
    });

    // 2. Render Answer (Show selected words in order)
    answerContainer.innerHTML = '';
    selectedWordIds.forEach(id => {
        const word = currentWords.find(w => w.id === id);
        const card = createWordCard(word, true);
        answerContainer.appendChild(card);
    });

    // 3. Update Check Button
    checkBtn.disabled = selectedWordIds.length === 0;
}

function createWordCard(word, inAnswerBox) {
    const div = document.createElement('div');
    div.classList.add('word-card');
    div.textContent = word.text;

    div.addEventListener('click', () => {
        if (nextBtn.classList.contains('hidden') === false) return; // Game inactive

        if (inAnswerBox) {
            // Remove from answer, back to pool
            word.selected = false;
            selectedWordIds = selectedWordIds.filter(id => id !== word.id);
        } else {
            // Add to answer
            word.selected = true;
            selectedWordIds.push(word.id);
        }
        renderUI();
    });
    // Add touchstart logic from previous versions if needed or stick to click?
    // The previous version had separate addTouchListener for buttons but not necessarily here.
    // Actually the previous version did NOT add touchstart here.
    return div;
}

function checkAnswer() {
    try {
        const qData = currentQuestions[currentQuestionIndex];

        // Reconstruct sentence
        const builtSentence = selectedWordIds.map(id => currentWords.find(w => w.id === id).text).join(' ');
        const targetSentence = qData.sentence;

        // Normalize for comparison (remove punctuation, lower case)
        const normalize = (str) => str.replace(/[.,?!]/g, '').toLowerCase().trim();

        if (normalize(builtSentence) === normalize(targetSentence)) {
            // Correct - mark as answered correctly
            qData.answeredCorrectly = true;

            // Random encouragement message
            const randomMsg = ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)];
            feedbackMsg.textContent = randomMsg;
            feedbackMsg.classList.remove('hidden', 'error');
            feedbackMsg.classList.add('success');

            // Animate word cards
            document.querySelectorAll('.answer-box .word-card').forEach(card => {
                card.classList.add('success');
            });

            // Animate score
            score += Math.ceil(POINTS_PER_QUESTION + (timeLeft * 10));
            scoreDisplay.classList.add('animate');
            setTimeout(() => scoreDisplay.classList.remove('animate'), 500);
            updateScoreUI();

            // Speak the built sentence
            speak(builtSentence, 1.0);

            finishQuestion(true);
        } else {
            // Wrong
            feedbackMsg.textContent = "Try Again!";
            feedbackMsg.classList.add('error');
            feedbackMsg.classList.remove('hidden', 'success');
            setTimeout(() => {
                feedbackMsg.classList.add('hidden');
            }, 1000);
        }
    } catch (e) {
        console.error("Check Answer Error", e);
    }
}

function finishQuestion(isCorrect) {
    clearInterval(timerInterval);
    checkBtn.classList.add('hidden');
    clearBtn.classList.add('hidden'); // Hide reset

    // If wrong or timeout, add question back to queue
    if (!isCorrect) {
        const qData = currentQuestions[currentQuestionIndex];
        // Add to end of queue for retry
        currentQuestions.push(qData);
    }

    nextBtn.classList.remove('hidden');
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        updateTimerUI();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimeout();
        }
    }, 100);
}

function handleTimeout() {
    // Timeout = wrong answer, will retry
    feedbackMsg.textContent = "Time's Up! Correct: " + currentQuestions[currentQuestionIndex].sentence;
    feedbackMsg.classList.remove('hidden', 'error');
    feedbackMsg.classList.remove('hidden', 'error');
    speak(currentQuestions[currentQuestionIndex].sentence, 1.0);
    finishQuestion(false); // Mark as incorrect to trigger retry
}

function updateTimerUI() {
    const percentage = (timeLeft / GAME_DURATION_PER_QUESTION) * 100;
    timerFill.style.width = `${Math.max(0, percentage)}%`;
}

function updateScoreUI() {
    scoreDisplay.textContent = score;
}

function showResults() {
    gameScreen.classList.remove('active');
    gameScreen.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    setTimeout(() => resultScreen.classList.add('active'), 50);
    finalScoreDisplay.textContent = score;
    // Rank logic...
    rankDisplay.textContent = `Score: ${score}`;
}

// Events
function addTouchListener(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', handler);
    el.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Stop double firing if click follows
        handler(e);
    }, { passive: false });
}

addTouchListener('start-btn', initGame);
addTouchListener('retry-btn', initGame);

// Check Button
const checkBtnEl = document.getElementById('check-btn');
checkBtnEl.addEventListener('click', checkAnswer);
checkBtnEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    checkAnswer();
}, { passive: false });

// Next Button
const nextHandler = () => {
    currentQuestionIndex++;
    loadQuestion();
};
const nextBtnEl = document.getElementById('next-btn');
nextBtnEl.addEventListener('click', nextHandler);
nextBtnEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    nextHandler();
}, { passive: false });

// Clear Button
const clearHandler = () => {
    // Reset current selection
    currentWords.forEach(w => w.selected = false);
    selectedWordIds = [];
    renderUI();
};
const clearBtnEl = document.getElementById('clear-btn');
clearBtnEl.addEventListener('click', clearHandler);
clearBtnEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    clearHandler();
}, { passive: false });

// Replay Button
const replayHandler = () => {
    const qData = currentQuestions[currentQuestionIndex];
    if (qData) {
        speak(qData.audio, 1.0);
    }
};
const replayBtnEl = document.getElementById('replay-btn');
replayBtnEl.addEventListener('click', replayHandler);
replayBtnEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    replayHandler();
}, { passive: false });
