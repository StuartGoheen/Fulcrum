(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.GalaxyMap) return;
    window.GalaxyMap.open();
    var closeBtn = document.getElementById('gm-close-map');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = '/';
      }, true);
    }
  });
}());
