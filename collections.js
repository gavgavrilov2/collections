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
    { id: 'all',    label: 'Все',          icon: '\uD83D\uDCE6' },
    { id: 'movie',  label: 'Фильмы',       icon: '\uD83C\uDFAC' },
    { id: 'tv',     label: 'Сериалы',      icon: '\uD83D\uDCFA' },
    { id: 'cartoon',label: 'Мультфильмы',  icon: '\uD83C\uDFA8' },
    { id: 'anime',  label: 'Аниме',        icon: '\u26A1' },
    { id: 'fav',    label: 'Избранное',    icon: '\u2764\uFE0F' }
  ];

  var CARD_W = 175;
  var CARD_H = 262;
  var LANDSCAPE_W = 320;
  var LANDSCAPE_H = 180;

  var _collectionsCache = null;

  function getCollections() {
    if (_collectionsCache) return _collectionsCache;

    var fromLocal = null;
    var fromStorage = null;

    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.watched && parsed.watched.movies) {
          fromLocal = parsed;
        }
      }
    } catch(e) {}

    try {
      var sData = Lampa.Storage.get(STORAGE_KEY);
      if (sData && typeof sData === 'object' && sData.watched && sData.watched.movies) {
        fromStorage = sData;
      }
    } catch(e) {}

    if (fromLocal && fromStorage) {
      var merged = mergeCollections(fromLocal, fromStorage);
      saveCollections(merged);
      _collectionsCache = merged;
      return merged;
    }

    if (fromLocal) {
      _collectionsCache = fromLocal;
      try { Lampa.Storage.set(STORAGE_KEY, fromLocal); } catch(e) {}
      return fromLocal;
    }

    if (fromStorage) {
      _collectionsCache = fromStorage;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fromStorage)); } catch(e) {}
      return fromStorage;
    }

    var data = JSON.parse(JSON.stringify(DEFAULT_COLLECTIONS));
    saveCollections(data);
    return data;
  }

  function mergeCollections(a, b) {
    var result = JSON.parse(JSON.stringify(a));
    var k = Object.keys(b);
    for (var i = 0; i < k.length; i++) {
      var key = k[i];
      if (!result[key]) {
        result[key] = b[key];
        continue;
      }
      var seen = {};
      var mergedMovies = [];
      var allA = result[key].movies || [];
      var allB = b[key].movies || [];
      for (var j = 0; j < allA.length; j++) {
        if (!seen[allA[j].id]) { seen[allA[j].id] = true; mergedMovies.push(allA[j]); }
      }
      for (var j = 0; j < allB.length; j++) {
        if (!seen[allB[j].id]) { seen[allB[j].id] = true; mergedMovies.push(allB[j]); }
      }
      result[key].movies = mergedMovies;
    }
    return result;
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
    if (movie.media_type === 'tv' || movie.media_type === 'show') return 'tv';
    if (movie.first_air_date || movie.number_of_seasons || movie.number_of_episodes) return 'tv';
    var name = movie.name || '';
    var origName = movie.original_name || '';
    if (name && origName && name !== origName) return 'tv';
    if (!movie.title && name) return 'tv';
    var release = movie.release_date || '';
    var firstAir = movie.first_air_date || '';
    if (release && firstAir && firstAir !== release) return 'tv';
    return 'movie';
  }

  function detectCategory(movie) {
    var mt = detectMediaType(movie);
    var genres = movie.genre_ids || movie.genres || [];
    if (typeof genres === 'object' && !Array.isArray(genres)) genres = [];
    var hasAnimation = false;
    var hasJapanese = false;
    if (genres.length && typeof genres[0] === 'object') {
      genres = genres.map(function(g) { return g.id || 0; });
    }
    for (var i = 0; i < genres.length; i++) {
      if (genres[i] === 16) hasAnimation = true;
    }
    var lang = (movie.original_language || '').toLowerCase();
    if (lang === 'ja') hasJapanese = true;
    if (mt === 'tv' && hasAnimation && hasJapanese) return 'anime';
    if (mt === 'movie' && hasAnimation) return 'cartoon';
    if (mt === 'tv' && hasAnimation) return 'cartoon';
    return mt;
  }

  function getAllMovies() {
    var cols = getCollections();
    var all = [];
    var seen = {};
    var k = Object.keys(cols);
    for (var i = 0; i < k.length; i++) {
      var movies = cols[k[i]].movies;
      for (var j = 0; j < movies.length; j++) {
        var m = movies[j];
        if (!seen[m.id]) {
          seen[m.id] = true;
          all.push(m);
        }
      }
    }
    return all;
  }

  function getMoviesByCategory(cat) {
    var all = getAllMovies();
    if (cat === 'all') return all;
    if (cat === 'fav') {
      return all.filter(function(m) { return isInCollection('favorite', m.id); });
    }
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
    var d = movie.release_date || movie.first_air_date || '';
    return d.substring(0, 4) || '';
  }

  function openFullCard(movie) {
    var mt = detectMediaType(movie);
    var card = {
      id: movie.id,
      media_type: mt,
      title: movie.title || movie.name || '',
      name: movie.name || movie.title || '',
      original_title: movie.original_title || movie.original_name || '',
      original_name: movie.original_name || movie.original_title || '',
      poster_path: movie.poster_path || '',
      backdrop_path: movie.backdrop_path || '',
      release_date: movie.release_date || movie.first_air_date || '',
      first_air_date: movie.first_air_date || '',
      vote_average: movie.vote_average || 0,
      vote_count: movie.vote_count || 0,
      overview: movie.overview || '',
      genre_ids: movie.genre_ids || [],
      source: 'tmdb'
    };
    Lampa.Activity.push({
      title: card.title,
      component: 'full',
      card: card,
      data: { movie: card }
    });
  }

  function addToCollection(collectionId, movie) {
    var collections = getCollections();
    var col = collections[collectionId];
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
    saveCollections(collections);
    return true;
  }

  function removeFromCollection(collectionId, movieId) {
    var collections = getCollections();
    var col = collections[collectionId];
    if (!col) return false;
    var found = false;
    col.movies = col.movies.filter(function(m) {
      if (m.id === movieId) { found = true; return false; }
      return true;
    });
    if (found) saveCollections(collections);
    return found;
  }

  function deleteCollection(collectionId) {
    var collections = getCollections();
    if (collections[collectionId] && collections[collectionId].isDefault) return false;
    delete collections[collectionId];
    saveCollections(collections);
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

  // ========== Watch Tracking ==========

  function getProgress() {
    try {
      var raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function saveProgress(data) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function updateProgress(movieId, info) {
    var p = getProgress();
    p[movieId] = {
      time: info.time || 0,
      duration: info.duration || 0,
      episode: info.episode || '',
      season: info.season || '',
      title: info.title || '',
      updated: Date.now()
    };
    saveProgress(p);
  }

  function getViewed() {
    try {
      var raw = localStorage.getItem(VIEWED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function saveViewed(data) {
    try { localStorage.setItem(VIEWED_KEY, JSON.stringify(data)); } catch(e) {}
  }

  function markViewed(movieId, movie) {
    var v = getViewed();
    v[movieId] = {
      id: movieId,
      title: movie.title || movie.name || '',
      name: movie.name || movie.title || '',
      original_title: movie.original_title || '',
      original_name: movie.original_name || '',
      poster_path: movie.poster_path || '',
      backdrop_path: movie.backdrop_path || '',
      release_date: movie.release_date || movie.first_air_date || '',
      first_air_date: movie.first_air_date || '',
      vote_average: movie.vote_average || 0,
      genre_ids: movie.genre_ids || [],
      original_language: movie.original_language || '',
      timestamp: Date.now()
    };
    saveViewed(v);
  }

  function getContinueWatching() {
    var progress = getProgress();
    var allMovies = getAllMovies();
    var ids = Object.keys(progress);
    var items = [];
    for (var i = 0; i < ids.length; i++) {
      var pid = ids[i];
      var pr = progress[pid];
      if (!pr || !pr.duration || pr.time < 60) continue;
      var pct = Math.floor((pr.time / pr.duration) * 100);
      if (pct >= 95) continue;
      var movie = null;
      for (var j = 0; j < allMovies.length; j++) {
        if (String(allMovies[j].id) === String(pid)) { movie = allMovies[j]; break; }
      }
      if (!movie) {
        movie = { id: pid, title: pr.title || '', name: pr.title || '' };
      }
      items.push({
        movie: movie,
        progress: pr,
        percent: pct,
        left: Math.ceil((pr.duration - pr.time) / 60)
      });
    }
    items.sort(function(a, b) { return (b.progress.updated || 0) - (a.progress.updated || 0); });
    return items.slice(0, 12);
  }

  function getRecentlyAdded() {
    var cols = getCollections();
    var all = [];
    var seen = {};
    var k = Object.keys(cols);
    for (var i = 0; i < k.length; i++) {
      var movies = cols[k[i]].movies;
      for (var j = 0; j < movies.length; j++) {
        var m = movies[j];
        if (!seen[m.id]) {
          seen[m.id] = true;
          all.push(m);
        }
      }
    }
    all.sort(function(a, b) { return (b.added_at || 0) - (a.added_at || 0); });
    return all.slice(0, 20);
  }

  function getRecentlyViewed() {
    var v = getViewed();
    var ids = Object.keys(v);
    var items = [];
    for (var i = 0; i < ids.length; i++) {
      var vid = ids[i];
      var vi = v[vid];
      if (!vi) continue;
      items.push(vi);
    }
    items.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    return items.slice(0, 20);
  }

  // ========== Init Tracking Hooks ==========

  function initTracking() {
    if (typeof Lampa.Listener !== 'undefined') {
      Lampa.Listener.follow('full', function(e) {
        if (e.type === 'complite' || e.type === 'start') {
          var movie = e.card || (e.data && e.data.movie);
          if (movie && movie.id) {
            markViewed(movie.id, movie);
          }
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
                  title: movie.title || movie.name || ''
                });
              }
            }
          }
        });
      }
    } catch(e) {}
  }

  // ========== CSS ==========

  function injectStyles() {
    if (document.getElementById('mc-styles-v2')) return;
    var css = ''
    + '.mc-page { padding:0 0 80px 0; box-sizing:border-box; width:100%; background:linear-gradient(180deg, #111122 0%, #0a0a1a 100%); min-height:100vh; }'

    + '.mc-tabs { display:flex; gap:10px; padding:20px 24px 16px; overflow-x:auto; align-items:center; }'
    + '.mc-tabs::-webkit-scrollbar { display:none; }'
    + '.mc-tab { flex-shrink:0; display:flex; align-items:center; gap:8px; padding:10px 20px; border-radius:24px; background:rgba(255,255,255,0.06); border:1.5px solid transparent; cursor:pointer; transition:all .2s; }'
    + '.mc-tab:hover,.mc-tab.focus { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.15); }'
    + '.mc-tab.active { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.3); }'
    + '.mc-tab__icon { font-size:16px; }'
    + '.mc-tab__label { font-size:14px; color:rgba(255,255,255,0.6); font-weight:500; }'
    + '.mc-tab.active .mc-tab__label { color:#fff; }'
    + '.mc-tab__count { font-size:12px; color:rgba(255,255,255,0.3); margin-left:2px; }'

    + '.mc-filter-btn { flex-shrink:0; display:flex; align-items:center; gap:6px; padding:10px 18px; border-radius:24px; background:rgba(255,255,255,0.06); border:1.5px solid transparent; cursor:pointer; transition:all .2s; margin-left:auto; }'
    + '.mc-filter-btn:hover,.mc-filter-btn.focus { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.15); }'
    + '.mc-filter-btn.active { background:rgba(59,213,116,0.12); border-color:rgba(59,213,116,0.4); }'
    + '.mc-filter-btn__label { font-size:14px; color:rgba(255,255,255,0.6); }'
    + '.mc-filter-btn.active .mc-filter-btn__label { color:#3bd574; }'

    + '.mc-view-btn { flex-shrink:0; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.06); border:1.5px solid transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; }'
    + '.mc-view-btn:hover,.mc-view-btn.focus { background:rgba(255,255,255,0.1); }'
    + '.mc-view-btn.active { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.3); }'
    + '.mc-view-btn svg { width:18px; height:18px; fill:rgba(255,255,255,0.5); }'
    + '.mc-view-btn.active svg { fill:#fff; }'

    + '.mc-section { margin-bottom:28px; }'
    + '.mc-section__head { display:flex; align-items:center; padding:0 24px 14px; gap:12px; }'
    + '.mc-section__title { font-size:22px; font-weight:700; color:#fff; flex:1; }'
    + '.mc-section__arrows { display:flex; gap:8px; }'
    + '.mc-section__arrow { width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; }'
    + '.mc-section__arrow:hover,.mc-section__arrow.focus { background:rgba(255,255,255,0.15); }'
    + '.mc-section__arrow svg { width:16px; height:16px; fill:none; stroke:rgba(255,255,255,0.6); stroke-width:2; }'

    + '.mc-row { display:flex; gap:14px; padding:0 24px; overflow-x:auto; overflow-y:hidden; scroll-behavior:smooth; }'
    + '.mc-row::-webkit-scrollbar { display:none; }'

    + '.mc-card { flex-shrink:0; cursor:pointer; transition:transform .2s; }'
    + '.mc-card:hover,.mc-card.focus { transform:scale(1.04); }'

    + '.mc-card--landscape { width:' + LANDSCAPE_W + 'px; border-radius:12px; overflow:hidden; position:relative; background:#1a1a2e; }'
    + '.mc-card--landscape .mc-card__backdrop { width:100%; height:' + LANDSCAPE_H + 'px; background-size:cover; background-position:center; position:relative; }'
    + '.mc-card--landscape .mc-card__gradient { position:absolute; bottom:0; left:0; right:0; height:70%; background:linear-gradient(transparent, rgba(0,0,0,0.85)); }'
    + '.mc-card--landscape .mc-card__play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.9); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity .2s; }'
    + '.mc-card--landscape:hover .mc-card__play,.mc-card--landscape.focus .mc-card__play { opacity:1; }'
    + '.mc-card--landscape .mc-card__play svg { width:18px; height:18px; fill:#111; margin-left:2px; }'
    + '.mc-card--landscape .mc-card__info { padding:12px 14px; }'
    + '.mc-card--landscape .mc-card__title { font-size:15px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
    + '.mc-card--landscape .mc-card__subtitle { font-size:12px; color:rgba(255,255,255,0.45); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
    + '.mc-card--landscape .mc-card__meta { font-size:11px; color:rgba(255,255,255,0.35); margin-top:4px; }'
    + '.mc-card--landscape .mc-card__progress { height:3px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:8px; overflow:hidden; }'
    + '.mc-card--landscape .mc-card__progress-bar { height:100%; background:#3bd574; border-radius:2px; }'
    + '.mc-card--landscape .mc-card__left { font-size:11px; color:#3bd574; margin-top:4px; }'

    + '.mc-card--portrait { width:' + CARD_W + 'px; }'
    + '.mc-card--portrait .mc-card__poster { width:' + CARD_W + 'px; height:' + CARD_H + 'px; border-radius:10px; background-size:cover; background-position:center top; background-color:rgba(255,255,255,0.06); position:relative; overflow:hidden; }'
    + '.mc-card--portrait .mc-card__badge { position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.75); color:#f5c518; font-size:12px; font-weight:700; padding:3px 7px; border-radius:6px; }'
    + '.mc-card--portrait .mc-card__menu { position:absolute; top:8px; left:8px; width:28px; height:28px; border-radius:50%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity .2s; }'
    + '.mc-card--portrait:hover .mc-card__menu,.mc-card--portrait.focus .mc-card__menu { opacity:1; }'
    + '.mc-card--portrait .mc-card__menu-dots { color:#fff; font-size:14px; }'
    + '.mc-card--portrait .mc-card__info { padding:8px 2px 0; }'
    + '.mc-card--portrait .mc-card__title { font-size:13px; color:#fff; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
    + '.mc-card--portrait .mc-card__subtitle { font-size:11px; color:rgba(255,255,255,0.35); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }'
    + '.mc-card--portrait .mc-card__year { font-size:12px; color:rgba(255,255,255,0.3); margin-top:2px; }'

    + '.mc-empty { padding:40px 24px; color:rgba(255,255,255,0.25); font-size:16px; text-align:center; }'

    + '.mc-dialog-item { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; cursor:pointer; border-radius:10px; background:rgba(255,255,255,0.04); margin-bottom:6px; transition:background .1s; }'
    + '.mc-dialog-item:hover,.mc-dialog-item.focus { background:rgba(255,255,255,0.1); }'

    + '.mc-overlay { position:fixed; inset:0; z-index:200; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); backdrop-filter:blur(6px); }'
    + '.mc-dialog { width:420px; max-width:90vw; max-height:80vh; background:#1a1a2e; border-radius:16px; overflow:hidden; display:flex; flex-direction:column; }'
    + '.mc-dialog__header { padding:20px 24px 12px; border-bottom:1px solid rgba(255,255,255,0.06); }'
    + '.mc-dialog__title { font-size:20px; font-weight:700; color:#fff; }'
    + '.mc-dialog__list { padding:12px; overflow-y:auto; flex:1; }'
    + '.mc-dialog__item { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-radius:10px; cursor:pointer; transition:background .12s; }'
    + '.mc-dialog__item:hover,.mc-dialog__item.focus { background:rgba(255,255,255,0.08); }'
    + '.mc-dialog__item-left { display:flex; align-items:center; gap:12px; flex:1; }'
    + '.mc-dialog__item-name { font-size:16px; color:#fff; font-weight:500; }'
    + '.mc-dialog__item-count { font-size:13px; color:rgba(255,255,255,0.3); margin-left:4px; }'

    + '.mc-checkbox { width:32px; height:32px; border:4px solid rgba(255,255,255,0.22); border-radius:6px; background:transparent; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:border-color .15s ease, transform .12s ease; box-sizing:border-box; }'
    + '.mc-checkbox.on { border-color:rgba(255,255,255,0.95); }'
    + '.mc-checkbox:hover { border-color:rgba(255,255,255,0.42); }'
    + '.mc-checkbox.on:hover { border-color:#fff; }'
    + '.mc-checkbox:active { transform:scale(0.94); }'
    + '.mc-checkbox svg { width:20px; height:20px; fill:none; stroke:#fff; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; opacity:0; transform:scale(0.6); transition:opacity .15s ease, transform .15s ease; }'
    + '.mc-checkbox.on svg { opacity:1; transform:scale(1); }'

    + '.mc-dialog__create { display:flex; align-items:center; justify-content:center; gap:8px; padding:14px; margin:0 12px 12px; border-radius:10px; background:rgba(59,213,116,0.12); border:1px solid rgba(59,213,116,0.3); cursor:pointer; transition:background .12s; }'
    + '.mc-dialog__create:hover,.mc-dialog__create.focus { background:rgba(59,213,116,0.2); }'
    + '.mc-dialog__create-text { font-size:15px; color:#3bd574; font-weight:600; }';

    var style = document.createElement('style');
    style.id = 'mc-styles-v2';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ========== Plugin ==========

  function startPlugin() {
    if (window._my_collections_plugin) return;
    window._my_collections_plugin = true;
    injectStyles();

    Lampa.Manifest.plugins = {
      type: 'video', version: '2.0.0', name: PLUGIN_NAME,
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

  // ========== Add Dialog ==========

  function safeBack() {}

  function showAddToCollectionDialog(movie) {
    var collections = getCollections();
    var keys = Object.keys(collections);

    function showDialog() {
      var overlay = $('<div class="mc-overlay"></div>');
      var dialog = $('<div class="mc-dialog"></div>');

      dialog.append($('<div class="mc-dialog__header"><div class="mc-dialog__title">' + PLUGIN_NAME + '</div></div>'));

      var list = $('<div class="mc-dialog__list"></div>');

      var items = [];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var col = collections[key];
        var inCol = isInCollection(key, movie.id);
        var count = col.movies ? col.movies.length : 0;

        var item = $(
          '<div class="mc-dialog__item selector" data-key="' + key + '">'
          + '<div class="mc-dialog__item-left">'
          + '<div class="mc-dialog__item-name">' + col.name + '</div>'
          + '<div class="mc-dialog__item-count">' + count + '</div>'
          + '</div>'
          + '<div class="mc-checkbox' + (inCol ? ' on' : '') + '">'
          + '<svg viewBox="0 0 24 24"><polyline points="5 12.5 10 17 19 7"/></svg>'
          + '</div>'
          + '</div>'
        ).data({ key: key, movie: movie, inCol: inCol });
        list.append(item);
        items.push(item);
      }

      dialog.append(list);

      var createBtn = $(
        '<div class="mc-dialog__create selector" data-action="create">'
        + '<span style="font-size:18px;color:#3bd574;">+</span>'
        + '<span class="mc-dialog__create-text">\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E</span>'
        + '</div>'
      );
      dialog.append(createBtn);

      overlay.append(dialog);
      $('body').append(overlay);

      function closeDialog() {
        overlay.remove();
        Lampa.Controller.toggle('full');
      }

      function refreshDialog() {
        overlay.remove();
        collections = getCollections();
        keys = Object.keys(collections);
        showDialog();
      }

      overlay.on('click', function(e) {
        if (e.target === overlay[0]) closeDialog();
      });

      dialog.on('hover:enter click', '.mc-dialog__item', function() {
        var key = $(this).data('key');
        var movie = $(this).data('movie');
        var wasIn = isInCollection(key, movie.id);

        if (wasIn) {
          removeFromCollection(key, movie.id);
          Lampa.Noty.show('\u0423\u0431\u0440\u0430\u043D\u043E \u0438\u0437 \u00AB' + collections[key].name + '\u00BB');
        } else {
          addToCollection(key, movie);
          Lampa.Noty.show('\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u00AB' + collections[key].name + '\u00BB');
        }

        _collectionsCache = null;
        refreshCardButton();
        refreshDialog();
      });

      dialog.on('hover:enter click', '[data-action="create"]', function() {
        overlay.remove();
        showCreateCollectionDialog(movie);
      });

      Lampa.Controller.add('mc_dialog', {
        toggle: function() {
          Lampa.Controller.collectionSet(dialog, dialog);
          Lampa.Controller.collectionFocus(false, dialog);
        },
        up: function() { Navigator.move('up'); },
        down: function() { Navigator.move('down'); },
        right: function() { Navigator.move('right'); },
        left: function() { Navigator.move('left'); },
        back: function() {
          overlay.remove();
          Lampa.Controller.toggle('full');
        }
      });

      setTimeout(function() {
        Lampa.Controller.toggle('mc_dialog');
        if (items.length) {
          var firstItem = items[0];
          firstItem.addClass('focus');
        }
      }, 100);
    }

    showDialog();
  }

  function showCreateCollectionDialog(movie) {
    var predefinedNames = [
      '\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435',
      '\u041A\u043E\u043C\u0435\u0434\u0438\u0438',
      '\u0423\u0436\u0430\u0441\u044B',
      '\u0424\u0430\u043D\u0442\u0430\u0441\u0442\u0438\u043A\u0430',
      '\u041C\u0435\u043B\u043E\u0434\u0440\u0430\u043C\u044B',
      '\u0411\u043E\u0435\u0432\u0438\u043A\u0438',
      '\u0414\u0435\u0442\u0435\u043A\u0442\u0438\u0432\u044B',
      '\u0414\u0440\u0430\u043C\u044B',
      '\u041C\u044E\u0437\u0438\u043A\u043B\u044B',
      '\u0418\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0435',
      '\u0412\u043E\u0435\u043D\u043D\u044B\u0435',
      '\u041A\u0440\u0438\u043C\u0438\u043D\u0430\u043B',
      '\u0417\u0430\u0433\u0430\u0434\u043A\u0438',
      '\u0421\u0435\u043C\u0435\u0439\u043D\u044B\u0435',
      '\u0414\u0435\u0442\u0441\u043A\u0438\u0435'
    ];

    var overlay = $('<div class="mc-overlay"></div>');
    var dialog = $('<div class="mc-dialog"></div>');

    dialog.append($('<div class="mc-dialog__header"><div class="mc-dialog__title">\u041D\u043E\u0432\u0430\u044F \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F</div></div>'));

    var list = $('<div class="mc-dialog__list"></div>');

    for (var i = 0; i < predefinedNames.length; i++) {
      var name = predefinedNames[i];
      var item = $(
        '<div class="mc-dialog__item selector" data-name="' + name + '">'
        + '<div class="mc-dialog__item-left">'
        + '<div class="mc-dialog__item-name">' + name + '</div>'
        + '</div>'
        + '</div>'
      );
      list.append(item);
    }

    dialog.append(list);
    overlay.append(dialog);
    $('body').append(overlay);

    dialog.on('hover:enter click', '.mc-dialog__item', function() {
      var name = $(this).data('name');
      if (name) {
        createAndAdd(name, '', movie);
        overlay.remove();
        showAddToCollectionDialog(movie);
      }
    });

    Lampa.Controller.add('mc_create', {
      toggle: function() {
        Lampa.Controller.collectionSet(dialog, dialog);
        Lampa.Controller.collectionFocus(false, dialog);
      },
      up: function() { Navigator.move('up'); },
      down: function() { Navigator.move('down'); },
      right: function() { Navigator.move('right'); },
      left: function() { Navigator.move('left'); },
      back: function() {
        overlay.remove();
        showAddToCollectionDialog(movie);
      }
    });

    setTimeout(function() { Lampa.Controller.toggle('mc_create'); }, 100);
  }

  // ========== Scroll Helper ==========

  function enableWheelScroll(el) {
    if (!el || !el.addEventListener) return;
    el.addEventListener('wheel', function(e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  function scrollRow(row, direction) {
    if (!row) return;
    var scrollAmount = direction * (LANDSCAPE_W + 30);
    row.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }

  // ========== Main Page ==========

  function openCollectionsPage() {
    var activeTab = localStorage.getItem(ACTIVE_TAB_KEY) || 'all';
    var activeFilter = localStorage.getItem(ACTIVE_FILTER_KEY) || 'all';
    var allMovies = getAllMovies();

    var scroll = new Lampa.Scroll({ mask: true, over: true });
    scroll.body().addClass('mc-page');

    var contentEl = $('<div></div>');
    scroll.append(contentEl);

    function renderPage() {
      contentEl.empty();

      var filteredMovies = getMoviesByCategory(activeTab);
      if (activeFilter !== 'all') {
        filteredMovies = filteredMovies.filter(function(m) {
          return isInCollection(activeFilter, m.id);
        });
      }

      var continueWatching = getContinueWatching();
      if (activeTab !== 'all') {
        continueWatching = continueWatching.filter(function(item) {
          return detectCategory(item.movie) === activeTab;
        });
      }

      var recentlyAdded = getRecentlyAdded();
      if (activeTab !== 'all') {
        recentlyAdded = recentlyAdded.filter(function(m) {
          return detectCategory(m) === activeTab;
        });
      }
      if (activeFilter !== 'all') {
        recentlyAdded = recentlyAdded.filter(function(m) {
          return isInCollection(activeFilter, m.id);
        });
      }

      var recentlyViewed = getRecentlyViewed();
      if (activeTab !== 'all') {
        recentlyViewed = recentlyViewed.filter(function(m) {
          return detectCategory(m) === activeTab;
        });
      }

      /* Tabs */
      var tabsEl = $('<div class="mc-tabs"></div>');
      for (var t = 0; t < TYPE_TABS.length; t++) {
        var tab = TYPE_TABS[t];
        var tabMovies = getMoviesByCategory(tab.id);
        var count = tabMovies.length;
        var isActive = activeTab === tab.id;
        tabsEl.append($(
          '<div class="mc-tab selector' + (isActive ? ' active' : '') + '" data-tab="' + tab.id + '">'
          + '<span class="mc-tab__icon">' + tab.icon + '</span>'
          + '<span class="mc-tab__label">' + tab.label + '</span>'
          + '<span class="mc-tab__count">' + count + '</span>'
          + '</div>'
        ));
      }

      var filterLabel = '\u0424\u0438\u043B\u044C\u0442\u0440\u044B';
      if (activeFilter !== 'all') {
        var cols = getCollections();
        if (cols[activeFilter]) filterLabel = cols[activeFilter].name;
      }
      var filterBtn = $(
        '<div class="mc-filter-btn selector' + (activeFilter !== 'all' ? ' active' : '') + '" data-filter="toggle">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>'
        + '<span class="mc-filter-btn__label">' + filterLabel + '</span>'
        + '</div>'
      );
      tabsEl.append(filterBtn);
      contentEl.append(tabsEl);

      var hasAny = continueWatching.length > 0 || recentlyAdded.length > 0 || recentlyViewed.length > 0;

      if (hasAny) {
        if (continueWatching.length > 0) {
          renderContinueWatching(continueWatching);
        }
        if (recentlyAdded.length > 0) {
          renderPortraitSection('\u041D\u0435\u0434\u0430\u0432\u043D\u043E \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E', recentlyAdded, 'added');
        }
        if (recentlyViewed.length > 0) {
          renderPortraitSection('\u041D\u0435\u0434\u0430\u0432\u043D\u043E \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E', recentlyViewed, 'viewed');
        }
      } else {
        contentEl.append($('<div class="mc-empty">\u041F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E. \u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0439\u0442\u0435 \u0444\u0438\u043B\u044C\u043C\u044B \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A.</div>'));
      }

      bindEvents();
      try { scroll.update(); } catch(e) {}
    }

    function renderContinueWatching(items) {
      var section = $('<div class="mc-section"></div>');
      var head = $(
        '<div class="mc-section__head">'
        + '<div class="mc-section__title">\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440</div>'
        + '<div class="mc-section__arrows">'
        + '<div class="mc-section__arrow selector" data-dir="-1"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div>'
        + '<div class="mc-section__arrow selector" data-dir="1"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></div>'
        + '</div>'
        + '</div>'
      );
      section.append(head);

      var row = $('<div class="mc-row"></div>');
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var m = item.movie;
        var bg = backdropUrl(m);
        var meta = '';
        if (item.progress.season) meta = 'S' + item.progress.season + ' \u00B7 E' + item.progress.episode;
        else if (item.progress.episode) meta = '\u042D\u043F. ' + item.progress.episode;

        var card = $(
          '<div class="mc-card mc-card--landscape selector" data-mid="' + m.id + '">'
          + '<div class="mc-card__backdrop" style="background-image:url(' + (bg || '') + ')">'
          + '<div class="mc-card__gradient"></div>'
          + '<div class="mc-card__play"><svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>'
          + '</div>'
          + '<div class="mc-card__info">'
          + '<div class="mc-card__title">' + (m.title || m.name || '') + '</div>'
          + '<div class="mc-card__subtitle">' + (m.original_title || m.original_name || '') + '</div>'
          + (meta ? '<div class="mc-card__meta">' + meta + '</div>' : '')
          + '<div class="mc-card__progress"><div class="mc-card__progress-bar" style="width:' + item.percent + '%"></div></div>'
          + '<div class="mc-card__left">' + item.left + ' \u043C\u0438\u043D \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C</div>'
          + '</div>'
          + '</div>'
        ).data('movie', m);
        row.append(card);
      }
      enableWheelScroll(row[0]);
      section.append(row);
      contentEl.append(section);
    }

    function renderPortraitSection(title, movies, type) {
      var section = $('<div class="mc-section"></div>');
      var head = $(
        '<div class="mc-section__head">'
        + '<div class="mc-section__title">' + title + '</div>'
        + '<div class="mc-section__arrows">'
        + '<div class="mc-section__arrow selector" data-dir="-1"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg></div>'
        + '<div class="mc-section__arrow selector" data-dir="1"><svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg></div>'
        + '</div>'
        + '</div>'
      );
      section.append(head);

      var row = $('<div class="mc-row"></div>');
      for (var i = 0; i < movies.length; i++) {
        var m = movies[i];
        var url = posterUrl(m);
        var year = getYear(m);
        var rating = (m.vote_average || 0).toFixed(1);
        var inAny = isMovieInAnyCollection(m.id);

        var card = $(
          '<div class="mc-card mc-card--portrait selector" data-mid="' + m.id + '">'
          + '<div class="mc-card__poster" style="background-image:url(' + (url || '') + ')">'
          + (m.vote_average > 0 ? '<div class="mc-card__badge">' + rating + '</div>' : '')
          + (inAny ? '<div class="mc-card__menu"><span class="mc-card__menu-dots">\u2713</span></div>' : '')
          + '</div>'
          + '<div class="mc-card__info">'
          + '<div class="mc-card__title">' + (m.title || m.name || '') + '</div>'
          + '<div class="mc-card__subtitle">' + (m.original_title || m.original_name || '') + '</div>'
          + (year ? '<div class="mc-card__year">' + year + '</div>' : '')
          + '</div>'
          + '</div>'
        ).data('movie', m);
        row.append(card);
      }
      enableWheelScroll(row[0]);
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
        var row = $(this).closest('.mc-section').find('.mc-row')[0];
        scrollRow(row, dir);
      });

      scroll.render().on('hover:enter click', '.mc-card[data-mid]', function() {
        var movie = $(this).data('movie');
        if (movie) openFullCard(movie);
      });
    }

    function showFilterDialog() {
      var cols = getCollections();
      var items = [
        { title: '\u2610  \u0412\u0441\u0435', _filter: 'all' }
      ];
      var k = Object.keys(cols);
      for (var i = 0; i < k.length; i++) {
        var key = k[i];
        var col = cols[key];
        var inF = activeFilter === key;
        items.push({
          title: (inF ? '\u2611' : '\u2610') + '  ' + col.name,
          _filter: key
        });
      }
      Lampa.Select.show({
        title: '\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044F\u043C',
        items: items,
        onSelect: function(item) {
          activeFilter = item._filter || 'all';
          localStorage.setItem(ACTIVE_FILTER_KEY, activeFilter);
          renderPage();
        },
        onBack: function() { renderPage(); }
      });
    }

    /* Controller */
    Lampa.Controller.add('mc_main', {
      toggle: function() {
        Lampa.Controller.collectionSet(scroll.render(), scroll.render());
        Lampa.Controller.collectionFocus(false, scroll.render());
      },
      up: function() {
        if (Navigator.canmove('up')) Navigator.move('up');
        else Lampa.Controller.toggle('head');
      },
      down: function() { Navigator.move('down'); },
      right: function() { Navigator.move('right'); },
      left: function() {
        if (Navigator.canmove('left')) Navigator.move('left');
        else Lampa.Controller.toggle('menu');
      },
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
        var render = active.activity.render();
        render.empty().append(scroll.render());
      }
      renderPage();
      Lampa.Controller.toggle('mc_main');
      try { scroll.update(); } catch(e) {}
    }, 300);
  }

  // ========== Card Button ==========

  function getButtonStyle(inAny) {
    if (inAny) {
      return 'display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:8px 16px;border-radius:8px;background:rgba(59,213,116,0.25);color:#3bd574;border:1px solid rgba(59,213,116,0.4);margin:4px;font-weight:500;';
    }
    return 'display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:8px 16px;border-radius:8px;background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.2);margin:4px;';
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

      btn.on('hover:enter click', function() {
        showAddToCollectionDialog(movie);
      });

      var targets = [
        '.full-start__buttons .full-start__button:last-child',
        '.full-start__buttons .full-start__button:last',
        '.full-start__buttons',
        '.full-start__left',
        '.detail-page__buttons',
        '.card--more',
        '.buttons-full',
        '.full-start__tag',
        '.full__title + .full-start__buttons',
        '.full-start__descr ~ div',
        '.detail-page__header',
        '.detail-page__container',
        '.full-start',
        '.cards__container',
        '.page__container',
        '.content'
      ];

      var inserted = false;
      for (var t = 0; t < targets.length; t++) {
        var el = render.find(targets[t]);
        if (el.length) {
          el.last().after(btn);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        var anyBtn = render.find('.selector').filter(function() {
          return $(this).text().indexOf('\u0422\u043E\u0440\u0440\u0435\u043D\u0442') >= 0 || $(this).text().indexOf('\u041E\u043D\u043B\u0430\u0439\u043D') >= 0 || $(this).text().indexOf('\u0422\u0440\u0435\u0439\u043B\u0435\u0440') >= 0;
        }).first();
        if (anyBtn.length) {
          anyBtn.parent().append(btn);
          inserted = true;
        }
      }

      if (!inserted) {
        render.prepend(btn);
      }
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
