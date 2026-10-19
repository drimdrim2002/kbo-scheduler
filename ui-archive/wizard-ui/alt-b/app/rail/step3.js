/*
 * alt-b 단계 레일 — ③ 결과·수정.
 * 왼쪽: 월간 캘린더(구단 필터·홈/원정·위반 테두리) + 미배정 풀. 오른쪽: 위반 목록(유일한 상세 위치) + 선택 시리즈 상세(핀·교환 후보 Δ).
 */
(function () {
  'use strict';
  const R = window.R;
  const KBO = R.KBO, D = KBO.Dates, Sc = KBO.Score;
  const esc = R.esc;
  const u = R.ui;
  u.teamFilter = new Set();
  u.sel = null;          // 선택 시리즈
  u.selViol = null;      // 선택 위반 id
  u.month = null;        // 보이는 첫 달
  u.flashSlot = null;

  const MONTHS = [3, 4, 5, 6, 7, 8];
  function twoMonths() { return window.innerWidth >= 1800; }
  function curMonth() { if (u.month == null) u.month = 5; return Math.min(u.month, twoMonths() ? 7 : 8); }

  function violationsBy(d) {
    const byMatch = new Map(), bySlot = new Map();
    for (const v of d.ex.violations) {
      for (const m of v.matches || []) { if (!byMatch.has(m)) byMatch.set(m, []); byMatch.get(m).push(v); }
      const slots = v.slots || (v.slot != null ? [v.slot] : []);
      for (const s of slots) { if (!bySlot.has(s)) bySlot.set(s, []); bySlot.get(s).push(v); }
    }
    return { byMatch, bySlot };
  }

  // ───────── 캘린더 ─────────
  function chip(m, d, vb) {
    const st = R.state();
    const x = st.matches[m];
    const tf = u.teamFilter;
    const hit = !tf.size || tf.has(x.home) || tf.has(x.away);
    const vs = vb.byMatch.get(m) || [];
    let cls = 'cc';
    let side = '';
    if (tf.size) {
      if (!hit) cls += ' dim';
      else if (tf.size === 1) { const t = Array.from(tf)[0]; cls += t === x.home ? ' is-home' : ' is-away'; side = t === x.home ? '<span class="side">홈</span>' : '<span class="side">원정</span>'; }
      else cls += ' hit';
    }
    if (vs.length) cls += ' is-viol';
    if (u.sel === m) cls += ' is-sel';
    const home = st.teams.find((t) => t.name === x.home);
    const away = st.teams.find((t) => t.name === x.away);
    return '<button class="' + cls + '" data-act="sel" data-m="' + m + '" title="' + esc(x.away + ' @ ' + x.home + ' · ' + R.shortStadium(R.stadiumOf(x.home)) + (x.pinned ? ' · 고정' : '') + (vs.length ? ' · 위반 ' + vs.map((v) => v.code).join(', ') : '')) + '">' +
      '<i class="ccbar" style="background:' + esc(away ? away.color : '#888') + '"></i>' + side +
      '<span class="cct">' + esc(x.away) + ' <span class="at">@</span> <b>' + esc(x.home) + '</b></span>' +
      (x.pinned ? R.icon('pin', 'ccpin') : '') +
      (vs.length ? '<span class="ccv">' + R.icon('block') + esc(vs[0].code) + '</span>' : '') +
      '<i class="cchome" style="background:' + esc(home ? home.color : '#888') + '"></i></button>';
  }
  function month(mo, d, vb) {
    const st = R.state();
    const year = 2025;
    const first = D.dayNum(year + '-' + String(mo).padStart(2, '0') + '-01');
    const last = D.dayNum(year + '-' + String(mo + 1).padStart(2, '0') + '-01') - 1;
    const wd = (n) => (D.weekday(n) + 6) % 7; // 월=0
    const start = first - wd(first);
    const end = last + (6 - wd(last));
    const hol = new Map((st.settings.holidays || []).map((h) => [D.dayNum(h.date), h.name]));
    const blk = D.expandRanges(st.settings.blackouts || []);
    const rest = new Set(st.settings.restWeekdays || [1]);
    const exc = new Set((st.settings.restExceptions || []).map((x) => D.dayNum(x)));
    let s = '<div class="cal-month"><div class="cal-mh"><b>' + mo + '월</b><span class="muted">' + countMonth(mo, d) + '</span></div><div class="cal-dow">' + ['월', '화', '수', '목', '금', '토', '일'].map((w, i) => '<span class="' + (i >= 5 ? 'we' : '') + '">' + w + '</span>').join('') + '</div>';
    for (let w = start; w <= end; w += 7) {
      s += '<div class="cal-week">';
      for (let k = 0; k < 7; k++) {
        const day = w + k;
        const inM = day >= first && day <= last;
        const isRest = rest.has(D.weekday(day)) && !exc.has(day);
        const isBlk = blk.has(day);
        const h = hol.get(day);
        const out = day < D.dayNum(st.settings.seasonStart) || day > D.dayNum(st.settings.initialEnd);
        s += '<div class="cal-d' + (inM ? '' : ' out') + (isRest ? ' rest' : '') + (isBlk ? ' blk' : '') + (out ? ' off' : '') + '" style="grid-column:' + (k + 1) + '"><span class="dn' + (h ? ' hol' : '') + (k >= 5 ? ' we' : '') + '">' + D.fmtShort(day).split('/')[1] + '</span>' + (h ? '<span class="dl">' + esc(h) + '</span>' : isBlk ? '<span class="dl">경기 없음</span>' : isRest && !out ? '<span class="dl">휴식</span>' : '') + '</div>';
      }
      for (const sl of d.slots) {
        const a = sl.days[0], b = sl.days[sl.days.length - 1];
        if (b < w || a > w + 6) continue;
        const c0 = Math.max(a, w) - w, c1 = Math.min(b, w + 6) - w;
        const inMonth = sl.days.some((x) => x >= first && x <= last);
        const sv = vb.bySlot.get(sl.index) || [];
        const ms = d.bySlot[sl.index];
        s += '<div class="cal-slot' + (inMonth ? '' : ' out') + (sv.length ? ' is-viol' : '') + (u.flashSlot === sl.index ? ' flash' : '') + '" id="slot-' + sl.index + '" style="grid-column:' + (c0 + 1) + ' / ' + (c1 + 2) + '" data-slot="' + sl.index + '">';
        if (sv.length) s += '<span class="cal-sv" title="이 슬롯에 Hard 위반">' + R.icon('block') + Array.from(new Set(sv.map((v) => v.code))).join(' ') + '</span>';
        s += ms.map((m) => chip(m, d, vb)).join('');
        if (ms.length < 5) s += '<div class="cc-gap">빈 자리 ' + (5 - ms.length) + '</div>';
        s += '</div>';
      }
      s += '</div>';
    }
    return s + '</div>';
  }
  function countMonth(mo, d) {
    const n = d.slots.filter((s) => s.month === mo).length;
    return '슬롯 ' + n;
  }
  function teamFilterBar() {
    const st = R.state();
    return '<div class="tf" role="group" aria-label="구단 필터"><span class="flabel">구단</span><button class="tfc' + (u.teamFilter.size ? '' : ' is-on') + '" data-act="tf-all">전체</button>' +
      st.teams.map((t) => '<button class="tfc' + (u.teamFilter.has(t.name) ? ' is-on' : '') + '" data-act="tf" data-team="' + esc(t.name) + '" aria-pressed="' + u.teamFilter.has(t.name) + '"><i style="background:' + esc(t.color) + '"></i>' + esc(t.name) + '</button>').join('') + '</div>';
  }
  function monthNav() {
    const cm = curMonth();
    const two = twoMonths();
    return '<div class="seg mseg" role="tablist" aria-label="월">' + MONTHS.map((mo) => {
      const on = mo === cm || (two && mo === cm + 1);
      return '<button role="tab" aria-selected="' + on + '" class="' + (on ? 'is-on' : '') + '" data-act="month" data-mo="' + mo + '">' + mo + '월</button>';
    }).join('') + '</div>';
  }
  function legend() {
    return '<div class="legend cal-legend"><span><i class="lg lg-home"></i>홈(필터 1구단)</span><span><i class="lg lg-away"></i>원정</span><span><i class="lg lg-viol"></i>' + R.icon('block') + ' 위반 포함</span><span>' + R.icon('pin') + ' 고정</span><span class="muted">색 막대: 왼쪽 원정 · 오른쪽 홈 구단</span></div>';
  }
  function snapTools() {
    const st = R.store;
    return '<button class="btn btn-sm undo-lbl" data-act="undo" ' + (st.canUndo() ? '' : 'disabled') + ' title="Ctrl+Z">' + R.icon('undo') + (st.canUndo() ? '<span class="ell">실행 취소: ' + esc(st.undoLabel()) + '</span>' : '실행 취소') + '</button>' +
      '<button class="btn btn-sm" data-act="menu" data-menu="snap" aria-haspopup="true">스냅샷 ' + R.state().snapshots.length + R.icon('chevD', 'sm') + '</button>';
  }
  function pool(d) {
    if (!R.feature('M8')) return '';
    const items = d.pool;
    return '<div class="pool' + (items.length ? ' has' : '') + '"><span class="pool-h"><b>미배정 풀</b><span class="cnt">' + items.length + '</span></span>' +
      (items.length ? '<div class="pool-items">' + items.map((m) => chip(m, d, violationsBy(d))).join('') + '</div>' : '<span class="hint">비어 있음 · 시리즈 상세에서 뺄 수 있습니다</span>') + '</div>';
  }

  function calendarLeft(d) {
    const vb = violationsBy(d);
    const cm = curMonth();
    const months = twoMonths() ? [cm, cm + 1] : [cm];
    return R.pane({
      cls: 'pane-cal', title: '시즌 캘린더', sub: monthNav(), sk: 'cal',
      tools: snapTools(),
      bar: teamFilterBar(),
      body: '<div class="cal' + (months.length > 1 ? ' two' : '') + '">' + months.map((mo) => month(mo, d, vb)).join('') + '</div>',
      foot: pool(d) + legend()
    });
  }

  // ───────── 오른쪽: 위반 목록 + 시리즈 상세 ─────────
  function violationsPane(d) {
    const vs = d.ex.violations;
    let body;
    if (!vs.length) body = '<div class="allclear">' + R.icon('ok') + '<div><b>Hard 위반 없음</b><p class="hint">편성 가능한 일정입니다. ④ 품질·배포에서 공정성을 확인하세요.</p></div></div>';
    else {
      const groups = new Map();
      for (const v of vs) { if (!groups.has(v.code)) groups.set(v.code, []); groups.get(v.code).push(v); }
      body = '<ul class="vlist">';
      for (const [code, list] of groups) {
        body += '<li class="vgroup"><div class="vg-h"><span class="vcode">' + esc(code) + '</span><span>' + esc(list[0].label) + '</span><span class="cnt">' + list.length + '건</span></div><ul>';
        for (const v of list) body += '<li><button class="vitem' + (u.selViol === v.id ? ' is-on' : '') + '" data-act="viol" data-id="' + v.id + '">' + R.icon('block', 'vi') + '<span class="vmsg">' + esc(v.message) + '</span>' + (v.virtual ? R.virtual() : '') + '<span class="vgo">' + R.icon('chevR') + '</span></button></li>';
        body += '</ul></li>';
      }
      body += '</ul>';
    }
    return R.pane({ cls: 'pane-viol', title: '위반 목록', kicker: '즉시 재채점', live: true, sub: vs.length ? '누르면 캘린더의 해당 슬롯으로 이동' : '', tools: vs.length ? R.st('block', 'Hard ' + vs.length) : R.st('ok', '0건'), body, sk: 'viol' });
  }

  function candidates(m) {
    const d = R.derived();
    const st = R.state();
    const before = Sc.flat(d.ex.score);
    const plan = Int32Array.from(d.plan);
    const len = st.matches[m].consecutive;
    const from = plan[m];
    const out = [];
    const buf = new Array(7);
    const sumKm = () => { let t = 0; for (let i = 0; i < d.ctx.N; i++) t += d.ctx.distTenths[i]; return t; };
    Sc.evaluate(d.ctx, plan, buf);
    const baseTenths = sumKm();
    for (const sl of d.slots) {
      if (sl.index === from || sl.consecutive !== len) continue;
      let best = null;
      if (from < 0) {
        plan[m] = sl.index;
        best = { slot: sl.index, with: null, after: Sc.evaluate(d.ctx, plan, buf).slice(), tenths: sumKm() };
        plan[m] = from;
      } else {
        for (const k of d.bySlot[sl.index]) {
          if (st.matches[k].pinned || k === m) continue;
          plan[m] = sl.index; plan[k] = from;
          const after = Sc.evaluate(d.ctx, plan, buf).slice();
          const tenths = sumKm();
          plan[m] = from; plan[k] = sl.index;
          if (!best || Sc.compare(after, best.after) > 0) best = { slot: sl.index, with: k, after, tenths };
        }
      }
      if (best) out.push(best);
    }
    out.sort((a, b) => Sc.compare(b.after, a.after));
    return out.slice(0, 6).map((c) => Object.assign(c, {
      hardDelta: (c.after[0] + c.after[1]) - (before[0] + before[1]),
      kmDelta: (baseTenths - c.tenths) / 10,
      better: Sc.compare(c.after, before) > 0
    }));
  }
  R.swapCandidates = candidates;

  function detailPane(d) {
    const st = R.state();
    const m = u.sel;
    if (m == null || !st.matches[m]) {
      return R.pane({ cls: 'pane-detail', title: '시리즈 상세', kicker: '선택', body: '<div class="pick-hint">' + R.icon('chevL') + '<div><b>캘린더에서 시리즈를 누르세요</b><p class="hint">상세, 고정(핀), 교환 후보와 점수 변화(Δ)가 여기에 나옵니다. 위반 목록을 눌러도 됩니다.</p></div></div>' });
    }
    const x = st.matches[m];
    const s = d.plan[m];
    const sl = s >= 0 ? d.slots[s] : null;
    const vb = violationsBy(d);
    const vs = vb.byMatch.get(m) || [];
    let body = '<div class="sd-match">' + R.team(x.away, { strong: true }) + '<span class="at">@</span>' + R.team(x.home, { strong: true }) + '</div>';
    body += '<div class="sd-meta">' + (sl ? esc(R.fmt.range(sl.days[0], sl.days[sl.days.length - 1])) + ' · ' + sl.consecutive + '연전' + (sl.weekend ? ' · 주말' : '') + ' · 휴일가중치 ' + sl.holiday : '<b>미배정</b>') + ' · ' + esc(R.shortStadium(R.stadiumOf(x.home))) + '</div>';
    if (vs.length) body += '<div class="sd-flag">' + R.icon('block') + '<span>' + vs.map((v) => esc(v.code)).join(', ') + ' 위반에 포함</span><button class="lnk" data-act="viol" data-id="' + vs[0].id + '">위반 목록에서 보기</button></div>';
    else if (sl) body += '<div class="sd-flag ok">' + R.icon('ok') + '<span>이 시리즈에 걸린 Hard 위반 없음</span></div>';
    body += '<div class="sd-actions"><label class="sw"><input type="checkbox" data-in="pin" data-m="' + m + '"' + (x.pinned ? ' checked' : '') + (R.locked() ? ' disabled' : '') + '><span class="tr"></span><span>' + R.icon('pin') + ' 고정(핀)' + (x.eventId ? ' <span class="hint">· 개막전 이벤트</span>' : '') + '</span></label>' +
      (R.feature('M8') && sl ? '<button class="btn btn-sm" data-act="to-pool" data-m="' + m + '">미배정 풀로</button>' : '') + '</div>';
    if (R.feature('M2')) {
      if (x.pinned) body += '<p class="hint sd-note">고정된 시리즈는 옮기지 않습니다. 고정을 풀면 교환 후보가 나옵니다.</p>';
      else {
        const cs = candidates(m);
        body += '<div class="sect-h sd-ch"><h3>' + (sl ? '교환 후보' : '배정 후보') + '</h3><span class="kicker">Δ 미리보기</span><span class="hint">같은 연전 슬롯 · 좋은 순</span></div><ul class="cands">';
        for (const c of cs) {
          const tsl = d.slots[c.slot];
          body += '<li class="cand' + (c.better ? ' good' : '') + '"><div class="cand-l"><b>' + esc(tsl.label) + '</b><span class="hint">' + (c.with != null ? '↔ ' + esc(R.matchLabel(c.with)) : '빈 자리로 이동') + '</span></div>' +
            '<span class="dchip ' + (c.hardDelta > 0 ? 'good' : c.hardDelta < 0 ? 'bad' : '') + '">' + R.icon(c.hardDelta > 0 ? 'ok' : c.hardDelta < 0 ? 'block' : 'todo') + 'Hard ' + (c.hardDelta > 0 ? '−' + c.hardDelta : c.hardDelta < 0 ? '+' + (-c.hardDelta) : '±0') + '</span>' +
            '<span class="dkm">' + (c.kmDelta > 0 ? '−' : c.kmDelta < 0 ? '+' : '±') + R.fmt.km(Math.abs(c.kmDelta)) + 'km</span>' +
            '<button class="btn btn-sm" data-act="swap" data-m="' + m + '" data-slot="' + c.slot + '" data-with="' + (c.with == null ? '' : c.with) + '"' + (R.locked() ? ' disabled' : '') + '>' + R.icon('swap') + (c.with != null ? '교환' : '이동') + '</button></li>';
        }
        body += '</ul><p class="hint">Hard는 위반 건수 변화(−는 줄어듦), km는 리그 총 이동거리 변화입니다.</p>';
      }
    }
    return R.pane({ cls: 'pane-detail', title: '시리즈 상세', kicker: '선택', sub: '#' + (m + 1), body, sk: 'detail', tools: '<button class="ibtn" data-act="desel" aria-label="선택 해제" title="선택 해제">×</button>' });
  }

  function right(d) { return '<div class="rstack">' + violationsPane(d) + detailPane(d) + '</div>'; }

  // ───────── 슬롯 목록 ─────────
  function listLeft(d) {
    const st = R.state();
    const vb = violationsBy(d);
    let rows = '';
    d.slots.forEach((sl) => {
      const sv = vb.bySlot.get(sl.index) || [];
      rows += '<tr class="' + (sv.length ? 'err' : '') + (u.flashSlot === sl.index ? ' flash' : '') + '" id="lrow-' + sl.index + '"><td class="rowno n">' + (sl.index + 1) + '</td><td>' + esc(R.fmt.range(sl.days[0], sl.days[sl.days.length - 1])) + '</td><td class="n">' + sl.consecutive + '</td><td>' + (sl.weekend ? '주말' : '주중') + '</td><td class="n">' + sl.holiday + '</td><td class="ml">' +
        d.bySlot[sl.index].map((m) => '<button class="mini' + (u.sel === m ? ' is-sel' : '') + ((vb.byMatch.get(m) || []).length ? ' is-viol' : '') + '" data-act="sel" data-m="' + m + '">' + esc(st.matches[m].away) + '@' + esc(st.matches[m].home) + (st.matches[m].pinned ? R.icon('pin', 'ccpin') : '') + '</button>').join('') + '</td><td>' + (sv.length ? R.st('block', Array.from(new Set(sv.map((v) => v.code))).join(' ')) : R.st('ok', '정상')) + '</td></tr>';
    });
    return R.pane({ title: '슬롯 목록', sub: st.calendar.length + '개 슬롯 · 시리즈를 누르면 오른쪽에 상세', tools: snapTools(), sk: 'slist', flush: true,
      body: '<table class="tbl"><thead><tr><th class="n">#</th><th>기간</th><th class="n">연전</th><th>구분</th><th class="n">휴일가중치</th><th>대진 (원정@홈)</th><th>상태</th></tr></thead><tbody>' + rows + '</tbody></table>', foot: pool(d) });
  }

  // ───────── 구단 × 슬롯 (FR-V6, 기본 꺼짐) ─────────
  function matrixLeft(d) {
    const st = R.state();
    const vb = violationsBy(d);
    let head = '<tr><th class="sticky-c">구단</th>' + d.slots.map((sl) => '<th class="n mx-h' + ((vb.bySlot.get(sl.index) || []).length ? ' bad' : '') + '">' + D.fmtShort(sl.day) + '</th>').join('') + '</tr>';
    let rows = '';
    st.teams.forEach((t) => {
      rows += '<tr><th class="sticky-c">' + R.team(t.name, { strong: true }) + '</th>';
      d.slots.forEach((sl) => {
        const m = d.bySlot[sl.index].find((k) => st.matches[k].home === t.name || st.matches[k].away === t.name);
        if (m == null) { rows += '<td class="mx">–</td>'; return; }
        const x = st.matches[m];
        const home = x.home === t.name;
        rows += '<td class="mx ' + (home ? 'mx-home' : 'mx-away') + ((vb.byMatch.get(m) || []).length ? ' mx-viol' : '') + (u.sel === m ? ' is-sel' : '') + '"><button data-act="sel" data-m="' + m + '" title="' + esc(x.away + ' @ ' + x.home) + '">' + (home ? 'H' : 'A') + '<small>' + esc(home ? x.away : x.home) + '</small></button></td>';
      });
      rows += '</tr>';
    });
    return R.pane({ title: '구단 × 슬롯', sub: 'H 홈 · A 원정 · 칸 아래는 상대', sk: 'mx', flush: true, body: '<div class="mxwrap" data-sk="mxw"><table class="tbl mxt"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' });
  }

  R.screens['w3-calendar'] = { cls: 'wide-left s3', left: calendarLeft, right, after: afterCal, subtitle: () => '' };
  R.screens['w3-list'] = { cls: 'wide-left s3', left: listLeft, right, after: afterCal };
  R.screens['w3-matrix'] = { cls: 'wide-left s3', left: matrixLeft, right, after: afterCal };

  function afterCal() {
    if (u.scrollTo != null) {
      const el = document.getElementById('slot-' + u.scrollTo) || document.getElementById('lrow-' + u.scrollTo);
      if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' });
      u.scrollTo = null;
    }
    if (u.flashSlot != null) { const f = u.flashSlot; setTimeout(() => { if (u.flashSlot === f) { u.flashSlot = null; } }, 1400); }
  }

  // ───────── 스냅샷 팝오버 (FR-M7) ─────────
  R.menus.snap = function () {
    const st = R.state();
    const fmtT = (iso) => { const t = new Date(iso); return (t.getMonth() + 1) + '/' + t.getDate() + ' ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); };
    return '<div class="snap"><div class="menu-h">스냅샷 저장·복원</div><div class="snap-new"><input class="inp" id="snapname" placeholder="이름 (예: 위반 정리 후)" data-key="snap"><button class="btn btn-sm btn-primary" data-act="snap-save">현재 저장</button></div><ul class="snap-list">' +
      st.snapshots.slice().reverse().map((s) => {
        const ex = KBO.Score.explain(R.derived().ctx, KBO.Score.planArrayFrom({ matches: st.matches, calendar: st.calendar, plan: s.plan }), st);
        return '<li><div><b>' + esc(s.name) + '</b><span class="hint">' + fmtT(s.createdAt) + ' · ' + (ex.violations.length ? 'Hard ' + ex.violations.length : '편성 가능') + '</span></div><button class="btn btn-sm" data-act="snap-restore" data-id="' + esc(s.id) + '">복원</button></li>';
      }).join('') + '</ul><p class="hint">복원도 실행 취소할 수 있습니다.</p></div>';
  };

  // ───────── 동작 ─────────
  Object.assign(R.act, {
    sel(el) { const m = +el.getAttribute('data-m'); u.sel = u.sel === m ? null : m; u.selViol = null; R.render(); },
    desel() { u.sel = null; R.render(); },
    tf(el) { const t = el.getAttribute('data-team'); if (u.teamFilter.has(t)) u.teamFilter.delete(t); else u.teamFilter.add(t); R.render(); },
    'tf-all'() { u.teamFilter.clear(); R.render(); },
    month(el) { let mo = +el.getAttribute('data-mo'); if (twoMonths() && mo === 8) mo = 7; u.month = mo; R.render(); },
    viol(el) {
      const v = R.derived().ex.violations.find((x) => x.id === el.getAttribute('data-id'));
      if (!v) return;
      u.selViol = v.id;
      const slot = v.slot;
      if (slot != null && slot >= 0) { const mo = R.derived().slots[slot].month; const cm = curMonth(); if (!(mo === cm || (twoMonths() && mo === cm + 1))) u.month = twoMonths() && mo === 8 ? 7 : mo; u.flashSlot = slot; u.scrollTo = slot; }
      if (v.matches && v.matches.length) u.sel = v.matches[0];
      if (R.ui.view !== 'wizard' || R.ui.step !== 3) R.go({ step: 3 }); else R.render();
    },
    swap(el) {
      const m = +el.getAttribute('data-m'), slot = +el.getAttribute('data-slot');
      const w = el.getAttribute('data-with');
      const st = R.state();
      const from = R.derived().plan[m];
      if (w !== '' && w != null) {
        const k = +w;
        R.commit('교환: ' + R.matchLabel(m) + ' ↔ ' + R.matchLabel(k), (s) => { s.plan[m].calendar = slot; s.plan[k].calendar = from; }, { tags: ['plan'] });
      } else R.commit('이동: ' + R.matchLabel(m), (s) => { s.plan[m].calendar = slot; }, { tags: ['plan'] });
      u.flashSlot = slot;
      R.toast((w ? '교환했습니다' : '옮겼습니다') + ' — 점수와 위반을 다시 계산했습니다. (Ctrl+Z로 되돌리기)', 'ok');
      void st;
    },
    'to-pool'(el) { const m = +el.getAttribute('data-m'); R.commit('미배정 풀로: ' + R.matchLabel(m), (s) => { s.plan[m].calendar = -1; }, { tags: ['plan'] }); },
    'snap-save'() {
      const inp = document.getElementById('snapname');
      const name = (inp && inp.value.trim()) || ('스냅샷 ' + (R.state().snapshots.length + 1));
      R.store.addSnapshot(name);
      R.ui.menu = null;
      R.toast("스냅샷 '" + name + "'을 저장했습니다.", 'ok');
    },
    'snap-restore'(el) {
      const id = el.getAttribute('data-id');
      if (R.locked()) return R.toast('엔진 실행 중에는 복원할 수 없습니다.', 'warn');
      const res = R.store.restoreSnapshot(id);
      R.ui.menu = null;
      if (res && res.ok === false) R.toast(res.error, 'bad'); else R.toast('스냅샷을 복원했습니다. 실행 취소로 되돌릴 수 있습니다.', 'ok');
      R.render();
    }
  });
  R.keys.snap = (el, e) => { if (e.key === 'Enter') R.act['snap-save'](); };
  R.inputs.pin = (el) => {
    const m = +el.getAttribute('data-m');
    const v = el.checked;
    R.commit((v ? '고정: ' : '고정 해제: ') + R.matchLabel(m), (s) => { s.matches[m].pinned = v; }, { tags: ['pins'] });
  };
  R.demo = R.demo || {};
  R.demo.sel = (v) => { u.sel = +v; const s = R.derived().plan[+v]; if (s >= 0) u.month = Math.min(R.derived().slots[s].month, twoMonths() ? 7 : 8); };
  R.demo.team = (v) => { u.teamFilter = new Set(v.split(',')); };
  R.demo.month = (v) => { u.month = +v; };
  R.demo.viol = (v) => { const vs = R.derived().ex.violations; const x = vs[+v] || vs[0]; if (x) { u.selViol = x.id; if (x.matches && x.matches.length) u.sel = x.matches[0]; } };
})();
