/*
 * alt-a 편성 스튜디오 — ④ 품질·배포
 * 왼쪽: 보기 목록(표·차트·배포) / 가운데: 선택한 보기 / 오른쪽: 선택한 구단 카드
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Score, Dates } = KBO;
  const app = () => S.app;
  const D = () => S.app.derived();
  const C = () => KBO.Chart;

  const VIEWS = [
    { id: 'metrics', group: '표', label: '구단 지표 비교표', icon: 'table', ref: 'FR-Q1·Q2' },
    { id: 'soft', group: '표', label: 'Soft 분해', icon: 'rule', ref: 'FR-Q3' },
    { id: 'a1', group: '필수 차트', label: '총 이동거리', icon: 'chart', ref: 'FR-A1' },
    { id: 'a2', group: '필수 차트', label: '이동·휴일·주말 비교', icon: 'chart', ref: 'FR-A2' },
    { id: 'a3', group: '필수 차트', label: '홈/원정 흐름', icon: 'grid', ref: 'FR-A3' },
    { id: 'a4', group: '선택 차트', label: '누적 이동거리', icon: 'chart', ref: 'FR-A4', f: 'A4' },
    { id: 'a5', group: '선택 차트', label: '상대 매트릭스', icon: 'grid', ref: 'FR-A5', f: 'A5' },
    { id: 'a8', group: '선택 차트', label: '주중 이동 (참고)', icon: 'chart', ref: 'FR-A8', f: 'A8' },
    { id: 'a9', group: '선택 차트', label: '혹서기 부담', icon: 'chart', ref: 'FR-A9', f: 'A9' },
    { id: 'a10', group: '선택 차트', label: '장거리 연속 원정', icon: 'list', ref: 'FR-A10', f: 'A10' },
    { id: 'a12', group: '선택 차트', label: '월별 홈경기 히트맵', icon: 'grid', ref: 'FR-A12', f: 'A12' },
    { id: 'sched', group: '배포', label: '구단별 일정표', icon: 'print', ref: 'FR-A11', f: 'A11' },
    { id: 'export', group: '배포', label: '내보내기', icon: 'download', ref: 'FR-D·X6' }
  ];
  const visible = () => VIEWS.filter((v) => !v.f || S.feature(v.f));

  function tms() { return D().ex.teamMetrics; }
  function league() { return D().ex.league; }

  function renderList() {
    const u = S.ui;
    let s = '<div class="pane-head"><span class="pane-title">품질 보기</span><span class="pane-desc">' + visible().length + '개 · 꺼진 선택 차트는 숨김</span></div><div class="pane-body" data-sk="q-list">';
    let g = null;
    const over = tms().filter((t) => t.overDistance).length;
    const badge = { metrics: over ? '<span class="st plain bad">' + icon('warn') + over + '</span>' : '', soft: S.dev() ? '<span class="cnt mono">' + fmt.neg(D().ex.score.soft[2]) + '</span>' : '', a3: D().ex.byCode['H0-f'].count ? '<span class="st plain bad">' + icon('x') + D().ex.byCode['H0-f'].count + '</span>' : '', export: S.ui.exported ? S.statIcon('ok') : S.statIcon('todo') };
    for (const v of visible()) {
      if (v.group !== g) { g = v.group; s += '<div class="label">' + esc(g) + '</div>'; }
      s += '<button class="li' + (u.qv === v.id ? ' active' : '') + '" data-act="q-view" data-qv="' + v.id + '"><span class="ico">' + icon(v.icon) + '</span><span class="li-main">' + esc(v.id === 'soft' ? S.termPlain('softBreak') : v.label) + '</span><span class="xs muted mono">' + esc(v.ref.replace(/FR-/g, '')) + '</span>' + (badge[v.id] || '') + '</button>';
    }
    s += '<div class="list-sep"></div><div class="label">구단</div><div class="tf">' + app().state.teams.map((t) => '<button class="' + (u.team === t.name ? 'on' : '') + '" data-act="q-team" data-team="' + esc(t.name) + '"><i class="sw" style="background:' + esc(t.color) + '"></i>' + esc(t.name) + '<span class="ck">' + (u.team === t.name ? icon('check') : '') + '</span></button>').join('') + '</div>';
    return s + '</div>';
  }

  // ───────── 지표 비교표 ─────────
  const COLS = [
    { k: 'distanceKm', h: '총 이동거리', u: 'km', score: true, f: (v) => fmt.km(v), over: 'overDistance', mean: () => league().meanDistanceKm },
    { k: 'moves', h: '이동 횟수', u: '회', score: true, f: fmt.int, over: 'overMoves', mean: () => league().meanMoves },
    { k: 'holidayWeight', h: '휴일 가중치', u: '', score: true, f: fmt.int, over: 'overHoliday', mean: () => league().meanHoliday },
    { k: 'weekendHome', h: '주말 홈', u: '시리즈', f: fmt.int, mean: () => league().meanWeekendHome },
    { k: 'weekdayMoves', h: '주중 이동', u: '회', f: fmt.int },
    { k: 'maxHomeRun', h: '최장 연속 홈', u: '', f: fmt.int, bad: (v) => v > 3 },
    { k: 'maxAwayRun', h: '최장 연속 원정', u: '', f: fmt.int, bad: (v) => v > 3 },
    { k: 'holidayHomeGames', h: '공휴일 홈', u: '경기', f: fmt.int }
  ];
  function metricsTable() {
    const u = S.ui;
    const rows = tms().slice();
    const sk = u.sort.key, dir = u.sort.dir;
    rows.sort((a, b) => (sk === 'name' ? a.name.localeCompare(b.name) : (a[sk] - b[sk])) * dir);
    const th = (c, grp) => '<th class="' + (sk === c.k ? 'sorted ' : '') + (grp === 'score' ? 'grp-score' : 'grp-ref') + '" data-act="q-sort" data-k="' + c.k + '" aria-sort="' + (sk === c.k ? (dir > 0 ? 'ascending' : 'descending') : 'none') + '">' + esc(c.h) + (c.u ? ' <span class="muted xs">' + c.u + '</span>' : '') + (sk === c.k ? '<span class="arrow">' + (dir > 0 ? '▲' : '▼') + '</span>' : '') + '</th>';
    let s = '<table class="mt"><thead><tr><th></th><th colspan="3" class="grp-score" style="text-align:center">채점 지표 ' + (S.dev() ? '(S1~S3 분산 대상)' : '(엔진이 고르게 맞추는 값)') + '</th><th colspan="5" class="grp-ref bl" style="text-align:center">참고 지표 (점수 미반영)</th></tr><tr>' +
      '<th data-act="q-sort" data-k="name" class="' + (sk === 'name' ? 'sorted' : '') + '">구단</th>' + COLS.slice(0, 3).map((c) => th(c, 'score')).join('') + COLS.slice(3).map((c, i) => th(c, 'ref').replace('<th class="', '<th class="' + (i === 0 ? 'bl ' : ''))).join('') + '</tr></thead><tbody>';
    for (const t of rows) {
      s += '<tr class="' + (u.team === t.name ? 'sel' : '') + '" data-act="q-team" data-team="' + esc(t.name) + '"><td>' + S.team(t.name) + '</td>';
      COLS.forEach((c, i) => {
        const v = t[c.k];
        const over = c.over && t[c.over];
        const bad = c.bad && c.bad(v);
        const dev = c.mean ? v - c.mean() : null;
        s += '<td class="' + (over || bad ? 'over ' : '') + (i >= 3 ? 'ref' : '') + (i === 3 ? ' bl' : '') + '">' + c.f(v) + (dev != null && i < 3 ? '<span class="dev">' + fmt.signed1(dev) + '</span>' : '') + '</td>';
      });
      s += '</tr>';
    }
    s += '</tbody><tfoot><tr><td>리그 평균</td>' + COLS.map((c, i) => '<td class="' + (i === 3 ? 'bl' : '') + '">' + (c.mean ? fmt.num1(c.mean()) : '') + '</td>').join('') + '</tr></tfoot></table>';
    return s;
  }
  /** ④ 지표 간략 차트 2개 (W18). w = SVG 기준 폭 */
  S.metricsCharts = function (w) {
    const L = league(), T = tms(), sel = S.ui.team;
    const distance = S.mchart.distanceBars({ items: T.map((t) => ({ name: t.name, value: t.distanceKm, over: t.overDistance })), mean: L.meanDistanceKm, tol: 300, sel, width: w, rowH: S.tall ? 28 : 18, title: '구단별 총 이동거리' });
    const dots = S.mchart.dotRows({ sel, width: w, rowH: S.tall ? 100 : 66, title: '이동 횟수 · 휴일 가중치 · 주말 홈', rows: [
      { title: '이동 횟수', items: T.map((t) => ({ name: t.name, value: t.moves, over: t.overMoves })), mean: L.meanMoves, tol: 2, fmt: (v) => fmt.num1(v) + '회' },
      { title: '휴일 가중치', items: T.map((t) => ({ name: t.name, value: t.holidayWeight, over: t.overHoliday })), mean: L.meanHoliday, tol: 1.5 },
      { title: '주말 홈 (참고)', items: T.map((t) => ({ name: t.name, value: t.weekendHome, over: false })), mean: L.meanWeekendHome, tol: 2 }
    ] });
    return [
      { id: 'distance', title: '차트 1 · 구단별 총 이동거리', note: '점선 = 평균 · 띠 = ±300km · 빗금 ▲ = 초과', svg: distance },
      { id: 'dots', title: '차트 2 · 이동 횟수 · 휴일 가중치 · 주말 홈', note: '띠 = 평균 ± 허용오차 · 빨간 ▲ = 초과', svg: dots }
    ];
  };
  /** 지표 화면 배치. 표준: 1440은 표 아래 차트 2개 나란히, 1800 이상은 표 오른쪽에 차트 세로로. opt-2는 이 함수를 바꾼다. */
  S.metricsLayout = function (table, charts) {
    const box = (c) => '<div class="blk mc-box" data-chart="' + c.id + '"><div class="blk-head">' + esc(c.title) + '<span class="r small muted">' + esc(c.note) + '</span></div><div class="blk-body">' + c.svg + '</div></div>';
    return '<div class="q-met' + (S.wide ? ' wide' : '') + '"><div class="q-met-table">' + table + '</div><div class="q-met-charts">' + charts.map(box).join('') + '</div></div>';
  };
  function renderMetrics() {
    const mainW = window.innerWidth - (S.wide ? 260 : 232) - (S.ui.inspOff ? 30 : S.wide ? 360 : 320);
    const w = S.wide ? Math.round(mainW * 0.46 - 40) : Math.round((mainW - 24 - 12) / 2 - 20);
    let s = S.paneHead('구단 지표 비교표', '채점 지표는 엔진이 고르게 맞추는 값, 참고 지표는 보기만 합니다. ▲ = 허용오차 초과. 행·막대·점을 누르면 그 구단을 강조합니다.', '<span class="tag score">채점</span><span class="tag ref">참고</span>');
    s += '<div class="pane-body" data-sk="q-metrics">' + S.metricsLayout(metricsTable(), S.metricsCharts(w)) +
      '<div class="small muted q-met-foot">' + esc(S.plain('허용오차: 이동거리 평균 ±300km(S2), 이동 횟수 평균 ±2회(S1), 휴일 가중치 평균 ±1.5(S3). 열 머리글을 누르면 정렬합니다.')) + '</div></div>';
    return s;
  }

  // ───────── Soft 분해 ─────────
  function renderSoft() {
    const ex = D().ex, sb = ex.softBreakdown, u = S.ui;
    const lv = u.softLevel || 'S2';
    const tiles = Score.SOFT_RULES.map((r) => '<button class="tile' + (lv === r.code ? ' on' : '') + '" data-act="q-soft" data-lv="' + r.code + '"><span class="k">' + (S.dev() ? r.code + ' · ' + esc(r.label) : esc(S.ruleName(r.code))) + '</span><span class="v">' + (S.dev() ? fmt.neg(sb[r.code].total) : (sb[r.code].total ? '감점 ' + fmt.int(Math.abs(sb[r.code].total)) : '0')) + '</span></button>').join('');
    let s = S.paneHead(S.term('softBreak'), '공정성·이동 부담 점수가 어느 구단의 어떤 값에서 나오는지 연결합니다.');
    s += '<div class="pane-body pad" data-sk="q-soft"><div class="tiles">' + tiles + '</div>';
    const items = (sb[lv].items || []).slice();
    const desc = { S0: '미배정 시리즈 수. 슬롯이 없거나 더미 슬롯에 놓인 시리즈.', S1: 'Σ ⌊|이동 횟수 − 평균| / 2⌋² × 100', S2: 'Σ (max(0, |이동거리 − 평균| − 300km))², 0.1km 정수 연산', S3: 'Σ ⌊|휴일 가중치 − 평균| / 1.5⌋²', S4: 'Σ 구단 이동거리 (km, 버림)' }[lv];
    const plainDesc = { S0: '슬롯에 놓이지 못한 시리즈 수입니다. 0이어야 합니다.', S1: '구단별 이동 횟수가 리그 평균에서 2회 넘게 벗어날수록 감점합니다.', S2: '구단별 총 이동거리가 리그 평균에서 300km 넘게 벗어날수록 감점합니다.', S3: '구단별 휴일 가중치 합이 평균에서 1.5 넘게 벗어날수록 감점합니다.', S4: '리그 전체 이동거리 합입니다. 작을수록 좋습니다.' }[lv];
    s += '<div class="small muted" style="margin:10px 0 6px">' + (S.dev() ? '<b style="color:var(--text)">' + lv + '</b> = ' + esc(desc) : '<b style="color:var(--text)">' + esc(S.ruleName(lv)) + '</b> — ' + esc(plainDesc)) + '</div>';
    if (lv === 'S0') {
      s += items.length ? items.map((x) => '<div class="hbar">' + esc(app().matchLabel(x.match)) + '</div>').join('') : '<div class="empty"><b>' + icon('check') + ' 미배정 시리즈 없음</b>모든 시리즈가 슬롯에 놓였습니다.</div>';
    } else {
      const val = (x) => (lv === 'S4' ? x.value : x.contrib);
      const max = Math.max(1, ...items.map((x) => Math.abs(val(x))));
      items.sort((a, b) => Math.abs(val(b)) - Math.abs(val(a)));
      s += '<div class="hbar" style="font-weight:700;color:var(--text-3);font-size:10.5px"><span>구단</span><span>' + (lv === 'S4' ? '이동거리' : '기여 (감점)') + '</span><span class="num">값</span><span class="num">평균 대비</span><span class="num">' + (lv === 'S4' ? '' : '감점') + '</span></div>';
      for (const x of items) {
        const t = app().state.teams[x.team];
        const v = val(x);
        s += '<div class="hbar" data-act="q-team" data-team="' + esc(t.name) + '" style="cursor:pointer;' + (S.ui.team === t.name ? 'background:var(--sel)' : '') + '"><span>' + S.team(t.name) + '</span><span class="bar"><i class="' + (lv === 'S4' ? '' : 'neg') + '" style="width:' + (Math.abs(v) / max * 100).toFixed(1) + '%"></i></span>' +
          '<span class="num">' + (lv === 'S2' || lv === 'S4' ? fmt.km(x.value) : fmt.num1(x.value)) + '</span><span class="num">' + (x.dev != null ? fmt.signed1(x.dev) : '') + '</span><span class="num">' + (lv !== 'S4' ? '<b style="color:' + (v ? 'var(--bad)' : 'var(--text-3)') + '">' + (v ? '−' + fmt.int(v) : '0') + '</b>' : '') + '</span></div>';
      }
    }
    return s + '</div>';
  }

  // ───────── 차트 ─────────
  const W = () => (S.wide ? 1180 : 820);
  function chartWrap(title, desc, svg, extra) {
    return S.paneHead(title, desc) + '<div class="pane-body" data-sk="q-chart"><div class="chart-box">' + svg + '</div>' + (extra || '') + '</div>';
  }
  function a1() {
    const L = league();
    const items = tms().map((t) => ({ label: t.name, value: t.distanceKm, color: t.team != null ? app().state.teams[t.team].color : '#1F5FD6', flag: t.overDistance, key: t.name, note: t.overDistance ? '허용오차 초과' : '' }));
    return chartWrap('총 이동거리', '구단별 1차 편성 총 이동거리. 점선 = 리그 평균, 띠 = ±300km 허용오차, 빗금·▲ = 초과.', C().bar({ items, width: W(), height: S.wide ? 520 : 400, mean: L.meanDistanceKm, band: { lo: L.meanDistanceKm - 300, hi: L.meanDistanceKm + 300, label: '허용오차 ±300km' }, unit: 'km', format: (v) => fmt.km(v), yZero: false, title: '구단별 총 이동거리' }));
  }
  function a2() {
    const L = league(), T = tms();
    const mk = (title, key, mean, tol, unit) => '<div class="blk"><div class="blk-head">' + esc(title) + '<span class="r small muted">평균 ' + fmt.num1(mean) + (tol ? ' · ±' + tol : '') + '</span></div><div class="blk-body">' +
      C().bar({ items: T.map((t) => ({ label: t.name, value: t[key], color: app().state.teams[t.team].color, flag: tol ? Math.abs(t[key] - mean) >= tol : false, key: t.name })), width: W(), height: S.wide ? 200 : 140, mean, band: tol ? { lo: mean - tol, hi: mean + tol, label: '±' + tol } : null, unit, yZero: false, title }) + '</div></div>';
    return S.paneHead('이동·휴일·주말 비교', '세 지표를 같은 구단 순서로 나란히 봅니다. 주말 홈은 참고 지표입니다.') +
      '<div class="pane-body pad" data-sk="q-chart"><div class="small-multi" style="grid-template-columns:minmax(0,1fr);gap:8px">' + mk('이동 횟수 (채점' + (S.dev() ? ' S1' : '') + ')', 'moves', L.meanMoves, 2, '회') + mk('휴일 가중치 합 (채점' + (S.dev() ? ' S3' : '') + ')', 'holidayWeight', L.meanHoliday, 1.5, '') + mk('주말 홈 시리즈 (참고)', 'weekendHome', L.meanWeekendHome, 0, '') + '</div></div>';
  }
  function a3() {
    const c = D(), T = tms(), u = S.ui;
    let s = S.paneHead('홈/원정 흐름', '구단 × 슬롯. 진한 칸 = 홈, 옅은 칸 = 원정. 빨간 테두리와 숫자 = 3연속 초과(H0-f).', '<span class="legend"><span><i style="background:var(--navy)"></i>홈</span><span><i style="background:#D9DFE9"></i>원정</span><span><i style="box-shadow:inset 0 0 0 2px var(--bad)"></i>초과</span></span>');
    s += '<div class="pane-body pad" data-sk="q-chart"><table class="has"><colgroup><col style="width:72px">' + c.slots.map(() => '<col>').join('') + '<col style="width:64px"></colgroup><thead><tr><td></td>' + c.slots.map((sl, i) => '<td>' + (i % 4 === 0 ? Dates.fmtShort(sl.day) : '') + '</td>').join('') + '<td></td></tr></thead><tbody>';
    for (const t of T) {
      const bySlot = new Map(t.visits.map((v) => [v.slot, v]));
      const runAt = new Map();
      for (const r of t.runs) r.slots.forEach((x, k) => runAt.set(x, { len: r.length, k }));
      s += '<tr class="' + (u.team === t.name ? 'sel' : '') + '"><th data-act="q-team" data-team="' + esc(t.name) + '" style="cursor:pointer">' + S.team(t.name) + '</th>';
      for (const sl of c.slots) {
        const v = bySlot.get(sl.index);
        if (!v) { s += '<td><div class="c x"></div></td>'; continue; }
        const ra = runAt.get(sl.index);
        const over = ra && ra.k >= 3;
        s += '<td><div class="c ' + (v.home ? 'h' : 'a') + (over ? ' over' : '') + '" title="' + esc(t.name + ' ' + Dates.fmtDate(sl.day) + ' ' + (v.home ? '홈' : '원정') + ' vs ' + app().state.teams[v.opp].name + (ra ? ' · ' + (ra.k + 1) + '연속째' : '')) + '">' + (over ? ra.k + 1 : '') + '</div></td>';
      }
      s += '<td style="width:58px;padding-left:6px" class="small mono" title="최장 연속 홈 · 원정 시리즈">홈' + t.maxHomeRun + '·원' + t.maxAwayRun + '</td></tr>';
    }
    return s + '</tbody></table><div class="small muted" style="margin-top:8px">오른쪽 숫자는 최장 연속 홈/원정 시리즈 수입니다.</div></div>';
  }
  function a4() {
    const c = D(), u = S.ui;
    const series = tms().map((t) => {
      const vals = []; let cum = 0; const bySlot = new Map(t.visits.map((v) => [v.slot, v]));
      for (const sl of c.slots) { const v = bySlot.get(sl.index); if (v) cum = v.cumTenths / 10; vals.push(cum); }
      return { label: t.name, color: app().state.teams[t.team].color, values: vals, emphasis: u.team === t.name, dim: !!u.team && u.team !== t.name };
    });
    return chartWrap('누적 이동거리', '시즌 진행에 따른 구단별 누적 이동거리(km). 왼쪽에서 구단을 고르면 강조합니다.', C().line({ series, xLabels: c.slots.map((s) => Dates.fmtShort(s.day)), width: W(), height: S.wide ? 520 : 400, format: (v) => fmt.km(v), title: '누적 이동거리' }));
  }
  function a5() {
    const st = app().state;
    const names = st.teams.map((t) => t.name);
    const vals = names.map((h) => names.map((a) => (h === a ? null : st.matches.filter((m) => m.home === h && m.away === a).reduce((s, m) => s + m.consecutive, 0))));
    return chartWrap('상대 매트릭스', '행 = 홈 구단, 열 = 원정 구단. 칸 = 그 홈에서 치르는 경기 수. 구단쌍 합은 15경기(9:6 분배).', C().heatmap({ rows: names, cols: names, values: vals, cellW: S.wide ? 84 : 60, cellH: S.wide ? 40 : 32, labelW: 56, title: '상대 매트릭스' }));
  }
  function a8() {
    const items = tms().map((t) => ({ label: t.name, value: t.weekdayMoves, color: app().state.teams[t.team].color, key: t.name }));
    const mean = items.reduce((a, b) => a + b.value, 0) / items.length;
    return chartWrap('주중 이동 (참고)', '주중 슬롯 → 다음 주말 슬롯 사이 이동 횟수. ' + (S.dev() ? 'Constants.WEEKDAY_MOVE(1.5)는' : '이 값은') + ' 점수에 반영되지 않습니다.', C().bar({ items, width: W(), height: S.wide ? 480 : 380, mean, band: { lo: mean - 1.5, hi: mean + 1.5, label: '±1.5 (참고)' }, unit: '회', yZero: false, title: '주중 이동' }));
  }
  function a9() {
    const items = tms().map((t) => ({ label: t.name + (t.name === '키움' ? ' (돔)' : ''), value: t.summerAwayGames, color: app().state.teams[t.team].color, key: t.name, note: fmt.km(t.summerMoveKm) + 'km' }));
    return chartWrap('혹서기 부담', '7~8월 원정 경기 수. 고척돔(키움) 홈은 혹서기 부담이 작습니다.', C().bar({ items, width: W(), height: S.wide ? 480 : 380, unit: '경기', title: '혹서기 원정 경기' }));
  }
  function a10() {
    const c = D();
    const rows = [];
    for (const t of tms()) for (const lt of t.longTrips) rows.push({ t, lt });
    rows.sort((a, b) => b.lt.tenths - a.lt.tenths);
    return S.paneHead('장거리 연속 원정', '연속 원정 2시리즈 이상이면서 구간 거리 합이 600km를 넘는 구간.') + '<div class="pane-body" data-sk="q-chart"><table class="mt"><thead><tr><th>구단</th><th>구간</th><th>시리즈</th><th>거리 합</th></tr></thead><tbody>' +
      rows.map((r) => '<tr data-act="q-team" data-team="' + esc(r.t.name) + '"><td>' + S.team(r.t.name) + '</td><td style="text-align:left">' + esc(Dates.fmtDate(c.slots[r.lt.slots[0]].day) + ' ~ ' + Dates.fmtDate(c.slots[r.lt.slots[r.lt.slots.length - 1]].day)) + '</td><td>' + r.lt.series + '</td><td class="over">' + fmt.km(r.lt.tenths / 10) + 'km</td></tr>').join('') + '</tbody></table></div>';
  }
  function a12() {
    const c = D(), st = app().state;
    const months = [3, 4, 5, 6, 7, 8];
    const vals = tms().map((t) => months.map((mo) => t.visits.filter((v) => v.home && c.slots[v.slot].month === mo).reduce((a, v) => a + st.matches[v.match].consecutive, 0)));
    return chartWrap('월별 홈경기 히트맵', '구단 × 월 홈경기 수.', C().heatmap({ rows: tms().map((t) => t.name), cols: months.map((m) => m + '월'), values: vals, cellW: S.wide ? 120 : 90, cellH: 34, labelW: 56, title: '월별 홈경기' }));
  }

  // ───────── 구단별 일정표 ─────────
  function renderSched() {
    const st = app().state, c = D();
    const name = S.ui.team || st.teams[0].name;
    const t = tms().find((x) => x.name === name);
    let s = S.paneHead('구단별 일정표', '구단 운영팀 배포용. 인쇄하면 이 미리보기 모양으로 나옵니다.', '<button class="btn sm" data-act="print">' + icon('print') + '인쇄</button>' + (S.feature('D4') ? '<button class="btn sm" data-act="export" data-kind="csv">' + icon('table') + 'CSV</button>' : ''));
    s += '<div class="pane-body paper-bg" data-sk="q-sched"><div class="paper"><h2>' + S.team(name) + ' 2025 정규시즌 1차 편성 일정</h2><div class="meta">' + esc(st.meta.name) + ' · 홈 ' + t.homeSeries + '시리즈(' + t.homeGames + '경기) · 원정 ' + t.awaySeries + '시리즈(' + t.awayGames + '경기) · 총 이동 ' + fmt.km(t.distanceKm) + 'km</div>';
    s += '<table><thead><tr><th>#</th><th>기간</th><th>연전</th><th>구분</th><th>상대</th><th>구장</th><th style="text-align:right">이동(km)</th></tr></thead><tbody>' +
      t.visits.map((v, i) => { const sl = c.slots[v.slot]; const opp = st.teams[v.opp]; const stad = st.teams[v.loc].stadium; return '<tr><td class="mono">' + (i + 1) + '</td><td>' + esc(Dates.fmtDate(sl.day) + ' ~ ' + Dates.fmtDate(sl.days[sl.days.length - 1])) + '</td><td>' + sl.consecutive + '</td><td>' + (v.home ? '<span class="home-mark">H</span> 홈' : '<span class="away-mark">A</span> 원정') + '</td><td>' + S.team(opp.name) + '</td><td>' + esc(stad) + '</td><td style="text-align:right" class="mono">' + (v.legTenths ? fmt.km(v.legTenths / 10) : '-') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    return s;
  }

  function renderExport() {
    const card = (ic, title, desc, act, kind, mock, extra) => '<div class="exp"><h5>' + icon(ic) + esc(title) + (mock ? S.mock() : '') + '</h5><p>' + esc(desc) + '</p>' + (extra || '') + '<button class="btn sm' + (kind === 'xlsx' ? ' primary' : '') + '" data-act="' + act + '" data-kind="' + kind + '">' + icon('download') + '내려받기</button></div>';
    let s = S.paneHead('내보내기', '배포본은 가져오기와 같은 시트·열 구성이라 엑셀에서 고친 뒤 다시 올릴 수 있습니다.', S.ui.exported ? S.stat('ok', '배포본 생성됨') : S.stat('todo', '배포본 미생성'));
    s += '<div class="pane-body" data-sk="q-exp"><div class="exp-list">' +
      card('sheet', '.xlsx 배포본', '슬롯·시리즈·공휴일·휴식예외일·경기없는기간·이벤트 + 안내 시트. 다시 가져오면 같은 상태가 됩니다.', 'export', 'xlsx', true) +
      card('file', '빈 양식 .xlsx', '머리글, 열 설명이 담긴 안내 시트, 예시 1행. 2025 프리셋 예시 파일 포함.', 'export', 'template', true) +
      card('bolt', '엔진 JSON', 'input_2025.json 형식(teams, distanceMatrix, calendar, matches, initialPlan). Java 엔진 입력용.', 'export', 'engine') +
      card('db', '프로젝트 JSON', '입력·배정·스냅샷·경기 기록·기능 켜기·끄기(meta.features) 전체.', 'export', 'project') +
      (S.feature('D4') ? card('table', '일정표 CSV', '날짜, 원정, 홈, 구장, 상태. 구단을 고르면 그 구단만.', 'export', 'csv', false, '<p class="small">대상: ' + esc(S.ui.team || '전체 구단') + '</p>') : '') +
      '</div>' + (function () {
        const st = app().state;
        const rows = [['슬롯', st.calendar.length, '시작일·연전·주말·휴일가중치·메모'], ['시리즈', st.matches.length, '홈·원정·연전·메모'], ['공휴일', st.settings.holidays.length, '날짜·이름'], ['휴식예외일', st.settings.restExceptions.length, '날짜·메모'], ['경기없는기간', st.settings.blackouts.length, '시작일·종료일·이름'], ['이벤트', st.events.length, '이름·유형·날짜·방식·홈·원정·구장'], ['안내', '-', '열 설명 · 시즌 골격 참고값(개막·종료·휴식 요일)']];
        return '<div style="padding:0 12px 12px"><div class="label" style="padding:4px 0 6px">.xlsx 배포본 구성 (가져오기와 같은 시트·열)</div><table class="itable" style="border:1px solid var(--line)"><thead><tr><th>시트</th><th class="num">행</th><th>열</th></tr></thead><tbody>' + rows.map((r) => '<tr><td><b>' + r[0] + '</b></td><td class="num">' + r[1] + '</td><td class="small muted">' + r[2] + '</td></tr>').join('') + '</tbody></table></div>';
      })() + '<div class="small muted" style="padding:0 12px">' + (D().ex.feasible ? '편성 가능한 상태입니다.' : S.termPlain('hardViol') + '이 있는 상태로도 내보낼 수 있지만, 배포 전에는 ③에서 위반을 없애세요.') + '</div></div>';
    return s;
  }

  // ───────── 인스펙터: 구단 카드 ─────────
  function renderInsp() {
    const u = S.ui;
    const t = tms().find((x) => x.name === u.team);
    if (!t) return { title: '구단 카드', html: '<div class="empty"><b>구단을 고르세요</b>표의 행, 차트의 막대, 왼쪽 구단 버튼을 누르면 그 구단의 지표와 흐름이 여기에 나옵니다.</div>' };
    const L = league();
    const row = (k, v, mean, over, unit) => '<dt>' + esc(k) + '</dt><dd>' + (over ? '<b style="color:var(--bad)">' + icon('warn') + v + '</b>' : '<b>' + v + '</b>') + (unit ? ' <span class="muted small">' + unit + '</span>' : '') + (mean != null ? '<span class="muted small">평균 ' + mean + '</span>' : '') + '</dd>';
    let s = '<div class="insp-sec"><div class="insp-title">' + S.team(t.name) + '</div><div class="insp-sub">' + esc(app().state.teams[t.team].stadium) + ' · 홈 ' + t.homeSeries + ' / 원정 ' + t.awaySeries + ' 시리즈</div></div>';
    s += '<div class="insp-sec"><h4>채점 지표 <span class="tag score">채점</span></h4><dl class="props">' +
      row('총 이동거리', fmt.km(t.distanceKm), fmt.km(L.meanDistanceKm), t.overDistance, 'km') +
      row('이동 횟수', t.moves, fmt.num1(L.meanMoves), t.overMoves, '회') +
      row('휴일 가중치', t.holidayWeight, fmt.num1(L.meanHoliday), t.overHoliday) + '</dl></div>';
    s += '<div class="insp-sec"><h4>참고 지표 <span class="tag ref">참고</span></h4><dl class="props">' +
      row('주말 홈/원정', t.weekendHome + ' / ' + t.weekendAway, null, false) +
      row('주중 이동', t.weekdayMoves + '회 · ' + fmt.km(t.weekdayMoveKm) + 'km', null, false) +
      row('최장 연속', '홈 ' + t.maxHomeRun + ' · 원정 ' + t.maxAwayRun, null, t.maxHomeRun > 3 || t.maxAwayRun > 3) +
      row('공휴일 홈', t.holidayHomeGames, null, false, '경기') +
      row('7~8월 원정', t.summerAwayGames, null, false, '경기') + '</dl></div>';
    const c = D();
    const bySlot = new Map(t.visits.map((v) => [v.slot, v]));
    const over = new Set(); for (const r of t.runs) if (r.length > 3) r.slots.slice(3).forEach((x) => over.add(x));
    s += '<div class="insp-sec"><h4>홈/원정 흐름<span class="r">45 슬롯</span></h4><div class="mini-strip">' + c.slots.map((sl) => { const v = bySlot.get(sl.index); return '<i class="' + (v && v.home ? 'h' : '') + (over.has(sl.index) ? ' over' : '') + '"' + (v ? '' : ' style="background:#fff"') + '></i>'; }).join('') + '</div></div>';
    s += '<div class="insp-sec"><h4>장거리 연속 원정</h4>' + (t.longTrips.length ? t.longTrips.map((lt) => '<div class="small">' + esc(Dates.fmtDate(c.slots[lt.slots[0]].day)) + ' 부터 ' + lt.series + '시리즈 · <b>' + fmt.km(lt.tenths / 10) + 'km</b></div>').join('') : '<span class="small muted">600km 초과 구간 없음</span>') + '</div>';
    s += '<div class="insp-sec"><button class="btn sm" data-act="q-to-cal" data-team="' + esc(t.name) + '">' + icon('cal') + '③ 달력에서 이 구단만 보기</button></div>';
    return { title: '구단 카드', html: s };
  }

  S.steps[4] = {
    render() {
      S.wide = window.innerWidth >= 1800; S.tall = window.innerHeight >= 900;
      const u = S.ui;
      if (!visible().some((v) => v.id === u.qv)) u.qv = 'metrics';
      const fn = { metrics: renderMetrics, soft: renderSoft, a1, a2, a3, a4, a5, a8, a9, a10, a12, sched: renderSched, export: renderExport }[u.qv];
      if (!u.team && !S._teamDefaulted) { S._teamDefaulted = true; const top = tms().slice().sort((a, b) => b.distanceKm - a.distanceKm)[0]; u.team = top ? top.name : null; }
      const insp = renderInsp();
      return '<div class="stepview no-band">' + S.workspace({ list: renderList(), main: fn(), insp: insp.html, inspTitle: insp.title, listLabel: '품질 보기' }) + '</div>';
    },
    after() {
      document.querySelectorAll('.kc-item[data-key]').forEach((g) => { g.setAttribute('data-act', 'q-team'); g.setAttribute('data-team', g.getAttribute('data-key')); });
    }
  };

  Object.assign(S.actions, {
    'q-view': (el) => S.go({ step: 4, qv: el.dataset.qv, ops: null }),
    'q-team': (el) => S.go({ team: S.ui.team === el.dataset.team && S.ui.qv !== 'sched' ? null : el.dataset.team }),
    'q-sort': (el) => { const k = el.dataset.k; const cur = S.ui.sort; S.go({ sort: { key: k, dir: cur.key === k ? -cur.dir : (k === 'name' ? 1 : -1) } }); },
    'q-soft': (el) => S.go({ softLevel: el.dataset.lv }),
    'q-to-cal': (el) => S.go({ step: 3, teamFilter: [el.dataset.team], view: 'calendar', sel: null }),
    'print': () => { try { window.print(); } catch (e) { /* 무시 */ } }
  });
})();
