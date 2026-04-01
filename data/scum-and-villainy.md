# Scum & Villainy — The Definitive Guide to Building Threats

*Fulcrum RPG — NPC Threat Builder Reference*

---

## Core Philosophy

NPCs in Fulcrum are **static obstacles**, not characters with dice pools. They never roll. They ARE the values that PCs roll against. Every NPC is defined by three axes:

1. **Chassis** — Tier + Arenas + Classification = the raw math (Power, Defense, Evasion, Resist, Vitality)
2. **Role** — Tactical function template that defines HOW the NPC fights (Action, Maneuver, Gambit, Exploit)
3. **Power Source** — Flavors the Role's abilities based on the NPC's combat style (Martial, Ranged, Force, Leader)

The GM picks Role + Power Source. The system assembles the right ability set. The NPC card displays everything the GM needs to run the encounter — no lookups, no memory.

---

## Part 1: The Chassis

### Tier (Competence Level)

| Tier | Label | Actions/Round | Gambit Access | Die |
|------|-------|:---:|:---:|:---:|
| 0 | Civilian | 1 | No | d6 |
| 1 | Trained | 1 | No | d6 |
| 2 | Professional | 1 | Yes | d8 |
| 3 | Veteran | 2 | Yes | d10 |
| 4 | Elite | 2 | Full | d12 |
| 5 | Legendary | 3 | Full | d12 |

### Arenas (The Five Attributes)

Every NPC has 5 arena scores (1–5):

| Arena | Governs | Derived Stats |
|-------|---------|---------------|
| **Physique** | Strength, toughness, melee | Defense (with Reflex), Vitality |
| **Reflex** | Speed, agility, ranged | Defense (with Physique), Evasion |
| **Grit** | Willpower, endurance, Force control | Resist, Vitality |
| **Wits** | Perception, tactics, awareness | Initiative |
| **Presence** | Leadership, intimidation, Force alter | Social influence |

### Stat Formulas

| Stat | Formula | What It Does |
|------|---------|--------------|
| **Power** | Arena + Tier | The "Risk" PCs roll against. Weapon attacks use the relevant arena. |
| **Defense** | max(Physique, Reflex) + Tier | Physical attack threshold (Endure defense) |
| **Evasion** | Reflex + Tier | Dodge threshold |
| **Resist** | Grit + Tier | Social, mental, and Force threshold |
| **Vitality** | (Physique + Grit + Tier) × classMod | Hit points |
| **Initiative** | Tier + (Wits × 2) + mods | Turn order value |

### Classifications (Durability Templates)

| Classification | Vitality Mod | Exploit Mod | Special Rule |
|----------------|:---:|:---:|---|
| **Minion** | ×1 | +0 | Any Masterful+ hit = instant takedown |
| **Standard** | ×1 | +0 | Baseline NPC |
| **Elite** | ×1.5 | +1 | Tougher, extra reaction |
| **Boss** | ×2 | N-1 (N = players) | Encounter-defining; multiple reactions per round |

### Threat Categories (Scale)

| Category | Scale | Examples |
|----------|:---:|---------|
| Character | 1 | Stormtrooper, bounty hunter, crime lord |
| Vehicle | 2 | Speeder bike, AT-ST, landspeeder |
| Starship | 3 | TIE Fighter, YT-1300, shuttle |
| Capital Ship | 4 | Star Destroyer, corvette, frigate |
| Station | 5 | Space station, orbital platform |

Scale traits (`scale_vehicle`, `scale_starship`, etc.) auto-apply and provide ship-flavored arena labels:
- **Ships:** Firepower / Handling / Hull / Sensors / Command
- **Vehicles:** Armor / Handling / Hull / Sensors / Presence

---

## Part 2: The Role System

### 5 Tactical Roles

Roles define **what the NPC does tactically** — not what weapon it carries or what career it has. A role is a function template.

| Role | Tactical Identity | The GM Thinks... |
|------|------------------|-----------------|
| **Threat** | High-damage priority target | "Kill this one first or it kills you" |
| **Anchor** | Holds ground, blocks access, protects | "You can't get past me" |
| **Harrier** | Strikes and repositions, forces split attention | "I'm never where you want me to be" |
| **Controller** | Shapes the battlefield, denies options | "My zone is a bad place to be" |
| **Support** | Force multiplier, enables allies | "Kill me first or my allies keep getting stronger" |

### Role Action Economy

Every role provides exactly 4 ability slots:

| Slot | Type | Description |
|------|------|-------------|
| **Action** | Offensive | The role's signature attack. Uses the NPC's weapon chassis + arena. Includes F/M/L npcEffects track showing escalating consequences when the PC fails defense. |
| **Maneuver** | Supplementary | Modifies or enhances a universal maneuver (Aim, Move, Take Cover, Overwatch, Coordinate). Typically diceless. Should feel like a tweak to something the GM already knows — not a new mechanic. |
| **Gambit** | Rider | Costs -1 Power. Adds a condition rider to an attack. Available at Tier 2+. Must achieve Masterful+ to activate. |
| **Exploit** | Reaction | Triggered ability that costs an Exploit pip. A clear "if X happens, I do Y" structure. |

### The npcEffects Track (Delta Scale)

When an NPC attacks, the PC rolls defense. The negative delta determines the consequence tier:

| NPC Effect Tier | Delta (NPC Power − PC Roll) | Severity |
|:---:|:---:|---|
| **Fleeting** | 1–3 | Minor — base chassis damage, maybe one soft condition |
| **Masterful** | 4–7 | Serious — chassis damage + a hard condition or positioning effect |
| **Legendary** | 8+ | Devastating — chassis damage + multiple conditions or severe positioning |

Each role's Action defines its own npcEffects track. The weapon chassis provides the base damage; the role adds conditions and tactical riders that escalate by tier.

---

## Part 3: Power Sources

### The Problem Power Sources Solve

A Harrier who dual-wields vibroblades plays completely differently from a Harrier who snipes from 10 zones away. If the role abilities only describe one style, half the NPC concepts break. Power Sources flavor each role's abilities to match the NPC's combat style.

### 4 Power Sources

| Power Source | Combat Style | Typical Arena (not locked) | Examples |
|---|---|---|---|
| **Martial** | Close combat — blades, fists, claws, brawling | Usually Physique, but Reflex duelists or Grit brawlers fit | Trandoshan enforcer, vibroblade assassin, Wookiee berserker, rancor |
| **Ranged** | Distance combat — blasters, rifles, thrown weapons | Usually Reflex, but Physique hurlers or Wits marksmen fit | Sniper, scout trooper, gunslinger, turret emplacement |
| **Force** | Force powers — telekinesis, lightning, mind tricks | Could be Grit (Control), Wits (Sense), or Presence (Alter) | Sith apprentice, Nightsister, Inquisitor, dark side beast |
| **Leader** | Commands, coordinates, social manipulation | Wits (tactician) or Presence (inspiring/intimidating) | Imperial officer, crime lord, squad commander, Hutt |

### How Power Source Selection Works

The GM picks the Role in the builder, then selects a Power Source from a dropdown. The system suggests a power source based on the NPC's highest arena, but the GM can override:

| Highest Arena | Suggested Power Source |
|---|---|
| Physique | Martial |
| Reflex | Ranged |
| Grit | Force |
| Wits | Leader (or Ranged for sniper-types) |
| Presence | Leader (or Force for Alter users) |

The builder then assembles the role abilities from the correct power source variant.

### What Changes Per Power Source

Each power source variant modifies the role's:
- **Action** — Same F/M/L structure but different condition riders and defense targeting
- **Maneuver** — Different universal maneuver modified (Move for Martial, Aim for Ranged, etc.)
- **Gambit** — Different rider condition appropriate to the style
- **Exploit** — Different trigger and effect matching the combat range/style

What stays the same: the tactical identity. A Threat/Martial and a Threat/Ranged both say "I am the damage priority" — they just express it differently.

---

## Part 4: Role × Power Source — Complete Matrix

### HARRIER (Reference Design)

**Core identity:** Strike, reposition, punish static targets. The Harrier is never where you want it to be.

#### HARRIER / MARTIAL
*Vibroblade assassin, predatory beast, dual-wielding enforcer*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Blindside** | Weapon attack. Defense: dodge/endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Exposed] |
| | L (8+) | Chassis damage + [Exposed] + free Move 1 zone (no Opening) |
| **Maneuver** | **Slip Away** | Modifies Move. When disengaging, does not present an Opening to the target of its last attack. Move up to 2 zones. |
| **Gambit** | **Hamstring** | -1 Power. Rider: [Slowed] |
| **Exploit** | **Pursuit** | Trigger: A PC in the Harrier's zone uses Move to leave. Effect: Harrier immediately moves to the same zone (no Opening). |

#### HARRIER / RANGED
*Scout trooper on speeder, gunslinger, jet-pack bounty hunter*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Strafing Shot** | Weapon attack. Defense: dodge/endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Suppressed] |
| | L (8+) | Chassis damage + [Suppressed] + [Exposed] |
| **Maneuver** | **Reposition** | Modifies Move. Move up to 2 zones. If the Harrier ends farther from all enemies than it started, +1 Power on next attack. |
| **Gambit** | **Pinning Fire** | -1 Power. Rider: [Slowed] |
| **Exploit** | **Snap Shot** | Trigger: A PC uses Move to enter or cross a zone within weapon range. Effect: Immediately attack that PC. |

#### HARRIER / FORCE
*Force-assisted leaps, telekinetic shoves, Nightsister blink attacks*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Force Lash** | Force attack. Defense: resist |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + push target 1 zone |
| | L (8+) | Chassis damage + push 1 zone + [Dazed] |
| **Maneuver** | **Phase Step** | Modifies Move. Move up to 2 zones, ignoring Engaged status entirely (no Opening, no disengage check). Cannot be intercepted. |
| **Gambit** | **Sever** | -1 Power. Rider: [Disoriented] |
| **Exploit** | **Vanish** | Trigger: The Harrier takes damage. Effect: Immediately move 1 zone (no Opening). |

#### HARRIER / LEADER
*Officer who sends squads to flank, gang boss repositioning thugs*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Directed Assault** | Weapon or command. Defense: dodge/endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + one ally in adjacent zone may move 1 zone toward target |
| | L (8+) | Chassis damage + ally moves 1 zone + that ally gains [Optimized] |
| **Maneuver** | **Regroup** | Diceless. Choose one ally within 2 zones — that ally immediately moves 1 zone (Leader's choice). |
| **Gambit** | **Outflank** | -1 Power. Rider: [Exposed] — coordinated positioning strips cover. |
| **Exploit** | **Tactical Withdrawal** | Trigger: An ally in the Leader-Harrier's zone drops below half Vitality. Effect: That ally immediately moves 1 zone (no Opening). |

---

### THREAT

*Remaining roles to be designed — see Task #85*

### ANCHOR

*To be designed*

### CONTROLLER

*To be designed*

### SUPPORT

*To be designed*

---

## Part 5: Traits

### Combat Traits

| Trait | Effect | Role Affinity |
|-------|--------|:---:|
| Armored (Light) | +1 Defense, -1 Evasion | Anchor, Harrier |
| Armored (Medium) | +2 Defense, -1 Evasion | Anchor, Support |
| Armored (Heavy) | +3 Defense, -2 Evasion | Threat |
| Iron Clad | Defense cannot be reduced below base | Threat, Anchor |
| Tough | +2 Vitality | Threat |
| Disciplined | Immune to [Rattled] | Anchor, Support, Threat |
| Agile | +1 Evasion | Harrier, Threat |
| Force Sensitive | Allows Force maneuvers | Controller |
| Cybernetic | +1 to one arena (GM choice) | Controller, Harrier |
| Fearless | Immune to [Shaken] from social | Threat |
| Veteran | +1 Initiative | Support, Threat |
| Shield Generator | [Buffered 2] at start of combat | Anchor, Support |
| Jetpack | Can move vertically, ignore terrain | Harrier |

### Social Traits

Social traits define how NPCs react to social interactions — they create the NPC's personality at the table.

| Trait | Reactive Behavior | Role Affinity |
|-------|------------------|:---:|
| Loom | Intimidation backlash — PC gets [Rattled] on fail | Threat |
| Corruptible | Can be bribed; reveals price on Masterful+ Insight | Controller |
| Thick-Skinned | Social attacks step down 1 tier | Threat, Support |
| Follows the Boss | Won't break from leader; immune to solo persuasion | Anchor |
| Transactional | Always looking for a deal; responds to offers | Controller, Support |
| Paranoid | Suspects deception; Deception checks +2 difficulty | Harrier, Support |
| Vain | Flattery works; Charm gains [Optimized] against them | Controller |
| Loyal | Cannot be turned against allies; immune to bribery | Anchor, Support |
| Interrogator | Can extract info; social attacks inflict [Rattled] | Harrier, Controller |
| Connected | Has useful contacts; reveals intel on social success | Support, Controller |
| Slippery | Deception defense is [Optimized]; hard to pin down | Harrier, Controller |
| Grudge Holder | Remembers slights; focuses attacks on PCs who insulted them | Threat |

### Scale Traits (Auto-Applied by Category)

| Trait | Category | Effect |
|-------|----------|--------|
| Scale: Vehicle | Vehicle | Scale 2 — steps up damage vs characters |
| Scale: Starship | Starship | Scale 3 — ship-flavored arenas |
| Scale: Capital Ship | Capital Ship | Scale 4 |
| Scale: Station | Station | Scale 5 |

### Vehicle/Ship Traits

Armored Hull, Reinforced Hull, Stationary, Automated, Fast, Lumbering, Anti-Personnel, Anti-Vehicle, Deflector Shields, Turbolaser Battery (+1 Power), Ion Cannons, Walker, Speeder, Mounted Weapon (+1 Power), Open Cockpit, Enclosed Cabin, Tracked/Wheeled.

---

## Part 6: Tags

Tags are narrative labels — faction, type, and special permissions.

| Tag | Mechanical Note |
|-----|----------------|
| Imperial | May call reinforcements |
| Criminal | Black market connections |
| Droid | Immune to social/poison, vulnerable to ion, can be [Shut Down] |
| Force User | Access to Force maneuvers |
| Inquisitor | Force User + lightsaber + imperial authority |
| Bounty Hunter Guild | Tracking resources, guild contracts |
| Mandalorian | Cultural combat bonuses, beskar armor |
| Leader | Commands other NPCs |
| Emplacement | Cannot move, fixed position |
| Civilian | Non-combatant, no combat actions |
| Flagship | +1 Initiative for all allied ships |

Full tag list: Imperial, Criminal, Hutt Cartel, Droid, Force User, Inquisitor, Jedi, Mercenary, Civilian, Separatist, Slaver, Swoop Gang, Informant, Leader, Emplacement, Imperial Navy, Pirate, Clone Wars Relic, Rebel Alliance, Smuggler Vessel, Corporate, Bounty Hunter Guild, Mandalorian, Patrol Craft, Flagship, Orbital Defense.

---

## Part 7: NPC Gambit Pool

These are additional gambits any NPC can equip (stored as `extraGambits`). They cost -1 Power and add a rider condition. Available at Tier 2+.

### Melee Gambits

| Gambit | Source | Rider | Suggested Roles |
|--------|--------|-------|:---:|
| Clinch | Brawl | [Slowed] | Threat |
| Takedown | Brawl | [Prone] | Threat, Harrier |
| Vice Grip | Brawl | [Restrained] | Threat |
| Feint | Deception | [Exposed] | Harrier, Threat |
| Menacing Strike | Intimidate | [Rattled] | Threat |
| Exposing Strike | Melee | Target presents Opening | Threat, Harrier |
| Bantha Rush | Athletics | Push 1 zone | Threat |
| The Slam | Athletics | Push 1 zone + [Prone] | Threat |
| Cleaving Arc | Melee | Hit second target (reduced tier) | Threat |
| Parry | Melee | [Optimized] on all defenses until next turn | Threat |

### Ranged Gambits

| Gambit | Source | Rider | Suggested Roles |
|--------|--------|-------|:---:|
| Suppressive Fire | Ranged | [Rattled] | Anchor, Threat, Support |
| Pinning Shot | Ranged | [Suppressed] | Anchor, Threat |
| Covering Fire | Tactics | Block Openings vs chosen ally | Anchor, Support |
| Trick Shot | Ranged | Narrative environmental effect | Threat, Harrier |
| Walking Fire | Heavy Weapons | [Suppressed] | Anchor |
| Danger Close | Heavy Weapons | Hit all targets in zone (reduced tier) | Anchor |
| Scorched Earth | Heavy Weapons | [Hazard 2] Ongoing in zone | Anchor, Controller |

### Social / Special Gambits

| Gambit | Source | Rider | Suggested Roles |
|--------|--------|-------|:---:|
| Holdout | Skulduggery | Concealed weapon, target unaware | Harrier, Controller |
| Misdirect | Deception | Target wastes next action | Controller, Harrier |
| Break Composure | Intimidate | Reveal motivation | Controller, Threat |
| Demoralizing Strike | Intimidate | Resist -2, Ongoing | Threat, Controller |
| Force Shove | Alter | Push 1 zone (telekinetic) | Controller |

---

## Part 8: Universal Actions & Maneuvers

NPCs share the same universal action list as PCs. The role modifies HOW specific maneuvers work — it does not replace them.

### Actions (Cost: 1 Action pip)

| Action | Resolution | Notes |
|--------|-----------|-------|
| **Attack** | Discipline (Arena) vs Defense/Evasion/Resist | Base damage from weapon chassis. Role Action adds riders. |
| **Treat Injury** | Medicine vs difficulty | Presents Opening if in combat. |
| **Interact** | Various disciplines | Non-combat tasks (Tech, Skulduggery, etc.) |

### Maneuvers (Cost: 1 Maneuver pip — diceless unless noted)

| Maneuver | Effect | Notes |
|----------|--------|-------|
| **Move** | Move up to 2 zones | If Engaged: must disengage (presents Opening on failure) |
| **Aim** | Roll Ranged(Reflex). F: [Optimized], M: [Optimized] + step up tier, L: [Optimized] + [Empowered] | Requires line of sight |
| **Take Cover** | Roll Tactics(Wits). Gain [Cover 1-4] based on tier | Defensive positioning |
| **Overwatch** | Declare a zone. PCs acting in it present Openings | Area denial |
| **Reload** | Restore weapon clip | Diceless |
| **Draw/Holster** | Change equipped weapon | Diceless |
| **Coordinate** | Roll Tactics. Grant allies actions or [Optimized] | Leadership |
| **Assess** | Roll Investigation/Insight. Ask 1-3 questions based on tier | Intelligence gathering |

### Defenses (Free — no pip cost)

| Defense | Used Against | Notes |
|---------|-------------|-------|
| **Dodge** | Physical attacks (Evasion) | Avoid entirely |
| **Endure** | Physical attacks (Defense) | Absorb/reduce |
| **Resist** | Social, mental, Force (Resist) | Willpower |

### Exploits (Cost: 1 Exploit pip — reaction)

NPCs gain Exploit pips from Classification:
- Standard/Minion: 1 pip (base)
- Elite: 2 pips (+1)
- Boss: N pips (N-1 where N = player count)

---

## Part 9: Conditions Reference

### Offensive Conditions (Applied TO targets)

| Condition | PC Effect | NPC Effect |
|-----------|-----------|------------|
| [Exposed] | Incoming attacks step up 1 tier | PC attacks of that type step up 1 tier |
| [Staggered] | Step down Control die (physical) | Tier -1 (physical) |
| [Disoriented] | Step down Control die (physical) | Tier -1 (physical) |
| [Rattled] | Step down Control die (mental/social) | Tier -1 (mental/social) |
| [Stunned] | Step down Control die (ALL) | Tier -1 (all) + extra Tier -1 (mental/social) |
| [Shaken] | Outgoing results drop 1 tier | Outgoing results drop 1 tier |
| [Slowed] | Max 1 zone movement per round | Max 1 zone movement |
| [Prone] | Melee [Exposed]. Standing costs a Maneuver (PC) / Action (NPC) | Melee [Exposed]. Standing costs Action |
| [Restrained] | Cannot move. Still upright. | Cannot move or reposition |
| [Pinned] | [Prone] + [Restrained] | [Prone] + [Restrained] |
| [Suppressed] | Defense/Risk treated as +2 higher | Power reduced by 2 |
| [Blinded] | No targeted Ranged. Step down Control (all) | No targeted Ranged. Tier -1 (physical) |
| [Bleeding] | 1 Vitality damage at start of turn | 1 Vitality damage at start of turn |
| [Incapacitated] | Cannot act/move. Auto-fail defenses | Cannot act/move. Auto-fail defenses |

### Defensive Conditions (Applied TO self/allies)

| Condition | Effect |
|-----------|--------|
| [Optimized] | Step up Control die (scoped) / NPC: Tier +1 |
| [Empowered] | Step up Power die (scoped) / NPC: Arena +1 |
| [Guarded X] | Absorb X incoming tiers from Melee |
| [Cover X] | Reduce attacker Power by X (Ranged only) |
| [Buffered X] | Absorb X damage before Vitality |

### Debuff Conditions (Applied to self/allies — negative)

| Condition | Effect |
|-----------|--------|
| [Weakened] | Step down Power die (scoped) / NPC: Arena -1 |
| [Dazed] | Lose Maneuver next turn |
| [Hazard X] | Deal X Vitality damage at start of turn (zone) |
| [Marked] | No inherent effect; enables specific abilities |

---

## Part 10: The Resolution Scale

### PC Success (PC Roll − Risk)

| Net Result | Tier |
|:---:|---|
| 0–3 | Fleeting |
| 4–7 | Masterful |
| 8–11 | Legendary |
| 12–15 | Unleashed I |
| 16–19 | Unleashed II |
| 20+ | Unleashed III |

### NPC Success (NPC Power − PC Defense Roll)

| Delta | NPC Effect Tier |
|:---:|---|
| 1–3 | Fleeting — minor consequence |
| 4–7 | Masterful — serious consequence |
| 8+ | Legendary — devastating consequence |

### The 8+ Rule

If a Control die rolls 8 or higher, the action automatically gains +1 Effect Tier (e.g., a Fleeting result becomes Masterful).

### Gambit Threshold

Gambits can only activate if the result is Masterful or higher. The NPC spends -1 Power (reducing their effective tier) to add a rider condition.

---

## Part 11: Building an NPC — Step by Step

1. **Choose Category** — Character, Vehicle, Starship, Capital Ship, or Station
2. **Set Tier** (0-5) — Determines competence, action budget, and gambit access
3. **Set Arenas** (1-5 each) — The five attributes that derive all stats
4. **Choose Classification** — Minion, Standard, Elite, or Boss
5. **Choose Role** — Threat, Anchor, Harrier, Controller, or Support
6. **Choose Power Source** — Martial, Ranged, Force, or Leader
7. **Add Traits** — Combat and social modifiers (system suggests by role affinity)
8. **Add Tags** — Faction and type labels
9. **Add Extra Gambits** — From the gambit pool (system suggests by role)
10. **Assign Weapon(s)** — Weapon chassis determines base damage and attack arena
11. **Add Loot** — Items PCs can recover

The builder auto-calculates all derived stats. The NPC card displays:
- Header: Name, Tier, Classification, Role/Power Source
- Stats: Power, Defense, Evasion, Resist, Vitality, Initiative
- Role Kit: Action (with F/M/L track), Maneuver, Gambit, Exploit
- Attacks: Weapon chassis cards
- Traits & Tags
- Extra Gambits
- Loot

---

## Part 12: Encounter Design Patterns

### The Classic Encounter (4 PCs)

| NPC | Role | Power Source | Classification | Purpose |
|-----|------|-------------|:---:|---------|
| Lieutenant | Threat | Martial | Elite | Damage pressure, forces focus fire |
| 2× Soldiers | Anchor | Ranged | Minion | Zone control, body-block for lieutenant |
| Sniper | Controller | Ranged | Standard | Overwatch, area denial from elevation |

### The Ambush

| NPC | Role | Power Source | Classification | Purpose |
|-----|------|-------------|:---:|---------|
| 3× Assassins | Harrier | Martial | Minion | Hit and run from multiple directions |
| Spotter | Support | Leader | Standard | Coordinates assassins, buffs their attacks |

### The Boss Fight

| NPC | Role | Power Source | Classification | Purpose |
|-----|------|-------------|:---:|---------|
| Sith Lord | Threat | Force | Boss | The encounter. Multiple actions, devastating attacks |
| 2× Royal Guards | Anchor | Martial | Elite | Intercept for the Sith Lord, lock down zones |
| Probe Droid | Controller | Ranged | Standard | Area denial, overwatch on approaches |

### The Social Encounter Gone Wrong

| NPC | Role | Power Source | Classification | Purpose |
|-----|------|-------------|:---:|---------|
| Crime Lord | Controller | Leader | Boss | Dominates the room, [Suppressed] zone, social manipulation |
| Bodyguard | Anchor | Martial | Elite | Protects the boss, intercepts |
| 4× Thugs | Threat | Martial | Minion | Raw damage if things go sideways |

---

## Part 13: Prebuilt NPCs

The system ships with 14 ready-to-use NPC templates:

| Name | Tier | Classification | Role | Notes |
|------|:---:|:---:|:---:|-------|
| Stormtrooper | 1 | Minion | Anchor | PHY 3, armored medium, disciplined |
| Stormtrooper Sergeant | 1 | Standard | Anchor | Upgraded stormtrooper, leadership |
| Bounty Hunter | 2 | Elite | Harrier | REF 4, veteran, jetpack |
| Crime Lord | 3 | Boss | Controller | WIT 4, PRE 5, transactional, paranoid |
| Dark Side Adept | 3 | Elite | Controller | Force sensitive, loyal |
| Trandoshan Enforcer | 2 | Standard | Threat | PHY 4, tough, fearless |
| Pit Beast | 2 | Standard | Threat | PHY 5, beast |
| Imperial Officer | 2 | Standard | Support | WIT 4, PRE 3, disciplined |
| Krev Tosk | 2 | Standard | Threat | Named NPC |
| Kyuzo Skirmisher | 1 | Minion | Harrier | Agile |
| ISB Agent | 2 | Elite | Harrier | Interrogator |
| Cantina Informant | 1 | Standard | — | Non-combat, social only |
| Inquisitor Duelist | 3 | Elite | Threat | Force user, lightsaber |
| Hutt Crime Lord | 3 | Boss | Controller | Crime lord variant |

---

## Appendix A: Design Principles

1. **NPCs never roll.** They ARE the static values. The drama comes from the PC's roll.
2. **Roles are functions, not careers.** A bounty hunter could be any role depending on how they fight.
3. **Power Sources flavor, not restrict.** The arena isn't locked to a power source — it just suggests one.
4. **Maneuvers modify, not invent.** Role maneuvers should tweak universal maneuvers the GM already knows.
5. **Conditions do the work.** The game has 23+ conditions — use them instead of inventing custom effects.
6. **The card is the interface.** Everything the GM needs should be visible on the NPC card. No lookups.
7. **Cognitive load is the enemy.** Every ability the GM has to remember to activate is a potential failure point.

## Appendix B: Power Source × Arena Suggestion Matrix

| Arena Config | Suggested Power Source | Rationale |
|---|---|---|
| Highest = Physique | Martial | Natural brawler/melee |
| Highest = Reflex | Ranged | Natural shooter/agile |
| Highest = Grit | Force | Control-based Force user, endurance fighter |
| Highest = Wits | Leader or Ranged | Tactician or precision marksman |
| Highest = Presence | Leader or Force | Commander or Alter-based Force user |
| Force Sensitive trait | Force | Override suggestion if trait present |
| Leader tag | Leader | Override suggestion if tag present |
