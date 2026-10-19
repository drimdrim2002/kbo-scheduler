/*
 * opt-3 경로 극장형 — 시즌 운영 · 이동 경로 재생 (FR-A6, W19·W20)
 * std 3분할(구단 목록 · 지도 · 구간 정보) 대신 지도를 작업 공간 가득 띄운다.
 *   위: 구단 칩 막대(최대 3구단 겹쳐 보기)
 *   가운데: 지도 + 겹쳐 그린 구단별 경로 + 현재 위치 말풍선(날짜·홈/원정 상대·이번 구간 km·누적 km)
 *           + 왼쪽 위 누적 이동거리 비교 HUD + 왼쪽 아래 범례
 *   아래: 시즌 타임라인 스크러버(재생·속도·월 눈금·구단별 홈/원정 띠·취소 ✕·재편성 구간·끌 수 있는 재생 위치)
 *
 * 데이터와 그리기는 std와 같은 공통 부품을 쓴다.
 *   - 구간 데이터: teamMetrics[t].visits (공통 P.routeMap과 같은 경로) + 재편성 묶음
 *   - 지도: core/svg-map.js KBO.MapKit.render (std와 같은 SVG 렌더러)
 * 시간 축은 모든 구단이 함께 쓰는 "정류장"이다. 정규 시즌은 슬롯 45개(모든 구단이 슬롯마다 한 시리즈),
 * 재편성 결과가 있으면 그 뒤에 재편성 묶음 첫 경기일(전체 구단 합집합)을 날짜순으로 붙인다.
 * S.ui.routePos(주소 leg=)는 이 축 위의 위치이고, 소수 부분은 다음 정류장으로 이동 중인 정도다.
 * 재생 중에는 경로 층·말풍선·HUD·재생 위치만 바꾸고 전체 렌더를 하지 않는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, MapKit } = KBO;
  const app = () => S.app;
  const D = () => S.app.derived();
  const BOX = { lonMin: 125.95, lonMax: 129.75, latMin: 34.7, latMax: 37.95 };
  const IBOX = { lonMin: 126.55, lonMax: 127.25, latMin: 37.24, latMax: 37.6 }; // 수도권 확대
  const SPEEDS = [1, 2, 4];
  const PER_SEC = 1.5; // 1× = 초당 1.5구간 (정규 시즌 45구간 ≈ 30초)
  const MAX_TEAMS = 3;
  const SHAPES = ['circle', 'square', 'diamond'];
  const SHAPE_NAME = { circle: '원', square: '네모', diamond: '마름모' };
  // 구단색이 서로 비슷하면(예: KT·롯데·두산의 짙은 색) 뒤에 고른 구단은 보조색으로 그린다. 구단색에 없는 색만 쓴다.
  const ALT = ['#0B7285', '#7048E8', '#2F9E44'];
  const reduce = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  const R = S.route = { playing: false, timer: null, proj: null, pts: null, cache: null, place: {} };
  // 첫 렌더가 축 길이(정규 시즌 45)에 맞춰 leg를 줄이기 전의 값 — demo=resched가 재편성 구간 위치로 쓰려고 둔다
  R.bootLeg = (() => { const m = /[#&]leg=([\d.]+)/.exec(location.hash || ''); return m ? parseFloat(m[1]) : null; })();

  // ───────── 데이터 ─────────
  /** 구간 목록: 1차 편성 방문 + (재편성 결과가 있으면) 9~10월 재편성 묶음 — std와 같다 */
  R.legs = function (name) {
    const c = D(), st = app().state;
    const ti = c.teamIndex.get(name);
    if (ti == null) return [];
    const tm = c.ex.teamMetrics[ti];
    const games = app().games();
    const cancelBy = new Map();
    for (const g of games) if (g.status === 'CANCELLED' && g.source === 'INITIAL') { const k = g.match; if (!cancelBy.has(k)) cancelBy.set(k, []); cancelBy.get(k).push(g); }
    const out = tm.visits.map((v) => {
      const sl = c.slots[v.slot];
      const can = (cancelBy.get(v.match) || []).filter((g) => sl.days.some((d) => Dates.isoDate(d) === g.date));
      return { kind: 'season', slot: v.slot, day: sl.day, end: sl.days[sl.days.length - 1], len: sl.consecutive, home: v.home, opp: st.teams[v.opp].name, loc: v.loc, leg: v.legTenths / 10, cum: v.cumTenths / 10, cancelled: can };
    });
    const rs = games.filter((g) => g.source === 'RESCHEDULE' && (g.home === name || g.away === name));
    if (rs.length) {
      const byUnit = new Map();
      for (const g of rs) { if (!byUnit.has(g.unit)) byUnit.set(g.unit, []); byUnit.get(g.unit).push(g); }
      const units = Array.from(byUnit.values()).map((l) => l.sort((a, b) => (a.date < b.date ? -1 : 1))).sort((a, b) => (a[0].date < b[0].date ? -1 : 1));
      let prev = out.length ? out[out.length - 1] : null, cum = prev ? prev.cum : 0;
      for (const l of units) {
        const g = l[0];
        const loc = c.teamIndex.get(g.home);
        const from = prev ? st.teams[prev.loc].name : g.home;
        const dm = prev && prev.loc !== loc ? app().distanceOf(from, g.home) : null;
        const leg = dm ? Number(dm.distance) || 0 : 0; // std는 distanceOf가 돌려준 객체를 숫자로 더해 NaN이 났다
        cum += leg;
        const x = { kind: 'resched', day: Dates.dayNum(g.date), end: Dates.dayNum(l[l.length - 1].date), len: l.length, home: g.home === name, opp: g.home === name ? g.away : g.home, loc, leg, cum, cancelled: [] };
        out.push(x); prev = x;
      }
    }
    return out;
  };

  /** 고른 구단 (1~3개). 없으면 ④에서 고른 구단 또는 KT */
  R.teams = function () {
    const u = S.ui, names = app().state.teams.map((t) => t.name);
    let l = (u.routeTeams || []).filter((n, i, a) => names.includes(n) && a.indexOf(n) === i).slice(0, MAX_TEAMS);
    if (!l.length) l = [u.team && names.includes(u.team) ? u.team : names.includes('KT') ? 'KT' : names[0]];
    u.routeTeams = l;
    return l;
  };

  function rgb(h) { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function cdist(a, b) { const x = rgb(a), y = rgb(b); const r = (x[0] + y[0]) / 2; return Math.sqrt((2 + r / 256) * (x[0] - y[0]) ** 2 + 4 * (x[1] - y[1]) ** 2 + (2 + (255 - r) / 256) * (x[2] - y[2]) ** 2); }
  function laneColors(names) {
    const used = [];
    return names.map((n, i) => {
      let c = (app().team(n) || {}).color || '#0A1E3C', alt = false;
      if (used.some((u) => cdist(u, c) < 150)) { c = ALT.find((a) => used.every((u) => cdist(u, a) >= 150)) || ALT[i % ALT.length]; alt = true; }
      used.push(c);
      return { color: c, alt };
    });
  }

  /** 렌더마다 한 번: 정류장 축 + 구단별 궤적. 데이터 버전·선택이 같으면 다시 쓰지 않는다 */
  function build() {
    const c = D(), names = R.teams();
    const key = c.version + '|' + names.join(',') + '|' + app().games().length;
    if (R.cache && R.cache.key === key) return R.cache;
    const stops = c.slots.map((sl, i) => ({ day: sl.day, kind: 'season', slot: i }));
    // 재편성: 묶음 첫 경기일(전체 구단 합집합)을 정류장으로 쓴다 — R.legs와 같은 규칙이라 고른 구단이 바뀌어도 축이 같다
    const um = new Map();
    for (const g of app().games()) if (g.source === 'RESCHEDULE') { const p = um.get(g.unit); if (!p || g.date < p) um.set(g.unit, g.date); }
    const uniq = Array.from(new Set(Array.from(um.values()))).sort();
    for (const d of uniq) stops.push({ day: Dates.dayNum(d), kind: 'resched' });
    const dayIdx = new Map(stops.map((s, i) => [s.day + ':' + s.kind, i]));
    const colors = laneColors(names);
    const tracks = names.map((name, li) => {
      const legs = R.legs(name);
      const N = stops.length;
      const legAt = new Array(N).fill(-1), arrive = new Array(N).fill(false), legStop = [];
      legs.forEach((l, j) => {
        const si = dayIdx.has(l.day + ':' + l.kind) ? dayIdx.get(l.day + ':' + l.kind) : (l.kind === 'season' ? l.slot : -1);
        legStop[j] = si;
        if (si >= 0) { legAt[si] = j; arrive[si] = true; }
      });
      let last = -1;
      for (let i = 0; i < N; i++) { if (legAt[i] >= 0) last = legAt[i]; else legAt[i] = last; }
      const tm = c.ex.teamMetrics.find((x) => x.name === name);
      const t = app().team(name) || {};
      return { name, legs, legAt, arrive, legStop, tm, team: t, lane: li, shape: SHAPES[li], color: colors[li].color, alt: colors[li].alt, total: legs.length ? legs[legs.length - 1].cum : 0 };
    });
    R.cache = { key, stops, tracks, N: stops.length, seasonN: c.slots.length };
    return R.cache;
  }

  /** 위치 p에서 한 구단의 상태 */
  function stateAt(tr, p, N) {
    const k = Math.max(0, Math.min(N - 1, Math.floor(p)));
    const fr = k < N - 1 ? Math.max(0, Math.min(1, p - k)) : 0;
    const j = tr.legAt[k];
    if (j < 0) return null;
    const cur = tr.legs[j];
    const nj = k + 1 < N && tr.arrive[k + 1] ? tr.legAt[k + 1] : -1;
    const nxt = nj >= 0 ? tr.legs[nj] : null;
    const moving = fr > 0 && !!nxt && nxt.loc !== cur.loc;
    const cum = cur.cum + (nxt && fr > 0 ? (nxt.cum - cur.cum) * fr : 0);
    return { k, fr, j, cur, nxt, moving, cum, arrived: tr.arrive[k] };
  }
  R.stateOf = function (name) { const c = build(); const tr = c.tracks.find((t) => t.name === name); return tr ? stateAt(tr, S.ui.routePos || 0, c.N) : null; };

  // ───────── 기하 ─────────
  function ctrl(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], c = 0.18; return [(a[0] + b[0]) / 2 - dy * c, (a[1] + b[1]) / 2 + dx * c]; }
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const f1 = (v) => v.toFixed(1);
  function curve(a, b) { const q = ctrl(a, b); return 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'Q' + f1(q[0]) + ' ' + f1(q[1]) + ' ' + f1(b[0]) + ' ' + f1(b[1]); }
  function partial(a, b, t) {
    const q = ctrl(a, b);
    const q0 = lerp(a, q, t), q1 = lerp(q, b, t), e = lerp(q0, q1, t);
    return { d: 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'Q' + f1(q0[0]) + ' ' + f1(q0[1]) + ' ' + f1(e[0]) + ' ' + f1(e[1]), end: e };
  }
  function shapeSvg(shape, r, color, cls) {
    const a = ' fill="' + esc(color) + '" stroke="#fff" stroke-width="2"' + (cls ? ' class="' + cls + '"' : '');
    if (shape === 'square') return '<rect x="' + -r + '" y="' + -r + '" width="' + 2 * r + '" height="' + 2 * r + '" rx="1.5"' + a + '/>';
    if (shape === 'diamond') { const q = r * 1.3; return '<path d="M0 ' + -q + 'L' + q + ' 0L0 ' + q + 'L' + -q + ' 0Z"' + a + '/>'; }
    return '<circle r="' + r + '"' + a + '/>';
  }
  /** 보조색으로 그린 구단은 이름 옆에 원래 구단색을 작게 남긴다 */
  function realDot(tr) { return tr && tr.alt ? '<i class="th-real" title="원래 구단색" style="background:' + esc(tr.team.color) + '"></i>' : ''; }
  function shapeIcon(shape, color) { return '<svg class="th-shape" viewBox="-8 -8 16 16" aria-hidden="true">' + shapeSvg(shape, 5.5, color) + '</svg>'; }

  // ───────── 그리기: 경로 층 (매 프레임) ─────────
  function teamLayer(tr, s, single, P) {
    const pt = (loc) => P[loc];
    const legs = tr.legs, n = legs.length;
    if (!s || !n) return { svg: '', pos: null };
    const j = s.j;
    const col = esc(tr.color);
    let out = '<g class="th-team" data-team="' + esc(tr.name) + '" style="--c:' + col + '">';
    if (single) for (let i = j + 2; i < n; i++) if (legs[i].loc !== legs[i - 1].loc) out += '<path class="rt-future" d="' + curve(pt(legs[i - 1].loc), pt(legs[i].loc)) + '"/>';
    for (let i = 1; i <= j; i++) {
      if (legs[i].loc === legs[i - 1].loc) continue;
      const age = j - i;
      const cls = age === 0 && !s.moving ? 'th-last' : age < 3 ? 'th-past recent' : 'th-past';
      out += '<path class="' + cls + (legs[i].kind === 'resched' ? ' rs' : '') + '" stroke="' + col + '" d="' + curve(pt(legs[i - 1].loc), pt(legs[i].loc)) + '"/>';
    }
    let pos = pt(s.cur.loc);
    if (s.moving) {
      const a = pt(s.cur.loc), b = pt(s.nxt.loc);
      const pp = partial(a, b, s.fr);
      out += '<path class="rt-ghost" stroke="' + col + '" d="' + curve(a, b) + '"/>';
      out += '<path class="th-now-under" d="' + pp.d + '"/><path class="th-now' + (s.nxt.kind === 'resched' ? ' rs' : '') + '" stroke="' + col + '" d="' + pp.d + '"/>';
      pos = pp.end;
    }
    out += '</g>';
    return { svg: out, pos };
  }
  function markerSvg(tr, s, pos) {
    return '<g class="rt-marker th-mk" data-team="' + esc(tr.name) + '" transform="translate(' + f1(pos[0]) + ' ' + f1(pos[1]) + ')"><circle r="12" class="th-halo" fill="' + esc(tr.color) + '" stroke="' + esc(tr.color) + '"/>' + shapeSvg(tr.shape, 6.5, tr.color) +
      (s.cur.cancelled.length && !s.moving ? '<text class="rt-x" x="9" y="-8">✕</text>' : '') + '</g>';
  }

  /** 한 지도에 고른 구단의 경로·위치 표시를 그린다. P = 그 지도의 구장 좌표 */
  function layerSet(c, states, P, single, gap) {
    let lines = '', marks = '';
    const pos = [];
    c.tracks.forEach((tr, i) => { const r = teamLayer(tr, states[i], single, P); lines += r.svg; pos[i] = r.pos; });
    // 같은 자리의 위치 표시는 살짝 벌린다
    const done = new Set();
    for (let i = 0; i < pos.length; i++) {
      if (!pos[i] || done.has(i)) continue;
      const grp = [i];
      for (let j = i + 1; j < pos.length; j++) if (pos[j] && !done.has(j) && Math.hypot(pos[j][0] - pos[i][0], pos[j][1] - pos[i][1]) < gap) grp.push(j);
      if (grp.length > 1) {
        const cx = pos[i][0], cy = pos[i][1];
        grp.forEach((g, n) => { const a = -Math.PI / 2 + 2 * Math.PI * n / grp.length; pos[g] = [cx + Math.cos(a) * gap, cy + Math.sin(a) * gap]; done.add(g); });
      }
    }
    c.tracks.forEach((tr, i) => { if (pos[i]) marks += markerSvg(tr, states[i], pos[i]); });
    return { lines, marks, pos };
  }

  function stadiumMarkers(c, small) {
    const sel = new Map(c.tracks.map((t) => [D().teamIndex.get(t.name), t]));
    return app().state.teams.map((t, i) => ({ id: 'rt' + i, lat: Number(t.latitude), lon: Number(t.longitude), label: t.name, color: sel.has(i) ? sel.get(i).color : '#8E97A6', size: sel.has(i) ? (small ? 5 : 5.5) : 4.5, ring: sel.has(i), ringColor: sel.has(i) ? sel.get(i).color : '#0A1E3C' }));
  }
  /** 경로 선은 구장 점 아래(rtLines), 움직이는 위치 표시는 맨 위(rtLayer)에 둔다 — 구장 이름이 선에 가리지 않게 */
  function layered(svg, id) {
    const i = svg.indexOf('<g class="kmap-marker');
    const s = i >= 0 ? svg.slice(0, i) + '<g id="' + id + 'Lines"></g>' + svg.slice(i) : svg;
    return s.replace('</svg>', '<g id="' + id + 'Layer"></g></svg>');
  }
  function baseMap(c) {
    const st = app().state;
    const r = MapKit.render({ width: 520, box: BOX, markers: stadiumMarkers(c), lines: [], grid: false, spread: 8, title: c.tracks.map((t) => t.name).join(' · ') + ' 시즌 이동 경로', extraClass: 'rt-svg th-svg' });
    R.proj = r.proj;
    R.pts = r.markers.map((m) => [m.x, m.y]);
    R.labelW = st.teams.map((t) => t.name.length * (/[가-힣]/.test(t.name) ? 11 : 7.4) + 6);
    // 수도권 확대 상자 표시
    const a = r.proj.project(IBOX.latMax, IBOX.lonMin), b = r.proj.project(IBOX.latMin, IBOX.lonMax);
    const box = '<rect class="th-inbox" x="' + f1(a[0]) + '" y="' + f1(a[1]) + '" width="' + f1(b[0] - a[0]) + '" height="' + f1(b[1] - a[1]) + '"/>';
    return layered(r.svg, 'rt').replace('<g id="rtLines">', box + '<g id="rtLines">');
  }
  /** 수도권 확대 지도 (SSG·키움·두산·LG·KT 다섯 구장이 몰려 있어 본 지도에서는 겹친다) */
  function insetMap(c) {
    const r = MapKit.render({ width: 250, box: IBOX, markers: stadiumMarkers(c, true), lines: [], grid: false, spread: 9, title: '수도권 확대', extraClass: 'rt-svg th-svg th-insvg' });
    R.ipts = r.markers.map((m) => [m.x, m.y]);
    return layered(r.svg, 'rtIn');
  }

  // ───────── 말풍선 · HUD ─────────
  const km0 = (v) => Math.round(v).toLocaleString('ko-KR');
  function legRange(l) {
    const a = fmt.date(l.day);
    if (l.end === l.day) return a;
    return a + '~' + (Dates.month(l.end) === Dates.month(l.day) ? String(Dates.fmtShort(l.end)).split('/')[1] : Dates.fmtShort(l.end));
  }
  function calloutHtml(tr, s) {
    const st = app().state, l = s.cur;
    const where = st.teams[l.loc].name;
    let h = '<div class="co-h">' + shapeIcon(tr.shape, tr.color) + '<b>' + esc(tr.name) + '</b>' + realDot(tr) + '<span class="co-d">' + esc(legRange(l)) + '</span></div>';
    h += '<div class="co-v">' + (l.home ? '<span class="home-mark">H</span>홈 · ' + esc(l.opp) + ' 상대' : '<span class="away-mark">A</span>원정 · ' + esc(where) + ' 구장, ' + esc(l.opp) + ' 상대') + (l.kind === 'resched' ? ' <span class="tag rs">재편성</span>' : '') + '</div>';
    if (s.moving) h += '<div class="co-m">' + icon('move') + esc(st.teams[s.nxt.loc].name) + ' 구장으로 이동 중 · ' + km0(s.nxt.leg) + 'km</div>';
    h += '<div class="co-k"><span>이번 구간 <b>' + (s.moving ? '+' + km0(s.nxt.leg) : l.leg ? '+' + km0(l.leg) : '0') + '</b>km</span><span>누적 <b>' + km0(s.cum) + '</b>km</span></div>';
    if (l.cancelled.length && !s.moving) h += '<div class="co-x">' + icon('x') + '이 시리즈 ' + l.cancelled.length + '경기 취소</div>';
    return h;
  }
  function hudHtml(c, states) {
    const p = S.ui.routePos || 0;
    const k = Math.max(0, Math.min(c.N - 1, Math.floor(p)));
    const stop = c.stops[k];
    const rs = stop.kind === 'resched';
    const max = Math.max(1, ...c.tracks.map((t) => t.total));
    const lead = Math.max(...states.map((s) => (s ? s.cum : 0)));
    let h = '<div class="hud-when"><b id="thWhen">' + esc(fmt.date(stop.day)) + '</b><span>' + (rs ? '재편성 ' + (k - c.seasonN + 1) + ' / ' + (c.N - c.seasonN) : (k + 1) + ' / ' + c.seasonN + ' 구간') + (rs ? '' : ' · 정규 시즌') + '</span></div>';
    h += '<div class="hud-h">누적 이동거리<span>막대 끝 눈금 = 시즌 합계</span></div>';
    c.tracks.forEach((tr, i) => {
      const s = states[i];
      const cum = s ? s.cum : 0;
      const gap = lead - cum;
      h += '<div class="hud-row" data-team="' + esc(tr.name) + '" style="--c:' + esc(tr.color) + '">' + shapeIcon(tr.shape, tr.color) + '<b class="n">' + esc(tr.name) + realDot(tr) + '</b>' +
        '<span class="bar" aria-hidden="true"><i style="width:' + (cum / max * 100).toFixed(1) + '%"></i><s style="left:' + (tr.total / max * 100).toFixed(1) + '%"></s></span>' +
        '<span class="v mono">' + fmt.km(cum) + '</span>' +
        '<span class="sub">' + (c.tracks.length > 1 && lead > 0.05 ? (gap < 0.05 ? '<em>가장 많이 이동</em>' : '−' + km0(gap) + 'km') + ' · ' : '') + (c.N > c.seasonN ? '재편성 포함 ' : '시즌 ') + (tr.tm.overDistance ? '<b class="over" title="정규 시즌 이동거리가 평균과 300km 넘게 차이">▲' + km0(tr.total) + '</b>' : km0(tr.total)) + 'km · 이동 ' + tr.tm.moves + '회</span></div>';
    });
    return h;
  }

  // ───────── 말풍선 배치 (겹침 피하기) ─────────
  function ov(a, b) { const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); return w > 0 && h > 0 ? w * h : 0; }
  function placeCallouts(stage, items, obst) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const placed = [];
    for (const it of items) {
      const w = it.el.offsetWidth, h = it.el.offsetHeight, [mx, my] = it.at;
      const cands = [];
      for (const g of [18, 46, 84]) {
        cands.push([mx + g, my - h / 2], [mx - g - w, my - h / 2], [mx + g * 0.7, my - h - g * 0.7], [mx - g * 0.7 - w, my - h - g * 0.7],
          [mx + g * 0.7, my + g * 0.7], [mx - g * 0.7 - w, my + g * 0.7], [mx - w / 2, my - h - g], [mx - w / 2, my + g]);
      }
      const prev = R.place[it.name];
      let best = null, bestScore = Infinity, bi = -1;
      cands.forEach(([x, y], ci) => {
        const r = [x, y, x + w, y + h];
        let sc = 0;
        const out = Math.max(0, 6 - x) + Math.max(0, 6 - y) + Math.max(0, x + w - (W - 6)) + Math.max(0, y + h - (H - 6));
        sc += out * 400;
        for (const p of placed) sc += ov(r, p) * 8;
        for (const o of obst) sc += ov(r, o.r) * o.w;
        sc += Math.floor(ci / 8) * 120; // 가까운 자리를 먼저
        if (prev === ci) sc -= 500;     // 자리를 자주 바꾸지 않는다 (재생 중 말풍선이 튀지 않게)
        if (sc < bestScore) { bestScore = sc; best = r; bi = ci; }
      });
      R.place[it.name] = bi;
      placed.push(best);
      it.el.style.left = best[0].toFixed(0) + 'px';
      it.el.style.top = best[1].toFixed(0) + 'px';
      it.rect = best;
    }
  }

  // ───────── 스크러버 ─────────
  function lanesHtml(c) {
    const k = Math.max(0, Math.min(c.N - 1, Math.floor(S.ui.routePos || 0)));
    let s = '';
    for (let li = 0; li < MAX_TEAMS; li++) {
      const tr = c.tracks[li];
      if (!tr) { s += '<div class="sc-lane empty">' + (li === c.tracks.length ? '<span>위 칩에서 구단을 더 고르면 여기에 홈·원정 띠가 나옵니다</span>' : '') + '</div>'; continue; }
      s += '<div class="sc-lane" data-team="' + esc(tr.name) + '" style="--c:' + esc(tr.color) + ';grid-template-columns:repeat(' + c.N + ',minmax(0,1fr))">';
      for (let i = 0; i < c.N; i++) {
        const has = tr.arrive[i];
        const l = has ? tr.legs[tr.legAt[i]] : null;
        const cls = !l ? 'no' : (l.kind === 'resched' ? 'rs ' : '') + (l.home ? 'h' : 'a') + (l.cancelled.length ? ' can' : '');
        s += '<i class="' + cls + (i < k ? ' past' : '') + (i === k ? ' cur' : '') + '"' + (l ? ' title="' + esc(tr.name + ' ' + fmt.date(l.day) + ' ' + (l.home ? '홈' : '원정') + ' · ' + l.opp + ' 상대' + (l.cancelled.length ? ' · 취소 ' + l.cancelled.length + '경기' : '') + (l.kind === 'resched' ? ' · 재편성' : '')) + '"' : '') + '></i>';
      }
      s += '</div>';
    }
    return s;
  }
  function axisHtml(c) {
    let s = c.N > c.seasonN ? '<span class="sc-band" style="left:' + (c.seasonN / c.N * 100).toFixed(3) + '%;right:0"><b>재편성 9~10월</b></span>' : '', mo = null;
    c.stops.forEach((st, i) => {
      const m = Dates.month(st.day);
      if (m !== mo) { mo = m; s += '<span class="sc-tick' + (st.kind === 'resched' ? ' rs' : '') + '" style="left:' + (i / c.N * 100).toFixed(3) + '%">' + m + '월</span>'; }
    });
    return s;
  }
  function headLeft(c, p) { return ((Math.max(0, Math.min(c.N - 1, p)) + 0.5) / c.N * 100).toFixed(3) + '%'; }
  function posText(c, p) {
    const k = Math.max(0, Math.min(c.N - 1, Math.floor(p)));
    const st = c.stops[k];
    return fmt.date(st.day) + (st.kind === 'resched' ? ' · 재편성 ' + (k - c.seasonN + 1) + '번째' : ' · ' + (k + 1) + '번째 구간 / ' + c.seasonN);
  }

  // ───────── 화면 ─────────
  R.render = function () {
    const u = S.ui, st = app().state;
    const c = build();
    if (u.routePos == null || u.routePos > c.N - 1) u.routePos = Math.max(0, c.seasonN - 1); // 처음 열면 정규 시즌 전체 경로
    const speed = u.routeSpeed || 1;
    const sel = new Map(c.tracks.map((t) => [t.name, t]));
    const tms = D().ex.teamMetrics;
    // 위: 구단 칩
    let bar = '<div class="th-bar"><span class="th-bar-l">구단</span><div class="th-chips" role="group" aria-label="겹쳐 볼 구단 (최대 3)">';
    for (const t of st.teams) {
      const tr = sel.get(t.name), m = tms.find((x) => x.name === t.name);
      bar += '<button class="th-chip' + (tr ? ' on' : '') + '" data-act="rt-team" data-team="' + esc(t.name) + '" aria-pressed="' + !!tr + '"' + (tr ? ' style="--c:' + esc(tr.color) + '"' : '') + ' title="' + esc(t.name + ' · ' + t.stadium + ' · 시즌 ' + fmt.km(m.distanceKm) + 'km' + (tr && tr.alt ? ' · 비슷한 색이 있어 보조색으로 그림' : '')) + '">' +
        (tr ? shapeIcon(tr.shape, tr.color) : '<i class="dot" style="background:' + esc(t.color) + '"></i>') + esc(t.name) + realDot(tr) + (m.overDistance ? '<span class="ov">▲</span>' : '') + '</button>';
    }
    bar += '</div><span class="th-bar-r small">' + c.tracks.length + ' / ' + MAX_TEAMS + '구단 겹쳐 보기 · 칩을 눌러 넣고 빼기 · <b style="color:var(--bad)">▲</b> 시즌 이동거리가 평균과 300km 넘게 차이</span></div>';
    // 가운데: 지도 무대
    const legend = '<div class="th-legend" id="thLegend"><span><i class="lg-line th-now"></i>지금 이동</span><span><i class="lg-line th-last"></i>마지막 구간</span><span><i class="lg-line th-past"></i>지나온 구간(흐림)</span>' + (c.tracks.length === 1 ? '<span><i class="lg-line future"></i>앞으로 갈 구간</span>' : '') +
      '<span><i class="lg-line th-rs"></i>재편성 경기(점선)</span><span><b style="color:var(--bad)">✕</b>취소 경기</span><span class="lg-shapes">' + c.tracks.map((t) => shapeIcon(t.shape, t.color) + esc(t.name)).join(' ') + '</span>' + (c.tracks.some((t) => t.alt) ? '<span class="muted">비슷한 구단색은 보조색으로 그립니다</span>' : '') + '</div>';
    let stage = '<div class="th-stage" id="thStage"><div class="th-map" id="rtMap">' + baseMap(c) + '</div>' +
      '<svg class="th-leads" id="thLeads" aria-hidden="true"></svg><div class="th-callouts" id="thCallouts" aria-live="off"></div>' +
      '<div class="th-inset" id="thInset"><div class="ins-h">수도권 확대<span>SSG · 키움 · 두산 · LG · KT</span></div>' + insetMap(c) + '</div>' +
      '<div class="th-hud" id="thHud">' + hudHtml(c, c.tracks.map((t) => stateAt(t, u.routePos || 0, c.N))) + '</div>' + legend + '</div>';
    // 아래: 스크러버
    const p = u.routePos || 0;
    let scrub = '<div class="th-scrub"><div class="sc-ctl">' +
      '<button class="btn' + (R.playing ? '' : ' primary') + ' sc-play" data-act="rt-play" id="rtPlay" aria-pressed="' + R.playing + '">' + icon(R.playing ? 'pause' : 'play') + (R.playing ? '일시정지' : '재생') + '</button>' +
      '<div class="sc-ctl2"><button class="btn sm" data-act="rt-restart" title="시즌 처음으로">' + icon('undo') + '처음</button>' +
      '<span class="seg" role="group" aria-label="재생 속도">' + SPEEDS.map((x) => '<button class="' + (x === speed ? 'on' : '') + '" data-act="rt-speed" data-v="' + x + '" aria-pressed="' + (x === speed) + '">' + x + '×</button>').join('') + '</span></div></div>' +
      '<div class="sc-names"><span class="sc-axis-l">시즌</span>' + Array.from({ length: MAX_TEAMS }, (_, i) => c.tracks[i] ? '<span style="--c:' + esc(c.tracks[i].color) + '">' + shapeIcon(c.tracks[i].shape, c.tracks[i].color) + esc(c.tracks[i].name) + '</span>' : '<span></span>').join('') + '</div>' +
      '<div class="sc-track" id="thTrack" role="slider" tabindex="0" aria-label="시즌 위치" aria-valuemin="0" aria-valuemax="' + (c.N - 1) + '" aria-valuenow="' + p.toFixed(2) + '" aria-valuetext="' + esc(posText(c, p)) + '">' +
        '<div class="sc-axis">' + axisHtml(c) + '</div><div class="sc-lanes" id="thLanes">' + lanesHtml(c) + '</div>' +
        '<div class="sc-head" id="thHead" style="left:' + headLeft(c, p) + '"><span id="rtPos">' + esc(posText(c, p)) + '</span></div></div>' +
      '<div class="sc-key small"><span><i class="k h"></i>홈</span><span><i class="k a"></i>원정</span><span><i class="k rs"></i>재편성</span><span><b style="color:var(--bad)">✕</b>취소</span></div></div>';
    return '<div class="theater">' + bar + stage + scrub + '</div>';
  };

  R.after = function () {
    const el = document.getElementById('rtLayer');
    if (!el) { R.stop(); return; }
    bindScrub();
    if (R._refocus) { R._refocus = false; const t = document.getElementById('thTrack'); if (t) t.focus({ preventScroll: true }); }
    R.draw(true);
    if (R.playing && !R.timer) R.loop();
  };

  let lastK = -1;
  R.draw = function (full) {
    const el = document.getElementById('rtLayer');
    if (!el) return false;
    const c = build();
    const p = S.ui.routePos || 0;
    const states = c.tracks.map((t) => stateAt(t, p, c.N));
    const single = c.tracks.length === 1;
    // 경로 층 + 위치 표시 (본 지도, 수도권 확대 지도)
    const main = layerSet(c, states, R.pts, single, 9);
    const ln0 = document.getElementById('rtLines'); if (ln0) ln0.innerHTML = main.lines;
    el.innerHTML = main.marks;
    const pos = main.pos;
    if (R.ipts) {
      const ins = layerSet(c, states, R.ipts, single, 10);
      const a = document.getElementById('rtInLines'), b = document.getElementById('rtInLayer');
      if (a) a.innerHTML = ins.lines;
      if (b) b.innerHTML = ins.marks;
    }
    // 재생 위치
    const k = Math.max(0, Math.min(c.N - 1, Math.floor(p)));
    const head = document.getElementById('thHead'); if (head) { head.style.left = headLeft(c, p); head.classList.toggle('flip', p > c.N * 0.72); }
    const ptx = document.getElementById('rtPos'); if (ptx) ptx.textContent = posText(c, p);
    const trk = document.getElementById('thTrack'); if (trk) { trk.setAttribute('aria-valuenow', p.toFixed(2)); trk.setAttribute('aria-valuetext', posText(c, p)); }
    const hud = document.getElementById('thHud'); if (hud) hud.innerHTML = hudHtml(c, states);
    if (full || k !== lastK) { const ln = document.getElementById('thLanes'); if (ln) ln.innerHTML = lanesHtml(c); lastK = k; }
    drawCallouts(c, states, pos);
    return true;
  };

  function drawCallouts(c, states, pos) {
    const stage = document.getElementById('thStage'), box = document.getElementById('thCallouts'), leads = document.getElementById('thLeads');
    const svg = stage && stage.querySelector('svg.kmap');
    if (!stage || !box || !svg || !svg.getScreenCTM) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const sr = stage.getBoundingClientRect();
    const toS = (q) => { const P = svg.createSVGPoint(); P.x = q[0]; P.y = q[1]; const r = P.matrixTransform(ctm); return [r.x - sr.left, r.y - sr.top]; };
    const sc = ctm.a || 1;
    // 장애물: 구장 점·이름, 고른 구단 위치 표시, HUD, 범례
    const obst = [];
    R.pts.forEach((q, i) => { const [x, y] = toS(q); obst.push({ r: [x - 7, y - 8, x + 9 + R.labelW[i] * sc, y + 8], w: 1.2 }); });
    const ms = pos.map((q) => (q ? toS(q) : null));
    ms.forEach((m) => { if (m) obst.push({ r: [m[0] - 15, m[1] - 15, m[0] + 15, m[1] + 15], w: 6 }); });
    for (const id of ['thHud', 'thLegend', 'thInset']) { const e = document.getElementById(id); if (e) { const r = e.getBoundingClientRect(); obst.push({ r: [r.left - sr.left - 6, r.top - sr.top - 6, r.right - sr.left + 6, r.bottom - sr.top + 6], w: 10 }); } }
    // 말풍선 만들기 (구단 순서대로 자리를 잡는다)
    const items = [];
    let html = '';
    c.tracks.forEach((tr, i) => { if (states[i] && ms[i]) html += '<div class="th-co" data-team="' + esc(tr.name) + '" style="--c:' + esc(tr.color) + '">' + calloutHtml(tr, states[i]) + '</div>'; });
    box.innerHTML = html;
    c.tracks.forEach((tr, i) => { const el = box.querySelector('.th-co[data-team="' + CSS.escape(tr.name) + '"]'); if (el) items.push({ el, name: tr.name, at: ms[i], color: tr.color }); });
    placeCallouts(stage, items, obst);
    // 연결선: 위치 표시 → 말풍선의 가장 가까운 점
    let ls = '';
    for (const it of items) {
      const [x0, y0, x1, y1] = it.rect, [mx, my] = it.at;
      const qx = Math.max(x0, Math.min(x1, mx)), qy = Math.max(y0, Math.min(y1, my));
      const d = Math.hypot(qx - mx, qy - my);
      if (d < 4) continue;
      const ux = (qx - mx) / d, uy = (qy - my) / d;
      ls += '<line x1="' + (mx + ux * 11).toFixed(1) + '" y1="' + (my + uy * 11).toFixed(1) + '" x2="' + qx.toFixed(1) + '" y2="' + qy.toFixed(1) + '" stroke="' + esc(it.color) + '"/>';
    }
    leads.innerHTML = ls;
  }

  // ───────── 재생 ─────────
  R.loop = function () {
    clearInterval(R.timer);
    const step = 40;
    R.timer = setInterval(() => {
      const u = S.ui;
      if (!R.playing || u.ops !== 'route') { R.stop(); return; }
      const c = build();
      const max = c.N - 1;
      const sp = u.routeSpeed || 1;
      if (reduce) {
        R._acc = (R._acc || 0) + step / 1000 * sp * PER_SEC;
        if (R._acc >= 1) { R._acc = 0; u.routePos = Math.min(max, Math.floor((u.routePos || 0) + 1e-6) + 1); }
      } else u.routePos = Math.min(max, (u.routePos || 0) + step / 1000 * sp * PER_SEC);
      if (!R.draw(false)) { R.stop(); return; }
      if (u.routePos >= max) { R.playing = false; R.stop(); S.render(); S.toast(c.tracks.map((t) => t.name).join('·') + ' 시즌 이동 재생을 마쳤습니다.', 'ok'); }
    }, step);
  };
  R.stop = function () { clearInterval(R.timer); R.timer = null; };
  R.play = function () {
    const c = build();
    if ((S.ui.routePos || 0) >= c.N - 1) S.ui.routePos = 0;
    R.playing = true; S.render(); R.loop();
  };
  R.pause = function () { R.playing = false; R.stop(); S.render(); };
  /** 시즌 위치로 이동 (스크러버·키보드·자가 점검) */
  R.seek = function (p, commit) {
    const c = build();
    S.ui.routePos = Math.max(0, Math.min(c.N - 1, p));
    R.draw(false);
    if (commit) S.writeHash();
  };

  function bindScrub() {
    const t = document.getElementById('thTrack');
    if (!t) return;
    const at = (e) => { const r = t.getBoundingClientRect(); const c = build(); return (e.clientX - r.left) / r.width * c.N - 0.5; };
    let drag = false;
    t.addEventListener('pointerdown', (e) => { drag = true; try { t.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } t.focus({ preventScroll: true }); R.seek(at(e)); e.preventDefault(); });
    t.addEventListener('pointermove', (e) => { if (drag) R.seek(at(e)); });
    const end = (e) => { if (!drag) return; drag = false; try { t.releasePointerCapture(e.pointerId); } catch (x) { /* 무시 */ } R.seek(at(e), true); };
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', () => { drag = false; });
    t.addEventListener('keydown', (e) => {
      const c = build(), p = S.ui.routePos || 0;
      const map = { ArrowRight: Math.floor(p + 1e-6) + 1, ArrowLeft: Math.ceil(p - 1e-6) - 1, PageUp: Math.floor(p) + 5, PageDown: Math.floor(p) - 5, Home: 0, End: c.N - 1 };
      if (e.key in map) { e.preventDefault(); R.seek(map[e.key], true); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); R._refocus = true; if (R.playing) R.pause(); else R.play(); }
    });
  }

  window.addEventListener('resize', () => { if (S.ui.ops === 'route') R.draw(false); });

  Object.assign(S.actions, {
    'rt-play': () => (R.playing ? R.pause() : R.play()),
    'rt-restart': () => { S.ui.routePos = 0; if (R.playing) R.draw(true); else S.render(); },
    'rt-speed': (el) => { S.ui.routeSpeed = +el.dataset.v; S.render(); },
    'rt-team': (el) => {
      const n = el.dataset.team, l = R.teams().slice();
      const i = l.indexOf(n);
      if (i >= 0) { if (l.length === 1) { S.toast('구단을 하나는 남겨 둡니다.', 'info'); return; } l.splice(i, 1); }
      else { if (l.length >= MAX_TEAMS) { const out = l.shift(); S.toast('최대 ' + MAX_TEAMS + '구단까지 겹쳐 봅니다. 먼저 고른 ' + out + '을(를) 뺐습니다.', 'info'); } l.push(n); }
      S.ui.routeTeams = l; R.place = {};
      S.render();
      if (R.playing) R.loop();
    },
    'rt-seek': (el) => { R.seek(+el.dataset.i, true); }
  });
})();
