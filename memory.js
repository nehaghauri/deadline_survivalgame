/* ============================================================
   memory.js — the RAG piece: TF-IDF + cosine similarity retrieval.
   Ported from the old campus-map script.js. Load this AFTER
   state.js (it reads gameState.memories) and BEFORE main.js
   (main.js calls retrieveRelevantMemories before fetching an event).
   ============================================================ */

const STOPWORDS = new Set(["the","a","an","you","your","to","and","of","in","on","is","it","was","for","at","with","this","that","but"]);

function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w && !STOPWORDS.has(w));
}

/**
 * Score every past memory against a query using TF-IDF + cosine similarity,
 * return the top matches. Word-overlap based — no embeddings, per the
 * original design (fast, no API calls needed for retrieval itself).
 */
function retrieveRelevantMemories(query, topK = 2) {
    const history = gameState.memories;
    if (!history.length) return [];

    const docs = history.map(e => tokenize(`${e.title} ${e.choiceLabel} ${e.outcome}`));
    const queryTokens = tokenize(query);
    const allDocs = [...docs, queryTokens];

    const df = {};
    allDocs.forEach(doc => {
        new Set(doc).forEach(term => { df[term] = (df[term] || 0) + 1; });
    });

    function vectorize(doc) {
        const tf = {};
        doc.forEach(term => { tf[term] = (tf[term] || 0) + 1; });
        const vec = {};
        Object.keys(tf).forEach(term => {
            const idf = Math.log((allDocs.length + 1) / ((df[term] || 0) + 1)) + 1;
            vec[term] = tf[term] * idf;
        });
        return vec;
    }

    function cosineSim(a, b) {
        let dot = 0, magA = 0, magB = 0;
        const terms = new Set([...Object.keys(a), ...Object.keys(b)]);
        terms.forEach(t => {
            const va = a[t] || 0, vb = b[t] || 0;
            dot += va * vb; magA += va * va; magB += vb * vb;
        });
        if (magA === 0 || magB === 0) return 0;
        return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    }

    const queryVec = vectorize(queryTokens);
    const scored = docs.map((doc, i) => ({ score: cosineSim(queryVec, vectorize(doc)), entry: history[i] }));

    return scored
        .filter(s => s.score > 0.05)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(s => s.entry);
}

/** Builds the current query and returns ready-to-send memory strings for the prompt. */
function getRelevantMemoryStrings() {
    const stats = { health: gameState.health, sanity: gameState.sanity, energy: gameState.energy, academics: gameState.academics };
    const worstStat = Object.keys(stats).reduce((a, b) => (stats[a] < stats[b] ? a : b));
    const query = `day ${gameState.day} ${worstStat} struggling university stress`;

    return retrieveRelevantMemories(query).map(m =>
        `Day ${m.day}: ${m.title} — you chose "${m.choiceLabel}" (${m.outcome})`
    );
}