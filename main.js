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

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 1200;

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',   // <-- must match the div id in index.html EXACTLY
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

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
    // TODO: confirm this filename matches what's in your project folder.
    this.load.spritesheet('player', 'player-walk.png', {
        frameWidth: 64,
        frameHeight: 64
    });
}

/* ===================== CREATE ===================== */

function create() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Ground: grass texture + dirt paths instead of a flat rectangle.
    drawGround(this, WORLD_WIDTH, WORLD_HEIGHT, BUILDINGS);

    createPlayer(this);
    createAnimations(this);
    createBuildings(this);
    createNPCs(this);

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

function createAnimations(scene) {
    // TODO: adjust the frame ranges below once you know exactly how the
    // 13 frames per row are laid out (e.g. frame 0 = idle, 1-8 = walk cycle).
    // This assumes frames 0-7 of each row are a walk cycle.
    Object.entries(ROWS).forEach(([direction, row]) => {
        const start = row * FRAMES_PER_ROW;
        scene.anims.create({
            key: `walk-${direction}`,
            frames: scene.anims.generateFrameNumbers('player', { start: start, end: start + 7 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: `idle-${direction}`,
            frames: [{ key: 'player', frame: start }],
            frameRate: 1
        });
    });
}

/* ===================== BUILDINGS & DOORS ===================== */
// Colored rectangles for now — intentional, per the design doc.
// { x, y } is the CENTER of the building.

const BUILDINGS = [
    { name: 'Dorm Room', x: 200,  y: 200,  w: 220, h: 160, color: 0x7fd8cf },
    { name: 'Classroom', x: 1400, y: 200,  w: 220, h: 160, color: 0xff6b4a },
    { name: 'Cafeteria', x: 200,  y: 1000, w: 220, h: 160, color: 0xfacc15 },
    { name: 'Library',   x: 1400, y: 1000, w: 220, h: 160, color: 0x9d8df1 }
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
}

/* ===================== UPDATE (runs every frame) ===================== */

function update() {
    if (dialogueOpen) return;   // freeze movement while a dialogue is open

    updateNPCs(game.scene.scenes[0], WORLD_WIDTH, WORLD_HEIGHT);

    const speed = 160;
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
let currentEvent = null;   // needed so recordMemory() can see the event title

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

        titleEl.textContent = eventData.title;
        textEl.textContent = eventData.text;

        eventData.choices.forEach(choice => {
            const btn = document.createElement('button');
            btn.textContent = choice.label;
            btn.style.cssText = 'padding:10px 14px; border:none; border-left:3px solid #ff6b4a; border-radius:8px; background:#242032; color:#f2eefb; text-align:left; cursor:pointer;';
            btn.onclick = () => resolveChoice(choice);
            choicesEl.appendChild(btn);
        });

    } catch (err) {
        console.warn('Event fetch failed:', err);
        currentEvent = null;
        textEl.textContent = 'Nothing much happening here right now.';
        const btn = document.createElement('button');
        btn.textContent = 'Move on';
        btn.style.cssText = 'padding:10px 14px; border:none; border-left:3px solid #ff6b4a; border-radius:8px; background:#242032; color:#f2eefb; text-align:left; cursor:pointer;';
        btn.onclick = () => resolveChoice(null);
        choicesEl.appendChild(btn);
    }
}

function resolveChoice(choice) {
    closeDialogue();

    if (!choice || !currentEvent) return;

    const deltas = applyEffects(choice.effects);
    recordMemory(currentEvent, choice);
    showDeltas(deltas);

    const netChange = (deltas.health || 0) + (deltas.sanity || 0) + (deltas.energy || 0) + (deltas.academics || 0);
    spawnStatBurst(game.scene.scenes[0], player.x, player.y - 30, netChange);

    currentEvent = null;

    const ending = checkGameOver();
    if (ending) {
        showEnding(ending);
        return;
    }

    advanceDay();
    updateHUD();
    updateDayTint();
}

function closeDialogue() {
    document.getElementById('dialogue-box').style.display = 'none';
    dialogueOpen = false;
    // currentDoorName is deliberately NOT cleared here — see update(),
    // it only clears once the player physically steps off the door tile.
    // Otherwise standing on the tile after closing re-triggers the same
    // dialogue instantly.
}

function showEnding(ending) {
    const box = document.getElementById('dialogue-box');
    const titleEl = document.getElementById('dialogue-title');
    const textEl = document.getElementById('dialogue-text');
    const choicesEl = document.getElementById('dialogue-choices');

    titleEl.textContent = ending.title;
    textEl.textContent = ending.text;
    choicesEl.innerHTML = '';

    const btn = document.createElement('button');
    btn.textContent = 'Play again';
    btn.style.cssText = 'padding:10px 14px; border:none; border-radius:8px; background:#ff6b4a; color:#1a1220; font-weight:600; cursor:pointer;';
    btn.onclick = () => location.reload();
    choicesEl.appendChild(btn);

    box.style.display = 'block';
    dialogueOpen = true;
}