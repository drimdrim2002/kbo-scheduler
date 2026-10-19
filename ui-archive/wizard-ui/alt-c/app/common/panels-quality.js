/*
 * 화면 공통 — 품질 확인·분석: 구단 지표 비교표(FR-Q1·Q2), Soft 분해(FR-Q3), 스냅샷(FR-M7·Q4), 차트(FR-A1~A12), 경로 지도(FR-A6).
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const P = UI.panels || (UI.panels = {});
  const { esc, fmt, on } = UI;
  const { Dates, Score, Chart } = KBO;

  /** 지표 정의. scored = 엔진 채점 지표, ref = 참고 지표 (FR-Q2) */
  const METRICS = [
    { key: 'distanceKm', label: '총 이동거리', unit: 'km', kind: 'scored', rule: 'S2·S4', fmt: (v) => fmt.km(v), tol: 300, over: 'overDistance', better: 'mean' },
    { key: 'moves', label: '이동 횟수', unit: '회', kind: 'scored', rule: 'S1', tol: 2, over: 'overMoves', better: 'mean' },
    { key: 'holidayWeight', label: '휴일 가중치 합', unit: '', kind: 'scored', rule: 'S3', tol: 1.5, over: 'overHoliday', better: 'mean' },
    { key: 'streakPenalty', label: '4연속 초과', unit: '', kind: 'scored', rule: 'H0-f', better: 'low' },
    { key: 'weekendHome', label: '주말 홈', unit: '시리즈', kind: 'ref', rule: 'R1', better: 'mean' },
    { key: 'weekendAway', label: '주말 원정', unit: '시리즈', kind: 'ref', rule: 'R1', better: 'mean' },
    { key: 'weekdayMoves', label: '주중→주말 이동', unit: '회', kind: 'ref', rule: 'R2', better: 'low' },
    { key: 'weekdayMoveKm', label: '주중→주말 거리', unit: 'km', kind: 'ref', rule: 'R2', fmt: (v) => fmt.km(v), better: 'low' },
    { key: 'maxHomeRun', label: '최장 연속 홈', unit: '', kind: 'ref', rule: 'R3', better: 'low' },
    { key: 'maxAwayRun', label: '최장 연속 원정', unit: '', kind: 'ref', rule: 'R3', better: 'low' },
    { key: 'holidayHomeGames', label: '공휴일 홈경기', unit: '경기', kind: 'ref', rule: 'R4', better: 'mean' },
    { key: 'summerAwayGames', label: '7~8월 원정', unit: '경기', kind: 'ref', rule: 'A9', better: 'low' },
    { key: 'longTripCount', label: '장거리 연속 원정', unit: '구간', kind: 'ref', rule: 'A10', better: 'low' }
  ];
  P.METRICS = METRICS;
  const metricValue = (tm, key) => (key === 'longTripCount' ? tm.longTrips.length : tm[key]);
  const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  // ───────────── 구단 지표 비교표 (FR-Q1, Q2) ─────────────
  P.metrics = function (el, app, opts) {
    const o = opts || {};
    let sortKey = null, sortDir = 1;
    const cols = o.columns ? METRICS.filter((m) => o.columns.includes(m.key)) : METRICS;
    const render = () => {
      const c = app.derived();
      const tms = c.ex.teamMetrics.slice();
      const means = {};
      for (const m of cols) means[m.key] = mean(tms.map((t) => metricValue(t, m.key)));
      if (sortKey) tms.sort((a, b) => sortDir * ((sortKey === 'name' ? a.name.localeCompare(b.name) : metricValue(a, sortKey) - metricValue(b, sortKey))));
      const f = (m, v) => (m.fmt ? m.fmt(v) : fmt.num1(v));
      let h = '<div class="k-table-wrap" data-scroll-key="metrics"><table class="k-table k-metrics"><thead><tr><th><button class="k-sort" data-sort="name">구단' + (sortKey === 'name' ? (sortDir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>' +
        cols.map((m) => '<th class="k-m-' + m.kind + '"><button class="k-sort" data-sort="' + m.key + '" title="' + esc(m.kind === 'scored' ? '엔진이 채점하는 지표 (' + m.rule + ')' : '엔진이 직접 최적화하지 않는 참고 지표 (' + m.rule + ')') + '">' + esc(m.label) + (sortKey === m.key ? (sortDir > 0 ? ' ▲' : ' ▼') : '') + '</button><span class="k-mtag k-mtag-' + m.kind + '">' + (m.kind === 'scored' ? '채점 ' + m.rule : '참고') + '</span></th>').join('') + '</tr></thead><tbody>';
      for (const tm of tms) {
        const team = app.state.teams[tm.team];
        h += '<tr><th><button class="k-link" data-team="' + esc(tm.name) + '" title="이 구단만 강조">' + UI.teamChip(team) + '</button></th>';
        for (const m of cols) {
          const v = metricValue(tm, m.key);
          const dev = v - means[m.key];
          const over = m.over ? tm[m.over] : false;
          h += '<td class="' + (over ? 'k-over' : '') + '"><span class="k-mv">' + f(m, v) + '</span>' + (m.kind === 'scored' && m.tol ? '<span class="k-dev">' + fmt.signed(dev, m.fmt ? (x) => fmt.km(x) : fmt.num1) + '</span>' : '') + (over ? '<span class="k-overmark" title="허용오차 ±' + m.tol + m.unit + ' 초과">▲ 초과</span>' : '') + '</td>';
        }
        h += '</tr>';
      }
      h += '</tbody><tfoot><tr><th>리그 평균</th>' + cols.map((m) => '<td>' + f(m, means[m.key]) + (m.tol ? '<span class="k-small k-muted"> ±' + m.tol + '</span>' : '') + '</td>').join('') + '</tr></tfoot></table></div>';
      h += '<p class="k-small k-muted"><span class="k-mtag k-mtag-scored">채점</span> 엔진 Soft/Hard 점수에 들어가는 지표 · <span class="k-mtag k-mtag-ref">참고</span> 엔진이 직접 최적화하지 않는 지표. ▲ 초과 = 리그 평균 대비 엔진 허용오차(거리 ±300km, 이동 ±2회, 휴일 ±1.5) 초과.</p>';
      el.innerHTML = h;
    };
    on(el, 'click', '[data-sort]', (e, b) => { const k = b.dataset.sort; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = k === 'name' ? 1 : -1; } render(); });
    on(el, 'click', '[data-team]', (e, b) => app.setTeamFilter([b.dataset.team]));
    return UI.mount(el, app, render, ['plan', 'pins', 'calendar', 'matches', 'teams', 'distance', 'settings']);
  };

  // ───────────── Soft 분해 (FR-Q3) ─────────────
  P.softBreakdown = function (el, app) {
    const render = () => {
      const ex = app.derived().ex;
      const sb = ex.softBreakdown;
      const teams = app.state.teams;
      const row = (items, valFmt, extra) => items.filter((x) => x.contrib > 0).sort((a, b) => b.contrib - a.contrib).map((x) => '<li>' + UI.teamChip(teams[x.team]) + ' 값 ' + valFmt(x.value) + ' · 평균 대비 ' + fmt.signed(x.dev, valFmt) + (extra ? extra(x) : '') + ' → <b>−' + fmt.int(x.contrib) + '</b></li>').join('') || '<li class="k-muted">감점 구단 없음</li>';
      let h = '<div class="k-soft">';
      h += '<div class="k-soft-total k-mono">' + esc(Score.scoreString(ex.score)) + '</div>';
      h += '<details open><summary><b>S0 미배정 시리즈</b> <span class="k-soft-v">' + fmt.int(sb.S0.total) + '</span></summary><ul>' + (sb.S0.items.length ? sb.S0.items.map((x) => '<li><button class="k-link" data-match="' + x.match + '">' + esc(app.matchLabel(x.match)) + ' (' + app.state.matches[x.match].consecutive + '연전)</button></li>').join('') : '<li class="k-muted">없음</li>') + '</ul></details>';
      h += '<details open><summary><b>S1 이동 횟수 분산</b> <span class="k-soft-v">' + fmt.int(sb.S1.total) + '</span> <span class="k-muted k-small">Σ⌊|x−평균 ' + fmt.num1(sb.S1.mean) + '|/2⌋² × 100</span></summary><ul>' + row(sb.S1.items, (v) => fmt.num1(v), (x) => ' · ' + x.steps + '단계') + '</ul></details>';
      h += '<details open><summary><b>S2 이동 거리 분산</b> <span class="k-soft-v">' + fmt.int(sb.S2.total) + '</span> <span class="k-muted k-small">Σ(max(0, |d−평균 ' + fmt.km(sb.S2.meanKm) + '| − 300))²</span></summary><ul>' + row(sb.S2.items, (v) => fmt.km(v) + 'km', (x) => ' · 초과 ' + fmt.km(x.excessKm) + 'km') + '</ul></details>';
      h += '<details open><summary><b>S3 휴일 가중치 분산</b> <span class="k-soft-v">' + fmt.int(sb.S3.total) + '</span> <span class="k-muted k-small">Σ⌊|h−평균 ' + fmt.num1(sb.S3.mean) + '|/1.5⌋²</span></summary><ul>' + row(sb.S3.items, (v) => fmt.num1(v), (x) => ' · ' + x.steps + '단계') + '</ul></details>';
      h += '<details><summary><b>S4 리그 총 이동거리</b> <span class="k-soft-v">' + fmt.int(sb.S4.total) + '</span> <span class="k-muted k-small">km, 버림</span></summary><ul>' + sb.S4.items.slice().sort((a, b) => b.value - a.value).map((x) => '<li>' + UI.teamChip(teams[x.team]) + ' ' + fmt.km(x.value) + 'km</li>').join('') + '</ul></details>';
      el.innerHTML = h + '</div>';
    };
    on(el, 'click', '[data-match]', (e, b) => app.focus({ match: Number(b.dataset.match), matches: [Number(b.dataset.match)] }));
    return UI.mount(el, app, render, ['plan', 'pins', 'calendar', 'matches', 'teams', 'distance', 'settings']);
  };

  // ───────────── 스냅샷 (FR-M7, Q4) ─────────────
  P.snapshots = function (el, app) {
    let a = 'current', b = null;
    const render = () => {
      const snaps = app.state.snapshots;
      if (b == null && snaps.length) b = snaps[snaps.length - 1].id;
      if (b && b !== 'current' && !snaps.some((s) => s.id === b)) b = snaps.length ? snaps[snaps.length - 1].id : null;
      if (a !== 'current' && !snaps.some((s) => s.id === a)) a = 'current';
      let h = '<div class="k-toolbar"><button class="k-btn k-btn-primary" data-act="save">📷 현재 배정 저장</button><span class="k-muted k-small">스냅샷은 배정·핀·재편성 배치를 저장합니다.</span></div>';
      h += '<table class="k-table k-compact"><thead><tr><th>이름</th><th>저장 시각</th><th>점수 (저장 당시)</th><th></th></tr></thead><tbody>' + (snaps.length ? snaps.map((s) => '<tr data-id="' + esc(s.id) + '"><td><input class="k-input" data-act="rename" data-fk="sn' + esc(s.id) + '" value="' + esc(s.name) + '" aria-label="스냅샷 이름"></td><td class="k-small">' + new Date(s.createdAt).toLocaleString('ko-KR') + '</td><td>' + (s.feasible ? UI.stateChip('ok', 'Feasible') : UI.stateChip('bad', '위반')) + ' <span class="k-mono k-small">' + esc(s.score || '') + '</span></td><td><button class="k-btn" data-act="restore">복원</button><button class="k-btn k-btn-icon k-btn-danger" data-act="delete" aria-label="삭제">✕</button></td></tr>').join('') : '<tr><td colspan="4" class="k-muted">저장된 스냅샷이 없습니다.</td></tr>') + '</tbody></table>';
      const opt = (sel) => '<option value="current"' + (sel === 'current' ? ' selected' : '') + '>현재 배정</option>' + snaps.map((s) => '<option value="' + esc(s.id) + '"' + (sel === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
      h += '<h4 class="k-subhead">스냅샷 비교 (FR-Q4)</h4><div class="k-inline">기준 A <select class="k-input" data-cmp="a">' + opt(a) + '</select> → 비교 B <select class="k-input" data-cmp="b">' + (b ? opt(b) : '<option>스냅샷 없음</option>') + '</select></div>';
      if (b) h += compareHtml(app, a, b);
      el.innerHTML = h;
    };
    on(el, 'click', '[data-act]', (e, btn) => {
      const id = btn.closest('tr') && btn.closest('tr').dataset.id;
      const act = btn.dataset.act;
      if (act === 'save') UI.promptBox('스냅샷 저장', '이름', '안 ' + (app.state.snapshots.length + 1)).then((n) => n != null && app.saveSnapshot(n));
      else if (act === 'restore') app.restoreSnapshot(id);
      else if (act === 'delete') UI.confirmBox('스냅샷 삭제', '이 스냅샷을 삭제합니다.', '삭제', 'danger').then((ok) => ok && app.store.deleteSnapshot(id));
    });
    on(el, 'change', '[data-act=rename]', (e, i) => app.store.renameSnapshot(i.closest('tr').dataset.id, i.value));
    on(el, 'change', '[data-cmp]', (e, s) => { if (s.dataset.cmp === 'a') a = s.value; else b = s.value; render(); });
    return UI.mount(el, app, render, ['snapshots', 'plan', 'pins', 'teams', 'settings']);
  };

  function compareHtml(app, idA, idB) {
    const A = app.explainSnapshot(idA), B = app.explainSnapshot(idB);
    if (!A || !B) return '<p>' + UI.stateChip('warn', '시리즈 구성이 달라 비교할 수 없습니다.') + '</p>';
    const levels = ['H0', 'H1'].concat(Score.SOFT_RULES.map((r) => r.code));
    const fa = Score.flat(A.score), fb = Score.flat(B.score);
    let h = '<div class="k-cmp-score">' + levels.map((l, i) => { const d = fb[i] - fa[i]; return '<div class="k-cmp-cell ' + (d > 0 ? 'k-better' : d < 0 ? 'k-worse' : '') + '"><span class="k-muted k-small">' + l + '</span><b>' + fmt.int(fb[i]) + '</b><span class="k-small">' + (d > 0 ? '▼ 개선 +' + fmt.int(d) : d < 0 ? '▲ 악화 ' + fmt.int(d) : '±0') + '</span></div>'; }).join('') + '</div>';
    const keys = ['distanceKm', 'moves', 'holidayWeight', 'weekendHome', 'maxAwayRun', 'longTripCount'];
    const ms = METRICS.filter((m) => keys.includes(m.key));
    const meansA = {}, meansB = {};
    for (const m of ms) { meansA[m.key] = mean(A.teamMetrics.map((t) => metricValue(t, m.key))); meansB[m.key] = mean(B.teamMetrics.map((t) => metricValue(t, m.key))); }
    h += '<div class="k-table-wrap"><table class="k-table k-compact k-cmp"><thead><tr><th>구단</th>' + ms.map((m) => '<th>' + esc(m.label) + '<span class="k-mtag k-mtag-' + m.kind + '">' + (m.kind === 'scored' ? '채점' : '참고') + '</span></th>').join('') + '</tr></thead><tbody>';
    A.teamMetrics.forEach((ta, i) => {
      const tb = B.teamMetrics[i];
      h += '<tr><th>' + UI.teamChip(app.state.teams[i]) + '</th>' + ms.map((m) => {
        const va = metricValue(ta, m.key), vb = metricValue(tb, m.key);
        const ga = m.better === 'mean' ? Math.abs(va - meansA[m.key]) : va;
        const gb = m.better === 'mean' ? Math.abs(vb - meansB[m.key]) : vb;
        const cls = gb < ga - 1e-9 ? 'k-better' : gb > ga + 1e-9 ? 'k-worse' : '';
        const f = m.fmt || fmt.num1;
        return '<td class="' + cls + '">' + f(vb) + ' <span class="k-small">' + (vb === va ? '' : (cls === 'k-better' ? '✔ ' : cls === 'k-worse' ? '✖ ' : '') + fmt.signed(vb - va, f)) + '</span></td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table></div><p class="k-small k-muted">초록 ✔ = 개선, 빨강 ✖ = 악화. 평준화 지표는 리그 평균과의 거리, 나머지는 값이 작을수록 개선으로 판정합니다.</p>';
  }
  P.compareHtml = compareHtml;

  // ───────────── 차트 (FR-A) ─────────────
  const C = P.charts = P.charts || {};
  const teamItems = (app, key, flagKey) => app.derived().ex.teamMetrics.map((t) => ({ label: t.name, value: metricValue(t, key), color: app.state.teams[t.team].color, flag: flagKey ? !!t[flagKey] : false, key: t.name }));

  /** FR-A1 구단별 총 이동거리 + 평균선 + ±300km 밴드 */
  C.distance = (app, o) => {
    const ex = app.derived().ex;
    const m = ex.league.meanDistanceKm;
    return Chart.bar({ items: teamItems(app, 'distanceKm', 'overDistance'), mean: m, band: { lo: Math.max(0, m - 300), hi: m + 300, label: '엔진 허용오차 ±300km' }, unit: 'km', format: (v) => fmt.int(v), title: '구단별 총 이동거리', width: (o && o.width) || 640, yZero: false });
  };
  C.moves = (app, o) => { const m = app.derived().ex.league.meanMoves; return Chart.bar({ items: teamItems(app, 'moves', 'overMoves'), mean: m, band: { lo: m - 2, hi: m + 2, label: '허용오차 ±2회' }, unit: '회', title: '구단별 이동 횟수', width: (o && o.width) || 640, yZero: false }); };
  C.holiday = (app, o) => { const m = app.derived().ex.league.meanHoliday; return Chart.bar({ items: teamItems(app, 'holidayWeight', 'overHoliday'), mean: m, band: { lo: m - 1.5, hi: m + 1.5, label: '허용오차 ±1.5' }, title: '구단별 휴일 가중치 합 (홈)', width: (o && o.width) || 640, yZero: false }); };
  C.weekend = (app, o) => {
    const tms = app.derived().ex.teamMetrics;
    const m = mean(tms.map((t) => t.weekendHome));
    return Chart.dot({ rows: tms.map((t) => ({ label: t.name, values: [t.weekendHome, t.weekendAway] })), series: [{ label: '주말 홈 시리즈', color: 'var(--kc-1, #1971c2)', shape: 'circle' }, { label: '주말 원정 시리즈', color: 'var(--kc-2, #e8590c)', shape: 'square' }], mean: m, unit: '', title: '주말 홈/원정 (참고)', width: (o && o.width) || 640 });
  };
  /** FR-A3 홈/원정 흐름 스트립: 연속 길이 표시, 3연속 초과 강조 */
  C.flow = (app, o) => {
    const c = app.derived();
    const st = app.state;
    const S = c.slots.length;
    const cw = (o && o.cellW) || 15, ch = 20, lw = 52, top = 22;
    const W = lw + cw * S + 8, H = top + ch * st.teams.length + 20;
    let s = '<svg class="kc kc-flow" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" role="img" aria-label="구단별 홈/원정 흐름"><defs><pattern id="kc-flow-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--kc-warn, #c92a2a)" stroke-width="2"/></pattern></defs>';
    for (let i = 0; i < S; i += 4) s += '<text class="kc-tick" x="' + (lw + i * cw + cw / 2) + '" y="14" text-anchor="middle">' + fmt.short(c.slots[i].day) + '</text>';
    c.ex.teamMetrics.forEach((tm, t) => {
      const y = top + t * ch;
      s += '<text class="kc-label" x="' + (lw - 6) + '" y="' + (y + 14) + '" text-anchor="end">' + esc(tm.name) + '</text>';
      for (const r of tm.runs) {
        r.slots.forEach((slot, k) => {
          const x = lw + slot * cw;
          const over = k >= 3;
          s += '<rect x="' + x + '" y="' + (y + 2) + '" width="' + (cw - 1) + '" height="' + (ch - 4) + '" class="' + (r.home ? 'kc-home' : 'kc-away') + '"><title>' + esc(tm.name + ' ' + c.slots[slot].label + ' ' + (r.home ? '홈' : '원정') + ' ' + (k + 1) + '/' + r.length + '연속') + '</title></rect>';
          if (over) s += '<rect x="' + x + '" y="' + (y + 2) + '" width="' + (cw - 1) + '" height="' + (ch - 4) + '" fill="url(#kc-flow-hatch)" stroke="var(--kc-warn, #c92a2a)" stroke-width="1.5"/>';
        });
        const x0 = lw + r.slots[0] * cw;
        if (r.length >= 2) s += '<text class="kc-runlen' + (r.length > 3 ? ' kc-runlen-over' : '') + '" x="' + (x0 + 3) + '" y="' + (y + 14) + '">' + r.length + (r.length > 3 ? '!' : '') + '</text>';
      }
    });
    s += '<rect x="' + lw + '" y="' + (H - 14) + '" width="10" height="10" class="kc-home"/><text class="kc-legend" x="' + (lw + 14) + '" y="' + (H - 5) + '">홈</text><rect x="' + (lw + 44) + '" y="' + (H - 14) + '" width="10" height="10" class="kc-away"/><text class="kc-legend" x="' + (lw + 58) + '" y="' + (H - 5) + '">원정</text><rect x="' + (lw + 100) + '" y="' + (H - 14) + '" width="10" height="10" fill="url(#kc-flow-hatch)" stroke="var(--kc-warn,#c92a2a)"/><text class="kc-legend" x="' + (lw + 114) + '" y="' + (H - 5) + '">3연속 초과(H0-f) · 숫자 = 연속 길이</text>';
    return s + '</svg>';
  };
  /** FR-A4 누적 이동거리 */
  C.cumulative = (app, o) => {
    const c = app.derived();
    const S = c.slots.length;
    const f = app.ui.teamFilter;
    const series = c.ex.teamMetrics.map((tm) => {
      const vals = new Array(S).fill(0);
      let cum = 0, k = 0;
      for (let s = 0; s < S; s++) { while (k < tm.visits.length && tm.visits[k].slot === s) { cum = tm.visits[k].cumTenths; k++; } vals[s] = cum / 10; }
      return { label: tm.name, color: app.state.teams[tm.team].color, values: vals, emphasis: f.has(tm.name), dim: f.size > 0 && !f.has(tm.name) };
    });
    return Chart.line({ series, xLabels: c.slots.map((s) => fmt.short(s.day)), title: '시즌 진행에 따른 누적 이동거리', format: (v) => fmt.int(v), width: (o && o.width) || 720, xEvery: 5 });
  };
  /** FR-A5 상대 매트릭스 */
  C.opponents = (app) => {
    const st = app.state;
    const c = app.derived();
    const names = st.teams.map((t) => t.name);
    const idx = c.teamIndex;
    const home = names.map(() => names.map(() => 0));
    st.matches.forEach((m, i) => { if (c.plan[i] < 0) return; home[idx.get(m.home)][idx.get(m.away)] += m.consecutive; });
    const vals = names.map((a, i) => names.map((b, j) => (i === j ? null : home[i][j] + home[j][i])));
    const titles = names.map((a, i) => names.map((b, j) => a + ' vs ' + b + ': ' + (home[i][j] + home[j][i]) + '경기 (' + a + ' 홈 ' + home[i][j] + ' · ' + b + ' 홈 ' + home[j][i] + ')'));
    const fmtCell = (v) => (v == null ? '' : String(v));
    return Chart.heatmap({ rows: names, cols: names, values: vals, titles, format: fmtCell, min: 0, title: '상대 매트릭스 (편성 경기 수)', cellW: 40 }) +
      '<div class="k-small k-muted">셀 값 = 편성된 맞대결 경기 수. 홈/원정 분배는 셀에 마우스를 올리면 보입니다. 행 구단 홈 경기: ' + names.map((n, i) => esc(n) + ' ' + home[i].reduce((a, b) => a + b, 0)).join(' · ') + '</div>';
  };
  /** FR-A7 공정성 레이더 */
  C.radar = (app) => {
    const tms = app.derived().ex.teamMetrics;
    const axes = ['이동거리', '이동 횟수', '휴일 홈', '주말 홈', '장거리 연속 원정'];
    const keys = ['distanceKm', 'moves', 'holidayWeight', 'weekendHome', 'longTripCount'];
    const max = keys.map((k) => Math.max(1e-9, ...tms.map((t) => metricValue(t, k))));
    const f = app.ui.teamFilter;
    const series = tms.map((t) => ({ label: t.name, color: app.state.teams[t.team].color, values: keys.map((k, i) => metricValue(t, k) / max[i]), dim: f.size > 0 && !f.has(t.name) }));
    return Chart.radar({ axes, series, size: 320, title: '공정성 레이더' }) + '<div class="k-small k-muted">각 축은 리그 최대값 대비 비율(1 = 최대). 구단 필터로 강조합니다.</div>';
  };
  /** FR-A8 주중 이동 분석 (참고) */
  C.weekday = (app, o) => {
    const tms = app.derived().ex.teamMetrics;
    const m = mean(tms.map((t) => t.weekdayMoves));
    return Chart.bar({ items: tms.map((t) => ({ label: t.name, value: t.weekdayMoves, color: app.state.teams[t.team].color, note: fmt.km(t.weekdayMoveKm) + 'km', flag: Math.abs(t.weekdayMoves - m) >= KBO.Score.WEEKDAY_MOVE_TOLERANCE })), mean: m, band: { lo: m - 1.5, hi: m + 1.5, label: 'WEEKDAY_MOVE ±1.5 (점수 미반영)' }, unit: '회', title: '주중→주말 이동 횟수 (참고)', width: (o && o.width) || 640, yZero: false });
  };
  /** FR-A9 혹서기 부담 */
  C.summer = (app, o) => {
    const tms = app.derived().ex.teamMetrics;
    const dome = new Set((KBO.Preset.STADIUMS || []).filter((s) => s.dome).map((s) => s.name));
    return Chart.bar({ items: tms.map((t) => ({ label: t.name + (dome.has(app.state.teams[t.team].stadium) ? ' ⌂' : ''), value: t.summerAwayGames, color: app.state.teams[t.team].color, note: '7~8월 이동 ' + fmt.km(t.summerMoveKm) + 'km' })), mean: mean(tms.map((t) => t.summerAwayGames)), unit: '경기', title: '7~8월 원정 경기 수', width: (o && o.width) || 640, yZero: false }) + '<div class="k-small k-muted">⌂ = 돔구장(고척) 홈 구단 — 홈 경기는 혹서·우천 영향이 적습니다. 막대에 마우스를 올리면 7~8월 이동거리가 보입니다.</div>';
  };
  /** FR-A10 장거리 연속 원정 목록 */
  C.longTrips = (app) => {
    const c = app.derived();
    const rows = [];
    for (const tm of c.ex.teamMetrics) for (const lt of tm.longTrips) rows.push({ tm, lt });
    rows.sort((a, b) => b.lt.tenths - a.lt.tenths);
    return '<table class="k-table k-compact"><thead><tr><th>구단</th><th>구간</th><th>시리즈</th><th>거리</th></tr></thead><tbody>' + (rows.length ? rows.map(({ tm, lt }) => '<tr><td>' + UI.teamChip(app.state.teams[tm.team]) + '</td><td><button class="k-link" data-focus-slot="' + lt.slots[0] + '">' + esc(c.slots[lt.slots[0]].label) + ' ~ ' + esc(fmt.short(c.slots[lt.slots[lt.slots.length - 1]].day)) + '</button></td><td>' + lt.series + '연속 원정</td><td>' + UI.stateChip('warn', fmt.km(lt.tenths / 10) + 'km') + '</td></tr>').join('') : '<tr><td colspan="4" class="k-muted">임계값(' + app.state.settings.longTripKm + 'km)을 넘는 연속 원정 없음</td></tr>') + '</tbody></table>';
  };
  /** FR-A12 월별 홈경기 히트맵 */
  C.monthlyHome = (app) => {
    const c = app.derived();
    const st = app.state;
    const months = Array.from(new Set(c.slots.map((s) => s.month))).sort((a, b) => a - b);
    const vals = st.teams.map(() => months.map(() => 0));
    st.matches.forEach((m, i) => { const s = c.plan[i]; if (s < 0) return; vals[c.teamIndex.get(m.home)][months.indexOf(c.slots[s].month)] += m.consecutive; });
    return Chart.heatmap({ rows: st.teams.map((t) => t.name), cols: months.map((m) => m + '월'), values: vals, title: '월별 홈경기 수', cellW: 46 });
  };

  C.CATALOG = [
    { id: 'distance', title: '구단별 총 이동거리', req: 'FR-A1', fn: C.distance },
    { id: 'moves', title: '구단별 이동 횟수', req: 'FR-A2', fn: C.moves },
    { id: 'holiday', title: '휴일 가중치 합', req: 'FR-A2', fn: C.holiday },
    { id: 'weekend', title: '주말 홈/원정 (참고)', req: 'FR-A2', fn: C.weekend },
    { id: 'flow', title: '홈/원정 흐름 스트립', req: 'FR-A3', fn: C.flow, wide: true },
    { id: 'cumulative', title: '누적 이동거리', req: 'FR-A4', fn: C.cumulative, wide: true },
    { id: 'opponents', title: '상대 매트릭스', req: 'FR-A5', fn: C.opponents },
    { id: 'radar', title: '공정성 레이더', req: 'FR-A7', fn: C.radar },
    { id: 'weekday', title: '주중 이동 분석 (참고)', req: 'FR-A8', fn: C.weekday },
    { id: 'summer', title: '혹서기 부담', req: 'FR-A9', fn: C.summer },
    { id: 'longTrips', title: '장거리 연속 원정 경고', req: 'FR-A10', fn: C.longTrips },
    { id: 'monthlyHome', title: '월별 홈경기 히트맵', req: 'FR-A12', fn: C.monthlyHome }
  ];

  /** 차트 묶음 패널. opts: { ids:[...], cardClass, width } */
  P.chartsPanel = function (el, app, opts) {
    const o = opts || {};
    const list = o.ids ? o.ids.map((id) => C.CATALOG.find((x) => x.id === id)).filter(Boolean) : C.CATALOG;
    const render = () => {
      el.innerHTML = '<div class="k-charts">' + list.map((x) => '<figure class="k-chart-card' + (x.wide ? ' k-wide' : '') + ' ' + (o.cardClass || '') + '" id="' + (o.idPrefix || 'chart-') + x.id + '"><figcaption><b>' + esc(x.title) + '</b> <span class="k-muted k-small">' + x.req + '</span></figcaption>' + x.fn(app, { width: x.wide ? (o.wideWidth || 960) : (o.width || 480) }) + '</figure>').join('') + '</div>';
    };
    on(el, 'click', '[data-focus-slot]', (e, b) => app.focus({ slot: Number(b.dataset.focusSlot) }));
    on(el, 'click', '.kc-item[data-key]', (e, g) => app.toggleTeamFilter(g.dataset.key));
    return UI.mount(el, app, render, ['plan', 'pins', 'calendar', 'matches', 'teams', 'distance', 'settings', 'filter']);
  };

  // ───────────── 지도 위 이동 경로 + 재생 (FR-A6) ─────────────
  P.routeMap = function (el, app, opts) {
    const o = opts || {};
    let team = o.team || (app.state.teams[0] && app.state.teams[0].name);
    let step = null; // 재생 중 표시할 방문 수
    let timer = null;
    el.innerHTML = '<div class="k-route"><div class="k-toolbar k-route-bar"><label class="k-field-inline">구단 <select class="k-input" data-act="team"></select></label><button class="k-btn" data-act="play">▶ 시즌 경로 재생</button><button class="k-btn k-btn-ghost" data-act="reset">전체 보기</button><span class="k-route-status k-small k-muted" aria-live="polite"></span></div><div class="k-route-map"></div></div>';
    const sel = el.querySelector('[data-act=team]');
    const status = el.querySelector('.k-route-status');
    const fillSel = () => { sel.innerHTML = app.state.teams.map((t) => '<option' + (t.name === team ? ' selected' : '') + '>' + esc(t.name) + '</option>').join(''); };
    fillSel();
    const visits = () => { const c = app.derived(); const t = c.teamIndex.get(team); return t == null ? [] : c.ex.teamMetrics[t].visits; };
    const widget = UI.mapWidget(el.querySelector('.k-route-map'), app, {
      width: o.width || 420, allowKakao: true, tags: ['plan', 'teams', 'map', 'route'],
      markers: () => {
        const v = visits();
        const shown = step == null ? v : v.slice(0, step);
        const cur = shown.length ? shown[shown.length - 1].loc : -1;
        const count = new Map();
        for (const x of shown) count.set(x.loc, (count.get(x.loc) || 0) + 1);
        return app.state.teams.map((t, i) => ({ id: 'r' + i, lat: Number(t.latitude), lon: Number(t.longitude), label: t.name, color: t.color, size: t.name === team ? 9 : 6, ring: i === cur, sub: count.get(i) ? count.get(i) + '회 방문' : '' }));
      },
      lines: () => {
        const v = visits();
        const shown = step == null ? v : v.slice(0, step);
        const T = app.state.teams;
        const col = (app.team(team) || {}).color || '#364fc7';
        const out = [];
        for (let k = 1; k < shown.length; k++) {
          const a = T[shown[k - 1].loc], b = T[shown[k].loc];
          if (!a || !b || shown[k].legTenths === 0) continue;
          out.push({ from: { lat: a.latitude, lon: a.longitude }, to: { lat: b.latitude, lon: b.longitude }, color: col, width: k === shown.length - 1 && step != null ? 3.5 : 1.6, arrow: true, dim: step != null && k < shown.length - 3, title: app.derived().slots[shown[k].slot].label + ' ' + fmt.km(shown[k].legTenths / 10) + 'km' });
        }
        return out;
      },
      caption: () => {
        const v = visits();
        const tot = v.length ? v[v.length - 1].cumTenths / 10 : 0;
        return esc(team) + ' 시즌 이동 ' + fmt.km(tot) + 'km · ' + v.filter((x) => x.legTenths > 0).length + '회 이동';
      }
    });
    const stopPlay = () => { if (timer) clearInterval(timer); timer = null; };
    on(el, 'change', '[data-act=team]', () => { team = sel.value; step = null; stopPlay(); widget.refresh(); status.textContent = ''; });
    on(el, 'click', '[data-act]', (e, b) => {
      if (b.dataset.act === 'play') {
        stopPlay(); step = 1;
        const v = visits();
        timer = setInterval(() => {
          step++;
          if (step > v.length) { stopPlay(); step = null; status.textContent = '재생 완료'; }
          else { const x = v[step - 1]; status.textContent = step + '/' + v.length + ' · ' + app.derived().slots[x.slot].label + ' · ' + (x.home ? '홈' : '원정 @ ' + app.state.teams[x.loc].name) + ' · 누적 ' + fmt.km(x.cumTenths / 10) + 'km'; }
          widget.refresh();
        }, o.interval || 450);
      } else if (b.dataset.act === 'reset') { stopPlay(); step = null; status.textContent = ''; widget.refresh(); }
    });
    app.subscribe((ch) => { if (ch.tags.has('teams') || ch.tags.has('all')) fillSel(); if (ch.tags.has('filter') && app.ui.teamFilter.size === 1) { team = Array.from(app.ui.teamFilter)[0]; fillSel(); widget.refresh(); } });
    return { refresh: widget.refresh, setTeam: (t) => { team = t; fillSel(); step = null; widget.refresh(); } };
  };
})();
