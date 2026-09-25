/* ============================================================
   world-art.js — real tile-based world, using extracted sprites
   from your downloaded RPG Maker MV tileset instead of shapes.
   Load after state.js, before main.js.
   ============================================================ */

/**
 * Draws one building using a real house sprite instead of shapes.
 * The building's collision box is sized to roughly the base/walls
 * of the sprite, not its full bounding box (roofs overhang visually
 * but shouldn't block the player from walking near them).
 */
function drawBuilding(scene, b) {
    const sprite = scene.add.image(b.x, b.y, b.textureKey);
    sprite.setDepth(b.y);   // taller buildings lower on screen draw in front — cheap depth sort

    // Collision body: a rectangle narrower than the sprite, covering
    // roughly the walls/base, not the roof overhang.
    const collideW = sprite.width * 0.7;
    const collideH = sprite.height * 0.45;
    const collideY = b.y + sprite.height * 0.15;   // shifted down toward the base

    const wall = scene.add.rectangle(b.x, collideY, collideW, collideH, 0x000000, 0);
    scene.physics.add.existing(wall, true);

    // Name label above the roof.
    scene.add.text(b.x, b.y - sprite.height / 2 - 12, b.name, {
        fontFamily: 'sans-serif', fontSize: '14px', color: '#f2eefb', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(9999);

    return wall;
}

/** Ground: tiled grass + path, plus flower beds, signposts, rocks, and trees placed like an actual campus. */
function drawGround(scene, worldWidth, worldHeight, buildings) {
    scene.add.tileSprite(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 'grass-tile');

    const midX = worldWidth / 2, midY = worldHeight / 2;
    scene.add.tileSprite(midX, midY, worldWidth * 0.9, 60, 'path-tile');
    scene.add.tileSprite(midX, midY, 60, worldHeight * 0.9, 'path-tile');

    // Flower beds framing each building's entrance — two per building, either side of the door.
    buildings.forEach(b => {
        const doorY = b.y + b.h / 2 + 10;
        const flowerKey = Phaser.Math.Between(0, 1) === 0 ? 'flower-pink' : 'flower-blue';
        placeProp(scene, flowerKey, b.x - 46, doorY);
        placeProp(scene, flowerKey, b.x + 46, doorY);
    });

    // Signposts near the crossroads — the natural spot for campus signage.
    placeProp(scene, 'signpost', midX - 90, midY - 90);
    placeProp(scene, 'signpost', midX + 90, midY + 90);

    // Rocks as sparse garden accents, kept away from paths/buildings.
    for (let i = 0; i < 10; i++) {
        const x = Phaser.Math.Between(60, worldWidth - 60);
        const y = Phaser.Math.Between(60, worldHeight - 60);
        if (tooClose(x, y, midX, midY, buildings)) continue;
        placeProp(scene, Phaser.Math.Between(0, 1) === 0 ? 'rock-small' : 'rock-cluster', x, y);
    }

    // Trees/bushes, same scatter as before.
    for (let i = 0; i < 34; i++) {
        const x = Phaser.Math.Between(60, worldWidth - 60);
        const y = Phaser.Math.Between(60, worldHeight - 60);
        if (tooClose(x, y, midX, midY, buildings)) continue;

        const key = Phaser.Math.Between(0, 2) === 0 ? 'bush-prop' : 'tree-prop';
        placeProp(scene, key, x, y);
    }
}

function tooClose(x, y, midX, midY, buildings) {
    const nearPath = Math.abs(x - midX) < 80 || Math.abs(y - midY) < 80;
    const nearBuilding = buildings.some(b => Math.abs(x - b.x) < b.w && Math.abs(y - b.y) < b.h);
    return nearPath || nearBuilding;
}

function placeProp(scene, key, x, y) {
    const prop = scene.add.image(x, y, key);
    prop.setDepth(y - 1);   // same depth-sort trick as buildings/player
}