# The Leviathan Affair

A Star Wars TTRPG electronic character sheet and campaign management system built for local network play.

## Run & Operate

```bash
npm run dev        # Starts nodemon server and Tailwind CSS watch for development
npm start          # Starts production Node.js server only
npm run css:build  # One-shot Tailwind CSS build
```

The server listens on `0.0.0.0:5000`.

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string.
- `PLAYER_PASSCODE`: Passcode for player role access.
- `GM_PASSCODE`: Passcode for GM role (full access).
- `GEMINI_API_KEY`: API key for Gemini AI services.

## Stack

- **Runtime:** Node.js 20
- **Server:** Express, Socket.io (for real-time communication)
- **Database:** PostgreSQL (`pg` module)
- **CSS:** Tailwind CSS v3
- **ORM:** _Populate as you build_
- **Validation:** _Populate as you build_
- **Build Tool:** npm scripts, Tailwind CLI

## Where things live

- `public/`: Static assets served directly (HTML, CSS, JS, images, audio).
  - `public/index.html`: Landing page.
  - `public/login.html`: Authentication gate.
  - `public/css/output.css`: Compiled Tailwind CSS (do not edit).
  - `public/maps/`: Standalone interactive tactical maps.
- `css/input.css`: Main Tailwind CSS source, including themes.
- `js/`: Client-side JavaScript modules for various features.
- `data/`: JSON data files (weapons, armor, species, vocations, adventures, etc.).
  - `data/schemas/downtime-system.md`: DB schema for downtime system.
  - `data/schemas/group-challenge.md`: Group challenge schema.
- `server/`: Server-side Node.js code.
  - `server/index.js`: Main server entry point.
  - `server/db.js`: Database initialization and seeding.
  - `server/routes/`: REST API endpoints.
  - `server/sockets/`: Socket.io event handlers.
- `tailwind.config.js`: Tailwind CSS configuration.

## Architecture decisions

- **Passcode-based Authentication:** Instead of traditional user accounts, a simple passcode system (PLAYER_PASSCODE, GM_PASSCODE) with cookie-based authorization is used for quick local network setup.
- **Client-side Storage Policy:** All browser `localStorage` interactions are strictly centralized through `js/lib/persist.js` to ensure namespacing, migration, and prevent direct `localStorage` calls.
- **Visibility-aware Timers:** All recurring client-side timers (`setInterval`) are designed to pause when the browser tab is hidden (`document.hidden`) to optimize resource usage and prevent unnecessary background activity.
- **Socket Broadcast Policy:** High-frequency updates use small patch events (e.g., `combat:token-position-patch`) to minimize payload size, while full-state broadcasts are reserved for authoritative transitions (`combat:state-update`).
- **Data Serialization:** Character data strictly adheres to a "character creator format" (`discValues`, `arenaAdj`, `startingGear`, `kits`, etc.) to maintain a single source of truth and simplify data expansion.

## Product

- **Electronic Character Sheet:** Interactive player character sheet (`/player/`) with real-time updates.
- **Campaign Management:** GM-facing "Black Ledger" (`/gm/`) for managing adventures, scenes, NPCs, and campaign state.
- **Real-time Tactical Maps:** Interactive, broadcastable tactical maps with token movement, zone highlighting, and GM controls.
- **Character Creation Wizard:** Guided, multi-phase character creation with species, background, vocation, and destiny selection.
- **In-game Economy:** Black Market for purchasing gear, and a Debt System for credit management.
- **Dynamic Narrative:** Adaptive adventure content based on player/GM decisions.
- **AI-Powered Tools:** Backstory generator for characters and mission summary generator for campaigns.
- **HoloNet News Feed:** GM-triggered in-universe propaganda and news broadcasts to players.
- **Narrative Challenge Engine:** Branching narrative choices tied to character destiny and impact on the game world.

## User preferences

- _Populate as you build_

## Gotchas

- **CSS Edits:** Never edit `public/css/output.css` directly; make changes in `css/input.css` and run `npm run css:build` or `npm run dev`.
- **Synchronous I/O:** Avoid `fs.readFileSync`/`writeFileSync` in server request/event paths; use `fs/promises` and `await` to prevent blocking the Node.js event loop.
- **DB Query Loops:** Do not issue one database query per item in a loop. Use batched queries (`WHERE id = ANY($1::int[])`) for efficiency.
- **Inline Styles:** Avoid static `style="..."` attributes or `element.style.X = ...` assignments in HTML/JS. Use CSS classes instead, with `display:none` as a documented exception for dynamic visibility toggles.
- **Module Caching:** For static reference data on the server, cache the parsed result at module scope behind a memoized in-flight promise to prevent redundant disk reads.

## Pointers

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Express.js Documentation](https://expressjs.com/)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js File System Promises API](https://nodejs.org/api/fs.html#fspromisesaccesspathmode)
- [Google Gemini API Documentation](https://ai.google.dev/)