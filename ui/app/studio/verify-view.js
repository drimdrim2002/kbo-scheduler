/*
 * 편성 스튜디오 — 요구 사항 점검 (현재 결과 분석의 보기 하나, S.ui.step 8) · 대안 C 「연전 따라 점검」
 *  서버 점검기(RequirementChecker, POST /api/v1/verify)가 완성된 일정을 시리즈 → 연전 기간 → 날짜별 경기로 풀어 요구 사항마다 다시 센 것을 보여 준다.
 *  엔진 점수와는 따로 세므로, 점수 공식이 틀려도 여기서 잡힌다. 화면은 「검증 완료」 배지가 아니라 사람이 다시 셀 수 있는 근거(원자료)를 보여 준다.
 *   - 요약 줄(현재 결과 분석 맨 위, P.verify.summary): 지킨 개수 또는 어긴 항목 이름 + 「서버가 … 다시 세어 판정했습니다 · 시각」
 *   - 왼쪽 연전 목록: 서버가 센 일정을 연전(시리즈)마다 날짜 순으로. 구단 고르기·「어긴 연전만」·앞/다음 어긴 연전. 연전마다 ✔ 또는 「n개 어김」.
 *   - 오른쪽 이 연전의 점검표: 목록 맨 위(또는 누른) 연전의 경기(엔진 결과)와 요구 사항마다 지킴·어김·참고·해당 없음 + 그 연전에 걸리는 서버 근거 줄.
 *     목록을 내리면 오른쪽이 따라 바뀐다. 「근거 표」는 시즌 전체 줄, 날짜를 누르면 달력의 그 날로.
 *   - 아래 접힌 칸: 날짜별 출전표(시즌 전체 · 특별 경기 날만 · 휴식일만), 「아무 날 골라 보기」. 「엑셀로 받기」(출전표·근거 표)
 *  실행이 끝날 때 받은 점검표(판정·근거 줄만, 원자료는 뺌)를 결과·버전에 남기고, 이 화면은 지금 일정으로 서버에 다시 묻는다(손으로 옮긴 경기까지).
 *  서버가 없으면(file://·시험 엔진) 「서버 점검을 할 수 없음」으로 정직하게 보인다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  if (!S.planFlow) return; // 예전 화면(classic=1·자가 점검)에는 없다
  const P = S.planFlow;
  const { KBO, esc, icon } = S;
  const { CalendarGen, Dates, Xlsx } = KBO;
  const app = () => S.app;
  const PASS = 'PASS', FAIL = 'FAIL', INFO = 'INFO';
  const METHOD = '서버가 완성된 일정만 다시 세어 판정했습니다(엔진 점수와 따로)';
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const V = P.verify = { data: null, at: null, sig: null, loading: false, error: null, offline: false, filter: 'all', open: {}, gopen: {}, day: null };

  // ───────── 공통 ─────────
  /** 일정의 지문(서버 점검표의 planSig와 같은 식, core/engine-adapter.js). 점검표가 지금 보이는 일정의 것인지는 이 값이 같은지로만 본다 */
  V.planSig = (st) => KBO.Engine.planSignature(st, st.plan);
  /** 점검표가 이 일정(또는 저장한 버전)의 것인가 */
  V.matches = (v, st) => !!(v && v.planSig && st && v.planSig === V.planSig(st));
  /** 결과·버전에 남길 몫: 근거 원자료(tables)는 크니까 뺀다 */
  V.slim = (v) => { if (!v) return null; const o = Object.assign({}, v); delete o.tables; return o; };
  /** 실행이 끝날 때 받은 점검표(원자료 포함)를 이 화면의 값으로 삼는다. 지문은 점검표에 적힌 것 — 지금 일정과 같은지는 보일 때마다 견준다 */
  V.took = (v) => { V.data = v; V.at = v.checkedAt; V.error = null; V.offline = false; V.day = null; V.gopen = {}; V.open = {}; };
  const STALE = '이 점검표는 지금 보이는 일정의 것이 아닙니다';
  const when = (iso) => { if (!iso) return ''; const d = new Date(iso), p = (x) => String(x).padStart(2, '0'); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  const verdictIcon = (v) => (v === FAIL ? '<span class="pf-vic bad">' + icon('x') + '</span>' : v === INFO ? '<span class="pf-vic info">' + icon('info') + '</span>' : '<span class="pf-vic ok">' + icon('check') + '</span>');
  const verdictWord = (v) => (v === FAIL ? '어김' : v === INFO ? '참고' : '지킴');
  const items = (v) => (v && v.groups ? v.groups.reduce((a, g) => a.concat(g.items || []), []) : []);
  const fmtDate = (iso) => { const d = Dates.dayNum(iso); return Number.isFinite(d) ? (new Date(iso + 'T00:00:00').getMonth() + 1) + '/' + new Date(iso + 'T00:00:00').getDate() + '(' + WD[Dates.weekday(d)] + ')' : iso; };
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const fromRest = () => app().engineConfig && app().engineConfig.kind === 'REST';

  // ───────── 요약 줄(현재 결과 분석) · 비교 표 칸 ─────────
  /** 현재 결과 분석 맨 위 줄: 늘 보인다. 지키면 개수, 어기면 어긴 항목 이름. 밑 줄에 셈 방법과 시각 */
  V.summary = function (res) {
    // 점검 화면에서 지금 일정으로 서버에 다시 물어 받은 점검표(지문이 같음)가 있으면 그것이 가장 새것이다. 없으면 실행 때 받은 것
    const st = app().state, v = V.matches(V.data, st) ? V.data : res && res.verification;
    let cls, head, note;
    if (!v || v.error) { cls = 'none'; head = '요구 사항 점검 없음'; note = v && v.error ? v.error : res && res.engine && res.engine !== 'REST' ? '서버에 연결되지 않아 시험 엔진으로 낸 결과입니다. 서버 엔진으로 실행하면 서버가 요구 사항을 다시 셉니다.' : '이 결과에는 서버 점검표가 없습니다. 점검표에서 지금 일정을 서버에 다시 물을 수 있습니다.'; }
    else if (!V.matches(v, st)) { cls = 'stale'; head = STALE; note = '실행 뒤 일정을 고쳤거나 다른 일정의 점검표입니다(' + when(v.checkedAt) + '에 센 것). 점검표에서 지금 일정을 서버에 다시 물을 수 있습니다.'; } // 지문이 다르면 지킨 개수를 내걸지 않는다
    else if (v.failed) { cls = 'bad'; head = '요구 사항 ' + v.failed + '개 어김 — ' + (v.failedTitles || []).join(' · '); note = METHOD + ' · ' + when(v.checkedAt); }
    else { cls = 'ok'; head = '요구 사항 ' + v.total + '개 모두 지킴' + (v.info ? ' · 참고 ' + v.info + '개' : ''); note = METHOD + ' · ' + when(v.checkedAt); }
    return '<div class="pf-sec pf-vsum ' + cls + '"><div class="pf-vsum-row">' + (cls === 'none' ? '<span class="pf-vic none">' + icon('todo') + '</span>' : cls === 'stale' ? '<span class="pf-vic warn">' + icon('warn') + '</span>' : verdictIcon(cls === 'bad' ? FAIL : PASS)) + '<b>' + esc(head) + '</b><button class="pf-link" data-act="go-step" data-step="8">점검표 보기 ›</button></div><div class="xs muted">' + esc(note) + '</div></div>';
  };
  /** 실행 결과 비교 표의 「요구 사항」 칸. 버전의 일정(matches·plan·그때 달력)과 점검표의 지문이 같을 때만 개수를 적는다 */
  V.cell = function (ver) {
    const v = ver && ver.verification;
    if (!v || v.error) return '<span class="muted small">점검 없음</span>';
    const cal = ver.inputs && ver.inputs.calendar ? ver.inputs.calendar : app().state.calendar;
    if (v.planSig !== KBO.Engine.planSignature({ matches: ver.matches || [], calendar: cal }, ver.plan || [])) return '<span class="pf-tag est">다른 일정의 점검표</span>';
    return v.failed ? '<span class="pf-tag over">' + v.failed + '개 어김</span> <span class="small">' + (v.total - v.failed) + '/' + v.total + '</span>' : '<span class="pf-tag ok">' + v.total + '/' + v.total + ' 지킴</span>';
  };

  // ───────── 서버에 묻기 ─────────
  /** 지금 일정으로 서버에 점검을 청한다(이미 같은 일정의 점검표가 있으면 그대로) */
  function ensure(force) {
    const st = app().state;
    if (V.loading) return;
    if (!force && V.matches(V.data, st)) return;
    if (!fromRest()) {
      // 서버 없음: 실행 때 받아 둔 것(판정·근거 줄)이라도 보여 주되, 지금 일정과 지문이 다르면 화면이 그 사실을 크게 적는다(render의 stale)
      const res = st.meta.result;
      if (!V.data && res && res.verification && !res.verification.error) { V.data = res.verification; V.at = res.verification.checkedAt; }
      V.offline = true; V.error = null;
      return;
    }
    V.loading = true; V.error = null; V.offline = false;
    const plan = st.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
    app().engine.verify(st, plan).then((v) => {
      V.loading = false;
      if (!v || v.error) { V.error = (v && v.error) || '점검표를 받지 못했습니다.'; }
      else { V.took(v); }
      S.scheduleRender();
    }).catch((e) => { V.loading = false; V.error = e && e.offline ? null : (e && e.message) || '서버에 연결하지 못했습니다.'; V.offline = !!(e && e.offline); S.scheduleRender(); });
  }

  // ───────── 점검표 ─────────
  function groupOpen(g) { return V.gopen[g.id] != null ? V.gopen[g.id] : (g.failed || 0) > 0; }
  function groupHtml(g) {
    const list = g.items || [], failed = list.filter((i) => i.verdict === FAIL).length, info = list.filter((i) => i.verdict === INFO).length, open = groupOpen(g);
    const head = '<button class="pf-vg-head" data-act="vf-group" data-id="' + esc(g.id) + '" aria-expanded="' + open + '">' + icon(open ? 'down' : 'right') + verdictIcon(failed ? FAIL : PASS) + '<b>' + esc(g.title) + '</b><span class="muted small">' + esc(g.desc) + '</span><span class="r">' + (failed ? '<span class="pf-tag over">' + failed + '개 어김</span>' : '<span class="pf-tag ok">' + (list.length - info) + '개 지킴</span>') + (info ? ' <span class="pf-tag got">참고 ' + info + '</span>' : '') + '</span></button>';
    return '<div class="pf-vg' + (open ? ' open' : '') + '">' + head + (open ? list.map(itemHtml).join('') : '') + '</div>';
  }
  function itemHtml(it) {
    const open = !!V.open[it.id], rows = it.rows || [], cols = it.columns || [];
    return '<div class="pf-vi ' + it.verdict.toLowerCase() + '"><div class="pf-vi-head">' + verdictIcon(it.verdict) + '<div class="pf-vi-t"><b>' + esc(it.title) + '</b><span class="xs muted">' + esc(it.desc) + '</span></div>' +
      '<div class="pf-vi-std"><span class="xs muted">정한 값</span><span>' + esc(it.standard) + '</span>' + (it.source ? '<span class="xs muted">' + esc(it.source) + '</span>' : '') + '</div>' +
      '<div class="pf-vi-res"><span class="xs muted">결과 · ' + verdictWord(it.verdict) + '</span><span>' + esc(it.result) + '</span>' + (rows.length ? '<button class="pf-link xs" data-act="vf-item" data-id="' + esc(it.id) + '">' + (open ? '근거 접기' : '근거 ' + rows.length + '줄 보기 ›') + '</button>' : '<span class="xs muted">근거 줄 없음(어긴 것이 없어 적을 줄이 없음)</span>') + '</div></div>' +
      (open && rows.length ? '<div class="pf-vtbl"><table class="pf-t pf-vt"><thead><tr>' + cols.map((c) => '<th>' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + cols.map((c) => cell(r[c.key])).join('') + '</tr>').join('') + '</tbody></table></div>' : '') + '</div>';
  }
  function cell(v) {
    if (v == null || v === '') return '<td></td>';
    if (isDate(v)) return '<td><button class="pf-link pf-vdate" data-act="vf-date" data-date="' + v + '" title="달력의 이 날로">' + fmtDate(v) + '</button></td>';
    return '<td>' + esc(v) + '</td>';
  }

  // ───────── 날짜별 출전표 · 아무 날 ─────────
  const teamsOf = (v) => (v.tables && v.tables.teams) || app().state.teams.map((t) => t.name);
  /** 날짜별 출전: 날짜 → 구단마다 { opp, home, stadium } */
  function lineup(day, teams) {
    const m = {};
    for (const g of day.games || []) { m[g.home] = { opp: g.away, home: true, stadium: g.stadium }; m[g.away] = { opp: g.home, home: false, stadium: g.stadium }; }
    return teams.map((t) => m[t] || null);
  }
  const specialDates = () => new Set(app().state.events.filter((e) => e.mode === 'STADIUM' && e.date).map((e) => e.date.slice(0, 10)));
  function restRows(v) {
    const out = [];
    for (const it of items(v)) if (it.id === 'rest-weekdays' || it.id === 'blackouts') for (const r of it.rows || []) out.push({ date: r.date, weekday: r.weekday, games: r.games, judge: r.judge, label: r.label || (it.id === 'rest-weekdays' ? '휴식 요일' : '') });
    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  function gridHtml(v) {
    const days = (v.tables && v.tables.days) || [], teams = teamsOf(v), f = V.filter;
    const tabs = [['all', '시즌 전체 ' + days.length + '일'], ['special', '특별 경기 날만'], ['rest', '휴식일만']].map(([k, l]) => '<button class="' + (f === k ? 'on' : '') + '" data-act="vf-filter" data-v="' + k + '">' + l + '</button>').join('');
    let body;
    if (f === 'rest') {
      const rows = restRows(v);
      body = rows.length ? '<table class="pf-t pf-vt"><thead><tr><th>날짜</th><th>요일</th><th>무엇</th><th>경기 수</th><th>판정</th></tr></thead><tbody>' + rows.map((r) => '<tr>' + cell(r.date) + '<td>' + esc(r.weekday) + '</td><td>' + esc(r.label) + '</td><td>' + esc(r.games) + '</td><td>' + esc(r.judge) + '</td></tr>').join('') + '</tbody></table>' : '<p class="pf-d">휴식일 줄이 없습니다.</p>';
    } else {
      const sp = specialDates(), list = f === 'special' ? days.filter((d) => sp.has(d.date)) : days;
      body = list.length ? '<table class="pf-t pf-vt pf-vgrid"><thead><tr><th>날짜</th>' + teams.map((t) => '<th>' + esc(t) + '</th>').join('') + '</tr></thead><tbody>' + list.map((d) => '<tr>' + cell(d.date) + lineup(d, teams).map((x) => (x ? '<td class="' + (x.home ? 'h' : 'a') + '" title="' + esc(x.stadium) + '">' + esc(x.opp) + '</td>' : '<td class="none">—</td>')).join('') + '</tr>').join('') + '</tbody></table>' : '<p class="pf-d">보일 날이 없습니다.</p>';
    }
    return '<div class="pf-sec pf-vgridsec"><h3>날짜별 출전표<span class="r"><span class="home-mark">홈</span><span class="away-mark">원</span> 칸 = 그 날 상대 · 옅은 칸은 홈, 진한 칸은 원정</span></h3><p class="pf-d">서버가 일정을 날짜별로 푼 원자료입니다. 날마다 모든 구단이 한 번씩 나오는지 직접 세어 볼 수 있습니다. 날짜를 누르면 달력의 그 날로 갑니다.</p><div class="pf-tabs">' + tabs + '</div><div class="pf-vscroll">' + body + '</div></div>';
  }
  function dayHtml(v) {
    const days = (v.tables && v.tables.days) || [];
    if (!days.length) return '';
    if (V.day == null || V.day >= days.length) V.day = Math.floor(Math.random() * days.length);
    const d = days[V.day], teams = teamsOf(v), cnt = {};
    for (const g of d.games || []) { cnt[g.home] = (cnt[g.home] || 0) + 1; cnt[g.away] = (cnt[g.away] || 0) + 1; }
    const once = teams.every((t) => cnt[t] === 1);
    return '<div class="pf-sec pf-vday"><h3>아무 날 골라 보기<span class="r"><button class="btn sm" data-act="vf-day">다른 날</button></span></h3><p class="pf-d">무작위로 고른 하루입니다. 경기 ' + (d.games || []).length + '개에 ' + teams.length + '구단이 한 번씩 나오는지 보세요.</p>' +
      '<div class="pf-vday-row"><div class="pf-vday-date">' + cell(d.date).replace(/^<td>|<\/td>$/g, '') + ' <span class="muted">' + esc(d.weekday) + '요일</span></div><ul class="pf-vday-games">' + (d.games || []).map((g) => '<li><span class="a">' + esc(g.away) + '</span> <span class="muted xs">원정</span> → <span class="h">' + esc(g.home) + '</span> <span class="muted xs">홈 · ' + esc(g.stadium) + '</span></li>').join('') + '</ul>' +
      '<div class="pf-vday-teams">' + teams.map((t) => '<span class="' + (cnt[t] === 1 ? 'ok' : 'bad') + '">' + esc(t) + ' ' + (cnt[t] || 0) + '</span>').join('') + '</div><div class="xs ' + (once ? 'ok' : 'bad') + '">' + (once ? teams.length + '구단 모두 한 번씩 출전' : '한 번씩이 아닌 구단이 있음') + '</div></div></div>';
  }

  // ───────── 연전 목록 · 연전마다 판정 (대안 C: 왼쪽 연전 목록, 오른쪽 그 연전의 점검표) ─────────
  /* 점검표 원자료(tables.flow·days)에서 연전(시리즈) 목록을 만들고, 서버가 적은 근거 줄을 걸리는 연전마다 붙인다.
     왼쪽 목록을 내리면(또는 누르면) 오른쪽 점검표가 맨 위 연전의 판정으로 바뀐다.
     판정은 서버 줄의 판정 칸(judge)을 그대로 쓰고 화면이 새로 세지 않는다 — 줄이 어느 연전에 걸리는지만 화면이 찾는다 */
  V.sel = null; V.team = 'all'; V.onlyBad = false; V.scrollTo = false; V.showGrid = false;
  const H0 = S.parseHash(); // 점검용 주소(vteam=구단 · vbad=1 · vscroll=픽셀): 처음 한 번만 목록 상태를 맞춘다(그림 찍기용)
  const cache = { v: null };
  const OK_JUDGE = /^(정한 홈|정한 대진|개막 연전)$|^예외로 정한 날/; // 판정 칸에 글이 있어도 어긴 것이 아닌 말
  const SPECIAL = (id) => id === 'opening' || id === 'children' || /^stadium-/.test(id) || id === 'four-game'; // 걸리는 연전에만 뜻이 있는 항목(나머지 연전은 「해당 없음」)
  function build(v) {
    if (cache.v === v) return cache;
    const flow = (v.tables && v.tables.flow) || {}, days = (v.tables && v.tables.days) || [];
    const by = {};
    for (const t of Object.keys(flow)) for (const x of flow[t]) if (x.home) by[x.series] = { id: x.series, slot: x.slot, home: t, away: x.opponent, stadium: x.stadium, date: x.date, end: x.end, dates: [], games: [] };
    for (const d of days) for (const g of d.games || []) { const s = by[g.series]; if (s) { s.dates.push(d.date); s.games.push({ date: d.date, weekday: d.weekday, home: g.home, away: g.away, stadium: g.stadium }); } }
    for (const it of items(v)) if (it.id === 'unassigned') for (const r of it.rows || []) if (by[r.series] == null) by[r.series] = { id: r.series, slot: -1, home: r.home, away: r.away, stadium: '', date: null, end: null, dates: [], games: [], length: r.length };
    const series = Object.values(by).sort((a, b) => (a.date == null) - (b.date == null) || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.slot - b.slot || a.id - b.id);
    const bySlot = {}, byDate = {}, byTeam = {};
    for (const s of series) {
      (bySlot[s.slot] = bySlot[s.slot] || []).push(s);
      for (const d of s.dates) (byDate[d] = byDate[d] || []).push(s);
      for (const t of [s.home, s.away]) (byTeam[t] = byTeam[t] || []).push(s);
    }
    const onDate = (date, pred) => (byDate[date] || []).filter(pred || (() => true));
    const teamAt = (team, date) => (byTeam[team] || []).find((s) => s.date === date);
    /** 근거 줄 하나가 걸리는 연전들 */
    function hits(it, r) {
      const id = it.id;
      if (id === 'unassigned') return by[r.series] ? [by[r.series]] : [];
      if (id === 'pair-games') return (byTeam[r.a] || []).filter((s) => s.home === r.b || s.away === r.b);
      if (id === 'home-totals') return byTeam[r.team] || [];
      if (id === 'series-length') return bySlot[r.slot] || [];
      if (id === 'streak') { const l = byTeam[r.team] || [], i = l.findIndex((s) => s.date === r.date); return i < 0 ? [] : l.slice(i, i + (+r.run || 1)); }
      if (id === 'repeat-opponent') return [teamAt(r.team, r.date), teamAt(r.team, r.next)].filter(Boolean);
      if (!isDate(r.date)) return [];
      if (id === 'daily-stadiums') return onDate(r.date, (s) => s.stadium === r.stadium);
      if (id === 'length-match' || id === 'four-game') return r.home ? onDate(r.date, (s) => s.home === r.home && s.away === r.away) : [];
      if (SPECIAL(id)) return onDate(r.date, (s) => (!r.home || s.home === r.home || s.away === r.home) && (!r.away || s.home === r.away || s.away === r.away));
      return onDate(r.date); // 휴식 요일·휴식기·시즌 기간·날마다 한 번씩: 그 날의 연전 모두
    }
    const ev = {}; let loose = 0; // ev[연전 id][항목 id] = { bad, rows } · loose = 어느 연전에도 붙지 않는 어긴 줄
    for (const it of items(v)) {
      for (const r of it.rows || []) {
        const bad = it.verdict === FAIL && !!r.judge && !OK_JUDGE.test(r.judge), hs = hits(it, r);
        if (bad && !hs.length) loose++;
        for (const s of hs) { const e = ev[s.id] = ev[s.id] || {}, x = e[it.id] = e[it.id] || { bad: false, rows: [] }; if (bad) x.bad = true; x.rows.push(r); }
      }
    }
    for (const s of series) { const e = ev[s.id] || {}; s.bad = Object.keys(e).filter((k) => e[k].bad); }
    cache.v = v; cache.series = series; cache.ev = ev; cache.loose = loose; cache.byId = by;
    return cache;
  }
  /** 이 연전에서 이 항목의 상태: ok · bad · info · na(해당 없음) */
  function stateOf(c, s, it) {
    const x = c.ev[s.id] && c.ev[s.id][it.id];
    if (x) return { k: x.bad ? 'bad' : it.verdict === INFO ? 'info' : 'ok', rows: x.rows };
    return { k: SPECIAL(it.id) ? 'na' : it.verdict === INFO ? 'info' : 'ok', rows: [] };
  }
  const stateIcon = (k) => (k === 'na' ? '<span class="pf-vic na">–</span>' : verdictIcon(k === 'bad' ? FAIL : k === 'info' ? INFO : PASS));
  const stateWord = (k) => (k === 'bad' ? '어김' : k === 'info' ? '참고' : k === 'na' ? '해당 없음' : '지킴');
  const dateBtn = (d) => '<button class="pf-link pf-vdate" data-act="vf-date" data-date="' + d + '" title="달력의 이 날로">' + fmtDate(d) + '</button>';
  const range = (s) => (s.date ? fmtDate(s.date) + (s.end && s.end !== s.date ? '–' + fmtDate(s.end) : '') : '날짜 없음');
  const nOf = (s) => (s.dates.length || s.length || 0);
  /** 근거 줄 한 줄을 짧은 글로: 「날짜 3/22(토) · 원정 한화 · 홈 LG · 판정 …」 */
  function rowText(it, r) {
    const cols = it.columns || [], out = [];
    for (const c of cols) { const x = r[c.key]; if (x == null || x === '' || c.key === 'judge') continue; out.push('<span class="muted">' + esc(c.label) + '</span> ' + (isDate(x) ? dateBtn(x) : esc(x))); }
    const bad = it.verdict === FAIL && !!r.judge && !OK_JUDGE.test(r.judge);
    if (r.judge) out.push('<b class="' + (bad ? 'bad' : 'ok') + '">' + esc(r.judge) + '</b>');
    return out.join(' · ');
  }
  /** 목록에 보이는 연전(구단 · 「어긴 연전만」으로 거른 것) */
  function shownList(c) {
    const list = V.team === 'all' ? c.series : c.series.filter((s) => s.home === V.team || s.away === V.team);
    return V.onlyBad ? list.filter((s) => s.bad.length) : list;
  }
  /** 왼쪽: 연전 목록 */
  function serHtml(v, c, stale) {
    const teams = teamsOf(v);
    const chips = [['all', '전체']].concat(teams.map((t) => [t, t])).map(([k, l]) => '<button class="pf-chip' + (V.team === k ? ' on' : '') + '" data-act="vf-team" data-v="' + esc(k) + '">' + esc(l) + '</button>').join('');
    const shown = shownList(c), badN = c.series.filter((s) => s.bad.length).length;
    let body = '', last = null;
    for (const s of shown) {
      if (V.team === 'all' && s.slot !== last) { last = s.slot; body += '<div class="pf-vser-h">' + (s.slot < 0 ? '날짜 없음' : '연전 기간 ' + (s.slot + 1) + ' <span class="muted">' + range(s) + ' · ' + nOf(s) + '연전</span>') + '</div>'; }
      const mine = V.team !== 'all';
      const main = mine ? '<b>' + esc(s.home === V.team ? s.away : s.home) + '</b> <span class="pf-tag ' + (s.home === V.team ? 'got' : 'blue') + '">' + (s.home === V.team ? '홈' : '원정') + '</span>'
        : '<b>' + esc(s.away) + '</b><span class="xs muted"> 원정</span> → <b>' + esc(s.home) + '</b><span class="xs muted"> 홈</span>';
      body += '<button class="pf-vser-card' + (V.sel === s.id ? ' on' : '') + (s.bad.length ? ' bad' : '') + '" data-act="vf-sel" data-id="' + s.id + '" data-sid="' + s.id + '">' +
        '<span class="d">' + (mine ? range(s) : '') + '</span><span class="m">' + main + '<span class="xs muted"> · ' + esc(s.stadium || '구장 없음') + (mine ? ' · ' + nOf(s) + '연전' : '') + '</span></span>' +
        '<span class="r">' + (s.bad.length ? '<span class="pf-tag over">' + s.bad.length + '개 어김</span>' : '<span class="pf-vic ok sm">' + icon('check') + '</span>') + '</span></button>';
    }
    if (!shown.length) body = '<p class="pf-d" style="padding:10px">보일 연전이 없습니다.</p>';
    const nav = badN ? '<button class="pf-link xs" data-act="vf-next" data-dir="-1">‹ 앞 어긴 연전</button><button class="pf-link xs" data-act="vf-next" data-dir="1">다음 어긴 연전 ›</button>' : '';
    return '<div class="pf-sec pf-vser' + (stale ? ' pf-vstale' : '') + '"><h3>연전 목록' + (stale ? ' <span class="pf-tag est">다른 일정</span>' : '') + '<span class="r">' + c.series.length + '연전 · ' + (badN ? '<b class="bad">어긴 연전 ' + badN + '</b>' : '<b class="ok">어긴 연전 없음</b>') + (c.loose ? ' · 연전에 붙지 않는 어김 ' + c.loose + '줄' : '') + '</span></h3>' +
      '<p class="pf-d">서버가 센 일정을 연전(한 대진이 한 구장에서 이어 치르는 경기)마다 늘어놓았습니다. 목록을 내리면 오른쪽 점검표가 맨 위 연전의 것으로 바뀝니다.</p>' +
      '<div class="pf-vser-tools"><div class="pf-chips">' + chips + '</div><label class="xs"><input type="checkbox" data-act="vf-onlybad"' + (V.onlyBad ? ' checked' : '') + '> 어긴 연전만</label>' + nav + '</div>' +
      '<div class="pf-vserlist" data-sk="vser">' + body + '</div></div>';
  }
  /** 오른쪽: 고른 연전의 점검표 */
  function chkHtml(v, c, s, stale) {
    if (!s) return '<div class="pf-vchk-empty">왼쪽에서 연전을 고르세요.</div>';
    const games = s.games.length ? '<ul class="pf-vchk-games">' + s.games.map((g) => '<li>' + dateBtn(g.date) + ' <span class="a">' + esc(g.away) + '</span><span class="xs muted"> 원정</span> → <span class="h">' + esc(g.home) + '</span><span class="xs muted"> 홈 · ' + esc(g.stadium) + '</span></li>').join('') + '</ul>'
      : '<p class="pf-d">날짜가 없는 시리즈입니다(' + nOf(s) + '연전).</p>';
    const head = '<div class="pf-vchk-head' + (s.bad.length ? ' bad' : '') + '"><div class="t"><b>' + esc(s.away) + '</b><span class="xs muted"> 원정</span> → <b>' + esc(s.home) + '</b><span class="xs muted"> 홈 · ' + esc(s.stadium || '구장 없음') + '</span></div>' +
      '<div class="xs muted">' + range(s) + ' · ' + nOf(s) + '연전' + (s.slot >= 0 ? ' · 연전 기간 ' + (s.slot + 1) : '') + '</div>' +
      '<div class="pf-vchk-verdict">' + (s.bad.length ? verdictIcon(FAIL) + '<b>이 연전에서 ' + s.bad.length + '개 어김</b>' : verdictIcon(PASS) + '<b>이 연전은 모두 지킴</b>') + (stale ? ' <span class="pf-tag est">다른 일정</span>' : '') + '</div>' +
      (s.bad.length ? '<ul class="pf-vchk-rows pf-vchk-badsum">' + items(v).filter((it) => s.bad.includes(it.id)).map((it) => '<li><b>' + esc(it.title) + '</b> — ' + stateOf(c, s, it).rows.filter((r) => r.judge && !OK_JUDGE.test(r.judge)).slice(0, 3).map((r) => rowText(it, r)).join('<br>') + '</li>').join('') + '</ul>' : '') + // 어긴 항목은 맨 위에 근거와 함께(내리지 않아도 보이게)
      '<div class="xs muted" style="margin-top:6px">엔진이 낸 경기(서버가 날짜별로 푼 것)</div>' + games + '</div>';
    const groups = (v.groups || []).map((g) => {
      const rows = (g.items || []).map((it) => {
        const st = stateOf(c, s, it), open = !!V.open[it.id], shown = st.rows.slice(0, 4), more = st.rows.length - shown.length;
        const note = st.k === 'na' ? '<div class="xs muted">이 연전과는 상관없는 항목 · 시즌 전체: ' + esc(it.result) + '</div>'
          : st.rows.length ? '<ul class="pf-vchk-rows">' + shown.map((r) => '<li>' + rowText(it, r) + '</li>').join('') + (more > 0 ? '<li class="muted">… ' + more + '줄 더(근거 표에서)</li>' : '') + '</ul>'
          : '<div class="xs muted">이 연전에 걸리는 어긴 줄 없음 · 시즌 전체: ' + esc(it.result) + '</div>';
        return '<div class="pf-vchk-i ' + st.k + '"><div class="pf-vchk-ih">' + stateIcon(st.k) + '<div class="t"><b>' + esc(it.title) + '</b><span class="xs muted">' + esc(it.desc) + ' · 정한 값: ' + esc(it.standard) + '</span></div><span class="w ' + st.k + '">' + stateWord(st.k) + '</span>' +
          ((it.rows || []).length ? '<button class="pf-link xs" data-act="vf-item" data-id="' + esc(it.id) + '">' + (open ? '근거 표 접기' : '근거 표 ' + it.rows.length + '줄') + '</button>' : '') + '</div>' + note +
          (open && (it.rows || []).length ? '<div class="pf-vtbl"><table class="pf-t pf-vt"><thead><tr>' + (it.columns || []).map((cc) => '<th>' + esc(cc.label) + '</th>').join('') + '</tr></thead><tbody>' + it.rows.map((r) => '<tr>' + (it.columns || []).map((cc) => cell(r[cc.key])).join('') + '</tr>').join('') + '</tbody></table></div>' : '') + '</div>';
      }).join('');
      const gbad = (g.items || []).filter((it) => stateOf(c, s, it).k === 'bad').length;
      return '<div class="pf-vchk-g"><div class="pf-vchk-gh"><b>' + esc(g.title) + '</b><span class="xs muted">' + esc(g.desc) + '</span><span class="r">' + (gbad ? '<span class="pf-tag over">' + gbad + '개 어김</span>' : '<span class="pf-tag ok">지킴</span>') + '</span></div>' + rows + '</div>';
    }).join('');
    return head + groups;
  }
  /** 목록을 내릴 때: 맨 위에 보이는 연전을 고른 것으로 삼고 오른쪽만 바꾼다(전체를 다시 그리면 스크롤이 튄다) */
  function syncSel(box) {
    const v = V.data; if (!v) return;
    const c = build(v), top = box.getBoundingClientRect().top + 30; // 붙어 있는 연전 기간 머리줄 아래로 보이는 첫 카드
    let pick = null;
    for (const el of box.querySelectorAll('.pf-vser-card')) { if (el.getBoundingClientRect().bottom > top) { pick = +el.dataset.sid; break; } }
    if (pick == null || pick === V.sel) return;
    V.sel = pick;
    box.querySelectorAll('.pf-vser-card').forEach((el) => el.classList.toggle('on', +el.dataset.sid === pick));
    const chk = document.querySelector('.pf-vchk');
    if (chk) { chk.innerHTML = chkHtml(v, c, c.byId[pick], !V.matches(v, app().state)); chk.scrollTop = 0; }
  }

  // ───────── 화면 ─────────
  S.steps[8] = {
    render() {
      const st = app().state, res = st.meta.result, v = V.data, stale = !!(v && !V.matches(v, st)); // 지문이 다르면 = 다른 일정의 점검표
      const status = V.loading ? '<span class="pf-tag blue">지금 일정을 서버가 다시 세는 중…</span>' : V.error ? '<span class="pf-tag over">점검 못 함</span> <span class="small">' + esc(V.error) + '</span>' : V.offline ? '<span class="pf-tag est">서버 점검을 할 수 없음</span> <span class="small muted">서버에 연결되지 않았습니다' + (v ? ' · 아래는 ' + when(V.at) + '에 받아 둔 점검표' : '') + '</span>' : v ? '<span class="small muted">' + METHOD + ' · ' + when(V.at) + '</span>' : '';
      const tools = '<span class="grow"></span>' + (fromRest() ? '<button class="btn sm" data-act="vf-again"' + (V.loading ? ' disabled' : '') + '>' + icon('redo') + '지금 일정 다시 점검</button>' : '') + (v && v.tables && !stale ? '<button class="btn sm" data-act="vf-xlsx">' + icon('download') + '엑셀로 받기</button>' : '');
      let head;
      if (!v) head = '<div class="pf-sec pf-vsum none"><div class="pf-vsum-row"><span class="pf-vic none">' + icon('todo') + '</span><b>' + (V.loading ? '점검표를 받는 중' : '점검표가 없습니다') + '</b>' + tools + '</div><div class="xs">' + status + '</div></div>';
      else if (stale) head = '<div class="pf-sec pf-vsum stale"><div class="pf-vsum-row"><span class="pf-vic warn">' + icon('warn') + '</span><b>' + STALE + '</b>' + tools + '</div><div class="xs">실행 뒤 일정을 고쳤거나 다른 일정의 점검표입니다. 아래 연전·판정·근거는 <b>' + when(V.at) + '에 센 그 일정</b>의 것이지 지금 달력의 것이 아닙니다. ' + (fromRest() ? '「지금 일정 다시 점검」을 누르면 서버가 지금 일정을 다시 셉니다.' : '서버에 연결되면 지금 일정을 다시 셀 수 있습니다.') + ' ' + status + '</div></div>';
      else head = '<div class="pf-sec pf-vsum ' + (v.failed ? 'bad' : 'ok') + '"><div class="pf-vsum-row">' + verdictIcon(v.failed ? FAIL : PASS) + '<b>' + (v.failed ? '요구 사항 ' + v.failed + '개 어김 — ' + esc((v.failedTitles || []).join(' · ')) : '요구 사항 ' + v.total + '개 모두 지킴') + '</b>' + (v.info ? '<span class="pf-tag got">참고 ' + v.info + '개 · 정한 값이 없어 숫자만</span>' : '') + tools + '</div><div class="xs">' + status + '</div></div>';
      let main, below = '';
      if (v && v.tables) {
        const c = build(v);
        if (V.sel == null || !c.byId[V.sel]) { const b = c.series.find((s) => s.bad.length); V.sel = b ? b.id : c.series.length ? c.series[0].id : null; V.scrollTo = true; }
        const shown = shownList(c); if (shown.length && !shown.some((s) => s.id === V.sel)) { V.sel = shown[0].id; V.scrollTo = true; } // 구단·「어긴 연전만」으로 걸러 고른 연전이 빠지면 보이는 첫 연전
        main = '<div class="pf-cols pf-fill pf-vsercols">' + serHtml(v, c, stale) + '<div class="pf-sec pf-vchkwrap"><h3>이 연전의 점검표<span class="r">' + (v.passed || 0) + ' 지킴 · ' + (v.failed || 0) + ' 어김 · ' + (v.info || 0) + ' 참고 (시즌 전체)</span></h3><p class="pf-d">항목마다 이 연전에 걸리는 서버 근거 줄을 보입니다. 「근거 표」를 누르면 시즌 전체 줄이, 날짜를 누르면 달력의 그 날이 보입니다.</p><div class="pf-vchk" data-sk="vchk">' + chkHtml(v, c, c.byId[V.sel], stale) + '</div></div></div>';
        below = '<div class="pf-sec pf-vmore"><h3>날짜별 출전표 · 아무 날 골라 보기<span class="r"><button class="btn sm" data-act="vf-grid">' + (V.showGrid ? '접기' : '펼치기') + '</button></span></h3><p class="pf-d">연전이 아니라 날짜로 세어 보고 싶을 때. 날마다 모든 구단이 한 번씩 나오는지 직접 셀 수 있습니다.</p>' + (V.showGrid ? (stale ? '<div class="pf-note warn" style="margin:0 0 10px">아래 출전표는 ' + when(V.at) + '에 센 다른 일정의 것입니다.</div>' : '') + '<div class="pf-vright">' + dayHtml(v) + gridHtml(v) + '</div>' : '') + '</div>';
      } else if (v) {
        main = '<div class="pf-sec pf-vlist' + (stale ? ' pf-vstale' : '') + '"><h3>점검표' + (stale ? ' <span class="pf-tag est">다른 일정</span>' : '') + '<span class="r">' + (v.passed || 0) + ' 지킴 · ' + (v.failed || 0) + ' 어김 · ' + (v.info || 0) + ' 참고</span></h3><p class="pf-d">이 점검표에는 연전 원자료가 없어 항목만 보입니다(서버에 연결되면 연전마다 볼 수 있습니다). 묶음을 누르면 항목이, 「근거」를 누르면 서버가 일정에서 뽑은 줄이 보입니다.</p>' + (v.groups || []).map(groupHtml).join('') + '</div>';
      } else {
        main = '<div class="pf-sec pf-vlist"><h3>점검표</h3><p class="pf-d">' + (V.offline ? '서버에 연결되면 지금 일정을 다시 셉니다. 서버 엔진으로 실행한 결과에는 실행이 끝날 때 받은 점검표가 함께 남습니다.' : V.error ? '서버가 점검표를 주지 못했습니다.' : '잠시만 기다려 주세요.') + '</p>' + (!res ? '<p class="pf-d">아직 실행한 결과가 없습니다.</p>' : '') + '</div>';
      }
      return '<div class="stepview no-band"><div class="pf-page pf-vf">' + head + main + below + '</div></div>';
    },
    after() {
      ensure(false);
      const box = document.querySelector('.pf-vserlist');
      if (!box) return;
      if (V.scrollTo) { V.scrollTo = false; const el = box.querySelector('[data-sid="' + V.sel + '"]'); if (el) box.scrollTop = Math.max(0, box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - 26); }
      box.addEventListener('scroll', () => syncSel(box), { passive: true });
      if (!V.hashed && V.data) { V.hashed = true; if (H0.vteam || H0.vbad) { V.team = H0.vteam || 'all'; V.onlyBad = H0.vbad === '1'; V.scrollTo = true; S.scheduleRender(); } else if (H0.vscroll) { box.scrollTop = +H0.vscroll; } }
    }
  };

  // ───────── 엑셀 ─────────
  function xlsx(v) {
    const teams = teamsOf(v), days = (v.tables && v.tables.days) || [];
    const grid = [['날짜', '요일'].concat(teams)].concat(days.map((d) => [{ date: d.date }, d.weekday].concat(lineup(d, teams).map((x) => (x ? x.opp + (x.home ? ' 홈' : ' 원정') : '')))));
    const sheets = [{ name: '날짜별 출전표', rows: grid, header: true, widths: [12, 5].concat(teams.map(() => 9)) }];
    const used = new Set(['날짜별 출전표']);
    for (const g of v.groups || []) for (const it of g.items || []) {
      const cols = it.columns || [];
      let name = (it.title + ' ' + verdictWord(it.verdict)).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
      while (used.has(name)) name = name.slice(0, 29) + '·' + used.size;
      used.add(name);
      const rows = [['항목', it.title], ['설명', it.desc], ['정한 값', it.standard], ['출처', it.source], ['결과', it.result], []].concat([cols.map((c) => c.label)]).concat((it.rows || []).map((r) => cols.map((c) => (isDate(r[c.key]) ? { date: r[c.key] } : r[c.key] == null ? null : r[c.key]))));
      sheets.push({ name, rows, widths: cols.map(() => 14) });
    }
    const bytes = Xlsx.write(sheets);
    const file = 'KBO ' + S.seasonYear() + ' 요구 사항 점검 ' + (V.at || '').slice(0, 10) + '.xlsx';
    if (!S.selftestMode) KBO.UI.download(file, new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    S.toast('「' + file + '」을 내려받았습니다. 첫 시트가 날짜별 출전표, 다음 시트가 항목마다 근거 표입니다.', 'ok', 6000);
  }

  // ───────── 동작 ─────────
  /** 날짜 → 달력(일정 자세히 보기)의 그 달, 그 연전 기간의 시리즈를 깜빡인다 */
  function goDate(date) {
    const st = app().state, slot = CalendarGen.slotIndexOfDate(st.calendar, date);
    if (slot < 0) { S.toast(fmtDate(date) + '은 경기가 없는 날입니다. 그 달 달력으로 갑니다.', 'info', 4000); S.go({ step: 8 }); S.go({ step: 3, view: 'calendar', month: new Date(date + 'T00:00:00').getMonth() + 1, sel: null }); return; }
    const ms = st.plan.filter((x) => x.calendar === slot).map((x) => x.match);
    S.go({ step: 3, view: 'calendar', month: S.slotMonth(slot), sel: null, flashMatches: ms });
  }
  Object.assign(S.actions, {
    'vf-group': (el) => { const g = (V.data.groups || []).find((x) => x.id === el.dataset.id); if (g) V.gopen[g.id] = !groupOpen(g); S.render(); },
    'vf-item': (el) => { V.open[el.dataset.id] = !V.open[el.dataset.id]; S.render(); },
    'vf-filter': (el) => { V.filter = el.dataset.v; S.render(); },
    'vf-day': () => { const n = ((V.data && V.data.tables && V.data.tables.days) || []).length; if (n > 1) { let k = Math.floor(Math.random() * n); if (k === V.day) k = (k + 1) % n; V.day = k; } S.render(); },
    'vf-date': (el) => goDate(el.dataset.date),
    'vf-again': () => { ensure(true); S.render(); },
    'vf-xlsx': () => { if (V.data && V.data.tables) xlsx(V.data); },
    'vf-sel': (el) => { V.sel = +el.dataset.id; V.scrollTo = true; S.render(); },
    'vf-team': (el) => { V.team = el.dataset.v; V.scrollTo = true; S.render(); },
    'vf-onlybad': (el) => { V.onlyBad = !!el.checked; V.scrollTo = true; S.render(); },
    'vf-next': (el) => { const c = build(V.data); const bad = shownList(c).filter((s) => s.bad.length); if (!bad.length) return; const dir = +el.dataset.dir, cur = c.byId[V.sel]; let k = bad.findIndex((s) => s.id === V.sel); if (k < 0) { const i = c.series.indexOf(cur); k = dir > 0 ? bad.findIndex((s) => c.series.indexOf(s) > i) : bad.length - 1 - [...bad].reverse().findIndex((s) => c.series.indexOf(s) < i); if (k < 0 || k >= bad.length) k = dir > 0 ? 0 : bad.length - 1; } else k = (k + dir + bad.length) % bad.length; V.sel = bad[k].id; V.scrollTo = true; S.render(); },
    'vf-grid': () => { V.showGrid = !V.showGrid; S.render(); }
  });
  /** 점검용 주소 demo=verify: 서버 없이 점검 화면을 본다 — run27 결과에 보여주는 문의 저장된 점검표(2025 기본 결과)를 얹는다. 날짜는 2025 것이라 달력 이동은 맞지 않는다 */
  S.demos.verify = function () {
    S.demos.run27();
    const go = () => fetch('show/fixtures/result-default.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.verification) return;
      // 2025 기본 결과의 점검표를 2027 달력에 얹는 것이라 지문이 다르다 → 화면이 「다른 일정의 점검표」로 알려야 한다(그것이 이 점검 경로가 보는 것)
      V.took(j.verification); V.offline = true;
      V.gopen.special = true; V.open.opening = true; // 점검 화면 그림에 펼친 묶음·근거 표가 보이게
      const slim = V.slim(j.verification);
      app().store.commit('점검용 점검표', (s) => { if (s.meta.result) { s.meta.result.verification = slim; s.meta.result.engine = 'REST'; } }, { tags: ['meta'], undo: false });
      S.scheduleRender();
    }).catch(() => { /* 없으면 서버 없음 화면 */ });
    if (typeof fetch === 'function') go();
  };
})();
