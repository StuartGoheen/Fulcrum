#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ATLAS_DIR = path.join(ROOT, 'data', 'atlas');
const MANIFEST_PATH = path.join(ATLAS_DIR, '_manifest.json');
const PLANETS_PATH = path.join(ROOT, 'data', 'galaxy-planets.json');
const LOCATIONS_PATH = path.join(ROOT, 'data', 'locations.json');

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function buildAtlasEntry(planet, location) {
  const slug = slugify(planet.name);

  const common = {
    tagline: '',
    government: '',
    affiliation: '',
    climate: '',
    terrain: [],
    hyperlanes: [],
    famousFor: '',
    cantinaReputation: planet.desc || '',
    standingCurrency: 'Imperial credits',
    astrography: null,
    physical: null,
    society: null
  };

  if (location && location.astrography) {
    common.astrography = location.astrography;
    if (location.astrography.tradeRoutes) common.hyperlanes = location.astrography.tradeRoutes;
  }
  if (location && location.physical) {
    common.physical = location.physical;
    common.climate = location.physical.climate || '';
    common.terrain = location.physical.terrain || [];
  }
  if (location && location.society) {
    common.society = location.society;
    common.government = location.society.government || '';
    common.affiliation = location.society.affiliation || '';
  }

  // Insider tier — populated from locations.json keyLocations / pointsOfInterest
  // when available. Hand-authored later for Act-1 core planets.
  const insider = {
    localContacts: [],
    pointsOfInterest: (location && location.pointsOfInterest) || [],
    politicalTensions: '',
    smugglerRoutes: [],
    whoRunsTheDocks: '',
    keyLocations: (location && location.campaignNotes && location.campaignNotes.keyLocations) || {}
  };

  // GM tier — empty by default; hand-authored for Act-1 core planets.
  const gm = {
    plotHooks: [],
    hiddenTruths: [],
    secretFactions: [],
    gmNotes: ''
  };

  return {
    slug,
    name: planet.name,
    region: planet.region || (location && location.astrography && location.astrography.region) || '',
    sector: planet.sector || (location && location.astrography && location.astrography.sector) || '',
    gridSquare: planet.gridSquare || (location && location.astrography && location.astrography.gridSquare) || '',
    x: planet.x,
    y: planet.y,
    isCampaignWorld: !!planet.campaign,
    common,
    insider,
    gm,
    image: {
      src: null,
      credit: '',
      license: '',
      attributionUrl: '',
      alt: planet.name
    },
    campaignNotes: {
      adventures: (location && location.campaignNotes && location.campaignNotes.adventures) || [],
      era: (location && location.campaignNotes && location.campaignNotes.era) || ''
    },
    fauna: (location && location.fauna) || [],
    flora: (location && location.flora) || []
  };
}

function main() {
  ensureDir(ATLAS_DIR);

  const planets = readJson(PLANETS_PATH);
  const locationsWrap = readJson(LOCATIONS_PATH);
  const locations = (locationsWrap && locationsWrap.locations) || [];
  const locationsBySlug = {};
  for (const loc of locations) {
    locationsBySlug[loc.id] = loc;
  }

  let created = 0;
  let skipped = 0;
  const slugList = [];

  // Mutate galaxy-planets.json in place to add a `slug` field on every entry
  let planetsChanged = false;
  for (const planet of planets) {
    const slug = slugify(planet.name);
    if (planet.slug !== slug) {
      planet.slug = slug;
      planetsChanged = true;
    }
    slugList.push(slug);

    const filePath = path.join(ATLAS_DIR, slug + '.json');
    if (fs.existsSync(filePath)) {
      skipped++;
      continue;
    }
    const entry = buildAtlasEntry(planet, locationsBySlug[slug]);
    writeJson(filePath, entry);
    created++;
  }

  if (planetsChanged) {
    writeJson(PLANETS_PATH, planets);
    console.log('[migrate-atlas] Updated data/galaxy-planets.json with slug fields');
  }

  // Build manifest in display order: campaign worlds first (sorted by region/name),
  // then the rest alphabetically.
  const ordered = planets
    .slice()
    .sort((a, b) => {
      const ac = a.campaign ? 0 : 1;
      const bc = b.campaign ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return String(a.name).localeCompare(String(b.name));
    })
    .map(p => slugify(p.name));

  // Allow extra Atlas entries that exist on disk but aren't in galaxy-planets.json
  // (Act-1 worlds added by hand). Append them at the end of the manifest.
  const onDisk = fs.readdirSync(ATLAS_DIR)
    .filter(f => f.endsWith('.json') && f !== '_manifest.json')
    .map(f => f.replace(/\.json$/, ''));
  for (const s of onDisk) {
    if (!ordered.includes(s)) ordered.push(s);
  }

  writeJson(MANIFEST_PATH, { slugs: ordered });

  console.log(`[migrate-atlas] created=${created} skipped=${skipped} manifestEntries=${ordered.length}`);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(e); process.exit(1); }
}

module.exports = { slugify, buildAtlasEntry };
