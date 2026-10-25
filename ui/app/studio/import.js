/*
 * alt-a 편성 스튜디오 — 가져오기 미리보기 (FR-X1~X5, X9)
 * .xlsx 업로드·구글 시트 연결은 목업: 미리 준비한 결과(오류 2건 포함)를 보여 준다.
 * 보조 생성(규칙으로 초안 만들기)은 실제 생성기 결과와 현재 데이터를 비교한다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { CalendarGen, Dates } = KBO;
  const app = () => S.app;
  const GS_KEY = S.KEY + 'gsheet-url';

  const N = S.SHEET_NAMES;
  /** 파일 안 시트 이름(src)을 키로 바꾼다. 새 이름과 예전 이름(슬롯·휴식예외일·경기없는기간·이벤트)을 모두 받는다. */
  function sheetOf(src, o) {
    const key = S.sheetKeyOf(src);
    return Object.assign({ key: key || src, name: key ? N[key] : src, src }, o);
  }
  // 시안 파일은 예전 양식과 새 양식이 섞여 있다: 「슬롯」·「휴식예외일」은 예전 이름, 나머지는 새 이름.
  function mockSheets() {
    const st = app().state;
    return [
      sheetOf('슬롯', { rows: st.calendar.length, add: 0, chg: 2, del: 0, resetsPlan: true, errors: [],
        warnings: [{ loc: N.slots + ' · 엑셀 20번째 줄 · 휴일 등급', why: '비어 있어 규칙대로 2로 채웁니다.', fix: null }, { loc: N.slots + ' · 엑셀 31번째 줄', why: '모르는 항목 「비고2」는 읽지 않습니다.', fix: null }] }),
      sheetOf('시리즈', { rows: st.matches.length, add: 1, chg: 3, del: 1, resetsPlan: true,
        errors: [{ loc: N.series + ' · 엑셀 12번째 줄 · 원정', why: "알 수 없는 구단 'LGG' — 'LG'인가요?", fix: 'LG' }], warnings: [] }),
      sheetOf('공휴일', { rows: st.settings.holidays.length + 1, add: 1, chg: 0, del: 0, errors: [], warnings: [{ loc: N.holidays + ' · 엑셀 8번째 줄 · 날짜', why: '「6/3(화)」을 2025년 6월 3일로 읽었습니다(연도가 없어 시즌 연도로).', fix: null }] }),
      sheetOf('휴식예외일', { rows: st.settings.restExceptions.length, add: 0, chg: 0, del: 0, errors: [], warnings: [] }),
      sheetOf('휴식기', { rows: st.settings.blackouts.length, add: 0, chg: 1, del: 0, errors: [], warnings: [] }),
      sheetOf('특별 경기', { rows: 7, add: 1, chg: 0, del: 0,
        errors: [{ loc: N.events + ' · 엑셀 8번째 줄 · 날짜', why: '3/3(월)은 어느 연전 기간에도 없습니다 — 시즌 기간(3/22~8/31) 안의 날짜인가요?', fix: null }], warnings: [] }),
      sheetOf('안내', { rows: 18, ignored: true, add: 0, chg: 0, del: 0, errors: [], warnings: [] })
    ].map((x) => Object.assign(x, { checked: !x.ignored && !x.errors.length && (x.add + x.chg + x.del > 0) }));
  }

  // ───────── 가져온 뒤 시각화 (W15) — opt-1은 이 함수를 "현재 ↔ 가져온 뒤" 나란히로 바꾼다 ─────────
  /** 선택 시트의 "가져온 뒤" 상태를 만든다. xlsx·구글 시트는 미리 정한 목업 변경, 보조 생성은 실제 생성 결과. */
  S.importAfter = function (imp, key) {
    const st = app().state;
    const clone = (x) => JSON.parse(JSON.stringify(x));
    if (imp.kind === 'draft-slots') return { calendar: CalendarGen.generateSlots(st.settings).slots, settings: st.settings };
    if (imp.kind === 'draft-series') return { matches: app().generateSeriesPreview().matches };
    if (key === 'slots') { const cal = clone(st.calendar); if (cal[18]) cal[18].holiday = 2; if (cal[29]) cal[29].note = '비고2 무시'; return { calendar: cal, changedSlots: new Set([18, 29]) }; }
    if (key === 'series') {
      const ms = clone(st.matches);
      if (ms[10]) ms[10].away = 'LGG';                       // 12행 오류 → 집계에서 빠짐
      for (const i of [40, 120]) if (ms[i]) { const t = ms[i].home; ms[i].home = ms[i].away; ms[i].away = t; }
      ms.splice(200, 1);                                       // 삭제 1
      ms.push({ home: 'KT', away: 'NC', consecutive: 3 });     // 추가 1
      return { matches: ms, errorRows: [{ row: 12, text: "엑셀 12번째 줄 원정 'LGG'(알 수 없는 구단)는 세지 않았습니다." }] };
    }
    if (key === 'holidays') { const s = clone(st.settings); if (!s.holidays.some((h) => h.date === '2025-06-03')) s.holidays.push({ date: '2025-06-03', name: '대통령 선거일' }); return { settings: s }; }
    if (key === 'blackouts') { const s = clone(st.settings); const b = s.blackouts.find((x) => x.start === '2025-07-11'); if (b) b.label = '올스타 브레이크 (확정)'; return { settings: s, changedDays: (() => { const out = new Set(); if (b) for (let d = Dates.dayNum(b.start); d <= Dates.dayNum(b.end); d++) out.add(d); return out; })() }; }
    if (key === 'events') { const ev = clone(st.events); ev.push({ id: 'ev-imp', type: 'CUSTOM', name: '시즌 전 행사', date: '2025-03-03', mode: 'STADIUM', stadiums: [] }); return { events: ev, errorRows: [{ row: 8, text: '엑셀 8번째 줄 3/3(월)은 1차 편성 기간 밖이라 달력에 나타나지 않습니다.' }] }; }
    if (key === 'restex') return { settings: st.settings };
    return null;
  };
  S.importViz = function (imp, sel) {
    const st = app().state;
    const V = S.viz;
    const after = S.importAfter(imp, sel.key);
    const head = (title, right) => '<div class="imp-viz-head">' + icon('chart') + '<b>가져온 뒤 · ' + esc(title) + '</b><span class="muted small">' + right + '</span></div>';
    if (!after) return '<div class="imp-viz"><div class="empty"><b>그림 없음</b>' + esc(sel.name) + ' 시트는 안내용이라 반영할 내용이 없습니다.</div></div>';
    const notes = (after.errorRows || []).map((e) => '<div class="vz-note warn">' + icon('warn') + esc(e.text) + '</div>').join('');
    if (after.matches) {
      const names = st.teams.map((t) => t.name);
      const before = V.pairCounts(st.matches, names), cnt = V.pairCounts(after.matches, names);
      const changed = V.diffCounts(before, cnt);
      const mx = V.pairMatrix({ names, counts: cnt, target: st.settings.initialGamesPerPair, changed, before, cw: window.innerWidth >= 1800 ? 50 : 46, ch: window.innerHeight >= 900 ? 30 : 20, title: '가져온 뒤 맞대결 경기 수' });
      return '<div class="imp-viz" data-viz="matrix">' + head('맞대결 경기 수', '가로줄 홈 × 세로줄 원정 · 바뀐 칸 ' + changed.size + ' · 합이 ' + st.settings.initialGamesPerPair + '이 아닌 맞대결 ' + mx.off + '쌍') + '<div class="imp-viz-body">' + mx.html + '</div>' + notes + '</div>';
    }
    const settings = after.settings || st.settings;
    const cal = after.calendar || st.calendar;
    const o = { settings, slots: cal, label: '가져온 뒤 시즌 달력' };
    let right = '';
    if (after.calendar) { o.changed = after.changedSlots || V.diffSlots(st.calendar, after.calendar); right = N.slots + ' ' + cal.length + '개 · 바뀐 곳 ' + o.changed.size; }
    else if (after.events) { o.events = after.events.map((e) => ({ date: e.date, name: e.name, sel: e.id === 'ev-imp' })); right = N.events + ' ' + after.events.length + '개'; }
    else {
      const key = sel.key === 'holidays' || sel.key === 'blackouts' ? sel.key : 'restex';
      o.changedDays = after.changedDays || V.diffDates(V.dateSet(st, key), V.dateSet({ settings, events: [] }, key));
      right = '바뀐 날짜 ' + o.changedDays.size + '일';
    }
    return '<div class="imp-viz" data-viz="ribbon">' + head('시즌 달력', right) + '<div class="imp-viz-body">' + V.ribbon(o) + '</div>' + notes + '</div>';
  };

  S.openImport = function (kind, extra) {
    if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) { S.toast('자동 편성 중에는 가져올 수 없습니다.', 'warn'); return; }
    buildImp(kind, extra);
    S.go({ modal: 'import' });
  };
  function buildImp(kind, extra) {
    if (kind === 'xlsx') S.ui.imp = { kind, source: '2025_KBO_편성_v3.xlsx', meta: '128KB · 시트 7개 · 읽기 0.4초', sheets: mockSheets(), sel: 'series', confirm: false, mock: true, allIssues: true };
    else if (kind === 'gsheet') S.ui.imp = { kind, source: '구글 시트 "2025 KBO 편성 작업본"', meta: (extra || '') + ' · 시트 7개 · 읽기 1.1초', sheets: mockSheets(), sel: 'series', confirm: false, mock: true, allIssues: true };
    else if (kind === 'draft-slots') {
      const gen = CalendarGen.generateSlots(app().state.settings).slots;
      const cur = app().state.calendar;
      let chg = 0;
      for (let i = 0; i < Math.min(gen.length, cur.length); i++) if (gen[i].datetime !== cur[i].datetime || gen[i].consecutive !== cur[i].consecutive || gen[i].weekend !== cur[i].weekend || gen[i].holiday !== cur[i].holiday) chg++;
      const h = CalendarGen.lengthHistogram(gen);
      S.ui.imp = { kind, source: '규칙대로 만든 안' + (S.dev() ? ' (§5.2.1)' : ''), meta: '개막 ' + fmt.date(app().state.settings.seasonStart) + ' · 휴식 요일·휴식일 경기·휴식기 적용 · ' + [2, 3, 4].map((k) => k + '연전 ' + (h[k] || 0)).join(' · '),
        sheets: [{ key: 'slots', name: N.slots, src: N.slots, rows: gen.length, add: Math.max(0, gen.length - cur.length), chg, del: Math.max(0, cur.length - gen.length), resetsPlan: chg + Math.abs(gen.length - cur.length) > 0, errors: [], warnings: chg ? [] : [{ loc: N.slots + ' · 전체', why: '지금 ' + N.slots + ' ' + cur.length + '개와 날짜·연전 수·휴일 등급이 모두 같습니다.', fix: null }], checked: true }], sel: 'slots', confirm: false };
    } else if (kind === 'draft-series') {
      const g = app().generateSeriesPreview();
      const key = (m) => m.home + '|' + m.away + '|' + m.consecutive;
      const cur = new Map(); for (const m of app().state.matches) cur.set(key(m), (cur.get(key(m)) || 0) + 1);
      let add = 0; for (const m of g.matches) { const k = key(m); if (cur.get(k)) cur.set(k, cur.get(k) - 1); else add++; }
      const del = Array.from(cur.values()).reduce((a, b) => a + b, 0);
      S.ui.imp = { kind, source: '맞대결 규칙대로 만든 시리즈' + (S.dev() ? ' (FR-S7)' : ''), meta: '맞대결 ' + app().state.settings.initialGamesPerPair + '경기 · 홈 ' + app().state.settings.homeGamesMajor + ' / 원정 ' + (app().state.settings.initialGamesPerPair - app().state.settings.homeGamesMajor) + ' · 연전 분포 = ' + N.slots + ' 분포',
        sheets: [{ key: 'series', name: N.series, src: N.series, rows: g.matches.length, add, chg: 0, del, resetsPlan: true, errors: g.errors.map((e) => ({ loc: N.series + ' · 자동 채우기', why: e })), warnings: g.warnings.map((w) => ({ loc: N.series + ' · 자동 채우기', why: w })), checked: !g.errors.length }], sel: 'series', confirm: false };
    }
  }

  S.modals.import = function () {
    if (!S.ui.imp) buildImp('xlsx');
    const imp = S.ui.imp;
    const sel = imp.sheets.find((x) => x.key === imp.sel) || imp.sheets[0];
    const checked = imp.sheets.filter((x) => x.checked);
    const needReset = checked.some((x) => x.resetsPlan);
    const totalE = imp.sheets.reduce((a, x) => a + x.errors.length, 0), totalW = imp.sheets.reduce((a, x) => a + x.warnings.length, 0);
    const canApply = checked.length && (!needReset || imp.confirm);
    let s = '<div class="modal" role="dialog" aria-modal="true" aria-label="가져오기 전 확인">';
    s += '<div class="modal-head">' + icon(imp.kind === 'gsheet' ? 'link' : imp.kind === 'xlsx' ? 'upload' : 'bolt') + '<h3>' + (imp.kind.startsWith('draft') ? '자동 채우기 전 확인' : '가져오기 전 확인') + '</h3>' +
      '<span class="small"><b>' + esc(imp.source) + '</b> <span class="muted">· ' + esc(imp.meta) + '</span></span>' + (imp.mock ? S.mock('시안 예시: 파일을 읽은 결과') : '') +
      '<span style="margin-left:auto;display:flex;gap:6px">' + S.stat(totalE ? 'block' : 'ok', '오류 ' + totalE) + S.stat(totalW ? 'warn' : 'ok', '확인 필요 ' + totalW) + '</span>' +
      '<button class="btn sm icon ghost" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>';
    s += '<div class="modal-body"><div class="imp-grid">';
    s += '<section class="imp-left"><div class="toolbar"><b>시트</b><span class="small muted">줄을 누르면 가져온 뒤 모습이 아래에 나옵니다. 오류가 있는 시트는 적용할 수 없습니다.</span></div><div class="imp-sheets"><table class="itable"><thead><tr><th style="width:34px"></th><th>시트</th><th class="num">개수</th><th class="num">추가</th><th class="num">변경</th><th class="num">삭제</th><th class="num">오류</th><th class="num">확인 필요</th><th>상태</th></tr></thead><tbody>';
    for (const sh of imp.sheets) {
      const dis = sh.ignored || sh.errors.length > 0;
      s += '<tr class="' + (sh === sel ? 'sel' : '') + (dis ? ' dis' : '') + '" data-act="imp-sel" data-name="' + esc(sh.key) + '"><td><input type="checkbox" data-in="imp-check" data-name="' + esc(sh.key) + '"' + (sh.checked ? ' checked' : '') + (dis ? ' disabled' : '') + ' aria-label="' + esc(sh.name) + ' 적용"></td><td><b>' + esc(sh.name) + '</b>' + (sh.src && sh.src !== sh.name ? ' <span class="muted small" title="예전 양식의 시트 이름도 그대로 읽습니다">(예전 이름 「' + esc(sh.src) + '」)</span>' : '') + (sh.resetsPlan && !sh.ignored ? ' <span class="tag ref" title="이 시트를 적용하면 지금 일정이 비워집니다">일정에 영향</span>' : '') + '</td>' +
        '<td class="num">' + sh.rows + '</td>' + (sh.ignored ? '<td colspan="5" class="muted small">안내 시트라 가져오지 않음</td>' :
        '<td class="num">' + (sh.add ? '<span class="d-add">+' + sh.add + '</span>' : '<span class="muted">0</span>') + '</td><td class="num">' + (sh.chg ? '<span class="d-chg">~' + sh.chg + '</span>' : '<span class="muted">0</span>') + '</td><td class="num">' + (sh.del ? '<span class="d-del">−' + sh.del + '</span>' : '<span class="muted">0</span>') + '</td><td class="num">' + (sh.errors.length ? '<b style="color:var(--bad)">' + sh.errors.length + '</b>' : '0') + '</td><td class="num">' + sh.warnings.length + '</td>') +
        '<td>' + (sh.ignored ? '<span class="muted small">읽지 않음</span>' : sh.errors.length ? S.stat('block', '적용 불가') : sh.add + sh.chg + sh.del ? (sh.checked ? S.stat('info', '적용') : S.stat('todo', '건너뜀')) : S.stat('ok', '변경 없음')) + '</td></tr>';
    }
    s += '</tbody></table><div class="small muted imp-hint" title="파일에 없는 시트는 바꾸지 않습니다. 제목 줄은 한국어 기준이며 영문 이름(home, away …)과 예전 시트 이름(슬롯·휴식예외일·경기없는기간·이벤트)도 받습니다.">' + icon('info') + ' 시트마다 통째로 바뀝니다. 추가·변경·삭제 숫자는 지금과 비교한 참고용입니다.</div></div>' + S.importViz(imp, sel) + '</section>';
    const issues = imp.allIssues ? imp.sheets : [sel];
    s += '<section><div class="toolbar"><b>오류·확인 필요</b><span class="small muted">' + (imp.allIssues ? '모든 시트' : esc(sel.name) + ' 시트') + '</span><span style="margin-left:auto"><span class="seg"><button class="' + (!imp.allIssues ? 'on' : '') + '" data-act="imp-issues" data-all="0">선택 시트</button><button class="' + (imp.allIssues ? 'on' : '') + '" data-act="imp-issues" data-all="1">전체</button></span></span></div><div class="pane-body" style="overflow-y:auto">';
    let n = 0;
    for (const sh of issues) {
      for (const e of sh.errors) { n++; s += '<div class="issue"><span class="ic e">' + icon('x') + '</span><span class="loc">' + esc(e.loc) + '</span><span class="why">' + esc(e.why) + '</span>' + (e.fix ? '<span class="fix">고칠 값: <b style="color:var(--text)">' + esc(e.fix) + '</b> — 엑셀에서 고쳐 다시 올리거나, 적용한 뒤 ① 표에서 고치세요.</span>' : '<span class="fix">원본 파일을 고친 뒤 다시 가져오세요.</span>') + '</div>'; }
      for (const w of sh.warnings) { n++; s += '<div class="issue"><span class="ic w">' + icon('warn') + '</span><span class="loc">' + esc(w.loc) + '</span><span class="why">' + esc(w.why) + '</span>' + (w.fix ? '<span class="fix">' + esc(w.fix) + '</span>' : '') + '</div>'; }
    }
    if (!n) s += '<div class="empty"><b>' + icon('check') + ' 문제 없음</b>이 시트에는 오류나 확인할 점이 없습니다.</div>';
    s += '</div></section></div></div>';
    s += '<div class="modal-foot">' + (needReset
      ? '<label class="confirm-box"><input type="checkbox" data-in="imp-confirm"' + (imp.confirm ? ' checked' : '') + '>' + icon('warn') + '<span><b>지금 일정(시리즈 ' + app().state.matches.length + '개)이 비워집니다.</b> 적용 직전 상태는 중간 저장 「가져오기 전 — ' + fmt.clock(new Date()) + '」로 남고, 한 번에 되돌릴 수 있습니다.</span></label>'
      : '<span class="small muted">' + icon('info') + ' 지금 일정에 영향 없는 시트만 골랐습니다. 적용해도 한 번에 되돌릴 수 있습니다.</span>') +
      '<span style="margin-left:auto;display:flex;gap:8px"><button class="btn" data-act="close-modal">취소</button><button class="btn primary" data-act="imp-apply"' + (canApply ? '' : ' disabled') + '>' + icon('check') + '적용 (' + checked.length + '개 시트)</button></span></div>';
    return s + '</div>';
  };

  S.modals.gsheet = function () {
    const url = S.ls.get(GS_KEY) || 'https://docs.google.com/spreadsheets/d/1kBoSaMpLe2025xYzScheduleQ/edit#gid=0';
    return '<div class="modal narrow" role="dialog" aria-modal="true" aria-label="구글 시트 연결">' +
      '<div class="modal-head">' + icon('link') + '<h3>구글 시트 연결</h3>' + S.mock(S.dev() ? '네트워크 요청 없음' : '시안: 실제로 연결하지 않음') + '<button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div style="padding:14px;display:flex;flex-direction:column;gap:10px">' +
      '<label class="field"><span>공유 링크 (링크가 있는 모든 사용자 · 보기)</span><input class="input" id="gsUrl" value="' + esc(url) + '"></label>' +
      '<div class="confirm-box">' + icon('warn') + '<span>공유 링크 방식은 링크를 아는 누구나 시트를 볼 수 있습니다. 읽기 전용이며 자동 동기화는 하지 않습니다.</span></div>' +
      '<dl class="props">' + (S.dev() ? '<dt>문서 ID</dt><dd class="mono">1kBoSaMpLe2025xYzScheduleQ</dd>' : '') + '<dt>읽을 시트</dt><dd class="small">' + ['slots', 'series', 'holidays', 'restex', 'blackouts', 'events', 'guide'].map((k) => esc(N[k])).join(' · ') + '<br><span class="muted">예전 이름(슬롯·휴식예외일·경기없는기간·이벤트)도 읽습니다.</span></dd>' + (S.dev() ? '<dt>요청 형식</dt><dd class="mono small">gviz/tq?tqx=out:csv&amp;sheet={탭}</dd>' : '') + '</dl>' +
      '<label style="display:flex;gap:6px;align-items:center" class="small"><input type="checkbox" checked> 이 브라우저에 링크 기억</label>' +
      '</div><div class="modal-foot"><span class="small muted">비공개 시트, 없는 시트, 연결 오류는 이유를 알려 드립니다.</span><span style="margin-left:auto;display:flex;gap:8px"><button class="btn" data-act="close-modal">취소</button><button class="btn primary" data-act="gs-load">' + icon('download') + '불러오기</button></span></div></div>';
  };

  Object.assign(S.actions, {
    'import-xlsx': () => S.openImport('xlsx'),
    'import-gsheet': () => S.go({ modal: 'gsheet', menu: null }),
    'import-gsheet-reload': () => S.openImport('gsheet', '다시 불러오기'),
    'gs-load': () => { const el = document.getElementById('gsUrl'); if (el) S.ls.set(GS_KEY, el.value); S.openImport('gsheet', '공유 링크'); },
    'draft-slots': () => S.openImport('draft-slots'),
    'draft-series': () => S.openImport('draft-series'),
    'imp-sel': (el, e) => { if (e.target.tagName === 'INPUT') return; S.ui.imp.sel = el.dataset.name; S.render(); },
    'imp-issues': (el) => { S.ui.imp.allIssues = el.dataset.all === '1'; S.render(); },
    'imp-apply': () => applyImport()
  });
  S.inputs['imp-check'] = (el) => { const sh = S.ui.imp.sheets.find((x) => x.key === el.dataset.name); if (sh) sh.checked = el.checked; S.render(); };
  S.inputs['imp-confirm'] = (el) => { S.ui.imp.confirm = el.checked; S.render(); };

  function applyImport() {
    const imp = S.ui.imp;
    const checked = imp.sheets.filter((x) => x.checked);
    if (!checked.length) return;
    const time = fmt.clock(new Date());
    const needReset = checked.some((x) => x.resetsPlan);
    if (needReset && !imp.confirm) return;
    app().saveSnapshot('가져오기 전 — ' + time);
    const names = checked.map((x) => x.name), keys = checked.map((x) => x.key);
    if (imp.kind === 'draft-slots') app().regenerateSlots();
    else if (imp.kind === 'draft-series') app().regenerateSeries();
    else {
      app().commit('가져오기: ' + names.join('·'), (s) => {
        if (keys.includes('holidays') && !s.settings.holidays.some((h) => h.date === '2025-06-03')) { s.settings.holidays.push({ date: '2025-06-03', name: '대통령 선거일' }); s.settings.holidays.sort((a, b) => (a.date < b.date ? -1 : 1)); }
        if (keys.includes('blackouts')) { const b = s.settings.blackouts.find((x) => x.start === '2025-07-11'); if (b) b.label = '올스타 브레이크 (확정)'; }
      }, ['input']);
    }
    S.ui.lastImport = { kind: imp.kind, source: imp.kind.startsWith('draft') ? '규칙대로 자동 채우기' : imp.source, sheets: names.length + '개 시트', time };
    S.importHistory.push({ kind: imp.kind === 'gsheet' ? 'gsheet' : 'xlsx', source: imp.kind.startsWith('draft') ? imp.source : imp.source, detail: names.join('·') + ' 적용 · ' + time });
    S.ui.imp = null;
    S.go({ modal: null });
    S.toast(names.length + '개 시트를 적용했습니다' + (needReset && imp.mock ? ' (시안 예시: 시연을 위해 지금 일정은 그대로 둠)' : '') + '. 실행 취소로 되돌릴 수 있습니다.', 'ok', 5000);
  }
})();
