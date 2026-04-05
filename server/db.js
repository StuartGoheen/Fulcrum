const { Pool } = require('pg');
const path     = require('path');
const fs       = require('fs');

const PREGENS_PATH = path.join(__dirname, '..', 'data', 'characters-pregens.json');

const isProduction = process.env.NODE_ENV === 'production' ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS equipment_status (
        character_id  TEXT NOT NULL,
        item_id       TEXT NOT NULL,
        item_type     TEXT NOT NULL DEFAULT 'weapon',
        status        TEXT NOT NULL DEFAULT 'stowed',
        updated_at    TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (character_id, item_id)
      );

      CREATE TABLE IF NOT EXISTS characters (
        id             SERIAL PRIMARY KEY,
        name           TEXT    NOT NULL UNIQUE,
        slot_index     INTEGER NOT NULL,
        session_id     TEXT,
        connected_at   TIMESTAMP,
        created_at     TIMESTAMP DEFAULT NOW(),
        character_data TEXT
      );

      CREATE TABLE IF NOT EXISTS campaign_state (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id            TEXT    PRIMARY KEY,
        character_id  INTEGER REFERENCES characters(id),
        role          TEXT    NOT NULL,
        connected_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS campaign_progress (
        id             INTEGER PRIMARY KEY CHECK (id = 1),
        adventure_id   TEXT    NOT NULL DEFAULT 'adv1',
        part_id        TEXT    NOT NULL DEFAULT 'adv1-p1',
        scene_id       TEXT    NOT NULL DEFAULT 'adv1-p1-s1',
        updated_at     TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scene_completion (
        scene_id       TEXT    PRIMARY KEY,
        completed      INTEGER NOT NULL DEFAULT 0,
        completed_at   TIMESTAMP,
        gm_notes       TEXT
      );

      CREATE TABLE IF NOT EXISTS adventure_marks (
        id             SERIAL PRIMARY KEY,
        character_id   INTEGER NOT NULL REFERENCES characters(id),
        adventure_id   TEXT    NOT NULL,
        mark_id        TEXT    NOT NULL,
        bucket         TEXT    NOT NULL,
        claimed_at     TIMESTAMP DEFAULT NOW(),
        UNIQUE(character_id, adventure_id, mark_id)
      );

      CREATE TABLE IF NOT EXISTS item_requests (
        id             SERIAL PRIMARY KEY,
        character_name TEXT    NOT NULL,
        item_name      TEXT    NOT NULL,
        description    TEXT,
        reference_url  TEXT,
        status         TEXT    NOT NULL DEFAULT 'pending',
        gm_notes       TEXT,
        created_at     TIMESTAMP DEFAULT NOW(),
        updated_at     TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journal_tags (
        id              SERIAL PRIMARY KEY,
        name            TEXT    NOT NULL,
        category        TEXT    NOT NULL DEFAULT 'custom',
        source_scene_id TEXT,
        is_custom       BOOLEAN NOT NULL DEFAULT false,
        UNIQUE(name, category)
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id                    SERIAL PRIMARY KEY,
        title                 TEXT    NOT NULL,
        body                  TEXT    NOT NULL DEFAULT '',
        author_character_name TEXT    NOT NULL,
        source_scene_id       TEXT,
        created_at            TIMESTAMP DEFAULT NOW(),
        updated_at            TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS journal_entry_tags (
        entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        tag_id   INTEGER NOT NULL REFERENCES journal_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (entry_id, tag_id)
      );
    `);

    try {
      await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_scene_id TEXT`);
    } catch (e) {}
    try {
      const existingIdx = await client.query(`SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_journal_entries_scene_author'`);
      if (existingIdx.rows.length > 0) {
        const def = existingIdx.rows[0].indexdef || '';
        if (def.indexOf("Campaign Log") === -1) {
          await client.query('DROP INDEX idx_journal_entries_scene_author');
          await client.query(`CREATE UNIQUE INDEX idx_journal_entries_scene_author ON journal_entries (source_scene_id, author_character_name) WHERE source_scene_id IS NOT NULL AND author_character_name = 'Campaign Log'`);
        }
      } else {
        await client.query(`CREATE UNIQUE INDEX idx_journal_entries_scene_author ON journal_entries (source_scene_id, author_character_name) WHERE source_scene_id IS NOT NULL AND author_character_name = 'Campaign Log'`);
      }
    } catch (e) {}

    await client.query(`
      INSERT INTO campaign_progress (id, adventure_id, part_id, scene_id)
      VALUES (1, 'adv1', 'adv1-p1', 'adv1-p1-s1')
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('[db] PostgreSQL schema initialized');
  } finally {
    client.release();
  }
}

async function seedPregenCharacters() {
  if (!fs.existsSync(PREGENS_PATH)) return;

  const pregens = JSON.parse(fs.readFileSync(PREGENS_PATH, 'utf8'));
  if (!Array.isArray(pregens) || pregens.length === 0) return;

  let seeded = 0;
  for (const char of pregens) {
    const dataStr = JSON.stringify(char);
    const existing = await pool.query('SELECT id, character_data FROM characters WHERE name = $1', [char.name]);

    if (existing.rows.length > 0) {
      if (!existing.rows[0].character_data) {
        await pool.query('UPDATE characters SET character_data = $1 WHERE id = $2', [dataStr, existing.rows[0].id]);
        console.log(`[db] Initialized pre-gen character: ${char.name}`);
      }
      continue;
    }

    const maxSlotResult = await pool.query('SELECT COALESCE(MAX(slot_index), 0) as m FROM characters');
    const maxSlot = maxSlotResult.rows[0].m;
    await pool.query(
      'INSERT INTO characters (name, slot_index, character_data) VALUES ($1, $2, $3)',
      [char.name, maxSlot + 1, dataStr]
    );
    seeded++;
  }
  if (seeded > 0) console.log(`[db] Seeded ${seeded} pre-gen character(s).`);
}

async function initialize() {
  await initSchema();
  await seedPregenCharacters();
}

module.exports = { pool, initialize };
