# Playtest Round 1: TIE Intercept

## Scenario Setup

**Player Ship:** Modified YT-1300 light freighter ("The Krayt's Tooth")
- Handling: d6
- Engines: d6
- Shields: d8
- Sensors: d6
- Weapon Mounts: d8 (dorsal turret), d6 (ventral turret)
- Hull Integrity: 8

**Crew (Pregens at Stations):**
| Station    | Character | Control Die | Discipline         |
|------------|-----------|-------------|--------------------|
| Pilot      | Kael      | d8          | Piloting (Reflex)  |
| Gunner 1   | Voss      | d8          | Heavy Weapons (Physique) |
| Gunner 2   | Mira      | d6          | Heavy Weapons (Physique) |
| Operator   | Dex       | d8          | Tech (Wits)        |
| Engineer   | Torr      | d8          | Tech (Wits)        |
| Co-Pilot   | Senna     | d8          | Tactics (Wits)     |

**Enemy Ships (Static NPC Values — they are the Risk):**
TIE/ln Fighters — fast, fragile, no shields.

| TIE       | Piloting Defense | Weapon Risk | Sensor Resistance | Hull |
|-----------|-----------------|-------------|-------------------|------|
| Alpha     | 4               | 4           | 2                 | 4    |
| Beta      | 4               | 4           | 2                 | 4    |

- Piloting Defense 4: The static value players roll against to hit, pursue, or outfly them.
- Weapon Risk 4: When a TIE "attacks," the GM declares the attack and the player rolls defense vs Risk 4.
- No shields (Endure floor = 0). No countermeasures.
- Hull 4 means they go down fast once you connect.

**Starting Position:** 
- TIEs are at Medium range (Zone 2), closing to engage.
- No environmental terrain available (open space).
- No pre-existing conditions on anyone.

---

## Initiative: Popcorn Style

Roll order this round: **TIE Alpha → Player Crew → TIE Beta**

The crew did not win initiative. TIE Alpha acts first. The player crew goes second — they choose their internal station order (and this matters enormously). TIE Beta goes last.

Key tension: **Who goes first inside the player crew's turn determines what buffs are available for later stations.** The Co-Pilot or Operator going early can stack [Optimized]/[Empowered] on the Gunner. The Pilot going early with an Attack Run can buff all Gunners. But the Pilot going early means they can't react to what TIE Alpha did. Order is a tactical puzzle.

---

## THE ROUND

---

### Beat 1: TIE Alpha Acts

**GM declares:** "TIE Alpha screams in from your port side, green lasers stitching across your hull. It's a strafing run — TIE Alpha attacks the Krayt's Tooth."

**Mechanically:** TIE Alpha's Weapon Risk is 4. The crew chooses a defense.

**Crew Decision: Evade or Endure?**
- **Evade** (Pilot rolls): Kael rolls Piloting d8 + Handling d6. On success, Handling die reduces TIE's effect tier. On failure, full hit lands (no floor). On Control 8+, generates an Opening for the Gunners.
- **Endure** (passive Shields): Shields d8 absorbs. Even on failure, reduces effect by 1 tier (floor). Safer but no upside.

**The crew picks Evade.** They want the chance at an Opening.

> **Kael rolls Evade:**
> - Control: Piloting d8 → rolls **6**
> - Risk: TIE Alpha Weapon Risk = 4
> - Net Result: 6 - 4 = **+2** → **Fleeting Success**
> - Power: Handling d6 → rolls **3**
> - Effect: Attacker's effect reduced by Power die result (3). TIE's attack was aiming for Fleeting damage — reduced below Fleeting. **The shot misses.**

**Result:** Kael jerks the ship hard to port. The green bolts rake empty space where they were a half-second ago. No damage. But no Opening either — the roll wasn't spectacular enough (needed Control 8+ for that).

**Observation:** Evade worked but produced no bonus value. The crew is safe but didn't gain anything from this defensive beat. Endure would have been safer (guaranteed floor) but equally uneventful. The gamble on Evade paid off this time.

---

### Beat 2: Player Crew's Turn

The crew gets to choose their station order. This is the tactical meat of the round.

**Senna (Co-Pilot) proposes going first.** She wants to Coordinate before anyone else acts.

---

#### Beat 2a: Senna (Co-Pilot) — Coordinate

**Action:** Coordinate — Tactics (Wits) vs... what?

**DESIGN QUESTION:** Coordinate is a support action that buffs allies. What is the Risk/Resistance? Options:
1. **Flat difficulty (Presence)** — GM sets a difficulty based on the chaos of the situation. Presence 2 in a standard dogfight.
2. **No resistance** — Coordinate always succeeds at some tier, the roll just determines how good the coordination is.
3. **Opposed by enemy Sensor Resistance** — the enemy's electronic presence makes coordination harder.

**For this playtest, using option 1: Presence 2** (standard difficulty for a combat coordination action).

> **Senna rolls Coordinate:**
> - Control: Tactics d8 → rolls **7**
> - Risk: Presence 2
> - Net Result: 7 - 2 = **+5** → **Masterful Success**
> - Power: Sensors d6 → rolls **4** (not mechanically relevant for Coordinate — the tier is the effect)

**Masterful Coordinate effect:** "Grant [Optimized] to one crew member and [Empowered] to a different crew member for their next actions this round."

**Senna's choice:** She gives [Optimized] to **Voss (Gunner 1)** and [Empowered] to **Kael (Pilot)**.

**Result:** Senna calls vectors from the copilot seat: "Alpha is pulling high — Kael, you've got a window on Beta if you commit to an attack run. Voss, I'm feeding you the deflection angle now."

**Active Conditions:**
- Voss: [Optimized] (Control die stepped up: d8 → d10 for next action)
- Kael: [Empowered] (Power die stepped up for next action)

**Observation:** Going first was the right call. Senna's Masterful result buffs two crew members before they act. If she'd gone last, these buffs would have been wasted. This is the popcorn order payoff — support stations going early is huge.

---

#### Beat 2b: Kael (Pilot) — Attack Run on TIE Beta

**Action:** Attack Run — Piloting (Reflex) vs TIE Beta's Piloting Defense 4. Kael has [Empowered] from Senna's Coordinate.

> **Kael rolls Attack Run:**
> - Control: Piloting d8 → rolls **5**
> - Risk: TIE Beta Piloting Defense = 4
> - Net Result: 5 - 4 = **+1** → **Fleeting Success**
> - Power: Engines d6 [Empowered → d8] → rolls **6**

**Fleeting Attack Run effect:** "Ship closes 1 zone. All Gunners gain [Optimized] on their next attack this round."

**Result:** Kael rolls the Krayt's Tooth into an aggressive dive, closing from Zone 2 to Zone 1 (Close range). The angle is good — not perfect, but good enough. Both Gunners now have firing solutions.

**Active Conditions:**
- Voss: [Optimized] (from Senna) + [Optimized] (from Attack Run). **STACKING QUESTION: Do these stack?**

**DESIGN QUESTION: [Optimized] Stacking**
Per the condition engine, [Optimized] steps up the Control die. If Voss already has [Optimized] from Coordinate, and gains [Optimized] again from Attack Run:
- **Option A:** They don't stack. Voss has [Optimized] — one step up, period. The second source is redundant.
- **Option B:** They stack. d8 → d10 → d12. Two separate sources, two step-ups.

**The system should probably NOT stack identical conditions from different sources** — otherwise support actions become exponentially broken. Voss has [Optimized] (d8 → d10). The Attack Run's [Optimized] is redundant for Voss but applies to Mira (Gunner 2), who didn't have it.

**Updated Active Conditions:**
- Voss: [Optimized] (d8 → d10 for next attack)
- Mira: [Optimized] (d6 → d8 for next attack)
- Kael: [Empowered] consumed by Attack Run Power die

**Observation:** The [Empowered] on Kael's Attack Run stepped up his Engines d6 → d8 for the Power die, but since Attack Run's effect is tier-based (not Power-dependent), the [Empowered] was partially wasted — it only mattered if the Power die had a mechanical function here. **DESIGN QUESTION: Does the Power die matter on Attack Run?** The effect tiers are fixed by the Control net result. The Power die on Attack Run may not have a defined mechanical role beyond the tier table. If so, [Empowered] on a Pilot doing Attack Run is a suboptimal buff choice by the Co-Pilot.

**This is a real play discovery:** Co-Pilots need to understand which stations benefit from [Optimized] (Control die step-up = higher tier chance) vs [Empowered] (Power die step-up = higher effect magnitude) vs both. Gunners benefit from both. Pilots benefit from [Optimized] more than [Empowered] on most actions since their effect is tier-driven. Senna should have given [Optimized] to Kael and [Empowered] to Voss.

---

#### Beat 2c: Dex (Operator) — Paint Target on TIE Alpha

Voss is about to shoot TIE Beta (where the Pilot positioned). But Mira (Gunner 2) is on the ventral turret and can target TIE Alpha. Dex decides to Paint Target on TIE Alpha to support Mira.

**Action:** Paint Target — Tactics (Wits) vs TIE Alpha's Sensor Resistance 2.

> **Dex rolls Paint Target:**
> - Control: Tactics... wait, Dex's discipline is Tech d8, not Tactics. 
> - **Station allows Tech / Investigation / Tactics (Wits).** Dex uses Tech d8.
> - Actually, Paint Target specifically says "Tactics (Wits)." Does Dex have Tactics? 

**DESIGN QUESTION: Discipline Flexibility at Stations**
The Operator station lists "Tech / Investigation / Tactics" as control disciplines. But each specific action calls out which discipline it uses:
- Scan: Investigation (Wits)
- Jam: Tech (Wits)
- Paint Target: Tactics (Wits)

If Dex only has Tech d8 and not Tactics, can he Paint Target? **The station says he can use Tech, Investigation, OR Tactics** — but the action specifies Tactics. 

**Resolution for playtest:** Dex has Tactics at d6 (secondary discipline). He can Paint Target but with a smaller die.

> **Dex rolls Paint Target:**
> - Control: Tactics d6 → rolls **5**
> - Risk: TIE Alpha Sensor Resistance = 2
> - Net Result: 5 - 2 = **+3** → **Fleeting Success**
> - Power: Sensors d6 → rolls **2**

**Fleeting Paint Target effect:** "One Gunner gains [Optimized] on their next attack against the painted target."

**Dex's choice:** Give [Optimized] to **Mira** on her attack against TIE Alpha.

But wait — Mira already has [Optimized] from Kael's Attack Run. Same stacking question. If [Optimized] doesn't stack, this Paint Target is **redundant for Mira**.

**Observation:** This is a coordination failure at the table. Dex's Paint Target was wasted because Kael's Attack Run already gave all Gunners [Optimized]. Dex should have:
- **Scanned** TIE Alpha (to learn system status and grant a different buff), or
- **Jammed** TIE Beta (to degrade its next attack before it acts), or
- Painted a target that wasn't already [Optimized].

**This is excellent emergent gameplay.** The crew's internal order and action choices create real tactical puzzles. Dex going after Kael's Attack Run with Paint Target was suboptimal — the table needs to learn to sequence and not double-buff.

**Let's say Dex changes his mind (table talk before dice).** He Jams TIE Beta instead.

#### Beat 2c (Revised): Dex (Operator) — Jam TIE Beta

**Action:** Jam — Tech (Wits) vs TIE Beta's Sensor Resistance 2.

> **Dex rolls Jam:**
> - Control: Tech d8 → rolls **4**
> - Risk: TIE Beta Sensor Resistance = 2
> - Net Result: 4 - 2 = **+2** → **Fleeting Success**
> - Power: Sensors d6 → rolls **3**

**Fleeting Jam effect:** "Target ship's Sensors are [Disoriented] until end of round — their Operator and Co-Pilot actions are stepped down."

**Result:** TIE Fighters don't have an Operator or Co-Pilot — they're single-pilot fighters. **Does [Disoriented] on Sensors do anything to a TIE?**

**DESIGN QUESTION: Jam vs Single-Crew Fighters**
TIEs have no Operator or Co-Pilot station. The Fleeting Jam effect specifically degrades "Operator and Co-Pilot actions." Against a single-pilot fighter, this effect does... nothing mechanically.

The Masterful Jam ([Jammed] — Operator actions auto-fail, comms disrupted) is similarly hollow against a ship with no Operator station.

The Legendary Jam (Sensors [Jammed] + Gunner Control stepped down) would affect TIE Gunner (the pilot is also the gunner), so that works.

**Observation:** Jam's Fleeting tier is useless against single-crew fighters. This is a real gap. The Operator's primary debuff action has a dead tier against the most common enemy type in Star Wars (single-pilot fighters). 

**Possible fixes:**
1. Fleeting Jam could also affect Piloting ("sensors disrupted, Piloting Defense reduced by 1") — but that's a big swing.
2. Fleeting Jam could generically say "target's sensor-dependent actions are [Disoriented]" — which for a TIE pilot would affect any roll that uses sensor input (targeting).
3. Accept it — Fleeting Jam is weak against small fighters, and the Operator should Scan or Paint Target instead. Jam is an anti-capital-ship tool at low tiers.

**For this playtest:** The Fleeting Jam is effectively wasted against TIE Beta. Dex's action produced no mechanical effect.

**Let's leave it as-is to surface the design issue and move on.**

---

#### Beat 2d: Torr (Engineer) — Reinforce Shields

TIE Beta hasn't acted yet and will attack this round. Torr proactively shores up defenses.

**Action:** Reinforce Shields — Tech (Wits) + Shields.

> **Torr rolls Reinforce Shields:**
> - Control: Tech d8 → rolls **8** ← Control 8+!
> - Risk: Presence 2 (standard combat difficulty)
> - Net Result: 8 - 2 = **+6** → **Masterful Success** (and Control 8+ = +1 Tier → **Legendary!**)

Wait — does the Control 8+ tier bump apply to support/buff actions like Reinforce Shields? The gamesystem says: "Applies universally: attacks, maneuvers, defenses, and narrative rolls."

**DESIGN QUESTION: Control 8+ on Support Actions**
The +1 Tier from Control 8+ should apply to Reinforce Shields. It's a maneuver-equivalent action. Net result was +6 (Masterful), bumped to Legendary.

> **Legendary Reinforce Shields effect:** "Ship gains [Buffered 3]. Additionally, the shields are so overcharged that the next attack against the ship has its Effect Tier reduced by 1 (shield flare disrupts targeting)."

**Result:** Torr's hands fly across the engineering console. The shields flare bright — overcharged well beyond spec. The ship is wrapped in reinforced deflector energy.

**Active Conditions on Krayt's Tooth:**
- [Buffered 3] — absorbs 3 points of hull damage before it lands
- Next incoming attack: -1 Effect Tier (shield flare)

**Observation:** Torr's lucky roll turned a Masterful into a Legendary via the 8+ bump. The ship is now extremely well-protected for TIE Beta's incoming attack. The Engineer's proactive value is clear — he didn't wait for damage, he prevented it.

---

#### Beat 2e: Voss (Gunner 1) — Attack TIE Beta

Voss has [Optimized] (from Senna's Coordinate). He's on the dorsal turret (d8 mount). TIE Beta is in Zone 1 (Close range, thanks to Kael's Attack Run).

**Action:** Attack — Heavy Weapons (Physique) vs TIE Beta's Piloting Defense 4.

> **Voss rolls Attack:**
> - Control: Heavy Weapons d8 [Optimized → d10] → rolls **7**
> - Risk: TIE Beta Piloting Defense = 4
> - Net Result: 7 - 4 = **+3** → **Fleeting Success**
> - Power: Weapon Mount d8 → rolls **5**

**Fleeting Attack effect:** "Weapon chassis damage (Fleeting tier). Glancing hit — minimal structural impact."

**TIE Beta defends:** TIE has no shields (Endure floor = 0). Does the TIE Evade? NPCs don't roll dice — TIE Beta's Evade is a static value that was already factored into the Piloting Defense of 4 that Voss rolled against.

**DESIGN QUESTION: How does TIE defense work under Frame B?**
The TIE's Piloting Defense of 4 IS the evasion built in. When Voss's net result is positive, the shot hits. The damage tier (Fleeting) is what lands. There's no separate NPC defense roll — the static defense was the risk Voss rolled against.

But wait — damage. What does "Fleeting chassis damage" actually mean in hull points? 

**DESIGN QUESTION: Chassis Damage Table**
The station says "Weapon chassis damage (Fleeting tier)" but doesn't define how much hull damage that translates to. Options:
1. The Power die result IS the damage (5 in this case). Fleeting/Masterful/Legendary tiers are narrative color.
2. Each tier has a fixed damage value. Fleeting = 1 hull, Masterful = 2, Legendary = 3.
3. The tier determines the severity category and the Power die determines magnitude within that category.

**For this playtest, using option 3:** Fleeting tier means the hit connects but the Power die determines how hard. Power die result of 5 → 5 points of hull damage? That would one-shot a TIE with 4 Hull.

That seems too fast. **Let's use option 2 as a simpler model:** Tier = damage. Fleeting = 1 hull damage. Power die determines additional effects or whether you can target systems.

**Applying Fleeting damage (1 hull) to TIE Beta:**
- TIE Beta Hull: 4 → 3

**Result:** Voss's turret barks a burst of red laser fire. It catches TIE Beta on the solar panel — a glancing hit, but it scorches through the panel and into the strut. The TIE shudders. First blood.

**Observation:** The [Optimized] stepped Voss's Control from d8 to d10, which gave him a 7. Without [Optimized], he'd have been rolling a d8 — still could have hit, but less likely. The buff mattered but didn't create a dramatic swing here. Also surfaced: **we need a defined chassis damage model** — the current tier descriptions are narrative but don't specify hull point conversion.

---

#### Beat 2f: Mira (Gunner 2) — Attack TIE Alpha

Mira has [Optimized] from Kael's Attack Run. She's on the ventral turret (d6 mount). TIE Alpha is at Medium range (Zone 2 — it strafed from further out).

**Action:** Attack — Heavy Weapons (Physique) vs TIE Alpha's Piloting Defense 4.

> **Mira rolls Attack:**
> - Control: Heavy Weapons d6 [Optimized → d8] → rolls **3**
> - Risk: TIE Alpha Piloting Defense = 4
> - Net Result: 3 - 4 = **-1** → **Fleeting Failure**

**Failure — Risk line:** "On failure, the shot misses. No damage dealt."

**Result:** Mira's ventral turret spits fire at TIE Alpha but the shots go wide — the angle from below was wrong, and TIE Alpha's jinking made the deflection shot impossible at this range.

**Observation:** Mira's d6 base Control die, even [Optimized] to d8, wasn't enough to beat the TIE's Defense 4 on this roll. She needed a 5+ on d8 (50% chance) and rolled a 3. The weaker Gunner with the weaker mount is a real liability — she's statistically unreliable against Defense 4 targets. This is a meaningful crew weakness.

---

### Beat 3: TIE Beta Acts

**GM declares:** "TIE Beta, trailing smoke from Voss's hit, rolls into a revenge run. It's coming straight at you, guns blazing."

TIE Beta attacks the Krayt's Tooth. Weapon Risk = 4.

**Crew Decision: Evade or Endure?**

The ship currently has:
- [Buffered 3] from Torr's Reinforce Shields
- Next incoming attack: -1 Effect Tier from shield flare

**The crew picks Endure this time.** They've got massive shield buffs — let the shields do the work.

**Endure is passive.** Shields d8 provides the defense floor. Even on failure, reduces attacker's effect by 1 tier.

**So what happens mechanically?**
- TIE Beta attacks with Weapon Risk 4.
- The ship Endures. Endure is passive — the Shields die (d8) provides damage reduction.
- Shield flare: -1 Effect Tier on this attack.
- [Buffered 3]: absorbs 3 hull damage before it lands.

**DESIGN QUESTION: Endure Resolution in Starship Combat**
Endure is described as "passive Shields, floor on failure." But how does it resolve?
- Does the crew roll the Shields die? That's an NPC-defense-equivalent roll, but the PLAYER is rolling it.
- Or is Shields die a static soak value? (Shields d8 = always reduces by some fixed amount?)

Per the gamesystem: "The Shields die absorbs incoming damage. Even on failure, reduces the attacker's Effect Tier by 1."

**For this playtest:** The attacking TIE "hits" at whatever tier its attack would produce. Since NPCs don't roll, the GM sets the attack tier. TIE Beta's attack is Weapon Risk 4 — at baseline, this is a Fleeting hit (Risk 4 isn't a roll, it's a static value).

Actually wait — this is the key Frame B question for incoming NPC attacks. The NPC doesn't roll. So how do we determine the EFFECT TIER of the NPC's attack?

**CRITICAL DESIGN QUESTION: NPC Attack Effect Tier**
When an NPC attacks and the player chooses Endure (passive defense), what determines the attacker's Effect Tier?

Options:
A. **NPC Weapon Risk IS the tier determinant.** Weapon Risk 4 = Masterful attack (falls in the 4-7 range on the effect track). This means every NPC attack is a fixed tier unless the player actively Evades to reduce it.
B. **The GM assigns a tier based on narrative.** Standard TIE attack = Fleeting. Elite pilot = Masterful. Etc.
C. **The player still rolls something.** Even on Endure, the player rolls the Shields die vs the Weapon Risk, and the net result determines how much gets through. Positive = soak absorbed it. Negative = damage tier.

**Option C seems most consistent with Frame B.** The player always rolls. Endure means the player rolls Shields d8 vs Weapon Risk 4:

> **Endure (Shields):**
> - Power: Shields d8 → rolls **6**
> - Risk: TIE Beta Weapon Risk = 4
> - Net Result: 6 - 4 = **+2** → Shields absorb the hit.
> - Shield flare: additional -1 tier on this attack.
> - [Buffered 3]: not even needed — shields handled it.

**Result:** TIE Beta's lasers slam into the overcharged deflector shields. The shields flare brilliant blue, dispersing the energy across the entire forward grid. Torr's reinforcement holds perfectly. Not a scratch.

**Observation:** The Engineering investment paid off completely. Torr's Legendary Reinforce Shields created a defense stack ([Buffered 3] + shield flare + natural Shields d8) that made TIE Beta's attack irrelevant. The Engineer station proves its value as a proactive force multiplier.

---

## END OF ROUND 1

### Damage Summary
| Ship            | Hull | Conditions | Status |
|-----------------|------|------------|--------|
| Krayt's Tooth   | 8/8  | [Buffered 3] (partially unused) | Untouched |
| TIE Alpha       | 4/4  | None       | Untouched |
| TIE Beta        | 3/4  | None       | Damaged |

### Condition Tracker
- [Buffered 3] on Krayt's Tooth: persists until consumed or refreshed.
- All [Optimized]/[Empowered] from this round: expired (used or round ended).

---

## DESIGN QUESTIONS SURFACED

### 1. [Optimized] Stacking
**Issue:** If two sources grant [Optimized] to the same character (e.g., Coordinate + Attack Run), do they stack?
**Recommendation:** No stacking. [Optimized] is binary — you have it or you don't. Multiple sources are redundant. This prevents support-action stacking from creating runaway Control die inflation (d8 → d10 → d12 → d14?). It also creates a real tactical decision: spread your buffs, don't pile them on one person.
**Implication:** Co-Pilot and Operator need to coordinate who they buff to avoid waste. Kael's Attack Run granting "all Gunners [Optimized]" makes individual Paint Target/Coordinate [Optimized] to a Gunner redundant. The Co-Pilot should [Optimized] the Pilot or Operator, not the Gunner, when an Attack Run is planned.

### 2. Power Die Relevance on Pilot Actions
**Issue:** Attack Run, Pursue/Close, Break Away, etc. call for a Power die (Engines or Handling), but the mechanical effect is tier-based (Fleeting/Masterful/Legendary), not Power-die-dependent. What does the Power die DO on these actions?
**Options:**
- A. Power die determines zone movement distance within the tier (Fleeting + Power 6 = close 1 zone fast; Fleeting + Power 2 = close 1 zone barely).
- B. Power die is irrelevant for Pilot positioning actions — only the Control die and tier matter. (This makes [Empowered] useless on Pilot movement.)
- C. Power die becomes relevant only on some Pilot actions (Terrain Run cover level, Evade soak) but not others.
**Recommendation:** Option C. Power die matters on Evade (soak value) and Terrain Run (cover level / collision severity), but Attack Run and Pursue/Close are pure tier effects. This means [Empowered] on the Pilot is only valuable for defensive flying, not offensive positioning. Clean decision point for the Co-Pilot.

### 3. Jam vs Single-Crew Fighters
**Issue:** Jam's Fleeting tier ([Disoriented] on Operator/Co-Pilot actions) does nothing against a single-pilot fighter like a TIE. The Operator's primary debuff action has a dead first tier against the most common enemy type in Star Wars.
**Options:**
- A. Rewrite Fleeting Jam to affect all sensor-dependent rolls (including Piloting and Gunnery targeting). Broader but stronger.
- B. Accept it — Jam is an anti-capital-ship tool at Fleeting. Against fighters, the Operator should Scan or Paint Target. Jam only becomes useful at Masterful+ (where comms disruption and Gunner debuffs kick in).
- C. Add a Fleeting effect: "Target's Piloting Defense is reduced by 1 until end of round" — a small but meaningful debuff against fighters.
**Recommendation:** Option C. A -1 Piloting Defense at Fleeting makes Jam always worth attempting against any target, while keeping the real power at Masterful+ tiers. It also means the Operator can soften up targets for the Gunners even against fighters.

### 4. Chassis Damage Model
**Issue:** Gunner Attack says "Weapon chassis damage (Fleeting/Masterful/Legendary tier)" but never defines what that means in hull points.
**Needed:** A damage conversion model. Either:
- Tier = fixed hull damage (Fleeting 1, Masterful 2, Legendary 3) — simple, predictable, possibly too flat.
- Power die = hull damage (swingy, makes [Empowered] and weapon mount quality very important) — more dynamic but harder to balance.
- Tier determines damage range, Power die selects within range — middle ground.
**Recommendation:** Power die = hull damage, modified by tier. Fleeting: Power die result ÷ 2 (round up). Masterful: Power die result. Legendary: Power die result × 1.5 (round up). This makes bigger weapon mounts (d8 vs d6) and [Empowered] meaningfully impact damage while keeping tiers as the primary damage gate.

### 5. NPC Attack → Player Defense Flow
**Issue:** When an NPC attacks and the player picks Endure, what determines the NPC's attack tier? NPCs don't roll dice.
**Current text says:** "Defensive reactions (Evade, Endure, Resist) are free and triggered when the ship is attacked."
**Needed clarity:** The NPC's Weapon Risk IS the static offense value. The player rolls their defense (Evade: Piloting + Handling; Endure: Shields) vs the Weapon Risk. Positive net = defense succeeds (damage reduced). Negative net = defense fails (damage lands).
**For Endure specifically:** Success → Power die reduces effect tier. Failure → still reduces by 1 (floor). This means Endure is always "roll Shields vs Weapon Risk" — the player always rolls.

### 6. Coordinate Resistance
**Issue:** Coordinate is a support action buffing allies. What does the Co-Pilot roll against? The current playtest used Presence 2, but this isn't specified in the station data.
**Recommendation:** Support actions that only affect your own crew (Coordinate, Assist Pilot, Reinforce Shields, Plot Course) should roll against a flat Presence set by the GM based on combat intensity. Presence 1 (calm), 2 (standard combat), 3 (intense), 4 (desperate). This is consistent with Challenge Mode difficulty.

---

## PLAY OBSERVATIONS

### What Worked
1. **Popcorn order creates real tactical decisions.** Senna going first to Coordinate before Kael's Attack Run was the right call and felt meaningful. If she'd gone last, her buffs would've been wasted.
2. **Station interdependence is tangible.** The Pilot's Attack Run buffing all Gunners, the Co-Pilot's Coordinate stacking with it (or wasting on overlap), and the Engineer's shields preventing damage all feel like a real crew operating a ship.
3. **NPCs as static values works.** TIE Alpha's attack was resolved entirely by Kael rolling Evade. TIE Beta's attack was resolved by Shields vs Risk. No GM dice ever hit the table. Frame B is clean.
4. **Risk lines create tension.** The Pilot choosing between Evade (high upside, no floor) and Endure (safe, floor, no upside) is a genuine decision every time.
5. **Engineer proactive value is clear.** Torr's Reinforce Shields before TIE Beta's attack created a satisfying "we prepared for this" moment.

### What Needs Work
1. **[Optimized] stacking ambiguity** will cause confusion at every table. Needs a definitive ruling in the condition engine.
2. **Jam is useless at Fleeting vs fighters.** The Operator's primary debuff action has a dead tier against the most common enemy. This will frustrate Operator players.
3. **Chassis damage is undefined.** Players will ask "how much damage did I do?" and the GM has no answer. This is the biggest gap.
4. **Power die on Pilot positioning actions** has no clear role. Players will ask "why did I roll Engines d6 on Attack Run if it doesn't do anything?"
5. **Coordinate resistance** isn't specified. Every GM will set it differently.
6. **Mira (weak Gunner) was almost irrelevant.** A d6 Control die against Defense 4 means she needs a 5+ (33% chance) to hit at Fleeting, 50% with [Optimized]. The second Gunner slot may need a lower bar or a different contribution model for weaker crew members.

### Turn Order Impact (Popcorn Analysis)
**Going first in the crew's turn:**
- Support stations (Co-Pilot, Operator) get maximum value — their buffs affect everyone after them.
- Pilot going first commits the ship's geometry before knowing what support is available.

**Going last in the crew's turn:**
- Gunners going last benefit from all accumulated buffs.
- Support stations going last waste their buffs (no one left to benefit).
- The Pilot going last can react to the tactical picture but can't set up the Gunners.

**Optimal crew order (this scenario):** Co-Pilot → Operator → Pilot → Engineer → Gunners
- Co-Pilot buffs Pilot and Gunner
- Operator debuffs target or buffs Gunner
- Pilot positions ship and grants Attack Run buffs
- Engineer reinforces before enemy counterattack
- Gunners fire with all stacked buffs

**But this isn't always optimal.** If the ship is being chased and needs to Break Away, the Pilot should go first (before the pursuer closes further). If a system is offline, the Engineer should go first to Jury Rig it before anyone tries to use it. The "right" order changes with the tactical situation.
