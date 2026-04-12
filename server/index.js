const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const path         = require('path');
const cookieParser = require('cookie-parser');
const compression  = require('compression');

const { initialize, pool } = require('./db');

const characterRoutes = require('./routes/characters');
const campaignRoutes  = require('./routes/campaign');
const equipmentRoutes = require('./routes/equipment');
const inventoryRoutes = require('./routes/inventory');
const backstoryRoutes     = require('./routes/backstory');
const itemRequestRoutes   = require('./routes/item-requests');
const journalRoutes       = require('./routes/journal');
const decisionRoutes      = require('./routes/decisions');
const narrativeChallengeRoutes = require('./routes/narrative-challenges');
const npcProfileRoutes        = require('./routes/npc-profiles');
const galaxyPinRoutes         = require('./routes/galaxy-pins');
const crawlRoutes             = require('./routes/crawls');
const fs = require('fs');
const socketHandlers  = require('./sockets/handlers');
const { loginRoute, logoutRoute, gate, roleFromCookie, COOKIE_SECRET } = require('./auth');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
app.set('io', io);

const PORT = process.env.PORT || 5000;
const ROOT = path.join(__dirname, '..');

app.use(compression());
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

if (process.env.NODE_ENV !== 'production') {
  app.use(function(req, res, next) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });
}

app.post('/api/auth/login',  loginRoute);
app.post('/api/auth/logout', logoutRoute);

app.get('/login',  (req, res) => {
  const role = roleFromCookie(req);
  if (role) return res.redirect('/');
  res.sendFile(path.join(ROOT, 'public', 'login.html'));
});
app.get('/login/', (req, res) => res.redirect('/login'));

app.use(gate);

app.use(express.static(path.join(ROOT, 'public')));
app.use('/js',     express.static(path.join(ROOT, 'js')));
app.use('/data',   express.static(path.join(ROOT, 'data')));
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/attached_assets', express.static(path.join(ROOT, 'attached_assets')));

app.get('/api/auth/role', (req, res) => {
  res.json({ role: req.userRole || null });
});

app.use('/api', characterRoutes);
app.use('/api', campaignRoutes);
app.use('/api', equipmentRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', backstoryRoutes);
app.use('/api', itemRequestRoutes);
app.use('/api', journalRoutes);
app.use('/api/campaign', decisionRoutes);
app.use('/api', narrativeChallengeRoutes);
app.use('/api', npcProfileRoutes);
app.use('/api', galaxyPinRoutes);
app.use('/api', crawlRoutes);

app.get('/gm',    (req, res) => res.redirect('/gm/'));
app.get('/gm/',   (req, res) => res.sendFile(path.join(ROOT, 'public', 'gm', 'index.html')));
app.get('/gm/crawl-editor',  (req, res) => res.redirect('/gm/crawl-editor/'));
app.get('/gm/crawl-editor/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'gm', 'crawl-editor', 'index.html')));

app.get('/player',  (req, res) => res.redirect('/player/'));
app.get('/player/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'player', 'index.html')));

app.get('/create',  (req, res) => res.redirect('/create/'));
app.get('/create/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'create', 'index.html')));

app.get('/market',  (req, res) => res.redirect('/market/'));
app.get('/market/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'market', 'index.html')));

const ALLOWED_MAPS = ['burning-deck', 'switch-lair', 'landing-field', 'vanishing-place', 'banshee', 'jungle-trek', 'blackwind-point', 'filtration-plant', 'gladiator-pit', 'aviary', 'knife-in-the-dark', 'command-center', 'dungeons', 'throne-room', 'throne-room-court'];

app.post('/api/maps/save', (req, res) => {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
  const { mapKey, hitboxes, gridConfig } = req.body;
  if (!mapKey || !ALLOWED_MAPS.includes(mapKey)) return res.status(400).json({ error: 'Invalid map key.' });
  if (!Array.isArray(hitboxes) || hitboxes.length === 0) return res.status(400).json({ error: 'No hitbox data.' });

  const filePath = path.join(ROOT, 'public', 'maps', mapKey + '.html');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Map file not found.' });

  let html;
  try { html = fs.readFileSync(filePath, 'utf8'); } catch (e) { return res.status(500).json({ error: 'Failed to read map file.' }); }

  const svgOpen  = html.indexOf('<svg');
  const svgClose = html.indexOf('</svg>');
  if (svgOpen === -1 || svgClose === -1) return res.status(500).json({ error: 'Could not locate SVG block in map.' });

  const svgTagEnd = html.indexOf('>', svgOpen);
  let svgTag = html.substring(svgOpen, svgTagEnd + 1);

  if (gridConfig && typeof gridConfig === 'object') {
    svgTag = svgTag.replace(/\s+data-grid-[a-z-]+="[^"]*"/g, '');
    const closing = svgTag.endsWith('/>') ? '/>' : '>';
    const base = svgTag.slice(0, svgTag.length - closing.length);
    const attrs = [];
    attrs.push(`data-grid-on="${gridConfig.gridOn ? '1' : '0'}"`);
    attrs.push(`data-grid-size="${gridConfig.gridSize != null ? gridConfig.gridSize : 40}"`);
    attrs.push(`data-grid-offx="${gridConfig.gridOffX != null ? gridConfig.gridOffX : 0}"`);
    attrs.push(`data-grid-offy="${gridConfig.gridOffY != null ? gridConfig.gridOffY : 0}"`);
    attrs.push(`data-grid-opacity="${gridConfig.gridOpacity != null ? gridConfig.gridOpacity : 40}"`);
    attrs.push(`data-grid-color="${gridConfig.gridColor || 'white'}"`);
    attrs.push(`data-grid-linewidth="${gridConfig.gridLineWidth != null ? gridConfig.gridLineWidth : 1}"`);
    svgTag = base + ' ' + attrs.join(' ') + closing;
  }

  let newSVGContent = '\n';
  hitboxes.forEach(hb => {
    const nameEsc = (hb.room || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const descEsc = (hb.desc || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const x = Math.round(hb.x || 0);
    const y = Math.round(hb.y || 0);
    const w = Math.round(hb.w || 50);
    const h = Math.round(hb.h || 50);
    const rx = hb.rx || '3';
    newSVGContent += `    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="hitbox"\n      data-room="${nameEsc}"\n      data-desc="${descEsc}"/>\n\n`;
  });

  const before = html.substring(0, svgOpen);
  const after  = html.substring(svgClose);
  const newHTML = before + svgTag + '\n' + newSVGContent + '  ' + after;

  try { fs.writeFileSync(filePath, newHTML, 'utf8'); } catch (e) { return res.status(500).json({ error: 'Failed to write map file.' }); }

  res.json({ ok: true, count: hitboxes.length });
});

const MAPS_META = {
  'burning-deck':   { img: 'burning-deck.png',           vw: 1024, vh: 635, title: 'The Burning Deck' },
  'switch-lair':    { img: 'switch-lair.png',             vw: 1024, vh: 716, title: "Switch's Lair" },
  'landing-field':  { img: 'landing-field.png',           vw: 1024, vh: 576, title: 'Landing Field' },
  'vanishing-place':{ img: 'vanishing-place-rendered.png', vw: 1024, vh: 576, title: 'The Vanishing Place' },
  'banshee':        { img: 'banshee.png',                  vw: 1024, vh: 946, title: 'The Banshee' },
  'jungle-trek':    { img: 'jungle-trek.png',              vw: 1024, vh: 1024, title: 'Jungle Trek' },
  'blackwind-point':{ img: 'blackwind-point-map.png',         vw: 1024, vh: 778, title: 'Blackwind Point' },
  'filtration-plant':{ img: 'filtration-plant.png',           vw: 1024, vh: 791, title: 'Water Filtration Plant' },
  'gladiator-pit':   { img: 'gladiator-pit.png',              vw: 846,  vh: 1024, title: "Varga's Gladiator Pit" },
  'aviary':          { img: 'aviary.png',                     vw: 1024, vh: 828,  title: 'The Aviary' },
  'knife-in-the-dark':{ img: 'knife-in-the-dark.png',         vw: 711,  vh: 1024, title: 'Knife in the Dark' },
  'command-center':   { img: 'command-center.png',            vw: 715,  vh: 1024, title: 'Command Center' },
  'dungeons':         { img: 'dungeons.png',                  vw: 622,  vh: 1024, title: 'The Dungeons' },
  'throne-room':      { img: 'throne-room.png',               vw: 746,  vh: 1024, title: "Varga's Throne Room — The Escape" },
  'throne-room-court':{ img: 'throne-room-court.png',         vw: 746,  vh: 1024, title: "Varga's Throne Room — Court in Session" }
};

app.get('/api/maps/:key/meta', (req, res) => {
  const mapKey = req.params.key;
  if (!ALLOWED_MAPS.includes(mapKey)) return res.status(400).json({ error: 'Invalid map key.' });

  const meta = MAPS_META[mapKey];
  if (!meta) return res.status(404).json({ error: 'Unknown map.' });

  const filePath = path.join(ROOT, 'public', 'maps', mapKey + '.html');
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Map file not found.' });

  let html;
  try { html = fs.readFileSync(filePath, 'utf8'); } catch (e) { return res.status(500).json({ error: 'Failed to read map file.' }); }

  const gridConfig = { gridOn: false, gridSize: 40, gridOffX: 0, gridOffY: 0, gridOpacity: 40, gridColor: 'white', gridLineWidth: 1 };
  const svgMatch = html.match(/<svg[^>]*>/);
  if (svgMatch) {
    const tag = svgMatch[0];
    const vbMatch = tag.match(/viewBox="([^"]*)"/);
    if (vbMatch) {
      const parts = vbMatch[1].split(/[\s,]+/).map(Number);
      if (parts.length === 4) { meta.vw = parts[2]; meta.vh = parts[3]; }
    }
    const gOn = tag.match(/data-grid-on="([^"]*)"/);
    if (gOn) gridConfig.gridOn = gOn[1] === '1';
    const gSize = tag.match(/data-grid-size="([^"]*)"/);
    if (gSize) gridConfig.gridSize = parseInt(gSize[1]) || 40;
    const gOffX = tag.match(/data-grid-offx="([^"]*)"/);
    if (gOffX) gridConfig.gridOffX = parseInt(gOffX[1]) || 0;
    const gOffY = tag.match(/data-grid-offy="([^"]*)"/);
    if (gOffY) gridConfig.gridOffY = parseInt(gOffY[1]) || 0;
    const gOp = tag.match(/data-grid-opacity="([^"]*)"/);
    if (gOp) gridConfig.gridOpacity = parseInt(gOp[1]) || 40;
    const gCol = tag.match(/data-grid-color="([^"]*)"/);
    if (gCol) gridConfig.gridColor = gCol[1] || 'white';
    const gLW = tag.match(/data-grid-linewidth="([^"]*)"/);
    if (gLW) gridConfig.gridLineWidth = parseFloat(gLW[1]) || 1;
  }

  const zones = [];
  const hitboxRe = /<rect[^>]*class="hitbox"[^>]*>/g;
  let m;
  while ((m = hitboxRe.exec(html)) !== null) {
    const tag = m[0];
    const room = (tag.match(/data-room="([^"]*)"/)||[])[1] || '';
    const desc = (tag.match(/data-desc="([^"]*)"/)||[])[1] || '';
    const x = parseFloat((tag.match(/\bx="([^"]*)"/)||[])[1]) || 0;
    const y = parseFloat((tag.match(/\by="([^"]*)"/)||[])[1]) || 0;
    const w = parseFloat((tag.match(/width="([^"]*)"/)||[])[1]) || 0;
    const h = parseFloat((tag.match(/height="([^"]*)"/)||[])[1]) || 0;
    zones.push({ room: room.replace(/&amp;/g,'&').replace(/&quot;/g,'"'), desc: desc.replace(/&amp;/g,'&').replace(/&quot;/g,'"'), x, y, w, h });
  }

  res.json({ mapKey, title: meta.title, img: meta.img, vw: meta.vw, vh: meta.vh, gridConfig, zones });
});

app.get('/api/maps/list', (req, res) => {
  res.json({ maps: ALLOWED_MAPS.map(k => {
    const meta = MAPS_META[k];
    return { key: k, title: meta ? meta.title : k };
  })});
});

const SCENE1_NPC_PINS = [
  {
    x: 604, y: 46,
    label: 'The Devaronian',
    pin_type: 'npc',
    visibility: 'public',
    owner: 'gm',
    player_name: '',
    color: '#d4a84b',
    player_desc: 'Sits alone in the far alcove, turning a credit chip across his knuckles. Watching everything. Playing nothing. He\'s not waiting for a game — he\'s waiting to see how the evening plays out.',
    gm_notes: 'Professional observer. Might be a scout for one of Varga\'s competitors. Might be nobody. Does not initiate contact. Knows who came in on the Lambda shuttle but won\'t say so unless pressed very carefully. If the players make him feel safe, he can be a source — but his first instinct is to disappear.'
  },
  {
    x: 441, y: 46,
    label: 'The Abyssin Drifters',
    pin_type: 'npc',
    visibility: 'public',
    owner: 'gm',
    player_name: '',
    color: '#d4a84b',
    player_desc: 'Two of them, arguing over a rusted motivator in the center-east booth. Their guttural voices carry across the whole cantina. The argument is real and has been going on long enough that the other patrons have stopped noticing.',
    gm_notes: 'The motivator is stolen and they can\'t agree on a price. They\'ll fight each other before they fight anyone else, but they\'re big enough to be a problem if provoked. Neutral encounter — can provide color, local rumors. Not affiliated with any faction.'
  },
  {
    x: 308, y: 200,
    label: 'The Bith Bartender (Zulo)',
    pin_type: 'npc',
    visibility: 'public',
    owner: 'gm',
    player_name: '',
    color: '#d4a84b',
    player_desc: 'Nervous, attentive, silent. Wipes the same glass on repeat. His oversized eyes track every movement in the room.',
    gm_notes: 'Name: Zulo. He knows who owes what to whom, who\'s armed, and who\'s about to start trouble — but won\'t volunteer information unless he trusts you. Keeps a holdout blaster and a datapad full of names in the utility closet. Deeply aware of the Lambda shuttle outside.'
  },
  {
    x: 392, y: 200,
    label: 'Nela Bren (Togruta)',
    pin_type: 'npc',
    visibility: 'public',
    owner: 'gm',
    player_name: '',
    color: '#d4a84b',
    player_desc: 'Ex-military. Scarred montrals. Nursing a drink at the bar. Hasn\'t looked up once, but her hand never strays far from her hip.',
    gm_notes: 'Name: Nela Bren. She\'s not waiting for anyone — she\'s deciding whether to leave Jakku tonight. She knows things about the Western Reaches that most spacers don\'t, if anyone bothers to ask.'
  }
];

app.post('/api/maps/burning-deck/seed-npcs', async (req, res) => {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
  try {
    const existing = await pool.query(
      "SELECT id, label FROM map_pins WHERE map_key = 'burning-deck' AND pin_type = 'npc'"
    );
    const existingByLabel = {};
    existing.rows.forEach(function(r) { existingByLabel[r.label] = r; });
    let inserted = 0, updated = 0;
    for (const pin of SCENE1_NPC_PINS) {
      if (existingByLabel[pin.label]) {
        await pool.query(
          'UPDATE map_pins SET x=$1, y=$2, color=$3, player_desc=$4, gm_notes=$5, visibility=$6 WHERE id=$7',
          [pin.x, pin.y, pin.color, pin.player_desc, pin.gm_notes, pin.visibility, existingByLabel[pin.label].id]
        );
        updated++;
      } else {
        await pool.query(
          'INSERT INTO map_pins (map_key, x, y, label, pin_type, visibility, owner, player_name, color, player_desc, gm_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          ['burning-deck', pin.x, pin.y, pin.label, pin.pin_type, pin.visibility, pin.owner, pin.player_name, pin.color, pin.player_desc, pin.gm_notes]
        );
        inserted++;
      }
    }
    res.json({ ok: true, inserted, updated, message: 'Scene 1 NPC pins synced to canonical content.' });
  } catch (err) {
    console.error('[seed] NPC pin seed error:', err);
    res.status(500).json({ error: 'Seed failed.' });
  }
});

async function seedScene1Npcs() {
  try {
    const existing = await pool.query(
      "SELECT label FROM map_pins WHERE map_key = 'burning-deck' AND pin_type = 'npc'"
    );
    const existingLabels = new Set(existing.rows.map(function(r) { return r.label; }));

    let inserted = 0;
    for (const pin of SCENE1_NPC_PINS) {
      if (!existingLabels.has(pin.label)) {
        await pool.query(
          'INSERT INTO map_pins (map_key, x, y, label, pin_type, visibility, owner, player_name, color, player_desc, gm_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          ['burning-deck', pin.x, pin.y, pin.label, pin.pin_type, pin.visibility, pin.owner, pin.player_name, pin.color, pin.player_desc, pin.gm_notes]
        );
        inserted++;
      }
    }

    if (inserted > 0) {
      console.log('[seed] Burning Deck Scene 1 NPCs: ' + inserted + ' new pin(s) inserted.');
    } else {
      console.log('[seed] Burning Deck Scene 1 NPCs: all pins already present, nothing inserted.');
    }
  } catch (err) {
    console.error('[seed] NPC pin seed error:', err);
  }
}

const ALL_SCENE_NPC_SEEDS = {
  'switch-lair': [
    {
      x: 512, y: 102, label: 'Switch', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'On an elevated platform at the far end of the bunker — a protocol droid. Silver chassis, scratched and worn but meticulously maintained. Photoreceptors that haven\'t blinked since before the Clone Wars. He doesn\'t greet you. He waits.',
      gm_notes: 'Switch. Protocol droid running a decades-old intelligence network. Will examine the code cylinder for a steep fee — but offers a deal: reduced fee if heroes agree to pass validated intel as they travel (compensated each time). This establishes him as a recurring contact. He controls the two ceiling turrets. He WILL know if you lie. Do not threaten him — the turrets respond to his will.'
    }
  ],
  'vanishing-place': [
    {
      x: 524, y: 389, label: 'Admiral Varth', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'In the detention block, at a makeshift table in a holding cell — a man in a rumpled Imperial uniform, card face-up, a small pile of credit chips beside him. He\'s playing sabacc with two armed guards. When you appear, he doesn\'t reach for a weapon. He doesn\'t stand. He looks at you and says: "You\'re late."',
      gm_notes: 'Admiral Adan Varth. Eight months incarcerated, and he\'s been waiting with extraordinary patience. His authentication key for the Varga encrypted account is memorized — he carries nothing physical. Charming, competent, already calculating. He will want the generator sabotaged to clear Maya\'s flight path — this aligns with Mandrake\'s deal. He is manipulating the crew from the very first sentence. Red Flag Zero: how calm he is about being rescued.'
    }
  ],
  'jungle-trek': [
    {
      x: 513, y: 660, label: 'Vazus Mandrake', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'A figure steps from the treeline — human, weathered, in gear that stopped being Imperial a long time ago. Jungle camouflage, vines braided into the pack straps, a rebreather pushed up on his forehead. He holds out empty hands. His eyes measure you in the first second and his face gives nothing back.',
      gm_notes: 'Vazus Mandrake. Former Republic trooper turned guerrilla — he\'s been fighting the garrison on Ajan Kloss for years protecting the indigenous locals. His deal: guide the heroes to the Vanishing Place in exchange for generator sabotage. The generator powers turrets, fences, security doors, AND sensor grid — sabotaging it serves everyone. He will separate from the group inside the fortress and head to the detention pens when the generator goes down. FATE: Hope-dominant → escapes into jungle with freed people. Toll-dominant → Draco cuts him down as the Banshee lifts.'
    }
  ],
  'blackwind-point': [
    {
      x: 921, y: 479, label: 'Kessra', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'A woman stands on the landing pad like she owns it — because right now, she does. Zabrak, horns ringed with hammered metal, dressed in gang colors under battered armor. Six swoops idling behind her. Her crew fans out without being told. She watches your ship touch down with the patient interest of someone counting what they\'re about to take.',
      gm_notes: 'Kessra. Leader of the Vipers. She runs the landing tax — extortion backed by gang muscle. CONSEQUENCE GATE: how the heroes handle her here determines the aviary ambush in Adv2 P2 S5. Humiliate her → she finds them inside the fortress for personal revenge, releasing raptors in the aviary. Pay without fight → neutral. The gang\'s swoops hover above mud terrain — asymmetric advantage. She is testing the crew\'s strength of will as much as collecting credits.'
    }
  ],
  'filtration-plant': [
    {
      x: 114, y: 334, label: 'Warrick Raden', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'The maintenance shed at the northwest corner is sealed from inside. Trip-wire cans strung ankle-height around the approach. Through a cracked shutter, a faint lamp glow. Someone has been living here. Recently.',
      gm_notes: 'Warrick Raden. Devaronian in his forties. Former Varth middleman — after Varth went dark he tried skimming from Varga, got caught, earned a bounty. Terrified and refuses to go back. Three outcomes: (1) Calm persuasion → full intel: layout, guard rotations, sewer access, court protocols, Varga paranoia triggers. (2) Threaten → thin, unreliable intel under duress. (3) Dark path → Varth suggests delivering him in chains. FATE BRANCHING: see Dead End Tracker. He has a crude GNK sentry droid patrolling the south gate — the sound of it engaging tells him someone is coming.'
    }
  ],
  'throne-room-court': [
    {
      x: 621, y: 510, label: 'Varga the Hutt', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'On the raised dais at the far end of the hall — a Hutt of considerable mass, draped in silk and wearing a crown of hammered durasteel. He watches arrivals with hooded eyes, a goblet in one hand and the weight of absolute authority in the other. The silence before he speaks is deliberate.',
      gm_notes: 'Varga. Crime lord, fortress owner, Act 1 antagonist. Vain, shrewd, genuinely dangerous. Wants to impress and to be impressed. Light/Threaten path: heroes must audition — each demonstrate value. Dark path: heroes deliver Raden in chains → instant credibility, no audition. He will die on the Glorious Chariot in Adv3. TC-663 (Switch\'s embedded droid agent) is somewhere in this court, activated only by code phrase.'
    },
    {
      x: 274, y: 506, label: 'Igren Demos', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'Standing at the edge of the dais, slightly to the side — a Neimoidian in formal court attire, thin fingers folded together, watching arrivals with undisguised calculation. He speaks quietly to Varga and does not look directly at you.',
      gm_notes: 'Igren Demos. Varga\'s majordomo and chief of security. Neimoidian. Untrained Force sensitivity he doesn\'t know he has — he uses it as "instinct." He will die blocking the heroes\' dungeon escape (P2 S8), using Force Slam without understanding what it is. His death is tragic: he was trying to buy his way into Imperial favor by delivering Denia to the Inquisitorius, but the Empire would never accept a Neimoidian. Denia senses his sensitivity as he falls.'
    }
  ],
  'throne-room': [
    {
      x: 341, y: 869, label: 'Igren Demos', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'Blocking the descent to the lower levels — the Neimoidian majordomo, no longer composed. His formal court attire is disheveled, one sleeve torn. He holds a vibro-staff at guard and a Trandoshan bodyguard flanks him on either side. His eyes are wide, pupils dilated. Something about the way he\'s breathing is wrong.',
      gm_notes: 'Demos blocking the dungeon stairs. He uses Force Slam in desperation — a blast of invisible force that he doesn\'t understand. He is not trained; the ability surfaces under extreme stress. MINI-BOSS: kill or incapacitate to pass. When he falls, Denia senses his Force sensitivity: "He was touched by the Force... untrained, but there." His Trandoshan bodyguards are two-rank threats. Varga has already fled in the Glorious Chariot.'
    }
  ],
  'dungeons': [
    {
      x: 104, y: 819, label: 'Jedi Master Denia', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'In the containment area at the end of the block — the largest chamber in the lower dungeon. A force cage holding a narrow bed. Inside: a figure barely breathing, eyes closed. Medical equipment keeping her in something between sleep and death. The air in this room is different. Something reaches outward from it that has no name.',
      gm_notes: 'Jedi Master Denia. In a stasis pod (not cryo — medical preservative coma). Tech check to open safely — fumble and she dies. Every Force-sensitive in the block feels nausea when she\'s disturbed. Igren Demos senses it from anywhere in the palace. Varth\'s comms: "Leave her — she\'s a liability." RED FLAG #1. The heroes must choose. If rescued: she becomes mentor, holocron key (Adv4), eventually captured by Draco (Adv7). If abandoned: Varth tips off Draco off-camera. Either path, she exists in the campaign — the question is who has her.'
    },
    {
      x: 150, y: 290, label: 'Warrick Raden', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'In the common cell above — behind iron bars, not a containment field. A Devaronian sitting against the stone wall. Beaten. Bruised. Alive. He looks up with hollow eyes at whoever comes down those stairs.',
      gm_notes: 'DARK PATH ONLY. Raden is here because the heroes delivered him to Varga in chains. Untouched food tray near the bars. If the heroes rescue him AND escape with him: Varth executes him at the hangar ramp (P2 S9) — "I told you the next time I saw you, I would kill you." RED FLAG #2. If left: fate unknown. This is the campaign\'s first moral weight-bearing moment delivered by the consequences of the heroes\' own decision.'
    }
  ],
  'aviary': [
    {
      x: 830, y: 140, label: 'Kessra', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'On the highest perch platform in the northeast — a figure in dark leather, a control whistle between her teeth, watching you from above with undisguised hatred. Takodana Raptors hit before you see them, dropping from the canopy. She is directing them.',
      gm_notes: 'CONDITIONAL ENCOUNTER — only triggers if heroes humiliated Kessra at Blackwind Point. She has infiltrated the fortress through contacts in Varga\'s security staff, released the raptors, and locked the aviary doors behind her. She commands from elevation using whistle signals — while she commands, the raptors flank and coordinate. Take her down or drive her off and the raptors lose coordination and retreat to the southeast roost. She will flee through the maintenance crawlspace behind the east grow lights if the fight turns against her. She does not want Varga\'s people to catch her here.'
    }
  ],
  'knife-in-the-dark': [
    {
      x: 139, y: 793, label: 'Grakkus', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'The door opens without sound. Three figures slide into the room. The first is massive — a Wookiee, moving with terrifying silence for something that size. His reaching fills the space between the beds. He does not speak.',
      gm_notes: 'Grakkus. Wookiee enforcer. Close-combat monster in confined space — Room 5 was chosen because his reach fills it. The Wookiee from the Iron Ring auction; sold as "arena muscle," activated as an assassin. He is the primary threat. Only two combatants can engage in melee simultaneously in the doorway. If the heroes break out of Room 5, the geometry of the encounter changes entirely. He follows — he does not disengage.'
    },
    {
      x: 411, y: 111, label: 'Skreev', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'Behind the first figure — lean, quiet, moving along the wall rather than through the center. Quarren. He keeps distance and angles for sightlines.',
      gm_notes: 'Skreev. Quarren assassin. Ranged specialist — he hangs back, fires from cover, and relocates between shots. He is coordinating with Grakkus: Grakkus forces heroes to stay in the room, Skreev shoots through the doorway. His vulnerability: if heroes break into the corridor, they close range on him. He will retreat to the north corridor or duck into an empty room to reset the angle.'
    },
    {
      x: 619, y: 554, label: 'Narek', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'The third figure, face hidden in shadow, slips into a room to the side and waits.',
      gm_notes: 'CONDITIONAL — Narek the Twi\'lek poisoner. Only present if heroes exposed or humiliated him during the Iron Ring poison subplot (P2 S2). Otherwise, replace with a generic Iron Ring enforcer. Narek uses coated blades and manufactured poisons — his attacks inflict ongoing debuffs in addition to damage. He prefers flanking angles and enclosed spaces. If not triggered: this pin represents an Iron Ring enforcer in the same position — less dangerous, same tactical role.'
    }
  ],
  'banshee': [
    {
      x: 515, y: 92, label: 'Maya', pin_type: 'npc', visibility: 'public', owner: 'gm', player_name: '', color: '#d4a84b',
      player_desc: 'In the cockpit — a Mirialan woman running pre-flight checks without looking up from the console. Green-gold skin, flight jacket worn soft at the elbows, tattoo patterns along her cheekbones. She knows the Banshee the way some people know a language — without thinking about it.',
      gm_notes: 'Maya. The crew\'s pilot and de facto moral compass. Freelancer who intercepted the code cylinder from Varga\'s supply chain — that one job pulled her into all of this. She is loyal to the crew but has her own ethics and will push back on Varth. Wounded during the Ajan Kloss approach (shrapnel, serious). The slave ship Shackles of Nizon will force her hand in Adv3. CAMPAIGN AXIS: her survival is optional but her absence permanently changes the campaign\'s emotional texture and removes the Ace pilot\'s most meaningful relationship.'
    }
  ]
};

async function seedAllSceneNpcs() {
  let totalInserted = 0;
  for (const [mapKey, pins] of Object.entries(ALL_SCENE_NPC_SEEDS)) {
    try {
      const existing = await pool.query(
        'SELECT label FROM map_pins WHERE map_key = $1 AND pin_type = $2',
        [mapKey, 'npc']
      );
      const existingLabels = new Set(existing.rows.map(function(r) { return r.label; }));
      let inserted = 0;
      for (const pin of pins) {
        if (!existingLabels.has(pin.label)) {
          await pool.query(
            'INSERT INTO map_pins (map_key, x, y, label, pin_type, visibility, owner, player_name, color, player_desc, gm_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            [mapKey, pin.x, pin.y, pin.label, pin.pin_type, pin.visibility, pin.owner, pin.player_name, pin.color, pin.player_desc, pin.gm_notes]
          );
          inserted++;
          totalInserted++;
        }
      }
      if (inserted > 0) console.log('[seed] ' + mapKey + ': ' + inserted + ' NPC pin(s) inserted.');
    } catch (err) {
      console.error('[seed] Error seeding ' + mapKey + ':', err.message);
    }
  }
  if (totalInserted === 0) console.log('[seed] All scene NPC pins already present.');
  else console.log('[seed] Scene NPC pins: ' + totalInserted + ' total inserted across all maps.');
}

socketHandlers(io);

initialize().then(async () => {
  await seedScene1Npcs();
  await seedAllSceneNpcs();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] The Edge of the Empire — listening on port ${PORT}`);
    console.log(`[server] Local:   http://localhost:${PORT}`);
    console.log(`[server] Network: http://<your-local-ip>:${PORT}`);
  });
}).catch(err => {
  console.error('[db] Failed to initialize database:', err);
  process.exit(1);
});
