/* ============================================================
   hud.js — a DOM overlay sitting on top of the Phaser canvas.
   Phaser owns the world; the DOM owns the readouts.
   Load AFTER state.js.
   ============================================================ */

const HUD_STATS = [
    { key: 'health',    label: 'Health',    icon: '❤️' },
    { key: 'sanity',    label: 'Sanity',    icon: '🧠' },
    { key: 'energy',    label: 'Energy',    icon: '⚡' },
    { key: 'academics', label: 'Academics', icon: '📚' }
];

/** Builds the HUD markup once, into #hud. Call this on page load. */
function buildHUD() {
    const hud = document.getElementById('hud');
    if (!hud) {
        console.warn('No #hud element found — add <div id="hud"></div> to index.html');
        return;
    }

    hud.innerHTML = `
        <div class="hud-day" id="hud-day">Day 1</div>
        <div class="hud-day" id="hud-score" style="color:#ffd24a; font-weight:700;"></div>
        <div class="hud-day" id="hud-streak" style="color:#ff9d4a;"></div>
        <div class="hud-day" id="hud-rivalry" style="color:#9dc4ff;"></div>
        <div class="hud-bars">
            ${HUD_STATS.map(s => `
                <div class="hud-stat" id="hud-stat-${s.key}">
                    <span class="hud-label">${s.icon} ${s.label}</span>
                    <div class="hud-bar"><div class="hud-bar-fill" id="hud-bar-${s.key}"></div></div>
                    <span class="hud-value" id="hud-value-${s.key}">0</span>
                    <span class="hud-delta" id="hud-delta-${s.key}"></span>
                </div>
            `).join('')}
            <div class="hud-money">💰 Rs. <span id="hud-value-money">0</span>
                <span class="hud-delta" id="hud-delta-money"></span>
            </div>
        </div>
    `;

    updateHUD();
}

/** Repaints the HUD from gameState. Safe to call any time. */
function updateHUD() {
    document.getElementById('hud-day').textContent = `Day ${gameState.day}`;
    document.getElementById('hud-score').textContent = `⭐ ${gameState.score}${gameState.combo >= 2 ? ` (x${(1 + gameState.combo * 0.15).toFixed(1)} combo)` : ''}`;
    document.getElementById('hud-streak').textContent = gameState.streak >= 2 ? `🔥 ${gameState.streak}-day streak` : '';
    document.getElementById('hud-rivalry').textContent = (gameState.aiWins + gameState.humanWins > 0)
        ? `🤖 ${gameState.aiWins} — 🧑 ${gameState.humanWins}`
        : '';

    HUD_STATS.forEach(s => {
        const value = gameState[s.key];
        const fill = document.getElementById(`hud-bar-${s.key}`);
        fill.style.width = value + '%';

        if (value <= 25)      fill.style.background = '#f87171';
        else if (value <= 60) fill.style.background = '#facc15';
        else                  fill.style.background = '#4ade80';

        document.getElementById(`hud-value-${s.key}`).textContent = value;
    });

    document.getElementById('hud-value-money').textContent = gameState.money;
}

/**
 * Flash "+15" / "-10" next to each stat that moved, then repaint.
 * @param {object} deltas the return value of applyEffects()
 */
function showDeltas(deltas) {
    Object.entries(deltas).forEach(([key, change]) => {
        if (!change) return;

        const el = document.getElementById(`hud-delta-${key}`);
        if (!el) return;

        el.textContent = (change > 0 ? '+' : '') + change;
        el.className = 'hud-delta ' + (change > 0 ? 'up' : 'down') + ' show';

        setTimeout(() => { el.className = 'hud-delta'; el.textContent = ''; }, 1400);
    });

    updateHUD();
}