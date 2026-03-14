(function () {
  'use strict';

  var THEME_KEY     = 'eote-theme';
  var DEFAULT_THEME = 'theme-rebellion';
  var THEMES        = ['theme-rebellion', 'theme-fringe', 'theme-r2d2', 'theme-vader'];
  var THEME_LABELS  = {
    'theme-rebellion': 'Rebellion',
    'theme-fringe':    'The Fringe',
    'theme-r2d2':      'R2-D2',
    'theme-vader':     'Darth Vader',
  };

  var CREATION_KEY = 'eote-char-creation';

  var ARENA_ORDER  = ['physique', 'reflex', 'grit', 'wits', 'presence'];
  var ARENA_LABELS = {
    physique: 'Physique',
    reflex:   'Reflex',
    grit:     'Grit',
    wits:     'Wits',
    presence: 'Presence',
  };
  var ARENA_BASELINE = { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' };
  var DIE_ORDER      = ['D4', 'D6', 'D8', 'D10', 'D12'];

  var SPECIES = [
    {
      id:      'human',
      name:    'Human',
      tagline: 'Adaptable. Ambitious. Everywhere.',
      imageUrl: null,
      arenaShift: {
        name:     'The Baseline',
        desc:     'Humans are the canvas the galaxy is painted on. You start with all five Arenas — Physique, Reflex, Grit, Wits, Presence — at D6. You have no inherent biological penalties or peaks.',
        stepUp:   [],
        stepDown: [],
      },
      nativeSkill: {
        name:   'Versatility',
        desc:   'Because human culture is so heavily varied, you may select any one Skill of your choice to start at Familiarity (D6).',
        skills: [{ name: 'Any Skill (Your Choice)', die: 'D6', choice: true }],
        choice: true,
      },
      biologicalTruth: {
        name: 'Galactic Ubiquity',
        desc: 'Humans make up the vast majority of the Empire, the corporate sector, and the underworld. You can blend into crowds, acquire standard-issue gear, and infiltrate human-centric organizations (like Imperial garrisons) without drawing the immediate prejudice, suspicion, or xenophobia that alien species face.',
      },
      arenas: { physique: 'D6', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D6' },
      _aiMeta: {
        loreAnchors: [
          'Beneficiary of Imperial Humanocentrism — Even poor humans face less systemic harassment than aliens.',
          'Galactic Ubiquity — Can blend into Imperial outposts, corporate mining camps, or refugee caravans without drawing innate suspicion.',
          'Colonial Migrant / Core-World Exile — Often in the Reaches to exploit the frontier or hide from the Core\'s strict laws.',
        ],
        directives: 'If the character is anti-Empire, emphasize that they walked away from the privilege of Imperial High Culture. If they are underworld, emphasize how easily they slip past Imperial customs.',
      },
    },
    {
      id:      'twilek',
      name:    "Twi'lek",
      tagline: 'Graceful. Perceptive. Survivors.',
      imageUrl: 'https://mywritingdistractions.com/wp-content/uploads/2024/07/Species-Datapad-Twilek.webp',
      arenaShift: {
        name:     'Agile & Expressive',
        desc:     'Step Up: Presence to D8 (or Reflex to D8). Step Down: Physique to D4.',
        stepUp:   [{ arena: 'presence', die: 'D8', note: 'or Reflex \u2192 D8' }],
        stepDown: [{ arena: 'physique', die: 'D4' }],
      },
      nativeSkill: {
        name:   'Survival Instincts',
        desc:   "You gain Charm (Presence) or Evasion (Reflex) at Familiarity (D6), representing a youth spent either navigating dangerous social circles or physically dodging trouble.",
        skills: [
          { name: 'Charm',   arena: 'Presence', die: 'D6' },
          { name: 'Evasion', arena: 'Reflex',   die: 'D6' },
        ],
        choice: true,
      },
      biologicalTruth: {
        name: 'Lekku Sign',
        desc: "You can communicate silently using subtle twitches and movements of your lekku (head-tails). You can transmit complex tactical concepts, warnings, or emotions to anyone else who knows Lekku Sign Language — even across a crowded, loud, or pitch-black room where verbal comms would get you killed.",
      },
      arenas: { physique: 'D4', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D8' },
      _aiMeta: {
        loreAnchors: [
          'Subject to Imperial Marginalization — Aliens are treated as second-class citizens or cheap labor under the New Order.',
          'Shadow Economy Survivor — Thrives in places the Empire ignores, like Black Spire Outpost on Batuu, or neutral grounds like Takodana.',
          'Syndicate Exploitation — Frequently targeted by the Hutt Cartel or Pyke Syndicate for debt-bondage.',
        ],
        directives: "Emphasize the character's reliance on non-verbal communication (Lekku sign language) to survive in dangerous, loud, or heavily monitored environments. Frame their presence in the Western Reaches as either an escape from slavery or a hustle to stay ahead of the syndicates.",
      },
    },
    {
      id:      'wookiee',
      name:    'Wookiee',
      tagline: 'Fierce. Loyal. Terrifying.',
      imageUrl: null,
      arenaShift: {
        name:     'Raw Mass',
        desc:     'Step Up: Physique to D8. Step Down: Presence to D4 — outside of other Wookiees, your sheer size and guttural language make subtle social navigation incredibly difficult.',
        stepUp:   [{ arena: 'physique', die: 'D8' }],
        stepDown: [{ arena: 'presence', die: 'D4' }],
      },
      nativeSkill: {
        name:   'Trench Fighter',
        desc:   'You gain Brawl (Physique) at Familiarity (D6). You are biologically built for close-quarters devastation.',
        skills: [{ name: 'Brawl', arena: 'Physique', die: 'D6' }],
        choice: false,
      },
      biologicalTruth: {
        name: 'Brute Physiology',
        desc: "You possess musculature and claws that defy standard humanoid limits. You automatically succeed on feats of raw, brute lifting, ripping, or breaking — like tearing a blast door off its hinges or pulling a droid's arms out of its sockets — that a human couldn't even attempt. (Note: You can understand Basic perfectly, but can only speak Shyriiwook.)",
      },
      arenas: { physique: 'D8', reflex: 'D6', grit: 'D6', wits: 'D6', presence: 'D4' },
      _aiMeta: {
        loreAnchors: [
          'Imperial Enslavement Target — Kashyyyk is occupied. Wookiees are actively hunted by the Empire for brutal labor in places like the Kessel Spice Mines or Western Reaches mining operations.',
          'Fugitive / Escaped Slave — Operating freely in the Western Reaches means they are likely an escaped prisoner, a surviving mercenary, or a highly sought-after bounty.',
          'Mechanical Savant + Apex Predator — Known equally for tearing droids apart and repairing complex hyperdrives.',
        ],
        directives: "The character's backstory must reflect the immediate, existential danger of being a Wookiee under the Empire. Do not treat them as a standard citizen; they are a walking target. Mention the psychological toll of their homeworld's subjugation.",
      },
    },
    {
      id:      'duros',
      name:    'Duros',
      tagline: 'Born to navigate. Built for the void.',
      imageUrl: null,
      arenaShift: {
        name:     "The Spacer's Build",
        desc:     'Step Up: Reflex to D8. Step Down: Physique to D4 — adapted to zero-G and shipboard life, you lack the raw muscle of gravity-bound species.',
        stepUp:   [{ arena: 'reflex', die: 'D8' }],
        stepDown: [{ arena: 'physique', die: 'D4' }],
      },
      nativeSkill: {
        name:   'Helm Jockey',
        desc:   'You gain Piloting (Reflex) at Familiarity (D6). You were practically born in a cockpit and think in three-dimensional vectors.',
        skills: [{ name: 'Piloting', arena: 'Reflex', die: 'D6' }],
        choice: false,
      },
      biologicalTruth: {
        name: 'Stellar Intuition',
        desc: 'You have an innate, mathematical understanding of astrogation and celestial drift. As long as you can see the stars, you can always determine your exact galactic coordinates, and you can attempt to plot a hyperspace jump even if your ship\'s navicomputer is damaged or destroyed.',
      },
      arenas: { physique: 'D4', reflex: 'D8', grit: 'D6', wits: 'D6', presence: 'D6' },
      _aiMeta: {
        loreAnchors: [
          'Frontier Navigator — The Western Reaches are poorly mapped and border the Unknown Regions. Duros astrogation skills are highly prized by smugglers, the Mining Guild, and Imperial explorers.',
          'Nomadic Spacer — Rarely tied to a single planet. Often found in spaceports like Niima Outpost or orbiting shipyards.',
          'Alien Marginalization — Like all non-humans, pushed out of official Imperial Navy roles, forcing them into freelance, corporate, or illegal piloting.',
        ],
        directives: 'Focus on their connection to the stars and ships. If they took Phase 1 or 2 cards related to driving/piloting, emphasize that they have memorized secret, highly dangerous hyperspace routes that the Imperial Navy is too afraid to chart.',
      },
    },
    {
      id:      'zabrak',
      name:    'Zabrak',
      tagline: 'Unyielding. Defiant. Built to endure.',
      imageUrl: null,
      arenaShift: {
        name:     'Unyielding',
        desc:     'Step Up: Grit to D8. Step Down: Presence to D4 — your blunt, abrasive demeanor and intense cultural pride make subtle negotiations difficult.',
        stepUp:   [{ arena: 'grit', die: 'D8' }],
        stepDown: [{ arena: 'presence', die: 'D4' }],
      },
      nativeSkill: {
        name:   'Frontier Endurance',
        desc:   'You gain Endure (Physique) at Familiarity (D6). You are biologically built to outlast extreme hardship, grueling labor, and physical punishment.',
        skills: [{ name: 'Endure', arena: 'Physique', die: 'D6' }],
        choice: false,
      },
      biologicalTruth: {
        name: 'Redundant Biology',
        desc: 'You possess a secondary heart and a nervous system with an incredibly high pain threshold. You can function normally through excruciating physical trauma that would cause a human to pass out from shock, and you can comfortably survive in extreme frontier temperatures — blistering desert heat or freezing nights — without specialized environmental gear.',
      },
      arenas: { physique: 'D6', reflex: 'D6', grit: 'D8', wits: 'D6', presence: 'D4' },
      _aiMeta: {
        loreAnchors: [
          'Harsh Environment Survivor — Biologically suited to survive the grueling climates of worlds like Jakku or the contested warlord zones of Lyiukis.',
          'Independent Mercenary — Often employed as muscle by local warlords, criminal syndicates, or desperate settlements due to their martial culture and pain tolerance.',
          'Defiant — Culturally resistant to authoritarian rule, making them natural enemies of Imperial planetary governors.',
        ],
        directives: 'Highlight their physical resilience and stubborn pride. Emphasize a background of enduring extreme physical hardship, whether that was surviving a blaster fight, grueling labor, or the lethal environments of the frontier.',
      },
    },
  ];

  var PHASE1_CARDS = [
    {
      id: 'deep-fringe',
      title: 'The Deep Fringe',
      symbol: 'Twin Suns',
      imageUrl: '/assets/phase1/01-deep-fringe.png',
      narrative: 'You grew up where the Empire\'s reach frays to nothing — twin suns bleaching everything pale, the nearest starport a week\'s ride out. Self-reliance isn\'t a virtue here; it\'s the only thing keeping you breathing. The galaxy owes you nothing, and that truth made you dangerous.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4"><circle cx="45" cy="50" r="25"/><circle cx="75" cy="35" r="12"/><line x1="10" y1="85" x2="90" y2="85"/><line x1="20" y1="92" x2="80" y2="92" stroke-width="2"/></svg>',
      _meta: { environment: 'outer-rim-desert', tone: 'isolation, self-reliance, frontier survival', themes: ['resource scarcity', 'independence', 'frontier justice'] },
    },
    {
      id: 'shadowed-levels',
      title: 'The Shadowed Levels',
      symbol: 'Sabacc Chip',
      imageUrl: '/assets/phase1/02-shadowed-levels.png',
      narrative: 'You were raised in the underlevels — where the lights of the upper city are just a rumor and debts are paid in blood or service. You learned to read people before you could read a holomap, and you know that every deal has a hidden clause. Trust is a currency you spend carefully.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linejoin="round"><polygon points="50,10 85,30 85,70 50,90 15,70 15,30"/><polygon points="50,22 75,37 75,63 50,78 25,63 25,37"/><rect x="42" y="40" width="16" height="20"/><line x1="42" y1="45" x2="58" y2="45"/><line x1="42" y1="55" x2="58" y2="55"/></svg>',
      _meta: { environment: 'urban-underworld', tone: 'cunning, distrust, survival by wit', themes: ['class divide', 'criminal networks', 'street smarts'] },
    },
    {
      id: 'salvage-yards',
      title: 'The Salvage Yards',
      symbol: 'Hydrospanner',
      imageUrl: '/assets/phase1/03-salvage-yards.png',
      narrative: 'Every ship that flies was once someone\'s wreck. You grew up knee-deep in that wreckage — pulling circuits from crashed freighters, selling scrap to keep the lights on. Machines tell you their secrets if you know how to listen. You\'ve built survival from the galaxy\'s trash.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M 65 20 C 80 20 85 35 75 45 L 40 80 C 35 85 25 85 20 80 C 15 75 15 65 20 60 L 55 25 C 65 15 80 20 65 20 Z"/><line x1="78" y1="22" x2="60" y2="40"/><line x1="35" y1="65" x2="45" y2="75"/><circle cx="28" cy="72" r="3" fill="currentColor"/></svg>',
      _meta: { environment: 'junkyard-planet', tone: 'resourcefulness, ingenuity, underdog grit', themes: ['mechanical aptitude', 'poverty', 'found family'] },
    },
    {
      id: 'coreward-spires',
      title: 'The Coreward Spires',
      symbol: 'Senate Crest',
      imageUrl: '/assets/phase1/04-coreward-spires.png',
      narrative: 'You had everything the Empire promised — spires that touched the clouds, an education that opened doors, and a family name worth something. Then you saw what that system cost the rest of the galaxy. Some fled privilege in guilt; others were pushed out when their usefulness expired.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><circle cx="50" cy="28" r="10"/><line x1="50" y1="38" x2="50" y2="52"/><line x1="28" y1="52" x2="72" y2="52"/><line x1="28" y1="52" x2="28" y2="78"/><line x1="72" y1="52" x2="72" y2="78"/><line x1="18" y1="78" x2="82" y2="78"/><path d="M 28 52 Q 50 38 72 52" stroke-width="2"/><circle cx="50" cy="28" r="4" fill="currentColor" stroke="none"/></svg>',
      _meta: { environment: 'core-world-city', tone: 'privilege, disillusionment, insider knowledge', themes: ['political intrigue', 'Imperial complicity', 'fallen status'] },
    },
    {
      id: 'agrarian-plain',
      title: 'The Agrarian Plain',
      symbol: 'Moisture Vaporator',
      imageUrl: '/assets/phase1/05-agrarian-plain.png',
      narrative: 'You come from working land — rows of crops, communal tables, and seasons that ruled your calendar. Your community survived by cooperation and quiet resilience. The Empire took the harvest and left the labor. That memory of something worth protecting is why you fight.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><line x1="50" y1="12" x2="50" y2="78"/><ellipse cx="50" cy="26" rx="18" ry="5"/><ellipse cx="50" cy="40" rx="12" ry="4"/><line x1="34" y1="62" x2="66" y2="62"/><line x1="28" y1="70" x2="72" y2="70"/><line x1="10" y1="86" x2="90" y2="86"/><line x1="5" y1="93" x2="95" y2="93" stroke-width="2"/></svg>',
      _meta: { environment: 'farming-world', tone: 'community, loss, humble origins', themes: ['Imperial taxation', 'rural displacement', 'agrarian values'] },
    },
    {
      id: 'war-front',
      title: 'The War Front',
      symbol: 'Blaster Pistol',
      imageUrl: '/assets/phase1/06-war-front.png',
      narrative: 'Peace is something other people talk about. You grew up in the sound of it — distant artillery, rationed water, the faces of soldiers cycling through. War was the weather of your childhood. You learned to read threat before you learned to read a face. You are very, very hard to surprise.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M 18 44 L 64 44 L 74 34 L 80 34 L 80 56 L 64 56 L 18 56 Z"/><line x1="80" y1="45" x2="94" y2="45"/><rect x="28" y="56" width="14" height="18"/><line x1="18" y1="50" x2="26" y2="50"/></svg>',
      _meta: { environment: 'conflict-zone', tone: 'hardened, vigilant, combat-shaped', themes: ['military exposure', 'PTSD', 'tactical instinct'] },
    },
    {
      id: 'ancient-ruin',
      title: 'The Ancient Ruin',
      symbol: 'Broken Arch',
      imageUrl: '/assets/phase1/07-ancient-ruin.png',
      narrative: 'Your home was built on something older — crumbled temples, inscriptions no living scholar could read, and a persistent feeling that the air itself was watching. You grew up chasing questions no one could answer. Whatever the old civilization left behind, a fragment of it lodged in you.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><line x1="18" y1="84" x2="18" y2="44"/><line x1="82" y1="84" x2="82" y2="44"/><path d="M 18 44 Q 50 8 82 44"/><line x1="30" y1="32" x2="36" y2="24" stroke-width="2"/><line x1="64" y1="30" x2="70" y2="22" stroke-width="2"/><line x1="8" y1="86" x2="92" y2="86"/><rect x="12" y="75" width="10" height="11"/><rect x="78" y="70" width="8" height="16"/></svg>',
      _meta: { environment: 'ancient-nexus-world', tone: 'curiosity, mysticism, inherited mystery', themes: ['Force adjacency', 'lost civilization', 'archaeology'] },
    },
    {
      id: 'trading-post',
      title: 'The Trading Post',
      symbol: 'Navigation Beacon',
      imageUrl: '/assets/phase1/08-trading-post.png',
      narrative: 'Where routes cross, everything flows — goods, gossip, fugitives, and opportunity. You grew up at the intersection, learning a dozen languages before adulthood and the art of the deal before you could pilot. You know that information is the most valuable cargo in the galaxy.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><circle cx="50" cy="50" r="20"/><circle cx="50" cy="50" r="34" stroke-width="2" stroke-dasharray="5,4"/><line x1="50" y1="10" x2="50" y2="30"/><line x1="90" y1="50" x2="70" y2="50"/><line x1="50" y1="90" x2="50" y2="70"/><line x1="10" y1="50" x2="30" y2="50"/><circle cx="50" cy="50" r="5" fill="currentColor" stroke="none"/></svg>',
      _meta: { environment: 'spaceport-crossroads', tone: 'cosmopolitan, opportunistic, multilingual', themes: ['trade networks', 'cultural exposure', 'information brokering'] },
    },
    {
      id: 'detention-block',
      title: 'The Detention Block',
      symbol: 'Cell Bars',
      imageUrl: '/assets/phase1/09-detention-block.png',
      narrative: 'You were born into a cage — not always made of durasteel. Labor camp, indentured service, political imprisonment, or simply the wrong bloodline at the wrong time. The Empire taught you exactly what it was through direct experience. Freedom, when it came, felt like a weapon handed to you.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><rect x="15" y="14" width="70" height="72"/><line x1="30" y1="14" x2="30" y2="86"/><line x1="45" y1="14" x2="45" y2="86"/><line x1="60" y1="14" x2="60" y2="86"/><line x1="75" y1="14" x2="75" y2="86"/><circle cx="8" cy="50" r="6"/><line x1="14" y1="50" x2="15" y2="50" stroke-width="3"/></svg>',
      _meta: { environment: 'imperial-detention', tone: 'defiance, trauma, hard-won freedom', themes: ['forced labor', 'Imperial oppression', 'escape and survival'] },
    },
  ];

  var PHASE2_CARDS = [
    {
      id: 'disbanded-regular',
      title: 'The Disbanded Regular',
      symbol: 'Republic Cog',
      imageUrl: '/assets/phase2/01-disbanded-regular.png',
      narrative: 'You fought for the Galactic Republic or a localized planetary defense force. You bled in the mud alongside Clone Troopers to hold the line against the droid army. But when the war ended, the Republic became the Empire. Your unit was either forcibly decommissioned, replaced by conscripted stormtroopers, or folded into a fascist machine you refused to serve.',
      _meta: {
        phase: 'departure',
        archetype: 'veteran',
        tone: 'loyalty, displacement, forgotten service',
        proficiencies: ['Tactics (Wits)', 'Ranged (Reflex)', 'Athletics (Physique)'],
        variability: 'Disciplined squad leader (Tactics/Ranged) or heavy-infantry trench fighter (Athletics/Ranged)?',
      },
    },
    {
      id: 'separatist-holdout',
      title: 'The Separatist Holdout',
      symbol: 'Hexagon',
      imageUrl: '/assets/phase2/02-separatist-holdout.png',
      narrative: 'You fought for the Confederacy of Independent Systems. You believed in independence from a corrupt Core, but you lost the war. Now, the new Empire labels you a terrorist. You spent the last three years hiding your past, keeping old Separatist tech running with scavenged parts, and maintaining a deep, burning hatred for the stormtroopers occupying your world.',
      _meta: {
        phase: 'departure',
        archetype: 'idealist',
        tone: 'conviction, loss, hunted belief',
        proficiencies: ['Tech (Wits)', 'Ranged (Reflex)', 'Endure (Physique)'],
        variability: 'Guerrilla mechanic (Tech/Ranged) or hardened survivor of the sieges (Endure/Ranged)?',
      },
    },
    {
      id: 'imperial-defector',
      title: 'The Imperial Defector',
      symbol: 'Imperial Crest',
      imageUrl: '/assets/phase2/03-imperial-defector.png',
      narrative: 'You bought the Emperor\'s lies about peace and order. You enlisted in the new Imperial Academies and were shipped out to the Western Regions. But when you saw the sheer brutality of the Pacification Campaigns — the burning of settlements and the subjugation of innocents — your conscience broke. You went AWOL, taking their training and their secrets with you.',
      _meta: {
        phase: 'departure',
        archetype: 'defector',
        tone: 'guilt, insider knowledge, burned bridges',
        proficiencies: ['Piloting (Reflex)', 'Tactics (Wits)', 'Skulduggery (Reflex)'],
        variability: 'Rogue TIE pilot (Piloting/Tactics) or quartermaster who stole Imperial codes (Tactics/Skulduggery)?',
      },
    },
    {
      id: 'blockade-runner',
      title: 'The Blockade Runner',
      symbol: 'Thruster',
      imageUrl: '/assets/phase2/04-blockade-runner.png',
      narrative: 'The Clone Wars were a tragedy for some, but a business opportunity for you. You spent the war running food, weapons, and medical supplies past massive Republic cruisers and Separatist blockades. You learned how to fly a freighter like a starfighter, how to lie to military customs officers, and how to dump your cargo at the first sign of a tractor beam.',
      _meta: {
        phase: 'departure',
        archetype: 'smuggler',
        tone: 'speed, risk, freedom at any cost',
        proficiencies: ['Piloting (Reflex)', 'Deception (Presence)', 'Insight (Presence)'],
        variability: 'Ace smuggler pilot (Piloting/Insight) or smooth-talking contraband broker (Deception/Insight)?',
      },
    },
    {
      id: 'pacification-survivor',
      title: 'The Pacification Survivor',
      symbol: 'Burning Star',
      imageUrl: '/assets/phase2/05-pacification-survivor.png',
      narrative: 'You didn\'t care about the Republic or the Separatists until the new Empire arrived in the Western Regions to "pacify" your home. You watched your settlement burn and your leaders get executed. You fled into the wilderness and learned to fight a desperate, asymmetrical guerrilla war against AT-DP walkers and Imperial garrisons using only traps, shadows, and scavenged blasters.',
      _meta: {
        phase: 'departure',
        archetype: 'insurgent',
        tone: 'resistance, loss, righteous anger',
        proficiencies: ['Stealth (Reflex)', 'Survival (Grit)', 'Evasion (Reflex)'],
        variability: 'Wilderness ambush specialist (Stealth/Survival) or nimble hit-and-run saboteur (Stealth/Evasion)?',
      },
    },
    {
      id: 'field-medic',
      title: 'The Field Medic',
      symbol: 'Stim-Tube',
      imageUrl: '/assets/phase2/06-field-medic.png',
      narrative: 'The Clone Wars produced billions of casualties. You found your calling in the blood and the mud, patching up soldiers, mercenaries, and collateral civilians. You learned how to dig plasma-scorched shrapnel out of flesh with cheap tools, how to keep your hands steady while artillery shakes the ground, and how to make horrific triage choices.',
      _meta: {
        phase: 'departure',
        archetype: 'healer',
        tone: 'duty, triage, moral cost of war',
        proficiencies: ['Medicine (Wits)', 'Resolve (Grit)', 'Insight (Presence)'],
        variability: 'Hardened combat surgeon (Medicine/Resolve) or perceptive, empathetic healer (Medicine/Insight)?',
      },
    },
    {
      id: 'syndicate-enforcer',
      title: 'The Syndicate Enforcer',
      symbol: 'Brass Knuckle',
      imageUrl: '/assets/phase2/07-syndicate-enforcer.png',
      narrative: 'The galactic war was just a distraction. While the Jedi and the Droid Armies fought, the underworld syndicates expanded their empires. You spent the last few years working for the Hutts, the Pykes, or the Crimson Dawn. You learned how to collect debts, how to take a hit from a vibro-blade, and how to project enough quiet menace to make people pay up without a fight.',
      _meta: {
        phase: 'departure',
        archetype: 'criminal',
        tone: 'violence, loyalty, underworld codes',
        proficiencies: ['Brawl (Physique)', 'Intimidate (Grit)', 'Endure (Physique)'],
        variability: 'Immovable heavy enforcer (Brawl/Endure) or terrifying interrogator/debt collector (Intimidate/Brawl)?',
      },
    },
    {
      id: 'post-war-tracker',
      title: 'The Post-War Tracker',
      symbol: 'Crosshair',
      imageUrl: '/assets/phase2/08-post-war-tracker.png',
      narrative: 'The end of the war created millions of refugees, deserters, and war criminals. The Empire and the Syndicates both put out massive bounties to clean up the mess. You took the hunter\'s creed, learning how to track a quarry across a dozen chaotic, war-torn star systems, and how to put a blaster bolt exactly where it needs to go to secure a live capture.',
      _meta: {
        phase: 'departure',
        archetype: 'hunter',
        tone: 'precision, obsession, unfinished war',
        proficiencies: ['Investigation (Wits)', 'Survival (Grit)', 'Ranged (Reflex)'],
        variability: 'Urban detective hunting leads (Investigation/Ranged) or relentless Outer Rim tracker (Survival/Ranged)?',
      },
    },
    {
      id: 'purge-survivor',
      title: 'The Purge Survivor',
      symbol: 'Severed Braid',
      imageUrl: '/assets/phase2/09-purge-survivor.png',
      narrative: 'Order 66 didn\'t just target the Jedi; the Empire immediately outlawed dozens of religions, academic orders, and political factions. You were part of a group that was declared treasonous the day the Empire was born. For three years, you have survived by hiding your true nature, trusting your instincts over your eyes, and learning how to disappear into a crowd.',
      _meta: {
        phase: 'departure',
        archetype: 'purged',
        tone: 'grief, hiding, something sacred lost',
        proficiencies: ['Sense (Wits)', 'Stealth (Reflex)', 'Deception (Presence)'],
        variability: 'Force-sensitive hiding their signature (Sense/Stealth) or purged political scholar under a fake identity (Deception/Stealth)?',
      },
    },
  ];

  var PHASE3_CARDS = [
    {
      id: 'hutt-marked',
      title: 'The Hutt-Marked',
      symbol: 'The Bounty',
      imageUrl: '/assets/phase3/01-hutt-marked.png',
      narrative: 'You don\'t just owe credits; you owe credits to a Hutt. The kind who doesn\'t use standard banking; they use B-tier hunters. You are "Huntable," and you carry a visible, coded scar (the Mark) that bounty hunters automatically recognize, meaning you are never truly anonymous.',
      _meta: {
        phase: 'debt',
        archetype: 'hunted',
        tone: 'debt, fear, criminal leverage',
        knackName: 'Escape Route',
        knackType: 'Automatic Success',
        knack: 'Once per session, you may force the GM to identify a safe Exit from any scene (a vent, a loose floor panel, an unguarded speeder), and you are guaranteed to reach it safely, provided you abandon the mission immediately.',
      },
    },
    {
      id: 'witness',
      title: 'The Witness',
      symbol: 'The Eye',
      imageUrl: '/assets/phase3/02-witness.png',
      narrative: 'You saw something. A secret Imperial research project, a high-level corporate assassination, or a hidden Jedi massacre. The knowledge you hold is lethal. A powerful organization (the Empire or a Megacorp) is hunting you — not to arrest you, but to erase you.',
      _meta: {
        phase: 'debt',
        archetype: 'witness',
        tone: 'dangerous knowledge, paranoia, silence',
        knackName: 'Cold Read',
        knackType: 'Passive Ability',
        knack: 'Once per scene, you can ask the GM one true question about an NPC\'s hidden motivations: "What are they afraid of?" or "Are they lying right now?" The GM must provide an honest, simple answer, which you read through observing their micro-expressions.',
      },
    },
    {
      id: 'traumatized',
      title: 'The Traumatized',
      symbol: 'The Shattered Star',
      imageUrl: '/assets/phase3/03-traumatized.png',
      narrative: 'The Clone Wars or the Pacification Campaigns didn\'t just happen; they broke you. You lost everyone. Now, you carry deep psychological scars. Certain sights, sounds, or smells are severe Triggers that cause you to physically panic or freeze.',
      _meta: {
        phase: 'debt',
        archetype: 'broken',
        tone: 'inner wound, triggers, survival guilt',
        knackName: 'Adrenaline Lock',
        knackType: 'Passive Ability',
        knack: 'Once per session, when an attack causes you to gain a Physique condition, you may immediately Step Up your raw strength or dexterity for that round. You automatically pass any test of raw lifting or running, but you gain a permanent Grit Condition after the adrenaline wears off.',
      },
    },
    {
      id: 'shadow-stalked',
      title: 'The Shadow-Stalked',
      symbol: 'The Echo',
      imageUrl: '/assets/phase3/04-shadow-stalked.png',
      narrative: 'You are sensitive to the Force, but you haven\'t had training since the Purge. Instead of guidance, you feel an unexplainable, persistent spiritual pressure — an Echo. It manifests as haunting premonitions of danger or the overwhelming sensation that something is tracking you through the currents of the universe.',
      _meta: {
        phase: 'debt',
        archetype: 'force-burdened',
        tone: 'Force sensitivity, pursuit, unwanted power',
        knackName: 'Prescience',
        knackType: 'Free Trigger',
        knack: 'Once per session, you can spend a Trigger to declare that you felt a disturbance seconds before it happened. You automatically dodge the very first attack aimed at you in a scene, or push an adjacent ally out of the blast zone — no roll required.',
      },
    },
    {
      id: 'defector',
      title: 'The Defector',
      symbol: 'The Broken Crest',
      imageUrl: '/assets/phase3/05-defector.png',
      narrative: 'You were part of the machine. You hold codes, keys, and transit protocols for a massive organization — the Imperial Military or a powerful Corporate Sector authority. If they ever find you, you will be executed for treason.',
      _meta: {
        phase: 'debt',
        archetype: 'defector',
        tone: 'treason, hunted by empire, fractured identity',
        knackName: 'Authority Bypass',
        knackType: 'Narrative Success',
        knack: 'Once per adventure, you can use outdated codes, uniforms, or forged transit papers to bypass a routine military or bureaucratic checkpoint without making a Deception or Persuasion check. Minor obstacles like street patrols are automatically cleared.',
      },
    },
    {
      id: 'debtor',
      title: 'The Debtor',
      symbol: 'The Scale',
      imageUrl: '/assets/phase3/06-debtor.png',
      narrative: 'You owe a debt, but not to a criminal syndicate. This is a debt of honor, a blood oath, or a massive amount of credits to a legitimate but relentless business entity (like the Banking Guild). Until it is paid, you have no home and are effectively indentured.',
      _meta: {
        phase: 'debt',
        archetype: 'indebted',
        tone: 'financial ruin, obligation, desperation',
        knackName: 'Collateral Access',
        knackType: 'Narrative Success',
        knack: 'Once per scene in a civilized settlement, you can leverage your high debt to acquire standard-issue gear or information (a datapad map, medpacs, a cheap blaster) from reputable vendors without credits. You always owe the vendor a favor in return.',
      },
    },
    {
      id: 'exile',
      title: 'The Exile',
      symbol: 'The Blast Door',
      imageUrl: '/assets/phase3/07-exile.png',
      narrative: 'You are forbidden from entering a specific region, planet, or organization on pain of death. You carry the stigma of Outcast. Whether purged from a religious sect, a disgraced political family, or a defeated mercenary company, you must keep your true identity hidden.',
      _meta: {
        phase: 'debt',
        archetype: 'exiled',
        tone: 'banishment, longing, forbidden return',
        knackName: 'Stigma Detection',
        knackType: 'Passive Ability',
        knack: 'You automatically recognize other exiles (even if they are hiding) and know the closest safe house in any planetary settlement, which will provide simple shelter and basic provisions to those in need.',
      },
    },
    {
      id: 'addiction',
      title: 'The Addiction',
      symbol: 'The Stim-Tube',
      imageUrl: '/assets/phase3/08-addiction.png',
      narrative: 'You are dependent on a specific stimulant, narcotic, or substance to function — possibly a legacy of war-time field meds or underworld coping. When you go for more than an adventure without the substance (going Dry), you suffer an automatic Step Down penalty to all Grit and Wits rolls, which cannot be healed with rest.',
      _meta: {
        phase: 'debt',
        archetype: 'dependent',
        tone: 'chemical dependency, weakness, hidden cost',
        knackName: 'The Fix',
        knackType: 'Narrative Success',
        knack: 'You have a permanent contact in any major settlement who will always supply your substance. Once per session, you can use the substance to gain Optimized (Step Up your Control Die) on your very next roll, representing a surge of chemically induced clarity or courage.',
      },
    },
    {
      id: 'false-identity',
      title: 'The False Identity',
      symbol: 'The Mask',
      imageUrl: '/assets/phase3/09-false-identity.png',
      narrative: 'The person you are now is a lie. Your original identity was erased during the Clone Wars, the Jedi Purge, or a massive corporate merger. You possess forged documentation, a false birth record, and a completely fabricated backstory. The real you is dead, and you must protect the mask at all costs.',
      _meta: {
        phase: 'debt',
        archetype: 'alias',
        tone: 'deception, buried past, fear of exposure',
        knackName: 'Identity Buffer',
        knackType: 'Passive Ability',
        knack: 'If an enemy attempts a social-based roll or uses the Force to read your past or identity, their result Tier is automatically Stepped Down by One. They only see the fabrication you have carefully built. This ability is always active.',
      },
    },
  ];

  var phaseCardState = {
    flipped: {},
  };

  var state = {
    species:   null,
    previewId: null,
    phase1:    null,
    phase2:    null,
    phase3:    null,
  };

  var carouselState = {
    current:     0,
    get total()  { return SPECIES.length; },
    touchStartX: 0,
    touchStartY: 0,
  };

  var characterSheet = {
    species:     null,
    arenas:      null,
    disciplines: [],
    abilities:   [],
  };

  /* ── Theme ─────────────────────────────────────────────────────────────── */

  function applyTheme(theme) {
    THEMES.forEach(function (t) { document.documentElement.classList.remove(t); });
    document.documentElement.classList.add(theme);
    localStorage.setItem(THEME_KEY, theme);
    var el = document.getElementById('theme-label');
    if (el) el.textContent = THEME_LABELS[theme] || theme;
  }

  function loadTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    applyTheme(stored && THEMES.indexOf(stored) !== -1 ? stored : DEFAULT_THEME);
  }

  /* ── Persistence ────────────────────────────────────────────────────────── */

  function saveState() {
    try { sessionStorage.setItem(CREATION_KEY, JSON.stringify(state)); } catch (_) {}
  }

  function loadSavedState() {
    try {
      var s = JSON.parse(sessionStorage.getItem(CREATION_KEY));
      if (s) Object.assign(state, s);
    } catch (_) {}
  }

  /* ── Carousel ───────────────────────────────────────────────────────────── */

  function buildCarousel() {
    var track  = document.getElementById('cc-track');
    var dotsEl = document.getElementById('cc-dots');
    if (!track) return;

    track.innerHTML  = '';
    if (dotsEl) dotsEl.innerHTML = '';

    SPECIES.forEach(function (sp, idx) {
      var slide = document.createElement('div');
      slide.className    = 'cc-slide';
      slide.dataset.index = idx;

      var perspective = document.createElement('div');
      perspective.className = 'cc-card-perspective';

      var flipper = document.createElement('div');
      flipper.className = 'cc-card-flipper';
      flipper.id        = 'flipper-' + sp.id;

      flipper.appendChild(buildCardFront(sp));
      flipper.appendChild(buildCardBack(sp));
      perspective.appendChild(flipper);
      slide.appendChild(perspective);
      track.appendChild(slide);

      if (dotsEl) {
        var dot = document.createElement('button');
        dot.className = 'cc-dot' + (idx === 0 ? ' cc-dot-active' : '');
        dot.setAttribute('aria-label', 'Go to ' + sp.name);
        dot.addEventListener('click', function () { goToSlide(idx); });
        dotsEl.appendChild(dot);
      }
    });

    setTrackPosition(0, false);
    renderStatsOverlay(false, null);
  }

  function buildCardFront(sp) {
    var face = document.createElement('div');
    face.className = 'cc-card-face cc-card-front';

    var imgWrap = document.createElement('div');
    imgWrap.className = 'cc-img-wrap';

    if (sp.imageUrl) {
      var img = document.createElement('img');
      img.src   = sp.imageUrl;
      img.alt   = sp.name;
      img.className = 'cc-img';
      img.onerror = function () { imgWrap.innerHTML = silhouetteHTML(sp.name); };
      imgWrap.appendChild(img);
    } else {
      imgWrap.innerHTML = silhouetteHTML(sp.name);
    }

    var info = document.createElement('div');
    info.className = 'cc-front-info';

    var nameEl = document.createElement('h3');
    nameEl.className   = 'cc-front-name';
    nameEl.textContent = sp.name;

    var tagEl = document.createElement('p');
    tagEl.className   = 'cc-front-tagline';
    tagEl.textContent = sp.tagline;

    var hintEl = document.createElement('p');
    hintEl.className   = 'cc-front-hint';
    hintEl.textContent = 'Tap to reveal details';

    info.appendChild(nameEl);
    info.appendChild(tagEl);
    info.appendChild(hintEl);
    face.appendChild(imgWrap);
    face.appendChild(info);

    face.addEventListener('click', function () { flipCard(sp.id); });
    return face;
  }

  function silhouetteHTML(name) {
    return '<div class="cc-silhouette"><span>' + esc(name.charAt(0)) + '</span></div>'
         + '<p class="cc-art-label">Art Pending</p>';
  }

  function buildCardBack(sp) {
    var face = document.createElement('div');
    face.className = 'cc-card-face cc-card-back';

    var backBtn = document.createElement('button');
    backBtn.className = 'cc-back-flip-btn';
    backBtn.innerHTML = '&larr; Flip Back';
    backBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      flipCard(sp.id);
    });

    var abilities = document.createElement('div');
    abilities.className = 'cc-abilities';

    abilities.appendChild(buildAbilityBlock(
      'Arena Shift', sp.arenaShift.name, sp.arenaShift.desc,
      buildArenaShiftPills(sp)
    ));
    abilities.appendChild(buildAbilityBlock(
      'Native Skill', sp.nativeSkill.name, sp.nativeSkill.desc,
      buildNativeSkillPills(sp)
    ));
    abilities.appendChild(buildAbilityBlock(
      'Narrative Permission', sp.biologicalTruth.name, sp.biologicalTruth.desc,
      null
    ));

    var selectBtn = document.createElement('button');
    selectBtn.className   = 'cc-select-btn';
    selectBtn.textContent = 'Select ' + sp.name + ' \u2192';
    selectBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      selectSpecies(sp);
    });

    face.appendChild(backBtn);
    face.appendChild(abilities);
    face.appendChild(selectBtn);
    return face;
  }

  function buildAbilityBlock(typeLabel, abilityName, desc, pillsEl) {
    var block = document.createElement('div');
    block.className = 'cc-ability-block';

    var typeEl = document.createElement('p');
    typeEl.className   = 'cc-ability-type';
    typeEl.textContent = typeLabel;

    var nameEl = document.createElement('p');
    nameEl.className   = 'cc-ability-name';
    nameEl.textContent = abilityName;

    var descEl = document.createElement('p');
    descEl.className   = 'cc-ability-desc';
    descEl.textContent = desc;

    block.appendChild(typeEl);
    block.appendChild(nameEl);
    if (pillsEl) block.appendChild(pillsEl);
    block.appendChild(descEl);
    return block;
  }

  function buildArenaShiftPills(sp) {
    var ups   = sp.arenaShift.stepUp;
    var downs = sp.arenaShift.stepDown;
    if (!ups.length && !downs.length) return null;

    var wrap = document.createElement('div');
    wrap.className = 'cc-pills';

    ups.forEach(function (s) {
      var p = document.createElement('span');
      p.className   = 'cc-pill cc-pill-up';
      p.textContent = '\u2191 ' + capitalize(s.arena) + ' \u2192 ' + s.die
                    + (s.note ? ' (' + s.note + ')' : '');
      wrap.appendChild(p);
    });

    downs.forEach(function (s) {
      var p = document.createElement('span');
      p.className   = 'cc-pill cc-pill-down';
      p.textContent = '\u2193 ' + capitalize(s.arena) + ' \u2192 ' + s.die;
      wrap.appendChild(p);
    });

    return wrap;
  }

  function buildNativeSkillPills(sp) {
    var skills = sp.nativeSkill.skills;
    if (!skills || !skills.length) return null;

    var wrap = document.createElement('div');
    wrap.className = 'cc-pills';

    if (sp.nativeSkill.choice) {
      var p = document.createElement('span');
      p.className   = 'cc-pill cc-pill-neutral';
      p.textContent = skills.map(function (s) {
        return s.name + (s.arena ? ' (' + s.arena + ')' : '') + ' ' + s.die;
      }).join(' or ');
      wrap.appendChild(p);
    } else {
      skills.forEach(function (s) {
        var p = document.createElement('span');
        p.className   = 'cc-pill cc-pill-neutral';
        p.textContent = s.name + (s.arena ? ' (' + s.arena + ')' : '') + ' \u2014 ' + s.die;
        wrap.appendChild(p);
      });
    }

    return wrap;
  }

  /* ── Carousel navigation ────────────────────────────────────────────────── */

  function setTrackPosition(idx, animate) {
    var track = document.getElementById('cc-track');
    if (!track) return;

    if (!animate) {
      track.style.transition = 'none';
      requestAnimationFrame(function () { track.style.transition = ''; });
    }

    track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    updateDots(idx);
  }

  function updateDots(idx) {
    document.querySelectorAll('.cc-dot').forEach(function (d, i) {
      d.classList.toggle('cc-dot-active', i === idx);
    });
  }

  function goToSlide(idx) {
    if (carouselState.current !== idx) {
      resetFlips();
      state.previewId = null;
    }
    carouselState.current = idx;
    setTrackPosition(idx, true);
  }

  function navigatePrev() {
    goToSlide((carouselState.current - 1 + carouselState.total) % carouselState.total);
  }

  function navigateNext() {
    goToSlide((carouselState.current + 1) % carouselState.total);
  }

  function resetFlips() {
    SPECIES.forEach(function (sp) {
      var flipper = document.getElementById('flipper-' + sp.id);
      if (flipper) flipper.classList.remove('cc-flipped');
    });
    renderStatsOverlay(false, null);
  }

  /* ── Card flip ──────────────────────────────────────────────────────────── */

  function flipCard(speciesId) {
    var flipper = document.getElementById('flipper-' + speciesId);
    if (!flipper) return;

    var nowFlipping = !flipper.classList.contains('cc-flipped');
    flipper.classList.toggle('cc-flipped');

    if (nowFlipping) {
      state.previewId = speciesId;
      var sp = SPECIES.find(function (s) { return s.id === speciesId; });
      if (sp) renderStatsOverlay(true, sp);
    } else {
      state.previewId = null;
      renderStatsOverlay(false, null);
    }
  }

  /* ── Touch / swipe ──────────────────────────────────────────────────────── */

  function initSwipe(el) {
    el.addEventListener('touchstart', function (e) {
      carouselState.touchStartX = e.touches[0].clientX;
      carouselState.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    el.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - carouselState.touchStartX;
      var dy = e.changedTouches[0].clientY - carouselState.touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx < 0) navigateNext();
        else navigatePrev();
      }
    }, { passive: true });
  }

  /* ── Stats overlay ──────────────────────────────────────────────────────── */

  function renderStatsOverlay(isPreview, sp) {
    var speciesName, arenas, disciplines, abilities;

    if (isPreview && sp) {
      speciesName  = sp.name + ' (preview)';
      arenas       = Object.assign({}, ARENA_BASELINE, sp.arenas);
      disciplines  = buildDisciplinesList(sp);
      abilities    = [sp.biologicalTruth.name];
    } else if (characterSheet.species) {
      speciesName  = characterSheet.species;
      arenas       = characterSheet.arenas;
      disciplines  = characterSheet.disciplines;
      abilities    = characterSheet.abilities;
    } else {
      speciesName  = 'Pending';
      arenas       = Object.assign({}, ARENA_BASELINE);
      disciplines  = [];
      abilities    = [];
    }

    var speciesEl = document.getElementById('cc-stats-species');
    if (speciesEl) {
      speciesEl.textContent = speciesName;
      speciesEl.style.color = isPreview
        ? 'var(--color-accent-secondary)'
        : (characterSheet.species ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)');
    }

    var arenasEl = document.getElementById('cc-stats-arenas');
    if (arenasEl) {
      arenasEl.innerHTML = '';
      ARENA_ORDER.forEach(function (key) {
        var die      = arenas[key];
        var baseIdx  = DIE_ORDER.indexOf(ARENA_BASELINE[key]);
        var dieIdx   = DIE_ORDER.indexOf(die);
        var dir      = dieIdx > baseIdx ? 'up' : (dieIdx < baseIdx ? 'down' : 'base');

        var row    = document.createElement('div');
        row.className = 'cc-stats-arena-row';

        var label  = document.createElement('span');
        label.className   = 'cc-stats-arena-label';
        label.textContent = ARENA_LABELS[key];

        var dieEl  = document.createElement('span');
        dieEl.className   = 'cc-stats-arena-die' + (dir !== 'base' ? ' cc-die-' + dir : '');
        dieEl.textContent = die + (dir === 'up' ? ' \u2191' : dir === 'down' ? ' \u2193' : '');

        row.appendChild(label);
        row.appendChild(dieEl);
        arenasEl.appendChild(row);
      });
    }

    setStatSection('cc-stats-disciplines-wrap', 'cc-stats-disciplines', disciplines);
    setStatSection('cc-stats-abilities-wrap',   'cc-stats-abilities',   abilities);
  }

  function setStatSection(wrapId, listId, items) {
    var wrap = document.getElementById(wrapId);
    var list = document.getElementById(listId);
    if (!wrap || !list) return;

    if (items && items.length) {
      wrap.classList.remove('hidden');
      list.innerHTML = '';
      items.forEach(function (item) {
        var p = document.createElement('p');
        p.className   = 'cc-stats-list-item';
        p.textContent = item;
        list.appendChild(p);
      });
    } else {
      wrap.classList.add('hidden');
    }
  }

  function buildDisciplinesList(sp) {
    var skills = sp.nativeSkill.skills || [];
    if (!skills.length) return [];

    if (sp.nativeSkill.choice && !skills[0].choice) {
      return ['Choose: ' + skills.map(function (s) {
        return s.name + (s.arena ? ' (' + s.arena + ')' : '') + ' \u2014 ' + s.die;
      }).join(' or ')];
    }

    if (skills[0].choice) {
      return ['Any Skill (player choice) \u2014 ' + skills[0].die];
    }

    return skills.map(function (s) {
      return s.name + (s.arena ? ' (' + s.arena + ')' : '') + ' \u2014 ' + s.die;
    });
  }

  /* ── Phase card grid ────────────────────────────────────────────────────── */

  function buildPhaseGrid(cards, containerId, selectFn) {
    var grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = '';

    cards.forEach(function (card) {
      grid.appendChild(buildPhaseCard(card, selectFn));
    });
  }

  function buildPhaseCard(card, selectFn) {
    var wrapper = document.createElement('div');
    wrapper.className = 'ph-card-wrap';

    var perspective = document.createElement('div');
    perspective.className = 'ph-perspective';

    var inner = document.createElement('div');
    inner.className = 'ph-card-inner';
    inner.id        = 'ph-inner-' + card.id;

    inner.appendChild(buildPhaseCardFront(card));
    inner.appendChild(buildPhaseCardBack(card, selectFn));

    perspective.appendChild(inner);
    wrapper.appendChild(perspective);
    return wrapper;
  }

  function buildPhaseCardFront(card) {
    var face = document.createElement('div');
    face.className = 'ph-card-face ph-card-front';

    var img = document.createElement('img');
    img.src       = card.imageUrl;
    img.alt       = card.title;
    img.className = 'ph-card-img';

    face.appendChild(img);
    face.addEventListener('click', function () { flipPhaseCard(card.id); });
    return face;
  }

  function buildPhaseCardBack(card, selectFn) {
    var face = document.createElement('div');
    face.className = 'ph-card-face ph-card-back';

    var backBtn = document.createElement('button');
    backBtn.className   = 'ph-back-btn';
    backBtn.innerHTML   = '&larr;';
    backBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      flipPhaseCard(card.id);
    });

    var narrative = document.createElement('p');
    narrative.className   = 'ph-narrative';
    narrative.textContent = card.narrative;

    var selectBtn = document.createElement('button');
    selectBtn.className   = 'ph-select-btn';
    selectBtn.textContent = 'Choose This \u2192';
    selectBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      selectFn(card);
    });

    face.appendChild(backBtn);
    face.appendChild(narrative);
    face.appendChild(selectBtn);
    return face;
  }

  function flipPhaseCard(cardId) {
    var inner = document.getElementById('ph-inner-' + cardId);
    if (!inner) return;
    phaseCardState.flipped[cardId] = !phaseCardState.flipped[cardId];
    inner.classList.toggle('ph-flipped', !!phaseCardState.flipped[cardId]);
  }

  function resetPhaseFlips() {
    Object.keys(phaseCardState.flipped).forEach(function (id) {
      phaseCardState.flipped[id] = false;
      var inner = document.getElementById('ph-inner-' + id);
      if (inner) inner.classList.remove('ph-flipped');
    });
  }

  function selectPhase1(card) {
    state.phase1 = card.id;
    saveState();
    resetPhaseFlips();
    showScreen('phase2');
    updateStepTrack(2);
  }

  function selectPhase2(card) {
    state.phase2 = card.id;
    saveState();
    resetPhaseFlips();
    showScreen('phase3');
    updateStepTrack(3);
  }

  function selectPhase3(card) {
    state.phase3 = card.id;
    saveState();
    showSummary();
  }

  /* ── Summary overlay ────────────────────────────────────────────────────── */

  function showSummary() {
    var overlay = document.getElementById('cc-summary-overlay');
    if (!overlay) return;
    buildSummaryContent(overlay);
    overlay.classList.remove('hidden');
  }

  function buildSummaryContent(overlay) {
    var sp = SPECIES.find(function (s) { return s.id === state.species; });
    var p1 = PHASE1_CARDS.find(function (c) { return c.id === state.phase1; });
    var p2 = PHASE2_CARDS.find(function (c) { return c.id === state.phase2; });
    var p3 = PHASE3_CARDS.find(function (c) { return c.id === state.phase3; });

    var body = overlay.querySelector('.sum-body');
    if (!body) return;
    body.innerHTML = '';

    body.appendChild(buildSumSection('Species', sp ? [
      sumRow('Name',       sp.name),
      sumRow('Tagline',    sp.tagline),
      sumRow('Arena Shift', sp.arenaShift.name + ' — ' + sp.arenaShift.desc),
      sumRow('Native Skill', sp.nativeSkill.name + ' — ' + sp.nativeSkill.desc),
      sumRow('Narrative Permission', sp.biologicalTruth.name + ' — ' + sp.biologicalTruth.desc),
      sumRow('Arenas', Object.keys(sp.arenas).map(function (k) {
        return k.charAt(0).toUpperCase() + k.slice(1) + ': ' + sp.arenas[k];
      }).join(' · ')),
      sumRow('AI Lore Anchors', sp._aiMeta.loreAnchors.join(' / ')),
      sumRow('AI Directives',   sp._aiMeta.directives),
    ] : [sumRow('Status', 'Not selected')]));

    body.appendChild(buildSumSection('Phase 1 — The Dust (Origin)', p1 ? [
      sumRow('Card',        p1.title),
      sumRow('Symbol',      p1.symbol),
      sumRow('Narrative',   p1.narrative),
      sumRow('Environment', p1._meta.environment),
      sumRow('Tone',        p1._meta.tone),
      sumRow('Themes',      p1._meta.themes.join(', ')),
    ] : [sumRow('Status', 'Not selected')]));

    body.appendChild(buildSumSection('Phase 2 — The Departure (Catalyst)', p2 ? [
      sumRow('Card',         p2.title),
      sumRow('Symbol',       p2.symbol),
      sumRow('Narrative',    p2.narrative),
      sumRow('Archetype',    p2._meta.archetype),
      sumRow('Tone',         p2._meta.tone),
      sumRow('Proficiencies (pick 2)', p2._meta.proficiencies.join(' · ')),
      sumRow('Variability',  p2._meta.variability),
    ] : [sumRow('Status', 'Not selected')]));

    body.appendChild(buildSumSection('Phase 3 — The Debt (Adversity)', p3 ? [
      sumRow('Card',       p3.title),
      sumRow('Symbol',     p3.symbol),
      sumRow('Narrative',  p3.narrative),
      sumRow('Archetype',  p3._meta.archetype),
      sumRow('Tone',       p3._meta.tone),
      sumRow('Knack',      p3._meta.knackName + ' (' + p3._meta.knackType + ')'),
      sumRow('Knack Desc', p3._meta.knack),
    ] : [sumRow('Status', 'Not selected')]));
  }

  function buildSumSection(title, rows) {
    var section = document.createElement('div');
    section.className = 'sum-section';

    var h = document.createElement('h3');
    h.className   = 'sum-section-title';
    h.textContent = title;
    section.appendChild(h);

    rows.forEach(function (row) { section.appendChild(row); });
    return section;
  }

  function sumRow(label, value) {
    var row = document.createElement('div');
    row.className = 'sum-row';

    var l = document.createElement('span');
    l.className   = 'sum-label';
    l.textContent = label;

    var v = document.createElement('span');
    v.className   = 'sum-value';
    v.textContent = value || '—';

    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  /* ── Species selection ──────────────────────────────────────────────────── */

  function selectSpecies(sp) {
    state.species   = sp.id;
    state.previewId = null;
    saveState();

    characterSheet.species     = sp.name;
    characterSheet.arenas      = Object.assign({}, ARENA_BASELINE, sp.arenas);
    characterSheet.disciplines = buildDisciplinesList(sp);
    characterSheet.abilities   = [sp.biologicalTruth.name];

    renderStatsOverlay(false, null);
    showScreen('phase1');
    updateStepTrack(1);
  }

  /* ── Screen management ──────────────────────────────────────────────────── */

  function showScreen(id) {
    document.querySelectorAll('[id^="screen-"]').forEach(function (s) {
      s.classList.add('hidden');
    });
    var el = document.getElementById('screen-' + id);
    if (el) el.classList.remove('hidden');
  }

  function updateStepTrack(activeIdx) {
    document.querySelectorAll('.cc-step-pip').forEach(function (pip, i) {
      pip.classList.toggle('cc-pip-active', i === activeIdx);
      pip.classList.toggle('cc-pip-done',   i < activeIdx);
    });
  }

  /* ── Stats overlay toggle ───────────────────────────────────────────────── */

  function initStatsToggle() {
    var btn  = document.getElementById('cc-stats-toggle');
    var body = document.getElementById('cc-stats-body');
    if (!btn || !body) return;

    var collapsed = false;
    btn.addEventListener('click', function () {
      collapsed = !collapsed;
      body.classList.toggle('hidden', collapsed);
      btn.innerHTML = collapsed ? '&#43;' : '&#8722;';
    });
  }

  /* ── Utilities ──────────────────────────────────────────────────────────── */

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /* ── Init ───────────────────────────────────────────────────────────────── */

  function init() {
    loadTheme();
    loadSavedState();

    var themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', function () {
        var current = THEMES.find(function (t) {
          return document.documentElement.classList.contains(t);
        }) || DEFAULT_THEME;
        applyTheme(THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
      });
    }

    buildCarousel();
    buildPhaseGrid(PHASE1_CARDS, 'ph-grid-phase1', selectPhase1);
    buildPhaseGrid(PHASE2_CARDS, 'ph-grid-phase2', selectPhase2);
    buildPhaseGrid(PHASE3_CARDS, 'ph-grid-phase3', selectPhase3);

    var prevBtn = document.getElementById('carousel-prev');
    var nextBtn = document.getElementById('carousel-next');
    if (prevBtn) prevBtn.addEventListener('click', navigatePrev);
    if (nextBtn) nextBtn.addEventListener('click', navigateNext);

    var viewport = document.getElementById('cc-viewport');
    if (viewport) initSwipe(viewport);

    var backToSpecies = document.getElementById('btn-back-to-species');
    if (backToSpecies) {
      backToSpecies.addEventListener('click', function () {
        showScreen('species');
        updateStepTrack(0);
      });
    }

    var backToPhase1 = document.getElementById('btn-back-to-phase1');
    if (backToPhase1) {
      backToPhase1.addEventListener('click', function () {
        showScreen('phase1');
        updateStepTrack(1);
      });
    }

    var backToPhase2 = document.getElementById('btn-back-to-phase2');
    if (backToPhase2) {
      backToPhase2.addEventListener('click', function () {
        showScreen('phase2');
        updateStepTrack(2);
      });
    }

    var sumClose = document.getElementById('btn-sum-close');
    if (sumClose) {
      sumClose.addEventListener('click', function () {
        document.getElementById('cc-summary-overlay').classList.add('hidden');
      });
    }

    initStatsToggle();

    if (state.species) {
      var sp = SPECIES.find(function (s) { return s.id === state.species; });
      if (sp) {
        characterSheet.species     = sp.name;
        characterSheet.arenas      = Object.assign({}, ARENA_BASELINE, sp.arenas);
        characterSheet.disciplines = buildDisciplinesList(sp);
        characterSheet.abilities   = [sp.biologicalTruth.name];
        renderStatsOverlay(false, null);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
