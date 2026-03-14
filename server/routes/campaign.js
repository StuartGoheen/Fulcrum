const express = require('express');
const router  = express.Router();
const db      = require('../db');

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/campaign/state', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM campaign_state').all();

  const state = rows.reduce((acc, row) => {
    try {
      acc[row.key] = JSON.parse(row.value);
    } catch {
      acc[row.key] = row.value;
    }
    return acc;
  }, {});

  res.json({ state });
});

module.exports = router;
