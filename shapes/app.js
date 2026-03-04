/* ============================================
   Shape World — Game Logic
   ============================================ */

(function () {
    'use strict';

    // ---- Game Data ----
    const SHAPES = [
        { id: 'circle', name: 'Circle', svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45"/></svg>' },
        { id: 'square', name: 'Square', svg: '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="8"/></svg>' },
        { id: 'triangle', name: 'Triangle', svg: '<svg viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90" stroke-linejoin="round"/></svg>' },
        { id: 'star', name: 'Star', svg: '<svg viewBox="0 0 100 100"><polygon points="50,5 61,35 95,35 68,54 78,85 50,68 22,85 32,54 5,35 39,35"/></svg>' },
        { id: 'heart', name: 'Heart', svg: '<svg viewBox="0 0 100 100"><path d="M50,85 C20,55 5,40 5,25 C5,10 20,5 35,5 C43,5 50,10 50,15 C50,10 57,5 65,5 C80,5 95,10 95,25 C95,40 80,55 50,85 Z"/></svg>' },
        { id: 'cross', name: 'Cross', svg: '<svg viewBox="0 0 100 100"><path d="M35,10 L65,10 L65,35 L90,35 L90,65 L65,65 L65,90 L35,90 L35,65 L10,65 L10,35 L35,35 Z" rx="5"/></svg>' },
        { id: 'hexagon', name: 'Hexagon', svg: '<svg viewBox="0 0 100 100"><polygon points="50,5 90,25 90,75 50,95 10,75 10,25"/></svg>' }
    ];

    // ---- DOM refs ----
    const shapeNameEl = document.getElementById('shape-name');
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
    let targetShape = null;
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

    const CONFETTI_COLORS = ['#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#22d3ee', '#f87171', '#818cf8'];

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
        // Pick target shape
        const targetIdx = rand(0, SHAPES.length - 1);
        targetShape = SHAPES[targetIdx];

        // Pick 3 wrong shapes
        let options = [targetShape];
        let availableShapes = SHAPES.filter(s => s.id !== targetShape.id);
        shuffle(availableShapes);
        options.push(availableShapes[0], availableShapes[1], availableShapes[2]);
        shuffle(options);

        // Animate swap
        questionArea.classList.remove('swap-in');
        questionArea.classList.add('swap-out');

        setTimeout(() => {
            // Set question text
            shapeNameEl.textContent = targetShape.name;

            answerBtns.forEach((btn, i) => {
                btn.className = 'answer-btn'; // reset classes
                btn.dataset.shapeId = options[i].id;
                btn.innerHTML = options[i].svg;
            });

            feedbackEl.textContent = '';
            feedbackEl.className = '';

            questionArea.classList.remove('swap-out');
            questionArea.classList.add('swap-in');
            isLocked = false;
        }, 250);
    }

    const MESSAGES_CORRECT = ['Awesome! 🎉', 'Great job! ⭐', 'You did it! 🌟', 'Perfect! 💯', 'Wow! 🤩'];
    const MESSAGES_WRONG = ['Try again! 💪', 'Almost! 🤏', 'Keep looking 🔍'];

    function popBadge(el) {
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        setTimeout(() => el.classList.remove('pop'), 400);
    }

    // ---- Handle Answer ----
    function handleAnswer(e) {
        if (isLocked) return;
        const btn = e.currentTarget;
        const chosenShapeId = btn.dataset.shapeId;

        if (chosenShapeId === targetShape.id) {
            // correct
            isLocked = true;
            btn.classList.add('correct');
            answerBtns.forEach(b => { if (b !== btn) b.classList.add('disabled'); });

            score++; streak++;
            if (streak > bestStreak) bestStreak = streak;
            scoreEl.textContent = score; streakEl.textContent = streak;
            popBadge(scoreBadge); popBadge(streakBadge);

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
