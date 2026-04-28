const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');

const ATLAS_DIR = path.join(__dirname, '..', '..', 'data', 'atlas');
const MANIFEST_PATH = path.join(ATLAS_DIR, '_manifest.json');

function requireGM(req, res, next) {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required' });
  next();
}

function loadManifest() {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const obj = JSON.parse(raw);
    return Array.isArray(obj.slugs) ? obj.slugs : [];
  } catch (_) { return []; }
}

function loadEntry(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const filePath = path.join(ATLAS_DIR, slug + '.json');
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) { return null; }
}

function applyRoleAndReveal(entry, isGM, revealed) {
  // Returns a new shallow object with tiers gated by role + reveal state.
  const out = {
    slug: entry.slug,
    name: entry.name,
    region: entry.region,
    sector: entry.sector,
    gridSquare: entry.gridSquare,
    x: entry.x,
    y: entry.y,
    type: entry.type || 'planet',
    image: entry.image || null,
    common: entry.common || {},
    revealed: !!revealed
  };
  if (isGM) {
    out.isCampaignWorld = !!entry.isCampaignWorld;
    out.campaignNotes = entry.campaignNotes || null;
    out.insider = entry.insider || {};
    out.gm = entry.gm || {};
  } else if (revealed) {
    out.insider = entry.insider || {};
    // GM tier and campaign metadata never visible to players.
  }
  return out;
}

async function loadRevealMap() {
  const result = await pool.query('SELECT slug, revealed FROM atlas_reveals');
  const map = {};
  for (const r of result.rows) map[r.slug] = !!r.revealed;
  return map;
}

router.get('/atlas', async (req, res) => {
  try {
    const isGM = req.userRole === 'gm';
    const slugs = loadManifest();
    const reveals = await loadRevealMap();
    const entries = [];
    for (const slug of slugs) {
      const entry = loadEntry(slug);
      if (!entry) continue;
      entries.push(applyRoleAndReveal(entry, isGM, reveals[slug] === true));
    }
    res.json({ entries });
  } catch (err) {
    console.error('[GET /atlas]', err);
    res.status(500).json({ error: 'Failed to load atlas' });
  }
});

router.get('/atlas/:slug', async (req, res) => {
  try {
    const isGM = req.userRole === 'gm';
    const entry = loadEntry(req.params.slug);
    if (!entry) return res.status(404).json({ error: 'Atlas entry not found' });
    const reveals = await loadRevealMap();
    res.json({ entry: applyRoleAndReveal(entry, isGM, reveals[req.params.slug] === true) });
  } catch (err) {
    console.error('[GET /atlas/:slug]', err);
    res.status(500).json({ error: 'Failed to load atlas entry' });
  }
});

router.post('/atlas/:slug/reveal', requireGM, async (req, res) => {
  const { slug } = req.params;
  const desired = req.body && req.body.revealed !== false;
  if (!loadEntry(slug)) return res.status(404).json({ error: 'Atlas entry not found' });
  try {
    await pool.query(
      `INSERT INTO atlas_reveals (slug, revealed, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (slug) DO UPDATE SET revealed = EXCLUDED.revealed, updated_at = NOW()`,
      [slug, desired]
    );

    const io = req.app.get('io');
    if (io) {
      if (desired) {
        const entry = loadEntry(slug);
        const playerView = applyRoleAndReveal(entry, false, true);
        io.to('players').emit('atlas:revealed', { entry: playerView });
      } else {
        io.to('players').emit('atlas:hidden', { slug });
      }
    }

    res.json({ slug, revealed: desired });
  } catch (err) {
    console.error('[POST /atlas/:slug/reveal]', err);
    res.status(500).json({ error: 'Failed to toggle reveal' });
  }
});

module.exports = router;
