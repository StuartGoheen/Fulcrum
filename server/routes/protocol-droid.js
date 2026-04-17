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
    'Each citation goes in the "sources" array as one of:',
    '  { "type": "journal",  "refId": <entry id from CREW LOGS>, "label": "<2-6 word topic, NOT the verbatim entry title>" }',
    '  { "type": "dramatis", "refId": "<npc_key from DRAMATIS, e.g. varth>", "label": "<2-6 word topic, e.g. Varth dossier — bio>" }',
    '  { "type": "rules",    "refId": "<rules source id, e.g. gamesystem>", "label": "<2-6 word reference, e.g. Symmetric Resolution>" }',
    'The label is what the player sees on a chip — make it a useful summary of WHY this source supports your answer (e.g. "Varth\'s prison survival", "Trust pitch — routing data", "Aim maneuver bonuses"). Never copy the full entry title.',
    '',
    'Keep answers concise (3-8 sentences for factual recall, up to ~12 sentences when an Assessment is required). Use plain prose, no markdown headers.',
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

router.post('/protocol-droid/ask', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' });

  const { characterName, scope, question } = req.body || {};
  const q = (question || '').toString().trim();
  const sc = ['crew', 'rules', 'both'].includes(scope) ? scope : 'both';
  if (!q) return res.status(400).json({ error: 'question is required.' });
  if (q.length > 1000) return res.status(400).json({ error: 'question too long (max 1000 chars).' });

  const isGmCaller = (req.cookies && req.cookies.eote_role === 'gm');

  try {
    const wantCrew = (sc === 'crew' || sc === 'both');
    const [journalEntries, dramatisProfiles] = await Promise.all([
      wantCrew ? loadJournalCorpus(characterName) : Promise.resolve([]),
      wantCrew ? loadDramatisCorpus(isGmCaller)   : Promise.resolve([]),
    ]);
    const rulesSections = (sc === 'rules' || sc === 'both')
      ? loadRulesCorpus()
      : [];

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
        rulesSectionCount: rulesSections.length,
        promptChars: prompt.length,
        elapsedMs,
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

module.exports = router;
