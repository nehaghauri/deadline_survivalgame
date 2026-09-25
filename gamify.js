/* ============================================================
   gamify.js — score, combos, and the floating text that makes
   points feel earned instead of just a number changing.
   Load after state.js, before main.js.
   ============================================================ */

const COMBO_CAP = 10;              // multiplier stops climbing past this many in a row
const COMBO_STEP = 0.15;           // each combo point adds 15% to the multiplier

/**
 * Award points, scaled by the current combo multiplier, and bump the combo.
 * Call this on any good outcome: a positive choice, a pickup, a streak milestone.
 */
function addScore(scene, basePoints, x, y) {
    gameState.combo = Math.min(gameState.combo + 1, COMBO_CAP);
    const multiplier = 1 + gameState.combo * COMBO_STEP;
    const points = Math.round(basePoints * multiplier);
    gameState.score += points;

    const label = gameState.combo >= 2 ? `+${points}  x${multiplier.toFixed(1)}` : `+${points}`;
    floatingText(scene, x, y, label, '#ffd24a');

    return points;
}

/** Call this on any bad outcome: auto-pick, chaser hit, a choice with negative net effect. */
function breakCombo() {
    gameState.combo = 0;
}

/** Rising, fading text — used for score popups. */
function floatingText(scene, x, y, text, color) {
    const t = scene.add.text(x, y, text, {
        fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color
    }).setOrigin(0.5).setDepth(9999);

    scene.tweens.add({
        targets: t,
        y: y - 50,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.Out',
        onComplete: () => t.destroy()
    });
}