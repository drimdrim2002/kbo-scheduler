/*
 * 편성 스튜디오 — 날짜 단위 재편성: 공통 부품 (요구 docs/RESCHEDULE_DAILY_REQUIREMENTS.md §7·§9·§10, 설계 docs/RESCHEDULE_DAILY_ENGINE_DESIGN.md §5)
 *  데이터: 고른 1차 편성 버전(계획 흐름의 저장 버전) → 그 버전으로 만든 문제(취소 표시 + 배정 대상 + 기간·조건) → 결과(서버 또는 브라우저, 같은 모양).
 *  그림 부품: 버전 고르기 · 취소 경기 달력 · 그날 경기 · 기간·조건 · 기준 순서 · 실행 · 구단×날짜 표 · 날짜별 경기 · 평가 숫자 · 못 넣은 경기 · 엑셀.
 *  화면 배치는 reschedule-view.js가 정한다(대안마다 다름). 화면 글에는 경기 id·점수 단계 이름을 쓰지 않는다.
 *  못 넣은 이유·구단 상한·고칠 곳·브라우저 결과 안내 문장은 서버와 글자까지 맞춘 것이라 그대로 보인다(고쳐 쓰면 서버와 어긋난다).
 *  저장: project.reschedule { version, games(취소 표시), start, end, 조건, order, plan(발표 고정), result }. 결과에는 그때 배정 대상과 조건 지문(sig)을 함께 둔다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const params = new URLSearchParams(location.search);
  if (params.get('selftest') === '1' || params.get('classic') === '1') return; // 계획 흐름(plan-flow.js)의 저장 버전을 쓴다
  const { KBO, esc, icon, fmt } = S;
  const { Dates, SeasonGames, Xlsx } = KBO;
  const RD = KBO.RescheduleDaily;
  const app = () => S.app;
  const PF = () => S.planFlow;
  const YEAR = 2027;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const R = S.rs = { YEAR, ui: { view: 'grid', date: null, month: null, team: '', dayReason: 'RAIN' } };

  // ───────── 글 ─────────
  const CRIT = {
    lastDay: { name: '마지막 경기일 맞추기', desc: '가장 늦게 끝나는 구단과 가장 먼저 끝나는 구단의 차이' },
    fairness: { name: '이동 공정성', desc: '구단별 이동 횟수·거리의 차이(1차 편성 포함 144경기)' },
    addedDistance: { name: '늘어나는 이동 거리', desc: '재편성으로 더 움직이는 거리의 합' },
    monday: { name: '월요일 경기 줄이기', desc: '재편성 기간의 월요일 경기 수' },
    doubleHeader: { name: '더블헤더 줄이기', desc: '재편성 기간의 더블헤더 수' }
  };
  R.CRIT = CRIT;
  R.REASONS = SeasonGames.REASONS;
  const md = (iso) => (iso ? Number(iso.slice(5, 7)) + '/' + Number(iso.slice(8, 10)) : '');
  const wd = (iso) => WD[Dates.weekday(Dates.dayNum(iso))];
  const mdw = (iso) => md(iso) + '(' + wd(iso) + ')';
  const num = (v, d) => Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  R.md = md; R.mdw = mdw; R.num = num;
  const rs = () => app().state.reschedule;

  // ───────── 버전 · 문제 ─────────
  /** 고를 수 있는 1차 편성 버전: 2027에 저장한 것 중 꼭 지킬 규칙을 지킨 것 */
  R.versions = () => (PF() ? PF().versions.all(YEAR).filter((v) => v.feasible !== false) : []);
  R.version = () => { const id = rs().version; return id && PF() ? PF().versions.get(YEAR, id) : null; };
  R.versionTag = (v) => (PF() && PF().final.id(YEAR) === v.id ? '<span class="pf-tag ok">확정</span>' : v.engine && v.engine !== 'REST' && !v.builtin ? '<span class="pf-tag est">시험 엔진</span>' : '');

  const memo = { base: null, prob: null, model: null, cross: null };
  function hash(text) { let h = 5381; for (let i = 0; i < text.length; i++) h = (h * 33 + text.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  /** 그 버전을 적용한 프로젝트와 1차 편성 경기(취소 표시 없음) */
  function baseOf(v) {
    const key = v.id + '|' + (v.ranAt || v.savedAt || '');
    if (memo.base && memo.base.key === key) return memo.base;
    const p = JSON.parse(JSON.stringify(app().state));
    delete p.snapshots;
    p.meta = { name: p.meta.name, season: p.meta.season, schemaVersion: p.meta.schemaVersion };
    PF().applyVersion(p, v);
    p.games = [];
    const games = SeasonGames.computeGames(p);
    const byDate = new Map();
    for (const g of games) { if (!byDate.has(g.date)) byDate.set(g.date, []); byDate.get(g.date).push(g); }
    const first = games.length ? games[0].date : null, last = games.length ? games[games.length - 1].date : null;
    memo.base = { key, p, games, byDate, first, last };
    return memo.base;
  }
  R.base = () => { const v = R.version(); return v ? baseOf(v) : null; };
  /** 1차 편성 경기 key(M:시리즈|날짜) → 취소 기록 */
  R.cancelMap = () => { const m = new Map(); for (const g of rs().games || []) if (g.match != null) m.set('M:' + g.match + '|' + g.date, g); return m; };

  /**
   * 실행할 문제(서버 /api/v1/solve mode=RESCHEDULE의 problem). 조건이 같으면 다시 만들지 않는다.
   * 반환 { sig, problem, targets(buildTargets 결과), error(실행할 수 없는 이유 — 그대로 보일 글) }
   */
  R.problem = function () {
    const v = R.version();
    if (!v) return null;
    const st = rs();
    const raw = JSON.stringify([v.id, v.ranAt || v.savedAt || '', st.games, st.start, st.end, st.lastDayToleranceDays, st.maxConsecutiveDays, st.maxDoubleHeadersPerTeam, st.order, st.plan]);
    if (memo.prob && memo.prob.raw === raw) return memo.prob;
    const b = baseOf(v);
    const p = JSON.parse(JSON.stringify(b.p));
    p.games = JSON.parse(JSON.stringify(st.games || []));
    p.reschedule = { start: st.start, end: st.end, lastDayToleranceDays: st.lastDayToleranceDays, maxConsecutiveDays: st.maxConsecutiveDays, maxDoubleHeadersPerTeam: st.maxDoubleHeadersPerTeam, order: st.order.slice(), plan: JSON.parse(JSON.stringify(st.plan || [])) };
    const t = SeasonGames.buildTargets(p);
    p.reschedule.targets = t.targets;
    let error = null;
    if (!t.ok) error = '잔여 경기의 홈을 홈 73/71 원칙대로 나눌 수 없어 실행하지 않습니다. ' + t.message;
    else { try { RD.parse(p); } catch (e) { error = e.message; } }
    memo.prob = { raw, sig: hash(raw), problem: p, targets: t, error };
    return memo.prob;
  };
  /** 지금 버전으로 낸 결과(다른 버전 결과는 null) */
  R.result = () => { const r = rs().result; return r && r.version && r.version === rs().version ? r : null; };
  /** 결과를 낸 뒤 취소 표시·기간·조건을 바꿨는가 */
  R.stale = (r) => { const pr = R.problem(); return !!(pr && r && r.sig !== pr.sig); };
  R.running = () => { const x = app().rsRun; return !!(x && (x.status === 'STARTING' || x.status === 'RUNNING' || x.status === 'PAUSED')); };

  // ───────── 결과 모형 (표·목록·엑셀이 같이 쓴다) ─────────
  /**
   * { teams, days[{ date, day, monday, lead }], cells[t][k] = [{ opp, home, dh, re, cancelled, fixed }], runs[t][k], last[t](date),
   *   games[{ date, home, away, stadium, kind 'first'|'re', cancelled, reason, source, orig, dh, fixed }], placed, unplaced[] }
   * 표의 앞쪽 lead일은 1차 편성 마지막 주(연속 경기일이 이어지는 것을 보이려고)
   */
  R.model = function (r) {
    const b = R.base();
    if (!b || !r) return null;
    const key = (r.at || '') + '|' + b.key + '|' + JSON.stringify(rs().games);
    if (memo.model && memo.model.key === key) return memo.model.m;
    const teams = b.p.teams.map((t) => t.name), idx = new Map(teams.map((n, i) => [n, i]));
    const stadium = new Map(b.p.teams.map((t) => [t.name, t.stadium]));
    const cmap = R.cancelMap();
    const tById = new Map((r.targets || []).map((t) => [t.id, t]));
    const games = [];
    for (const g of b.games) { const c = cmap.get(g.key); games.push({ date: g.date, home: g.home, away: g.away, stadium: g.stadium, kind: 'first', cancelled: !!c, reason: c ? c.reason : null }); }
    const unplaced = [];
    let placed = 0;
    for (const x of r.plan || []) {
      const t = tById.get(x.game);
      if (!t) continue;
      if (x.date == null) { unplaced.push(t); continue; }
      placed++;
      games.push({ date: x.date, home: t.home, away: t.away, stadium: stadium.get(t.home) || '', kind: 're', cancelled: false, source: t.source, orig: t.date || null, reason: t.reason || null, dh: !!x.doubleHeader, fixed: !!x.fixed, played: !!x.played });
    }
    games.sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : (a.kind === c.kind ? 0 : a.kind === 'first' ? -1 : 1)));
    const p0 = Dates.dayNum(r.period.start), p1 = Dates.dayNum(r.period.end), LEAD = 7;
    const s0 = Dates.dayNum(b.first);
    const days = [];
    for (let d = p0 - LEAD; d <= p1; d++) { const iso = Dates.isoDate(d); days.push({ date: iso, day: d, monday: Dates.weekday(d) === 1, lead: d < p0 }); }
    const N = teams.length, K = days.length;
    const cells = teams.map(() => days.map(() => []));
    const played = teams.map(() => new Map()); // 날짜 → 경기함(취소 아닌 것)
    for (const g of games) {
      const h = idx.get(g.home), a = idx.get(g.away), d = Dates.dayNum(g.date);
      if (!g.cancelled) { played[h].set(d, true); played[a].set(d, true); }
      const k = d - (p0 - LEAD);
      if (k < 0 || k >= K) continue;
      cells[h][k].push({ opp: g.away, home: true, dh: !!g.dh, re: g.kind === 're', cancelled: g.cancelled, fixed: !!g.fixed });
      cells[a][k].push({ opp: g.home, home: false, dh: !!g.dh, re: g.kind === 're', cancelled: g.cancelled, fixed: !!g.fixed });
    }
    const runs = teams.map(() => new Array(K).fill(0)), last = new Array(N).fill(null), maxRun = new Array(N).fill(0), dhs = new Array(N).fill(0);
    for (let t = 0; t < N; t++) {
      let run = 0;
      for (let d = s0; d <= p1; d++) {
        run = played[t].get(d) ? run + 1 : 0;
        const k = d - (p0 - LEAD);
        if (k >= 0) { runs[t][k] = run; if (k >= LEAD) maxRun[t] = Math.max(maxRun[t], run); }
        if (played[t].get(d)) last[t] = Dates.isoDate(d);
      }
    }
    for (const g of games) if (g.kind === 're' && g.dh) { dhs[idx.get(g.home)] += 0.5; dhs[idx.get(g.away)] += 0.5; }
    const m = { teams, days, cells, runs, last, maxRun, dhs: dhs.map((x) => Math.round(x)), games, placed, unplaced, lead: LEAD, period: r.period, limit: rs().maxConsecutiveDays };
    memo.model = { key, m };
    return m;
  };

  /** 화면에서 다시 채점해 결과의 점수와 다르면 오류(설계 §6.4의 6). 결과마다 한 번 */
  R.crossCheck = function (r) {
    if (!r || !r.scoreString || R.stale(r)) return;
    const key = (r.at || '') + r.scoreString;
    if (memo.cross === key) return;
    memo.cross = key;
    const why = RD.crossCheck(R.problem().problem, r);
    if (why) console.error(why);
  };

  // ───────── 입력 부품 ─────────
  /** 버전 고르기 */
  R.versionPicker = function () {
    const list = R.versions(), cur = R.version();
    if (!list.length) return '<div class="rs-empty"><b>고를 1차 편성 버전이 없습니다</b><span>운영 방침·실행에서 실행하면 결과가 버전으로 저장됩니다. 꼭 지킬 규칙을 모두 지킨 버전만 고를 수 있습니다.</span><button class="btn" data-act="pf-stage" data-stage="2">운영 방침·실행으로</button></div>';
    return '<label class="rs-vpick"><span class="rs-lab">1차 편성 버전</span><select class="select" data-in="rs-version" aria-label="1차 편성 버전">' + (cur ? '' : '<option value="">버전을 고르세요</option>') +
      list.map((v) => '<option value="' + esc(v.id) + '"' + (cur && cur.id === v.id ? ' selected' : '') + '>' + esc(v.name) + (PF().final.id(YEAR) === v.id ? ' (확정)' : '') + '</option>').join('') + '</select>' + (cur ? R.versionTag(cur) : '') + '</label>';
  };

  /** 취소 표시 달력(한 달). 날을 누르면 그날 경기가 옆(또는 아래)에 나온다 */
  R.months = function () {
    const b = R.base();
    if (!b) return [];
    const out = [];
    for (let m = Number(b.first.slice(5, 7)); m <= Number(b.last.slice(5, 7)); m++) out.push(m);
    return out;
  };
  R.curMonth = function () {
    const ms = R.months(), u = R.ui;
    if (u.date) { const m = Number(u.date.slice(5, 7)); if (ms.includes(m)) u.month = m; }
    if (!ms.includes(u.month)) u.month = ms.length ? ms[ms.length - 1] : null;
    return u.month;
  };
  R.cancelCalendar = function (opts) {
    const o = opts || {}, b = R.base();
    if (!b) return '';
    const mo = R.curMonth(), cm = R.cancelMap(), y = Number(b.first.slice(0, 4));
    const per = new Map();
    for (const c of cm.values()) per.set(c.date, (per.get(c.date) || 0) + 1);
    let s = '<div class="rs-cal' + (o.big ? ' big' : '') + '"><div class="rs-mtabs" role="tablist">' + R.months().map((m) => {
      const n = Array.from(cm.values()).filter((c) => Number(c.date.slice(5, 7)) === m).length;
      return '<button role="tab" class="' + (m === mo ? 'on' : '') + '" data-act="rs-month" data-m="' + m + '">' + m + '월' + (n ? '<span class="rs-cn">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div><div class="rs-grid7">' + ['월', '화', '수', '목', '금', '토', '일'].map((x) => '<div class="hd">' + x + '</div>').join('');
    const first = Dates.dayNum(y + '-' + String(mo).padStart(2, '0') + '-01'), lead = (Dates.weekday(first) + 6) % 7;
    for (let k = 0; k < 42; k++) {
      const d = first - lead + k, iso = Dates.isoDate(d), inMo = Number(iso.slice(5, 7)) === mo;
      if (k >= 35 && !inMo) break;
      const list = inMo ? b.byDate.get(iso) || [] : [], n = per.get(iso) || 0;
      const cls = 'rs-d' + (inMo ? '' : ' out') + (list.length ? ' has' : '') + (n ? ' cx' : '') + (R.ui.date === iso ? ' sel' : '');
      s += list.length ? '<button class="' + cls + '" data-act="rs-day" data-date="' + iso + '" aria-label="' + esc(mdw(iso) + ' 경기 ' + list.length + (n ? ' · 취소 ' + n : '')) + '"><span class="dn">' + Number(iso.slice(8, 10)) + '</span>' + (n ? '<span class="rs-x">취소 ' + n + '</span>' : '<span class="rs-g">' + list.length + '경기</span>') + '</button>'
        : '<div class="' + cls + '"><span class="dn">' + (inMo ? Number(iso.slice(8, 10)) : '') + '</span></div>';
    }
    return s + '</div></div>';
  };
  /** 그날 1차 편성 경기: 경기마다 「취소」 단추와 사유 */
  R.dayGames = function () {
    const b = R.base(), date = R.ui.date;
    if (!b) return '';
    if (!date || !b.byDate.has(date)) return '<div class="rs-hint">달력에서 날짜를 누르면 그날 경기가 나옵니다. 열리지 못한 경기에 「취소」를 누르고 사유를 고릅니다.</div>';
    const list = b.byDate.get(date), cm = R.cancelMap();
    const reasonSel = (key, cur, act) => '<select class="select sm" data-in="' + act + '"' + (key ? ' data-key="' + esc(key) + '"' : '') + ' aria-label="취소 사유">' + Object.keys(R.REASONS).map((k) => '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + R.REASONS[k] + '</option>').join('') + '</select>';
    let s = '<div class="rs-day"><div class="rs-day-h"><b>' + esc(mdw(date)) + ' 경기 ' + list.length + '</b><span class="rs-day-all">그날 모두 ' + reasonSel(null, R.ui.dayReason, 'rs-dayreason') + '<button class="btn sm" data-act="rs-day-all" data-v="1">모두 취소</button><button class="btn sm ghost" data-act="rs-day-all" data-v="0">모두 풀기</button></span></div><table class="rs-gt"><tbody>';
    for (const g of list) {
      const c = cm.get(g.key);
      s += '<tr class="' + (c ? 'cx' : '') + '"><td><span class="v">' + S.team(g.away) + ' <span class="muted">vs</span> ' + S.team(g.home) + '</span><span class="stad">' + esc(g.stadium) + '</span></td>' +
        '<td class="r">' + (c ? reasonSel(g.key, c.reason, 'rs-reason') + '<button class="btn sm ghost" data-act="rs-cancel" data-key="' + esc(g.key) + '" data-v="0">취소 풀기</button>' : '<button class="btn sm" data-act="rs-cancel" data-key="' + esc(g.key) + '" data-v="1">' + icon('x') + '취소</button>') + '</td></tr>';
    }
    return s + '</tbody></table></div>';
  };
  /** 표시한 취소 경기 목록 */
  R.cancelList = function (opts) {
    const o = opts || {}, b = R.base();
    if (!b) return '';
    const st = app().state, list = (rs().games || []).filter((g) => g.match != null).slice().sort((a, c) => (a.date < c.date ? -1 : a.date > c.date ? 1 : a.match - c.match));
    if (!list.length) return '<div class="rs-hint">아직 표시한 취소 경기가 없습니다.</div>';
    const m = b.p.matches;
    let s = '<ul class="rs-clist' + (o.compact ? ' compact' : '') + '">';
    for (const g of list) {
      const x = m[g.match];
      if (!x) continue;
      s += '<li><span class="d">' + esc(mdw(g.date)) + '</span><span class="v">' + S.team(x.away) + ' <span class="muted">vs</span> ' + S.team(x.home) + '</span><span class="why">' + esc(R.REASONS[g.reason] || '') + '</span><button class="btn sm icon ghost" data-act="rs-cancel" data-key="' + esc('M:' + g.match + '|' + g.date) + '" data-v="0" title="취소 풀기" aria-label="취소 풀기">' + icon('x') + '</button></li>';
    }
    void st;
    return s + '</ul>';
  };
  /** 배정할 경기 수와 실행할 수 없는 이유 */
  R.targetSummary = function () {
    const pr = R.problem();
    if (!pr) return '';
    const t = pr.targets;
    return '<div class="rs-sum"><span class="rs-sum-n"><b>' + (t.cancelled + t.remaining) + '경기</b> 배정</span><span class="muted">취소 ' + t.cancelled + ' + 잔여 ' + t.remaining + '</span></div>' +
      (pr.error ? '<div class="pf-note warn rs-err">' + icon('warn') + ' ' + esc(pr.error) + '</div>' : '');
  };
  /** 배정할 경기 표(실행 전 오른쪽): 구단마다 취소·잔여·그중 홈 */
  R.targetTable = function () {
    const pr = R.problem();
    if (!pr) return '';
    const t = pr.targets, by = t.summary.byTeam;
    const home = new Map(), cx = new Map();
    for (const x of t.targets) { home.set(x.home, (home.get(x.home) || 0) + 1); if (x.source === 'CANCELLED') for (const n of [x.home, x.away]) cx.set(n, (cx.get(n) || 0) + 1); }
    let s = '<table class="rs-mt rs-tt"><thead><tr><th>구단</th><th>취소 경기</th><th>잔여 경기</th><th>배정할 경기</th><th>그중 홈</th></tr></thead><tbody>';
    for (const b of by) s += '<tr><td>' + S.team(b.team) + '</td><td>' + (cx.get(b.team) || 0) + '</td><td>' + b.remaining + '</td><td><b>' + ((cx.get(b.team) || 0) + b.remaining) + '</b></td><td>' + (home.get(b.team) || 0) + '</td></tr>';
    s += '</tbody><tfoot><tr><td>리그</td><td>' + t.cancelled + '</td><td>' + t.remaining + '</td><td>' + (t.cancelled + t.remaining) + '</td><td></td></tr></tfoot></table>';
    const ht = t.summary.homeTotals;
    return s + '<div class="rs-sub">잔여 경기는 두 구단이 16경기씩 맞붙도록 남은 경기입니다. 홈은 ' + (ht ? '홈 73/71 원칙(' + esc((app().state.settings.homeTotals.moreTeams || []).join('·')) + ' 홈 73)대로' : '그 구단쌍에서 홈이 적은 쪽으로') + ' 나눴고, 취소 경기는 원래 홈 그대로입니다.</div>';
  };
  /** 기간 */
  R.periodForm = function () {
    const st = rs(), b = R.base();
    const min = b ? Dates.isoDate(Dates.dayNum(b.last) + 1) : '';
    return '<div class="rs-form"><label><span class="rs-lab">시작일</span><input class="input sm" type="date" data-in="rs-date" data-k="start" value="' + esc(st.start || '') + '"' + (min ? ' min="' + min + '"' : '') + '></label>' +
      '<label><span class="rs-lab">마감일</span><input class="input sm" type="date" data-in="rs-date" data-k="end" value="' + esc(st.end || '') + '"' + (min ? ' min="' + min + '"' : '') + '></label>' +
      '<span class="rs-sub">시작일 기본값은 1차 편성 마지막 날(' + esc(b ? mdw(b.last) : '-') + ')의 다음 날 · ' + (st.start && st.end && st.end >= st.start ? (Dates.dayNum(st.end) - Dates.dayNum(st.start) + 1) + '일' : '') + '</span></div>';
  };
  /** 꼭 지키는 값 */
  R.limitsForm = function () {
    const st = rs();
    const f = (k, label, unit, min, max, sub) => '<label><span class="rs-lab">' + label + '</span><span class="rs-numf"><input class="input sm" type="number" min="' + min + '" max="' + max + '" step="1" data-in="rs-num" data-k="' + k + '" value="' + esc(String(st[k])) + '">' + unit + '</span>' + (sub ? '<span class="rs-sub">' + sub + '</span>' : '') + '</label>';
    return '<div class="rs-form">' + f('maxConsecutiveDays', '연속 경기일 상한', '일', 1, 60, '쉬는 날 없이 이어서 경기하는 날 수 · 꼭 지킴') + f('maxDoubleHeadersPerTeam', '더블헤더 상한', '번', 0, 30, '구단마다 · 0이면 더블헤더 없음') + f('lastDayToleranceDays', '마지막 경기일 허용', '일', 0, 60, '구단별 마지막 경기일 차이가 이 안이면 됨') + '</div>';
  };
  /** 기준 순서(위가 먼저) + 이동 허용 차이(그 버전의 운영 방침) */
  R.orderForm = function () {
    const st = rs(), v = R.version(), ob = (v && v.objective) || {};
    let s = '<ol class="rs-order">';
    st.order.forEach((k, i) => {
      s += '<li><span class="rk">' + (i + 1) + '</span><span class="nm"><b>' + esc(CRIT[k].name) + '</b><span>' + esc(CRIT[k].desc) + '</span></span><span class="mv"><button class="btn sm icon ghost" data-act="rs-ord" data-k="' + k + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="위로">' + icon('up') + '</button><button class="btn sm icon ghost" data-act="rs-ord" data-k="' + k + '" data-d="1"' + (i === st.order.length - 1 ? ' disabled' : '') + ' aria-label="아래로">' + icon('down') + '</button></span></li>';
    });
    s += '</ol><div class="rs-sub">이동 공정성의 허용 차이: 이동 횟수 ' + num(ob.moveGap != null ? ob.moveGap : 4) + '회 · 이동 거리 ' + num(ob.distanceGapKm != null ? ob.distanceGapKm : 600) + 'km — 고른 버전의 운영 방침 값</div>';
    return s;
  };
  /** 실행 단추 · 진행 */
  R.runBox = function () {
    const pr = R.problem(), x = app().rsRun, run = R.running();
    const offline = app().engineConfig.kind !== 'REST';
    if (run) {
      const sec = Math.round((Date.now() - x.startedAt) / 1000);
      return '<div class="rs-run on"><span class="rs-spin" aria-hidden="true"></span><span><b>날짜마다 넣는 중</b> · ' + sec + '초' + (x.queue && x.queue.position ? ' · 앞에 ' + x.queue.position + '개 기다림' : '') + '</span><button class="btn" data-act="rs-stop">멈추고 이 결과 쓰기</button></div>';
    }
    const dis = !pr || !!pr.error;
    return '<div class="rs-run"><button class="btn primary" data-act="rs-run"' + (dis ? ' disabled' : '') + '>' + icon('play') + '재편성 실행</button>' +
      '<span class="rs-sub">' + (offline ? '인터넷 연결이 없어 이 컴퓨터에서 간단하게 짭니다(약 10초)' : '서버에서 짭니다(약 10초)') + '</span></div>';
  };

  // ───────── 결과 부품 ─────────
  /** 결과 머리: 브라우저 결과 안내, 조건이 바뀐 결과, 규칙 위반 */
  R.resultNotes = function (r) {
    let s = '';
    if (r.engine === 'browser' && r.notice) s += '<div class="pf-note warn rs-notice">' + icon('warn') + ' ' + esc(r.notice) + '</div>';
    if (R.stale(r)) s += '<div class="pf-note blue">' + icon('info') + ' 이 결과를 낸 뒤 취소 경기·기간·조건을 바꿨습니다. 다시 실행하면 바꾼 대로 짭니다.</div>';
    if ((r.violations || []).length) s += '<div class="pf-note warn"><b>꼭 지킬 규칙을 어긴 곳 ' + r.violations.length + '곳</b>' + r.violations.slice(0, 6).map((v) => '<div>' + esc(v.text || '') + '</div>').join('') + '</div>';
    return s;
  };
  /** 평가 숫자 타일(요약) */
  R.tiles = function (r) {
    const m = r.metrics, mo = R.model(r), total = mo.placed + mo.unplaced.length;
    const tile = (k, v, sub, cls) => '<div class="rs-tile' + (cls ? ' ' + cls : '') + '"><span class="k">' + k + '</span><b>' + v + '</b><span class="s">' + sub + '</span></div>';
    const f = m.fairness;
    return '<div class="rs-tiles">' +
      tile('넣은 경기', mo.placed + ' / ' + total, mo.unplaced.length ? '못 넣은 경기 ' + mo.unplaced.length : '모두 넣음', mo.unplaced.length ? 'bad' : 'ok') +
      tile('마지막 경기일 차이', m.lastDay.spreadDays + '일', '허용 ' + m.lastDay.toleranceDays + '일 · ' + (m.lastDay.within ? '안' : '넘음'), m.lastDay.within ? 'ok' : 'warn') +
      tile('이동 횟수 차이', f.movesSpread + '회', '허용 ' + num(f.moveGap) + '회 · 1차 ' + f.firstRoundMovesSpread + '회', f.movesSpread <= f.moveGap ? 'ok' : 'warn') +
      tile('이동 거리 차이', num(f.distanceSpreadKm, 1) + 'km', '허용 ' + num(f.distanceGapKm) + 'km · 1차 ' + num(f.firstRoundDistanceSpreadKm, 1) + 'km', f.distanceSpreadKm <= f.distanceGapKm ? 'ok' : 'warn') +
      tile('늘어난 이동 거리', num(m.addedDistance.totalKm, 1) + 'km', '10구단 합', '') +
      tile('월요일 경기', m.mondayGames + '경기', '재편성 기간', '') +
      tile('더블헤더', m.doubleHeaders.total + '번', '구단당 상한 ' + rs().maxDoubleHeadersPerTeam + '번', '') + '</div>';
  };
  /** 평가 숫자 자세히: 구단별 표 */
  R.metricsTable = function (r) {
    const m = r.metrics, f = m.fairness;
    const by = (arr, team) => arr.find((x) => x.team === team) || {};
    const teams = m.lastDay.byTeam.map((x) => x.team);
    const lastDates = m.lastDay.byTeam.map((x) => x.date).filter(Boolean).sort();
    const lo = lastDates[0], hi = lastDates[lastDates.length - 1];
    let s = '<table class="rs-mt"><thead><tr><th>구단</th><th>마지막 경기일</th><th>이동 횟수<span>144경기 · 1차</span></th><th>이동 거리<span>144경기 · 1차</span></th><th>늘어난 이동<span>재편성 부분</span></th><th>더블헤더</th></tr></thead><tbody>';
    for (const t of teams) {
      const ld = by(m.lastDay.byTeam, t).date, fa = by(f.byTeam, t), ad = by(m.addedDistance.byTeam, t), dh = by(m.doubleHeaders.byTeam, t);
      s += '<tr' + (R.ui.team === t ? ' class="on"' : '') + '><td>' + S.team(t) + '</td><td class="' + (ld && ld === hi ? 'hi' : ld && ld === lo ? 'lo' : '') + '">' + (ld ? esc(mdw(ld)) : '-') + '</td>' +
        '<td><b>' + fa.moves + '</b>회 <span class="muted">· ' + fa.firstRoundMoves + '</span></td><td><b>' + num(fa.distanceKm, 1) + '</b>km <span class="muted">· ' + num(fa.firstRoundDistanceKm, 1) + '</span></td>' +
        '<td>' + num(ad.km, 1) + 'km <span class="muted">· ' + ad.moves + '번 이동</span></td><td>' + (dh.count || 0) + '번</td></tr>';
    }
    s += '</tbody><tfoot><tr><td>차이</td><td>' + m.lastDay.spreadDays + '일 <span class="muted">허용 ' + m.lastDay.toleranceDays + '</span></td><td>' + f.movesSpread + '회 <span class="muted">허용 ' + num(f.moveGap) + '</span></td><td>' + num(f.distanceSpreadKm, 1) + 'km <span class="muted">허용 ' + num(f.distanceGapKm) + '</span></td><td>합 ' + num(m.addedDistance.totalKm, 1) + 'km</td><td>합 ' + m.doubleHeaders.total + '번</td></tr></tfoot></table>';
    s += '<div class="rs-sub">가장 늦게 끝나는 구단은 <b class="hi">진하게</b>, 가장 먼저 끝나는 구단은 <b class="lo">밑줄</b>로 표시합니다. 월요일 경기는 ' + m.mondayGames + '경기입니다.</div>';
    return s;
  };
  /** 못 넣은 경기 · 이유 · 구단 상한 · 고칠 곳(서버 문장 그대로) */
  R.unplacedBlock = function (r) {
    const un = r.unplaced || [];
    if (!un.length) return '<div class="rs-allin">' + icon('check') + ' 배정할 경기를 모두 기간 안에 넣었습니다.</div>';
    let s = '<div class="rs-un"><div class="rs-un-h"><b>못 넣은 경기 ' + un.length + '경기</b><span class="muted">들어가는 만큼만 넣었습니다. 엔진은 마감일·연속 경기일·더블헤더 상한을 스스로 풀지 않습니다.</span></div><ol>';
    for (const u of un) s += '<li><span class="v">' + S.team(u.away) + ' <span class="muted">vs</span> ' + S.team(u.home) + '</span><span class="t">' + esc(u.text) + '</span></li>';
    s += '</ol>';
    if ((r.teamLimits || []).length) s += '<div class="rs-un-sub"><b>구단별로 넣을 수 있는 경기 수</b>' + r.teamLimits.map((l) => '<div>' + esc(l.text) + '</div>').join('') + '</div>';
    if ((r.fixes || []).length) s += '<div class="rs-un-fix"><b>고칠 곳</b>' + r.fixes.map((x) => '<div>' + (x.confirmed ? '<span class="pf-tag ok">해 봄 · 모두 들어감</span> ' : '') + esc(x.text) + '</div>').join('') + '</div>';
    return s + '</div>';
  };

  /** 구단 × 날짜 표 */
  R.teamGrid = function (r) {
    const m = R.model(r);
    if (!m) return '';
    const lim = m.limit;
    let s = '<div class="rs-tg-wrap xy"><table class="rs-tg"><thead><tr><th class="tn" rowspan="2">구단</th>';
    let mo = null, span = 0;
    const heads = [];
    for (const d of m.days) { const k = Number(d.date.slice(5, 7)); if (k !== mo) { if (mo != null) heads.push([mo, span]); mo = k; span = 0; } span++; }
    heads.push([mo, span]);
    s += '<th class="grp lead" colspan="' + m.lead + '">1차 편성 마지막 주</th><th class="grp" colspan="' + (m.days.length - m.lead) + '">재편성 기간 ' + esc(md(m.period.start)) + '~' + esc(md(m.period.end)) + '</th>';
    s += '<th class="sm" rowspan="2">마지막<br>경기일</th><th class="sm" rowspan="2">최대<br>연속</th><th class="sm" rowspan="2">더블<br>헤더</th></tr><tr>';
    for (const d of m.days) s += '<th class="d' + (d.lead ? ' lead' : '') + (d.monday ? ' mon' : '') + (R.ui.date === d.date ? ' sel' : '') + '"><button class="rs-dh" data-act="rs-goto-day" data-date="' + d.date + '" title="' + esc(mdw(d.date)) + ' 경기 보기">' + esc(md(d.date)) + '<i>' + wd(d.date) + '</i></button></th>';
    s += '</tr></thead><tbody>';
    m.teams.forEach((t, ti) => {
      s += '<tr class="' + (R.ui.team === t ? 'on' : '') + '"><th class="tn"><button class="rs-tbtn" data-act="rs-team" data-v="' + esc(t) + '">' + S.team(t) + '</button></th>';
      m.days.forEach((d, k) => {
        const list = m.cells[ti][k], run = m.runs[ti][k], isLast = m.last[ti] === d.date;
        if (!list.length) { s += '<td class="rest' + (d.lead ? ' lead' : '') + (d.monday ? ' mon' : '') + '"></td>'; return; }
        const live = list.filter((x) => !x.cancelled), g = live[0] || list[0];
        const cls = ['g', g.home ? 'h' : 'a', d.lead ? 'lead' : '', d.monday ? 'mon' : '', live.length ? '' : 'cx', live.length > 1 || (g.dh && live.length) ? 'dh' : '', g.re ? 're' : '', run >= lim ? 'lim' : '', isLast ? 'last' : ''].filter(Boolean).join(' ');
        const tip = mdw(d.date) + ' · ' + (g.home ? '홈 ' : '원정 ') + g.opp + (live.length > 1 ? ' 더블헤더' : '') + (live.length ? '' : ' (취소)') + (live.length ? ' · 연속 ' + run + '일째' : '') + (isLast ? ' · 마지막 경기' : '');
        s += '<td class="' + cls + '" title="' + esc(tip) + '"><span class="o">' + esc(g.opp) + '</span>' + (live.length > 1 ? '<span class="x2">×2</span>' : '') + (live.length && run ? '<span class="rn">' + run + '</span>' : '') + '</td>';
      });
      s += '<td class="sm' + (m.last[ti] === m.last.slice().sort().pop() ? ' hi' : '') + '">' + (m.last[ti] ? esc(mdw(m.last[ti])) : '-') + '</td><td class="sm' + (m.maxRun[ti] >= lim ? ' lim' : '') + '">' + m.maxRun[ti] + '일</td><td class="sm">' + m.dhs[ti] + '</td></tr>';
    });
    s += '</tbody></table></div>';
    s += '<div class="rs-legend"><span><i class="h"></i>홈(진한 칸)</span><span><i class="a"></i>원정</span><span><i class="re"></i>재편성으로 넣은 경기(파란 테)</span><span><i class="dh"></i>더블헤더 ×2</span><span><i class="cx"></i>취소</span><span><i class="lim"></i>연속 경기일 상한(' + lim + '일)에 닿음</span><span>칸의 작은 숫자 = 연속 경기일 · 빈칸 = 휴식 · <b>|</b> = 마지막 경기</span></div>';
    return s;
  };

  /** 날짜별 경기(발표용 일정표 모양): 재편성 기간 */
  R.dayList = function (r, opts) {
    const o = opts || {}, m = R.model(r);
    if (!m) return '';
    const byDate = new Map();
    for (const g of m.games) if (g.kind === 're') { if (!byDate.has(g.date)) byDate.set(g.date, []); byDate.get(g.date).push(g); }
    let s = '<div class="rs-dl' + (o.cols ? ' cols' : '') + '">';
    for (const d of m.days) {
      if (d.lead) continue;
      const list = byDate.get(d.date) || [];
      const dhN = list.filter((g) => g.dh).length / 2;
      s += '<section class="rs-dl-day' + (list.length ? '' : ' none') + (R.ui.date === d.date ? ' sel' : '') + '" data-date="' + d.date + '"><h4><b>' + esc(Number(d.date.slice(5, 7)) + '월 ' + Number(d.date.slice(8, 10)) + '일') + '</b> <span class="w' + (d.monday ? ' mon' : '') + '">' + wd(d.date) + '요일</span>' + (list.length ? '<span class="n">' + list.length + '경기</span>' : '<span class="n muted">경기 없음</span>') + (d.monday && list.length ? '<span class="pf-tag est">월요일</span>' : '') + (dhN ? '<span class="pf-tag blue">더블헤더 ' + dhN + '</span>' : '') + '</h4>';
      if (list.length) {
        s += '<table><tbody>';
        const seen = new Set();
        for (const g of list) {
          const k = g.home + '-' + g.away;
          const second = g.dh && seen.has(k);
          seen.add(k);
          s += '<tr><td class="v">' + S.team(g.away) + ' <span class="muted">vs</span> ' + S.team(g.home) + (g.dh ? ' <span class="pf-tag blue">' + (second ? '2차전' : '1차전') + '</span>' : '') + '</td><td class="stad">' + esc(g.stadium) + '</td><td class="src">' + (g.source === 'CANCELLED' ? esc(mdw(g.orig)) + ' 취소 경기' + (g.reason ? ' · ' + esc(R.REASONS[g.reason] || '') : '') : '잔여 경기') + (g.fixed ? ' · 발표함' : '') + '</td></tr>';
        }
        s += '</tbody></table>';
      }
      s += '</section>';
    }
    return s + '</div>';
  };

  // ───────── 엑셀 ─────────
  /** 시트: 날짜별 경기(1차 + 재편성) · 구단별 출전표(날짜 × 구단, 마감일까지) · 평가 숫자 · 못 넣은 경기 */
  R.xlsxSheets = function (r) {
    const m = R.model(r), v = R.version();
    const sheet1 = [['날짜', '요일', '원정', '홈', '구장', '구분', '상태', '더블헤더']];
    for (const g of m.games) {
      sheet1.push([{ date: g.date }, wd(g.date), g.away, g.home, g.stadium,
        g.kind === 'first' ? '1차 편성' : g.source === 'CANCELLED' ? '재편성(' + md(g.orig) + ' 취소 경기)' : '재편성(잔여 경기)',
        g.cancelled ? '취소(' + (R.REASONS[g.reason] || '') + ')' : g.fixed ? '발표함' : '', g.dh ? '더블헤더' : '']);
    }
    // 날짜 × 구단: 1차 첫날 ~ 마감일
    const teams = m.teams, d0 = Dates.dayNum(m.games.length ? m.games[0].date : m.period.start), d1 = Dates.dayNum(m.period.end);
    const cell = new Map();
    for (const g of m.games) {
      const mark = (g.cancelled ? '(취소) ' : '') + (g.dh ? '더블헤더 ' : '');
      for (const [me, opp, home] of [[g.home, g.away, true], [g.away, g.home, false]]) {
        const k = g.date + '|' + me, prev = cell.get(k);
        const txt = mark + opp + (home ? ' 홈' : ' 원정');
        cell.set(k, prev && !g.dh ? prev + ' / ' + txt : prev && g.dh ? prev : txt);
      }
    }
    const grid = [['날짜', '요일', '구분'].concat(teams)];
    const p0 = Dates.dayNum(m.period.start);
    for (let d = d0; d <= d1; d++) {
      const iso = Dates.isoDate(d), row = teams.map((t) => cell.get(iso + '|' + t) || '');
      if (d < p0 && row.every((x) => !x)) continue;
      grid.push([{ date: iso }, wd(iso), d < p0 ? '1차 편성' : '재편성'].concat(row));
    }
    const mt = r.metrics, f = mt.fairness;
    const met = [['항목', '값', '허용', '판정', '설명'],
      ['넣은 경기', m.placed, null, m.unplaced.length ? '못 넣은 경기 ' + m.unplaced.length : '모두 넣음', '배정할 ' + (m.placed + m.unplaced.length) + '경기 중'],
      ['마지막 경기일 차이(일)', mt.lastDay.spreadDays, mt.lastDay.toleranceDays, mt.lastDay.within ? '허용 안' : '넘음', '가장 늦게 끝나는 구단과 가장 먼저 끝나는 구단'],
      ['이동 횟수 차이(회)', f.movesSpread, f.moveGap, f.movesSpread <= f.moveGap ? '허용 안' : '넘음', '144경기 전체 · 1차 편성만은 ' + f.firstRoundMovesSpread + '회'],
      ['이동 거리 차이(km)', f.distanceSpreadKm, f.distanceGapKm, f.distanceSpreadKm <= f.distanceGapKm ? '허용 안' : '넘음', '144경기 전체 · 1차 편성만은 ' + f.firstRoundDistanceSpreadKm + 'km'],
      ['늘어난 이동 거리(km)', mt.addedDistance.totalKm, null, null, '재편성 부분 10구단 합'],
      ['월요일 경기', mt.mondayGames, null, null, '재편성 기간'],
      ['더블헤더(번)', mt.doubleHeaders.total, rs().maxDoubleHeadersPerTeam, null, '허용은 구단당 상한'],
      [], ['구단', '마지막 경기일', '이동 횟수', '이동 거리(km)', '1차 이동 횟수', '1차 이동 거리(km)', '늘어난 이동(km)', '더블헤더']]
      .concat(mt.lastDay.byTeam.map((x, i) => [x.team, x.date ? { date: x.date } : '', f.byTeam[i].moves, f.byTeam[i].distanceKm, f.byTeam[i].firstRoundMoves, f.byTeam[i].firstRoundDistanceKm, mt.addedDistance.byTeam[i].km, mt.doubleHeaders.byTeam[i].count]));
    const un = [['원정', '홈', '이유']].concat((r.unplaced || []).map((u) => [u.away, u.home, u.text]));
    if ((r.teamLimits || []).length) un.push([], ['구단별로 넣을 수 있는 경기 수']); for (const l of r.teamLimits || []) un.push([l.team, null, l.text]);
    if ((r.fixes || []).length) un.push([], ['고칠 곳']); for (const x of r.fixes || []) un.push([x.confirmed ? '해 봄' : '', null, x.text]);
    const info = [['1차 편성 버전', v ? v.name : ''], ['재편성 기간', { date: m.period.start }, { date: m.period.end }], ['만든 곳', r.engine === 'browser' ? '이 컴퓨터(간단한 배정)' : '서버'], r.notice ? ['안내', r.notice] : []];
    return [
      { name: '날짜별 경기', rows: sheet1, header: true, widths: [12, 5, 8, 8, 22, 24, 12, 9] },
      { name: '구단별 출전표', rows: grid, header: true, widths: [12, 5, 9].concat(teams.map(() => 13)) },
      { name: '평가 숫자', rows: met, header: true, widths: [22, 12, 9, 12, 12, 14, 14, 9] },
      { name: '못 넣은 경기', rows: un, header: true, widths: [8, 8, 120] },
      { name: '조건', rows: info, widths: [16, 40, 14] }
    ];
  };
  R.xlsxName = () => 'KBO ' + YEAR + ' 재편성 ' + new Date().toISOString().slice(0, 10) + '.xlsx';
  R.downloadXlsx = function () {
    const r = R.result();
    if (!r) return;
    const bytes = Xlsx.write(R.xlsxSheets(r));
    R.lastXlsx = bytes; // 자가 점검이 다시 읽어 본다
    if (!S.selftestMode && !R.quietDownload) KBO.UI.download(R.xlsxName(), new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    S.toast('「' + R.xlsxName() + '」을 내려받았습니다. 시트: 날짜별 경기 · 구단별 출전표 · 평가 숫자 · 못 넣은 경기 · 조건.', 'ok', 6000);
  };

  // ───────── 동작 ─────────
  const commit = (label, fn) => app().commit(label, (s) => { fn(s.reschedule, s); }, ['reschedule']);
  /** 버전을 고르면 기간을 그 버전의 1차 편성 다음 날부터로 맞춘다(마감일은 시즌 종료일). 다른 버전의 취소 표시·결과는 지운다 */
  R.chooseVersion = function (id, quiet) {
    const v = PF().versions.get(YEAR, id);
    if (!v) return false;
    const st = rs();
    if (st.version === id) return true;
    if (!quiet && st.version && ((st.games || []).length || st.result) && !window.confirm('버전을 바꾸면 표시한 취소 경기 ' + (st.games || []).length + '개와 재편성 결과를 지웁니다. 바꿀까요?')) { S.render(); return false; }
    const b = baseOf(v), start = Dates.isoDate(Dates.dayNum(b.last) + 1);
    commit('재편성 버전: ' + v.name, (r, s) => {
      r.version = id; r.games = []; r.plan = []; r.result = null;
      r.start = start;
      if (!r.end || r.end < start) r.end = (s.settings.seasonEnd && s.settings.seasonEnd >= start) ? s.settings.seasonEnd : Dates.isoDate(Dates.dayNum(start) + 41);
    });
    R.ui.date = null; R.ui.month = null;
    return true;
  };
  /** 처음 들어올 때: 확정한 버전 → 첫 버전을 저절로 고른다 */
  R.ensureVersion = function () {
    if (R.version() || !PF()) return;
    const list = R.versions();
    if (!list.length) return;
    const fin = PF().final.id(YEAR), v = list.find((x) => x.id === fin) || list[0];
    S.quiet = true; try { R.chooseVersion(v.id, true); } finally { S.quiet = false; }
  };
  function setCancel(keys, on, reason) {
    const b = R.base();
    if (!b) return;
    const byKey = new Map(b.games.map((g) => [g.key, g]));
    commit(on ? '취소 경기 표시' : '취소 경기 풀기', (r) => {
      for (const k of keys) {
        const g = byKey.get(k);
        if (!g) continue;
        r.games = r.games.filter((x) => !(x.match === g.match && x.date === g.date));
        if (on) r.games.push({ match: g.match, date: g.date, status: 'CANCELLED', reason: reason || 'RAIN' });
      }
    });
  }
  R.setCancel = setCancel;
  Object.assign(S.actions, {
    'rs-month': (el) => { R.ui.month = +el.dataset.m; R.ui.date = null; S.render(); },
    'rs-day': (el) => { R.ui.date = el.dataset.date; S.writeHash(); S.render(); },
    'rs-cancel': (el) => setCancel([el.dataset.key], el.dataset.v === '1', R.ui.dayReason),
    'rs-day-all': (el) => { const b = R.base(); if (!b || !R.ui.date) return; setCancel((b.byDate.get(R.ui.date) || []).map((g) => g.key), el.dataset.v === '1', R.ui.dayReason); },
    'rs-clear': () => { if (!(rs().games || []).length || !window.confirm('표시한 취소 경기 ' + rs().games.length + '개를 모두 풀까요?')) return; commit('취소 경기 모두 풀기', (r) => { r.games = []; }); },
    'rs-ord': (el) => {
      const k = el.dataset.k, d = +el.dataset.d, o = rs().order.slice(), i = o.indexOf(k), j = i + d;
      if (i < 0 || j < 0 || j >= o.length) return;
      o[i] = o[j]; o[j] = k;
      app().updateReschedule({ order: o }, '재편성 기준 순서');
    },
    'rs-run': () => {
      const pr = R.problem();
      if (!pr || pr.error) { if (pr) S.toast(pr.error, 'bad', 7000); return; }
      if (app().isRunning()) { S.toast('1차 편성을 실행하는 중입니다. 끝난 뒤에 재편성을 실행해 주세요.', 'warn'); return; }
      app().solveReschedule(pr.problem, {}, { version: rs().version, sig: pr.sig, targets: pr.problem.reschedule.targets });
      R.tick();
    },
    'rs-stop': () => app().stopReschedule(),
    'rs-view': (el) => { R.ui.view = el.dataset.v; S.writeHash(); S.render(); },
    'rs-team': (el) => { R.ui.team = R.ui.team === el.dataset.v ? '' : el.dataset.v; S.writeHash(); S.render(); },
    'rs-goto-day': (el) => { R.ui.date = el.dataset.date; R.ui.view = 'days'; R.scrollDay = el.dataset.date; S.writeHash(); S.render(); },
    'rs-xlsx': () => R.downloadXlsx(),
    'rs-open': () => { if (S.locked && S.locked()) return; PF().open2027(); S.go({ step: 9, ops: null, modal: null, drawer: null }); }
  });
  Object.assign(S.inputs, {
    'rs-version': (el) => { if (el.value) R.chooseVersion(el.value); },
    'rs-reason': (el) => { const k = el.dataset.key; commit('취소 사유', (r) => { for (const g of r.games) if ('M:' + g.match + '|' + g.date === k) g.reason = el.value; }); R.ui.dayReason = el.value; },
    'rs-dayreason': (el) => { R.ui.dayReason = el.value; },
    'rs-date': (el) => { const v = el.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { S.toast('날짜로 읽을 수 없습니다.', 'bad'); S.render(); return; } app().updateReschedule({ [el.dataset.k]: v }, el.dataset.k === 'start' ? '재편성 시작일' : '재편성 마감일'); },
    'rs-num': (el) => { const v = parseInt(el.value, 10); if (!Number.isFinite(v)) { S.render(); return; } app().updateReschedule({ [el.dataset.k]: v }, '재편성 조건'); }
  });
  /** 실행 중에는 1초마다 다시 그린다(걸린 시간) */
  R.tick = function () {
    if (R.timer) return;
    R.timer = setInterval(() => { if (!R.running()) { clearInterval(R.timer); R.timer = null; } if (S.ui.step === 9) S.scheduleRender(); }, 1000);
  };

  // ───────── 점검용 주소 ─────────
  /** 결과를 실행 없이 바로 만든다(브라우저 첫 배정 + 서버와 같은 모양). 점검·그림용 */
  R.quickResult = function (seed) {
    const pr = R.problem();
    if (!pr || pr.error) return false;
    const ctx = RD.parse(pr.problem);
    RD.initialize(ctx, seed || 1, 5);
    const payload = RD.finishPayload(pr.problem, { plan: RD.planJson(ctx), reason: 'TIME_LIMIT', elapsedMs: 1000, improvementCount: 0 });
    const result = Object.assign({ at: new Date().toISOString() }, payload, { version: rs().version, sig: pr.sig, targets: pr.problem.reschedule.targets });
    app().store.commit('점검용 재편성 결과', (s) => { s.reschedule.result = result; }, { tags: ['reschedule'], undo: false });
    return true;
  };
  /** 처음 제공 버전(2027-rank1)을 고르고 7/20 뒤 경기 중 n개를 취소로 표시한다. 버전 파일을 받을 때까지 기다린다 */
  function demoSetup(n, then) {
    const go = (k) => {
      const v = PF() && PF().builtin['2027-rank1'];
      if (!v) { if (k < 80) setTimeout(() => go(k + 1), 50); return; }
      S.quiet = true;
      try {
        R.chooseVersion(v.id, true);
        const b = R.base(), late = b.games.filter((g) => g.date >= '2027-07-20');
        const keys = [];
        for (let i = 0; i < n && late.length; i++) keys.push(late.splice((i * 37 + 11) % late.length, 1)[0].key);
        setCancel(keys, true, 'RAIN');
        const reasons = Object.keys(R.REASONS);
        app().store.commit('점검용 사유', (s) => { s.reschedule.games.forEach((g, i) => { g.reason = reasons[i % reasons.length]; }); }, { tags: ['reschedule'], undo: false });
        if (then) then();
      } finally { S.quiet = false; }
      S.scheduleRender();
    };
    go(0);
  }
  /** demo=rsin: 버전 + 취소 24경기, 결과 없음 · 달력은 8월의 첫 취소 날 */
  S.demos.rsin = () => demoSetup(24, () => { const c = (rs().games || []).map((g) => g.date).sort(); R.ui.date = R.ui.date || c[0] || null; });
  /** demo=rs: 위 + 결과(모두 넣음) */
  S.demos.rs = () => demoSetup(24, () => R.quickResult(1));
  /** demo=rsun: 마감일을 짧게(9/12) 잡아 못 넣은 경기가 있는 결과 */
  S.demos.rsun = () => demoSetup(30, () => { app().store.commit('점검용 마감일', (s) => { s.reschedule.end = '2027-09-12'; }, { tags: ['reschedule'], undo: false }); R.quickResult(1); });
  /** demo=rsbad: 마감일이 시작일보다 앞(실행할 수 없음) */
  S.demos.rsbad = () => demoSetup(5, () => { app().store.commit('점검용 마감일', (s) => { s.reschedule.end = '2027-09-01'; }, { tags: ['reschedule'], undo: false }); });

  // 주소: rv=보기 · rd=날짜 · rt=구단
  S.stepHash = S.stepHash || {};
  S.stepHash[9] = {
    write(o) { if (R.ui.view !== 'grid') o.rv = R.ui.view; if (R.ui.date) o.rd = R.ui.date; if (R.ui.team) o.rt = R.ui.team; },
    read(o) { R.ui.view = o.rv || 'grid'; R.ui.date = /^\d{4}-\d\d-\d\d$/.test(o.rd || '') ? o.rd : null; R.ui.team = o.rt || ''; }
  };
})();
