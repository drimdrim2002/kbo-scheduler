/*
 * alt-a 편성 스튜디오 — 상호작용 자가 점검 (?selftest=1 일 때만 읽는다)
 * 실제 클릭 경로(S.actions·S.inputs)를 차례로 실행하고 결과를 <html data-selftest>에 적는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const out = [];
  const ok = (name, cond, info) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' (' + info + ')' : ''));
  const click = (sel) => { const el = document.querySelector(sel); if (!el) throw new Error('없음: ' + sel); el.click(); return el; };
  const flush = () => S.render();
  const hard = () => S.app.derived().ex.violations.length;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
  try {
    try { localStorage.removeItem(S.KEY + 'features'); } catch (e) { /* 무시 */ }
    S.loadFeatures();
    S.quiet = true;
    // 1. 단계 이동
    for (const n of [2, 3, 4, 1]) { click('.step[data-step="' + n + '"]'); flush(); ok('단계 ' + n + ' 이동', S.ui.step === n && document.querySelector('.step.active .step-no').textContent === String(n)); }
    // 2. 셀 편집 + 검증 오류 + 수정
    click('[data-act="d-tab"][data-tab="series"]'); flush();
    const away0 = S.app.state.matches[10].away;
    S.startEdit('series', 10, 'away', 'LGG');
    document.getElementById('cellEditor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    ok('셀 오류 표시', !!document.querySelector('.cell-pop') && S.app.state.matches[10].away === away0, document.querySelector('.cell-pop') ? document.querySelector('.cell-pop').textContent.slice(0, 40) : '');
    ok('단계 ① 경고 상태', document.querySelector('.step[data-step="1"] .st').classList.contains('warn'));
    click('[data-act="cell-fix"]'); flush();
    ok('제안 값으로 수정 반영', S.app.state.matches[10].away === 'LG');
    S.app.undo(); flush();
    ok('편집 실행 취소', S.app.state.matches[10].away === away0);
    // 3. 행 삽입·삭제
    const n0 = S.app.state.matches.length;
    S.ui.cell = { sheet: 'series', row: 5, col: 'home' }; flush();
    click('[data-act="row-ins"][data-pos="below"]'); flush();
    ok('행 삽입', S.app.state.matches.length === n0 + 1 && document.querySelectorAll('.sheet tbody tr').length === n0 + 1);
    click('.toolbar [data-act="row-del"]'); flush();
    ok('행 삭제', S.app.state.matches.length === n0);
    S.app.undo(); S.app.undo(); flush();
    ok('삽입·삭제 실행 취소', S.app.state.matches.length === n0 && hard() === 3);
    // 4. 가져오기 흐름
    click('.band [data-act="import-xlsx"]'); flush();
    ok('가져오기 미리보기 열림', !!document.querySelector('.modal .itable') && document.querySelectorAll('.issue .ic.e').length === 2, '오류 ' + document.querySelectorAll('.issue .ic.e').length);
    ok('적용 버튼 잠김(확인 전)', document.querySelector('[data-act="imp-apply"]').disabled);
    const cb = document.querySelector('[data-in="imp-confirm"]'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); flush();
    const snaps0 = S.app.state.snapshots.length;
    click('[data-act="imp-apply"]'); flush();
    ok('적용 → 스냅샷·공휴일 반영', !S.ui.modal && S.app.state.snapshots.length === snaps0 + 1 && S.app.state.settings.holidays.some((h) => h.date === '2025-06-03'));
    S.app.undo(); flush();
    ok('가져오기 실행 취소', !S.app.state.settings.holidays.some((h) => h.date === '2025-06-03'));
    // 5. 엔진 실행 (목업) → ③
    click('.step[data-step="2"]'); flush();
    click('[data-act="run-start"]');
    ok('실행 중 입력 잠금', S.app.isRunning() && !!document.querySelector('.lock-pill'));
    await wait(6800);
    ok('실행 종료 후 ③ 이동', S.ui.step === 3 && !S.app.isRunning(), 'step ' + S.ui.step);
    // 6. 위반 클릭 → 위치
    S.ui.month = 3; flush();
    const v = document.querySelector('.vitem'); v.click(); flush();
    ok('위반 클릭 → 해당 월·강조', S.ui.month === 5 && document.querySelectorAll('.gm.vsel').length > 0 && S.ui.sel.startsWith('v:'));
    // 7. 조치 후보 적용 → 위반 감소 → 되돌리기
    const before = hard();
    click('.insp [data-act="apply-cand"]'); flush();
    ok('조치 후보 적용(Δ)', hard() < before, before + ' → ' + hard());
    S.app.undo(); flush();
    ok('조치 실행 취소', hard() === before);
    // 8. 구단 필터
    click('[data-act="tf"][data-team="KT"]'); flush();
    ok('구단 필터', document.querySelectorAll('.gm.dim').length > 0 && document.querySelectorAll('.gm .fm').length > 0);
    click('[data-act="tf-clear"]'); flush();
    // 9. 시리즈 선택·핀
    click('.gm[data-m="91"]'); flush();
    const pin = document.querySelector('[data-in="pin"]'); pin.checked = true; pin.dispatchEvent(new Event('change', { bubbles: true })); flush();
    ok('핀 고정', S.app.state.matches[91].pinned === true && !!document.querySelector('.gm[data-m="91"] .pin-ico'));
    S.app.undo(); flush();
    // 10. 스냅샷 저장·복원
    const snaps1 = S.app.state.snapshots.length;
    click('[data-act="snap-menu"]'); flush();
    click('[data-act="snap-save"]'); flush();
    ok('스냅샷 저장', S.app.state.snapshots.length === snaps1 + 1);
    click('[data-act="snap-menu"]'); flush();
    const first = document.querySelector('[data-act="snap-restore"][data-id="s-engine-1"]'); first.click(); flush();
    ok('스냅샷 복원 (슬롯 교환 전 → H1 해소)', hard() === 2, 'hard ' + hard());
    S.app.undo(); flush();
    // 11. 시즌 운영: 날짜 일괄 취소, 재편성
    click('[data-act="open-ops"]'); flush();
    const date = S.ui.opsDate;
    click('[data-act="o-bulk"][data-status="CANCELLED"]'); flush();
    ok('경기 일괄 취소 기록', S.app.games().filter((g) => g.date === date).every((g) => g.status === 'CANCELLED'), date);
    click('[data-act="ops-tab"][data-tab="reschedule"]'); flush();
    click('[data-act="rs-run"]'); await wait(1500); flush();
    const rex = S.app.rescheduleExplain();
    ok('재편성 결과', !!rex && rex.units.every((u) => u.days.length > 0), rex ? rex.units.length + '묶음 · RH ' + rex.violations.length : '없음');
    click('[data-act="close-ops"]'); flush();
    // 12. 설정: 기능 끄기 → DOM에서 사라짐, localStorage 저장
    click('.step[data-step="3"]'); flush();
    ok('미배정 풀 표시(기본 켜짐)', !!document.querySelector('[data-drop-pool]'));
    click('.tb-btn[data-act="open-settings"]'); flush();
    const f = document.querySelector('[data-in="feat"][data-id="M8"]'); f.checked = false; f.dispatchEvent(new Event('change', { bubbles: true })); flush();
    click('[data-act="close-drawer"]'); flush();
    let saved = null; try { saved = JSON.parse(localStorage.getItem(S.KEY + 'features')); } catch (e) { saved = null; }
    ok('M8 끄면 화면에서 제거', !document.querySelector('[data-drop-pool]') && saved && saved.M8 === false);
    ok('Must 잠금', document.querySelectorAll('[data-in="feat"][data-id="A1"]').length === 0);
    S.resetFeatures(); flush();
  } catch (e) {
    out.push('FAIL 예외: ' + e.message);
  }
    S.quiet = false;
    const fails = out.filter((x) => x.startsWith('FAIL')).length;
    document.documentElement.setAttribute('data-selftest', (fails ? 'FAIL ' + fails : 'ALL PASS') + ' / ' + out.length + ' :: ' + out.join(' | '));
  }
  setTimeout(run, 50);
})();
