(function () {
  var threatData = null;
  var weaponsCatalog = [];
  var armorCatalog = [];
  var gearCatalog = [];
  var partyCacheNpc = [];
  var savedNpcs = [];
  var currentNpc = {
    name: '',
    tier: 1,
    threatCategory: 'character',
    arenas: { physique: 2, reflex: 2, grit: 2, wits: 2, presence: 2 },
    role: '',
    classification: 'standard',
    traits: [],
    tags: [],
    loot: [],
    attacks: [],
    numPlayers: 4,
    shipDetails: {
      hullType: '',
      crew: '',
      hyperdrive: '',
      sensors: '',
      shields: '',
      cargo: '',
      speed: ''
    }
  };

  var SHIP_CATEGORIES = ['starship', 'capital_ship', 'station'];

  function isShipCategory(cat) {
    return SHIP_CATEGORIES.indexOf(cat) !== -1;
  }

  function isVehicleOrShip(cat) {
    return cat === 'vehicle' || isShipCategory(cat);
  }

  var ARENA_LABELS = {
    character: { physique: 'Physique', reflex: 'Reflex', grit: 'Grit', wits: 'Wits', presence: 'Presence' },
    vehicle: { physique: 'Armor', reflex: 'Handling', grit: 'Hull', wits: 'Sensors', presence: 'Presence' },
    starship: { physique: 'Firepower', reflex: 'Handling', grit: 'Hull', wits: 'Sensors', presence: 'Command' },
    capital_ship: { physique: 'Firepower', reflex: 'Handling', grit: 'Hull', wits: 'Sensors', presence: 'Command' },
    station: { physique: 'Firepower', reflex: 'Targeting', grit: 'Hull', wits: 'Sensors', presence: 'Command' }
  };

  var STAT_LABELS = {
    character: { def: 'DEF', eva: 'EVA', res: 'RES', vit: 'VIT', init: 'INIT' },
    vehicle: { def: 'ARM', eva: 'EVA', res: 'RES', vit: 'HULL', init: 'INIT' },
    starship: { def: 'SHIELDS', eva: 'EVA', res: 'SYS', vit: 'HULL', init: 'INIT' },
    capital_ship: { def: 'SHIELDS', eva: 'EVA', res: 'SYS', vit: 'HULL', init: 'INIT' },
    station: { def: 'SHIELDS', eva: 'EVA', res: 'SYS', vit: 'HULL', init: 'INIT' }
  };

  function getArenaLabels(cat) {
    return ARENA_LABELS[cat] || ARENA_LABELS.character;
  }

  function getStatLabels(cat) {
    return STAT_LABELS[cat] || STAT_LABELS.character;
  }

  function getCategoryLabel(cat) {
    if (!threatData) return cat;
    var found = (threatData.threatCategories || []).find(function(c) { return c.id === cat; });
    return found ? found.name : cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  var STORAGE_KEY = 'eote-saved-npcs';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadSavedNpcs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      savedNpcs = raw ? JSON.parse(raw) : [];
    } catch (e) { savedNpcs = []; }
  }

  function persistSavedNpcs() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedNpcs)); } catch (e) {}
  }

  function seedAttacksFromRole() {
    if (!threatData || !currentNpc.role) {
      currentNpc.attacks = [];
      return;
    }
    var role = threatData.roles.find(function (r) { return r.id === currentNpc.role; });
    if (!role || !role.actions) {
      currentNpc.attacks = [];
      return;
    }
    currentNpc.attacks = role.actions.map(function (a) {
      return { name: a.name, arena: a.arena || '', powerMod: a.powerMod || 0, chassis: 'medium', canStun: false, sourceAction: a.name };
    });
  }

  function calcStats(npc) {
    var role = npc.role ? threatData.roles.find(function (r) { return r.id === npc.role; }) : null;
    var mods = role ? role.arenaMods || {} : {};
    var a = {
      physique: Math.max(1, Math.min(5, npc.arenas.physique + (mods.physique || 0))),
      reflex: Math.max(1, Math.min(5, npc.arenas.reflex + (mods.reflex || 0))),
      grit: Math.max(1, Math.min(5, npc.arenas.grit + (mods.grit || 0))),
      wits: Math.max(1, Math.min(5, npc.arenas.wits + (mods.wits || 0))),
      presence: Math.max(1, Math.min(5, npc.arenas.presence + (mods.presence || 0)))
    };
    var tier = npc.tier;

    var defenseTrait = 0;
    var evasionTrait = 0;
    var resistTrait = 0;
    var powerTrait = 0;
    var initiativeTrait = 0;
    var traitImmunities = [];
    var traitVulnerabilities = [];
    var scale = null;
    var scaleLevel = 1;
    var hasIronClad = false;
    var isStationary = false;
    (npc.traits || []).forEach(function (tid) {
      var t = threatData.traits.find(function (tr) { return tr.id === tid; });
      if (!t) return;
      if (t.defenseMod) defenseTrait += t.defenseMod;
      if (t.evasionMod) evasionTrait += t.evasionMod;
      if (t.resistMod) resistTrait += t.resistMod;
      if (t.powerMod) powerTrait += t.powerMod;
      if (t.initiativeMod) initiativeTrait += t.initiativeMod;
      if (t.immunities) traitImmunities = traitImmunities.concat(t.immunities);
      if (t.vulnerabilities) traitVulnerabilities = traitVulnerabilities.concat(t.vulnerabilities);
      if (t.scale) { scale = t.scale; scaleLevel = t.scaleLevel || 1; }
      if (t.useDefenseForEvasion) hasIronClad = true;
      if (t.isStationary) isStationary = true;
    });

    var defense = Math.max(a.physique, a.reflex) - 1 + tier + defenseTrait;
    var evasion = isStationary ? 0 : (a.reflex - 1 + tier + evasionTrait);
    var resist = a.grit - 1 + tier + resistTrait;
    var rawVitality = a.physique + a.grit + tier;

    var cls = threatData.classifications.find(function (c) { return c.id === npc.classification; });
    var vMod = cls ? cls.vitalityMod : 1;
    var vitality = Math.ceil(rawVitality * vMod);

    var exploits = 0;
    if (cls && typeof cls.exploitMod === 'number') exploits = cls.exploitMod;
    else if (cls && cls.exploitMod === 'N-1') exploits = Math.max(1, (npc.numPlayers || 4) - 1);
    var hasVeteran = (npc.traits || []).indexOf('veteran') !== -1;
    if (hasVeteran) exploits += 1;

    var powers = {};
    ['physique', 'reflex', 'grit', 'wits', 'presence'].forEach(function (arena) {
      powers[arena] = a[arena] - 1 + tier + powerTrait;
    });

    var rolePowerBonus = role && role.powerBonus ? role.powerBonus : null;

    var initiative = tier + (a.wits * 2) + initiativeTrait;

    return {
      arenas: a,
      defense: defense,
      evasion: evasion,
      resist: resist,
      vitality: vitality,
      rawVitality: rawVitality,
      powers: powers,
      exploits: exploits,
      initiative: initiative,
      role: role,
      classification: cls,
      rolePowerBonus: rolePowerBonus,
      immunities: traitImmunities,
      vulnerabilities: traitVulnerabilities,
      scale: scale,
      scaleLevel: scaleLevel,
      ironClad: hasIronClad,
      isStationary: isStationary
    };
  }

  function renderNpcCard() {
    var el = document.getElementById('npc-card-preview');
    if (!el || !threatData) return;

    var stats = calcStats(currentNpc);
    var role = stats.role;
    var cls = stats.classification;

    var cat = currentNpc.threatCategory || 'character';
    var sLabels = getStatLabels(cat);
    var aLabels = getArenaLabels(cat);

    var html = '';
    html += '<div class="npc-card">';

    html += '<div class="npc-card-header">';
    html += '<div class="npc-card-name">' + esc(currentNpc.name || (isShipCategory(cat) ? 'Unnamed Vessel' : 'Unnamed NPC')) + '</div>';
    html += '<div class="npc-card-meta">';
    html += esc(getCategoryLabel(cat)) + ' — Tier ' + currentNpc.tier;
    if (cls) html += ' ' + esc(cls.name);
    if (role) html += ' ' + esc(role.name);
    html += '</div>';
    html += '</div>';

    html += '<div class="npc-card-stats">';
    html += '<div class="npc-stat-row">';
    html += '<div class="npc-stat"><div class="npc-stat-label">' + sLabels.def + '</div><div class="npc-stat-val">' + stats.defense + '</div></div>';
    html += '<div class="npc-stat"><div class="npc-stat-label">' + sLabels.eva + '</div><div class="npc-stat-val">' + stats.evasion + '</div></div>';
    html += '<div class="npc-stat"><div class="npc-stat-label">' + sLabels.res + '</div><div class="npc-stat-val">' + stats.resist + '</div></div>';
    html += '<div class="npc-stat"><div class="npc-stat-label">' + sLabels.vit + '</div><div class="npc-stat-val npc-stat-vit">' + stats.vitality + '</div></div>';
    html += '<div class="npc-stat"><div class="npc-stat-label">' + sLabels.init + '</div><div class="npc-stat-val npc-stat-init">' + stats.initiative + '</div></div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="npc-card-arenas">';
    ['physique', 'reflex', 'grit', 'wits', 'presence'].forEach(function (arena) {
      var label = aLabels[arena] || arena;
      var shortLabel = label.substring(0, 3).toUpperCase();
      html += '<div class="npc-arena-pip">';
      html += '<span class="npc-arena-label">' + shortLabel + '</span>';
      html += '<span class="npc-arena-val">' + stats.arenas[arena] + '</span>';
      html += '<span class="npc-arena-power">Pwr ' + stats.powers[arena] + '</span>';
      html += '</div>';
    });
    html += '</div>';

    if (stats.rolePowerBonus) {
      html += '<div class="npc-card-power-bonus">ROLE BONUS: +' + stats.rolePowerBonus.value + ' Power (' + esc(stats.rolePowerBonus.condition) + ')</div>';
    }

    if (stats.immunities && stats.immunities.length) {
      html += '<div class="npc-card-immunities">IMMUNE: ' + stats.immunities.map(esc).join(', ') + '</div>';
    }
    if (stats.vulnerabilities && stats.vulnerabilities.length) {
      html += '<div class="npc-card-vulnerabilities">VULNERABLE: ' + stats.vulnerabilities.map(esc).join(', ') + '</div>';
    }
    if (stats.ironClad) {
      html += '<div class="npc-card-ironclad">IRON CLAD: Uses Defense for Evasion. Endures grenades/AoE. Bypassed by lightsabers &amp; armor-piercing.</div>';
    }
    if (stats.isStationary) {
      html += '<div class="npc-card-stationary">STATIONARY: Cannot move. Evasion 0.</div>';
    }
    if (stats.scale) {
      var scaleDisplay = stats.scale.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      html += '<div class="npc-card-scale">SCALE: ' + esc(scaleDisplay) + ' (Level ' + stats.scaleLevel + ')</div>';
    }

    if (isShipCategory(cat) || cat === 'vehicle') {
      var sd = currentNpc.shipDetails || {};
      var detailTitle = isShipCategory(cat) ? 'SHIP DETAILS' : 'VEHICLE DETAILS';
      html += '<div class="npc-ship-details">';
      html += '<div class="npc-ship-details-title">' + detailTitle + '</div>';
      var detailFields = [
        { key: 'hullType', label: 'Hull Type' },
        { key: 'crew', label: 'Crew' },
        { key: 'speed', label: 'Speed / Maneuver' },
        { key: 'shields', label: 'Shield Config' },
        { key: 'hyperdrive', label: 'Hyperdrive' },
        { key: 'sensors', label: 'Sensor Range' },
        { key: 'cargo', label: 'Cargo' }
      ];
      detailFields.forEach(function (f) {
        var val = sd[f.key] || '—';
        html += '<div class="npc-ship-detail-row"><span class="npc-ship-detail-label">' + f.label + '</span><span class="npc-ship-detail-val">' + esc(val) + '</span></div>';
      });
      html += '</div>';
    }

    if (currentNpc.classification === 'minion') {
      html += '<div class="npc-card-special">MINION: Masterful+ result = instant takedown</div>';
    }
    if (currentNpc.classification === 'boss') {
      html += '<div class="npc-card-special">BOSS: ' + stats.exploits + ' Exploit' + (stats.exploits !== 1 ? 's' : '') + ' (N=' + (currentNpc.numPlayers || 4) + ' players)</div>';
    }
    if (currentNpc.classification === 'elite') {
      html += '<div class="npc-card-special">ELITE: +1 Exploit, x1.5 Vitality</div>';
    }

    if (role) {
      html += '<div class="npc-card-role-section">';
      html += '<div class="npc-role-title">' + esc(role.name) + ' Abilities</div>';

      if (role.passive) {
        html += '<div class="npc-ability passive"><span class="npc-ability-type">PASSIVE</span> <strong>' + esc(role.passive.name) + ':</strong> ' + esc(role.passive.description) + '</div>';
      }
      role.actions.forEach(function (a) {
        html += '<div class="npc-ability action"><span class="npc-ability-type">ACTION</span> <strong>' + esc(a.name) + ':</strong> ' + esc(a.description) + '</div>';
      });
      html += '<div class="npc-ability maneuver"><span class="npc-ability-type">MANEUVER</span> <strong>' + esc(role.maneuver.name) + ':</strong> ' + esc(role.maneuver.description) + '</div>';
      html += '<div class="npc-ability gambit"><span class="npc-ability-type">GAMBIT</span> <strong>' + esc(role.gambit.name) + '</strong> (' + esc(role.gambit.cost) + '): ' + esc(role.gambit.description) + '</div>';
      html += '<div class="npc-ability exploit"><span class="npc-ability-type">EXPLOIT</span> <strong>' + esc(role.exploit.name) + ':</strong> ' + esc(role.exploit.description) + '</div>';
      html += '</div>';
    }

    var activeTraits = (currentNpc.traits || []).map(function (tid) {
      return threatData.traits.find(function (t) { return t.id === tid; });
    }).filter(Boolean);

    if (activeTraits.length) {
      html += '<div class="npc-card-traits">';
      html += '<div class="npc-traits-label">TRAITS</div>';
      activeTraits.forEach(function (t) {
        html += '<div class="npc-trait-item"><strong>' + esc(t.name) + ':</strong> ' + esc(t.description) + '</div>';
      });
      html += '</div>';
    }

    if (currentNpc.attacks && currentNpc.attacks.length) {
      html += '<div class="npc-card-attacks">';
      html += '<div class="npc-attacks-label">ATTACKS</div>';
      var chassisData = threatData.system && threatData.system.weaponChassis ? threatData.system.weaponChassis : {};
      currentNpc.attacks.forEach(function (atk) {
        var chassisKey = atk.chassis || 'medium';
        var ch = chassisData[chassisKey] || chassisData.medium || { pcDamage: { fleeting: 1, masterful: 3, legendary: 5 }, pcStun: { fleeting: 2, masterful: 4, legendary: 6 } };
        var npcDmgF = (ch.pcDamage.fleeting || 1) + 1;
        var npcDmgM = (ch.pcDamage.masterful || 3) + 1;
        var npcDmgL = (ch.pcDamage.legendary || 5) + 1;
        var arenaScore = 0;
        if (atk.arena && stats.arenas && stats.arenas[atk.arena] !== undefined) {
          arenaScore = stats.arenas[atk.arena];
        }
        var attackPower = (stats.powers && stats.powers[atk.arena] !== undefined) ? stats.powers[atk.arena] : ((arenaScore - 1) + (currentNpc.tier || 0));
        attackPower += (atk.powerMod || 0);
        var chassisLabel = ch.label || chassisKey.charAt(0).toUpperCase() + chassisKey.slice(1);
        var atkCatLabels = getArenaLabels(currentNpc.threatCategory || 'character');
        html += '<div class="npc-attack-card-item">';
        html += '<div class="npc-attack-header">';
        html += '<strong>' + esc(atk.name) + '</strong>';
        html += ' <span class="npc-attack-power-badge">Power ' + attackPower + '</span>';
        html += ' <span class="npc-attack-chassis-badge">' + chassisLabel + '</span>';
        if (atk.arena) html += ' <span class="npc-attack-arena-badge">' + (atkCatLabels[atk.arena] || atk.arena) + '</span>';
        html += '</div>';
        html += '<div class="npc-attack-damage-row">';
        html += '<span class="npc-dmg-tier"><span class="npc-dmg-label">F</span> ' + npcDmgF + '</span>';
        html += '<span class="npc-dmg-tier"><span class="npc-dmg-label">M</span> ' + npcDmgM + '</span>';
        html += '<span class="npc-dmg-tier"><span class="npc-dmg-label">L</span> ' + npcDmgL + '</span>';
        html += '</div>';
        if (atk.canStun) {
          var npcStunF = (ch.pcStun.fleeting || 2) + 1;
          var npcStunM = (ch.pcStun.masterful || 4) + 1;
          var npcStunL = (ch.pcStun.legendary || 6) + 1;
          html += '<div class="npc-attack-stun-row">';
          html += '<span class="npc-stun-tier"><span class="npc-stun-label-sm">Stun F</span> ' + npcStunF + '</span>';
          html += '<span class="npc-stun-tier"><span class="npc-stun-label-sm">M</span> ' + npcStunM + '</span>';
          html += '<span class="npc-stun-tier"><span class="npc-stun-label-sm">L</span> ' + npcStunL + '</span>';
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    }

    if (currentNpc.tags && currentNpc.tags.length && threatData.tags) {
      html += '<div class="npc-card-tags">';
      html += '<div class="npc-tags-label">TAGS</div>';
      currentNpc.tags.forEach(function (tagId) {
        var tagObj = threatData.tags.find(function (t) { return t.id === tagId; });
        if (tagObj) {
          html += '<div class="npc-tag-card-item"><span class="npc-tag">' + esc(tagObj.name) + '</span><span class="npc-tag-effect">' + esc(tagObj.effect) + '</span></div>';
        }
      });
      html += '</div>';
    }

    if (currentNpc.loot && currentNpc.loot.length) {
      html += '<div class="npc-card-loot">';
      html += '<div class="npc-loot-label">LOOT</div>';
      currentNpc.loot.forEach(function (item, idx) {
        html += '<div class="npc-loot-item" data-loot-idx="' + idx + '">';
        html += '<span>' + esc(item.name) + (item.qty > 1 ? ' x' + item.qty : '') + '</span>';
        html += '<button class="npc-loot-assign" data-loot-idx="' + idx + '" title="Assign to PC">&#10132;</button>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    el.innerHTML = html;

    el.querySelectorAll('.npc-loot-assign').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.lootIdx, 10);
        showLootAssignPopup(idx);
      });
    });
  }

  function showLootAssignPopup(lootIdx) {
    var item = currentNpc.loot[lootIdx];
    if (!item) return;
    var overlay = document.getElementById('npc-loot-assign-overlay');
    var body = document.getElementById('npc-loot-assign-body');
    if (!overlay || !body) return;

    var connectedPCs = partyCacheNpc.filter(function (pc) { return pc.is_connected; });
    var activePCs = connectedPCs.length > 0 ? connectedPCs : partyCacheNpc.filter(function (pc) { return pc.name; });
    var html = '<div class="npc-assign-title">Assign: ' + esc(item.name) + '</div>';
    if (!activePCs.length) {
      html += '<div class="npc-assign-empty">No characters found. Load the party monitor first.</div>';
    } else {
      activePCs.forEach(function (pc) {
        var connLabel = pc.is_connected ? ' (active)' : '';
        html += '<button class="npc-assign-pc-btn" data-char-id="' + esc(pc.id) + '">' + esc(pc.name) + connLabel + '</button>';
      });
    }
    html += '<button class="npc-assign-cancel">Cancel</button>';
    body.innerHTML = html;
    overlay.classList.add('active');

    body.querySelectorAll('.npc-assign-pc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var charId = btn.dataset.charId;
        assignLootToPC(charId, item);
        overlay.classList.remove('active');
      });
    });
    body.querySelector('.npc-assign-cancel').addEventListener('click', function () {
      overlay.classList.remove('active');
    });
  }

  function assignLootToPC(charId, item) {
    fetch('/api/inventory/' + charId + '/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, itemType: item.type })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.ok) {
        var lootEntry = currentNpc.loot.find(function (l) { return l.id === item.id; });
        if (lootEntry) {
          lootEntry.qty = (lootEntry.qty || 1) - 1;
          if (lootEntry.qty <= 0) {
            currentNpc.loot = currentNpc.loot.filter(function (l) { return l.id !== item.id; });
          }
        }
        renderBuilderRight();
        renderNpcCard();
        showNpcToast(esc(item.name) + ' assigned to character.');
      } else {
        showNpcToast('Error: ' + (data.error || 'Unknown error'));
      }
    }).catch(function () {
      showNpcToast('Network error assigning loot.');
    });
  }

  function showNpcToast(msg) {
    var toast = document.getElementById('npc-toast');
    if (!toast) return;
    toast.innerHTML = msg;
    toast.classList.add('active');
    setTimeout(function () { toast.classList.remove('active'); }, 2500);
  }

  function autoApplyScaleTraits(cat) {
    if (!threatData) return;
    threatData.traits.forEach(function (t) {
      if (!t.autoApply) return;
      var isForCat = !t.categories || t.categories.indexOf(cat) !== -1;
      var idx = currentNpc.traits.indexOf(t.id);
      if (isForCat && idx === -1) {
        currentNpc.traits.push(t.id);
      } else if (!isForCat && idx !== -1) {
        currentNpc.traits.splice(idx, 1);
      }
    });
  }

  function renderBuilderLeft() {
    var el = document.getElementById('npc-builder-left');
    if (!el || !threatData) return;

    var html = '';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Threat Category</label>';
    html += '<div class="npc-category-btns">';
    (threatData.threatCategories || []).forEach(function (cat) {
      var active = (currentNpc.threatCategory || 'character') === cat.id;
      html += '<button class="npc-category-btn' + (active ? ' active' : '') + '" data-cat="' + cat.id + '" title="' + esc(cat.description) + '">' + esc(cat.name) + '</button>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">NPC Name</label>';
    html += '<input type="text" id="npc-name-input" class="npc-text-input" value="' + esc(currentNpc.name) + '" placeholder="Unnamed NPC" />';
    html += '</div>';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Tier <span class="npc-tier-val">' + currentNpc.tier + '</span></label>';
    html += '<input type="range" id="npc-tier-slider" class="npc-slider" min="0" max="5" value="' + currentNpc.tier + '" />';
    html += '</div>';

    var activeCat = currentNpc.threatCategory || 'character';
    var aLabels = getArenaLabels(activeCat);

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Arena Scores</label>';
    ['physique', 'reflex', 'grit', 'wits', 'presence'].forEach(function (arena) {
      var label = aLabels[arena] || arena.charAt(0).toUpperCase() + arena.slice(1);
      html += '<div class="npc-arena-input">';
      html += '<span class="npc-arena-input-label">' + esc(label) + '</span>';
      html += '<input type="range" class="npc-slider npc-arena-slider" data-arena="' + arena + '" min="1" max="5" value="' + currentNpc.arenas[arena] + '" />';
      html += '<span class="npc-arena-input-val">' + currentNpc.arenas[arena] + '</span>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Role</label>';
    html += '<select id="npc-role-select" class="npc-select">';
    html += '<option value="">(No Role)</option>';
    var combatRoles = threatData.roles.filter(function (r) { return r.category === 'combat'; });
    var socialRoles = threatData.roles.filter(function (r) { return r.category === 'social'; });
    html += '<optgroup label="Combat Roles">';
    combatRoles.forEach(function (r) {
      html += '<option value="' + r.id + '"' + (currentNpc.role === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>';
    });
    html += '</optgroup>';
    html += '<optgroup label="Social Roles">';
    socialRoles.forEach(function (r) {
      html += '<option value="' + r.id + '"' + (currentNpc.role === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>';
    });
    html += '</optgroup>';
    html += '</select>';
    html += '</div>';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Classification</label>';
    html += '<select id="npc-class-select" class="npc-select">';
    threatData.classifications.forEach(function (c) {
      html += '<option value="' + c.id + '"' + (currentNpc.classification === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    if (currentNpc.classification === 'boss') {
      html += '<div class="npc-input-group">';
      html += '<label class="npc-label"># Players <span class="npc-tier-val">' + (currentNpc.numPlayers || 4) + '</span></label>';
      html += '<input type="range" id="npc-players-slider" class="npc-slider" min="2" max="8" value="' + (currentNpc.numPlayers || 4) + '" />';
      html += '</div>';
    }

    html += '<div class="npc-input-group" style="margin-top:0.5rem;">';
    html += '<label class="npc-label">Prebuilt Templates</label>';
    html += '<select id="npc-prebuilt-select" class="npc-select">';
    html += '<option value="">(Custom)</option>';
    (threatData.prebuilts || []).forEach(function (p) {
      html += '<option value="' + p.id + '">' + esc(p.name) + ' (T' + p.tier + ' ' + esc(p.classification) + ')</option>';
    });
    html += '</select>';
    html += '</div>';

    if (isVehicleOrShip(activeCat)) {
      var sd = currentNpc.shipDetails || {};
      var detailGroupTitle = isShipCategory(activeCat) ? 'Ship Details' : 'Vehicle Details';
      html += '<div class="npc-input-group npc-ship-details-inputs">';
      html += '<label class="npc-label">' + esc(detailGroupTitle) + '</label>';
      html += '<input type="text" class="npc-text-input npc-ship-field" data-field="hullType" value="' + esc(sd.hullType || '') + '" placeholder="Hull Type (e.g. YT-1300)" />';
      html += '<input type="text" class="npc-text-input npc-ship-field" data-field="crew" value="' + esc(sd.crew || '') + '" placeholder="Crew (e.g. 2 pilots, 1 gunner)" />';
      html += '<input type="text" class="npc-text-input npc-ship-field" data-field="speed" value="' + esc(sd.speed || '') + '" placeholder="Speed / Maneuver (e.g. 4 / 1)" />';
      html += '<input type="text" class="npc-text-input npc-ship-field" data-field="shields" value="' + esc(sd.shields || '') + '" placeholder="Shield Config (e.g. 2/1/1/1)" />';
      html += '<input type="text" class="npc-text-input npc-ship-field" data-field="hyperdrive" value="' + esc(sd.hyperdrive || '') + '" placeholder="Hyperdrive Class (e.g. Class 2)" />';
      html += '<input type="text" class="npc-text-input npc-ship-field" data-field="sensors" value="' + esc(sd.sensors || '') + '" placeholder="Sensor Range (e.g. Medium)" />';
      html += '<input type="text" class="npc-text-input npc-ship-field" data-field="cargo" value="' + esc(sd.cargo || '') + '" placeholder="Cargo (e.g. 100 enc)" />';
      html += '</div>';
    }

    el.innerHTML = html;

    el.querySelectorAll('.npc-category-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var newCat = btn.dataset.cat;
        currentNpc.threatCategory = newCat;
        currentNpc.traits = currentNpc.traits.filter(function (tid) {
          var t = threatData.traits.find(function (tr) { return tr.id === tid; });
          if (!t) return false;
          if (t.autoApply) return false;
          return !t.categories || t.categories.indexOf(newCat) !== -1;
        });
        currentNpc.tags = currentNpc.tags.filter(function (tagId) {
          var tag = threatData.tags.find(function (tg) { return tg.id === tagId; });
          return tag && (!tag.categories || tag.categories.indexOf(newCat) !== -1);
        });
        autoApplyScaleTraits(newCat);
        if (!isVehicleOrShip(newCat)) {
          currentNpc.shipDetails = { hullType: '', crew: '', hyperdrive: '', sensors: '', shields: '', cargo: '', speed: '' };
        }
        renderBuilderLeft();
        renderBuilderRight();
        renderNpcCard();
      });
    });

    document.getElementById('npc-name-input').addEventListener('input', function (e) {
      currentNpc.name = e.target.value;
      renderNpcCard();
    });

    document.getElementById('npc-tier-slider').addEventListener('input', function (e) {
      currentNpc.tier = parseInt(e.target.value, 10);
      el.querySelector('.npc-tier-val').textContent = currentNpc.tier;
      renderNpcCard();
    });

    el.querySelectorAll('.npc-arena-slider').forEach(function (slider) {
      slider.addEventListener('input', function () {
        currentNpc.arenas[slider.dataset.arena] = parseInt(slider.value, 10);
        slider.nextElementSibling.textContent = slider.value;
        renderNpcCard();
      });
    });

    document.getElementById('npc-role-select').addEventListener('change', function (e) {
      currentNpc.role = e.target.value;
      seedAttacksFromRole();
      renderBuilderRight();
      renderNpcCard();
    });

    document.getElementById('npc-class-select').addEventListener('change', function (e) {
      currentNpc.classification = e.target.value;
      renderBuilderLeft();
      renderNpcCard();
    });

    var playersSlider = document.getElementById('npc-players-slider');
    if (playersSlider) {
      playersSlider.addEventListener('input', function (e) {
        currentNpc.numPlayers = parseInt(e.target.value, 10);
        el.querySelector('.npc-tier-val:last-of-type') && (function () {
          var spans = el.querySelectorAll('.npc-tier-val');
          if (spans.length > 1) spans[spans.length - 1].textContent = currentNpc.numPlayers;
        })();
        renderNpcCard();
      });
    }

    document.getElementById('npc-prebuilt-select').addEventListener('change', function (e) {
      var id = e.target.value;
      if (!id) return;
      var pb = (threatData.prebuilts || []).find(function (p) { return p.id === id; });
      if (!pb) return;
      currentNpc.name = pb.name;
      currentNpc.tier = pb.tier;
      currentNpc.threatCategory = pb.threatCategory || 'character';
      currentNpc.classification = pb.classification;
      currentNpc.role = pb.role;
      currentNpc.arenas = JSON.parse(JSON.stringify(pb.arenas));
      currentNpc.traits = pb.traits ? pb.traits.slice() : [];
      currentNpc.tags = pb.tags ? pb.tags.slice() : [];
      currentNpc.loot = pb.loot ? JSON.parse(JSON.stringify(pb.loot)) : [];
      currentNpc.shipDetails = pb.shipDetails ? JSON.parse(JSON.stringify(pb.shipDetails)) : { hullType: '', crew: '', hyperdrive: '', sensors: '', shields: '', cargo: '', speed: '' };
      autoApplyScaleTraits(currentNpc.threatCategory);
      seedAttacksFromRole();
      renderBuilderLeft();
      renderBuilderRight();
      renderNpcCard();
    });

    el.querySelectorAll('.npc-ship-field').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (!currentNpc.shipDetails) currentNpc.shipDetails = {};
        currentNpc.shipDetails[inp.dataset.field] = inp.value;
        renderNpcCard();
      });
    });
  }

  function renderBuilderRight() {
    var el = document.getElementById('npc-builder-right');
    if (!el || !threatData) return;

    var html = '';

    var activeCat = currentNpc.threatCategory || 'character';
    var filteredTraits = threatData.traits.filter(function (t) {
      return !t.categories || t.categories.indexOf(activeCat) !== -1;
    });
    var filteredTags = threatData.tags.filter(function (tag) {
      return !tag.categories || tag.categories.indexOf(activeCat) !== -1;
    });

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Traits</label>';
    filteredTraits.forEach(function (t) {
      var checked = (currentNpc.traits || []).indexOf(t.id) !== -1;
      var isAuto = t.autoApply;
      html += '<label class="npc-checkbox-label' + (isAuto ? ' npc-trait-auto' : '') + '">';
      html += '<input type="checkbox" class="npc-trait-cb" data-trait="' + t.id + '"' + (checked ? ' checked' : '') + (isAuto ? ' disabled' : '') + ' /> ';
      html += '<span>' + esc(t.name) + (isAuto ? ' (auto)' : '') + '</span>';
      html += '<span class="npc-trait-desc">' + esc(t.description) + '</span>';
      html += '</label>';
    });
    html += '</div>';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Tags</label>';
    html += '<div class="npc-tags-grid">';
    filteredTags.forEach(function (tag) {
      var active = (currentNpc.tags || []).indexOf(tag.id) !== -1;
      html += '<button class="npc-tag-btn' + (active ? ' active' : '') + '" data-tag="' + esc(tag.id) + '" title="' + esc(tag.effect) + '">' + esc(tag.name) + '</button>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Attacks</label>';
    if (!currentNpc.attacks || !currentNpc.attacks.length) {
      html += '<div class="npc-attacks-empty">No custom attacks. Add one below.</div>';
    } else {
      currentNpc.attacks.forEach(function (atk, idx) {
        html += '<div class="npc-attack-entry" data-atk-idx="' + idx + '">';
        html += '<input type="text" class="npc-text-input npc-attack-name" data-atk-idx="' + idx + '" value="' + esc(atk.name) + '" placeholder="Attack name" />';
        html += '<div class="npc-attack-controls">';
        var atkArenaLabels = getArenaLabels(currentNpc.threatCategory || 'character');
        html += '<label class="npc-attack-scale-label">Arena:</label>';
        html += '<select class="npc-select npc-attack-arena" data-atk-idx="' + idx + '">';
        ['physique', 'reflex', 'grit', 'wits', 'presence'].forEach(function (a) {
          html += '<option value="' + a + '"' + (atk.arena === a ? ' selected' : '') + '>' + (atkArenaLabels[a] || a) + '</option>';
        });
        html += '</select>';
        html += '<label class="npc-attack-scale-label">Chassis:</label>';
        html += '<select class="npc-select npc-attack-chassis" data-atk-idx="' + idx + '">';
        ['light', 'medium', 'heavy'].forEach(function (c) {
          html += '<option value="' + c + '"' + (atk.chassis === c ? ' selected' : '') + '>' + c.charAt(0).toUpperCase() + c.slice(1) + '</option>';
        });
        html += '</select>';
        html += '<label class="npc-attack-stun-label"><input type="checkbox" class="npc-attack-stun-cb" data-atk-idx="' + idx + '"' + (atk.canStun ? ' checked' : '') + ' /> Stun</label>';
        html += '<button class="npc-attack-remove" data-atk-idx="' + idx + '">&times;</button>';
        html += '</div>';
        html += '</div>';
      });
    }
    html += '<button class="npc-action-btn npc-add-attack-btn" id="npc-add-attack-btn">+ Add Attack</button>';
    html += '</div>';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Loot</label>';
    html += '<div class="npc-loot-search-wrap">';
    html += '<input type="text" id="npc-loot-search" class="npc-text-input" placeholder="Search items..." />';
    html += '<div id="npc-loot-results" class="npc-loot-results"></div>';
    html += '</div>';

    if (currentNpc.loot && currentNpc.loot.length) {
      html += '<div class="npc-loot-list">';
      currentNpc.loot.forEach(function (item, idx) {
        html += '<div class="npc-loot-entry">';
        html += '<span>' + esc(item.name) + (item.qty > 1 ? ' x' + item.qty : '') + '</span>';
        html += '<button class="npc-loot-remove" data-idx="' + idx + '">&times;</button>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="npc-builder-actions">';
    html += '<button class="npc-action-btn npc-save-btn" id="npc-save-btn">Save NPC</button>';
    html += '<button class="npc-action-btn npc-clear-btn" id="npc-clear-btn">Clear</button>';
    html += '</div>';

    html += '<div class="npc-input-group">';
    html += '<label class="npc-label">Saved NPCs</label>';
    html += '<div id="npc-saved-list" class="npc-saved-list">';
    if (savedNpcs.length === 0) {
      html += '<div class="npc-saved-empty">No saved NPCs yet.</div>';
    } else {
      savedNpcs.forEach(function (npc, idx) {
        html += '<div class="npc-saved-entry">';
        var catBadge = (npc.threatCategory && npc.threatCategory !== 'character') ? esc(npc.threatCategory.charAt(0).toUpperCase() + npc.threatCategory.slice(1)) + ' ' : '';
        html += '<span class="npc-saved-name" data-idx="' + idx + '">' + esc(npc.name || 'Unnamed') + ' <span class="npc-saved-meta">' + catBadge + 'T' + npc.tier + ' ' + esc(npc.classification) + '</span></span>';
        html += '<button class="npc-saved-dup" data-idx="' + idx + '" title="Duplicate">&#x2398;</button>';
        html += '<button class="npc-saved-delete" data-idx="' + idx + '">&times;</button>';
        html += '</div>';
      });
    }
    html += '</div>';
    html += '</div>';

    el.innerHTML = html;

    el.querySelectorAll('.npc-attack-name').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var idx = parseInt(inp.dataset.atkIdx, 10);
        if (currentNpc.attacks[idx]) { currentNpc.attacks[idx].name = inp.value; renderNpcCard(); }
      });
    });
    el.querySelectorAll('.npc-attack-arena').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var idx = parseInt(sel.dataset.atkIdx, 10);
        if (currentNpc.attacks[idx]) { currentNpc.attacks[idx].arena = sel.value; renderNpcCard(); }
      });
    });
    el.querySelectorAll('.npc-attack-chassis').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var idx = parseInt(sel.dataset.atkIdx, 10);
        if (currentNpc.attacks[idx]) { currentNpc.attacks[idx].chassis = sel.value; renderNpcCard(); }
      });
    });
    el.querySelectorAll('.npc-attack-stun-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var idx = parseInt(cb.dataset.atkIdx, 10);
        if (currentNpc.attacks[idx]) { currentNpc.attacks[idx].canStun = cb.checked; renderNpcCard(); }
      });
    });
    el.querySelectorAll('.npc-attack-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentNpc.attacks.splice(parseInt(btn.dataset.atkIdx, 10), 1);
        renderBuilderRight();
        renderNpcCard();
      });
    });
    var addAtkBtn = document.getElementById('npc-add-attack-btn');
    if (addAtkBtn) {
      addAtkBtn.addEventListener('click', function () {
        if (!currentNpc.attacks) currentNpc.attacks = [];
        currentNpc.attacks.push({ name: 'Attack ' + (currentNpc.attacks.length + 1), arena: 'physique', powerMod: 0, chassis: 'medium', canStun: false });
        renderBuilderRight();
        renderNpcCard();
      });
    }

    el.querySelectorAll('.npc-trait-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var tid = cb.dataset.trait;
        if (cb.checked) {
          if (currentNpc.traits.indexOf(tid) === -1) currentNpc.traits.push(tid);
        } else {
          currentNpc.traits = currentNpc.traits.filter(function (t) { return t !== tid; });
        }
        renderNpcCard();
      });
    });

    el.querySelectorAll('.npc-tag-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tag = btn.dataset.tag;
        var idx = currentNpc.tags.indexOf(tag);
        if (idx !== -1) {
          currentNpc.tags.splice(idx, 1);
          btn.classList.remove('active');
        } else {
          currentNpc.tags.push(tag);
          btn.classList.add('active');
        }
        renderNpcCard();
      });
    });

    el.querySelectorAll('.npc-loot-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentNpc.loot.splice(parseInt(btn.dataset.idx, 10), 1);
        renderBuilderRight();
        renderNpcCard();
      });
    });

    var lootSearch = document.getElementById('npc-loot-search');
    if (lootSearch) {
      lootSearch.addEventListener('input', function () {
        var q = lootSearch.value.trim().toLowerCase();
        renderLootResults(q);
      });
    }

    document.getElementById('npc-save-btn').addEventListener('click', function () {
      if (!currentNpc.name) { showNpcToast('Enter a name first.'); return; }
      var existing = savedNpcs.findIndex(function (n) { return n.name === currentNpc.name; });
      var copy = JSON.parse(JSON.stringify(currentNpc));
      if (existing !== -1) {
        savedNpcs[existing] = copy;
      } else {
        savedNpcs.push(copy);
      }
      persistSavedNpcs();
      showNpcToast('NPC saved.');
      renderBuilderRight();
    });

    document.getElementById('npc-clear-btn').addEventListener('click', function () {
      currentNpc = {
        name: '', tier: 1, threatCategory: 'character',
        arenas: { physique: 2, reflex: 2, grit: 2, wits: 2, presence: 2 },
        role: '', classification: 'standard',
        traits: [], tags: [], loot: [], attacks: [], numPlayers: 4,
        shipDetails: { hullType: '', crew: '', hyperdrive: '', sensors: '', shields: '', cargo: '', speed: '' }
      };
      renderBuilderLeft();
      renderBuilderRight();
      renderNpcCard();
    });

    el.querySelectorAll('.npc-saved-name').forEach(function (span) {
      span.addEventListener('click', function () {
        var idx = parseInt(span.dataset.idx, 10);
        var npc = savedNpcs[idx];
        if (!npc) return;
        currentNpc = JSON.parse(JSON.stringify(npc));
        if (!currentNpc.threatCategory) currentNpc.threatCategory = 'character';
        if (!currentNpc.shipDetails) currentNpc.shipDetails = { hullType: '', crew: '', hyperdrive: '', sensors: '', shields: '', cargo: '', speed: '' };
        autoApplyScaleTraits(currentNpc.threatCategory);
        if (currentNpc.attacks) {
          currentNpc.attacks.forEach(function (atk) {
            if (!atk.arena) atk.arena = 'physique';
            if (atk.powerMod === undefined) atk.powerMod = 0;
            if (!atk.chassis) {
              var scaleMap = { fleeting: 'light', masterful: 'medium', legendary: 'heavy' };
              atk.chassis = (atk.damageScale && scaleMap[atk.damageScale]) || 'medium';
            }
            delete atk.damageScale;
          });
        }
        renderBuilderLeft();
        renderBuilderRight();
        renderNpcCard();
      });
    });

    el.querySelectorAll('.npc-saved-dup').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.idx, 10);
        var original = savedNpcs[idx];
        if (!original) return;
        var copy = JSON.parse(JSON.stringify(original));
        copy.name = (copy.name || 'Unnamed') + ' (Copy)';
        savedNpcs.push(copy);
        persistSavedNpcs();
        renderBuilderRight();
        showNpcToast('Duplicated: ' + esc(copy.name));
      });
    });

    el.querySelectorAll('.npc-saved-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        savedNpcs.splice(parseInt(btn.dataset.idx, 10), 1);
        persistSavedNpcs();
        renderBuilderRight();
      });
    });
  }

  function renderLootResults(query) {
    var el = document.getElementById('npc-loot-results');
    if (!el) return;
    if (!query || query.length < 2) { el.innerHTML = ''; return; }

    var results = [];
    weaponsCatalog.forEach(function (w) {
      if (w.name.toLowerCase().indexOf(query) !== -1) results.push({ id: w.id, name: w.name, type: 'weapon' });
    });
    armorCatalog.forEach(function (a) {
      if (a.name.toLowerCase().indexOf(query) !== -1) results.push({ id: a.id, name: a.name, type: 'armor' });
    });
    gearCatalog.forEach(function (g) {
      if (g.name.toLowerCase().indexOf(query) !== -1) results.push({ id: g.id, name: g.name, type: 'gear' });
    });

    if (results.length === 0) {
      el.innerHTML = '<div class="npc-loot-no-result">No items found.</div>';
      return;
    }

    el.innerHTML = results.slice(0, 20).map(function (item) {
      return '<div class="npc-loot-result" data-id="' + esc(item.id) + '" data-type="' + esc(item.type) + '" data-name="' + esc(item.name) + '">' +
        '<span>' + esc(item.name) + '</span>' +
        '<span class="npc-loot-type-badge">' + esc(item.type) + '</span>' +
      '</div>';
    }).join('');

    el.querySelectorAll('.npc-loot-result').forEach(function (row) {
      row.addEventListener('click', function () {
        var id = row.dataset.id;
        var existing = currentNpc.loot.find(function (l) { return l.id === id; });
        if (existing) {
          existing.qty = (existing.qty || 1) + 1;
        } else {
          currentNpc.loot.push({ id: id, name: row.dataset.name, type: row.dataset.type, qty: 1 });
        }
        document.getElementById('npc-loot-search').value = '';
        el.innerHTML = '';
        renderBuilderRight();
        renderNpcCard();
      });
    });
  }

  function openNpcBuilder() {
    var overlay = document.getElementById('npc-builder-overlay');
    if (!overlay) return;

    loadSavedNpcs();

    var loadPromises = [];
    if (!threatData) {
      loadPromises.push(
        fetch('/data/threats.json').then(function (r) { return r.json(); }).then(function (d) { threatData = d; })
      );
    }
    if (!weaponsCatalog.length) {
      loadPromises.push(
        fetch('/data/weapons.json').then(function (r) { return r.json(); }).then(function (d) { weaponsCatalog = d; })
      );
    }
    if (!armorCatalog.length) {
      loadPromises.push(
        fetch('/data/armor.json').then(function (r) { return r.json(); }).then(function (d) { armorCatalog = d; })
      );
    }
    if (!gearCatalog.length) {
      loadPromises.push(
        fetch('/data/gear.json').then(function (r) { return r.json(); }).then(function (d) { gearCatalog = d; })
      );
    }

    loadPromises.push(
      fetch('/api/characters').then(function (r) { return r.json(); }).then(function (d) { partyCacheNpc = d.characters || []; })
    );

    Promise.all(loadPromises).then(function () {
      overlay.classList.add('active');
      autoApplyScaleTraits(currentNpc.threatCategory || 'character');
      renderBuilderLeft();
      renderBuilderRight();
      renderNpcCard();
      initMobileBuilderTabs();
    }).catch(function (err) {
      console.error('Failed to load NPC builder data:', err);
      showNpcToast('Failed to load builder data.');
    });
  }

  function closeNpcBuilder() {
    var overlay = document.getElementById('npc-builder-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  var mobileTabsInitialized = false;
  function switchMobilePanel(panelKey) {
    var panels = {
      config: document.getElementById('npc-builder-left'),
      preview: document.getElementById('npc-card-preview'),
      extras: document.getElementById('npc-builder-right')
    };
    var tabs = document.getElementById('npc-builder-mobile-tabs');
    if (tabs) {
      tabs.querySelectorAll('.npc-mobile-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.panel === panelKey);
      });
    }
    Object.keys(panels).forEach(function (k) {
      if (panels[k]) panels[k].style.display = k === panelKey ? '' : 'none';
    });
  }
  function initMobileBuilderTabs() {
    if (mobileTabsInitialized) return;
    var tabs = document.getElementById('npc-builder-mobile-tabs');
    if (!tabs) return;
    mobileTabsInitialized = true;
    tabs.querySelectorAll('.npc-mobile-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchMobilePanel(tab.dataset.panel);
      });
    });
    if (window.innerWidth <= 768) {
      switchMobilePanel('config');
    }
  }

  var _editCallback = null;

  function openWithNpc(npcData, callback) {
    _editCallback = callback || null;
    currentNpc = JSON.parse(JSON.stringify(npcData));
    if (!currentNpc.threatCategory) currentNpc.threatCategory = 'character';
    if (!currentNpc.shipDetails) currentNpc.shipDetails = { hullType: '', crew: '', hyperdrive: '', sensors: '', shields: '', cargo: '', speed: '' };
    if (!currentNpc.traits) currentNpc.traits = [];
    if (!currentNpc.tags) currentNpc.tags = [];
    if (!currentNpc.loot) currentNpc.loot = [];
    if (!currentNpc.attacks) currentNpc.attacks = [];
    if (currentNpc.attacks) {
      currentNpc.attacks.forEach(function (atk) {
        if (!atk.arena) atk.arena = 'physique';
        if (atk.powerMod === undefined) atk.powerMod = 0;
        if (!atk.chassis) {
          var scaleMap = { fleeting: 'light', masterful: 'medium', legendary: 'heavy' };
          atk.chassis = (atk.damageScale && scaleMap[atk.damageScale]) || 'medium';
        }
        delete atk.damageScale;
      });
    }
    openNpcBuilder();
  }

  function closeNpcBuilderWithCallback() {
    if (_editCallback) {
      var stats = calcStats(currentNpc);
      var result = JSON.parse(JSON.stringify(currentNpc));
      result.computed = stats;
      var role = currentNpc.role && threatData ? threatData.roles.find(function (r) { return r.id === currentNpc.role; }) : null;
      if (role) {
        result.roleKit = {
          passives: role.passives || [],
          actions: role.actions || [],
          maneuvers: role.maneuvers || [],
          gambits: role.gambits || [],
          exploits: role.exploits || []
        };
      }
      result.arenas = stats.arenas || currentNpc.arenas;
      _editCallback(result);
      _editCallback = null;
    }
    closeNpcBuilder();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var buildBtn = document.getElementById('cb-build-threat');
    if (buildBtn) buildBtn.addEventListener('click', function () {
      _editCallback = null;
      openNpcBuilder();
    });

    var closeBtn = document.getElementById('npc-builder-close');
    if (closeBtn) closeBtn.addEventListener('click', closeNpcBuilderWithCallback);

    var overlayBg = document.getElementById('npc-builder-overlay');
    if (overlayBg) {
      overlayBg.addEventListener('click', function (e) {
        if (e.target === e.currentTarget) closeNpcBuilderWithCallback();
      });
    }
  });

  function ensureThreatData() {
    if (threatData) return Promise.resolve();
    return fetch('/data/threats.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { threatData = d; });
  }

  function buildNpcFromSaved(savedNpc) {
    return ensureThreatData().then(function () {
      var stats = calcStats(savedNpc);
      var role = savedNpc.role && threatData ? threatData.roles.find(function (r) { return r.id === savedNpc.role; }) : null;
      var roleKit = null;
      if (role) {
        roleKit = {
          passive: (role.passives && role.passives[0]) || null,
          actions: role.actions || [],
          maneuver: (role.maneuvers && role.maneuvers[0]) || null,
          gambit: (role.gambits && role.gambits[0]) || null,
          exploit: (role.exploits && role.exploits[0]) || null
        };
      }
      var cls = savedNpc.classification && threatData ? threatData.classifications.find(function (c) { return c.id === savedNpc.classification; }) : null;
      var maxPower = 0;
      if (stats.powers) {
        Object.keys(stats.powers).forEach(function (k) { if (stats.powers[k] > maxPower) maxPower = stats.powers[k]; });
      }
      var computed = {
        defense: stats.defense,
        evasion: stats.evasion,
        resist: stats.resist,
        vitality: stats.vitality,
        initiative: stats.initiative,
        power: maxPower,
        powers: stats.powers,
        actions: cls && cls.actionsMod ? cls.actionsMod : 1,
        exploits: stats.exploits || 0,
        damageTiers: null
      };
      var weaponChassis = savedNpc.weaponChassis || 'medium';
      var chassisMap = { light: { fleeting: 2, masterful: 4, legendary: 6 }, medium: { fleeting: 3, masterful: 5, legendary: 8 }, heavy: { fleeting: 4, masterful: 7, legendary: 10 } };
      var chassis = chassisMap[weaponChassis] || chassisMap.medium;
      computed.damageTiers = { label: weaponChassis, fleeting: chassis.fleeting, masterful: chassis.masterful, legendary: chassis.legendary };

      return {
        computed: computed,
        roleKit: roleKit
      };
    });
  }

  window.NpcBuilder = {
    getSavedNpcs: function () {
      loadSavedNpcs();
      return savedNpcs.slice();
    },
    openWithNpc: openWithNpc,
    calcStats: calcStats,
    ensureThreatData: ensureThreatData,
    buildNpcFromSaved: buildNpcFromSaved
  };
})();
