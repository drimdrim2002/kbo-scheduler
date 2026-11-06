/*
 * 편성 스튜디오 — 요구 사항 점검 (현재 결과 분석의 보기 하나, S.ui.step 8)
 *  서버 점검기(RequirementChecker, POST /api/v1/verify)가 완성된 일정을 시리즈 → 연전 기간 → 날짜별 경기로 풀어 요구 사항마다 다시 센 것을 보여 준다.
 *  엔진 점수와는 따로 세므로, 점수 공식이 틀려도 여기서 잡힌다. 화면은 「검증 완료」 배지가 아니라 사람이 다시 셀 수 있는 근거(원자료)를 보여 준다.
 *   - 요약 줄(현재 결과 분석 맨 위, P.verify.summary): 지킨 개수 또는 어긴 항목 이름 + 「서버가 … 다시 세어 판정했습니다 · 시각」
 *   - 점검표: 묶음별 체크리스트(짧은 제목 + 밑 줄 설명 / 정한 값과 출처 / 결과). 줄을 펼치면 근거 표, 날짜를 누르면 달력의 그 날로.
 *     다 지킨 묶음은 접힘, 어긴 묶음은 펼침.
 *   - 날짜별 출전표(시즌 전체 · 특별 경기 날만 · 휴식일만), 「아무 날 골라 보기」(무작위 하루의 5경기·10구단), 「엑셀로 받기」(출전표·근거 표)
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
  /** 일정의 지문: 시리즈 수 + 배정. 실행 뒤 경기를 옮겼는지 본다 */
  V.planSig = (st) => st.matches.length + ':' + st.plan.map((x) => x.calendar).join(',');
  /** 결과·버전에 남길 몫: 근거 원자료(tables)는 크니까 뺀다 */
  V.slim = (v) => { if (!v) return null; const o = Object.assign({}, v); delete o.tables; return o; };
  /** 실행이 끝날 때 받은 점검표(원자료 포함)를 이 화면의 값으로 삼는다 */
  V.took = (v, st) => { V.data = v; V.at = v.checkedAt; V.sig = V.planSig(st); V.error = null; V.offline = false; V.day = null; V.gopen = {}; V.open = {}; };
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
    const st = app().state, v = res && res.verification, changed = !!(res && res.planSig && res.planSig !== V.planSig(st));
    let cls, head, note;
    if (!v || v.error) { cls = 'none'; head = '요구 사항 점검 없음'; note = v && v.error ? v.error : res && res.engine && res.engine !== 'REST' ? '서버에 연결되지 않아 시험 엔진으로 낸 결과입니다. 서버 엔진으로 실행하면 서버가 요구 사항을 다시 셉니다.' : '이 결과에는 서버 점검표가 없습니다. 점검표에서 지금 일정을 서버에 다시 물을 수 있습니다.'; }
    else if (v.failed) { cls = 'bad'; head = '요구 사항 ' + v.failed + '개 어김 — ' + (v.failedTitles || []).join(' · '); note = METHOD + ' · ' + when(v.checkedAt); }
    else { cls = 'ok'; head = '요구 사항 ' + v.total + '개 모두 지킴' + (v.info ? ' · 참고 ' + v.info + '개' : ''); note = METHOD + ' · ' + when(v.checkedAt); }
    if (changed) note += ' · 실행 뒤 일정을 고쳤습니다 — 점검표에서 지금 일정을 다시 셉니다';
    return '<div class="pf-sec pf-vsum ' + cls + '"><div class="pf-vsum-row">' + (cls === 'none' ? '<span class="pf-vic none">' + icon('todo') + '</span>' : verdictIcon(cls === 'bad' ? FAIL : PASS)) + '<b>' + esc(head) + '</b><button class="pf-link" data-act="go-step" data-step="8">점검표 보기 ›</button></div><div class="xs muted">' + esc(note) + '</div></div>';
  };
  /** 실행 결과 비교 표의 「요구 사항」 칸 */
  V.cell = function (v) {
    if (!v || v.error) return '<span class="muted small">점검 없음</span>';
    return v.failed ? '<span class="pf-tag over">' + v.failed + '개 어김</span> <span class="small">' + (v.total - v.failed) + '/' + v.total + '</span>' : '<span class="pf-tag ok">' + v.total + '/' + v.total + ' 지킴</span>';
  };

  // ───────── 서버에 묻기 ─────────
  /** 지금 일정으로 서버에 점검을 청한다(이미 같은 일정의 점검표가 있으면 그대로) */
  function ensure(force) {
    const st = app().state, sig = V.planSig(st);
    if (V.loading) return;
    if (!force && V.data && V.sig === sig) return;
    if (!fromRest()) {
      // 서버 없음: 실행 때 받아 둔 것(판정·근거 줄)이라도 보여 주되, 지금 일정과 다르면 그 사실을 적는다
      const res = st.meta.result;
      if (!V.data && res && res.verification && !res.verification.error) { V.data = res.verification; V.at = res.verification.checkedAt; V.sig = res.planSig || null; }
      V.offline = true; V.error = null;
      return;
    }
    V.loading = true; V.error = null; V.offline = false;
    const plan = st.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
    app().engine.verify(st, plan).then((v) => {
      V.loading = false;
      if (!v || v.error) { V.error = (v && v.error) || '점검표를 받지 못했습니다.'; }
      else { V.data = v; V.at = v.checkedAt; V.sig = sig; V.day = null; V.gopen = {}; V.open = {}; }
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

  // ───────── 화면 ─────────
  S.steps[8] = {
    render() {
      const st = app().state, res = st.meta.result, v = V.data, sig = V.planSig(st), stale = v && V.sig && V.sig !== sig;
      const status = V.loading ? '<span class="pf-tag blue">지금 일정을 서버가 다시 세는 중…</span>' : V.error ? '<span class="pf-tag over">점검 못 함</span> <span class="small">' + esc(V.error) + '</span>' : V.offline ? '<span class="pf-tag est">서버 점검을 할 수 없음</span> <span class="small muted">서버에 연결되지 않았습니다' + (v ? ' · 아래는 ' + when(V.at) + '에 받아 둔 점검표' + (stale ? '(그 뒤 일정을 고쳤습니다)' : '') : '') + '</span>' : v ? '<span class="small muted">' + METHOD + ' · ' + when(V.at) + (stale ? ' · <b>그 뒤 일정을 고쳤습니다</b>' : '') + '</span>' : '';
      const tools = '<span class="grow"></span>' + (fromRest() ? '<button class="btn sm" data-act="vf-again"' + (V.loading ? ' disabled' : '') + '>' + icon('redo') + '지금 일정 다시 점검</button>' : '') + (v && v.tables ? '<button class="btn sm" data-act="vf-xlsx">' + icon('download') + '엑셀로 받기</button>' : '');
      let head;
      if (!v) head = '<div class="pf-sec pf-vsum none"><div class="pf-vsum-row"><span class="pf-vic none">' + icon('todo') + '</span><b>' + (V.loading ? '점검표를 받는 중' : '점검표가 없습니다') + '</b>' + tools + '</div><div class="xs">' + status + '</div></div>';
      else head = '<div class="pf-sec pf-vsum ' + (v.failed ? 'bad' : 'ok') + '"><div class="pf-vsum-row">' + verdictIcon(v.failed ? FAIL : PASS) + '<b>' + (v.failed ? '요구 사항 ' + v.failed + '개 어김 — ' + esc((v.failedTitles || []).join(' · ')) : '요구 사항 ' + v.total + '개 모두 지킴') + '</b>' + (v.info ? '<span class="pf-tag got">참고 ' + v.info + '개 · 정한 값이 없어 숫자만</span>' : '') + tools + '</div><div class="xs">' + status + '</div></div>';
      const list = v ? '<div class="pf-sec pf-vlist"><h3>점검표<span class="r">' + (v.passed || 0) + ' 지킴 · ' + (v.failed || 0) + ' 어김 · ' + (v.info || 0) + ' 참고</span></h3><p class="pf-d">묶음을 누르면 항목이, 「근거」를 누르면 서버가 일정에서 뽑은 줄이 보입니다. 다 지킨 묶음은 접혀 있습니다.</p>' + (v.groups || []).map(groupHtml).join('') + '</div>'
        : '<div class="pf-sec pf-vlist"><h3>점검표</h3><p class="pf-d">' + (V.offline ? '서버에 연결되면 지금 일정을 다시 셉니다. 서버 엔진으로 실행한 결과에는 실행이 끝날 때 받은 점검표가 함께 남습니다.' : V.error ? '서버가 점검표를 주지 못했습니다.' : '잠시만 기다려 주세요.') + '</p>' + (!res ? '<p class="pf-d">아직 실행한 결과가 없습니다.</p>' : '') + '</div>';
      const right = v && v.tables ? dayHtml(v) + gridHtml(v) : '';
      return '<div class="stepview no-band"><div class="pf-page pf-vf">' + head + '<div class="pf-cols pf-vcols">' + list + '<div class="pf-vright">' + right + '</div></div></div></div>';
    },
    after() { ensure(false); }
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
    'vf-xlsx': () => { if (V.data && V.data.tables) xlsx(V.data); }
  });
  /** 점검용 주소 demo=verify: 서버 없이 점검 화면을 본다 — run27 결과에 보여주는 문의 저장된 점검표(2025 기본 결과)를 얹는다. 날짜는 2025 것이라 달력 이동은 맞지 않는다 */
  S.demos.verify = function () {
    S.demos.run27();
    const go = () => fetch('show/fixtures/result-default.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.verification) return;
      V.took(j.verification, app().state); V.offline = true;
      V.gopen.special = true; V.open.opening = true; // 점검 화면 그림에 펼친 묶음·근거 표가 보이게
      const slim = V.slim(j.verification), sig = V.planSig(app().state);
      app().store.commit('점검용 점검표', (s) => { if (s.meta.result) { s.meta.result.verification = slim; s.meta.result.planSig = sig; s.meta.result.engine = 'REST'; } }, { tags: ['meta'], undo: false });
      S.scheduleRender();
    }).catch(() => { /* 없으면 서버 없음 화면 */ });
    if (typeof fetch === 'function') go();
  };
})();
