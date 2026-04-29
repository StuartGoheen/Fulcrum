#!/usr/bin/env node
/**
 * Atlas Wookieepedia Audit
 *
 * Fetches the Wookieepedia Legends infobox for an atlas slug (Canon fallback for
 * canon-only worlds), downloads the lead orbital image, and writes a per-slug
 * audit JSON to data/atlas/_audits/<slug>.json showing Legends-vs-ours diffs.
 *
 * Usage:
 *   node scripts/atlas-wookieepedia-audit.js <slug> [<slug2> ...]
 *   node scripts/atlas-wookieepedia-audit.js --priority
 *   node scripts/atlas-wookieepedia-audit.js --all
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const ATLAS_DIR = path.join(ROOT, 'data', 'atlas');
const AUDIT_DIR = path.join(ATLAS_DIR, '_audits');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'atlas');

const FANDOM_API = 'https://starwars.fandom.com/api.php';
const USER_AGENT = 'LeviathanAffair-AtlasAudit/1.0 (TTRPG fan project; contact: replit dev)';

// 12 priority slugs (campaign-flagged + adv3 side stops)
const PRIORITY = [
  'ajan-kloss', 'batuu', 'bespin', 'endor', 'eriadu',
  'jakku', 'malpaz', 'takodana', 'xala',
  'kessel', 'klatooine', 'sriluur',
];

// Worlds with no Wookieepedia entry — original campaign fiction
const ORIGINAL_FICTION = new Set(['malpaz', 'xala']);

// Worlds that exist ONLY in Disney canon (no /Legends article on Wookieepedia).
// For everything else, this script REQUIRES a Legends article and will hard-fail
// if one cannot be found — silent canon fallback would violate the audit policy
// for Task #232/#233 (Legends is the comparison standard).
const CANON_ONLY = new Set(['batuu', 'ajan-kloss', 'jakku', 'takodana']);

// Title overrides (slug → Wookieepedia page title) where slug-from-name doesn't match.
// Note: do NOT add a slug here unless the slug-from-name conversion actually fails.
// e.g. 'endor' → 'Endor' works correctly; an override to 'Forest Moon of Endor'
// would silently break Legends lookup because that page redirects, not /Legends.
const TITLE_OVERRIDES = {
  'clakdor-vii': "Clak'dor VII",
  'lotho-minor': 'Lotho Minor',
  'ord-mantell': 'Ord Mantell',
  'ponemah-terminal': 'Ponemah Terminal',
  'sluis-van': 'Sluis Van',
  'yagdhul': "Yag'Dhul",
};

// ---------- HTTP ----------

function httpsGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': USER_AGENT, ...(opts.headers || {}) },
    }, res => {
      // follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        return resolve(httpsGet(next, opts));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

async function fetchJson(url) {
  const res = await httpsGet(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`);
  return JSON.parse(res.body.toString('utf8'));
}

async function fetchBuffer(url) {
  const res = await httpsGet(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.body;
}

// ---------- MediaWiki ----------

async function fetchWikitext(title) {
  const url = `${FANDOM_API}?action=parse&page=${encodeURIComponent(title)}&format=json&prop=wikitext&redirects=1`;
  try {
    const data = await fetchJson(url);
    if (data.error) return null;
    return { title: data.parse?.title || title, wikitext: data.parse?.wikitext?.['*'] || null };
  } catch (e) {
    return null;
  }
}

async function fetchPageImage(title) {
  const url = `${FANDOM_API}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=1280&redirects=1`;
  try {
    const data = await fetchJson(url);
    const pages = data.query?.pages || {};
    for (const id in pages) {
      if (pages[id].thumbnail) return pages[id].thumbnail.source;
    }
  } catch (e) { /* swallow */ }
  return null;
}

// ---------- Wikitext parsing ----------

function findInfoboxBlock(wikitext) {
  if (!wikitext) return null;
  // Wookieepedia planet pages use {{CelestialBody|...}}, {{Astrography|...}},
  // or other planet-shaped templates — never literally "Infobox". Walk every
  // top-level {{...}} block and return the first one that contains planet-shape
  // fields like |region=, |sector=, |climate=, or |hyperlanes=.
  let i = 0;
  const planetMarkers = /\|\s*(region|sector|climate|terrain|hyperlanes?|atmosphere|gravity|suns|moons)\s*=/i;
  while (i < wikitext.length) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') {
      const start = i;
      let depth = 0;
      for (let j = i; j < wikitext.length; j++) {
        if (wikitext[j] === '{' && wikitext[j + 1] === '{') { depth++; j++; }
        else if (wikitext[j] === '}' && wikitext[j + 1] === '}') {
          depth--; j++;
          if (depth === 0) {
            const block = wikitext.slice(start, j + 1);
            if (planetMarkers.test(block)) return block;
            i = j + 1;
            break;
          }
        }
        if (j === wikitext.length - 1) return null;
      }
    } else {
      i++;
    }
  }
  return null;
}

function splitTopLevel(infobox) {
  // Strip the outer {{ }} then split on top-level | tokens.
  const inner = infobox.slice(2, -2);
  const out = [];
  let buf = '';
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if ((c === '{' && inner[i + 1] === '{') || (c === '[' && inner[i + 1] === '[')) { depth++; buf += c + inner[i + 1]; i++; continue; }
    if ((c === '}' && inner[i + 1] === '}') || (c === ']' && inner[i + 1] === ']')) { depth--; buf += c + inner[i + 1]; i++; continue; }
    if (c === '|' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += c;
  }
  if (buf) out.push(buf);
  return out;
}

function parseInfoboxFields(wikitext) {
  const block = findInfoboxBlock(wikitext);
  if (!block) return {};
  const parts = splitTopLevel(block);
  const fields = {};
  // First part is template name
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    const key = parts[i].slice(0, eq).trim().toLowerCase();
    const val = parts[i].slice(eq + 1).trim();
    if (key && val) fields[key] = val;
  }
  return fields;
}

function cleanWikitext(s) {
  if (!s) return '';
  let out = s;
  // Strip HTML refs/comments
  out = out.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  // Convert <br> to separator
  out = out.replace(/<br\s*\/?>/gi, '; ');
  // Strip simple templates {{X}} → '', {{X|Y}} → Y
  // Also handle {{C|...}} which Wookieepedia uses for citations
  out = out.replace(/\{\{[Cc]\|[^}]*\}\}/g, '');
  out = out.replace(/\{\{[^|{}]*\|([^|{}]*)\}\}/g, '$1');
  out = out.replace(/\{\{[^{}]*\}\}/g, '');
  // Convert wiki links [[X|Y]] → Y, [[X]] → X
  out = out.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
  out = out.replace(/\[\[([^\]]+)\]\]/g, '$1');
  // Strip bold/italic markers
  out = out.replace(/'''/g, '').replace(/''/g, '');
  // Convert wiki list bullets to commas
  out = out.replace(/\n\s*\*\s*/g, ', ').replace(/^\s*\*\s*/g, '');
  // Collapse whitespace
  out = out.replace(/\s+/g, ' ').trim();
  // Trim trailing punctuation noise
  out = out.replace(/^[,;:\s]+|[,;:\s]+$/g, '');
  return out;
}

// ---------- Audit ----------

function slugToTitle(slug) {
  if (TITLE_OVERRIDES[slug]) return TITLE_OVERRIDES[slug];
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function imageExtFromUrl(url) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.(png|jpe?g|gif|webp|svg)/i);
    if (m) return m[1].toLowerCase().replace('jpeg', 'jpg');
  } catch (e) {}
  return 'jpg';
}

async function auditSlug(slug, opts = {}) {
  const ourPath = path.join(ATLAS_DIR, `${slug}.json`);
  if (!fs.existsSync(ourPath)) {
    console.error(`[${slug}] entry not found at ${ourPath}`);
    return null;
  }
  const ours = JSON.parse(fs.readFileSync(ourPath, 'utf8'));
  fs.mkdirSync(AUDIT_DIR, { recursive: true });

  const oursSummary = {
    region: ours.region,
    sector: ours.sector,
    type: ours.type,
    climate: ours.common?.climate,
    terrain: ours.common?.terrain,
    hyperlanes: ours.common?.hyperlanes,
    government: ours.common?.government,
    affiliation: ours.common?.affiliation,
  };

  // Original-fiction worlds: skip Wookieepedia
  if (ORIGINAL_FICTION.has(slug)) {
    const audit = {
      slug,
      name: ours.name,
      legendsSource: 'NONE — original campaign fiction',
      ours: oursSummary,
      legends: null,
      diffs: [],
      image: { downloaded: false, note: 'no Wookieepedia entry — image stays as-is' },
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(AUDIT_DIR, `${slug}.json`), JSON.stringify(audit, null, 2));
    console.log(`[${slug}] original fiction — no legends source`);
    return audit;
  }

  const baseTitle = slugToTitle(slug);
  const isCanonOnly = CANON_ONLY.has(slug);
  // Source policy: Legends is mandatory unless the slug is on the canon-only
  // allowlist. No silent fallback — if a non-canon-only world's /Legends page
  // is missing, hard-fail so the operator can either add it to CANON_ONLY (if
  // the world legitimately has no Legends article) or fix the title override.
  const tryTitles = isCanonOnly ? [baseTitle] : [`${baseTitle}/Legends`];

  let wikitextResult = null;
  for (const t of tryTitles) {
    const r = await fetchWikitext(t);
    if (r && r.wikitext) { wikitextResult = r; break; }
  }
  if (!wikitextResult) {
    const msg = isCanonOnly
      ? `[${slug}] no Canon wikitext found for ${baseTitle}`
      : `[${slug}] no Legends wikitext at ${baseTitle}/Legends — if this world is canon-only add slug to CANON_ONLY, otherwise fix TITLE_OVERRIDES`;
    console.error(msg);
    return null;
  }

  const sourceTitle = wikitextResult.title;
  const sourceUrl = `https://starwars.fandom.com/wiki/${encodeURIComponent(sourceTitle.replace(/ /g, '_'))}`;
  const isLegends = /\/Legends$/i.test(sourceTitle);
  // Defense in depth: if we asked for Legends but the API resolved to Canon
  // (e.g. via redirect), refuse rather than silently downgrade the audit.
  if (!isCanonOnly && !isLegends) {
    console.error(`[${slug}] requested Legends but resolved to Canon (${sourceTitle}); refusing to audit`);
    return null;
  }
  const ibox = parseInfoboxFields(wikitextResult.wikitext);

  const legends = {
    region:      cleanWikitext(ibox.region),
    sector:      cleanWikitext(ibox.sector),
    system:      cleanWikitext(ibox.system),
    suns:        cleanWikitext(ibox.suns),
    moons:       cleanWikitext(ibox.moons),
    rotation:    cleanWikitext(ibox.rotation),
    orbital:     cleanWikitext(ibox.orbital),
    diameter:    cleanWikitext(ibox.diameter),
    climate:     cleanWikitext(ibox.climate),
    terrain:     cleanWikitext(ibox.terrain),
    atmosphere:  cleanWikitext(ibox.atmosphere),
    gravity:     cleanWikitext(ibox.gravity),
    species:     cleanWikitext(ibox.species),
    population:  cleanWikitext(ibox.population),
    capital:     cleanWikitext(ibox.capital),
    language:    cleanWikitext(ibox.language),
    government:  cleanWikitext(ibox.government),
    hyperlanes:  cleanWikitext(ibox.hyperlanes || ibox.hyperlane),
    affiliation: cleanWikitext(ibox.affiliation || ibox['era affiliation']),
  };

  // Normalized token-set diff across high-signal fields. We lowercase, strip
  // parentheticals, drop tiny stop-tokens, and compare the meaningful tokens
  // each side has. A field is reported as a diff if Legends has any
  // significant token absent from ours, or vice versa. This catches both
  // "wrong sector name" and partial-match drift (e.g. ours "Forests, lakes"
  // vs Legends "Forests, lakes, mountains, oceans").
  const STOP = new Set(['the','a','an','of','and','or','to','in','on','at','de','sector','system','region','territories']);
  function tokens(val) {
    if (!val) return [];
    return String(val)
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')        // drop parentheticals
      .replace(/[^a-z0-9'\-\s]/g, ' ')   // keep word chars, apostrophes, hyphens
      .split(/\s+/)
      .filter(t => t.length >= 3 && !STOP.has(t));
  }
  function compareField(oursVal, legVal) {
    const o = new Set(tokens(oursVal));
    const l = new Set(tokens(legVal));
    if (l.size === 0 || o.size === 0) return null;
    const missingFromOurs = [...l].filter(t => !o.has(t));
    const missingFromLegends = [...o].filter(t => !l.has(t));
    if (!missingFromOurs.length && !missingFromLegends.length) return null;
    return { missingFromOurs, missingFromLegends };
  }
  const diffs = [];
  function diff(field, oursVal, legVal) {
    if (!legVal || !oursVal) return;
    const cmp = compareField(oursVal, legVal);
    if (cmp) diffs.push({ field, ours: oursVal, legends: legVal, ...cmp });
  }
  diff('region', ours.region, legends.region);
  diff('sector', ours.sector, legends.sector);
  diff('climate', ours.common?.climate, legends.climate);
  diff('terrain', Array.isArray(ours.common?.terrain) ? ours.common.terrain.join(', ') : ours.common?.terrain, legends.terrain);
  diff('hyperlanes', Array.isArray(ours.common?.hyperlanes) ? ours.common.hyperlanes.join(', ') : ours.common?.hyperlanes, legends.hyperlanes);
  diff('government', ours.common?.government, legends.government);

  // Image
  let imageInfo = { downloaded: false };
  const imgUrl = await fetchPageImage(sourceTitle);
  if (imgUrl) {
    fs.mkdirSync(IMG_DIR, { recursive: true });
    const ext = imageExtFromUrl(imgUrl);
    const filename = `${slug}.${ext}`;
    const localPath = path.join(IMG_DIR, filename);
    try {
      const buf = await fetchBuffer(imgUrl);
      fs.writeFileSync(localPath, buf);
      imageInfo = {
        downloaded: true,
        sourceImageUrl: imgUrl,
        localFile: filename,
        localPath: `/images/atlas/${filename}`,
        bytes: buf.length,
      };
    } catch (e) {
      imageInfo = { downloaded: false, sourceImageUrl: imgUrl, error: String(e) };
    }
  } else {
    imageInfo = { downloaded: false, note: 'no page image found via PageImages API' };
  }

  const audit = {
    slug,
    name: ours.name,
    sourceTitle,
    sourceUrl,
    sourceTier: isLegends ? 'Legends' : 'Canon',
    ours: oursSummary,
    legends,
    diffs,
    image: imageInfo,
    license: 'CC BY-SA 3.0',
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(AUDIT_DIR, `${slug}.json`), JSON.stringify(audit, null, 2));
  console.log(`[${slug}] ${sourceTitle} (${audit.sourceTier}) — ${diffs.length} diffs, image ${imageInfo.downloaded ? 'OK ' + imageInfo.bytes + 'B' : 'SKIP'}`);
  return audit;
}

// ---------- CLI ----------

async function main() {
  const args = process.argv.slice(2);
  let slugs;
  if (args.includes('--all')) {
    slugs = fs.readdirSync(ATLAS_DIR).filter(f => f.endsWith('.json') && f !== '_manifest.json').map(f => f.replace('.json', ''));
  } else if (args.includes('--priority')) {
    slugs = PRIORITY;
  } else {
    slugs = args.filter(a => !a.startsWith('--'));
  }
  if (!slugs.length) {
    console.error('Usage: node scripts/atlas-wookieepedia-audit.js <slug>... | --priority | --all');
    process.exit(1);
  }
  for (const slug of slugs) {
    try { await auditSlug(slug); }
    catch (e) { console.error(`[${slug}] error:`, e.message); }
    await new Promise(r => setTimeout(r, 400)); // be polite
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { auditSlug, PRIORITY };
