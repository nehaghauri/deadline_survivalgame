/* ============================================================
   movement.js — lets a CHOICE move the player, not just the keyboard.
   Load after state.js, before main.js.
   ============================================================ */

let autoWalking = false;   // while true, arrow keys are ignored — the choice is driving

/**
 * Walks the player toward (x, y) at normal speed, playing the walk
 * animation, then calls onArrive() once close enough. Locks out
 * keyboard input for the duration so the two don't fight each other.
 */
function walkPlayerTo(scene, x, y, onArrive) {
    autoWalking = true;

    const speed = 160;

    // Re-checked every frame via a scene event, not a single tween,
    // because the target might be slightly off from a straight line
    // (buildings are rectangles, doors sit on their edge).
    const mover = scene.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
            const dx = x - player.x;
            const dy = y - player.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 10) {
                player.setVelocity(0, 0);
                player.anims.play(`idle-${lastDirection}`, true);
                autoWalking = false;
                mover.remove();
                if (onArrive) onArrive();
                return;
            }

            player.setVelocity((dx / dist) * speed, (dy / dist) * speed);

            // Face the direction actually being walked, same as manual movement.
            if (Math.abs(dx) > Math.abs(dy)) {
                lastDirection = dx > 0 ? 'right' : 'left';
            } else {
                lastDirection = dy > 0 ? 'down' : 'up';
            }
            player.anims.play(`walk-${lastDirection}`, true);
        }
    });
}

/** Looks up a building by name (case-insensitive) and returns its door position, or null. */
function findBuildingDoor(name) {
    const match = BUILDINGS.find(b => b.name.toLowerCase() === name.toLowerCase());
    if (!match) return null;
    return { x: match.x, y: match.y + match.h / 2 - 20 };   // just inside the door
}