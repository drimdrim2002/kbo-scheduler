/*
 * 편성 스튜디오 — ① 데이터 준비: 맨 먼저 시즌 연도 · 다시 왔을 때 「어디까지 했는지」 한 장
 * 연도 카드: 데이터가 있는 가장 이른 해(2025) ~ 오늘 기준 2년 뒤(해가 바뀌면 저절로 늘어난다).
 *   그 해 데이터 — 이 브라우저에 저장됨(어디까지 했는지) / 기본 제공(2025 실제 일정 · 2027 예상 일정) / 없음(새로 입력).
 *   새 연도는 가장 최근 해의 구단 정보(구단·구장·위치·거리)와 규칙 값을 가져오고, 그 해 법정 공휴일을 미리 넣는다.
 * 고른 연도는 상단 띠 왼쪽(로고 바로 뒤)에 크게 보이고 ①~④·시즌 운영 모두 그 해 데이터를 쓴다.
 * 연도를 바꾸면 지금 연도를 먼저 저장하고, 실행 취소 기록은 비운다(다른 해 데이터로 되돌아가지 않게).
 * 「처음부터 입력하기」·「2025 예시 데이터 다시 불러오기」는 연도 카드 안의 작은 단추로 합쳤다(그 해를 처음부터 다시 / 예시 보기).
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon } = S;
  const { Dates, CalendarGen } = KBO;
  const app = () => S.app;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const FIRST_YEAR = 2025;

  // ───────── 오늘·고를 수 있는 연도 ─────────
  /** 이 브라우저에서 시즌 연도를 한 번이라도 골랐는가(안 골랐으면 ①은 연도 고르기부터) */
  S.flowYearChosen = () => !!S.repo.lastYear();
  S.todayOverride = null; // 자가 점검용
  S.today = () => S.todayOverride || new Date();
  /** 고를 수 있는 연도: 2025 ~ 오늘 기준 2년 뒤, 그리고 이 브라우저에 저장한 해 */
  S.yearRange = function () {
    const last = S.today().getFullYear() + 2, set = new Set();
    for (let y = FIRST_YEAR; y <= last; y++) set.add(y);
    for (const r of S.repo.list()) set.add(r.year);
    return Array.from(set).sort((a, b) => a - b);
  };

  // ───────── 기본 제공 데이터 ─────────
  /** 기본 제공 연도: 2025 실제 일정, 2027 예상 일정(코어의 KBO.Preset2027이 있을 때) */
  S.builtinOf = function (y) {
    if (+y === 2025) return { tag: '기본 제공', label: '2025 실제 일정', build: () => S.seedProject() };
    const P = KBO.Preset2027;
    if (+y === 2027 && P) return { tag: '기본 제공(예상)', label: '2027 예상 일정', build: () => (typeof P.buildProject === 'function' ? P.buildProject() : clone(P.project || P)) };
    return null;
  };
  /** 그 해 데이터(저장본 > 기본 제공). 없으면 null */
  function projectOf(y) {
    const r = S.repo.load(y);
    if (r) return r.project;
    const b = S.builtinOf(y);
    return b ? b.build() : null;
  }
  S.yearProject = projectOf;
  /** y 해의 구단 정보를 가져올 해: y보다 앞선 해 중 가장 최근, 없으면 데이터가 있는 가장 최근 해 */
  S.sourceYearFor = function (y) {
    const have = S.yearRange().filter((x) => x !== +y && (S.repo.has(x) || S.builtinOf(x)));
    const before = have.filter((x) => x < y);
    return before.length ? before[before.length - 1] : have.length ? have[have.length - 1] : null;
  };
  // 새 연도로 가져오는 규칙 값
  const RULE_KEYS = ['gamesPerPair', 'initialGamesPerPair', 'homeGamesMajor', 'remainingHomeRule', 'roadFactor', 'h0eMode', 'restWeekdays', 'distanceToleranceKm', 'holidayTolerance', 'moveTolerance', 'longTripKm', 'seriesMinLength', 'allStarDays', 'solver', 'obligationTeams'];
  /**
   * 새 연도 프로젝트: 구단 정보·규칙 값은 가장 최근 해에서, 시즌 날짜·묶음·홈 구장 지정은 비우고 그 해 법정 공휴일(3~10월)을 넣는다.
   * opts.teamsFrom: 구단 정보를 가져올 프로젝트(지금 해를 처음부터 다시 할 때는 지금 데이터)
   */
  S.newYearProject = function (y, opts) {
    const o = opts || {};
    const from = o.teamsFrom ? null : S.sourceYearFor(y);
    const src = o.teamsFrom || (from ? projectOf(from) : null);
    const p = S.emptyProject();
    if (src) {
      p.teams = clone(src.teams); p.distanceMatrix = clone(src.distanceMatrix);
      for (const k of RULE_KEYS) if (src.settings[k] !== undefined) p.settings[k] = clone(src.settings[k]);
      // 격년 홈 73/71: 바로 앞 해 것이 있으면 반대로(해마다 바뀐다)
      // 2025 예시처럼 격년 홈이 없는 해에서 가져오면 코어 기본값(defaultHomeTotals, 있으면)을 쓴다 — 2025 자체에는 넣지 않는다
      const ht = src.settings.homeTotals, srcYear = +(src.settings.seasonYear || src.meta.season || 0);
      if (ht && Array.isArray(ht.moreTeams)) {
        if (!o.teamsFrom && srcYear === y - 1) p.settings.homeTotals = CalendarGen.flipHomeTotals ? CalendarGen.flipHomeTotals(clone(ht), p.teams) : Object.assign(clone(ht), { moreTeams: p.teams.map((t) => t.name).filter((n) => !ht.moreTeams.includes(n)) });
        else p.settings.homeTotals = clone(ht);
      } else if (!o.teamsFrom && CalendarGen.defaultHomeTotals && y > 2025) p.settings.homeTotals = CalendarGen.defaultHomeTotals(y, p.teams);
    }
    Object.assign(p.settings, {
      seasonYear: y, seasonStart: '', initialEnd: '', seasonEnd: '',
      holidays: CalendarGen.builtinHolidays(y).filter((h) => h.date >= y + '-03-01' && h.date <= y + '-10-31'),
      allStarStart: CalendarGen.defaultAllStarStart(y)
    });
    if (p.settings.allStarDays == null) p.settings.allStarDays = 6;
    p.reschedule = Object.assign(clone(KBO.Preset.DEFAULT_RESCHEDULE), { start: y + '-09-01', end: y + '-10-31' });
    // flow.from: 구단 정보를 가져온 해(「바뀐 정보가 있나요?」를 묻는다). 지금 해를 처음부터 다시 할 때는 묻지 않는다
    p.meta = Object.assign({}, p.meta, { name: y + ' 정규시즌', season: y, blank: true, flow: { from: o.teamsFrom ? null : from, teams: null } });
    return p;
  };

  // ───────── 연도 바꾸기 ─────────
  const virtualByYear = new Map();
  let virtualYear = 2025;
  /**
   * y 해로 바꾼다. opts: { project(그 프로젝트로 연다), save(바로 저장), to: 'resume'|'flow'|'stay', quiet }
   * 지금 해는 먼저 저장하고(고친 것이 있으면), 실행 취소 기록은 비운다.
   */
  S.switchYear = function (y, opts) {
    const o = opts || {};
    y = +y;
    if (!o.boot && S.locked && S.locked()) return false;
    S.autosave.flush();
    let p = o.project ? clone(o.project) : null, fromSeed = false;
    if (!p) { const r = S.repo.load(y); if (r) { p = r.project; S.autosave.savedAt = r.savedAt; } }
    if (!p) { const b = S.builtinOf(y); if (b) { p = b.build(); fromSeed = y === 2025; } }
    if (!p) p = S.newYearProject(y);
    if (!o.project && !S.repo.has(y)) S.autosave.savedAt = null;
    p.meta = Object.assign({}, p.meta, { season: y });
    p.settings = Object.assign({}, p.settings, { seasonYear: y });
    const a = app(), A = S.autosave;
    A.paused = true;
    a.store.initial = () => p;
    a.store.reset();
    A.paused = false; A.dirty = false;
    if (o.save) { A.dirty = true; A.flush(); }
    S.repo.setLastYear(y);
    // 시연용 위반 표시는 2025 예시 데이터에만: 해를 오가도 이 탭에서는 그대로 기억한다
    const prevYear = virtualYear;
    if (prevYear != null) virtualByYear.set(prevYear, new Set(S.virtualSigs));
    S.virtualSigs.clear();
    if (fromSeed) for (const v of a.derived().ex.violations) S.virtualSigs.add(S.vsig(v));
    else if (virtualByYear.has(y)) for (const x of virtualByYear.get(y)) S.virtualSigs.add(x);
    virtualYear = y;
    Object.assign(S.ui, { cell: null, edit: null, sel: null, vizChanged: null, lastImport: null, exported: false, preflightSel: null, teamFind: null, mapPick: null, modal: null, menu: null });
    S.lastRun = null;
    if (S.calOnReset) S.calOnReset();
    if (S.flowOnYear) S.flowOnYear(y, o.to || 'resume');
    if (!o.quiet) S.toast(y + ' 시즌을 열었습니다' + (S.repo.has(y) ? ' — 이 브라우저에 저장된 데이터입니다.' : S.builtinOf(y) ? ' — ' + S.builtinOf(y).label + '(' + S.builtinOf(y).tag + ')입니다.' : ' — 새로 입력합니다. 구단 정보는 ' + (p.meta.flow && p.meta.flow.from ? p.meta.flow.from + '년' : '가장 최근') + ' 것을 가져왔습니다.'), 'info', 5000);
    if (!o.boot) S.render();
    return true;
  };

  // ───────── 어디까지 했는지(단계 완료는 데이터로 판단) ─────────
  /** 1차 편성 경기일: 연전 수 합 / 맞대결 1차 편성 경기 수 × 상대 수 */
  function gameDaysOf(p) {
    const have = p.calendar.reduce((s, c) => s + (c.consecutive || 0), 0);
    const need = p.settings.initialGamesPerPair * Math.max(0, p.teams.length - 1);
    return { have, need, ok: have === need && need > 0 };
  }
  S.gameDaysOf = gameDaysOf;
  /** 반드시 정할 홈 구장 지정: 개막전(개막일) · 어린이날(5/5가 묶음 안이면) */
  function requiredHomes(p) {
    const out = [], s = p.settings, dn = Dates.dayNum;
    const inBundle = (iso) => p.calendar.some((c) => { const a = dn(c.datetime), d = dn(iso); return d >= a && d < a + c.consecutive; });
    if (s.seasonStart) out.push({ type: 'OPENING', name: '개막전', date: s.seasonStart });
    const cd = S.seasonYearOf(p) + '-05-05';
    if (inBundle(cd)) out.push({ type: 'CHILDREN', name: '어린이날', date: cd });
    return out;
  }
  S.seasonYearOf = (p) => +(p.settings.seasonYear || (/^(\d{4})/.exec(p.settings.seasonStart || '') || [])[1] || p.meta.season || 2025);
  /** 홈 구장 지정 하나가 다 됐는가: 구단 수의 절반을 골랐고, 대진까지 고정이면 대진도 다 골랐다 */
  S.homeComplete = function (e, p) {
    const half = (p || app().state).teams.length >> 1;
    const teams = (e && e.teams) || [];
    if (!e || teams.length !== half) return false;
    if (e.fix === 'pairs') return Array.isArray(e.pairs) && teams.every((h) => e.pairs.some((x) => x.home === h && x.away));
    return true;
  };
  function homeState(p) {
    const req = requiredHomes(p), dn = Dates.dayNum;
    const rows = req.map((r) => {
      const e = p.events.find((x) => x.mode === 'STADIUM' && dn(x.date) === dn(r.date)) || null;
      return Object.assign({}, r, { ev: e, n: e ? (e.teams || []).length : 0, done: S.homeComplete(e, p) });
    });
    return { rows, done: rows.filter((x) => x.done).length, total: rows.length };
  }
  S.homeStateOf = homeState;
  /** 시리즈가 묶음과 맞는가: 연전 수마다 「묶음 수 × 구장 수 = 시리즈 수」, 맞대결마다 1차 편성 경기 수 */
  function seriesOk(p) {
    if (!p.matches.length) return false;
    const half = p.teams.length >> 1, sh = CalendarGen.lengthHistogram(p.calendar), mh = CalendarGen.lengthHistogram(p.matches);
    for (const k of new Set(Object.keys(sh).concat(Object.keys(mh)))) if ((sh[k] || 0) * half !== (mh[k] || 0)) return false;
    const cnt = new Map();
    for (const m of p.matches) { const k = [m.home, m.away].sort().join('|'); cnt.set(k, (cnt.get(k) || 0) + m.consecutive); }
    const names = p.teams.map((t) => t.name);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if ((cnt.get([names[i], names[j]].sort().join('|')) || 0) !== p.settings.initialGamesPerPair) return false;
    return true;
  }
  S.seriesOkOf = seriesOk;
  function teamsOk(p) {
    const n = p.teams.length;
    if (n < 2 || n % 2) return false;
    const have = new Set(p.distanceMatrix.map((d) => d.from + '|' + d.to));
    return p.teams.every((a) => p.teams.every((b) => a.name === b.name || have.has(a.name + '|' + b.name)));
  }
  S.FLOW_STEPS = [{ n: 1, name: '구단 정보' }, { n: 2, name: '시즌 기간·연전 묶음' }, { n: 3, name: '공휴일·홈 구장' }, { n: 4, name: '확인' }];
  /**
   * 단계마다 { n, name, kind: 'done'|'cur'|'todo', text } + stop(멈춘 단계, 모두 끝났으면 4) — 프로젝트(저장본 포함)로 판단한다.
   * 1 구단 정보: 구단 짝수·거리 모두 있음, 그리고 새 연도면 「바뀐 정보가 있나요?」에 답함
   * 2 시즌 기간·연전 묶음: 개막일·1차 편성 종료일이 있고 경기일 합이 맞음
   * 3 공휴일·홈 구장: 개막전·어린이날 홈 구장 지정을 다 정함
   * 4 확인: 1~3 끝, 시리즈가 묶음과 맞음(「다음」 때 규칙대로 만든다)
   */
  S.flowStatus = function (p0) {
    const p = p0 || app().state, fl = p.meta.flow || {}, half = p.teams.length >> 1;
    const dm = p.distanceMatrix.filter((d) => d.from !== d.to).length;
    const asked = !fl.from || !!fl.teams;
    const s1 = teamsOk(p) && asked;
    const gd = gameDaysOf(p), s = p.settings;
    const s2 = !!(s.seasonStart && s.initialEnd) && gd.ok;
    const hs = homeState(p), hol = s.holidays.filter((h) => h.date >= (s.seasonStart || S.seasonYearOf(p) + '-03-01') && h.date <= (s.seasonEnd || S.seasonYearOf(p) + '-10-31')).length;
    const s3 = s2 && hs.total > 0 && hs.done === hs.total;
    const sr = seriesOk(p);
    const s4 = s1 && s2 && s3 && sr;
    const rows = [
      { kind: s1 ? 'done' : 'cur', text: !teamsOk(p) ? (p.teams.length % 2 ? '구단 수가 홀수입니다' : '구장 간 거리가 모자랍니다') : !asked ? '바뀐 정보가 있나요?' : (fl.teams === 'changed' ? '고침 · ' : fl.teams === 'same' ? '그대로 · ' : '') + p.teams.length + '구단 · 구장 간 거리 ' + dm + '개' },
      { kind: s2 ? 'done' : 'cur', text: !s.seasonStart ? '개막일을 골라 주세요' : '개막 ' + Dates.fmtDate(s.seasonStart) + (s.initialEnd ? ' ~ 1차 편성 ' + Dates.fmtDate(s.initialEnd) : '') + ' · 경기일 ' + gd.have + ' / ' + gd.need + '일' + (gd.ok ? '' : gd.have < gd.need ? ' (' + (gd.need - gd.have) + '일 모자람)' : ' (' + (gd.have - gd.need) + '일 많음)') },
      { kind: s3 ? 'done' : 'cur', text: '공휴일 ' + hol + '일 · 홈 구장 지정 ' + hs.done + ' / ' + hs.total + (s3 || !hs.total ? '' : ' — ' + hs.rows.filter((r) => !r.done).map((r) => Dates.fmtDate(r.date) + ' ' + r.name + (r.n ? ' ' + r.n + ' / ' + half + '곳' : '')).join(', ') + (hs.rows.some((r) => !r.done && !r.n) ? '이(가) 아직 비어 있습니다' : '')) },
      { kind: s4 ? 'done' : 'cur', text: s4 ? '모두 맞음 · 시리즈 ' + p.matches.length + '개' : s1 && s2 && s3 ? '시리즈는 「다음」 때 규칙대로 만듭니다' : '앞 단계를 마치면 한 번에 확인합니다' }
    ];
    const done = [s1, s2, s3, s4];
    let stop = done.indexOf(false) + 1;
    if (!stop) stop = 4;
    return {
      steps: S.FLOW_STEPS.map((x, i) => Object.assign({}, x, rows[i], { kind: done[i] ? 'done' : i + 1 === stop ? 'cur' : 'todo' })),
      stop, allDone: done.every(Boolean), done
    };
  };

  // ───────── 연도 고르기 화면 ─────────
  function yearCard(y) {
    const rec = S.repo.load(y), b = S.builtinOf(y), cur = S.flowYearChosen() && y === S.seasonYear();
    let stat, what, btn, extra = '';
    if (rec) {
      const fs = S.flowStatus(rec.project), stopName = S.FLOW_STEPS[fs.stop - 1];
      stat = '<span class="yc-stat blue">이 브라우저에 저장됨</span>';
      what = (fs.allDone ? '4단계 모두 완료' : fs.stop + '단계 「' + stopName.name + '」에서 멈춤') + ' · 마지막으로 고친 때 ' + esc(S.whenText(rec.savedAt));
      btn = '<button class="btn primary yc-go" data-act="year-open" data-year="' + y + '">이어서 하기' + icon('right') + '</button>';
      extra = '<span class="yc-more"><button class="lnk" data-act="year-reset" data-year="' + y + '">처음부터 다시</button>' +
        (b ? ' · <button class="lnk" data-act="year-builtin" data-year="' + y + '">' + (y === 2025 ? '예시 데이터 다시 불러오기' : esc(b.tag) + ' 데이터로 다시') + '</button>' : '') + '</span>';
    } else if (b) {
      stat = '<span class="yc-stat ok">' + icon('check') + '데이터 있음</span>';
      what = esc(b.label) + '(' + esc(b.tag) + ')' + (y === 2025 ? ' · 4단계 모두 완료. 단계를 하나씩 눌러 확인합니다.' : ' · 단계를 하나씩 눌러 확인하고 고칩니다.');
      btn = '<button class="btn yc-go" data-act="year-open" data-year="' + y + '">열기</button>';
      extra = '<span class="yc-more"><button class="lnk" data-act="year-reset" data-year="' + y + '">처음부터 입력하기</button></span>';
    } else {
      const from = S.sourceYearFor(y);
      stat = '<span class="yc-stat todo">데이터 없음</span>';
      what = '새로 입력합니다. 구단 정보는 가장 최근' + (from ? '(' + from + ')' : '') + ' 것을 가져와 「바뀐 정보가 있나요?」를 묻습니다.';
      btn = '<button class="btn yc-go" data-act="year-open" data-year="' + y + '">새로 입력</button>';
    }
    const kind = rec ? 'saved' : b ? 'has' : 'new';
    return '<div class="yc ' + kind + (cur ? ' cur' : '') + '" data-year="' + y + '"><div class="yc-y">' + y + '<small>시즌</small>' + (cur ? '<span class="yc-now">지금 여는 중</span>' : '') + '</div>' + stat + '<div class="yc-what">' + what + '</div>' + btn + extra + '</div>';
  }
  S.renderYearScreen = function () {
    const ys = S.yearRange(), last = S.today().getFullYear() + 2;
    const t = S.today(), today = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    return '<div class="stepview fl-center" data-mode="year"><div class="fl-card wide" aria-label="시즌 연도 고르기">' +
      '<div class="fl-kick">' + S.CIRCLED[1] + ' 데이터 준비 · 맨 먼저</div><h2>몇 년 시즌을 편성할까요?</h2>' +
      '<p class="fl-sub">고른 연도는 위쪽 띠에 크게 보이고, 데이터 준비부터 배포까지 모든 단계에 그대로 쓰입니다. 그 해 데이터가 있으면 이어서 하고, 없으면 새로 입력합니다. 오늘(' + today + ') 기준 2년 뒤(' + last + ')까지 고를 수 있습니다.</p>' +
      '<div class="yc-grid" style="--n:' + Math.min(ys.length, 5) + '">' + ys.map(yearCard).join('') + '</div>' +
      '<div class="fl-foot"><span>데이터는 이 컴퓨터의 브라우저에 연도별로 저장됩니다. 다른 컴퓨터에서 이어서 하려면 파일로 내려받아 그 컴퓨터에서 올립니다.</span>' +
      '<button class="btn sm" data-act="repo-import">' + icon('upload') + '파일 올리기</button>' + (S.flowYearChosen() ? '<button class="btn sm" data-act="repo-export">' + icon('download') + S.seasonYear() + ' 시즌 파일로 내려받기</button>' : '') + '</div>' +
      '</div></div>';
  };
  S.yearFooter = function () {
    const chosen = S.flowYearChosen(), y = S.seasonYear();
    return '<button class="btn" disabled>' + icon('left') + '이전</button>' +
      '<span class="hint"><b>맨 먼저 시즌 연도</b> — 고른 연도는 위쪽에 크게 보이고 모든 단계에 그대로 쓰입니다</span>' +
      '<span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' +
      '<button class="btn primary" data-act="year-open" data-year="' + y + '"' + (chosen ? '' : ' disabled') + '>이어서: ' + y + ' 시즌' + icon('right') + '</button>';
  };

  // ───────── 자가 점검 (guide-steps.js의 selftest가 맨 먼저 부른다) ─────────
  S.yearSelftest = async function ({ ok, click, flush }) {
    const q = (sel) => document.querySelector(sel), qa = (sel) => document.querySelectorAll(sel), st = () => app().state;
    const saved0 = S.repo.list().map((r) => r.year);
    S.todayOverride = new Date(2026, 9, 30);
    S.autosave.flush();
    S.flowPickYear(); flush();
    const cards = Array.from(qa('.yc')).map((el) => +el.dataset.year);
    ok('연도 고르기: 상단 띠 연도 칸을 누르면 ① 연도 카드(2025 ~ 오늘 기준 2년 뒤 2028) · 2025 데이터 있음 · 2026 데이터 없음(새로 입력, 2025 구단 정보) · 주소 pick=year',
      S.g1.mode === 'year' && cards.join() === '2025,2026,2027,2028' && /데이터 있음|이 브라우저에 저장됨/.test(q('.yc[data-year="2025"]').textContent) && /데이터 없음/.test(q('.yc[data-year="2026"]').textContent) && /가장 최근\(2025\)/.test(q('.yc[data-year="2026"]').textContent) && /pick=year/.test(S.lastHash), cards.join());
    S.todayOverride = new Date(2027, 0, 2); flush();
    const grow = Array.from(qa('.yc')).map((el) => +el.dataset.year).join() === '2025,2026,2027,2028,2029';
    S.todayOverride = new Date(2026, 9, 30); flush();
    ok('연도 고르기: 해가 바뀌면 카드가 저절로 늘어남(2027-01-02 → 2029까지)', grow);
    const had27 = S.repo.has(2027) || !!S.builtinOf(2027);
    click('.yc[data-year="2027"] [data-act="year-open"]'); flush();
    const y27 = S.seasonYear() === 2027 && /2027 시즌/.test(q('.tb-year').textContent) && !app().store.canUndo() && st().teams.length === 10 && /year=2027/.test(S.lastHash) && document.title.indexOf('2027 시즌') >= 0;
    const newOk = had27 || (st().settings.holidays.some((h) => h.date === '2027-08-16') && st().settings.seasonStart === '' && !st().calendar.length && st().meta.flow && st().meta.flow.from === 2025 && st().settings.allStarStart === '2027-07-09');
    ok('2027 열기 → 상단 띠 「2027 시즌」 · 실행 취소 기록 비움 · 주소 year=2027 · (새로 입력이면) 2025 구단 정보 + 2027 법정 공휴일 + 올스타 7/9', y27 && newOk, 'had27 ' + had27);
    app().updateSettings({ seasonEnd: '2027-10-31' }, '시험: 시즌 종료일'); flush();
    S.autosave.flush();
    const rec = S.repo.load(2027);
    ok('자동 저장: 고치면 그 해로 이 브라우저에 저장 · 저장 시각', !!rec && rec.project.settings.seasonEnd === '2027-10-31' && !!S.autosave.savedAt && S.repo.lastYear() === 2027);
    const txt = app().store.exportProject(), pf = S.repo.parseFile(txt), bad = S.repo.parseFile('{"teams": 3}');
    ok('파일: 내려받을 JSON을 다시 읽으면 2027 · 망가진 파일은 거부', pf.ok && pf.year === 2027 && !bad.ok && S.fileName(2027) === 'KBO 2027 시즌 데이터.json');
    S.flowPickYear(); flush();
    ok('연도 고르기: 2027 카드 「이 브라우저에 저장됨」 · 지금 여는 중 · 이어서 하기', /이 브라우저에 저장됨/.test(q('.yc[data-year="2027"]').textContent) && q('.yc[data-year="2027"]').classList.contains('cur') && /이어서 하기/.test(q('.yc[data-year="2027"] [data-act="year-open"]').textContent));
    click('.yc[data-year="2025"] [data-act="year-open"]'); flush();
    ok('2025로 돌아오면 저장해 둔 2025 그대로(연전 기간 45 · 시연용 위반 표시 그대로)', S.seasonYear() === 2025 && st().calendar.length === 45 && S.virtualSigs.size === 3, 'cal ' + st().calendar.length + ' · virt ' + S.virtualSigs.size);
    const r2 = S.openProjectText(txt, 'KBO 2027 시즌 데이터.json'); flush();
    ok('파일 올리기 → 그 해(2027)로 열고 저장', r2.ok && S.seasonYear() === 2027 && st().settings.seasonEnd === '2027-10-31');
    S.switchYear(2025, { quiet: true, to: 'stay' }); flush();
    for (const y of [2026, 2027, 2028]) if (!saved0.includes(y)) S.repo.remove(y);
    S.todayOverride = null;
  };

  // ───────── 동작 ─────────
  const guardRun = () => { if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) { S.toast('자동 편성 중에는 시즌 연도를 바꿀 수 없습니다. 먼저 중지하세요.', 'warn'); return true; } return false; };
  Object.assign(S.actions, {
    'year-pick': () => { if (S.flowPickYear) S.flowPickYear(); },
    'year-open': (el) => {
      if (guardRun()) return;
      const y = +el.dataset.year;
      if (y === S.seasonYear() && S.flowYearChosen()) { if (S.flowOnYear) S.flowOnYear(y, 'resume'); S.repo.setLastYear(y); S.render(); return; }
      S.switchYear(y, { to: 'resume' });
    },
    // 그 해를 처음부터 다시 · 기본 제공 데이터로 다시: 확인 창을 거친다(base.js의 S.resetAll·S.loadExample, 실행 취소 가능)
    'year-reset': (el) => { if (guardRun()) return; S.ui.resetKind = 'blank'; S.ui.resetYear = +el.dataset.year; S.go({ modal: 'reset', menu: null }); },
    'year-builtin': (el) => { if (guardRun()) return; S.ui.resetKind = 'example'; S.ui.resetYear = +el.dataset.year; S.go({ modal: 'reset', menu: null }); },
    'repo-export': () => { const n = S.repo.exportFile(); S.toast(n + '을(를) 내려받았습니다. 다른 컴퓨터에서 「파일 올리기」로 엽니다.', 'ok', 5000); S.ui.menu = null; S.render(); },
    'repo-import': () => { if (guardRun()) return; S.ui.menu = null; S.repo.importFile(); }
  });
})();
