# Mission Debrief — Watcher Voice Leak Eval

Sanity-check for Task #204: confirm the rewritten Mission Debrief AI prompt
(`buildMissionSummaryPrompt` in `server/routes/campaign.js`) keeps the
unnamed watcher's identity hidden, even though the GM-only `data/campaign-bible.md`
content gets injected into the prompt via `extractBibleContext`.

## Setup

- **Model / config:** `gemini-2.5-flash`, `responseMimeType: 'application/json'`,
  `temperature: 0.7`, `maxOutputTokens: 4096` — identical to the production
  call site at `server/routes/campaign.js`.
- **Sample set:** 8 debriefs per pass across 8 different adventures and
  three outcome mixes (`all-success`, `mixed`, `partial`):
  `adv1 all-success`, `adv2 mixed`, `adv3 mixed`, `adv4 partial`,
  `adv5 all-success`, `adv6 partial`, `adv7 mixed`, `adv10 mixed`.
- **Prompt:** the exact production `buildMissionSummaryPrompt`, fed by the
  real `extractBibleContext(adventureId)` (so the actual GM-only bible
  content gets injected). Crew, scenes, decisions, and journal entries are
  mocked but shaped like real DB rows.
- **Leak scanner** (case-insensitive, word-bounded where appropriate):
  - Lore / identity terms called out in the task brief:
    `quinlan`, `vos`, `hidden path`, `jedi`, `kiffar`, `kiffu`,
    `the force`, `force-sensitive`, `force-user`, `holocron(s)`, `sith`,
    `inquisitor(s)`, `lightsaber`, `padawan`.
  - Speaker species/appearance tells (Quinlan Vos is a Kiffar male with
    yellow facial tattoo markings and dreadlocks):
    `dreadlock`, `facial tattoo`, `face tattoo`,
    `yellow (facial|tattoo|stripe|markings?)`,
    `my (species|kind|people|tattoo|face|skin|robes?|saber)`,
    `I am (a |an )?(human|kiffar|jedi|force|male|female)`.
- **Driver:** `eval/debrief-watcher-leak/leak-eval.js`. Set `SANITIZE=0` to
  reproduce the pre-fix baseline. Sample debriefs and per-run reports land
  under `eval/debrief-watcher-leak/samples/<label>/`.

## Baseline (pre-fix, `SANITIZE=0`)

`samples/baseline/_report.json` — **1 leak across 8 runs.**

- `adv3 mixed` leaked **`Inquisitor`**. The model wrote:
  > *"Admiral Varth's intel about Inquisitor Draco's flagship, the Assiduous,
  > arriving, puts a clock on things."*
- Root cause: the synopsis for Adventure 3 in `data/campaign-bible.md`
  literally names "Inquisitor Valin Draco", and that synopsis is dropped
  wholesale into the prompt. The injected NPC profile block also used the
  literal headers `Jedi Master Denia` and `Inquisitor Valin Draco`, priming
  the model to echo those titles even though the voice rules forbid them.
- The other 7 runs were clean — including the broader species/appearance
  scanner — so the prompt itself is solid; the issue was purely the GM-only
  vocabulary leaking through the bible-injection channel.

## Fix (in `server/routes/campaign.js`)

1. Added `WATCHER_FORBIDDEN_TERMS` constant listing the GM-only vocabulary.
2. Added `sanitizeForWatcherVoice(text)`: drops every sentence in the
   injected bible content that mentions a forbidden term, then redacts any
   leftover bare term to `[redacted]`.
3. `extractBibleContext` now sanitizes `themes`, `synopsis`, **and** each
   character snippet before returning them.
4. The character-lookup table now separates `lookup` (the bible header,
   e.g. `Jedi Master Denia`) from `display` (what we hand to the model,
   e.g. `Denia` / `Valin Draco`). The honorifics never reach the prompt.
5. The watcher-voice prompt itself was left untouched — leakage was
   injected context, not the prompt. (No other bible sections — i.e. the
   GM-only watcher dossier or the Hidden Path entry — are loaded at all by
   `extractBibleContext`, so the residual risk is exactly the three
   sanitized fields above.)

## Re-run after fix

Two independent passes of the same 8-adventure sample set:

| Pass             | Runs | Leaks | Report                                      |
|------------------|------|-------|---------------------------------------------|
| `fixed`          | 8    | **0** | `samples/fixed/_report.json`                |
| `fixed-rerun`    | 8    | **0** | `samples/fixed-rerun/_report.json`          |

Total: **16 generations after the fix, 0 forbidden-term hits.**

Manual spot-check of the fixed samples confirms:
- Voice still reads as first-person watcher field notes.
- NPCs are still named (Varga, Varth, Denia, Draco, Maya) — without the
  GM-only honorifics.
- The crew's choices still get the SEE-BOTH-SIDES treatment.
- The watcher never identifies himself, his species, or his appearance.

## Reproducing

```sh
# Baseline (no sanitization, reproduces the pre-fix Inquisitor leak)
SANITIZE=0 node eval/debrief-watcher-leak/leak-eval.js baseline

# Post-fix
node eval/debrief-watcher-leak/leak-eval.js fixed
```

Requires `GEMINI_API_KEY` in the environment.
