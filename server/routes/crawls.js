const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const CRAWLS_DIR = path.join(__dirname, '..', '..', 'data', 'crawls');
const ACTIVE_PATH = path.join(CRAWLS_DIR, 'active.json');
const ADVENTURES_DIR = path.join(__dirname, '..', '..', 'data', 'adventures');

function readActive() {
  try {
    return JSON.parse(fs.readFileSync(ACTIVE_PATH, 'utf8'));
  } catch (e) {
    return { activeAdventureId: null };
  }
}

function readCrawl(adventureId) {
  const fp = path.join(CRAWLS_DIR, adventureId + '.json');
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (e) {
    return null;
  }
}

function getAdventureList() {
  try {
    const files = fs.readdirSync(ADVENTURES_DIR)
      .filter(f => /^adv\d+\.json$/.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)[0], 10);
        const nb = parseInt(b.match(/\d+/)[0], 10);
        return na - nb;
      });
    return files.map(f => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(ADVENTURES_DIR, f), 'utf8'));
        return { id: content.id, number: content.number, title: content.title };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    return [];
  }
}

router.get('/crawls', function (req, res) {
  const adventures = getAdventureList();
  const active = readActive();
  const crawls = adventures.map(function (adv) {
    const crawl = readCrawl(adv.id);
    return {
      adventureId: adv.id,
      adventureNumber: adv.number,
      adventureTitle: adv.title,
      hasCrawl: !!crawl,
      isActive: active.activeAdventureId === adv.id,
      crawl: crawl || null
    };
  });
  res.json({ crawls: crawls, activeAdventureId: active.activeAdventureId });
});

router.get('/crawls/active', function (req, res) {
  const active = readActive();
  if (!active.activeAdventureId) {
    return res.json({ crawl: null });
  }
  var crawl = readCrawl(active.activeAdventureId);
  res.json({ crawl: crawl || null });
});

router.get('/crawls/:adventureId', function (req, res) {
  var crawl = readCrawl(req.params.adventureId);
  if (!crawl) return res.status(404).json({ error: 'No crawl for this adventure.' });
  res.json(crawl);
});

router.put('/crawls/:adventureId', function (req, res) {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });

  var adventureId = req.params.adventureId;
  if (!/^adv\d+$/.test(adventureId)) return res.status(400).json({ error: 'Invalid adventure ID.' });

  var data = req.body;
  if (!data.episode || !data.title || !Array.isArray(data.body)) {
    return res.status(400).json({ error: 'Missing required fields: episode, title, body.' });
  }

  function stripHtml(str) {
    return String(str).replace(/[<>]/g, '');
  }

  var crawl = {
    adventureId: adventureId,
    intro: stripHtml(data.intro || 'A long time ago in a galaxy far,\nfar away\u2026.'),
    episode: stripHtml(data.episode),
    title: stripHtml(data.title),
    body: data.body
      .filter(function (p) { return typeof p === 'string' && p.trim(); })
      .map(function (p) { return stripHtml(p); })
  };

  var fp = path.join(CRAWLS_DIR, adventureId + '.json');
  try {
    fs.writeFileSync(fp, JSON.stringify(crawl, null, 2));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to save crawl.' });
  }

  res.json({ ok: true, crawl: crawl });
});

router.put('/crawls/active/set', function (req, res) {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });

  var adventureId = req.body.adventureId || null;

  if (adventureId !== null && !/^adv\d+$/.test(adventureId)) {
    return res.status(400).json({ error: 'Invalid adventure ID format.' });
  }

  if (adventureId !== null) {
    var crawl = readCrawl(adventureId);
    if (!crawl) return res.status(404).json({ error: 'No crawl exists for that adventure.' });
  }

  try {
    fs.writeFileSync(ACTIVE_PATH, JSON.stringify({ activeAdventureId: adventureId }, null, 2));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to set active crawl.' });
  }

  res.json({ ok: true, activeAdventureId: adventureId });
});

router.delete('/crawls/:adventureId', function (req, res) {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });

  var adventureId = req.params.adventureId;
  var fp = path.join(CRAWLS_DIR, adventureId + '.json');
  try {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete crawl.' });
  }

  var active = readActive();
  if (active.activeAdventureId === adventureId) {
    try {
      fs.writeFileSync(ACTIVE_PATH, JSON.stringify({ activeAdventureId: null }, null, 2));
    } catch (e) { /* ignore */ }
  }

  res.json({ ok: true });
});

module.exports = router;
