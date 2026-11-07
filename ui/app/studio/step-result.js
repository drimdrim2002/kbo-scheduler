/*
 * 편성 스튜디오 — ③ 일정 자세히 보기 (대안 다: 달력 하나 + 위반 넘기기 띠)
 * 위: 위반 띠(건수 · ‹ n / N › · 내용 · 고치는 방법 · 목록 ▾)
 *     도구줄(달력 | 구단별 연전 표 · 월 탭 · 구단 ▾ · 보관함 N(있을 때만) · 범례 · 실행 취소 · 중간 저장)
 *     2027 흐름(plan-flow.js S.r3Views)은 달력 | 홈/원정 흐름 | 상대별 경기 수 — 구단별 연전 표는 홈/원정 흐름 띠에 합쳤다(2026-11-06)
 * 가운데: 월간 달력(연전 띠) 또는 구단별 연전 표(또는 흐름 띠·상대별 경기 수)가 화면 전체. 왼쪽·오른쪽 칸은 없다.
 * 경기 칸을 누르면 옆에 「경기 창」, 위반 띠의 「고치는 방법」은 그 연전 띠 옆에 창.
 * 옮기기는 두 번 누르기: 경기 창 「옮기기…」 → 「옮기는 중」 → 놓을 수 있는 띠의 「여기로 · 위반 N↓」(또는 그 띠의 경기를 눌러 맞바꾸기).
 * 끌어 놓기는 없다(사용자 결정 2026-11-06).
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Score, Dates } = KBO;

  const hardOf = (a) => a[0] + a[1];
  const softOf = (a) => a[2] + a[3] + a[4] + a[5] + a[6];

  function app() { return S.app; }
  function D() { return S.app.derived(); }
  /** 결과 고치기(2027 흐름, plan-edit.js): 연전 기간 고정 · 손으로 놓기. 없으면(예전 화면) 아무것도 바꾸지 않는다 */
  const EX = () => (S.r3Edit && S.r3Edit.on() ? S.r3Edit : null);

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
    if (cd.kind === 'swap') return { kind: '경기 맞바꾸기', what: app().matchLabel(cd.m) + ' ↔ ' + app().matchLabel(cd.n) + ' (' + sl(c.plan[cd.n]) + ')' };
    if (cd.kind === 'slots') return { kind: '연전 기간 맞바꾸기', what: sl(cd.a) + ' ↔ ' + sl(cd.b) + ' (' + c.slots[cd.a].consecutive + '연전 ' + (st.teams.length >> 1) + '경기 통째로)' };
    const m = st.matches[cd.m];
    return { kind: '홈·원정 바꾸기 · 입력 데이터도 바뀜', what: app().matchLabel(cd.m) + ' → ' + m.home + ' vs ' + m.away };
  }
  /** Δ 표시. 일반 모드: 위반 증감 + 공정성 좋아짐/나빠짐(아이콘·글자). 개발자 모드: Hard/Soft 수치 */
  S.deltaHtml = function (h, s) {
    const hc = h > 0 ? 'd-good' : h < 0 ? 'd-bad' : 'd-zero';
    const sc = s > 0 ? 'd-good' : s < 0 ? 'd-bad' : 'd-zero';
    if (S.dev()) return '<span class="delta"><span class="' + hc + '">Hard ' + fmt.signed(h) + (h > 0 ? ' 해소' : '') + '</span>' + (s != null ? '<span class="' + sc + '">Soft ' + fmt.signed(s) + '</span>' : '') + '</span>';
    const ht = h > 0 ? icon('check') + '위반 ' + h + ' 줄어듦' : h < 0 ? icon('x') + '위반 ' + (-h) + ' 늘어남' : '위반 그대로';
    const st = s == null ? '' : s > 0 ? icon('check') + '공정성 좋아짐' : s < 0 ? icon('warn') + '공정성 나빠짐' : '공정성 그대로';
    return '<span class="delta plain"><span class="' + hc + '">' + ht + '</span>' + (st ? '<span class="' + sc + '">' + st + '</span>' : '') + '</span>';
  };
  function deltaHtml(cd) {
    if (!S.feature('M2')) return '';
    return S.deltaHtml(cd.dh, cd.ds);
  }
  /** 짧은 증감 말: 「위반 2↓」·「위반 1↑」·「그대로」 (옮기는 중 띠·칸에 붙는다) */
  function deltaWord(h) {
    if (S.dev()) return 'Hard ' + fmt.signed(h);
    return h > 0 ? '위반 ' + h + '↓' : h < 0 ? '위반 ' + (-h) + '↑' : '위반 그대로';
  }
  function candList(list) {
    if (!list.length) return '<div class="empty">옮길 수 있는 후보가 없습니다(고정된 경기).</div>';
    return '<div class="cands">' + list.map((cd, i) => {
      const L = candLabel(cd);
      return '<div class="cand"><span class="what"><span class="kind">' + esc(L.kind) + '</span>' + esc(L.what) + '</span>' + deltaHtml(cd) +
        '<button class="btn sm go' + (i === 0 && cd.dh > 0 ? ' primary' : '') + '" data-act="apply-cand" data-c="' + esc(JSON.stringify(cd)) + '">적용</button></div>';
    }).join('') + '</div>';
  }

  // ───────── 위반 순서 (띠·목록 공통: 규칙별 묶음) ─────────
  function orderedViolations() {
    const vs = D().ex.violations, out = [];
    for (const r of Score.HARD_RULES) for (const v of vs) if (v.code === r.code) out.push(v);
    return out;
  }
  function curViolIndex(list) {
    const u = S.ui;
    if (!u.sel || !u.sel.startsWith('v:')) return -1;
    const sig = u.sel.slice(2);
    return list.findIndex((v) => S.vsig(v) === sig);
  }
  function shortMsg(v) {
    // 날짜 접두를 떼고 원인만 남긴다(날짜는 따로 표시)
    return S.plain(String(v.message)).replace(/^\d+\/\d+\([^)]+\) \d연전\s*(—\s*)?/, '');
  }
  /** 월 탭: 연전 기간이 있는 달만(2027은 3~9월). 연전 기간이 없으면 지금 달 하나 */
  function months() {
    const ms = Array.from(new Set(D().slots.map((s) => s.month))).sort((a, b) => a - b);
    return ms.length ? ms : [S.ui.month || 4];
  }
  function monthViolations(mo) {
    const c = D();
    return c.ex.violations.filter((v) => c.slots[v.slot] && c.slots[v.slot].month === mo).length;
  }
  /** 옮기는 중인 경기를 slot에 놓을 수 있나(연전 수가 같고 지금 자리가 아님). target을 주면 그 경기와 맞바꾸기(고정이면 불가) */
  function canDrop(mv, slot, target) {
    const c = D(), st = app().state, mt = st.matches[mv];
    if (!mt || !c.slots[slot] || c.plan[mv] === slot || c.slots[slot].consecutive !== mt.consecutive) return false;
    if (target != null && (st.matches[target].pinned || target === mv)) return false;
    const E = EX();
    if (E && !E.canDrop(mv, slot, target)) return false;
    return true;
  }

  // ───────── 위반 띠 ─────────
  function renderVBand() {
    const c = D(), u = S.ui, list = orderedViolations(), n = list.length;
    if (!n) {
      return '<div class="vband ok"><span class="vb-ok">' + icon('check') + '<b>' + esc(S.termPlain('hardViol')) + ' 없음</b><span class="muted">· 편성 가능</span></span>' +
        (c.pool.length ? '<span class="vb-note">' + icon('pool') + '일정 미정 ' + c.pool.length + '경기 — 도구줄의 「보관함」에서 넣을 자리를 고릅니다</span>' : '') + '</div>';
    }
    const i = curViolIndex(list), v = i >= 0 ? list[i] : null;
    return '<div class="vband"><span class="vb-count">' + S.stat('block', n + '건') + '<b>' + esc(S.term('hardViol')) + '</b></span>' +
      '<span class="vb-nav"><button class="btn sm icon" data-act="viol-prev" title="이전 위반" aria-label="이전 위반">' + icon('left') + '</button><span class="vb-pos">' + (i >= 0 ? i + 1 : '–') + ' / ' + n + '</span><button class="btn sm icon" data-act="viol-next" title="다음 위반" aria-label="다음 위반">' + icon('right') + '</button></span>' +
      (v
        ? '<span class="vb-msg" title="' + esc(shortMsg(v)) + '"><span class="vb-rule">' + S.ruleLabel(v.code) + '</span><span class="vb-text">' + esc(shortMsg(v)) + '</span><span class="vb-loc">' + icon('cal') + esc(fmt.date(c.slots[v.slot].day)) + '</span>' + (S.isVirtual(v) ? S.virt() : '') + '</span>'
        : '<span class="vb-msg muted">‹ ›로 위반을 하나씩 봅니다. 달력이 그 자리로 갑니다.</span>') +
      (EX() ? '' : '<button class="btn sm' + (u.pop === 'fix' ? ' on' : ' primary') + '" data-act="viol-fix">' + icon('bolt') + '고치는 방법</button>') +
      '<button class="btn sm' + (u.menu === 'viols' ? ' on' : '') + '" data-act="viol-menu" aria-haspopup="menu">' + icon('list') + '목록' + icon('down') + '</button></div>';
  }

  // ───────── 도구줄 ─────────
  function renderToolbar() {
    const c = D(), u = S.ui, tf = u.teamFilter;
    const views = S.r3Views();
    let s = '<div class="toolbar r3-tools"><div class="seg" role="tablist">' + views.map((v) => '<button class="' + (u.view === v[0] ? 'on' : '') + '" data-act="r-view" data-view="' + v[0] + '" role="tab" aria-selected="' + (u.view === v[0]) + '">' + icon(v[2]) + v[1] + '</button>').join('') + '</div>';
    if (u.view === 'calendar') s += '<div class="month-tabs">' + months().map((mo) => { const n = monthViolations(mo); return '<button class="' + (u.month === mo ? 'on' : '') + '" data-act="r-month" data-month="' + mo + '">' + mo + '월' + (n ? '<span class="mv">' + icon('x') + n + '</span>' : '') + '</button>'; }).join('') + '</div>';
    s += '<button class="btn sm' + (tf.length ? ' on' : '') + (u.menu === 'teams' ? ' on' : '') + '" data-act="teams-menu" aria-haspopup="menu" title="구단을 고르면 그 구단 경기만 진하게 보입니다">' + icon('team') + (tf.length ? esc(tf.length > 2 ? '구단 ' + tf.length : tf.join('·')) : '구단') + icon('down') + '</button>';
    if (S.feature('M8') && c.pool.length) s += '<button class="btn sm' + (u.menu === 'pool' ? ' on' : '') + '" data-act="pool-menu" aria-haspopup="menu" title="일정 미정 경기 — 누르면 넣을 자리를 고릅니다">' + icon('pool') + '보관함 ' + c.pool.length + icon('down') + '</button>';
    s += renderLegend();
    s += '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' + S.undoButtons() +
      '<button class="btn sm" data-act="snap-menu" aria-haspopup="menu">' + icon('bookmark') + '중간 저장 ' + app().state.snapshots.length + icon('down') + '</button></span></div>';
    if (u.moving != null) s += renderMoveBand();
    return s;
  }
  /** 범례는 지금 화면에 있는 것만 */
  function renderLegend() {
    const c = D(), u = S.ui, items = [];
    const anyViol = c.ex.violations.length > 0, anyPin = app().state.matches.some((m) => m.pinned);
    if (u.view === 'calendar') {
      if (u.teamFilter.length) items.push('<span><span class="fm h">홈</span>홈 경기</span><span><span class="fm a">원</span>원정 경기</span>');
      if (anyViol) items.push('<span><i class="lg-viol"></i>위반</span>');
      if (EX()) items.push(EX().legend());
      else if (anyPin) items.push('<span>' + icon('pin') + '고정</span>');
    } else if (u.view === 'flow') {
      items.push('<span><i class="lg-home"></i>홈 연전</span><span><i class="lg-fa"></i>원정 연전</span><span><i class="lg-fg' + (FLOW_GRAPH === 'over' ? ' over' : '') + '"></i>' + (FLOW_GRAPH === 'cum' ? '쌓인 이동 거리' : '옮긴 거리') + '</span>');
      if (anyViol) items.push('<span><i class="lg-mviol"></i>위반</span>');
      if (c.ex.teamMetrics.some((t) => t.runs.some((r) => r.length > 3))) items.push('<span><i class="lg-frun"></i>4연속 이상</span>');
      if (anyPin) items.push('<span>' + icon('pin') + '고정</span>');
    } else if (u.view === 'pairs') {
      items.push('<span><i class="lg-pbad"></i>정해진 수와 다른 칸</span>');
    } else {
      items.push('<span><i class="lg-home"></i>홈</span><span><i class="lg-away"></i>원정</span>');
      if (anyViol) items.push('<span><i class="lg-mviol"></i>위반</span>');
      if (c.ex.teamMetrics.some((t) => t.runs.some((r) => r.length > 3))) items.push('<span><i class="lg-run"></i>홈·원정 4연속 이상</span>');
      if (anyPin) items.push('<span>' + icon('pin') + '고정</span>');
    }
    return items.length ? '<span class="legend r3-legend">' + items.join('') + '</span>' : '';
  }
  function renderMoveBand() {
    const u = S.ui, c = D(), mt = app().state.matches[u.moving];
    if (!mt) return '';
    const s0 = c.plan[u.moving];
    return '<div class="moveband"><span class="mb-title">' + icon('move') + '<b>옮기는 중</b>' + S.team(mt.away) + '<span class="muted">vs</span>' + S.team(mt.home) + (s0 >= 0 ? '<span class="muted">· 지금 ' + esc(c.slots[s0].label) + '</span>' : '<span class="muted">· 일정 미정</span>') + '</span>' +
      '<span class="mb-hint">' + (u.view === 'calendar' ? '놓을 수 있는 연전 기간에 「여기로」가 켜집니다. 그 기간의 경기를 누르면 둘을 맞바꿉니다.' : u.view === 'flow' ? '점선 테두리 막대를 누르면 그 연전과 맞바꿉니다.' : '점선 칸을 누르면 그 자리의 경기와 맞바꿉니다.') + ' 월을 넘겨도 유지됩니다 · Esc 취소</span>' +
      '<button class="btn sm" data-act="move-cancel">' + icon('x') + '취소</button></div>';
  }

  // ───────── 달력 ─────────
  function chip(m, slot) {
    const st = app().state, c = D(), u = S.ui;
    const mt = st.matches[m];
    const flags = c.ex.matchFlags[m] || [];
    const f = u.teamFilter;
    const involved = !f.length || f.includes(mt.home) || f.includes(mt.away);
    let fm = '';
    if (f.length && involved) {
      const homeSide = f.includes(mt.home);
      fm = homeSide ? '<span class="fm h" title="홈">홈</span>' : '<span class="fm a" title="원정">원</span>';
    }
    const sel = u.sel === 'm:' + m;
    const vsel = S._selViol && (S._selViol.matches || []).includes(m);
    const flash = u.flashMatches && u.flashMatches.includes(m);
    let cls = 'gm' + (flags.length ? ' viol' : '') + (sel ? ' sel' : '') + (vsel ? ' vsel' : '') + (!involved ? ' dim' : '') + (f.length && involved ? ' focus-team' : '') + (flash ? ' flash' : '');
    const stad = (app().team(mt.home) || {}).stadium || '';
    let title = app().matchLabel(m) + ' · ' + stad + (flags.length ? ' · 위반 ' + flags.map(S.ruleName).join(', ') : '') + (mt.pinned ? ' · 고정' : '');
    let act = 'sel-match', extra = '';
    const mv = u.moving;
    if (mv != null) {
      if (mv === m) { cls += ' moving'; act = 'move-cancel'; title = '옮기는 중 · 누르면 취소'; }
      else if (slot >= 0 && canDrop(mv, slot, m)) { cls += ' swap-ok'; act = 'move-swap'; extra = ' data-slot="' + slot + '"'; title = app().matchLabel(m) + ' · 누르면 맞바꾸기 · ' + deltaWord(app().previewDrop(mv, slot, m).hardDelta); }
      else { cls += ' off'; act = ''; }
    }
    return '<button class="' + cls + '"' + (act ? ' data-act="' + act + '"' : ' disabled') + ' data-m="' + m + '"' + extra + ' title="' + esc(title) + '">' +
      fm + (EX() ? EX().chipMark(m) : mt.pinned ? '<span class="pin-ico">' + icon('pin') + '</span>' : '') +
      '<span class="tm"><i style="background:' + esc(S.teamColor(mt.away)) + '"></i>' + esc(mt.away) + '</span><span class="at">vs</span>' +
      '<span class="tm"><i style="background:' + esc(S.teamColor(mt.home)) + '"></i>' + esc(mt.home) + '</span>' +
      (S.wide ? '<span class="stad">· ' + esc(stad.replace(/(야구장|경기장|종합운동장|구장|라이언즈파크|챔피언스필드|이글스파크|NC파크|KT위즈파크|돔야구장)$/, '')) + '</span>' : '') +
      (flags.length ? '<span class="st-ico">' + icon('warn') + esc(flags.map(S.ruleShort).join(' ')) + '</span>' : '') + '</button>';
  }

  function renderCalendar() {
    const c = D(), st = app().state, u = S.ui;
    const month = u.month || 4;
    const y = S.seasonYear();
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
    const vslot = S._selViol ? S._selViol.slot : -1;
    const mv = u.moving, fromSlot = mv != null ? c.plan[mv] : -2, E = EX();
    let s = '<div class="cal-wrap"><div class="cal-head"><div></div>' + ['월', '화', '수', '목', '금', '토', '일'].map((d, i) => '<div class="' + (i === 6 ? 'sun' : i === 0 ? 'mon' : '') + '">' + d + '</div>').join('') + '</div>';
    s += '<div class="cal-grid" style="grid-template-rows:repeat(' + weeks.length + ',minmax(0,1fr))">';
    for (const w of weeks) {
      s += '<div class="cal-week"><div class="cal-wk">' + weekNo(w) + '주차</div>';
      const slotsHere = c.slots.filter((sl) => sl.days.some((d) => d >= w && d <= w + 6));
      for (let i = 0; i < 7; i++) {
        const d = w + i;
        const out = d < first || d > last;
        const hn = hol.get(d);
        const sl = slotsHere.find((x) => x.days[0] === d);
        let extra = '';
        if (sl) {
          const hard = c.ex.slotHard[sl.index];
          extra = ' <span class="muted">· ' + sl.consecutive + '연전' + (!hard ? (sl.weekend ? ' 주말' : ' 주중') : '') + '</span>' + (hard ? ' <span style="color:var(--bad);font-weight:700">' + icon('x') + slotCodes(sl.index) + '</span>' : '') + (E ? E.slotTag(sl.index) : '');
        }
        s += '<div class="cal-day' + (out ? ' out' : '') + (i === 6 ? ' sun' : '') + (hn ? ' hol' : '') + (d === ref ? ' today' : '') + '" style="grid-column:' + (i + 2) + '">' + Dates.fmtShort(d).split('/')[1] + (hn ? '<span class="hn">' + esc(hn) + '</span>' : '') + extra + '</div>';
        const inSlot = c.dayToSlot.has(d);
        if (!inSlot) s += '<div class="cal-fill' + (black.has(d) ? ' black' : out ? ' out' : ' rest') + '" style="grid-column:' + (i + 2) + '" title="' + (black.has(d) ? '휴식기' : out ? '' : '휴식일') + '"></div>';
      }
      for (const sl of slotsHere) {
        const ds = sl.days.filter((d) => d >= w && d <= w + 6);
        const col = wd(ds[0]) + 2;
        const hard = c.ex.slotHard[sl.index] > 0;
        const outMonth = ds.every((d) => d < first || d > last);
        let drop = '';
        if (mv != null && sl.index === fromSlot) drop = '<div class="sb-from">' + icon('move') + '지금 자리</div>';
        else if (mv != null && canDrop(mv, sl.index)) { const h = app().previewDrop(mv, sl.index).hardDelta; drop = '<button class="sb-drop ' + (h > 0 ? 'good' : h < 0 ? 'bad' : 'zero') + '" data-act="move-here" data-slot="' + sl.index + '" title="이 연전 기간으로 옮기기">' + icon('move') + '여기로 · ' + esc(deltaWord(h)) + '</button>'; }
        else if (mv != null && E) drop = E.dropNote(sl.index);
        s += '<div class="slotband' + (hard ? ' hard' : '') + (sl.index === vslot ? ' vsel' : '') + (E ? E.slotCls(sl.index) : '') + (mv != null && sl.index === fromSlot ? ' from' : '') + (drop && sl.index !== fromSlot ? ' can' : '') + '" style="grid-column:' + col + ' / span ' + ds.length + (outMonth ? ';opacity:.5' : '') + '" data-slot="' + sl.index + '" title="' + esc(sl.label) + '">' + drop +
          '<div class="sb-list" style="grid-template-rows:repeat(' + Math.max(5, c.bySlot[sl.index].length) + ',minmax(0,1fr))">' + c.bySlot[sl.index].map((m) => chip(m, sl.index)).join('') + '</div></div>';
      }
      s += '</div>';
    }
    s += '</div></div>';
    return s;
  }
  function slotCodes(s) {
    const set = new Set(D().ex.violations.filter((v) => v.slot === s && v.code !== 'H0-f' && v.code !== 'H1').map((v) => v.code));
    return Array.from(set).map(S.ruleShort).join(' ') || '';
  }
  function weekNo(d) {
    const st = D().slots.length ? D().slots[0].day : d;
    const s0 = st - ((Dates.weekday(st) + 6) % 7);
    return Math.floor((d - s0) / 7) + 1;
  }

  // ───────── 구단별 연전 표 (라) ─────────
  /** 세로 10구단 × 가로 연전 기간 전체(가로 스크롤). 옅은 칸 = 홈, 진한 칸 = 원정, 위반 칸 빨간 테두리, 홈·원정 4연속 이상 구간은 빨간 묶음 테두리 */
  function renderMatrix() {
    const c = D(), st = app().state, u = S.ui, tf = u.teamFilter;
    const mv = u.moving, mvm = mv != null ? st.matches[mv] : null;
    const vslot = S._selViol ? S._selViol.slot : -1;
    const vms = S._selViol ? (S._selViol.matches || []) : [];
    const over = new Map(); // 구단 → (연전 기간 → 묶음 안 위치)
    for (const tm of c.ex.teamMetrics) {
      const mp = new Map();
      for (const r of tm.runs) if (r.length > 3) r.slots.forEach((sx, i) => mp.set(sx, i === 0 ? 'rs' : i === r.slots.length - 1 ? 're' : 'rm'));
      over.set(tm.name, mp);
    }
    const byMonth = [];
    for (const sl of c.slots) { const last = byMonth[byMonth.length - 1]; if (last && last.month === sl.month) last.n++; else byMonth.push({ month: sl.month, n: 1 }); }
    if (!c.slots.length) return '<div class="mx-wrap"><div class="empty"><b>연전 기간이 없습니다</b>연전 기간을 입력하면 구단별 연전 표가 여기에 나옵니다.</div></div>';
    let s = '<div class="mx-wrap xy" data-sk="r-mx"><table class="mx"><thead><tr><th class="mx-team mx-corner" rowspan="2">구단</th>' + byMonth.map((g) => '<th class="mx-mo" colspan="' + g.n + '">' + g.month + '월</th>').join('') + '</tr><tr>' +
      c.slots.map((sl) => '<th class="mx-col' + (c.ex.slotHard[sl.index] ? ' hard' : '') + (sl.index === vslot ? ' vsel' : '') + (sl.weekend ? ' we' : '') + '" data-slot="' + sl.index + '" title="' + esc(sl.label + (sl.weekend ? ' · 주말' : ' · 주중')) + '"><span class="d">' + esc(Dates.fmtShort(sl.day)) + '</span><span class="n">' + sl.consecutive + '연전</span></th>').join('') + '</tr></thead><tbody>';
    for (const t of st.teams) {
      const focus = tf.includes(t.name), dim = tf.length && !focus;
      const mp = over.get(t.name) || new Map();
      s += '<tr class="' + (focus ? 'focus' : dim ? 'dim' : '') + '"><th class="mx-team">' + S.team(t.name) + '</th>';
      for (const sl of c.slots) {
        const m = c.bySlot[sl.index].find((i) => st.matches[i].home === t.name || st.matches[i].away === t.name);
        if (m == null) {
          const can = mv != null && (mvm.home === t.name || mvm.away === t.name) && canDrop(mv, sl.index);
          s += '<td class="mx-c rest' + (can ? ' swap-ok' : '') + '"' + (can ? ' data-act="move-here" data-slot="' + sl.index + '" title="이 연전 기간으로 옮기기 · ' + esc(deltaWord(app().previewDrop(mv, sl.index).hardDelta)) + '"' : ' title="경기 없음"') + '>·</td>';
          continue;
        }
        const mt = st.matches[m];
        const home = mt.home === t.name;
        const flags = c.ex.matchFlags[m] || [];
        const run = mp.get(sl.index);
        const flash = u.flashMatches && u.flashMatches.includes(m);
        let cls = 'mx-c ' + (home ? 'h' : 'a') + (flags.length ? ' viol' : '') + (u.sel === 'm:' + m ? ' sel' : '') + (vms.includes(m) ? ' vsel' : '') + (run ? ' ' + run : '') + (mt.pinned ? ' pinned' : '') + (flash ? ' flash' : '');
        let title = app().matchLabel(m) + ' · ' + sl.label + (flags.length ? ' · 위반 ' + flags.map(S.ruleName).join(', ') : '') + (mt.pinned ? ' · 고정' : '');
        let act = 'sel-match';
        if (mv != null) {
          if (mv === m) { cls += ' moving'; act = 'move-cancel'; title = '옮기는 중 · 누르면 취소'; }
          else if ((mvm.home === t.name || mvm.away === t.name) && canDrop(mv, sl.index, m)) { cls += ' swap-ok'; act = 'move-swap'; title = app().matchLabel(m) + ' · 누르면 맞바꾸기 · ' + deltaWord(app().previewDrop(mv, sl.index, m).hardDelta); }
          else { cls += ' off'; act = ''; }
        }
        s += '<td class="' + cls + '"' + (act ? ' data-act="' + act + '"' : '') + ' data-m="' + m + '" data-slot="' + sl.index + '" title="' + esc(title) + '">' + (mt.pinned ? icon('pin') : '') + esc(home ? mt.away : mt.home) + '</td>';
      }
      s += '</tr>';
    }
    return s + '</tbody></table></div>';
  }

  // ───────── 홈/원정 흐름 띠 · 상대별 경기 수 (2027 흐름의 보기 — 「구단별 보기」에서 옮겨 옴, 2026-11-06) ─────────
  /** 이동 거리 그래프에 쓰는 거리(km). 가장 먼 두 구장이 그래프 맨 위 */
  function flowKm(st) {
    const m = new Map(); let max = 0, pair = '';
    for (const d of st.distanceMatrix || []) { const v = +d.distance || 0; m.set(d.from + '|' + d.to, v); if (v > max) { max = v; pair = d.from + '↔' + d.to; } }
    return { get: (a, b) => m.get(a + '|' + b) || 0, max, pair };
  }
  /** 이동 거리 그래프 모양: 'leg' = 줄 위쪽에 연전마다 옮긴 거리, 'over' = 막대 위에 겹친 선, 'cum' = 줄 위쪽에 쌓인 거리 */
  const FLOW_GRAPH = 'leg';
  /** 구단마다 한 줄 띠. 홈 연전 = 낮고 옅은 막대, 원정 = 높고 진한 막대, 달 경계선, 4연속 이상 = 빨간 밑줄. 높이는 창에 맞춘다(CSS)
   *  구단별 연전 표가 보여 주던 것(상대·날짜·위반·고정·고른 경기·옮기는 중 맞바꾸기)은 막대의 말풍선·테두리에 담았다. 막대를 누르면 경기 창.
   *  구단 이름을 누르면 그 구단만 진하게(달력의 구단 고르기와 같은 teamFilter) */
  function renderFlow() {
    const c = D(), st = app().state, u = S.ui, tf = u.teamFilter, slots = c.slots, T = c.ex.teamMetrics;
    if (!slots.length) return '<div class="mx-wrap"><div class="empty"><b>연전 기간이 없습니다</b>연전 기간을 입력하면 홈/원정 흐름이 여기에 나옵니다.</div></div>';
    const mv = u.moving, mvm = mv != null ? st.matches[mv] : null;
    const vms = S._selViol ? (S._selViol.matches || []) : [];
    const day0 = slots[0].day, dayN = slots[slots.length - 1].day + slots[slots.length - 1].consecutive, span = dayN - day0;
    const pct = (d) => ((d - day0) / span * 100).toFixed(2) + '%';
    const months = []; const seen = new Set();
    for (let d = day0; d < dayN; d++) { const m = Dates.month(d); if (!seen.has(m)) { seen.add(m); months.push({ d, m }); } }
    const over = T.filter((t) => t.maxHomeRun > 3 || t.maxAwayRun > 3).length;
    const km = flowKm(st), G = FLOW_GRAPH;
    const cumMax = Math.max(1, ...T.map((t) => t.distanceKm || 0));
    const gTop = G === 'cum' ? cumMax : km.max || 1; // 그래프 맨 위가 뜻하는 km
    let s = '<div class="tv-flow r3-flow g-' + G + (tf.length ? ' has-sel' : '') + '" data-sk="r-flow">';
    s += '<div class="tv-flow-head"><span class="tv-flow-name"></span><span class="tv-flow-track">' + months.map((o, i) => { const next = i + 1 < months.length ? months[i + 1].d : dayN; return '<i style="left:' + pct(o.d) + '"></i>' + (next - o.d >= 8 ? '<b style="left:' + pct(o.d) + '">' + o.m + '월</b>' : ''); }).join('') + '</span><span class="tv-flow-right">' + (G === 'cum' ? '총 이동 · 최장 연속' : '최장 연속') + '</span></div>';
    for (const t of T) {
      const focus = tf.includes(t.name), dim = tf.length && !focus;
      let row = '<div class="tv-flow-row' + (focus ? ' sel' : dim ? ' dim' : '') + '"><button class="tv-flow-name" data-act="tf" data-team="' + esc(t.name) + '" aria-pressed="' + focus + '" title="' + esc(t.name + (focus ? ' 강조 풀기' : '만 진하게 보기')) + '">' + S.team(t.name) + '</button><span class="tv-flow-track">' + months.map((o) => '<i style="left:' + pct(o.d) + '"></i>').join('');
      const pts = [];
      for (const [k, v] of t.visits.entries()) {
        const sl = slots[v.slot], a = sl.day, b = sl.day + sl.consecutive, m = v.match, mt = st.matches[m];
        // 이 연전을 하러 오기까지 옮긴 거리. 시즌 첫 연전은 홈 구장에서 출발
        const leg = k > 0 ? v.legTenths / 10 : v.home ? 0 : km.get(t.name, st.teams[v.loc].name);
        const legWord = v.afterBreak ? '휴식기 뒤라 이동 세지 않음' : leg ? (k > 0 ? (v.home ? '집으로 ' : '앞 구장에서 ') : '홈 구장에서 ') + Math.round(leg) + 'km 이동' : '이동 없음';
        pts.push({ x: (a + b) / 2, v: G === 'cum' ? v.cumTenths / 10 : leg, tip: Dates.fmtDate(a) + ' ' + (v.home ? '홈' : '원정') + ' · ' + (G === 'cum' ? '여기까지 ' + Math.round(v.cumTenths / 10).toLocaleString() + 'km' : legWord) });
        const flags = c.ex.matchFlags[m] || [];
        const flash = u.flashMatches && u.flashMatches.includes(m);
        let cls = 'tv-flow-blk ' + (v.home ? 'h' : 'a') + (flags.length ? ' viol' : '') + (u.sel === 'm:' + m ? ' sel' : '') + (vms.includes(m) ? ' vsel' : '') + (mt.pinned ? ' pinned' : '') + (flash ? ' flash' : '');
        let title = Dates.fmtDate(a) + '~' + Dates.fmtDate(b - 1) + ' ' + (v.home ? '홈' : '원정') + ' vs ' + st.teams[v.opp].name + ' ' + sl.consecutive + '연전 · ' + legWord + (flags.length ? ' · 위반 ' + flags.map(S.ruleName).join(', ') : '') + (mt.pinned ? ' · 고정' : '');
        let act = 'sel-match';
        if (mv != null) {
          if (mv === m) { cls += ' moving'; act = 'move-cancel'; title = '옮기는 중 · 누르면 취소'; }
          else if ((mvm.home === t.name || mvm.away === t.name) && canDrop(mv, sl.index, m)) { cls += ' swap-ok'; act = 'move-swap'; title = app().matchLabel(m) + ' · 누르면 맞바꾸기 · ' + deltaWord(app().previewDrop(mv, sl.index, m).hardDelta); }
          else { cls += ' off'; act = ''; }
        }
        row += '<button class="' + cls + '"' + (act ? ' data-act="' + act + '"' : ' disabled') + ' data-m="' + m + '" data-slot="' + sl.index + '" style="left:' + pct(a) + ';width:calc(' + pct(b) + ' - ' + pct(a) + ' - 1px)" title="' + esc(title) + '"' + (sl.consecutive >= 3 ? '><span class="opp">' + esc(st.teams[v.opp].name) + '</span></button>' : '></button>');
      }
      for (const r of t.runs) if (r.length > 3) { const a = slots[r.slots[0]].day, last = slots[r.slots[r.slots.length - 1]], b = last.day + last.consecutive;
        row += '<span class="tv-flow-run" style="left:' + pct(a) + ';width:calc(' + pct(b) + ' - ' + pct(a) + ' - 1px)" title="' + esc((r.home ? '홈 ' : '원정 ') + r.length + '연속') + '"></span>'; }
      row += flowGraph(pts, gTop, (d) => (d - day0) / span * 100, G);
      row += '</span><span class="tv-flow-right">' + (G === 'cum' ? '<b class="tv-flow-km">' + Math.round(t.distanceKm || 0).toLocaleString() + 'km</b>' : '') + '<span class="tv-flow-runs"><span class="' + (t.maxHomeRun > 3 ? 'bad' : '') + '">홈 ' + t.maxHomeRun + '</span> · <span class="' + (t.maxAwayRun > 3 ? 'bad' : '') + '">원정 ' + t.maxAwayRun + '</span></span></span></div>';
      s += row;
    }
    s += '<div class="tv-flow-foot xs muted">' + (over ? '홈이나 원정이 4연속을 넘는 구단 ' + over + '개' : '4연속을 넘는 구단 없음') + ' · ' + (G === 'cum' ? '선은 시즌 동안 쌓인 이동 거리(맨 위 ' + Math.round(cumMax).toLocaleString() + 'km)' : '선은 연전마다 옮긴 거리(맨 위 ' + Math.round(km.max) + 'km, ' + esc(km.pair) + ')') + ' · 막대에 마우스를 올리면 상대와 날짜, 누르면 경기 창 · 구단 이름을 누르면 그 구단만 진하게</div></div>';
    return s;
  }
  /** 구단 한 줄의 이동 거리 선. 가로는 날짜(막대와 같은 자리), 세로는 0 ~ top km. 점에 마우스를 올리면 거리 */
  function flowGraph(pts, top, X, G) {
    if (!pts.length) return '';
    const P = pts.map((p) => ({ x: X(p.x), y: 100 - Math.min(1, p.v / top) * 100, tip: p.tip, v: p.v }));
    const line = P.map((p) => p.x.toFixed(2) + ',' + p.y.toFixed(1)).join(' ');
    let g = '<span class="tv-flow-g" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none">';
    if (G !== 'over') g += '<polygon points="' + P[0].x.toFixed(2) + ',100 ' + line + ' ' + P[P.length - 1].x.toFixed(2) + ',100"/>';
    else g += '<polyline class="halo" points="' + line + '"/>';
    g += '<polyline points="' + line + '"/></svg>';
    if (G !== 'over') g += P.filter((p) => p.v > 0).map((p) => '<i style="left:' + p.x.toFixed(2) + '%;top:' + p.y.toFixed(1) + '%" title="' + esc(p.tip) + '"></i>').join('');
    return g + '</span>';
  }
  /** 상대별 경기 수: 맨 위에 판정 한 줄, 칸은 어긋난 곳만 색. 칸 크기는 창 높이에 맞춘다(CSS) */
  function renderPairs() {
    const st = app().state, names = st.teams.map((t) => t.name), N = names.length;
    const total = st.settings.initialGamesPerPair, major = st.settings.homeGamesMajor, minor = total - major;
    const g = (h, a) => st.matches.filter((m) => m.home === h && m.away === a).reduce((x, m) => x + m.consecutive, 0);
    const bad = []; // 맞대결 단위로 어긋난 것
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const x = g(names[i], names[j]), y = g(names[j], names[i]); const ok = x + y === total && Math.max(x, y) === major && Math.min(x, y) === minor; if (!ok) bad.push({ a: names[i], b: names[j], x, y }); }
    const badCell = new Set(bad.flatMap((p) => [p.a + '|' + p.b, p.b + '|' + p.a]));
    let s = '<div class="r3-pairs" data-sk="r-pairs">';
    s += bad.length
      ? '<div class="tv-verdict bad">' + icon('warn') + ' 고르지 않은 맞대결 ' + bad.length + '개 — ' + esc(bad.slice(0, 4).map((p) => p.a + '–' + p.b + ' ' + (p.x + p.y) + '경기(' + p.x + '·' + p.y + ')').join(' · ')) + (bad.length > 4 ? ' …' : '') + '</div>'
      : '<div class="tv-verdict ok">' + icon('check') + ' 모든 맞대결이 ' + total + '경기(홈 ' + major + ' · 원정 ' + minor + ')로 고릅니다</div>';
    s += '<div class="xs muted" style="margin-bottom:8px">가로줄이 홈 구단, 세로줄이 원정 구단. 칸은 그 홈에서 치르는 경기 수입니다.</div>';
    s += '<div class="tv-pairs" style="--n:' + (N + 1) + '"><div class="tv-pc corner"><span>홈 ↓ · 원정 →</span></div>' + names.map((n) => '<div class="tv-pc hd">' + S.team(n) + '</div>').join('');
    for (const h of names) { s += '<div class="tv-pc hd">' + S.team(h) + '</div>'; for (const a of names) { if (h === a) { s += '<div class="tv-pc diag"></div>'; continue; } const v = g(h, a); s += '<div class="tv-pc' + (badCell.has(h + '|' + a) ? ' bad' : '') + '" title="' + esc(h + ' 홈에서 ' + a + '와 ' + v + '경기') + '">' + v + '</div>'; } }
    s += '</div></div>';
    return s;
  }

  // ───────── 경기 창 · 고치는 방법 창 ─────────
  function teamStrip(name, hiSlot) {
    const c = D();
    const tm = c.ex.teamMetrics.find((x) => x.name === name);
    if (!tm) return '';
    const bySlot = new Map(tm.visits.map((v) => [v.slot, v]));
    const overSlots = new Set();
    for (const r of tm.runs) if (r.length > 3) r.slots.slice(3).forEach((x) => overSlots.add(x));
    let s = '<div class="mini-strip" style="grid-template-columns:repeat(' + c.slots.length + ',minmax(0,1fr))" title="' + esc(name) + ' 연전 기간별 홈(옅은 칸)/원정(진한 칸)">';
    for (const sl of c.slots) {
      const v = bySlot.get(sl.index);
      s += '<i class="' + (v && v.home ? 'h' : '') + (overSlots.has(sl.index) ? ' over' : '') + '" style="' + (sl.index === hiSlot ? 'outline:2px solid #1F5FD6;outline-offset:0;' : '') + (v ? '' : 'background:#fff;') + '"></i>';
    }
    return s + '</div>';
  }
  function popHead(title, tags) {
    return '<div class="pop-head"><span class="pop-title">' + title + '</span>' + (tags || '') + '<button class="btn sm icon ghost" data-act="pop-close" aria-label="닫기" title="닫기 (Esc)">' + icon('x') + '</button></div>';
  }
  function popMatch(m) {
    const c = D(), st = app().state, u = S.ui;
    const mt = st.matches[m];
    if (!mt) return '';
    const s0 = c.plan[m];
    const sl = s0 >= 0 ? c.slots[s0] : null;
    const team = app().team(mt.home) || {};
    const vs = c.ex.violations.filter((v) => (v.matches || []).includes(m));
    const ev = mt.eventId ? st.events.find((e) => e.id === mt.eventId) : null;
    let s = '<div class="pop pop-m" role="dialog" aria-label="경기 자세히" data-anchor-m="' + m + '">' +
      popHead(S.team(mt.away) + '<span class="muted">vs</span>' + S.team(mt.home), mt.pinned ? '<span class="tag pin">' + icon('pin') + '고정</span>' : '') +
      '<div class="pop-sub">' + (sl ? esc(fmt.date(sl.day) + ' ~ ' + fmt.date(sl.days[sl.days.length - 1])) : '일정 미정') + ' · ' + mt.consecutive + '연전 · ' + esc(team.stadium || '-') + (S.dev() ? ' · 경기 #' + (m + 1) : '') + '</div>';
    s += '<dl class="props pop-props">' +
      '<dt>홈</dt><dd>' + S.team(mt.home) + '<span class="home-mark">홈</span>' + (mt.home === '두산' || mt.home === 'LG' ? '<span class="tag shared">같이 쓰는 구장</span>' : '') + '</dd>' +
      '<dt>원정</dt><dd>' + S.team(mt.away) + '<span class="away-mark">원</span></dd>' +
      (sl ? '<dt>연전 기간</dt><dd>' + esc(sl.label) + (sl.weekend ? ' <span class="tag ref">주말</span>' : ' <span class="tag ref">주중</span>') + (sl.holiday ? ' <span class="tag ref">휴일 등급 ' + sl.holiday + '</span>' : '') + '</dd>' : '') +
      (ev ? '<dt>특별 경기</dt><dd>' + esc(ev.name) + ' <span class="tag pin">대진 지정</span></dd>' : '') +
      '<dt>위반</dt><dd>' + (vs.length ? vs.map((v) => '<button class="btn xs" style="color:var(--bad)" data-act="sel-viol" data-sig="' + esc(S.vsig(v)) + '" title="이 위반으로">' + icon('x') + esc(S.dev() ? v.code : S.ruleName(v.code)) + '</button>').join('') : S.stat('ok', '없음')) + '</dd>' +
      '</dl>';
    if (EX()) s += EX().popActs(m);
    else s += '<div class="pop-acts"><label class="pop-pin"><span class="switch"><input type="checkbox" data-in="pin" data-m="' + m + '"' + (mt.pinned ? ' checked' : '') + '><i></i></span>고정<span class="muted small">자동 편성이 옮기지 않음</span></label>' +
      (S.feature('M8') && s0 >= 0 ? '<button class="btn sm" data-act="to-pool" data-m="' + m + '"' + (mt.pinned ? ' disabled' : '') + '>' + icon('pool') + '보관함으로 빼기</button>' : '') + '</div>';
    if (EX()) { /* 결과 고치기: 옮기기·손으로 놓은 것 풀기는 popActs가 그린다(추천·홈/원정 뒤집기·고정 스위치 없음) */ }
    else if (s0 < 0) {
      const opts = c.slots.filter((x) => x.consecutive === mt.consecutive).map((x) => { const p = app().previewDrop(m, x.index); return { x, p }; }).sort((a, b) => b.p.hardDelta - a.p.hardDelta).slice(0, 5);
      s += '<div class="pop-sec"><h4>넣을 연전 기간</h4><div class="cands">' + opts.map((o) => '<div class="cand"><span class="what"><span class="kind">이 기간에 넣기</span>' + esc(o.x.label) + '</span>' + (S.feature('M2') ? S.deltaHtml(o.p.hardDelta, null) : '') + '<button class="btn sm go" data-act="from-pool" data-m="' + m + '" data-slot="' + o.x.index + '">넣기</button></div>').join('') + '</div></div>';
    } else {
      const cands = S.candidates([m], [], 3).filter((x) => x.kind === 'swap' || x.kind === 'flip');
      s += '<div class="pop-sec"><h4>옮길 곳 추천' + (S.feature('M2') ? '<span class="r">' + (S.dev() ? 'Δ 미리보기' : '적용하면 이렇게 달라집니다') + '</span>' : '') + '</h4>' + (mt.pinned ? '<div class="small muted">고정된 경기는 옮길 수 없습니다. 고정을 풀면 옮길 곳이 나옵니다.</div>' : candList(cands)) + '</div>';
      if (!mt.pinned) s += '<div class="pop-row"><button class="btn sm primary" data-act="move-start" data-m="' + m + '">' + icon('move') + '옮기기…</button><span class="muted small">' + (u.view === 'calendar' ? '달력에서 놓을 자리를 직접 고릅니다' : u.view === 'flow' ? '띠에서 맞바꿀 막대를 직접 고릅니다' : '표에서 맞바꿀 칸을 직접 고릅니다') + '</span></div>';
    }
    s += '<button class="pop-fold" data-act="pop-hv" aria-expanded="' + (u.hvOpen ? 'true' : 'false') + '">' + icon(u.hvOpen ? 'down' : 'right') + '홈/원정 흐름 보기<span class="muted small">연전 기간 ' + c.slots.length + '</span></button>';
    if (u.hvOpen) {
      s += '<div class="pop-hv"><div class="small" style="margin-bottom:3px">' + S.team(mt.home) + '</div>' + teamStrip(mt.home, s0) +
        '<div class="small" style="margin:6px 0 3px">' + S.team(mt.away) + '</div>' + teamStrip(mt.away, s0) +
        '<div class="legend" style="margin-top:6px"><span><i style="background:#D9DFE9"></i>홈</span><span><i style="background:var(--navy)"></i>원정</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--bad)"></i>홈·원정 4연속 이상</span><span><i style="outline:2px solid var(--blue)"></i>이 경기</span></div></div>';
    }
    return s + '</div>';
  }
  function popFix(v) {
    const c = D();
    const rule = Score.RULE_BY_CODE[v.code];
    let s = '<div class="pop pop-v" role="dialog" aria-label="고치는 방법" data-anchor-slot="' + v.slot + '">' +
      popHead('<span class="vb-rule">' + S.ruleLabel(v.code) + '</span>', S.isVirtual(v) ? S.virt() : '') +
      '<div class="pop-sub">' + esc(rule.desc) + '</div>';
    if (S.isVirtual(v)) s += '<div class="pop-note">' + icon('info') + '<span>시연용으로 일부러 만든 위반입니다: ' + esc(virtNote(v)) + '.</span></div>';
    s += '<div class="pop-sec"><h4>어디서<span class="r">' + esc(c.slots[v.slot].label) + '</span></h4>' +
      (v.matches || []).map((m) => '<button class="li" data-act="sel-match" data-m="' + m + '" style="padding-left:6px" title="경기 창 열기"><span class="ico">' + icon('target') + '</span><span class="li-main">' + esc(app().matchLabel(m)) + ' <span class="muted small">' + esc(c.plan[m] >= 0 ? fmt.date(c.slots[c.plan[m]].day) : '일정 미정') + '</span></span>' + icon('right') + '</button>').join('') +
      '</div>';
    const slots = v.code === 'H0-f' ? [] : [v.slot];
    if (v.code === 'H0-f') for (const m of v.matches || []) if (c.plan[m] >= 0) slots.push(c.plan[m]);
    const cands = S.candidates((v.matches || []).filter((m) => c.plan[m] >= 0), slots, 5);
    s += '<div class="pop-sec"><h4>고치는 방법' + (S.feature('M2') ? '<span class="r">' + (S.dev() ? 'Δ = 적용 후 − 현재' : '적용하면 이렇게 달라집니다') + '</span>' : '') + '</h4>' + candList(cands) + '</div>';
    return s + '</div>';
  }
  function virtNote(v) {
    // 같은 코드의 시드가 여럿이면(H1 슬롯 맞바꾸기 2건) 위반 슬롯이 맞바꾼 슬롯(또는 그 직후)인 것을 고른다
    const sd = S.SEEDS.filter((x) => x.code === v.code).find((x) => !x.slots || x.slots.some((k) => k === v.slot || k + 1 === v.slot)) || S.SEEDS.find((x) => x.code === v.code);
    return sd ? sd.note + (S.dev() ? ' (' + sd.code + ')' : '') : '시연용으로 넣은 위반';
  }
  /** 창을 기준 칸 오른쪽에 둔다. 화면 밖으로 나가면 왼쪽. 기준 칸이 없으면(다른 달·보관함) 오른쪽 위 */
  function positionPop(root) {
    const pop = root.querySelector('.pop');
    if (!pop) return;
    let a = null;
    if (pop.dataset.anchorM != null) a = root.querySelector('.gm[data-m="' + pop.dataset.anchorM + '"], .mx-c[data-m="' + pop.dataset.anchorM + '"], .tv-flow-blk[data-m="' + pop.dataset.anchorM + '"]');
    else if (pop.dataset.anchorSlot != null) a = root.querySelector('.slotband[data-slot="' + pop.dataset.anchorSlot + '"], .mx-c.vsel, .mx-col[data-slot="' + pop.dataset.anchorSlot + '"], .tv-flow-blk.vsel');
    const rr = root.getBoundingClientRect();
    const body = root.querySelector('.r3-body');
    const minTop = (body ? body.offsetTop : 0) + 6; // 위반 띠·도구줄은 가리지 않는다
    pop.style.maxHeight = Math.max(120, rr.height - minTop - 8) + 'px';
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left, top;
    if (a) {
      const ar = a.getBoundingClientRect();
      left = ar.right - rr.left + 8; top = ar.top - rr.top - 6;
      if (left + pw > rr.width - 8) left = ar.left - rr.left - pw - 8;
    } else { left = rr.width - pw - 12; top = minTop; }
    left = Math.max(8, Math.min(left, rr.width - pw - 8));
    top = Math.max(minTop, Math.min(top, rr.height - ph - 8));
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.classList.add('ready');
  }
  /** 구단별 표: 고른 경기·위반 칸이 보이게 가로 스크롤(고른 것이 바뀌었을 때만) */
  function revealMatrix(root) {
    const wrap = root.querySelector('.mx-wrap');
    if (!wrap) return;
    const key = S.ui.sel || '';
    if (S._mxRevealed === key) return;
    S._mxRevealed = key;
    const cell = wrap.querySelector('.mx-c.sel, .mx-c.vsel');
    if (!cell) return;
    const x = cell.offsetLeft - wrap.clientWidth / 2;
    wrap.scrollLeft = Math.max(0, x);
  }

  // ───────── 단계 ─────────
  /** 보기 탭: [id, 이름, 아이콘]. 흐름(plan-flow.js)이 2027에서 바꿔 끼운다 */
  S.r3Views = () => [['calendar', '달력', 'cal'], ['matrix', '구단별 연전 표', 'grid']];
  S.steps[3] = {
    render() {
      const u = S.ui, st = app().state;
      S.wide = window.innerWidth >= 1800;
      const ids = S.r3Views().map((v) => v[0]);
      if (u.view === 'slots') u.view = 'matrix'; // 예전 주소의 「연전 기간 목록」은 구단별 연전 표로
      if (u.view === 'matrix' && !ids.includes('matrix') && ids.includes('flow')) u.view = 'flow'; // 2027: 구단별 연전 표는 홈/원정 흐름 띠에 합쳤다
      if (!ids.includes(u.view)) u.view = 'calendar';
      const ms = months();
      if (!ms.includes(u.month)) u.month = ms[0];
      if (u.moving != null && !st.matches[u.moving]) u.moving = null;
      S._selViol = u.sel && u.sel.startsWith('v:') ? S.findViolation(u.sel.slice(2)) : null;
      let pop = '';
      if (u.sel && u.sel.startsWith('m:') && u.moving == null) { pop = popMatch(parseInt(u.sel.slice(2), 10)); u.pop = null; }
      else if (u.pop === 'fix' && S._selViol && !EX()) pop = popFix(S._selViol);
      else u.pop = null;
      return '<div class="stepview no-band"><div class="r3' + (u.moving != null ? ' moving' : '') + (EX() ? ' r3-edit' : '') + '">' + (EX() ? EX().top() : '') + renderVBand() + renderToolbar() +
        '<div class="r3-body">' + (u.view === 'calendar' ? renderCalendar() : u.view === 'flow' ? renderFlow() : u.view === 'pairs' ? renderPairs() : renderMatrix()) + '</div>' + pop + '</div></div>';
    },
    after() {
      const u = S.ui;
      const root = document.querySelector('.r3');
      if (!root) return;
      revealMatrix(root);
      positionPop(root);
      if (u.flashMatches) setTimeout(() => { u.flashMatches = null; }, 50);
      // 빈 곳을 누르면 창이 닫힌다(단추·창 안·메뉴는 제외)
      root.addEventListener('click', (e) => {
        if (!u.sel && !u.pop) return;
        if (e.target.closest('.pop') || e.target.closest('[data-act]') || e.target.closest('.menu')) return;
        if (u.sel && u.sel.startsWith('m:')) S.go({ sel: null, pop: null });
        else if (u.pop) S.go({ pop: null });
      });
    }
  };
  // Esc: 옮기는 중 취소 → 경기 창 닫기 → 고치는 방법 창 닫기 (메뉴·창·서랍이 열려 있으면 그쪽이 먼저)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const u = S.ui;
    if (u.step !== 3 || u.ops || u.menu || u.modal || u.drawer || !S.booted) return;
    if (u.moving != null) { e.preventDefault(); S.go({ moving: null }); }
    else if (u.sel && u.sel.startsWith('m:')) { e.preventDefault(); S.go({ sel: null, pop: null }); }
    else if (u.pop) { e.preventDefault(); S.go({ pop: null }); }
  });

  // ───────── 동작 ─────────
  function gotoViolation(v, patch) {
    S.go(Object.assign({ step: 3, ops: null, sel: 'v:' + S.vsig(v), month: S.slotMonth(v.slot), flashMatches: (v.matches || []).slice() }, patch || {}));
  }
  function stepViol(d) {
    const list = orderedViolations();
    if (!list.length) return;
    let i = curViolIndex(list);
    i = i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length;
    gotoViolation(list[i]);
  }
  function openMenu(el, name) {
    const r = el.getBoundingClientRect();
    S.ui.menuPos = { x: r.right, y: r.bottom + 4 };
    S.ui.menu = S.ui.menu === name ? null : name;
    S.render();
  }
  function doMove(slot, target) {
    const m = S.ui.moving;
    if (m == null) return;
    const pv = app().previewDrop(m, slot, target);
    S.ui.moving = null;
    if (app().drop(m, slot, target)) {
      S.ui.flashMatches = target != null ? [m, target] : [m];
      S.toast((target != null ? '맞바꿨습니다' : '옮겼습니다') + ' · ' + deltaWord(pv.hardDelta) + ' · 실행 취소로 되돌릴 수 있습니다', pv.hardDelta >= 0 ? 'ok' : 'warn');
    }
    S.render();
  }
  Object.assign(S.actions, {
    'sel-viol': (el) => { const v = S.findViolation(el.dataset.sig); if (v) gotoViolation(v); },
    'viol-prev': () => stepViol(-1),
    'viol-next': () => stepViol(1),
    'viol-fix': () => {
      if (EX()) return;
      const list = orderedViolations();
      if (!list.length) return;
      if (curViolIndex(list) < 0) { gotoViolation(list[0], { pop: 'fix' }); return; }
      S.go({ pop: S.ui.pop === 'fix' ? null : 'fix' });
    },
    'viol-menu': (el) => openMenu(el, 'viols'),
    'teams-menu': (el) => openMenu(el, 'teams'),
    'pool-menu': (el) => openMenu(el, 'pool'),
    'sel-match': (el) => {
      if (S.ui.moving != null) return;
      const m = parseInt(el.dataset.m, 10);
      S.go({ step: 3, ops: null, sel: 'm:' + m, pop: null }); // 달은 바꾸지 않는다
    },
    'pop-close': () => { const u = S.ui; S.go(u.sel && u.sel.startsWith('m:') ? { sel: null, pop: null } : { pop: null }); },
    'pop-hv': () => { S.ui.hvOpen = !S.ui.hvOpen; S.render(); },
    'move-start': (el) => { const m = parseInt(el.dataset.m, 10); if (app().state.matches[m] && !app().state.matches[m].pinned) S.go({ moving: m, sel: null, pop: null }); },
    'move-cancel': () => S.go({ moving: null }),
    'move-here': (el) => doMove(+el.dataset.slot, null),
    'move-swap': (el) => doMove(+el.dataset.slot, +el.dataset.m),
    'r-view': (el) => S.go({ view: el.dataset.view }),
    'r-month': (el) => { const u = S.ui; S.go({ month: +el.dataset.month, pop: null, sel: u.sel && u.sel.startsWith('m:') ? null : u.sel }); }, // 달을 바꾸면 창은 닫힌다(옮기는 중은 유지)
    'tf': (el) => { const f = S.ui.teamFilter.slice(); const t = el.dataset.team; const i = f.indexOf(t); if (i >= 0) f.splice(i, 1); else f.push(t); S.ui.teamFilter = f; S.render(); }, // 메뉴는 열어 둔다(여러 구단)
    'tf-clear': () => S.go({ teamFilter: [] }),
    'to-pool': (el) => { app().moveMatch(+el.dataset.m, -1); },
    'from-pool': (el) => { const slot = +el.dataset.slot; S.ui.month = S.slotMonth(slot); app().moveMatch(+el.dataset.m, slot); },
    'apply-cand': (el) => {
      const cd = JSON.parse(el.dataset.c);
      const list0 = orderedViolations(), idx0 = curViolIndex(list0);
      const before = list0.length;
      const sel = S.ui.sel;
      let ok;
      if (cd.kind === 'swap') ok = app().swapMatches(cd.m, cd.n);
      else if (cd.kind === 'slots') {
        const c = D();
        ok = app().commit('연전 기간 맞바꾸기: ' + fmt.date(c.slots[cd.a].day) + ' ↔ ' + fmt.date(c.slots[cd.b].day), (s) => { for (const p of s.plan) { if (p.calendar === cd.a) p.calendar = cd.b; else if (p.calendar === cd.b) p.calendar = cd.a; } }, ['plan']);
      } else ok = app().commit('홈·원정 바꾸기: ' + app().matchLabel(cd.m), (s) => { const m = s.matches[cd.m]; const t = m.home; m.home = m.away; m.away = t; }, ['matches']);
      if (!ok) return;
      const list = orderedViolations(), after = list.length;
      if (sel && sel.startsWith('v:') && !S.findViolation(sel.slice(2))) {
        // 고친 위반이 사라졌으면 같은 자리의 다음 위반으로(없으면 띠만 남긴다)
        const nv = after ? list[Math.min(Math.max(idx0, 0), after - 1)] : null;
        S.ui.sel = nv ? 'v:' + S.vsig(nv) : null;
        if (nv) { S.ui.month = S.slotMonth(nv.slot); S.ui.flashMatches = (nv.matches || []).slice(); }
        else S.ui.pop = null;
      }
      S.toast((after < before ? '위반 ' + (before - after) + '건 해소 · ' : '') + '적용했습니다. 실행 취소로 되돌릴 수 있습니다.', after < before ? 'ok' : 'info');
    },
    'snap-menu': (el) => openMenu(el, 'snap'),
    'snap-save': () => { const d = new Date(); app().saveSnapshot('수정안 ' + (app().state.snapshots.length + 1) + ' — ' + fmt.clock(d)); S.ui.menu = null; },
    'snap-restore': (el) => { app().restoreSnapshot(el.dataset.id); S.ui.menu = null; S.render(); }
  });
  S.inputs.pin = (el) => { app().togglePin(+el.dataset.m, el.checked); };

  // ───────── 메뉴: 위반 목록 · 구단 고르기 · 보관함 · 중간 저장 ─────────
  const menuPos = () => { const p = S.ui.menuPos || { x: 0, y: 0 }; return 'top:' + p.y + 'px;right:' + Math.max(8, window.innerWidth - p.x) + 'px'; };
  S.menus.viols = function () {
    const c = D(), u = S.ui, list = orderedViolations();
    let s = '<div class="menu vmenu" role="menu" style="' + menuPos() + '"><div class="mh">' + esc(S.termPlain('hardViol')) + ' ' + list.length + '건 · 누르면 그 자리로 갑니다</div>';
    for (const r of Score.HARD_RULES) {
      const vs = list.filter((v) => v.code === r.code);
      if (!vs.length) continue;
      s += '<div class="vrule">' + S.ruleLabel(r.code) + '<span class="cnt">' + vs.length + '</span></div>';
      for (const v of vs) {
        const sig = S.vsig(v);
        s += '<button role="menuitem" class="vitem' + (u.sel === 'v:' + sig ? ' active' : '') + '" data-act="sel-viol" data-sig="' + esc(sig) + '"><span class="ico">' + icon('x') + '</span><span class="li-main"><span class="msg">' + esc(shortMsg(v)) + '</span><span class="loc">' + icon('cal') + esc(fmt.date(c.slots[v.slot].day)) + (S.isVirtual(v) ? ' ' + S.virt() : '') + '</span></span></button>';
      }
    }
    return s + '</div>';
  };
  S.menus.teams = function () {
    const u = S.ui;
    return '<div class="menu tmenu" role="menu" style="' + menuPos() + '"><div class="mh">구단 고르기 · 여러 구단을 고를 수 있습니다</div><div class="tf">' + app().state.teams.map((t) => {
      const on = u.teamFilter.includes(t.name);
      return '<button class="' + (on ? 'on' : '') + '" data-act="tf" data-team="' + esc(t.name) + '" aria-pressed="' + on + '"><i class="sw" style="background:' + esc(t.color) + '"></i>' + esc(t.name) + '<span class="ck">' + (on ? icon('check') : '') + '</span></button>';
    }).join('') + '</div><div class="msep"></div><button role="menuitem" data-act="tf-clear"' + (u.teamFilter.length ? '' : ' disabled') + '>' + icon('x') + '모두 해제</button></div>';
  };
  S.menus.pool = function () {
    const c = D(), st = app().state;
    return '<div class="menu" role="menu" style="' + menuPos() + '"><div class="mh">일정 미정 ' + c.pool.length + '경기 · 누르면 넣을 자리를 고릅니다</div>' +
      (c.pool.length ? c.pool.map((m) => { const mt = st.matches[m]; return '<button role="menuitem" data-act="sel-match" data-m="' + m + '">' + S.team(mt.away) + '<span class="muted">vs</span>' + S.team(mt.home) + '<span class="muted" style="margin-left:auto">' + mt.consecutive + '연전</span></button>'; }).join('') : '<div class="small muted" style="padding:6px 12px">비어 있음</div>') + '</div>';
  };
  S.menus.snap = function () {
    const snaps = app().state.snapshots.slice().reverse();
    return '<div class="menu" role="menu" style="' + menuPos() + ';width:330px">' +
      '<button role="menuitem" data-act="snap-save">' + icon('plus') + '지금 일정을 중간 저장</button><div class="msep"></div><div class="mh">중간 저장 ' + snaps.length + '개</div>' +
      (snaps.length ? snaps.map((sn) => '<button role="menuitem" data-act="snap-restore" data-id="' + esc(sn.id) + '" style="height:auto;padding:6px 12px;flex-direction:column;align-items:flex-start;gap:1px"><span style="display:flex;gap:6px;width:100%"><b>' + esc(sn.name) + '</b><span class="tag ref" style="margin-left:auto">되돌리기</span></span>' + (S.dev() ? '<span class="mono muted" style="font-size:10.5px">' + esc((sn.score || '').replace(/-/g, '−')) + '</span>' : '<span class="muted" style="font-size:11px">' + (sn.feasible ? '편성 가능' : '필수 규칙 위반 있음') + '</span>') + '</button>').join('') : '<div class="small muted" style="padding:6px 12px">없음</div>') +
      '</div>';
  };

  // ───────── 점검용 주소(demo=) : 스크린샷·검사에서 창·옮기는 중 상태를 만든다 ─────────
  /** demo=fix: 세 번째 위반(없으면 첫 위반)으로 가서 고치는 방법 창을 연다 */
  S.demos.fix = function () { const list = orderedViolations(); if (list.length) gotoViolation(list[Math.min(2, list.length - 1)], { pop: 'fix' }); };
  /** demo=viol3: 위반 띠의 ›를 세 번 누른 상태 */
  S.demos.viol3 = function () { for (let i = 0; i < 3; i++) stepViol(1); };
  /** demo=pop: 지금 달 첫 연전 기간의 두 번째 경기 창을 연다 */
  S.demos.pop = function () { const c = D(); const sl = c.slots.find((x) => x.month === S.ui.month); const m = sl ? (c.bySlot[sl.index][1] != null ? c.bySlot[sl.index][1] : c.bySlot[sl.index][0]) : null; if (m != null) S.go({ sel: 'm:' + m, pop: null }); };
  /** demo=moving: 지금 달 첫 연전 기간의 두 번째 경기를 옮기는 중 */
  S.demos.moving = function () { const c = D(); const sl = c.slots.find((x) => x.month === S.ui.month); const m = sl ? (c.bySlot[sl.index][1] != null ? c.bySlot[sl.index][1] : c.bySlot[sl.index][0]) : null; if (m != null) S.go({ moving: m, sel: null, pop: null }); };
})();
