/*
 * 편성 스튜디오 — 결과 고치기 (2027 흐름 · 시안 1 「시즌 띠」, 요구 사항 2026-11-07)
 *  「일정 자세히 보기」 맨 위에 시즌 띠 한 줄: 연전 기간 45개 + 달 이름.
 *   - 누르면 고정(다시 누르면 풀기) · 끌거나 Shift로 여러 개 · 달 이름 = 그 달 전체 · 「모두 풀기」
 *   - 「홈 지정」으로 바꾸고 3연전을 누르면 그 연전의 홈 구단을 고른다(1단계 홈 구장 지정과 같은 값: events[] mode 'STADIUM', fix 'home')
 *   - 띠를 누르면 아래 달력이 그 연전으로 간다
 *  손으로 놓기는 아래 달력의 「옮기기…」. 고정한 연전으로 넣거나 빼는 것은 막고, 놓은 그 경기만 고정한다(matches[].hand + pinned).
 *  마치기: 「검사하고 저장」(엔진 없이 필수 규칙 전부, 위반이 있으면 저장 막음) · 「나머지 엔진으로 짜기」(실행 전 검사 → 처음부터 다시 짜기 60초,
 *   서버가 고정한 채로 시작을 못 하면 이어서 풀기로 다시) → 끝나면 평가 기준 넷의 전후.
 *  상태: st.meta.editFix = { calSig, slots: [연전 기간 번호] } · st.meta.editRun = { before, after, init, … } · matches[].hand.
 *  계산(고정할 경기 · 실행 전 검사 · 새로 짤 연전 수)은 core/fix-plan.js.
 *  ?classic=1 · 자가 점검 화면에서는 읽지 않는다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const params = new URLSearchParams(location.search);
  if (params.get('selftest') === '1' || params.get('classic') === '1') return;
  const P = S.planFlow;
  if (!P) return;
  const { KBO, esc, icon, fmt } = S;
  const { Score, Dates, FixPlan } = KBO;
  const app = () => S.app;
  const D = () => app().derived();
  const YEAR = P.YEAR_NEW;
  const EDIT_SEC = 60; // 실행 시간 기본(사용자 확정 2026-11-07). 더 나아지지 않으면 그 절반에서 끝
  const FEW = 10;
  const E = P.edit = { mode: 'fix', homeSlot: null, panel: null, focus: null, anchor: null, anchorVal: true, drag: null, pending: false, baHidden: false };
  const isRunning = () => !!(S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED'));
  const num = (v, d) => Number(v).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });

  // ───────── 상태 ─────────
  const inYear = () => S.seasonYear() === YEAR;
  /** 결과가 있는 2027 「일정 자세히 보기」에서만(실행 중에는 띠를 숨긴다) */
  const on = () => inYear() && S.ui.step === 3 && !S.ui.ops && !isRunning() && !!P.freshResult(app().state);
  const fixedOf = (st) => { const f = st.meta && st.meta.editFix; return f && f.calSig === P.calSig(st) ? FixPlan.cleanSlots(f.slots, st.calendar.length) : []; };
  const isFixed = (s) => s >= 0 && fixedOf(app().state).includes(s);
  const slotName = (s) => { const sl = D().slots[s]; return sl ? fmt.short(sl.day) + ' ' + sl.consecutive + '연전' : ''; };
  const handCount = (st) => st.matches.filter((m) => m.hand).length;
  const designated = () => FixPlan.designations(app().state);
  const ruleWord = { 'H0-a': '한 구단 두 번', 'H0-b': '구장 겹침', 'H0-d': '연전 수', 'H0-e': '홈 지정', 'H0-f': '4연속', 'H1': '같은 대진 연속' };

  /** 고정한 연전 목록을 바꾸고 경기 고정(matches[].pinned)을 맞춘다. 실행 취소 한 단계 */
  function setFixed(slots, label) {
    if (S.locked && S.locked()) return false;
    const st = app().state, next = FixPlan.cleanSlots(slots, st.calendar.length);
    if (next.join() === fixedOf(st).join()) return false;
    E.panel = E.panel && E.panel.kind === 'home' ? E.panel : null;
    return app().commit(label, (x) => { x.meta.editFix = { calSig: P.calSig(x), slots: next }; FixPlan.syncPins(x, next); }, ['meta', 'pins']);
  }
  function setRange(a, b, val) {
    const lo = Math.min(a, b), hi = Math.max(a, b), cur = new Set(fixedOf(app().state));
    for (let s = lo; s <= hi; s++) { if (val) cur.add(s); else cur.delete(s); }
    const n = hi - lo + 1;
    return setFixed(Array.from(cur), (val ? '연전 고정: ' : '연전 고정 풀기: ') + (n > 1 ? slotName(lo) + ' ~ ' + slotName(hi) + ' (' + n + '개)' : slotName(lo)));
  }
  function toggleMonth(mo) {
    const c = D(), list = c.slots.filter((sl) => sl.month === mo).map((sl) => sl.index), cur = new Set(fixedOf(app().state));
    const all = list.every((s) => cur.has(s));
    for (const s of list) { if (all) cur.delete(s); else cur.add(s); }
    setFixed(Array.from(cur), (all ? '연전 고정 풀기: ' : '연전 고정: ') + mo + '월 전체');
  }
  function clearAll() {
    if (S.locked && S.locked()) return;
    E.panel = null;
    app().commit('고정 모두 풀기', (x) => { x.meta.editFix = { calSig: P.calSig(x), slots: [] }; for (const m of x.matches) delete m.hand; FixPlan.syncPins(x, []); }, ['meta', 'pins']);
  }
  /** 띠에서 그 연전으로: 아래 달력을 그 달로 바꾸고 그 연전을 파랑 테두리로 */
  function focusSlot(s, matches) {
    const sl = D().slots[s];
    if (!sl) return;
    E.focus = s;
    Object.assign(S.ui, { view: 'calendar', month: sl.month, sel: null, pop: null, moving: null, flashMatches: matches ? matches.slice() : null });
  }

  // ───────── 손으로 놓기 ─────────
  /** 옮길 수 없는 까닭(없으면 null) */
  function lockReason(m) {
    const st = app().state, mt = st.matches[m], s0 = D().plan[m];
    if (!mt) return '없는 경기입니다';
    if (isFixed(s0)) return '고정한 연전이라 옮길 수 없습니다';
    if (mt.pinned && mt.eventId) return '정해 둔 대진(개막전 등)이라 옮길 수 없습니다';
    return null;
  }
  const deltaWord = (h) => (h > 0 ? '위반 ' + h + '↓' : h < 0 ? '위반 ' + (-h) + '↑' : '위반 그대로');
  /** 놓기: 옮긴 그 경기만 고정(hand). 맞바꾸기 상대는 고정하지 않는다(엔진이 바꿀 수 있음) */
  function drop(m, slot, target) {
    const why = lockReason(m) || (isFixed(slot) ? '고정한 연전이라 옮길 수 없습니다' : null);
    if (why) { S.toast(why, 'warn'); return false; }
    const pv = app().previewDrop(m, slot, target);
    const ok = app().commit((target != null ? '손으로 맞바꾸기: ' : '손으로 놓기: ') + app().matchLabel(m) + ' → ' + slotName(slot), (x) => {
      if (target != null) { const t = x.plan[m].calendar; x.plan[m].calendar = x.plan[target].calendar; x.plan[target].calendar = t; }
      else x.plan[m].calendar = slot;
      x.matches[m].hand = true;
      FixPlan.syncPins(x, fixedOf(x));
    }, ['plan', 'pins']);
    if (ok) {
      S.ui.flashMatches = target != null ? [m, target] : [m];
      S.toast('손으로 놓았습니다 · 이 경기는 그 자리에 고정 · ' + deltaWord(pv.hardDelta) + (pv.hardDelta < 0 ? ' — 남은 위반은 「나머지 자동 편성」이 고칩니다' : ''), pv.hardDelta >= 0 ? 'ok' : 'info', 5000);
    }
    return ok;
  }
  function unhand(m) {
    if (S.locked && S.locked()) return;
    app().commit('손으로 놓은 경기 고정 풀기: ' + app().matchLabel(m), (x) => { delete x.matches[m].hand; FixPlan.syncPins(x, fixedOf(x)); }, ['pins']);
  }

  // ───────── 홈 지정(연전 기간 단위 · 3연전만) ─────────
  const evAt = (st, slot) => (st.events || []).find((e) => e.mode === 'STADIUM' && Score.resolveEventSlot(e, st.calendar) === slot) || null;
  const half = () => app().state.teams.length >> 1;
  /** 1단계 「주요 이벤트 일정」의 홈 구장 지정과 같은 값·같은 검사(같이 쓰는 구장은 하나만 · 한 연전 최대 구단 수의 절반) */
  function designate(slot, team) {
    if (S.locked && S.locked()) return;
    const st = app().state, c = D(), sl = c.slots[slot], t = st.teams.find((x) => x.name === team);
    if (!sl || !t) return;
    if (sl.consecutive !== 3) { S.toast('홈 지정은 3연전에만 합니다.', 'warn'); return; }
    const ev = evAt(st, slot);
    if (ev && S.isRuleHome(ev)) { S.toast(ev.name + ' 홈 구단은 편성 조건에서 정했습니다. 「편성 조건 입력·검증」에서 바꿉니다.', 'warn', 5000); return; }
    const cur = ev ? S.evTeams(ev) : [], removing = cur.includes(team);
    const stad = (n) => (st.teams.find((x) => x.name === n) || {}).stadium;
    const homeNow = c.bySlot[slot].some((i) => st.matches[i].home === team);
    if (!removing) {
      const clash = cur.find((x) => stad(x) === t.stadium);
      if (clash) { S.toast(t.stadium + '은(는) ' + st.teams.filter((y) => y.stadium === t.stadium).map((y) => y.name).join('·') + ' 중 한 구단만 홈이 됩니다. 이미 ' + clash + '을(를) 골랐습니다.', 'warn', 5500); return; }
      if (cur.length >= half()) { S.toast('한 연전에 홈 지정은 ' + half() + '구단까지입니다. 다른 구단을 먼저 빼세요.', 'warn', 5000); return; }
      if (isFixed(slot) && !homeNow) { S.toast('고정한 연전이라 ' + team + '을(를) 홈으로 바꿀 수 없습니다. 고정을 풀고 지정하세요.', 'warn', 5000); return; }
    }
    const order = st.teams.map((x) => x.name);
    const next = (removing ? cur.filter((x) => x !== team) : cur.concat([team])).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const ok = app().commit(slotName(slot) + ' 홈 지정 ' + (removing ? '빼기: ' : '넣기: ') + team, (x) => {
      let e = evAt(x, slot);
      if (!next.length) {
        if (e) { x.events = x.events.filter((y) => y !== e); for (const m of x.matches) if (m.eventId === e.id) { delete m.eventId; m.pinned = false; } FixPlan.syncPins(x, fixedOf(x)); }
        return;
      }
      if (!e) {
        e = { id: 'ev-custom-' + Date.now().toString(36), type: 'CUSTOM', name: '홈 지정', date: Dates.isoDate(sl.day), mode: 'STADIUM', fix: 'home' };
        x.events.push(e);
        x.events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      }
      e.teams = next; e.stadiums = next.map((n) => (x.teams.find((y) => y.name === n) || {}).stadium); e.slot = slot;
    }, ['events', 'pins']);
    if (!ok) return;
    if (removing) S.toast(team + ' 홈 지정을 뺐습니다.', 'info');
    else if (homeNow) S.toast(team + '은(는) 이미 홈입니다. 홈 지정으로 남겨 두어 다시 짤 때도 홈으로 지킵니다.', 'info', 5500);
    else S.toast(team + ' 홈 지정 · 지금 일정에서는 원정이라 위반으로 보입니다. 「나머지 자동 편성」이 반영합니다.', 'info', 5500);
  }

  // ───────── 실행 ─────────
  const summaryOf = (ex) => ({ gaps: Object.assign({}, ex.objectiveGaps), hard: (ex.violations || []).length });
  /** 「전」 = 고치기 전 결과(지금 결과로 저장한 버전)를 지금 편성 조건으로 다시 센 것. 손으로 놓아 생긴 중복으로 센 숫자가 아니다. 버전이 없으면 지금 일정 */
  function baseSummary() {
    const st = app().state, r = st.meta.result || {}, id = r.vid || r.from, v = id ? P.versions.get(YEAR, id) : null;
    if (!v || v.matches.length !== st.matches.length) return Object.assign(summaryOf(D().ex), { name: null });
    const p = JSON.parse(JSON.stringify(st));
    p.matches = v.matches.map((m) => Object.assign({ pinned: false }, m));
    p.plan = v.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
    return Object.assign(summaryOf(Score.scoreProject(p, {})), { name: v.name });
  }
  const objective = () => app().state.settings.objective || P.DEFAULT_OBJECTIVE;
  /** 실행 전 검사: 고정한 것끼리의 진짜 위반. 있으면 막고 그 자리로 */
  function precheck() {
    const st = app().state, r = FixPlan.precheck(st, fixedOf(st));
    if (!r.violations.length) return true;
    E.panel = { kind: 'pre', list: r.violations };
    const v = r.violations[0];
    focusSlot(v.slot, v.matches);
    return false;
  }
  /** 실행 준비: 고정을 맞추고 「전」 숫자를 남긴다. 못 하면 false */
  function prepare() {
    const st = app().state, fixed = fixedOf(st), free = FixPlan.freeCount(st.calendar.length, fixed);
    if (free <= 0) { S.toast('모두 고정해서 새로 짤 연전이 없습니다. 고정을 줄여 보세요.', 'warn'); return false; }
    if (!precheck()) { S.toast('고정한 것끼리 위반이 있어 실행하지 않았습니다. 고정을 풀거나 직접 고치세요.', 'warn', 6000); S.render(); return false; }
    E.panel = null; E.baHidden = false;
    const kind = app().engineConfig.kind, init = kind === 'REST' ? 'SCRATCH' : 'KEEP'; // 시험 엔진은 처음부터 짜기를 못 해 이어서 푼다
    const hands = handCount(st), before = baseSummary();
    app().store.commit('결과 고치기: 실행 전', (x) => {
      FixPlan.syncPins(x, fixed);
      x.meta.editRun = { at: new Date().toISOString(), before, fixed: fixed.length, hand: hands, free, init, engine: kind, objective: objective() };
    }, { tags: ['meta', 'pins'], undo: false });
    app().updateSolverSettings({ timeLimitSec: EDIT_SEC, unimprovedSec: Math.round(EDIT_SEC / 2), init });
    P.runOption = P.optionOf(objective());
    P.runTag = '고정후새로짜기'; P.runNote = '고정한 연전 ' + fixed.length + '개 · 손으로 놓은 경기 ' + hands + '개 · 새로 짠 연전 ' + free + '개';
    E.pending = true;
    return { free };
  }
  /** 실행 시작(첫 결과가 오면 전 결과 표시를 지운다 — 운영 방침 화면의 실행과 같음) */
  function start() {
    S.startRun();
    if (!(S.run && app().run)) { endEdit(); return false; }
    let once = false;
    app().run.handle.on('best', () => { if (once) return; once = true; if (app().state.meta.result) app().store.commit('전 결과 표시 지우기', (x) => { delete x.meta.result; }, { tags: ['meta'], undo: false }); });
    S.go({ step: 2, sel: null, moving: null }); // 실행 중 화면(찾는 중…)에서 본다. 끝나면 여기로 돌아온다
    return true;
  }
  /** 결과 고치기 실행이 afterRun까지 가지 못하고 끝났을 때: 다음 보통 실행의 이름·메모에 섞이지 않게 */
  function endEdit() { E.pending = false; P.runTag = null; P.runNote = null; }
  function run() {
    if (isRunning() || (S.locked && S.locked())) return;
    const r = prepare();
    if (!r) return;
    E.homeSlot = null; // 홈 구단 고르기 창이 열려 있으면 닫는다 — 남아 있으면 실행 뒤 전후 비교를 가린다
    S.toast('연전 ' + r.free + '개를 새로 짭니다(최대 ' + EDIT_SEC / 60 + '분). 고정하지 않은 경기는 대부분 바뀝니다.', 'info', 5000);
    start();
  }
  // 실행이 끝나면(plan-flow.js S.afterRun이 버전으로 저장): 전후를 남기고 「일정 자세히 보기」로 돌아온다
  const origAfter = S.afterRun;
  S.afterRun = function (ex, r, why) {
    const pending = E.pending;
    E.pending = false;
    const out = origAfter(ex, r, why);
    if (!pending || !out) return out;
    const res = app().state.meta.result || {};
    app().store.commit('결과 고치기: 실행 뒤', (x) => {
      if (x.meta.editRun) Object.assign(x.meta.editRun, { after: summaryOf(ex), left: (ex.violations || []).length, saved: res.vid ? res.name : null, why, done: new Date().toISOString() });
    }, { tags: ['meta'], undo: false });
    E.panel = null; E.homeSlot = null; E.baHidden = false; E.focus = null;
    S.go({ step: 3, view: 'calendar', sel: null, pop: null, moving: null });
    return out;
  };
  // 서버가 고정한 채로 처음부터 짜지 못하면(JobManager 「…처음부터 짤 수 없었습니다」) 이어서 풀기로 한 번 더. 그것도 안 되면 사용자 말로
  S.onRunError = function (message) {
    if (!inYear() || !FixPlan.isPinnedStartFailure(message)) { if (E.pending) endEdit(); return false; }
    const sv = app().state.settings.solver, er = app().state.meta.editRun;
    if (sv.init === 'SCRATCH') {
      app().updateSolverSettings({ init: 'KEEP' });
      if (er && E.pending) app().store.commit('결과 고치기: 이어서 풀기로', (x) => { if (x.meta.editRun) { x.meta.editRun.init = 'KEEP'; x.meta.editRun.fallback = true; } }, { tags: ['meta'], undo: false });
      S.toast('처음부터 다시 짤 수 없어 지금 일정에서 이어서 고칩니다.', 'warn', 6000);
      setTimeout(() => start(), 0);
      return true;
    }
    if (er && E.pending) app().store.commit('결과 고치기: 실패', (x) => { if (x.meta.editRun) x.meta.editRun.failed = true; }, { tags: ['meta'], undo: false });
    endEdit();
    S.toast('고정한 연전이 많아 새로 짤 수 없습니다 · 고정을 줄여 보세요', 'bad', 7000);
    S.go({ step: 3 });
    return true;
  };

  // ───────── 검사하고 저장 ─────────
  /** 엔진 없이 필수 규칙 전부. 위반이 있으면 저장 막고 목록 + 그 자리로. 없으면 다른 실행처럼 버전으로 저장 */
  function save() {
    if (isRunning()) return;
    const st = app().state, ex = D().ex;
    // 홈 지정은 구단으로 지킨다(서버와 같음). 화면 채점기는 같이 쓰는 구장을 한 묶음으로 보아 「두산 홈 지정」을 LG 홈으로도 지켰다고 셀 수 있다
    const extra = FixPlan.precheck(st, st.calendar.map((c, i) => i)).violations.filter((v) => v.code === 'H0-e' && !ex.violations.some((w) => w.code === 'H0-e' && w.slot === v.slot));
    if (ex.violations.length || extra.length) {
      E.panel = { kind: 'save', extra };
      const v = ex.violations.length ? orderedViolations()[0] : extra[0];
      focusSlot(v.slot, v.matches);
      if (ex.violations.length) S.ui.sel = 'v:' + S.vsig(v);
      S.toast('필수 규칙 위반 ' + (ex.violations.length + extra.length) + '건이 있어 저장하지 않았습니다.', 'warn', 5000);
      S.render();
      return;
    }
    const prev = st.meta.result || {}, ob = objective(), no = P.nextRunNo(YEAR), option = P.optionOf(ob);
    S.ls.set(P.noKey(YEAR), String(no));
    const fixed = fixedOf(st);
    const res = { at: new Date().toISOString(), elapsedMs: 0, why: '직접 고침', objective: ob, sig: P.inputSig(st), calSig: P.calSig(st),
      engine: prev.engine || (prev.from ? 'REST' : app().engineConfig.kind), // 손으로 고친 일정은 고치기 전 결과를 낸 엔진을 따른다
      no, option, name: P.runName(no, option, ob) + '_직접고침', note: '손으로 고쳐 저장 · 고정한 연전 ' + fixed.length + '개 · 손으로 놓은 경기 ' + handCount(st) + '개' };
    const v = P.storeRun(res, ex);
    if (!v) { P.noRoom(); return; }
    res.vid = v.id;
    app().store.commit('직접 고친 일정 저장', (x) => { x.meta.result = Object.assign({}, res); }, { tags: ['meta'], undo: false });
    P.pickNew(v);
    E.panel = { kind: 'saved', name: v.name };
    S.toast('「' + v.name + '」(으)로 저장했습니다.', 'ok', 5000);
    S.render();
  }
  function orderedViolations() {
    const vs = D().ex.violations, out = [];
    for (const r of Score.HARD_RULES) for (const v of vs) if (v.code === r.code) out.push(v);
    return out;
  }

  // ───────── 그리기 ─────────
  function strip() {
    const st = app().state, c = D(), fixed = fixedOf(st), fx = new Set(fixed), des = designated();
    const hand = new Map();
    st.matches.forEach((m, i) => { if (m.hand && c.plan[i] >= 0) hand.set(c.plan[i], (hand.get(c.plan[i]) || 0) + 1); });
    const groups = [];
    for (const sl of c.slots) { const g = groups[groups.length - 1]; if (g && g.month === sl.month) g.list.push(sl.index); else groups.push({ month: sl.month, list: [sl.index] }); }
    const home = E.mode === 'home';
    const months = groups.map((g) => {
      const k = g.list.filter((s) => fx.has(s)).length, all = k === g.list.length;
      return '<button class="pe-mo' + (all ? ' on' : k ? ' some' : '') + '" style="grid-column:' + (g.list[0] + 1) + ' / span ' + g.list.length + '" data-act="pe-month" data-mo="' + g.month + '"' + (home ? ' disabled' : '') + ' title="' + g.month + '월 연전 ' + g.list.length + '개 ' + (all ? '고정 풀기' : '모두 고정') + '">' + g.month + '월' + (k ? '<small>' + (all ? icon('lock') : k + '/' + g.list.length) + '</small>' : '') + '</button>';
    }).join('');
    const cur = E.focus;
    const cells = c.slots.map((sl) => {
      const s = sl.index, f = fx.has(s), d = des[s] || [], h = hand.get(s) || 0, bad = c.ex.slotHard[s] > 0, first = groups.some((g) => g.list[0] === s);
      const tip = slotName(s) + (f ? ' · 고정' : ' · 새로 짬') + (d.length ? ' · 홈 지정 ' + d.join('·') : '') + (h ? ' · 손으로 놓은 경기 ' + h : '') + (bad ? ' · 위반 있음' : '') + (home ? (sl.consecutive === 3 ? ' · 누르면 홈 구단 고르기' : ' · 홈 지정은 3연전만') : ' · 누르면 ' + (f ? '고정 풀기' : '고정'));
      return '<button class="pe-c' + (f ? ' fx' : '') + (bad ? ' bad' : '') + (s === cur ? ' cur' : '') + (first ? ' m0' : '') + (home && sl.consecutive !== 3 ? ' no' : '') + (home && E.homeSlot === s ? ' open' : '') + '" data-pe="' + s + '" title="' + esc(tip) + '" aria-pressed="' + f + '">' +
        '<span class="d">' + Dates.fmtShort(sl.day).split('/')[1] + '</span><span class="mk">' + (f ? icon('lock') : '') +
        (d.length ? '<i class="hm" title="홈 지정 ' + esc(d.join('·')) + '">' + d.slice(0, 5).map((t) => '<b style="background:' + esc(S.teamColor(t)) + '"></b>').join('') + '</i>' : '') +
        (h ? '<span class="pe-hand">손</span>' : '') + '</span></button>';
    }).join('');
    const free = FixPlan.freeCount(c.slots.length, fixed), lvl = FixPlan.freeLevel(free), hands = handCount(st), nDes = Object.keys(des).filter((s) => !(st.events.find((e) => S.isRuleHome(e) && Score.resolveEventSlot(e, st.calendar) === +s))).length;
    const warn = lvl === 'zero' ? '<span class="pe-warn bad">' + icon('warn') + '모두 고정해서 새로 짤 연전이 없습니다</span>'
      : lvl === 'tiny' ? '<span class="pe-warn bad">' + icon('warn') + '새로 짤 연전이 ' + free + '개뿐이라 짜지 못할 수 있습니다 · 고정을 줄여 보세요</span>'
        : lvl === 'few' ? '<span class="pe-warn">' + icon('warn') + '새로 짤 연전이 ' + free + '개뿐 · 위반은 없어도 주말·공휴일 격차가 커질 수 있습니다</span>'
          : !fixed.length && !hands ? '<span class="pe-note">고정한 것이 없어 모든 연전을 새로 짭니다</span>' : '';
    const lead = home ? '3연전을 누르고 홈 경기를 할 구단을 고릅니다 · 한 연전에 ' + half() + '구단까지' : '누르면 고정 · 끌거나 Shift로 여러 개 · 달 이름은 그 달 전체';
    const nothing = !fixed.length && !hands;
    return '<div class="pe-strip' + (home ? ' home' : '') + '">' +
      '<div class="pe-head"><b class="pe-t">연전 기간 고정</b><span class="pe-lead">' + esc(lead) + '</span><span class="grow"></span>' +
      '<span class="pe-mode"><span class="muted small">누르면</span><span class="seg"><button class="' + (home ? '' : 'on') + '" data-act="pe-mode" data-v="fix" aria-pressed="' + !home + '">' + icon('lock') + '고정</button><button class="' + (home ? 'on' : '') + '" data-act="pe-mode" data-v="home" aria-pressed="' + home + '">' + icon('team') + '홈 지정</button></span></span>' +
      '<button class="btn sm" data-act="pe-clear"' + (nothing ? ' disabled' : '') + ' title="고정한 연전과 손으로 놓은 경기의 고정을 모두 풉니다(홈 지정은 그대로)">모두 풀기</button></div>' +
      '<div class="pe-grid" style="--n:' + c.slots.length + '">' + months + cells + '</div>' +
      '<div class="pe-foot"><span class="pe-sum"><b>새로 짤 연전 ' + free + '개</b><span class="muted"> / ' + c.slots.length + '</span><i>·</i>고정 ' + fixed.length + '<i>·</i>홈 지정 ' + nDes + '곳<i>·</i>손으로 놓은 경기 ' + hands + '</span>' + warn +
      '<span class="grow"></span><span class="pe-time muted small" title="고정하지 않은 경기는 대부분 바뀝니다">최대 ' + EDIT_SEC / 60 + '분 · 고정 안 한 경기는 대부분 바뀜</span>' +
      '<button class="btn" data-act="pe-save" title="자동 편성 없이 반드시 지킬 규칙을 모두 검사하고, 지켰으면 버전으로 저장합니다">' + icon('check') + '검사하고 저장</button>' +
      '<button class="btn primary" data-act="pe-run"' + (lvl === 'zero' ? ' disabled' : '') + ' title="고정한 연전·손으로 놓은 경기·홈 지정은 두고 나머지 연전 ' + free + '개를 자동 편성이 새로 짭니다">' + icon('play') + '나머지 자동 편성</button></div>' +
      panel() + '</div>';
  }
  function panel() {
    const p = E.panel;
    const close = '<button class="btn sm icon ghost pe-x" data-act="pe-panel-close" aria-label="닫기">' + icon('x') + '</button>';
    if (E.mode === 'home' && E.homeSlot != null) return homeMenu(close);
    if (p && p.kind === 'pre') {
      const by = FixPlan.bySlotCount(p.list), first = by[0], rest = p.list.length - first.count;
      const where = isFixed(first.slot) ? '고정한 ' + slotName(first.slot) + '에' : slotName(first.slot) + ' 손으로 놓은 경기에';
      return '<div class="pe-panel bad"><div class="pe-ph"><b>' + esc(where) + ' 위반 ' + first.count + '건' + (rest > 0 ? ' 외 ' + rest + '건' : '') + '</b><span>고정을 풀거나 직접 고치세요 · 실행하지 않았습니다</span>' + close + '</div>' +
        '<ul class="pe-list">' + p.list.slice(0, 6).map((v) => '<li><span class="pe-rule">' + esc(ruleWord[v.code] || S.ruleName(v.code)) + '</span><span class="pe-msg">' + esc(v.message) + '</span><button class="pf-link" data-act="pe-goto" data-slot="' + v.slot + '" data-ms="' + (v.matches || []).join(',') + '">그 자리로 ›</button></li>').join('') + (p.list.length > 6 ? '<li class="muted">… ' + (p.list.length - 6) + '건 더</li>' : '') + '</ul></div>';
    }
    if (p && p.kind === 'save') {
      const list = orderedViolations(), extra = p.extra || [];
      if (!list.length && !extra.length) { E.panel = null; return ''; }
      return '<div class="pe-panel bad"><div class="pe-ph"><b>필수 규칙 위반 ' + (list.length + extra.length) + '건이라 저장할 수 없습니다</b><span>고친 뒤 다시 누르거나 「나머지 자동 편성」으로 고칩니다</span>' + close + '</div>' +
        '<ul class="pe-list">' + list.slice(0, 5).map((v) => '<li><span class="pe-rule">' + esc(S.ruleName(v.code)) + '</span><span class="pe-msg">' + esc(S.plain(String(v.message)).replace(/시리즈/g, '경기')) + '</span><button class="pf-link" data-act="sel-viol" data-sig="' + esc(S.vsig(v)) + '">그 자리로 ›</button></li>').join('') +
        extra.slice(0, 3).map((v) => '<li><span class="pe-rule">홈 지정</span><span class="pe-msg">' + esc(v.message) + '</span><button class="pf-link" data-act="pe-goto" data-slot="' + v.slot + '" data-ms="' + (v.matches || []).join(',') + '">그 자리로 ›</button></li>').join('') +
        (list.length > 5 ? '<li><button class="pf-link" data-act="viol-menu">' + (list.length - 5) + '건 더 보기 ›</button></li>' : '') + '</ul></div>';
    }
    if (p && p.kind === 'saved') return '<div class="pe-panel ok"><div class="pe-ph"><b>' + icon('check') + '「' + esc(p.name) + '」(으)로 저장했습니다</b><span>반드시 지킬 규칙을 모두 지켰습니다 · 실행 결과 비교에서 다른 버전과 견줍니다</span><button class="pf-link" data-act="pf-stage" data-stage="4">실행 결과 비교 ›</button>' + close + '</div></div>';
    return beforeAfter(close);
  }
  /** 실행 뒤: 평가 기준 넷의 전 → 후(허용을 넘으면 표시), 남은 위반, 저장한 이름 */
  function beforeAfter(close) {
    const r = app().state.meta.editRun;
    if (!r || E.baHidden || !(r.after || r.failed)) return '';
    if (r.failed) return '<div class="pe-panel bad"><div class="pe-ph"><b>고정한 연전이 많아 새로 짤 수 없습니다</b><span>고정을 줄여 보세요</span>' + close + '</div></div>';
    const G = P.GOALS, ob = r.objective || objective();
    const cell = (id) => {
      const g = G[id], a = r.before.gaps[g.gap], b = r.after.gaps[g.gap], d = b - a, over = g.tol && b > ob[g.tol];
      return '<div class="pe-ba-g' + (over ? ' over' : '') + '"><span class="k">' + esc(g.name.replace(/ 줄이기$/, '')) + '</span><span class="v">' + num(a, g.d) + ' → <b>' + num(b, g.d) + '</b>' + g.unit + '</span>' +
        '<span class="dv ' + (d < 0 ? 'good' : d > 0 ? 'bad' : '') + '">' + (d === 0 ? '그대로' : (d > 0 ? '+' : '−') + num(Math.abs(d), g.d) + g.unit) + '</span>' + (g.tol ? (over ? '<span class="pf-tag over">허용 ' + num(ob[g.tol]) + g.unit + ' 넘음</span>' : '<span class="pf-tag ok">허용 안</span>') : '') + '</div>';
    };
    const how = r.init === 'KEEP' ? (r.fallback ? '처음부터 다시 짜지 못해 지금 일정에서 이어서 풀었습니다' : r.engine !== 'REST' ? '시험용 자동 편성이라 지금 일정에서 이어서 풀었습니다' : '지금 일정에서 이어서 풀었습니다') : '고정한 것만 두고 처음부터 다시 짰습니다';
    const tail = r.left ? '<b class="bad">남은 위반 ' + r.left + '건</b> — 저장하지 않았습니다. 달력에서 직접 고치거나 고정을 줄여 다시 짜세요' : r.saved ? '「' + esc(r.saved) + '」(으)로 저장 · 실행 결과 비교에서 견줍니다' : '';
    return '<div class="pe-panel ba' + (r.left ? ' bad' : '') + '"><div class="pe-ph"><b>새로 짠 결과 · 전 → 후</b>' + (r.engine !== 'REST' ? '<span class="pf-tag est" title="편성 서버에 연결되지 않아 브라우저의 시험용 자동 편성으로 냈습니다">시험용 자동 편성으로 낸 결과</span>' : '') +
      '<span>' + esc(how) + ' · 연전 ' + r.free + '개 새로 짬' + (r.before.name ? ' · 전 = 「' + esc(r.before.name) + '」' : '') + '</span>' + close + '</div>' +
      '<div class="pe-ba">' + ob.order.map(cell).join('') + '</div>' + (tail ? '<div class="pe-ba-tail">' + tail + '</div>' : '') + '</div>';
  }
  function homeMenu(close) {
    const st = app().state, c = D(), s = E.homeSlot, sl = c.slots[s];
    if (!sl) { E.homeSlot = null; return ''; }
    const ev = evAt(st, s), cur = ev ? S.evTeams(ev) : [], rule = ev && S.isRuleHome(ev);
    const homeNow = new Set(c.bySlot[s].map((i) => st.matches[i].home)), fixed = isFixed(s);
    const btn = (t) => { const onT = cur.includes(t.name), hn = homeNow.has(t.name);
      return '<button class="pe-tm' + (onT ? ' on' : '') + '" data-act="pe-home" data-team="' + esc(t.name) + '"' + (rule ? ' disabled' : '') + ' aria-pressed="' + onT + '" title="' + esc(t.name + (hn ? ' · 지금 일정에서 홈' : ' · 지금 일정에서 원정')) + '"><i style="background:' + esc(t.color || S.teamColor(t.name)) + '"></i>' + esc(t.name) + (hn ? '<small>지금 홈</small>' : '') + (onT ? icon('check') : '') + '</button>'; };
    return '<div class="pe-panel home"><div class="pe-ph"><b>' + esc(fmt.short(sl.day) + ' ~ ' + fmt.short(sl.days[sl.days.length - 1])) + ' 3연전 · 홈 지정 ' + cur.length + ' / ' + half() + '</b>' +
      '<span>' + (rule ? esc(ev.name) + ' 홈 구단은 「편성 조건 입력·검증」에서 정했습니다' : fixed ? '고정한 연전이라 지금 홈인 구단만 지정할 수 있습니다' : '고른 구단은 이 연전에 반드시 홈 경기를 합니다 · 두산·LG는 한 구단만') + '</span>' + close + '</div>' +
      '<div class="pe-tms">' + st.teams.map(btn).join('') + '</div></div>';
  }
  const slotTag = (s) => (isFixed(s) ? ' <span class="pe-lk">' + icon('lock') + '고정</span>' : '') + ((designated()[s] || []).length && !isFixed(s) ? ' <span class="pe-hd" title="홈 지정 ' + esc(designated()[s].join('·')) + '">홈 지정 ' + designated()[s].length + '</span>' : '');
  /** 경기 창 아래: 옮기기(또는 막힌 까닭) · 손으로 놓은 것 풀기. 추천·홈/원정 뒤집기·고정 스위치는 두지 않는다 */
  function popActs(m) {
    const mt = app().state.matches[m], why = lockReason(m);
    if (why) return '<div class="pe-pop">' + icon('lock') + '<span><b>' + esc(why) + '</b>' + (isFixed(D().plan[m]) ? '<br><span class="muted small">위 띠에서 이 연전의 고정을 풀면 옮길 수 있습니다</span>' : '') + '</span></div>';
    return (mt.hand ? '<div class="pe-pop hand"><span class="pe-hand">손</span><span><b>손으로 놓은 경기</b> — 이 자리에 고정됩니다</span><button class="btn sm" data-act="pe-unhand" data-m="' + m + '">고정 풀기</button></div>' : '') +
      '<div class="pop-row"><button class="btn sm primary" data-act="move-start" data-m="' + m + '">' + icon('move') + '옮기기…</button><span class="muted small">놓은 경기만 그 자리에 고정됩니다. 생긴 위반은 자동 편성이 고칩니다</span></div>';
  }

  S.r3Edit = {
    on,
    top: strip,
    canDrop: (mv, slot) => !isFixed(slot) && !isFixed(D().plan[mv]),
    chipMark: (m) => { const mt = app().state.matches[m]; return mt.hand ? '<span class="pe-hand" title="손으로 놓은 경기 · 그 자리에 고정">손</span>' : mt.pinned && mt.eventId ? '<span class="pin-ico">' + icon('pin') + '</span>' : ''; },
    slotCls: (s) => (isFixed(s) ? ' pe-fx' : '') + (s === E.focus ? ' pe-cur' : ''),
    slotTag,
    dropNote: (s) => (isFixed(s) ? '<div class="sb-from pe-nodrop">' + icon('lock') + '고정한 연전</div>' : ''),
    popActs,
    legend: () => '<span>' + icon('lock') + '고정한 연전</span>' + (handCount(app().state) ? '<span><span class="pe-hand">손</span>손으로 놓은 경기</span>' : '')
  };

  // ───────── 띠 누르기 · 끌기 ─────────
  const cellOf = (t) => (t && t.closest ? t.closest('.pe-strip .pe-c[data-pe]') : null);
  function paintDrag() {
    const g = E.drag;
    document.querySelectorAll('.pe-strip .pe-c').forEach((el) => { const s = +el.dataset.pe; el.classList.toggle('drag', !!g && g.moved && s >= Math.min(g.a, g.b) && s <= Math.max(g.a, g.b)); el.classList.toggle('drag-off', !!g && g.moved && !g.val); });
  }
  function pick(s, shift) {
    const c = D(), sl = c.slots[s];
    if (!sl) return;
    if (E.mode === 'home') {
      E.panel = null;
      if (sl.consecutive !== 3) { S.toast('홈 지정은 3연전에만 합니다.', 'warn'); return; }
      E.homeSlot = E.homeSlot === s ? null : s;
      focusSlot(s);
      S.render();
      return;
    }
    if (shift && E.anchor != null) { setRange(E.anchor, s, E.anchorVal); }
    else { const val = !isFixed(s); setRange(s, s, val); E.anchorVal = val; }
    E.anchor = s;
    focusSlot(s);
    S.render();
  }
  document.addEventListener('mousedown', (e) => {
    const el = cellOf(e.target);
    if (!el || e.button !== 0 || !on()) return;
    e.preventDefault();
    E.drag = { a: +el.dataset.pe, b: +el.dataset.pe, moved: false, shift: e.shiftKey, val: !isFixed(+el.dataset.pe) };
  });
  document.addEventListener('mouseover', (e) => {
    const g = E.drag;
    if (!g || E.mode === 'home') return;
    const el = cellOf(e.target);
    if (!el) return;
    const s = +el.dataset.pe;
    if (s === g.b) return;
    g.b = s; g.moved = s !== g.a;
    paintDrag();
  });
  document.addEventListener('mouseup', () => {
    const g = E.drag;
    if (!g) return;
    E.drag = null;
    if (!g.moved || E.mode === 'home') { pick(g.a, g.shift); return; }
    setRange(g.a, g.b, g.val);
    E.anchor = g.b; E.anchorVal = g.val;
    focusSlot(g.b);
    S.render();
  });
  // 키보드(Enter·Space)로 누른 것만 여기서. 마우스는 위 mousedown/mouseup이 맡는다
  document.addEventListener('click', (e) => {
    const el = cellOf(e.target);
    if (!el || e.detail !== 0 || !on()) return;
    pick(+el.dataset.pe, e.shiftKey);
  });

  // ───────── 동작 ─────────
  const orig = {};
  ['move-start', 'move-here', 'move-swap'].forEach((k) => { orig[k] = S.actions[k]; });
  Object.assign(S.actions, {
    'pe-mode': (el) => { E.mode = el.dataset.v === 'home' ? 'home' : 'fix'; E.homeSlot = null; E.panel = null; S.render(); },
    'pe-month': (el) => { if (E.mode !== 'fix') return; toggleMonth(+el.dataset.mo); const sl = D().slots.find((x) => x.month === +el.dataset.mo); if (sl) focusSlot(sl.index); S.render(); },
    'pe-clear': () => { if (window.confirm('고정한 연전과 손으로 놓은 경기의 고정을 모두 풀까요? 홈 지정은 그대로 둡니다. 실행 취소로 되돌릴 수 있습니다.')) { clearAll(); E.anchor = null; S.render(); } },
    'pe-home': (el) => { if (E.homeSlot != null) designate(E.homeSlot, el.dataset.team); },
    'pe-panel-close': () => { if (E.mode === 'home' && E.homeSlot != null) E.homeSlot = null; else if (E.panel) E.panel = null; else E.baHidden = true; S.render(); },
    'pe-goto': (el) => { focusSlot(+el.dataset.slot, (el.dataset.ms || '').split(',').filter(Boolean).map(Number)); S.render(); },
    'pe-unhand': (el) => { unhand(+el.dataset.m); },
    'pe-run': () => run(),
    'pe-save': () => save(),
    'move-start': (el, e) => {
      if (!on()) { orig['move-start'](el, e); return; }
      const m = +el.dataset.m, why = lockReason(m);
      if (why) { S.toast(why, 'warn'); return; }
      S.go({ moving: m, sel: null, pop: null });
    },
    'move-here': (el, e) => {
      if (!on()) { orig['move-here'](el, e); return; }
      const m = S.ui.moving; S.ui.moving = null;
      if (m != null) drop(m, +el.dataset.slot, null);
      S.render();
    },
    'move-swap': (el, e) => {
      if (!on()) { orig['move-swap'](el, e); return; }
      const m = S.ui.moving; S.ui.moving = null;
      if (m != null) drop(m, +el.dataset.slot, +el.dataset.m);
      S.render();
    }
  });
  // 고정을 바꾸지 않는 다른 길(보관함 빼기·넣기)도 고정한 연전은 막는다
  ['to-pool', 'from-pool'].forEach((k) => {
    const o = S.actions[k];
    if (!o) return;
    S.actions[k] = (el, e) => { if (on() && (isFixed(D().plan[+el.dataset.m]) || isFixed(+el.dataset.slot))) { S.toast('고정한 연전이라 옮길 수 없습니다', 'warn'); return; } o(el, e); };
  });

  // 운영 방침 화면의 실행도 고정을 지킨다: 아래 줄에 알림
  const origFooter = P.footer;
  P.footer = function () {
    const h = origFooter();
    if (!h || S.ui.step !== 2 || !inYear() || isRunning()) return h;
    const st = app().state, n = fixedOf(st).length, k = handCount(st);
    if (!n && !k) return h;
    const what = [n ? '고정한 연전 ' + n + '개' : '', k ? '손으로 놓은 경기 ' + k + '개' : ''].filter(Boolean).join(' · ');
    return h.replace('<span class="pf-ftime', '<span class="pe-keep" title="일정 자세히 보기의 시즌 띠에서 풀 수 있습니다">' + icon('lock') + esc(what) + '를 지킵니다</span><span class="pf-ftime');
  };

  // ───────── 점검용 주소(demo=edit27…): 2027-rank1을 불러와 고정·홈 지정·손으로 놓기 상태를 만든다 ─────────
  function withRank1(fn, n) {
    const v = P.builtin['2027-rank1'];
    if (!v) { if ((n || 0) < 100) setTimeout(() => withRank1(fn, (n || 0) + 1), 30); return; }
    S.quiet = true;
    try { fn(v); } finally { S.quiet = false; }
    S.render();
  }
  function demoBase(v) {
    app().commit('점검용: 2027 기본 제공 결과', (s) => {
      P.applyVersion(s, v);
      delete s.meta.editFix; delete s.meta.editRun;
      s.meta.result = { at: new Date().toISOString(), elapsedMs: v.elapsedMs, why: '저장한 버전', objective: v.objective, from: v.id, engine: 'REST', sig: P.inputSig(s), calSig: P.calSig(s) };
    }, ['teams', 'calendar', 'matches', 'plan', 'games', 'settings', 'events', 'meta']);
    Object.assign(E, { mode: 'fix', homeSlot: null, panel: null, focus: null, anchor: null, baHidden: false });
  }
  const slotsOfMonth = (mos) => D().slots.filter((sl) => mos.includes(sl.month)).map((sl) => sl.index);
  /** 3·4·7월 고정 + 6월 첫 3연전에 지금 원정인 구단 홈 지정 + 5월 경기 하나를 손으로 다른 5월 연전에 */
  function demoEdit(v) {
    demoBase(v);
    setFixed(slotsOfMonth([3, 4, 7]), '점검용: 3·4·7월 고정');
    const st = app().state, c = D(), june = c.slots.find((sl) => sl.month === 6 && sl.consecutive === 3);
    const shared = new Set(st.teams.filter((t) => st.teams.filter((x) => x.stadium === t.stadium).length > 1).map((t) => t.name));
    const away = c.bySlot[june.index].map((i) => st.matches[i].away).find((t) => !shared.has(t));
    designate(june.index, away);
    const may = c.slots.filter((sl) => sl.month === 5 && sl.consecutive === 3 && !isFixed(sl.index));
    const from = may[1], to = may[3], m = D().bySlot[from.index][0];
    drop(m, to.index, null);
    E.focus = to.index;
    Object.assign(S.ui, { view: 'calendar', month: 5, sel: null, pop: null, moving: null });
    return { m, to: to.index };
  }
  S.demos.edit27 = () => withRank1((v) => demoEdit(v));
  /** 고정한 것끼리 위반: 손으로 놓은 경기와 같은 구단이 낀 경기를 같은 연전에 하나 더 손으로 → 「나머지 엔진으로 짜기」가 막힘 */
  S.demos.edit27block = () => withRank1((v) => {
    const r = demoEdit(v), st = app().state, c = D(), mt = st.matches[r.m];
    const m2 = st.matches.findIndex((x, i) => i !== r.m && c.plan[i] !== r.to && !isFixed(c.plan[i]) && !x.pinned && x.consecutive === 3 && (x.home === mt.home || x.away === mt.home || x.home === mt.away || x.away === mt.away));
    if (m2 >= 0) drop(m2, r.to, null);
    run();
  });
  /** 새로 짤 연전이 적음: 마지막 8개만 남기고 모두 고정 */
  S.demos.edit27low = () => withRank1((v) => {
    demoBase(v);
    const n = D().slots.length;
    setFixed(D().slots.map((sl) => sl.index).filter((s) => s < n - 8), '점검용: 마지막 8개만 남기고 고정');
    E.focus = n - 8;
    Object.assign(S.ui, { view: 'calendar', month: D().slots[n - 8].month, sel: null, pop: null });
  });
  /** 운영 방침·실행 화면: 고정·홈 지정이 있는 채로 — 아래 줄에 「…를 지킵니다」, 홈 지정이 바뀌어 처음부터 다시 */
  S.demos.edit27run = () => withRank1((v) => {
    demoEdit(v);
    app().store.commit('점검용: 검토 끝', (x) => { x.meta.review = Object.assign({}, x.meta.review, { opening: true, allStar: true, initialEnd: true, openingHome: true, childrenHome: true }); x.meta.flow = Object.assign({}, x.meta.flow, { teams: 'same' }); }, { tags: ['meta'], undo: false });
    Object.assign(S.ui, { step: 2, sel: null, pop: null, moving: null });
  });
  /** 저장 막힘: 손으로 놓아 생긴 위반이 있는 채로 「검사하고 저장」 */
  S.demos.edit27save = () => withRank1((v) => { demoEdit(v); save(); });
  /** 홈 지정 고르기 창: 「홈 지정」으로 바꾸고 6월 첫 3연전을 누른 상태 */
  S.demos.edit27home = () => withRank1((v) => {
    demoEdit(v);
    const june = D().slots.find((sl) => sl.month === 6 && sl.consecutive === 3);
    E.mode = 'home'; E.homeSlot = june.index; focusSlot(june.index);
  });
  /** 실행 뒤: 시험 엔진(브라우저)으로 실제로 짧게 풀어 그 결과를 실행 끝처럼 넘긴다 — 화면에 「시험 엔진으로 낸 결과」로 보인다 */
  S.demos.edit27after = () => withRank1((v) => {
    demoEdit(v);
    if (app().engineConfig.kind === 'REST') return; // 서버에서는 실제로 실행해 보면 된다
    if (!prepare()) return;
    const st = app().state, prob = KBO.Engine.toSolverProblem(st, 'INITIAL'), search = KBO.MockSolver.createSearch(prob, { seed: 7, init: st.settings.solver.init });
    // 걸음 수로 끊는다(점검용 Chrome은 가상 시간이라 실행 중에 시계가 가지 않는다). 규칙을 모두 지키면 조금 더 다듬고 멈춘다
    let left = -1;
    for (let k = 0; k < 160; k++) { search.step(2000); if (left < 0 && search.bestScore().slice(0, 2).every((x) => x === 0)) left = 40; if (left >= 0 && --left <= 0) break; }
    const plan = search.bestPlanList();
    app().store.commit('점검용: 시험 엔진 결과', (x) => { x.plan = plan.map((p) => ({ match: p.match, calendar: p.calendar })); }, { tags: ['plan'], undo: false });
    S.afterRun(D().ex, { elapsed: 31000, startedAt: Date.now() - 60000 }, '개선 없음');
  });
})();
