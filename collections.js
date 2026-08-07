(function() {
  'use strict';

  var PLUGIN_NAME = 'Мои Коллекции';
  var STORAGE_KEY = 'my_collections';
  var TIME_KEY = 'my_collections_time';
  var SORT_KEY = 'my_collections_sort';

  console.log('[MovieZone] Loading ' + PLUGIN_NAME + ' v1.0.0');

  // ========== Default Collections ==========

  var DEFAULT_COLLECTIONS = {
    watched:     { name: 'Посмотрел',       icon: '✅', movies: [] },
    will_watch:  { name: 'Буду смотреть',   icon: '👁', movies: [] },
    want_watch:  { name: 'Хочу посмотреть', icon: '💡', movies: [] },
    later:       { name: 'Потом',           icon: '⏰', movies: [] },
    favorite:    { name: 'Избранное',       icon: '❤️', movies: [] }
  };

  var SORT_OPTIONS = [
    { id: 'date_desc',  name: 'По дате (новые)' },
    { id: 'date_asc',   name: 'По дате (старые)' },
    { id: 'rating_desc', name: 'По рейтингу (высокий)' },
    { id: 'rating_asc',  name: 'По рейтингу (низкий)' },
    { id: 'alpha_asc',  name: 'По алфавиту (А-Я)' },
    { id: 'alpha_desc', name: 'По алфавиту (Я-А)' }
  ];

  // ========== Storage Functions ==========

  function getCollections() {
    var data = Lampa.Storage.get(STORAGE_KEY);
    if (!data || typeof data !== 'object' || !data.watched) {
      data = JSON.parse(JSON.stringify(DEFAULT_COLLECTIONS));
      saveCollections(data);
    }
    return data;
  }

  function saveCollections(data) {
    Lampa.Storage.set(STORAGE_KEY, data);
  }

  function getMovieHash(movie) {
    var base = (movie.id || '') + '_' + (movie.original_title || movie.title || movie.name || '');
    return Lampa.Utils.hash(base);
  }

  function isInCollection(collectionId, movieId) {
    var collections = getCollections();
    var col = collections[collectionId];
    if (!col || !col.movies) return false;
    for (var i = 0; i < col.movies.length; i++) {
      if (col.movies[i].id === movieId) return true;
    }
    return false;
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
      original_title: movie.original_title || '',
      poster_path: movie.poster_path || '',
      backdrop_path: movie.backdrop_path || '',
      release_date: movie.release_date || movie.first_air_date || '',
      vote_average: movie.vote_average || 0,
      vote_count: movie.vote_count || 0,
      overview: movie.overview || '',
      genre_ids: movie.genre_ids || [],
      added_at: Date.now(),
      watch_time: 0,
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
    var newMovies = [];
    for (var i = 0; i < col.movies.length; i++) {
      if (col.movies[i].id === movieId) {
        found = true;
      } else {
        newMovies.push(col.movies[i]);
      }
    }

    if (found) {
      col.movies = newMovies;
      saveCollections(collections);
    }
    return found;
  }

  function updateMovieWatchTime(collectionId, movieId, seconds) {
    var collections = getCollections();
    var col = collections[collectionId];
    if (!col) return;

    for (var i = 0; i < col.movies.length; i++) {
      if (col.movies[i].id === movieId) {
        col.movies[i].watch_time = (col.movies[i].watch_time || 0) + seconds;
        saveCollections(collections);
        return;
      }
    }
  }

  function getCollectionsWithStats() {
    var collections = getCollections();
    var result = [];

    var keys = Object.keys(collections);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var col = collections[key];
      var totalTime = 0;
      for (var j = 0; j < col.movies.length; j++) {
        totalTime += col.movies[j].watch_time || 0;
      }
      result.push({
        id: key,
        name: col.name,
        icon: col.icon,
        count: col.movies.length,
        totalTime: totalTime
      });
    }

    return result;
  }

  function sortMovies(movies, sortId) {
    var sorted = movies.slice();

    switch (sortId) {
      case 'date_desc':
        sorted.sort(function(a, b) { return (b.added_at || 0) - (a.added_at || 0); });
        break;
      case 'date_asc':
        sorted.sort(function(a, b) { return (a.added_at || 0) - (b.added_at || 0); });
        break;
      case 'rating_desc':
        sorted.sort(function(a, b) { return (b.vote_average || 0) - (a.vote_average || 0); });
        break;
      case 'rating_asc':
        sorted.sort(function(a, b) { return (a.vote_average || 0) - (b.vote_average || 0); });
        break;
      case 'alpha_asc':
        sorted.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });
        break;
      case 'alpha_desc':
        sorted.sort(function(a, b) { return (b.title || '').localeCompare(a.title || ''); });
        break;
    }

    return sorted;
  }

  function getSortId() {
    return Lampa.Storage.get(SORT_KEY, 'date_desc');
  }

  function setSortId(id) {
    Lampa.Storage.set(SORT_KEY, id);
  }

  // ========== Watch Time ==========

  function getWatchTime() {
    return Lampa.Storage.get(TIME_KEY, 0) || 0;
  }

  function addWatchTime(seconds) {
    var current = getWatchTime();
    Lampa.Storage.set(TIME_KEY, current + seconds);
  }

  function formatTime(totalSeconds) {
    if (!totalSeconds || totalSeconds < 1) return '0 мин';

    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);

    var parts = [];
    if (days > 0) parts.push(days + ' дн');
    if (hours > 0) parts.push(hours + ' ч');
    if (minutes > 0) parts.push(minutes + ' мин');

    return parts.join(' ') || '0 мин';
  }

  // ========== Collection Card HTML ==========

  function renderCollectionCard(col) {
    return '<div class="collection-card selector" data-id="' + col.id + '">' +
      '<div class="collection-card__icon">' + col.icon + '</div>' +
      '<div class="collection-card__info">' +
        '<div class="collection-card__name">' + col.name + '</div>' +
        '<div class="collection-card__count">' + col.count + ' фильмов</div>' +
        (col.totalTime > 0 ? '<div class="collection-card__time">' + formatTime(col.totalTime) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  function renderMovieCard(movie) {
    var poster = movie.poster_path;
    if (poster && !poster.startsWith('http')) {
      poster = 'https://image.tmdb.org/t/p/w300' + poster;
    }

    return '<div class="movie-card selector" data-id="' + movie.id + '">' +
      '<div class="movie-card__poster" style="background-image:url(' + (poster || '') + ')"></div>' +
      '<div class="movie-card__info">' +
        '<div class="movie-card__title">' + (movie.title || '') + '</div>' +
        '<div class="movie-card__rating">⭐ ' + (movie.vote_average || 0).toFixed(1) + '</div>' +
        (movie.watch_time > 0 ? '<div class="movie-card__time">🕐 ' + formatTime(movie.watch_time) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  // ========== CSS ==========

  function injectStyles() {
    if (document.getElementById('my-collections-styles')) return;

    var css = '' +
      '.collection-card { display:flex; align-items:center; padding:12px 16px; margin:4px 0; border-radius:8px; background:rgba(255,255,255,0.05); cursor:pointer; }' +
      '.collection-card:hover, .collection-card.focus { background:rgba(255,255,255,0.12); }' +
      '.collection-card__icon { font-size:28px; margin-right:14px; width:40px; text-align:center; }' +
      '.collection-card__name { font-size:16px; font-weight:600; color:#fff; }' +
      '.collection-card__count { font-size:13px; color:rgba(255,255,255,0.5); margin-top:2px; }' +
      '.collection-card__time { font-size:12px; color:#3bd574; margin-top:2px; }' +
      '.movie-card { display:inline-block; width:140px; margin:6px; vertical-align:top; cursor:pointer; border-radius:8px; overflow:hidden; background:rgba(255,255,255,0.05); }' +
      '.movie-card:hover, .movie-card.focus { background:rgba(255,255,255,0.12); }' +
      '.movie-card__poster { width:140px; height:210px; background-size:cover; background-position:center; background-color:rgba(255,255,255,0.08); }' +
      '.movie-card__info { padding:8px; }' +
      '.movie-card__title { font-size:13px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }' +
      '.movie-card__rating { font-size:12px; color:#f5c518; margin-top:3px; }' +
      '.movie-card__time { font-size:11px; color:#3bd574; margin-top:2px; }' +
      '.my-collections-header { padding:16px; }' +
      '.my-collections-header__title { font-size:22px; font-weight:700; color:#fff; }' +
      '.my-collections-header__time { font-size:14px; color:#3bd574; margin-top:4px; }' +
      '.my-collections-sort { padding:8px 16px; display:flex; align-items:center; gap:8px; }' +
      '.my-collections-sort__label { font-size:13px; color:rgba(255,255,255,0.5); }' +
      '.my-collections-sort__btn { padding:4px 12px; border-radius:4px; background:rgba(255,255,255,0.1); color:#fff; font-size:13px; cursor:pointer; }' +
      '.my-collections-sort__btn.active { background:#3bd574; color:#000; }' +
      '.my-collections-empty { padding:40px 16px; text-align:center; color:rgba(255,255,255,0.4); font-size:14px; }' +
      '.my-collections-add-btn { display:flex; align-items:center; justify-content:center; padding:12px; margin:4px 0; border:2px dashed rgba(255,255,255,0.2); border-radius:8px; color:rgba(255,255,255,0.4); cursor:pointer; font-size:14px; }' +
      '.my-collections-add-btn:hover, .my-collections-add-btn.focus { border-color:#3bd574; color:#3bd574; }';

    var style = document.createElement('style');
    style.id = 'my-collections-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ========== Plugin Registration ==========

  function startPlugin() {
    if (window._my_collections_plugin) return;
    window._my_collections_plugin = true;

    injectStyles();

    Lampa.Manifest.plugins = {
      type: 'video',
      version: '1.0.0',
      name: PLUGIN_NAME,
      description: 'Закладки, коллекции и таймер просмотра',
      component: 'my_collections',

      onContextMenu: function(obj) {
        return { name: PLUGIN_NAME, description: '' };
      },

      onContextLauch: function(obj) {
        showAddToCollectionDialog(obj);
      }
    };

    addMenuButton();

    console.log('[MyCollections] Plugin started');
  }

  // ========== Menu Button ==========

  function addMenuButton() {
    setTimeout(function() {
      var menuList = document.querySelector('.menu__list');
      if (!menuList || document.querySelector('.my-collections-menu-item')) return;

      var menuItem = document.createElement('div');
      menuItem.className = 'menu__item selector my-collections-menu-item';
      menuItem.innerHTML =
        '<div class="menu__item-icon">🎬</div>' +
        '<div class="menu__item-text">' + PLUGIN_NAME + '</div>';

      menuItem.addEventListener('hover:enter', function() {
        openCollectionsPage();
      });

      var firstItem = menuList.querySelector('.menu__item');
      if (firstItem) {
        menuList.insertBefore(menuItem, firstItem);
      } else {
        menuList.appendChild(menuItem);
      }
    }, 2000);
  }

  // ========== Add to Collection Dialog ==========

  function showAddToCollectionDialog(movie) {
    var collections = getCollections();
    var items = [];

    var keys = Object.keys(collections);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var col = collections[key];
      var inCollection = isInCollection(key, movie.id);

      items.push({
        title: col.icon + ' ' + col.name + (inCollection ? ' ✓' : ''),
        subtitle: inCollection ? 'Уже в коллекции' : 'Добавить',
        _collectionId: key,
        _movie: movie,
        _inCollection: inCollection
      });
    }

    items.push({
      title: '➕ Создать коллекцию',
      subtitle: 'Новая пользовательская коллекция',
      _createNew: true
    });

    Lampa.Select.show({
      title: PLUGIN_NAME + ' — Добавить фильм',
      items: items,
      onSelect: function(item) {
        if (item._createNew) {
          showCreateCollectionDialog(movie);
        } else if (item._inCollection) {
          removeFromCollection(item._collectionId, item._movie.id);
          Lampa.Noty.show('Удалено из «' + collections[item._collectionId].name + '»');
          showAddToCollectionDialog(movie);
        } else {
          addToCollection(item._collectionId, item._movie);
          Lampa.Noty.show('Добавлено в «' + collections[item._collectionId].name + '»');
        }
      },
      onBack: function() {
        try { Lampa.Activity.backward(); } catch(e) { Lampa.Controller.toggle('content'); }
      }
    });
  }

  function showCreateCollectionDialog(movie) {
    var name = prompt('Название коллекции:');
    if (!name || !name.trim()) return;

    var collections = getCollections();
    var id = 'custom_' + Date.now();
    collections[id] = { name: name.trim(), icon: '📁', movies: [] };
    saveCollections(collections);

    addToCollection(id, movie);
    Lampa.Noty.show('Коллекция «' + name.trim() + '» создана и фильм добавлен');
  }

  // ========== Collections Page ==========

  function openCollectionsPage() {
    var collections = getCollectionsWithStats();
    var totalTime = getWatchTime();

    var items = [];

    for (var i = 0; i < collections.length; i++) {
      var col = collections[i];
      items.push({
        title: col.icon + ' ' + col.name,
        subtitle: col.count + ' фильмов' + (col.totalTime > 0 ? ' · ' + formatTime(col.totalTime) : ''),
        _collectionId: col.id
      });
    }

    items.push({
      title: '➕ Создать коллекцию',
      subtitle: 'Новая пользовательская коллекция',
      _createNew: true
    });

    Lampa.Select.show({
      title: PLUGIN_NAME + (totalTime > 0 ? ' · ' + formatTime(totalTime) : ''),
      items: items,
      onSelect: function(item) {
        if (item._createNew) {
          var name = prompt('Название коллекции:');
          if (!name || !name.trim()) return;
          var cols = getCollections();
          var newId = 'custom_' + Date.now();
          cols[newId] = { name: name.trim(), icon: '📁', movies: [] };
          saveCollections(cols);
          Lampa.Noty.show('Коллекция «' + name.trim() + '» создана');
          openCollectionsPage();
        } else {
          openCollectionMovies(item._collectionId);
        }
      },
      onBack: function() {
        try { Lampa.Controller.toggle('menu'); } catch(e) {}
      }
    });
  }

  function openCollectionMovies(collectionId) {
    var collections = getCollections();
    var col = collections[collectionId];
    if (!col) return;

    var sortId = getSortId();
    var sorted = sortMovies(col.movies, sortId);
    var items = [];

    for (var i = 0; i < sorted.length; i++) {
      var movie = sorted[i];
      items.push({
        title: (movie.title || 'Без названия'),
        subtitle: '⭐ ' + (movie.vote_average || 0).toFixed(1) +
                  (movie.release_date ? ' · ' + movie.release_date.substring(0, 4) : '') +
                  (movie.watch_time > 0 ? ' · 🕐 ' + formatTime(movie.watch_time) : ''),
        _movie: movie
      });
    }

    if (!items.length) {
      items.push({
        title: 'Пусто',
        subtitle: 'Добавьте фильмы из карточек фильмов',
        _empty: true
      });
    }

    var sortName = '';
    for (var s = 0; s < SORT_OPTIONS.length; s++) {
      if (SORT_OPTIONS[s].id === sortId) { sortName = SORT_OPTIONS[s].name; break; }
    }

    Lampa.Select.show({
      title: col.icon + ' ' + col.name + ' (' + col.movies.length + ')',
      items: items,
      onSelect: function(item) {
        if (item._empty) return;
        showMovieActions(collectionId, item._movie);
      },
      onBack: function() {
        openCollectionsPage();
      }
    });
  }

  function showMovieActions(collectionId, movie) {
    var collections = getCollections();
    var col = collections[collectionId];

    Lampa.Select.show({
      title: movie.title || 'Фильм',
      items: [
        { title: '▶️ Смотреть', _action: 'play' },
        { title: '🔄 Переместить в...', _action: 'move' },
        { title: '🗑 Удалить из коллекции', _action: 'remove' },
        { title: 'ℹ️ Подробнее', _action: 'info' }
      ],
      onSelect: function(item) {
        if (item._action === 'play') {
          playMovie(movie);
        } else if (item._action === 'remove') {
          removeFromCollection(collectionId, movie.id);
          Lampa.Noty.show('Удалено из «' + col.name + '»');
          openCollectionMovies(collectionId);
        } else if (item._action === 'move') {
          showMoveDialog(collectionId, movie);
        } else if (item._action === 'info') {
          showMovieInfo(movie);
        }
      },
      onBack: function() {
        openCollectionMovies(collectionId);
      }
    });
  }

  function showMoveDialog(fromCollectionId, movie) {
    var collections = getCollections();
    var items = [];

    var keys = Object.keys(collections);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key === fromCollectionId) continue;
      var col = collections[key];
      items.push({
        title: col.icon + ' ' + col.name,
        _targetId: key
      });
    }

    Lampa.Select.show({
      title: 'Переместить «' + (movie.title || '') + '» в...',
      items: items,
      onSelect: function(item) {
        removeFromCollection(fromCollectionId, movie.id);
        addToCollection(item._targetId, movie);
        Lampa.Noty.show('Перемещено в «' + collections[item._targetId].name + '»');
        openCollectionMovies(fromCollectionId);
      },
      onBack: function() {
        showMovieActions(fromCollectionId, movie);
      }
    });
  }

  function showMovieInfo(movie) {
    Lampa.Noty.show(
      (movie.title || 'Без названия') +
      ' ⭐' + (movie.vote_average || 0).toFixed(1) +
      (movie.release_date ? ' (' + movie.release_date.substring(0, 4) + ')' : '') +
      (movie.watch_time > 0 ? ' — Просмотрено: ' + formatTime(movie.watch_time) : '')
    );
  }

  // ========== Play Movie ==========

  function playMovie(movie) {
    window._collection_current_movie = movie;
    window._collection_watch_start = Date.now();

    Lampa.Noty.show('Запуск: ' + (movie.title || ''));

    var hash = 'collection_' + movie.id;
    var timeline = Lampa.Timeline.view(hash);

    var play = {
      url: '',
      type: 'mp4',
      title: movie.title || '',
      timeline: timeline,
      subtitles: []
    };

    Lampa.Player.play(play);
    Lampa.Player.playlist([play]);

    startWatchTimer(movie);
  }

  function startWatchTimer(movie) {
    if (window._collection_watch_interval) {
      clearInterval(window._collection_watch_interval);
    }

    window._collection_watch_interval = setInterval(function() {
      addWatchTime(3);

      var collections = getCollections();
      var keys = Object.keys(collections);
      for (var i = 0; i < keys.length; i++) {
        var col = collections[keys[i]];
        for (var j = 0; j < col.movies.length; j++) {
          if (col.movies[j].id === movie.id) {
            col.movies[j].watch_time = (col.movies[j].watch_time || 0) + 3;
            saveCollections(collections);
            return;
          }
        }
      }
    }, 3000);

    Lampa.Player.on('close', function onClose() {
      clearInterval(window._collection_watch_interval);
      window._collection_watch_interval = null;
      window._collection_current_movie = null;
      Lampa.Player.off('close', onClose);
    });
  }

  // ========== Card Button ==========

  var _cardButtonAdded = false;

  function tryAddCardButton() {
    if (_cardButtonAdded) return;

    try {
      var active = Lampa.Activity.active();
      if (!active || active.component !== 'full') return;

      var movie = active.card || (active.data && active.data.movie);
      if (!movie || !movie.id) return;

      var render = active.activity.render();
      if (!render || !render.length) return;
      if (render.find('.my-collections-btn').length) { _cardButtonAdded = true; return; }

      var inAny = false;
      var collections = getCollections();
      var keys = Object.keys(collections);
      for (var i = 0; i < keys.length; i++) {
        if (isInCollection(keys[i], movie.id)) { inAny = true; break; }
      }

      var btn = document.createElement('div');
      btn.className = 'full-start__button selector my-collections-btn';
      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' +
        '</svg>' +
        '<span>Коллекции' + (inAny ? ' ✓' : '') + '</span>';

      btn.addEventListener('hover:enter', function() {
        showAddToCollectionDialog(movie);
      });

      var targets = [
        '.full-start__button:last',
        '.view--online .online-prestige:last',
        '.full-start__buttons'
      ];

      var inserted = false;
      for (var t = 0; t < targets.length; t++) {
        var el = render.querySelector(targets[t]);
        if (el) {
          if (targets[t].indexOf(':last') !== -1) {
            el.parentNode.insertBefore(btn, el.nextSibling);
          } else {
            el.appendChild(btn);
          }
          inserted = true;
          _cardButtonAdded = true;
          break;
        }
      }
    } catch (e) {}
  }

  // ========== Initialization ==========

  function init() {
    Lampa.Listener.follow('full', function(e) {
      if (e.type === 'complite') {
        _cardButtonAdded = false;
        setTimeout(tryAddCardButton, 500);
      }
    });

    setTimeout(tryAddCardButton, 2000);
  }

  // ========== Start ==========

  function start() {
    startPlugin();
    init();
  }

  if (typeof Lampa !== 'undefined') {
    start();
  } else {
    var waitInterval = setInterval(function() {
      if (typeof Lampa !== 'undefined') {
        clearInterval(waitInterval);
        start();
      }
    }, 500);
  }

})();
