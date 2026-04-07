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
        player_token  TEXT,
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

      CREATE TABLE IF NOT EXISTS revealed_marks (
        adventure_id   TEXT    NOT NULL,
        mark_id        TEXT    NOT NULL,
        revealed_at    TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (adventure_id, mark_id)
      );

      CREATE TABLE IF NOT EXISTS holonet_broadcasts (
        id             SERIAL PRIMARY KEY,
        feed_id        TEXT    NOT NULL,
        story_ids      TEXT    NOT NULL,
        broadcast_at   TIMESTAMP DEFAULT NOW(),
        broadcast_by   TEXT    NOT NULL DEFAULT 'gm'
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

      CREATE TABLE IF NOT EXISTS campaign_decisions (
        id              SERIAL PRIMARY KEY,
        scene_id        TEXT,
        adventure_id    TEXT NOT NULL,
        decision_key    TEXT NOT NULL,
        choice          TEXT NOT NULL,
        outcome         TEXT,
        campaign_impact TEXT,
        voted           BOOLEAN NOT NULL DEFAULT false,
        created_at      TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS narrative_challenge_instances (
        id              SERIAL PRIMARY KEY,
        challenge_id    TEXT NOT NULL,
        character_id    INTEGER NOT NULL REFERENCES characters(id),
        adventure_id    TEXT,
        scene_id        TEXT,
        choices         TEXT NOT NULL DEFAULT '[]',
        gm_score        INTEGER,
        shift_value     INTEGER,
        status          TEXT NOT NULL DEFAULT 'active',
        shuffle_seed    INTEGER,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS npc_profiles (
        id              SERIAL PRIMARY KEY,
        npc_key         TEXT    NOT NULL UNIQUE,
        name            TEXT    NOT NULL,
        species         TEXT    NOT NULL DEFAULT 'Unknown',
        role            TEXT    NOT NULL DEFAULT '',
        portrait_url    TEXT,
        status          TEXT    NOT NULL DEFAULT 'unknown',
        player_bio      TEXT    NOT NULL DEFAULT '',
        gm_notes        TEXT    NOT NULL DEFAULT '',
        traits          TEXT    NOT NULL DEFAULT '[]',
        connections     TEXT    NOT NULL DEFAULT '[]',
        revealed        BOOLEAN NOT NULL DEFAULT false,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS npc_timeline (
        id              SERIAL PRIMARY KEY,
        npc_key         TEXT    NOT NULL,
        adventure_ref   TEXT    NOT NULL DEFAULT '',
        scene_ref       TEXT    NOT NULL DEFAULT '',
        event_text      TEXT    NOT NULL,
        revealed        BOOLEAN NOT NULL DEFAULT false,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);

    try {
      await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_scene_id TEXT`);
    } catch (e) {}
    try {
      await client.query(`ALTER TABLE narrative_challenge_instances ADD COLUMN IF NOT EXISTS shuffle_seed INTEGER`);
    } catch (e) {}
    try {
      await client.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS player_token TEXT`);
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

async function seedNpcProfiles() {
  const existing = await pool.query('SELECT COUNT(*) as c FROM npc_profiles');
  if (parseInt(existing.rows[0].c) > 0) return;

  const profiles = [
    {
      npc_key: 'maya',
      name: 'Maya',
      species: 'Human',
      role: 'Pilot & Engineer',
      portrait_url: '/attached_assets/generated_images/maya_pilot.png',
      status: 'allied',
      player_bio: 'A young human woman — dark hair, flight jacket, maybe twenty-five. She crashed into your table at The Burning Deck on Jakku, bleeding and desperate, with Varga the Hutt\'s enforcers on her heels. She owns and flies the Banshee, a battered Barloz-class medium freighter that\'s been rebuilt from the frame up. She\'s sharp, brave, and seems to genuinely care about people — sometimes inconveniently so.',
      gm_notes: 'Campaign emotional throughline. Conscience of the crew. Will go to the slave ship alone in Adv3. Backstory: betrayed by partner Soren Vex, rebuilt Banshee at Maz\'s castle on Takodana.',
      traits: JSON.stringify(['Brave', 'Compassionate', 'Stubborn', 'Skilled Mechanic']),
      connections: JSON.stringify(['Admiral Varth — Employer (tense)', 'Varga the Hutt — Enemy', 'The Banshee — Her ship']),
      revealed: true,
      sort_order: 1
    },
    {
      npc_key: 'varth',
      name: 'Admiral Gilder Varth',
      species: 'Human',
      role: 'Employer & Strategist',
      portrait_url: '/attached_assets/generated_images/varth_before_turn.png',
      status: 'allied',
      player_bio: 'A charming, cynical Imperial admiral who embezzled millions from the Empire through Varga the Hutt\'s supply chain. He was caught, imprisoned at a secret facility on Ajan Kloss, and needed rescuing. Now free, he directs operations from the shadows — finding the money, tracking Varga, orchestrating the next job. He\'s cold, mission-focused, and transactional — but he pays up and his intel is always good. Never uses anyone\'s real name. Calls everyone "Kid," "Pilot," "Heavy," "Boss."',
      gm_notes: 'Campaign antagonist. The betrayal in Adv6 is the central twist. Red flags: Adv2 S4 (Denia), Adv2 S6 (Raden execution), Adv3 P2 S2 (the argument), Adv3 P3 S5 (the jump order). Authentication key for encrypted account is memorized.',
      traits: JSON.stringify(['Charming', 'Calculating', 'Competent', 'Cold under pressure']),
      connections: JSON.stringify(['Maya — Respects her, sees conscience as liability', 'Varga the Hutt — Former business partner', 'The Crew — Employers who don\'t know they\'re employees']),
      revealed: true,
      sort_order: 2
    },
    {
      npc_key: 'varga',
      name: 'Varga Besadii Drokko',
      species: 'Hutt',
      role: 'Crime Lord',
      portrait_url: '/attached_assets/generated_images/varga_portrait.png',
      status: 'hostile',
      player_bio: 'A Hutt crime lord operating from a fortress on the far shore of Nymeve Lake on Takodana. Controls the economy of debt and protection across the region. His enforcers were the ones chasing Maya at The Burning Deck. The encrypted fortune Varth stole was laundered through Varga\'s supply chain — and Varga wants it back.',
      gm_notes: 'Act 1 antagonist. Dies in Adv3 during the boarding of the Glorious Chariot. Does not escape or recur. Transparent in his villainy — paradoxically more honest than Varth.',
      traits: JSON.stringify(['Ruthless', 'Territorial', 'Paranoid', 'Vindictive']),
      connections: JSON.stringify(['Admiral Varth — Former business associate', 'Maya — Target (stole from his supply chain)', 'Kessra — Hired muscle']),
      revealed: true,
      sort_order: 3
    }
  ];

  const timelineEntries = [
    { npc_key: 'maya', adventure_ref: 'Adv 1', scene_ref: 'adv1-p1-s1', event_text: 'Crashed into the crew\'s table at The Burning Deck on Jakku — wounded, fleeing Varga\'s enforcers.', revealed: true },
    { npc_key: 'maya', adventure_ref: 'Adv 1', scene_ref: 'adv1-p2-s1', event_text: 'Piloted the Banshee through the Rishi Maze. Invited the crew\'s pilot to the co-pilot seat.', revealed: true },
    { npc_key: 'varth', adventure_ref: 'Adv 1', scene_ref: 'adv1-p2-s6', event_text: 'Rescued from the Vanishing Place detention facility on Ajan Kloss. "You\'re late. I had credits on the second moonrise."', revealed: true },
    { npc_key: 'varga', adventure_ref: 'Adv 1', scene_ref: 'adv1-p1-s1', event_text: 'His enforcers pursued Maya to The Burning Deck. The crew chose to fight.', revealed: true }
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of profiles) {
      await client.query(
        `INSERT INTO npc_profiles (npc_key, name, species, role, portrait_url, status, player_bio, gm_notes, traits, connections, revealed, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (npc_key) DO NOTHING`,
        [p.npc_key, p.name, p.species, p.role, p.portrait_url, p.status, p.player_bio, p.gm_notes, p.traits, p.connections, p.revealed, p.sort_order]
      );
    }
    for (const t of timelineEntries) {
      await client.query(
        `INSERT INTO npc_timeline (npc_key, adventure_ref, scene_ref, event_text, revealed)
         VALUES ($1, $2, $3, $4, $5)`,
        [t.npc_key, t.adventure_ref, t.scene_ref, t.event_text, t.revealed]
      );
    }
    await client.query('COMMIT');
    console.log('[db] Seeded NPC profiles: Maya, Varth, Varga');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[db] Failed to seed NPC profiles:', err);
  } finally {
    client.release();
  }
}

async function initialize() {
  await initSchema();
  await seedPregenCharacters();
  await seedNpcProfiles();
}

module.exports = { pool, initialize };
