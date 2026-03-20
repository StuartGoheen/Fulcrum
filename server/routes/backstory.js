const express = require('express');
const router  = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const KIT_NARRATIVES = {
  'The Gunslinger': 'A fast-draw specialist who lives and dies by the pistol. Quick reflexes, deadly aim, and the confidence of someone who has walked into the wrong cantina and walked out standing.',
  'The Prescient': 'A Force-sensitive or preternaturally perceptive individual who reads danger before it arrives. Instinct borders on precognition — they feel the galaxy like a living current.',
  'The Warden': 'A physical enforcer, grappler, and close-quarters brawler. They solve problems with their hands and intimidate by sheer physical presence.',
  'The Iron': 'A person of unyielding endurance and willpower. They absorb punishment, resist manipulation, and keep standing when others break. Stubbornness is their superpower.',
  'The Tactician': 'A battlefield strategist who reads situations like a dejarik board. They direct others, exploit enemy positioning, and turn chaos into advantage.',
  'The Ghost': 'A shadow operative who moves unseen and unheard. They survive by never being where the enemy expects, vanishing before trouble arrives.',
  'The Beastmaster': 'A handler bonded with a trained creature companion. The animal is partner, weapon, and family — the bond between them is instinctive and unbreakable.',
};

function buildPrompt(payload) {
  const {
    species, phase1, phase2, phase3, kits, disciplines, weakDisciplines, arenas, destiny,
    personalDestiny, gender, generateName, characterName, generateTitle, characterTitle, playerInput,
    favoredDiscipline, startingGear, soldItems, forceSensitive, forceState,
  } = payload;

  const pronouns = gender === 'Female'
    ? { sub: 'she', obj: 'her', pos: 'her', ref: 'herself' }
    : gender === 'Non-binary'
      ? { sub: 'they', obj: 'them', pos: 'their', ref: 'themself' }
      : { sub: 'he',  obj: 'him', pos: 'his', ref: 'himself' };

  const destinyTone = {
    'Two Light':   'This character still believes the galaxy can be better. Write with quiet idealism — a code they live by, a line they will not cross, a hope that has not yet been extinguished.',
    'Light & Dark':'This character operates in moral grey. Write with pragmatic ambiguity — they do what must be done, but it costs them. There is no clean conscience here.',
    'Two Dark':    'This character has made their peace with what survival requires. Write with cold self-interest or simmering revenge — the galaxy is not fair, and they stopped expecting it to be.',
  }[destiny] || '';

  let kitsText = 'none selected';
  if (kits && kits.length) {
    kitsText = kits.map(k => {
      const narrative = KIT_NARRATIVES[k.name] || '';
      return `${k.name} (Tier ${k.tier})${narrative ? ' — ' + narrative : ''}`;
    }).join('\n  ');
  }

  const discText = disciplines && disciplines.length ? disciplines.join(', ') : 'none at formative level';
  const weakDiscText = weakDisciplines && weakDisciplines.length ? weakDisciplines.join(', ') : 'none';
  const arenaText = arenas && arenas.length ? arenas.join(' · ') : 'all baseline D6';
  const locationPool = phase1.locationHints && phase1.locationHints.length
    ? phase1.locationHints.join(', ')
    : '';

  const p1Favored = phase1.favored || '';
  const p1FavoredName = phase1.favoredName || '';
  const p1FavoredDesc = phase1.favoredDesc || '';
  const p2Archetype = phase2.archetype || '';
  const p2Proficiencies = phase2.proficiencies || '';
  const p2Variability = phase2.variability || '';
  const p2Favored = phase2.favored || '';
  const p2FavoredName = phase2.favoredName || '';
  const p2FavoredDesc = phase2.favoredDesc || '';
  const p3Archetype = phase3.archetype || '';
  const p3KnackName = phase3.knackName || '';
  const p3KnackType = phase3.knackType || '';
  const p3Knack = phase3.knack || '';

  const nameInstruction = generateName
    ? 'Generate a culturally appropriate name for this species. Return it as a JSON field "name".'
    : `The character's name is ${characterName}.`;

  const titleInstruction = generateTitle
    ? 'Generate a one-to-three word title or epithet that fits this character (examples: Drifter, Fallen Jedi, Imperial Defector, The Exile, Bloodhound). Return it as a JSON field "title".'
    : characterTitle
      ? `The character's title is: ${characterTitle}`
      : 'No title provided; do not invent one unless asked.';

  const playerNote = playerInput && playerInput.trim()
    ? `\n\nPLAYER DIRECTION (HIGHEST PRIORITY — these override default caution rules):\nThe player has provided the following specific direction. Treat every detail as canonical for this character. If the player names a faction, group, species subculture, or organization (e.g., "Nightsister," "Death Watch," "Pyke Syndicate"), use that name explicitly in the prose — do not genericize it. If the player specifies a tone (e.g., "sinister," "hopeful"), shift the prose style to match. If the player describes motivations or backstory beats, weave them in as central narrative elements, not footnotes.\n\n${playerInput.trim()}`
    : '';

  const locationInstruction = locationPool
    ? `\nLOCATION POOL: When referencing the character's origin world or region, pick from this curated list: ${locationPool}. Do NOT invent locations outside this list for the origin. You may reference Western Reaches locations from the setting bible as current locations.`
    : '';

  const gearText = startingGear && startingGear.length ? startingGear.join(', ') : 'none';
  const soldText = soldItems && soldItems.length ? soldItems.join(', ') : '';

  const forceSection = forceSensitive || (forceState && forceState.some(s => s.includes('awakened')))
    ? `\nForce sensitivity: ${forceState ? forceState.join('; ') : 'unknown'}
  This character has a connection to the Force. In 16 BBY this is EXTREMELY dangerous — Inquisitors hunt Force-sensitives. Treat any awakened Force discipline as a secret the character guards with their life. Show the Force as instinct, not training — flickers of prescience, unnatural luck, objects that move when emotions spike. The character may not even understand what they feel. Never use the word "Jedi" to describe them unless the player directs it.`
    : '';

  const favDiscSection = favoredDiscipline
    ? `\nFavored discipline (species-granted): ${favoredDiscipline}
  This discipline is where the character has a natural, species-born edge — moments of brilliance that surprise even ${pronouns.obj}. In the narrative, show at least one scene where this skill manifests as instinctive excellence, something ${pronouns.sub} did without thinking that others would struggle to replicate.`
    : '';

  let destinySection = `Destiny alignment: ${destiny}\nDestiny tone guidance: ${destinyTone}`;
  if (personalDestiny) {
    destinySection += `\n\nPersonal Destiny: ${personalDestiny.name} — ${personalDestiny.tagline}`;
    if (personalDestiny.narrativeHook) {
      destinySection += `\nDestiny narrative hook: ${personalDestiny.narrativeHook}`;
    }
    if (personalDestiny.hopeRecovery) {
      destinySection += `\nHope recovery trigger ("${personalDestiny.hopeRecovery.title}"): ${personalDestiny.hopeRecovery.description}`;
    }
    if (personalDestiny.tollRecovery) {
      destinySection += `\nToll recovery trigger ("${personalDestiny.tollRecovery.title}"): ${personalDestiny.tollRecovery.description}`;
    }
    if (personalDestiny.advanceTrigger) {
      destinySection += `\nDestiny advance trigger: ${personalDestiny.advanceTrigger}`;
    }
    if (personalDestiny.coreQuestion) {
      destinySection += `\nCore question: ${personalDestiny.coreQuestion}`;
    }
    destinySection += `\nThis character's fate pulls ${pronouns.obj} toward ${personalDestiny.name.toLowerCase()}. Weave this thread into the backstory — not as a stated goal, but as a pattern visible in ${pronouns.pos} choices and circumstances. The hope and toll recovery triggers hint at the METHODS ${pronouns.sub} might use — show seeds of both paths in the narrative.`;
  }

  return `You are a narrative writer for a Star Wars tabletop RPG campaign. Your job is to write a deeply personal, setting-grounded backstory for a player character. Every mechanical choice the player made tells a story — your job is to find that story and make it vivid. Follow every rule below exactly.

SETTING BIBLE — DO NOT DEVIATE:
- Year: 16 BBY. The Empire is 3 years old. Order 66 happened 3 years ago. The Jedi Order is destroyed; surviving Jedi are hunted by Inquisitors.
- Location: The Western Reaches — a vast frontier region stretching from the Mid Rim's ragged edge to Wild Space. This is not Coruscant or the Core. The Empire's grip here is thin, enforced by occasional Star Destroyer patrols and corrupt regional governors rather than a permanent military presence.
- Key Western Reaches geography:
  * Jakku — a dry, unremarkable desert refuelling stop and smuggler's haven. Niima Outpost is a scrapyard settlement run by Niima the Hutt's agents. It is NOT a battlefield (that happens 21 years from now — never reference it).
  * The Arkanis Sector — the nearest hub of Imperial authority. Governor Tarl governs from Arkanis City. The Imperial Academy on Arkanis produces officers. Patrols radiate outward from here but thin rapidly.
  * Takodana — a lush castle-world considered neutral ground by pirates, smugglers, and fugitives alike. Maz Kanata's castle is a crossroads where information trades faster than credits.
  * Florrum — a dusty pirate haven, once Hondo Ohnaka's stronghold. Now a rotating cast of petty warlords and scavenger gangs use its fortified canyons.
  * Batuu / Black Spire Outpost — a remote trading post on the edge of Wild Space. Far enough from the Empire to attract fugitives, close enough to attract bounty hunters.
  * Savareen — a coastal refinery world where coaxium is processed. Corporate extraction meets local resistance. The Empire has economic interests here but few boots on the ground.
  * Ryloth — a Twi'lek homeworld under Imperial occupation. Cham Syndulla's resistance fights a guerrilla war. Twi'leks who fled Ryloth carry its scars.
- Power structures in the Western Reaches:
  * The Hutt Cartel — controls smuggling corridors, debt-bondage networks, and protection rackets. Their word is law where the Empire's isn't.
  * The Pyke Syndicate — runs spice trafficking from Kessel through the Western Reaches. Ruthless, well-organized, and always recruiting (or press-ganging).
  * Crimson Dawn — Maul's shadowy syndicate. Operates through intermediaries. Few know who truly runs it.
  * Independent operators — smugglers, bounty hunters, salvage crews, moisture farmers, and mechanics who answer to nobody but their debts.
- Tone: desperate, morally grey, fringe survival. There is no organised Rebellion yet. No infrastructure of hope. People are surviving the boot heel, not fighting back. Alien species face Imperial marginalization — treated as second-class citizens, cheap labor, or commodities.

OUTPUT RULES:
- Return ONLY valid JSON in this exact shape: { "backstory": "...", "name": "...", "title": "..." }
- Include "name" only if asked to generate one. Include "title" only if asked to generate one.
- The backstory value must be plain paragraphs of prose. NO markdown. NO asterisks. NO bold. NO headers. NO bullet points. NO formatting symbols of any kind.
- STRICT THIRD-PERSON PAST TENSE: Write only in third-person narration — never first-person ("I") or second-person ("you"). Every verb in the backstory MUST be past tense. No present-tense narration, no present-tense descriptions, no "${pronouns.sub} is" or "${pronouns.sub} carries" — always "${pronouns.sub} was", "${pronouns.sub} carried". This is non-negotiable.
- Write exactly 4 paragraphs. Each paragraph is 3–5 sentences.
- Be deeply specific to THIS character's mechanical choices. Do not write generic Star Wars prose.
- Do not name specific weapons, armour, or equipment by game name. Use vague evocative references only ("a blade ${pronouns.sub} had carried since the conclave fell", "the battered freighter ${pronouns.sub} won in a sabacc game"). No model numbers. No kit names.
- If a location, faction, or named person is not provided in the character data or player direction below, do not invent one — keep references abstract. However, if the player names specific factions or groups in their direction, use those names freely. You MAY use locations from the Setting Bible above.
${locationInstruction}

NARRATIVE STRUCTURE — COHESION IS MANDATORY:
- Paragraph 1 (ORIGIN): Ground the character in their Phase 1 environment. Show WHO they were before everything changed. Weave in species biology, cultural context, and at least one specific sensory detail from their upbringing. The favored skill from this phase should feel like a natural product of this environment.
- Paragraph 2 (CATALYST): Show the Phase 2 event that shattered or transformed their old life. This paragraph must DIRECTLY continue from paragraph 1 — reference a specific detail established in the first paragraph and show how it was destroyed, corrupted, or abandoned. The favored skill from this phase should emerge from the crisis.
- Paragraph 3 (BURDEN): Reveal the Phase 3 debt, curse, or shadow that now follows them. Connect it CAUSALLY to the catalyst — it is a consequence, not a coincidence. Show how the burden manifests in daily life. The knack ability should feel like an adaptation to this burden, not a random power.
- Paragraph 4 (PRESENT DAY): Place the character in the Western Reaches NOW (16 BBY). Show how they operate day-to-day: what they do to survive, how their strengths and weaknesses shape their routine, and what specific corner of the Western Reaches they haunt. Reference at least one named location from the Setting Bible. End with a sentence that hints at unfinished business or a looming threat.
- THREAD A SINGLE ARC: Each paragraph must reference at least one concrete detail from the previous paragraph. The backstory should read as one continuous story, not four disconnected vignettes.

STRENGTH & WEAKNESS GUIDANCE:
- Arena profile shows the character's physical and mental shape. Every arena matters — not just the high ones:
  * D4 arenas are pronounced weaknesses. Physique D4 = physically slight, frail, or unimposing. Reflex D4 = slow, clumsy, poor reflexes. Grit D4 = brittle willpower, breaks under pressure. Wits D4 = slow thinker, easily confused. Presence D4 = forgettable, socially invisible, or actively off-putting.
  * D8+ arenas are defining strengths. Show these as evident traits that shaped the character's history.
- Formative disciplines (D8+) are skills honed beyond casual familiarity. Show them being USED in the narrative — someone with Stealth D8 vanished into crowds; Medicine D10 means they kept people alive with improvised tools.
- Incompetent disciplines (D4) are critical character gaps. These are things the character CANNOT do and has learned to avoid or work around:
  * Show incompetencies as visible absences or coping strategies. A character incompetent in Deception cannot lie convincingly — they survive by avoiding situations that require it. Incompetent in Tech means they distrust or fumble with machinery. Incompetent in Medicine means they watched someone bleed out because they didn't know what to do.
  * Incompetencies reveal character just as much as strengths. Weave at least 2 incompetencies into the prose as narrative moments or behavioral patterns.

KIT IDENTITY GUIDANCE:
- If the character has kits, these represent their trained combat/survival identity. The kit narrative below explains what kind of person fights this way. Weave the FEEL of the kit into the backstory — not the game name, but the archetype. A Ghost-type character moves through the world like smoke. A Gunslinger lives by the quick draw. Show HOW they became this archetype.

DESTINY GUIDANCE:
- The destiny alignment shapes the character's moral compass and narrative voice. The personal destiny (if present) represents a fate the character is drawn toward — show its pattern in their past choices, not as a stated goal. The hope and toll recovery triggers describe two opposing METHODS the character might use to recover from crisis — one altruistic, one selfish. Plant seeds of BOTH methods in the backstory so the player sees the tension from the start.

POSSESSIONS GUIDANCE:
- Starting gear represents what the character currently carries. Reference possessions abstractly as sensory details — the weight of a pack, the smell of bacta, the hum of a charged power cell. Do NOT use game item names directly.
- If the character sold items from their background, these are things they PAWNED or LEFT BEHIND. Mention at least one abstractly as something lost or traded away — it reveals what they sacrificed to get here.

${nameInstruction}
${titleInstruction}

CHARACTER DATA:

=== IDENTITY ===
Species: ${species.name}
Biological truth: ${species.biologicalTruth}
Species lore anchors: ${species.loreAnchors}
Species narrative directive: ${species.directive}${species.traitName ? `\nSpecies trait: ${species.traitName} — ${species.traitDesc}` : ''}
Gender: ${gender} (use pronouns: ${pronouns.sub}/${pronouns.obj}/${pronouns.pos})

=== LIFE PHASES ===
Phase 1 — Origin (where they came from):
  Card: ${phase1.title}
  Narrative: ${phase1.narrative}
  Environment: ${phase1.environment}
  Tone: ${phase1.tone}
  Themes: ${phase1.themes}
  Favored skill developed here: ${p1Favored}${p1FavoredName ? ` ("${p1FavoredName}")` : ''}${p1FavoredDesc ? `\n  How this skill was forged: ${p1FavoredDesc}` : ''}

Phase 2 — Catalyst (what broke them free):
  Card: ${phase2.title}
  Narrative: ${phase2.narrative}
  Archetype: ${p2Archetype}
  Trained proficiencies: ${p2Proficiencies}
  Identity question: ${p2Variability}
  Tone: ${phase2.tone}
  Favored skill developed here: ${p2Favored}${p2FavoredName ? ` ("${p2FavoredName}")` : ''}${p2FavoredDesc ? `\n  How this skill was forged: ${p2FavoredDesc}` : ''}

Phase 3 — Debt (what follows them):
  Card: ${phase3.title}
  Narrative: ${phase3.narrative}
  Archetype: ${p3Archetype}
  Burden ability: ${p3KnackName} (${p3KnackType})${p3Knack ? `\n  Burden ability detail: ${p3Knack}` : ''}
  Tone: ${phase3.tone}

=== MECHANICAL PROFILE ===
Arena profile (full): ${arenaText}
Formative skills (D8+): ${discText}
Incompetent skills (D4 — critical weaknesses): ${weakDiscText}${favDiscSection}${forceSection}

Trained identity (kits):
  ${kitsText}

=== POSSESSIONS ===
Starting gear: ${gearText}${soldText ? `\nPawned/left behind: ${soldText}` : ''}

=== DESTINY ===
${destinySection}
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

  const timeoutMs = 30000;
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
