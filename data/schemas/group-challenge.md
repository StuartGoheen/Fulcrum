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
| `eligibleDisciplines` | array | Suggested approaches (players may use any discipline unless `exclusive` modifier is active) |

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

## eligibleDisciplines Array Items

| Field | Type | Description |
|-------|------|-------------|
| `discipline` | string | Canonical Discipline ID from the system's 25 disciplines. **Physique**: athletics, brawl, endure, melee, heavy_weapons. **Reflex**: evasion, piloting, ranged, skulduggery, stealth. **Grit**: beast_handling, intimidate, resolve, survival, control_spark. **Wits**: investigation, medicine, tactics, tech, sense_spark. **Presence**: charm, deception, insight, persuasion, alter_spark. |
| `approach` | string | Narrative description of how this discipline applies |

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
      { "discipline": "stealth", "approach": "Moving through blind spots..." },
      { "discipline": "deception", "approach": "Impersonating Imperial crew..." },
      { "discipline": "tech", "approach": "Slicing security cameras..." }
    ]
  }
}
```
