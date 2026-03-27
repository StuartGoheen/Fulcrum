# Edge of the Empire — Campaign System

A Star Wars TTRPG electronic character sheet and campaign management system built for local network play.

## Architecture

**Runtime:** Node.js 20  
**Server:** Express + Socket.io (real-time multiplayer via WebSockets)  
**Database:** SQLite via `better-sqlite3` (stored at `db/campaign.db`)  
**CSS:** Tailwind CSS v3 (source: `css/input.css` → output: `public/css/output.css`)

## Authentication / Password Gate

The app uses a passcode-based gate (cookie auth) to restrict access:
- **PLAYER_PASSCODE** (env secret) — grants `player` role; can access everything except Command Bridge (`/gm/`)
- **GM_PASSCODE** (env secret) — grants `gm` role; full access to all routes including Command Bridge
- Login page at `/login` (themed Access Terminal)
- Auth cookie is signed, httpOnly, 30-day TTL
- Logout button in the landing page header
- Server files: `server/auth.js` (middleware + routes), login UI at `public/login.html`

## Project Structure

```
├── public/               # Served as static root
│   ├── index.html        # Landing page (Player / GM / Market selection)
│   ├── login.html        # Passcode login page (Access Terminal)
│   ├── icon.svg
│   ├── gm/index.html     # GM Command Bridge
│   ├── player/index.html # Player character sheet
│   ├── create/index.html # Character creation wizard
│   ├── market/index.html # Black Market (char gate → accordion browse → purchase flow)
│   ├── css/output.css    # Generated — do not edit directly
│   ├── css/market.css    # Black Market styles (char gate, accordions, ledger, modals, responsive)
│   └── audio/            # Audio assets (opening-crawl.mp3)
├── css/
│   ├── input.css         # Tailwind source (custom components + layers)
│   └── themes.css        # CSS variable theme definitions (6 themes: rebellion, r2d2, vader, fett, holo, fringe)
├── js/                   # Client-side JavaScript modules
│   ├── command-bridge.js  # GM Command Bridge three-column layout JS (mobile responsive via tab navigation at ≤520px)
│   ├── market.js          # Black Market (char gate, accordion, salvaged, purchase, ledger)
│   ├── market-source-viewer.js # Source DB viewer overlay
│   ├── crawl-data.js     # Mission crawl text data (extensible for future missions)
│   ├── opening-crawl.js  # Star Wars opening crawl overlay engine
│   ├── starship-combat.js # Starship combat cockpit HUD overlay
├── data/                 # JSON data files (weapons, armor, gear, etc.)
├── assets/               # Images and icons
├── db/                   # SQLite database (gitignored)
├── server/
│   ├── index.js          # Express + Socket.io entrypoint (port 5000)
│   ├── db.js             # Database init, schema, seeding
│   ├── routes/           # REST API routes (characters, campaign, equipment, inventory)
│   └── sockets/          # Socket.io event handlers
└── tailwind.config.js    # Tailwind config (scans public/**/*.html + js/**/*.js)
```

## Data Files

- `data/weapons.json` — weapon definitions (production)
- `data/weapons_source.json` — raw weapon source (used by Black Market UI)
- `data/equipment_source.json` — raw gear source (used by Black Market UI)
- `data/species.json` — 10 species definitions. Original 5: Human, Twi'lek, Wookiee (Physique D8/Reflex D4), Duros, Zabrak. Added 5: Kel Dor (Wits D8, no penalty, Force Touched), Togruta (Reflex D8/Physique D4, Pack Hunter initiative swap), Rodian (Reflex D8/Presence D4, The Hunt quarry tracking), Sullustan (Wits D8/Physique D4, Spatial Memory never lost), Cathar (Grit D8/Wits D4, Natural Weapons lethal claws). Each has id, name, tagline, lore, imageUrl, arenaShift, favoredDiscipline, biologicalTruth, speciesTrait, arenas, _aiMeta. Images in `assets/species/` (sourced from SWSE wiki).
- `data/phases.json` — Externalized phase card data (previously hardcoded in character-creation.js). Contains `phase1` (12 origin cards), `phase2` (12 departure cards), `phase3` (12 debt/complication cards). Each card has id, title, symbol, imageUrl, narrative, backgroundItems, and _meta (with favored discipline, environment, proficiencies).
- `data/characters-pregens.json` — 5 pre-generated characters for the Western Regions campaign: Kos Vansen (Duros Ghost/Gunslinger, Rescue), Vara Kethri (Twi'lek Noble/Investigator, Corruption), Gorn Kessek (Zabrak Shockboxer/Duelist, Liberation), Tira Shennal (Sullustan Investigator/Ghost, Discovery), Dax Corrin (Human Gunslinger/Ghost, Atonement). Sheet format (expanded arenas array), auto-seeded by `seedPregenCharacters()` in db.js on startup. Advancement math: 8 discipline advances + 1 elite (non-human, 5 player + 3 Force weaknesses), 9+1 for Human (Adaptable), 3 arena advances, 5 kit tiers each. Party covers all adventure-critical gear gates. Old test character (character-test.json) and seed slots (characters.seed.json) removed.
- `data/armor.json`, `data/gear.json` (55 items: 28 original + 26 marketplace gear + Holo-Journal across tools/tech/medical/survival/surveillance/communication categories, 15-200cr range), `data/chassis.json` — equipment data
- `data/kits.json` — Vocation definitions (Kit System v2). 24 vocations: The Gunslinger (ranged/reflex), The Shockboxer (brawl/physique), The Ghost (stealth/reflex), The Ichor Witch (alter_spark/presence), The Noble (charm/presence), The Investigator (investigation/wits), The Seer (sense_spark/wits), The Altus Sopor (control_spark/grit), The Telekinetic Savant (alter_spark/presence), The Duelist (melee/reflex), The Blade Dancer (melee/reflex), The Ace (piloting/reflex), The Juggernaut (endure/physique — universal armor vocation that leans into armor strengths rather than removing penalties; Broken In no Control die penalties from armor + Physique Trauma soaks 3 Vitality instead of 2 while armored, Durasteel Nerve failed Endure + Edge reroll is [Optimized] Control die steps up, Plated Conditioning Vitality soak scales with armor type light +1/medium +2/heavy +3 + no exhaustion penalties from armor, "Is That All?" Endure gambit spend 1 tier reduce effect by 1 + attacker [Rattled], Siege Engine Endure 8+ Control clears mental condition instead of +1 effect + armor passively reduces attacker Power before rolling light -1/medium -2/heavy -3), The Splice (tech/wits — companion probe droid, Direct system control, Reconfigure modes, Parallel Processing), The Grifter (deception/presence — Born Liar Deception-as-social, The Hook self-propagating lies, The Play cover identities, The Long Con retroactive prep), The Doc (medicine/wits — Field Medic combat consumables as Maneuver, Precise Dosage ignores Stimmed, Specialist enhanced Treat Injury, Adrenaline Protocol overdrive/sedate, Resuscitation Protocol +1 tier on Stabilize), The Ship's Mechanic (engineering/wits), The Hound (investigation/wits — bounty hunter tracker archetype; Acquire the Scent declare-a-Mark + Wits-for-Presence hunt social, Closing In Lead generation + spend-for-intel, Secondary Acquisition dual-mark tracking, The Right Questions gambit Lead farming + Leads-as-Edge, Dead to Rights confrontation Tactics vs Resolve with Rattled/Stunned/Surrender-or-Strike-First), The Rifleman (tactics/wits — light infantry professional; Calculated Shooter Wits-as-Power-die for Rifle Aim + free Cover maintenance, Battlefield Read gambit tactical zone question on Aim, Leapfrog buddy bounding movement with free Take Cover, Affix Bayonets Rifle-as-Melee Physique + Opening on enemy entering Cover zone, Final Protective Line spend Edge on Coordinated Fire for squad-wide Aim + zone Openings + Optimized), The Soresu Guardian (sense_spark/wits — Form III lightsaber style; Shien Gate Sense Spark replaces Endure vs Ranged with lightsaber, Reflect Control 8+ exploit redirect bolt within 5 zones Sense/Wits attack, Resilience Stance [Optimized] vs Ranged + act as Cover 2/4 for allies, Circle of Shelter spend Edge to intercept failed ally defense choose Optimized-break or no-Optimized-hold, March of the Mynock Action for [Weakened] Move without breaking stance + allies move with you + Edge replaces Exploit for Reflect), The Shii-Cho Knight (control_spark/grit — Form I lightsaber style; The Determination Form Melee Grit replaces Melee Physique + Sun Djem mercy mechanic leave at 1 Vitality Helpless, Sarlacc Sweep chain attacks on kill/Sun Djem vs multiple Engaged enemies, Disarming Slash gambit +1 tier for Sun Djem or -1 tier penalty, Inner Peace spend Edge to clear conditions, The Foundation gain T1 of all other lightsaber form vocations), The Juyo Adept (alter_spark/presence — Form VII lightsaber style; The Ferocity Form Melee Presence replaces Melee Physique + tap Toll token for +1 Effect Tier on lightsaber/light melee/Alter attacks for rounds equal to Hope count, Vornskyr's Grasp Alter vs Resist pull target 1 zone + Empowered/Opening at higher tiers, Ferocity gain Optimized on next attack after successful Endure/Resist vs Force power, Redirect spend Edge to redirect Force attack back as Alter Presence + stacks with T3 Optimized, The Dark Bargain flip Hope to Toll and add new Toll count as bonus damage on damaging target that attacked you), The Pathfinder (survival/grit — wilderness survival specialist; Wilderness Awareness Survival replaces Tactics for Join Battle in wilderness + Survival replaces Medicine for natural wounds/poisons/diseases, Scrounge Long Rest maneuver roll Survival for tiered item menu Fleeting rations/glow-rod/syntherope Masterful bacta-patch/stimulant-tabs/camo-camp Legendary medpac/rare-find, Vanguard Assess in wilderness using Survival scoped to scouting route ahead failure allows GM encounters, Instinct spend 1 Edge when ally faces unknown natural hazard assume risk resist with Survival [Optimized], Native Ground Assess with Survival in natural terrain 8+ Control replenish 1 Edge + once per session spend Edge to retroactively declare environmental preparation), The Skirmisher (tactics/wits — guerrilla fighter; Running Battle Tactics replaces weapon discipline for light weapon attacks if moved since start of turn, Reactionary Movement exploit spend E to Move when enemy enters zone, Evasive Footwork Dodge [Optimized] vs ranged non-AoE if moved since start of turn, Harrying Strike maneuver Move 1 zone then Tactics vs Resolve for [Disoriented] + forced movement Legendary upgrades to tactical duration, Ghost Protocol enemies you inflicted [Disoriented] on cannot target you while condition persists). Each has 5-tier ability tree with typed abilities (passive/gambit/maneuver/exploit/permission/action), favoredDiscipline, tags, effect tracks, risk fields, `imageUrl` (AI-generated portraits in `assets/vocations/`, 896x1280), and `startingItems` array (vocation-specific starting gear/weapons). Kit budget is 5 points (1pt per tier). Tier cap enforced by linked discipline die: D4→T1, D6→T2, D8→T3, D10→T4, D12→T5. Vocations screen uses `buildPhaseCarousel` flat carousel system (same as Species/Phases/Destiny) with `buildVocationCardFlat` card builder. In-place card rebuild on tier changes via `rebuildCurrentVocationCard`; stale-slide sync via `rebuildActiveVocationSlide` on carousel navigation.
- `data/gamesystem.json` — Core resolution rules reference. Includes full 6-tier resolution ladder (Fleeting through Unleashed III), Modes of Play (Combat/Challenge/Narrative), Presence scaling guide, Opening/Exploit/Defense reactive economy framework, Dual Wielding rule, Concealment rule, Vocation System v2 framework, and Starship Combat system (entry #15: Scale, stations, hardware dice with Fire Control, system impairment, ship defenses, combat flow, modifications system). Hull Rating corrected to soak-per-impairment model. Jury Rig reworked.
- `data/starship-stations.json` — 5 crew station definitions (Pilot, Gunner, Operator, Engineer, Co-Pilot) with actions, reactions, and station-specific gambits for starship combat. Gunner station gambits: Linked Fire, Ion Pulse, Overcharge, Concussive Blast. Operator gambits: Ghost Protocol, Slice Systems. Co-Pilot gambits: Anticipate, Calculated Withdrawal. Pilot/Engineer station gambits removed (old Punch It, Barrel Roll, etc. cleaned up). Jury Rig reworked: Power = damaged system die, all repairs permanent, Fleeting = tactical bypass (1 round), Masterful = 1 step recovery, Legendary = 2 steps on one or 1 step on two, failure = wasted action only.
- `data/starship-weapons.json` — 9 ship weapon definitions (Light Laser, Medium Laser, Medium Turbolaser, Heavy Turbolaser, Ion Cannon, Proton Torpedo, Concussion Missile, Quad Laser, Ventral Cannon) with chassis types, arcs, range arrays, and traits. No per-weapon powerDie — all weapons use the ship's Fire Control system die. No weapon-level gambits — gambits are station-level on the Gunner.
- `data/starship-hardware.json` — 5 hardware system definitions (Handling, Engines, Shields, Sensors, Fire Control) serving as Power dice at stations, with impairment rules (Impaired/Debilitated/Offline). "Weapon Mounts" renamed to "Fire Control" — a single Power die for all weapons.
- `data/starship-modifications.json` — 18 starship modifications (6 Handling, 6 Shields, 6 Engines) gated by hardware die level. D8: 2 mods (1 passive + 1 gambit), D10: 2 mods (1 passive + 1 gambit), D12: 2 exclusive passives (pick one = ship identity). D12 Handling: Corellian Wake (doubles 8+ bonus on Handling actions) vs Micro-Jump via Handling (precision nav-abort failure). D12 Shields: Impenetrable Baffles (+1 Buffered per Reinforce tier) vs Aegis Protocol (extend shields to allies). D12 Engines: Class Zero Hyperdrive (0.5 hyperdrive + Micro-Jump via Engines) vs Oversized Reactor Core (Engines soaks Hull Rating + 2 on impairment). Sensors and Fire Control mods not yet designed.
- `data/default-ship.json` — Default YT-1300-style ship (Krayt Fang) with hull integrity, hullRating, systems (handling/engines/shields/sensors/fire_control), weapon mounts, empty modifications array, and station assignments for starship combat mode.
- `data/threats.json` — NPC/threat rules and trigger system (pending alignment with Opening/Exploit/Defense model)
- `data/maneuvers.json` — universal actions + discipline gambits (object: `universalActions[15]` incl. Join Battle + Resist, `forceManeuvers[3]` (Centering Focus, Force Sense, Telekinesis), `disciplineGambits{25 sets, 75 gambits}` (Alter gambits: Force Shove D8, Mind Trick D10, Hurl D12), `vocationManeuvers[14]` — Dead Drop (Gunslinger T3), Slip (Ghost T3), Arise (Ichor Witch T4), True Possession (Ichor Witch T5), Read the Room (Noble T2), Compel (Noble T3), Keen Insight (Investigator T3), Shatterpoint Sense (Seer T3), Shatterpoint Strike (Seer T5), Enhance Attribute (Altus Sopor T2), Force Speed (Altus Sopor T3), Emptiness (Altus Sopor T5), Kinetic Impulse (Telekinetic Savant T1), Kinetic Combat (Telekinetic Savant T3)). Move action has explicit combat tiers. Join Battle uses Free type. Dodge/Endure/Resist are Defense type (free, no Exploit pip cost). Base Alter Telekinesis maneuver is pure object movement (tiered by scale); Kinetic Impulse (push/pull people) moved to Telekinetic Savant vocation. Crush gambit replaced by Hurl gambit (throw lifted objects at targets).
- `data/glossary.json` — 73 entries including 23 conditions + Natural Recovery rule with conditionType/pcEffect/npcEffect fields. All 25 disciplines include `narrativeTiers`. 18 starship combat entries (Scale, Hardware Die, Station, Integrity, Hull Rating, System Impairment, Called Shot, Evade/Endure/Resist ship versions, Engaged/Close/Far ship range bands, Fire Control, Firing Arc, plus conditions [Elusive], [Jammed], [Disabled]). Weapon Mount entry replaced with Fire Control entry. Hull Rating corrected to soak-per-impairment model. Consumed by the Player's Handbook panel.
- `data/adventures.json` — structured adventure content (adventures → parts → scenes). Adventures 1–3 have scene-level intelligence tags: `challengeType` (social|combat|infiltration|survival|technical|force), `destinyTags` (array of destiny IDs), `vocationTags` (array of kit IDs), `disciplineTags` (array of discipline IDs), `gearFlags` (array of gear trait keywords). Adventure 1 ("The Traitor's Gambit") is fully deep-authored: all 10 scenes have `encounters[]` (typed: social/combat/infiltration/technical/environmental/survival with trigger/description/tactics), `skillChecks[]` (discipline/difficulty/context/success/failure), `environmentMechanics[]` (name/trigger/effect/mitigation), `rewards` (credits/items/intel/connections), `pacing` (openingBeat/risingAction/climax/resolution/estimatedMinutes), expanded `npcs` (behavior/dialogue[]/intel), plus `knackTags[]`, `backgroundTags[]`, `speciesTags[]`, `themeTags[]` for the Scene Intelligence system. Combat encounters include structured `composition` objects (enemies with type/count/threat-level, terrain, positioning). Skill checks may have `isOptional` and `isGated` metadata. Adventures 4–10 have empty scene arrays (not yet tagged).

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
- `GET  /api/campaign/party` — expanded party monitor data (includes destiny, vocations, disciplines, arenas, gear, conditions, background phases)
- `GET  /api/campaign/scene-intel/:sceneId` — scene intelligence engine: cross-references scene tags against party character profiles to produce per-character insights (destiny resonance, vocation matches, key discipline rankings, gear gap warnings, challenge readiness ratings, background ties, knack activations via knackTags, species biological truths + species traits via speciesTags, background environment familiarity via backgroundTags, theme resonance via themeTags). Insights are structured objects with title/description/details[] and are expandable in the frontend UI
- `PATCH /api/characters/:id/advancement` — update advancement state (sanitized/clamped)

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
- Nightsister Energy Bow: 25 (plasma reservoir)

## Carousel System — Character Creation

Character creation uses a unified carousel system (`buildPhaseCarousel` / `phaseCarouselNav` / `phaseCarouselUpdate`) for species, background phases, and destiny screens. All carousels use the same flat card layout (`ph-card-wrap ph-card-flat` → `ph3-species-card`) with image-left / text-right layout, header-row nav arrows, dot indicators, keyboard + swipe navigation. Species cards: `buildSpeciesCardFlat()`; phase cards: `buildPhase3CardFlat()`; destiny pool: `buildDestinyPoolCardFlat()`; personal destiny: `buildPersonalDestinyCardFlat()`. Human's 22 favored discipline choices use a `<select>` dropdown; other species (≤5 choices) use pill buttons. Touch listeners are idempotent (guarded by `container.dataset.touchBound`).

### Phase Cards

Character creation uses a three-phase card selection system in `js/character-creation.js`. Each phase represents a layer of backstory: Foundation (Phase 1), Catalyst (Phase 2), Debt (Phase 3).

**Card counts:** 12 cards per phase (36 total). All card data externalized in `data/phases.json` (keys: `phase1`, `phase2`, `phase3`); fetched at init alongside species and kits via `Promise.allSettled`.

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

Two screens added after Kit selection:

**Destiny Selection (`screen-destiny`):** Uses two stacked carousels (unified carousel system):
1. **Pool Contribution carousel** (`ph-grid-destiny-pool`, 3 cards) — Two Light, Light & Dark, Two Dark. Flat card layout with placeholder images (`assets/destiny/pool-*.svg`). Built by `buildDestinyPoolCardFlat()`. Selecting a pool card sets `state.destiny` and reveals the Personal Destiny carousel below.
2. **Personal Destiny carousel** (`ph-grid-personal-destiny`, 8 cards) — Destruction, Discovery, Rescue, Creation, Corruption, Atonement, Liberation, Ascendancy. Loaded from `data/destinies.json`. Built by `buildPersonalDestinyCardFlat()`. Each card shows tagline, narrative hook, Hope Recovery, Toll Recovery, and Advance trigger using ph3 knack-block CSS. Colored labels: `.destiny-label--hope` (green), `.destiny-label--toll` (red), `.destiny-label--advance` (orange). Selecting sets `state.personalDestiny` (full object). Both must be selected before Continue enables.

**Data:** `data/destinies.json` — 8 destiny definitions with `name`, `tagline`, `imageUrl`, `hopeRecovery`, `tollRecovery`, `advanceTrigger`, `narrativeHook`.

**Images:** Placeholder SVGs in `assets/destiny/` (11 files: 3 pool + 8 personal). To be replaced with generated Star Wars art.

**CSS:** `.destiny-personal-section` wrapper, `.destiny-label--hope/--toll/--advance` color overrides. Old tile/grid classes removed (`.destiny-tile*`, `.pd-card*`, `.personal-destiny-grid`, `.destiny-section*`).

**Arenas & Disciplines (`screen-stats`):** Guided 3-phase workflow with a 5×5 grid layout.
- **Phase 1 — Weaknesses:** Mark non-Force disciplines as incompetent (D4). Species trait "Adaptable" grants +1 free advance. Required count shown in status badge. Only discipline cells clickable; arena row disabled.
- **Phase 2 — Arenas:** Adjust arena die values using stepper (±). Arena advance budget separate from discipline advances.
- **Phase 3 — Specialize:** Spend advances to upgrade disciplines (D6→D8, D8→D10 with elite token). Force disciplines (Control, Sense, Alter) auto-start as incompetent (D4) via `state._forceAutoSet`; can be awakened (restored to D6) by spending 1 advance.
- **Grid:** 5 columns (one per arena). Row 1 = arena cells, rows 2-6 = discipline cells. Last row contains Heavy Weapons, Stealth, Control, Sense, Alter.
- **Detail card:** Full overlay card (`stats-detail-card`) covers the grid with two-column layout: left column (die image + arena badge + tags), right column (topbar with nav arrows + name + close, scrollable body with guide/rule/narrative tiers, actions footer). Swipe + keyboard arrow navigation between disciplines. Glossary data fetched once from `/data/glossary.json` and cached in `_statsGlossary`. Touch handlers bound once via `_sdcSwipe` flag.
- **Force in Phase 1:** Force disciplines are clickable in the Weaknesses phase. Players can restore them (free, undoes auto-lock) or leave them sealed. Force restores in Phase 1 are free; in Phase 3 they cost 1 advance. Status bar shows total weakness count (player + force) vs requirement.
- **Phase gating:** Breadcrumb pips only allow navigating to current or previous phases. "Arenas →" button disabled until weaknesses requirement met.
- **State keys:** `discValues`, `discIncomp`, `arenaAdj`, `spentAdv`, `eliteTokensUsed`, `_forceAutoSet`. `normalizeAdvances()` auto-removes overspent upgrades and decrements counters.
- **CSS classes:** `.sg-cell` grid cells, `.sg-cell--arena/--incomp/--force-locked/--advanced/--favored/--active/--disabled`. `.sdc-*` detail card components (`.sdc-img-col`, `.sdc-content-col`, `.sdc-topbar`, `.sdc-body`, `.sdc-tier-*`, `.sdc-actions`). `.stats-phase-*` breadcrumb. `.stats-status-bar` badges. Grid wrapped in `.stats-grid-wrap` (position:relative) for overlay positioning.
- **Theme variables:** `css/themes.css` defines `--color-force` (purple, varies per theme for readability) and `--color-warn` (amber/orange, used for incompetent state). All Force-related styling uses `var(--color-force)` instead of hardcoded purple. All incompetent/warning styling uses `var(--color-warn)`. Restore/success styling uses `var(--color-success)`.

**Your Story (`screen-backstory`):** Form-based backstory generator.
- Fields: Character Name (required, or "Generate for me"), Gender (Male/Female), Species (read-only), Title (optional or generated), optional player input textarea
- Generate button fires only on click — never auto-fires (conserves API quota)
- 5-second minimum display delay enforced via `Promise.all([fetch, 5s])`
- 15-second Regenerate cooldown after each generation
- Clipboard copy uses HTTP-safe fallback (`execCommand`) for local network
- Gemini returns structured JSON (`{ backstory, name?, title? }`) via `responseMimeType: 'application/json'`
- AbortController-style 25-second timeout via `Promise.race`; 429 shows friendly rate-limit message

**Server route:** `POST /api/backstory/generate` in `server/routes/backstory.js`. Uses `@google/generative-ai` SDK. Requires `GEMINI_API_KEY` in Replit Secrets. Prompt is structured into five sections: Identity, Life Phases, Mechanical Profile, Possessions, Destiny. Client payload includes favoredDiscipline, phase favoredName/Desc, phase 3 knack, forceState, gear with origin, sold items, and species trait.

**Save route:** `POST /api/characters/save` in `server/routes/characters.js`. Finds first empty slot or creates new. Called from "Confirm & Save" button in the summary overlay. On success, auto-joins the session via `/api/session/join` and redirects to `/player/`.

**Destiny pool:** `recalcPool()` in `server/sockets/handlers.js` preserves GM-flipped token state across player reconnects. Only resizes the pool when connected roster changes. `rebuildPool()` does a full reset from character destiny choices (used by `destiny:reset`). Token mapping: "Two Light" → 2 hope, "Two Dark" → 2 toll, default → 1 hope + 1 toll.

**Character creation flow (9 steps):** Species → Phase 1 (Origin) → Phase 2 (Catalyst) → Phase 3 (Debt) → Arenas/Disciplines → Vocations → **Outfitting** (500 cr starting budget) → **Destiny** → **Your Story** → Summary (Confirm & Save)

**Step track:** 9 pips in the header track the full flow. Step labels show "Step X of 9" for numbered steps and named headers for phases/destiny/backstory. Header nav buttons flank the step dots: `← Prev` on the left, `Continue →` on the right. These replace per-screen bottom nav rows. Stats screen has internal sub-phase navigation (incomp → arenas → specialize) that dynamically updates the header buttons.

**Edit mode:** `/create/?edit=ID` loads the character and jumps directly to the backstory (Your Story) screen. The header nav allows navigation back to any previous step.

## Outfitting Screen

New step added between Kits and Destiny. Players spend 500 starting credits on gear, weapons, and armor from the combined catalog (`data/gear.json`, `data/weapons.json`, `data/armor.json`). Features search, category filters (All/Gear/Weapons/Armor), add/remove cart, credit tracking. Selected gear stored in `state.startingGear[]` and persisted through to summary/save. The standalone Black Market page (`/market/`) continues to work independently for mid-campaign shopping.

**Legality-Based Pricing:** Items carry `availability` fields (e.g. `2/F`, `3/R`, `4/X`). The outfitting stage applies Masterful (tier 2) pricing using the same model as the Black Market UI. Market tab: legal + Fee items, ~0.975× base cost, +15% Imperial License Fee on F items. Black Market tab: R items at 2.75× base, X items at 5.5× base. Prices show strikethrough base cost with adjusted price and markup label. Pricing constants: `MARKUP_MARKET`, `MARKUP_BLACK`, `LICENSE_FEE_PCT`, `MASTERFUL_NORM` in `character-creation.js`.

**Legality Tags:** Tag pills in the expanded detail panel are color-coded by legality: red for `Contraband`/`Illegal`, amber for `Restricted`/`Black Market`/`Military`, green for `Legal`/`Common`. CSS classes: `.tag-danger`, `.tag-warning`, `.tag-safe`. Availability badge (`availLabel()`) shows for all item types including `Fee` (amber), `Restricted` (amber), `Illegal` (red).

**Salvaged Items:** Players can buy any item at half its adjusted price using the gear icon (⚙) button. Salvaged items gain `[Jury-Rigged]` in their name and `acquisition: 'salvaged'`. CSS class: `.outfitting-acq-badge.salvaged` (bronze). Jury-Rigged items are unreliable — Power die roll of 1 breaks them.

**Debt System (The Ledger):** Players can take on debt (50-500 cr in 50 cr increments) from 5 creditors: Hutt Cartel (20%), Black Sun (25%), Czerka Arms (15%), Local Fixer (10%), Imperial Surplus Broker (30%). Debt adds to available credits. Removing debt is blocked if it would overspend. Debt data (`state.debt = { creditorId, amount }`) persists to `charData.debt`, flows through `expandCharacterData` to the loadout panel's "The Ledger" card showing borrowed/owed amounts. Creditor definitions in `DEBT_CREDITORS` array. CSS classes: `.outfitting-debt-panel`, `.outfitting-debt-toggle`, `.outfitting-debt-summary`.

**Acquisition Types:** `legal` (unrestricted items, green badge), `registered` (F-restricted with fee paid via Market tab, green badge), `contraband` (F without fee, R, X, or inherently illegal items, red badge), `salvaged` (half price, bronze badge), `background` (free from phases/vocations), `innate` (natural weapons). Badges render in chargen cart, character summary, and loadout panel cards via `_acquisitionBadge()`. Stored in `character_data.acquisitionMap[itemId]` for GM scanning.

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

**UI Features:** Adventure navigator (10 adventures), part navigator, scene list with completion indicators, scene renderer (read-aloud block, GM notes, NPC roster, hazards, decision points), clickable lore tags with cross-reference modal, narrative link navigation, collapsible Party Monitor sidebar.

**GM Command Bridge Tabs:** Campaign (default), Combat Tracker, Starship Combat, GM Handbook. The GM Handbook tab consolidates all 8 rules reference categories (Game System, Arenas & Disciplines, Conditions, Maneuvers, Threats, Weapons, Armor, Gear) into a single panel with collapsible `.hb-section` containers, a dedicated search input (`#handbook-search`), and unified real-time search that auto-expands matching sections and collapses empty ones. Each render function targets `#hb-section-<key> .hb-section-body`. The `refreshHandbookFilter()` function is called after every async data render to re-apply any active search query.

**Starship Combat Cockpit HUD (`js/starship-combat.js`):** Full-screen overlay on the player UI (`#shipcombat-overlay-mount`). Uses a cockpit aesthetic with dark radial gradient background, scan-line texture, and station-colored glow borders. Two layout modes:
- **Unseated (HUD Grid):** 5 equal `.sc-hud-panel` cards in a row via `.sc-hud-grid` (5-column CSS grid). Each panel has corner bracket decorations, a large station icon with color glow, station name, discipline, and power systems. Claimed panels dim (`opacity: 0.45`) and show occupant name. Unclaimed panels show "ENGAGE" button.
- **Seated (Cockpit Layout):** `.sc-cockpit-seated` uses a 3-column grid (1fr 3fr 1fr). The player's station is in `.sc-cockpit-center` with full `_buildStationDetail()` output. The other 4 stations appear as `.sc-hud-mini` panels in `.sc-cockpit-wing` containers (2 left, 2 right).
- **Gambit linking:** `_linkGambitsToActions()` parses gambit rule text to match action names and nests gambits inline under their linked action/reaction via `.sc-gambit-inline` divs. Unlinked gambits appear in a separate "Gambits" section.
- **Socket events:** `shipcombat:sync` (full state), `shipcombat:seats_update` (seat changes), `shipcombat:claim_seat` / `shipcombat:release_seat` (player actions).

## Right Column Layout (frame-right)

The right column (`#frame-right`, 25vw fixed sidebar) serves as the **combat cockpit** — always-visible status regardless of which center panel is active.

**Sections (top to bottom):**
1. **Vitality** (`char-vitality-wrap`) — EKG animation + clickable health pips
2. **Active Effects** (`char-effects-wrap`) — conditions applied by `effect-manager.js`
3. **Engine Pool** (`char-engine-wrap`) — resource pips + core utility only (kit abilities moved to center panel)
4. **Resolution Ladder** (`char-ladder-wrap`) — symmetric fulcrum display showing Roll − Risk = Net result. Success tiers: Fleeting (0–3), Masterful (4–7), Legendary (8–11), Unleashed I (12–15), Unleashed II (16–19), Unleashed III (20+). Unleashed tiers reachable only via favored discipline exploding die or stacked +1 tier effects. Failure tiers mirror below zero. Includes tier modifier sources (+1/−1).

**Action Economy pips** are rendered inline inside the Operational Status section (below Start/End Turn buttons). End Turn automatically resets all pips. Bonuses from kit abilities auto-calculated.

## Armor Storage (armorIds Migration)

Armor is stored as an **array** (`armorIds: [...]`) in character_data, supporting multiple owned armor pieces. Legacy characters with `armorId` (single string) are auto-migrated to `armorIds` on expansion. All client panels (`armor-panel.js`, `armory-panel.js`, `loadout-panel.js`) fall back to `char.armorId` if `char.armorIds` is missing. The `inventoryRemovals.armor` field is now an array of removed armor IDs (was previously a boolean `true`). `applyInventoryRemovals` handles both array and legacy boolean formats. Equipment status determines which armor is equipped/carried/stowed; armor without a status entry defaults to `carried` in the loadout panel. The maneuvers panel (`js/maneuvers-panel.js`) applies equipped armor category modifiers to Dodge and Endure defense dice: Endure steps the Physique power die (none=-1, light=0, medium=+1, heavy=+2), Dodge steps the Reflex power die (none=0, light=0, medium=-1, heavy=-2) with `evasionException` and `evasionReduction` support. The panel fetches `data/armor.json` and resolves the equipped armor from equipment status on each render.

## Armory → Market Flow

The Armory panel (`js/armory-panel.js`) has a sticky top bar containing the "Visit the Market" link and a Credits display with +/- controls. The market link navigates to `/market/` with `charId`, `mode=market`, and `returnTo=player` URL params. Credits were moved here from the Advancement panel — the Armory top bar is always visible when scrolling through inventory. The Market page (`js/market.js`) reads these params on boot: if `charId` is present, it fetches the character via `/api/characters/:id` and auto-selects them (skipping the character gate). The player's theme carries via `localStorage` (`eote-theme`). When `returnTo=player`, a "Character Sheet" return link appears in the market header. After purchasing, the player can return to their character sheet where the new equipment will be loaded.

## Sell Items

Items in the Armory panel have a "Sell" button (amber-styled) alongside existing Drop buttons. Clicking it opens a sell confirmation modal with a percentage stepper (default 50%, adjustable 5–100% in 5% increments). The sell endpoint (`POST /api/inventory/:charId/sell`) removes the item from inventory (via `inventoryRemovals`), adds credits to the character, and cleans up `equipment_status`. Items with `cost: 0` or no cost do not show a sell button.

## Database

SQLite database auto-created and seeded on first run at `db/campaign.db`.  
Tables: `characters`, `campaign_state`, `equipment_status`, `sessions`, `campaign_progress`, `scene_completion`.

## Advancement Panel (Panel 5)

5th player character sheet panel for tracking Marks earned during play and spending them on advancement tracks. Uses CSS theme variables exclusively (all 6 themes supported). The Ledger (debt tracker) is displayed at the top of this panel and is collapsible. Credits have been moved to the Armory panel's sticky header. All advancement tracks (Discipline, Arena, Vocation) are collapsible — when collapsed, the track header still shows progress (e.g. "3/5 • 1 Adv"). Darker container backgrounds have been removed for a cleaner look consistent with other panels. Unfilled pips now have improved contrast.

**File:** `js/advancement-panel.js`

**Features:**
- 4-bucket mark earning checklist: The Mission (5 triggers), The Past (3 triggers), The Future (2 triggers), The Mechanics (4 triggers)
- Running marks total (earned + banked) with "Bank & Reset" button to commit earned marks between adventures
- All three tracks follow the same core loop: each pip filled with Marks = 1 Advance earned. When all pips filled, track resets to next level.
- Discipline Track: 5-box pip track, cost = level × 1 Mark/box. Each pip = 1 Advance. Track clear also earns 1 Elite Token. Focus Burn available.
- Arena Track: 3-box pip track, cost = level × 3 Marks/box. Each pip = 1 Advance.
- Vocation Track: 5-box pip track, cost = level × 3 Marks/box. Each pip = 1 Advance (no Elite Tokens). Spend advance to bump any eligible vocation tier (gated by Favored Discipline die: D4→T1, D6→T2, D8→T3, D10→T4, D12→T5).
- All tracks start at level 2 (chargen fills track 1). Existing characters migrate with `unspentAdvances: 0` added.
- Marks are deducted from banked total when filling track pips; clicking to unfill refunds marks
- Inline spend panels: "Spend Advance" button toggles an inline panel showing all upgrade options
  - Discipline: all 25 disciplines grouped by arena, current die, upgrade cost (D6→D8: 1 Adv, D8→D10: 1 Adv + 1 ET, D10→D12: 1 Adv + 2 ET), click to apply
  - Arena: all 5 arenas with current die, cost (D4→D6: 2 Adv, D6→D8: 1 Adv, D8→D10: 3 Adv, D10→D12: 5 Adv), Apex Rule enforcement
  - Vocation: eligible vocations with tier display, 1 Advance per tier bump, gated by Discipline die
- Actual die-stepping: upgrades modify character data in-memory and persist via `PATCH /api/characters/:id/dice`
- Hero Tier meta-progression card (replaces 4th placeholder slot): 6-tier career arc (Drifter→Survivor→Veteran→Name→Heavy Hitter→The Name) driven by cumulative `careerMarksEarned` across 150-mark campaign. Thresholds: 0/30/55/80/115/150. Displays progress bar to next tier, full tier ladder with locked/unlocked/current states. Text input fields for Signature Move (HT3), Favored Arena (HT5), and Moniker (HT5). Career marks accumulated on End Mission (Bank & Reset). Unlock notification modal fires on tier-up.
- Hero Tier benefits: HT1 one-time respec (die swap + vocation swap), HT2 +1 Exploit pip (2E/round), HT3 Signature Move naming, HT4 Edge Mastery (dual-roll both Control+Power on Edge spend), HT5 +1 Exploit pip (3E/round) + arena-wide Favored + moniker
- Persistence via `PATCH /api/characters/:id/advancement` (tracks) + `PATCH /api/characters/:id/dice` (die changes)

**Data model:** `character_data.advancement` JSON field with:
- `marks` (earnedChecks map + totalBanked)
- `disciplineTrack` (level/filled/eliteTokens/focusBurns/unspentAdvances)
- `arenaTrack` (level/filled/unspentAdvances)
- `vocationTrack` (level/filled/unspentAdvances)
- `vocationUnlocks` (kitId → additional tiers unlocked)
- `careerMarksEarned` (monotonically increasing total; drives Hero Tier)
- `heroTier` (signatureMove, favoredArena, moniker — persisted text fields for HT3/HT5 rewards)
Defaults initialized in both branches of `expandCharacterData()`.

**Handbook entry:** "Marks & Advancement" added as a Rule entry in the Player's Handbook Rules section via `_loadAdvancementEntry()` in `js/glossary-overlay.js`.

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
- **≤700px:** Kit flat cards stack vertically (image above, text below)
- **≤600px:** Phase/species card carousels reduce, destiny grid stacks vertically
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

## Inventory Management

Gear items tagged `Consumable` (Bacta Patches, Grenades, Stim Packs, etc.) can be **used** from the Armory or Loadout panels — each use decrements quantity by 1. All items (gear, weapons, armor) can be **dropped** to remove from inventory.

**Persistence model:** Inventory removals are tracked via `inventoryRemovals` field in `character_data` JSON: `{ gear: ["id", ...], weapons: ["id", ...], armor: true/false }`. The `expandCharacterData` function applies these removals after building the full equipment lists. This preserves original creation data (startingGear) while tracking consumption/drops.

**API endpoints** (`server/routes/inventory.js`):
- `POST /api/inventory/:charId/use` — Use a consumable gear item (body: `{ itemId, itemType: "gear" }`)
- `POST /api/inventory/:charId/drop` — Drop any item (body: `{ itemId, itemType: "gear"|"weapon"|"armor" }`)

**UI:** Use/Drop buttons appear in the body of expanded item cards in both Armory (panel-2) and Loadout (panel-4) panels. After action, character data is re-fetched and `character:stateChanged` event fires to re-render all panels. Innate weapons (Fists/Cathar Claws) cannot be dropped.

## Black Market (/market/)

Mid-campaign shopping interface with full purchase flow. Three files: `public/market/index.html` (HTML shell), `public/css/market.css`, `js/market.js`, `js/market-source-viewer.js`.

**Character Selection Gate:** On load, a full-screen overlay shows all characters from `GET /api/characters` (now returns `credits` and `debt` summary). Player selects a character to enter the market; "Switch" button in header returns to gate.

**Accordion Categories:** Items are grouped into collapsible accordion sections (Ranged Weapons, Melee Weapons, Armor, then gear subcategories) instead of flat filter buttons. Each section shows item count and can be collapsed/expanded.

**In-Card Actions:** Each item card has "+ Add" and "⚙ Salvaged (50%)" buttons directly in the expanded card body. Salvaged option is disabled on R/X restricted items. Priceless items (no cost, no innate flag — e.g. Lightsaber) show "Beyond price — narrative acquisition only" instead of purchase buttons.

**Salvaged Pricing:** Salvaged items cost 50% of the negotiated price (not base cost). They appear in the package list with a "SALVAGED" tag.

**The Ledger (Loan System):** Two states based on character debt:
- **Has debt:** Banner shows creditor name, balance owed, expandable drawer with principal, interest rate, cycles elapsed, projected next-cycle amount.
- **No debt:** Loan offer panel appears with creditor selector (5 creditors with flavor text), amount stepper (1,000–10,000 cr in 500 cr increments), and "Borrow" button. Calls `POST /api/characters/:id/debt/take` to create loan and add credits.
Uses debt data from `character_data.debt` (schema: `{ creditorId, principal, balance, rate, cyclesElapsed, history }`). Creditors: Hutt Cartel (10%), Black Sun (15%), Imperial Surplus Broker (20%), Czerka Arms (25%), Local Fixer (30%).

**Purchase Flow:** "Confirm Purchase" button appears when a price total is calculated. Opens a modal showing itemized costs with acquisition tags (Legal/Registered/Contraband/Salvaged), total, current balance, and remaining balance after purchase. Calls `POST /api/characters/:id/purchase` which deducts credits, adds items to `weaponIds`/`armorId`/`gearIds`, and stores acquisition type in `character_data.acquisitionMap`.

**Acquisition Tracking:** Each purchased item is tagged with its legality status, stored in `character_data.acquisitionMap[itemId]`:
- `legal` — no restriction (unrestricted items, no fees needed)
- `registered` — F-restricted item bought on The Market (license fee paid)
- `contraband` — F-restricted bought on Black Market (no fee), R-restricted, X-illegal, or items tagged Illegal/Contraband
- `salvaged` — bought at 50% price via Salvaged option
These labels appear in the purchase confirmation modal, loadout panel (`_acquisitionBadge()`), and character creation cart. The GM can scan for contraband via the `acquisitionMap` in character data.

**Starting Gear Acquisition Tracking:** All starting items from vocations (`data/kits.json`) and backgrounds (`data/phases.json`) now carry a `legalStatus` field (`legal`, `registered`, or `contraband`) that flows into the character's `acquisitionMap` at finalization. Rules:
- Items with no availability suffix (e.g. "1", "2") → `legal` (common items, no registration exists)
- /F items from vocations → `registered` (legitimate purchase, fee paid)
- /F items from criminal backgrounds (Syndicate Enforcer, Betrayal, etc.) → `contraband` (no fee paid)
- /R items → `contraband` (restricted, no civilian authority)
- /X items → `contraband` (illegal possession)
Background gear section in the creation cart now shows Contraband/Registered badges alongside the origin badge for non-legal items.

**Item Request Modal:** Floating action button ("+ Request Item") in bottom-right opens a modal form. Auto-fills character name from selected character. Submits to `POST /api/item-requests`.

**Responsive Layout:** At ≤900px, the grid switches to single column with the deal panel below. All touch targets are 44px minimum. Header tagline is hidden. Source DB viewer goes single-pane.

**API Endpoints:**
- `GET /api/characters` — now includes `credits` and `debt` summary per character
- `POST /api/characters/:id/purchase` — body: `{ items: [{id, type, acquisition}], totalCost }`, deducts credits, adds items to inventory, stores acquisition in `acquisitionMap`
- `POST /api/characters/:id/debt/take` — body: `{ creditorId, amount }`, creates new loan (requires no existing debt), adds credits

## Deployment

Configured as a **VM** deployment (always-on required for Socket.io persistent connections).  
Build command: `npm run css:build`  
Run command: `node server/index.js`
