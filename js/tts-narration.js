(function () {
  'use strict';

  var _supported = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);

  var _voices = [];
  var _currentUtterance = null;
  var _state = 'idle';
  var _onStateChange = null;
  var _activePartId = null;
  var _voicesLoadedCallbacks = [];

  var STORAGE_KEY = 'cb_tts_prefs';

  function isSupported() { return _supported; }

  function _loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) { return {}; }
  }

  function _savePrefs(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  }

  function getPrefs() {
    var p = _loadPrefs();
    return {
      voiceURI: p.voiceURI || '',
      rate: p.rate != null ? p.rate : 0.92,
      pitch: p.pitch != null ? p.pitch : 0.85,
      autoContinue: p.autoContinue !== false
    };
  }

  function setPref(key, val) {
    var p = _loadPrefs();
    p[key] = val;
    _savePrefs(p);
  }

  function _setState(s) {
    _state = s;
    if (_onStateChange) _onStateChange(s, _activePartId);
  }

  function getState() { return _state; }
  function getActivePartId() { return _activePartId; }

  function _notifyVoicesLoaded() {
    var cbs = _voicesLoadedCallbacks.slice();
    _voicesLoadedCallbacks = [];
    cbs.forEach(function (cb) { cb(_voices); });
  }

  function loadVoices() {
    return new Promise(function (resolve) {
      if (!_supported) { resolve([]); return; }

      _voices = window.speechSynthesis.getVoices();
      if (_voices.length > 0) {
        resolve(_voices);
        return;
      }

      var resolved = false;
      function done() {
        if (resolved) return;
        resolved = true;
        _voices = window.speechSynthesis.getVoices();
        resolve(_voices);
        _notifyVoicesLoaded();
      }

      window.speechSynthesis.onvoiceschanged = done;
      setTimeout(done, 2000);
    });
  }

  function onVoicesLoaded(cb) {
    _voicesLoadedCallbacks.push(cb);
  }

  function getVoices() { return _voices; }

  function _pickDefaultVoice() {
    var en = _voices.filter(function (v) { return v.lang && v.lang.indexOf('en') === 0; });
    var deep = en.filter(function (v) {
      var n = v.name.toLowerCase();
      return n.indexOf('male') > -1 || n.indexOf('daniel') > -1 || n.indexOf('james') > -1 ||
        n.indexOf('david') > -1 || n.indexOf('google uk english male') > -1 ||
        n.indexOf('aaron') > -1 || n.indexOf('arthur') > -1;
    });
    if (deep.length > 0) return deep[0];
    if (en.length > 0) return en[0];
    return _voices[0] || null;
  }

  function _findVoice(uri) {
    for (var i = 0; i < _voices.length; i++) {
      if (_voices[i].voiceURI === uri) return _voices[i];
    }
    return null;
  }

  function _stripHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function speak(text, partId, onEnd) {
    if (!_supported) return;
    stop();
    var clean = _stripHtml(text);
    if (!clean) return;

    var prefs = getPrefs();
    var voice = _findVoice(prefs.voiceURI) || _pickDefaultVoice();

    var utt = new SpeechSynthesisUtterance(clean);
    if (voice) utt.voice = voice;
    utt.rate = prefs.rate;
    utt.pitch = prefs.pitch;
    utt.lang = voice ? voice.lang : 'en-US';

    _activePartId = partId || null;
    _currentUtterance = utt;
    _setState('speaking');

    utt.onend = function () {
      _currentUtterance = null;
      _setState('idle');
      if (onEnd) onEnd();
    };
    utt.onerror = function () {
      _currentUtterance = null;
      _setState('idle');
    };

    window.speechSynthesis.speak(utt);
  }

  function stop() {
    if (!_supported) return;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    _currentUtterance = null;
    _activePartId = null;
    _setState('idle');
  }

  function onStateChange(cb) {
    _onStateChange = cb;
  }

  function speakParts(part1Html, part2Html, partPrefix) {
    var prefs = getPrefs();
    speak(part1Html, (partPrefix || '') + 'part1', function () {
      if (part2Html && prefs.autoContinue) {
        _activePartId = (partPrefix || '') + 'part2';
        _setState('waiting');
        setTimeout(function () {
          if (_state === 'waiting') {
            speak(part2Html, (partPrefix || '') + 'part2');
          }
        }, 1500);
      }
    });
  }

  window.TtsNarration = {
    isSupported: isSupported,
    loadVoices: loadVoices,
    onVoicesLoaded: onVoicesLoaded,
    getVoices: getVoices,
    getPrefs: getPrefs,
    setPref: setPref,
    getState: getState,
    getActivePartId: getActivePartId,
    speak: speak,
    speakParts: speakParts,
    stop: stop,
    onStateChange: onStateChange
  };
}());
