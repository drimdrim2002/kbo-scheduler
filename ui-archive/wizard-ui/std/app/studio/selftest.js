/*
 * alt-a 편성 스튜디오 — 상호작용 자가 점검 (?selftest=1 일 때만 읽는다)
 * 실제 클릭 경로(S.actions·S.inputs)를 차례로 실행하고 결과를 <html data-selftest>에 적는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const out = [];
  const ok = (name, cond, info) => out.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' (' + info + ')' : ''));
  const click = (sel) => { const el = document.querySelector(sel); if (!el) throw new Error('없음: ' + sel); if (typeof el.click === 'function') el.click(); else el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return el; };
  const flush = () => S.render();
  const hard = () => S.app.derived().ex.violations.length;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function run() {
  try {
    try { localStorage.removeItem(S.KEY + 'features'); localStorage.removeItem(S.KEY + 'dev'); } catch (e) { /* 무시 */ }
    S.devOverride = null;
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
    ok('실행 중에는 옵션 대신 진행 상태만', !document.querySelector('.choice') && !!document.querySelector('.run-status'));
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

    // ───────── std 추가 점검 ─────────
    // 13. ② 실행 시간 프리셋 → timeLimitSec, 일반 모드에는 개발자 옵션 없음
    S.go({ step: 2, ops: null, drawer: null, modal: null });
    ok('일반 모드: 개발자 옵션 없음', !document.querySelector('.devopt') && !document.querySelector('.badge-score'));
    click('[data-act="run-time"][data-v="300"]'); flush();
    const t5 = S.app.state.settings.solver.timeLimitSec;
    click('[data-act="run-time"][data-v="1800"]'); flush();
    const t30 = S.app.state.settings.solver.timeLimitSec;
    ok('실행 시간 프리셋 → timeLimitSec', t5 === 300 && t30 === 1800 && document.querySelector('[data-act="run-time"][data-v="1800"]').classList.contains('on'), t5 + ' / ' + t30);
    click('[data-act="run-time"][data-v="60"]'); flush();
    click('[data-act="solver-init"][data-v="SCRATCH"]'); flush();
    ok('시작 방식 → init', S.app.state.settings.solver.init === 'SCRATCH');
    click('[data-act="solver-init"][data-v="KEEP"]'); flush();
    // 14. 개발자 모드 켜기·끄기 → Hard/Soft·원점수 표시
    click('.tb-btn[data-act="open-settings"]'); flush();
    click('[data-act="set-tab"][data-tab="features"]'); flush();
    let dv = document.getElementById('devToggle'); dv.checked = true; dv.dispatchEvent(new Event('change', { bubbles: true })); flush();
    const onTxt = document.body.textContent;
    const onScore = !!document.querySelector('.badge-score') && /hard\//.test(document.querySelector('.badge-score').textContent);
    click('[data-act="close-drawer"]'); flush();
    const devOpt = !!document.querySelector('.devopt');
    click('[data-act="dev-open"]'); flush();
    const trendOn = !!document.querySelector('.devopt-body .trend') && /Hard 합/.test(document.querySelector('.devopt-body').textContent);
    ok('개발자 모드 켜면 Hard/Soft·원점수·개발자 옵션', /Hard/.test(onTxt) && onScore && devOpt && trendOn, 'score ' + onScore + ' · opt ' + devOpt + ' · trend ' + trendOn);
    let saved2 = null; try { saved2 = localStorage.getItem(S.KEY + 'dev'); } catch (e) { saved2 = null; }
    ok('개발자 모드 localStorage 저장', saved2 === '1');
    click('.tb-btn[data-act="open-settings"]'); flush();
    dv = document.getElementById('devToggle'); dv.checked = false; dv.dispatchEvent(new Event('change', { bubbles: true })); flush();
    click('[data-act="close-drawer"]'); flush();
    ok('개발자 모드 끄면 사라짐', !document.querySelector('.badge-score') && !document.querySelector('.devopt') && !/\bHard\b|\bSoft\b/.test(document.body.textContent));
    // 15. 시리즈 셀 편집 → 행렬 칸 변경
    S.go({ step: 1, tab: 'series', cell: { sheet: 'series', row: 30, col: 'away' }, edit: null });
    const m30 = Object.assign({}, S.app.state.matches[30]);
    const other = S.app.state.teams.map((t) => t.name).find((n) => n !== m30.home && n !== m30.away);
    const cellV = (h, a) => { const g = document.querySelector('.vz-cell[data-pair="' + h + '|' + a + '"]'); return g ? +g.getAttribute('data-v') : NaN; };
    const b1 = cellV(m30.home, m30.away), b2 = cellV(m30.home, other);
    S.startEdit('series', 30, 'away', other);
    document.getElementById('cellEditor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush();
    const a1 = cellV(m30.home, m30.away), a2 = cellV(m30.home, other);
    ok('시리즈 셀 편집 → 행렬 칸 변경', a1 === b1 - m30.consecutive && a2 === b2 + m30.consecutive && document.querySelectorAll('.vz-cell.chg').length === 2, b1 + '→' + a1 + ', ' + b2 + '→' + a2);
    ok('바뀐 칸 합 ≠ 15 표시', document.querySelectorAll('.vz-cell.bad').length >= 2);
    S.app.undo(); flush();
    ok('편집 실행 취소 → 행렬 복귀', cellV(m30.home, m30.away) === b1 && !document.querySelector('.vz-cell.chg'));
    // 16. 시즌 띠 (슬롯 선택 강조)
    S.go({ step: 1, tab: 'slots', cell: { sheet: 'slots', row: 4, col: 'start' } });
    ok('슬롯 선택 → 시즌 띠 강조', document.querySelectorAll('.insp .rd.sel').length === S.app.state.calendar[4].consecutive);
    // 17. 가져오기 미리보기 시각화
    click('.band [data-act="import-xlsx"]'); flush();
    const mxOk = !!document.querySelector('.imp-viz[data-viz="matrix"] svg .vz-cell.chg');
    click('.itable tr[data-name="슬롯"]'); flush();
    const rbOk = document.querySelectorAll('.imp-viz[data-viz="ribbon"] .rd.chg').length > 0;
    ok('가져오기 미리보기 시각화 (시리즈 행렬·슬롯 띠)', mxOk && rbOk, 'matrix ' + mxOk + ' · ribbon ' + rbOk);
    click('[data-act="close-modal"]'); flush();
    // 18. ④ 지표 차트 클릭 → 구단 강조
    S.go({ step: 4, qv: 'metrics', team: null });
    click('.mc-item[data-team="NC"]'); flush();
    const selRow = document.querySelector('.mt tbody tr.sel');
    ok('지표 차트 클릭 → 구단 강조', S.ui.team === 'NC' && selRow && /NC/.test(selRow.textContent) && document.querySelectorAll('.mc-item.sel[data-team="NC"]').length === 4, 'sel ' + document.querySelectorAll('.mc-item.sel').length);
    const dot = document.querySelector('.mc-item[data-team="LG"]');
    dot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush();
    ok('차트 요소 키보드(Enter) 선택', S.ui.team === 'LG');
    // 19. 이동 경로 재생·정지
    S.go({ ops: 'route', team: 'KT', routePos: 0, drawer: null, modal: null });
    click('[data-act="rt-play"]');
    await wait(800);
    const p1 = S.ui.routePos, playing = S.route.playing, drawn = document.querySelectorAll('#rtLayer path').length;
    click('[data-act="rt-play"]'); flush();
    const p2 = S.ui.routePos;
    await wait(400);
    ok('이동 경로 재생', playing && p1 > 0.3 && drawn > 0, 'pos ' + p1.toFixed(2));
    ok('이동 경로 정지', !S.route.playing && S.ui.routePos === p2 && !!document.querySelector('#rtPlay.primary'));
    click('.rt-cell[data-i="10"]'); flush();
    ok('타임라인 칸 → 위치 이동', Math.floor(S.ui.routePos) === 10 && /11 \/ /.test(document.getElementById('rtInfo').textContent));
    S.setFeature('A6', false); S.go({ ops: 'route' });
    ok('A6 끄면 이동 경로 탭 제거', !document.querySelector('[data-tab="route"]') && S.ui.ops === 'games');
    S.resetFeatures(); S.go({ ops: null, step: 1 });

    // 20. 일반 모드 금지어 검사 (모든 단계·시즌 운영·설정·모달·메뉴, 선택 기능 모두 켬)
    for (const f of S.FEATURES) if (!f.must) S.features[f.id] = true;
    const BAD = [/\b(hard|soft)\b/i, /hard\//i, /H0-/, /\bH1\b/, /\bS[0-4]\b/, /\bR[HS]-\d/, /BendableLongScore/, /\[-?\d+\/-?\d+\]/];
    const leaks = [];
    const scan = (where) => {
      const parts = [document.body.textContent];
      document.querySelectorAll('[title],[aria-label]').forEach((el) => { parts.push(el.getAttribute('title') || ''); parts.push(el.getAttribute('aria-label') || ''); });
      const txt = parts.join('\n');
      for (const re of BAD) { const m = txt.match(re); if (m) { const i = txt.indexOf(m[0]); leaks.push(where + ': "' + txt.slice(Math.max(0, i - 18), i + 14).replace(/\s+/g, ' ') + '"'); } }
    };
    let screens = 0;
    const at = (patch, where, fn) => { S.go(Object.assign({ modal: null, drawer: null, menu: null }, patch)); if (fn) fn(); flush(); scan(where); screens++; };
    for (const t of ['season', 'slots', 'series', 'holidays', 'restex', 'blackouts', 'events', 'teams']) at({ step: 1, ops: null, tab: t, cell: { sheet: t, row: 2, col: (S.SHEETS[t] && S.SHEETS[t].cols.find((c) => !c.ro) || { key: 'name' }).key } }, '① ' + t);
    at({ step: 1, tab: 'series' }, '① 한 건 편집', () => S.demos.edit()); S.ui.edit = null; S.app.undo();
    for (const k of ['xlsx', 'draft-slots', 'draft-series']) at({ step: 1, tab: 'slots' }, '가져오기 ' + k, () => { S.openImport(k); for (const sh of S.ui.imp.sheets) { S.ui.imp.sel = sh.name; flush(); scan('가져오기 ' + k + ' ' + sh.name); } });
    at({ step: 1 }, '구글 시트', () => { S.ui.modal = 'gsheet'; });
    at({ step: 2 }, '②');
    at({ step: 2 }, '② 차단', () => { S.demos.block(); }); S.app.undo();
    at({ step: 2 }, '② 실행 중', () => { S.demos.running(); });
    S.quiet = true; S.actions['run-stop'](); flush();
    for (const v of S.app.derived().ex.violations) at({ step: 3, sel: 'v:' + S.vsig(v), month: S.slotMonth(v.slot), view: 'calendar' }, '③ 위반 ' + v.code);
    at({ step: 3, sel: 'm:91', month: 5 }, '③ 시리즈');
    at({ step: 3, sel: null }, '③ 빈 인스펙터');
    at({ step: 3, view: 'slots' }, '③ 슬롯 목록');
    at({ step: 3, view: 'matrix' }, '③ 구단×슬롯');
    at({ step: 3, view: 'calendar' }, '③ 스냅샷 메뉴', () => { S.ui.menu = 'snap'; S.ui.menuPos = { x: 1200, y: 140 }; });
    at({ step: 3 }, '데이터 메뉴', () => { S.ui.menu = 'data'; S.ui.menuPos = { x: 1200, y: 44 }; });
    for (const q of ['metrics', 'soft', 'a1', 'a2', 'a3', 'a4', 'a5', 'a8', 'a9', 'a10', 'a12', 'sched', 'export']) at({ step: 4, qv: q, team: 'KT' }, '④ ' + q);
    for (const lv of ['S0', 'S1', 'S2', 'S3', 'S4']) at({ step: 4, qv: 'soft', softLevel: lv }, '④ soft ' + lv);
    at({ ops: 'games' }, '시즌 운영 경기 기록');
    at({ ops: 'reschedule', opsUnit: null }, '시즌 운영 재편성');
    const un = (S.app.state.reschedule.units || [])[0]; if (un) at({ ops: 'reschedule', opsUnit: un.id }, '재편성 묶음');
    at({ ops: 'route', team: 'KIA', routePos: 20.5 }, '시즌 운영 이동 경로');
    for (const t of ['features', 'scoring', 'data']) at({ ops: null, step: 1, tab: 'slots' }, '설정 ' + t, () => { S.ui.drawer = 'settings'; S.ui.setTab = t; });
    ok('일반 모드 금지어 없음 (' + screens + '개 화면)', leaks.length === 0, leaks.slice(0, 4).join(' / '));
    // 검사기 자체 확인: 개발자 모드에서는 같은 검사가 코드·원점수를 잡아야 한다
    S.devOverride = true; leaks.length = 0;
    at({ step: 3, sel: null, view: 'calendar' }, '개발자 ③');
    S.devOverride = null;
    ok('검사기 자체 확인 (개발자 모드에서는 잡힘)', leaks.length >= 3, leaks.length + '건');
    S.resetFeatures(); S.go({ ops: null, step: 1, drawer: null, modal: null, menu: null });
  } catch (e) {
    out.push('FAIL 예외: ' + e.message);
  }
    S.quiet = false;
    const fails = out.filter((x) => x.startsWith('FAIL')).length;
    document.documentElement.setAttribute('data-selftest', (fails ? 'FAIL ' + fails : 'ALL PASS') + ' / ' + out.length + ' :: ' + out.join(' | '));
  }
  setTimeout(run, 50);
})();
