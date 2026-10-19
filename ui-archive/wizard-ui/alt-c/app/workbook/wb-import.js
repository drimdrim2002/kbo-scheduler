/*
 * alt-c 편성 워크북 — 가져오기 미리보기 (목업).
 * .xlsx 업로드·구글 시트 연결·규칙 초안은 미리 준비한 결과(오류 2건 포함)로 미리보기를 띄운다.
 * 시트별 +/~/− 건수, 오류·경고(시트·행·열, 고칠 값), 시트 선택, 배정 초기화 확인, 적용(스냅샷 + 실행 취소 1단계).
 */
(function () {
  'use strict';
  const WB = window.WB;
  const KBO = window.KBO;
  const D = KBO.Dates;
  const esc = WB.esc, icon = WB.icon;
  const I = WB.Import = {};

  function mockSheets(source) {
    if (source === 'rule-slots') {
      const g = WB.Book.regenSlots();
      const cur = WB.book.slots;
      const ck = new Set(cur.map((s) => s.start + '|' + s.games));
      const gk = new Set((g.slots || []).map((s) => s.datetime.slice(0, 10) + '|' + s.consecutive));
      let add = 0, del = 0; const diff = [];
      for (const k of gk) if (!ck.has(k)) { add++; diff.push(['+', D.fmtDate(k.split('|')[0]) + ' ' + k.split('|')[1] + '연전']); }
      for (const k of ck) if (!gk.has(k)) { del++; diff.push(['−', D.fmtDate(k.split('|')[0]) + ' ' + k.split('|')[1] + '연전']); }
      const auto = cur.filter((s) => s.weekend === '' || s.holiday === '').length;
      return [{ id: 'slots', rows: (g.slots || []).length, add, chg: auto, del, errors: [], warns: (g.warnings || []).map((w) => ({ addr: '슬롯', msg: w.message })).concat(auto ? [{ addr: '슬롯 · 주말·휴일가중치', msg: '빈 칸 ' + auto + '행을 규칙 값으로 채웁니다(현재 "자동" 표시와 같은 값).' }] : []), diff: diff.length ? diff : [['=', '날짜·연전 수가 현재 시트와 같습니다 (' + (g.slots || []).length + '개)']], on: true }];
    }
    if (source === 'rule-series') {
      return [{ id: 'series', rows: 225, add: 0, chg: 38, del: 0, errors: [], warns: [{ addr: '시리즈', msg: '구단쌍 9:6 홈/원정 분배를 다시 계산해 38행의 홈·원정이 바뀝니다.' }, { addr: '시리즈', msg: '연전 분포 2연전 5 · 3연전 215 · 4연전 5 — 슬롯 분포와 일치합니다.' }], diff: [['~', '12행  LG @ 롯데 → 롯데 @ LG'], ['~', '31행  KIA @ 삼성 → 삼성 @ KIA'], ['~', '… 36행 더']], on: true }];
    }
    const fixed = I.state && I.state.fixedSeries;
    const fixedEv = I.state && I.state.fixedEvent;
    return [
      { id: 'slots', rows: 45, add: 0, chg: 2, del: 0, errors: [], warns: [{ addr: '슬롯 19행·20행', msg: '정렬되어 있지 않아 시작일 순으로 정렬합니다.' }], diff: [['~', '14행 메모  "" → "어린이날 3연전 뒤 휴식 확인"'], ['~', '27행 휴일가중치  2 → (빈 칸, 자동 2)']], on: true },
      { id: 'series', rows: 225, add: 1, chg: 3, del: 1, errors: fixed ? [] : [{ addr: '시리즈 12행 B열(원정)', msg: "알 수 없는 구단 'LGG' — 'LG'인가요?", fix: 'series' }], warns: [{ addr: '시리즈 F열', msg: "모르는 열 '비고2'는 무시합니다." }], diff: [['+', '226행  NC @ 키움 3연전'], ['−', '88행  키움 @ NC 3연전'], ['~', '12행 원정  ' + (fixed ? "'LGG' → 'LG' (제안 적용)" : "'LG' → 'LGG'")], ['~', '40행 메모 · 57행 메모']], on: !!fixed },
      { id: 'holidays', rows: 11, add: 1, chg: 0, del: 0, errors: [], warns: [], diff: [['+', '12행  6/3(화) 임시공휴일 (제21대 대통령 선거)']], on: true },
      { id: 'rest', rows: 1, add: 0, chg: 0, del: 0, errors: [], warns: [], diff: [['=', '변경 없음']], on: false },
      { id: 'blackouts', rows: 2, add: 0, chg: 0, del: 0, errors: [], warns: [], diff: [['=', '변경 없음']], on: false },
      { id: 'events', rows: 7, add: 1, chg: 0, del: 0, errors: fixedEv ? [] : [{ addr: '이벤트 8행 C열(날짜)', msg: "7/14(월)은 어느 슬롯에도 없습니다 — 경기없는기간 '올스타 브레이크'(7/11~7/16)와 겹칩니다. 7/18(금)인가요?", fix: 'event' }], warns: [], diff: [['+', '8행  광복절 매치 · 사용자정의 · ' + (fixedEv ? '7/18(금)' : '7/14(월)') + ' · 대진 KIA @ 롯데']], on: !!fixedEv },
      { id: 'guide', name: '안내', rows: 24, ignored: true, errors: [], warns: [], diff: [['=', '설명용 시트 — 가져올 때 무시']], on: false }
    ];
  }

  I.pickXlsx = function () { I.open({ source: 'xlsx' }); };

  I.gsheet = function () {
    const url = WB.LS.get('gsheet-url') || 'https://docs.google.com/spreadsheets/d/1kBo2025ScheduleInputSample7Qx/edit#gid=0';
    WB.modal({
      id: 'gsheet', title: icon('link') + ' 구글 시트 연결 ' + WB.mock('목업'), width: 640,
      body: '<div class="field" style="grid-template-columns:90px 1fr"><span>공유 링크</span><input class="inp mono" id="gsUrl" value="' + esc(url) + '" autofocus></div>' +
        '<div class="field" style="grid-template-columns:90px 1fr"><span>문서 ID</span><span class="mono" id="gsId">' + esc((/\/d\/([^/]+)/.exec(url) || [])[1] || '-') + '</span></div>' +
        '<div class="field" style="grid-template-columns:90px 1fr"><span>읽을 탭</span><span>' + WB.Book.IMPORT_SHEETS.map((s) => '<span class="chip on" style="margin:0 3px 3px 0;height:20px">' + esc(WB.Book.DEFS[s].name) + '</span>').join('') + '</span></div>' +
        '<div class="callout info">' + icon('info') + ' <b>읽기 전용</b>입니다. "링크가 있는 모든 사용자 보기"로 공유한 시트만 읽습니다. 링크를 아는 누구나 시트를 볼 수 있다는 점에 주의하세요. URL은 이 브라우저에만 저장됩니다.</div>' +
        '<div class="note">탭별로 <span class="mono">…/gviz/tq?tqx=out:csv&amp;sheet={탭}</span> CSV를 받습니다. 자동 동기화는 하지 않으며, 다시 불러오려면 이 창을 다시 엽니다.</div>',
      foot: '<span class="note">마지막 연결: 10/17(금) 18:40</span><span class="grow"></span><button class="btn box" data-close>취소</button><button class="btn pri" id="gsGo">' + icon('down') + '불러오기</button>',
      onMount: (m) => {
        m.querySelector('#gsUrl').addEventListener('input', (e) => { m.querySelector('#gsId').textContent = (/\/d\/([^/]+)/.exec(e.target.value) || [])[1] || '문서 ID를 찾을 수 없습니다'; });
        m.querySelector('#gsGo').addEventListener('click', () => { WB.LS.set('gsheet-url', m.querySelector('#gsUrl').value); I.open({ source: 'gsheet' }); });
      }
    });
    WB.syncHash();
  };

  I.open = function (o) {
    I.state = I.state && I.state.source === o.source ? I.state : { source: o.source, fixedSeries: !!o.fixed, fixedEvent: !!o.fixed, confirm: !!o.confirm, cur: null, on: null };
    if (o.fixed) { I.state.fixedSeries = true; I.state.fixedEvent = true; }
    if (o.confirm) I.state.confirm = true;
    render();
  };

  function render() {
    const st = I.state;
    const sheets = mockSheets(st.source);
    if (!st.on) { st.on = {}; sheets.forEach((s) => { st.on[s.id] = s.on; }); }
    sheets.forEach((s) => { if (s.errors.length) st.on[s.id] = false; });
    if (!st.cur) st.cur = sheets[0].id;
    const src = { xlsx: '.xlsx 업로드 · 2025_일정입력_v4.xlsx (48KB)', gsheet: '구글 시트 · 2025 일정 입력 (공유 링크)', 'rule-slots': '규칙으로 초안 만들기 · 슬롯 (§5.2.1)', 'rule-series': '구단쌍 규칙으로 만들기 · 시리즈 (FR-S7)' }[st.source];
    const nm = (s) => s.name || WB.Book.DEFS[s.id].name;
    const allErr = [].concat(...sheets.map((s) => s.errors.map((e) => Object.assign({ sheet: s.id, level: 'error' }, e))));
    const allWarn = [].concat(...sheets.map((s) => s.warns.map((e) => Object.assign({ sheet: s.id, level: 'warn' }, e))));
    const chosen = sheets.filter((s) => st.on[s.id]);
    const resets = chosen.some((s) => s.id === 'slots' || s.id === 'series');
    let tbl = '<table class="g imp"><colgroup><col style="width:34px"><col style="width:140px"><col><col><col><col><col><col><col style="width:104px"></colgroup><thead><tr class="fh"><th style="width:34px"></th><th>시트</th><th class="n">행</th><th class="n">+ 추가</th><th class="n">~ 변경</th><th class="n">− 삭제</th><th class="n">오류</th><th class="n">경고</th><th>상태</th></tr></thead><tbody>';
    for (const s of sheets) {
      const none = !s.ignored && !s.add && !s.chg && !s.del;
      const status = s.ignored ? WB.st('todo', '무시') : s.errors.length ? WB.st('block', '적용 불가') : none ? WB.st('todo', '변경 없음') : st.on[s.id] ? WB.st('ok', '적용') : WB.st('todo', '건너뜀');
      tbl += '<tr data-imp="' + s.id + '" class="' + (st.cur === s.id ? 'r-hl' : '') + '"><td class="c"><input type="checkbox" aria-label="' + esc(nm(s)) + ' 적용" data-on="' + s.id + '"' + (st.on[s.id] ? ' checked' : '') + (s.errors.length || s.ignored || none ? ' disabled' : '') + '></td>' +
        '<td>' + icon('sheet') + ' ' + esc(nm(s)) + '</td><td class="n">' + s.rows + '</td><td class="n">' + (s.ignored ? '' : '+' + s.add) + '</td><td class="n">' + (s.ignored ? '' : '~' + s.chg) + '</td><td class="n">' + (s.ignored ? '' : '−' + s.del) + '</td>' +
        '<td class="n' + (s.errors.length ? ' cf-bad' : '') + '">' + (s.errors.length ? icon('block') + ' ' + s.errors.length : '0') + '</td><td class="n' + (s.warns.length ? ' cf-warn' : '') + '">' + s.warns.length + '</td><td>' + status + '</td></tr>';
    }
    tbl += '</tbody></table>';
    const cur = sheets.find((s) => s.id === st.cur) || sheets[0];
    const diff = '<div class="ph">' + esc(nm(cur)) + ' 변경 미리보기<small>시트 단위 전체 교체 · 표시는 이해를 돕는 비교</small></div><div class="diff">' + cur.diff.map((d) => '<div class="dl ' + (d[0] === '+' ? 'a' : d[0] === '−' ? 'd' : d[0] === '~' ? 'c' : '') + '"><b>' + d[0] + '</b> ' + esc(d[1]) + '</div>').join('') + '</div>';
    const issues = allErr.concat(allWarn).map((x) => '<li class="' + (x.level) + '"><span class="ii ' + x.level + '">' + icon(x.level === 'error' ? 'block' : 'warn') + '</span><span><span class="ad">' + esc(x.addr) + '</span><span class="tx">' + esc(x.msg) + '</span>' +
      (x.fix ? '<button class="btn sm box fixb" data-ifix="' + x.fix + '">' + icon('wand') + (x.fix === 'series' ? "'LG'(으)로 고치기" : '7/18(금)로 고치기') + '</button>' : '') + '</span></li>').join('');
    const body = '<div class="impgrid"><div class="impl">' + tbl + diff + '</div><div class="impr"><div class="ph">오류 ' + allErr.length + ' · 경고 ' + allWarn.length + '<small>시트 · 행 · 열(머리글)</small></div><ul class="iss boxed">' + (issues || '<li class="empty-note">문제 없음</li>') + '</ul>' +
      '<div class="note" style="margin-top:6px">오류가 있는 시트는 적용할 수 없습니다. 제안 값으로 고치거나 원본 파일을 고쳐 다시 올리세요. 파일에 없는 시트는 바꾸지 않습니다.</div></div></div>';
    const foot = (resets ? '<label class="chk resetc' + (st.confirm ? ' ok' : '') + '"><input type="checkbox" id="impConfirm"' + (st.confirm ? ' checked' : '') + '>' + icon('warn') + ' <b>현재 배정이 초기화됩니다</b> — 슬롯·시리즈가 바뀌면 ③ 결과(시리즈 225개의 슬롯 배정)가 무효가 됩니다. 확인했습니다.</label>' : '<span class="note">' + icon('info') + ' 배정에 영향 없음 (슬롯·시리즈 미포함)</span>') +
      '<span class="grow"></span><span class="note" title="FR-X5">적용 직전 상태를 스냅샷 <b>가져오기 전 — ' + nowLabel() + '</b>으로 저장 · 실행 취소 1단계</span>' +
      '<button class="btn box" data-close>취소</button><button class="btn pri" id="impApply"' + (!chosen.length || (resets && !st.confirm) ? ' disabled' : '') + '>' + icon('ok') + '선택한 시트 적용 (' + chosen.length + ')</button>';
    WB.modal({
      id: 'import', title: icon('up') + ' 가져오기 미리보기 ' + WB.mock('목업'), width: 1060, head: '<span class="note" style="margin-right:8px">' + esc(src) + '</span>', body, foot,
      onMount: (m) => {
        m.querySelectorAll('[data-imp]').forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('input')) return; st.cur = tr.dataset.imp; render(); }));
        m.querySelectorAll('[data-on]').forEach((cb) => cb.addEventListener('change', () => { st.on[cb.dataset.on] = cb.checked; render(); }));
        m.querySelectorAll('[data-ifix]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.ifix === 'series') { st.fixedSeries = true; st.on.series = true; } else { st.fixedEvent = true; st.on.events = true; } render(); WB.toast('제안 값으로 고쳤습니다 — 이제 이 시트를 적용할 수 있습니다.', 'ok'); }));
        const c = m.querySelector('#impConfirm'); if (c) c.addEventListener('change', () => { st.confirm = c.checked; render(); });
        m.querySelector('#impApply').addEventListener('click', () => apply(chosen, resets));
      },
      onClose: () => { I.state = null; }
    });
    WB.syncHash();
  }
  function nowLabel() { const d = new Date(); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function apply(chosen, resets) {
    const app = WB.app;
    const before = JSON.stringify(WB.book);
    const label = '가져오기 적용: ' + chosen.map((s) => WB.Book.DEFS[s.id].name).join('·');
    app.saveSnapshot('가져오기 전 — ' + nowLabel());
    const b = WB.book;
    const ids = new Set(chosen.map((s) => s.id));
    const src = I.state.source;
    if (ids.has('slots')) {
      if (src === 'rule-slots') { const g = WB.Book.regenSlots(); b.slots = g.slots.map((s, i) => ({ start: s.datetime.slice(0, 10), games: s.consecutive, weekend: s.weekend, holiday: s.holiday, note: (b.slots[i] || {}).note || '' })); }
      else { if (b.slots[12]) b.slots[12].note = '어린이날 3연전 뒤 휴식 확인'; if (b.slots[25]) b.slots[25].holiday = ''; }
    }
    if (ids.has('series')) { if (b.series[10]) b.series[10].note = '가져옴: 원정 LG 확인'; if (b.series[38]) b.series[38].note = '가져옴'; }
    if (ids.has('holidays')) { b.holidays.push({ date: '2025-06-03', name: '임시공휴일 (대통령 선거)' }); b.holidays.sort((x, y) => (x.date < y.date ? -1 : 1)); }
    if (ids.has('events')) b.events.push({ name: '광복절 매치', type: '사용자정의', date: '2025-07-18', mode: '대진', home: '롯데', away: 'KIA', stadiums: '' });
    WB.Book.changed('slots');
    const after = JSON.stringify(WB.book);
    let storeChanged = false;
    if (resets) {
      const n = app.store.undoStack.length;
      app.store.commit('배정 초기화 (가져오기)', (s) => { s.plan.forEach((p) => { if (!s.matches[p.match].pinned) p.calendar = -1; }); }, { tags: ['plan'] });
      storeChanged = app.store.undoStack.length > n;
    }
    const restore = (json) => { const o = JSON.parse(json); Object.keys(o).forEach((k) => { WB.book[k] = o[k]; }); WB.book._issues = null; };
    WB.pushHist({ label, undo: () => { restore(before); if (storeChanged) app.store.undo(); }, redo: () => { restore(after); if (storeChanged) app.store.redo(); } });
    WB.ui.lastImport = ({ xlsx: '2025_일정입력_v4.xlsx', gsheet: '구글 시트 (공유 링크)', 'rule-slots': '규칙 초안 (슬롯)', 'rule-series': '규칙 초안 (시리즈)' }[src]) + ' · 방금';
    I.state = null;
    WB.closeModal(true);
    WB.go({ step: 1, sheet: chosen[0].id });
    WB.toast(label + (resets ? ' · 배정 초기화됨 — ②에서 다시 실행' : ''), 'ok', { label: '실행 취소', fn: WB.undo });
  }
})();
