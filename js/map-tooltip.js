(function () {
  var tip = document.getElementById('tooltip');
  if (!tip) return;

  document.querySelectorAll('.hitbox').forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      var room = el.dataset.room;
      var desc = el.dataset.desc;
      tip.innerHTML = '<strong style="color:#e0d4b8;text-transform:uppercase;letter-spacing:1px;font-size:14px;">' + room + '</strong><br><br><span style="color:#c0b89a;">' + desc + '</span>';
      tip.style.display = 'block';
    });

    el.addEventListener('mousemove', function (e) {
      var pad = 15;
      var x = e.clientX + pad;
      var y = e.clientY + pad;
      var r = tip.getBoundingClientRect();
      if (x + r.width > window.innerWidth) x = e.clientX - r.width - pad;
      if (y + r.height > window.innerHeight) y = e.clientY - r.height - pad;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    });

    el.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
    });
  });
}());
