(function() {
  'use strict';

  var PLUGIN_NAME = 'Мои Коллекции';
  var STORAGE_KEY = 'my_collections_v2';
  var TIME_KEY = 'my_collections_time_v2';
  var SORT_KEY = 'my_collections_sort_v2';

  var DEFAULT_COLLECTIONS = {
    watched:     { name: 'Посмотрел',       icon: '👁', movies: [], isDefault: true },
    will_watch:  { name: 'Буду смотреть',   icon: '👀', movies: [], isDefault: true },
    want_watch:  { name: 'Хочу посмотреть', icon: '💡', movies: [], isDefault: true },
    later:       { name: 'Потом',           icon: '⏰', movies: [], isDefault: true },
    favorite:    { name: 'Избранное',       icon: '❤️', movies: [], isDefault: true }
  };

  var SORT_OPTIONS = [
    { id: 'date_desc',   name: 'По дате (новые)' },
    { id: 'date_asc',    name: 'По дате (старые)' },
    { id: 'rating_desc', name: 'По рейтингу' },
    { id: 'alpha_asc',   name: 'По алфавиту' }
  ];

  // ========== Storage Helpers ==========

  function getCollections() {
    try {
      var data = Lampa.Storage.get(STORAGE_KEY);
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        data = JSON.parse(JSON.stringify(DEFAULT_COLLECTIONS));
        saveCollections(data);
      }
      var defaults = Object.keys(DEFAULT_COLLECTIONS);
      for (var i = 0; i < defaults.length; i++) {
        var k = defaults[i];
        if (!data[k]) data[k] = JSON.parse(JSON.stringify(DEFAULT_COLLECTIONS[k]));
      }
      return data;
    } catch (e) {
      var fresh = JSON.parse(JSON.stringify(DEFAULT_COLLECTIONS));
      saveCollections(fresh);
      return fresh;
    }
  }

  function saveCollections(data) {
    try { Lampa.Storage.set(STORAGE_KEY, data); } catch (e) {}
  }

  function isInCollection(collectionId, movieId) {
    if (!movieId) return false;
    var col = getCollections()[collectionId];
    if (!col || !Array.isArray(col.movies)) return false;
    for (var i = 0; i < col.movies.length; i++) {
      if (col.movies[i].id === movieId) return true;
    }
    return false;
  }

  function addToCollection(collectionId, movie) {
    if (!movie || !movie.id) {
      console.warn('[MC] invalid movie', movie);
      return false;
    }
    var collections = getCollections();
    var col = collections[collectionId];
    if (!col) return false;
    if (!Array.isArray(col.movies)) col.movies = [];

    for (var i = 0; i < col.movies.length; i++) {
      if (col.movies[i].id === movie.id) return false;
    }

    col.movies.push({
      id: movie.id,
      title: movie.title || movie.name || 'Без названия',
      original_title: movie.original_title || '',
      poster_path: movie.poster_path || '',
      backdrop_path: movie.backdrop_path || '',
      release_date: movie.release_date || movie.first_air_date || '',
      vote_average: movie.vote_average || 0,
      vote_count: movie.vote_count || 0,
      overview: movie.overview || '',
      genre_ids: movie.genre_ids || [],
      media_type: movie.media_type || 'movie',
      added_at: Date.now(),
      source: movie.source || 'tmdb'
    });

    saveCollections(collections);
    return true;
  }

  function removeFromCollection(collectionId, movieId) {
    if (!movieId) return false;
    var collections = getCollections();
    var col = collections[collectionId];
    if (!col || !Array.isArray(col.movies)) return false;
    var before = col.movies.length;
    col.movies = col.movies.filter(function(m) { return m.id !== movieId; });
    var removed = col.movies.length < before;
    if (removed) saveCollections(collections);
    return removed;
  }

  function deleteCollection(collectionId) {
    var collections = getCollections();
    if (collections[collectionId] && collections[collectionId].isDefault) return false;
    if (!collections[collectionId]) return false;
    delete collections[collectionId];
    saveCollections(collections);
    return true;
  }

  function getWatchTime() { return Lampa.Storage.get(TIME_KEY, 0) || 0; }
  function addWatchTime(s) { Lampa.Storage.set(TIME_KEY, getWatchTime() + (s || 0)); }

  function formatTime(sec) {
    if (!sec || sec < 1) return '0 мин';
    var d = Math.floor(sec / 86400);
    var h = Math.floor((sec % 86400) / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var parts = [];
    if (d > 0) parts.push(d + ' дн');
    if (h > 0) parts.push(h + ' ч');
    if (m > 0) parts.push(m + ' мин');
    return parts.join(' ') || '0 мин';
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

  function posterUrl(movie) {
    var p = movie.poster_path || '';
    if (p && p.indexOf('http') !== 0) p = 'https://image.tmdb.org/t/p/w300' + p;
    return p;
  }

  function isMovieInAnyCollection(movieId) {
    if (!movieId) return false;
    var cols = getCollections();
    var keys = Object.keys(cols);
    for (var i = 0; i < keys.length; i++) {
      if (isInCollection(keys[i], movieId)) return true;
    }
    return false;
  }

  // ========== CSS ==========

  function injectStyles() {
    if (document.getElementById('my-collections-styles')) return;
    var css = ''
      + '.mc-page { padding:0 0 60px 0; }'
      + '.mc-header { display:flex; align-items:center; padding:16px 20px 12px; gap:12px; }'
      + '.mc-header__back { font-size:24px; color:#fff; cursor:pointer; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:8px; background:rgba(255,255,255,0.06); }'
      + '.mc-header__back:hover,.mc-header__back.focus { background:rgba(255,255,255,0.12); }'
      + '.mc-header__title { font-size:28px; font-weight:700; color:#fff; flex:1; }'
      + '.mc-header__time { font-size:14px; color:#3bd574; background:rgba(59,213,116,0.1); padding:6px 12px; border-radius:8px; white-space:nowrap; }'

      + '.mc-tabs { display:flex; gap:10px; padding:0 20px 16px; overflow-x:auto; }'
      + '.mc-tabs::-webkit-scrollbar { display:none; }'
      + '.mc-tab { flex-shrink:0; padding:12px 20px; border-radius:10px; background:rgba(255,255,255,0.06); border:2px solid transparent; cursor:pointer; transition:all .15s; min-width:120px; text-align:center; }'
      + '.mc-tab:hover,.mc-tab.focus { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.1); }'
      + '.mc-tab.active { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.15); }'
      + '.mc-tab__name { font-size:14px; color:rgba(255,255,255,0.6); margin-bottom:4px; }'
      + '.mc-tab.active .mc-tab__name { color:#fff; }'
      + '.mc-tab__count { font-size:22px; font-weight:700; color:#fff; }'
      + '.mc-tab__max { font-size:12px; color:rgba(255,255,255,0.3); }'

      + '.mc-section { margin-bottom:20px; }'
      + '.mc-section__head { display:flex; align-items:center; padding:8px 20px 12px; gap:8px; }'
      + '.mc-section__title { font-size:20px; font-weight:700; color:#fff; flex:1; }'
      + '.mc-section__more { font-size:13px; color:#3bd574; padding:6px 14px; border-radius:6px; background:rgba(59,213,116,0.1); cursor:pointer; }'
      + '.mc-section__more:hover,.mc-section__more.focus { background:rgba(59,213,116,0.2); }'

      + '.mc-subcats { display:flex; gap:8px; padding:0 20px 12px; overflow-x:auto; }'
      + '.mc-subcats::-webkit-scrollbar { display:none; }'
      + '.mc-subcat { flex-shrink:0; display:flex; gap:8px; align-items:center; padding:8px 14px; border-radius:8px; background:rgba(255,255,255,0.06); cursor:pointer; }'
      + '.mc-subcat:hover,.mc-subcat.focus { background:rgba(255,255,255,0.12); }'
      + '.mc-subcat__thumb { width:40px; height:60px; border-radius:4px; background-size:cover; background-position:center; background-color:rgba(255,255,255,0.06); }'
      + '.mc-subcat__info { display:flex; flex-direction:column; gap:2px; }'
      + '.mc-subcat__name { font-size:13px; color:rgba(255,255,255,0.5); }'
      + '.mc-subcat__num { font-size:18px; font-weight:700; color:#fff; }'

      + '.mc-row { display:flex; gap:14px; padding:0 20px; overflow-x:auto; overflow-y:hidden; scroll-behavior:smooth; }'
      + '.mc-row::-webkit-scrollbar { display:none; }'

      + '.mc-card { flex-shrink:0; width:160px; cursor:pointer; position:relative; transition:transform .15s; }'
      + '.mc-card:hover,.mc-card.focus { transform:scale(1.04); }'
      + '.mc-card__poster { width:160px; height:240px; border-radius:8px; background-size:cover; background-position:center top; background-color:rgba(255,255,255,0.06); position:relative; overflow:hidden; }'
      + '.mc-card__badge { position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.75); color:#f5c518; font-size:12px; font-weight:700; padding:3px 7px; border-radius:4px; }'
      + '.mc-card__icons { position:absolute; bottom:8px; left:8px; display:flex; gap:4px; }'
      + '.mc-card__icon { width:24px; height:24px; border-radius:4px; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; font-size:12px; }'
      + '.mc-card__title { margin-top:8px; font-size:13px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
      + '.mc-card__year { margin-top:2px; font-size:12px; color:rgba(255,255,255,0.4); }'

      + '.mc-sort { display:flex; gap:8px; padding:12px 20px; overflow-x:auto; }'
      + '.mc-sort::-webkit-scrollbar { display:none; }'
      + '.mc-sort__btn { flex-shrink:0; padding:8px 16px; border-radius:8px; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); font-size:13px; cursor:pointer; }'
      + '.mc-sort__btn:hover,.mc-sort__btn.focus { background:rgba(255,255,255,0.1); color:#fff; }'
      + '.mc-sort__btn.active { background:rgba(59,213,116,0.15); color:#3bd574; }'

      + '.mc-empty { padding:20px; color:rgba(255,255,255,0.3); font-size:14px; text-align:center; }'

      + '.mc-add { flex-shrink:0; width:160px; height:240px; border-radius:8px; border:2px dashed rgba(255,255,255,0.1); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:rgba(255,255,255,0.3); cursor:pointer; transition:all .15s; }'
      + '.mc-add:hover,.mc-add.focus { border-color:#3bd574; color:#3bd574; }'
      + '.mc-add__icon { font-size:36px; }'
      + '.mc-add__text { font-size:13px; }'

      /* Кнопка на карточке фильма */
      + '.my-collections-btn { display:inline-flex; align-items:center; gap:8px; cursor:pointer; padding:8px 16px; border-radius:8px; background:rgba(255,255,255,0.1); margin:4px; transition:all 0.2s; border:1px solid transparent; }'
      + '.my-collections-btn:hover, .my-collections-btn.focus { background:rgba(255,255,255,0.15); }'
      + '.my-collections-btn.mc-active { background:rgba(59,213,116,0.2); border-color:rgba(59,213,116,0.5); color:#3bd574; }'
      + '.my-collections-btn svg { transition:fill 0.2s; }'
      + '.my-collections-btn.mc-active svg { fill:#3bd574; stroke:#3bd574; }';

    var style = document.createElement('style');
    style.id = 'my-collections-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ========== Plugin Init ==========

  function startPlugin() {
    if (window._my_collections_plugin) return;
    window._my_collections_plugin = true;
    injectStyles();

    Lampa.Manifest.plugins = {
      type: 'video',
      version: '2.0.0',
      name: PLUGIN_NAME,
      description: 'Закладки, коллекции и таймер просмотра',
      component: 'my_collections',
      onContextMenu: function() { return { name: PLUGIN_NAME, description: 'Добавить в коллекцию' }; },
      onContextLaunch: function(obj) { showAddToCollectionDialog(obj); }
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
      item.innerHTML = '<div class="menu__item-icon">🎬</div><div class="menu__item-text">' + PLUGIN_NAME + '</div>';
      item.addEventListener('hover:enter', function() { openCollectionsPage(); });
      var first = menuList.querySelector('.menu__item');
      if (first) menuList.insertBefore(item, first);
      else menuList.appendChild(item);
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
    if (Lampa.Activity && Lampa.Activity.listener) {
      Lampa.Activity.listener.follow('complite', function() {
        setTimeout(tryAddCardButton, 800);
      });
      Lampa.Activity.listener.follow('start', function() {
        setTimeout(tryAddCardButton, 1200);
      });
    }
  }

  // ========== Dialogs ==========

  function showAddToCollectionDialog(movie) {
    if (!movie || !movie.id) {
      Lampa.Noty.show('Ошибка: нет данных о фильме');
      return;
    }
    var collections = getCollections();
    var items = [];
    var keys = Object.keys(collections);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var col = collections[key];
      var inCol = isInCollection(key, movie.id);
      items.push({
        title: col.icon + ' ' + col.name + (inCol ? ' ✓' : ''),
        subtitle: inCol ? 'Нажми чтобы убрать' : 'Добавить',
        _id: key,
        _movie: movie,
        _in: inCol
      });
    }
    items.push({ title: '➕ Создать коллекцию', _create: true });

    Lampa.Select.show({
      title: PLUGIN_NAME,
      items: items,
      onSelect: function(item) {
        if (item._create) {
          showCreateCollectionDialog(item._movie);
        } else if (item._in) {
          removeFromCollection(item._id, item._movie.id);
          Lampa.Noty.show('Убрано из «' + collections[item._id].name + '»');
          refreshCardButton();
        } else {
          var added = addToCollection(item._id, item._movie);
          if (added) {
            Lampa.Noty.show('Добавлено в «' + collections[item._id].name + '»');
          } else {
            Lampa.Noty.show('Уже в коллекции или ошибка');
          }
          refreshCardButton();
        }
      },
      onBack: function() {
        // НЕ делаем Activity.backward() — Select сам закроется
      }
    });
  }

  function showCreateCollectionDialog(movie) {
    var predefinedNames = [
      { title: '🎬 Документальные', name: 'Документальные', icon: '🎬' },
      { title: '😂 Комедии', name: 'Комедии', icon: '😂' },
      { title: '😱 Ужасы', name: 'Ужасы', icon: '😱' },
      { title: '🚀 Фантастика', name: 'Фантастика', icon: '🚀' },
      { title: '💕 Мелодрамы', name: 'Мелодрамы', icon: '💕' },
      { title: '🏋️ Боевики', name: 'Боевики', icon: '🏋️' },
      { title: '🔎 Детективы', name: 'Детективы', icon: '🔎' },
      { title: '🎭 Драмы', name: 'Драмы', icon: '🎭' },
      { title: '📁 Своя коллекция', name: '', icon: '📁' }
    ];

    Lampa.Select.show({
      title: 'Новая коллекция',
      items: predefinedNames.map(function(n) {
        return { title: n.title, _name: n.name, _icon: n.icon };
      }),
      onSelect: function(item) {
        if (item._name) {
          createAndAdd(item._name, item._icon, movie);
        } else {
          showCustomNameDialog(movie);
        }
      },
      onBack: function() {
        showAddToCollectionDialog(movie);
      }
    });
  }

  function showCustomNameDialog(movie) {
    var name = '';
    var letters = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯабвгдежзиклмнопрстуфхцчшщэюя 0123456789';

    function render() {
      var items = [];
      for (var i = 0; i < letters.length; i++) {
        items.push({ title: letters[i], _char: letters[i], _add: true });
      }
      items.push({ title: '⌫ Удалить', _del: true });
      items.push({ title: '✅ Готово: ' + (name || '...'), _done: true });

      Lampa.Select.show({
        title: 'Имя: ' + (name || '_'),
        items: items,
        onSelect: function(sel) {
          if (sel._add) {
            name += sel._char;
            render();
          } else if (sel._del) {
            name = name.slice(0, -1);
            render();
          } else if (sel._done && name.trim()) {
            createAndAdd(name.trim(), '📁', movie);
          }
        },
        onBack: function() {
          if (name.length > 0) {
            name = name.slice(0, -1);
            render();
          } else {
            showCreateCollectionDialog(movie);
          }
        }
      });
    }

    render();
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
    _lastFullCard = null;
    setTimeout(tryAddCardButton, 300);
  }

  // ========== Main Page ==========

  function openCollectionsPage() {
    var collections = getCollections();
    var totalTime = getWatchTime();
    var sortId = getSortId();

    var scroll = new Lampa.Scroll({ mask: true, over: true });
    scroll.body().addClass('mc-page');

    /* Header */
    var header = $(
      '<div class="mc-header">' +
        '<div class="mc-header__back selector" data-nav="back">←</div>' +
        '<div class="mc-header__title">🎬 ' + PLUGIN_NAME + '</div>' +
        (totalTime > 0 ? '<div class="mc-header__time">⏱ ' + formatTime(totalTime) + '</div>' : '') +
      '</div>'
    );
    scroll.append(header);

    /* Tabs */
    var tabsEl = $('<div class="mc-tabs"></div>');
    var keys = Object.keys(collections);

    var allCount = 0;
    for (var i = 0; i < keys.length; i++) allCount += (collections[keys[i]].movies || []).length;

    var allTab = $(
      '<div class="mc-tab active" data-tab="all">' +
        '<div class="mc-tab__name">Все</div>' +
        '<div class="mc-tab__count">' + allCount + '</div>' +
      '</div>'
    );
    tabsEl.append(allTab);

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var col = collections[key];
      var tab = $(
        '<div class="mc-tab" data-tab="' + key + '">' +
          '<div class="mc-tab__name">' + col.icon + ' ' + col.name + '</div>' +
          '<div class="mc-tab__count">' + (col.movies || []).length + '</div>' +
        '</div>'
      );
      tab.data('id', key);
      tabsEl.append(tab);
    }
    scroll.append(tabsEl);

    /* Sort */
    var sortEl = $('<div class="mc-sort"></div>');
    for (var s = 0; s < SORT_OPTIONS.length; s++) {
      var opt = SORT_OPTIONS[s];
      var btn = $('<div class="mc-sort__btn' + (opt.id === sortId ? ' active' : '') + '" data-sort="' + opt.id + '">' + opt.name + '</div>');
      btn.data('sort', opt.id);
      sortEl.append(btn);
    }
    scroll.append(sortEl);

    /* Sections container */
    var sectionsEl = $('<div></div>');
    scroll.append(sectionsEl);

    function renderSections() {
      sectionsEl.empty();
      var cols = getCollections();
      var sId = getSortId();
      var k = Object.keys(cols);

      for (var i = 0; i < k.length; i++) {
        var id = k[i];
        var c = cols[id];
        if (!c.movies || !c.movies.length) continue;

        var sorted = sortMovies(c.movies, sId);
        var films = [], series = [];
        for (var j = 0; j < sorted.length; j++) {
          if (sorted[j].media_type === 'tv') series.push(sorted[j]);
          else films.push(sorted[j]);
        }

        var section = $('<div class="mc-section" data-section="' + id + '"></div>');

        var head = $(
          '<div class="mc-section__head">' +
            '<div class="mc-section__title">' + c.icon + ' ' + c.name + '</div>' +
            '<div class="mc-section__more selector" data-section-more="' + id + '">Еще</div>' +
          '</div>'
        );
        section.append(head);

        var subcats = $('<div class="mc-subcats"></div>');
        if (films.length) {
          var filmThumb = films[0] ? posterUrl(films[0]) : '';
          subcats.append($(
            '<div class="mc-subcat selector" data-sub-type="films" data-sub-col="' + id + '">' +
              '<div class="mc-subcat__thumb" style="background-image:url(' + (filmThumb || '') + ')"></div>' +
              '<div class="mc-subcat__info"><div class="mc-subcat__name">Фильмы</div><div class="mc-subcat__num">' + films.length + '</div></div>' +
            '</div>'
          ));
        }
        if (series.length) {
          var seriesThumb = series[0] ? posterUrl(series[0]) : '';
          subcats.append($(
            '<div class="mc-subcat selector" data-sub-type="series" data-sub-col="' + id + '">' +
              '<div class="mc-subcat__thumb" style="background-image:url(' + (seriesThumb || '') + ')"></div>' +
              '<div class="mc-subcat__info"><div class="mc-subcat__name">Сериалы</div><div class="mc-subcat__num">' + series.length + '</div></div>' +
            '</div>'
          ));
        }
        section.append(subcats);

        var row = $('<div class="mc-row"></div>');
        for (var j = 0; j < sorted.length && j < 12; j++) {
          row.append(createCard(sorted[j], id));
        }
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
      var icons = '';
      if (isInCollection('watched', m.id)) icons += '<div class="mc-card__icon">👁</div>';
      if (isInCollection('favorite', m.id)) icons += '<div class="mc-card__icon">❤️</div>';
      if (isInCollection('will_watch', m.id)) icons += '<div class="mc-card__icon">👀</div>';
      if (isInCollection('later', m.id)) icons += '<div class="mc-card__icon">⏰</div>';

      return $(
        '<div class="mc-card selector" data-mid="' + m.id + '" data-col="' + collectionId + '">' +
          '<div class="mc-card__poster" style="background-image:url(' + (url || '') + ')">' +
            (m.vote_average > 0 ? '<div class="mc-card__badge">' + rating + '</div>' : '') +
            (icons ? '<div class="mc-card__icons">' + icons + '</div>' : '') +
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
      back: function() {
        Lampa.Activity.backward();
      }
    });

    /* Events */
    scroll.render().on('hover:enter', '[data-nav="back"]', function() {
      Lampa.Activity.backward();
    });

    scroll.render().on('hover:enter', '.mc-tab[data-tab]', function() {
      var id = $(this).attr('data-tab') || 'all';
      openCollectionMovies(id);
    });

    scroll.render().on('hover:enter', '.mc-sort__btn[data-sort]', function() {
      var id = $(this).attr('data-sort');
      Lampa.Storage.set(SORT_KEY, id);
      sortEl.find('.mc-sort__btn').removeClass('active');
      $(this).addClass('active');
      renderSections();
      try { scroll.update(); } catch(e) {}
    });

    scroll.render().on('hover:enter', '[data-section-more]', function() {
      openCollectionMovies($(this).data('section-more'));
    });

    scroll.render().on('hover:enter', '.mc-card[data-mid]', function() {
      var movie = $(this).data('movie');
      var col = $(this).data('collection');
      if (movie) showMovieActions(col, movie);
    });

    scroll.render().on('hover:enter', '.mc-subcat[data-sub-type]', function() {
      var type = $(this).attr('data-sub-type');
      var colId = $(this).attr('data-sub-col');
      openCollectionMovies(colId, type);
    });

    Lampa.Activity.push({
      title: PLUGIN_NAME,
      component: 'mc_main',
      onBack: function() {
        Lampa.Controller.toggle('menu');
      }
    });

    setTimeout(function() {
      Lampa.Controller.toggle('mc_main');
      try { scroll.update(); } catch(e) {}
    }, 300);
  }

  // ========== Collection Movies Page ==========

  function openCollectionMovies(collectionId, filterType) {
    var collections = getCollections();
    var isAll = collectionId === 'all';
    var col = isAll ? null : collections[collectionId];
    if (!isAll && !col) return;

    var sortId = getSortId();
    var allMovies = [];

    if (isAll) {
      var k = Object.keys(collections);
      for (var i = 0; i < k.length; i++) {
        if (collections[k[i]].movies) {
          allMovies = allMovies.concat(collections[k[i]].movies);
        }
      }
    } else {
      allMovies = col.movies || [];
    }

    var sorted = sortMovies(allMovies, sortId);
    if (filterType === 'films') sorted = sorted.filter(function(m) { return m.media_type !== 'tv'; });
    else if (filterType === 'series') sorted = sorted.filter(function(m) { return m.media_type === 'tv'; });

    var isCustom = !isAll && collectionId.indexOf('custom_') === 0;
    var titleText = isAll ? 'Все коллекции' : (col.icon + ' ' + col.name);

    var scroll = new Lampa.Scroll({ mask: true, over: true });
    scroll.body().addClass('mc-page');

    /* Header */
    scroll.append($(
      '<div class="mc-header">' +
        '<div class="mc-header__back selector" data-nav="back">←</div>' +
        '<div class="mc-header__title">' + titleText + ' <span style="font-size:14px;color:rgba(255,255,255,0.4);font-weight:400;">(' + sorted.length + ')</span></div>' +
      '</div>'
    ));

    /* Sort */
    var sortEl = $('<div class="mc-sort"></div>');
    for (var s = 0; s < SORT_OPTIONS.length; s++) {
      var opt = SORT_OPTIONS[s];
      sortEl.append($('<div class="mc-sort__btn' + (opt.id === sortId ? ' active' : '') + '" data-sort="' + opt.id + '">' + opt.name + '</div>').data('sort', opt.id));
    }
    scroll.append(sortEl);

    /* Row */
    var row = $('<div class="mc-row"></div>');
    for (var j = 0; j < sorted.length; j++) {
      row.append(createCardSimple(sorted[j], collectionId));
    }
    if (!sorted.length) row.append($('<div class="mc-empty">Пусто</div>'));
    scroll.append(row);

    /* Delete button for custom */
    if (isCustom) {
      var actions = $(
        '<div style="padding:20px;display:flex;gap:10px;">' +
          '<div class="mc-sort__btn selector" data-action="delete" style="color:#e55;">🗑 Удалить коллекцию</div>' +
        '</div>'
      );
      scroll.append(actions);
    }

    function createCardSimple(m, colId) {
      var url = posterUrl(m);
      var year = (m.release_date || '').substring(0, 4);
      var rating = (m.vote_average || 0).toFixed(1);
      return $(
        '<div class="mc-card selector" data-mid="' + m.id + '" data-col="' + colId + '">' +
          '<div class="mc-card__poster" style="background-image:url(' + (url || '') + ')">' +
            (m.vote_average > 0 ? '<div class="mc-card__badge">' + rating + '</div>' : '') +
          '</div>' +
          '<div class="mc-card__title">' + (m.title || '') + '</div>' +
          '<div class="mc-card__year">' + year + '</div>' +
        '</div>'
      ).data('movie', m).data('collection', colId);
    }

    /* Controller */
    Lampa.Controller.add('mc_movies', {
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
      back: function() {
        Lampa.Activity.backward();
      }
    });

    scroll.render().on('hover:enter', '[data-nav="back"]', function() {
      Lampa.Activity.backward();
    });

    scroll.render().on('hover:enter', '.mc-sort__btn[data-sort]', function() {
      Lampa.Storage.set(SORT_KEY, $(this).attr('data-sort'));
      Lampa.Activity.backward();
      setTimeout(function() {
        openCollectionMovies(collectionId, filterType);
      }, 100);
    });

    scroll.render().on('hover:enter', '.mc-card[data-mid]', function() {
      var movie = $(this).data('movie');
      var colId = $(this).data('collection');
      if (movie) showMovieActions(colId, movie);
    });

    scroll.render().on('hover:enter', '[data-action="delete"]', function() {
      Lampa.Select.show({
        title: 'Удалить коллекцию?',
        items: [
          { title: 'Да, удалить «' + col.name + '»', _yes: true },
          { title: 'Нет, оставить', _no: true }
        ],
        onSelect: function(item) {
          if (item._yes) {
            deleteCollection(collectionId);
            Lampa.Noty.show('Коллекция удалена');
            Lampa.Activity.backward();
          } else {
            Lampa.Activity.backward();
          }
        },
        onBack: function() {
          // Просто закрываем диалог
        }
      });
    });

    Lampa.Activity.push({
      title: titleText,
      component: 'mc_movies',
      onBack: function() {
        Lampa.Activity.backward();
      }
    });

    setTimeout(function() {
      Lampa.Controller.toggle('mc_movies');
      try { scroll.update(); } catch(e) {}
    }, 300);
  }

  // ========== Movie Actions ==========

  function showMovieActions(collectionId, movie) {
    var cols = getCollections();
    var inCols = [];
    var k = Object.keys(cols);
    for (var i = 0; i < k.length; i++) {
      if (isInCollection(k[i], movie.id)) inCols.push(cols[k[i]].icon + ' ' + cols[k[i]].name);
    }

    var items = [
      { title: '📄 Подробнее', _a: 'info' },
      { title: '🔄 Переместить...', _a: 'move' },
      { title: '🗑 Удалить', _a: 'remove' }
    ];

    Lampa.Select.show({
      title: (movie.title || 'Фильм') + (inCols.length ? ' [' + inCols.join(', ') + ']' : ''),
      items: items,
      onSelect: function(item) {
        if (item._a === 'info') {
          var card = {
            id: movie.id,
            title: movie.title || '',
            original_title: movie.original_title || '',
            poster_path: movie.poster_path || '',
            backdrop_path: movie.backdrop_path || '',
            release_date: movie.release_date || '',
            vote_average: movie.vote_average || 0,
            vote_count: movie.vote_count || 0,
            overview: movie.overview || '',
            genre_ids: movie.genre_ids || [],
            source: movie.source || 'tmdb',
            media_type: movie.media_type || 'movie'
          };
          Lampa.Activity.push({
            title: card.title,
            component: 'full',
            card: card,
            data: { movie: card }
          });
        } else if (item._a === 'remove') {
          removeFromCollection(collectionId, movie.id);
          Lampa.Noty.show('Удалено из коллекции');
          Lampa.Activity.backward();
        } else if (item._a === 'move') {
          showMoveDialog(collectionId, movie);
        }
      },
      onBack: function() {
        // Закрываем диалог, остаёмся на странице
      }
    });
  }

  function showMoveDialog(fromId, movie) {
    var collections = getCollections();
    var items = [];
    var keys = Object.keys(collections);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] === fromId) continue;
      var c = collections[keys[i]];
      items.push({ title: c.icon + ' ' + c.name, _id: keys[i] });
    }
    Lampa.Select.show({
      title: 'Переместить «' + (movie.title || '') + '»',
      items: items,
      onSelect: function(item) {
        removeFromCollection(fromId, movie.id);
        addToCollection(item._id, movie);
        Lampa.Noty.show('Перемещено');
        Lampa.Activity.backward();
      },
      onBack: function() {
        showMovieActions(fromId, movie);
      }
    });
  }

  // ========== Card Button ==========

  var _lastFullCard = null;

  function tryAddCardButton() {
    try {
      var active = Lampa.Activity.active();
      if (!active) return;

      var movie = active.card || (active.data && active.data.movie);
      if (!movie || !movie.id) return;
      if (_lastFullCard && _lastFullCard.id === movie.id) return;

      var render = active.activity && active.activity.render ? active.activity.render() : null;
      if (!render || !render.length) return;

      render.find('.my-collections-btn').remove();

      var inAny = isMovieInAnyCollection(movie.id);
      var activeClass = inAny ? 'mc-active' : '';

      var btnHtml = '<div class="full-start__button selector my-collections-btn ' + activeClass + '" style="display:inline-flex;align-items:center;gap:8px;">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="' + (inAny ? '#3bd574' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
        '<span>' + PLUGIN_NAME + '</span></div>';

      var btn = $(btnHtml);
      btn.on('hover:enter click', function() {
        showAddToCollectionDialog(movie);
      });

      var targets = [
        '.full-start__buttons .full-start__button:last-child',
        '.full-start__buttons',
        '.full-start__left',
        '.detail-page__buttons',
        '.buttons-full',
        '.full-start__tag'
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
          var txt = $(this).text();
          return txt.indexOf('Торрент') >= 0 || txt.indexOf('Онлайн') >= 0 || txt.indexOf('Трейлер') >= 0;
        }).first();
        if (anyBtn.length) {
          anyBtn.parent().append(btn);
          inserted = true;
        }
      }

      if (!inserted) {
        var desc = render.find('.full-start__text, .full__description, .detail-page__text');
        if (desc.length) {
          desc.first().after(btn);
          inserted = true;
        }
      }

      if (inserted) _lastFullCard = movie;
    } catch(e) {
      console.log('[MC] Button error:', e);
    }
  }

  // ========== Init ==========

  function start() {
    startPlugin();
  }

  if (typeof Lampa !== 'undefined') start();
  else {
    var w = setInterval(function() {
      if (typeof Lampa !== 'undefined') { clearInterval(w); start(); }
    }, 500);
  }

})();
