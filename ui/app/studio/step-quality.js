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
    { id: 'metrics', group: '한눈에', label: '구단별 공정성 한눈에', icon: 'table', ref: 'FR-Q1·Q2' },
    { id: 'soft', group: '한눈에', label: '공정성 점수 구성', icon: 'rule', ref: 'FR-Q3' },
    { id: 'a1', group: '기본 그래프', label: '총 이동거리', icon: 'chart', ref: 'FR-A1' },
    { id: 'a2', group: '기본 그래프', label: '이동·휴일·주말 비교', icon: 'chart', ref: 'FR-A2' },
    { id: 'a3', group: '기본 그래프', label: '홈/원정 흐름', icon: 'grid', ref: 'FR-A3' },
    { id: 'a4', group: '추가 그래프', label: '누적 이동거리', icon: 'chart', ref: 'FR-A4', f: 'A4' },
    { id: 'a5', group: '추가 그래프', label: '상대별 경기 수 표', icon: 'grid', ref: 'FR-A5', f: 'A5' },
    { id: 'a8', group: '추가 그래프', label: '주중 이동 (참고)', icon: 'chart', ref: 'FR-A8', f: 'A8' },
    { id: 'a9', group: '추가 그래프', label: '혹서기 부담', icon: 'chart', ref: 'FR-A9', f: 'A9' },
    { id: 'a10', group: '추가 그래프', label: '장거리 연속 원정', icon: 'list', ref: 'FR-A10', f: 'A10' },
    { id: 'a12', group: '추가 그래프', label: '월별 홈경기 수', icon: 'grid', ref: 'FR-A12', f: 'A12' },
    { id: 'sched', group: '배포', label: '구단별 일정표', icon: 'print', ref: 'FR-A11', f: 'A11' },
    { id: 'export', group: '배포', label: '내보내기', icon: 'download', ref: 'FR-D·X6' }
  ];
  const visible = () => VIEWS.filter((v) => !v.f || S.feature(v.f));

  function tms() { return D().ex.teamMetrics; }
  function league() { return D().ex.league; }
  /** 허용오차(손잡이). 채점 결과에서 읽는다: km(초과 감점), moves·holiday(편차 이상 감점) */
  function tols() { const sb = D().ex.softBreakdown || {}; return { km: sb.S2 ? sb.S2.toleranceKm : 300, moves: sb.S1 ? sb.S1.tolerance : 2, holiday: sb.S3 ? sb.S3.tolerance : 1.5 }; }

  function renderList() {
    const u = S.ui;
    let s = '<div class="pane-head"><span class="pane-title">공정성 보기</span><span class="pane-desc">' + visible().length + '개 · 꺼 둔 그래프는 숨김</span></div><div class="pane-body" data-sk="q-list">';
    let g = null;
    const over = tms().filter((t) => t.overDistance).length;
    const badge = { metrics: over ? '<span class="st plain bad">' + icon('warn') + over + '</span>' : '', soft: S.dev() ? '<span class="cnt mono">' + fmt.neg(D().ex.score.soft[2]) + '</span>' : '', a3: D().ex.byCode['H0-f'].count ? '<span class="st plain bad">' + icon('x') + D().ex.byCode['H0-f'].count + '</span>' : '', export: S.ui.exported ? S.statIcon('ok') : S.statIcon('todo') };
    for (const v of visible()) {
      if (v.group !== g) { g = v.group; s += '<div class="label">' + esc(g) + '</div>'; }
      s += '<button class="li' + (u.qv === v.id ? ' active' : '') + '" data-act="q-view" data-qv="' + v.id + '"><span class="ico">' + icon(v.icon) + '</span><span class="li-main">' + esc(v.id === 'soft' ? S.termPlain('softBreak') : v.label) + '</span>' + (S.dev() ? '<span class="xs muted mono">' + esc(v.ref.replace(/FR-/g, '')) + '</span>' : '') + (badge[v.id] || '') + '</button>';
    }
    s += '<div class="list-sep"></div><div class="label">구단</div><div class="tf">' + app().state.teams.map((t) => '<button class="' + (u.team === t.name ? 'on' : '') + '" data-act="q-team" data-team="' + esc(t.name) + '"><i class="sw" style="background:' + esc(t.color) + '"></i>' + esc(t.name) + '<span class="ck">' + (u.team === t.name ? icon('check') : '') + '</span></button>').join('') + '</div>';
    return s + '</div>';
  }

  // ───────── 지표 비교표 ─────────
  const COLS = [
    { k: 'distanceKm', h: '총 이동거리', u: 'km', score: true, f: (v) => fmt.km(v), over: 'overDistance', mean: () => league().meanDistanceKm },
    { k: 'moves', h: '이동 횟수', u: '회', score: true, f: fmt.int, over: 'overMoves', mean: () => league().meanMoves },
    { k: 'holidayWeight', h: '휴일 경기 점수', u: '', score: true, f: fmt.int, over: 'overHoliday', mean: () => league().meanHoliday },
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
    let s = '<table class="mt"><thead><tr><th></th><th colspan="3" class="grp-score" style="text-align:center">점수 반영 지표 ' + (S.dev() ? '(S1~S3 분산 대상)' : '(자동 편성이 고르게 맞추는 값)') + '</th><th colspan="5" class="grp-ref bl" style="text-align:center">참고 지표 (점수에 반영 안 함)</th></tr><tr>' +
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
  // ───────── opt-2 지표 대시보드 ─────────
  // 위: 요약 카드 4개 / 가운데: 차트 2×2 (펼치면 1×4 띠) / 아래: 접히는 비교표 띠.
  // 카드의 구단 칩·막대·점·표 행은 모두 data-act="q-team"이라 한 곳을 누르면 모든 곳에서 같은 구단을 강조한다.

  /** 요약 카드 값 (자가 점검도 이 값을 쓴다) */
  S.metricsSummary = function () {
    const L = league(), T = tms();
    const byDist = T.slice().sort((a, b) => b.distanceKm - a.distanceKm);
    const over = T.filter((t) => t.overDistance);
    const dev = T.map((t) => ({ t, d: t.distanceKm - L.meanDistanceKm })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    const wk = T.map((t) => t.weekendHome);
    const wMax = Math.max(...wk), wMin = Math.min(...wk);
    return {
      meanKm: L.meanDistanceKm, totalKm: L.totalKm, top: byDist[0], low: byDist[byDist.length - 1],
      over: over.map((t) => t.name), overMoves: T.filter((t) => t.overMoves).length, overHoliday: T.filter((t) => t.overHoliday).length,
      dev: dev ? { name: dev.t.name, km: dev.d, beyond: Math.max(0, Math.abs(dev.d) - tols().km) } : null,
      wMax, wMin, wGap: wMax - wMin, wMaxTeams: T.filter((t) => t.weekendHome === wMax).map((t) => t.name), wMinTeams: T.filter((t) => t.weekendHome === wMin).map((t) => t.name), wMean: L.meanWeekendHome
    };
  };

  function metricsCards() {
    const m = S.metricsSummary(), sel = S.ui.team, T = tms(), L = league();
    const st = sel ? T.find((t) => t.name === sel) : null;
    const dv = (code) => (S.dev() ? ' <code class="rc">' + code + '</code>' : '');
    const chip = (name, extra) => '<button class="q-chip' + (sel === name ? ' sel' : '') + '" data-act="q-team" data-team="' + esc(name) + '" aria-pressed="' + (sel === name) + '">' + esc(name) + (extra ? ' <span class="q-chip-v">' + esc(extra) + '</span>' : '') + '</button>';
        const selLine = (html) => '<div class="q-card-sel' + (st ? ' on' : '') + '">' + (st ? html : '<span class="muted">구단을 고르면 그 구단 값이 나옵니다</span>') + '</div>';
    const card = (id, label, value, sub, sl, attrs, cls) => '<div class="q-card' + (cls ? ' ' + cls : '') + '" data-card="' + id + '"' + (attrs || '') + '><div class="q-card-k">' + label + '</div><div class="q-card-v">' + value + '</div><div class="q-card-s">' + sub + '</div>' + selLine(sl) + '</div>';
    const sd = st ? st.distanceKm - L.meanDistanceKm : 0;
    let s = '<div class="q-cards">';
    s += card('mean', icon('chart') + '평균 이동거리 <span class="q-card-kx">리그 합계 ' + fmt.int(m.totalKm) + 'km</span>' + dv('S4'),
      '<b>' + fmt.km(m.meanKm) + '</b><span class="u">km</span>',
      '최다 ' + chip(m.top.name, S.wide ? fmt.km(m.top.distanceKm) : '') + ' 최소 ' + chip(m.low.name, S.wide ? fmt.km(m.low.distanceKm) : ''),
      st ? '<b>' + esc(st.name) + '</b> ' + fmt.km(st.distanceKm) + 'km · 평균 대비 ' + fmt.signed1(sd) : '',
      ' data-v="' + m.meanKm.toFixed(1) + '" data-total="' + m.totalKm + '"');
    s += card('over', icon('warn') + '평균보다 ' + tols().km + 'km 넘게 더·덜 이동하는 구단 <span class="q-card-kx">범위 밖</span>' + dv('S2'),
      '<b class="' + (m.over.length ? 'bad' : 'good') + '">' + (m.over.length ? '▲ ' : '') + m.over.length + '</b><span class="u">구단</span><span class="q-card-aside">이동 횟수 초과 ' + m.overMoves + ' · 휴일 초과 ' + m.overHoliday + '</span>',
      m.over.length ? m.over.map((n) => chip(n)).join('') : '<span class="muted">모든 구단이 범위 안</span>',
      st ? '<b>' + esc(st.name) + '</b> ' + (st.overDistance ? '<span class="bad">▲ 범위 밖 (평균 대비 ' + fmt.signed1(sd) + 'km)</span>' : '범위 안 (평균 대비 ' + fmt.signed1(sd) + 'km)') : '',
      ' data-v="' + m.over.length + '" data-teams="' + esc(m.over.join(',')) + '"', 'wide');
    s += card('dev', icon('target') + '평균과 가장 차이 나는 구단 <span class="q-card-kx">이동거리 기준</span>' + dv('S2'),
      m.dev ? '<b>' + esc(m.dev.name) + '</b><span class="q-card-num ' + (m.dev.beyond ? 'bad' : '') + '">' + fmt.signed1(m.dev.km) + '<span class="u">km</span></span>' : '-',
      m.dev ? (m.dev.beyond ? '허용 범위 밖 <b class="bad">' + fmt.km(m.dev.beyond) + 'km</b>' : '허용 범위 안') + (S.wide ? ' · 평균보다 ' + (m.dev.km < 0 ? '적음' : '많음') : '') : '',
      st ? '<b>' + esc(st.name) + '</b> ' + fmt.signed1(sd) + 'km' + (m.dev && st.name === m.dev.name ? ' · 가장 큼' : '') : '',
      m.dev ? ' data-act="q-team" data-team="' + esc(m.dev.name) + '" role="button" tabindex="0" aria-pressed="' + (sel === m.dev.name) + '" data-v="' + m.dev.km.toFixed(1) + '"' : '', 'click' + (m.dev && sel === m.dev.name ? ' sel' : ''));
    s += card('wk', icon('cal') + '주말 홈 차이 <span class="q-card-kx">참고만</span>',
      '<b>' + m.wGap + '</b><span class="u">시리즈 차이</span>',
      S.wide ? '최다 ' + m.wMax + ' (' + m.wMaxTeams.length + '구단) · 최소 ' + m.wMin + ' (' + m.wMinTeams.length + '구단)' : '최다 ' + m.wMax + ' · 최소 ' + m.wMin + ' 시리즈',
      st ? '<b>' + esc(st.name) + '</b> ' + st.weekendHome + '시리즈 (평균 ' + fmt.signed1(st.weekendHome - m.wMean) + ')' : '',
      ' data-v="' + m.wGap + '" title="' + esc('최다 ' + m.wMax + ': ' + m.wMaxTeams.join(', ') + ' / 최소 ' + m.wMin + ': ' + m.wMinTeams.join(', ')) + '"');
    return s + '</div>';
  }

  /** ④ 지표 차트 4개 (2×2). w·h = SVG 기준 크기 */
  S.metricsCharts = function (w, h, compact) {
    const L = league(), T = tms(), sel = S.ui.team;
    const one = (title, items, mean, tol, f) => S.mchart.dotRows({ sel, width: w, rowH: h, bare: true, title, rows: [{ title, items, mean, tol, fmt: f }] });
    const rowH = Math.max(9, Math.min(30, Math.floor((h - (compact ? 24 : 36)) / T.length)));
    const tolNote = (t) => '허용 범위: 평균 ±' + t + ' · ▲: 범위 밖';
    const tl = tols();
    return [
      { id: 'distance', title: '총 이동거리', code: 'S2', note: compact ? '허용 범위: 평균 ±' + tl.km + 'km · ▲ 범위 밖' : '점선: 평균 · 옅은 영역: 허용 범위(±' + tl.km + 'km) · ▲: 범위 밖', svg: S.mchart.distanceBars({ items: T.map((t) => ({ name: t.name, value: t.distanceKm, over: t.overDistance })), mean: L.meanDistanceKm, tol: tl.km, sel, width: w, rowH, ticks: !compact, title: '구단별 총 이동거리' }) },
      { id: 'moves', title: '이동 횟수', code: 'S1', note: tolNote(tl.moves + '회'), svg: one('이동 횟수', T.map((t) => ({ name: t.name, value: t.moves, over: t.overMoves })), L.meanMoves, tl.moves, (v) => fmt.num1(v) + '회') },
      { id: 'holiday', title: '휴일 경기 점수', code: 'S3', note: tolNote(tl.holiday), svg: one('휴일 경기 점수', T.map((t) => ({ name: t.name, value: t.holidayWeight, over: t.overHoliday })), L.meanHoliday, tl.holiday) },
      { id: 'weekend', title: '주말 홈 (참고만)', code: '', note: compact ? '점수에 반영 안 함' : '허용 범위: 평균 ±2 · 점수에 반영 안 함', svg: one('주말 홈', T.map((t) => ({ name: t.name, value: t.weekendHome, over: false })), L.meanWeekendHome, 2) }
    ];
  };

  /** 접힌 비교표 띠의 한 줄 요약 */
  function bandSummary() {
    const T = tms(), sel = S.ui.team;
    const st = sel ? T.find((t) => t.name === sel) : null;
    const cells = T.reduce((a, t) => a + (t.overDistance ? 1 : 0) + (t.overMoves ? 1 : 0) + (t.overHoliday ? 1 : 0) + (t.maxHomeRun > 3 ? 1 : 0) + (t.maxAwayRun > 3 ? 1 : 0), 0);
    let s = '<span class="q-band-sum' + (st ? '' : ' solo') + '">' + T.length + '구단 · 점수 반영 지표 3개 + 참고 지표 5개 · 범위 밖 칸 <b class="' + (cells ? 'bad' : '') + '">' + cells + '개</b></span>';
    if (st) {
      const v = (val, over) => (over ? '<b class="bad">▲' + val + '</b>' : '<b>' + val + '</b>');
      s += '<span class="q-band-sel" data-team="' + esc(st.name) + '">' + S.team(st.name) + ' 이동거리 ' + v(fmt.km(st.distanceKm) + 'km', st.overDistance) + ' · 이동 ' + v(st.moves + '회', st.overMoves) + ' · 휴일 ' + v(st.holidayWeight, st.overHoliday) + ' · 주말 홈 ' + v(st.weekendHome) + ' · 최장 연속 ' + v('홈 ' + st.maxHomeRun + '·원정 ' + st.maxAwayRun, st.maxHomeRun > 3 || st.maxAwayRun > 3) + '</span>';
    }
    return s;
  }

  /** 지표 화면 배치 (opt-2): 카드 / 차트 격자 / 비교표 띠 */
  S.metricsLayout = function (cards, charts, table, open) {
    const box = (c) => '<div class="blk mc-box" data-chart="' + c.id + '"><div class="blk-head"><b>' + esc(c.title) + '</b>' + (S.dev() && c.code ? '<code class="rc">' + c.code + '</code>' : '') + '<span class="r small muted">' + esc(c.note) + '</span></div><div class="blk-body">' + c.svg + '</div></div>';
    const band = '<div class="q-band' + (open ? ' open' : '') + '"><button class="q-band-head" data-act="q-mt" aria-expanded="' + open + '" aria-controls="qBandBody">' + icon(open ? 'down' : 'right') + '<b>구단별 비교표</b>' + bandSummary() + '<span class="q-band-tg">' + (open ? '접기' : '표 펼치기') + '</span></button>' +
      (open ? '<div class="q-band-body" id="qBandBody" data-sk="q-band">' + table + '</div>' : '') + '</div>';
    return '<div class="q-dash' + (open ? ' open' : '') + (S.wide ? ' wide' : '') + '">' + cards + '<div class="q-charts">' + charts.map(box).join('') + '</div>' + band + '</div>';
  };
  function renderMetrics() {
    const open = !!S.ui.mtOpen;
    const mainW = window.innerWidth - (S.wide ? 260 : 232) - (S.ui.inspOff ? 30 : S.wide ? 360 : 320);
    const bodyH = window.innerHeight - 178;
    const cardsH = S.tall ? 92 : 82, bandH = 36, pad = S.tall ? 24 : 20, gap = 8;
    let w, h;
    if (!open) {
      w = Math.round((mainW - pad - gap) / 2 - 16);
      h = Math.round((bodyH - pad - cardsH - bandH - gap * 3 - gap) / 2 - 36);
    } else {
      w = Math.round((mainW - pad - gap * 3) / 4 - 16);
      h = (S.tall ? 250 : 196) - 36;
    }
    // 실제 상자 크기를 재어 두었으면 그 값을 쓴다(after()에서 재고, 다르면 한 번 더 그린다)
    const mb = S._dashBox && S._dashBox[open ? 'open' : 'closed'];
    if (mb) { w = mb.w; h = mb.h; }
    h = Math.max(100, h);
    S._dashUsed = { open, w, h };
    let s = S.paneHead('구단별 공정성 한눈에', '요약 카드 · 그래프 4개 · 비교표. 구단을 누르면 모든 카드·그래프·표에서 그 구단을 함께 표시합니다.', '<span class="tag score">점수 반영</span><span class="tag ref">참고만</span>');
    s += '<div class="pane-body" data-sk="q-metrics">' + S.metricsLayout(metricsCards(), S.metricsCharts(w, h, open), open ? metricsTable() : '', open) + '</div>';
    return s;
  }

  // ───────── Soft 분해 ─────────
  function renderSoft() {
    const ex = D().ex, sb = ex.softBreakdown, u = S.ui;
    const lv = u.softLevel || 'S2';
    // 일반 모드 타일은 원점수 대신 읽을 수 있는 값: 일정 미정 수, 범위 밖 구단 수, 리그 이동거리
    const softPlain = (code) => {
      const b = sb[code];
      if (code === 'S0') return fmt.int(Math.abs(b.total)) + '개';
      if (code === 'S4') return fmt.int(Math.abs(b.total)) + 'km';
      const n = (b.items || []).filter((x) => x.contrib).length;
      return n ? n + '구단 범위 밖' : '모두 범위 안';
    };
    const tiles = Score.SOFT_RULES.map((r) => '<button class="tile' + (lv === r.code ? ' on' : '') + '" data-act="q-soft" data-lv="' + r.code + '"><span class="k">' + (S.dev() ? r.code + ' · ' + esc(r.label) : esc(S.ruleName(r.code))) + '</span><span class="v">' + (S.dev() ? fmt.neg(sb[r.code].total) : softPlain(r.code)) + '</span></button>').join('');
    let s = S.paneHead(S.term('softBreak'), '공정성·이동 부담 점수가 어느 구단의 어떤 값에서 나오는지 연결합니다.');
    s += '<div class="pane-body pad" data-sk="q-soft"><div class="tiles">' + tiles + '</div>';
    const items = (sb[lv].items || []).slice();
    const desc = { S0: '미배정 시리즈 수. 슬롯이 없거나 더미 슬롯에 놓인 시리즈.', S1: 'Σ ⌊|이동 횟수 − 평균| / ' + tols().moves + '⌋² × 100', S2: 'Σ (max(0, |이동거리 − 평균| − ' + tols().km + 'km))², 0.1km 정수 연산', S3: 'Σ ⌊|휴일 가중치 − 평균| / ' + tols().holiday + '⌋²', S4: 'Σ 구단 이동거리 (km, 버림)' }[lv];
    const plainDesc = { S0: '연전 기간에 들어가지 못한 시리즈 수입니다. 0이어야 합니다.', S1: '구단별 이동 횟수가 리그 평균에서 ' + tols().moves + '회 이상 벗어날수록 감점합니다.', S2: '구단별 총 이동거리가 리그 평균에서 ' + tols().km + 'km 넘게 벗어날수록 감점합니다.', S3: '구단별 휴일 경기 점수가 평균에서 ' + tols().holiday + ' 이상 벗어날수록 감점합니다.', S4: '리그 전체 이동거리 합입니다. 작을수록 좋습니다.' }[lv];
    s += '<div class="small muted" style="margin:10px 0 6px">' + (S.dev() ? '<b style="color:var(--text)">' + lv + '</b> = ' + esc(desc) : '<b style="color:var(--text)">' + esc(S.ruleName(lv)) + '</b> — ' + esc(plainDesc)) + '</div>';
    if (lv === 'S0') {
      s += items.length ? items.map((x) => '<div class="hbar">' + esc(app().matchLabel(x.match)) + '</div>').join('') : '<div class="empty"><b>' + icon('check') + ' 일정 미정 시리즈 없음</b>모든 시리즈가 연전 기간에 들어갔습니다.</div>';
    } else {
      const val = (x) => (lv === 'S4' ? x.value : x.contrib);
      const max = Math.max(1, ...items.map((x) => Math.abs(val(x))));
      items.sort((a, b) => Math.abs(val(b)) - Math.abs(val(a)));
      s += '<div class="hbar" style="font-weight:700;color:var(--text-3);font-size:10.5px"><span>구단</span><span>' + (lv === 'S4' ? '이동거리' : '차지하는 몫') + '</span><span class="num">값</span><span class="num">평균과 차이</span><span class="num">' + (lv === 'S4' || !S.dev() ? '' : '감점') + '</span></div>';
      for (const x of items) {
        const t = app().state.teams[x.team];
        const v = val(x);
        s += '<div class="hbar" data-act="q-team" data-team="' + esc(t.name) + '" style="cursor:pointer;' + (S.ui.team === t.name ? 'background:var(--sel)' : '') + '"><span>' + S.team(t.name) + '</span><span class="bar"><i class="' + (lv === 'S4' ? '' : 'neg') + '" style="width:' + (Math.abs(v) / max * 100).toFixed(1) + '%"></i></span>' +
          '<span class="num">' + (lv === 'S2' || lv === 'S4' ? fmt.km(x.value) : fmt.num1(x.value)) + '</span><span class="num">' + (x.dev != null ? fmt.signed1(x.dev) : '') + '</span><span class="num">' + (lv !== 'S4' && S.dev() ? '<b style="color:' + (v ? 'var(--bad)' : 'var(--text-3)') + '">' + (v ? '−' + fmt.int(v) : '0') + '</b>' : '') + '</span></div>';
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
    const items = tms().map((t) => ({ label: t.name, value: t.distanceKm, color: t.team != null ? app().state.teams[t.team].color : '#1F5FD6', flag: t.overDistance, key: t.name, note: t.overDistance ? '허용 범위 밖' : '' }));
    return chartWrap('총 이동거리', '구단별 1차 편성 총 이동거리. 점선: 리그 평균 · 옅은 영역: 허용 범위 ±' + tols().km + 'km · ▲: 범위 밖.', C().bar({ items, width: W(), height: S.wide ? 520 : 400, mean: L.meanDistanceKm, band: { lo: L.meanDistanceKm - tols().km, hi: L.meanDistanceKm + tols().km, label: '허용 범위 ±' + tols().km + 'km' }, unit: 'km', format: (v) => fmt.km(v), yZero: false, title: '구단별 총 이동거리' }));
  }
  function a2() {
    const L = league(), T = tms();
    const mk = (title, key, mean, tol, unit) => '<div class="blk"><div class="blk-head">' + esc(title) + '<span class="r small muted">평균 ' + fmt.num1(mean) + (tol ? ' · ±' + tol : '') + '</span></div><div class="blk-body">' +
      C().bar({ items: T.map((t) => ({ label: t.name, value: t[key], color: app().state.teams[t.team].color, flag: tol ? Math.abs(t[key] - mean) >= tol : false, key: t.name })), width: W(), height: S.wide ? 200 : 140, mean, band: tol ? { lo: mean - tol, hi: mean + tol, label: '±' + tol } : null, unit, yZero: false, title }) + '</div></div>';
    return S.paneHead('이동·휴일·주말 비교', '세 지표를 같은 구단 순서로 나란히 봅니다. 주말 홈은 참고 지표입니다.') +
      '<div class="pane-body pad" data-sk="q-chart"><div class="small-multi" style="grid-template-columns:minmax(0,1fr);gap:8px">' + mk('이동 횟수 (점수 반영' + (S.dev() ? ' S1' : '') + ')', 'moves', L.meanMoves, tols().moves, '회') + mk('휴일 경기 점수 (점수 반영' + (S.dev() ? ' S3' : '') + ')', 'holidayWeight', L.meanHoliday, tols().holiday, '') + mk('주말 홈 시리즈 (참고)', 'weekendHome', L.meanWeekendHome, 0, '') + '</div></div>';
  }
  function a3() {
    const c = D(), T = tms(), u = S.ui;
    let s = S.paneHead('홈/원정 흐름', '구단별 연전 기간 순서. 진한 칸은 홈, 옅은 칸은 원정. 빨간 테두리와 숫자는 홈(원정) 4연속 이상' + (S.dev() ? '(H0-f)' : '') + '.', '<span class="legend"><span><i style="background:var(--navy)"></i>홈</span><span><i style="background:#D9DFE9"></i>원정</span><span><i style="box-shadow:inset 0 0 0 2px var(--bad)"></i>4연속 이상</span></span>');
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
      s += '<td style="width:58px;padding-left:6px" class="small mono" title="최장 연속 홈 · 원정 시리즈">홈' + t.maxHomeRun + '·원정' + t.maxAwayRun + '</td></tr>';
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
    return chartWrap('상대별 경기 수 표', '가로줄은 홈 구단, 세로줄은 원정 구단. 칸은 그 홈에서 치르는 경기 수입니다. 맞대결은 모두 ' + st.settings.initialGamesPerPair + '경기(홈 ' + st.settings.homeGamesMajor + ' : 원정 ' + (st.settings.initialGamesPerPair - st.settings.homeGamesMajor) + ')입니다.', C().heatmap({ rows: names, cols: names, values: vals, cellW: S.wide ? 84 : 60, cellH: S.wide ? 40 : 32, labelW: 56, title: '상대별 경기 수' }));
  }
  function a8() {
    const items = tms().map((t) => ({ label: t.name, value: t.weekdayMoves, color: app().state.teams[t.team].color, key: t.name }));
    const mean = items.reduce((a, b) => a + b.value, 0) / items.length;
    return chartWrap('주중 이동 (참고)', '주중 연전 → 다음 주말 연전 사이 이동 횟수입니다. ' + (S.dev() ? 'Constants.WEEKDAY_MOVE(1.5)는' : '이 값은') + ' 점수에 반영되지 않습니다.', C().bar({ items, width: W(), height: S.wide ? 480 : 380, mean, band: { lo: mean - 1.5, hi: mean + 1.5, label: '±1.5 (참고만)' }, unit: '회', yZero: false, title: '주중 이동' }));
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
    return S.paneHead('장거리 연속 원정', '원정이 2시리즈 이상 이어지고 이동거리 합이 600km를 넘는 때입니다.') + '<div class="pane-body" data-sk="q-chart"><table class="mt"><thead><tr><th>구단</th><th>기간</th><th>시리즈</th><th>이동거리 합</th></tr></thead><tbody>' +
      rows.map((r) => '<tr data-act="q-team" data-team="' + esc(r.t.name) + '"><td>' + S.team(r.t.name) + '</td><td style="text-align:left">' + esc(Dates.fmtDate(c.slots[r.lt.slots[0]].day) + ' ~ ' + Dates.fmtDate(c.slots[r.lt.slots[r.lt.slots.length - 1]].day)) + '</td><td>' + r.lt.series + '</td><td class="over">' + fmt.km(r.lt.tenths / 10) + 'km</td></tr>').join('') + '</tbody></table></div>';
  }
  function a12() {
    const c = D(), st = app().state;
    const months = [3, 4, 5, 6, 7, 8];
    const vals = tms().map((t) => months.map((mo) => t.visits.filter((v) => v.home && c.slots[v.slot].month === mo).reduce((a, v) => a + st.matches[v.match].consecutive, 0)));
    return chartWrap('월별 홈경기 수', '구단별 · 월별 홈경기 수입니다.', C().heatmap({ rows: tms().map((t) => t.name), cols: months.map((m) => m + '월'), values: vals, cellW: S.wide ? 120 : 90, cellH: 34, labelW: 56, title: '월별 홈경기' }));
  }

  // ───────── 구단별 일정표 ─────────
  function renderSched() {
    const st = app().state, c = D();
    const name = S.ui.team || st.teams[0].name;
    const t = tms().find((x) => x.name === name);
    let s = S.paneHead('구단별 일정표', '구단 운영팀 배포용. 인쇄하면 이 미리보기 모양으로 나옵니다.', '<button class="btn sm" data-act="print">' + icon('print') + '인쇄</button>' + (S.feature('D4') ? '<button class="btn sm" data-act="export" data-kind="csv">' + icon('table') + 'CSV</button>' : ''));
    s += '<div class="pane-body paper-bg" data-sk="q-sched"><div class="paper"><h2>' + S.team(name) + ' 2025 정규시즌 1차 편성 일정</h2><div class="meta">' + esc(st.meta.name) + ' · 홈 ' + t.homeSeries + '시리즈(' + t.homeGames + '경기) · 원정 ' + t.awaySeries + '시리즈(' + t.awayGames + '경기) · 총 이동 ' + fmt.km(t.distanceKm) + 'km</div>';
    s += '<table><thead><tr><th>#</th><th>기간</th><th>연전 수</th><th>구분</th><th>상대</th><th>구장</th><th style="text-align:right">이동(km)</th></tr></thead><tbody>' +
      t.visits.map((v, i) => { const sl = c.slots[v.slot]; const opp = st.teams[v.opp]; const stad = st.teams[v.loc].stadium; return '<tr><td class="mono">' + (i + 1) + '</td><td>' + esc(Dates.fmtDate(sl.day) + ' ~ ' + Dates.fmtDate(sl.days[sl.days.length - 1])) + '</td><td>' + sl.consecutive + '</td><td>' + (v.home ? '<span class="home-mark" style="width:auto;padding:0 4px">홈</span>' : '<span class="away-mark" style="width:auto;padding:0 4px">원정</span>') + '</td><td>' + S.team(opp.name) + '</td><td>' + esc(stad) + '</td><td style="text-align:right" class="mono">' + (v.legTenths ? fmt.km(v.legTenths / 10) : '-') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    return s;
  }

  function renderExport() {
    const card = (ic, title, desc, act, kind, mock, extra) => '<div class="exp"><h5>' + icon(ic) + esc(title) + (mock ? S.mock() : '') + '</h5><p>' + esc(desc) + '</p>' + (extra || '') + '<button class="btn sm' + (kind === 'xlsx' ? ' primary' : '') + '" data-act="' + act + '" data-kind="' + kind + '">' + icon('download') + '내려받기</button></div>';
    let s = S.paneHead('내보내기', '배포 파일은 가져올 때와 같은 엑셀 양식이라 고친 뒤 다시 올릴 수 있습니다.', S.ui.exported ? S.stat('ok', '배포 파일 만듦') : S.stat('todo', '배포 파일 아직 없음'));
    s += '<div class="pane-body" data-sk="q-exp"><div class="exp-list">' +
      card('sheet', '엑셀 배포 파일', ['slots', 'series', 'holidays', 'restex', 'blackouts', 'events'].map((k) => S.SHEET_NAMES[k]).join('·') + ' + 안내 시트. 다시 가져오면 같은 상태가 됩니다.', 'export', 'xlsx', true) +
      card('file', '빈 엑셀 양식', '제목 줄과 항목 설명이 담긴 안내 시트, 예시 한 줄. 2025 실제 일정 예시 파일 포함.', 'export', 'template', true) +
      (S.dev() ? card('bolt', '엔진 JSON', 'input_2025.json 형식(teams, distanceMatrix, calendar, matches, initialPlan). Java 엔진 입력용.', 'export', 'engine') +
        card('db', '프로젝트 JSON', '입력·배정·스냅샷·경기 기록·기능 켜기·끄기(meta.features) 전체.', 'export', 'project') : '') +
      (S.feature('D4') ? card('table', '일정표 (CSV)', '날짜, 원정, 홈, 구장, 상태. 구단을 고르면 그 구단만 받습니다.', 'export', 'csv', false, '<p class="small">대상: ' + esc(S.ui.team || '전체 구단') + '</p>') : '') +
      '</div>' + (function () {
        const st = app().state;
        const N = S.SHEET_NAMES;
        const rows = [[N.slots, st.calendar.length, '시작일·연전 수·주말·휴일 등급·메모'], [N.series, st.matches.length, '홈·원정·연전 수·메모'], [N.holidays, st.settings.holidays.length, '날짜·이름'], [N.restex, st.settings.restExceptions.length, '날짜·메모'], [N.blackouts, st.settings.blackouts.length, '시작일·종료일·이름'], [N.events, st.events.length, '이름·유형·날짜·지정 방식·홈·원정·구장'], [N.guide, '-', '항목 설명 · 시즌 기본 설정(개막·종료·휴식 요일)']];
        return '<div style="padding:0 12px 12px"><div class="label" style="padding:4px 0 6px">엑셀 배포 파일 구성 (가져올 때와 같은 양식)</div><table class="itable" style="border:1px solid var(--line)"><thead><tr><th>시트</th><th class="num">개수</th><th>항목</th></tr></thead><tbody>' + rows.map((r) => '<tr><td><b>' + r[0] + '</b></td><td class="num">' + r[1] + '</td><td class="small muted">' + r[2] + '</td></tr>').join('') + '</tbody></table></div>';
      })() + '<div class="small muted" style="padding:0 12px">' + (D().ex.feasible ? '편성 가능한 상태입니다.' : S.termPlain('hardViol') + '이 있는 상태로도 내보낼 수 있지만, 배포 전에는 ③에서 위반을 없애세요.') + '</div></div>';
    return s;
  }

  // ───────── 인스펙터: 구단 카드 ─────────
  function renderInsp() {
    const u = S.ui;
    const t = tms().find((x) => x.name === u.team);
    if (!t) return { title: '구단 카드', html: '<div class="empty"><b>구단을 고르세요</b>표의 줄, 그래프의 막대, 왼쪽 구단 버튼을 누르면 그 구단의 지표와 흐름이 여기에 나옵니다.</div>' };
    const L = league();
    const row = (k, v, mean, over, unit) => '<dt>' + esc(k) + '</dt><dd>' + (over ? '<b style="color:var(--bad)">' + icon('warn') + v + '</b>' : '<b>' + v + '</b>') + (unit ? ' <span class="muted small">' + unit + '</span>' : '') + (mean != null ? '<span class="muted small">평균 ' + mean + '</span>' : '') + '</dd>';
    let s = '<div class="insp-sec"><div class="insp-title">' + S.team(t.name) + '</div><div class="insp-sub">' + esc(app().state.teams[t.team].stadium) + ' · 홈 ' + t.homeSeries + ' / 원정 ' + t.awaySeries + ' 시리즈</div></div>';
    s += '<div class="insp-sec"><h4>점수 반영 지표 <span class="tag score">점수 반영</span></h4><dl class="props">' +
      row('총 이동거리', fmt.km(t.distanceKm), fmt.km(L.meanDistanceKm), t.overDistance, 'km') +
      row('이동 횟수', t.moves, fmt.num1(L.meanMoves), t.overMoves, '회') +
      row('휴일 경기 점수', t.holidayWeight, fmt.num1(L.meanHoliday), t.overHoliday) + '</dl></div>';
    s += '<div class="insp-sec"><h4>참고 지표 <span class="tag ref">참고만</span></h4><dl class="props">' +
      row('주말 홈/원정', t.weekendHome + ' / ' + t.weekendAway, null, false) +
      row('주중 이동', t.weekdayMoves + '회 · ' + fmt.km(t.weekdayMoveKm) + 'km', null, false) +
      row('최장 연속', '홈 ' + t.maxHomeRun + ' · 원정 ' + t.maxAwayRun, null, t.maxHomeRun > 3 || t.maxAwayRun > 3) +
      row('공휴일 홈', t.holidayHomeGames, null, false, '경기') +
      row('7~8월 원정', t.summerAwayGames, null, false, '경기') + '</dl></div>';
    const c = D();
    const bySlot = new Map(t.visits.map((v) => [v.slot, v]));
    const over = new Set(); for (const r of t.runs) if (r.length > 3) r.slots.slice(3).forEach((x) => over.add(x));
    s += '<div class="insp-sec"><h4>홈/원정 흐름<span class="r">연전 기간 ' + c.slots.length + '</span></h4><div class="mini-strip">' + c.slots.map((sl) => { const v = bySlot.get(sl.index); return '<i class="' + (v && v.home ? 'h' : '') + (over.has(sl.index) ? ' over' : '') + '"' + (v ? '' : ' style="background:#fff"') + '></i>'; }).join('') + '</div></div>';
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
      return '<div class="stepview no-band">' + S.workspace({ list: renderList(), main: fn(), insp: insp.html, inspTitle: insp.title, listLabel: '공정성 보기' }) + '</div>';
    },
    after() {
      // opt-2: 대시보드 차트 상자 크기 재기 → 그린 크기와 4px 넘게 다르면 다시 그린다
      const bb = S.ui.qv === 'metrics' && document.querySelector('.q-charts .mc-box .blk-body');
      if (bb && S._dashUsed) {
        const mw = Math.round(bb.clientWidth - 16), mh = Math.round(bb.clientHeight - 8), u = S._dashUsed;
        S._dashBox = S._dashBox || {};
        S._dashBox[u.open ? 'open' : 'closed'] = { w: mw, h: mh };
        if (mw > 60 && mh > 60 && (Math.abs(mw - u.w) > 4 || Math.abs(mh - u.h) > 4) && !S._dashRe) { S._dashRe = true; try { S.render(); } finally { S._dashRe = false; } }
      }
      if (S.ui.qv === 'metrics' && S.ui.mtOpen) S.revealSelected('.mt tbody tr.sel', '.q-band-body');
      document.querySelectorAll('.kc-item[data-key]').forEach((g) => { g.setAttribute('data-act', 'q-team'); g.setAttribute('data-team', g.getAttribute('data-key')); });
    }
  };

  // opt-2: 창 크기가 바뀌면 대시보드 차트를 상자 크기에 맞춰 다시 그린다
  window.addEventListener('resize', () => { if (S.ui && !S.ui.ops && S.ui.step === 4 && S.ui.qv === 'metrics') S.render(); });

  Object.assign(S.actions, {
    'q-view': (el) => S.go({ step: 4, qv: el.dataset.qv, ops: null }),
    'q-team': (el) => S.go({ team: S.ui.team === el.dataset.team && S.ui.qv !== 'sched' ? null : el.dataset.team }),
    'q-mt': () => S.go({ mtOpen: !S.ui.mtOpen }),
    'q-sort': (el) => { const k = el.dataset.k; const cur = S.ui.sort; S.go({ sort: { key: k, dir: cur.key === k ? -cur.dir : (k === 'name' ? 1 : -1) } }); },
    'q-soft': (el) => S.go({ softLevel: el.dataset.lv }),
    'q-to-cal': (el) => S.go({ step: 3, teamFilter: [el.dataset.team], view: 'calendar', sel: null }),
    'print': () => { try { window.print(); } catch (e) { /* 무시 */ } }
  });
})();
