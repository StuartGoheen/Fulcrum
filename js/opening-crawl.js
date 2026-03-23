(function () {
  var activeCrawlAudio = null;
  var activeCrawlOverlay = null;
  var crawlTimers = [];
  var crawlEscHandler = null;
  var crawlResumeClick = null;
  var crawlResumeKey = null;

  function clearCrawlTimers() {
    for (var i = 0; i < crawlTimers.length; i++) {
      clearTimeout(crawlTimers[i]);
    }
    crawlTimers = [];
  }

  function removeEscHandler() {
    if (crawlEscHandler) {
      document.removeEventListener('keydown', crawlEscHandler);
      crawlEscHandler = null;
    }
  }

  function removeResumeHandlers() {
    if (crawlResumeClick) {
      document.removeEventListener('click', crawlResumeClick);
      crawlResumeClick = null;
    }
    if (crawlResumeKey) {
      document.removeEventListener('keydown', crawlResumeKey);
      crawlResumeKey = null;
    }
  }

  function fadeAudioIn(audio, target, durationMs) {
    var steps = 20;
    var interval = durationMs / steps;
    var increment = target / steps;
    var current = 0;
    var timer = setInterval(function () {
      current += increment;
      if (current >= target) {
        audio.volume = target;
        clearInterval(timer);
      } else {
        audio.volume = current;
      }
    }, interval);
    return timer;
  }

  function launchCrawl(missionKey) {
    var mission = window.CRAWL_MISSIONS && window.CRAWL_MISSIONS[missionKey];
    if (!mission) return;

    if (activeCrawlOverlay) dismissCrawl();

    var dismissed = false;
    var fadeInterval = null;

    var overlay = document.createElement('div');
    overlay.className = 'crawl-overlay';
    activeCrawlOverlay = overlay;

    var starfield = document.createElement('div');
    starfield.className = 'crawl-starfield';
    overlay.appendChild(starfield);

    var introEl = document.createElement('div');
    introEl.className = 'crawl-intro';
    introEl.textContent = mission.intro;
    overlay.appendChild(introEl);

    var perspective = document.createElement('div');
    perspective.className = 'crawl-perspective';

    var content = document.createElement('div');
    content.className = 'crawl-content';

    var epEl = document.createElement('p');
    epEl.className = 'crawl-episode';
    epEl.textContent = mission.episode;
    content.appendChild(epEl);

    var titleEl = document.createElement('h2');
    titleEl.className = 'crawl-title';
    titleEl.textContent = mission.title;
    content.appendChild(titleEl);

    mission.body.forEach(function (para) {
      var p = document.createElement('p');
      p.className = 'crawl-body-text';
      p.textContent = para;
      content.appendChild(p);
    });

    perspective.appendChild(content);
    overlay.appendChild(perspective);

    document.body.appendChild(overlay);

    var audio = new Audio('/audio/opening-crawl.mp3');
    audio.volume = 0.05;
    activeCrawlAudio = audio;

    audio.play().then(function () {
      if (!dismissed) fadeInterval = fadeAudioIn(audio, 0.8, 1000);
    }).catch(function () {
      removeResumeHandlers();
      var resumeHandler = function () {
        if (!dismissed && activeCrawlAudio === audio) {
          audio.play().then(function () {
            if (!dismissed) fadeInterval = fadeAudioIn(audio, 0.8, 1000);
          }).catch(function () {});
        }
        removeResumeHandlers();
      };
      crawlResumeClick = resumeHandler;
      crawlResumeKey = resumeHandler;
      document.addEventListener('click', resumeHandler);
      document.addEventListener('keydown', resumeHandler);
    });

    crawlTimers.push(setTimeout(function () {
      if (dismissed) return;
      overlay.classList.add('crawl-overlay--visible');
      introEl.classList.add('crawl-intro--visible');
    }, 50));

    crawlTimers.push(setTimeout(function () {
      if (dismissed) return;
      introEl.classList.add('crawl-intro--fade');
    }, 4500));

    crawlTimers.push(setTimeout(function () {
      if (dismissed) return;
      introEl.style.display = 'none';
      perspective.classList.add('crawl-perspective--active');
    }, 6000));

    var crawlDuration = 65000;
    crawlTimers.push(setTimeout(function () {
      if (dismissed) return;
      dismissCrawl();
    }, crawlDuration + 6000));

    overlay.addEventListener('click', function (e) {
      e.stopPropagation();
      dismissCrawl();
    });

    function handleEsc(e) {
      if (e.key === 'Escape') {
        dismissCrawl();
      }
    }

    removeEscHandler();
    crawlEscHandler = handleEsc;
    document.addEventListener('keydown', handleEsc);

    function dismissCrawl() {
      if (dismissed) return;
      dismissed = true;

      clearCrawlTimers();
      removeEscHandler();
      removeResumeHandlers();
      if (fadeInterval) clearInterval(fadeInterval);

      if (activeCrawlAudio) {
        activeCrawlAudio.pause();
        activeCrawlAudio.currentTime = 0;
        activeCrawlAudio = null;
      }
      if (activeCrawlOverlay) {
        activeCrawlOverlay.classList.add('crawl-overlay--dismiss');
        var el = activeCrawlOverlay;
        activeCrawlOverlay = null;
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 1000);
      }
    }
  }

  window.launchCrawl = launchCrawl;
}());
