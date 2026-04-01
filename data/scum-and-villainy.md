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

**Core identity:** The damage priority. The NPC the PCs must focus or the party bleeds. Every Threat variant says "deal with me NOW."

#### THREAT / MARTIAL
*Vibro-axe brute, Wookiee berserker, rancor, gladiator champion*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Devastating Blow** | Weapon attack. Defense: endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Staggered] |
| | L (8+) | Chassis damage + [Staggered] + [Prone] |
| **Maneuver** | **Intimidating Advance** | Modifies Move. Move 1 zone toward a target. That target must succeed on a Grit check vs Threat's Power or gain [Rattled]. |
| **Gambit** | **Brutal Strike** | -1 Power. Rider: [Staggered] |
| **Exploit** | **Predator's Opening** | Trigger: A PC in the same zone takes damage from another source this round. Effect: Immediately attack that PC at -2 Power. |

#### THREAT / RANGED
*Heavy repeater gunner, sniper, turret operator, AT-ST gunner*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Dead Shot** | Weapon attack. Defense: dodge |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Suppressed] |
| | L (8+) | Chassis damage + [Suppressed] + [Exposed] |
| **Maneuver** | **Marked Target** | Modifies Aim. Designate one visible target. +1 Power against that target until end of round. If target moves, may shift aim as free action. |
| **Gambit** | **Crippling Shot** | -1 Power. Rider: [Slowed] |
| **Exploit** | **Kill Shot** | Trigger: A PC in weapon range drops below half Vitality. Effect: Immediately attack that PC at -2 Power. |

#### THREAT / FORCE
*Sith Lord, dark side beast, Nightsister matriarch, ancient Force construct*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Force Crush** | Force attack. Defense: resist |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Weakened] |
| | L (8+) | Chassis damage + [Weakened] + [Restrained] |
| **Maneuver** | **Dark Presence** | Modifies Move. Move 1 zone. All enemies in the destination zone must succeed on a Grit check vs Threat's Power or gain [Rattled]. |
| **Gambit** | **Force Rend** | -1 Power. Rider: [Disoriented] |
| **Exploit** | **Dark Retribution** | Trigger: A PC in the same zone successfully damages the Threat. Effect: That PC gains [Rattled]. |

#### THREAT / LEADER
*Warlord, pirate captain, gladiatorial ringmaster*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Execute Order** | Weapon or command. Defense: dodge/endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + one ally in same zone gains +1 Power until end of round |
| | L (8+) | Chassis damage + ally gains +1 Power + that ally may immediately attack at -2 Power |
| **Maneuver** | **Press the Attack** | Modifies Coordinate. Choose one ally within 2 zones. That ally gains [Optimized] on next attack AND +1 Power until end of round. |
| **Gambit** | **Overwhelming Command** | -1 Power. Rider: [Exposed] — coordinated assault strips defenses. |
| **Exploit** | **Demand Obedience** | Trigger: An ally in the same zone is reduced to 0 Vitality. Effect: Another ally within 2 zones immediately moves 1 zone toward the attacker and gains +1 Power. |

---

### ANCHOR

**Core identity:** Holds ground, blocks access, protects a position or VIP. Hard to move, hard to ignore.

#### ANCHOR / MARTIAL
*Shield trooper, riot squad, armored beast blocking a corridor*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Shield Slam** | Weapon attack. Defense: endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + push target 1 zone |
| | L (8+) | Chassis damage + push 1 zone + [Prone] |
| **Maneuver** | **Lockdown** | Modifies Move. The Anchor does not move. Instead, enemies in the Anchor's zone cannot move to another zone without succeeding on a Physique check vs Anchor's Defense. |
| **Gambit** | **Shove Back** | -1 Power. Rider: Push 1 zone. Anchor holds position. |
| **Exploit** | **Intercept** | Trigger: An enemy in the Anchor's zone attacks an ally. Effect: The Anchor becomes the target instead. |

#### ANCHOR / RANGED
*E-Web gunner, entrenched trooper, fire-team in cover*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Disciplined Fire** | Weapon attack. Defense: dodge |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Suppressed] |
| | L (8+) | Chassis damage + [Suppressed] to all enemies in target's zone |
| **Maneuver** | **Dig In** | Modifies Take Cover. Anchor gains [Cover 2] and [Optimized] on next ranged attack. Cannot move this turn. |
| **Gambit** | **Pinning Barrage** | -1 Power. Rider: [Suppressed]. Target cannot use Move next turn. |
| **Exploit** | **Covering Fire** | Trigger: An ally in same/adjacent zone takes damage. Effect: Immediately attack the attacker at -2 Power (if in range). |

#### ANCHOR / FORCE
*Temple guardian, Force-barrier monk, Sith sentinel*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Force Barrier Strike** | Force attack. Defense: resist |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + Anchor gains [Buffered 1] |
| | L (8+) | Chassis damage + [Buffered 2] + push target 1 zone |
| **Maneuver** | **Force Anchor** | Modifies Take Cover. Anchor projects a Force barrier: gains [Cover 2]. One ally in the same zone also gains [Cover 1]. |
| **Gambit** | **Repulse** | -1 Power. Rider: Push ALL enemies in the Anchor's zone 1 zone away. |
| **Exploit** | **Force Wall** | Trigger: An enemy attempts to enter the Anchor's zone. Effect: Must succeed on Grit check vs Anchor's Power or stop in adjacent zone. |

#### ANCHOR / LEADER
*Squad sergeant, defensive commander, bodyguard captain*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Hold the Line** | Weapon or command. Defense: dodge/endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + one ally in same zone gains [Cover 1] |
| | L (8+) | Chassis damage + ally gains [Cover 2] + that ally gains +1 Power until end of round |
| **Maneuver** | **Rally Point** | Modifies Coordinate. All allies in the Anchor's zone gain +1 Defense until end of round. Anchor cannot move this turn. |
| **Gambit** | **Stand Fast** | -1 Power. Instead of attacking, remove one condition from the Anchor AND one ally in the same zone. |
| **Exploit** | **Bodyguard** | Trigger: An ally within 1 zone would take damage. Effect: The Anchor takes the damage instead. If the Anchor has [Cover], apply Cover first. |

---

### CONTROLLER

**Core identity:** Battlefield manipulation. Conditions, forced movement, zone hazards, social pressure. Makes the fight unfair.

#### CONTROLLER / MARTIAL
*Slaver with a net, brawler who cripples limbs, beast that pins prey*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Crippling Strike** | Weapon attack. Defense: endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Slowed] |
| | L (8+) | Chassis damage + [Slowed] + [Weakened] |
| **Maneuver** | **Menacing Presence** | Modifies Move. Move 1 zone. All enemies in the destination zone gain [Disadvantage] on their next attack. |
| **Gambit** | **Disabling Blow** | -1 Power. Rider: [Dazed]. Target loses Maneuver next turn. |
| **Exploit** | **Punishing Counter** | Trigger: A PC in the Controller's zone misses an attack. Effect: That PC gains [Exposed] until end of their next turn. |

#### CONTROLLER / RANGED
*Sniper who pins zones, E-Web suppression specialist, area denial trooper*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Suppressive Volley** | Weapon attack. Defense: dodge |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Suppressed] |
| | L (8+) | Chassis damage + [Suppressed] + zone becomes [Hazard 1] until end of next round |
| **Maneuver** | **Overwatch Position** | Modifies Overwatch. Declare a zone. Any PC that enters, leaves, or acts in that zone presents an Opening AND gains [Suppressed]. |
| **Gambit** | **Disrupt** | -1 Power. Rider: [Dazed]. Target loses Maneuver next turn. |
| **Exploit** | **Denial Fire** | Trigger: A PC enters a zone the Controller has declared Overwatch. Effect: Immediately attack at -2 Power. |

#### CONTROLLER / FORCE
*Inquisitor, Nightsister witch, Sith sorcerer, dark side nexus*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Mind Spike** | Force attack. Defense: resist |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Disoriented] |
| | L (8+) | Chassis damage + [Disoriented] + [Rattled] |
| **Maneuver** | **Force Dominion** | Modifies Move. Instead of moving, designate the Controller's zone as [Difficult Terrain] for enemies until end of next round. Enemies inside gain [Slowed]. |
| **Gambit** | **Force Choke** | -1 Power. Rider: [Restrained]. Target cannot use Move next turn. |
| **Exploit** | **Psychic Backlash** | Trigger: A PC in the Controller's zone uses a social or Force action. Effect: That PC gains [Disoriented]. |

#### CONTROLLER / LEADER
*Crime lord, ISB interrogator, Hutt pulling strings, tactical commander*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Dictate Terms** | Social/command. Defense: resist |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + [Rattled] |
| | L (8+) | Chassis damage + [Rattled] + target must move 1 zone (Controller's choice) |
| **Maneuver** | **Tactical Redeployment** | Modifies Coordinate. Move up to 2 allies within 2 zones each 1 zone (Controller's choice). Those allies gain [Optimized] on next action. |
| **Gambit** | **Exploit Weakness** | -1 Power. Rider: [Exposed]. Controller identifies and broadcasts target's vulnerability. |
| **Exploit** | **Contingency Order** | Trigger: An ally within 2 zones is targeted by an attack. Effect: That ally may immediately move 1 zone before the attack resolves. |

---

### SUPPORT

**Core identity:** Force multiplier. Buffs allies, removes conditions, makes other NPCs scarier. Kill the Support first or the fight never ends.

#### SUPPORT / MARTIAL
*Field medic, shield-bearer who protects the squad, combat engineer*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Bolstering Strike** | Weapon attack. Defense: endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + one ally in same zone heals 1 Vitality |
| | L (8+) | Chassis damage + ally heals 2 Vitality + remove one condition from that ally |
| **Maneuver** | **Shield Wall** | Modifies Move. Move 1 zone. One ally in the destination zone gains [Cover 1] until end of next round. |
| **Gambit** | **Rally** | -1 Power. Instead of attacking, remove one condition from an ally in the same zone. |
| **Exploit** | **Emergency Aid** | Trigger: An ally in the same zone is reduced to 0 Vitality. Effect: That ally is instead reduced to 1 Vitality. Once per scene. |

#### SUPPORT / RANGED
*Covering fire specialist, spotter, sniper team coordinator*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Covering Strike** | Weapon attack. Defense: dodge |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + one ally gains [Cover 1] |
| | L (8+) | Chassis damage + ally gains [Cover 2] + ally gains +1 Power until end of round |
| **Maneuver** | **Suppressive Assist** | Modifies Overwatch. Declare a zone. Allies in that zone gain +1 Defense until end of round. Enemies entering present Openings. |
| **Gambit** | **Smoke Screen** | -1 Power. Instead of attacking, create [Concealment] in a zone within weapon range until end of next round. Allies gain +1 Evasion. |
| **Exploit** | **Covering Volley** | Trigger: An ally within weapon range takes damage. Effect: That ally gains [Cover 1] against the next attack targeting them. |

#### SUPPORT / FORCE
*Jedi healer, Force-sensitive shaman, Nightsister life-weaver*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Force Mend** | Force attack/heal. Defense: resist |
| | F (1-3) | Chassis damage OR heal 1 ally Vitality in same zone |
| | M (4-7) | Chassis damage + heal 2 Vitality to one ally in same zone |
| | L (8+) | Chassis damage + heal 3 Vitality + remove one condition from that ally |
| **Maneuver** | **Battle Meditation** | Modifies Coordinate. All allies within 2 zones gain +1 Power until end of round. Support cannot move this turn. |
| **Gambit** | **Force Heal** | -1 Power. Instead of attacking, heal one ally in the same zone for 2 Vitality and remove one condition. |
| **Exploit** | **Force Shield** | Trigger: An ally within 2 zones would take damage. Effect: Reduce that damage by 2. |

#### SUPPORT / LEADER
*Imperial officer, squad leader, clan chief, ship captain*

| Slot | Name | Details |
|---|---|---|
| **Action** | **Inspire** | Weapon or command. Defense: dodge/endure |
| | F (1-3) | Chassis damage |
| | M (4-7) | Chassis damage + one ally within 2 zones gains [Optimized] on next action |
| | L (8+) | Chassis damage + all allies within 2 zones gain [Optimized] on next action |
| **Maneuver** | **Tactical Brief** | Modifies Coordinate. Choose one ally within 2 zones. That ally gains +1 Power and +1 Defense until end of round. |
| **Gambit** | **Direct Fire** | -1 Power. Instead of attacking, one ally within 2 zones immediately makes an attack at +1 Power. |
| **Exploit** | **Last Stand** | Trigger: The Support drops below half Vitality. Effect: All allies within 2 zones gain +1 Power until end of next round. Once per scene. |

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
