/* ============================================================
   npcs.js — characters that move on their own.
   Simple wander AI: each NPC picks a random nearby point, walks
   there, pauses, picks another. No pathfinding — good enough for
   an open campus, not for navigating around buildings precisely.
   Load after state.js, before main.js.
   ============================================================ */

const NPC_DEFS = [
    { name: 'Fatima',  color: 0xff9d9d, x: 500,  y: 500  },
    { name: 'Neha',  color: 0x9dc4ff, x: 1000, y: 700  },
    { name: 'Filza', color: 0xc9ff9d, x: 700,  y: 900  }
];

const NPC_LINES = {
    Fatima:  ["ugh, don't even ask about my grade.", "have you slept this week? be honest.", "the cafeteria pizza is a war crime today."],
    Neha:  ["bro i pulled an all-nighter, don't judge me.", "you seen the quiz results? brutal.", "wanna split a study session later?"],
    Filza: ["i'm running purely on caffeine at this point.", "day like this and i'm already tired.", "tell me you're not skipping class too."]
};

const GREET_COOLDOWN = 8000;
const GREET_DISTANCE = 46;

function createNPCs(scene) {
    npcs = NPC_DEFS.map(def => {
        const body = scene.add.circle(def.x, def.y, 14, def.color);
        scene.physics.add.existing(body);
        body.body.setCollideWorldBounds(true);

        const label = scene.add.text(def.x, def.y - 26, def.name, {
            fontFamily: 'sans-serif', fontSize: '11px', color: '#f2eefb'
        }).setOrigin(0.5);

        const bubble = scene.add.text(def.x, def.y - 44, '', {
            fontFamily: 'sans-serif', fontSize: '11px', color: '#1a1220',
            backgroundColor: '#f2eefb', padding: { x: 6, y: 4 }
        }).setOrigin(0.5).setVisible(false);

        return {
            name: def.name,
            sprite: body,
            label,
            bubble,
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
        npc.label.setPosition(npc.sprite.x, npc.sprite.y - 26);
        npc.bubble.setPosition(npc.sprite.x, npc.sprite.y - 46);

        if (npc.state === 'idle') {
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
            }
        }
    });

    checkNPCInteractions(scene);
}

/** Proximity-based "hello" — walk near an NPC, they say a random line, on cooldown. */
function checkNPCInteractions(scene) {
    npcs.forEach(npc => {
        const dist = Phaser.Math.Distance.Between(player.x, player.y, npc.sprite.x, npc.sprite.y);

        if (dist < GREET_DISTANCE && scene.time.now - npc.lastGreet > GREET_COOLDOWN) {
            npc.lastGreet = scene.time.now;
            const lines = NPC_LINES[npc.name] || ["hey."];
            npc.bubble.setText(lines[Phaser.Math.Between(0, lines.length - 1)]);
            npc.bubble.setVisible(true);

            scene.time.delayedCall(2500, () => npc.bubble.setVisible(false));
        }
    });
}