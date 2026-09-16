/* ============================================================
   polish.js — small visual effects layered on top of the world.
   Load after state.js, before main.js.
   ============================================================ */

let dayTint;

/** A full-screen dark overlay, fixed to the camera, that deepens as the semester wears on. */
function createDayTint(scene) {
    dayTint = scene.add.rectangle(400, 300, 800, 600, 0x1a0f08, 0);
    dayTint.setScrollFactor(0);   // stays put relative to the camera, not the world
    dayTint.setDepth(999);        // draw above everything except the HUD (which is DOM, not Phaser)
}

/** Call this whenever the day changes. */
function updateDayTint() {
    if (!dayTint) return;
    const progress = Math.min(1, (gameState.day - 1) / 13);   // 0 on day 1, 1 on day 14
    dayTint.setAlpha(progress * 0.4);
}

/**
 * A quick burst of small circles at (x, y) that fly outward and fade —
 * no particle texture required, just tweened shapes.
 * @param {number} netChange sum of the stat deltas; decides green vs red
 */
function spawnStatBurst(scene, x, y, netChange) {
    const color = netChange >= 0 ? 0x4ade80 : 0xf87171;
    const count = 6;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dot = scene.add.circle(x, y, 3, color, 0.9);
        dot.setDepth(998);

        scene.tweens.add({
            targets: dot,
            x: x + Math.cos(angle) * 34,
            y: y + Math.sin(angle) * 34,
            alpha: 0,
            duration: 500,
            ease: 'Cubic.Out',
            onComplete: () => dot.destroy()
        });
    }
}