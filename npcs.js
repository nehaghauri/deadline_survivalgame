/* ============================================================
   npcs.js — characters that move on their own.
   Simple wander AI: each NPC picks a random nearby point, walks
   there, pauses, picks another. No pathfinding — good enough for
   an open campus, not for navigating around buildings precisely.
   Load after state.js, before main.js.
   ============================================================ */

const NPC_DEFS = [
    { name: 'Neha',  textureKey: 'neha-sprite',  x: 500,  y: 500  },
    { name: 'Filza', textureKey: 'filza-sprite', x: 1000, y: 700  },
    { name: 'Fati',  textureKey: 'fati-sprite',  x: 700,  y: 900  }
];

const NPC_LINES = {
    Neha:  ["ugh, don't even ask about my grade.", "have you slept this week? be honest.", "the cafeteria pizza is a war crime today."],
    Filza: ["bro i pulled an all-nighter, don't judge me.", "you seen the quiz results? brutal.", "wanna split a study session later?"],
    Fati:  ["i'm running purely on caffeine at this point.", "day like this and i'm already tired.", "tell me you're not skipping class too."]
};

const GREET_COOLDOWN = 8000;
const GREET_DISTANCE = 46;

function createNPCs(scene) {
    npcs = NPC_DEFS.map(def => {
        const sprite = scene.physics.add.sprite(def.x, def.y, def.textureKey, 0);
        sprite.body.setSize(20, 24);
        sprite.body.setOffset(22, 36);
        sprite.body.setCollideWorldBounds(true);

        const label = scene.add.text(def.x, def.y - 36, def.name, {
            fontFamily: 'sans-serif', fontSize: '11px', color: '#f2eefb'
        }).setOrigin(0.5);

        return {
            name: def.name,
            textureKey: def.textureKey,
            sprite,
            label,
            direction: 'down',
            state: 'idle',        // 'idle' | 'walking'
            target: null,
            waitUntil: scene.time.now + Phaser.Math.Between(500, 2000),
            lastGreet: 0
        };
    });
}

/** Call this every frame from update(). */
function updateNPCs(scene, worldWidth, worldHeight) {
    const speed = 60;

    npcs.forEach(npc => {
        npc.sprite.setDepth(npc.sprite.y);   // same depth-sort trick as the player/buildings
        npc.label.setPosition(npc.sprite.x, npc.sprite.y - 36);

        if (npc.state === 'idle') {
            npc.sprite.anims.play(`${npc.textureKey}-idle-${npc.direction}`, true);

            if (scene.time.now >= npc.waitUntil) {
                npc.target = {
                    x: Phaser.Math.Clamp(npc.sprite.x + Phaser.Math.Between(-250, 250), 40, worldWidth - 40),
                    y: Phaser.Math.Clamp(npc.sprite.y + Phaser.Math.Between(-250, 250), 40, worldHeight - 40)
                };
                npc.state = 'walking';
            }
        } else {
            const dx = npc.target.x - npc.sprite.x;
            const dy = npc.target.y - npc.sprite.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 8) {
                npc.sprite.body.setVelocity(0, 0);
                npc.state = 'idle';
                npc.waitUntil = scene.time.now + Phaser.Math.Between(1500, 4000);
            } else {
                npc.sprite.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
                npc.direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
                npc.sprite.anims.play(`${npc.textureKey}-walk-${npc.direction}`, true);
            }
        }
    });

    checkNPCInteractions(scene);
}

const NPC_PORTRAIT_PATHS = {
    Neha: 'assets/portraits/neha.png',
    Filza: 'assets/portraits/filza.png',
    Fati: 'assets/portraits/fati.png'
};

/** Proximity-based "hello" — walk near an NPC, a portrait + line pop up in the corner, on cooldown. */
function checkNPCInteractions(scene) {
    npcs.forEach(npc => {
        const dist = Phaser.Math.Distance.Between(player.x, player.y, npc.sprite.x, npc.sprite.y);

        if (dist < GREET_DISTANCE && scene.time.now - npc.lastGreet > GREET_COOLDOWN) {
            npc.lastGreet = scene.time.now;
            const lines = NPC_LINES[npc.name] || ["hey."];
            const line = lines[Phaser.Math.Between(0, lines.length - 1)];
            showNPCGreeting(npc.name, line);
        }
    });
}

function showNPCGreeting(name, line) {
    const box = document.getElementById('npc-greeting');
    if (!box) return;

    document.getElementById('npc-greeting-portrait').src = NPC_PORTRAIT_PATHS[name] || '';
    document.getElementById('npc-greeting-name').textContent = name;
    document.getElementById('npc-greeting-text').textContent = line;
    box.style.display = 'flex';
    box.style.opacity = '1';

    clearTimeout(showNPCGreeting._hideTimer);
    showNPCGreeting._hideTimer = setTimeout(() => {
        box.style.opacity = '0';
        setTimeout(() => { box.style.display = 'none'; }, 300);
    }, 2800);
}