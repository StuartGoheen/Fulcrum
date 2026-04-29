# Spacer's Atlas — Rewrite Rubric

This rubric is the editorial standard for any Atlas entry. It exists because the
campaign-bible-authored entries shipped with Task #228 leaked campaign material
into the player-facing Common tier and contained sequel-era language that
doesn't fit the campaign's 15 BBY setting. Every rewrite — priority and sweep —
follows the same rules.

## The three tiers, in plain language

| Tier | Audience | "What this is" |
|---|---|---|
| **Common** | Every player, always | What a working spacer in 15 BBY would know about this world from cantinas and trade gossip. Public reputation, public landmarks, public hyperlanes. |
| **Insider** | Players the GM has revealed this entry to | Earned local intel — named contacts, specific points of interest, who really runs the docks, current tensions, the routes only smugglers know. |
| **GM** | GM only, never rendered for players | Plot hooks, future-act foreshadowing, hidden truths, secret factions, GM staging notes. |

## Common-tier rules (the spacer's tier)

**The Common tier is the public reputation. It must contain ZERO campaign tells.** A player skimming the atlas alphabetically must not be able to identify which planets are campaign-critical from Common-tier content alone.

### Hard "no"s in Common

- ❌ No campaign-NPC names. ("Inquisitor Draco's stronghold," "Captain Skarn's garrison," "Maya knows two routes" — all out.)
- ❌ No campaign-POI names. ("The Vanishing Place," "The Ebon Spire," "The Inquisitorial fortress" — all out.)
- ❌ No tell-tale phrasing. ("The Empire pretends does not exist," "Imperial authority has not noticed," "covert Empire," "black-site by treaty silence" — all out. Anything that telegraphs *the campaign cares about this planet's hidden Imperial activity*.)
- ❌ No foreshadowing. ("When the Empire arrives, this economy ends" — out. That's GM-tier prose.)
- ❌ No references to specific player-facing crew NPCs by name. (No "Maya's old routes," "Maya's Code Cylinder lead," etc.)
- ❌ No "in-the-know-only" marker phrases. ("If you can find Ajan Kloss in the nav charts, your nav charts are stolen" is *acceptable* (cantina rumor), but "the Empire pretends it doesn't exist" is *not* (factual statement that is in-fiction publicly invisible).)

### What Common SHOULD contain

- ✅ Region, sector, climate, terrain, hyperlanes — corrected against the Wookieepedia Legends infobox.
- ✅ Government and affiliation framed for 15 BBY:
  - Worlds with publicly-known Imperial garrisons → "Galactic Empire (Imperial Sector Authority)"
  - Hutt-aligned worlds → "Hutt Space" or "Hutt Cartel-aligned"
  - Independent free ports → "Independent / unaligned (free port)"
  - Uninhabited or uncontacted worlds → "None recognized" / "Uninhabited"
- ✅ "Famous for" — what the world is *publicly* known for. Cloud City's casino, Tatooine's twin suns, Bespin's Tibanna, Klatooine's Sacred Fountain. NOT campaign POIs.
- ✅ "Cantina reputation" — flavor in the in-character voice. May rumor-mongerously hint at darkness ("nobody comes back from there") but does not confirm GM-tier truths.
- ✅ Standing currency.

## Insider-tier rules (the earned intel tier)

Insider can name local contacts, POIs, and active tensions. It is the players' "I worked this world for a year" tier.

### Hard "no"s in Insider

- ❌ No GM-only foreshadowing. Nothing of the form "this becomes important when," "in the future," "when X happens," "the Empire will eventually." All future-beat language is GM-tier.
- ❌ No statements about future plot beats. "The proxy will betray Maya in Adv8" is GM. "The proxy is Lady Fioro and she launders for Varga" is Insider.
- ❌ No GM staging notes ("run this as horror," "make the players feel," etc.) — these are GM.

### What Insider SHOULD contain

- ✅ Named local contacts with one-line characterizations and a reason a smuggler crew would care about them.
- ✅ Named points of interest, including campaign POIs (Vanishing Place, Inquisitorial fortress, Mubo's back room) — these are *fine here*; they're Insider intel the GM has chosen to reveal.
- ✅ Current local political tensions, framed in the present tense.
- ✅ Smuggler routes (named where they are publicly named in Legends, otherwise described).
- ✅ "Who runs the docks" — operationally useful intel.

## GM-tier rules (the writers' room)

GM is where every "in the future," every "the campaign hinges on," every staging note, and every hidden truth lives. The GM tier is never sent to players over the API — server gates it on the GM cookie. This task does not change that gating; it only ensures the *content* matches the contract.

### What GM SHOULD contain

- ✅ Per-adventure plot hooks ("Adv1 fires here," "Adv8 finale lands here").
- ✅ Hidden truths the players can never deduce from public knowledge.
- ✅ Secret factions whose existence is plot-relevant.
- ✅ GM staging notes (tone, pacing, set-piece notes, scene voicing).
- ✅ Future-beat foreshadowing pulled out of Insider during this rewrite.

## Era anachronism rules — campaign is set in 15 BBY

15 BBY is **four years after Order 66**. The galaxy state at this date:

| ✅ Exists in 15 BBY | ❌ Does NOT exist in 15 BBY |
|---|---|
| Galactic Empire (firmly established) | Rebel Alliance (formal — that's 2 BBY) |
| Inquisitorius (active, Force-user hunters) | Resistance (28+ ABY) |
| Imperial Senate (still formal until 0 BBY) | First Order (28+ ABY) |
| ISB / Imperial Intelligence | New Republic (5 ABY+) |
| Hutt Cartel | Mandalorian "Resistance" / Children of the Watch (post-Empire) |
| Saw Gerrera's Partisans (active) | Open rebellion banners |
| Bail Organa / Mon Mothma clandestine work | Death Star (still secret in 15 BBY; not public knowledge) |
| Isolated proto-rebel cells | Anything from Episode 7–9 named factions |
| Krennic's research projects (15 BBY pre-Eadu) | Battle of Yavin, Battle of Hoth, Battle of Endor |

### Rewriting sequel-era language

When the existing entry mentions a sequel-era faction, rewrite as follows:

| Original phrase | Rewrite to |
|---|---|
| "Resistance-friendly back room" | "A loose dissident cell — ex-Separatists, smugglers with a grudge, displaced refugees. No name, no flag yet." |
| "Resistance cell" / "Resurgence cell" | "Proto-rebel cell" (or specific: "Saw Gerrera's Partisans contact," "Organa-aligned dissidents") |
| "First Order garrison" | (Doesn't exist in 15 BBY — replace with Imperial garrison or remove) |
| "New Republic" | (Doesn't exist — replace with appropriate Imperial-era body) |
| "The Resistance" (collective) | "The dissidents" / "The cell" / "the proto-rebels" |
| Disney-canon-only NPCs not yet adults in 15 BBY | Remove or recast — verify ages against Wookieepedia |

## Image rules

Every entry whose image is updated by this audit pass gets:

- `image.src` = `/images/atlas/<slug>.<ext>` (extension matches downloaded file)
- `image.credit` = `"Wookieepedia (starwars.fandom.com)"`
- `image.license` = `"CC BY-SA 3.0"`
- `image.attributionUrl` = the Wookieepedia page URL the image was sourced from (Legends URL when Legends is the source, Canon URL when canon-only)
- `image.alt` = the planet's display name

Image files live in `public/images/atlas/`, served by the existing public-static handler. No new route, no new tier gating — Wookieepedia images are CC BY-SA 3.0 public.

## Original-fiction worlds (Malpaz, Xala)

Two campaign-original worlds have no Wookieepedia entry. For these:

- ⏭ Skip the Legends factual comparison.
- ✅ Apply the Common-tier scrub.
- ✅ Apply the era anachronism scrub.
- ✅ Push Insider foreshadowing down to GM.
- ⏭ Image stays as-is (no Wookieepedia source available).

## On audit diffs — informational, not mechanical

The `diffs` array in each `_audits/<slug>.json` surfaces every place where
our atlas voice does not literally repeat Wookieepedia's infobox value. It
is a **drift report**, not a checklist to mechanically zero out:

- Some diffs are intended editorial choices (e.g. expanding a bare
  "Industrial" climate into "Temperate, choked by industrial smog and
  reactor fallout" to set tone for the GM).
- Some diffs reflect campaign-internal reframing (e.g. Jakku's "Western
  Reaches" framing where the Wookieepedia infobox lists no formal sector).
- A diff is only a defect if it (a) introduces a sequel-era anachronism,
  (b) contradicts a Legends fact the campaign wants to honor, or
  (c) leaks campaign-tier content into the wrong tier.

When closing the audit pass, scan the diffs for those three cases — do
not blanket-rewrite to match every infobox value verbatim.

## Original-fiction worlds (image policy exception)

Two priority worlds — **Malpaz** and **Xala** — are pure campaign fiction
with no Wookieepedia article in either Legends or Canon. For these worlds:

- The audit script (`ORIGINAL_FICTION` set) skips MediaWiki fetch entirely
  and does not attempt to download a hero image.
- `image.src` stays `null`; `credit` is `"Original campaign fiction"`;
  `license`, `attributionUrl` are `null`; `alt` is the bare world name.
- Do **not** introduce non-Wookieepedia assets (AI-generated, stock, or
  hand-drawn) for these worlds during the Wookieepedia audit pass —
  artwork commissioning is a separate workstream.

This is a deliberate exception to the "every priority world has a local
hero image" convention; the convention applies only to worlds with a
canonical Wookieepedia source.

## Canon-only worlds (Legends fallback policy)

The Legends infobox is the mandatory comparison standard for every priority
or background world. Canon is permitted **only** for slugs on this allowlist
(maintained in `scripts/atlas-wookieepedia-audit.js` as `CANON_ONLY`):

| Slug                | Reason                                                                                  |
|---------------------|------------------------------------------------------------------------------------------|
| `batuu`             | No /Legends article on Wookieepedia — created for Galaxy's Edge (2019), Disney canon only. |
| `ajan-kloss`        | No /Legends article on Wookieepedia — first appears in The Rise of Skywalker (2019), Disney canon only. |
| `jakku`             | No /Legends article on Wookieepedia — created for The Force Awakens (2015), Disney canon only. |
| `takodana`          | No /Legends article on Wookieepedia — created for The Force Awakens (2015), Disney canon only. |
| `aldhani`           | No /Legends article on Wookieepedia — created for Andor (2022), Disney canon only. Added during the Task #233 sweep. |
| `vandor`            | No /Legends article on Wookieepedia — created for Solo: A Star Wars Story (2018), Disney canon only. Added during the Task #233 sweep. |
| `ponemah-terminal`  | No /Legends article on Wookieepedia — Disney canon only. Added during the Task #233 sweep. |

The audit script refuses to audit any non-allowlisted slug whose /Legends
page does not resolve: it logs a `POLICY VIOLATION` line, skips the slug,
continues the batch so every violation surfaces in one pass, and exits the
process with a non-zero status code at the end if any violations occurred.
To add a slug to the allowlist, first probe the MediaWiki API for
`<Title>/Legends` and confirm a `missingtitle` error, then add the slug +
verified justification to both `CANON_ONLY` and `CANON_ONLY_REASON` in the
script and to this table.

## Audit-script reliability notes (for Task #233)

The script under `scripts/atlas-wookieepedia-audit.js` is intentionally heuristic — it walks every top-level `{{ ... }}` block and returns the first one whose contents include planet-shaped fields (`region`, `sector`, `climate`, etc.). This is robust for the standard `{{CelestialBody}}` / `{{Astrography}}` templates Wookieepedia uses on planet pages, but two known limitations apply:

1. **False-match risk.** Pages that contain non-infobox templates with planet-marker keywords (rare but possible) could trip the heuristic. If a sweep planet's audit shows nonsense values, fall back to a Wookieepedia hand-check.
2. **Diff sensitivity.** The diff helper compares only the first whitespace-separated word of each field, case-insensitively, with `includes`. This catches gross mismatches (e.g. wrong sector name) but will miss subtle mismatches (e.g. ours says "Arid", legends says "Hot, dry"). When in doubt during the sweep, look at the full `legends` object in the audit JSON, not just the `diffs` array.
3. **Re-run the script after rewriting an entry** so the `_audits/<slug>.json` "ours" snapshot reflects the post-rewrite state. The audit artifacts are the working record of "what the entry looked like vs what Legends says when this pass landed" — they are part of Task #232 / #233's deliverable, not a one-shot scratchpad.

## Process per entry

1. Open `data/atlas/_audits/<slug>.json` to see Wookieepedia infobox values vs ours.
2. Rewrite Common tier per the rules above.
3. Re-shape Insider/GM as needed (move foreshadowing down to GM).
4. Set `image.src` and `image.attributionUrl` per the image rules.
5. Preserve `slug`, `name`, `gridSquare`, `x`, `y`, `type`, `isCampaignWorld`, and `campaignNotes` exactly — these are referenced by the Galaxy Map and the campaign system.

## Verification

- Hit `/api/atlas` as a player (no GM cookie). The response must contain zero `isCampaignWorld`, zero `campaignNotes`, zero `gm` keys per entry (these are server-gated; this task does not change the gate).
- Skim each Common tier in the player payload. None of the campaign-critical worlds should be deducible as such from Common content alone.
- Hit the Atlas tab in the player UI; each rewritten world should render its Wookieepedia image.
