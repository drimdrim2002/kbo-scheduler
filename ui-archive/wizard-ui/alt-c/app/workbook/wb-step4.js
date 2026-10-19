/*
 * alt-c 편성 워크북 — ④ 품질·배포.
 * 지표 시트(조건부 서식 + 얹힌 차트 개체 A1·A2), 흐름 시트(A3), 차트 시트·선택 분석(A4·A5·A8·A9·A10·A12),
 * 구단별 일정표 인쇄 미리보기(A11), Soft 분해·배포 작업 창.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const KBO = window.KBO;
  const D = KBO.Dates;
  const esc = WB.esc, icon = WB.icon, fmt = WB.fmt;
  const S4 = WB.steps[4] = {};
  const der = () => WB.app.derived();

  S4.status = function () {
    const ex = der().ex;
    const over = ex.teamMetrics.reduce((a, t) => a + (t.overDistance ? 1 : 0) + (t.overMoves ? 1 : 0) + (t.overHoliday ? 1 : 0), 0);
    const n = WB.ui.exported || 0;
    const sum = '허용오차 초과 ' + over + '칸 · 리그 총 이동 ' + ex.league.totalKm.toLocaleString('ko-KR') + 'km · ' + (n ? '배포본 ' + n + '개' : '배포본 없음');
    if (n && ex.feasible) return { kind: 'ok', label: '완료', short: '✔ 배포', summary: sum };
    return { kind: 'todo', label: '작성 중', short: '○ 작성 중', summary: sum };
  };

  const SHEETS = [
    { id: 'metrics', name: '지표', ico: 'sheet' },
    { id: 'flow', name: '홈/원정 흐름', ico: 'grid', fr: 'A3' },
    { id: 'cum', name: '누적 이동거리', ico: 'chart', key: 'A4' },
    { id: 'opp', name: '상대 매트릭스', ico: 'grid', key: 'A5' },
    { id: 'weekday', name: '주중 이동', ico: 'sheet', key: 'A8' },
    { id: 'summer', name: '혹서기 부담', ico: 'sheet', key: 'A9' },
    { id: 'long', name: '장거리 원정', ico: 'sheet', key: 'A10' },
    { id: 'heat', name: '월별 홈경기', ico: 'grid', key: 'A12' },
    { id: 'print', name: '구단별 일정표', ico: 'print', key: 'A11' }
  ];
  const visible = () => SHEETS.filter((s) => !s.key || WB.feature(s.key));

  // ───────────── 지표 시트 ─────────────
  const MCOLS = [
    { label: '구단', w: 64, get: (t) => t.name, txt: true },
    { label: '이동거리 km', w: 118, tag: '채점', get: (t) => t.distanceKm, f: fmt.km, s: 'S2·S4' },
    { label: '평균 대비', w: 104, get: (t, L) => t.distanceKm - L.meanDistanceKm, f: (v) => fmt.signed(v, fmt.km), over: (t) => t.overDistance },
    { label: '이동 횟수', w: 74, tag: '채점', get: (t) => t.moves, f: (v) => v, s: 'S1' },
    { label: '평균 대비', w: 78, get: (t, L) => t.moves - L.meanMoves, f: (v) => fmt.signed(v), over: (t) => t.overMoves },
    { label: '휴일 가중치', w: 84, tag: '채점', get: (t) => t.holidayWeight, f: (v) => v, s: 'S3' },
    { label: '평균 대비', w: 78, get: (t, L) => t.holidayWeight - L.meanHoliday, f: (v) => fmt.signed(v), over: (t) => t.overHoliday },
    { label: '주말 홈', w: 66, tag: '참고', get: (t) => t.weekendHome, f: (v) => v },
    { label: '주말 원정', w: 70, get: (t) => t.weekendAway, f: (v) => v },
    { label: '최장 연속 홈', w: 88, tag: '참고', get: (t) => t.maxHomeRun, f: (v) => v, warn: (v) => v > 3 },
    { label: '최장 연속 원정', w: 96, get: (t) => t.maxAwayRun, f: (v) => v, warn: (v) => v > 3 },
    { label: '공휴일 홈경기', w: 92, tag: '참고', get: (t) => t.holidayHomeGames, f: (v) => v },
    { label: '홈 경기', w: 64, get: (t) => t.homeGames, f: (v) => v }
  ];
  function metricsGrid() {
    const ex = der().ex;
    const L = ex.league;
    const sort = WB.ui.sort4 || { c: 1, dir: 'desc' };
    const rows = ex.teamMetrics.slice();
    rows.sort((a, b) => { const va = MCOLS[sort.c].get(a, L), vb = MCOLS[sort.c].get(b, L); const d = MCOLS[sort.c].txt ? String(va).localeCompare(String(vb)) : va - vb; return sort.dir === 'asc' ? d : -d; });
    const maxD = Math.max(...rows.map((t) => t.distanceKm));
    const hostW = (document.getElementById('gridhost').clientWidth || 1100) - 38 - 18;
    const sumW = MCOLS.reduce((a, c) => a + c.w, 0);
    const k = Math.max(1, Math.min(1.5, hostW / sumW));
    const cols = MCOLS.map((c, i) => ({ label: c.label, w: Math.floor(c.w * k), cls: i ? 'n' : '', tag: c.tag, sortable: true, sortDir: sort.c === i ? sort.dir : null, title: c.s ? '엔진 점수 ' + c.s + '에 반영' : c.tag === '참고' ? '참고 — 엔진이 최적화하지 않음' : '' }));
    const n = rows.length;
    const tolRow = ['허용오차', '±300.0', '', '±2', '', '±1.5', '', '', '', '≤ 3', '≤ 3', '', ''];
    const avgRow = ['리그 평균', fmt.km(L.meanDistanceKm), '', fmt.n1(L.meanMoves), '', fmt.n1(L.meanHoliday), '', fmt.n1(L.meanWeekendHome), '', '', '', '', ''];
    return {
      key: 's4-metrics', sheet: '지표', cols, rows: n + 2, fill: 0, readOnly: true,
      group: [{ text: '', span: 1 }, { h: '<span class="tag tag-s">채점</span> 엔진 점수에 반영되는 지표', span: 6 }, { h: '<span class="tag tag-r">참고</span> 엔진이 직접 최적화하지 않는 지표', span: 6 }],
      rowNo: (r) => r + 3, headNo: 2,
      rowCls: (r) => (r === n ? 'tot' : r === n + 1 ? 'tot2' : ''),
      cell: (r, c) => {
        if (r === n) return { t: avgRow[c] };
        if (r === n + 1) return { t: tolRow[c] };
        const t = rows[r];
        const col = MCOLS[c];
        const v = col.get(t, L);
        if (c === 0) { const tm = WB.app.team(t.name); return { h: '<span class="row"><span style="width:8px;height:8px;border-radius:1px;background:' + esc(tm.color) + '"></span>' + esc(t.name) + '</span>' }; }
        if (c === 1) return { h: '<span class="bar' + (t.overDistance ? ' over' : '') + '" style="width:' + (v / maxD * 58).toFixed(1) + '%"></span><span class="bv">' + fmt.km(v) + '</span>' };
        if (col.over) { const o = col.over(t); return { t: (o ? '▲ ' : '') + col.f(v) + (o ? ' 초과' : ''), cls: o ? 'cf-bad' : '', mk: o ? { level: 'error', title: '허용오차 초과', text: t.name + ' ' + MCOLS[c - 1].label + '이(가) 리그 평균과 허용오차 이상 차이 납니다 — Soft ' + MCOLS[c - 1].s + ' 감점' } : null }; }
        if (col.warn && col.warn(v)) return { t: '▲ ' + v, cls: 'cf-bad' };
        return { t: col.f(v) };
      },
      onHead: (c) => { const s = WB.ui.sort4 || { c: 1, dir: 'desc' }; WB.ui.sort4 = { c, dir: s.c === c && s.dir === 'desc' ? 'asc' : 'desc' }; WB.render(); },
      onSelect: (r, c) => {
        const t = rows[r];
        WB.fx({ addr: '지표!' + WB.colName(c) + (r + 3), value: r < n ? String(MCOLS[c].f ? MCOLS[c].f(MCOLS[c].get(t, L)) : MCOLS[c].get(t, L)) : (r === n ? avgRow : tolRow)[c], meta: (r < n ? esc(t.name) + ' · ' : '') + esc(MCOLS[c].label) + (MCOLS[c].s ? ' · 채점 ' + MCOLS[c].s : MCOLS[c].tag === '참고' ? ' · 참고' : '') + ' · 머리글 클릭 = 정렬' });
        WB.ui.hlTeam = r < n ? t.name : null;
        renderPane();
      },
      after: '<div class="objarea" id="objarea"></div>'
    };
  }

  function drawObjects(host) {
    const area = host.querySelector('#objarea');
    if (!area) return;
    const ex = der().ex, L = ex.league;
    const W = area.clientWidth, H = host.clientHeight - area.offsetTop;
    if (H < 120) { area.innerHTML = ''; return; }
    const gap = 12, w1 = Math.floor((W - gap * 3) * 0.5), w2 = W - gap * 3 - w1, h = H - gap * 2;
    const hl = WB.ui.hlTeam;
    const items = ex.teamMetrics.map((t) => ({ label: t.name, value: Math.round(t.distanceKm * 10) / 10, over: t.overDistance }));
    const c1 = WB.Charts.bars({ w: w1 - 14, h: h - 34, items, avg: L.meanDistanceKm, band: [L.meanDistanceKm - 300, L.meanDistanceKm + 300], fmt: (v) => Math.round(v).toLocaleString('ko-KR'), yMin: 5500, title: '구단별 총 이동거리' });
    const c2 = WB.Charts.dots({ w: w2 - 14, h: h - 34, title: '이동·휴일·주말 비교', rows: [
      { title: '이동 횟수', items: ex.teamMetrics.map((t) => ({ label: t.name, value: t.moves, over: t.overMoves })), avg: L.meanMoves, tol: 2 },
      { title: '휴일 가중치', items: ex.teamMetrics.map((t) => ({ label: t.name, value: t.holidayWeight, over: t.overHoliday })), avg: L.meanHoliday, tol: 1.5 },
      { title: '주말 홈 (참고)', items: ex.teamMetrics.map((t) => ({ label: t.name, value: t.weekendHome })), avg: L.meanWeekendHome, tol: 2 }
    ] });
    const sel = WB.ui.objSel;
    const obj = (id, x, w, title, fr, body) => '<div class="obj' + (sel === id ? ' sel' : '') + '" data-obj="' + id + '" style="left:' + x + 'px;top:' + gap + 'px;width:' + w + 'px;height:' + h + 'px"><div class="ot">' + icon('chart') + esc(title) + '<span class="id">' + fr + '</span><span class="grow"></span><span class="note" style="font-weight:400">' + (id === 'c1' ? '녹색 띠 = 평균 ±300km · 빨강 = 초과' : '띠 = 평균 ± 허용오차 · ▲ = 초과') + '</span></div><div class="oc">' + body + '</div>' +
      (sel === id ? '<i class="hd" style="left:-4px;top:-4px"></i><i class="hd" style="right:-4px;top:-4px"></i><i class="hd" style="left:-4px;bottom:-4px"></i><i class="hd" style="right:-4px;bottom:-4px"></i>' : '') + '</div>';
    area.innerHTML = obj('c1', gap, w1, '차트 1 · 구단별 총 이동거리 (km)', 'FR-A1', c1) + obj('c2', gap * 2 + w1, w2, '차트 2 · 이동 횟수 · 휴일 가중치 · 주말 홈', 'FR-A2', c2);
    area.querySelectorAll('[data-obj]').forEach((o) => o.addEventListener('mousedown', () => { WB.ui.objSel = o.dataset.obj; area.querySelectorAll('.obj').forEach((x) => x.classList.toggle('sel', x === o)); WB.fx({ addr: '지표!' + (o.dataset.obj === 'c1' ? '차트 1' : '차트 2'), value: o.dataset.obj === 'c1' ? '=막대(B3:B12, 평균, ±300)' : '=점(D3:D12, F3:F12, H3:H12)', meta: '얹힌 차트 개체 · 원본 범위 지표 시트' }); }));
  }

  // ───────────── 흐름 (A3) ─────────────
  function flowGrid() {
    const c = der(), ex = c.ex;
    const teams = WB.app.state.teams;
    const S = c.slots.length;
    const host = document.getElementById('gridhost');
    const cw = Math.max(24, Math.min(30, Math.floor(((host.clientWidth || 1100) - 38 - 64 - 3 * 76) / S)));
    const cols = [{ label: '구단', w: 64 }].concat(c.slots.map((s) => ({ label: D.fmtShort(s.day), w: cw, cls: 'c' }))).concat([{ label: '최장 홈', w: 76, cls: 'n' }, { label: '최장 원정', w: 76, cls: 'n' }, { label: '4연속+', w: 76, cls: 'n' }]);
    const grid = teams.map((t, ti) => {
      const tm = ex.teamMetrics[ti];
      const row = new Array(S).fill(null);
      for (const r of tm.runs) r.slots.forEach((s, k) => { row[s] = { home: r.home, k: k + 1, len: r.length }; });
      return { tm, row };
    });
    return {
      key: 's4-flow', sheet: '홈/원정 흐름', cols, rows: teams.length, frozen: 1, fill: 0, readOnly: true, rowH: 30,
      cell: (r, col) => {
        const g = grid[r];
        if (col === 0) return { t: teams[r].name, cls: 'dv' };
        if (col > S) { const k = col - S - 1; const v = [g.tm.maxHomeRun, g.tm.maxAwayRun, g.tm.streakPenalty][k]; return { t: k === 2 ? (v ? '▲ ' + v : '0') : v, cls: (k < 2 && v > 3) || (k === 2 && v) ? 'cf-bad' : '' }; }
        const x = g.row[col - 1];
        if (!x) return { t: '' };
        const over = x.k > 3;
        return { h: '<b>' + (x.home ? 'H' : 'A') + '</b>' + (x.k === x.len && x.len > 1 ? '<sub style="font-size:9px">' + x.len + '</sub>' : ''), cls: over ? 'cf-bad' : x.home ? 'hl-home' : '', mk: over ? { level: 'error', title: teams[r].name + ' ' + (x.home ? '홈' : '원정') + ' ' + x.len + '연속', text: '3연속 초과 (H0-f)' } : null };
      },
      onSelect: (r, col) => { const x = col && col <= S ? grid[r].row[col - 1] : null; WB.fx({ addr: '흐름!' + WB.colName(col) + (r + 2), value: x ? (x.home ? '홈' : '원정') + ' ' + x.k + '/' + x.len + '연속' : '', meta: col && col <= S ? c.slots[col - 1].label + ' · ' + esc(teams[r].name) : esc(teams[r].name) }); WB.ui.hlTeam = teams[r].name; renderPane(); },
      after: '<div class="note" style="padding:6px 12px;border-top:1px solid var(--c-line)">FR-A3 · H = 홈(파랑 칸), A = 원정. 아래 숫자 = 연속 길이. 4번째 이상 연속은 빨강 ▲ (H0-f).</div>'
    };
  }

  // ───────────── 차트 시트: 누적 이동거리 (A4) ─────────────
  function chartSheet(host) {
    const ex = der().ex, c = der();
    const W = host.clientWidth - 24, H = host.clientHeight - 24;
    const S = c.slots.length;
    const hl = WB.ui.hlTeam || 'KIA';
    const series = ex.teamMetrics.map((t) => {
      const v = new Array(S).fill(null); let cur = 0;
      const bySlot = new Map(t.visits.map((x) => [x.slot, x.cumTenths / 10]));
      for (let s = 0; s < S; s++) { if (bySlot.has(s)) cur = bySlot.get(s); v[s] = Math.round(cur); }
      const tm = WB.app.team(t.name);
      return { label: t.name, color: t.name === hl ? '#a3221a' : tm.color, values: v, bold: t.name === hl, dim: t.name !== hl };
    });
    const xl = c.slots.map((s, i) => (i === 0 || D.month(s.day) !== D.month(c.slots[i - 1].day) ? D.month(s.day) + '월' : ''));
    const svg = WB.Charts.lines({ w: W - 16, h: H - 40, series, xLabels: xl, fmt: (v) => v.toLocaleString('ko-KR') + 'km', title: '누적 이동거리' });
    host.innerHTML = '<div class="chartsheet"><div class="obj sel" style="left:12px;top:12px;width:' + W + 'px;height:' + H + 'px"><div class="ot">' + icon('chart') + '차트 시트 · 구단별 누적 이동거리 (km)<span class="id">FR-A4</span><span class="grow"></span><span class="note" style="font-weight:400">강조: ' + esc(hl) + ' (지표 시트에서 행을 고르면 바뀜)</span></div><div class="oc">' + svg + '</div></div></div>';
    WB.fx({ addr: '누적 이동거리!차트', value: '=선(구단별 누적 이동거리, 슬롯 1~' + S + ')', meta: '차트 시트 · 강조 ' + esc(hl) });
  }

  // ───────────── A5 상대 매트릭스 ─────────────
  function oppGrid() {
    const c = der();
    const teams = WB.app.state.teams.map((t) => t.name);
    const cnt = {};
    WB.app.state.matches.forEach((m, i) => { if (c.plan[i] < 0) return; const k = m.home + '|' + m.away; cnt[k] = (cnt[k] || 0) + m.consecutive; });
    const cols = [{ label: '홈 \\ 원정', w: 80 }].concat(teams.map((t) => ({ label: t, w: 74, cls: 'c' }))).concat([{ label: '홈 합계', w: 74, cls: 'n' }]);
    return {
      key: 's4-opp', sheet: '상대 매트릭스', cols, rows: teams.length, fill: 0, readOnly: true,
      cell: (r, col) => {
        const a = teams[r];
        if (col === 0) return { t: a, cls: 'dv' };
        if (col > teams.length) return { t: teams.reduce((s, b) => s + (cnt[a + '|' + b] || 0), 0) };
        const b = teams[col - 1];
        if (a === b) return { t: '—', cls: 'dv' };
        const h = cnt[a + '|' + b] || 0, w = cnt[b + '|' + a] || 0;
        const off = h + w !== 15;
        return { t: h + ' : ' + w, cls: off ? 'cf-warn' : h > w ? 'hl-home' : '' };
      },
      onSelect: (r, col) => { const a = teams[r], b = teams[col - 1]; WB.fx({ addr: '상대!' + WB.colName(col) + (r + 2), value: col && col <= teams.length && a !== b ? a + ' 홈 ' + (cnt[a + '|' + b] || 0) + '경기 · 원정 ' + (cnt[b + '|' + a] || 0) + '경기' : '', meta: 'FR-A5 · 홈:원정 경기 수 (1차 편성)' }); },
      after: '<div class="note" style="padding:6px 12px;border-top:1px solid var(--c-line)">칸 = 행 구단 홈 경기 : 원정 경기. 파랑 = 홈이 많은 쪽, 노랑 = 합계가 15가 아님.</div>'
    };
  }

  // ───────────── 표 시트 공용 (A8 · A9 · A10 · A12) ─────────────
  function tableGrid(key, sheet, cols, rows, note) {
    return {
      key, sheet, cols: cols.map((c) => ({ label: c.label, w: c.w || 100, cls: c.n ? 'n' : '', tag: c.tag })), rows: rows.length, fill: 1, readOnly: true,
      cell: (r, c) => { const v = rows[r][c]; return typeof v === 'object' && v ? v : { t: v }; },
      onSelect: (r, c) => { const v = rows[r][c]; WB.fx({ addr: sheet + '!' + WB.colName(c) + (r + 2), value: typeof v === 'object' && v ? (v.t != null ? v.t : '') : v, meta: cols[c].label }); },
      after: note ? '<div class="note" style="padding:6px 12px;border-top:1px solid var(--c-line)">' + note + '</div>' : ''
    };
  }
  function weekdayGrid() {
    const ex = der().ex;
    const avg = ex.teamMetrics.reduce((a, t) => a + t.weekdayMoves, 0) / ex.teamMetrics.length;
    const mx = Math.max(...ex.teamMetrics.map((t) => t.weekdayMoveKm));
    const rows = ex.teamMetrics.map((t) => [t.name, t.weekdayMoves, fmt.signed(t.weekdayMoves - avg), { h: '<span class="bar" style="width:' + (t.weekdayMoveKm / mx * 60).toFixed(1) + '%"></span><span class="bv">' + fmt.km(t.weekdayMoveKm) + '</span>' }, Math.abs(t.weekdayMoves - avg) > 1.5 ? { t: '▲ ±1.5 밖', cls: 'cf-warn' } : '']);
    return tableGrid('s4-weekday', '주중 이동', [{ label: '구단', w: 70 }, { label: '주중→주말 이동', w: 120, n: 1, tag: '참고' }, { label: '평균 대비', w: 90, n: 1 }, { label: '이동거리 km', w: 200, n: 1 }, { label: 'WEEKDAY_MOVE 1.5', w: 140 }], rows, 'FR-A8 · 주중 슬롯 → 다음 주말 슬롯 이동. Constants.TOLERANCE.WEEKDAY_MOVE(1.5)는 정의만 있고 점수에 반영되지 않아 참고로 둡니다.');
  }
  function summerGrid() {
    const ex = der().ex;
    const rows = ex.teamMetrics.map((t) => { const tm = WB.app.team(t.name); const dome = /고척/.test(tm.stadium); return [t.name, t.summerAwayGames, fmt.km(t.summerMoveKm), dome ? WB.st('info', '돔 홈') : '', tm.stadium]; }).map((r) => [r[0], r[1], r[2], { h: r[3] }, r[4]]);
    return tableGrid('s4-summer', '혹서기 부담', [{ label: '구단', w: 70 }, { label: '7~8월 원정 경기', w: 120, n: 1 }, { label: '7~8월 이동 km', w: 120, n: 1 }, { label: '돔', w: 80 }, { label: '홈 구장', w: 160 }], rows, 'FR-A9 · 7~8월 원정 경기 수와 이동거리. 고척돔 홈 구단은 따로 표기합니다.');
  }
  function longGrid() {
    const ex = der().ex, c = der();
    const rows = [];
    ex.teamMetrics.forEach((t) => t.longTrips.forEach((lt) => rows.push([t.name, c.slots[lt.slots[0]].label + ' ~ ' + D.fmtShort(c.slots[lt.slots[lt.slots.length - 1]].day), lt.series, { t: fmt.km(lt.tenths / 10), cls: lt.tenths > 9000 ? 'cf-bad' : 'cf-warn' }])));
    return tableGrid('s4-long', '장거리 원정', [{ label: '구단', w: 70 }, { label: '구간', w: 230 }, { label: '연속 원정 시리즈', w: 120, n: 1 }, { label: '구간 거리 합 km', w: 130, n: 1 }], rows, 'FR-A10 · 연속 원정 2시리즈 이상이면서 거리 합이 ' + (WB.app.state.settings.longTripKm || 600) + 'km를 넘는 구간 ' + rows.length + '개.');
  }
  function heatGrid() {
    const c = der();
    const teams = WB.app.state.teams.map((t) => t.name);
    const months = [3, 4, 5, 6, 7, 8];
    const cnt = {};
    WB.app.state.matches.forEach((m, i) => { const s = c.plan[i]; if (s < 0) return; const mo = D.month(c.slots[s].day); cnt[m.home + '|' + mo] = (cnt[m.home + '|' + mo] || 0) + m.consecutive; });
    const max = Math.max(...Object.values(cnt));
    const rows = teams.map((t) => [t].concat(months.map((mo) => { const v = cnt[t + '|' + mo] || 0; const a = v / max; return { t: v, cls: 'c', h: '<span style="display:block;margin:0 -6px;padding:0 6px;line-height:22px;background:rgba(28,60,110,' + (0.08 + a * 0.62).toFixed(2) + ');color:' + (a > 0.6 ? '#fff' : 'inherit') + '">' + v + '</span>' }; })));
    return tableGrid('s4-heat', '월별 홈경기', [{ label: '구단', w: 70 }].concat(months.map((m) => ({ label: m + '월', w: 90, n: 1 }))), rows, 'FR-A12 · 구단 × 월 홈경기 수. 진할수록 많음.');
  }

  // ───────────── A11 구단별 일정표 (인쇄 미리보기) ─────────────
  function printSheet(host) {
    const c = der();
    const team = WB.ui.schedTeam || 'LG';
    const list = [];
    WB.app.state.matches.forEach((m, i) => { const s = c.plan[i]; if (s < 0 || (m.home !== team && m.away !== team)) return; list.push({ s, m, home: m.home === team, opp: m.home === team ? m.away : m.home }); });
    list.sort((a, b) => a.s - b.s);
    const H = host.clientHeight - 28;
    const perPage = Math.max(10, Math.floor((H - 44 - 60) / 17));
    const pages = [];
    for (let i = 0; i < list.length; i += perPage) pages.push(list.slice(i, i + perPage));
    const pw = Math.round((H) * 0.707);
    const tm = WB.app.team(team);
    const show = Math.max(1, Math.floor((host.clientWidth - 28) / (pw + 14)));
    let h = '<div class="printwrap">';
    pages.slice(0, show).forEach((pg, pi) => {
      h += '<div class="page" style="width:' + pw + 'px;height:' + H + 'px"><h3>' + esc(team) + ' 2025 정규시즌 1차 일정</h3><div class="pmeta">' + esc(tm.stadium) + ' · ' + list.length + '시리즈 · ' + (pi + 1) + ' / ' + pages.length + '쪽 · KBO 사무국 배포용</div><table><tr><th>#</th><th>기간</th><th>상대</th><th>홈/원정</th><th>구장</th><th>연전</th></tr>' +
        pg.map((x, k) => '<tr><td>' + (pi * perPage + k + 1) + '</td><td>' + esc(D.fmtDate(c.slots[x.s].day) + ' ~ ' + D.fmtShort(c.slots[x.s].day + x.m.consecutive - 1)) + '</td><td>' + esc(x.opp) + '</td><td>' + (x.home ? '<b>홈</b>' : '원정') + '</td><td>' + esc((WB.app.team(x.m.home) || {}).stadium || '') + '</td><td>' + x.m.consecutive + '</td></tr>').join('') + '</table></div>';
    });
    h += '</div>';
    host.innerHTML = h;
    WB.fx({ addr: '구단별 일정표!' + team, value: team + ' · ' + list.length + '시리즈 · ' + pages.length + '쪽', meta: '인쇄 미리보기 (A4 세로) · 명령 띠에서 구단 선택' });
  }

  // ───────────── 작업 창: Soft 분해 + 배포 ─────────────
  function renderPane() {
    const pane = document.getElementById('pane');
    const ex = der().ex;
    const sb = ex.softBreakdown;
    const open = WB.ui.softOpen || 'S2';
    const hl = WB.ui.hlTeam;
    const rowsDef = [
      ['S0', '미배정 시리즈', sb.S0.total, () => sb.S0.items.length ? sb.S0.items.map((x) => '<div>' + esc(WB.app.matchLabel(x.match)) + '</div>').join('') : '<div class="note">없음</div>'],
      ['S1', '이동 횟수 분산', sb.S1.total, () => items(sb.S1.items, (x) => x.value + '회', (x) => fmt.signed(x.dev), (x) => x.contrib, '평균 ' + fmt.n1(sb.S1.mean) + ' · 2회 단위')],
      ['S2', '이동 거리 분산', sb.S2.total, () => items(sb.S2.items, (x) => fmt.km(x.value), (x) => fmt.signed(x.dev, fmt.km), (x) => Math.round(x.contrib), '평균 ' + fmt.km(sb.S2.meanKm) + 'km · ±300km 초과분²')],
      ['S3', '휴일 가중치 분산', sb.S3.total, () => items(sb.S3.items, (x) => x.value, (x) => fmt.signed(x.dev), (x) => x.contrib, '평균 ' + fmt.n1(sb.S3.mean) + ' · 1.5 단위')],
      ['S4', '리그 총 이동거리', sb.S4.total, () => '<div class="note">구단 이동거리 합 ' + ex.league.totalKm.toLocaleString('ko-KR') + 'km</div>']
    ];
    function items(list, v, d, c, note) {
      const mx = Math.max(1, ...list.map(c));
      return '<div class="note" style="margin-bottom:3px">' + note + '</div><table class="mini"><tr><th>구단</th><th>값</th><th>편차</th><th>감점</th></tr>' + list.slice().sort((a, b) => c(b) - c(a)).map((x) => {
        const n = WB.app.state.teams[x.team].name;
        return '<tr style="' + (n === hl ? 'box-shadow:inset 2px 0 0 var(--c-sel);font-weight:600' : '') + '"><td>' + esc(n) + '</td><td class="n">' + v(x) + '</td><td class="n">' + d(x) + '</td><td class="n" style="position:relative">' + (c(x) ? '<span class="bar over" style="left:2px;width:' + (c(x) / mx * 90).toFixed(0) + '%"></span><span class="bv">−' + c(x).toLocaleString('ko-KR') + '</span>' : '0') + '</td></tr>';
      }).join('') + '</table>';
    }
    const ok = ex.feasible;
    pane.innerHTML =
      '<div class="sec grow"><div class="sh">' + icon('chart') + 'Soft 분해<span class="cnt">S0~S4</span><span class="grow"></span><span class="note" style="font-weight:400">단계를 눌러 구단별 감점</span></div><div class="sb flush">' +
      rowsDef.map((r) => '<div class="softrow' + (open === r[0] ? ' on' : '') + '"><button class="softh" data-soft="' + r[0] + '"><span class="vcode" style="color:var(--c-text)">' + r[0] + '</span> ' + esc(r[1]) + '<span class="grow"></span><span class="num">' + r[2].toLocaleString('ko-KR') + '</span>' + icon(open === r[0] ? 'caret' : 'right') + '</button>' + (open === r[0] ? '<div class="softb">' + r[3]() + '</div>' : '') + '</div>').join('') +
      '</div></div>' +
      '<div class="sec fixed"><div class="sh">' + icon('down') + '배포<span class="grow"></span>' + (ok ? WB.st('ok', '배포 가능') : WB.st('bad', '배포 전 확인')) + '</div><div class="sb" style="flex:none">' +
      (ok ? '' : '<div class="callout bad" style="margin-top:0">' + icon('block') + ' Hard 위반 ' + ex.violations.length + '건이 남아 있습니다 (가상 포함). <a class="lnk" data-act="badge">③에서 해결</a></div>') +
      '<div class="row wrap"><button class="btn box" data-act="export-xlsx">' + icon('down') + '.xlsx</button>' + (WB.feature('D4') ? '<button class="btn box" data-act="export-csv">' + icon('down') + '일정표 CSV</button>' : '') + '<button class="btn box" data-act="export-engine">' + icon('down') + '엔진 JSON</button>' + (WB.feature('A11') ? '<button class="btn box" data-act="print-sched">' + icon('print') + '인쇄</button>' : '') + '</div>' +
      '<div class="note" style="margin-top:5px">내보낸 .xlsx는 가져오기와 같은 시트 구성이라 고친 뒤 다시 올릴 수 있습니다.</div></div></div>';
    pane.querySelectorAll('[data-soft]').forEach((b) => b.addEventListener('click', () => { WB.ui.softOpen = WB.ui.softOpen === b.dataset.soft ? '' : b.dataset.soft; renderPane(); }));
  }
  WB.actions['export-csv'] = () => { WB.ui.exported = (WB.ui.exported || 0) + 1; WB.app.exportCSV(); WB.render(); };
  WB.actions['print-sched'] = () => { WB.go({ step: 4, sheet: 'print' }); WB.toast('인쇄 미리보기 — 브라우저 인쇄(Ctrl+P)로 출력합니다.'); };

  function renderCmd() {
    const id = WB.ui.sheet[4];
    const teams = WB.app.state.teams;
    document.getElementById('cmd').innerHTML =
      '<span class="grp"><span class="gl">내보내기</span><button class="btn" data-act="export-xlsx">' + icon('down') + '.xlsx 내보내기</button>' + (WB.feature('D4') ? '<button class="btn" data-act="export-csv">' + icon('down') + '일정표 CSV</button>' : '') + '<button class="btn" data-act="export-engine">' + icon('down') + '엔진 JSON</button></span>' +
      (id === 'print' ? '<span class="vr"></span><span class="gl">구단</span><span class="teamchips">' + teams.map((t) => '<button class="chip' + (WB.ui.schedTeam === t.name ? ' on' : '') + '" data-st="' + esc(t.name) + '">' + esc(t.name) + '</button>').join('') + '</span><button class="btn" onclick="window.print()">' + icon('print') + '인쇄</button>' : '') +
      (id === 'metrics' ? '<span class="vr"></span><span class="note">' + icon('info') + ' 머리글을 누르면 정렬 · <span class="tag tag-s" style="font-size:10px;padding:0 3px;border-radius:2px">채점</span> 엔진 점수에 반영 · <span class="tag tag-r" style="font-size:10px;padding:0 3px;border-radius:2px">참고</span> 반영 안 됨 · ▲ 허용오차 초과</span>' : '') +
      '<span class="grow"></span><span class="note">리그 총 이동 ' + der().ex.league.totalKm.toLocaleString('ko-KR') + 'km · 평균 ' + fmt.km(der().ex.league.meanDistanceKm) + 'km</span>';
    document.querySelectorAll('#cmd [data-st]').forEach((b) => b.addEventListener('click', () => { WB.ui.schedTeam = b.dataset.st; WB.render(); }));
  }
  function renderTabs() {
    const id = WB.ui.sheet[4];
    const groups = [['표', ['metrics', 'flow']], ['선택 분석 (설정에서 켜기·끄기)', ['cum', 'opp', 'weekday', 'summer', 'long', 'heat']], ['배포', ['print']]];
    const vis = new Set(visible().map((s) => s.id));
    let h = '';
    for (const [g, ids] of groups) {
      const list = ids.filter((x) => vis.has(x));
      if (!list.length) continue;
      h += '<span class="grpl">' + g + '</span>' + list.map((sid) => { const s = SHEETS.find((x) => x.id === sid); return '<button class="tab' + (sid === id ? ' on' : '') + '" role="tab" aria-selected="' + (sid === id) + '" data-sheet="' + sid + '">' + icon(s.ico, 'tico') + esc(s.name) + '</button>'; }).join('');
    }
    document.getElementById('tabs').innerHTML = h;
  }

  S4.render = function () {
    document.getElementById('main').classList.remove('nopane');
    let id = WB.ui.sheet[4];
    if (!visible().some((s) => s.id === id)) id = WB.ui.sheet[4] = 'metrics';
    renderCmd(); renderTabs();
    const host = document.getElementById('gridhost');
    if (id === 'cum') { chartSheet(host); renderPane(); return; }
    if (id === 'print') { printSheet(host); renderPane(); return; }
    const spec = { metrics: metricsGrid, flow: flowGrid, opp: oppGrid, weekday: weekdayGrid, summer: summerGrid, long: longGrid, heat: heatGrid }[id]();
    const g = WB.Grid.mount(host, spec);
    if (id === 'metrics') {
      const n = spec.rows;
      g.sc.style.flex = 'none';
      g.sc.style.height = (g.sc.querySelector('thead').offsetHeight + n * 22 + 2) + 'px';
      drawObjects(host);
    }
    spec.onSelect(g.sel.r, g.sel.c);
  };
})();
