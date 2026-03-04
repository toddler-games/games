/* ============================================
   Letter Match — Game Logic
   ============================================ */

(function () {
    'use strict';

    // ---- Game Data ----
    const LETTERS = [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
        'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
        'U', 'V', 'W', 'X', 'Y', 'Z'
    ];

    // ---- DOM refs ----
    const letterDisplayEl = document.getElementById('letter-display');
    const questionEmoji = document.getElementById('question-emoji');
    const questionArea = document.getElementById('question-area');
    const feedbackEl = document.getElementById('feedback');
    const scoreEl = document.getElementById('score-value');
    const streakEl = document.getElementById('streak-value');
    const scoreBadge = document.getElementById('score-badge');
    const streakBadge = document.getElementById('streak-badge');
    const answerBtns = [
        document.getElementById('ans-0'),
        document.getElementById('ans-1'),
        document.getElementById('ans-2'),
        document.getElementById('ans-3'),
    ];
    const confettiCanvas = document.getElementById('confetti-canvas');
    const ctx = confettiCanvas.getContext('2d');

    // ---- Game state ----
    let score = 0;
    let streak = 0;
    let bestStreak = 0;
    let targetLetter = '';
    let correctAnswer = '';
    let isLocked = false;

    // ---- Helpers ----
    function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = rand(0, i);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // ---- Sound (Web Audio API) ----
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx;

    function ensureAudio() { if (!audioCtx) audioCtx = new AudioCtx(); }

    function playTone(freq, duration, type = 'sine', volume = 0.15) {
        try {
            ensureAudio();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type; osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); osc.stop(audioCtx.currentTime + duration);
        } catch (_) { }
    }

    function playCorrectSound() {
        playTone(523.25, 0.12, 'sine', 0.12);
        setTimeout(() => playTone(659.25, 0.12, 'sine', 0.12), 100);
        setTimeout(() => playTone(783.99, 0.2, 'sine', 0.12), 200);
    }

    function playWrongSound() { playTone(220, 0.25, 'sawtooth', 0.06); }

    // ---- Confetti System ----
    let confettiPieces = [];
    let confettiRunning = false;

    function resizeCanvas() {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const CONFETTI_COLORS = ['#a78bfa', '#6C5CE7', '#34d399', '#fbbf24', '#22d3ee', '#f87171', '#818cf8'];

    function spawnConfetti(count = 60) {
        for (let i = 0; i < count; i++) {
            confettiPieces.push({
                x: confettiCanvas.width / 2 + rand(-120, 120),
                y: confettiCanvas.height * 0.35,
                vx: rand(-8, 8), vy: rand(-14, -4),
                size: rand(6, 12), color: CONFETTI_COLORS[rand(0, CONFETTI_COLORS.length - 1)],
                rotation: rand(0, 360), rotSpeed: rand(-8, 8),
                gravity: 0.35, life: 1, decay: rand(8, 16) / 1000,
            });
        }
        if (!confettiRunning) { confettiRunning = true; animateConfetti(); }
    }

    function animateConfetti() {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiPieces = confettiPieces.filter(p => p.life > 0);
        for (const p of confettiPieces) {
            p.x += p.vx; p.vy += p.gravity; p.y += p.vy;
            p.rotation += p.rotSpeed; p.life -= p.decay;
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); ctx.restore();
        }
        if (confettiPieces.length > 0) requestAnimationFrame(animateConfetti);
        else { confettiRunning = false; ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
    }

    // ---- Generate Question ----
    function generateQuestion() {
        // Pick a random target letter
        const targetIdx = rand(0, LETTERS.length - 1);
        const baseLetter = LETTERS[targetIdx];

        // Randomly decide direction: show uppercase→match lowercase, or show lowercase→match uppercase
        const showUppercase = Math.random() < 0.5;

        if (showUppercase) {
            // Display uppercase, answers are lowercase
            targetLetter = baseLetter;
            correctAnswer = baseLetter.toLowerCase();
        } else {
            // Display lowercase, answers are uppercase
            targetLetter = baseLetter.toLowerCase();
            correctAnswer = baseLetter;
        }

        // Build 4 options: 1 correct + 3 wrong in the answer case
        let options = [correctAnswer];

        let availableLetters = LETTERS.filter(l => l !== baseLetter);
        shuffle(availableLetters);

        for (let i = 0; i < 3; i++) {
            options.push(showUppercase ? availableLetters[i].toLowerCase() : availableLetters[i]);
        }
        shuffle(options);

        // Animate swap
        questionArea.classList.remove('swap-in');
        questionArea.classList.add('swap-out');

        setTimeout(() => {
            letterDisplayEl.textContent = targetLetter;

            answerBtns.forEach((btn, i) => {
                btn.className = 'answer-btn'; // reset classes
                btn.textContent = options[i];
                btn.dataset.letter = options[i];
            });

            feedbackEl.textContent = '';
            feedbackEl.className = '';

            questionArea.classList.remove('swap-out');
            questionArea.classList.add('swap-in');
            isLocked = false;
        }, 250);
    }

    const EMOJIS_THINKING = ['🔤', '🤔', '📝', '✏️', '🧐', '🤓', '🐣', '🦊', '🌈', '🎈'];
    const EMOJIS_CORRECT = ['🎉', '🥳', '⭐', '🌟', '✨', '💯', '🏆', '👏', '🤩', '💪'];

    const MESSAGES_CORRECT = ['Awesome! 🎉', 'Great job! ⭐', 'You did it! 🌟', 'Perfect! 💯', 'Wow! 🤩', 'Amazing! 🏆', 'Super! 💪'];
    const MESSAGES_WRONG = ['Try again! 💪', 'Almost! 🤏', 'Keep looking 🔍', 'Not quite — you got this! 💭'];

    function popBadge(el) {
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        setTimeout(() => el.classList.remove('pop'), 400);
    }

    // ---- Handle Answer ----
    function handleAnswer(e) {
        if (isLocked) return;
        const btn = e.currentTarget;
        const chosenLetter = btn.dataset.letter;

        if (chosenLetter === correctAnswer) {
            // correct
            isLocked = true;
            btn.classList.add('correct');
            answerBtns.forEach(b => { if (b !== btn) b.classList.add('disabled'); });

            score++; streak++;
            if (streak > bestStreak) bestStreak = streak;
            scoreEl.textContent = score; streakEl.textContent = streak;
            popBadge(scoreBadge); popBadge(streakBadge);

            questionEmoji.textContent = EMOJIS_CORRECT[rand(0, EMOJIS_CORRECT.length - 1)];
            feedbackEl.textContent = MESSAGES_CORRECT[rand(0, MESSAGES_CORRECT.length - 1)];
            feedbackEl.className = 'correct-msg';

            playCorrectSound();
            spawnConfetti(streak >= 5 ? 80 : 45);

            setTimeout(generateQuestion, 1200);
        } else {
            // wrong
            btn.classList.add('wrong');
            streak = 0; streakEl.textContent = streak;

            feedbackEl.textContent = MESSAGES_WRONG[rand(0, MESSAGES_WRONG.length - 1)];
            feedbackEl.className = 'wrong-msg';

            playWrongSound();
            setTimeout(() => btn.classList.remove('wrong'), 600);
        }
    }

    // ---- Init ----
    answerBtns.forEach(btn => {
        btn.addEventListener('click', handleAnswer);
        btn.addEventListener('touchend', (e) => { e.preventDefault(); handleAnswer(e); });
    });

    generateQuestion();
})();
