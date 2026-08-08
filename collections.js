(function() {
  'use strict';

  var PLUGIN_NAME = 'Мои Коллекции';
  var STORAGE_KEY = 'my_collections';
  var PROGRESS_KEY = 'mc_watch_progress';
  var VIEWED_KEY = 'mc_last_viewed';
  var ACTIVE_TAB_KEY = 'mc_active_tab';
  var ACTIVE_FILTER_KEY = 'mc_active_filter';
  var TV_SCALE_KEY = 'mc_tv_scale';

  var TV_SCALE_PRESETS = {
    compact: 0.85,
    normal: 1.0,
    large: 1.15,
    xlarge: 1.3
  };

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

  var _collectionsCache = null;

  function isTV() {
    return typeof Lampa !== 'undefined' && Lampa.Platform && (Lampa.Platform.tv() || Lampa.Platform.screen('tv'));
  }

  function getTvScaleSetting() {
    try {
      var v = localStorage.getItem(TV_SCALE_KEY);
      if (v && TV_SCALE_PRESETS[v] !== undefined) return TV_SCALE_PRESETS[v];
    } catch(e) {}
    return TV_SCALE_PRESETS.large;
  }

  function getScreenScale() {
    var w = window.innerWidth || 1920;
    if (isTV()) {
      var base;
      if (w <= 1280) base = 1.2;
      else if (w <= 1920) base = 1.35;
      else base = 1.15;
      return base * getTvScaleSetting();
    }
    var scale = w / 1920;
    if (scale < 0.78) scale = 0.78;
    if (scale > 1.30) scale = 1.30;
    return scale;
  }

  function px(v) { return Math.round(v * getScreenScale()) + 'px'; }

  function getTvGap() {
    if (!isTV()) return 14;
    var w = window.innerWidth || 1920;
    if (w <= 1280) return 16;
    if (w <= 1920) return 20;
    return 24;
  }

  function getCardW() {
    var w = window.innerWidth || 1920;
    if (isTV()) {
      var pad = 80;
      var gap = getTvGap();
      var minCard = 320;
      var count = Math.floor((w - pad) / (minCard + gap));
      if (count < 4) count = 4;
      if (count > 8) count = 8;
      return Math.floor((w - pad - gap * (count - 1)) / count);
    }
    return Math.round(190 * getScreenScale());
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

  function getAllMovies() {
    var cols = getCollections();
    var all = [], seen = {};
    var k = Object.keys(cols);
    for (var i = 0; i < k.length; i++) {
      var m = cols[k[i]].movies || [];
      for (var j = 0; j < m.length; j++) {
        if (!seen[m[j].id]) { seen[m[j].id] = true; all.push(m[j]); }
      }
    }
    return all;
  }

  function getMoviesByCategory(cat) {
    var all = getAllMovies();
    if (cat === 'all') return all;
    if (cat === 'movie') return all.filter(function(m) { return (m.category || detectCategory(m)) === 'movie'; });
    if (cat === 'tv') return all.filter(function(m) { return (m.category || detectCategory(m)) === 'tv'; });
    if (cat === 'cartoon') return all.filter(function(m) { return (m.subtype || detectSubtype(m)) === 'cartoon'; });
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

  function createAndAdd(name, icon, movie) {
    var cols = getCollections();
    var newId = 'custom_' + Date.now();
    cols[newId] = { name: name, icon: icon || '\uD83D\uDCC1', movies: [] };
    saveCollections(cols);
    addToCollection(newId, movie);
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

  // ========== Tracking ==========

  function getProgress() { try { var r = localStorage.getItem(PROGRESS_KEY); return r ? JSON.parse(r) : {}; } catch(e) { return {}; } }
  function saveProgress(d) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(d)); } catch(e) {} }

  function updateProgress(movieId, info) {
    var p = getProgress();
    p[movieId] = { time: info.time || 0, duration: info.duration || 0, episode: info.episode || '', season: info.season || '', title: info.title || '', updated: Date.now() };
    saveProgress(p);
  }

  function getViewed() { try { var r = localStorage.getItem(VIEWED_KEY); return r ? JSON.parse(r) : {}; } catch(e) { return {}; } }
  function saveViewed(d) { try { localStorage.setItem(VIEWED_KEY, JSON.stringify(d)); } catch(e) {} }

  function markViewed(movieId, movie) {
    var v = getViewed();
    var gids = movie.genre_ids && movie.genre_ids.length ? movie.genre_ids : (movie.genres && movie.genres.length ? movie.genres.map(function(g) { return g.id || 0; }) : []);
    v[movieId] = { id: movieId, title: movie.title || movie.name || '', name: movie.name || movie.title || '', original_title: movie.original_title || '', original_name: movie.original_name || '', poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '', release_date: movie.release_date || movie.first_air_date || '', first_air_date: movie.first_air_date || '', vote_average: movie.vote_average || 0, genre_ids: gids, original_language: movie.original_language || '', timestamp: Date.now() };
    saveViewed(v);
  }

  function getContinueWatching() {
    var pr = getProgress();
    var all = getAllMovies();
    var items = [];
    var ids = Object.keys(pr);
    for (var i = 0; i < ids.length; i++) {
      var pid = ids[i], p = pr[pid];
      if (!p || !p.duration || p.time < 60) continue;
      var pct = Math.floor((p.time / p.duration) * 100);
      if (pct >= 95) continue;
      var movie = null;
      for (var j = 0; j < all.length; j++) { if (String(all[j].id) === String(pid)) { movie = all[j]; break; } }
      if (!movie) movie = { id: pid, title: p.title || '', name: p.title || '' };
      items.push({ movie: movie, progress: p, percent: pct, left: Math.ceil((p.duration - p.time) / 60) });
    }
    items.sort(function(a, b) { return (b.progress.updated || 0) - (a.progress.updated || 0); });
    return items.slice(0, 12);
  }

  function getRecentlyAdded() {
    var all = getAllMovies();
    all.sort(function(a, b) { return (b.added_at || 0) - (a.added_at || 0); });
    return all.slice(0, 20);
  }

  function getRecentlyViewed() {
    var v = getViewed();
    var items = [];
    var ids = Object.keys(v);
    for (var i = 0; i < ids.length; i++) { if (v[ids[i]]) items.push(v[ids[i]]); }
    items.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    return items.slice(0, 20);
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
              if (movie && movie.id) updateProgress(movie.id, { time: e.data.time || 0, duration: e.data.duration || 0, episode: e.data.episode || '', season: e.data.season || '', title: movie.title || movie.name || '' });
            }
          }
        });
      }
    } catch(e) {}
  }

  // ========== CSS ==========

  var _resizeTimer = null;

  function updateSizes() {
    var r = document.documentElement;
    r.style.setProperty('--mc-cw', getCardW() + 'px');
    r.style.setProperty('--mc-ch', getCardH() + 'px');
    r.style.setProperty('--mc-lw', getLandscapeW() + 'px');
    r.style.setProperty('--mc-lh', getLandscapeH() + 'px');
    r.style.setProperty('--mc-gap', getTvGap() + 'px');
    r.style.setProperty('--mc-s', getScreenScale());
  }

  function onResize() {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(function() {
      updateSizes();
      injectStyles();
      var active = Lampa.Activity.active();
      if (active && active.component === 'mc_main') {
        try { openCollectionsPage(); } catch(e) {}
      }
    }, 300);
  }

  function injectStyles() {
    var existing = document.getElementById('mc-css');
    if (existing) existing.remove();

    var cw = getCardW();
    var ch = getCardH();
    var lw = getLandscapeW();
    var lh = getLandscapeH();
    var gap = getTvGap();
    var tv = isTV();

    var css = ''

    + '.mc-page { padding:0 0 ' + px(80) + ' 0; box-sizing:border-box; width:100%; }'

    + '.mc-tabs { display:flex; gap:' + px(10) + '; padding:' + px(20) + ' ' + px(24) + ' ' + px(16) + '; overflow-x:auto; align-items:center; flex-wrap:nowrap; }'
    + '.mc-tabs::-webkit-scrollbar { display:none; }'
    + '.mc-tab { flex-shrink:0; display:flex; align-items:center; gap:' + px(8) + '; padding:' + px(10) + ' ' + px(20) + '; border-radius:' + px(24) + '; background:rgba(255,255,255,0.06); border:' + px(1.5) + ' solid transparent; cursor:pointer; transition:all .2s; }'
    + '.mc-tab:hover,.mc-tab.focus { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.15); }'
    + '.mc-tab.active { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.3); }'
    + '.mc-tab__icon { font-size:' + px(16) + '; }'
    + '.mc-tab__label { font-size:' + px(14) + '; color:rgba(255,255,255,0.6); font-weight:500; }'
    + '.mc-tab.active .mc-tab__label { color:#fff; }'
    + '.mc-tab__count { font-size:' + px(12) + '; color:rgba(255,255,255,0.3); margin-left:2px; }'

    + '.mc-filter-btn { flex-shrink:0; display:flex; align-items:center; gap:' + px(6) + '; padding:' + px(10) + ' ' + px(18) + '; border-radius:' + px(24) + '; background:rgba(255,255,255,0.06); border:' + px(1.5) + ' solid transparent; cursor:pointer; transition:all .2s; margin-left:auto; }'
    + '.mc-filter-btn:hover,.mc-filter-btn.focus { background:rgba(255,255,255,0.1); }'
    + '.mc-filter-btn.active { background:rgba(59,213,116,0.12); border-color:rgba(59,213,116,0.4); }'
    + '.mc-filter-btn__label { font-size:' + px(14) + '; color:rgba(255,255,255,0.6); }'
    + '.mc-filter-btn.active .mc-filter-btn__label { color:#3bd574; }'
    + '.mc-filter-btn svg { width:' + px(16) + '; height:' + px(16) + '; }'

    + '.mc-section { margin-bottom:' + px(28) + '; }'
    + '.mc-section__head { display:flex; align-items:center; padding:0 ' + px(24) + ' ' + px(14) + '; gap:' + px(12) + '; }'
    + '.mc-section__title { font-size:' + px(22) + '; font-weight:700; color:#fff; flex:1; }'
    + '.mc-section__arrows { display:flex; gap:' + px(8) + '; }'
    + '.mc-section__arrow { width:' + px(36) + '; height:' + px(36) + '; border-radius:50%; background:rgba(255,255,255,0.08); border:' + px(1) + ' solid rgba(255,255,255,0.1); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; }'
    + '.mc-section__arrow:hover,.mc-section__arrow.focus { background:rgba(255,255,255,0.15); }'
    + '.mc-section__arrow svg { width:' + px(16) + '; height:' + px(16) + '; fill:none; stroke:rgba(255,255,255,0.6); stroke-width:2; }'

    + '.mc-row-scroll { display:flex; gap:' + gap + 'px; padding:0 ' + px(24) + '; overflow-x:auto; overflow-y:hidden; scroll-behavior:smooth; }'
    + '.mc-row-scroll::-webkit-scrollbar { display:none; }'

    + '.mc-row-wrap { display:flex; flex-wrap:wrap; gap:' + gap + 'px; padding:0 ' + px(24) + '; justify-content:center; }'

    + '.mc-card { flex-shrink:0; cursor:pointer; transition:transform .2s; }'
    + '.mc-card:hover,.mc-card.focus { transform:scale(1.04); }'

    + '.mc-card--landscape { width:' + lw + 'px; border-radius:' + px(12) + '; overflow:hidden; position:relative; background:#1a1a2e; }'
    + '.mc-card--landscape .mc-card__backdrop { width:100%; height:' + lh + 'px; background-size:cover; background-position:center; position:relative; }'
    + '.mc-card--landscape .mc-card__gradient { position:absolute; bottom:0; left:0; right:0; height:70%; background:linear-gradient(transparent, rgba(0,0,0,0.85)); }'
    + '.mc-card--landscape .mc-card__play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:' + px(44) + '; height:' + px(44) + '; border-radius:50%; background:rgba(255,255,255,0.9); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .2s; }'
    + '.mc-card--landscape:hover .mc-card__play,.mc-card--landscape.focus .mc-card__play { opacity:1; }'
    + '.mc-card--landscape .mc-card__play svg { width:' + px(18) + '; height:' + px(18) + '; fill:#111; margin-left:2px; }'
    + '.mc-card--landscape .mc-card__info { padding:' + px(12) + ' ' + px(14) + '; }'
    + '.mc-card--landscape .mc-card__title { font-size:' + px(15) + '; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
    + '.mc-card--landscape .mc-card__subtitle { font-size:' + px(12) + '; color:rgba(255,255,255,0.45); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
    + '.mc-card--landscape .mc-card__meta { font-size:' + px(11) + '; color:rgba(255,255,255,0.35); margin-top:4px; }'
    + '.mc-card--landscape .mc-card__progress { height:' + px(3) + '; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:' + px(8) + '; overflow:hidden; }'
    + '.mc-card--landscape .mc-card__progress-bar { height:100%; background:#3bd574; border-radius:2px; }'
    + '.mc-card--landscape .mc-card__left { font-size:' + px(11) + '; color:#3bd574; margin-top:4px; }'

    + '.mc-card--portrait { width:' + cw + 'px; }'
    + '.mc-card--portrait .mc-card__poster { width:' + cw + 'px; height:' + ch + 'px; border-radius:' + px(10) + '; background-size:cover; background-position:center top; background-color:rgba(255,255,255,0.06); position:relative; overflow:hidden; }'
    + '.mc-card--portrait .mc-card__badge { position:absolute; top:' + px(8) + '; right:' + px(8) + '; background:rgba(0,0,0,0.75); color:#f5c518; font-size:' + px(12) + '; font-weight:700; padding:' + px(3) + ' ' + px(7) + '; border-radius:' + px(6) + '; }'
    + '.mc-card--portrait .mc-card__info { padding:' + px(8) + ' 2px 0; }'
    + '.mc-card--portrait .mc-card__title { font-size:' + px(13) + '; color:#fff; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center; }'
    + '.mc-card--portrait .mc-card__subtitle { font-size:' + px(11) + '; color:rgba(255,255,255,0.35); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; text-align:center; }'
    + '.mc-card--portrait .mc-card__year { font-size:' + px(12) + '; color:rgba(255,255,255,0.3); margin-top:2px; text-align:center; }'

    + '.mc-empty { padding:' + px(40) + ' ' + px(24) + '; color:rgba(255,255,255,0.25); font-size:' + px(16) + '; text-align:center; }'

    + '.mc-popup { position:fixed; top:0; right:0; z-index:55; display:flex; align-items:stretch; justify-content:flex-end; width:100%; height:100%; }'
    + '.mc-popup__box { background:#262829; width:35%; max-width:500px; display:flex; flex-direction:column; overflow:hidden; }'
    + '@media (max-width:800px) { .mc-popup__box { width:50%; } }'
    + '@media (max-width:500px) { .mc-popup__box { width:100%; max-width:100%; border-top-left-radius:' + px(20) + '; border-top-right-radius:' + px(20) + '; } }'
    + '.mc-popup__head { padding:' + px(32) + '; padding-bottom:0; }'
    + '.mc-popup__title { font-size:' + px(35) + '; font-weight:300; color:#fff; }'
    + '.mc-popup__list { padding:' + px(8) + ' 0; overflow-y:auto; flex:1; }'
    + '.mc-popup__item { display:flex; align-items:center; padding:' + px(24) + ' ' + px(32) + '; position:relative; cursor:pointer; transition:background .1s; gap:' + px(12) + '; }'
    + '.mc-popup__item:hover,.mc-popup__item.focus { background:#353535; }'
    + '.mc-popup__item-name { flex:1; font-size:' + px(21) + '; color:#fff; font-weight:400; line-height:1.3; overflow:hidden; text-overflow:ellipsis; }'
    + '.mc-popup__item-count { font-size:' + px(18) + '; color:rgba(255,255,255,0.5); margin-right:' + px(8) + '; }'
    + '.mc-popup__cb { width:' + px(22) + '; height:' + px(22) + '; border:' + px(3) + ' solid rgba(255,255,255,0.2); border-radius:' + px(5) + '; flex-shrink:0; position:relative; transition:all .15s; box-sizing:border-box; }'
    + '.mc-popup__cb.on { border-color:#fff; }'
    + '.mc-popup__cb.on::after { content:""; display:block; width:' + px(5) + '; height:' + px(9) + '; border-right:' + px(3) + ' solid #fff; border-bottom:' + px(3) + ' solid #fff; position:absolute; top:' + px(2) + '; right:' + px(3) + '; transform:rotate(45deg); }'
    + '.mc-popup__cb svg { display:none; }'
    + '.mc-popup__create { display:flex; align-items:center; justify-content:center; gap:' + px(8) + '; padding:' + px(24) + '; margin:' + px(4) + ' ' + px(10) + ' ' + px(10) + '; border-radius:' + px(10) + '; background:rgba(59,213,116,0.1); border:' + px(1) + ' solid rgba(59,213,116,0.25); cursor:pointer; transition:background .1s; }'
    + '.mc-popup__create:hover,.mc-popup__create.focus { background:#353535; }'
    + '.mc-popup__create-text { font-size:' + px(21) + '; color:#3bd574; font-weight:400; }';

    if (tv) {
      css += ''
      + '.mc-tabs { padding:' + px(24) + ' ' + px(32) + ' ' + px(20) + '; gap:' + px(14) + '; }'
      + '.mc-tab { padding:' + px(14) + ' ' + px(28) + '; border-radius:' + px(28) + '; }'
      + '.mc-tab__icon { font-size:' + px(20) + '; }'
      + '.mc-tab__label { font-size:' + px(18) + '; }'
      + '.mc-tab__count { font-size:' + px(14) + '; }'
      + '.mc-filter-btn { padding:' + px(14) + ' ' + px(24) + '; border-radius:' + px(28) + '; }'
      + '.mc-filter-btn__label { font-size:' + px(18) + '; }'
      + '.mc-filter-btn svg { width:' + px(20) + '; height:' + px(20) + '; }'
      + '.mc-section { margin-bottom:' + px(36) + '; }'
      + '.mc-section__head { padding:0 ' + px(32) + ' ' + px(18) + '; }'
      + '.mc-section__title { font-size:' + px(28) + '; }'
      + '.mc-section__arrow { width:' + px(44) + '; height:' + px(44) + '; }'
      + '.mc-section__arrow svg { width:' + px(20) + '; height:' + px(20) + '; }'
      + '.mc-row-scroll { padding:0 ' + px(32) + '; }'
      + '.mc-row-wrap { padding:0 ' + px(32) + '; }'
      + '.mc-card--portrait .mc-card__title { font-size:' + px(16) + '; }'
      + '.mc-card--portrait .mc-card__subtitle { font-size:' + px(13) + '; }'
      + '.mc-card--portrait .mc-card__year { font-size:' + px(14) + '; }'
      + '.mc-card--landscape .mc-card__title { font-size:' + px(18) + '; }'
      + '.mc-card--landscape .mc-card__subtitle { font-size:' + px(14) + '; }'
      + '.mc-card--landscape .mc-card__info { padding:' + px(14) + ' ' + px(18) + '; }'
      + '.mc-popup__box { width:40%; max-width:600px; }'
      + '.mc-popup__head { padding:' + px(40) + '; padding-bottom:0; }'
      + '.mc-popup__title { font-size:' + px(40) + '; }'
      + '.mc-popup__item { padding:' + px(28) + ' ' + px(36) + '; gap:' + px(16) + '; }'
      + '.mc-popup__item-name { font-size:' + px(24) + '; }'
      + '.mc-popup__item-count { font-size:' + px(20) + '; }'
      + '.mc-popup__cb { width:' + px(28) + '; height:' + px(28) + '; border-width:' + px(3) + '; }'
      + '.mc-popup__cb.on::after { width:' + px(6) + '; height:' + px(11) + '; border-right-width:' + px(3) + '; border-bottom-width:' + px(3) + '; top:' + px(4) + '; right:' + px(4) + '; }'
      + '.mc-popup__create { padding:' + px(28) + '; margin:' + px(6) + ' ' + px(14) + ' ' + px(14) + '; }'
      + '.mc-popup__create-text { font-size:' + px(24) + '; }'
      + '.mc-card.focus { outline:3px solid rgba(255,255,255,0.7); outline-offset:2px; }'
      + '.mc-tab.focus { outline:2px solid rgba(255,255,255,0.5); outline-offset:1px; }'
      + '.mc-filter-btn.focus { outline:2px solid rgba(59,213,116,0.7); outline-offset:1px; }'
      + '.mc-popup__item.focus { outline:2px solid rgba(255,255,255,0.5); outline-offset:-2px; }'
      + '.mc-section__arrow.focus { outline:2px solid rgba(255,255,255,0.5); outline-offset:1px; }';
    }

    var style = document.createElement('style');
    style.id = 'mc-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ========== Plugin ==========

  function startPlugin() {
    if (window._my_collections_plugin) return;
    window._my_collections_plugin = true;
    injectStyles();
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
  }

  function addMenuButton() {
    setTimeout(function() {
      var menuList = document.querySelector('.menu__list');
      if (!menuList || document.querySelector('.my-collections-menu-item')) return;
      var item = document.createElement('div');
      item.className = 'menu__item selector my-collections-menu-item';
      item.innerHTML = '<div class="menu__item-text" style="font-size:18px;font-weight:600;">' + PLUGIN_NAME + '</div>';
      item.addEventListener('click', function(){ openCollectionsPage(); });
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

    $(list).on('click hover:enter', '.mc-popup__item', function() {
      var idx = parseInt($(this).attr('data-idx'));
      if (!isNaN(idx)) { focusIdx = idx; updateFocus(); selectItem(idx); }
    });

    _prevController = 'mc_main';
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
      (function(key) {
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
            closeMcPopup();
            showAddToCollectionDialog(movie);
          }
        });
      })(keys[i]);
    }

    items.push({
      className: 'mc-popup__create',
      html: '<span style="font-size:' + px(18) + ';color:#3bd574;">+</span><span class="mc-popup__create-text">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E</span>',
      onSelect: function() {
        closeMcPopup();
        showCreateCollectionDialog(movie);
      }
    });

    showMcPopup({ title: movie.title || movie.name || PLUGIN_NAME, items: items });
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
    showMcPopup({ title: '\u041D\u043E\u0432\u0430\u044F \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F', items: items });
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

  // ========== Main Page ==========

  function openCollectionsPage() {
    var activeTab = localStorage.getItem(ACTIVE_TAB_KEY) || 'all';
    var activeFilter = localStorage.getItem(ACTIVE_FILTER_KEY) || 'all';

    var scroll = new Lampa.Scroll({ mask: true, over: true });
    scroll.body().addClass('mc-page');

    var contentEl = $('<div></div>');
    scroll.append(contentEl);

    function renderPage() {
      contentEl.empty();

      var filteredMovies = getMoviesByCategory(activeTab);
      if (activeFilter !== 'all') {
        filteredMovies = filteredMovies.filter(function(m) { return isInCollection(activeFilter, m.id); });
      }

      var continueWatching = getContinueWatching();
      if (activeTab !== 'all') continueWatching = continueWatching.filter(function(i) { return detectCategory(i.movie) === activeTab; });

      var recentlyAdded = getRecentlyAdded();
      if (activeTab !== 'all') recentlyAdded = recentlyAdded.filter(function(m) { return detectCategory(m) === activeTab; });
      if (activeFilter !== 'all') recentlyAdded = recentlyAdded.filter(function(m) { return isInCollection(activeFilter, m.id); });

      var recentlyViewed = getRecentlyViewed();
      if (activeTab !== 'all') recentlyViewed = recentlyViewed.filter(function(m) { return detectCategory(m) === activeTab; });

      /* Tabs */
      var tabsEl = $('<div class="mc-tabs"></div>');
      for (var t = 0; t < TYPE_TABS.length; t++) {
        var tab = TYPE_TABS[t];
        var count = getMoviesByCategory(tab.id).length;
        tabsEl.append($('<div class="mc-tab selector' + (activeTab === tab.id ? ' active' : '') + '" data-tab="' + tab.id + '"><span class="mc-tab__icon">' + tab.icon + '</span><span class="mc-tab__label">' + tab.label + '</span><span class="mc-tab__count">' + count + '</span></div>'));
      }

      var filterLabel = '\u0424\u0438\u043B\u044C\u0442\u0440\u044B';
      if (activeFilter !== 'all') {
        var cols = getCollections();
        if (cols[activeFilter]) filterLabel = cols[activeFilter].name;
      }
      tabsEl.append($('<div class="mc-filter-btn selector' + (activeFilter !== 'all' ? ' active' : '') + '" data-filter="toggle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg><span class="mc-filter-btn__label">' + filterLabel + '</span></div>'));

      if (isTV()) {
        var scaleNames = { compact: '\u041A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u044B\u0439', normal: '\u041E\u0431\u044B\u0447\u043D\u044B\u0439', large: '\u041A\u0440\u0443\u043F\u043D\u044B\u0439', xlarge: '\u041E\u0447\u0435\u043D\u044C \u043A\u0440\u0443\u043F\u043D\u044B\u0439' };
        var curScale = localStorage.getItem(TV_SCALE_KEY) || 'large';
        tabsEl.append($('<div class="mc-filter-btn selector" data-tv-scale="open"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg><span class="mc-filter-btn__label">' + (scaleNames[curScale] || scaleNames.large) + '</span></div>'));
      }

      contentEl.append(tabsEl);

      /* Sections */
      var hasAny = continueWatching.length > 0 || recentlyAdded.length > 0 || recentlyViewed.length > 0;

      if (hasAny) {
        if (continueWatching.length > 0) renderLandscapeSection('\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440', continueWatching);
        if (recentlyAdded.length > 0) renderPortraitSection('\u041D\u0435\u0434\u0430\u0432\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E', recentlyAdded);
        if (recentlyViewed.length > 0) renderPortraitSection('\u041D\u0435\u0434\u0430\u0432\u043D\u043E \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E', recentlyViewed);
      } else {
        contentEl.append($('<div class="mc-empty">\u041F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E. \u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0444\u0438\u043B\u044C\u043C\u044B \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A.</div>'));
      }

      bindEvents();
      try { scroll.update(); } catch(e) {}

      Lampa.Controller.collectionSet(scroll.render(), scroll.render());
    }

    function renderLandscapeSection(title, items) {
      var section = $('<div class="mc-section"></div>');
      section.append($('<div class="mc-section__head"><div class="mc-section__title">' + title + '</div><div class="mc-section__arrows"><div class="mc-section__arrow selector" data-dir="-1"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div><div class="mc-section__arrow selector" data-dir="1"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></div></div></div>'));

      var row = $('<div class="mc-row-scroll"></div>');
      for (var i = 0; i < items.length; i++) {
        var it = items[i], m = it.movie;
        var bg = backdropUrl(m);
        var meta = it.progress.season ? 'S' + it.progress.season + ' \u00B7 E' + it.progress.episode : (it.progress.episode ? '\u042D\u043F. ' + it.progress.episode : '');

        row.append($('<div class="mc-card mc-card--landscape selector" data-mid="' + m.id + '">'
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
        ).data('movie', m));
      }
      enableWheelScroll(row[0]);
      section.append(row);
      contentEl.append(section);
    }

    function renderPortraitSection(title, movies) {
      var section = $('<div class="mc-section"></div>');
      section.append($('<div class="mc-section__head"><div class="mc-section__title">' + title + '</div></div>'));

      var row = $('<div class="mc-row-wrap"></div>');
      for (var i = 0; i < movies.length; i++) {
        var m = movies[i];
        var url = posterUrl(m);
        var year = getYear(m);
        var rating = (m.vote_average || 0).toFixed(1);

        row.append($('<div class="mc-card mc-card--portrait selector" data-mid="' + m.id + '">'
          + '<div class="mc-card__poster" style="background-image:url(' + (url || '') + ')">'
          + (m.vote_average > 0 ? '<div class="mc-card__badge">' + rating + '</div>' : '')
          + '</div>'
          + '<div class="mc-card__info">'
          + '<div class="mc-card__title">' + (m.title || m.name || '') + '</div>'
          + '<div class="mc-card__subtitle">' + (m.original_title || m.original_name || '') + '</div>'
          + (year ? '<div class="mc-card__year">' + year + '</div>' : '')
          + '</div></div>'
        ).data('movie', m));
      }
      section.append(row);
      contentEl.append(section);
    }

    function bindEvents() {
      scroll.render().off('hover:enter click');

      scroll.render().on('hover:enter click', '.mc-tab[data-tab]', function() {
        activeTab = $(this).attr('data-tab') || 'all';
        localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
        renderPage();
      });

      scroll.render().on('hover:enter click', '[data-filter="toggle"]', function() {
        showFilterDialog();
      });

      scroll.render().on('hover:enter click', '[data-tv-scale="open"]', function() {
        showTvScaleDialog();
      });

      scroll.render().on('hover:enter click', '.mc-section__arrow', function() {
        var dir = parseInt($(this).attr('data-dir')) || 0;
        var row = $(this).closest('.mc-section').find('.mc-row-scroll')[0];
        scrollRow(row, dir);
      });

      scroll.render().on('hover:enter click', '.mc-card[data-mid]', function() {
        var movie = $(this).data('movie');
        if (movie) openFullCard(movie);
      });
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
      showMcPopup({ title: '\u0424\u0438\u043B\u044C\u0442\u0440', items: filterItems, focusIdx: startIdx });
    }

    function showTvScaleDialog() {
      var scaleNames = { compact: '\u041A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u044B\u0439', normal: '\u041E\u0431\u044B\u0447\u043D\u044B\u0439', large: '\u041A\u0440\u0443\u043F\u043D\u044B\u0439', xlarge: '\u041E\u0447\u0435\u043D\u044C \u043A\u0440\u0443\u043F\u043D\u044B\u0439' };
      var cur = localStorage.getItem(TV_SCALE_KEY) || 'large';
      var keys = ['compact', 'normal', 'large', 'xlarge'];
      var items = [];
      var startIdx = 2;
      for (var i = 0; i < keys.length; i++) {
        (function(k) {
          items.push({
            name: scaleNames[k],
            checkbox: k === cur,
            onSelect: function() {
              localStorage.setItem(TV_SCALE_KEY, k);
              closeMcPopup();
              updateSizes();
              injectStyles();
              renderPage();
            }
          });
          if (k === cur) startIdx = i;
        })(keys[i]);
      }
      showMcPopup({ title: '\u0420\u0430\u0437\u043C\u0435\u0440 \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430', items: items, focusIdx: startIdx });
    }

    /* Controller */
    Lampa.Controller.add('mc_main', {
      toggle: function() { Lampa.Controller.collectionSet(scroll.render(), scroll.render()); Lampa.Controller.collectionFocus(false, scroll.render()); },
      up: function() { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
      down: function() { Navigator.move('down'); },
      right: function() { Navigator.move('right'); },
      left: function() { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
      back: function() { Lampa.Activity.backward(); }
    });

    Lampa.Activity.push({
      title: PLUGIN_NAME,
      component: 'mc_main',
      onBack: function() { Lampa.Controller.toggle('menu'); }
    });

    setTimeout(function() {
      var active = Lampa.Activity.active();
      if (active && active.activity && active.activity.render) {
        active.activity.render().empty().append(scroll.render());
      }
      renderPage();
      Lampa.Controller.toggle('mc_main');
      try { scroll.update(); } catch(e) {}
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
    btn.on('hover:enter click', function() { showAddToCollectionDialog(card); });

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
