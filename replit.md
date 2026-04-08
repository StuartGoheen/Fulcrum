# The Leviathan Affair — Campaign System

A Star Wars TTRPG electronic character sheet and campaign management system built for local network play.

## Architecture

**Runtime:** Node.js 20  
**Server:** Express + Socket.io (real-time multiplayer via WebSockets)  
**Database:** PostgreSQL via `pg` (Replit-managed, connection via `DATABASE_URL`)  
**CSS:** Tailwind CSS v3 (source: `css/input.css` → output: `public/css/output.css`)

## Authentication / Password Gate

The app uses a passcode-based gate (cookie auth) to restrict access:
- **PLAYER_PASSCODE** (env secret) — grants `player` role; can access everything except The Black Ledger (`/gm/`)
- **GM_PASSCODE** (env secret) — grants `gm` role; full access to all routes including The Black Ledger
- Login page at `/login` ("Beskar Forge" theme — self-contained dark gunmetal styling, Fulcrum logo, floating sparks, scan lines)
- Landing page at `/` ("Beskar Forge" theme — matching dark forge aesthetic, Fulcrum logo in header + hero, durasteel card panels with per-role accent colors: gold/crew, purple/GM, red/market). Self-contained CSS, divorced from campaign themes.
- Auth cookie is signed, httpOnly, 30-day TTL
- Logout button in the landing page header
- Server files: `server/auth.js` (middleware + routes), login UI at `public/login.html`
- Static path whitelist in auth gate: `/css/`, `/assets/`, `/js/`, `/data/`, `/images/`, `/audio/`, `/icon.svg`, `/favicon.ico`

## Project Structure

```
├── public/               # Served as static root
│   ├── index.html        # Landing page (Player / GM / Market selection)
│   ├── login.html        # Passcode login page (Access Terminal)
│   ├── icon.svg
│   ├── gm/index.html     # GM — The Black Ledger
│   ├── player/index.html # Player character sheet
│   ├── create/index.html # Character creation wizard
│   ├── market/index.html # Black Market (char gate → accordion browse → purchase flow)
│   ├── css/output.css    # Generated — do not edit directly
│   ├── css/command-bridge.css # GM Black Ledger styles (forge palette, dashboard tiles, floating panels, destiny pips)
│   ├── css/market.css    # Black Market styles (char gate, accordions, ledger, modals, responsive)
│   └── audio/            # Audio assets (opening-crawl.mp3)
├── css/
│   ├── input.css         # Tailwind source (custom components + layers)
│   └── themes.css        # CSS variable theme definitions (6 themes: rebellion, r2d2, vader, fett, holo, fringe)
├── js/                   # Client-side JavaScript modules
│   ├── command-bridge.js  # GM Black Ledger three-column layout JS (desktop only), dashboard tile grid in center column (Read Aloud/GM Notes/NPCs/Encounters/Challenges/Environment/Rewards/Pacing tiles), each tile opens a floating draggable/resizable/dismissible panel with full content, floating panel z-index management + drag system, panels auto-close on scene navigation, scene NPC roster with Add/Edit/Remove, duplicate NPC numeric labeling (#1/#2), loot rendering + PC assignment via inventory:added socket, override-aware NPC data flow to Combat Tracker, destiny pips use player-style flat colored dots (⬤ hope=blue/toll=red with glow, tapped=strikethrough+faded) matching Player UI pattern
│   ├── combat-tracker.js   # GM Combat Tracker — two-panel layout (initiative rail + detail panel), NPC disposition badges (Enemy/Neutral/Ally) with click-to-cycle in initiative rail synced to player UI, disposition-colored map tokens (red enemy/yellow neutral/green ally), auto-numbered duplicate NPCs (both count>1 expansion and separately-saved duplicates detected post-load), Condition Command Panel in right column (replaces floating palettes), combo condition system (Surprised/Stunned/Pinned stored as single atomic entries with expandCondIds() unpacking components for mechanical calculations), NPC conditions stored as objects {id,duration,arena?} with duration badges, condition panel with target selector/condition list/duration picker/arena picker/apply button, active conditions summary across all combatants, "Push to PC" button on NPC cards, right column tab switching (Conditions/Glossary) during combat, mobile tab integration, WebSocket Join Battle flow (surprised = single lingering combo condition), bidirectional condition sync, tactical map with token movement and persistent GM position overrides (gmStartingPositions saved to scene JSON via PUT /api/campaign/scene/:id/positions), unplaced NPC bar below map with click-to-place flow, two-pass position matching (numbered NPCs match numbered keys first, then fuzzy fallback), PC hot-join support (late player connects mid-combat → new pcSlot created on join-battle-result, token placed at PC default zone, inserted into initiative order at rolled value, synced to server), combat NPC loading uses scene NPCs as source of truth (ignores encounter composition), full server-side state persistence (combat:sync-state), GM refresh reconnect (restoreFromState), mid-combat NPC add/remove/edit via Threat Builder integration with auto-numbering on add
│   ├── npc-builder.js     # NPC Threat Builder full-screen overlay (5-category system: character/vehicle/starship/capital_ship/station, auto-applied scale traits, ship-flavored arena/stat labels, ship details panel, powerMod/initiativeMod trait support, loot attachment, save/recall, buildNpcFromSaved async API for external consumers, social trait system with reactive traits/triggers, Social Profile card section with SOCIAL RESIST display, socialNotes GM guidance field, Duelist combat role, full action economy: 5 roles × 4 power sources = 20 ability sets with Action/Maneuver/Gambit/Exploit, GM-selectable Power Source dropdown with auto-suggestion from highest arena, resolveRoleKit/suggestPowerSource helpers, computeAttackDisplayData outputs isRoleAction flag per attack)
│   ├── market.js          # Black Market (char gate, accordion, salvaged, purchase, ledger)
│   ├── market-source-viewer.js # Source DB viewer overlay
│   ├── crawl-data.js     # Mission crawl text data (extensible for future missions)
│   ├── opening-crawl.js  # Star Wars opening crawl overlay engine
│   ├── holonet-overlay.js # Player-side HoloNet broadcast overlay (Imperial terminal aesthetic, socket-triggered, journal clipping)
│   ├── starship-combat.js # Starship combat cockpit HUD overlay
│   ├── galaxy-map.js     # Interactive galaxy starmap (Leaflet.js, 65 planets, 6 hyperlanes, campaign pins, marker clustering, search, grid overlay)
├── data/                 # JSON data files (weapons, armor, gear, etc.)
├── assets/               # Images and icons
├── db/                   # (legacy, unused — now using PostgreSQL)
├── server/
│   ├── index.js          # Express + Socket.io entrypoint (port 5000)
│   ├── db.js             # Database init, schema, seeding
│   ├── routes/           # REST API routes (characters, campaign, equipment, inventory, journal); campaign routes include PUT/POST/DELETE for scene NPC persistence; journal routes handle entries CRUD + tag extraction from scenes
│   └── sockets/          # Socket.io event handlers
└── tailwind.config.js    # Tailwind config (scans public/**/*.html + js/**/*.js)
```

## Data Files

- `data/weapons.json` — weapon definitions (production)
- `data/weapons_source.json` — raw weapon source (used by Black Market UI)
- `data/equipment_source.json` — raw gear source (used by Black Market UI)
- `data/species.json` — 10 species definitions. Original 5: Human, Twi'lek, Wookiee (Physique D8/Reflex D4), Duros, Zabrak. Added 5: Kel Dor (Wits D8, no penalty, Force Touched), Togruta (Reflex D8/Physique D4, Pack Hunter initiative swap), Rodian (Reflex D8/Presence D4, The Hunt quarry tracking), Sullustan (Wits D8/Physique D4, Spatial Memory never lost), Cathar (Grit D8/Wits D4, Natural Weapons lethal claws). Each has id, name, tagline, lore, imageUrl, arenaShift, favoredDiscipline, biologicalTruth, speciesTrait, arenas, _aiMeta. Images in `assets/species/` (sourced from SWSE wiki).
- `data/phases.json` — Externalized phase card data (previously hardcoded in character-creation.js). Contains `phase1` (12 origin cards), `phase2` (12 departure cards), `phase3` (12 debt/complication cards). Each card has id, title, symbol, imageUrl, narrative, backgroundItems, and _meta (with favored discipline, environment, proficiencies).
- `data/characters-pregens.json` — Pre-generated characters for the Western Regions campaign (currently: Kos Vansen, Duros Ghost/Gunslinger, Rescue). Creator format (`discValues`, `arenaAdj`, `startingGear`, flat `kits`), auto-seeded by `seedPregenCharacters()` in db.js on startup. Party covers all adventure-critical gear gates.
- `data/armor.json`, `data/gear.json` (55 items: 28 original + 26 marketplace gear + Holo-Journal across tools/tech/medical/survival/surveillance/communication categories, 15-200cr range), `data/chassis.json` — equipment data
- `data/kits.json` — Vocation definitions (Kit System v2). 25 vocations: The Gunslinger (ranged/reflex), The Shockboxer (brawl/physique), The Teräs Käsi (brawl/grit — Bunduki martial art, counter-Force fighting; Steel Hands Brawl(Grit) for unarmed attacks + melee Endure + Light Melee chassis + Stun option disabled by [Rattled]/[Disoriented], Sleeping Krayt successful defense → next counter [Empowered], Rancor Rising Control(Grit) maneuver for [Guarded X] + mental condition clear + armor-ignore on next strike, Aryx Slash gambit spend 1 tier → target next Endure [Weakened] or [Exposed] if unarmored, Gundark Slap defend lightsaber with Brawl(Grit) [Optimized] + 8+ → attacker [Exposed] + 1/scene mercy [Incapacitated]). Beast Form technique naming throughout: Sleeping Krayt (krayt dragon ambush), Rancor Rising (explosive from stillness), Aryx Slash (Cerean bird precision talons), Gundark Slap (concussive finishing blow). Lore references Screaming Squill, Leaping Veermok, Riding Bantha, Gorax Smash in description/fluff, The Ghost (stealth/reflex), The Ichor Witch (alter_spark/presence), The Noble (charm/presence), The Investigator (investigation/wits), The Seer (sense_spark/wits), The Altus Sopor (control_spark/grit), The Telekinetic Savant (alter_spark/presence), The Duelist (melee/reflex), The Blade Dancer (melee/reflex), The Ace (piloting/reflex), The Juggernaut (endure/physique — universal armor vocation that leans into armor strengths rather than removing penalties; Broken In no Control die penalties from armor + Physique Trauma soaks 3 Vitality instead of 2 while armored, Durasteel Nerve failed Endure + Edge reroll is [Optimized] Control die steps up, Plated Conditioning Vitality soak scales with armor type light +1/medium +2/heavy +3 + no exhaustion penalties from armor, "Is That All?" Endure gambit spend 1 tier reduce effect by 1 + attacker [Rattled], Siege Engine Endure 8+ Control clears mental condition instead of +1 effect + armor passively reduces attacker Power before rolling light -1/medium -2/heavy -3), The Splice (tech/wits — companion probe droid, Direct system control, Reconfigure modes, Parallel Processing), The Grifter (deception/presence — Born Liar Deception-as-social, The Hook self-propagating lies, The Play cover identities, The Long Con retroactive prep), The Doc (medicine/wits — Field Medic combat consumables as Maneuver, Precise Dosage ignores Stimmed, Specialist enhanced Treat Injury, Adrenaline Protocol overdrive/sedate, Resuscitation Protocol +1 tier on Stabilize), The Ship's Mechanic (engineering/wits), The Hound (investigation/wits — bounty hunter tracker archetype; Acquire the Scent declare-a-Mark + Wits-for-Presence hunt social, Closing In Lead generation + spend-for-intel, Secondary Acquisition dual-mark tracking, The Right Questions gambit Lead farming + Leads-as-Edge, Dead to Rights confrontation Tactics vs Resolve with Rattled/Stunned/Surrender-or-Strike-First), The Rifleman (tactics/wits — light infantry professional; Calculated Shooter Wits-as-Power-die for Rifle Aim + free Cover maintenance, Battlefield Read gambit tactical zone question on Aim, Leapfrog buddy bounding movement with free Take Cover, Affix Bayonets Rifle-as-Melee Physique + Opening on enemy entering Cover zone, Final Protective Line spend Edge on Coordinated Fire for squad-wide Aim + zone Openings + Optimized), The Soresu Guardian (sense_spark/wits — Form III lightsaber style; Shien Gate Sense Spark replaces Endure vs Ranged with lightsaber, Reflect Control 8+ exploit redirect bolt within 5 zones Sense/Wits attack, Resilience Stance [Optimized] vs Ranged + act as Cover 2/4 for allies, Circle of Shelter spend Edge to intercept failed ally defense choose Optimized-break or no-Optimized-hold, March of the Mynock Action for [Weakened] Move without breaking stance + allies move with you + Edge replaces Exploit for Reflect), The Shii-Cho Knight (control_spark/grit — Form I lightsaber style; The Determination Form Melee Grit replaces Melee Physique + Sun Djem mercy mechanic leave at 1 Vitality Helpless, Sarlacc Sweep chain attacks on kill/Sun Djem vs multiple Engaged enemies, Disarming Slash gambit +1 tier for Sun Djem or -1 tier penalty, Inner Peace spend Edge to clear conditions, The Foundation gain T1 of all other lightsaber form vocations), The Juyo Adept (alter_spark/presence — Form VII lightsaber style; The Ferocity Form Melee Presence replaces Melee Physique + tap Toll token for +1 Effect Tier on lightsaber/light melee/Alter attacks for rounds equal to Hope count, Vornskyr's Grasp Alter vs Resist pull target 1 zone + Empowered/Opening at higher tiers, Ferocity gain Optimized on next attack after successful Endure/Resist vs Force power, Redirect spend Edge to redirect Force attack back as Alter Presence + stacks with T3 Optimized, The Dark Bargain flip Hope to Toll and add new Toll count as bonus damage on damaging target that attacked you), The Pathfinder (survival/grit — wilderness survival specialist; Wilderness Awareness Survival replaces Tactics for Join Battle in wilderness + Survival replaces Medicine for natural wounds/poisons/diseases, Scrounge Long Rest maneuver roll Survival for tiered item menu Fleeting rations/glow-rod/syntherope Masterful bacta-patch/stimulant-tabs/camo-camp Legendary medpac/rare-find, Vanguard Assess in wilderness using Survival scoped to scouting route ahead failure allows GM encounters, Instinct spend 1 Edge when ally faces unknown natural hazard assume risk resist with Survival [Optimized], Native Ground Assess with Survival in natural terrain 8+ Control replenish 1 Edge + once per session spend Edge to retroactively declare environmental preparation), The Skirmisher (tactics/wits — guerrilla fighter; Running Battle Tactics replaces weapon discipline for light weapon attacks if moved since start of turn, Reactionary Movement exploit spend E to Move when enemy enters zone, Evasive Footwork Dodge [Optimized] vs ranged non-AoE if moved since start of turn, Harrying Strike maneuver Move 1 zone then Tactics vs Resolve for [Disoriented] + forced movement Legendary upgrades to tactical duration, Ghost Protocol enemies you inflicted [Disoriented] on cannot target you while condition persists). Each has 5-tier ability tree with typed abilities (passive/gambit/maneuver/exploit/permission/action), favoredDiscipline, tags, effect tracks, risk fields, `imageUrl` (AI-generated portraits in `assets/vocations/`, 896x1280), and `startingItems` array (vocation-specific starting gear/weapons). Kit budget is 5 points (1pt per tier). Tier cap enforced by linked discipline die: D4→T1, D6→T2, D8→T3, D10→T4, D12→T5. Vocations screen uses `buildPhaseCarousel` flat carousel system (same as Species/Phases/Destiny) with `buildVocationCardFlat` card builder. In-place card rebuild on tier changes via `rebuildCurrentVocationCard`; stale-slide sync via `rebuildActiveVocationSlide` on carousel navigation.
- `data/gamesystem.json` — Core resolution rules reference. Includes full 6-tier resolution ladder (Fleeting through Unleashed III), Modes of Play (Combat/Challenge/Narrative), Presence scaling guide, Opening/Exploit/Defense reactive economy framework, Dual Wielding rule, Concealment rule, Vocation System v2 framework, and Starship Combat system (entry #15: Scale, stations, hardware dice with Fire Control, system impairment, ship defenses, combat flow, modifications system). Hull Rating corrected to soak-per-impairment model. Jury Rig reworked.
- `data/starship-stations.json` — 5 crew station definitions (Pilot, Gunner, Operator, Engineer, Co-Pilot) with actions, reactions, and station-specific gambits for starship combat. Gunner station gambits: Linked Fire, Ion Pulse, Overcharge, Concussive Blast. Operator gambits: Ghost Protocol, Slice Systems. Co-Pilot gambits: Anticipate, Calculated Withdrawal. Pilot/Engineer station gambits removed (old Punch It, Barrel Roll, etc. cleaned up). Jury Rig reworked: Power = damaged system die, all repairs permanent, Fleeting = tactical bypass (1 round), Masterful = 1 step recovery, Legendary = 2 steps on one or 1 step on two, failure = wasted action only.
- `data/starship-weapons.json` — 9 ship weapon definitions (Light Laser, Medium Laser, Medium Turbolaser, Heavy Turbolaser, Ion Cannon, Proton Torpedo, Concussion Missile, Quad Laser, Ventral Cannon) with chassis types, arcs, range arrays, and traits. No per-weapon powerDie — all weapons use the ship's Fire Control system die. No weapon-level gambits — gambits are station-level on the Gunner.
- `data/starship-hardware.json` — 5 hardware system definitions (Handling, Engines, Shields, Sensors, Fire Control) serving as Power dice at stations, with impairment rules (Impaired/Debilitated/Offline). "Weapon Mounts" renamed to "Fire Control" — a single Power die for all weapons.
- `data/starship-modifications.json` — 18 starship modifications (6 Handling, 6 Shields, 6 Engines) gated by hardware die level. D8: 2 mods (1 passive + 1 gambit), D10: 2 mods (1 passive + 1 gambit), D12: 2 exclusive passives (pick one = ship identity). D12 Handling: Corellian Wake (doubles 8+ bonus on Handling actions) vs Micro-Jump via Handling (precision nav-abort failure). D12 Shields: Impenetrable Baffles (+1 Buffered per Reinforce tier) vs Aegis Protocol (extend shields to allies). D12 Engines: Class Zero Hyperdrive (0.5 hyperdrive + Micro-Jump via Engines) vs Oversized Reactor Core (Engines soaks Hull Rating + 2 on impairment). Sensors and Fire Control mods not yet designed.
- `data/galaxy-planets.json` — 65 canonical Star Wars planets with normalized galactic coordinates (0-1 range), region, sector, lore descriptions era-appropriate to 16 BBY, and campaign flags. Used by the interactive Galaxy Map.
- `data/galaxy-hyperlanes.json` — 6 major hyperlane trade routes (Corellian Run, Corellian Trade Spine, Hydian Way, Perlemian Trade Route, Rimma Trade Route, Triellus Trade Route) as polyline coordinate arrays with colors. Used by the Galaxy Map.
- `data/default-ship.json` — Default YT-1300-style ship (Krayt Fang) with hull integrity, hullRating, systems (handling/engines/shields/sensors/fire_control), weapon mounts, empty modifications array, and station assignments for starship combat mode.
- `data/threats.json` — NPC Threat Builder data: Fulcrum rules system (Tier 0-5, Arena Scores 1-5, 5 Tactical Roles × 4 Power Sources, 4 Classifications, 64 Traits, 26 Tags, 22-entry Gambit Pool). 5 tactical function roles (Threat/Anchor/Harrier/Controller/Support) × 4 power sources (Martial/Ranged/Force/Leader) = 20 fully designed ability kits. Each role has a `passive` (e.g. Threat: +1 Power, Anchor: +1 Defense, Harrier: +1 zone movement, Controller: condition duration step-up, Support: ally defense aura). Each role+powerSource provides: action/signature (with F/M/L npcEffects track + defense type + isAttack flag + optional pipCost), `gambits` array (1-2 riders at -1 Power), exploit (reaction trigger). Non-attack signatures (isAttack:false) render conditions/buffs instead of chassis damage (Controller conditions, Support heals/buffs, Leader commands). Power source auto-suggested from highest arena but GM-overridable. NPC stat formulas: Initiative=Tier+(Wits×2)+Mods, Defense=max(Physique,Reflex)+Tier, Evasion=Reflex+Tier, Resist=Grit+Tier, Vitality=(Physique+Grit+Tier)×classMod, Power=Arena+Tier. 5 threat categories: character (scale 1), vehicle (scale 2), starship (scale 3), capital_ship (scale 4), station (scale 5). Scale traits have `autoApply: true`. Traits support `powerMod` and `initiativeMod`. Ship-flavored arena labels: Firepower/Handling/Hull/Sensors/Command for ships; Armor/Handling/Hull/Sensors/Presence for vehicles. Old role IDs auto-migrated via OLD_ROLE_MAP in npc-builder.js
- `data/scum-and-villainy.md` — Definitive human-readable reference for the NPC threat-building system. Covers: chassis (tier/arenas/classifications/categories), role system (5 roles × 4 power sources), full ability matrices, traits, tags, gambit pool, universal actions/maneuvers, conditions, resolution scale, encounter design patterns, and prebuilt NPCs. Serves as both GM reference and backbone knowledge document for all threat-related development.
- `data/maneuvers.json` — universal actions + discipline gambits (object: `universalActions[15]` incl. Join Battle + Resist, `forceManeuvers[3]` (Centering Focus, Force Sense, Telekinesis), `disciplineGambits{25 sets, 75 gambits}` (Alter gambits: Force Shove D8, Mind Trick D10, Hurl D12), `vocationManeuvers[14]` — Dead Drop (Gunslinger T3), Slip (Ghost T3), Arise (Ichor Witch T4), True Possession (Ichor Witch T5), Read the Room (Noble T2), Compel (Noble T3), Keen Insight (Investigator T3), Shatterpoint Sense (Seer T3), Shatterpoint Strike (Seer T5), Enhance Attribute (Altus Sopor T2), Force Speed (Altus Sopor T3), Emptiness (Altus Sopor T5), Kinetic Impulse (Telekinetic Savant T1), Kinetic Combat (Telekinetic Savant T3)). Move action has explicit combat tiers. Join Battle uses Free type. Dodge/Endure/Resist are Defense type (free, no Exploit pip cost). Base Alter Telekinesis maneuver is pure object movement (tiered by scale); Kinetic Impulse (push/pull people) moved to Telekinetic Savant vocation. Crush gambit replaced by Hurl gambit (throw lifted objects at targets).
- `data/glossary.json` — 73 entries including 23 conditions + Natural Recovery rule with conditionType/pcEffect/npcEffect fields. All 25 disciplines include `narrativeTiers`. 18 starship combat entries (Scale, Hardware Die, Station, Integrity, Hull Rating, System Impairment, Called Shot, Evade/Endure/Resist ship versions, Engaged/Close/Far ship range bands, Fire Control, Firing Arc, plus conditions [Elusive], [Jammed], [Disabled]). Weapon Mount entry replaced with Fire Control entry. Hull Rating corrected to soak-per-impairment model. Consumed by the Player's Handbook panel.
- `data/locations.json` — 9 campaign location profiles (Jakku, Ajan Kloss, Takodana, Bespin, Endor, Malpaz, Eriadu, Batuu, Xala). Each has full astrographical data (region, sector, system, grid square, suns, moons, trade routes, rotation/orbital periods, navigation hazards), physical data (class, atmosphere, climate, terrain, surface water, gravity), societal data (native/other species, population, settlements, government, exports, affiliation), points of interest, fauna/flora, campaign-specific notes with era context and key locations, and lore text. Adventures reference locations by ID. Geographic arc: Jakku (I-13) → Ajan Kloss (L-5) → Takodana (J-16) → Bespin (K-18) → Endor (H-16) → Malpaz (I-17) → Eriadu (M-18) → Batuu (G-15) → Xala (H-14) → Malpaz again (I-17). Campaign sweeps through Western Reaches, pushes to Endor frontier, pulls back through Outer Rim for mid-campaign betrayal, drives deep west to Batuu/Wild Space, races back to Malpaz for finale.
- `data/adventures/adv1.json` through `data/adventures/adv10.json` — per-adventure JSON files, each containing one adventure object (not wrapped in an `adventures` array). Server assembles them into `{ adventures: [...] }` for the API. NPCs are stored inline with full threatBuild data including attacks, arenas, roleKit, and computed stats. GM edits to scene NPCs (via Threat Builder) persist back to individual adventure files via PUT `/api/campaign/scene/:sceneId/npc/:npcIndex`. New NPCs can be added via POST and removed via DELETE. Computed-only fields (`computedAttacks`) are stripped before persistence; `computed` stats are preserved. Each adventure has a `locations` array referencing location IDs from locations.json. Adventures 1–3 have scene-level intelligence tags: `challengeType` (social|combat|infiltration|survival|technical|force), `destinyTags` (array of destiny IDs), `vocationTags` (array of kit IDs), `disciplineTags` (array of discipline IDs), `gearFlags` (array of gear trait keywords). Adventure 1 ("The Traitor's Gambit") is a clean rewrite aligned to the campaign bible: Maya owns/flies the Banshee, no Accountant/carbonite, Switch's deal is reduced-fee-for-intel-assets, code cylinder authenticates into shuttle nav computers, Ganga Lor is killed at Switch's bunker, Varth's authentication key is memorized (no physical data cylinders), Maya provides extraction in climax. Part 1 ("The Jakku Job") has 5 scenes: s1 Bad Business at The Burning Deck (cantina confrontation), s2 Maya's Offer (breather — Maya's pitch, medicine, route scouting), s3 The Processor (Switch's bunker in the Sinkhole), s4 The Gangster's Revenge (Ganga Lor ambush), s5 The Heist (Imperial shuttle infiltration at Reestkii Landing Field). Jakku lore is era-accurate to 17 BBY: Reestkii is a sun-bleached frontier settlement under Varga the Hutt's control (no Niima Outpost, no Starship Graveyard — those are post-Battle of Jakku, 22 years in the future). Switch's bunker is beneath a natural sinkhole in the badlands, accessed through an abandoned moisture vaporator station. Niima the Hutt exists on Jakku (desert temple) but is a minor figure — she rises to power after the PCs kill Varga on Bespin (Adv 4), connecting campaign events to canon. Part 2 ("The Green Hell Extraction") has 6 scenes. All 11 scenes have `encounters[]`, `disciplineChallenges[]` (formerly `skillChecks[]`), `environmentMechanics[]`, `rewards`, `pacing`, expanded `npcs` (behavior/dialogue[]/intel), plus `knackTags[]`, `backgroundTags[]`, `speciesTags[]`, `themeTags[]`. Discipline Challenges use the two-axis resolution format: `actionType` (assess/interact), `arena` (presence/wits/reflex/physique/grit), `target`, `resist`, `risk`, `control` (failure/success/mastery), `effect` (fleeting/masterful/legendary tiers). adv1 has full narrative authoring. Adventure 2 ("A Wretched Hive") Part 1 ("The Shakedown") has 5 scenes: s1 Blackwind Point (Kessra swoop gang shakedown — social/combat, consequence gate for aviary ambush in Part 2), s2 Working the Encampment (group challenge investigation — T1/P3, 10 VP threshold, VP breadcrumb trail tracking Raden through encampment locals, 6 eligible disciplines, 5 encampment NPCs), s3 The Filtration Plant (Raden social scene — talk him down, negotiate or threaten, establishes fortress infiltration plan), s4 The Hit Squad (combat — 4 Trandoshan mercenaries + Heavy Combat Droid, protect Raden, industrial environment hazards), s5 The Court of Varga (throne room audition, TC-663 introduction, Raden seized). Scene 2 introduces a `groupChallenge` JSON schema: `{ name, description, tier, power, vpThreshold, vpScoring: {fleeting,masterful,legendary,masteryBonus}, failureConsequence, thresholds: [{vp,intel}], eligibleDisciplines: [{discipline,approach}] }`. adv2 Part 2 has 4 scenes; adv3-4 have structural fields populated. Adventures 4–10 have empty scene arrays (not yet tagged).

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
- `GET  /api/campaign/locations` — all 9 campaign location profiles
- `GET  /api/campaign/locations/:id` — single location by ID
- `GET  /api/campaign/progress` — current position + completions
- `PUT  /api/campaign/progress` — save position
- `PUT  /api/campaign/scene/:sceneId/complete` — toggle scene completion
- `GET  /api/campaign/lore-tags` — all lore tags
- `GET  /api/campaign/lore-tags/:tag` — scenes for a specific tag
- `GET  /api/campaign/party` — expanded party monitor data (includes destiny, vocations, disciplines, arenas, gear, conditions, background phases)
- `GET  /api/campaign/scene-intel/:sceneId` — scene intelligence engine: cross-references scene tags against party character profiles to produce per-character insights (destiny resonance, vocation matches, key discipline rankings, gear gap warnings, challenge readiness ratings, background ties, knack activations via knackTags, species biological truths + species traits via speciesTags, background environment familiarity via backgroundTags, theme resonance via themeTags). Insights are structured objects with title/description/details[] and are expandable in the frontend UI
- `PATCH /api/characters/:id/advancement` — update advancement state (sanitized/clamped)
- `GET  /api/journal/tags` — list all journal tags (scene-extracted + custom)
- `POST /api/journal/tags` — create custom tag
- `GET  /api/journal/entries` — list entries (optional `?tag=` filter, optional `?scene_id=` filter for hierarchical view)
- `POST /api/journal/entries` — create journal entry with tag associations + optional `source_scene_id`
- `PUT  /api/journal/entries/:id` — update entry title/body/tags
- `DELETE /api/journal/entries/:id` — delete entry
- `POST /api/journal/extract-tags/:sceneId` — extract tags from adventure scene

## Campaign Journal

Two different journal views for players vs GM:

**Player Journal** (handbook tab) — spoiler-safe flat list:
- Shows ONLY completed scenes — no act names, episode titles, or future scenes revealed
- Blank/empty until the first scene is completed ("Your journal will fill as you progress")
- Click a completed scene → scene detail view with Campaign Log + player entries
- Breadcrumb: "Campaign Journal › Scene Title" (no hierarchy spoilers)
- Read-first interaction: click entry to expand/read, Edit button inside expanded view
- New entries created from scene detail auto-link to that scene via `source_scene_id`
- Mission Debrief entries (adventure-level `source_scene_id: 'adventure:advN'`) shown at top of completed scenes list as expandable cards
- Real-time refresh via `journal:updated` socket event (auto-refreshes when journal tab is active and no form is open)

**GM Crew Journal** (command bridge) — full hierarchy:
- Act → Episode → Scene drill-down with completion counts
- Shows all scenes: completed ones clickable, incomplete greyed/locked
- Scene detail shows Campaign Log + player entries (read-only, no edit controls)
- Breadcrumb navigation at all levels

- **DB constraint**: Unique index `idx_journal_entries_scene_author` scoped only to `Campaign Log` author (allows multiple player entries per scene per author)

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

**Character creation flow (9 steps):** Species → Phase 1 (Origin) → Phase 2 (Catalyst) → Phase 3 (Debt) → **Vocations** → **Arenas/Disciplines** (with vocation-aware guidance panel showing required discipline dice) → **Outfitting** (500 cr starting budget) → **Destiny** → **Your Story** → Summary (Confirm & Save). Vocation tiers are uncapped during selection; discipline requirements are validated before proceeding to Outfitting.

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

The GM Black Ledger (`public/gm/index.html`) features a full Campaign Engine as its primary tab.

**Data:** `data/adventures/adv1.json` through `data/adventures/adv10.json` — 10 per-adventure JSON files assembled by the server into `{ adventures: [...] }`. Adventures 1-3 have full scene content (37 scenes total) with readAloud text, GM notes, NPC rosters, hazards, decision points, lore tags, and narrative links. Adventure 1 is a clean rewrite aligned to the campaign bible. Adventures 4-10 have title/part structure only (placeholder).

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

**GM Black Ledger Tabs:** Campaign (default), Combat Tracker, Starship Combat, GM Handbook. The GM Handbook tab consolidates all 8 rules reference categories (Game System, Arenas & Disciplines, Conditions, Maneuvers, Threats, Weapons, Armor, Gear) into a single panel with collapsible `.hb-section` containers, a dedicated search input (`#handbook-search`), and unified real-time search that auto-expands matching sections and collapses empty ones. Each render function targets `#hb-section-<key> .hb-section-body`. The `refreshHandbookFilter()` function is called after every async data render to re-apply any active search query.

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

## Character Data Format (Canonical — Character Creator Output)

All character data uses the **character creator format**. There is one standard:
- `discValues` — flat object keyed by discipline ID → die string (only non-D6 values stored, e.g. `{"stealth":"D10","ranged":"D8"}`)
- `arenaAdj` — flat object keyed by arena ID → step adjustment from species base (e.g. `{"reflex":1,"grit":1}`)
- `startingGear` — array of gear objects with `{id, name, cost, source, acquisition, legalStatus, origin}`
- `kits` — flat object keyed by kit ID → tier number (e.g. `{"voc_ghost":3,"voc_gunslinger":2}`)
- `species` — string (e.g. `"Duros"`, `"Human"`)
- `destiny` — string ID (e.g. `"rescue"`, `"two-light"`)
- `phase1/phase2/phase3` — string IDs of background phases (e.g. `"The Shipboard Born"`)
- `backgroundFavored` — optional array of favored discipline IDs; derived from phases via `BACKGROUND_FAVORED` map when absent

All old-format code paths have been removed. The `expandCharacterData` function in `characters.js` and `extractCharacterProfile` in `campaign.js` both use this format exclusively. During expansion, `startingGear` items are routed by `source` field (`weapon`→`weaponIds`, `armor`→`armorIds`, `gear`→`gearIds`). Market purchases are appended directly to `weaponIds`/`gearIds`/`armorIds` as supplemental fields.

## Armor Storage

Armor is stored as an **array** (`armorIds: [...]`) in character_data, supporting multiple owned armor pieces. The `inventoryRemovals.armor` field is an array of removed armor IDs. Equipment status determines which armor is equipped/carried/stowed; armor without a status entry defaults to `carried` in the loadout panel. The maneuvers panel (`js/maneuvers-panel.js`) applies equipped armor category modifiers to Dodge and Endure defense dice: Endure steps the Physique power die (none=-1, light=0, medium=+1, heavy=+2), Dodge steps the Reflex power die (none=0, light=0, medium=-1, heavy=-2) with `evasionException` and `evasionReduction` support. The panel fetches `data/armor.json` and resolves the equipped armor from equipment status on each render.

## Armory → Market Flow

The Armory panel (`js/armory-panel.js`) has a sticky top bar containing the "Visit the Market" link and a Credits display with +/- controls. The market link navigates to `/market/` with `charId`, `mode=market`, and `returnTo=player` URL params. Credits were moved here from the Advancement panel — the Armory top bar is always visible when scrolling through inventory. The Market page (`js/market.js`) reads these params on boot: if `charId` is present, it fetches the character via `/api/characters/:id` and auto-selects them (skipping the character gate). The player's theme carries via `localStorage` (`eote-theme`). When `returnTo=player`, a "Character Sheet" return link appears in the market header. After purchasing, the player can return to their character sheet where the new equipment will be loaded.

## Sell Items

Items in the Armory panel have a "Sell" button (amber-styled) alongside existing Drop buttons. Clicking it opens a sell confirmation modal with a percentage stepper (default 50%, adjustable 5–100% in 5% increments). The sell endpoint (`POST /api/inventory/:charId/sell`) removes the item from inventory (via `inventoryRemovals`), adds credits to the character, and cleans up `equipment_status`. Items with `cost: 0` or no cost do not show a sell button.

## Database

SQLite database auto-created and seeded on first run at `db/campaign.db`.  
Tables: `characters`, `campaign_state`, `equipment_status`, `sessions`, `campaign_progress`, `scene_completion`, `campaign_decisions`.

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

## HoloNet News Feed

GM-triggered in-universe Imperial propaganda broadcasts with player overlays and journal clipping.

**Data:** `data/holonet.json` — ~20 stories across 6 feed groups (pre-campaign, post-adv1-3, general 16 BBY). Story types: `propaganda`, `consequence`, `foreshadow`, `lore`, `flavor`.

**DB table:** `holonet_broadcasts` — tracks broadcast history (feed_id, story_ids, broadcast_by, broadcast_at).

**Server:**
- `GET /api/campaign/holonet/feeds` — returns all feeds + broadcast history (player-accessible)
- `GET /api/campaign/holonet/history` — broadcast history
- `POST /api/campaign/holonet/broadcast` — GM broadcasts selected stories, emits `holonet:incoming` socket event to players room server-side
- Socket: `holonet:broadcast` event handler (GM→players room)

**GM UI:** HoloNet tile in Command Bridge scene dashboard. Story browser with type badges, sent status, checkbox multi-select, broadcast button. Panel ID: `fp-holonet`, built via `_buildHoloNetHtml()` / `_bindHolonetHandlers()` in `js/command-bridge.js`.

**Player Overlay:** `js/holonet-overlay.js` — Imperial terminal aesthetic overlay triggered by `holonet:incoming` socket event. Features scanline animation, gold-on-dark terminal chrome, per-story "Clip to Journal" button (creates journal entry via `POST /api/journal/entries` with `source_scene_id: 'holonet'`). Close via X button or backdrop click.

**Auth:** Player GET access to `/api/campaign/holonet/feeds` whitelisted in `server/auth.js`.

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

**Persistence:** Pool stored in `campaign_state` table (key: `destiny_pool`). Lock state stored as `destiny_locked` in same table. Both survive server restarts. On reconnect, current pool state + lock flag sent immediately via `destiny:sync`.

**Pool Locking:** GM can lock the destiny pool via "Lock Pool" button. When locked: player connect/disconnect events do NOT rebuild the pool — flips and taps persist permanently until the GM changes them. Unlocking rebuilds the pool from currently connected characters. Reset also unlocks the pool. Lock state is persisted in DB and survives server restarts. All `destiny:sync` emissions include `{ pool, locked }` for consistent client state.

**Player view:** Footer renders tokens dynamically from `destiny:sync` events. Display-only (no click-to-flip). Uses existing force-token CSS (blue = hope, red pulsing = toll).

**GM view:** Destiny bar below header in Black Ledger. Clickable tokens emit `destiny:flip`. Shows Hope/Toll count. Three buttons: Lock Pool (toggles to Unlock Pool when locked, filled accent style), Untap All, Reset Pool. LOCKED badge appears in count area when pool is locked.

**Files:** `server/sockets/handlers.js` (pool logic), `js/socket-client.js` (player rendering), `public/gm/index.html` (GM controls + styles).

## Inventory Management

Gear items tagged `Consumable` (Bacta Patches, Grenades, Stim Packs, etc.) can be **used** from the Armory or Loadout panels — each use decrements quantity by 1. All items (gear, weapons, armor) can be **dropped** to remove from inventory.

**Persistence model:** Inventory removals are tracked via `inventoryRemovals` field in `character_data` JSON: `{ gear: ["id", ...], weapons: ["id", ...], armor: ["id", ...] }`. All three are arrays of removed item IDs. The `expandCharacterData` function applies these removals after building the full equipment lists. This preserves original creation data (startingGear) while tracking consumption/drops.

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

**Purchase Flow:** "Confirm Purchase" button appears when a price total is calculated. Opens a modal showing itemized costs with acquisition tags (Legal/Registered/Contraband/Salvaged), total, current balance, and remaining balance after purchase. Calls `POST /api/characters/:id/purchase` which deducts credits, adds items to `weaponIds`/`armorIds`/`gearIds`, and stores acquisition type in `character_data.acquisitionMap`.

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

## Campaign Decision Tracker

Tracks key crew decisions throughout the campaign for narrative continuity.

**Database:** `campaign_decisions` table (id, scene_id, adventure_id, decision_key, choice, outcome, campaign_impact, voted, created_at).

**API:** `server/routes/decisions.js` — GET/POST/PUT/DELETE `/api/campaign/decisions`. All decision endpoints restricted to GM only (blocked for players by existing `/api/campaign` gate in `server/auth.js`).

**Socket.io Events:** `decision:poll` (GM→players, sends choices), `decision:vote` (player→GM, sends choiceIndex), `decision:resolve` (GM saves + broadcasts), `decision:cancel-poll`, `decision:vote-received` (GM tallies), `decision:resolved` (all clients refresh). Server state: `_activePoll` in `server/sockets/handlers.js`.

**GM UI (command-bridge.js):** Decision timeline in right sidebar (`#cb-decision-timeline`) grouped by adventure with color-coded impact tags, "Log Decision" button (`#cb-log-decision-btn`), modal with scene decision chip pre-population, campaign impact dropdown (6 known tags), crew vote poll launcher, real-time vote tally display. Scene decision chips in dashboard are clickable to open the modal pre-filled. Scene completion triggers a prompt to log decisions when the scene has decision points.

**Player UI (socket-client.js):** Vote overlay (`decision-vote-overlay`) with choice buttons, auto-dismiss on resolution or cancellation. All rendered text escaped via `_escHtml`.

**Campaign Impact Tags:** maya-fate, denia-fate, varth-relationship, malpaz-uprising, soren-alliance, kessra-grudge.

## Adaptive Adventure Content

Conditionals system that adapts adventure JSON content based on recorded campaign decisions.

**Decision Resolver:** `server/utils/decision-resolver.js` — `resolveDecisionState()` loads all decisions with `campaign_impact` tags and builds a state map (e.g., `{ "maya-fate": "dead", "denia-fate": "rescued" }`). Defaults defined in `IMPACT_DEFAULTS`. `applyAdventureConditionals(adventure, state)` deep-clones and processes all conditionals on scenes/parts/NPCs.

**Conditionals Schema:** Any scene, part, or NPC in adventure JSON can have a `conditionals` array. Each entry: `{ impact, is, replace?: { field: value }, append?: { field: value }, hide?: true }`. Actions: `replace` overwrites fields, `append` adds text, `hide` removes the element.

**Adventure Endpoints:** `GET /api/campaign/adventures` and `GET /api/campaign/adventures/:id` now return adapted content with `_decisionState` and `_adaptations` metadata. Original JSON files are never modified — filtering is applied at read time.

**GM Portal Badges:** Amber `cb-adaptation-badge` indicators appear in scene headers when content has been adapted. Tooltip shows impact tag, condition, and action.

**Active Conditionals:** adv2-p2-s6 (Denia ending, denia-fate:rescued/abandoned), adv8-p1-s3 (Soren reveal, maya-fate:dead), adv10-p1-s2 (Soren death, maya-fate:dead), adv10-p2 (Denia paths, denia-fate:abandoned/rescued).

## AI Mission Summary Generator

Gemini-powered After Action Report generator that creates in-universe mission debriefs from adventure data, decisions, and journal entries.

**Endpoint:** `POST /api/campaign/adventures/:adventureId/summary` — accepts optional `{ partIds: ["adv2-p1", ...] }` body to scope the debrief to specific parts. Assembles context (filtered scenes, completions, decisions, journal entries, crew roster), sends to Gemini 2.5 Flash with military intelligence analyst prompt, returns `{ summary }`.

**Context Assembly:** `assembleMissionContext(adventureId, partIds)` in `server/routes/campaign.js` filters parts and scenes by `partIds` when provided, scopes decisions to matching scene IDs, and gathers journal entries only for those scenes. Returns `scopeParts` metadata for prompt context.

**Scope Selector:** GM opens the Mission Debrief modal → sees a scope selection step with checkboxes for each adventure part. Parts that already have a saved debrief journal entry are marked with a "DEBRIEFED" badge and unchecked by default. GM selects which parts to include, then clicks "Generate Debrief". Already-debriefed parts can be re-selected if needed but are excluded by default to prevent regeneration.

**Source Scene ID Format:** Scoped debriefs save with `source_scene_id: 'parts:adv2-p1,adv2-p2'` (comma-separated part IDs). Legacy full-adventure debriefs use `source_scene_id: 'adventure:advN'`. The scope selector reads existing journal entries to detect both formats.

**GM Review Modal:** After generation, modal shows editable textarea → Regenerate/Save buttons. Save creates a journal entry with `author_character_name = 'Mission Debrief'` and part-scoped title (e.g. "Mission Debrief: A Wretched Hive — Part 1").

**Journal Styling:** Mission Debrief entries render with distinct indigo/purple styling (`.journal-mission-debrief`) in the Crew Journal, separate from Campaign Log entries. Includes collapsible header with "After Action Report" label.

**Error Handling:** 30s timeout, retry-once on truncated JSON, rate-limit retry after 3s (matching backstory.js pattern).

## Narrative Challenge Engine (Hall of Mirrors)

Reusable branching narrative choice system tied to destiny mechanics. Designed for the Ebon Spire encounter (Adventure 4) but usable for any future narrative scene (Force visions, moral dilemmas, interrogation gauntlets).

**Data Files:** `data/narrative-challenges/hall-{destruction,discovery,rescue,creation,corruption,atonement,liberation,ascendancy}.json` — 8 authored linear scenario files, one per destiny type. `hall-rescue-kos.json` — custom Kos Vansen branching scenario ("Chains of the Trandoshan") with Trandoshan slavers, Duros/Wookiee captives (Nila, Khyyra, Grashk, Vel Drenn, Fash), 13 rounds forming a branching tree (1 root + 3 tier-2 + 9 tier-3), 27 unique terminal outcomes. Each choice has `nextRound` pointing to the next round ID; terminal choices omit `nextRound` and include `outcome` text. Linear challenges (no `nextRound` fields) fall back to sequential round ordering.

**Database:** `narrative_challenge_instances` table (id, challenge_id, character_id, adventure_id, scene_id, choices JSON, gm_score, shift_value, shuffle_seed, status, created_at, updated_at). Status lifecycle: active → resolved (auto-resolve on final choice) or active → scored → resolved (legacy GM manual flow). Stale instances (active > 24h) auto-marked 'abandoned' on dashboard load. `shuffle_seed` stores per-instance randomization seed for choice ordering.

**API:** `server/routes/narrative-challenges.js` mounted at `/api`:
- `GET /api/narrative-challenges` — list all challenge summaries (gmOnly)
- `GET /api/narrative-challenges/:id` — full challenge data with rounds/choices (gmOnly)
- `GET /api/narrative-challenges/by-destiny/:destinyId` — filter by destiny type (gmOnly)
- `POST /api/narrative-challenges/instances` — create instance for character (gmOnly, generates shuffle_seed, emits `challenge:start` to player socket)
- `GET /api/narrative-challenges/instances/active` — list active/scored instances (gmOnly)
- `PUT /api/narrative-challenges/instances/:id/choice` — record round choice (gmOnly)
- `PUT /api/narrative-challenges/instances/:id/score` — GM score 1-5 (gmOnly)
- `POST /api/narrative-challenges/resolve` — resolve scored instances, apply spectrum shifts (gmOnly, emits `challenge:resolved` to affected player sockets)
- `POST /api/narrative-challenges/apply-tokens` — untap Hope/Toll/All tokens in destiny pool (gmOnly)
- `GET /api/narrative-challenges/player/active` — player's active challenge with shuffled choices (player role, no alignment labels)
- `PUT /api/narrative-challenges/player/choice` — player submits round choice (player role, validates round_id/choice_id, emits `challenge:player-choice` to GM room)
- `POST /api/narrative-challenges/journal` — create journal entries per character (gmOnly)

**Scoring Mechanics:** GM scores 1-5 per character → shift value: 1→-1 (toward Dark/Survivor), 2-4→0 (hold), 5→+1 (toward Light/Idealist). Spectrum order: Two Dark ↔ Light & Dark ↔ Two Light. Party sum of all shift values determines token refresh: >0 untaps Hope, <0 untaps Toll, =0 (Equilibrium/Revan's Balance) untaps ALL tokens.

**Narrative Conditions (Hall of Mirrors):** When a hall-of-mirrors challenge resolves with a non-zero destiny shift, the character receives a persistent narrative condition tag stored in `activeEffects`: **Darkside Resonance** (dark shift, `darkside_resonance`, purple `#7c3aed`) — while in the darkside nexus, spending Toll also grants Empowered on Violence actions; **Beacon** (light shift, `beacon`, gold `#f59e0b`) — while in the darkside nexus, spending Hope grants Optimized on next non-violent action. Neutral shift = no condition. These are GM-adjudicated tags (no automated mechanical effect), applied via `applyHallOfMirrorsCondition()` helper in both auto-resolve and manual resolve paths. Previous opposite condition is always replaced. Conditions appear in combat tracker condition panel (sorted alphabetically with all other conditions).

**GM UI (command-bridge.js):** "Narrative Challenges" section in right sidebar with "+ New" launcher button. Challenge launcher modal (select from 8 destiny scenarios + assign characters, "Auto-Assign by Destiny" button matches characters to challenges by personal destiny). Challenge runner modal (read prompts, select choices per round, live "X/Y chosen" badge showing player progress in real-time). Auto-resolve: when a player finishes all rounds, the system auto-calculates score (light=5/neutral=3/dark=1 averaged), applies destiny shift, creates journal entry, updates token pool, and emits resolution — no GM approval needed. GM sees toast notification and refreshed status. Legacy manual score/resolve still available. Active instances load without adventure_id filtering so dashboard always shows all in-flight challenges.

**Player UI (socket-client.js):** Challenge modal overlay on player character sheet. Triggered by `challenge:start` socket event or auto-detected on session join via `_checkForActiveChallenge()`. Shows setup narrative, then rounds one at a time with choices in shuffled order (no alignment labels visible). Player clicks choice → sees narration aftermath → advances to next round. On final round, button reads "View Your Destiny" → auto-resolve fires → player sees resolution screen with destiny outcome text, shift result, and score. Reconnecting players with in-flight challenges resume at correct round (based on recorded choices count). `challenge:resolved` socket event renders full resolved modal as fallback if HTTP response didn't already handle it.

**Socket Events:**
- `challenge:start` — GM launch → emitted to targeted player socket with shuffled challenge data
- `challenge:player-choice` — player PUT choice → relayed to GM room with progress counts
- `challenge:resolved` — auto-resolve or GM manual → emitted to affected player sockets with token outcome
- `challenge:auto-resolved` — emitted to GM room on auto-resolve with score/shift/journal details

**Branching Navigation:** Choices can have optional `nextRound` string pointing to the next round's ID, forming a tree via flat array. Terminal choices (no `nextRound`) include `outcome` text shown to the player as the final narration. Player client tracks round-by-ID navigation via `_getNextRoundId()` which follows the choice chain from `existingChoices`. GM runner shows only traversed rounds (filtered by recorded choice round_ids + next pending round). Auto-score and `isChallengeComplete()` both handle branching: completion is detected when the last choice has no `nextRound`. Linear challenges (no `nextRound` on any choice) fall back to sequential index-based navigation.

**Choice Shuffling:** LCG seeded shuffle (`seededShuffle(arr, seed + roundIndex)`) ensures choices appear in randomized order per player per round. Alignment labels (`light`/`dark`/`neutral`) stripped before sending to player via `shuffleChoicesForPlayer()`. `nextRound` and `outcome` fields preserved through shuffle. Seed stored in DB `shuffle_seed` column.

## Deployment

Configured as a **VM** deployment (always-on required for Socket.io persistent connections).  
Build command: `npm run css:build`  
Run command: `node server/index.js`
