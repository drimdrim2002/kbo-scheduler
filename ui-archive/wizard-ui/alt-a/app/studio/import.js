/*
 * alt-a 편성 스튜디오 — 가져오기 미리보기 (FR-X1~X5, X9)
 * .xlsx 업로드·구글 시트 연결은 목업: 미리 준비한 결과(오류 2건 포함)를 보여 준다.
 * 보조 생성(규칙으로 초안 만들기)은 실제 생성기 결과와 현재 데이터를 비교한다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO, esc, icon, fmt } = S;
  const { CalendarGen } = KBO;
  const app = () => S.app;
  const GS_KEY = S.KEY + 'gsheet-url';

  function mockSheets() {
    const st = app().state;
    return [
      { name: '슬롯', rows: st.calendar.length, add: 0, chg: 2, del: 0, resetsPlan: true, errors: [],
        warnings: [{ loc: '슬롯 · 20행 · D열(휴일가중치)', why: '값이 비어 있어 규칙으로 채웁니다.', fix: '자동: 2' }, { loc: '슬롯 · 31행 · E열(메모)', why: '모르는 열 "비고2"는 무시합니다.', fix: null }] },
      { name: '시리즈', rows: st.matches.length, add: 1, chg: 3, del: 1, resetsPlan: true,
        errors: [{ loc: '시리즈 · 12행 · B열(원정)', why: "알 수 없는 구단 'LGG' — 'LG'인가요?", fix: 'LG' }], warnings: [] },
      { name: '공휴일', rows: st.settings.holidays.length + 1, add: 1, chg: 0, del: 0, errors: [], warnings: [{ loc: '공휴일 · 8행 · A열(날짜)', why: "'6/3(화)'을 2025-06-03으로 읽었습니다(연도 없음 → 시즌 연도).", fix: null }] },
      { name: '휴식예외일', rows: st.settings.restExceptions.length, add: 0, chg: 0, del: 0, errors: [], warnings: [] },
      { name: '경기없는기간', rows: st.settings.blackouts.length, add: 0, chg: 1, del: 0, errors: [], warnings: [] },
      { name: '이벤트', rows: 7, add: 1, chg: 0, del: 0,
        errors: [{ loc: '이벤트 · 8행 · C열(날짜)', why: '3/3(월)은 어느 슬롯에도 없습니다 — 시즌 기간(3/22~8/31) 안의 날짜인가요?', fix: null }], warnings: [] },
      { name: '안내', rows: 18, ignored: true, add: 0, chg: 0, del: 0, errors: [], warnings: [] }
    ].map((x) => Object.assign(x, { checked: !x.ignored && !x.errors.length && (x.add + x.chg + x.del > 0) }));
  }

  S.openImport = function (kind, extra) {
    if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) { S.toast('엔진 실행 중에는 가져올 수 없습니다.', 'warn'); return; }
    buildImp(kind, extra);
    S.go({ modal: 'import' });
  };
  function buildImp(kind, extra) {
    if (kind === 'xlsx') S.ui.imp = { kind, source: '2025_KBO_편성_v3.xlsx', meta: '128KB · 시트 7개 · 읽기 0.4초', sheets: mockSheets(), sel: '시리즈', confirm: false, mock: true, allIssues: true };
    else if (kind === 'gsheet') S.ui.imp = { kind, source: '구글 시트 "2025 KBO 편성 작업본"', meta: (extra || '') + ' · 탭 7개 · 읽기 1.1초', sheets: mockSheets(), sel: '시리즈', confirm: false, mock: true, allIssues: true };
    else if (kind === 'draft-slots') {
      const gen = CalendarGen.generateSlots(app().state.settings).slots;
      const cur = app().state.calendar;
      let chg = 0;
      for (let i = 0; i < Math.min(gen.length, cur.length); i++) if (gen[i].datetime !== cur[i].datetime || gen[i].consecutive !== cur[i].consecutive || gen[i].weekend !== cur[i].weekend || gen[i].holiday !== cur[i].holiday) chg++;
      const h = CalendarGen.lengthHistogram(gen);
      S.ui.imp = { kind, source: '규칙으로 만든 초안 (§5.2.1)', meta: '개막 ' + fmt.date(app().state.settings.seasonStart) + ' · 휴식 요일·예외일·경기 없는 기간 적용 · 2/3/4연전 ' + [2, 3, 4].map((k) => h[k] || 0).join('/'),
        sheets: [{ name: '슬롯', rows: gen.length, add: Math.max(0, gen.length - cur.length), chg, del: Math.max(0, cur.length - gen.length), resetsPlan: chg + Math.abs(gen.length - cur.length) > 0, errors: [], warnings: chg ? [] : [{ loc: '슬롯 · 전체', why: '현재 슬롯 45개와 날짜·연전 수·가중치가 모두 같습니다.', fix: null }], checked: true }], sel: '슬롯', confirm: false };
    } else if (kind === 'draft-series') {
      const g = app().generateSeriesPreview();
      const key = (m) => m.home + '|' + m.away + '|' + m.consecutive;
      const cur = new Map(); for (const m of app().state.matches) cur.set(key(m), (cur.get(key(m)) || 0) + 1);
      let add = 0; for (const m of g.matches) { const k = key(m); if (cur.get(k)) cur.set(k, cur.get(k) - 1); else add++; }
      const del = Array.from(cur.values()).reduce((a, b) => a + b, 0);
      S.ui.imp = { kind, source: '구단쌍 규칙으로 만든 시리즈 (FR-S7)', meta: '구단쌍 ' + app().state.settings.initialGamesPerPair + '경기 · 홈 ' + app().state.settings.homeGamesMajor + ' / 원정 ' + (app().state.settings.initialGamesPerPair - app().state.settings.homeGamesMajor) + ' · 연전 분포 = 슬롯 분포',
        sheets: [{ name: '시리즈', rows: g.matches.length, add, chg: 0, del, resetsPlan: true, errors: g.errors.map((e) => ({ loc: '시리즈 · 생성', why: e })), warnings: g.warnings.map((w) => ({ loc: '시리즈 · 생성', why: w })), checked: !g.errors.length }], sel: '시리즈', confirm: false };
    }
  }

  S.modals.import = function () {
    if (!S.ui.imp) buildImp('xlsx');
    const imp = S.ui.imp;
    const sel = imp.sheets.find((x) => x.name === imp.sel) || imp.sheets[0];
    const checked = imp.sheets.filter((x) => x.checked);
    const needReset = checked.some((x) => x.resetsPlan);
    const totalE = imp.sheets.reduce((a, x) => a + x.errors.length, 0), totalW = imp.sheets.reduce((a, x) => a + x.warnings.length, 0);
    const canApply = checked.length && (!needReset || imp.confirm);
    let s = '<div class="modal" role="dialog" aria-modal="true" aria-label="가져오기 미리보기">';
    s += '<div class="modal-head">' + icon(imp.kind === 'gsheet' ? 'link' : imp.kind === 'xlsx' ? 'upload' : 'bolt') + '<h3>' + (imp.kind.startsWith('draft') ? '보조 생성 미리보기' : '가져오기 미리보기') + '</h3>' +
      '<span class="small"><b>' + esc(imp.source) + '</b> <span class="muted">· ' + esc(imp.meta) + '</span></span>' + (imp.mock ? S.mock('목업: 파싱 결과 예시') : '') +
      '<span style="margin-left:auto;display:flex;gap:6px">' + S.stat(totalE ? 'block' : 'ok', '오류 ' + totalE) + S.stat(totalW ? 'warn' : 'ok', '경고 ' + totalW) + '</span>' +
      '<button class="btn sm icon ghost" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>';
    s += '<div class="modal-body"><div class="imp-grid">';
    s += '<section><div class="toolbar"><b>시트</b><span class="small muted">반영할 시트를 고르세요. 오류가 있는 시트는 적용할 수 없습니다.</span></div><div class="pane-body" style="overflow-y:auto"><table class="itable"><thead><tr><th style="width:34px"></th><th>시트</th><th class="num">행</th><th class="num">추가</th><th class="num">변경</th><th class="num">삭제</th><th class="num">오류</th><th class="num">경고</th><th>상태</th></tr></thead><tbody>';
    for (const sh of imp.sheets) {
      const dis = sh.ignored || sh.errors.length > 0;
      s += '<tr class="' + (sh === sel ? 'sel' : '') + (dis ? ' dis' : '') + '" data-act="imp-sel" data-name="' + esc(sh.name) + '"><td><input type="checkbox" data-in="imp-check" data-name="' + esc(sh.name) + '"' + (sh.checked ? ' checked' : '') + (dis ? ' disabled' : '') + ' aria-label="' + esc(sh.name) + ' 적용"></td><td><b>' + esc(sh.name) + '</b>' + (sh.resetsPlan && !sh.ignored ? ' <span class="tag ref" title="이 시트를 적용하면 배정이 초기화됩니다">배정 영향</span>' : '') + '</td>' +
        '<td class="num">' + sh.rows + '</td>' + (sh.ignored ? '<td colspan="5" class="muted small">설명용 시트 — 가져올 때 무시</td>' :
        '<td class="num">' + (sh.add ? '<span class="d-add">+' + sh.add + '</span>' : '<span class="muted">0</span>') + '</td><td class="num">' + (sh.chg ? '<span class="d-chg">~' + sh.chg + '</span>' : '<span class="muted">0</span>') + '</td><td class="num">' + (sh.del ? '<span class="d-del">−' + sh.del + '</span>' : '<span class="muted">0</span>') + '</td><td class="num">' + (sh.errors.length ? '<b style="color:var(--bad)">' + sh.errors.length + '</b>' : '0') + '</td><td class="num">' + sh.warnings.length + '</td>') +
        '<td>' + (sh.ignored ? '<span class="muted small">무시</span>' : sh.errors.length ? S.stat('block', '적용 불가') : sh.add + sh.chg + sh.del ? (sh.checked ? S.stat('info', '적용') : S.stat('todo', '건너뜀')) : S.stat('ok', '변경 없음')) + '</td></tr>';
    }
    s += '</tbody></table><div class="small muted" style="padding:10px 12px">' + icon('info') + ' 시트 단위 전체 교체입니다. 추가·변경·삭제는 현재 상태와 비교한 참고 표시이고, 파일에 없는 시트는 바꾸지 않습니다. 머리글은 한국어 기준이며 영문 별칭(home, away …)도 받습니다.</div></div></section>';
    const issues = imp.allIssues ? imp.sheets : [sel];
    s += '<section><div class="toolbar"><b>오류·경고</b><span class="small muted">' + (imp.allIssues ? '전체 시트' : esc(sel.name) + ' 시트') + '</span><span style="margin-left:auto"><span class="seg"><button class="' + (!imp.allIssues ? 'on' : '') + '" data-act="imp-issues" data-all="0">선택 시트</button><button class="' + (imp.allIssues ? 'on' : '') + '" data-act="imp-issues" data-all="1">전체</button></span></span></div><div class="pane-body" style="overflow-y:auto">';
    let n = 0;
    for (const sh of issues) {
      for (const e of sh.errors) { n++; s += '<div class="issue"><span class="ic e">' + icon('x') + '</span><span class="loc">' + esc(e.loc) + '</span><span class="why">' + esc(e.why) + '</span>' + (e.fix ? '<span class="fix">고칠 값: <b style="color:var(--text)">' + esc(e.fix) + '</b> — 엑셀에서 고쳐 다시 올리거나, 적용 후 ① 시트 표에서 한 건 수정</span>' : '<span class="fix">원본 파일을 고친 뒤 다시 가져오세요.</span>') + '</div>'; }
      for (const w of sh.warnings) { n++; s += '<div class="issue"><span class="ic w">' + icon('warn') + '</span><span class="loc">' + esc(w.loc) + '</span><span class="why">' + esc(w.why) + '</span>' + (w.fix ? '<span class="fix">' + esc(w.fix) + '</span>' : '') + '</div>'; }
    }
    if (!n) s += '<div class="empty"><b>' + icon('check') + ' 문제 없음</b>이 시트에는 오류·경고가 없습니다.</div>';
    s += '</div></section></div></div>';
    s += '<div class="modal-foot">' + (needReset
      ? '<label class="confirm-box"><input type="checkbox" data-in="imp-confirm"' + (imp.confirm ? ' checked' : '') + '>' + icon('warn') + '<span><b>현재 배정(' + app().state.matches.length + ' 시리즈)이 초기화됩니다.</b> 적용 직전 상태는 스냅샷 「가져오기 전 — ' + fmt.clock(new Date()) + '」으로 저장되고 실행 취소 1단계로 되돌릴 수 있습니다.</span></label>'
      : '<span class="small muted">' + icon('info') + ' 배정에 영향 없는 시트만 골랐습니다. 적용은 실행 취소 1단계입니다.</span>') +
      '<span style="margin-left:auto;display:flex;gap:8px"><button class="btn" data-act="close-modal">취소</button><button class="btn primary" data-act="imp-apply"' + (canApply ? '' : ' disabled') + '>' + icon('check') + '적용 (' + checked.length + '개 시트)</button></span></div>';
    return s + '</div>';
  };

  S.modals.gsheet = function () {
    const url = S.ls.get(GS_KEY) || 'https://docs.google.com/spreadsheets/d/1kBoSaMpLe2025xYzScheduleQ/edit#gid=0';
    return '<div class="modal narrow" role="dialog" aria-modal="true" aria-label="구글 시트 연결">' +
      '<div class="modal-head">' + icon('link') + '<h3>구글 시트 연결</h3>' + S.mock('네트워크 요청 없음') + '<button class="btn sm icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="닫기">' + icon('x') + '</button></div>' +
      '<div style="padding:14px;display:flex;flex-direction:column;gap:10px">' +
      '<label class="field"><span>공유 링크 (링크가 있는 모든 사용자 · 보기)</span><input class="input" id="gsUrl" value="' + esc(url) + '"></label>' +
      '<div class="confirm-box">' + icon('warn') + '<span>공유 링크 방식은 링크를 아는 누구나 시트를 볼 수 있습니다. 읽기 전용이며 자동 동기화는 하지 않습니다.</span></div>' +
      '<dl class="props"><dt>문서 ID</dt><dd class="mono">1kBoSaMpLe2025xYzScheduleQ</dd><dt>읽을 탭</dt><dd class="small">슬롯 · 시리즈 · 공휴일 · 휴식예외일 · 경기없는기간 · 이벤트 · 안내</dd><dt>요청 형식</dt><dd class="mono small">gviz/tq?tqx=out:csv&amp;sheet={탭}</dd></dl>' +
      '<label style="display:flex;gap:6px;align-items:center" class="small"><input type="checkbox" checked> 이 브라우저에 URL 기억 (localStorage)</label>' +
      '</div><div class="modal-foot"><span class="small muted">비공개·없는 탭·네트워크 오류는 원인별로 알려 줍니다.</span><span style="margin-left:auto;display:flex;gap:8px"><button class="btn" data-act="close-modal">취소</button><button class="btn primary" data-act="gs-load">' + icon('download') + '불러오기</button></span></div></div>';
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
  S.inputs['imp-check'] = (el) => { const sh = S.ui.imp.sheets.find((x) => x.name === el.dataset.name); if (sh) sh.checked = el.checked; S.render(); };
  S.inputs['imp-confirm'] = (el) => { S.ui.imp.confirm = el.checked; S.render(); };

  function applyImport() {
    const imp = S.ui.imp;
    const checked = imp.sheets.filter((x) => x.checked);
    if (!checked.length) return;
    const time = fmt.clock(new Date());
    const needReset = checked.some((x) => x.resetsPlan);
    if (needReset && !imp.confirm) return;
    app().saveSnapshot('가져오기 전 — ' + time);
    const names = checked.map((x) => x.name);
    if (imp.kind === 'draft-slots') app().regenerateSlots();
    else if (imp.kind === 'draft-series') app().regenerateSeries();
    else {
      app().commit('가져오기: ' + names.join('·'), (s) => {
        if (names.includes('공휴일') && !s.settings.holidays.some((h) => h.date === '2025-06-03')) { s.settings.holidays.push({ date: '2025-06-03', name: '대통령 선거일' }); s.settings.holidays.sort((a, b) => (a.date < b.date ? -1 : 1)); }
        if (names.includes('경기없는기간')) { const b = s.settings.blackouts.find((x) => x.start === '2025-07-11'); if (b) b.label = '올스타 브레이크 (확정)'; }
      }, ['input']);
    }
    S.ui.lastImport = { kind: imp.kind, source: imp.kind.startsWith('draft') ? '보조 생성' : imp.source, sheets: names.length + '개 시트', time };
    S.importHistory.push({ kind: imp.kind === 'gsheet' ? 'gsheet' : 'xlsx', source: imp.kind.startsWith('draft') ? imp.source : imp.source, detail: names.join('·') + ' 적용 · ' + time });
    S.ui.imp = null;
    S.go({ modal: null });
    S.toast(names.length + '개 시트를 적용했습니다' + (needReset && imp.mock ? ' (목업: 시연을 위해 현재 배정은 유지)' : '') + '. 실행 취소로 되돌릴 수 있습니다.', 'ok', 5000);
  }
})();
