/*
 * 화면 공통 — 시즌 운영: 경기 기록(FR-P1·P2), 진행 현황(FR-P7), 구단별 일정표·인쇄(FR-A11), 데이터 관리(FR-D).
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const P = UI.panels || (UI.panels = {});
  const { esc, fmt, on } = UI;
  const { Dates, SeasonGames, Score } = KBO;

  const statusSelect = (g) => '<select class="k-input k-w-sm" data-g="status" aria-label="상태">' + Object.entries(SeasonGames.STATUS).map(([k, v]) => '<option value="' + k + '"' + (g.status === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>';
  const reasonSelect = (g) => '<select class="k-input k-w-sm" data-g="reason" aria-label="취소 사유"' + (g.status !== 'CANCELLED' ? ' hidden' : '') + '>' + Object.entries(SeasonGames.REASONS).map(([k, v]) => '<option value="' + k + '"' + (g.reason === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select>';
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
        h += '<div class="k-toolbar k-bulk">이날 일괄: <button class="k-btn" data-bulk="PLAYED">✔ 모두 완료</button><select class="k-input k-w-sm" data-act="bulkreason" aria-label="일괄 취소 사유">' + Object.entries(SeasonGames.REASONS).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') + '</select><button class="k-btn k-btn-danger" data-bulk="CANCELLED">☂ 모두 취소</button><button class="k-btn k-btn-ghost" data-bulk="SCHEDULED">◷ 예정으로</button></div>';
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

  // ───────────── 시즌 진행 현황 (FR-P7) ─────────────
  P.progress = function (el, app) {
    const render = () => {
      const t = app.targets();
      let h = '<div class="k-progress"><table class="k-table k-compact"><thead><tr><th>구단</th><th>소화</th><th>취소</th><th>예정</th><th>잔여</th><th>재편성할 경기</th></tr></thead><tbody>';
      for (const b of t.byTeam) h += '<tr><td>' + UI.teamChip(app.team(b.team)) + '</td><td>' + b.played + '</td><td>' + b.cancelled + '</td><td>' + b.scheduled + '</td><td>' + b.remaining + '</td><td><b>' + (b.remaining + b.cancelled) + '</b></td></tr>';
      el.innerHTML = h + '</tbody></table></div>';
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
        h += '<tr class="k-gst-' + g.status.toLowerCase() + '"><td>' + fmt.date(g.date) + '</td><td>' + (home ? '🏠 홈' : '✈ 원정') + '</td><td>' + esc(home ? g.away : g.home) + '</td><td>' + esc(g.stadium) + '</td><td>' + STATUS_ICON[g.status] + ' ' + SeasonGames.STATUS[g.status] + (g.reason ? '(' + SeasonGames.REASONS[g.reason] + ')' : '') + '</td><td>' + (g.source === 'RESCHEDULE' ? '재편성' + (g.dh ? ' DH' : '') : '1차') + '</td></tr>';
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
