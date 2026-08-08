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
    { id: 'anime',   label: 'Аниме',       icon: '\u26A1' },
    { id: 'fav',     label: 'Избранное',   icon: '\u2764\uFE0F' }
  ];

  var _collectionsCache = null;

  function getScreenScale() {
    var w = window.innerWidth || 1920;
    var scale = w / 1920;
    if (scale < 0.78) scale = 0.78;
    if (scale > 1.30) scale = 1.30;
    return scale;
  }

  function px(v) { return Math.round(v * getScreenScale()) + 'px'; }

  function getCardW() { return Math.round(190 * getScreenScale()); }
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
    if (movie.media_type === 'tv' || movie.media_type === 'show' || movie.media_type === 'tvshows') return 'tv';
    if (movie.number_of_seasons || movie.number_of_episodes) return 'tv';
    if (movie.first_air_date && !movie.release_date) return 'tv';
    return 'movie';
  }

  function detectCategory(movie) {
    var mt = detectMediaType(movie);
    var genres = movie.genre_ids || movie.genres || [];
    if (!Array.isArray(genres)) genres = [];
    if (genres.length && typeof genres[0] === 'object') genres = genres.map(function(g) { return g.id || 0; });
    var hasAnim = false, hasJA = false;
    for (var i = 0; i < genres.length; i++) { if (genres[i] === 16) hasAnim = true; }
    var lang = (movie.original_language || '').toLowerCase();
    if (lang === 'ja') hasJA = true;
    if (mt === 'tv' && hasAnim && hasJA) return 'anime';
    if (mt === 'tv' && hasAnim) return 'anime';
    if (mt === 'movie' && hasAnim) return 'cartoon';
    return mt;
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
    if (cat === 'fav') return all.filter(function(m) { return isInCollection('favorite', m.id); });
    return all.filter(function(m) { return detectCategory(m) === cat; });
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
      genre_ids: movie.genre_ids || [],
      media_type: detectMediaType(movie),
      original_language: movie.original_language || '',
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
    setTimeout(tryAddCardButton, 300);
    setTimeout(tryAddCardButton, 1000);
    setTimeout(tryAddCardButton, 2000);
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
    v[movieId] = { id: movieId, title: movie.title || movie.name || '', name: movie.name || movie.title || '', original_title: movie.original_title || '', original_name: movie.original_name || '', poster_path: movie.poster_path || '', backdrop_path: movie.backdrop_path || '', release_date: movie.release_date || movie.first_air_date || '', first_air_date: movie.first_air_date || '', vote_average: movie.vote_average || 0, genre_ids: movie.genre_ids || [], original_language: movie.original_language || '', timestamp: Date.now() };
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
    r.style.setProperty('--mc-cw', px(190));
    r.style.setProperty('--mc-ch', px(285));
    r.style.setProperty('--mc-lw', px(380));
    r.style.setProperty('--mc-lh', px(213));
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

    var css = ''
    + ':root { --mc-cw:' + px(190) + '; --mc-ch:' + px(285) + '; --mc-lw:' + px(380) + '; --mc-lh:' + px(213) + '; }'

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

    + '.mc-row-scroll { display:flex; gap:' + px(14) + '; padding:0 ' + px(24) + '; overflow-x:auto; overflow-y:hidden; scroll-behavior:smooth; }'
    + '.mc-row-scroll::-webkit-scrollbar { display:none; }'

    + '.mc-row-wrap { display:flex; flex-wrap:wrap; gap:' + px(14) + '; padding:0 ' + px(24) + '; justify-content:center; }'

    + '.mc-card { flex-shrink:0; cursor:pointer; transition:transform .2s; }'
    + '.mc-card:hover,.mc-card.focus { transform:scale(1.04); }'

    + '.mc-card--landscape { width:' + px(380) + '; border-radius:' + px(12) + '; overflow:hidden; position:relative; background:#1a1a2e; }'
    + '.mc-card--landscape .mc-card__backdrop { width:100%; height:' + px(213) + '; background-size:cover; background-position:center; position:relative; }'
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

    + '.mc-card--portrait { width:' + px(190) + '; }'
    + '.mc-card--portrait .mc-card__poster { width:' + px(190) + '; height:' + px(285) + '; border-radius:' + px(10) + '; background-size:cover; background-position:center top; background-color:rgba(255,255,255,0.06); position:relative; overflow:hidden; }'
    + '.mc-card--portrait .mc-card__badge { position:absolute; top:' + px(8) + '; right:' + px(8) + '; background:rgba(0,0,0,0.75); color:#f5c518; font-size:' + px(12) + '; font-weight:700; padding:' + px(3) + ' ' + px(7) + '; border-radius:' + px(6) + '; }'
    + '.mc-card--portrait .mc-card__info { padding:' + px(8) + ' 2px 0; }'
    + '.mc-card--portrait .mc-card__title { font-size:' + px(13) + '; color:#fff; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
    + '.mc-card--portrait .mc-card__subtitle { font-size:' + px(11) + '; color:rgba(255,255,255,0.35); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }'
    + '.mc-card--portrait .mc-card__year { font-size:' + px(12) + '; color:rgba(255,255,255,0.3); margin-top:2px; }'

    + '.mc-empty { padding:' + px(40) + ' ' + px(24) + '; color:rgba(255,255,255,0.25); font-size:' + px(16) + '; text-align:center; }'

    + '.mc-popup { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:1000; display:flex; align-items:center; justify-content:center; }'
    + '.mc-popup__box { background:#1a1b2e; border-radius:' + px(14) + '; width:' + px(420) + '; max-width:80vw; max-height:75vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.6); }'
    + '.mc-popup__head { padding:' + px(18) + ' ' + px(22) + ' ' + px(14) + '; }'
    + '.mc-popup__title { font-size:' + px(20) + '; font-weight:700; color:#fff; }'
    + '.mc-popup__list { padding:' + px(6) + ' ' + px(10) + '; overflow-y:auto; flex:1; }'
    + '.mc-popup__item { display:flex; align-items:center; padding:' + px(13) + ' ' + px(12) + '; border-radius:' + px(10) + '; cursor:pointer; transition:background .1s; gap:' + px(12) + '; }'
    + '.mc-popup__item:hover,.mc-popup__item.focus { background:rgba(255,255,255,0.08); }'
    + '.mc-popup__item-name { flex:1; font-size:' + px(16) + '; color:#fff; font-weight:500; }'
    + '.mc-popup__item-count { font-size:' + px(12) + '; color:rgba(255,255,255,0.25); margin-right:' + px(8) + '; }'
    + '.mc-popup__cb { width:' + px(28) + '; height:' + px(28) + '; border:' + px(2) + ' solid rgba(255,255,255,0.5); border-radius:' + px(5) + '; flex-shrink:0; display:flex; align-items:center; justify-content:center; transition:all .15s; box-sizing:border-box; background:rgba(255,255,255,0.05); }'
    + '.mc-popup__cb.on { border-color:#3bd574; background:rgba(59,213,116,0.15); }'
    + '.mc-popup__cb svg { width:' + px(16) + '; height:' + px(16) + '; fill:none; stroke:#3bd574; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; opacity:0; transform:scale(0.5); transition:all .15s; }'
    + '.mc-popup__cb.on svg { opacity:1; transform:scale(1); }'
    + '.mc-popup__item.focus .mc-popup__cb { border-color:rgba(255,255,255,0.5); }'
    + '.mc-popup__item.focus .mc-popup__cb.on { border-color:#3bd574; }'
    + '.mc-popup__create { display:flex; align-items:center; justify-content:center; gap:' + px(8) + '; padding:' + px(13) + '; margin:' + px(4) + ' ' + px(10) + ' ' + px(10) + '; border-radius:' + px(10) + '; background:rgba(59,213,116,0.1); border:' + px(1) + ' solid rgba(59,213,116,0.25); cursor:pointer; transition:background .1s; }'
    + '.mc-popup__create:hover,.mc-popup__create.focus { background:rgba(59,213,116,0.18); }'
    + '.mc-popup__create-text { font-size:' + px(15) + '; color:#3bd574; font-weight:600; }';

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
      type: 'video', version: '2.1.0', name: PLUGIN_NAME,
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
        if (e.type === 'complite' || e.type === 'start') {
          setTimeout(tryAddCardButton, 500);
          setTimeout(tryAddCardButton, 1500);
          setTimeout(tryAddCardButton, 3000);
        }
      });
    }
    Lampa.Activity.listener.follow('complite', function(a) {
      setTimeout(tryAddCardButton, 800);
      setTimeout(tryAddCardButton, 2000);
    });
    Lampa.Activity.listener.follow('start', function(a) {
      setTimeout(tryAddCardButton, 1200);
      setTimeout(tryAddCardButton, 3000);
    });
  }

  // ========== Popup (shared for Add-to-Collection & Filter) ==========

  function safeBack() {}

  var _popupController = null;
  var _prevController = null;

  function closeMcPopup() {
    var el = document.querySelector('.mc-popup');
    if (el) el.remove();
    var bd = document.querySelector('.mc-popup-backdrop');
    if (bd) bd.remove();
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

    var backdrop = document.createElement('div');
    backdrop.className = 'mc-popup-backdrop';
    backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;background:rgba(0,0,0,0.5);';

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
    document.body.appendChild(backdrop);
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
    backdrop.addEventListener('click', function() { closeMcPopup(); });

    $(list).on('click hover:enter', '.mc-popup__item', function() {
      var idx = parseInt($(this).attr('data-idx'));
      if (!isNaN(idx)) { focusIdx = idx; updateFocus(); selectItem(idx); }
    });

    _prevController = Lampa.Controller.active() || 'mc_main';
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

  function getButtonStyle(inAny) {
    if (inAny) return 'display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:8px 16px;border-radius:8px;background:rgba(59,213,116,0.25);color:#3bd574;border:1px solid rgba(59,213,116,0.4);margin:4px;font-weight:500;';
    return 'display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:8px 16px;border-radius:8px;background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.2);margin:4px;';
  }

  function openFullCard(movie) {
    var mt = detectMediaType(movie);
    movie.media_type = mt;
    movie.media = mt;
    movie.source = 'tmdb';
    Lampa.Activity.push({
      title: movie.title || movie.name || '',
      component: 'full',
      card: movie,
      data: { movie: movie }
    });
  }

  function tryAddCardButton() {
    try {
      var active = Lampa.Activity.active();
      if (!active) return;

      var movie = active.card || (active.data && active.data.movie);
      if (!movie || !movie.id) return;

      var render = active.activity.render();
      if (!render || !render.length) return;

      var existing = render.find('.my-collections-btn');
      var inAny = isMovieInAnyCollection(movie.id);

      if (existing.length) {
        existing.attr('style', getButtonStyle(inAny));
        existing.find('.mc-btn-text').text(PLUGIN_NAME + (inAny ? ' \u2713' : ''));
        return;
      }

      var btn = $('<div class="full-start__button selector my-collections-btn" style="' + getButtonStyle(inAny) + '"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span class="mc-btn-text">' + PLUGIN_NAME + (inAny ? ' \u2713' : '') + '</span></div>');

      btn.on('hover:enter click', function() { showAddToCollectionDialog(movie); });

      var targets = ['.full-start__buttons .full-start__button:last-child', '.full-start__buttons', '.full-start__left', '.detail-page__buttons', '.card--more', '.buttons-full', '.full-start__tag', '.detail-page__header', '.detail-page__container', '.full-start', '.content'];

      var inserted = false;
      for (var t = 0; t < targets.length; t++) {
        var el = render.find(targets[t]);
        if (el.length) { el.last().after(btn); inserted = true; break; }
      }
      if (!inserted) {
        var anyBtn = render.find('.selector').filter(function() { return $(this).text().indexOf('\u0422\u043E\u0440\u0440\u0435\u043D\u0442') >= 0 || $(this).text().indexOf('\u041E\u043D\u043B\u0430\u0439\u043D') >= 0 || $(this).text().indexOf('\u0422\u0440\u0435\u0439\u043B\u0435\u0440') >= 0; }).first();
        if (anyBtn.length) { anyBtn.parent().append(btn); inserted = true; }
      }
      if (!inserted) render.prepend(btn);
    } catch(e) {}
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
