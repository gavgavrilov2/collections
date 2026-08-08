(function() {
  'use strict';

  var PLUGIN_NAME = 'Мои Коллекции';
  var STORAGE_KEY = 'my_collections';
  var TIME_KEY = 'my_collections_time';
  var SORT_KEY = 'my_collections_sort';
  var SCALE_KEY = 'my_collections_scale';
  var FILTER_KEY = 'my_collections_filter';

  var SCALE_LEVELS = [
    { id: 'xs',  label: 'XS',  factor: 0.65 },
    { id: 's',   label: 'S',   factor: 0.8  },
    { id: 'm',   label: 'M',   factor: 1.0  },
    { id: 'l',   label: 'L',   factor: 1.25 },
    { id: 'xl',  label: 'XL',  factor: 1.5  }
  ];
  var DEFAULT_SCALE = 'm';
  var BASE_CARD_W = 160;
  var BASE_CARD_H = 240;

  var DEFAULT_COLLECTIONS = {
    watched:     { name: 'Посмотрел',       icon: '', movies: [], isDefault: true },
    will_watch:  { name: 'Буду смотреть',   icon: '', movies: [], isDefault: true },
    want_watch:  { name: 'Хочу посмотреть', icon: '', movies: [], isDefault: true },
    later:       { name: 'Потом',           icon: '', movies: [], isDefault: true },
    favorite:    { name: 'Избранное',       icon: '', movies: [], isDefault: true }
  };

  var SORT_OPTIONS = [
    { id: 'date_desc',   name: 'По дате (новые)' },
    { id: 'date_asc',    name: 'По дате (старые)' },
    { id: 'rating_desc', name: 'По рейтингу' },
    { id: 'alpha_asc',   name: 'По алфавиту' }
  ];

  var _collectionsCache = null;

  function getCollections() {
    if (_collectionsCache) return _collectionsCache;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data && typeof data === 'object' && data.watched) { _collectionsCache = data; return data; }
      }
    } catch(e) {}
    try {
      var data2 = Lampa.Storage.get(STORAGE_KEY);
      if (data2 && typeof data2 === 'object' && data2.watched) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data2));
        _collectionsCache = data2;
        return data2;
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

  function detectMediaType(movie) {
    if (movie.media_type === 'tv' || movie.media_type === 'show') return 'tv';
    if (movie.first_air_date || movie.number_of_seasons || movie.number_of_episodes) return 'tv';
    if (movie.name && movie.original_name && movie.name !== movie.original_name) return 'tv';
    if (!movie.title && movie.name) return 'tv';
    if (movie.release_date && movie.first_air_date && movie.first_air_date !== movie.release_date) return 'tv';
    return 'movie';
  }

  function openFullCard(movie) {
    var card = {
      id: movie.id,
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
      source: movie.source || 'tmdb',
      media_type: detectMediaType(movie)
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
      original_title: movie.original_title || '',
      poster_path: movie.poster_path || '',
      backdrop_path: movie.backdrop_path || '',
      release_date: movie.release_date || movie.first_air_date || '',
      vote_average: movie.vote_average || 0,
      vote_count: movie.vote_count || 0,
      overview: movie.overview || '',
      genre_ids: movie.genre_ids || [],
      media_type: detectMediaType(movie),
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
    col.movies = col.movies.filter(function(m) { if (m.id === movieId) { found = true; return false; } return true; });
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

  function getWatchTime() { return Lampa.Storage.get(TIME_KEY, 0) || 0; }

  function formatTime(sec) {
    if (!sec || sec < 1) return '0 мин';
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    var p = [];
    if (d > 0) p.push(d + ' дн');
    if (h > 0) p.push(h + ' ч');
    if (m > 0) p.push(m + ' мин');
    return p.join(' ') || '0 мин';
  }

  function sortMovies(movies, sortId) {
    var s = movies.slice();
    switch (sortId) {
      case 'date_desc':   s.sort(function(a,b){return (b.added_at||0)-(a.added_at||0);}); break;
      case 'date_asc':    s.sort(function(a,b){return (a.added_at||0)-(b.added_at||0);}); break;
      case 'rating_desc': s.sort(function(a,b){return (b.vote_average||0)-(a.vote_average||0);}); break;
      case 'alpha_asc':   s.sort(function(a,b){return (a.title||'').localeCompare(b.title||'');}); break;
    }
    return s;
  }

  function getSortId() { return Lampa.Storage.get(SORT_KEY, 'date_desc'); }

  function getScaleId() { return Lampa.Storage.get(SCALE_KEY, DEFAULT_SCALE); }
  function getScaleFactor() {
    var id = getScaleId();
    for (var i = 0; i < SCALE_LEVELS.length; i++) {
      if (SCALE_LEVELS[i].id === id) return SCALE_LEVELS[i].factor;
    }
    return 1.0;
  }
  function getCardSize() {
    var f = getScaleFactor();
    return { w: Math.round(BASE_CARD_W * f), h: Math.round(BASE_CARD_H * f) };
  }

  function posterUrl(movie) {
    var p = movie.poster_path || '';
    if (p && !p.startsWith('http')) p = 'https://image.tmdb.org/t/p/w300' + p;
    return p;
  }

  function enableWheelScroll(el) {
    if (!el || !el.addEventListener) return;
    el.addEventListener('wheel', function(e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // ========== CSS ==========

  function injectStyles() {
    if (document.getElementById('my-collections-styles')) return;
    var css = ''
    + '.mc-page { padding:0 0 60px 0; box-sizing:border-box; width:100%; }'

    + '.mc-header { display:flex; align-items:center; padding:20px 24px 16px; gap:12px; }'
    + '.mc-header__title { font-size:32px; font-weight:700; color:#fff; flex:1; }'
    + '.mc-header__time { font-size:15px; color:#3bd574; background:rgba(59,213,116,0.1); padding:8px 16px; border-radius:8px; white-space:nowrap; }'

    + '.mc-tabs { display:flex; gap:12px; padding:0 24px 16px; overflow-x:auto; }'
    + '.mc-tabs::-webkit-scrollbar { display:none; }'
    + '.mc-tab { flex-shrink:0; padding:14px 24px; border-radius:12px; background:rgba(255,255,255,0.06); border:2px solid transparent; cursor:pointer; transition:all .15s; min-width:140px; text-align:center; }'
    + '.mc-tab:hover,.mc-tab.focus { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.15); }'
    + '.mc-tab.active { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.25); }'
    + '.mc-tab__name { font-size:15px; color:rgba(255,255,255,0.6); margin-bottom:4px; }'
    + '.mc-tab.active .mc-tab__name { color:#fff; }'
    + '.mc-tab__count { font-size:24px; font-weight:700; color:#fff; }'
    + '.mc-tab__max { font-size:13px; color:rgba(255,255,255,0.3); }'

    + '.mc-sort { display:flex; gap:10px; padding:8px 24px 12px; overflow-x:auto; }'
    + '.mc-sort::-webkit-scrollbar { display:none; }'
    + '.mc-sort__btn { flex-shrink:0; padding:10px 20px; border-radius:8px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6); font-size:14px; cursor:pointer; transition:all .15s; }'
    + '.mc-sort__btn:hover,.mc-sort__btn.focus { background:rgba(255,255,255,0.12); color:#fff; }'
    + '.mc-sort__btn.active { background:rgba(59,213,116,0.15); color:#3bd574; }'

    + '.mc-scale { display:flex; gap:8px; padding:4px 24px 12px; align-items:center; }'
    + '.mc-scale__label { font-size:14px; color:rgba(255,255,255,0.5); margin-right:4px; white-space:nowrap; }'
    + '.mc-scale__btn { flex-shrink:0; width:44px; height:38px; border-radius:8px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6); font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }'
    + '.mc-scale__btn:hover,.mc-scale__btn.focus { background:rgba(255,255,255,0.12); color:#fff; }'
    + '.mc-scale__btn.active { background:rgba(59,213,116,0.15); color:#3bd574; }'

    + '.mc-section { margin-bottom:24px; }'
    + '.mc-section__head { display:flex; align-items:center; padding:8px 24px 12px; gap:8px; }'
    + '.mc-section__title { font-size:22px; font-weight:700; color:#fff; flex:1; }'
    + '.mc-section__more { font-size:14px; color:#3bd574; padding:8px 16px; border-radius:8px; background:rgba(59,213,116,0.1); cursor:pointer; transition:all .15s; }'
    + '.mc-section__more:hover,.mc-section__more.focus { background:rgba(59,213,116,0.2); }'

    + '.mc-row { display:flex; gap:16px; padding:0 24px; overflow-x:auto; overflow-y:hidden; scroll-behavior:smooth; }'
    + '.mc-row::-webkit-scrollbar { display:none; }'

    + '.mc-card { flex-shrink:0; cursor:pointer; position:relative; transition:transform .15s; text-align:center; }'
    + '.mc-card:hover,.mc-card.focus { transform:scale(1.05); }'
    + '.mc-card__poster { border-radius:10px; background-size:cover; background-position:center top; background-color:rgba(255,255,255,0.06); position:relative; overflow:hidden; }'
    + '.mc-card__badge { position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.8); color:#f5c518; font-size:13px; font-weight:700; padding:4px 8px; border-radius:6px; }'
    + '.mc-card__icons { position:absolute; bottom:8px; left:8px; display:flex; gap:4px; }'
    + '.mc-card__icon { height:22px; border-radius:4px; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; font-size:11px; color:rgba(255,255,255,0.8); padding:0 6px; white-space:nowrap; }'
    + '.mc-card__title { margin-top:10px; font-size:14px; color:#fff; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; font-weight:500; word-wrap:break-word; line-height:1.3; max-width:100%; box-sizing:border-box; }'
    + '.mc-card__year { margin-top:3px; font-size:13px; color:rgba(255,255,255,0.4); }'

    + '.mc-empty { padding:30px; color:rgba(255,255,255,0.3); font-size:16px; text-align:center; }'

    + '.mc-stats { display:flex; gap:20px; padding:16px 24px; justify-content:center; }'
    + '.mc-stat { width:120px; height:120px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; }'
    + '.mc-stat__bg { position:absolute; inset:0; border-radius:50%; opacity:0.15; }'
    + '.mc-stat__num { font-size:32px; font-weight:800; color:#fff; position:relative; z-index:1; }'
    + '.mc-stat__label { font-size:13px; color:rgba(255,255,255,0.6); position:relative; z-index:1; margin-top:2px; }'

    + '.mc-dialog-item { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; cursor:pointer; border-radius:10px; background:rgba(255,255,255,0.04); margin-bottom:6px; transition:background .1s; }'
    + '.mc-dialog-item:hover,.mc-dialog-item.focus { background:rgba(255,255,255,0.1); }'
    + '.mc-dialog-item__left { display:flex; align-items:center; gap:10px; flex:1; }'
    + '.mc-dialog-item__icon { font-size:20px; }'
    + '.mc-dialog-item__name { font-size:17px; color:#fff; font-weight:500; }'
    + '.mc-dialog-item__check { font-size:20px; color:#3bd574; min-width:28px; text-align:right; display:flex; align-items:center; justify-content:center; }'
    + '.mc-dialog-item__check.empty { color:rgba(255,255,255,0.15); }'

    + '.select-list .select-item { position:relative; padding-right:50px; }'
    + '.select-list .select-item__checkbox { position:absolute; right:16px; top:50%; transform:translateY(-50%); width:26px; height:26px; border:2px solid rgba(255,255,255,0.25); border-radius:5px; background:transparent; display:flex; align-items:center; justify-content:center; transition:all .15s; }'
    + '.select-list .select-item__checkbox.on { border-color:#3bd574; background:rgba(59,213,116,0.2); }'
    + '.select-list .select-item__checkbox.on::after { content:""; width:12px; height:7px; border-left:2.5px solid #3bd574; border-bottom:2.5px solid #3bd574; transform:rotate(-45deg) translateY(-1px); }'
    + '.select-list .select-item.focus .select-item__checkbox { border-color:rgba(255,255,255,0.5); }'
    + '.select-list .select-item.focus .select-item__checkbox.on { border-color:#3bd574; }';

    var style = document.createElement('style');
    style.id = 'my-collections-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ========== Plugin ==========

  function startPlugin() {
    if (window._my_collections_plugin) return;
    window._my_collections_plugin = true;
    injectStyles();

    Lampa.Manifest.plugins = {
      type: 'video', version: '1.11.0', name: PLUGIN_NAME,
      description: 'Закладки, коллекции и таймер просмотра',
      component: 'my_collections',
      onContextMenu: function(){ return { name: PLUGIN_NAME, description: '' }; },
      onContextLauch: function(obj){ showAddToCollectionDialog(obj); }
    };

    addMenuButton();
    initListener();
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
      var first = menuList.querySelector('.menu__item');
      if (first) menuList.insertBefore(item, first); else menuList.appendChild(item);
    }, 2000);
  }

  function initListener() {
    if (typeof Lampa.Listener !== 'undefined') {
      Lampa.Listener.follow('full', function(e) {
        if (e.type === 'complite' || e.type === 'start') {
          setTimeout(tryAddCardButton, 500);
          setTimeout(tryAddCardButton, 1500);
        }
      });
    }
    Lampa.Activity.listener.follow('complite', function(a) {
      setTimeout(tryAddCardButton, 800);
    });
    Lampa.Activity.listener.follow('start', function(a) {
      setTimeout(tryAddCardButton, 1200);
    });
  }

  // ========== Add Dialog ==========

  function safeBack() {}

  function showAddToCollectionDialog(movie) {
    var collections = getCollections();
    var keys = Object.keys(collections);

    function buildItems() {
      var items = [];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var col = collections[key];
        var inCol = isInCollection(key, movie.id);
        items.push({
          title: col.name,
          checkbox: inCol,
          _id: key, _movie: movie, _in: inCol
        });
      }
      items.push({ title: 'Создать коллекцию...', _create: true });
      return items;
    }

    function showDialog() {
      var items = buildItems();
      Lampa.Select.show({
        title: PLUGIN_NAME,
        items: items,
        onSelect: function(item) {
          if (item._create) {
            showCreateCollectionDialog(movie);
            return;
          }
          if (item._in) {
            removeFromCollection(item._id, item._movie.id);
            Lampa.Noty.show('Убрано из «' + collections[item._id].name + '»');
          } else {
            addToCollection(item._id, item._movie);
            Lampa.Noty.show('Добавлено в «' + collections[item._id].name + '»');
          }
          _collectionsCache = null;
          collections = getCollections();
          keys = Object.keys(collections);
          refreshCardButton();
          showDialog();
        },
        onBack: safeBack
      });
    }

    showDialog();
  }

  function showCreateCollectionDialog(movie) {
    var predefinedNames = [
      { title: 'Документальные', name: 'Документальные' },
      { title: 'Комедии', name: 'Комедии' },
      { title: 'Ужасы', name: 'Ужасы' },
      { title: 'Фантастика', name: 'Фантастика' },
      { title: 'Мелодрамы', name: 'Мелодрамы' },
      { title: 'Боевики', name: 'Боевики' },
      { title: 'Детективы', name: 'Детективы' },
      { title: 'Драмы', name: 'Драмы' },
      { title: 'Мюзиклы', name: 'Мюзиклы' },
      { title: 'Исторические', name: 'Исторические' },
      { title: 'Военные', name: 'Военные' },
      { title: 'Криминал', name: 'Криминал' },
      { title: 'Загадки', name: 'Загадки' },
      { title: 'Семейные', name: 'Семейные' },
      { title: 'Детские', name: 'Детские' }
    ];

    Lampa.Select.show({
      title: 'Новая коллекция',
      items: predefinedNames.map(function(n) {
        return { title: n.title, _name: n.name };
      }),
      onSelect: function(item) {
        if (item._name) {
          createAndAdd(item._name, '', movie);
          showAddToCollectionDialog(movie);
        }
      },
      onBack: function() { showAddToCollectionDialog(movie); }
    });
  }

  function createAndAdd(name, icon, movie) {
    var cols = getCollections();
    var newId = 'custom_' + Date.now();
    cols[newId] = { name: name, icon: icon || '📁', movies: [] };
    saveCollections(cols);
    addToCollection(newId, movie);
    Lampa.Noty.show('Создано: «' + name + '»');
    refreshCardButton();
  }

  function refreshCardButton() {
    setTimeout(tryAddCardButton, 300);
    setTimeout(tryAddCardButton, 1000);
    setTimeout(tryAddCardButton, 2000);
  }

  // ========== Main Page ==========

  function openCollectionsPage() {
    var collections = getCollections();
    var totalTime = getWatchTime();
    var sortId = getSortId();
    var activeFilter = Lampa.Storage.get(FILTER_KEY, 'all');

    var scroll = new Lampa.Scroll({ mask: true, over: true });
    scroll.body().addClass('mc-page');

    /* Header */
    scroll.append($(
      '<div class="mc-header">' +
        '<div class="mc-header__title">' + PLUGIN_NAME + '</div>' +
      '</div>'
    ));

    /* Stats */
    var allMovies = [];
    var ks = Object.keys(collections);
    for (var si = 0; si < ks.length; si++) allMovies = allMovies.concat(collections[ks[si]].movies);
    var totalItems = allMovies.length;
    var totalFilms = 0, totalSeries = 0;
    for (var ai = 0; ai < allMovies.length; ai++) {
      if (detectMediaType(allMovies[ai]) === 'tv') totalSeries++;
      else totalFilms++;
    }

    var statsEl = $(
      '<div class="mc-stats">' +
        '<div class="mc-stat"><div class="mc-stat__bg" style="background:linear-gradient(135deg,#7c4dff,#b47cff);"></div><div class="mc-stat__num">' + totalItems + '</div><div class="mc-stat__label">всего</div></div>' +
        '<div class="mc-stat"><div class="mc-stat__bg" style="background:linear-gradient(135deg,#536dfe,#8fa8fe);"></div><div class="mc-stat__num">' + totalFilms + '</div><div class="mc-stat__label">фильмов</div></div>' +
        '<div class="mc-stat"><div class="mc-stat__bg" style="background:linear-gradient(135deg,#2196f3,#64b5f6);"></div><div class="mc-stat__num">' + totalSeries + '</div><div class="mc-stat__label">сериалов</div></div>' +
      '</div>'
    );
    scroll.append(statsEl);

    /* Tabs */
    var tabsEl = $('<div class="mc-tabs"></div>');
    var keys = Object.keys(collections);

    var allCount = 0;
    for (var i = 0; i < keys.length; i++) allCount += collections[keys[i]].movies.length;

    tabsEl.append($(
      '<div class="mc-tab' + (activeFilter === 'all' ? ' active' : '') + '" data-tab="all">' +
        '<div class="mc-tab__name">Все</div>' +
        '<div class="mc-tab__count">' + allCount + ' <span class="mc-tab__max">/ 500</span></div>' +
      '</div>'
    ));

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var col = collections[key];
      tabsEl.append($(
        '<div class="mc-tab' + (activeFilter === key ? ' active' : '') + '" data-tab="' + key + '">' +
          '<div class="mc-tab__name">' + col.name + '</div>' +
          '<div class="mc-tab__count">' + col.movies.length + ' <span class="mc-tab__max">/ 500</span></div>' +
        '</div>'
      ));
    }
    scroll.append(tabsEl);

    /* Sort */
    var sortEl = $('<div class="mc-sort"></div>');
    for (var s = 0; s < SORT_OPTIONS.length; s++) {
      var opt = SORT_OPTIONS[s];
      sortEl.append($('<div class="mc-sort__btn' + (opt.id === sortId ? ' active' : '') + '" data-sort="' + opt.id + '">' + opt.name + '</div>'));
    }
    scroll.append(sortEl);

    /* Scale */
    var scaleId = getScaleId();
    var scaleEl = $('<div class="mc-scale"></div>');
    scaleEl.append($('<div class="mc-scale__label">Размер:</div>'));
    for (var sc = 0; sc < SCALE_LEVELS.length; sc++) {
      var sl = SCALE_LEVELS[sc];
      scaleEl.append($('<div class="mc-scale__btn' + (sl.id === scaleId ? ' active' : '') + '" data-scale="' + sl.id + '">' + sl.label + '</div>'));
    }
    scroll.append(scaleEl);

    /* Sections container */
    var sectionsEl = $('<div></div>');
    scroll.append(sectionsEl);

    function renderSections() {
      sectionsEl.empty();
      var cols = getCollections();
      var sId = getSortId();
      var fId = Lampa.Storage.get(FILTER_KEY, 'all');
      var k = Object.keys(cols);

      for (var i = 0; i < k.length; i++) {
        var id = k[i];
        var c = cols[id];
        if (!c.movies.length) continue;
        if (fId !== 'all' && fId !== id) continue;

        var sorted = sortMovies(c.movies, sId);

        var section = $('<div class="mc-section" data-section="' + id + '"></div>');

        section.append($(
          '<div class="mc-section__head">' +
            '<div class="mc-section__title">' + c.name + '</div>' +
          '</div>'
        ));

        var row = $('<div class="mc-row"></div>');
        for (var j = 0; j < sorted.length; j++) {
          row.append(createCard(sorted[j], id));
        }
        enableWheelScroll(row[0]);
        section.append(row);
        sectionsEl.append(section);
      }

      if (!sectionsEl.children().length) {
        sectionsEl.append($('<div class="mc-empty">Пока пусто. Добавляйте фильмы из карточек.</div>'));
      }
    }

    function createCard(m, collectionId) {
      var url = posterUrl(m);
      var year = (m.release_date || '').substring(0, 4);
      var rating = (m.vote_average || 0).toFixed(1);
      var sz = getCardSize();
      var isTv = detectMediaType(m) === 'tv';
      var typeBadge = isTv ? 'Сериал' : 'Фильм';

      return $(
        '<div class="mc-card selector" data-mid="' + m.id + '" data-col="' + collectionId + '" style="width:' + sz.w + 'px;">' +
          '<div class="mc-card__poster" style="width:' + sz.w + 'px;height:' + sz.h + 'px;background-image:url(' + (url || '') + ')">' +
            (m.vote_average > 0 ? '<div class="mc-card__badge">' + rating + '</div>' : '') +
            '<div class="mc-card__icons"><div class="mc-card__icon">' + typeBadge + '</div></div>' +
          '</div>' +
          '<div class="mc-card__title">' + (m.title || '') + '</div>' +
          '<div class="mc-card__year">' + year + '</div>' +
        '</div>'
      ).data('movie', m).data('collection', collectionId);
    }

    renderSections();

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

    /* Events */
    scroll.render().on('hover:enter click', '.mc-tab[data-tab]', function() {
      var id = $(this).attr('data-tab') || 'all';
      Lampa.Storage.set(FILTER_KEY, id);
      tabsEl.find('.mc-tab').removeClass('active');
      $(this).addClass('active');
      renderSections();
      try { scroll.update(); } catch(e) {}
    });

    scroll.render().on('hover:enter click', '.mc-sort__btn[data-sort]', function() {
      var id = $(this).attr('data-sort');
      Lampa.Storage.set(SORT_KEY, id);
      sortEl.find('.mc-sort__btn').removeClass('active');
      $(this).addClass('active');
      renderSections();
      try { scroll.update(); } catch(e) {}
    });

    scroll.render().on('hover:enter click', '.mc-scale__btn[data-scale]', function() {
      var sid = $(this).attr('data-scale');
      Lampa.Storage.set(SCALE_KEY, sid);
      scaleEl.find('.mc-scale__btn').removeClass('active');
      $(this).addClass('active');
      renderSections();
      try { scroll.update(); } catch(e) {}
    });

    scroll.render().on('hover:enter click', '.mc-card[data-mid]', function() {
      var movie = $(this).data('movie');
      if (movie) openFullCard(movie);
    });

    enableWheelScroll(scroll.render()[0]);

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

  function isMovieInAnyCollection(movieId) {
    var cols = getCollections();
    var k = Object.keys(cols);
    for (var i = 0; i < k.length; i++) {
      if (isInCollection(k[i], movieId)) return true;
    }
    return false;
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
        existing.find('.mc-btn-text').text(PLUGIN_NAME + (inAny ? ' ✓' : ''));
        return;
      }

      var btn = $('<div class="full-start__button selector my-collections-btn" style="' + getButtonStyle(inAny) + '"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg><span class="mc-btn-text">' + PLUGIN_NAME + (inAny ? ' ✓' : '') + '</span></div>');

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
        '.full-start__descr ~ div'
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
          return $(this).text().indexOf('Торрент') >= 0 || $(this).text().indexOf('Онлайн') >= 0 || $(this).text().indexOf('Трейлер') >= 0;
        }).first();
        if (anyBtn.length) {
          anyBtn.parent().append(btn);
        }
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
