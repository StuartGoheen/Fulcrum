const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH      = path.join(__dirname, '..', 'db', 'campaign.db');
const SEED_PATH    = path.join(__dirname, '..', 'data', 'characters.seed.json');
const TEST_CHAR_PATH = path.join(__dirname, '..', 'data', 'character-test.json');

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
`);

const existingCols = db.pragma('table_info(characters)').map(c => c.name);
if (!existingCols.includes('character_data')) {
  db.exec(`ALTER TABLE characters ADD COLUMN character_data TEXT`);
  console.log('[db] Added character_data column to characters');
}

function seedCharacters() {
  const count = db.prepare('SELECT COUNT(*) as c FROM characters').get().c;
  if (count > 0) return;

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const insert = db.prepare(
    'INSERT INTO characters (name, slot_index) VALUES (@name, @slot_index)'
  );

  const insertMany = db.transaction((characters) => {
    for (const char of characters) insert.run(char);
  });

  insertMany(seed.characters);
  console.log(`[db] Seeded ${seed.characters.length} character slots.`);
}

function seedTestCharacter() {
  if (!fs.existsSync(TEST_CHAR_PATH)) return;

  const testChar = JSON.parse(fs.readFileSync(TEST_CHAR_PATH, 'utf8'));
  const existing = db.prepare('SELECT id, character_data FROM characters WHERE name = ?').get(testChar.name);

  if (existing) {
    if (!existing.character_data) {
      db.prepare('UPDATE characters SET character_data = ? WHERE id = ?')
        .run(JSON.stringify(testChar), existing.id);
      console.log(`[db] Updated test character data: ${testChar.name}`);
    }
    return;
  }

  const maxSlot = db.prepare('SELECT MAX(slot_index) as m FROM characters').get().m || 0;
  db.prepare('INSERT INTO characters (name, slot_index, character_data) VALUES (?, ?, ?)')
    .run(testChar.name, maxSlot + 1, JSON.stringify(testChar));
  console.log(`[db] Seeded test character: ${testChar.name}`);
}

seedCharacters();
seedTestCharacter();

module.exports = db;
