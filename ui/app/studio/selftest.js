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
    // 5. 엔진 실행 (브라우저 Mock 엔진, 4초) → ③
    click('.step[data-step="2"]'); flush();
    S.app.setEngineConfig({ kind: 'MOCK', useWorker: false }); // 헤드리스 가상 시간에서는 Worker가 진행하지 않는다
    S.app.updateSolverSettings({ timeLimitSec: 4, unimprovedSec: 4 }); flush();
    click('[data-act="run-start"]');
    ok('실행 중 입력 잠금', S.app.isRunning() && !!document.querySelector('.lock-pill'));
    ok('실행 중에는 옵션 대신 진행 상태만', !document.querySelector('.choice') && !!document.querySelector('.run-status'));
    await wait(300);
    S.app.stop(); await wait(300); flush();
    ok('중지 → 실행 종료 후 ③ 이동', S.ui.step === 3 && !S.app.isRunning() && !!S.lastRun, 'step ' + S.ui.step);
    S.app.undo(); flush(); // 엔진 실행 체크포인트로 되돌려 뒤 검사가 알려진 일정에서 돌게 한다
    S.app.updateSolverSettings({ timeLimitSec: 10, unimprovedSec: 5 });
    // 6. 위반 클릭 → 위치
    S.ui.month = 3; flush();
    const v = document.querySelector('.vitem'); v.click(); flush();
    ok('위반 클릭 → 해당 월·강조', Number.isFinite(S.ui.month) && document.querySelectorAll('.gm.vsel').length > 0 && S.ui.sel.startsWith('v:'), 'month ' + S.ui.month);
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
    ok('스냅샷 복원 (슬롯 교환 전 → H1 해소)', hard() === 1, 'hard ' + hard());
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
    click('[data-act="run-time"][data-v="20"]'); flush();
    const t5 = S.app.state.settings.solver.timeLimitSec;
    click('[data-act="run-time"][data-v="30"]'); flush();
    const t30 = S.app.state.settings.solver.timeLimitSec;
    ok('실행 시간 프리셋 → timeLimitSec', t5 === 20 && t30 === 30 && document.querySelector('[data-act="run-time"][data-v="30"]').classList.contains('on'), t5 + ' / ' + t30);
    click('[data-act="run-time"][data-v="10"]'); flush();
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
    click('.itable tr[data-name="slots"]'); flush();
    const rbOk = document.querySelectorAll('.imp-viz[data-viz="ribbon"] .rd.chg').length > 0;
    ok('가져오기 미리보기 시각화 (시리즈 행렬·슬롯 띠)', mxOk && rbOk, 'matrix ' + mxOk + ' · ribbon ' + rbOk);
    click('[data-act="close-modal"]'); flush();
    // 18. ④ 지표 차트 클릭 → 구단 강조 (opt-2: 비교표는 띠를 펼쳐야 DOM에 있다)
    S.go({ step: 4, qv: 'metrics', team: null, mtOpen: true });
    click('.mc-item[data-team="NC"]'); flush();
    const selRow = document.querySelector('.mt tbody tr.sel');
    ok('지표 차트 클릭 → 구단 강조', S.ui.team === 'NC' && selRow && /NC/.test(selRow.textContent) && document.querySelectorAll('.mc-item.sel[data-team="NC"]').length === 4, 'sel ' + document.querySelectorAll('.mc-item.sel').length);
    const dot = document.querySelector('.mc-item[data-team="LG"]');
    dot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush();
    ok('차트 요소 키보드(Enter) 선택', S.ui.team === 'LG');

    // ───────── opt-2 추가 점검 ─────────
    // 18a. 요약 카드 값 = 코어 지표에서 직접 계산한 값
    S.go({ step: 4, qv: 'metrics', team: null, mtOpen: false });
    {
      const ex = S.app.derived().ex, T = ex.teamMetrics, L = ex.league;
      const card = (id) => document.querySelector('.q-card[data-card="' + id + '"]');
      const over = T.filter((t) => t.overDistance).map((t) => t.name);
      const big = T.slice().sort((a, b) => Math.abs(b.distanceKm - L.meanDistanceKm) - Math.abs(a.distanceKm - L.meanDistanceKm))[0];
      const wk = T.map((t) => t.weekendHome);
      const c1 = card('mean'), c2 = card('over'), c3 = card('dev'), c4 = card('wk');
      const v1 = c1 && c1.getAttribute('data-v') === L.meanDistanceKm.toFixed(1) && +c1.getAttribute('data-total') === L.totalKm && c1.textContent.includes(S.fmt.km(L.meanDistanceKm));
      const v2 = c2 && +c2.getAttribute('data-v') === over.length && c2.getAttribute('data-teams') === over.join(',') && c2.querySelectorAll('.q-chip').length === over.length;
      const v3 = c3 && c3.getAttribute('data-team') === big.name && c3.getAttribute('data-v') === (big.distanceKm - L.meanDistanceKm).toFixed(1);
      const v4 = c4 && +c4.getAttribute('data-v') === Math.max(...wk) - Math.min(...wk);
      ok('요약 카드 값 (평균·초과·최대 편차·주말 홈 편차)', v1 && v2 && v3 && v4, '평균 ' + (c1 && c1.getAttribute('data-v')) + ' · 초과 ' + (c2 && c2.getAttribute('data-v')) + ' · 편차 ' + (c3 && c3.getAttribute('data-team')) + ' ' + (c3 && c3.getAttribute('data-v')) + ' · 주말 ' + (c4 && c4.getAttribute('data-v')));
      const sum = document.querySelector('.q-band-sum');
      ok('구단 선택 없음 → 접힌 띠에 한 줄 요약', !!sum && getComputedStyle(sum).display !== 'none' && /범위 밖 칸/.test(sum.textContent) && !document.querySelector('.q-band-sel'));
      c3.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush();
      ok('가장 큰 편차 카드 키보드(Enter) 선택', S.ui.team === big.name);
      S.go({ team: null });
      ok('차트 2×2 = 이동거리 막대 + 점 차트 3개', document.querySelectorAll('.q-charts .mc-box').length === 4 && document.querySelectorAll('.q-charts [data-chart="distance"] .mc-item').length === T.length && ['moves', 'holiday', 'weekend'].every((id) => document.querySelectorAll('.q-charts [data-chart="' + id + '"] .mc-item').length === T.length));
    }
    // 18b. 비교표 띠 접기·펼치기
    {
      const closed0 = !document.querySelector('.q-band .mt') && document.querySelector('.q-band-head').getAttribute('aria-expanded') === 'false';
      click('[data-act="q-mt"]'); flush();
      const open1 = document.querySelectorAll('.q-band-body .mt tbody tr').length === S.app.state.teams.length && /mt=1/.test(location.hash) && document.querySelector('.q-dash.open') && document.querySelector('.q-band-head').getAttribute('aria-expanded') === 'true';
      click('[data-act="q-mt"]'); flush();
      const closed2 = !document.querySelector('.q-band .mt') && !/mt=1/.test(location.hash);
      ok('비교표 띠 접기 → 펼치기(표 10행·주소 mt=1) → 접기', closed0 && open1 && closed2, closed0 + ' · ' + !!open1 + ' · ' + closed2);
    }
    // 18c. 카드 클릭 → 대시보드 전체 강조 (카드·막대·점 3개·띠 요약, 펼치면 표 행)
    {
      const c3 = document.querySelector('.q-card[data-card="dev"]');
      const big = c3.getAttribute('data-team');
      click('.q-card[data-card="dev"]'); flush();
      const all = (name) => document.querySelectorAll('.mc-item.sel[data-team="' + name + '"]').length === 4 && !!document.querySelector('.q-band-sel[data-team="' + name + '"]') && document.querySelectorAll('.q-card-sel.on').length === 4 && Array.from(document.querySelectorAll('.q-card-sel.on')).every((e) => e.textContent.includes(name));
      ok('카드 클릭 → 막대·점·띠·카드 모두 강조', S.ui.team === big && document.querySelector('.q-card[data-card="dev"]').classList.contains('sel') && all(big), big);
      click('.q-card[data-card="over"] .q-chip[data-team="SSG"]'); flush();
      const chipSel = !!document.querySelector('.q-card[data-card="over"] .q-chip.sel[data-team="SSG"]') && !document.querySelector('.q-card[data-card="dev"]').classList.contains('sel');
      S.go({ mtOpen: true });
      const row = document.querySelector('.mt tbody tr.sel');
      ok('카드 구단 칩 클릭 → 펼친 표 행까지 강조', S.ui.team === 'SSG' && chipSel && all('SSG') && row && /SSG/.test(row.textContent));
      click('.q-charts [data-chart="holiday"] .mc-item[data-team="한화"]'); flush();
      ok('점 차트 클릭 → 카드·표·막대 강조', S.ui.team === '한화' && all('한화') && /한화/.test((document.querySelector('.mt tbody tr.sel') || {}).textContent || ''));
      S.go({ mtOpen: false });
    }
    // 18d. ② 큰 실행 시간 카드 → timeLimitSec
    {
      S.go({ step: 2, ops: null });
      const cards = document.querySelectorAll('.choices.big .choice.bc[data-act="run-time"]');
      const got = [];
      for (const sec of [30, 20, 10]) {
        click('.choice.bc[data-act="run-time"][data-v="' + sec + '"]'); flush();
        const on = document.querySelectorAll('.choice.bc[data-act="run-time"][aria-checked="true"]');
        got.push(S.app.state.settings.solver.timeLimitSec === sec && on.length === 1 && on[0].getAttribute('data-v') === String(sec) && on[0].classList.contains('on') ? sec : 'x' + S.app.state.settings.solver.timeLimitSec);
      }
      click('.choice.bc[data-act="run-time"][data-v="30"]'); flush();
      const pick = /충분히 30초/.test(document.querySelector('.bc-pick').textContent);
      click('.choice.bc[data-act="run-time"][data-v="10"]'); flush();
      ok('큰 실행 시간 카드 3장 → timeLimitSec (30·20·10), 요약 줄 반영', cards.length === 3 && got.join(',') === '30,20,10' && pick, got.join(','));
      click('.choice.bc[data-act="solver-init"][data-v="SCRATCH"]'); flush();
      const sc = S.app.state.settings.solver.init === 'SCRATCH' && /처음부터 새로 짜기/.test(document.querySelector('.bc-pick').textContent);
      click('.choice.bc[data-act="solver-init"][data-v="KEEP"]'); flush();
      ok('큰 시작 방식 카드 2장 → init, 편성 시작 버튼', document.querySelectorAll('.choice.bc[data-act="solver-init"]').length === 2 && sc && S.app.state.settings.solver.init === 'KEEP' && !!document.querySelector('.btn.go[data-act="run-start"]'));
    }
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

    // 19b. 처음부터 입력하기(초기화) → 빈 상태 화면 → 튜토리얼 순서대로 끝까지 입력 → 예시 데이터 다시 불러오기
    {
      const errs0 = window.__studioErrors.length;
      const st = () => S.app.state;
      S.go({ ops: null, step: 1, tab: 'slots', drawer: null, modal: null, menu: null, cell: null, edit: null });
      click('.band [data-act="reset-ask"][data-kind="blank"]'); flush();
      ok('초기화: 띠 단추 → 확인 창(비우는 것·남기는 것)', S.ui.modal === 'reset' && /남기는 것/.test(document.querySelector('.reset-modal').textContent) && /구단과 거리/.test(document.querySelector('.reset-modal').textContent));
      click('.reset-modal [data-act="reset-go"]'); flush();
      const blankInfo = () => ['blank ' + S.isBlank(), 'cal ' + st().calendar.length, 'm ' + st().matches.length, 'ev ' + st().events.length, 'hol ' + st().settings.holidays.length, 'rex ' + st().settings.restExceptions.length, 'blk ' + st().settings.blackouts.length, 'start "' + st().settings.seasonStart + '"', 'teams ' + st().teams.length, 'dist ' + st().distanceMatrix.length, 'tab ' + S.ui.tab, 'modal ' + S.ui.modal, 'inputs ' + document.querySelectorAll('.form-grid input[data-k]').length].join(' · ');
      const blankNow = () => S.isBlank() && !st().calendar.length && !st().matches.length && !st().events.length && !st().settings.holidays.length && !st().settings.restExceptions.length && !st().settings.blackouts.length && st().settings.seasonStart === '' && st().teams.length === 10 && st().distanceMatrix.length === 100;
      ok('초기화: 표 비움(구단 10·거리 100은 남김) → 시즌 기본 설정 화면', blankNow() && S.ui.tab === 'season' && !S.ui.modal && document.querySelectorAll('.form-grid input[data-k]').length === 3 && Array.from(document.querySelectorAll('.form-grid input[data-k]')).every((i) => i.value === ''), blankInfo());
      ok('초기화: 띠는 「2025 예시 데이터 불러오기」·현재 데이터 직접 입력', !!document.querySelector('.band [data-act="reset-ask"][data-kind="example"]') && /직접 입력/.test(document.querySelector('.band .last').textContent));
      S.app.undo(); flush();
      ok('초기화: 실행 취소 → 2025 데이터 복귀', !S.isBlank() && st().calendar.length === 45 && hard() === 3);
      S.app.redo(); flush();
      ok('초기화: 다시 실행 → 다시 빈 상태', blankNow(), blankInfo());
      // 빈 상태에서 모든 화면이 오류 없이 그려진다
      const e1 = window.__studioErrors.length;
      for (const t of ['season', 'holidays', 'restex', 'blackouts', 'slots', 'series', 'events', 'teams']) S.go({ step: 1, tab: t, cell: null, edit: null });
      S.go({ step: 2 }); S.go({ step: 3, view: 'calendar' }); S.go({ step: 3, view: 'slots' }); S.go({ step: 3, view: 'matrix' });
      for (const q of ['metrics', 'soft', 'a1', 'a2', 'a3', 'a4', 'a5', 'sched', 'export']) S.go({ step: 4, qv: q, team: 'KT' });
      S.go({ ops: 'games' }); S.go({ ops: 'reschedule' }); S.go({ ops: null, step: 1, tab: 'slots' });
      ok('빈 상태: ①~④·시즌 운영 모든 화면 콘솔 오류 0', window.__studioErrors.length === e1, String(window.__studioErrors.slice(e1).join(' | ')).slice(0, 120));
      ok('빈 상태: 단계 ② 사전 점검 「진행 불가」(연전 기간·시리즈 없음)', S.app.preflight().counts.block >= 2 && document.querySelector('.step[data-step="2"] .st').classList.contains('block'));
      // 빈 표: 첫 줄 추가 (줄을 고르지 않아도 됨)
      ok('빈 표: 안내 문구와 「첫 줄 추가」·「규칙대로 자동 채우기」 단추', !!document.querySelector('.sheet-empty [data-act="row-ins"]') && !!document.querySelector('.sheet-empty [data-act="draft-slots"]') && !document.querySelector('.toolbar [data-act="row-ins"][data-pos="below"]').disabled);
      click('.sheet-empty [data-act="row-ins"]'); flush();
      ok('빈 표: 첫 줄 추가 → 1줄·선택됨', st().calendar.length === 1 && S.ui.cell && S.ui.cell.row === 0 && !document.querySelector('.sheet-empty'));
      S.app.undo(); flush();
      // 튜토리얼 순서 1: 시즌 기본 설정
      S.go({ tab: 'season' });
      ok('빈 상태: 시즌 달력 대신 안내 · 자동 채우기 잠김', !!document.querySelector('.rb-empty') && document.querySelector('.insp [data-act="draft-slots"]').disabled);
      const setDate = (k, v) => { const i = document.querySelector('.form-grid input[data-k="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      setDate('seasonStart', '2025-03-22'); setDate('initialEnd', '8/31'); setDate('seasonEnd', '2025-10-31');
      const gd1 = document.querySelector('.insp .gd-check');
      ok('시즌 기본 설정 입력 → 경기일 합 140 / 필요 135 (5일 많음) 안내', st().settings.initialEnd === '2025-08-31' && gd1 && gd1.getAttribute('data-ok') === '0' && /140/.test(gd1.textContent) && /135/.test(gd1.textContent) && !!document.querySelector('.insp .rb'), gd1 && gd1.textContent);
      // 2: 공휴일(단추) · 휴식일 경기 5/5 · 휴식기 5/8, 7/11~7/16
      S.go({ tab: 'holidays' });
      click('.sheet-empty [data-act="fill-holidays"]'); flush();
      ok('법정 공휴일 채우기 → 10일(5/5 어린이날 포함)', st().settings.holidays.length === 10 && st().settings.holidays.some((h) => h.date === '2025-05-05' && /어린이날/.test(h.name)) && S.ui.tab === 'holidays');
      S.go({ tab: 'restex', cell: null });
      click('.sheet-empty [data-act="row-ins"]'); flush();
      S.startEdit('restex', 0, 'date', '5/5'); document.getElementById('cellEditor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush();
      ok('휴식일 경기: 첫 줄 추가 → 5/5(월)', st().settings.restExceptions.length === 1 && st().settings.restExceptions[0] === '2025-05-05' && S.SHEETS.restex.rowIssues(st(), 0).length === 0);
      S.go({ tab: 'blackouts', cell: null });
      const putBlack = (row, s0, e0, name) => { for (const [col, v] of [['start', s0], ['end', e0], ['name', name]]) { S.startEdit('blackouts', row, col, v); document.getElementById('cellEditor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush(); } };
      click('.sheet-empty [data-act="row-ins"]'); flush(); putBlack(0, '5/8', '5/8', '어린이날 3연전 뒤 휴식');
      S.ui.cell = null; flush(); click('.toolbar [data-act="row-ins"][data-pos="below"]'); flush(); putBlack(1, '7/11', '7/16', '올스타 브레이크');
      ok('휴식기: 첫 줄·끝에 추가 → 2개', st().settings.blackouts.length === 2 && st().settings.blackouts[1].start === '2025-07-11' && st().settings.blackouts[1].end === '2025-07-16');
      S.go({ tab: 'season', cell: null });
      ok('날짜 몇 개로 경기일 합 맞음(135) · 시즌 기본 설정 완료', document.querySelector('.insp .gd-check').getAttribute('data-ok') === '1' && S.GUIDE_TASKS.find((t) => t.id === 'season').status().ok && S.GUIDE_TASKS.find((t) => t.id === 'dates').status().ok && S.guideNext().id === 'slots');
      // 3: 연전 기간 — 규칙대로 자동 채우기
      S.go({ tab: 'slots' });
      click('.sheet-empty [data-act="draft-slots"]'); flush();
      ok('연전 기간 자동 채우기 미리보기 (45개 추가 · 확인 칸 없음)', S.ui.modal === 'import' && S.ui.imp.kind === 'draft-slots' && S.ui.imp.sheets[0].rows === 45 && !document.querySelector('[data-in="imp-confirm"]') && !document.querySelector('[data-act="imp-apply"]').disabled);
      click('[data-act="imp-apply"]'); flush();
      const cal = st().calendar, exp = S.KBO.Preset.ENGINE_INPUT_2025.calendar;
      ok('연전 기간 45개 = 2025 실제 연전 기간', cal.length === 45 && cal.every((c, i) => c.datetime === exp[i].datetime && c.consecutive === exp[i].consecutive) && !st().snapshots.length && S.guideNext().id === 'series');
      // 4: 시리즈 — 맞대결 규칙대로 자동 채우기
      S.go({ tab: 'series' });
      click('.sheet-empty [data-act="draft-series"]'); flush();
      ok('시리즈 자동 채우기 미리보기 (225개 · 오류 0)', S.ui.modal === 'import' && S.ui.imp.kind === 'draft-series' && S.ui.imp.sheets[0].rows === 225 && S.ui.imp.sheets[0].errors.length === 0 && !document.querySelector('[data-in="imp-confirm"]'));
      click('[data-act="imp-apply"]'); flush();
      ok('시리즈 225개 · 맞대결 경기 수·연전 수 맞음', st().matches.length === 225 && S.GUIDE_TASKS.find((t) => t.id === 'series').status().ok && S.GUIDE_TASKS.find((t) => t.id === 'slots').status().ok && !document.querySelector('.insp .vz-cell.bad') && S.guideNext().id === 'events');
      // 5: 특별 경기 — 개막전·어린이날 단추
      S.go({ tab: 'events', cell: null });
      click('.sheet-empty [data-act="add-opening"]'); flush();
      ok('개막전 대진 추가 → 대진 지정 5개·고정 5', st().events.filter((e) => e.type === 'OPENING' && e.mode === 'MATCH' && e.date === '2025-03-22').length === 5 && st().matches.filter((m) => m.pinned).length === 5);
      click('.toolbar [data-act="add-children"]'); flush();
      const ch = st().events.find((e) => e.type === 'CHILDREN');
      ok('어린이날 구장 지정 추가 → 5/5 · 구장 5 · 오류 없음', !!ch && ch.stadiums.length === 5 && S.SHEETS.events.rowIssues(st(), st().events.length - 1).length === 0 && S.GUIDE_TASKS.find((t) => t.id === 'events').status().ok);
      S.startEdit('events', st().events.length - 1, 'stadiums', '사직야구장, 어디구장'); document.getElementById('cellEditor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush();
      ok('특별 경기 구장 칸 고치기: 모르는 구장은 오류', !!document.querySelector('.cell-pop') && /모르는 구장/.test(document.querySelector('.cell-pop').textContent));
      S.ui.edit = null; flush();
      // 6·7: 구단 그대로 → 다음 단계
      ok('빈 상태에서 끝까지: 할 일 모두 완료 → 「다음 단계로」 · 사전 점검 진행 불가 0', S.guideNext().id === 'next' && S.GUIDE_TASKS.find((t) => t.id === 'next').status().ok && S.app.preflight().counts.block === 0, 'next ' + S.guideNext().id + ' · ' + S.GUIDE_TASKS.map((t) => t.id + ':' + t.status().kind).join(',') + ' · block ' + S.app.preflight().items.filter((x) => x.status === 'block').map((x) => x.title + ' ' + x.detail).join(' / '));
      S.go({ step: 2 });
      ok('빈 상태에서 채운 데이터로 ② 점검 통과', document.querySelector('.step[data-step="2"] .st').classList.contains('ok') || S.app.preflight().counts.block === 0);
      ok('초기화 흐름 전체 콘솔 오류 0', window.__studioErrors.length === errs0, String(window.__studioErrors.slice(errs0).join(' | ')).slice(0, 120));
      // 예시 데이터 다시 불러오기
      S.go({ step: 1, tab: 'slots', cell: null, edit: null });
      S.ui.menu = 'data'; S.ui.menuPos = { x: 1200, y: 44 }; flush();
      click('.menu [data-act="reset-ask"][data-kind="example"]'); flush();
      ok('데이터 메뉴 → 예시 데이터 확인 창', S.ui.modal === 'reset' && /2025 예시 데이터/.test(document.querySelector('.reset-modal h3').textContent));
      click('.reset-modal [data-act="reset-go"]'); flush();
      ok('2025 예시 데이터 다시 불러오기 → 시연용 위반 3·중간 저장 1', !S.isBlank() && hard() === 3 && st().snapshots.length === 1 && st().games.length > 0 && S.ui.tab === 'slots');
      if (S.guideUI && S.guideUI.close) S.guideUI.close(); // 초기화 뒤 자동으로 열린 입력 안내를 닫는다(19a는 닫힌 상태에서 시작)
    }

    // 19a. ① 입력 안내 (안내 방식마다 자기 점검을 S.guideUI.selftest로 낸다)
    if (S.guideUI && S.guideUI.selftest) { S.go({ ops: null, step: 1, tab: 'slots', drawer: null, modal: null }); await S.guideUI.selftest({ ok, click, flush, wait }); if (S.guideUI.close) S.guideUI.close(); }

    // 20. 일반 모드 금지어 검사 (모든 단계·시즌 운영·설정·모달·메뉴, 선택 기능 모두 켬)
    for (const f of S.FEATURES) if (!f.must) S.features[f.id] = true;
    const BAD = [/\b(hard|soft)\b/i, /hard\//i, /H0-/, /\bH1\b/, /\bS[0-4]\b/, /\bR[HS]-\d/, /BendableLongScore/, /\[-?\d+\/-?\d+\]/, /\bNaN\b|undefined|Infinity/,
      // 2026-10 용어 정리: 개발자 말투와 예전 용어 (예전 시트 이름 안내 문구 「예전 이름(슬롯·…)」은 허용)
      /(?<!예전 이름\(|예전 이름 「|예전 시트 이름\()슬롯/, /인스펙터/, /스냅샷/, /프리셋/, /목업/, /구단쌍/, /UI ?입력|UI에서/, /휴일 ?가중치/, /시즌 띠/, /허용오차/, /위저드/, /§/, /\bFR-/, /\bMUST\b/, /미배정/, /\bDH\b/, /Δ/, /골격/, /(?<![·「])휴식예외일/, /(?<![·「])경기없는기간/, /머리글/, /미배정 풀|풀로/, /핀 고정|\(핀\)/, /OptaPlanner|멀티스타트|localStorage|\bREST\b|\bSSE\b|\bMock\b|meta\.features|gviz/, /[가-힣A-Z]{2,3} @ [가-힣A-Z]{2,3}/];
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
    for (const k of ['xlsx', 'draft-slots', 'draft-series']) at({ step: 1, tab: 'slots' }, '가져오기 ' + k, () => { S.openImport(k); for (const sh of S.ui.imp.sheets) { S.ui.imp.sel = sh.key; flush(); scan('가져오기 ' + k + ' ' + sh.name); } });
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
    at({ step: 4, qv: 'metrics', team: 'KT', mtOpen: true }, '④ metrics 표 펼침');
    at({ step: 4, qv: 'metrics', team: null, mtOpen: false }, '④ metrics 구단 없음');
    for (const q of ['metrics', 'soft', 'a1', 'a2', 'a3', 'a4', 'a5', 'a8', 'a9', 'a10', 'a12', 'sched', 'export']) at({ step: 4, qv: q, team: 'KT' }, '④ ' + q);
    for (const lv of ['S0', 'S1', 'S2', 'S3', 'S4']) at({ step: 4, qv: 'soft', softLevel: lv }, '④ soft ' + lv);
    at({ ops: 'games' }, '시즌 운영 경기 기록');
    at({ ops: 'reschedule', opsUnit: null }, '시즌 운영 재편성');
    const un = (S.app.state.reschedule.units || [])[0]; if (un) at({ ops: 'reschedule', opsUnit: un.id }, '재편성 묶음');
    at({ ops: 'route', team: 'KIA', routePos: 20.5 }, '시즌 운영 이동 경로');
    for (const t of ['features', 'scoring', 'data']) at({ ops: null, step: 1, tab: 'slots' }, '설정 ' + t, () => { S.ui.drawer = 'settings'; S.ui.setTab = t; });
    // 빈 상태(처음부터 입력하기) 화면들
    at({ ops: null, step: 1, tab: 'slots' }, '초기화 확인 창', () => { S.ui.resetKind = 'blank'; S.ui.modal = 'reset'; });
    if (S.app.run && S.app.run.handle && !S.app.run.handle.on) S.app.run = null; // 시연 '실행 중' 잠금 해제
    ok('금지어 검사용 초기화', S.resetAll({ quiet: true, stay: true }) === true && S.isBlank());
    for (const t of ['season', 'holidays', 'restex', 'blackouts', 'slots', 'series', 'events', 'teams']) at({ step: 1, ops: null, tab: t, cell: null }, '빈 ① ' + t);
    at({ step: 1, tab: 'slots' }, '빈 자동 채우기', () => { S.openImport('draft-slots'); });
    at({ step: 1, tab: 'series' }, '빈 시리즈 자동 채우기', () => { S.openImport('draft-series'); });
    at({ step: 2 }, '빈 ②');
    at({ step: 3, sel: null, view: 'calendar' }, '빈 ③');
    at({ step: 3, view: 'slots' }, '빈 ③ 연전 목록');
    for (const q of ['metrics', 'a1', 'a3', 'a5', 'sched', 'export']) at({ step: 4, qv: q, team: 'KT' }, '빈 ④ ' + q);
    at({ ops: 'games' }, '빈 시즌 운영');
    S.loadExample({ quiet: true, stay: true }); S.go({ ops: null, step: 1, tab: 'slots', modal: null, drawer: null, menu: null });
    if (S.guideUI && S.guideUI.screens) { for (const g of S.guideUI.screens()) at(Object.assign({ ops: null, step: 1 }, g.patch || {}), '입력 안내 ' + g.where, g.fn); if (S.guideUI.close) S.guideUI.close(); }
    ok('일반 모드 금지어 없음 (' + screens + '개 화면)', leaks.length === 0, leaks.slice(0, 12).join(' / '));
    // 검사기 자체 확인: 개발자 모드에서는 같은 검사가 코드·원점수를 잡아야 한다
    S.devOverride = true; leaks.length = 0;
    at({ step: 3, sel: null, view: 'calendar' }, '개발자 ③');
    S.devOverride = null;
    ok('검사기 자체 확인 (개발자 모드에서는 잡힘)', leaks.length >= 3, leaks.length + '건');
    // 14. 탐색 과정 재생기(§4.2): 합성 트레이스로 모달·스텝 이동·닫기 (네트워크 없이)
    {
      const tr = { seed: 7, initialScore: { hard: [0, 0], soft: [0, 0, -10, -2, -1000] },
        teams: [{ index: 0, name: 'A' }, { index: 1, name: 'B' }, { index: 2, name: 'C' }, { index: 3, name: 'D' }],
        slots: [{ id: 0, start: '2025-03-22', games: 3 }, { id: 1, start: '2025-03-25', games: 3 }, { id: 2, start: '2025-03-28', games: 3 }],
        series: [{ id: 0, home: 0, away: 1, games: 3, slot: 0 }, { id: 1, home: 2, away: 3, games: 3, slot: 0 }, { id: 2, home: 1, away: 0, games: 3, slot: 1 }, { id: 3, home: 3, away: 2, games: 3, slot: 1 }, { id: 4, home: 0, away: 2, games: 3, slot: 2 }, { id: 5, home: 1, away: 3, games: 3, slot: 2 }],
        events: [{ elapsedMs: 10, score: { hard: [0, 0], soft: [0, 0, -4, -2, -980] }, changes: [[0, 0, 1], [2, 1, 0]] }, { elapsedMs: 20, score: { hard: [0, 0], soft: [0, 0, 0, 0, -900] }, changes: [[4, 2, 1], [3, 1, 2]] }] };
      const keep = S.lastRun;
      S.run = null; if (S.app.run && S.app.run.handle && !S.app.run.handle.on) S.app.run = null; // 시연 '실행 중' 상태 해제
      S.lastRun = Object.assign({}, keep || { history: [], elapsed: 0, improvements: 0, reason: '', count: 1, when: '' }, { trace: tr });
      click('.step[data-step="2"]'); flush();
      ok('지난 실행 결과에 「탐색 과정 보기」(트레이스가 있을 때만)', !!document.querySelector('[data-act="open-replay"]'));
      click('[data-act="open-replay"]'); flush();
      const p = S.replayPlayer;
      ok('재생기 모달: 카드 6장 · 슬롯 3개 · 곡선 5개', S.ui.modal === 'replay' && !!p && document.querySelectorAll('.modal .rp-card').length === 6 && document.querySelectorAll('.modal .rp-slot').length === 3 && document.querySelectorAll('.modal .rp-lv').length === 5);
      p.stepFwd(); p.stepFwd();
      ok('한 스텝 앞 ×2 → 마지막 상태·해설', p.idx === 2 && /2번째 개선/.test(document.querySelector('.modal .rp-cap').textContent) && document.querySelector('.modal .rp-ev').textContent === '2' && Array.from(p.model.states[2].assign).join(',') === '1,0,0,2,1,2');
      p.stepBack(); p.stepBack();
      ok('한 스텝 뒤 ×2 → 시작 상태', p.idx === 0 && /시작 상태/.test(document.querySelector('.modal .rp-cap').textContent));
      click('.modal [data-act="close-modal"]'); flush();
      ok('재생기 닫힘', !S.ui.modal && !document.querySelector('.rp'));
      p.destroy(); S.replayPlayer = null;
      S.lastRun = keep;
    }
    S.resetFeatures(); S.go({ ops: null, step: 1, drawer: null, modal: null, menu: null });
  } catch (e) {
    out.push('FAIL 예외: ' + e.message);
  }
    S.quiet = false;
    const fails = out.filter((x) => x.startsWith('FAIL')).length;
    document.documentElement.setAttribute('data-selftest', (fails ? 'FAIL ' + fails : 'ALL PASS') + ' / ' + out.length + ' :: ' + out.join(' | '));
  }
  setTimeout(run, 50);
  // opt-2: 점검 항목은 std 49개 + opt-2 10개 + 재생기 5개
})();
