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

  var centerHandle = document.getElementById('center-resize-handle');
  var slotLeft     = document.getElementById('slot-left');
  var slotRight    = document.getElementById('slot-right');
  var CENTER_STORAGE_KEY = 'eote-center-split';
  var centerRatio = 0.5;

  function loadCenterRatio() {
    try {
      var v = parseFloat(localStorage.getItem(CENTER_STORAGE_KEY));
      if (v > 0.2 && v < 0.8) centerRatio = v;
    } catch (_) {}
  }

  function saveCenterRatio() {
    try { localStorage.setItem(CENTER_STORAGE_KEY, centerRatio.toFixed(4)); } catch (_) {}
  }

  function applyCenterSplit() {
    if (!slotLeft || !slotRight) return;
    var leftFlex  = centerRatio;
    var rightFlex = 1 - centerRatio;
    slotLeft.style.flex  = leftFlex + ' 1 0%';
    slotRight.style.flex = rightFlex + ' 1 0%';
  }

  if (centerHandle && slotLeft && slotRight) {
    loadCenterRatio();
    applyCenterSplit();

    function startCenterDrag(e) {
      e.preventDefault();
      document.body.classList.add('is-col-resizing');
      centerHandle.classList.add('is-dragging');

      var containerRect = center.getBoundingClientRect();

      function onMove(ev) {
        var x = ev.clientX || (ev.touches && ev.touches[0].clientX) || 0;
        var rel = (x - containerRect.left) / containerRect.width;
        if (rel < 0.2) rel = 0.2;
        if (rel > 0.8) rel = 0.8;
        centerRatio = rel;
        applyCenterSplit();
      }

      function onUp() {
        document.body.classList.remove('is-col-resizing');
        centerHandle.classList.remove('is-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        saveCenterRatio();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    }

    centerHandle.addEventListener('mousedown', startCenterDrag);
    centerHandle.addEventListener('touchstart', startCenterDrag, { passive: false });
  }
}());
