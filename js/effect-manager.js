(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────────

  var EFFECT_DEFS = [
    {
      id: 'disoriented',
      label: 'Disoriented',
      category: 'dice_modifier',
      conditionType: 'physical',
      modifier: { type: 'control_down' },
      targetMode: 'fixed_arenas',
      fixedArenas: ['physique', 'reflex'],
      defaultDuration: 'tactical',
      description: 'Physical coordination compromised. PC: Step Down the Control Die on physical rolls (Physique, Reflex). NPC: Presence -1 (physical actions). Superseded by [Blinded]. Combined with [Rattled] to form [Stunned].',
    },
    {
      id: 'rattled',
      label: 'Rattled',
      category: 'dice_modifier',
      conditionType: 'mental',
      modifier: { type: 'control_down' },
      targetMode: 'fixed_arenas',
      fixedArenas: ['grit', 'wits', 'presence'],
      defaultDuration: 'tactical',
      description: 'Mental focus compromised. PC: Step Down the Control Die on mental/social rolls (Grit, Wits, Presence). NPC: Presence -1 (mental/social). Combined with [Disoriented] to form [Stunned].',
    },
    {
      id: 'optimized',
      label: 'Optimized',
      category: 'dice_modifier',
      conditionType: 'buff',
      modifier: { type: 'control_up' },
      targetMode: 'control',
      defaultDuration: 'tactical',
      description: 'Tactical advantage. PC: Step Up the Control Die (source specifies scope). NPC: Presence +1 (scoped). Does not stack with itself.',
    },
    {
      id: 'weakened',
      label: 'Weakened',
      category: 'dice_modifier',
      conditionType: 'physical',
      modifier: { type: 'power_down' },
      targetMode: 'arena_only',
      defaultDuration: 'tactical',
      description: 'Power output compromised. PC: Step Down the Power Die for the specified Arena. NPC: Specified arena rating -1.',
    },
    {
      id: 'empowered',
      label: 'Empowered',
      category: 'dice_modifier',
      conditionType: 'buff',
      modifier: { type: 'power_up' },
      targetMode: 'arena_only',
      defaultDuration: 'tactical',
      description: 'Power output boosted. PC: Step Up the Power Die for specified Arena. NPC: Specified arena rating +1. Does not stack on same Arena.',
    },
    {
      id: 'shaken',
      label: 'Shaken',
      category: 'tier_modifier',
      conditionType: 'mental',
      modifier: { type: 'tier_down', amount: 1 },
      targetMode: 'universal',
      defaultDuration: 'immediate',
      description: 'Outgoing effectiveness reduced. PC and NPC: Reduce outgoing Effect by 1 Tier on all actions.',
    },
    {
      id: 'exposed',
      label: 'Exposed',
      category: 'tier_modifier',
      conditionType: 'positional',
      modifier: { type: 'tier_up', amount: 1 },
      targetMode: 'universal',
      defaultDuration: 'immediate',
      description: 'Defenses open. Incoming specified attacks Step Up 1 Tier. Source specifies scope.',
    },
    {
      id: 'pinned',
      label: 'Pinned',
      category: 'combined',
      conditionType: 'combined',
      modifier: { type: 'combined' },
      components: ['prone', 'restrained'],
      targetMode: 'universal',
      defaultDuration: 'immediate',
      description: 'Combined: [Prone] + [Restrained]. Cannot move, [Exposed] to Melee. Shared source/duration/recovery.',
    },
    {
      id: 'prone',
      label: 'Prone',
      category: 'action_economy',
      conditionType: 'physical',
      modifier: { type: 'prone_compound' },
      targetMode: 'universal',
      defaultDuration: 'immediate',
      description: 'On the ground. [Exposed] to all Melee attacks. Standing costs a Maneuver.',
    },
    {
      id: 'hazard',
      label: 'Hazard X',
      category: 'ongoing_damage',
      conditionType: 'environmental',
      modifier: { type: 'hazard' },
      targetMode: 'narrative_tag',
      requiresValue: true,
      defaultDuration: 'ongoing',
      description: 'Damage over time. Deal X Vitality damage at the start of each turn. Source specifies type and recovery.',
    },
    {
      id: 'guarded',
      label: 'Guarded',
      category: 'tier_modifier',
      conditionType: 'positional',
      modifier: { type: 'guard' },
      targetMode: 'universal',
      requiresValue: true,
      defaultDuration: 'immediate',
      description: 'Reduce incoming Melee Effect by X Tiers (minimum Tier 0).',
    },
    {
      id: 'cover',
      label: 'Cover',
      category: 'tier_modifier',
      conditionType: 'positional',
      modifier: { type: 'cover' },
      targetMode: 'universal',
      requiresValue: true,
      defaultDuration: 'immediate',
      description: 'Reduce incoming Ranged Effect by X Tiers (minimum Tier 0). Cover 1 = crate. Cover 2 = reinforced wall.',
    },
    {
      id: 'buffered',
      label: 'Buffered',
      category: 'vitality_buffer',
      conditionType: 'buff',
      modifier: { type: 'buffer' },
      targetMode: 'universal',
      requiresValue: true,
      defaultDuration: 'immediate',
      description: 'Temporary damage absorption. Incoming damage depletes Buffer first.',
    },
    {
      id: 'blinded',
      label: 'Blinded',
      category: 'action_economy',
      conditionType: 'physical',
      modifier: { type: 'blind' },
      targetMode: 'fixed_arenas',
      fixedArenas: ['physique', 'reflex'],
      defaultDuration: 'immediate',
      description: 'No targeted Ranged attacks. Step Down Control Die on all physical actions. Supersedes [Disoriented].',
    },
        {
      id: 'incapacitated',
      label: 'Incapacitated',
      category: 'action_economy',
      conditionType: 'special',
      modifier: { type: 'incapacitate' },
      targetMode: 'universal',
      defaultDuration: 'immediate',
      description: 'Fully unable to act. Cannot take actions, maneuvers, or Exploits. Automatically fails defense rolls. Source determines duration and recovery.',
    },
    {
      id: 'shut_down',
      label: 'Shut Down',
      category: 'action_economy',
      conditionType: 'special',
      modifier: { type: 'incapacitate' },
      targetMode: 'universal',
      defaultDuration: 'lingering',
      description: 'Droid only. Fully incapacitated. Source determines recovery.',
    },
    {
      id: 'restrained',
      label: 'Restrained',
      category: 'action_economy',
      conditionType: 'physical',
      modifier: { type: 'lock_all_move' },
      targetMode: 'universal',
      defaultDuration: 'immediate',
      description: 'Cannot move. Supersedes [Slowed]. Escaping requires opposed check or ability.',
    },
    {
      id: 'suppressed',
      label: 'Suppressed',
      category: 'action_economy',
      conditionType: 'positional',
      modifier: { type: 'suppress' },
      targetMode: 'universal',
      defaultDuration: 'tactical',
      description: 'Engaged at range. Cannot leave zone without presenting Opening to suppressor.',
    },
    {
      id: 'bleeding',
      label: 'Bleeding',
      category: 'ongoing_damage',
      conditionType: 'physical',
      modifier: { type: 'hazard' },
      targetMode: 'narrative_tag',
      defaultDuration: 'ongoing',
      description: 'Active blood loss. 1 Vitality damage at start of each turn. Source determines recovery.',
    },
    {
      id: 'stunned',
      label: 'Stunned',
      category: 'combined',
      conditionType: 'combined',
      modifier: { type: 'combined' },
      components: ['disoriented', 'rattled'],
      targetMode: 'fixed_arenas',
      fixedArenas: ['physique', 'reflex', 'grit', 'wits', 'presence'],
      defaultDuration: 'tactical',
      description: 'Combined: [Disoriented] + [Rattled]. Both effects stack. Physical -1, mental/social -2. Shared source/duration/recovery.',
    },
    {
      id: 'surprised',
      label: 'Surprised',
      category: 'combined',
      conditionType: 'combined',
      modifier: { type: 'combined' },
      components: ['disoriented', 'exposed'],
      targetMode: 'fixed_arenas',
      fixedArenas: ['physique', 'reflex'],
      defaultDuration: 'immediate',
      description: 'Combined: [Disoriented] + [Exposed]. Caught off guard at combat start. Physical coordination compromised and defenses open. Clears at end of first turn.',
    },
    {
      id: 'marked',
      label: 'Marked',
      category: 'operational_status',
      conditionType: 'tag',
      modifier: { type: 'tag' },
      targetMode: 'universal',
      defaultDuration: 'immediate',
      description: 'Tag — no inherent effect. Source defines what [Marked] enables.',
    },
    {
      id: 'slowed',
      label: 'Slowed',
      category: 'action_economy',
      conditionType: 'physical',
      modifier: { type: 'slow' },
      targetMode: 'universal',
      defaultDuration: 'immediate',
      description: 'Max 1 zone movement per round. Superseded by [Restrained].',
    },
    {
      id: 'stimmed',
      label: 'Stimmed',
      category: 'operational_status',
      conditionType: 'tag',
      modifier: { type: 'stimmed' },
      targetMode: 'universal',
      requiresValue: false,
      stacks: true,
      defaultDuration: 'ongoing',
      description: 'Stacking. Each Medpac/Stim use adds +1. Adds to Static Risk of Medicine rolls. Clears on Long Rest.',
    },
  ];

  var DURATIONS = [
    { id: 'immediate',    label: 'Immediate',    hint: 'Next action / reaction only' },
    { id: 'tactical',     label: 'Tactical',     hint: 'Until start of your next turn' },
    { id: 'lingering',    label: 'Lingering',    hint: "Until end of target's next turn" },
    { id: 'ongoing',      label: 'Ongoing',      hint: 'Requires recovery to clear' },
    { id: 'end_of_scene', label: 'End of Scene', hint: 'Cleared when scene ends' },
    { id: 'permanent',    label: 'Permanent',    hint: 'Narrative consequence only' },
  ];

  var SESSION_EFFECTS_KEY   = 'eote-effects';
  var SESSION_LOG_KEY       = 'eote-combat-log';
  var LOG_MAX               = 200;

  // ─── State ────────────────────────────────────────────────────────────────────

  var _activeEffects   = [];
  var _combatLog       = [];
  var _uidCounter      = 0;

  // ─── Persistence ──────────────────────────────────────────────────────────────

  function _saveEffects() {
    try {
      sessionStorage.setItem(SESSION_EFFECTS_KEY, JSON.stringify(_activeEffects));
    } catch (_) {}
  }

  function _loadEffects() {
    try {
      var raw = sessionStorage.getItem(SESSION_EFFECTS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) _activeEffects = parsed;
      }
    } catch (_) {}
  }

  function _saveLog() {
    try {
      sessionStorage.setItem(SESSION_LOG_KEY, JSON.stringify(_combatLog));
    } catch (_) {}
  }

  function _loadLog() {
    try {
      var raw = sessionStorage.getItem(SESSION_LOG_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) _combatLog = parsed;
      }
    } catch (_) {}
  }

  // ─── Combat Log ───────────────────────────────────────────────────────────────

  function _logEntry(type, effectId, target, message) {
    _combatLog.unshift({ ts: Date.now(), type: type, effectId: effectId, target: target, message: message });
    if (_combatLog.length > LOG_MAX) _combatLog.length = LOG_MAX;
    _saveLog();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function _uid() {
    return 'eff_' + Date.now() + '_' + (_uidCounter++);
  }

  function _defById(effectId) {
    for (var i = 0; i < EFFECT_DEFS.length; i++) {
      if (EFFECT_DEFS[i].id === effectId) return EFFECT_DEFS[i];
    }
    return null;
  }

  function _durationById(durationId) {
    for (var i = 0; i < DURATIONS.length; i++) {
      if (DURATIONS[i].id === durationId) return DURATIONS[i];
    }
    return null;
  }

  function _dispatchEffectsChanged() {
    document.dispatchEvent(new CustomEvent('effects:changed'));
  }

  // ─── Effect Application Logic ─────────────────────────────────────────────────

  function _isDuplicate(effectId, target, duration) {
    var def = _defById(effectId);
    if (def && def.stacks) return false;
    for (var i = 0; i < _activeEffects.length; i++) {
      var e = _activeEffects[i];
      if (e.effectId === effectId && e.target === target && e.duration === duration) return true;
    }
    return false;
  }

  function _applyEffect(effectId, target, duration, hazardValue) {
    var def = _defById(effectId);
    if (!def) return false;

    if (def.modifier && def.modifier.type === 'hazard' && !def.requiresValue) {
      hazardValue = 1;
    }

    if (def.stacks) {
      for (var si = 0; si < _activeEffects.length; si++) {
        if (_activeEffects[si].effectId === effectId) {
          _activeEffects[si].hazardValue = (_activeEffects[si].hazardValue || 1) + 1;
          _saveEffects();
          _logEntry('applied', effectId, _activeEffects[si].target, def.label + ' incremented to ' + _activeEffects[si].hazardValue);
          _dispatchEffectsChanged();
          return true;
        }
      }
      var stackEntry = {
        uid:         _uid(),
        effectId:    effectId,
        target:      'universal',
        duration:    'ongoing',
        hazardValue: 1,
      };
      _activeEffects.push(stackEntry);
      _saveEffects();
      _logEntry('applied', effectId, 'universal', def.label + ' 1 applied — Ongoing');
      _dispatchEffectsChanged();
      return true;
    }

    if (_isDuplicate(effectId, target, duration)) return false;
    var entry = {
      uid:         _uid(),
      effectId:    effectId,
      target:      target,
      duration:    duration,
      hazardValue: hazardValue || 0,
    };
    _activeEffects.push(entry);
    _saveEffects();
    var targetLabel = _targetLabel(target, effectId);
    var durLabel    = (_durationById(duration) || {}).label || duration;
    _logEntry('applied', effectId, target, def.label + ' (' + targetLabel + ') applied — ' + durLabel);
    _dispatchEffectsChanged();
    return true;
  }

  function _removeEffect(uid) {
    for (var i = 0; i < _activeEffects.length; i++) {
      if (_activeEffects[i].uid === uid) {
        var e   = _activeEffects[i];
        var def = _defById(e.effectId);
        var targetLabel = _targetLabel(e.target, e.effectId);
        var durLabel    = (_durationById(e.duration) || {}).label || e.duration;
        _activeEffects.splice(i, 1);
        _saveEffects();
        _logEntry('removed', e.effectId, e.target, (def ? def.label : e.effectId) + ' (' + targetLabel + ') removed — ' + durLabel);
        _dispatchEffectsChanged();
        return;
      }
    }
  }

  // ─── Target Label Helper ──────────────────────────────────────────────────────

  function _targetLabel(target, effectId) {
    if (target === 'universal') return 'Universal';
    if (target === 'fixed') {
      var def = _defById(effectId);
      if (def && def.fixedArenas) {
        return def.fixedArenas.map(function (a) {
          return a.charAt(0).toUpperCase() + a.slice(1);
        }).join(', ');
      }
      return 'Fixed';
    }
    if (target.indexOf('arena:') === 0) {
      var arenaId = target.slice(6);
      return _arenaLabel(arenaId) + ' (All)';
    }
    if (target.indexOf('disc:') === 0) {
      var discId = target.slice(5);
      return _discLabel(discId);
    }
    return target;
  }

  function _arenaLabel(arenaId) {
    var char = window.CharacterPanel && window.CharacterPanel.currentChar;
    if (char && char.arenas) {
      for (var i = 0; i < char.arenas.length; i++) {
        if (char.arenas[i].id === arenaId) return char.arenas[i].label;
      }
    }
    return arenaId.charAt(0).toUpperCase() + arenaId.slice(1);
  }

  function _discLabel(discId) {
    var char = window.CharacterPanel && window.CharacterPanel.currentChar;
    if (char && char.arenas) {
      for (var a = 0; a < char.arenas.length; a++) {
        var discs = char.arenas[a].disciplines;
        for (var d = 0; d < discs.length; d++) {
          if (discs[d].id === discId) return discs[d].label;
        }
      }
    }
    return discId;
  }

  
  function _getComponentEffectIds(effectId) {
    var def = _defById(effectId);
    if (!def || !def.components) return [effectId];
    var result = [];
    for (var c = 0; c < def.components.length; c++) {
      result.push(def.components[c]);
    }
    return result;
  }

// ─── Offset Queries (used by character-panel.js) ─────────────────────────────

  function _getArenaEffectOffset(arenaId) {
    var hasUp = false, hasDown = false;
    for (var i = 0; i < _activeEffects.length; i++) {
      var e = _activeEffects[i];
      if (e.duration === 'immediate') continue;
      var componentIds = _getComponentEffectIds(e.effectId);
      for (var ci = 0; ci < componentIds.length; ci++) {
        var cDef = _defById(componentIds[ci]);
        if (!cDef) continue;
        if (e.target !== 'arena:' + arenaId && e.target !== 'universal') continue;
        if (cDef.modifier.type === 'power_up')   hasUp   = true;
        if (cDef.modifier.type === 'power_down') hasDown = true;
      }
    }
    return (hasUp ? 1 : 0) - (hasDown ? 1 : 0);
  }

  function _getDiscEffectOffset(discId, arenaId) {
    var hasUp = false, hasDown = false;
    for (var i = 0; i < _activeEffects.length; i++) {
      var e = _activeEffects[i];
      if (e.duration === 'immediate') continue;
      var componentIds = _getComponentEffectIds(e.effectId);
      for (var ci = 0; ci < componentIds.length; ci++) {
        var cDef = _defById(componentIds[ci]);
        if (!cDef) continue;
        var modType = cDef.modifier.type;
        var isControlMod = (modType === 'control_up' || modType === 'control_down');
        var isBlind = (modType === 'blind');
        if (!isControlMod && !isBlind) continue;
        var applies = false;
        if (e.target === 'fixed' || (cDef.fixedArenas && cDef.fixedArenas.length > 0)) {
          applies = cDef.fixedArenas && cDef.fixedArenas.indexOf(arenaId) !== -1;
        } else {
          applies = (
            e.target === 'universal' ||
            e.target === 'arena:' + arenaId ||
            e.target === 'disc:' + discId
          );
        }
        if (!applies) continue;
        if (modType === 'control_up') hasUp = true;
        if (modType === 'control_down' || modType === 'blind') hasDown = true;
      }
    }
    return (hasUp ? 1 : 0) - (hasDown ? 1 : 0);
  }

  // ─── HTML Escape ──────────────────────────────────────────────────────────────

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── UI Builders ──────────────────────────────────────────────────────────────

  var _formOpen      = false;
  var _expandedUid   = null;

  function _buildPill(effect) {
    var def         = _defById(effect.effectId);
    var label       = def ? def.label : effect.effectId;
    var desc        = def ? def.description : '';
    var isImmediate = effect.duration === 'immediate';
    var accentCls   = isImmediate ? ' immediate' : '';
    var targetLabel = _targetLabel(effect.target, effect.effectId);
    var durObj      = _durationById(effect.duration);
    var durLabel    = durObj ? durObj.label : effect.duration;
    var hazardSuffix = (effect.hazardValue && effect.hazardValue > 0) ? ' ' + effect.hazardValue : '';
    var isOpen      = _expandedUid === effect.uid;
    var openCls     = isOpen ? ' is-open' : '';

    return (
      '<div class="char-effect-pill' + openCls + '" data-uid="' + _esc(effect.uid) + '">' +
        '<div class="char-effect-pill-header" data-action="toggle-pill">' +
          '<div class="char-effect-pill-accent' + accentCls + '"></div>' +
          '<div class="char-effect-pill-body">' +
            '<span class="char-effect-pill-name' + accentCls + '">' + _esc(label + hazardSuffix) + '</span>' +
            '<span class="char-effect-pill-target">' + _esc(targetLabel) + '</span>' +
            '<span class="char-effect-pill-duration' + accentCls + '">' + _esc(durLabel) + '</span>' +
          '</div>' +
          '<button class="char-effect-pill-remove" data-action="remove-effect" aria-label="Remove effect" title="Remove">&times;</button>' +
        '</div>' +
        '<div class="char-effect-pill-desc">' + _esc(desc) + '</div>' +
      '</div>'
    );
  }

  function _buildEffectList() {
    var effects = _activeEffects;
    if (effects.length === 0) {
      return '<div class="char-effects-empty">No active conditions</div>';
    }
    var html = '';
    for (var i = 0; i < effects.length; i++) {
      html += _buildPill(effects[i]);
    }
    return html;
  }

  function _buildEffectManager() {
    return (
      '<div class="char-effects-section">' +
        '<div class="char-effects-header">' +
          '<span class="char-effects-title char-status-label">Op-Stat</span>' +
          '<button class="char-effects-add-btn" data-action="open-add-form" aria-label="Add effect" title="Add condition">+</button>' +
        '</div>' +
        '<div class="char-turn-row">' +
          '<button class="char-turn-btn" data-action="start-turn">Start Turn</button>' +
          '<button class="char-turn-btn" data-action="end-turn">End Turn</button>' +
          '<button class="char-turn-btn" data-action="end-scene">End Scene</button>' +
        '</div>' +
        '<div id="char-action-pips-inline">' +
          (window.CharacterPanel && window.CharacterPanel.buildActionPips ? window.CharacterPanel.buildActionPips() : '') +
        '</div>' +
        '<hr class="char-effects-divider">' +
        '<div id="char-effects-list">' +
          (_formOpen ? '' : _buildEffectList()) +
        '</div>' +
      '</div>'
    );
  }

  function _render() {
    var wrap = document.getElementById('char-effects-wrap');
    if (!wrap) return;
    wrap.innerHTML = _buildEffectManager();
    if (window.CharacterPanel && window.CharacterPanel.refreshActionPips) {
      window.CharacterPanel.refreshActionPips();
    }
  }

  function _refreshList() {
    var list = document.getElementById('char-effects-list');
    if (!list) return;
    list.innerHTML = _formOpen ? '' : _buildEffectList();
  }

  // ─── Event Delegation ─────────────────────────────────────────────────────────

  document.addEventListener('click', function (e) {
    var wrap = document.getElementById('char-effects-wrap');
    if (!wrap || !wrap.contains(e.target)) return;

    var removeBtn = e.target.closest('[data-action="remove-effect"]');
    if (removeBtn) {
      e.stopPropagation();
      var pill = removeBtn.closest('.char-effect-pill');
      if (pill) {
        var uid = pill.getAttribute('data-uid');
        if (uid) {
          if (_expandedUid === uid) _expandedUid = null;
          _removeEffect(uid);
          _render();
          if (window.CharacterPanel && window.CharacterPanel.refresh) {
            window.CharacterPanel.refresh();
          }
        }
      }
      return;
    }

    var toggleHeader = e.target.closest('[data-action="toggle-pill"]');
    if (toggleHeader) {
      var pill = toggleHeader.closest('.char-effect-pill');
      if (pill) {
        var uid = pill.getAttribute('data-uid');
        _expandedUid = (_expandedUid === uid) ? null : uid;
        _refreshList();
      }
      return;
    }

    var addBtn = e.target.closest('[data-action="open-add-form"]');
    if (addBtn) {
      _formOpen = true;
      _render();
      _renderAddForm();
      return;
    }

    var startTurn = e.target.closest('[data-action="start-turn"]');
    if (startTurn) { _processTurnPhase('start'); return; }

    var endTurn = e.target.closest('[data-action="end-turn"]');
    if (endTurn) {
      _processTurnPhase('end');
      if (window.CharacterPanel && window.CharacterPanel.resetActions) {
        window.CharacterPanel.resetActions();
      }
      return;
    }

    var endScene = e.target.closest('[data-action="end-scene"]');
    if (endScene) { _processTurnPhase('scene'); return; }
  });

  // ─── Turn Phase (stub — full engine in Phase E) ───────────────────────────────

  var _notificationQueue = [];

  function _processTurnPhase(phase) {
    _notificationQueue = [];
    var toRemove = [];
    var snapshot = _activeEffects.slice();

    for (var i = 0; i < snapshot.length; i++) {
      var e   = snapshot[i];
      var def = _defById(e.effectId);

      if (phase === 'start' && def && def.modifier.type === 'hazard' && e.hazardValue > 0) {
        var dmg = e.hazardValue;
        if (window.CharacterPanel && window.CharacterPanel.applyVitalityDelta) {
          window.CharacterPanel.applyVitalityDelta(-dmg);
        }
        var hazLabel = def.label + (def.requiresValue ? ' ' + dmg : '');
        var msg = hazLabel + ' (' + _targetLabel(e.target) + ') \u2014 \u2212' + dmg + ' Vitality';
        _logEntry('triggered', e.effectId, e.target, msg);
        _notificationQueue.push({ icon: '\u25CF', text: msg });
      }

      if (phase === 'start' && e.duration === 'tactical') {
        var durLabel = 'Tactical';
        var exMsg = (def ? def.label : e.effectId) + ' (' + _targetLabel(e.target) + ') expired \u2014 ' + durLabel;
        _logEntry('expired', e.effectId, e.target, exMsg);
        _notificationQueue.push({ icon: '\u23F1', text: exMsg });
        toRemove.push(e.uid);
      }

      if (phase === 'end' && e.duration === 'lingering') {
        var durLabel = 'Lingering';
        var exMsg = (def ? def.label : e.effectId) + ' (' + _targetLabel(e.target) + ') expired \u2014 ' + durLabel;
        _logEntry('expired', e.effectId, e.target, exMsg);
        _notificationQueue.push({ icon: '\u23F1', text: exMsg });
        toRemove.push(e.uid);
      }

      if (phase === 'scene' && e.duration === 'end_of_scene') {
        var durLabel = 'End of Scene';
        var exMsg = (def ? def.label : e.effectId) + ' (' + _targetLabel(e.target) + ') expired \u2014 ' + durLabel;
        _logEntry('expired', e.effectId, e.target, exMsg);
        _notificationQueue.push({ icon: '\u23F1', text: exMsg });
        toRemove.push(e.uid);
      }
    }

    for (var j = 0; j < toRemove.length; j++) {
      for (var k = 0; k < _activeEffects.length; k++) {
        if (_activeEffects[k].uid === toRemove[j]) {
          _activeEffects.splice(k, 1);
          break;
        }
      }
    }

    if (toRemove.length > 0) {
      _saveEffects();
      _dispatchEffectsChanged();
    }

    _render();
    if (window.CharacterPanel && window.CharacterPanel.refresh) {
      window.CharacterPanel.refresh();
    }

    if (_notificationQueue.length > 0) {
      _showNotification(phase);
    }
  }

  // ─── Notification Overlay (stub — full styling in Phase E) ───────────────────

  function _showNotification(phase) {
    var overlay = document.getElementById('char-effects-notify');
    if (!overlay) return;
    var phaseLabel = phase === 'start' ? 'Start Turn' : phase === 'end' ? 'End Turn' : 'End Scene';
    var rows = '';
    for (var i = 0; i < _notificationQueue.length; i++) {
      rows += '<div class="char-notify-row">' +
        '<span class="char-notify-icon">' + _notificationQueue[i].icon + '</span>' +
        '<span class="char-notify-text">' + _esc(_notificationQueue[i].text) + '</span>' +
        '</div>';
    }
    overlay.innerHTML =
      '<div class="char-notify-header">' +
        '<span class="char-notify-title">' + _esc(phaseLabel) + '</span>' +
        '<button class="char-notify-dismiss" data-action="dismiss-notify" aria-label="Dismiss">&times;</button>' +
      '</div>' +
      '<div class="char-notify-body">' + rows + '</div>';
    overlay.classList.add('is-visible');

    clearTimeout(_notifyTimer);
    _notifyTimer = setTimeout(function () {
      overlay.classList.remove('is-visible');
    }, 4000);
  }

  var _notifyTimer = null;

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="dismiss-notify"]')) {
      var overlay = document.getElementById('char-effects-notify');
      if (overlay) overlay.classList.remove('is-visible');
      clearTimeout(_notifyTimer);
    }
  });

  // ─── Add Form (Phase C — placeholder render) ─────────────────────────────────

  function _renderAddForm() {
    var list = document.getElementById('char-effects-list');
    if (!list) return;
    list.innerHTML = '<div id="char-add-form-wrap"></div>';
    _buildAddForm(document.getElementById('char-add-form-wrap'));
  }

  function _buildAddForm(container) {
    if (!container) return;
    container.innerHTML = '<div class="char-add-form" id="char-add-form"></div>';
    _renderFormStep1();
  }

  function _renderFormStep1() {
    var form = document.getElementById('char-add-form');
    if (!form) return;

    var effectOpts = '';
    for (var i = 0; i < EFFECT_DEFS.length; i++) {
      effectOpts += '<option value="' + _esc(EFFECT_DEFS[i].id) + '">' + _esc(EFFECT_DEFS[i].label) + '</option>';
    }

    var durOpts = '';
    for (var d = 0; d < DURATIONS.length; d++) {
      durOpts += '<option value="' + _esc(DURATIONS[d].id) + '"' +
        (DURATIONS[d].id === 'ongoing' ? ' selected' : '') + '>' +
        _esc(DURATIONS[d].label) + '</option>';
    }

    form.innerHTML =
      '<div class="char-add-form-row">' +
        '<select class="char-add-select" id="char-add-effect-sel" data-action="effect-changed">' +
          effectOpts +
        '</select>' +
        '<select class="char-add-select" id="char-add-dur-sel">' +
          durOpts +
        '</select>' +
      '</div>' +
      '<div id="char-add-target-wrap" class="char-add-target-wrap"></div>' +
      '<div id="char-add-hazard-wrap" class="char-add-hazard-wrap" style="display:none;">' +
        '<input type="number" id="char-add-hazard-val" class="char-add-number" min="1" max="20" value="1" placeholder="X">' +
      '</div>' +
      '<div id="char-add-warning" class="char-add-warning" style="display:none;"></div>' +
      '<div class="char-add-form-actions">' +
        '<button class="char-add-btn-apply" data-action="apply-effect">Apply</button>' +
        '<button class="char-add-btn-cancel" data-action="cancel-add-form">Cancel</button>' +
      '</div>';

    _onEffectSelChanged();
  }

  function _getSelectedEffect() {
    var sel = document.getElementById('char-add-effect-sel');
    return sel ? sel.value : null;
  }

  function _onEffectSelChanged() {
    var effectId = _getSelectedEffect();
    var def = _defById(effectId);
    if (!def) return;

    var sel = document.getElementById('char-add-effect-sel');
    if (sel) {
      var defaultDur = def.defaultDuration || 'ongoing';
      var durSel = document.getElementById('char-add-dur-sel');
      if (durSel) {
        for (var i = 0; i < durSel.options.length; i++) {
          if (durSel.options[i].value === defaultDur) {
            durSel.selectedIndex = i;
            break;
          }
        }
      }
    }

    var hazardWrap = document.getElementById('char-add-hazard-wrap');
    if (hazardWrap) hazardWrap.style.display = def.requiresValue ? 'block' : 'none';

    _renderTargetPicker(def);
    _validateForm();
  }

  // ─── Target Picker ────────────────────────────────────────────────────────────

  var _targetPickerState = {
    mode:    null,
    arena:   null,
    discId:  null,
    allArena: false,
    narrativeTag: '',
  };

  function _renderTargetPicker(def) {
    var wrap = document.getElementById('char-add-target-wrap');
    if (!wrap) return;
    _targetPickerState = { mode: null, arena: null, discId: null, allArena: false, narrativeTag: '' };

    if (def.targetMode === 'universal') {
      wrap.innerHTML = '<div class="char-add-target-static">Universal</div>';
      return;
    }

    if (def.targetMode === 'narrative_tag') {
      wrap.innerHTML = '<input type="text" id="char-add-narrative-input" class="char-add-text" placeholder="Tag (e.g. Burn, Bleed)" maxlength="32">';
      document.getElementById('char-add-narrative-input').addEventListener('input', _validateForm);
      return;
    }

    if (def.targetMode === 'fixed_arenas') {
      var labels = (def.fixedArenas || []).map(function (a) {
        return a.charAt(0).toUpperCase() + a.slice(1);
      });
      wrap.innerHTML = '<div class="char-add-target-static">' + _esc(labels.join(', ')) + '</div>';
      return;
    }

    if (def.targetMode === 'arena_only') {
      _renderArenaOnlyPicker(wrap);
      return;
    }

    if (def.targetMode === 'control') {
      _renderControlPickerStep1(wrap);
      return;
    }
  }

  function _renderArenaOnlyPicker(wrap) {
    var char = window.CharacterPanel && window.CharacterPanel.currentChar;
    if (!char || !char.arenas) { wrap.innerHTML = ''; return; }
    var html = '<div class="char-add-chip-row">';
    for (var i = 0; i < char.arenas.length; i++) {
      var a = char.arenas[i];
      var sel = _targetPickerState.arena === a.id ? ' selected' : '';
      html += '<button class="char-add-chip' + sel + '" data-action="pick-arena" data-arena="' + _esc(a.id) + '">' + _esc(a.label) + '</button>';
    }
    html += '</div>';
    wrap.innerHTML = html;
  }

  function _renderControlPickerStep1(wrap) {
    var mode = _targetPickerState.mode;
    var html =
      '<div class="char-add-chip-row">' +
        '<button class="char-add-chip' + (mode === 'universal' ? ' selected' : '') + '" data-action="pick-control-universal">Universal</button>' +
        '<button class="char-add-chip' + (mode === 'arena' ? ' selected' : '') + '" data-action="pick-control-arena">Arena &#9658;</button>' +
      '</div>';

    if (mode === 'arena') {
      var char = window.CharacterPanel && window.CharacterPanel.currentChar;
      if (char && char.arenas) {
        html += '<div class="char-add-chip-row char-add-chip-row-indent">';
        for (var i = 0; i < char.arenas.length; i++) {
          var a = char.arenas[i];
          var sel = _targetPickerState.arena === a.id ? ' selected' : '';
          html += '<button class="char-add-chip' + sel + '" data-action="pick-control-arena-item" data-arena="' + _esc(a.id) + '">' + _esc(a.label) + '</button>';
        }
        html += '</div>';

        if (_targetPickerState.arena) {
          var selArena = null;
          for (var j = 0; j < char.arenas.length; j++) {
            if (char.arenas[j].id === _targetPickerState.arena) { selArena = char.arenas[j]; break; }
          }
          if (selArena) {
            var allSel = _targetPickerState.allArena ? ' selected' : '';
            html += '<div class="char-add-chip-row char-add-chip-row-indent">';
            html += '<button class="char-add-chip char-add-chip-all' + allSel + '" data-action="pick-control-all-arena">&#10003; All ' + _esc(selArena.label) + '</button>';
            if (!_targetPickerState.allArena) {
              for (var d = 0; d < selArena.disciplines.length; d++) {
                var disc = selArena.disciplines[d];
                var dSel = _targetPickerState.discId === disc.id ? ' selected' : '';
                html += '<button class="char-add-chip' + dSel + '" data-action="pick-control-disc" data-disc="' + _esc(disc.id) + '">' + _esc(disc.label) + '</button>';
              }
            }
            html += '</div>';
          }
        }
      }
    }

    wrap.innerHTML = html;
  }

  function _resolvedTarget() {
    var effectId = _getSelectedEffect();
    var def = _defById(effectId);
    if (!def) return null;
    if (def.targetMode === 'universal') return 'universal';
    if (def.targetMode === 'fixed_arenas') return 'fixed';
    if (def.targetMode === 'narrative_tag') {
      var inp = document.getElementById('char-add-narrative-input');
      var tag = inp ? inp.value.trim() : '';
      return tag.length > 0 ? tag : null;
    }
    if (def.targetMode === 'arena_only') {
      return _targetPickerState.arena ? 'arena:' + _targetPickerState.arena : null;
    }
    if (def.targetMode === 'control') {
      if (_targetPickerState.mode === 'universal') return 'universal';
      if (_targetPickerState.mode === 'arena') {
        if (_targetPickerState.allArena && _targetPickerState.arena) return 'arena:' + _targetPickerState.arena;
        if (_targetPickerState.discId) return 'disc:' + _targetPickerState.discId;
      }
      return null;
    }
    return null;
  }

  function _validateForm() {
    var applyBtn = document.querySelector('[data-action="apply-effect"]');
    var warnEl   = document.getElementById('char-add-warning');
    if (!applyBtn) return;
    var target   = _resolvedTarget();
    var effectId = _getSelectedEffect();
    var durSel   = document.getElementById('char-add-dur-sel');
    var duration = durSel ? durSel.value : null;
    if (!target || !effectId || !duration) {
      applyBtn.disabled = true;
      if (warnEl) warnEl.style.display = 'none';
      return;
    }
    if (_isDuplicate(effectId, target, duration)) {
      applyBtn.disabled = true;
      if (warnEl) {
        var def = _defById(effectId);
        warnEl.textContent = (def ? def.label : effectId) + ' already active for this target & duration';
        warnEl.style.display = 'block';
      }
      return;
    }
    applyBtn.disabled = false;
    if (warnEl) warnEl.style.display = 'none';
  }

  document.addEventListener('change', function (e) {
    var wrap = document.getElementById('char-effects-wrap');
    if (!wrap || !wrap.contains(e.target)) return;
    if (e.target.id === 'char-add-effect-sel') _onEffectSelChanged();
    if (e.target.id === 'char-add-dur-sel')    _validateForm();
  });

  document.addEventListener('click', function (e) {
    var wrap = document.getElementById('char-effects-wrap');
    if (!wrap || !wrap.contains(e.target)) return;

    if (e.target.closest('[data-action="cancel-add-form"]')) {
      _formOpen = false;
      _render();
      return;
    }

    if (e.target.closest('[data-action="apply-effect"]')) {
      var effectId  = _getSelectedEffect();
      var durSel    = document.getElementById('char-add-dur-sel');
      var duration  = durSel ? durSel.value : null;
      var target    = _resolvedTarget();
      var selDef    = _defById(effectId);
      var hazardInp = document.getElementById('char-add-hazard-val');
      var hazardVal = (selDef && selDef.requiresValue && hazardInp)
        ? (parseInt(hazardInp.value, 10) || 1)
        : (selDef && selDef.modifier && selDef.modifier.type === 'hazard' ? 1 : 0);
      if (effectId && duration && target) {
        _applyEffect(effectId, target, duration, hazardVal);
        _formOpen = false;
        _render();
        if (window.CharacterPanel && window.CharacterPanel.refresh) {
          window.CharacterPanel.refresh();
        }
      }
      return;
    }

    if (e.target.closest('[data-action="pick-arena"]')) {
      _targetPickerState.arena = e.target.closest('[data-action="pick-arena"]').getAttribute('data-arena');
      var def = _defById(_getSelectedEffect());
      if (def) {
        var wrap2 = document.getElementById('char-add-target-wrap');
        _renderArenaOnlyPicker(wrap2);
      }
      _validateForm();
      return;
    }

    if (e.target.closest('[data-action="pick-control-universal"]')) {
      _targetPickerState.mode = 'universal';
      _targetPickerState.arena = null;
      _targetPickerState.discId = null;
      _targetPickerState.allArena = false;
      var def2 = _defById(_getSelectedEffect());
      if (def2) _renderControlPickerStep1(document.getElementById('char-add-target-wrap'));
      _validateForm();
      return;
    }

    if (e.target.closest('[data-action="pick-control-arena"]')) {
      _targetPickerState.mode = 'arena';
      _targetPickerState.arena = null;
      _targetPickerState.discId = null;
      _targetPickerState.allArena = false;
      var def3 = _defById(_getSelectedEffect());
      if (def3) _renderControlPickerStep1(document.getElementById('char-add-target-wrap'));
      _validateForm();
      return;
    }

    if (e.target.closest('[data-action="pick-control-arena-item"]')) {
      var btn = e.target.closest('[data-action="pick-control-arena-item"]');
      _targetPickerState.arena = btn.getAttribute('data-arena');
      _targetPickerState.discId = null;
      _targetPickerState.allArena = false;
      var def4 = _defById(_getSelectedEffect());
      if (def4) _renderControlPickerStep1(document.getElementById('char-add-target-wrap'));
      _validateForm();
      return;
    }

    if (e.target.closest('[data-action="pick-control-all-arena"]')) {
      _targetPickerState.allArena = true;
      _targetPickerState.discId = null;
      var def5 = _defById(_getSelectedEffect());
      if (def5) _renderControlPickerStep1(document.getElementById('char-add-target-wrap'));
      _validateForm();
      return;
    }

    if (e.target.closest('[data-action="pick-control-disc"]')) {
      var btn2 = e.target.closest('[data-action="pick-control-disc"]');
      _targetPickerState.discId = btn2.getAttribute('data-disc');
      _targetPickerState.allArena = false;
      var def6 = _defById(_getSelectedEffect());
      if (def6) _renderControlPickerStep1(document.getElementById('char-add-target-wrap'));
      _validateForm();
      return;
    }
  });

  // ─── Public API ───────────────────────────────────────────────────────────────

  function _getBufferTotal() {
    var total = 0;
    for (var i = 0; i < _activeEffects.length; i++) {
      var e = _activeEffects[i];
      var def = _defById(e.effectId);
      if (def && def.modifier.type === 'buffer') {
        total += (e.hazardValue || 0);
      }
    }
    return total;
  }

  function _depleteBuffer(amount) {
    var remaining = amount;
    for (var i = _activeEffects.length - 1; i >= 0 && remaining > 0; i--) {
      var e = _activeEffects[i];
      var def = _defById(e.effectId);
      if (!def || def.modifier.type !== 'buffer') continue;
      var bufVal = e.hazardValue || 0;
      if (bufVal <= remaining) {
        remaining -= bufVal;
        var label = def.label + ' (' + bufVal + ') depleted';
        _activeEffects.splice(i, 1);
        _logEntry('removed', e.effectId, e.target, label);
      } else {
        e.hazardValue -= remaining;
        _logEntry('applied', e.effectId, e.target, def.label + ' reduced to ' + e.hazardValue);
        remaining = 0;
      }
    }
    _saveEffects();
    _dispatchEffectsChanged();
    _render();
    return amount - remaining;
  }

  window.EffectManager = {
    get activeEffects() { return _activeEffects.slice(); },
    getCombatLog:         function () { return _combatLog.slice(); },
    clearCombatLog:       function () { _combatLog = []; _saveLog(); },
    getArenaEffectOffset: _getArenaEffectOffset,
    getDiscEffectOffset:  _getDiscEffectOffset,
    getBufferTotal:       _getBufferTotal,
    depleteBuffer:        _depleteBuffer,
    applyEffect:          _applyEffect,
    removeEffect:         _removeEffect,
    EFFECT_DEFS:          EFFECT_DEFS,
    DURATIONS:            DURATIONS,
  };

  // ─── Bootstrap ────────────────────────────────────────────────────────────────

  function init() {
    _loadEffects();
    _loadLog();
    _render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
