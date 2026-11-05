/*
 * 2027 흐름 — 「구단별 보기」 (④ 화면을 한 구단 · 두 구단 비교 · 리그 전체(임시)로 다시 나눔)
 *   한 구단: 구단별 일정표 + 오른쪽 구단 카드 (step-quality.js 그대로)
 *   두 구단 비교(qv=cmp): 둘째 구단(team2)을 고르면 가운데에 지도 위 두 경로 + 누적 이동거리 두 선, 오른쪽에 항목별 비교
 *   리그 전체: 홈/원정 흐름 · 상대별 경기 수 표 — 「일정 자세히 보기」로 옮길 때까지 여기 둔다
 * 화면 하나는 질문 하나(사용자 결정 2026-11-06): 가운데가 한 구단이면 오른쪽도 그 구단, 둘이면 둘.
 * LAYOUT: 'card' = 비교 항목을 오른쪽 카드에(표준 가) / 'table' = 오른쪽 칸 없이 지도 아래 표에(옵션 나)
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, MapKit } = KBO;
  const YEAR_NEW = 2027;
  const LAYOUT = 'table';
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
    const u = S.ui, V = Q().VIEWS.concat(S.qvExtraViews);
    const vis = Q().visible().map((v) => v.id);
    const li = (id, label, ico, extra) => (vis.includes(id) ? '<button class="li' + (u.qv === id ? ' active' : '') + '" data-act="q-view" data-qv="' + id + '"><span class="ico">' + icon(ico) + '</span><span class="li-main">' + esc(label) + '</span>' + (extra || '') + '</button>' : '');
    const label = (id) => { const v = V.find((x) => x.id === id); return v ? v.label : id; };
    let s = '<div class="pane-head"><span class="pane-title">보기</span><span class="pane-desc">한 구단 · 두 구단 · 리그 전체</span></div><div class="pane-body" data-sk="q-list">';
    s += '<div class="label">구단</div>' + li('sched', '구단별 일정표', 'print') + li('cmp', '두 구단 비교', 'swap', u.team2 ? '<span class="cnt">' + esc(u.team) + '·' + esc(u.team2) + '</span>' : '');
    const league = ['a3', 'a5', 'a9', 'a10', 'a12'].filter((id) => vis.includes(id));
    if (league.length) s += '<div class="label">리그 전체</div>' + league.map((id) => li(id, label(id), id === 'a3' ? 'grid' : id === 'a5' ? 'grid' : 'chart')).join('');
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
  function map(A, B) {
    const st = app().state, both = [A, B];
    const markers = st.teams.map((t, i) => { const k = both.findIndex((x) => x.team === i); return { id: 'tv' + i, lat: Number(t.latitude), lon: Number(t.longitude), label: t.name, color: k >= 0 ? t.color : '#8E97A6', size: k >= 0 ? 7 : 4.5, ring: k >= 0, ringColor: '#0A1E3C', sub: k >= 0 ? '홈' : '' }; });
    const lines = [];
    both.forEach((t, k) => { for (const l of legsOf(t)) lines.push({ from: { lat: Number(l.from.latitude), lon: Number(l.from.longitude) }, to: { lat: Number(l.to.latitude), lon: Number(l.to.longitude) }, color: st.teams[t.team].color, width: 2, curve: k === 0 ? 0.18 : -0.18, dash: k === 1 ? '6 3' : null, title: t.name + ' ' + Dates.fmtShort(l.day) + ' ' + l.from.name + ' → ' + l.to.name + ' ' + fmt.km(l.km) + 'km' }); });
    return MapKit.render({ width: 520, markers, lines, grid: false, spread: 8, title: A.name + '·' + B.name + ' 시즌 이동 경로', extraClass: 'rt-svg tv-svg' }).svg;
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
    let s = S.paneHead('두 구단 비교', '지도의 선은 구장 사이를 곧게 이은 것이고, 거리 숫자는 도로 거리입니다. 선 위에 마우스를 올리면 그 구간이 나옵니다.', right);
    s += '<div class="pane-body pad" data-sk="tv-cmp">';
    s += '<div class="tv-sum">' + head2(A, B) + '<span class="tv-k">총 이동 <b>' + fmt.km(A.distanceKm) + '</b> / <b>' + fmt.km(B.distanceKm) + '</b> km</span><span class="tv-k">이동 <b>' + A.moves + '</b> / <b>' + B.moves + '</b> 회</span><span class="tv-k diff">차이 ' + fmt.km(Math.abs(A.distanceKm - B.distanceKm)) + 'km · ' + Math.abs(A.moves - B.moves) + '회</span></div>';
    const cw = S.wide ? 560 : 440, ch = S.wide ? 440 : 380;
    s += '<div class="tv-grid"><div class="tv-map"><div class="tv-sub">시즌 이동 경로</div>' + map(A, B) + '</div><div class="tv-chart"><div class="tv-sub">누적 이동거리</div><div class="chart-box">' + cumChart(A, B, cw, ch) + '</div></div></div>';
    if (LAYOUT === 'table') s += '<div class="tv-sub" style="margin-top:12px">항목별 비교</div>' + cmpTable(A, B, 'wide') + '<div class="tv-strips"><div><span class="tv-t">' + S.team(A.name) + '</span>' + strip(A) + '</div><div><span class="tv-t">' + S.team(B.name) + '</span>' + strip(B) + '</div><div class="xs muted">진한 칸 홈 · 옅은 칸 원정 · 빨간 테두리 4연속 이상</div></div>';
    return s + '</div>';
  }

  // ───────── 오른쪽: 구단 카드 / 비교 카드 ─────────
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
    const o = orig();
    if (!u.team || !tm(u.team)) return o;
    const btn = u.pick2
      ? '<div class="insp-sec tv-pick"><b>' + icon('swap') + ' 왼쪽 목록에서 비교할 구단을 고르세요</b> <button class="btn sm ghost" data-act="tv-pick2-cancel">취소</button></div>'
      : '<div class="insp-sec"><button class="btn sm" data-act="tv-pick2">' + icon('swap') + '다른 구단과 비교</button>' + (u.team2 && tm(u.team2) ? ' <button class="btn sm ghost" data-act="q-view" data-qv="cmp">' + esc(u.team2) + '와(과) 비교 보기</button>' : '') + '</div>';
    const at = o.html.indexOf('<div class="insp-sec"><h4>점수 반영 지표');
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
