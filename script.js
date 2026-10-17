(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const MAX_DEPTH = 300;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const pad = n => String(n).padStart(3, '0');

  /* ---------- Прелоадер: «погружение» 000 → 300 м ---------- */
  const loader = $('#loader');
  const loaderDepth = $('#loaderDepth');
  const loaderBar = $('#loaderBar');
  document.body.classList.add('is-loading');

  function finishLoading() {
    loader.classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    setTimeout(() => loader.remove(), 1200);
  }

  let seen = false;
  try { seen = sessionStorage.getItem('fs-intro') === '1'; sessionStorage.setItem('fs-intro', '1'); } catch (e) {}
  if (reduced || seen) {
    loader.style.display = 'none';
    requestAnimationFrame(finishLoading);
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
      if (p < 1 || (!loaded && now - t0 < 3500)) requestAnimationFrame(tick);
      else setTimeout(finishLoading, 200);
    })(t0);
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
      tag.textContent = '— ' + Math.round((y / max) * MAX_DEPTH) + ' м';
    });
  }

  let lastY = 0;
  let ticking = false;
  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

    header.classList.toggle('is-scrolled', y > 20);
    // прячем шапку при прокрутке вниз, показываем при прокрутке вверх
    const menuOpen = nav.classList.contains('is-open');
    header.classList.toggle('is-hidden', !menuOpen && y > innerHeight && y > lastY + 4);
    if (y < lastY - 4) header.classList.remove('is-hidden');
    lastY = y;

    depthEls.forEach(el => (el.textContent = pad(Math.round(p * MAX_DEPTH))));
    fill.style.height = p * 100 + '%';
    const pastHero = y > hero.offsetHeight * 0.6;
    gauge.classList.toggle('is-on', pastHero);
    mbar.classList.toggle('is-on', pastHero);

    const mid = y + innerHeight * 0.4;
    let current = zones[0];
    for (const z of zones) if (z.offsetTop <= mid) current = z;
    zoneLabel.textContent = current.dataset.zone;
    $$('.nav > a').forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + current.id));

    words();
    parallax();
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });
  addEventListener('resize', () => { syncDepthTags(); onScroll(); });
  addEventListener('load', () => { syncDepthTags(); onScroll(); });

  /* ---------- Мобильное меню ---------- */
  const burger = $('#burger');
  const setMenu = open => {
    nav.classList.toggle('is-open', open);
    if (open) header.classList.remove('is-hidden');
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
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
  const HOTS = [
    ['01 · Камера', 'Камера высокого разрешения', 'Цветная камера на поворотном механизме: оператор наклоняет её и рассматривает корпус под нужным углом.'],
    ['02 · Свет', 'Светодиодные прожекторы', 'Собственное освещение даёт чёткую картинку даже на глубине, под днищем и в мутной воде.'],
    ['03 · Движение', 'Электрические движители', 'Пять движителей позволяют точно маневрировать вдоль борта и удерживать позицию у нужного участка.'],
    ['04 · Корпус', 'Плавучесть и защитная рама', 'Лёгкий аппарат длиной около метра: быстро спускается с борта и работает на глубине до 300 м.']
  ];
  const tip = $('#droneTip');
  $$('.hot').forEach(h => h.addEventListener('click', () => {
    const [m, t, d] = HOTS[h.dataset.hot];
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
  if (navigator.connection && navigator.connection.saveData) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }

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
  function words() {
    wordBlocks.forEach(block => {
      const r = block.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      const ws = $$('.w', block);
      const n = Math.round(p * ws.length);
      ws.forEach((w, i) => w.classList.toggle('on', i < n));
    });
  }

  /* ---------- Параллакс кинокадра ---------- */
  const para = $$('[data-parallax]');
  function parallax() {
    if (reduced) return;
    para.forEach(img => {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      img.style.transform = `translate3d(0, ${p * -8}%, 0)`;
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

  // маска телефона +7 (XXX) XXX-XX-XX
  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
    if (!d) { phone.value = ''; return; }
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
    phone.classList.remove('is-error');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (phone.value.replace(/\D/g, '').length < 11) {
      phone.classList.add('is-error');
      phone.focus();
      return;
    }
    const f = form.elements;
    const body = [
      'Заявка с сайта ФлотСервис',
      '',
      'Имя: ' + (f.name.value || '—'),
      'Телефон: ' + f.phone.value,
      'Компания: ' + (f.company.value || '—'),
      'Судно: ' + (f.vessel.value || '—'),
      'Длина судна: ' + f.length.value,
      'Порт: ' + f.port.value,
      'Формат: ' + f.format.value,
      'Комментарий: ' + (f.comment.value || '—')
    ].join('\n');
    $('#formOk').hidden = false;
    location.href = 'mailto:flotservicecompany@mail.ru?subject=' +
      encodeURIComponent('Заявка на осмотр судна') + '&body=' + encodeURIComponent(body);
  });

  $('#year').textContent = new Date().getFullYear();
  syncDepthTags();
  onScroll();
})();
