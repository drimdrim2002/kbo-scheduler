/*
 * alt-d 브리프 스프레드 — 핵심: 앱 생성(가상 위반 주입), 화면 상태, 주소(hash) 라우팅, 렌더 예약,
 * 위임 이벤트, 토스트·대화상자, 목업 엔진 실행, 스크롤 점검 표시.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const { Score, Dates, CalendarGen, Reschedule } = KBO;
  const UI = KBO.UI;
  const SP = window.SP = { chapters: {}, views: {}, modals: {}, act: {}, keys: {} };

  // ───────────── 포맷·HTML 헬퍼 ─────────────
  const esc = UI.esc;
  SP.esc = esc;
  const WD = Dates.WEEKDAY_KO;
  SP.fmt = {
    date: (d) => Dates.fmtDate(d),                // 5/20(화)
    md: (d) => { const n = typeof d === 'number' ? d : Dates.dayNum(d); const iso = Dates.isoDate(n); return Number(iso.slice(5, 7)) + '/' + Number(iso.slice(8, 10)); },
    km: (v) => UI.fmt.km(v),
    int: (v) => UI.fmt.int(v),
    num1: (v) => UI.fmt.num1(v),
    signed: (v, f) => UI.fmt.signed(v, f),
    score: (s) => Score.scoreString(s),
    time: (ms) => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); },
    clock: (iso) => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  };
  const fmt = SP.fmt;
  SP.wd = (n) => WD[Dates.weekday(n)];

  /** 상태 표시: 아이콘 + 글자 (색만으로 구분하지 않음) */
  const ST = {
    done: { icon: '✔', text: '완료', cls: 'ok' },
    pass: { icon: '✔', text: '통과', cls: 'ok' },
    ok: { icon: '✔', text: '정상', cls: 'ok' },
    warn: { icon: '⚠', text: '확인 필요', cls: 'warn' },
    block: { icon: '⛔', text: '차단', cls: 'bad' },
    bad: { icon: '✖', text: '위반', cls: 'bad' },
    draft: { icon: '○', text: '작성 중', cls: 'muted' },
    info: { icon: 'ℹ', text: '안내', cls: 'info' }
  };
  SP.ST = ST;
  SP.chip = (kind, text) => { const s = ST[kind] || ST.info; return '<span class="sp-chip sp-chip-' + s.cls + '"><span aria-hidden="true">' + s.icon + '</span> ' + esc(text == null ? s.text : text) + '</span>'; };
  SP.icon = (kind) => { const s = ST[kind] || ST.info; return '<span class="sp-ic sp-ic-' + s.cls + '" aria-hidden="true">' + s.icon + '</span>'; };
  SP.mock = (label) => '<span class="sp-mock" title="이 기능은 시안에서 목업입니다">' + esc(label || '목업') + '</span>';
  SP.virtual = () => '<span class="sp-virtual" title="화면 시안용으로 넣은 가상 위반입니다">가상</span>';
  SP.team = (name, extra) => { const t = SP.app.team(name); const c = t ? t.color : '#555'; return '<span class="sp-team ' + (extra || '') + '"><i style="background:' + c + '" aria-hidden="true"></i>' + esc(name) + '</span>'; };
  SP.btn = (act, label, opts) => {
    const o = opts || {};
    return '<button type="button" class="sp-btn' + (o.kind ? ' sp-btn-' + o.kind : '') + (o.cls ? ' ' + o.cls : '') + '" data-act="' + act + '"' + (o.arg != null ? ' data-arg="' + esc(o.arg) + '"' : '') + (o.disabled ? ' disabled' : '') + (o.title ? ' title="' + esc(o.title) + '"' : '') + (o.pressed != null ? ' aria-pressed="' + !!o.pressed + '"' : '') + '>' + label + '</button>';
  };
  SP.cap = (no, title, note) => '<div class="sp-cap"><span class="sp-cap-no">' + esc(no) + '</span><span class="sp-cap-t">' + esc(title) + '</span>' + (note ? '<span class="sp-cap-note">' + note + '</span>' : '') + '</div>';

  // ───────────── 가상 위반 3건 (실제 채점기가 찾아낸다) ─────────────
  // 2025 initialPlan(Hard 0)에서: ① 시리즈 88(5/20 LG·롯데) 홈/원정 뒤집기 → 잠실 중복(H0-b),
  // ② 시리즈 71(5/9 한화·키움) 홈/원정 뒤집기 → 한화 홈 4연속(H0-f), ③ 6/3·6/6 슬롯(21↔…) 교환 대신 22↔25 슬롯 내용 교환 → LG·NC 인접 대진(H1).
  const SEED = [
    { code: 'H0-b', slot: 17, how: '5/20(화) 롯데 @ LG 시리즈의 홈·원정을 뒤집어 두산·LG가 함께 잠실 홈' },
    { code: 'H0-f', slot: 16, how: '5/9(금) 키움 @ 한화 시리즈의 홈·원정을 뒤집어 한화 홈 4연속' },
    { code: 'H1', slot: 22, how: '6/6(금)과 6/17(화) 슬롯의 시리즈 묶음을 맞바꿔 LG·NC가 인접 슬롯에서 연속' }
  ];
  SP.SEED = SEED;
  SP.isVirtual = (v) => SEED.some((s) => s.code === v.code && s.slot === v.slot);
  SP.seedInfo = (v) => SEED.find((s) => s.code === v.code && s.slot === v.slot);

  function applySeed(p) {
    const flip = (m) => { const x = p.matches[m]; const t = x.home; x.home = x.away; x.away = t; };
    flip(88); flip(71);
    const a = 22, b = 25;
    for (const e of p.plan) { if (e.calendar === a) e.calendar = b; else if (e.calendar === b) e.calendar = a; }
  }

  /** 시즌 운영 데모용 경기 기록: 기준일 8/14 이전은 완료, 8/12~8/13은 결과 미입력, 취소 3경기 */
  function seedGames(p) {
    p.settings.referenceDate = '2025-08-14';
    const games = Reschedule.computeGames(p);
    const cancel = { '2025-05-14': [0, 'RAIN'], '2025-06-19': [2, 'RAIN'], '2025-07-27': [1, 'HEAT'] };
    const byDate = {};
    for (const g of games) (byDate[g.date] = byDate[g.date] || []).push(g);
    p.games = [];
    for (const g of games) {
      if (g.date >= '2025-08-12') continue;
      const c = cancel[g.date];
      if (c && byDate[g.date][c[0]] === g) p.games.push({ match: g.match, date: g.date, status: 'CANCELLED', reason: c[1] });
      else p.games.push({ match: g.match, date: g.date, status: 'PLAYED' });
    }
  }

  const origBuild = KBO.Preset.buildProject;
  let cleanPlan = null;
  KBO.Preset.buildProject = function () {
    const p = origBuild();
    cleanPlan = JSON.parse(JSON.stringify(p.plan));
    const cleanMatches = JSON.parse(JSON.stringify(p.matches));
    applySeed(p);
    seedGames(p);
    const t0 = new Date('2026-10-18T09:12:00');
    p.meta.name = '2025 정규시즌 1차안';
    p.meta.features = KBO.Features.defaults();
    p.meta.spread = {
      confirmed: { 1: true, 2: true },
      lastRun: { at: '2026-10-18T09:12:00', elapsedMs: 60000, improvements: 214, reason: 'TIME_LIMIT' },
      lastImport: { at: '2026-10-18T08:40:00', source: '2025_KBO_시즌데이터.xlsx', sheets: 6 },
      slotNotes: {}, seriesNotes: {}
    };
    p.meta.spread.slotNotes[0] = '개막 2연전';
    p.meta.spread.slotNotes[13] = '어린이날 3연전';
    p.meta.spread.slotNotes[32] = '올스타 직후 4연전';
    p.meta.spread.seriesNotes[0] = '개막전 고정';
    p.snapshots = [
      { id: 's-clean', name: '원본 initialPlan (가상 위반 주입 전)', createdAt: '2026-10-18T08:55:00', plan: cleanPlan, pins: cleanMatches.map((m) => !!m.pinned), reschedulePlan: [], matchCount: p.matches.length, slotCount: p.calendar.length, score: '[0/0]hard/[0/-400/-573307/-13/-72955]soft', feasible: true, note: '홈·원정 뒤집기 2건은 시리즈 데이터 변경이라 복원되지 않음' },
      { id: 's-run1', name: '엔진 1차 결과', createdAt: t0.toISOString(), plan: JSON.parse(JSON.stringify(p.plan)), pins: p.matches.map((m) => !!m.pinned), reschedulePlan: [], matchCount: p.matches.length, slotCount: p.calendar.length, score: '', feasible: false }
    ];
    SP.seedPlan = JSON.parse(JSON.stringify(p.plan));
    return p;
  };

  // ───────────── 앱 ─────────────
  const app = new KBO.App({ appId: 'alt-d', appName: '브리프 스프레드' });
  SP.app = app;
  window.app = app;
  if (!SP.seedPlan) { const p = KBO.Preset.buildProject(); SP.seedPlan = p.plan; }
  KBO.Preset.buildProject = origBuild;
  app.feature = (id) => KBO.Features.isOn(app.state, id);
  // 사전 점검에 이 시안이 더하는 항목: 가져오기 경고 확인, H0-e 모드 차이 (경고)
  const origPf = app.preflight.bind(app);
  app.preflight = function () {
    const r = origPf();
    if (r._sp) return r;
    r._sp = true;
    const sp = app.state.meta.spread || {};
    if (!sp.importAck) r.items.push({ id: 'import-warn', status: 'warn', title: '가져오기 경고 확인', detail: '마지막 가져오기의 경고 3건(슬롯 22행 휴일가중치 자동 채움, 14~15행 정렬, 모르는 열 \'비고2\')을 아직 확인하지 않았습니다.', target: 'slots', ack: true });
    if (app.state.settings.h0eMode !== 'ENGINE') r.items.push({ id: 'h0e-mode', status: 'warn', title: 'H0-e 채점 모드', detail: '구장 기준(D3)으로 채점합니다. Java 엔진(엔진 호환 모드)과 어린이날 감점이 다를 수 있습니다.', target: 'settings' });
    const c = { block: 0, warn: 0, pass: 0 };
    for (const it of r.items) c[it.status]++;
    r.counts = c; r.ok = c.block === 0;
    return r;
  };
  SP.on = app.feature;
  SP.meta = () => { const m = app.state.meta; if (!m.spread) m.spread = { confirmed: {}, slotNotes: {}, seriesNotes: {} }; return m.spread; };

  // dom.js 토스트·대화상자를 이 후보의 모양으로 바꾼다
  UI.toast = function (message, kind, ms) { SP.toast(message, kind, ms); };
  UI.dialog = function (opts) { return SP.dialog(opts); };
  UI.confirmBox = function (title, message, okLabel) { return SP.confirm(title, '<p>' + esc(message) + '</p>', okLabel); };

  // ───────────── 화면 상태 ─────────────
  SP.ui = {
    view: 'wizard', step: 1,
    tab: { 1: 'slots', 2: 'check', 3: 'calendar', 4: 'metrics', ops: 'games' },
    month: 5, sel: null, team: null, schedTeam: 'LG', row: { slots: 3, series: 11, season: null, events: null, teams: null },
    edit: null, modal: null, menu: null, sort: { key: 'distance', dir: -1 }, chartTeam: null,
    opsDate: '2025-08-13', demo: null, flash: null, checkFilter: 'all'
  };
  const ui = SP.ui;

  // ───────────── 주소(hash) ─────────────
  function parseHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const o = {};
    for (const [k, v] of h) o[k] = v;
    return o;
  }
  SP.applyRoute = function (r) {
    if (r.view === 'ops') ui.view = 'ops'; else ui.view = 'wizard';
    if (r.step) ui.step = Math.max(1, Math.min(4, Number(r.step) || 1));
    if (r.tab) { if (ui.view === 'ops') ui.tab.ops = r.tab; else ui.tab[ui.step] = r.tab; }
    if (r.month) ui.month = Number(r.month) || ui.month;
    if (r.team) ui.schedTeam = r.team;
    if (r.filter) app.ui.teamFilter = new Set(r.filter.split(',').filter(Boolean));
    if (r.sel != null) ui.sel = Number(r.sel);
    if (r.date) ui.opsDate = r.date;
    ui.modal = r.modal || null;
    ui.demo = r.demo || null;
  };
  SP.routeString = function () {
    const p = new URLSearchParams();
    if (ui.view === 'ops') { p.set('view', 'ops'); p.set('tab', ui.tab.ops); }
    else { p.set('step', ui.step); p.set('tab', ui.tab[ui.step]); if (ui.step === 3) p.set('month', ui.month); }
    if (ui.modal) p.set('modal', ui.modal);
    return '#' + p.toString();
  };
  SP.syncHash = function () {
    const s = SP.routeString();
    if (location.hash !== s) { try { history.replaceState(null, '', location.pathname + location.search + s); } catch (e) { /* file:// 일부 환경 */ } }
  };
  window.addEventListener('hashchange', () => { SP.applyRoute(parseHash()); SP.render(); });
  SP.parseHash = parseHash;

  // ───────────── 이동 ─────────────
  SP.go = function (step, tab, opts) {
    ui.view = 'wizard';
    ui.step = step;
    if (tab) ui.tab[step] = tab;
    ui.edit = null; ui.menu = null;
    if (!(opts && opts.keepModal)) ui.modal = null;
    SP.render();
    const main = document.getElementById('sp-main');
    if (main && !(opts && opts.noFocus)) main.focus({ preventScroll: true });
  };
  SP.goOps = function (tab) { ui.view = 'ops'; if (tab) ui.tab.ops = tab; ui.menu = null; ui.modal = null; SP.render(); };
  SP.openModal = function (name) { ui.modal = name; ui.menu = null; SP.render(); };
  SP.closeModal = function () { ui.modal = null; SP.render(); };
  SP.flash = function (key) { ui.flash = key; setTimeout(() => { if (ui.flash === key) { ui.flash = null; const el = document.querySelector('.sp-flash'); if (el) el.classList.remove('sp-flash'); } }, 1600); };

  // 사전 점검 링크·위반 클릭 → 해당 단계·탭·행 (app.nav)
  app.setNavigator((target) => {
    const map = { teams: [1, 'teams'], distance: [1, 'teams'], season: [1, 'season'], slots: [1, 'slots'], series: [1, 'series'], events: [1, 'events'], review: [2, 'check'], result: [3, 'calendar'], settings: null };
    if (target === 'settings') { SP.openModal('settings'); return; }
    const m = map[target];
    if (m) { SP.go(m[0], m[1]); SP.flash('tab-' + m[1]); }
  });

  // ───────────── 확정(장 → 요약 카드) ─────────────
  SP.isConfirmed = (n) => !!(SP.meta().confirmed || {})[n];
  SP.setConfirmed = function (n, v) {
    app.store.commit(v ? '장 확정' : '장 다시 열기', (s) => {
      s.meta.spread = s.meta.spread || {};
      s.meta.spread.confirmed = Object.assign({}, s.meta.spread.confirmed, { [n]: !!v });
    }, { undo: false, tags: ['spread'] });
  };
  /** 장 상태: confirmed가 아니면 status()가 결정. 차단이면 확정해도 차단 */
  SP.chapterState = function (n) {
    const ch = SP.chapters[n];
    const s = ch.status();
    if (s.kind === 'block') return s;
    if (SP.isConfirmed(n)) return { kind: 'done', text: '완료', short: s.short };
    return s;
  };

  // ───────────── 렌더 예약 ─────────────
  let raf = 0;
  SP.render = function () {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; SP.renderNow(); });
  };
  SP.renderers = [];
  function keepScroll(fn) {
    const saved = {};
    document.querySelectorAll('[data-sk]').forEach((el) => { saved[el.dataset.sk] = [el.scrollTop, el.scrollLeft]; });
    const ae = document.activeElement;
    const fkey = ae && ae.dataset ? (ae.dataset.fk || (ae.dataset.act ? ae.dataset.act + '|' + (ae.dataset.arg || '') : null)) : null;
    fn();
    document.querySelectorAll('[data-sk]').forEach((el) => { const v = saved[el.dataset.sk]; if (v) { el.scrollTop = v[0]; el.scrollLeft = v[1]; } });
    if (fkey && (!document.activeElement || document.activeElement === document.body)) {
      const sel = Array.from(document.querySelectorAll('[data-fk],[data-act]')).find((el) => (el.dataset.fk || (el.dataset.act + '|' + (el.dataset.arg || ''))) === fkey);
      if (sel) sel.focus({ preventScroll: true });
    }
  }
  SP.renderNow = function () {
    keepScroll(() => { for (const r of SP.renderers) { try { r(); } catch (e) { console.error(e); } } });
    SP.syncHash();
    document.querySelectorAll('[data-scroll-into]').forEach((el) => { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); el.removeAttribute('data-scroll-into'); });
    if (SP.afterRender) SP.afterRender.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    SP.checkScroll();
  };
  SP.afterRender = [];

  let pend = null;
  app.subscribe((ch) => {
    if (ch && ch.tags && ch.tags.has('persist')) return;
    if (ch && ch.tags && ch.tags.has('live')) { if (pend) return; pend = setTimeout(() => { pend = null; SP.render(); }, 200); return; }
    SP.render();
  });

  // ───────────── 위임 이벤트 ─────────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) {
      if (ui.menu && !e.target.closest('.sp-pop')) { ui.menu = null; SP.render(); }
      return;
    }
    if (el.disabled) return;
    const fn = SP.act[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    if (ui.menu && !el.closest('.sp-pop') && el.dataset.act !== 'menu') ui.menu = null;
    fn(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-chg]');
    if (!el) return;
    const fn = SP.act[el.dataset.chg];
    if (fn) fn(el, e);
  });
  document.addEventListener('toggle', (e) => {
    const el = e.target;
    if (el && el.dataset && el.dataset.chg && SP.act[el.dataset.chg]) SP.act[el.dataset.chg](el, e);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ui.edit) { ui.edit = null; SP.render(); return; }
      if (ui.menu) { ui.menu = null; SP.render(); return; }
      if (ui.modal) { SP.closeModal(); return; }
    }
    for (const k of Object.keys(SP.keys)) { if (SP.keys[k](e)) return; }
  });

  SP.act.menu = (el) => { ui.menu = ui.menu === el.dataset.arg ? null : el.dataset.arg; SP.render(); };
  SP.act.go = (el) => { const [s, t] = String(el.dataset.arg).split(':'); SP.go(Number(s), t || null); };
  SP.act.tab = (el) => { if (ui.view === 'ops') ui.tab.ops = el.dataset.arg; else ui.tab[ui.step] = el.dataset.arg; ui.edit = null; SP.render(); };
  SP.act.ops = (el) => SP.goOps(el.dataset.arg || null);
  SP.act.wizard = () => SP.go(ui.step);
  SP.act.modal = (el) => SP.openModal(el.dataset.arg);
  SP.act.closeModal = () => SP.closeModal();
  SP.act.undo = () => app.undo();
  SP.act.redo = () => app.redo();
  SP.act.nav = (el) => app.nav(el.dataset.arg);
  SP.act.confirm = (el) => { const n = Number(el.dataset.arg); SP.setConfirmed(n, !SP.isConfirmed(n)); if (!SP.isConfirmed(n)) return; SP.toast('제' + n + '장을 확정했습니다. 요약 카드가 위 띠에 쌓였습니다.', 'ok'); };
  SP.act.reopen = (el) => { const n = Number(el.dataset.arg); SP.setConfirmed(n, false); SP.go(n); };
  SP.act.mockToast = (el) => SP.toast((el.dataset.arg || '이 기능') + ' — 시안에서는 목업입니다.', 'info');

  // ───────────── 토스트·대화상자 ─────────────
  SP.toast = function (message, kind, ms) {
    const host = document.getElementById('sp-toasts');
    if (!host) return;
    const el = document.createElement('div');
    const k = kind || 'info';
    el.className = 'sp-toast sp-toast-' + k;
    const icon = { ok: '✔', bad: '✖', warn: '⚠', info: 'ℹ' }[k] || 'ℹ';
    el.innerHTML = '<span aria-hidden="true">' + icon + '</span> ' + esc(message);
    host.appendChild(el);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => { el.classList.add('sp-out'); setTimeout(() => el.remove(), 300); }, ms || 3400);
  };
  /** 간단한 확인 대화상자 (Promise<boolean>) */
  SP.confirm = function (title, bodyHtml, okLabel, kind) {
    return SP.dialog({ title, body: bodyHtml, actions: [{ label: '취소', value: false }, { label: okLabel || '확인', value: true, kind: kind || 'primary' }] }).then((v) => !!v);
  };
  SP.dialog = function (opts) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = 'sp-dialog';
      const actions = opts.actions || [{ label: '확인', value: true, kind: 'primary' }];
      d.innerHTML = '<form method="dialog"><h2 class="sp-dialog-t">' + esc(opts.title || '') + '</h2><div class="sp-dialog-b">' + (opts.body || '') + '</div><div class="sp-dialog-a">' +
        actions.map((a, i) => '<button class="sp-btn' + (a.kind ? ' sp-btn-' + a.kind : '') + '" value="' + i + '">' + esc(a.label) + '</button>').join('') + '</div></form>';
      document.body.appendChild(d);
      d.addEventListener('close', () => {
        const i = d.returnValue === '' ? -1 : Number(d.returnValue);
        const act = actions[i];
        d.remove();
        resolve(act ? (typeof act.value === 'function' ? act.value(d) : act.value) : null);
      });
      d.showModal();
    });
  };

  // ───────────── 파생 값 ─────────────
  SP.ex = () => app.derived().ex;
  SP.virtualCount = () => SP.ex().violations.filter(SP.isVirtual).length;
  SP.hardCount = () => SP.ex().violations.length;
  SP.slotLabel = (s) => { const sl = app.derived().slots[s]; return sl ? sl.label : '?'; };
  SP.slotRange = (s) => { const sl = app.derived().slots[s]; if (!sl) return '?'; return fmt.date(sl.day) + (sl.consecutive > 1 ? '~' + fmt.md(sl.day + sl.consecutive - 1) : ''); };

  // ───────────── 목업 엔진 실행 (FR-R3·R4·V1) ─────────────
  // 실제 Mock 솔버를 돌리면 시안용 배정이 바뀌므로, 화면 흐름만 재현한다: 진행률 · 점수 추이 · 입력 잠금 → ③으로 이동.
  const RUN_MS = 6400;
  function curve(k) {
    // k: 0..1 진행. Hard는 −46 → −3, Soft(S2)는 −2,950,000 → −1,749,360
    const e = 1 - Math.pow(1 - k, 2.6);
    const hard = Math.round(-46 + 43 * e);
    const soft = Math.round(-2950000 + (2950000 - 1749360) * e);
    return { hard, soft };
  }
  SP.makeHistory = function (upto) {
    const h = [];
    const n = Math.max(2, Math.round(upto * 48));
    for (let i = 0; i <= n; i++) { const k = (i / 48); const c = curve(Math.min(1, k)); h.push({ t: k * 60000, hard: c.hard, soft: c.soft }); }
    return h;
  };
  SP.run = null;
  let runTimer = null;
  SP.startRun = function (opts) {
    if (SP.run && (SP.run.status === 'RUNNING' || SP.run.status === 'PAUSED')) return;
    const pf = app.preflight();
    if (!pf.ok) { SP.toast('사전 점검에 차단 항목이 있어 실행할 수 없습니다.', 'bad'); return; }
    const hold = opts && opts.hold;
    const k0 = hold ? 0.56 : 0;
    SP.run = { status: 'RUNNING', progress: k0, startedAt: Date.now() - k0 * RUN_MS, history: SP.makeHistory(k0), improvements: Math.round(214 * k0), hold: !!hold };
    app.run = { status: 'RUNNING', mode: 'INITIAL', history: [], handle: { pause() {}, resume() {}, stop() {} } };
    ui.tab[2] = 'run';
    if (!hold) runTimer = setInterval(tick, 250);
    SP.render();
  };
  function tick() {
    const r = SP.run;
    if (!r || r.status !== 'RUNNING') return;
    r.progress = Math.min(1, r.progress + 250 / RUN_MS);
    r.history = SP.makeHistory(r.progress);
    r.improvements = Math.round(214 * r.progress);
    if (r.progress >= 1) finishRun('TIME_LIMIT');
    else SP.render();
  }
  function finishRun(reason) {
    clearInterval(runTimer); runTimer = null;
    const r = SP.run;
    r.status = 'DONE'; r.reason = reason;
    app.run = null;
    const seed = SP.seedPlan;
    const st = app.state;
    app.store.commit('엔진 결과 (목업)', (s) => {
      if (seed && s.matches.length === seed.length && s.calendar.length === 45) {
        // 핀 고정 시리즈는 그 자리에 둔다 (FR-M5, AC-7)
        const keep = new Map(s.plan.filter((p) => s.matches[p.match] && s.matches[p.match].pinned).map((p) => [p.match, p.calendar]));
        s.plan = seed.map((p) => ({ match: p.match, calendar: keep.has(p.match) ? keep.get(p.match) : p.calendar }));
      }
      s.meta.spread = s.meta.spread || {};
      s.meta.spread.lastRun = { at: new Date().toISOString(), elapsedMs: Math.round(r.progress * 60000), improvements: r.improvements, reason };
      s.meta.spread.confirmed = Object.assign({}, s.meta.spread.confirmed, { 2: true, 3: false });
    }, { tags: ['plan'] });
    void st;
    SP.toast('엔진 종료 (' + (reason === 'STOPPED' ? '사용자 중지' : '최대 실행 시간 도달') + ') — 결과·수정으로 이동합니다.', SP.ex().feasible ? 'ok' : 'warn', 4200);
    SP.go(3, 'calendar');
  }
  SP.act.runStart = () => SP.startRun();
  SP.act.runPause = () => { const r = SP.run; if (!r) return; if (r.status === 'RUNNING') { r.status = 'PAUSED'; app.run.status = 'PAUSED'; } else if (r.status === 'PAUSED') { r.status = 'RUNNING'; app.run.status = 'RUNNING'; if (!runTimer && !r.hold) runTimer = setInterval(tick, 250); if (r.hold) { r.hold = false; runTimer = setInterval(tick, 250); } } SP.render(); };
  SP.act.runStop = () => { if (SP.run && (SP.run.status === 'RUNNING' || SP.run.status === 'PAUSED')) finishRun('STOPPED'); };
  SP.isRunning = () => !!(SP.run && (SP.run.status === 'RUNNING' || SP.run.status === 'PAUSED'));

  // ───────────── 스크롤 점검 (?debug=scroll, ?check=1) ─────────────
  SP.checkScroll = function () {
    const de = document.documentElement;
    const vw = window.innerWidth, vh = window.innerHeight;
    const root = document.getElementById('sp-root');
    const foot = document.getElementById('sp-foot');
    const margin = document.getElementById('sp-margin');
    const res = {
      vw, vh,
      docH: de.scrollHeight, docW: de.scrollWidth,
      pageScroll: de.scrollHeight > vh || de.scrollWidth > vw || document.body.scrollHeight > vh || document.body.scrollWidth > vw,
      rootOverflow: root ? (root.scrollHeight > root.clientHeight + 1 || root.scrollWidth > root.clientWidth + 1) : true,
      footBottom: foot ? Math.round(foot.getBoundingClientRect().bottom) : -1,
      marginBottom: margin ? Math.round(margin.getBoundingClientRect().bottom) : -1
    };
    const mainEl = document.getElementById('sp-main');
    const mb = document.querySelector('.sp-margin-body');
    res.mainOverflow = mainEl ? mainEl.scrollHeight > mainEl.clientHeight + 1 : true;
    res.marginOverflow = margin ? margin.scrollHeight > margin.clientHeight + 1 : true;
    const last = mainEl && mainEl.lastElementChild;
    const footTop = foot ? foot.getBoundingClientRect().top : vh;
    res.mainLastBottom = last ? Math.round(last.getBoundingClientRect().bottom) : -1;
    res.overlapFoot = res.mainLastBottom > footTop + 0.5;
    void mb;
    res.clipped = res.footBottom > vh || res.marginBottom > vh || res.mainOverflow || res.marginOverflow || res.overlapFoot;
    const layerModal = document.querySelector('.sp-modal');
    if (layerModal) { const r = layerModal.getBoundingClientRect(); res.modalBottom = Math.round(r.bottom); res.clipped = res.clipped || r.bottom > vh || r.right > vw; }
    res.ok = !res.pageScroll && !res.rootOverflow && !res.clipped;
    res.errors = (window.__spErrors || []).length;
    SP.lastCheck = res;
    if (de.classList.contains('sp-debug-scroll')) {
      let el = document.getElementById('sp-debug');
      if (!el) { el = document.createElement('div'); el.id = 'sp-debug'; document.body.appendChild(el); }
      el.className = res.ok ? 'sp-debug-ok' : 'sp-debug-bad';
      el.textContent = (res.ok ? '✔ 페이지 스크롤 0' : '✖ 페이지 스크롤/잘림') + ' · ' + vw + '×' + vh + ' · 문서 ' + res.docW + '×' + res.docH + (res.errors ? ' · 오류 ' + res.errors : '');
    }
    return res;
  };
  window.addEventListener('resize', () => SP.render());
})();
