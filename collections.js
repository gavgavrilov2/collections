(function() {
  'use strict';

  var PLUGIN_NAME = 'Мои Коллекции';
  var STORAGE_KEY = 'my_collections';
  var PROGRESS_KEY = 'mc_watch_progress';
  var VIEWED_KEY = 'mc_last_viewed';
  var ACTIVE_TAB_KEY = 'mc_active_tab';
  var ACTIVE_FILTER_KEY = 'mc_active_filter';
  var DEFAULT_COLLECTIONS = {
    watched:     { name: 'Посмотрел',       icon: '\u25B6', movies: [], isDefault: true },
    will_watch:  { name: 'Буду смотреть',   icon: '\u23F8', movies: [], isDefault: true },
    want_watch:  { name: 'Хочу посмотреть', icon: '\u2B50', movies: [], isDefault: true },
    later:       { name: 'Потом',           icon: '\u23F0', movies: [], isDefault: true },
    favorite:    { name: 'Избранное',       icon: '\u2764', movies: [], isDefault: true }
  };

  var TYPE_TABS = [
    { id: 'all',     label: 'Все',         icon: '\uD83D\uDCE6' },
    { id: 'movie',   label: 'Фильмы',      icon: '\uD83C\uDFAC' },
    { id: 'tv',      label: 'Сериалы',     icon: '\uD83D\uDCFA' },
    { id: 'cartoon', label: 'Мультфильмы', icon: '\uD83C\uDFA8' },
    { id: 'fav',     label: 'Избранное',   icon: '\u2764\uFE0F' }
  ];

  var TV_SCALE_KEY = 'mc_tv_scale';
  var TV_SCALE_PRESETS = {
    compact: 0.85,
    normal: 1.0,
    large: 1.15,
    xlarge: 1.2
  };

  var MIGRATION_KEY = 'mc_migration_timeline';
  var _collectionsCache = null;
  var _headBtns = [];
  var _headDefaultsHidden = [];
  var _headTitleOrig = '';

  /* isTv() — helpers для определения TV-платформы */

  // ========== Timeline Hash Helpers ==========

  function tlHash(str) {
    if (typeof Lampa !== 'undefined' && Lampa.Utils && typeof Lampa.Utils.hash === 'function') {
      return Lampa.Utils.hash(str);
    }
    return '';
  }

  function getMovieHash(card) {
    return tlHash(card.original_title || card.original_name || '');
  }

  function getEpisodeHash(card, season, episode) {
    var s = parseInt(season, 10) || 0;
    var e = parseInt(episode, 10) || 0;
    return tlHash([s, s > 10 ? ':' : '', e, card.original_title || card.original_name].join(''));
  }

  /* Scaling — em-based, matching Lampa's body.fontSize system.
     Card dimensions computed in px (for scrollBy), then converted to em for CSS.
     tvScale multiplier affects card size/count (user preference for density). */

  function getTvScaleSetting() {
    try {
      var v = localStorage.getItem(TV_SCALE_KEY);
      if (v && TV_SCALE_PRESETS[v] !== undefined) return TV_SCALE_PRESETS[v];
    } catch(e) {}
    return TV_SCALE_PRESETS.large;
  }

  function isTv() {
    return typeof Lampa !== 'undefined' && Lampa.Platform && Lampa.Platform.screen('tv');
  }

  function getBodyFontSize() {
    return parseFloat(getComputedStyle(document.body).fontSize) || 22.8;
  }

  function getTvGap() {
    var s = getTvScaleSetting();
    var w = window.innerWidth || 1920;
    var base;
    if (w <= 1280) base = 20;
    else if (w <= 1920) base = 28;
    else base = 36;
    return Math.round(base * s);
  }

  function getCardW() {
    var w = window.innerWidth || 1920;
    if (isTv()) {
      var ts = getTvScaleSetting();
      var pad = 72;
      var gap = getTvGap();
      var minCard = Math.round(320 * ts);
      var count = Math.floor((w - pad) / (minCard + gap));
      if (count < 4) count = 4;
      if (count > 8) count = 8;
      return Math.floor((w - pad - gap * (count - 1)) / count);
    }
    var scale = w / 1920;
    if (scale < 0.78) scale = 0.78;
    if (scale > 1.30) scale = 1.30;
    return Math.round(190 * scale);
  }

  function getCardH() { return Math.round(getCardW() * 1.5); }
  function getLandscapeW() { return Math.round(getCardW() * 2); }
  function getLandscapeH() { return Math.round(getLandscapeW() * 0.56); }

  function getCollections() {
    if (_collectionsCache) return _collectionsCache;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && typeof d === 'object' && d.watched && d.watched.movies) {
          _collectionsCache = d;
          return d;
        }
      }
    } catch(e) {}
    try {
      var s = Lampa.Storage.get(STORAGE_KEY);
      if (s && typeof s === 'object' && s.watched && s.watched.movies) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        _collectionsCache = s;
        return s;
      }
    } catch(e) {}
    var data = JSON.parse(JSON.stringify(DEFAULT_COLLECTIONS));
    saveCollections(data);
    return data;
  }

  function saveCollections(data) {
    _collectionsCache = data;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
    try { Lampa.Storage.set(STORAGE_KEY, data); } catch(e) {}
  }

  function isInCollection(collectionId, movieId) {
    var col = getCollections()[collectionId];
    if (!col || !col.movies) return false;
    for (var i = 0; i < col.movies.length; i++) {
      if (col.movies[i].id === movieId) return true;
    }
    return false;
  }

  function isMovieInAnyCollection(movieId) {
    var cols = getCollections();
    var k = Object.keys(cols);
    for (var i = 0; i < k.length; i++) {
      if (isInCollection(k[i], movieId)) return true;
    }
    return false;
  }

  function detectMediaType(movie) {
    var mt = String(movie.media_type || '').toLowerCase();
    var t = String(movie.type || '').toLowerCase();
    if (mt === 'movie' || t === 'movie') return 'movie';
    if (mt === 'tv' || mt === 'show' || mt === 'tvshows' || t === 'tv') return 'tv';
    if (movie.number_of_seasons || movie.number_of_episodes) return 'tv';
    if (movie.first_air_date && !movie.release_date) return 'tv';
    return 'movie';
  }

  function detectCategory(movie) {
    if (isAnimation(movie)) return 'cartoon';
    return detectMediaType(movie);
  }

  function isAnimation(movie) {
    var ids = movie.genre_ids || [];
    for (var i = 0; i < ids.length; i++) { if (Number(ids[i]) === 16) return true; }
    var genres = movie.genres || [];
    for (var i = 0; i < genres.length; i++) {
      if (Number(genres[i].id) === 16) return true;
      var name = String(genres[i].name || '').toLowerCase();
      if (name === 'animation' || name === '\u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044F') return true;
    }
    return false;
  }

  function detectSubtype(movie) {
    return isAnimation(movie) ? 'cartoon' : '';
  }

  function normalizeSavedMovie(movie) {
    movie.category = detectCategory(movie);
    movie.media_type = detectMediaType(movie);
    movie.subtype = detectSubtype(movie);
    return movie;
  }

  function getAllMovies() {
    var cols = getCollections();
    var all = [], seen = {};
    var k = Object.keys(cols);
    for (var i = 0; i < k.length; i++) {
      var m = cols[k[i]].movies || [];
      for (var j = 0; j < m.length; j++) {
        if (!seen[m[j].id]) {
          seen[m[j].id] = true;
          normalizeSavedMovie(m[j]);
          all.push(m[j]);
        }
      }
    }
    return all;
  }

  function getMoviesByCategory(cat) {
    var all = getAllMovies();
    if (cat === 'all') return all;
    if (cat === 'movie') return all.filter(function(m) { return m.category === 'movie'; });
    if (cat === 'tv') return all.filter(function(m) { return m.category === 'tv'; });
    if (cat === 'cartoon') return all.filter(function(m) { return m.category === 'cartoon'; });
    if (cat === 'fav') return all.filter(function(m) { return isInCollection('favorite', m.id); });
    return all;
  }

  function posterUrl(movie) {
    var p = movie.poster_path || '';
    if (p && !p.startsWith('http')) p = 'https://image.tmdb.org/t/p/w300' + p;
    return p;
  }

  function backdropUrl(movie) {
    var p = movie.backdrop_path || movie.poster_path || '';
    if (p && !p.startsWith('http')) p = 'https://image.tmdb.org/t/p/w780' + p;
    return p;
  }

  function getYear(movie) {
    return (movie.release_date || movie.first_air_date || '').substring(0, 4) || '';
  }

  function addToCollection(collectionId, movie) {
    var cols = getCollections();
    var col = cols[collectionId];
    if (!col) return false;
    for (var i = 0; i < col.movies.length; i++) {
      if (col.movies[i].id === movie.id) return false;
    }
    var mt = detectMediaType(movie);
    col.movies.push({
      id: movie.id || 0,
      title: movie.title || movie.name || '',
      name: movie.name || movie.title || '',
      original_title: movie.original_title || '',
      original_name: movie.original_name || '',
      poster_path: movie.poster_path || '',
      backdrop_path: movie.backdrop_path || '',
      release_date: movie.release_date || movie.first_air_date || '',
      first_air_date: movie.first_air_date || '',
      vote_average: movie.vote_average || 0,
      vote_count: movie.vote_count || 0,
      overview: movie.overview || '',
      genre_ids: (function() {
        if (movie.genre_ids && movie.genre_ids.length) return movie.genre_ids;
        if (movie.genres && movie.genres.length) return movie.genres.map(function(g) { return g.id || 0; });
        return [];
      })(),
      media_type: mt,
      category: detectCategory(movie),
      subtype: detectSubtype(movie),
      original_language: movie.original_language || '',
      tmdb_id: movie.id || movie.tmdb_id || 0,
      imdb_id: movie.imdb_id || '',
      kinopoisk_id: movie.kinopoisk_id || '',
      added_at: Date.now(),
      source: movie.source || 'tmdb'
    });
    saveCollections(cols);
    return true;
  }

  function removeFromCollection(collectionId, movieId) {
    var cols = getCollections();
    var col = cols[collectionId];
    if (!col) return false;
    var found = false;
    col.movies = col.movies.filter(function(m) { if (m.id === movieId) { found = true; return false; } return true; });
    if (found) saveCollections(cols);
    return found;
  }

  function deleteCollection(collectionId) {
    var cols = getCollections();
    if (cols[collectionId] && cols[collectionId].isDefault) return false;
    delete cols[collectionId];
    saveCollections(cols);
    return true;
  }

  function renameCollection(id, newName) {
    var cols = getCollections();
    if (!cols[id]) return false;
    cols[id].name = newName;
    saveCollections(cols);
    Lampa.Noty.show('\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u043E: \u00AB' + newName + '\u00BB');
    return true;
  }

  function createAndAdd(name, icon, movie) {
    var cols = getCollections();
    var newId = 'custom_' + Date.now();
    cols[newId] = { name: name, icon: icon || '\uD83D\uDCC1', movies: [] };
    saveCollections(cols);
    if (movie && movie.id) addToCollection(newId, movie);
    Lampa.Noty.show('\u0421\u043E\u0437\u0434\u0430\u043D\u043E: \u00AB' + name + '\u00BB');
    refreshCardButton();
  }

  function refreshCardButton() {
    var btn = $('.button--collection');
    if (!btn.length) return;
    btn.each(function() {
      var el = $(this);
      var mid = el.data('mid');
      if (mid !== undefined) {
        var inAny = isMovieInAnyCollection(mid);
        el.toggleClass('button--collection-active', !!inAny);
        el.find('span').text(PLUGIN_NAME + (inAny ? ' \u2713' : ''));
      }
    });
  }

  // ========== Tracking (Timeline) ==========

  function hasTimeline() {
    return typeof Lampa !== 'undefined' && Lampa.Timeline && typeof Lampa.Timeline.update === 'function';
  }

  function updateProgress(movieId, info) {
    if (!hasTimeline()) return;
    var card = { original_title: info.original_title || '', original_name: info.original_name || '' };
    var hash;
    if (info.season && info.episode) {
      hash = getEpisodeHash(card, info.season, info.episode);
    } else {
      hash = getMovieHash(card);
    }
    if (!hash) return;
    var percent = info.duration > 0 ? Math.floor((info.time / info.duration) * 100) : 0;
    Lampa.Timeline.update({ hash: hash, percent: percent, time: info.time || 0, duration: info.duration || 0 });
  }

  function markViewed(movieId, movie) {
    if (!hasTimeline()) return;
    var hash = getMovieHash(movie);
    if (!hash) return;
    Lampa.Timeline.update({ hash: hash, percent: 100, time: 0, duration: 0 });
  }

  function getMovieProgress(card) {
    if (!hasTimeline()) return { percent: 0, time: 0, duration: 0 };
    var hash = getMovieHash(card);
    if (!hash) return { percent: 0, time: 0, duration: 0 };
    var data = Lampa.Timeline.view(hash);
    return { percent: data.percent || 0, time: data.time || 0, duration: data.duration || 0 };
  }

  function getEpisodeProgress(card, season, episode) {
    if (!hasTimeline()) return { percent: 0, time: 0, duration: 0 };
    var hash = getEpisodeHash(card, season, episode);
    if (!hash) return { percent: 0, time: 0, duration: 0 };
    var data = Lampa.Timeline.view(hash);
    return { percent: data.percent || 0, time: data.time || 0, duration: data.duration || 0 };
  }

  function getLastWatchedEpisode(card) {
    if (!card || !card.original_title) return null;
    try {
      var hash = tlHash(card.original_title);
      var watched = Lampa.Storage.cache('online_watched_last', 5000, {});
      var entry = watched[hash];
      if (entry && entry.season && entry.episode) {
        return { season: entry.season, episode: entry.episode };
      }
    } catch(e) {}
    return null;
  }

  function getSeriesProgress(card) {
    if (!hasTimeline()) return null;
    var last = getLastWatchedEpisode(card);
    if (last) {
      var hash = getEpisodeHash(card, last.season, last.episode);
      var data = Lampa.Timeline.view(hash);
      if (data && data.percent > 0) {
        return {
          season: last.season,
          episode: last.episode,
          percent: data.percent,
          time: data.time || 0,
          duration: data.duration || 0
        };
      }
    }
    var episodes = [];
    try {
      if (typeof Lampa !== 'undefined' && Lampa.TimeTable) {
        episodes = Lampa.TimeTable.get(card) || [];
      }
    } catch(e) {}
    var best = null;
    var bestKey = 0;
    for (var i = 0; i < episodes.length; i++) {
      var ep = episodes[i];
      if (!ep || !ep.season_number || !ep.episode_number) continue;
      var h = getEpisodeHash(card, ep.season_number, ep.episode_number);
      var d = Lampa.Timeline.view(h);
      if (d && d.percent > 0 && d.percent < 95) {
        var key = (parseInt(ep.season_number, 10) || 0) * 100000 + (parseInt(ep.episode_number, 10) || 0);
        if (key > bestKey) {
          bestKey = key;
          best = {
            season: ep.season_number,
            episode: ep.episode_number,
            percent: d.percent,
            time: d.time || 0,
            duration: d.duration || 0
          };
        }
      }
    }
    return best;
  }

  function isMovieViewed(movieId, movie) {
    if (!hasTimeline()) return false;
    var isSeries = movie.category === 'tv' || detectMediaType(movie) === 'tv';
    if (isSeries) {
      if (typeof Lampa !== 'undefined' && Lampa.Timeline && typeof Lampa.Timeline.watched === 'function') {
        var count = Lampa.Timeline.watched(movie);
        return count > 0;
      }
      return false;
    }
    var hash = getMovieHash(movie);
    if (!hash) return false;
    var data = Lampa.Timeline.view(hash);
    return data.percent >= 95;
  }

  function getContinueWatching() {
    var all = getAllMovies();
    var items = [];
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (!m || !m.id) continue;
      var isSeries = m.category === 'tv' || detectMediaType(m) === 'tv';
      if (isSeries) {
        var progress = getSeriesProgress(m);
        if (progress && progress.percent > 0 && progress.percent < 95 && progress.duration > 0 && progress.time > 0) {
          items.push({
            movie: m,
            progress: {
              time: progress.time,
              duration: progress.duration,
              season: String(progress.season),
              episode: String(progress.episode),
              updated: Date.now()
            },
            percent: progress.percent,
            left: Math.ceil((progress.duration - progress.time) / 60)
          });
        }
      } else {
        var movieProgress = getMovieProgress(m);
        if (movieProgress.percent > 0 && movieProgress.percent < 95 && movieProgress.duration > 0 && movieProgress.time > 0) {
          items.push({
            movie: m,
            progress: {
              time: movieProgress.time,
              duration: movieProgress.duration,
              season: '',
              episode: '',
              updated: Date.now()
            },
            percent: movieProgress.percent,
            left: Math.ceil((movieProgress.duration - movieProgress.time) / 60)
          });
        }
      }
    }
    items.sort(function(a, b) { return (b.progress.updated || 0) - (a.progress.updated || 0); });
    return items.slice(0, 12);
  }

  function getViewedFromTimeline() {
    var result = [];
    var all = getAllMovies();
    for (var i = 0; i < all.length; i++) {
      var m = all[i];
      if (!m || !m.id) continue;
      var isSeries = m.category === 'tv' || detectMediaType(m) === 'tv';
      if (isSeries) {
        if (typeof Lampa !== 'undefined' && Lampa.Timeline && typeof Lampa.Timeline.watched === 'function') {
          var count = Lampa.Timeline.watched(m);
          if (count > 0) result.push(m);
        }
      } else {
        if (isMovieViewed(m.id, m)) {
          result.push(m);
        }
      }
    }
    return result;
  }

  function getCustomCollections() {
    var cols = getCollections();
    var result = [];
    var keys = Object.keys(cols);
    for (var i = 0; i < keys.length; i++) {
      if (!cols[keys[i]].isDefault) {
        var movies = cols[keys[i]].movies || [];
        var poster = '';
        for (var j = 0; j < movies.length; j++) {
          if (movies[j].poster_path) { poster = posterUrl(movies[j]); break; }
          if (movies[j].backdrop_path) { poster = backdropUrl(movies[j]); break; }
        }
        result.push({
          id: keys[i],
          name: cols[keys[i]].name,
          count: movies.length,
          poster: poster,
          _isFolder: true
        });
      }
    }
    return result;
  }



  // ========== Migration ==========

  function migrateToTimeline() {
    if (!hasTimeline()) return;
    if (localStorage.getItem(MIGRATION_KEY)) return;
    try {
      var oldProgress = {};
      try { oldProgress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch(e) {}
      var oldViewed = {};
      try { oldViewed = JSON.parse(localStorage.getItem(VIEWED_KEY) || '{}'); } catch(e) {}
      var migrated = 0;
      var skipped = 0;
      Object.keys(oldProgress).forEach(function(movieId) {
        var p = oldProgress[movieId];
        if (!p) return;
        var card = { original_title: p.original_title || p.title || '', original_name: p.original_name || p.name || '' };
        var hash;
        if (p.season && p.episode) {
          hash = getEpisodeHash(card, p.season, p.episode);
        } else {
          hash = getMovieHash(card);
        }
        if (!hash) { skipped++; return; }
        var percent = p.duration > 0 ? Math.floor((p.time / p.duration) * 100) : 0;
        Lampa.Timeline.update({ hash: hash, percent: percent, time: p.time || 0, duration: p.duration || 0 });
        migrated++;
      });
      Object.keys(oldViewed).forEach(function(movieId) {
        var v = oldViewed[movieId];
        if (!v) return;
        var card = { original_title: v.original_title || '', original_name: v.original_name || '' };
        var hash = getMovieHash(card);
        if (!hash) { skipped++; return; }
        Lampa.Timeline.update({ hash: hash, percent: 100, time: 0, duration: 0 });
        migrated++;
      });
      localStorage.setItem(MIGRATION_KEY, JSON.stringify({ migrated: migrated, skipped: skipped, date: Date.now() }));
    } catch(e) {}
  }

  // ========== Init ==========

  function initTracking() {
    if (typeof Lampa.Listener !== 'undefined') {
      Lampa.Listener.follow('full', function(e) {
        if (e.type === 'complite' || e.type === 'start') {
          var movie = e.card || (e.data && e.data.movie);
          if (movie && movie.id) markViewed(movie.id, movie);
        }
      });
    }
    try {
      if (Lampa.Player && Lampa.Player.listener) {
        Lampa.Player.listener.follow('video', function(e) {
          if (e.type === 'timeupdate' && e.data) {
            var active = Lampa.Activity.active();
            if (active) {
              var movie = active.card || (active.data && active.data.movie);
              if (movie && movie.id) {
                updateProgress(movie.id, {
                  time: e.data.time || 0,
                  duration: e.data.duration || 0,
                  episode: e.data.episode || '',
                  season: e.data.season || '',
                  original_title: movie.original_title || '',
                  original_name: movie.original_name || ''
                });
              }
            }
          }
        });
      }
    } catch(e) {}
  }

  // ========== CSS Variables ==========

  var _resizeTimer = null;

  function updateSizes() {
    var fs = getBodyFontSize();
    var r = document.documentElement;
    r.style.setProperty('--mc-cw',  (getCardW() / fs).toFixed(3) + 'em');
    r.style.setProperty('--mc-ch',  (getCardH() / fs).toFixed(3) + 'em');
    r.style.setProperty('--mc-lw',  (getLandscapeW() / fs).toFixed(3) + 'em');
    r.style.setProperty('--mc-lh',  (getLandscapeH() / fs).toFixed(3) + 'em');
    r.style.setProperty('--mc-gap', (getTvGap() / fs).toFixed(3) + 'em');
    r.classList.toggle('mc-root', true);
    r.classList.toggle('tv', isTv());
  }

  function onResize() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(function() {
      updateSizes();
      var active = Lampa.Activity.active();
      if (active && active.component === 'mc_main') {
        try { openCollectionsPage(); } catch(e) {}
      }
    }, 300);
  }

  function loadCss() {
    if (document.getElementById('mc-css')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.id = 'mc-css';
    var scripts = document.querySelectorAll('script[src*="collections.js"]');
    var base = '';
    if (scripts.length) {
      var src = scripts[scripts.length - 1].src;
      base = src.replace(/collections\.js.*$/, '');
    } else if (typeof Lampa !== 'undefined' && Lampa.Manifest && Lampa.Manifest.path) {
      base = Lampa.Manifest.path;
    }
    link.href = base + 'collections.css';
    link.onerror = function() {
      console.warn('[Мои Коллекции] collections.css not found, styles may be missing');
    };
    document.head.appendChild(link);
  }

  // ========== Plugin ==========

  function startPlugin() {
    if (window._my_collections_plugin) return;
    window._my_collections_plugin = true;
    loadCss();
    updateSizes();
    window.addEventListener('resize', onResize);

    Lampa.Manifest.plugins = {
      type: 'video', version: '2.1.1', name: PLUGIN_NAME,
      description: '\u0417\u0430\u043A\u043B\u0430\u0434\u043A\u0438 \u0438 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438',
      component: 'my_collections',
      onContextMenu: function(){ return { name: PLUGIN_NAME, description: '' }; },
      onContextLauch: function(obj){ showAddToCollectionDialog(obj); }
    };

    addMenuButton();
    initListener();
    initTracking();
    migrateToTimeline();
  }

  function addMenuButton() {
    setTimeout(function() {
      var menuList = document.querySelector('.menu__list');
      if (!menuList || document.querySelector('.my-collections-menu-item')) return;
      var item = document.createElement('div');
      item.className = 'menu__item selector my-collections-menu-item';
      item.innerHTML = '<div class="menu__item-text" style="font-size:18px;font-weight:600;">' + PLUGIN_NAME + '</div>';
      item.addEventListener('hover:enter', function(){ openCollectionsPage(); });
      menuList.appendChild(item);
    }, 2000);
  }

  function initListener() {
    if (typeof Lampa.Listener !== 'undefined') {
      Lampa.Listener.follow('full', function(e) {
        if (e.type === 'build' && e.name === 'start' && e.item && e.item.html) {
          addCollectionButton(e.item.html, e.item.card);
        }
      });
    }
  }

  // ========== Popup (shared for Add-to-Collection & Filter) ==========

  function safeBack() {}

  var _popupController = null;
  var _prevController = null;

  function closeMcPopup() {
    var el = document.querySelector('.mc-popup');
    if (el) el.remove();
    if (_popupController) {
      try { Lampa.Controller.remove('mc_popup'); } catch(e) {}
      _popupController = null;
    }
    if (_prevController) {
      try { Lampa.Controller.toggle(_prevController); } catch(e) {}
      _prevController = null;
    }
  }

  function showMcPopup(opts) {
    closeMcPopup();

    var items = opts.items;
    var titleText = opts.title;
    var focusIdx = opts.focusIdx || 0;

    var overlay = document.createElement('div');
    overlay.className = 'mc-popup';

    var box = document.createElement('div');
    box.className = 'mc-popup__box';

    var head = document.createElement('div');
    head.className = 'mc-popup__head';
    var titleEl = document.createElement('div');
    titleEl.className = 'mc-popup__title';
    titleEl.textContent = titleText;
    head.appendChild(titleEl);
    box.appendChild(head);

    var list = document.createElement('div');
    list.className = 'mc-popup__list';

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var item = document.createElement('div');
      item.className = 'mc-popup__item selector' + (it.className ? ' ' + it.className : '') + (i === focusIdx ? ' focus' : '');
      item.setAttribute('data-idx', i);

      if (it.name !== undefined) {
        var nameEl = document.createElement('span');
        nameEl.className = 'mc-popup__item-name';
        nameEl.textContent = it.name;
        item.appendChild(nameEl);
      }
      if (it.html) {
        var tmp = document.createElement('span');
        tmp.innerHTML = it.html;
        while (tmp.firstChild) item.appendChild(tmp.firstChild);
      }
      if (it.count !== undefined) {
        var countEl = document.createElement('span');
        countEl.className = 'mc-popup__item-count';
        countEl.textContent = it.count;
        item.appendChild(countEl);
      }
      if (it.checkbox !== undefined) {
        var cb = document.createElement('div');
        cb.className = 'mc-popup__cb' + (it.checkbox ? ' on' : '');
        cb.innerHTML = '<svg viewBox="0 0 16 16"><polyline points="3 8 7 12 13 4"/></svg>';
        item.appendChild(cb);
      }
      list.appendChild(item);

      (function(el, idx) {
        el.addEventListener('hover:enter', function() { focusIdx = idx; updateFocus(); selectItem(idx); });
      })(item, i);
    }

    box.appendChild(list);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function updateFocus() {
      var els = list.querySelectorAll('.mc-popup__item');
      for (var j = 0; j < els.length; j++) {
        els[j].classList.toggle('focus', j === focusIdx);
      }
      if (els[focusIdx]) {
        els[focusIdx].scrollIntoView({ block: 'nearest' });
      }
    }

    function selectItem(idx) {
      if (idx >= 0 && idx < items.length && items[idx].onSelect) {
        items[idx].onSelect();
      }
    }

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeMcPopup();
    });

    _prevController = opts.prevController || 'mc_main';
    _popupController = true;

    Lampa.Controller.add('mc_popup', {
      toggle: function() {
        Lampa.Controller.collectionSet(list, list);
        Lampa.Controller.collectionFocus(false, list);
      },
      up: function() {
        if (focusIdx > 0) { focusIdx--; updateFocus(); }
      },
      down: function() {
        var max = items.length - 1;
        if (focusIdx < max) { focusIdx++; updateFocus(); }
      },
      right: function() {},
      left: function() {},
      enter: function() { selectItem(focusIdx); },
      back: function() { closeMcPopup(); }
    });

    Lampa.Controller.toggle('mc_popup');
  }

  // ========== Add Dialog ==========

  function showAddToCollectionDialog(movie) {
    var collections = getCollections();
    var keys = Object.keys(collections);

    var items = [];
    for (var i = 0; i < keys.length; i++) {
      (function(key, idx) {
        var col = collections[key];
        var inCol = isInCollection(key, movie.id);
        items.push({
          name: col.name,
          count: (col.movies || []).length,
          checkbox: inCol,
          onSelect: function() {
            if (isInCollection(key, movie.id)) {
              removeFromCollection(key, movie.id);
              Lampa.Noty.show('\u0423\u0431\u0440\u0430\u043D\u043E \u0438\u0437 \u00AB' + col.name + '\u00BB');
            } else {
              addToCollection(key, movie);
              Lampa.Noty.show('\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u00AB' + col.name + '\u00BB');
            }
            _collectionsCache = null;
            collections = getCollections();
            refreshCardButton();
            var popupList = document.querySelector('.mc-popup__list');
            if (popupList && popupList.children[idx]) {
              var cb = popupList.children[idx].querySelector('.mc-popup__cb');
              if (cb) cb.classList.toggle('on');
              var countEl = popupList.children[idx].querySelector('.mc-popup__item-count');
              if (countEl) countEl.textContent = (getCollections()[key] || {}).movies ? (getCollections()[key].movies || []).length : 0;
            }
          }
        });
      })(keys[i], i);
    }

    items.push({
      className: 'mc-popup__create',
      html: '<span style="font-size:1em;color:#3bd574;">+</span><span class="mc-popup__create-text">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E</span>',
      onSelect: function() {
        closeMcPopup();
        showCreateCollectionDialog(movie);
      }
    });

    showMcPopup({ title: movie.title || movie.name || PLUGIN_NAME, items: items, prevController: 'content' });
  }

  function showCreateCollectionDialog(movie) {
    var names = [
      '\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435', '\u041A\u043E\u043C\u0435\u0434\u0438\u0438', '\u0423\u0436\u0430\u0441\u044B', '\u0424\u0430\u043D\u0442\u0430\u0441\u0442\u0438\u043A\u0430',
      '\u041C\u0435\u043B\u043E\u0434\u0440\u0430\u043C\u044B', '\u0411\u043E\u0435\u0432\u0438\u043A\u0438', '\u0414\u0435\u0442\u0435\u043A\u0442\u0438\u0432\u044B', '\u0414\u0440\u0430\u043C\u044B',
      '\u041C\u044E\u0437\u0438\u043A\u043B\u044B', '\u0418\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435', '\u0412\u043E\u0435\u043D\u043D\u044B\u0435', '\u041A\u0440\u0438\u043C\u0438\u043D\u0430\u043B',
      '\u0417\u0430\u0433\u0430\u0434\u043A\u0438', '\u0421\u0435\u043C\u0435\u0439\u043D\u044B\u0435', '\u0414\u0435\u0442\u0441\u043A\u0438\u0435'
    ];
    var items = names.map(function(n) {
      return { name: n, onSelect: function() { createAndAdd(n, '', movie); closeMcPopup(); showAddToCollectionDialog(movie); } };
    });
    showMcPopup({ title: '\u041D\u043E\u0432\u0430\u044F \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F', items: items, prevController: 'content' });
  }

  function showCreateFolderDialog() {
    var names = [
      '\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435', '\u041A\u043E\u043C\u0435\u0434\u0438\u0438', '\u0423\u0436\u0430\u0441\u044B', '\u0424\u0430\u043D\u0442\u0430\u0441\u0442\u0438\u043A\u0430',
      '\u041C\u0435\u043B\u043E\u0434\u0440\u0430\u043C\u044B', '\u0411\u043E\u0435\u0432\u0438\u043A\u0438', '\u0414\u0435\u0442\u0435\u043A\u0442\u0438\u0432\u044B', '\u0414\u0440\u0430\u043C\u044B',
      '\u041C\u044E\u0437\u044B\u043A\u043B\u044B', '\u0418\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435', '\u0412\u043E\u0435\u043D\u043D\u044B\u0435', '\u041A\u0440\u0438\u043C\u0438\u043D\u0430\u043B',
      '\u0417\u0430\u0433\u0430\u0434\u043A\u0438', '\u0421\u0435\u043C\u0435\u0439\u043D\u044B\u0435', '\u0414\u0435\u0442\u0441\u043A\u0438\u0435'
    ];
    var items = names.map(function(n) {
      return {
        name: n,
        onSelect: function() {
          var cols = getCollections();
          var newId = 'custom_' + Date.now();
          cols[newId] = { name: n, icon: '\uD83D\uDCC1', movies: [] };
          saveCollections(cols);
          Lampa.Noty.show('\u0421\u043E\u0437\u0434\u0430\u043D\u043E: \u00AB' + n + '\u00BB');
          closeMcPopup();
          viewingFolderId = newId;
          renderPage();
          setTimeout(function() {
            if (sections.length > 0) activateSection(0);
          }, 100);
        }
      };
    });
    showMcPopup({ title: '\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0430\u043F\u043A\u0443', items: items, prevController: 'content' });
  }

  // ========== Scroll ==========

  function enableWheelScroll(el) {
    if (!el || !el.addEventListener) return;
    el.addEventListener('wheel', function(e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.scrollLeft += e.deltaY; }
    }, { passive: false });
  }

  function scrollRow(row, dir) {
    if (!row) return;
    row.scrollBy({ left: dir * getLandscapeW() * 1.1, behavior: 'smooth' });
  }

  // ========== Head Lifecycle ==========

  function customizeHead() {
    if (typeof Lampa.Head === 'undefined') return;

    var titleEl = document.querySelector('.head__title');
    _headTitleOrig = titleEl ? titleEl.textContent : '';
    Lampa.Head.title('');

    var toHide = document.querySelectorAll(
      '.head__action.open--premium, .head__action.open--feed, .head__action.open--profile, ' +
      '.head__action.open--broadcast, .head__action.notice--icon, .head__action.full--screen, ' +
      '.head__logo-icon'
    );
    for (var i = 0; i < toHide.length; i++) {
      if (toHide[i].style.display !== 'none') {
        toHide[i].style.display = 'none';
        _headDefaultsHidden.push(toHide[i]);
      }
    }

    var menuIcon = document.querySelector('.head__menu-icon');
    if (menuIcon) {
      menuIcon.style.display = 'flex';
    }

    if (_headBtns.length === 0) {
      var svgFilter = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>';

      _headBtns.push(Lampa.Head.addIcon(svgFilter, function() { showFilterDialog(); }));
    }
  }

  function restoreHead() {
    if (typeof Lampa.Head === 'undefined') return;
    for (var i = 0; i < _headBtns.length; i++) {
      try { _headBtns[i].remove(); } catch(e) {}
    }
    _headBtns = [];
    for (var i = 0; i < _headDefaultsHidden.length; i++) {
      _headDefaultsHidden[i].style.display = '';
    }
    _headDefaultsHidden = [];
    var menuIcon = document.querySelector('.head__menu-icon');
    if (menuIcon) menuIcon.style.display = '';
    Lampa.Head.title(_headTitleOrig);
  }

  // ========== Main Page ==========

  function removeMcBackground() {
    var old = document.querySelector('.mc-bg');
    if (old) old.remove();
    document.body.classList.remove('mc-active');
    restoreHead();
  }

  function createMcBackground() {
    removeMcBackground();
    var bg = document.createElement('div');
    bg.className = 'mc-bg';
    document.body.appendChild(bg);
    document.body.classList.add('mc-active');
  }

  function openCollectionsPage() {
    var activeTab = localStorage.getItem(ACTIVE_TAB_KEY) || 'all';
    var activeFilter = localStorage.getItem(ACTIVE_FILTER_KEY) || 'all';

    removeMcBackground();

    var scroll = new Lampa.Scroll({ mask: true, over: true });
    scroll.body().addClass('mc-page');

    var scrollEl = scroll.render(true);
    var vh = window.innerHeight;
    try { if (Lampa.DeviceResCheck && Lampa.DeviceResCheck.mode) { vh = Lampa.DeviceResCheck.mode.height; } } catch(e) {}
    scrollEl.style.height = vh + 'px';

    var contentEl = $('<div></div>');
    scroll.append(contentEl);

    createMcBackground();

    var sections = [];
    var activeSection = -1;
    var currentCtrl = 'tabs';
    var tabsEl = null;
    var viewingFolderId = null;
    var folderMenuClicked = false;

    function renderPage() {
      contentEl.empty();
      sections = [];
      activeSection = -1;

      if (viewingFolderId) {
        renderFolderContent();
        bindTabEvents(tabsEl);
        try { scroll.update(contentEl, true); } catch(e) {}
        activateTabs();
        return;
      }

      var continueWatching = getContinueWatching();
      if (activeTab !== 'all') continueWatching = continueWatching.filter(function(i) { return detectCategory(i.movie) === activeTab; });

      /* Tabs */
      tabsEl = $('<div class="mc-tabs"></div>');
      for (var t = 0; t < TYPE_TABS.length; t++) {
        var tab = TYPE_TABS[t];
        var count = getMoviesByCategory(tab.id).length;
        tabsEl.append($('<div class="mc-tab selector' + (activeTab === tab.id ? ' active' : '') + '" data-tab="' + tab.id + '"><span class="mc-tab__icon">' + tab.icon + '</span><span class="mc-tab__label">' + tab.label + '</span><span class="mc-tab__count">' + count + '</span></div>'));
      }

      var customCols = getCustomCollections();
      for (var c = 0; c < customCols.length; c++) {
        (function(col) {
          var isActive = (viewingFolderId === col.id);
          var folderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
          tabsEl.append($('<div class="mc-tab selector' + (isActive ? ' active' : '') + '" data-folder-tab="' + col.id + '"><span class="mc-tab__icon">' + folderSvg + '</span><span class="mc-tab__label">' + col.name + '</span><span class="mc-tab__count">' + col.count + '</span></div>'));
        })(customCols[c]);
      }

      tabsEl.append($('<div class="mc-tab selector" data-create-folder="true"><span class="mc-tab__icon">+</span><span class="mc-tab__label">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0430\u043F\u043A\u0443</span></div>'));

      if (isTv()) {
        var scaleNames = { compact: '\u041A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u044B\u0439', normal: '\u041E\u0431\u044B\u0447\u043D\u044B\u0439', large: '\u041A\u0440\u0443\u043F\u043D\u044B\u0439', xlarge: '\u041E\u0447\u0435\u043D\u044C \u043A\u0440\u0443\u043F\u043D\u044B\u0439' };
        var curScale = localStorage.getItem(TV_SCALE_KEY) || 'large';
        tabsEl.append($('<div class="mc-filter-btn selector" data-tv-scale="open"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg><span class="mc-filter-btn__label">' + (scaleNames[curScale] || scaleNames.large) + '</span></div>'));
      }

      contentEl.append(tabsEl);

      /* Sections */
      var filteredMovies = getMoviesByCategory(activeTab);
      var hasContent = continueWatching.length > 0 || customCols.length > 0 || filteredMovies.length > 0;

      if (continueWatching.length > 0) {
        addSection('\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440', continueWatching, 'compact');
      }

      if (customCols.length > 0) {
        addSection('\u041C\u043E\u0438 \u043F\u0430\u043F\u043A\u0438', customCols, 'folders');
      }

      if (filteredMovies.length > 0) {
        addSection('\u0412\u0441\u0435 \u0444\u0438\u043B\u044C\u043C\u044B \u0432 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438 (' + filteredMovies.length + ')', filteredMovies, 'portrait');
      }

      if (!hasContent) {
        contentEl.append($('<div class="mc-empty">\u041F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E. \u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0444\u0438\u043B\u044C\u043C\u044B \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A.</div>'));
      }

      bindTabEvents(tabsEl);
      try { scroll.update(contentEl, true); } catch(e) {}

      activateTabs();
    }

    function addSection(title, data, type) {
      var sectionEl = $('<div class="mc-section"></div>');
      sectionEl.append($('<div class="mc-section__head"><div class="mc-section__title">' + title + '</div><div class="mc-section__arrows"><div class="mc-section__arrow" data-dir="-1"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div><div class="mc-section__arrow" data-dir="1"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></div></div></div>'));

      var hscroll = new Lampa.Scroll({ mask: true, horizontal: true });
      hscroll.body().addClass('mc-row-scroll');

      var idx = sections.length;

      var sectionObj = {
        el: sectionEl[0],
        hscroll: hscroll,
        last: null,
        activate: function() { activateSection(idx); }
      };

      if (type === 'compact') {
        for (var i = 0; i < data.length; i++) {
          var it = data[i], m = it.movie;
          var bg = posterUrl(m) || backdropUrl(m);

          var card = $('<div class="mc-card mc-card--compact selector" data-mid="' + m.id + '">'
            + '<div class="mc-card__poster" style="background-image:url(' + (bg || '') + ')">'
            + '<div class="mc-card__progress"><div class="mc-card__progress-bar" style="width:' + it.percent + '%"></div></div>'
            + '<div class="mc-card__percent">' + it.percent + '%</div>'
            + '</div></div>'
          ).data('movie', m)[0];

          (function(cardEl, movie, hs, sec) {
            cardEl.addEventListener('hover:enter', function() { openFullCard(movie); });
            cardEl.addEventListener('hover:focus', function() {
              sec.last = cardEl;
              hs.update(cardEl, true);
            });
          })(card, m, hscroll, sectionObj);

          hscroll.append(card);
        }
      } else if (type === 'landscape') {
        for (var i = 0; i < data.length; i++) {
          var it = data[i], m = it.movie;
          var bg = backdropUrl(m);
          var meta = it.progress.season ? 'S' + it.progress.season + ' \u00B7 E' + it.progress.episode : (it.progress.episode ? '\u042D\u043F. ' + it.progress.episode : '');

          var card = $('<div class="mc-card mc-card--landscape selector" data-mid="' + m.id + '">'
            + '<div class="mc-card__backdrop" style="background-image:url(' + (bg || '') + ')">'
            + '<div class="mc-card__gradient"></div>'
            + '<div class="mc-card__play"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>'
            + '</div>'
            + '<div class="mc-card__info">'
            + '<div class="mc-card__title">' + (m.title || m.name || '') + '</div>'
            + '<div class="mc-card__subtitle">' + (m.original_title || m.original_name || '') + '</div>'
            + (meta ? '<div class="mc-card__meta">' + meta + '</div>' : '')
            + '<div class="mc-card__progress"><div class="mc-card__progress-bar" style="width:' + it.percent + '%"></div></div>'
            + '<div class="mc-card__left">' + it.left + ' \u043C\u0438\u043D \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C</div>'
            + '</div></div>'
          ).data('movie', m)[0];

          (function(cardEl, movie, hs, sec) {
            cardEl.addEventListener('hover:enter', function() { openFullCard(movie); });
            cardEl.addEventListener('hover:focus', function() {
              sec.last = cardEl;
              hs.update(cardEl, true);
            });
          })(card, m, hscroll, sectionObj);

          hscroll.append(card);
        }
      } else if (type === 'folders') {
        for (var i = 0; i < data.length; i++) {
          var folder = data[i];
          var folderBg = folder.poster || '';
          var menuSvg = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

          var card = $('<div class="mc-card mc-card--folder selector" data-folder="' + folder.id + '">'
            + '<div class="mc-card__poster" style="background-image:url(' + (folderBg || '') + ')">'
            + '<div class="mc-card__gradient"></div>'
            + '<div class="mc-card__menu">' + menuSvg + '</div>'
            + '<div class="mc-card__folder-info">'
            + '<div class="mc-card__folder-name">' + folder.name + '</div>'
            + '<div class="mc-card__folder-count">' + folder.count + ' \u0444\u0438\u043B\u044C\u043C\u043E\u0432</div>'
            + '</div></div></div>'
          )[0];

          (function(cardEl, folderData, hs, sec) {
            var menuEl = cardEl.querySelector('.mc-card__menu');
            if (menuEl) {
              menuEl.addEventListener('click', function(e) {
                e.stopPropagation();
                folderMenuClicked = true;
                setTimeout(function() { folderMenuClicked = false; }, 200);
                showFolderMenuPopup(folderData);
              });
            }
            cardEl.addEventListener('hover:enter', function() {
              if (folderMenuClicked) return;
              viewingFolderId = folderData.id;
              renderPage();
              setTimeout(function() {
                if (sections.length > 0) activateSection(0);
              }, 100);
            });
            cardEl.addEventListener('hover:focus', function() { sec.last = cardEl; hs.update(cardEl, true); });
          })(card, folder, hscroll, sectionObj);

          hscroll.append(card);
        }
      } else {
        for (var i = 0; i < data.length; i++) {
          var m = data[i];
          var url = posterUrl(m);
          var year = getYear(m);
          var rating = (m.vote_average || 0).toFixed(1);

          var card = $('<div class="mc-card mc-card--portrait selector" data-mid="' + m.id + '">'
            + '<div class="mc-card__poster" style="background-image:url(' + (url || '') + ')">'
            + (m.vote_average > 0 ? '<div class="mc-card__badge">' + rating + '</div>' : '')
            + '</div>'
            + '<div class="mc-card__info">'
            + '<div class="mc-card__title">' + (m.title || m.name || '') + '</div>'
            + '<div class="mc-card__subtitle">' + (m.original_title || m.original_name || '') + '</div>'
            + (year ? '<div class="mc-card__year">' + year + '</div>' : '')
            + '</div></div>'
          ).data('movie', m)[0];

          (function(cardEl, movie, hs, sec) {
            cardEl.addEventListener('hover:enter', function() { openFullCard(movie); });
            cardEl.addEventListener('hover:focus', function() {
              sec.last = cardEl;
              hs.update(cardEl, true);
            });
          })(card, m, hscroll, sectionObj);

          hscroll.append(card);
        }
      }

      sectionEl.append(hscroll.render());
      contentEl.append(sectionEl);

      sectionEl.find('.mc-section__arrow').each(function() {
        var el = this;
        el.addEventListener('click', function() {
          var dir = parseInt(el.getAttribute('data-dir')) || 0;
          hscroll.wheel(dir * getLandscapeW() * 1.1);
        });
      });

      sections.push(sectionObj);
    }

    function renderFolderContent() {
      var cols = getCollections();
      var col = cols[viewingFolderId];
      if (!col) { viewingFolderId = null; renderPage(); return; }

      tabsEl = $('<div class="mc-tabs"></div>');
      for (var t = 0; t < TYPE_TABS.length; t++) {
        var tab = TYPE_TABS[t];
        var count = getMoviesByCategory(tab.id).length;
        tabsEl.append($('<div class="mc-tab selector' + (activeTab === tab.id ? ' active' : '') + '" data-tab="' + tab.id + '"><span class="mc-tab__icon">' + tab.icon + '</span><span class="mc-tab__label">' + tab.label + '</span><span class="mc-tab__count">' + count + '</span></div>'));
      }

      var customCols = getCustomCollections();
      for (var c = 0; c < customCols.length; c++) {
        (function(col) {
          var isActive = (viewingFolderId === col.id);
          var folderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
          tabsEl.append($('<div class="mc-tab selector' + (isActive ? ' active' : '') + '" data-folder-tab="' + col.id + '"><span class="mc-tab__icon">' + folderSvg + '</span><span class="mc-tab__label">' + col.name + '</span><span class="mc-tab__count">' + col.count + '</span></div>'));
        })(customCols[c]);
      }

      tabsEl.append($('<div class="mc-tab selector" data-create-folder="true"><span class="mc-tab__icon">+</span><span class="mc-tab__label">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u0430\u043F\u043A\u0443</span></div>'));

      contentEl.append(tabsEl);

      var movies = col.movies || [];
      if (movies.length > 0) {
        addSection(col.name + ' (' + movies.length + ')', movies, 'portrait');
      } else {
        contentEl.append($('<div class="mc-empty">\u041F\u0430\u043F\u043A\u0430 \u043F\u0443\u0441\u0442\u0430.</div>'));
      }
    }

    function bindTabEvents(tabsEl) {
      tabsEl.find('.mc-tab[data-tab]').each(function() {
        var el = this;
        var tabId = el.getAttribute('data-tab');
        el.addEventListener('hover:enter', function() {
          activeTab = tabId;
          viewingFolderId = null;
          localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
          renderPage();
        });
      });

      tabsEl.find('.mc-tab[data-folder-tab]').each(function() {
        var el = this;
        var folderId = el.getAttribute('data-folder-tab');
        el.addEventListener('hover:enter', function() {
          viewingFolderId = folderId;
          renderPage();
          setTimeout(function() {
            if (sections.length > 0) activateSection(0);
          }, 100);
        });
      });

      tabsEl.find('[data-create-folder]').each(function() {
        this.addEventListener('hover:enter', function() { showCreateFolderDialog(); });
      });

      tabsEl.find('[data-tv-scale]').each(function() {
        this.addEventListener('hover:enter', function() {
          var scaleNames = { compact: '\u041A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u044B\u0439', normal: '\u041E\u0431\u044B\u0447\u043D\u044B\u0439', large: '\u041A\u0440\u0443\u043F\u043D\u044B\u0439', xlarge: '\u041E\u0447\u0435\u043D\u044C \u043A\u0440\u0443\u043F\u043D\u044B\u0439' };
          var cur = localStorage.getItem(TV_SCALE_KEY) || 'large';
          var keys = ['compact', 'normal', 'large', 'xlarge'];
          var items = [];
          for (var i = 0; i < keys.length; i++) {
            (function(k) {
              items.push({
                name: scaleNames[k],
                checkbox: k === cur,
                onSelect: function() {
                  localStorage.setItem(TV_SCALE_KEY, k);
                  closeMcPopup();
                  updateSizes();
                  renderPage();
                }
              });
            })(keys[i]);
          }
          showMcPopup({ title: '\u041C\u0430\u0441\u0448\u0442\u0430\u0431', items: items, prevController: 'content' });
        });
      });
    }

    function activateTabs() {
      activeSection = -1;
      currentCtrl = 'tabs';

      Lampa.Controller.add('content', {
        toggle: function() {
          Lampa.Controller.collectionSet(tabsEl);
          var activeTabEl = tabsEl[0].querySelector('.mc-tab.active');
          Lampa.Controller.collectionFocus(activeTabEl || false, tabsEl);
        },
        right: function() { if (Navigator.canmove('right')) Navigator.move('right'); },
        left: function() {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        down: function() {
          if (sections.length > 0) {
            activeSection = 0;
            sections[0].activate();
            try { scroll.update(sections[0].el, true); } catch(e) {}
          }
        },
        up: function() {
          Lampa.Controller.toggle('head');
        },
        back: function() {
          if (viewingFolderId) {
            viewingFolderId = null;
            renderPage();
            setTimeout(function() {
              for (var i = 0; i < sections.length; i++) {
                var titleEl = sections[i] && sections[i].el ? sections[i].el.querySelector('.mc-section__title') : null;
                if (titleEl && titleEl.textContent.indexOf('\u041C\u043E\u0438 \u043F\u0430\u043F\u043A\u0438') === 0) {
                  activateSection(i);
                  try { scroll.update(sections[i].el, true); } catch(e) {}
                  break;
                }
              }
            }, 50);
            return;
          }
          Lampa.Activity.backward();
        }
      });

      Lampa.Controller.toggle('content');
    }

    function activateSection(idx) {
      if (idx < 0 || idx >= sections.length) return;
      activeSection = idx;
      currentCtrl = 'row';

      var section = sections[idx];

      Lampa.Controller.add('content', {
        toggle: function() {
          Lampa.Controller.collectionSet(section.hscroll.render(true));
          Lampa.Controller.collectionFocus(section.last || false, section.hscroll.render(true));
        },
        right: function() { if (Navigator.canmove('right')) Navigator.move('right'); },
        left: function() {
          if (Navigator.canmove('left')) Navigator.move('left');
          else {
            activateTabs();
            var tabsNode = contentEl[0].querySelector('.mc-tabs');
            if (tabsNode) try { scroll.update(tabsNode, true); } catch(e) {}
          }
        },
        down: function() {
          if (activeSection < sections.length - 1) {
            activeSection++;
            sections[activeSection].activate();
            try { scroll.update(sections[activeSection].el, true); } catch(e) {}
          }
        },
        up: function() {
          if (activeSection > 0) {
            activeSection--;
            sections[activeSection].activate();
            try { scroll.update(sections[activeSection].el, true); } catch(e) {}
          } else {
            activateTabs();
            var tabsNode = contentEl[0].querySelector('.mc-tabs');
            if (tabsNode) try { scroll.update(tabsNode, true); } catch(e) {}
          }
        },
        back: function() {
          if (viewingFolderId) {
            viewingFolderId = null;
            renderPage();
            setTimeout(function() {
              for (var i = 0; i < sections.length; i++) {
                var titleEl = sections[i] && sections[i].el ? sections[i].el.querySelector('.mc-section__title') : null;
                if (titleEl && titleEl.textContent.indexOf('\u041C\u043E\u0438 \u043F\u0430\u043F\u043A\u0438') === 0) {
                  activateSection(i);
                  try { scroll.update(sections[i].el, true); } catch(e) {}
                  break;
                }
              }
            }, 50);
            return;
          }
          Lampa.Activity.backward();
        }
      });

      Lampa.Controller.toggle('content');
    }

    function showFilterDialog() {
      var cols = getCollections();
      var filterItems = [{ name: '\u0412\u0441\u0435', onSelect: function() { activeFilter = 'all'; localStorage.setItem(ACTIVE_FILTER_KEY, activeFilter); closeMcPopup(); renderPage(); } }];
      var k = Object.keys(cols);
      for (var i = 0; i < k.length; i++) {
        (function(key) {
          filterItems.push({
            name: cols[key].name,
            checkbox: key === activeFilter,
            onSelect: function() { activeFilter = key; localStorage.setItem(ACTIVE_FILTER_KEY, activeFilter); closeMcPopup(); renderPage(); }
          });
        })(k[i]);
      }
      var startIdx = 0;
      for (var f = 0; f < filterItems.length; f++) {
        if (f === 0 && activeFilter === 'all') { startIdx = 0; break; }
        if (f > 0 && k[f-1] === activeFilter) { startIdx = f; break; }
      }
      showMcPopup({ title: '\u0424\u0438\u043B\u044C\u0442\u0440', items: filterItems, focusIdx: startIdx, prevController: 'content' });
    }

    function showFolderMenuPopup(folder) {
      showMcPopup({
        title: folder.name,
        items: [
          { name: '\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C', onSelect: function() {
            closeMcPopup();
            showRenameFolderDialog(folder);
          }},
          { name: '\u0423\u0434\u0430\u043B\u0438\u0442\u044C', onSelect: function() {
            closeMcPopup();
            confirmDeleteFolder(folder);
          }},
          { name: '\u041E\u0442\u043C\u0435\u043D\u0430', onSelect: function() { closeMcPopup(); } }
        ],
        prevController: 'content'
      });
    }

    function showRenameFolderDialog(folder) {
      var names = [
        '\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435', '\u041A\u043E\u043C\u0435\u0434\u0438\u0438', '\u0423\u0436\u0430\u0441\u044B', '\u0424\u0430\u043D\u0442\u0430\u0441\u0442\u0438\u043A\u0430',
        '\u041C\u0435\u043B\u043E\u0434\u0440\u0430\u043C\u044B', '\u0411\u043E\u0435\u0432\u0438\u043A\u0438', '\u0414\u0435\u0442\u0435\u043A\u0442\u0438\u0432\u044B', '\u0414\u0440\u0430\u043C\u044B',
        '\u041C\u044E\u0437\u044B\u043A\u043B\u044B', '\u0418\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435', '\u0412\u043E\u0435\u043D\u043D\u044B\u0435', '\u041A\u0440\u0438\u043C\u0438\u043D\u0430\u043B',
        '\u0417\u0430\u0433\u0430\u0434\u043A\u0438', '\u0421\u0435\u043C\u0435\u0439\u043D\u044B\u0435', '\u0414\u0435\u0442\u0441\u043A\u0438\u0435'
      ];
      var items = names.map(function(n) {
        return {
          name: n,
          onSelect: function() {
            renameCollection(folder.id, n);
            closeMcPopup();
            renderPage();
            setTimeout(function() { activateTabs(); }, 50);
          }
        };
      });
      showMcPopup({ title: '\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C', items: items, prevController: 'content' });
    }

    function confirmDeleteFolder(folder) {
      showMcPopup({
        title: '\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u00AB' + folder.name + '\u00BB?',
        items: [
          { name: '\u0414\u0430, \u0443\u0434\u0430\u043B\u0438\u0442\u044C', onSelect: function() {
            deleteCollection(folder.id);
            if (viewingFolderId === folder.id) viewingFolderId = null;
            closeMcPopup();
            renderPage();
            setTimeout(function() { activateTabs(); }, 50);
          }},
          { name: '\u041E\u0442\u043C\u0435\u043D\u0430', onSelect: function() { closeMcPopup(); } }
        ],
        prevController: 'content'
      });
    }

    var mcReady = false;
    var destroyed = false;
    var _bgInterval = null;

    function hideMcOverlay() {
      try {
        var bg = document.querySelector('.mc-bg');
        if (bg) bg.style.display = 'none';
        document.body.classList.remove('mc-active');
        restoreHead();
      } catch(ex) {}
    }

    function showMcOverlay() {
      try {
        var bg = document.querySelector('.mc-bg');
        if (bg) bg.style.display = '';
        document.body.classList.add('mc-active');
        customizeHead();
      } catch(ex) {}
    }

    function cleanup() {
      if (destroyed) return;
      destroyed = true;

      Lampa.Listener.remove('activity', onActivityStart);
      if (_bgInterval) { clearInterval(_bgInterval); _bgInterval = null; }

      try { restoreHead(); } catch(e) {}
      try { removeMcBackground(); } catch(e) {}

      try { if (scroll && scroll.destroy) scroll.destroy(); } catch(e) {}

      try { $('html').removeClass('mc-root mc-root tv'); } catch(e) {}

      scroll = null;
      contentEl = null;
      tabsEl = null;
      sections = [];
      activeSection = -1;
      mcReady = false;
    }

    function onActivityStart(e) {
      if (e.component !== 'mc_main') {
        if (e.type === 'destroy') return;
        return;
      }

      if (e.type === 'destroy') {
        cleanup();
        return;
      }

      if (e.type === 'start' && mcReady) {
        try {
          showMcOverlay();
          var active = Lampa.Activity.active();
          if (active && active.activity && active.activity.render) {
            var render = active.activity.render();
            if (scroll && scroll.render && render && !render[0].contains(scroll.render()[0])) {
              render.empty().append(scroll.render());
            }
          }
          if (currentCtrl == 'row' && activeSection >= 0 && sections[activeSection]) {
            activateSection(activeSection);
          } else {
            activateTabs();
          }
        } catch(ex) {}
      }
    }

    Lampa.Listener.follow('activity', onActivityStart);

    _bgInterval = setInterval(function() {
      if (destroyed) { clearInterval(_bgInterval); _bgInterval = null; return; }
      if (!mcReady) return;
      try {
        var active = Lampa.Activity.active();
        var isMc = active && active.component === 'mc_main';
        var bg = document.querySelector('.mc-bg');
        if (isMc) {
          if (bg && bg.style.display === 'none') showMcOverlay();
        } else {
          if (bg && bg.style.display !== 'none') hideMcOverlay();
        }
      } catch(ex) {}
    }, 500);

    Lampa.Activity.push({
      title: PLUGIN_NAME,
      component: 'mc_main'
    });

    setTimeout(function() {
      if (destroyed) return;
      var active = Lampa.Activity.active();
      if (active && active.activity && active.activity.render) {
        active.activity.render().empty().append(scroll.render());
      }
      renderPage();
      customizeHead();
      mcReady = true;
      try { scroll.update(contentEl, true); } catch(e) {}
    }, 300);
  }

  // ========== Card Button ==========

  function addCollectionButton(startHtml, card) {
    if (!startHtml || !startHtml.length || !card || !card.id) return;

    var container = startHtml.find('.full-start-new__buttons');
    if (!container.length) container = startHtml.find('.full-start__buttons');
    if (!container.length) container = startHtml.find('.buttons--container');
    if (!container.length) return;

    if (container.find('.button--collection').length) return;

    var inAny = isMovieInAnyCollection(card.id);

    var btn = $('<div class="full-start__button selector button--collection' + (inAny ? ' button--collection-active' : '') + '" data-mid="' + card.id + '"></div>');
    btn.html('<svg xmlns="http://www.w3.org/2000/svg" width="21" height="32" viewBox="0 0 21 32" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 20l-7-5-7 5V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1z"/></svg><span>' + PLUGIN_NAME + (inAny ? ' \u2713' : '') + '</span>');
    btn.on('hover:enter', function() { showAddToCollectionDialog(card); });

    var optionsBtn = container.find('.button--options');
    if (optionsBtn.length) {
      optionsBtn.before(btn);
    } else {
      container.append(btn);
    }
  }

  function openFullCard(movie) {
    var gids = movie.genre_ids && movie.genre_ids.length ? movie.genre_ids : (movie.genres && movie.genres.length ? movie.genres.map(function(g) { return g.id || 0; }) : []);
    Lampa.Router.call('full', {
      id: movie.id || movie.tmdb_id || 0,
      source: movie.source || 'tmdb',
      original_name: movie.original_name || movie.name || '',
      original_title: movie.original_title || movie.title || '',
      title: movie.title || movie.name || '',
      name: movie.name || '',
      poster_path: movie.poster_path || '',
      backdrop_path: movie.backdrop_path || '',
      release_date: movie.release_date || '',
      first_air_date: movie.first_air_date || '',
      vote_average: movie.vote_average || 0,
      genre_ids: gids,
      overview: movie.overview || ''
    });
  }

  // ========== Init ==========

  function start() { startPlugin(); }

  if (typeof Lampa !== 'undefined') start();
  else {
    var w = setInterval(function() {
      if (typeof Lampa !== 'undefined') { clearInterval(w); start(); }
    }, 500);
  }

})();
