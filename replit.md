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
- `data/character-test.json` — dev seed character "Kael Dawnstrider" (loaded by `server/db.js` on startup, always synced to DB). All disciplines at D12 for testing. All 4 vocations at tier 5. Includes phase trio (War Front / Pacification Survivor / Traumatized) and backgroundFavored disciplines. Format matches expanded character data produced by the creation flow.
- `data/characters.seed.json` — initial character slot names for DB seeding
- `data/armor.json`, `data/gear.json` (54 items: 28 original + 26 marketplace gear across tools/tech/medical/survival/surveillance/communication categories, 15-200cr range), `data/chassis.json` — equipment data
- `data/kits.json` — Vocation definitions (Kit System v2). 6 vocations: The Gunslinger (ranged/reflex), The Shockboxer (brawl/physique), The Ghost (stealth/reflex), The Ichor Witch (alter_spark/presence), The Noble (charm/presence), The Investigator (investigation/wits). Each has 5-tier ability tree with typed abilities (passive/gambit/maneuver/exploit/permission), favoredDiscipline, tags, effect tracks, and risk fields. Kit budget is 5 points (1pt per tier). Tier cap enforced by linked discipline die: D4→T1, D6→T2, D8→T3, D10→T4, D12→T5.
- `data/gamesystem.json` — Core resolution rules reference. Includes full 6-tier resolution ladder (Fleeting through Unleashed III), Modes of Play (Combat/Challenge/Narrative), Presence scaling guide, Opening/Exploit/Defense reactive economy framework, Dual Wielding rule, Concealment rule, and Vocation System v2 framework.
- `data/threats.json` — NPC/threat rules and trigger system (pending alignment with Opening/Exploit/Defense model)
- `data/maneuvers.json` — universal actions + discipline gambits (object: `universalActions[15]` incl. Join Battle + Resist, `forceManeuvers[3]`, `disciplineGambits{25 sets, 75 gambits}`, `advancedManeuvers[]`, `vocationManeuvers[4]` — Dead Drop (Gunslinger T3), Slip (Ghost T3), Arise (Ichor Witch T4), True Possession (Ichor Witch T5)). Move action has explicit combat tiers. Join Battle uses Free type. Dodge/Endure/Resist are Defense type (free, no Exploit pip cost).
- `data/glossary.json` — 54 entries including 23 conditions + Natural Recovery rule with conditionType/pcEffect/npcEffect fields. All 25 disciplines include `narrativeTiers` (fleeting/masterful/legendary/unleashedI/unleashedII/unleashedIII) for Challenge and Narrative mode outcomes. Consumed by the Player's Handbook panel.
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

**Destiny Selection (`screen-destiny`):** Two sections:
1. **Pool Contribution** — Player picks Two Light, Light & Dark, or Two Dark. Stored in `state.destiny`. Seeds the group destiny pool and shapes Gemini backstory tone.
2. **Personal Destiny** — Player selects one of 8 Destinies (Destruction, Discovery, Rescue, Creation, Corruption, Atonement, Liberation, Ascendancy). Each is morally neutral with: Hope Recovery (recover spent Hope token once/session), Toll Recovery (recover spent Toll token once/session), and an Advance Trigger (character growth token). Stored in `state.personalDestiny` (full object from `data/destinies.json`). Both pool AND personal Destiny must be selected before Continue enables.

**Data:** `data/destinies.json` — 8 destiny definitions with `name`, `tagline`, `hopeRecovery`, `tollRecovery`, `advanceTrigger`, `narrativeHook`.

**CSS:** `.pd-card` family (`.pd-card-header`, `.pd-card-name`, `.pd-card-tagline`, `.pd-card-details`, `.pd-card-mechanic`), `.pd-label` variants (`--hope`, `--toll`, `--advance`), `.personal-destiny-grid` (4→2→1 col responsive), `.destiny-section` wrappers.

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

**Character creation flow (9 steps):** Species → Phase 1 (Origin) → Phase 2 (Catalyst) → Phase 3 (Debt) → Arenas/Disciplines → Vocations → **Outfitting** (500 cr starting budget) → **Destiny** → **Your Story** → Summary (Confirm & Save)

**Step track:** 9 pips in the header track the full flow. Step labels show "Step X of 9" for numbered steps and named headers for phases/destiny/backstory.

## Outfitting Screen

New step added between Kits and Destiny. Players spend 500 starting credits on gear, weapons, and armor from the combined catalog (`data/gear.json`, `data/weapons.json`, `data/armor.json`). Features search, category filters (All/Gear/Weapons/Armor), add/remove cart, credit tracking. Selected gear stored in `state.startingGear[]` and persisted through to summary/save. The standalone Black Market page (`/market/`) continues to work independently for mid-campaign shopping.

**Background Items System:** Phase 1 cards grant 2-3 free items thematically tied to origin. Phase 2 cards grant 1-2 items tied to catalyst. Phase 3 cards grant NO items (debt/burdens only). Vocations grant a signature weapon/tool at Tier 1+. All background items use `acquisition: 'background'` and an `origin` field (e.g. "Deep Fringe", "Disbanded Regular", "The Gunslinger"). Background items are FREE (excluded from `outfittingCreditsSpent()`). Players can sell background items back for half value via `sellBackgroundItem()`, which tracks sold keys in `state.soldBackgroundKeys[]` to prevent re-sell exploits. `initOutfittingScreen()` reconciles background items on every entry (adds new, removes stale from phase changes, skips sold items). The cart shows two sections: "Background Gear" (with origin badges + sell buttons) and "Purchased Gear" (with remove buttons). CSS classes: `.outfitting-acq-badge.background`, `.outfitting-cart-section-head`, `.outfitting-sell-btn`, `.outfitting-cart-row--bg`.

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
4. **Resolution Ladder** (`char-ladder-wrap`) — symmetric fulcrum display showing Roll − Risk = Net result. Success tiers: Fleeting (0–3), Masterful (4–7), Legendary (8–11), Unleashed I (12–15), Unleashed II (16–19), Unleashed III (20+). Unleashed tiers reachable only via favored discipline exploding die or stacked +1 tier effects. Failure tiers mirror below zero. Includes tier modifier sources (+1/−1).

**Action Economy pips** are rendered inline inside the Operational Status section (below Start/End Turn buttons). End Turn automatically resets all pips. Bonuses from kit abilities auto-calculated.

## Database

SQLite database auto-created and seeded on first run at `db/campaign.db`.  
Tables: `characters`, `campaign_state`, `equipment_status`, `sessions`, `campaign_progress`, `scene_completion`.

## Player's Handbook

Full-panel rule reference replacing the old glossary overlay. Accessible from a floating book icon in the player view, or by clicking any discipline/arena/condition name on the character sheet.

**Architecture:** Modular provider system — each data category (Arenas, Disciplines, Conditions) registers as a provider with `getGroups()` and `hasEntry()` methods. Adding new providers (Kits, Species, Gear, Core Rules) requires only writing a new provider object — no panel code changes.

**File:** `js/glossary-overlay.js` (rewritten in-place to maintain script tag compatibility)

**Features:**
- Sidebar with categorized, collapsible index tree (Arenas, Disciplines grouped by arena, Conditions grouped by type)
- Real-time search filtering across all providers (matches name + rule + guide text)
- Full content area with rule text, Spacer's Guide flavor, and maneuver/gambit details for disciplines
- Condition names in rule text (`[Bleeding]`) remain clickable and navigate within the handbook
- All existing `data-glossary-id` click triggers preserved (character panel, maneuvers, armory, loadout)
- Closes via X button, Escape key, or backdrop click

**CSS:** Handbook styles in `css/input.css` under `/* Player's Handbook Panel */` section. Maneuver/gambit card styles retained under `/* Handbook — Maneuver & Gambit card styles */`.

## Responsive Design

Character creation and player sheet are responsive across desktop and tablet viewports:

**Character Creation breakpoints (css/input.css):**
- **≤900px:** Compact header/step track, narrower draft overlay, full-width content containers
- **≤768px:** Draft sheet becomes bottom-anchored bar, backstory layout stacks vertically, extra bottom padding to clear overlay
- **≤700px:** Species card and kit flat cards stack vertically (image above, text below)
- **≤600px:** Phase card carousels reduce, destiny grid stacks vertically
- **≤480px:** Compact typography, smaller buttons, minimal step track spacing

**Player Sheet breakpoints:**
- **≤1280px:** Right frame hidden, tab bar shown in left frame, left frame expands to 33vw
- **≤900px:** Left frame fixed at 240px
- **≤768px:** Single-slot center (right slot hidden), simplified navbar

## Crew Destiny Pool

Server-authoritative destiny token pool synced in real-time via Socket.io. Pool size = unique connected crew × 2.

**Server events:**
- `destiny:sync` — broadcasts `{ pool: ['hope'|'toll', ...] }` to all clients on join/disconnect/flip/reset
- `destiny:flip` — GM-only, toggles token at `{ index }` between hope/toll
- `destiny:reset` — GM-only, resets all tokens to hope

**Persistence:** Pool stored in `campaign_state` table (key: `destiny_pool`). Survives server restarts. On reconnect, current pool state sent immediately via `destiny:sync`.

**Player view:** Footer renders tokens dynamically from `destiny:sync` events. Display-only (no click-to-flip). Uses existing force-token CSS (blue = hope, red pulsing = toll).

**GM view:** Destiny bar below header in Command Bridge. Clickable tokens emit `destiny:flip`. Shows Hope/Toll count. Reset button emits `destiny:reset`.

**Files:** `server/sockets/handlers.js` (pool logic), `js/socket-client.js` (player rendering), `public/gm/index.html` (GM controls + styles).

## Deployment

Configured as a **VM** deployment (always-on required for Socket.io persistent connections).  
Build command: `npm run css:build`  
Run command: `node server/index.js`
