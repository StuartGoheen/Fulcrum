const express = require('express');
const router  = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

function buildPrompt(payload) {
  const {
    species, phase1, phase2, phase3, kits, disciplines, arenas, destiny,
    gender, generateName, characterName, generateTitle, characterTitle, playerInput,
  } = payload;

  const pronouns = gender === 'Female'
    ? { sub: 'she', obj: 'her', pos: 'her', ref: 'herself' }
    : { sub: 'he',  obj: 'him', pos: 'his', ref: 'himself' };

  const destinyTone = {
    'Two Light':   'This character still believes the galaxy can be better. Write with quiet idealism — a code they live by, a line they will not cross, a hope that has not yet been extinguished.',
    'Light & Dark':'This character operates in moral grey. Write with pragmatic ambiguity — they do what must be done, but it costs them. There is no clean conscience here.',
    'Two Dark':    'This character has made their peace with what survival requires. Write with cold self-interest or simmering revenge — the galaxy is not fair, and they stopped expecting it to be.',
  }[destiny] || '';

  const kitsText = kits && kits.length ? kits.join(', ') : 'none selected';
  const discText = disciplines && disciplines.length ? disciplines.join(', ') : 'none at formative level';
  const arenaText = arenas && arenas.length ? arenas.join(', ') : 'all baseline';
  const locationPool = phase1.locationHints && phase1.locationHints.length
    ? phase1.locationHints.join(', ')
    : '';

  const p2Archetype = phase2.archetype || '';
  const p2Proficiencies = phase2.proficiencies || '';
  const p2Variability = phase2.variability || '';
  const p3Archetype = phase3.archetype || '';
  const p3KnackName = phase3.knackName || '';
  const p3KnackType = phase3.knackType || '';

  const nameInstruction = generateName
    ? 'Generate a culturally appropriate name for this species. Return it as a JSON field "name".'
    : `The character\'s name is ${characterName}.`;

  const titleInstruction = generateTitle
    ? 'Generate a one-to-three word title or epithet that fits this character (examples: Drifter, Fallen Jedi, Imperial Defector, The Exile, Bloodhound). Return it as a JSON field "title".'
    : characterTitle
      ? `The character\'s title is: ${characterTitle}`
      : 'No title provided; do not invent one unless asked.';

  const playerNote = playerInput && playerInput.trim()
    ? `\n\nPLAYER DIRECTION (HIGHEST PRIORITY — these override default caution rules):\nThe player has provided the following specific direction. Treat every detail as canonical for this character. If the player names a faction, group, species subculture, or organization (e.g., "Nightsister," "Death Watch," "Pyke Syndicate"), use that name explicitly in the prose — do not genericize it. If the player specifies a tone (e.g., "sinister," "hopeful"), shift the prose style to match. If the player describes motivations or backstory beats, weave them in as central narrative elements, not footnotes.\n\n${playerInput.trim()}`
    : '';

  const locationInstruction = locationPool
    ? `\nLOCATION POOL: When referencing the character's origin world or region, pick from this curated list: ${locationPool}. Do NOT invent locations outside this list for the origin. You may reference Jakku or the Western Reaches as a current location.`
    : '';

  return `You are a narrative writer for a Star Wars tabletop RPG campaign. Your job is to write a personal backstory for a player character based on the data provided. Follow every rule below exactly.

SETTING BIBLE — DO NOT DEVIATE:
- Year: 16 BBY. The Empire is 3 years old. Order 66 happened 3 years ago. The Jedi Order is destroyed; surviving Jedi are hunted.
- Location: Western Reaches — fringe space beyond reliable Imperial patrol. Syndicate-controlled trade routes. Salvage economy. Lawless and overlooked.
- Jakku in this era: a dry, unremarkable desert refuelling stop and smuggler's haven. It is NOT a battlefield. The Battle of Jakku happens 21 years in the future. Do NOT reference wreckage, crashed Star Destroyers, or any post-battle history.
- Tone: desperate, morally grey, fringe survival. There is no organised Rebellion yet. No infrastructure of hope. People are surviving the boot heel, not fighting back.

OUTPUT RULES:
- Return ONLY valid JSON in this exact shape: { "backstory": "...", "name": "...", "title": "..." }
- Include "name" only if asked to generate one. Include "title" only if asked to generate one.
- The backstory value must be plain paragraphs of prose. NO markdown. NO asterisks. NO bold. NO headers. NO bullet points. NO formatting symbols of any kind.
- STRICT THIRD-PERSON PAST TENSE: Write only in third-person narration — never first-person ("I") or second-person ("you"). Every verb in the backstory MUST be past tense. No present-tense narration, no present-tense descriptions, no "he is" or "she carries" — always "he was", "she carried". This is non-negotiable.
- Write exactly 4 paragraphs. Each paragraph is 3–5 sentences.
- Be specific to this character's choices. Do not write generic Star Wars prose.
- Do not name specific weapons, armour, or equipment. Use vague evocative references only ("a blade she had carried since Corellia", "the ship he won in a sabacc game"). No model numbers. No kit names.
- If a location, faction, or named person is not provided in the character data or player direction below, do not invent one — keep references abstract. However, if the player names specific factions or groups in their direction, use those names freely.
${locationInstruction}

ARENA & DISCIPLINE GUIDANCE:
- Dominant arenas (D8+) represent this character's defining physical or mental traits. A character with Physique D8+ was physically imposing or battle-hardened. Wits D8+ was sharp and calculating. Presence D8+ was magnetically persuasive or intimidating. Weave these dominant traits into the prose as evident qualities that shaped their history.
- Formative disciplines (D8+) are skills the character honed beyond casual familiarity. If they have Stealth D8, they learned to move unseen. If they have Medicine D10, they were a seasoned healer. Reference these skills naturally in the narrative — show them being used, not named.

${nameInstruction}
${titleInstruction}

CHARACTER DATA:

Species: ${species.name}
Biological truth: ${species.biologicalTruth}
Species lore anchors: ${species.loreAnchors}
Species narrative directive: ${species.directive}
Gender: ${gender} (use pronouns: ${pronouns.sub}/${pronouns.obj}/${pronouns.pos})

Phase 1 — Origin (where they came from):
  Card: ${phase1.title}
  Narrative: ${phase1.narrative}
  Environment: ${phase1.environment}
  Tone: ${phase1.tone}
  Themes: ${phase1.themes}

Phase 2 — Catalyst (what broke them free):
  Card: ${phase2.title}
  Narrative: ${phase2.narrative}
  Archetype: ${p2Archetype}
  Trained proficiencies: ${p2Proficiencies}
  Identity question: ${p2Variability}
  Tone: ${phase2.tone}

Phase 3 — Debt (what follows them):
  Card: ${phase3.title}
  Narrative: ${phase3.narrative}
  Archetype: ${p3Archetype}
  Burden ability: ${p3KnackName} (${p3KnackType})
  Tone: ${phase3.tone}

Trained identity (kits): ${kitsText}
Formative skills (disciplines D8+): ${discText}
Dominant traits (arenas D8+): ${arenaText}

Destiny alignment: ${destiny}
Destiny tone guidance: ${destinyTone}
${playerNote}`;
}

router.post('/backstory/generate', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on the server.' });
  }

  const payload = req.body;
  if (!payload || !payload.species || !payload.phase1) {
    return res.status(400).json({ error: 'Incomplete character data.' });
  }

  if (payload.playerInput && typeof payload.playerInput !== 'string') {
    payload.playerInput = '';
  }
  if (payload.playerInput) {
    payload.playerInput = payload.playerInput.substring(0, 2000);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.85,
    },
  });

  const prompt = buildPrompt(payload);

  const timeoutMs = 25000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
  );

  async function attemptGenerate(retries) {
    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);

    const text = result.response.text();
    console.log('[backstory] Raw response:', text.substring(0, 300));
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('[backstory] JSON parse error:', parseErr.message);
      console.error('[backstory] First 500 chars:', JSON.stringify(text.substring(0, 500)));
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (__) { /* fall through */ }
      }
      if (!parsed) {
        return { ok: false, status: 500, body: { error: 'The storyteller returned something unreadable. Try regenerating.' } };
      }
    }

    return {
      ok: true,
      body: {
        backstory: parsed.backstory || '',
        name:      parsed.name      || null,
        title:     parsed.title     || null,
      },
    };
  }

  try {
    let result = await attemptGenerate(0);
    if (result.ok) return res.json(result.body);
    return res.status(result.status).json(result.body);

  } catch (err) {
    const msg = err.message || '';
    const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');

    if (isRateLimit) {
      console.log('[backstory] Rate-limited — retrying once after 3s...');
      await new Promise(r => setTimeout(r, 3000));
      try {
        const retry = await attemptGenerate(1);
        if (retry.ok) return res.json(retry.body);
        return res.status(retry.status).json(retry.body);
      } catch (retryErr) {
        console.error('[backstory] Retry also failed:', retryErr.message);
        return res.status(429).json({ error: 'rate_limit' });
      }
    }

    if (err.message === 'TIMEOUT') {
      return res.status(504).json({ error: 'timeout' });
    }
    console.error('[backstory] Gemini error:', err.message);
    return res.status(500).json({ error: 'Generation failed. Try again.' });
  }
});

module.exports = router;
