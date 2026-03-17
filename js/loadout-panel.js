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
    'ranged':       { arenaId: 'reflex',   discId: 'ranged'       },
    'heavyweapons': { arenaId: 'physique', discId: 'heavyweapons' },
    'melee':        { arenaId: 'physique', discId: 'melee'        },
    'brawl':        { arenaId: 'physique', discId: 'brawl'        }
  };

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

  function _acquisitionBadge(itemId, char) {
    var acqMap = char && char.acquisitionMap ? char.acquisitionMap : {};
    var acq = acqMap[itemId];
    if (!acq) return '';
    if (acq === 'contraband') return '<span class="armory-legality-badge armory-legality-illegal">Contraband</span>';
    return '<span class="armory-legality-badge armory-legality-legal">Registered</span>';
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

  function _buildLoadoutWeaponCard(weapon, char, chassisMap, status, discGambits) {
    var mapping = DISCIPLINE_MAP[weapon.discipline];
    var discDie  = mapping ? _getDiscDie(char, mapping.arenaId, mapping.discId) : 'D4';
    var arenaDie = mapping ? _getEffectiveArenaDie(char, mapping.arenaId) : 'D4';
    var chassisDef = chassisMap[weapon.chassisId] || null;

    var rangeStr = _renderRange(weapon.range);
    var metaHtml =
      '<div class="armory-weapon-meta">' +
        _statusBadge(status, weapon.id, 'weapon') +
        '<span class="armory-weapon-chassis">' + _esc(weapon.chassisLabel || '') + '</span>' +
        (rangeStr ? '<span class="armory-weapon-range">Range: ' + _esc(rangeStr) + '</span>' : '') +
        (weapon.cost ? '<span class="armory-weapon-cost">' + _esc(String(weapon.cost)) + ' cr</span>' : '') +
      '</div>';

    var effectHtml = '';
    if (weapon.customDamage) {
      effectHtml = _buildDamageTrack(weapon.customDamage);
    } else if (chassisDef) {
      effectHtml = _buildDamageTrack(chassisDef.tiers.map(function (t) { return t.damage; }));
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

    var disciplineGambitsList = [];
    if (discGambits && weapon.discipline) {
      var wpnDisc = weapon.discipline.toLowerCase();
      var discSet = discGambits[wpnDisc];
      if (discSet && discSet.gambits) {
        var dMapping = DISCIPLINE_MAP[wpnDisc];
        var charDie = dMapping ? _getDiscDie(char, dMapping.arenaId, dMapping.discId) : 'D4';
        for (var dg = 0; dg < discSet.gambits.length; dg++) {
          var dgam = discSet.gambits[dg];
          if (dgam.modifiesAction === 'action_attack' && _dieIndex(charDie) >= _dieIndex(dgam.requiredDie)) {
            disciplineGambitsList.push({ name: dgam.name, die: dgam.requiredDie, source: discSet.name, text: dgam.rule });
          }
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

    return (
      '<div class="armory-weapon-card" data-weapon-id="' + _esc(weapon.id) + '">' +
        '<div class="armory-weapon-header">' +
          '<span class="armory-weapon-name">' + _esc(weapon.name) + '</span>' +
          ammoBarHtml +
          discHtml +
        '</div>' +
        fireControlsHtml +
        '<div class="armory-weapon-body">' +
          metaHtml + effectHtml + traitHtml + gambitsHtml +
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

    return (
      '<div class="armory-weapon-card" data-armor-id="' + _esc(armor.id) + '">' +
        '<div class="armory-weapon-header">' +
          '<span class="armory-weapon-name">' + _esc(armor.name) + '</span>' +
          discHtml +
        '</div>' +
        '<div class="armory-weapon-body">' +
          metaHtml + ruleHtml + traitsHtml +
        '</div>' +
      '</div>'
    );
  }

  function _buildLoadoutGearCard(gear, status, char) {
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

    return (
      '<div class="armory-weapon-card" data-gear-id="' + _esc(gear.id) + '">' +
        '<div class="armory-weapon-header">' +
          '<span class="armory-weapon-name">' + _esc(gear.name) + '</span>' +
          gearDiscHtml +
        '</div>' +
        '<div class="armory-weapon-body">' +
          metaHtml + effectHtml + descHtml + traitsHtml + gambitsHtml +
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
      if (!ACTIVE_STATUSES[status]) return;
      for (var j = 0; j < weapons.length; j++) {
        if (weapons[j].id === wid) { activeWeapons.push({ weapon: weapons[j], status: status }); break; }
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
    var activeGear = [];
    charGearIds.forEach(function (gid) {
      var entry = statusMap[gid];
      var status = entry ? entry.status : 'stowed';
      if (!ACTIVE_STATUSES[status]) return;
      for (var j = 0; j < (gear || []).length; j++) {
        if (gear[j].id === gid) { activeGear.push({ item: gear[j], status: status }); break; }
      }
    });

    var html = '<div class="armory-panel-wrap">';

    if (!activeArmor && activeWeapons.length === 0 && activeGear.length === 0) {
      html += '<div class="loadout-empty"><span>Nothing equipped or carried.</span><span class="loadout-empty-hint">Open the Armory and set items to Carried or Equipped.</span></div>';
    } else {
      if (activeArmor) {
        html += '<div class="armory-category-label">Armor</div>';
        html += _buildLoadoutArmorCard(activeArmor.armor, char, activeArmor.status);
      }

      var ranged = activeWeapons.filter(function (e) { return (e.weapon.tags || []).indexOf('Melee') === -1; });
      var melee  = activeWeapons.filter(function (e) { return (e.weapon.tags || []).indexOf('Melee') !== -1; });

      if (ranged.length) {
        html += '<div class="armory-category-label">Ranged</div>';
        ranged.forEach(function (e) { html += _buildLoadoutWeaponCard(e.weapon, char, chassisMap, e.status, discGambits); });
      }
      if (melee.length) {
        html += '<div class="armory-category-label">Melee</div>';
        melee.forEach(function (e) { html += _buildLoadoutWeaponCard(e.weapon, char, chassisMap, e.status, discGambits); });
      }
      if (activeGear.length) {
        html += '<div class="armory-category-label">Gear</div>';
        activeGear.forEach(function (e) { html += _buildLoadoutGearCard(e.item, e.status, char); });
      }
    }

    html += '</div>';
    _lastHtml = html;

    var panels = document.querySelectorAll('[id="panel-4"]');
    for (var p = 0; p < panels.length; p++) panels[p].innerHTML = html;
    _injectIntoVisibleSlots(html);
  }

  document.addEventListener('click', function (e) {
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
          _render(weapons, armors, char, chassisMap, statusMap || {}, gear, discGambits);
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
        document.addEventListener('effects:changed', function () {
          var c = window.CharacterPanel && window.CharacterPanel.currentChar;
          if (c) {
            if (charId) {
              fetch('/api/equipment/' + encodeURIComponent(charId))
                .then(function (r) { return r.ok ? r.json() : {}; })
                .then(function (map) { _render(weapons, armors, c, chassisMap, map || {}, gear, discGambits); })
                .catch(function () { _render(weapons, armors, c, chassisMap, {}, gear, discGambits); });
            }
          }
        });
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
