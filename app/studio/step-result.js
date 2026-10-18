/*
 * alt-a 편성 스튜디오 — ③ 결과·수정
 * 왼쪽: 위반 목록 · 구단 필터 · 미배정 풀 / 가운데: 월간 캘린더(슬롯 띠) · 슬롯 목록 · 구단×슬롯 / 오른쪽: 위반·시리즈 인스펙터(핀, 이동 후보 Δ)
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Score, Dates } = KBO;

  const MONTHS = [3, 4, 5, 6, 7, 8];
  const hardOf = (a) => a[0] + a[1];
  const softOf = (a) => a[2] + a[3] + a[4] + a[5] + a[6];

  function app() { return S.app; }
  function D() { return S.app.derived(); }

  S.findViolation = function (sig) { return D().ex.violations.find((v) => S.vsig(v) === sig) || null; };
  S.slotMonth = (s) => D().slots[s] ? D().slots[s].month : 4;

  // ───────── 이동 후보 (FR-M2 Δ) ─────────
  const candCache = { key: null, list: null };
  S.candidates = function (ms, slots, limit) {
    const c = D(), st = app().state;
    const key = c.version + '|' + ms.join(',') + '|' + (slots || []).join(',');
    if (candCache.key === key) return candCache.list.slice(0, limit || 5);
    const base = Score.flat(c.ex.score);
    const out = [];
    const M = st.matches.length;
    const plan = c.plan;
    const tmp = new Int32Array(plan.length);
    const res = [];
    for (const m of ms) {
      if (m == null || plan[m] < 0 || st.matches[m].pinned) continue;
      const mm = st.matches[m];
      for (let n = 0; n < M; n++) {
        if (n === m || plan[n] < 0 || plan[n] === plan[m]) continue;
        const nn = st.matches[n];
        if (nn.consecutive !== mm.consecutive || nn.pinned) continue;
        if (nn.home === mm.home && nn.away === mm.away) continue;
        tmp.set(plan); tmp[m] = plan[n]; tmp[n] = plan[m];
        Score.evaluate(c.ctx, tmp, res);
        out.push({ kind: 'swap', m, n, dh: hardOf(res) - hardOf(base), ds: softOf(res) - softOf(base) });
      }
      // 홈·원정 뒤집기 (입력 변경)
      const input = Score.buildInput(st);
      const im = input.matches[m]; const t = im.home; im.home = im.away; im.away = t;
      const ctx2 = Score.createContext(input);
      Score.evaluate(ctx2, plan, res);
      out.push({ kind: 'flip', m, dh: hardOf(res) - hardOf(base), ds: softOf(res) - softOf(base) });
    }
    for (const s of slots || []) {
      if (s == null || s < 0) continue;
      const pinnedIn = (x) => c.bySlot[x].some((i) => st.matches[i].pinned);
      if (pinnedIn(s)) continue;
      for (let t = 0; t < c.slots.length; t++) {
        if (t === s || c.slots[t].consecutive !== c.slots[s].consecutive || pinnedIn(t)) continue;
        for (let i = 0; i < plan.length; i++) tmp[i] = plan[i] === s ? t : plan[i] === t ? s : plan[i];
        Score.evaluate(c.ctx, tmp, res);
        out.push({ kind: 'slots', a: s, b: t, dh: hardOf(res) - hardOf(base), ds: softOf(res) - softOf(base) });
      }
    }
    out.sort((x, y) => y.dh - x.dh || y.ds - x.ds);
    candCache.key = key; candCache.list = out;
    return out.slice(0, limit || 5);
  };

  function candLabel(cd) {
    const st = app().state, c = D();
    const sl = (s) => fmt.date(c.slots[s].day);
    if (cd.kind === 'swap') return { kind: '시리즈 맞바꾸기', what: app().matchLabel(cd.m) + ' ↔ ' + app().matchLabel(cd.n) + ' (' + sl(c.plan[cd.n]) + ')' };
    if (cd.kind === 'slots') return { kind: '슬롯 맞바꾸기', what: sl(cd.a) + ' ↔ ' + sl(cd.b) + ' (' + c.slots[cd.a].consecutive + '연전 5시리즈)' };
    const m = st.matches[cd.m];
    return { kind: '홈·원정 뒤집기 · 입력 변경', what: m.away + ' @ ' + m.home + ' → ' + m.home + ' @ ' + m.away };
  }
  function deltaHtml(cd) {
    if (!S.feature('M2')) return '';
    const h = cd.dh, s = cd.ds;
    const hc = h > 0 ? 'd-good' : h < 0 ? 'd-bad' : 'd-zero';
    const sc = s > 0 ? 'd-good' : s < 0 ? 'd-bad' : 'd-zero';
    return '<span class="delta"><span class="' + hc + '">Hard ' + fmt.signed(h) + (h > 0 ? ' 해소' : '') + '</span><span class="' + sc + '">Soft ' + fmt.signed(s) + '</span></span>';
  }
  function candList(list) {
    if (!list.length) return '<div class="empty">옮길 수 있는 후보가 없습니다(고정된 시리즈).</div>';
    return '<div class="cands">' + list.map((cd, i) => {
      const L = candLabel(cd);
      return '<div class="cand"><span class="what"><span class="kind">' + esc(L.kind) + '</span>' + esc(L.what) + '</span>' + deltaHtml(cd) +
        '<button class="btn sm go' + (i === 0 && cd.dh > 0 ? ' primary' : '') + '" data-act="apply-cand" data-c="' + esc(JSON.stringify(cd)) + '">적용</button></div>';
    }).join('') + '</div>';
  }

  // ───────── 왼쪽: 위반 · 구단 필터 · 미배정 풀 ─────────
  function renderList() {
    const c = D(), ex = c.ex, u = S.ui;
    let s = '<div class="pane-head"><span class="pane-title">Hard 위반</span><span class="pane-desc">' + (ex.violations.length ? '클릭하면 위치로 이동' : '없음') + '</span>' +
      '<span style="margin-left:auto">' + (ex.violations.length ? S.stat('block', ex.violations.length + '건') : S.stat('ok', '0건')) + '</span></div>';
    s += '<div class="pane-body" data-sk="r-list">';
    if (!ex.violations.length) s += '<div class="empty"><b>' + icon('check') + ' Hard 위반이 없습니다</b>편성 가능한 일정입니다. ④ 품질·배포로 넘어가세요.</div>';
    for (const r of Score.HARD_RULES) {
      const vs = ex.violations.filter((v) => v.code === r.code);
      if (!vs.length) continue;
      s += '<div class="vrule"><code>' + r.code + '</code>' + esc(r.label) + '<span class="cnt">' + vs.length + '</span></div>';
      for (const v of vs) {
        const sig = S.vsig(v);
        const on = u.sel === 'v:' + sig;
        s += '<button class="li v vitem' + (on ? ' active' : '') + '" data-act="sel-viol" data-sig="' + esc(sig) + '">' +
          '<span class="ico" style="color:var(--bad)">' + icon('x') + '</span><span class="li-main"><span class="msg">' + esc(shortMsg(v)) + '</span>' +
          '<span class="loc">' + icon('cal') + esc(fmt.date(c.slots[v.slot].day)) + (S.isVirtual(v) ? ' ' + S.virt() : '') + '</span></span></button>';
      }
    }
    s += '<div class="list-sep"></div>';
    s += '<div class="label">구단 필터<span class="cnt">' + (u.teamFilter.length ? '<button class="btn xs ghost" data-act="tf-clear">해제</button>' : '전체') + '</span></div>';
    s += '<div class="tf">' + app().state.teams.map((t) => {
      const on = u.teamFilter.includes(t.name);
      return '<button class="' + (on ? 'on' : '') + '" data-act="tf" data-team="' + esc(t.name) + '" aria-pressed="' + on + '"><i class="sw" style="background:' + esc(t.color) + '"></i>' + esc(t.name) + '<span class="ck">' + (on ? icon('check') : '') + '</span></button>';
    }).join('') + '</div>';
    if (S.feature('M8')) {
      s += '<div class="label">미배정 풀<span class="cnt">' + c.pool.length + '</span></div>';
      if (c.pool.length) s += '<div class="pool" data-drop-pool="1">' + c.pool.map((m) => chip(m, -1)).join('') + '</div>';
      else s += '<div class="small muted" style="padding:0 12px 12px" data-drop-pool="1">비어 있음. 시리즈를 여기로 끌어 놓거나 인스펙터에서 뺄 수 있습니다.</div>';
    }
    s += '</div>';
    return s;
  }
  function shortMsg(v) {
    // 날짜 접두를 떼고 원인만 남긴다(날짜는 아래 줄에 표시)
    return String(v.message).replace(/^\d+\/\d+\([^)]+\) \d연전\s*(—\s*)?/, '');
  }

  // ───────── 가운데: 캘린더 ─────────
  function chip(m, slot) {
    const st = app().state, c = D(), u = S.ui;
    const mt = st.matches[m];
    const flags = c.ex.matchFlags[m] || [];
    const f = u.teamFilter;
    const involved = !f.length || f.includes(mt.home) || f.includes(mt.away);
    let fm = '';
    if (f.length && involved) {
      const homeSide = f.includes(mt.home);
      fm = homeSide ? '<span class="fm h" title="홈">H</span>' : '<span class="fm a" title="원정">A</span>';
    }
    const sel = u.sel === 'm:' + m;
    const flash = u.flashMatches && u.flashMatches.includes(m);
    const cls = 'gm' + (flags.length ? ' viol' : '') + (sel ? ' sel' : '') + (!involved ? ' dim' : '') + (f.length && involved ? ' focus-team' : '') + (flash ? ' flash' : '');
    const stad = (app().team(mt.home) || {}).stadium || '';
    return '<button class="' + cls + '" data-act="sel-match" data-m="' + m + '" draggable="true" data-drag-m="' + m + '" title="' + esc(mt.away + ' @ ' + mt.home + ' · ' + stad + (flags.length ? ' · 위반 ' + flags.join(', ') : '') + (mt.pinned ? ' · 고정' : '')) + '">' +
      fm + (mt.pinned ? '<span class="pin-ico">' + icon('pin') + '</span>' : '') +
      '<span class="tm"><i style="background:' + esc(S.teamColor(mt.away)) + '"></i>' + esc(mt.away) + '</span><span class="at">@</span>' +
      '<span class="tm"><i style="background:' + esc(S.teamColor(mt.home)) + '"></i>' + esc(mt.home) + '</span>' +
      (S.wide ? '<span class="stad">· ' + esc(stad.replace(/(야구장|경기장|종합운동장|구장|라이언즈파크|챔피언스필드|이글스파크|NC파크|KT위즈파크|돔야구장)$/, '')) + '</span>' : '') +
      (flags.length ? '<span class="st-ico">' + icon('warn') + esc(flags.join(' ')) + '</span>' : '') + '</button>';
  }

  function renderCalendar() {
    const c = D(), st = app().state, u = S.ui;
    const month = u.month || 4;
    const y = 2025;
    const first = Dates.dayNum(y + '-' + String(month).padStart(2, '0') + '-01');
    const nextMonth = month === 12 ? Dates.dayNum((y + 1) + '-01-01') : Dates.dayNum(y + '-' + String(month + 1).padStart(2, '0') + '-01');
    const last = nextMonth - 1;
    const wd = (d) => (Dates.weekday(d) + 6) % 7; // 월=0
    let start = first - wd(first);
    const end = last + (6 - wd(last));
    const hol = new Map((st.settings.holidays || []).map((h) => [Dates.dayNum(h.date), h.name]));
    const black = new Set();
    for (const b of st.settings.blackouts || []) for (let d = Dates.dayNum(b.start); d <= Dates.dayNum(b.end); d++) black.add(d);
    const ref = Dates.dayNum(app().referenceDate());
    const seasonStart = c.slots.length ? c.slots[0].day : first;
    const weeks = [];
    for (let w = start; w <= end; w += 7) {
      // 시즌 시작 전 주는 건너뛴다
      if (w + 6 < seasonStart) continue;
      weeks.push(w);
    }
    let s = '<div class="cal-wrap"><div class="cal-head"><div></div>' + ['월', '화', '수', '목', '금', '토', '일'].map((d, i) => '<div class="' + (i === 6 ? 'sun' : i === 0 ? 'mon' : '') + '">' + d + '</div>').join('') + '</div>';
    s += '<div class="cal-grid" style="grid-template-rows:repeat(' + weeks.length + ',minmax(0,1fr))">';
    for (const w of weeks) {
      s += '<div class="cal-week"><div class="cal-wk">' + weekNo(w) + '주</div>';
      const slotsHere = c.slots.filter((sl) => sl.days.some((d) => d >= w && d <= w + 6));
      for (let i = 0; i < 7; i++) {
        const d = w + i;
        const out = d < first || d > last;
        const hn = hol.get(d);
        const sl = slotsHere.find((x) => x.days[0] === d);
        let extra = '';
        if (sl) {
          const hard = c.ex.slotHard[sl.index];
          extra = ' <span class="muted">· ' + sl.consecutive + '연전' + (sl.weekend ? ' 주말' : '') + '</span>' + (hard ? ' <span style="color:var(--bad);font-weight:700">' + icon('x') + slotCodes(sl.index) + '</span>' : '');
        }
        s += '<div class="cal-day' + (out ? ' out' : '') + (i === 6 ? ' sun' : '') + (hn ? ' hol' : '') + (d === ref ? ' today' : '') + '" style="grid-column:' + (i + 2) + '">' + Dates.fmtShort(d).split('/')[1] + (hn ? '<span class="hn">' + esc(hn) + '</span>' : '') + extra + '</div>';
        const inSlot = c.dayToSlot.has(d);
        if (!inSlot) s += '<div class="cal-fill' + (black.has(d) ? ' black' : out ? ' out' : ' rest') + '" style="grid-column:' + (i + 2) + '" title="' + (black.has(d) ? '경기 없는 기간' : out ? '' : '휴식일') + '"></div>';
      }
      for (const sl of slotsHere) {
        const ds = sl.days.filter((d) => d >= w && d <= w + 6);
        const col = wd(ds[0]) + 2;
        const hard = c.ex.slotHard[sl.index] > 0;
        const outMonth = ds.every((d) => d < first || d > last);
        s += '<div class="slotband' + (hard ? ' hard' : '') + '" style="grid-column:' + col + ' / span ' + ds.length + (outMonth ? ';opacity:.5' : '') + '" data-drop-slot="' + sl.index + '" title="' + esc(sl.label) + '">' +
          '<div class="sb-list" style="grid-template-rows:repeat(' + Math.max(5, c.bySlot[sl.index].length) + ',minmax(0,1fr))">' + c.bySlot[sl.index].map((m) => chip(m, sl.index)).join('') + '</div></div>';
      }
      s += '</div>';
    }
    s += '</div></div>';
    return s;
  }
  function slotCodes(s) {
    const set = new Set(D().ex.violations.filter((v) => v.slot === s && v.code !== 'H0-f' && v.code !== 'H1').map((v) => v.code));
    return Array.from(set).join(' ') || '';
  }
  function weekNo(d) {
    const st = D().slots.length ? D().slots[0].day : d;
    const s0 = st - ((Dates.weekday(st) + 6) % 7);
    return Math.floor((d - s0) / 7) + 1;
  }

  function renderSlotList() {
    const c = D(), st = app().state;
    let s = '<div class="pane-body" data-sk="r-slots"><table class="slotlist"><thead><tr><th>#</th><th>슬롯</th><th>연전</th><th>주말</th><th>휴일</th><th>상태</th><th>시리즈 (원정 @ 홈)</th></tr></thead><tbody>';
    for (const sl of c.slots) {
      const hard = c.ex.slotHard[sl.index];
      s += '<tr class="' + (hard ? 'hard' : '') + '"><td class="mono">' + (sl.index + 1) + '</td><td>' + esc(fmt.date(sl.day)) + '</td><td>' + sl.consecutive + '</td><td>' + (sl.weekend ? '주말' : '-') + '</td><td>' + sl.holiday + '</td><td>' +
        (hard ? S.stat('block', '위반 ' + hard) : S.stat('ok', '정상')) + '</td><td>' + c.bySlot[sl.index].map((m) => '<button class="btn xs ghost" data-act="sel-match" data-m="' + m + '">' + esc(st.matches[m].away + '@' + st.matches[m].home) + ((c.ex.matchFlags[m] || []).length ? ' ' + icon('warn') : '') + '</button>').join('') + '</td></tr>';
    }
    return s + '</tbody></table></div>';
  }

  function renderMatrix() {
    const c = D(), st = app().state;
    let s = '<div class="pane-body xy" data-sk="r-mx"><table class="slotlist" style="width:auto"><thead><tr><th style="position:sticky;left:0;background:#F5F6F8;z-index:2">구단</th>' + c.slots.map((sl) => '<th class="mono" style="font-size:10px">' + esc(Dates.fmtShort(sl.day)) + '</th>').join('') + '</tr></thead><tbody>';
    for (const t of st.teams) {
      s += '<tr><th style="position:sticky;left:0;background:#fff;z-index:1">' + S.team(t.name) + '</th>';
      for (const sl of c.slots) {
        const m = c.bySlot[sl.index].find((i) => st.matches[i].home === t.name || st.matches[i].away === t.name);
        if (m == null) { s += '<td class="muted">·</td>'; continue; }
        const mt = st.matches[m];
        const home = mt.home === t.name;
        const bad = (c.ex.matchFlags[m] || []).length;
        s += '<td style="' + (home ? 'background:#0A1E3C;color:#fff;' : '') + (bad ? 'box-shadow:inset 0 0 0 2px #B3261E;' : '') + 'font-size:11px;cursor:pointer" data-act="sel-match" data-m="' + m + '">' + (home ? 'H ' : 'A ') + esc(home ? mt.away : mt.home) + '</td>';
      }
      s += '</tr>';
    }
    return s + '</tbody></table></div>';
  }

  function monthViolations(mo) {
    const c = D();
    return c.ex.violations.filter((v) => c.slots[v.slot] && c.slots[v.slot].month === mo).length;
  }

  function renderMain() {
    const u = S.ui;
    const views = [['calendar', '달력', 'cal'], ['slots', '슬롯 목록', 'list']];
    if (S.feature('V6')) views.push(['matrix', '구단 × 슬롯', 'grid']);
    if (!views.some((v) => v[0] === u.view)) u.view = 'calendar';
    let s = '<div class="toolbar">' +
      '<div class="seg" role="tablist">' + views.map((v) => '<button class="' + (u.view === v[0] ? 'on' : '') + '" data-act="r-view" data-view="' + v[0] + '">' + icon(v[2]) + v[1] + '</button>').join('') + '</div>';
    if (u.view === 'calendar') {
      s += '<div class="month-tabs">' + MONTHS.map((mo) => { const n = monthViolations(mo); return '<button class="' + (u.month === mo ? 'on' : '') + '" data-act="r-month" data-month="' + mo + '">' + mo + '월' + (n ? '<span class="mv">' + icon('x') + n + '</span>' : '') + '</button>'; }).join('') + '</div>';
      s += '<span class="legend" style="margin-left:6px"><span><span class="fm h" style="display:inline-grid;place-items:center;width:13px;height:13px;border-radius:2px;background:var(--navy);color:#fff;font-size:9px;font-weight:800">H</span>홈</span><span><span style="display:inline-grid;place-items:center;width:13px;height:13px;border-radius:2px;border:1px solid var(--navy);font-size:9px;font-weight:800">A</span>원정</span><span><i style="background:#FFF1F0;box-shadow:inset 2px 0 0 #B3261E"></i>위반</span><span>' + icon('pin') + '고정</span></span>';
    }
    s += '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' + S.undoButtons() +
      '<button class="btn sm" data-act="snap-menu" aria-haspopup="menu">' + icon('bookmark') + '스냅샷 ' + app().state.snapshots.length + icon('down') + '</button></span></div>';
    if (u.view === 'calendar') s += renderCalendar();
    else if (u.view === 'slots') s += renderSlotList();
    else s += renderMatrix();
    return s;
  }

  // ───────── 오른쪽: 인스펙터 ─────────
  function teamStrip(name, hiSlot) {
    const c = D();
    const tm = c.ex.teamMetrics.find((x) => x.name === name);
    if (!tm) return '';
    const bySlot = new Map(tm.visits.map((v) => [v.slot, v]));
    const overSlots = new Set();
    for (const r of tm.runs) if (r.length > 3) r.slots.slice(3).forEach((x) => overSlots.add(x));
    let s = '<div class="mini-strip" title="' + esc(name) + ' 슬롯별 홈(진한 칸)/원정">';
    for (const sl of c.slots) {
      const v = bySlot.get(sl.index);
      s += '<i class="' + (v && v.home ? 'h' : '') + (overSlots.has(sl.index) ? ' over' : '') + '" style="' + (sl.index === hiSlot ? 'outline:2px solid #1F5FD6;outline-offset:0;' : '') + (v ? '' : 'background:#fff;') + '"></i>';
    }
    return s + '</div>';
  }

  function inspViolation(v) {
    const c = D(), st = app().state;
    const rule = Score.RULE_BY_CODE[v.code];
    let s = '<div class="insp-sec"><div class="insp-title"><span class="vrule" style="padding:0"><code>' + v.code + '</code></span>' + esc(rule.label) + (S.isVirtual(v) ? S.virt() : '') + '</div>' +
      '<div class="insp-sub">' + esc(rule.desc) + '</div></div>';
    s += '<div class="insp-sec"><h4>원인</h4><div>' + esc(v.message) + '</div>' +
      (S.isVirtual(v) ? '<div class="small muted" style="margin-top:6px">' + icon('info') + ' 시연용 가상 위반: ' + esc(virtNote(v)) + '</div>' : '') + '</div>';
    s += '<div class="insp-sec"><h4>위치<span class="r">' + esc(c.slots[v.slot].label) + '</span></h4>' +
      (v.matches || []).map((m) => '<button class="li" data-act="sel-match" data-m="' + m + '" style="padding-left:6px"><span class="ico">' + icon('target') + '</span><span class="li-main">' + esc(app().matchLabel(m)) + ' <span class="muted small">' + esc(c.plan[m] >= 0 ? fmt.date(c.slots[c.plan[m]].day) : '미배정') + '</span></span>' + icon('right') + '</button>').join('') +
      '</div>';
    const slots = v.code === 'H0-f' ? [] : [v.slot];
    if (v.code === 'H0-f') for (const m of v.matches || []) if (c.plan[m] >= 0) slots.push(c.plan[m]);
    const cands = S.candidates((v.matches || []).filter((m) => c.plan[m] >= 0), slots, 5);
    s += '<div class="insp-sec"><h4>조치 후보' + (S.feature('M2') ? '<span class="r">Δ = 적용 후 − 현재</span>' : '') + '</h4>' + candList(cands) + '</div>';
    return s;
  }
  function virtNote(v) {
    const sd = { 'H0-f': S.SEEDS[0], 'H0-b': S.SEEDS[1], 'H1': S.SEEDS[2] }[v.code];
    return sd ? sd.note : '시드로 넣은 위반';
  }

  function inspMatch(m) {
    const c = D(), st = app().state;
    const mt = st.matches[m];
    if (!mt) return '<div class="empty">시리즈를 찾을 수 없습니다.</div>';
    const s0 = c.plan[m];
    const sl = s0 >= 0 ? c.slots[s0] : null;
    const team = app().team(mt.home) || {};
    const flags = c.ex.matchFlags[m] || [];
    const vs = c.ex.violations.filter((v) => (v.matches || []).includes(m));
    const ev = mt.eventId ? st.events.find((e) => e.id === mt.eventId) : null;
    let s = '<div class="insp-sec"><div class="insp-title">' + S.team(mt.away) + '<span class="muted">@</span>' + S.team(mt.home) + (mt.pinned ? '<span class="tag pin">' + icon('pin') + '고정</span>' : '') + '</div>' +
      '<div class="insp-sub">' + (sl ? esc(fmt.date(sl.day) + ' ~ ' + fmt.date(sl.days[sl.days.length - 1])) + ' · ' : '미배정 · ') + mt.consecutive + '연전 · 시리즈 #' + (m + 1) + '</div></div>';
    s += '<div class="insp-sec"><h4>속성</h4><dl class="props">' +
      '<dt>홈</dt><dd>' + S.team(mt.home) + '<span class="home-mark">H</span></dd>' +
      '<dt>원정</dt><dd>' + S.team(mt.away) + '<span class="away-mark">A</span></dd>' +
      '<dt>구장</dt><dd>' + esc(team.stadium || '-') + (mt.home === '두산' || mt.home === 'LG' ? '<span class="tag shared">공유 구장</span>' : '') + '</dd>' +
      '<dt>슬롯</dt><dd>' + (sl ? esc(sl.label) + (sl.weekend ? ' <span class="tag ref">주말</span>' : '') + (sl.holiday ? ' <span class="tag ref">휴일 ' + sl.holiday + '</span>' : '') : '미배정') + '</dd>' +
      (ev ? '<dt>이벤트</dt><dd>' + esc(ev.name) + ' <span class="tag pin">대진 지정</span></dd>' : '') +
      '<dt>상태</dt><dd>' + (vs.length ? vs.map((v) => '<button class="btn xs" style="color:var(--bad)" data-act="sel-viol" data-sig="' + esc(S.vsig(v)) + '">' + icon('x') + v.code + '</button>').join('') : S.stat('ok', '위반 없음')) + '</dd>' +
      '</dl></div>';
    s += '<div class="insp-sec"><h4>고정·풀</h4><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<label style="display:inline-flex;gap:8px;align-items:center"><span class="switch"><input type="checkbox" data-in="pin" data-m="' + m + '"' + (mt.pinned ? ' checked' : '') + '><i></i></span>핀 고정 <span class="muted small">(엔진이 옮기지 않음)</span></label>' +
      (S.feature('M8') ? (s0 >= 0 ? '<button class="btn sm" style="margin-left:auto" data-act="to-pool" data-m="' + m + '">' + icon('pool') + '미배정 풀로</button>' : '') : '') +
      '</div></div>';
    if (s0 < 0) {
      // 풀에서 넣을 슬롯 후보
      const c2 = D();
      const opts = c2.slots.filter((x) => x.consecutive === mt.consecutive).map((x) => { const p = app().previewDrop(m, x.index); return { x, p }; }).sort((a, b) => b.p.hardDelta - a.p.hardDelta).slice(0, 5);
      s += '<div class="insp-sec"><h4>넣을 슬롯 후보</h4><div class="cands">' + opts.map((o) => '<div class="cand"><span class="what"><span class="kind">슬롯에 넣기</span>' + esc(o.x.label) + '</span>' + (S.feature('M2') ? '<span class="delta"><span class="' + (o.p.hardDelta > 0 ? 'd-good' : o.p.hardDelta < 0 ? 'd-bad' : 'd-zero') + '">Hard ' + fmt.signed(o.p.hardDelta) + '</span></span>' : '') + '<button class="btn sm go" data-act="from-pool" data-m="' + m + '" data-slot="' + o.x.index + '">넣기</button></div>').join('') + '</div></div>';
    } else {
      const cands = S.candidates([m], [], 5).filter((x) => x.kind === 'swap' || x.kind === 'flip');
      s += '<div class="insp-sec"><h4>이동 후보' + (S.feature('M2') ? '<span class="r">Δ 미리보기</span>' : '') + '</h4>' + (mt.pinned ? '<div class="small muted">고정된 시리즈는 옮길 수 없습니다. 핀을 풀면 후보가 나옵니다.</div>' : candList(cands)) + '</div>';
    }
    s += '<div class="insp-sec"><h4>홈/원정 흐름<span class="r">45 슬롯</span></h4>' +
      '<div class="small" style="margin-bottom:3px">' + S.team(mt.home) + '</div>' + teamStrip(mt.home, s0) +
      '<div class="small" style="margin:6px 0 3px">' + S.team(mt.away) + '</div>' + teamStrip(mt.away, s0) +
      '<div class="legend" style="margin-top:6px"><span><i style="background:var(--navy)"></i>홈</span><span><i style="background:#D9DFE9"></i>원정</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--bad)"></i>3연속 초과</span><span><i style="outline:2px solid var(--blue)"></i>이 시리즈</span></div></div>';
    return s;
  }

  function renderInsp() {
    const u = S.ui;
    if (u.sel && u.sel.startsWith('v:')) {
      const v = S.findViolation(u.sel.slice(2));
      if (v) return { title: '위반 상세', html: inspViolation(v) };
    }
    if (u.sel && u.sel.startsWith('m:')) return { title: '시리즈 상세', html: inspMatch(parseInt(u.sel.slice(2), 10)) };
    const ex = D().ex;
    return { title: '인스펙터', html: '<div class="empty"><b>항목을 고르세요</b>왼쪽 위반이나 달력의 시리즈를 고르면 원인, 핀, 이동 후보와 Δ가 여기에 나옵니다.</div>' +
      '<div class="insp-sec"><h4>규칙별 건수</h4><dl class="props">' + Score.HARD_RULES.map((r) => '<dt><code class="mono">' + r.code + '</code></dt><dd>' + (ex.byCode[r.code].count ? S.stat('block', ex.byCode[r.code].count + '건') : S.stat('ok', '0')) + '<span class="small muted">' + esc(r.label) + '</span></dd>').join('') + '</dl></div>' };
  }

  // ───────── 단계 ─────────
  S.steps[3] = {
    render() {
      S.wide = window.innerWidth >= 1800;
      const insp = renderInsp();
      return '<div class="stepview no-band">' + S.workspace({ list: renderList(), main: renderMain(), insp: insp.html, inspTitle: insp.title, listLabel: '위반·구단 필터' }) + '</div>';
    },
    after() {
      const u = S.ui;
      if (u.sel) S.revealSelected('.li.active', '.pane.list .pane-body');
      if (u.flashMatches) setTimeout(() => { u.flashMatches = null; }, 50);
      bindDnD();
    }
  };

  // ───────── 동작 ─────────
  Object.assign(S.actions, {
    'sel-viol': (el) => {
      const v = S.findViolation(el.dataset.sig);
      if (!v) return;
      S.go({ step: 3, ops: null, sel: 'v:' + el.dataset.sig, month: S.slotMonth(v.slot), view: S.ui.view === 'matrix' ? 'matrix' : 'calendar', flashMatches: (v.matches || []).slice() });
    },
    'sel-match': (el) => {
      const m = parseInt(el.dataset.m, 10);
      const s = D().plan[m];
      S.go({ step: 3, sel: 'm:' + m, month: s >= 0 && S.ui.view === 'calendar' ? S.slotMonth(s) : S.ui.month });
    },
    'r-view': (el) => S.go({ view: el.dataset.view }),
    'r-month': (el) => S.go({ month: +el.dataset.month }),
    'tf': (el) => { const f = S.ui.teamFilter.slice(); const t = el.dataset.team; const i = f.indexOf(t); if (i >= 0) f.splice(i, 1); else f.push(t); S.go({ teamFilter: f }); },
    'tf-clear': () => S.go({ teamFilter: [] }),
    'to-pool': (el) => { app().moveMatch(+el.dataset.m, -1); },
    'from-pool': (el) => { app().moveMatch(+el.dataset.m, +el.dataset.slot); },
    'apply-cand': (el) => {
      const cd = JSON.parse(el.dataset.c);
      const before = D().ex.violations.length;
      const sel = S.ui.sel;
      let ok;
      if (cd.kind === 'swap') ok = app().swapMatches(cd.m, cd.n);
      else if (cd.kind === 'slots') {
        const c = D();
        ok = app().commit('슬롯 맞바꾸기: ' + fmt.date(c.slots[cd.a].day) + ' ↔ ' + fmt.date(c.slots[cd.b].day), (s) => { for (const p of s.plan) { if (p.calendar === cd.a) p.calendar = cd.b; else if (p.calendar === cd.b) p.calendar = cd.a; } }, ['plan']);
      } else ok = app().commit('홈·원정 뒤집기: ' + app().matchLabel(cd.m), (s) => { const m = s.matches[cd.m]; const t = m.home; m.home = m.away; m.away = t; }, ['matches']);
      if (!ok) return;
      const after = D().ex.violations.length;
      if (sel && sel.startsWith('v:') && !S.findViolation(sel.slice(2))) S.ui.sel = after ? 'v:' + S.vsig(D().ex.violations[0]) : null;
      S.toast((after < before ? '위반 ' + (before - after) + '건 해소 · ' : '') + '적용했습니다. 실행 취소로 되돌릴 수 있습니다.', after < before ? 'ok' : 'info');
    },
    'snap-menu': (el) => { const r = el.getBoundingClientRect(); S.ui.menuPos = { x: r.right, y: r.bottom + 4 }; S.ui.menu = S.ui.menu === 'snap' ? null : 'snap'; S.render(); },
    'snap-save': () => { const d = new Date(); app().saveSnapshot('수정안 ' + (app().state.snapshots.length + 1) + ' — ' + fmt.clock(d)); S.ui.menu = null; },
    'snap-restore': (el) => { app().restoreSnapshot(el.dataset.id); S.ui.menu = null; S.render(); }
  });
  S.inputs.pin = (el) => { app().togglePin(+el.dataset.m, el.checked); };

  S.menus.snap = function () {
    const p = S.ui.menuPos || { x: 0, y: 0 };
    const snaps = app().state.snapshots.slice().reverse();
    return '<div class="menu" role="menu" style="top:' + p.y + 'px;right:' + Math.max(8, window.innerWidth - p.x) + 'px;width:330px">' +
      '<button role="menuitem" data-act="snap-save">' + icon('plus') + '현재 배정을 스냅샷으로 저장</button><div class="msep"></div><div class="mh">저장된 스냅샷 ' + snaps.length + '</div>' +
      (snaps.length ? snaps.map((sn) => '<button role="menuitem" data-act="snap-restore" data-id="' + esc(sn.id) + '" style="height:auto;padding:6px 12px;flex-direction:column;align-items:flex-start;gap:1px"><span style="display:flex;gap:6px;width:100%"><b>' + esc(sn.name) + '</b><span class="tag ref" style="margin-left:auto">복원</span></span><span class="mono muted" style="font-size:10.5px">' + esc((sn.score || '').replace(/-/g, '−')) + '</span></button>').join('') : '<div class="small muted" style="padding:6px 12px">없음</div>') +
      '</div>';
  };

  // ───────── 드래그 앤 드롭 (FR-M1) ─────────
  function bindDnD() {
    const root = document.querySelector('.pane.main');
    if (!root || root._dnd) return;
    root._dnd = true;
    root.addEventListener('dragstart', (e) => { const el = e.target.closest('[data-drag-m]'); if (!el) return; e.dataTransfer.setData('text/plain', el.dataset.dragM); e.dataTransfer.effectAllowed = 'move'; S._dragM = +el.dataset.dragM; });
    root.addEventListener('dragover', (e) => { if (S._dragM == null) return; const band = e.target.closest('[data-drop-slot]'); if (band) { e.preventDefault(); band.classList.add('drop-ok'); } });
    root.addEventListener('dragleave', (e) => { const band = e.target.closest('[data-drop-slot]'); if (band) band.classList.remove('drop-ok'); });
    root.addEventListener('drop', (e) => {
      const band = e.target.closest('[data-drop-slot]');
      if (!band || S._dragM == null) return;
      e.preventDefault();
      const target = e.target.closest('[data-drag-m]');
      const m = S._dragM; S._dragM = null;
      const pv = app().previewDrop(m, +band.dataset.dropSlot, target ? +target.dataset.dragM : null);
      if (app().drop(m, +band.dataset.dropSlot, target ? +target.dataset.dragM : null)) S.toast('옮겼습니다 · Hard ' + fmt.signed(pv.hardDelta) + ' · 실행 취소 가능', pv.hardDelta >= 0 ? 'ok' : 'warn');
    });
  }
})();
