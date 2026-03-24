# Playtest Round 1: TIE Intercept (v2 — Corrected Resolution)

## Core Resolution Model (Reference)

**Player acts against NPC:**
1. **Control die** = pass/fail gate. Roll 4+ on the final die = success. NPC **Presence** steps down the Control die before rolling (Presence 1 = one step-down, Presence 2 = two, etc.). [Optimized] steps it up, [Disoriented] steps it down. Floor: 2d4-take-lowest (~6.25%).
2. **Power die** = effect magnitude. On success, roll the Power die and subtract the NPC's relevant defensive stat (Defense, Evasion, or Resist). The remainder maps to the Effect Tier track: 0–3 Fleeting, 4–7 Masterful, 8–11 Legendary. [Empowered] steps up the Power die, [Weakened] steps it down.
3. **Control 8+** = exceptional execution. Adds +1 Effect Tier shift (post-roll bonus). A Fleeting becomes Masterful, Masterful becomes Legendary, etc.
4. **Same-name conditions do not stack.** [Optimized] from two sources = still one step-up.

**NPC acts against player:**
1. NPC has a static **Power rating** on their action (e.g., Laser Cannons Power 4).
2. Player chooses defense: Dodge/Evade (no floor on failure) or Endure (floor: -1 tier even on failure).
3. Player rolls **Control die** for the defense (4+ = success). On success, player rolls **Power die** (armor/shields/handling) — this is subtracted from the NPC's Power rating. Remainder = damage tier.
4. On Dodge/Evade failure: no mitigation, NPC's full Power maps to the tier track.
5. On Endure failure: still reduces NPC's effect by 1 tier (the floor).

---

## Scenario Setup

**Player Ship:** Modified YT-1300 light freighter ("The Krayt's Tooth")
- Handling: d6
- Engines: d6
- Shields: d8
- Sensors: d6
- Weapon Mounts: d8 (dorsal turret), d6 (ventral turret)
- Hull Integrity: 8

**Crew (Pregens at Stations):**
| Station    | Character | Control Die | Discipline              |
|------------|-----------|-------------|-------------------------|
| Pilot      | Kael      | d8          | Piloting (Reflex)       |
| Gunner 1   | Voss      | d8          | Heavy Weapons (Physique) |
| Gunner 2   | Mira      | d6          | Heavy Weapons (Physique) |
| Operator   | Dex       | d8          | Tech (Wits)             |
| Engineer   | Torr      | d8          | Tech (Wits)             |
| Co-Pilot   | Senna     | d8          | Tactics (Wits)          |

**Enemy Ships (Static NPC Values — they are the Risk):**
TIE/ln Fighters — fast, fragile, no shields. Standard threat, single-crew.

| Stat             | TIE Alpha | TIE Beta | Notes |
|------------------|-----------|----------|-------|
| Presence         | 1         | 1        | Steps down PC Control die ×1. Competent Imperial pilot. |
| Defend           | 3         | 3        | Subtracted from PC's Power die on weapon attacks. |
| Evasion          | 3         | 3        | Subtracted from PC's Power die on maneuvers targeting Evasion. |
| Resist           | 1         | 1        | Subtracted from PC's Power die on electronic warfare (Jam, etc.). |
| Weapon Power     | 4         | 4        | Static attack value. PC's defense Power die subtracts from this. |
| Hull (Vitality)  | 4         | 4        | No shields. No impairment buffer. Damage = hull loss. |

**Starting Position:**
- TIEs at Medium range (Zone 2), closing to engage.
- Open space — no environmental terrain.
- No pre-existing conditions.

---

## Initiative: Popcorn Style

Roll order this round: **TIE Alpha → Player Crew → TIE Beta**

The crew did not win initiative. TIE Alpha acts first. The player crew goes second — they choose their internal station order (this matters enormously). TIE Beta goes last.

Key tension: **Who goes first inside the player crew's turn determines what buffs cascade to later stations.** Support stations (Co-Pilot, Operator) going early means their buffs are live for the Gunners. But the Pilot going early commits the ship's geometry before knowing what support is available.

---

## THE ROUND

---

### Beat 1: TIE Alpha Acts

**GM declares:** "TIE Alpha screams in from your port side, green lasers stitching across your hull. Strafing run — TIE Alpha attacks the Krayt's Tooth."

TIE Alpha's Weapon Power is **4**. The crew chooses a defense.

**Crew Decision: Evade or Endure?**
- **Evade** (Pilot rolls): Kael rolls Piloting (Control) vs TIE's Presence, then Handling (Power) subtracts from TIE's Weapon Power 4. Success = mitigation. Failure = full hit, no floor. Control 8+ = Opening for Gunners.
- **Endure** (Shields): Shields d8 subtracts from TIE's Weapon Power 4. Even on failure, -1 tier floor. Safer but no upside.

**The crew picks Evade.** They want the chance at an Opening.

> **Kael rolls Evade:**
> - Control: Piloting d8, stepped down ×1 by TIE Presence 1 → **d6** → rolls **6** ✓ (4+ = success)
> - Control 8+ check: 6 is not 8+. No bonus tier shift.
> - Power: Handling d6 → rolls **3**
> - TIE Weapon Power (4) minus Kael's Handling result (3) = **1** → **Fleeting effect**
> - Fleeting damage on the Effect Track → minimal. The hit grazes.

**Result:** Kael yanks the stick hard. The green bolts clip the dorsal hull — a glancing hit, but the shields and hull plating absorb the worst of it. Fleeting damage.

**Damage to Krayt's Tooth:** Fleeting tier hit lands. Per the TIE's weapon effect track (simple action, Power 4): Fleeting = 1 damage. Hull: 8 → 7.

**Observation:** Evade succeeded (Control 6 on d6 — needed 4+, got it). But the Handling d6 Power die only rolled a 3 against Weapon Power 4, so the TIE's attack still got through at Fleeting. Evade reduced it from a potential Masterful hit (Power 4 unmitigated = tier 4-7) down to Fleeting (net 1). If Kael had failed the Control roll, the full Power 4 would have landed as Masterful damage — much worse. If Kael had rolled higher on the Handling die (4+), the attack would have been completely negated.

**The Presence 1 step-down mattered.** Kael's Piloting d8 became d6. On d8 he'd have had a 62.5% chance of success. On d6 it dropped to 50%. That's the TIE pilot's competence expressed mechanically — not as an NPC roll, but as pressure on the player's accuracy.

---

### Beat 2: Player Crew's Turn

The crew chooses their station order. This is the tactical heart of the round.

**Senna (Co-Pilot) proposes going first.** She wants to Coordinate before anyone else acts.

---

#### Beat 2a: Senna (Co-Pilot) — Coordinate

**Action:** Coordinate — Tactics (Wits).

**Resistance:** Coordinate buffs your own crew. No enemy opposes it directly. The GM sets a Presence based on combat intensity. Standard dogfight = **Presence 1** (steps down Senna's Control die once: d8 → d6).

> **Senna rolls Coordinate:**
> - Control: Tactics d8, stepped down ×1 by combat Presence 1 → **d6** → rolls **5** ✓ (4+ = success)
> - Power: Sensors d6 → rolls **4**
> - Effect tier: Power 4 minus... what? There's no NPC resistance here. Coordinate's effect tiers are self-contained — the tier is determined by the Power die result on the effect track.
> - Power result 4 → falls in the **4–7 range** → **Masterful**

**Masterful Coordinate effect:** "Grant [Optimized] to one crew member and [Empowered] to a different crew member for their next actions this round."

**Senna's choice:** She gives **[Optimized] to Kael (Pilot)** and **[Empowered] to Voss (Gunner 1)**.

Why this allocation? Kael's Attack Run Control die will be stepped down by TIE Presence — [Optimized] counteracts that, restoring his d8. Voss's Weapon Mount d8 stepped up by [Empowered] → d10, which directly increases the Power die result that determines his damage tier after subtracting TIE Defend 3.

**Result:** Senna calls vectors from the copilot seat: "Alpha pulled high after the strafing run — Kael, you've got an approach window on Beta if you commit now. Voss, I'm feeding deflection angles to your turret."

**Active Conditions:**
- Kael: [Optimized] (Control die stepped up ×1 for next action)
- Voss: [Empowered] (Power die stepped up ×1 for next action)

**Observation:** Senna's buff allocation is smart with the corrected model. [Optimized] on the Pilot offsets the TIE's Presence 1 step-down — Kael's effective Control is restored to d8 instead of suffering d6. [Empowered] on the Gunner steps up his Weapon Mount from d8 to d10, meaning after subtracting TIE Defend 3, his expected damage tier jumps significantly. d10 average is 5.5, minus Defend 3 = average net 2.5 (Fleeting). Without [Empowered], d8 average is 4.5, minus 3 = 1.5 (Fleeting but lower). The real swing comes at the top end: d10 can roll 10, yielding net 7 (Masterful). d8 maxes at 5 net (still Masterful, but barely).

**DESIGN NOTE — Support Action Resistance:** For support actions that only affect your own crew (Coordinate, Assist Pilot, Reinforce Shields, Plot Course), the GM sets a flat Presence based on combat intensity. Presence 0 (calm prep), 1 (standard combat), 2 (chaos/suppression), 3+ (extreme pressure). This is consistent with Challenge Mode. The Power die for support actions has no NPC stat to subtract from — the raw Power result maps directly to the effect tier.

---

#### Beat 2b: Kael (Pilot) — Attack Run on TIE Beta

**Action:** Attack Run — Piloting (Reflex) + Engines. Targeting TIE Beta.

Kael has [Optimized] from Senna's Coordinate.

> **Kael rolls Attack Run:**
> - Control: Piloting d8, stepped down ×1 by TIE Beta Presence 1 → d6, then stepped up ×1 by [Optimized] → **d8** (restored!) → rolls **8** ✓ — **Control 8+!**
> - Power: Engines d6 → rolls **5**
> - TIE Beta Evasion 3. Power result (5) minus Evasion (3) = **2** → **Fleeting** on the track.
> - **Control 8+ bonus:** +1 Effect Tier shift. Fleeting → **Masterful!**

**Masterful Attack Run effect:** "Ship closes 1 zone. All Gunners gain [Optimized] and [Empowered] on their next attack this round."

**Result:** Senna's [Optimized] restored Kael's die to d8, and he rolled the maximum — 8. The Control 8+ bonus bumped a Fleeting Power result into Masterful territory. This is the dual-axis payoff: Kael's accuracy (Control) was excellent, and even though the Engines (Power) only produced a modest result against the TIE's Evasion, the exceptional execution elevated the whole action.

The Krayt's Tooth dives from Zone 2 to Zone 1 (Close range). The angle is aggressive and precise — both turrets have clean firing arcs.

**Active Conditions:**
- Voss: [Empowered] (from Senna) + [Optimized] and [Empowered] (from Attack Run). [Empowered] doesn't stack — still one step-up. [Optimized] is new. **Net: [Optimized] + [Empowered].**
- Mira: [Optimized] + [Empowered] (from Attack Run).
- Kael: [Optimized] consumed.

**Observation:** The [Optimized] from Senna on Kael was the critical play. Without it, Kael would have been rolling d6 (50% success, 0% chance of 8+). With [Optimized] restoring d8, he had 62.5% success and a 12.5% chance at Control 8+, which hit. The Masterful Attack Run gives ALL Gunners both [Optimized] and [Empowered] — a massive crew-wide offensive buff that wouldn't have happened without the Co-Pilot's setup.

Voss already had [Empowered] from Senna, so the Attack Run's [Empowered] is redundant for him (no stacking). But he gains [Optimized] he didn't have. Mira gains both buffs fresh. The overlapping [Empowered] on Voss is a minor efficiency loss — Senna could have [Empowered] someone else if she'd known Kael would hit Masterful. But you can't predict dice. The redundancy is acceptable.

---

#### Beat 2c: Dex (Operator) — Jam TIE Beta

Dex decides to Jam TIE Beta to degrade its attack before it acts in Beat 3.

**Action:** Jam — Tech (Wits) vs TIE Beta's Resist 1.

> **Dex rolls Jam:**
> - Control: Tech d8, stepped down ×1 by TIE Beta Presence 1 → **d6** → rolls **4** ✓ (4+ = success, just barely)
> - Power: Sensors d6 → rolls **5**
> - TIE Resist 1. Power result (5) minus Resist (1) = **4** → **Masterful!**

**Masterful Jam effect:** "Target ship's Sensors are [Jammed] — their Operator actions automatically fail this round. Communications are disrupted."

**Result against a single-crew TIE:** TIEs don't have a separate Operator station. The [Jammed] on sensors means the pilot's sensor-dependent functions are disrupted. Communications are disrupted — the TIE can't coordinate with its wingmate or call for reinforcements.

**DESIGN QUESTION (carried from v1): Jam vs Single-Crew Fighters**
The Masterful Jam text says "Operator actions automatically fail." A TIE has no Operator. The comms disruption is narratively meaningful but mechanically unclear for single-crew fighters.

However, at Masterful, the comms disruption is tactically real: TIE Beta can't call for backup, can't coordinate attack runs with TIE Alpha, can't report the freighter's position to the Star Destroyer. In a longer scenario, this matters. And if the TIE's pilot IS functioning as their own Operator (using sensors to target), then [Jammed] could reasonably degrade their targeting. 

Note: Fleeting Jam ("[Disoriented] on Operator/Co-Pilot actions") would still be mechanically hollow against a TIE. The gap at Fleeting tier remains. See design recommendations at end.

**Active Conditions:**
- TIE Beta: Sensors [Jammed] (comms disrupted, sensor-dependent functions offline)

---

#### Beat 2d: Torr (Engineer) — Reinforce Shields

TIE Beta hasn't acted yet. Torr shores up defenses proactively.

**Action:** Reinforce Shields — Tech (Wits) + Shields.

Reinforce Shields is a self-buff (no enemy opposition). GM sets combat Presence 1.

> **Torr rolls Reinforce Shields:**
> - Control: Tech d8, stepped down ×1 by Presence 1 → **d6** → rolls **6** ✓
> - Power: Shields d8 → rolls **6**
> - No NPC stat to subtract (self-buff). Power result 6 → **Masterful** (4–7 range).
> - Control 8+ check: 6 is not 8+. No bonus shift.

**Masterful Reinforce Shields effect:** "Ship gains [Buffered 2]. The shield reinforcement is clean — no power drain to other systems."

**Result:** Torr locks the deflector harmonics and overcharges the forward grid. The shields hum with reinforced energy.

**Active Conditions on Krayt's Tooth:**
- [Buffered 2] — absorbs 2 points of incoming hull damage before it touches the hull.

**Observation:** Solid result. [Buffered 2] means the next 2 hull damage that gets through Evade/Endure is absorbed. Combined with the defense choice on TIE Beta's attack, this provides meaningful insurance. The d8 Shields die being the Power die here is important — a ship with d6 Shields would have a harder time reaching Masterful on Reinforce.

---

#### Beat 2e: Voss (Gunner 1) — Attack TIE Beta

Voss is on the dorsal turret (d8 mount). TIE Beta is at Zone 1 (Close range).
Voss has [Optimized] (from Attack Run) and [Empowered] (from Senna's Coordinate).

**Action:** Attack — Heavy Weapons (Physique) vs TIE Beta.

> **Voss rolls Attack:**
> - Control: Heavy Weapons d8, stepped down ×1 by TIE Presence 1 → d6, stepped up ×1 by [Optimized] → **d8** (restored!) → rolls **7** ✓
> - Power: Weapon Mount d8, stepped up ×1 by [Empowered] → **d10** → rolls **9**
> - TIE Beta Defend 3. Power result (9) minus Defend (3) = **6** → **Masterful!**
> - Control 8+ check: 7 is not 8+. No bonus shift.

**Masterful Attack effect:** "Weapon chassis damage (Masterful tier). Solid hit — meaningful structural damage."

**Damage to TIE Beta:** Masterful damage. For a TIE (simple hull, no shields, no impairment buffer), Masterful = significant structural damage. Using tiered damage model: Masterful hit deals damage from the weapon effect track.

**DESIGN QUESTION: Damage Numbers**
With the corrected model, the Power die result MINUS Defense IS the tier position, and the tier tells you the effect. But how much hull damage does each tier deliver? The station text describes tiers narratively ("glancing hit," "meaningful structural damage," "critical structural damage") but doesn't assign hull point values.

**For this playtest, using a simple model:** The net Power result (after subtracting Defense) IS the hull damage dealt. Voss's net was 6. TIE Beta takes 6 hull damage. TIE Beta has 4 Hull. **TIE Beta is destroyed.**

**Result:** Voss's turret erupts. The red bolts hammer into TIE Beta's cockpit viewport at close range. The solar panel shears off, the fuselage crumples, and the fighter detonates in a bloom of orange fire. TIE Beta is gone.

**Observation:** The buff chain worked exactly as designed:
1. Senna [Empowered] Voss → Weapon Mount d8 → d10.
2. Kael's Attack Run [Optimized] Voss → Control d6 (after Presence step-down) → d8 (restored).
3. Voss fires: Control d8 succeeds (7), Power d10 rolls 9. Net damage after Defend 3 = 6. TIE's 4 Hull can't absorb it.

Without the buffs: Voss would have rolled Control d6 (50% success) and Power d8 (max net 5 after Defend 3, average net 1.5). The buffs elevated his chance of success from 50% to 62.5% and his expected damage from Fleeting-range to Masterful-range. **The crew's coordination killed that TIE — no single station could have done it this cleanly alone.**

---

#### Beat 2f: Mira (Gunner 2) — Attack TIE Alpha

Mira is on the ventral turret (d6 mount). TIE Alpha is at Zone 2 (Medium range — it strafed from further out and the ship moved toward Beta, not Alpha).

Mira has [Optimized] + [Empowered] from Kael's Attack Run.

**Action:** Attack — Heavy Weapons (Physique) vs TIE Alpha.

> **Mira rolls Attack:**
> - Control: Heavy Weapons d6, stepped down ×1 by TIE Presence 1 → d4, stepped up ×1 by [Optimized] → **d6** (restored!) → rolls **4** ✓ (barely!)
> - Power: Weapon Mount d6, stepped up ×1 by [Empowered] → **d8** → rolls **3**
> - TIE Alpha Defend 3. Power result (3) minus Defend (3) = **0** → **Fleeting** (0–3 range).
> - Control 8+ check: 4 is not 8+. No bonus shift.

**Fleeting Attack effect:** "Weapon chassis damage (Fleeting tier). Glancing hit — minimal structural impact."

**Damage to TIE Alpha:** Net Power 0. Per the damage model (net = hull damage), 0 damage? That feels wrong — it's a hit (Control succeeded), but the Power die couldn't overcome the TIE's Defend.

**DESIGN QUESTION: Fleeting Floor on Damage**
If the Power die result exactly equals or barely exceeds the NPC's Defense (net 0-3, Fleeting range), should there be minimum damage? Options:
- A. Net 0 = minimum 1 hull damage (a hit is a hit — the Control success means you connected).
- B. Net 0 = 0 damage (the hit connected but the TIE's hull absorbed it entirely — armor did its job).
- C. Fleeting tier always deals 1 damage regardless of net value (tier = damage floor).

**For this playtest, using option C.** Fleeting = 1 damage minimum. The shot hit. It counts.

**Damage to TIE Alpha:** Hull 4 → 3.

**Result:** Mira's ventral turret scores a hit on TIE Alpha's wing — a shallow burn across the solar panel. Cosmetic at worst, but the TIE shudders. Mira grins. "Got one!"

**Observation:** Mira is the weak link in the crew, and the math shows it clearly:
- Base Control d6, stepped to d4 by Presence 1. Without [Optimized], she'd need 4+ on d4 — **only 25% success.** With [Optimized] restoring d6, she's back to 50%. She barely made it (rolled 4 exactly).
- Base Power d6, stepped to d8 by [Empowered]. Rolled 3 against Defend 3 — net 0. Even with the buff, her weapon mount couldn't overcome the TIE's armor meaningfully.

Mira's contribution this round was 1 hull damage (Fleeting floor). Without both buffs from the Attack Run, she would have had a 25% chance to hit and near-zero expected damage. **The crew's setup actions are what made her viable at all.**

This surfaces a real gameplay dynamic: weak crew members in secondary stations are carried by the support structure. A d6 Gunner on a d6 mount against Presence 1 / Defend 3 enemies is marginal even with help. Without help, she's almost irrelevant. This is working as intended — it creates crew upgrade pressure (better gunner, better turret) and makes the support stations feel essential.

---

### Beat 3: TIE Beta Acts

**TIE Beta was destroyed by Voss in Beat 2e. It does not act.**

The popcorn initiative meant TIE Beta never got its turn. The crew's coordinated assault in their window deleted it before it could fire. **This is the reward for efficient crew play — you can eliminate threats before they act.**

If the crew had been less coordinated (no buffs, Mira shooting Beta instead of Alpha, etc.), TIE Beta would have survived to fire here. The popcorn order punishes the ship that goes last if the middle actor is efficient enough.

---

## END OF ROUND 1

### Damage Summary
| Ship            | Hull | Conditions                  | Status     |
|-----------------|------|-----------------------------|------------|
| Krayt's Tooth   | 7/8  | [Buffered 2]                | Light damage (1 hull from TIE Alpha's strafing run) |
| TIE Alpha       | 3/4  | None                        | Light damage (1 hull from Mira's Fleeting hit) |
| TIE Beta        | 0/4  | —                           | **Destroyed** (Masterful hit from Voss) |

### Condition Tracker
- [Buffered 2] on Krayt's Tooth: persists until consumed or refreshed.
- TIE Beta: [Jammed] expired (target destroyed).
- All [Optimized]/[Empowered] from this round: consumed by the actions they buffed.

---

## ROUND 1 ANALYSIS

### What the Correct Resolution Model Reveals

**1. Presence is the master difficulty dial.**
TIE Presence 1 forced every player to roll one die size smaller on Control. This is a massive swing:
- Kael's Piloting d8 → d6 (62% → 50% success). Senna's [Optimized] restored it.
- Voss's Heavy Weapons d8 → d6. Attack Run's [Optimized] restored it.
- Mira's Heavy Weapons d6 → d4 (50% → 25% success!). [Optimized] restored d6.
- Without buffs, the whole crew was fighting at one die smaller. The Co-Pilot's Coordinate and the Pilot's Attack Run were not bonuses — they were corrections. Against Presence 0 enemies, those buffs would be pure upside. Against Presence 1, they're essential just to maintain baseline effectiveness.

A Presence 2 threat would step everyone down twice. Mira's d6 would become d4 with [Optimized], or the 2d4-take-lowest floor without it. The crew would need multiple buff sources just to function. Presence is terrifying.

**2. Defense subtracting from Power creates meaningful armor.**
TIE Defend 3 meant Voss needed to roll 7+ on his Power die to reach Masterful damage (net 4+). On a d8 weapon mount, that's only 25% chance. On a d10 (with [Empowered]), it's 40%. The [Empowered] buff wasn't just "more damage" — it was the difference between mostly-Fleeting and sometimes-Masterful.

Mira's d6 weapon mount (stepped to d8 by [Empowered]) had a maximum net of 5 against Defend 3. She physically cannot reach Legendary against a Defend 3 target with that weapon. Her ceiling is low Masterful on a perfect roll. This is a real hardware limitation, not a skill problem.

**3. The dual-axis separation is clean and tactically rich.**
[Optimized] = "can you hit?" [Empowered] = "how hard?" These are genuinely independent decisions for the Co-Pilot:
- [Optimized] the Pilot: offsets Presence step-down, improves success rate, opens the Control 8+ bonus window.
- [Empowered] the Gunner: directly increases damage tier after Defense subtraction.
- Swapping them would be suboptimal: [Empowered] on Pilot improves Engines Power die (which determines Attack Run tier after Evasion subtraction — useful!), but [Optimized] on Gunner offsets Presence (more critical for a d6 Gunner who drops to d4 without it).

The Co-Pilot's allocation IS the tactical puzzle. There is no universally correct answer — it depends on who needs accuracy (Control help) vs who needs power (Power help) vs what NPC values they're fighting against.

**4. Control 8+ is a rare, high-impact event.**
Kael hit it this round on a d8 (12.5% chance). It elevated a Fleeting Attack Run to Masterful, which unlocked [Optimized]+[Empowered] for ALL Gunners instead of just [Optimized]. That single tier bump cascaded through the entire crew's effectiveness.

On d6 (the Presence-stepped die), Control 8+ is impossible (max 6). On d10, it's 30%. On d12, it's 42%. This means higher-skill characters don't just succeed more — they trigger bonus tier shifts that amplify the whole crew. Pilot skill is a force multiplier.

**5. Popcorn initiative + crew order = two layers of tactical sequencing.**
- Layer 1: TIE Alpha → Crew → TIE Beta. The crew's position in the sequence determines what threats they face before and after acting.
- Layer 2: Within the crew's turn, station order determines buff cascading. Co-Pilot first = buffs available for everyone. Gunners last = maximum buff accumulation. Pilot in the middle = can react to the tactical picture AND set up Gunners.

This round's order (Co-Pilot → Pilot → Operator → Engineer → Gunner 1 → Gunner 2) was near-optimal. The only waste was Dex's Jam producing limited effect against a single-crew fighter and the redundant [Empowered] on Voss.

---

## DESIGN QUESTIONS SURFACED

### 1. Jam vs Single-Crew Fighters (Carried from v1)
**Issue:** Fleeting Jam ("[Disoriented] on Operator/Co-Pilot actions") does nothing against a TIE. Masterful Jam ("[Jammed], comms disrupted") has narrative value but unclear mechanical impact on a single-crew fighter.
**Recommendation:** Rewrite Jam tiers to affect ALL sensor-dependent functions on the target ship, not just Operator/Co-Pilot stations. At Fleeting: "[Disoriented] on all sensor-assisted rolls (targeting, evasion reaction, communications)." This makes Jam universally useful — against fighters it degrades their pilot's targeting; against capital ships it degrades multiple stations. The scaling at higher tiers remains intact.

### 2. Hull Damage Model
**Issue:** The net Power result (Power die minus Defense) maps to the Effect Tier track, and the tier describes the hit narratively. But hull damage in hit points isn't defined.
**Current playtest assumption:** Net Power result = hull damage directly. This produces clean, intuitive results: Voss's net 6 kills a 4-Hull TIE outright. Mira's net 0 deals 1 (Fleeting floor).
**Concern:** If net = hull damage, then a d12 Weapon Mount [Empowered to d14?] against Defend 1 could deal 11+ hull damage in a single shot. Against a 4-Hull TIE, anything above 4 is overkill. Against an 8-Hull freighter, even Masterful hits might one-shot it.
**Recommendation:** Define explicitly: "On a successful attack, the net Power result (Power die minus target Defense) is the hull damage dealt. Minimum 1 damage on any successful hit (Fleeting floor). System impairment is a separate effect triggered by tier, not by raw damage."

### 3. Support Action Resistance Model
**Issue:** Coordinate, Assist Pilot, Reinforce Shields, Plot Course — these target your own crew, not an enemy. What Presence applies?
**Recommendation:** GM-set Presence based on combat intensity (0 = prep/calm, 1 = standard combat, 2 = heavy fire/chaos, 3 = desperate). The Power die for support actions maps directly to the effect tier track (no NPC stat to subtract). This is clean, consistent with Challenge Mode, and already works in this playtest.

### 4. Fleeting Damage Floor
**Issue:** If net Power is 0 (Power die exactly equals Defense), is it 0 damage or 1?
**Recommendation:** Any successful hit (Control 4+) deals minimum 1 hull damage. The Control success means the shot connected — it should always mean something. Net 0 = Fleeting = 1 damage.

---

## PLAY OBSERVATIONS

### What Worked
1. **Presence as Control step-down is elegant and terrifying.** One number changes the entire crew's probability landscape. The players immediately felt the pressure of fighting Presence 1 and understood why the Co-Pilot's [Optimized] was essential.
2. **Defense subtracting from Power creates real armor.** Defend 3 on a TIE means d6 weapon mounts are marginal. You need d8+ to reliably deal Masterful damage. This creates weapon upgrade pressure and makes [Empowered] feel meaningful.
3. **The buff chain is satisfying and learnable.** Co-Pilot → Pilot → Gunners is an obvious but rewarding sequence. Players who learn to chain buffs will dramatically outperform those who don't. This is good — it rewards crew coordination without requiring system mastery.
4. **Frame B holds perfectly.** Not a single NPC die was rolled. TIE Alpha's attack was resolved by the Pilot rolling Evade. TIE Beta's attack never happened because the crew killed it first. Every outcome was determined by player rolls against static values.
5. **Popcorn initiative creates real stakes.** TIE Beta never acted because the crew was efficient. If the order had been TIE Alpha → TIE Beta → Crew, the ship would have taken two attacks before responding. Initiative order is a genuine tactical dimension.

### What Needs Work
1. **Jam needs rewriting for single-crew fighters.** The most common enemy in Star Wars is a single-pilot fighter. Jam must be relevant against them at every tier.
2. **Hull damage model needs codification.** "Net Power = hull damage" works but needs to be written into the system, not assumed.
3. **Support action Presence is ad hoc.** Needs a clear guideline in the starship combat rules.
4. **Fleeting floor (1 damage minimum) needs explicit statement.** Without it, a successful hit can deal 0 damage, which feels wrong.

### Buff Allocation Cheat Sheet (Emergent from Play)
| Buff        | Best Target       | Why |
|-------------|-------------------|-----|
| [Optimized] | Weakest Control die crew member, or anyone whose Control was stepped below d8 by Presence | Offsets Presence. Most impactful on crew members who drop to d4 without it (25% → 50% success). |
| [Empowered] | Gunner with best base Power die | Directly increases net damage after Defense subtraction. More impactful on larger Power dice (d8→d10 gains more net damage than d6→d8). |
| Both (Masterful Coordinate) | Split: [Optimized] to Pilot, [Empowered] to primary Gunner | Pilot needs accuracy to unlock Attack Run buffs. Gunner needs Power to overcome Defense. |
