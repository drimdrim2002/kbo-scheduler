/*
 * 편성 스튜디오 — ① 데이터 준비: 공통 바탕
 * 데이터로 판단하는 확인(경기일 합·연전 수 맞추기·맞대결 경기 수), 저장, 렌더 뒤 고리.
 * 보여 주는 방식(시즌 달력 한 화면·모든 표 보기)은 guide-steps.js가 S.guideUI로 정한다.
 * 예전 「할 일 9개(단계별 화면)」는 추천안 R(입력은 모두 시즌 달력 한 화면)로 바꾸며 없앴다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO } = S;
  const { CalendarGen } = KBO;
  const app = () => S.app;
  S.gtxt = (x) => (typeof x === 'function' ? x() : (x == null ? '' : String(x)));

  // ───────── 상태 판단 (데이터로) ─────────
  function sheetErrors(key) {
    const sh = S.SHEETS[key], st = app().state;
    const n = sh.rows(st).length;
    let e = 0, w = 0;
    for (let i = 0; i < n; i++) for (const x of sh.rowIssues(st, i)) { if (x.level === 'error') e++; else w++; }
    return { e, w };
  }
  S.guideSheetErrors = sheetErrors;
  /** 연전 수 맞추기: 연전 수(2·3·4)마다 「기간 수 × 구장 수」와 시리즈 수가 같은지 */
  S.guideBalance = function () {
    const st = app().state, half = st.teams.length >> 1;
    const sh = CalendarGen.lengthHistogram(st.calendar), mh = CalendarGen.lengthHistogram(st.matches);
    const off = [];
    for (const k of [2, 3, 4]) { const cap = (sh[k] || 0) * half, need = mh[k] || 0; if (cap !== need) off.push(k + '연전'); }
    return off;
  };
  function pairOff() {
    const st = app().state, target = st.settings.initialGamesPerPair;
    const names = st.teams.map((t) => t.name);
    const c = S.viz.pairCounts(st.matches, names);
    let off = 0;
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if ((c.get(names[i] + '|' + names[j]) || 0) + (c.get(names[j] + '|' + names[i]) || 0) !== target) off++;
    return off;
  }
  S.guidePairOff = pairOff;
  const seasonOK = () => { const s = app().state.settings; return !!(s.seasonStart && s.initialEnd && s.seasonEnd) && s.seasonStart < s.initialEnd && s.initialEnd <= s.seasonEnd && s.restWeekdays.length > 0; };
  S.guideSeasonOK = seasonOK;

  // ───────── 저장 (안내 방식마다 따로) ─────────
  /** variant: 'cal' 등. 반환: { get(), set(patch), reset() } — 값은 { seen, at, mode, off, done:{} } */
  S.guideStore = function (variant) {
    const key = S.KEY + 'guide-' + variant;
    const read = () => { try { return JSON.parse(S.ls.get(key) || 'null') || {}; } catch (e) { return {}; } };
    return {
      get: () => Object.assign({ seen: false, at: 0, mode: null, off: false, done: {} }, read()),
      set(patch) { const v = Object.assign(this.get(), patch); S.ls.set(key, JSON.stringify(v)); return v; },
      reset() { S.ls.del(key); }
    };
  };

  /** 모달·서랍·메뉴가 열려 있으면 안내를 잠시 숨긴다 */
  S.guideBlocked = () => !!(S.ui.modal || S.ui.drawer || S.ui.menu || S.ui.ops);

  // ───────── 렌더 고리 ─────────
  // shell.js가 S.render 끝(스크롤 점검 전)에 S.guideAfter()를, 키 입력 때 S.guideOnKey(e)를 부른다.
  // 「처음부터 입력하기」 직후에는 S.guideOnReset()을 부른다.
  S.guideAfter = function () {
    if (!S.guideUI || !S.guideUI.after) return;
    try { S.guideUI.after(document.getElementById('guide')); } catch (e) { console.error(e); }
  };
  S.guideOnKey = (e) => (S.guideUI && S.guideUI.onKey ? S.guideUI.onKey(e) : false);
  S.guideOnReset = () => { if (S.guideUI && S.guideUI.onReset) { try { S.guideUI.onReset(); } catch (e) { console.error(e); } } };
  /** 모든 표 보기 띠의 단추 (안내 방식이 정함) */
  S.guideButton = () => (S.guideUI && S.guideUI.button ? S.guideUI.button() : '');
})();
