/*
 * 화면 공통 — 시즌 운영: 경기 기록(FR-P1·P2), 재편성(FR-P3~P6), 진행 현황(FR-P7), 구단별 일정표·인쇄(FR-A11), 데이터 관리(FR-D).
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const P = UI.panels || (UI.panels = {});
  const { esc, fmt, on } = UI;
  const { Dates, Reschedule, Score } = KBO;

  const statusSelect = (g) => '<select class="k-input k-w-sm" data-g="status" aria-label="상태">' + Object.entries(Reschedule.STATUS).map(([k, v]) => '<option value="' + k + '"' + (g.status === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>';
  const reasonSelect = (g) => '<select class="k-input k-w-sm" data-g="reason" aria-label="취소 사유"' + (g.status !== 'CANCELLED' ? ' hidden' : '') + '>' + Object.entries(Reschedule.REASONS).map(([k, v]) => '<option value="' + k + '"' + (g.reason === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>';
  const STATUS_ICON = { SCHEDULED: '◷', PLAYED: '✔', CANCELLED: '☂' };

  // ───────────── 경기 기록 (FR-P1, P2) ─────────────
  P.games = function (el, app, opts) {
    const o = opts || {};
    let date = o.date ? o.date() : null;
    const render = () => {
      const games = app.games();
      if (o.date) date = o.date() || date;
      if (!date) { const ov = app.overdueGames(); date = ov.length ? ov[0].date : (games[0] ? games[0].date : app.state.settings.seasonStart); }
      const day = games.filter((g) => g.date === date);
      const overdue = app.overdueGames();
      const odDates = Array.from(new Set(overdue.map((g) => g.date)));
      const totals = { SCHEDULED: 0, PLAYED: 0, CANCELLED: 0 };
      for (const g of games) totals[g.status]++;
      let h = '<div class="k-games">';
      h += '<div class="k-toolbar"><button class="k-btn k-btn-icon" data-act="prev" aria-label="이전 경기일">◀</button><input class="k-input" type="date" data-act="date" value="' + esc(date) + '" aria-label="기록할 날짜"><button class="k-btn k-btn-icon" data-act="next" aria-label="다음 경기일">▶</button><b>' + fmt.date(date) + '</b> <span class="k-muted">' + day.length + '경기</span>' +
        '<span class="k-sep"></span><span class="k-small">전체: ✔ 완료 ' + totals.PLAYED + ' · ☂ 취소 ' + totals.CANCELLED + ' · ◷ 예정 ' + totals.SCHEDULED + '</span></div>';
      if (day.length) {
        h += '<div class="k-toolbar k-bulk">이날 일괄: <button class="k-btn" data-bulk="PLAYED">✔ 모두 완료</button><select class="k-input k-w-sm" data-act="bulkreason" aria-label="일괄 취소 사유">' + Object.entries(Reschedule.REASONS).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') + '</select><button class="k-btn k-btn-danger" data-bulk="CANCELLED">☂ 모두 취소</button><button class="k-btn k-btn-ghost" data-bulk="SCHEDULED">◷ 예정으로</button></div>';
        const rows = day.map((g, i) => {
          const ht = app.team(g.home) || {}, at = app.team(g.away) || {};
          const od = g.status === 'SCHEDULED' && g.date < app.referenceDate();
          const kind = g.source === 'RESCHEDULE' ? '재편성' : '1차 (' + (g.seq + 1) + '/' + app.state.matches[g.match].consecutive + '차전)';
          const head = STATUS_ICON[g.status] + ' ' + UI.teamChip(at) + ' @ ' + UI.teamChip(ht) + (g.dh ? ' <span class="k-dh">DH</span>' : '') + (od ? ' <span class="k-chip k-chip-warn">⏰ 결과 미입력</span>' : '');
          const cls = 'k-gst-' + g.status.toLowerCase() + (od ? ' k-overdue-row' : '');
          return o.compact
            ? '<div data-i="' + i + '" class="k-game-card ' + cls + '"><div>' + head + '</div><div class="k-small k-muted">' + esc(g.stadium) + ' · ' + kind + '</div><div class="k-inline">' + statusSelect(g) + reasonSelect(g) + '</div></div>'
            : '<tr data-i="' + i + '" class="' + cls + '"><td>' + head + '</td><td class="k-small">' + esc(g.stadium) + '</td><td class="k-small">' + kind + '</td><td>' + statusSelect(g) + '</td><td>' + reasonSelect(g) + '</td></tr>';
        }).join('');
        h += o.compact ? '<div class="k-game-cards">' + rows + '</div>' : '<table class="k-table k-compact"><thead><tr><th>경기</th><th>구장</th><th>구분</th><th>상태</th><th>사유</th></tr></thead><tbody>' + rows + '</tbody></table>';
      } else h += '<p class="k-muted">이날은 경기가 없습니다.</p>';
      h += '<details class="k-overdue-box"' + (overdue.length ? '' : '') + '><summary>' + (overdue.length ? '⏰ 결과 미입력 ' + overdue.length + '경기 (' + odDates.length + '일)' : '✔ 결과 미입력 없음') + ' <span class="k-muted k-small">기준일 ' + fmt.date(app.referenceDate()) + ' 이전 예정 경기</span></summary><div class="k-chips">' + odDates.slice(0, 80).map((d) => '<button class="k-chip k-chip-warn" data-goto="' + d + '">' + fmt.date(d) + '</button>').join('') + (odDates.length > 80 ? '<span class="k-muted">…</span>' : '') + '</div></details>';
      el.innerHTML = h + '</div>';
      el._day = day;
    };
    const gameDates = () => Array.from(new Set(app.games().map((g) => g.date))).sort();
    const go = (d) => { date = d; if (o.onDate) o.onDate(d); render(); };
    on(el, 'change', '[data-act=date]', (e, i) => go(i.value));
    on(el, 'click', '[data-act=prev],[data-act=next]', (e, b) => {
      const ds = gameDates();
      const prev = b.dataset.act === 'prev';
      const cand = prev ? ds.filter((d) => d < date).pop() : ds.find((d) => d > date);
      if (cand) go(cand);
    });
    on(el, 'click', '[data-goto]', (e, b) => go(b.dataset.goto));
    on(el, 'change', '[data-g]', (e, s) => {
      const tr = s.closest('[data-i]');
      const g = el._day[Number(tr.dataset.i)];
      const status = tr.querySelector('[data-g=status]').value;
      const reason = tr.querySelector('[data-g=reason]').value;
      app.setGameStatus(g, status, reason);
    });
    on(el, 'click', '[data-bulk]', (e, b) => app.setDayStatus(date, b.dataset.bulk, el.querySelector('[data-act=bulkreason]').value));
    const m = UI.mount(el, app, render, ['games', 'plan', 'reschedule', 'settings', 'calendar']);
    return Object.assign(m, { setDate: go, getDate: () => date });
  };

  // ───────────── 재편성 (FR-P3~P6) ─────────────
  P.reschedule = function (el, app, opts) {
    const o = opts || {};
    el.innerHTML = '<div class="k-resched"><section class="k-rs-targets"></section><section class="k-rs-options"></section><section class="k-rs-solver"></section><section class="k-rs-result"></section><section class="k-rs-viol"></section></div>';
    const tEl = el.querySelector('.k-rs-targets'), oEl = el.querySelector('.k-rs-options'), sEl = el.querySelector('.k-rs-solver'), rEl = el.querySelector('.k-rs-result');
    // 대상
    const renderTargets = () => {
      const t = app.targets();
      const units = app.state.reschedule.units || [];
      const unitGames = units.reduce((s, u) => s + u.games, 0);
      const need = t.totals.remaining + t.totals.cancelled;
      let h = '<h4 class="k-subhead">재편성 대상 (FR-P3)</h4><div class="k-kpis"><div><span>잔여</span><b>' + t.totals.remaining + '</b><small>목표 ' + app.state.settings.gamesPerPair + ' − 1차 편성</small></div><div><span>취소</span><b>' + t.totals.cancelled + '</b><small>기록된 취소 경기</small></div><div><span>재편성 대상</span><b>' + need + '</b><small>잔여 + 취소</small></div><div><span>확정 묶음</span><b>' + units.length + '</b><small>' + unitGames + '경기' + (unitGames !== need ? ' ⚠ 대상과 다름' : '') + '</small></div></div>';
      h += '<div class="k-toolbar"><button class="k-btn k-btn-primary" data-act="build"' + (app.isRunning() ? ' disabled' : '') + '>재편성 대상 확정 → 1~3경기 묶음 생성</button><span class="k-muted k-small">같은 대진(홈 기준) 경기를 묶습니다. 잔여 경기 홈 결정: ' + (app.state.settings.remainingHomeRule === 'MORE_HOME' ? '홈 경기 많은 구단' : '홈 경기 적은 구단') + '</span></div>';
      h += '<details><summary>홈 구단별 대상 ' + t.needs.length + '건</summary><div class="k-table-wrap k-scroll-y"><table class="k-table k-compact"><thead><tr><th>홈</th><th>원정</th><th>취소</th><th>잔여</th><th>합</th></tr></thead><tbody>' + t.needs.map((n) => '<tr><td>' + UI.teamChip(app.team(n.home)) + '</td><td>' + UI.teamChip(app.team(n.away)) + '</td><td>' + (n.cancelled.length ? n.cancelled.map((g) => '<span class="k-chip k-chip-warn" title="' + esc(Reschedule.REASONS[g.reason] || '') + '">☂ ' + fmt.short(g.date) + '</span>').join(' ') : '0') + '</td><td>' + n.remaining + '</td><td><b>' + (n.remaining + n.cancelled.length) + '</b></td></tr>').join('') + '</tbody></table></div></details>';
      tEl.innerHTML = h;
    };
    on(tEl, 'click', '[data-act=build]', () => app.buildRescheduleUnits());
    // 옵션
    const renderOptions = () => {
      const r = app.state.reschedule;
      const d = app.isRunning() ? ' disabled' : '';
      oEl.innerHTML = '<h4 class="k-subhead">재편성 옵션 (FR-P4)</h4><div class="k-grid-4"><label class="k-field"><span>재편성 시작</span><input class="k-input" type="date" data-r="start" value="' + esc(r.start) + '"' + d + '></label><label class="k-field"><span>재편성 종료</span><input class="k-input" type="date" data-r="end" value="' + esc(r.end) + '"' + d + '></label>' +
        '<label class="k-check"><input type="checkbox" data-r="allowMonday"' + (r.allowMonday ? ' checked' : '') + d + '> 월요일 경기 허용</label>' +
        '<label class="k-check"><input type="checkbox" data-r="allowDoubleHeader"' + (r.allowDoubleHeader ? ' checked' : '') + d + '> 더블헤더 허용 · 구단당 최대 <input class="k-input k-w-xs" type="number" min="0" data-r="maxDoubleHeaderPerTeam" value="' + esc(r.maxDoubleHeaderPerTeam) + '"' + (r.allowDoubleHeader ? '' : ' disabled') + d + '></label></div>' +
        '<div class="k-inline"><span>경기 없는 날</span><div class="k-chips">' + (r.blackouts || []).map((b, i) => '<span class="k-chip">' + fmt.date(b.start) + (b.end && b.end !== b.start ? '~' + fmt.short(b.end) : '') + ' <button class="k-x" data-delbl="' + i + '" aria-label="삭제"' + d + '>×</button></span>').join('') + '</div><input class="k-input" type="date" data-act="newbl"' + d + '><button class="k-btn" data-act="addbl"' + d + '>추가</button></div>';
    };
    on(oEl, 'change', '[data-r]', (e, i) => app.updateReschedule({ [i.dataset.r]: i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value }));
    on(oEl, 'click', '[data-act=addbl]', () => { const v = oEl.querySelector('[data-act=newbl]').value; if (v) app.updateReschedule({ blackouts: (app.state.reschedule.blackouts || []).concat([{ start: v, end: v }]) }); });
    on(oEl, 'click', '[data-delbl]', (e, b) => app.updateReschedule({ blackouts: app.state.reschedule.blackouts.filter((x, i) => i !== Number(b.dataset.delbl)) }));
    P.solver(sEl, app, { mode: 'RESCHEDULE' });
    P.violations(el.querySelector('.k-rs-viol'), app, { reschedule: true, autoOpen: true });
    // 결과
    const renderResult = () => {
      const ex = app.rescheduleExplain();
      const r = app.state.reschedule;
      if (!ex) { rEl.innerHTML = '<p class="k-muted">재편성 대상을 확정하면 결과가 여기에 표시됩니다.</p>'; return; }
      const unitViol = new Map();
      for (const v of ex.violations) for (const u of v.units || []) { if (!unitViol.has(u)) unitViol.set(u, []); unitViol.get(u).push(v); }
      let h = '<h4 class="k-subhead">재편성 결과 (FR-P6 · §6.3 규칙)</h4><div class="k-badge ' + (ex.feasible ? 'k-badge-ok' : 'k-badge-bad') + '" role="status"><span class="k-badge-ic" aria-hidden="true">' + (ex.feasible ? '✔' : '✖') + '</span><span class="k-badge-main">' + (ex.feasible ? '재편성 가능 (Feasible)' : 'Hard 위반 ' + ex.violations.length + '건') + '</span><span class="k-badge-score">' + esc(Score.scoreString(ex.score)) + '</span></div>';
      h += '<p class="k-small k-muted">Soft: RS-1 마지막 경기일(기간 시작 후 ' + -ex.score.soft[0] + '일) · RS-2a 이동 증가분 편차 ' + -ex.score.soft[1] + ' · RS-2b 증가분 합계 ' + fmt.int(-ex.score.soft[2]) + 'km · RS-3 DH·월요일 ' + -ex.score.soft[3] + '경기</p>';
      h += '<div class="k-grid-2"><div><b>묶음 배치</b> <span class="k-muted k-small">날짜를 바꾸면 즉시 재채점합니다.</span><div class="k-table-wrap k-scroll-y" data-scroll-key="units"><table class="k-table k-compact"><thead><tr><th>대진</th><th>경기</th><th>시작일</th><th>DH</th><th>상태</th></tr></thead><tbody>' + ex.units.map((u) => {
        const vs = unitViol.get(u.unit) || [];
        const sel = app.ui.selectedUnit === u.unit;
        return '<tr data-unit="' + esc(u.unit) + '" class="' + (vs.length ? 'k-viol-row' : '') + (sel ? ' k-selected' : '') + '"><td><button class="k-link" data-act="selunit">' + esc(u.away) + ' @ ' + esc(u.home) + '</button></td><td>' + u.games + '</td><td><input class="k-input" type="date" min="' + esc(r.start) + '" max="' + esc(r.end) + '" data-u="start" value="' + esc(u.start || '') + '"' + (app.isRunning() ? ' disabled' : '') + '></td><td><input type="checkbox" data-u="dh"' + (u.dh ? ' checked' : '') + (u.games < 2 || !r.allowDoubleHeader || app.isRunning() ? ' disabled' : '') + ' aria-label="더블헤더"></td><td>' + (vs.length ? '<span class="k-chip k-chip-bad" title="' + esc(vs.map((v) => v.message).join('\n')) + '">⚠ ' + vs.map((v) => v.code).join(',') + '</span>' : u.start ? UI.stateChip('ok', fmt.short(u.days[0]) + (u.days.length > 1 ? '~' + fmt.short(u.days[u.days.length - 1]) : '')) : '') + '</td></tr>';
      }).join('') + '</tbody></table></div><div class="k-toolbar"><button class="k-btn k-btn-ghost" data-act="clear"' + (app.isRunning() ? ' disabled' : '') + '>배치 비우기</button></div></div><div><b>구단별 영향</b><table class="k-table k-compact"><thead><tr><th>구단</th><th>재편성 경기</th><th>이동 증가</th><th>DH</th><th>월요일</th><th>마지막 경기</th></tr></thead><tbody>' + ex.teamMetrics.map((t) => '<tr><td>' + UI.teamChip(app.state.teams[t.team]) + '</td><td>' + t.games + '</td><td>' + fmt.km(t.addedKm) + 'km</td><td>' + t.doubleHeaders + '</td><td>' + t.mondayGames + '</td><td>' + (t.lastDate ? fmt.date(t.lastDate) : '-') + '</td></tr>').join('') + '</tbody></table></div></div>';
      rEl.innerHTML = h;
    };
    on(rEl, 'change', '[data-u]', (e, i) => {
      const id = i.closest('tr').dataset.unit;
      const tr = i.closest('tr');
      app.moveUnit(id, tr.querySelector('[data-u=start]').value || null, tr.querySelector('[data-u=dh]').checked);
    });
    on(rEl, 'click', '[data-act=selunit]', (e, b) => { const id = b.closest('tr').dataset.unit; app.ui.selectedUnit = app.ui.selectedUnit === id ? null : id; const u = app.rescheduleExplain().units.find((x) => x.unit === id); app.focus({ units: [id], date: u && u.days[0] }); if (o.onUnitSelect) o.onUnitSelect(id); });
    on(rEl, 'click', '[data-act=clear]', () => app.clearReschedulePlan());
    const ms = [UI.mount(tEl, app, renderTargets, ['games', 'plan', 'reschedule', 'settings', 'matches', 'run']), UI.mount(oEl, app, renderOptions, ['reschedule', 'run']), UI.mount(rEl, app, renderResult, ['reschedule', 'games', 'plan', 'settings', 'run', 'focus'])];
    return { refresh: () => ms.forEach((m) => m.refresh()) };
  };

  // ───────────── 시즌 진행 현황 (FR-P7) ─────────────
  P.progress = function (el, app) {
    const render = () => {
      const t = app.targets();
      const st = app.state;
      const days = Reschedule.windowDays(st);
      const allowed = days.filter((d) => !d.forbidden && (st.reschedule.allowMonday || !d.monday)).length;
      const dhExtra = st.reschedule.allowDoubleHeader ? st.reschedule.maxDoubleHeaderPerTeam : 0;
      const half = st.teams.length >> 1;
      const totalNeed = t.totals.remaining + t.totals.cancelled;
      const leagueCap = allowed * half + dhExtra * half;
      let h = '<div class="k-progress"><div class="k-inline"><b>리그 수용 가능 여부</b> ' + KBO.Chart.gauge(totalNeed, leagueCap, { width: 260, label: totalNeed + ' / ' + leagueCap + '경기 (' + allowed + '일 × ' + half + ' + DH)', title: '리그 재편성 수용률' }) + (totalNeed <= leagueCap ? UI.stateChip('ok', '수용 가능') : UI.stateChip('bad', '기간 부족')) + '</div>';
      h += '<table class="k-table k-compact"><thead><tr><th>구단</th><th>소화</th><th>취소</th><th>예정</th><th>잔여</th><th>재편성 필요</th><th>재편성 기간 수용 (필요 / 가능일 + DH)</th></tr></thead><tbody>';
      for (const b of t.byTeam) {
        const need = b.remaining + b.cancelled;
        const cap = allowed + dhExtra;
        h += '<tr><td>' + UI.teamChip(app.team(b.team)) + '</td><td>' + b.played + '</td><td>' + b.cancelled + '</td><td>' + b.scheduled + '</td><td>' + b.remaining + '</td><td><b>' + need + '</b></td><td>' + KBO.Chart.gauge(need, cap, { width: 200, label: need + ' / ' + cap, title: b.team + ' 수용률' }) + (need > cap ? ' ' + UI.stateChip('bad', '부족') : '') + '</td></tr>';
      }
      el.innerHTML = h + '</tbody></table><p class="k-small k-muted">가능일 = 재편성 기간 중 경기 없는 날·' + (st.reschedule.allowMonday ? '' : '월요일·') + '금지일을 뺀 날 (' + allowed + '일). 구단별 필요 경기 수가 가능일 + DH 한도를 넘으면 기간 안에 배정할 수 없습니다.</p></div>';
    };
    return UI.mount(el, app, render, ['games', 'plan', 'reschedule', 'settings', 'matches']);
  };

  // ───────────── 구단별 일정표·인쇄 (FR-A11) ─────────────
  P.teamSchedule = function (el, app, opts) {
    let team = (opts && opts.team) || (app.state.teams[0] && app.state.teams[0].name);
    const render = () => {
      const games = app.games().filter((g) => g.home === team || g.away === team);
      const t = app.team(team) || {};
      let h = '<div class="k-toolbar k-noprint"><label class="k-field-inline">구단 <select class="k-input" data-act="team">' + app.state.teams.map((x) => '<option' + (x.name === team ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label><button class="k-btn" data-act="print">🖨 인쇄</button><button class="k-btn k-btn-ghost" data-act="csv">CSV (이 구단)</button></div>';
      h += '<div class="k-teamsched k-print-target"><h3>' + esc(app.state.meta.season) + ' 시즌 ' + esc(team) + ' 일정표 <small>' + esc(t.stadium || '') + '</small></h3><p class="k-small">총 ' + games.length + '경기 · 홈 ' + games.filter((g) => g.home === team).length + ' · 원정 ' + games.filter((g) => g.away === team).length + ' · 출력 ' + new Date().toLocaleDateString('ko-KR') + '</p><table class="k-table k-compact"><thead><tr><th>날짜</th><th>홈/원정</th><th>상대</th><th>구장</th><th>상태</th><th>구분</th></tr></thead><tbody>';
      let lastMonth = -1;
      for (const g of games) {
        const mo = Dates.month(g.day);
        if (mo !== lastMonth) { h += '<tr class="k-month-row"><th colspan="6">' + mo + '월</th></tr>'; lastMonth = mo; }
        const home = g.home === team;
        h += '<tr class="k-gst-' + g.status.toLowerCase() + '"><td>' + fmt.date(g.date) + '</td><td>' + (home ? '🏠 홈' : '✈ 원정') + '</td><td>' + esc(home ? g.away : g.home) + '</td><td>' + esc(g.stadium) + '</td><td>' + STATUS_ICON[g.status] + ' ' + Reschedule.STATUS[g.status] + (g.reason ? '(' + Reschedule.REASONS[g.reason] + ')' : '') + '</td><td>' + (g.source === 'RESCHEDULE' ? '재편성' + (g.dh ? ' DH' : '') : '1차') + '</td></tr>';
      }
      el.innerHTML = h + '</tbody></table></div>';
    };
    on(el, 'change', '[data-act=team]', (e, s) => { team = s.value; render(); });
    on(el, 'click', '[data-act=print]', () => { document.body.classList.add('k-printing-schedule'); el.classList.add('k-print-scope'); window.print(); setTimeout(() => { document.body.classList.remove('k-printing-schedule'); el.classList.remove('k-print-scope'); }, 500); });
    on(el, 'click', '[data-act=csv]', () => app.exportCSV(team));
    const m = UI.mount(el, app, render, ['games', 'plan', 'reschedule', 'teams']);
    return Object.assign(m, { setTeam: (t) => { team = t; render(); } });
  };

  // ───────────── 데이터 관리 (FR-D) ─────────────
  P.data = function (el, app) {
    const render = () => {
      const s = app.store;
      el.innerHTML = '<div class="k-data"><div class="k-toolbar"><button class="k-btn k-btn-primary" data-act="exp">⤓ 프로젝트 JSON 내보내기</button><button class="k-btn" data-act="imp"' + (app.isRunning() ? ' disabled' : '') + '>⤒ JSON 가져오기</button><button class="k-btn" data-act="eng">⤓ 엔진 호환 JSON (input_2025 형식)</button><button class="k-btn" data-act="csv">⤓ 일정 CSV</button><button class="k-btn k-btn-ghost k-btn-danger" data-act="reset"' + (app.isRunning() ? ' disabled' : '') + '>2025 프리셋으로 초기화</button></div>' +
        '<p class="k-small">' + (s.persistError ? UI.stateChip('warn', '자동 저장 불가: ' + s.persistError + ' — 앱은 계속 동작합니다. 내보내기로 보관하세요.') : UI.stateChip('ok', '브라우저에 자동 저장' + (s.lastSavedAt ? ' · ' + s.lastSavedAt.toLocaleTimeString('ko-KR') : '') + (s.restored ? ' · 이전 작업 복원됨' : ''))) + ' <span class="k-muted">저장 키 <code>' + esc(s.key) + '</code></span></p>' +
        '<p class="k-small k-muted">가져오기는 프로젝트 JSON(§8)과 엔진 입력 JSON(teams, distanceMatrix, calendar, matches, initialPlan)을 모두 받습니다. 잘못된 필드는 경로별로 알려 줍니다. 엔진 호환 JSON의 initialPlan은 매치 순서로 내보내 BaseballApp.setInitialPlan이 같은 매치를 고릅니다.</p></div>';
    };
    on(el, 'click', '[data-act]', (e, b) => {
      const a = b.dataset.act;
      if (a === 'exp') app.exportProject();
      else if (a === 'imp') app.importFile();
      else if (a === 'eng') app.exportEngine();
      else if (a === 'csv') app.exportCSV();
      else if (a === 'reset') UI.confirmBox('초기화', '현재 작업을 2025 프리셋으로 바꿉니다. 실행 취소로 되돌릴 수 있습니다. 스냅샷은 지워집니다.', '초기화', 'danger').then((ok) => ok && app.loadPreset());
    });
    return UI.mount(el, app, render, null);
  };
})();
