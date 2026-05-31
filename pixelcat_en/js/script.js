(function() {
    const stage = document.getElementById('stage');
    const overlay = document.getElementById('overlay');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const catCanvas = document.getElementById('cat');
    const mouseCanvas = document.getElementById('mouse');
    const cctx = catCanvas.getContext('2d');
    const mctx = mouseCanvas.getContext('2d');

    // ---- Pixel art drawing (32x32 cat, 16x16 mouse) ----
    // Color palette for cat
    const C = {
        '.': null, // transparent
        'k': '#1a1a1a', // black outline
        'b': '#2b2b2b', // body dark
        'g': '#4a4a4a', // body light
        'p': '#ffb3c6', // pink (nose/inner ear)
        'y': '#ffd966', // eye yellow
        'w': '#ffffff', // eye white sparkle
    };

    // 32x32 sitting/running cat sprite (simple, readable)
    const CAT = [
        "................................",
        "................................",
        "....kk....................kk....",
        "...kbbk..................kbbk...",
        "...kbpbk................kbpbk...",
        "...kbpbk................kbpbk...",
        "....kbbkkkkkkkkkkkkkkkkkkkbbk...",
        "....kbbbbbbbbbbbbbbbbbbbbbbbk...",
        "...kbggbbbbbbbbbbbbbbbbbbggbk...",
        "..kbggggbbbbbbbbbbbbbbbbggggbk..",
        "..kbgggggbbbbbbbbbbbbbbgggggbk..",
        "..kbggwygbbbbbbbbbbbbbgwyggggbk.",
        "..kbggyygbbbbbbbbbbbbbgyyggggbk.",
        "..kbgggggbbbbbbbpbbbbbgggggggbk.",
        "..kbggggggbbbbbpppbbbggggggggbk.",
        "..kbggggggbbbbbbpbbbbggggggggbk.",
        "..kbggggggbbbbbbbbbbbggggggggbk.",
        "..kbgggggggbbbbbbbbbgggggggggbk.",
        "..kbggggggggbbbbbbbggggggggggbk.",
        "..kbgggggggggbbbbbgggggggggggbk.",
        "...kbggggggggggggggggggggggggbk.",
        "...kbbggggggggggggggggggggggbk..",
        "....kbbgggggggggggggggggggggbk..",
        "....kbbgggggggggggggggggggggbk..",
        ".....kbbbggggggggggggggggggbk...",
        "......kbbbbggggggggggggggbbk....",
        ".......kkbbbbbbbbbbbbbbbbkk.....",
        "........kbbk....kbbk...kbbk.....",
        "........kbbk....kbbk...kbbk.....",
        ".........kk......kk.....kk......",
        "................................",
        "................................",
    ];

    // Tail sprite drawn separately so it can wag
    function drawSprite(ctx, sprite, palette) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        for (let y = 0; y < sprite.length; y++) {
            const row = sprite[y];
            for (let x = 0; x < row.length; x++) {
                const c = palette[row[x]];
                if (!c) continue;
                ctx.fillStyle = c;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    // Toy mouse 16x16
    const MC = {
        '.': null,
        'k': '#1a1a1a',
        'g': '#8a8a96',
        'l': '#b8b8c4',
        'p': '#ff6b9a',
        'e': '#1a1a1a'
    };
    const MOUSE = [
        "................",
        "................",
        "....kk....kk....",
        "...kllk..kllk...",
        "...klpk..klpk...",
        "....kk....kk....",
        "..kkggkkkkggkk..",
        ".kglllllllllllgk",
        ".kglellllllelgkp",
        ".kgllllllllllgkp",
        ".kgllllllllllgk.",
        "..kkgggggggggk..",
        "...kkkkkkkkkkk..",
        "......kk........",
        "................",
        "................",
    ];

    drawSprite(mctx, MOUSE, MC);

    // Scale up the canvases visually
    const CAT_SCALE = 3; // 32 -> 96px
    const MOUSE_SCALE = 2; // 16 -> 32px
    catCanvas.style.width = (32 * CAT_SCALE) + 'px';
    catCanvas.style.height = (32 * CAT_SCALE) + 'px';
    mouseCanvas.style.width = (16 * MOUSE_SCALE) + 'px';
    mouseCanvas.style.height = (16 * MOUSE_SCALE) + 'px';

    drawSprite(cctx, CAT, C);

    // ---- Animation / chase logic ----
    let running = false;
    let raf = 0;
    const target = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
    };
    const cat = {
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2,
        vx: 0,
        vy: 0,
        facing: 1
    };
    const mouseToy = {
        x: 0,
        y: 0
    };
    let t0 = performance.now();

    function onMove(e) {
        const r = stage.getBoundingClientRect();
        target.x = e.clientX - r.left;
        target.y = e.clientY - r.top;
    }

    function onTouch(e) {
        if (e.touches && e.touches[0]) {
            const r = stage.getBoundingClientRect();
            target.x = e.touches[0].clientX - r.left;
            target.y = e.touches[0].clientY - r.top;
        }
    }

    function tick(now) {
        const dt = Math.min(0.05, (now - t0) / 1000);
        t0 = now;

        // toy mouse sits a bit offset from cursor and bobs
        mouseToy.x = target.x;
        mouseToy.y = target.y;

        // cat seeks the mouse toy with simple steering + easing
        const dx = mouseToy.x - cat.x;
        const dy = mouseToy.y - cat.y;
        const dist = Math.hypot(dx, dy);
        const stopRadius = 36; // when this close, slow down to a "pounce-ready" creep
        const maxSpeed = 520; // px/s
        const accel = 8.0; // how snappy
        const desiredSpeed = dist < stopRadius ? Math.max(0, dist * 6) : maxSpeed;
        const nx = dist > 0.01 ? dx / dist : 0;
        const ny = dist > 0.01 ? dy / dist : 0;
        const tvx = nx * desiredSpeed;
        const tvy = ny * desiredSpeed;
        cat.vx += (tvx - cat.vx) * Math.min(1, accel * dt);
        cat.vy += (tvy - cat.vy) * Math.min(1, accel * dt);
        cat.x += cat.vx * dt;
        cat.y += cat.vy * dt;
        if (Math.abs(cat.vx) > 8) cat.facing = cat.vx > 0 ? 1 : -1;

        // little bob while running
        const speed = Math.hypot(cat.vx, cat.vy);
        const bob = speed > 30 ? Math.sin(now / 70) * 2 : 0;

        // place cat: center on its position, accounting for scale
        const catW = 32 * CAT_SCALE;
        const catH = 32 * CAT_SCALE;
        catCanvas.style.transform =
            `translate(${cat.x - catW / 2}px, ${cat.y - catH / 2 + bob}px) scaleX(${cat.facing})`;

        // place mouse toy: just under the cursor with a tiny wiggle
        const mW = 16 * MOUSE_SCALE;
        const mH = 16 * MOUSE_SCALE;
        const wig = Math.sin(now / 120) * 3;
        mouseCanvas.style.transform =
            `translate(${mouseToy.x - mW / 2 + wig}px, ${mouseToy.y - mH / 2}px)`;

        if (running) raf = requestAnimationFrame(tick);
    }

    function start() {
        if (running) return;
        overlay.style.display = 'none';
        stopBtn.style.display = 'block';
        running = true;
        t0 = performance.now();
        window.addEventListener('mousemove', onMove, {
            passive: true
        });
        window.addEventListener('touchmove', onTouch, {
            passive: true
        });
        raf = requestAnimationFrame(tick);
    }

    function stop() {
        running = false;
        cancelAnimationFrame(raf);
        overlay.style.display = 'flex';
        stopBtn.style.display = 'none';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onTouch);
    }

    startBtn.addEventListener('click', start);
    stopBtn.addEventListener('click', stop);
})();