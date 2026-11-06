/*
 * 2027 흐름 — 「구단별 보기」 (④ 화면을 한 구단 · 두 구단 비교로 다시 나눔)
 *   한 구단: 구단별 일정표 + 오른쪽 구단 카드 (step-quality.js 그대로)
 *   두 구단 비교(qv=cmp): 둘째 구단(team2)을 고르면 이동 구간 띠(위 첫 구단·아래 둘째 구단, 막대 = 이동 한 번) + 누적 이동거리 + 항목별 비교
 *   지도는 뺐다(사용자 결정 2026-11-06): 열 구장 중 다섯이 수도권에 몰려 선이 겹치고, 두 구단의 차이는 「어디」가 아니라 「언제 얼마나 멀리」에 있다
 *   리그 전체(홈/원정 흐름 띠 · 상대별 경기 수)는 「일정 자세히 보기」(step-result.js)의 탭으로 옮겼다(2026-11-06)
 * 화면 하나는 질문 하나(사용자 결정 2026-11-06): 가운데가 한 구단이면 오른쪽도 그 구단, 둘이면 둘.
 * LAYOUT: 'card' = 비교 항목을 오른쪽 카드에(표준 가) / 'table' = 오른쪽 칸 없이 지도 아래 표에(옵션 나)
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates } = KBO;
  const YEAR_NEW = 2027;
  const LAYOUT = 'table';
  const SHOW_CUM = true; // 누적 이동거리 선을 띠 아래에 같이 둘지(옵션에서는 끈다)
  const is27 = () => S.seasonYear() === YEAR_NEW;
  const app = () => S.app;
  const D = () => S.app.derived();
  const Q = () => S.qvParts;
  const tm = (name) => Q().tms().find((t) => t.name === name);

  // ───────── 보기 목록에 「두 구단 비교」를 더한다(2027에서만) ─────────
  S.qvExtraViews = [{ id: 'cmp', group: '구단', label: '두 구단 비교', icon: 'swap', ref: 'FR-A4' }];
  const prevHidden = S.qvHidden || (() => false); // 옛 화면(classic)에서는 plan-flow.js가 일찍 끝나 qvHidden이 없다
  S.qvHidden = (id) => (id === 'cmp' ? !is27() : prevHidden(id));

  /** 비교 짝이 갖춰졌는지. 같은 구단이 둘이면 둘째를 버린다 */
  function pair() {
    const u = S.ui;
    if (u.team2 && u.team2 === u.team) u.team2 = null;
    const A = u.team && tm(u.team), B = u.team2 && tm(u.team2);
    return A && B ? { A, B } : null;
  }

  // ───────── 왼쪽: 보기 · 구단 ─────────
  function renderList() {
    const u = S.ui;
    const vis = Q().visible().map((v) => v.id);
    const li = (id, label, ico, extra) => (vis.includes(id) ? '<button class="li' + (u.qv === id ? ' active' : '') + '" data-act="q-view" data-qv="' + id + '"><span class="ico">' + icon(ico) + '</span><span class="li-main">' + esc(label) + '</span>' + (extra || '') + '</button>' : '');
    let s = '<div class="pane-head"><span class="pane-title">보기</span><span class="pane-desc">한 구단 · 두 구단</span></div><div class="pane-body" data-sk="q-list">';
    s += '<div class="label">구단</div>' + li('sched', '구단별 일정표', 'print') + li('cmp', '두 구단 비교', 'swap', u.team2 ? '<span class="cnt">' + esc(u.team) + '·' + esc(u.team2) + '</span>' : '');
    s += '<div class="list-sep"></div>';
    s += u.pick2
      ? '<div class="label tv-pick">' + icon('swap') + ' 비교할 구단을 고르세요 <button class="btn sm ghost" data-act="tv-pick2-cancel">취소</button></div>'
      : '<div class="label">구단' + (u.qv === 'cmp' ? ' <span class="muted">둘을 고릅니다</span>' : '') + '</div>';
    s += '<div class="tf' + (u.pick2 ? ' picking' : '') + '">' + app().state.teams.map((t) => {
      const one = u.team === t.name, two = u.team2 === t.name && (u.qv === 'cmp' || u.pick2);
      return '<button class="' + (one ? 'on' : two ? 'on2' : '') + '" data-act="q-team" data-team="' + esc(t.name) + '"><i class="sw" style="background:' + esc(t.color) + '"></i>' + esc(t.name) + '<span class="ck">' + (one ? icon('check') : two ? '<span class="tag2">비교</span>' : '') + '</span></button>';
    }).join('') + '</div>';
    return s + '</div>';
  }

  // ───────── 비교 항목 ─────────
  /** 두 구단에 같은 줄로 놓을 항목. low: 작을수록 좋음(진하게) */
  function rows(A, B) {
    const trip = (t) => (t.longTrips.length ? t.longTrips.length + '번 · 최대 ' + fmt.km(Math.max(...t.longTrips.map((x) => x.tenths)) / 10) + 'km' : '없음');
    return [
      { k: '총 이동거리', a: fmt.km(A.distanceKm) + 'km', b: fmt.km(B.distanceKm) + 'km', va: A.distanceKm, vb: B.distanceKm, low: true, diff: fmt.km(Math.abs(A.distanceKm - B.distanceKm)) + 'km' },
      { k: '이동 횟수', a: A.moves + '회', b: B.moves + '회', va: A.moves, vb: B.moves, low: true, diff: Math.abs(A.moves - B.moves) + '회' },
      { k: '주말 홈', a: A.weekendHome + '시리즈', b: B.weekendHome + '시리즈', va: A.weekendHome, vb: B.weekendHome, diff: Math.abs(A.weekendHome - B.weekendHome) + '시리즈' },
      { k: '최장 연속 홈 · 원정', a: A.maxHomeRun + ' · ' + A.maxAwayRun, b: B.maxHomeRun + ' · ' + B.maxAwayRun },
      { k: '장거리 연속 원정', a: trip(A), b: trip(B), va: A.longTrips.length, vb: B.longTrips.length, low: true },
      { k: '7~8월 원정', a: A.summerAwayGames + '경기', b: B.summerAwayGames + '경기', va: A.summerAwayGames, vb: B.summerAwayGames, low: true, diff: Math.abs(A.summerAwayGames - B.summerAwayGames) + '경기' },
      { k: '공휴일 홈', a: A.holidayHomeGames + '경기', b: B.holidayHomeGames + '경기', va: A.holidayHomeGames, vb: B.holidayHomeGames, diff: Math.abs(A.holidayHomeGames - B.holidayHomeGames) + '경기' }
    ];
  }
  const mark = (r, side) => (r.low && r.va !== r.vb && (side === 'a' ? r.va < r.vb : r.vb < r.va) ? ' class="lo"' : '');
  function strip(t) {
    const c = D(), bySlot = new Map(t.visits.map((v) => [v.slot, v]));
    const over = new Set(); for (const r of t.runs) if (r.length > 3) r.slots.slice(3).forEach((x) => over.add(x));
    return '<div class="mini-strip">' + c.slots.map((sl) => { const v = bySlot.get(sl.index); return '<i class="' + (v && v.home ? 'h' : '') + (over.has(sl.index) ? ' over' : '') + '"' + (v ? '' : ' style="background:#fff"') + '></i>'; }).join('') + '</div>';
  }
  const head2 = (A, B) => '<span class="tv-two"><span class="tv-t">' + S.team(A.name) + '<i class="ln"></i></span><span class="tv-t">' + S.team(B.name) + '<i class="ln dash"></i></span></span>';
  function cmpTable(A, B, cls) {
    return '<table class="tv-tbl ' + (cls || '') + '"><thead><tr><th></th><th>' + S.team(A.name) + '</th><th>' + S.team(B.name) + '</th><th>차이</th></tr></thead><tbody>' +
      rows(A, B).map((r) => '<tr><td>' + esc(r.k) + '</td><td' + mark(r, 'a') + '>' + esc(r.a) + '</td><td' + mark(r, 'b') + '>' + esc(r.b) + '</td><td class="muted">' + esc(r.diff || '') + '</td></tr>').join('') +
      '</tbody></table><div class="xs muted" style="margin-top:4px">진한 값 = 둘 중 작은 쪽(이동·원정 부담이 덜함)</div>';
  }

  // ───────── 가운데: 지도 + 누적 이동거리 (+ 표) ─────────
  function legsOf(t) {
    const c = D(), st = app().state, out = [];
    for (let i = 1; i < t.visits.length; i++) {
      const p = t.visits[i - 1], v = t.visits[i];
      if (v.loc === p.loc) continue;
      out.push({ from: st.teams[p.loc], to: st.teams[v.loc], day: c.slots[v.slot].day, km: v.legTenths / 10 });
    }
    return out;
  }
  /** 이동 구간 띠: 가로 = 시즌 날짜, 막대 하나 = 이동 한 번, 높이 = 그 구간 거리. 위 첫 구단, 아래 둘째 구단(거울). 장거리 연속 원정은 빨간 점선 상자 */
  function legStrip(A, B, W, H) {
    const c = D(), st = app().state, slots = c.slots;
    const day0 = slots[0].day, dayN = slots[slots.length - 1].day + slots[slots.length - 1].consecutive;
    const padL = 64, padR = 16, padT = 26, padB = 22, mid = padT + (H - padT - padB) / 2, half = (H - padT - padB) / 2 - 6;
    const x = (d) => padL + (d - day0) / (dayN - day0) * (W - padL - padR);
    const legs = [legsOf(A), legsOf(B)];
    const max = Math.max(1, ...legs.flat().map((l) => l.km));
    const bw = Math.max(5, Math.min(10, (W - padL - padR) / 60));
    let s = '<svg class="tv-leg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(A.name + '·' + B.name + ' 이동 구간 거리') + '">';
    // 달 경계
    const starts = []; const seen = new Set();
    for (let d = day0; d < dayN; d++) { const m = Dates.month(d); if (!seen.has(m)) { seen.add(m); starts.push({ d, m }); } }
    starts.forEach((o, i) => { const xx = x(o.d), next = i + 1 < starts.length ? x(starts[i + 1].d) : W - padR;
      s += '<line class="tv-leg-grid" x1="' + xx.toFixed(1) + '" x2="' + xx.toFixed(1) + '" y1="' + padT + '" y2="' + (H - padB) + '"/>' + (next - xx > 28 ? '<text class="tv-leg-month" x="' + (xx + 3).toFixed(1) + '" y="' + (H - 7) + '">' + o.m + '월</text>' : ''); });
    s += '<line class="tv-leg-axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + mid + '" y2="' + mid + '"/>';
    // 눈금(최대 거리)
    s += '<text class="tv-leg-tick" x="' + (padL - 6) + '" y="' + (mid - half + 4) + '" text-anchor="end">' + fmt.int(max) + 'km</text><text class="tv-leg-tick" x="' + (padL - 6) + '" y="' + (mid + half + 4) + '" text-anchor="end">' + fmt.int(max) + 'km</text>';
    [A, B].forEach((t, k) => {
      const color = st.teams[t.team].color, up = k === 0;
      s += '<text class="tv-leg-team" x="' + (padL - 6) + '" y="' + (up ? mid - 8 : mid + 16) + '" text-anchor="end" fill="' + esc(color) + '">' + esc(t.name) + '</text>';
      // 장거리 연속 원정 상자
      for (const lt of t.longTrips) { const a = slots[lt.slots[0]], b = slots[lt.slots[lt.slots.length - 1]]; const x1 = x(a.day) - bw, x2 = x(b.day + b.consecutive);
        s += '<rect class="tv-leg-trip" x="' + x1.toFixed(1) + '" y="' + (up ? mid - half - 4 : mid + 2).toFixed(1) + '" width="' + (x2 - x1).toFixed(1) + '" height="' + (half + 2).toFixed(1) + '" rx="3"><title>' + esc(t.name + ' 장거리 연속 원정 ' + Dates.fmtDate(a.day) + '부터 ' + lt.series + '시리즈 · ' + fmt.km(lt.tenths / 10) + 'km') + '</title></rect>'; }
      for (const l of legs[k]) { const h = Math.max(2, l.km / max * half), xx = x(l.day) - bw / 2;
        s += '<rect class="tv-bar" x="' + xx.toFixed(1) + '" y="' + (up ? mid - h : mid + 1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.5" fill="' + esc(color) + '"><title>' + esc(t.name + ' ' + Dates.fmtDate(l.day) + ' ' + l.from.name + ' → ' + l.to.name + ' ' + fmt.km(l.km) + 'km') + '</title></rect>'; }
    });
    return s + '</svg>';
  }
  function cumChart(A, B, w, h) {
    const c = D(), st = app().state;
    const series = [A, B].map((t, k) => { const vals = []; let cum = 0; const bySlot = new Map(t.visits.map((v) => [v.slot, v]));
      for (const sl of c.slots) { const v = bySlot.get(sl.index); if (v) cum = v.cumTenths / 10; vals.push(cum); }
      return { label: t.name, color: st.teams[t.team].color, values: vals, emphasis: true, dash: k === 1 ? '6 3' : null }; });
    return KBO.Chart.line({ series, xLabels: c.slots.map((s) => Dates.fmtShort(s.day)), width: w, height: h, format: (v) => fmt.km(v), title: '누적 이동거리' });
  }
  function renderCmp() {
    const u = S.ui, p = pair();
    if (!p) {
      u.pick2 = true; // 비교 보기로 들어왔는데 둘째 구단이 없으면 바로 고르게
      const one = u.team ? tm(u.team) : null;
      return S.paneHead('두 구단 비교', '두 구단의 시즌 이동 경로와 누적 이동거리를 겹쳐 봅니다.') +
        '<div class="pane-body pad" data-sk="tv-cmp"><div class="empty"><b>' + icon('swap') + ' 비교할 구단을 하나 더 고르세요</b>' + (one ? esc(one.name) + '와(과) 견줄 구단을 왼쪽 목록에서 누르면 지도 위 두 경로와 누적 이동거리가 나옵니다.' : '왼쪽 목록에서 구단 둘을 차례로 누르세요.') + '</div></div>';
    }
    const { A, B } = p;
    const right = '<button class="btn sm" data-act="tv-swap" title="두 구단 자리 바꾸기">' + icon('swap') + '자리 바꾸기</button><button class="btn sm" data-act="tv-cmp-off">' + icon('x') + '비교 끝내기</button>';
    let s = S.paneHead('두 구단 비교', '막대 하나가 이동 한 번, 높이가 그 구간 거리입니다. 위가 첫 구단, 아래가 둘째 구단. 막대에 마우스를 올리면 그 구간이 나옵니다.', right);
    s += '<div class="pane-body pad" data-sk="tv-cmp">';
    s += '<div class="tv-sum">' + head2(A, B) + '<span class="tv-k">총 이동 <b>' + fmt.km(A.distanceKm) + '</b> / <b>' + fmt.km(B.distanceKm) + '</b> km</span><span class="tv-k">이동 <b>' + A.moves + '</b> / <b>' + B.moves + '</b> 회</span><span class="tv-k diff">차이 ' + fmt.km(Math.abs(A.distanceKm - B.distanceKm)) + 'km · ' + Math.abs(A.moves - B.moves) + '회</span></div>';
    const sw = S.wide ? 1180 : 900, sh = S.tall ? 220 : 190;
    s += '<div class="tv-sub">이동 구간 거리 <span class="muted">· 빨간 점선 상자 = 장거리 연속 원정</span></div><div class="tv-strip">' + legStrip(A, B, sw, sh) + '</div>';
    const cw = S.wide ? 560 : 440, ch = S.wide ? 300 : 270;
    const table = cmpTable(A, B, 'wide') + '<div class="tv-strips"><div><span class="tv-t">' + S.team(A.name) + '</span>' + strip(A) + '</div><div><span class="tv-t">' + S.team(B.name) + '</span>' + strip(B) + '</div><div class="xs muted">진한 칸 홈 · 옅은 칸 원정 · 빨간 테두리 4연속 이상</div></div>';
    if (LAYOUT === 'table') {
      s += SHOW_CUM
        ? '<div class="tv-grid"><div class="tv-chart"><div class="tv-sub">누적 이동거리</div><div class="chart-box">' + cumChart(A, B, cw, ch) + '</div></div><div><div class="tv-sub">항목별 비교</div>' + table + '</div></div>'
        : '<div class="tv-sub" style="margin-top:12px">항목별 비교</div>' + table;
    } else if (SHOW_CUM) s += '<div class="tv-sub" style="margin-top:12px">누적 이동거리</div><div class="chart-box">' + cumChart(A, B, cw, ch) + '</div>';
    return s + '</div>';
  }

  // ───────── 오른쪽: 구단 카드 / 비교 카드 ─────────
  /** 한 구단 카드(2027). 옛 카드의 「평균 ± 범위」 경고표와 평균값은 뺐다(사용자 결정 2026-11-06): 엔진이 맞추는 기준은 격차·허용 수준이라 말이 달랐다 */
  function card(t) {
    const c = D(), st = app().state;
    const row = (k, v, unit, warn) => '<dt>' + esc(k) + '</dt><dd>' + (warn ? '<b style="color:var(--bad)">' + icon('warn') + v + '</b>' : '<b>' + v + '</b>') + (unit ? ' <span class="muted small">' + unit + '</span>' : '') + '</dd>';
    let s = '<div class="insp-sec"><div class="insp-title">' + S.team(t.name) + '</div><div class="insp-sub">' + esc(st.teams[t.team].stadium) + ' · 홈 ' + t.homeSeries + ' / 원정 ' + t.awaySeries + ' 시리즈</div></div>';
    s += '<div class="insp-sec"><h4>이동 · 휴일</h4><dl class="props">' +
      row('총 이동거리', fmt.km(t.distanceKm), 'km') +
      row('이동 횟수', t.moves, '회') +
      row('주말·공휴일 홈', t.holidayWeight, '점') + '</dl></div>';
    s += '<div class="insp-sec"><h4>홈 · 원정</h4><dl class="props">' +
      row('주말 홈/원정', t.weekendHome + ' / ' + t.weekendAway) +
      row('주중 이동', t.weekdayMoves + '회 · ' + fmt.km(t.weekdayMoveKm) + 'km') +
      row('최장 연속', '홈 ' + t.maxHomeRun + ' · 원정 ' + t.maxAwayRun, '', t.maxHomeRun > 3 || t.maxAwayRun > 3) +
      row('공휴일 홈', t.holidayHomeGames, '경기') +
      row('7~8월 원정', t.summerAwayGames, '경기') + '</dl></div>';
    s += '<div class="insp-sec"><h4>홈/원정 흐름<span class="r">연전 기간 ' + c.slots.length + '</span></h4>' + strip(t) + '</div>';
    s += '<div class="insp-sec"><h4>장거리 연속 원정</h4>' + (t.longTrips.length ? t.longTrips.map((lt) => '<div class="small">' + esc(Dates.fmtDate(c.slots[lt.slots[0]].day)) + ' 부터 ' + lt.series + '시리즈 · <b>' + fmt.km(lt.tenths / 10) + 'km</b></div>').join('') : '<span class="small muted">600km 초과 구간 없음</span>') + '</div>';
    s += '<div class="insp-sec"><button class="btn sm" data-act="q-to-cal" data-team="' + esc(t.name) + '">' + icon('cal') + '달력에서 이 구단만 보기</button></div>';
    return s;
  }
  function insp(orig) {
    const u = S.ui;
    if (u.qv === 'cmp') {
      const p = pair();
      if (!p) return orig();
      if (LAYOUT === 'table') return { title: '두 구단 비교', html: '', cls: 'tv-noinsp' };
      const { A, B } = p;
      let s = '<div class="insp-sec"><div class="insp-title">' + head2(A, B) + '</div><div class="insp-sub">같은 줄에 같은 항목 · 진한 값은 둘 중 작은 쪽</div></div>';
      s += '<div class="insp-sec"><h4>항목별</h4>' + cmpTable(A, B, 'card').replace(/<div class="xs muted"[\s\S]*$/, '') + '</div>';
      s += '<div class="insp-sec"><h4>홈/원정 흐름<span class="r">연전 기간 ' + D().slots.length + '</span></h4><div class="tv-strips"><div><span class="tv-t">' + S.team(A.name) + '</span>' + strip(A) + '</div><div><span class="tv-t">' + S.team(B.name) + '</span>' + strip(B) + '</div></div></div>';
      s += '<div class="insp-sec"><button class="btn sm" data-act="tv-swap">' + icon('swap') + '자리 바꾸기</button> <button class="btn sm" data-act="tv-cmp-off">' + icon('x') + '비교 끝내기</button></div>';
      return { title: '두 구단 비교', html: s };
    }
    const t = u.team && tm(u.team);
    if (!t) return orig();
    const o = { title: '구단 카드', html: card(t) };
    const btn = u.pick2
      ? '<div class="insp-sec tv-pick"><b>' + icon('swap') + ' 왼쪽 목록에서 비교할 구단을 고르세요</b> <button class="btn sm ghost" data-act="tv-pick2-cancel">취소</button></div>'
      : '<div class="insp-sec"><button class="btn sm" data-act="tv-pick2">' + icon('swap') + '다른 구단과 비교</button>' + (u.team2 && tm(u.team2) ? ' <button class="btn sm ghost" data-act="q-view" data-qv="cmp">' + esc(u.team2) + '와(과) 비교 보기</button>' : '') + '</div>';
    const at = o.html.indexOf('<div class="insp-sec"><h4>이동 · 휴일');
    return { title: o.title, html: at >= 0 ? o.html.slice(0, at) + btn + o.html.slice(at) : o.html + btn };
  }

  S.qvRenderers = Object.assign(S.qvRenderers || {}, { cmp: renderCmp });
  S.qvList = (orig) => (is27() ? renderList() : orig());
  S.qvInsp = (orig) => (is27() ? insp(orig) : orig());

  // ───────── 동작 ─────────
  const origTeam = S.actions['q-team'];
  Object.assign(S.actions, {
    'q-team': (el) => {
      if (!is27() || S.ui.step !== 4) return origTeam(el);
      const n = el.dataset.team, u = S.ui;
      if (u.pick2) { if (n !== u.team) { u.team2 = n; u.qv = 'cmp'; } u.pick2 = false; S.go({}); return; }
      if (u.qv === 'cmp') {
        if (n === u.team2) u.team2 = null;
        else if (n === u.team) { u.team = u.team2; u.team2 = null; }
        else if (!u.team) u.team = n;
        else u.team2 = n;
        S.go({}); return;
      }
      S.go({ team: n }); // 한 구단 보기에서는 고른 구단을 끄지 않는다(카드·일정표가 늘 한 구단을 보인다)
    },
    'tv-pick2': () => S.go({ pick2: true }),
    'tv-pick2-cancel': () => S.go({ pick2: false }),
    'tv-swap': () => S.go({ team: S.ui.team2, team2: S.ui.team }),
    'tv-cmp-off': () => S.go({ team2: null, pick2: false, qv: 'sched' })
  });
})();
