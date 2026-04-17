const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool } = require('../db');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const RULES_FILES = [
  { id: 'gamesystem',       file: 'gamesystem.json',       label: 'Game System (dice, fulcrum, levers)' },
  { id: 'maneuvers',        file: 'maneuvers.json',        label: 'Maneuvers & Actions' },
  { id: 'glossary',         file: 'glossary.json',         label: 'Attributes & Disciplines' },
  { id: 'weapons',          file: 'weapons.json',          label: 'Weapons' },
  { id: 'gear',             file: 'gear.json',             label: 'Gear' },
  { id: 'armor',            file: 'armor.json',            label: 'Armor' },
  { id: 'kits',             file: 'kits.json',             label: 'Kits' },
  { id: 'destinies',        file: 'destinies.json',        label: 'Destinies' },
  { id: 'phases',           file: 'phases.json',           label: 'Life Phases' },
  { id: 'downtime',         file: 'downtime.json',         label: 'Downtime' },
  { id: 'entanglements',    file: 'entanglements.json',    label: 'Entanglements' },
  { id: 'species',          file: 'species.json',          label: 'Species' },
  { id: 'chassis',          file: 'chassis.json',          label: 'NPC Chassis' },
  { id: 'campaign-bible',   file: 'campaign-bible.md',     label: 'Campaign Bible (lore)' },
  { id: 'scum-and-villainy',file: 'scum-and-villainy.md',  label: 'NPC Roles (Scum & Villainy)' },
];

let _rulesCache = null;
function loadRulesCorpus() {
  if (_rulesCache) return _rulesCache;
  const sections = [];
  for (const r of RULES_FILES) {
    try {
      const p = path.join(DATA_DIR, r.file);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      sections.push({ id: r.id, label: r.label, content: raw });
    } catch (e) {
      console.warn('[protocol-droid] failed to load', r.file, e.message);
    }
  }
  _rulesCache = sections;
  console.log('[protocol-droid] rules corpus loaded:',
    sections.length, 'files,',
    sections.reduce((a, s) => a + s.content.length, 0), 'chars');
  return _rulesCache;
}

// --- Topic prefilter for the rules corpus ---
const STOPWORDS = new Set([
  'the','and','for','with','that','this','what','how','why','when','where','who','which',
  'can','are','was','were','will','have','has','had','from','our','your','any','one','two',
  'about','than','then','also','into','only','some','more','most','few','many','other','these','those',
  'use','using','used','get','got','best','good','bad','make','makes','made','need','needs','want',
  'his','her','their','them','they','you','him','she','its','out','off','all','not','but','yet',
  'should','could','would','must','may','might','does','doing','did','done','vs','versus','against'
]);

function tokenize(s) {
  return String(s == null ? '' : s).toLowerCase().match(/[a-z0-9_]{3,}/g) || [];
}

let _rulesIndex = null;
function buildRulesIndex() {
  if (_rulesIndex) return _rulesIndex;
  const sections = loadRulesCorpus();
  _rulesIndex = sections.map(s => {
    const tokens = tokenize(s.label + ' ' + s.content);
    const freq = new Map();
    for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
    const labelTokens = new Set(tokenize(s.label));
    return { id: s.id, label: s.label, content: s.content, freq, labelTokens };
  });
  return _rulesIndex;
}

function selectRulesSections(question, opts) {
  opts = opts || {};
  const topN = opts.topN || 6;
  const always = opts.always || ['gamesystem', 'glossary'];
  const idx = buildRulesIndex();
  const qTokens = tokenize(question).filter(t => !STOPWORDS.has(t));
  if (!qTokens.length) {
    // Pure-stopword questions (e.g. "who are you?") — give it the anchors only,
    // not the entire corpus, so we don't burn 946KB on a meta-question.
    const anchors = always.map(id => idx.find(x => x.id === id)).filter(Boolean);
    return { sections: anchors, selected: anchors.length, total: idx.length, mode: 'anchors-only' };
  }
  const scored = idx.map(s => {
    let score = 0;
    for (const t of qTokens) {
      const f = s.freq.get(t) || 0;
      if (f > 0) score += 1 + Math.log(1 + f);
      if (s.labelTokens.has(t)) score += 3;
    }
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const picked = new Map();
  for (const id of always) {
    const found = idx.find(x => x.id === id);
    if (found) picked.set(found.id, found);
  }
  for (const { s, score } of scored) {
    if (picked.size >= topN) break;
    if (score <= 0) continue;
    if (!picked.has(s.id)) picked.set(s.id, s);
  }
  // Safety net: if scoring yielded ~nothing useful, fall back to full corpus.
  const scoredHits = scored.filter(x => x.score > 0).length;
  if (scoredHits === 0) {
    return { sections: idx, selected: idx.length, total: idx.length, mode: 'no-hits-fallback' };
  }
  return {
    sections: Array.from(picked.values()),
    selected: picked.size,
    total: idx.length,
    mode: 'prefiltered',
  };
}

async function loadDramatisCorpus(isGmCaller) {
  // Players only see revealed NPCs and never gm_notes; GM sees everything.
  const where = isGmCaller ? '' : 'WHERE revealed = true';
  const r = await pool.query(`
    SELECT id, npc_key, name, species, role, status, player_bio, ${isGmCaller ? 'gm_notes,' : ''} traits, connections, revealed
    FROM npc_profiles
    ${where}
    ORDER BY sort_order ASC, id ASC
  `);
  const profiles = r.rows;
  if (!profiles.length) return [];

  const keys = profiles.map(p => p.npc_key);
  const tlWhere = isGmCaller ? '' : 'AND revealed = true';
  const tl = await pool.query(`
    SELECT npc_key, adventure_ref, scene_ref, event_text, revealed, created_at
    FROM npc_timeline
    WHERE npc_key = ANY($1::text[]) ${tlWhere}
    ORDER BY npc_key ASC, id ASC
  `, [keys]);

  const byKey = {};
  for (const e of tl.rows) {
    (byKey[e.npc_key] = byKey[e.npc_key] || []).push(e);
  }
  for (const p of profiles) {
    p.timeline = byKey[p.npc_key] || [];
    try { p.traits = typeof p.traits === 'string' ? JSON.parse(p.traits) : (p.traits || []); } catch (_) { p.traits = []; }
    try { p.connections = typeof p.connections === 'string' ? JSON.parse(p.connections) : (p.connections || []); } catch (_) { p.connections = []; }
  }
  return profiles;
}

async function loadJournalCorpus(viewerName) {
  const v = (viewerName || '').toString().trim();
  if (!v) return [];
  const r = await pool.query(`
    SELECT
      e.id, e.title, e.body, e.author_character_name, e.source_scene_id,
      e.visibility, e.created_at,
      COALESCE(json_agg(json_build_object('name', t.name, 'category', t.category))
        FILTER (WHERE t.id IS NOT NULL), '[]') AS tags
    FROM journal_entries e
    LEFT JOIN journal_entry_tags et ON et.entry_id = e.id
    LEFT JOIN journal_tags t ON t.id = et.tag_id
    WHERE e.visibility = 'crew' OR (e.visibility = $1 AND e.author_character_name = $1)
    GROUP BY e.id
    ORDER BY e.created_at ASC
  `, [v]);
  return r.rows;
}

function formatDate(d) {
  try {
    const dt = new Date(d);
    return dt.toISOString().slice(0, 10);
  } catch (_) { return ''; }
}

function buildJournalSection(entries) {
  if (!entries.length) return '(No journal entries available to this character.)';
  const lines = [];
  for (const e of entries) {
    const tagStr = (e.tags || []).map(t => t.name).join(', ');
    const scope = e.visibility === 'crew' ? 'Crew' : 'Private';
    let kind = 'Journal';
    if (e.source_scene_id) {
      if (e.source_scene_id.startsWith('conversation:')) kind = 'Conversation clip';
      else if (e.source_scene_id === 'holonet') kind = 'HoloNet broadcast';
      else if (e.source_scene_id.startsWith('map-')) kind = 'Map note';
      else kind = 'Scene log';
    }
    lines.push(`--- ENTRY id=${e.id}  (${kind}) ---`);
    lines.push(`Title: ${e.title}`);
    lines.push(`Date: ${formatDate(e.created_at)}  |  Author: ${e.author_character_name}  |  Scope: ${scope}`);
    if (e.source_scene_id) lines.push(`Source: ${e.source_scene_id}`);
    if (tagStr) lines.push(`Tags: ${tagStr}`);
    lines.push('');
    lines.push(String(e.body || '').trim());
    lines.push('');
  }
  return lines.join('\n');
}

function buildRulesSection(sections) {
  return sections.map(s =>
    `===== RULES SOURCE: ${s.id}  (${s.label}) =====\n${s.content}\n`
  ).join('\n');
}

function buildDramatisSection(profiles, isGmCaller) {
  if (!profiles.length) return '(No revealed dossiers available.)';
  const lines = [];
  for (const p of profiles) {
    lines.push(`--- DOSSIER key=${p.npc_key} ---`);
    lines.push(`Name: ${p.name}` + (p.species ? `  |  Species: ${p.species}` : '') + (p.role ? `  |  Role: ${p.role}` : ''));
    lines.push(`Status: ${p.status || 'unknown'}`);
    if (Array.isArray(p.traits) && p.traits.length) {
      lines.push(`Known Traits: ${p.traits.join(', ')}`);
    }
    if (Array.isArray(p.connections) && p.connections.length) {
      lines.push(`Affiliations: ${p.connections.join(', ')}`);
    }
    if (p.player_bio) {
      lines.push('');
      lines.push('Bio (player-visible):');
      lines.push(String(p.player_bio).trim());
    }
    if (isGmCaller && p.gm_notes) {
      lines.push('');
      lines.push('GM Notes (private):');
      lines.push(String(p.gm_notes).trim());
    }
    if (p.timeline && p.timeline.length) {
      lines.push('');
      lines.push('Timeline:');
      for (const t of p.timeline) {
        const ref = [t.adventure_ref, t.scene_ref].filter(Boolean).join(' / ');
        lines.push(`  - ${ref ? '[' + ref + '] ' : ''}${t.event_text}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

function buildPrompt({ characterName, scope, question, journalEntries, rulesSections, dramatisProfiles, isGmCaller }) {
  const useJournal = scope === 'crew' || scope === 'both';
  const useRules   = scope === 'rules' || scope === 'both';
  const useDramatis = scope === 'crew' || scope === 'both';

  const persona = `You are a Protocol Droid serving the crew. You speak in-character: courteous, slightly formal, with a touch of dry wit. You address ${characterName || 'the operator'} respectfully.`;

  const rules = [
    'You have three memory banks: CREW LOGS (the character\'s personal journal — private + crew entries they can see), DRAMATIS PERSONAE (curated dossiers on known NPCs the crew has encountered — these are authoritative for who an NPC is, their species, role, status, traits, affiliations, and timeline of encounters), and STANDARD PROTOCOL (the official rules, lore, gear, weapons, maneuvers, NPC archetypes for the Fulcrum / Edge of the Empire game system).',
    'For questions about a specific NPC, prefer the DRAMATIS dossier as the canonical fact source, then enrich with relevant CREW LOGS for the crew\'s direct experience and quotes.',
    'Answer ONLY using information found in the provided memory banks.',
    'If the answer is not in the available memory, say so plainly and offer what is available adjacent. Do NOT invent facts, NPCs, dates, locations, or rules.',
    '',
    'EVALUATIVE QUESTIONS: If the operator asks for an opinion, judgment, recommendation, or assessment (e.g. "can he be trusted?", "is this safe?", "what should we do?", "compare X and Y"), you MUST first state the relevant facts from the cited evidence, then close with a short Assessment paragraph beginning with "Assessment:". The Assessment must reason strictly from the cited evidence — never speculate beyond it. Acknowledge ambiguity where the evidence is thin.',
    '',
    'CITATIONS: Cite ONLY the entries or rules sources whose content materially appears in your answer. Do not list everything you skimmed. Aim for 1-5 sources unless the question genuinely spans more.',
    'CITATION COLLAPSE: If you would otherwise cite three or more sibling sources of the same family (e.g. multiple vocations\' Edge tables, multiple weapons\' damage rows, multiple species entries), collapse them into ONE summary citation rather than listing each. Pick the single most representative refId and write the label as a family summary (e.g. "Vocation Edge variants", "Heavy pistol damage rows").',
    'FORMATTING: You MAY use light Markdown — **bold** for names and key terms, single-asterisk *italic* for emphasis, and "- " bullet lists when comparing items or listing options. Do NOT use headers (#), tables, or code fences.',
    'Each citation goes in the "sources" array as one of:',
    '  { "type": "journal",  "refId": <entry id from CREW LOGS>, "label": "<2-6 word topic, NOT the verbatim entry title>" }',
    '  { "type": "dramatis", "refId": "<npc_key from DRAMATIS, e.g. varth>", "label": "<2-6 word topic, e.g. Varth dossier — bio>" }',
    '  { "type": "rules",    "refId": "<rules source id, e.g. gamesystem>", "label": "<2-6 word reference, e.g. Symmetric Resolution>" }',
    'The label is what the player sees on a chip — make it a useful summary of WHY this source supports your answer (e.g. "Varth\'s prison survival", "Trust pitch — routing data", "Aim maneuver bonuses"). Never copy the full entry title.',
    '',
    'Keep answers concise (3-8 sentences for factual recall, up to ~12 sentences when an Assessment is required).',
    'Return ONLY a JSON object with shape: { "answer": string, "sources": [...] }. No other text.',
  ].join('\n');

  const banks = [];
  if (useDramatis) {
    banks.push('===== MEMORY BANK: DRAMATIS PERSONAE =====');
    banks.push(buildDramatisSection(dramatisProfiles || [], !!isGmCaller));
  }
  if (useJournal) {
    banks.push('===== MEMORY BANK: CREW LOGS =====');
    banks.push(buildJournalSection(journalEntries));
  }
  if (useRules) {
    banks.push('===== MEMORY BANK: STANDARD PROTOCOL =====');
    banks.push(buildRulesSection(rulesSections));
  }

  return [
    persona,
    '',
    '== OPERATING RULES ==',
    rules,
    '',
    banks.join('\n\n'),
    '',
    '== OPERATOR QUESTION ==',
    `From: ${characterName || 'Unknown'}`,
    `Scope: ${scope}`,
    `Question: ${question}`,
  ].join('\n');
}

router.get('/protocol-droid/characters', async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, name FROM characters
      WHERE character_data IS NOT NULL AND name IS NOT NULL AND name != ''
      ORDER BY slot_index ASC
    `);
    res.json({ characters: r.rows });
  } catch (e) {
    console.error('[protocol-droid/characters]', e);
    res.status(500).json({ error: 'Failed to load characters.' });
  }
});

// --- Per-character cooldown (3 min) ---
const COOLDOWN_MS = 3 * 60 * 1000;
const _lastAskAt = new Map(); // characterName(lc) -> ms

function cooldownKey(name) {
  return String(name || '').trim().toLowerCase() || '__anon__';
}
function cooldownRemainingMs(name) {
  const last = _lastAskAt.get(cooldownKey(name));
  if (!last) return 0;
  const rem = COOLDOWN_MS - (Date.now() - last);
  return rem > 0 ? rem : 0;
}

router.get('/protocol-droid/cooldown', (req, res) => {
  const name = req.query.characterName;
  const remainingMs = cooldownRemainingMs(name);
  res.json({ remainingMs, cooldownMs: COOLDOWN_MS });
});

// --- Settings (kill switch) ---
async function isDroidDisabled() {
  try {
    const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'protocol_droid_disabled'`);
    return r.rows.length && r.rows[0].value === 'true';
  } catch (_e) { return false; }
}

router.get('/protocol-droid/admin/state', async (req, res) => {
  try {
    const disabled = await isDroidDisabled();
    const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM protocol_droid_pins`);
    res.json({ disabled, totalPins: cnt.rows[0].n });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read state.' });
  }
});

router.post('/protocol-droid/admin/disable', async (req, res) => {
  try {
    const disabled = !!(req.body && req.body.disabled);
    await pool.query(`
      INSERT INTO app_settings (key, value) VALUES ('protocol_droid_disabled', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [disabled ? 'true' : 'false']);
    res.json({ ok: true, disabled });
  } catch (e) {
    console.error('[protocol-droid/admin/disable]', e);
    res.status(500).json({ error: 'Failed to update.' });
  }
});

router.post('/protocol-droid/ask', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' });
  if (await isDroidDisabled()) {
    return res.status(503).json({ error: 'The droid is offline by order of the GM.', disabled: true });
  }

  const { characterName, scope, question } = req.body || {};
  const q = (question || '').toString().trim();
  const sc = ['crew', 'rules', 'both'].includes(scope) ? scope : 'both';
  if (!q) return res.status(400).json({ error: 'question is required.' });
  if (q.length > 1000) return res.status(400).json({ error: 'question too long (max 1000 chars).' });

  const isGmCaller = (req.cookies && req.cookies.eote_role === 'gm');

  // Cooldown enforcement (GM bypass for testing).
  if (!isGmCaller) {
    const remainingMs = cooldownRemainingMs(characterName);
    if (remainingMs > 0) {
      return res.status(429).json({
        error: 'The droid is still processing your prior request. Stay focused on the scene.',
        cooldown: true,
        remainingMs,
        cooldownMs: COOLDOWN_MS,
      });
    }
  }

  try {
    const wantCrew = (sc === 'crew' || sc === 'both');
    const [journalEntries, dramatisProfiles] = await Promise.all([
      wantCrew ? loadJournalCorpus(characterName) : Promise.resolve([]),
      wantCrew ? loadDramatisCorpus(isGmCaller)   : Promise.resolve([]),
    ]);
    const wantRules = (sc === 'rules' || sc === 'both');
    const rulesPick = wantRules
      ? selectRulesSections(q)
      : { sections: [], selected: 0, total: 0, mode: 'skipped' };
    const rulesSections = rulesPick.sections;

    const prompt = buildPrompt({
      characterName, scope: sc, question: q,
      journalEntries, rulesSections, dramatisProfiles, isGmCaller,
    });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    });

    const t0 = Date.now();
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 45000)),
    ]);
    const text = result.response.text();
    const elapsedMs = Date.now() - t0;

    // Stamp the cooldown only on a successful generation (errors don't burn the user's window).
    if (!isGmCaller) _lastAskAt.set(cooldownKey(characterName), Date.now());

    let parsed;
    try { parsed = JSON.parse(text); }
    catch (_e) {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (__) {} }
    }
    if (!parsed || typeof parsed.answer !== 'string') {
      console.error('[protocol-droid] unparseable response:', text.slice(0, 400));
      return res.status(502).json({ error: 'The droid returned static. Please ask again.' });
    }

    res.json({
      answer: parsed.answer,
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      meta: {
        scope: sc,
        characterName: characterName || null,
        journalEntryCount: journalEntries.length,
        dramatisProfileCount: dramatisProfiles.length,
        rulesSectionCount: rulesSections.length,
        rulesSelected: rulesPick.selected,
        rulesTotal: rulesPick.total,
        rulesMode: rulesPick.mode,
        promptChars: prompt.length,
        elapsedMs,
      },
      cooldown: {
        cooldownMs: COOLDOWN_MS,
        remainingMs: isGmCaller ? 0 : COOLDOWN_MS,
      },
    });
  } catch (e) {
    console.error('[protocol-droid/ask]', e);
    if (String(e.message).includes('TIMEOUT')) {
      return res.status(504).json({ error: 'The droid is still processing. Please try again.' });
    }
    res.status(500).json({ error: 'Droid malfunction: ' + e.message });
  }
});

// --- Pinned answers (persistent) ---
router.get('/protocol-droid/pins', async (req, res) => {
  try {
    const name = (req.query.characterName || '').toString().trim();
    const params = [];
    let where = '';
    if (name) { where = 'WHERE character_name = $1'; params.push(name); }
    const r = await pool.query(`
      SELECT id, character_name, scope, question, answer, sources, meta, created_at
      FROM protocol_droid_pins
      ${where}
      ORDER BY created_at DESC
      LIMIT 200
    `, params);
    res.json({ pins: r.rows });
  } catch (e) {
    console.error('[protocol-droid/pins:list]', e);
    res.status(500).json({ error: 'Failed to load pins.' });
  }
});

const PIN_CAP_PER_CHARACTER = 10;
const PIN_ANSWER_MAX = 16000;

router.post('/protocol-droid/pins', async (req, res) => {
  try {
    const { characterName, scope, question, answer, sources, meta } = req.body || {};
    const name = (characterName || '').toString().trim();
    const q = (question || '').toString().trim();
    const a = (answer || '').toString();
    if (!name) return res.status(400).json({ error: 'characterName is required.' });
    if (!q || !a) return res.status(400).json({ error: 'question and answer are required.' });
    if (a.length > PIN_ANSWER_MAX) return res.status(400).json({ error: 'Answer too large to pin.' });
    const sc = ['crew', 'rules', 'both'].includes(scope) ? scope : 'both';

    // Pin cap.
    const cnt = await pool.query(
      `SELECT COUNT(*)::int AS n FROM protocol_droid_pins WHERE character_name = $1`,
      [name]
    );
    if (cnt.rows[0].n >= PIN_CAP_PER_CHARACTER) {
      return res.status(409).json({
        error: 'Pin memory full (' + PIN_CAP_PER_CHARACTER + ' max). Unpin or send one to your journal first.',
        cap: PIN_CAP_PER_CHARACTER,
        current: cnt.rows[0].n,
      });
    }

    const r = await pool.query(`
      INSERT INTO protocol_droid_pins (character_name, scope, question, answer, sources, meta)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      RETURNING id, created_at
    `, [name, sc, q, a, JSON.stringify(sources || []), JSON.stringify(meta || {})]);
    res.json({
      ok: true,
      id: r.rows[0].id,
      created_at: r.rows[0].created_at,
      remainingSlots: PIN_CAP_PER_CHARACTER - (cnt.rows[0].n + 1),
    });
  } catch (e) {
    console.error('[protocol-droid/pins:create]', e);
    res.status(500).json({ error: 'Failed to pin answer.' });
  }
});

// Promote a pinned answer to a journal entry. Auto-tags using sources + journal_tags lookup.
router.post('/protocol-droid/pins/:id/to-journal', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id.' });
  const visibility = (req.body && req.body.visibility === 'crew') ? 'crew' : null;
  const client = await pool.connect();
  try {
    const pinR = await client.query(
      `SELECT character_name, scope, question, answer, sources FROM protocol_droid_pins WHERE id = $1`,
      [id]
    );
    if (!pinR.rows.length) return res.status(404).json({ error: 'Pin not found.' });
    const pin = pinR.rows[0];
    const vis = visibility || pin.character_name; // default: private to author

    // Build entry body.
    const titleBase = pin.question.length > 70 ? pin.question.slice(0, 67) + '…' : pin.question;
    const title = 'Droid: ' + titleBase;
    const sourceLines = (Array.isArray(pin.sources) ? pin.sources : []).map(function (s) {
      return '• [' + (s.type || 'src') + '] ' + (s.label || s.refId || '');
    });
    const body =
      'Question: ' + pin.question + '\n\n' +
      pin.answer +
      (sourceLines.length ? '\n\n— Sources —\n' + sourceLines.join('\n') : '') +
      '\n\n(Saved from Protocol Droid)';

    await client.query('BEGIN');

    const entryR = await client.query(
      `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id, visibility)
       VALUES ($1, $2, $3, NULL, $4)
       RETURNING id`,
      [title, body, pin.character_name, vis]
    );
    const entryId = entryR.rows[0].id;

    // Auto-tag: ensure a 'protocol-droid' custom tag and attach.
    const protoTagR = await client.query(
      `INSERT INTO journal_tags (name, category, is_custom)
       VALUES ('protocol-droid', 'custom', true)
       ON CONFLICT (name, category) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    await client.query(
      `INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [entryId, protoTagR.rows[0].id]
    );

    // Auto-tag: any existing journal_tag whose name appears in question or answer (NPCs, locations, lore).
    const haystack = (pin.question + '\n' + pin.answer).toLowerCase();
    const tagsR = await client.query(`SELECT id, name FROM journal_tags WHERE category IN ('npc','location','lore','item')`);
    for (const t of tagsR.rows) {
      if (!t.name) continue;
      const needle = String(t.name).toLowerCase();
      if (needle.length < 3) continue;
      if (haystack.indexOf(needle) >= 0) {
        await client.query(
          `INSERT INTO journal_entry_tags (entry_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [entryId, t.id]
        );
      }
    }

    // Remove the pin (it now lives in the journal).
    await client.query(`DELETE FROM protocol_droid_pins WHERE id = $1`, [id]);

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.emit('journal:updated', { entryId });

    res.json({ ok: true, entryId, visibility: vis });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[protocol-droid/pins:to-journal]', e);
    res.status(500).json({ error: 'Failed to send to journal.' });
  } finally {
    client.release();
  }
});

router.delete('/protocol-droid/pins/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id.' });
    await pool.query('DELETE FROM protocol_droid_pins WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[protocol-droid/pins:delete]', e);
    res.status(500).json({ error: 'Failed to delete pin.' });
  }
});

module.exports = router;
