/*
 * alt-b 단계 레일 — 시즌 운영 (위저드 밖 별도 메뉴, §3.5).
 * 경기 기록: 왼쪽 날짜 선택 + 그날 경기 일괄 처리 ↔ 오른쪽 시즌 진행 현황(FR-P7).
 * 재편성: 왼쪽 대상·옵션 ↔ 오른쪽 수용 게이지(옵션을 바꾸면 즉시) + 재편성 결과(RH 규칙 점검, 9~10월 달력).
 */
(function () {
  'use strict';
  const R = window.R;
  const KBO = R.KBO, D = KBO.Dates, RS = KBO.Reschedule;
  const esc = R.esc;
  const ops = (R.ops = { date: '2025-07-18', month: 7, running: false, progress: 0 });
  const REASONS = { RAIN: '우천', HEAT: '폭염', DUST: '미세먼지', GROUND: '그라운드 사정', ETC: '기타' };

  function refDay() { return D.dayNum(R.state().settings.referenceDate || '2025-07-20'); }
  function gamesByDate() {
    const m = new Map();
    for (const g of R.games()) { if (g.source !== 'INITIAL') continue; if (!m.has(g.date)) m.set(g.date, []); m.get(g.date).push(g); }
    return m;
  }

  // ───────── 경기 기록 ─────────
  function dayStatus(list, day) {
    if (!list || !list.length) return null;
    if (list.some((g) => g.status === 'CANCELLED')) return 'cancel';
    if (list.every((g) => g.status === 'PLAYED')) return 'done';
    if (day < refDay() && R.feature('P2')) return 'missing';
    return 'sched';
  }
  function picker() {
    const by = gamesByDate();
    const mo = ops.month;
    const first = D.dayNum('2025-' + String(mo).padStart(2, '0') + '-01');
    const last = D.dayNum('2025-' + String(mo + 1).padStart(2, '0') + '-01') - 1;
    const lead = (D.weekday(first) + 6) % 7;
    let s = '<div class="dp"><div class="dp-h"><button class="ibtn" data-act="dp-mo" data-d="-1" aria-label="이전 달"' + (mo <= 3 ? ' disabled' : '') + '>' + R.icon('chevL') + '</button><b>' + mo + '월</b><button class="ibtn" data-act="dp-mo" data-d="1" aria-label="다음 달"' + (mo >= 8 ? ' disabled' : '') + '>' + R.icon('chevR') + '</button></div><div class="dp-g">' + ['월', '화', '수', '목', '금', '토', '일'].map((w) => '<span class="dp-w">' + w + '</span>').join('');
    for (let i = 0; i < lead; i++) s += '<span></span>';
    for (let n = first; n <= last; n++) {
      const iso = D.isoDate(n);
      const list = by.get(iso);
      const st = dayStatus(list, n);
      const lbl = { done: '완료', cancel: '취소 있음', missing: '결과 미입력', sched: '예정' }[st] || '경기 없음';
      s += '<button class="dp-d' + (st ? ' ' + st : ' none') + (iso === ops.date ? ' is-on' : '') + (n === refDay() ? ' ref' : '') + '" data-act="dp-day" data-date="' + iso + '"' + (st ? '' : ' disabled') + ' title="' + D.fmtDate(n) + ' · ' + lbl + '" aria-label="' + D.fmtDate(n) + ' ' + lbl + '"><span>' + D.fmtShort(n).split('/')[1] + '</span>' + (st === 'done' ? '<i class="m ok"></i>' : st === 'cancel' ? '<i class="m x">×</i>' : st === 'missing' ? '<i class="m warn">!</i>' : '') + '</button>';
    }
    s += '</div><div class="legend dp-lg"><span><i class="m ok"></i>완료</span><span><i class="m x">×</i>취소 있음</span>' + (R.feature('P2') ? '<span><i class="m warn">!</i>결과 미입력</span>' : '') + '<span><i class="lg ref"></i>기준일 ' + D.fmtDate(refDay()) + '</span></div></div>';
    return s;
  }
  function gamesLeft(d) {
    const by = gamesByDate();
    const list = by.get(ops.date) || [];
    const n = D.dayNum(ops.date);
    const missing = list.length && list.every((g) => g.status === 'SCHEDULED') && n < refDay() && R.feature('P2');
    let rows = list.map((g, i) => {
      const seg = ['SCHEDULED', 'PLAYED', 'CANCELLED'].map((s) => '<button class="' + (g.status === s ? 'is-on' : '') + '" data-act="g-set" data-i="' + i + '" data-s="' + s + '">' + { SCHEDULED: '예정', PLAYED: '완료', CANCELLED: '취소' }[s] + '</button>').join('');
      return '<tr class="' + (g.status === 'CANCELLED' ? 'cx' : '') + '"><td>' + R.team(g.away) + ' <span class="at">@</span> ' + R.team(g.home, { strong: true }) + '</td><td class="muted">' + esc(R.shortStadium(g.stadium)) + '</td><td><div class="seg gseg">' + seg + '</div></td><td>' + (g.status === 'CANCELLED' ? '<select class="inp" data-in="g-reason" data-i="' + i + '">' + Object.keys(REASONS).map((k) => '<option value="' + k + '"' + (g.reason === k ? ' selected' : '') + '>' + REASONS[k] + '</option>').join('') + '</select>' : '') + '</td></tr>';
    }).join('');
    const body = '<div class="gl">' + picker() + '<div class="gday"><div class="sect-h"><h3>' + D.fmtDate(n) + ' 경기 ' + list.length + '</h3>' + (missing ? R.st('warn', '결과 미입력') : '') + '<span class="hint">한 날짜의 경기를 한 번에 처리</span></div>' +
      '<div class="btns gbulk"><button class="btn btn-sm btn-primary" data-act="g-all" data-s="PLAYED">' + R.icon('ok') + '모두 완료</button><button class="btn btn-sm" data-act="g-all" data-s="CANCELLED">모두 취소</button><select class="inp" id="bulk-reason" aria-label="일괄 취소 사유">' + Object.keys(REASONS).map((k) => '<option value="' + k + '">' + REASONS[k] + '</option>').join('') + '</select></div>' +
      (list.length ? '<table class="tbl gtbl"><thead><tr><th>대진</th><th>구장</th><th>상태</th><th>취소 사유</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="hint">이 날은 경기가 없습니다.</p>') +
      '<p class="hint">취소한 경기는 재편성 대상에 자동으로 더해집니다. 기록도 실행 취소할 수 있습니다.</p>' + cancelList() + '</div></div>';
    return R.pane({ title: '경기 기록', sub: '날짜를 고르고 그날 경기를 처리합니다', body, sk: 'games' });
  }
  function cancelList() {
    const cx = R.games().filter((g) => g.source === 'INITIAL' && g.status === 'CANCELLED');
    return '<div class="sect"><div class="sect-h"><h3>취소 기록 ' + cx.length + '건</h3><span class="hint">재편성 대상에 포함</span></div><table class="tbl"><thead><tr><th>날짜</th><th>대진</th><th>사유</th><th></th></tr></thead><tbody>' +
      cx.map((g) => '<tr><td>' + D.fmtDate(g.date) + '</td><td>' + esc(g.away) + ' @ <b>' + esc(g.home) + '</b></td><td>' + R.st('block', REASONS[g.reason] || g.reason) + '</td><td class="n"><button class="lnk" data-act="dp-day" data-date="' + g.date + '">이 날로</button></td></tr>').join('') + '</tbody></table></div>';
  }
  function progressRight(d) {
    if (!R.feature('P7')) return '';
    const st = R.state();
    const tg = R.targets();
    const tt = tg.totals;
    const all = R.games().filter((g) => g.source === 'INITIAL');
    const missing = all.filter((g) => g.status === 'SCHEDULED' && g.day < refDay()).length;
    let b = '<div class="kpis k2">' + R.kpi('소화', R.fmt.int(tt.played) + '<small>경기</small>', '1차 ' + all.length + '경기 중', 'k-teal', 'p1') + R.kpi('취소', tt.cancelled + '<small>경기</small>', '재편성 대상', tt.cancelled ? 'k-bad' : '', 'p2') +
      R.kpi('남은 1차', R.fmt.int(tt.scheduled) + '<small>경기</small>', (R.feature('P2') && missing ? '미입력 ' + missing : '예정'), '', 'p3') + R.kpi('재편성 대상', tt.need + '<small>경기</small>', '잔여 ' + tt.remaining + ' + 취소 ' + tt.cancelled, '', 'p4') + '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>구단별 진행</h3><span class="legend"><span><i class="lg" style="background:var(--teal)"></i>완료</span><span><i class="lg" style="background:var(--bad)"></i>취소</span><span><i class="lg" style="background:var(--teal-100)"></i>예정</span><span><i class="lg lg-away"></i>재편성</span></span></div><div class="prog">' +
      tg.byTeam.map((t) => { const tot = t.played + t.cancelled + t.scheduled + t.remaining; const w = (x) => (x / tot * 100).toFixed(2) + '%'; return '<div class="prog-r"><span class="prog-n">' + R.team(t.team) + '</span><div class="prog-b"><i style="width:' + w(t.played) + ';background:var(--teal)"></i><i style="width:' + w(t.cancelled) + ';background:var(--bad)"></i><i style="width:' + w(t.scheduled) + ';background:var(--teal-100)"></i><i class="rem" style="width:' + w(t.remaining) + '"></i></div><span class="prog-v num">' + t.played + '<small>/' + (tot) + '</small></span></div>'; }).join('') + '</div></div>';
    b += gauge(d, true);
    return R.pane({ cls: 'pane-live', title: '시즌 진행 현황', kicker: '즉시 결과', live: true, body: b, sk: 'prog' });
  }
  function capacity() {
    const st = R.state();
    const rs = st.reschedule;
    const days = RS.windowDays(st);
    const allowed = days.filter((x) => !x.forbidden && (rs.allowMonday || !x.monday)).length;
    const need = R.targets().totals.need;
    const perTeam = R.targets().byTeam.map((t) => t.remaining + t.cancelled);
    const maxTeam = Math.max(...perTeam);
    const teamDays = allowed + (rs.allowDoubleHeader ? rs.maxDoubleHeaderPerTeam : 0);
    return { allowed, need, cap: allowed * 5, maxTeam, teamDays, mondays: days.filter((x) => x.monday).length, total: days.length };
  }
  function gauge(d, compact) {
    const c = capacity();
    const ok = c.maxTeam <= c.teamDays;
    return '<div class="sect gauge' + (compact ? ' compact' : '') + '"><div class="sect-h"><h3>재편성 기간 수용</h3>' + R.st(ok ? 'ok' : 'block', ok ? '수용 가능' : '부족') + '<span class="hint">' + D.fmtDate(R.state().reschedule.start) + '~' + D.fmtDate(R.state().reschedule.end) + '</span></div>' +
      '<div class="g-row"><span>리그 전체</span>' + R.chart.meter(c.need, c.cap, { title: '리그 수용' }) + '<b class="num">' + c.need + ' / ' + c.cap + '경기</b></div>' +
      '<div class="g-row"><span>가장 바쁜 구단</span>' + R.chart.meter(c.maxTeam, c.teamDays, { title: '구단 수용', color: ok ? 'var(--teal)' : 'var(--bad)' }) + '<b class="num">' + c.maxTeam + ' / ' + c.teamDays + '일</b></div>' +
      '<p class="hint">가능 경기일 ' + c.allowed + '일 (기간 ' + c.total + '일 · 월요일 ' + c.mondays + '일 ' + (R.state().reschedule.allowMonday ? '포함' : '제외') + ')' + (R.state().reschedule.allowDoubleHeader ? ' · DH로 구단당 ' + R.state().reschedule.maxDoubleHeaderPerTeam + '일 추가' : '') + '</p></div>';
  }

  // ───────── 재편성 ─────────
  function reschedLeft(d) {
    const st = R.state();
    const rs = st.reschedule;
    const tg = R.targets();
    const dis = ops.running ? ' disabled' : '';
    let b = '<div class="kpis k3 kpis-sm">' + R.kpi('잔여 경기', tg.totals.remaining + '<small>경기</small>', '구단쌍 16 − 1차 15') + R.kpi('취소 경기', tg.totals.cancelled + '<small>경기</small>', '경기 기록에서') + R.kpi('재편성 대상', tg.totals.need + '<small>경기</small>', RS.buildUnits(tg).length + '개 묶음(1~3경기)', 'k-teal') + '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>재편성 옵션</h3><span class="hint">바꾸면 오른쪽 수용 게이지가 바로 바뀝니다</span></div><div class="frow3">' +
      '<div class="field"><label for="rs-s">시작</label><input class="inp" type="date" id="rs-s" value="' + rs.start + '" data-in="rs" data-k="start"' + dis + '></div><div class="field"><label for="rs-e">종료</label><input class="inp" type="date" id="rs-e" value="' + rs.end + '" data-in="rs" data-k="end"' + dis + '></div><div class="field"><label for="rs-dh">구단당 최대 DH</label><input class="inp" type="number" min="0" max="8" id="rs-dh" value="' + rs.maxDoubleHeaderPerTeam + '" data-in="rs" data-k="maxDoubleHeaderPerTeam"' + (rs.allowDoubleHeader ? '' : ' disabled') + dis + '></div></div>' +
      '<div class="rs-sw"><label class="sw"><input type="checkbox" data-in="rs-b" data-k="allowMonday"' + (rs.allowMonday ? ' checked' : '') + dis + '><span class="tr"></span><span>월요일 경기 허용</span></label><label class="sw"><input type="checkbox" data-in="rs-b" data-k="allowDoubleHeader"' + (rs.allowDoubleHeader ? ' checked' : '') + dis + '><span class="tr"></span><span>더블헤더(DH) 허용</span></label></div>' +
      '<div class="field" style="margin-top:10px"><span class="flabel">경기 없는 날</span><div class="chips">' + ((rs.blackouts || []).map((x, i) => '<span class="chipx">' + D.fmtDate(x.start) + ' ' + esc(x.label || '') + '<button data-act="rs-rmb" data-i="' + i + '" aria-label="삭제">×</button></span>').join('') || '<span class="hint">없음</span>') + '<button class="btn btn-sm" data-act="rs-addb"' + dis + '>' + R.icon('plus') + '추석 연휴 10/5~10/8</button></div></div></div>';
    b += '<details class="fold" open><summary>홈 구단별 대상 <span class="hint">' + tg.needs.length + '개 대진</span></summary><div class="fold-b"><table class="tbl"><thead><tr><th>대진 (원정 @ 홈)</th><th class="n">잔여</th><th class="n">취소</th></tr></thead><tbody>' + tg.needs.slice(0, 60).map((n) => '<tr><td>' + esc(n.away) + ' @ <b>' + esc(n.home) + '</b></td><td class="n">' + n.remaining + '</td><td class="n">' + (n.cancelled.length ? '<b class="bad">' + n.cancelled.length + '</b>' : '0') + '</td></tr>').join('') + '</tbody></table></div></details>';
    const foot = '<button class="btn btn-primary" data-act="rs-run"' + dis + '>' + (ops.running ? R.icon('run', 'spin') + '재편성 중 ' + Math.round(ops.progress * 100) + '%' : '재편성 실행') + '</button><span class="hint">치른 경기와 9/1 이전 일정은 자동 고정 · 시뮬레이션 엔진</span>' + R.mock();
    return R.pane({ title: '재편성 대상과 옵션', body: b, foot, sk: 'rs' });
  }
  function reschedRight(d) {
    const st = R.state();
    const rs = st.reschedule;
    let b = gauge(d);
    const has = (rs.plan || []).length && (rs.units || []).length;
    if (!has) {
      b += '<div class="note">' + R.icon('todo') + '<span>아직 재편성 결과가 없습니다. 왼쪽 아래 <b>재편성 실행</b>을 누르면 결과와 RH 규칙 점검이 여기에 나옵니다.</span></div>';
      return R.pane({ cls: 'pane-live', title: '재편성 결과', kicker: '즉시 결과', live: true, body: b, sk: 'rsr' });
    }
    const ex = R.rexCache && R.rexCache.v === R.store.version ? R.rexCache.ex : (R.rexCache = { v: R.store.version, ex: RS.explain(st) }).ex;
    const placed = ex.units.filter((x) => x.start).reduce((a, x) => a + x.games, 0);
    const total = ex.units.reduce((a, x) => a + x.games, 0);
    const lastDate = ex.teamMetrics.map((t) => t.lastDate).filter(Boolean).sort().pop();
    const dh = ex.units.filter((x) => x.dh).length;
    const mon = ex.teamMetrics.reduce((a, t) => a + t.mondayGames, 0) / 2;
    const stale = R.rsOptsKey && R.rsOptsKey !== optsKey();
    b += '<div class="sect"><div class="sect-h"><h3>결과</h3>' + (stale ? R.st('warn', '옵션이 바뀜 — 다시 실행') : R.st(ex.feasible ? 'ok' : 'block', ex.feasible ? 'RH 위반 0' : 'RH 위반 ' + ex.violations.length)) + '</div><div class="kpis k4 kpis-sm">' + R.kpi('배정', placed + '/' + total, '경기', placed === total ? 'k-ok' : 'k-bad') + R.kpi('마지막 경기일', lastDate ? D.fmtShort(lastDate) : '-', lastDate ? D.fmtDate(lastDate) : '') + R.kpi('더블헤더', dh + '<small>회</small>', '최대 ' + rs.maxDoubleHeaderPerTeam + '/구단') + R.kpi('월요일', mon + '<small>경기</small>', rs.allowMonday ? '허용' : '미허용') + '</div></div>';
    b += '<div class="sect"><ul class="rhl">' + Object.values(ex.byCode).map((r) => '<li>' + R.stIcon(r.count ? 'block' : 'ok') + '<b>' + r.code + '</b><span>' + esc(r.label) + '</span><span class="cnt">' + (r.count ? r.count + '건' : '0') + '</span></li>').join('') + '</ul></div>';
    // 9~10월 달력
    const byDay = new Map();
    for (const x of ex.units) for (const dd of x.days) { if (!byDay.has(dd)) byDay.set(dd, []); byDay.get(dd).push(x); }
    let cal = '<div class="rcal">';
    for (const mo of [9, 10]) {
      const first = D.dayNum('2025-' + String(mo).padStart(2, '0') + '-01');
      const last = D.dayNum(mo === 9 ? '2025-09-30' : '2025-10-31');
      const lead = (D.weekday(first) + 6) % 7;
      cal += '<div class="rcal-m"><b>' + mo + '월</b><div class="rcal-g">' + ['월', '화', '수', '목', '금', '토', '일'].map((w) => '<span class="dp-w">' + w + '</span>').join('') + '<span></span>'.repeat(lead);
      for (let n = first; n <= last; n++) {
        const iso = D.isoDate(n);
        const us = byDay.get(iso) || [];
        const inW = iso >= rs.start && iso <= rs.end;
        cal += '<span class="rc' + (us.length ? ' has' : '') + (inW ? '' : ' out') + (D.weekday(n) === 1 ? ' mon' : '') + '" title="' + esc(D.fmtDate(n) + (us.length ? ' · ' + us.map((x) => x.away + '@' + x.home + (x.dh ? ' DH' : '')).join(', ') : '')) + '"><span class="rc-d">' + D.fmtShort(n).split('/')[1] + '</span>' + (us.length ? '<b>' + us.length + '</b>' : '') + (us.some((x) => x.dh && x.days[0] === iso) ? '<i class="dh">DH</i>' : '') + '</span>';
      }
      cal += '</div></div>';
    }
    cal += '</div>';
    b += '<div class="sect"><div class="sect-h"><h3>9~10월 재편성 일정</h3><span class="hint">숫자 = 그날 경기 수 · 마우스를 올리면 대진</span></div>' + cal + '</div>';
    return R.pane({ cls: 'pane-live', title: '재편성 결과', kicker: '즉시 결과', live: true, body: b, sk: 'rsr', tools: '<button class="btn btn-sm" data-act="go" data-view="ops" data-tab="games">경기 기록으로</button>' });
  }
  function optsKey() { const rs = R.state().reschedule; return [rs.start, rs.end, rs.allowMonday, rs.allowDoubleHeader, rs.maxDoubleHeaderPerTeam, (rs.blackouts || []).length, R.targets().totals.need].join('|'); }

  function runReschedule(sync) {
    const st = R.state();
    const p = JSON.parse(JSON.stringify(st));
    const tg = RS.computeTargets(p);
    p.reschedule.units = RS.buildUnits(tg);
    p.reschedule.plan = [];
    const input = RS.buildInput(p);
    const search = RS.createSearch(input, { seed: 42 });
    const N = 40;
    let i = 0;
    ops.running = true; ops.progress = 0;
    const done = () => {
      ops.running = false;
      const plan = search.bestPlanList();
      R.commit('재편성 실행', (s) => { s.reschedule.units = p.reschedule.units; s.reschedule.plan = plan; }, { force: true });
      R.rsOptsKey = optsKey();
      if (!sync) R.toast('재편성을 마쳤습니다 (시뮬레이션). 결과를 오른쪽에서 확인하세요.', 'ok');
    };
    if (sync) { for (; i < N; i++) search.step(2000); done(); return; }
    const chunk = () => { for (let k = 0; k < 4 && i < N; k++, i++) search.step(2000); ops.progress = i / N; R.render(); if (i < N) setTimeout(chunk, 60); else done(); };
    R.render();
    setTimeout(chunk, 60);
  }

  R.screens['ops-games'] = { left: gamesLeft, right: progressRight };
  R.screens['ops-reschedule'] = { left: reschedLeft, right: reschedRight };

  function setGame(g, status, reason) {
    const label = D.fmtDate(g.date) + ' ' + g.away + '@' + g.home + ' → ' + { SCHEDULED: '예정', PLAYED: '완료', CANCELLED: '취소' }[status];
    R.commit('경기 기록: ' + label, (s) => { RS.setGameStatus(s, g, status, reason); }, { force: true });
  }
  Object.assign(R.act, {
    'dp-mo'(el) { ops.month = Math.min(8, Math.max(3, ops.month + +el.getAttribute('data-d'))); R.render(); },
    'dp-day'(el) { ops.date = el.getAttribute('data-date'); ops.month = D.month(ops.date); R.render(); },
    'g-set'(el) { const g = (gamesByDate().get(ops.date) || [])[+el.getAttribute('data-i')]; if (!g) return; const s = el.getAttribute('data-s'); if (g.status === s) return; setGame(g, s, s === 'CANCELLED' ? 'RAIN' : undefined); },
    'g-all'(el) {
      const s = el.getAttribute('data-s');
      const reason = (document.getElementById('bulk-reason') || {}).value || 'RAIN';
      const list = gamesByDate().get(ops.date) || [];
      R.commit('경기 기록: ' + D.fmtDate(ops.date) + ' ' + list.length + '경기 모두 ' + (s === 'PLAYED' ? '완료' : '취소(' + REASONS[reason] + ')'), (st) => { for (const g of list) RS.setGameStatus(st, g, s, reason); }, { force: true });
      R.toast(D.fmtDate(ops.date) + ' ' + list.length + '경기를 ' + (s === 'PLAYED' ? '완료로' : '취소(' + REASONS[reason] + ')로') + ' 기록했습니다.' + (s === 'CANCELLED' ? ' 재편성 대상이 ' + list.length + '경기 늘었습니다.' : ''), s === 'PLAYED' ? 'ok' : 'warn');
    },
    'rs-run'() { if (!ops.running) runReschedule(false); },
    'rs-addb'() { R.commit('재편성 경기 없는 날 추가', (s) => { s.reschedule.blackouts = (s.reschedule.blackouts || []).concat([{ start: '2025-10-05', end: '2025-10-08', label: '추석 연휴' }]); }, { force: true }); },
    'rs-rmb'(el) { const i = +el.getAttribute('data-i'); R.commit('재편성 경기 없는 날 삭제', (s) => { s.reschedule.blackouts.splice(i, 1); }, { force: true }); }
  });
  R.inputs['g-reason'] = (el) => { const g = (gamesByDate().get(ops.date) || [])[+el.getAttribute('data-i')]; if (g) setGame(g, 'CANCELLED', el.value); };
  R.inputs.rs = (el) => { const k = el.getAttribute('data-k'); const v = k === 'maxDoubleHeaderPerTeam' ? Math.max(0, Number(el.value) || 0) : el.value; if (!v && v !== 0) return; R.commit('재편성 옵션: ' + k, (s) => { s.reschedule[k] = v; }, { force: true }); };
  R.inputs['rs-b'] = (el) => { const k = el.getAttribute('data-k'); const v = el.checked; R.commit('재편성 옵션: ' + (k === 'allowMonday' ? '월요일 ' : 'DH ') + (v ? '허용' : '미허용'), (s) => { s.reschedule[k] = v; }, { force: true }); };
  R.demo = R.demo || {};
  R.demo.result = () => { runReschedule(true); };
  R.demo.date = (v) => { ops.date = v; ops.month = D.month(v); };
})();
