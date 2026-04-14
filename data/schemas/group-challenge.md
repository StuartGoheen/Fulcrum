# Group Challenge Schema

A `groupChallenge` object lives on a scene and describes a multi-beat VP accumulation challenge for the crew.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name of the challenge |
| `description` | string | Narrative context shown to players |
| `tier` | number | Base challenge tier (1-5). Determines Control die step-down. |
| `power` | number | Base opposition power. Determines reachable result tiers: maxResult = 12 - power. |
| `vpBase` | number | VP per player. Server calculates `vpThreshold = (vpBase + sum of modifier vpAdjust) × crewSize` at runtime. |
| `vpScoring` | object | VP values per result tier (see below) |
| `eligibleDisciplines` | array | Suggested approaches with role assignments (see below) |

## Standard vpScoring

All group challenges use the canonical scoring table:

| Key | VP | Description |
|-----|-----|-------------|
| `failure` | 0 | Failed Control roll |
| `fleetingCost` | 1 | Fleeting with cost/complication |
| `masterfulCost` | 1 | Masterful with cost/complication |
| `legendaryCost` | 1 | Legendary with cost/complication |
| `fleeting` | 1 | Clean Fleeting success (net 0-3) |
| `masterful` | 2 | Clean Masterful success (net 4-7) |
| `legendary` | 3 | Clean Legendary success (net 8-11) |
| `unleashedI` | 4 | Unleashed I (net 12-15, requires favored discipline) |
| `unleashedII` | 5 | Unleashed II (net 16-19, requires explosion chain) |
| `unleashedIII` | 6 | Unleashed III (net 20+, requires multiple explosions) |
| `masteryBonus` | 1 | Bonus VP added when Control die is natural 8+ |

Cost results always award 1 VP — the player makes progress but pays a narrative or mechanical price.

## Thresholds (Fractional)

Thresholds are stored as fractional percentages of the calculated vpThreshold. The server resolves them at runtime.

| Field | Type | Description |
|-------|------|-------------|
| `at` | number | Fraction of vpThreshold (0.0 to 1.0) that triggers this reveal |
| `intel` | string | Information revealed to crew at this threshold |
| `checkpoint` | boolean | (Optional) If true, this threshold becomes a VP floor. VP cannot drop below this point even with failure penalties. |

## Modifiers

An optional `modifiers` object on the challenge. All modifiers manipulate the existing resolution levers (Control die, Power die, Tier, Power) or structural rules.

### Resolution Lever Modifiers

| Key | Type | Description |
|-----|------|-------------|
| `escalating` | object | `{ field: "power"\|"tier", increment: number, vpAdjust?: number }` — The specified field increases by `increment` each beat. `vpAdjust` offsets the VP threshold calculation. |
| `pressure` | boolean | On failure, the failing character's Control die steps down 1 for their next roll in this challenge. |
| `momentum` | boolean | On clean success (no cost), the character's Power die steps up 1 for their next roll in this challenge. |
| `fatigue` | boolean | On cost results, the character's Control die steps down 1 for their next roll in this challenge. |
| `adaptation` | object | `{ increment: number }` — On any success, the challenge's power increases by `increment` permanently. |

### Structural Modifiers

| Key | Type | Description |
|-----|------|-------------|
| `timed` | object | `{ beats: number }` — Max beats allowed. Challenge auto-fails if VP threshold not met by this beat. |
| `failurePenalty` | object | `{ value: number, vpAdjust?: number }` — On failure, VP is reduced by `value` (floor is 0, respects checkpoints). `vpAdjust` offsets the VP threshold. |
| `disciplineLimit` | object | Restricts discipline usage. See sub-types below. |
| `allHands` | boolean | Challenge can only succeed if every connected crew member has submitted at least one roll. |
| `solo` | boolean | Only one character can contribute per beat. |

### disciplineLimit Sub-Types

| Key | Type | Description |
|-----|------|-------------|
| `type` | string | `"once_per_challenge"` \| `"cooldown"` \| `"diverse"` \| `"exclusive"` |
| `beats` | number | (Only for `cooldown`) Number of beats before a discipline can be reused by the same character. |

- **once_per_challenge**: Each discipline ID can only be used once across all characters and all beats.
- **cooldown**: A character cannot reuse the same discipline for N beats after using it.
- **diverse**: No character can use the same discipline on consecutive beats (must rotate).
- **exclusive**: Only the listed eligible disciplines may be used. No creative alternatives.

## Tier Reachability Rules

Result tiers are gated by the current effective power (base power + escalation):
- **Failure**: Always available
- **Fleeting / Fleeting Cost**: Available when maxResult >= 0 (power <= 12)
- **Masterful / Masterful Cost**: Available when maxResult >= 4 (power <= 8)
- **Legendary / Legendary Cost**: Available when maxResult >= 8 (power <= 4)
- **Unleashed I/II/III**: Only shown if defined in vpScoring (requires favored discipline with exploding dice)

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `failureConsequence` | string | Narrative consequence if challenge fails |
| `modifiers` | object | Modifier configuration (see above) |
| `benchmarks` | array | Phase transitions triggered by VP thresholds (see below) |

## Benchmarks (Phase System)

An optional `benchmarks` array enables discipline pool rotation at VP milestones. When `totalVP` reaches the benchmark's threshold, the active discipline pool swaps to the benchmark's `eligibleDisciplines`.

| Field | Type | Description |
|-------|------|-------------|
| `vpPercent` | number | Percentage of `vpThreshold` (0–100) that triggers this phase. |
| `name` | string | Display name for the phase (e.g., "Data Extraction"). |
| `narrativeText` | string | Narrative description shown to players when the phase triggers. |
| `eligibleDisciplines` | array | Replacement discipline pool (same schema as the top-level `eligibleDisciplines`). |

### Phase Resolution

- The base `eligibleDisciplines` array is Phase 0 (the default phase at challenge start).
- Multiple benchmarks are evaluated in order; the highest benchmark whose `vpPercent` threshold is met becomes the active phase.
- On phase transition, pending buffs whose `targetDiscipline` no longer exists in the new discipline pool are cleared.
- `disciplineLimit` restrictions (e.g., `once_per_challenge`) carry across phases — a discipline used in Phase 0 remains used in Phase 1.
- Both clients (player panel + GM dashboard) display the current phase name and receive updated discipline lists automatically.

## eligibleDisciplines Array Items

| Field | Type | Description |
|-------|------|-------------|
| `discipline` | string | Canonical Discipline ID from the system's 25 disciplines. **Physique**: athletics, brawl, endure, melee, heavy_weapons. **Reflex**: evasion, piloting, ranged, skulduggery, stealth. **Grit**: beast_handling, intimidate, resolve, survival, control_spark. **Wits**: investigation, medicine, tactics, tech, sense_spark. **Presence**: charm, deception, insight, persuasion, alter_spark. |
| `approach` | string | Narrative description of how this discipline applies |
| `role` | string | `"primary"` or `"secondary"`. Primary disciplines earn VP normally. Secondary disciplines earn 0 VP but place a data-defined buff on an ally. |
| `support` | object | **(Secondary only)** Defines the buff this support action grants. See Support Object below. |

### Support Object (secondary entries only)

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"optimized"` or `"empowered"`. Matches the canonical game-system conditions. |
| `targetDiscipline` | string | The primary discipline this buff applies to. The buff is only consumed when the target ally rolls this exact discipline. |
| `description` | string | Human-readable label shown in the UI (e.g., "Step up Control die on next Stealth roll"). |

### Primary vs Secondary Roles

- **Primary**: The character rolls and earns VP based on the standard scoring table. If a matching pending buff from an ally is available (same discipline as the buff's `targetDiscipline`), the primary roll consumes it automatically.
- **Secondary**: The character rolls but earns 0 VP regardless of result tier. The buff type and target discipline are defined in the challenge data — the player only chooses which ally receives the buff.
  - `"optimized"` — Grants [Optimized] on the target ally's next roll using `targetDiscipline`. Steps up the Control die (table-side effect). In the app, this is tracked and displayed as a reminder.
  - `"empowered"` — Grants [Empowered] on the target ally's next roll using `targetDiscipline`. Steps up the Power die. In the app, this reduces the effective opposition Power by 1 for tier reachability when the target rolls the specified discipline.
- A discipline can appear as both primary **and** secondary in the same challenge (e.g., Tech primary limited once per beat, Tech support action not limited the same way).
- Buffs are one-shot: consumed when the target submits a primary roll using the matching `targetDiscipline`. Only one buff can be pending per target character at a time.
- A character using a secondary discipline still counts for `allHands` participation and still records discipline usage for `disciplineLimit` checks.
- Secondary rolls still trigger `pressure`/`fatigue`/`momentum` modifiers based on the tier result (failure, cost, clean success).

## Example

```json
{
  "groupChallenge": {
    "name": "Infiltrating Reestkii Landing Field",
    "description": "The crew plans and executes an infiltration of the Imperial-controlled landing field.",
    "tier": 1,
    "power": 4,
    "vpBase": 3,
    "vpScoring": {
      "failure": 0,
      "fleetingCost": 1,
      "masterfulCost": 1,
      "legendaryCost": 1,
      "fleeting": 1,
      "masterful": 2,
      "legendary": 3,
      "unleashedI": 4,
      "unleashedII": 5,
      "unleashedIII": 6,
      "masteryBonus": 1
    },
    "modifiers": {
      "timed": { "beats": 6 },
      "disciplineLimit": { "type": "once_per_challenge" },
      "failurePenalty": { "value": 1, "vpAdjust": -1 }
    },
    "failureConsequence": "The alarm triggers. Stormtroopers lock down the perimeter.",
    "thresholds": [
      { "at": 0.25, "intel": "A gap in the south perimeter...", "checkpoint": false },
      { "at": 0.50, "intel": "Guard rotation leaves a three-minute window...", "checkpoint": true },
      { "at": 0.75, "intel": "The shuttle's external access panel is unlocked...", "checkpoint": false },
      { "at": 1.0, "intel": "Ghost run. Perfect infiltration.", "checkpoint": false }
    ],
    "eligibleDisciplines": [
      { "discipline": "stealth", "approach": "Moving through blind spots...", "role": "primary" },
      { "discipline": "skulduggery", "approach": "Picking locks on gates...", "role": "primary" },
      { "discipline": "deception", "approach": "Impersonating maintenance crew...", "role": "primary" },
      { "discipline": "investigation", "approach": "Studying patrol patterns...", "role": "secondary", "support": { "type": "optimized", "targetDiscipline": "stealth", "description": "Step up Control die on ally's next Stealth roll" } },
      { "discipline": "charm", "approach": "Chatting up off-duty personnel...", "role": "secondary", "support": { "type": "empowered", "targetDiscipline": "skulduggery", "description": "Step up Power die on ally's next Skulduggery roll" } }
    ],
    "benchmarks": [
      {
        "vpPercent": 50,
        "name": "Data Extraction",
        "narrativeText": "The crew reaches the Lambda shuttle. Mission shifts to data extraction and escape.",
        "eligibleDisciplines": [
          { "discipline": "tech", "approach": "Slicing the nav computer...", "role": "primary" },
          { "discipline": "piloting", "approach": "Prepping for hot extraction...", "role": "primary" },
          { "discipline": "skulduggery", "approach": "Bypassing shuttle security...", "role": "primary" },
          { "discipline": "stealth", "approach": "Covering the extraction team...", "role": "secondary", "support": { "type": "optimized", "targetDiscipline": "tech", "description": "Step up Control die on ally's next Tech roll" } },
          { "discipline": "investigation", "approach": "Mapping patrol sweep vectors...", "role": "secondary", "support": { "type": "empowered", "targetDiscipline": "piloting", "description": "Step up Power die on ally's next Piloting roll" } }
        ]
      }
    ]
  }
}
```
