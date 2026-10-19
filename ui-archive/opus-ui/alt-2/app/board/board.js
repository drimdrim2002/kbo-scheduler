/*
 * alt-2 시즌 보드 (Calendar Board)
 * 대형 월간 달력이 항상 중심이다. 도구 팔레트로 날짜 클릭 동작을 바꾼다.
 *  - 편성 수정: 시리즈 드래그 이동·교환, 슬롯 손잡이(⇅) 드래그로 슬롯 통째 교환
 *  - 공휴일 / 경기 없는 날 / 휴식 예외: 날짜 클릭으로 바로 지정·해제
 *  - 이벤트: 날짜 클릭 → 대진 지정·구장 지정 이벤트 추가
 *  - 경기 기록: 날짜 클릭 → 오른쪽 레일에서 그날 경기 상태 기록
 *  - 재편성 배치: 재편성 경기를 고르고 날짜 클릭 → 묶음 이동
 * 입력·분석은 오른쪽 슬라이드 패널로 연다.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const P = UI.panels;
  const { esc, fmt, on } = UI;
  const { Dates, Score } = KBO;

  const app = new KBO.App({ appId: 'alt-2', appName: '시즌 보드' });
  window.app = app;

  const TOOLS = [
    { id: 'edit', icon: '✋', label: '편성 수정', hint: '시리즈를 끌어 다른 날짜로 옮기거나 다른 시리즈에 놓아 맞바꿉니다. 날짜 칸의 ⇅ 손잡이를 끌면 슬롯 전체를 같은 길이 슬롯과 맞바꿉니다. 시리즈를 누르면 상세·고정.' },
    { id: 'holiday', icon: '🎌', label: '공휴일', hint: '날짜를 누르면 공휴일로 지정하거나 해제합니다. 휴일 가중치가 바뀌므로 슬롯을 다시 생성하세요.' },
    { id: 'blackout', icon: '⛔', label: '경기 없는 날', hint: '날짜를 누르면 경기 없는 날로 지정하거나 해제합니다(올스타 브레이크 등). 기간은 패널에서 이름과 함께 관리합니다.' },
    { id: 'restex', icon: '⚾', label: '휴식 예외', hint: '휴식 요일(월요일 등)을 누르면 경기하는 날(휴식 예외)로 지정하거나 해제합니다.' },
    { id: 'event', icon: '🎉', label: '이벤트', hint: '날짜를 누르면 그 슬롯에 대진 지정(고정) 또는 구장 지정(홈 의무) 이벤트를 추가합니다.' },
    { id: 'record', icon: '📝', label: '경기 기록', hint: '날짜를 누르면 오른쪽에서 그날 경기를 완료·취소(사유)로 기록합니다. 일괄 처리도 됩니다.' },
    { id: 'resched', icon: '🔁', label: '재편성 배치', hint: '재편성 경기(재)를 눌러 고른 뒤 날짜를 누르면 묶음을 그 날짜로 옮깁니다. 재편성 패널에서 대상 확정·실행.' }
  ];
  let tool = 'edit';
  let selectedDate = null;

  const DRAWERS = [
    { id: 'teams', icon: '🏟', label: '구단·구장', mount: (el) => P.teams(el, app) },
    { id: 'distance', icon: '↔', label: '거리 행렬', mount: (el) => P.distance(el, app) },
    { id: 'season', icon: '🗓', label: '일정 골격·슬롯', mount: (el) => { el.innerHTML = '<div class="d-a"></div><h3 class="k-subhead">슬롯</h3><div class="d-b"></div>'; P.season(el.querySelector('.d-a'), app); P.slots(el.querySelector('.d-b'), app); } },
    { id: 'series', icon: '🧮', label: '시리즈', mount: (el) => P.series(el, app) },
    { id: 'events', icon: '🎉', label: '이벤트', mount: (el) => P.events(el, app, { defaultDate: () => selectedDate || app.state.settings.seasonStart }) },
    { id: 'review', icon: '🔎', label: '검토·엔진', mount: (el) => { el.innerHTML = '<div class="d-a"></div><h3 class="k-subhead">엔진 실행</h3><div class="d-b"></div>'; P.review(el.querySelector('.d-a'), app); P.solver(el.querySelector('.d-b'), app); } },
    { id: 'quality', icon: '⚖', label: '품질·스냅샷', mount: (el) => { el.innerHTML = '<div class="d-a"></div><div class="k-grid-2"><div><h3 class="k-subhead">Soft 분해</h3><div class="d-b"></div></div><div><h3 class="k-subhead">스냅샷</h3><div class="d-c"></div></div></div>'; P.metrics(el.querySelector('.d-a'), app); P.softBreakdown(el.querySelector('.d-b'), app); P.snapshots(el.querySelector('.d-c'), app); } },
    { id: 'analysis', icon: '📊', label: '분석', mount: (el) => { el.innerHTML = '<div class="d-a"></div><h3 class="k-subhead">구단 × 슬롯 매트릭스</h3><div class="d-c"></div><h3 class="k-subhead">이동 경로</h3><div class="d-b"></div>'; P.chartsPanel(el.querySelector('.d-a'), app, { width: 440, wideWidth: 900 }); P.teamSlotMatrix(el.querySelector('.d-c'), app); P.routeMap(el.querySelector('.d-b'), app, { width: 420 }); } },
    { id: 'ops', icon: '🔁', label: '재편성·현황', mount: (el) => { el.innerHTML = '<div class="d-a"></div><h3 class="k-subhead">시즌 진행 현황</h3><div class="d-b"></div>'; P.reschedule(el.querySelector('.d-a'), app); P.progress(el.querySelector('.d-b'), app); } },
    { id: 'schedule', icon: '🖨', label: '구단 일정표', mount: (el) => P.teamSchedule(el, app) },
    { id: 'data', icon: '⚙', label: '설정·데이터', mount: (el) => { el.innerHTML = '<div class="d-a"></div><h3 class="k-subhead">데이터</h3><div class="d-b"></div>'; P.settings(el.querySelector('.d-a'), app); P.data(el.querySelector('.d-b'), app); } }
  ];

  // ───── 골격 ─────
  const $ = (s) => document.querySelector(s);
  $('#drawer-nav').innerHTML = DRAWERS.map((d) => '<button class="bd-navbtn" data-drawer="' + d.id + '"><span aria-hidden="true">' + d.icon + '</span>' + esc(d.label) + '</button>').join('');
  $('#tools').innerHTML = '<div class="bd-tools" role="radiogroup" aria-label="날짜 클릭 도구">' + TOOLS.map((t) => '<button role="radio" class="bd-tool" data-tool="' + t.id + '" aria-checked="false" title="' + esc(t.hint) + '"><span aria-hidden="true">' + t.icon + '</span>' + esc(t.label) + '</button>').join('') + '</div><div class="bd-hint" aria-live="polite"></div>';
  P.badge($('#badge'), app);
  P.undoBar($('#undo'), app, { pins: false });
  P.violations($('#rail-viol'), app);
  P.pool($('#rail-pool'), app);

  function renderTools() {
    document.querySelectorAll('.bd-tool').forEach((b) => { const onn = b.dataset.tool === tool; b.classList.toggle('k-on', onn); b.setAttribute('aria-checked', String(onn)); });
    $('.bd-hint').textContent = TOOLS.find((t) => t.id === tool).hint;
    document.body.dataset.tool = tool;
    renderRail();
  }
  on($('#tools'), 'click', '[data-tool]', (e, b) => { tool = b.dataset.tool; if (tool !== 'resched') app.ui.selectedUnit = null; renderTools(); cal.refresh(); });
  // 숫자 키 1~7로 도구 전환
  document.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = Number(e.key) - 1;
    if (i >= 0 && i < TOOLS.length) { tool = TOOLS[i].id; renderTools(); cal.refresh(); }
  });

  // ───── 날짜 클릭 동작 ─────
  const S = () => app.state.settings;
  function toggleHoliday(date) {
    const has = S().holidays.some((h) => h.date === date);
    if (has) return app.updateSettings({ holidays: S().holidays.filter((h) => h.date !== date) }, '공휴일 해제: ' + fmt.date(date));
    return UI.promptBox('공휴일 지정 — ' + fmt.date(date), '이름', '공휴일').then((n) => n != null && app.updateSettings({ holidays: S().holidays.concat([{ date, name: n || '공휴일' }]) }, '공휴일 지정: ' + fmt.date(date)));
  }
  function toggleBlackout(date) {
    const d = Dates.dayNum(date);
    const list = S().blackouts.map((b) => Object.assign({}, b));
    const hit = list.findIndex((b) => d >= Dates.dayNum(b.start) && d <= Dates.dayNum(b.end || b.start));
    if (hit >= 0) {
      // 기간 안의 하루를 빼면 기간을 둘로 나눈다
      const b = list[hit];
      const a0 = Dates.dayNum(b.start), a1 = Dates.dayNum(b.end || b.start);
      const parts = [];
      if (d > a0) parts.push({ start: b.start, end: Dates.isoDate(d - 1), label: b.label });
      if (d < a1) parts.push({ start: Dates.isoDate(d + 1), end: b.end, label: b.label });
      list.splice(hit, 1, ...parts);
      return app.updateSettings({ blackouts: list }, '경기 없는 날 해제: ' + fmt.date(date));
    }
    // 인접 기간과 합친다
    const adj = list.findIndex((b) => Dates.dayNum(b.end || b.start) === d - 1 || Dates.dayNum(b.start) === d + 1);
    if (adj >= 0) { const b = list[adj]; if (Dates.dayNum(b.start) === d + 1) b.start = date; else b.end = date; }
    else list.push({ start: date, end: date, label: '경기 없는 날' });
    return app.updateSettings({ blackouts: list }, '경기 없는 날 지정: ' + fmt.date(date));
  }
  function toggleRestException(date) {
    const ex = S().restExceptions;
    if (ex.includes(date)) return app.updateSettings({ restExceptions: ex.filter((x) => x !== date) }, '휴식 예외 해제: ' + fmt.date(date));
    if (!S().restWeekdays.includes(Dates.weekday(date))) { UI.toast(fmt.date(date) + '은(는) 휴식 요일이 아닙니다. 휴식 요일은 일정 골격 패널에서 바꿉니다.', 'info'); return; }
    return app.updateSettings({ restExceptions: ex.concat([date]).sort() }, '휴식 예외 지정: ' + fmt.date(date));
  }
  function addEventAt(date) {
    const st = app.state;
    const si = app.slotOfDate(date);
    if (si < 0) { UI.toast(fmt.date(date) + '은(는) 슬롯에 속하지 않습니다. 경기일을 고르세요.', 'warn'); return; }
    const teamOpts = (sel) => st.teams.map((t) => '<option' + (t.name === sel ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
    const stadiums = Array.from(new Set(st.teams.map((t) => t.stadium)));
    const body = '<p class="k-muted">' + esc(app.derived().slots[si].label) + '</p><div class="k-grid-2"><label class="k-field"><span>유형</span><select class="k-input" name="type"><option value="CUSTOM">사용자 정의</option><option value="OPENING">개막전</option><option value="CHILDREN">어린이날</option></select></label><label class="k-field"><span>이름</span><input class="k-input" name="name" value="특별 이벤트"></label></div>' +
      '<fieldset class="k-fieldset"><legend><label class="k-check"><input type="radio" name="mode" value="MATCH" checked> 대진 지정 (구단+구장, 고정)</label></legend><div class="k-inline">원정 <select class="k-input" name="away">' + teamOpts(st.teams[1].name) + '</select> @ 홈 <select class="k-input" name="home">' + teamOpts(st.teams[0].name) + '</select></div></fieldset>' +
      '<fieldset class="k-fieldset"><legend><label class="k-check"><input type="radio" name="mode" value="STADIUM"> 구장 지정 (홈 의무)</label></legend><div class="k-chips">' + stadiums.map((x) => '<label class="k-check k-chip"><input type="checkbox" name="stad" value="' + esc(x) + '"> ' + esc(x) + '</label>').join('') + '</div></fieldset>';
    UI.dialog({ title: '이벤트 추가 — ' + fmt.date(date), body, wide: true, actions: [{ label: '취소', value: null }, { label: '추가', kind: 'primary', value: (d) => {
      const f = (n) => d.querySelector('[name=' + n + ']');
      const mode = d.querySelector('[name=mode]:checked').value;
      const ev = { type: f('type').value, name: f('name').value || '이벤트', date, mode };
      if (mode === 'MATCH') { ev.home = f('home').value; ev.away = f('away').value; } else ev.stadiums = Array.from(d.querySelectorAll('[name=stad]:checked')).map((x) => x.value);
      return ev;
    } }] }).then((ev) => {
      if (!ev) return;
      if (ev.mode === 'MATCH' && ev.home === ev.away) { UI.toast('홈과 원정이 같습니다.', 'warn'); return; }
      app.addEvent(ev);
      if (ev.mode === 'MATCH') app.applyEvents();
    });
  }
  function onDayClick(date) {
    selectedDate = date;
    if (tool === 'holiday') toggleHoliday(date);
    else if (tool === 'blackout') toggleBlackout(date);
    else if (tool === 'restex') toggleRestException(date);
    else if (tool === 'event') addEventAt(date);
    else if (tool === 'resched' && app.ui.selectedUnit) {
      const u = app.ui.selectedUnit;
      const rs = app.state.reschedule;
      if (date < rs.start || date > rs.end) { UI.toast('재편성 기간(' + fmt.date(rs.start) + '~' + fmt.date(rs.end) + ') 안의 날짜를 고르세요.', 'warn'); return; }
      const p = (rs.plan || []).find((x) => x.unit === u);
      app.moveUnit(u, date, p ? p.dh : false);
      app.ui.selectedUnit = null;
    }
    renderRail();
    cal.refresh();
  }

  // ───── 달력 ─────
  const cal = P.calendar($('#board'), app, {
    large: true,
    onDayClick,
    onSeriesClick: (m) => { if (tool === 'edit') P.seriesDialog(app, m); },
    onUnitClick: (u) => { if (tool !== 'resched') { tool = 'resched'; renderTools(); } app.ui.selectedUnit = app.ui.selectedUnit === u ? null : u; UI.toast(app.ui.selectedUnit ? '재편성 묶음 ' + u + ' 선택 — 옮길 날짜를 누르세요.' : '선택 해제', 'info'); cal.refresh(); },
    dayExtra: (d) => {
      const c = app.derived();
      const si = c.dayToSlot.has(d) ? c.dayToSlot.get(d) : -1;
      const iso = Dates.isoDate(d);
      let html = '';
      const evs = app.state.events.filter((e) => KBO.Score.resolveEventSlot(e, app.state.calendar) === si && si >= 0 && c.slots[si].day === d);
      if (evs.length) html += '<span class="bd-ev" title="' + esc(evs.map((e) => e.name + (e.mode === 'MATCH' ? ' ' + e.away + '@' + e.home : ' 구장 ' + (e.stadiums || []).join('·'))).join('\n')) + '">🎉' + evs.length + '</span>';
      if (S().restExceptions.includes(iso)) html += '<span class="bd-restex" title="휴식 예외일">⚾예외</span>';
      if (si >= 0 && c.slots[si].day === d && tool === 'edit') html += '<span class="bd-handle" draggable="true" data-slot-handle="' + si + '" title="끌어서 같은 길이 슬롯과 통째로 교환" role="button" tabindex="0" aria-label="' + esc(c.slots[si].label) + ' 슬롯 교환 손잡이">⇅</span>';
      return { cls: (selectedDate === iso ? 'bd-selected' : '') + (S().restWeekdays.includes(Dates.weekday(d)) && !S().restExceptions.includes(iso) ? ' bd-rest' : ''), html };
    }
  });

  // ───── 슬롯 통째 교환 (alt-2 고유 직접 조작) ─────
  let dragSlot = null;
  function slotSwapPlan(a, b) {
    const c = app.derived();
    const plan = Int32Array.from(c.plan);
    for (let m = 0; m < plan.length; m++) {
      if (app.state.matches[m].pinned) continue;
      if (plan[m] === a) plan[m] = b; else if (plan[m] === b) plan[m] = a;
    }
    return plan;
  }
  function swapSlots(a, b) {
    const c = app.derived();
    const plan = slotSwapPlan(a, b);
    app.commit('슬롯 교환: ' + c.slots[a].label + ' ↔ ' + c.slots[b].label, (s) => { for (let m = 0; m < plan.length; m++) s.plan[m].calendar = plan[m]; }, ['plan']);
  }
  const board = $('#board');
  board.addEventListener('dragstart', (e) => {
    const h = e.target.closest && e.target.closest('[data-slot-handle]');
    if (!h) return;
    if (app.isRunning()) { e.preventDefault(); return; }
    dragSlot = Number(h.dataset.slotHandle);
    e.dataTransfer.setData('text/plain', 'slot:' + dragSlot);
    e.dataTransfer.effectAllowed = 'move';
    board.classList.add('bd-slotdrag');
  });
  board.addEventListener('dragend', () => { dragSlot = null; board.classList.remove('bd-slotdrag'); hideTip(); });
  let tipEl = null;
  function showTip(x, y, h) { if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'k-dragtip'; document.body.appendChild(tipEl); } tipEl.innerHTML = h; tipEl.style.left = x + 14 + 'px'; tipEl.style.top = y + 14 + 'px'; tipEl.hidden = false; }
  function hideTip() { if (tipEl) tipEl.hidden = true; }
  let lastT = null, lastDelta = null;
  board.addEventListener('dragover', (e) => {
    if (dragSlot == null) return;
    const day = e.target.closest('[data-drop-slot]');
    if (!day) return;
    e.preventDefault();
    const t = Number(day.dataset.dropSlot);
    const c = app.derived();
    if (t !== lastT) {
      lastT = t;
      if (t === dragSlot) lastDelta = null;
      else { const after = Score.evaluate(c.ctx, slotSwapPlan(dragSlot, t), []); const before = Score.flat(c.ex.score); lastDelta = after.map((v, i) => v - before[i]); }
    }
    const same = c.slots[t].consecutive === c.slots[dragSlot].consecutive;
    const hd = lastDelta ? lastDelta[0] + lastDelta[1] : 0;
    showTip(e.clientX, e.clientY, '⇅ 슬롯 교환: ' + esc(c.slots[dragSlot].label) + ' ↔ ' + esc(c.slots[t].label) + (same ? '' : '<br>⚠ 연전 수가 달라 H0-d 위반이 생깁니다') + (lastDelta ? '<br><b>' + (hd > 0 ? '▲ 개선' : hd < 0 ? '▼ 악화' : '＝') + ' Hard Δ ' + (hd > 0 ? '+' : '') + hd + '</b> · Soft Δ ' + lastDelta.slice(2).map((v) => (v > 0 ? '+' : '') + v.toLocaleString('ko-KR')).join(' / ') : ''));
  });
  board.addEventListener('drop', (e) => {
    if (dragSlot == null) return;
    const day = e.target.closest('[data-drop-slot]');
    e.preventDefault();
    const a = dragSlot; dragSlot = null; lastT = null; hideTip(); board.classList.remove('bd-slotdrag');
    if (!day) return;
    const b = Number(day.dataset.dropSlot);
    if (a !== b) swapSlots(a, b);
  }, true);
  // 키보드: 손잡이에서 Enter → 교환 대상 슬롯 선택
  let kbSlot = null;
  board.addEventListener('keydown', (e) => {
    const h = e.target.closest && e.target.closest('[data-slot-handle]');
    if (h && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); e.stopPropagation();
      const s = Number(h.dataset.slotHandle);
      if (kbSlot == null) { kbSlot = s; UI.toast('슬롯 교환: 대상 슬롯의 ⇅ 손잡이에서 Enter', 'info'); }
      else { const a = kbSlot; kbSlot = null; if (a !== s) swapSlots(a, s); }
    }
  }, true);

  // ───── 오른쪽 레일: 선택한 날 ─────
  let gamesPanel = null;
  function renderRail() {
    const el = $('#rail-day');
    const c = app.derived();
    if (tool === 'record') {
      if (!gamesPanel) { el.innerHTML = '<h3 class="bd-railhead">📝 경기 기록</h3><div class="bd-games"></div>'; gamesPanel = P.games(el.querySelector('.bd-games'), app, { compact: true, date: () => selectedDate, onDate: (d) => { selectedDate = d; const day = Dates.dayNum(d); if (Dates.month(day) !== app.ui.month) app.ui.month = Dates.month(day); cal.refresh(); } }); }
      else gamesPanel.refresh();
      return;
    }
    if (gamesPanel) { gamesPanel.destroy(); gamesPanel = null; }
    if (!selectedDate) { el.innerHTML = '<h3 class="bd-railhead">선택한 날</h3><p class="k-muted k-small">날짜를 누르면 그날 슬롯·경기·이벤트를 보여 줍니다.</p>'; return; }
    const d = Dates.dayNum(selectedDate);
    const si = c.dayToSlot.has(d) ? c.dayToSlot.get(d) : -1;
    const games = app.games().filter((g) => g.date === selectedDate);
    const hol = S().holidays.find((h) => h.date === selectedDate);
    const black = S().blackouts.find((b) => d >= Dates.dayNum(b.start) && d <= Dates.dayNum(b.end || b.start));
    let h = '<h3 class="bd-railhead">' + fmt.date(selectedDate) + '</h3><div class="k-chips">' + (hol ? '<span class="k-chip k-chip-bad">🎌 ' + esc(hol.name) + '</span>' : '') + (black ? '<span class="k-chip">⛔ ' + esc(black.label || '경기 없는 기간') + '</span>' : '') + (S().restExceptions.includes(selectedDate) ? '<span class="k-chip k-chip-info">⚾ 휴식 예외</span>' : '') + '</div>';
    if (si >= 0) {
      const sl = c.slots[si];
      h += '<p><b>' + esc(sl.label) + '</b> · 주말 ' + sl.weekend + ' · 휴일 가중치 ' + sl.holiday + ' ' + (c.ex.slotHard[si] ? UI.stateChip('bad', '슬롯 감점 ' + c.ex.slotHard[si]) : UI.stateChip('ok', '슬롯 위반 없음')) + '</p>';
      const vs = c.ex.violations.filter((v) => v.slot === si);
      if (vs.length) h += '<ul class="bd-vlist">' + vs.map((v) => '<li>' + (P.RULE_ICON[v.code] || '⚠') + ' <b>' + v.code + '</b> ' + esc(v.message) + '</li>').join('') + '</ul>';
      h += '<div class="k-slotchips">' + c.bySlot[si].map((m) => P.chip(app, m, { showLen: true })).join('') + '</div><div class="k-toolbar"><button class="k-btn k-btn-ghost" data-pinslot="' + si + '">📌 이 슬롯 일괄 고정/해제</button></div>';
    } else h += '<p class="k-muted">경기 없는 날입니다.</p>';
    const re = games.filter((g) => g.source === 'RESCHEDULE');
    if (re.length) h += '<p class="k-small">재편성 경기: ' + re.map((g) => esc(g.away + '@' + g.home) + (g.dh ? ' DH' : '')).join(', ') + '</p>';
    el.innerHTML = h;
  }
  on($('#rail-day'), 'click', '[data-pinslot]', (e, b) => { const i = Number(b.dataset.pinslot); const ms = app.derived().bySlot[i]; app.pinSlot(i, !(ms.length && ms.every((m) => app.state.matches[m].pinned))); });
  on($('#rail-day'), 'click', '[data-match]', (e, n) => P.seriesDialog(app, Number(n.dataset.match)));
  UI.enableDnd($('#rail-day'), app);
  app.subscribe((ch) => { if (!ch.tags.has('live')) renderRail(); });

  // 슬롯 재생성 배너 (날짜 도구로 설정을 바꾼 뒤)
  function renderBanner() {
    const el = $('#banner');
    const out = app.slotsOutOfDate();
    el.innerHTML = out ? '<div class="k-banner k-banner-warn" role="alert">⚠ 공휴일·경기 없는 날·휴식 예외가 바뀌어 현재 슬롯과 다릅니다. <button class="k-btn k-btn-primary" data-act="regen">슬롯 다시 생성</button><span class="k-small">같은 날짜·연전의 배정은 유지됩니다.</span></div>' : '';
  }
  on($('#banner'), 'click', '[data-act=regen]', () => app.regenerateSlots());
  app.subscribe((ch) => { if (ch.tags.has('settings') || ch.tags.has('calendar') || ch.tags.has('all')) renderBanner(); });

  // ───── 슬라이드 패널 ─────
  const drawer = $('#drawer');
  const mountedDrawers = new Map();
  let openId = null;
  function openDrawer(id) {
    const d = DRAWERS.find((x) => x.id === id);
    if (!d) return;
    if (!mountedDrawers.has(id)) {
      const host = document.createElement('div');
      host.className = 'bd-drawer-pane';
      host.dataset.id = id;
      $('#drawer-body').appendChild(host);
      d.mount(host);
      mountedDrawers.set(id, host);
    }
    for (const [k, host] of mountedDrawers) host.hidden = k !== id;
    $('#drawer-title').textContent = d.icon + ' ' + d.label;
    drawer.hidden = false;
    drawer.classList.add('bd-open');
    openId = id;
    document.querySelectorAll('.bd-navbtn').forEach((b) => b.classList.toggle('k-on', b.dataset.drawer === id));
    setTimeout(() => $('#drawer-close').focus(), 50);
  }
  function closeDrawer() { drawer.classList.remove('bd-open'); drawer.hidden = true; openId = null; document.querySelectorAll('.bd-navbtn').forEach((b) => b.classList.remove('k-on')); }
  on($('#drawer-nav'), 'click', '[data-drawer]', (e, b) => (openId === b.dataset.drawer ? closeDrawer() : openDrawer(b.dataset.drawer)));
  $('#drawer-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openId && !document.querySelector('dialog[open]')) closeDrawer(); });
  $('#drawer-wide').addEventListener('click', () => drawer.classList.toggle('bd-wide'));

  // 빠른 실행
  function renderQuick() {
    const running = app.isRunning();
    const r = app.run;
    $('#quick').innerHTML = running
      ? '<button class="k-btn" data-q="' + (r.status === 'PAUSED' ? 'resume' : 'pause') + '">' + (r.status === 'PAUSED' ? '▶ 계속' : '⏸ 일시정지') + '</button><button class="k-btn k-btn-danger" data-q="stop">■ 중지</button><span class="k-small">' + (r.mode === 'RESCHEDULE' ? '재편성' : '엔진') + ' ' + (r.elapsedMs / 1000).toFixed(1) + 's · 개선 ' + r.improvements + '</span>'
      : '<button class="k-btn k-btn-primary" data-q="run" title="사전 점검 후 Mock 엔진 실행">▶ 엔진 실행</button>';
  }
  on($('#quick'), 'click', '[data-q]', (e, b) => { const q = b.dataset.q; if (q === 'run') { if (!app.preflight().ok) { openDrawer('review'); UI.toast('사전 점검 차단 항목을 확인하세요.', 'warn'); } else app.solve(); } else app[q](); });
  let qp = null;
  app.subscribe((ch) => { if (ch.tags.has('run') || ch.tags.has('live')) { if (!qp) qp = setTimeout(() => { qp = null; renderQuick(); }, 200); } });

  app.setNavigator((target) => {
    const map = { teams: 'teams', distance: 'distance', season: 'season', slots: 'season', series: 'series', events: 'events', review: 'review', settings: 'data' };
    if (target === 'result') { closeDrawer(); return; }
    openDrawer(map[target] || target);
  });
  app.subscribe((ch) => { if (ch.tags.has('focus') && ch.focus && (ch.focus.slot != null || ch.focus.date)) { if (ch.focus.date) selectedDate = ch.focus.date; else if (app.derived().slots[ch.focus.slot]) selectedDate = app.derived().slots[ch.focus.slot].date; renderRail(); } });

  app.bindShortcuts();
  renderTools();
  renderBanner();
  renderQuick();
})();
