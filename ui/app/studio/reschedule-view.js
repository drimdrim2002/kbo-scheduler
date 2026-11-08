/*
 * 편성 스튜디오 — 날짜 단위 재편성 화면 (step=9, 2027) · 대안 B: 세 쪽으로 나눈 단계
 *  1 취소 경기: 버전 · 큰 달력(왼쪽) · 그날 경기와 표시한 취소 경기(오른쪽)
 *  2 기간·조건: 기간 · 꼭 지키는 값 · 기준 순서(왼쪽) · 배정할 경기 표(오른쪽) · 실행 — 실행이 끝나면 3으로
 *  3 결과: 결과 숫자 한 줄 + 보기 다섯(구단×날짜 표 · 달력 · 날짜별 경기 · 평가 숫자 · 못 넣은 경기) + 엑셀, 화면 폭을 다 쓴다
 *    달력: 재편성 기간의 달마다 넣은 경기를 날짜 칸에 · 날을 누르면 오른쪽에 그날 경기와 구단별 연속 경기일
 *  다시 짜기(요구 §8, 기본안): 결과 쪽 「이 일정으로 발표」 → 머리에 발표 기록 한 줄 → 1쪽 달력이 발표한 재편성 날까지 넓어져
 *    그날 재편성 경기에 「취소」 → 2쪽은 「다시 넣을 경기」와 다시 짜는 시작일 → 「다시 짜기」 → 3쪽에서 다시 발표
 *  쪽은 주소 rp=1|2|3, 달력의 달은 rm=YYYY-MM. 부품은 reschedule-parts.js(S.rs). 이 파일은 배치만 정한다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const R = S.rs;
  if (!R) return; // ?classic=1·?selftest=1에는 계획 흐름이 없다
  const { KBO, esc, icon } = S;
  const { Dates } = KBO;
  const app = () => S.app;
  const VIEWS = [['grid', '구단 × 날짜'], ['cal', '달력'], ['days', '날짜별 경기'], ['metrics', '평가 숫자'], ['unplaced', '못 넣은 경기']];
  const PAGES = [[1, '취소 경기', '열리지 못한 경기 표시'], [2, '기간·조건', '기간 · 꼭 지키는 값 · 기준 순서'], [3, '결과', '날짜마다 넣은 일정']];
  const WD = ['월', '화', '수', '목', '금', '토', '일'];
  R.ui.page = null;
  R.ui.cmonth = null; // 결과 달력에서 고른 달 'YYYY-MM'
  let wasRunning = false;

  // 주소에 쪽(rp)을 더한다
  const base = S.stepHash[9];
  S.stepHash[9] = {
    write(o) { base.write(o); if (R.ui.page) o.rp = R.ui.page; if (R.ui.cmonth) o.rm = R.ui.cmonth; },
    read(o) { base.read(o); R.ui.page = ['1', '2', '3'].includes(o.rp) ? +o.rp : null; R.ui.cmonth = /^\d{4}-\d\d$/.test(o.rm || '') ? o.rm : null; }
  };
  const page = () => R.ui.page || (R.result() ? 3 : 1); // 주소·단추로 고르지 않았으면 결과가 있을 때 결과 쪽

  function band() {
    const cur = page(), r = R.result(), n = (app().state.reschedule.games || []).length, pub = R.published(), pm = R.planMap();
    const reN = R.reCancels().filter((g) => R.activeRe(g, pm)).length;
    const sub = { 1: pub ? (reN ? '새로 취소 ' + reN + '경기' : '발표한 일정에서 표시') : n ? '취소 ' + n + '경기 표시' : '아직 표시 없음', 2: R.problem() && R.problem().error ? '실행할 수 없음' : R.running() ? '실행 중' : pub ? '정했으면 다시 짜기' : '정했으면 실행', 3: r ? (R.isPublished(r) ? (R.stale(r) ? '발표함 · 새 취소 있음' : '발표함') : R.stale(r) ? '조건이 바뀜 · 다시 실행' : '결과 있음') : '실행 뒤' };
    return '<nav class="rs-band" aria-label="재편성 단계">' + PAGES.map(([k, name]) => '<button class="rs-bstep' + (k === cur ? ' on' : '') + (k < cur ? ' done' : '') + '" data-act="rs-page" data-p="' + k + '"' + (k === cur ? ' aria-current="step"' : '') + '><span class="rs-no">' + k + '</span><span class="nm"><b>' + name + '</b><span>' + esc(sub[k]) + '</span></span></button>').join('') + '</nav>';
  }

  function page1() {
    const v = R.version(), st = app().state.reschedule;
    let s = '<div class="rs-p1"><section class="pf-sec rs-p1-cal"><div class="rs-p1-top">' + R.versionPicker() + '</div>';
    if (!v) return s + '</section></div>';
    s += '<h3>달력에서 날짜를 고르세요<span class="r">' + R.targetSummary() + '</span></h3><p class="pf-d">' + (R.published() ? '발표한 재편성 경기가 열리지 못했으면 그날을 눌러 「취소」를 표시합니다. 1차 편성 날과 같은 방법입니다.' : '대진과 홈은 그대로, 날짜만 다시 정합니다.') + '</p>' + R.cancelCalendar({ big: true }) + '</section>';
    s += '<section class="pf-sec rs-p1-side"><h3>그날 경기</h3>' + R.dayGames() +
      (R.published() ? '<h3 class="rs-h3b">발표한 일정에서 취소한 경기 ' + R.reCancels().length + '</h3>' + R.cancelList({ compact: true, only: 're' }) +
        '<details class="rs-det"><summary>1차 편성 취소 경기 ' + (st.games || []).filter((g) => g.match != null).length + '</summary>' + R.cancelList({ compact: true, only: 'first' }) + '</details>'
        : '<h3 class="rs-h3b">표시한 취소 경기 ' + (st.games || []).length + '<span class="r">' + ((st.games || []).length ? '<button class="pf-link" data-act="rs-clear">모두 풀기</button>' : '') + '</span></h3>' + R.cancelList({ compact: true })) + '</section></div>';
    return s;
  }

  function page2() {
    if (!R.version()) return '<div class="pf-sec">' + R.versionPicker() + '</div>';
    const pr = R.problem();
    return '<div class="rs-p2"><section class="pf-sec rs-p2-in"><h3>기간</h3>' + R.periodForm() + '<h3>꼭 지키는 값</h3>' + R.limitsForm() + '<h3>좋은 일정의 기준 순서<span class="r muted small">위가 먼저</span></h3>' + R.orderForm() + '</section>' +
      '<section class="pf-sec rs-p2-t"><h3>' + (pr && pr.rerun ? '다시 넣을 경기' : '배정할 경기') + '</h3>' + (pr && !pr.error ? R.targetTable() : '') + '<div class="rs-p2-run">' + R.targetSummary() + R.runBox() + '</div></section></div>';
  }

  // ── 결과 달력(보기 「달력」): 재편성 기간의 달만 ──
  const ym = (n) => Dates.isoDate(n).slice(0, 7);
  function calMonths(r) {
    const out = [];
    for (let d = Dates.dayNum(R.model(r).showStart.slice(0, 7) + '-01'); ym(d) <= r.period.end.slice(0, 7); d = Dates.dayNum(Dates.isoDate(d + 31).slice(0, 7) + '-01')) out.push(ym(d));
    return out;
  }
  const inPer = (r, iso) => iso >= R.model(r).showStart && iso <= r.period.end; // 다시 짰으면 치른 재편성 날부터
  /** 보는 달: 고른 달 → 고른 날의 달 → 재편성 첫 달(기본값은 주소에 남기지 않는다) */
  function calMonth(r) {
    const ms = calMonths(r);
    if (ms.includes(R.ui.cmonth)) return R.ui.cmonth;
    if (R.ui.date && ms.includes(R.ui.date.slice(0, 7))) return R.ui.date.slice(0, 7);
    return ms[0];
  }
  function calendar(r) {
    const b = R.base(), mo = calMonth(r), m = R.model(r), cm = R.cancelMap();
    const per = new Map(), reBy = new Map();
    for (const c of cm.values()) per.set(c.date, (per.get(c.date) || 0) + 1);
    for (const g of m.games) if (g.kind === 're') { if (!reBy.has(g.date)) reBy.set(g.date, []); reBy.get(g.date).push(g); }
    const ms = calMonths(r);
    let s = '<div class="rsc-mtabs" role="tablist">' + (ms.length > 1 ? ms.map((k) => '<button role="tab" class="' + (k === mo ? 'on' : '') + '" data-act="rsc-month" data-m="' + k + '">' + (+k.slice(5)) + '월</button>').join('') : '<b class="rsc-mt">' + (+mo.slice(5)) + '월</b>') +
      '<span class="rsc-leg"><span><i class="pd"></i>재편성 기간</span><span><i class="mon"></i>월요일</span><span><i class="org"></i>취소됐던 경기</span><span><i class="cx"></i>1차 편성 날의 취소</span></span></div>';
    s += '<div class="rsc-grid"><div class="hd">' + WD.join('</div><div class="hd">') + '</div>';
    const first = Dates.dayNum(mo + '-01'), lead = (Dates.weekday(first) + 6) % 7;
    for (let k = 0; k < 42; k++) {
      const d = first - lead + k, iso = Dates.isoDate(d), inMo = iso.slice(0, 7) === mo;
      if (k >= 35 && !inMo) break;
      if (!inMo) { s += '<div class="rsc-d out"></div>'; continue; }
      const pd = inPer(r, iso), fr = b.byDate.get(iso) || [], n = per.get(iso) || 0, mon = Dates.weekday(d) === 1;
      let body = '';
      if (pd) {
        const re = reBy.get(iso) || [], seen = new Set();
        const chips = re.filter((g) => { const key = g.home + g.away; if (g.dh && seen.has(key)) return false; seen.add(key); return true; });
        body = chips.slice(0, chips.length > 3 ? 2 : 3).map((g) => '<span class="rsc-chip' + (g.source === 'CANCELLED' ? ' org' : '') + (g.cancelled ? ' cx' : '') + (g.fixed || g.played ? ' fx' : '') + '" title="' + esc((g.source === 'CANCELLED' ? R.mdw(g.orig) + ' 취소 경기' : '잔여 경기') + (g.cancelled ? ' · 이날 취소' : g.played ? ' · 치름' : g.fixed ? ' · 발표함' : '')) + '">' + esc(g.away) + '<i>vs</i>' + esc(g.home) + (g.dh ? '<b>×2</b>' : '') + '</span>').join('') +
          (chips.length > 3 ? '<span class="rsc-more">+' + (chips.length - 2) + '경기 더</span>' : '') + (!re.length ? '<span class="rsc-g">경기 없음</span>' : '');
        s += '<button class="rsc-d has pd' + (iso < r.period.start ? ' past' : '') + (mon ? ' mon' : '') + (R.ui.date === iso ? ' sel' : '') + '" data-act="rsc-day" data-date="' + iso + '" aria-label="' + esc(R.mdw(iso) + (re.length ? ' 경기 ' + re.length : ' 경기 없음')) + '"><span class="dn">' + (+iso.slice(8)) + '</span>' + body + '</button>';
      } else {
        if (fr.length) body = n ? '<span class="rsc-x">취소 ' + n + '</span><span class="rsc-g">' + (fr.length - n) + '경기 열림</span>' : '<span class="rsc-g">' + fr.length + '경기</span>';
        s += '<div class="rsc-d fr' + (n ? ' cx' : '') + (mon ? ' mon' : '') + '"><span class="dn">' + (+iso.slice(8)) + '</span>' + body + '</div>';
      }
    }
    return s + '</div>';
  }
  /** 달력 오른쪽: 고른 날의 경기와 구단별 연속 경기일 */
  function calSide(r) {
    const date = R.ui.date;
    if (!date || !inPer(r, date)) return '<div class="rs-hint">달력에서 재편성 기간의 날을 누르면, 그날 넣은 경기와 구단마다 며칠째 연속 경기인지 여기에 나옵니다.</div>';
    const m = R.model(r), list = m.games.filter((g) => g.kind === 're' && g.date === date), k = m.days.findIndex((d) => d.date === date), live = list.filter((g) => !g.cancelled).length;
    let s = '<div class="rs-dl"><section class="rs-dl-day sel"><h4><b>' + esc(R.mdw(date)) + '</b><span class="n">' + (live ? live + '경기' : '경기 없음') + '</span></h4>';
    if (list.length) {
      s += '<table><tbody>';
      const seen = new Set();
      for (const g of list) {
        const key = g.home + '-' + g.away, second = g.dh && seen.has(key); seen.add(key);
        s += '<tr' + (g.cancelled ? ' class="cx"' : '') + '><td class="v">' + S.team(g.away) + ' <span class="muted">vs</span> ' + S.team(g.home) + (g.dh ? ' <span class="pf-tag blue">' + (second ? '2차전' : '1차전') + '</span>' : '') + (g.cancelled ? ' <span class="pf-tag over">취소' + (g.moved ? ' → ' + esc(R.md(g.moved)) : '') + '</span>' : g.played ? ' <span class="pf-tag got">치름</span>' : g.fixed ? ' <span class="pf-tag ok">발표함</span>' : '') + '<span class="rsc-sub">' + esc(g.stadium) + ' · ' + (g.source === 'CANCELLED' ? esc(R.mdw(g.orig)) + ' 취소 경기' : '잔여 경기') + '</span></td></tr>';
      }
      s += '</tbody></table>';
    }
    s += '</section></div>';
    if (k >= 0) s += '<h4 class="rsc-h">이날까지 연속 경기일 <span class="muted small">상한 ' + m.limit + '일</span></h4><ul class="rsc-runs">' + m.teams.map((t, i) => { const v = m.runs[i][k]; return '<li class="' + (v >= m.limit ? 'lim' : v ? '' : 'rest') + '">' + S.team(t) + '<b>' + (v ? v + '일째' : '휴식') + '</b></li>'; }).join('') + '</ul>';
    return s;
  }

  function page3() {
    const r = R.result(), x = app().rsRun;
    if (!r) {
      return '<div class="pf-sec rs-p3-none"><div class="rs-blank">' + (R.running() ? '<span class="rs-spin big" aria-hidden="true"></span><b>날짜마다 넣는 중입니다</b>'
        : x && x.status === 'ERROR' && x.error ? '<b>재편성을 하지 못했습니다</b><span>' + esc(x.error) + '</span>'
          : '<b>아직 재편성 결과가 없습니다</b><span>기간·조건을 정하고 실행하면 결과가 여기에 나옵니다.</span>') + '<button class="btn" data-act="rs-page" data-p="2">' + icon('left') + '기간·조건으로</button></div></div>';
    }
    R.crossCheck(r);
    const n = (r.unplaced || []).length;
    const body = { grid: () => R.teamGrid(r), cal: () => '<div class="rsc-calwrap"><div class="rsc-cal">' + calendar(r) + '</div><aside class="rsc-side">' + calSide(r) + '</aside></div>', days: () => R.dayList(r, { cols: true }), metrics: () => R.metricsTable(r), unplaced: () => R.unplacedBlock(r) }[R.ui.view] || (() => R.teamGrid(r));
    return '<div class="pf-sec rs-p3">' + R.resultNotes(r) + R.tiles(r) +
      '<div class="rs-tabs" role="tablist">' + VIEWS.map(([k, label]) => '<button role="tab" class="' + (R.ui.view === k ? 'on' : '') + '" data-act="rs-view" data-v="' + k + '">' + label + (k === 'unplaced' && n ? ' <span class="rs-cn">' + n + '</span>' : '') + '</button>').join('') +
      '<span class="r"><span class="small muted">' + esc(R.version() ? R.version().name : '') + ' · ' + (r.engine === 'browser' ? '이 컴퓨터에서 낸 결과' : '서버에서 낸 결과') + '</span><button class="btn sm" data-act="rs-xlsx">' + icon('download') + '엑셀로 내려받기</button>' + R.publishButton(r, 'sm primary') + '</span></div>' +
      '<div class="rs-body rs-v-' + esc(R.ui.view) + '">' + body() + '</div></div>';
  }

  S.steps[9] = {
    render() {
      R.ensureVersion();
      if (!R.versions().length && S.planFlow && !S.planFlow.builtinFailed && !Object.keys(S.planFlow.builtin).length) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>저장한 버전을 불러오는 중입니다</h3></div></div></div>';
      // 실행이 끝나 결과가 생기면 결과 쪽으로
      const run = R.running();
      if (wasRunning && !run && R.result() && !R.stale(R.result())) { R.ui.page = 3; setTimeout(() => S.writeHash(), 0); }
      wasRunning = run;
      const p = page();
      return '<div class="stepview no-band"><div class="pf-page rs-page rs-steps">' +
        '<div class="rs-head"><h2>재편성</h2><span>1차 편성 뒤, 취소 경기와 잔여 경기를 날짜마다 넣습니다</span></div>' + R.publishedLine() + band() +
        '<div class="rs-pg rs-pg' + p + '">' + (p === 1 ? page1() : p === 2 ? page2() : page3()) + '</div></div></div>';
    },
    after() {
      if (R.running()) R.tick();
      const sel = R.scrollDay && document.querySelector('.rs-dl-day[data-date="' + R.scrollDay + '"]');
      if (sel) { sel.scrollIntoView({ block: 'start' }); R.scrollDay = null; }
    }
  };

  Object.assign(S.actions, {
    'rs-page': (el) => { R.ui.page = +el.dataset.p; S.writeHash(); S.render(); },
    'rsc-month': (el) => { R.ui.cmonth = el.dataset.m; S.writeHash(); S.render(); },
    'rsc-day': (el) => { R.ui.date = el.dataset.date; R.ui.cmonth = el.dataset.date.slice(0, 7); S.writeHash(); S.render(); }
  });

  S.rsView = {
    /** 자가 점검이 배치와 상관없이 쓰는 길: 발표한 경기 취소를 표시하는 곳 · 다시 짜기 단추가 있는 곳 */
    goRecancel(date) { R.ui.page = 1; R.ui.date = date; R.ui.month = Number(date.slice(5, 7)); S.writeHash(); S.render(); },
    goRerun() { R.ui.page = 2; S.writeHash(); S.render(); },
    footer() {
      const p = page(), r = R.result();
      const prev = p === 1 ? '<button class="btn" data-act="pf-home">' + icon('left') + '처음 화면</button>' : '<button class="btn" data-act="rs-page" data-p="' + (p - 1) + '">' + icon('left') + '이전: ' + PAGES[p - 2][1] + '</button>';
      const hint = '<span class="hint"><b>' + p + ' / 3 ' + PAGES[p - 1][1] + '</b> — ' + PAGES[p - 1][2] + '</span>';
      const next = p === 1 ? '<button class="btn primary" data-act="rs-page" data-p="2"' + (R.version() ? '' : ' disabled') + '>다음: 기간·조건' + icon('right') + '</button>'
        : p === 2 ? (r ? '<button class="btn" data-act="rs-page" data-p="3">결과 보기' + icon('right') + '</button>' : '')
          : r ? (R.isPublished(r) ? (R.stale(r) ? '<button class="btn primary" data-act="rs-page" data-p="2">다시 짜기' + icon('right') + '</button>' : '<button class="btn" data-act="rs-page" data-p="1">발표한 경기 취소 표시' + icon('right') + '</button>') : R.publishButton(r)) : '';
      return prev + hint + next;
    },
    homeEntry() {
      const C = S.homeCopy, n = R.versions().length;
      return '<div class="pf-ch rs-home"><div class="rs-home-t"><h2>' + esc(C.rsTitle) + '</h2><p class="what">' + esc(C.rsLead) + '</p></div><div class="rs-home-s">' + (n ? '2027 저장한 버전 ' + n + '개 중 하나로' : '2027 버전을 저장하면 쓸 수 있습니다') + '</div><button class="btn' + (n ? ' primary' : '') + '" data-act="rs-open">' + esc(C.rsButton) + icon('right') + '</button></div>';
    }
  };
})();
