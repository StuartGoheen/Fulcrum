#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ATLAS_DIR = path.join(ROOT, 'data', 'atlas');
const PLANETS_PATH = path.join(ROOT, 'data', 'galaxy-planets.json');
const MANIFEST_PATH = path.join(ATLAS_DIR, '_manifest.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

const WOOKIEEPEDIA_LICENSE = 'CC BY-SA 3.0';

function img(name, wikiSlug) {
  return {
    src: null,
    credit: 'Wookieepedia (starwars.fandom.com)',
    license: WOOKIEEPEDIA_LICENSE,
    attributionUrl: 'https://starwars.fandom.com/wiki/' + (wikiSlug || encodeURIComponent(name)),
    alt: name
  };
}

const ENTRIES = {
  // ============ EXISTING 9 (already in galaxy-planets.json) ============

  'jakku': {
    slug: 'jakku', name: 'Jakku', region: 'Inner Rim', sector: 'Arkanis', gridSquare: 'I-13',
    x: 0.405, y: 0.595, isCampaignWorld: true, type: 'planet',
    common: {
      tagline: "A sun-bleached desert nowhere on the Western Reaches — the galaxy forgot it years ago.",
      government: 'None (de facto Hutt control via Varga the Hutt)',
      affiliation: 'Galactic Empire (nominal)',
      climate: 'Arid',
      terrain: ['Deserts', 'Badlands', 'Dunes', 'Mesas', 'Salt flats'],
      hyperlanes: ["Off the major lanes; reached via scavenger trails branching off the Smuggler's Path"],
      famousFor: "Crashed Separatist hulks half-buried in the dunes; the Burning Deck cantina in Cratertown",
      cantinaReputation: "If you have to ask why anyone goes to Jakku, you don't. Hot. Empty. Cheap. Nobody looking for you here.",
      standingCurrency: 'Imperial credits, water rations, scavenged metal',
      astrography: { region: 'Inner Rim (Western Reaches)', sector: 'Arkanis', system: 'Jakku', gridSquare: 'I-13', suns: 1, moons: 0, rotationPeriod: '26 standard hours', orbitalPeriod: '340 standard days' },
      physical: { class: 'Terrestrial', atmosphere: 'Type I (breathable)', climate: 'Arid', surfaceWater: 'Minimal', gravity: 'Standard' },
      society: { nativeSpecies: ['Teedo', 'Uthuthma'], otherSpecies: ['Human', 'Weequay', 'Kyuzo'], population: 'Sparse', majorSettlements: ['Reestkii', 'Tuanul', 'Cratertown'], majorExports: ['Nothing worth taxing'] }
    },
    insider: {
      localContacts: [
        'Maya — independent smuggler, owner-operator of the Banshee. Met the crew at the Burning Deck.',
        'Switch — droid fixer running The Sinkhole bunker outside Reestkii. Will sell anyone anything if the credits are clean.',
        'Varga the Hutt — controls the local economy through debt and protection. His enforcers walk like they own the rocks.'
      ],
      pointsOfInterest: ['The Burning Deck (cantina, Cratertown)', "The Sinkhole (Switch's bunker)", 'Reestkii Landing Field', 'The Steelpecker hunting grounds (badlands south of Reestkii)'],
      politicalTensions: "Imperial patrols from Arkanis Sector come through maybe twice a standard year. The garrison at Carbon Ridge is undermanned and bored. Locals know to bury contraband in the dunes when the patrol horns sound.",
      smugglerRoutes: ["Scavenger trails branch off the Smuggler's Path; jump-window onto the Western Reaches edge of the Hydian Way is open most months"],
      whoRunsTheDocks: "Reestkii Landing Field has no harbormaster — first to land claims the pad, last to leave pays the local kid running the manual fuel pump."
    },
    gm: {
      plotHooks: [
        "Jakku Observatory (Gallius Rax / Palpatine secret facility) is active in 15 BBY. Unusual Imperial presence that has nothing to do with the players.",
        "Maya's broken Code Cylinder is the campaign's first thread — pulling on it leads to Varga, then Varth, then the Vanishing Place."
      ],
      hiddenTruths: ["The Lambda shuttle and unmarked garrison some scavengers have whispered about belong to the Observatory. The Empire will never explain its presence here.", "Varga's local enforcement is a 7-being skeleton crew — the entire Jakku operation is a rounding error in his books."],
      secretFactions: ['Imperial Observatory garrison (Rax loyalists)'],
      gmNotes: "Jakku is the campaign's quiet open. Make the table feel its emptiness. The Burning Deck should smell of dust and sour ale; Maya's wound should bleed onto the table when she pitches the job."
    },
    image: img('Jakku', 'Jakku'),
    campaignNotes: { adventures: ['adv1'], era: '15 BBY — pre-Battle of Jakku. Varga the Hutt runs what passes for an economy through debt and protection.' }
  },

  'ajan-kloss': {
    slug: 'ajan-kloss', name: 'Ajan Kloss', region: 'Outer Rim', sector: 'Cademimu', gridSquare: 'L-5',
    x: 0.548, y: 0.214, isCampaignWorld: true, type: 'moon',
    common: {
      tagline: "Uncharted jungle moon. The kind of place the Empire pretends does not exist.",
      government: 'None (Imperial black-site by treaty silence)',
      affiliation: 'Galactic Empire (covert)',
      climate: 'Tropical',
      terrain: ['Jungle', 'Bioluminescent canopy', 'Ravine networks', 'Pre-Republic temple ruins'],
      hyperlanes: ['Off-lane; reached only via classified Imperial nav data or the Cademimu back-channel jumps Maya knows'],
      famousFor: "Nothing publicly. The few spacers who've heard the name have heard it whispered.",
      cantinaReputation: "If you can find Ajan Kloss in the nav charts, your nav charts are stolen.",
      standingCurrency: 'N/A — not a settled world',
      astrography: { region: 'Outer Rim', sector: 'Cademimu', system: 'Ajan Kloss', gridSquare: 'L-5', moons: 0 },
      physical: { class: 'Terrestrial moon', atmosphere: 'Type I', climate: 'Tropical', terrain: ['Jungle', 'Ravines', 'Bioluminescent flora'] },
      society: { nativeSpecies: [], population: 'None native', majorSettlements: ['The Vanishing Place (covert)'] }
    },
    insider: {
      localContacts: [
        'Captain Skarn — runs the Vanishing Place mercenary garrison on a black contract from Imperial Intelligence. Believes himself a king of his small kingdom.',
        'Mandrake — Separatist tactical droid commander. Refused the shutdown order in 19 BBY; runs a guerrilla cell in the deep canopy.'
      ],
      pointsOfInterest: ['The Vanishing Place (repurposed pre-Republic temple, Skarn HQ)', "Mandrake's wargame hex (deep south canopy)"],
      politicalTensions: "Skarn and Mandrake know each other exists; both pretend they do not. A truce of mutual disinterest. Mandrake will help anyone who hurts Skarn; Skarn will pay anyone who solves Mandrake.",
      smugglerRoutes: ['No legitimate routes. Maya knows two — both end at the canopy line, neither involves Skarn seeing the approach.'],
      whoRunsTheDocks: "There are no docks. Skarn's dropship pad doubles as the garrison's only hard surface. Land elsewhere or get shot down."
    },
    gm: {
      plotHooks: [
        "Admiral Varth was placed at the Vanishing Place specifically because the Empire wanted him to disappear. The breakout is the campaign's inciting event.",
        "Mandrake is an Adv1-recurring NPC — players who help him here may bank a marker for Adv4+."
      ],
      hiddenTruths: ["The Vanishing Place's black-site contract is so deep in Imperial Intelligence that even Tarkin's office does not have visibility into it. Skarn's chain of command runs to a single colonel who is now dead.", "The temple itself is older than the Republic. The lower vault levels have never been catalogued."],
      secretFactions: ["Mandrake's clanker holdouts (Separatist tactical droid network)", "Imperial Intelligence shadow ops"],
      gmNotes: "Run Ajan Kloss as a horror set-piece on the approach (the canopy eats sound) and a heist on the exfil. The escape, not the breakout, is the scene."
    },
    image: img('Ajan Kloss', 'Ajan_Kloss'),
    campaignNotes: { adventures: ['adv1'], era: '15 BBY — four years since Order 66. Denia has been in stasis here the entire time.' }
  },

  'takodana': {
    slug: 'takodana', name: 'Takodana', region: 'Mid Rim', sector: 'Tashtor', gridSquare: 'J-16',
    x: 0.452, y: 0.738, isCampaignWorld: true, type: 'planet',
    common: {
      tagline: "Lush forest world. Maz Kanata's castle is the Outer Rim's most reliable neutral ground.",
      government: 'Independent (Maz Kanata enforces house rules)',
      affiliation: 'Unaligned',
      climate: 'Temperate',
      terrain: ['Forests', 'Lakes', 'Stone ridges'],
      hyperlanes: ['Sanctuary Pipeline (minor) — feeds smugglers and refugees north out of the Hutt territories'],
      famousFor: "Maz Kanata's castle on the shore of Nymeve Lake — pirates, smugglers, and travelers drink at the same bar without bleeding on each other.",
      cantinaReputation: "Old. Quiet. Maz sees you. Don't draw a blaster in her place — she has thrown the door at people for less.",
      standingCurrency: 'Imperial credits, Old Republic credits, barter, favors',
      astrography: { region: 'Mid Rim', sector: 'Tashtor', system: 'Takodana', gridSquare: 'J-16' },
      physical: { class: 'Terrestrial', atmosphere: 'Type I', climate: 'Temperate' },
      society: { nativeSpecies: ['Various'], population: 'Sparse', majorSettlements: ['Maz Kanata\'s castle (Nymeve Lake)', 'Blackwind Point'] }
    },
    insider: {
      localContacts: [
        "Maz Kanata — proprietor of the castle. Thousand-year smuggler. She knows what you want before you ask. Asking what she sees is rude; accepting what she offers is wise.",
        "Varga the Hutt — runs Blackwind Point across the lake. A lawless shantytown built out of crashed freighter spines and Hutt money. He and Maz pretend the lake is a wall.",
        "Fyren — Ugnaught dock-crew chief at Maz's lower piers. Will move things for the right people."
      ],
      pointsOfInterest: ["Maz Kanata's castle and ground floor cantina", "The lower vaults (don't ask about the lower vaults)", "Blackwind Point (Varga's shantytown, across the lake)", "The eastern landing field (Maz's only formal pad)"],
      politicalTensions: "Maz and Varga maintain a mutual non-interference posture. Both know the other could end the truce. Neither wants to. The Imperial garrison knows about Blackwind Point and pretends not to — Tashtor sector's tribute payments have always been on time.",
      smugglerRoutes: ['Sanctuary Pipeline minor branches — Takodana is a node, not a destination', 'Direct hop to Bespin on the right transponder code'],
      whoRunsTheDocks: "Maz on the castle side; Fyren in practice. Blackwind Point's docks are first-come-first-shoot."
    },
    gm: {
      plotHooks: [
        "Denia recovers at Maz's castle between Adv2 and Adv3 — Maya bonds with her here.",
        "Maz reads Force-sensitives on sight. She has never said this out loud to a player. She may, eventually, to the right one.",
        "The Adv3 Takodana rendezvous (post-Bespin payday) lands here — the Banshee returns with the Glorious Chariot in tow."
      ],
      hiddenTruths: ["Maz has Skywalker's lightsaber in her vault. It is not hidden well — it is hidden in plain sight, in a box she has not opened in decades.", "The lower vaults contain artifacts whose origin Maz herself does not remember.", "Varga the Hutt is a small Hutt. He pretends he is bigger because the pretense has worked for sixty years."],
      secretFactions: ["Maz's network of one-time-use favor-debts (galaxy-wide)", "Varga's slave-trade chain (Hutt Space ↔ Blackwind exchanges)"],
      gmNotes: "Maz is the bible's most important non-player ally. Play her quiet, patient, and aware. She does not bargain; she allows. If a player tries to lie to her face, she lets them — and she remembers."
    },
    image: img('Takodana', 'Takodana'),
    campaignNotes: { adventures: ['adv2', 'adv3'], era: '15 BBY — Maz has been on Takodana for centuries. The Empire has not bothered her yet.' }
  },

  'bespin': {
    slug: 'bespin', name: 'Bespin', region: 'Outer Rim', sector: 'Anoat', gridSquare: 'K-18',
    x: 0.5, y: 0.833, isCampaignWorld: true, type: 'planet',
    common: {
      tagline: "Gas giant. Cloud City floats in the upper atmosphere — Tibanna gas, sabacc, and the worst of the Outer Rim in the same elevator.",
      government: 'Cloud City Wing Guard (corporate municipal authority)',
      affiliation: 'Independent — pays Imperial tribute through Anoat sector',
      climate: 'Gas giant atmosphere; Cloud City zone is temperate at altitude',
      terrain: ['Gas atmosphere', 'Tibanna gas bands (extraction zone)'],
      hyperlanes: ['Ison Corridor (minor) — south extension of the Corellian Trade Spine'],
      famousFor: "Tibanna gas, Cloud City's Royal Casino sabacc tournament, mid-tier luxury, and a Wing Guard that can be bought if you know the price.",
      cantinaReputation: "If your money's good and your blaster stays holstered, Cloud City will sell you a perfect view. Bring your own clean ID.",
      standingCurrency: 'Imperial credits, sector scrip',
      astrography: { region: 'Outer Rim', sector: 'Anoat', system: 'Bespin', gridSquare: 'K-18' },
      physical: { class: 'Gas giant', atmosphere: 'Tibanna-rich; breathable in the Cloud City altitude band', climate: 'Temperate at colony altitude' },
      society: { nativeSpecies: [], otherSpecies: ['Human', 'Ugnaught', 'Sullustan'], population: 'Cloud City: ~6 million', majorSettlements: ['Cloud City'] }
    },
    insider: {
      localContacts: [
        'Mandelbrot — semi-retired card sharp, the Royal Casino tournament admin. Owes Maz Kanata a favor.',
        "Lady Fioro — appears as a guest. Acts as Varga the Hutt's proxy. Carries his payments and his insults.",
        'Arandis — tournament regular. Loses dramatically when paid to. The card-table code talker.',
        "Greel Trask — Ugnaught rigger boss, lower-city dock crews. Buyable.",
        "The Sullustan clerk — back office of the Royal Casino. Tip her well; she sees who Lady Fioro talks to."
      ],
      pointsOfInterest: ['The Royal Casino (annual sabacc tournament)', 'Docking Bay 4414 (Glorious Chariot berth)', 'Mandelbrot\'s skiff (lower-city dock)', 'The lower-city industrial pad (Z-95 cradle)'],
      politicalTensions: "Cloud City keeps its head DOWN. The colony deliberately under-reports its Tibanna yield to avoid attracting Imperial garrison expansion. The Anoat sector Moff is happy with the tribute and does not look closely. Wing Guard corruption is endemic.",
      smugglerRoutes: ['Ison Corridor → Sluis Van; back-door jump to Takodana on the right transponder', 'Direct atmospheric ascent for ships pre-cleared by the Wing Guard'],
      whoRunsTheDocks: "Wing Guard nominally. Each docking-bay master in practice. Slipping a tip to the right Ugnaught means your manifest never gets read."
    },
    gm: {
      plotHooks: [
        "Adv3 fires here. The Final Table delivers Varga's slave-circuit code wafer. Varga dies in the Glorious Chariot's hangar. The Indemnity climax is in low orbit.",
        "Lando Calrissian has NOT yet arrived in 15 BBY — Cloud City's Baron Administrator at this date is Dominic Raynor, a competent corporate bureaucrat who is one Hutt-bribe away from selling the colony.",
        "The Assiduous (Star Destroyer in low orbit) carries an EW package that jams the slave-circuit band. Plant this upstream so the Adv3-P3-S5 Skirmish lands as earned."
      ],
      hiddenTruths: ["The Royal Casino's high-stakes tournament is laundering Imperial bribes for at least three Outer Rim Moffs — Tarkin's office knows and does not care.", "Varga's 137.12 frequency wafer is the only path to Adv3's Operator-Chariot orbital lane. The Assiduous closes the lane on a tightening clock.", "Cloud City's lower-city pads are Tibanna-vapor zones — a stray turbolaser shot during exfil could detonate the whole industrial deck."],
      secretFactions: ["Imperial-aligned Wing Guard cell (Captain Tellor)", "Varga's casino proxy ring (Lady Fioro + bagmen)"],
      gmNotes: "Make Cloud City feel beautiful and corrupt at the same scene. The Tibanna-orange sunset over the cloud band is sincere. The blood on the casino carpet is also sincere. Both are true."
    },
    image: img('Bespin', 'Bespin'),
    campaignNotes: { adventures: ['adv3'], era: '15 BBY — established four-century-old colony. Lando has not arrived. Dominic Raynor is Baron Administrator.' }
  },

  'endor': {
    slug: 'endor', name: 'Endor', region: 'Outer Rim', sector: 'Moddell', gridSquare: 'H-16',
    x: 0.357, y: 0.738, isCampaignWorld: true, type: 'moon',
    common: {
      tagline: "Forest moon. Hyperspace anomalies make the Moddell sector effectively unreachable without specific route data.",
      government: 'None (Ewok tribal; uncontacted by Imperial authority in 15 BBY)',
      affiliation: 'Unaligned',
      climate: 'Temperate forest',
      terrain: ['Forest canopy', 'Dead Forest (interior)', 'Mountain ridges'],
      hyperlanes: ['None mapped; the Monsua Nebula and surrounding ion clouds disrupt navigation'],
      famousFor: "Nothing the galaxy talks about. Nobody comes here.",
      cantinaReputation: "Endor is the answer to 'where would you hide a thing nobody can ever find?'",
      standingCurrency: 'N/A',
      astrography: { region: 'Outer Rim', sector: 'Moddell', system: 'Endor', gridSquare: 'H-16' },
      physical: { class: 'Forest moon', atmosphere: 'Type I', climate: 'Temperate' },
      society: { nativeSpecies: ['Ewok'], population: 'Tribal' }
    },
    insider: {
      localContacts: ["No reliable contacts. Ewok tribes are not unified and are deeply suspicious of offworlders."],
      pointsOfInterest: ['The Dead Forest (Ebon Spire location)', 'Monsua Nebula (sector-wide nav hazard)'],
      politicalTensions: "The sector itself fights you. Hyperspace anomalies eat ships. Imperial probe droids dispatched here in the past have not returned.",
      smugglerRoutes: ["None public. Specific route data is the entire prize."],
      whoRunsTheDocks: "There are no docks."
    },
    gm: {
      plotHooks: ["Adv4 — the Ebon Spire holocrons. Revan's ancient forward base, sealed for a thousand years.", "The drift algorithms recovered from Malpaz unlock the Moddell sector's hyperspace approach."],
      hiddenTruths: ["The Empire will choose this moon for the second Death Star three years from now precisely because of these anomalies. In 15 BBY, that decision has not been made.", "The Ebon Spire's Force-locked vault is the navigation chart Varth needs for Vel Shara."],
      secretFactions: ["Revan's archive caretakers (extinct, but their wards persist)"],
      gmNotes: "Adv4 is the campaign's first Force-heavy beat. Endor should feel old and listening."
    },
    image: img('Endor', 'Forest_Moon_of_Endor'),
    campaignNotes: { adventures: ['adv4'], era: '15 BBY — uncontacted by the Empire.' }
  },

  'malpaz': {
    slug: 'malpaz', name: 'Malpaz', region: 'Outer Rim', sector: 'Wazta', gridSquare: 'I-17',
    x: 0.405, y: 0.786, isCampaignWorld: true, type: 'planet',
    common: {
      tagline: "Scarred industrial world. The Empire buried its mistakes here.",
      government: 'Imperial Sector Authority (Wazta)',
      affiliation: 'Galactic Empire',
      climate: 'Temperate, choked by industrial smog and reactor fallout',
      terrain: ['Industrial plains', 'Contaminated zones', 'Native avian rookeries'],
      hyperlanes: ['Lipsec Run (minor)'],
      famousFor: "The Krennic reactor 'accident' of 17 BBY. The Empire blamed Separatist holdouts. The locals know better.",
      cantinaReputation: "Bring your own air filter. The drinks are worse than the smog.",
      standingCurrency: 'Imperial credits',
      astrography: { region: 'Outer Rim', sector: 'Wazta', system: 'Malpaz', gridSquare: 'I-17' },
      physical: { class: 'Terrestrial', atmosphere: 'Type II (filtered breathing recommended)', climate: 'Temperate' },
      society: { nativeSpecies: ['Malpazan (avian)'], otherSpecies: ['Human'], population: 'Moderate', majorSettlements: ['Reactor Town', 'The Citadel District'] }
    },
    insider: {
      localContacts: [
        "Verla Vrass — Malpazan resistance organizer. Lost her brood to the reactor. Will help anyone who hurts the Empire.",
        "Imperial Lieutenant Daro Vex — career officer at the research station. Compromisable through old gambling debts.",
        "The Resurgence cell — proto-rebel network, currently dormant on Malpaz."
      ],
      pointsOfInterest: ['The Imperial Research Station (drift algorithm vault)', 'Reactor Town (the contaminated zone)', "Verla's safehouse (the avian rookery)"],
      politicalTensions: "Two years of contaminated ground, dead children, and Imperial gaslighting. The fuse is soaked in fuel; someone just needs to light it.",
      smugglerRoutes: ['Lipsec Run → Sluis Van; the reactor zone is an unmonitored landing field for ships willing to risk the rad count'],
      whoRunsTheDocks: 'Imperial Customs at the Citadel District. Resistance dockworkers at every other field.'
    },
    gm: {
      plotHooks: [
        "Adv5 — the heroes spark the insurrection. The fuse Tarkin lit in 17 BBY ignites here.",
        "The drift algorithm data at the research station is the second-to-last piece Varth needs for the Vel Shara approach.",
        "Adv10 — Malpaz becomes the target of the Leviathan's demonstration strike. The fires the heroes light here become the fires the heroes try to put out."
      ],
      hiddenTruths: [
        "Krennic personally signed off on the reactor configuration that failed. The classified post-incident report names him; it is buried in the Wazta sector archive.",
        "The drift algorithms in the research station vault were intended for the Death Star's hyperspace approach. Their 'transfer to Leviathan supply chain' was the cover story Varth used to access them."
      ],
      secretFactions: ['Resurgence cell (proto-rebel)', 'ISB embedded surveillance', 'Krennic-loyal research staff'],
      gmNotes: "Malpaz is the campaign's moral pivot. Adv5's insurrection is real and earned. Adv10's strike is the campaign's emotional climax. Make the players hear the children's names in the second act and lose them in the third."
    },
    image: img('Malpaz', 'Malpaz'),
    campaignNotes: { adventures: ['adv5', 'adv10'], era: '15 BBY — two years post-Krennic-meltdown. Resentment is total and patient.' }
  },

  'eriadu': {
    slug: 'eriadu', name: 'Eriadu', region: 'Outer Rim', sector: 'Seswenna', gridSquare: 'M-18',
    x: 0.595, y: 0.833, isCampaignWorld: true, type: 'planet',
    common: {
      tagline: "Tarkin's capital. Black armor-plating, red refineries, ten thousand weapons factories.",
      government: 'Imperial Sector Authority — Moff Tarkin',
      affiliation: 'Galactic Empire (heart of Tarkin doctrine)',
      climate: 'Choked industrial; sky permanently exhaust-stained',
      terrain: ['Refinery cities', 'Armor-plate megacorridors', 'The Citadel district'],
      hyperlanes: ["Hydian Way (major), Rimma Spur (minor)"],
      famousFor: "Tarkin. The Citadel. The factories. The fact that nothing happens in the Outer Rim without Eriadu's tacit nod.",
      cantinaReputation: "Drink at home. Eriadu's bars are full of Imperial Intelligence ears.",
      standingCurrency: 'Imperial credits (only)',
      astrography: { region: 'Outer Rim', sector: 'Seswenna', system: 'Eriadu', gridSquare: 'M-18' },
      physical: { class: 'Terrestrial', atmosphere: 'Type II (industrially polluted)', climate: 'Temperate' },
      society: { nativeSpecies: [], otherSpecies: ['Human (overwhelming majority)'], population: 'Billions', majorSettlements: ['The Citadel district', 'Phelar Port'] }
    },
    insider: {
      localContacts: [
        "Captain Solyne Quass — Tarkin's adjutant. Ambitious, careful, transactional.",
        "Phelar Port harbormaster Bex Tarrin — known to look the other way for the right cargo manifest.",
        "The Ebon Aviary — high-end sabacc club where Imperial officers settle their off-books debts."
      ],
      pointsOfInterest: ['The Citadel (Tarkin\'s headquarters)', 'Phelar Port', 'The Ebon Aviary (sabacc club)', 'Old Town (pre-Imperial market district)'],
      politicalTensions: "Tarkin is Moff. He is reaching for Grand Moff. Every officer below him is angling for a piece of his ascent. Loyalty is performed; ambition is sincere.",
      smugglerRoutes: ['Phelar Port back-channels — the only way clean cargo moves on Eriadu', 'Hydian Way south to the Anoat sector'],
      whoRunsTheDocks: "Imperial Customs at every legal pad. Bex Tarrin in practice at Phelar Port — the harbormaster everyone bribes."
    },
    gm: {
      plotHooks: [
        "Adv6-7 — the heroes operate in Tarkin's capital. The endgame setup for Varth's betrayal lands here.",
        "Tarkin's Grand Moff promotion (14 BBY) is one or two demonstrations of competence away. The Leviathan navigation data Varth delivers may be the final demonstration.",
        "Denia is captured by Inquisitor Draco during this arc — or she has been for months, depending on Adv2 outcome."
      ],
      hiddenTruths: [
        "Tarkin's office is already aware of the Vel Shara superweapon program. He is competing for command of it; he does not yet have it.",
        "The Antar Atrocity (16 BBY) was Tarkin's solution to a political problem. Anyone who lived through Antar 4 and ended up on Eriadu is here under Imperial duress.",
        "Wullf Yularen's ISB has agents inside the Phelar Port black market. Every smuggler the heroes work with on Eriadu is being watched."
      ],
      secretFactions: ['Tarkin loyalists (career officers angling for promotion)', 'ISB Bureau of Operations (Yularen)', 'Inquisitorius detachment (Draco)'],
      gmNotes: "Eriadu is Tarkin made physical. Cold, efficient, monumental. The players should feel the weight of what he has already done before they meet him."
    },
    image: img('Eriadu', 'Eriadu'),
    campaignNotes: { adventures: ['adv6', 'adv7'], era: '15 BBY — Tarkin is Moff, one rung from Grand Moff. The Leviathan data is his ticket up.' }
  },

  'batuu': {
    slug: 'batuu', name: 'Batuu', region: 'Outer Rim', sector: 'Trilon', gridSquare: 'G-15',
    x: 0.31, y: 0.69, isCampaignWorld: true, type: 'planet',
    common: {
      tagline: "Trading outpost on the edge of Wild Space. Three suns, petrified spire forests, and Black Spire Outpost.",
      government: 'None (Black Spire Outpost is Oga Garra\'s town)',
      affiliation: 'Unaligned — Imperial authority has not noticed',
      climate: 'Temperate to arid; spire-forest microclimates',
      terrain: ['Petrified spire forests', 'Plains', 'Salt-pan basins'],
      hyperlanes: ['Off the major lanes; the Triellus Trade Route brushes by'],
      famousFor: "Black Spire Outpost. Oga Garra. The cantinas. The kind of trading post where 'where did you come from' is considered an accusation.",
      cantinaReputation: "Oga's Cantina serves anyone with credits. Behaving in Oga's Cantina is wise. Drawing in Oga's Cantina is suicide.",
      standingCurrency: 'Imperial credits, Old Republic credits, hard goods',
      astrography: { region: 'Outer Rim', sector: 'Trilon', system: 'Batuu', gridSquare: 'G-15', suns: 3 },
      physical: { class: 'Terrestrial', atmosphere: 'Type I', climate: 'Temperate-arid' },
      society: { nativeSpecies: [], otherSpecies: ['Human', 'Ithorian', 'Twi\'lek', 'Trandoshan', 'many'], population: 'Sparse outside BSO', majorSettlements: ['Black Spire Outpost'] }
    },
    insider: {
      localContacts: [
        "Oga Garra — Blutopian crime boss, runs Black Spire Outpost. Pragmatic, terrifying, fair on her own terms.",
        "Hondo Ohnaka — present in 15 BBY, running a salvage-and-grift operation out of the spire forests.",
        "Soren Vex — Maya's old smuggling partner. The man who sold her out. Currently working out of BSO."
      ],
      pointsOfInterest: ["Oga's Cantina", "Dok-Ondar's Den of Antiquities", 'The salvage yards (north spire field)', 'The Resistance-friendly back room of the Mubo droid shop (proto-rebel cell)'],
      politicalTensions: "Three crime factions, one Blutopian arbiter. The Empire has not arrived. When it does, this entire economy ends.",
      smugglerRoutes: ['The petrified spire forests hide entire convoys', 'Wild Space jump windows reachable from BSO that nobody else has charted'],
      whoRunsTheDocks: "Oga. The dock-master fee structure is published; deviating from it is fatal."
    },
    gm: {
      plotHooks: [
        "Adv8 — the heroes recruit a pirate fleet here. Soren Vex re-enters Maya's life.",
        "Hondo will work with the heroes if they amuse him; he will betray them if they bore him.",
        "The proto-rebel cell at Mubo's back room can be flipped to the players' side if they earn it — useful for the finale."
      ],
      hiddenTruths: [
        "Oga Garra has been quietly stockpiling Mandalorian-pattern arms for two years. She has not said why; she does not have to.",
        "Soren Vex has spent the last three years trying to find Maya to apologize. He will not get to."
      ],
      secretFactions: ["Oga Garra's network (galaxy-wide)", "Hondo's rotating crew", "Resurgence cell sympathizers (Mubo's back room)"],
      gmNotes: "Batuu is the campaign's last beat of joy before the betrayal. Make BSO loud, full, and dangerous. Soren's reunion with Maya is the emotional anchor of Adv8."
    },
    image: img('Batuu', 'Batuu'),
    campaignNotes: { adventures: ['adv8'], era: '15 BBY — Imperial authority has not yet noticed Batuu.' }
  },

  'xala': {
    slug: 'xala', name: 'Xala', region: 'Wild Space', sector: 'Unknown', gridSquare: 'H-14',
    x: 0.357, y: 0.643, isCampaignWorld: true, type: 'planet',
    common: {
      tagline: "The edge of known space. Reached only via the Xala-Cermau hyperlane.",
      government: 'None public — Inquisitor Draco runs a covert stronghold',
      affiliation: 'Galactic Empire (Inquisitorius black-site)',
      climate: 'Cold; thin atmosphere; perpetual twilight band',
      terrain: ['Glacial plateaus', 'Ravines', 'Inquisitorial fortress complex'],
      hyperlanes: ['Xala-Cermau Hyperlane (minor; one of the rare navigable Wild Space routes)'],
      famousFor: "Nothing publicly. The few who have gone do not return.",
      cantinaReputation: "If a navigator quotes you a route to Xala, walk away.",
      standingCurrency: 'N/A',
      astrography: { region: 'Wild Space', sector: 'Unknown', system: 'Xala', gridSquare: 'H-14' },
      physical: { class: 'Terrestrial', atmosphere: 'Thin (rebreather required for extended exposure)', climate: 'Cold' },
      society: { nativeSpecies: [], population: 'Inquisitorial garrison only' }
    },
    insider: {
      localContacts: [
        "Inquisitor Valin Draco — runs the fortress. Force-user. Hunts Denia institutionally, not personally.",
        "Senior Inquisitor's adjutant Renn Kalek — career Imperial Intelligence; the bureaucratic spine of the operation."
      ],
      pointsOfInterest: ['The Xala fortress (Inquisitorial detention + interrogation block)', 'The hyperlane terminus (only approach)'],
      politicalTensions: "Draco answers only to the Grand Inquisitor. No Moffs, no oversight, no witnesses. That is the entire point of choosing Xala.",
      smugglerRoutes: ["None viable. The Xala-Cermau hyperlane is the only path; the fortress controls every navigation buoy."],
      whoRunsTheDocks: "The garrison. There is no civilian dock."
    },
    gm: {
      plotHooks: [
        "Adv9 — the heroes infiltrate the fortress. If Denia was rescued in Adv2, she is the holocron key. If she was abandoned, Draco has had her here for the entire campaign.",
        "The Xala-Cermau hyperlane data is the second navigation prize Varth needs."
      ],
      hiddenTruths: [
        "Draco is not the Grand Inquisitor. He is junior and ambitious. His pursuit of Denia is what he has been told earns promotion.",
        "The fortress's lower interrogation block holds at least three other surviving Jedi besides Denia. The Empire has been collecting them quietly."
      ],
      secretFactions: ['Inquisitorius command (Grand Inquisitor)', 'Imperial Intelligence overwatch'],
      gmNotes: "Xala is the campaign's Inquisitorial set-piece. Cold, sterile, deliberate. Draco should feel like a man performing the role of a sith — because he is."
    },
    image: img('Xala', 'Xala_(planet)'),
    campaignNotes: { adventures: ['adv9'], era: '15 BBY — Inquisitorius has been on Xala for three years and counting.' }
  },

  // ============ NEW 5 (Hutt Space slave-trade hubs + Core) ============

  'tatooine': {
    slug: 'tatooine', name: 'Tatooine', region: 'Outer Rim', sector: 'Arkanis', gridSquare: 'J-13',
    x: 0.43, y: 0.62, isCampaignWorld: false, type: 'planet',
    common: {
      tagline: "Twin-sun desert world. Hutt rule, moisture farms, and the worst spaceport in the galaxy.",
      government: 'Hutt cartel (Jabba) with Imperial nominal oversight',
      affiliation: 'Hutt Space-aligned (Imperial nominal)',
      climate: 'Hyper-arid',
      terrain: ['Desert', 'Salt flats', 'Jundland Wastes', 'Dune Sea'],
      hyperlanes: ['Triellus Trade Route (Hutt artery)', 'Salin Corridor (minor)'],
      famousFor: "Mos Eisley spaceport, Jabba the Hutt's palace, twin sunsets, podracing at Mos Espa.",
      cantinaReputation: "Mos Eisley's cantinas serve everyone. Watch the corners. The bartender saw what happened. He will not say.",
      standingCurrency: 'Imperial credits, wupiupi (Hutt currency), water credits',
      astrography: { region: 'Outer Rim', sector: 'Arkanis', system: 'Tatoo', gridSquare: 'J-13', suns: 2, moons: 3 },
      physical: { class: 'Terrestrial', atmosphere: 'Type I', climate: 'Hyper-arid', surfaceWater: 'None' },
      society: { nativeSpecies: ['Jawa', 'Tusken Raider'], otherSpecies: ['Human', 'Rodian', 'Twi\'lek'], population: 'Sparse', majorSettlements: ['Mos Eisley', 'Mos Espa', 'Anchorhead', 'Bestine'] }
    },
    insider: {
      localContacts: [
        "Jabba Desilijic Tiure — Hutt clan head; runs Tatooine de facto.",
        "Wuher — Mos Eisley cantina barkeep. Sees everything. Says nothing.",
        "Ranzar Malk — pre-Mandalorian-era fence working out of Mos Espa."
      ],
      pointsOfInterest: ['Mos Eisley spaceport', 'Mos Espa (podracing arena)', "Jabba's palace (Northern Dune Sea)", 'Anchorhead', 'Tosche Station'],
      politicalTensions: "Jabba runs Tatooine. The Empire pretends to. Tusken raids on outlying farms are a fact of life. Jawas trade in everyone else's salvage.",
      smugglerRoutes: ['Triellus Trade Route is the spice highway between Kessel and Nal Hutta', 'Salin Corridor connects to the southern Outer Rim'],
      whoRunsTheDocks: "Mos Eisley dock-master is technically Imperial — practically Jabba's. Pay the docking fee twice."
    },
    gm: {
      plotHooks: [
        "Tatooine is the spice corridor's western anchor — the slave shipments routed through Indemnity-class haulers (Adv3) pass within a parsec.",
        "Jabba and Varga are technically rivals. Varga's slave trade exists at Jabba's sufferance."
      ],
      hiddenTruths: [
        "Jabba's palace contains a Force-sensitive prisoner whose origin Jabba does not understand. Decades-old Imperial contract.",
        "The Empire has standing orders to ignore Hutt activity on Tatooine — too expensive to police, too far from anywhere that matters."
      ],
      secretFactions: ['Jabba\'s clan', 'Tusken war-band confederacies'],
      gmNotes: "If the heroes detour to Tatooine in pursuit of Varga's supply chain, treat it as a Hutt-territory consequence chain. Jabba does not love Varga; he tolerates him."
    },
    image: img('Tatooine', 'Tatooine'),
    campaignNotes: { adventures: [], era: '15 BBY — Jabba runs everything that matters. Anakin Skywalker has been freed for years and his name is half-forgotten here.' }
  },

  'klatooine': {
    slug: 'klatooine', name: 'Klatooine', region: 'Outer Rim', sector: "Si'Klaata", gridSquare: 'M-15',
    x: 0.65, y: 0.55, isCampaignWorld: false, type: 'planet',
    common: {
      tagline: "Klatooinian homeworld. Bound by ancient treaty to serve the Hutts.",
      government: 'Hutt overlordship via Klatooinian client-state council',
      affiliation: 'Hutt Space',
      climate: 'Arid to temperate',
      terrain: ['Plains', 'Stone valleys', 'Sacred Fountain (centerpiece)'],
      hyperlanes: ['Triellus Trade Route', "Pabol Sleheyron (Hutt internal)"],
      famousFor: "The Treaty of Vontor (binding Klatooinians to the Hutts). The Sacred Fountain. The slave markets that exist in violation of the treaty's spirit and within its letter.",
      cantinaReputation: "Drink at the Klatooinian quarter. The Hutt-run quarters are watched.",
      standingCurrency: 'Wupiupi, Imperial credits',
      astrography: { region: 'Outer Rim', sector: "Si'Klaata", system: 'Klatooine', gridSquare: 'M-15' },
      physical: { class: 'Terrestrial', atmosphere: 'Type I', climate: 'Arid' },
      society: { nativeSpecies: ['Klatooinian'], otherSpecies: ['Hutt', 'Nikto', 'Vodran'], population: 'Moderate', majorSettlements: ['Tolea Biqua (Hutt enclave)', 'Klatoo (Klatooinian capital)'] }
    },
    insider: {
      localContacts: [
        "Bargon Tula — Klatooinian dock-master at Tolea Biqua. Hates the Hutts; cannot show it.",
        "Drevoss the Hutt — local boss, mid-tier. Runs slave-shipment intake at Tolea Biqua.",
        "The Sacred Fountain custodian council — refuses to deal with Hutts on principle. May help offworlders who respect the treaty."
      ],
      pointsOfInterest: ['Tolea Biqua spaceport (Hutt-controlled)', 'The Sacred Fountain', 'The Klatoo highlands (treaty council seat)', 'The slave-intake pens (north of Tolea Biqua)'],
      politicalTensions: "Klatooinian resentment of Hutt rule has burned for generations. The Sacred Fountain is the symbol; the treaty is the chain. Imperial presence is light — Hutts pay the tribute, the Empire stays out.",
      smugglerRoutes: ['Triellus → Sriluur → Klatooine is the standard slave-shipment routing', 'Pabol Sleheyron is Hutt-internal and harder for offworlders to access'],
      whoRunsTheDocks: "Hutt-aligned dock authority at Tolea Biqua. Klatooinian dock workers everywhere else."
    },
    gm: {
      plotHooks: [
        "Klatooine is one of the Indemnity's last seven port calls (Adv3 P1 reveal). The 384 slaves aboard the Indemnity boarded here, four standard days before the Bespin climax.",
        "A Klatooinian liberation cell is forming in the Klatoo highlands — they will not act in 15 BBY, but a connection here can pay off in Act 3.",
        "Bargon Tula will help the heroes liberate slaves from the Tolea Biqua pens if they convince him the operation will not get the Klatooinian quarter burned down in retaliation."
      ],
      hiddenTruths: [
        "The Treaty of Vontor's modern enforcement is a Hutt confidence trick — the original Klatooinian binding-oath has been ritually invalidated by the Sacred Fountain custodians for two generations. The Klatooinians as a people are technically free; they have not realized this collectively.",
        "The Empire knows the Hutts are technically violating slave-trade prohibitions on Klatooine. The Empire does not care."
      ],
      secretFactions: ['Klatooinian liberation cell (highlands)', 'Hutt slave-trade syndicate'],
      gmNotes: "If the campaign ever pulls on the slave-trade thread Maya started in Adv3, Klatooine is where it leads. Treat it as the campaign's quiet moral debt."
    },
    image: img('Klatooine', 'Klatooine'),
    campaignNotes: { adventures: ['adv3'], era: '15 BBY — Hutt slave-trade is operating openly under Imperial indifference.' }
  },

  'kessel': {
    slug: 'kessel', name: 'Kessel', region: 'Outer Rim', sector: 'Kessel', gridSquare: 'L-16',
    x: 0.62, y: 0.62, isCampaignWorld: false, type: 'planet',
    common: {
      tagline: "Spice-mining hellworld. The ultimate Imperial penal posting.",
      government: 'Empire-licensed Pyke Syndicate operations; nominal Imperial oversight',
      affiliation: 'Galactic Empire (penal labor)',
      climate: 'Thin-atmosphere; sealed-environment surface',
      terrain: ['Spice mines (extensive subsurface)', 'Sealed surface installations'],
      hyperlanes: ["The Kessel Run (notorious smugglers' shortcut through the Akkadese Maelstrom)", 'Sisar Run (Hutt-internal)'],
      famousFor: "Glitterstim spice. The mines. The fact that a sentence to Kessel is functionally a death sentence.",
      cantinaReputation: "Nobody drinks at Kessel. Nobody is at Kessel by choice.",
      standingCurrency: 'Imperial scrip (mining)',
      astrography: { region: 'Outer Rim', sector: 'Kessel', system: 'Kessel', gridSquare: 'L-16' },
      physical: { class: 'Terrestrial', atmosphere: 'Trace (artificial sealed environments)', climate: 'Cold' },
      society: { nativeSpecies: ['Kessurian (extinct?)'], otherSpecies: ['Wookiee (slave labor)', 'Human (slave labor)', 'Pyke administrators'], population: 'Slave labor + administrative cadre', majorSettlements: ['Kessendra (administrative)', 'Mine 13 (largest active)'] }
    },
    insider: {
      localContacts: [
        "Quay Tolsite — Pyke administrator, Mine 13. Bribable.",
        "Drelka — Wookiee senior slave; remembers Kashyyyk. The unofficial leader of the Kashyyyk-deportee slave block.",
        "Lieutenant Vorne — Imperial liaison officer, Kessendra. Reportedly addicted to glitterstim he is supposed to be regulating."
      ],
      pointsOfInterest: ['Mine 13 (active)', 'Kessendra administrative complex', 'The Akkadese Maelstrom (the Run)', 'The slave processing block (Kessendra surface)'],
      politicalTensions: "Pyke Syndicate runs the mines; the Empire rents the planet to them. Slaves outnumber administrators 200:1; the only thing keeping the system from collapsing is air.",
      smugglerRoutes: ['The Kessel Run — fastest known shortcut, lethally dangerous', 'Sisar Run for Hutt-internal traffic'],
      whoRunsTheDocks: "Pyke administrators at the surface; nobody goes below the surface and comes back fast."
    },
    gm: {
      plotHooks: [
        "Kessel is one of the Indemnity's last seven port calls (Adv3 P1 reveal). The Empire moves Wookiee slaves between Kashyyyk and Kessel via Indemnity-class haulers.",
        "If the heroes ever liberate a slave block on Kessel, they have started a Wookiee-led insurgency the Empire will not be able to contain.",
        "The Akkadese Maelstrom is the only piloting set-piece in the campaign that rivals the Adv3 Skirmish for scale."
      ],
      hiddenTruths: [
        "The slaves on Kessel are not just labor — they are a strategic resource. Glitterstim demand inside the Imperial officer corps has tripled in the past two years.",
        "Quay Tolsite is keeping a black ledger of every officer whose spice habit he subsidizes. He believes it is leverage. He is partially correct."
      ],
      secretFactions: ['Pyke Syndicate', 'Kashyyyk-deportee slave underground'],
      gmNotes: "Kessel is the campaign's worst place. Run it cold and starless. The Run itself can be a Reflex-Pilot Resist 5 set-piece if a player wants the legend."
    },
    image: img('Kessel', 'Kessel'),
    campaignNotes: { adventures: ['adv3'], era: '15 BBY — Pyke Syndicate operations at peak under Imperial license.' }
  },

  'sriluur': {
    slug: 'sriluur', name: 'Sriluur', region: 'Outer Rim', sector: "Si'Klaata", gridSquare: 'M-15',
    x: 0.66, y: 0.54, isCampaignWorld: false, type: 'planet',
    common: {
      tagline: "Weequay homeworld. The Gozanti exchange is the largest legal slave market in Hutt Space — by slim definition of legal.",
      government: 'Hutt overlordship via Weequay clan councils',
      affiliation: 'Hutt Space',
      climate: 'Arid; double-sun exposure',
      terrain: ['Desert', 'Mesa cities', 'Coastal salt-trade towns'],
      hyperlanes: ['Triellus Trade Route', 'Sisar Run'],
      famousFor: "The Gozanti exchange. The Weequay swordsmiths. The fact that nothing illegal in Hutt Space is illegal on Sriluur.",
      cantinaReputation: "Don't comment on the merchandise.",
      standingCurrency: 'Wupiupi, Imperial credits',
      astrography: { region: 'Outer Rim', sector: "Si'Klaata", system: 'Sriluur', gridSquare: 'M-15' },
      physical: { class: 'Terrestrial', atmosphere: 'Type I', climate: 'Arid' },
      society: { nativeSpecies: ['Weequay'], otherSpecies: ['Hutt', 'Nikto', 'Klatooinian'], population: 'Moderate', majorSettlements: ['Al\'Nasrl (capital)', 'The Gozanti exchange (orbital + ground)'] }
    },
    insider: {
      localContacts: [
        "Vrok the Weequay — exchange floor-master at Gozanti. Old, fair-by-his-standards, and dangerous.",
        "The Three Sisters — Weequay clan-council representatives who have collectively decided the Hutts have outstayed their welcome.",
        "Drevoss the Hutt's regional lieutenant (overlap with Klatooine intel)."
      ],
      pointsOfInterest: ["Al'Nasrl (capital)", 'The Gozanti exchange (orbital staging)', 'The salt-trade coast', "The Weequay swordsmiths' guild hall"],
      politicalTensions: "Three Weequay councils, one Hutt overlord, no Imperial presence. The councils are quietly aligning against the Hutts. The exchange is the symbol they will eventually burn.",
      smugglerRoutes: ['Sisar Run is Hutt-internal but accessible with the right contacts', 'Triellus → Klatooine → Sriluur is the standard slave-trade triangle'],
      whoRunsTheDocks: "Hutt-controlled at the Gozanti exchange. Weequay clan-controlled everywhere else."
    },
    gm: {
      plotHooks: [
        "Sriluur is one of the Indemnity's last seven port calls (Adv3 P1 reveal). The Gozanti exchange is where the Indemnity's intake manifest was filed.",
        "If the heroes ever expose the Gozanti exchange's role in the slave trade publicly (Holonet leak, Resurgence broadcast), the Three Sisters will move openly against the Hutts.",
        "Vrok will sell information to the heroes if they amuse him. He cannot help with anything that costs him exchange revenue."
      ],
      hiddenTruths: [
        "The Empire is aware of the Gozanti exchange. ISB has at least two embedded agents on the floor. The Empire does not act because the slave economy serves Imperial labor needs (Kessel, Geonosis).",
        "The Three Sisters' insurrection plan has a five-year horizon. Anything the heroes do to accelerate it changes the Hutt Space political map."
      ],
      secretFactions: ['Weequay clan-council insurgency (forming)', 'ISB Hutt-Space surveillance', 'Hutt slave-trade syndicate'],
      gmNotes: "Sriluur is the second leg of the Adv3 slave-trade investigation if Maya pulls on the thread post-Bespin. Treat it as a Hutt-Space heist setting, not a battlefield."
    },
    image: img('Sriluur', 'Sriluur'),
    campaignNotes: { adventures: ['adv3'], era: '15 BBY — Gozanti exchange operating openly under Hutt protection.' }
  },

  'coruscant': {
    slug: 'coruscant', name: 'Coruscant', region: 'Core Worlds', sector: 'Corusca', gridSquare: 'L-9',
    x: 0.5, y: 0.5, isCampaignWorld: false, type: 'planet',
    common: {
      tagline: "The galactic capital. Ecumenopolis. The seat of the Empire.",
      government: 'Imperial Senate (decorative); Imperial Throne (actual)',
      affiliation: 'Galactic Empire (capital)',
      climate: 'Fully artificial; no natural surface remains',
      terrain: ['Planetwide city', 'Underlevels (1313 down)', 'Skydomes', 'The Senate district'],
      hyperlanes: ['Hydian Way', 'Perlemian Trade Route', 'Corellian Run', 'Corellian Trade Spine'],
      famousFor: "Everything. The Imperial Palace, the Senate, the Jedi Temple ruins, the underlevels.",
      cantinaReputation: "The cantinas at Level 1313 will sell anything. The cantinas in the upper levels will report anything. Choose wisely.",
      standingCurrency: 'Imperial credits (universal)',
      astrography: { region: 'Core Worlds', sector: 'Corusca', system: 'Coruscant', gridSquare: 'L-9' },
      physical: { class: 'Terrestrial (planetwide city)', atmosphere: 'Type I (climate-controlled)', climate: 'Artificial' },
      society: { nativeSpecies: [], otherSpecies: ['Every species in the galaxy'], population: 'One trillion+', majorSettlements: ['Galactic City (planetwide)'] }
    },
    insider: {
      localContacts: [
        "Luthen Rael — Coruscanti antiquities dealer. Quiet, calculating, building something the players are not yet equipped to see.",
        "ISB Colonel Wullf Yularen — heads the Bureau of Operations. Untouchable.",
        "Senator Mon Mothma — distant, cautious, principled. Will not meet anyone she has not vetted for months."
      ],
      pointsOfInterest: ['The Imperial Palace (former Jedi Temple)', "Luthen's antiquities shop (mid-levels)", "The Senate district", 'Level 1313 (underlevels black market)'],
      politicalTensions: "The Senate is theatre. The ISB is everywhere. Luthen Rael's network is forming in the shadow of both. Coruscant in 15 BBY is the quietest beat before the loudest one.",
      smugglerRoutes: ['Hydian Way is the artery; Perlemian, Corellian Run, Trade Spine are tributaries. Every smuggler route in the galaxy connects to Coruscant within three jumps.'],
      whoRunsTheDocks: "Imperial Customs at every legal pad. Underlevel pads pay tribute to whichever syndicate runs that level."
    },
    gm: {
      plotHooks: [
        "If the heroes ever need to launder credits, source forged ID, or buy serious black-market intel, Coruscant is where it happens.",
        "Luthen Rael will not recruit the heroes. He may, however, tip them — anonymously, untraceably — if their work serves his slow project.",
        "The Jakku Observatory's funding paper trail terminates at a Coruscanti shell company. Following it is a campaign-ending detour the heroes should not take."
      ],
      hiddenTruths: [
        "The Fulcrum codename is starting to circulate in 15 BBY — Ahsoka Tano's invention, distributed through Luthen's nascent network. The campaign is named after this codename. The heroes may never learn why.",
        "The Empire's Vel Shara superweapon program has its bureaucratic spine on Coruscant. Varth's old desk is in a sealed office in the Imperial Palace's logistics annex.",
        "The Jedi Temple's lower vaults are sealed but not destroyed. The Empire's archive of confiscated Force-artifacts grows monthly."
      ],
      secretFactions: ["Luthen Rael's Axis network (forming)", 'ISB Bureau of Operations', 'Inquisitorius command staff', 'Vel Shara program logistics'],
      gmNotes: "Coruscant should feel SAFE and WRONG at the same time. Streets are clean. Sky is bright. Every conversation is being recorded by something. If the heroes detour here, treat it as a tonal scene, not a combat scene."
    },
    image: img('Coruscant', 'Coruscant'),
    campaignNotes: { adventures: [], era: '15 BBY — the Empire is four years old. Coruscant has adjusted.' }
  }
};

function main() {
  // Add the 5 new entries to galaxy-planets.json so the map carries them too
  const planets = readJson(PLANETS_PATH);
  const existingNames = new Set(planets.map(p => p.name));
  const newPlanets = ['tatooine', 'klatooine', 'kessel', 'sriluur', 'coruscant'];
  let planetsChanged = false;
  for (const slug of newPlanets) {
    const e = ENTRIES[slug];
    if (!e || existingNames.has(e.name)) continue;
    planets.push({
      name: e.name,
      x: e.x,
      y: e.y,
      region: e.region,
      sector: e.sector,
      gridSquare: e.gridSquare,
      desc: e.common.tagline,
      campaign: false,
      slug: e.slug
    });
    planetsChanged = true;
  }
  if (planetsChanged) {
    writeJson(PLANETS_PATH, planets);
    console.log('[author-atlas] Added new planets to galaxy-planets.json: ' + newPlanets.join(', '));
  }

  // Write all 14 hand-authored atlas entries (overwrites)
  let written = 0;
  for (const slug of Object.keys(ENTRIES)) {
    writeJson(path.join(ATLAS_DIR, slug + '.json'), ENTRIES[slug]);
    written++;
  }
  console.log(`[author-atlas] wrote ${written} hand-authored atlas entries`);

  // Refresh manifest with the new entries appended in campaign-first order
  const ordered = planets
    .slice()
    .sort((a, b) => {
      const ac = a.campaign ? 0 : 1;
      const bc = b.campaign ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return String(a.name).localeCompare(String(b.name));
    })
    .map(p => p.slug);
  writeJson(MANIFEST_PATH, { slugs: ordered });
  console.log(`[author-atlas] manifest entries: ${ordered.length}`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e); process.exit(1); }
}
