require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/event', async (req, res) => {
    const { health, sanity, energy, academics, money, day, memories } = req.body;

    const memoryBlock = (memories && memories.length)
    ? `\n\nRelevant past moments for this player (weave in ONE as a natural callback if it fits — don't force it):\n${memories.join('\n')}`
    : '';

    const prompt = `You are generating a random event for a university survival game called Deadline.

Current player state: Day ${day}, Health ${health}, Sanity ${sanity}, Energy ${energy}, Academics ${academics}, Money Rs.${money}.${memoryBlock}

Generate ONE short chaotic university event that fits their current state. Keep it darkly funny, casual, lowercase tone like a Gen Z student texting. Then generate 3 distinct choices the player can make, each with a short outcome line and stat effects that make sense for that choice (e.g. studying raises academics but lowers energy; going out lowers money but raises sanity).

Stat effect ranges: health/sanity/energy/academics should be roughly -20 to +20. money should be roughly -800 to +800. Write positive numbers as plain numbers with no plus sign (10, not +10).

Respond ONLY with valid JSON, no markdown, in this exact shape:
{
  "title": "short event title, sentence case",
  "text": "1-2 sentence flavor text, lowercase casual tone",
  "choices": [
    { "label": "short choice text, a few words", "outcome": "1 sentence lowercase outcome text", "effects": { "health": 0, "sanity": 0, "energy": 0, "academics": 0, "money": 0 } },
    { "label": "...", "outcome": "...", "effects": { "health": 0, "sanity": 0, "energy": 0, "academics": 0, "money": 0 } },
    { "label": "...", "outcome": "...", "effects": { "health": 0, "sanity": 0, "energy": 0, "academics": 0, "money": 0 } }
  ]
}`;
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-20b',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9,
                reasoning_effort: 'low'
            })
        });

        const data = await response.json();

        if (data.error) throw new Error(`Groq error: ${data.error.message}`);

        const raw = data.choices[0].message.content;
        const cleaned = raw
            .replace(/```json|```/g, '')
            .replace(/:\s*\+(\d)/g, ': $1')
            .trim();
        const event = JSON.parse(cleaned);
        res.json(event);

    } catch (err) {
        console.error('LLM event generation failed:', err);
        res.status(500).json({ error: 'generation failed' });
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));