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
      _meta: { environment: 'outer-rim-desert', locationHints: ['Jakku', 'Jedha', 'Arvala-7', 'Florrum', 'Abafar'], tone: 'isolation, self-reliance, frontier survival', themes: ['resource scarcity', 'independence', 'frontier justice'], favored: 'Survival (Grit)' },
    },
    {
      id: 'shadowed-levels',
      title: 'The Shadowed Levels',
      symbol: 'Sabacc Chip',
      imageUrl: '/assets/phase1/02-shadowed-levels.png',
      narrative: 'You were raised in the underlevels — where the lights of the upper city are just a rumor and debts are paid in blood or service. You learned to read people before you could read a holomap, and you know that every deal has a hidden clause. Trust is a currency you spend carefully.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linejoin="round"><polygon points="50,10 85,30 85,70 50,90 15,70 15,30"/><polygon points="50,22 75,37 75,63 50,78 25,63 25,37"/><rect x="42" y="40" width="16" height="20"/><line x1="42" y1="45" x2="58" y2="45"/><line x1="42" y1="55" x2="58" y2="55"/></svg>',
      _meta: { environment: 'urban-underworld', locationHints: ['Nar Shaddaa', 'Ord Mantell', 'Daiyu', 'Corellia', 'Nal Hutta'], tone: 'cunning, distrust, survival by wit', themes: ['class divide', 'criminal networks', 'street smarts'], favored: 'Stealth (Reflex)' },
    },
    {
      id: 'salvage-yards',
      title: 'The Salvage Yards',
      symbol: 'Hydrospanner',
      imageUrl: '/assets/phase1/03-salvage-yards.png',
      narrative: 'Every ship that flies was once someone\'s wreck. You grew up knee-deep in that wreckage — pulling circuits from crashed freighters, selling scrap to keep the lights on. Machines tell you their secrets if you know how to listen. You\'ve built survival from the galaxy\'s trash.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M 65 20 C 80 20 85 35 75 45 L 40 80 C 35 85 25 85 20 80 C 15 75 15 65 20 60 L 55 25 C 65 15 80 20 65 20 Z"/><line x1="78" y1="22" x2="60" y2="40"/><line x1="35" y1="65" x2="45" y2="75"/><circle cx="28" cy="72" r="3" fill="currentColor"/></svg>',
      _meta: { environment: 'junkyard-planet', locationHints: ['Bracca', 'Raxus Prime', 'Lotho Minor', 'Agaris'], tone: 'resourcefulness, ingenuity, underdog grit', themes: ['mechanical aptitude', 'poverty', 'found family'], favored: 'Tech (Wits)' },
    },
    {
      id: 'coreward-spires',
      title: 'The Coreward Spires',
      symbol: 'Senate Crest',
      imageUrl: '/assets/phase1/04-coreward-spires.png',
      narrative: 'You had everything the Empire promised — spires that touched the clouds, an education that opened doors, and a family name worth something. Then you saw what that system cost the rest of the galaxy. Some fled privilege in guilt; others were pushed out when their usefulness expired.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><circle cx="50" cy="28" r="10"/><line x1="50" y1="38" x2="50" y2="52"/><line x1="28" y1="52" x2="72" y2="52"/><line x1="28" y1="52" x2="28" y2="78"/><line x1="72" y1="52" x2="72" y2="78"/><line x1="18" y1="78" x2="82" y2="78"/><path d="M 28 52 Q 50 38 72 52" stroke-width="2"/><circle cx="50" cy="28" r="4" fill="currentColor" stroke="none"/></svg>',
      _meta: { environment: 'core-world-city', locationHints: ['Chandrila', 'Hosnian Prime', 'Corellia', 'Alsakan', 'Kuat'], tone: 'privilege, disillusionment, insider knowledge', themes: ['political intrigue', 'Imperial complicity', 'fallen status'], favored: 'Persuasion (Presence)' },
    },
    {
      id: 'agrarian-plain',
      title: 'The Agrarian Plain',
      symbol: 'Moisture Vaporator',
      imageUrl: '/assets/phase1/05-agrarian-plain.png',
      narrative: 'You come from working land — rows of crops, communal tables, and seasons that ruled your calendar. Your community survived by cooperation and quiet resilience. The Empire took the harvest and left the labor. That memory of something worth protecting is why you fight.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><line x1="50" y1="12" x2="50" y2="78"/><ellipse cx="50" cy="26" rx="18" ry="5"/><ellipse cx="50" cy="40" rx="12" ry="4"/><line x1="34" y1="62" x2="66" y2="62"/><line x1="28" y1="70" x2="72" y2="70"/><line x1="10" y1="86" x2="90" y2="86"/><line x1="5" y1="93" x2="95" y2="93" stroke-width="2"/></svg>',
      _meta: { environment: 'farming-world', locationHints: ['Dantooine', 'Lothal', 'Lah\'mu', 'Raada', 'Saleucami'], tone: 'community, loss, humble origins', themes: ['Imperial taxation', 'rural displacement', 'agrarian values'], favored: 'Resolve (Grit)' },
    },
    {
      id: 'war-front',
      title: 'The War Front',
      symbol: 'Blaster Pistol',
      imageUrl: '/assets/phase1/06-war-front.png',
      narrative: 'Peace is something other people talk about. You grew up in the sound of it — distant artillery, rationed water, the faces of soldiers cycling through. War was the weather of your childhood. You learned to read threat before you learned to read a face. You are very, very hard to surprise.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M 18 44 L 64 44 L 74 34 L 80 34 L 80 56 L 64 56 L 18 56 Z"/><line x1="80" y1="45" x2="94" y2="45"/><rect x="28" y="56" width="14" height="18"/><line x1="18" y1="50" x2="26" y2="50"/></svg>',
      _meta: { environment: 'conflict-zone', locationHints: ['Mimban', 'Onderon', 'Christophsis', 'Umbara', 'Ryloth'], tone: 'hardened, vigilant, combat-shaped', themes: ['military exposure', 'PTSD', 'tactical instinct'], favored: 'Evasion (Reflex)' },
    },
    {
      id: 'ancient-ruin',
      title: 'The Ancient Ruin',
      symbol: 'Broken Arch',
      imageUrl: '/assets/phase1/07-ancient-ruin.png',
      narrative: 'Your home was built on something older — crumbled temples, inscriptions no living scholar could read, and a persistent feeling that the air itself was watching. You grew up chasing questions no one could answer. Whatever the old civilization left behind, a fragment of it lodged in you.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><line x1="18" y1="84" x2="18" y2="44"/><line x1="82" y1="84" x2="82" y2="44"/><path d="M 18 44 Q 50 8 82 44"/><line x1="30" y1="32" x2="36" y2="24" stroke-width="2"/><line x1="64" y1="30" x2="70" y2="22" stroke-width="2"/><line x1="8" y1="86" x2="92" y2="86"/><rect x="12" y="75" width="10" height="11"/><rect x="78" y="70" width="8" height="16"/></svg>',
      _meta: { environment: 'ancient-nexus-world', locationHints: ['Jedha', 'Tython', 'Malachor', 'Dathomir', 'Ilum'], tone: 'curiosity, mysticism, inherited mystery', themes: ['Force adjacency', 'lost civilization', 'archaeology'], favored: 'Investigation (Wits)' },
    },
    {
      id: 'trading-post',
      title: 'The Trading Post',
      symbol: 'Navigation Beacon',
      imageUrl: '/assets/phase1/08-trading-post.png',
      narrative: 'Where routes cross, everything flows — goods, gossip, fugitives, and opportunity. You grew up at the intersection, learning a dozen languages before adulthood and the art of the deal before you could pilot. You know that information is the most valuable cargo in the galaxy.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><circle cx="50" cy="50" r="20"/><circle cx="50" cy="50" r="34" stroke-width="2" stroke-dasharray="5,4"/><line x1="50" y1="10" x2="50" y2="30"/><line x1="90" y1="50" x2="70" y2="50"/><line x1="50" y1="90" x2="50" y2="70"/><line x1="10" y1="50" x2="30" y2="50"/><circle cx="50" cy="50" r="5" fill="currentColor" stroke="none"/></svg>',
      _meta: { environment: 'spaceport-crossroads', locationHints: ['Takodana', 'Batuu', 'Ord Mantell', 'Eriadu', 'Akiva'], tone: 'cosmopolitan, opportunistic, multilingual', themes: ['trade networks', 'cultural exposure', 'information brokering'], favored: 'Insight (Presence)' },
    },
    {
      id: 'detention-block',
      title: 'The Detention Block',
      symbol: 'Cell Bars',
      imageUrl: '/assets/phase1/09-detention-block.png',
      narrative: 'You were born into a cage — not always made of durasteel. Labor camp, indentured service, political imprisonment, or simply the wrong bloodline at the wrong time. The Empire taught you exactly what it was through direct experience. Freedom, when it came, felt like a weapon handed to you.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round"><rect x="15" y="14" width="70" height="72"/><line x1="30" y1="14" x2="30" y2="86"/><line x1="45" y1="14" x2="45" y2="86"/><line x1="60" y1="14" x2="60" y2="86"/><line x1="75" y1="14" x2="75" y2="86"/><circle cx="8" cy="50" r="6"/><line x1="14" y1="50" x2="15" y2="50" stroke-width="3"/></svg>',
      _meta: { environment: 'imperial-detention', locationHints: ['Wobani', 'Kessel', 'Stygeon Prime', 'Kashyyyk', 'Naraka'], tone: 'defiance, trauma, hard-won freedom', themes: ['forced labor', 'Imperial oppression', 'escape and survival'], favored: 'Endure (Physique)' },
    },
    {
      id: 'shipboard-born',
      title: 'The Shipboard Born',
      symbol: 'Cockpit View',
      imageUrl: '/assets/phase1/10-shipboard-born.png',
      narrative: 'You were born between jumps, raised in the hold of a freighter, and taught to read a navcomputer before you could read Basic. Ships aren\u0027t transportation to you \u2014 they\u0027re the only home you\u0027ve ever had. The stars don\u0027t frighten you. The ground does.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="20" width="80" height="55" rx="6"/><polyline points="10,40 28,28 72,28 90,40"/><line x1="50" y1="20" x2="50" y2="75"/><ellipse cx="50" cy="52" rx="14" ry="10"/><circle cx="50" cy="52" r="4" fill="currentColor"/></svg>',
      _meta: { environment: 'deep-space-freighter', locationHints: ['Rishi', 'Vandor', 'Ring of Kafrene', 'Terminus', 'Burnin Konn'], tone: 'wanderlust, belonging, the void as home', themes: ['life in transit', 'found family', 'hyperspace routes'], favored: 'Piloting (Reflex)' },
    },
    {
      id: 'labor-camp',
      title: 'The Labor Camp',
      symbol: 'Pickaxe and Tally',
      imageUrl: '/assets/phase1/11-labor-camp.png',
      narrative: 'You were a number on a corporate extraction ledger. Whether conscripted, sold into indentured service, or simply born on the wrong side of a mining contract, you spent your formative years breaking your back for quotas that were never going to be met. Your body knows pain. Your mind knows how to keep going anyway.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="20" y1="80" x2="75" y2="25"/><path d="M60,15 C70,5 90,8 88,22 L72,28"/><path d="M15,75 C5,85 8,95 22,93 L28,77"/><line x1="60" y1="60" x2="78" y2="60"/><line x1="60" y1="68" x2="78" y2="68"/><line x1="60" y1="76" x2="78" y2="76"/><line x1="60" y1="84" x2="72" y2="84"/></svg>',
      _meta: { environment: 'corporate-mining-site', locationHints: ['Kessel', 'Mustafar', 'Wobani', 'Seelos', 'Cynda'], tone: 'endurance, resentment, physical grit', themes: ['forced labor', 'corporate exploitation', 'survival under duress'], favored: 'Athletics (Physique)' },
    },
    {
      id: 'enclave',
      title: 'The Enclave',
      symbol: 'The Sealed Door',
      imageUrl: '/assets/phase1/12-enclave.png',
      narrative: 'You were raised inside something closed \u2014 a religious order, a hidden commune, a survivalist sect, or the remnant of an ancient tradition that survived by going silent. Inside, there was belonging and purpose. Outside was danger. When you finally crossed the threshold, the galaxy felt enormous and hostile in equal measure.',
      svg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="38"/><circle cx="50" cy="50" r="26"/><circle cx="50" cy="50" r="14"/><circle cx="50" cy="50" r="4" fill="currentColor"/><line x1="50" y1="12" x2="50" y2="24"/><line x1="50" y1="76" x2="50" y2="88"/><line x1="12" y1="50" x2="24" y2="50"/><line x1="76" y1="50" x2="88" y2="50"/></svg>',
      _meta: { environment: 'hidden-community', locationHints: ['Jedha', 'Bardotta', 'Lothal', 'Atollon', 'Lira San'], tone: 'belonging, isolation, threshold crossing', themes: ['tradition and heresy', 'secret knowledge', 'cult of community'], favored: 'Charm (Presence)' },
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
        favored: 'Tactics (Wits)',
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
        favored: 'Ranged (Reflex)',
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
        favored: 'Deception (Presence)',
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
        favored: 'Piloting (Reflex)',
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
        favored: 'Survival (Grit)',
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
        favored: 'Medicine (Wits)',
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
        favored: 'Intimidate (Grit)',
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
        favored: 'Investigation (Wits)',
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
        favored: 'Stealth (Reflex)',
        variability: 'Force-sensitive hiding their signature (Sense/Stealth) or purged political scholar under a fake identity (Deception/Stealth)?',
      },
    },
    {
      id: 'wreck',
      title: 'The Wreck',
      symbol: 'Hull Break',
      imageUrl: '/assets/phase2/10-wreck.png',
      narrative: 'Something catastrophic happened \u2014 a ship destroyed, a convoy ambushed, a convoy gone silent in the void. You were one of the only survivors, dragged out of the debris by luck or will alone. The wreck changed the trajectory of everything. What you lost there is still with you.',
      _meta: {
        phase: 'departure',
        archetype: 'survivor',
        tone: 'survivor guilt, resilience, haunted purpose',
        proficiencies: ['Endure (Physique)', 'Tech (Wits)', 'Survival (Grit)'],
        favored: 'Endure (Physique)',
        variability: 'Engineer who kept the ship alive long enough (Tech/Endure) or gunner who survived the hull breach (Survival/Endure)?',
      },
    },
    {
      id: 'ascent',
      title: 'The Ascent',
      symbol: 'Rising Rank',
      imageUrl: '/assets/phase2/11-ascent.png',
      narrative: 'You climbed. Whether through the Imperial ranks, a corporate hierarchy, or a criminal syndicate\u0027s chain of command, you earned real power \u2014 and then burned it all down on your way out. You know how institutions work from the inside. You know exactly where the cracks are.',
      _meta: {
        phase: 'departure',
        archetype: 'fallen-officer',
        tone: 'authority, ambition, purposeful fall',
        proficiencies: ['Tactics (Wits)', 'Deception (Presence)', 'Persuasion (Presence)'],
        favored: 'Persuasion (Presence)',
        variability: 'Former Imperial officer with codes and contacts (Tactics/Deception) or syndicate lieutenant who went independent (Persuasion/Tactics)?',
      },
    },
    {
      id: 'betrayal',
      title: 'The Betrayal',
      symbol: 'The Knife Behind',
      imageUrl: '/assets/phase2/12-betrayal.png',
      narrative: 'Someone you trusted set you up. A partner, a commanding officer, a patron \u2014 someone who smiled while selling you out. You survived what they arranged for you, and now you carry two things everywhere: the lesson, and the debt. Trust is not something you give freely anymore.',
      _meta: {
        phase: 'departure',
        archetype: 'burned-agent',
        tone: 'distrust, vengeance, hard-won paranoia',
        proficiencies: ['Insight (Wits)', 'Stealth (Reflex)', 'Skulduggery (Reflex)'],
        favored: 'Insight (Wits)',
        variability: 'Intelligence operative burned by their handler (Insight/Deception) or soldier set up by their lieutenant (Skulduggery/Stealth)?',
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
    {
      id: 'notorious',
      title: 'The Notorious',
      symbol: 'The Name',
      imageUrl: '/assets/phase3/10-notorious.png',
      narrative: 'You have a reputation that travels faster than you do. Whether earned through deeds, infamy, or someone else\u0027s story about you, your name carries weight in the right rooms and danger in the wrong ones. The galaxy has already decided who you are. You\u0027re still figuring out whether to live up to it or bury it.',
      _meta: {
        phase: 'debt',
        archetype: 'known-figure',
        tone: 'infamy, identity, the cost of being known',
        knackName: 'The Name',
        knackType: 'Active Ability',
        knack: 'Once per session, you may invoke your reputation directly. Drop your real name or known alias into a social confrontation to automatically Step Up your Persuasion or Intimidation die for that roll. However, every use permanently updates the intelligence trail: the GM may introduce a new complication, bounty hunter contact, or Imperial flag tied to that invocation before the next session.',
      },
    },
    {
      id: 'blood-price',
      title: 'The Blood Price',
      symbol: 'The Handprint',
      imageUrl: '/assets/phase3/11-blood-price.png',
      narrative: 'Someone paid for your freedom, your survival, or your escape \u2014 and the cost was something you can\u0027t repay. It might have been their life, their safety, or everything they had. You are here because they aren\u0027t. That debt doesn\u0027t dissolve. It compounds.',
      _meta: {
        phase: 'debt',
        archetype: 'survivor-indebted',
        tone: 'guilt, obligation, chosen sacrifice',
        knackName: 'Dead Reckoning',
        knackType: 'Active Ability',
        knack: 'Once per session, when an ally would gain a Condition (physical or mental) from any source, you may choose to absorb it yourself instead. You take the Condition in full. The ally is spared entirely. This cannot be used on yourself.',
      },
    },
    {
      id: 'hunted',
      title: 'The Hunted',
      symbol: 'Predator Eyes',
      imageUrl: '/assets/phase3/12-hunted.png',
      narrative: 'Something is tracking you. Not the Empire in the broad bureaucratic sense \u2014 something specific, patient, and personal. An Inquisitor with a fixation. A bounty hunter with a decades-old contract. A crime lord who took your escape as an insult. You don\u0027t know when it will arrive. You only know it will.',
      _meta: {
        phase: 'debt',
        archetype: 'hunted-personal',
        tone: 'paranoia, animal awareness, the weight of being prey',
        knackName: 'Prey Sense',
        knackType: 'Passive Ability',
        knack: 'At the start of each new location or settlement, you may ask the GM one yes-or-no question: "Is my hunter, or someone working for them, present in this location right now?" The GM must answer honestly. This does not reveal their position or identity, only their presence.',
      },
    },
  ];

  var phaseCardState = {
    flipped: {},
  };

  var state = {
    species:        null,
    previewId:      null,
    phase1:         null,
    phase2:         null,
    phase3:         null,
    arenaAdj:       {},
    discValues:     {},
    discIncomp:     {},
    spentRegAdv:    0,
    enhancedAdvUsed: 0,
    kitChoices:      {},
    startingGear:    [],
    destiny:         null,
    charName:        '',
    charTitle:       '',
    charGender:      'Male',
    backstory:       '',
    editId:          null,
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

  /* ── Arenas & Disciplines step ───────────────────────────────────── */

  var DISCIPLINES_BY_ARENA = [
    { id: 'physique', name: 'Physique', disciplines: [
      { id: 'athletics',     name: 'Athletics' },
      { id: 'brawl',         name: 'Brawl' },
      { id: 'endure',        name: 'Endure' },
      { id: 'melee',         name: 'Melee' },
      { id: 'heavy_weapons', name: 'Heavy Weapons' },
    ]},
    { id: 'reflex', name: 'Reflex', disciplines: [
      { id: 'evasion',       name: 'Evasion' },
      { id: 'piloting',      name: 'Piloting' },
      { id: 'ranged',        name: 'Ranged' },
      { id: 'skulduggery',   name: 'Skulduggery' },
      { id: 'stealth',       name: 'Stealth' },
    ]},
    { id: 'grit', name: 'Grit', disciplines: [
      { id: 'beast_handling', name: 'Beast Handling' },
      { id: 'intimidate',    name: 'Intimidate' },
      { id: 'resolve',       name: 'Resolve' },
      { id: 'survival',      name: 'Survival' },
      { id: 'control_spark',  name: 'Control',       force: true },
    ]},
    { id: 'wits', name: 'Wits', disciplines: [
      { id: 'investigation', name: 'Investigation' },
      { id: 'medicine',      name: 'Medicine' },
      { id: 'tactics',       name: 'Tactics' },
      { id: 'tech',          name: 'Tech' },
      { id: 'sense_spark',    name: 'Sense',         force: true },
    ]},
    { id: 'presence', name: 'Presence', disciplines: [
      { id: 'charm',         name: 'Charm' },
      { id: 'deception',     name: 'Deception' },
      { id: 'insight',       name: 'Insight' },
      { id: 'persuasion',    name: 'Persuasion' },
      { id: 'alter_spark',    name: 'Alter',         force: true },
    ]},
  ];

  var DIE_STEPS            = ['D4', 'D6', 'D8', 'D10'];
  var MAX_INCOMP_REQUIRED  = 5;
  var MAX_INCOMP_OPTIONAL  = 4;
  var MAX_INCOMP_TOTAL     = 9;
  var ARENA_ADVANCE_BUDGET = 3;

  function favoredToId(str) {
    if (!str) return null;
    return str.split('(')[0].trim().toLowerCase().replace(/\s+/g, '_');
  }

  function getFavoredIds() {
    var ids = {};
    var p1 = state.phase1 ? PHASE1_CARDS.find(function(c){ return c.id === state.phase1; }) : null;
    var p2 = state.phase2 ? PHASE2_CARDS.find(function(c){ return c.id === state.phase2; }) : null;
    if (p1 && p1._meta && p1._meta.favored) ids[favoredToId(p1._meta.favored)] = true;
    if (p2 && p2._meta && p2._meta.favored) ids[favoredToId(p2._meta.favored)] = true;
    return ids;
  }

  function getSpeciesArenas() {
    var sp = state.species ? SPECIES.find(function(s){ return s.id === state.species; }) : null;
    if (!sp) return { physique:'D6', reflex:'D6', grit:'D6', wits:'D6', presence:'D6' };
    return Object.assign({}, ARENA_BASELINE, sp.arenas);
  }

  function statsGetDerived() {
    var baseArenas = getSpeciesArenas();
    var arenaAdj   = state.arenaAdj || {};
    var netArenaSpend = Object.values(arenaAdj).reduce(function(acc, v){ return acc + v; }, 0);
    var arenaAdvAvail = ARENA_ADVANCE_BUDGET - netArenaSpend;
    var arenaValues = {};
    ['physique','reflex','grit','wits','presence'].forEach(function(k) {
      var base = DIE_STEPS.indexOf(baseArenas[k] || 'D6');
      var adj  = arenaAdj[k] || 0;
      var idx  = Math.max(0, Math.min(3, base + adj));
      arenaValues[k] = DIE_STEPS[idx];
    });
    var discIncomp       = state.discIncomp  || {};
    var discValues       = state.discValues  || {};
    var incompCount      = Object.keys(discIncomp).length;
    var totalDiscAdv     = incompCount;
    var totalEnhanced    = Math.floor(totalDiscAdv / 5);
    var spentReg         = state.spentRegAdv     || 0;
    var enhUsed          = state.enhancedAdvUsed || 0;
    var regularAdvAvail  = totalDiscAdv - spentReg;
    var enhancedAdvAvail = totalEnhanced - enhUsed;
    return {
      baseArenas:      baseArenas,
      arenaValues:     arenaValues,
      arenaAdvAvail:   arenaAdvAvail,
      incompCount:     incompCount,
      totalDiscAdv:    totalDiscAdv,
      totalEnhanced:   totalEnhanced,
      regularAdvAvail: regularAdvAvail,
      enhancedAdvAvail:enhancedAdvAvail,
      discValues:      discValues,
      discIncomp:      discIncomp,
    };
  }

  function statsGetDiscValue(discId, d) {
    if (d.discIncomp[discId]) return 'D4';
    return d.discValues[discId] || 'D6';
  }

  function initStatsScreen() {
    if (!state.discValues)      state.discValues      = {};
    if (!state.discIncomp)      state.discIncomp      = {};
    if (!state.arenaAdj)        state.arenaAdj        = {};
    if (!state.spentRegAdv)     state.spentRegAdv     = 0;
    if (!state.enhancedAdvUsed) state.enhancedAdvUsed = 0;
    renderStatsContent();
    showScreen('stats');
    updateStepTrack(4);
  }

  function renderStatsContent() {
    var container = document.getElementById('stats-content');
    if (!container) return;
    container.innerHTML = '';
    var d          = statsGetDerived();
    var favoredIds = getFavoredIds();
    container.appendChild(buildArenasSection(d));
    container.appendChild(buildDiscSection(d, favoredIds));
    var btn = document.getElementById('btn-stats-continue');
    if (btn) btn.disabled = d.incompCount < MAX_INCOMP_REQUIRED;
  }

  /* -- Arena section -- */

  function buildArenasSection(d) {
    var wrap = document.createElement('div');
    wrap.className = 'cc-subsection';
    var head = document.createElement('div');
    head.className = 'cc-subsection-head';
    var leftDiv = document.createElement('div');
    leftDiv.innerHTML = '<span class="cc-subsection-title">Arenas</span><div class="cc-subsection-hint">3 free advances &bull; step down to refund &bull; max D10</div>';
    var badges = document.createElement('div');
    badges.className = 'cc-adv-badges';
    var avail = d.arenaAdvAvail;
    var badge = document.createElement('span');
    badge.className   = 'cc-adv-badge ' + (avail > 0 ? 'cc-adv-badge--ok' : '');
    badge.textContent = avail + ' advance' + (avail !== 1 ? 's' : '') + ' remaining';
    badges.appendChild(badge);
    head.appendChild(leftDiv);
    head.appendChild(badges);
    wrap.appendChild(head);
    var rows = document.createElement('div');
    rows.className = 'cc-arena-rows';
    ['physique','reflex','grit','wits','presence'].forEach(function(aId) {
      rows.appendChild(buildArenaRow(aId, d));
    });
    wrap.appendChild(rows);
    return wrap;
  }

  function buildArenaRow(aId, d) {
    var cur    = d.arenaValues[aId] || 'D6';
    var base   = d.baseArenas[aId]  || 'D6';
    var curIdx = DIE_STEPS.indexOf(cur);
    var canUp  = d.arenaAdvAvail > 0 && curIdx < 3;
    var canDn  = curIdx > 0;
    var row = document.createElement('div');
    row.className    = 'cc-arena-row';
    row.dataset.arena = aId;
    var dieCell = document.createElement('div');
    dieCell.className = 'cc-arena-die-cell';
    var dieImg = document.createElement('img');
    dieImg.src       = '/assets/' + cur.toLowerCase() + '.png';
    dieImg.alt       = cur;
    dieImg.className = 'cc-arena-die-img';
    dieCell.appendChild(dieImg);
    var info = document.createElement('div');
    info.className = 'cc-arena-info';
    var nameBtn = document.createElement('button');
    nameBtn.className   = 'cc-glossary-trigger';
    nameBtn.textContent = capitalize(aId);
    nameBtn.title = 'View glossary';
    nameBtn.addEventListener('click', function() { if (window.GlossaryOverlay) window.GlossaryOverlay.open(aId); });
    var baseLabel = document.createElement('span');
    baseLabel.className   = 'cc-arena-base-label';
    baseLabel.textContent = 'Species base: ' + base;
    info.appendChild(nameBtn);
    info.appendChild(baseLabel);
    var stepGroup = document.createElement('div');
    stepGroup.className = 'cc-stepper-group';
    var btnDown = document.createElement('button');
    btnDown.className   = 'cc-stepper-btn';
    btnDown.textContent = '−';
    btnDown.disabled    = !canDn;
    btnDown.title = canDn ? 'Step down (refund 1 advance)' : 'Already at minimum';
    btnDown.addEventListener('click', function() { handleArenaStep(aId, -1); });
    var dieLabel = document.createElement('span');
    dieLabel.className   = 'cc-stepper-die-label';
    dieLabel.textContent = cur;
    var btnUp = document.createElement('button');
    btnUp.className   = 'cc-stepper-btn';
    btnUp.textContent = '+';
    btnUp.disabled    = !canUp;
    btnUp.title = canUp ? 'Step up (costs 1 advance)' : (d.arenaAdvAvail <= 0 ? 'No advances remaining' : 'Already at D10');
    btnUp.addEventListener('click', function() { handleArenaStep(aId, 1); });
    stepGroup.appendChild(btnDown);
    stepGroup.appendChild(dieLabel);
    stepGroup.appendChild(btnUp);
    row.appendChild(dieCell);
    row.appendChild(info);
    row.appendChild(stepGroup);
    return row;
  }

  function handleArenaStep(aId, dir) {
    if (!state.arenaAdj) state.arenaAdj = {};
    var d = statsGetDerived();
    var curIdx = DIE_STEPS.indexOf(d.arenaValues[aId]);
    if (dir ===  1 && (d.arenaAdvAvail <= 0 || curIdx >= 3)) return;
    if (dir === -1 && curIdx <= 0) return;
    state.arenaAdj[aId] = (state.arenaAdj[aId] || 0) + dir;
    saveState();
    renderStatsContent();
  }

  /* -- Disciplines section -- */

  function buildDiscSection(d, favoredIds) {
    var wrap = document.createElement('div');
    wrap.className = 'cc-subsection';
    var head = document.createElement('div');
    head.className = 'cc-subsection-head';
    var title = document.createElement('span');
    title.className   = 'cc-subsection-title';
    title.textContent = 'Disciplines';
    var badges = document.createElement('div');
    badges.className = 'cc-adv-badges';
    badges.appendChild(makeIncompBadge(d));
    if (d.totalDiscAdv > 0)       badges.appendChild(makeRegBadge(d));
    if (d.enhancedAdvAvail > 0)   badges.appendChild(makeEnhBadge(d));
    head.appendChild(title);
    head.appendChild(badges);
    wrap.appendChild(head);
    if (d.incompCount < MAX_INCOMP_REQUIRED) {
      var notice = document.createElement('div');
      notice.className = 'cc-incomp-notice';
      var rem = MAX_INCOMP_REQUIRED - d.incompCount;
      notice.innerHTML = 'Select <strong>' + rem + ' more</strong> discipline' + (rem !== 1 ? 's' : '') +
        ' to mark Incompetent (D4) — each earns 1 advance. Up to 4 additional weaknesses for extra advances.';
      wrap.appendChild(notice);
    }
    if (d.totalDiscAdv > 0) wrap.appendChild(buildAdvDots(d));
    DISCIPLINES_BY_ARENA.forEach(function(ag) { wrap.appendChild(buildDiscGroup(ag, d, favoredIds)); });
    return wrap;
  }

  function makeIncompBadge(d) {
    var ok  = d.incompCount >= MAX_INCOMP_REQUIRED;
    var opt = Math.max(0, d.incompCount - MAX_INCOMP_REQUIRED);
    var req = Math.min(d.incompCount, MAX_INCOMP_REQUIRED);
    var sp  = document.createElement('span');
    sp.className   = 'cc-adv-badge ' + (ok ? 'cc-adv-badge--ok' : 'cc-adv-badge--warn');
    sp.textContent = req + '/' + MAX_INCOMP_REQUIRED + ' required' + (opt ? '  +' + opt + '/' + MAX_INCOMP_OPTIONAL + ' optional' : '');
    return sp;
  }

  function makeRegBadge(d) {
    var sp = document.createElement('span');
    sp.className   = 'cc-adv-badge ' + (d.regularAdvAvail > 0 ? 'cc-adv-badge--ok' : '');
    sp.textContent = d.regularAdvAvail + ' advance' + (d.regularAdvAvail !== 1 ? 's' : '') + ' available';
    return sp;
  }

  function makeEnhBadge(d) {
    var sp = document.createElement('span');
    sp.className   = 'cc-adv-badge cc-adv-badge--enhanced';
    sp.textContent = d.enhancedAdvAvail + ' Elite advance' + (d.enhancedAdvAvail !== 1 ? 's' : '');
    sp.title = 'Spend to raise a D8 to D10';
    return sp;
  }

  function buildAdvDots(d) {
    var wrap = document.createElement('div');
    wrap.className = 'cc-adv-dots';
    for (var i = 1; i <= d.totalDiscAdv; i++) {
      var isEnh = (i % 5 === 0);
      if (isEnh && i > 1) { var g = document.createElement('div'); g.className = 'cc-adv-dot-gap'; wrap.appendChild(g); }
      var dot = document.createElement('div');
      dot.className = 'cc-adv-dot cc-adv-dot--filled' + (isEnh ? ' cc-adv-dot--enhanced' : '');
      dot.title = isEnh ? 'Elite Advance' : 'Regular advance';
      wrap.appendChild(dot);
    }
    return wrap;
  }

  function buildDiscGroup(arenaGroup, d, favoredIds) {
    var wrap = document.createElement('div');
    wrap.className = 'cc-disc-group';
    var head = document.createElement('div');
    head.className = 'cc-disc-group-head';
    var lbl = document.createElement('button');
    lbl.className   = 'cc-glossary-trigger cc-disc-group-label';
    lbl.textContent = arenaGroup.name;
    lbl.title = 'View glossary';
    lbl.addEventListener('click', function() { if (window.GlossaryOverlay) window.GlossaryOverlay.open(arenaGroup.id); });
    head.appendChild(lbl);
    wrap.appendChild(head);
    arenaGroup.disciplines.forEach(function(disc) { wrap.appendChild(buildDiscRow(disc, d, favoredIds)); });
    return wrap;
  }

  function buildDiscRow(disc, d, favoredIds) {
    var isFavored = !!favoredIds[disc.id];
    var isIncomp  = !!d.discIncomp[disc.id];
    var isForce  = !!disc.force;
    var cur       = statsGetDiscValue(disc.id, d);
    var row = document.createElement('div');
    row.className = 'cc-disc-row' +
      (isFavored ? ' cc-disc-row--favored' : '') +
      (isIncomp  ? ' cc-disc-row--incompetent' : '') +
      (isForce   ? ' cc-disc-row--force'        : '');
    // Die image
    var dieCell = document.createElement('div');
    dieCell.className = 'cc-disc-die-cell';
    var img = document.createElement('img');
    img.src       = '/assets/' + cur.toLowerCase() + '.png';
    img.alt       = cur;
    img.className = 'cc-disc-die-img';
    dieCell.appendChild(img);
    // Name + pip
    var info = document.createElement('div');
    info.className = 'cc-disc-info';
    if (isFavored) {
      var pip = document.createElement('span');
      pip.className = 'cc-disc-aligned-pip';
      pip.title = 'Favored discipline';
      info.appendChild(pip);
    }
    var nameBtn = document.createElement('button');
    nameBtn.className   = 'cc-disc-name-btn';
    nameBtn.textContent = disc.name;
    nameBtn.title = 'View glossary';
    nameBtn.addEventListener('click', function() { if (window.GlossaryOverlay) window.GlossaryOverlay.open(disc.id); });
    if (isForce) {
      var ftag = document.createElement('span');
      ftag.className = 'cc-disc-force-tag';
      ftag.textContent = 'Force';
      ftag.title = 'Requires Force Sensitivity';
      info.appendChild(ftag);
    }
    info.appendChild(nameBtn);
    // Actions
    var actions = document.createElement('div');
    actions.className = 'cc-disc-actions';
    if (isIncomp) {
      var rb = document.createElement('button');
      rb.className   = 'cc-disc-action-btn cc-disc-action-btn--restore';
      rb.textContent = 'Restore';
      rb.title = 'Remove incompetency — returns 1 advance';
      rb.addEventListener('click', function() { handleDiscRestore(disc.id); });
      actions.appendChild(rb);
    } else if (cur === 'D6') {
      var wb = document.createElement('button');
      wb.className   = 'cc-disc-action-btn cc-disc-action-btn--incomp';
      wb.textContent = 'Weak';
      wb.title       = d.incompCount >= MAX_INCOMP_TOTAL ? 'Maximum reached' : 'Mark incompetent (D4) — earn 1 advance';
      wb.disabled    = d.incompCount >= MAX_INCOMP_TOTAL;
      wb.addEventListener('click', function() { handleDiscIncomp(disc.id); });
      actions.appendChild(wb);
      var ab = document.createElement('button');
      ab.className   = 'cc-disc-action-btn';
      ab.textContent = '▲ D8';
      ab.title       = d.regularAdvAvail <= 0 ? 'No advances available' : 'Raise to D8 — costs 1 advance';
      ab.disabled    = d.regularAdvAvail <= 0;
      ab.addEventListener('click', function() { handleDiscAdvance(disc.id); });
      actions.appendChild(ab);
    } else if (cur === 'D8') {
      var rdb = document.createElement('button');
      rdb.className   = 'cc-disc-action-btn';
      rdb.textContent = '▼ D6';
      rdb.title = 'Lower to D6 — returns 1 advance';
      rdb.addEventListener('click', function() { handleDiscReduce(disc.id); });
      actions.appendChild(rdb);
      var eb = document.createElement('button');
      eb.className   = 'cc-disc-action-btn cc-disc-action-btn--elite';
      eb.textContent = '▲ D10';
      eb.title       = d.enhancedAdvAvail <= 0 ? 'No Elite Advances (every 5th incompetency earns one)' : 'Raise to D10 — costs 1 Elite Advance';
      eb.disabled    = d.enhancedAdvAvail <= 0;
      eb.addEventListener('click', function() { handleDiscElite(disc.id); });
      actions.appendChild(eb);
    } else if (cur === 'D10') {
      var r10 = document.createElement('button');
      r10.className   = 'cc-disc-action-btn';
      r10.textContent = '▼ D8';
      r10.title = 'Lower to D8 — returns 1 Elite Advance';
      r10.addEventListener('click', function() { handleDiscReduceElite(disc.id); });
      actions.appendChild(r10);
    }
    row.appendChild(dieCell);
    row.appendChild(info);
    row.appendChild(actions);
    return row;
  }

  /* -- Disc action handlers -- */

  function handleDiscIncomp(discId) {
    if (!state.discIncomp) state.discIncomp = {};
    if (Object.keys(state.discIncomp).length >= MAX_INCOMP_TOTAL) return;
    state.discIncomp[discId] = true;
    if (!state.discValues) state.discValues = {};
    state.discValues[discId] = 'D4';
    saveState();
    renderStatsContent();
  }

  function handleDiscRestore(discId) {
    if (!state.discIncomp) return;
    delete state.discIncomp[discId];
    if (state.discValues) delete state.discValues[discId];
    // Claw back overspent advances
    var d = statsGetDerived();
    if (d.regularAdvAvail < 0) {
      var over = -d.regularAdvAvail;
      DISCIPLINES_BY_ARENA.forEach(function(ag) { ag.disciplines.forEach(function(disc) {
        if (over <= 0) return;
        if (state.discValues && state.discValues[disc.id] === 'D8') {
          delete state.discValues[disc.id];
          state.spentRegAdv = Math.max(0, (state.spentRegAdv||0) - 1);
          over--;
        }
      }); });
    }
    if (d.enhancedAdvAvail < 0) {
      var overe = -d.enhancedAdvAvail;
      DISCIPLINES_BY_ARENA.forEach(function(ag) { ag.disciplines.forEach(function(disc) {
        if (overe <= 0) return;
        if (state.discValues && state.discValues[disc.id] === 'D10') {
          state.discValues[disc.id] = 'D8';
          state.enhancedAdvUsed = Math.max(0, (state.enhancedAdvUsed||0) - 1);
          overe--;
        }
      }); });
    }
    saveState();
    renderStatsContent();
  }

  function handleDiscAdvance(discId) {
    var d = statsGetDerived();
    if (d.regularAdvAvail <= 0) return;
    if (statsGetDiscValue(discId, d) !== 'D6') return;
    if (!state.discValues) state.discValues = {};
    state.discValues[discId]  = 'D8';
    state.spentRegAdv = (state.spentRegAdv || 0) + 1;
    saveState();
    renderStatsContent();
  }

  function handleDiscElite(discId) {
    var d = statsGetDerived();
    if (d.enhancedAdvAvail <= 0) return;
    if (statsGetDiscValue(discId, d) !== 'D8') return;
    if (!state.discValues) state.discValues = {};
    state.discValues[discId]   = 'D10';
    state.enhancedAdvUsed = (state.enhancedAdvUsed || 0) + 1;
    saveState();
    renderStatsContent();
  }

  function handleDiscReduce(discId) {
    if (statsGetDiscValue(discId, statsGetDerived()) !== 'D8') return;
    if (state.discValues) delete state.discValues[discId];
    state.spentRegAdv = Math.max(0, (state.spentRegAdv || 0) - 1);
    saveState();
    renderStatsContent();
  }

  function handleDiscReduceElite(discId) {
    if (statsGetDiscValue(discId, statsGetDerived()) !== 'D10') return;
    if (!state.discValues) state.discValues = {};
    state.discValues[discId]   = 'D8';
    state.enhancedAdvUsed = Math.max(0, (state.enhancedAdvUsed || 0) - 1);
    saveState();
    renderStatsContent();
  }

  /* ── Kits step ──────────────────────────────────────────────────── */

  var KITS_DATA     = [];
  var KITS_BUDGET   = 3;

  function loadKits() {
    return fetch('/data/kits.json')
      .then(function(r) { return r.json(); })
      .then(function(data) { KITS_DATA = data; })
      .catch(function (e) {
        _gen_in_flight = false; console.error('[Kits] Failed to load:', e); });
  }

  function kitsSpent() {
    var choices = state.kitChoices || {};
    return Object.values(choices).reduce(function(acc, tier) { return acc + tier; }, 0);
  }

  function initKitsScreen() {
    if (!state.kitChoices) state.kitChoices = {};
    var doShow = function() {
      renderKitsContent();
      showScreen('kits');
      updateStepTrack(5);
    };
    if (KITS_DATA.length === 0) {
      loadKits().then(doShow);
    } else {
      doShow();
    }
  }

  function renderKitsContent() {
    var container = document.getElementById('kits-content');
    if (!container) return;
    container.innerHTML = '';

    var choices = state.kitChoices || {};
    var spent   = kitsSpent();
    var avail   = KITS_BUDGET - spent;

    // Budget bar
    var budgetBar = document.createElement('div');
    budgetBar.className = 'cc-kits-budget-bar';
    var pips = document.createElement('div');
    pips.className = 'cc-kits-budget-pips';
    for (var pi = 0; pi < KITS_BUDGET; pi++) {
      var pip = document.createElement('div');
      pip.className = 'cc-kit-budget-pip' + (pi < spent ? ' cc-kit-budget-pip--used' : '');
      pips.appendChild(pip);
    }
    var budgLabel = document.createElement('span');
    budgLabel.className   = 'cc-kits-budget-label';
    budgLabel.textContent = avail + ' point' + (avail !== 1 ? 's' : '') + ' remaining';
    budgetBar.appendChild(pips);
    budgetBar.appendChild(budgLabel);
    container.appendChild(budgetBar);

    // Kit grid
    var grid = document.createElement('div');
    grid.className = 'cc-kits-grid';
    KITS_DATA.forEach(function(kit) {
      grid.appendChild(buildKitCard(kit, choices[kit.id] || 0, avail));
    });
    container.appendChild(grid);

    // Enable continue when at least 1 point spent (or allow 0?)
    var btn = document.getElementById('btn-kits-continue');
    if (btn) btn.disabled = false;

    // Update budget display in subheading
    var disp = document.getElementById('kits-budget-display');
    if (disp) disp.textContent = avail;
  }

  function buildKitCard(kit, tier, avail) {
    var isForce = kit.alignedDiscipline && kit.alignedDiscipline.indexOf('_spark') !== -1;
    var card = document.createElement('div');
    card.className = 'cc-kit-card' +
      (tier === 1 ? ' cc-kit-card--selected-t1' : '') +
      (tier === 2 ? ' cc-kit-card--selected-t2' : '') +
      (isForce ? ' cc-kit-card--force' : '');

    // --- Header ---
    var head = document.createElement('div');
    head.className = 'cc-kit-card-head';

    var titleRow = document.createElement('div');
    titleRow.className = 'cc-kit-card-title-row';
    var nameEl = document.createElement('span');
    nameEl.className   = 'cc-kit-name';
    nameEl.textContent = kit.name;
    titleRow.appendChild(nameEl);
    if (isForce) {
      var ftag = document.createElement('span');
      ftag.className   = 'cc-kit-force-tag';
      ftag.textContent = 'Force';
      titleRow.appendChild(ftag);
    }
    head.appendChild(titleRow);

    // Arena + discipline meta row
    var meta = document.createElement('div');
    meta.className = 'cc-kit-meta';
    var arenaTag = document.createElement('span');
    arenaTag.className = 'cc-kit-meta-tag cc-kit-meta-tag--arena';
    arenaTag.textContent = kit.governingArena ? (kit.governingArena.charAt(0).toUpperCase() + kit.governingArena.slice(1)) : '';
    meta.appendChild(arenaTag);
    if (kit.alignedDiscipline) {
      var discTag = document.createElement('span');
      discTag.className = 'cc-kit-meta-tag cc-kit-meta-tag--disc';
      var discLabel = kit.alignedDiscipline;
      if (discLabel.indexOf('_spark') !== -1) {
        discLabel = 'Force (' + (discLabel.replace('_spark','').replace(/_/g,' ').charAt(0).toUpperCase() + discLabel.replace('_spark','').replace(/_/g,' ').slice(1)) + ')';
      } else {
        discLabel = discLabel.replace(/_/g,' ');
        discLabel = discLabel.charAt(0).toUpperCase() + discLabel.slice(1);
      }
      discTag.textContent = discLabel;
      meta.appendChild(discTag);
    }
    if (kit.primaryWeapons && kit.primaryWeapons.length) {
      var wpTag = document.createElement('span');
      wpTag.className = 'cc-kit-meta-tag cc-kit-meta-tag--weapon';
      wpTag.textContent = kit.primaryWeapons.join(', ');
      meta.appendChild(wpTag);
    }
    head.appendChild(meta);
    card.appendChild(head);

    // --- Ability list ---
    var body = document.createElement('div');
    body.className = 'cc-kit-body';

    var abilities = kit.abilities || [];
    var t1 = abilities.filter(function(a) { return a.tier === 1; });
    var t2 = abilities.filter(function(a) { return a.tier === 2; });
    var t3 = abilities.filter(function(a) { return a.tier === 3; });

    function renderAbilitySection(sectionLabel, abList, state) {
      // state: 'active' | 'preview' | 'locked'
      var sec = document.createElement('div');
      sec.className = 'cc-kit-tier-section cc-kit-tier-section--' + state;
      var secHead = document.createElement('div');
      secHead.className = 'cc-kit-tier-section-head';
      var secLbl = document.createElement('span');
      secLbl.className = 'cc-kit-tier-section-label';
      secLbl.textContent = sectionLabel;
      secHead.appendChild(secLbl);
      if (state === 'locked') {
        var lockBadge = document.createElement('span');
        lockBadge.className = 'cc-kit-locked-badge';
        lockBadge.textContent = 'Requires Advancement';
        secHead.appendChild(lockBadge);
      }
      sec.appendChild(secHead);

      abList.forEach(function(ab) {
        var row = document.createElement('div');
        row.className = 'cc-kit-ability-row';
        var typeBadge = document.createElement('span');
        typeBadge.className = 'cc-kit-ability-type cc-kit-ability-type--' + (ab.type || 'passive');
        typeBadge.textContent = ab.actionType ? ab.actionType : (ab.type === 'gambit' ? 'Gambit' : 'Passive');
        row.appendChild(typeBadge);
        var abBody = document.createElement('div');
        abBody.className = 'cc-kit-ability-body';
        var abName = document.createElement('div');
        abName.className = 'cc-kit-ability-name';
        abName.textContent = ab.name;
        abBody.appendChild(abName);
        if (ab.arenaTag) {
          var aTag = document.createElement('span');
          aTag.className = 'cc-kit-ability-arena-tag';
          aTag.textContent = ab.arenaTag;
          abBody.appendChild(aTag);
        }
        var abRule = document.createElement('div');
        abRule.className = 'cc-kit-ability-rule';
        abRule.textContent = ab.rule;
        abBody.appendChild(abRule);
        row.appendChild(abBody);
        sec.appendChild(row);
      });
      return sec;
    }

    // Determine section states based on selected tier
    var t1State = (tier >= 1) ? 'active' : 'preview';
    var t2State = (tier >= 2) ? 'active' : (tier === 0 ? 'preview' : 'preview');
    var t3State = 'locked';

    if (t1.length) body.appendChild(renderAbilitySection('Tier 1', t1, t1State));
    if (t2.length) body.appendChild(renderAbilitySection('Tier 2', t2, t2State));
    if (t3.length) body.appendChild(renderAbilitySection('Tier 3', t3, t3State));

    card.appendChild(body);

    // --- Footer ---
    var footer = document.createElement('div');
    footer.className = 'cc-kit-footer';
    var costLabel = document.createElement('span');
    costLabel.className = 'cc-kit-cost-label';
    if (tier === 0) costLabel.textContent = 'T1: 1pt  |  T2: 2pt';
    if (tier === 1) costLabel.textContent = 'Tier 1 selected (1pt)';
    if (tier === 2) costLabel.textContent = 'Tier 2 selected (2pt)';
    footer.appendChild(costLabel);

    var actions = document.createElement('div');
    actions.className = 'cc-kit-actions';

    if (tier === 0) {
      var btn1 = document.createElement('button');
      btn1.className   = 'cc-kit-btn cc-kit-btn--take';
      btn1.textContent = 'Take Tier 1';
      btn1.disabled    = avail < 1;
      btn1.title       = avail < 1 ? 'Not enough points' : 'Take at Tier 1 (1pt)';
      btn1.addEventListener('click', function() { handleKitSelect(kit.id, 1); });
      actions.appendChild(btn1);
      var btn2 = document.createElement('button');
      btn2.className   = 'cc-kit-btn cc-kit-btn--upgrade';
      btn2.textContent = 'Take Tier 2';
      btn2.disabled    = avail < 2;
      btn2.title       = avail < 2 ? 'Need 2 points' : 'Take at Tier 2 (2pt)';
      btn2.addEventListener('click', function() { handleKitSelect(kit.id, 2); });
      actions.appendChild(btn2);
    }
    if (tier === 1) {
      var upgBtn = document.createElement('button');
      upgBtn.className   = 'cc-kit-btn cc-kit-btn--upgrade';
      upgBtn.textContent = 'Upgrade to Tier 2 (+1pt)';
      upgBtn.disabled    = avail < 1;
      upgBtn.title       = avail < 1 ? 'Not enough points' : 'Upgrade to Tier 2 (spend 1 more point)';
      upgBtn.addEventListener('click', function() { handleKitSelect(kit.id, 2); });
      actions.appendChild(upgBtn);
      var remBtn = document.createElement('button');
      remBtn.className   = 'cc-kit-btn cc-kit-btn--remove';
      remBtn.textContent = 'Remove';
      remBtn.addEventListener('click', function() { handleKitSelect(kit.id, 0); });
      actions.appendChild(remBtn);
    }
    if (tier === 2) {
      var dngBtn = document.createElement('button');
      dngBtn.className   = 'cc-kit-btn';
      dngBtn.textContent = 'Downgrade to T1';
      dngBtn.title       = 'Refund 1 point, drop to Tier 1';
      dngBtn.addEventListener('click', function() { handleKitSelect(kit.id, 1); });
      actions.appendChild(dngBtn);
      var remBtn2 = document.createElement('button');
      remBtn2.className   = 'cc-kit-btn cc-kit-btn--remove';
      remBtn2.textContent = 'Remove';
      remBtn2.addEventListener('click', function() { handleKitSelect(kit.id, 0); });
      actions.appendChild(remBtn2);
    }

    footer.appendChild(actions);
    card.appendChild(footer);
    return card;
  }

    function handleKitSelect(kitId, tier) {
    if (!state.kitChoices) state.kitChoices = {};
    if (tier === 0) {
      delete state.kitChoices[kitId];
    } else {
      state.kitChoices[kitId] = tier;
    }
    saveState();
    renderKitsContent();
  }

  /* ── Outfitting step ─────────────────────────────────────────────────── */

  var STARTING_CREDITS = 500;
  var OUTFITTING_CATALOG = [];

  function loadOutfittingCatalog() {
    if (OUTFITTING_CATALOG.length > 0) return Promise.resolve();
    return Promise.all([
      fetch('/data/gear.json').then(function(r) { return r.json(); }),
      fetch('/data/weapons.json').then(function(r) { return r.json(); }),
      fetch('/data/armor.json').then(function(r) { return r.json(); }),
    ]).then(function(results) {
      var gear = results[0].map(function(item) {
        return {
          id: item.id, name: item.name, cost: item.cost || 0,
          category: item.categoryLabel || item.category || 'Gear',
          source: 'gear', description: item.description || '',
          availability: item.availability || '',
          tags: item.tags || [],
          traits: item.traits || [],
          gambits: item.gambits || []
        };
      });
      var weapons = results[1].map(function(item) {
        return {
          id: item.id, name: item.name, cost: item.cost || 0,
          category: item.chassisLabel || 'Weapon',
          source: 'weapon', description: item.description || '',
          availability: item.availability || '',
          tags: item.tags || [],
          trait: item.trait || null,
          gambits: item.gambits || [],
          chassisLabel: item.chassisLabel || '',
          range: item.range || null,
          clipSize: item.clipSize || null,
          stunSetting: item.stunSetting || false
        };
      });
      var armor = results[2].map(function(item) {
        return {
          id: item.id, name: item.name, cost: item.cost || 0,
          category: item.categoryLabel || 'Armor',
          source: 'armor', description: item.description || '',
          availability: item.availability || '',
          tags: item.tags || [],
          traits: item.traits || []
        };
      });
      OUTFITTING_CATALOG = gear.concat(weapons).concat(armor);
      OUTFITTING_CATALOG.sort(function(a, b) { return a.cost - b.cost; });
    }).catch(function(e) {
      console.error('[Outfitting] Failed to load catalog:', e);
      OUTFITTING_CATALOG = [];
    });
  }

  function outfittingCreditsSpent() {
    var items = state.startingGear || [];
    return items.reduce(function(acc, item) { return acc + (item.cost || 0); }, 0);
  }

  function outfittingCreditsRemaining() {
    return STARTING_CREDITS - outfittingCreditsSpent();
  }

  function initOutfittingScreen() {
    if (!state.startingGear) state.startingGear = [];
    var doShow = function() {
      renderOutfittingContent();
      showScreen('outfitting');
      updateStepTrack(6);
    };
    if (OUTFITTING_CATALOG.length === 0) {
      loadOutfittingCatalog().then(doShow);
    } else {
      doShow();
    }
  }

  function renderOutfittingContent() {
    var container = document.getElementById('outfitting-content');
    if (!container) return;
    container.innerHTML = '';

    var remaining = outfittingCreditsRemaining();

    var creditsDisp = document.getElementById('outfitting-credits-display');
    if (creditsDisp) creditsDisp.textContent = remaining;

    var layout = document.createElement('div');
    layout.className = 'outfitting-layout';

    var catalogPanel = document.createElement('div');
    catalogPanel.className = 'outfitting-catalog';

    var searchRow = document.createElement('div');
    searchRow.className = 'outfitting-search-row';
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search gear, weapons, armor\u2026';
    searchInput.className = 'outfitting-search';
    searchRow.appendChild(searchInput);
    catalogPanel.appendChild(searchRow);

    var marketToggle = document.createElement('div');
    marketToggle.className = 'outfitting-market-toggle';
    var activeMarket = 'market';
    ['market', 'black-market'].forEach(function(mk) {
      var btn = document.createElement('button');
      btn.className = 'outfitting-market-btn' + (mk === activeMarket ? ' active' : '');
      btn.textContent = mk === 'market' ? 'Market' : 'Black Market';
      btn.dataset.market = mk;
      btn.addEventListener('click', function() {
        activeMarket = mk;
        marketToggle.querySelectorAll('.outfitting-market-btn').forEach(function(b) {
          b.classList.toggle('active', b.dataset.market === mk);
        });
        renderCatalogItems();
      });
      marketToggle.appendChild(btn);
    });
    catalogPanel.appendChild(marketToggle);

    var catFilters = document.createElement('div');
    catFilters.className = 'outfitting-cat-filters';
    var categories = ['All', 'Gear', 'Weapons', 'Armor'];
    var activeCat = 'All';
    categories.forEach(function(cat) {
      var btn = document.createElement('button');
      btn.className = 'outfitting-cat-btn' + (cat === activeCat ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', function() {
        activeCat = cat;
        catFilters.querySelectorAll('.outfitting-cat-btn').forEach(function(b) {
          b.classList.toggle('active', b.textContent === cat);
        });
        renderCatalogItems();
      });
      catFilters.appendChild(btn);
    });
    catalogPanel.appendChild(catFilters);

    var itemList = document.createElement('div');
    itemList.className = 'outfitting-item-list';
    catalogPanel.appendChild(itemList);

    var cartPanel = document.createElement('div');
    cartPanel.className = 'outfitting-cart';

    var cartTitle = document.createElement('div');
    cartTitle.className = 'outfitting-cart-title';
    cartTitle.innerHTML = '<span class="outfitting-cart-label">Your Loadout</span><span class="outfitting-cart-credits" id="outfitting-cart-credits">' + remaining + ' cr remaining</span>';
    cartPanel.appendChild(cartTitle);

    var cartItems = document.createElement('div');
    cartItems.className = 'outfitting-cart-items';
    cartItems.id = 'outfitting-cart-items';
    cartPanel.appendChild(cartItems);

    var cartTotal = document.createElement('div');
    cartTotal.className = 'outfitting-cart-total';
    cartTotal.id = 'outfitting-cart-total';
    cartPanel.appendChild(cartTotal);

    layout.appendChild(catalogPanel);
    layout.appendChild(cartPanel);
    container.appendChild(layout);

    searchInput.addEventListener('input', function() { renderCatalogItems(); });

    function isRestricted(avail) {
      return /R|X/.test(avail || '');
    }

    function availLabel(avail) {
      if (!avail) return '';
      if (avail.indexOf('X') >= 0) return 'Illegal';
      if (avail.indexOf('R') >= 0) return 'Restricted';
      return '';
    }

    function buildDetailPanel(item) {
      var d = document.createElement('div');
      d.className = 'outfitting-detail';

      if (item.description) {
        var desc = document.createElement('p');
        desc.className = 'outfitting-detail-desc';
        desc.textContent = item.description;
        d.appendChild(desc);
      }

      if (item.source === 'weapon') {
        var meta = document.createElement('div');
        meta.className = 'outfitting-detail-meta';
        if (item.chassisLabel) meta.innerHTML += '<span>Chassis: ' + item.chassisLabel + '</span>';
        if (item.range && item.range.length) meta.innerHTML += '<span>Range: ' + item.range.join(' / ') + 'm</span>';
        if (item.clipSize) meta.innerHTML += '<span>Clip: ' + item.clipSize + '</span>';
        if (item.stunSetting) meta.innerHTML += '<span>Stun: Yes</span>';
        if (item.availability) meta.innerHTML += '<span>Avail: ' + item.availability + '</span>';
        d.appendChild(meta);
      }

      if (item.source === 'armor' && item.availability) {
        var aMeta = document.createElement('div');
        aMeta.className = 'outfitting-detail-meta';
        aMeta.innerHTML = '<span>Avail: ' + item.availability + '</span>';
        d.appendChild(aMeta);
      }

      if (item.trait) {
        var tb = document.createElement('div');
        tb.className = 'outfitting-detail-trait';
        tb.innerHTML = '<span class="outfitting-trait-label">' + item.trait.name + '</span> ' + item.trait.description;
        d.appendChild(tb);
      }

      var traitArr = item.traits || [];
      traitArr.forEach(function(t) {
        var tb = document.createElement('div');
        tb.className = 'outfitting-detail-trait';
        tb.innerHTML = '<span class="outfitting-trait-label">' + (t.name || '') + '</span> ' + (t.description || t.rule || '');
        d.appendChild(tb);
      });

      var gArr = item.gambits || [];
      gArr.forEach(function(g) {
        var gb = document.createElement('div');
        gb.className = 'outfitting-detail-gambit';
        gb.innerHTML = '<span class="outfitting-gambit-label">Gambit: ' + g.name + '</span> ' + (g.rule || '');
        d.appendChild(gb);
      });

      if (item.tags && item.tags.length) {
        var pills = document.createElement('div');
        pills.className = 'outfitting-detail-tags';
        item.tags.forEach(function(t) {
          var pill = document.createElement('span');
          pill.className = 'outfitting-tag-pill';
          pill.textContent = t;
          pills.appendChild(pill);
        });
        d.appendChild(pills);
      }

      return d;
    }

    var expandedItemId = null;

    function renderCatalogItems() {
      var query = searchInput.value.trim().toLowerCase();
      itemList.innerHTML = '';

      var filtered = OUTFITTING_CATALOG.filter(function(item) {
        var restricted = isRestricted(item.availability);
        if (activeMarket === 'market' && restricted) return false;
        if (activeMarket === 'black-market' && !restricted) return false;
        if (activeCat === 'Weapons' && item.source !== 'weapon') return false;
        if (activeCat === 'Armor' && item.source !== 'armor') return false;
        if (activeCat === 'Gear' && item.source !== 'gear') return false;
        if (query && item.name.toLowerCase().indexOf(query) === -1 && item.category.toLowerCase().indexOf(query) === -1 && item.description.toLowerCase().indexOf(query) === -1) return false;
        return true;
      });

      if (OUTFITTING_CATALOG.length === 0) {
        var err = document.createElement('p');
        err.className = 'outfitting-empty';
        err.textContent = 'Failed to load gear catalog. Try going back and returning to this screen.';
        itemList.appendChild(err);
        return;
      }

      if (filtered.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'outfitting-empty';
        empty.textContent = 'No items match your search.';
        itemList.appendChild(empty);
        return;
      }

      filtered.forEach(function(item) {
        var wrapper = document.createElement('div');
        wrapper.className = 'outfitting-item-wrapper' + (expandedItemId === item.id ? ' expanded' : '');

        var row = document.createElement('div');
        row.className = 'outfitting-item-row';

        var info = document.createElement('div');
        info.className = 'outfitting-item-info';
        info.style.cursor = 'pointer';
        var nameEl = document.createElement('span');
        nameEl.className = 'outfitting-item-name';
        nameEl.textContent = item.name;
        var catLine = document.createElement('span');
        catLine.className = 'outfitting-item-cat';
        var catText = item.category;
        var al = availLabel(item.availability);
        if (al) catText += '  \u2022  ' + al;
        catLine.textContent = catText;
        if (al) {
          var badge = document.createElement('span');
          badge.className = 'outfitting-avail-badge' + (al === 'Illegal' ? ' illegal' : ' restricted');
          badge.textContent = al;
          catLine.textContent = item.category + '  ';
          catLine.appendChild(badge);
        }
        info.appendChild(nameEl);
        info.appendChild(catLine);

        info.addEventListener('click', function() {
          expandedItemId = expandedItemId === item.id ? null : item.id;
          renderCatalogItems();
        });

        var priceEl = document.createElement('span');
        priceEl.className = 'outfitting-item-price';
        priceEl.textContent = item.cost + ' cr';

        var addBtn = document.createElement('button');
        addBtn.className = 'outfitting-add-btn';
        addBtn.textContent = '+';
        var canAfford = outfittingCreditsRemaining() >= item.cost;
        addBtn.disabled = !canAfford;
        addBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          addToLoadout(item);
        });

        row.appendChild(info);
        row.appendChild(priceEl);
        row.appendChild(addBtn);
        wrapper.appendChild(row);

        if (expandedItemId === item.id) {
          wrapper.appendChild(buildDetailPanel(item));
        }

        itemList.appendChild(wrapper);
      });
    }

    function addToLoadout(item) {
      if (outfittingCreditsRemaining() < item.cost) return;
      if (!state.startingGear) state.startingGear = [];
      var acq = activeMarket === 'black-market' ? 'contraband' : 'registered';
      state.startingGear.push({ id: item.id, name: item.name, cost: item.cost, source: item.source, acquisition: acq });
      saveState();
      renderCart();
      renderCatalogItems();
    }

    function removeFromLoadout(index) {
      if (!state.startingGear) return;
      state.startingGear.splice(index, 1);
      saveState();
      renderCart();
      renderCatalogItems();
    }

    function renderCart() {
      var rem = outfittingCreditsRemaining();
      var spent = outfittingCreditsSpent();

      var creditsEl = document.getElementById('outfitting-cart-credits');
      if (creditsEl) creditsEl.textContent = rem + ' cr remaining';

      var creditsDispMain = document.getElementById('outfitting-credits-display');
      if (creditsDispMain) creditsDispMain.textContent = rem;

      var cartEl = document.getElementById('outfitting-cart-items');
      if (!cartEl) return;
      cartEl.innerHTML = '';

      var items = state.startingGear || [];
      if (items.length === 0) {
        var emptyMsg = document.createElement('p');
        emptyMsg.className = 'outfitting-cart-empty';
        emptyMsg.textContent = 'No gear selected. Browse the catalog to add items.';
        cartEl.appendChild(emptyMsg);
      } else {
        items.forEach(function(item, idx) {
          var row = document.createElement('div');
          row.className = 'outfitting-cart-row';

          var nameEl = document.createElement('span');
          nameEl.className = 'outfitting-cart-item-name';
          nameEl.textContent = item.name;

          if (item.acquisition) {
            var acqBadge = document.createElement('span');
            acqBadge.className = 'outfitting-acq-badge' + (item.acquisition === 'contraband' ? ' contraband' : ' registered');
            acqBadge.textContent = item.acquisition === 'contraband' ? 'Contraband' : 'Registered';
            nameEl.appendChild(document.createTextNode(' '));
            nameEl.appendChild(acqBadge);
          }

          var priceEl = document.createElement('span');
          priceEl.className = 'outfitting-cart-item-price';
          priceEl.textContent = item.cost + ' cr';

          var removeBtn = document.createElement('button');
          removeBtn.className = 'outfitting-remove-btn';
          removeBtn.textContent = '\u00D7';
          removeBtn.addEventListener('click', function() {
            removeFromLoadout(idx);
          });

          row.appendChild(nameEl);
          row.appendChild(priceEl);
          row.appendChild(removeBtn);
          cartEl.appendChild(row);
        });
      }

      var totalEl = document.getElementById('outfitting-cart-total');
      if (totalEl) {
        totalEl.innerHTML = '<span class="outfitting-total-label">Total Spent</span><span class="outfitting-total-value">' + spent + ' / ' + STARTING_CREDITS + ' cr</span>';
      }
    }

    renderCatalogItems();
    renderCart();
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

    var title = document.createElement('div');
    title.className   = 'ph-card-title';
    title.textContent = card.title;

    face.appendChild(img);
    face.appendChild(title);
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
    initStatsScreen();
  }

  /* ── Summary overlay ────────────────────────────────────────────────────── */


    /* ── Destiny Screen ──────────────────────────────────────────────────────── */

    function initDestinyScreen() {
      var tiles = document.querySelectorAll('.destiny-tile');
      var continueBtn = document.getElementById('btn-destiny-continue');
      var backBtn = document.getElementById('btn-back-to-outfitting');

      // Restore any prior selection
      tiles.forEach(function (tile) {
        var val = tile.getAttribute('data-destiny');
        tile.classList.toggle('selected', val === state.destiny);
      });
      if (continueBtn) continueBtn.disabled = !state.destiny;

      // Only bind click once (check flag)
      if (document.getElementById('screen-destiny').dataset.bound) return;
      document.getElementById('screen-destiny').dataset.bound = '1';

      tiles.forEach(function (tile) {
        tile.addEventListener('click', function () {
          tiles.forEach(function (t) { t.classList.remove('selected'); });
          tile.classList.add('selected');
          state.destiny = tile.getAttribute('data-destiny');
          if (continueBtn) continueBtn.disabled = false;
        });
      });

      if (continueBtn) {
        continueBtn.addEventListener('click', function () {
          showScreen('backstory');
          initBackstoryScreen();
        });
      }

      if (backBtn) {
        backBtn.addEventListener('click', function () {
          initOutfittingScreen();
        });
      }
    }

    /* ── Backstory Screen ────────────────────────────────────────────────────── */

    var _regen_cooldown = false;
    var _gen_in_flight  = false;
    var _regen_timer    = null;

    function initBackstoryScreen() {
      var screen = document.getElementById('screen-backstory');
      if (!screen) return;

      // Populate species display
      var sp = SPECIES.find(function (s) { return s.id === state.species; });
      var speciesEl = document.getElementById('bs-species-display');
      if (speciesEl) speciesEl.textContent = sp ? sp.name : '—';

      // Restore prior form values
      var nameInput  = document.getElementById('bs-char-name');
      var genNameChk = document.getElementById('bs-generate-name');
      var genderSel  = document.getElementById('bs-gender');
      var titleInput = document.getElementById('bs-char-title');
      var playerIn   = document.getElementById('bs-player-input');
      var genBtn     = document.getElementById('btn-generate-backstory');
      var regenBtn   = document.getElementById('btn-regenerate');
      var copyBtn    = document.getElementById('btn-copy-backstory');
      var finalizeBtn = document.getElementById('btn-finalize-character');
      var backBtn    = document.getElementById('btn-back-to-destiny');

      if (nameInput && state.charName)   nameInput.value  = state.charName;
      if (genderSel && state.charGender) genderSel.value  = state.charGender;
      if (titleInput && state.charTitle) titleInput.value = state.charTitle;

      // If we already have backstory, show it
      if (state.backstory) {
        showProseState(state.backstory);
        if (regenBtn) regenBtn.disabled = _regen_cooldown;
      }

      updateGenBtn();

      // Only bind once
      if (screen.dataset.bound) return;
      screen.dataset.bound = '1';

      if (nameInput) {
        nameInput.addEventListener('input', function () {
          state.charName = nameInput.value.trim();
          updateGenBtn();
        });
      }

      if (genNameChk) {
        genNameChk.addEventListener('change', function () {
          if (nameInput) nameInput.disabled = genNameChk.checked;
          updateGenBtn();
        });
      }

      if (genderSel) {
        genderSel.addEventListener('change', function () {
          state.charGender = genderSel.value;
        });
      }

      if (titleInput) {
        titleInput.addEventListener('input', function () {
          state.charTitle = titleInput.value.trim();
        });
      }

      if (genBtn) {
        genBtn.addEventListener('click', function () {
          if (!_gen_in_flight) generateBackstory();
        });
      }

      if (regenBtn) {
        regenBtn.addEventListener('click', function () {
          if (!_regen_cooldown && !_gen_in_flight) generateBackstory();
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          copyToClipboard(state.backstory);
        });
      }

      if (finalizeBtn) {
        finalizeBtn.addEventListener('click', function () {
          showSummary();
        });
      }

      if (backBtn) {
        backBtn.addEventListener('click', function () {
          showScreen('destiny');
          initDestinyScreen();
        });
      }

      function updateGenBtn() {
        if (!genBtn) return;
        var nameOk = (genNameChk && genNameChk.checked) || (nameInput && nameInput.value.trim().length > 0);
        genBtn.disabled = !nameOk;
      }
    }

    function showProseState(text) {
      document.getElementById('bs-idle-state').classList.add('hidden');
      document.getElementById('bs-loading-state').classList.add('hidden');
      document.getElementById('bs-error-state').classList.add('hidden');
      var proseEl = document.getElementById('bs-prose-state');
      proseEl.classList.remove('hidden');
      var contentEl = document.getElementById('bs-prose-content');
      if (contentEl) contentEl.textContent = text;
    }

    function showLoadingState() {
      document.getElementById('bs-idle-state').classList.add('hidden');
      document.getElementById('bs-prose-state').classList.add('hidden');
      document.getElementById('bs-error-state').classList.add('hidden');
      document.getElementById('bs-loading-state').classList.remove('hidden');
    }

    function showErrorState(msg) {
      document.getElementById('bs-idle-state').classList.add('hidden');
      document.getElementById('bs-loading-state').classList.add('hidden');
      document.getElementById('bs-prose-state').classList.add('hidden');
      var errEl = document.getElementById('bs-error-state');
      errEl.classList.remove('hidden');
      var msgEl = document.getElementById('bs-error-msg');
      if (msgEl) msgEl.textContent = msg;
    }

    function copyToClipboard(text) {
      if (!text) return;
      // HTTP-safe clipboard: try modern API, fall back to execCommand
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(function () { execCopy(text); });
      } else {
        execCopy(text);
      }
    }

    function execCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top  = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
    }

    function generateBackstory() {
      if (_gen_in_flight) return;
      _gen_in_flight = true;
      var sp      = SPECIES.find(function (s) { return s.id === state.species; });
      var p1card  = PHASE1_CARDS.find(function (c) { return c.id === state.phase1; });
      var p2card  = PHASE2_CARDS.find(function (c) { return c.id === state.phase2; });
      var p3card  = PHASE3_CARDS.find(function (c) { return c.id === state.phase3; });

      var genNameChk = document.getElementById('bs-generate-name');
      var nameInput  = document.getElementById('bs-char-name');
      var genderSel  = document.getElementById('bs-gender');
      var titleInput = document.getElementById('bs-char-title');
      var playerIn   = document.getElementById('bs-player-input');
      var regenBtn   = document.getElementById('btn-regenerate');
      var genBtn     = document.getElementById('btn-generate-backstory');

      var generateName  = genNameChk  ? genNameChk.checked  : false;
      var characterName = nameInput   ? nameInput.value.trim()  : state.charName;
      var gender        = genderSel   ? genderSel.value         : state.charGender || 'Male';
      var charTitle     = titleInput  ? titleInput.value.trim() : state.charTitle;
      var playerInput   = playerIn    ? playerIn.value.trim()   : '';

      // Build kit list
      var kitNames = [];
      if (state.kitChoices) {
        Object.keys(state.kitChoices).forEach(function (k) {
          if (state.kitChoices[k]) kitNames.push(k + ' (Tier ' + state.kitChoices[k] + ')');
        });
      }

      // Build discipline display name map
      var discDisplayNames = {};
      DISCIPLINES_BY_ARENA.forEach(function (arena) {
        arena.disciplines.forEach(function (d) {
          discDisplayNames[d.id] = d.name;
        });
      });

      // Build formative disciplines (D8+)
      var discNames = [];
      if (state.discValues) {
        Object.keys(state.discValues).forEach(function (k) {
          var dv = state.discValues[k];
          if (dv === 'D8' || dv === 'D10' || dv === 'D12') {
            var label = discDisplayNames[k] || k;
            discNames.push(label + ' (' + dv + ')');
          }
        });
      }

      // Build dominant arenas (D8+)
      var arenaNames = [];
      var speciesObj = SPECIES.find(function (s) { return s.id === state.species; });
      if (speciesObj) {
        ARENA_ORDER.forEach(function (aid) {
          var baseIdx = DIE_ORDER.indexOf(speciesObj.arenas[aid] || 'D6');
          var adj = (state.arenaAdj && state.arenaAdj[aid]) || 0;
          var finalIdx = Math.max(0, Math.min(DIE_ORDER.length - 1, baseIdx + adj));
          var finalDie = DIE_ORDER[finalIdx];
          if (finalDie === 'D8' || finalDie === 'D10' || finalDie === 'D12') {
            arenaNames.push(ARENA_LABELS[aid] + ' ' + finalDie);
          }
        });
      }

      var payload = {
        species: sp ? {
          name:          sp.name,
          biologicalTruth: sp.biologicalTruth ? sp.biologicalTruth.desc : '',
          loreAnchors:   sp._aiMeta ? sp._aiMeta.loreAnchors.join('; ') : '',
          directive:     sp._aiMeta ? sp._aiMeta.directives : '',
        } : { name: 'Unknown', biologicalTruth: '', loreAnchors: '', directive: '' },
        phase1: p1card ? {
          title:       p1card.title,
          narrative:   p1card.narrative,
          environment: p1card._meta ? p1card._meta.environment : '',
          tone:        p1card._meta ? p1card._meta.tone : '',
          themes:      p1card._meta ? p1card._meta.themes.join(', ') : '',
          locationHints: p1card._meta && p1card._meta.locationHints ? p1card._meta.locationHints : [],
        } : { title: 'Unknown', narrative: '', environment: '', tone: '', themes: '', locationHints: [] },
        phase2: p2card ? {
          title:       p2card.title,
          narrative:   p2card.narrative,
          environment: p2card._meta ? p2card._meta.environment : '',
          tone:        p2card._meta ? p2card._meta.tone : '',
          themes:      p2card._meta ? p2card._meta.themes ? p2card._meta.themes.join(', ') : p2card._meta.archetype || '' : '',
          archetype:     p2card._meta ? p2card._meta.archetype || '' : '',
          proficiencies: p2card._meta && p2card._meta.proficiencies ? p2card._meta.proficiencies.join(', ') : '',
          variability:   p2card._meta ? p2card._meta.variability || '' : '',
        } : { title: 'Unknown', narrative: '', environment: '', tone: '', themes: '', archetype: '', proficiencies: '', variability: '' },
        phase3: p3card ? {
          title:       p3card.title,
          narrative:   p3card.narrative,
          environment: p3card._meta ? p3card._meta.environment || '' : '',
          tone:        p3card._meta ? p3card._meta.tone : '',
          themes:      p3card._meta ? p3card._meta.themes ? p3card._meta.themes.join(', ') : p3card._meta.archetype || '' : '',
          archetype:   p3card._meta ? p3card._meta.archetype || '' : '',
          knackName:   p3card._meta ? p3card._meta.knackName || '' : '',
          knackType:   p3card._meta ? p3card._meta.knackType || '' : '',
          knack:       p3card._meta ? p3card._meta.knack || '' : '',
        } : { title: 'Unknown', narrative: '', environment: '', tone: '', themes: '', archetype: '', knackName: '', knackType: '', knack: '' },
        kits:         kitNames,
        startingGear: (state.startingGear || []).map(function(g) { return g.name; }),
        disciplines:  discNames,
        arenas:       arenaNames,
        destiny:      state.destiny || 'Light & Dark',
        gender:       gender,
        generateName: generateName,
        characterName: characterName,
        generateTitle: !charTitle,
        characterTitle: charTitle,
        playerInput:  playerInput,
      };

      // Lock UI
      if (genBtn) genBtn.disabled = true;
      if (regenBtn) regenBtn.disabled = true;
      showLoadingState();

      // 5-second minimum display delay + fetch race
      var fetchPromise = fetch('/api/backstory/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); });

      var minDelay = new Promise(function (res) { setTimeout(res, 5000); });

      Promise.all([fetchPromise, minDelay]).then(function (results) {
        _gen_in_flight = false;
        var res = results[0];
        if (!res.ok) {
          var errMsg = 'Generation failed. Try again.';
          if (res.status === 429 || (res.data && res.data.error === 'rate_limit')) {
            errMsg = 'The chronicler is busy — too many stories generating at once. Wait a moment and try again.';
          } else if (res.status === 504 || (res.data && res.data.error === 'timeout')) {
            errMsg = 'The chronicler went quiet. Check your connection and try regenerating.';
          } else if (res.data && res.data.error) {
            errMsg = res.data.error;
          }
          showErrorState(errMsg);
          if (genBtn) genBtn.disabled = false;
          if (regenBtn) regenBtn.disabled = false;
          return;
        }

        var data = res.data;

        // Fill in generated name/title
        if (data.name) {
          state.charName = data.name;
          var nameInput2 = document.getElementById('bs-char-name');
          if (nameInput2) nameInput2.value = data.name;
        }
        if (data.title) {
          state.charTitle = data.title;
          var titleInput2 = document.getElementById('bs-char-title');
          if (titleInput2) titleInput2.value = data.title;
        }
        state.charGender = gender;
        state.backstory  = data.backstory || '';

        showProseState(state.backstory);
        if (genBtn) genBtn.disabled = false;

        // 15-second cooldown on regenerate
        _regen_cooldown = true;
        if (regenBtn) regenBtn.disabled = true;
        clearTimeout(_regen_timer);
        _regen_timer = setTimeout(function () {
          _regen_cooldown = false;
          if (regenBtn) regenBtn.disabled = false;
        }, 15000);

      }).catch(function (err) {
        console.error('[backstory]', err);
        showErrorState('Something went wrong. Check the server and try again.');
        if (genBtn) genBtn.disabled = false;
        if (regenBtn) regenBtn.disabled = false;
      });
    }

    
    /* ── Character Save ──────────────────────────────────────────────────────── */

    function saveCharacterToDB() {
      var saveName = state.charName && state.charName.trim() ? state.charName.trim() : null;
      if (!saveName) {
        var statusEl = document.getElementById('sum-save-status');
        if (statusEl) { statusEl.textContent = 'Please set a character name on the Your Story screen first.'; statusEl.style.color = '#ef4444'; }
        return;
      }

      var sp     = SPECIES.find(function (s) { return s.id === state.species; });
      var p1card = PHASE1_CARDS.find(function (c) { return c.id === state.phase1; });
      var p2card = PHASE2_CARDS.find(function (c) { return c.id === state.phase2; });
      var p3card = PHASE3_CARDS.find(function (c) { return c.id === state.phase3; });

      var charData = {
        species:    sp   ? sp.name   : null,
        archetype:  state.charTitle || null,
        phase1:     p1card ? p1card.title : null,
        phase2:     p2card ? p2card.title : null,
        phase3:     p3card ? p3card.title : null,
        destiny:    state.destiny,
        gender:     state.charGender,
        title:      state.charTitle,
        backstory:  state.backstory,
        kits:       state.kitChoices,
        startingGear: state.startingGear || [],
        startingCredits: STARTING_CREDITS,
        creditsRemaining: outfittingCreditsRemaining(),
        arenaAdj:   state.arenaAdj,
        discValues: state.discValues,
        creationState: JSON.parse(JSON.stringify(state)),
      };

      var statusEl  = document.getElementById('sum-save-status');
      var saveBtn   = document.getElementById('btn-sum-save');
      if (statusEl) { statusEl.textContent = 'Saving…'; statusEl.style.color = 'var(--color-text-secondary)'; }
      if (saveBtn)  saveBtn.disabled = true;

      fetch('/api/characters/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: saveName, character_data: charData, editId: state.editId || null }),
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) {
          if (statusEl) { statusEl.textContent = 'Character saved! Head back to the home screen to connect.'; statusEl.style.color = '#22c55e'; }
          if (saveBtn)  saveBtn.textContent = 'Saved ✓';
        } else {
          throw new Error(data.error || 'Save failed');
        }
      })
      .catch(function (err) {
        if (statusEl) { statusEl.textContent = 'Save failed: ' + err.message; statusEl.style.color = '#ef4444'; }
        if (saveBtn)  { saveBtn.disabled = false; }
      });
    }

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
      sumRow('Favored Skill', p1._meta.favored),
    ] : [sumRow('Status', 'Not selected')]));

    body.appendChild(buildSumSection('Phase 2 — The Departure (Catalyst)', p2 ? [
      sumRow('Card',         p2.title),
      sumRow('Symbol',       p2.symbol),
      sumRow('Narrative',    p2.narrative),
      sumRow('Archetype',    p2._meta.archetype),
      sumRow('Tone',         p2._meta.tone),
      sumRow('Favored Skill', p2._meta.favored),
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

    var gearItems = state.startingGear || [];
    var gearRows = [];
    if (gearItems.length === 0) {
      gearRows.push(sumRow('Status', 'No gear selected'));
    } else {
      gearItems.forEach(function(item) {
        gearRows.push(sumRow(item.name, item.cost + ' cr'));
      });
      gearRows.push(sumRow('Credits Spent', outfittingCreditsSpent() + ' / ' + STARTING_CREDITS));
      gearRows.push(sumRow('Credits Remaining', outfittingCreditsRemaining() + ' cr'));
    }
    body.appendChild(buildSumSection('Starting Gear', gearRows));

    body.appendChild(buildSumSection('Character Identity', [
      sumRow('Name',    state.charName  || '(not set)'),
      sumRow('Title',   state.charTitle || '(not set)'),
      sumRow('Gender',  state.charGender || '(not set)'),
      sumRow('Destiny', state.destiny   || '(not set)'),
    ]));

    if (state.backstory) {
      var bsSection = document.createElement('div');
      bsSection.className = 'sum-section';
      var bsHead = document.createElement('h3');
      bsHead.className = 'sum-section-title';
      bsHead.textContent = 'Generated Backstory';
      bsSection.appendChild(bsHead);
      var bsPara = document.createElement('p');
      bsPara.style.cssText = 'font-size:0.52rem;line-height:1.8;color:var(--color-text-primary);white-space:pre-wrap;padding:0.25rem 0;';
      bsPara.textContent = state.backstory;
      bsSection.appendChild(bsPara);
      body.appendChild(bsSection);
    }
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

  function loadEditCharacter(callback) {
    var params = new URLSearchParams(window.location.search);
    var editId = params.get('edit');
    if (!editId) { callback(); return; }

    fetch('/api/characters/' + encodeURIComponent(editId) + '?raw=1')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) { console.warn('Edit load failed:', data.error); callback(); return; }
        var cd = data.character_data || {};
        if (cd.creationState) {
          Object.assign(state, cd.creationState);
        } else {
          var sp = SPECIES.find(function (s) { return s.name === cd.species; });
          if (sp) state.species = sp.id;
          var p1 = PHASE1_CARDS.find(function (c) { return c.title === cd.phase1; });
          if (p1) state.phase1 = p1.id;
          var p2 = PHASE2_CARDS.find(function (c) { return c.title === cd.phase2; });
          if (p2) state.phase2 = p2.id;
          var p3 = PHASE3_CARDS.find(function (c) { return c.title === cd.phase3; });
          if (p3) state.phase3 = p3.id;
          if (cd.destiny) state.destiny = cd.destiny;
          if (cd.gender)  state.charGender = cd.gender;
          if (cd.title)   state.charTitle = cd.title;
          if (cd.backstory) state.backstory = cd.backstory;
          if (cd.kits) state.kitChoices = cd.kits;
          if (cd.startingGear) state.startingGear = cd.startingGear;
          if (cd.arenaAdj) state.arenaAdj = cd.arenaAdj;
          if (cd.discValues) {
            state.discValues = cd.discValues;
            state.discIncomp = {};
            Object.keys(cd.discValues).forEach(function (k) {
              if (cd.discValues[k] === 'D4') state.discIncomp[k] = true;
            });
            var incompCount = Object.keys(state.discIncomp).length;
            var spent = 0;
            Object.keys(cd.discValues).forEach(function (k) {
              if (cd.discValues[k] === 'D8') spent++;
            });
            state.spentRegAdv = spent;
            var eliteSpent = 0;
            Object.keys(cd.discValues).forEach(function (k) {
              if (cd.discValues[k] === 'D10') eliteSpent++;
            });
            state.enhancedAdvUsed = eliteSpent;
          }
        }
        state.charName = data.name || '';
        state.editId = editId;
        callback();
      })
      .catch(function () { callback(); });
  }

  function init() {
    loadTheme();
    var params = new URLSearchParams(window.location.search);
    var isEdit = params.has('edit');
    if (isEdit) {
      sessionStorage.removeItem(CREATION_KEY);
    } else if (params.has('new')) {
      sessionStorage.removeItem(CREATION_KEY);
    } else {
      loadSavedState();
    }
    loadEditCharacter(function () { initCreator(); });
  }

  function initCreator() {

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


    var backToPhase3 = document.getElementById('btn-back-to-phase3');
    if (backToPhase3) {
      backToPhase3.addEventListener('click', function () {
        showScreen('phase3');
        updateStepTrack(3);
      });
    }

    var backToStats = document.getElementById('btn-back-to-stats');
    if (backToStats) {
      backToStats.addEventListener('click', function () {
        showScreen('stats');
        updateStepTrack(4);
      });
    }

    var kitsContinue = document.getElementById('btn-kits-continue');
    if (kitsContinue) {
      kitsContinue.addEventListener('click', function () {
        initOutfittingScreen();
      });
    }

    var outfittingContinue = document.getElementById('btn-outfitting-continue');
    if (outfittingContinue) {
      outfittingContinue.addEventListener('click', function () {
        showScreen('destiny');
        initDestinyScreen();
      });
    }

    var backToKitsFromOutfitting = document.getElementById('btn-back-to-kits-from-outfitting');
    if (backToKitsFromOutfitting) {
      backToKitsFromOutfitting.addEventListener('click', function () {
        initKitsScreen();
      });
    }

    var statsContinue = document.getElementById('btn-stats-continue');
    if (statsContinue) {
      statsContinue.addEventListener('click', function () {
        initKitsScreen();
      });
    }

    var sumSaveBtn = document.getElementById('btn-sum-save');
    if (sumSaveBtn) {
      sumSaveBtn.addEventListener('click', function () { saveCharacterToDB(); });
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

        if (state.arenaAdj) {
          var baseArenas = characterSheet.arenas;
          ['physique','reflex','grit','wits','presence'].forEach(function(k) {
            var baseIdx = DIE_STEPS.indexOf(baseArenas[k] || 'D6');
            var adj = state.arenaAdj[k] || 0;
            var idx = Math.max(0, Math.min(DIE_STEPS.length - 1, baseIdx + adj));
            characterSheet.arenas[k] = DIE_STEPS[idx];
          });
        }

        if (state.discValues) {
          characterSheet.disciplines.forEach(function(d) {
            if (state.discValues[d.id]) d.die = state.discValues[d.id];
          });
        }

        renderStatsOverlay(false, null);

        var idx = SPECIES.indexOf(sp);
        if (idx >= 0) {
          carouselState.current = idx;
          var track = document.getElementById('cc-track');
          if (track) track.style.transform = 'translateX(' + (-idx * 100) + '%)';
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
