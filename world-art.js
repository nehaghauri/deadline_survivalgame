/* ============================================================
   world-art.js — makes the world look like a place, not boxes.
   No image assets needed — everything here is drawn with shapes.
   Load after state.js, before main.js.
   ============================================================ */

/**
 * Draws one building as a small composition of shapes instead of
 * one flat rectangle: base walls, a roof band, a door, two windows.
 * Returns the wall rectangle — that's the one you collide with.
 */
function drawBuilding(scene, b) {
    const roofHeight = 26;

    // Roof — a darker band across the top of the building.
    scene.add.rectangle(b.x, b.y - b.h / 2 - roofHeight / 2 + 4, b.w + 16, roofHeight, shade(b.color, -40));

    // Walls — the actual building body (this is what the player collides with).
    const wall = scene.add.rectangle(b.x, b.y, b.w, b.h, b.color);
    scene.physics.add.existing(wall, true);

    // Windows — two small squares near the top of the wall.
    const winY = b.y - b.h / 2 + 34;
    scene.add.rectangle(b.x - b.w / 4, winY, 22, 22, 0xfff4d6, 0.85);
    scene.add.rectangle(b.x + b.w / 4, winY, 22, 22, 0xfff4d6, 0.85);

    // Door — brown rectangle at the bottom center.
    scene.add.rectangle(b.x, b.y + b.h / 2 - 24, 34, 48, 0x4a3324);

    // Name label floating above the roof.
    scene.add.text(b.x, b.y - b.h / 2 - roofHeight - 14, b.name, {
        fontFamily: 'sans-serif', fontSize: '14px', color: '#f2eefb', fontStyle: 'bold'
    }).setOrigin(0.5);

    return wall;
}

/** Darkens or lightens a hex color by a percent (-100 to 100). */
function shade(hex, percent) {
    const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
    const adjust = c => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)));
    return (adjust(r) << 16) | (adjust(g) << 8) | adjust(b);
}

/** Ground: a base grass color plus a lighter dirt path connecting the buildings. */
function drawGround(scene, worldWidth, worldHeight, buildings) {
    scene.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, 0x263a2e);

    // Faint scattered dots for grass texture — cheap, but reads as "not empty."
    for (let i = 0; i < 140; i++) {
        const x = Phaser.Math.Between(0, worldWidth);
        const y = Phaser.Math.Between(0, worldHeight);
        scene.add.circle(x, y, 2, 0x2f4a3a, 0.6);
    }

    // Dirt path: a plus-shape through the middle of the world, connecting the four corners.
    const midX = worldWidth / 2, midY = worldHeight / 2;
    scene.add.rectangle(midX, midY, worldWidth * 0.9, 60, 0x8a7355, 0.9);
    scene.add.rectangle(midX, midY, 60, worldHeight * 0.9, 0x8a7355, 0.9);
}