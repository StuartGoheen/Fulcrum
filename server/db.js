const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH      = path.join(__dirname, '..', 'db', 'campaign.db');
const PREGENS_PATH = path.join(__dirname, '..', 'data', 'characters-pregens.json');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS equipment_status (
    character_id  TEXT NOT NULL,
    item_id       TEXT NOT NULL,
    item_type     TEXT NOT NULL DEFAULT 'weapon',
    status        TEXT NOT NULL DEFAULT 'stowed',
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (character_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS characters (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL UNIQUE,
    slot_index     INTEGER NOT NULL,
    session_id     TEXT,
    connected_at   DATETIME,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    character_data TEXT
  );

  CREATE TABLE IF NOT EXISTS campaign_state (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT    PRIMARY KEY,
    character_id  INTEGER REFERENCES characters(id),
    role          TEXT    NOT NULL,
    connected_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaign_progress (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    adventure_id   TEXT    NOT NULL DEFAULT 'adv1',
    part_id        TEXT    NOT NULL DEFAULT 'adv1-p1',
    scene_id       TEXT    NOT NULL DEFAULT 'adv1-p1-s1',
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scene_completion (
    scene_id       TEXT    PRIMARY KEY,
    completed      INTEGER NOT NULL DEFAULT 0,
    completed_at   DATETIME,
    gm_notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS adventure_marks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id   INTEGER NOT NULL REFERENCES characters(id),
    adventure_id   TEXT    NOT NULL,
    mark_id        TEXT    NOT NULL,
    bucket         TEXT    NOT NULL,
    claimed_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(character_id, adventure_id, mark_id)
  );

  CREATE TABLE IF NOT EXISTS item_requests (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    character_name TEXT    NOT NULL,
    item_name      TEXT    NOT NULL,
    description    TEXT,
    reference_url  TEXT,
    status         TEXT    NOT NULL DEFAULT 'pending',
    gm_notes       TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  INSERT OR IGNORE INTO campaign_progress (id, adventure_id, part_id, scene_id)
  VALUES (1, 'adv1', 'adv1-p1', 'adv1-p1-s1')
`);

const existingCols = db.pragma('table_info(characters)').map(c => c.name);
if (!existingCols.includes('character_data')) {
  db.exec(`ALTER TABLE characters ADD COLUMN character_data TEXT`);
  console.log('[db] Added character_data column to characters');
}

function seedPregenCharacters() {
  if (!fs.existsSync(PREGENS_PATH)) return;

  const pregens = JSON.parse(fs.readFileSync(PREGENS_PATH, 'utf8'));
  if (!Array.isArray(pregens) || pregens.length === 0) return;

  let seeded = 0;
  for (const char of pregens) {
    const dataStr = JSON.stringify(char);
    const existing = db.prepare('SELECT id, character_data FROM characters WHERE name = ?').get(char.name);

    if (existing) {
      if (!existing.character_data) {
        db.prepare('UPDATE characters SET character_data = ? WHERE id = ?')
          .run(dataStr, existing.id);
        console.log(`[db] Initialized pre-gen character: ${char.name}`);
      }
      continue;
    }

    const maxSlot = db.prepare('SELECT MAX(slot_index) as m FROM characters').get().m || 0;
    db.prepare('INSERT INTO characters (name, slot_index, character_data) VALUES (?, ?, ?)')
      .run(char.name, maxSlot + 1, dataStr);
    seeded++;
  }
  if (seeded > 0) console.log(`[db] Seeded ${seeded} pre-gen character(s).`);
}

seedPregenCharacters();

module.exports = db;
