#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DISCIPLINES_BY_ARENA = [
  { id: 'physique', disciplines: ['athletics', 'brawl', 'endure', 'melee', 'heavy_weapons'] },
  { id: 'reflex',   disciplines: ['evasion', 'piloting', 'ranged', 'skulduggery', 'stealth'] },
  { id: 'grit',     disciplines: ['beast_handling', 'intimidate', 'resolve', 'survival', 'control_spark'] },
  { id: 'wits',     disciplines: ['investigation', 'medicine', 'tactics', 'tech', 'sense_spark'] },
  { id: 'presence', disciplines: ['charm', 'deception', 'insight', 'persuasion', 'alter_spark'] },
];

const DISC_TO_ARENA = {};
DISCIPLINES_BY_ARENA.forEach(function(ag) {
  ag.disciplines.forEach(function(d) { DISC_TO_ARENA[d] = ag.id; });
});

const advDir = path.join(__dirname, '..', 'data', 'adventures');
const files = fs.readdirSync(advDir).filter(function(f) { return f.endsWith('.json'); }).sort();

const mismatches = [];

function walk(node, ctx) {
  if (Array.isArray(node)) {
    node.forEach(function(item, i) { walk(item, ctx + '[' + i + ']'); });
    return;
  }
  if (node && typeof node === 'object') {
    if (Array.isArray(node.disciplineChallenges)) {
      node.disciplineChallenges.forEach(function(ch, i) {
        const disc = ch.discipline;
        const arena = ch.arena;
        if (disc && arena) {
          const expected = DISC_TO_ARENA[disc];
          if (!expected) {
            mismatches.push({ ctx: ctx + '.disciplineChallenges[' + i + ']', id: ch.id, discipline: disc, arena: arena, expected: '(unknown discipline)' });
          } else if (expected !== arena) {
            mismatches.push({ ctx: ctx + '.disciplineChallenges[' + i + ']', id: ch.id, discipline: disc, arena: arena, expected: expected });
          }
        }
      });
    }
    Object.keys(node).forEach(function(k) { walk(node[k], ctx + '.' + k); });
  }
}

let totalChallenges = 0;
function countChallenges(node) {
  if (Array.isArray(node)) { node.forEach(countChallenges); return; }
  if (node && typeof node === 'object') {
    if (Array.isArray(node.disciplineChallenges)) totalChallenges += node.disciplineChallenges.length;
    Object.keys(node).forEach(function(k) { countChallenges(node[k]); });
  }
}

files.forEach(function(file) {
  const full = path.join(advDir, file);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  const before = mismatches.length;
  countChallenges(data);
  walk(data, file);
  const found = mismatches.length - before;
  console.log(file + ': ' + (found === 0 ? 'OK' : found + ' mismatch(es)'));
});

console.log('\nTotal disciplineChallenges scanned: ' + totalChallenges);

if (mismatches.length > 0) {
  console.log('\nMismatches:');
  mismatches.forEach(function(m) {
    console.log('  ' + m.ctx + ' id=' + m.id + ' discipline=' + m.discipline + ' arena=' + m.arena + ' (expected ' + m.expected + ')');
  });
  process.exit(1);
}
console.log('\nAll discipline/arena pairings are canonical.');
