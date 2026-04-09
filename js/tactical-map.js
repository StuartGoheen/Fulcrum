(function () {
  var PIN_TYPES = {
    enemy:     { icon: '\u2620', color: '#ef4444', label: 'Enemy' },
    hazard:    { icon: '\u26A0', color: '#eab308', label: 'Hazard' },
    note:      { icon: '\u270E', color: '#60a5fa', label: 'Note' },
    objective: { icon: '\u2605', color: '#22c55e', label: 'Objective' },
    ally:      { icon: '\u2694', color: '#a78bfa', label: 'Ally' }
  };

  var _esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

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
        self._render();
        self.fitView();
        if (self.socket) {
          self.socket.emit('map:pins-request', { mapKey: mapKey });
        }
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

    var html = '<img class="tm-map-img" src="/maps/' + _esc(m.img) + '" draggable="false" style="width:' + m.vw + 'px;height:' + m.vh + 'px;">';
    html += '<svg class="tm-svg-overlay" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + m.vw + ' ' + m.vh + '" style="width:' + m.vw + 'px;height:' + m.vh + 'px;">';
    html += '<g class="tm-grid-layer"></g>';
    html += '<g class="tm-hitbox-layer">';
    (m.zones || []).forEach(function (z, i) {
      html += '<rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="3" class="tm-hitbox" data-zone-idx="' + i + '"/>';
    });
    html += '</g>';
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
    if (!this.gridVisible || !this.meta.gridConfig || !this.meta.gridConfig.gridOn) {
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
      var opacity = isPersonal ? '0.7' : '1';
      var cls = 'tm-pin' + (self.role === 'gm' && !isPersonal ? ' tm-pin-draggable' : '');
      html += '<g class="' + cls + '" data-pin-id="' + (pin.id || pin._pid || '') + '" transform="translate(' + pin.x + ',' + pin.y + ')" style="cursor:pointer;opacity:' + opacity + ';">';
      html += '<circle r="10" fill="' + col + '" stroke="#000" stroke-width="1.5" opacity="0.85"/>';
      html += '<text text-anchor="middle" dy="4" fill="#fff" font-size="12" font-weight="bold" pointer-events="none">' + pt.icon + '</text>';
      if (pin.label) {
        html += '<text text-anchor="middle" dy="-14" fill="' + col + '" font-size="9" font-family="\'Exo 2\',sans-serif" stroke="#000" stroke-width="2" paint-order="stroke">' + _esc(pin.label) + '</text>';
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
        if (self.role === 'gm' && pinId) {
          self._showPinEditMenu(e, pinId);
        }
      });
    });
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
        var label = prompt('Pin label (optional):') || '';
        if (self.socket) {
          self.socket.emit('map:pin-add', {
            mapKey: self.mapKey, x: Math.round(mapX), y: Math.round(mapY),
            label: label, pin_type: type, visibility: 'public', color: pt.color,
            playerName: self.playerName
          });
        } else {
          var pin = { _pid: 'p' + Date.now(), x: Math.round(mapX), y: Math.round(mapY), label: label, pin_type: type, color: pt.color, _personal: true };
          self.personalPins.push(pin);
          self._savePersonalPins();
          self._renderPins();
        }
      });
      menu.appendChild(btn);
    });

    if (this.role === 'gm') {
      var priv = document.createElement('button');
      priv.className = 'tm-ctx-item tm-ctx-private';
      priv.innerHTML = '<span style="color:#888;">\u{1F512}</span> Private Note';
      priv.addEventListener('click', function () {
        self._removeContextMenu();
        var label = prompt('Private note label:') || 'GM Note';
        self.socket.emit('map:pin-add', {
          mapKey: self.mapKey, x: Math.round(mapX), y: Math.round(mapY),
          label: label, pin_type: 'note', visibility: 'private', color: '#888888'
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

    var editLabel = document.createElement('button');
    editLabel.className = 'tm-ctx-item';
    editLabel.textContent = '\u270E Edit Label';
    editLabel.addEventListener('click', function () {
      self._removeContextMenu();
      var newLabel = prompt('Edit pin label:', pin.label || '');
      if (newLabel !== null) {
        self.socket.emit('map:pin-update', { id: numId, label: newLabel });
      }
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

    var toggleVis = document.createElement('button');
    toggleVis.className = 'tm-ctx-item';
    toggleVis.textContent = pin.visibility === 'public' ? '\uD83D\uDD12 Make Private' : '\uD83D\uDD13 Make Public';
    toggleVis.addEventListener('click', function () {
      self._removeContextMenu();
      self.socket.emit('map:pin-update', { id: numId, visibility: pin.visibility === 'public' ? 'private' : 'public' });
    });
    menu.appendChild(toggleVis);

    var sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.1);margin:4px 0;';
    menu.appendChild(sep);

    var delBtn = document.createElement('button');
    delBtn.className = 'tm-ctx-item';
    delBtn.style.color = '#ef4444';
    delBtn.textContent = '\u2716 Delete Pin';
    delBtn.addEventListener('click', function () {
      self._removeContextMenu();
      self.socket.emit('map:pin-remove', { id: numId, mapKey: self.mapKey });
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

  TacticalMapViewer.prototype.fitView = function () {
    if (!this.meta) return;
    var vp = this._viewport;
    var padW = vp.clientWidth - 20;
    var padH = vp.clientHeight - 20;
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
}());
