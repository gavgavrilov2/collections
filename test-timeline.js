/**
 * Тест интеграции Timeline для плагина "Мои Коллекции"
 * Версия 2 — с учётом исправлений для сериалов
 * 
 * Вставьте в консоль браузера после загрузки Lampa с плагином.
 */

(function() {
  'use strict';

  var results = [];
  var passed = 0;
  var failed = 0;

  function log(name, ok, detail) {
    var status = ok ? 'PASS' : 'FAIL';
    var msg = '[' + status + '] ' + name + (detail ? ' — ' + detail : '');
    console.log(msg);
    results.push({ name: name, ok: ok, detail: detail });
    if (ok) passed++; else failed++;
  }

  function assert(condition, name, detail) {
    log(name, !!condition, detail || '');
  }

  // ===== Тест 1: Доступность API =====

  console.group('Тест 1: Доступность API');

  assert(typeof Lampa !== 'undefined', 'Lampa доступен');
  assert(typeof Lampa.Utils !== 'undefined', 'Lampa.Utils доступен');
  assert(typeof Lampa.Utils.hash === 'function', 'Lampa.Utils.hash доступен');
  assert(typeof Lampa.Timeline !== 'undefined', 'Lampa.Timeline доступен');
  assert(typeof Lampa.Timeline.update === 'function', 'Lampa.Timeline.update доступен');
  assert(typeof Lampa.Timeline.view === 'function', 'Lampa.Timeline.view доступен');

  console.groupEnd();

  // ===== Тест 2: Hash-генерация =====

  console.group('Тест 2: Hash-генерация');

  var hash1 = Lampa.Utils.hash('The Shawshank Redemption');
  var hash2 = Lampa.Utils.hash('The Shawshank Redemption');
  var hash3 = Lampa.Utils.hash('Breaking Bad');
  var hash4 = Lampa.Utils.hash('11Breaking Bad'); // S1E1
  var hash5 = Lampa.Utils.hash('12Breaking Bad'); // S1E2
  var hash6 = Lampa.Utils.hash('21Breaking Bad'); // S2E1

  assert(typeof hash1 === 'string', 'Hash возвращает строку', 'тип: ' + typeof hash1);
  assert(hash1 === hash2, 'Hash детерминирован', '"' + hash1 + '" === "' + hash2 + '"');
  assert(hash1 !== hash3, 'Разные строки → разные hash', '"' + hash1 + '" !== "' + hash3 + '"');
  assert(hash4 !== hash5, 'S1E1 ≠ S1E2', '"' + hash4 + '" !== "' + hash5 + '"');
  assert(hash4 !== hash6, 'S1E1 ≠ S2E1', '"' + hash4 + '" !== "' + hash6 + '"');
  assert(hash5 !== hash6, 'S1E2 ≠ S2E1', '"' + hash5 + '" !== "' + hash6 + '"');
  assert(hash1.length > 0, 'Hash не пустой', 'длина: ' + hash1.length);

  console.groupEnd();

  // ===== Тест 3: Прогресс фильма =====

  console.group('Тест 3: Прогресс фильма');

  var testMovie = {
    original_title: 'Test Movie Timeline 2',
    original_name: 'Test Movie Timeline 2',
    title: 'Тестовый фильм 2'
  };

  var movieHash = Lampa.Utils.hash(testMovie.original_title);

  // Очистка
  Lampa.Timeline.update({ hash: movieHash, percent: 0, time: 0, duration: 0 });

  // Запись прогресса 50%
  Lampa.Timeline.update({ hash: movieHash, percent: 50, time: 3600, duration: 7200 });

  // Чтение
  var movieView = Lampa.Timeline.view(movieHash);
  assert(movieView.percent === 50, 'Прогресс фильма = 50%', 'percent: ' + movieView.percent);
  assert(movieView.time === 3600, 'Время = 3600', 'time: ' + movieView.time);
  assert(movieView.duration === 7200, 'Длительность = 7200', 'duration: ' + movieView.duration);

  // Обновление до 75%
  Lampa.Timeline.update({ hash: movieHash, percent: 75, time: 5400, duration: 7200 });
  movieView = Lampa.Timeline.view(movieHash);
  assert(movieView.percent === 75, 'Обновление до 75%', 'percent: ' + movieView.percent);

  // Очистка
  Lampa.Timeline.update({ hash: movieHash, percent: 0, time: 0, duration: 0 });

  console.groupEnd();

  // ===== Тест 4: Прогресс сериала (независимость эпизодов) =====

  console.group('Тест 4: Прогресс сериала (S1E1 vs S1E2)');

  var testSeries = {
    original_title: 'Test Series Timeline 2',
    original_name: 'Test Series Timeline 2'
  };

  var hashS1E1 = Lampa.Utils.hash([1, '', 1, testSeries.original_name].join(''));
  var hashS1E2 = Lampa.Utils.hash([1, '', 2, testSeries.original_name].join(''));
  var hashS2E1 = Lampa.Utils.hash([2, '', 1, testSeries.original_name].join(''));

  // Очистка
  Lampa.Timeline.update({ hash: hashS1E1, percent: 0, time: 0, duration: 0 });
  Lampa.Timeline.update({ hash: hashS1E2, percent: 0, time: 0, duration: 0 });
  Lampa.Timeline.update({ hash: hashS2E1, percent: 0, time: 0, duration: 0 });

  assert(hashS1E1 !== hashS1E2, 'Hash S1E1 ≠ S1E2');
  assert(hashS1E1 !== hashS2E1, 'Hash S1E1 ≠ S2E1');
  assert(hashS1E2 !== hashS2E1, 'Hash S1E2 ≠ S2E1');

  // Запись S1E1 = 50%
  Lampa.Timeline.update({ hash: hashS1E1, percent: 50, time: 1200, duration: 2400 });

  // Запись S1E2 = 25%
  Lampa.Timeline.update({ hash: hashS1E2, percent: 25, time: 600, duration: 2400 });

  // Проверка S1E1
  var viewS1E1 = Lampa.Timeline.view(hashS1E1);
  assert(viewS1E1.percent === 50, 'S1E1 percent = 50%', 'percent: ' + viewS1E1.percent);
  assert(viewS1E1.time === 1200, 'S1E1 time = 1200', 'time: ' + viewS1E1.time);

  // Проверка S1E2
  var viewS1E2 = Lampa.Timeline.view(hashS1E2);
  assert(viewS1E2.percent === 25, 'S1E2 percent = 25%', 'percent: ' + viewS1E2.percent);
  assert(viewS1E2.time === 600, 'S1E2 time = 600', 'time: ' + viewS1E2.time);

  // Проверка что S1E1 не перезаписан
  viewS1E1 = Lampa.Timeline.view(hashS1E1);
  assert(viewS1E1.percent === 50, 'S1E1 НЕ перезаписан после S1E2', 'percent: ' + viewS1E1.percent);

  // Запись S2E1 = 100%
  Lampa.Timeline.update({ hash: hashS2E1, percent: 100, time: 2400, duration: 2400 });
  var viewS2E1 = Lampa.Timeline.view(hashS2E1);
  assert(viewS2E1.percent === 100, 'S2E1 percent = 100%', 'percent: ' + viewS2E1.percent);

  // Очистка
  Lampa.Timeline.update({ hash: hashS1E1, percent: 0, time: 0, duration: 0 });
  Lampa.Timeline.update({ hash: hashS1E2, percent: 0, time: 0, duration: 0 });
  Lampa.Timeline.update({ hash: hashS2E1, percent: 0, time: 0, duration: 0 });

  console.groupEnd();

  // ===== Тест 5: Просмотренность =====

  console.group('Тест 5: Просмотренность');

  var viewedMovie = {
    original_title: 'Test Viewed Movie 2',
    original_name: 'Test Viewed Movie 2'
  };
  var viewedHash = Lampa.Utils.hash(viewedMovie.original_title);

  // Не просмотрен
  Lampa.Timeline.update({ hash: viewedHash, percent: 0, time: 0, duration: 0 });
  var viewData = Lampa.Timeline.view(viewedHash);
  assert(viewData.percent < 95, 'Фильм НЕ просмотрен', 'percent: ' + viewData.percent);

  // Просмотрен
  Lampa.Timeline.update({ hash: viewedHash, percent: 100, time: 7200, duration: 7200 });
  viewData = Lampa.Timeline.view(viewedHash);
  assert(viewData.percent >= 95, 'Фильм просмотрен', 'percent: ' + viewData.percent);

  // Очистка
  Lampa.Timeline.update({ hash: viewedHash, percent: 0, time: 0, duration: 0 });

  console.groupEnd();

  // ===== Тест 6: Старые ключи =====

  console.group('Тест 6: Старые ключи');

  var oldProgress = localStorage.getItem('mc_watch_progress');
  var oldViewed = localStorage.getItem('mc_last_viewed');
  var migrationFlag = localStorage.getItem('mc_migration_timeline');

  log('mc_watch_progress: ' + (oldProgress ? 'есть данные' : 'пусто/нет'), true);
  log('mc_last_viewed: ' + (oldViewed ? 'есть данные' : 'пусто/нет'), true);
  log('mc_migration_timeline: ' + (migrationFlag || 'нет'), true);

  console.groupEnd();

  // ===== Тест 7: Ошибки =====

  console.group('Тест 7: Обработка ошибок');

  try {
    Lampa.Timeline.update({ hash: '', percent: 50, time: 100, duration: 200 });
    log('Запись с пустым hash — OK', true);
  } catch(e) {
    log('Запись с пустым hash — OK', false, e.message);
  }

  try {
    var nonExistent = Lampa.Timeline.view('nonexistent_hash_12345');
    assert(typeof nonExistent === 'object', 'Чтение несуществующего hash — объект');
    assert(nonExistent.percent === 0, 'Несуществующий hash → percent = 0', 'percent: ' + nonExistent.percent);
  } catch(e) {
    log('Чтение несуществующего hash', false, e.message);
  }

  console.groupEnd();

  // ===== Итоги =====

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ TIMELINE v2');
  console.log('═══════════════════════════════════════');
  console.log('Всего: ' + (passed + failed));
  console.log('Пройдено: ' + passed);
  console.log('Провалено: ' + failed);
  console.log('═══════════════════════════════════════');

  if (failed > 0) {
    console.log('');
    console.log('ПРОВАЛЕННЫЕ ТЕСТЫ:');
    results.filter(function(r) { return !r.ok; }).forEach(function(r) {
      console.log('  - ' + r.name + (r.detail ? ': ' + r.detail : ''));
    });
  }

  console.log('');
  console.log('Ручная проверка:');
  console.log('1. Откройте фильм → посмотрите часть → выйдите');
  console.log('2. Откройте "Мои Коллекции" → "Продолжить просмотр"');
  console.log('3. Проверьте что фильм отображается с прогрессом');
  console.log('4. Проверьте что карточка открывается с правильной позиции');
  console.log('5. Для сериала: посмотрите S1E1 и S1E2 до разных частей');
  console.log('6. Проверьте что оба эпизода отображаются независимо');

})();
