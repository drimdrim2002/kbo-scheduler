/*
 * alt-3 구단 매트릭스 (Team Grid)
 * 구단(행) × 슬롯(열) 격자가 주 화면이다. 열 머리 = 슬롯 설정, 행 머리 = 구단 설정.
 * 셀은 홈/원정·상대·이동거리를 담고, 공정성 지표가 행 끝에 붙는다. 연속 홈·원정 길이를 셀 띠로 보여 준다.
 * 나머지 기능은 격자 아래 하단 시트(높이 조절)에 탭으로 연다.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const P = UI.panels;
  const { esc, fmt, on } = UI;
  const { Dates, Score } = KBO;

  const app = new KBO.App({ appId: 'alt-3', appName: '구단 매트릭스' });
  window.app = app;

  const $ = (s) => document.querySelector(s);
  let cellMode = 'opp';       // opp | km | holiday | status
  let sortKey = null;         // 행 정렬 (지표)
  let sortDir = -1;
  let popover = null;         // { kind: 'slot'|'team', index }
  const MODES = [
    { id: 'opp', label: '상대' }, { id: 'km', label: '이동 km' }, { id: 'holiday', label: '휴일 가중치' }, { id: 'status', label: '경기 상태' }
  ];
  const ROW_METRICS = [
    { key: 'distanceKm', label: '이동거리', kind: 'scored', f: (v) => fmt.int(v), over: 'overDistance', dev: true },
    { key: 'moves', label: '이동', kind: 'scored', f: (v) => v, over: 'overMoves', dev: true },
    { key: 'holidayWeight', label: '휴일', kind: 'scored', f: (v) => v, over: 'overHoliday', dev: true },
    { key: 'streakPenalty', label: '4연속', kind: 'scored', f: (v) => v, overFn: (t) => t.streakPenalty > 0 },
    { key: 'weekendHome', label: '주말홈', kind: 'ref', f: (v) => v },
    { key: 'maxHomeRun', label: '최장H', kind: 'ref', f: (v) => v },
    { key: 'maxAwayRun', label: '최장A', kind: 'ref', f: (v) => v },
    { key: 'longTrips', label: '장거리', kind: 'ref', f: (v) => v, val: (t) => t.longTrips.length }
  ];
  const mval = (t, m) => (m.val ? m.val(t) : t[m.key]);

  // ───────────── 격자 ─────────────
  function renderGrid() {
    const host = $('#grid');
    const st = app.state;
    const c = app.derived();
    const S = c.slots.length;
    const N = st.teams.length;
    const ex = c.ex;
    // 구단·슬롯별 시리즈
    const cell = st.teams.map(() => new Array(S).fill(null).map(() => []));
    st.matches.forEach((x, m) => {
      const s = c.plan[m];
      if (s < 0) return;
      const h = c.teamIndex.get(x.home), a = c.teamIndex.get(x.away);
      if (h != null) cell[h][s].push(m);
      if (a != null && a !== h) cell[a][s].push(m);
    });
    const games = cellMode === 'status' ? app.games() : null;
    const gameStat = new Map();
    if (games) for (const g of games) if (g.source === 'INITIAL') { const k = g.match; const o = gameStat.get(k) || { P: 0, C: 0 }; if (g.status === 'PLAYED') o.P++; if (g.status === 'CANCELLED') o.C++; gameStat.set(k, o); }
    let order = st.teams.map((t, i) => i);
    if (sortKey) {
      const m = ROW_METRICS.find((x) => x.key === sortKey);
      order.sort((a, b) => sortDir * (mval(ex.teamMetrics[a], m) - mval(ex.teamMetrics[b], m)));
    }
    const means = {};
    for (const m of ROW_METRICS) means[m.key] = ex.teamMetrics.reduce((s, t) => s + mval(t, m), 0) / Math.max(1, N);
    const focus = app.ui.focus || {};
    const focusMatches = new Set(focus.matches || (focus.match != null ? [focus.match] : []));
    const filter = app.ui.teamFilter;
    const holidays = new Set((st.settings.holidays || []).map((h) => Dates.dayNum(h.date)));
    const stick = (k) => ' style="right:' + (ROW_METRICS.length - 1 - k) * 52 + 'px"';
    const stickCls = (k) => ' g-stick' + (k === 0 ? ' g-stick-first' : '');
    let h = '<table class="g-grid" role="grid" aria-label="구단 × 슬롯 편성 격자"><thead>';
    // 월 띠
    h += '<tr class="g-months"><th class="g-corner" rowspan="3"><div class="g-corner-in"><span>구단 \\ 슬롯</span><small>행 머리 = 구단 설정<br>열 머리 = 슬롯 설정</small></div></th>';
    let curM = -1, span = 0, cells = [];
    c.slots.forEach((s) => { if (s.month !== curM) { if (span) cells.push([curM, span]); curM = s.month; span = 0; } span++; });
    if (span) cells.push([curM, span]);
    h += cells.map(([m, n]) => '<th colspan="' + n + '" class="g-month">' + m + '월</th>').join('') + '<th colspan="' + ROW_METRICS.length + '" class="g-metrics-head g-stick g-stick-first" style="right:0;width:' + ROW_METRICS.length * 52 + 'px;max-width:none">공정성 지표 <small>(채점 · <i>참고</i>)</small></th></tr>';
    // 슬롯 머리
    h += '<tr class="g-slots">' + c.slots.map((s, i) => {
      const hard = ex.slotHard[i];
      const hasHol = s.days.some((d) => holidays.has(d));
      const allPinned = c.bySlot[i].length && c.bySlot[i].every((m) => st.matches[m].pinned);
      return '<th class="g-slot' + (hard ? ' g-bad' : '') + (s.weekend ? ' g-wk' : '') + (focus.slot === i ? ' g-focus' : '') + (popover && popover.kind === 'slot' && popover.index === i ? ' g-open' : '') + '" data-drop-slot="' + i + '" data-slot-head="' + i + '" tabindex="0" role="columnheader" aria-label="' + esc(s.label + ' 슬롯 설정' + (hard ? ', 위반 ' + hard : '')) + '" title="' + esc(s.label + ' · 주말 ' + s.weekend + ' · 휴일 가중치 ' + s.holiday + (hard ? ' · 슬롯 감점 ' + hard : '') + ' — 눌러서 슬롯 설정') + '">' +
        '<span class="g-sd">' + fmt.short(s.day) + '</span><span class="g-sw">' + Dates.WEEKDAY_KO[Dates.weekday(s.day)] + '</span><span class="g-sl">' + s.consecutive + (s.holiday ? '<sup>' + s.holiday + '</sup>' : '') + '</span>' + (hasHol ? '<span class="g-hol" aria-hidden="true">●</span>' : '') + (allPinned ? '<span aria-hidden="true">📌</span>' : '') + (hard ? '<span class="g-hard">⚠' + hard + '</span>' : '') + '</th>';
    }).join('') + ROW_METRICS.map((m, k) => '<th class="g-mh g-mh-' + m.kind + stickCls(k) + '"' + stick(k) + ' rowspan="2"><button class="g-sort" data-sort="' + m.key + '" title="' + esc(m.kind === 'scored' ? '엔진 채점 지표' : '참고 지표') + ' — 눌러서 행 정렬">' + esc(m.label) + (sortKey === m.key ? (sortDir < 0 ? '▼' : '▲') : '') + '</button></th>').join('') + '</tr>';
    // 슬롯 상태 띠
    h += '<tr class="g-health">' + c.slots.map((s, i) => { const k = c.bySlot[i].length; const hard = ex.slotHard[i]; return '<th class="' + (hard ? 'g-bad' : k ? 'g-ok' : 'g-empty') + '" title="' + esc(s.label + ': 시리즈 ' + k + ' · 감점 ' + hard) + '">' + (hard ? '✖' : k ? '✔' : '·') + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (const t of order) {
      const team = st.teams[t];
      const tm = ex.teamMetrics[t];
      const dim = filter.size && !filter.has(team.name);
      // 연속 길이: 슬롯 → {pos, len, home}
      const runAt = new Map();
      for (const r of tm.runs) r.slots.forEach((s, k) => runAt.set(s, { pos: k, len: r.length, home: r.home }));
      h += '<tr class="' + (dim ? 'g-dim' : '') + (focus.team === t ? ' g-focus-row' : '') + '"><th class="g-team" data-team-head="' + t + '" tabindex="0" role="rowheader" style="--tc:' + esc(team.color) + '" aria-label="' + esc(team.name + ' 구단 설정') + '" title="' + esc(team.name + ' · ' + team.stadium + ' — 눌러서 구단 설정') + '"><span class="g-swatch"></span><b>' + esc(team.name) + '</b><small>' + esc(team.stadium) + '</small>' + (app.sharedStadiums().has(team.stadium) ? '<span class="g-shared" title="공유 구장">⇄</span>' : '') + (tm.streakPenalty ? '<span class="g-hard">⟳' + tm.streakPenalty + '</span>' : '') + '</th>';
        for (let s = 0; s < S; s++) {
        const ms = cell[t][s];
        if (!ms.length) { h += '<td class="g-rest" data-drop-slot="' + s + '" title="' + esc(team.name + ' 휴식 · ' + c.slots[s].label) + '"></td>'; continue; }
        const m = ms[0];
        const x = st.matches[m];
        const isHome = x.home === team.name;
        const opp = isHome ? x.away : x.home;
        const flags = Array.from(new Set(ms.flatMap((k) => ex.matchFlags[k])));
        const v = tm.visits.find((vv) => vv.slot === s && vv.match === m);
        const run = runAt.get(s);
        const over = run && run.pos >= 3;
        let inner;
        if (cellMode === 'km') inner = '<b>' + (isHome ? 'H' : 'A') + '</b><span>' + (v && v.legTenths ? Math.round(v.legTenths / 10) : '–') + '</span>';
        else if (cellMode === 'holiday') inner = '<b>' + (isHome ? 'H' : 'A') + '</b><span>' + (isHome && c.slots[s].holiday ? c.slots[s].holiday : '') + '</span>';
        else if (cellMode === 'status') { const gs = gameStat.get(m) || { P: 0, C: 0 }; inner = '<b>' + (isHome ? 'H' : 'A') + '</b><span>' + (gs.C ? '☂' + gs.C : gs.P ? '✔' + gs.P : '') + '</span>'; }
        else inner = '<b>' + (isHome ? 'H' : 'A') + '</b><span>' + esc(opp.slice(0, 2)) + '</span>';
        const tip = team.name + (isHome ? ' 홈 vs ' : ' 원정 @ ') + opp + ' · ' + c.slots[s].label + ' · ' + x.consecutive + '연전' + (v && v.legTenths ? ' · 이동 ' + fmt.km(v.legTenths / 10) + 'km' : '') + (run ? ' · ' + (run.home ? '홈' : '원정') + ' ' + (run.pos + 1) + '/' + run.len + '연속' : '') + (flags.length ? ' · 위반 ' + flags.map((f) => f + ' ' + Score.RULE_BY_CODE[f].label).join(', ') : '') + (x.pinned ? ' · 고정' : '') + (ms.length > 1 ? ' · 같은 슬롯 ' + ms.length + '시리즈' : '');
        h += '<td class="g-cell ' + (isHome ? 'g-h' : 'g-a') + (flags.length ? ' g-viol' : '') + (over ? ' g-over' : '') + (x.pinned ? ' g-pin' : '') + (ms.length > 1 ? ' g-multi' : '') + (focusMatches.has(m) ? ' g-focus' : '') + (app.ui.selectedMatch === m ? ' g-sel' : '') + (run && run.pos === 0 ? ' g-run-start' : '') + (run && run.pos === run.len - 1 ? ' g-run-end' : '') + '" data-match="' + m + '" data-drop-slot="' + s + '" draggable="' + (!x.pinned && !app.isRunning()) + '" tabindex="0" role="gridcell" aria-label="' + esc(tip) + '" title="' + esc(tip) + '">' + inner + (flags.length ? '<i class="g-flag" aria-hidden="true">⚠</i>' : '') + (x.pinned ? '<i class="g-pinmark" aria-hidden="true">📌</i>' : '') + (run && run.pos === 0 && run.len >= 3 ? '<em class="g-runlen' + (run.len > 3 ? ' g-runlen-over' : '') + '">' + run.len + '</em>' : '') + '</td>';
      }
      for (let k = 0; k < ROW_METRICS.length; k++) {
        const mm = ROW_METRICS[k];
        const val = mval(tm, mm);
        const isOver = mm.over ? tm[mm.over] : mm.overFn ? mm.overFn(tm) : false;
        const dev = val - means[mm.key];
        h += '<td class="g-m g-m-' + mm.kind + (isOver ? ' g-m-over' : '') + stickCls(k) + '"' + stick(k) + ' title=""' + esc(mm.label + ' ' + mm.f(val) + ' · 리그 평균 ' + fmt.num1(means[mm.key]) + (isOver ? ' · 허용오차 초과' : '')) + '">' + mm.f(val) + (mm.dev ? '<small>' + (dev > 0 ? '+' : '') + (Math.abs(dev) >= 100 ? Math.round(dev) : fmt.num1(dev)) + '</small>' : '') + (isOver ? '<span class="g-overmark">▲</span>' : '') + '</td>';
      }
      h += '</tr>';
    }
    // 리그 평균 행
    h += '</tbody><tfoot><tr><th class="g-team">리그 평균</th><td colspan="' + S + '" class="g-foot">' + (c.pool.length ? '<button class="k-link" data-act="pool">미배정 ' + c.pool.length + '개 시리즈 보기</button>' : '미배정 없음') + ' · 셀: H 홈 / A 원정 · 숫자 띠 = 연속 길이(3 초과는 빗금) · ⚠ Hard 위반 · 📌 고정</td>' + ROW_METRICS.map((m, k) => '<td class="g-m' + stickCls(k) + '"' + stick(k) + '>' + fmt.num1(means[m.key]) + '</td>').join('') + '</tr></tfoot></table>';
    const scroller = host.querySelector('.g-scroll');
    const sl = scroller ? scroller.scrollLeft : 0, stp = scroller ? scroller.scrollTop : 0;
    host.innerHTML = '<div class="g-scroll" data-scroll-key="grid">' + h + '</div>';
    const ns = host.querySelector('.g-scroll');
    ns.scrollLeft = sl; ns.scrollTop = stp;
    renderPopover();
  }

  // ───────────── 머리 설정 팝오버 ─────────────
  function renderPopover() {
    const pop = $('#popover');
    if (!popover) { pop.hidden = true; return; }
    const st = app.state;
    const c = app.derived();
    let h = '';
    if (popover.kind === 'slot') {
      const i = popover.index;
      const s = c.slots[i];
      if (!s) { popover = null; pop.hidden = true; return; }
      const vs = c.ex.violations.filter((v) => v.slot === i || (v.slots && v.slots.includes(i)));
      const allPinned = c.bySlot[i].length && c.bySlot[i].every((m) => st.matches[m].pinned);
      h = '<div class="g-pop-head"><b>슬롯 설정</b> ' + esc(s.label) + '<button class="k-btn k-btn-icon k-btn-ghost" data-act="close" aria-label="닫기">✕</button></div>' +
        '<p class="k-small k-muted">' + fmt.date(s.day) + (s.consecutive > 1 ? ' ~ ' + fmt.date(s.day + s.consecutive - 1) : '') + ' · 시리즈 ' + c.bySlot[i].length + '개</p>' +
        '<div class="k-grid-3"><label class="k-field"><span>연전 수</span><input class="k-input" type="number" min="1" max="7" data-slot-f="consecutive" data-fk="pc" value="' + s.consecutive + '"></label><label class="k-field"><span>주말</span><input class="k-input" type="number" min="0" max="1" data-slot-f="weekend" value="' + s.weekend + '"></label><label class="k-field"><span>휴일 가중치</span><input class="k-input" type="number" min="0" max="9" data-slot-f="holiday" value="' + s.holiday + '"></label></div>' +
        '<div class="k-toolbar"><button class="k-btn" data-act="pinslot">' + (allPinned ? '📌 슬롯 고정 해제' : '📍 슬롯 일괄 고정') + '</button></div>' +
        (vs.length ? '<ul class="g-pop-viol">' + vs.map((v) => '<li>' + (P.RULE_ICON[v.code] || '⚠') + ' <b>' + v.code + '</b> ' + esc(v.message) + '</li>').join('') + '</ul>' : '<p>' + UI.stateChip('ok', '이 슬롯 위반 없음') + '</p>') +
        '<div class="k-slotchips">' + c.bySlot[i].map((m) => P.chip(app, m, { showLen: true })).join('') + '</div>';
    } else {
      const t = popover.index;
      const team = st.teams[t];
      if (!team) { popover = null; pop.hidden = true; return; }
      const tm = c.ex.teamMetrics[t];
      const sh = app.sharedStadiums().get(team.stadium);
      h = '<div class="g-pop-head"><b>구단 설정</b> ' + UI.teamChip(team) + '<button class="k-btn k-btn-icon k-btn-ghost" data-act="close" aria-label="닫기">✕</button></div>' +
        '<div class="k-grid-2"><label class="k-field"><span>구단명</span><input class="k-input" data-team-f="name" data-fk="tn" value="' + esc(team.name) + '"></label><label class="k-field"><span>대표 색상</span><input type="color" class="k-color" data-team-f="color" value="' + esc(team.color) + '"></label></div>' +
        '<label class="k-field"><span>구장명 (Enter로 위치 검색)</span><div class="k-inline"><input class="k-input k-w-wide" data-team-f="stadium" data-fk="ts" value="' + esc(team.stadium) + '"><button class="k-btn" data-act="search">🔍 검색</button></div></label><div class="g-cands"></div>' +
        '<div class="k-grid-2"><label class="k-field"><span>위도</span><input class="k-input" type="number" step="0.0001" data-team-f="latitude" value="' + esc(team.latitude) + '"></label><label class="k-field"><span>경도</span><input class="k-input" type="number" step="0.0001" data-team-f="longitude" value="' + esc(team.longitude) + '"></label></div>' +
        (sh ? '<p>' + UI.stateChip('info', '⇄ 공유 구장: ' + sh.join('·')) + '</p>' : '') +
        '<p class="k-small">이동 ' + fmt.km(tm.distanceKm) + 'km · ' + tm.moves + '회 · 휴일 ' + tm.holidayWeight + ' · 주말 홈 ' + tm.weekendHome + ' · 최장 연속 홈 ' + tm.maxHomeRun + ' / 원정 ' + tm.maxAwayRun + (tm.longTrips.length ? ' · 장거리 연속 원정 ' + tm.longTrips.length + '구간' : '') + '</p>' +
        '<div class="k-toolbar"><button class="k-btn" data-act="filter">이 구단만 강조</button><button class="k-btn" data-act="sched">일정표</button><button class="k-btn" data-act="route">경로 보기</button></div>';
    }
    const act = document.activeElement;
    const key = act && pop.contains(act) ? (act.dataset.teamF || act.dataset.slotF || null) : null;
    pop.innerHTML = h;
    pop.hidden = false;
    if (key) { const n = pop.querySelector('[data-team-f="' + key + '"],[data-slot-f="' + key + '"]'); if (n) n.focus({ preventScroll: true }); }
    // 위치: 대상 머리 아래
    const anchor = popover.kind === 'slot' ? document.querySelector('[data-slot-head="' + popover.index + '"]') : document.querySelector('[data-team-head="' + popover.index + '"]');
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const W = 420;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - W - 8, r.left)) + 'px';
      pop.style.top = Math.min(window.innerHeight - 120, r.bottom + 6) + 'px';
    }
  }
  const pop = $('#popover');
  on(pop, 'change', '[data-slot-f]', (e, i) => app.updateSlot(popover.index, { [i.dataset.slotF]: i.value }));
  on(pop, 'change', '[data-team-f]', (e, i) => app.updateTeam(popover.index, { [i.dataset.teamF]: i.type === 'number' ? Number(i.value) : i.value }));
  on(pop, 'keydown', '[data-team-f=stadium]', (e, i) => { if (e.key === 'Enter') { e.preventDefault(); i.dispatchEvent(new Event('change', { bubbles: true })); search(); } });
  function search() {
    const q = pop.querySelector('[data-team-f=stadium]').value;
    const t = popover.index;
    app.searchPlace(q).then((r) => {
      if (r.results.length === 1) { const x = r.results[0]; app.updateTeam(t, { stadium: x.name, latitude: x.latitude, longitude: x.longitude }); return; }
      const box = pop.querySelector('.g-cands');
      if (box) box.innerHTML = r.results.length ? r.results.map((x, k) => '<button class="k-cand" data-pick="' + k + '"><b>' + esc(x.name) + '</b> <span class="k-muted">' + esc(x.address || '') + '</span></button>').join('') + '<div class="k-small k-muted">' + (r.source === 'KAKAO' ? 'Kakao 장소 검색' : '내장 구장 사전') + (r.note ? ' — ' + esc(r.note) : '') + '</div>' : '<div class="k-muted">결과 없음</div>';
      pop._results = r.results;
    });
  }
  on(pop, 'click', '[data-pick]', (e, b) => { const x = pop._results[Number(b.dataset.pick)]; app.updateTeam(popover.index, { stadium: x.name, latitude: x.latitude, longitude: x.longitude }); });
  on(pop, 'click', '[data-act]', (e, b) => {
    const a = b.dataset.act;
    if (a === 'close') { popover = null; renderPopover(); renderGrid(); }
    else if (a === 'pinslot') { const i = popover.index; const ms = app.derived().bySlot[i]; app.pinSlot(i, !(ms.length && ms.every((m) => app.state.matches[m].pinned))); }
    else if (a === 'search') search();
    else if (a === 'filter') app.setTeamFilter([app.state.teams[popover.index].name]);
    else if (a === 'sched') { openTab('schedule'); tabMounts.get('schedule').setTeam(app.state.teams[popover.index].name); }
    else if (a === 'route') { openTab('analysis'); routeCtl && routeCtl.setTeam(app.state.teams[popover.index].name); }
  });
  on(pop, 'click', '[data-match]', (e, n) => P.seriesDialog(app, Number(n.dataset.match)));
  UI.enableDnd(pop, app);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && popover && !document.querySelector('dialog[open]')) { popover = null; renderPopover(); renderGrid(); } });

  // 격자 상호작용
  const grid = $('#grid');
  on(grid, 'click', '[data-slot-head]', (e, th) => { if (app.ui.selectedMatch != null) return; const i = Number(th.dataset.slotHead); popover = popover && popover.kind === 'slot' && popover.index === i ? null : { kind: 'slot', index: i }; renderGrid(); });
  on(grid, 'click', '[data-team-head]', (e, th) => { const i = Number(th.dataset.teamHead); popover = popover && popover.kind === 'team' && popover.index === i ? null : { kind: 'team', index: i }; renderGrid(); });
  on(grid, 'keydown', '[data-slot-head],[data-team-head]', (e, th) => { if ((e.key === 'Enter' || e.key === ' ') && app.ui.selectedMatch == null) { e.preventDefault(); th.click(); } });
  on(grid, 'click', '.g-cell[data-match]', (e, n) => { if (app.ui.selectedMatch == null) P.seriesDialog(app, Number(n.dataset.match)); });
  on(grid, 'click', '[data-sort]', (e, b) => { const k = b.dataset.sort; if (sortKey === k) { if (sortDir < 0) sortDir = 1; else sortKey = null; } else { sortKey = k; sortDir = -1; } renderGrid(); });
  on(grid, 'click', '[data-act=pool]', () => openTab('result'));
  // 셀 사이 화살표 이동
  grid.addEventListener('keydown', (e) => {
    const td = e.target.closest('td, th');
    if (!td || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const tr = td.parentElement;
    const idx = Array.from(tr.children).indexOf(td);
    let target = null;
    if (e.key === 'ArrowLeft') target = tr.children[idx - 1];
    if (e.key === 'ArrowRight') target = tr.children[idx + 1];
    if (e.key === 'ArrowUp' && tr.previousElementSibling) target = tr.previousElementSibling.children[idx];
    if (e.key === 'ArrowDown' && tr.nextElementSibling) target = tr.nextElementSibling.children[idx];
    if (target) { e.preventDefault(); if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1'); target.focus(); }
  });
  UI.enableDnd(grid, app);

  // ───────────── 상단 도구 ─────────────
  $('#modes').innerHTML = '<span class="k-small k-muted">셀 표시</span>' + MODES.map((m) => '<button class="g-mode" data-mode="' + m.id + '" aria-pressed="false">' + m.label + '</button>').join('') +
    '<span class="k-sep"></span><span class="k-small k-muted">구단 강조</span><span id="filters"></span>';
  function renderModes() {
    document.querySelectorAll('.g-mode').forEach((b) => { b.classList.toggle('k-on', b.dataset.mode === cellMode); b.setAttribute('aria-pressed', String(b.dataset.mode === cellMode)); });
    $('#filters').innerHTML = app.state.teams.map((t) => '<button class="k-fbtn' + (app.ui.teamFilter.has(t.name) ? ' k-on' : '') + '" data-filter="' + esc(t.name) + '" style="--tc:' + esc(t.color) + '" aria-pressed="' + app.ui.teamFilter.has(t.name) + '">' + esc(t.name) + '</button>').join('') + (app.ui.teamFilter.size ? '<button class="k-link" data-filter-clear>해제</button>' : '');
  }
  on($('#modes'), 'click', '[data-mode]', (e, b) => { cellMode = b.dataset.mode; renderModes(); renderGrid(); });
  on($('#modes'), 'click', '[data-filter]', (e, b) => app.toggleTeamFilter(b.dataset.filter));
  on($('#modes'), 'click', '[data-filter-clear]', () => app.setTeamFilter([]));
  P.badge($('#badge'), app);
  P.undoBar($('#undo'), app);

  // ───────────── 하단 시트 ─────────────
  let routeCtl = null;
  const TABS = [
    { id: 'teams', label: '구단·지도', mount: (el) => P.teams(el, app) },
    { id: 'distance', label: '거리 행렬', mount: (el) => P.distance(el, app) },
    { id: 'season', label: '일정 골격·슬롯', mount: (el) => { el.innerHTML = '<div class="k-grid-2 g-two"><div class="a"></div><div class="b"></div></div>'; P.season(el.querySelector('.a'), app); P.slots(el.querySelector('.b'), app); } },
    { id: 'series', label: '시리즈', mount: (el) => P.series(el, app) },
    { id: 'events', label: '이벤트', mount: (el) => P.events(el, app) },
    { id: 'review', label: '검토·엔진', mount: (el) => { el.innerHTML = '<div class="k-grid-2 g-two"><div class="a"></div><div class="b"></div></div>'; P.review(el.querySelector('.a'), app); P.solver(el.querySelector('.b'), app); } },
    { id: 'result', label: '위반·풀', mount: (el) => { el.innerHTML = '<div class="k-grid-2 g-two"><div class="a"></div><div class="b"></div></div>'; P.violations(el.querySelector('.a'), app, { autoOpen: true }); P.pool(el.querySelector('.b'), app); } },
    { id: 'calendar', label: '캘린더', mount: (el) => P.calendar(el, app, { onSeriesClick: (m) => P.seriesDialog(app, m) }) },
    { id: 'quality', label: '지표·Soft·스냅샷', mount: (el) => { el.innerHTML = '<div class="a"></div><div class="k-grid-2 g-two"><div class="b"></div><div class="c"></div></div>'; P.metrics(el.querySelector('.a'), app); P.softBreakdown(el.querySelector('.b'), app); P.snapshots(el.querySelector('.c'), app); } },
    { id: 'analysis', label: '분석', mount: (el) => { el.innerHTML = '<div class="a"></div><h4 class="k-subhead">이동 경로</h4><div class="b"></div>'; P.chartsPanel(el.querySelector('.a'), app, { width: 460, wideWidth: 1100 }); routeCtl = P.routeMap(el.querySelector('.b'), app, { width: 460 }); } },
    { id: 'ops', label: '경기 기록·재편성', mount: (el) => { el.innerHTML = '<div class="k-grid-2 g-two"><div><h4 class="k-subhead">경기 기록</h4><div class="a"></div></div><div><h4 class="k-subhead">진행 현황</h4><div class="b"></div></div></div><div class="c"></div>'; P.games(el.querySelector('.a'), app); P.progress(el.querySelector('.b'), app); P.reschedule(el.querySelector('.c'), app); } },
    { id: 'schedule', label: '구단 일정표', mount: (el) => P.teamSchedule(el, app) },
    { id: 'data', label: '설정·데이터', mount: (el) => { el.innerHTML = '<div class="a"></div><h4 class="k-subhead">데이터</h4><div class="b"></div>'; P.settings(el.querySelector('.a'), app); P.data(el.querySelector('.b'), app); } }
  ];
  const tabMounts = new Map();
  let activeTab = null;
  $('#tabs').innerHTML = TABS.map((t) => '<button role="tab" class="g-tab" data-tab="' + t.id + '" aria-selected="false">' + esc(t.label) + '</button>').join('') + '<button class="g-tab g-collapse" data-tab-close title="시트 접기">▾ 접기</button>';
  function openTab(id) {
    const t = TABS.find((x) => x.id === id);
    if (!t) return;
    if (!tabMounts.has(id)) {
      const host = document.createElement('div');
      host.className = 'g-pane';
      $('#sheet-body').appendChild(host);
      const ret = t.mount(host);
      tabMounts.set(id, Object.assign({ host }, ret || {}));
    }
    for (const [k, v] of tabMounts) v.host.hidden = k !== id;
    activeTab = id;
    document.body.classList.add('g-sheet-open');
    document.querySelectorAll('.g-tab[data-tab]').forEach((b) => { b.classList.toggle('k-on', b.dataset.tab === id); b.setAttribute('aria-selected', String(b.dataset.tab === id)); });
  }
  function closeSheet() { activeTab = null; document.body.classList.remove('g-sheet-open'); document.querySelectorAll('.g-tab[data-tab]').forEach((b) => { b.classList.remove('k-on'); b.setAttribute('aria-selected', 'false'); }); }
  on($('#tabs'), 'click', '[data-tab]', (e, b) => (activeTab === b.dataset.tab ? closeSheet() : openTab(b.dataset.tab)));
  on($('#tabs'), 'click', '[data-tab-close]', closeSheet);
  // 시트 높이 조절
  const splitter = $('#splitter');
  splitter.addEventListener('pointerdown', (e) => {
    splitter.setPointerCapture(e.pointerId);
    const move = (ev) => { const h = Math.max(160, Math.min(window.innerHeight - 220, window.innerHeight - ev.clientY)); document.documentElement.style.setProperty('--sheet-h', h + 'px'); };
    const up = () => { splitter.removeEventListener('pointermove', move); splitter.removeEventListener('pointerup', up); };
    splitter.addEventListener('pointermove', move);
    splitter.addEventListener('pointerup', up);
  });
  splitter.addEventListener('keydown', (e) => {
    const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sheet-h'), 10) || 380;
    if (e.key === 'ArrowUp') { e.preventDefault(); document.documentElement.style.setProperty('--sheet-h', Math.min(window.innerHeight - 220, cur + 40) + 'px'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); document.documentElement.style.setProperty('--sheet-h', Math.max(160, cur - 40) + 'px'); }
  });

  // 탐색
  app.setNavigator((target) => {
    const map = { teams: 'teams', distance: 'distance', season: 'season', slots: 'season', series: 'series', events: 'events', review: 'review', settings: 'data' };
    if (target === 'result') { closeSheet(); return; }
    openTab(map[target] || target);
  });
  // 위반 클릭 → 격자 열/행으로 스크롤
  app.subscribe((ch) => {
    if (!ch.tags.has('focus') || !ch.focus) return;
    setTimeout(() => {
      const f = ch.focus;
      const sc = document.querySelector('.g-scroll');
      let el = null;
      if (f.match != null) el = document.querySelector('.g-cell[data-match="' + f.match + '"]');
      if (!el && f.slot != null) el = document.querySelector('[data-slot-head="' + f.slot + '"]');
      if (el && sc) { const r = el.getBoundingClientRect(), sr = sc.getBoundingClientRect(); sc.scrollLeft += r.left - sr.left - sr.width / 2; el.classList.add('g-flash'); setTimeout(() => el.classList.remove('g-flash'), 1300); }
    }, 30);
  });

  let pend = null;
  app.subscribe((ch) => {
    if (ch.tags.has('persist') && ch.tags.size === 1) return;
    if (ch.tags.has('filter') || ch.tags.has('teams')) renderModes();
    if (ch.tags.has('live')) { if (!pend) pend = setTimeout(() => { pend = null; renderGrid(); }, 250); return; }
    renderGrid();
  });
  window.addEventListener('resize', () => renderPopover());
  app.bindShortcuts();
  renderModes();
  renderGrid();
})();
