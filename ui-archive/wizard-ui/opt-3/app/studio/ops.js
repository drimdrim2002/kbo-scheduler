/*
 * alt-a 편성 스튜디오 — 시즌 운영 (위저드 밖 별도 메뉴)
 * 경기 기록: 왼쪽 날짜 목록 / 가운데 그날 경기 일괄 처리 + 월 미니 달력 / 오른쪽 시즌 진행 현황
 * 재편성:   왼쪽 재편성 대상 / 가운데 옵션·실행·9~10월 결과 / 오른쪽 묶음 상세
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, Reschedule } = KBO;
  const app = () => S.app;
  const REASONS = Reschedule.REASONS;

  function initialGames() { return app().games().filter((g) => g.source === 'INITIAL'); }
  function byDate() {
    const m = new Map();
    for (const g of initialGames()) { if (!m.has(g.date)) m.set(g.date, []); m.get(g.date).push(g); }
    return m;
  }
  function dayState(list, ref) {
    const c = list.filter((g) => g.status === 'CANCELLED').length;
    const p = list.filter((g) => g.status === 'PLAYED').length;
    const sch = list.length - c - p;
    if (sch && list[0].date < ref && S.feature('P2')) return { k: 'warn', t: '미입력 ' + sch };
    if (c) return { k: 'bad', t: '취소 ' + c };
    if (!sch) return { k: 'ok', t: '완료' };
    return { k: 'todo', t: '예정' };
  }

  // ───────── 경기 기록 ─────────
  function gamesList() {
    const ref = app().referenceDate();
    const dm = byDate();
    const u = S.ui;
    let s = '<div class="pane-head"><span class="pane-title">경기일</span><span class="pane-desc">' + dm.size + '일 · 기준일 ' + esc(fmt.date(ref)) + '</span></div><div class="pane-body" data-sk="o-dates">';
    let mo = null;
    for (const [date, list] of dm) {
      const m = Dates.month(date);
      if (m !== mo) { mo = m; s += '<div class="label">' + m + '월</div>'; }
      const ds = dayState(list, ref);
      s += '<button class="li' + (u.opsDate === date ? ' active' : '') + '" data-act="o-date" data-date="' + date + '" style="min-height:26px"><span class="li-main">' + esc(fmt.date(date)) + '</span>' +
        (ds.k === 'ok' ? '<span class="st plain ok">' + icon('check') + '완료</span>' : ds.k === 'bad' ? '<span class="st plain bad">' + icon('x') + esc(ds.t) + '</span>' : ds.k === 'warn' ? '<span class="st plain warn">' + icon('warn') + esc(ds.t) + '</span>' : '<span class="st plain todo">' + icon('todo') + '예정</span>') + '</button>';
    }
    return s + '</div>';
  }
  function gamesMain() {
    const u = S.ui, ref = app().referenceDate();
    const dm = byDate();
    const date = u.opsDate && dm.has(u.opsDate) ? u.opsDate : Array.from(dm.keys())[0];
    u.opsDate = date;
    const list = dm.get(date) || [];
    const ds = dayState(list, ref);
    const st = app().state;
    let s = S.paneHead(fmt.date(date) + ' 경기 ' + list.length, '날짜를 골라 그날 경기를 한 번에 처리합니다. 취소는 사유와 함께 경기(일자) 단위로 기록합니다.', S.stat(ds.k === 'bad' ? 'block' : ds.k, ds.t));
    s += '<div class="toolbar"><b class="small">일괄 처리</b><button class="btn sm" data-act="o-bulk" data-status="PLAYED">' + icon('check') + '모두 완료</button>' +
      '<span class="btn-group"><button class="btn sm danger" data-act="o-bulk" data-status="CANCELLED">' + icon('x') + '모두 취소</button></span><select class="select sm" id="bulkReason" aria-label="일괄 취소 사유">' + Object.keys(REASONS).map((k) => '<option value="' + k + '">' + REASONS[k] + '</option>').join('') + '</select>' +
      '<button class="btn sm ghost" data-act="o-bulk" data-status="SCHEDULED">' + icon('undo') + '예정으로</button><span style="margin-left:auto">' + S.undoButtons() + '</span></div>';
    s += '<div class="pane-body" data-sk="o-games"><table class="gtable"><thead><tr><th>대진 (원정 @ 홈)</th><th>구장</th><th>시리즈</th><th>상태</th><th>취소 사유</th></tr></thead><tbody>';
    for (const g of list) {
      const m = st.matches[g.match];
      const overdue = g.status === 'SCHEDULED' && g.date < ref && S.feature('P2');
      s += '<tr class="' + (g.status === 'CANCELLED' ? 'cancel' : '') + (overdue ? ' overdue' : '') + '"><td>' + S.team(g.away) + ' <span class="muted">@</span> ' + S.team(g.home) + (overdue ? ' <span class="tag" style="color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn-line)">' + icon('warn') + '결과 미입력</span>' : '') + '</td><td class="small">' + esc(g.stadium) + '</td><td class="small muted">' + m.consecutive + '연전 ' + (g.seq + 1) + '일째</td>' +
        '<td><div class="seg">' + ['SCHEDULED', 'PLAYED', 'CANCELLED'].map((k) => '<button class="' + (g.status === k ? 'on' : '') + '" data-act="o-set" data-key="' + esc(g.key) + '" data-status="' + k + '">' + (k === 'PLAYED' ? icon('check') : k === 'CANCELLED' ? icon('x') : icon('todo')) + Reschedule.STATUS[k] + '</button>').join('') + '</div></td>' +
        '<td>' + (g.status === 'CANCELLED' ? '<select class="select sm" data-in="o-reason" data-key="' + esc(g.key) + '">' + Object.keys(REASONS).map((k) => '<option value="' + k + '"' + (g.reason === k ? ' selected' : '') + '>' + REASONS[k] + '</option>').join('') + '</select>' : '<span class="muted small">-</span>') + '</td></tr>';
    }
    s += '</tbody></table>';
    // 월 미니 달력
    const mo = Dates.month(date);
    const first = Dates.dayNum('2025-' + String(mo).padStart(2, '0') + '-01');
    const wd = (d) => (Dates.weekday(d) + 6) % 7;
    let d0 = first - wd(first);
    s += '<div style="padding:12px"><div class="label" style="padding:0 0 6px">' + mo + '월 기록 현황<span class="cnt legend"><span><i style="background:var(--navy)"></i>완료</span><span><i style="background:var(--bad-bg);box-shadow:inset 0 0 0 1px var(--bad)"></i>취소</span><span><i style="background:var(--warn-bg);box-shadow:inset 0 0 0 1px var(--warn)"></i>미입력</span><span><i style="background:#fff;box-shadow:inset 0 0 0 1px var(--line-2)"></i>예정</span></span></div><div class="rs-grid" style="grid-template-columns:repeat(7,minmax(0,1fr))">' + ['월', '화', '수', '목', '금', '토', '일'].map((x) => '<div class="hd">' + x + '</div>').join('');
    for (let k = 0; k < 42; k++) {
      const d = d0 + k;
      if (k >= 35 && Dates.month(d) !== mo) break;
      const iso = Dates.isoDate(d);
      const l = dm.get(iso);
      const inMo = Dates.month(d) === mo;
      let bg = '', txt = '';
      if (l && inMo) {
        const x = dayState(l, ref);
        bg = x.k === 'ok' ? 'background:#E3E8F1' : x.k === 'bad' ? 'background:var(--bad-bg)' : x.k === 'warn' ? 'background:var(--warn-bg)' : '';
        txt = x.k === 'ok' ? '<span style="color:var(--navy)">' + icon('check') + '5</span>' : x.k === 'bad' ? '<span style="color:var(--bad)">' + icon('x') + esc(x.t) + '</span>' : x.k === 'warn' ? '<span style="color:var(--warn)">' + icon('warn') + '미입력</span>' : '<span class="muted">예정</span>';
      }
      s += '<div style="height:40px;cursor:' + (l ? 'pointer' : 'default') + ';' + bg + (iso === date ? ';box-shadow:inset 0 0 0 2px var(--blue)' : '') + '"' + (l ? ' data-act="o-date" data-date="' + iso + '"' : '') + '><span class="dn" style="' + (inMo ? '' : 'color:#C0C5CE') + '">' + Dates.fmtShort(d).split('/')[1] + '</span> ' + (inMo ? txt : '') + '</div>';
    }
    s += '</div></div></div>';
    return s;
  }
  function progressInsp() {
    if (!S.feature('P7')) return { title: '도움말', html: '<div class="insp-sec"><h4>경기 기록</h4><div class="small">완료·취소를 날짜 단위로 기록합니다. 시즌 진행 현황(FR-P7)은 설정에서 꺼져 있습니다.</div></div>' };
    const t = app().targets();
    const tot = t.totals;
    const rs = app().state.reschedule;
    const days = Reschedule.windowDays(app().state).filter((d) => !d.forbidden && (rs.allowMonday || !d.monday)).length;
    const cap = days * 5;
    const need = tot.remaining + tot.cancelled;
    let s = '<div class="insp-sec"><h4>리그 전체</h4><div class="run-stats" style="grid-template-columns:repeat(4,1fr)"><div><div class="k">완료</div><div class="v">' + tot.played + '</div></div><div><div class="k">취소</div><div class="v" style="color:var(--bad)">' + tot.cancelled + '</div></div><div><div class="k">예정</div><div class="v">' + tot.scheduled + '</div></div><div><div class="k">잔여</div><div class="v">' + tot.remaining + '</div></div></div></div>';
    s += '<div class="insp-sec"><h4>재편성 기간 수용<span class="r">' + esc(fmt.short(rs.start) + '~' + fmt.short(rs.end)) + '</span></h4>' + KBO.Chart.gauge(need, cap, { width: 290, height: 20, label: need + ' / ' + cap + '경기 (' + Math.round(need / cap * 100) + '%)', color: '#13703F' }) + '<div class="small muted" style="margin-top:4px">' + icon('check') + ' 수용 가능 — 경기일 ' + days + '일 × 5경기' + (rs.allowMonday ? ' (월요일 포함)' : '') + '</div></div>';
    s += '<div class="insp-sec"><h4>구단별 소화<span class="r legend"><span><i style="background:var(--navy)"></i>완료</span><span><i style="background:repeating-linear-gradient(135deg,#B3261E 0 2px,#F4C1BC 2px 4px)"></i>취소</span><span><i style="background:#C9D5EA"></i>예정</span></span></h4>';
    for (const b of t.byTeam) {
      const all = b.played + b.cancelled + b.scheduled || 1;
      s += '<div class="prog-row"><span>' + S.team(b.team) + '</span><span class="stack"><i class="p" style="width:' + (b.played / all * 100) + '%"></i><i class="c" style="width:' + (b.cancelled / all * 100) + '%"></i><i class="s" style="width:' + (b.scheduled / all * 100) + '%"></i></span><span class="mono" style="font-size:11px;text-align:right">' + b.played + '·' + b.cancelled + '·' + b.remaining + '</span></div>';
    }
    s += '<div class="small muted" style="margin-top:4px">숫자: 완료·취소·잔여 경기</div></div>';
    return { title: '시즌 진행 현황', html: s };
  }

  // ───────── 재편성 ─────────
  function rsList() {
    const t = app().targets();
    const u = S.ui;
    const units = app().state.reschedule.units || [];
    let s = '<div class="pane-head"><span class="pane-title">재편성 대상</span><span class="pane-desc">' + (t.totals.remaining + t.totals.cancelled) + '경기 = 잔여 ' + t.totals.remaining + ' + 취소 ' + t.totals.cancelled + '</span></div><div class="pane-body" data-sk="o-rs-list">';
    if (units.length) {
      s += '<div class="label">확정한 묶음<span class="cnt">' + units.length + '</span></div>';
      for (const un of units) {
        const c = un.sources.filter((x) => x.kind === 'CANCELLED').length;
        s += '<button class="li' + (u.opsUnit === un.id ? ' active' : '') + '" data-act="o-unit" data-unit="' + esc(un.id) + '"><span class="li-main">' + S.team(un.away) + ' <span class="muted">@</span> ' + S.team(un.home) + '</span><span class="cnt">' + un.games + '경기</span>' + (c ? '<span class="tag" style="color:var(--bad);background:var(--bad-bg);border:1px solid var(--bad-line)">취소 ' + c + '</span>' : '<span class="tag ref">잔여</span>') + '</button>';
      }
    } else {
      const byHome = new Map();
      for (const n of t.needs) { if (!byHome.has(n.home)) byHome.set(n.home, []); byHome.get(n.home).push(n); }
      for (const [h, list] of byHome) {
        s += '<div class="label">' + esc(h) + ' 홈<span class="cnt">' + list.reduce((a, n) => a + n.remaining + n.cancelled.length, 0) + '경기</span></div>';
        for (const n of list) s += '<div class="li" style="min-height:24px;font-size:12px"><span class="li-main">' + S.team(n.away) + ' <span class="muted">@</span> ' + S.team(n.home) + '</span>' + (n.cancelled.length ? '<span class="tag" style="color:var(--bad);background:var(--bad-bg);border:1px solid var(--bad-line)">취소 ' + n.cancelled.length + '</span>' : '') + (n.remaining ? '<span class="tag ref">잔여 ' + n.remaining + '</span>' : '') + '</div>';
      }
    }
    return s + '</div>';
  }
  function rsMain() {
    const st = app().state, rs = st.reschedule, u = S.ui;
    const rex = (rs.plan || []).some((p) => p.start) ? app().rescheduleExplain() : null;
    let s = S.paneHead('재편성 (9~10월)', '이미 치른 경기는 자동 고정하고, 잔여·취소 경기를 1~3경기 묶음으로 재편성 기간에 배치합니다.', S.mock('재편성 탐색'));
    s += '<div class="toolbar" style="flex-wrap:wrap;height:auto;padding:8px 12px;gap:12px">' +
      '<label class="field"><span>재편성 기간</span><span style="display:flex;gap:4px;align-items:center"><input class="input sm" style="width:92px" value="' + esc(fmt.date(rs.start)) + '" data-in="rs-date" data-k="start">~<input class="input sm" style="width:92px" value="' + esc(fmt.date(rs.end)) + '" data-in="rs-date" data-k="end"></span></label>' +
      '<label class="field"><span>월요일 경기</span><span style="display:flex;gap:6px;align-items:center;height:24px"><span class="switch"><input type="checkbox" data-in="rs-opt" data-k="allowMonday"' + (rs.allowMonday ? ' checked' : '') + '><i></i></span>' + (rs.allowMonday ? '허용' : '금지') + '</span></label>' +
      '<label class="field"><span>더블헤더</span><span style="display:flex;gap:6px;align-items:center;height:24px"><span class="switch"><input type="checkbox" data-in="rs-opt" data-k="allowDoubleHeader"' + (rs.allowDoubleHeader ? ' checked' : '') + '><i></i></span>' + (rs.allowDoubleHeader ? '허용' : '금지') + '</span></label>' +
      '<label class="field"><span>구단당 최대 DH</span><input class="input sm" style="width:56px" value="' + rs.maxDoubleHeaderPerTeam + '" data-in="rs-max"' + (rs.allowDoubleHeader ? '' : ' disabled') + '></label>' +
      '<span style="margin-left:auto;display:flex;gap:6px;align-items:flex-end;align-self:flex-end"><button class="btn sm" data-act="rs-units">' + icon('list') + '대상 확정' + ((rs.units || []).length ? ' (' + rs.units.length + '묶음)' : '') + '</button><button class="btn sm primary" data-act="rs-run"' + (u.rsRunning ? ' disabled' : '') + '>' + icon('play') + (u.rsRunning ? '탐색 중…' : '재편성 실행') + '</button></span></div>';
    s += '<div class="pane-body pad" data-sk="o-rs-main">';
    if (u.rsRunning) s += '<div class="progress" style="margin-bottom:10px"><i style="width:55%"></i></div>';
    if (!rex) {
      s += '<div class="empty" style="padding:60px 12px"><b>' + icon('bolt') + ' 아직 재편성 결과가 없습니다</b>옵션을 정하고 「재편성 실행」을 누르면 9~10월 배치 결과와 재편성 규칙 검사 결과가 여기에 나옵니다.</div>';
      return s + '</div>';
    }
    const last = rex.teamMetrics.map((t) => t.lastDate).filter(Boolean).sort().pop();
    const dhs = rex.teamMetrics.reduce((a, t) => a + t.doubleHeaders, 0);
    const mon = rex.units.reduce((a, x) => a + x.days.filter((d) => Dates.weekday(d) === 1).length, 0);
    const placed = rex.units.filter((x) => x.days.length).length;
    s += '<div class="kv-row" style="grid-template-columns:repeat(5,minmax(0,1fr));margin-bottom:10px">' +
      '<div class="kv"><div class="k">' + (S.dev() ? 'RH 위반 (Hard)' : '필수 규칙 위반') + '</div><div class="v">' + (rex.violations.length ? '<span style="color:var(--bad)">' + icon('x') + rex.violations.length + '건</span>' : '<span style="color:var(--ok)">' + icon('check') + '0건</span>') + '</div><div class="s">' + (S.dev() ? 'RH-1~RH-5' : '하루 1경기 · 구장 · 쉬는 날 · 더블헤더 · 미배정') + '</div></div>' +
      '<div class="kv"><div class="k">배치한 묶음</div><div class="v">' + placed + ' / ' + rex.units.length + '</div><div class="s">' + rex.units.reduce((a, x) => a + x.games, 0) + '경기</div></div>' +
      '<div class="kv"><div class="k">마지막 경기일' + (S.dev() ? ' (RS-1)' : '') + '</div><div class="v">' + (last ? esc(fmt.date(last)) : '-') + '</div><div class="s">기간 끝 ' + esc(fmt.date(rs.end)) + '</div></div>' +
      '<div class="kv"><div class="k">더블헤더</div><div class="v">' + dhs / 2 + '회</div><div class="s">구단당 최대 ' + rs.maxDoubleHeaderPerTeam + '</div></div>' +
      '<div class="kv"><div class="k">월요일 경기</div><div class="v">' + mon + '</div><div class="s">' + (rs.allowMonday ? '허용' : '금지 → 0이어야 함') + '</div></div></div>';
    if (rex.violations.length) s += '<div class="blk" style="margin-bottom:10px"><div class="blk-head">' + icon('x') + '재편성 필수 규칙 위반</div><div class="blk-body small">' + rex.violations.slice(0, 4).map((v) => '<div>' + S.ruleLabel(v.code) + ' — ' + esc(S.plain(v.message)) + '</div>').join('') + '</div></div>';
    // 9·10월 달력
    const byDay = new Map();
    for (const x of rex.units) x.days.forEach((d, k) => { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push({ x, dh: x.dh && k === 0 }); });
    s += '<div class="rs-cal">';
    for (const mo of [9, 10]) {
      const first = Dates.dayNum('2025-' + String(mo).padStart(2, '0') + '-01');
      const wdi = (d) => (Dates.weekday(d) + 6) % 7;
      const d0 = first - wdi(first);
      s += '<div class="rs-month"><h5>' + mo + '월</h5><div class="rs-grid">' + ['월', '화', '수', '목', '금', '토', '일'].map((x) => '<div class="hd">' + x + '</div>').join('');
      for (let k = 0; k < 42; k++) {
        const d = d0 + k;
        if (k >= 35 && Dates.month(d) !== mo) break;
        const iso = Dates.isoDate(d);
        const inMo = Dates.month(d) === mo;
        const list = inMo ? (byDay.get(iso) || []) : [];
        const selU = list.some((y) => y.x.unit === u.opsUnit);
        s += '<div class="' + (Dates.weekday(d) === 1 ? 'mon' : '') + (selU ? ' sel' : '') + '" style="height:' + (S.tall ? 96 : 76) + 'px"><span class="dn" style="' + (inMo ? '' : 'color:#C0C5CE') + '">' + Dates.fmtShort(d).split('/')[1] + '</span>' + (list.length ? ' <span class="muted">' + list.length + '경기</span>' : '') +
          list.slice(0, S.tall ? 4 : 3).map((y) => '<span class="rsg new' + (y.dh ? ' dh' : '') + '" data-act="o-unit" data-unit="' + esc(y.x.unit) + '" style="cursor:pointer">' + esc(y.x.away + '@' + y.x.home) + '</span>').join('') + (list.length > (S.tall ? 4 : 3) ? '<span class="rsg muted">+' + (list.length - (S.tall ? 4 : 3)) + '</span>' : '') + '</div>';
      }
      s += '</div></div>';
    }
    s += '</div></div>';
    return s;
  }
  function rsInsp() {
    const u = S.ui, st = app().state;
    const un = (st.reschedule.units || []).find((x) => x.id === u.opsUnit);
    if (!un) {
      return { title: '재편성 규칙', html: '<div class="insp-sec"><h4>' + (S.dev() ? 'Hard (RH)' : '꼭 지킬 규칙') + '</h4>' + Reschedule.HARD_RULES.map((r) => '<div class="small" style="margin-bottom:4px">' + (S.dev() ? '<code class="rc">' + r.code + '</code> ' : '<b>' + esc(S.ruleName(r.code)) + '</b> — ') + esc(S.plain(r.desc)) + '</div>').join('') + '</div><div class="insp-sec"><h4>' + (S.dev() ? 'Soft (RS)' : '되도록 맞출 목표') + '</h4>' + Reschedule.SOFT_RULES.map((r) => '<div class="small" style="margin-bottom:4px">' + (S.dev() ? '<code class="rc">' + r.code + '</code> ' + esc(r.label) : esc(S.plain(r.label))) + '</div>').join('') + '</div><div class="empty">묶음을 고르면 원래 경기와 배치 날짜가 여기에 나옵니다.</div>' };
    }
    const p = (st.reschedule.plan || []).find((x) => x.unit === un.id);
    let s = '<div class="insp-sec"><div class="insp-title">' + S.team(un.away) + '<span class="muted">@</span>' + S.team(un.home) + '</div><div class="insp-sub">' + un.games + '경기 묶음 · ' + esc(un.id) + '</div></div>';
    s += '<div class="insp-sec"><h4>원래 경기</h4>' + un.sources.map((x) => '<div class="small" style="display:flex;gap:6px;height:22px;align-items:center">' + (x.kind === 'CANCELLED' ? '<span class="st plain bad">' + icon('x') + '취소</span>' + esc(fmt.date(x.date)) + ' · ' + esc(REASONS[x.reason] || '') : '<span class="st plain todo">' + icon('todo') + '잔여</span>목표 16경기 − 1차 15경기') + '</div>').join('') + '</div>';
    s += '<div class="insp-sec"><h4>배치</h4><dl class="props"><dt>시작일</dt><dd>' + (p && p.start ? esc(fmt.date(p.start)) : '<span class="muted">미배치</span>') + '</dd><dt>더블헤더</dt><dd>' + (p && p.dh ? '<span class="tag" style="color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn-line)">DH</span>' : '아니오') + '</dd><dt>구장</dt><dd>' + esc((app().team(un.home) || {}).stadium || '') + '</dd></dl></div>';
    return { title: '묶음 상세', html: s };
  }

  function runReschedule(sync) {
    const go = () => {
      if (!(app().state.reschedule.units || []).length) app().buildRescheduleUnits();
      try {
        const search = Reschedule.createSearch(Reschedule.buildInput(app().state), { seed: 42 });
        search.step(4000);
        const plan = search.bestPlanList();
        app().commit('재편성 결과 반영', (s) => { s.reschedule.plan = plan; }, ['reschedule']);
      } catch (e) { console.error(e); S.toast('재편성 탐색 실패: ' + e.message, 'bad'); }
      S.ui.rsRunning = false;
      const rex = app().rescheduleExplain();
      if (!sync) S.toast('재편성 완료 — ' + (S.dev() ? 'RH 위반 ' : '필수 규칙 위반 ') + (rex ? rex.violations.length : 0) + '건', rex && !rex.violations.length ? 'ok' : 'warn');
      S.render();
    };
    if (sync) { go(); return; }
    S.ui.rsRunning = true; S.render();
    setTimeout(go, 900);
  }

  S.ops = {
    render() {
      S.wide = window.innerWidth >= 1800; S.tall = window.innerHeight >= 900;
      if (S.ui.ops === 'route' && !S.feature('A6')) S.ui.ops = 'games';
      if (S.ui.ops === 'route') {
        // opt-3 경로 극장형: 3분할 대신 지도 한 장 + 구단 칩 + 하단 스크러버 (인스펙터 없음)
        return '<div class="stepview no-band">' + S.route.render() + '</div>';
      }
      if (S.ui.ops === 'reschedule') {
        const insp = rsInsp();
        return '<div class="stepview no-band">' + S.workspace({ list: rsList(), main: rsMain(), insp: insp.html, inspTitle: insp.title, listLabel: '재편성 대상' }) + '</div>';
      }
      if (!S.ui.opsDate) {
        const ref = app().referenceDate();
        const od = initialGames().find((g) => g.status === 'SCHEDULED' && g.date < ref);
        S.ui.opsDate = od ? od.date : ref;
      }
      const insp = progressInsp();
      return '<div class="stepview no-band">' + S.workspace({ list: gamesList(), main: gamesMain(), insp: insp.html, inspTitle: insp.title, listLabel: '경기일' }) + '</div>';
    },
    after() {
      if (S.ui.ops === 'games') S.revealSelected('.li.active', '.pane.list .pane-body');
      if (S.ui.ops === 'route') S.route.after(); else S.route.stop();
    }
  };

  function gameByKey(key) { return app().games().find((g) => g.key === key); }
  Object.assign(S.actions, {
    'o-date': (el) => S.go({ opsDate: el.dataset.date }),
    'o-set': (el) => { const g = gameByKey(el.dataset.key); if (g) app().setGameStatus(g, el.dataset.status, el.dataset.status === 'CANCELLED' ? 'RAIN' : undefined); },
    'o-bulk': (el) => { const r = document.getElementById('bulkReason'); app().setDayStatus(S.ui.opsDate, el.dataset.status, r ? r.value : 'RAIN'); S.toast(fmt.date(S.ui.opsDate) + ' 경기를 일괄 ' + Reschedule.STATUS[el.dataset.status] + '(으)로 기록했습니다.', 'ok'); },
    'o-unit': (el) => S.go({ opsUnit: el.dataset.unit }),
    'rs-units': () => { app().buildRescheduleUnits(); },
    'rs-run': () => runReschedule(false)
  });
  S.inputs['o-reason'] = (el) => { const g = gameByKey(el.dataset.key); if (g) app().setGameStatus(g, 'CANCELLED', el.value); };
  S.inputs['rs-opt'] = (el) => app().updateReschedule({ [el.dataset.k]: el.checked });
  S.inputs['rs-max'] = (el) => { const v = parseInt(el.value, 10); if (v >= 0) app().updateReschedule({ maxDoubleHeaderPerTeam: v }); };
  S.inputs['rs-date'] = (el) => { const v = S.parse.date(el.value); if (v) app().updateReschedule({ [el.dataset.k]: v }); else S.toast("날짜로 읽을 수 없습니다: '" + el.value + "'", 'bad'); };

  // opt-3: 재편성을 실행한 뒤 이동 경로로 (9~10월 재편성 구간 스크린샷용)
  S.demos.resched = function () { S.ui.ops = 'route'; runReschedule(true); if (S.route.bootLeg != null) S.ui.routePos = S.route.bootLeg; S.render(); };
  S.demos.result = function () { S.ui.ops = 'reschedule'; runReschedule(true); const u = (app().state.reschedule.units || [])[0]; if (u) S.ui.opsUnit = u.id; S.render(); };
})();
