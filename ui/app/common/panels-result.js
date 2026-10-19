/*
 * 화면 공통 — 결과 패널: 점수 배지(FR-V4), 엔진 실행(FR-R3·R4·V1), 검토·사전 점검(FR-R1·R2), 위반 목록(FR-V5),
 * 월간 캘린더(FR-V2·V3), 슬롯 목록·구단×슬롯 매트릭스(FR-V6), 미배정 풀(FR-M8), 실행 취소(FR-M6),
 * 드래그 앤 드롭 + Δ 미리보기 + 키보드 이동(FR-M1·M2).
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const P = UI.panels || (UI.panels = {});
  const { esc, fmt, on } = UI;
  const { Dates, Score, Reschedule } = KBO;

  const RULE_ICON = { 'H0-a': '👥', 'H0-b': '🏟', 'H0-c': '#', 'H0-d': '↔', 'H0-e': '🏠', 'H0-f': '⟳', H1: '⇉' };
  P.RULE_ICON = RULE_ICON;

  // ───────────── 드래그 앤 드롭 공통 ─────────────
  let tip = null;
  function showTip(x, y, html) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'k-dragtip'; tip.setAttribute('aria-hidden', 'true'); document.body.appendChild(tip); }
    tip.innerHTML = html; tip.style.left = (x + 14) + 'px'; tip.style.top = (y + 14) + 'px'; tip.hidden = false;
  }
  function hideTip() { if (tip) tip.hidden = true; }
  function deltaHtml(app, pv) {
    const d = pv.delta;
    const hard = d[0] + d[1];
    const softTxt = KBO.Score.SOFT_RULES.map((r, i) => (d[2 + i] ? r.code + ' ' + (d[2 + i] > 0 ? '+' : '') + d[2 + i].toLocaleString('ko-KR') : '')).filter(Boolean).join(' · ');
    return '<b class="' + (hard > 0 ? 'k-up' : hard < 0 ? 'k-down' : '') + '">' + (hard > 0 ? '▲ 개선' : hard < 0 ? '▼ 악화' : '＝') + ' Hard Δ ' + (hard > 0 ? '+' : '') + hard + '</b><br><span class="k-small">' + (softTxt || 'Soft 변화 없음') + '</span>';
  }

  /**
   * 컨테이너 안의 [data-match] 요소를 끌어서 [data-drop-slot] 또는 다른 [data-match] 위에 놓는다.
   * 키보드: 시리즈에서 Enter/Space → 선택, 대상 슬롯([data-drop-slot]) 또는 시리즈에서 Enter → 이동/교환.
   */
  UI.enableDnd = function (el, app) {
    let dragM = null, lastKey = null, lastPv = null;
    on(el, 'dragstart', '[data-match][draggable=true]', (e, n) => {
      if (app.isRunning()) { e.preventDefault(); UI.toast('엔진 실행 중에는 수정할 수 없습니다.', 'warn'); return; }
      dragM = Number(n.dataset.match);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragM));
      el.classList.add('k-dragging');
    });
    on(el, 'dragend', '[data-match]', () => { dragM = null; hideTip(); el.classList.remove('k-dragging'); UI.$$('.k-drop-hover', el).forEach((x) => x.classList.remove('k-drop-hover')); });
    el.addEventListener('dragover', (e) => {
      if (dragM == null) return;
      const tm = e.target.closest('[data-match]');
      const ts = e.target.closest('[data-drop-slot]');
      if (!tm && !ts) return;
      e.preventDefault();
      const targetMatch = tm && Number(tm.dataset.match) !== dragM ? Number(tm.dataset.match) : null;
      const slot = ts ? Number(ts.dataset.dropSlot) : (targetMatch != null ? app.derived().plan[targetMatch] : -1);
      const key = targetMatch != null ? 'm' + targetMatch : 's' + slot;
      if (key !== lastKey) {
        lastKey = key;
        UI.$$('.k-drop-hover', el).forEach((x) => x.classList.remove('k-drop-hover'));
        (tm && targetMatch != null ? tm : ts).classList.add('k-drop-hover');
        lastPv = app.previewDrop(dragM, slot, targetMatch);
      }
      showTip(e.clientX, e.clientY, (targetMatch != null ? '⇄ 교환: ' + esc(app.matchLabel(targetMatch)) : slot < 0 ? '⤓ 미배정 풀로' : '→ ' + esc(app.derived().slots[slot].label)) + '<br>' + deltaHtml(app, lastPv));
    });
    el.addEventListener('drop', (e) => {
      if (dragM == null) return;
      e.preventDefault();
      const tm = e.target.closest('[data-match]');
      const ts = e.target.closest('[data-drop-slot]');
      const targetMatch = tm && Number(tm.dataset.match) !== dragM ? Number(tm.dataset.match) : null;
      const slot = ts ? Number(ts.dataset.dropSlot) : -1;
      const m = dragM;
      dragM = null; lastKey = null; hideTip();
      if (targetMatch == null && !ts) return;
      app.drop(m, slot, targetMatch);
    });
    // 선택 후 클릭으로 이동/교환 (마우스로도 쓰는 키보드 대안 경로)
    el.addEventListener('click', (e) => {
      const sel = app.ui.selectedMatch;
      if (sel == null || e.target.closest('button,[data-act],input,select')) return;
      const tm = e.target.closest('[data-match]');
      const ts = e.target.closest('[data-drop-slot]');
      if (tm) { const m = Number(tm.dataset.match); e.stopPropagation(); app.selectMatch(null); if (m !== sel) app.drop(sel, -1, m); }
      else if (ts) { e.stopPropagation(); app.selectMatch(null); app.drop(sel, Number(ts.dataset.dropSlot), null); }
    }, true);
    // 키보드 대안
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tm = e.target.closest('[data-match]');
      const ts = e.target.closest('[data-drop-slot]');
      const sel = app.ui.selectedMatch;
      if (tm && !e.target.closest('[data-act]')) {
        e.preventDefault();
        const m = Number(tm.dataset.match);
        if (sel == null || sel === m) { app.selectMatch(sel === m ? null : m); if (sel !== m) UI.toast('선택: ' + app.matchLabel(m) + ' — 대상 슬롯 또는 교환할 시리즈에서 Enter. Esc로 취소.', 'info'); }
        else { app.selectMatch(null); app.drop(sel, -1, m); }
      } else if (ts && sel != null && e.target === ts) {
        e.preventDefault();
        app.selectMatch(null);
        app.drop(sel, Number(ts.dataset.dropSlot), null);
      }
    });
  };

  /** 시리즈 칩 (공통 표기). opts: { game, filter, compact, showSlot } */
  P.chip = function (app, m, opts) {
    const o = opts || {};
    const c = app.derived();
    const st = app.state;
    const x = st.matches[m];
    const home = c.teamByName.get(x.home) || {}, away = c.teamByName.get(x.away) || {};
    const flags = c.ex.matchFlags[m] || [];
    const f = app.ui.teamFilter;
    let rel = '';
    let dim = false;
    if (f.size) {
      const inH = f.has(x.home), inA = f.has(x.away);
      dim = !inH && !inA;
      if (f.size === 1) rel = inH ? '<span class="k-ha k-ha-h" title="홈">🏠</span>' : inA ? '<span class="k-ha k-ha-a" title="원정">✈</span>' : '';
    }
    const g = o.game;
    const status = g ? g.status : 'SCHEDULED';
    const cls = ['k-sc'];
    if (flags.length) cls.push('k-viol');
    if (x.pinned) cls.push('k-pinned');
    if (dim) cls.push('k-dim');
    if (app.ui.selectedMatch === m) cls.push('k-selected');
    if (status === 'CANCELLED') cls.push('k-cancelled');
    if (status === 'PLAYED') cls.push('k-played');
    if (o.compact) cls.push('k-sc-compact');
    const title = x.away + ' @ ' + x.home + ' · ' + (home.stadium || '') + ' · ' + x.consecutive + '연전' + (x.pinned ? ' · 고정' : '') + (flags.length ? ' · 위반: ' + flags.map((cd) => cd + ' ' + Score.RULE_BY_CODE[cd].label).join(', ') : '') + (g ? ' · ' + Reschedule.STATUS[status] + (g.reason ? '(' + Reschedule.REASONS[g.reason] + ')' : '') : '');
    return '<span class="' + cls.join(' ') + '" data-match="' + m + '" draggable="' + (!x.pinned && !app.isRunning()) + '" tabindex="0" role="button" aria-label="' + esc(title) + '" title="' + esc(title) + '">' + rel +
      (flags.length ? '<span class="k-viol-ic" aria-hidden="true">⚠</span>' : '') + (x.pinned ? '<span aria-hidden="true">📌</span>' : '') +
      '<span class="k-t" style="--tc:' + esc(away.color || '#666') + '">' + esc(x.away) + '</span><span class="k-at">@</span><span class="k-t k-t-home" style="--tc:' + esc(home.color || '#666') + '">' + esc(x.home) + '</span>' +
      (o.showLen && x.consecutive !== 3 ? '<span class="k-len">' + x.consecutive + '</span>' : '') +
      (status === 'CANCELLED' ? '<span class="k-st" aria-hidden="true">☂</span>' : status === 'PLAYED' ? '<span class="k-st" aria-hidden="true">✔</span>' : '') + '</span>';
  };

  // ───────────── 점수 배지 (FR-V4) ─────────────
  P.badge = function (el, app, opts) {
    const o = opts || {};
    const render = () => {
      const c = app.derived();
      const ex = c.ex;
      const hardItems = ex.violations.length;
      const hardAmt = -(ex.score.hard[0] + ex.score.hard[1]);
      const mode = app.state.settings.h0eMode === 'ENGINE' ? '엔진 호환' : '구장 기준';
      const run = app.run && app.isRunning() ? '<span class="k-badge-run" role="status">⟳ ' + (app.run.mode === 'RESCHEDULE' ? '재편성' : '엔진') + ' 실행 중 · ' + (app.run.elapsedMs / 1000).toFixed(1) + 's</span>' : '';
      el.innerHTML = '<div class="k-badge ' + (ex.feasible ? 'k-badge-ok' : 'k-badge-bad') + '" role="status" aria-live="polite">' +
        (ex.feasible ? '<span class="k-badge-ic" aria-hidden="true">✔</span><span class="k-badge-main">편성 가능 <small>(Feasible)</small></span>' : '<span class="k-badge-ic" aria-hidden="true">✖</span><span class="k-badge-main">Hard 위반 ' + hardItems + '건 <small>(감점 ' + hardAmt + ')</small></span>') +
        (o.compact ? '' : '<span class="k-badge-score" title="BendableLongScore">' + esc(Score.scoreString(ex.score)) + '</span>') +
        '<button class="k-badge-mode" data-act="mode" title="H0-e 채점 모드 전환">H0-e: ' + mode + '</button>' + run + '</div>';
    };
    on(el, 'click', '[data-act=mode]', () => app.setH0eMode(app.state.settings.h0eMode === 'ENGINE' ? 'STADIUM' : 'ENGINE'));
    return UI.mount(el, app, render, ['plan', 'pins', 'settings', 'run', 'calendar', 'matches', 'events', 'teams', 'distance']);
  };

  // ───────────── 엔진 실행 (FR-R3, R4, V1) ─────────────
  P.solver = function (el, app, opts) {
    const o = opts || {};
    const mode = o.mode || 'INITIAL';
    let lastRender = 0;
    let pending = null;
    const render = () => {
      const s = app.state.settings.solver;
      const run = app.run && app.run.mode === mode ? app.run : null;
      const running = app.isRunning();
      const mine = run && running;
      const st = run ? run.status : 'IDLE';
      const statusText = { IDLE: '대기', STARTING: '시작 중', RUNNING: '실행 중', PAUSED: '일시정지', DONE: '완료', ERROR: '오류' }[st] || st;
      let h = '<div class="k-solver">';
      h += '<div class="k-mock-note">' + (app.engine.kind === 'MOCK' ? '🧪 <b>시뮬레이션 엔진</b> — 브라우저 Mock 로컬서치이며 결과 품질을 보장하지 않습니다.' : '🛰 ' + esc(app.engine.label)) + '</div>';
      h += '<div class="k-grid-4"><label class="k-field"><span>최대 실행 시간 (초)</span><input class="k-input" type="number" min="1" data-o="timeLimitSec" value="' + esc(s.timeLimitSec) + '"' + (running ? ' disabled' : '') + '></label>' +
        '<label class="k-field"><span>개선 없음 종료 (초)</span><input class="k-input" type="number" min="1" data-o="unimprovedSec" value="' + esc(s.unimprovedSec) + '"' + (running ? ' disabled' : '') + '></label>' +
        '<label class="k-field"><span>초기해</span><select class="k-input" data-o="init"' + (running ? ' disabled' : '') + '><option value="KEEP"' + (s.init !== 'SCRATCH' ? ' selected' : '') + '>현재 배정 유지</option><option value="SCRATCH"' + (s.init === 'SCRATCH' ? ' selected' : '') + '>처음부터 (핀 제외)</option></select></label>' +
        '<label class="k-field"><span>시드</span><input class="k-input" type="number" data-o="seed" value="' + esc(s.seed) + '"' + (running ? ' disabled' : '') + '></label></div>';
      h += '<div class="k-toolbar">' +
        (mine ? (st === 'PAUSED' ? '<button class="k-btn k-btn-primary" data-act="resume">▶ 계속</button>' : '<button class="k-btn" data-act="pause">⏸ 일시정지</button>') + '<button class="k-btn k-btn-danger" data-act="stop">■ 중지</button>'
          : '<button class="k-btn k-btn-primary k-btn-lg" data-act="run"' + (running ? ' disabled' : '') + '>▶ ' + (mode === 'RESCHEDULE' ? '재편성 실행' : (o.runLabel || '엔진 실행')) + '</button>') +
        '<span class="k-chip k-chip-' + (st === 'RUNNING' ? 'info' : st === 'DONE' ? 'ok' : st === 'ERROR' ? 'bad' : 'warn') + '">' + statusText + (run && run.reason && st !== 'RUNNING' ? ' · ' + esc({ TIME_LIMIT: '시간 제한', UNIMPROVED: '개선 없음', STOPPED: '중지됨' }[run.reason] || run.reason) : '') + '</span>' +
        (run && run.transport ? '<span class="k-muted k-small">' + (run.transport === 'worker' ? 'Web Worker' : '메인 스레드 time-slicing') + '</span>' : '') + '</div>';
      if (run) {
        const hist = run.history.map((x) => x.score[0] + x.score[1]);
        const soft = run.history.map((x) => x.score.slice(2).reduce((a, b, i) => a + b / Math.pow(10, i * 2), 0));
        h += '<div class="k-runstats"><div><span class="k-muted">경과</span><b>' + (run.elapsedMs / 1000).toFixed(1) + 's</b></div><div><span class="k-muted">개선 횟수</span><b>' + run.improvements + '</b></div><div><span class="k-muted">탐색 이동</span><b>' + (run.iterations || 0).toLocaleString('ko-KR') + '</b></div>' +
          '<div class="k-spark"><span class="k-muted">Hard 추이</span>' + KBO.Chart.sparkline(hist, { width: 150, height: 34, color: 'var(--bad)', title: 'Hard 점수 추이' }) + '</div><div class="k-spark"><span class="k-muted">Soft 추이</span>' + KBO.Chart.sparkline(soft, { width: 150, height: 34, title: 'Soft 점수 추이' }) + '</div></div>' +
          (run.score ? '<div class="k-mono k-small">최고 해: ' + esc(Score.scoreString(run.score)) + '</div>' : '');
      }
      el.innerHTML = h + '</div>';
    };
    // 실행 중 잦은 갱신은 250ms로 묶는다
    const throttled = () => {
      const now = Date.now();
      if (now - lastRender > 200) { lastRender = now; render(); }
      else if (!pending) pending = setTimeout(() => { pending = null; lastRender = Date.now(); render(); }, 220);
    };
    on(el, 'change', '[data-o]', (e, i) => app.updateSolverSettings({ [i.dataset.o]: i.tagName === 'SELECT' ? i.value : Number(i.value) }));
    on(el, 'click', '[data-act]', (e, b) => {
      const a = b.dataset.act;
      if (a === 'run') app.solve({ mode });
      else if (a === 'pause') app.pause();
      else if (a === 'resume') app.resume();
      else if (a === 'stop') app.stop();
    });
    render();
    const off = app.subscribe((ch) => { if (ch.tags.has('run') || ch.tags.has('live') || ch.tags.has('settings') || ch.tags.has('all')) throttled(); });
    return { refresh: render, destroy: off };
  };

  // ───────────── 검토·사전 점검 (FR-R1, R2) ─────────────
  P.review = function (el, app, opts) {
    const o = opts || {};
    const render = () => {
      const st = app.state;
      const c = app.derived();
      const s = st.settings;
      const shared = app.sharedStadiums();
      const sh = KBO.CalendarGen.lengthHistogram(st.calendar);
      const pf = app.preflight();
      const evM = st.events.filter((e) => e.mode === 'MATCH'), evS = st.events.filter((e) => e.mode === 'STADIUM');
      const rows = [
        ['구단 수', st.teams.length + '개', 'teams'],
        ['공유 구장', shared.size ? Array.from(shared).map(([k, v]) => esc(k) + ' (' + esc(v.join('·')) + ')').join(', ') : '없음', 'teams'],
        ['시즌 기간', fmt.date(s.seasonStart) + ' ~ ' + fmt.date(s.seasonEnd) + ' · 1차 편성 ~ ' + fmt.date(s.initialEnd), 'season'],
        ['슬롯', st.calendar.length + '개 · ' + Object.keys(sh).sort().map((k) => k + '연전 ' + sh[k]).join(' / '), 'slots'],
        ['경기 없는 기간', s.blackouts.map((b) => esc(b.label || '') + ' ' + fmt.short(b.start) + (b.end !== b.start ? '~' + fmt.short(b.end) : '')).join(', ') || '없음', 'season'],
        ['휴식', '휴식 요일 ' + s.restWeekdays.map((w) => Dates.WEEKDAY_KO[w]).join('·') + ' · 예외 ' + (s.restExceptions.map(fmt.short).join(', ') || '없음'), 'season'],
        ['이벤트', st.events.length + '개 — 대진 지정 ' + evM.length + ' · 구장 지정 ' + evS.length + ' (' + Array.from(new Set(st.events.map((e) => e.name))).map(esc).join(', ') + ')', 'events'],
        ['시리즈', st.matches.length + '개 · ' + st.matches.reduce((a, b) => a + b.consecutive, 0) + '경기 · 구단쌍 ' + s.initialGamesPerPair + '경기 (목표 ' + s.gamesPerPair + ')', 'series'],
        ['현재 배정', (st.matches.length - c.pool.length) + '/' + st.matches.length + ' 배정 · 고정 ' + st.matches.filter((m) => m.pinned).length + '개', 'result']
      ];
      let h = '<div class="k-review"><table class="k-table k-summary"><tbody>' + rows.map(([k, v, t]) => '<tr><th>' + k + '</th><td>' + v + '</td><td><button class="k-link" data-nav="' + t + '">수정 →</button></td></tr>').join('') + '</tbody></table>';
      h += '<h4 class="k-subhead">사전 점검 (Pre-flight) ' + UI.stateChip(pf.ok ? (pf.counts.warn ? 'warn' : 'ok') : 'block', pf.ok ? '실행 가능 · 경고 ' + pf.counts.warn : '차단 ' + pf.counts.block + '건') + '</h4><ul class="k-preflight">';
      for (const it of pf.items) {
        h += '<li class="k-pf-' + it.status + '">' + UI.stateChip(it.status === 'pass' ? 'ok' : it.status === 'warn' ? 'warn' : 'block', it.status === 'pass' ? '통과' : it.status === 'warn' ? '경고' : '차단') + ' <b>' + esc(it.title) + '</b> <span>' + esc(it.detail) + '</span> <button class="k-link" data-nav="' + it.target + '">입력 화면 →</button></li>';
      }
      h += '</ul></div>';
      if (o.withSolver) h += '<div class="k-review-solver"></div>';
      el.innerHTML = h;
    };
    on(el, 'click', '[data-nav]', (e, b) => app.nav(b.dataset.nav));
    return UI.mount(el, app, render, ['all', 'teams', 'distance', 'settings', 'calendar', 'matches', 'events', 'pins', 'plan']);
  };

  // ───────────── 위반 목록 (FR-V5) ─────────────
  P.violations = function (el, app, opts) {
    const o = opts || {};
    const open = new Set(o.open || []);
    const render = () => {
      const ex = o.reschedule ? app.rescheduleExplain() : app.derived().ex;
      if (!ex) { el.innerHTML = '<p class="k-muted">재편성 결과가 없습니다.</p>'; return; }
      const rules = o.reschedule ? Reschedule.HARD_RULES : Score.HARD_RULES;
      let h = '<div class="k-viols">';
      for (const r of rules) {
        const b = ex.byCode[r.code];
        const items = ex.violations.filter((v) => v.code === r.code);
        const isOpen = open.has(r.code) || (o.autoOpen && items.length && items.length <= 6);
        h += '<details class="k-vrule' + (items.length ? ' k-vrule-bad' : ' k-vrule-ok') + '"' + (isOpen ? ' open' : '') + ' data-code="' + r.code + '"><summary><span class="k-vcode">' + (items.length ? '<span aria-hidden="true">⚠</span> ' : '<span aria-hidden="true">✔</span> ') + r.code + '</span> <span class="k-vlabel">' + esc(r.label) + '</span> <span class="k-vcount">' + (items.length ? b.count + '건 · 감점 ' + b.amount : '0') + '</span><span class="k-vlevel">Hard ' + r.level + '</span></summary>' +
          '<p class="k-small k-muted">' + esc(r.desc) + '</p>' + (items.length ? '<ul>' + items.slice(0, 200).map((v) => '<li><button class="k-vitem" data-vid="' + v.id + '">' + esc(v.message) + (v.amount > 1 ? ' <b>(' + v.amount + ')</b>' : '') + '</button></li>').join('') + (items.length > 200 ? '<li class="k-muted">… 외 ' + (items.length - 200) + '건</li>' : '') + '</ul>' : '') + '</details>';
      }
      el.innerHTML = h + '</div>';
    };
    el.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.code) { if (d.open) open.add(d.dataset.code); else open.delete(d.dataset.code); } }, true);
    on(el, 'click', '[data-vid]', (e, b) => {
      const ex = o.reschedule ? app.rescheduleExplain() : app.derived().ex;
      const v = ex.violations.find((x) => x.id === b.dataset.vid);
      if (!v) return;
      app.focus({ slot: v.slot, match: v.matches && v.matches[0], matches: v.matches, date: v.date, units: v.units, code: v.code, team: v.teams && v.teams[0] });
    });
    return UI.mount(el, app, render, o.reschedule ? ['reschedule', 'games', 'all'] : ['plan', 'pins', 'settings', 'calendar', 'matches', 'events', 'teams', 'distance']);
  };

  // ───────────── 월간 캘린더 (FR-V2, V3, V4, M1) ─────────────
  /**
   * opts: { months:[3..10], large, onDayClick(date, e), dayExtra(date) → { cls, html }, showFilter, showLegend,
   *         maxChips, initialMonth, onSeriesClick(m, el) }
   */
  P.calendar = function (el, app, opts) {
    const o = opts || {};
    const months = () => {
      const s = app.state.settings;
      const a = Dates.month(s.seasonStart), b = Dates.month(s.seasonEnd);
      const out = [];
      for (let m = a; m <= b; m++) out.push(m);
      return out;
    };
    if (app.ui.month == null) app.ui.month = o.initialMonth || Dates.month(app.state.settings.seasonStart);
    const render = () => {
      const st = app.state;
      const c = app.derived();
      const year = Number(st.settings.seasonStart.slice(0, 4));
      const ms = months();
      if (!ms.includes(app.ui.month)) app.ui.month = ms[0];
      const mon = app.ui.month;
      const first = Dates.dayNum(year + '-' + String(mon).padStart(2, '0') + '-01');
      const nextFirst = Dates.dayNum((mon === 12 ? year + 1 : year) + '-' + String(mon === 12 ? 1 : mon + 1).padStart(2, '0') + '-01');
      const initialEnd = Dates.dayNum(st.settings.initialEnd);
      const holidays = new Map((st.settings.holidays || []).map((x) => [Dates.dayNum(x.date), x.name]));
      const black = Dates.expandRanges(st.settings.blackouts);
      const rsBlack = Dates.expandRanges(st.reschedule.blackouts || []);
      const games = app.games();
      const byDay = new Map();
      for (const g of games) { if (g.day < first || g.day >= nextFirst) continue; if (!byDay.has(g.day)) byDay.set(g.day, []); byDay.get(g.day).push(g); }
      const ref = Dates.dayNum(app.referenceDate());
      const focus = app.ui.focus;
      const focusMatches = new Set(focus && focus.matches ? focus.matches : focus && focus.match != null ? [focus.match] : []);
      let h = '<div class="k-cal' + (o.large ? ' k-cal-large' : '') + '">';
      h += '<div class="k-cal-head"><button class="k-btn k-btn-icon" data-act="prev" aria-label="이전 달"' + (mon <= ms[0] ? ' disabled' : '') + '>◀</button><h3 class="k-cal-title">' + year + '년 ' + mon + '월</h3><button class="k-btn k-btn-icon" data-act="next" aria-label="다음 달"' + (mon >= ms[ms.length - 1] ? ' disabled' : '') + '>▶</button>' +
        '<div class="k-cal-months" role="tablist">' + ms.map((m) => '<button role="tab" class="k-mtab' + (m === mon ? ' k-on' : '') + '" aria-selected="' + (m === mon) + '" data-month="' + m + '">' + m + '월</button>').join('') + '</div></div>';
      if (o.showFilter !== false) {
        h += '<div class="k-cal-filter" role="group" aria-label="구단 필터"><span class="k-muted k-small">구단 필터</span>' + st.teams.map((t) => '<button class="k-fbtn' + (app.ui.teamFilter.has(t.name) ? ' k-on' : '') + '" aria-pressed="' + app.ui.teamFilter.has(t.name) + '" data-filter="' + esc(t.name) + '" style="--tc:' + esc(t.color) + '">' + esc(t.name) + '</button>').join('') + (app.ui.teamFilter.size ? '<button class="k-link" data-act="clearfilter">필터 해제</button>' : '') + '</div>';
      }
      if (app.ui.selectedMatch != null) h += '<div class="k-banner k-banner-info" role="status">⌨ 선택: <b>' + esc(app.matchLabel(app.ui.selectedMatch)) + '</b> — 대상 날짜에서 Enter(이동) 또는 다른 시리즈에서 Enter(교환). <button class="k-link" data-act="unselect">취소 (Esc)</button></div>';
      h += '<div class="k-cal-grid" role="grid" aria-label="' + mon + '월 일정">' + Dates.WEEKDAY_KO.map((w, i) => '<div class="k-cal-wd' + (i === 0 ? ' k-sun' : i === 6 ? ' k-sat' : '') + '" role="columnheader">' + w + '</div>').join('');
      const lead = Dates.weekday(first);
      for (let i = 0; i < lead; i++) h += '<div class="k-cal-day k-cal-pad" aria-hidden="true"></div>';
      for (let d = first; d < nextFirst; d++) {
        const si = c.dayToSlot.has(d) ? c.dayToSlot.get(d) : -1;
        const dayGames = byDay.get(d) || [];
        const wd = Dates.weekday(d);
        const zone = d <= initialEnd ? 'k-zone-initial' : 'k-zone-re';
        const cls = ['k-cal-day', zone];
        if (wd === 0) cls.push('k-sun'); if (wd === 6) cls.push('k-sat');
        if (holidays.has(d)) cls.push('k-hol');
        if (black.has(d) || rsBlack.has(d)) cls.push('k-black');
        const slotHard = si >= 0 ? c.ex.slotHard[si] : 0;
        if (slotHard) cls.push('k-slot-viol');
        if (si >= 0 && c.slots[si].day === d) cls.push('k-slot-start');
        if (focus && focus.slot === si && si >= 0) cls.push('k-focus');
        if (focus && focus.date && Dates.dayNum(focus.date) === d) cls.push('k-focus');
        const extra = o.dayExtra ? o.dayExtra(d) : null;
        if (extra && extra.cls) cls.push(extra.cls);
        const overdue = dayGames.filter((g) => g.status === 'SCHEDULED' && d < ref).length;
        h += '<div class="' + cls.join(' ') + '" role="gridcell" data-date="' + Dates.isoDate(d) + '"' + (si >= 0 ? ' data-drop-slot="' + si + '" tabindex="' + (app.ui.selectedMatch != null ? 0 : -1) + '" aria-label="' + esc(fmt.date(d) + ' ' + c.slots[si].label + (slotHard ? ' 위반 ' + slotHard : '')) + '"' : '') + '>';
        h += '<div class="k-cal-dh"><span class="k-cal-dn">' + new Date(d * Dates.DAY_MS).getUTCDate() + '</span>' +
          (holidays.has(d) ? '<span class="k-hol-name" title="' + esc(holidays.get(d)) + '">' + esc(holidays.get(d)) + '</span>' : '') +
          (black.has(d) ? '<span class="k-black-tag" title="경기 없는 기간">휴</span>' : '') +
          (si >= 0 && c.slots[si].day === d ? '<span class="k-slot-tag" title="' + esc(c.slots[si].label + ' · 주말 ' + c.slots[si].weekend + ' · 휴일 가중치 ' + c.slots[si].holiday) + '">' + c.slots[si].consecutive + '연전' + (c.slots[si].holiday ? ' ·' + c.slots[si].holiday : '') + '</span>' : '') +
          (slotHard && c.slots[si].day === d ? '<span class="k-viol-tag" title="슬롯 Hard 감점 ' + slotHard + '">⚠ ' + slotHard + '</span>' : '') +
          (overdue ? '<span class="k-overdue" title="결과 미입력 ' + overdue + '경기">⏰' + overdue + '</span>' : '') +
          (extra && extra.html ? extra.html : '') + '</div><div class="k-cal-games">';
        const maxC = o.maxChips || 99;
        dayGames.slice(0, maxC).forEach((g) => {
          if (g.source === 'INITIAL') {
            let chipHtml = P.chip(app, g.match, { game: g, showLen: true });
            if (focusMatches.has(g.match)) chipHtml = chipHtml.replace('class="k-sc', 'class="k-sc k-focus');
            h += chipHtml;
          } else {
            const ht = c.teamByName.get(g.home) || {}, at = c.teamByName.get(g.away) || {};
            const sel = app.ui.selectedUnit === g.unit;
            h += '<span class="k-sc k-sc-re' + (g.status === 'CANCELLED' ? ' k-cancelled' : g.status === 'PLAYED' ? ' k-played' : '') + (sel ? ' k-selected' : '') + (focus && focus.units && focus.units.includes(g.unit) ? ' k-focus' : '') + '" data-unit="' + esc(g.unit) + '" tabindex="0" role="button" title="' + esc('재편성 · ' + g.away + ' @ ' + g.home + (g.dh ? ' · 더블헤더' : '') + ' · ' + Reschedule.STATUS[g.status]) + '"><span class="k-re-tag">재</span>' + (g.dh ? '<span class="k-dh">DH</span>' : '') + '<span class="k-t" style="--tc:' + esc(at.color || '#666') + '">' + esc(g.away) + '</span><span class="k-at">@</span><span class="k-t k-t-home" style="--tc:' + esc(ht.color || '#666') + '">' + esc(g.home) + '</span>' + (g.status === 'CANCELLED' ? '<span class="k-st">☂</span>' : g.status === 'PLAYED' ? '<span class="k-st">✔</span>' : '') + '</span>';
          }
        });
        if (dayGames.length > maxC) h += '<span class="k-more">+' + (dayGames.length - maxC) + '</span>';
        h += '</div></div>';
      }
      h += '</div>';
      if (o.showLegend !== false) h += '<div class="k-cal-legend k-small"><span class="k-lg k-lg-initial"></span> 1차 편성 구간 <span class="k-lg k-lg-re"></span> 재편성 구간 <span class="k-sc k-viol k-sc-demo"><span class="k-viol-ic">⚠</span>위반</span> <span class="k-sc k-pinned k-sc-demo">📌 고정</span> <span class="k-sc k-cancelled k-sc-demo">취소 ☂</span> <span class="k-sc k-played k-sc-demo">완료 ✔</span> <span class="k-sc k-sc-re k-sc-demo"><span class="k-re-tag">재</span>재편성</span> <span>🏠 홈 ✈ 원정 (구단 1개 필터 시)</span></div>';
      el.innerHTML = h + '</div>';
    };
    on(el, 'click', '[data-act]', (e, b) => {
      const a = b.dataset.act;
      const ms = months();
      if (a === 'prev') { app.ui.month = Math.max(ms[0], app.ui.month - 1); render(); }
      else if (a === 'next') { app.ui.month = Math.min(ms[ms.length - 1], app.ui.month + 1); render(); }
      else if (a === 'clearfilter') app.setTeamFilter([]);
      else if (a === 'unselect') app.selectMatch(null);
    });
    on(el, 'click', '[data-month]', (e, b) => { app.ui.month = Number(b.dataset.month); render(); });
    on(el, 'click', '[data-filter]', (e, b) => app.toggleTeamFilter(b.dataset.filter));
    on(el, 'click', '.k-cal-day[data-date]', (e, d) => {
      if (e.target.closest('[data-match],[data-unit],button')) return;
      if (app.ui.selectedMatch != null && d.dataset.dropSlot != null) { const m = app.ui.selectedMatch; app.selectMatch(null); app.drop(m, Number(d.dataset.dropSlot), null); return; }
      if (o.onDayClick) o.onDayClick(d.dataset.date, e);
    });
    on(el, 'click', '[data-match]', (e, n) => { if (o.onSeriesClick) o.onSeriesClick(Number(n.dataset.match), n, e); });
    on(el, 'click', '[data-unit]', (e, n) => { if (o.onUnitClick) o.onUnitClick(n.dataset.unit, n, e); });
    UI.enableDnd(el, app);
    const m = UI.mount(el, app, render, ['plan', 'pins', 'games', 'reschedule', 'calendar', 'filter', 'select', 'focus', 'settings', 'matches', 'events', 'teams', 'run']);
    // 포커스 이동 시 해당 달로 전환
    app.subscribe((ch) => {
      if (!ch.tags.has('focus') || !ch.focus) return;
      const f = ch.focus;
      let day = null;
      if (f.date) day = Dates.dayNum(f.date);
      else if (f.slot != null && f.slot >= 0) day = app.derived().slots[f.slot].day;
      if (day != null) { app.ui.month = Dates.month(day); render(); const n = el.querySelector('.k-focus'); if (n) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
    return m;
  };

  /** 시리즈 상세 팝업: 위반, 고정, 이동 선택, 경기 상태 */
  P.seriesDialog = function (app, m) {
    const c = app.derived();
    const st = app.state;
    const x = st.matches[m];
    const s = c.plan[m];
    const flags = c.ex.violations.filter((v) => (v.matches || []).includes(m));
    const games = app.games().filter((g) => g.match === m);
    const body = '<p>' + P.chip(app, m) + ' · ' + esc((c.teamByName.get(x.home) || {}).stadium || '') + ' · ' + x.consecutive + '연전 · ' + (s >= 0 ? esc(c.slots[s].label) : '미배정') + '</p>' +
      (flags.length ? '<h4>위반</h4><ul>' + flags.map((v) => '<li>' + (RULE_ICON[v.code] || '⚠') + ' <b>' + v.code + ' ' + esc(v.label) + '</b> — ' + esc(v.message) + '</li>').join('') + '</ul>' : '<p>' + UI.stateChip('ok', '이 시리즈 관련 Hard 위반 없음') + '</p>') +
      (games.length ? '<h4>경기</h4><ul class="k-plain">' + games.map((g) => '<li>' + fmt.date(g.date) + ' — ' + Reschedule.STATUS[g.status] + (g.reason ? ' (' + Reschedule.REASONS[g.reason] + ')' : '') + '</li>').join('') + '</ul>' : '');
    return UI.dialog({
      title: x.away + ' @ ' + x.home, body,
      actions: [{ label: '닫기', value: null }, { label: x.pinned ? '📌 고정 해제' : '📌 고정', value: 'pin' }, { label: '⌨ 이동할 슬롯 선택', value: 'select' }, { label: '미배정 풀로', value: 'pool' }]
    }).then((v) => {
      if (v === 'pin') app.togglePin(m);
      else if (v === 'select') { app.selectMatch(m); UI.toast('대상 날짜·슬롯을 클릭하거나 Enter로 이동합니다. Esc로 취소.', 'info'); }
      else if (v === 'pool') app.moveMatch(m, -1);
    });
  };

  // ───────────── 슬롯 목록 (FR-V6) ─────────────
  P.slotList = function (el, app, opts) {
    const o = opts || {};
    const render = () => {
      const c = app.derived();
      let h = '<div class="k-slotlist">';
      c.slots.forEach((s, i) => {
        const hard = c.ex.slotHard[i];
        const ms = c.bySlot[i];
        const allPinned = ms.length && ms.every((m) => app.state.matches[m].pinned);
        h += '<div class="k-slotrow' + (hard ? ' k-slot-viol' : '') + (app.ui.focus && app.ui.focus.slot === i ? ' k-focus' : '') + '" data-drop-slot="' + i + '" tabindex="0" aria-label="' + esc(s.label + (hard ? ', 위반 ' + hard : '')) + '">' +
          '<div class="k-slothead"><b>' + esc(s.label) + '</b><span class="k-muted k-small">주말 ' + s.weekend + ' · 휴일 ' + s.holiday + '</span>' + (hard ? '<span class="k-viol-tag">⚠ ' + hard + '</span>' : '<span class="k-ok-tag">✔</span>') +
          '<button class="k-btn k-btn-icon k-btn-ghost" data-pinslot="' + i + '" data-act="pin" title="' + (allPinned ? '슬롯 고정 해제' : '슬롯 일괄 고정') + '" aria-label="' + (allPinned ? '슬롯 고정 해제' : '슬롯 일괄 고정') + '">' + (allPinned ? '📌' : '📍') + '</button></div><div class="k-slotchips">' + ms.map((m) => P.chip(app, m, { showLen: true })).join('') + '</div></div>';
      });
      el.innerHTML = h + '</div>';
    };
    on(el, 'click', '[data-pinslot]', (e, b) => { const i = Number(b.dataset.pinslot); const ms = app.derived().bySlot[i]; app.pinSlot(i, !(ms.length && ms.every((m) => app.state.matches[m].pinned))); });
    on(el, 'click', '[data-match]', (e, n) => { if (o.onSeriesClick) o.onSeriesClick(Number(n.dataset.match), n, e); else P.seriesDialog(app, Number(n.dataset.match)); });
    UI.enableDnd(el, app);
    return UI.mount(el, app, render, ['plan', 'pins', 'calendar', 'filter', 'select', 'focus', 'settings', 'matches', 'events', 'teams', 'run']);
  };

  // ───────────── 구단 × 슬롯 매트릭스 (FR-V6) ─────────────
  P.teamSlotMatrix = function (el, app, opts) {
    const o = opts || {};
    const render = () => {
      const st = app.state;
      const c = app.derived();
      const N = st.teams.length;
      const cell = st.teams.map(() => c.slots.map(() => []));
      st.matches.forEach((x, m) => {
        const s = c.plan[m];
        if (s < 0) return;
        const h = c.teamIndex.get(x.home), a = c.teamIndex.get(x.away);
        if (h != null) cell[h][s].push(m);
        if (a != null && a !== h) cell[a][s].push(m);
      });
      let h = '<div class="k-table-wrap" data-scroll-key="tsm"><table class="k-tsm"><thead><tr><th class="k-tsm-corner">구단 \\ 슬롯</th>' + c.slots.map((s, i) => '<th class="' + (c.ex.slotHard[i] ? 'k-slot-viol' : '') + (s.weekend ? ' k-wkend' : '') + '" data-drop-slot="' + i + '" title="' + esc(s.label + ' · 휴일 가중치 ' + s.holiday) + '"><span>' + fmt.short(s.day) + '</span><small>' + s.consecutive + (c.ex.slotHard[i] ? ' ⚠' : '') + '</small></th>').join('') + (o.metrics !== false ? '<th>이동거리</th><th>이동</th><th>휴일</th>' : '') + '</tr></thead><tbody>';
      for (let t = 0; t < N; t++) {
        const team = st.teams[t];
        const tm = c.ex.teamMetrics[t];
        h += '<tr class="' + (app.ui.teamFilter.size && !app.ui.teamFilter.has(team.name) ? 'k-dim' : '') + '"><th>' + UI.teamChip(team) + '</th>';
        for (let s = 0; s < c.slots.length; s++) {
          const ms = cell[t][s];
          if (!ms.length) { h += '<td class="k-tsm-rest" data-drop-slot="' + s + '" title="휴식">·</td>'; continue; }
          const m = ms[0];
          const x = st.matches[m];
          const isHome = x.home === team.name;
          const opp = isHome ? x.away : x.home;
          const flags = ms.flatMap((k) => c.ex.matchFlags[k]);
          const v = tm.visits.find((vv) => vv.slot === s && vv.match === m);
          h += '<td class="k-tsm-cell ' + (isHome ? 'k-h' : 'k-a') + (flags.length ? ' k-viol' : '') + (ms.length > 1 ? ' k-multi' : '') + (x.pinned ? ' k-pinned' : '') + '" data-match="' + m + '" draggable="' + (!x.pinned && !app.isRunning()) + '" tabindex="0" title="' + esc(team.name + (isHome ? ' 홈 vs ' : ' 원정 @ ') + opp + ' · ' + c.slots[s].label + (v && v.legTenths ? ' · 이동 ' + fmt.km(v.legTenths / 10) + 'km' : '') + (flags.length ? ' · 위반 ' + flags.join(',') : '') + (ms.length > 1 ? ' · 같은 슬롯 ' + ms.length + '시리즈' : '')) + '">' +
            '<b>' + (isHome ? 'H' : 'A') + '</b><span>' + esc(opp.slice(0, 2)) + '</span>' + (flags.length ? '<i aria-hidden="true">⚠</i>' : '') + (v && v.legTenths ? '<em>' + Math.round(v.legTenths / 10) + '</em>' : '') + '</td>';
        }
        if (o.metrics !== false) h += '<td class="' + (tm.overDistance ? 'k-over' : '') + '">' + fmt.km(tm.distanceKm) + (tm.overDistance ? ' ▲' : '') + '</td><td class="' + (tm.overMoves ? 'k-over' : '') + '">' + tm.moves + (tm.overMoves ? ' ▲' : '') + '</td><td class="' + (tm.overHoliday ? 'k-over' : '') + '">' + tm.holidayWeight + (tm.overHoliday ? ' ▲' : '') + '</td>';
        h += '</tr>';
      }
      el.innerHTML = h + '</tbody></table></div><p class="k-small k-muted">H = 홈, A = 원정, 숫자 = 직전 장소에서 이동한 km. ⚠ = Hard 위반, ▲ = 엔진 허용오차 초과.</p>';
    };
    on(el, 'click', '[data-match]', (e, n) => { if (o.onSeriesClick) o.onSeriesClick(Number(n.dataset.match), n, e); else P.seriesDialog(app, Number(n.dataset.match)); });
    UI.enableDnd(el, app);
    return UI.mount(el, app, render, ['plan', 'pins', 'calendar', 'filter', 'select', 'focus', 'settings', 'matches', 'events', 'teams', 'distance', 'run']);
  };

  // ───────────── 미배정 풀 (FR-M8) ─────────────
  P.pool = function (el, app) {
    const render = () => {
      const c = app.derived();
      el.innerHTML = '<div class="k-pool" data-drop-slot="-1" tabindex="0" aria-label="미배정 풀 — 시리즈를 여기로 끌면 배정을 해제합니다"><div class="k-pool-head"><b>미배정 풀</b> <span class="k-muted">' + c.pool.length + '개 · S0 감점 ' + c.pool.length + '</span> <span class="k-small k-muted">여기로 끌어 빼고, 슬롯으로 끌어 넣습니다.</span></div><div class="k-slotchips">' + (c.pool.length ? c.pool.map((m) => P.chip(app, m, { showLen: true })).join('') : '<span class="k-muted k-small">비어 있음</span>') + '</div></div>';
    };
    on(el, 'click', '[data-match]', (e, n) => P.seriesDialog(app, Number(n.dataset.match)));
    UI.enableDnd(el, app);
    return UI.mount(el, app, render, ['plan', 'pins', 'matches', 'select', 'run']);
  };

  // ───────────── 실행 취소 바 (FR-M6) + 핀 도구 (FR-M4) ─────────────
  P.undoBar = function (el, app, opts) {
    const o = opts || {};
    const render = () => {
      const s = app.store;
      el.innerHTML = '<div class="k-undobar" role="toolbar" aria-label="편집 도구"><button class="k-btn" data-act="undo"' + (s.canUndo() ? '' : ' disabled') + ' title="' + esc(s.undoLabel()) + ' (Ctrl+Z)">↶ 실행 취소 <small>' + s.undoStack.length + '</small></button><button class="k-btn" data-act="redo"' + (s.canRedo() ? '' : ' disabled') + ' title="' + esc(s.redoLabel()) + ' (Ctrl+Shift+Z)">↷ 다시 실행 <small>' + s.redoStack.length + '</small></button>' +
        (o.pins !== false ? '<span class="k-sep"></span><button class="k-btn k-btn-ghost" data-act="pinev">📌 이벤트 시리즈 고정</button><button class="k-btn k-btn-ghost" data-act="unpin">고정 모두 해제</button><span class="k-muted k-small">고정 ' + app.state.matches.filter((m) => m.pinned).length + '개</span>' : '') +
        (o.snapshot !== false ? '<span class="k-sep"></span><button class="k-btn k-btn-ghost" data-act="snap">📷 스냅샷 저장</button>' : '') +
        '<span class="k-save-state k-small">' + (s.persistError ? '⚠ 자동 저장 불가: ' + esc(s.persistError) : s.lastSavedAt ? '✔ 자동 저장 ' + s.lastSavedAt.toLocaleTimeString('ko-KR') : '') + '</span></div>';
    };
    on(el, 'click', '[data-act]', (e, b) => {
      const a = b.dataset.act;
      if (a === 'undo') app.undo();
      else if (a === 'redo') app.redo();
      else if (a === 'pinev') app.pinEventSeries(true);
      else if (a === 'unpin') app.unpinAll();
      else if (a === 'snap') UI.promptBox('스냅샷 저장', '이름', '안 ' + (app.state.snapshots.length + 1) + ' · ' + new Date().toLocaleString('ko-KR')).then((n) => n != null && app.saveSnapshot(n));
    });
    return UI.mount(el, app, render, null);
  };
})();
