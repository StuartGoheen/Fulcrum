# Group Challenge Schema

A `groupChallenge` object lives on a scene and describes a multi-beat VP accumulation challenge for the crew.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name of the challenge |
| `description` | string | Narrative context shown to players |
| `tier` | number | Challenge tier (1-5) |
| `power` | number | Opposition power value subtracted from rolls. Determines reachable result tiers: maxResult = 12 - power. Fleeting requires maxResult >= 0, Masterful >= 4, Legendary >= 8. |
| `vpThreshold` | number | VP target for success |
| `vpScoring` | object | VP values per result tier (see below) |
| `eligibleDisciplines` | array | Suggested approaches (players may use any discipline) |

## vpScoring Keys

| Key | Description |
|-----|-------------|
| `failure` | VP on failed Control roll (typically 0) |
| `fleetingCost` | VP on Fleeting with cost/complication |
| `masterfulCost` | VP on Masterful with cost/complication |
| `legendaryCost` | VP on Legendary with cost/complication |
| `fleeting` | VP on clean Fleeting success (net 0-3) |
| `masterful` | VP on clean Masterful success (net 4-7) |
| `legendary` | VP on clean Legendary success (net 8-11) |
| `unleashedI` | VP on Unleashed I (net 12-15, requires favored discipline) |
| `unleashedII` | VP on Unleashed II (net 16-19, requires explosion chain) |
| `unleashedIII` | VP on Unleashed III (net 20+, requires multiple explosions) |
| `masteryBonus` | Bonus VP added when Control roll is 8+ |

Only include tier keys that are relevant. Unleashed tiers are only available when explicitly defined. Cost tiers are optional.

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `failureConsequence` | string | Narrative consequence if challenge fails |
| `thresholds` | array | Intel reveals at VP milestones |

## thresholds Array Items

| Field | Type | Description |
|-------|------|-------------|
| `vp` | number | VP value that triggers this reveal |
| `intel` | string | Information revealed to crew at this threshold |

## eligibleDisciplines Array Items

| Field | Type | Description |
|-------|------|-------------|
| `discipline` | string | Canonical Discipline ID from the system's 25 disciplines. **Physique**: athletics, brawl, endure, melee, heavy_weapons. **Reflex**: evasion, piloting, ranged, skulduggery, stealth. **Grit**: beast_handling, intimidate, resolve, survival, control_spark. **Wits**: investigation, medicine, tactics, tech, sense_spark. **Presence**: charm, deception, insight, persuasion, alter_spark. |
| `approach` | string | Narrative description of how this discipline applies |

## Tier Reachability Rules

Result tiers are gated by challenge power:
- **Failure**: Always available
- **Fleeting / Fleeting Cost**: Available when power <= 12
- **Masterful / Masterful Cost**: Available when power <= 8
- **Legendary / Legendary Cost**: Available when power <= 4
- **Unleashed I/II/III**: Only shown if defined in vpScoring (requires favored discipline with exploding dice)

## Example

```json
{
  "groupChallenge": {
    "name": "Tracking Raden",
    "description": "The crew fans out across Blackwind Point to track down Warrick Raden's location.",
    "tier": 1,
    "power": 3,
    "vpThreshold": 10,
    "vpScoring": {
      "failure": 0,
      "fleetingCost": 0,
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
    "failureConsequence": "Someone noticed you asking...",
    "thresholds": [
      { "vp": 3, "intel": "A cold sighting..." },
      { "vp": 5, "intel": "He bought survival supplies..." }
    ],
    "eligibleDisciplines": [
      { "discipline": "investigation", "approach": "Methodical questioning..." },
      { "discipline": "charm", "approach": "Earning trust from locals..." }
    ]
  }
}
```
