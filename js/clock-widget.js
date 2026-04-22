/**
 * Galactic Clock Widget — Task #198
 *
 * Loaded on both GM and player pages (after galactic-calendar.js and the
 * shared socket script).  Responsibilities:
 *
 *   1. Fetch /api/campaign/clock on boot, expose the result on
 *      window.GalacticClock.current.
 *   2. Listen for `clock:updated` socket events and refresh.
 *   3. If a `#cb-clock-widget` element is present (GM header), render the
 *      clock there and wire up a click-to-advance modal (GM-only).
 *   4. If `#cb-player-clock-strip` is present, render the player date strip.
 *   5. Notify subscribers via GalacticClock.onChange(cb) so the character
 *      panel, conversation overlay, and journal viewer can re-render their
 *      own date markers.
 */
(function () {
  'use strict';

  if (typeof window.GalacticCalendar === 'undefined') {
    console.warn('[clock-widget] GalacticCalendar not loaded; widget disabled.');
    return;
  }
  var Cal = window.GalacticCalendar;

  var _state = null;        // last clock payload from API
  var _holidays = null;     // cached holiday catalog
  var _subs = [];

  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function get() { return _state; }

  function onChange(cb) {
    if (typeof cb !== 'function') return function () {};
    _subs.push(cb);
    if (_state) { try { cb(_state); } catch (e) {} }
    return function () { _subs = _subs.filter(function (f) { return f !== cb; }); };
  }

  function _publish() {
    _subs.forEach(function (cb) { try { cb(_state); } catch (e) {} });
  }

  // Voice-aware formatter for conversation NPCs and adventure prose.
  function formatForVoice(voice, opts) {
    if (!_state) return '';
    var v = (voice || 'citizen').toLowerCase();
    return Cal.format(_state.dayIndex, v, opts || {});
  }

  // Compact "stamp" formatter (used in journal entries).
  // Falls back to wallclock if entry pre-dates the calendar feature.
  function formatJournalStamp(entry) {
    if (entry && entry.in_universe_day_index != null) {
      var voiceStr = Cal.formatImperial(entry.in_universe_day_index, { weekday: false });
      var hr = (entry.in_universe_hour != null) ? Cal.formatHour(entry.in_universe_hour) : '';
      return hr ? voiceStr + ' \u00B7 ' + hr : voiceStr;
    }
    return null;
  }

  function _refresh() {
    return fetch('/api/campaign/clock', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && !data.error) {
          _state = data;
          _renderGmWidget();
          _renderPlayerStrip();
          _publish();
        }
        return data;
      })
      .catch(function (err) { console.warn('[clock-widget] fetch failed:', err); });
  }

  // ─── GM widget ─────────────────────────────────────────────────────────
  // Holiday-type → banner color mapping (per task spec)
  var HOLIDAY_TYPE_COLORS = {
    'anchor':              { bg: 'rgba(120,200,140,0.18)', border: 'rgba(160,220,170,0.6)', fg: '#cfe9d6' },
    'imperial-mandatory':  { bg: 'rgba(200,60,60,0.22)',   border: 'rgba(220,90,90,0.7)',   fg: '#f8c8c8' },
    'imperial-shadow':     { bg: 'rgba(180,80,80,0.16)',   border: 'rgba(200,100,100,0.5)', fg: '#f0c0c0' },
    'imperial-oppression': { bg: 'rgba(200,90,40,0.2)',    border: 'rgba(220,120,60,0.6)',  fg: '#f8d4b0' },
    'imperial-atrocity':   { bg: 'rgba(160,30,30,0.28)',   border: 'rgba(200,60,60,0.7)',   fg: '#ffb8b8' },
    'suppressed':          { bg: 'rgba(220,180,80,0.2)',   border: 'rgba(240,200,100,0.6)', fg: '#f6e0a0' },
    'suppressed-trauma':   { bg: 'rgba(180,140,60,0.24)',  border: 'rgba(220,180,80,0.7)',  fg: '#f8e6b0' },
    'rebel-emergence':     { bg: 'rgba(80,180,200,0.2)',   border: 'rgba(100,200,220,0.6)', fg: '#b8e8f4' },
    'hutt-cover':          { bg: 'rgba(140,80,200,0.22)',  border: 'rgba(170,110,220,0.7)', fg: '#dcc4f4' },
    'hutt-economy':        { bg: 'rgba(120,80,180,0.18)',  border: 'rgba(150,110,200,0.55)', fg: '#d4c0ec' },
    'festival':            { bg: 'rgba(200,164,78,0.22)',  border: 'rgba(220,184,98,0.7)',  fg: '#f8e0b0' }
  };

  function _renderGmWidget() {
    var primary = document.getElementById('cb-clock-primary');
    var secondary = document.getElementById('cb-clock-secondary');
    var banner = document.getElementById('cb-clock-banner');
    if (!primary || !_state) return;
    primary.textContent = _state.weekday + ' \u00B7 ' + _state.imperial.replace(/\s*\([^)]*\)\s*$/, '') +
      ' \u00B7 ' + _state.time;
    var bits = [_state.crcTapani.replace(/\s*\([^)]*\)\s*$/, ''), _state.bbyFootnote];
    if (secondary) secondary.textContent = bits.join('  \u2022  ');

    // Holiday banner — color-coded by type (or upcoming hint within 14 days).
    if (banner) {
      if (_state.holiday) {
        var c = HOLIDAY_TYPE_COLORS[_state.holiday.type] || HOLIDAY_TYPE_COLORS.festival;
        banner.style.cssText = 'display:block;margin-top:4px;padding:4px 8px;border-radius:3px;font-size:10.5px;letter-spacing:0.5px;background:' + c.bg + ';border:1px solid ' + c.border + ';color:' + c.fg + ';';
        banner.textContent = '\u2605 Today is ' + _state.holiday.name + (_state.holiday.significance ? ' \u2014 ' + _state.holiday.significance.split('.')[0] : '');
        banner.title = _state.holiday.gmHook || _state.holiday.significance || '';
      } else if (_state.upcomingHoliday && _state.upcomingHolidayDays != null && _state.upcomingHolidayDays <= 14) {
        var c2 = HOLIDAY_TYPE_COLORS[_state.upcomingHoliday.type] || HOLIDAY_TYPE_COLORS.festival;
        banner.style.cssText = 'display:block;margin-top:4px;padding:3px 8px;border-radius:3px;font-size:10px;opacity:0.85;background:' + c2.bg + ';border:1px solid ' + c2.border + ';color:' + c2.fg + ';';
        banner.textContent = _state.upcomingHoliday.name + ' in ' + _state.upcomingHolidayDays + 'd';
        banner.title = _state.upcomingHoliday.significance || '';
      } else {
        banner.style.cssText = 'display:none;';
        banner.textContent = '';
      }
    }
  }

  function _wireGmWidget() {
    var widget = document.getElementById('cb-clock-widget');
    if (!widget || widget.__wired) return;
    widget.__wired = true;
    widget.addEventListener('click', _openAdvanceModal);
  }

  function _ensureModalStyles() {
    if (document.getElementById('cb-clock-modal-styles')) return;
    var s = document.createElement('style');
    s.id = 'cb-clock-modal-styles';
    s.textContent =
      '.cb-clock-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;}'+
      '.cb-clock-modal{background:#15110a;border:1px solid rgba(200,164,78,0.45);border-radius:6px;padding:18px 20px;width:480px;max-width:92vw;color:#e8d8a8;font-family:inherit;}'+
      '.cb-clock-modal h3{margin:0 0 12px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#c8a44e;border-bottom:1px solid rgba(200,164,78,0.3);padding-bottom:6px;}'+
      '.cb-clock-modal .cb-clock-now{font-size:11px;opacity:0.85;margin-bottom:14px;line-height:1.5;}'+
      '.cb-clock-modal .cb-clock-now b{color:#fff;}'+
      '.cb-clock-modal .cb-clock-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:12px;}'+
      '.cb-clock-modal .cb-clock-row label{flex:0 0 90px;color:#c8a44e;text-transform:uppercase;font-size:10px;letter-spacing:1px;}'+
      '.cb-clock-modal input[type=number],.cb-clock-modal input[type=text]{flex:1;background:#0a0805;border:1px solid rgba(200,164,78,0.35);color:#e8d8a8;padding:5px 8px;border-radius:3px;font:inherit;}'+
      '.cb-clock-modal .cb-clock-presets{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 14px;}'+
      '.cb-clock-modal .cb-clock-preset{background:rgba(200,164,78,0.12);border:1px solid rgba(200,164,78,0.4);color:#e8d8a8;padding:4px 9px;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;border-radius:3px;cursor:pointer;}'+
      '.cb-clock-modal .cb-clock-preset:hover{background:rgba(200,164,78,0.28);}'+
      '.cb-clock-modal .cb-clock-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;}'+
      '.cb-clock-modal button.cb-clock-btn{background:rgba(200,164,78,0.2);border:1px solid rgba(200,164,78,0.5);color:#e8d8a8;padding:6px 14px;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-radius:3px;cursor:pointer;}'+
      '.cb-clock-modal button.cb-clock-btn.primary{background:rgba(200,164,78,0.4);}'+
      '.cb-clock-modal button.cb-clock-btn:hover{background:rgba(200,164,78,0.5);}'+
      '.cb-clock-modal .cb-clock-error{color:#ff7a7a;font-size:11px;margin-top:6px;min-height:14px;}';
    document.head.appendChild(s);
  }

  var PRESETS = [
    { label: '+1 hour',           h: 1, d: 0, lbl: 'A short delay' },
    { label: '+6h short rest',    h: 6, d: 0, lbl: 'Short rest' },
    { label: '+8h long rest',     h: 8, d: 0, lbl: 'Long rest' },
    { label: 'Sleep \u2192 dawn', h: 0, d: 1, lbl: 'Crew rests until daybreak', resetHour: 7 },
    { label: '+1 day',            h: 0, d: 1, lbl: 'A day passes' }
  ];

  var _changeLog = [];
  function _logChange(prev, next, label) {
    if (!prev || !next) return;
    var entry = {
      ts: Date.now(),
      from: prev.weekday + ' ' + prev.imperial.replace(/\s*\([^)]*\)\s*$/, '') + ' ' + prev.time,
      to:   next.weekday + ' ' + next.imperial.replace(/\s*\([^)]*\)\s*$/, '') + ' ' + next.time,
      label: label || ''
    };
    _changeLog.unshift(entry);
    if (_changeLog.length > 8) _changeLog.length = 8;
  }
  function _renderChangeLog(target) {
    if (!target) return;
    if (!_changeLog.length) { target.innerHTML = '<div style="opacity:0.5;font-size:10px;">No changes this session.</div>'; return; }
    target.innerHTML = _changeLog.map(function (e) {
      return '<div style="font-size:10px;line-height:1.4;border-bottom:1px solid rgba(200,164,78,0.12);padding:3px 0;">' +
        '<b>' + _esc(e.label || 'set') + ':</b> ' + _esc(e.from) + ' \u2192 ' + _esc(e.to) +
        '</div>';
    }).join('');
  }

  function _openAdvanceModal() {
    if (!_state) return;
    _ensureModalStyles();
    var prev = document.getElementById('cb-clock-modal-overlay');
    if (prev) prev.remove();

    var ov = document.createElement('div');
    ov.id = 'cb-clock-modal-overlay';
    ov.className = 'cb-clock-modal-overlay';
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });

    var modal = document.createElement('div');
    modal.className = 'cb-clock-modal';
    var doy = _state.dayOfYear || 1;
    modal.innerHTML =
      '<h3>Campaign Clock</h3>' +
      '<div class="cb-clock-now">' +
        'Currently: <b>' + _esc(_state.weekday) + ', ' + _esc(_state.imperial.replace(/\s*\([^)]*\)\s*$/, '')) + '</b><br>' +
        _esc(_state.crcTapani) + ' &middot; ' + _esc(_state.time) + ' &middot; ' + _esc(_state.bbyFootnote) +
        (_state.holiday ? '<br><span style="color:#c8a44e;">\u2605 ' + _esc(_state.holiday.name) + '</span>' : '') +
      '</div>' +
      '<div style="font-size:10px;color:#c8a44e;text-transform:uppercase;letter-spacing:1px;margin:4px 0 4px;">Quick Advance</div>' +
      '<div class="cb-clock-presets" id="cb-clock-presets"></div>' +
      '<div class="cb-clock-row"><label>Hours</label>' +
        '<input type="number" id="cb-clock-h" value="0" step="1"></div>' +
      '<div class="cb-clock-row"><label>Days</label>' +
        '<input type="number" id="cb-clock-d" value="0" step="1"></div>' +
      '<div class="cb-clock-row"><label>Note</label>' +
        '<input type="text" id="cb-clock-note" placeholder="e.g. Hyperspace transit to Bespin"></div>' +
      '<div class="cb-clock-actions" style="justify-content:flex-start;margin-top:6px;">' +
        '<button class="cb-clock-btn primary" id="cb-clock-apply">Advance</button>' +
      '</div>' +
      '<div style="font-size:10px;color:#c8a44e;text-transform:uppercase;letter-spacing:1px;margin:14px 0 4px;border-top:1px solid rgba(200,164,78,0.2);padding-top:10px;">Manual Set</div>' +
      '<div class="cb-clock-row"><label>Day Index</label>' +
        '<input type="number" id="cb-clock-set-di" value="' + _state.dayIndex + '" step="1"></div>' +
      '<div class="cb-clock-row"><label>Hour (0-23)</label>' +
        '<input type="number" id="cb-clock-set-h" value="' + _state.hour + '" min="0" max="23" step="1"></div>' +
      '<div class="cb-clock-actions" style="justify-content:flex-start;">' +
        '<button class="cb-clock-btn" id="cb-clock-set-btn">Set Date</button>' +
      '</div>' +
      '<div class="cb-clock-error" id="cb-clock-err"></div>' +
      '<div style="font-size:10px;color:#c8a44e;text-transform:uppercase;letter-spacing:1px;margin:14px 0 4px;border-top:1px solid rgba(200,164,78,0.2);padding-top:10px;">Recent Changes</div>' +
      '<div id="cb-clock-log" style="max-height:120px;overflow-y:auto;"></div>' +
      '<div class="cb-clock-actions"><button class="cb-clock-btn" id="cb-clock-cancel">Close</button></div>';

    ov.appendChild(modal);
    document.body.appendChild(ov);

    var presetWrap = modal.querySelector('#cb-clock-presets');
    PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'cb-clock-preset';
      b.type = 'button';
      b.textContent = p.label;
      b.addEventListener('click', function () { _applyAdvance(p.h, p.d, p.lbl, p.resetHour); });
      presetWrap.appendChild(b);
    });

    modal.querySelector('#cb-clock-cancel').addEventListener('click', function () { ov.remove(); });
    modal.querySelector('#cb-clock-apply').addEventListener('click', function () {
      var h = parseInt(modal.querySelector('#cb-clock-h').value, 10) || 0;
      var d = parseInt(modal.querySelector('#cb-clock-d').value, 10) || 0;
      var note = modal.querySelector('#cb-clock-note').value.trim();
      if (h === 0 && d === 0) {
        modal.querySelector('#cb-clock-err').textContent = 'Specify at least one hour or day.';
        return;
      }
      _applyAdvance(h, d, note);
    });
    modal.querySelector('#cb-clock-set-btn').addEventListener('click', function () {
      var di = parseInt(modal.querySelector('#cb-clock-set-di').value, 10);
      var hr = parseInt(modal.querySelector('#cb-clock-set-h').value, 10);
      if (isNaN(di) || isNaN(hr) || hr < 0 || hr > 23) {
        modal.querySelector('#cb-clock-err').textContent = 'Invalid day index or hour.';
        return;
      }
      _applySet(di, hr, 'manual set');
    });
    _renderChangeLog(modal.querySelector('#cb-clock-log'));

    function _persistResult(prev, data, label, keepOpen) {
      if (data && !data.error) {
        _logChange(prev, data, label);
        _state = data;
        _renderGmWidget();
        _renderPlayerStrip();
        _publish();
        if (keepOpen) {
          modal.querySelector('#cb-clock-now') && _renderChangeLog(modal.querySelector('#cb-clock-log'));
          _renderChangeLog(modal.querySelector('#cb-clock-log'));
          modal.querySelector('#cb-clock-err').textContent = '';
        } else {
          ov.remove();
        }
      } else {
        modal.querySelector('#cb-clock-err').textContent = (data && data.error) || 'Request failed.';
      }
    }

    function _applyAdvance(hours, days, label, resetHour) {
      var prev = _state;
      var p;
      if (resetHour != null) {
        var nextDayIndex = _state.dayIndex + days;
        p = fetch('/api/campaign/clock/set', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayIndex: nextDayIndex, hour: resetHour })
        });
      } else {
        p = fetch('/api/campaign/clock/advance', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours: hours, days: days, label: label || '' })
        });
      }
      p.then(function (r) { return r.json(); }).then(function (data) {
        _persistResult(prev, data, label || 'advance', false);
      }).catch(function (err) {
        modal.querySelector('#cb-clock-err').textContent = 'Network error: ' + err.message;
      });
    }

    function _applySet(dayIndex, hour, label) {
      var prev = _state;
      fetch('/api/campaign/clock/set', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayIndex: dayIndex, hour: hour })
      }).then(function (r) { return r.json(); }).then(function (data) {
        _persistResult(prev, data, label, true);
      }).catch(function (err) {
        modal.querySelector('#cb-clock-err').textContent = 'Network error: ' + err.message;
      });
    }
  }

  // ─── Player date strip ─────────────────────────────────────────────────
  // Players never see BBY. Default = citizen (C.R.C./Tapani). Tap/hover flips
  // to Imperial format with a brief Imperial-cog flash ("transponder switch").
  var _playerImperialMode = false;
  function _renderPlayerStrip() {
    var mount = document.getElementById('cb-player-clock-strip');
    if (!mount || !_state) return;
    var imperialOn = _playerImperialMode;
    var mainLine, modeLabel;
    if (imperialOn) {
      mainLine = _state.weekday + ' \u00B7 ' + _state.imperial.replace(/\s*\([^)]*\)\s*$/, '');
      modeLabel = 'Imperial reading';
    } else {
      mainLine = _state.weekday + ' \u00B7 ' + _state.crcTapani.replace(/\s*\([^)]*\)\s*$/, '');
      modeLabel = 'Citizen reading';
    }
    var subLine = _state.time + '  \u00B7  ' + modeLabel;
    if (_state.holiday) subLine += '  \u00B7  \u2605 ' + _state.holiday.name;
    mount.classList.toggle('imperial-mode', imperialOn);
    mount.title = 'Tap to switch transponder reading';
    mount.innerHTML =
      '<div class="player-clock-strip-main">' + _esc(mainLine) + '</div>' +
      '<div class="player-clock-strip-sub">' + _esc(subLine) + '</div>';
    if (!mount.__wired) {
      mount.__wired = true;
      mount.style.cursor = 'pointer';
      mount.addEventListener('click', function () {
        _playerImperialMode = !_playerImperialMode;
        mount.classList.add('cb-clock-flash');
        setTimeout(function () { mount.classList.remove('cb-clock-flash'); }, 400);
        _renderPlayerStrip();
      });
    }
  }

  // ─── Socket integration ────────────────────────────────────────────────
  function _attachSocket() {
    var s = window.__sharedSocket;
    if (!s) return false;
    if (s.__clockWired) return true;
    s.__clockWired = true;
    s.on('clock:updated', function (payload) {
      if (payload && !payload.error) {
        // Signature-based dedupe: drop redundant payloads that don't change
        // anything we render (mirrors the overlay dedupe pattern). Avoids
        // flicker / wasted re-renders under rapid duplicate broadcasts.
        var sig = payload.dayIndex + '|' + payload.hour +
                  '|' + (payload.holiday ? payload.holiday.id || payload.holiday.name : '') +
                  '|' + (payload.upcomingHoliday ? (payload.upcomingHoliday.id || payload.upcomingHoliday.name) : '') +
                  '|' + (payload.upcomingHolidayDays != null ? payload.upcomingHolidayDays : '');
        if (s.__clockLastSig === sig) return;
        s.__clockLastSig = sig;
        _state = payload;
        _renderGmWidget();
        _renderPlayerStrip();
        _publish();
      } else {
        _refresh();
      }
    });
    return true;
  }

  function _bootSocket() {
    if (_attachSocket()) return;
    var tries = 0;
    var iv = setInterval(function () {
      // Skip work in background tabs to save battery / CPU; tries counter
      // only advances while visible so we still get the full 40-attempt
      // window when the user comes back.
      if (document.hidden) return;
      tries++;
      if (_attachSocket() || tries > 40) clearInterval(iv);
    }, 250);
  }

  // Refresh once whenever the player flips back to the tab so the date
  // strip reflects any clock changes that occurred while we were idle.
  function _wireVisibilityRefresh() {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) _refresh();
    });
  }

  // ─── Boot ──────────────────────────────────────────────────────────────
  function _boot() {
    _wireGmWidget();
    _refresh();
    _bootSocket();
    _wireVisibilityRefresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

  window.GalacticClock = {
    get: get,
    onChange: onChange,
    refresh: _refresh,
    formatForVoice: formatForVoice,
    formatJournalStamp: formatJournalStamp
  };
}());
