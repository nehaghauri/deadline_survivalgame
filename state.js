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
    streak: 0,     // consecutive days ending with every stat at 30+
    score: 0,
    combo: 0,      // consecutive good outcomes in a row — drives the score multiplier
    aiWins: 0,     // times autopilot chose for you (you ran out of time)
    humanWins: 0,  // times you deliberately picked against the prediction
    memories: []   // filled in later by the RAG step
};

// Power-up timers — plain globals so both arcade.js and main.js can read/set them
// without needing to pass state through function calls everywhere.
let speedBoostUntil = 0;
let chaserImmuneUntil = 0;

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

/** Call once per day. Returns a bonus object if a streak milestone was just hit, else null. */
function updateStreak() {
    const stable = gameState.health >= 30 && gameState.sanity >= 30 &&
                   gameState.energy >= 30 && gameState.academics >= 30;

    gameState.streak = stable ? gameState.streak + 1 : 0;

    const MILESTONES = { 3: 200, 5: 400, 7: 700 };
    if (MILESTONES[gameState.streak]) {
        const reward = MILESTONES[gameState.streak];
        gameState.money += reward;
        return { streak: gameState.streak, reward };
    }
    return null;
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
        memories:  gameState.memories,
        performance: performanceSnapshot()
    };
}

/** A short read on how the player is currently doing — sent to the LLM so
    event difficulty/tone can adapt (see server.js's performance instructions). */
function performanceSnapshot() {
    if (gameState.combo >= 4) return 'on a hot streak, doing very well';
    if (gameState.combo >= 2) return 'doing solidly, a couple good calls in a row';
    if (gameState.streak === 0 && gameState.score > 0) return 'struggling, recently slipped up';
    return 'steady, nothing dramatic either way';
}

/* ===================== HIGH SCORE (persists across runs) ===================== */

function loadHighScore() {
    try { return parseInt(localStorage.getItem('deadline-highscore') || '0', 10); }
    catch (e) { return 0; }
}

/** Returns true if this run just beat the saved high score. */
function saveHighScoreIfBeaten() {
    const current = loadHighScore();
    if (gameState.score > current) {
        try { localStorage.setItem('deadline-highscore', String(gameState.score)); } catch (e) {}
        return true;
    }
    return false;
}