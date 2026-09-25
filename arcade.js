/* ============================================================
   arcade.js — the part of the game that isn't a menu.
   Two systems, both purely real-time, no clicking:
     1. Collectibles — walk over them for an instant stat boost.
     2. The Chaser — a roaming threat that hurts your sanity on contact.
   Load after state.js and world-art.js (needs BUILDINGS), before main.js.
   ============================================================ */

const COLLECTIBLE_TYPES = [
    { emoji: '☕', effect: { energy: 15 },    label: '+15 energy',   weight: 3 },
    { emoji: '💰', effect: { money: 50 },     label: '+Rs.50',       weight: 3 },
    { emoji: '📚', effect: { academics: 8 },  label: '+8 academics', weight: 3 },
    { emoji: '🍕', effect: { sanity: 10 },    label: '+10 sanity',   weight: 3 },
    { emoji: '⚡', effect: {},                label: 'SPEED BOOST + Deadline immunity (8s)', weight: 1, powerUp: true }
];

function pickWeightedType() {
    const total = COLLECTIBLE_TYPES.reduce((sum, t) => sum + t.weight, 0);
    let roll = Phaser.Math.Between(1, total);
    for (const t of COLLECTIBLE_TYPES) {
        roll -= t.weight;
        if (roll <= 0) return t;
    }
    return COLLECTIBLE_TYPES[0];
}

const COLLECTIBLE_COUNT = 10;
const PICKUP_RADIUS = 34;
const RESPAWN_DELAY_MS = [12000, 22000];   // random range

let collectibles = [];

function spawnCollectibles(scene, worldWidth, worldHeight, buildings) {
    collectibles = [];
    for (let i = 0; i < COLLECTIBLE_COUNT; i++) {
        collectibles.push(makeCollectible(scene, worldWidth, worldHeight, buildings));
    }
}

function makeCollectible(scene, worldWidth, worldHeight, buildings) {
    const type = pickWeightedType();
    const pos = randomOpenSpot(worldWidth, worldHeight, buildings);

    const text = scene.add.text(pos.x, pos.y, type.emoji, { fontSize: '26px' }).setOrigin(0.5);
    text.setDepth(pos.y);

    // Gentle bob so it reads as "alive" and grabbable, not decoration.
    scene.tweens.add({
        targets: text, y: pos.y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut'
    });

    return { type, sprite: text, x: pos.x, y: pos.y, active: true };
}

function randomOpenSpot(worldWidth, worldHeight, buildings) {
    let x, y, tries = 0;
    do {
        x = Phaser.Math.Between(60, worldWidth - 60);
        y = Phaser.Math.Between(60, worldHeight - 60);
        tries++;
    } while (tries < 20 && buildings.some(b => Math.abs(x - b.x) < (b.w || 100) && Math.abs(y - b.y) < (b.h || 100)));
    return { x, y };
}

/** Call every frame from update(). */
function updateCollectibles(scene, worldWidth, worldHeight, buildings) {
    collectibles.forEach(c => {
        if (!c.active) return;
        const dist = Phaser.Math.Distance.Between(player.x, player.y, c.x, c.y);
        if (dist < PICKUP_RADIUS) collectPickup(scene, c, worldWidth, worldHeight, buildings);
    });
}

function collectPickup(scene, c, worldWidth, worldHeight, buildings) {
    c.active = false;
    c.sprite.destroy();

    if (c.type.powerUp) {
        speedBoostUntil = scene.time.now + 8000;
        chaserImmuneUntil = scene.time.now + 8000;
        showToast('⚡ Speed boost + Deadline immunity!', 'good');
        addScore(scene, 60, player.x, player.y - 20);
    } else {
        const deltas = applyEffects(c.type.effect);
        showDeltas(deltas);
        showToast(`${c.type.emoji} ${c.type.label}`, 'good');
        addScore(scene, 30, player.x, player.y - 20);
    }

    spawnStatBurst(scene, player.x, player.y - 20, 10);

    const delay = Phaser.Math.Between(RESPAWN_DELAY_MS[0], RESPAWN_DELAY_MS[1]);
    scene.time.delayedCall(delay, () => {
        const fresh = makeCollectible(scene, worldWidth, worldHeight, buildings);
        const idx = collectibles.indexOf(c);
        if (idx !== -1) collectibles[idx] = fresh;
    });
}

/* ===================== THE CHASER ===================== */
// A roaming threat. Wanders like an NPC until you get close, then hunts
// you — slightly slower than the player, so it's always technically
// escapable, but punishing to ignore.

const CHASER_AGGRO_RADIUS = 240;
const CHASER_SPEED = 130;          // player is 160 — always outrunnable
const CHASER_HIT_COOLDOWN = 5000;
const CHASER_HIT_RADIUS = 30;

let chaser = null;

function createChaser(scene, worldWidth, worldHeight) {
    const sprite = scene.physics.add.sprite(worldWidth * 0.7, worldHeight * 0.3, 'player', 0);
    sprite.setTint(0x2a0a0a);
    sprite.body.setSize(20, 24);
    sprite.body.setOffset(22, 36);
    sprite.body.setCollideWorldBounds(true);

    const label = scene.add.text(sprite.x, sprite.y - 36, '⚠ Deadline', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#ff6b6b', fontStyle: 'bold'
    }).setOrigin(0.5);

    chaser = {
        sprite, label,
        direction: 'down',
        state: 'idle',
        target: null,
        waitUntil: scene.time.now + 1000,
        lastHit: -Infinity
    };
}

function updateChaser(scene, worldWidth, worldHeight) {
    if (!chaser) return;
    const c = chaser;

    c.sprite.setDepth(c.sprite.y);
    c.label.setPosition(c.sprite.x, c.sprite.y - 36);

    const distToPlayer = Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, player.x, player.y);

    // Gets faster and more alert as the semester goes on — day 1 is gentle, day 14 is not.
    const dayScale = Math.min((gameState.day - 1) / 13, 1);
    const aggroRadius = CHASER_AGGRO_RADIUS + dayScale * 100;
    const chaseSpeed = CHASER_SPEED + dayScale * 50;

    const hunting = distToPlayer < aggroRadius;

    let dx, dy, dist, speed;

    if (hunting) {
        dx = player.x - c.sprite.x;
        dy = player.y - c.sprite.y;
        dist = distToPlayer;
        speed = chaseSpeed;
        c.label.setColor('#ff2b2b');
    } else {
        if (c.state === 'idle') {
            c.sprite.anims.play(`idle-${c.direction}`, true);
            if (scene.time.now >= c.waitUntil) {
                c.target = {
                    x: Phaser.Math.Clamp(c.sprite.x + Phaser.Math.Between(-200, 200), 40, worldWidth - 40),
                    y: Phaser.Math.Clamp(c.sprite.y + Phaser.Math.Between(-200, 200), 40, worldHeight - 40)
                };
                c.state = 'walking';
            }
            c.label.setColor('#ff6b6b');
            return;
        }
        dx = c.target.x - c.sprite.x;
        dy = c.target.y - c.sprite.y;
        dist = Math.hypot(dx, dy);
        speed = 60;
        c.label.setColor('#ff6b6b');

        if (dist < 8) {
            c.sprite.body.setVelocity(0, 0);
            c.state = 'idle';
            c.waitUntil = scene.time.now + Phaser.Math.Between(1000, 2500);
            return;
        }
    }

    c.sprite.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    c.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    c.sprite.anims.play(`walk-${c.direction}`, true);

    // Contact check, with a cooldown so one touch doesn't chain-hit every frame.
    if (distToPlayer < CHASER_HIT_RADIUS && scene.time.now - c.lastHit > CHASER_HIT_COOLDOWN) {
        if (scene.time.now < chaserImmuneUntil) return;   // power-up active — no damage

        c.lastHit = scene.time.now;
        const deltas = applyEffects({ sanity: -10 });
        showDeltas(deltas);
        showToast('The Deadline caught you! -10 sanity', 'bad');
        spawnStatBurst(scene, player.x, player.y - 20, -10);
        maybeShake({ sanity: -10 });
        breakCombo();
    }
}