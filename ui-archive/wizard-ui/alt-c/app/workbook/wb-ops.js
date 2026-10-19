/*
 * alt-c 편성 워크북 — 시즌 운영 (위저드 밖 별도 화면).
 * 경기 기록 시트(날짜 × 경기, 일괄 처리·취소 사유, 결과 미입력 강조), 시즌 진행 현황,
 * 재편성 시트(대상 묶음 · 옵션 · 실행 목업 · 결과 목록/달력, RH 규칙).
 */
(function () {
  'use strict';
  const WB = window.WB;
  const KBO = window.KBO;
  const D = KBO.Dates, R = KBO.Reschedule;
  const esc = WB.esc, icon = WB.icon;
  const O = WB.Ops = {};
  const REASONS = R.REASONS;

  O.header = function () {
    const app = WB.app;
    const games = app.games().filter((g) => g.source === 'INITIAL');
    const played = games.filter((g) => g.status === 'PLAYED').length;
    const canc = games.filter((g) => g.status === 'CANCELLED').length;
    const over = WB.feature('P2') ? app.overdueGames().length : 0;
    const t = app.targets().totals;
    return '<span class="ttl">' + icon('ops', 'ic-l') + '시즌 운영</span><span class="ds">1차 편성 위저드와 분리된 작업 · 확정 일정 기준 · 기준일 ' + D.fmtDate(app.referenceDate()) + '</span>' +
      '<span class="grow" style="flex:1"></span>' + WB.st('ok', '완료 ' + played) + WB.st('bad', '취소 ' + canc) + (WB.feature('P2') ? WB.st('warn', '결과 미입력 ' + over) : '') + WB.st('info', '재편성 대상 ' + t.need + '경기') +
      '<button class="btn box" data-act="go-wizard" style="margin-left:8px">' + icon('left') + '1차 편성 위저드로</button>';
  };

  // ───────────── 경기 기록 ─────────────
  function dates() {
    const by = new Map();
    for (const g of WB.app.games()) { if (g.source !== 'INITIAL') continue; if (!by.has(g.date)) by.set(g.date, []); by.get(g.date).push(g); }
    return Array.from(by.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }
  function gStatus(g) {
    const ref = WB.app.referenceDate();
    if (g.status === 'PLAYED') return { t: '완료', i: 'ok', cls: '' };
    if (g.status === 'CANCELLED') return { t: '취소·' + (REASONS[g.reason] || '기타'), i: 'bad', cls: 'cf-bad' };
    if (WB.feature('P2') && g.date < ref) return { t: '미입력', i: 'warn', cls: 'cf-warn' };
    return { t: '예정', i: 'todo', cls: '' };
  }
  function gamesGrid() {
    const ds = dates();
    const host = document.getElementById('gridhost');
    const gw = Math.max(140, Math.floor(((host.clientWidth || 1100) - 38 - 108 - 132 - 120 - 16) / 5));
    const cols = [{ label: '날짜', w: 108 }, { label: '그날 상태', w: 132 }].concat([1, 2, 3, 4, 5].map((i) => ({ label: '경기 ' + i + ' (원정 @ 홈 · 상태)', w: gw }))).concat([{ label: '슬롯', w: 120 }]);
    const ref = WB.app.referenceDate();
    return {
      key: 'ops-games', sheet: '경기 기록', cols, rows: ds.length, frozen: 1, fill: 0, readOnly: true,
      rowCls: (r) => (ds[r][0] === WB.ui.opsDate ? 'r-hl' : ''),
      cell: (r, c) => {
        const [date, list] = ds[r];
        if (c === 0) return { t: D.fmtDate(date), cls: date === ref ? 'cf-info' : '' };
        if (c === 1) {
          const n = { P: 0, C: 0, O: 0, S: 0 };
          list.forEach((g) => { const s = gStatus(g); if (s.i === 'ok') n.P++; else if (s.i === 'bad') n.C++; else if (s.i === 'warn') n.O++; else n.S++; });
          if (n.O) return { h: icon('warn') + ' 결과 미입력 ' + n.O, cls: 'cf-warn', mk: { level: 'warn', title: '결과 미입력 (FR-P2)', text: '기준일 ' + D.fmtDate(ref) + ' 이전인데 예정 상태입니다.' } };
          if (n.C) return { h: icon('bad') + ' 취소 ' + n.C + (n.P ? ' · 완료 ' + n.P : ''), cls: 'cf-bad' };
          if (n.P) return { h: icon('ok') + ' 완료 ' + n.P, cls: 'cf-ok' };
          return { h: icon('todo') + ' 예정 ' + n.S };
        }
        if (c === 7) { const s = WB.app.derived().slots[list[0].slot]; return { t: s ? '#' + (s.index + 1) + ' ' + (list[0].seq + 1) + '/' + s.consecutive + '일째' : '', cls: 'dv' }; }
        const g = list[c - 2];
        if (!g) return { t: '' };
        const s = gStatus(g);
        return { h: '<span class="gm"><span class="aw">' + esc(g.away) + '</span><span class="at">@</span><span class="hm">' + esc(g.home) + '</span><span class="grow" style="flex:1"></span>' + icon(s.i) + '<span style="font-size:11px">' + esc(s.t) + '</span></span>', cls: s.cls };
      },
      onSelect: (r, c) => {
        const [date, list] = ds[r];
        WB.ui.opsDate = date;
        const g = c >= 2 && c <= 6 ? list[c - 2] : null;
        WB.fx({ addr: '경기 기록!' + WB.colName(c) + (r + 2), value: g ? g.away + ' @ ' + g.home + ' · ' + gStatus(g).t : D.fmtDate(date) + ' · ' + list.length + '경기', meta: g ? esc(g.stadium) + ' · 시리즈 #' + (g.match + 1) : '오른쪽 창에서 그날 경기를 한 번에 처리', level: g && gStatus(g).i === 'warn' ? 'warn' : '', msg: g && gStatus(g).i === 'warn' ? '기준일 이전 예정 경기 — 결과를 입력하세요' : '' });
        document.querySelectorAll('#gridhost tr.r-hl').forEach((x) => x.classList.remove('r-hl'));
        const tr = document.querySelector('#gridhost tr[data-r="' + r + '"]'); if (tr) tr.classList.add('r-hl');
        renderPane();
      }
    };
  }

  // ───────────── 재편성 ─────────────
  function rex() { return WB.app.rescheduleExplain(); }
  function reschedGrid() {
    const app = WB.app;
    const units = app.state.reschedule.units || [];
    const x = rex();
    const info = new Map(x ? x.units.map((u) => [u.unit, u]) : []);
    const vio = new Map(); if (x) x.violations.forEach((v) => (v.units || []).forEach((u) => vio.set(u, (vio.get(u) || []).concat(v.code))));
    let list = units, preview = false;
    if (!units.length) { list = R.buildUnits(app.targets()); preview = true; }
    const cols = [{ label: '묶음', w: 110 }, { label: '홈', w: 64 }, { label: '원정', w: 64 }, { label: '경기 수', w: 64, cls: 'n' }, { label: '구분', w: 150 }, { label: '배정 시작일', w: 116 }, { label: '배정일', w: 200 }, { label: 'DH', w: 50, cls: 'c' }, { label: '상태 (RH)', w: 130 }];
    return {
      key: 'ops-resched', sheet: '재편성', cols, rows: list.length, fill: 0, readOnly: true,
      cell: (r, c) => {
        const u = list[r];
        const it = info.get(u.id);
        const canc = (u.sources || []).filter((s) => s.kind === 'CANCELLED' || s.cancelled).length;
        if (c === 0) return { t: u.id, cls: 'mono' };
        if (c === 1) return { t: u.home };
        if (c === 2) return { t: u.away };
        if (c === 3) return { t: u.games };
        if (c === 4) { const src = (u.sources || []).map((s) => (s.date ? '취소 ' + D.fmtShort(s.date) : '잔여')).join(' · '); return { t: src || '잔여 ' + u.games, title: src }; }
        if (c === 5) return { t: it && it.start ? D.fmtDate(it.start) : '', cls: it && it.start ? '' : 'dv' };
        if (c === 6) return { t: it && it.days.length ? it.days.map((d) => D.fmtShort(d)).join(', ') : '' };
        if (c === 7) return { t: it && it.dh ? 'DH' : '' };
        const vs = vio.get(u.id) || [];
        if (preview) return { h: icon('todo') + ' 대상 (미확정)' };
        if (vs.length) return { h: icon('block') + ' ' + vs.join(','), cls: 'cf-bad' };
        return it && it.start ? { h: icon('ok') + ' 배정', cls: 'cf-ok' } : { h: icon('todo') + ' 미배정' };
      },
      onSelect: (r, c) => { const u = list[r]; const it = info.get(u.id); WB.fx({ addr: '재편성!' + WB.colName(c) + (r + 2), value: u.away + ' @ ' + u.home + ' · ' + u.games + '경기', meta: it && it.start ? '시작 ' + D.fmtDate(it.start) + (it.dh ? ' · 더블헤더' : '') : '재편성 대상 (FR-P3)' }); }
    };
  }
  function reschedCal() {
    const x = rex();
    const mo = WB.ui.opsMonth || 9;
    const first = D.dayNum('2025-' + String(mo).padStart(2, '0') + '-01');
    const last = D.dayNum('2025-' + String(mo + 1).padStart(2, '0') + '-01') - 1;
    const start = first - ((D.weekday(first) + 6) % 7);
    const weeks = Math.ceil((last - start + 1) / 7);
    const host = document.getElementById('gridhost');
    const rowH = Math.max(80, Math.floor(((host.clientHeight || 560) - 44) / weeks));
    const cw = Math.max(130, Math.floor(((host.clientWidth || 1100) - 40) / 7));
    const byDay = new Map();
    if (x) x.units.forEach((u) => { const seen = {}; u.days.forEach((d) => { const k = D.dayNum(d); seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) return; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(u); }); });
    const vday = new Set(); if (x) x.violations.forEach((v) => { if (v.date) vday.add(D.dayNum(v.date)); });
    const allowMon = WB.app.state.reschedule.allowMonday;
    return {
      key: 'ops-rcal-' + mo, sheet: '재편성(' + mo + '월)', cols: ['월', '화', '수', '목', '금', '토', '일'].map((l) => ({ label: l, w: cw })), rows: weeks, rowH, fill: 0, tableCls: 'cal', readOnly: true,
      rowNo: (r) => (r + 1) + '주',
      cell: (r, c) => {
        const d = start + r * 7 + c;
        const inM = d >= first && d <= last;
        const us = byDay.get(d) || [];
        let h = '<div class="dn"><b>' + D.fmtShort(d).split('/')[1] + '</b><span class="grow"></span>' + (us.length ? us.length + '경기' : '') + (vday.has(d) ? '<span class="vcode">' + icon('warn') + '</span>' : '') + '</div>';
        for (const u of us.slice(0, 5)) h += '<div class="gl2" title="' + esc(u.away + ' @ ' + u.home) + '">' + esc(u.away) + '<span style="color:var(--c-muted)">@</span>' + esc(u.home) + (u.dh && u.days[0] === D.isoDate(d) ? ' <b style="color:var(--c-lock)">DH</b>' : '') + '</div>';
        if (us.length > 5) h += '<div class="note">+' + (us.length - 5) + '</div>';
        const mon = D.weekday(d) === 1;
        return { h, cls: (inM ? '' : 'out') + (vday.has(d) ? ' vday' : '') + (!us.length && inM && mon && !allowMon ? ' rest' : '') };
      },
      onSelect: (r, c) => { const d = start + r * 7 + c; WB.fx({ addr: '재편성!' + D.fmtShort(d), value: D.fmtDate(d) + ' · ' + (byDay.get(d) || []).length + '경기', meta: 'RH-1 구단 하루 1경기 · RH-2 구장 하루 1대진' }); }
    };
  }

  O.prepareResult = function (mode) {
    const app = WB.app;
    if (!(app.state.reschedule.units || []).length) WB.track('재편성 대상 확정', () => app.buildRescheduleUnits());
    if (mode === 'running') { WB.ui.rsRun = { p: 0.55, frozen: true }; return; }
    runSearch(1);
  };
  function runSearch(fraction) {
    const app = WB.app;
    const search = R.createSearch(R.buildInput(app.state), { seed: 42 });
    search.step(Math.round(30000 * fraction));
    const plan = search.bestPlanList();
    WB.track('재편성 결과 반영', () => app.store.commit('재편성 결과 반영', (s) => { s.reschedule.plan = plan; }, { tags: ['reschedule'] }));
  }
  function startResched() {
    const app = WB.app;
    WB.track('재편성 대상 확정', () => app.buildRescheduleUnits());
    WB.ui.rsRun = { p: 0 };
    const tick = () => {
      const r = WB.ui.rsRun;
      if (!r || r.frozen) return;
      r.p += 0.1;
      if (r.p >= 1) { WB.ui.rsRun = null; runSearch(1); WB.render(); WB.toast('재편성 완료 (목업 실행) — RH 위반 ' + (rex() ? rex().violations.length : 0) + '건', 'ok'); return; }
      renderPane();
      setTimeout(tick, 200);
    };
    WB.render();
    setTimeout(tick, 200);
  }
  WB.actions['rs-run'] = startResched;
  WB.actions['rs-clear'] = () => { WB.track('재편성 배치 비우기', () => WB.app.clearReschedulePlan()); WB.render(); };

  // ───────────── 작업 창 ─────────────
  function progressBox() {
    if (!WB.feature('P7')) return '';
    const app = WB.app;
    const t = app.targets();
    const days = R.windowDays(app.state);
    const rs = app.state.reschedule;
    const usable = days.filter((d) => !d.forbidden && (rs.allowMonday || !d.monday)).length;
    const cap = usable * 5;
    const need = t.totals.need;
    const pct = Math.min(100, need / cap * 100);
    return '<div class="sec grow"><div class="sh">' + icon('chart') + '시즌 진행 현황<span class="cnt">FR-P7</span></div><div class="sb">' +
      '<table class="mini"><tr><th>구단</th><th>소화</th><th>취소</th><th>예정</th><th>재편성</th></tr>' + t.byTeam.map((b) => '<tr><td>' + esc(b.team) + '</td><td class="n">' + b.played + '</td><td class="n"' + (b.cancelled ? ' style="color:var(--c-bad);font-weight:600"' : '') + '>' + b.cancelled + '</td><td class="n">' + b.scheduled + '</td><td class="n">' + b.need + '</td></tr>').join('') + '</table>' +
      '<div class="ph">재편성 기간 수용<small>' + D.fmtShort(rs.start) + '~' + D.fmtShort(rs.end) + ' · 가용 ' + usable + '일 × 5구장</small></div>' +
      '<div class="row"><div class="prog ok" style="flex:1"><i style="width:' + pct.toFixed(1) + '%"></i></div><span class="num">' + need + ' / ' + cap + '</span></div>' +
      '<div class="note" style="margin-top:3px">' + (need <= cap ? WB.st('ok', '수용 가능') : WB.st('bad', '부족')) + ' 필요 ' + need + '경기 (잔여 ' + t.totals.remaining + ' + 취소 ' + t.totals.cancelled + ')</div></div></div>';
  }
  function renderPane() {
    const pane = document.getElementById('pane');
    const app = WB.app;
    if (WB.ui.opsSheet === 'resched') {
      const rs = app.state.reschedule;
      const x = rex();
      const run = WB.ui.rsRun;
      let res = '';
      if (run) res = '<div class="callout lock">' + WB.st('lock', '재편성 실행 중') + ' 입력 잠금</div><div class="row"><div class="prog" style="flex:1"><i style="width:' + (run.p * 100).toFixed(0) + '%"></i></div><span class="num">' + Math.round(run.p * 100) + '%</span></div><div class="note">미편성 묶음을 가장 이른 충돌 없는 날짜에 넣고 Late Acceptance로 다듬습니다.</div>';
      else if (x && x.units.some((u) => u.start)) {
        const lastD = x.teamMetrics.map((t) => t.lastDate).filter(Boolean).sort().pop();
        res = '<div class="callout ' + (x.feasible ? 'ok' : 'bad') + '">' + (x.feasible ? WB.st('ok', 'RH 위반 0') : WB.st('bad', 'RH 위반 ' + x.violations.length)) + ' 배정 ' + x.units.filter((u) => u.start).length + '/' + x.units.length + '묶음 · 마지막 경기일 ' + (lastD ? D.fmtDate(lastD) : '-') + '</div>' +
          '<div class="mono" style="font-size:10.5px;word-break:break-all">' + esc(KBO.Score.scoreString(x.score)) + '</div>' +
          '<table class="mini" style="margin-top:6px"><tr><th>구단</th><th>경기</th><th>DH</th><th>월</th><th>이동 증가 km</th></tr>' + x.teamMetrics.map((t) => '<tr><td>' + esc(t.name) + '</td><td class="n">' + t.games + '</td><td class="n">' + t.doubleHeaders + '</td><td class="n">' + t.mondayGames + '</td><td class="n">' + WB.fmt.km(t.addedKm) + '</td></tr>').join('') + '</table>' +
          '<div class="row" style="margin-top:6px"><button class="btn box sm" data-act="rs-clear">' + icon('close') + '배치 비우기</button><button class="btn box sm" data-act="opsview-cal">' + icon('cal') + '달력으로 확인</button></div>';
      } else res = '<div class="note">대상 ' + app.targets().totals.need + '경기를 묶음으로 나눠(1~3경기) 9~10월에 배치합니다. 이미 치른 경기와 기간 이전 일정은 자동 고정됩니다.</div>';
      pane.innerHTML = '<div class="sec fixed"><div class="sh">' + icon('gear') + '재편성 옵션<span class="cnt">FR-P4</span><span class="grow"></span>' + WB.mock('목업 실행') + '</div><div class="sb" style="flex:none">' +
        '<div class="field"><span>재편성 기간</span><span class="row"><input class="inp num" data-rs="start" value="' + esc(rs.start) + '" style="width:84px">~<input class="inp num" data-rs="end" value="' + esc(rs.end) + '" style="width:84px"></span></div>' +
        '<div class="field"><span>월요일 경기</span><label class="chk"><input type="checkbox" data-rsc="allowMonday"' + (rs.allowMonday ? ' checked' : '') + '> 허용 (RH-3)</label></div>' +
        '<div class="field"><span>더블헤더</span><span class="row"><label class="chk"><input type="checkbox" data-rsc="allowDoubleHeader"' + (rs.allowDoubleHeader ? ' checked' : '') + '> 허용</label> 구단당 최대 <input class="inp num" data-rs="maxDoubleHeaderPerTeam" value="' + rs.maxDoubleHeaderPerTeam + '" style="width:40px"></span></div>' +
        '<div class="field"><span>경기 없는 날</span><span class="note">추석 10/5~10/7은 시즌 골격 공휴일 · 별도 지정 0</span></div>' +
        '<button class="btn pri" data-act="rs-run" style="width:100%;justify-content:center;height:28px"' + (run ? ' disabled' : '') + '>' + icon('play') + '재편성 실행</button></div></div>' +
        '<div class="sec grow"><div class="sh">' + icon('ok') + '재편성 결과<span class="cnt">RH-1~5 · RS-1~3</span></div><div class="sb">' + res + '</div></div>';
      pane.querySelectorAll('[data-rs]').forEach((el) => el.addEventListener('change', () => { const k = el.dataset.rs; const v = k === 'maxDoubleHeaderPerTeam' ? parseInt(el.value, 10) || 0 : el.value; WB.track('재편성 옵션', () => app.updateReschedule({ [k]: v })); WB.render(); }));
      pane.querySelectorAll('[data-rsc]').forEach((el) => el.addEventListener('change', () => { WB.track('재편성 옵션', () => app.updateReschedule({ [el.dataset.rsc]: el.checked })); WB.render(); }));
      return;
    }
    const date = WB.ui.opsDate;
    const list = app.games().filter((g) => g.date === date && g.source === 'INITIAL');
    const reasonOpts = Object.entries(REASONS).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('');
    const rows = list.map((g, i) => {
      const s = gStatus(g);
      return '<tr><td>' + esc(g.away + ' @ ' + g.home) + '</td><td><select class="inp" data-gi="' + i + '" style="height:22px;width:74px"><option value="SCHEDULED"' + (g.status === 'SCHEDULED' ? ' selected' : '') + '>예정</option><option value="PLAYED"' + (g.status === 'PLAYED' ? ' selected' : '') + '>완료</option><option value="CANCELLED"' + (g.status === 'CANCELLED' ? ' selected' : '') + '>취소</option></select></td><td>' + (g.status === 'CANCELLED' ? esc(REASONS[g.reason] || '') : s.i === 'warn' ? WB.st('warn', '미입력') : '') + '</td></tr>';
    }).join('');
    pane.innerHTML = '<div class="sec fixed"><div class="sh">' + icon('cal') + '선택한 날짜<span class="cnt">' + D.fmtDate(date) + ' · ' + list.length + '경기</span></div><div class="sb" style="flex:none">' +
      '<div class="row wrap" style="margin-bottom:6px"><button class="btn box sm" data-day="PLAYED">' + icon('ok') + '모두 완료</button><span class="row"><button class="btn box sm danger" data-day="CANCELLED">' + icon('bad') + '모두 취소</button><select class="inp" id="dayReason" style="height:20px;width:96px" aria-label="취소 사유">' + reasonOpts + '</select></span><button class="btn sm" data-day="SCHEDULED">예정으로</button></div>' +
      '<table class="mini"><tr><th>경기</th><th>상태</th><th>사유</th></tr>' + rows + '</table></div></div>' + progressBox();
    pane.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
      const st = b.dataset.day, rsn = pane.querySelector('#dayReason').value;
      WB.track('일괄 기록 ' + D.fmtShort(date), () => app.setDayStatus(date, st, rsn));
      WB.render();
      WB.toast(D.fmtDate(date) + ' ' + list.length + '경기 → ' + (st === 'CANCELLED' ? '취소(' + REASONS[rsn] + ')' : st === 'PLAYED' ? '완료' : '예정') + ' · 재편성 대상 ' + app.targets().totals.need + '경기', st === 'CANCELLED' ? 'warn' : 'ok', { label: '실행 취소', fn: WB.undo });
    }));
    pane.querySelectorAll('[data-gi]').forEach((s) => s.addEventListener('change', () => { const g = list[+s.dataset.gi]; WB.track('경기 기록', () => app.setGameStatus(g, s.value, 'RAIN')); WB.render(); }));
  }
  WB.actions['opsview-cal'] = () => { WB.ui.opsView = 'cal'; WB.render(); };
  WB.actions['opsview-list'] = () => { WB.ui.opsView = 'list'; WB.render(); };

  function renderCmd() {
    const H = WB.hist;
    const res = WB.ui.opsSheet === 'resched';
    document.getElementById('cmd').innerHTML =
      '<span class="grp"><button class="btn" data-act="undo"' + (H.undo.length ? '' : ' disabled') + ' aria-label="실행 취소">' + icon('undo') + (H.undo.length ? esc(WB.undoLabel()) : '') + '</button><button class="btn" data-act="redo"' + (H.redo.length ? '' : ' disabled') + ' aria-label="다시 실행">' + icon('redo') + '</button></span><span class="vr"></span>' +
      (res ? '<span class="gl">보기</span><span class="seg"><button data-act="opsview-list" class="' + (WB.ui.opsView !== 'cal' ? 'on' : '') + '">' + icon('sheet') + '목록</button><button data-act="opsview-cal" class="' + (WB.ui.opsView === 'cal' ? 'on' : '') + '">' + icon('cal') + '달력</button></span>' +
        (WB.ui.opsView === 'cal' ? '<span class="seg" style="margin-left:6px"><button data-om="9" class="' + ((WB.ui.opsMonth || 9) === 9 ? 'on' : '') + '">9월</button><button data-om="10" class="' + (WB.ui.opsMonth === 10 ? 'on' : '') + '">10월</button></span>' : '') +
        '<span class="vr"></span><span class="note">재편성 Hard: RH-1 구단 하루 1경기 · RH-2 구장 하루 1대진 · RH-3 월요일 · RH-4 DH 한도 · RH-5 미배정</span>'
        : '<span class="gl">날짜로 이동</span><input class="inp num" id="opsJump" value="' + esc(WB.ui.opsDate) + '" style="width:100px" aria-label="날짜로 이동"><button class="btn" data-act="ops-jump">' + icon('search') + '이동</button>' +
          (WB.feature('P2') ? '<span class="vr"></span><button class="btn" data-act="ops-overdue">' + icon('warn') + '결과 미입력으로</button>' : '') +
          '<span class="vr"></span><span class="note">날짜 행을 고르고 오른쪽 창에서 그날 경기를 한 번에 처리합니다 (취소 사유: 우천·폭염·미세먼지·그라운드 사정·기타)</span>') +
      '<span class="grow"></span>';
    document.querySelectorAll('#cmd [data-om]').forEach((b) => b.addEventListener('click', () => { WB.ui.opsMonth = +b.dataset.om; WB.render(); }));
  }
  WB.actions['ops-jump'] = () => { const v = WB.Book.parseDate(document.getElementById('opsJump').value); if (!v) return WB.toast('날짜를 읽을 수 없습니다.', 'warn'); jumpTo(v); };
  WB.actions['ops-overdue'] = () => { const o = WB.app.overdueGames(); if (!o.length) return WB.toast('결과 미입력 경기가 없습니다.', 'ok'); jumpTo(o[0].date); };
  function jumpTo(date) {
    const ds = dates();
    const r = ds.findIndex((d) => d[0] >= date);
    if (r < 0) return;
    WB.ui.opsDate = ds[r][0];
    WB.ui.sel['ops-games'] = { r, c: 1 };
    WB.ui.scroll['ops-games'] = null;
    WB.ui.gridFocus = 'ops-games';
    WB.render();
  }
  O.jumpTo = jumpTo;

  function renderTabs() {
    const id = WB.ui.opsSheet;
    const t = WB.app.targets().totals;
    const over = WB.feature('P2') ? WB.app.overdueGames().length : 0;
    document.getElementById('tabs').innerHTML = '<span class="grpl">시즌 운영</span>' +
      '<button class="tab' + (id === 'games' ? ' on' : '') + '" data-sheet="games">' + icon('sheet', 'tico') + '경기 기록' + (over ? '<span class="cnt warn">' + icon('warn') + over + '</span>' : '') + '</button>' +
      '<button class="tab' + (id === 'resched' ? ' on' : '') + '" data-sheet="resched">' + icon('cal', 'tico') + '재편성<span class="cnt n">' + t.need + '</span></button>';
  }

  O.render = function () {
    document.getElementById('main').classList.remove('nopane');
    renderCmd(); renderTabs();
    const host = document.getElementById('gridhost');
    let spec;
    if (WB.ui.opsSheet === 'resched') spec = WB.ui.opsView === 'cal' ? reschedCal() : reschedGrid();
    else {
      spec = gamesGrid();
      if (!WB.ui.sel['ops-games']) { const ds = dates(); const r = ds.findIndex((d) => d[0] >= WB.ui.opsDate); WB.ui.sel['ops-games'] = { r: Math.max(0, r), c: 1 }; }
    }
    const g = WB.Grid.mount(host, spec);
    if (WB.ui.rsRun && WB.ui.opsSheet === 'resched') WB.lockOverlay2(host);
    spec.onSelect(g.sel.r, g.sel.c);
    renderPane();
  };
  WB.lockOverlay2 = function (host) { host.insertAdjacentHTML('beforeend', '<div class="lockveil"></div><div class="lockbanner">' + icon('lock') + '재편성 실행 중 — 입력 잠금</div>'); };
})();
