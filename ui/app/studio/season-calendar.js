/*
 * 편성 스튜디오 — ① 데이터 준비: 시즌 달력 한 화면 (추천안 R · 입력은 모두 이 화면)
 * 왼쪽: 구단 정보(접힌 요약 · 펼쳐서 고치기) · 시즌 기간(시즌 연도·개막일·1차 편성 종료일·시즌 종료일·휴식 요일) · 연전 규칙(+ 규칙대로 채우기) · 공휴일(가중치)
 * 가운데: 3~8월 달력(월 행 × 31일). 날짜를 끌면 2·3·4연전 묶음, 묶음을 누르면 연전 수 바꾸기·둘로 나누기·지우기.
 * 오른쪽: 고른 날(홈 구장 지정) · 확인(경기일 합·홈 구장 지정·시리즈 규칙) · 엑셀 · 따라 하기 다시 보기.
 *
 * 연전 묶음이 곧 경기일: 묶음이 없는 날은 경기 없는 날(올스타 휴식기는 그 주 묶음을 지워서), 휴식 요일에 묶음을 그리면 그 날 경기.
 * 그래서 휴식기·휴식일 경기는 따로 적지 않고 묶음과 휴식 요일에서 만들어(CalendarGen.deriveRestDays) ②·엔진에 넘긴다.
 * 묶음을 고치는 조작은 모두 저장 한 번(실행 취소 한 단계)에 함께 고친다:
 *   연전 기간 · 시리즈 배정(같은 묶음이면 그대로, 바뀐 묶음의 시리즈는 일정 미정으로) · 특별 경기의 연전 기간 · 휴식기·휴식일 경기 · 주말·휴일 가중치.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, CalendarGen, Score } = KBO;
  const app = () => S.app;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  // day: 고른 날(일 번호) · slotAt: 고른 묶음의 시작일(일 번호, 묶음 번호는 그릴 때마다 찾는다) · drag: 끄는 중 · focus: 다른 화면에서 온 「입력 위치」
  const C = S.cal = { day: null, slotAt: null, drag: null, focus: null };

  // ───────── 바탕 값 ─────────
  const set = () => app().state.settings;
  const dn = Dates.dayNum;
  const dlabel = (n) => fmt.date(n);
  const half = () => app().state.teams.length >> 1;
  const hasDates = () => !!(set().seasonStart && set().initialEnd);
  /** 달력에 보이는 달: 개막 달(없으면 3월) ~ 1차 편성 종료 달(없으면 8월) */
  function months() {
    const s = set();
    const a = s.seasonStart ? Math.min(3, Dates.month(dn(s.seasonStart))) : 3;
    const b = s.initialEnd ? Math.max(a, Dates.month(dn(s.initialEnd))) : 8;
    return [a, b];
  }
  /** 묶음 목록(날짜 순): { i, d(시작 일 번호), len } */
  function bundles() { return app().state.calendar.map((c, i) => ({ i, d: dn(c.datetime), len: c.consecutive })); }
  function slotOfDay(d) { const s = app().derived().dayToSlot.get(d); return s == null ? -1 : s; }
  const restDay = (d) => set().restWeekdays.includes(Dates.weekday(d));
  const inRange = (d) => hasDates() && d >= dn(set().seasonStart) && d <= dn(set().initialEnd);
  const holidayOf = (d) => set().holidays.find((h) => dn(h.date) === d) || null;
  const weightOf = (h) => (h && h.weight != null ? Number(h.weight) : CalendarGen.HOLIDAY_WEIGHT);
  /** 시즌 연도 칸에서 고를 수 있는 해: 내장 공휴일 표(음력·대체공휴일)가 있는 해 */
  const YEARS = () => CalendarGen.HOLIDAY_YEARS.slice();

  // ───────── 저장: 묶음 고치기 · 설정 고치기 ─────────
  /** 묶음에서 휴식기·휴식일 경기를 만들고 주말·휴일 가중치를 다시 매긴다(commit 안에서 부른다). 묶음이 하나도 없으면 휴식기·휴식일 경기도 비운다 */
  S.recalcCalendar = function (s) {
    CalendarGen.applyWeights(s.calendar, s.settings);
    if (!s.calendar.length) { s.settings.restExceptions = []; s.settings.blackouts = []; return; }
    const d = CalendarGen.deriveRestDays(s.calendar, s.settings);
    s.settings.restExceptions = d.restExceptions;
    s.settings.blackouts = d.blackouts;
  };
  /**
   * 묶음 목록을 바꾸는 저장 한 번. fn(list)는 [{ d, len }]를 고친다(false를 돌려주면 그만둠).
   * 시리즈 배정은 같은 묶음(시작일·연전 수)이면 그대로, 없어진 묶음의 시리즈는 일정 미정(-1)으로 보낸다.
   */
  function calCommit(label, fn) {
    if (S.locked()) return false;
    const st = app().state;
    const list = st.calendar.map((c) => ({ d: dn(c.datetime), len: c.consecutive, note: c.note }));
    if (fn(list) === false) return false;
    list.sort((a, b) => a.d - b.d);
    const oldCal = st.calendar;
    const ok = app().commit(label, (s) => {
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
    if (ok && C.tour) C.tour.ops = (C.tour.ops || 0) + 1;
    return ok;
  }
  S.calCommit = calCommit;
  /** 시즌 기간·휴식 요일을 고치는 저장 한 번(휴식기·휴식일 경기도 다시 만든다) */
  S.updateSeason = function (patch, label) {
    if (S.locked()) return false;
    return app().commit(label || '시즌 기간 변경', (s) => { Object.assign(s.settings, patch); S.recalcCalendar(s); }, ['settings', 'calendar']);
  };

  // ───────── 묶음 조작 ─────────
  const bundleText = (d, len) => dlabel(d) + (len > 1 ? ' ~ ' + dlabel(d + len - 1) : '') + ' · ' + len + '연전';
  /**
   * 끈 범위 → 묶음 범위. 누른 날(a)은 늘 들어가고, 거기서 끈 쪽으로 이어 가다 휴식 요일·다른 묶음·시즌 밖을 만나면 끊는다.
   * 그래서 월요일을 누르고 끌면 월요일 경기가 들어간 묶음이 되고, 금요일에서 화요일까지 끌면 금·토·일 3연전이 된다.
   */
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
    if (!hasDates()) { S.toast('개막일과 1차 편성 종료일을 먼저 적어 주세요. 그 기간 안에서 묶음을 만듭니다.', 'warn', 5000); return false; }
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
    if (ok) { if (C.tour) C.tour.lenChanged = true; S.toast(bundleText(b.d, n) + '으로 바꿨습니다. 경기일 합 ' + S.gameDaysCheck().have + '일.', 'ok', 3500); }
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
  /** 「규칙대로 채우기」: 2025 공식 일정표로 확인한 관행(CalendarGen.ruleSettings)으로 묶음을 모두 다시 깐다 */
  function fillByRule() {
    if (!hasDates()) { S.toast('개막일과 1차 편성 종료일을 먼저 적어 주세요.', 'warn', 5000); C.focus = 'season'; S.render(); return false; }
    const gen = CalendarGen.generateSlots(CalendarGen.ruleSettings(set()));
    const ok = calCommit('규칙대로 채우기 (' + gen.slots.length + '개)', (list) => { list.length = 0; for (const x of gen.slots) list.push({ d: dn(x.datetime), len: x.consecutive }); });
    if (!ok) return false;
    C.slotAt = null;
    const gd = S.gameDaysCheck(), h = CalendarGen.lengthHistogram(app().state.calendar);
    const warn = gen.warnings.length ? ' ' + gen.warnings[0].message : '';
    S.toast('규칙대로 묶음 ' + gen.slots.length + '개를 깔았습니다(2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + '). 경기일 합 ' + gd.have + '일 / ' + gd.need + '일' + (gd.ok ? ' — 맞습니다.' : '.') + warn + ' 실행 취소로 되돌릴 수 있습니다.', gd.ok && !warn ? 'ok' : 'warn', 6500);
    return true;
  }
  S.calOps = { addBundle, setLen, splitBundle, removeBundle, fillByRule, dragRange };

  // ───────── 확인 ─────────
  /** 개막일이 토요일이 아니면 경고(개막은 늘 토요일 → 토·일 2연전) */
  function openingWarn() {
    const s = set();
    if (!s.seasonStart) return '';
    const w = Dates.weekday(dn(s.seasonStart));
    return w === 6 ? '' : '개막일 ' + dlabel(s.seasonStart) + '이 토요일이 아닙니다. 개막은 늘 토요일(토·일 2연전)입니다.';
  }
  /** 시리즈가 지금 묶음과 맞는가: 맞대결 경기 수와 연전 수(2·3·4)마다 「묶음 수 × 구장 수 = 시리즈 수」 */
  function seriesState() {
    const st = app().state, gd = S.gameDaysCheck();
    if (!st.matches.length) return { ok: false, kind: 'todo', text: gd.ok ? '「다음」 때 규칙대로 만듭니다' : '경기일 합을 맞추면 규칙대로 만듭니다' };
    const off = S.guidePairOff(), bal = S.guideBalance();
    if (!off && !bal.length) return { ok: true, kind: 'ok', text: '규칙대로 ' + st.matches.length + '개' };
    return { ok: false, kind: 'warn', text: gd.ok ? '묶음이 바뀌어 「다음」 때 규칙대로 다시 만듭니다' : '경기일 합을 맞추면 규칙대로 다시 만듭니다' };
  }
  S.calSeriesState = seriesState;
  const gdStat = (gd) => (gd.ok ? S.stat('ok', '맞음') : gd.have < gd.need ? S.stat('todo', (gd.need - gd.have) + '일 남음') : S.stat('warn', (gd.have - gd.need) + '일 많음'));
  S.calSummary = function () { const gd = S.gameDaysCheck(); return '시즌 달력 한 화면 · 경기일 ' + gd.have + ' / ' + gd.need; };

  // ───────── 그리기: 왼쪽 ─────────
  const box = (cls, head, body, attrs) => '<section class="sc-box' + (cls ? ' ' + cls : '') + '"' + (attrs || '') + '><h4>' + head + '</h4>' + body + '</section>';
  const line = (k, v) => '<div class="sc-line"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  function teamsBox() {
    const st = app().state, dm = st.distanceMatrix.filter((d) => d.from !== d.to);
    const road = Math.floor(dm.filter((d) => d.source === 'ROAD').length / 2), est = Math.floor(dm.filter((d) => d.estimated).length / 2);
    return box('sc-teams', '구단 정보 <span class="r">' + S.stat('ok', '확인') + '<button class="lnk" data-act="g1-teams">펼쳐서 고치기 ' + icon('down') + '</button></span>',
      '<div class="sc-sub">' + st.teams.length + '구단 · 구장 위치 · 구장 간 거리 ' + dm.length + '개' + (road ? '(도로 ' + road + '쌍)' : est ? '(추정 ' + est + '쌍)' : '') + '</div>');
  }
  function seasonBox() {
    const s = set(), y = S.seasonYear();
    const yearSel = '<select class="input sm sc-year" data-in="cal-year" aria-label="시즌 연도">' + YEARS().map((v) => '<option value="' + v + '"' + (v === y ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>';
    const dateIn = (k, label, ph) => line(label, '<input class="input sm sc-date' + (s[k] ? '' : ' empty') + '" data-in="season" data-k="' + k + '" value="' + esc(s[k] ? fmt.date(s[k]) : '') + '" placeholder="' + esc(ph) + '" aria-label="' + esc(label) + '">');
    const ow = openingWarn();
    return box('blue sc-season' + (C.focus === 'season' ? ' flash' : ''), '시즌 기간 <span class="r sc-role">적기</span>',
      line('시즌 연도', yearSel + '<span class="sc-hint-i">고르면 주말·공휴일이 달력에 표시됩니다</span>') +
      dateIn('seasonStart', '개막일', '예: 3/22(토)') + dateIn('initialEnd', '1차 편성 종료일', '예: 8/31') + dateIn('seasonEnd', '시즌 종료일', '예: 10/31') +
      line('휴식 요일', '<span class="wd sc-wd">' + WD.map((n, i) => '<button class="' + (s.restWeekdays.includes(i) ? 'on' : '') + '" data-act="rest-wd" data-wd="' + i + '" aria-pressed="' + s.restWeekdays.includes(i) + '" title="' + n + '요일">' + n + '</button>').join('') + '</span>') +
      (ow ? '<div class="sc-warn">' + icon('warn') + '<span>' + esc(ow) + '</span></div>' : '') +
      '<div class="sc-note">1차 편성 ' + s.initialGamesPerPair + '경기 × ' + (app().state.teams.length - 1) + '상대 = <b>경기일 ' + S.gameDaysCheck().need + '일</b>이 필요합니다. 그 뒤(' + (s.initialEnd ? fmt.short(dn(s.initialEnd) + 1) : '1차 편성 종료일 다음 날') + '~' + (s.seasonEnd ? fmt.short(s.seasonEnd) : '시즌 종료일') + ')는 미편성 경기와 우천 취소분을 넣는 재편성 기간입니다. 날짜는 3/22처럼 적고 Enter를 누릅니다.</div>');
  }
  function rulesBox() {
    const s = set();
    const as = s.allStarStart || (s.seasonStart ? CalendarGen.defaultAllStarStart(S.seasonYear()) : '');
    const asWarn = as && Dates.weekday(dn(as)) !== 5;
    return box('sc-rules', '연전 규칙 <span class="r">' + S.stat('ok', '2025 공식 일정표로 확인') + '</span>',
      line('기본', '화·수·목 <b>3연전</b> / 금·토·일 <b>3연전</b> · 월요일 휴식') +
      line('개막', '늘 토요일 → 토·일 <b>2연전</b>, 월 휴식') +
      line('월요일 공휴일', '그 날 경기, 목요일 휴식(어린이날 월·화·수)') +
      line('올스타 휴식기', '금~수 6일 · 뒤 목~일 <b>4연전</b>') +
      line('올스타 시작', '<input class="input sm sc-date" data-in="cal-allstar" value="' + esc(as ? fmt.date(as) : '') + '" placeholder="예: 7/11(금)" aria-label="올스타 휴식기 시작 금요일">' + (as ? '<span class="sc-hint-i">~' + fmt.date(dn(as) + 5) + '</span>' : '')) +
      (asWarn ? '<div class="sc-warn">' + icon('warn') + '<span>올스타 휴식기는 금요일에 시작합니다.</span></div>' : '') +
      '<button class="btn primary sc-fill" data-act="cal-fill"' + (hasDates() ? '' : ' disabled title="개막일과 1차 편성 종료일을 먼저 적어 주세요"') + '>' + icon('bolt') + '규칙대로 채우기</button>' +
      '<div class="sc-note">채운 뒤 달력에서 끌어서 고칩니다. 묶음이 없는 날이 경기 없는 날입니다.</div>');
  }
  function holidaysBox() {
    const s = set(), [m0, m1] = months(), y = S.seasonYear();
    const a = s.seasonStart || (y + '-' + String(m0).padStart(2, '0') + '-01');
    const b = s.seasonEnd || s.initialEnd || (y + '-10-31');
    const rows = s.holidays.map((h, i) => ({ h, i })).filter(({ h }) => h.date >= a.slice(0, 8) + '01' && h.date <= b);
    const others = s.holidays.length - rows.length;
    const tr = ({ h, i }) => '<tr data-hol="' + i + '"' + (C.day != null && dn(h.date) === C.day ? ' class="sel"' : '') + '><td><input class="input xs mono sc-hd" data-in="cal-hol" data-row="' + i + '" data-k="date" value="' + esc(fmt.date(h.date)) + '" aria-label="공휴일 날짜"></td>' +
      '<td><input class="input xs sc-hn" data-in="cal-hol" data-row="' + i + '" data-k="name" value="' + esc(h.name) + '" aria-label="공휴일 이름"></td>' +
      '<td class="num"><input class="input xs num sc-hw" data-in="cal-hol" data-row="' + i + '" data-k="weight" value="' + esc(String(weightOf(h))) + '" inputmode="decimal" aria-label="' + esc('가중치: ' + h.name) + '"></td>' +
      '<td><button class="btn xs icon ghost" data-act="cal-hol-del" data-row="' + i + '" title="이 줄 지우기" aria-label="' + esc(h.name + ' 지우기') + '">' + icon('x') + '</button></td></tr>';
    return box('blue sc-hols' + (C.focus === 'holidays' ? ' flash' : ''), '공휴일 <span class="r"><button class="btn xs" data-act="fill-holidays">' + icon('bolt') + '법정 공휴일 채우기</button></span>',
      (rows.length ? '<table class="sc-htable"><colgroup><col style="width:92px"><col><col style="width:54px"><col style="width:26px"></colgroup><thead><tr><th>날짜</th><th>이름</th><th class="num">가중치</th><th></th></tr></thead><tbody>' + rows.map(tr).join('') + '</tbody></table>'
        : '<div class="sc-note">아직 없습니다. 「법정 공휴일 채우기」로 ' + y + '년 법정 공휴일·대체공휴일을 넣고, 임시 공휴일만 「줄 추가」로 더합니다.</div>') +
      (others ? '<div class="sc-note">시즌 밖 공휴일 ' + others + '일은 모든 표 보기에서 봅니다.</div>' : '') +
      '<div class="sc-hfoot"><button class="btn xs" data-act="cal-hol-add">' + icon('plus') + '줄 추가</button><span>가중치 = 홈 경기 공정성에서 이 날의 가치(주말 하루 1)</span></div>' +
      '<div class="sc-kbo">' + S.stat('warn', '기본값(공휴일 2 · 어린이날 3)은 KBO 확인 필요') + '</div>');
  }

  // ───────── 그리기: 가운데 달력 ─────────
  function calendarStrip() {
    const st = app().state, s = st.settings, y = S.seasonYear(), [m0, m1] = months();
    const hol = new Map(s.holidays.map((h) => [dn(h.date), h]));
    const bs = bundles(), byDay = new Map();
    bs.forEach((b) => { for (let k = 0; k < b.len; k++) byDay.set(b.d + k, { b, k }); });
    const evDays = new Map(st.events.map((e) => [dn(e.date), e]));
    const a = s.seasonStart ? dn(s.seasonStart) : null, e1 = s.initialEnd ? dn(s.initialEnd) : null, e2 = s.seasonEnd ? dn(s.seasonEnd) : null;
    const selSlot = C.slotAt != null ? bs.find((b) => b.d === C.slotAt) : null;
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
        else cls.push('off');
        if (ev) { cls.push('ev'); tt.push(ev.name + ' 홈 구장 지정'); }
        if (C.day === n) cls.push('pick');
        const lab = x && x.k === 0 ? '<i class="sl">' + x.b.len + '연전</i>' : '';
        h += '<span class="' + cls.join(' ') + '" role="gridcell" data-d="' + n + '"' + (x ? ' data-slot="' + x.b.i + '"' : '') + ' title="' + esc(tt.join(' · ')) + '">' + d + lab + '</span>';
      }
      h += '</div></div>';
    }
    return h + '</div>';
  }
  function popover() {
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
    const st = app().state, y = S.seasonYear(), gd = S.gameDaysCheck(), h = CalendarGen.lengthHistogram(st.calendar), [m0, m1] = months();
    const legend = [['game', '경기일'], ['ss', '묶음 시작'], ['rest', '경기 없음'], ['hol', '공휴일(빨강)'], ['sat', '토요일(파랑)'], ['ev', '홈 구장 지정'], ['sel', '고른 묶음']];
    return '<section class="sc-main' + (C.focus === 'slots' ? ' flash' : '') + '" aria-label="시즌 달력">' +
      '<div class="sc-head"><b>' + y + ' 시즌 달력</b><span class="muted">' + m0 + '월~' + m1 + '월 · 1차 편성 기간</span>' +
      '<span class="sc-count ' + (gd.ok ? 'ok' : gd.have > gd.need ? 'warn' : '') + '" id="scCount"><b>경기일 ' + gd.have + ' / ' + gd.need + '일</b>' + gdStat(gd) + '</span>' +
      '<span class="sc-hist">' + (st.calendar.length ? '2연전 ' + (h[2] || 0) + ' · 3연전 ' + (h[3] || 0) + ' · 4연전 ' + (h[4] || 0) + ' · 묶음 ' + st.calendar.length + '개' : hasDates() ? '아직 묶음이 없습니다 — 「규칙대로 채우기」나 끌어서 만듭니다' : '개막일·1차 편성 종료일을 적으면 묶음을 만들 수 있습니다') + '</span>' +
      '<span class="sc-undo">' + S.undoButtons() + '</span></div>' +
      '<div class="sc-calbody" id="scCal" data-sk="sc-cal">' +
        '<div class="sc-legend">' + legend.map(([c, t]) => '<span><i class="' + c + '"></i>' + t + '</span>').join('') + '</div>' +
        calendarStrip() +
        '<div class="sc-tips"><span>' + icon('move') + '날짜를 <b>끌면</b> 연전 묶음(2·3·4연전)</span><span>' + icon('grid') + '묶음을 <b>누르면</b> 연전 수 바꾸기 · 지우기</span><span>' + icon('target') + '날을 <b>누르면</b> 홈 구장 지정</span><span id="scDragHint" class="sc-drag-hint"></span></div>' +
        popover() +
      '</div></section>';
  }

  // ───────── 그리기: 오른쪽 ─────────
  function dayBox() {
    if (C.day == null) return box('sc-day', '고른 날', '<div class="sc-note">달력에서 날을 누르면 여기서 그 날 홈 구장을 지정합니다(개막전·어린이날). 공휴일은 왼쪽 표에서 적습니다.</div>');
    const d = C.day, hh = holidayOf(d), si = slotOfDay(d), b = si >= 0 ? bundles()[si] : null;
    return box('blue sc-day', '고른 날 · ' + esc(dlabel(d)) + (hh ? ' <span class="r sc-hint-i">' + esc(hh.name) + '</span>' : ''),
      line('연전', b ? esc(bundleText(b.d, b.len)) : '<span class="muted">' + (inRange(d) ? '경기 없는 날(묶음 없음)' : '1차 편성 기간 밖') + '</span>') +
      line('공휴일', hh ? esc(hh.name) + ' · 가중치 ' + weightOf(hh) + ' <span class="muted">(왼쪽 표)</span>' : '<span class="muted">아님</span>') +
      (S.calHomeBox ? S.calHomeBox(d, b) : ''));
  }
  function checkBox() {
    const gd = S.gameDaysCheck(), sr = seriesState(), s = set();
    const home = S.calHomeLine ? S.calHomeLine() : null;
    const allOk = gd.ok && (!home || home.ok);
    return box((allOk && sr.ok ? 'ok ' : '') + 'sc-check' + (C.focus === 'series' ? ' flash' : ''), '확인',
      line('경기일 합', gd.have + ' / ' + gd.need + ' ' + gdStat(gd)) +
      (home ? line('홈 구장 지정', home.html) : '') +
      line('시리즈', esc(sr.text) + ' ' + S.stat(sr.kind, sr.ok ? '맞음' : sr.kind === 'todo' ? '아직' : '다시 만듦')) +
      '<div class="sc-note">맞대결 ' + s.gamesPerPair + '경기 = 1차 편성 ' + s.initialGamesPerPair + '(홈 ' + s.homeGamesMajor + '·원정 ' + (s.initialGamesPerPair - s.homeGamesMajor) + ') + 미편성 ' + (s.gamesPerPair - s.initialGamesPerPair) + '(홈 정해 둠, 재편성에서). 날짜는 ② 자동 편성이 정합니다. <button class="lnk" data-act="g1-all" data-tab="series">시리즈 표 보기</button></div>');
  }
  function excelBox() {
    return box('sc-xl', '엑셀로 한꺼번에', '<div class="sc-xl-acts"><button class="btn sm" data-act="cal-xl-down">' + icon('download') + '지금 데이터로 서식 내려받기</button><button class="btn sm" data-act="cal-xl-up">' + icon('upload') + '채운 파일 올리기</button></div>' +
      '<div class="sc-note">시트 4개: 구단 정보 · 시즌 기간과 공휴일 · 연전 기간 · 홈 구장 지정</div>');
  }

  /** step-data.js의 R.calendar — ① 시즌 달력 한 화면 */
  S.renderSeasonCalendar = function () {
    S.ui.tab = 'season';
    const locked = S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED');
    if (C.slotAt != null && !bundles().some((b) => b.d === C.slotAt)) C.slotAt = null;
    const html = '<div class="stepview no-band sc' + (locked ? ' locked' : '') + '" data-mode="cal">' +
      '<aside class="sc-left" aria-label="시즌 기본 입력" data-sk="sc-left">' + teamsBox() + seasonBox() + rulesBox() + holidaysBox() + '</aside>' +
      mainPane() +
      '<aside class="sc-right" aria-label="고른 날과 확인" data-sk="sc-right">' + (locked ? '<div class="lockbar">' + icon('lock') + '자동 편성 중에는 입력이 잠깁니다.</div>' : '') + dayBox() + checkBox() + excelBox() +
        '<div class="sc-foot-links"><button class="btn sm ghost" data-act="cal-tour">' + icon('play') + '따라 하기 다시 보기</button><button class="btn sm ghost" data-act="g1-all" title="가져오기·표 목록·자세히가 모두 보이는 화면(전문가용)">' + icon('table') + '모든 표 보기</button></div></aside>' +
      '</div>';
    S.afterRender(placePopover);
    if (C.focus) { const f = C.focus; setTimeout(() => { if (C.focus === f) C.focus = null; }, 1600); }
    return html;
  };
  /** 묶음 말풍선을 고른 묶음 아래(넘치면 위)에 붙인다 */
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
  S.calFooter = function () {
    const gd = S.gameDaysCheck();
    return '<button class="btn" data-act="g1-all" title="가져오기·표 목록·자세히가 모두 보이는 화면(전문가용)">' + icon('table') + '모든 표 보기</button>' +
      '<span class="hint"><b>① 데이터 준비 · 시즌 달력 한 화면</b> — 날짜를 끌어 연전 묶음, 날을 눌러 홈 구장 지정. 경기일 ' + gd.have + ' / ' + gd.need + '일</span>' +
      '<span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' +
      '<button class="btn primary" data-act="cal-next">다음: 검토·실행' + icon('right') + '</button>';
  };

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
  function pickDay(d, opts) {
    const si = slotOfDay(d);
    C.day = d;
    C.slotAt = si >= 0 ? bundles()[si].d : null;
    if (opts && opts.home) C.homeOpen = d;
    if (C.tour) C.tour.picked = d;
    S.render();
  }
  S.calPick = pickDay;
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const el = cellOf(e.target);
    if (!el || S.ui.step !== 1) return;
    e.preventDefault();
    if (S.locked()) return;
    C.drag = { a: +el.dataset.d, b: +el.dataset.d, moved: false, onSlot: el.hasAttribute('data-slot') };
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
    if (!g.moved || g.onSlot) { pickDay(g.a); return; } // 누르기(묶음 위에서 끈 것도 누르기로 본다)
    if (!addBundle(g.a, g.b)) S.render();
  });
  document.addEventListener('contextmenu', (e) => {
    const el = cellOf(e.target);
    if (!el) return;
    e.preventDefault();
    pickDay(+el.dataset.d, { home: true });
  });
  S.calOnKey = function (e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
    if (e.key === 'Escape' && (C.slotAt != null || C.day != null)) { e.preventDefault(); if (C.slotAt != null) C.slotAt = null; else C.day = null; S.render(); return true; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && C.slotAt != null) { const b = bundles().find((x) => x.d === C.slotAt); if (b) { e.preventDefault(); removeBundle(b.i); return true; } }
    return false;
  };
  S.calOnReset = function () { C.day = null; C.slotAt = null; };
  /** 사전 점검 「입력 위치로」 등: 그 부분을 잠깐 강조한다 */
  S.calFocus = function (tab) {
    const st = app().state;
    const map = { season: 'season', holidays: 'holidays', slots: 'slots', series: 'series', events: 'events', restex: 'slots', blackouts: 'slots' };
    C.focus = map[tab] || 'slots';
    if (C.focus === 'events') { const e = st.events.find((x) => x.mode === 'STADIUM') || st.events[0]; if (e) { C.day = dn(e.date); const si = slotOfDay(C.day); C.slotAt = si >= 0 ? bundles()[si].d : null; } }
  };
  /** 주소: day=YYYY-MM-DD(고른 날), slot=YYYY-MM-DD(고른 묶음 시작일) */
  S.calRoute = function (o) {
    C.day = o.day && Number.isFinite(dn(o.day)) ? dn(o.day) : null;
    C.slotAt = o.slot && Number.isFinite(dn(o.slot)) ? dn(o.slot) : null;
  };
  S.calHash = function (o) {
    if (C.day != null) o.day = Dates.isoDate(C.day);
    if (C.slotAt != null) o.slot = Dates.isoDate(C.slotAt);
  };

  // ───────── 홈 구장 지정 (날짜 메뉴는 이것 하나) ─────────
  // 그 날 홈 경기를 해야 하는 구단을 고른다(구장 지정, events의 STADIUM). 개막전도 대진이 아니라 홈 구장만 — 상대는 자동 편성이 정한다.
  // teams = 고른 구단(잠실은 두산·LG 중 하나), stadiums = 채점에 쓰는 구장. 어린이날은 서버 자동 편성의 어린이날 홈 구단(obligationTeams)도 같이 맞춘다.
  const homeEv = (d) => app().state.events.find((e) => e.mode === 'STADIUM' && dn(e.date) === d) || null;
  const matchEvs = (d) => app().state.events.filter((e) => e.mode === 'MATCH' && dn(e.date) === d);
  /** 구장 지정의 구단: teams가 있으면 그대로, 없으면(예전 데이터) 구장의 연고 구단 — 같이 쓰는 구장은 어린이날 홈 구단 설정에서 고른다 */
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
  /** 고른 날의 홈 구장 구단 하나를 넣거나 뺀다(저장 한 번) */
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
    const order = st.teams.map((x) => x.name);
    next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const stadiums = next.map((n) => st.teams.find((x) => x.name === n).stadium);
    const kind = e ? { type: e.type, name: e.name } : evKind(d);
    const label = fmt.short(d) + ' ' + kind.name + ' 홈 구장 ' + (cur.includes(name) ? '빼기: ' : '넣기: ') + name;
    const ok = app().commit(label, (s) => {
      let ev = s.events.find((x) => x.mode === 'STADIUM' && dn(x.date) === d);
      if (!next.length) {
        if (ev) { s.events = s.events.filter((x) => x !== ev); for (const m of s.matches) if (m.eventId === ev.id) { delete m.eventId; m.pinned = false; } }
        return;
      }
      if (!ev) { ev = { id: 'ev-' + kind.type.toLowerCase() + '-' + Date.now().toString(36), type: kind.type, name: kind.name, date: Dates.isoDate(d), mode: 'STADIUM' }; s.events.push(ev); s.events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); }
      ev.teams = next; ev.stadiums = stadiums; ev.slot = Score.resolveEventSlot(ev, s.calendar);
      for (const m of s.matches) if (m.eventId === ev.id && !next.includes(m.home)) { delete m.eventId; m.pinned = false; }
      if (ev.type === 'CHILDREN' && next.length === (s.teams.length >> 1)) s.settings.obligationTeams = next.slice();
    }, ['events', 'pins', 'settings']);
    if (ok && C.tour) C.tour.homePicked = true;
    return ok;
  }
  function removeHome(d) {
    const e = homeEv(d);
    if (!e || S.locked()) return false;
    return app().commit(fmt.short(d) + ' ' + e.name + ' 홈 구장 지정 지우기', (s) => {
      s.events = s.events.filter((x) => x.id !== e.id);
      for (const m of s.matches) if (m.eventId === e.id) { delete m.eventId; m.pinned = false; }
    }, ['events', 'pins']);
  }
  /** 예전 방식(대진 지정)으로 들어온 그 날 경기를 홈 구장 지정으로 바꾼다: 홈 구단만 남긴다 */
  function convertMatch(d) {
    const ms = matchEvs(d);
    if (!ms.length || S.locked()) return false;
    const st = app().state, homes = ms.map((e) => e.home).filter((n, i, a) => st.teams.some((t) => t.name === n) && a.indexOf(n) === i).slice(0, half());
    const kind = evKind(d);
    return app().commit(fmt.short(d) + ' 대진 지정 ' + ms.length + '경기 → 홈 구장 지정', (s) => {
      const ids = new Set(ms.map((e) => e.id));
      const keep = s.events.find((x) => x.mode === 'STADIUM' && dn(x.date) === d);
      s.events = s.events.filter((x) => !ids.has(x.id));
      for (const m of s.matches) if (ids.has(m.eventId)) { delete m.eventId; m.pinned = false; }
      const ev = keep || { id: 'ev-' + kind.type.toLowerCase() + '-' + Date.now().toString(36), type: kind.type === 'CUSTOM' ? (ms[0].type || 'CUSTOM') : kind.type, name: kind.type === 'CUSTOM' ? ms[0].name : kind.name, date: Dates.isoDate(d), mode: 'STADIUM' };
      ev.teams = homes; ev.stadiums = homes.map((n) => s.teams.find((t) => t.name === n).stadium); ev.slot = Score.resolveEventSlot(ev, s.calendar);
      if (!keep) s.events.push(ev);
    }, ['events', 'pins']);
  }
  S.calHome = { toggleHome, removeHome, convertMatch };
  /** 오른쪽 「고른 날」 안: 홈 구장 지정 */
  S.calHomeBox = function (d, b) {
    const st = app().state, e = homeEv(d), picked = e ? S.evTeams(e) : [], ms = matchEvs(d);
    const on = !!e || C.homeOpen === d;
    const head = '<div class="sc-home-head"><button class="sc-tog' + (on ? ' on' : '') + '" data-act="' + (e ? 'cal-home-off' : 'cal-home-on') + '" role="switch" aria-checked="' + on + '"' + (b ? '' : ' disabled') + '><i></i><b>홈 구장 지정</b></button>' + (e ? '<span class="sc-home-n">' + picked.length + ' / ' + half() + '곳</span>' : '') + '</div>';
    if (!b) return head + '<div class="sc-note">이 날은 묶음이 없어 경기가 없습니다. 먼저 달력에서 끌어서 묶음을 만들면 홈 구장을 지정할 수 있습니다.</div>';
    let s = head + '<div class="sc-note">이 날 홈 경기를 해야 하는 구단 ' + half() + '곳을 고릅니다. 상대는 자동 편성이 정합니다.</div>';
    if (on) {
      s += '<div class="sc-home-teams" role="group" aria-label="홈 경기 구단">' + st.teams.map((t) => {
        const sel = picked.includes(t.name);
        const clash = !sel && picked.some((x) => x !== t.name && (st.teams.find((y) => y.name === x) || {}).stadium === t.stadium);
        return '<button class="gs-tbtn' + (sel ? ' on' : '') + (clash ? ' dim' : '') + '" data-act="cal-home-team" data-team="' + esc(t.name) + '" aria-pressed="' + sel + '" style="--tc:' + esc(t.color || '#555') + '" title="' + esc(t.stadium + (clash ? ' — 같은 구장 구단을 이미 골랐습니다' : '')) + '"><i></i>' + esc(t.name) + '</button>';
      }).join('') + '</div>';
      const shared = app().sharedStadiums();
      if (shared.size) s += '<div class="sc-note">' + Array.from(shared).map(([x, n]) => esc(x.replace(/종합운동장$/, '')) + '은 ' + esc(n.join('·')) + ' 중 하나만 고릅니다').join(' · ') + '.</div>';
      if (e && picked.length < half()) s += '<div class="sc-warn">' + icon('info') + '<span>' + (half() - picked.length) + '곳 더 고를 수 있습니다' + (e.type === 'CHILDREN' ? ' — 어린이날은 ' + half() + '곳을 모두 골라야 서버 자동 편성도 같은 구단으로 지킵니다' : '') + '.</span></div>';
    }
    if (ms.length) s += '<div class="sc-warn">' + icon('warn') + '<span>예전 방식 「대진 지정」 ' + ms.length + '경기가 이 날에 있습니다(' + esc(ms.map((x) => x.away + '–' + x.home).slice(0, 3).join(', ')) + (ms.length > 3 ? ' …' : '') + '). <button class="lnk" data-act="cal-ev-convert">홈 구장 지정으로 바꾸기</button></span></div>';
    return s;
  };
  /** 오른쪽 「확인」의 홈 구장 지정 줄 */
  S.calHomeLine = function () {
    const st = app().state, evs = st.events.filter((e) => e.mode === 'STADIUM').slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const iss = app().checkEvents().filter((x) => x.level === 'block' || x.level === 'warn');
    if (!evs.length) return { ok: true, html: S.stat('todo', '아직 없음') };
    const txt = evs.map((e) => fmt.short(e.date) + ' ' + e.name + ' ' + S.evTeams(e).length + '곳').join(' · ');
    return { ok: !iss.length, html: '<span class="sc-home-sum">' + esc(txt) + '</span>' + (iss.length ? S.stat('warn', '확인 ' + iss.length) : '') };
  };
  /** 「다음」 전에: 개막전 같은 홈 구장 지정은 그 날 홈 시리즈를 고정한다(서버 자동 편성은 어린이날 홈 구단만 안다) */
  S.calBeforeNext = function () {
    const st = app().state;
    if (st.events.some((e) => e.mode === 'MATCH' || (e.mode === 'STADIUM' && e.type !== 'CHILDREN' && (e.teams || []).length))) app().applyEvents({ silent: true, label: '홈 구장 지정 시리즈 고정' });
  };

  // ───────── 동작 ─────────
  Object.assign(S.actions, {
    'cal-home-team': (el) => { if (C.day != null) toggleHome(C.day, el.dataset.team); },
    'cal-home-on': () => { if (C.day != null) { C.homeOpen = C.day; S.render(); } },
    'cal-home-off': () => { if (C.day != null) { C.homeOpen = null; removeHome(C.day); } },
    'cal-ev-convert': () => { if (C.day != null) convertMatch(C.day); },
    'cal-fill': () => fillByRule(),
    'cal-len': (el) => setLen(+el.dataset.i, +el.dataset.n),
    'cal-split': (el) => splitBundle(+el.dataset.i),
    'cal-del': (el) => removeBundle(+el.dataset.i),
    'cal-pop-close': () => { C.slotAt = null; S.render(); },
    'cal-hol-add': () => {
      if (S.locked()) return;
      const s = set(), y = S.seasonYear();
      const base = s.seasonStart ? dn(s.seasonStart) : dn(y + '-03-01');
      const have = new Set(s.holidays.map((h) => h.date));
      let d = base; while (have.has(Dates.isoDate(d))) d++;
      app().commit('공휴일 줄 추가', (x) => { x.settings.holidays.push({ date: Dates.isoDate(d), name: '임시 공휴일', weight: CalendarGen.HOLIDAY_WEIGHT }); x.settings.holidays.sort((p, q) => (p.date < q.date ? -1 : 1)); S.recalcCalendar(x); }, ['settings', 'calendar']);
      S.toast(fmt.date(d) + ' 「임시 공휴일」 줄을 넣었습니다. 날짜·이름·가중치를 고치세요.', 'info', 4000);
    },
    'cal-hol-del': (el) => {
      if (S.locked()) return;
      const i = +el.dataset.row, h = set().holidays[i];
      if (!h) return;
      app().commit('공휴일 지우기: ' + fmt.date(h.date) + ' ' + h.name, (x) => { x.settings.holidays.splice(i, 1); S.recalcCalendar(x); }, ['settings', 'calendar']);
    },
    'cal-next': () => { if (S.calNext) S.calNext(); else S.go({ step: 2, ops: null, sel: null, edit: null }); }
  });
  /** 「다음: 검토·실행」: 묶음이 바뀌어 시리즈가 맞지 않으면(경기일 합이 맞을 때) 규칙대로 다시 만들고 ②로 간다 */
  S.calNext = function () {
    const sr = seriesState();
    if (!sr.ok && S.gameDaysCheck().ok && !S.locked()) {
      const g = app().generateSeriesPreview();
      if (!g.errors.length && app().regenerateSeries()) S.toast('묶음에 맞춰 시리즈 ' + app().state.matches.length + '개를 규칙대로 다시 만들었습니다(맞대결 ' + set().initialGamesPerPair + '경기). 실행 취소로 되돌릴 수 있습니다.', 'ok', 6000);
      else if (g.errors.length) S.toast(g.errors[0], 'warn', 7000);
    }
    if (S.calBeforeNext) S.calBeforeNext();
    S.go({ step: 2, ops: null, sel: null, edit: null });
  };
  S.inputs.season = (el) => {
    if (S.locked()) return;
    const v = S.parse.date(el.value);
    if (!v) { el.classList.add('err'); S.toast("날짜로 읽을 수 없습니다: '" + el.value + "' — 3/22나 2025-03-22처럼 적습니다.", 'bad'); return; }
    if (v === set()[el.dataset.k]) return;
    S.updateSeason({ [el.dataset.k]: v }, '시즌 기간: ' + ({ seasonStart: '개막일', initialEnd: '1차 편성 종료일', seasonEnd: '시즌 종료일' }[el.dataset.k] || el.dataset.k) + ' ' + fmt.date(v));
    if (el.dataset.k === 'seasonStart' && Dates.weekday(dn(v)) !== 6) S.toast('개막일 ' + fmt.date(v) + '이 토요일이 아닙니다. 개막은 늘 토요일(토·일 2연전)입니다.', 'warn', 5000);
  };
  S.inputs['cal-allstar'] = (el) => {
    if (S.locked()) return;
    const v = S.parse.date(el.value);
    if (!v) { el.classList.add('err'); S.toast("날짜로 읽을 수 없습니다: '" + el.value + "'", 'bad'); return; }
    if (v === set().allStarStart) return;
    app().updateSettings({ allStarStart: v }, '올스타 휴식기 시작: ' + fmt.date(v));
    S.toast('올스타 휴식기를 ' + fmt.date(v) + '~' + fmt.date(dn(v) + 5) + '로 정했습니다. 「규칙대로 채우기」를 누르면 묶음에 반영됩니다.', Dates.weekday(dn(v)) === 5 ? 'info' : 'warn', 5000);
  };
  S.inputs['cal-hol'] = (el) => {
    if (S.locked()) return;
    const i = +el.dataset.row, k = el.dataset.k, h = set().holidays[i];
    if (!h) return;
    let v = el.value.trim();
    if (k === 'date') { v = S.parse.date(v); if (!v) { el.classList.add('err'); S.toast("날짜로 읽을 수 없습니다: '" + el.value + "'", 'bad'); return; } if (set().holidays.some((x, j) => j !== i && x.date === v)) { el.classList.add('err'); S.toast(fmt.date(v) + '은(는) 이미 표에 있습니다.', 'bad'); return; } }
    if (k === 'name' && !v) { el.classList.add('err'); S.toast('이름이 비었습니다.', 'bad'); return; }
    if (k === 'weight') { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 10) { el.classList.add('err'); S.toast('가중치는 0~10 숫자입니다(주말 하루 = 1).', 'bad'); return; } v = Math.round(n * 10) / 10; }
    if (String(h[k] == null ? (k === 'weight' ? CalendarGen.HOLIDAY_WEIGHT : '') : h[k]) === String(v)) return;
    app().commit('공휴일 ' + fmt.date(h.date) + ' ' + ({ date: '날짜', name: '이름', weight: '가중치' }[k]) + ': ' + (h[k] == null ? '' : h[k]) + ' → ' + v, (x) => { x.settings.holidays[i][k] = v; x.settings.holidays.sort((p, q) => (p.date < q.date ? -1 : 1)); S.recalcCalendar(x); }, ['settings', 'calendar']);
  };
  /** 금지어 검사용 화면 목록(guide-steps.js의 screens가 앞에 붙인다) */
  S.calScreens = function () {
    const cal = (fn) => () => { S.g1.mode = 'cal'; S.g1.open = null; C.day = null; C.slotAt = null; if (fn) fn(); };
    return [
      { where: '시즌 달력(예시)', patch: {}, fn: cal() },
      { where: '시즌 달력 — 고른 날 5/5 · 묶음 말풍선', patch: {}, fn: cal(() => { C.day = dn('2025-05-05'); C.slotAt = dn('2025-05-05'); }) },
      { where: '시즌 달력 — 4연전 말풍선', patch: {}, fn: cal(() => { C.day = dn('2025-07-17'); C.slotAt = dn('2025-07-17'); }) },
      { where: '시즌 달력 — 경기 없는 날', patch: {}, fn: cal(() => { C.day = dn('2025-07-14'); }) },
      { where: '시즌 달력 — 빈 상태', patch: {}, fn: cal(() => { S.resetAll({ quiet: true, stay: true }); }) },
      { where: '시즌 달력 — 2027 빈 상태', patch: {}, fn: cal(() => { const el = { value: '2027' }; S.inputs['cal-year'](el); }) },
      { where: '시즌 달력 — 예시로 복귀', patch: {}, fn: cal(() => { S.loadExample({ quiet: true, stay: true }); }) }
    ];
  };

  // ───────── 자가 점검 (?selftest=1, guide-steps.js의 S.guideUI.selftest가 부른다) ─────────
  S.calSelftest = async function ({ ok, click, flush }) {
    const st = () => app().state, q = (sel) => document.querySelector(sel), qa = (sel) => document.querySelectorAll(sel);
    const cell = (iso) => q('.sc-strip .sd[data-d="' + dn(iso) + '"]');
    const mouse = (iso, type) => { const el = cell(iso); if (!el) throw new Error('달력에 없음: ' + iso); el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 })); };
    const drag = (a, b, via) => { mouse(a, 'mousedown'); for (const v of via || []) mouse(v, 'mouseover'); mouse(b, 'mouseover'); mouse(b, 'mouseup'); flush(); };
    const tap = (iso) => { mouse(iso, 'mousedown'); mouse(iso, 'mouseup'); flush(); };
    const gd = () => S.gameDaysCheck().have;
    const blk = () => st().settings.blackouts.map((b) => b.start.slice(5) + '~' + b.end.slice(5)).join(',');
    const bAt = (iso) => st().calendar.find((c) => c.datetime.startsWith(iso));
    const hashOf = () => { const o = { step: 1, tab: S.ui.tab }; S.g1Hash(o); return Object.keys(o).map((k) => k + '=' + o[k]).join('&'); };
    const undoN = (n) => { for (let k = 0; k < n; k++) app().undo(); flush(); };
    S.g1.mode = 'cal'; S.g1.open = null; C.day = null; C.slotAt = null; S.go({ step: 1, ops: null, cell: null, edit: null, modal: null });
    // 1. 한 화면: 왼쪽·가운데·오른쪽, ① 안의 띠·묻는 화면 없음
    ok('시즌 달력: ①은 한 화면(왼쪽 시즌 기간·연전 규칙·공휴일 / 가운데 달력 / 오른쪽 고른 날·확인·엑셀) · 띠·묻는 화면 없음', !!q('.stepview.sc') && !!q('.sc-season') && !!q('.sc-rules') && !!q('.sc-hols') && !!q('.sc-strip') && !!q('.sc-day') && !!q('.sc-check') && !!q('.sc-xl') && !q('.gs-strip') && !q('.gs-pick') && !q('.band') && !q('.pane.list'));
    ok('시즌 달력: 2025 예시 → 「경기일 135 / 135일」 맞음 · 2연전 1 · 3연전 43 · 4연전 1 · 묶음 45개 · 3월~8월 6줄', /경기일 135 \/ 135일/.test(q('#scCount').textContent) && q('#scCount').classList.contains('ok') && /2연전 1 · 3연전 43 · 4연전 1 · 묶음 45개/.test(q('.sc-hist').textContent) && qa('.sc-strip .strip-row').length === 6 && qa('.sc-strip .sd.ss').length === 45);
    ok('시즌 달력: 토요일 파랑 · 일요일·공휴일 빨강 표시 · 5/5 홈 구장 지정 표시 · 시즌 요약 줄', cell('2025-03-22').classList.contains('sat') && cell('2025-03-23').classList.contains('sun') && cell('2025-05-05').classList.contains('hol') && cell('2025-05-05').classList.contains('ev') && /시즌 달력 한 화면 · 경기일 135 \/ 135/.test(q('.step[data-step="1"] .step-sum').textContent));
    ok('시즌 달력: 주소는 #step=1(표 이름 없음) · 예전 g=new&gs=3도 시즌 달력 · tab=은 모든 표 보기', !/tab=/.test(hashOf()) && (() => { S.g1Route({ step: '1', g: 'new', gs: '3' }); const a = S.g1.mode === 'cal'; S.g1Route({ step: '1', tab: 'series' }); const b = S.g1.mode === 'all'; S.g1Route({ step: '1' }); return a && b && S.g1.mode === 'cal'; })(), hashOf());
    // 2. 규칙대로 채우기 → 45 · 135 · 휴식기·휴식일 경기는 묶음에서
    click('.sc-rules [data-act="cal-fill"]'); flush();
    ok('규칙대로 채우기 → 45개 · 경기일 135 · 휴식일 경기 5/5 · 휴식기 5/8, 7/11~16(묶음에서 만듦)', st().calendar.length === 45 && gd() === 135 && st().settings.restExceptions.join() === '2025-05-05' && blk() === '05-08~05-08,07-11~07-16', blk());
    // 3. 묶음 누르기 → 말풍선 → 지우기 → 경기 없는 날(휴식기) · 시리즈는 일정 미정으로 · 실행 취소
    const p0 = Array.from(app().derived().plan), s5 = st().calendar.findIndex((c) => c.datetime.startsWith('2025-04-08'));
    tap('2025-04-09');
    ok('묶음 누르기 → 말풍선(연전 수 2·3·4 · 지우기) · 고른 날 4/9', !!q('#scPop') && qa('#scPop [data-act="cal-len"]').length === 3 && !!q('#scPop [data-act="cal-del"]') && C.day === dn('2025-04-09') && /고른 날 · 4\/9\(수\)/.test(q('.sc-day').textContent) && cell('2025-04-08').classList.contains('sel'));
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
    // 7. 공휴일 표: 가중치를 고치면 묶음 값(든 날 가중치 합)이 바뀐다 · 줄 추가·지우기
    const hi = st().settings.holidays.findIndex((h) => h.date === '2025-05-05');
    const w5 = () => bAt('2025-05-05').holiday;
    const wIn = () => q('.sc-hols input[data-row="' + hi + '"][data-k="weight"]');
    const w0 = w5();
    wIn().value = '1'; wIn().dispatchEvent(new Event('change', { bubbles: true })); flush();
    const w1 = w5();
    undoN(1);
    ok('공휴일 표: 어린이날 가중치 3(KBO 확인 필요 표시) → 1이면 5/5 묶음 값 5 → 3 · 실행 취소', w0 === 5 && w1 === 3 && w5() === 5 && /KBO 확인 필요/.test(q('.sc-hols').textContent) && wIn().value === '3', w0 + '→' + w1);
    const nh = st().settings.holidays.length;
    click('.sc-hols [data-act="cal-hol-add"]'); flush();
    const added = st().settings.holidays.length === nh + 1;
    undoN(1);
    ok('공휴일 표: 「줄 추가」 → 한 줄 · 실행 취소', added && st().settings.holidays.length === nh);
    // 8. 시즌 연도 2027 → 날짜를 적기 전에도 주말·공휴일 표시 · 묶음 없음 · 실행 취소로 2025
    const ySel = q('.sc-year'); ySel.value = '2027'; ySel.dispatchEvent(new Event('change', { bubbles: true })); flush();
    ok('시즌 연도 2027 → 개막일 전에도 토 파랑·일/공휴일 빨강(5/13 부처님오신날·8/16 대체공휴일) · 묶음 0 · 「0 / 135일」', S.seasonYear() === 2027 && !st().settings.seasonStart && !st().calendar.length && cell('2027-03-27').classList.contains('sat') && cell('2027-05-13').classList.contains('hol') && cell('2027-08-16').classList.contains('hol') && cell('2027-05-09').classList.contains('sun') && /0 \/ 135일/.test(q('#scCount').textContent) && q('.sc-rules [data-act="cal-fill"]').disabled && /2027 시즌 달력/.test(q('.sc-head').textContent));
    const put = (k, v) => { const i = q('.sc-season input[data-k="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
    put('seasonStart', '3/27'); put('initialEnd', '8/29'); put('seasonEnd', '10/31');
    click('.sc-rules [data-act="cal-fill"]'); flush();
    const r27 = st().calendar.length > 40 && st().settings.restExceptions.includes('2027-08-16') && bAt('2027-03-27').consecutive === 2 && /07-09~07-14/.test(blk());
    ok('2027: 개막 3/27(토) · 규칙대로 채우기 → 개막 토·일 2연전 · 8/16(월) 대체공휴일 경기 · 올스타 7/9~14', r27, st().calendar.length + '개 · ' + gd() + '일 · ' + blk());
    undoN(5);
    ok('실행 취소 다섯 번 → 2025 예시 그대로', S.seasonYear() === 2025 && st().calendar.length === 45 && gd() === 135 && st().settings.holidays.length === 10);
    // 9. 「다음: 검토·실행」: 묶음이 바뀌어 시리즈가 맞지 않으면 규칙대로 다시 만든다
    tap('2025-07-17'); click('#scPop [data-act="cal-split"]'); flush();
    const before = S.calSeriesState();
    click('.footer [data-act="cal-next"]'); flush();
    ok('묶음을 나누면 확인에 「다시 만듦」 → 「다음: 검토·실행」이 시리즈를 규칙대로 다시 만들고(묶음 46 × 5 = 230개) ② · 사전 점검 진행 불가 0', !before.ok && S.ui.step === 2 && st().matches.length === 230 && S.calSeriesState().ok && app().preflight().counts.block === 0, before.text + ' · block ' + app().preflight().items.filter((x) => x.status === 'block').map((x) => x.title).join(','));
    S.go({ step: 1 }); undoN(3);
    ok('실행 취소 세 번(시리즈 고정·시리즈·나누기) → 나누기 전 · 시리즈 그대로', st().calendar.length === 45 && S.calSeriesState().ok && Array.from(app().derived().plan).every((c, m) => c === p0[m]));
    // 10. 홈 구장 지정(날짜 메뉴는 이것 하나): 5/5 어린이날 · 3/22 개막전도 구장 5곳 · 잠실은 하나만 · 5곳 넘으면 거부
    const evAt = (iso) => st().events.find((e) => e.mode === 'STADIUM' && e.date === iso);
    const teamBtn = (n) => q('.sc-day [data-act="cal-home-team"][data-team="' + n + '"]');
    tap('2025-05-05');
    ok('5/5를 누르면 「고른 날 · 5/5(월)」 · 홈 구장 지정 켜짐 · 두산·키움·한화·NC·롯데 5 / 5곳 · 상대는 자동 편성', /고른 날 · 5\/5\(월\)/.test(q('.sc-day').textContent) && q('.sc-day .sc-tog').classList.contains('on') && qa('.sc-day .gs-tbtn.on').length === 5 && ['두산', '키움', '한화', 'NC', '롯데'].every((n) => teamBtn(n).classList.contains('on')) && /5 \/ 5곳/.test(q('.sc-day').textContent) && /상대는 자동 편성/.test(q('.sc-day').textContent));
    const u0 = app().store.undoStack.length;
    click('.sc-day [data-act="cal-home-team"][data-team="LG"]'); flush();
    click('.sc-day [data-act="cal-home-team"][data-team="SSG"]'); flush();
    ok('5곳이 찼으면 더 넣지 않음 · 잠실은 두산·LG 중 하나만(두산을 고른 채 LG 거부)', app().store.undoStack.length === u0 && evAt('2025-05-05').teams.length === 5 && !evAt('2025-05-05').teams.includes('LG') && teamBtn('LG').classList.contains('dim'));
    click('.sc-day [data-act="cal-home-team"][data-team="두산"]'); flush();
    click('.sc-day [data-act="cal-home-team"][data-team="LG"]'); flush();
    const sw = evAt('2025-05-05');
    ok('두산을 빼고 LG → 어린이날 홈 구단 LG·키움·한화·NC·롯데 · 구장은 그대로 잠실 · 서버 자동 편성 어린이날 구단도 같이', sw.teams.join() === 'LG,키움,한화,NC,롯데' && sw.stadiums.includes('잠실종합운동장') && st().settings.obligationTeams.join() === 'LG,키움,한화,NC,롯데' && app().store.undoStack.length === u0 + 2);
    undoN(2);
    ok('실행 취소 두 번 → 두산·키움·한화·NC·롯데', evAt('2025-05-05').teams.join() === '두산,키움,한화,NC,롯데' && st().settings.obligationTeams.join() === '두산,키움,한화,NC,롯데');
    tap('2025-03-22');
    ok('개막전 3/22(토)도 대진이 아니라 홈 구장 5곳(LG·SSG·KT·삼성·KIA — 2025 공식 일정표)', evAt('2025-03-22').type === 'OPENING' && evAt('2025-03-22').teams.join() === 'SSG,LG,KT,삼성,KIA' && !st().events.some((e) => e.mode === 'MATCH') && qa('.sc-day .gs-tbtn.on').length === 5);
    tap('2025-06-03');
    const offFirst = !q('.sc-day .sc-tog').classList.contains('on') && !q('.sc-day .gs-tbtn');
    click('.sc-day [data-act="cal-home-on"]'); flush();
    click('.sc-day [data-act="cal-home-team"][data-team="KIA"]'); flush();
    const made = evAt('2025-06-03');
    ok('지정 없는 날(6/3): 켜면 구단 단추 → KIA를 고르면 홈 구장 지정 1곳 · 달력에 표시', offFirst && !!made && made.teams.join() === 'KIA' && cell('2025-06-03').classList.contains('ev') && /1 \/ 5곳/.test(q('.sc-day').textContent));
    click('.sc-day [data-act="cal-home-off"]'); flush();
    ok('끄면 그 날 지정을 지움', !evAt('2025-06-03') && !cell('2025-06-03').classList.contains('ev'));
    undoN(2);
    tap('2025-07-14');
    ok('묶음 없는 날(7/14 월)은 홈 구장 지정을 켤 수 없음(경기 없는 날 안내)', q('.sc-day .sc-tog').disabled && /경기가 없습니다/.test(q('.sc-day').textContent));
    cell('2025-05-05').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); flush();
    ok('오른쪽 단추도 같은 메뉴(5/5 고른 날)', C.day === dn('2025-05-05') && /고른 날 · 5\/5/.test(q('.sc-day').textContent));
    ok('확인: 홈 구장 지정 「3/22 개막전 5곳 · 5/5 어린이날 5곳」', /3\/22 개막전 5곳 · 5\/5 어린이날 5곳/.test(q('.sc-check').textContent));
    // 11. 엑셀(ㄱ 날짜 행): 지금 데이터로 서식 내려받기 → 고쳐서 올리기 → 시트마다 검사 → 달력에 반영(실행 취소 한 번)
    if (S.calXlSheets) {
      const X = KBO.Xlsx;
      click('.sc-xl [data-act="cal-xl-down"]'); flush();
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
    }
    // 12. 따라 하기(처음 한 번, 2025 예시 데이터로 4단계) — 마치면 바꾼 것을 되돌린다
    if (S.calTour) {
      const depth0 = app().store.undoStack.length, cal0 = JSON.stringify(st().calendar), plan0 = JSON.stringify(st().plan);
      const card = () => (q('#guide .ct-card') || { textContent: '' }).textContent;
      click('.sc-right [data-act="cal-tour"]'); flush();
      ok('따라 하기 1 / 4: 4/8~4/10 묶음을 비워 두고(132일) 테두리 + 카드 「끌어서 연전 묶음 만들기」', C.tour && C.tour.step === 1 && !bAt('2025-04-08') && gd() === 132 && /따라 하기 1 \/ 4/.test(card()) && /끌어서/.test(card()) && !!q('#guide .ct-ring'));
      drag('2025-04-08', '2025-04-10', ['2025-04-09']);
      ok('따라 하기 2 / 4: 끌어서 만들면 다음 단계 「묶음을 눌러 연전 수 바꾸기」', C.tour.step === 2 && /2 \/ 4/.test(card()) && gd() === 135);
      tap('2025-04-09'); click('#scPop [data-act="cal-len"][data-n="2"]'); flush();
      ok('따라 하기 3 / 4: 연전 수를 바꾸면 「날을 눌러 홈 구장 지정」', C.tour.step === 3 && /3 \/ 4/.test(card()) && gd() === 134);
      tap('2025-05-05');
      ok('따라 하기 4 / 4: 5/5를 누르면 「경기일 합 135 맞추기」', C.tour.step === 4 && /4 \/ 4/.test(card()) && /경기일 합 135/.test(card()));
      tap('2025-04-08'); click('#scPop [data-act="cal-len"][data-n="3"]'); flush();
      ok('따라 하기: 135로 맞추면 「다 했습니다」', C.tour.step === 5 && /다 했습니다/.test(card()));
      click('#guide [data-act="tour-end"]'); flush();
      ok('따라 하기 마치기 → 바꾼 것을 되돌림(묶음·시리즈 배정 그대로) · 다시 뜨지 않게 기억', !C.tour && !q('#guide .ct-card') && app().store.undoStack.length === depth0 && JSON.stringify(st().calendar) === cal0 && JSON.stringify(st().plan) === plan0 && S.guideStore('cal-tour').get().seen === true);
      S.guideStore('cal-tour').reset();
    }
    // 12. 화면 안 · 페이지 스크롤 0 (말풍선 열린 채로도)
    tap('2025-07-17');
    const pop = q('#scPop').getBoundingClientRect(), body = q('#scCal').getBoundingClientRect();
    ok('말풍선은 달력 안 · 페이지 스크롤 0', pop.left >= body.left - 1 && pop.right <= body.right + 1 && pop.top >= body.top - 1 && pop.bottom <= body.bottom + 1 && S.checkScroll().ok);
    C.day = null; C.slotAt = null; flush();
  };

  /** 시즌 연도: 날짜가 아직 없으면 연도만 바꾸고 그 해 법정 공휴일을 채운다. 다른 해 날짜가 있으면 새 시즌으로 비운다(실행 취소 가능) */
  S.inputs['cal-year'] = (el) => {
    if (S.locked()) return;
    const y = +el.value, s = set();
    if (y === S.seasonYear() && s.seasonYear === y) return;
    const hasOther = !!(s.seasonStart && +s.seasonStart.slice(0, 4) !== y);
    const hols = CalendarGen.builtinHolidays(y).filter((h) => h.date >= y + '-03-01' && h.date <= y + '-10-31');
    app().commit(y + ' 시즌으로', (x) => {
      x.settings.seasonYear = y;
      if (hasOther || !x.settings.seasonStart) {
        Object.assign(x.settings, { seasonStart: '', initialEnd: '', seasonEnd: '', allStarStart: CalendarGen.defaultAllStarStart(y), holidays: hols });
        x.calendar = []; x.events = []; x.plan.forEach((p) => { p.calendar = -1; });
        for (const m of x.matches) { m.pinned = false; delete m.eventId; }
        x.games = [];
      }
      S.recalcCalendar(x);
    }, ['settings', 'calendar', 'events', 'plan']);
    C.day = null; C.slotAt = null;
    S.toast(y + ' 시즌 달력입니다. 주말·공휴일(' + hols.length + '일)을 먼저 표시했습니다' + (hasOther ? ' — 다른 해 날짜·묶음·홈 구장 지정은 비웠습니다(실행 취소로 되돌릴 수 있습니다)' : '') + '. 개막일(토요일)부터 적어 주세요.', 'info', 7000);
  };
})();
