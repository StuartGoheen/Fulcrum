# Edge of the Empire — Campaign System

A Star Wars TTRPG electronic character sheet and campaign management system built for local network play.

## Architecture

**Runtime:** Node.js 20  
**Server:** Express + Socket.io (real-time multiplayer via WebSockets)  
**Database:** SQLite via `better-sqlite3` (stored at `db/campaign.db`)  
**CSS:** Tailwind CSS v3 (source: `css/input.css` → output: `public/css/output.css`)

## Project Structure

```
├── public/               # Served as static root
│   ├── index.html        # Landing page (Player / GM / Market selection)
│   ├── icon.svg
│   ├── gm/index.html     # GM Command Bridge
│   ├── player/index.html # Player character sheet
│   ├── create/index.html # Character creation wizard
│   ├── market/index.html # Black Market browser
│   └── css/output.css    # Generated — do not edit directly
├── css/
│   ├── input.css         # Tailwind source (custom components + layers)
│   └── themes.css        # CSS variable theme definitions
├── js/                   # Client-side JavaScript modules
├── data/                 # JSON data files (weapons, armor, gear, etc.)
├── assets/               # Images and icons
├── db/                   # SQLite database (gitignored)
├── server/
│   ├── index.js          # Express + Socket.io entrypoint (port 5000)
│   ├── db.js             # Database init, schema, seeding
│   ├── routes/           # REST API routes (characters, campaign, equipment)
│   └── sockets/          # Socket.io event handlers
└── tailwind.config.js    # Tailwind config (scans public/**/*.html + js/**/*.js)
```

## Running the App

```bash
npm run dev        # nodemon server + Tailwind CSS watch (development)
npm start          # production node server only
npm run css:build  # one-shot CSS build
```

Server listens on `0.0.0.0:5000`.

## API Endpoints

- `GET  /api/characters` — list characters with connection status
- `GET  /api/campaign/state` — full campaign state
- `GET  /api/equipment/:charId` — character equipment statuses
- `POST /api/equipment/:charId/:itemId` — update item status
- `GET  /api/health` — health check

## Ammo Power Bar System

Each ranged weapon in `data/weapons.json` now has a `clipSize` field (ammo capacity). Melee weapons have no `clipSize`.

The weapon card header in both `js/armory-panel.js` and `js/loadout-panel.js` renders a `_buildAmmoBar(clipSize)` function that outputs a segmented 8-bar readout styled like a Star Wars blaster power pack:
- **≥ 75% full** → green (`#22c55e`) with green glow
- **30–75% full** → amber (`#f59e0b`) with amber glow
- **< 30% full** → red (`#ef4444`) with red glow

Bars are stored on DOM elements as `data-clip-size` and `data-ammo-pct` for future ammo-tracking integration. All bars initialize at 100%. CSS class: `.wpn-ammo-bar`, `.wpn-ammo-seg`, `.wpn-ammo-seg-empty`.

**Clip sizes assigned:**
- Hold-outs (Q-2, Happy Surprise, Quickfire-4): 8
- Lightning Gun: 6 (stated in trait)
- DC-15s Sidearm: 20
- Intimidator, KYD-21, Lancer, Luxan, QuickSnap, E-5, DDC Defender, Quick-Six: 50
- Standard rifles/pistols (DL-18, DH-17, Westar, Relby, Bryar, E-11, DC-15 Rifle, EE-3, A280): 100
- DLT-19 (belt-fed): 200

## Database

SQLite database auto-created and seeded on first run at `db/campaign.db`.  
Tables: `characters`, `campaign_state`, `equipment_status`, `sessions`.

## Deployment

Configured as a **VM** deployment (always-on required for Socket.io persistent connections).  
Build command: `npm run css:build`  
Run command: `node server/index.js`
