/*
 * 편성 스튜디오 — 날짜 단위 재편성 화면 (step=9, 2027) · 기본안: 왼쪽 입력 / 오른쪽 결과
 *  왼쪽: ① 1차 편성 버전 ② 취소 경기(달력에서 날 → 그날 경기에 「취소」·사유) ③ 기간·꼭 지키는 값·기준 순서 → 실행
 *  오른쪽: 결과 숫자 한 줄 + 보기 넷(구단×날짜 표 · 날짜별 경기 · 평가 숫자 · 못 넣은 경기) + 엑셀
 *  부품은 reschedule-parts.js(S.rs). 이 파일은 배치만 정한다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const R = S.rs;
  if (!R) return; // ?classic=1·?selftest=1에는 계획 흐름이 없다
  const { esc, icon } = S;
  const app = () => S.app;
  const VIEWS = [['grid', '구단 × 날짜'], ['days', '날짜별 경기'], ['metrics', '평가 숫자'], ['unplaced', '못 넣은 경기']];

  function inputCol() {
    const v = R.version(), st = app().state.reschedule;
    let s = '<section class="pf-sec rs-in1"><h3><span class="rs-no">1</span>1차 편성 버전</h3>' + R.versionPicker() + '</section>';
    if (!v) return s;
    s += '<section class="pf-sec rs-in2"><h3><span class="rs-no">2</span>취소 경기<span class="r">' + ((st.games || []).length ? '<button class="pf-link" data-act="rs-clear">모두 풀기</button>' : '') + '</span></h3><p class="pf-d">열리지 못한 경기를 표시합니다. 대진과 홈은 그대로, 날짜만 다시 정합니다.</p>' +
      R.cancelCalendar() + R.dayGames() +
      '<details class="rs-det"' + ((st.games || []).length && !R.ui.date ? ' open' : '') + '><summary>표시한 취소 경기 ' + (st.games || []).length + '</summary>' + R.cancelList({ compact: true }) + '</details></section>';
    s += '<section class="pf-sec rs-in3"><h3><span class="rs-no">3</span>기간과 조건</h3>' + R.periodForm() + R.limitsForm() +
      '<details class="rs-det"><summary>좋은 일정의 기준 순서 <span class="muted">위가 먼저</span></summary>' + R.orderForm() + '</details></section>';
    return s;
  }

  function resultCol() {
    const r = R.result(), run = R.running();
    if (!R.version()) return '<div class="rs-blank"><b>결과</b><span>왼쪽에서 1차 편성 버전을 고르세요.</span></div>';
    if (!r) {
      const x = app().rsRun;
      const pre = R.problem() && !R.problem().error ? '<h4>배정할 경기</h4>' + R.targetTable() : '';
      return '<div class="rs-pre">' + pre + '<div class="rs-blank">' + (run ? '<span class="rs-spin big" aria-hidden="true"></span><b>날짜마다 넣는 중입니다</b><span>끝나면 구단 × 날짜 표와 날짜별 경기가 여기에 나옵니다.</span>'
        : x && x.status === 'ERROR' && x.error ? '<b>재편성을 하지 못했습니다</b><span>' + esc(x.error) + '</span>'
          : '<b>아직 재편성 결과가 없습니다</b><span>취소 경기를 표시하고 기간·조건을 정한 뒤 「재편성 실행」을 누르면 날짜마다 넣은 일정이 여기에 나옵니다.</span>') + '</div></div>';
    }
    R.crossCheck(r);
    const n = (r.unplaced || []).length;
    let s = R.resultNotes(r) + R.tiles(r);
    s += '<div class="rs-tabs" role="tablist">' + VIEWS.map(([k, label]) => '<button role="tab" class="' + (R.ui.view === k ? 'on' : '') + '" data-act="rs-view" data-v="' + k + '">' + label + (k === 'unplaced' && n ? ' <span class="rs-cn">' + n + '</span>' : '') + '</button>').join('') +
      '<span class="r"><span class="small muted">' + (r.engine === 'browser' ? '이 컴퓨터에서 낸 결과' : '서버에서 낸 결과') + '</span><button class="btn sm" data-act="rs-xlsx">' + icon('download') + '엑셀로 내려받기</button></span></div>';
    const body = { grid: () => R.teamGrid(r), days: () => R.dayList(r, { cols: true }), metrics: () => R.metricsTable(r), unplaced: () => R.unplacedBlock(r) }[R.ui.view] || (() => R.teamGrid(r));
    s += '<div class="rs-body rs-v-' + esc(R.ui.view) + '">' + body() + '</div>';
    return s;
  }

  S.steps[9] = {
    render() {
      R.ensureVersion();
      if (!R.versions().length && S.planFlow && !S.planFlow.builtinFailed && !Object.keys(S.planFlow.builtin).length) return '<div class="stepview no-band"><div class="pf-page"><div class="pf-sec"><h3>저장한 버전을 불러오는 중입니다</h3></div></div></div>';
      return '<div class="stepview no-band"><div class="pf-page rs-page rs-std">' +
        '<div class="rs-head"><h2>재편성</h2><span>1차 편성 뒤, 취소 경기와 잔여 경기를 날짜마다 넣습니다</span></div>' +
        '<div class="rs-cols"><div class="rs-left"><div class="rs-left-in">' + inputCol() + '</div>' + (R.version() ? '<div class="rs-left-foot">' + R.targetSummary() + R.runBox() + '</div>' : '') + '</div>' +
        '<div class="rs-right pf-sec">' + resultCol() + '</div></div></div></div>';
    },
    after() {
      if (R.running()) R.tick();
      const sel = R.scrollDay && document.querySelector('.rs-dl-day[data-date="' + R.scrollDay + '"]');
      if (sel) { sel.scrollIntoView({ block: 'start' }); R.scrollDay = null; }
    }
  };

  S.rsView = {
    footer() {
      const r = R.result();
      return '<button class="btn" data-act="pf-home">' + icon('left') + '처음 화면</button><span class="hint"><b>재편성</b> — 1차 편성 버전에 취소 경기를 표시하고, 기간과 조건을 정해 실행합니다</span>' + (r ? '<button class="btn" data-act="rs-xlsx">' + icon('download') + '엑셀로 내려받기</button>' : '');
    },
    homeEntry() {
      const C = S.homeCopy, n = R.versions().length;
      return '<div class="pf-ch rs-home"><div class="rs-home-t"><h2>' + esc(C.rsTitle) + '</h2><p class="what">' + esc(C.rsLead) + '</p></div><div class="rs-home-s">' + (n ? '2027 저장한 버전 ' + n + '개 중 하나로' : '2027 버전을 저장하면 쓸 수 있습니다') + '</div><button class="btn' + (n ? ' primary' : '') + '" data-act="rs-open">' + esc(C.rsButton) + icon('right') + '</button></div>';
    }
  };
})();
