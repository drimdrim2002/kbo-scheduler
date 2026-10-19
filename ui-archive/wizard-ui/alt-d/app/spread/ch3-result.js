/*
 * 제3장 결과·수정 — 위반을 없애고 일정을 다듬는다.
 * 본문: 3.1 월간 캘린더(슬롯 블록, 구단 필터, 위반 테두리) · 3.2 슬롯 목록 · (3.3 구단 × 슬롯, 기능 V6M)
 * 여백: 위반 목록(위반 상세는 여기 한 곳) · 선택한 시리즈(핀, 교환 후보와 Δ) · 미배정 풀
 */
(function () {
  'use strict';
  const SP = window.SP;
  const KBO = window.KBO;
  const { Dates, Score } = KBO;
  const { esc, fmt } = SP;
  const app = SP.app;
  const ui = SP.ui;
  const MONTHS = [3, 4, 5, 6, 7, 8];

  function tabs() {
    const t = [{ id: 'calendar', label: '월간 캘린더' }, { id: 'slots', label: '슬롯 목록' }];
    if (SP.on('V6M')) t.push({ id: 'matrix', label: '구단 × 슬롯' });
    return t;
  }
  const short = (st) => String(st || '').replace(/종합운동장|야구장|경기장/, '').replace('돔', '돔').replace('KT위즈파크', '').replace('삼성라이언즈파크', '').replace('챔피언스필드', '').replace('NC파크', '').replace('이글스파크', '');
  const stadiumShort = (team) => { const t = app.team(team); return t ? short(t.stadium) : ''; };

  // ───────────── 상호작용 ─────────────
  SP.act.month = (el) => { ui.month = Number(el.dataset.arg); ui.focusSlot = null; SP.render(); };
  SP.act.filterTeam = (el) => { app.toggleTeamFilter(el.dataset.arg); };
  SP.act.filterClear = () => { app.setTeamFilter([]); };
  SP.act.selMatch = (el) => { const m = Number(el.dataset.arg); ui.sel = ui.sel === m ? null : m; SP.render(); };
  SP.act.gotoViol = (el) => {
    const v = SP.ex().violations[Number(el.dataset.arg)];
    if (!v) return;
    const slot = v.slot != null ? v.slot : (v.slots || [])[0];
    if (slot != null && slot >= 0) { ui.month = app.derived().slots[slot].month; ui.focusSlot = slot; SP.flash('slot-' + slot); }
    ui.sel = (v.matches || [])[0] != null ? v.matches[0] : ui.sel;
    ui.violSel = v.code + ':' + v.slot;
    SP.go(3, 'calendar', { noFocus: true });
  };
  SP.act.pin = (el) => { app.togglePin(Number(el.dataset.arg)); };
  SP.act.toPool = (el) => { app.moveMatch(Number(el.dataset.arg), -1); };
  SP.act.swapWith = (el) => { const [a, b] = el.dataset.arg.split(':').map(Number); if (app.swapMatches(a, b)) SP.toast('맞바꿨습니다. 실행 취소(⌘Z)로 되돌릴 수 있습니다.', 'ok'); };
  SP.act.moveTo = (el) => { const [m, s] = el.dataset.arg.split(':').map(Number); if (app.moveMatch(m, s)) { ui.month = app.derived().slots[s].month; SP.toast(app.matchLabel(m) + ' → ' + SP.slotLabel(s), 'ok'); } };
  SP.act.reoptimize = () => { SP.go(2, 'run'); SP.startRun(); };
  SP.act.snapSave = () => {
    const inp = document.getElementById('snap-name');
    const name = (inp && inp.value.trim()) || ('스냅샷 ' + (app.state.snapshots.length + 1));
    app.saveSnapshot(name); ui.menu = 'snap'; SP.render();
  };
  SP.act.snapRestore = (el) => { app.restoreSnapshot(el.dataset.arg); ui.menu = null; SP.render(); };

  // ───────────── 캘린더 ─────────────
  function monthViolations() {
    const ex = SP.ex();
    const by = {};
    for (const v of ex.violations) { if (v.slot == null || v.slot < 0) continue; const mo = app.derived().slots[v.slot].month; by[mo] = (by[mo] || 0) + 1; }
    return by;
  }
  function toolbar() {
    const mv = monthViolations();
    const f = app.ui.teamFilter;
    let h = '<div class="sp-toolbar"><div class="sp-monthtabs" role="group" aria-label="월">' + MONTHS.map((m) => '<button type="button" data-act="month" data-arg="' + m + '" aria-pressed="' + (ui.month === m) + '">' + m + '월' + (mv[m] ? '<span class="sp-mv" aria-label="위반 ' + mv[m] + '건">⛔' + mv[m] + '</span>' : '') + '</button>').join('') + '</div>';
    h += '<span class="sp-vr"></span><span class="sp-toolbar-l">구단 필터</span><div class="sp-filter" role="group" aria-label="구단 필터">' + app.state.teams.map((t) => '<button type="button" class="sp-fchip" data-act="filterTeam" data-arg="' + esc(t.name) + '" aria-pressed="' + f.has(t.name) + '"><i style="background:' + t.color + '"></i>' + esc(t.name) + '</button>').join('') +
      (f.size ? '<button type="button" class="sp-link" data-act="filterClear" style="font-size:11px;margin-left:4px">해제</button>' : '') + '</div>';
    h += '<span class="sp-grow"></span><span class="sp-legend"><span><span class="sp-tag-h">홈</span> <span class="sp-tag-a">원정</span></span><span>■ 고정</span><span style="color:var(--bad);font-weight:700">✖ 위반</span></span></div>';
    return h;
  }
  function calendar() {
    const st = app.state;
    const d = app.derived();
    const ex = d.ex;
    const M = ui.month;
    const year = st.meta.season || 2025;
    const first = Dates.dayNum(year + '-' + String(M).padStart(2, '0') + '-01');
    const last = Dates.dayNum(Dates.isoDate(Dates.dayNum(year + '-' + String(M + 1).padStart(2, '0') + '-01') - 1));
    let start = first - ((Dates.weekday(first) + 6) % 7);
    if (M === 3) start = Dates.dayNum('2025-03-17');
    const end = last + (6 - ((Dates.weekday(last) + 6) % 7));
    const hol = new Map((st.settings.holidays || []).map((h) => [Dates.dayNum(h.date), h.name]));
    const blk = [];
    for (const b of st.settings.blackouts || []) blk.push({ s: Dates.dayNum(b.start), e: Dates.dayNum(b.end), label: b.label });
    const rest = new Set(st.settings.restWeekdays || [1]);
    const f = app.ui.teamFilter;
    const wide = window.innerWidth >= 1700;
    let h = '<div class="sp-cal" role="grid" aria-label="' + M + '월 캘린더" style="--cal-cols:0.42fr repeat(6,minmax(0,1fr))"><div class="sp-cal-head" role="row">' + ['월', '화', '수', '목', '금', '토', '일'].map((w, i) => '<div role="columnheader" class="' + (i === 6 ? 'sp-sun' : '') + '">' + w + '</div>').join('') + '</div><div class="sp-cal-weeks">';
    for (let w0 = start; w0 <= end; w0 += 7) {
      h += '<div class="sp-week" role="row">';
      const covered = new Array(7).fill(false);
      for (let k = 0; k < 7; k++) {
        const dd = w0 + k;
        const out = Dates.month(dd) !== M;
        const hn = hol.get(dd);
        h += '<div class="sp-day' + (out ? ' sp-out' : '') + (hn ? ' sp-hol' : '') + '" style="grid-column:' + (k + 1) + '"><b>' + Number(Dates.isoDate(dd).slice(8)) + '</b>' + (Number(Dates.isoDate(dd).slice(8)) === 1 || dd === start ? '<span class="sp-muted">' + Dates.month(dd) + '월</span> ' : '') + (hn ? '<span class="sp-hname">' + esc(hn) + '</span>' : '') + '</div>';
      }
      // 슬롯 블록
      d.slots.forEach((sl) => {
        if (sl.day > w0 + 6 || sl.day + sl.consecutive - 1 < w0) return;
        const c0 = Math.max(0, sl.day - w0), c1 = Math.min(6, sl.day + sl.consecutive - 1 - w0);
        for (let k = c0; k <= c1; k++) covered[k] = true;
        const ms = d.bySlot[sl.index];
        const hard = ex.slotHard[sl.index] || 0;
        const codes = Array.from(new Set(ex.violations.filter((v) => v.slot === sl.index).map((v) => v.code)));
        const outM = sl.month !== M;
        const focus = ui.focusSlot === sl.index;
        const flash = ui.flash === 'slot-' + sl.index;
        h += '<div class="sp-blk' + (hard ? ' sp-blk-bad' : '') + (outM ? ' sp-out-month' : '') + (focus ? ' sp-blk-focus' : '') + (flash ? ' sp-flash' : '') + '" style="grid-column:' + (c0 + 1) + ' / span ' + (c1 - c0 + 1) + '"' + (focus ? ' data-scroll-into="1"' : '') + '>' +
          '<div class="sp-blk-h"><b>' + sl.consecutive + '연전</b><span>' + (sl.weekend ? '주말' : '주중') + (sl.holiday ? ' · 휴일 ' + sl.holiday : '') + '</span>' + (codes.length ? '<span class="sp-blk-v"><span aria-hidden="true">⛔</span> ' + codes.join(' · ') + '</span>' : '') + '</div><div class="sp-blk-g">';
        for (const m of ms) {
          const x = st.matches[m];
          const flags = ex.matchFlags[m] || [];
          const hitHome = f.has(x.home), hitAway = f.has(x.away);
          const hit = hitHome || hitAway;
          const cls = 'sp-g' + (flags.length ? ' sp-g-bad' : '') + (ui.sel === m ? ' sp-g-sel' : '') + (f.size ? (hit ? ' sp-g-hit' : ' sp-g-dim') : '');
          const tag = f.size && hit ? (hitHome && !hitAway ? '<span class="sp-tag-h">홈</span>' : hitAway && !hitHome ? '<span class="sp-tag-a">원정</span>' : '') : '';
          h += '<button type="button" class="' + cls + '" data-act="selMatch" data-arg="' + m + '" aria-pressed="' + (ui.sel === m) + '" title="' + esc(x.away + ' @ ' + x.home + ' · ' + (app.team(x.home) || {}).stadium + (flags.length ? ' · 위반 ' + flags.join(', ') : '') + (x.pinned ? ' · 고정' : '')) + '">' +
            (flags.length ? '<span aria-hidden="true">✖</span>' : '') + tag + esc(x.away) + '<span class="sp-at">@</span>' + esc(x.home) + (wide ? ' <span class="sp-st">' + esc(stadiumShort(x.home)) + '</span>' : '') + (x.pinned ? '<span class="sp-pin" aria-label="고정">■</span>' : '') + '</button>';
        }
        h += '</div></div>';
      });
      // 빈 날: 휴식 요일·경기 없는 기간
      for (let k = 0; k < 7; k++) {
        if (covered[k]) continue;
        const dd = w0 + k;
        const b = blk.find((x) => dd >= x.s && dd <= x.e);
        if (b) {
          let span = 1; while (k + span < 7 && !covered[k + span] && w0 + k + span <= b.e) span++;
          h += '<div class="sp-rest" style="grid-column:' + (k + 1) + ' / span ' + span + '">' + esc(b.label) + '</div>';
          k += span - 1;
        } else if (rest.has(Dates.weekday(dd))) h += '<div class="sp-rest" style="grid-column:' + (k + 1) + '">휴식</div>';
        else if (dd < Dates.dayNum(st.settings.seasonStart) || dd > Dates.dayNum(st.settings.initialEnd)) h += '<div class="sp-rest" style="grid-column:' + (k + 1) + '">' + (dd < Dates.dayNum(st.settings.seasonStart) ? '개막 전' : '재편성 기간') + '</div>';
        else h += '<div class="sp-rest" style="grid-column:' + (k + 1) + '">비어 있음</div>';
      }
      h += '</div>';
    }
    h += '</div></div>';
    return h;
  }

  function slotList() {
    const st = app.state;
    const d = app.derived();
    const ex = d.ex;
    let h = '<div class="sp-toolbar">' + SP.cap('표 3.2', '슬롯 목록', '45개 슬롯 × 5개 시리즈 · 행의 대진을 누르면 여백에 상세가 열린다') + '</div>';
    h += '<div class="sp-scroll sp-grow" data-sk="slotlist" style="border-bottom:2px solid var(--ink)"><table class="sp-table"><thead><tr><th class="sp-num" style="width:40px">슬롯</th><th style="width:150px">날짜</th><th class="sp-num" style="width:44px">연전</th><th style="width:96px">주말·휴일</th><th>대진 (원정 @ 홈)</th><th style="width:170px">상태</th></tr></thead><tbody>';
    d.slots.forEach((sl) => {
      const codes = Array.from(new Set(ex.violations.filter((v) => v.slot === sl.index).map((v) => v.code)));
      h += '<tr' + (codes.length ? ' class="sp-pf-block"' : '') + '><td class="sp-num">' + (sl.index + 1) + '</td><td><b>' + esc(SP.slotRange(sl.index)) + '</b></td><td class="sp-num">' + sl.consecutive + '</td><td>' + (sl.weekend ? '주말' : '주중') + ' · ' + sl.holiday + '</td><td style="white-space:normal">' +
        d.bySlot[sl.index].map((m) => { const x = st.matches[m]; const bad = (ex.matchFlags[m] || []).length; return '<button type="button" class="sp-g' + (bad ? ' sp-g-bad' : '') + (ui.sel === m ? ' sp-g-sel' : '') + '" style="display:inline-flex;margin-right:6px" data-act="selMatch" data-arg="' + m + '">' + (bad ? '✖ ' : '') + esc(x.away) + '<span class="sp-at">@</span>' + esc(x.home) + (x.pinned ? '<span class="sp-pin">■</span>' : '') + '</button>'; }).join('') +
        '</td><td>' + (codes.length ? SP.chip('bad', codes.join(' · ')) : SP.chip('ok', '정상')) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }
  function matrix() {
    const st = app.state;
    const d = app.derived();
    const ex = d.ex;
    let h = '<div class="sp-toolbar">' + SP.cap('표 3.3', '구단 × 슬롯', '셀 = 상대 구단 · 홈/원정 · 4연속 이상은 빨간 테두리') + '</div>';
    h += '<div class="sp-scroll2 sp-grow" data-sk="tsm" style="border-bottom:2px solid var(--ink)"><table class="sp-table sp-tsm"><thead><tr><th>구단</th>' + d.slots.map((s) => '<th class="sp-c" title="' + esc(s.label) + '">' + fmt.md(s.day) + '</th>').join('') + '</tr></thead><tbody>';
    for (const tm of ex.teamMetrics) {
      const byS = new Map(tm.visits.map((v) => [v.slot, v]));
      h += '<tr><th scope="row">' + SP.team(tm.name) + '</th>' + d.slots.map((s) => { const v = byS.get(s.index); if (!v) return '<td></td>'; const opp = st.teams[v.opp].name; return '<td class="' + (v.home ? 'sp-h' : 'sp-a') + '"' + (v.run > 3 ? ' style="outline:2px solid var(--bad);outline-offset:-2px"' : '') + ' title="' + esc((v.home ? '홈 vs ' : '원정 @ ') + opp) + '">' + esc(opp.slice(0, 2)) + '</td>'; }).join('') + '</tr>';
    }
    h += '</tbody></table></div>';
    return h;
  }

  function snapMenu() {
    if (ui.menu !== 'snap') return '';
    const snaps = app.state.snapshots.slice().reverse();
    return '<div class="sp-pop" role="dialog" aria-label="스냅샷" style="width:380px;right:0">' +
      '<div class="sp-pop-h">현재 배정 저장</div><div class="sp-row" style="padding:4px 12px 8px"><input class="sp-input sp-grow" id="snap-name" data-fk="snap-name" placeholder="이름 (예: 위반 수정 1차)"> ' + SP.btn('snapSave', '저장', { kind: 'primary' }) + '</div>' +
      '<div class="sp-pop-h">저장한 스냅샷 · ' + snaps.length + '개</div><div style="max-height:260px;overflow-y:auto">' +
      snaps.map((s) => { const ex = app.explainSnapshot(s.id); const ok = ex ? ex.feasible : s.feasible; return '<div class="sp-row" style="padding:5px 12px;border-bottom:1px dotted var(--rule-2)"><div class="sp-grow"><b style="font-size:12px">' + esc(s.name) + '</b><div class="sp-note-s">' + fmt.md(s.createdAt.slice(0, 10)) + ' ' + fmt.clock(s.createdAt) + ' · ' + (ex ? (ex.feasible ? '✔ 편성 가능' : '✖ Hard ' + ex.violations.length + '건') : '구성 다름') + (s.note ? ' · ' + esc(s.note) : '') + '</div></div>' + SP.btn('snapRestore', '복원', { arg: s.id, disabled: !ex }) + '</div>'; void ok; }).join('') + '</div></div>';
  }
  function tools() {
    const s = app.store;
    return '<span class="sp-toolbar-l" style="max-width:220px;overflow:hidden;text-overflow:ellipsis">' + (s.canUndo() ? '마지막: ' + esc(s.undoLabel()) : '') + '</span>' + SP.undoTools() +
      '<div class="sp-menu-wrap" style="position:relative">' + SP.btn('menu', '스냅샷 <span aria-hidden="true">▾</span> <small>(' + app.state.snapshots.length + ')</small>', { arg: 'snap' }) + snapMenu() + '</div>';
  }

  // ───────────── 여백 ─────────────
  let candCache = { key: '', list: [] };
  function swapCandidates(m) {
    const key = app.store.version + ':' + m;
    if (candCache.key === key) return candCache.list;
    const st = app.state;
    const d = app.derived();
    const L = st.matches[m].consecutive;
    const from = d.plan[m];
    const out = [];
    for (let n = 0; n < st.matches.length; n++) {
      if (n === m || st.matches[n].pinned || st.matches[n].consecutive !== L) continue;
      const s = d.plan[n];
      if (s < 0 || s === from) continue;
      const p = app.previewDrop(m, s, n);
      out.push({ n, slot: s, p });
    }
    out.sort((a, b) => b.p.hardDelta - a.p.hardDelta || Score.compare(b.p.after, a.p.after));
    candCache = { key, list: out.slice(0, 5) };
    return candCache.list;
  }
  function deltaHtml(p) {
    const hd = p.hardDelta;
    const sd = p.delta.slice(2).reduce((a, b) => a + b, 0);
    return '<span class="' + (hd > 0 ? 'sp-delta-good' : hd < 0 ? 'sp-delta-bad' : '') + '">Hard ' + (hd > 0 ? '+' : hd < 0 ? '−' : '±') + Math.abs(hd) + '</span> · <span class="' + (sd > 0 ? 'sp-delta-good' : sd < 0 ? 'sp-delta-bad' : 'sp-muted') + '">Soft ' + (sd > 0 ? '+' : sd < 0 ? '−' : '±') + fmt.int(Math.abs(sd)) + '</span>';
  }
  function selDetail() {
    const m = ui.sel;
    const st = app.state;
    if (m == null || !st.matches[m]) return SP.mSec('선택한 시리즈', '<p class="sp-note-s">캘린더에서 대진을 누르면 상세, 고정(핀), 교환 후보와 점수 변화(Δ)가 여기에 열립니다.</p>');
    const d = app.derived();
    const ex = d.ex;
    const x = st.matches[m];
    const s = d.plan[m];
    const flags = ex.matchFlags[m] || [];
    const locked = SP.isRunning();
    let h = '<div class="sp-detail"><div class="sp-detail-t">' + SP.team(x.away) + ' <span class="sp-muted">@</span> ' + SP.team(x.home) + (x.pinned ? ' <span class="sp-chip sp-chip-info">■ 고정</span>' : '') + '</div>' +
      '<div class="sp-detail-s">' + (s >= 0 ? esc(SP.slotRange(s)) + ' · ' : '미배정 · ') + x.consecutive + '연전 · ' + esc((app.team(x.home) || {}).stadium || '') + (x.eventId ? ' · 이벤트 대진' : '') + '</div>';
    if (flags.length) h += '<p class="sp-note" style="color:var(--bad)"><span aria-hidden="true">✖</span> ' + flags.map((c) => esc(c + ' ' + Score.RULE_BY_CODE[c].label)).join(', ') + ' — 위반 목록 참조</p>';
    h += '<div class="sp-row" style="margin:6px 0">' + SP.btn('pin', x.pinned ? '고정 해제' : '■ 고정(핀)', { arg: m, disabled: locked }) + (SP.on('M8') && s >= 0 ? SP.btn('toPool', '미배정 풀로 빼기', { arg: m, disabled: locked || x.pinned }) : '') + '</div>';
    if (x.pinned) h += '<p class="sp-note-s">고정한 시리즈는 엔진 재최적화와 이동·교환에서 제외됩니다.</p>';
    else if (s >= 0) {
      const cands = swapCandidates(m);
      h += '<h4 class="sp-mh" style="font-size:12px;margin-top:6px">교환 후보 · 같은 ' + x.consecutive + '연전' + (SP.on('M2') ? ' (Δ 미리보기)' : '') + '</h4><table class="sp-cands"><tbody>' +
        cands.map((c) => '<tr><td><button type="button" class="sp-link" data-act="swapWith" data-arg="' + m + ':' + c.n + '"' + (locked ? ' disabled' : '') + '>↔ ' + esc(fmt.md(d.slots[c.slot].day)) + ' ' + esc(app.matchLabel(c.n)) + '</button></td>' + (SP.on('M2') ? '<td class="sp-num">' + deltaHtml(c.p) + '</td>' : '') + '</tr>').join('') + '</tbody></table>' +
        '<p class="sp-note-s">캘린더 시리즈를 끌어 다른 시리즈 위에 놓아도 맞바꿉니다' + (SP.on('M2') ? '(놓기 전 Δ 표시)' : '') + '. 키보드: 대진 선택 → 후보 Enter.</p>';
    } else {
      const L = x.consecutive;
      const slots = d.slots.filter((sl) => sl.consecutive === L).slice(0, 40).map((sl) => ({ sl, p: app.previewDrop(m, sl.index, null) })).sort((a, b) => b.p.hardDelta - a.p.hardDelta || Score.compare(b.p.after, a.p.after)).slice(0, 5);
      h += '<h4 class="sp-mh" style="font-size:12px;margin-top:6px">넣을 슬롯 후보' + (SP.on('M2') ? ' (Δ)' : '') + '</h4><table class="sp-cands"><tbody>' + slots.map((c) => '<tr><td><button type="button" class="sp-link" data-act="moveTo" data-arg="' + m + ':' + c.sl.index + '">→ ' + esc(c.sl.label) + '</button></td>' + (SP.on('M2') ? '<td class="sp-num">' + deltaHtml(c.p) + '</td>' : '') + '</tr>').join('') + '</tbody></table>';
    }
    h += '</div>';
    return SP.mSec('선택한 시리즈', h, { right: '<button class="sp-link" data-act="selMatch" data-arg="' + m + '">닫기</button>' });
  }
  function violationList() {
    const ex = SP.ex();
    if (!ex.violations.length) return SP.mSec('위반 목록', '<p class="sp-note"><span class="sp-ic sp-ic-ok">✔</span> Hard 위반이 없습니다. 제4장에서 공정성을 확인하세요.</p>', { right: 'Hard 0건' });
    const groups = {};
    ex.violations.forEach((v, i) => { (groups[v.code] = groups[v.code] || []).push([v, i]); });
    let h = '';
    for (const r of Score.HARD_RULES) {
      const g = groups[r.code];
      if (!g) continue;
      h += '<div class="sp-vgroup"><div class="sp-vgroup-h"><code>' + r.code + '</code>' + esc(r.label) + ' · ' + g.length + '건</div>';
      for (const [v, i] of g) {
        const on = ui.violSel === v.code + ':' + v.slot;
        h += '<button type="button" class="sp-vitem' + (on ? ' sp-on' : '') + '" data-act="gotoViol" data-arg="' + i + '">' + (SP.isVirtual(v) ? SP.virtual() + ' ' : '') + esc(v.message) + (SP.isVirtual(v) && on ? '<span class="sp-note-s" style="display:block">어떻게 넣었나: ' + esc(SP.seedInfo(v).how) + '</span>' : '') + '<span class="sp-vitem-go">→ 캘린더 ' + (v.slot != null && v.slot >= 0 ? fmt.md(app.derived().slots[v.slot].day) : '') + ' 위치로</span></button>';
      }
      h += '</div>';
    }
    return SP.mSec('위반 목록', h, { right: 'Hard ' + ex.violations.length + '건' + (SP.virtualCount() ? ' · 가상 ' + SP.virtualCount() : '') });
  }
  function poolSec() {
    if (!SP.on('M8')) return '';
    const pool = app.derived().pool;
    return SP.mSec('미배정 풀', pool.length ? '<div class="sp-pool">' + pool.slice(0, 30).map((m) => '<button type="button" class="sp-g' + (ui.sel === m ? ' sp-g-sel' : '') + '" data-act="selMatch" data-arg="' + m + '">' + esc(app.matchLabel(m)) + ' <span class="sp-at">' + app.state.matches[m].consecutive + '</span></button>').join('') + (pool.length > 30 ? '<span class="sp-note-s">외 ' + (pool.length - 30) + '개</span>' : '') + '</div>' : '<p class="sp-note-s">비어 있음 — 시리즈를 풀로 빼면 여기에 모이고, 누르면 넣을 슬롯 후보가 나옵니다.</p>', { right: pool.length + '개 · S0 ' + (-pool.length) });
  }
  function marginResult() {
    const ex = SP.ex();
    const b = violationList() + selDetail() + poolSec();
    const n = ex.violations.length;
    const next = '<p>' + (n ? '⛔ Hard 위반 ' + n + '건을 고칩니다. 고정한 뒤 재최적화할 수도 있습니다.' : '✔ 편성 가능합니다. 장을 확정하고 품질을 확인합니다.') + '</p><div class="sp-row">' + SP.btn('reoptimize', '핀 유지 재최적화', { cls: 'sp-grow', disabled: SP.isRunning() }) + SP.btn('go', '제4장 품질 ▶', { arg: 4, kind: n ? '' : 'primary', cls: 'sp-grow' }) + '</div>';
    return { body: b, next };
  }

  SP.chapters[3] = {
    n: 3, id: 'result', title: '결과·수정', task: '위반을 없애고 일정을 다듬는다',
    get tabs() { return tabs(); },
    summary() { const ex = SP.ex(); const d = app.derived(); return (ex.feasible ? '✔ 편성 가능' : 'Hard 위반 ' + ex.violations.length) + ' · 미배정 ' + d.pool.length + ' · 고정 ' + app.state.matches.filter((m) => m.pinned).length + ' · 스냅샷 ' + app.state.snapshots.length; },
    card() { const ex = SP.ex(); return (ex.feasible ? '편성 가능' : 'Hard 위반 ' + ex.violations.length) + ' · 고정 ' + app.state.matches.filter((m) => m.pinned).length + ' · 스냅샷 ' + app.state.snapshots.length; },
    status() {
      const ex = SP.ex();
      if (!ex.feasible) return { kind: 'block', text: 'Hard 위반 ' + ex.violations.length, short: 'Hard 위반 ' + ex.violations.length };
      if (app.derived().pool.length) return { kind: 'warn', text: '미배정 ' + app.derived().pool.length, short: '미배정 ' + app.derived().pool.length };
      return { kind: 'draft', text: '편성 가능', short: '편성 가능' };
    },
    main(tab) {
      const t = tabs();
      if (!t.some((x) => x.id === tab)) tab = ui.tab[3] = 'calendar';
      const lead = tab === 'calendar' ? '대진을 누르면 여백에 상세가 열린다. 위반 슬롯은 이중 빨간 테두리와 ⛔ 코드로 표시한다.' : tab === 'slots' ? '같은 결과를 슬롯 순서 목록으로 본다.' : '구단별 홈/원정 흐름을 격자로 본다.';
      const body = tab === 'slots' ? slotList() : tab === 'matrix' ? matrix() : toolbar() + calendar();
      return SP.subhead(3, t, tab, tools(), lead) + '<div class="sp-body">' + body + '</div>';
    },
    margin: marginResult
  };

  // 주소의 sel(시리즈) → 그 달로
  SP.afterBoot = SP.afterBoot || [];
  SP.afterBoot.push(() => { if (ui.sel != null && app.state.matches[ui.sel]) { const s = app.derived().plan[ui.sel]; if (s >= 0 && !SP.parseHash().month) ui.month = app.derived().slots[s].month; } });

  // ───────────── 끌어 놓기 (FR-M1) + Δ 미리보기 (FR-M2) ─────────────
  let drag = null;
  document.addEventListener('dragstart', (e) => {
    const g = e.target.closest && e.target.closest('.sp-blk .sp-g');
    if (!g) return;
    drag = Number(g.dataset.arg);
    e.dataTransfer.setData('text/plain', String(drag));
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', (e) => {
    if (drag == null) return;
    const g = e.target.closest && e.target.closest('.sp-blk .sp-g');
    if (!g) return;
    e.preventDefault();
    const n = Number(g.dataset.arg);
    if (SP.on('M2') && n !== drag && g.dataset.prev !== String(drag)) {
      g.dataset.prev = String(drag);
      const p = app.previewDrop(drag, app.derived().plan[n], n);
      g.title = '맞바꾸면 Hard ' + (p.hardDelta >= 0 ? '+' : '') + p.hardDelta + ' · ' + app.matchLabel(n);
    }
  });
  document.addEventListener('drop', (e) => {
    if (drag == null) return;
    const g = e.target.closest && e.target.closest('.sp-blk .sp-g');
    if (g) { e.preventDefault(); const n = Number(g.dataset.arg); if (n !== drag) app.swapMatches(drag, n); }
    drag = null;
  });
  document.addEventListener('dragend', () => { drag = null; });
  SP.afterRender.push(() => { document.querySelectorAll('.sp-blk .sp-g').forEach((g) => { g.draggable = !SP.isRunning(); }); });
})();
