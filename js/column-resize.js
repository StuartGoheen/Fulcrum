(function () {
  'use strict';

  var STORAGE_KEY = 'eote-col-widths';
  var MIN_PX = 160;
  var DEFAULT_VW = 25;

  var frameLeft  = document.getElementById('frame-left');
  var frameRight = document.getElementById('frame-right');
  var center     = document.getElementById('center-content');
  var navbar     = document.getElementById('navbar');
  var footer     = document.getElementById('player-footer');
  var handleL    = document.getElementById('resize-handle-left');
  var handleR    = document.getElementById('resize-handle-right');

  if (!frameLeft || !frameRight || !center || !handleL || !handleR) return;

  var leftPx  = Math.round(window.innerWidth * DEFAULT_VW / 100);
  var rightPx = Math.round(window.innerWidth * DEFAULT_VW / 100);

  function loadSizes() {
    try {
      var s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s && s.leftPx) leftPx = s.leftPx;
      if (s && s.rightPx) rightPx = s.rightPx;
    } catch (_) {}
  }

  function saveSizes() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ leftPx: leftPx, rightPx: rightPx })); } catch (_) {}
  }

  function isRightHidden() {
    return window.getComputedStyle(frameRight).display === 'none';
  }

  function applyLayout() {
    var w = window.innerWidth;
    var maxSide = Math.floor(w * 0.4);
    if (leftPx < MIN_PX) leftPx = MIN_PX;
    if (leftPx > maxSide) leftPx = maxSide;
    if (rightPx < MIN_PX) rightPx = MIN_PX;
    if (rightPx > maxSide) rightPx = maxSide;

    var rHidden = isRightHidden();
    var effectiveRight = rHidden ? 0 : rightPx;

    frameLeft.style.setProperty('width', leftPx + 'px', 'important');

    if (!rHidden) {
      frameRight.style.setProperty('width', rightPx + 'px', 'important');
    }

    center.style.setProperty('margin-left', leftPx + 'px', 'important');
    center.style.setProperty('margin-right', effectiveRight + 'px', 'important');

    if (navbar) {
      navbar.style.setProperty('left', leftPx + 'px', 'important');
      navbar.style.setProperty('right', effectiveRight + 'px', 'important');
    }
    if (footer) {
      footer.style.setProperty('left', leftPx + 'px', 'important');
      footer.style.setProperty('right', effectiveRight + 'px', 'important');
    }

    handleL.style.left = leftPx + 'px';

    if (rHidden) {
      handleR.style.display = 'none';
    } else {
      handleR.style.display = '';
      handleR.style.left = (w - rightPx) + 'px';
    }

    applyCenterSplit();

    if (window.PanelSystem && window.PanelSystem.checkTripleMode) {
      window.PanelSystem.checkTripleMode();
    }
  }

  function startDrag(side, e) {
    e.preventDefault();
    document.body.classList.add('is-col-resizing');
    var handle = side === 'left' ? handleL : handleR;
    handle.classList.add('is-dragging');

    var startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    var startVal = side === 'left' ? leftPx : rightPx;

    function onMove(ev) {
      var x = ev.clientX || (ev.touches && ev.touches[0].clientX) || 0;
      var delta = x - startX;
      if (side === 'left') {
        leftPx = startVal + delta;
      } else {
        rightPx = startVal - delta;
      }
      applyLayout();
    }

    function onUp() {
      document.body.classList.remove('is-col-resizing');
      handle.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      saveSizes();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  handleL.addEventListener('mousedown', function (e) { startDrag('left', e); });
  handleL.addEventListener('touchstart', function (e) { startDrag('left', e); }, { passive: false });
  handleR.addEventListener('mousedown', function (e) { startDrag('right', e); });
  handleR.addEventListener('touchstart', function (e) { startDrag('right', e); }, { passive: false });

  window.addEventListener('resize', function () { applyLayout(); });

  loadSizes();
  applyLayout();

  var centerHandle1 = document.getElementById('center-resize-handle');
  var centerHandle2 = document.getElementById('center-resize-handle-2');
  var slotLeft      = document.getElementById('slot-left');
  var slotMid       = document.getElementById('slot-mid');
  var slotRight     = document.getElementById('slot-right');

  var CENTER_STORAGE_KEY  = 'eote-center-split';
  var CENTER3_STORAGE_KEY = 'eote-center-split3';

  var centerRatio = 0.5;
  var split3 = { a: 0.333, b: 0.666 };

  function loadCenterRatio() {
    try {
      var v = parseFloat(localStorage.getItem(CENTER_STORAGE_KEY));
      if (v > 0.2 && v < 0.8) centerRatio = v;
    } catch (_) {}
    try {
      var s = JSON.parse(localStorage.getItem(CENTER3_STORAGE_KEY));
      if (s && s.a > 0.15 && s.a < 0.7 && s.b > 0.3 && s.b < 0.85 && s.b > s.a + 0.1) {
        split3.a = s.a;
        split3.b = s.b;
      }
    } catch (_) {}
  }

  function saveCenterRatio() {
    try { localStorage.setItem(CENTER_STORAGE_KEY, centerRatio.toFixed(4)); } catch (_) {}
  }

  function saveSplit3() {
    try { localStorage.setItem(CENTER3_STORAGE_KEY, JSON.stringify({ a: +split3.a.toFixed(4), b: +split3.b.toFixed(4) })); } catch (_) {}
  }

  function _isTriple() {
    return slotMid && slotMid.style.display !== 'none';
  }

  function applyCenterSplit() {
    if (!slotLeft || !slotRight) return;

    if (_isTriple()) {
      slotLeft.style.flex  = split3.a + ' 1 0%';
      slotMid.style.flex   = (split3.b - split3.a) + ' 1 0%';
      slotRight.style.flex = (1 - split3.b) + ' 1 0%';
    } else {
      slotLeft.style.flex  = centerRatio + ' 1 0%';
      slotRight.style.flex = (1 - centerRatio) + ' 1 0%';
    }
  }

  function _startCenterDrag(handleEl, whichHandle, e) {
    e.preventDefault();
    document.body.classList.add('is-col-resizing');
    handleEl.classList.add('is-dragging');

    var containerRect = center.getBoundingClientRect();

    function onMove(ev) {
      var x = ev.clientX || (ev.touches && ev.touches[0].clientX) || 0;
      var rel = (x - containerRect.left) / containerRect.width;

      if (_isTriple()) {
        if (whichHandle === 1) {
          if (rel < 0.15) rel = 0.15;
          if (rel > split3.b - 0.1) rel = split3.b - 0.1;
          split3.a = rel;
        } else {
          if (rel < split3.a + 0.1) rel = split3.a + 0.1;
          if (rel > 0.85) rel = 0.85;
          split3.b = rel;
        }
      } else {
        if (rel < 0.2) rel = 0.2;
        if (rel > 0.8) rel = 0.8;
        centerRatio = rel;
      }
      applyCenterSplit();
    }

    function onUp() {
      document.body.classList.remove('is-col-resizing');
      handleEl.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      if (_isTriple()) { saveSplit3(); } else { saveCenterRatio(); }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  loadCenterRatio();
  applyCenterSplit();

  if (centerHandle1) {
    centerHandle1.addEventListener('mousedown', function (e) { _startCenterDrag(centerHandle1, 1, e); });
    centerHandle1.addEventListener('touchstart', function (e) { _startCenterDrag(centerHandle1, 1, e); }, { passive: false });
  }
  if (centerHandle2) {
    centerHandle2.addEventListener('mousedown', function (e) { _startCenterDrag(centerHandle2, 2, e); });
    centerHandle2.addEventListener('touchstart', function (e) { _startCenterDrag(centerHandle2, 2, e); }, { passive: false });
  }

  document.addEventListener('triplemode:changed', function () {
    applyCenterSplit();
  });
}());
