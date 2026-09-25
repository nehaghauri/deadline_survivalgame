/* ============================================================
   predictor.js — "what will you probably pick?"

   Right now this is a heuristic (find the choice that helps your
   worst stat the most). This is deliberately the ONE function you
   swap out once you train a real classifier on logged gameplay data
   (day, stats, choice) — same input/output shape, just smarter math.
   Load after state.js, before main.js.
   ============================================================ */

/**
 * @param {object[]} choices the event's choices array
 * @returns {number} index of the predicted choice
 */
function predictChoice(choices) {
    const stats = { health: gameState.health, sanity: gameState.sanity, energy: gameState.energy, academics: gameState.academics };
    const worstStat = Object.keys(stats).reduce((a, b) => (stats[a] < stats[b] ? a : b));

    let bestIndex = 0;
    let bestScore = -Infinity;

    choices.forEach((choice, i) => {
        const score = (choice.effects && choice.effects[worstStat]) || 0;
        if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
        }
    });

    return bestIndex;
}