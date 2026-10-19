/*
 * std 편성 스튜디오 — 시즌 운영 · 이동 경로 재생 (FR-A6, W19)
 * 왼쪽: 구단 목록 / 가운데: 지도 + 재생 컨트롤(재생·일시정지·속도·시즌 슬라이더) + 시즌 타임라인 + 구간 기록 / 오른쪽: 현재 구간 · 구단 요약
 *
 * 데이터와 그리기는 공통 부품을 그대로 쓴다.
 *   - 구간 데이터: 공통 P.routeMap(app/common/panels-quality.js)과 같은 teamMetrics[t].visits (loc, legTenths, cumTenths, home)
 *   - 지도: core/svg-map.js KBO.MapKit.render + projection (UI.mapWidget이 쓰는 같은 SVG 렌더러)
 *   P.routeMap·UI.mapWidget 자체는 자체 DOM·구독 수명주기가 있어 스튜디오의 innerHTML 렌더 루프와 맞지 않으므로,
 *   같은 데이터 경로와 렌더러 위에 재생기를 따로 둔다. 재생 중에는 지도 위 경로 층·정보 칸만 바꾸고 전체 렌더를 하지 않는다.
 * opt-3(경로 극장형)은 이 파일의 S.route.render / layout을 바꾼다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, MapKit } = KBO;
  const app = () => S.app;
  const D = () => S.app.derived();
  const BOX = { lonMin: 125.95, lonMax: 129.75, latMin: 34.7, latMax: 37.95 };
  const SPEEDS = [1, 2, 4];
  const PER_SEC = 1.5; // 1× = 초당 1.5구간 (시즌 45구간 ≈ 30초)
  const reduce = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  const R = S.route = { playing: false, timer: null, proj: null, map: null };

  // ───────── 데이터 ─────────
  function teamName() {
    const u = S.ui, names = app().state.teams.map((t) => t.name);
    if (!u.team || !names.includes(u.team)) u.team = names.includes('KT') ? 'KT' : names[0];
    return u.team;
  }
  /** 구간 목록: 1차 편성 방문 + (재편성 결과가 있으면) 9~10월 재편성 묶음 */
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
    // 재편성 묶음 (시즌 운영 → 재편성 실행 뒤)
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
        const leg = dm ? Number(dm.distance) || 0 : 0;
        cum += leg;
        const x = { kind: 'resched', day: Dates.dayNum(g.date), end: Dates.dayNum(l[l.length - 1].date), len: l.length, home: g.home === name, opp: g.home === name ? g.away : g.home, loc, leg, cum, cancelled: [] };
        out.push(x); prev = x;
      }
    }
    return out;
  };

  // ───────── 기하 ─────────
  function pt(loc) { const t = app().state.teams[loc]; return R.proj.project(t.latitude, t.longitude); }
  function ctrl(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], c = 0.18; return [(a[0] + b[0]) / 2 - dy * c, (a[1] + b[1]) / 2 + dx * c]; }
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const f1 = (v) => v.toFixed(1);
  function curve(a, b) { const q = ctrl(a, b); return 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'Q' + f1(q[0]) + ' ' + f1(q[1]) + ' ' + f1(b[0]) + ' ' + f1(b[1]); }
  /** 2차 베지어를 t까지만 자른 경로와 끝점 */
  function partial(a, b, t) {
    const q = ctrl(a, b);
    const q0 = lerp(a, q, t), q1 = lerp(q, b, t), e = lerp(q0, q1, t);
    return { d: 'M' + f1(a[0]) + ' ' + f1(a[1]) + 'Q' + f1(q0[0]) + ' ' + f1(q0[1]) + ' ' + f1(e[0]) + ' ' + f1(e[1]), end: e };
  }

  // ───────── 그리기: 경로 층 (재생 중 매 프레임) ─────────
  function layer(legs, p) {
    const n = legs.length;
    if (!n) return '';
    const k = Math.min(n - 1, Math.floor(p)), fr = Math.min(1, p - k);
    let s = '';
    // 앞으로 갈 구간(아주 옅게)
    for (let i = k + 2; i < n; i++) if (legs[i].loc !== legs[i - 1].loc) s += '<path class="rt-future" d="' + curve(pt(legs[i - 1].loc), pt(legs[i].loc)) + '"/>';
    // 지나온 구간: 오래된 것은 흐리게
    for (let i = 1; i <= k; i++) {
      if (legs[i].loc === legs[i - 1].loc) continue;
      const age = k - i;
      s += '<path class="rt-past' + (age < 3 ? ' recent' : '') + (legs[i].kind === 'resched' ? ' rs' : '') + '" d="' + curve(pt(legs[i - 1].loc), pt(legs[i].loc)) + '"/>';
    }
    // 지금 그리는 구간
    let pos = pt(legs[k].loc);
    if (k + 1 < n && fr > 0) {
      const a = pt(legs[k].loc), b = pt(legs[k + 1].loc);
      if (legs[k + 1].loc !== legs[k].loc) {
        const pp = partial(a, b, fr);
        s += '<path class="rt-now' + (legs[k + 1].kind === 'resched' ? ' rs' : '') + '" d="' + pp.d + '"/>';
        s += '<path class="rt-ghost" d="' + curve(a, b) + '"/>';
        pos = pp.end;
      }
    }
    const t = app().team(S.ui.team) || {};
    const cur = legs[k];
    s += '<g class="rt-marker" transform="translate(' + f1(pos[0]) + ' ' + f1(pos[1]) + ')"><circle r="11" class="rt-halo"/><circle r="6.5" fill="' + esc(t.color || '#0A1E3C') + '" stroke="#fff" stroke-width="2"/>' +
      (cur.cancelled.length && fr === 0 ? '<text class="rt-x" x="9" y="-8">✕</text>' : '') + '</g>';
    return s;
  }

  function baseMap(name) {
    const st = app().state;
    const legs = R.legs(name);
    const visits = new Map();
    for (const l of legs) visits.set(l.loc, (visits.get(l.loc) || 0) + 1);
    const ti = D().teamIndex.get(name);
    const markers = st.teams.map((t, i) => ({ id: 'rt' + i, lat: Number(t.latitude), lon: Number(t.longitude), label: t.name, color: i === ti ? t.color : '#8E97A6', size: i === ti ? 7 : 4.5, ring: i === ti, ringColor: '#0A1E3C', sub: visits.get(i) ? (i === ti ? '홈 ' : '') + visits.get(i) + '회' : '' }));
    const r = MapKit.render({ width: 520, box: BOX, markers, lines: [], grid: false, spread: 8, title: name + ' 시즌 이동 경로', extraClass: 'rt-svg' });
    R.proj = r.proj;
    return r.svg.replace('</svg>', '<g id="rtLayer"></g></svg>');
  }

  // ───────── 패널 ─────────
  function curIndex(legs) { return Math.max(0, Math.min(legs.length - 1, Math.floor(S.ui.routePos || 0))); }
  function legRange(l) {
    const a = Dates.fmtShort(l.day);
    if (l.end === l.day) return a;
    return a + '~' + (Dates.month(l.end) === Dates.month(l.day) ? String(Dates.fmtShort(l.end)).split('/')[1] : Dates.fmtShort(l.end));
  }

  function infoHtml(legs) {
    if (!legs.length) return '<div class="empty">구간이 없습니다.</div>';
    const st = app().state, name = S.ui.team;
    const k = curIndex(legs), l = legs[k], p = S.ui.routePos || 0;
    const moving = p - k > 0 && k + 1 < legs.length && legs[k + 1].loc !== l.loc;
    const nx = moving ? legs[k + 1] : null;
    const total = legs[legs.length - 1].cum;
    const at = st.teams[l.loc];
    let s = '<div class="insp-sec"><h4>현재 구간<span class="r mono">' + (k + 1) + ' / ' + legs.length + '</span></h4>';
    s += '<div class="rt-now-card"><div class="rt-date">' + esc(fmt.date(l.day)) + (l.end !== l.day ? ' ~ ' + esc(fmt.date(l.end)) : '') + '</div>' +
      '<div class="rt-vs">' + (l.home ? '<span class="home-mark">H</span>홈 · ' : '<span class="away-mark">A</span>원정 · ') + S.team(l.opp) + ' 상대 · ' + l.len + (l.kind === 'resched' ? '경기' : '연전') + '</div>' +
      '<div class="small muted">' + esc(at.stadium) + (l.kind === 'resched' ? ' · <span class="tag rs">재편성</span>' : '') + '</div>' +
      (l.cancelled.length ? '<div class="rt-cancel">' + icon('x') + '이 시리즈 중 ' + l.cancelled.length + '경기 취소 (' + esc(l.cancelled.map((g) => fmt.short(g.date) + ' ' + (KBO.Reschedule.REASONS[g.reason] || '')).join(', ')) + ')</div>' : '') + '</div>';
    s += '<dl class="props" style="margin-top:8px"><dt>이번 구간</dt><dd><b class="mono">' + fmt.km(l.leg) + '</b> km' + (k > 0 && l.leg === 0 ? ' <span class="muted small">(같은 구장)</span>' : k === 0 ? ' <span class="muted small">(시즌 첫 경기)</span>' : '') + '</dd>' +
      '<dt>누적</dt><dd><b class="mono">' + fmt.km(l.cum) + '</b> km <span class="muted small">/ ' + fmt.km(total) + '</span></dd></dl>' +
      '<div class="progress" style="margin-top:6px" aria-hidden="true"><i style="width:' + (total ? (l.cum / total * 100).toFixed(1) : 0) + '%"></i></div>';
    if (nx) s += '<div class="rt-next small">' + icon('move') + '이동 중 → ' + esc(st.teams[nx.loc].stadium) + ' · ' + fmt.km(nx.leg) + ' km</div>';
    s += '</div>';
    // 구단 요약
    const tm = D().ex.teamMetrics.find((x) => x.name === name);
    const L = D().ex.league;
    const canN = legs.reduce((a, x) => a + x.cancelled.length, 0);
    const rsN = legs.filter((x) => x.kind === 'resched').length;
    s += '<div class="insp-sec"><h4>' + S.team(name) + ' 시즌 요약</h4><dl class="props">' +
      '<dt>총 이동거리</dt><dd><b>' + (tm.overDistance ? '<span style="color:var(--bad)">' + icon('warn') + fmt.km(tm.distanceKm) + '</span>' : fmt.km(tm.distanceKm)) + '</b> km <span class="muted small">평균 ' + fmt.km(L.meanDistanceKm) + '</span></dd>' +
      '<dt>이동 횟수</dt><dd><b>' + tm.moves + '</b>회 <span class="muted small">평균 ' + fmt.num1(L.meanMoves) + '</span></dd>' +
      '<dt>홈 / 원정</dt><dd>' + tm.homeSeries + ' / ' + tm.awaySeries + ' 시리즈</dd>' +
      '<dt>최장 연속 원정</dt><dd>' + (tm.maxAwayRun > 3 ? '<b style="color:var(--bad)">' + icon('warn') + tm.maxAwayRun + '</b>' : tm.maxAwayRun) + ' 시리즈</dd>' +
      '<dt>장거리 원정</dt><dd class="small">' + (tm.longTrips.length ? tm.longTrips.length + '구간 · 최장 ' + fmt.km(Math.max(...tm.longTrips.map((x) => x.tenths)) / 10) + 'km' : '600km 넘는 구간 없음') + '</dd>' +
      '<dt>취소 경기</dt><dd>' + (canN ? S.stat('bad', canN + '경기') : '<span class="muted">없음</span>') + '</dd>' +
      '<dt>재편성</dt><dd class="small">' + (rsN ? S.stat('info', rsN + '묶음 · 9~10월') : '<span class="muted">재편성 결과 없음</span>') + '</dd></dl></div>';
    s += '<div class="insp-sec small muted">' + icon('info') + ' 이동거리는 직전 경기 구장에서 다음 경기 구장까지의 거리입니다. 홈 연속은 이동이 없습니다.</div>';
    return s;
  }

  function timelineHtml(legs) {
    const k = curIndex(legs);
    return legs.map((l, i) => '<button class="rt-cell' + (l.home ? ' h' : ' a') + (l.kind === 'resched' ? ' rs' : '') + (l.cancelled.length ? ' can' : '') + (i < k ? ' past' : '') + (i === k ? ' cur' : '') + '" data-act="rt-seek" data-i="' + i + '" title="' + esc(fmt.date(l.day) + ' ' + (l.home ? '홈' : '원정') + ' vs ' + l.opp + ' · ' + fmt.km(l.leg) + 'km' + (l.cancelled.length ? ' · 취소 ' + l.cancelled.length + '경기' : '') + (l.kind === 'resched' ? ' · 재편성' : '')) + '" aria-label="' + (i + 1) + '번째 구간"></button>').join('');
  }
  function logHtml(legs) {
    const k = curIndex(legs);
    const st = app().state;
    return legs.map((l, i) => {
      if (i > k) return '';
      return '<button class="rt-log-row' + (i === k ? ' cur' : '') + (l.kind === 'resched' ? ' rs' : '') + '" data-act="rt-seek" data-i="' + i + '"><span class="mono n">' + (i + 1) + '</span><span class="d">' + esc(legRange(l)) + '</span><span>' + (l.home ? '<span class="home-mark">H</span>' : '<span class="away-mark">A</span>') + '</span><span class="v">' + esc(l.home ? 'vs ' + l.opp : '@ ' + st.teams[l.loc].name) + (l.cancelled.length ? ' <span class="st plain bad">' + icon('x') + '취소 ' + l.cancelled.length + '</span>' : '') + (l.kind === 'resched' ? ' <span class="tag rs">재편성</span>' : '') + '</span><span class="mono km">' + (l.leg ? '+' + fmt.km(l.leg) : '–') + '</span><span class="mono cum">' + fmt.km(l.cum) + '</span></button>';
    }).reverse().join('');
  }

  // ───────── 화면 ─────────
  R.render = function () {
    const u = S.ui, st = app().state;
    const name = teamName();
    const legs = R.legs(name);
    if (u.routePos == null || u.routePos > legs.length - 1) u.routePos = Math.max(0, legs.length - 1); // 처음 열면 시즌 전체 경로
    const speed = u.routeSpeed || 1;
    const tms = D().ex.teamMetrics;
    // 왼쪽: 구단 목록
    let list = '<div class="pane-head"><span class="pane-title">구단</span><span class="pane-desc">고르면 그 구단의 시즌 이동을 재생합니다</span></div><div class="pane-body" data-sk="rt-list">';
    for (const t of st.teams) {
      const m = tms.find((x) => x.name === t.name);
      list += '<button class="li rt-team' + (t.name === name ? ' active' : '') + '" data-act="rt-team" data-team="' + esc(t.name) + '"><span class="tm"><i style="background:' + esc(t.color) + ';width:10px;height:10px"></i></span><span class="li-main">' + esc(t.name) + '<span class="li-sub">' + esc(t.stadium) + '</span></span><span class="rt-km mono' + (m.overDistance ? ' over' : '') + '">' + (m.overDistance ? '▲' : '') + fmt.km(m.distanceKm) + '</span></button>';
    }
    list += '<div class="list-sep"></div><div class="label">표시</div><div class="legend rt-legend"><span><i class="lg-line now"></i>지금 이동</span><span><i class="lg-line recent"></i>최근 3구간</span><span><i class="lg-line past"></i>지나온 구간(흐림)</span><span><i class="lg-line future"></i>앞으로 갈 구간</span><span><i class="lg-line rs"></i>재편성 경기</span><span><b style="color:var(--bad)">✕</b>취소 경기</span></div></div>';
    // 가운데: 지도 + 컨트롤
    const k = curIndex(legs);
    const l = legs[k];
    let main = '<div class="toolbar rt-bar">' +
      '<button class="btn sm' + (R.playing ? '' : ' primary') + '" data-act="rt-play" id="rtPlay" aria-pressed="' + R.playing + '">' + icon(R.playing ? 'pause' : 'play') + (R.playing ? '일시정지' : '재생') + '</button>' +
      '<button class="btn sm" data-act="rt-restart" title="시즌 처음으로">' + icon('undo') + '처음</button>' +
      '<span class="seg" role="group" aria-label="재생 속도">' + SPEEDS.map((x) => '<button class="' + (x === speed ? 'on' : '') + '" data-act="rt-speed" data-v="' + x + '" aria-pressed="' + (x === speed) + '">' + x + '×</button>').join('') + '</span>' +
      '<input type="range" class="rt-range" id="rtRange" min="0" max="' + Math.max(0, legs.length - 1) + '" step="0.05" value="' + (u.routePos || 0).toFixed(2) + '" data-live="rt-range" aria-label="시즌 위치 (구간)">' +
      '<span class="rt-pos mono" id="rtPos">' + (l ? esc(fmt.short(l.day)) + ' · ' + (k + 1) + '/' + legs.length : '-') + '</span></div>';
    main += '<div class="rt-stage"><div class="rt-mapcol"><div class="rt-map" id="rtMap">' + baseMap(name) + '</div>' +
      '<div class="rt-tl-wrap"><div class="rt-tl-head small"><b>시즌 타임라인</b><span class="muted">칸 = 시리즈 · 진한 칸 홈 · 흰 칸 원정 · 빨간 ✕ 취소</span></div><div class="rt-tl" id="rtTl">' + timelineHtml(legs) + '</div></div></div>' +
      '<div class="rt-logcol"><div class="rt-log-head"><b>구간 기록</b><span class="muted small">최근 순 · km</span></div><div class="rt-log-cols"><span>#</span><span>기간</span><span></span><span>상대·구장</span><span>구간</span><span>누적</span></div><div class="rt-log" id="rtLog">' + logHtml(legs) + '</div></div></div>';
    return { list, main: S.paneHead(name + ' 이동 경로', '이동선이 차례로 그려지고 현재 위치 표시가 움직입니다. 슬라이더나 타임라인 칸으로 원하는 시점으로 갑니다.') + main, insp: '<div id="rtInfo">' + infoHtml(legs) + '</div>', title: '현재 구간' };
  };

  R.after = function () {
    const el = document.getElementById('rtLayer');
    if (!el) { R.stop(); return; }
    R.draw(true);
    if (R.playing && !R.timer) R.loop();
  };

  let lastK = -1;
  R.draw = function (full) {
    const name = S.ui.team;
    const legs = R.legs(name);
    const el = document.getElementById('rtLayer');
    if (!el) return false;
    el.innerHTML = layer(legs, S.ui.routePos || 0);
    const k = curIndex(legs);
    const rg = document.getElementById('rtRange'); if (rg && document.activeElement !== rg) rg.value = (S.ui.routePos || 0).toFixed(2);
    const pos = document.getElementById('rtPos'); if (pos && legs[k]) pos.textContent = fmt.short(legs[k].day) + ' · ' + (k + 1) + '/' + legs.length;
    const info = document.getElementById('rtInfo'); if (info) info.innerHTML = infoHtml(legs);
    if (full || k !== lastK) {
      const tl = document.getElementById('rtTl'); if (tl) tl.innerHTML = timelineHtml(legs);
      const lg = document.getElementById('rtLog'); if (lg) { lg.innerHTML = logHtml(legs); lg.scrollTop = 0; }
      lastK = k;
    }
    return true;
  };

  R.loop = function () {
    clearInterval(R.timer);
    const step = 40;
    R.timer = setInterval(() => {
      const u = S.ui;
      if (!R.playing || u.ops !== 'route') { R.stop(); return; }
      const legs = R.legs(u.team);
      const max = legs.length - 1;
      const sp = u.routeSpeed || 1;
      if (reduce) { // 움직임 줄이기: 구간 단위로 건너뛴다
        R._acc = (R._acc || 0) + step / 1000 * sp * PER_SEC;
        if (R._acc >= 1) { R._acc = 0; u.routePos = Math.min(max, Math.floor((u.routePos || 0) + 1e-6) + 1); }
      } else u.routePos = Math.min(max, (u.routePos || 0) + step / 1000 * sp * PER_SEC);
      if (!R.draw(false)) { R.stop(); return; }
      if (u.routePos >= max) { R.playing = false; R.stop(); S.render(); S.toast(u.team + ' 시즌 이동 재생을 마쳤습니다.', 'ok'); }
    }, step);
  };
  R.stop = function () { clearInterval(R.timer); R.timer = null; };
  R.play = function () {
    const legs = R.legs(teamName());
    if ((S.ui.routePos || 0) >= legs.length - 1) S.ui.routePos = 0;
    R.playing = true; S.render(); R.loop();
  };
  R.pause = function () { R.playing = false; R.stop(); S.render(); };

  Object.assign(S.actions, {
    'rt-play': () => (R.playing ? R.pause() : R.play()),
    'rt-restart': () => { S.ui.routePos = 0; R.draw(true); if (!R.playing) S.render(); },
    'rt-speed': (el) => { S.ui.routeSpeed = +el.dataset.v; S.render(); },
    'rt-team': (el) => { S.ui.team = el.dataset.team; S.ui.routePos = 0; S.render(); if (R.playing) R.loop(); },
    'rt-seek': (el) => { S.ui.routePos = +el.dataset.i; if (R.playing) R.draw(true); else S.render(); }
  });
  S.inputs['rt-range'] = (el) => { S.ui.routePos = parseFloat(el.value) || 0; R.draw(false); };
})();
