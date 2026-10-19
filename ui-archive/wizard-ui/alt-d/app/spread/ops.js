/*
 * 별책 · 시즌 운영 (위저드 4단계 밖의 별도 메뉴, §3.5)
 * 절: 경기 기록(날짜 선택 → 그날 경기 일괄 처리) · 재편성(대상·옵션·실행·결과 확인, RH 규칙)
 * 여백: 시즌 진행 현황(P7) · 결과 미입력(P2) · 재편성 결과 점검
 */
(function () {
  'use strict';
  const SP = window.SP;
  const KBO = window.KBO;
  const { Dates, Reschedule } = KBO;
  const { esc, fmt } = SP;
  const app = SP.app;
  const ui = SP.ui;
  const TABS = [{ id: 'games', label: '경기 기록' }, { id: 'resched', label: '재편성' }];
  const REASONS = Reschedule.REASONS;
  ui.opsMonth = 8;
  ui.cancelReason = 'RAIN';

  function gamesByDate() {
    const by = {};
    for (const g of app.games()) (by[g.date] = by[g.date] || []).push(g);
    return by;
  }
  function stats() {
    const gs = app.games().filter((g) => g.source === 'INITIAL');
    const t = app.targets();
    return { played: gs.filter((g) => g.status === 'PLAYED').length, cancelled: gs.filter((g) => g.status === 'CANCELLED').length, scheduled: gs.filter((g) => g.status === 'SCHEDULED').length, overdue: SP.on('P2') ? app.overdueGames().length : 0, need: t.totals.need, remaining: t.totals.remaining };
  }

  // ───────────── 상호작용 ─────────────
  SP.act.opsMonth = (el) => { ui.opsMonth = Number(el.dataset.arg); SP.render(); };
  SP.act.opsDate = (el) => { ui.opsDate = el.dataset.arg; SP.render(); };
  SP.act.gameStatus = (el) => {
    const [key, status] = el.dataset.arg.split('|');
    const g = app.games().find((x) => x.key === key);
    if (g) app.setGameStatus(g, status, status === 'CANCELLED' ? ui.cancelReason : undefined);
  };
  SP.act.gameReason = (el) => { const g = app.games().find((x) => x.key === el.dataset.arg); if (g) app.setGameStatus(g, 'CANCELLED', el.value); };
  SP.act.cancelReason = (el) => { ui.cancelReason = el.value; };
  SP.act.dayAll = (el) => { const st = el.dataset.arg; app.setDayStatus(ui.opsDate, st, st === 'CANCELLED' ? ui.cancelReason : undefined); SP.toast(fmt.date(ui.opsDate) + ' 경기를 일괄 ' + Reschedule.STATUS[st] + '(으)로 기록했습니다.', 'ok'); };
  SP.act.rsOpt = (el) => {
    const k = el.dataset.arg;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'maxDoubleHeaderPerTeam') v = Number(v);
    app.updateReschedule({ [k]: v });
  };
  SP.runResched = function (silent) {
    app.buildRescheduleUnits();
    const st = app.state;
    const search = Reschedule.createSearch(Reschedule.buildInput(st), { seed: st.settings.solver.seed || 42 });
    for (let i = 0; i < 40; i++) search.step(2000);
    const plan = search.bestPlanList();
    app.store.commit('재편성 결과 (목업)', (s) => { s.reschedule.plan = plan; s.meta.spread = s.meta.spread || {}; s.meta.spread.reschedAt = new Date().toISOString(); }, { tags: ['reschedule'] });
    if (!silent) SP.toast('재편성 완료 — ' + plan.filter((p) => p.start).length + '개 묶음을 9~10월에 배치했습니다.', 'ok');
  };
  SP.act.runResched = () => {
    if (SP.isRunning()) return;
    ui.rsBusy = true; SP.render();
    setTimeout(() => { ui.rsBusy = false; SP.runResched(); }, 700);
  };
  SP.act.clearResched = () => { app.clearReschedulePlan(); };

  // ───────────── 머리·띠 ─────────────
  function header() {
    let h = '<span class="sp-ops-kicker">별책</span><span class="sp-ops-title">시즌 운영</span><div class="sp-subtabs" role="tablist" aria-label="시즌 운영 절" style="height:100%;align-items:stretch">';
    TABS.forEach((t, i) => { const on = ui.tab.ops === t.id; h += '<button type="button" role="tab" class="sp-subtab' + (on ? ' sp-on' : '') + '" aria-selected="' + on + '" data-act="tab" data-arg="' + t.id + '"><span class="sp-subtab-no">S.' + (i + 1) + '</span>' + esc(t.label) + '</button>'; });
    h += '</div><span class="sp-ops-lead">1차 편성(~8/31)을 확정한 뒤, 취소 경기를 기록하고 잔여·취소 경기를 9~10월에 다시 편성한다.</span>' + SP.btn('wizard', '<span aria-hidden="true">◀</span> 편성 위저드로');
    return h;
  }
  function band() {
    const s = stats();
    return '<span class="sp-band-l">운영 현황</span><span class="sp-stat">기준일 <b>' + fmt.date(app.referenceDate()) + '</b></span><span class="sp-sep">|</span><span class="sp-stat">완료 <b>' + s.played + '</b></span><span class="sp-stat">예정 <b>' + s.scheduled + '</b></span><span class="sp-stat">취소 <b>' + s.cancelled + '</b></span>' +
      (SP.on('P2') ? '<span class="sp-stat" style="color:var(--warn)"><span aria-hidden="true">⚠</span> 결과 미입력 <b style="color:var(--warn)">' + s.overdue + '</b></span>' : '') + '<span class="sp-sep">|</span><span class="sp-stat">재편성 대상 <b>' + s.need + '경기</b> (잔여 ' + s.remaining + ' + 취소 ' + s.cancelled + ')</span><span class="sp-band-r">' + SP.mock('기록 저장은 실제, 재편성 엔진은 목업') + '</span>';
  }

  // ───────────── 경기 기록 ─────────────
  function miniCal() {
    const M = ui.opsMonth;
    const by = gamesByDate();
    const ref = app.referenceDate();
    const first = Dates.dayNum('2025-' + String(M).padStart(2, '0') + '-01');
    const nextFirst = Dates.dayNum('2025-' + String(M + 1).padStart(2, '0') + '-01');
    const start = first - ((Dates.weekday(first) + 6) % 7);
    let h = '<div class="sp-toolbar"><div class="sp-monthtabs" role="group" aria-label="월">' + [3, 4, 5, 6, 7, 8].map((m) => '<button type="button" data-act="opsMonth" data-arg="' + m + '" aria-pressed="' + (m === M) + '">' + m + '월</button>').join('') + '</div><span class="sp-grow"></span><span class="sp-toolbar-l">■ 기준일 ' + fmt.date(ref) + '</span></div>';
    h += '<div class="sp-minical" role="grid" aria-label="' + M + '월 경기일">' + ['월', '화', '수', '목', '금', '토', '일'].map((w) => '<div class="sp-mc-h">' + w + '</div>').join('');
    for (let d = start; d < nextFirst || (d - start) % 7; d++) {
      const iso = Dates.isoDate(d);
      const gs = by[iso] || [];
      const inM = d >= first && d < nextFirst;
      if (!inM) { h += '<div class="sp-mc-d" style="background:var(--paper)"></div>'; continue; }
      const c = gs.filter((g) => g.status === 'CANCELLED').length;
      const o = SP.on('P2') ? gs.filter((g) => g.status === 'SCHEDULED' && iso < ref).length : 0;
      const p = gs.filter((g) => g.status === 'PLAYED').length;
      h += '<button type="button" class="sp-mc-d' + (ui.opsDate === iso ? ' sp-on' : '') + (iso === ref ? ' sp-ref' : '') + '" data-act="opsDate" data-arg="' + iso + '"' + (gs.length ? '' : ' disabled') + ' aria-pressed="' + (ui.opsDate === iso) + '"><b>' + Number(iso.slice(8)) + '</b>' +
        (gs.length ? '<span class="sp-mc-s">' + gs.length + '경기' + (p === gs.length ? ' ✔' : '') + '</span>' : '<span class="sp-mc-s">휴식</span>') + (c ? '<span class="sp-mc-x">✖ 취소 ' + c + '</span>' : '') + (o ? '<span class="sp-mc-o">⚠ 미입력 ' + o + '</span>' : '') + '</button>';
    }
    return h + '</div>';
  }
  function dayTable() {
    const iso = ui.opsDate;
    const gs = (gamesByDate()[iso] || []);
    const ref = app.referenceDate();
    let h = '<div class="sp-toolbar">' + SP.cap('표 S.1', fmt.date(iso) + ' 경기', gs.length + '경기 · 날짜 하나를 골라 그날 경기를 한 번에 처리') + '</div>';
    h += '<div class="sp-row" style="flex:none;padding:6px 10px;border:1px solid var(--rule-2);background:var(--sheet)"><b style="font-family:var(--serif)">그날 일괄</b>' + SP.btn('dayAll', '✔ 모두 완료', { arg: 'PLAYED' }) + SP.btn('dayAll', '✖ 모두 취소', { arg: 'CANCELLED', kind: 'bad' }) + '<label class="sp-field" style="flex-direction:row;align-items:center;gap:6px"><span>취소 사유</span><select class="sp-select" data-chg="cancelReason">' + Object.keys(REASONS).map((k) => '<option value="' + k + '"' + (ui.cancelReason === k ? ' selected' : '') + '>' + REASONS[k] + '</option>').join('') + '</select></label>' + SP.btn('dayAll', '예정으로 되돌리기', { arg: 'SCHEDULED', kind: 'ghost' }) + '</div>';
    h += '<div class="sp-scroll sp-grow" data-sk="day" style="border-bottom:2px solid var(--ink);background:var(--sheet)"><table class="sp-table"><thead><tr><th>경기</th><th>구장</th><th>시리즈</th><th style="width:230px">상태</th><th style="width:130px">취소 사유</th></tr></thead><tbody>';
    for (const g of gs) {
      const overdue = SP.on('P2') && g.status === 'SCHEDULED' && iso < ref;
      const seg = '<div class="sp-seg">' + ['SCHEDULED', 'PLAYED', 'CANCELLED'].map((s) => '<button type="button" data-act="gameStatus" data-arg="' + esc(g.key + '|' + s) + '" aria-pressed="' + (g.status === s) + '">' + (s === 'PLAYED' ? '✔ ' : s === 'CANCELLED' ? '✖ ' : '○ ') + Reschedule.STATUS[s] + '</button>').join('') + '</div>';
      h += '<tr' + (overdue ? ' class="sp-pf-warn"' : g.status === 'CANCELLED' ? ' class="sp-pf-block"' : '') + '><td>' + SP.team(g.away) + ' <span class="sp-muted">@</span> ' + SP.team(g.home) + (overdue ? ' <span class="sp-chip sp-chip-warn">⚠ 결과 미입력</span>' : '') + '</td><td>' + esc(g.stadium) + '</td><td class="sp-muted">' + (g.source === 'RESCHEDULE' ? '재편성' : (g.seq + 1) + '번째 경기') + '</td><td>' + seg + '</td><td>' + (g.status === 'CANCELLED' ? '<select class="sp-select" data-chg="gameReason" data-arg="' + esc(g.key) + '">' + Object.keys(REASONS).map((k) => '<option value="' + k + '"' + (g.reason === k ? ' selected' : '') + '>' + REASONS[k] + '</option>').join('') + '</select>' : '') + '</td></tr>';
    }
    if (!gs.length) h += '<tr><td colspan="5" class="sp-muted">이 날은 경기가 없습니다.</td></tr>';
    h += '</tbody></table></div>';
    const cancelled = app.games().filter((g) => g.status === 'CANCELLED');
    h += SP.cap('표 S.2', '취소 경기 ' + cancelled.length + '건', '재편성 대상에 자동으로 들어간다') + '<div style="flex:none;max-height:120px;overflow-y:auto;background:var(--sheet);border-top:2px solid var(--ink);border-bottom:1px solid var(--ink)" data-sk="cancelled"><table class="sp-table"><tbody>' + cancelled.map((g) => '<tr><td>' + fmt.date(g.date) + '</td><td>' + esc(g.away + ' @ ' + g.home) + '</td><td>' + esc(REASONS[g.reason] || '') + '</td><td><button class="sp-link" data-act="opsDate" data-arg="' + g.date + '">그날 보기</button></td></tr>').join('') + '</tbody></table></div>';
    return h;
  }

  // ───────────── 재편성 ─────────────
  function reschedMain() {
    const st = app.state;
    const rs = st.reschedule;
    const t = app.targets();
    const rex = app.rescheduleExplain();
    const placed = (rs.plan || []).some((p) => p.start);
    let h = '<div class="sp-row" style="flex:none;gap:14px;padding:6px 10px;border:1px solid var(--rule-2);border-left:3px solid var(--navy);background:var(--sheet)"><b style="font-family:var(--serif)">재편성 옵션</b>' +
      '<label class="sp-field"><span>기간 시작</span><input class="sp-input" type="date" data-chg="rsOpt" data-arg="start" value="' + esc(rs.start) + '"></label>' +
      '<label class="sp-field"><span>기간 끝</span><input class="sp-input" type="date" data-chg="rsOpt" data-arg="end" value="' + esc(rs.end) + '"></label>' +
      '<label class="sp-check"><input type="checkbox" data-chg="rsOpt" data-arg="allowMonday"' + (rs.allowMonday ? ' checked' : '') + '> 월요일 경기 허용</label>' +
      '<label class="sp-check"><input type="checkbox" data-chg="rsOpt" data-arg="allowDoubleHeader"' + (rs.allowDoubleHeader ? ' checked' : '') + '> 더블헤더(DH) 허용</label>' +
      '<label class="sp-field"><span>구단당 최대 DH</span><select class="sp-select" data-chg="rsOpt" data-arg="maxDoubleHeaderPerTeam"' + (rs.allowDoubleHeader ? '' : ' disabled') + '>' + [0, 1, 2, 3, 4, 5].map((v) => '<option' + (rs.maxDoubleHeaderPerTeam === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '<span class="sp-grow"></span>' + SP.btn('runResched', ui.rsBusy ? '재편성 중…' : (placed ? '다시 재편성' : '▶ 재편성 실행') + ' ' + SP.mock(), { kind: 'primary', disabled: ui.rsBusy }) + '</div>';
    if (!placed) {
      h += '<div class="sp-toolbar">' + SP.cap('표 S.3', '재편성 대상 (구단쌍 × 홈)', '목표 ' + st.settings.gamesPerPair + '경기 − (완료 + 예정) = 잔여 + 취소') + '</div>';
      h += '<div class="sp-scroll sp-grow" data-sk="targets" style="border-bottom:2px solid var(--ink);background:var(--sheet)"><table class="sp-table"><thead><tr><th>홈</th><th>원정</th><th class="sp-num">잔여</th><th class="sp-num">취소</th><th class="sp-num">합계</th><th>취소 경기</th></tr></thead><tbody>' +
        t.needs.slice().sort((a, b) => (b.cancelled.length - a.cancelled.length) || (a.home < b.home ? -1 : 1)).map((n) => '<tr><td>' + SP.team(n.home) + '</td><td>' + SP.team(n.away) + '</td><td class="sp-num">' + n.remaining + '</td><td class="sp-num' + (n.cancelled.length ? ' sp-over' : '') + '">' + n.cancelled.length + '</td><td class="sp-num"><b>' + (n.remaining + n.cancelled.length) + '</b></td><td class="sp-muted">' + n.cancelled.map((c) => fmt.date(c.date) + ' ' + (REASONS[c.reason] || '')).join(', ') + '</td></tr>').join('') + '</tbody></table></div>';
      return h;
    }
    // 결과 캘린더 9~10월
    const games = app.games().filter((g) => g.source === 'RESCHEDULE');
    const by = {};
    for (const g of games) (by[g.date] = by[g.date] || []).push(g);
    const viol = new Set((rex ? rex.violations : []).map((v) => v.date).filter(Boolean));
    const month = (M) => {
      const first = Dates.dayNum('2025-' + String(M).padStart(2, '0') + '-01');
      const nf = Dates.dayNum('2025-' + String(M + 1).padStart(2, '0') + '-01');
      const start = first - ((Dates.weekday(first) + 6) % 7);
      let g = '<div class="sp-rmonth">' + SP.cap('그림 S.' + (M - 8), M + '월 재편성 결과', games.filter((x) => Dates.month(x.day) === M).length + '경기') + '<div class="sp-rgrid">' + ['월', '화', '수', '목', '금', '토', '일'].map((w) => '<div class="sp-rh">' + w + '</div>').join('');
      for (let d = start; d < nf || (d - start) % 7; d++) {
        const iso = Dates.isoDate(d);
        if (d < first || d >= nf) { g += '<div style="background:var(--paper)"></div>'; continue; }
        const list = by[iso] || [];
        const mon = Dates.weekday(d) === 1;
        g += '<div class="' + (mon ? 'sp-rmon' : '') + '"' + (viol.has(iso) ? ' style="box-shadow:inset 0 0 0 2px var(--bad)"' : '') + '><span class="sp-rd">' + Number(iso.slice(8)) + '' + '</span>' + list.slice(0, 5).map((x) => '<span class="sp-rg ' + (x.dh ? 'sp-rg-dh' : 'sp-rg-new') + '">' + (x.dh ? 'DH ' : '') + esc(x.away + '@' + x.home) + '</span>').join('') + (list.length > 5 ? '<span class="sp-rg sp-muted">+' + (list.length - 5) + '</span>' : '') + '</div>';
      }
      return g + '</div></div>';
    };
    h += '<div class="sp-rcal">' + month(9) + month(10) + '</div><div class="sp-legend" style="flex:none"><span><b style="color:var(--navy)">남색</b> 재편성 경기</span><span><b style="color:var(--away)">DH</b> 더블헤더</span><span><i style="background:var(--paper)"></i>월요일</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px var(--bad)"></i>RH 위반 날짜</span></div>';
    return h;
  }

  // ───────────── 여백 ─────────────
  function progressSec() {
    if (!SP.on('P7')) return '';
    const st = app.state;
    const t = app.targets();
    const gs = app.games().filter((g) => g.source === 'INITIAL');
    const rows = st.teams.map((tm) => {
      const mine = gs.filter((g) => g.home === tm.name || g.away === tm.name);
      const p = mine.filter((g) => g.status === 'PLAYED').length, c = mine.filter((g) => g.status === 'CANCELLED').length, s = mine.filter((g) => g.status === 'SCHEDULED').length;
      const target = (st.teams.length - 1) * st.settings.gamesPerPair;
      return { name: tm.name, p, c, s, r: target - p - s };
    });
    const days = Reschedule.windowDays(st).filter((d) => !d.forbidden && (st.reschedule.allowMonday || !d.monday)).length;
    const maxNeed = Math.max(...rows.map((r) => r.r));
    const cap = days * (st.reschedule.allowDoubleHeader ? 1.2 : 1);
    const k = maxNeed / cap;
    return SP.mSec('시즌 진행 현황', '<table class="sp-table sp-prog" style="background:none"><thead><tr><th>구단</th><th class="sp-num">완료</th><th class="sp-num">취소</th><th class="sp-num">잔여</th><th style="width:80px"></th></tr></thead><tbody>' +
      rows.map((r) => { const tot = r.p + r.c + r.s + Math.max(0, r.r - r.c); return '<tr><td>' + SP.team(r.name) + '</td><td class="sp-num">' + r.p + '</td><td class="sp-num' + (r.c ? ' sp-over' : '') + '">' + r.c + '</td><td class="sp-num">' + r.r + '</td><td><span class="sp-pb"><span class="p" style="width:' + (100 * r.p / tot) + '%"></span><span class="c" style="width:' + (100 * r.c / tot) + '%"></span><span class="r" style="flex:1"></span></span></td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="sp-note-s" style="margin-top:6px"><b>재편성 기간 수용</b> — 구단 최대 잔여 ' + maxNeed + '경기 / 경기 가능일 ' + days + '일' + (st.reschedule.allowDoubleHeader ? ' (+DH)' : '') + '</p><div class="sp-gauge" role="meter" aria-valuenow="' + Math.round(k * 100) + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + Math.min(100, k * 100) + '%;' + (k > 1 ? 'background:var(--bad)' : '') + '"></span><em>' + Math.round(k * 100) + '% ' + (k > 1 ? '⛔ 초과' : '✔ 수용 가능') + '</em></div>', { right: '1차 편성 ' + gs.length + '경기' });
  }
  function overdueSec() {
    if (!SP.on('P2')) return '';
    const od = app.overdueGames();
    const byD = {};
    for (const g of od) byD[g.date] = (byD[g.date] || 0) + 1;
    return SP.mSec('결과 미입력', od.length ? '<ul class="sp-mlist">' + Object.keys(byD).map((d) => '<li>' + SP.icon('warn') + '<span class="sp-mlist-t">' + fmt.date(d) + ' · ' + byD[d] + '경기</span><button class="sp-link" data-act="opsDate" data-arg="' + d + '">기록하기</button></li>').join('') + '</ul>' : '<p class="sp-note-s">✔ 기준일 이전 경기는 모두 기록되었습니다.</p>', { right: '기준일 ' + fmt.md(app.referenceDate()) + ' 이전' });
  }
  function rexSec() {
    const rex = app.rescheduleExplain();
    const placed = (app.state.reschedule.plan || []).some((p) => p.start);
    if (!rex || !placed) return SP.mSec('재편성 규칙 (RH)', '<ul class="sp-mlist">' + Reschedule.HARD_RULES.map((r) => '<li>' + SP.icon('draft') + '<span class="sp-mlist-t"><b>' + r.code + '</b> ' + esc(r.label) + '</span></li>').join('') + '</ul><p class="sp-note-s">실행하면 규칙별 결과가 여기에 표시됩니다. 이미 치른 경기와 9/1 이전 일정은 자동 고정됩니다.</p>');
    const tmx = rex.teamMetrics.slice().sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
    return SP.mSec('재편성 결과 점검', '<ul class="sp-mlist">' + Reschedule.HARD_RULES.map((r) => { const c = rex.byCode[r.code].count; return '<li>' + SP.icon(c ? 'bad' : 'pass') + '<span class="sp-mlist-t"><b>' + r.code + '</b> ' + esc(r.label) + '</span><span>' + (c ? c + '건' : '0') + '</span></li>'; }).join('') + '</ul>' +
      '<dl class="sp-kv" style="margin-top:6px"><dt>배치한 묶음</dt><dd>' + rex.units.filter((u) => u.days.length).length + ' / ' + rex.units.length + '</dd><dt>마지막 경기일</dt><dd>' + (tmx[0] && tmx[0].lastDate ? fmt.date(tmx[0].lastDate) : '-') + '</dd><dt>더블헤더</dt><dd>' + rex.teamMetrics.reduce((a, b) => a + b.doubleHeaders, 0) / 2 + '회</dd><dt>월요일 경기</dt><dd>' + rex.teamMetrics.reduce((a, b) => a + b.mondayGames, 0) / 2 + '경기</dd></dl>' + (rex.violations.length ? '<ul class="sp-mlist">' + rex.violations.slice(0, 4).map((v) => '<li>' + SP.icon('bad') + '<span class="sp-mlist-t">' + esc(v.message) + '</span></li>').join('') + '</ul>' : ''), { right: rex.feasible ? '✔ 가능' : '✖ 위반 ' + rex.violations.length });
  }

  SP.views.ops = {
    header, band,
    main() {
      const tab = ui.tab.ops === 'resched' ? 'resched' : 'games';
      if (tab === 'games') return '<div class="sp-body"><div class="sp-split" style="grid-template-columns:minmax(0,0.95fr) minmax(0,1.25fr)"><div>' + miniCal() + '<p class="sp-note-s">날짜를 고르면 오른쪽에 그날 경기가 열립니다. 표시는 아이콘과 글자를 함께 씁니다(✔ 완료 · ✖ 취소 · ⚠ 결과 미입력).</p></div><div>' + dayTable() + '</div></div></div>';
      return '<div class="sp-body">' + reschedMain() + '</div>';
    },
    margin() {
      const tab = ui.tab.ops === 'resched' ? 'resched' : 'games';
      const b = tab === 'games' ? overdueSec() + progressSec() : rexSec() + progressSec();
      const placed = (app.state.reschedule.plan || []).some((p) => p.start);
      const next = tab === 'games' ? '<p>취소 경기를 기록했으면 재편성으로 넘어갑니다.</p>' + SP.btn('tab', '재편성 열기 ▶', { arg: 'resched', kind: 'primary' }) : placed ? '<p>결과를 확인했으면 일정표를 다시 배포합니다.</p><div class="sp-row">' + SP.btn('clearResched', '배치 비우기', { cls: 'sp-grow' }) + SP.btn('go', '일정표 · 제4장', { arg: '4:schedule', kind: 'primary', cls: 'sp-grow' }) + '</div>' : '<p>옵션을 정하고 재편성을 실행합니다.</p>' + SP.btn('runResched', '▶ 재편성 실행', { kind: 'primary' });
      return { body: b, next };
    }
  };
})();
