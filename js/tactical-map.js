(function () {
  var PIN_TYPES = {
    npc:       { icon: '\u25C9', color: '#d4a84b', label: 'NPC' },
    enemy:     { icon: '\u2620', color: '#ef4444', label: 'Enemy' },
    hazard:    { icon: '\u26A0', color: '#eab308', label: 'Hazard' },
    note:      { icon: '\u270E', color: '#60a5fa', label: 'Note' },
    objective: { icon: '\u2605', color: '#22c55e', label: 'Objective' },
    custom:    { icon: '\u25C6', color: '#a78bfa', label: 'Custom' }
  };

  var _esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  function _tmShowDialog(opts) {
    var existing = document.getElementById('tm-dialog-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'tm-dialog-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = [
      'background:#1a1a1e',
      'border:1px solid #3a3632',
      'border-radius:6px',
      'padding:1.25rem 1.25rem 0.9rem',
      'min-width:300px',
      'max-width:' + (opts.max_width || '440px'),
      'width:90vw',
      'font-family:\'Exo 2\',sans-serif',
      'box-shadow:0 8px 36px rgba(0,0,0,0.85)'
    ].join(';');

    if (opts.title) {
      var title = document.createElement('div');
      title.style.cssText = 'font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:#c8a44e;margin-bottom:0.65rem;font-weight:700;';
      title.textContent = opts.title;
      box.appendChild(title);
    }

    if (opts.icon) {
      var iconRow = document.createElement('div');
      iconRow.style.cssText = 'display:flex;align-items:center;gap:0.6rem;margin-bottom:0.65rem;';
      var iconSpan = document.createElement('span');
      iconSpan.style.cssText = 'font-size:1.4rem;line-height:1;color:' + (opts.iconColor || '#c0b89a') + ';';
      iconSpan.textContent = opts.icon;
      iconRow.appendChild(iconSpan);
      if (opts.pinLabel) {
        var lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:0.8rem;color:#c0b89a;font-weight:600;';
        lbl.textContent = opts.pinLabel;
        iconRow.appendChild(lbl);
      }
      box.appendChild(iconRow);
    }

    if (opts.message) {
      var msg = document.createElement('div');
      msg.style.cssText = 'font-size:0.72rem;color:#c0b89a;margin-bottom:' + (opts.input !== undefined ? '0.75rem' : '1rem') + ';line-height:1.6;';
      msg.textContent = opts.message;
      box.appendChild(msg);
    }

    if (opts.details) {
      opts.details.forEach(function (row) {
        var dr = document.createElement('div');
        dr.style.cssText = 'display:flex;gap:0.5rem;margin-bottom:0.3rem;font-size:0.68rem;';
        var dk = document.createElement('span');
        dk.style.cssText = 'color:#7a7068;min-width:72px;text-transform:uppercase;letter-spacing:0.06em;';
        dk.textContent = row.key;
        var dv = document.createElement('span');
        dv.style.cssText = 'color:#c0b89a;';
        dv.textContent = row.value;
        dr.appendChild(dk);
        dr.appendChild(dv);
        box.appendChild(dr);
      });
      box.appendChild(Object.assign(document.createElement('div'), { style: 'height:0.75rem' }));
    }

    var inputEl = null;
    if (opts.input !== undefined) {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.value = opts.input || '';
      inputEl.placeholder = opts.placeholder || '';
      inputEl.style.cssText = 'width:100%;box-sizing:border-box;background:#0f0e0d;border:1px solid #3a3632;color:#c0b89a;font-family:\'Exo 2\',sans-serif;font-size:0.72rem;padding:0.45rem 0.55rem;border-radius:3px;margin-bottom:1rem;outline:none;';
      inputEl.addEventListener('focus', function () { inputEl.style.borderColor = '#c8a44e'; });
      inputEl.addEventListener('blur', function () { inputEl.style.borderColor = '#3a3632'; });
      box.appendChild(inputEl);
    }

    if (opts.gm_section) {
      var gmDivider = document.createElement('div');
      gmDivider.style.cssText = 'height:1px;background:rgba(200,164,78,0.25);margin:0.5rem 0 0.65rem;';
      box.appendChild(gmDivider);
      var gmLabel = document.createElement('div');
      gmLabel.style.cssText = 'font-size:0.58rem;color:#c8a44e;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.4rem;opacity:0.85;';
      gmLabel.textContent = '\u25CF GM Eyes Only';
      box.appendChild(gmLabel);
      var gmText = document.createElement('div');
      gmText.style.cssText = 'font-size:0.7rem;color:#a89060;line-height:1.6;margin-bottom:0.85rem;background:rgba(200,164,78,0.06);border-left:2px solid rgba(200,164,78,0.3);padding:0.4rem 0.6rem;border-radius:0 3px 3px 0;';
      gmText.textContent = opts.gm_section;
      box.appendChild(gmText);
    }

    var fieldEls = {};
    if (opts.fields && opts.fields.length) {
      var fieldInputCss = 'width:100%;box-sizing:border-box;background:#0f0e0d;border:1px solid #3a3632;color:#c0b89a;font-family:\'Exo 2\',sans-serif;font-size:0.72rem;padding:0.45rem 0.55rem;border-radius:3px;margin-bottom:0.75rem;outline:none;display:block;';
      opts.fields.forEach(function (field) {
        var lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:0.62rem;color:#7a7068;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.25rem;';
        lbl.textContent = field.label || field.key;
        box.appendChild(lbl);
        var el;
        if (field.type === 'textarea') {
          el = document.createElement('textarea');
          el.rows = field.rows || 3;
          el.style.cssText = fieldInputCss + 'resize:vertical;min-height:56px;line-height:1.5;';
        } else {
          el = document.createElement('input');
          el.type = 'text';
          el.style.cssText = fieldInputCss;
        }
        el.value = field.value || '';
        el.placeholder = field.placeholder || '';
        el.addEventListener('focus', function () { el.style.borderColor = '#c8a44e'; });
        el.addEventListener('blur', function () { el.style.borderColor = '#3a3632'; });
        box.appendChild(el);
        fieldEls[field.key] = el;
      });
    }

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;';

    if (!opts.noCancel) {
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = opts.cancelText || 'Cancel';
      cancelBtn.style.cssText = 'background:transparent;border:1px solid #3a3632;color:#7a7068;font-family:\'Exo 2\',sans-serif;font-size:0.62rem;letter-spacing:0.06em;text-transform:uppercase;padding:0.4rem 0.9rem;cursor:pointer;border-radius:3px;transition:all 0.12s;';
      cancelBtn.addEventListener('mouseover', function () { cancelBtn.style.borderColor = '#7a7068'; cancelBtn.style.color = '#c0b89a'; });
      cancelBtn.addEventListener('mouseout', function () { cancelBtn.style.borderColor = '#3a3632'; cancelBtn.style.color = '#7a7068'; });
      cancelBtn.addEventListener('click', function () {
        overlay.remove();
        if (opts.onCancel) opts.onCancel();
      });
      btnRow.appendChild(cancelBtn);
    }

    var okBtn = document.createElement('button');
    okBtn.textContent = opts.okText || 'OK';
    var isRed = opts.danger;
    okBtn.style.cssText = [
      'background:' + (isRed ? 'rgba(127,29,29,0.6)' : 'rgba(30,45,25,0.8)'),
      'border:1px solid ' + (isRed ? '#ef4444' : '#c8a44e'),
      'color:' + (isRed ? '#ef4444' : '#c8a44e'),
      'font-family:\'Exo 2\',sans-serif',
      'font-size:0.62rem',
      'letter-spacing:0.06em',
      'text-transform:uppercase',
      'padding:0.4rem 0.9rem',
      'cursor:pointer',
      'border-radius:3px',
      'font-weight:600',
      'transition:all 0.12s'
    ].join(';');
    okBtn.addEventListener('click', function () {
      overlay.remove();
      if (opts.onOk) {
        if (opts.fields && opts.fields.length) {
          var result = {};
          opts.fields.forEach(function (f) { result[f.key] = fieldEls[f.key] ? fieldEls[f.key].value : ''; });
          opts.onOk(result);
        } else {
          opts.onOk(inputEl ? inputEl.value : true);
        }
      }
    });
    btnRow.appendChild(okBtn);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    if (inputEl) {
      inputEl.focus();
      inputEl.select();
      inputEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { overlay.remove(); if (opts.onOk) opts.onOk(inputEl.value); }
        if (ev.key === 'Escape') { overlay.remove(); if (opts.onCancel) opts.onCancel(); }
      });
    } else if (opts.fields && opts.fields.length) {
      var firstField = fieldEls[opts.fields[0].key];
      if (firstField) firstField.focus();
      overlay.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') { overlay.remove(); if (opts.onCancel) opts.onCancel(); }
      });
    }

    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) { overlay.remove(); if (opts.onCancel) opts.onCancel(); }
    });
  }

  function _tmNpcForm(title, defaults, onOk) {
    _tmShowDialog({
      title: title,
      max_width: '520px',
      fields: [
        { key: 'label', label: 'Name', type: 'text', value: defaults.label || '', placeholder: 'NPC name...' },
        { key: 'player_desc', label: 'What Players See', type: 'textarea', rows: 3, value: defaults.player_desc || '', placeholder: 'Appearance, body language, what they\'re doing — no secrets...' },
        { key: 'gm_notes', label: 'GM Notes (hidden from players)', type: 'textarea', rows: 3, value: defaults.gm_notes || '', placeholder: 'Motivation, what they know, plot hooks...' }
      ],
      okText: 'Save',
      onOk: onOk,
      onCancel: function () { onOk(null); }
    });
  }

  function _tmPrompt(title, message, defaultVal, onOk) {
    _tmShowDialog({
      title: title,
      message: message,
      input: defaultVal || '',
      okText: 'Save',
      onOk: onOk,
      onCancel: function () { onOk(null); }
    });
  }

  function _tmConfirm(title, message, onConfirm, onCancel) {
    _tmShowDialog({
      title: title || 'Confirm',
      message: message,
      okText: 'Confirm',
      danger: true,
      onOk: onConfirm,
      onCancel: onCancel || function () {}
    });
  }

  function TacticalMapViewer(opts) {
    this.container = opts.container;
    this.role = opts.role || 'player';
    this.socket = opts.socket || null;
    this.playerName = opts.playerName || '';
    this.onZoneClick = opts.onZoneClick || null;
    this.onClipToJournal = opts.onClipToJournal || null;
    this.onMinimize = opts.onMinimize || null;

    this.mapKey = null;
    this.meta = null;
    this.pins = [];
    this.personalPins = [];
    this.gridVisible = true;

    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this._drag = null;
    this._pinDrag = null;

    this._selectedZone = null;
    this._loadId = 0;

    this._buildDOM();
    this._bindEvents();
  }

  TacticalMapViewer.prototype._buildDOM = function () {
    this.container.innerHTML = '';
    this.container.className = (this.container.className || '').replace(/\btm-viewer\b/, '') + ' tm-viewer';

    this._toolbar = document.createElement('div');
    this._toolbar.className = 'tm-toolbar';
    this._toolbar.innerHTML =
      '<button class="tm-btn tm-zoom-in" title="Zoom In">+</button>' +
      '<button class="tm-btn tm-zoom-out" title="Zoom Out">&minus;</button>' +
      '<button class="tm-btn tm-zoom-fit" title="Fit">Fit</button>' +
      '<button class="tm-btn tm-grid-toggle" title="Toggle Grid">Grid</button>';
    this.container.appendChild(this._toolbar);

    this._viewport = document.createElement('div');
    this._viewport.className = 'tm-viewport';
    this.container.appendChild(this._viewport);

    this._canvas = document.createElement('div');
    this._canvas.className = 'tm-canvas';
    this._viewport.appendChild(this._canvas);

    this._zonePanel = document.createElement('div');
    this._zonePanel.className = 'tm-zone-panel';
    this._zonePanel.style.display = 'none';
    this.container.appendChild(this._zonePanel);
  };

  TacticalMapViewer.prototype._bindEvents = function () {
    var self = this;

    this._toolbar.querySelector('.tm-zoom-in').addEventListener('click', function () { self._setZoom(self.zoom * 1.25); });
    this._toolbar.querySelector('.tm-zoom-out').addEventListener('click', function () { self._setZoom(self.zoom / 1.25); });
    this._toolbar.querySelector('.tm-zoom-fit').addEventListener('click', function () { self.fitView(); });
    this._toolbar.querySelector('.tm-grid-toggle').addEventListener('click', function () {
      self.gridVisible = !self.gridVisible;
      self._renderGrid();
      this.classList.toggle('tm-active', self.gridVisible);
    });

    this._viewport.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest('.tm-pin')) return;
      if (e.target.closest('.tm-hitbox')) return;
      self._drag = { startX: e.clientX, startY: e.clientY, panX: self.panX, panY: self.panY };
      e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
      if (self._pinDrag) {
        e.preventDefault();
        var rect = self._canvas.getBoundingClientRect();
        var x = (e.clientX - rect.left) / self.zoom;
        var y = (e.clientY - rect.top) / self.zoom;
        self._pinDrag.x = x;
        self._pinDrag.y = y;
        self._renderPins();
        return;
      }
      if (!self._drag) return;
      self.panX = self._drag.panX + (e.clientX - self._drag.startX);
      self.panY = self._drag.panY + (e.clientY - self._drag.startY);
      self._applyTransform();
    });

    window.addEventListener('mouseup', function () {
      if (self._pinDrag) {
        var pin = self._pinDrag;
        self._pinDrag = null;
        if (self.socket && self.role === 'gm' && pin.id) {
          self.socket.emit('map:pin-update', { id: pin.id, x: pin.x, y: pin.y });
        }
      }
      self._drag = null;
    });

    this._viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.1 : 0.9;
      self._setZoom(self.zoom * factor);
    }, { passive: false });

    this._viewport.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var rect = self._canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left) / self.zoom;
      var y = (e.clientY - rect.top) / self.zoom;
      self._showPinContextMenu(e.clientX, e.clientY, x, y);
    });

    this._canvas.addEventListener('click', function (e) {
      var hitbox = e.target.closest('.tm-hitbox');
      if (hitbox) {
        var idx = parseInt(hitbox.dataset.zoneIdx);
        if (self.onZoneClick && self.meta && self.meta.zones && self.meta.zones[idx]) {
          var handled = self.onZoneClick(self.meta.zones[idx], idx);
          if (handled) return;
        }
        self._showZoneInfo(idx);
        return;
      }
    });
  };

  TacticalMapViewer.prototype.loadMap = function (mapKey, preloadedPins) {
    var self = this;
    this.mapKey = mapKey;
    this.pins = preloadedPins || [];
    this._loadPersonalPins();
    var loadId = ++this._loadId;
    fetch('/api/maps/' + encodeURIComponent(mapKey) + '/meta')
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load map meta: ' + r.status);
        return r.json();
      })
      .then(function (meta) {
        if (self._loadId !== loadId) return;
        self.meta = meta;
        self.gridVisible = !!(meta.gridConfig && meta.gridConfig.gridOn);
        var gridBtn = self._toolbar.querySelector('.tm-grid-toggle');
        if (gridBtn) gridBtn.classList.toggle('tm-active', self.gridVisible);
        self._render();
        self.fitView();
        if (self.socket) {
          self.socket.emit('map:pins-request', { mapKey: mapKey });
        }
        if (self.onMapLoaded) self.onMapLoaded();
      })
      .catch(function (err) {
        if (self._loadId !== loadId) return;
        console.error('[tactical-map] Failed to load meta:', err);
        self._canvas.innerHTML = '<div style="padding:20px;color:#ef4444;font-size:0.65rem;">Failed to load map data.</div>';
      });
  };

  TacticalMapViewer.prototype._render = function () {
    if (!this.meta) return;
    var m = this.meta;

    var html = '';
    if (m.img) {
      html += '<img class="tm-map-img" src="/maps/' + _esc(m.img) + '" draggable="false" style="width:' + m.vw + 'px;height:' + m.vh + 'px;">';
    } else {
      html += '<iframe class="tm-map-img" src="/maps/' + _esc(m.mapKey) + '.html" style="width:' + m.vw + 'px;height:' + m.vh + 'px;border:none;pointer-events:none;" scrolling="no"></iframe>';
    }
    html += '<svg class="tm-svg-overlay" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + m.vw + ' ' + m.vh + '" style="width:' + m.vw + 'px;height:' + m.vh + 'px;">';
    html += '<g class="tm-grid-layer"></g>';
    html += '<g class="tm-hitbox-layer">';
    (m.zones || []).forEach(function (z, i) {
      html += '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="3" class="tm-hitbox" data-zone-idx="' + i + '"/>';
    });
    html += '</g>';
    html += '<g class="tm-token-layer"></g>';
    html += '<g class="tm-pin-layer"></g>';
    html += '</svg>';

    this._canvas.innerHTML = html;
    this._canvas.style.width = m.vw + 'px';
    this._canvas.style.height = m.vh + 'px';
    this._renderGrid();
    this._renderPins();
  };

  TacticalMapViewer.prototype._renderGrid = function () {
    if (!this.meta) return;
    var gridLayer = this._canvas.querySelector('.tm-grid-layer');
    if (!gridLayer) return;
    if (!this.gridVisible || !this.meta.gridConfig) {
      gridLayer.innerHTML = '';
      return;
    }
    var gc = this.meta.gridConfig;
    var vw = this.meta.vw;
    var vh = this.meta.vh;
    var rgb = gc.gridColor === 'black' ? '0,0,0' : '255,255,255';
    var op = (gc.gridOpacity || 40) / 100;
    var style = 'stroke:rgba(' + rgb + ',' + op + ');stroke-width:' + (gc.gridLineWidth || 1) + ';';
    var lines = '';
    var size = gc.gridSize || 40;
    var offX = gc.gridOffX || 0;
    var offY = gc.gridOffY || 0;
    for (var x = offX % size; x <= vw; x += size) {
      if (x >= 0) lines += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + vh + '" style="' + style + '" pointer-events="none"/>';
    }
    for (var y = offY % size; y <= vh; y += size) {
      if (y >= 0) lines += '<line x1="0" y1="' + y + '" x2="' + vw + '" y2="' + y + '" style="' + style + '" pointer-events="none"/>';
    }
    gridLayer.innerHTML = lines;
  };

  TacticalMapViewer.prototype._renderPins = function () {
    var pinLayer = this._canvas.querySelector('.tm-pin-layer');
    if (!pinLayer) return;
    var allPins = (this.pins || []).concat(this.personalPins || []);
    var self = this;
    var html = '';
    allPins.forEach(function (pin) {
      var pt = PIN_TYPES[pin.pin_type] || PIN_TYPES.note;
      var col = pin.color || pt.color;
      var isPersonal = pin._personal;
      var isPlayerPin = pin.owner === 'player';
      var opacity = isPersonal ? '0.7' : '1';
      var canDrag = self.role === 'gm' && !isPersonal;
      var isOwnPin = isPlayerPin && pin.player_name === self.playerName;
      var cls = 'tm-pin' + (canDrag ? ' tm-pin-draggable' : '') + (isOwnPin ? ' tm-pin-own' : '');
      html += '<g class="' + cls + '" data-pin-id="' + (pin.id || pin._pid || '') + '" data-pin-owner="' + _esc(pin.owner || '') + '" transform="translate(' + pin.x + ',' + pin.y + ')" style="cursor:pointer;opacity:' + opacity + ';">';
      html += '<circle r="20" fill="' + col + '" stroke="' + (isPlayerPin ? '#facc15' : '#000') + '" stroke-width="2.5" opacity="0.88"/>';
      html += '<text text-anchor="middle" dy="7" fill="#fff" font-size="20" font-weight="bold" pointer-events="none">' + pt.icon + '</text>';
      var labelText = pin.label || '';
      if (self.role === 'gm' && isPlayerPin && pin.player_name) {
        labelText = (labelText ? labelText + ' ' : '') + '(' + pin.player_name + ')';
      }
      if (labelText) {
        html += '<text text-anchor="middle" dy="-28" fill="' + col + '" font-size="12" font-family="\'Exo 2\',sans-serif" stroke="#000" stroke-width="3" paint-order="stroke">' + _esc(labelText) + '</text>';
      }
      html += '</g>';
    });
    pinLayer.innerHTML = html;

    if (this.role === 'gm') {
      pinLayer.querySelectorAll('.tm-pin-draggable').forEach(function (el) {
        el.addEventListener('mousedown', function (e) {
          e.stopPropagation();
          e.preventDefault();
          var pinId = parseInt(el.dataset.pinId);
          var pin = self.pins.find(function (p) { return p.id === pinId; });
          if (pin) self._pinDrag = pin;
        });
      });
    }

    pinLayer.querySelectorAll('.tm-pin').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var pinId = el.dataset.pinId;
        var pinOwner = el.dataset.pinOwner;
        if (self.role === 'gm' && pinId) {
          self._showPinEditMenu(e, pinId);
        } else if (self.role === 'player') {
          if (pinId && pinId.indexOf('p') === 0) {
            self._showPersonalPinEditMenu(e, pinId);
          } else if (pinId && pinOwner === 'player') {
            self._showPlayerServerPinEditMenu(e, pinId);
          } else if (pinId) {
            var numId = parseInt(pinId);
            var pin = self.pins.find(function (p) { return p.id === numId; });
            if (pin) self._showPinDetails(e, pin);
          }
        }
      });
    });
  };

  TacticalMapViewer.prototype.renderCombatTokens = function (tokenData) {
    var tokenLayer = this._canvas ? this._canvas.querySelector('.tm-token-layer') : null;
    if (!tokenLayer) return;
    if (!tokenData || !tokenData.length || !this.meta || !this.meta.zones) {
      tokenLayer.innerHTML = '';
      return;
    }

    var zones = this.meta.zones;
    var zoneMap = {};
    zones.forEach(function (z, i) {
      if (z.room) zoneMap[z.room] = z;
      zoneMap['zone_' + i] = z;
    });

    var grouped = {};
    tokenData.forEach(function (tok) {
      if (!tok.zoneId) return;
      if (!grouped[tok.zoneId]) grouped[tok.zoneId] = [];
      grouped[tok.zoneId].push(tok);
    });

    var TOKEN_R = 14;
    var TOKEN_SPACING = 32;
    var html = '';

    Object.keys(grouped).forEach(function (zoneId) {
      var zone = zoneMap[zoneId];
      if (!zone) return;
      var cx = zone.x + zone.w / 2;
      var cy = zone.y + zone.h / 2;
      var toks = grouped[zoneId];
      var cols = Math.ceil(Math.sqrt(toks.length));
      var rows = Math.ceil(toks.length / cols);
      var startX = cx - ((cols - 1) * TOKEN_SPACING) / 2;
      var startY = cy - ((rows - 1) * TOKEN_SPACING) / 2;

      toks.forEach(function (tok, i) {
        var col = i % cols;
        var row = Math.floor(i / cols);
        var tx = startX + col * TOKEN_SPACING;
        var ty = startY + row * TOKEN_SPACING;
        var dispCls = tok.type === 'pc' ? 'pc' : (tok.disposition || 'enemy');
        var initial = tok.shortName ? tok.shortName.charAt(0).toUpperCase() : '?';

        html += '<g class="tm-token tm-token--' + dispCls + '" transform="translate(' + tx + ',' + ty + ')">';
        html += '<circle r="' + TOKEN_R + '" class="tm-token-circle"/>';
        html += '<text text-anchor="middle" dy="5" class="tm-token-initial">' + _esc(initial) + '</text>';
        html += '<text text-anchor="middle" dy="' + (TOKEN_R + 12) + '" class="tm-token-label">' + _esc(tok.shortName || '') + '</text>';
        html += '</g>';
      });
    });

    tokenLayer.innerHTML = html;
  };

  TacticalMapViewer.prototype._showPinDetails = function (e, pin) {
    this._removeContextMenu();
    var pt = PIN_TYPES[pin.pin_type] || PIN_TYPES.note;
    var col = pin.color || pt.color;
    var isNpc = pin.pin_type === 'npc';
    var isGm = this.role === 'gm';
    var details = isNpc ? [] : [
      { key: 'Type', value: pt.label },
      { key: 'Visibility', value: pin.visibility === 'private' ? 'Private' : 'Public' }
    ];
    var opts = {
      title: isNpc ? 'NPC' : 'Pin Details',
      icon: pt.icon,
      iconColor: col,
      pinLabel: pin.label || pt.label,
      details: details,
      okText: 'Close',
      noCancel: true,
      max_width: (isNpc && isGm && pin.gm_notes) ? '540px' : undefined,
      onOk: function () {}
    };
    if (pin.player_desc) {
      opts.message = pin.player_desc;
    }
    if (isNpc && isGm && pin.gm_notes) {
      opts.gm_section = pin.gm_notes;
    }
    _tmShowDialog(opts);
  };

  TacticalMapViewer.prototype._showZoneInfo = function (idx) {
    if (!this.meta || !this.meta.zones || !this.meta.zones[idx]) return;
    var zone = this.meta.zones[idx];
    this._selectedZone = zone;
    var html = '<div class="tm-zone-header">';
    html += '<span class="tm-zone-name">' + _esc(zone.room) + '</span>';
    html += '<button class="tm-zone-close">&times;</button>';
    html += '</div>';
    html += '<div class="tm-zone-body">' + _esc(zone.desc).replace(/\n/g, '<br>') + '</div>';
    if (this.onClipToJournal) {
      html += '<button class="tm-btn tm-clip-btn">Clip to Journal</button>';
    }
    this._zonePanel.innerHTML = html;
    this._zonePanel.style.display = 'block';

    var self = this;
    this._zonePanel.querySelector('.tm-zone-close').addEventListener('click', function () {
      self._zonePanel.style.display = 'none';
      self._selectedZone = null;
    });
    var clipBtn = this._zonePanel.querySelector('.tm-clip-btn');
    if (clipBtn) {
      clipBtn.addEventListener('click', function () {
        if (self.onClipToJournal) self.onClipToJournal(zone, self.mapKey, self.meta.title);
      });
    }
  };

  TacticalMapViewer.prototype._showPinContextMenu = function (screenX, screenY, mapX, mapY) {
    this._removeContextMenu();
    var self = this;
    var menu = document.createElement('div');
    menu.className = 'tm-ctx-menu';
    menu.style.left = screenX + 'px';
    menu.style.top = screenY + 'px';

    var types = Object.keys(PIN_TYPES);
    types.forEach(function (type) {
      var pt = PIN_TYPES[type];
      var btn = document.createElement('button');
      btn.className = 'tm-ctx-item';
      btn.innerHTML = '<span style="color:' + pt.color + ';">' + pt.icon + '</span> ' + pt.label;
      btn.addEventListener('click', function () {
        self._removeContextMenu();
        if (type === 'npc' && self.role === 'gm') {
          _tmNpcForm('Add NPC Pin', {}, function (vals) {
            if (!vals) return;
            if (self.socket) {
              self.socket.emit('map:pin-add', {
                mapKey: self.mapKey, x: Math.round(mapX), y: Math.round(mapY),
                label: vals.label || 'NPC', pin_type: type,
                visibility: 'public', color: pt.color,
                player_desc: vals.player_desc || '',
                gm_notes: vals.gm_notes || ''
              });
            }
          });
        } else {
          _tmPrompt('Add Pin', 'Label for this ' + pt.label + ' pin (optional):', '', function (label) {
            if (label === null) return;
            label = label.trim();
            if (self.socket) {
              self.socket.emit('map:pin-add', {
                mapKey: self.mapKey, x: Math.round(mapX), y: Math.round(mapY),
                label: label, pin_type: type,
                visibility: self.role === 'gm' ? 'public' : 'private',
                color: pt.color
              });
            } else {
              var pin = { _pid: 'p' + Date.now(), x: Math.round(mapX), y: Math.round(mapY), label: label, pin_type: type, color: pt.color, _personal: true };
              self.personalPins.push(pin);
              self._savePersonalPins();
              self._renderPins();
            }
          });
        }
      });
      menu.appendChild(btn);
    });

    if (this.role === 'gm') {
      var priv = document.createElement('button');
      priv.className = 'tm-ctx-item tm-ctx-private';
      priv.innerHTML = '<span style="color:#888;">\uD83D\uDD12</span> Private Note';
      priv.addEventListener('click', function () {
        self._removeContextMenu();
        _tmPrompt('Private Note', 'Label for this GM-only note:', 'GM Note', function (label) {
          if (label === null) return;
          label = label.trim() || 'GM Note';
          self.socket.emit('map:pin-add', {
            mapKey: self.mapKey, x: Math.round(mapX), y: Math.round(mapY),
            label: label, pin_type: 'note', visibility: 'private', color: '#888888'
          });
        });
      });
      menu.appendChild(priv);
    }

    document.body.appendChild(menu);
    setTimeout(function () {
      document.addEventListener('click', self._ctxDismiss = function () {
        self._removeContextMenu();
      }, { once: true });
    }, 0);
  };

  TacticalMapViewer.prototype._showPinEditMenu = function (e, pinId) {
    this._removeContextMenu();
    var self = this;
    var numId = parseInt(pinId);
    var pin = this.pins.find(function (p) { return p.id === numId; });
    if (!pin) return;

    var menu = document.createElement('div');
    menu.className = 'tm-ctx-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    var viewBtn = document.createElement('button');
    viewBtn.className = 'tm-ctx-item';
    viewBtn.textContent = '\u2139 View Details';
    viewBtn.addEventListener('click', function () {
      self._removeContextMenu();
      self._showPinDetails(e, pin);
    });
    menu.appendChild(viewBtn);

    var sep0 = document.createElement('div');
    sep0.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);margin:4px 0;';
    menu.appendChild(sep0);

    var editLabel = document.createElement('button');
    editLabel.className = 'tm-ctx-item';
    editLabel.textContent = '\u270E Edit Label';
    editLabel.addEventListener('click', function () {
      self._removeContextMenu();
      _tmPrompt('Edit Pin Label', null, pin.label || '', function (newLabel) {
        if (newLabel !== null) {
          self.socket.emit('map:pin-update', { id: numId, label: newLabel.trim() });
        }
      });
    });
    menu.appendChild(editLabel);

    if (pin.pin_type === 'npc') {
      var editDetails = document.createElement('button');
      editDetails.className = 'tm-ctx-item';
      editDetails.textContent = '\u270D Edit NPC Details';
      editDetails.addEventListener('click', function () {
        self._removeContextMenu();
        _tmNpcForm('Edit NPC: ' + (pin.label || 'NPC'), {
          label: pin.label || '',
          player_desc: pin.player_desc || '',
          gm_notes: pin.gm_notes || ''
        }, function (vals) {
          if (!vals) return;
          self.socket.emit('map:pin-update', {
            id: numId,
            label: vals.label || pin.label || '',
            player_desc: vals.player_desc || '',
            gm_notes: vals.gm_notes || ''
          });
        });
      });
      menu.appendChild(editDetails);
    }

    var typeKeys = Object.keys(PIN_TYPES);
    typeKeys.forEach(function (type) {
      if (type === pin.pin_type) return;
      var pt = PIN_TYPES[type];
      var btn = document.createElement('button');
      btn.className = 'tm-ctx-item';
      btn.innerHTML = '<span style="color:' + pt.color + ';">' + pt.icon + '</span> Change to ' + pt.label;
      btn.addEventListener('click', function () {
        self._removeContextMenu();
        self.socket.emit('map:pin-update', { id: numId, pin_type: type, color: pt.color });
      });
      menu.appendChild(btn);
    });

    var toggleVis = document.createElement('button');
    toggleVis.className = 'tm-ctx-item';
    toggleVis.textContent = pin.visibility === 'public' ? '\uD83D\uDD12 Make Private' : '\uD83D\uDD13 Make Public';
    toggleVis.addEventListener('click', function () {
      self._removeContextMenu();
      self.socket.emit('map:pin-update', { id: numId, visibility: pin.visibility === 'public' ? 'private' : 'public' });
    });
    menu.appendChild(toggleVis);

    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);margin:4px 0;';
    menu.appendChild(sep);

    var delBtn = document.createElement('button');
    delBtn.className = 'tm-ctx-item';
    delBtn.style.color = '#ef4444';
    delBtn.textContent = '\u2716 Delete Pin';
    delBtn.addEventListener('click', function () {
      self._removeContextMenu();
      _tmConfirm('Delete Pin', 'Remove this ' + (PIN_TYPES[pin.pin_type] || PIN_TYPES.note).label + ' pin' + (pin.label ? ' \u201C' + pin.label + '\u201D' : '') + '?', function () {
        self.socket.emit('map:pin-remove', { id: numId, mapKey: self.mapKey });
      });
    });
    menu.appendChild(delBtn);

    document.body.appendChild(menu);
    setTimeout(function () {
      document.addEventListener('click', self._ctxDismiss = function () {
        self._removeContextMenu();
      }, { once: true });
    }, 0);
  };

  TacticalMapViewer.prototype._showPlayerServerPinEditMenu = function (e, pinId) {
    this._removeContextMenu();
    var self = this;
    var numId = parseInt(pinId);
    var pin = this.pins.find(function (p) { return p.id === numId; });
    if (!pin || pin.player_name !== self.playerName) return;

    var menu = document.createElement('div');
    menu.className = 'tm-ctx-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    var editLabel = document.createElement('button');
    editLabel.className = 'tm-ctx-item';
    editLabel.textContent = '\u270E Edit Label';
    editLabel.addEventListener('click', function () {
      self._removeContextMenu();
      _tmPrompt('Edit Pin Label', null, pin.label || '', function (newLabel) {
        if (newLabel !== null) {
          self.socket.emit('map:pin-update', { id: numId, label: newLabel.trim() });
        }
      });
    });
    menu.appendChild(editLabel);

    var typeKeys = Object.keys(PIN_TYPES);
    typeKeys.forEach(function (type) {
      if (type === pin.pin_type) return;
      var pt = PIN_TYPES[type];
      var btn = document.createElement('button');
      btn.className = 'tm-ctx-item';
      btn.innerHTML = '<span style="color:' + pt.color + ';">' + pt.icon + '</span> Change to ' + pt.label;
      btn.addEventListener('click', function () {
        self._removeContextMenu();
        self.socket.emit('map:pin-update', { id: numId, pin_type: type, color: pt.color });
      });
      menu.appendChild(btn);
    });

    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);margin:4px 0;';
    menu.appendChild(sep);

    var delBtn = document.createElement('button');
    delBtn.className = 'tm-ctx-item';
    delBtn.style.color = '#ef4444';
    delBtn.textContent = '\u2716 Remove Pin';
    delBtn.addEventListener('click', function () {
      self._removeContextMenu();
      _tmConfirm('Remove Pin', 'Remove this pin from the map?', function () {
        self.socket.emit('map:pin-remove', { id: numId, mapKey: self.mapKey });
      });
    });
    menu.appendChild(delBtn);

    document.body.appendChild(menu);
    setTimeout(function () {
      document.addEventListener('click', self._ctxDismiss = function () {
        self._removeContextMenu();
      }, { once: true });
    }, 0);
  };

  TacticalMapViewer.prototype._showPersonalPinEditMenu = function (e, pinId) {
    this._removeContextMenu();
    var self = this;
    var pin = this.personalPins.find(function (p) { return p._pid === pinId; });
    if (!pin) return;

    var menu = document.createElement('div');
    menu.className = 'tm-ctx-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    var editLabel = document.createElement('button');
    editLabel.className = 'tm-ctx-item';
    editLabel.textContent = '\u270E Edit Label';
    editLabel.addEventListener('click', function () {
      self._removeContextMenu();
      _tmPrompt('Edit Pin Label', null, pin.label || '', function (newLabel) {
        if (newLabel !== null) {
          pin.label = newLabel.trim();
          self._savePersonalPins();
          self._renderPins();
        }
      });
    });
    menu.appendChild(editLabel);

    var typeKeys = Object.keys(PIN_TYPES);
    typeKeys.forEach(function (type) {
      if (type === pin.pin_type) return;
      var pt = PIN_TYPES[type];
      var btn = document.createElement('button');
      btn.className = 'tm-ctx-item';
      btn.innerHTML = '<span style="color:' + pt.color + ';">' + pt.icon + '</span> Change to ' + pt.label;
      btn.addEventListener('click', function () {
        self._removeContextMenu();
        pin.pin_type = type;
        pin.color = pt.color;
        self._savePersonalPins();
        self._renderPins();
      });
      menu.appendChild(btn);
    });

    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.08);margin:4px 0;';
    menu.appendChild(sep);

    var delBtn = document.createElement('button');
    delBtn.className = 'tm-ctx-item';
    delBtn.style.color = '#ef4444';
    delBtn.textContent = '\u2716 Remove Pin';
    delBtn.addEventListener('click', function () {
      self._removeContextMenu();
      _tmConfirm('Remove Pin', 'Remove this personal pin?', function () {
        self.personalPins = self.personalPins.filter(function (p) { return p._pid !== pinId; });
        self._savePersonalPins();
        self._renderPins();
      });
    });
    menu.appendChild(delBtn);

    document.body.appendChild(menu);
    setTimeout(function () {
      document.addEventListener('click', self._ctxDismiss = function () {
        self._removeContextMenu();
      }, { once: true });
    }, 0);
  };

  TacticalMapViewer.prototype._removeContextMenu = function () {
    var existing = document.querySelector('.tm-ctx-menu');
    if (existing) existing.remove();
    if (this._ctxDismiss) {
      document.removeEventListener('click', this._ctxDismiss);
      this._ctxDismiss = null;
    }
  };

  TacticalMapViewer.prototype._setZoom = function (z) {
    this.zoom = Math.max(0.15, Math.min(4, z));
    this._applyTransform();
  };

  TacticalMapViewer.prototype._applyTransform = function () {
    this._canvas.style.transform = 'translate(' + this.panX + 'px,' + this.panY + 'px) scale(' + this.zoom + ')';
  };

  TacticalMapViewer.prototype.fitView = function (retries) {
    if (!this.meta) return;
    var vp = this._viewport;
    var padW = vp.clientWidth - 20;
    var padH = vp.clientHeight - 20;
    if (padW <= 0 || padH <= 0) {
      var r = retries || 0;
      if (r < 10) {
        var self = this;
        setTimeout(function () { self.fitView(r + 1); }, 50);
      }
      return;
    }
    this.zoom = Math.min(padW / this.meta.vw, padH / this.meta.vh, 1.5);
    this.panX = (vp.clientWidth - this.meta.vw * this.zoom) / 2;
    this.panY = (vp.clientHeight - this.meta.vh * this.zoom) / 2;
    this._applyTransform();
  };

  TacticalMapViewer.prototype.handlePinAdded = function (pin) {
    if (!pin || pin.map_key !== this.mapKey) return;
    var exists = this.pins.find(function (p) { return p.id === pin.id; });
    if (!exists) this.pins.push(pin);
    this._renderPins();
  };

  TacticalMapViewer.prototype.handlePinUpdated = function (pin) {
    if (!pin || pin.map_key !== this.mapKey) return;
    var found = false;
    for (var i = 0; i < this.pins.length; i++) {
      if (this.pins[i].id === pin.id) { this.pins[i] = pin; found = true; break; }
    }
    if (!found) this.pins.push(pin);
    this._renderPins();
  };

  TacticalMapViewer.prototype.handlePinRemoved = function (id) {
    this.pins = this.pins.filter(function (p) { return p.id !== id; });
    this._renderPins();
  };

  TacticalMapViewer.prototype.handlePinsSync = function (pins) {
    this.pins = pins || [];
    this._renderPins();
  };

  TacticalMapViewer.prototype._personalPinKey = function () {
    var suffix = this.playerName ? ('_' + this.playerName) : '';
    return 'tm_pins_' + this.mapKey + suffix;
  };

  TacticalMapViewer.prototype._loadPersonalPins = function () {
    try {
      var raw = sessionStorage.getItem(this._personalPinKey());
      this.personalPins = raw ? JSON.parse(raw) : [];
      this.personalPins.forEach(function (p) { p._personal = true; });
    } catch (e) { this.personalPins = []; }
  };

  TacticalMapViewer.prototype._savePersonalPins = function () {
    try {
      sessionStorage.setItem(this._personalPinKey(), JSON.stringify(this.personalPins));
    } catch (e) {}
  };

  TacticalMapViewer.prototype.destroy = function () {
    this.container.innerHTML = '';
    this.meta = null;
    this.pins = [];
    this.personalPins = [];
  };

  window.TacticalMapViewer = TacticalMapViewer;
  window.TacticalMapViewer._confirm = _tmConfirm;
  window.TacticalMapViewer._prompt  = _tmPrompt;
}());
