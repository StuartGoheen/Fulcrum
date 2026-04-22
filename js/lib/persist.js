(function () {
  'use strict';

  var PREFIX = 'eote.';

  function _key(k) {
    if (k == null) return PREFIX;
    var s = String(k);
    return s.indexOf(PREFIX) === 0 ? s : PREFIX + s;
  }

  function get(k, fallback) {
    try {
      var raw = window.localStorage.getItem(_key(k));
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (_) { return raw; }
    } catch (_) { return fallback; }
  }

  function set(k, value) {
    try {
      var v = (typeof value === 'string') ? value : JSON.stringify(value);
      window.localStorage.setItem(_key(k), v);
      return true;
    } catch (_) { return false; }
  }

  function remove(k) {
    try { window.localStorage.removeItem(_key(k)); return true; }
    catch (_) { return false; }
  }

  function migrate(oldRawKey, newKey) {
    try {
      var ls = window.localStorage;
      var nk = _key(newKey);
      if (ls.getItem(nk) != null) { ls.removeItem(oldRawKey); return false; }
      var old = ls.getItem(oldRawKey);
      if (old == null) return false;
      ls.setItem(nk, old);
      ls.removeItem(oldRawKey);
      return true;
    } catch (_) { return false; }
  }

  function clear() {
    try {
      var ls = window.localStorage;
      var rm = [];
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf(PREFIX) === 0) rm.push(k);
      }
      rm.forEach(function (k) { ls.removeItem(k); });
      return true;
    } catch (_) { return false; }
  }

  window.Persist = { get: get, set: set, remove: remove, clear: clear, migrate: migrate, PREFIX: PREFIX };
}());
