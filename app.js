'use strict';
(() => {
  /* ---------- Sozlamalar ---------- */
  const CFG = {
    owner: 'azimaslamov',
    repo: 'Appstore',
    file: 'apps.json',
    adminHash: '#boshqaruv-panel',
    tokenKey: 'appstore_gh_token',
    cacheKey: 'appstore_repos_cache',
    cacheMin: 10,          // GitHub API javobi necha daqiqa keshlanadi
    excludeForks: true     // fork qilingan omborlar avtomatik ro‘yxatga chiqmasin
  };
  const CATS = { oyinlar: 'O‘yinlar', ilovalar: 'Ilovalar', foydali: 'Foydali', talim: 'Ta’lim', ijtimoiy: 'Ijtimoiy', musiqa: 'Musiqa va audio', foto: 'Fotografiya', ish: 'Ish va unumdorlik', dizayn: 'San’at va dizayn', obhavo: 'Ob-havo' };
  const EMOJI = { oyinlar: '🎮', ilovalar: '📱', foydali: '🧰', talim: '🎓', ijtimoiy: '👥', musiqa: '🎵', foto: '📷', ish: '📋', dizayn: '🎨', obhavo: '⛅' };

  /* ---------- Yordamchilar ---------- */
  const A = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/[ʻʼ‘’'`]/g, '');
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : '');
  const imgUrl = u => (/^(https?:\/\/|data:image\/)/i.test(u || '') ? u : '');
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (s || ''); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const toB64 = str => { let bin = ''; new TextEncoder().encode(str).forEach(b => { bin += String.fromCharCode(b); }); return btoa(bin); };
  const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));

  let toastTimer;
  function toast(msg) {
    const t = A('toast');
    t.textContent = msg;
    try { t.hidePopover(); } catch (_) {}
    try { t.showPopover(); } catch (_) {}
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { try { t.hidePopover(); } catch (_) {} }, 300);
    }, 3400);
  }

  function letterIcon(title) {
    let h = 0;
    for (const c of String(title)) h = (h * 31 + c.charCodeAt(0)) % 360;
    const l = esc((String(title).trim()[0] || '?').toUpperCase());
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h} 70% 55%)'/><stop offset='1' stop-color='hsl(${(h + 50) % 360} 70% 38%)'/></linearGradient></defs><rect width='100' height='100' fill='url(#g)'/><text x='50' y='67' font-size='54' font-weight='700' text-anchor='middle' fill='white' font-family='sans-serif'>${l}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  const iconOf = a => a.iconUrl || letterIcon(a.title);
  const repoLink = a => `https://github.com/${CFG.owner}/${a.repoName}`;

  // Rasm yuklanmasa — harfli ikonkaga almashtirish
  document.addEventListener('error', e => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.classList.contains('icon') && !img.dataset.fb) {
      img.dataset.fb = '1';
      img.src = letterIcon(img.dataset.title || '?');
    }
  }, true);

  /* ---------- Ma’lumotlar ---------- */
  const state = { local: [], remote: [], q: '', view: 'games', chip: 'all', sub: '' };

  const cleanApp = a => ({
    id: a.id || slug(a.repoName || a.title),
    repoName: a.repoName || '',
    title: a.title || a.repoName || 'Nomsiz',
    category: CATS[a.category] ? a.category : 'ilovalar',
    shortDesc: a.shortDesc || '',
    fullDesc: a.fullDesc || a.shortDesc || '',
    iconUrl: a.iconUrl || '',
    screenshots: Array.isArray(a.screenshots) ? a.screenshots : [],
    liveUrl: a.liveUrl || '',
    version: a.version || '',
    updated: a.updated || '',
    installSelf: !!a.installSelf
  });
  const parseApps = d => (Array.isArray(d) ? d : (d && d.apps) || []).map(cleanApp);

  async function loadLocal() {
    try {
      const r = await fetch('apps.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return parseApps(await r.json());
    } catch (e) {
      console.warn('apps.json:', e);
      return [];
    }
  }

  function repoToApp(r) {
    const name = r.name;
    const isUserSite = name.toLowerCase() === `${CFG.owner}.github.io`;
    const pages = isUserSite ? `https://${CFG.owner}.github.io/` : `https://${CFG.owner}.github.io/${name}/`;
    const desc = r.description || 'Tavsif hali qo‘shilmagan.';
    return {
      id: 'gh-' + slug(name),
      repoName: name,
      title: name.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase()),
      category: 'ilovalar',
      shortDesc: desc,
      fullDesc: desc,
      iconUrl: r.has_pages ? pages + 'icon.png' : '',
      screenshots: [],
      liveUrl: safeUrl(r.homepage) || (r.has_pages ? pages : r.html_url),
      version: '',
      updated: r.pushed_at || '',
      installSelf: false,
      auto: true
    };
  }

  async function loadRemote() {
    try {
      const c = JSON.parse(localStorage.getItem(CFG.cacheKey) || 'null');
      if (c && Date.now() - c.t < CFG.cacheMin * 60000) return c.data;
    } catch (_) {}
    try {
      const r = await fetch(`https://api.github.com/users/${CFG.owner}/repos?per_page=100&sort=pushed`,
        { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(r.status);
      const data = (await r.json())
        .filter(x => !x.private && !x.archived && !(CFG.excludeForks && x.fork) && x.name.toLowerCase() !== CFG.repo.toLowerCase())
        .map(repoToApp);
      try { localStorage.setItem(CFG.cacheKey, JSON.stringify({ t: Date.now(), data })); } catch (_) {}
      return data;
    } catch (e) {
      console.warn('GitHub API:', e);
      try { const c = JSON.parse(localStorage.getItem(CFG.cacheKey) || 'null'); if (c) return c.data; } catch (_) {}
      return [];
    }
  }

  // apps.json ustun; GitHub’dagi qolgan omborlar ro‘yxat oxirida
  function merged() {
    const have = new Set(state.local.map(a => norm(a.repoName)));
    return [...state.local, ...state.remote.filter(a => !have.has(norm(a.repoName)))];
  }
  const byId = id => merged().find(a => a.id === id);

  /* ---------- Vitrina (Play uslubi) ---------- */
  const view = A('view');
  const I = {
    back: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
    search: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>'
  };
  const hue = t => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const meta = a => [CATS[a.category], a.version && 'v' + a.version].filter(Boolean).join(' • ');
  const byNew = (x, y) => String(y.updated).localeCompare(String(x.updated));
  const group = v => merged().filter(a => (v === 'games') === (a.category === 'oyinlar'));
  const iconImg = (a, cls = 'icon') => `<img class="${cls}" src="${esc(iconOf(a))}" data-title="${esc(a.title)}" alt="" loading="lazy">`;

  const row = (a, compact) => `<article class="row${compact ? ' compact' : ''}" data-id="${esc(a.id)}">
    <button class="row-main" type="button" data-act="detail" aria-label="${esc(a.title)} haqida batafsil">
      ${iconImg(a)}
      <span class="txt"><strong>${esc(a.title)}</strong><span class="sub">${esc(meta(a))}</span>${compact ? '' : `<span class="desc">${esc(a.shortDesc)}</span>`}</span>
    </button>
    <div class="rb">
      <button class="pill tonal" type="button" data-act="open">Ochish</button>
      <button class="pill fill" type="button" data-act="install">Yuklash</button>
    </div>
  </article>`;

  function homeHTML(v) {
    let list = group(v);
    const cats = [...new Set(list.map(a => a.category))];
    if (!cats.includes(state.chip)) state.chip = 'all';
    const chips = cats.length > 1
      ? `<nav class="chips" aria-label="Kategoriyalar">${['all', ...cats].map(k => `<button type="button" data-chip="${k}" aria-pressed="${state.chip === k}">${k === 'all' ? 'Barchasi' : esc(CATS[k])}</button>`).join('')}</nav>` : '';
    if (state.chip !== 'all') list = list.filter(a => a.category === state.chip);
    if (!list.length) return chips + '<p class="empty">Bu bo‘limda hozircha loyiha yo‘q.</p>';
    const fresh = [...list].sort(byNew);
    const f = list.find(a => imgUrl((a.screenshots || [])[0])) || list[0];
    const img = imgUrl((f.screenshots || [])[0]);
    const rail = fresh.slice(0, 8).map(a => `<div class="tile" data-id="${esc(a.id)}">
      <button class="tile-btn" type="button" data-act="detail" aria-label="${esc(a.title)} haqida batafsil">${iconImg(a)}<strong>${esc(a.title)}</strong><span class="sub">${esc(CATS[a.category])}</span></button></div>`).join('');
    return `${chips}
      <h2 class="sec-h">Tavsiya etiladi</h2><div class="rail">${rail}</div>
      <section class="banner" data-id="${esc(f.id)}"><button class="banner-btn${img ? ' has-img' : ''}" type="button" data-act="detail" style="--h:${hue(f.title)};${img ? `--img:url('${esc(img)}')` : ''}"><span class="tag">Diqqat markazida</span><b>${esc(f.title)}</b><span class="s">${esc(f.shortDesc)}</span></button></section>
      ${row(f, true)}
      <h2 class="sec-h">Barcha loyihalar</h2>${list.map(a => row(a)).join('')}`;
  }

  function searchHTML() {
    const q = norm(state.q).trim(), sub = state.sub;
    if (q || sub) {
      const res = merged().filter(a => (!sub || a.category === sub) && (!q || norm(`${a.title} ${a.shortDesc} ${a.fullDesc}`).includes(q)));
      return `<h2 class="sec-h">${sub ? esc(CATS[sub]) : 'Natijalar'}</h2>` +
        (res.length ? res.map(a => row(a)).join('') : '<p class="empty">Hech narsa topilmadi. Boshqa so‘z bilan qidirib ko‘ring.</p>');
    }
    const top = [...merged()].sort(byNew).slice(0, 3).map(a => row(a)).join('');
    const tiles = Object.entries(CATS).map(([k, v]) => `<button class="cat-tile" type="button" data-sub="${k}"><span>${esc(v)}</span><i aria-hidden="true">${EMOJI[k] || '📦'}</i></button>`).join('');
    return `${top}<h2 class="sec-h">Katalogni ochish</h2><div class="cats">${tiles}</div>`;
  }

  function renderView() {
    const s = state.view === 'search';
    A('home-bar').hidden = s;
    A('search-bar').hidden = !s;
    document.querySelectorAll('.bnav button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === state.view ? 'page' : 'false'));
    const back = !!(state.q || state.sub);
    A('s-icon').innerHTML = back ? I.back : I.search;
    A('s-icon').setAttribute('aria-label', back ? 'Orqaga' : 'Qidiruv');
    view.innerHTML = s ? searchHTML() : homeHTML(state.view);
  }
  const renderGrid = renderView;

  document.querySelector('.bnav').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    if (state.view !== b.dataset.tab) {
      state.view = b.dataset.tab; state.chip = 'all'; state.sub = ''; state.q = ''; A('q').value = '';
      window.scrollTo(0, 0);
    }
    renderView();
  });
  A('btn-search').addEventListener('click', () => { state.view = 'search'; renderView(); A('q').focus(); });
  A('q').addEventListener('input', e => { state.q = e.target.value; renderView(); });
  A('s-icon').addEventListener('click', () => {
    if (state.q || state.sub) { state.q = ''; state.sub = ''; A('q').value = ''; renderView(); } else A('q').focus();
  });
  view.addEventListener('click', e => {
    const c = e.target.closest('[data-chip]');
    if (c) { state.chip = c.dataset.chip; renderView(); return; }
    const s = e.target.closest('[data-sub]');
    if (s) { state.sub = s.dataset.sub; renderView(); window.scrollTo(0, 0); }
  });

  /* ---------- Harakatlar: ochish, batafsil, o‘rnatish ---------- */
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { deferred = null; toast('Ilova o‘rnatildi'); });

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]');
    if (c) { c.closest('dialog').close(); return; }
    if (e.target.tagName === 'DIALOG' && e.target.classList.contains('sheet')) { e.target.close(); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const host = b.closest('[data-id]');
    const a = host && byId(host.dataset.id);
    if (!a) return;
    if (b.dataset.act === 'detail') showDetail(a);
    else if (b.dataset.act === 'open') openLive(a);
    else if (b.dataset.act === 'install') install(a);
  });

  function openLive(a) {
    const url = safeUrl(a.liveUrl);
    if (!url) return toast('Bu ilova uchun havola topilmadi');
    window.open(url, '_blank', 'noopener');
  }

  async function install(a) {
    if (a.installSelf) {
      if (isStandalone()) return toast('Appstore allaqachon o‘rnatilgan');
      if (deferred) {
        const p = deferred;
        deferred = null;
        p.prompt();
        const { outcome } = await p.userChoice;
        return toast(outcome === 'accepted' ? 'O‘rnatilmoqda…' : 'O‘rnatish bekor qilindi');
      }
    }
    showHowTo(a);
  }

  function showDetail(a) {
    const shots = (a.screenshots || []).map(imgUrl).filter(Boolean);
    const paras = String(a.fullDesc || '').split(/\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
    const meta = [
      ['Versiya', a.version && esc(a.version)],
      ['Yangilangan', a.updated && esc(fmtDate(a.updated))],
      ['Kategoriya', esc(CATS[a.category])],
      ['Ombor', a.repoName && `<a href="${esc(repoLink(a))}" target="_blank" rel="noopener">${esc(CFG.owner)}/${esc(a.repoName)}</a>`]
    ].filter(r => r[1]).map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('');
    A('detail-body').innerHTML = `<div class="pad" data-id="${esc(a.id)}">
      <div class="d-head">
        <img class="icon lg" src="${esc(iconOf(a))}" data-title="${esc(a.title)}" alt="" width="92" height="92">
        <div><h2>${esc(a.title)}</h2><p class="cat">${esc(CATS[a.category])}</p></div>
      </div>
      <div class="acts">
        <button class="btn btn-ghost" type="button" data-act="open">Ochish</button>
        <button class="btn btn-primary" type="button" data-act="install">Yuklash</button>
      </div>
      ${shots.length ? `<div class="shots" tabindex="0" aria-label="Skrinshotlar">${shots.map((s, i) => `<img src="${esc(s)}" alt="${esc(a.title)} lavhasi ${i + 1}" loading="lazy">`).join('')}</div>` : ''}
      <div class="d-desc">${paras || '<p>Tavsif yo‘q.</p>'}</div>
      <dl class="meta">${meta}</dl>
    </div>`;
    const d = A('detail');
    if (!d.open) d.showModal();
    d.scrollTop = 0;
  }

  const STEPS_IOS = [
    'Ilovani <b>Safari</b> brauzerida oching.',
    'Pastdagi <b>Ulashish</b> tugmasini (yuqoriga strelkali kvadrat) bosing.',
    'Ro‘yxatdan <b>“Ekranga qo‘shish”</b> (Add to Home Screen) ni tanlang.',
    '<b>“Qo‘shish”</b> tugmasini bosing.'
  ];
  const STEPS_ANDROID = [
    'Ilovani <b>Chrome</b> brauzerida oching.',
    'Yuqori o‘ngdagi <b>⋮</b> menyusini bosing.',
    '<b>“Ilovani o‘rnatish”</b> yoki <b>“Bosh ekranga qo‘shish”</b> ni tanlang.',
    'Tasdiqlang — ikonka telefoningiz ekranida paydo bo‘ladi.'
  ];

  function showHowTo(a) {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /android/i.test(ua);
    const list = (title, steps) => `<h3>${title}</h3><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
    let body = '';
    if (ios) body = list('iPhone / iPad (Safari)', STEPS_IOS);
    else if (android) body = list('Android (Chrome)', STEPS_ANDROID);
    else body = list('iPhone / iPad (Safari)', STEPS_IOS) + list('Android (Chrome)', STEPS_ANDROID);
    const intro = a.installSelf
      ? 'Brauzeringiz avtomatik o‘rnatish oynasini ko‘rsata olmadi. Ilovani ekranga quyidagicha qo‘shing:'
      : 'Bu ilova alohida sayt. Avval uni oching, so‘ng o‘sha sahifada quyidagilarni bajaring:';
    A('howto-body').innerHTML = `<div class="pad howto" data-id="${esc(a.id)}">
      <h2>“${esc(a.title)}” ni ekranga qo‘shish</h2>
      <p>${intro}</p>
      ${body}
      <div class="acts">
        <button class="btn btn-primary" type="button" data-act="open">Ilovani ochish</button>
        <button class="btn btn-ghost" type="button" data-close>Yopish</button>
      </div>
    </div>`;
    const d = A('howto');
    if (!d.open) d.showModal();
  }

  /* ---------- Admin panel ---------- */
  const adminDlg = A('admin');
  const form = A('a-form');
  let draft = [];
  let editing = null;   // null | '__new__' | mavjud id
  let dirty = false;

  const getToken = () => localStorage.getItem(CFG.tokenKey) || '';
  const contentsUrl = () => `https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents/${CFG.file}`;
  const ghHeaders = t => ({ Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });

  function setDirty(v) {
    dirty = v;
    A('a-dirty').textContent = v ? 'Saqlanmagan o‘zgarishlar bor' : '';
  }
  function tokenState() {
    A('a-token-state').textContent = getToken() ? 'Token saqlangan ✓' : 'Token kiritilmagan.';
  }

  async function loadDraft() {
    const t = getToken();
    if (t) {
      try {
        const r = await fetch(contentsUrl(), { headers: ghHeaders(t), cache: 'no-store' });
        if (r.ok) return parseApps(JSON.parse(fromB64((await r.json()).content)));
      } catch (e) { console.warn(e); }
    }
    return clone(state.local);
  }

  async function openAdmin() {
    if (adminDlg.open) return;
    adminDlg.showModal();
    tokenState();
    editing = null;
    form.hidden = true;
    setDirty(false);
    draft = clone(state.local);
    renderAdmin();
    draft = await loadDraft();
    renderAdmin();
  }

  adminDlg.addEventListener('close', () => {
    if (location.hash === CFG.adminHash) history.replaceState(null, '', location.pathname + location.search);
  });
  const route = () => {
    if (location.hash === CFG.adminHash) openAdmin();
    else if (adminDlg.open) adminDlg.close();
  };
  window.addEventListener('hashchange', route);

  function renderAdmin() {
    A('a-count').textContent = `(${draft.length})`;
    A('a-list').innerHTML = draft.length ? draft.map(a => `<li>
      <img class="icon sm" src="${esc(iconOf(a))}" data-title="${esc(a.title)}" alt="">
      <span class="who"><b>${esc(a.title)}</b><small>${esc(a.repoName)} · ${esc(CATS[a.category])}</small></span>
      <button type="button" data-edit="${esc(a.id)}">Tahrirlash</button>
      <button type="button" class="danger" data-del="${esc(a.id)}">O‘chirish</button>
    </li>`).join('') : '<li><span class="hint">Hozircha ilova yo‘q.</span></li>';
    const have = new Set(draft.map(a => norm(a.repoName)));
    const fresh = state.remote.filter(a => !have.has(norm(a.repoName)));
    A('a-repos-sec').hidden = !fresh.length;
    A('a-repos').innerHTML = fresh.map(a => `<li>
      <span class="who"><b>${esc(a.title)}</b><small>${esc(a.repoName)}</small></span>
      <button type="button" data-add="${esc(a.repoName)}">Qo‘shish</button>
    </li>`).join('');
  }

  function fillForm(a, isNew) {
    A('a-form-title').textContent = isNew ? 'Yangi ilova' : 'Ilovani tahrirlash';
    A('f-title').value = a.title || '';
    A('f-repo').value = a.repoName || '';
    A('f-cat').value = a.category || 'ilovalar';
    A('f-short').value = a.shortDesc || '';
    A('f-full').value = a.fullDesc || '';
    A('f-icon').value = a.iconUrl || '';
    A('f-shots').value = (a.screenshots || []).join('\n');
    A('f-live').value = a.liveUrl || '';
    A('f-version').value = a.version || '';
    A('f-updated').value = /^\d{4}-\d{2}-\d{2}/.test(a.updated || '') ? a.updated.slice(0, 10) : '';
    A('f-self').checked = !!a.installSelf;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  A('f-cat').innerHTML = Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  A('a-new').addEventListener('click', () => { editing = '__new__'; fillForm({}, true); });
  A('a-cancel').addEventListener('click', () => { editing = null; form.hidden = true; });

  adminDlg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.edit) {
      const a = draft.find(x => x.id === b.dataset.edit);
      if (a) { editing = a.id; fillForm(a, false); }
    } else if (b.dataset.del) {
      const a = draft.find(x => x.id === b.dataset.del);
      if (a && confirm(`“${a.title}” o‘chirilsinmi?`)) {
        draft = draft.filter(x => x.id !== a.id);
        if (editing === a.id) { editing = null; form.hidden = true; }
        setDirty(true);
        renderAdmin();
      }
    } else if (b.dataset.add) {
      const r = state.remote.find(x => x.repoName === b.dataset.add);
      if (r) { editing = '__new__'; fillForm(cleanApp(r), true); }
    }
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = id => A(id).value.trim();
    const isNew = editing === '__new__';
    const obj = cleanApp({
      id: isNew ? '' : editing,
      title: v('f-title'),
      repoName: v('f-repo'),
      category: A('f-cat').value,
      shortDesc: v('f-short'),
      fullDesc: v('f-full'),
      iconUrl: v('f-icon'),
      screenshots: v('f-shots').split(/\n+/).map(s => s.trim()).filter(Boolean),
      liveUrl: v('f-live'),
      version: v('f-version'),
      updated: A('f-updated').value,
      installSelf: A('f-self').checked
    });
    if (!v('f-title') || !obj.repoName) return toast('Nomi va ombor nomi majburiy');
    if (obj.iconUrl && !/^(https?:\/\/|\.?\/?[\w\-./]+)/i.test(obj.iconUrl)) return toast('Ikonka URL noto‘g‘ri');
    if (obj.liveUrl && !safeUrl(obj.liveUrl)) return toast('Jonli havola https:// bilan boshlanishi kerak');
    if (!obj.liveUrl) obj.liveUrl = `https://${CFG.owner}.github.io/${obj.repoName}/`;
    if (!obj.updated) obj.updated = today();
    if (isNew) {
      const base = slug(obj.repoName) || 'ilova';
      let id = base, n = 2;
      while (draft.some(a => a.id === id)) id = `${base}-${n++}`;
      obj.id = id;
    }
    const i = draft.findIndex(a => a.id === obj.id);
    if (i >= 0) draft[i] = obj; else draft.push(obj);
    editing = null;
    form.hidden = true;
    setDirty(true);
    renderAdmin();
    toast('Ro‘yxatga qo‘shildi. Endi “GitHub’da saqlash” ni bosing.');
  });

  A('a-token-save').addEventListener('click', () => {
    const t = A('a-token').value.trim();
    if (!t) return toast('Avval tokenni kiriting');
    localStorage.setItem(CFG.tokenKey, t);
    A('a-token').value = '';
    tokenState();
    toast('Token saqlandi');
  });
  A('a-token-clear').addEventListener('click', () => {
    localStorage.removeItem(CFG.tokenKey);
    A('a-token').value = '';
    tokenState();
    toast('Token o‘chirildi');
  });

  const GH_ERRORS = {
    401: 'Token noto‘g‘ri yoki muddati tugagan.',
    403: 'Ruxsat yo‘q yoki so‘rovlar limiti tugadi. Tokenda “Contents: Read and write” ruxsati bo‘lishi kerak.',
    404: 'Ombor yoki fayl topilmadi. Token Appstore omboriga ruxsat berganini tekshiring.',
    409: 'Fayl shu orada o‘zgargan. Panelni qayta oching va yana urinib ko‘ring.',
    422: 'GitHub so‘rovni qabul qilmadi. Panelni qayta ochib, yana urinib ko‘ring.'
  };

  async function saveToGitHub() {
    const t = getToken();
    if (!t) return toast('Avval GitHub tokenini kiriting va saqlang');
    const btn = A('a-save');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saqlanmoqda…';
    try {
      const cur = await fetch(contentsUrl(), { headers: ghHeaders(t), cache: 'no-store' });
      let sha;
      if (cur.ok) sha = (await cur.json()).sha;
      else if (cur.status !== 404) throw { status: cur.status };
      const res = await fetch(contentsUrl(), {
        method: 'PUT',
        headers: { ...ghHeaders(t), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `apps.json yangilandi (${today()})`,
          content: toB64(JSON.stringify(draft, null, 2) + '\n'),
          sha
        })
      });
      if (!res.ok) throw { status: res.status };
      state.local = clone(draft);
      renderGrid();
      renderAdmin();
      setDirty(false);
      toast('GitHub’da saqlandi. Sayt 1–2 daqiqada yangilanadi.');
    } catch (err) {
      toast(GH_ERRORS[err && err.status] || 'Saqlab bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
  A('a-save').addEventListener('click', saveToGitHub);

  A('a-copy').addEventListener('click', async () => {
    const txt = JSON.stringify(draft, null, 2) + '\n';
    try {
      await navigator.clipboard.writeText(txt);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('JSON nusxalandi');
  });

  /* ---------- Ishga tushirish ---------- */
  async function init() {
    const remotePromise = loadRemote();
    state.local = await loadLocal();
    renderGrid();
    route();
    state.remote = await remotePromise;
    renderGrid();
    if (adminDlg.open) renderAdmin();
  }
  init();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e)));
  }
})();
