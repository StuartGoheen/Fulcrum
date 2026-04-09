(function () {
  var state = {
    adventures: [],
    selectedId: null,
    activeAdventureId: null,
    dirty: false
  };

  var DEFAULT_TERMS = [
    'GALACTIC EMPIRE', 'REPUBLIC', 'STAR DESTROYERS', 'CRIME SYNDICATES',
    'REBEL ALLIANCE', 'IMPERIAL', 'JEDI', 'SITH', 'MANDALORIAN',
    'BOUNTY HUNTERS', 'HUTT CARTEL', 'OUTER RIM', 'CORE WORLDS',
    'DEATH STAR', 'SENATE', 'CLONE WARS', 'SEPARATIST', 'TRADE FEDERATION',
    'BLACK SUN', 'PYKE SYNDICATE', 'CRIMSON DAWN', 'INQUISITORS'
  ];

  function $(id) { return document.getElementById(id); }

  function showToast(msg, type) {
    var toast = $('toast');
    toast.textContent = msg;
    toast.className = 'ce-toast ce-toast--visible' + (type ? ' ce-toast--' + type : '');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove('ce-toast--visible');
    }, 3000);
  }

  function autoCapitalize(text, customTerms) {
    var terms = DEFAULT_TERMS.slice();
    if (customTerms) {
      customTerms.split(',').forEach(function (t) {
        t = t.trim();
        if (t) terms.push(t.toUpperCase());
      });
    }
    terms.sort(function (a, b) { return b.length - a.length; });

    var result = text;
    terms.forEach(function (term) {
      var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var regex = new RegExp('\\b' + escaped + '\\b', 'gi');
      result = result.replace(regex, term);
    });
    return result;
  }

  function loadAdventures() {
    fetch('/api/crawls')
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(function (data) {
        state.adventures = data.crawls || [];
        state.activeAdventureId = data.activeAdventureId;
        renderSidebar();
        if (state.selectedId) {
          selectAdventure(state.selectedId);
        }
      })
      .catch(function () {
        showToast('Failed to load adventures', 'error');
      });
  }

  function renderSidebar() {
    var list = $('adventure-list');
    list.innerHTML = '';

    state.adventures.forEach(function (adv) {
      var item = document.createElement('div');
      item.className = 'ce-adv-item';
      if (adv.adventureId === state.selectedId) item.classList.add('ce-adv-item--selected');
      if (adv.hasCrawl) item.classList.add('ce-adv-item--has-crawl');

      var statusText = adv.hasCrawl ? 'Crawl saved' : 'No crawl';
      var statusClass = '';
      if (adv.isActive) {
        statusText = 'Active crawl';
        statusClass = ' ce-adv-status--active';
      }

      item.innerHTML =
        '<div class="ce-adv-num">' + adv.adventureNumber + '</div>' +
        '<div class="ce-adv-info">' +
        '<div class="ce-adv-title">' + escHtml(adv.adventureTitle) + '</div>' +
        '<div class="ce-adv-status' + statusClass + '">' + statusText + '</div>' +
        '</div>';

      item.addEventListener('click', function () {
        selectAdventure(adv.adventureId);
      });

      list.appendChild(item);
    });
  }

  function selectAdventure(advId) {
    state.selectedId = advId;
    state.dirty = false;

    var adv = state.adventures.find(function (a) { return a.adventureId === advId; });
    if (!adv) return;

    $('empty-state').style.display = 'none';
    $('editor-form').style.display = 'block';
    $('form-adventure-title').textContent = 'Adventure ' + adv.adventureNumber + ': ' + adv.adventureTitle;

    var crawl = adv.crawl;
    if (crawl) {
      $('field-intro').value = crawl.intro || '';
      $('field-episode').value = crawl.episode || '';
      $('field-title').value = crawl.title || '';
      renderParagraphs(crawl.body || []);
    } else {
      $('field-intro').value = 'A long time ago in a galaxy far,\nfar away\u2026.';
      $('field-episode').value = 'Episode ' + toRoman(adv.adventureNumber);
      $('field-title').value = adv.adventureTitle.toUpperCase();
      renderParagraphs(['']);
    }

    $('chk-active').checked = (state.activeAdventureId === advId);
    $('field-terms').value = '';

    renderSidebar();
  }

  function renderParagraphs(paras) {
    var container = $('paragraphs-container');
    container.innerHTML = '';

    paras.forEach(function (text, i) {
      addParagraphRow(container, text, i);
    });
  }

  function addParagraphRow(container, text, index) {
    var row = document.createElement('div');
    row.className = 'ce-para-row';

    var num = document.createElement('div');
    num.className = 'ce-para-num';
    num.textContent = (index + 1);

    var textarea = document.createElement('textarea');
    textarea.className = 'ce-para-textarea';
    textarea.value = text || '';
    textarea.placeholder = 'Enter paragraph text...';
    textarea.rows = 3;
    textarea.addEventListener('input', function () { state.dirty = true; });

    var removeBtn = document.createElement('button');
    removeBtn.className = 'ce-para-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove paragraph';
    removeBtn.addEventListener('click', function () {
      row.remove();
      renumberParagraphs();
      state.dirty = true;
    });

    row.appendChild(num);
    row.appendChild(textarea);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }

  function renumberParagraphs() {
    var rows = document.querySelectorAll('.ce-para-row');
    rows.forEach(function (row, i) {
      row.querySelector('.ce-para-num').textContent = (i + 1);
    });
  }

  function gatherFormData() {
    var paras = [];
    document.querySelectorAll('.ce-para-textarea').forEach(function (ta) {
      var text = ta.value.trim();
      if (text) paras.push(text);
    });

    var customTerms = $('field-terms').value;

    return {
      intro: $('field-intro').value.trim() || 'A long time ago in a galaxy far,\nfar away\u2026.',
      episode: $('field-episode').value.trim(),
      title: $('field-title').value.trim().toUpperCase(),
      body: paras.map(function (p) { return autoCapitalize(p, customTerms); })
    };
  }

  function saveCrawl() {
    if (!state.selectedId) return;

    var data = gatherFormData();
    if (!data.episode || !data.title || data.body.length === 0) {
      showToast('Episode, title, and at least one body paragraph are required.', 'error');
      return;
    }

    var saveBtn = $('btn-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    fetch('/api/crawls/' + state.selectedId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Save failed');
        return r.json();
      })
      .then(function (result) {
        state.dirty = false;

        var adv = state.adventures.find(function (a) { return a.adventureId === state.selectedId; });
        if (adv) {
          adv.hasCrawl = true;
          adv.crawl = result.crawl;
        }

        $('field-title').value = result.crawl.title;
        renderParagraphs(result.crawl.body);

        var isActive = $('chk-active').checked;
        if (isActive && state.activeAdventureId !== state.selectedId) {
          return setActiveCrawl(state.selectedId);
        } else if (!isActive && state.activeAdventureId === state.selectedId) {
          return setActiveCrawl('');
        }
      })
      .then(function () {
        showToast('Crawl saved successfully', 'success');
        loadAdventures();
      })
      .catch(function () {
        showToast('Failed to save crawl', 'error');
      })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      });
  }

  function setActiveCrawl(advId) {
    return fetch('/api/crawls/active/set', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adventureId: advId || null })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to set active crawl');
        return r.json();
      })
      .then(function (data) {
        state.activeAdventureId = data.activeAdventureId;
      });
  }

  function previewCrawl() {
    var data = gatherFormData();
    if (!data.episode || !data.title || data.body.length === 0) {
      showToast('Fill in the crawl fields before previewing.', 'error');
      return;
    }

    window.CRAWL_MISSIONS = window.CRAWL_MISSIONS || {};
    window.CRAWL_MISSIONS._preview = {
      intro: data.intro,
      episode: data.episode,
      title: data.title,
      body: data.body
    };

    if (typeof window.launchCrawl === 'function') {
      window.launchCrawl('_preview');
    }
  }

  function toRoman(num) {
    var lookup = [
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    var result = '';
    for (var i = 0; i < lookup.length; i++) {
      while (num >= lookup[i][0]) {
        result += lookup[i][1];
        num -= lookup[i][0];
      }
    }
    return result;
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  $('btn-save').addEventListener('click', saveCrawl);
  $('btn-preview').addEventListener('click', previewCrawl);

  $('btn-add-para').addEventListener('click', function () {
    var container = $('paragraphs-container');
    var count = container.querySelectorAll('.ce-para-row').length;
    addParagraphRow(container, '', count);
    state.dirty = true;
  });

  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  loadAdventures();
}());
