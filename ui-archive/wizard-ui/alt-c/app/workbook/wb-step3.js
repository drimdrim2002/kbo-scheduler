/*
 * alt-c 편성 워크북 — ③ 결과·수정.
 * 일정 시트(슬롯 × 경기 격자 ↔ 월간 달력 전환), 미배정 풀, 구단 × 슬롯(켜기·끄기), 위반 목록(한 곳), 셀 상세(핀·이동 후보 Δ),
 * 구단 필터, 실행 취소, 스냅샷 저장·복원.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const KBO = window.KBO;
  const D = KBO.Dates;
  const esc = WB.esc, icon = WB.icon;
  const S3 = WB.steps[3] = {};

  const app = () => WB.app;
  const der = () => WB.app.derived();
  const short = (st) => st.replace(/(종합운동장|이글스파크|라이언즈파크|챔피언스필드|NC파크|KT위즈파크|돔야구장|야구장|경기장)$/, '');
  const stadiumOf = (team) => { const t = WB.app.team(team); return t ? t.stadium : ''; };

  S3.status = function () {
    const c = der();
    const ex = c.ex;
    const assigned = WB.app.state.matches.length - c.pool.length;
    const pins = WB.app.state.matches.filter((m) => m.pinned).length;
    const pre = WB.book.dirty ? '입력 변경됨 — ② 재실행 필요 · ' : '';
    if (!assigned) return { kind: 'todo', label: '배정 없음', short: '○ 배정 없음', summary: pre + '배정이 초기화됨 — ② 검토·실행에서 엔진을 돌리세요' };
    const virt = ex.violations.filter(WB.isVirtual).length;
    const sum = pre + (ex.feasible ? 'Hard 위반 0' : 'Hard 위반 ' + ex.violations.length + '건' + (virt ? ' (가상 ' + virt + ')' : '')) + ' · 미배정 ' + c.pool.length + ' · 핀 ' + pins;
    if (!ex.feasible || c.pool.length) return { kind: 'warn', label: '확인 필요', short: '⚠ 위반 ' + ex.violations.length, summary: sum };
    return { kind: 'ok', label: '완료', short: '✔ 편성 가능', summary: sum };
  };

  function slotMatches(s) {
    const c = der();
    return (c.bySlot[s] || []).slice().sort((a, b) => c.teamIndex.get(WB.app.state.matches[a].home) - c.teamIndex.get(WB.app.state.matches[b].home));
  }
  function violationsOf(m) { return der().ex.violations.filter((v) => (v.matches || []).indexOf(m) >= 0); }
  function filterState(m) {
    const f = WB.ui.teamFilter;
    if (!f.size) return null;
    const x = WB.app.state.matches[m];
    if (f.has(x.home)) return 'home';
    if (f.has(x.away)) return 'away';
    return 'dim';
  }

  // ───────────── 일정 격자 (슬롯 × 경기) ─────────────
  function gameCell(m) {
    const x = WB.app.state.matches[m];
    const fl = der().ex.matchFlags[m] || [];
    const fs = filterState(m);
    const mark = fs === 'home' ? '<span class="hmark h" title="홈">H</span>' : fs === 'away' ? '<span class="hmark a" title="원정">A</span>' : '';
    const h = '<span class="gm">' + mark + '<span class="aw">' + esc(x.away) + '</span><span class="at">@</span><span class="hm">' + esc(x.home) + '</span>' +
      (x.pinned ? icon('pin') : '') + (fl.length ? '<span class="vcode">' + icon('warn') + fl.join(',') + '</span>' : '') + '</span>';
    const cls = (fs === 'home' ? 'hl-home' : fs === 'dim' ? 'dim' : '') + (fl.length ? ' vio' : '') + (WB.ui.selMatch === m ? '' : '');
    const vs = fl.length ? violationsOf(m) : [];
    return { h, cls, mk: fl.length ? { level: 'error', title: fl.join(' · ') + (vs.some(WB.isVirtual) ? ' (가상)' : ''), text: vs.map((v) => v.label).filter((v, i, a) => a.indexOf(v) === i).join(', ') + ' — 위반 목록에서 원인 확인' } : null, title: x.away + ' @ ' + x.home + ' · ' + stadiumOf(x.home) };
  }

  function scheduleGrid() {
    const c = der();
    const slots = c.slots;
    const host = document.getElementById('gridhost');
    const fixedW = 38 + 150 + 46 * 3 + 120;
    const gw = Math.max(132, Math.floor(((host.clientWidth || 1100) - fixedW - 16) / 5));
    const cols = [{ label: '슬롯', w: 150 }, { label: '연전', w: 46, cls: 'n' }, { label: '주말', w: 46, cls: 'c' }, { label: '휴일', w: 46, cls: 'n' }]
      .concat([1, 2, 3, 4, 5].map((i) => ({ label: '경기 ' + i + ' (원정 @ 홈)', w: gw })))
      .concat([{ label: '위반', w: 120 }]);
    const slotV = slots.map((s) => c.ex.violations.filter((v) => v.slot === s.index || (v.slots || []).indexOf(s.index) >= 0));
    return {
      key: 's3-sched', sheet: '일정', cols, rows: slots.length, frozen: 1, fill: 0,
      readOnly: true,
      rowCls: (r) => (slotV[r].length ? '' : ''),
      cell: (r, col) => {
        const s = slots[r];
        if (col === 0) { const end = s.day + s.consecutive - 1; return { t: D.fmtDate(s.day) + ' ~ ' + D.fmtShort(end), cls: slotV[r].length ? 'mk-error' : '' }; }
        if (col === 1) return { t: s.consecutive };
        if (col === 2) return { t: s.weekend ? '예' : '' };
        if (col === 3) return { t: s.holiday };
        if (col === 9) {
          const vs = slotV[r];
          return vs.length ? { h: '<span class="vcode">' + icon('block') + vs.map((v) => v.code).join(', ') + '</span>' + (vs.some(WB.isVirtual) ? ' ' + WB.virt() : ''), cls: 'cf-bad' } : { t: '' };
        }
        const ms = slotMatches(r);
        const m = ms[col - 4];
        if (m == null) return { t: '', cls: 'dv' };
        return gameCell(m);
      },
      onSelect: (r, col) => {
        const ms = slotMatches(r);
        const m = col >= 4 && col <= 8 ? ms[col - 4] : null;
        WB.ui.selMatch = m == null ? null : m;
        WB.ui.selSlot = r;
        fxFor(r, col, m);
        renderPane();
      },
      onActivate: (r, col) => { const m = slotMatches(r)[col - 4]; if (m != null) { WB.ui.pane3 = 'cell'; renderPane(); } },
      menu: (r, col) => {
        const m = slotMatches(r)[col - 4];
        if (m == null) return null;
        const x = WB.app.state.matches[m];
        return [{ head: x.away + ' @ ' + x.home + ' · ' + slots[r].label }, { label: x.pinned ? '고정 해제' : '핀 고정', icon: 'pin', act: () => pin(m) },
          { label: '미배정 풀로 빼기', icon: 'pool', disabled: x.pinned || !WB.feature('M8'), act: () => toPool(m) }, '-',
          { label: '이 슬롯 모두 고정', icon: 'pin', act: () => { WB.track('슬롯 고정', () => WB.app.pinSlot(r, true)); WB.render(); } }];
      }
    };
  }
  function fxFor(r, col, m) {
    const c = der();
    const s = c.slots[r];
    const addr = '일정!' + WB.colName(col) + (r + 2);
    if (m == null) {
      const vs = c.ex.violations.filter((v) => v.slot === r);
      WB.fx({ addr, value: col === 0 ? s.label : col === 9 ? vs.map((v) => v.code).join(', ') : [s.label, s.consecutive, s.weekend, s.holiday][col], meta: '슬롯 #' + (r + 1) + ' · 시리즈 ' + (c.bySlot[r] || []).length + '/5', msg: vs.length ? vs.length + '건 위반 — 오른쪽 위반 목록 참조' : '', level: vs.length ? 'error' : '' });
      WB.setAgg('<span>슬롯 #' + (r + 1) + '</span><span>경기일 <b>' + s.consecutive + '</b></span>');
      return;
    }
    const x = WB.app.state.matches[m];
    const fl = c.ex.matchFlags[m] || [];
    WB.fx({ addr, value: x.away + ' @ ' + x.home, meta: s.label + ' · ' + esc(stadiumOf(x.home)) + ' · 시리즈 #' + (m + 1) + ' · ' + x.consecutive + '연전 · ' + (x.pinned ? icon('pin') + '고정' : '고정 안 됨'),
      msg: fl.length ? esc(fl.join(', ')) + ' 위반 (상세는 위반 목록)' + (violationsOf(m).some(WB.isVirtual) ? ' · 가상' : '') : WB.locked() ? '엔진 실행 중 — 읽기 전용' : 'Enter: 셀 상세 · 오른쪽 클릭: 핀·풀', level: fl.length ? 'error' : WB.locked() ? 'lock' : '' });
    const tm = c.ex.teamMetrics;
    const h = tm[c.teamIndex.get(x.home)], a = tm[c.teamIndex.get(x.away)];
    WB.setAgg('<span>' + esc(x.home) + ' 이동 <b>' + WB.fmt.km(h.distanceKm) + 'km</b></span><span>' + esc(x.away) + ' 이동 <b>' + WB.fmt.km(a.distanceKm) + 'km</b></span>');
  }

  // ───────────── 달력 ─────────────
  function calGrid() {
    const c = der();
    const mo = WB.ui.month3 || 5;
    const first = D.dayNum('2025-' + String(mo).padStart(2, '0') + '-01');
    const last = D.dayNum('2025-' + String(mo + 1).padStart(2, '0') + '-01') - 1;
    const startOff = (D.weekday(first) + 6) % 7;
    const start = first - startOff;
    const weeks = Math.ceil((last - start + 1) / 7);
    const host = document.getElementById('gridhost');
    const rowH = Math.max(88, Math.floor(((host.clientHeight || 560) - 44) / weeks));
    const cw = Math.max(130, Math.floor(((host.clientWidth || 1100) - 40) / 7));
    const vioSlots = new Set(); c.ex.violations.forEach((v) => { if (v.slot >= 0) vioSlots.add(v.slot); (v.slots || []).forEach((x) => vioSlots.add(x)); });
    const cols = ['월', '화', '수', '목', '금', '토', '일'].map((l) => ({ label: l, w: cw }));
    const sel = WB.ui.selMatch;
    const hols = new Map((WB.app.state.settings.holidays || []).map((h) => [D.dayNum(h.date), h.name]));
    return {
      key: 's3-cal-' + mo, sheet: '일정(' + mo + '월)', cols, rows: weeks, rowH, fill: 0, tableCls: 'cal', readOnly: true,
      rowNo: (r) => (r + 1) + '주',
      cell: (r, col) => {
        const d = start + r * 7 + col;
        const inMonth = d >= first && d <= last;
        const s = c.dayToSlot.get(d);
        let h = '<div class="dn"><b>' + D.fmtShort(d).split('/')[1] + '</b>' + (hols.has(d) ? '<span style="color:var(--c-bad)" title="' + esc(hols.get(d)) + '">' + esc(hols.get(d).split('·')[0]) + '</span>' : '') + '<span class="grow"></span>' + (s != null ? '<span>#' + (s + 1) + ' ' + (d - c.slots[s].day + 1) + '/' + c.slots[s].consecutive + '</span>' : '') + (s != null && vioSlots.has(s) ? '<span class="vcode">' + icon('warn') + '</span>' : '') + '</div>';
        if (s == null) return { h: h + (inMonth ? '<div class="note" style="font-size:10.5px">' + (D.weekday(d) === 1 ? '휴식' : '경기 없음') + '</div>' : ''), cls: inMonth ? 'rest' : 'out' };
        for (const m of slotMatches(s)) {
          const x = WB.app.state.matches[m];
          const fs = filterState(m);
          const fl = c.ex.matchFlags[m] || [];
          h += '<div class="gl2' + (fs === 'home' ? ' h' : fs === 'dim' ? ' dim' : '') + (fl.length ? ' v' : '') + (sel === m ? ' selg' : '') + '" data-m="' + m + '" title="' + esc(x.away + ' @ ' + x.home + ' · ' + stadiumOf(x.home) + (fl.length ? ' · ' + fl.join(',') : '')) + '">' +
            (fs === 'home' ? '<span class="hmark h">H</span>' : fs === 'away' ? '<span class="hmark a">A</span>' : '') + esc(x.away) + '<span class="at" style="color:var(--c-muted)">@</span>' + esc(x.home) + (x.pinned ? icon('pin') : '') + (fl.length ? '<span class="vcode">' + fl.join(',') + '</span>' : '') + '</div>';
        }
        return { h, cls: (inMonth ? '' : 'out') + (vioSlots.has(s) ? ' vday' : '') };
      },
      onSelect: (r, col) => {
        const d = start + r * 7 + col;
        const s = c.dayToSlot.get(d);
        WB.ui.selSlot = s == null ? null : s;
        WB.fx({ addr: '일정!' + WB.colName(col) + (r + 2), value: D.fmtDate(d), meta: s != null ? c.slots[s].label + ' · ' + (d - c.slots[s].day + 1) + '일째' : '경기 없음' });
      }
    };
  }

  // ───────────── 미배정 풀 ─────────────
  function poolGrid() {
    const c = der();
    const pool = c.pool;
    const cols = [{ label: '시리즈', w: 70 }, { label: '홈', w: 70 }, { label: '원정', w: 70 }, { label: '연전', w: 50, cls: 'n' }, { label: '넣을 슬롯 (Δ 최소)', w: 240 }, { label: '동작', w: 120 }];
    return {
      key: 's3-pool', sheet: '미배정 풀', cols, rows: pool.length, fill: 2, readOnly: true,
      cell: (r, col) => {
        const m = pool[r]; const x = WB.app.state.matches[m];
        if (col === 0) return { t: '#' + (m + 1) };
        if (col === 1) return { t: x.home };
        if (col === 2) return { t: x.away };
        if (col === 3) return { t: x.consecutive };
        const best = bestSlotFor(m);
        if (col === 4) return { t: best ? c.slots[best.slot].label + ' · ΔHard ' + best.dh : '-' };
        return { h: best ? '<button class="btn sm box" data-put="' + m + '|' + best.slot + '">' + icon('right') + '이 슬롯에 넣기</button>' : '' };
      },
      onSelect: (r) => { WB.ui.selMatch = pool[r]; renderPane(); WB.fx({ addr: '미배정 풀!A' + (r + 2), value: WB.app.matchLabel(pool[r]), meta: 'S0 미배정 — Soft 최우선 감점' }); },
      after: pool.length ? '' : '<div class="callout info" style="margin:12px">' + WB.st('ok', '비어 있음') + ' 미배정 시리즈가 없습니다. 일정 시트에서 셀을 오른쪽 클릭하거나 셀 상세의 <b>풀로 빼기</b>로 시리즈를 잠시 빼 둘 수 있습니다 (FR-M8).</div>'
    };
  }
  function bestSlotFor(m) {
    const c = der();
    const x = WB.app.state.matches[m];
    let best = null;
    for (const s of c.slots) {
      if (s.consecutive !== x.consecutive) continue;
      const p = WB.app.previewDrop(m, s.index, null);
      if (!best || p.hardDelta > best.dh || (p.hardDelta === best.dh && sumSoft(p.delta) > best.ds)) best = { slot: s.index, dh: p.hardDelta, ds: sumSoft(p.delta) };
    }
    return best;
  }
  const sumSoft = (d) => d[2] * 1e9 + d[3] * 1e3 + d[4] + d[5] + d[6];

  // ───────────── 구단 × 슬롯 (FR-V6, 켜기·끄기) ─────────────
  function matrixGrid() {
    const c = der();
    const teams = WB.app.state.teams;
    const cols = [{ label: '구단', w: 64 }].concat(c.slots.map((s) => ({ label: D.fmtShort(s.day), w: 58, cls: 'c' })));
    const cellOf = new Map();
    c.slots.forEach((s) => (c.bySlot[s.index] || []).forEach((m) => { const x = WB.app.state.matches[m]; cellOf.set(x.home + '|' + s.index, { m, home: true, opp: x.away }); cellOf.set(x.away + '|' + s.index, { m, home: false, opp: x.home }); }));
    return {
      key: 's3-matrix', sheet: '구단×슬롯', cols, rows: teams.length, frozen: 1, fill: 0, readOnly: true, rowH: Math.max(22, Math.min(44, Math.floor(((document.getElementById('gridhost').clientHeight || 500) - 50) / teams.length))),
      cell: (r, col) => {
        if (col === 0) return { t: teams[r].name, cls: 'dv' };
        const v = cellOf.get(teams[r].name + '|' + (col - 1));
        if (!v) return { t: '' };
        const fl = c.ex.matchFlags[v.m] || [];
        return { h: (v.home ? '' : '@') + esc(v.opp), cls: (v.home ? 'hl-home' : '') + (fl.length ? ' vio' : ''), mk: fl.length ? { level: 'error', title: fl.join(','), text: '위반 목록에서 원인 확인' } : null };
      },
      onSelect: (r, col) => { const v = col ? cellOf.get(teams[r].name + '|' + (col - 1)) : null; WB.ui.selMatch = v ? v.m : null; renderPane(); WB.fx({ addr: '구단×슬롯!' + WB.colName(col) + (r + 2), value: v ? (v.home ? teams[r].name + ' 홈 vs ' + v.opp : teams[r].name + ' 원정 @ ' + v.opp) : '', meta: col ? c.slots[col - 1].label : '' }); }
    };
  }

  // ───────────── 동작 ─────────────
  function pin(m) { WB.track('핀: ' + WB.app.matchLabel(m), () => WB.app.togglePin(m)); WB.render(); }
  function toPool(m) { WB.track('풀로: ' + WB.app.matchLabel(m), () => WB.app.moveMatch(m, -1)); WB.render(); WB.toast(WB.app.matchLabel(m) + ' 시리즈를 미배정 풀로 뺐습니다.', '', { label: '실행 취소', fn: WB.undo }); }
  function swap(m, t) {
    const before = der().ex.violations.length;
    WB.track('교환', () => WB.app.swapMatches(m, t));
    const after = der().ex.violations.length;
    WB.render();
    WB.toast('교환: ' + WB.app.matchLabel(m) + ' ↔ ' + WB.app.matchLabel(t) + ' · Hard 위반 ' + before + ' → ' + after, after < before ? 'ok' : '', { label: '실행 취소', fn: WB.undo });
  }
  S3.selectViolation = function (v) {
    WB.ui.selViol = v.id;
    const ms = v.matches || [];
    const m = ms[0];
    WB.ui.pane3 = 'viol';
    if (WB.ui.sheet[3] !== 'schedule') WB.ui.sheet[3] = 'schedule';
    if (WB.ui.view3 === 'cal') {
      WB.ui.month3 = D.month(der().slots[v.slot].day);
      WB.ui.selMatch = m == null ? null : m;
      WB.go({ step: 3 });
      return;
    }
    const s = m != null ? der().plan[m] : v.slot;
    const col = m != null ? 4 + slotMatches(s).indexOf(m) : 0;
    WB.ui.selMatch = m == null ? null : m;
    WB.ui.pendingCell = WB.colName(col) + (s + 2);
    WB.ui.gridFocus = 's3-sched';
    WB.go({ step: 3 });
  };

  // ───────────── 작업 창 ─────────────
  function renderPane() {
    const pane = document.getElementById('pane');
    const c = der();
    const vs = c.ex.violations;
    const byCode = new Map();
    vs.forEach((v) => { if (!byCode.has(v.code)) byCode.set(v.code, []); byCode.get(v.code).push(v); });
    let list = '';
    if (!vs.length) list = '<div class="callout ok" style="margin:8px 10px">' + WB.st('ok', '편성 가능') + ' Hard 위반이 없습니다.</div>';
    for (const [code, items] of byCode) {
      list += '<li class="grp">' + esc(code) + ' ' + esc(items[0].label) + ' · ' + items.length + '건</li>';
      for (const v of items) {
        const s = v.slot;
        const m = (v.matches || [])[0];
        const where = m != null ? '일정!' + WB.colName(4 + slotMatches(c.plan[m]).indexOf(m)) + (c.plan[m] + 2) : '일정!A' + (s + 2);
        list += '<li data-vid="' + v.id + '" class="' + (WB.ui.selViol === v.id ? 'on' : '') + '"><span class="ii error">' + icon('block') + '</span><span><span class="ad">' + esc(where) + '</span> ' + (WB.isVirtual(v) ? WB.virt() : '') + '<span class="tx">' + esc(v.message) + '</span></span></li>';
      }
    }
    const m = WB.ui.selMatch;
    let cell = '';
    if (m == null) cell = '<div class="empty-note">일정 시트에서 경기 셀을 고르면 시리즈 상세와 이동 후보가 나옵니다.</div>';
    else cell = detail(m);
    pane.innerHTML =
      '<div class="sec" style="flex:0 1 44%"><div class="sh">' + icon('block') + '위반 목록<span class="cnt">' + vs.length + '건 · 규칙 ' + byCode.size + '</span><span class="grow"></span>' + (vs.some(WB.isVirtual) ? WB.virt() + '<span class="note">시안용</span>' : '') + '</div><div class="sb flush"><ul class="iss">' + list + '</ul></div></div>' +
      '<div class="sec grow"><div class="sh">' + icon('sheet') + '셀 상세<span class="cnt">' + (m != null ? '시리즈 #' + (m + 1) : '') + '</span></div><div class="sb">' + cell + '</div></div>';
    pane.querySelectorAll('[data-vid]').forEach((li) => li.addEventListener('click', () => { const v = vs.find((x) => x.id === li.dataset.vid); if (v) S3.selectViolation(v); }));
    pane.querySelectorAll('[data-swap]').forEach((b) => b.addEventListener('click', () => { const [a, t] = b.dataset.swap.split('|').map(Number); swap(a, t); }));
    pane.querySelectorAll('[data-pin]').forEach((b) => b.addEventListener('click', () => pin(+b.dataset.pin)));
    pane.querySelectorAll('[data-pool]').forEach((b) => b.addEventListener('click', () => toPool(+b.dataset.pool)));
  }
  S3.renderPane = renderPane;

  function detail(m) {
    const c = der();
    const x = WB.app.state.matches[m];
    const s = c.plan[m];
    const fl = c.ex.matchFlags[m] || [];
    const lock = WB.locked();
    let h = '<div class="ph" style="font-size:13px">' + esc(x.away) + ' <span style="color:var(--c-muted)">@</span> ' + esc(x.home) + '<small>' + x.consecutive + '연전</small><span class="grow"></span>' + (x.pinned ? WB.st('info', '고정') : '') + '</div>' +
      '<dl class="kv"><dt>슬롯</dt><dd>' + (s >= 0 ? esc(c.slots[s].label) + ' (#' + (s + 1) + ')' : '미배정') + '</dd><dt>구장</dt><dd>' + esc(stadiumOf(x.home)) + '</dd><dt>위반</dt><dd>' + (fl.length ? '<span class="vcode">' + esc(fl.join(', ')) + '</span>' : '없음') + '</dd>' + (x.eventId ? '<dt>이벤트</dt><dd>개막전 대진 고정</dd>' : '') + '</dl>' +
      '<div class="row" style="margin:8px 0 2px"><button class="btn box sm" data-pin="' + m + '"' + (lock ? ' disabled' : '') + '>' + icon('pin') + (x.pinned ? '고정 해제' : '핀 고정') + '</button>' +
      (WB.feature('M8') && s >= 0 ? '<button class="btn box sm" data-pool="' + m + '"' + (x.pinned || lock ? ' disabled' : '') + '>' + icon('pool') + '풀로 빼기</button>' : '') + '</div>';
    if (s < 0 && WB.feature('M8')) {
      const best = bestSlotFor(m);
      if (best) h += '<button class="btn pri sm" data-put="' + m + '|' + best.slot + '" style="margin-top:4px">' + icon('right') + c.slots[best.slot].label + '에 넣기</button>';
      return h;
    }
    if (x.pinned) return h + '<div class="note" style="margin-top:6px">' + icon('lock') + ' 고정된 시리즈는 옮길 수 없습니다. 재최적화(②)에서도 이 자리를 유지합니다.</div>';
    // 이동 후보: 같은 연전의 다른 슬롯 시리즈와 교환
    const cand = [];
    for (let t = 0; t < WB.app.state.matches.length; t++) {
      if (t === m) continue;
      const y = WB.app.state.matches[t];
      const ts = c.plan[t];
      if (ts < 0 || ts === s || y.pinned || y.consecutive !== x.consecutive) continue;
      const p = WB.app.previewDrop(m, ts, t);
      cand.push({ t, ts, p });
    }
    cand.sort((a, b) => b.p.hardDelta - a.p.hardDelta || (b.p.delta[6] - a.p.delta[6]));
    const showD = WB.feature('M2');
    h += '<div class="ph">이동 후보<small>같은 ' + x.consecutive + '연전 시리즈와 교환 · 상위 7</small></div><table class="mini"><tr><th>슬롯</th><th>맞바꿀 시리즈</th>' + (showD ? '<th title="Hard 위반 변화">ΔHard</th><th title="S4 리그 총 이동거리 변화">ΔS4 km</th>' : '') + '<th></th></tr>';
    for (const k of cand.slice(0, 7)) {
      const dh = k.p.hardDelta, d4 = k.p.delta[6];
      h += '<tr><td>' + esc(D.fmtShort(c.slots[k.ts].day)) + '</td><td>' + esc(WB.app.matchLabel(k.t)) + '</td>' +
        (showD ? '<td class="n" style="' + (dh > 0 ? 'color:var(--c-ok);font-weight:600' : dh < 0 ? 'color:var(--c-bad)' : '') + '">' + (dh > 0 ? '▲+' : dh < 0 ? '▼' : '±') + Math.abs(dh) + '</td><td class="n" style="' + (d4 > 0 ? 'color:var(--c-ok)' : d4 < 0 ? 'color:var(--c-bad)' : '') + '">' + (d4 > 0 ? '+' : d4 < 0 ? '−' : '±') + Math.abs(d4).toLocaleString('ko-KR') + '</td>' : '') +
        '<td><button class="btn sm box" data-swap="' + m + '|' + k.t + '"' + (lock ? ' disabled' : '') + '>' + icon('swap') + '교환</button></td></tr>';
    }
    if (violationsOf(m).some(WB.isVirtual)) h += '</table><div class="callout info" style="margin-top:6px">' + icon('info') + ' 가상 위반입니다. 한 번의 교환으로 풀리지 않으면 <b>스냅샷 › 엔진 1차 결과</b>를 복원하거나 시리즈를 풀로 뺀 뒤 다시 넣어 보세요.</div><table style="display:none">';
    h += '</table>' + (showD ? '<div class="note" style="margin-top:4px">Δ는 교환 후 점수 − 현재 점수. ▲ = 좋아짐 (Hard 위반 감소, 이동거리 감소).</div>' : '');
    return h;
  }

  // ───────────── 명령 띠·탭 ─────────────
  function renderCmd() {
    const H = WB.hist, lock = WB.locked();
    const cal = WB.ui.view3 === 'cal' && WB.ui.sheet[3] === 'schedule';
    const teams = WB.app.state.teams;
    const f = WB.ui.teamFilter;
    document.getElementById('cmd').innerHTML =
      '<span class="grp"><button class="btn" data-act="undo"' + (H.undo.length && !lock ? '' : ' disabled') + ' title="실행 취소' + (H.undo.length ? ': ' + esc(WB.undoLabel()) : '') + '" aria-label="실행 취소">' + icon('undo') + (H.undo.length ? '<span style="max-width:150px;overflow:hidden;text-overflow:ellipsis">' + esc(WB.undoLabel()) + '</span>' : '') + '</button><button class="btn" data-act="redo"' + (H.redo.length && !lock ? '' : ' disabled') + ' aria-label="다시 실행">' + icon('redo') + '</button></span><span class="vr"></span>' +
      (WB.ui.sheet[3] === 'schedule' ? '<span class="gl">보기</span><span class="seg"><button data-act="view-grid" class="' + (cal ? '' : 'on') + '">' + icon('grid') + '격자</button><button data-act="view-cal" class="' + (cal ? 'on' : '') + '">' + icon('cal') + '달력</button></span>' : '') +
      (cal ? '<span class="seg" style="margin-left:6px">' + [3, 4, 5, 6, 7, 8].map((mo) => '<button data-month="' + mo + '" class="' + (WB.ui.month3 === mo ? 'on' : '') + '">' + mo + '월</button>').join('') + '</span>' : '') +
      '<span class="vr"></span><span class="gl">' + icon('filter') + ' 구단</span><span class="teamchips"><button class="chip' + (f.size ? '' : ' on') + '" data-tf="">전체</button>' + teams.map((t) => '<button class="chip' + (f.has(t.name) ? ' on' : '') + '" data-tf="' + esc(t.name) + '" aria-pressed="' + f.has(t.name) + '"><span class="sw" style="background:' + esc(t.color) + '"></span>' + esc(t.name) + '</button>').join('') + '</span>' +
      '<span class="grow"></span><button class="btn" data-act="pins" data-pop-anchor>' + icon('pin') + '핀 ' + icon('caret') + '</button><button class="btn" data-act="snap" data-pop-anchor>' + icon('camera') + '스냅샷 ' + icon('caret') + '</button>' +
      '<button class="btn box" data-act="reopt">' + icon('play') + '핀 유지 재최적화</button>';
    document.querySelectorAll('#cmd [data-month]').forEach((b) => b.addEventListener('click', () => { WB.ui.month3 = +b.dataset.month; WB.render(); }));
    document.querySelectorAll('#cmd [data-tf]').forEach((b) => b.addEventListener('click', () => {
      const n = b.dataset.tf;
      if (!n) WB.ui.teamFilter = new Set(); else { const s = new Set(WB.ui.teamFilter); if (s.has(n)) s.delete(n); else s.add(n); WB.ui.teamFilter = s; }
      WB.render();
    }));
  }
  WB.actions['view-grid'] = () => { WB.ui.view3 = 'grid'; WB.render(); };
  WB.actions['view-cal'] = () => { WB.ui.view3 = 'cal'; if (WB.ui.selMatch != null && der().plan[WB.ui.selMatch] >= 0) WB.ui.month3 = D.month(der().slots[der().plan[WB.ui.selMatch]].day); WB.render(); };
  WB.actions.reopt = () => { WB.go({ step: 2 }); WB.toast('핀 ' + WB.app.state.matches.filter((m) => m.pinned).length + '개를 유지한 채 다시 실행합니다 — 초기해: 현재 배정 유지'); };
  WB.actions.pins = (el) => {
    WB.popover(el, '<div class="ph2">' + icon('pin') + '핀 고정</div><div class="pb" style="padding:4px 0">' +
      '<button class="btn" style="width:100%;justify-content:flex-start" data-act="pin-events">' + icon('pin') + '이벤트 대진 시리즈 일괄 고정</button>' +
      '<button class="btn" style="width:100%;justify-content:flex-start" data-act="pin-slot">' + icon('pin') + '선택 슬롯 모두 고정</button>' +
      '<button class="btn danger" style="width:100%;justify-content:flex-start" data-act="pin-clear">' + icon('close') + '모든 고정 해제</button>' +
      '<div class="note" style="padding:4px 10px">현재 고정 ' + WB.app.state.matches.filter((m) => m.pinned).length + '개</div></div>', { width: 250 });
  };
  WB.actions['pin-events'] = () => { WB.closePop(); WB.track('이벤트 시리즈 고정', () => WB.app.pinEventSeries(true)); WB.render(); };
  WB.actions['pin-slot'] = () => { WB.closePop(); const s = WB.ui.selSlot; if (s == null) return WB.toast('슬롯을 먼저 고르세요.'); WB.track('슬롯 고정', () => WB.app.pinSlot(s, true)); WB.render(); };
  WB.actions['pin-clear'] = () => { WB.closePop(); WB.track('모든 고정 해제', () => WB.app.unpinAll()); WB.render(); };
  WB.actions.snap = (el) => {
    const snaps = WB.app.state.snapshots.slice().reverse();
    const ex = der().ex;
    WB.popover(el, '<div class="ph2">' + icon('camera') + '스냅샷<span class="grow"></span><span class="note">FR-M7</span></div><div class="pb">' +
      '<div class="row"><input class="inp" id="snapName" value="수정안 ' + (WB.app.state.snapshots.length + 1) + '" aria-label="스냅샷 이름"><button class="btn pri" data-act="snap-save">저장</button></div>' +
      '<div class="note" style="margin:3px 0 8px">현재: ' + (ex.feasible ? '편성 가능' : 'Hard 위반 ' + ex.violations.length + '건') + ' · <span class="mono">' + esc(KBO.Score.scoreString(ex.score)) + '</span></div>' +
      '<table class="mini"><tr><th>이름</th><th>저장</th><th>상태</th><th></th></tr>' + snaps.map((s) => '<tr><td>' + esc(s.name) + '</td><td class="num">' + esc(new Date(s.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })) + '</td><td>' + (s.feasible ? WB.st('ok', '가능') : WB.st('bad', '위반')) + '</td><td><button class="btn sm box" data-restore="' + esc(s.id) + '">복원</button></td></tr>').join('') + '</table>' +
      '<div class="note" style="margin-top:6px">복원도 실행 취소할 수 있습니다. 스냅샷 비교(FR-Q4)는 이번 범위에서 뺐습니다.</div></div>', {
      width: 380,
      onMount: (p) => p.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', () => { WB.closePop(); WB.track('스냅샷 복원', () => WB.app.restoreSnapshot(b.dataset.restore)); WB.render(); }))
    });
  };
  WB.actions['snap-save'] = () => { const n = (document.getElementById('snapName') || {}).value || '스냅샷'; WB.closePop(); WB.app.saveSnapshot(n); WB.render(); };

  document.addEventListener('click', (e) => {
    const put = e.target.closest('[data-put]');
    if (put) { const [m, s] = put.dataset.put.split('|').map(Number); WB.track('풀에서 넣기', () => WB.app.moveMatch(m, s)); WB.render(); return; }
    const gl = e.target.closest('.gl2[data-m]');
    if (gl && WB.ui.step === 3 && WB.ui.screen === 'wizard') { WB.ui.selMatch = +gl.dataset.m; document.querySelectorAll('.gl2.selg').forEach((x) => x.classList.remove('selg')); gl.classList.add('selg'); fxFor(der().plan[+gl.dataset.m], 4 + slotMatches(der().plan[+gl.dataset.m]).indexOf(+gl.dataset.m), +gl.dataset.m); renderPane(); }
  });

  function renderTabs() {
    const id = WB.ui.sheet[3];
    const c = der();
    const tab = (sid, name, ico, cnt) => '<button class="tab' + (sid === id ? ' on' : '') + '" role="tab" aria-selected="' + (sid === id) + '" data-sheet="' + sid + '">' + icon(ico, 'tico') + name + (cnt || '') + '</button>';
    document.getElementById('tabs').innerHTML =
      tab('schedule', '일정 (슬롯 × 경기)', 'sheet', c.ex.violations.length ? '<span class="cnt error">' + icon('block') + c.ex.violations.length + '</span>' : '') +
      (WB.feature('M8') ? tab('pool', '미배정 풀', 'pool', '<span class="cnt n">' + c.pool.length + '</span>') : '') +
      (WB.feature('V6') ? tab('matrix', '구단 × 슬롯', 'grid') : '');
  }

  S3.render = function () {
    document.getElementById('main').classList.remove('nopane');
    let id = WB.ui.sheet[3];
    if ((id === 'pool' && !WB.feature('M8')) || (id === 'matrix' && !WB.feature('V6'))) id = WB.ui.sheet[3] = 'schedule';
    renderCmd(); renderTabs();
    const host = document.getElementById('gridhost');
    const cal = id === 'schedule' && WB.ui.view3 === 'cal';
    const spec = id === 'pool' ? poolGrid() : id === 'matrix' ? matrixGrid() : cal ? calGrid() : scheduleGrid();
    if (id === 'schedule' && !cal && WB.ui.selMatch != null && !WB.ui.pendingCell && !WB.ui.sel['s3-sched']) {
      const s = der().plan[WB.ui.selMatch];
      if (s >= 0) WB.ui.pendingCell = WB.colName(4 + slotMatches(s).indexOf(WB.ui.selMatch)) + (s + 2);
    }
    if (!cal && id === 'schedule' && !WB.ui.sel['s3-sched'] && !WB.ui.pendingCell) WB.ui.sel['s3-sched'] = { r: 13, c: 4 };
    const g = WB.Grid.mount(host, spec);
    WB.lockOverlay(host);
    if (WB.ui.pendingViolation != null) {
      const v = der().ex.violations[WB.ui.pendingViolation];
      WB.ui.pendingViolation = null;
      if (v) { S3.selectViolation(v); return; }
    }
    if (cal) { spec.onSelect(g.sel.r, g.sel.c); const m = WB.ui.selMatch; if (m != null && der().plan[m] >= 0) fxFor(der().plan[m], 4 + slotMatches(der().plan[m]).indexOf(m), m); renderPane(); } else spec.onSelect(g.sel.r, g.sel.c);
  };
})();
