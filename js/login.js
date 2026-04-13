(function () {
  var form  = document.getElementById('login-form');
  var input = document.getElementById('passcode');
  var error = document.getElementById('login-error');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    error.innerHTML = '&nbsp;';
    var code = input.value.trim();
    if (!code) { error.textContent = 'Enter an access code.'; return; }

    fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ passcode: code }),
    })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (result) {
        if (!result.ok) {
          error.textContent = result.data.error || 'Access denied.';
          input.value = '';
          input.focus();
          return;
        }
        window.location.href = '/';
      })
      .catch(function () {
        error.textContent = 'Connection failed.';
      });
  });
}());
