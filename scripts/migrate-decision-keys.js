const fs = require('fs');
const path = require('path');

const KEY_MAP = {
  'switch-deal': 'switch',
  'mandrake-fate': 'mandrake',
  'kessra-grudge': 'kessra',
  'raden-fate': 'raden',
  'denia-fate': 'denia',
  'maya-fate': 'maya',
  'varth-relationship': 'varth',
  'soren-alliance': 'soren',
  'sinde-cipher': 'sinde'
};

function migrateNode(node) {
  let count = 0;
  if (Array.isArray(node)) {
    for (const item of node) count += migrateNode(item);
    return count;
  }
  if (!node || typeof node !== 'object') return 0;

  if (Array.isArray(node.decisionPoints)) {
    for (const dp of node.decisionPoints) {
      const oldKey = dp.campaignImpact;
      const newKey = oldKey ? (KEY_MAP[oldKey] || oldKey) : null;
      if (Array.isArray(dp.options)) {
        for (const opt of dp.options) {
          if (Array.isArray(opt.impacts) && opt.impacts.length) {
            opt.impacts = opt.impacts.map(i => ({ key: KEY_MAP[i.key] || i.key, value: i.value }));
            count++;
          } else if (newKey && opt.sets) {
            opt.impacts = [{ key: newKey, value: opt.sets }];
            delete opt.sets;
            count++;
          }
        }
      }
      if (oldKey) {
        delete dp.campaignImpact;
      }
    }
  }

  if (Array.isArray(node.conditionals)) {
    for (const c of node.conditionals) {
      if (c && c.impact && KEY_MAP[c.impact]) {
        c.impact = KEY_MAP[c.impact];
        count++;
      }
    }
  }

  for (const k of Object.keys(node)) {
    if (k === 'decisionPoints' || k === 'conditionals') continue;
    const v = node[k];
    if (v && typeof v === 'object') count += migrateNode(v);
  }
  return count;
}

const advDir = path.join(__dirname, '..', 'data', 'adventures');
const files = fs.readdirSync(advDir).filter(f => /^adv\d+\.json$/.test(f));
let total = 0;
for (const f of files) {
  const fp = path.join(advDir, f);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const c = migrateNode(data);
  if (c > 0) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
    console.log(`  ${f}: ${c} updates`);
    total += c;
  }
}
console.log(`Total adventure updates: ${total}`);

(async () => {
  const { pool } = require('../server/db');
  try {
    const dbKeyMap = { ...KEY_MAP };
    let dbCount = 0;
    for (const [oldK, newK] of Object.entries(dbKeyMap)) {
      const r = await pool.query(
        `UPDATE campaign_decisions SET campaign_impact = $1 WHERE campaign_impact = $2`,
        [newK, oldK]
      );
      if (r.rowCount) {
        console.log(`  DB: ${oldK} -> ${newK}: ${r.rowCount} rows`);
        dbCount += r.rowCount;
      }
    }
    const all = await pool.query(
      `SELECT id, campaign_impact, impact_value, impacts FROM campaign_decisions WHERE campaign_impact IS NOT NULL AND impact_value IS NOT NULL AND (impacts IS NULL OR jsonb_array_length(impacts) = 0)`
    );
    for (const row of all.rows) {
      const arr = [{ key: row.campaign_impact, value: row.impact_value }];
      await pool.query(`UPDATE campaign_decisions SET impacts = $1::jsonb WHERE id = $2`, [JSON.stringify(arr), row.id]);
    }
    if (all.rows.length) console.log(`  DB: backfilled impacts JSONB for ${all.rows.length} legacy rows`);
    console.log(`Total DB key updates: ${dbCount}`);
  } catch (e) {
    console.error('DB backfill error:', e.message);
  } finally {
    await pool.end();
  }
})();
