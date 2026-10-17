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
      ['01 · Camera', 'High-definition camera', 'Colour camera on a tilt mechanism: the pilot angles it to examine the hull from any side.'],
      ['02 · Lights', 'LED floodlights', 'On-board lighting gives a clear picture at depth, under the bottom and in murky water.'],
      ['03 · Thrusters', 'Electric thrusters', 'Five thrusters let the pilot manoeuvre precisely along the hull and hold position at any spot.'],
      ['04 · Frame', 'Buoyancy and protective frame', 'About one metre long: launched quickly from deck, rated to 300 m depth.']
    ],
    mailSubject: 'Hull inspection request / Заявка на осмотр судна',
    mailTitle: 'Request from the FlotService website (English version)',
    labels: ['Name / Имя', 'Phone / Телефон', 'Company / Компания', 'Vessel / Судно', 'Vessel length / Длина', 'Port / Порт', 'Service / Формат', 'Comment / Комментарий']
  } : {
    unit: 'м',
    menuOpen: 'Открыть меню', menuClose: 'Закрыть меню',
    hots: [
      ['01 · Камера', 'Камера высокого разрешения', 'Цветная камера на поворотном механизме: оператор наклоняет её и рассматривает корпус под нужным углом.'],
      ['02 · Свет', 'Светодиодные прожекторы', 'Собственное освещение даёт чёткую картинку даже на глубине, под днищем и в мутной воде.'],
      ['03 · Движение', 'Электрические движители', 'Пять движителей позволяют точно маневрировать вдоль борта и удерживать позицию у нужного участка.'],
      ['04 · Корпус', 'Плавучесть и защитная рама', 'Лёгкий аппарат длиной около метра: быстро спускается с борта и работает на глубине до 300 м.']
    ],
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
  const fill = $('#gaugeFill');
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

  const state = { depth: -1, zone: -1, scrolled: null, hidden: false, pastHero: null };
  let lastY = scrollY;
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = scrollY;
    const { vh, max, heroH, zoneTops } = metrics;
    const p = Math.min(1, Math.max(0, y / max));

    const scrolled = y > 20;
    if (scrolled !== state.scrolled) { state.scrolled = scrolled; header.classList.toggle('is-scrolled', scrolled); }
    // прячем шапку при прокрутке вниз, показываем при прокрутке вверх
    let hidden = state.hidden;
    if (y > lastY + 4 && y > vh && !nav.classList.contains('is-open')) hidden = true;
    else if (y < lastY - 4 || y <= vh) hidden = false;
    if (hidden !== state.hidden) { state.hidden = hidden; header.classList.toggle('is-hidden', hidden); }
    lastY = y;

    const depth = Math.round(p * MAX_DEPTH);
    if (depth !== state.depth) {
      state.depth = depth;
      const txt = pad(depth);
      depthEls.forEach(el => (el.textContent = txt));
      fill.style.height = p * 100 + '%';
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
    if (open) header.classList.remove('is-hidden');
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
  const tip = $('#droneTip');
  $$('.hot').forEach(h => h.addEventListener('click', () => {
    const [m, t, d] = T.hots[h.dataset.hot];
    $$('.hot').forEach(x => x.classList.toggle('is-active', x === h));
    tip.innerHTML = `<span class="mono">${m}</span><b>${t}</b><span>${d}</span>`;
  }));

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
  const revealTargets = $$('.shead, .switch, .who, .row, .drone, .falcon__text, .task, .quote, .player, .promise, .individual, .port, .major, .logos, .acc, .form, .contact__l, .manifest__sign, .sizes, .footer__in');
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

  // кнопки «Заказать …» подставляют формат
  $$('[data-format]').forEach(a => a.addEventListener('click', () => {
    const f = a.dataset.format;
    const radio = [...form.elements.format].find(r => r.value === f);
    if (radio) radio.checked = true;
    else if (!form.elements.comment.value) form.elements.comment.value = f;
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

  form.addEventListener('submit', e => {
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
    $('#formOk').hidden = false;
    location.href = 'mailto:flotservicecompany@mail.ru?subject=' +
      encodeURIComponent(T.mailSubject) + '&body=' + encodeURIComponent(body);
  });

  $('#year').textContent = new Date().getFullYear();
  syncDepthTags();
  measure();
  onScroll();
})();
