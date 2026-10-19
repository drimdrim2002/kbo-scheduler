/* 개발용 상호작용 자가 점검: index.html?selftest=1 — 결과를 <html data-selftest>에 쓴다. */
(function () {
  'use strict';
  if (!/selftest=1/.test(location.search)) return;
  const R = window.R;
  const out = [];
  const ok = (name, cond, info) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (info != null ? ' (' + info + ')' : ''));
  const click = (sel) => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el) throw new Error('없음: ' + sel); el.click(); R.renderNow(); return el; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function run() {
    try {
      R.go({ step: 3, tab: 'calendar' }); R.renderNow();
      ok('③ 위반 3건', R.derived().ex.violations.length === 3, R.derived().ex.violations.length);
      ok('③ 가상 표시', document.querySelectorAll('.vitem .vtag').length === 3);
      click('.vitem');
      ok('위반 클릭 → 시리즈 선택', R.ui.sel != null && !!document.querySelector('.cc.is-sel'));
      const before = R.derived().ex.violations.length;
      click('.cand .btn');
      ok('교환 → 재채점', R.store.canUndo(), '위반 ' + before + '→' + R.derived().ex.violations.length);
      R.undo(); R.renderNow();
      ok('실행 취소 → 원래 위반 수', R.derived().ex.violations.length === before);
      const pin = document.querySelector('[data-in="pin"]'); pin.checked = !pin.checked; pin.dispatchEvent(new Event('change', { bubbles: true })); R.renderNow();
      ok('핀 토글', R.state().matches[R.ui.sel].pinned === pin.checked);
      R.undo(); R.renderNow();
      click('[data-act="tf"][data-team="LG"]');
      ok('구단 필터 홈/원정', document.querySelectorAll('.cc.is-home').length > 0 && document.querySelectorAll('.cc.is-away').length > 0);
      click('[data-act="tf-all"]');
      click('[data-act="menu"][data-menu="snap"]'); click('.snap-list li:last-child [data-act="snap-restore"]');
      ok('스냅샷 복원(KBO 발표안) → 편성 가능', R.derived().ex.violations.length === 0);
      R.undo(); R.renderNow();
      // ① 슬롯 셀 편집
      R.go({ step: 1, tab: 'slots' }); R.renderNow();
      click('[data-act="cell"][data-sheet="slots"][data-row="17"][data-col="consecutive"]');
      const inp = document.getElementById('celledit'); inp.value = '5'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      ok('셀 오류 표시', !!document.querySelector('.cellerr'));
      inp.value = '4'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); R.renderNow();
      ok('셀 확정 → 사전 점검 차단', R.derived().preflight.counts.block > 0 && R.state().calendar[17].consecutive === 4, '차단 ' + R.derived().preflight.counts.block);
      ok('② 단계 상태 차단', R.derived().steps[1].status === 'block');
      R.go({ step: 2 }); R.renderNow();
      click('.pf-go[data-row]');
      ok('사전 점검 링크 → 해당 행 강조', R.ui.step === 1 && R.curTab() === 'slots' && R.ui.selRow.slots === 17 && !!document.querySelector('#row-slots-17.flash'));
      R.undo(); R.renderNow();
      ok('실행 취소 → 3연전 복원', R.state().calendar[17].consecutive === 3);
      // ① 시리즈 삽입·삭제
      R.go({ step: 1, tab: 'series' }); R.renderNow();
      click('[data-act="row-ins"][data-sheet="series"][data-pos="below"]');
      ok('행 삽입', R.state().matches.length === 226 && document.querySelectorAll('tr[id^="row-series-"]').length === 226);
      click('[data-act="row-del"][data-sheet="series"]');
      ok('행 삭제', R.state().matches.length === 225);
      R.undo(); R.undo(); R.renderNow();
      ok('실행 취소 2번 → 225행·위반 3', R.state().matches.length === 225 && R.derived().ex.violations.length === 3);
      // 가져오기
      R.startImport('xlsx', { instant: true }); R.renderNow();
      ok('가져오기 미리보기 오류 2', document.querySelectorAll('.iss.error').length + 0 >= 1 && R.imp.sheets.reduce((a, s) => a + s.issues.filter((x) => x.kind === 'error').length, 0) === 2);
      click('[data-act="imp-fix"]'); click('[data-act="imp-focus"][data-id="series"]'); click('[data-act="imp-fix"]');
      const conf = document.querySelector('[data-in="imp-confirm"]'); conf.checked = true; conf.dispatchEvent(new Event('change', { bubbles: true })); R.renderNow();
      click('[data-act="imp-apply"]');
      ok('적용 → 배정 초기화', R.derived().pool.length === 225 && !R.ui.modal);
      R.undo(); R.renderNow();
      ok('적용 실행 취소', R.derived().pool.length === 0);
      // 기능 끄기
      R.go({ step: 3, tab: 'calendar' }); R.renderNow();
      ok('미배정 풀 보임', !!document.querySelector('.pool'));
      R.go({ view: 'settings' }); R.renderNow();
      const sw = document.querySelector('[data-in="feat"][data-id="M8"]'); sw.checked = false; sw.dispatchEvent(new Event('change', { bubbles: true }));
      R.go({ step: 3, tab: 'calendar' }); R.renderNow();
      ok('M8 끄기 → DOM에서 사라짐', !document.querySelector('.pool'));
      R.setFeature('M8', true);
      // 시즌 운영
      R.go({ view: 'ops', tab: 'games' }); R.renderNow();
      const need0 = R.targets().totals.need;
      click('[data-act="g-all"][data-s="CANCELLED"]');
      ok('일괄 취소 → 재편성 대상 증가', R.targets().totals.need === need0 + 5, need0 + '→' + R.targets().totals.need);
      R.undo(); R.renderNow();
      // 엔진 실행(목업)
      R.go({ step: 2 }); R.renderNow();
      click('[data-act="run-start"]');
      ok('실행 중 잠금', R.locked());
      await wait(9500);
      R.renderNow();
      ok('실행 완료 → ③ 이동', !R.locked() && R.ui.step === 3, 'step ' + R.ui.step);
    } catch (e) { ok('예외', false, e.message); }
    document.documentElement.setAttribute('data-selftest', out.join(' | '));
  }
  setTimeout(run, 300);
})();
