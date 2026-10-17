(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const MAX_DEPTH = 300;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const pad = n => String(n).padStart(3, '0');

  /* ---------- Тексты для русской и английской версий ---------- */
  const EN = document.documentElement.lang === 'en';
  const T = EN ? {
    unit: 'm',
    menuOpen: 'Open menu', menuClose: 'Close menu',
    hots: [
      ['01 · Camera', 'High-definition camera', 'Colour camera on a tilt mechanism: the pilot angles it to examine the hull from any side. Everything it sees is recorded for the report.', ['Tilt mechanism', 'Recorded for the report'], 'CAMERA'],
      ['02 · Light', 'LED floodlight', 'On-board lighting gives a clear picture at depth, under the bottom and in murky water — where daylight does not reach.', ['LED', 'Murky water', 'Under the bottom'], 'LED LIGHT'],
      ['03 · Thruster', 'Ducted electric thruster', 'A propeller in a protective duct. Five such thrusters let the pilot manoeuvre precisely along the hull and hold position at any spot.', ['5 thrusters', 'Station keeping'], 'THRUSTER'],
      ['04 · Buoyancy', 'Buoyancy blocks', 'The yellow blocks keep the drone neutrally buoyant, so it hovers steadily next to the hull instead of sinking when it stops.', ['Neutral buoyancy', 'Stable hover'], 'BUOYANCY'],
      ['05 · Frame', 'Protective frame', 'A sturdy frame protects the camera and thrusters when working close to the hull and launching from deck. About one metre long.', ['≈1 m', 'Up to 300 m'], 'FRAME']
    ],
    modes: { photo: 'PHOTO', sonar: 'SONAR', blueprint: 'BLUEPRINT' },
    quiz: { depth: [75, 150, 225, 300] },
    mailSubject: 'Hull inspection request / Заявка на осмотр судна',
    mailTitle: 'Request from the FlotService website (English version)',
    labels: ['Name / Имя', 'Phone / Телефон', 'Company / Компания', 'Vessel / Судно', 'Vessel length / Длина', 'Port / Порт', 'Service / Формат', 'Comment / Комментарий']
  } : {
    unit: 'м',
    menuOpen: 'Открыть меню', menuClose: 'Закрыть меню',
    hots: [
      ['01 · Камера', 'Камера высокого разрешения', 'Цветная камера на поворотном механизме: оператор наклоняет её и рассматривает корпус под нужным углом. Всё, что она видит, записывается для акта.', ['Поворотный механизм', 'Запись для акта'], 'КАМЕРА'],
      ['02 · Свет', 'Светодиодный прожектор', 'Собственное освещение даёт чёткую картинку на глубине, под днищем и в мутной воде — там, куда не доходит дневной свет.', ['LED', 'Мутная вода', 'Под днищем'], 'ПРОЖЕКТОР'],
      ['03 · Движение', 'Движитель в насадке', 'Винт в защитном кольце. Пять таких движителей позволяют точно маневрировать вдоль борта и удерживать позицию у нужного участка.', ['5 движителей', 'Удержание позиции'], 'ДВИЖИТЕЛЬ'],
      ['04 · Плавучесть', 'Блоки плавучести', 'Жёлтые блоки держат аппарат в нейтральной плавучести: он устойчиво висит у корпуса и не тонет, когда останавливается.', ['Нейтральная плавучесть', 'Устойчивость'], 'ПЛАВУЧЕСТЬ'],
      ['05 · Рама', 'Защитная рама', 'Прочная рама защищает камеру и движители при работе у корпуса и при спуске с борта. Длина аппарата — около метра.', ['≈1 м', 'До 300 м'], 'РАМА']
    ],
    modes: { photo: 'ФОТО', sonar: 'СОНАР', blueprint: 'ЧЕРТЁЖ' },
    quiz: { depth: [75, 150, 225, 300] },
    mailSubject: 'Заявка на осмотр судна',
    mailTitle: 'Заявка с сайта ФлотСервис',
    labels: ['Имя', 'Телефон', 'Компания', 'Судно', 'Длина судна', 'Порт', 'Формат', 'Комментарий']
  };

  /* ---------- Сайт всегда открывается с первого экрана ---------- */
  // браузер не должен восстанавливать прошлую позицию или прыгать по #якорю из адреса
  const toTop = () => {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  toTop();
  addEventListener('load', toTop);
  addEventListener('pageshow', e => { if (e.persisted) toTop(); });

  // ссылки внутри страницы листают к разделу, но не дописывают #якорь в адрес —
  // иначе при повторном открытии сайт начинался бы с этого раздела
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---------- Прелоадер: «погружение» 000 → 300 м ---------- */
  const loader = $('#loader');
  const loaderDepth = $('#loaderDepth');
  const loaderBar = $('#loaderBar');
  document.body.classList.add('is-loading');

  let finished = false;
  function finishLoading() {
    if (finished) return;
    finished = true;
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    setTimeout(() => loader.remove(), 1200);
  }

  let seen = false;
  try { seen = sessionStorage.getItem('fs-intro') === '1'; sessionStorage.setItem('fs-intro', '1'); } catch (e) {}
  if (reduced || seen) {
    loader.style.display = 'none';
    finishLoading();
  } else {
    const DURATION = 1500;
    const t0 = performance.now();
    let loaded = document.readyState === 'complete';
    addEventListener('load', () => (loaded = true));
    (function tick(now) {
      const p = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3);
      loaderDepth.textContent = pad(Math.round(eased * MAX_DEPTH));
      loaderBar.style.width = eased * 100 + '%';
      // ждём загрузку страницы, но не дольше 3,5 с
      if (finished) return;
      if (p < 1 || (!loaded && now - t0 < 3500)) requestAnimationFrame(tick);
      else setTimeout(finishLoading, 200);
    })(t0);
    // страховка: в фоновой вкладке анимация может стоять — заставку всё равно убираем
    setTimeout(finishLoading, 4000);
  }

  /* ---------- Шапка, глубиномер, мобильная панель ---------- */
  const header = $('.header');
  const gauge = $('.gauge');
  const zoneLabel = $('#gaugeSection');
  const depthEls = $$('[data-depth]');
  const mbar = $('.mbar');
  const hero = $('.hero');
  const zones = $$('[data-zone]');
  const nav = $('#nav');

  // метки «— N м» у секций считаем по той же шкале, что и глубиномер
  function syncDepthTags() {
    const max = document.documentElement.scrollHeight - innerHeight;
    $$('.depth-tag:not(.depth-tag--fixed)').forEach(tag => {
      const sec = tag.closest('section');
      const y = Math.min(max, Math.max(0, sec.offsetTop - innerHeight * 0.4));
      tag.textContent = '— ' + Math.round((y / max) * MAX_DEPTH) + ' ' + T.unit;
    });
  }

  // Размеры страницы меряем заранее (при загрузке и изменении вёрстки),
  // а во время прокрутки только сравниваем числа и меняем DOM, если что-то изменилось.
  // Так скролл не заставляет браузер пересчитывать раскладку на каждом кадре.
  const navLinks = $$('.nav > a');
  const metrics = { vh: innerHeight, max: 1, heroH: 0, zoneTops: [] };
  const measurers = [];
  function measure() {
    metrics.vh = innerHeight;
    metrics.max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    metrics.heroH = hero.offsetHeight;
    metrics.zoneTops = zones.map(z => z.getBoundingClientRect().top + scrollY);
    measurers.forEach(fn => fn());
  }

  // Глубиномер слева: шкала с делениями, указатель, давление и метки разделов
  // (по меткам можно перейти к разделу). Шапка видна всегда, внизу у неё полоска глубины.
  const gaugePa = $('#gaugePa');
  const gaugeMarks = $('#gaugeMarks');
  const markZones = zones.filter(z => z.id);
  const marks = markZones.map(z => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gauge__mark';
    b.innerHTML = `<span>${z.dataset.zone}</span>`;
    b.setAttribute('aria-label', z.dataset.zone);
    b.addEventListener('click', () => z.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));
    gaugeMarks.appendChild(b);
    return b;
  });
  measurers.push(() => markZones.forEach((z, i) => {
    const top = Math.min(metrics.max, Math.max(0, z.getBoundingClientRect().top + scrollY - metrics.vh * 0.4));
    marks[i].style.top = (top / metrics.max) * 100 + '%';
  }));

  const state = { depth: -1, zone: -1, scrolled: null, pastHero: null };
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY;
    const { vh, max, heroH, zoneTops } = metrics;
    const p = Math.min(1, Math.max(0, y / max));

    const scrolled = y > 20;
    if (scrolled !== state.scrolled) { state.scrolled = scrolled; header.classList.toggle('is-scrolled', scrolled); }

    const depth = Math.round(p * MAX_DEPTH);
    if (depth !== state.depth) {
      state.depth = depth;
      const txt = pad(depth);
      depthEls.forEach(el => (el.textContent = txt));
      gauge.style.setProperty('--p', p.toFixed(4));
      header.style.setProperty('--p', p.toFixed(4));
      // давление: 1 атм на поверхности + 1 атм на каждые 10 м воды
      gaugePa.textContent = (1 + depth / 10).toFixed(1);
    }
    const pastHero = y > heroH * 0.6;
    if (pastHero !== state.pastHero) {
      state.pastHero = pastHero;
      gauge.classList.toggle('is-on', pastHero);
      mbar.classList.toggle('is-on', pastHero);
    }

    const mid = y + vh * 0.4;
    let zi = 0;
    for (let i = 0; i < zoneTops.length; i++) if (zoneTops[i] <= mid) zi = i;
    if (zi !== state.zone) {
      state.zone = zi;
      const current = zones[zi];
      zoneLabel.textContent = current.dataset.zone;
      navLinks.forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + current.id));
      marks.forEach((m, i) => m.classList.toggle('is-current', markZones[i] === current));
    }

    words(y);
    parallax(y);
  }
  const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  addEventListener('scroll', requestTick, { passive: true });

  // на телефоне resize срабатывает, когда прячется адресная строка, — пересчитываем с задержкой
  let lastW = innerWidth;
  let resizeTimer;
  const remeasure = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (innerWidth !== lastW) { lastW = innerWidth; syncDepthTags(); }
      measure();
      requestTick();
    }, 150);
  };
  addEventListener('resize', remeasure);
  addEventListener('load', () => { syncDepthTags(); measure(); requestTick(); });
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(document.body);

  /* ---------- Мобильное меню ---------- */
  const burger = $('#burger');
  const setMenu = open => {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? T.menuClose : T.menuOpen);
    document.body.style.overflow = open ? 'hidden' : '';
    mbar.style.visibility = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('a', nav).forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Логотип и «Наверх»: в самое начало ---------- */
  $$('.logo, [data-top]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    setMenu(false);
    scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', location.pathname);
  }));

  /* ---------- Переключатель «одно судно / флот» ---------- */
  $$('.switch__btn').forEach(btn => btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    $$('.switch__btn').forEach(b => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on);
    });
    $$('.who__panel').forEach(p => (p.hidden = p.id !== 'tab-' + tab));
  }));

  /* ---------- Точки на дроне ---------- */
  // Нажатие на точку приближает фото к детали и подсвечивает её «прожектором».
  // Детали листаются стрелками, свайпом и клавишами ← →, есть автоматическая экскурсия.
  const drone = $('#drone');
  const stage = $('#droneStage');
  const tip = $('#droneTip');
  const hots = $$('.hot', stage);
  const count = $('#droneCount');
  const resetBtn = $('#droneReset');
  const tourBtn = $('#droneTour');
  const tourBar = $('#droneBar');
  const introHTML = tip.innerHTML;
  const hudTarget = $('#hudTarget');
  const hudZoom = $('#hudZoom');
  const hudMode = $('#hudMode');
  const hudClock = $('#hudClock');
  const monitor = $('#droneMonitor');
  const TOUR_MS = 4500;
  let current = -1;
  let tourTimer = null;

  function showPart(i) {
    current = i;
    hots.forEach((h, k) => {
      const on = k === i;
      h.classList.toggle('is-active', on);
      h.setAttribute('aria-pressed', on);
    });
    if (i < 0) {
      stage.classList.remove('is-zoomed');
      stage.style.removeProperty('--zx');
      stage.style.removeProperty('--zy');
      tip.innerHTML = introHTML;
      count.textContent = '00 / ' + pad2(hots.length);
      resetBtn.hidden = true;
      hudTarget.textContent = '—';
      hudZoom.textContent = '1.0×';
    } else {
      const h = hots[i];
      stage.style.setProperty('--zx', h.style.getPropertyValue('--x'));
      stage.style.setProperty('--zy', h.style.getPropertyValue('--y'));
      stage.classList.add('is-zoomed');
      const [m, t, d, chips, target] = T.hots[i];
      hudTarget.textContent = target;
      hudZoom.textContent = matchMedia('(max-width: 640px)').matches ? '2.1×' : '2.0×';
      tip.innerHTML = `<span class="mono">${m}</span><b>${t}</b><span>${d}</span>` +
        `<span class="drone__chips">${chips.map(c => `<i>${c}</i>`).join('')}</span>`;
      count.innerHTML = `<b>${pad2(i + 1)}</b> / ${pad2(hots.length)}`;
      resetBtn.hidden = false;
      drone.classList.add('is-used');
    }
    // перезапускаем анимацию появления текста
    tip.classList.remove('is-swap');
    void tip.offsetWidth;
    tip.classList.add('is-swap');
  }
  const pad2 = n => String(n).padStart(2, '0');
  const step = dir => showPart(current < 0 && dir < 0 ? hots.length - 1 : (current + dir + hots.length) % hots.length);

  function runBar() {
    tourBar.classList.remove('is-run');
    void tourBar.offsetWidth;
    tourBar.style.setProperty('--tour', TOUR_MS + 'ms');
    tourBar.classList.add('is-run');
  }
  function stopTour() {
    clearInterval(tourTimer);
    tourTimer = null;
    tourBtn.setAttribute('aria-pressed', 'false');
    tourBar.classList.remove('is-run');
  }
  function startTour() {
    tourBtn.setAttribute('aria-pressed', 'true');
    step(1);
    runBar();
    tourTimer = setInterval(() => {
      if (current === hots.length - 1) { stopTour(); showPart(-1); return; }
      step(1);
      runBar();
    }, TOUR_MS);
  }
  // любое ручное действие останавливает экскурсию
  const manual = fn => (...args) => { stopTour(); fn(...args); };

  hots.forEach((h, i) => h.addEventListener('click', manual(e => {
    e.stopPropagation();
    showPart(current === i ? -1 : i);
  })));
  $('#dronePrev').addEventListener('click', manual(() => step(-1)));
  $('#droneNext').addEventListener('click', manual(() => step(1)));
  resetBtn.addEventListener('click', manual(() => showPart(-1)));
  tourBtn.addEventListener('click', () => (tourTimer ? stopTour() : startTour()));
  // нажатие на приближенное фото мимо точки — вернуться к общему виду
  stage.addEventListener('click', manual(() => { if (current >= 0) showPart(-1); }));

  // клавиши ← → и Esc, когда фокус внутри блока с дроном
  drone.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); manual(() => step(1))(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); manual(() => step(-1))(); }
    else if (e.key === 'Escape' && current >= 0) manual(() => showPart(-1))();
  });

  // страховка для старых браузеров без overflow:clip — рамка фото не должна прокручиваться
  const frame = stage.parentElement;
  frame.addEventListener('scroll', () => { frame.scrollLeft = 0; frame.scrollTop = 0; });

  // свайп влево/вправо по фото на телефоне
  let sx = 0, sy = 0;
  stage.parentElement.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.parentElement.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) manual(() => step(dx < 0 ? 1 : -1))();
  }, { passive: true });

  // экскурсия ставится на паузу, если блок с дроном ушёл с экрана
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { if (!e.isIntersecting && tourTimer) stopTour(); }).observe(drone);
  }
  // режимы изображения: фото, сонар, чертёж
  $$('.drone__mode').forEach(btn => btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    stage.dataset.mode = mode;
    hudMode.textContent = T.modes[mode];
    $$('.drone__mode').forEach(b => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-checked', on);
    });
    drone.classList.add('is-used');
  }));

  // часы в углу «камеры» — идут, только пока блок на экране
  let clockTimer = null;
  const tickClock = () => { hudClock.textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false }); };
  // линия сканирования проходит всю высоту кадра
  const setScanHeight = () => monitor.style.setProperty('--h', frame.offsetHeight + 'px');
  measurers.push(setScanHeight);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      clearInterval(clockTimer);
      if (e.isIntersecting) { tickClock(); clockTimer = setInterval(tickClock, 1000); }
    }).observe(monitor);
  } else tickClock();

  // монитор слегка наклоняется вслед за мышью (только на компьютере)
  if (fine && !reduced) {
    monitor.addEventListener('mousemove', e => {
      const r = monitor.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      monitor.style.setProperty('--rx', (x * 6).toFixed(2) + 'deg');
      monitor.style.setProperty('--ry', (-y * 5).toFixed(2) + 'deg');
    });
    monitor.addEventListener('mouseleave', () => {
      monitor.style.setProperty('--rx', '0deg');
      monitor.style.setProperty('--ry', '0deg');
    });
  }

  showPart(-1);
  tip.classList.remove('is-swap');

  /* ---------- Видео ---------- */
  const player = $('#player');
  const video = $('#mainVideo');
  // «Смотреть» — запускаем фильм сразу на весь экран
  // если браузер не разрешает настоящий полный экран — раскрываем плеер на всё окно
  const setTheater = on => {
    player.classList.toggle('is-theater', on);
    document.body.style.overflow = on ? 'hidden' : '';
  };
  function openFilm() {
    player.classList.add('is-in');
    video.play().catch(() => {});
    try {
      if (video.requestFullscreen) video.requestFullscreen().catch(() => setTheater(true));
      else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
      else if (video.webkitEnterFullscreen) { video.webkitEnterFullscreen(); return; } // iPhone
      else return setTheater(true);
    } catch (e) { return setTheater(true); }
    // некоторые встроенные браузеры молча игнорируют запрос — подстрахуемся
    setTimeout(() => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) setTheater(true);
    }, 600);
  }
  $('#closeFilm').addEventListener('click', () => setTheater(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && player.classList.contains('is-theater')) setTheater(false); });
  $('#playBtn').addEventListener('click', openFilm);
  $$('[data-film]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    player.scrollIntoView({ behavior: 'auto', block: 'center' });
    openFilm();
  }));
  video.addEventListener('play', () => { player.classList.add('is-playing'); video.controls = true; });
  video.addEventListener('ended', () => player.classList.remove('is-playing'));
  const heroVideo = $('.hero__video');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (saveData) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }
  // фоновое видео не декодируем, когда первый экран уже прокручен
  else if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) heroVideo.play().catch(() => {});
      else heroVideo.pause();
    }).observe(hero);
  }

  /* ---------- Появление блоков ---------- */
  const revealTargets = $$('.shead, .switch, .who, .row, .drone, .falcon__text, .task, .quote, .player, .promise, .individual, .port, .letter, .clients__stats, .logos, .acc, .form, .contact__l, .manifest__sign, .sizes, .footer__in');
  revealTargets.forEach(el => el.classList.add('reveal'));
  const stepItems = $$('.steps li');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    [...revealTargets, ...stepItems].forEach(el => io.observe(el));
  } else [...revealTargets, ...stepItems].forEach(el => el.classList.add('is-in'));

  /* ---------- Манифест: слова «проявляются» при прокрутке ---------- */
  const wordBlocks = $$('.reveal-words');
  wordBlocks.forEach(block => {
    const walk = node => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.append(part);
          else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.append(s); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(block);
  });
  const wordData = wordBlocks.map(block => ({ ws: $$('.w', block), top: 0, h: 0, n: -1 }));
  measurers.push(() => wordBlocks.forEach((block, i) => {
    const r = block.getBoundingClientRect();
    wordData[i].top = r.top + scrollY;
    wordData[i].h = r.height;
  }));
  function words(y) {
    const vh = metrics.vh;
    wordData.forEach(d => {
      const top = d.top - y;
      const p = Math.min(1, Math.max(0, (vh * 0.85 - top) / (d.h + vh * 0.35)));
      const n = Math.round(p * d.ws.length);
      if (n === d.n) return;
      const from = Math.min(n, d.n < 0 ? 0 : d.n), to = Math.max(n, d.n < 0 ? d.ws.length : d.n);
      for (let i = from; i < to; i++) d.ws[i].classList.toggle('on', i < n);
      d.n = n;
    });
  }

  /* ---------- Параллакс кинокадра (только на компьютере) ---------- */
  const para = reduced || !fine ? [] : $$('[data-parallax]').map(img => ({ img, top: 0, h: 0 }));
  measurers.push(() => para.forEach(d => {
    const r = d.img.parentElement.getBoundingClientRect();
    d.top = r.top + scrollY;
    d.h = r.height;
  }));
  function parallax(y) {
    const vh = metrics.vh;
    para.forEach(d => {
      const top = d.top - y;
      if (top + d.h < 0 || top > vh) return;
      const p = (top + d.h / 2 - vh / 2) / vh;
      d.img.style.transform = `translate3d(0, ${(p * -8).toFixed(2)}%, 0)`;
    });
  }

  /* ---------- «Магнитные» кнопки ---------- */
  if (fine && !reduced) {
    $$('.magnetic').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
      });
      btn.addEventListener('mouseleave', () => (btn.style.transform = ''));
      btn.style.transition = 'background .4s, color .4s, border-color .4s, transform .5s cubic-bezier(.16,1,.3,1)';
    });
  }

  /* ---------- Бегущая строка: дублируем для бесшовности ---------- */
  const row = $('.marquee__row');
  row.innerHTML += row.innerHTML;

  /* ---------- Форма ---------- */
  const form = $('#form');
  const phone = form.elements.phone;

  /* ---------- Калькулятор-квиз: 4 шага, прогресс-погружение, живая сводка ---------- */
  const steps = $$('.quiz__step', form);
  const quizNum = $('#quizNum');
  const quizBar = $('#quizBar');
  const quizDepth = $('#quizDepth');
  const summary = $('#quizSummary');
  const lenRange = $('#lenRange');
  const lenInput = $('#lenInput');
  const lenVal = $('#lenVal');
  const ship = $('.ship-meter__ship', form);
  const lenLabels = lenRange.dataset.labels.split('|');
  let stepIdx = 0;
  form.classList.add('is-js');
  // формат выбирает сам посетитель — без предвыбора
  $$('input[name="format"]', form).forEach(r => (r.checked = false));

  function goStep(i, back = false) {
    stepIdx = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach((st, k) => {
      st.classList.toggle('is-active', k === stepIdx);
      st.classList.toggle('is-back', back && k === stepIdx);
    });
    quizNum.textContent = stepIdx + 1;
    quizBar.style.transform = `scaleX(${(stepIdx + 1) / steps.length})`;
    quizDepth.textContent = '— ' + T.quiz.depth[stepIdx] + ' ' + T.unit;
    // на телефоне держим начало формы в поле зрения
    const top = form.getBoundingClientRect().top;
    if (top < 0) form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  function renderSummary() {
    const parts = [];
    if (+lenRange.value > 0) parts.push(lenInput.value);
    if (form.elements.vessel.value.trim()) parts.push(form.elements.vessel.value.trim());
    const port = $('input[name="port"]:checked', form);
    if (port) parts.push(port.value);
    const fmt = $('input[name="format"]:checked', form);
    if (fmt) parts.push(fmt.value);
    summary.replaceChildren(...parts.map(t => Object.assign(document.createElement('span'), { textContent: t })));
  }

  function updateLength() {
    const v = +lenRange.value;
    lenVal.textContent = lenLabels[v];
    lenInput.value = lenLabels[v];
    lenRange.setAttribute('aria-valuetext', lenLabels[v]);
    lenRange.style.setProperty('--fill', (v / 5) * 100 + '%');
    // кораблик растёт вместе с длиной судна
    ship.style.setProperty('--w', (v === 0 ? 34 : 30 + v * 13) + '%');
    renderSummary();
  }
  lenRange.addEventListener('input', updateLength);
  form.elements.vessel.addEventListener('input', renderSummary);
  // выбор порта или формата — и сразу следующий шаг
  $$('input[name="port"], input[name="format"]', form).forEach(r => r.addEventListener('change', () => {
    renderSummary();
    const at = stepIdx;
    setTimeout(() => { if (stepIdx === at) goStep(at + 1); }, 380);
  }));
  $$('.quiz__next', form).forEach(b => b.addEventListener('click', () => goStep(stepIdx + 1)));
  $$('.quiz__back', form).forEach(b => b.addEventListener('click', () => goStep(stepIdx - 1, true)));
  updateLength();
  goStep(0);

  // кнопки «Заказать …» на сайте подставляют формат в калькулятор
  $$('[data-format]').forEach(a => a.addEventListener('click', () => {
    const f = a.dataset.format;
    const radio = [...form.elements.format].find(r => r.value === f);
    if (radio) radio.checked = true;
    else if (!form.elements.comment.value) form.elements.comment.value = f;
    renderSummary();
  }));

  const digits = () => phone.value.replace(/\D/g, '').length;
  const agree = form.elements.agree;
  const agreeLabel = $('#agreeLabel');
  agree.addEventListener('change', () => agreeLabel.classList.remove('is-error'));

  // маска телефона +7 (XXX) XXX-XX-XX — только в русской версии;
  // в английской номер может быть иностранным, поэтому вводится свободно
  phone.addEventListener('input', () => {
    phone.classList.remove('is-error');
    if (EN) return;
    let d = phone.value.replace(/\D/g, '');
    if (!d) { phone.value = ''; return; }
    if (phone.value.trim().startsWith('+') && !phone.value.trim().startsWith('+7')) return; // иностранный номер
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let out = '+7';
    if (p[0]) out += ' (' + p[0];
    if (p[0].length === 3) out += ')';
    if (p[1]) out += ' ' + p[1];
    if (p[2]) out += '-' + p[2];
    if (p[3]) out += '-' + p[3];
    phone.value = out;
  });

  // время открытия страницы — сервер отсекает ботов, заполняющих форму мгновенно
  const startedAt = Date.now();
  const submitBtn = form.querySelector('[type=submit]');
  const okBox = $('#formOk');
  const MSG = EN ? {
    sending: 'Sending…',
    sent: ['Thank you! Your request has been sent.', 'We will call you back during business hours (Moscow time).'],
    mail: ['Your request is ready.', 'Your e-mail app will open with a pre-filled message — just press “Send”.'],
    rate: 'Too many requests. Please call us: '
  } : {
    sending: 'Отправляем…',
    sent: ['Спасибо! Заявка отправлена.', 'Перезвоним в рабочее время и предложим формат осмотра.'],
    mail: ['Заявка сформирована.', 'Откроется почтовая программа с готовым письмом — нажмите «Отправить».'],
    rate: 'Слишком много заявок подряд. Позвоните нам: '
  };
  const showOk = ([title, text], tail = '') => {
    okBox.innerHTML = `<b>${title}</b><p>${text}${tail}</p>`;
    okBox.hidden = false;
    okBox.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
  };
  const callTail = ' <a href="tel:+79113124949">+7 (911) 312-49-49</a>.';

  // запасной путь: если сервер заявок недоступен, письмо формируется в почтовой программе
  function sendByMail() {
    const f = form.elements;
    const L = T.labels;
    const body = [
      T.mailTitle,
      '',
      L[0] + ': ' + (f.name.value || '—'),
      L[1] + ': ' + f.phone.value,
      L[2] + ': ' + (f.company.value || '—'),
      L[3] + ': ' + (f.vessel.value || '—'),
      L[4] + ': ' + f.length.value,
      L[5] + ': ' + f.port.value,
      L[6] + ': ' + f.format.value,
      L[7] + ': ' + (f.comment.value || '—')
    ].join('\n');
    showOk(MSG.mail, (EN ? ' If it doesn\'t open, call us:' : ' Если не открылась, позвоните:') + callTail);
    location.href = 'mailto:flotservicecompany@mail.ru?subject=' +
      encodeURIComponent(T.mailSubject) + '&body=' + encodeURIComponent(body);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const isRuMasked = !EN && phone.value.startsWith('+7');
    if (isRuMasked ? digits() < 11 : digits() < 7) {
      phone.classList.add('is-error');
      phone.focus();
      return;
    }
    if (!agree.checked) {
      agreeLabel.classList.add('is-error');
      agree.focus();
      return;
    }
    const data = new FormData(form);
    data.set('agree', '1');
    data.set('lang', EN ? 'en' : 'ru');
    data.set('started', String(startedAt));

    const label = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = MSG.sending;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch('/send.php', { method: 'POST', body: data, signal: ctrl.signal });
      clearTimeout(timer);
      const json = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
      if (json && json.ok) {
        showOk(MSG.sent);
        form.reset();
        $$('input[name="format"]', form).forEach(r => (r.checked = false));
        updateLength();
        $$('.field input, .field textarea', form).forEach(i => i.classList.remove('is-error'));
      } else if (json && json.error === 'rate') {
        showOk([MSG.rate.trim(), ''], callTail.trim());
      } else {
        sendByMail(); // нет сервера (например, статический хостинг) или ошибка на нём
      }
    } catch (err) {
      sendByMail();
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = label;
    }
  });

  $('#year').textContent = new Date().getFullYear();
  syncDepthTags();
  measure();
  onScroll();
})();
