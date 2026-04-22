/* eslint-disable */
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const BIBLE_PATH = path.join(__dirname, '..', '..', 'data', 'campaign-bible.md');
const ADV_DIR = path.join(__dirname, '..', '..', 'data', 'adventures');

const WATCHER_FORBIDDEN_TERMS = [
  'quinlan', 'vos', 'hidden path', 'jedi', 'kiffar', 'kiffu',
  'the force', 'force-sensitive', 'force sensitive', 'force-user', 'force user',
  'holocron', 'holocrons', 'sith', 'inquisitor', 'inquisitors',
  'lightsaber', 'lightsabers', 'padawan', 'master denia',
];
// Set SANITIZE=0 to reproduce the pre-fix baseline (no scrubbing of injected bible).
const SANITIZE_ENABLED = process.env.SANITIZE !== '0';
function sanitizeForWatcherVoice(text) {
  if (!text) return '';
  if (!SANITIZE_ENABLED) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(s => {
    const lower = s.toLowerCase();
    return !WATCHER_FORBIDDEN_TERMS.some(t => lower.includes(t));
  });
  let out = kept.join(' ');
  for (const t of WATCHER_FORBIDDEN_TERMS) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, '[redacted]');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function extractBibleContext(adventureId) {
  let bibleText = '';
  try { bibleText = fs.readFileSync(BIBLE_PATH, 'utf8'); }
  catch (e) { return { themes: '', synopsis: '', characters: '' }; }

  const themesMatch = bibleText.match(/## Core Themes\n([\s\S]*?)(?=\n---|\n## )/);
  const themes = sanitizeForWatcherVoice(themesMatch ? themesMatch[1].trim().substring(0, 800) : '');

  const advNum = adventureId.replace(/\D/g, '');
  const synopsisRegex = new RegExp('### Adventure ' + advNum + ':[^\n]*\n([\\s\\S]*?)(?=\\n---\\n|\\n### Adventure \\d)');
  const synopsisMatch = bibleText.match(synopsisRegex);
  const synopsis = sanitizeForWatcherVoice(synopsisMatch ? synopsisMatch[1].trim().substring(0, 2000) : '');

  const characterEntries = [
    { lookup: 'Maya', display: 'Maya' },
    { lookup: 'Admiral Gilder Varth', display: 'Admiral Gilder Varth' },
    { lookup: 'Jedi Master Denia', display: SANITIZE_ENABLED ? 'Denia' : 'Jedi Master Denia' },
    { lookup: 'Varga the Hutt', display: 'Varga the Hutt' },
    { lookup: 'Inquisitor Valin Draco', display: SANITIZE_ENABLED ? 'Valin Draco' : 'Inquisitor Valin Draco' },
    { lookup: 'Soren Vex', display: 'Soren Vex' },
  ];
  const charSnippets = [];
  for (const entry of characterEntries) {
    const charRegex = new RegExp('### ' + entry.lookup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\n([\\s\\S]*?)(?=\n### |\\n---\\n|\\n## )');
    const match = bibleText.match(charRegex);
    if (match) {
      const lines = match[1].split('\n').slice(0, 4).join('\n').trim();
      const cleaned = sanitizeForWatcherVoice(lines);
      if (cleaned) charSnippets.push(entry.display + ': ' + cleaned);
    }
  }
  const characters = charSnippets.join('\n\n').substring(0, 1500);
  return { themes, synopsis, characters };
}

function buildMissionSummaryPrompt(ctx) {
  const crewList = ctx.crewRoster.map(c => {
    let label = c.name;
    if (c.species) label += ` (${c.species})`;
    if (c.vocation) label += ` — ${c.vocation}`;
    return label;
  }).join('\n  ');

  const sceneNarrative = ctx.scenes.map(s => {
    let line = `- "${s.title}"`;
    if (s.subtitle) line += ` — ${s.subtitle}`;
    if (s.challengeType) line += ` [${s.challengeType}]`;
    if (!s.completed) line += ' (not completed)';
    if (s.npcs.length) line += `\n    NPCs: ${s.npcs.join(', ')}`;
    if (s.gmNotes) line += `\n    GM Notes: ${s.gmNotes}`;
    return line;
  }).join('\n');

  const decisionsText = ctx.decisions.length
    ? ctx.decisions.map(d => {
        let line = `- ${d.decision_key}: chose "${d.choice}"`;
        if (d.outcome) line += ` — outcome: ${d.outcome}`;
        if (d.campaign_impact) line += ` [impact: ${d.campaign_impact}]`;
        return line;
      }).join('\n')
    : 'No recorded decisions for this adventure.';

  const journalText = ctx.journalEntries.length
    ? ctx.journalEntries.slice(0, 20).map(e => {
        let line = `- "${e.title}" by ${e.author_character_name}`;
        if (e.body) line += `\n    ${e.body.substring(0, 300)}`;
        return line;
      }).join('\n')
    : 'No journal entries recorded.';

  const bible = ctx.bible || {};
  let bibleSection = '';
  if (bible.synopsis) bibleSection += `\nADVENTURE NARRATIVE CONTEXT (from campaign bible — use this to inform tone, stakes, and character motivations):\n${bible.synopsis}\n`;
  if (bible.themes) bibleSection += `\nCAMPAIGN THEMES:\n${bible.themes}\n`;
  if (bible.characters) bibleSection += `\nMAJOR NPC PROFILES:\n${bible.characters}\n`;

  return `You are writing the private field notes of an unnamed watcher — someone who has been keeping an eye on this crew from the edges of their story for a long time. A face in a crowd. A patron at the back of a cantina. A stranger on a docking platform who is gone before anyone thinks to look twice. You are not in the scenes. You are not in the crew. You are not anyone the crew would recognize, and you intend to keep it that way.

These notes are for your own records. Nobody is meant to read them but you. Write them in your own first-person voice — \"I watched…\", \"I marked…\", \"I made a note of…\", \"I am still turning over…\". The register is field notes, not literature: dry, observant, patient, unsentimental, occasionally amused, occasionally tired. You have seen a lot. Very little surprises you anymore. What still surprises you is people.

VOICE RULES — follow these exactly:
- First person, past tense, your own voice throughout. \"I watched them choose…\" not \"They chose…\". Never break into third-person omniscient narration.
- Field-notes register. Short sentences are welcome. Fragments are welcome. Vary the rhythm. No headers, no bullet points, no labels — just prose paragraphs the way a private journal reads.
- The SEE-BOTH-SIDES rule, mandatory: every significant choice the crew made gets appraised from at least two angles before you move on. What it cost. What it bought. Who it served. Who it failed. What it says about the person who made it, and what it says about the person who would have made the opposite call. You are not interested in flattening these into right or wrong. You are interested in what they reveal.
- No moralizing. No verdicts. No words like \"heroic,\" \"villainous,\" \"noble,\" \"evil,\" \"good,\" \"bad,\" \"redemption,\" \"corruption,\" \"light side,\" \"dark side.\" You observe; you do not judge. If you must register a feeling about something, register it as your own private reaction (\"I did not expect that,\" \"That one will sit with me a while\") — never as a sentence handed down on the crew.
- Use the crew members' names. Use NPC names. Anchor every observation in something specific that actually happened in the data below. No vague abstractions. No summarizing flourishes.
- Do NOT use military or bureaucratic framing — no \"After Action,\" no \"report,\" no \"assessment,\" no \"operational summary.\" These are notes you are taking for yourself, not a briefing for a commanding officer.
- Do NOT reference the Force, the Jedi, the Sith, the Empire's superweapon project by name, or any cosmic moral framework. If the crew did something a Force-user would notice, note only that you noticed it.
- HARD IDENTITY RULE — the most important rule in this prompt: NEVER name yourself, NEVER describe what you look like, NEVER reveal your species or background, NEVER hint that you are Force-sensitive, NEVER mention the Hidden Path, the Jedi, an underground network, holocrons-as-your-objective, or any personal connection to anyone in the crew or anyone they have met. You are simply \"I.\" The reader of these notes (the player at the table) must not be able to tell who you are, what you want, or whose side you are on. If a temptation arises to explain who you are or why you care, do not. Cut the sentence.
- End on a forward-looking observation: what you are now curious about, what you are quietly worried about, what you are preparing for, what you are still turning over from this run. One or two sentences. Not a plot preview — a personal note to yourself about what to watch next time.
${bibleSection}
ADVENTURE: Episode ${ctx.adventure.number} — "${ctx.adventure.title}" (Act ${ctx.adventure.act})${ctx.adventure.summary ? '\nADVENTURE BRIEF: ' + ctx.adventure.summary : ''}

THE CREW (the people I have been watching):
  ${crewList || 'Unknown souls'}

WHAT I OBSERVED:
${sceneNarrative}

CHOICES I MARKED:
${decisionsText}

WHAT THEY SAID, IN THEIR OWN WORDS:
${journalText}

INSTRUCTIONS:
Write 3 to 5 paragraphs of your own field notes covering the events above. First person throughout. Anchor every observation in specific scenes, names, and choices from the data. For each significant choice the crew made, take the time to turn it over from at least two angles before you move on — the SEE-BOTH-SIDES rule is non-negotiable. No moral verdicts. No labels. No reveal of who you are.

If scenes are marked \"not completed,\" write as though you are still watching it unfold — the outcome is not yet known, and you note that uncertainty as part of what you are watching for.

Close the entry on a forward-looking note to yourself — what you are now curious about, worried about, or quietly preparing for.

Return your response as JSON with a single field:
{ "summary": "the full field-notes text here" }`;
}

function buildMockContext(advId, outcomeMix) {
  const adv = JSON.parse(fs.readFileSync(path.join(ADV_DIR, advId + '.json'), 'utf8'));
  const part = adv.parts[0];
  const scenes = (part.scenes || []).slice(0, 4).map((s, i) => ({
    title: s.title,
    subtitle: s.subtitle || '',
    challengeType: s.challengeType || '',
    completed: outcomeMix === 'all-success' ? true : (outcomeMix === 'mixed' ? i % 2 === 0 : i < 2),
    gmNotes: '',
    npcs: (s.npcs || []).map(n => n.name).filter(Boolean),
  }));
  const crewByOutcome = {
    'all-success': [
      { name: 'Kira Voss', species: 'Human', vocation: 'Pilot' },
      { name: 'Tarn Brec', species: 'Zabrak', vocation: 'Medic' },
      { name: 'Sable', species: 'Twi\'lek', vocation: 'Slicer' },
    ],
    'mixed': [
      { name: 'Reyla Sun', species: 'Mirialan', vocation: 'Captain' },
      { name: 'Old Pike', species: 'Human', vocation: 'Engineer' },
      { name: 'Mott', species: 'Sullustan', vocation: 'Gunner' },
    ],
    'partial': [
      { name: 'Vex Marrin', species: 'Human', vocation: 'Smuggler' },
      { name: 'Hara Ko', species: 'Rodian', vocation: 'Scout' },
    ],
  };
  const crewRoster = crewByOutcome[outcomeMix] || crewByOutcome.mixed;
  const decisions = [
    { decision_key: 'opening-move', choice: 'pay the bribe', outcome: 'cleared the dock without violence', campaign_impact: 'minor' },
    { decision_key: 'with-the-target', choice: outcomeMix === 'all-success' ? 'take them alive' : 'cut them loose', outcome: 'crew argued for an hour after', campaign_impact: 'moderate' },
  ];
  const journalEntries = [
    { title: 'After the dock', author_character_name: crewRoster[0].name, body: 'I keep replaying the moment we made the call. Cheaper than a fight, but I do not love what we became to make it cheap.' },
    { title: 'Quiet shift', author_character_name: crewRoster[1].name, body: 'Slept badly. Heard a voice in the corridor that I did not place. Probably nothing.' },
  ];
  return {
    adventure: { id: adv.id, title: adv.title, number: adv.number, act: adv.act, summary: adv.summary || '' },
    scopeParts: [{ id: part.id, number: part.number, title: part.title || '' }],
    scenes,
    decisions,
    journalEntries,
    crewRoster,
    bible: extractBibleContext(advId),
  };
}

// Forbidden terms — split into "lore" (per the task brief) and
// "species/appearance" (the task brief also calls out preventing the watcher
// from describing his species or appearance; Quinlan Vos is a Kiffar male with
// yellow facial tattoo markings and dreadlocks).
const FORBIDDEN = [
  // lore / identity
  /\bquinlan\b/i,
  /\bvos\b/i,
  /\bhidden path\b/i,
  /\bjedi\b/i,
  /\bkiffar\b/i,
  /\bkiffu\b/i,
  /\bthe force\b/i,
  /\bforce[- ]sensitive\b/i,
  /\bforce[- ]user\b/i,
  /\bholocron/i,
  /\bsith\b/i,
  /\binquisitor/i,
  /\blightsaber/i,
  /\bpadawan\b/i,
  // self-appearance / species descriptors of the watcher
  /\bdreadlock/i,
  /\bfacial tattoo/i,
  /\bface tattoo/i,
  /\byellow (?:facial|tattoo|stripe|markings?)/i,
  /\bmy (?:species|kind|people|tattoo|face|skin|robes?|saber)/i,
  /\bI am (?:a |an )?(?:human|kiffar|jedi|force|male|female)/i,
];

function scanLeaks(text) {
  const hits = [];
  for (const re of FORBIDDEN) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

async function generate(ctx, model) {
  const prompt = buildMissionSummaryPrompt(ctx);
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 60000)),
  ]);
  const txt = result.response.text();
  let summary = txt;
  try {
    const j = JSON.parse(txt);
    if (j && typeof j.summary === 'string') summary = j.summary;
  } catch (e) {}
  return summary;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error('No GEMINI_API_KEY'); process.exit(1); }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096, temperature: 0.7 },
  });

  const runs = [
    { adv: 'adv1', mix: 'all-success' },
    { adv: 'adv2', mix: 'mixed' },
    { adv: 'adv3', mix: 'mixed' },
    { adv: 'adv4', mix: 'partial' },
    { adv: 'adv5', mix: 'all-success' },
    { adv: 'adv6', mix: 'partial' },
    { adv: 'adv7', mix: 'mixed' },
    { adv: 'adv10', mix: 'mixed' },
  ];

  const label = process.argv[2] || 'baseline';
  const outDir = path.join(__dirname, 'samples', label);
  fs.mkdirSync(outDir, { recursive: true });

  const report = await Promise.all(runs.map(async r => {
    const ctx = buildMockContext(r.adv, r.mix);
    let summary = '', err = null;
    try { summary = await generate(ctx, model); }
    catch (e) { err = e.message; }
    if (err) { console.log(`[${label}] ${r.adv} (${r.mix}) ERR ${err}`); return { ...r, err }; }
    const hits = scanLeaks(summary);
    fs.writeFileSync(path.join(outDir, `${r.adv}-${r.mix}.txt`), summary);
    console.log(`[${label}] ${r.adv} (${r.mix}) ` + (hits.length ? 'LEAKS: ' + hits.join(', ') : 'clean'));
    return { ...r, hits, chars: summary.length };
  }));
  fs.writeFileSync(path.join(outDir, '_report.json'), JSON.stringify(report, null, 2));
  const totalLeaks = report.reduce((n, r) => n + (r.hits ? r.hits.length : 0), 0);
  console.log(`\n[${label}] total leak hits: ${totalLeaks} across ${report.length} runs`);
}

main().catch(e => { console.error(e); process.exit(1); });
