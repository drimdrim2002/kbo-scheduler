/*
 * alt-a 편성 스튜디오 — 골격: 상단 띠, 단계 스테퍼, 이전/다음, 메뉴, 오버레이, 렌더 루프, 이벤트 위임.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon } = S;
  const { Score } = KBO;

  const STEP_META = {
    1: { name: '데이터 준비', task: '시즌 데이터를 가져오고 한 건씩 고친다.' },
    2: { name: '검토·실행', task: '사전 점검을 통과시키고 엔진을 돌린다.' },
    3: { name: '결과·수정', task: '위반을 없애고 일정을 다듬는다.' },
    4: { name: '품질·배포', task: '공정성을 확인하고 배포본을 만든다.' }
  };
  S.STEP_META = STEP_META;
  const CIRCLED = ['', '①', '②', '③', '④'];
  const KICON = { ok: 'check', warn: 'warn', block: 'block', todo: 'todo' };
  S.CIRCLED = CIRCLED;

  // ───────── 단계 상태 ─────────
  S.stepStatus = function (n) {
    const app = S.app, st = app.state, c = app.derived();
    if (n === 1) {
      const errs = S.draftErrors ? S.draftErrors() : 0;
      const sum = st.calendar.length + ' 슬롯 · ' + st.matches.length + ' 시리즈 · 이벤트 ' + st.events.length;
      if (errs) return { kind: 'warn', text: '셀 오류 ' + errs, summary: sum, next: '셀 오류 ' + errs };
      return { kind: 'ok', text: '완료', summary: sum, next: '입력 완료' };
    }
    if (n === 2) {
      const pf = app.preflight();
      const k = pf.counts;
      if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) {
        return { kind: 'todo', text: S.run.status === 'PAUSED' ? '일시정지' : '실행 중', summary: '엔진 ' + (S.run.status === 'PAUSED' ? '일시정지' : '실행 중') + ' · ' + S.fmt.time(S.run.elapsed) + ' · 개선 ' + S.run.improvements + '회', next: '실행 중' };
      }
      const sum = '통과 ' + k.pass + ' · 경고 ' + k.warn + ' · 차단 ' + k.block + (S.lastRun ? ' · 실행 ' + S.lastRun.count + '회' : ' · 실행 1회');
      if (k.block) return { kind: 'block', text: '차단 ' + k.block, summary: sum, next: '차단 ' + k.block };
      if (k.warn) return { kind: 'warn', text: '경고 ' + k.warn, summary: sum, next: '경고 ' + k.warn };
      return { kind: 'ok', text: '통과', summary: sum, next: '점검 통과' };
    }
    if (n === 3) {
      const ex = c.ex;
      const cnt = ex.violations.length;
      const sum = 'Hard 위반 ' + cnt + '건 · 미배정 ' + c.pool.length + ' · 고정 ' + st.matches.filter((m) => m.pinned).length;
      if (cnt) return { kind: 'block', text: '위반 ' + cnt, summary: sum, next: 'Hard 위반 ' + cnt };
      if (c.pool.length) return { kind: 'warn', text: '미배정 ' + c.pool.length, summary: sum, next: '미배정 ' + c.pool.length };
      return { kind: 'ok', text: '편성 가능', summary: sum, next: '편성 가능' };
    }
    const tm = c.ex.teamMetrics;
    const over = tm.filter((t) => t.overDistance).length;
    const sum = '거리 허용오차 초과 ' + over + '구단 · ' + (S.ui.exported ? '배포본 생성됨' : '배포본 미생성');
    if (S.ui.exported) return { kind: 'ok', text: '완료', summary: sum, next: '완료' };
    return { kind: 'todo', text: '작성 중', summary: sum, next: '작성 중' };
  };

  // ───────── 상단 띠 ─────────
  function renderTop() {
    const app = S.app, ex = app.derived().ex;
    const n = ex.violations.length;
    const mode = app.state.settings.h0eMode === 'ENGINE' ? '엔진 호환' : '구장 기준';
    const badge = ex.feasible
      ? '<span class="badge ok" role="status">' + icon('check') + '편성 가능</span>'
      : '<span class="badge bad" role="status">' + icon('x') + 'Hard 위반 ' + n + '건</span>';
    const r = S.run;
    let eng;
    if (r && r.status === 'RUNNING') eng = '<span class="eng run"><span class="dot"></span><b>실행 중</b> ' + S.fmt.time(r.elapsed) + '</span><span class="lock-pill">' + icon('lock') + '입력 잠김</span>';
    else if (r && r.status === 'PAUSED') eng = '<span class="eng pause"><span class="dot"></span><b>일시정지</b> ' + S.fmt.time(r.elapsed) + '</span><span class="lock-pill">' + icon('lock') + '입력 잠김</span>';
    else eng = '<span class="eng"><span class="dot"></span>엔진 <b>대기</b> · ' + (app.engineConfig.kind === 'REST' ? 'REST' : 'Mock') + '</span>';
    return '' +
      '<div class="brand"><span class="brand-mark" aria-hidden="true">KBO</span><span class="brand-name">KBO 일정 편성 · 2025</span><span class="brand-sub">편성 스튜디오</span></div>' +
      '<span class="tb-sep"></span>' +
      '<div class="tb-group">' + badge +
        '<button class="chip-mode" data-act="open-settings" data-set="scoring" title="H0-e 홈 의무 판정 모드 — 설정에서 바꿉니다">H0-e ' + esc(mode) + '</button>' +
        '<span class="badge-score" title="BendableLongScore">' + esc(S.fmt.score(ex.score)) + '</span>' +
      '</div>' +
      '<span class="tb-sep"></span>' +
      '<div class="tb-group">' + eng + '</div>' +
      '<div class="tb-right">' +
        '<button class="tb-btn' + (S.ui.menu === 'data' ? ' on' : '') + '" data-act="menu" data-menu="data" aria-haspopup="menu">' + icon('db') + '데이터' + icon('down') + '</button>' +
        '<button class="tb-btn' + (S.ui.ops ? ' on' : '') + '" data-act="open-ops">' + icon('ops') + '시즌 운영</button>' +
        '<button class="tb-btn' + (S.ui.drawer === 'settings' ? ' on' : '') + '" data-act="open-settings">' + icon('gear') + '설정</button>' +
      '</div>';
  }

  // ───────── 스테퍼 ─────────
  function renderStepper() {
    let s = '';
    const locked = S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED');
    for (let n = 1; n <= 4; n++) {
      const st = S.stepStatus(n);
      const active = S.ui.step === n;
      s += '<button class="step' + (active ? ' active' : '') + '" data-act="go-step" data-step="' + n + '"' + (active ? ' aria-current="step"' : '') + '>' +
        '<span class="step-no">' + n + '</span>' +
        '<span class="step-name">' + STEP_META[n].name + (locked && n === 1 ? '<span class="step-lock">' + icon('lock') + '잠김</span>' : '') + '</span>' +
        S.stat(st.kind, st.text) +
        '<span class="step-sum" title="' + esc(st.summary) + '">' + esc(st.summary) + '</span>' +
        '</button>';
    }
    return s;
  }

  // ───────── 하단 ─────────
  function renderFooter() {
    if (S.ui.ops) {
      return '<button class="btn" data-act="close-ops">' + icon('left') + '위저드로 돌아가기</button>' +
        '<span class="hint">시즌 운영은 1차 편성 위저드와 따로 둡니다. 경기 기록 → 재편성 순서로 씁니다.</span>' +
        S.mock('경기 기록 저장·재편성 탐색 목업');
    }
    const n = S.ui.step;
    const cur = S.stepStatus(n);
    const prev = n > 1 ? '<button class="btn" data-act="go-step" data-step="' + (n - 1) + '">' + icon('left') + '이전: ' + STEP_META[n - 1].name + '</button>' : '<button class="btn" disabled>' + icon('left') + '이전 단계</button>';
    const next = n < 4
      ? '<button class="btn primary" data-act="go-step" data-step="' + (n + 1) + '">다음: ' + STEP_META[n + 1].name + ' <span class="nx">(' + icon(KICON[cur.kind] || 'info') + esc(cur.next) + ')</span>' + icon('right') + '</button>'
      : '<button class="btn primary" data-act="q-view" data-qv="export">배포본 내보내기 <span class="nx">(' + icon(KICON[cur.kind] || 'info') + esc(cur.next) + ')</span>' + icon('right') + '</button>';
    return prev + '<span class="hint"><b>' + CIRCLED[n] + ' ' + STEP_META[n].name + '</b> — ' + esc(STEP_META[n].task) + '</span>' +
      '<span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' + next;
  }

  function renderOpsBar() {
    const t = S.ui.ops;
    return '<span class="title">시즌 운영</span>' +
      '<div class="tabs" role="tablist">' +
        '<button role="tab" class="' + (t === 'games' ? 'on' : '') + '" data-act="ops-tab" data-tab="games">' + icon('cal') + '경기 기록</button>' +
        '<button role="tab" class="' + (t === 'reschedule' ? 'on' : '') + '" data-act="ops-tab" data-tab="reschedule">' + icon('bolt') + '재편성</button>' +
      '</div>' +
      '<span class="pane-desc">취소 경기를 날짜 단위로 기록하고, 잔여·취소 경기를 9~10월에 다시 배치합니다.</span>' +
      '<span style="margin-left:auto" class="small muted">기준일 ' + S.fmt.date(S.app.referenceDate()) + '</span>';
  }

  // ───────── 오버레이 ─────────
  S.modals = {};
  S.drawers = {};
  function renderOverlay() {
    let s = '';
    const u = S.ui;
    if (u.drawer && S.drawers[u.drawer]) s += '<div class="drawer-scrim" data-act="close-drawer"></div>' + S.drawers[u.drawer]();
    if (u.modal && S.modals[u.modal]) s += '<div class="scrim" data-act="scrim">' + S.modals[u.modal]() + '</div>';
    if (u.menu && S.menus[u.menu]) s += S.menus[u.menu]();
    s += '<div class="minw-note">이 화면은 1440px 이상 폭에 맞췄습니다. 창을 넓혀 주세요.</div>';
    return s;
  }

  S.menus = {
    data() {
      const p = S.ui.menuPos || { x: 0, y: 44 };
      return '<div class="menu" role="menu" style="top:' + p.y + 'px;right:' + Math.max(8, window.innerWidth - p.x) + 'px">' +
        '<div class="mh">가져오기</div>' +
        '<button role="menuitem" data-act="import-xlsx">' + icon('upload') + '.xlsx 업로드…' + S.mock() + '</button>' +
        '<button role="menuitem" data-act="import-gsheet">' + icon('link') + '구글 시트 연결…' + S.mock() + '</button>' +
        '<div class="msep"></div><div class="mh">내보내기</div>' +
        '<button role="menuitem" data-act="export" data-kind="xlsx">' + icon('download') + '.xlsx 내보내기' + S.mock() + '</button>' +
        '<button role="menuitem" data-act="export" data-kind="template">' + icon('file') + '빈 양식 다운로드' + S.mock() + '</button>' +
        '<button role="menuitem" data-act="export" data-kind="project">' + icon('db') + '프로젝트 JSON</button>' +
        '<button role="menuitem" data-act="export" data-kind="engine">' + icon('bolt') + '엔진 JSON (input 형식)</button>' +
        (S.feature('D4') ? '<button role="menuitem" data-act="export" data-kind="csv">' + icon('table') + '일정표 CSV</button>' : '') +
      '</div>';
    }
  };

  // ───────── 렌더 루프 ─────────
  const els = {};
  const scrollMem = {};
  S.render = function () {
    const u = S.ui;
    document.querySelectorAll('[data-sk]').forEach((el) => { scrollMem[el.getAttribute('data-sk')] = [el.scrollTop, el.scrollLeft]; });
    document.body.classList.toggle('mode-ops', !!u.ops);
    els.top.innerHTML = renderTop();
    els.stepper.innerHTML = u.ops ? renderOpsBar() : renderStepper();
    els.stepper.className = u.ops ? 'opsbar' : 'stepper';
    els.body.innerHTML = u.ops ? S.ops.render() : S.steps[u.step].render();
    els.footer.innerHTML = renderFooter();
    els.overlay.innerHTML = renderOverlay();
    document.querySelectorAll('[data-sk]').forEach((el) => { const m = scrollMem[el.getAttribute('data-sk')]; if (m) { el.scrollTop = m[0]; el.scrollLeft = m[1]; } });
    const after = S._after; S._after = [];
    for (const fn of after) { try { fn(); } catch (e) { console.error(e); } }
    if (!u.ops && S.steps[u.step].after) S.steps[u.step].after();
    if (u.ops && S.ops.after) S.ops.after();
    S.writeHash();
    S.checkScroll();
  };
  S._after = [];
  S.afterRender = (fn) => S._after.push(fn);
  let pending = false;
  S.scheduleRender = function () {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; S.render(); }, 0);
  };
  S.go = function (patch) { Object.assign(S.ui, patch); S.ui.menu = null; S.render(); };
  S.toast = (m, k, ms) => { if (!S.quiet) KBO.UI.toast(m, k, ms); };

  /** 선택 항목을 보이게 스크롤 */
  S.revealSelected = function (sel, container) {
    const box = typeof container === 'string' ? document.querySelector(container) : container;
    const el = box && box.querySelector(sel);
    if (!el || !box) return;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top + 30 || r.bottom > b.bottom - 4) box.scrollTop += r.top - b.top - b.height / 3;
  };

  // ───────── 공통 동작 ─────────
  Object.assign(S.actions, {
    'go-step': (el) => { S.go({ step: +el.dataset.step, ops: null, sel: null, edit: null }); },
    'open-ops': () => { S.go({ ops: S.ui.ops ? S.ui.ops : 'games', drawer: null }); },
    'close-ops': () => { S.go({ ops: null }); },
    'ops-tab': (el) => { S.go({ ops: el.dataset.tab }); },
    'open-settings': (el) => { S.go({ drawer: S.ui.drawer === 'settings' && !el.dataset.set ? null : 'settings', setTab: el.dataset.set || S.ui.setTab || 'features' }); },
    'close-drawer': () => { S.go({ drawer: null }); },
    'close-modal': () => { S.go({ modal: null }); },
    'scrim': (el, e) => { if (e.target === el) S.go({ modal: null }); },
    'menu': (el) => {
      const r = el.getBoundingClientRect();
      S.ui.menuPos = { x: r.right, y: r.bottom + 4 };
      S.ui.menu = S.ui.menu === el.dataset.menu ? null : el.dataset.menu;
      els.overlay.innerHTML = renderOverlay();
      els.top.innerHTML = renderTop();
    },
    'toggle-insp': () => { S.go({ inspOff: !S.ui.inspOff }); },
    'undo': () => { S.app.undo(); },
    'redo': () => { S.app.redo(); },
    'export': (el) => S.doExport(el.dataset.kind)
  });

  S.doExport = function (kind) {
    const app = S.app;
    S.ui.menu = null;
    if (kind === 'project') { app.exportProject(); S.toast('프로젝트 JSON을 내려받았습니다.', 'ok'); }
    else if (kind === 'engine') { app.exportEngine(); S.toast('엔진 호환 JSON(input_2025 형식)을 내려받았습니다.', 'ok'); }
    else if (kind === 'csv') { app.exportCSV(S.ui.team || null); S.toast('일정표 CSV를 내려받았습니다' + (S.ui.team ? ' (' + S.ui.team + ')' : '') + '.', 'ok'); }
    else if (kind === 'xlsx') S.toast('목업: 2025_KBO_편성_배포본.xlsx (시트 6개 · 슬롯 45 · 시리즈 225)를 만들었다고 가정합니다.', 'info', 4200);
    else if (kind === 'template') S.toast('목업: 빈 양식.xlsx (안내 시트 + 시트별 머리글·예시 1행)를 받았다고 가정합니다.', 'info', 4200);
    if (kind !== 'template') S.ui.exported = true;
    S.render();
  };

  // ───────── 시작 ─────────
  S.start = function () {
    els.top = document.getElementById('topbar');
    els.stepper = document.getElementById('stepper');
    els.body = document.getElementById('body');
    els.footer = document.getElementById('footer');
    els.overlay = document.getElementById('overlay');
    const q = new URLSearchParams(location.search);
    S.debugScroll = q.get('debug') === 'scroll';
    if (q.get('fresh') === '1') { S.ls.del(S.KEY + 'features'); }
    S.loadFeatures();
    const app = S.app = new KBO.App({ appId: 'wizard-std', appName: '편성 스튜디오' });
    app.store.autosaveMs = -1;
    app.store.initial = S.seedProject;
    app.store.reset();
    app.state.meta.features = Object.assign({}, S.features);
    for (const v of app.derived().ex.violations) S.virtualSigs.add(S.vsig(v));
    // 기본 월: 첫 위반이 있는 달
    const ex = app.derived().ex;
    const first = ex.violations[0];
    S.ui.month = first ? KBO.Dates.month(app.derived().slots[first.slot].day) : 4;
    app.subscribe(() => S.scheduleRender());
    app.setNavigator((target) => S.navTarget(target));
    S.applyRoute(S.parseHash());
    window.addEventListener('hashchange', () => { S.applyRoute(S.parseHash()); S.render(); });
    window.addEventListener('resize', () => S.checkScroll());
    bindEvents();
    S.render();
    if (S.ui.demo && S.demos[S.ui.demo]) { S.quiet = true; try { S.demos[S.ui.demo](); } finally { S.quiet = false; } }
    setTimeout(() => S.checkScroll(), 300);
    if (q.get('selftest') === '1') { const sc = document.createElement('script'); sc.src = 'app/studio/selftest.js'; document.body.appendChild(sc); }
  };
  S.demos = {};

  /** 사전 점검 링크 등에서 입력 위치로 이동 */
  S.navTarget = function (target) {
    const map = { teams: 'teams', distance: 'teams', slots: 'slots', series: 'series', events: 'events', season: 'season' };
    if (target === 'result') S.go({ step: 3, ops: null });
    else if (target === 'review') S.go({ step: 2, ops: null });
    else S.go({ step: 1, tab: map[target] || 'slots', ops: null, sel: null, flash: map[target] || null });
  };

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (S.ui.menu && !e.target.closest('.menu') && !(el && el.dataset.act === 'menu')) { S.ui.menu = null; els.overlay.innerHTML = renderOverlay(); els.top.innerHTML = renderTop(); }
      if (!el) return;
      const fn = S.actions[el.dataset.act];
      if (fn) { fn(el, e); }
    });
    const onInput = (e) => {
      const el = e.target.closest('[data-in]');
      if (!el) return;
      const fn = S.inputs[el.dataset.in];
      if (fn) fn(el, e);
    };
    document.addEventListener('change', onInput);
    document.addEventListener('keydown', (e) => {
      if (S.onKey && S.onKey(e) === true) return;
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === 'Escape') {
        if (S.ui.menu) { S.ui.menu = null; S.render(); return; }
        if (S.ui.modal) { S.go({ modal: null }); return; }
        if (S.ui.drawer) { S.go({ drawer: null }); return; }
      }
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) S.app.redo(); else S.app.undo(); }
      if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'y')) { e.preventDefault(); S.app.redo(); }
    });
  }

  // ───────── 3분할 작업 공간 공통 ─────────
  /** opts: { list, main, insp, inspTitle, cls } */
  S.workspace = function (o) {
    const off = S.ui.inspOff;
    const insp = off
      ? '<aside class="insp-rail" aria-label="인스펙터(접힘)"><button class="btn sm icon ghost" data-act="toggle-insp" title="인스펙터 펼치기">' + icon('left') + '</button><span class="rail-label">인스펙터 · ' + esc(o.inspTitle || '') + '</span></aside>'
      : '<aside class="pane insp" aria-label="인스펙터"><div class="pane-head"><span class="pane-title">' + esc(o.inspTitle || '인스펙터') + '</span>' + (o.inspHead || '') + '<button class="btn sm icon ghost" style="margin-left:auto" data-act="toggle-insp" title="인스펙터 접기">' + icon('right') + '</button></div><div class="pane-body" data-sk="insp-' + S.ui.step + (S.ui.ops || '') + '">' + o.insp + '</div>' + (o.inspFoot ? '<div class="pane-foot">' + o.inspFoot + '</div>' : '') + '</aside>';
    return '<div class="workspace' + (off ? ' insp-off' : '') + (o.cls ? ' ' + o.cls : '') + '">' +
      '<nav class="pane list" aria-label="' + esc(o.listLabel || '목록') + '">' + o.list + '</nav>' +
      '<section class="pane main">' + o.main + '</section>' + insp + '</div>';
  };
  S.paneHead = (title, desc, right) => '<div class="pane-head"><span class="pane-title">' + esc(title) + '</span>' + (desc ? '<span class="pane-desc" title="' + esc(desc) + '">' + esc(desc) + '</span>' : '') + (right ? '<span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex:none">' + right + '</span>' : '') + '</div>';
  S.undoButtons = function () {
    const st = S.app.store;
    return '<span class="btn-group">' +
      '<button class="btn sm" data-act="undo" ' + (st.canUndo() ? 'title="실행 취소: ' + esc(st.undoLabel()) + '"' : 'disabled') + '>' + icon('undo') + '실행 취소</button>' +
      '<button class="btn sm icon" data-act="redo" ' + (st.canRedo() ? 'title="다시 실행: ' + esc(st.redoLabel()) + '"' : 'disabled') + '>' + icon('redo') + '</button></span>';
  };
  S.Score = Score;
})();
