/*
 * 편성 스튜디오 — ① 데이터 준비 2·3단계: 같은 시즌 달력 하나
 *  2 시즌 기간·연전 묶음: 연도는 이미 골랐으니 개막일(토요일 중 고르기)만 고르면 바로 규칙대로 묶음을 깐다(단추 없이, 실행 취소 한 번).
 *    1차 편성 종료일 = 경기일 135일이 되는 첫 일요일(자동), 올스타 휴식기 = 7월 둘째 금요일부터 6일(자동) — 자동으로 채운 값은 「자동」 표시와 이유 + 고치기.
 *    고칠 곳만 달력에서: 날짜를 끌면 2·3·4연전 묶음, 묶음을 누르면 연전 수 바꾸기·둘로 나누기·지우기.
 *  3 공휴일·홈 구장: 왼쪽 공휴일 표(가중치 · 공휴일별 「휴식 요일이어도 경기」 — 켜고 끌 때만 「묶음에 반영할까요?」)와 홈 구장 지정 목록,
 *    달력에서 날을 누르면 오른쪽에서 그 날 홈 경기 구단(개막전은 「대진까지 고정 / 홈 구장만 지정」, 대진 고르기 포함).
 *
 * 연전 묶음이 곧 경기일: 묶음이 없는 날은 경기 없는 날, 휴식 요일에 묶음을 그리면 그 날 경기.
 * 휴식기·휴식일 경기는 묶음과 휴식 요일에서 만들어(CalendarGen.deriveRestDays) ②·엔진에 넘긴다.
 * 묶음을 고치는 조작은 모두 저장 한 번(실행 취소 한 단계)에 함께 고친다:
 *   연전 기간 · 시리즈 배정(같은 묶음이면 그대로, 바뀐 묶음의 시리즈는 일정 미정으로) · 홈 구장 지정의 연전 기간 · 휴식기·휴식일 경기 · 주말·휴일 가중치.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, CalendarGen, Score } = KBO;
  const app = () => S.app;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  // day: 고른 날 · slotAt: 고른 묶음의 시작일 · drag: 끄는 중 · focus: 다른 화면에서 온 「입력 위치」
  // edit: 「자동으로 채운 것」에서 고치는 줄 · relay: 「묶음에 반영할까요?」 · pickOpen: 개막일 다시 고르기 · other: 「다른 날…」 칸
  const C = S.cal = { day: null, slotAt: null, drag: null, focus: null, edit: null, relay: null, pickOpen: false, other: false };
  const fs = () => (S.g1 && S.g1.fs) || 2;

  // ───────── 바탕 값 ─────────
  const set = () => app().state.settings;
  const dn = Dates.dayNum;
  const dlabel = (n) => fmt.date(n);
  const half = () => app().state.teams.length >> 1;
  const hasDates = () => !!(set().seasonStart && set().initialEnd);
  /** 달력에 보이는 달: 개막 달(없으면 3월) ~ 1차 편성 종료 달(없으면 9월) */
  function months() {
    const s = set();
    const a = s.seasonStart ? Math.min(3, Dates.month(dn(s.seasonStart))) : 3;
    const b = s.initialEnd ? Math.max(a, Dates.month(dn(s.initialEnd))) : 9;
    return [a, b];
  }
  function bundles() { return app().state.calendar.map((c, i) => ({ i, d: dn(c.datetime), len: c.consecutive })); }
  function slotOfDay(d) { const s = app().derived().dayToSlot.get(d); return s == null ? -1 : s; }
  const restDay = (d) => set().restWeekdays.includes(Dates.weekday(d));
  const inRange = (d) => hasDates() && d >= dn(set().seasonStart) && d <= dn(set().initialEnd);
  const holidayOf = (d) => set().holidays.find((h) => dn(h.date) === d) || null;
  const weightOf = (h) => (h && h.weight != null ? Number(h.weight) : CalendarGen.HOLIDAY_WEIGHT);

  // ───────── 규칙대로 깔기 ─────────
  /** 공휴일 「휴식 요일이어도 경기」: 값이 없으면 어린이날(5/5)만 켜짐(2025 5/5(월) 경기 재현, 2027 8/16(월) 대체공휴일은 경기 없음). 코어에 같은 판단(CalendarGen.holidayPlaysOnRest)이 있으면 그것을 쓴다 */
  S.playOnRest = (h) => (CalendarGen.holidayPlaysOnRest ? CalendarGen.holidayPlaysOnRest(h) : h && h.playOnRest != null ? !!h.playOnRest : /-05-05$/.test((h && h.date) || ''));
  /**
   * 규칙대로 깔 때 쓰는 설정(CalendarGen.ruleSettings): 휴식 요일 공휴일 중 「경기」를 끈 날은 넘기지 않고, 올스타 휴식기 길이(allStarDays)를 맞춘다.
   * 코어가 같은 규칙을 갖게 되어도 결과는 같다. 가중치는 저장할 때 전체 공휴일 표로 다시 매긴다.
   */
  S.ruleInput = function (s) {
    const rest = new Set(s.restWeekdays || [1]);
    const x = Object.assign({}, s, { holidays: (s.holidays || []).filter((h) => !rest.has(Dates.weekday(dn(h.date))) || S.playOnRest(h)) });
    const r = CalendarGen.ruleSettings(x);
    const days = Math.max(1, +s.allStarDays || 6), end = dn(s.initialEnd);
    for (const b of r.blackouts) if (b.label === '올스타 휴식기') b.end = Dates.isoDate(Math.min(end, dn(b.start) + days - 1));
    r.holidays = s.holidays;
    return r;
  };
  const ruleSlots = (s) => CalendarGen.generateSlots(S.ruleInput(s)).slots;
  /** 1차 편성 종료일 자동값: 개막일부터 규칙대로 깔았을 때 경기일이 필요한 수(135)가 되는 첫 일요일 */
  S.autoInitialEnd = function (s) {
    const need = s.initialGamesPerPair * Math.max(0, app().state.teams.length - 1);
    if (!s.seasonStart || !need) return '';
    const y = +s.seasonStart.slice(0, 4);
    const far = Object.assign({}, s, { initialEnd: s.seasonEnd && s.seasonEnd > s.seasonStart ? s.seasonEnd : y + '-10-31' });
    let n = 0;
    for (const c of ruleSlots(far)) {
      const d0 = dn(c.datetime);
      for (let k = 0; k < c.consecutive; k++) { n++; if (n >= need && Dates.weekday(d0 + k) === 0) return Dates.isoDate(d0 + k); }
      if (n >= need) { for (let d = d0 + c.consecutive; d < d0 + c.consecutive + 7; d++) if (Dates.weekday(d) === 0) return Dates.isoDate(d); }
    }
    return '';
  };
  /** 지금 묶음이 지금 설정의 규칙대로와 같은가(직접 고친 묶음이 없으면 참) */
  function sameAsRule(s) {
    const st = app().state;
    if (!s.seasonStart || !s.initialEnd) return !st.calendar.length;
    const g = ruleSlots(s);
    return g.length === st.calendar.length && g.every((x, i) => x.datetime === st.calendar[i].datetime && x.consecutive === st.calendar[i].consecutive);
  }
  S.calSameAsRule = () => sameAsRule(set());

  // ───────── 저장 ─────────
  S.recalcCalendar = function (s) {
    CalendarGen.applyWeights(s.calendar, s.settings);
    if (!s.calendar.length) { s.settings.restExceptions = []; s.settings.blackouts = []; return; }
    const d = CalendarGen.deriveRestDays(s.calendar, s.settings);
    s.settings.restExceptions = d.restExceptions;
    s.settings.blackouts = d.blackouts;
  };
  /**
   * 묶음 목록을 바꾸는 저장 한 번. fn(list)는 [{ d, len }]를 고친다(false면 그만둠). pre(s)는 같은 저장 안에서 먼저 설정을 고친다.
   * 시리즈 배정은 같은 묶음(시작일·연전 수)이면 그대로, 없어진 묶음의 시리즈는 일정 미정(-1)으로 보낸다.
   */
  function calCommit(label, fn, pre) {
    if (S.locked()) return false;
    const st = app().state;
    const list = st.calendar.map((c) => ({ d: dn(c.datetime), len: c.consecutive, note: c.note }));
    if (fn(list) === false) return false;
    list.sort((a, b) => a.d - b.d);
    const oldCal = st.calendar;
    const ok = app().commit(label, (s) => {
      if (pre) pre(s);
      s.calendar = list.map((x, i) => { const c = { index: i, datetime: Dates.engineDatetime(x.d), consecutive: x.len, weekend: 0, holiday: 0 }; if (x.note) c.note = x.note; return c; });
      const map = new Map(s.calendar.map((c, i) => [c.datetime + '|' + c.consecutive, i]));
      s.plan.forEach((p) => {
        if (p.calendar < 0) return;
        const o = oldCal[p.calendar];
        const n = o ? map.get(o.datetime + '|' + o.consecutive) : undefined;
        p.calendar = n == null ? -1 : n;
      });
      for (const e of s.events) e.slot = Score.resolveEventSlot(e, s.calendar);
      S.recalcCalendar(s);
    }, ['calendar', 'plan', 'events', 'settings']);
    if (ok && S.ui.vizChanged) S.ui.vizChanged = null;
    return ok;
  }
  S.calCommit = calCommit;
  /**
   * 설정을 고치고 규칙대로 다시 까는 저장 한 번(실행 취소 한 번). patch: 설정 바꿀 것.
   * 1차 편성 종료일이 「자동」이면 다시 계산하고, 재편성 기간(1차 편성 종료일 다음 날 ~ 시즌 종료일)과 개막전 날짜도 따라간다.
   */
  function layCommit(label, patch) {
    const st = app().state;
    const next = Object.assign({}, st.settings, patch || {});
    if (!next.seasonStart) return false;
    if (next.initialEndAuto !== false) next.initialEnd = S.autoInitialEnd(next) || next.initialEnd;
    if (!next.initialEnd) return false;
    const gen = CalendarGen.generateSlots(S.ruleInput(next));
    const oldStart = st.settings.seasonStart;
    const ok = calCommit(label, (list) => { list.length = 0; for (const x of gen.slots) list.push({ d: dn(x.datetime), len: x.consecutive }); }, (s) => {
      Object.assign(s.settings, patch || {}, { initialEnd: next.initialEnd });
      s.settings.blackouts = S.ruleInput(s.settings).blackouts; // 휴식기 이름(올스타 휴식기 등)을 묶음에서 다시 만들 때 쓴다
      if (s.reschedule) { s.reschedule.start = Dates.addDays(next.initialEnd, 1); if (s.settings.seasonEnd) s.reschedule.end = s.settings.seasonEnd; }
      if (oldStart && oldStart !== next.seasonStart) for (const e of s.events) if (e.type === 'OPENING' && e.date === oldStart) e.date = next.seasonStart;
    });
    if (ok) { C.relay = null; C.slotAt = null; }
    return ok;
  }
  S.calLay = layCommit;
  /** 묶음 규칙에 걸리는 설정 고치기: 묶음을 손대지 않았으면 같이 다시 깔고, 직접 고친 묶음이 있으면 설정만 바꾸고 「묶음에 반영할까요?」 */
  function ruleSetting(label, patch) {
    if (S.locked()) return false;
    if (!set().seasonStart || !app().state.calendar.length || sameAsRule(set())) return set().seasonStart ? layCommit(label, patch) : S.updateSeason(patch, label);
    const ok = S.updateSeason(patch, label);
    if (ok) C.relay = { why: label + ' — 직접 고친 묶음이 있어 묶음은 그대로 두었습니다.' };
    return ok;
  }
  S.updateSeason = function (patch, label) {
    if (S.locked()) return false;
    return app().commit(label || '시즌 기간 변경', (s) => { Object.assign(s.settings, patch); S.recalcCalendar(s); }, ['settings', 'calendar']);
  };

  // ───────── 개막일 고르기 (2단계의 할 일 하나) ─────────
  /** 개막일 후보: 3월 넷째 토요일(2025 3/22 · 2026 3/28 · 2027 3/27)과 그 앞뒤 토요일 */
  function openingChoices(y) {
    const m1 = dn(y + '-03-01'), sat = m1 + ((6 - Dates.weekday(m1) + 7) % 7) + 21;
    return [sat - 7, sat, sat + 7];
  }
  S.calOpeningChoices = (y) => openingChoices(y || S.seasonYear()).map(Dates.isoDate);
  function pickOpening(iso) {
    if (S.locked()) return false;
    const d = dn(iso), y = S.seasonYear();
    if (!Number.isFinite(d) || Dates.weekday(d) !== 6) { S.toast(dlabel(d) + '은(는) 토요일이 아닙니다. 개막은 늘 토요일(토·일 2연전)입니다.', 'warn', 5000); return false; }
    if (+iso.slice(0, 4) !== y) { S.toast(y + ' 시즌의 날짜를 골라 주세요.', 'warn', 4000); return false; }
    const s = set();
    const patch = { seasonStart: iso };
    if (!s.seasonEnd) patch.seasonEnd = y + '-10-31';
    if (!s.allStarStart || +s.allStarStart.slice(0, 4) !== y) patch.allStarStart = CalendarGen.defaultAllStarStart(y);
    if (s.allStarDays == null) patch.allStarDays = 6;
    const first = !s.seasonStart;
    const ok = layCommit('개막일 ' + dlabel(d) + (first ? ' · 규칙대로 연전 묶음' : ' (묶음 다시 깔기)'), patch);
    if (!ok) return false;
    C.pickOpen = false; C.other = false;
    const gd = S.gameDaysCheck(), h = CalendarGen.lengthHistogram(app().state.calendar);
    S.toast('개막 ' + dlabel(d) + ' · 1차 편성 종료 ' + dlabel(set().initialEnd) + ' — 연전 묶음 ' + app().state.calendar.length + '개(2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + ')를 규칙대로 깔았습니다. 경기일 ' + gd.have + ' / ' + gd.need + '일. 실행 취소 한 번으로 되돌립니다.', gd.ok ? 'ok' : 'warn', 6500);
    return true;
  }
  S.calPickOpening = pickOpening;

  // ───────── 묶음 조작 ─────────
  const bundleText = (d, len) => dlabel(d) + (len > 1 ? ' ~ ' + dlabel(d + len - 1) : '') + ' · ' + len + '연전';
  /** 끈 범위 → 묶음 범위. 누른 날은 늘 들어가고, 끈 쪽으로 이어 가다 휴식 요일·다른 묶음·시즌 밖에서 끊는다 */
  function dragRange(a, b) {
    const step = b >= a ? 1 : -1;
    let from = a, to = a, cut = null;
    for (let d = a + step; step > 0 ? d <= b : d >= b; d += step) {
      if (slotOfDay(d) >= 0) { cut = '다른 묶음'; break; }
      if (!inRange(d)) { cut = '시즌 밖'; break; }
      if (restDay(d)) { cut = WD[Dates.weekday(d)] + '요일(휴식 요일)'; break; }
      if (step > 0) to = d; else from = d;
    }
    const len = to - from + 1;
    return { from, to, len, cut, ok: len >= 2 && len <= 4 };
  }
  function addBundle(a, b) {
    if (!hasDates()) { S.toast('개막일을 먼저 골라 주세요. 그 기간 안에서 묶음을 만듭니다.', 'warn', 5000); return false; }
    if (!inRange(a)) { S.toast(dlabel(a) + '은(는) 1차 편성 기간(' + fmt.short(set().seasonStart) + '~' + fmt.short(set().initialEnd) + ') 밖입니다.', 'warn', 4000); return false; }
    if (slotOfDay(a) >= 0) return false;
    const r = dragRange(a, b);
    if (r.len > 4) { S.toast('연전은 2~4일입니다. ' + r.len + '일은 묶을 수 없어 그대로 두었습니다 — 둘로 나눠 끌어 주세요.', 'warn', 5000); return false; }
    if (r.len < 2) { S.toast((r.cut ? r.cut + '에서 끊겨 ' : '') + '하루만으로는 연전을 만들 수 없습니다. 2~4일을 끌어 주세요.', 'warn', 4500); return false; }
    const ok = calCommit('연전 묶음 만들기: ' + bundleText(r.from, r.len), (list) => { list.push({ d: r.from, len: r.len }); });
    if (ok) { C.day = r.from; C.slotAt = null; S.toast(bundleText(r.from, r.len) + ' 묶음을 만들었습니다' + (r.cut && Math.abs(b - a) + 1 > r.len ? ' (' + r.cut + '에서 끊음)' : '') + '. 경기일 합 ' + S.gameDaysCheck().have + '일 / ' + S.gameDaysCheck().need + '일.', 'ok', 4000); }
    return ok;
  }
  function setLen(i, n) {
    const bs = bundles(), b = bs[i];
    if (!b || b.len === n || n < 2 || n > 4) return false;
    const next = bs[i + 1];
    if (n > b.len) {
      const end = b.d + n - 1;
      if (next && next.d <= end) { S.toast(n + '연전으로 늘리면 다음 묶음(' + dlabel(next.d) + ')과 겹칩니다. 다음 묶음을 먼저 줄이거나 지우세요.', 'warn', 5000); return false; }
      if (!inRange(end)) { S.toast(dlabel(end) + '은(는) 1차 편성 기간 밖입니다.', 'warn', 4000); return false; }
    }
    const ok = calCommit('연전 수 바꾸기: ' + bundleText(b.d, b.len) + ' → ' + n + '연전', (list) => { const x = list.find((y) => y.d === b.d); x.len = n; });
    if (ok) S.toast(bundleText(b.d, n) + '으로 바꿨습니다. 경기일 합 ' + S.gameDaysCheck().have + '일.', 'ok', 3500);
    return ok;
  }
  function splitBundle(i) {
    const b = bundles()[i];
    if (!b || b.len !== 4) return false;
    const ok = calCommit('둘로 나누기: ' + bundleText(b.d, 4) + ' → 2연전 + 2연전', (list) => { const x = list.find((y) => y.d === b.d); x.len = 2; list.push({ d: b.d + 2, len: 2 }); });
    if (ok) { C.slotAt = b.d; S.toast(dlabel(b.d) + ' 4연전을 2연전 두 개로 나눴습니다.', 'ok', 3500); }
    return ok;
  }
  function removeBundle(i) {
    const b = bundles()[i];
    if (!b) return false;
    const ok = calCommit('묶음 지우기: ' + bundleText(b.d, b.len), (list) => { const k = list.findIndex((y) => y.d === b.d); list.splice(k, 1); });
    if (ok) { C.slotAt = null; S.toast(bundleText(b.d, b.len) + ' 묶음을 지웠습니다. 이 날들은 경기 없는 날이 됩니다. 실행 취소로 되돌릴 수 있습니다.', 'info', 4500); }
    return ok;
  }
  /** 규칙대로 다시 깔기(「묶음에 반영할까요?」의 「반영」): 지금 설정으로 묶음을 모두 다시 깐다 */
  function fillByRule() {
    if (!set().seasonStart) { S.toast('개막일을 먼저 골라 주세요.', 'warn', 5000); return false; }
    const ok = layCommit('규칙대로 다시 깔기', {});
    if (!ok) return false;
    const gd = S.gameDaysCheck(), h = CalendarGen.lengthHistogram(app().state.calendar);
    S.toast('규칙대로 묶음 ' + app().state.calendar.length + '개를 다시 깔았습니다(2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + '). 경기일 합 ' + gd.have + '일 / ' + gd.need + '일. 실행 취소로 되돌릴 수 있습니다.', gd.ok ? 'ok' : 'warn', 6500);
    return true;
  }
  S.calOps = { addBundle, setLen, splitBundle, removeBundle, fillByRule, dragRange, pickOpening };

  // ───────── 확인 ─────────
  /** 시리즈가 지금 묶음과 맞는가 */
  function seriesState() {
    const st = app().state, gd = S.gameDaysCheck();
    if (!st.matches.length) return { ok: false, kind: 'todo', text: gd.ok ? '「다음」 때 규칙대로 만듭니다' : '경기일 합을 맞추면 규칙대로 만듭니다' };
    if (S.seriesOkOf(st)) return { ok: true, kind: 'ok', text: '규칙대로 ' + st.matches.length + '개' };
    return { ok: false, kind: 'warn', text: gd.ok ? '묶음이 바뀌어 「다음」 때 규칙대로 다시 만듭니다' : '경기일 합을 맞추면 규칙대로 다시 만듭니다' };
  }
  S.calSeriesState = seriesState;
  const gdStat = (gd) => (gd.ok ? S.stat('ok', '맞음') : gd.have < gd.need ? S.stat('todo', (gd.need - gd.have) + '일 남음') : S.stat('warn', (gd.have - gd.need) + '일 많음'));

  // ───────── 그리기: 공통 조각 ─────────
  const box = (cls, head, body, attrs) => '<section class="sc-box' + (cls ? ' ' + cls : '') + '"' + (attrs || '') + '><h4>' + head + '</h4>' + body + '</section>';
  const line = (k, v) => '<div class="sc-line"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  const autoTag = (why) => '<span class="tag auto" title="' + esc(why) + '">자동</span>';
  function relayBar() {
    if (!C.relay) return '';
    return '<div class="sc-relay" role="alert">' + icon('info') + '<div><b>묶음에 반영할까요?</b><span>' + esc(C.relay.why) + ' 반영하면 지금 설정으로 묶음을 규칙대로 다시 깝니다(직접 고친 묶음도 규칙대로 돌아갑니다).</span>' +
      '<span class="sc-relay-acts"><button class="btn xs primary" data-act="cal-relay-go">' + icon('bolt') + '반영(규칙대로 다시 깔기)</button><button class="btn xs" data-act="cal-relay-no">그대로 둠</button></span></div></div>';
  }

  // ───────── 2단계 왼쪽: 개막일 · 자동으로 채운 것 · 연전 규칙 ─────────
  function openingAsk() {
    const s = set(), y = S.seasonYear(), ch = openingChoices(y), rec = ch[1];
    const chip = (d) => '<button class="chip' + (s.seasonStart === Dates.isoDate(d) ? ' on' : '') + '" data-act="cal-open" data-date="' + Dates.isoDate(d) + '">' + dlabel(d) + (d === rec ? ' <small>추천 · 3월 넷째 토요일</small>' : '') + '</button>';
    const other = C.other ? '<span class="sc-other"><input class="input sm sc-date" data-in="cal-open-other" placeholder="예: 4/3" aria-label="다른 개막일(토요일)"><small>토요일만 · Enter</small></span>' : '<button class="chip" data-act="cal-open-other">다른 날…</button>';
    return '<div class="fl-ask now fl-open-ask"><div class="q"><span class="no">1</span>' + y + ' 시즌 개막일은 언제인가요? <span class="tag now">지금</span></div>' +
      '<div class="a chips">' + ch.map(chip).join('') + other + '</div>' +
      '<div class="why">개막은 늘 토요일(토·일 2연전)이라 토요일만 보여 드립니다. 고르면 나머지(1차 편성 종료일·올스타 휴식기·연전 묶음)는 규칙대로 바로 채웁니다' + (s.seasonStart ? ' — 바꾸면 묶음을 다시 깝니다(실행 취소 한 번)' : '') + '.</div>' +
      (s.seasonStart ? '<button class="lnk" data-act="cal-open-cancel">그대로 두기</button>' : '') + '</div>';
  }
  function openingDone() {
    return '<div class="fl-ask ok"><div class="q"><span class="no">' + icon('check') + '</span>개막일</div><div class="a chips"><span class="chip on big">' + esc(dlabel(set().seasonStart)) + '</span><button class="chip" data-act="cal-open-change">바꾸기…</button></div></div>';
  }
  function autoRows() {
    const s = set(), y = S.seasonYear();
    const as = s.allStarStart || CalendarGen.defaultAllStarStart(y), days = +s.allStarDays || 6;
    const isDefAs = as === CalendarGen.defaultAllStarStart(y);
    const rest = new Set(s.restWeekdays);
    const restHols = s.holidays.filter((h) => h.date >= s.seasonStart && h.date <= s.initialEnd && rest.has(Dates.weekday(dn(h.date))));
    const ed = C.edit;
    const row = (key, k, v, tag, editor) => '<div class="sc-arow' + (ed === key ? ' editing' : '') + '"><span class="k">' + k + '</span><span class="v">' + v + (tag || '') + '</span>' +
      (editor ? '<button class="lnk" data-act="cal-edit" data-k="' + key + '">' + (ed === key ? '닫기' : '고치기') + '</button>' : '<span></span>') + (ed === key && editor ? '<div class="sc-aed">' + editor + '</div>' : '') + '</div>';
    const dateIn = (k, val, ph) => '<input class="input sm sc-date" data-in="cal-set" data-k="' + k + '" value="' + esc(val ? fmt.date(val) : '') + '" placeholder="' + esc(ph) + '" aria-label="' + esc(k) + '">';
    const endAuto = s.initialEndAuto !== false;
    return '<div class="sc-autos">' +
      row('initialEnd', '1차 편성 종료일', esc(dlabel(s.initialEnd)), endAuto ? autoTag('경기일 ' + S.gameDaysCheck().need + '일이 되는 첫 일요일') + '<small>경기일 ' + S.gameDaysCheck().need + '일이 되는 날</small>' : '<span class="tag">직접</span>',
        dateIn('initialEnd', s.initialEnd, '예: 9/5') + (endAuto ? '' : '<button class="btn xs" data-act="cal-end-auto">' + icon('bolt') + '자동으로(경기일 ' + S.gameDaysCheck().need + '일이 되는 첫 일요일)</button>') + '<small>바꾸면 그 날까지 묶음을 다시 깝니다. 그 뒤는 미편성 경기와 우천 취소분을 넣는 재편성 기간입니다.</small>') +
      row('seasonEnd', '시즌 종료일', esc(dlabel(s.seasonEnd)), '<span class="tag">기본</span>', dateIn('seasonEnd', s.seasonEnd, '예: 10/31') + '<small>재편성 기간의 끝입니다.</small>') +
      row('rest', '휴식 요일', esc(s.restWeekdays.map((w) => WD[w]).join('·') || '없음'), '<span class="tag">기본</span>',
        '<span class="wd sc-wd">' + WD.map((n, i) => '<button class="' + (s.restWeekdays.includes(i) ? 'on' : '') + '" data-act="rest-wd" data-wd="' + i + '" aria-pressed="' + s.restWeekdays.includes(i) + '" title="' + n + '요일">' + n + '</button>').join('') + '</span>') +
      row('allstar', '올스타 휴식기', esc(dlabel(as) + '~' + dlabel(dn(as) + days - 1)), isDefAs && days === 6 ? autoTag('7월 둘째 금요일부터 6일') + '<small>7월 둘째 금요일 · 6일</small>' : '<span class="tag">직접</span>',
        '<label class="sc-inl">시작(금) ' + dateIn('allStarStart', as, '예: 7/9') + '</label><label class="sc-inl">길이 <input class="input sm num sc-num" data-in="cal-set" data-k="allStarDays" value="' + days + '" inputmode="numeric" aria-label="올스타 휴식기 길이(일)">일</label><small>뒤 목~일은 4연전(후반기 첫 시리즈)이 됩니다.</small>') +
      row('restHol', '휴식 요일 공휴일', restHols.length ? restHols.map((h) => esc(fmt.short(h.date) + '(' + WD[Dates.weekday(dn(h.date))] + ') ' + (S.playOnRest(h) ? '경기' : '경기 없음'))).join(' · ') : '없음', '', '') +
      '</div><div class="sc-note">휴식 요일 공휴일의 경기 여부는 3단계 공휴일 표에서 바꿉니다. 자동으로 채운 값은 「고치기」로 바꿉니다.</div>';
  }
  function rulesBox() {
    const s = set();
    return box('sc-rules', '연전 규칙 <span class="r">' + S.stat('ok', '2025 공식 일정표 확인') + '</span>',
      '<div class="sc-note">화·수·목 / 금·토·일 <b>3연전</b> · ' + esc(s.restWeekdays.map((w) => WD[w]).join('·')) + ' 휴식 · 개막 토·일 <b>2연전</b> · 올스타 휴식기 뒤 목~일 <b>4연전</b>. 개막 2연전·후반기 첫 4연전 말고는 ' + (s.seriesMinLength || 3) + '연전 이상.</div>');
  }
  function leftStep2() {
    const s = set(), gd = S.gameDaysCheck(), y = S.seasonYear();
    const open = !s.seasonStart || C.pickOpen;
    return '<div class="fl-kick">2 / 4단계</div><h2 class="sc-h2">시즌 기간·연전 묶음 ' + (s.seasonStart ? (gd.ok ? S.stat('ok', gd.have + '일') : S.stat('warn', gd.have + ' / ' + gd.need + '일')) : '') + '</h2>' +
      '<p class="sc-intro">' + y + ' 시즌 · ' + (s.seasonStart ? '개막일만 고르면 나머지는 규칙대로 채웠습니다. 고칠 곳만 달력에서 끕니다.' : '정할 것은 <b>개막일</b> 하나뿐입니다. 고르면 1차 편성 종료일과 연전 묶음(2·3·4연전)을 2025 공식 일정표의 관행대로 채웁니다.') + '</p>' +
      relayBar() +
      (open ? openingAsk() : openingDone()) +
      (s.seasonStart ? box('sc-auto', '자동으로 채운 것', autoRows()) : '<div class="sc-dash">▸ <b>나머지는 자동</b> — 1차 편성 종료일(경기일 ' + gd.need + '일이 되는 날) · 시즌 종료일 10/31 · 휴식 요일 월 · 올스타 휴식기 ' + esc(dlabel(CalendarGen.defaultAllStarStart(y))) + '부터 6일. 고칠 때만 펼칩니다.</div>') +
      rulesBox();
  }

  // ───────── 3단계 왼쪽: 공휴일 표 · 홈 구장 지정 목록 ─────────
  function holidaysBox() {
    const s = set(), y = S.seasonYear(), rest = new Set(s.restWeekdays);
    // 1차 편성 기간(개막일~1차 편성 종료일) 공휴일만 펼쳐 두고, 그 밖(시즌 앞·재편성 기간)은 접는다
    const a = s.seasonStart || y + '-03-01', b = s.initialEnd || (y + '-10-31');
    const all = s.holidays.map((h, i) => ({ h, i }));
    const inside = all.filter(({ h }) => h.date >= a && h.date <= b);
    const rows = C.holAll ? all : inside;
    const others = all.length - inside.length;
    const tr = ({ h, i }) => {
      const onRest = rest.has(Dates.weekday(dn(h.date))), por = S.playOnRest(h);
      return '<tr data-hol="' + i + '"' + (C.day != null && dn(h.date) === C.day ? ' class="sel"' : '') + '><td><input class="input xs mono sc-hd" data-in="cal-hol" data-row="' + i + '" data-k="date" value="' + esc(fmt.date(h.date)) + '" aria-label="공휴일 날짜"></td>' +
        '<td><input class="input xs sc-hn" data-in="cal-hol" data-row="' + i + '" data-k="name" value="' + esc(h.name) + '" aria-label="공휴일 이름"></td>' +
        '<td class="num"><input class="input xs num sc-hw" data-in="cal-hol" data-row="' + i + '" data-k="weight" value="' + esc(String(weightOf(h))) + '" inputmode="numeric" aria-label="' + esc('가중치: ' + h.name) + '"></td>' +
        '<td class="c">' + (onRest ? '<button class="sc-mini' + (por ? ' on' : '') + '" data-act="cal-por" data-row="' + i + '" role="switch" aria-checked="' + por + '" title="' + esc(fmt.date(h.date) + ' — 휴식 요일이어도 경기' + (por ? '(켜짐)' : '(꺼짐)')) + '"><i></i></button>' : '<span class="muted">—</span>') + '</td>' +
        '<td><button class="btn xs icon ghost" data-act="cal-hol-del" data-row="' + i + '" title="이 줄 지우기" aria-label="' + esc(h.name + ' 지우기') + '">' + icon('x') + '</button></td></tr>';
    };
    return box('sc-hols' + (C.focus === 'holidays' ? ' flash' : ''), '<span class="no">1</span>공휴일과 가중치 <span class="r"><button class="btn xs" data-act="cal-hol-add">' + icon('plus') + '줄 추가</button></span>',
      (rows.length ? '<table class="sc-htable"><colgroup><col style="width:84px"><col><col style="width:40px"><col style="width:40px"><col style="width:22px"></colgroup><thead><tr><th>날짜</th><th>이름</th><th class="num">가중치</th><th class="c" title="휴식 요일(월)에 든 공휴일 — 켜면 그 날 경기, 그 주 목요일 휴식">월 경기</th><th></th></tr></thead><tbody>' + rows.map(tr).join('') + '</tbody></table>'
        : '<div class="sc-note">아직 없습니다. <button class="lnk" data-act="fill-holidays">' + y + '년 법정 공휴일 채우기</button></div>') +
      (others ? '<div class="sc-note"><button class="lnk" data-act="cal-hol-all">' + (C.holAll ? '1차 편성 기간 공휴일만 보기' : '1차 편성 기간 밖(시즌 앞·재편성 기간) 공휴일 ' + others + '일 더 보기') + '</button></div>' : '') +
      '<div class="sc-note">가중치 = 홈 경기 공정성에서 이 날의 가치(주말 하루 1). 「월 경기」는 휴식 요일에 든 공휴일에 경기를 할지(켜면 그 주 목요일 휴식) — 켜고 끌 때만 「묶음에 반영할까요?」를 묻습니다.</div>' +
      '<div class="sc-kbo">' + S.stat('warn', '기본값(공휴일 2 · 어린이날 3)은 KBO 확인 필요') + '</div>');
  }
  function homesBox() {
    const st = app().state, hs = S.homeStateOf(st), dnr = new Set(hs.rows.map((r) => r.date));
    const extra = st.events.filter((e) => e.mode === 'STADIUM' && !dnr.has(e.date));
    const row = (date, name, e, done) => {
      const n = e ? (e.teams || []).length : 0;
      const st0 = S.homeCleared(e) ? S.stat('warn', '지정 없음') : done ? S.stat('ok', n + '곳' + (e.fix === 'pairs' ? ' · 대진' : '')) : n ? '<span class="tag blue">고르는 중 ' + n + ' / ' + half() + '</span>' : '<span class="tag">비어 있음</span>';
      return '<button class="sc-hrow' + (C.day === dn(date) ? ' on' : '') + '" data-act="cal-go-day" data-d="' + dn(date) + '"><span>' + esc(dlabel(date) + ' ' + name) + '</span>' + st0 + '</button>';
    };
    return box('sc-homes' + (hs.total && hs.done === hs.total ? '' : ' blue') + (C.focus === 'events' ? ' flash' : ''), '<span class="no">2</span>홈 구장 지정 <span class="r"><b>' + hs.done + ' / ' + hs.total + '</b></span>',
      (hs.rows.length ? hs.rows.map((r) => row(r.date, r.name, r.ev, r.done)).join('') : '<div class="sc-note">개막일을 고르면 개막전·어린이날이 여기에 나옵니다.</div>') +
      extra.map((e) => row(e.date, e.name, e, S.homeComplete(e))).join('') +
      '<div class="sc-note">달력에서 날을 누르면 오른쪽에서 그 날 홈 경기 구단 ' + half() + '곳을 고릅니다. 개막전은 대진까지 고정할 수도 있습니다.</div>');
  }
  function leftStep3() {
    return '<div class="fl-kick">3 / 4단계</div><h2 class="sc-h2">공휴일·홈 구장</h2>' +
      '<p class="sc-intro">연전 묶음(2단계)이 깔린 같은 달력에서, 날짜에 붙는 두 가지를 정합니다.</p>' + relayBar() + holidaysBox() + homesBox();
  }

  // ───────── 가운데 달력 ─────────
  function calendarStrip() {
    const st = app().state, s = st.settings, y = S.seasonYear(), [m0, m1] = months();
    const hol = new Map(s.holidays.map((h) => [dn(h.date), h]));
    const bs = bundles(), byDay = new Map();
    bs.forEach((b) => { for (let k = 0; k < b.len; k++) byDay.set(b.d + k, { b, k }); });
    const evDays = new Map(st.events.map((e) => [dn(e.date), e]));
    const a = s.seasonStart ? dn(s.seasonStart) : null, e1 = s.initialEnd ? dn(s.initialEnd) : null, e2 = s.seasonEnd ? dn(s.seasonEnd) : null;
    const selSlot = fs() === 2 && C.slotAt != null ? bs.find((b) => b.d === C.slotAt) : null;
    let h = '<div class="strip big sc-strip" role="grid" aria-label="' + y + ' 시즌 달력">';
    for (let mo = m0; mo <= m1; mo++) {
      h += '<div class="strip-row" role="row"><span class="m">' + mo + '월</span><div class="strip-days">';
      for (let d = 1; d <= 31; d++) {
        const n = dn(y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
        if (!Number.isFinite(n) || Dates.month(n) !== mo) { h += '<span class="sd out"></span>'; continue; }
        const w = Dates.weekday(n), x = byDay.get(n), hh = hol.get(n), ev = evDays.get(n);
        const cls = ['sd'], tt = [fmt.date(n)];
        if (w === 6) cls.push('sat'); else if (w === 0) cls.push('sun');
        if (hh) { cls.push('hol'); tt.push(hh.name + ' · 가중치 ' + weightOf(hh)); }
        if (x) {
          cls.push('game'); if (w === 0 || w === 6) cls.push('we');
          if (x.k === 0) cls.push('ss'); if (x.k === x.b.len - 1) cls.push('se');
          if (selSlot && selSlot.d === x.b.d) cls.push('sel');
          tt.push(x.b.len + '연전 ' + (x.k + 1) + '일째');
        } else if (a != null && e1 != null && n >= a && n <= e1) { cls.push('rest'); tt.push(restDay(n) ? '휴식 요일' : '경기 없는 날'); }
        else if (a != null && e2 != null && n > e1 && n <= e2) { cls.push('re'); tt.push('재편성 기간'); }
        else cls.push(a == null ? 'pre' : 'off');
        if (ev && ev.mode === 'STADIUM') { cls.push('ev'); tt.push(ev.name + ' 홈 구장 지정'); }
        if (C.day === n) cls.push('pick');
        const lab = x && x.k === 0 ? '<i class="sl">' + x.b.len + '연전</i>' : '';
        h += '<span class="' + cls.join(' ') + '" role="gridcell" data-d="' + n + '"' + (x ? ' data-slot="' + x.b.i + '"' : '') + ' title="' + esc(tt.join(' · ')) + '">' + d + lab + '</span>';
      }
      h += '</div></div>';
    }
    return h + '</div>';
  }
  function popover() {
    if (fs() !== 2) return '';
    const bs = bundles(), b = C.slotAt != null ? bs.find((x) => x.d === C.slotAt) : null;
    if (!b) return '';
    const gd = S.gameDaysCheck(), prev = bs[b.i - 1];
    const tag = b.i === 0 ? '개막' : prev && b.d - (prev.d + prev.len) >= 4 ? '휴식기 뒤' : '';
    const alt = b.len > 2 ? b.len - 1 : b.len + 1;
    const effect = alt < b.len ? alt + '연전으로 바꾸면 ' + dlabel(b.d + b.len - 1) + '이 경기 없는 날이 되어 경기일 합이 ' + (gd.have - 1) + '일이 됩니다.' : alt + '연전으로 바꾸면 ' + dlabel(b.d + b.len) + '이 경기일이 되어 경기일 합이 ' + (gd.have + 1) + '일이 됩니다.';
    return '<div class="sc-pop" id="scPop" role="dialog" aria-label="고른 묶음"><h4>' + esc(dlabel(b.d) + ' ~ ' + dlabel(b.d + b.len - 1)) + ' · ' + b.len + '연전' + (tag ? ' <span class="tag auto">' + tag + '</span>' : '') + '<button class="btn xs icon ghost" data-act="cal-pop-close" title="닫기 (Esc)" aria-label="닫기">' + icon('x') + '</button></h4>' +
      '<div class="sc-sub">연전 수</div><div class="sc-seg" role="radiogroup" aria-label="연전 수">' + [2, 3, 4].map((n) => '<button class="' + (n === b.len ? 'on' : '') + '" data-act="cal-len" data-i="' + b.i + '" data-n="' + n + '" role="radio" aria-checked="' + (n === b.len) + '">' + n + '연전</button>').join('') + '</div>' +
      '<div class="sc-note">' + esc(effect) + '</div>' +
      '<div class="sc-pop-acts">' + (b.len === 4 ? '<button class="btn sm" data-act="cal-split" data-i="' + b.i + '">' + icon('swap') + '둘로 나누기 (2+2)</button>' : '') + '<button class="btn sm danger" data-act="cal-del" data-i="' + b.i + '">' + icon('trash') + '묶음 지우기</button></div></div>';
  }
  function mainPane() {
    const st = app().state, y = S.seasonYear(), gd = S.gameDaysCheck(), h = CalendarGen.lengthHistogram(st.calendar), [m0, m1] = months(), f = fs();
    const legend = f === 2 ? [['game', '경기일'], ['ss', '묶음 시작'], ['rest', '경기 없음'], ['hol', '공휴일(빨강)'], ['sat', '토요일(파랑)'], ['sel', '고른 묶음']] : [['game', '경기일'], ['hol', '공휴일(빨강)'], ['ev', '홈 구장 지정'], ['pick', '고른 날']];
    const tips = f === 2
      ? '<span>' + icon('move') + '날짜를 <b>끌면</b> 연전 묶음(2·3·4연전)</span><span>' + icon('grid') + '묶음을 <b>누르면</b> 연전 수 바꾸기 · 나누기 · 지우기</span>'
      : '<span>' + icon('target') + '날을 <b>누르면</b> 홈 구장 지정</span><span>빨간 동그라미 = 공휴일(가중치는 왼쪽 표)</span><span>연전 묶음은 2단계에서 고칩니다</span>';
    return '<section class="sc-main' + (C.focus === 'slots' ? ' flash' : '') + '" aria-label="시즌 달력">' +
      '<div class="sc-head"><b>' + y + ' 시즌 달력</b><span class="muted">' + m0 + '월~' + m1 + '월 · ' + (f === 2 ? '1차 편성 기간' : '여기서는 날을 누릅니다') + '</span>' +
      '<span class="sc-count ' + (gd.ok ? 'ok' : gd.have > gd.need ? 'warn' : '') + '" id="scCount"><b>경기일 ' + gd.have + ' / ' + gd.need + '일</b>' + gdStat(gd) + '</span>' +
      '<span class="sc-hist">' + (st.calendar.length ? '2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + ' · 묶음 ' + st.calendar.length + '개' : set().seasonStart ? '아직 묶음이 없습니다' : '개막일을 고르면 연전 묶음이 깔립니다') + '</span>' +
      '<span class="sc-undo">' + S.undoButtons() + '</span></div>' +
      '<div class="sc-calbody" id="scCal" data-sk="sc-cal">' +
        '<div class="sc-legend">' + legend.map(([c, t]) => '<span><i class="' + c + '"></i>' + t + '</span>').join('') + '</div>' +
        calendarStrip() +
        '<div class="sc-tips">' + tips + '<span id="scDragHint" class="sc-drag-hint"></span></div>' +
        popover() +
      '</div></section>';
  }

  // ───────── 3단계 오른쪽: 고른 날(홈 구장 지정) ─────────
  function dayBox() {
    if (C.day == null) return box('sc-day', '고른 날', '<div class="sc-note">달력에서 날을 누르면 여기서 그 날 홈 구장을 지정합니다(개막전·어린이날). 공휴일은 왼쪽 표에서 적습니다.</div>');
    const d = C.day, hh = holidayOf(d), si = slotOfDay(d), b = si >= 0 ? bundles()[si] : null, e = homeEv(d);
    return box('blue sc-day', '고른 날 · ' + esc(dlabel(d)) + '<span class="r sc-hint-i">' + esc((e ? e.name : hh ? hh.name : '') + (hh ? ' · 가중치 ' + weightOf(hh) : '')) + '</span>',
      line('연전', b ? esc(bundleText(b.d, b.len)) : '<span class="muted">' + (inRange(d) ? '경기 없는 날(묶음 없음)' : '1차 편성 기간 밖') + '</span>') +
      S.calHomeBox(d, b));
  }
  /** step-data.js의 R.calendar — ① 2·3단계(같은 달력) */
  S.renderSeasonCalendar = function () {
    S.ui.tab = 'season';
    const f = fs(), locked = S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED');
    if (C.slotAt != null && !bundles().some((b) => b.d === C.slotAt)) C.slotAt = null;
    if (f === 3 && C.day == null) { const hs = S.homeStateOf(app().state), r = hs.rows.find((x) => !x.done) || hs.rows[0]; if (r) C.day = dn(r.date); }
    const right = f === 3 ? '<aside class="sc-right" aria-label="고른 날" data-sk="sc-right">' + (locked ? '<div class="lockbar">' + icon('lock') + '자동 편성 중에는 입력이 잠깁니다.</div>' : '') + dayBox() +
      '<section class="sc-box warn-soft"><h4>공휴일을 바꾸면</h4><div class="sc-note">공휴일 날짜·가중치를 고쳐도 연전 묶음은 그대로입니다. 「월 경기」를 켜고 끌 때만 「묶음에 반영할까요?」를 묻습니다.</div></section></aside>' : '';
    const html = '<div class="sc' + (f === 3 ? ' s3' : ' s2') + (locked ? ' locked' : '') + '" data-mode="cal" data-fs="' + f + '">' +
      '<aside class="sc-left" aria-label="' + (f === 2 ? '시즌 기간·연전 묶음' : '공휴일·홈 구장') + '" data-sk="sc-left-' + f + '">' + (f === 2 ? leftStep2() : leftStep3()) + '</aside>' +
      mainPane() + right + '</div>';
    S.afterRender(placePopover);
    if (C.focus) { const x = C.focus; setTimeout(() => { if (C.focus === x) C.focus = null; }, 1600); }
    return html;
  };
  function placePopover() {
    const pop = document.getElementById('scPop'), body = document.getElementById('scCal');
    if (!pop || !body || C.slotAt == null) return;
    const cells = body.querySelectorAll('.sd.sel');
    if (!cells.length) { pop.style.display = 'none'; return; }
    const first = cells[0].getBoundingClientRect(), last = cells[cells.length - 1].getBoundingClientRect(), br = body.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = first.left - br.left + body.scrollLeft, top = last.bottom - br.top + body.scrollTop + 6;
    left = Math.max(4, Math.min(left, body.clientWidth - pw - 4));
    if (top + ph > body.scrollTop + body.clientHeight - 4) top = first.top - br.top + body.scrollTop - ph - 6;
    pop.style.left = left + 'px'; pop.style.top = Math.max(4, top) + 'px';
  }

  // ───────── 끌기·누르기 (문서에 한 번만 건다) ─────────
  const cellOf = (t) => (t && t.closest ? t.closest('.sc-strip .sd[data-d]') : null);
  function paintDrag() {
    const body = document.getElementById('scCal');
    if (!body || !C.drag) return;
    const r = dragRange(C.drag.a, C.drag.b);
    body.querySelectorAll('.sd.drag, .sd.drag-bad').forEach((el) => el.classList.remove('drag', 'drag-bad'));
    for (let d = r.from; d <= r.to; d++) { const el = body.querySelector('.sd[data-d="' + d + '"]'); if (el) el.classList.add(r.ok ? 'drag' : 'drag-bad'); }
    const hint = document.getElementById('scDragHint');
    if (hint) hint.textContent = bundleText(r.from, r.len) + (r.len > 4 ? ' — 5일 이상은 묶을 수 없습니다' : r.len < 2 ? ' — 2일 이상 끌어 주세요' : '') + (r.cut ? ' (' + r.cut + '에서 끊김)' : '');
  }
  function pickDay(d) {
    const si = slotOfDay(d);
    C.day = d;
    C.slotAt = fs() === 2 && si >= 0 ? bundles()[si].d : null;
    S.render();
  }
  S.calPick = pickDay;
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const el = cellOf(e.target);
    if (!el || S.ui.step !== 1) return;
    e.preventDefault();
    if (S.locked()) return;
    // 끌어서 묶음 만들기는 2단계에서만. 3단계는 누르기(홈 구장 지정)만
    C.drag = { a: +el.dataset.d, b: +el.dataset.d, moved: false, onSlot: el.hasAttribute('data-slot') || fs() !== 2 };
  });
  document.addEventListener('mouseover', (e) => {
    if (!C.drag) return;
    const el = cellOf(e.target);
    if (!el) return;
    const d = +el.dataset.d;
    if (d === C.drag.b) return;
    C.drag.b = d; C.drag.moved = d !== C.drag.a;
    if (!C.drag.onSlot) paintDrag();
  });
  document.addEventListener('mouseup', () => {
    const g = C.drag;
    if (!g) return;
    C.drag = null;
    if (!g.moved || g.onSlot) { pickDay(g.a); return; }
    if (!addBundle(g.a, g.b)) S.render();
  });
  document.addEventListener('contextmenu', (e) => {
    const el = cellOf(e.target);
    if (!el) return;
    e.preventDefault();
    pickDay(+el.dataset.d);
  });
  S.calOnKey = function (e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
    if (e.key === 'Escape' && (C.slotAt != null || C.day != null)) { e.preventDefault(); if (C.slotAt != null) C.slotAt = null; else C.day = null; S.render(); return true; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && C.slotAt != null && fs() === 2) { const b = bundles().find((x) => x.d === C.slotAt); if (b) { e.preventDefault(); removeBundle(b.i); return true; } }
    return false;
  };
  S.calOnReset = function () { C.day = null; C.slotAt = null; C.edit = null; C.relay = null; C.pickOpen = false; C.other = false; C.seriesError = null; };
  /** 사전 점검 「입력 위치로」 등: 그 단계의 그 부분을 잠깐 강조한다. 반환: 갈 단계(2·3) */
  S.calFocus = function (tab) {
    const st = app().state;
    const map = { season: 'season', holidays: 'holidays', slots: 'slots', series: 'slots', events: 'events', restex: 'slots', blackouts: 'slots' };
    C.focus = map[tab] || 'slots';
    if (C.focus === 'events') { const e = st.events.find((x) => x.mode === 'STADIUM') || st.events[0]; if (e) C.day = dn(e.date); }
    return C.focus === 'holidays' || C.focus === 'events' ? 3 : 2;
  };
  S.calRoute = function (o) {
    C.day = o.day && Number.isFinite(dn(o.day)) ? dn(o.day) : null;
    C.slotAt = o.slot && Number.isFinite(dn(o.slot)) ? dn(o.slot) : null;
  };
  S.calHash = function (o) {
    if (C.day != null) o.day = Dates.isoDate(C.day);
    if (C.slotAt != null && fs() === 2) o.slot = Dates.isoDate(C.slotAt);
  };

  // ───────── 홈 구장 지정 ─────────
  // 그 날 홈 경기를 해야 하는 구단을 고른다(events의 STADIUM). fix: 'home'(홈 구장만 — 상대는 자동 편성, 서버가 직접 지킴) · 'pairs'(대진까지 고정 — 그 시리즈를 고정).
  // teams = 고른 구단(잠실은 두산·LG 중 하나), stadiums = 채점에 쓰는 구장, pairs = [{ home, away }](대진까지 고정일 때). 어린이날은 obligationTeams도 같이 맞춘다(예전 서버 호환).
  // 개막전·어린이날은 늘 들어 있는 규칙(노트 「사」): 구단은 바꿔도 되지만 지우면 묻고, 지운 날은 teams: []로 남겨 서버에 「지정 없음」을 보낸다
  const homeEv = (d) => app().state.events.find((e) => e.mode === 'STADIUM' && dn(e.date) === d) || null;
  S.isRuleHome = (e) => !!e && e.mode === 'STADIUM' && (e.type === 'OPENING' || e.type === 'CHILDREN');
  S.homeCleared = (e) => !!e && e.mode === 'STADIUM' && Array.isArray(e.teams) && !e.teams.length;
  S.RULE_HOME_TEXT = 'KBO 원칙(개막전 = 전년도 상위 5팀 홈, 어린이날 = 격년제 편성)과 다릅니다';
  S.clearedRuleHomes = (st) => (st || app().state).events.filter((e) => S.isRuleHome(e) && S.homeCleared(e));
  const matchEvs = (d) => app().state.events.filter((e) => e.mode === 'MATCH' && dn(e.date) === d);
  S.evTeams = function (e) {
    const st = app().state;
    if (e.teams && e.teams.length) return e.teams.filter((n) => st.teams.some((t) => t.name === n));
    const pref = st.settings.obligationTeams || [];
    return (e.stadiums || []).map((x) => { const own = st.teams.filter((t) => t.stadium === x).map((t) => t.name); return own.find((n) => pref.includes(n)) || own[0]; }).filter(Boolean);
  };
  function evKind(d) {
    const s = set(), iso = Dates.isoDate(d), hh = holidayOf(d);
    if (s.seasonStart && iso === s.seasonStart) return { type: 'OPENING', name: '개막전' };
    if (iso.slice(5) === '05-05') return { type: 'CHILDREN', name: '어린이날' };
    return { type: 'CUSTOM', name: hh ? hh.name : '홈 구장 지정' };
  }
  const evId = (type) => 'ev-' + type.toLowerCase() + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36);
  function toggleHome(d, name) {
    if (S.locked()) return false;
    const st = app().state, e = homeEv(d), cur = e ? S.evTeams(e) : [];
    const t = st.teams.find((x) => x.name === name);
    if (!t) return false;
    let next;
    if (cur.includes(name)) next = cur.filter((x) => x !== name);
    else {
      const clash = cur.find((x) => (st.teams.find((y) => y.name === x) || {}).stadium === t.stadium);
      if (clash) { S.toast(t.stadium + '은(는) ' + st.teams.filter((y) => y.stadium === t.stadium).map((y) => y.name).join('·') + ' 중 하나만 고릅니다(같은 날 한 구장에서 홈 경기는 하나). 이미 ' + clash + '을(를) 골랐습니다.', 'warn', 5500); return false; }
      if (cur.length >= half()) { S.toast('하루에 홈 경기는 ' + half() + '곳입니다. 이미 ' + cur.length + '곳을 골랐습니다 — 다른 구단을 먼저 빼세요.', 'warn', 5000); return false; }
      next = cur.concat([name]);
    }
    if (!next.length && S.isRuleHome(e)) { askClear(d); return false; }
    const order = st.teams.map((x) => x.name);
    next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const stadiums = next.map((n) => st.teams.find((x) => x.name === n).stadium);
    const kind = e ? { type: e.type, name: e.name } : evKind(d);
    const label = fmt.short(d) + ' ' + kind.name + ' 홈 구장 ' + (cur.includes(name) ? '빼기: ' : '넣기: ') + name;
    return app().commit(label, (s) => {
      let ev = s.events.find((x) => x.mode === 'STADIUM' && dn(x.date) === d);
      if (!next.length) {
        if (ev) { s.events = s.events.filter((x) => x !== ev); for (const m of s.matches) if (m.eventId === ev.id) { delete m.eventId; m.pinned = false; } }
        return;
      }
      if (!ev) { ev = { id: evId(kind.type), type: kind.type, name: kind.name, date: Dates.isoDate(d), mode: 'STADIUM', fix: 'home' }; s.events.push(ev); s.events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); }
      ev.teams = next; ev.stadiums = stadiums; ev.slot = Score.resolveEventSlot(ev, s.calendar);
      if (Array.isArray(ev.pairs)) ev.pairs = ev.pairs.filter((p) => next.includes(p.home));
      for (const m of s.matches) if (m.eventId === ev.id && !next.includes(m.home)) { delete m.eventId; m.pinned = false; }
      if (ev.type === 'CHILDREN' && next.length === (s.teams.length >> 1)) s.settings.obligationTeams = next.slice();
    }, ['events', 'pins', 'settings']);
  }
  function askClear(d) {
    if (S.locked()) return;
    S.ui.homeAsk = { kind: 'clear', d };
    S.go({ modal: 'homeRule' });
  }
  /** 개막전·어린이날 지정을 지운다: 이벤트는 남기고 teams: [](대진 없이) = 서버에 「지정 없음」 */
  function clearHome(d) {
    const e = homeEv(d);
    if (!e || S.locked()) return false;
    return app().commit(fmt.short(d) + ' ' + e.name + ' 홈 구장 지정 지우기(지정 없음)', (s) => {
      const ev = s.events.find((x) => x.id === e.id);
      ev.teams = []; ev.stadiums = []; ev.fix = 'home'; delete ev.pairs;
      for (const m of s.matches) if (m.eventId === e.id) { delete m.eventId; m.pinned = false; }
    }, ['events', 'pins']);
  }
  function removeHome(d) {
    const e = homeEv(d);
    if (!e || S.locked() || S.homeCleared(e)) return false;
    if (S.isRuleHome(e)) { askClear(d); return false; }
    return app().commit(fmt.short(d) + ' ' + e.name + ' 홈 구장 지정 지우기', (s) => {
      s.events = s.events.filter((x) => x.id !== e.id);
      for (const m of s.matches) if (m.eventId === e.id) { delete m.eventId; m.pinned = false; }
    }, ['events', 'pins']);
  }
  /** 「대진까지 고정」 ↔ 「홈 구장만 지정」. 대진까지 고정으로 바꾸면 지금 일정에서 그 기간의 상대를 먼저 채워 둔다 */
  function setFix(d, fix) {
    const e = homeEv(d);
    if (!e || S.locked() || (e.fix || 'home') === fix) return false;
    const st = app().state, c = app().derived(), slot = Score.resolveEventSlot(e, st.calendar), teams = S.evTeams(e);
    let pairs = Array.isArray(e.pairs) ? e.pairs.filter((p) => teams.includes(p.home)) : [];
    if (fix === 'pairs' && slot >= 0) {
      for (const m of c.bySlot[slot] || []) {
        const mm = st.matches[m];
        if (teams.includes(mm.home) && !teams.includes(mm.away) && !pairs.some((p) => p.home === mm.home || p.away === mm.away)) pairs.push({ home: mm.home, away: mm.away });
      }
    }
    return app().commit(fmt.short(d) + ' ' + e.name + ': ' + (fix === 'pairs' ? '대진까지 고정' : '홈 구장만 지정'), (s) => {
      const ev = s.events.find((x) => x.id === e.id);
      ev.fix = fix;
      if (fix === 'pairs') ev.pairs = pairs;
      for (const m of s.matches) if (m.eventId === ev.id) { delete m.eventId; m.pinned = false; }
    }, ['events', 'pins']);
  }
  function setPair(d, home, away) {
    const e = homeEv(d);
    if (!e || S.locked()) return false;
    return app().commit(fmt.short(d) + ' ' + e.name + ' 대진: ' + (away ? away + ' @ ' + home : home + ' 상대 비움'), (s) => {
      const ev = s.events.find((x) => x.id === e.id);
      const pairs = (ev.pairs || []).filter((p) => p.home !== home && (!away || p.away !== away));
      if (away) pairs.push({ home, away });
      const order = S.evTeams(ev);
      ev.pairs = pairs.sort((a, b) => order.indexOf(a.home) - order.indexOf(b.home));
      for (const m of s.matches) if (m.eventId === ev.id) { delete m.eventId; m.pinned = false; }
    }, ['events', 'pins']);
  }
  function convertMatch(d) {
    const ms = matchEvs(d);
    if (!ms.length || S.locked()) return false;
    const st = app().state, homes = ms.map((e) => e.home).filter((n, i, a) => st.teams.some((t) => t.name === n) && a.indexOf(n) === i).slice(0, half());
    const kind = evKind(d);
    return app().commit(fmt.short(d) + ' 대진 지정 ' + ms.length + '경기 → 홈 구장 지정(대진까지 고정)', (s) => {
      const ids = new Set(ms.map((e) => e.id));
      const keep = s.events.find((x) => x.mode === 'STADIUM' && dn(x.date) === d);
      s.events = s.events.filter((x) => !ids.has(x.id));
      for (const m of s.matches) if (ids.has(m.eventId)) { delete m.eventId; m.pinned = false; }
      const ev = keep || { id: evId(kind.type), type: kind.type === 'CUSTOM' ? (ms[0].type || 'CUSTOM') : kind.type, name: kind.type === 'CUSTOM' ? ms[0].name : kind.name, date: Dates.isoDate(d), mode: 'STADIUM' };
      ev.teams = homes; ev.stadiums = homes.map((n) => s.teams.find((t) => t.name === n).stadium); ev.slot = Score.resolveEventSlot(ev, s.calendar);
      ev.fix = 'pairs'; ev.pairs = ms.filter((x) => homes.includes(x.home)).map((x) => ({ home: x.home, away: x.away }));
      if (!keep) s.events.push(ev);
    }, ['events', 'pins']);
  }
  S.calHome = { toggleHome, removeHome, clearHome, convertMatch, setFix, setPair };
  S.modals.homeRule = function () {
    const a = S.ui.homeAsk || {}, st = app().state;
    const run = a.kind === 'run', e = run ? null : homeEv(a.d);
    const list = run ? S.clearedRuleHomes(st) : e ? [e] : [];
    const names = list.map((x) => fmt.short(x.date) + ' ' + x.name).join(' · ');
    return '<div class="modal narrow" role="dialog" aria-modal="true" aria-label="' + (run ? '홈 구장 지정 없이 시작할까요?' : '정말 지울까요?') + '">' +
      '<div class="modal-head">' + icon('warn') + '<h3>' + (run ? '홈 구장 지정 없이 시작할까요?' : '정말 지울까요?') + '</h3><button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div style="padding:14px;display:flex;flex-direction:column;gap:10px"><p class="small" style="margin:0">' + (run ? '<b>' + esc(names) + '</b> 홈 구장 지정을 지운 채입니다. ' : '<b>' + esc(names) + '</b> 홈 구장 지정을 지우면 ') + esc(S.RULE_HOME_TEXT) + '.</p>' +
      '<div class="confirm-box">' + icon('info') + '<span>' + (run ? '이대로 시작하면 그 날은 홈 구장을 지키지 않습니다.' : '지운 날은 서버에 「지정 없음」으로 보내 그 날 홈 구장을 지키지 않습니다. 공사·재난 같은 예외일 때만 지우세요. 실행 취소로 되돌릴 수 있습니다.') + '</span></div></div>' +
      '<div class="modal-foot"><span style="margin-left:auto;display:flex;gap:8px">' +
      (run ? '<button class="btn" data-act="home-rule-fix">' + S.CIRCLED[1] + ' 3단계에서 다시 지정</button><button class="btn primary" data-act="home-rule-run">그래도 시작</button>'
        : '<button class="btn" data-act="close-modal">취소</button><button class="btn danger" data-act="home-rule-clear">지우기</button>') +
      '</span></div></div>';
  };
  S.calHomeBox = function (d, b) {
    const st = app().state, e0 = homeEv(d), cleared = S.homeCleared(e0), e = cleared ? null : e0, picked = e ? S.evTeams(e) : [], ms = matchEvs(d);
    const on = !!e || C.homeOpen === d;
    const head = '<div class="sc-home-head"><button class="sc-tog' + (on ? ' on' : '') + '" data-act="' + (on ? 'cal-home-off' : 'cal-home-on') + '" role="switch" aria-checked="' + on + '"' + (b ? '' : ' disabled') + '><i></i><b>홈 구장 지정</b></button>' + (e ? '<span class="sc-home-n">' + picked.length + ' / ' + half() + '곳</span>' : cleared ? S.stat('warn', '지정 없음') : '') + '</div>' +
      (cleared ? '<div class="sc-warn">' + icon('warn') + '<span>' + esc(e0.name) + ' 홈 구장 지정을 지웠습니다 — ' + esc(S.RULE_HOME_TEXT) + '. 서버에는 「지정 없음」으로 보냅니다. 켜고 구단을 고르면 다시 지정합니다.</span></div>' : '');
    if (!b) return head + '<div class="sc-note">이 날은 묶음이 없어 경기가 없습니다. 2단계 달력에서 끌어서 묶음을 만들면 홈 구장을 지정할 수 있습니다.</div>';
    const fix = e && e.fix === 'pairs' ? 'pairs' : 'home';
    let s = head;
    if (e) s += '<div class="sc-seg sc-fix" role="radiogroup" aria-label="지정 방식"><button class="' + (fix === 'pairs' ? 'on' : '') + '" data-act="cal-home-fix" data-fix="pairs" role="radio" aria-checked="' + (fix === 'pairs') + '">대진까지 고정</button><button class="' + (fix === 'home' ? 'on' : '') + '" data-act="cal-home-fix" data-fix="home" role="radio" aria-checked="' + (fix === 'home') + '">홈 구장만 지정</button></div>';
    s += '<div class="sc-note">' + (fix === 'pairs' ? '이 날 홈 구단 ' + half() + '곳과 상대까지 정합니다. 자동 편성은 그 시리즈를 고정합니다.' : '이 날 홈 경기를 해야 하는 구단 ' + half() + '곳을 고릅니다. 상대는 자동 편성이 정합니다.') + '</div>';
    if (on) {
      s += '<div class="sc-home-teams" role="group" aria-label="홈 경기 구단">' + st.teams.map((t) => {
        const sel = picked.includes(t.name);
        const clash = !sel && picked.some((x) => x !== t.name && (st.teams.find((y) => y.name === x) || {}).stadium === t.stadium);
        return '<button class="gs-tbtn' + (sel ? ' on' : '') + (clash ? ' dim' : '') + '" data-act="cal-home-team" data-team="' + esc(t.name) + '" aria-pressed="' + sel + '" style="--tc:' + esc(t.color || '#555') + '" title="' + esc(t.stadium + (clash ? ' — 같은 구장 구단을 이미 골랐습니다' : '')) + '"><i></i>' + esc(t.name) + '</button>';
      }).join('') + '</div>';
      const shared = app().sharedStadiums();
      if (shared.size) s += '<div class="sc-note">' + Array.from(shared).map(([x, n]) => esc(x.replace(/종합운동장$/, '')) + '은 ' + esc(n.join('·')) + ' 중 하나만 고릅니다').join(' · ') + '.</div>';
      if (e && fix === 'pairs' && picked.length) {
        const pairs = e.pairs || [];
        s += '<div class="sc-sub">대진 <small>원정 @ 홈</small></div><div class="sc-pairs">' + picked.map((h) => {
          const p = pairs.find((x) => x.home === h), used = new Set(pairs.filter((x) => x.home !== h).map((x) => x.away));
          const opts = st.teams.filter((t) => !picked.includes(t.name) && !used.has(t.name)).map((t) => '<option value="' + esc(t.name) + '"' + (p && p.away === t.name ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
          return '<label class="sc-pair">' + S.team(h) + '<span class="muted">홈 · 상대</span><select class="input xs" data-in="cal-pair" data-home="' + esc(h) + '" aria-label="' + esc(h + ' 홈 상대') + '"><option value="">고르기</option>' + opts + '</select></label>';
        }).join('') + '</div>';
      }
      if (e && !S.homeComplete(e)) s += '<div class="sc-warn">' + icon('info') + '<span>' + (picked.length < half() ? (half() - picked.length) + '곳 더 고릅니다' : '대진의 상대를 모두 고릅니다') + (e.type === 'CHILDREN' ? ' — 어린이날은 ' + half() + '곳을 모두 골라야 합니다' : '') + '.</span></div>';
    }
    if (ms.length) s += '<div class="sc-warn">' + icon('warn') + '<span>예전 방식 「대진 지정」 ' + ms.length + '경기가 이 날에 있습니다(' + esc(ms.map((x) => x.away + '–' + x.home).slice(0, 3).join(', ')) + (ms.length > 3 ? ' …' : '') + '). <button class="lnk" data-act="cal-ev-convert">홈 구장 지정(대진까지 고정)으로 바꾸기</button></span></div>';
    return s;
  };
  /** 확인(4단계)의 홈 구장 지정 줄 */
  S.calHomeLine = function () {
    const st = app().state, evs = st.events.filter((e) => e.mode === 'STADIUM').slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!evs.length) return '아직 없음';
    return evs.map((e) => fmt.short(e.date) + ' ' + e.name + ' ' + (S.homeCleared(e) ? '지정 없음' : S.evTeams(e).length + '곳' + (e.fix === 'pairs' ? '(대진 고정)' : ''))).join(' · ');
  };
  /** 「다음: 검토·실행」 전에: 대진까지 고정(fix 'pairs')한 홈 구장 지정과 예전 대진 지정만 그 시리즈를 고정한다(app.applyEvents). 홈 구장만·fix 없음은 서버가 지킨다 */
  S.calBeforeNext = function () {
    const st = app().state;
    if (st.events.some((e) => e.mode === 'MATCH' || (e.mode === 'STADIUM' && e.fix === 'pairs' && (e.teams || []).length))) app().applyEvents({ silent: true, label: '홈 구장 지정 시리즈 고정' });
  };

  // ───────── 동작 ─────────
  Object.assign(S.actions, {
    'cal-open': (el) => pickOpening(el.dataset.date),
    'cal-open-other': () => { C.other = true; S.render(); const i = document.querySelector('[data-in="cal-open-other"]'); if (i) i.focus(); },
    'cal-open-change': () => { C.pickOpen = true; S.render(); },
    'cal-open-cancel': () => { C.pickOpen = false; C.other = false; S.render(); },
    'cal-edit': (el) => { C.edit = C.edit === el.dataset.k ? null : el.dataset.k; S.render(); },
    'cal-end-auto': () => { layCommit('1차 편성 종료일: 자동(경기일 ' + S.gameDaysCheck().need + '일이 되는 첫 일요일)', { initialEndAuto: true }); },
    'cal-relay-go': () => { fillByRule(); },
    'cal-relay-no': () => { C.relay = null; S.render(); },
    'cal-go-day': (el) => pickDay(+el.dataset.d),
    'cal-hol-all': () => { C.holAll = !C.holAll; S.render(); },
    'cal-home-team': (el) => { if (C.day != null) toggleHome(C.day, el.dataset.team); },
    'cal-home-on': () => { if (C.day != null) { C.homeOpen = C.day; S.render(); } },
    'cal-home-off': () => {
      if (C.day == null) return;
      const e = homeEv(C.day);
      C.homeOpen = null;
      if (!e || S.homeCleared(e)) { S.render(); return; }
      removeHome(C.day);
    },
    'home-rule-clear': () => { const a = S.ui.homeAsk; S.ui.homeAsk = null; S.go({ modal: null }); if (a && a.d != null) { C.homeOpen = null; clearHome(a.d); } },
    'home-rule-fix': () => {
      const e = S.clearedRuleHomes()[0];
      S.ui.homeAsk = null;
      if (e) C.day = dn(e.date);
      S.flowGo(3);
    },
    'home-rule-run': () => { S.ui.homeAsk = null; S.homeRuleRunOk = true; S.go({ modal: null }); S.startRun(); },
    'cal-home-fix': (el) => { if (C.day != null) setFix(C.day, el.dataset.fix); },
    'cal-ev-convert': () => { if (C.day != null) convertMatch(C.day); },
    'cal-len': (el) => setLen(+el.dataset.i, +el.dataset.n),
    'cal-split': (el) => splitBundle(+el.dataset.i),
    'cal-del': (el) => removeBundle(+el.dataset.i),
    'cal-pop-close': () => { C.slotAt = null; S.render(); },
    'rest-wd': (el) => {
      const w = +el.dataset.wd, cur = set().restWeekdays;
      const next = cur.includes(w) ? cur.filter((x) => x !== w) : cur.concat([w]).sort();
      ruleSetting('휴식 요일: ' + (next.map((x) => WD[x]).join('·') || '없음'), { restWeekdays: next });
    },
    'cal-por': (el) => {
      if (S.locked()) return;
      const i = +el.dataset.row, h = set().holidays[i];
      if (!h) return;
      const v = !S.playOnRest(h);
      const ok = app().commit('공휴일 ' + fmt.date(h.date) + ' ' + h.name + ': 휴식 요일이어도 경기 ' + (v ? '켜기' : '끄기'), (x) => { x.settings.holidays[i].playOnRest = v; }, ['settings']);
      if (ok && set().seasonStart) C.relay = { why: fmt.date(h.date) + ' ' + h.name + ' — 휴식 요일이어도 경기를 ' + (v ? '켰습니다(그 날 경기, 그 주 목요일 휴식).' : '껐습니다(그 날 경기 없음).') };
      S.render();
    },
    'cal-hol-add': () => {
      if (S.locked()) return;
      const s = set(), y = S.seasonYear();
      const base = s.seasonStart ? dn(s.seasonStart) : dn(y + '-03-01');
      const have = new Set(s.holidays.map((h) => h.date));
      let d = base; while (have.has(Dates.isoDate(d))) d++;
      app().commit('공휴일 줄 추가', (x) => { x.settings.holidays.push({ date: Dates.isoDate(d), name: '임시 공휴일', weight: CalendarGen.HOLIDAY_WEIGHT }); x.settings.holidays.sort((p, q) => (p.date < q.date ? -1 : 1)); S.recalcCalendar(x); }, ['settings', 'calendar']);
      S.toast(fmt.date(d) + ' 「임시 공휴일」 줄을 넣었습니다. 날짜·이름·가중치를 고치세요. 연전 묶음은 그대로입니다.', 'info', 4000);
    },
    'cal-hol-del': (el) => {
      if (S.locked()) return;
      const i = +el.dataset.row, h = set().holidays[i];
      if (!h) return;
      app().commit('공휴일 지우기: ' + fmt.date(h.date) + ' ' + h.name, (x) => { x.settings.holidays.splice(i, 1); S.recalcCalendar(x); }, ['settings', 'calendar']);
    },
    'cal-next': () => { if (S.calNext) S.calNext(); }
  });
  /** 「다음: ② 검토·실행」: 묶음이 바뀌어 시리즈가 맞지 않으면(경기일 합이 맞을 때) 규칙대로 다시 만들고, 대진 고정을 걸고 ②로 */
  S.calNext = function () {
    const sr = seriesState();
    C.seriesError = null;
    if (!sr.ok && S.gameDaysCheck().ok && !S.locked()) {
      const g = app().generateSeriesPreview();
      // 시리즈를 만들 수 없으면(예: 격년 홈 73 구단과 개막전 홈 구단이 맞지 않음) 4 확인에 남아 이유와 고칠 곳을 보여 준다
      if (g.errors.length) { C.seriesError = g.errors[0]; S.toast('시리즈를 만들 수 없어 넘어가지 않았습니다. 4 확인에서 이유를 보세요.', 'warn', 6000); S.flowGo(4); return; }
      if (app().regenerateSeries()) S.toast('묶음에 맞춰 시리즈 ' + app().state.matches.length + '개를 규칙대로 만들었습니다(맞대결 ' + set().initialGamesPerPair + '경기). 실행 취소로 되돌릴 수 있습니다.', 'ok', 6000);
    }
    S.calBeforeNext();
    S.go({ step: 2, ops: null, sel: null, edit: null });
  };
  S.inputs['cal-open-other'] = (el) => {
    const v = S.parse.date(el.value);
    if (!v) { el.classList.add('err'); S.toast("날짜로 읽을 수 없습니다: '" + el.value + "' — 4/3처럼 적습니다.", 'bad'); return; }
    pickOpening(v);
  };
  S.inputs['cal-set'] = (el) => {
    if (S.locked()) return;
    const k = el.dataset.k, s = set();
    if (k === 'allStarDays') {
      const n = Number(el.value);
      if (!Number.isInteger(n) || n < 1 || n > 14) { el.classList.add('err'); S.toast('올스타 휴식기 길이는 1~14일입니다.', 'bad'); return; }
      if (n === (+s.allStarDays || 6)) return;
      ruleSetting('올스타 휴식기 길이: ' + n + '일', { allStarDays: n });
      return;
    }
    const v = S.parse.date(el.value);
    if (!v) { el.classList.add('err'); S.toast("날짜로 읽을 수 없습니다: '" + el.value + "' — 9/5나 2027-09-05처럼 적습니다.", 'bad'); return; }
    if (v === s[k]) return;
    if (k === 'initialEnd') {
      if (v <= s.seasonStart) { el.classList.add('err'); S.toast('1차 편성 종료일은 개막일 뒤여야 합니다.', 'bad'); return; }
      layCommit('1차 편성 종료일: ' + fmt.date(v) + '(직접)', { initialEnd: v, initialEndAuto: false });
    } else if (k === 'seasonEnd') {
      app().commit('시즌 종료일: ' + fmt.date(v), (x) => { x.settings.seasonEnd = v; if (x.reschedule) x.reschedule.end = v; S.recalcCalendar(x); }, ['settings']);
    } else if (k === 'allStarStart') {
      ruleSetting('올스타 휴식기 시작: ' + fmt.date(v), { allStarStart: v });
      if (Dates.weekday(dn(v)) !== 5) S.toast('올스타 휴식기는 보통 금요일에 시작합니다.', 'warn', 4000);
    }
  };
  S.inputs['cal-pair'] = (el) => { if (C.day != null) setPair(C.day, el.dataset.home, el.value); };
  S.inputs['cal-hol'] = (el) => {
    if (S.locked()) return;
    const i = +el.dataset.row, k = el.dataset.k, h = set().holidays[i];
    if (!h) return;
    let v = el.value.trim();
    if (k === 'date') { v = S.parse.date(v); if (!v) { el.classList.add('err'); S.toast("날짜로 읽을 수 없습니다: '" + el.value + "'", 'bad'); return; } if (set().holidays.some((x, j) => j !== i && x.date === v)) { el.classList.add('err'); S.toast(fmt.date(v) + '은(는) 이미 표에 있습니다.', 'bad'); return; } }
    if (k === 'name' && !v) { el.classList.add('err'); S.toast('이름이 비었습니다.', 'bad'); return; }
    // 가중치는 정수(엔진의 휴일 값이 정수라 묶음 합도 정수여야 한다)
    if (k === 'weight') { const n = Number(v); if (!Number.isInteger(n) || n < 0 || n > 10) { el.classList.add('err'); S.toast('가중치는 0~10 정수입니다(주말 하루 = 1).', 'bad'); return; } v = n; }
    if (String(h[k] == null ? (k === 'weight' ? CalendarGen.HOLIDAY_WEIGHT : '') : h[k]) === String(v)) return;
    app().commit('공휴일 ' + fmt.date(h.date) + ' ' + ({ date: '날짜', name: '이름', weight: '가중치' }[k]) + ': ' + (h[k] == null ? '' : h[k]) + ' → ' + v, (x) => { x.settings.holidays[i][k] = v; x.settings.holidays.sort((p, q) => (p.date < q.date ? -1 : 1)); S.recalcCalendar(x); }, ['settings', 'calendar']);
  };

  // ───────── 자가 점검 (?selftest=1, guide-steps.js의 selftest가 부른다 — 2025 예시 데이터로) ─────────
  S.calSelftest = async function ({ ok, click, flush }) {
    const st = () => app().state, q = (sel) => document.querySelector(sel), qa = (sel) => document.querySelectorAll(sel);
    const cell = (iso) => q('.sc-strip .sd[data-d="' + dn(iso) + '"]');
    const mouse = (iso, type) => { const el = cell(iso); if (!el) throw new Error('달력에 없음: ' + iso); el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 })); };
    const drag = (a, b, via) => { mouse(a, 'mousedown'); for (const v of via || []) mouse(v, 'mouseover'); mouse(b, 'mouseover'); mouse(b, 'mouseup'); flush(); };
    const tap = (iso) => { mouse(iso, 'mousedown'); mouse(iso, 'mouseup'); flush(); };
    const gd = () => S.gameDaysCheck().have;
    const blk = () => st().settings.blackouts.map((b) => b.start.slice(5) + '~' + b.end.slice(5)).join(',');
    const bAt = (iso) => st().calendar.find((c) => c.datetime.startsWith(iso));
    const undoN = (n) => { for (let k = 0; k < n; k++) app().undo(); flush(); };
    C.day = null; C.slotAt = null; S.flowGo(2);
    // 1. 2단계: 왼쪽(개막일 · 자동으로 채운 것 · 연전 규칙) + 가운데 달력, 오른쪽 없음
    ok('2단계: 왼쪽 개막일(골라 둠)·자동으로 채운 것(1차 편성 종료일·시즌 종료일·휴식 요일·올스타 휴식기)·연전 규칙 + 달력 · 오른쪽 없음', !!q('.sc.s2') && !!q('.sc-left .fl-ask.ok') && qa('.sc-auto .sc-arow').length === 5 && !!q('.sc-rules') && !!q('.sc-strip') && !q('.sc-right') && !q('.band'));
    ok('2단계: 2025 예시 → 「경기일 135 / 135일」 맞음 · 2연전 1 · 3연전 43 · 4연전 1 · 묶음 45개 · 3월~8월 6줄 · 규칙대로와 같음', /경기일 135 \/ 135일/.test(q('#scCount').textContent) && q('#scCount').classList.contains('ok') && /2연전 1 · 3연전 43 · 4연전 1 · 묶음 45개/.test(q('.sc-hist').textContent) && qa('.sc-strip .strip-row').length === 6 && S.calSameAsRule());
    ok('2단계: 토요일 파랑 · 일요일·공휴일 빨강 · 5/5 홈 구장 지정 표시 · 단계 띠 「2 / 4단계」', cell('2025-03-22').classList.contains('sat') && cell('2025-03-23').classList.contains('sun') && cell('2025-05-05').classList.contains('hol') && cell('2025-05-05').classList.contains('ev') && /2 \/ 4단계/.test(q('.fb-lead').textContent));
    // 3. 묶음 누르기 → 말풍선 → 지우기 → 경기 없는 날(휴식기) · 시리즈는 일정 미정으로 · 실행 취소
    const p0 = Array.from(app().derived().plan), s5 = st().calendar.findIndex((c) => c.datetime.startsWith('2025-04-08'));
    tap('2025-04-09');
    ok('묶음 누르기 → 말풍선(연전 수 2·3·4 · 지우기) · 고른 날 4/9', !!q('#scPop') && qa('#scPop [data-act="cal-len"]').length === 3 && !!q('#scPop [data-act="cal-del"]') && C.day === dn('2025-04-09') && cell('2025-04-08').classList.contains('sel'));
    click('#scPop [data-act="cal-del"]'); flush();
    const plan1 = app().derived().plan, moved = p0.every((c, m) => (c === s5 ? plan1[m] === -1 : c < s5 ? plan1[m] === c : c > s5 ? plan1[m] === c - 1 : plan1[m] === -1));
    ok('묶음 지우기 → 44개 · 132일 · 4/8~4/10 휴식기 · 그 묶음 시리즈만 일정 미정, 나머지는 같은 묶음에 그대로', st().calendar.length === 44 && gd() === 132 && /04-08~04-10/.test(blk()) && moved && /132 \/ 135일/.test(q('#scCount').textContent) && /3일 남음/.test(q('#scCount').textContent));
    // 4. 끌어서 묶음 만들기 (4/8 화 ~ 4/10 목)
    drag('2025-04-08', '2025-04-10', ['2025-04-09']);
    ok('끌기 4/8~4/10 → 3연전 묶음 · 135일 · 휴식기에서 빠짐 · 말풍선은 누를 때만', !!bAt('2025-04-08') && bAt('2025-04-08').consecutive === 3 && gd() === 135 && !/04-08/.test(blk()) && st().calendar.length === 45 && !q('#scPop') && C.day === dn('2025-04-08'));
    undoN(1);
    ok('실행 취소 한 번 → 끌기 전(132일)', gd() === 132 && !bAt('2025-04-08'));
    undoN(1);
    ok('실행 취소 한 번 더 → 지우기 전(135일 · 시리즈 배정 그대로)', gd() === 135 && Array.from(app().derived().plan).every((c, m) => c === p0[m]));
    // 5. 휴식 요일을 지나면 끊김 · 5일 이상 거부 · 월요일에 그리면 휴식일 경기
    drag('2025-07-11', '2025-07-15', ['2025-07-12', '2025-07-13', '2025-07-14']);
    ok('끌기 7/11(금)~7/15(화) → 월요일에서 끊겨 금·토·일 3연전', !!bAt('2025-07-11') && bAt('2025-07-11').consecutive === 3 && gd() === 138);
    undoN(1);
    tap('2025-07-17'); click('#scPop [data-act="cal-del"]'); flush();
    const n5 = st().calendar.length;
    drag('2025-07-15', '2025-07-20', ['2025-07-16', '2025-07-17', '2025-07-18', '2025-07-19']);
    ok('끌기 6일(7/15~7/20) → 거부(연전은 2~4일) · 묶음 그대로', st().calendar.length === n5 && !bAt('2025-07-15'));
    drag('2025-07-14', '2025-07-16', ['2025-07-15']);
    ok('월요일(7/14)을 눌러 끌기 → 월·화·수 3연전 · 휴식일 경기에 7/14', !!bAt('2025-07-14') && bAt('2025-07-14').consecutive === 3 && st().settings.restExceptions.includes('2025-07-14'));
    undoN(2);
    ok('실행 취소 두 번 → 7/17 4연전 복귀', !!bAt('2025-07-17') && bAt('2025-07-17').consecutive === 4 && gd() === 135);
    // 6. 연전 수 바꾸기·겹침 거부·둘로 나누기·Esc·Delete
    tap('2025-07-18'); click('#scPop [data-act="cal-len"][data-n="3"]'); flush();
    ok('연전 수 4 → 3 → 경기일 134 · 7/20 휴식기', bAt('2025-07-17').consecutive === 3 && gd() === 134 && /07-20~07-20/.test(blk()));
    undoN(1);
    tap('2025-04-08'); click('#scPop [data-act="cal-len"][data-n="4"]'); flush();
    ok('연전 수 3 → 4가 다음 묶음과 겹치면 거부', bAt('2025-04-08').consecutive === 3 && gd() === 135);
    tap('2025-07-17'); click('#scPop [data-act="cal-split"]'); flush();
    ok('둘로 나누기 7/17 4연전 → 2연전 + 2연전 (46개 · 135일)', st().calendar.length === 46 && bAt('2025-07-17').consecutive === 2 && bAt('2025-07-19').consecutive === 2 && gd() === 135);
    undoN(1);
    tap('2025-06-03');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); flush();
    const escOk = !q('#scPop') && C.day === dn('2025-06-03');
    tap('2025-06-03');
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })); flush();
    const delOk = !bAt('2025-06-03') && gd() === 132;
    undoN(1);
    ok('Esc → 말풍선 닫기 · Delete → 고른 묶음 지우기 · 실행 취소', escOk && delOk && !!bAt('2025-06-03') && gd() === 135);
    // 7. 3단계: 같은 달력에서 공휴일 표·홈 구장 지정 · 날을 누르면 오른쪽
    S.flowGo(3);
    ok('3단계: 왼쪽 공휴일 표(1차 편성 기간 것만 펼침)·홈 구장 지정 목록 + 같은 달력 + 오른쪽 고른 날 · 끌어도 묶음이 생기지 않음', !!q('.sc.s3') && !!q('.sc-hols') && !!q('.sc-homes') && !!q('.sc-right .sc-day') && qa('.sc-hols tbody tr').length === 4 && /2 \/ 2/.test(q('.sc-homes h4').textContent), qa('.sc-hols tbody tr').length + '줄');
    { const n0 = st().calendar.length; tap('2025-04-08'); drag('2025-07-14', '2025-07-16', ['2025-07-15']); ok('3단계: 날 누르기 = 고른 날(말풍선 없음) · 끌기 무시', !q('#scPop') && st().calendar.length === n0 && C.day === dn('2025-07-14')); }
    // 7. 공휴일 표: 가중치를 고치면 묶음 값(든 날 가중치 합)이 바뀐다 · 줄 추가·지우기
    const hi = st().settings.holidays.findIndex((h) => h.date === '2025-05-05');
    const w5 = () => bAt('2025-05-05').holiday;
    const wIn = () => q('.sc-hols input[data-row="' + hi + '"][data-k="weight"]');
    const w0 = w5();
    wIn().value = '1'; wIn().dispatchEvent(new Event('change', { bubbles: true })); flush();
    const w1 = w5();
    undoN(1);
    ok('공휴일 표: 어린이날 가중치 3(KBO 확인 필요 표시) → 1이면 5/5 묶음 값 5 → 3 · 실행 취소', w0 === 5 && w1 === 3 && w5() === 5 && /KBO 확인 필요/.test(q('.sc-hols').textContent) && wIn().value === '3', w0 + '→' + w1);
    const u7 = app().store.undoStack.length;
    wIn().value = '2.5'; wIn().dispatchEvent(new Event('change', { bubbles: true })); flush();
    ok('공휴일 표: 가중치는 0~10 정수만(2.5는 거부 — 엔진의 휴일 값이 정수)', app().store.undoStack.length === u7 && w5() === 5 && Number.isInteger(bAt('2025-05-05').holiday));
    const nh = st().settings.holidays.length;
    click('.sc-hols [data-act="cal-hol-add"]'); flush();
    const added = st().settings.holidays.length === nh + 1;
    undoN(1);
    ok('공휴일 표: 「줄 추가」 → 한 줄 · 실행 취소', added && st().settings.holidays.length === nh);
    // 공휴일별 「휴식 요일이어도 경기」: 켜고 끌 때만 「묶음에 반영할까요?」(반영하면 규칙대로 다시 깔기) · 표를 고쳐도 묶음은 몰래 바뀌지 않는다
    const c0 = JSON.stringify(st().calendar);
    const por = () => q('.sc-hols [data-act="cal-por"][data-row="' + st().settings.holidays.findIndex((h) => h.date === '2025-05-05') + '"]');
    ok('공휴일 표: 휴식 요일(월) 공휴일 5/5에 「월 경기」 켜짐(어린이날 기본) · 평일 공휴일은 「—」', !!por() && por().classList.contains('on') && qa('.sc-hols [data-act="cal-por"]').length === 1);
    click('.sc-hols [data-act="cal-por"]'); flush();
    const asked = !!q('.sc-relay') && JSON.stringify(st().calendar) === c0 && !S.playOnRest(st().settings.holidays.find((h) => h.date === '2025-05-05'));
    click('.sc-relay [data-act="cal-relay-go"]'); flush();
    const relaid = !st().settings.restExceptions.includes('2025-05-05') && !bAt('2025-05-05') && !!bAt('2025-05-06') && !q('.sc-relay');
    undoN(2);
    ok('「월 경기」 끄기 → 묶음은 그대로 「묶음에 반영할까요?」 → 반영하면 5/5 경기 없음(5/6부터 3연전) · 실행 취소 두 번으로 복귀', asked && relaid && JSON.stringify(st().calendar) === c0 && S.playOnRest(st().settings.holidays.find((h) => h.date === '2025-05-05')), 'asked ' + asked + ' · relaid ' + relaid);
    // 9. 「다음: ② 검토·실행」(4 확인): 묶음이 바뀌어 시리즈가 맞지 않으면 규칙대로 다시 만든다
    S.flowGo(2); tap('2025-07-17'); click('#scPop [data-act="cal-split"]'); flush();
    const before = S.calSeriesState();
    S.flowGo(4);
    click('.ck-card [data-act="cal-next"]'); flush();
    ok('묶음을 나누면 4 확인에 「다시 만듭니다」 → 「다음: ② 검토·실행」이 시리즈를 규칙대로 다시 만들고(묶음 46 × 5 = 230개) ② · 사전 점검 진행 불가 0', !before.ok && S.ui.step === 2 && st().matches.length === 230 && S.calSeriesState().ok && app().preflight().counts.block === 0, before.text + ' · ' + st().matches.length);
    S.go({ step: 1 }); undoN(2);
    ok('실행 취소 두 번(시리즈·나누기 — 홈 구장만 지정인 개막전·어린이날은 고정하지 않음) → 나누기 전 · 시리즈 그대로', st().calendar.length === 45 && S.calSeriesState().ok && Array.from(app().derived().plan).every((c, m) => c === p0[m]));
    // 10. 홈 구장 지정(3단계): 5/5 어린이날 · 3/22 개막전 · 잠실은 하나만 · 5곳 넘으면 거부 · 대진까지 고정 / 홈 구장만 지정
    S.flowGo(3);
    const evAt = (iso) => st().events.find((e) => e.mode === 'STADIUM' && e.date === iso);
    const teamBtn = (n) => q('.sc-day [data-act="cal-home-team"][data-team="' + n + '"]');
    tap('2025-05-05');
    ok('5/5를 누르면 「고른 날 · 5/5(월)」 · 홈 구장 지정 켜짐 · 두산·키움·한화·NC·롯데 5 / 5곳 · 홈 구장만 지정', /고른 날 · 5\/5\(월\)/.test(q('.sc-day').textContent) && q('.sc-day .sc-tog').classList.contains('on') && qa('.sc-day .gs-tbtn.on').length === 5 && ['두산', '키움', '한화', 'NC', '롯데'].every((n) => teamBtn(n).classList.contains('on')) && q('.sc-day .sc-fix [data-fix="home"]').classList.contains('on'));
    const u0 = app().store.undoStack.length;
    click('.sc-day [data-act="cal-home-team"][data-team="LG"]'); flush();
    click('.sc-day [data-act="cal-home-team"][data-team="SSG"]'); flush();
    ok('5곳이 찼으면 더 넣지 않음 · 잠실은 두산·LG 중 하나만', app().store.undoStack.length === u0 && evAt('2025-05-05').teams.length === 5 && !evAt('2025-05-05').teams.includes('LG') && teamBtn('LG').classList.contains('dim'));
    click('.sc-day [data-act="cal-home-team"][data-team="두산"]'); flush();
    const partial = /고르는 중 4 \/ 5/.test(q('.sc-homes').textContent) && /1 \/ 2/.test(q('.sc-homes h4').textContent) && !S.flowStatus().done[2];
    click('.sc-day [data-act="cal-home-team"][data-team="LG"]'); flush();
    const sw = evAt('2025-05-05');
    ok('두산을 빼면 「고르는 중 4 / 5」 · 3단계 미완료 → LG를 넣으면 LG·키움·한화·NC·롯데 · 서버 어린이날 구단도 같이', partial && sw.teams.join() === 'LG,키움,한화,NC,롯데' && st().settings.obligationTeams.join() === 'LG,키움,한화,NC,롯데' && S.flowStatus().done[2]);
    undoN(2);
    tap('2025-03-22');
    const op = () => evAt('2025-03-22');
    ok('개막전 3/22(토): 홈 구장 5곳(SSG·LG·KT·삼성·KIA)', op().type === 'OPENING' && op().teams.join() === 'SSG,LG,KT,삼성,KIA' && qa('.sc-day .gs-tbtn.on').length === 5);
    click('.sc-day [data-act="cal-home-fix"][data-fix="pairs"]'); flush();
    const pairs0 = (op().pairs || []).map((x) => x.away + '@' + x.home).join();
    ok('「대진까지 고정」 → 지금 일정의 개막 대진 5개를 채움 · 대진 칸 5개 · 다 정함', op().fix === 'pairs' && op().pairs.length === 5 && qa('.sc-day .sc-pair select').length === 5 && S.homeComplete(op()), pairs0);
    const ssgSel = q('.sc-day select[data-home="SSG"]');
    ssgSel.value = ''; ssgSel.dispatchEvent(new Event('change', { bubbles: true })); flush();
    const notDone = !S.homeComplete(op()) && /상대를 모두 고릅니다/.test(q('.sc-day').textContent);
    undoN(1);
    app().applyEvents({ silent: true });
    const pinned = op().pairs.every((p) => st().matches.some((m, i) => m.home === p.home && m.away === p.away && m.pinned && m.eventId === op().id && app().derived().plan[i] === 0));
    undoN(1);
    click('.sc-day [data-act="cal-home-fix"][data-fix="home"]'); flush();
    app().applyEvents({ silent: true });
    const freeHome = op().fix === 'home' && !st().matches.some((m) => m.eventId === op().id);
    undoN(2);
    ok('대진 칸을 비우면 3단계 미완료 · 대진까지 고정은 그 시리즈 5개를 개막 연전에 고정 · 홈 구장만 지정이면 고정하지 않음(서버가 지킴)', notDone && pinned && freeHome, 'notDone ' + notDone + ' · pinned ' + pinned + ' · free ' + freeHome);
    tap('2025-06-03');
    const offFirst = !q('.sc-day .sc-tog').classList.contains('on') && !q('.sc-day .gs-tbtn');
    click('.sc-day [data-act="cal-home-on"]'); flush();
    click('.sc-day [data-act="cal-home-team"][data-team="KIA"]'); flush();
    const made = evAt('2025-06-03');
    ok('지정 없는 날(6/3): 켜면 구단 단추 → KIA를 고르면 홈 구장 지정 1곳(홈 구장만) · 달력·목록에 표시', offFirst && !!made && made.teams.join() === 'KIA' && made.fix === 'home' && cell('2025-06-03').classList.contains('ev') && /1 \/ 5곳/.test(q('.sc-day').textContent) && qa('.sc-homes .sc-hrow').length === 3);
    click('.sc-day [data-act="cal-home-off"]'); flush();
    ok('끄면 그 날 지정을 지움', !evAt('2025-06-03') && !cell('2025-06-03').classList.contains('ev'));
    undoN(2);
    // 개막전·어린이날은 규칙(노트 「사」): 지우면 묻고, 지우면 teams: []로 남김 → 확인 필요 · ② 시작 전 한 번 더
    tap('2025-05-05');
    const clrN0 = app().store.undoStack ? app().store.undoStack.length : 0;
    click('.sc-day [data-act="cal-home-off"]'); flush();
    const clrAsked = S.ui.modal === 'homeRule' && /정말 지울까요/.test((q('.modal') || {}).textContent || '') && /KBO 원칙/.test(q('.modal').textContent) && evAt('2025-05-05').teams.length === 5;
    click('.modal [data-act="close-modal"]'); flush();
    const clrKept = !S.ui.modal && evAt('2025-05-05').teams.length === 5;
    click('.sc-day [data-act="cal-home-off"]'); flush();
    click('.modal [data-act="home-rule-clear"]'); flush();
    const ce = evAt('2025-05-05');
    ok('어린이날 지정을 끄면 「정말 지울까요? KBO 원칙과 다릅니다」 → 취소면 그대로 · 지우기면 이벤트를 teams: [](대진 없음)로 남김', clrAsked && clrKept && !!ce && Array.isArray(ce.teams) && !ce.teams.length && !ce.stadiums.length && !ce.pairs && !S.ui.modal, 'clrAsked ' + clrAsked + ' · clrKept ' + clrKept);
    const pfr = app().preflight().items.find((x) => x.id === 'rule-homes');
    ok('지정 없음: 목록·오른쪽 「지정 없음」 · 3단계는 끝난 것으로 · 4 확인 줄 · 사전 점검 「확인 필요」(특별 경기 충돌은 아님)', /지정 없음/.test(q('.sc-homes .sc-hrow[data-d="' + dn('2025-05-05') + '"]').textContent) && /지정 없음/.test(q('.sc-day').textContent) && S.homeStateOf(st()).done === 2 && /5\/5 어린이날 지정 없음/.test(S.calHomeLine()) && !!pfr && pfr.status === 'warn' && app().preflight().items.find((x) => x.id === 'events').status === 'pass', pfr && pfr.detail);
    S.startRun(); flush();
    const runAsk = S.ui.modal === 'homeRule' && /지정 없이 시작할까요/.test(q('.modal').textContent) && !app().isRunning();
    click('.modal [data-act="home-rule-fix"]'); flush();
    ok('② 편성 시작 전에 한 번 더 묻기 → 「3단계에서 다시 지정」이면 시작하지 않고 그 날(5/5)로', runAsk && !S.ui.modal && !app().isRunning() && S.ui.step === 1 && C.day === dn('2025-05-05'));
    click('.sc-day [data-act="cal-home-on"]'); flush();
    click('.sc-day [data-act="cal-home-team"][data-team="두산"]'); flush();
    ok('지정 없음인 날을 켜고 구단을 고르면 다시 지정(같은 이벤트)', evAt('2025-05-05').id === ce.id && evAt('2025-05-05').teams.join() === '두산' && !S.homeCleared(evAt('2025-05-05')));
    undoN(2);
    ok('실행 취소 두 번이면 원래 5곳', evAt('2025-05-05').teams.length === 5 && (!app().store.undoStack || app().store.undoStack.length === clrN0));
    tap('2025-07-14');
    ok('묶음 없는 날(7/14 월)은 홈 구장 지정을 켤 수 없음(경기 없는 날 안내)', q('.sc-day .sc-tog').disabled && /경기가 없습니다/.test(q('.sc-day').textContent));
    click('.sc-homes .sc-hrow[data-d="' + dn('2025-05-05') + '"]'); flush();
    ok('홈 구장 지정 목록을 누르면 그 날(5/5) · 4 확인 줄 「3/22 개막전 5곳 · 5/5 어린이날 5곳」', C.day === dn('2025-05-05') && /3\/22 개막전 5곳 · 5\/5 어린이날 5곳/.test(S.calHomeLine()));
    // 11. 엑셀(ㄱ 날짜 행): 지금 데이터로 서식 내려받기 → 고쳐서 올리기 → 시트마다 검사 → 달력에 반영(실행 취소 한 번)
    if (S.calXlSheets) {
      const X = KBO.Xlsx;
      S.flowGo(4);
      click('.ck-card .sc-xl [data-act="cal-xl-down"]'); flush();
      const sheets0 = await X.read(S.lastXlBytes, null).catch(() => null);
      ok('엑셀: 서식 내려받기 → 시트 4개(구단 정보 · 시즌 기간과 공휴일 · 연전 기간 · 홈 구장 지정) · 연전 기간 45줄 · 요일·끝 날짜는 수식', !!sheets0 && sheets0.map((x) => x.name).join() === '구단 정보,시즌 기간과 공휴일,연전 기간,홈 구장 지정' && sheets0[2].rows.length === 46 && sheets0[2].rows[1][2] === '토' && X.serialToIso(sheets0[2].rows[1][4]) === '2025-03-23' && sheets0[3].rows.length === 3);
      let res = await S.calXlOpen(S.lastXlBytes, '서식.xlsx'); flush();
      ok('엑셀: 고치지 않고 올리면 오류 0 · 「지금과 같음」 · 확인 창', S.ui.modal === 'calxl' && res.errors === 0 && /지금과 같음/.test(res.sheets[0].notes[0]) && !q('.cx-modal [data-act="cal-xl-apply"]').disabled);
      const sh = S.calXlSheets(), bySh = (n) => sh.find((x) => x.name === n);
      bySh('연전 기간').rows = bySh('연전 기간').rows.filter((r) => !(r[1] && r[1].date === '2025-04-08'));
      bySh('시즌 기간과 공휴일').rows.forEach((r) => { if (r[1] && r[1].date === '2025-06-06') r[3] = 3; });
      bySh('홈 구장 지정').rows.forEach((r) => { if (r[1] === '어린이날') r[2] = 'LG'; });
      res = await S.calXlOpen(X.write(sh), '고친 서식.xlsx'); flush();
      click('.cx-modal [data-act="cal-xl-apply"]'); flush();
      const applied = !S.ui.modal && st().calendar.length === 44 && gd() === 132 && /04-08~04-10/.test(blk()) && st().settings.holidays.find((h) => h.date === '2025-06-06').weight === 3 && bAt('2025-06-06').holiday === 5 && evAt('2025-05-05').teams[0] === 'LG';
      undoN(1);
      ok('엑셀: 4/8 줄 지우기·현충일 가중치 3·어린이날 두산 → LG로 올리기 → 달력에 반영(44개 · 132일 · 6/6 묶음 값 5) → 실행 취소 한 번으로 복귀', res.errors === 0 && applied && st().calendar.length === 45 && gd() === 135 && evAt('2025-05-05').teams[0] === '두산');
      const sb = S.calXlSheets(), sl = sb.find((x) => x.name === '연전 기간'), hm = sb.find((x) => x.name === '홈 구장 지정');
      sl.rows[3][1] = '4월 첫째'; sl.rows[5][1] = { date: '2025-04-02' }; sl.rows[6][3] = 5;
      hm.rows[1][4] = '두산'; hm.rows[2].push('SSG'); hm.rows.push([{ date: '2025-06-06' }, '현충일', 'LGG']);
      res = await S.calXlOpen(X.write(sb), '틀린 서식.xlsx'); flush();
      const why = res.sheets.flatMap((x) => x.errors.map((e) => e.why)).join(' / ');
      ok('엑셀: 날짜 형식·겹침·연전 수·잠실 두 구단·6곳·모르는 구단 → 오류 6 · 「달력에 반영」 잠김 · 엑셀 줄 번호', res.errors === 6 && /날짜로 읽을 수 없습니다/.test(why) && /겹칩니다/.test(why) && /연전 수는 2~4/.test(why) && /두산·LG 중 하나만/.test(why) && /5곳입니다\(6곳/.test(why) && /'LGG' — 'LG'인가요/.test(why) && q('.cx-modal [data-act="cal-xl-apply"]').disabled && /엑셀 4번째 줄/.test(q('.cx-modal').textContent), why);
      const se = S.calXlSheets(); se.find((x) => x.name === '연전 기간').rows.length = 1;
      res = await S.calXlOpen(X.write(se), '규칙.xlsx'); flush();
      ok('엑셀: 연전 기간 줄을 모두 비우면 규칙대로(묶음 45개)', res.errors === 0 && res.next.list.length === 45 && /규칙대로 채웁니다/.test(res.sheets.find((x) => x.key === 'slots').notes.join()));
      S.ui.calxl = null; S.go({ modal: null });
      // 다른 해 서식(2025)을 2027에서 올리면 받지 않는다 — 2025 저장본도 그대로
      click('.ck-card .sc-xl [data-act="cal-xl-down"]'); flush();
      const b25 = S.lastXlBytes;
      S.autosave.dirty = true; S.autosave.flush();
      const rec25 = JSON.stringify(S.repo.load(2025).project.calendar), had27 = S.repo.has(2027);
      S.switchYear(2027, S.builtinOf(2027) ? { quiet: true, to: 'stay', project: S.newYearProject(2027) } : { quiet: true, to: 'stay' }); flush();
      res = await S.calXlOpen(b25, '2025 서식.xlsx'); flush();
      const refused = res.errors >= 1 && /2025 시즌 서식입니다/.test(res.sheets.find((x) => x.key === 'season').errors[0].why) && q('.cx-modal [data-act="cal-xl-apply"]').disabled;
      S.ui.calxl = null; S.go({ modal: null });
      S.switchYear(2025, { quiet: true, to: 'stay' }); flush();
      if (!had27) S.repo.remove(2027);
      ok('엑셀: 2027을 열고 2025 서식을 올리면 「이 파일은 2025 시즌 서식입니다」 · 반영 잠김 · 2025 저장본 그대로', refused && JSON.stringify(S.repo.load(2025).project.calendar) === rec25 && S.seasonYear() === 2025 && st().calendar.length === 45);
      S.flowGo(2);
    }
    // 화면 안 · 페이지 스크롤 0 (말풍선 열린 채로도)
    S.flowGo(2);
    tap('2025-07-17');
    const pop = q('#scPop').getBoundingClientRect(), body = q('#scCal').getBoundingClientRect();
    ok('말풍선은 달력 안 · 페이지 스크롤 0', pop.left >= body.left - 1 && pop.right <= body.right + 1 && pop.top >= body.top - 1 && pop.bottom <= body.bottom + 1 && S.checkScroll().ok);
    C.day = null; C.slotAt = null; flush();
  };
  /** 금지어 검사용 화면 목록(guide-steps.js의 screens가 앞에 붙인다) */
  S.calScreens = function () {
    const at = (n, fn) => () => { S.g1.mode = 'flow'; S.g1.fs = n; C.day = null; C.slotAt = null; C.relay = null; C.edit = null; if (fn) fn(); };
    return [
      { where: '2단계(예시)', patch: {}, fn: at(2) },
      { where: '2단계 — 묶음 말풍선 · 자동으로 채운 것 고치기', patch: {}, fn: at(2, () => { C.day = dn('2025-07-17'); C.slotAt = dn('2025-07-17'); C.edit = 'allstar'; }) },
      { where: '2단계 — 1차 편성 종료일 고치기 · 묶음에 반영할까요?', patch: {}, fn: at(2, () => { C.edit = 'initialEnd'; C.relay = { why: '올스타 휴식기 길이: 5일 — 직접 고친 묶음이 있어 묶음은 그대로 두었습니다.' }; }) },
      { where: '2단계 — 개막일 다시 고르기 · 다른 날', patch: {}, fn: at(2, () => { C.pickOpen = true; C.other = true; }) },
      { where: '3단계 — 5/5 고른 날', patch: {}, fn: at(3, () => { C.day = dn('2025-05-05'); C.holAll = true; }) },
      { where: '3단계 — 경기 없는 날', patch: {}, fn: at(3, () => { C.day = dn('2025-07-14'); C.holAll = false; }) },
      { where: '2단계 — 빈 상태', patch: {}, fn: at(2, () => { S.resetAll({ quiet: true, stay: true }); }) },
      { where: '3단계 — 빈 상태', patch: {}, fn: at(3) },
      { where: '4 확인 — 빈 상태', patch: {}, fn: at(4) },
      { where: '예시로 복귀', patch: {}, fn: at(2, () => { S.loadExample({ quiet: true, stay: true }); }) }
    ];
  };
})();
