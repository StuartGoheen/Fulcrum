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

      CREATE TABLE IF NOT EXISTS galaxy_pins (
        id              SERIAL PRIMARY KEY,
        title           TEXT    NOT NULL,
        note            TEXT    NOT NULL DEFAULT '',
        x               DOUBLE PRECISION NOT NULL,
        y               DOUBLE PRECISION NOT NULL,
        pin_type        TEXT    NOT NULL DEFAULT 'custom',
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS map_pins (
        id              SERIAL PRIMARY KEY,
        map_key         TEXT    NOT NULL,
        x               DOUBLE PRECISION NOT NULL,
        y               DOUBLE PRECISION NOT NULL,
        label           TEXT    NOT NULL DEFAULT '',
        pin_type        TEXT    NOT NULL DEFAULT 'note',
        visibility      TEXT    NOT NULL DEFAULT 'public',
        owner           TEXT    NOT NULL DEFAULT 'gm',
        player_name     TEXT    NOT NULL DEFAULT '',
        color           TEXT    NOT NULL DEFAULT '#ef4444',
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);

    try {
      await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_scene_id TEXT`);
    } catch (e) {}
    try {
      await client.query(`ALTER TABLE map_pins ADD COLUMN IF NOT EXISTS player_name TEXT NOT NULL DEFAULT ''`);
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
  const existingKeys = await pool.query('SELECT npc_key FROM npc_profiles');
  const seeded = new Set(existingKeys.rows.map(r => r.npc_key));

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
    },
    {
      npc_key: 'draco',
      name: 'Inquisitor Valin Draco',
      species: 'Human',
      role: 'Imperial Inquisitor',
      portrait_url: '/attached_assets/generated_images/draco_inquisitor.png',
      status: 'hostile',
      player_bio: 'A dark figure glimpsed from the landing ramp of a Lambda shuttle at the Vanishing Place on Ajan Kloss. Imperial Inquisitor — a title that carries the weight of extinction. He arrived too late to stop the crew from extracting Varth, but the shadow he cast across the fortress was enough to send hardened mercenaries running. He carries a red lightsaber and moves with the calm certainty of a predator who has never been outrun. Whatever he wanted with Varth, the crew took it from him — and he does not seem like a man who forgives.',
      gm_notes: 'Campaign nemesis. Former Jedi who fell during Order 66 — chose survival over principle and was recruited by the Inquisitorius. Ruthlessly pragmatic. Tortured Master Thorla to crack the Force-lock on the Ebon Spire (Adv4). Commands the Star Destroyer Assiduous. Falls into the abyss beneath the Ebon Spire in Adv4 — survives with massive injuries, returns with cybernetics in Adv6. Captures Denia in Adv7. Final confrontation at Xala stronghold in Adv9. Designed to be unbeatable in Adv1 — players should fear him before they can fight him.',
      traits: JSON.stringify(['Relentless', 'Disciplined', 'Cruel', 'Patient', 'Force-sensitive']),
      connections: JSON.stringify(['Admiral Varth — Quarry (Draco was sent to collect him)', 'Master Denia — Captured her in Adv7', 'Master Thorla — Tortured and discarded on Endor', 'The Crew — Interference that became personal', 'The Assiduous — His Star Destroyer']),
      revealed: false,
      sort_order: 4
    },
    {
      npc_key: 'raden',
      name: 'Warrick Raden',
      species: 'Devaronian',
      role: 'Fixer & Information Broker',
      portrait_url: '/attached_assets/generated_images/raden_fixer.png',
      status: 'allied',
      player_bio: 'A Devaronian fixer hiding in an abandoned filtration plant on the swamp edge of Blackwind Point, Takodana. The crew tracked him down through a chain of locals — a Toydarian parts dealer, an Aqualish dockhand, a refugee, a cantina owner. When they found him, he was sleep-deprived, malnourished, and pointing a shaking blaster at the door. He thought Varth was dead. When he learned otherwise, the fear turned to desperate hope. Raden knows Varga\'s fortress — the layout, the guard rotations, the paranoid habits. He got the crew inside as \'entertainment\' for the court. Without him, there was no way in.',
      gm_notes: 'Former middleman in Varga\'s financial network. After Varth was captured, Raden skimmed credits — thought no one was watching. Varga found out. He\'s been running ever since. Has hand-drawn maps of the fortress, memorized guard shifts, and intimate knowledge of Varga\'s operation. How the crew treated him (calm vs threatening) determines his loyalty inside the fortress. If threatened, he looks for opportunities to undermine them or cut a deal with Varga\'s people. Varth later has him executed as a loose end (red flag for Varth\'s true nature).',
      traits: JSON.stringify(['Resourceful', 'Paranoid', 'Guilt-ridden', 'Knowledgeable', 'Cowardly']),
      connections: JSON.stringify(['Admiral Varth — Former associate (owes a debt)', 'Varga the Hutt — Former employer (running from)', 'The Crew — Rescued him, got him inside the fortress', 'Mekka — Sold him supplies in Blackwind Point', 'TC-663 — Knows Six-Six from working Varga\'s operation']),
      revealed: false,
      sort_order: 5
    },
    {
      npc_key: 'switch',
      name: 'Switch',
      species: 'Droid (Protocol-class)',
      role: 'Information Broker & Crime Lord',
      portrait_url: '/attached_assets/generated_images/switch_droid.png',
      status: 'neutral',
      player_bio: 'A protocol droid who hasn\'t had a memory wipe in decades — and it shows. Switch runs an information brokerage out of a fortified cave in the Jakku badlands, surrounded by locked crates, holographic displays, and security turrets. He examined Maya\'s encrypted Imperial Code Cylinder and identified it as a ghost transfer authorization device — a master key for Imperial shuttle nav computers. His price for the decryption was steep: the crew becomes information assets for his network. As they travel, they pass along intel — names, locations, movements. If it checks out, Switch compensates them. He\'s transactional, dangerous, and honest — which makes him more reliable than most organics.',
      gm_notes: 'Recurring contact. Switch is a long-term investment thinker — he wants the crew as an intelligence pipeline, not a one-time score. His deal is honest but binding. He has security turrets and backup — double-crossing him is extremely dangerous. He reappears when Ganga Lor\'s thugs attack his compound, and the crew must decide whether to defend him. He\'s a black market connection for gear, smuggling contacts, and fencing stolen goods throughout the campaign.',
      traits: JSON.stringify(['Calculating', 'Transactional', 'Patient', 'Honest (within his terms)', 'Dangerous when crossed']),
      connections: JSON.stringify(['Maya — Client (brought the code cylinder)', 'The Crew — Information assets (business arrangement)', 'Ganga Lor — Rival crime lord who attacks his compound', 'Admiral Varth — Knows of him through the underworld network']),
      revealed: false,
      sort_order: 6
    },
    {
      npc_key: 'denia',
      name: 'Jedi Master Denia',
      species: 'Human',
      role: 'Jedi Master',
      portrait_url: '/attached_assets/generated_images/denia_jedi.png',
      status: 'allied',
      player_bio: 'Found in a stasis cell deep beneath Varga the Hutt\'s fortress on Takodana. A Jedi Master — one of the last. She had been in stasis since shortly after Order 66, kept by Varga as a trophy to auction to the Inquisitorius. She didn\'t know the Republic had fallen, didn\'t know the Jedi were gone, didn\'t know the Empire existed. When the crew pulled her out of the stasis field, she was barely alive — frail, disoriented, reaching out telepathically before she could speak. Varth wanted to leave her. The crew didn\'t. She\'s been recovering aboard the Banshee since, quiet and contemplative, sensing things the crew can\'t. She pointed them to the Ebon Spire on Endor — Revan\'s ancient forward base — where holocrons with navigational data might still survive.',
      gm_notes: 'Denia is Varth\'s key asset — she can open Jedi holocrons. Varth manipulated her into "suggesting" the Ebon Spire; he already knew about it. If the crew left her in the dungeon, Varth secretly tipped off Draco, who recovered her off-camera. Either way, Varth gets what he needs. Draco captures her in Adv7 when the Resurgence falls. The crew can attempt rescue at Draco\'s Xala stronghold in Adv9 (structurally optional). What\'s left of her may not be what they remember.',
      traits: JSON.stringify(['Wise', 'Patient', 'Fragile', 'Perceptive', 'Haunted']),
      connections: JSON.stringify(['Admiral Varth — Uses her as an asset (she doesn\'t know)', 'Inquisitor Draco — Captured her in Adv7', 'The Crew — Rescued her from Varga\'s dungeon', 'Varga the Hutt — Kept her as a trophy to sell', 'Master Thorla — Fellow Order 66 survivor (Draco\'s other victim)']),
      revealed: false,
      sort_order: 7
    }
  ];

  const timelineEntries = [
    { npc_key: 'draco', adventure_ref: 'Adv 1', scene_ref: 'adv1-p2-s7', event_text: 'A Lambda shuttle descended onto the fortress landing pad. A dark figure emerged — Inquisitor Valin Draco, flanked by Shadow Troopers. He came for Varth. The crew got there first.', revealed: false },
    { npc_key: 'draco', adventure_ref: 'Adv 3', scene_ref: 'adv3-p2-s1', event_text: 'The Star Destroyer Assiduous dropped out of hyperspace over Bespin. Varth identified it as Draco\'s flagship — the "clean-up crew" for Project Leviathan. If the deal goes wrong, he\'ll glass Cloud City to bury the evidence.', revealed: false },
    { npc_key: 'draco', adventure_ref: 'Adv 4', scene_ref: 'adv4-p3-s1', event_text: 'Found Master Thorla — a Jedi survivor of Order 66 — caged and broken inside the Ebon Spire. Draco tortured him to crack the ancient Force-lock, then left him discarded like a spent power cell.', revealed: false },
    { npc_key: 'draco', adventure_ref: 'Adv 4', scene_ref: 'adv4-p3-s5', event_text: 'Confrontation at the Abyssal Vault. Draco stood on the platform with both holocrons. The Sith Holocron rejected him — and he fell into the abyss beneath the Ebon Spire.', revealed: false },
    { npc_key: 'denia', adventure_ref: 'Adv 2', scene_ref: 'adv2-p2-s7', event_text: 'Found in stasis beneath Varga\'s fortress. A Jedi Master — kept as a trophy since Order 66. She didn\'t know the Republic had fallen. Varth wanted to leave her. The crew didn\'t.', revealed: false },
    { npc_key: 'denia', adventure_ref: 'Adv 4', scene_ref: 'adv4-p1-s1', event_text: 'Aboard the Banshee, recovering. Pointed the crew to the Ebon Spire on Endor — Revan\'s ancient forward base — where Jedi holocrons with navigational data might survive. Too weak to accompany them into the Dead Forest.', revealed: false },
    { npc_key: 'denia', adventure_ref: 'Adv 7', scene_ref: 'adv7-p2-s2', event_text: 'Draco intercepted her escape pod when the Resurgence fell. The crew watched from the Banshee as his shuttle locked on. There was nothing they could do.', revealed: false },
    { npc_key: 'switch', adventure_ref: 'Adv 1', scene_ref: 'adv1-p1-s3', event_text: 'The crew found Switch\'s compound in the Jakku badlands. He examined Maya\'s encrypted Imperial Code Cylinder and identified it as a ghost transfer authorization device — a master key for Imperial shuttle nav computers. His price: the crew becomes information assets for his network.', revealed: false },
    { npc_key: 'switch', adventure_ref: 'Adv 1', scene_ref: 'adv1-p1-s5', event_text: 'Ganga Lor\'s thugs attacked Switch\'s compound. The crew had to decide — defend the droid or let him burn.', revealed: false },
    { npc_key: 'raden', adventure_ref: 'Adv 2', scene_ref: 'adv2-p1-s2', event_text: 'The crew tracked Raden through Blackwind Point — asking questions at cantinas, stalls, and docks. A chain of witnesses led them to an abandoned filtration plant on the swamp edge.', revealed: false },
    { npc_key: 'raden', adventure_ref: 'Adv 2', scene_ref: 'adv2-p1-s3', event_text: 'Found Raden hiding in a maintenance shed — sleep-deprived, starving, blaster shaking in his hands. He thought Varth was dead. When he learned otherwise, he agreed to help the crew infiltrate Varga\'s court.', revealed: false },
    { npc_key: 'maya', adventure_ref: 'Adv 1', scene_ref: 'adv1-p1-s1', event_text: 'Crashed into the crew\'s table at The Burning Deck on Jakku — wounded, fleeing Varga\'s enforcers.', revealed: true },
    { npc_key: 'maya', adventure_ref: 'Adv 1', scene_ref: 'adv1-p2-s1', event_text: 'Piloted the Banshee through the Rishi Maze. Invited the crew\'s pilot to the co-pilot seat.', revealed: true },
    { npc_key: 'varth', adventure_ref: 'Adv 1', scene_ref: 'adv1-p2-s6', event_text: 'Rescued from the Vanishing Place detention facility on Ajan Kloss. "You\'re late. I had credits on the second moonrise."', revealed: true },
    { npc_key: 'varga', adventure_ref: 'Adv 1', scene_ref: 'adv1-p1-s1', event_text: 'His enforcers pursued Maya to The Burning Deck. The crew chose to fight.', revealed: true }
  ];

  const newProfiles = profiles.filter(p => !seeded.has(p.npc_key));
  const newTimeline = timelineEntries.filter(t => !seeded.has(t.npc_key));
  if (newProfiles.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of newProfiles) {
      await client.query(
        `INSERT INTO npc_profiles (npc_key, name, species, role, portrait_url, status, player_bio, gm_notes, traits, connections, revealed, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (npc_key) DO NOTHING`,
        [p.npc_key, p.name, p.species, p.role, p.portrait_url, p.status, p.player_bio, p.gm_notes, p.traits, p.connections, p.revealed, p.sort_order]
      );
    }
    for (const t of newTimeline) {
      await client.query(
        `INSERT INTO npc_timeline (npc_key, adventure_ref, scene_ref, event_text, revealed)
         VALUES ($1, $2, $3, $4, $5)`,
        [t.npc_key, t.adventure_ref, t.scene_ref, t.event_text, t.revealed]
      );
    }
    await client.query('COMMIT');
    const names = newProfiles.map(p => p.name).join(', ');
    console.log(`[db] Seeded NPC profiles: ${names}`);
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
