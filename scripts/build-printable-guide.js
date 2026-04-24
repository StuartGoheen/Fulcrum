#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const adventureId = process.argv[2] || 'adv1';
const inputPath = path.join(__dirname, '..', 'data', 'adventures', `${adventureId}.json`);
const outputPath = path.join(__dirname, '..', 'docs', 'printable', `${adventureId}-guide.md`);
const mapsDir = path.join(__dirname, '..', 'public', 'maps');

const adv = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// === Map hitbox loader ===
// Reads public/maps/<mapKey>.html and extracts each <rect class="hitbox">'s
// data-room + data-desc. These are the canonical map rooms — the JSON
// tacticalMap.zones grid is legacy/secondary and should not drive output.
const mapCache = new Map();
function decodeHtmlAttr(s) {
  if (!s) return '';
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
function loadMapRooms(mapKey) {
  if (!mapKey) return null;
  if (mapCache.has(mapKey)) return mapCache.get(mapKey);
  const file = path.join(mapsDir, `${mapKey}.html`);
  if (!fs.existsSync(file)) {
    mapCache.set(mapKey, null);
    return null;
  }
  const html = fs.readFileSync(file, 'utf8');
  // Match each <rect ... class="hitbox" ... /> block (attributes can span lines)
  const rooms = [];
  const rectRe = /<rect\b([^>]*?class="hitbox"[^>]*?)\/?>/gs;
  let m;
  while ((m = rectRe.exec(html)) !== null) {
    const attrs = m[1];
    const room = /data-room="([^"]*)"/.exec(attrs);
    const desc = /data-desc="([^"]*)"/.exec(attrs);
    if (!room) continue;
    rooms.push({
      room: decodeHtmlAttr(room[1]),
      desc: decodeHtmlAttr(desc ? desc[1] : ''),
    });
  }
  // Pull a title if present
  const titleMatch = /<title>([^<]+)<\/title>/.exec(html);
  const result = {
    title: titleMatch ? decodeHtmlAttr(titleMatch[1]).trim() : null,
    rooms,
    imageRel: `public/maps/${mapKey}.png`,
  };
  mapCache.set(mapKey, result);
  return result;
}

const out = [];
const w = (s = '') => out.push(s);

function clean(s) {
  if (!s) return '';
  return String(s).replace(/\r\n/g, '\n').trim();
}

function blockquote(s) {
  return clean(s).split('\n').map(l => '> ' + l).join('\n');
}

function rule() { w(''); w('---'); w(''); }

function bulletList(items, fmt = (x) => x) {
  return items.filter(Boolean).map(i => `- ${fmt(i)}`).join('\n');
}

function fmtArenaLine(arenas) {
  if (!arenas) return '';
  const parts = ['physique', 'reflex', 'grit', 'wits', 'presence']
    .map(k => arenas[k] != null ? `${k[0].toUpperCase() + k.slice(1)} ${arenas[k]}` : null)
    .filter(Boolean);
  return parts.join(' · ');
}

function fmtNpc(npc) {
  const lines = [];
  const head = `**${npc.name}** — ${npc.type || 'Character'}${npc.count > 1 ? ` ×${npc.count}` : ''}`;
  lines.push(head);
  const tb = npc.threatBuild;
  if (tb) {
    const role = tb.roleKit?.roleName || tb.role || '';
    const cls = tb.classification || '';
    const tier = tb.tier ? `Tier ${tb.tier}` : '';
    const meta = [role, cls, tier].filter(Boolean).join(' · ');
    if (meta) lines.push(`  - *${meta}*`);
    const c = tb.computed;
    if (c) {
      const arenas = fmtArenaLine(c.arenas);
      if (arenas) lines.push(`  - Arenas: ${arenas}`);
      const def = [c.defense != null ? `Def ${c.defense}` : null,
                   c.evasion != null ? `Eva ${c.evasion}` : null,
                   c.resist != null ? `Res ${c.resist}` : null,
                   c.vitality != null ? `Vit ${c.vitality}` : null,
                   c.initiative != null ? `Init ${c.initiative}` : null].filter(Boolean).join(' · ');
      if (def) lines.push(`  - ${def}`);
    }
    const action = tb.roleKit?.action;
    if (action) {
      let actLine = `  - **${action.name}**`;
      if (action.arena) actLine += ` (${action.arena}`;
      if (action.defense && action.defense !== 'none') actLine += action.arena ? ` vs ${action.defense})` : `(vs ${action.defense})`;
      else if (action.arena) actLine += ')';
      lines.push(actLine);
    }
    const exploit = tb.roleKit?.exploit;
    if (exploit) lines.push(`  - *Exploit — ${exploit.name}:* ${exploit.description}`);
    if (tb.traits?.length) lines.push(`  - Traits: ${tb.traits.join(', ')}`);
    if (tb.socialNotes) lines.push(`  - ${tb.socialNotes}`);
  }
  return lines.join('\n');
}

function fmtEncounter(enc) {
  const lines = [];
  lines.push(`#### ${enc.name || enc.id}`);
  if (enc.type || enc.trigger) {
    const meta = [enc.type ? `*${enc.type}*` : null, enc.trigger ? `**Trigger:** ${enc.trigger}` : null].filter(Boolean).join(' — ');
    lines.push(meta);
    lines.push('');
  }
  if (enc.description) { lines.push(clean(enc.description)); lines.push(''); }
  if (enc.readAloud) {
    lines.push('> **Read aloud:**');
    lines.push(blockquote(enc.readAloud));
    lines.push('');
  }
  return lines.join('\n');
}

function fmtDecision(dp) {
  const lines = [];
  lines.push(`**${dp.prompt || dp.id}**`);
  if (dp.context) { lines.push(''); lines.push(clean(dp.context)); lines.push(''); }
  for (const opt of (dp.options || [])) {
    lines.push(`- **${opt.label}**`);
    if (opt.consequence) lines.push(`  - ${clean(opt.consequence)}`);
    if (opt.impacts?.length) {
      const ips = opt.impacts.map(i => `${i.key} → ${i.value}`).join('; ');
      lines.push(`  - *Impact:* ${ips}`);
    }
  }
  return lines.join('\n');
}

function fmtDiscipline(dc) {
  const lines = [];
  const head = `**${(dc.actionType || '?').toUpperCase()}** — ${dc.discipline || ''}` +
               (dc.arena ? ` (${dc.arena})` : '') +
               (dc.target ? ` vs ${dc.target}` : '') +
               (dc.defense ? ` [${dc.defense}]` : '');
  lines.push(head);
  if (dc.context) lines.push(`- *Context:* ${clean(dc.context)}`);
  if (dc.narrativePacing) lines.push(`- *Pacing:* ${clean(dc.narrativePacing)}`);
  if (dc.control) {
    if (dc.control.failure) lines.push(`- **Failure:** ${clean(dc.control.failure)}`);
    if (dc.control.success && dc.control.success !== 'Refer to effect tiers.') lines.push(`- **Success:** ${clean(dc.control.success)}`);
    if (dc.control.mastery) lines.push(`- **Mastery:** ${clean(dc.control.mastery)}`);
  }
  if (dc.effect) {
    if (dc.effect.fleeting) lines.push(`- **Fleeting:** ${clean(dc.effect.fleeting)}`);
    if (dc.effect.masterful) lines.push(`- **Masterful:** ${clean(dc.effect.masterful)}`);
    if (dc.effect.legendary) lines.push(`- **Legendary:** ${clean(dc.effect.legendary)}`);
  }
  return lines.join('\n');
}

function fmtEnvMech(em) {
  const parts = [`**${em.name}**`];
  if (em.trigger) parts.push(`*${em.trigger}*`);
  if (em.effect) parts.push(em.effect);
  if (em.mitigation) parts.push(`*Mitigation:* ${em.mitigation}`);
  return '- ' + parts.join(' — ');
}

function fmtTacticalMap(tm) {
  if (!tm) return '';
  const mapKey = tm.mapKey;
  if (!mapKey) return '';
  const map = loadMapRooms(mapKey);

  const lines = [];
  if (map && map.rooms.length) {
    const title = map.title || mapKey;
    lines.push(`**Map:** ${title} \`(${mapKey})\` — ${map.rooms.length} rooms`);
    lines.push(`*Image:* \`${map.imageRel}\` · *Reference:* \`public/maps/${mapKey}.html\``);
    lines.push('');
    lines.push('**Rooms:**');
    for (const r of map.rooms) {
      const desc = clean(r.desc);
      if (desc) {
        lines.push(`- **${r.room}** — ${desc}`);
      } else {
        lines.push(`- **${r.room}**`);
      }
    }
    lines.push('');
  } else {
    // Map HTML missing — fall back to the mapKey reference only.
    lines.push(`**Map:** \`${mapKey}\` *(map HTML not found in public/maps/)*`);
    lines.push('');
  }

  // Starting positions are scene-specific blocking notes — surface them.
  if (tm.startingPositions?.length) {
    lines.push('**Starting positions:**');
    for (const sp of tm.startingPositions) {
      const note = sp.notes ? ` — ${clean(sp.notes)}` : '';
      lines.push(`- **${sp.who}** @ *${sp.zone}*${note}`);
    }
    lines.push('');
  }

  // GM tactical notes — scene-critical operational text.
  if (tm.gmTacticalNotes) {
    lines.push('**GM tactical notes:**');
    lines.push('');
    lines.push(clean(tm.gmTacticalNotes));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function fmtRewards(r) {
  if (!r) return '';
  const lines = [];
  if (r.credits) lines.push(`- **Credits:** ${r.credits}`);
  if (r.items?.length) lines.push(`- **Items:** ${r.items.join(', ')}`);
  if (r.intel?.length) {
    lines.push('- **Intel:**');
    for (const i of r.intel) lines.push(`  - ${i}`);
  }
  if (r.connections?.length) {
    lines.push('- **Connections:**');
    for (const c of r.connections) lines.push(`  - ${typeof c === 'string' ? c : (c.name || JSON.stringify(c))}`);
  }
  return lines.join('\n');
}

function fmtScene(s, partNum) {
  w(`### Scene ${partNum}.${s.number} — ${s.title}`);
  if (s.subtitle) w(`*${s.subtitle}*`);
  if (s.pacing?.estimatedMinutes) w(`*Estimated runtime: ~${s.pacing.estimatedMinutes} min*`);
  w('');

  const ra = [s.readAloudPart1, s.readAloudPart2].filter(Boolean).join('\n\n')
             || s.readAloud || '';
  if (ra) {
    w('#### Read Aloud');
    w(blockquote(ra));
    if (s.readAloudPart1PauseNote) {
      w('');
      w(`*GM pause note: ${clean(s.readAloudPart1PauseNote)}*`);
    }
    w('');
  }

  if (s.gmNotes) {
    w('#### GM Notes');
    w(clean(s.gmNotes));
    w('');
  }

  if (s.pacing) {
    w('#### Pacing');
    if (s.pacing.openingBeat) w(`- **Opening:** ${clean(s.pacing.openingBeat)}`);
    if (s.pacing.risingAction) w(`- **Rising action:** ${clean(s.pacing.risingAction)}`);
    if (s.pacing.climax) w(`- **Climax:** ${clean(s.pacing.climax)}`);
    if (s.pacing.resolution) w(`- **Resolution:** ${clean(s.pacing.resolution)}`);
    w('');
  }

  if (s.encounters?.length) {
    w('#### Beats / Encounters');
    for (const enc of s.encounters) { w(fmtEncounter(enc)); w(''); }
  }

  if (s.environmentMechanics?.length) {
    w('#### Environment & Mechanics');
    for (const em of s.environmentMechanics) w(fmtEnvMech(em));
    w('');
  }

  if (Array.isArray(s.hazards) && s.hazards.length && typeof s.hazards[0] === 'object') {
    w('#### Hazards');
    for (const h of s.hazards) {
      const parts = [`**${h.name || h.id}**`];
      if (h.trigger) parts.push(`*${h.trigger}*`);
      if (h.effect) parts.push(h.effect);
      w('- ' + parts.join(' — '));
    }
    w('');
  }

  if (s.tacticalMap) {
    w('#### Tactical Map');
    w(fmtTacticalMap(s.tacticalMap));
    w('');
  }

  if (s.npcs?.length) {
    w('#### Cast / Threats Present');
    for (const n of s.npcs) { w(fmtNpc(n)); w(''); }
  }

  if (s.disciplineChallenges?.length) {
    w('#### Key Checks');
    for (const dc of s.disciplineChallenges) { w(fmtDiscipline(dc)); w(''); }
  }

  if (s.decisionPoints?.length) {
    w('#### Likely Options / Decision Points');
    for (const dp of s.decisionPoints) { w(fmtDecision(dp)); w(''); }
  }

  if (s.rewards) {
    const rText = fmtRewards(s.rewards);
    if (rText) {
      w('#### Rewards & Intel');
      w(rText);
      w('');
    }
  }

  if (s.timeAdvance) {
    w(`*Time advance: ${typeof s.timeAdvance === 'object' ? JSON.stringify(s.timeAdvance) : s.timeAdvance}*`);
    w('');
  }

  rule();
}

// === COVER ===
w(`# Adventure ${adv.number}: ${adv.title}`);
w(`*${adv.act ? `Act ${adv.act} · ` : ''}Adventure ${adv.number}*`);
w('');
if (adv.startDate) w(`**In-fiction start:** ${adv.startDate}`);
if (adv.startDateNote) w(`*${adv.startDateNote}*`);
w('');
w('## Summary');
w(adv.summary || '');
w('');

if (adv.marks?.length) {
  w('## Story Marks (Achievements)');
  for (const m of adv.marks) {
    w(`- **${m.label}**${m.hidden ? ' *(hidden)*' : ''} — ${m.desc}`);
  }
  w('');
}

if (adv.locations?.length) {
  const locStrs = adv.locations.map(l => typeof l === 'string' ? l : (l.name || l.id || JSON.stringify(l)));
  w(`**Locations:** ${locStrs.join(', ')}`);
  w('');
}

if (adv.gearNotes) {
  w('## Gear Notes');
  if (typeof adv.gearNotes === 'string') {
    w(adv.gearNotes);
  } else if (Array.isArray(adv.gearNotes)) {
    const needed = adv.gearNotes.filter(g => g && g.category === 'needed');
    const good = adv.gearNotes.filter(g => g && g.category === 'good');
    const other = adv.gearNotes.filter(g => g && g.category !== 'needed' && g.category !== 'good');
    if (needed.length) {
      w('**Needed:**');
      for (const g of needed) w(`- **${g.item || g.name}** — ${g.reason || g.note || ''}`);
      w('');
    }
    if (good.length) {
      w('**Recommended:**');
      for (const g of good) w(`- **${g.item || g.name}** — ${g.reason || g.note || ''}`);
      w('');
    }
    for (const g of other) w(`- ${typeof g === 'string' ? g : (g.note || `${g.item || g.name || ''} — ${g.reason || ''}`)}`);
  } else {
    w(JSON.stringify(adv.gearNotes, null, 2));
  }
  w('');
}

rule();

// === PARTS / SCENES ===
for (const part of (adv.parts || [])) {
  w(`## Part ${part.number} — ${part.title}`);
  if (part.summary) { w(''); w(`*${clean(part.summary)}*`); }
  w('');
  for (const scene of (part.scenes || [])) {
    fmtScene(scene, part.number);
  }
}

fs.writeFileSync(outputPath, out.join('\n'));
const stat = fs.statSync(outputPath);
console.log(`Wrote ${outputPath} (${(stat.size/1024).toFixed(1)} KB, ${out.length} lines)`);
