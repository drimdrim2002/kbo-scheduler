/*
 * alt-a 편성 스튜디오 — 시즌 운영 (위저드 밖 별도 메뉴)
 * 경기 기록: 왼쪽 날짜 목록 / 가운데 그날 경기 일괄 처리 + 월 미니 달력 / 오른쪽 시즌 진행 현황
 * 재편성은 계획 흐름의 「재편성」 화면(reschedule-view.js, step=9)으로 옮겼다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { Dates, SeasonGames } = KBO;
  const app = () => S.app;
  const REASONS = SeasonGames.REASONS;

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
    if (!date) return S.paneHead('경기 기록', '날짜를 골라 그날 경기를 한 번에 처리합니다.') + '<div class="pane-body"><div class="empty"><b>아직 경기가 없습니다</b>① 데이터 준비에서 연전 기간과 시리즈를 만들고 ② 자동 편성을 돌리면 경기일이 여기에 나옵니다.</div></div>';
    const list = dm.get(date) || [];
    const ds = dayState(list, ref);
    const st = app().state;
    let s = S.paneHead(fmt.date(date) + ' 경기 ' + list.length, '날짜를 골라 그날 경기를 한 번에 처리합니다. 취소는 사유와 함께 경기(일자) 단위로 기록합니다.', S.stat(ds.k === 'bad' ? 'block' : ds.k, ds.t));
    s += '<div class="toolbar"><b class="small">일괄 처리</b><button class="btn sm" data-act="o-bulk" data-status="PLAYED">' + icon('check') + '모두 완료</button>' +
      '<span class="btn-group"><button class="btn sm danger" data-act="o-bulk" data-status="CANCELLED">' + icon('x') + '모두 취소</button></span><select class="select sm" id="bulkReason" aria-label="일괄 취소 사유">' + Object.keys(REASONS).map((k) => '<option value="' + k + '">' + REASONS[k] + '</option>').join('') + '</select>' +
      '<button class="btn sm ghost" data-act="o-bulk" data-status="SCHEDULED">' + icon('undo') + '예정으로</button><span style="margin-left:auto">' + S.undoButtons() + '</span></div>';
    s += '<div class="pane-body" data-sk="o-games"><table class="gtable"><thead><tr><th>대진 (원정 vs 홈)</th><th>구장</th><th>시리즈</th><th>상태</th><th>취소 사유</th></tr></thead><tbody>';
    for (const g of list) {
      const m = st.matches[g.match];
      const overdue = g.status === 'SCHEDULED' && g.date < ref && S.feature('P2');
      s += '<tr class="' + (g.status === 'CANCELLED' ? 'cancel' : '') + (overdue ? ' overdue' : '') + '"><td>' + S.team(g.away) + ' <span class="muted">vs</span> ' + S.team(g.home) + (overdue ? ' <span class="tag" style="color:var(--warn);background:var(--warn-bg);border:1px solid var(--warn-line)">' + icon('warn') + '결과 미입력</span>' : '') + '</td><td class="small">' + esc(g.stadium) + '</td><td class="small muted">' + m.consecutive + '연전 ' + (g.seq + 1) + '일째</td>' +
        '<td><div class="seg">' + ['SCHEDULED', 'PLAYED', 'CANCELLED'].map((k) => '<button class="' + (g.status === k ? 'on' : '') + '" data-act="o-set" data-key="' + esc(g.key) + '" data-status="' + k + '">' + (k === 'PLAYED' ? icon('check') : k === 'CANCELLED' ? icon('x') : icon('todo')) + SeasonGames.STATUS[k] + '</button>').join('') + '</div></td>' +
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
    if (!S.feature('P7')) return { title: '도움말', html: '<div class="insp-sec"><h4>경기 기록</h4><div class="small">완료·취소를 날짜 단위로 기록합니다. 시즌 진행 현황' + (S.dev() ? '(FR-P7)' : '') + '은 설정에서 꺼져 있습니다.</div></div>' };
    const t = app().targets();
    const tot = t.totals;
    const rs = app().state.reschedule;
    const need = tot.remaining + tot.cancelled;
    let s = '<div class="insp-sec"><h4>리그 전체</h4><div class="run-stats" style="grid-template-columns:repeat(4,1fr)"><div><div class="k">완료</div><div class="v">' + tot.played + '</div></div><div><div class="k">취소</div><div class="v" style="color:var(--bad)">' + tot.cancelled + '</div></div><div><div class="k">예정</div><div class="v">' + tot.scheduled + '</div></div><div><div class="k">잔여</div><div class="v">' + tot.remaining + '</div></div></div></div>';
    s += '<div class="insp-sec"><h4>재편성할 경기<span class="r">' + esc(fmt.short(rs.start) + '~' + fmt.short(rs.end)) + '</span></h4><div class="small">취소 ' + tot.cancelled + ' + 잔여 ' + tot.remaining + ' = <b>' + need + '경기</b>. 날짜마다 넣는 일은 새 흐름의 「재편성」 화면에서 합니다.</div></div>';
    s += '<div class="insp-sec"><h4>구단별 소화<span class="r legend"><span><i style="background:var(--navy)"></i>완료</span><span><i style="background:repeating-linear-gradient(135deg,#B3261E 0 2px,#F4C1BC 2px 4px)"></i>취소</span><span><i style="background:#C9D5EA"></i>예정</span></span></h4>';
    for (const b of t.byTeam) {
      const all = b.played + b.cancelled + b.scheduled || 1;
      s += '<div class="prog-row"><span>' + S.team(b.team) + '</span><span class="stack"><i class="p" style="width:' + (b.played / all * 100) + '%"></i><i class="c" style="width:' + (b.cancelled / all * 100) + '%"></i><i class="s" style="width:' + (b.scheduled / all * 100) + '%"></i></span><span class="mono" style="font-size:11px;text-align:right">' + b.played + '·' + b.cancelled + '·' + b.remaining + '</span></div>';
    }
    s += '<div class="small muted" style="margin-top:4px">숫자: 완료·취소·잔여 경기</div></div>';
    return { title: '시즌 진행 현황', html: s };
  }

  S.ops = {
    render() {
      S.wide = window.innerWidth >= 1800; S.tall = window.innerHeight >= 900;
      if (S.ui.ops === 'route' && !S.feature('A6')) S.ui.ops = 'games';
      if (S.ui.ops === 'route') {
        const r = S.route.render();
        return '<div class="stepview no-band">' + S.workspace({ list: r.list, main: r.main, insp: r.insp, inspTitle: r.title, listLabel: '구단 목록', cls: 'ws-route' }) + '</div>';
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
    'o-bulk': (el) => { const r = document.getElementById('bulkReason'); app().setDayStatus(S.ui.opsDate, el.dataset.status, r ? r.value : 'RAIN'); S.toast(fmt.date(S.ui.opsDate) + ' 경기를 일괄 ' + SeasonGames.STATUS[el.dataset.status] + '(으)로 기록했습니다.', 'ok'); },
  });
  S.inputs['o-reason'] = (el) => { const g = gameByKey(el.dataset.key); if (g) app().setGameStatus(g, 'CANCELLED', el.value); };
})();
