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
    player_desc: 'In the far corner of the East Alcove, half-lit by the blue glow of the wall-mounted holoscreen. Scarlet skin, sharp horns — a Devaronian, sitting alone with his back to the wall. A credit chip turns slowly across his knuckles — over, under, over — without pause. A sabacc deck sits untouched on the table beside an empty glass. He hasn\'t played a hand all night. He hasn\'t ordered a second drink. He\'s just watching.',
    gm_notes: 'Name: Varek Draal. ISB informant embedded in Reestkii, watching the cantina for unusual arrivals. Not hostile unless threatened. Knows about the Lambda shuttle and who is aboard. Could be a reluctant ally if the players have leverage — he resents ISB control. Plot hook: if players make contact carefully, he can tell them the shuttle belongs to a low-ranking Moff adjutant collecting tribute. He wants out of the informant role and will trade information for passage off Jakku.'
  },
  {
    x: 441, y: 46,
    label: 'The Abyssin Drifters',
    pin_type: 'npc',
    visibility: 'public',
    owner: 'gm',
    player_name: '',
    color: '#d4a84b',
    player_desc: 'Two large figures crammed into the Center-East booth, arguing over a spread of components on the table between them — wires, a pulled-apart motivator, metal parts laid out like surgery. Deep, guttural voices carrying across the cantina. One slaps the table for emphasis. Drinks rattle. Neither looks up.',
    gm_notes: 'Names: Gorrum and Skath. Abyssin scavengers, not affiliated with any faction. Arguing over whether the motivator they found in the Jakku flats is worth anything. Gorrum thinks yes (wants to sell it to Varga\'s people). Skath thinks it\'s Imperial junk. They are NOT aware of the Lambda shuttle\'s significance. Neutral encounter — can provide color, local rumors, or be a distraction. If players buy them a round, they\'ll talk freely about recent Imperial patrol increases near the Graveyard.'
  },
  {
    x: 308, y: 200,
    label: 'The Bith Bartender (Zulo)',
    pin_type: 'npc',
    visibility: 'public',
    owner: 'gm',
    player_name: '',
    color: '#d4a84b',
    player_desc: 'The bartender — a Bith, round-headed, oversized dark eyes — stands behind the counter wiping the same glass he has been wiping since you sat down. Eyes flicking to the blast doors every few seconds. He hasn\'t spoken to anyone unprompted all night. The bottles behind him are arranged with precision. The tap system hisses quietly.',
    gm_notes: 'Name: Zulo. Has run The Burning Deck for 11 years. Deeply nervous about the Lambda shuttle — he knows exactly what it means. Owes protection fees to Varga the Hutt, which means he\'s in a bind: if Imperial attention increases, Varga pulls back and Zulo loses his protection. Will not talk about the shuttle openly. If players press him privately, he confirms the adjutant\'s name: Prefect Odael Marne. Knows Nela Bren is trouble but won\'t say why. Key NPC for local context and scene grounding.'
  },
  {
    x: 392, y: 200,
    label: 'Nela Bren (Togruta)',
    pin_type: 'npc',
    visibility: 'public',
    owner: 'gm',
    player_name: '',
    color: '#d4a84b',
    player_desc: 'At the far end of the bar, alone on the last stool, facing the wall. A Togruta — the striped montrals are unmistakable, even from across the room. Head slightly bowed over a single drink she has been nursing for a long time. The parallel scars on her montrals are old, healed white. She has not looked up once. Her right hand has not moved far from her hip all night.',
    gm_notes: 'Name: Nela Bren. Togruta. Former Separatist intelligence officer, now a freelance fixer operating out of the Jakku Graveyard. She is the players\' contact — the fixer they have been waiting for. She is an hour late because she was watching from a rooftop to see if they were followed. She knows about the Lambda shuttle and the players\' job. Will not initiate contact in the open. If approached with the code phrase ("the tide is wrong"), she moves to the East Alcove to talk privately. Mission briefing: the players need to retrieve a Separatist-era data core from the Graveyard before the Empire\'s adjutant does.'
  }
];

app.post('/api/maps/burning-deck/seed-npcs', async (req, res) => {
  if (req.userRole !== 'gm') return res.status(403).json({ error: 'GM access required.' });
  try {
    const existing = await pool.query(
      "SELECT count(*) FROM map_pins WHERE map_key = 'burning-deck' AND pin_type = 'npc'"
    );
    if (parseInt(existing.rows[0].count) > 0) {
      return res.json({ ok: true, skipped: true, message: 'NPC pins already seeded.' });
    }
    for (const pin of SCENE1_NPC_PINS) {
      await pool.query(
        'INSERT INTO map_pins (map_key, x, y, label, pin_type, visibility, owner, player_name, color, player_desc, gm_notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        ['burning-deck', pin.x, pin.y, pin.label, pin.pin_type, pin.visibility, pin.owner, pin.player_name, pin.color, pin.player_desc, pin.gm_notes]
      );
    }
    res.json({ ok: true, seeded: SCENE1_NPC_PINS.length, message: 'Scene 1 NPC pins seeded.' });
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

socketHandlers(io);

initialize().then(async () => {
  await seedScene1Npcs();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] The Edge of the Empire — listening on port ${PORT}`);
    console.log(`[server] Local:   http://localhost:${PORT}`);
    console.log(`[server] Network: http://<your-local-ip>:${PORT}`);
  });
}).catch(err => {
  console.error('[db] Failed to initialize database:', err);
  process.exit(1);
});
