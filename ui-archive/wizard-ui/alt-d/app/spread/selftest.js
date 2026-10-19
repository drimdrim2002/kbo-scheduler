/*
 * alt-d — 상호작용 자체 점검 (?selftest=1). 실제 클릭 이벤트로 주요 흐름을 돌리고 결과를 DOM에 적는다.
 */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('selftest') !== '1') return;
  const SP = window.SP, app = SP.app, ui = SP.ui;
  const out = [];
  const ok = (name, cond, info) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (info != null ? ' — ' + info : ''));
  const click = (sel) => { SP.renderNow(); const el = document.querySelector(sel); if (!el) return false; el.click(); SP.renderNow(); return true; };
  const steps = [];
  const T = (fn) => steps.push(fn);
  T(() => { click('[data-act="go"][data-arg="3"]'); ok('장 전환 → 제3장', ui.step === 3); });
  T(() => { click('[data-act="month"][data-arg="6"]'); ok('월 탭 6월', ui.month === 6); });
  T(() => { const n = SP.ex().violations.length; ok('가상 위반 3건 (채점기)', n === 3 && SP.virtualCount() === 3, SP.ex().violations.map((v) => v.code).join(',')); });
  T(() => { click('.sp-vitem[data-arg="0"]'); ok('위반 클릭 → 5월·시리즈 선택', ui.month === 5 && ui.sel != null && !!document.querySelector('.sp-blk-focus'), 'sel=' + ui.sel); });
  T(() => { const m = ui.sel; const before = app.state.matches[m].pinned; click('[data-act="pin"]'); ok('핀 토글', app.state.matches[m].pinned === !before); click('[data-act="undo"]'); ok('실행 취소 → 핀 복귀', app.state.matches[m].pinned === before); });
  T(() => { click('[data-act="filterTeam"][data-arg="LG"]'); ok('구단 필터 LG', app.ui.teamFilter.has('LG') && document.querySelectorAll('.sp-g-hit').length > 0 && document.querySelectorAll('.sp-g-dim').length > 0); click('[data-act="filterClear"]'); });
  T(() => { const sel = ui.sel; SP.renderNow(); const b = document.querySelector('[data-act="swapWith"]'); const h0 = SP.ex().score.hard.join('/'); if (b) { b.click(); SP.renderNow(); } ok('교환 후보 클릭 → 재채점', !!b && app.store.canUndo(), h0 + ' → ' + SP.ex().score.hard.join('/')); click('[data-act="undo"]'); ok('실행 취소 → 점수 복귀', SP.ex().score.hard.join('/') === h0); void sel; });
  T(() => { click('[data-act="menu"][data-arg="snap"]'); const n = app.state.snapshots.length; document.getElementById('snap-name').value = '점검 스냅샷'; click('[data-act="snapSave"]'); ok('스냅샷 저장', app.state.snapshots.length === n + 1); click('[data-act="snapRestore"][data-arg="s-clean"]'); ok('스냅샷 복원(원본 배정) → H1 해소', !SP.ex().violations.some((v) => v.code === 'H1'), SP.ex().violations.map((v) => v.code).join(',')); click('[data-act="undo"]'); ok('실행 취소 → 위반 3건', SP.ex().violations.length === 3); });
  T(() => { SP.go(1, 'series'); SP.renderNow(); SP.startEdit('series', 11, 'away', 'LGG'); SP.renderNow(); const msg = document.querySelector('.sp-cell-msg-bad'); ok('셀 편집 오류 표시', !!msg && /LGG/.test(msg.textContent), msg && msg.textContent.trim()); click('[data-act="editFix"]'); ok('제안값으로 고치기 → LG', app.state.matches[11].away === 'LG'); click('[data-act="undo"]'); ok('실행 취소 → SSG', app.state.matches[11].away === 'SSG'); });
  T(() => { ui.row.series = 4; SP.renderNow(); const n = app.state.matches.length; click('[data-act="gridIns"][data-arg="series:4:below"]'); ok('행 삽입 → 226', app.state.matches.length === n + 1 && app.derived().pool.length === 1); ui.edit = null; ui.row.series = 5; SP.renderNow(); click('[data-act="gridDel"][data-arg="series:5"]'); ok('행 삭제 → 225', app.state.matches.length === n); });
  T(() => { SP.go(1, 'slots'); ui.row.slots = 2; SP.renderNow(); SP.startEdit('slots', 2, 'games', '5'); SP.renderNow(); ok('슬롯 연전 5 → 오류', !!document.querySelector('.sp-cell-msg-bad')); ui.edit = null; });
  T(() => { click('[data-act="importStart"][data-arg="xlsx"]'); ok('가져오기 미리보기 열림', ui.modal === 'import' && !!document.querySelector('.sp-modal')); const ap = document.querySelector('[data-act="impApply"]'); ok('오류 있으면 적용 잠금', ap && ap.disabled); click('[data-act="impFix"][data-arg="e1"]'); click('[data-act="impFix"][data-arg="e2"]'); const rb = document.querySelector('[data-chg="impReset"]'); rb.checked = true; rb.dispatchEvent(new Event('change', { bubbles: true })); SP.renderNow(); const ap2 = document.querySelector('[data-act="impApply"]'); ok('오류 고치고 초기화 확인 → 적용 가능', ap2 && !ap2.disabled); const sn = app.state.snapshots.length; ap2.click(); SP.renderNow(); ok('적용 → 배정 초기화 + 자동 스냅샷', app.derived().pool.length > 200 && app.state.snapshots.length === sn + 1 && app.state.settings.holidays.some((h) => h.date === '2025-06-03'), 'pool=' + app.derived().pool.length); click('[data-act="undo"]'); ok('실행 취소 1단계 → 배정 복귀', app.derived().pool.length === 0); });
  T(() => { SP.go(3, 'calendar'); ui.sel = 5; SP.renderNow(); ok('미배정 풀 표시(M8 켜짐)', /미배정 풀/.test(document.getElementById('sp-margin').textContent)); click('[data-act="modal"][data-arg="settings"]'); click('[data-act="feature"][data-arg="M8"]'); SP.closeModal(); SP.renderNow(); ok('M8 끄기 → DOM에서 사라짐', !/미배정 풀/.test(document.getElementById('sp-margin').textContent) && !document.querySelector('[data-act="toPool"]')); ok('기능 상태 meta.features 저장', app.state.meta.features.M8 === false); click('[data-act="modal"][data-arg="settings"]'); ok('Must 기능 잠금 표시', document.querySelectorAll('.sp-lockmark').length === 7); click('[data-act="featureReset"]'); SP.closeModal(); });
  T(() => { SP.go(4, 'metrics'); click('[data-act="sort"][data-arg="moves"]'); ok('지표 정렬', ui.sort.key === 'moves'); click('[data-act="selTeam"][data-arg="KIA"]'); ok('구단 선택 → 여백 상세', /선택한 구단 · KIA/.test(document.getElementById('sp-margin').textContent)); });
  T(() => { SP.goOps('games'); SP.renderNow(); const c0 = app.games().filter((g) => g.status === 'CANCELLED').length; ui.opsDate = '2025-08-12'; ui.cancelReason = 'RAIN'; click('[data-act="dayAll"][data-arg="CANCELLED"]'); const c1 = app.games().filter((g) => g.status === 'CANCELLED').length; ok('그날 경기 일괄 취소', c1 === c0 + 5, c0 + '→' + c1); click('[data-act="tab"][data-arg="resched"]'); SP.runResched(true); SP.renderNow(); const rex = app.rescheduleExplain(); ok('재편성 결과 (RH)', rex && rex.units.every((u) => u.days.length), rex && ('feasible=' + rex.feasible + ' units=' + rex.units.length)); });
  T(() => { SP.go(1, 'slots'); ui.row.slots = 40; SP.renderNow(); click('[data-act="gridDel"][data-arg="slots:40"]'); SP.go(2, 'check'); SP.renderNow(); const rb = document.querySelector('[data-act="runStart"]'); ok('사전 점검 차단 → 실행 잠금 + 위치 링크', app.preflight().counts.block > 0 && rb && rb.disabled && /차단 위치로 가기/.test(document.getElementById('sp-margin').textContent) && /⛔/.test(document.getElementById('sp-chapters').textContent)); app.undo(); SP.renderNow(); ok('실행 취소 → 차단 해소', app.preflight().counts.block === 0); });
  T(() => { SP.go(3, 'calendar'); const m = 120; if (app.state.matches[m].pinned) app.togglePin(m); app.togglePin(m); const s0 = app.derived().plan[m]; const n = app.state.matches.findIndex((x, i) => i !== m && !x.pinned && x.consecutive === app.state.matches[m].consecutive && app.derived().plan[i] !== s0 && app.derived().plan[i] >= 0); app.togglePin(m, false); app.swapMatches(m, n); app.togglePin(m, true); ui.pinTest = { m, slot: app.derived().plan[m] }; ok('핀 고정 후 교환 준비', app.state.matches[m].pinned && app.derived().plan[m] !== s0); });
  T(() => { SP.go(2, 'check'); click('[data-act="runStart"]'); ok('엔진 실행 → 입력 잠금', SP.isRunning() && app.isRunning() && !!document.querySelector('.sp-lock')); ok('실행 중 편집 거부', app.togglePin(10) === false); });
  let i = 0;
  function next() {
    if (i < steps.length) { try { steps[i++](); } catch (e) { ok('예외', false, e.message); } setTimeout(next, 30); return; }
    setTimeout(() => {
      ok('실행 종료 → 제3장 이동', !SP.isRunning() && ui.step === 3, 'step=' + ui.step);
      ok('재최적화 후 핀 시리즈 자리 유지 (AC-7)', app.derived().plan[ui.pinTest.m] === ui.pinTest.slot, ui.pinTest.slot + ' → ' + app.derived().plan[ui.pinTest.m]);
      ok('콘솔 오류 0', (window.__spErrors || []).length === 0, (window.__spErrors || []).join(' | '));
      const pre = document.createElement('pre'); pre.id = 'sp-selftest'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
    }, 7500);
  }
  setTimeout(next, 100);
})();
