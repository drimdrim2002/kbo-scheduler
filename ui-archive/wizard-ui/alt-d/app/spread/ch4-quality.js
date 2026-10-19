/*
 * 제4장 품질·배포 — 공정성을 확인하고 배포본을 만든다.
 * 본문: 4.1 구단 지표(채점/참고 구분, 정렬, 허용오차) · 4.2 Soft 분해 · 4.3 차트(필수 3종 + 켜진 선택 차트) · 4.4 구단별 일정표(인쇄 미리보기)
 * 여백: 배포 점검 · 선택한 구단 · 내보내기
 */
(function () {
  'use strict';
  const SP = window.SP;
  const KBO = window.KBO;
  const { Dates, Score } = KBO;
  const { esc, fmt } = SP;
  const app = SP.app;
  const ui = SP.ui;

  function tabs() {
    const t = [{ id: 'metrics', label: '구단 지표' }, { id: 'soft', label: 'Soft 분해' }, { id: 'charts', label: '차트' }];
    if (SP.on('A11')) t.push({ id: 'schedule', label: '구단별 일정표' });
    return t;
  }
  const tms = () => SP.ex().teamMetrics;
  const L = () => SP.ex().league;
  const colorOf = (name) => (app.team(name) || {}).color || '#555';

  // ───────────── 4.1 구단 지표 ─────────────
  const COLS = [
    { key: 'distance', label: '총 이동거리', unit: 'km', kind: '채점 S2', scored: true, v: (t) => t.distanceKm, f: (v) => fmt.km(v), over: (t) => t.overDistance },
    { key: 'dev', label: '평균 대비', unit: 'km', kind: '허용 ±300', scored: true, v: (t) => t.distanceKm - L().meanDistanceKm, f: (v) => fmt.signed(v, fmt.km), over: (t) => t.overDistance },
    { key: 'moves', label: '이동 횟수', unit: '회', kind: '채점 S1', scored: true, v: (t) => t.moves, f: (v) => v, over: (t) => t.overMoves },
    { key: 'holiday', label: '휴일 가중치', unit: '', kind: '채점 S3', scored: true, v: (t) => t.holidayWeight, f: (v) => v, over: (t) => t.overHoliday },
    { key: 'wkHome', label: '주말 홈', unit: '시리즈', kind: '참고 R1', v: (t) => t.weekendHome, f: (v) => v },
    { key: 'runs', label: '최장 연속 홈/원정', unit: '', kind: '참고 R3', v: (t) => Math.max(t.maxHomeRun, t.maxAwayRun), f: (v, t) => t.maxHomeRun + ' / ' + t.maxAwayRun, over: (t) => t.maxHomeRun > 3 || t.maxAwayRun > 3 },
    { key: 'wdMove', label: '주중 이동', unit: '회·km', kind: '참고 R2', feat: 'A8', v: (t) => t.weekdayMoveKm, f: (v, t) => t.weekdayMoves + '회 · ' + fmt.km(t.weekdayMoveKm) },
    { key: 'holHome', label: '공휴일 홈', unit: '경기', kind: '참고 R4', v: (t) => t.holidayHomeGames, f: (v) => v }
  ];
  SP.act.sort = (el) => { const k = el.dataset.arg; ui.sort = ui.sort.key === k ? { key: k, dir: -ui.sort.dir } : { key: k, dir: -1 }; SP.render(); };
  SP.act.selTeam = (el) => { ui.chartTeam = ui.chartTeam === el.dataset.arg ? null : el.dataset.arg; SP.render(); };
  function metricsTable() {
    const cols = COLS.filter((c) => !c.feat || SP.on(c.feat));
    const col = cols.find((c) => c.key === ui.sort.key) || cols[0];
    const rows = tms().slice().sort((a, b) => (col.v(a) - col.v(b)) * ui.sort.dir);
    const lg = L();
    const overN = tms().filter((t) => t.overDistance || t.overMoves || t.overHoliday).length;
    let h = '<div class="sp-toolbar">' + SP.cap('표 4.1', '구단별 지표', '<b style="color:var(--navy)">채점</b> = 엔진 점수에 들어감 · 참고 = 들어가지 않음 · 머리글을 눌러 정렬') + '<span class="sp-grow"></span>' + (overN ? SP.chip('warn', '허용오차 초과 ' + overN + '구단') : SP.chip('ok', '허용오차 이내')) + '</div>';
    h += '<div class="sp-scroll sp-grow" data-sk="metrics" style="border-bottom:2px solid var(--ink);background:var(--sheet)"><table class="sp-table"><thead><tr><th style="width:90px">구단</th>' +
      cols.map((c) => '<th class="sp-num"><button type="button" class="sp-th-sort" data-act="sort" data-arg="' + c.key + '"' + (col.key === c.key ? ' aria-sort="' + (ui.sort.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '>' + esc(c.label) + (col.key === c.key ? (ui.sort.dir < 0 ? ' ▼' : ' ▲') : '') + '</button><span class="sp-th-kind' + (c.scored ? ' sp-scored' : '') + '">' + esc(c.kind) + (c.unit ? ' · ' + c.unit : '') + '</span></th>').join('') + '<th style="width:120px">거리 막대</th></tr></thead><tbody>';
    const maxD = Math.max(...tms().map((t) => t.distanceKm));
    for (const t of rows) {
      const sel = ui.chartTeam === t.name;
      h += '<tr class="sp-clickable' + (sel ? ' sp-sel' : '') + '" data-act="selTeam" data-arg="' + esc(t.name) + '"><th scope="row" style="font-weight:600">' + SP.team(t.name) + '</th>' +
        cols.map((c) => { const o = c.over && c.over(t); const up = c.key === 'runs' || (c.key === 'dev' ? c.v(t) > 0 : c.key === 'distance' ? t.distanceKm > lg.meanDistanceKm : c.key === 'moves' ? t.moves > lg.meanMoves : t.holidayWeight > lg.meanHoliday); return '<td class="sp-num' + (o ? ' sp-over' : '') + '">' + (o ? '<span aria-label="허용오차 초과(' + (up ? '평균보다 큼' : '평균보다 작음') + ')">' + (up ? '▲' : '▼') + '</span> ' : '') + c.f(c.v(t), t) + '</td>'; }).join('') +
        '<td><span class="sp-bar' + (t.overDistance ? ' sp-bar-bad' : '') + '" style="width:' + Math.round(100 * t.distanceKm / maxD) + 'px"></span></td></tr>';
    }
    h += '</tbody><tfoot><tr><td>리그 평균</td><td class="sp-num">' + fmt.km(lg.meanDistanceKm) + '</td><td class="sp-num">±300.0</td><td class="sp-num">' + fmt.num1(lg.meanMoves) + '</td><td class="sp-num">' + fmt.num1(lg.meanHoliday) + '</td><td class="sp-num">' + fmt.num1(lg.meanWeekendHome) + '</td><td class="sp-num">≤ 3</td>' + (SP.on('A8') ? '<td class="sp-num">—</td>' : '') + '<td class="sp-num">—</td><td>총 ' + fmt.int(lg.totalKm) + 'km</td></tr></tfoot></table></div>' +
      '<p class="sp-note-s">▲▼ = 엔진 허용오차 초과(평균보다 큼·작음) — 이동거리 ±300km, 이동 횟수 ±2회, 휴일 가중치 ±1.5 · 최장 연속 4 이상은 H0-f 위반.</p>';
    return h;
  }

  // ───────────── 4.2 Soft 분해 ─────────────
  function softTable() {
    const ex = SP.ex();
    const sb = ex.softBreakdown;
    const names = app.state.teams.map((t) => t.name);
    const rows = [
      ['S0', '미배정 시리즈', sb.S0.total, '미배정 ' + sb.S0.items.length + '개', null],
      ['S1', '이동 횟수 분산', sb.S1.total, '평균 ' + fmt.num1(sb.S1.mean) + '회, ±' + sb.S1.tolerance + '회 단위 제곱 × 100', sb.S1.items],
      ['S2', '이동 거리 분산', sb.S2.total, '평균 ' + fmt.km(sb.S2.meanKm) + 'km, ±' + sb.S2.toleranceKm + 'km 초과분 제곱', sb.S2.items],
      ['S3', '휴일 가중치 분산', sb.S3.total, '평균 ' + fmt.num1(sb.S3.mean) + ', ±' + sb.S3.tolerance + ' 단위 제곱', sb.S3.items],
      ['S4', '리그 총 이동거리', sb.S4.total, '구단 이동거리 합 (km, 버림)', sb.S4.items.map((x) => ({ team: x.team, contrib: x.value }))]
    ];
    let h = '<div class="sp-toolbar">' + SP.cap('표 4.2', 'Soft 점수 분해 (S0~S4)', '단계가 앞설수록 우선한다 · 막대 = 그 단계 감점에서 구단이 차지하는 몫') + '</div>';
    h += '<div class="sp-scroll sp-grow" data-sk="soft" style="border-bottom:2px solid var(--ink);background:var(--sheet)"><table class="sp-table"><thead><tr><th style="width:44px">단계</th><th style="width:130px">규칙</th><th class="sp-num" style="width:110px">점수</th><th style="width:260px">계산</th><th>구단별 기여 (큰 순)</th></tr></thead><tbody>';
    for (const [code, label, total, calc, items] of rows) {
      let contrib = '';
      if (items) {
        const sum = items.reduce((a, b) => a + (b.contrib || 0), 0) || 1;
        const top = items.filter((x) => x.contrib > 0).sort((a, b) => b.contrib - a.contrib).slice(0, 5);
        contrib = top.length ? top.map((x) => '<span style="display:inline-flex;align-items:center;gap:4px;margin-right:10px">' + SP.team(names[x.team]) + '<span class="sp-bar" style="width:' + Math.max(3, Math.round(60 * x.contrib / sum)) + 'px"></span><span class="sp-muted">' + Math.round(100 * x.contrib / sum) + '%</span></span>').join('') : '<span class="sp-muted">감점 없음 — 모든 구단이 허용오차 이내</span>';
      } else contrib = '<span class="sp-muted">' + (total ? '미배정 시리즈가 있습니다' : '미배정 없음') + '</span>';
      h += '<tr><td><b>' + code + '</b></td><td>' + esc(label) + '</td><td class="sp-num"><b>' + fmt.int(total) + '</b></td><td class="sp-muted" style="white-space:normal;font-size:11px">' + esc(calc) + '</td><td style="white-space:normal;padding-top:3px;padding-bottom:3px">' + contrib + '</td></tr>';
    }
    h += '</tbody><tfoot><tr><td colspan="2">합계 표기</td><td colspan="3" style="font-family:var(--mono);font-weight:500">' + esc(fmt.score(ex.score)) + '</td></tr></tfoot></table></div>';
    // S2 구단별 상세
    h += SP.cap('표 4.3', 'S2 이동 거리 — 구단별 초과분', '평균 ' + fmt.km(rows[2][4] ? SP.ex().softBreakdown.S2.meanKm : 0) + 'km 기준') + '<div style="flex:none;background:var(--sheet);border-top:2px solid var(--ink);border-bottom:1px solid var(--ink)"><table class="sp-table"><thead><tr>' + names.map((n) => '<th class="sp-num">' + esc(n) + '</th>').join('') + '</tr></thead><tbody><tr>' + sb.S2.items.map((x) => '<td class="sp-num' + (x.excessKm > 0 ? ' sp-over' : '') + '">' + (x.excessKm > 0 ? '▲ ' + fmt.km(x.excessKm) : '0.0') + '</td>').join('') + '</tr></tbody></table></div>';
    return h;
  }

  // ───────────── 4.3 차트 ─────────────
  function barChart(W) {
    const t = tms();
    const H = 216, pl = 46, pr = 10, pt = 22, pb = 26;
    const iw = W - pl - pr, ih = H - pt - pb;
    const mean = L().meanDistanceKm;
    const max = Math.ceil(Math.max(...t.map((x) => x.distanceKm), mean + 300) / 1000) * 1000;
    const y = (v) => pt + ih * (1 - v / max);
    const bw = iw / t.length;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="구단별 총 이동거리 막대, 평균선과 ±300km 허용오차 띠"><defs><pattern id="sv-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#f6e0dc"/><line x1="0" y1="0" x2="0" y2="5" stroke="#9e1c1c" stroke-width="2"/></pattern></defs>';
    for (let v = 0; v <= max; v += 1000) s += '<line class="sv-grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="sv-t" x="' + (pl - 5) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + fmt.int(v) + '</text>';
    s += '<rect class="sv-band" x="' + pl + '" width="' + iw + '" y="' + y(mean + 300) + '" height="' + (y(mean - 300) - y(mean + 300)) + '"/>';
    t.forEach((x, i) => {
      const dim = ui.chartTeam && ui.chartTeam !== x.name;
      const cls = x.overDistance ? 'sv-bar-over' : dim ? 'sv-bar-dim' : 'sv-bar';
      s += '<g class="sv-sel" data-act="selTeam" data-arg="' + esc(x.name) + '"><rect class="' + cls + '" x="' + (pl + i * bw + bw * .18) + '" width="' + (bw * .64) + '" y="' + y(x.distanceKm) + '" height="' + (y(0) - y(x.distanceKm)) + '"><title>' + esc(x.name) + ' ' + fmt.km(x.distanceKm) + 'km</title></rect>' +
        '<text class="' + (ui.chartTeam === x.name ? 'sv-tb' : 'sv-t') + '" x="' + (pl + i * bw + bw / 2) + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(x.name) + '</text>' + (x.overDistance ? '<text class="sv-tb" fill="#9e1c1c" x="' + (pl + i * bw + bw / 2) + '" y="' + (y(x.distanceKm) - 3) + '" text-anchor="middle">▲</text>' : '') + '</g>';
    });
    s += '<line class="sv-mean" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(mean) + '" y2="' + y(mean) + '"/><text class="sv-tb" x="' + (pl + 4) + '" y="' + (pt - 6) + '">평균 ' + fmt.km(mean) + 'km (점선) · 녹색 띠 ±300km</text>';
    return s + '</svg>';
  }
  function dotChart(W, label, get, mean, tol, overFn) {
    const t = tms();
    const H = 132, pl = 46, pr = 10, pt = 16, pb = 22;
    const vals = t.map(get);
    const lo = Math.floor(Math.min(...vals, mean - tol) - 1), hi = Math.ceil(Math.max(...vals, mean + tol) + 1);
    const iw = W - pl - pr, ih = H - pt - pb;
    const y = (v) => pt + ih * (1 - (v - lo) / (hi - lo));
    const bw = iw / t.length;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + ' 점 차트"><text class="sv-tb" x="' + pl + '" y="10">' + esc(label) + '</text>';
    s += '<rect class="sv-band" x="' + pl + '" width="' + iw + '" y="' + y(mean + tol) + '" height="' + (y(mean - tol) - y(mean + tol)) + '"/>';
    const step = Math.max(1, Math.round((hi - lo) / 4));
    for (let v = lo; v <= hi; v += step) s += '<text class="sv-t" x="' + (pl - 5) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + v + '</text>';
    s += '<line class="sv-mean" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(mean) + '" y2="' + y(mean) + '"/>';
    t.forEach((x, i) => {
      const o = overFn ? overFn(x) : false;
      const cx = pl + i * bw + bw / 2;
      s += '<g class="sv-sel" data-act="selTeam" data-arg="' + esc(x.name) + '"><circle class="sv-dot' + (o ? ' sv-dot-over' : '') + '" cx="' + cx + '" cy="' + y(get(x)) + '" r="' + (ui.chartTeam === x.name ? 6 : 4.5) + '"><title>' + esc(x.name) + ' ' + get(x) + '</title></circle>' + (o ? '<text class="sv-tb" fill="#9e1c1c" x="' + (cx + 7) + '" y="' + (y(get(x)) + 3) + '">▲</text>' : '') + '<text class="sv-t" x="' + cx + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(x.name) + '</text></g>';
    });
    return s + '</svg>';
  }
  function strip() {
    const d = app.derived();
    const S = d.slots.length;
    let h = '<div class="sp-strip" style="grid-template-columns:52px repeat(' + S + ',minmax(0,1fr))"><div></div>' + d.slots.map((s, i) => '<div class="sp-strip-c" style="font-size:9px;color:var(--muted)">' + (i % 4 === 0 ? fmt.md(s.day) : '') + '</div>').join('');
    for (const t of tms()) {
      const by = new Map(t.visits.map((v) => [v.slot, v]));
      h += '<div class="sp-strip-n">' + SP.team(t.name) + '</div>' + d.slots.map((s) => { const v = by.get(s.index); if (!v) return '<div class="sp-strip-c"></div>'; return '<div class="sp-strip-c ' + (v.home ? 'sp-strip-h' : 'sp-strip-a') + (v.run > 3 ? ' sp-strip-x' : '') + '" title="' + esc(fmt.md(s.day) + ' ' + (v.home ? '홈' : '원정') + ' ' + v.run + '연속') + '">' + (v.run > 3 ? v.run : v.home ? 'H' : 'A') + '</div>'; }).join('');
    }
    return h + '</div>';
  }
  function lineChart(W) {
    const t = tms();
    const H = 200, pl = 46, pr = 50, pt = 12, pb = 22;
    const S = app.derived().slots.length;
    const max = Math.ceil(Math.max(...t.map((x) => x.distanceKm)) / 1000) * 1000;
    const x = (s) => pl + (W - pl - pr) * s / (S - 1);
    const y = (v) => pt + (H - pt - pb) * (1 - v / max);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="구단별 누적 이동거리 선 차트">';
    for (let v = 0; v <= max; v += 1000) s += '<line class="sv-grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="sv-t" x="' + (pl - 5) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + fmt.int(v) + '</text>';
    for (const tm of t) {
      const pts = tm.visits.map((v) => x(v.slot).toFixed(1) + ',' + y(v.cumTenths / 10).toFixed(1)).join(' ');
      const sel = ui.chartTeam === tm.name;
      const dim = ui.chartTeam && !sel;
      s += '<polyline class="sv-line" points="' + pts + '" stroke="' + (dim ? '#c9c2b4' : colorOf(tm.name)) + '" stroke-width="' + (sel ? 2.6 : 1.3) + '"/>';
      const lv = tm.visits[tm.visits.length - 1];
      if (lv && sel) s += '<text class="sv-t" x="' + (W - pr + 3) + '" y="' + (y(lv.cumTenths / 10) + 3) + '">' + esc(tm.name) + '</text>';
    }
    return s + '</svg>';
  }
  function oppMatrix() {
    const st = app.state;
    const names = st.teams.map((t) => t.name);
    const g = {};
    for (const m of st.matches) { g[m.home + '|' + m.away] = (g[m.home + '|' + m.away] || 0) + m.consecutive; }
    return '<table class="sp-table" style="font-size:10.5px"><thead><tr><th>홈＼원정</th>' + names.map((n) => '<th class="sp-c">' + esc(n) + '</th>').join('') + '</tr></thead><tbody>' + names.map((a) => '<tr><th scope="row">' + esc(a) + '</th>' + names.map((b) => '<td class="sp-c" style="height:19px">' + (a === b ? '·' : (g[a + '|' + b] || 0)) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }
  function figs() {
    const wide = window.innerWidth >= 1700;
    const W = wide ? 700 : 520;
    let h = '<div class="sp-figs" data-sk="figs">';
    h += '<figure class="sp-fig" id="fig-a1" style="margin:0">' + SP.cap('그림 4.1', '구단별 총 이동거리', 'FR-A1 · 막대를 누르면 구단 강조') + barChart(W) + '<div class="sp-fig-src">빗금 막대 = 평균 ±300km 밖(S2 감점) · 점선 = 리그 평균</div></figure>';
    h += '<figure class="sp-fig" id="fig-a2" style="margin:0">' + SP.cap('그림 4.2', '이동 횟수 · 휴일 가중치 · 주말 홈', 'FR-A2') +
      dotChart(W, '이동 횟수 (채점 S1, ±2회)', (x) => x.moves, L().meanMoves, 2, (x) => x.overMoves) +
      dotChart(W, '휴일 가중치 (채점 S3, ±1.5)', (x) => x.holidayWeight, L().meanHoliday, 1.5, (x) => x.overHoliday) + '</figure>';
    h += '<figure class="sp-fig sp-wide" id="fig-a3" style="margin:0">' + SP.cap('그림 4.3', '홈/원정 흐름 (구단 × 슬롯)', 'FR-A3 · H 홈 · A 원정 · 숫자 테두리 = 4연속 이상') + strip() + '</figure>';
    h += '<figure class="sp-fig" style="margin:0">' + SP.cap('그림 4.4', '주말 홈 시리즈 (참고 R1)', '엔진이 직접 최적화하지 않음') + dotChart(W, '주말 홈 시리즈 수', (x) => x.weekendHome, L().meanWeekendHome, 1, null) + '</figure>';
    if (SP.on('A4')) h += '<figure class="sp-fig" style="margin:0">' + SP.cap('그림 4.5', '누적 이동거리', 'FR-A4 · 선택 · 막대·점을 누르면 그 구단 선을 강조') + lineChart(W) + '</figure>';
    if (SP.on('A5')) h += '<figure class="sp-fig" style="margin:0">' + SP.cap('그림 4.6', '상대 매트릭스 (홈 경기 수)', 'FR-A5 · 선택') + oppMatrix() + '</figure>';
    if (SP.on('A8')) h += '<figure class="sp-fig" style="margin:0">' + SP.cap('그림 4.7', '주중 → 주말 이동 (참고)', 'FR-A8 · 선택 · 허용오차 1.5는 점수 미반영') + dotChart(W, '주중 이동 횟수', (x) => x.weekdayMoves, tms().reduce((a, b) => a + b.weekdayMoves, 0) / tms().length, 1.5, null) + '</figure>';
    if (SP.on('A9')) h += '<figure class="sp-fig" style="margin:0">' + SP.cap('그림 4.8', '혹서기(7~8월) 원정 부담', 'FR-A9 · 선택 · 키움 = 돔') + dotChart(W, '7~8월 원정 경기 수', (x) => x.summerAwayGames, tms().reduce((a, b) => a + b.summerAwayGames, 0) / tms().length, 3, null) + '</figure>';
    if (SP.on('A10')) { const lt = []; for (const t of tms()) for (const r of t.longTrips) lt.push([t.name, r]); h += '<figure class="sp-fig" style="margin:0">' + SP.cap('표 4.9', '장거리 연속 원정', 'FR-A10 · 연속 원정 2시리즈↑ · 600km 초과') + '<table class="sp-table"><thead><tr><th>구단</th><th>구간</th><th class="sp-num">시리즈</th><th class="sp-num">거리</th></tr></thead><tbody>' + lt.slice(0, 10).map(([n, r]) => '<tr><td>' + SP.team(n) + '</td><td>' + esc(SP.slotRange(r.slots[0])) + '~</td><td class="sp-num">' + r.series + '</td><td class="sp-num">' + fmt.km(r.tenths / 10) + 'km</td></tr>').join('') + '</tbody></table></figure>'; }
    if (SP.on('A12')) { const d = app.derived(); h += '<figure class="sp-fig" style="margin:0">' + SP.cap('그림 4.10', '월별 홈경기 수', 'FR-A12 · 선택') + '<table class="sp-table"><thead><tr><th>구단</th>' + [3, 4, 5, 6, 7, 8].map((m) => '<th class="sp-num">' + m + '월</th>').join('') + '</tr></thead><tbody>' + tms().map((t) => '<tr><td>' + SP.team(t.name) + '</td>' + [3, 4, 5, 6, 7, 8].map((m) => { const n = t.visits.filter((v) => v.home && d.slots[v.slot].month === m).reduce((a, v) => a + app.state.matches[v.match].consecutive, 0); return '<td class="sp-num" style="background:rgba(29,53,87,' + (n / 20).toFixed(2) + ');color:' + (n > 10 ? '#fff' : 'inherit') + '">' + n + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></figure>'; }
    h += '</div>';
    return h;
  }

  // ───────────── 4.4 구단별 일정표 ─────────────
  function scheduleSheet(team) {
    const st = app.state;
    const d = app.derived();
    const tm = tms().find((t) => t.name === team) || tms()[0];
    const byMonth = {};
    for (const v of tm.visits) { const mo = d.slots[v.slot].month; (byMonth[mo] = byMonth[mo] || []).push(v); }
    let cols = '';
    for (const mo of Object.keys(byMonth)) {
      cols += '<table><thead><tr><th colspan="5" class="sp-a4-m">' + mo + '월</th></tr><tr><th>날짜</th><th>상대</th><th>구분</th><th>구장</th><th style="text-align:right">이동</th></tr></thead><tbody>';
      for (const v of byMonth[mo]) {
        const sl = d.slots[v.slot];
        const opp = st.teams[v.opp].name;
        const stad = (st.teams[v.loc] || {}).stadium || '';
        cols += '<tr><td>' + fmt.date(sl.day) + (sl.consecutive > 1 ? '~' + (Dates.month(sl.day + sl.consecutive - 1) === Dates.month(sl.day) ? fmt.md(sl.day + sl.consecutive - 1).split('/')[1] : fmt.md(sl.day + sl.consecutive - 1)) : '') + '</td><td>' + esc(opp) + '</td><td>' + (v.home ? '홈' : '원정') + '</td><td>' + esc(short(stad)) + '</td><td style="text-align:right">' + (v.legTenths ? fmt.km(v.legTenths / 10) : '–') + '</td></tr>';
      }
      cols += '</tbody></table>';
    }
    return '<div class="sp-a4"><div class="sp-a4-h"><h2>2025 KBO 정규시즌 1차 일정 · ' + esc(team) + '</h2><span>' + esc((app.team(team) || {}).stadium || '') + ' · ' + fmt.date(st.settings.seasonStart) + ' ~ ' + fmt.date(st.settings.initialEnd) + '</span></div>' +
      '<div class="sp-a4-sum"><span>시리즈 <b>' + tm.visits.length + '</b> (홈 ' + tm.homeSeries + ' · 원정 ' + tm.awaySeries + ')</span><span>경기 <b>' + (tm.homeGames + tm.awayGames) + '</b></span><span>총 이동 <b>' + fmt.km(tm.distanceKm) + 'km</b></span><span>최장 연속 홈 ' + tm.maxHomeRun + ' · 원정 ' + tm.maxAwayRun + '</span></div>' +
      '<div class="sp-a4-cols">' + cols + '</div><div class="sp-a4-foot"><span>KBO 사무국 운영팀 · 배포용</span><span>' + esc(fmt.score(SP.ex().score)) + (SP.ex().feasible ? '' : ' · 시안: 가상 위반 포함') + '</span></div></div>';
  }
  const short = (s) => String(s).replace(/종합운동장|야구장|경기장/, '').replace('돔', '돔');
  SP.act.schedTeam = (el) => { ui.schedTeam = el.dataset.arg; SP.render(); };
  SP.act.print = () => { SP.fillPrint(); setTimeout(() => window.print(), 50); };
  SP.fillPrint = function () {
    const el = document.getElementById('sp-print');
    if (!el) return;
    if (ui.view === 'wizard' && ui.step === 4 && ui.tab[4] === 'schedule') { el.innerHTML = scheduleSheet(ui.schedTeam); return; }
    const t = tms();
    el.innerHTML = '<div class="sp-brief-page"><h1>2025 정규시즌 편성 브리프 — 품질</h1><p>' + esc(fmt.score(SP.ex().score)) + ' · ' + (SP.ex().feasible ? '편성 가능' : 'Hard 위반 ' + SP.ex().violations.length + '건') + '</p><h2>표 4.1 구단별 지표</h2><table><thead><tr><th>구단</th><th class="sp-num">총 이동거리</th><th class="sp-num">이동 횟수</th><th class="sp-num">휴일 가중치</th><th class="sp-num">주말 홈</th><th class="sp-num">최장 연속</th></tr></thead><tbody>' +
      t.map((x) => '<tr><td>' + esc(x.name) + '</td><td class="sp-num">' + fmt.km(x.distanceKm) + '</td><td class="sp-num">' + x.moves + '</td><td class="sp-num">' + x.holidayWeight + '</td><td class="sp-num">' + x.weekendHome + '</td><td class="sp-num">' + x.maxHomeRun + '/' + x.maxAwayRun + '</td></tr>').join('') + '</tbody></table></div>';
  };
  SP.afterRender.push(SP.fillPrint);
  function schedule() {
    const team = ui.schedTeam;
    return '<div class="sp-toolbar">' + SP.cap('표 4.4', '구단별 일정표 — 인쇄 미리보기', 'A4 세로 · 인쇄하면 이 표만 나간다') + '<span class="sp-grow"></span><div class="sp-filter">' + app.state.teams.map((t) => '<button type="button" class="sp-fchip" data-act="schedTeam" data-arg="' + esc(t.name) + '" aria-pressed="' + (team === t.name) + '"><i style="background:' + t.color + '"></i>' + esc(t.name) + '</button>').join('') + '</div>' + SP.btn('print', '인쇄', { kind: 'primary' }) + '</div>' +
      '<div class="sp-sheetview" data-sk="sheet">' + scheduleSheet(team) + '</div>';
  }

  // ───────────── 여백 ─────────────
  function marginQuality(tab) {
    const ex = SP.ex();
    const over = tms().filter((t) => t.overDistance || t.overMoves || t.overHoliday);
    const pool = app.derived().pool.length;
    const checks = [
      [ex.feasible ? 'pass' : 'block', 'Hard 위반 0', ex.feasible ? '편성 가능' : ex.violations.length + '건 남음 — 제3장', ex.feasible ? null : '3:calendar'],
      [pool ? 'warn' : 'pass', '미배정 시리즈 0', pool ? pool + '개' : '모두 배정', pool ? '3:calendar' : null],
      [over.length ? 'warn' : 'pass', '허용오차 이내', over.length ? over.map((t) => t.name).join('·') + ' 초과' : '모든 구단', over.length ? '4:metrics' : null],
      [SP.isConfirmed(3) ? 'pass' : 'warn', '제3장 확정', SP.isConfirmed(3) ? '확정됨' : '아직 확정하지 않음', null]
    ];
    let b = SP.mSec('배포 점검', '<ul class="sp-mlist">' + checks.map(([k, t, d, go]) => '<li>' + SP.icon(k) + '<span class="sp-mlist-t"><b>' + esc(t) + '</b> — ' + esc(d) + '</span>' + (go ? '<button class="sp-link" data-act="go" data-arg="' + go + '">이동</button>' : '') + '</li>').join('') + '</ul>');
    if (ui.chartTeam) {
      const t = tms().find((x) => x.name === ui.chartTeam);
      if (t) b += SP.mSec('선택한 구단 · ' + esc(t.name), '<div class="sp-detail"><dl class="sp-kv"><dt>총 이동거리</dt><dd' + (t.overDistance ? ' class="sp-over"' : '') + '>' + fmt.km(t.distanceKm) + 'km</dd><dt>평균 대비</dt><dd>' + fmt.signed(t.distanceKm - L().meanDistanceKm, fmt.km) + 'km</dd><dt>이동 횟수</dt><dd>' + t.moves + '회</dd><dt>휴일 가중치</dt><dd>' + t.holidayWeight + '</dd><dt>주말 홈 · 원정</dt><dd>' + t.weekendHome + ' · ' + t.weekendAway + '</dd><dt>홈 · 원정 경기</dt><dd>' + t.homeGames + ' · ' + t.awayGames + '</dd><dt>최장 연속 홈 · 원정</dt><dd>' + t.maxHomeRun + ' · ' + t.maxAwayRun + '</dd></dl></div>', { right: '<button class="sp-link" data-act="selTeam" data-arg="' + esc(t.name) + '">닫기</button>' });
    } else b += SP.mSec('선택한 구단', '<p class="sp-note-s">표 행이나 차트 막대를 누르면 그 구단을 강조하고 여기에 요약을 보여 줍니다.</p>');
    if (tab === 'charts') b += SP.mSec('그림 목록', '<ul class="sp-mlist"><li><span class="sp-mlist-t">4.1 총 이동거리 · 4.2 이동 횟수·휴일 · 4.3 홈/원정 흐름</span><span class="sp-muted">필수</span></li><li><span class="sp-mlist-t">' + ['A4 누적 이동거리', 'A5 상대 매트릭스', 'A8 주중 이동', 'A9 혹서기', 'A10 장거리 원정', 'A12 월별 홈'].filter((x) => SP.on(x.split(' ')[0])).join(' · ') + '</span><span class="sp-muted">선택</span></li></ul><p class="sp-note-s">선택 차트는 설정 › 기능 목록에서 켜고 끕니다.</p>');
    b += SP.mSec('내보내기', '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">' + SP.btn('mockToast', '.xlsx 내보내기 ' + SP.mock(), { arg: '.xlsx 내보내기' }) + (SP.on('D4') ? SP.btn('exportCsv', '일정표 CSV') : '') + SP.btn('exportProject', '프로젝트 JSON') + SP.btn('exportEngine', '엔진 입력 JSON') + '</div><p class="sp-note-s">.xlsx는 가져오기와 같은 시트·열 구성이라 엑셀에서 고쳐 다시 올릴 수 있습니다.</p>');
    const next = '<p>' + (ex.feasible ? '배포본을 만들 수 있습니다.' : '⛔ Hard 위반이 남아 있어 배포 전 제3장에서 고쳐야 합니다.') + '</p><div class="sp-row">' + SP.btn('go', '구단별 일정표', { arg: '4:schedule', cls: 'sp-grow' }) + SP.btn('print', '인쇄', { kind: 'primary', cls: 'sp-grow' }) + '</div>';
    return { body: b, next };
  }
  SP.act.exportCsv = () => app.exportCSV(ui.tab[4] === 'schedule' ? ui.schedTeam : null);

  SP.chapters[4] = {
    n: 4, id: 'quality', title: '품질·배포', task: '공정성을 확인하고 배포본을 만든다',
    get tabs() { return tabs(); },
    summary() { const over = tms().filter((t) => t.overDistance || t.overMoves || t.overHoliday).length; return '평균 이동 ' + fmt.km(L().meanDistanceKm) + 'km · 허용오차 초과 ' + over + '구단'; },
    card() { return '리그 총 ' + fmt.int(L().totalKm) + 'km · 평균 ' + fmt.km(L().meanDistanceKm) + 'km'; },
    status() {
      const over = tms().filter((t) => t.overDistance || t.overMoves || t.overHoliday).length;
      if (over) return { kind: 'warn', text: '초과 ' + over + '구단', short: '초과 ' + over + '구단' };
      return { kind: 'draft', text: '작성 중', short: '작성 중' };
    },
    main(tab) {
      const t = tabs();
      if (!t.some((x) => x.id === tab)) tab = ui.tab[4] = 'metrics';
      const lead = { metrics: '채점 지표는 엔진 허용오차와 함께, 참고 지표는 따로 표시한다.', soft: '어느 단계의 감점이 어느 구단 때문인지 본다.', charts: '필수 차트 3종과 설정에서 켠 선택 차트만 그린다.', schedule: '구단 운영팀에 나눠 줄 일정표. 인쇄 버튼은 이 표만 출력한다.' }[tab];
      const body = tab === 'soft' ? softTable() : tab === 'charts' ? figs() : tab === 'schedule' ? schedule() : metricsTable();
      return SP.subhead(4, t, tab, '', lead) + '<div class="sp-body">' + body + '</div>';
    },
    margin: marginQuality
  };
})();
