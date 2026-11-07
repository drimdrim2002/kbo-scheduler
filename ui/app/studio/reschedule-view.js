/*
 * 편성 스튜디오 — 날짜 단위 재편성 화면 (step=9, 2027) · 대안 B: 세 쪽으로 나눈 단계
 *  1 취소 경기: 버전 · 큰 달력(왼쪽) · 그날 경기와 표시한 취소 경기(오른쪽)
 *  2 기간·조건: 기간 · 꼭 지키는 값 · 기준 순서(왼쪽) · 배정할 경기 표(오른쪽) · 실행 — 실행이 끝나면 3으로
 *  3 결과: 결과 숫자 한 줄 + 보기 넷(구단×날짜 표 · 날짜별 경기 · 평가 숫자 · 못 넣은 경기) + 엑셀, 화면 폭을 다 쓴다
 *  쪽은 주소 rp=1|2|3. 부품은 reschedule-parts.js(S.rs). 이 파일은 배치만 정한다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const R = S.rs;
  if (!R) return; // ?classic=1·?selftest=1에는 계획 흐름이 없다
  const { esc, icon } = S;
  const app = () => S.app;
  const VIEWS = [['grid', '구단 × 날짜'], ['days', '날짜별 경기'], ['metrics', '평가 숫자'], ['unplaced', '못 넣은 경기']];
  const PAGES = [[1, '취소 경기', '열리지 못한 경기 표시'], [2, '기간·조건', '기간 · 꼭 지키는 값 · 기준 순서'], [3, '결과', '날짜마다 넣은 일정']];
  R.ui.page = null;
  let wasRunning = false;

  // 주소에 쪽(rp)을 더한다
  const base = S.stepHash[9];
  S.stepHash[9] = {
    write(o) { base.write(o); if (R.ui.page) o.rp = R.ui.page; },
    read(o) { base.read(o); R.ui.page = ['1', '2', '3'].includes(o.rp) ? +o.rp : null; }
  };
  const page = () => R.ui.page || (R.result() ? 3 : 1); // 주소·단추로 고르지 않았으면 결과가 있을 때 결과 쪽

  function band() {
    const cur = page(), r = R.result(), n = (app().state.reschedule.games || []).length;
    const sub = { 1: n ? '취소 ' + n + '경기 표시' : '아직 표시 없음', 2: R.problem() && R.problem().error ? '실행할 수 없음' : R.running() ? '실행 중' : '정했으면 실행', 3: r ? (R.stale(r) ? '조건이 바뀜 · 다시 실행' : '결과 있음') : '실행 뒤' };
    return '<nav class="rs-band" aria-label="재편성 단계">' + PAGES.map(([k, name]) => '<button class="rs-bstep' + (k === cur ? ' on' : '') + (k < cur ? ' done' : '') + '" data-act="rs-page" data-p="' + k + '"' + (k === cur ? ' aria-current="step"' : '') + '><span class="rs-no">' + k + '</span><span class="nm"><b>' + name + '</b><span>' + esc(sub[k]) + '</span></span></button>').join('') + '</nav>';
  }

  function page1() {
    const v = R.version(), st = app().state.reschedule;
    let s = '<div class="rs-p1"><section class="pf-sec rs-p1-cal"><div class="rs-p1-top">' + R.versionPicker() + '</div>';
    if (!v) return s + '</section></div>';
    s += '<h3>달력에서 날짜를 고르세요<span class="r">' + R.targetSummary() + '</span></h3><p class="pf-d">대진과 홈은 그대로, 날짜만 다시 정합니다.</p>' + R.cancelCalendar({ big: true }) + '</section>';
    s += '<section class="pf-sec rs-p1-side"><h3>그날 경기</h3>' + R.dayGames() +
      '<h3 class="rs-h3b">표시한 취소 경기 ' + (st.games || []).length + '<span class="r">' + ((st.games || []).length ? '<button class="pf-link" data-act="rs-clear">모두 풀기</button>' : '') + '</span></h3>' + R.cancelList({ compact: true }) + '</section></div>';
    return s;
  }

  function page2() {
    if (!R.version()) return '<div class="pf-sec">' + R.versionPicker() + '</div>';
    const pr = R.problem();
    return '<div class="rs-p2"><section class="pf-sec rs-p2-in"><h3>기간</h3>' + R.periodForm() + '<h3>꼭 지키는 값</h3>' + R.limitsForm() + '<h3>좋은 일정의 기준 순서<span class="r muted small">위가 먼저</span></h3>' + R.orderForm() + '</section>' +
      '<section class="pf-sec rs-p2-t"><h3>배정할 경기</h3>' + (pr && !pr.error ? R.targetTable() : '') + '<div class="rs-p2-run">' + R.targetSummary() + R.runBox() + '</div></section></div>';
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
    const body = { grid: () => R.teamGrid(r), days: () => R.dayList(r, { cols: true }), metrics: () => R.metricsTable(r), unplaced: () => R.unplacedBlock(r) }[R.ui.view] || (() => R.teamGrid(r));
    return '<div class="pf-sec rs-p3">' + R.resultNotes(r) + R.tiles(r) +
      '<div class="rs-tabs" role="tablist">' + VIEWS.map(([k, label]) => '<button role="tab" class="' + (R.ui.view === k ? 'on' : '') + '" data-act="rs-view" data-v="' + k + '">' + label + (k === 'unplaced' && n ? ' <span class="rs-cn">' + n + '</span>' : '') + '</button>').join('') +
      '<span class="r"><span class="small muted">' + esc(R.version() ? R.version().name : '') + ' · ' + (r.engine === 'browser' ? '이 컴퓨터에서 낸 결과' : '서버에서 낸 결과') + '</span><button class="btn sm" data-act="rs-xlsx">' + icon('download') + '엑셀로 내려받기</button></span></div>' +
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
        '<div class="rs-head"><h2>재편성</h2><span>1차 편성 뒤, 취소 경기와 잔여 경기를 날짜마다 넣습니다</span></div>' + band() +
        '<div class="rs-pg rs-pg' + p + '">' + (p === 1 ? page1() : p === 2 ? page2() : page3()) + '</div></div></div>';
    },
    after() {
      if (R.running()) R.tick();
      const sel = R.scrollDay && document.querySelector('.rs-dl-day[data-date="' + R.scrollDay + '"]');
      if (sel) { sel.scrollIntoView({ block: 'start' }); R.scrollDay = null; }
    }
  };

  S.actions['rs-page'] = (el) => { R.ui.page = +el.dataset.p; S.writeHash(); S.render(); };

  S.rsView = {
    footer() {
      const p = page(), r = R.result();
      const prev = p === 1 ? '<button class="btn" data-act="pf-home">' + icon('left') + '처음 화면</button>' : '<button class="btn" data-act="rs-page" data-p="' + (p - 1) + '">' + icon('left') + '이전: ' + PAGES[p - 2][1] + '</button>';
      const hint = '<span class="hint"><b>' + p + ' / 3 ' + PAGES[p - 1][1] + '</b> — ' + PAGES[p - 1][2] + '</span>';
      const next = p === 1 ? '<button class="btn primary" data-act="rs-page" data-p="2"' + (R.version() ? '' : ' disabled') + '>다음: 기간·조건' + icon('right') + '</button>'
        : p === 2 ? (r ? '<button class="btn" data-act="rs-page" data-p="3">결과 보기' + icon('right') + '</button>' : '')
          : r ? '<button class="btn" data-act="rs-xlsx">' + icon('download') + '엑셀로 내려받기</button>' : '';
      return prev + hint + next;
    },
    homeEntry() {
      const C = S.homeCopy, n = R.versions().length;
      return '<div class="pf-ch rs-home"><div class="rs-home-t"><h2>' + esc(C.rsTitle) + '</h2><p class="what">' + esc(C.rsLead) + '</p></div><div class="rs-home-s">' + (n ? '2027 저장한 버전 ' + n + '개 중 하나로' : '2027 버전을 저장하면 쓸 수 있습니다') + '</div><button class="btn' + (n ? ' primary' : '') + '" data-act="rs-open">' + esc(C.rsButton) + icon('right') + '</button></div>';
    }
  };
})();
