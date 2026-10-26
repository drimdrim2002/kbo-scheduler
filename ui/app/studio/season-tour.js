/*
 * 편성 스튜디오 — ① 시즌 달력: 따라 하기(처음 한 번)
 * 2025 예시 데이터로 네 가지를 직접 해 본다. 달력 위에 테두리(어디)와 작은 카드(무엇을)를 띄운다.
 *   ① 4/8(화)~4/10(목)을 끌어 묶음 만들기 — 시작할 때 그 묶음을 비워 둔다(경기일 132일)
 *   ② 묶음을 눌러 연전 수 바꾸기
 *   ③ 5/5를 눌러 홈 구장 지정 보기
 *   ④ 경기일 합 135 맞추기
 * 한 번 보면 기억한다(S.ls). 오른쪽 아래 「따라 하기 다시 보기」로 다시 연다. 주소 tour=0이면 뜨지 않고, tour=1~4면 그 단계를 보여 준다.
 * 마치거나 닫으면 따라 하기에서 바꾼 것을 원래대로 되돌린다(예시 데이터가 그대로 남도록).
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates } = KBO;
  const app = () => S.app;
  const C = S.cal;
  const store = S.guideStore('cal-tour');
  const dn = Dates.dayNum;
  const D48 = dn('2025-04-08'), D55 = dn('2025-05-05');
  let suppressed = false;
  const bAt = (d) => app().state.calendar.find((c) => dn(c.datetime) === d) || null;
  const isExample = () => !S.isBlank() && S.seasonYear() === 2025 && app().state.settings.seasonStart === '2025-03-22' && app().state.calendar.length >= 40;

  const STEPS = [
    { n: 1, title: '끌어서 연전 묶음 만들기', anchor: () => cellsOf(D48, 3),
      text: '4/8(화)부터 4/10(목)까지 마우스로 끌어 보세요. 3연전 묶음이 생깁니다. 묶음이 곧 경기일이라, 지금 비어 있는 이 사흘 때문에 경기일이 132일입니다.',
      done: () => { const b = bAt(D48); return !!b && b.consecutive === 3; } },
    { n: 2, title: '묶음을 눌러 연전 수 바꾸기', anchor: () => cellsOf(D48, 3),
      text: '방금 만든 묶음을 누르면 말풍선이 열립니다. 「2연전」을 눌러 연전 수를 바꿔 보세요. 둘로 나누기·지우기도 여기서 합니다.',
      done: () => !!(C.tour && C.tour.lenChanged) },
    { n: 3, title: '날을 눌러 홈 구장 지정', anchor: () => cellsOf(D55, 1),
      text: '5/5(월) 어린이날을 눌러 보세요. 오른쪽 「고른 날」에서 그 날 홈 경기를 해야 하는 구단 5곳을 고릅니다(개막전도 같은 방법). 상대는 자동 편성이 정합니다.',
      done: () => C.day === D55 },
    { n: 4, title: '경기일 합 135 맞추기', anchor: () => [document.getElementById('scCount')].filter(Boolean),
      text: '위의 「경기일 N / 135일」이 초록 「맞음」이 되게 맞추세요. 4/8 묶음을 다시 눌러 3연전으로 돌리면 됩니다. 맞으면 「다음: 검토·실행」으로 넘어갑니다.',
      done: () => S.gameDaysCheck().ok }
  ];
  function cellsOf(d, len) { const out = []; for (let k = 0; k < len; k++) { const el = document.querySelector('.sc-strip .sd[data-d="' + (d + k) + '"]'); if (el) out.push(el); } return out; }

  /** 따라 하기 시작: 예시 데이터가 아니면 불러오고(실행 취소 가능), 4/8~4/10 묶음을 비운다 */
  function start(step) {
    if (S.locked()) return false;
    const depth = app().store.undoStack.length;
    if (!isExample()) S.loadExample({ quiet: true, stay: true });
    C.tour = { step: step || 1, depth, lenChanged: false }; // depth: 시작 전 실행 취소 깊이(마칠 때 여기까지 되돌린다)
    S.g1.mode = 'cal'; S.g1.open = null; C.day = null; C.slotAt = null;
    if ((step || 1) === 1 && bAt(D48)) { const i = app().state.calendar.indexOf(bAt(D48)), q0 = S.quiet; S.quiet = true; S.calOps.removeBundle(i); S.quiet = q0; C.slotAt = null; }
    C.tour.ready = true;
    store.set({ seen: true });
    S.go({ step: 1, ops: null, modal: null, drawer: null, cell: null, edit: null });
    return true;
  }
  /** 마치기·닫기: 따라 하기에서 바꾼 것을 되돌린다 */
  function finish(keep) {
    const t = C.tour;
    if (!t) return;
    C.tour = null;
    if (!keep) { let n = 0; while (app().store.undoStack.length > t.depth && n < 50) { app().undo(); n++; } }
    C.day = null; C.slotAt = null;
    S.render();
    S.toast(keep ? '따라 하기를 마쳤습니다. 바꾼 것은 그대로 둡니다.' : '따라 하기를 마쳤습니다. 따라 하며 바꾼 것은 원래대로 되돌렸습니다. 오른쪽 아래 「따라 하기 다시 보기」로 다시 볼 수 있습니다.', 'info', 5500);
  }
  S.calTour = { start, finish, STEPS };

  /** 렌더 뒤(#guide 층): 단계를 넘기고 테두리·카드를 그린다 */
  S.calAfter = function (el) {
    if (!el) return;
    const onCal = S.ui.step === 1 && !S.ui.ops && S.g1 && S.g1.mode === 'cal' && !S.g1.open && !!document.querySelector('.sc-strip');
    // 처음 한 번: 시즌 달력에 처음 들어왔을 때(자가 점검·tour=0·잠금 때는 띄우지 않는다)
    const running = !!(S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED'));
    if (onCal && !C.tour && !suppressed && !S.selftestMode && !running && !S.guideBlocked() && !store.get().seen) { suppressed = true; setTimeout(() => start(1), 0); }
    const t = C.tour;
    // 따라 하는 중에 달력을 떠나면(②로·모든 표 보기·구단 정보 펼침·시즌 운영) 따라 하기를 닫고 바꾼 것을 되돌린다 — 4/8 묶음을 비운 채로 남지 않게
    if (t && !onCal && !S.guideBlocked() && t.ready) { el.innerHTML = ''; setTimeout(() => { if (C.tour === t) finish(false); }, 0); return; }
    if (!t || !onCal || S.guideBlocked()) { el.innerHTML = ''; return; }
    while (t.step <= STEPS.length && STEPS[t.step - 1].done()) t.step++;
    if (t.step > STEPS.length) { el.innerHTML = card(null); placeCard(el, []); return; }
    const s = STEPS[t.step - 1];
    const anchors = s.anchor();
    el.innerHTML = ring(anchors) + card(s);
    placeCard(el, anchors);
  };
  function ring(els) {
    if (!els.length) return '';
    const r = els.map((e) => e.getBoundingClientRect());
    const L = Math.min(...r.map((x) => x.left)), T = Math.min(...r.map((x) => x.top)), R = Math.max(...r.map((x) => x.right)), B = Math.max(...r.map((x) => x.bottom));
    return '<div class="ct-ring" style="left:' + (L - 4) + 'px;top:' + (T - 4) + 'px;width:' + (R - L + 8) + 'px;height:' + (B - T + 8) + 'px"></div>';
  }
  function card(s) {
    const dots = STEPS.map((x) => '<i class="' + (s && x.n === s.n ? 'on' : !s || x.n < s.n ? 'done' : '') + '"></i>').join('');
    if (!s) return '<div class="ct-card" role="dialog" aria-label="따라 하기 마침"><div class="ct-head"><span class="ct-no">' + icon('check') + '다 했습니다</span><span class="ct-dots">' + dots + '</span></div>' +
      '<p>끌어서 묶음 만들기 · 연전 수 바꾸기 · 홈 구장 지정 · 경기일 합 맞추기를 모두 해 봤습니다. 다른 날도 같은 방법으로 고칩니다. 따라 하며 바꾼 것은 원래대로 되돌립니다.</p>' +
      '<div class="ct-acts"><button class="btn sm primary" data-act="tour-end">' + icon('check') + '마치기</button></div></div>';
    return '<div class="ct-card" role="dialog" aria-label="따라 하기 ' + s.n + ' / ' + STEPS.length + '"><div class="ct-head"><span class="ct-no">따라 하기 ' + s.n + ' / ' + STEPS.length + '</span><span class="ct-dots">' + dots + '</span><button class="btn xs icon ghost" data-act="tour-end" title="닫기(바꾼 것은 되돌림)" aria-label="따라 하기 닫기">' + icon('x') + '</button></div>' +
      '<h4>' + esc(s.title) + '</h4><p>' + esc(s.text) + '</p>' +
      '<div class="ct-acts"><span class="ct-hint">2025 예시 데이터로 합니다</span><button class="btn xs" data-act="tour-skip">건너뛰기' + icon('right') + '</button></div></div>';
  }
  /** 카드는 테두리 오른쪽(넘치면 아래·위), 화면 안에 */
  function placeCard(el, anchors) {
    const c = el.querySelector('.ct-card');
    if (!c) return;
    const W = window.innerWidth, H = window.innerHeight, cw = c.offsetWidth, ch = c.offsetHeight;
    let left, top;
    if (anchors.length) {
      const pop = document.getElementById('scPop'); // 열린 말풍선은 가리지 않는다
      const r = anchors.concat(pop && pop.offsetParent ? [pop] : []).map((x) => x.getBoundingClientRect());
      const R = Math.max(...r.map((x) => x.right)), T = Math.min(...r.map((x) => x.top)), B = Math.max(...r.map((x) => x.bottom)), L = Math.min(...r.map((x) => x.left));
      left = R + 14; top = T - 8;
      if (left + cw > W - 8) { left = Math.max(8, L); top = B + 12; }
      if (top + ch > H - 8) top = T - ch - 12;
    } else { left = (W - cw) / 2; top = (H - ch) / 2; }
    c.style.left = Math.max(8, Math.min(left, W - cw - 8)) + 'px';
    c.style.top = Math.max(8, Math.min(top, H - ch - 8)) + 'px';
  }

  // 주소: tour=0 → 띄우지 않음, tour=1~4 → 그 단계(점검·스크린샷용)
  const route0 = S.calRoute;
  S.calRoute = function (o) {
    if (route0) route0(o);
    if (o.tour === '0') suppressed = true;
    else if (/^[1-4]$/.test(o.tour || '') && !C.tour) { suppressed = true; const n = +o.tour; setTimeout(() => start(n), 0); }
  };
  const hash0 = S.calHash;
  S.calHash = function (o) { if (hash0) hash0(o); if (C.tour && C.tour.step <= STEPS.length) o.tour = C.tour.step; };

  Object.assign(S.actions, {
    'cal-tour': () => start(1),
    'tour-skip': () => { const t = C.tour; if (!t) return; t.skipped = (t.skipped || 0) + 1; if (t.step === 2) t.lenChanged = true; t.step++; S.render(); },
    'tour-end': () => finish(false)
  });
})();
