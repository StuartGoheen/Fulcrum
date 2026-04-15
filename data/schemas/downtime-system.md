# Downtime & Interlude System

## Overview

The Downtime system has two layers:

1. **System Layer** (`data/downtime.json`, `data/entanglements.json`) — Generic activities and entanglements available across any adventure. These define what crews can always do during downtime, and what can always go wrong.

2. **Adventure Layer** (within `data/adventures/*.json`) — Authored interludes that plug into a specific narrative moment. These provide adventure-specific activities, entanglements, read-aloud text, and GM notes tied to the story.

The GM curates from both layers to build a downtime session.

---

## GM Workflow

1. **Determine the window.** How long do the characters have? Where are they? Duration and setting constrain what's feasible.
2. **Select system activities.** Pick from `data/downtime.json` activities that fit the setting (can't shop in hyperspace, can't tinker without tools).
3. **Add adventure interlude content.** If the current adventure has an authored interlude for this moment, pull in its specific activities, read-aloud, and GM notes.
4. **Choose entanglements.** Some baggage entanglements auto-trigger from decision-registry flags. Travel entanglements are selected by travel type. Or the GM picks "clean downtime" — no complications.
5. **Run the downtime.** Players choose activities. The GM runs checks where needed, narrates personal scenes, then springs entanglements.

---

## Downtime Periods

| Period | Duration | Recovery | Activity Slots |
|--------|----------|----------|---------------|
| Short Rest | ~1 hour | 1 Trauma | 0 |
| Long Rest | ~8 hours | 2 Trauma, 1 Vitality, clear [Stimmed] | 1 |
| Extended Downtime | Multiple days | Full recovery | ~1 per 2-3 safe days |

---

## System Activities (`data/downtime.json`)

Seven activity types, each with a defined structure:

| Activity | Type | Discipline | Check? | Setting |
|----------|------|-----------|--------|---------|
| Rest & Recovery | rest | Medicine / Wits | Yes (enhances baseline) | Any |
| Tinkering | tinkering | Tech / Wits | Yes | Ship, workshop, settlement |
| Research & Analysis | research | Investigation / Wits | Yes | Ship, settlement, station |
| Requisition & Resupply | shopping | Skulduggery / Reflex | Yes | Settlement, station |
| Training & Drill | training | Any | No (automatic benefit) | Any with appropriate space |
| Personal Scene | personal | Varies | No (narrative) | Any |
| Crew Bonding | social | None | No (narrative) | Ship, settlement, station |

### Activity Schema

```json
{
  "id": "dt-[type]",
  "name": "Display Name",
  "type": "rest|tinkering|research|shopping|training|personal|social",
  "description": "What this activity represents narratively.",
  "requirements": {
    "setting": ["ship", "settlement", "station", "workshop", "wilderness", "any"],
    "gear": ["Item name if required"],
    "note": "Additional constraints or clarifications."
  },
  "discipline": "skill name or 'any' or null",
  "arena": "arena name or 'any' or null",
  "actionType": "assess|interact|freeform",
  "resist": 2,
  "target": "What/who the check is against",
  "outcomes": {
    "failure": "What happens on a failed check.",
    "fleeting": "Tier 1 success outcome.",
    "masterful": "Tier 2 success outcome.",
    "legendary": "Tier 3 success outcome."
  },
  "markOpportunity": "mark-id or null",
  "note": "GM guidance."
}
```

Activities without checks (Training, Personal Scene, Crew Bonding) use `noCheck` and `benefit` fields in their outcomes instead of the tiered structure.

---

## Entanglements (`data/entanglements.json`)

Two categories:

### Baggage Entanglements
Consequences of past decisions. Triggered by decision-registry flags, character debts, or narrative state.

### Travel Entanglements
Situational events keyed to travel type: `hyperspace`, `planetary`, or `station`.

### Entanglement Schema

```json
{
  "id": "ent-bag-[name] or ent-trv-[name]",
  "name": "Display Name",
  "severity": "low|medium|high",
  "trigger": {
    "type": "decision-registry|condition",
    "impact": "registry-key (if decision-registry)",
    "is": "value to match (if decision-registry)",
    "note": "Human-readable trigger description."
  },
  "travelType": ["hyperspace", "planetary", "station"],
  "description": "What happens — the situation the crew faces.",
  "stakes": "What's at risk and what the crew stands to gain or lose.",
  "suggestedResolution": "Suggested disciplines, approaches, and consequences.",
  "markOpportunity": "mark-id or omitted"
}
```

Travel entanglements use `travelType` instead of `trigger`. Baggage entanglements use `trigger`.

---

## Adventure Interludes

Adventure-specific interludes are authored content within `data/adventures/*.json`. They extend the system layer with narrative-specific material.

### Interlude Structure (within adventure JSON)

Interludes live alongside scenes in the adventure structure. They use a distinct `type: "interlude"` field to differentiate from regular scenes:

```json
{
  "id": "adv1-interlude-1",
  "type": "interlude",
  "title": "The Smuggler's Path",
  "subtitle": "Jakku to Ajan Kloss",
  "setting": "Aboard the Banshee, hyperspace transit",
  "duration": "10-14 days (multiple long rests)",
  "travelType": "hyperspace",
  "readAloud": "Narrative text for the GM to read.",
  "gmNotes": "GM guidance for running this interlude.",
  "activities": [
    {
      "id": "int-adv1-copilot",
      "name": "Co-Pilot the Path",
      "type": "adventure-specific",
      "description": "Adventure-specific activity details.",
      "discipline": "piloting",
      "arena": "reflex",
      "outcomes": { ... }
    }
  ],
  "entanglements": [
    {
      "id": "ent-adv1-sensor-buoy",
      "name": "Imperial Sensor Buoy",
      "description": "Adventure-specific entanglement.",
      ...
    }
  ],
  "systemActivitiesAvailable": ["dt-rest-recovery", "dt-tinkering", "dt-research", "dt-training", "dt-personal-scene", "dt-crew-bonding"],
  "systemActivitiesExcluded": ["dt-shopping"],
  "systemActivitiesExcludedNote": "No shopping in hyperspace — except during the Ord Mantell stopover (handled as a specific activity)."
}
```

### Key Principles

- Adventure interludes **reference** system activities by ID — they don't redefine them
- Adventure-specific activities use the same schema as system activities but live in the interlude's `activities` array
- `systemActivitiesAvailable` and `systemActivitiesExcluded` let the interlude specify which system activities are feasible in this context
- Adventure-specific entanglements use the same schema as system entanglements but are scoped to this narrative moment

---

## Integration with Existing Systems

### Decision Registry
Baggage entanglements reference `data/decision-registry.json` keys via their `trigger.impact` and `trigger.is` fields. These triggers are GM-facing guidance — the GM checks the campaign's decision state and selects applicable entanglements manually. The `decision-resolver.js` utility provides the resolved state map that the GM (or a future UI) can consult, but entanglement selection is not automated.

### Discipline Checks
Activity checks follow the same resolution math as scene discipline challenges: Roll - Risk = Net Result, with the same tier scale (Fleeting → Masterful → Legendary). The `resist` value on an activity serves the same function as on a scene's discipline challenge.

### Rest Mechanics
The downtime system codifies the rest mechanics from `data/glossary.json` entries (Natural Recovery, [Stimmed X]) into structured periods. Baseline recovery is automatic; the Rest & Recovery activity enhances it with a Medicine check.

### Marks
Activities and entanglements may award marks. The `markOpportunity` field references mark IDs from the adventure's marks array or the Edge marks system. Personal scenes are the primary downtime path to Destiny marks.
