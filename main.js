/* ============================================================
   main.js — the whole game boot sequence.

   Load order in index.html must be:
     phaser.min.js → state.js → HUD.js → main.js

   Read this top-to-bottom once. It's four jobs, in order:
     1. Phaser config (tells Phaser WHERE and HOW BIG to draw)
     2. preload() — load the sprite sheet
     3. create() — build the world: player, buildings, doors, camera
     4. update() — runs 60x/sec: reads keyboard, moves the player
   ============================================================ */

const WORLD_WIDTH = 1300;
const WORLD_HEIGHT = 1000;

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',   // <-- must match the div id in index.html EXACTLY
    scale: {
        mode: Phaser.Scale.NONE,   // Phaser keeps a fixed internal resolution;
        width: 1280,               // CSS stretches the canvas visually to fill
        height: 800                // the screen — see index.html for that part.
    },
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);
window.game = game;

/* ===================== PLAYER SPRITE ROWS ===================== */
// The sheet is 64x64 frames, 13 frames per row, 4 directional rows.
const ROWS = { up: 0, left: 1, down: 2, right: 3 };
const FRAMES_PER_ROW = 13;

let player;
let cursors;
let buildingsGroup;
let doorsGroup;
let lastDirection = 'down';

/* ===================== PRELOAD ===================== */

function preload() {
    this.load.spritesheet('player', 'player-walk.png', {
        frameWidth: 64,
        frameHeight: 64
    });

    // Real distinct characters for Neha, Filza, Fati — same 64x64/13-per-row/4-row
    // layout as the player, exported from the Universal LPC generator.
    this.load.spritesheet('neha-sprite', 'neha-walk.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('filza-sprite', 'filza-walk.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('fati-sprite', 'fati-walk.png', { frameWidth: 64, frameHeight: 64 });

    // Real tileset sprites, extracted from your downloaded RPG Maker MV assets.
    this.load.image('house-small-red', 'assets/buildings/house-small-red.png');
    this.load.image('house-large-red', 'assets/buildings/house-large-red.png');
    this.load.image('house-blue', 'assets/buildings/house-blue.png');
    this.load.image('house-green', 'assets/buildings/house-green.png');
    this.load.image('house-green-small', 'assets/buildings/house-green-small.png');
    this.load.image('house-blue-small', 'assets/buildings/house-blue-small.png');
    this.load.image('grass-tile', 'assets/ground/grass.png');
    this.load.image('path-tile', 'assets/ground/path.png');
    this.load.image('tree-prop', 'assets/ground/tree.png');
    this.load.image('bush-prop', 'assets/ground/bush.png');
    this.load.image('flower-pink', 'assets/props/flower-pink.png');
    this.load.image('flower-blue', 'assets/props/flower-blue.png');
    this.load.image('rock-small', 'assets/props/rock-small.png');
    this.load.image('rock-cluster', 'assets/props/rock-cluster.png');
    this.load.image('signpost', 'assets/props/signpost.png');
}

/* ===================== CREATE ===================== */

function create() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Ground: grass texture + dirt paths instead of a flat rectangle.
    drawGround(this, WORLD_WIDTH, WORLD_HEIGHT, [...BUILDINGS, ...DECOR_BUILDINGS]);

    createPlayer(this);
    createAnimations(this);
    createBuildings(this);
    createNPCs(this);
    spawnCollectibles(this, WORLD_WIDTH, WORLD_HEIGHT, [...BUILDINGS, ...DECOR_BUILDINGS]);
    createChaser(this, WORLD_WIDTH, WORLD_HEIGHT);

    this.physics.add.collider(player, buildingsGroup);
    this.physics.add.overlap(player, doorsGroup, onDoorEnter, null, this);

    this.cameras.main.startFollow(player, true, 0.1, 0.1);

    createDayTint(this);

    cursors = this.input.keyboard.createCursorKeys();

    buildHUD();   // from HUD.js — draws the stat bars now that the scene exists
}

function createPlayer(scene) {
    player = scene.physics.add.sprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'player', 0);
    player.setCollideWorldBounds(true);

    // Collision box smaller than the sprite so it feels centered on the feet.
    player.body.setSize(20, 24);
    player.body.setOffset(22, 36);
}

const CHARACTER_TEXTURES = ['player', 'neha-sprite', 'filza-sprite', 'fati-sprite'];

function createAnimations(scene) {
    CHARACTER_TEXTURES.forEach(texKey => {
        const prefix = texKey === 'player' ? '' : `${texKey}-`;

        Object.entries(ROWS).forEach(([direction, row]) => {
            const start = row * FRAMES_PER_ROW;
            scene.anims.create({
                key: `${prefix}walk-${direction}`,
                frames: scene.anims.generateFrameNumbers(texKey, { start: start, end: start + 7 }),
                frameRate: 10,
                repeat: -1
            });
            scene.anims.create({
                key: `${prefix}idle-${direction}`,
                frames: [{ key: texKey, frame: start }],
                frameRate: 1
            });
        });
    });
}

/* ===================== BUILDINGS & DOORS ===================== */
// Colored rectangles for now — intentional, per the design doc.
// { x, y } is the CENTER of the building.

const BUILDINGS = [
    { name: 'Dorm Room', x: 260,  y: 220,  w: 133, h: 157, textureKey: 'house-small-red' },
    { name: 'Classroom', x: 1040, y: 220,  w: 205, h: 166, textureKey: 'house-large-red' },
    { name: 'Cafeteria', x: 260,  y: 780,  w: 220, h: 277, textureKey: 'house-blue' },
    { name: 'Library',   x: 1040, y: 780,  w: 169, h: 100, textureKey: 'house-green' }
];

// Decorative only — no door, no AI event, just fills out the campus skyline.
const DECOR_BUILDINGS = [
    { name: 'Admin Office', x: 650, y: 160, w: 118, h: 98, textureKey: 'house-green-small' },
    { name: 'Student Union', x: 650, y: 840, w: 118, h: 98, textureKey: 'house-blue-small' }
];

const DOOR_SIZE = 50;

function createBuildings(scene) {
    buildingsGroup = scene.physics.add.staticGroup();
    doorsGroup = scene.physics.add.staticGroup();

    BUILDINGS.forEach(b => {
        const wall = drawBuilding(scene, b);
        buildingsGroup.add(wall);

        // Door sits on the bottom edge, center of the building.
        const doorY = b.y + b.h / 2;
        const doorRect = scene.add.rectangle(b.x, doorY, DOOR_SIZE, DOOR_SIZE, 0xff9d00, 0.6);
        scene.physics.add.existing(doorRect, true);
        doorRect.name = b.name;   // this is what onDoorEnter reads
        doorsGroup.add(doorRect);
    });

    // Decorative buildings: solid (you can't walk through them) but no door/dialogue.
    DECOR_BUILDINGS.forEach(b => {
        const sprite = scene.add.image(b.x, b.y, b.textureKey);
        sprite.setDepth(b.y);

        const wall = scene.add.rectangle(b.x, b.y + sprite.height * 0.15, sprite.width * 0.7, sprite.height * 0.45, 0x000000, 0);
        scene.physics.add.existing(wall, true);
        buildingsGroup.add(wall);

        scene.add.text(b.x, b.y - sprite.height / 2 - 10, b.name, {
            fontFamily: 'sans-serif', fontSize: '12px', color: '#c9c4d6'
        }).setOrigin(0.5).setDepth(9999);
    });
}

/* ===================== UPDATE (runs every frame) ===================== */

function update() {
    if (dialogueOpen) return;   // freeze everything while a dialogue is open

    updateNPCs(game.scene.scenes[0], WORLD_WIDTH, WORLD_HEIGHT);
    updateCollectibles(game.scene.scenes[0], WORLD_WIDTH, WORLD_HEIGHT, [...BUILDINGS, ...DECOR_BUILDINGS]);
    updateChaser(game.scene.scenes[0], WORLD_WIDTH, WORLD_HEIGHT);

    player.setDepth(player.y);

    if (autoWalking) return;    // a choice is driving the character right now — don't fight it

    const speed = game.scene.scenes[0].time.now < speedBoostUntil ? 260 : 160;
    player.setVelocity(0);

    let moving = false;

    if (cursors.left.isDown) {
        player.setVelocityX(-speed);
        lastDirection = 'left';
        moving = true;
    } else if (cursors.right.isDown) {
        player.setVelocityX(speed);
        lastDirection = 'right';
        moving = true;
    }

    if (cursors.up.isDown) {
        player.setVelocityY(-speed);
        lastDirection = 'up';
        moving = true;
    } else if (cursors.down.isDown) {
        player.setVelocityY(speed);
        lastDirection = 'down';
        moving = true;
    }

    player.anims.play(moving ? `walk-${lastDirection}` : `idle-${lastDirection}`, true);

    // Once the player has actually walked off the door tile, forget it —
    // this is what lets the SAME door trigger again on a future visit.
    if (currentDoorName && currentDoorZone) {
        const stillOverlapping = Phaser.Geom.Intersects.RectangleToRectangle(
            player.getBounds(), currentDoorZone.getBounds()
        );
        if (!stillOverlapping) {
            currentDoorName = null;
            currentDoorZone = null;
        }
    }
}

/* ============================================================
   DIALOGUE + EVENT SECTION
   This is the part that talks to your Express/Groq backend.
   ============================================================ */

let currentDoorName = null;
let currentDoorZone = null;
let dialogueOpen = false;
let currentEvent = null;      // needed so recordMemory() can see the event title
let currentPredictedIndex = null;
let decisionTimeout = null;

const DECISION_SECONDS = 8;

function onDoorEnter(player, door) {
    if (dialogueOpen || door.name === currentDoorName) return;
    currentDoorName = door.name;
    currentDoorZone = door;
    openDialogue(door.name);
}

async function openDialogue(locationName) {
    dialogueOpen = true;
    player.setVelocity(0);

    const box = document.getElementById('dialogue-box');
    const titleEl = document.getElementById('dialogue-title');
    const textEl = document.getElementById('dialogue-text');
    const choicesEl = document.getElementById('dialogue-choices');

    titleEl.textContent = locationName;
    textEl.textContent = 'Loading...';
    choicesEl.innerHTML = '';
    box.style.display = 'block';
    hideDecisionTimerBar();

    try {
        const memories = getRelevantMemoryStrings();

        const response = await fetch('http://localhost:3000/api/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...statePayload(), memories, location: locationName })
        });

        if (!response.ok) throw new Error('bad response');

        const eventData = await response.json();
        currentEvent = eventData;
        currentPredictedIndex = predictChoice(eventData.choices);

        titleEl.textContent = eventData.title;
        textEl.textContent = eventData.text;

        eventData.choices.forEach((choice, i) => {
            const btn = document.createElement('button');
            btn.textContent = choice.label;
            btn.style.cssText = 'padding:10px 14px; border:none; border-left:3px solid #ff6b4a; border-radius:8px; background:#242032; color:#f2eefb; text-align:left; cursor:pointer;';
            btn.onclick = () => resolveChoice(choice, i, false);
            choicesEl.appendChild(btn);
        });

        startDecisionTimer(() => {
            if (!dialogueOpen || !currentEvent) return;
            resolveChoice(currentEvent.choices[currentPredictedIndex], currentPredictedIndex, true);
        });

    } catch (err) {
        console.warn('Event fetch failed:', err);
        currentEvent = null;
        textEl.textContent = 'Nothing much happening here right now.';
        const btn = document.createElement('button');
        btn.textContent = 'Move on';
        btn.style.cssText = 'padding:10px 14px; border:none; border-left:3px solid #ff6b4a; border-radius:8px; background:#242032; color:#f2eefb; text-align:left; cursor:pointer;';
        btn.onclick = () => resolveChoice(null, -1, false);
        choicesEl.appendChild(btn);
    }
}

/* ===================== DECISION TIMER ===================== */
// A shrinking bar under the choices. Run out of time and "autopilot"
// (predictChoice — see predictor.js) picks for you, with a small penalty.

function ensureDecisionTimerBar() {
    let track = document.getElementById('decision-timer-track');
    if (track) return track;

    track = document.createElement('div');
    track.id = 'decision-timer-track';
    track.style.cssText = 'width:100%; height:5px; background:#302a41; border-radius:3px; overflow:hidden; margin-top:14px;';

    const fill = document.createElement('div');
    fill.id = 'decision-timer-fill';
    fill.style.cssText = 'height:100%; width:100%; background:#ff6b4a; border-radius:3px;';
    track.appendChild(fill);

    document.getElementById('dialogue-box').appendChild(track);
    return track;
}

function startDecisionTimer(onTimeout) {
    clearTimeout(decisionTimeout);
    ensureDecisionTimerBar();

    const fill = document.getElementById('decision-timer-fill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    // Force reflow so the transition below actually animates from 100%.
    void fill.offsetWidth;
    fill.style.transition = `width ${DECISION_SECONDS}s linear`;
    fill.style.width = '0%';

    decisionTimeout = setTimeout(onTimeout, DECISION_SECONDS * 1000);
}

function hideDecisionTimerBar() {
    clearTimeout(decisionTimeout);
    const track = document.getElementById('decision-timer-track');
    if (track) track.remove();
}

/* ===================== TOAST (indecision penalty / wildcard bonus) ===================== */

function showToast(text, tone) {
    let toast = document.getElementById('game-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'game-toast';
        toast.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); padding:10px 18px; border-radius:10px; font-family:sans-serif; font-size:13px; font-weight:600; z-index:20; opacity:0; transition:opacity 0.3s ease; pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.background = tone === 'bad' ? '#4a1f1f' : '#1f4a2f';
    toast.style.color = tone === 'bad' ? '#ff9d9d' : '#9dffb0';
    toast.style.opacity = '1';

    clearTimeout(showToast._hide);
    showToast._hide = setTimeout(() => { toast.style.opacity = '0'; }, 2400);
}

function resolveChoice(choice, index, isAuto) {
    hideDecisionTimerBar();
    closeDialogue();

    if (!choice || !currentEvent) return;

    const deltas = applyEffects(choice.effects);

    // Auto-pick (you ran out of time): small indecision penalty, told to you plainly.
    if (isAuto) {
        const penaltyDeltas = applyEffects({ sanity: -5 });
        deltas.sanity = (deltas.sanity || 0) + (penaltyDeltas.sanity || 0);
        showToast(`Autopilot chose for you: "${choice.label}" (-5 sanity)`, 'bad');
        breakCombo();
        gameState.aiWins++;

    // Manual pick that defied the prediction — rewarded for not being predictable.
    } else if (index !== currentPredictedIndex) {
        const bonusDeltas = applyEffects({ sanity: 5 });
        deltas.sanity = (deltas.sanity || 0) + (bonusDeltas.sanity || 0);
        showToast('Wildcard! +5 sanity for going against the grain', 'good');
        gameState.humanWins++;
    }

    recordMemory(currentEvent, choice);
    showDeltas(deltas);

    const netChange = (deltas.health || 0) + (deltas.sanity || 0) + (deltas.energy || 0) + (deltas.academics || 0);
    spawnStatBurst(game.scene.scenes[0], player.x, player.y - 30, netChange);

    if (!isAuto) {
        if (netChange > 0) addScore(game.scene.scenes[0], netChange * 8, player.x, player.y - 60);
        else if (netChange < 0) breakCombo();
    }

    currentEvent = null;
    currentPredictedIndex = null;

    const ending = checkGameOver();
    if (ending) {
        showEnding(ending);
        return;
    }

    advanceDay();
    updateHUD();
    updateDayTint();

    const streakBonus = updateStreak();
    if (streakBonus) {
        showToast(`🔥 ${streakBonus.streak}-day streak! +Rs.${streakBonus.reward}`, 'good');
        addScore(game.scene.scenes[0], 50, player.x, player.y - 80);
        updateHUD();
    }

    // If this choice logically involves going somewhere (e.g. "run to the library"),
    // the server can tag it with travelTo: "Library" and the character walks there.
    if (choice.travelTo) {
        const doorPos = findBuildingDoor(choice.travelTo);
        if (doorPos) walkPlayerTo(game.scene.scenes[0], doorPos.x, doorPos.y);
    }
}

function closeDialogue() {
    document.getElementById('dialogue-box').style.display = 'none';
    dialogueOpen = false;
    // currentDoorName is deliberately NOT cleared here — see update(),
    // it only clears once the player physically steps off the door tile.
    // Otherwise standing on the tile after closing re-triggers the same
    // dialogue instantly.
}

/** Screen shake on a big stat hit (≤-15). Shakes #game-container — game-v2's
    actual root element (the old V1 prototype used a .game class that doesn't
    exist here, which is why this was silently missing before). */
function maybeShake(effects) {
    const bigHit = ['health', 'sanity'].some(key => effects[key] && effects[key] <= -15);
    if (!bigHit) return;

    const container = document.getElementById('game-container');
    container.classList.add('impact-shake');
    setTimeout(() => container.classList.remove('impact-shake'), 400);
}

function showEnding(ending) {
    const box = document.getElementById('dialogue-box');
    const titleEl = document.getElementById('dialogue-title');
    const textEl = document.getElementById('dialogue-text');
    const choicesEl = document.getElementById('dialogue-choices');

    const isNewHighScore = saveHighScoreIfBeaten();

    titleEl.textContent = ending.title;
    textEl.textContent = `${ending.text}\n\nFinal score: ${gameState.score}${isNewHighScore ? ' — 🏆 NEW HIGH SCORE!' : ` (best: ${loadHighScore()})`}`;
    choicesEl.innerHTML = '';

    const btn = document.createElement('button');
    btn.textContent = 'Play again';
    btn.style.cssText = 'padding:10px 14px; border:none; border-radius:8px; background:#ff6b4a; color:#1a1220; font-weight:600; cursor:pointer;';
    btn.onclick = () => location.reload();
    choicesEl.appendChild(btn);

    box.style.display = 'block';
    dialogueOpen = true;
}