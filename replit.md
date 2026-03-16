# Edge of the Empire — Campaign System

A Star Wars TTRPG electronic character sheet and campaign management system built for local network play.

## Architecture

**Runtime:** Node.js 20  
**Server:** Express + Socket.io (real-time multiplayer via WebSockets)  
**Database:** SQLite via `better-sqlite3` (stored at `db/campaign.db`)  
**CSS:** Tailwind CSS v3 (source: `css/input.css` → output: `public/css/output.css`)

## Project Structure

```
├── public/               # Served as static root
│   ├── index.html        # Landing page (Player / GM / Market selection)
│   ├── icon.svg
│   ├── gm/index.html     # GM Command Bridge
│   ├── player/index.html # Player character sheet
│   ├── create/index.html # Character creation wizard
│   ├── market/index.html # Black Market browser
│   └── css/output.css    # Generated — do not edit directly
├── css/
│   ├── input.css         # Tailwind source (custom components + layers)
│   └── themes.css        # CSS variable theme definitions
├── js/                   # Client-side JavaScript modules
├── data/                 # JSON data files (weapons, armor, gear, etc.)
├── assets/               # Images and icons
├── db/                   # SQLite database (gitignored)
├── server/
│   ├── index.js          # Express + Socket.io entrypoint (port 5000)
│   ├── db.js             # Database init, schema, seeding
│   ├── routes/           # REST API routes (characters, campaign, equipment)
│   └── sockets/          # Socket.io event handlers
└── tailwind.config.js    # Tailwind config (scans public/**/*.html + js/**/*.js)
```

## Data Files

- `data/weapons.json` — weapon definitions (production)
- `data/weapons_source.json` — raw weapon source (used by Black Market UI)
- `data/equipment_source.json` — raw gear source (used by Black Market UI)
- `data/character-test.json` — dev seed character (loaded by `server/db.js` on startup, keeps dev DB populated)
- `data/characters.seed.json` — initial character slot names for DB seeding
- `data/armor.json`, `data/gear.json`, `data/chassis.json` — equipment data
- `data/kits.json` — Kit specialization definitions
- `data/gamesystem.json` — Core resolution rules reference
- `data/threats.json` — NPC/threat rules and trigger system
- `data/maneuvers.json` — universal actions + discipline gambits (object: `universalActions[11]`, `forceManeuvers[3]`, `disciplineGambits{24 sets, 72 gambits}`, `advancedManeuvers[]`)
- `data/glossary.json` — 53 entries including 23 conditions (22 redesigned + [Incapacitated]) with conditionType/pcEffect/npcEffect fields
- `data/adventures.json` — structured adventure content (adventures → parts → scenes)

## Running the App

```bash
npm run dev        # nodemon server + Tailwind CSS watch (development)
npm start          # production node server only
npm run css:build  # one-shot CSS build
```

Server listens on `0.0.0.0:5000`.

## API Endpoints

- `GET  /api/characters` — list characters with connection status
- `GET  /api/characters/:id` — full character data JSON for a single character
- `GET  /api/campaign/state` — full campaign state
- `GET  /api/equipment/:charId` — character equipment statuses
- `POST /api/equipment/:charId/:itemId` — update item status
- `GET  /api/health` — health check
- `GET  /api/campaign/adventures` — full adventure data
- `GET  /api/campaign/adventures/:id` — single adventure
- `GET  /api/campaign/progress` — current position + completions
- `PUT  /api/campaign/progress` — save position
- `PUT  /api/campaign/scene/:sceneId/complete` — toggle scene completion
- `GET  /api/campaign/lore-tags` — all lore tags
- `GET  /api/campaign/lore-tags/:tag` — scenes for a specific tag
- `GET  /api/campaign/party` — party monitor data

## Ammo Power Bar System

Each ranged weapon in `data/weapons.json` now has a `clipSize` field (ammo capacity). Melee weapons have no `clipSize`.

The weapon card header in both `js/armory-panel.js` and `js/loadout-panel.js` renders a `_buildAmmoBar(clipSize)` function that outputs a segmented 8-bar readout styled like a Star Wars blaster power pack:
- **≥ 75% full** → green (`#22c55e`) with green glow
- **30–75% full** → amber (`#f59e0b`) with amber glow
- **< 30% full** → red (`#ef4444`) with red glow

Bars are stored on DOM elements as `data-clip-size` and `data-ammo-pct` for future ammo-tracking integration. All bars initialize at 100%. CSS class: `.wpn-ammo-bar`, `.wpn-ammo-seg`, `.wpn-ammo-seg-empty`.

**Clip sizes assigned:**
- Hold-outs (Q-2, Happy Surprise, Quickfire-4): 8
- Lightning Gun: 6 (stated in trait)
- DC-15s Sidearm: 20
- Intimidator, KYD-21, Lancer, Luxan, QuickSnap, E-5, DDC Defender, Quick-Six: 50
- Standard rifles/pistols (DL-18, DH-17, Westar, Relby, Bryar, E-11, DC-15 Rifle, EE-3, A280): 100
- DLT-19 (belt-fed): 200

## Phase Cards — Character Creation

Character creation uses a three-phase card selection system in `js/character-creation.js`. Each phase represents a layer of backstory: Foundation (Phase 1), Catalyst (Phase 2), Debt (Phase 3).

**Card counts:** 12 cards per phase (36 total).

**Card images:** All 36 card images live in `assets/phase1/`, `assets/phase2/`, `assets/phase3/`. The full deck was restyled in March 2026 to a unified high-resolution Art Nouveau tarot aesthetic with consistent gold filigree borders and phase-coded color palettes:
- Phase 1 (Foundation): warm amber / sienna / golden earth tones
- Phase 2 (Catalyst): cold steel blue / slate green / military tones
- Phase 3 (Debt): deep crimson / shadow purple / noir tones

No text is baked into the images. All card titles, narratives, and symbols are rendered by the JS from the data arrays.

**Phase 1 cards (foundations / origin):**
`deep-fringe`, `shadowed-levels`, `salvage-yards`, `coreward-spires`, `agrarian-plain`, `war-front`, `ancient-ruin`, `trading-post`, `detention-block`, `shipboard-born`, `labor-camp`, `enclave`

**Phase 2 cards (catalyst / departure):**
`disbanded-regular`, `separatist-holdout`, `imperial-defector`, `blockade-runner`, `pacification-survivor`, `field-medic`, `syndicate-enforcer`, `post-war-tracker`, `purge-survivor`, `wreck`, `ascent`, `betrayal`

**Phase 3 cards (debt / consequence) — each has a named Knack ability:**
`hutt-marked`, `witness`, `traumatized`, `shadow-stalked`, `defector`, `debtor`, `exile`, `addiction`, `false-identity`, `notorious` (The Name), `blood-price` (Dead Reckoning), `hunted` (Prey Sense)

**Gemini AI backstory integration:** Phase 3 knacks and Phase combo selections (e.g. Purge Survivor + Shadow-Stalked + Prescient Kit) feed conditional logic in the Gemini backstory generator. See `_aiMeta.loreAnchors` on species objects and `_meta` on phase cards for the directive fields.

## Destiny Selection + Backstory Generator

Two new screens added after Kit selection (March 2026):

**Destiny Selection (`screen-destiny`):** Player picks Two Light, Light & Dark, or Two Dark. Stored in `state.destiny`. This value seeds the group destiny pool and shapes the Gemini backstory tone.

**Your Story (`screen-backstory`):** Form-based backstory generator.
- Fields: Character Name (required, or "Generate for me"), Gender (Male/Female), Species (read-only), Title (optional or generated), optional player input textarea
- Generate button fires only on click — never auto-fires (conserves API quota)
- 5-second minimum display delay enforced via `Promise.all([fetch, 5s])`
- 15-second Regenerate cooldown after each generation
- Clipboard copy uses HTTP-safe fallback (`execCommand`) for local network
- Gemini returns structured JSON (`{ backstory, name?, title? }`) via `responseMimeType: 'application/json'`
- AbortController-style 25-second timeout via `Promise.race`; 429 shows friendly rate-limit message

**Server route:** `POST /api/backstory/generate` in `server/routes/backstory.js`. Uses `@google/generative-ai` SDK. Requires `GEMINI_API_KEY` in Replit Secrets.

**Save route:** `POST /api/characters/save` in `server/routes/characters.js`. Finds first empty slot or creates new. Called from "Confirm & Save" button in the summary overlay.

**Character creation flow:** Species → Phase 1 → Phase 2 → Phase 3 → Arenas/Disciplines → Kits → **Destiny** → **Your Story** → Summary (Confirm & Save)

## Campaign Engine

The GM Command Bridge (`public/gm/index.html`) features a full Campaign Engine as its primary tab.

**Data:** `data/adventures.json` — 10 adventures structured as adventures → parts → scenes. Adventures 1-3 have full scene content (37 scenes total) with readAloud text, GM notes, NPC rosters, hazards, decision points, lore tags, and narrative links. Adventures 4-10 have title/part structure only (placeholder).

**DB Tables:** `campaign_progress` (single-row, tracks current adventure/part/scene position), `scene_completion` (per-scene completion status + optional GM notes).

**API Endpoints:**
- `GET  /api/campaign/adventures` — full adventure data
- `GET  /api/campaign/adventures/:id` — single adventure
- `GET  /api/campaign/progress` — current position + all scene completions
- `PUT  /api/campaign/progress` — save position (validated against adventure data)
- `PUT  /api/campaign/scene/:sceneId/complete` — toggle scene completion
- `GET  /api/campaign/lore-tags` — all lore tags with scene references
- `GET  /api/campaign/lore-tags/:tag` — scenes referencing a specific tag
- `GET  /api/campaign/party` — party monitor data from characters table

**UI Features:** Adventure navigator (10 adventures), part navigator, scene list with completion indicators, scene renderer (read-aloud block, GM notes, NPC roster, hazards, decision points), clickable lore tags with cross-reference modal, narrative link navigation, collapsible Party Monitor sidebar, TBD placeholder panels for Combat Tracker and Starship Combat.

## Right Column Layout (frame-right)

The right column (`#frame-right`, 25vw fixed sidebar) serves as the **combat cockpit** — always-visible status regardless of which center panel is active.

**Sections (top to bottom):**
1. **Vitality** (`char-vitality-wrap`) — EKG animation + clickable health pips
2. **Active Effects** (`char-effects-wrap`) — conditions applied by `effect-manager.js`
3. **Engine Pool** (`char-engine-wrap`) — resource pips + core utility only (kit abilities moved to center panel)
4. **Resolution Ladder** (`char-ladder-wrap`) — symmetric fulcrum display showing Roll − Risk = Net result. Success tiers: Fleeting (0–3), Masterful (4–7), Legendary (8+). Failure tiers mirror below zero. Includes tier modifier sources (+1/−1).

**Action Economy pips** are rendered inline inside the Operational Status section (below Start/End Turn buttons). End Turn automatically resets all pips. Bonuses from kit abilities auto-calculated.

## Database

SQLite database auto-created and seeded on first run at `db/campaign.db`.  
Tables: `characters`, `campaign_state`, `equipment_status`, `sessions`, `campaign_progress`, `scene_completion`.

## Deployment

Configured as a **VM** deployment (always-on required for Socket.io persistent connections).  
Build command: `npm run css:build`  
Run command: `node server/index.js`
