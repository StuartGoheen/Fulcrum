#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'atlas');

const AUTHORED = {
  'ajan-kloss': {
    tagline: "Uncharted jungle moon. The kind of place you don't end up at by accident.",
    government: "None on record (covertly held by Imperial black-site treaty)",
    affiliation: "Galactic Empire (covert) / Captain Skarn's mercenaries (in practice)",
    climate: "Tropical",
    terrain: ["Jungle", "Bioluminescent canopy", "Ravine networks", "Pre-Republic temple ruins"],
    hyperlanes: ["Off-lane; only Cademimu back-channel jumps reach it"],
    famousFor: "Nothing publicly. Whispers among smugglers about a hidden temple and an Imperial ghost-prison.",
    cantinaReputation: "If you can find Ajan Kloss in the nav charts, you don't need to ask the bartender about it.",
    standingCurrency: "Barter; nothing official"
  },
  'batuu': {
    tagline: "Frontier waystation on the edge of the Unknown Regions.",
    government: "None — independent settlements run by traders and pirate captains",
    affiliation: "Unaligned (Imperial patrols rare)",
    climate: "Temperate",
    terrain: ["Petrified tree spires", "Spice grasslands", "Black Spire badlands"],
    hyperlanes: ["End of the Triellus Trade Route", "Old Smuggler's Run jump"],
    famousFor: "Black Spire Outpost — last refueling stop before the Unknown Regions.",
    cantinaReputation: "Oga's Cantina is neutral ground. Don't draw a blaster unless you want Oga personally walking you to the door.",
    standingCurrency: "Republic credits, spira (local), and trade goods"
  },
  'bespin': {
    tagline: "Gas giant whose only cities float in the cloud belt.",
    government: "Bespin Mining Guild administration; effective rule by the Baron Administrator",
    affiliation: "Independent (Imperial contracts pending)",
    climate: "Gas giant — survivable layer in the temperate belt only",
    terrain: ["Gas atmosphere", "Floating cities", "Tibanna gas mines"],
    hyperlanes: ["Lutrillian Cross spur", "Corellian Trade Spine connector"],
    famousFor: "Tibanna gas — the cleanest blaster fuel in the galaxy. Cloud City. Refinery 13.",
    cantinaReputation: "Cloud City casinos run clean — Imperial-clean. The Refinery 13 spacer bars run dirty and proud.",
    standingCurrency: "Republic credits; Mining Guild scrip on the lower platforms"
  },
  'endor': {
    tagline: "Forested sanctuary moon orbiting a remote gas giant.",
    government: "None — tribal Ewok villages",
    affiliation: "Unaligned (uncharted by Imperial Survey Corps)",
    climate: "Temperate",
    terrain: ["Old-growth forest", "Cliffside meadows", "Hidden canyons"],
    hyperlanes: ["None — reached only via the Endor system survey beacons"],
    famousFor: "Pristine forests, native Ewok tribes, and the kind of quiet that hides a great deal of trouble.",
    cantinaReputation: "No cantina exists planetside. Spacer rumor says a hidden grove keeps a still and a welcome for those who can find it.",
    standingCurrency: "Barter; metal trinkets"
  },
  'eriadu': {
    tagline: "Industrial throneworld of the Outer Rim and Tarkin family seat.",
    government: "Eriaduan Senate (in practice: a Tarkin-allied junta)",
    affiliation: "Galactic Empire — flagship loyalist world",
    climate: "Polluted temperate",
    terrain: ["Smog-choked cities", "Strip-mined hills", "Industrial sprawl"],
    hyperlanes: ["Hydian Way (key node)", "Rimma Trade Route junction"],
    famousFor: "The Tarkin family. Sector capital of the Seswenna. Heavily fortified shipyards.",
    cantinaReputation: "Officer-class lounges only. If you don't have an Imperial pass, drink at the docks.",
    standingCurrency: "Imperial credits"
  },
  'jakku': {
    tagline: "Sun-bleached desert world covered in starship graveyards.",
    government: "None — scavenger settlements and Imperial garrison remnants",
    affiliation: "Galactic Empire (light garrison)",
    climate: "Arid desert",
    terrain: ["Dune seas", "Crashed warship hulks", "Sinking fields", "Salt flats"],
    hyperlanes: ["Spur off the Triellus Trade Route"],
    famousFor: "Cratertown — built in the shadow of a downed Separatist cruiser. Junk markets that recycle entire battle fleets.",
    cantinaReputation: "The Burning Deck cantina pours strong and asks no questions. Tip the bartender or tip the bouncer — your choice.",
    standingCurrency: "Portions, scrap, and Imperial credits"
  },
  'malpaz': {
    tagline: "Hutt-administered desert moon. A waypoint for cargo nobody asks about.",
    government: "Hutt clan administration (Varga the Hutt, regional)",
    affiliation: "Hutt Space (de facto)",
    climate: "Hot arid",
    terrain: ["Salt-pan deserts", "Wind-carved canyons", "Underground caravanserai"],
    hyperlanes: ["Hutt-controlled spur off the Pabol Sleheyron"],
    famousFor: "Discreet cargo handling. The kind of place a manifest gets lost on purpose.",
    cantinaReputation: "Two cantinas, three knife fights a night. Pay the protection slip on the way in.",
    standingCurrency: "Hutt wupiupi, Imperial credits at a discount"
  },
  'takodana': {
    tagline: "Lush forest world ringed by a single freshwater lake — neutral ground for the galaxy's outlaws.",
    government: "None — Maz Kanata's castle holds informal authority on the Nymeve Lake shore",
    affiliation: "Independent (neutral)",
    climate: "Temperate",
    terrain: ["Old-growth forests", "Nymeve Lake basin", "Rolling hills"],
    hyperlanes: ["Smuggler's spur off the Hydian Way"],
    famousFor: "Maz Kanata's castle (a thousand years of pirate hospitality). Blackwind Point — Varga the Hutt's lawless shantytown across the lake.",
    cantinaReputation: "Maz's main hall is the cleanest crooked bar in the galaxy. Blackwind Point is the dirtiest. Both serve good caf.",
    standingCurrency: "Republic credits, gemstones, and favors"
  },
  'xala': {
    tagline: "Cold mining moon. The Empire's quiet quartermaster depot.",
    government: "Imperial military administration",
    affiliation: "Galactic Empire",
    climate: "Cold arid",
    terrain: ["Iron-rich badlands", "Open-pit mines", "Prefab garrison towns"],
    hyperlanes: ["Imperial-only convoy lane off the Hydian Way"],
    famousFor: "Imperial supply caching. Officially nothing happens here; unofficially, a great deal does.",
    cantinaReputation: "One bar, three off-duty stormtroopers in it at any hour. Watch your tongue.",
    standingCurrency: "Imperial credits"
  },
  'aldhani': {
    tagline: "Remote highland world famous for the Eye of Aldhani celestial event.",
    government: "Imperial governor; pre-Imperial highland clans displaced",
    affiliation: "Galactic Empire — payroll garrison",
    climate: "Cold temperate, mountainous",
    terrain: ["High mountain plateaus", "River-carved gorges", "Heather moors"],
    hyperlanes: ["Spur off the Hydian Way through the Cademimu sector"],
    famousFor: "The Eye of Aldhani — a meteor-shower spectacle every three years. Imperial payroll vault and a navigation relay.",
    cantinaReputation: "One inn at the foot of the garrison; barley spirits, watery stew, and a bartender who reports to the captain.",
    standingCurrency: "Imperial credits"
  },
  'cerea': {
    tagline: "Pastoral homeworld of the Cereans — low-tech by choice.",
    government: "Cerean Council of Elders",
    affiliation: "Independent (Imperial trade observer only)",
    climate: "Temperate",
    terrain: ["Rolling grasslands", "River valleys", "Stilted Cerean villages"],
    hyperlanes: ["Cerean spur off the Hydian Way"],
    famousFor: "Cereans, Jedi sympathies in the Clone Wars, and a culture that politely refuses most off-world tech.",
    cantinaReputation: "No cantinas in the planned sense — Cerean village halls serve grain mead to anyone who behaves. Don't bring blasters indoors.",
    standingCurrency: "Republic credits accepted; barter preferred"
  },
  'clakdor-vii': {
    tagline: "Bith homeworld scarred by a long-ago bioweapon catastrophe.",
    government: "Bith Council under domed-city charter",
    affiliation: "Independent (Imperial protectorate in title only)",
    climate: "Toxic atmosphere outside the bio-domes",
    terrain: ["Toxic plains", "Bio-domed cities", "Ancient ruined surface settlements"],
    hyperlanes: ["Colundra Sector trunk off the Hydian Way"],
    famousFor: "Bith musicians and acoustic engineers. Refined dome cities. The lingering scars of a bioweapon disaster.",
    cantinaReputation: "Civilized lounges with the best live music in the sector. No fights — Bith bouncers are alarmingly polite about ejections.",
    standingCurrency: "Republic credits"
  },
  'coruscant': {
    tagline: "City-planet capital of the galaxy. Every street is a different country.",
    government: "Imperial Throneworld; planetary governance via the Imperial Senate (a rubber stamp)",
    affiliation: "Galactic Empire — capital",
    climate: "Climate-controlled, ecumenopolis",
    terrain: ["Continent-spanning city", "Skylanes", "Lower-level undercity", "Sublevel works"],
    hyperlanes: ["Perlemian Trade Route", "Corellian Run", "Hydian Way", "Koros Trunk Line — every major lane meets here"],
    famousFor: "The Imperial Palace, the Senate Rotunda, the Jedi Temple ruins, and a thousand levels of city below the sky.",
    cantinaReputation: "Upper-level lounges check writs at the door. Lower-level dives don't check anything except whether you're still breathing.",
    standingCurrency: "Imperial credits"
  },
  'dagobah': {
    tagline: "Fog-drowned swamp world strong with the Force — and most spacers can't see why.",
    government: "None",
    affiliation: "Unaligned (uncharted)",
    climate: "Humid swamp",
    terrain: ["Fungal swamps", "Mangrove root cathedrals", "Murky pools"],
    hyperlanes: ["None on standard charts"],
    famousFor: "Almost nothing. Survey crews report nav-instruments going odd in low orbit and turn back.",
    cantinaReputation: "No cantina. The bartender is a swamp mosquito the size of your hand.",
    standingCurrency: "None"
  },
  'dathomir': {
    tagline: "Red-skied haunted world of the Nightsister witches.",
    government: "Nightsister clans (decimated); Zabrak nomads",
    affiliation: "Independent (avoided by Imperial patrols)",
    climate: "Temperate, perpetually red-skied",
    terrain: ["Bone-strewn forests", "Fog plateaus", "Singing Mountain ridges"],
    hyperlanes: ["Off-lane spur from the Quelii sector"],
    famousFor: "Nightsister magicks, rancor herds, and a planetary mood that drives spacers to the bottle.",
    cantinaReputation: "If you're drinking on Dathomir you've already made a mistake. The locals don't drink with strangers.",
    standingCurrency: "Barter only"
  },
  'fondor': {
    tagline: "Imperial shipyard world — second only to Kuat in tonnage launched.",
    government: "Fondorian Naval Authority (Imperial-administered)",
    affiliation: "Galactic Empire",
    climate: "Industrial temperate",
    terrain: ["Orbital shipyard rings", "Heavy industrial coast", "Refinery cities"],
    hyperlanes: ["Rimma Trade Route junction", "Coreward leg toward Sullust"],
    famousFor: "Capital-ship construction. The Fondor naval drydocks are visible from orbit as a second ring around the planet.",
    cantinaReputation: "Dock-worker bars off the southern shipyards. Strong drink, stronger opinions about overtime pay.",
    standingCurrency: "Imperial credits"
  },
  'kashyyyk': {
    tagline: "Wroshyr-tree homeworld of the Wookiees — and an Imperial slave colony.",
    government: "Imperial Occupation Authority over scattered Wookiee elders' councils",
    affiliation: "Galactic Empire (occupied)",
    climate: "Tropical",
    terrain: ["Wroshyr canopy cities", "Beach fortresses", "Shadowlands jungle floor"],
    hyperlanes: ["Randon Run", "Bothan Run connector"],
    famousFor: "Wookiees. Wroshyr trees a kilometer tall. Imperial slaver garrisons that sailors avoid being asked about.",
    cantinaReputation: "Mid-canopy traders' halls serve travelers; ground-level bars are slaver-run and best avoided.",
    standingCurrency: "Imperial credits; Wookiee bone-chits among locals"
  },
  'kessel': {
    tagline: "Spice-mining hellworld at the bad end of the Kessel Run.",
    government: "Pyke Syndicate prison-mine administration (with Imperial oversight)",
    affiliation: "Galactic Empire (contracted to the Pykes)",
    climate: "Atmospheric processors barely keep it breathable",
    terrain: ["Spice mines", "Sulfurous wastes", "Slag plateaus"],
    hyperlanes: ["Kessel Run (smuggler's lane through the Maw)"],
    famousFor: "Spice. Slave labor. Smugglers who claim to have shaved hours off the Run (most are lying).",
    cantinaReputation: "Off-shift miner bars in the workers' tier — flat ale, vacant stares. Pyke overseers drink in the upper levels; you don't.",
    standingCurrency: "Imperial credits, spice"
  },
  'klatooine': {
    tagline: "Hutt-clientage homeworld of the Klatooinians.",
    government: "Hutt overlordship via ancient covenant",
    affiliation: "Hutt Space",
    climate: "Hot arid",
    terrain: ["Stone deserts", "The Fountain plateau", "Shaded oasis cities"],
    hyperlanes: ["Pabol Sleheyron junction"],
    famousFor: "The Fountain of Ancients (a sacred treaty site). Generations of Klatooinian indenture to the Hutt clans.",
    cantinaReputation: "Hutt-licensed cantinas. Pay your slip, watch your back, don't insult the Fountain.",
    standingCurrency: "Wupiupi, Imperial credits at unfavorable rates"
  },
  'lotho-minor': {
    tagline: "Junkworld where everyone — including the planet — is broken.",
    government: "None — gang factions among the scrap",
    affiliation: "Unaligned (avoided by Imperial Customs)",
    climate: "Toxic temperate",
    terrain: ["Continent-deep junk strata", "Acid pools", "Rusted skyhook ruins"],
    hyperlanes: ["Off-lane; reached via salvage convoys"],
    famousFor: "Salvage. Lost things. The Junkers — lifelong scavengers who never leave.",
    cantinaReputation: "There are no cantinas. There is a man with a still in a wrecked freighter, and you don't ask his name.",
    standingCurrency: "Salvage barter"
  },
  'mimban': {
    tagline: "Mud-soaked world of trench warfare and Imperial hyperbarride mining.",
    government: "Imperial military governorship (martial law)",
    affiliation: "Galactic Empire — active warfront",
    climate: "Perpetual rain",
    terrain: ["Endless mud trenches", "Jungle highlands", "Hyperbarride mine pits"],
    hyperlanes: ["Carida-Mimban supply lane"],
    famousFor: "The Mimban Campaign — a slow grinding war the Empire pretends is over. Coaxium-grade mineral mines.",
    cantinaReputation: "Field-mess tents and unauthorized still-bars. Trooper rotations bring news from across the lines for the price of a drink.",
    standingCurrency: "Imperial scrip"
  },
  'mustafar': {
    tagline: "Volcanic forge-world of fire rivers and Imperial mining concerns.",
    government: "Imperial mining concession; pre-Imperial Mustafarian clans tolerated",
    affiliation: "Galactic Empire",
    climate: "Volcanic",
    terrain: ["Lava rivers", "Obsidian plains", "Mining platforms above magma"],
    hyperlanes: ["Mustafar spur off the Triellus Trade Route"],
    famousFor: "Lava-mined ores, ancient Sith ruins (officially denied), and a black tower no one is permitted to ask about.",
    cantinaReputation: "Refinery-floor canteens. Drink fast — the heat will sour your ale before you finish it.",
    standingCurrency: "Imperial credits"
  },
  'naboo': {
    tagline: "Twin-civilization world of human plains-cities and underwater Gungan domes.",
    government: "Naboo Royal House (Imperial-aligned monarchy) and Gungan High Council",
    affiliation: "Galactic Empire (politically aligned)",
    climate: "Temperate",
    terrain: ["Lake country", "Swamps", "Plains cities (Theed)"],
    hyperlanes: ["Enarc Run", "Rimma Trade Route connector"],
    famousFor: "Theed Royal Palace. Plasma refineries. The Emperor's birthworld (a fact the Naboo do not advertise).",
    cantinaReputation: "Theed lounges are tasteful and Imperial-watched. Lake-country bars are friendly. Gungan establishments do not serve outsiders by choice.",
    standingCurrency: "Imperial credits"
  },
  'ord-mantell': {
    tagline: "Ancient Ordnance Regional Depot world — now a galaxy-famous criminal port.",
    government: "Mantellian planetary council (corrupt; bought by syndicates)",
    affiliation: "Galactic Empire (lightly governed)",
    climate: "Warm temperate",
    terrain: ["Coastal port cities (Worlport)", "Junkfields", "Old Ordnance bunker hills"],
    hyperlanes: ["Hydian Way junction; Bormea-Mantell trunk"],
    famousFor: "Bounty hunters. Smugglers. The Worlport black markets. More wanted notices on its boards than any other Mid Rim world.",
    cantinaReputation: "Pick a cantina and someone in it is wanted somewhere. Tip well, sit facing the door.",
    standingCurrency: "Imperial credits, Hutt wupiupi, anything that clinks"
  },
  'ponemah-terminal': {
    tagline: "Decrepit deep-space refueling station the Empire can't quite be bothered to scrap.",
    government: "Station administrator (Imperial appointee)",
    affiliation: "Galactic Empire (administrative drift)",
    climate: "Vacuum (life-support only)",
    terrain: ["Hub-and-spoke station modules", "Disused docking arms", "Cargo holds repurposed as dwellings"],
    hyperlanes: ["Triellus Trade Route waypoint"],
    famousFor: "Long-haul refueling for ships skipping Imperial customs. Cheap berthing for ships nobody is looking for.",
    cantinaReputation: "Two cantinas, neither of which has cleaned the deckplates in a decade. The drinks are cold; the company is colder.",
    standingCurrency: "Imperial credits, ship parts"
  },
  'rishi': {
    tagline: "Pirate-haven moon at a key intersection of Outer Rim hyperlanes.",
    government: "None — pirate captaincies in loose confederation",
    affiliation: "Unaligned (Imperial patrols rare)",
    climate: "Tropical",
    terrain: ["Coral atolls", "Volcanic ridges", "Shanty-port towns"],
    hyperlanes: ["Rishi Maze gateway", "Hydian Way southern spur"],
    famousFor: "Pirates, smugglers, and the kind of cantinas where the Imperial Navy declines to follow.",
    cantinaReputation: "Pirate hospitality — boisterous, dangerous, occasionally lethal. Watch your purse and your back.",
    standingCurrency: "Imperial credits, Hutt wupiupi, captured cargo"
  },
  'saleucami': {
    tagline: "Hot scrubland world of pacifist farmers and Imperial agro-corp leases.",
    government: "Imperial governor over Saleucamian farmsteader councils",
    affiliation: "Galactic Empire",
    climate: "Hot arid with monsoon belts",
    terrain: ["Thorn savannah", "Volcanic uplands", "Riverside farmsteads"],
    hyperlanes: ["Quelii sector trunk off the Triellus Trade Route"],
    famousFor: "Clone Wars veterans who settled here as homesteaders. Quiet farmland. Imperial agribusiness annexations.",
    cantinaReputation: "Roadhouse bars at the crossroads. Local farmers and ex-clones drink quietly and notice everything.",
    standingCurrency: "Imperial credits, grain credits"
  },
  'sluis-van': {
    tagline: "Civilian shipyard hub of the Sluis sector.",
    government: "Sluissi Shipwrights' Guild administration (Imperial-licensed)",
    affiliation: "Galactic Empire (contracted)",
    climate: "Temperate",
    terrain: ["Coastal yard cities", "Floating drydocks", "Inland reef estuaries"],
    hyperlanes: ["Rimma Trade Route major node"],
    famousFor: "The Sluis Van orbital drydocks — civilian retrofits, custom freighter conversions, and Imperial overflow contracts.",
    cantinaReputation: "Dockside Sluissi taverns serve sweetened brine-wines. Take small sips and don't insult a shipwright's work.",
    standingCurrency: "Imperial credits"
  },
  'sriluur': {
    tagline: "Hot desert homeworld of the Weequay.",
    government: "Weequay clan elders; Hutt commercial interests overlaid",
    affiliation: "Hutt Space (de facto)",
    climate: "Hot arid",
    terrain: ["Stone deserts", "Salt flats", "Cliffside clan-cities"],
    hyperlanes: ["Sisar Run", "Triellus Trade Route junction"],
    famousFor: "Weequay mercenaries, sail-barge crews, and Hutt enforcer recruitment.",
    cantinaReputation: "Clan houses double as cantinas. Buy the eldest a drink before you sit down or expect a polite knife at your back.",
    standingCurrency: "Wupiupi, Imperial credits"
  },
  'sullust': {
    tagline: "Volcanic homeworld of the Sullustans and SoroSuub Corporation.",
    government: "SoroSuub Corporation (effective rule); Sullustan Council in title",
    affiliation: "Galactic Empire (corporate-aligned)",
    climate: "Volcanic; survivable in subsurface cavern cities",
    terrain: ["Lava plains", "Cavern cities", "Tunnel networks"],
    hyperlanes: ["Rimma Trade Route major node"],
    famousFor: "SoroSuub starship and blaster manufacturing. The greatest underground cities in the Outer Rim.",
    cantinaReputation: "SoroSuub-run worker lounges are clean and well-policed. Independent cavern bars are friendlier and louder.",
    standingCurrency: "Imperial credits"
  },
  'tatooine': {
    tagline: "Twin-sunned desert world; Hutt fiefdom in all but name.",
    government: "Hutt clans (Jabba's territory dominant); nominal Imperial customs office at Mos Eisley",
    affiliation: "Hutt Space (de facto); Galactic Empire (in name)",
    climate: "Hot arid (twin suns)",
    terrain: ["Dune seas", "Salt flats", "Jundland canyons", "Mesa rim settlements"],
    hyperlanes: ["Triellus Trade Route major node", "Corellian Run southern spur"],
    famousFor: "Mos Eisley spaceport. Jabba's palace. Pod racing. Moisture farms. Sand. So much sand.",
    cantinaReputation: "Chalmun's cantina in Mos Eisley is the galaxy's most famous spacer bar. You can buy passage, sell information, or get knifed — sometimes in that order.",
    standingCurrency: "Imperial credits, wupiupi, water chits"
  },
  'vandor': {
    tagline: "Snowbound mountain world straddling Coaxium freight routes.",
    government: "Imperial mountain district administration",
    affiliation: "Galactic Empire",
    climate: "Cold; alpine",
    terrain: ["Snow ranges", "Glacial valleys", "Conveyex rail viaducts"],
    hyperlanes: ["Coaxium freight spur off the Hydian Way"],
    famousFor: "Imperial Conveyex trains hauling Coaxium. Cliff-edge railroads. Failed train heists nobody admits to.",
    cantinaReputation: "Lodge-style trader bars at the rail depots. Hot spiced grog, gruff company, and the occasional bounty hunter.",
    standingCurrency: "Imperial credits"
  },
  'yagdhul': {
    tagline: "Givin homeworld of geometric architects, in tense Imperial protectorate.",
    government: "Givin Body Calculus (mathematical theocracy)",
    affiliation: "Independent (Imperial protectorate by treaty)",
    climate: "Thin atmosphere; extreme tides",
    terrain: ["Dome cities", "Tide-scoured coasts", "Crystal escarpments"],
    hyperlanes: ["Sanrafsix Corridor"],
    famousFor: "Givin shipwrights and structural engineers. The most precise mathematics in the Outer Rim.",
    cantinaReputation: "Givin lounges are quiet and orderly; they will calculate your closing tab to four decimal places.",
    standingCurrency: "Imperial credits"
  }
};

const REQUIRED = ['tagline','government','affiliation','climate','terrain','hyperlanes','famousFor','cantinaReputation','standingCurrency'];

let touched = 0;
let issues = [];

for (const slug of Object.keys(AUTHORED)) {
  const fp = path.join(DIR, slug + '.json');
  if (!fs.existsSync(fp)) { issues.push('missing file: ' + slug); continue; }
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  j.common = j.common || {};
  const a = AUTHORED[slug];
  for (const k of REQUIRED) {
    const cur = j.common[k];
    const isEmpty = (cur === undefined || cur === null || cur === '' ||
                     (Array.isArray(cur) && cur.length === 0));
    if (isEmpty && a[k] !== undefined) j.common[k] = a[k];
  }
  delete j.common.astrography;
  delete j.common.physical;
  delete j.common.society;
  fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n');
  touched++;
}

const all = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== '_manifest.json');
const stillEmpty = [];
for (const f of all) {
  const c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).common || {};
  const blanks = REQUIRED.filter(k => {
    const v = c[k];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  if (blanks.length) stillEmpty.push({ f, blanks });
}

console.log('updated:', touched, 'files');
console.log('still incomplete:', stillEmpty.length);
if (stillEmpty.length) console.log(JSON.stringify(stillEmpty, null, 2));
if (issues.length) console.log('issues:', issues);
