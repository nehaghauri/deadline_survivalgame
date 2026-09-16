/* ============================================================
   state.js — the single source of truth for the game.
   Load this BEFORE main.js in index.html.

   Everything that wants to know "how much sanity does the player
   have?" asks gameState. Nothing else keeps its own copy.
   ============================================================ */

const gameState = {
    health: 80,
    sanity: 65,
    energy: 70,
    academics: 40,
    money: 500,
    day: 1,
    memories: []   // filled in later by the RAG step
};

/* Stats can never go below 0 or above 100. Money is separate —
   it has no 100 ceiling, it just can't go negative. */
function clampStat(value) {
    return Math.max(0, Math.min(100, value));
}

/**
 * Apply one choice's effects to the game state.
 * @param {object} effects e.g. { health: 0, sanity: -10, energy: -15, academics: 15, money: 0 }
 * @returns {object} the changes that actually landed, for the HUD to animate
 */
function applyEffects(effects) {
    if (!effects) return {};

    const before = { ...gameState };

    gameState.health    = clampStat(gameState.health    + (effects.health    || 0));
    gameState.sanity    = clampStat(gameState.sanity    + (effects.sanity    || 0));
    gameState.energy    = clampStat(gameState.energy    + (effects.energy    || 0));
    gameState.academics = clampStat(gameState.academics + (effects.academics || 0));
    gameState.money     = Math.max(0, gameState.money   + (effects.money     || 0));

    // The real delta after clamping. If sanity was 5 and the effect was -10,
    // the *actual* change is -5, not -10. The HUD should show the truth.
    const deltas = {};
    ['health', 'sanity', 'energy', 'academics', 'money'].forEach(key => {
        deltas[key] = gameState[key] - before[key];
    });

    return deltas;
}

/** Record what just happened so the RAG system has something to retrieve later. */
function recordMemory(event, choice) {
    gameState.memories.push({
        day: gameState.day,
        title: event.title,
        text: event.text,
        choiceLabel: choice.label,
        outcome: choice.outcome
    });
}

function advanceDay() {
    gameState.day += 1;
}

/** Returns an ending object if the run is over, otherwise null. */
function checkGameOver() {
    if (gameState.health <= 0)    return { title: 'Health Failure',    text: 'You pushed too hard, for too long. Your body finally said no.' };
    if (gameState.sanity <= 0)    return { title: 'Burnout',           text: "You couldn't take it anymore. Time to log off — permanently, this semester." };
    if (gameState.academics <= 0) return { title: 'Academic Disaster', text: 'It\'s over. There is no coming back from this GPA.' };
    return null;
}

/** The exact payload the Express server expects. */
function statePayload() {
    return {
        health:    gameState.health,
        sanity:    gameState.sanity,
        energy:    gameState.energy,
        academics: gameState.academics,
        money:     gameState.money,
        day:       gameState.day,
        memories:  gameState.memories
    };
}