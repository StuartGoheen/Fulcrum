(function () {
  if (window.GalaxyMap) {
    window.GalaxyMap.open();
    var closeBtn = document.getElementById('gm-close-map');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        window.location.href = '/';
      }, true);
    }
  }
})();
