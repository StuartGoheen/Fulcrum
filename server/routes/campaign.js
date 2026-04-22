const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { pool, seedNpcProfiles } = require('../db');
const { resolveDecisionState, applyAdventureConditionals } = require('../utils/decision-resolver');

const ADVENTURES_DIR = path.join(__dirname, '..', '..', 'data', 'adventures');
const LOCATIONS_PATH = path.join(__dirname, '..', '..', 'data', 'locations.json');
const HOLONET_PATH   = path.join(__dirname, '..', '..', 'data', 'holonet.json');
const HOLIDAYS_PATH  = path.join(__dirname, '..', '..', 'data', 'galactic-holidays.json');
const Calendar       = require('../../js/lib/galactic-calendar.js');

let _holidaysCache = null;
function loadHolidays() {
  if (_holidaysCache) return _holidaysCache;
  try { _holidaysCache = JSON.parse(fs.readFileSync(HOLIDAYS_PATH, 'utf8')); }
  catch (e) { _holidaysCache = { holidays: [] }; }
  return _holidaysCache;
}

// Resolve the absolute dayIndex of a holiday in the same year as the supplied dayIndex.
function _holidayDayIndex(h, contextYear) {
  if (h.dayOfYear) {
    return (contextYear - 1) * Calendar.DAYS_PER_YEAR + (h.dayOfYear - 1);
  }
  return Calendar.dayIndexFromDate({ year: contextYear, month: h.month, day: h.day });
}

function _findHolidayContext(dayIndex) {
  const data = loadHolidays();
  const dt = Calendar.dateFromDayIndex(dayIndex);
  let today = null;
  let upcoming = null;
  let upcomingDays = null;
  for (const h of (data.holidays || [])) {
    // Check this year and next year for a forward-looking window.
    for (const yr of [dt.year, dt.year + 1]) {
      const idx = _holidayDayIndex(h, yr);
      if (idx === dayIndex) today = h;
      // dayOfYearEnd makes it a range (Fete Weeks).
      if (h.dayOfYearEnd) {
        const startIdx = (yr - 1) * Calendar.DAYS_PER_YEAR + (h.dayOfYear - 1);
        const endIdx = (yr - 1) * Calendar.DAYS_PER_YEAR + (h.dayOfYearEnd - 1);
        if (dayIndex >= startIdx && dayIndex <= endIdx) today = h;
      }
      const delta = idx - dayIndex;
      if (delta > 0 && (upcomingDays == null || delta < upcomingDays)) {
        upcoming = h;
        upcomingDays = delta;
      }
    }
  }
  return { today: today, upcoming: upcoming, upcomingDays: upcomingDays };
}

async function _readClockState() {
  const result = await pool.query(
    "SELECT key, value FROM campaign_state WHERE key IN ('current_day_index','current_hour')"
  );
  let dayIndex = Calendar.CAMPAIGN_ANCHOR_DAY_INDEX, hour = 8;
  for (const r of result.rows) {
    const n = parseInt(r.value, 10);
    if (!isNaN(n)) {
      if (r.key === 'current_day_index') dayIndex = n;
      else if (r.key === 'current_hour') hour = n;
    }
  }
  return { dayIndex: dayIndex, hour: hour };
}

function _renderClockResponse(state) {
  const all = Calendar.renderAll(state.dayIndex, state.hour);
  const ctx = _findHolidayContext(state.dayIndex);
  return Object.assign({}, all, {
    holiday: ctx.today,
    upcomingHoliday: ctx.upcoming,
    upcomingHolidayDays: ctx.upcomingDays
  });
}

async function _writeClockState(dayIndex, hour) {
  await pool.query(`
    INSERT INTO campaign_state (key, value, updated_at)
    VALUES ('current_day_index', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [String(dayIndex)]);
  await pool.query(`
    INSERT INTO campaign_state (key, value, updated_at)
    VALUES ('current_hour', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `, [String(hour)]);
}

router.get('/campaign/clock', async (req, res) => {
  try {
    const state = await _readClockState();
    res.json(_renderClockResponse(state));
  } catch (err) {
    console.error('[GET /campaign/clock]', err);
    res.status(500).json({ error: 'Failed to load campaign clock' });
  }
});

router.get('/campaign/holidays', (req, res) => {
  try { res.json(loadHolidays()); }
  catch (err) { res.status(500).json({ error: 'Failed to load holidays' }); }
});

router.post('/campaign/clock/advance', async (req, res) => {
  if (req.userRole && req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
  try {
    const hours = parseInt(req.body && req.body.hours, 10) || 0;
    const days  = parseInt(req.body && req.body.days,  10) || 0;
    const label = (req.body && req.body.label) ? String(req.body.label).slice(0, 200) : '';
    const cur = await _readClockState();
    const next = Calendar.advance(cur, hours, days);
    await _writeClockState(next.dayIndex, next.hour);
    const payload = _renderClockResponse(next);
    payload.advanceLabel = label;
    payload.advanceHours = hours;
    payload.advanceDays = days;
    const io = req.app.get('io');
    if (io) io.emit('clock:updated', payload);
    // Task #201 — recompute and broadcast holonet ready-count after the clock moves.
    _emitHolonetQueueUpdated(io);
    res.json(payload);
  } catch (err) {
    console.error('[POST /campaign/clock/advance]', err);
    res.status(500).json({ error: 'Failed to advance clock' });
  }
});

router.post('/campaign/clock/set', async (req, res) => {
  if (req.userRole && req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
  try {
    const body = req.body || {};
    let dayIndex = (body.dayIndex != null) ? parseInt(body.dayIndex, 10) : null;
    if (dayIndex == null && body.year != null) {
      dayIndex = Calendar.dayIndexFromDate({
        year: parseInt(body.year, 10),
        month: parseInt(body.month, 10) || 1,
        day: parseInt(body.day, 10) || 1
      });
    }
    if (dayIndex == null || isNaN(dayIndex)) {
      return res.status(400).json({ error: 'dayIndex (or year/month/day) required' });
    }
    const hour = body.hour != null ? Math.max(0, Math.min(23, parseInt(body.hour, 10) || 0)) : 0;
    await _writeClockState(dayIndex, hour);
    const payload = _renderClockResponse({ dayIndex: dayIndex, hour: hour });
    const io = req.app.get('io');
    if (io) io.emit('clock:updated', payload);
    _emitHolonetQueueUpdated(io);
    res.json(payload);
  } catch (err) {
    console.error('[POST /campaign/clock/set]', err);
    res.status(500).json({ error: 'Failed to set clock' });
  }
});

let adventuresCache = null;
let adventuresCacheMtimes = {};
function loadAdventures() {
  const files = fs.readdirSync(ADVENTURES_DIR).filter(f => /^adv\d+\.json$/.test(f)).sort((a, b) => {
    const na = parseInt(a.match(/\d+/)[0], 10);
    const nb = parseInt(b.match(/\d+/)[0], 10);
    return na - nb;
  });
  let needsReload = !adventuresCache;
  if (!needsReload) {
    for (const f of files) {
      const fp = path.join(ADVENTURES_DIR, f);
      try {
        const mtime = fs.statSync(fp).mtimeMs;
        if (!adventuresCacheMtimes[f] || mtime > adventuresCacheMtimes[f]) {
          needsReload = true;
          break;
        }
      } catch (e) {
        needsReload = true;
        break;
      }
    }
  }
  if (needsReload) {
    const adventures = [];
    const newMtimes = {};
    for (const f of files) {
      const fp = path.join(ADVENTURES_DIR, f);
      try {
        const content = fs.readFileSync(fp, 'utf8').trim();
        if (!content) { console.warn('[loadAdventures] Skipping empty file:', f); continue; }
        adventures.push(JSON.parse(content));
        newMtimes[f] = fs.statSync(fp).mtimeMs;
      } catch (parseErr) {
        console.error('[loadAdventures] Failed to parse', f, parseErr.message);
      }
    }
    adventuresCache = { adventures };
    adventuresCacheMtimes = newMtimes;
  }
  return adventuresCache;
}

let locationsCache = null;
let locationsCacheMtime = 0;
function loadLocations() {
  try {
    const stat = fs.statSync(LOCATIONS_PATH);
    const mtime = stat.mtimeMs;
    if (!locationsCache || mtime > locationsCacheMtime) {
      locationsCache = JSON.parse(fs.readFileSync(LOCATIONS_PATH, 'utf8'));
      locationsCacheMtime = mtime;
    }
  } catch (e) {
    if (!locationsCache) {
      locationsCache = JSON.parse(fs.readFileSync(LOCATIONS_PATH, 'utf8'));
    }
  }
  return locationsCache;
}

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/campaign/state', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM campaign_state');
    const state = result.rows.reduce((acc, row) => {
      try { acc[row.key] = JSON.parse(row.value); }
      catch { acc[row.key] = row.value; }
      return acc;
    }, {});
    res.json({ state });
  } catch (err) {
    console.error('[GET /campaign/state]', err);
    res.status(500).json({ error: 'Failed to load campaign state.' });
  }
});

router.get('/campaign/adventures', async (req, res) => {
  try {
    const data = loadAdventures();
    const decisionState = await resolveDecisionState();
    const adapted = {
      adventures: data.adventures.map(adv => applyAdventureConditionals(adv, decisionState))
    };
    adapted._decisionState = decisionState;
    res.json(adapted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load adventures', detail: err.message });
  }
});

router.get('/campaign/adventures/:adventureId', async (req, res) => {
  try {
    const data = loadAdventures();
    const adv = data.adventures.find(a => a.id === req.params.adventureId);
    if (!adv) return res.status(404).json({ error: 'Adventure not found' });
    const decisionState = await resolveDecisionState();
    const adapted = applyAdventureConditionals(adv, decisionState);
    adapted._decisionState = decisionState;
    res.json(adapted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load adventure', detail: err.message });
  }
});

router.get('/campaign/adventures/:adventureId/marks', async (req, res) => {
  try {
    const data = loadAdventures();
    const adv = data.adventures.find(a => a.id === req.params.adventureId);
    if (!adv) return res.status(404).json({ error: 'Adventure not found' });
    const marks = adv.marks || [];
    const { rows: revealed } = await pool.query(
      'SELECT mark_id FROM revealed_marks WHERE adventure_id = $1',
      [req.params.adventureId]
    );
    const revealedSet = new Set(revealed.map(r => r.mark_id));
    const result = marks.map(m => ({
      id: m.id,
      label: m.label,
      desc: m.desc,
      hidden: m.hidden && !revealedSet.has(m.id)
    }));
    res.json({ ok: true, adventureId: req.params.adventureId, marks: result });
  } catch (err) {
    console.error('[marks] Error loading adventure marks:', err);
    res.status(500).json({ error: 'Failed to load adventure marks' });
  }
});

router.post('/campaign/adventures/:adventureId/marks/:markId/reveal', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO revealed_marks (adventure_id, mark_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.adventureId, req.params.markId]
    );
    res.json({ ok: true, adventureId: req.params.adventureId, markId: req.params.markId });
  } catch (err) {
    console.error('[marks] Error revealing mark:', err);
    res.status(500).json({ error: 'Failed to reveal mark' });
  }
});

router.post('/campaign/adventures/:adventureId/marks/:markId/hide', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM revealed_marks WHERE adventure_id = $1 AND mark_id = $2',
      [req.params.adventureId, req.params.markId]
    );
    res.json({ ok: true, adventureId: req.params.adventureId, markId: req.params.markId });
  } catch (err) {
    console.error('[marks] Error hiding mark:', err);
    res.status(500).json({ error: 'Failed to hide mark' });
  }
});

router.get('/campaign/locations', (req, res) => {
  try {
    const data = loadLocations();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load locations', detail: err.message });
  }
});

router.get('/campaign/locations/:locationId', (req, res) => {
  try {
    const data = loadLocations();
    const loc = data.locations.find(l => l.id === req.params.locationId);
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    res.json(loc);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load location', detail: err.message });
  }
});

router.get('/campaign/progress', async (req, res) => {
  try {
    const progressResult = await pool.query('SELECT * FROM campaign_progress WHERE id = 1');
    const completionsResult = await pool.query('SELECT scene_id, completed, completed_at, gm_notes FROM scene_completion');
    const completionMap = {};
    completionsResult.rows.forEach(c => { completionMap[c.scene_id] = c; });
    const progress = progressResult.rows.length > 0 ? progressResult.rows[0] : { adventure_id: 'adv1', part_id: 'adv1-p1', scene_id: 'adv1-p1-s1' };
    res.json({ progress, completions: completionMap });
  } catch (err) {
    console.error('[GET /campaign/progress]', err);
    res.status(500).json({ error: 'Failed to load progress.' });
  }
});

router.put('/campaign/progress', async (req, res) => {
  const { adventure_id, part_id, scene_id } = req.body;
  if (!adventure_id || !part_id || !scene_id) {
    return res.status(400).json({ error: 'adventure_id, part_id, and scene_id are required' });
  }
  try {
    const data = loadAdventures();
    const adv = data.adventures.find(a => a.id === adventure_id);
    if (!adv) return res.status(400).json({ error: 'Invalid adventure_id' });
    const part = (adv.parts || []).find(p => p.id === part_id);
    if (!part) return res.status(400).json({ error: 'Invalid part_id' });
    const scene = (part.scenes || []).find(s => s.id === scene_id);
    if (!scene) return res.status(400).json({ error: 'Invalid scene_id' });
  } catch (err) {
    return res.status(500).json({ error: 'Validation failed', detail: err.message });
  }

  try {
    await pool.query(`
      INSERT INTO campaign_progress (id, adventure_id, part_id, scene_id, updated_at)
      VALUES (1, $1, $2, $3, NOW())
      ON CONFLICT(id) DO UPDATE SET
        adventure_id = EXCLUDED.adventure_id,
        part_id = EXCLUDED.part_id,
        scene_id = EXCLUDED.scene_id,
        updated_at = NOW()
    `, [adventure_id, part_id, scene_id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /campaign/progress]', err);
    res.status(500).json({ error: 'Failed to update progress.' });
  }
});

router.put('/campaign/scene/:sceneId/complete', async (req, res) => {
  const { sceneId } = req.params;
  const { completed, gm_notes } = req.body;
  const isComplete = completed ? 1 : 0;
  try {
    await pool.query(`
      INSERT INTO scene_completion (scene_id, completed, completed_at, gm_notes)
      VALUES ($1, $2, NOW(), $3)
      ON CONFLICT(scene_id) DO UPDATE SET
        completed = EXCLUDED.completed,
        completed_at = CASE WHEN EXCLUDED.completed = 1 THEN NOW() ELSE NULL END,
        gm_notes = COALESCE(EXCLUDED.gm_notes, scene_completion.gm_notes)
    `, [sceneId, isComplete, gm_notes || null]);

    if (isComplete) {
      try {
        const { extractTagsFromScene, createSceneJournalEntry } = require('./journal');
        await extractTagsFromScene(sceneId);
        await createSceneJournalEntry(sceneId);
      } catch (tagErr) {
        console.error('[scene/complete] Tag extraction / journal entry failed (non-fatal):', tagErr.message);
      }
    }

    const io = req.app.get('io');
    if (io) io.emit('journal:updated', { sceneId, completed: !!isComplete });

    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /campaign/scene/complete]', err);
    res.status(500).json({ error: 'Failed to update scene.' });
  }
});

function findSceneById(data, sceneId) {
  for (const adv of data.adventures) {
    for (const part of (adv.parts || [])) {
      for (const scene of (part.scenes || [])) {
        if (scene.id === sceneId) return scene;
      }
    }
  }
  return null;
}

function writeAdventures(data) {
  for (const adv of data.adventures) {
    const filename = 'adv' + adv.number + '.json';
    const fp = path.join(ADVENTURES_DIR, filename);
    fs.writeFileSync(fp, JSON.stringify(adv, null, 2), 'utf8');
    adventuresCacheMtimes[filename] = Date.now();
  }
  adventuresCache = data;
}

router.put('/campaign/scene/:sceneId/npc/:npcIndex', (req, res) => {
  const { sceneId, npcIndex } = req.params;
  const idx = parseInt(npcIndex, 10);
  const updatedNpc = req.body;
  if (!updatedNpc || typeof updatedNpc !== 'object') {
    return res.status(400).json({ error: 'NPC data required' });
  }
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.npcs || idx < 0 || idx >= scene.npcs.length) {
      return res.status(404).json({ error: 'NPC index out of range' });
    }
    scene.npcs[idx] = updatedNpc;
    writeAdventures(data);
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /campaign/scene/npc]', err);
    res.status(500).json({ error: 'Failed to update NPC', detail: err.message });
  }
});

router.post('/campaign/scene/:sceneId/npc', (req, res) => {
  const { sceneId } = req.params;
  const newNpc = req.body;
  if (!newNpc || typeof newNpc !== 'object') {
    return res.status(400).json({ error: 'NPC data required' });
  }
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.npcs) scene.npcs = [];
    scene.npcs.push(newNpc);
    writeAdventures(data);
    res.json({ success: true, index: scene.npcs.length - 1 });
  } catch (err) {
    console.error('[POST /campaign/scene/npc]', err);
    res.status(500).json({ error: 'Failed to add NPC', detail: err.message });
  }
});

router.delete('/campaign/scene/:sceneId/npc/:npcIndex', (req, res) => {
  const { sceneId, npcIndex } = req.params;
  const idx = parseInt(npcIndex, 10);
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.npcs || idx < 0 || idx >= scene.npcs.length) {
      return res.status(404).json({ error: 'NPC index out of range' });
    }
    scene.npcs.splice(idx, 1);
    writeAdventures(data);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /campaign/scene/npc]', err);
    res.status(500).json({ error: 'Failed to remove NPC', detail: err.message });
  }
});

const ALLOWED_ESCALATION_ACTIONS = ['applyCondition', 'removeCondition', 'damage', 'spawn', 'narrate'];

function _sanitizeEscalationAction(act) {
  if (!act || typeof act !== 'object') return null;
  if (ALLOWED_ESCALATION_ACTIONS.indexOf(act.type) === -1) return null;
  const out = { type: act.type };
  if (act.type === 'applyCondition' || act.type === 'removeCondition') {
    if (!Array.isArray(act.targets) || !act.targets.length) return null;
    if (!Array.isArray(act.conditions) || !act.conditions.length) return null;
    out.targets = act.targets.map(String);
    out.conditions = act.conditions.map(String);
    if (act.type === 'applyCondition') {
      if (act.duration) out.duration = String(act.duration);
      if (act.arena) out.arena = String(act.arena);
    }
  } else if (act.type === 'damage') {
    if (!Array.isArray(act.targets) || !act.targets.length) return null;
    const amt = parseInt(act.amount, 10);
    if (!(amt > 0)) return null;
    out.targets = act.targets.map(String);
    out.amount = amt;
  } else if (act.type === 'spawn') {
    const npc = act.npc || act.template;
    if (!npc) return null;
    out.npc = String(npc);
    out.count = Math.max(1, parseInt(act.count, 10) || 1);
    if (act.zone) out.zone = String(act.zone);
  } else if (act.type === 'narrate') {
    const text = act.text != null ? String(act.text).trim() : '';
    if (!text) return null;
    out.text = text;
  }
  if (act.note && act.type !== 'narrate') out.note = String(act.note);
  return out;
}

function _sanitizeEscalationEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const round = parseInt(entry.round, 10);
  if (!(round >= 1)) return null;
  const rawActions = Array.isArray(entry.actions) ? entry.actions : [];
  const actions = rawActions.map(_sanitizeEscalationAction).filter(Boolean);
  if (!actions.length) return null;
  return { round, actions };
}

router.put('/campaign/scene/:sceneId/encounter/:encIndex/escalation', (req, res) => {
  // In no-auth dev mode, gate() does not set req.userRole. In auth mode,
  // gate() blocks player role from /api/campaign writes before we get here.
  if (req.userRole && req.userRole !== 'gm') {
    return res.status(403).json({ error: 'GM access required.' });
  }
  const { sceneId, encIndex } = req.params;
  const idx = parseInt(encIndex, 10);
  if (!Number.isFinite(idx) || idx < 0) {
    return res.status(400).json({ error: 'Invalid encounter index' });
  }
  const script = req.body && req.body.scriptedEscalation;
  if (!Array.isArray(script)) {
    return res.status(400).json({ error: 'scriptedEscalation array required' });
  }
  const cleanScript = script.map(_sanitizeEscalationEntry).filter(Boolean);
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.encounters || idx < 0 || idx >= scene.encounters.length) {
      return res.status(404).json({ error: 'Encounter index out of range' });
    }
    if (cleanScript.length === 0) {
      delete scene.encounters[idx].scriptedEscalation;
    } else {
      scene.encounters[idx].scriptedEscalation = cleanScript;
    }
    writeAdventures(data);
    res.json({ success: true, scriptedEscalation: cleanScript });
  } catch (err) {
    console.error('[PUT /campaign/scene/encounter/escalation]', err);
    res.status(500).json({ error: 'Failed to update escalation script', detail: err.message });
  }
});

router.put('/campaign/scene/:sceneId/encounter/:encounterId/scripted-escalation', (req, res) => {
  if (req.userRole && req.userRole !== 'gm') {
    return res.status(403).json({ error: 'GM access required.' });
  }
  const { sceneId, encounterId } = req.params;
  const script = req.body && req.body.scriptedEscalation;
  if (!Array.isArray(script)) {
    return res.status(400).json({ error: 'scriptedEscalation array required' });
  }
  const cleanScript = script.map(_sanitizeEscalationEntry).filter(Boolean);
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    const enc = (scene.encounters || []).find(e => e.id === encounterId);
    if (!enc) return res.status(404).json({ error: 'Encounter not found' });
    if (cleanScript.length === 0) {
      delete enc.scriptedEscalation;
    } else {
      enc.scriptedEscalation = cleanScript;
    }
    writeAdventures(data);
    res.json({ success: true, scriptedEscalation: cleanScript });
  } catch (err) {
    console.error('[PUT /campaign/scene/encounter/scripted-escalation]', err);
    res.status(500).json({ error: 'Failed to update scripted escalation', detail: err.message });
  }
});

router.put('/campaign/scene/:sceneId/positions', (req, res) => {
  const { sceneId } = req.params;
  const positions = req.body;
  if (!positions || typeof positions !== 'object') {
    return res.status(400).json({ error: 'Positions data required' });
  }
  try {
    const data = loadAdventures();
    const scene = findSceneById(data, sceneId);
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (!scene.tacticalMap) scene.tacticalMap = {};
    scene.tacticalMap.gmStartingPositions = positions;
    writeAdventures(data);
    res.json({ success: true });
  } catch (err) {
    console.error('[PUT /campaign/scene/positions]', err);
    res.status(500).json({ error: 'Failed to update positions', detail: err.message });
  }
});

router.get('/campaign/lore-tags', (req, res) => {
  try {
    const data = loadAdventures();
    const tagMap = {};
    data.adventures.forEach(adv => {
      (adv.parts || []).forEach(part => {
        (part.scenes || []).forEach(scene => {
          (scene.loreTags || []).forEach(tag => {
            if (!tagMap[tag]) tagMap[tag] = [];
            tagMap[tag].push({
              sceneId: scene.id,
              sceneTitle: scene.title,
              adventureId: adv.id,
              adventureTitle: adv.title,
              adventureNumber: adv.number,
              partTitle: part.title,
              partNumber: part.number,
              sceneNumber: scene.number
            });
          });
        });
      });
    });
    res.json({ tags: tagMap });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build lore tags', detail: err.message });
  }
});

router.get('/campaign/lore-tags/:tag', (req, res) => {
  try {
    const data = loadAdventures();
    const tag = decodeURIComponent(req.params.tag);
    const scenes = [];
    data.adventures.forEach(adv => {
      (adv.parts || []).forEach(part => {
        (part.scenes || []).forEach(scene => {
          if ((scene.loreTags || []).includes(tag)) {
            scenes.push({
              sceneId: scene.id,
              sceneTitle: scene.title,
              adventureId: adv.id,
              adventureTitle: adv.title,
              adventureNumber: adv.number,
              partTitle: part.title,
              partNumber: part.number,
              sceneNumber: scene.number
            });
          }
        });
      });
    });
    res.json({ tag, scenes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to query lore tag', detail: err.message });
  }
});

const ARENA_META = [
  { id: 'physique', disciplines: ['athletics','brawl','endure','melee','heavy_weapons'] },
  { id: 'reflex', disciplines: ['evasion','piloting','ranged','skulduggery','stealth'] },
  { id: 'grit', disciplines: ['beast_handling','intimidate','resolve','survival','control_spark'] },
  { id: 'wits', disciplines: ['investigation','medicine','tactics','tech','sense_spark'] },
  { id: 'presence', disciplines: ['charm','deception','insight','persuasion','alter_spark'] },
];

const CHALLENGE_CLUSTERS = {
  social:        ['charm','deception','insight','persuasion','intimidate'],
  combat:        ['ranged','brawl','melee','evasion','heavy_weapons','tactics'],
  infiltration:  ['stealth','skulduggery','deception','tech','evasion'],
  survival:      ['survival','athletics','endure','medicine','beast_handling'],
  technical:     ['tech','piloting','investigation','medicine','skulduggery'],
  force:         ['control_spark','sense_spark','alter_spark','resolve','insight'],
};

const DIE_ORDER = ['D4','D6','D8','D10','D12'];

function dieRank(d) {
  const idx = DIE_ORDER.indexOf((d || '').toUpperCase());
  return idx === -1 ? 0 : idx;
}

const WEAPONS_PATH = path.join(__dirname, '..', '..', 'data', 'weapons.json');
const ARMOR_PATH = path.join(__dirname, '..', '..', 'data', 'armor.json');
const GEAR_PATH = path.join(__dirname, '..', '..', 'data', 'gear.json');
const DESTINIES_PATH = path.join(__dirname, '..', '..', 'data', 'destinies.json');
const PHASES_PATH = path.join(__dirname, '..', '..', 'data', 'phases.json');
const SPECIES_PATH = path.join(__dirname, '..', '..', 'data', 'species.json');

let equipmentCache = null;
function loadEquipment() {
  if (!equipmentCache) {
    const weapons = JSON.parse(fs.readFileSync(WEAPONS_PATH, 'utf8'));
    const armor = JSON.parse(fs.readFileSync(ARMOR_PATH, 'utf8'));
    const gear = JSON.parse(fs.readFileSync(GEAR_PATH, 'utf8'));
    equipmentCache = {};
    const index = (arr) => { (Array.isArray(arr) ? arr : []).forEach(item => { if (item.id) equipmentCache[item.id] = item; }); };
    index(weapons.weapons || weapons);
    index(armor.armor || armor);
    index(gear.gear || gear);
  }
  return equipmentCache;
}

let destiniesCache = null;
function loadDestinies() {
  if (!destiniesCache) {
    const raw = JSON.parse(fs.readFileSync(DESTINIES_PATH, 'utf8'));
    destiniesCache = raw.destinies || raw;
  }
  return destiniesCache;
}

let phasesCache = null;
function loadPhases() {
  if (!phasesCache) {
    phasesCache = JSON.parse(fs.readFileSync(PHASES_PATH, 'utf8'));
  }
  return phasesCache;
}

let speciesCache = null;
function loadSpecies() {
  if (!speciesCache) {
    const raw = JSON.parse(fs.readFileSync(SPECIES_PATH, 'utf8'));
    speciesCache = Array.isArray(raw) ? raw : (raw.species || []);
  }
  return speciesCache;
}

const BACKGROUND_FAVORED = {
  'deep-fringe': 'survival', 'shadowed-levels': 'stealth', 'salvage-yards': 'tech',
  'coreward-spires': 'persuasion', 'agrarian-plain': 'resolve', 'war-front': 'evasion',
  'ancient-ruin': 'investigation', 'trading-post': 'insight', 'detention-block': 'endure',
  'shipboard-born': 'piloting', 'labor-camp': 'athletics', 'enclave': 'charm',
  'disbanded-regular': 'tactics', 'separatist-holdout': 'ranged', 'imperial-defector': 'deception',
  'blockade-runner': 'piloting', 'pacification-survivor': 'survival', 'field-medic': 'medicine',
  'syndicate-enforcer': 'intimidate', 'post-war-tracker': 'investigation', 'purge-survivor': 'stealth',
  'wreck': 'endure', 'ascent': 'persuasion', 'betrayal': 'insight',
  'shadow-stalked': 'stealth', 'hutt-marked': 'survival',
};

function extractCharacterProfile(data) {
  let destiny = null;
  const rawDest = data.destiny;
  if (rawDest) {
    const destId = typeof rawDest === 'string' ? rawDest : (rawDest.id || null);
    if (destId) {
      const destDefs = loadDestinies();
      const destDef = (Array.isArray(destDefs) ? destDefs : []).find(d => d.id === destId);
      if (destDef) {
        destiny = {
          id: destDef.id,
          name: destDef.name || destId,
          coreQuestion: destDef.coreQuestion || null,
          hopeRecovery: destDef.hopeRecovery ? { title: destDef.hopeRecovery.title || null, description: destDef.hopeRecovery.description || null } : null,
          tollRecovery: destDef.tollRecovery ? { title: destDef.tollRecovery.title || null, description: destDef.tollRecovery.description || null } : null,
        };
      } else {
        destiny = { id: destId, name: destId, coreQuestion: null, hopeRecovery: null, tollRecovery: null };
      }
    }
  }

  const backgroundPhases = [];
  ['phase1','phase2','phase3'].forEach(key => {
    const val = data[key];
    if (val) {
      let phaseId = null;
      let phaseTitle = null;
      if (typeof val === 'string') {
        phaseId = val.toLowerCase().replace(/\s+/g, '-').replace(/^the-/, '');
        phaseTitle = val;
      } else if (val.id || val.title || val.name) {
        phaseId = val.id || null;
        phaseTitle = val.title || val.name || null;
      }
      const favored = phaseId ? (BACKGROUND_FAVORED[phaseId] || null) : null;
      backgroundPhases.push({ phase: key, id: phaseId, title: phaseTitle, favoredDiscipline: favored });
    }
  });

  const vocations = [];
  const kitFavoredDiscs = [];
  if (data.kits && typeof data.kits === 'object' && !Array.isArray(data.kits)) {
    Object.entries(data.kits).forEach(([kitId, tier]) => {
      vocations.push({ kitId, name: null, tier: tier || 0 });
    });
  } else if (data.kits && Array.isArray(data.kits)) {
    data.kits.forEach(k => {
      vocations.push({ kitId: k.id || null, name: k.name || null, tier: k.tier || k.currentTier || 0 });
      if (k.favoredDiscipline) kitFavoredDiscs.push(k.favoredDiscipline);
    });
  }

  try {
    if (!extractCharacterProfile._kitsCache) {
      const kitsData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'kits.json'), 'utf8'));
      extractCharacterProfile._kitsCache = kitsData.kits || kitsData;
    }
    const kitsArr = extractCharacterProfile._kitsCache;
    vocations.forEach(v => {
      const kitDef = (Array.isArray(kitsArr) ? kitsArr : []).find(k => k.id === v.kitId);
      if (kitDef) {
        if (!v.name) v.name = kitDef.name || v.kitId;
        if (kitDef.favoredDiscipline) kitFavoredDiscs.push(kitDef.favoredDiscipline);
      }
    });
  } catch (e) {}

  let backgroundFavored = data.backgroundFavored || [];
  if (!backgroundFavored.length) {
    backgroundPhases.forEach(bp => {
      if (bp.id) {
        const fav = BACKGROUND_FAVORED[bp.id];
        if (fav && !backgroundFavored.includes(fav)) backgroundFavored.push(fav);
      }
    });
  }

  const SPECIES_ARENAS = {
    'Human':   { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
    "Twi'lek": { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Wookiee': { physique: 'D8', reflex: 'D4', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Duros':   { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Zabrak':  { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Kel Dor': { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D8', presence: 'D6' },
    'Togruta': { physique: 'D4', reflex: 'D8', grit: 'D6', wits: 'D6', presence: 'D6' },
    'Rodian':  { physique: 'D6', reflex: 'D8', grit: 'D6', wits: 'D6', presence: 'D4' },
    'Sullustan': { physique: 'D4', reflex: 'D6', grit: 'D6', wits: 'D8', presence: 'D6' },
    'Cathar':  { physique: 'D6', reflex: 'D6', grit: 'D8', wits: 'D4', presence: 'D6' },
  };
  const ARENA_DISC_MAP = [
    { id: 'physique', discs: ['athletics','brawl','endure','melee','heavy_weapons'] },
    { id: 'reflex', discs: ['evasion','piloting','ranged','skulduggery','stealth'] },
    { id: 'grit', discs: ['beast_handling','intimidate','resolve','survival','control_spark'] },
    { id: 'wits', discs: ['investigation','medicine','tactics','tech','sense_spark'] },
    { id: 'presence', discs: ['charm','deception','insight','persuasion','alter_spark'] },
  ];
  const DIE_STEPS = ['D4', 'D6', 'D8', 'D10', 'D12'];

  const rawSpeciesStr = typeof data.species === 'string' ? data.species : (data.species && data.species.id ? data.species.id : 'Human');
  const speciesBase = SPECIES_ARENAS[rawSpeciesStr] || SPECIES_ARENAS['Human'];
  const arenaAdj = data.arenaAdj || {};
  const discValuesMap = data.discValues || {};

  const disciplines = {};
  const arenas = {};
  ARENA_DISC_MAP.forEach(arena => {
    const baseIdx = DIE_STEPS.indexOf(speciesBase[arena.id] || 'D6');
    const adj = arenaAdj[arena.id] || 0;
    const finalIdx = Math.max(0, Math.min(DIE_STEPS.length - 1, baseIdx + adj));
    arenas[arena.id] = DIE_STEPS[finalIdx];

    arena.discs.forEach(discId => {
      const discDie = discValuesMap[discId] || 'D6';
      const isFavored = backgroundFavored.includes(discId) || kitFavoredDiscs.includes(discId);
      const isTrained = dieRank(discDie) > dieRank('D4');
      disciplines[discId] = {
        training: isTrained ? 'trained' : 'untrained',
        favored: isFavored,
        die: discDie,
      };
    });
  });

  const equipDb = loadEquipment();
  const gear = [];
  const gearSeen = {};
  const startingGear = Array.isArray(data.startingGear) ? data.startingGear : [];
  const removals = data.inventoryRemovals || {};
  const removedIds = [].concat(removals.gear || [], removals.weapons || [], Array.isArray(removals.armor) ? removals.armor : []);

  startingGear.forEach(sg => {
    if (!sg || !sg.id) return;
    if (removedIds.includes(sg.id)) return;
    gearSeen[sg.id] = true;
    const item = equipDb[sg.id];
    if (item) {
      gear.push({
        id: item.id,
        name: item.name || sg.name || 'Unknown',
        type: item.type || sg.source || 'gear',
        tags: item.tags || [],
        traits: (item.traits || []).map(t => (typeof t === 'string' ? t : t.name || '')),
        availability: item.availability || sg.legalStatus || null,
      });
    } else {
      gear.push({
        id: sg.id,
        name: sg.name || 'Unknown',
        type: sg.source || 'gear',
        tags: [],
        traits: [],
        availability: sg.legalStatus || null,
      });
    }
  });
  const purchasedIds = [].concat(data.weaponIds || [], data.armorIds || [], data.gearIds || []);
  purchasedIds.forEach(itemId => {
    if (gearSeen[itemId] || removedIds.includes(itemId)) return;
    gearSeen[itemId] = true;
    const item = equipDb[itemId];
    if (item) {
      gear.push({
        id: item.id,
        name: item.name || 'Unknown',
        type: item.type || 'gear',
        tags: item.tags || [],
        traits: (item.traits || []).map(t => (typeof t === 'string' ? t : t.name || '')),
        availability: item.availability || null,
      });
    }
  });

  const conditions = [];
  if (data.conditions && Array.isArray(data.conditions)) {
    data.conditions.forEach(c => {
      if (typeof c === 'string') conditions.push(c);
      else if (c.name) conditions.push(c.name);
    });
  }

  const vocationAbilities = [];
  vocations.forEach(v => {
    if (!extractCharacterProfile._kitsCache) return;
    const kitDef = (Array.isArray(extractCharacterProfile._kitsCache) ? extractCharacterProfile._kitsCache : []).find(k => k.id === v.kitId);
    const abilitiesList = kitDef ? (kitDef.abilities || kitDef.tiers || []) : [];
    if (Array.isArray(abilitiesList)) {
      abilitiesList.forEach(t => {
        if (t.tier <= v.tier) {
          vocationAbilities.push({ vocation: v.name || v.kitId, tier: t.tier, name: t.name || t.id, type: t.type || null });
        }
      });
    }
  });

  const knacks = [];
  const phase3Entry = backgroundPhases.find(bp => bp.phase === 'phase3');
  if (phase3Entry && phase3Entry.id) {
    try {
      const phasesData = loadPhases();
      const phase3List = phasesData.phase3 || [];
      const phase3Def = phase3List.find(p => p.id === phase3Entry.id);
      if (phase3Def && phase3Def._meta) {
        knacks.push({
          phaseId: phase3Def.id,
          knackName: phase3Def._meta.knackName || null,
          knackType: phase3Def._meta.knackType || null,
          knack: phase3Def._meta.knack || null,
        });
      }
    } catch (e) {}
  }

  let species = null;
  const rawSpecies = typeof data.species === 'string' ? data.species : (data.species && data.species.id ? data.species.id : null);
  if (rawSpecies) {
    const speciesIdNorm = rawSpecies.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/keldor/,'keldor');
    try {
      const speciesList = loadSpecies();
      const specDef = speciesList.find(s => s.id === speciesIdNorm || s.name && s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === speciesIdNorm);
      if (specDef) {
        const bioTruth = specDef.biologicalTruth;
        const spTrait = specDef.speciesTrait;
        species = {
          id: specDef.id,
          name: specDef.name || rawSpecies,
          biologicalTruth: bioTruth ? (typeof bioTruth === 'string' ? bioTruth : bioTruth.desc || bioTruth.name || null) : null,
          biologicalTruthName: bioTruth && typeof bioTruth === 'object' ? bioTruth.name || null : null,
          speciesTrait: spTrait ? (typeof spTrait === 'string' ? spTrait : spTrait.desc || spTrait.name || null) : null,
          speciesTraitName: spTrait && typeof spTrait === 'object' ? spTrait.name || null : null,
        };
      } else {
        species = { id: speciesIdNorm, name: rawSpecies, biologicalTruth: null, speciesTrait: null };
      }
    } catch (e) {}
  }

  const backgroundEnvironments = [];
  const backgroundThemes = [];
  backgroundPhases.forEach(bp => {
    if (!bp.id) return;
    try {
      const phasesData = loadPhases();
      const phaseKey = bp.phase;
      const phaseList = phasesData[phaseKey] || [];
      const phaseDef = phaseList.find(p => p.id === bp.id);
      if (phaseDef && phaseDef._meta) {
        if (phaseDef._meta.environment) {
          backgroundEnvironments.push(phaseDef._meta.environment);
        }
        if (phaseDef._meta.themes && Array.isArray(phaseDef._meta.themes)) {
          phaseDef._meta.themes.forEach(t => {
            if (!backgroundThemes.includes(t)) backgroundThemes.push(t);
          });
        }
      }
    } catch (e) {}
  });

  return { destiny, backgroundPhases, backgroundFavored, backgroundEnvironments, backgroundThemes, vocations, vocationAbilities, disciplines, arenas, gear, conditions, knacks, species };
}

router.get('/campaign/party', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, session_id, character_data
      FROM characters
      WHERE character_data IS NOT NULL AND session_id IS NOT NULL
    `);
    const party = result.rows.map(c => {
      let data = {};
      try { data = JSON.parse(c.character_data); } catch {}
      const adv = data.advancement || {};
      const earnedChecks = (adv.marks && adv.marks.earnedChecks) || {};
      const TRIGGER_VALUES = { destiny_milestone: 2 };
      let earnedMarks = 0;
      Object.entries(earnedChecks).forEach(([k, v]) => { if (v) earnedMarks += (TRIGGER_VALUES[k] || 1); });
      const totalMarks = (adv.marks && adv.marks.totalBanked || 0) + earnedMarks;

      const profile = extractCharacterProfile(data);

      return {
        id: c.id,
        name: c.name,
        connected: !!c.session_id,
        vitality: data.computed?.vitality || data.vitality || null,
        species: data.species || null,
        archetype: data.archetype || null,
        marks: totalMarks,
        destiny: profile.destiny,
        backgroundPhases: profile.backgroundPhases,
        backgroundFavored: profile.backgroundFavored,
        vocations: profile.vocations,
        vocationAbilities: profile.vocationAbilities,
        disciplines: profile.disciplines,
        arenas: profile.arenas,
        gear: profile.gear,
        conditions: profile.conditions,
      };
    });
    res.json({ party });
  } catch (err) {
    console.error('[GET /campaign/party]', err);
    res.status(500).json({ error: 'Failed to load party.' });
  }
});

router.get('/campaign/scene-intel/:sceneId', async (req, res) => {
  try {
    const { sceneId } = req.params;
    const data = loadAdventures();
    let scene = null;
    data.adventures.forEach(adv => {
      (adv.parts || []).forEach(part => {
        (part.scenes || []).forEach(s => {
          if (s.id === sceneId) scene = s;
        });
      });
    });

    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    const hasTags = scene.challengeType || (scene.destinyTags && scene.destinyTags.length) ||
      (scene.vocationTags && scene.vocationTags.length) || (scene.disciplineTags && scene.disciplineTags.length) ||
      (scene.gearFlags && scene.gearFlags.length) || (scene.knackTags && scene.knackTags.length) ||
      (scene.speciesTags && scene.speciesTags.length) || (scene.backgroundTags && scene.backgroundTags.length) ||
      (scene.themeTags && scene.themeTags.length);

    if (!hasTags) return res.json({ sceneId, hasTags: false, intel: [] });

    const result = await pool.query(`
      SELECT id, name, session_id, character_data
      FROM characters WHERE character_data IS NOT NULL AND session_id IS NOT NULL
    `);

    const intel = result.rows.map(c => {
      let cData = {};
      try { cData = JSON.parse(c.character_data); } catch {}
      const profile = extractCharacterProfile(cData);
      const insights = [];

      if (scene.destinyTags && scene.destinyTags.length && profile.destiny) {
        const destinyId = profile.destiny.id || '';
        const destinyName = profile.destiny.name || destinyId;
        if (scene.destinyTags.includes(destinyId)) {
          insights.push({ type: 'destiny', icon: '✦', label: 'Destiny resonance: ' + destinyName.replace(/_/g, ' ') });
        }
      }

      if (scene.vocationTags && scene.vocationTags.length && profile.vocations.length) {
        profile.vocations.forEach(voc => {
          if (scene.vocationTags.includes(voc.kitId)) {
            insights.push({ type: 'vocation', icon: '⚔', label: (voc.name || voc.kitId) + ' (Tier ' + (voc.tier || 1) + ')' });
          }
        });
      }

      if (scene.disciplineTags && scene.disciplineTags.length) {
        const strong = [];
        scene.disciplineTags.forEach(discId => {
          const disc = profile.disciplines[discId];
          if (disc && (disc.training === 'trained' || disc.training === 'formative' || disc.favored)) {
            const arenaId = ARENA_META.find(a => a.disciplines.includes(discId))?.id;
            const arenaDie = arenaId && profile.arenas[arenaId] ? profile.arenas[arenaId] : null;
            strong.push({ id: discId, favored: disc.favored, die: arenaDie });
          }
        });
        if (strong.length) {
          strong.sort((a, b) => {
            if (a.favored !== b.favored) return b.favored ? 1 : -1;
            return dieRank(b.die) - dieRank(a.die);
          });
          const top = strong.slice(0, 3);
          const labels = top.map(s => {
            let lbl = s.id.replace(/_/g, ' ');
            if (s.favored) lbl += ' ★';
            if (s.die) lbl += ' (' + s.die + ')';
            return lbl;
          });
          insights.push({ type: 'discipline', icon: '◈', label: 'Key skills: ' + labels.join(', ') });
        }
      }

      if (scene.gearFlags && scene.gearFlags.length && profile.gear.length) {
        const relevant = [];
        const missing = [];
        scene.gearFlags.forEach(flag => {
          const flagLower = flag.toLowerCase();
          const matchingGear = profile.gear.filter(g =>
            g.tags.some(t => t.toLowerCase() === flagLower) ||
            g.traits.some(t => t.toLowerCase() === flagLower) ||
            (g.availability && g.availability.toLowerCase() === flagLower)
          );
          if (matchingGear.length) {
            relevant.push({ flag, items: matchingGear.map(g => g.name) });
          } else {
            missing.push(flag);
          }
        });
        if (relevant.length) {
          const labels = relevant.map(r => r.flag + ': ' + r.items.join(', '));
          insights.push({ type: 'gear', icon: '🎒', label: 'Relevant gear: ' + labels.join('; ') });
        }
        if (missing.length) {
          insights.push({ type: 'gear_gap', icon: '⚠', label: 'Missing gear tags: ' + missing.join(', ') });
        }
      }

      if (scene.knackTags && scene.knackTags.length && profile.knacks && profile.knacks.length) {
        profile.knacks.forEach(knack => {
          if (scene.knackTags.includes(knack.knackType) || scene.knackTags.includes(knack.phaseId)) {
            insights.push({ type: 'knack', icon: '🔑', label: (knack.knackName || 'Knack') + ': ' + (knack.knack || knack.knackType) });
          }
        });
      }

      if (scene.speciesTags && scene.speciesTags.length && profile.species) {
        const spName = (profile.species.name || '').toLowerCase();
        if (scene.speciesTags.some(t => t.toLowerCase() === spName || t.toLowerCase() === (profile.species.id || ''))) {
          const parts = [profile.species.name];
          if (profile.species.biologicalTruthName) parts.push(profile.species.biologicalTruthName);
          if (profile.species.speciesTraitName) parts.push(profile.species.speciesTraitName);
          insights.push({ type: 'species', icon: '🧬', label: parts.join(' — ') });
        }
      }

      if (scene.backgroundTags && scene.backgroundTags.length && profile.backgroundPhases.length) {
        profile.backgroundPhases.forEach(bp => {
          if (bp.id && scene.backgroundTags.includes(bp.id)) {
            insights.push({ type: 'background', icon: '📜', label: (bp.title || bp.id) + (bp.favoredDiscipline ? ' (favored: ' + bp.favoredDiscipline + ')' : '') });
          }
        });
      }

      if (scene.themeTags && scene.themeTags.length && profile.backgroundThemes && profile.backgroundThemes.length) {
        const matchedThemes = scene.themeTags.filter(t => profile.backgroundThemes.includes(t));
        if (matchedThemes.length) {
          insights.push({ type: 'theme', icon: '🎭', label: 'Thematic resonance: ' + matchedThemes.join(', ') });
        }
      }

      if (scene.challengeType && profile.disciplines) {
        const cluster = CHALLENGE_CLUSTERS[scene.challengeType];
        if (cluster) {
          const strong = [];
          cluster.forEach(discId => {
            const disc = profile.disciplines[discId];
            if (disc && (disc.training === 'trained' || disc.favored)) {
              strong.push(discId);
            }
          });
          if (strong.length) {
            insights.push({ type: 'challenge', icon: '⚡', label: scene.challengeType + ' challenge — trained in: ' + strong.join(', ') });
          }
        }
      }

      return { characterId: c.id, name: c.name, insights };
    });

    res.json({ sceneId, hasTags: true, intel });
  } catch (err) {
    console.error('[GET /campaign/scene-intel]', err);
    res.status(500).json({ error: 'Failed to generate scene intel.' });
  }
});

const { GoogleGenerativeAI } = require('@google/generative-ai');

const BIBLE_PATH = path.join(__dirname, '..', '..', 'data', 'campaign-bible.md');

// Terms that must never reach the watcher-voice prompt context. Any sentence in
// injected bible content containing one of these gets dropped, and the words
// themselves are scrubbed from anything that survives. Keeps the model from
// echoing GM-only identity/lore back into the player-facing debrief.
const WATCHER_FORBIDDEN_TERMS = [
  'quinlan', 'vos', 'hidden path', 'jedi', 'kiffar', 'kiffu',
  'the force', 'force-sensitive', 'force sensitive', 'force-user', 'force user',
  'holocron', 'holocrons', 'sith', 'inquisitor', 'inquisitors',
  'lightsaber', 'lightsabers', 'padawan', 'master denia',
];

function sanitizeForWatcherVoice(text) {
  if (!text) return '';
  // Split on sentence boundaries while keeping the punctuation attached.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(s => {
    const lower = s.toLowerCase();
    return !WATCHER_FORBIDDEN_TERMS.some(t => lower.includes(t));
  });
  let out = kept.join(' ');
  // Belt-and-suspenders: scrub any forbidden term that survived a sentence-less fragment.
  for (const t of WATCHER_FORBIDDEN_TERMS) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, '[redacted]');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function extractBibleContext(adventureId) {
  let bibleText = '';
  try {
    bibleText = fs.readFileSync(BIBLE_PATH, 'utf8');
  } catch (e) {
    return { themes: '', synopsis: '', characters: '' };
  }

  const themesMatch = bibleText.match(/## Core Themes\n([\s\S]*?)(?=\n---|\n## )/);
  const themesRaw = themesMatch ? themesMatch[1].trim().substring(0, 800) : '';
  const themes = sanitizeForWatcherVoice(themesRaw);

  const advNum = adventureId.replace(/\D/g, '');
  const synopsisRegex = new RegExp('### Adventure ' + advNum + ':[^\n]*\n([\\s\\S]*?)(?=\\n---\\n|\\n### Adventure \\d)');
  const synopsisMatch = bibleText.match(synopsisRegex);
  const synopsisRaw = synopsisMatch ? synopsisMatch[1].trim().substring(0, 2000) : '';
  const synopsis = sanitizeForWatcherVoice(synopsisRaw);

  // Strip GM-only honorifics from header lookups so the labels we hand to the
  // model do not themselves leak ("Jedi Master Denia", "Inquisitor Valin Draco").
  const characterEntries = [
    { lookup: 'Maya', display: 'Maya' },
    { lookup: 'Admiral Gilder Varth', display: 'Admiral Gilder Varth' },
    { lookup: 'Jedi Master Denia', display: 'Denia' },
    { lookup: 'Varga the Hutt', display: 'Varga the Hutt' },
    { lookup: 'Inquisitor Valin Draco', display: 'Valin Draco' },
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

async function assembleMissionContext(adventureId, partIds) {
  const data = loadAdventures();
  const decisionState = await resolveDecisionState();
  const rawAdv = data.adventures.find(a => a.id === adventureId);
  if (!rawAdv) return null;
  const adv = applyAdventureConditionals(rawAdv, decisionState);

  const filteredParts = partIds && partIds.length
    ? (adv.parts || []).filter(p => partIds.includes(p.id))
    : (adv.parts || []);

  if (!filteredParts.length) return null;

  const allSceneIds = [];
  for (const part of filteredParts) {
    for (const scene of (part.scenes || [])) {
      allSceneIds.push(scene.id);
    }
  }

  const completionsResult = await pool.query(
    'SELECT scene_id, completed, gm_notes FROM scene_completion WHERE scene_id = ANY($1)',
    [allSceneIds]
  );
  const completionMap = {};
  completionsResult.rows.forEach(c => { completionMap[c.scene_id] = c; });

  const decisionsResult = allSceneIds.length
    ? await pool.query(
        'SELECT decision_key, choice, outcome, campaign_impact FROM campaign_decisions WHERE adventure_id = $1 AND scene_id = ANY($2) ORDER BY created_at ASC',
        [adventureId, allSceneIds]
      )
    : { rows: [] };

  const journalResult = await pool.query(
    'SELECT title, body, author_character_name, source_scene_id FROM journal_entries WHERE source_scene_id = ANY($1) ORDER BY created_at ASC',
    [allSceneIds]
  );

  const crewResult = await pool.query(
    'SELECT name, character_data FROM characters ORDER BY slot_index ASC'
  );
  const crewRoster = crewResult.rows.map(c => {
    let species = '', vocation = '';
    if (c.character_data) {
      try {
        const d = JSON.parse(c.character_data);
        species = typeof d.species === 'string' ? d.species : '';
        vocation = typeof d.vocation === 'string' ? d.vocation : (typeof d.title === 'string' ? d.title : '');
      } catch (e) {}
    }
    return { name: c.name, species, vocation };
  });

  const sceneSummaries = [];
  for (const part of filteredParts) {
    for (const scene of (part.scenes || [])) {
      const comp = completionMap[scene.id];
      const isComplete = comp && comp.completed;
      const completionNotes = comp ? (comp.gm_notes || '') : '';
      const authoredNotes = scene.gmNotes || '';
      const combinedNotes = [authoredNotes, completionNotes].filter(Boolean).join(' | ');
      sceneSummaries.push({
        id: scene.id,
        partId: part.id,
        partTitle: part.title || '',
        title: scene.title,
        subtitle: scene.subtitle || '',
        challengeType: scene.challengeType || '',
        completed: !!isComplete,
        gmNotes: combinedNotes,
        npcs: (scene.npcs || []).map(n => n.name).filter(Boolean),
        decisionPoints: (scene.decisionPoints || []).map(dp => dp.prompt + ': ' + dp.options.map(o => o.label).join(' / '))
      });
    }
  }

  const bible = extractBibleContext(adventureId);

  const scopeParts = filteredParts.map(p => ({
    id: p.id,
    number: p.number,
    title: p.title || ''
  }));

  return {
    adventure: {
      id: adv.id,
      title: adv.title,
      number: adv.number,
      act: adv.act,
      summary: adv.summary || ''
    },
    scopeParts,
    scenes: sceneSummaries,
    decisions: decisionsResult.rows,
    journalEntries: journalResult.rows,
    crewRoster,
    bible
  };
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
  if (bible.synopsis) {
    bibleSection += `\nADVENTURE NARRATIVE CONTEXT (from campaign bible — use this to inform tone, stakes, and character motivations):\n${bible.synopsis}\n`;
  }
  if (bible.themes) {
    bibleSection += `\nCAMPAIGN THEMES:\n${bible.themes}\n`;
  }
  if (bible.characters) {
    bibleSection += `\nMAJOR NPC PROFILES:\n${bible.characters}\n`;
  }

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
ADVENTURE: Episode ${ctx.adventure.number} — "${ctx.adventure.title}" (Act ${ctx.adventure.act})${ctx.adventure.summary ? '\nADVENTURE BRIEF: ' + ctx.adventure.summary : ''}${ctx.scopeParts && ctx.scopeParts.length ? '\nDEBRIEF SCOPE: ' + ctx.scopeParts.map(p => `Part ${p.number}: "${p.title}"`).join(', ') + ' — Only cover events from these parts. Other parts have been debriefed separately.' : ''}

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

router.post('/campaign/adventures/:adventureId/summary', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured.' });
  }

  const { adventureId } = req.params;
  const partIds = Array.isArray(req.body.partIds) ? req.body.partIds : [];
  let ctx;
  try {
    ctx = await assembleMissionContext(adventureId, partIds.length ? partIds : null);
  } catch (assemblyErr) {
    console.error('[mission-summary] Context assembly failed:', assemblyErr.message);
    return res.status(500).json({ error: 'Failed to assemble mission context.' });
  }
  if (!ctx) {
    return res.status(404).json({ error: 'Adventure not found.' });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  });

  const prompt = buildMissionSummaryPrompt(ctx);
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
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (__) {}
      }
      if (!parsed) {
        const summaryMatch = text.match(/"summary"\s*:\s*"([\s\S]+?)(?:"|$)/);
        if (summaryMatch) {
          parsed = { summary: summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') };
        }
      }
      if (!parsed) {
        if (retries < 1) return { ok: false, retry: true };
        return { ok: false, status: 500, body: { error: 'The report came back garbled. Try again.' } };
      }
    }

    return { ok: true, body: { summary: parsed.summary || '' } };
  }

  try {
    let result = await attemptGenerate(0);
    if (result.ok) return res.json(result.body);
    if (result.retry) {
      console.warn('[mission-summary] Truncated — retrying...');
      await new Promise(r => setTimeout(r, 1000));
      try {
        const retry = await attemptGenerate(1);
        if (retry.ok) return res.json(retry.body);
        return res.status(retry.status).json(retry.body);
      } catch (retryErr) {
        return res.status(500).json({ error: 'Generation failed. Try again.' });
      }
    }
    return res.status(result.status).json(result.body);
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      console.warn('[mission-summary] Rate-limited — retrying after 3s...');
      await new Promise(r => setTimeout(r, 3000));
      try {
        const retry = await attemptGenerate(1);
        if (retry.ok) return res.json(retry.body);
        return res.status(retry.status).json(retry.body);
      } catch (retryErr) {
        return res.status(429).json({ error: 'rate_limit' });
      }
    }
    if (msg === 'TIMEOUT') {
      return res.status(504).json({ error: 'timeout' });
    }
    console.error('[mission-summary] Gemini error:', msg);
    return res.status(500).json({ error: 'Generation failed. Try again.' });
  }
});

let holonetCache = null;
let holonetMtime = null;
function loadHolonet() {
  try {
    const stat = fs.statSync(HOLONET_PATH);
    if (holonetCache && holonetMtime === stat.mtimeMs) return holonetCache;
    holonetCache = JSON.parse(fs.readFileSync(HOLONET_PATH, 'utf8'));
    holonetMtime = stat.mtimeMs;
    return holonetCache;
  } catch (err) {
    console.error('[holonet] Failed to load holonet.json:', err.message);
    return { feeds: [] };
  }
}

router.get('/campaign/holonet/feeds', (req, res) => {
  try {
    const data = loadHolonet();
    res.json({ ok: true, feeds: data.feeds || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load holonet feeds' });
  }
});

// Task #201 — collect every story_id ever broadcast (union across history rows).
async function _loadHolonetBroadcastedSet() {
  const broadcasted = new Set();
  try {
    const { rows } = await pool.query('SELECT story_ids FROM holonet_broadcasts');
    for (const r of rows) {
      let ids = r.story_ids;
      if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch (e) { ids = []; } }
      if (Array.isArray(ids)) ids.forEach(id => broadcasted.add(id));
    }
  } catch (e) { console.error('[holonet] broadcasted set load failed:', e.message); }
  return broadcasted;
}

// Partition all stories into {ready, evergreen} relative to currentDayIndex.
// ready    = airDate present, parses, airDayIndex <= currentDayIndex, not yet broadcast.
// evergreen= no airDate, not yet broadcast.
function _partitionHolonetQueue(currentDayIndex, broadcastedSet) {
  const data = loadHolonet();
  const ready = [];
  const evergreen = [];
  for (const feed of (data.feeds || [])) {
    for (const story of (feed.stories || [])) {
      if (broadcastedSet.has(story.id)) continue;
      if (story.airDate) {
        const parsed = Calendar.parseImperialString(story.airDate);
        if (parsed && parsed.dayIndex <= currentDayIndex) {
          ready.push(Object.assign({}, story, {
            feedId: feed.id,
            feedLabel: feed.label,
            airDayIndex: parsed.dayIndex
          }));
        }
      } else {
        evergreen.push(Object.assign({}, story, { feedId: feed.id, feedLabel: feed.label }));
      }
    }
  }
  ready.sort((a, b) => a.airDayIndex - b.airDayIndex);
  return { ready, evergreen };
}

router.get('/campaign/holonet/queue', async (req, res) => {
  try {
    const state = await _readClockState();
    const broadcasted = await _loadHolonetBroadcastedSet();
    const { ready, evergreen } = _partitionHolonetQueue(state.dayIndex, broadcasted);
    res.json({
      ok: true,
      currentDayIndex: state.dayIndex,
      readyCount: ready.length,
      ready,
      evergreen,
      broadcastedIds: Array.from(broadcasted)
    });
  } catch (err) {
    console.error('[holonet] queue error:', err);
    res.status(500).json({ error: 'Failed to compute holonet queue' });
  }
});

// Emit a small `holonet:queue-updated` payload so GM clients can refresh badges
// without re-fetching the full queue. Carries a signature for dedupe.
async function _emitHolonetQueueUpdated(io) {
  if (!io) return;
  try {
    const state = await _readClockState();
    const broadcasted = await _loadHolonetBroadcastedSet();
    const { ready } = _partitionHolonetQueue(state.dayIndex, broadcasted);
    const signature = state.dayIndex + ':' + ready.length + ':' + broadcasted.size;
    io.emit('holonet:queue-updated', {
      readyCount: ready.length,
      currentDayIndex: state.dayIndex,
      signature
    });
  } catch (e) { console.error('[holonet] queue-updated emit failed:', e.message); }
}

router.get('/campaign/holonet/history', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, feed_id, story_ids, broadcast_at, broadcast_by FROM holonet_broadcasts ORDER BY broadcast_at DESC LIMIT 50'
    );
    res.json({ ok: true, broadcasts: rows });
  } catch (err) {
    console.error('[holonet] History error:', err);
    res.status(500).json({ error: 'Failed to load broadcast history' });
  }
});

const HOLONET_AUTO_CLIP_TYPES = ['consequence', 'foreshadow'];

function _isAutoClipStory(story) {
  return !!(story && HOLONET_AUTO_CLIP_TYPES.indexOf(story.type) !== -1);
}

function _buildHolonetClipBody(story) {
  let body = '**' + story.source + '**';
  const meta = [];
  if (story.channel) meta.push('Channel: ' + story.channel);
  if (story.airDate) meta.push('Aired: ' + story.airDate);
  if (meta.length) body += '\n' + meta.join(' · ');
  body += '\n\n' + story.body;
  return body;
}

async function _autoClipHolonetStories(stories) {
  const eligible = stories.filter(_isAutoClipStory);
  if (eligible.length === 0) return { autoClippedIds: [], entriesCreated: 0 };

  const playersResult = await pool.query(
    "SELECT name FROM characters WHERE session_id IS NOT NULL AND name IS NOT NULL"
  );
  const players = playersResult.rows.map(r => r.name).filter(Boolean);
  if (players.length === 0) {
    return { autoClippedIds: eligible.map(s => s.id), entriesCreated: 0 };
  }

  let entriesCreated = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const story of eligible) {
      const title = 'HoloNet: ' + story.headline;
      const body = _buildHolonetClipBody(story);
      for (const playerName of players) {
        const dup = await client.query(
          `SELECT id FROM journal_entries
            WHERE source_scene_id = 'holonet'
              AND author_character_name = $1
              AND title = $2`,
          [playerName, title]
        );
        if (dup.rows.length) continue;
        await client.query(
          `INSERT INTO journal_entries (title, body, author_character_name, source_scene_id)
           VALUES ($1, $2, $3, 'holonet')`,
          [title, body, playerName]
        );
        entriesCreated++;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { autoClippedIds: eligible.map(s => s.id), entriesCreated };
}

router.post('/campaign/holonet/broadcast', async (req, res) => {
  try {
    const { storyIds } = req.body;
    if (!storyIds || !Array.isArray(storyIds) || storyIds.length === 0) {
      return res.status(400).json({ error: 'storyIds array required' });
    }
    const data = loadHolonet();
    const allStories = [];
    (data.feeds || []).forEach(f => {
      (f.stories || []).forEach(s => allStories.push(s));
    });
    const stories = storyIds.map(id => allStories.find(s => s.id === id)).filter(Boolean);
    if (stories.length === 0) {
      return res.status(400).json({ error: 'No valid stories found' });
    }
    await pool.query(
      'INSERT INTO holonet_broadcasts (feed_id, story_ids, broadcast_by) VALUES ($1, $2, $3)',
      ['manual', JSON.stringify(storyIds), 'gm']
    );

    let autoClippedIds = [];
    let entriesCreated = 0;
    try {
      const clipResult = await _autoClipHolonetStories(stories);
      autoClippedIds = clipResult.autoClippedIds;
      entriesCreated = clipResult.entriesCreated;
    } catch (clipErr) {
      console.error('[holonet] Auto-clip failed (non-fatal):', clipErr);
    }

    const broadcastAt = new Date().toISOString();
    const io = req.app.get('io');
    if (io) {
      io.to('players').emit('holonet:incoming', {
        stories,
        broadcastAt,
        autoClippedIds
      });
      if (entriesCreated > 0) {
        io.emit('journal:updated', { source: 'holonet', autoClippedIds });
      }
      _emitHolonetQueueUpdated(io);
    }
    res.json({ ok: true, stories, autoClippedIds, autoClippedEntries: entriesCreated });
  } catch (err) {
    console.error('[holonet] Broadcast error:', err);
    res.status(500).json({ error: 'Failed to broadcast' });
  }
});

const WIPE_CATEGORIES = {
  full: {
    label: 'Full Campaign Reset',
    tables: ['campaign_progress', 'campaign_decisions', 'scene_completion', 'journal_entry_tags', 'journal_entries', 'journal_tags', 'holonet_broadcasts', 'npc_timeline', 'npc_profiles', 'narrative_challenge_instances', 'campaign_state', 'revealed_marks', 'adventure_marks', 'item_requests', 'equipment_status', 'protocol_droid_pins'],
    reseedNpcs: true
  },
  journal: {
    label: 'Journal Entries',
    tables: ['journal_entry_tags', 'journal_entries', 'journal_tags']
  },
  holonet: {
    label: 'HoloNet Broadcasts',
    tables: ['holonet_broadcasts']
  },
  decisions: {
    label: 'Decision Points',
    tables: ['campaign_decisions']
  },
  progress: {
    label: 'Scene Completion & Progress',
    tables: ['scene_completion', 'campaign_progress']
  },
  npcs: {
    label: 'NPC Profiles & Timeline',
    tables: ['npc_timeline', 'npc_profiles'],
    reseedNpcs: true
  },
  items: {
    label: 'Item Requests & Equipment',
    tables: ['item_requests', 'equipment_status']
  },
  protocol_pins: {
    label: 'Protocol Droid Pinned Answers',
    tables: ['protocol_droid_pins']
  }
};

router.post('/admin/wipe', async (req, res) => {
  const { category } = req.body;
  if (!category || !WIPE_CATEGORIES[category]) {
    return res.status(400).json({ error: 'Invalid wipe category', valid: Object.keys(WIPE_CATEGORIES) });
  }
  const cat = WIPE_CATEGORIES[category];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of cat.tables) {
      await client.query('DELETE FROM ' + table);
    }
    if (category === 'full' || category === 'progress') {
      await client.query(`INSERT INTO campaign_progress (id, adventure_id, part_id, scene_id) VALUES (1, 'adv1', 'adv1-p1', 'adv1-p1-s1') ON CONFLICT (id) DO NOTHING`);
    }
    await client.query('COMMIT');
    if (cat.reseedNpcs) {
      await seedNpcProfiles();
    }
    console.log('[admin] Wiped category:', category, '(' + cat.label + ')');
    res.json({ ok: true, category, label: cat.label });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin/wipe]', err);
    res.status(500).json({ error: 'Wipe failed', detail: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
