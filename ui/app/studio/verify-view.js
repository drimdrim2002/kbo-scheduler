/*
 * 편성 스튜디오 — 요구 사항 점검 (현재 결과 분석의 보기 하나, S.ui.step 8) · 대안 C 「연전 기간 따라 점검」
 *  서버 점검기(RequirementChecker, POST /api/v1/verify)가 완성된 일정을 시리즈 → 연전 기간 → 날짜별 경기로 풀어 요구 사항마다 다시 센 것을 보여 준다.
 *  엔진 점수와는 따로 세므로, 점수 공식이 틀려도 여기서 잡힌다. 화면은 「검증 완료」 배지가 아니라 사람이 다시 셀 수 있는 근거(원자료)를 보여 준다.
 *   - 요약 줄(현재 결과 분석 맨 위, P.verify.summary): 지킨 개수 또는 어긴 항목 이름 + 「서버가 … 다시 세어 판정했습니다 · 시각」
 *   - 시즌 합계: 시즌 전체로 세는 항목(경기일·기간·시리즈·맞대결·홈 경기 수·시즌 기간·휴식일·연속)을 서버 판정과 함께 한 상자에.
 *   - 연전 기간 따라 점검: 한 줄 = 한 기간. 칸이 구장별로 고정이라 한 칸에 경기가 둘 들어갈 자리가 없다(겹침이 배치상 불가능).
 *     줄에는 특별 요구(개막전·어린이날·정한 대진·예외 경기)와 어긴 것만 표로, 판정은 「✔ 지킴」 또는 「✖ n개 어김」. 줄을 누르면 날짜별 경기와 근거가 펼쳐진다.
 *     기간 사이에는 휴식기·어긴 휴식 요일 줄만(보통 월요일은 적지 않는다). 「어긴 기간만」·모두 펼치기·다음 어긴 기간.
 *   - 누적 띠: 표 위에 붙어, 맨 위에 보이는 기간까지의 구단별 홈·원정 경기 수와 지금 연속. 끝까지 내리면 시즌 합계와 같은 숫자.
 *     구단을 누르면 표에서 그 구단 경기만 진하게(홈은 더 진한 칸). 「엑셀로 받기」(연전 기간별·출전표·근거 표)
 *   판정은 서버 줄의 판정 칸(judge)을 그대로 쓰고 화면이 새로 세지 않는다 — 줄이 어느 기간에 걸리는지만 화면이 찾는다. 누적 숫자는 엔진 결과를 그대로 센 것.
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
  const V = P.verify = { data: null, at: null, sig: null, loading: false, error: null, offline: false, open: {}, gopen: {} };

  // ───────── 공통 ─────────
  /** 일정의 지문(서버 점검표의 planSig와 같은 식, core/engine-adapter.js). 점검표가 지금 보이는 일정의 것인지는 이 값이 같은지로만 본다 */
  V.planSig = (st) => KBO.Engine.planSignature(st, st.plan);
  /** 점검표가 이 일정(또는 저장한 버전)의 것인가 */
  V.matches = (v, st) => !!(v && v.planSig && st && v.planSig === V.planSig(st));
  /** 결과·버전에 남길 몫: 근거 원자료(tables)는 크니까 뺀다 */
  V.slim = (v) => { if (!v) return null; const o = Object.assign({}, v); delete o.tables; return o; };
  /** 실행이 끝날 때 받은 점검표(원자료 포함)를 이 화면의 값으로 삼는다. 지문은 점검표에 적힌 것 — 지금 일정과 같은지는 보일 때마다 견준다 */
  V.took = (v) => { V.data = v; V.at = v.checkedAt; V.error = null; V.offline = false; V.gopen = {}; V.open = {}; V.rows = {}; V.scrollTo = null; };
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

  // ───────── 연전 기간 따라 점검 (대안 C) ─────────
  /* 서버 점검표의 연전 기간 줄(series-length)을 뼈대로, 날짜별 경기(tables.days)를 기간마다 붙이고 구장별 칸에 놓는다.
     서버가 적은 근거 줄은 걸리는 기간에 붙인다(특별 요구는 지켰어도 그 기간에 표, 어긴 줄은 빨간 표). 시즌 전체 항목은 시즌 합계 상자로.
     누적 띠는 기간 순서대로 홈·원정 경기 수와 연속을 센 것(엔진 결과를 그대로 셈). 연속의 ✖는 서버 줄(streak)이 있을 때만 */
  const H0 = S.parseHash(); // 점검용 주소: vteam=구단(강조) · vbad=1(어긴 기간만) · vk=기간 번호(그 줄로 내림) · vend=1(끝까지)
  V.team = H0.vteam || ''; V.onlyBad = H0.vbad === '1'; V.allOpen = null; V.rows = {}; V.cur = 0; V.scrollTo = null; V.toEnd = false;
  const teamsOf = (v) => (v.tables && v.tables.teams) || app().state.teams.map((t) => t.name);
  /** 날짜별 출전(엑셀 시트): 날짜 → 구단마다 { opp, home, stadium } */
  function lineup(day, teams) {
    const m = {};
    for (const g of day.games || []) { m[g.home] = { opp: g.away, home: true, stadium: g.stadium }; m[g.away] = { opp: g.home, home: false, stadium: g.stadium }; }
    return teams.map((t) => m[t] || null);
  }
  const SHORT = { '잠실종합운동장': '잠실', '서울 올림픽 주경기장': '잠실 주경기장', '문학경기장': '문학', '수원KT위즈파크': '수원', '대구삼성라이언즈파크': '대구', '광주챔피언스필드': '광주', '한화이글스파크': '대전', '사직야구장': '사직', '창원NC파크': '창원', '고척돔야구장': '고척' };
  const ORDER = ['잠실', '잠실 주경기장', '고척', '문학', '수원', '대전', '대구', '사직', '창원', '광주'];
  const shortName = (s) => SHORT[s] || String(s || '').replace(/(종합운동장|야구장|경기장|볼파크|파크|필드|돔)$/g, '').trim() || s;
  const OK_JUDGE = /^(정한 홈|정한 대진|개막 연전)$|^예외로 정한 날/; // 판정 칸에 글이 있어도 어긴 것이 아닌 말
  const SPECIAL = (id) => id === 'opening' || id === 'children' || /^stadium-/.test(id) || id === 'four-game'; // 걸리는 기간에만 뜻이 있는 항목
  const BASIC = ['daily-stadiums', 'daily-teams', 'series-length']; // 기간마다 늘 보는 셋 — 「✔ 지킴」에 접힌다
  const SEASON = ['unassigned', 'pair-games', 'home-totals', 'season-range']; // 시즌 전체로만 세는 항목
  const badRow = (it, r) => it.verdict === FAIL && !!r.judge && !OK_JUDGE.test(r.judge);
  const cache = { v: null };
  function build(v) {
    if (cache.v === v) return cache;
    const days = (v.tables && v.tables.days) || [], flow = (v.tables && v.tables.flow) || {}, teams = teamsOf(v), its = items(v), byId = {};
    for (const it of its) byId[it.id] = it;
    // 구장 열: 일정에 나오는 구장을 정한 순서(잠실·고척·문학·수원·대전·대구·사직·창원·광주)로, 모르는 구장은 뒤에
    const homeStad = {};
    for (const t of Object.keys(flow)) { const cnt = {}; for (const x of flow[t]) if (x.home && x.stadium) cnt[x.stadium] = (cnt[x.stadium] || 0) + 1; homeStad[t] = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || ''; }
    const names = [];
    for (const d of days) for (const g of d.games || []) if (g.stadium && !names.includes(g.stadium)) names.push(g.stadium);
    const cols = names.map((n) => ({ name: n, short: shortName(n), homes: teams.filter((t) => homeStad[t] === n) }))
      .sort((a, b) => { const ia = ORDER.indexOf(a.short), ib = ORDER.indexOf(b.short); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || names.indexOf(a.name) - names.indexOf(b.name); });
    // 기간: 서버의 연전 기간 줄
    const sl = byId['series-length'];
    const periods = ((sl && sl.rows) || []).filter((r) => isDate(r.date)).slice().sort((a, b) => a.slot - b.slot).map((r, i) => {
      const ds = days.filter((d) => d.date >= r.date && d.date <= (r.end || r.date));
      const p = { i, k: i + 1, slot: r.slot, start: r.date, end: r.end || r.date, len: r.length, days: ds.map((d) => ({ date: d.date, weekday: d.weekday, games: (d.games || []).map((g) => ({ home: g.home, away: g.away, stadium: g.stadium, st: shortName(g.stadium) })) })), byStad: {}, checks: {}, bad: [] };
      for (const g of (p.days[0] ? p.days[0].games : [])) if (!p.byStad[g.stadium]) p.byStad[g.stadium] = g;
      return p;
    });
    const periodOf = (date) => periods.find((p) => date >= p.start && date <= p.end) || null;
    const seps = []; let loose = 0; const streaks = {}; // streaks[구단] = [시작 기간 i, 끝 기간 i, 판정]
    const attach = (p, it, r) => { const c = p.checks[it.id] = p.checks[it.id] || { it, rows: [], bad: false, sp: SPECIAL(it.id) || (it.id === 'rest-weekdays' && !badRow(it, r)) }; c.rows.push(r); if (badRow(it, r)) c.bad = true; };
    for (const it of its) for (const r of it.rows || []) {
      const id = it.id, bad = badRow(it, r);
      if (SEASON.includes(id)) { if (bad && id === 'season-range' && isDate(r.date) && !periodOf(r.date)) seps.push({ date: r.date, label: it.title, judge: r.judge, bad: true }); else if (bad) loose++; continue; }
      if (id === 'series-length') { const p = periods.find((x) => x.slot === r.slot); if (p && bad) attach(p, it, r); else if (bad) loose++; continue; }
      if (id === 'streak') { const p0 = periodOf(r.date); if (!p0) { if (bad) loose++; continue; } const i1 = Math.min(periods.length - 1, p0.i + Math.max(1, +r.run || 1) - 1); if (bad) { attach(periods[i1], it, r); (streaks[r.team] = streaks[r.team] || []).push([p0.i, i1, r.judge]); } continue; }
      if (id === 'repeat-opponent') { const p = periodOf(r.next) || periodOf(r.date); if (p && bad) attach(p, it, r); else if (bad) loose++; continue; }
      if (!isDate(r.date)) { if (bad) loose++; continue; }
      const p = periodOf(r.date);
      if (SPECIAL(id)) { if (p) attach(p, it, r); else if (bad) loose++; continue; } // 특별 요구는 지켰어도 그 기간에 표
      if (id === 'rest-weekdays' && /^예외로 정한 날/.test(r.judge || '')) { if (p) attach(p, it, r); continue; }
      if (id === 'blackouts') { if (p) { if (bad) attach(p, it, r); } else seps.push({ date: r.date, label: r.label || it.title, judge: r.judge, bad }); continue; }
      if (!bad) continue; // 보통 휴식 요일(경기 없음)·날마다 한 번씩 지킨 줄 등은 적지 않는다
      if (p) attach(p, it, r); else seps.push({ date: r.date, label: it.title, judge: r.judge, bad: true });
    }
    for (const p of periods) p.bad = Object.values(p.checks).filter((c) => c.bad);
    // 기간 사이 줄: 날짜 순, 이어진 날은 한 줄로(같은 이름·같은 판정)
    seps.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const merged = [];
    for (const x of seps) { const l = merged[merged.length - 1]; if (l && l.label === x.label && l.bad === x.bad && Dates.dayNum(x.date) === Dates.dayNum(l.to) + 1) { l.to = x.date; l.n++; } else merged.push({ from: x.date, to: x.date, n: 1, label: x.label, judge: x.judge, bad: x.bad }); }
    const entries = []; let si = 0;
    for (const p of periods) { while (si < merged.length && merged[si].from < p.start) entries.push({ sep: merged[si++] }); entries.push({ p }); }
    while (si < merged.length) entries.push({ sep: merged[si++] });
    // 누적: 기간마다 구단별 홈·원정 경기 수와 지금 연속(연전 단위)
    const cum = [], h = {}, a = {}, run = {};
    for (const t of teams) { h[t] = 0; a[t] = 0; run[t] = { kind: '', n: 0 }; }
    for (const p of periods) {
      const now = {};
      for (const d of p.days) for (const g of d.games) { if (h[g.home] == null) { h[g.home] = 0; a[g.home] = 0; run[g.home] = { kind: '', n: 0 }; } if (h[g.away] == null) { h[g.away] = 0; a[g.away] = 0; run[g.away] = { kind: '', n: 0 }; } h[g.home]++; a[g.away]++; now[g.home] = '홈'; now[g.away] = '원정'; }
      for (const t of teams) { const k = now[t]; if (!k) continue; run[t] = run[t].kind === k ? { kind: k, n: run[t].n + 1 } : { kind: k, n: 1 }; }
      cum.push(teams.map((t) => ({ t, h: h[t] || 0, a: a[t] || 0, kind: run[t] ? run[t].kind : '', n: run[t] ? run[t].n : 0 })));
    }
    // 시즌 합계의 숫자(엔진 결과를 그대로 센 것)
    const perTeam = {}, sids = new Set(); let games = 0;
    for (const d of days) for (const g of d.games || []) { games++; perTeam[g.home] = (perTeam[g.home] || 0) + 1; perTeam[g.away] = (perTeam[g.away] || 0) + 1; if (g.series != null) sids.add(g.series); }
    const rw = (byId['rest-weekdays'] && byId['rest-weekdays'].rows) || [], bo = (byId['blackouts'] && byId['blackouts'].rows) || [], sr = (byId['season-range'] && byId['season-range'].rows) || [];
    const tot = { days: days.length, periods: periods.length, games, series: sids.size + ((byId.unassigned && byId.unassigned.rows) || []).length, perTeam,
      restDays: rw.filter((r) => !r.judge).length, restEx: rw.filter((r) => /^예외로 정한 날/.test(r.judge || '')).map((r) => r.date), restBad: rw.filter((r) => badRow(byId['rest-weekdays'], r)).length,
      blackDays: bo.filter((r) => !r.judge).length, blackBad: bo.filter((r) => badRow(byId.blackouts, r)).length,
      first: (sr.find((r) => r.what === '첫 경기') || {}).date, last: (sr.find((r) => r.what === '마지막 경기') || {}).date };
    Object.assign(cache, { v, days, teams, its, byId, cols, periods, entries, cum, streaks, loose, tot });
    return cache;
  }
  const ic = (k) => verdictIcon(k === 'bad' ? FAIL : k === 'info' ? INFO : PASS);
  const dateBtn = (d) => '<button class="pf-link pf-vdate" data-act="vf-date" data-date="' + d + '" title="달력의 이 날로">' + fmtDate(d) + '</button>';
  /** 경기 한 칸: 「원정 vs 홈」(홈이 굵게). 강조한 구단이 있으면 그 구단의 경기만 진하게 */
  function gm(g, withSt) {
    const hl = V.team && (g.home === V.team || g.away === V.team), home = hl && g.home === V.team;
    return '<span class="pf-vgm' + (hl ? ' hl' : '') + (home ? ' home' : '') + '"><span class="away">' + esc(g.away) + '</span> <span class="vs">vs</span> <span class="home">' + esc(g.home) + '</span>' + (withSt ? ' <span class="stad">' + esc(g.st) + '</span>' : '') + '</span>';
  }
  /** 근거 줄 한 줄을 짧은 글로: 「날짜 3/22(토) · 원정 한화 · 홈 LG · 판정」 */
  function rowText(it, r) {
    const out = [];
    for (const c of it.columns || []) { const x = r[c.key]; if (x == null || x === '' || c.key === 'judge') continue; out.push('<span class="muted">' + esc(c.label) + '</span> ' + (isDate(x) ? dateBtn(x) : esc(x))); }
    if (r.judge) out.push('<b class="' + (badRow(it, r) ? 'bad' : 'ok') + '">' + esc(r.judge) + '</b>');
    return out.join(' · ');
  }
  const chipLabel = (c) => { const id = c.it.id; const nb = c.rows.filter((r) => badRow(c.it, r)).length; return c.bad ? c.it.title + (nb > 1 ? ' ' + nb + '줄' : '') : id === 'opening' ? '개막전 정한 홈' : id === 'children' ? '어린이날 홈 구장' : id === 'four-game' ? '4연전 개막 대진' : id === 'rest-weekdays' ? fmtDate(c.rows[0].date) + ' 예외 경기' : c.it.title; };
  const chip = (c) => '<span class="pf-vchip ' + (c.bad ? 'bad' : 'sp') + '">' + (c.bad ? '✖' : '✔') + ' ' + esc(chipLabel(c)) + '</span>';
  const isOpen = (p) => (V.rows[p.k] != null ? V.rows[p.k] : V.allOpen === true ? true : V.allOpen === false ? false : p.bad.length > 0); // allOpen: null = 어긴 줄만 펼침 · true = 모두 · false = 모두 접음
  const shownEntries = (c) => (V.onlyBad ? c.entries.filter((e) => (e.p ? e.p.bad.length > 0 : e.sep.bad)) : c.entries);
  function totalsHtml(v, c) {
    const t = c.tot, by = c.byId, get = (ids) => ids.map((id) => by[id]).filter(Boolean);
    const state = (its) => (its.some((it) => it.verdict === FAIL) ? 'bad' : its.some((it) => it.verdict === INFO) ? 'info' : 'ok');
    const badN = (its) => its.reduce((n, it) => n + (it.rows || []).filter((r) => badRow(it, r)).length, 0);
    const firstBad = (its) => { const p = c.periods.find((x) => its.some((it) => x.checks[it.id] && x.checks[it.id].bad)); return p ? p.k : null; };
    const line = (ids, head, sub) => { const its = get(ids), k = state(its), n = k === 'bad' ? badN(its) : 0, go = k === 'bad' ? firstBad(its) : null;
      return '<div class="' + k + '">' + ic(k) + '<b>' + head + (n ? ' <span class="bad">· ' + n + '줄 어김</span>' : '') + '</b>' + (go ? '<button class="pf-link xs" data-act="vf-goto" data-k="' + go + '">기간 ' + go + '으로 ›</button>' : '') + '<small>' + sub + '</small></div>'; };
    const same = Object.values(t.perTeam), allSame = same.length && same.every((x) => x === same[0]);
    const homeNums = ((by['home-totals'] && by['home-totals'].rows) || []).map((r) => esc(r.team) + ' ' + r.home).join(' · ');
    const rest = by['rest-weekdays'], bl = by.blackouts;
    return '<div class="pf-sec pf-vtot"><h3>시즌 합계<span class="r muted">시즌 전체로 세는 것 — 요구한 일정을 전부 치렀는지. 아래 누적 띠를 끝까지 내리면 같은 숫자가 됩니다</span></h3><div class="pf-vtgrid">' +
      line(['daily-teams', 'daily-stadiums'], '경기일 ' + t.days + '일', '날마다 모든 구단이 한 번씩 · 구장마다 경기 하나') +
      line(['series-length', 'length-match'], '연전 기간 ' + t.periods + '개', esc((by['series-length'] && by['series-length'].standard) || '')) +
      line(['unassigned'], '경기 ' + t.games + '개 · 시리즈 ' + t.series + '개' + (by.unassigned && by.unassigned.verdict === FAIL ? '' : ' 모두 날짜 있음'), esc((by.unassigned && by.unassigned.result) || '')) +
      line(['pair-games'], esc((by['pair-games'] && by['pair-games'].result) || '맞대결 경기 수'), '구단마다 ' + (allSame ? same[0] + '경기(홈+원정)' : Object.keys(t.perTeam).map((k) => esc(k) + ' ' + t.perTeam[k]).join(' · ')) + ' — 누적 띠의 마지막 숫자') +
      line(['home-totals'], '홈 경기 수 — ' + (by['home-totals'] ? verdictWord(by['home-totals'].verdict) : '참고'), (by['home-totals'] && by['home-totals'].verdict === INFO ? '정한 값이 없어 숫자만: ' : '') + homeNums) +
      line(['season-range'], '시즌 기간 ' + (t.first ? fmtDate(t.first) : '?') + ' ~ ' + (t.last ? fmtDate(t.last) : '?'), esc((by['season-range'] && by['season-range'].result) || '')) +
      line(['rest-weekdays', 'blackouts'], '휴식 요일 ' + t.restDays + '일 · 휴식기 ' + t.blackDays + '일' + (t.restBad + t.blackBad ? '' : ' 모두 경기 없음'), (t.restEx.length ? '예외로 정한 날 ' + t.restEx.map(fmtDate).join('·') + '만 경기 · ' : '') + '휴식기와 어긴 날은 목록 사이에 줄로' + (rest && bl ? '' : '')) +
      line(['streak', 'repeat-opponent'], (by.streak && by.streak.verdict === FAIL ? '홈·원정 연속 어김' : '홈·원정 ' + esc(((by.streak && by.streak.standard) || '4연속 없음').replace(/\(.*\)$/, '').replace(/^홈 또는 원정 연전 /, ''))) + ' · ' + (by['repeat-opponent'] && by['repeat-opponent'].verdict === FAIL ? '같은 상대 연속 어김' : '같은 상대 연속 없음'), '누적 띠의 「지금 연속」 · 어기면 그 기간 줄에도 표') +
      '</div>' + (c.loose ? '<div class="xs muted" style="margin-top:4px">기간에 붙지 않는 어긴 줄 ' + c.loose + ' — 항목별 근거 표(엑셀)에서 볼 수 있습니다</div>' : '') + '</div>';
  }
  function rowHtml(p, c) {
    const open = isOpen(p), chips = Object.values(p.checks).filter((x) => x.bad || x.sp).sort((x, y) => (y.bad - x.bad)).map(chip).join('');
    const cells = c.cols.map((col) => { const g = p.byStad[col.name]; const hl = g && V.team && (g.home === V.team || g.away === V.team); return g ? '<td class="pf-vgc' + (hl ? ' hl' + (g.home === V.team ? ' home' : '') : '') + '">' + gm(g) + '</td>' : '<td class="pf-vgc empty"></td>'; }).join('');
    const basics = BASIC.map((id) => c.byId[id]).filter(Boolean).map((it) => (it.id === 'series-length' ? p.len + '연전' : it.title)).join(' · ');
    const verdict = p.bad.length ? '<span class="pf-vv bad">✖ ' + p.bad.length + '개 어김</span>' : '<span class="pf-vv ok" title="' + esc(basics) + '">✔ 지킴</span>';
    return '<tr class="pf-vrow' + (p.bad.length ? ' bad' : '') + (open ? ' open' : '') + (p.i === V.cur ? ' cur' : '') + '" data-act="vf-row" data-k="' + p.k + '" data-i="' + p.i + '"><td class="pf-vc">' + icon('right') + '</td><td class="pf-vk">기간 ' + p.k + '</td><td class="pf-vd">' + fmtDate(p.start) + '–' + fmtDate(p.end) + '<small>' + p.len + '연전</small></td>' + cells + '<td class="pf-vck">' + chips + '</td><td class="pf-vvc">' + verdict + '</td></tr>' + (open ? detailHtml(p, c) : '');
  }
  function detailHtml(p, c) {
    const dt = p.days.map((d) => '<tr><td class="pf-vdd">' + dateBtn(d.date) + '</td><td>' + d.games.map((g) => gm(g, true)).join(' &nbsp; ') + '</td></tr>').join('');
    const ev = (k, title, body) => '<div class="pf-vev ' + k + '">' + ic(k) + '<b>' + esc(title) + '</b><span>' + body + '</span></div>';
    const basics = BASIC.map((id) => c.byId[id]).filter(Boolean).map((it) => { const x = p.checks[it.id]; return ev(x && x.bad ? 'bad' : 'ok', it.id === 'series-length' ? p.len + '연전' : it.title, x && x.bad ? x.rows.map((r) => rowText(it, r)).join('<br>') : '이 기간에 어긴 줄 없음 · 시즌 전체: ' + esc(it.result)); }).join('');
    const others = Object.values(p.checks).filter((x) => !BASIC.includes(x.it.id)).sort((x, y) => (y.bad - x.bad)).map((x) => ev(x.bad ? 'bad' : 'ok', x.it.title, x.rows.map((r) => rowText(x.it, r)).join('<br>'))).join('');
    const na = c.its.filter((it) => !BASIC.includes(it.id) && !p.checks[it.id]).map((it) => esc(it.title)).join(' · ');
    return '<tr class="pf-vdet"><td></td><td colspan="' + (c.cols.length + 4) + '"><div class="pf-vdet-in"><table class="pf-vdt"><tbody>' + dt + '</tbody></table><div class="pf-vevs">' + basics + others + '</div>' + (na ? '<div class="xs muted pf-vna">이 기간과 상관없는 항목은 시즌 합계·근거 표에서 봅니다: ' + na + '</div>' : '') + '</div></td></tr>';
  }
  const sepHtml = (s, c) => '<tr class="pf-vsep' + (s.bad ? ' bad' : '') + '"><td></td><td colspan="' + (c.cols.length + 4) + '">' + ic(s.bad ? 'bad' : 'ok') + (s.n > 1 ? fmtDate(s.from) + '–' + fmtDate(s.to) + ' ' + esc(s.label) + ' ' + s.n + '일' : fmtDate(s.from) + ' ' + esc(s.label)) + (s.bad ? ' · <b class="bad">' + esc(s.judge) + '</b>' : ' · 경기 없음') + '</td></tr>';
  /** 누적 띠: i번째 기간까지 */
  function stripHtml(c, i) {
    const p = c.periods[i], end = i === c.periods.length - 1, row = c.cum[i] || [], t = c.tot;
    const same = Object.values(t.perTeam), allSame = same.length && same.every((x) => x === same[0]), hs = row.map((x) => x.h);
    const title = !p ? '<b>누적</b>' : end ? '<b>시즌 끝(기간 ' + p.k + ')까지 누적</b> <span class="pf-vend">= 시즌 합계 — ' + (allSame ? '구단마다 ' + same[0] + '경기' : '구단별 경기 수') + ' · 홈 ' + Math.min.apply(null, hs) + '~' + Math.max.apply(null, hs) + '</span>' : '<b>기간 ' + p.k + '(' + fmtDate(p.start) + '–' + fmtDate(p.end) + ')까지 누적</b> <span class="muted">10구단 홈·원정 경기 수와 지금 연속 — 내려가면 바뀜</span>';
    const sel = V.team ? '<span class="pf-vsel"><b>' + esc(V.team) + '</b> 강조 — 진한 칸 홈, 연한 칸 원정 · <button class="pf-link xs" data-act="vf-team" data-v="">강조 풀기</button></span>' : '<span class="muted xs">구단을 누르면 그 구단 경기만 진하게</span>';
    const cells = row.map((x) => { const sb = (c.streaks[x.t] || []).find((s) => i >= s[0] && i <= s[1]); const cls = sb ? 'r4' : x.n >= 3 ? 'r3' : '';
      return '<button class="pf-vtc' + (sb ? ' r4' : '') + (V.team === x.t ? ' sel' : '') + '" data-act="vf-team" data-v="' + esc(x.t) + '" title="' + esc(x.t) + ' 경기만 진하게"><b>' + esc(x.t) + '</b><span class="pf-vha">홈 <em>' + x.h + '</em> 원정 <em>' + x.a + '</em> <span class="pf-vsum2">= ' + (x.h + x.a) + '</span></span><span class="pf-vrun ' + cls + '">' + (sb ? '✖ ' + esc(sb[2]) : x.kind ? x.kind + ' ' + x.n + '연속' : '—') + '</span></button>'; }).join('');
    return '<div class="pf-vstrip-t">' + title + sel + '</div><div class="pf-vtcs" style="grid-template-columns:repeat(' + Math.max(1, row.length) + ',minmax(0,1fr))">' + cells + '</div>';
  }
  function listHtml(v, c, stale) {
    const badN = c.periods.filter((p) => p.bad.length).length, shown = shownEntries(c);
    const head = '<tr><th></th><th>기간</th><th>날짜</th>' + c.cols.map((col) => '<th class="pf-vst">' + esc(col.short) + '<small>' + (col.homes.length ? esc(col.homes.join('·')) + ' 홈' : '') + '</small></th>').join('') + '<th>특별 요구 · 어긴 것</th><th>판정</th></tr>';
    const body = shown.length ? shown.map((e) => (e.p ? rowHtml(e.p, c) : sepHtml(e.sep, c))).join('') : '<tr><td colspan="' + (c.cols.length + 5) + '" class="muted" style="padding:14px">' + (V.onlyBad ? '어긴 기간이 없습니다.' : '연전 기간이 없습니다.') + '</td></tr>';
    return '<div class="pf-sec pf-fill pf-vper' + (stale ? ' pf-vstale' : '') + '"><h3>연전 기간 따라 점검' + (stale ? ' <span class="pf-tag est">다른 일정</span>' : '') + '<span class="r">' + c.periods.length + '개 기간 · ' + (badN ? '<b class="bad">어긴 기간 ' + badN + '</b>' : '<b class="ok">어긴 기간 없음</b>') + '</span></h3>' +
      '<div class="pf-vtools"><span class="muted">한 줄 = 한 기간. 칸은 구장마다 고정이라 한 칸에 경기가 둘 들어갈 자리가 없고, 기간마다 경기 수만큼 차고 나머지는 빕니다. 늘 보는 셋(구장마다 경기 하나·모든 구단 한 번씩·연전 길이)은 「✔ 지킴」에 접혀 있고, 특별 요구와 어긴 것만 표로 보입니다. 줄을 누르면 날짜별 경기와 근거가 펼쳐집니다.</span>' +
      '<label class="xs"><input type="checkbox" data-act="vf-onlybad"' + (V.onlyBad ? ' checked' : '') + '> 어긴 기간만</label><button class="pf-link xs" data-act="vf-all">' + (V.allOpen === true ? '모두 접기' : '모두 펼치기') + '</button>' + (badN ? '<button class="pf-link xs" data-act="vf-next">다음 어긴 기간 ›</button>' : '') + '</div>' +
      '<div class="pf-vstrip" data-i="' + V.cur + '">' + stripHtml(c, V.cur) + '</div>' +
      '<div class="pf-vplist" data-sk="vplist"><table class="pf-vpt"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>';
  }

  // ───────── 화면 ─────────
  S.steps[8] = {
    render() {
      const st = app().state, res = st.meta.result, v = V.data, stale = !!(v && !V.matches(v, st)); // 지문이 다르면 = 다른 일정의 점검표
      const status = V.loading ? '<span class="pf-tag blue">지금 일정을 서버가 다시 세는 중…</span>' : V.error ? '<span class="pf-tag over">점검 못 함</span> <span class="small">' + esc(V.error) + '</span>' : V.offline ? '<span class="pf-tag est">서버 점검을 할 수 없음</span> <span class="small muted">서버에 연결되지 않았습니다' + (v ? ' · 아래는 ' + when(V.at) + '에 받아 둔 점검표' : '') + '</span>' : v ? '<span class="small muted">' + METHOD + ' · ' + when(V.at) + '</span>' : '';
      const tools = '<span class="grow"></span>' + (fromRest() ? '<button class="btn sm" data-act="vf-again"' + (V.loading ? ' disabled' : '') + '>' + icon('redo') + '지금 일정 다시 점검</button>' : '') + (v && v.tables && !stale ? '<button class="btn sm" data-act="vf-xlsx">' + icon('download') + '엑셀로 받기</button>' : '');
      let head;
      if (!v) head = '<div class="pf-sec pf-vsum none"><div class="pf-vsum-row"><span class="pf-vic none">' + icon('todo') + '</span><b>' + (V.loading ? '점검표를 받는 중' : '점검표가 없습니다') + '</b>' + tools + '</div><div class="xs">' + status + '</div></div>';
      else if (stale) head = '<div class="pf-sec pf-vsum stale"><div class="pf-vsum-row"><span class="pf-vic warn">' + icon('warn') + '</span><b>' + STALE + '</b>' + tools + '</div><div class="xs">실행 뒤 일정을 고쳤거나 다른 일정의 점검표입니다. 아래 합계·기간·판정·근거는 <b>' + when(V.at) + '에 센 그 일정</b>의 것이지 지금 달력의 것이 아닙니다. ' + (fromRest() ? '「지금 일정 다시 점검」을 누르면 서버가 지금 일정을 다시 셉니다.' : '서버에 연결되면 지금 일정을 다시 셀 수 있습니다.') + ' ' + status + '</div></div>';
      else head = '<div class="pf-sec pf-vsum ' + (v.failed ? 'bad' : 'ok') + '"><div class="pf-vsum-row">' + verdictIcon(v.failed ? FAIL : PASS) + '<b>' + (v.failed ? '요구 사항 ' + v.failed + '개 어김 — ' + esc((v.failedTitles || []).join(' · ')) : '요구 사항 ' + v.total + '개 모두 지킴') + '</b>' + (v.info ? '<span class="pf-tag got">참고 ' + v.info + '개 · 정한 값이 없어 숫자만</span>' : '') + tools + '</div><div class="xs">' + status + '</div></div>';
      let main;
      if (v && v.tables) {
        const c = build(v);
        if (V.cur >= c.periods.length) V.cur = 0;
        main = totalsHtml(v, c) + listHtml(v, c, stale);
      } else if (v) {
        main = '<div class="pf-sec pf-vlist' + (stale ? ' pf-vstale' : '') + '"><h3>점검표' + (stale ? ' <span class="pf-tag est">다른 일정</span>' : '') + '<span class="r">' + (v.passed || 0) + ' 지킴 · ' + (v.failed || 0) + ' 어김 · ' + (v.info || 0) + ' 참고</span></h3><p class="pf-d">이 점검표에는 연전 원자료가 없어 항목만 보입니다(서버에 연결되면 기간마다 볼 수 있습니다). 묶음을 누르면 항목이, 「근거」를 누르면 서버가 일정에서 뽑은 줄이 보입니다.</p>' + (v.groups || []).map(groupHtml).join('') + '</div>';
      } else {
        main = '<div class="pf-sec pf-vlist"><h3>점검표</h3><p class="pf-d">' + (V.offline ? '서버에 연결되면 지금 일정을 다시 셉니다. 서버 엔진으로 실행한 결과에는 실행이 끝날 때 받은 점검표가 함께 남습니다.' : V.error ? '서버가 점검표를 주지 못했습니다.' : '잠시만 기다려 주세요.') + '</p>' + (!res ? '<p class="pf-d">아직 실행한 결과가 없습니다.</p>' : '') + '</div>';
      }
      return '<div class="stepview no-band"><div class="pf-page pf-vf' + (V.team ? ' hl' : '') + '">' + head + main + '</div></div>';
    },
    after() {
      ensure(false);
      const list = document.querySelector('.pf-vplist'), strip = document.querySelector('.pf-vstrip');
      if (!list || !strip || !V.data) return;
      const c = build(V.data), rows = Array.prototype.slice.call(list.querySelectorAll('tr.pf-vrow'));
      const hh = () => { const th = list.querySelector('thead'); return (th ? th.offsetHeight : 0) + 2; };
      const curIdx = () => { // 붙어 있는 머리줄 아래로 보이는 첫 기간 줄 · 끝까지 내렸으면 마지막 기간
        if (!rows.length) return 0;
        const top = list.getBoundingClientRect().top + hh() + 4; let i = +rows[rows.length - 1].dataset.i;
        for (const r of rows) if (r.getBoundingClientRect().bottom > top) { i = +r.dataset.i; break; }
        if (list.scrollTop + list.clientHeight >= list.scrollHeight - 2) i = +rows[rows.length - 1].dataset.i;
        return i;
      };
      const sync = () => { const i = curIdx(); if (String(i) === strip.dataset.i) return; V.cur = i; strip.dataset.i = i; strip.innerHTML = stripHtml(c, i); rows.forEach((r) => r.classList.toggle('cur', +r.dataset.i === i)); };
      if (!V.hashed) { V.hashed = true; if (H0.vk) V.scrollTo = +H0.vk; if (H0.vend) V.toEnd = true; }
      if (V.scrollTo != null) { const r = list.querySelector('tr.pf-vrow[data-k="' + V.scrollTo + '"]'); if (r) list.scrollTop = Math.max(0, list.scrollTop + r.getBoundingClientRect().top - list.getBoundingClientRect().top - hh()); V.scrollTo = null; }
      if (V.toEnd) { V.toEnd = false; list.scrollTop = list.scrollHeight; }
      list.addEventListener('scroll', sync, { passive: true });
      sync();
    }
  };

  // ───────── 엑셀 ─────────
  function xlsx(v) {
    const teams = teamsOf(v), days = (v.tables && v.tables.days) || [];
    const grid = [['날짜', '요일'].concat(teams)].concat(days.map((d) => [{ date: d.date }, d.weekday].concat(lineup(d, teams).map((x) => (x ? x.opp + (x.home ? ' 홈' : ' 원정') : '')))));
    const c = build(v), per = [['기간', '시작', '끝', '연전'].concat(c.cols.map((col) => col.short)).concat(['특별 요구 · 어긴 것', '판정'])].concat(c.periods.map((p) => [p.k, { date: p.start }, { date: p.end }, p.len].concat(c.cols.map((col) => { const g = p.byStad[col.name]; return g ? g.away + ' vs ' + g.home : ''; })).concat([Object.values(p.checks).filter((x) => x.bad || x.sp).map((x) => (x.bad ? '✖ ' : '✔ ') + chipLabel(x)).join(' · '), p.bad.length ? p.bad.length + '개 어김' : '지킴'])));
    const sheets = [{ name: '연전 기간별', rows: per, header: true, widths: [6, 12, 12, 5].concat(c.cols.map(() => 12)).concat([30, 9]) }, { name: '날짜별 출전표', rows: grid, header: true, widths: [12, 5].concat(teams.map(() => 9)) }];
    const used = new Set(['연전 기간별', '날짜별 출전표']);
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
    S.toast('「' + file + '」을 내려받았습니다. 첫 시트가 연전 기간별, 다음이 날짜별 출전표, 그다음이 항목마다 근거 표입니다.', 'ok', 6000);
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
    'vf-date': (el) => goDate(el.dataset.date),
    'vf-again': () => { ensure(true); S.render(); },
    'vf-xlsx': () => { if (V.data && V.data.tables) xlsx(V.data); },
    'vf-row': (el) => { const c = build(V.data), p = c.periods[+el.dataset.i]; if (p) V.rows[p.k] = !isOpen(p); S.render(); },
    'vf-all': () => { V.allOpen = V.allOpen === true ? false : true; V.rows = {}; S.render(); },
    'vf-onlybad': (el) => { V.onlyBad = !!el.checked; S.render(); },
    'vf-team': (el) => { V.team = el.dataset.v === V.team ? '' : (el.dataset.v || ''); S.render(); },
    'vf-goto': (el) => { V.rows[+el.dataset.k] = true; V.scrollTo = +el.dataset.k; S.render(); },
    'vf-next': () => { const c = build(V.data), bad = c.periods.filter((p) => p.bad.length); if (!bad.length) return; const n = bad.find((p) => p.i > V.cur) || bad[0]; V.rows[n.k] = true; V.scrollTo = n.k; S.render(); }
  });
  /** 점검용 주소 demo=verify: 서버 없이 점검 화면을 본다 — run27 결과에 보여주는 문의 저장된 점검표(2025 기본 결과)를 얹는다. 날짜는 2025 것이라 달력 이동은 맞지 않는다 */
  S.demos.verify = function (bad) {
    S.demos.run27();
    const go = () => fetch('show/fixtures/result-default.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.verification) return;
      // 2025 기본 결과의 점검표를 2027 달력에 얹는 것이라 지문이 다르다 → 화면이 「다른 일정의 점검표」로 알려야 한다(그것이 이 점검 경로가 보는 것)
      if (bad) fakeBad(j.verification);
      V.took(j.verification); V.offline = true;
      V.gopen.special = true; V.open.opening = true; // 점검 화면 그림에 펼친 묶음·근거 표가 보이게
      const slim = V.slim(j.verification);
      app().store.commit('점검용 점검표', (s) => { if (s.meta.result) { s.meta.result.verification = slim; s.meta.result.engine = 'REST'; } }, { tags: ['meta'], undo: false });
      S.scheduleRender();
    }).catch(() => { /* 없으면 서버 없음 화면 */ });
    if (typeof fetch === 'function') go();
  };
  /** 점검용 주소 demo=verifybad: 위 점검표에 어긴 줄을 꾸며 넣어 어긴 기간 줄·빨간 표·띠의 ✖·휴식 요일 어김 줄이 보이게 한다(그림·점검용, 실제 판정이 아님) */
  S.demos.verifybad = function () { S.demos.verify(true); };
  function fakeBad(v) {
    const by = {}; for (const it of items(v)) by[it.id] = it;
    const fail = (it, row, result) => { if (!it) return; if (it.verdict !== FAIL) { it.verdict = FAIL; v.failed = (v.failed || 0) + 1; v.passed = Math.max(0, (v.passed || 0) - 1); v.failedTitles = (v.failedTitles || []).concat([it.title]); v.ok = false; } it.rows = (it.rows || []).concat([row]); it.result = result; };
    const sl = (by['series-length'] && by['series-length'].rows) || [], at = (i) => (sl[i] ? sl[i].date : '2025-04-22');
    fail(by.streak, { team: '한화', date: at(6), run: 4, kind: '홈', judge: '홈 4연속' }, '한화가 홈 4연속입니다(점검용으로 꾸민 줄).');
    fail(by['daily-stadiums'], { date: at(19), weekday: '화', stadium: '잠실종합운동장', games: 'KIA vs 두산 · KT vs LG', judge: '한 구장에 경기 2' }, '한 구장에 경기가 둘인 날이 있습니다(점검용으로 꾸민 줄).');
    fail(by['rest-weekdays'], { date: '2025-06-02', weekday: '월', games: 5, judge: '휴식 요일에 경기' }, '휴식 요일에 경기가 있는 날이 있습니다(점검용으로 꾸민 줄).');
    if (by.children && by.children.rows && by.children.rows[0]) { by.children.rows[0].judge = '정한 홈 아님'; fail(by.children, { date: by.children.rows[0].date, away: '', home: by.children.rows[0].home, stadium: by.children.rows[0].stadium, judge: '홈 경기가 없음' }, '어린이날 홈 구장이 정한 대로가 아닙니다(점검용으로 꾸민 줄).'); }
  }
})();
