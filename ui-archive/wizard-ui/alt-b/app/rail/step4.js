/*
 * alt-b 단계 레일 — ④ 품질·배포.
 * 구단 지표(표 ↔ Soft 분해·지표 차트), 차트(목록 ↔ 큰 차트), 구단별 일정표(구단 선택 ↔ 인쇄 미리보기), 내보내기(형식 ↔ 배포 점검).
 */
(function () {
  'use strict';
  const R = window.R;
  const KBO = R.KBO, D = KBO.Dates, Sc = KBO.Score;
  const esc = R.esc;
  const u = R.ui;
  u.msort = { key: 'distanceKm', dir: -1 };
  u.metric = 'distanceKm';
  u.selTeam4 = null;
  u.chart = 'A1';
  u.schedTeam = 'KIA';

  const COLS = [
    { key: 'distanceKm', label: '이동거리', unit: 'km', scored: 'S2·S4', fmt: (v) => R.fmt.km(v), over: 'overDistance', tol: 300 },
    { key: 'moves', label: '이동 횟수', unit: '회', scored: 'S1', fmt: R.fmt.int, over: 'overMoves', tol: 2 },
    { key: 'holidayWeight', label: '휴일 가중치', unit: '', scored: 'S3', fmt: R.fmt.int, over: 'overHoliday', tol: 1.5 },
    { key: 'weekendHome', label: '주말 홈', unit: '시리즈', fmt: R.fmt.int },
    { key: 'holidayHomeGames', label: '공휴일 홈', unit: '경기', fmt: R.fmt.int },
    { key: 'maxRun', label: '최장 연속', unit: '홈/원정', fmt: (v, t) => t.maxHomeRun + ' / ' + t.maxAwayRun },
    { key: 'weekdayMoves', label: '주중 이동', unit: '회', fmt: R.fmt.int, feature: 'A8' }
  ];
  function cols() { return COLS.filter((c) => !c.feature || R.feature(c.feature)); }
  function val(t, key) { return key === 'maxRun' ? Math.max(t.maxHomeRun, t.maxAwayRun) : t[key]; }
  function mean(d, key) { const tm = d.ex.teamMetrics; return tm.reduce((a, t) => a + val(t, key), 0) / tm.length; }

  // ───────── 구단 지표 ─────────
  function metricsLeft(d) {
    const tm = d.ex.teamMetrics.slice();
    const s = u.msort;
    tm.sort((a, b) => (val(a, s.key) - val(b, s.key)) * s.dir);
    const cs = cols();
    const scored = cs.filter((c) => c.scored), ref = cs.filter((c) => !c.scored);
    let h = '<thead><tr class="grp"><th></th><th colspan="' + scored.length + '" class="g-sc">채점 지표 · 엔진이 최적화</th><th colspan="' + ref.length + '" class="g-ref">참고 지표 · 점수 미반영</th></tr><tr><th>구단</th>';
    for (const c of cs) h += '<th class="n sortable' + (u.metric === c.key ? ' is-metric' : '') + '"><button data-act="msort" data-k="' + c.key + '" aria-label="' + c.label + ' 정렬">' + c.label + (c.scored ? ' <span class="sc">' + c.scored + '</span>' : ' <span class="rf">참고</span>') + (s.key === c.key ? (s.dir < 0 ? ' ▼' : ' ▲') : '') + '</button></th>';
    h += '</tr></thead>';
    let b = '<tbody>';
    for (const t of tm) {
      b += '<tr class="' + (u.selTeam4 === t.name ? 'sel' : '') + '" data-act="msel" data-team="' + esc(t.name) + '"><td>' + R.team(t.name, { strong: true }) + '</td>';
      for (const c of cs) {
        const over = c.over && t[c.over];
        const dev = c.tol ? val(t, c.key) - mean(d, c.key) : null;
        b += '<td class="n' + (over ? ' over' : '') + (u.metric === c.key ? ' is-metric' : '') + '">' + (over ? '<span class="overtag" title="허용오차 초과">' + R.icon('warn') + '<span class="sr">초과</span></span>' : '') + c.fmt(val(t, c.key), t) + (dev != null ? '<small class="dev">' + (dev >= 0 ? '+' : '−') + (c.key === 'distanceKm' ? R.fmt.km(Math.abs(dev)) : R.fmt.num1(Math.abs(dev))) + '</small>' : '') + '</td>';
      }
      b += '</tr>';
    }
    b += '</tbody><tfoot><tr><td><b>리그 평균</b></td>' + cs.map((c) => '<td class="n">' + (c.key === 'maxRun' ? '—' : c.key === 'distanceKm' ? R.fmt.km(mean(d, c.key)) : R.fmt.num1(mean(d, c.key))) + (c.tol ? '<small class="dev">±' + c.tol + '</small>' : '') + '</td>').join('') + '</tr></tfoot>';
    const overN = d.ex.teamMetrics.filter((t) => t.overDistance || t.overMoves || t.overHoliday).length;
    return R.pane({ title: '구단 지표 비교', sub: '열 머리를 누르면 정렬하고 오른쪽 차트가 그 지표로 바뀝니다', tools: overN ? R.st('warn', '허용오차 초과 ' + overN + '구단') : R.st('ok', '모두 허용오차 안'), flush: true, sk: 'metrics', cls: 'pane-mtbl',
      body: '<table class="tbl mtbl">' + h + b + '</table><p class="hint pad">작은 숫자는 리그 평균 대비 편차, 평균 행의 ±는 엔진 허용오차(이동거리 300km, 이동 2회, 휴일 1.5)입니다.</p>' });
  }
  function metricsRight(d) {
    const sb = d.ex.softBreakdown;
    const c = COLS.find((x) => x.key === u.metric) || COLS[0];
    const tm = d.ex.teamMetrics;
    const rows = [
      ['S0', '미배정 시리즈', sb.S0.total, sb.S0.items.length + '개'],
      ['S1', '이동 횟수 분산', sb.S1.total, '평균 ' + R.fmt.num1(sb.S1.mean) + '회 · 허용 ±2'],
      ['S2', '이동 거리 분산', sb.S2.total, '평균 ' + R.fmt.km(sb.S2.meanKm) + 'km · 허용 ±300'],
      ['S3', '휴일 가중치 분산', sb.S3.total, '평균 ' + R.fmt.num1(sb.S3.mean) + ' · 허용 ±1.5'],
      ['S4', '리그 총 이동거리', sb.S4.total, R.fmt.int(-sb.S4.total) + 'km']
    ];
    const key = { S1: 'S1', S2: 'S2', S3: 'S3' };
    let b = '<div class="soft">' + rows.map((r) => {
      const items = key[r[0]] ? sb[r[0]].items.filter((x) => x.contrib > 0).sort((a, z) => z.contrib - a.contrib) : [];
      return '<div class="soft-r' + (r[2] ? '' : ' zero') + '"><span class="soft-c">' + r[0] + '</span><div class="soft-t"><b>' + r[1] + '</b><span class="hint">' + r[3] + (items.length ? ' · 원인 ' + items.slice(0, 3).map((x) => d.ex.teamMetrics[x.team].name + ' ' + R.fmt.int(-x.contrib)).join(', ') : '') + '</span></div><span class="soft-v num">' + R.fmt.int(r[2]) + '</span></div>';
    }).join('') + '</div>';
    b = '<div class="sect"><div class="sect-h"><h3>Soft 분해</h3><span class="hint">0에 가까울수록 좋음 · 어떤 구단 값 때문인지 함께 표시</span></div>' + b + '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>' + c.label + (c.scored ? '' : ' <span class="rf">참고</span>') + '</h3><span class="hint">' + (c.tol ? '평균선 · 허용오차 밴드 · 빗금 = 초과' : '평균선') + '</span></div>' + R.chart.bars({
      items: tm.map((t) => ({ label: t.name, value: val(t, c.key), over: c.over ? t[c.over] : false, sel: u.selTeam4 === t.name, act: 'msel-chart' })).sort((a, z) => z.value - a.value),
      mean: mean(d, c.key), tol: c.tol, width: 420, rowH: 21, labelW: 42, fmt: c.key === 'distanceKm' ? (v) => R.fmt.km(v) : R.fmt.int, min: c.key === 'distanceKm' ? 5000 : 0, title: c.label
    }) + '</div>';
    return R.pane({ cls: 'pane-live', title: '점수 구성과 지표', kicker: '즉시 결과', live: true, body: b, sk: 'soft' });
  }

  // ───────── 차트 ─────────
  const CHARTS = [
    { id: 'A1', name: '구단별 총 이동거리', desc: '평균선 + ±300km 허용오차 밴드', must: true },
    { id: 'A2', name: '이동 횟수·휴일 가중치·주말 홈', desc: '점 차트 3개, 평균과 허용오차', must: true },
    { id: 'A3', name: '홈/원정 흐름 (구단 × 슬롯)', desc: '3연속 초과 강조', must: true },
    { id: 'A4', name: '누적 이동거리', desc: '시즌 진행에 따른 선 차트', feature: 'A4' },
    { id: 'A5', name: '상대 매트릭스', desc: '구단쌍 경기 수와 홈/원정 분배', feature: 'A5' },
    { id: 'A8', name: '주중 이동 분석', desc: '주중 → 주말 이동 횟수·거리 (참고)', feature: 'A8' },
    { id: 'A9', name: '혹서기 부담', desc: '7~8월 원정 경기, 돔 표기', feature: 'A9' },
    { id: 'A10', name: '장거리 연속 원정', desc: '연속 원정 2시리즈 이상 · 600km 초과', feature: 'A10' },
    { id: 'A12', name: '월별 홈경기 히트맵', desc: '구단 × 월', feature: 'A12' }
  ];
  function chartsOn() { return CHARTS.filter((c) => c.must || R.feature(c.feature)); }
  function chartsLeft() {
    const list = chartsOn();
    if (!list.some((c) => c.id === u.chart)) u.chart = 'A1';
    const item = (c) => '<li><button class="chl' + (u.chart === c.id ? ' is-on' : '') + '" data-act="chart" data-id="' + c.id + '"><span class="chl-id">' + c.id + '</span><span class="chl-t"><b>' + c.name + '</b><span class="hint">' + c.desc + '</span></span></button></li>';
    const must = list.filter((c) => c.must), opt = list.filter((c) => !c.must);
    const off = CHARTS.filter((c) => !c.must && !R.feature(c.feature)).length;
    const b = '<div class="chl-g">필수</div><ul class="chlist">' + must.map(item).join('') + '</ul><div class="chl-g">선택 (켜진 것만)</div><ul class="chlist">' + opt.map(item).join('') + '</ul>' + (off ? '<p class="hint pad0">꺼진 차트 ' + off + '개 · <button class="lnk" data-act="go" data-view="settings">설정에서 켜기</button></p>' : '');
    return R.pane({ title: '차트', sub: list.length + '개', body: b, sk: 'chl' });
  }
  function chartsRight(d) {
    const st = R.state();
    const tm = d.ex.teamMetrics;
    const c = CHARTS.find((x) => x.id === u.chart);
    const lg = d.ex.league;
    const W = window.innerWidth >= 1800 ? 1180 : 820;
    let b = '';
    if (c.id === 'A1') b = R.chart.bars({ items: tm.map((t) => ({ label: t.name, value: t.distanceKm, over: t.overDistance })).sort((a, z) => z.value - a.value), mean: lg.meanDistanceKm, tol: 300, width: W, rowH: window.innerHeight >= 900 ? 44 : 34, labelW: 52, min: 5000, fmt: (v) => R.fmt.km(v), title: 'A1' });
    else if (c.id === 'A2') {
      const mw = d.ex.league.meanWeekendHome;
      b = '<div class="a2">' + [['이동 횟수', 'moves', lg.meanMoves, 2, 'overMoves'], ['휴일 가중치', 'holidayWeight', lg.meanHoliday, 1.5, 'overHoliday'], ['주말 홈 (참고)', 'weekendHome', mw, 0, null]].map((x) => '<div class="a2-r"><div class="sect-h"><h3>' + x[0] + '</h3><span class="hint">평균 ' + R.fmt.num1(x[2]) + (x[3] ? ' · 허용 ±' + x[3] : ' · 점수 미반영') + '</span></div>' + R.chart.dotRow({ items: tm.map((t) => ({ label: t.name, value: t[x[1]], color: st.teams[t.team].color, over: x[4] ? t[x[4]] : false })), mean: x[2], tol: x[3], width: W, height: 70, title: x[0] }) + '<div class="a2-lbl">' + tm.slice().sort((a, z) => a[x[1]] - z[x[1]]).map((t) => '<span>' + R.team(t.name) + ' ' + t[x[1]] + '</span>').join('') + '</div></div>').join('') + '</div>';
    } else if (c.id === 'A3') {
      const months = []; let last = 0;
      d.slots.forEach((s) => { if (s.month !== last) { months.push({ slot: s.index, label: s.month + '월' }); last = s.month; } });
      b = R.chart.flow({ slots: d.slots.length, months, width: W, rowH: window.innerHeight >= 900 ? 52 : 38, rows: tm.map((t) => ({ name: t.name, cells: t.visits.map((v) => ({ slot: v.slot, home: v.home, over: v.run > 3, title: d.slots[v.slot].label + ' vs ' + tm[v.opp].name })) })) }) + '<div class="legend"><span><i class="lg lg-home"></i>홈</span><span><i class="lg lg-away"></i>원정</span><span><i class="lg lg-viol"></i>! 같은 쪽 4연속 이상 (H0-f)</span></div>';
    } else if (c.id === 'A4') {
      const S = d.slots.length;
      b = R.chart.lines({ width: W, height: window.innerHeight >= 900 ? 560 : 400, title: 'A4', xLabels: d.slots.filter((s, i) => i === 0 || d.slots[i - 1].month !== s.month).map((s) => ({ i: s.index, label: s.month + '월' })), series: tm.map((t) => { const v = new Array(S).fill(0); let cur = 0; const by = new Map(t.visits.map((x) => [x.slot, x.cumTenths / 10])); for (let s = 0; s < S; s++) { if (by.has(s)) cur = by.get(s); v[s] = cur; } return { name: t.name, color: st.teams[t.team].color, values: v, sel: t.name === 'KIA' }; }) });
    } else if (c.id === 'A5') {
      const names = st.teams.map((t) => t.name);
      b = '<div class="mxbig">' + R.chart.matrix({ rows: names, cols: names, cell: window.innerHeight >= 900 ? 56 : 42, labelW: 48, title: 'A5', value: (i, j) => { if (i === j) return null; const ms = st.matches.filter((m, k) => d.plan[k] >= 0 && m.home === names[i] && m.away === names[j]); const g = ms.reduce((a, z) => a + z.consecutive, 0); return { v: g, text: g, title: names[j] + ' @ ' + names[i] + ' ' + g + '경기' }; } }) + '<p class="hint">행 = 홈, 열 = 원정. 구단쌍 15경기 = 홈 9 + 원정 6 (O-1 미결).</p></div>';
    } else if (c.id === 'A8') b = R.chart.bars({ items: tm.map((t) => ({ label: t.name, value: t.weekdayMoveKm })).sort((a, z) => z.value - a.value), mean: tm.reduce((a, t) => a + t.weekdayMoveKm, 0) / tm.length, width: W, rowH: 34, labelW: 52, fmt: (v) => R.fmt.km(v), title: 'A8' }) + '<p class="hint">주중 슬롯 → 다음 주말 슬롯 구간 이동거리(km). 허용오차 1.5는 정의만 있고 점수에는 반영되지 않습니다.</p>';
    else if (c.id === 'A9') b = R.chart.bars({ items: tm.map((t) => ({ label: t.name + (t.name === '키움' ? ' (돔)' : ''), value: t.summerAwayGames })).sort((a, z) => z.value - a.value), mean: tm.reduce((a, t) => a + t.summerAwayGames, 0) / tm.length, width: W, rowH: 34, labelW: 72, title: 'A9' }) + '<p class="hint">7~8월 원정 경기 수. 키움(고척돔)은 홈 경기가 더위 영향을 받지 않습니다.</p>';
    else if (c.id === 'A10') {
      const trips = []; for (const t of tm) for (const x of t.longTrips) trips.push({ t, x });
      trips.sort((a, z) => z.x.tenths - a.x.tenths);
      b = '<table class="tbl"><thead><tr><th>구단</th><th>기간</th><th class="n">시리즈</th><th class="n">구간 거리</th></tr></thead><tbody>' + trips.slice(0, 14).map((r) => '<tr><td>' + R.team(r.t.name, { strong: true }) + '</td><td>' + esc(d.slots[r.x.slots[0]].label) + ' ~ ' + esc(d.slots[r.x.slots[r.x.slots.length - 1]].label) + '</td><td class="n">' + r.x.series + '</td><td class="n">' + R.fmt.km(r.x.tenths / 10) + 'km</td></tr>').join('') + '</tbody></table><p class="hint">' + trips.length + '구간 · 임계값 ' + st.settings.longTripKm + 'km (설정)</p>';
    } else if (c.id === 'A12') {
      const names = st.teams.map((t) => t.name); const mos = [3, 4, 5, 6, 7, 8];
      b = R.chart.matrix({ rows: names, cols: mos.map((m) => m + '월'), cell: 52, labelW: 48, title: 'A12', value: (i, j) => { const g = st.matches.reduce((a, m, k) => a + (d.plan[k] >= 0 && m.home === names[i] && d.slots[d.plan[k]].month === mos[j] ? m.consecutive : 0), 0); return { v: g, text: g, title: names[i] + ' ' + mos[j] + '월 홈 ' + g + '경기' }; } });
    }
    return R.pane({ cls: 'pane-live pane-chart', title: c.id + ' · ' + c.name, kicker: c.must ? '필수 차트' : '선택 차트', live: true, sub: c.desc, body: '<div class="chartbox">' + b + '</div>', sk: 'chart' });
  }

  // ───────── 구단별 일정표 (FR-A11) ─────────
  function schedLeft(d) {
    const st = R.state();
    const b = '<div class="sect-h"><h3>구단</h3><span class="hint">구단 운영팀 배포용</span></div><ul class="teampick">' + st.teams.map((t) => '<li><button class="tpk' + (u.schedTeam === t.name ? ' is-on' : '') + '" data-act="sched-team" data-team="' + esc(t.name) + '"><span class="swatch" style="background:' + esc(t.color) + '"></span><b>' + esc(t.name) + '</b><span class="hint">' + esc(R.shortStadium(t.stadium)) + '</span></button></li>').join('') + '</ul>' +
      '<div class="sect"><div class="sect-h"><h3>인쇄 옵션</h3></div><label class="chk"><input type="checkbox" checked> 이동거리 열</label><label class="chk"><input type="checkbox" checked> 월별 구분선</label><label class="chk"><input type="checkbox"> 재편성 기간 포함</label></div>' +
      '<div class="sect btns"><button class="btn btn-primary" data-act="print">' + R.icon('print') + '인쇄</button>' + (R.feature('D4') ? '<button class="btn" data-act="export" data-kind="csv">' + R.icon('download') + '이 구단 CSV</button>' : '') + '</div>';
    return R.pane({ title: '구단별 일정표', body: b, sk: 'sl' });
  }
  function schedRight(d) {
    const st = R.state();
    const t = d.ex.teamMetrics.find((x) => x.name === u.schedTeam);
    let rows = '', lastMo = 0;
    for (const v of t.visits) {
      const sl = d.slots[v.slot];
      if (sl.month !== lastMo) { rows += '<tr class="mo"><td colspan="5">' + sl.month + '월</td></tr>'; lastMo = sl.month; }
      const opp = st.teams[v.opp].name;
      rows += '<tr><td>' + esc(R.fmt.range(sl.days[0], sl.days[sl.days.length - 1])) + '</td><td>' + (v.home ? '<b>홈</b>' : '원정') + '</td><td>' + esc(opp) + '</td><td>' + esc(R.shortStadium(st.teams[v.loc].stadium)) + '</td><td class="n">' + (v.legTenths ? R.fmt.km(v.legTenths / 10) : '—') + '</td></tr>';
    }
    const page = '<div class="paper"><div class="paper-h"><div><b>' + esc(u.schedTeam) + ' 2025 정규시즌 1차 일정</b><span>3/22(토) ~ 8/31(일) · ' + t.visits.length + '시리즈 · 홈 ' + t.homeGames + ' / 원정 ' + t.awayGames + '경기</span></div><span class="paper-k">KBO 사무국 · 배포용 초안</span></div><table class="ptbl"><thead><tr><th>기간</th><th>구분</th><th>상대</th><th>구장</th><th class="n">이동 km</th></tr></thead><tbody>' + rows + '</tbody></table><div class="paper-f">총 이동거리 ' + R.fmt.km(t.distanceKm) + 'km · 이동 ' + t.moves + '회 · 1 / 2쪽</div></div>';
    return R.pane({ cls: 'pane-live', title: '인쇄 미리보기', kicker: 'A4 세로', live: true, body: '<div class="paperwrap">' + page + '</div>', sk: 'paper', flush: true });
  }

  // ───────── 내보내기 ─────────
  function exportLeft(d) {
    const items = [
      ['xlsx', '.xlsx 내보내기', '가져오기와 같은 시트 6개 + 안내 시트. 다시 가져오면 같은 상태'],
      ['template', '빈 양식 + 2025 예시', '머리글·열 설명·예시 1행'],
      ['engine', '엔진 JSON (input_2025 형식)', 'teams · distanceMatrix · calendar · matches · initialPlan'],
      ['project', '프로젝트 JSON', '입력·배정·스냅샷·경기 기록 전체']
    ];
    if (R.feature('D4')) items.push(['csv', '일정표 CSV', '날짜 · 원정 · 홈 · 구장 · 상태']);
    const b = '<ul class="exlist">' + items.map((x) => '<li><div><b>' + x[1] + '</b><span class="hint">' + x[2] + '</span></div><button class="btn btn-sm" data-act="export" data-kind="' + x[0] + '">' + R.icon('download') + '받기</button></li>').join('') + '</ul><p class="hint pad0">' + R.mock() + ' 파일 생성은 목업입니다.</p>';
    return R.pane({ title: '내보내기', body: b, sk: 'ex' });
  }
  function exportRight(d) {
    const hard = d.ex.violations.length;
    const over = d.ex.teamMetrics.filter((t) => t.overDistance || t.overMoves || t.overHoliday).length;
    const checks = [
      [hard ? 'block' : 'ok', 'Hard 위반 0', hard ? hard + '건 남음 — ③에서 정리' : '편성 가능', hard ? { step: 3 } : null],
      [d.pool.length ? 'block' : 'ok', '미배정 시리즈 0', d.pool.length ? d.pool.length + '개' : '225개 모두 배정', d.pool.length ? { step: 3 } : null],
      [over ? 'warn' : 'ok', '공정성 허용오차', over ? over + '구단 초과 (경고만)' : '모두 안', over ? { step: 4, tab: 'metrics' } : null],
      [R.state().snapshots.length ? 'ok' : 'warn', '배포 전 스냅샷', R.state().snapshots.length + '개 저장됨', null]
    ];
    const blocked = checks.some((c) => c[0] === 'block');
    const b = '<ul class="pf">' + checks.map((c) => '<li class="pf-i st-' + c[0] + '">' + R.stIcon(c[0]) + '<div class="pf-t"><b>' + c[1] + '</b><span>' + esc(c[2]) + '</span></div>' + (c[3] ? '<button class="lnk pf-go" data-act="go" data-step="' + c[3].step + '"' + (c[3].tab ? ' data-tab="' + c[3].tab + '"' : '') + '>고치기 →</button>' : '<span></span>') + '</li>').join('') + '</ul>' +
      '<div class="runbox' + (blocked ? ' blocked' : '') + '"><button class="btn btn-lg btn-primary" data-act="publish"' + (blocked ? ' disabled' : '') + '>' + R.icon(blocked ? 'lock' : 'ok') + '배포본 만들기</button><span class="hint">' + (blocked ? '차단 항목을 먼저 해결하세요. 배포본은 Hard 0일 때만 만들 수 있습니다.' : '확정 스냅샷과 .xlsx·구단별 일정표를 함께 만듭니다.') + '</span></div>';
    return R.pane({ cls: 'pane-live', title: '배포 점검', kicker: '즉시 결과', live: true, body: b, sk: 'pub' });
  }

  R.screens['w4-metrics'] = { left: metricsLeft, right: metricsRight };
  R.screens['w4-charts'] = { left: chartsLeft, right: chartsRight, cls: 'narrow-left' };
  R.screens['w4-schedule'] = { left: schedLeft, right: schedRight, cls: 'narrow-left' };
  R.screens['w4-export'] = { left: exportLeft, right: exportRight, cls: 'even' };

  Object.assign(R.act, {
    msort(el, e) { if (e) e.stopPropagation(); const k = el.getAttribute('data-k'); if (u.msort.key === k) u.msort.dir *= -1; else u.msort = { key: k, dir: -1 }; u.metric = k; R.render(); },
    msel(el) { const t = el.getAttribute('data-team'); u.selTeam4 = u.selTeam4 === t ? null : t; R.render(); },
    'msel-chart'(el) { const t = el.getAttribute('data-v'); u.selTeam4 = u.selTeam4 === t ? null : t; R.render(); },
    chart(el) { u.chart = el.getAttribute('data-id'); R.render(); },
    'sched-team'(el) { u.schedTeam = el.getAttribute('data-team'); R.render(); },
    print() { R.toast('인쇄 미리보기 (목업): 브라우저 인쇄 대화상자를 엽니다.', 'info'); },
    publish() { R.published = '10/19 확정'; R.toast('배포본을 만들었습니다 (목업).', 'ok'); R.store._notify({ tags: new Set(['all']) }); }
  });
  R.demo = R.demo || {};
  R.demo.chart = (v) => { u.chart = v; };
  R.demo.team4 = (v) => { u.selTeam4 = v; };
  void D; void Sc;
})();
