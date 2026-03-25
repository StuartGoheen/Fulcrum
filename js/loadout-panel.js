(function () {
  'use strict';
  // ── Ammo State ──────────────────────────────────────────────
  var _ammoState = {};
  var _currentCharId = null;

  function _getAmmo(weaponId, clipSize) {
    if (_ammoState[weaponId] !== undefined) return _ammoState[weaponId];
    try {
      var stored = localStorage.getItem('ammo_' + weaponId);
      if (stored !== null) {
        var val = parseFloat(stored);
        _ammoState[weaponId] = isNaN(val) ? clipSize : val;
        return _ammoState[weaponId];
      }
    } catch(e) {}
    _ammoState[weaponId] = clipSize;
    return clipSize;
  }

  function _setAmmo(weaponId, value) {
    _ammoState[weaponId] = value;
    try { localStorage.setItem('ammo_' + weaponId, String(value)); } catch(e) {}
  }

  function _calcDrain(clipSize, mode) {
    var base = 1.0;
    var variance = clipSize * 0.008;
    var mult = mode === 'Burst' ? 2 : mode === 'Auto' ? 5 : 1;
    var min = base * mult;
    var max = (base + variance) * mult;
    return Math.round((Math.random() * (max - min) + min) * 10) / 10;
  }

  function _refreshAmmoBar(card, currentAmmo, clipSize) {
    var bar = card.querySelector('.wpn-ammo-bar');
    if (!bar) return;
    var SEGS = 8;
    var pct = clipSize > 0 ? Math.max(0, Math.min(100, Math.round((currentAmmo / clipSize) * 100))) : 0;
    var filled = Math.round((pct / 100) * SEGS);
    var segColor = pct >= 75 ? '#22c55e' : (pct >= 30 ? '#f59e0b' : '#ef4444');
    var glowColor = pct >= 75 ? '#22c55e40' : (pct >= 30 ? '#f59e0b40' : '#ef444440');
    var segsHtml = '';
    for (var i = 0; i < SEGS; i++) {
      segsHtml += i < filled
        ? '<div class="wpn-ammo-seg" style="background:' + segColor + ';box-shadow:0 0 4px ' + glowColor + ';"></div>'
        : '<div class="wpn-ammo-seg wpn-ammo-seg-empty"></div>';
    }
    var disp = Math.round(currentAmmo * 10) / 10;
    bar.setAttribute('data-ammo-pct', pct);
    bar.title = disp + ' / ' + clipSize + ' charges';
    bar.innerHTML = segsHtml;
    var fireBtn = card.querySelector('.lfc-fire-btn');
    if (fireBtn) {
      fireBtn.disabled = currentAmmo < 1.0;
      fireBtn.classList.toggle('is-depleted', currentAmmo < 1.0);
    }
  }



  var DIE_ORDER = ['D4', 'D6', 'D8', 'D10', 'D12'];

  function _dieIndex(dieStr) {
    return DIE_ORDER.indexOf(dieStr.toUpperCase());
  }

  var DISCIPLINE_MAP = {
    'ranged':        { arenaId: 'reflex',   discId: 'ranged'        },
    'heavy_weapons': { arenaId: 'physique', discId: 'heavy_weapons' },
    'heavyweapons':  { arenaId: 'physique', discId: 'heavy_weapons' },
    'melee':         { arenaId: 'physique', discId: 'melee'         },
    'brawl':         { arenaId: 'physique', discId: 'brawl'         }
  };

  var _CATEGORY_TAGS = { 'Any': true, 'Combat': true, 'Force': true };

  function _gambitMatchesWeapon(gambitTags, wpnTags) {
    var hasSpecific = false;
    var specificMatch = false;
    for (var i = 0; i < gambitTags.length; i++) {
      var raw = gambitTags[i].replace(/^\[|\]$/g, '');
      if (_CATEGORY_TAGS[raw]) continue;
      hasSpecific = true;
      var parts = raw.split(/\s+/);
      if (parts.length > 1) {
        var allPresent = true;
        for (var p = 0; p < parts.length; p++) {
          if (wpnTags.indexOf(parts[p]) === -1) { allPresent = false; break; }
        }
        if (allPresent) { specificMatch = true; break; }
      } else {
        if (wpnTags.indexOf(raw) !== -1) { specificMatch = true; break; }
      }
    }
    if (hasSpecific) return specificMatch;
    return gambitTags.length > 0;
  }

  var WEAPON_TIERS = [
    { range: '0\u20133', label: 'Fleeting' },
    { range: '4\u20137', label: 'Masterful'    },
    { range: '8+',       label: 'Legendary' }
  ];

  var ARMOR_CATEGORY_RULES = {
    none:   'Step Down Physique to Endure.',
    light:  'No modification to Physique when Enduring.',
    medium: 'Step Up Physique to Endure \u00b7 Step Down Reflex for Evasion.',
    heavy:  'Step Up Physique twice to Endure \u00b7 Step Down Reflex twice for Evasion.'
  };

  var ACTIVE_STATUSES = { equipped: true, carried: true };

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var GLOSSARY_LINK_MAP = {
    'Disoriented': 'condition_disoriented',
    'Rattled':     'condition_rattled',
    'Optimized':   'condition_optimized',
    'Weakened':    'condition_weakened',
    'Empowered':   'condition_empowered',
    'Shaken':      'condition_shaken',
    'Exposed':     'condition_exposed',
    'Pinned':      'condition_pinned',
    'Prone':       'condition_prone',
    'Hazard':      'condition_hazard',
    'Guarded':     'condition_guarded',
    'Cover':       'condition_cover',
    'Buffered':    'condition_buffered',
    'Blinded':     'condition_blinded',
    'Shut Down':   'condition_shut_down',
    'Restrained':  'condition_restrained',
    'Suppressed':  'condition_suppressed',
    'Bleeding':    'condition_bleeding',
    'Stunned':     'condition_stunned',
    'Incapacitated': 'condition_incapacitated',
    'Marked':      'condition_marked',
    'Slowed':      'condition_slowed',
    'Stimmed':     'stimmed',
    'Natural Recovery': 'natural_recovery',
  };

  function _linkifyText(str) {
    var parts = String(str).split(/(\[[^\]]+\])/g);
    var out = '';
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (part.charAt(0) === '[' && part.charAt(part.length - 1) === ']') {
        var term = part.slice(1, -1);
        var normalized = term.replace(/\s*\d+$/, '').replace(/\s*\(.*\)$/, '').trim();
        var gid  = GLOSSARY_LINK_MAP[normalized];
        if (gid) {
          out += '<span data-glossary-id="' + _esc(gid) + '" class="glossary-link">' + _esc(part) + '</span>';
        } else {
          out += _esc(part);
        }
      } else {
        out += _esc(part).replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
      }
    }
    return out;
  }

  function _buildKitGambitBlock(ability, kitName) {
    return (
      '<div class="armory-gambit-block engine-gambit-block kit-gambit-block">' +
        '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label engine-gambit-label kit-gambit-label">' + _esc(kitName) + '</span>' +
          '<span class="armory-gambit-name">' + _esc(ability.name) + '</span>' +
          (ability.arenaTag ? '<span class="engine-gambit-tag">' + _esc(ability.arenaTag) + '</span>' : '') +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="armory-gambit-body">' +
          (ability.cost ? '<div class="engine-gambit-cost">' + _esc(ability.cost) + '</div>' : '') +
          '<div class="armory-gambit-text">' + _linkifyText(ability.rule) + '</div>' +
          (ability.buyOff
            ? '<div class="kit-gambit-buyoff">Buy-Off: ' + _linkifyText(ability.buyOff) + '</div>'
            : '') +
        '</div>' +
      '</div>'
    );
  }

  function _buildKitPassiveBlock(ability, kitName) {
    var text = ability.shorthand || ability.rule;
    return (
      '<div class="armory-gambit-block kit-passive-block">' +
        '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label kit-passive-label">' + _esc(kitName) + '</span>' +
          '<span class="armory-gambit-name">' + _esc(ability.name) + '</span>' +
          '<span class="kit-passive-badge">Passive</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="armory-gambit-body">' +
          '<div class="armory-gambit-text">' + _linkifyText(text) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _getDiscDie(char, arenaId, discId) {
    var arenas = char.arenas || [];
    for (var i = 0; i < arenas.length; i++) {
      if (arenas[i].id !== arenaId) continue;
      var discs = arenas[i].disciplines || [];
      for (var j = 0; j < discs.length; j++) {
        if (discs[j].id !== discId) continue;
        var baseIdx = DIE_ORDER.indexOf(discs[j].die.toUpperCase());
        var effIdx  = baseIdx + (window.CharacterPanel ? window.CharacterPanel.getDiscEffectOffset(discId, arenaId) : 0);
        if (effIdx < 0) return 'D4';
        if (effIdx > 4) return 'D12';
        return DIE_ORDER[effIdx];
      }
    }
    return 'D4';
  }

  function _getEffectiveArenaDie(char, arenaId) {
    var trauma = window.CharacterPanel ? window.CharacterPanel.getArenaTrauma() : {};
    var traumaLevel  = trauma[arenaId] || 0;
    var effectOffset = window.CharacterPanel ? window.CharacterPanel.getArenaEffectOffset(arenaId) : 0;
    var arenas = char.arenas || [];
    for (var i = 0; i < arenas.length; i++) {
      if (arenas[i].id !== arenaId) continue;
      var baseIdx = DIE_ORDER.indexOf(arenas[i].die.toUpperCase());
      var effIdx  = baseIdx - traumaLevel + effectOffset;
      if (effIdx < 0) effIdx = 0;
      if (effIdx > 4) effIdx = 4;
      return DIE_ORDER[effIdx];
    }
    return 'D4';
  }

  function _dieImg(dieType) {
    return '<img src="/assets/' + dieType.toLowerCase() + '.png" alt="' + _esc(dieType) + '" class="armory-weapon-disc-die">';
  }

  function _acquisitionIcon(itemId, char) {
    var acqMap = char && char.acquisitionMap ? char.acquisitionMap : {};
    var acq = acqMap[itemId];
    if (!acq) return '';
    if (acq === 'contraband') return '<span class="acq-icon acq-contraband" title="Contraband">\u26A0</span>';
    if (acq === 'salvaged') return '<span class="acq-icon acq-salvaged" title="Salvaged">\u2699</span>';
    if (acq === 'legal') return '<span class="acq-icon acq-legal" title="Legal">\u2713</span>';
    return '<span class="acq-icon acq-registered" title="Registered">\u25C8</span>';
  }

  function _renderRange(range) {
    if (!range) return '';
    if (range.engaged) return 'Engaged';
    if (Array.isArray(range)) {
      var eff = range[0], med = range[1], max = range[2];
      return '0\u2013' + eff + ' \u00b7 ' + (eff + 1) + '\u2013' + med + ' \u00b7 ' + (med + 1) + '\u2013' + max;
    }
    if (range.min === 0 && range.max === 0) return 'Engaged';
    if (range.min === range.max) return 'Zone ' + range.min;
    return 'Zones ' + range.min + '\u2013' + range.max;
  }

  function _buildDamageTrack(dmgArr) {
    var html = '<div class="armory-effect-track">';
    for (var i = 0; i < WEAPON_TIERS.length && i < dmgArr.length; i++) {
      html +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(WEAPON_TIERS[i].range) + '</span>' +
          '<span class="armory-effect-name">'  + _esc(WEAPON_TIERS[i].label) + '</span>' +
          '<span class="armory-effect-value">' + _esc(String(dmgArr[i])) + ' Dmg</span>' +
        '</div>';
    }
    return html + '</div>';
  }

  function _buildCustomEffectTrack(rows) {
    var html = '<div class="armory-effect-track">';
    for (var i = 0; i < WEAPON_TIERS.length && i < rows.length; i++) {
      html +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(WEAPON_TIERS[i].range) + '</span>' +
          '<span class="armory-effect-name">'  + _esc(WEAPON_TIERS[i].label) + '</span>' +
          '<span class="armory-effect-value">' + _esc(rows[i]) + '</span>' +
        '</div>';
    }
    return html + '</div>';
  }

  function _buildFixedPowerDieTrack(dieName) {
    var dieFile = dieName.toLowerCase() + '.png';
    var stackHtml =
      '<span class="char-disc-2die-stack">' +
        '<img src="/assets/' + dieFile + '" alt="" class="char-disc-2die-back">' +
        '<img src="/assets/' + dieFile + '" alt="" class="char-disc-2die-front">' +
      '</span>' +
      '<svg viewBox="0 0 10 14" width="8" height="12" style="vertical-align:middle;margin-left:2px;" aria-hidden="true">' +
        '<line x1="5" y1="12" x2="5" y2="5" stroke="var(--color-accent-primary)" stroke-width="2" stroke-linecap="round"/>' +
        '<polygon points="0,6 10,6 5,0" fill="var(--color-accent-primary)"/>' +
      '</svg>';
    var html = '<div class="armory-effect-track">';
    for (var i = 0; i < WEAPON_TIERS.length; i++) {
      html +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(WEAPON_TIERS[i].range) + '</span>' +
          '<span class="armory-effect-name">'  + _esc(WEAPON_TIERS[i].label) + '</span>' +
          '<span class="armory-effect-value" style="display:flex;align-items:center;gap:0;">' + stackHtml + '</span>' +
        '</div>';
    }
    return html + '</div>';
  }

  var LOADOUT_CYCLE = ['equipped', 'carried'];

  function _loadoutCycleStatus(current) {
    var idx = LOADOUT_CYCLE.indexOf(current);
    if (idx === -1) return LOADOUT_CYCLE[0];
    return LOADOUT_CYCLE[(idx + 1) % LOADOUT_CYCLE.length];
  }

  function _loadoutPersist(itemId, itemType, status) {
    if (!_currentCharId) return;
    fetch('/api/equipment/' + encodeURIComponent(_currentCharId) + '/' + encodeURIComponent(itemId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status, itemType: itemType })
    }).then(function() {
      document.dispatchEvent(new CustomEvent('equipment:changed', {
        detail: { charId: _currentCharId, itemId: itemId, itemType: itemType, status: status }
      }));
    }).catch(function(err) { console.error('[LoadoutPanel] persist error', err); });
  }

  function _statusBadge(status, itemId, itemType) {
    var pillAttrs = (itemId && itemType)
      ? ' data-pill-id="' + _esc(itemId) + '" data-pill-type="' + _esc(itemType) + '" data-pill-status="' + _esc(status) + '" style="cursor:pointer"'
      : '';
    return '<span class="armory-state-pill armory-state-' + _esc(status) + ' loadout-status-badge"' + pillAttrs + '>' +
      _esc(status.charAt(0).toUpperCase() + status.slice(1)) +
    '</span>';
  }

  function _buildAmmoBar(clipSize, weaponId) {
    if (!clipSize || clipSize <= 0) return '';
    var SEGS = 8;
    var currentAmmo = weaponId ? _getAmmo(weaponId, clipSize) : clipSize;
    var pct = Math.max(0, Math.min(100, Math.round((currentAmmo / clipSize) * 100)));
    var filled = Math.round((pct / 100) * SEGS);
    var segColor = pct >= 75 ? '#22c55e' : (pct >= 30 ? '#f59e0b' : '#ef4444');
    var glowColor = pct >= 75 ? '#22c55e40' : (pct >= 30 ? '#f59e0b40' : '#ef444440');
    var currentAmmo = Math.round(currentAmmo * 10) / 10;
    var html = '<div class="wpn-ammo-bar" data-clip-size="' + String(clipSize) + '" data-ammo-pct="' + pct + '" title="' + currentAmmo + ' / ' + clipSize + ' charges">';
    for (var i = 0; i < SEGS; i++) {
      if (i < filled) {
        html += '<div class="wpn-ammo-seg" style="background:' + segColor + ';box-shadow:0 0 4px ' + glowColor + ';"></div>';
      } else {
        html += '<div class="wpn-ammo-seg wpn-ammo-seg-empty"></div>';
      }
    }
    html += '</div>';
    return html;
  }


  function _buildFireControls(weapon) {
    if (!weapon.clipSize) return '';
    var modes = weapon.fireModes || ['Standard'];
    var currentAmmo = _getAmmo(weapon.id, weapon.clipSize);
    var depleted = currentAmmo < 1.0;
    var modesHtml = '';
    for (var i = 0; i < modes.length; i++) {
      var m = modes[i];
      var label = m === 'Standard' ? 'Std' : m;
      modesHtml += '<button class="lfc-mode-btn' + (i === 0 ? ' is-active' : '') + '" data-mode="' + m + '">'  + label + '</button>';
    }
    return (
      '<div class="loadout-fire-controls" data-weapon-id="' + weapon.id + '" data-clip-size="' + weapon.clipSize + '">' +
        '<div class="lfc-modes">' + modesHtml + '</div>' +
        '<button class="lfc-fire-btn' + (depleted ? ' is-depleted' : '') + '"' + (depleted ? ' disabled' : '') + '>&#9654; FIRE</button>' +
        '<button class="lfc-reload-btn" title="Reload / Swap Cell">&#8635; RELOAD</button>' +
      '</div>'
    );
  }



  function _buildStunOnlyTrack(chassisDef) {
    var tiers = chassisDef.tiers;
    var html = '<div class="armory-effect-track">';
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      var condStr = t.stunCondition ? ' \u2014 [' + _esc(t.stunCondition) + ']' : '';
      html +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(t.range) + '</span>' +
          '<span class="armory-effect-name">' + _esc(t.label) + '</span>' +
          '<span class="armory-effect-value">Stun ' + _esc(String(t.stunDamage)) + condStr + '</span>' +
        '</div>';
    }
    html += '</div>';
    html += '<div class="armory-mode-note">Stun Check: if Stun Value \u2265 target\u2019s current Vitality \u2192 [Unconscious]. Otherwise, the condition applies only \u2014 no Vitality damage is dealt.</div>';
    return html;
  }
  function _buildStunBlock(chassisDef) {
    var tiers = chassisDef.tiers;
    var rowsHtml = '';
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      rowsHtml +=
        '<div class="armory-effect-row">' +
          '<span class="armory-effect-range">' + _esc(t.range) + '</span>' +
          '<span class="armory-effect-name">'  + _esc(t.label) + '</span>' +
          '<span class="armory-effect-value">Stun ' + _esc(String(t.stunDamage)) + ' — [' + _esc(t.stunCondition) + ']</span>' +
        '</div>';
    }
    return (
      '<div class="armory-gambit-block">' +
        '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
          '<span class="armory-gambit-label">Stun</span>' +
          '<span class="armory-gambit-label armory-stun-setting-label">Setting</span>' +
          '<span class="armory-stun-meta">Max 2 Zones</span>' +
          '<span class="armory-gambit-chevron">&#9656;</span>' +
        '</div>' +
        '<div class="armory-gambit-body">' +
          '<div class="armory-effect-track">' + rowsHtml + '</div>' +
          '<div class="armory-mode-note">Stun Check: if Stun Value ≥ target’s current Vitality → [Unconscious]. Otherwise, the condition applies only — no Vitality damage is dealt.</div>' +
        '</div>' +
      '</div>'
    );
  }
  function _buildLoadoutWeaponCard(weapon, char, chassisMap, status, discGambits) {
    var mapping = DISCIPLINE_MAP[weapon.discipline];
    var discDie  = mapping ? _getDiscDie(char, mapping.arenaId, mapping.discId) : 'D4';
    var arenaDie = mapping ? _getEffectiveArenaDie(char, mapping.arenaId) : 'D4';
    var chassisDef = chassisMap[weapon.chassisId] || null;

    var rangeStr = _renderRange(weapon.range);
    var innateBadge = weapon.innate
      ? '<span class="armory-state-pill armory-state-equipped">Innate</span>'
      : _statusBadge(status, weapon.id, 'weapon');
    var metaHtml =
      '<div class="armory-weapon-meta">' +
        innateBadge +
        '<span class="armory-weapon-chassis">' + _esc(weapon.chassisLabel || '') + '</span>' +
        (rangeStr ? '<span class="armory-weapon-range">Range: ' + _esc(rangeStr) + '</span>' : '') +
        (weapon.cost && !weapon.innate ? '<span class="armory-weapon-cost">' + _esc(String(weapon.cost)) + ' cr</span>' : '') +
      '</div>';

    var effectHtml = '';
    var stunHtml = '';
    if (weapon.stunOnly && chassisDef) {
      effectHtml = _buildStunOnlyTrack(chassisDef);
    } else if (weapon.customDamage) {
      effectHtml = _buildDamageTrack(weapon.customDamage);
    } else if (chassisDef) {
      effectHtml = _buildDamageTrack(chassisDef.tiers.map(function (t) { return t.damage; }));
    }
    if (!weapon.stunOnly && weapon.stunSetting && chassisDef) {
      stunHtml = _buildStunBlock(chassisDef);
    }

    var traitHtml = '';
    if (weapon.trait) {
      traitHtml =
        '<div class="armory-trait-block">' +
          '<div class="armory-trait-name">' + _esc(weapon.trait.name) + '</div>' +
          '<div class="armory-trait-text">' + _esc(weapon.trait.description) + '</div>' +
        '</div>';
    }

    var gambits = [];
    var weaponGambits = weapon.gambits || (weapon.gambit ? [weapon.gambit] : []);
    for (var wg = 0; wg < weaponGambits.length; wg++) {
      gambits.push({ name: weaponGambits[wg].name, source: null, text: weaponGambits[wg].rule });
    }
    var talents = char.talents || [];
    for (var t = 0; t < talents.length; t++) {
      var talent = talents[t];
      if (!talent.gambit || !talent.tags) continue;
      for (var ti = 0; ti < talent.tags.length; ti++) {
        if ((weapon.tags || []).indexOf(talent.tags[ti]) !== -1) {
          gambits.push({ name: talent.name, source: talent.name, text: talent.gambit });
          break;
        }
      }
    }
    var engineGambits = [];
    var engine = char.engine;
    if (engine && engine.gambits) {
      for (var eg = 0; eg < engine.gambits.length; eg++) {
        var eg_ = engine.gambits[eg];
        if (eg_.targetType === 'weapon' && (weapon.tags || []).indexOf(eg_.target) !== -1) {
          engineGambits.push(eg_);
        }
      }
    }

    var kitGambits = [];
    var kitPassives = [];
    var kits = char.kits || [];
    for (var ki = 0; ki < kits.length; ki++) {
      var kit = kits[ki];
      var unlockedTier = kit.tier || 0;
      var kitAbilities = kit.abilities || [];
      for (var ka = 0; ka < kitAbilities.length; ka++) {
        var kab = kitAbilities[ka];
        if (kab.tier > unlockedTier) continue;
        if (kab.type === 'gambit' && kab.targetType === 'weapon') {
          if ((weapon.tags || []).indexOf(kab.target) !== -1) {
            kitGambits.push({ ability: kab, kitName: kit.name });
          }
        } else if (kab.type === 'passive' && Array.isArray(kab.targetWeaponTags)) {
          var wpn = weapon.tags || [];
          var matched = false;
          for (var tw = 0; tw < kab.targetWeaponTags.length; tw++) {
            if (wpn.indexOf(kab.targetWeaponTags[tw]) !== -1) { matched = true; break; }
          }
          if (matched) {
            kitPassives.push({ ability: kab, kitName: kit.name });
          }
        }
      }
    }

    var disciplineGambitsList = [];
    if (discGambits) {
      var wpnTags = weapon.tags || [];
      var seen = {};
      var discKeys = Object.keys(discGambits);
      for (var dk = 0; dk < discKeys.length; dk++) {
        var dkey = discKeys[dk];
        var discSet = discGambits[dkey];
        if (!discSet || !discSet.gambits) continue;
        var dArena = discSet.arenaId;
        var dDisc  = discSet.disciplineId;
        var charDie = (dArena && dDisc) ? _getDiscDie(char, dArena, dDisc) : 'D4';
        for (var dg = 0; dg < discSet.gambits.length; dg++) {
          var dgam = discSet.gambits[dg];
          if (dgam.modifiesAction !== 'action_attack') continue;
          if (_dieIndex(charDie) < _dieIndex(dgam.requiredDie)) continue;
          if (!_gambitMatchesWeapon(dgam.tags || [], wpnTags)) continue;
          if (seen[dgam.id || dgam.name]) continue;
          seen[dgam.id || dgam.name] = true;
          disciplineGambitsList.push({ name: dgam.name, die: dgam.requiredDie, source: discSet.name, text: dgam.rule });
        }
      }
    }

    var gambitsHtml = '';
    for (var g = 0; g < gambits.length; g++) {
      var gam = gambits[g];
      gambitsHtml +=
        '<div class="armory-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label">Gambit</span>' +
            (gam.name ? '<span class="armory-gambit-name">' + _esc(gam.name) + '</span>' : '') +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="armory-gambit-text">' + _linkifyText(gam.text) + '</div>' +
          '</div>' +
        '</div>';
    }
    for (var eg2 = 0; eg2 < engineGambits.length; eg2++) {
      var egb = engineGambits[eg2];
      gambitsHtml +=
        '<div class="armory-gambit-block engine-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label engine-gambit-label">' + _esc(engine.name) + '</span>' +
            '<span class="armory-gambit-name">' + _esc(egb.name) + '</span>' +
            '<span class="engine-gambit-tag">' + _esc(egb.arenaTag) + '</span>' +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="engine-gambit-cost">' + _esc(egb.cost) + '</div>' +
            '<div class="armory-gambit-text">' + _linkifyText(egb.rule) + '</div>' +
          '</div>' +
        '</div>';
    }
    for (var kg = 0; kg < kitGambits.length; kg++) {
      gambitsHtml += _buildKitGambitBlock(kitGambits[kg].ability, kitGambits[kg].kitName);
    }
    for (var kp = 0; kp < kitPassives.length; kp++) {
      gambitsHtml += _buildKitPassiveBlock(kitPassives[kp].ability, kitPassives[kp].kitName);
    }
    for (var dgi = 0; dgi < disciplineGambitsList.length; dgi++) {
      var dgItem = disciplineGambitsList[dgi];
      gambitsHtml +=
        '<div class="armory-gambit-block discipline-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label discipline-gambit-label">' + _esc(dgItem.source) + '</span>' +
            '<span class="armory-gambit-name">' + _esc(dgItem.name) + '</span>' +
            '<span class="armory-gambit-die-badge">' + _esc(dgItem.die) + '</span>' +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="armory-gambit-text">' + _linkifyText(dgItem.text) + '</div>' +
          '</div>' +
        '</div>';
    }

    var discHtml =
      '<div class="armory-weapon-disc">' +
        _dieImg(discDie) +
        '<span class="armory-weapon-disc-sep">/</span>' +
        _dieImg(arenaDie) +
      '</div>';

    var ammoBarHtml = _buildAmmoBar(weapon.clipSize, weapon.id);
    var fireControlsHtml = status === 'equipped' ? _buildFireControls(weapon) : '';

    var dropBtnHtml = weapon.innate ? '' :
      '<div class="armory-item-actions">' +
        '<button class="armory-drop-btn" data-drop-id="' + _esc(weapon.id) + '" data-drop-type="weapon">Drop</button>' +
      '</div>';

    return (
      '<div class="armory-weapon-card" data-weapon-id="' + _esc(weapon.id) + '">' +
        '<div class="armory-weapon-header">' +
          _acquisitionIcon(weapon.id, char) +
          '<span class="armory-weapon-name">' + _esc(weapon.name) + '</span>' +
          ammoBarHtml +
          discHtml +
        '</div>' +
        fireControlsHtml +
        '<div class="armory-weapon-body">' +
          metaHtml + effectHtml + stunHtml + traitHtml + gambitsHtml +
          dropBtnHtml +
        '</div>' +
      '</div>'
    );
  }

  function _buildLoadoutArmorCard(armor, char, status) {
    var discDie  = _getDiscDie(char, 'physique', 'endure');
    var arenaDie = _getEffectiveArenaDie(char, 'physique');

    var categoryRule = ARMOR_CATEGORY_RULES[armor.category] || '';
    if (armor.evasionException && categoryRule) {
      categoryRule = categoryRule.replace(' \u00b7 Step Down Reflex for Evasion.', '') + ' \u00b7 No Evasion penalty (see Trait).';
    }

    var metaHtml =
      '<div class="armory-weapon-meta">' +
        _statusBadge(status, armor.id, 'armor') +
        '<span class="armory-weapon-chassis">' + _esc(armor.categoryLabel || armor.category) + '</span>' +
        (armor.cost ? '<span class="armory-weapon-cost">' + _esc(String(armor.cost)) + ' cr</span>' : '') +
      '</div>';

    var ruleHtml = categoryRule
      ? '<div class="armor-category-rule">' + _esc(categoryRule) + '</div>'
      : '';

    var traitsHtml = '';
    var traits = armor.traits || [];
    for (var i = 0; i < traits.length; i++) {
      traitsHtml +=
        '<div class="armory-trait-block">' +
          '<div class="armory-trait-name">' + _esc(traits[i].name) + '</div>' +
          '<div class="armory-trait-text">' + _esc(traits[i].description) + '</div>' +
        '</div>';
    }

    var discHtml =
      '<div class="armory-weapon-disc">' +
        _dieImg(discDie) +
        '<span class="armory-weapon-disc-sep">/</span>' +
        _dieImg(arenaDie) +
      '</div>';

    var armorDropHtml =
      '<div class="armory-item-actions">' +
        '<button class="armory-drop-btn" data-drop-id="' + _esc(armor.id) + '" data-drop-type="armor">Drop</button>' +
      '</div>';

    return (
      '<div class="armory-weapon-card" data-armor-id="' + _esc(armor.id) + '">' +
        '<div class="armory-weapon-header">' +
          _acquisitionIcon(armor.id, char) +
          '<span class="armory-weapon-name">' + _esc(armor.name) + '</span>' +
          discHtml +
        '</div>' +
        '<div class="armory-weapon-body">' +
          metaHtml + ruleHtml + traitsHtml +
          armorDropHtml +
        '</div>' +
      '</div>'
    );
  }

  function _buildLoadoutGearCard(gear, status, char, qty) {
    var wp = gear.weaponProfile;
    var rangeStr = wp ? _renderRange(wp.range) : '';

    var metaHtml =
      '<div class="armory-weapon-meta">' +
        _statusBadge(status, gear.id, 'gear') +
        '<span class="armory-weapon-chassis">' + _esc(gear.categoryLabel || gear.category) + '</span>' +
        (rangeStr ? '<span class="armory-weapon-range">Range: ' + _esc(rangeStr) + '</span>' : '') +
        (gear.cost ? '<span class="armory-weapon-cost">' + _esc(String(gear.cost)) + ' cr</span>' : '') +
        (gear.availability ? '<span class="armory-weapon-range">Avail: ' + _esc(gear.availability) + '</span>' : '') +
      '</div>';

    var effectHtml = '';
    if (gear.customEffectRows) {
      effectHtml = _buildCustomEffectTrack(gear.customEffectRows);
    } else if (wp && wp.customDamage) {
      effectHtml = _buildDamageTrack(wp.customDamage);
    } else if (wp && wp.fixedPowerDie) {
      effectHtml = _buildFixedPowerDieTrack(wp.fixedPowerDie);
    }

    var gearDiscHtml = '';
    if (wp && wp.fixedPowerDie) {
      var gdf = wp.fixedPowerDie.toLowerCase() + '.png';
      var mapping = DISCIPLINE_MAP[wp.discipline];
      var attackDieHtml = '';
      if (mapping && char) {
        var atkDie = _getDiscDie(char, mapping.arenaId, mapping.discId);
        attackDieHtml = _dieImg(atkDie) + '<span class="armory-weapon-disc-sep">/</span>';
      }
      gearDiscHtml =
        '<div class="armory-weapon-disc">' +
          attackDieHtml +
          '<span class="armory-2die-stack">' +
            '<img src="/assets/' + gdf + '" alt="" class="armory-2die-back">' +
            '<img src="/assets/' + gdf + '" alt="" class="armory-2die-front">' +
          '</span>' +
          '<svg viewBox="0 0 10 14" width="9" height="13" style="margin-left:2px;flex-shrink:0;" aria-hidden="true">' +
            '<line x1="5" y1="12" x2="5" y2="5" stroke="var(--color-accent-primary)" stroke-width="2" stroke-linecap="round"/>' +
            '<polygon points="0,6 10,6 5,0" fill="var(--color-accent-primary)"/>' +
          '</svg>' +
        '</div>';
    }

    var traits = gear.traits || [];
    var descHtml = traits.length === 0 && gear.description
      ? '<div class="armory-gambit-text" style="margin-bottom:4px;">' + _esc(gear.description) + '</div>'
      : '';

    var traitsHtml = '';
    for (var i = 0; i < traits.length; i++) {
      traitsHtml +=
        '<div class="armory-trait-block">' +
          '<div class="armory-trait-name">' + _esc(traits[i].name) + '</div>' +
          '<div class="armory-trait-text">' + _esc(traits[i].description) + '</div>' +
        '</div>';
    }

    var gambitsHtml = '';
    var gambits = gear.gambits || [];
    for (var g = 0; g < gambits.length; g++) {
      var gam = gambits[g];
      gambitsHtml +=
        '<div class="armory-gambit-block">' +
          '<div class="armory-gambit-toggle" role="button" tabindex="0">' +
            '<span class="armory-gambit-label">Gambit</span>' +
            (gam.name ? '<span class="armory-gambit-name">' + _esc(gam.name) + '</span>' : '') +
            '<span class="armory-gambit-chevron">&#9656;</span>' +
          '</div>' +
          '<div class="armory-gambit-body">' +
            '<div class="armory-gambit-text">' + _linkifyText(gam.rule) + '</div>' +
          '</div>' +
        '</div>';
    }

    var isConsumable = (gear.tags || []).indexOf('Consumable') !== -1;
    var gearActionsHtml =
      '<div class="armory-item-actions">' +
        (isConsumable ? '<button class="armory-use-btn" data-use-id="' + _esc(gear.id) + '">Use' + (qty > 1 ? ' 1' : '') + '</button>' : '') +
        '<button class="armory-drop-btn" data-drop-id="' + _esc(gear.id) + '" data-drop-type="gear">Drop</button>' +
      '</div>';

    return (
      '<div class="armory-weapon-card" data-gear-id="' + _esc(gear.id) + '">' +
        '<div class="armory-weapon-header">' +
          _acquisitionIcon(gear.id, char) +
          '<span class="armory-weapon-name">' + _esc(gear.name) + (qty > 1 ? ' <span class="gear-qty-badge">\u00d7' + qty + '</span>' : '') + '</span>' +
          gearDiscHtml +
        '</div>' +
        '<div class="armory-weapon-body">' +
          metaHtml + effectHtml + descHtml + traitsHtml + gambitsHtml +
          gearActionsHtml +
        '</div>' +
      '</div>'
    );
  }

  var _lastHtml = '';
  var SLOT_IDS  = ['slot-left-content', 'slot-right-content'];

  function _injectIntoVisibleSlots(innerHtml) {
    SLOT_IDS.forEach(function (slotId) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      var child = slot.firstElementChild;
      if (child && child.id === 'panel-4') child.innerHTML = innerHtml;
    });
  }

  function _setupSlotObservers() {
    SLOT_IDS.forEach(function (slotId) {
      var slot = document.getElementById(slotId);
      if (!slot) return;
      var observer = new MutationObserver(function () {
        if (_lastHtml) _injectIntoVisibleSlots(_lastHtml);
      });
      observer.observe(slot, { childList: true });
    });
  }

  function _render(weapons, armors, char, chassisMap, statusMap, gear, discGambits) {
    var charWeaponIds = char.weaponIds || [];

    var activeWeapons = [];
    charWeaponIds.forEach(function (wid) {
      var entry = statusMap[wid];
      var status = entry ? entry.status : 'stowed';
      for (var j = 0; j < weapons.length; j++) {
        if (weapons[j].id === wid) {
          if (weapons[j].innate) {
            activeWeapons.push({ weapon: weapons[j], status: 'equipped' });
          } else if (ACTIVE_STATUSES[status]) {
            activeWeapons.push({ weapon: weapons[j], status: status });
          }
          break;
        }
      }
    });

    var activeArmor = null;
    if (char.armorId) {
      var armorEntry = statusMap[char.armorId];
      var armorStatus = armorEntry ? armorEntry.status : 'stowed';
      if (ACTIVE_STATUSES[armorStatus]) {
        for (var a = 0; a < armors.length; a++) {
          if (armors[a].id === char.armorId) { activeArmor = { armor: armors[a], status: armorStatus }; break; }
        }
      }
    }

    var charGearIds = char.gearIds || [];
    var gearQtyMap = {};
    var gearOrder = [];
    for (var gqi = 0; gqi < charGearIds.length; gqi++) {
      var gqid = charGearIds[gqi];
      if (gearQtyMap[gqid]) { gearQtyMap[gqid]++; }
      else { gearQtyMap[gqid] = 1; gearOrder.push(gqid); }
    }
    var activeGear = [];
    for (var goi = 0; goi < gearOrder.length; goi++) {
      var goId = gearOrder[goi];
      var entry = statusMap[goId];
      var status = entry ? entry.status : 'stowed';
      if (!ACTIVE_STATUSES[status]) continue;
      for (var j = 0; j < (gear || []).length; j++) {
        if (gear[j].id === goId) { activeGear.push({ item: gear[j], status: status, qty: gearQtyMap[goId] }); break; }
      }
    }

    var equippedArmor2 = activeArmor && activeArmor.status === 'equipped' ? activeArmor : null;
    var equippedWeapons = activeWeapons.filter(function (e) { return e.status === 'equipped'; });
    var equippedGear = activeGear.filter(function (e) { return e.status === 'equipped'; });

    var carriedArmor = activeArmor && activeArmor.status === 'carried' ? activeArmor : null;
    var carriedWeapons = activeWeapons.filter(function (e) { return e.status === 'carried'; });
    var carriedGear = activeGear.filter(function (e) { return e.status === 'carried'; });

    var hasEquipped = equippedArmor2 || equippedWeapons.length > 0 || equippedGear.length > 0;
    var hasCarried = carriedArmor || carriedWeapons.length > 0 || carriedGear.length > 0;

    var html = '<div class="armory-panel-wrap">';

    if (!hasEquipped && !hasCarried) {
      html += '<div class="loadout-empty"><span>Nothing equipped or carried.</span><span class="loadout-empty-hint">Open the Armory and set items to Carried or Equipped.</span></div>';
    } else {
      if (hasEquipped) {
        html += '<div class="armory-category-label">Equipped</div>';
        if (equippedArmor2) {
          html += _buildLoadoutArmorCard(equippedArmor2.armor, char, 'equipped');
        }
        equippedWeapons.forEach(function (e) { html += _buildLoadoutWeaponCard(e.weapon, char, chassisMap, 'equipped', discGambits); });
        equippedGear.forEach(function (e) { html += _buildLoadoutGearCard(e.item, 'equipped', char, e.qty || 1); });
      }

      if (hasCarried) {
        html += '<div class="armory-category-label">Carried</div>';

        var carriedRanged = carriedWeapons.filter(function (e) { return (e.weapon.tags || []).indexOf('Melee') === -1; });
        var carriedMelee  = carriedWeapons.filter(function (e) { return (e.weapon.tags || []).indexOf('Melee') !== -1; });

        if (carriedArmor) {
          html += '<div class="loadout-carried-section open">';
          html += '<div class="loadout-carried-header" data-toggle-carried>Armor <span class="loadout-carried-chevron">\u25BE</span></div>';
          html += '<div class="loadout-carried-body">';
          html += _buildLoadoutArmorCard(carriedArmor.armor, char, 'carried');
          html += '</div></div>';
        }
        if (carriedRanged.length) {
          html += '<div class="loadout-carried-section open">';
          html += '<div class="loadout-carried-header" data-toggle-carried>Ranged <span class="loadout-carried-chevron">\u25BE</span></div>';
          html += '<div class="loadout-carried-body">';
          carriedRanged.forEach(function (e) { html += _buildLoadoutWeaponCard(e.weapon, char, chassisMap, 'carried', discGambits); });
          html += '</div></div>';
        }
        if (carriedMelee.length) {
          html += '<div class="loadout-carried-section open">';
          html += '<div class="loadout-carried-header" data-toggle-carried>Melee <span class="loadout-carried-chevron">\u25BE</span></div>';
          html += '<div class="loadout-carried-body">';
          carriedMelee.forEach(function (e) { html += _buildLoadoutWeaponCard(e.weapon, char, chassisMap, 'carried', discGambits); });
          html += '</div></div>';
        }
        if (carriedGear.length) {
          html += '<div class="loadout-carried-section open">';
          html += '<div class="loadout-carried-header" data-toggle-carried>Gear <span class="loadout-carried-chevron">\u25BE</span></div>';
          html += '<div class="loadout-carried-body">';
          carriedGear.forEach(function (e) { html += _buildLoadoutGearCard(e.item, 'carried', char, e.qty || 1); });
          html += '</div></div>';
        }
      }
    }

    if (char.debt && char.debt.balance > 0) {
      var debtCreditors = [
        { id: 'hutt_cartel', name: 'The Hutt Cartel', interest: '10%', rate: 0.10 },
        { id: 'black_sun', name: 'Black Sun', interest: '15%', rate: 0.15 },
        { id: 'imperial_surplus', name: 'Imperial Surplus Broker', interest: '20%', rate: 0.20 },
        { id: 'czerka_arms', name: 'Czerka Arms', interest: '25%', rate: 0.25 },
        { id: 'local_fixer', name: 'Local Fixer', interest: '30%', rate: 0.30 },
      ];
      var dCreditor = debtCreditors.find(function(c) { return c.id === char.debt.creditorId; }) || debtCreditors[0];
      var effectiveRate = char.debt.rate !== undefined ? char.debt.rate : dCreditor.rate;
      var owedAmt = Math.round(char.debt.balance * (1 + effectiveRate));
      html += '<div class="armory-category-label" style="color:var(--color-fail)">The Ledger</div>';
      html += '<div class="armory-card" style="border-color:color-mix(in srgb,var(--color-fail) 30%,transparent)">';
      html += '<div class="armory-card-header">';
      html += '<span class="armory-card-name" style="color:var(--color-fail)">' + _esc(dCreditor.name) + '</span>';
      html += '</div>';
      html += '<div class="armory-card-body">';
      html += '<div style="display:flex;justify-content:space-between;font-family:Audiowide,sans-serif;font-size:0.48rem;letter-spacing:0.05em">';
      html += '<span style="color:var(--color-text-secondary)">Balance: ' + char.debt.balance.toLocaleString() + ' cr</span>';
      html += '<span style="color:var(--color-fail)">Next Cycle: ' + owedAmt.toLocaleString() + ' cr (' + Math.round(effectiveRate * 100) + '%)</span>';
      html += '</div></div></div>';
    }

    html += '</div>';
    _lastHtml = html;

    var panels = document.querySelectorAll('[id="panel-4"]');
    for (var p = 0; p < panels.length; p++) panels[p].innerHTML = html;
    _injectIntoVisibleSlots(html);
  }

  function _inventoryAction(charId, action, itemId, itemType) {
    return fetch('/api/inventory/' + encodeURIComponent(charId) + '/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: itemId, itemType: itemType })
    }).then(function (res) {
      if (!res.ok) throw new Error('Inventory ' + action + ' failed: ' + res.status);
      return res.json();
    });
  }

  function _refreshCharacterAfterInventory() {
    var char = window.CharacterPanel && window.CharacterPanel.currentChar;
    if (!char || !char.id) return;
    fetch('/api/characters/' + encodeURIComponent(char.id))
      .then(function (res) { return res.json(); })
      .then(function (updated) {
        if (window.CharacterPanel) window.CharacterPanel.currentChar = updated;
        document.dispatchEvent(new CustomEvent('character:stateChanged'));
      });
  }

  function _showInventoryConfirm(message, actionLabel, actionClass, onConfirm) {
    var existing = document.getElementById('inv-confirm-overlay');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'inv-confirm-overlay';
    overlay.className = 'inv-confirm-overlay';
    overlay.innerHTML =
      '<div class="inv-confirm-modal">' +
        '<div class="inv-confirm-msg">' + _esc(message) + '</div>' +
        '<div class="inv-confirm-actions">' +
          '<button class="inv-confirm-cancel">Cancel</button>' +
          '<button class="inv-confirm-ok ' + actionClass + '">' + _esc(actionLabel) + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.inv-confirm-cancel').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) overlay.remove(); });
    overlay.querySelector('.inv-confirm-ok').addEventListener('click', function () {
      overlay.remove();
      onConfirm();
    });
  }

  document.addEventListener('click', function (e) {
    var carriedHdr = e.target.closest && e.target.closest('[data-toggle-carried]');
    if (carriedHdr) {
      var section = carriedHdr.closest('.loadout-carried-section');
      if (section) section.classList.toggle('open');
      return;
    }

    var useBtn = e.target.closest && e.target.closest('.armory-use-btn');
    if (useBtn && useBtn.closest('[id="panel-4"]')) {
      e.stopPropagation();
      var itemId = useBtn.dataset.useId;
      if (!itemId || !_currentCharId) return;
      var itemName = useBtn.closest('.armory-weapon-card').querySelector('.armory-weapon-name').textContent.split('\u00d7')[0].trim();
      var charId = _currentCharId;
      _showInventoryConfirm('Use one ' + itemName + '?', 'Use', 'inv-btn-use', function () {
        _inventoryAction(charId, 'use', itemId, 'gear')
          .then(function () { _refreshCharacterAfterInventory(); })
          .catch(function (err) { console.error('[LoadoutPanel] use error', err); });
      });
      return;
    }

    var dropBtn = e.target.closest && e.target.closest('.armory-drop-btn');
    if (dropBtn && dropBtn.closest('[id="panel-4"]')) {
      e.stopPropagation();
      var dropId = dropBtn.dataset.dropId;
      var dropType = dropBtn.dataset.dropType;
      if (!dropId || !dropType || !_currentCharId) return;
      var itemName = dropBtn.closest('.armory-weapon-card').querySelector('.armory-weapon-name').textContent.split('\u00d7')[0].trim();
      var charId = _currentCharId;
      _showInventoryConfirm('Drop ' + itemName + '?', 'Drop', 'inv-btn-drop', function () {
        _inventoryAction(charId, 'drop', dropId, dropType)
          .then(function () { _refreshCharacterAfterInventory(); })
          .catch(function (err) { console.error('[LoadoutPanel] drop error', err); });
      });
      return;
    }

    // ── Loadout status badge click ────────────────────────
    var badge = e.target.closest && e.target.closest('.loadout-status-badge[data-pill-id]');
    if (badge && badge.closest('[id="panel-4"]')) {
      e.stopPropagation();
      var itemId   = badge.dataset.pillId;
      var itemType = badge.dataset.pillType;
      var current  = badge.dataset.pillStatus || 'stowed';
      var next     = _loadoutCycleStatus(current);
      badge.dataset.pillStatus = next;
      badge.className = 'armory-state-pill armory-state-' + next + ' loadout-status-badge';
      badge.textContent = next.charAt(0).toUpperCase() + next.slice(1);
      _loadoutPersist(itemId, itemType, next);
      return;
    }

    // ── Fire mode toggle ───────────────────────────────
    var modeBtn = e.target.closest && e.target.closest('.lfc-mode-btn');
    if (modeBtn && modeBtn.closest('[id="panel-4"]')) {
      var fc = modeBtn.closest('.loadout-fire-controls');
      if (fc) {
        fc.querySelectorAll('.lfc-mode-btn').forEach(function(b) { b.classList.remove('is-active'); });
        modeBtn.classList.add('is-active');
      }
      return;
    }

    // ── Fire button ───────────────────────────────────
    var fireBtn = e.target.closest && e.target.closest('.lfc-fire-btn');
    if (fireBtn && !fireBtn.disabled && fireBtn.closest('[id="panel-4"]')) {
      var fc = fireBtn.closest('.loadout-fire-controls');
      if (!fc) return;
      var wId = fc.getAttribute('data-weapon-id');
      var cs  = parseInt(fc.getAttribute('data-clip-size'), 10);
      var active = fc.querySelector('.lfc-mode-btn.is-active');
      var mode = active ? active.getAttribute('data-mode') : 'Standard';
      var current = _getAmmo(wId, cs);
      if (current < 1.0) return;
      var drain = _calcDrain(cs, mode);
      var next  = Math.max(0, Math.round((current - drain) * 10) / 10);
      _setAmmo(wId, next);
      _refreshAmmoBar(fc.closest('.armory-weapon-card'), next, cs);
      document.dispatchEvent(new CustomEvent('ammo-changed', { detail: { weaponId: wId, current: next, clipSize: cs } }));
      return;
    }

    // ── Reload button ──────────────────────────────────
    var reloadBtn = e.target.closest && e.target.closest('.lfc-reload-btn');
    if (reloadBtn && reloadBtn.closest('[id="panel-4"]')) {
      var fc = reloadBtn.closest('.loadout-fire-controls');
      if (!fc) return;
      var wId = fc.getAttribute('data-weapon-id');
      var cs  = parseInt(fc.getAttribute('data-clip-size'), 10);
      _setAmmo(wId, cs);
      _refreshAmmoBar(fc.closest('.armory-weapon-card'), cs, cs);
      document.dispatchEvent(new CustomEvent('ammo-changed', { detail: { weaponId: wId, current: cs, clipSize: cs } }));
      return;
    }

    var header = e.target.closest && e.target.closest('.armory-weapon-header');
    if (header && header.closest('[id="panel-4"]')) {
      var card = header.closest('.armory-weapon-card');
      if (!card) return;
      var body = card.querySelector('.armory-weapon-body');
      if (!body) return;
      var isOpen = card.classList.contains('is-open');
      document.querySelectorAll('[id="panel-4"] .armory-weapon-card').forEach(function (c) {
        c.classList.remove('is-open');
        var b = c.querySelector('.armory-weapon-body');
        if (b) b.classList.remove('open');
      });
      if (!isOpen) { card.classList.add('is-open'); body.classList.add('open'); }
      return;
    }
    var gambitToggle = e.target.closest && e.target.closest('.armory-gambit-toggle');
    if (gambitToggle && gambitToggle.closest('[id="panel-4"]')) {
      var block = gambitToggle.closest('.armory-gambit-block');
      if (block) block.classList.toggle('is-open');
    }
  });

  function init() {
    _setupSlotObservers();

    Promise.all([
      fetch('/data/chassis.json').then(function (r) { return r.json(); }),
      fetch('/data/weapons.json').then(function (r) { return r.json(); }),
      fetch('/data/armor.json').then(function (r) { return r.json(); }),
      fetch('/data/gear.json').then(function (r) { return r.json(); }),
      fetch('/data/maneuvers.json').then(function (r) { return r.json(); })
    ])
    .then(function (results) {
      var chassisMap = results[0];
      var weapons    = results[1];
      var armors     = results[2];
      var gear       = results[3];
      var maneuversData = results[4];
      var discGambits = maneuversData ? maneuversData.disciplineGambits || {} : {};

      function tryRender() {
        var char = window.CharacterPanel && window.CharacterPanel.currentChar;
        if (!char) { setTimeout(tryRender, 50); return; }

        var charId = char.id || null;
        _currentCharId = charId;

        function doRender(statusMap) {
          var c = window.CharacterPanel && window.CharacterPanel.currentChar;
          if (!c) return;
          _render(weapons, armors, c, chassisMap, statusMap || {}, gear, discGambits);
        }

        function fetchAndRender() {
          if (charId) {
            fetch('/api/equipment/' + encodeURIComponent(charId))
              .then(function (r) { return r.ok ? r.json() : {}; })
              .then(doRender)
              .catch(function () { doRender({}); });
          } else {
            doRender({});
          }
        }

        fetchAndRender();

        document.addEventListener('equipment:changed', fetchAndRender);
        document.addEventListener('character:stateChanged', fetchAndRender);
        document.addEventListener('effects:changed', fetchAndRender);
      }
      tryRender();
    })
    .catch(function (err) { console.error('[LoadoutPanel]', err); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
