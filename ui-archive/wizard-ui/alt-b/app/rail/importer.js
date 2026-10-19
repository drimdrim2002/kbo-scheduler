/*
 * alt-b 단계 레일 — 스프레드시트 가져오기 미리보기 (FR-X1~X5, X9). 파싱·네트워크는 목업이다.
 * 왼쪽: 시트 목록(행 수·추가·변경·삭제·상태·선택), 오른쪽: 선택 시트의 오류·경고와 바뀌는 행. 아래: 배정 초기화 확인 + 적용.
 */
(function () {
  'use strict';
  const R = window.R;
  const esc = R.esc;
  const D = R.KBO.Dates;

  function mockSheets(src) {
    if (src === 'rule-slots') return [{ id: 'slots', name: '슬롯', rows: 45, add: 0, chg: 0, del: 0, issues: [], note: '규칙(3연전 우선 분할)으로 만든 초안 · 현재 슬롯 표와 날짜·연전·가중치가 같습니다.', changes: [] }];
    if (src === 'rule-series') return [{ id: 'series', name: '시리즈', rows: 225, add: 0, chg: 6, del: 0, issues: [{ kind: 'warn', loc: '시리즈 · 홈/원정 분배', msg: '구단쌍 9:6 분배를 규칙으로 다시 정했습니다. 6행의 홈·원정이 바뀝니다.' }], changes: [['~', '41행', 'KT @ 두산 → 두산 @ KT'], ['~', '88행', '롯데 @ NC → NC @ 롯데'], ['~', '132행', 'LG @ KIA → KIA @ LG']] }];
    return [
      { id: 'slots', name: '슬롯', rows: 46, add: 1, chg: 2, del: 0, issues: [
        { kind: 'error', loc: '슬롯 18행 B열(연전)', msg: '값 5 — 연전은 2~4입니다. 4인가요?', fix: '4' },
        { kind: 'warn', loc: '슬롯 31행 D열(휴일가중치)', msg: '비어 있어 규칙으로 채웠습니다 (자동 2).' }],
        changes: [['+', '46행', '8/30(토)~8/31(일) 2연전 · 주말 · 메모 “예비일”'], ['~', '18행', '5/20(화) 연전 3 → 5'], ['~', '31행', '7/1(화) 메모 “장마 예비”']] },
      { id: 'series', name: '시리즈', rows: 225, add: 0, chg: 3, del: 0, issues: [
        { kind: 'error', loc: '시리즈 12행 C열(원정)', msg: "알 수 없는 구단 'LGG' — 'LG'인가요?", fix: 'LG' }],
        changes: [['~', '12행', '키움 @ 한화 → LGG @ 키움'], ['~', '57행', '메모 “우천 순연분”'], ['~', '140행', '메모 “개막 시리즈 재대결”']] },
      { id: 'holidays', name: '공휴일', rows: 11, add: 1, chg: 0, del: 0, issues: [], changes: [['+', '11행', '6/3(화) 임시공휴일 (대통령 선거일)']] },
      { id: 'exceptions', name: '휴식예외일', rows: 1, add: 0, chg: 0, del: 0, issues: [], changes: [] },
      { id: 'blackouts', name: '경기없는기간', rows: 2, add: 0, chg: 0, del: 0, issues: [], changes: [] },
      { id: 'events', name: '이벤트', rows: 7, add: 1, chg: 0, del: 0, issues: [{ kind: 'warn', loc: '이벤트 7행 G열(구장)', msg: "구장 '사직'을 '사직야구장'으로 읽었습니다." }], changes: [['+', '7행', '광복절 매치 · 8/15(금) · 대진 롯데 @ 삼성']] },
      { id: 'guide', name: '안내', rows: 18, ignored: true, issues: [], changes: [] }
    ];
  }

  R.startImport = function (src, opts) {
    const o = opts || {};
    const sheets = mockSheets(src);
    const imp = { src, stage: src === 'gsheet' && !o.stage ? 'connect' : 'reading', sheets, selected: new Set(), focus: sheets[0].id, confirm: false, file: src === 'gsheet' ? '구글 시트 · 2025 KBO 편성(공유)' : src.startsWith('rule') ? (src === 'rule-slots' ? '규칙으로 만든 슬롯 초안' : '구단쌍 규칙 시리즈 초안') : '2025_KBO_정규시즌_편성_v3.xlsx', url: R.ls.get('gsheet-url') || 'https://docs.google.com/spreadsheets/d/1Kb0-2025-Schedule-Demo/edit#gid=0' };
    for (const s of sheets) if (!s.ignored && !s.issues.some((x) => x.kind === 'error') && (s.add || s.chg || s.del || src.startsWith('rule'))) imp.selected.add(s.id);
    if (o.stage === 'confirm') {
      for (const s of sheets) { s.issues = s.issues.filter((x) => x.kind !== 'error'); s.fixed = true; s.changes = s.changes.map((c) => [c[0], c[1], c[2].replace('LGG', 'LG').replace('연전 3 → 5', '연전 3 → 4')]); if (!s.ignored && (s.add || s.chg)) imp.selected.add(s.id); }
      imp.focus = 'series';
      imp.stage = 'preview';
      imp.confirmFocus = true;
    }
    R.imp = imp;
    R.ui.menu = null;
    R.openModal('import');
    if (imp.stage === 'reading') {
      if (o.instant) imp.stage = 'preview';
      else setTimeout(() => { if (R.imp === imp) { imp.stage = 'preview'; R.render(); } }, 650);
    }
  };

  function needsReset(imp) { return imp.selected.has('slots') || imp.selected.has('series'); }
  function errCount(s) { return s.issues.filter((x) => x.kind === 'error').length; }

  function render() {
    const imp = R.imp;
    if (!imp) return '';
    const head = '<header class="modal-h">' + R.icon(imp.src === 'gsheet' ? 'link' : 'sheet') + '<h2>' + (imp.src.startsWith('rule') ? '보조 생성 미리보기' : '가져오기 미리보기') + '</h2><span class="muted">' + esc(imp.file) + '</span>' + R.mock('목업 — 미리 준비한 결과') + '<button class="ibtn" data-act="modal-close" aria-label="닫기">×</button></header>';
    if (imp.stage === 'connect') {
      const id = (/\/d\/([^/]+)/.exec(imp.url) || [])[1] || '';
      return head + '<div class="modal-b"><div class="gs">' +
        '<div class="field"><label for="gs-url">구글 시트 공유 링크</label><input class="inp" id="gs-url" value="' + esc(imp.url) + '" data-live="gs-url"></div>' +
        '<div class="gs-meta"><span>문서 ID <code>' + esc(id) + '</code></span><span class="muted">마지막 연결 10/17(금) 18:20 · 이 브라우저에만 기억</span></div>' +
        '<div class="note">' + R.icon('warn') + '<span>“링크가 있는 모든 사용자 보기”로 공유한 시트만 읽습니다(읽기 전용). <b>링크를 아는 누구나 시트를 볼 수 있습니다.</b></span></div>' +
        '<div class="sect"><div class="sect-h"><h3>찾은 시트 탭</h3><span class="hint">탭 이름이 고정 시트명과 같아야 읽습니다</span></div><ul class="gs-tabs">' +
        ['슬롯', '시리즈', '공휴일', '휴식예외일', '경기없는기간', '이벤트', '안내'].map((t) => '<li>' + R.stIcon(t === '안내' ? 'todo' : 'ok') + '<b>' + t + '</b><span class="hint">' + (t === '안내' ? '가져올 때 무시' : 'CSV 받기 가능') + '</span></li>').join('') + '</ul></div>' +
        '<div class="note">' + R.icon('todo') + '<span>파일로 열면(file://) 브라우저가 요청을 막을 수 있어, 실제 제품에서는 로컬 서버로 열 때만 켭니다. 자동 동기화는 하지 않고 <b>다시 불러오기</b>로만 갱신합니다.</span></div>' +
        '</div></div><footer class="modal-f"><button class="btn" data-act="modal-close">취소</button><span class="grow"></span><button class="btn btn-primary" data-act="imp-load">' + R.icon('download') + '시트 불러오기</button></footer>';
    }
    if (imp.stage === 'reading') return head + '<div class="modal-b"><div class="reading">' + R.icon('run', 'spin') + '<b>시트를 읽고 검증하는 중…</b><span class="hint">7개 시트 · 약 300행</span></div></div>';
    const sheets = imp.sheets;
    const totalErr = sheets.reduce((a, s) => a + errCount(s), 0);
    const totalWarn = sheets.reduce((a, s) => a + s.issues.filter((x) => x.kind === 'warn').length, 0);
    let left = '<table class="tbl imp-tbl"><thead><tr><th></th><th>시트</th><th class="n">행</th><th class="n">추가</th><th class="n">변경</th><th class="n">삭제</th><th>상태</th></tr></thead><tbody>';
    for (const s of sheets) {
      const e = errCount(s);
      const w = s.issues.length - e;
      const none = !s.ignored && !s.add && !s.chg && !s.del && !imp.src.startsWith('rule');
      const can = !s.ignored && !e;
      left += '<tr class="' + (imp.focus === s.id ? 'sel' : '') + (e ? ' err' : '') + '" data-act="imp-focus" data-id="' + s.id + '"><td><input type="checkbox" aria-label="' + s.name + ' 적용" data-in="imp-pick" data-id="' + s.id + '"' + (imp.selected.has(s.id) ? ' checked' : '') + (can ? '' : ' disabled') + '></td><td><b>' + s.name + '</b></td><td class="n">' + (s.rows || 0) + '</td>' +
        (s.ignored ? '<td colspan="3" class="muted">설명용 — 무시</td>' : '<td class="n' + (s.add ? ' d-add' : ' muted') + '">' + (s.add ? '+' + s.add : '·') + '</td><td class="n' + (s.chg ? ' d-chg' : ' muted') + '">' + (s.chg ? '~' + s.chg : '·') + '</td><td class="n' + (s.del ? ' d-del' : ' muted') + '">' + (s.del ? '−' + s.del : '·') + '</td>') +
        '<td>' + (s.ignored ? R.st('todo', '무시') : e ? R.st('block', '오류 ' + e) : w ? R.st('warn', '경고 ' + w) : none ? R.st('todo', '변경 없음') : R.st('ok', '적용 가능')) + '</td></tr>';
    }
    left += '</tbody></table><p class="hint imp-hint">오류가 있는 시트는 고치기 전까지 고를 수 없습니다. 시트 단위로 통째 교체합니다.</p>';
    const f = sheets.find((s) => s.id === imp.focus) || sheets[0];
    let right = '<div class="sect-h"><h3>' + f.name + '</h3><span class="hint">' + (f.ignored ? '가져올 때 무시하는 설명 시트' : '시트 · 행 · 열(머리글) 순으로 표시') + '</span></div>';
    if (f.note) right += '<div class="note">' + R.icon('ok') + '<span>' + esc(f.note) + '</span></div>';
    if (f.issues.length) {
      right += '<ul class="issues">' + f.issues.map((x, i) => '<li class="iss ' + x.kind + '">' + R.icon(x.kind === 'error' ? 'block' : 'warn') + '<div><b>' + esc(x.loc) + '</b><span>' + esc(x.msg) + '</span></div>' + (x.fix != null ? '<button class="btn btn-sm" data-act="imp-fix" data-id="' + f.id + '" data-i="' + i + '">\'' + esc(x.fix) + '\'로 고치기</button>' : '') + '</li>').join('') + '</ul>';
    } else if (!f.ignored) right += '<div class="note">' + R.icon('ok') + '<span>' + (f.fixed ? '오류를 고쳤습니다. 이 시트를 적용할 수 있습니다.' : '오류·경고 없음') + '</span></div>';
    if (f.changes.length) right += '<div class="sect"><div class="sect-h"><h3>바뀌는 행</h3><span class="hint">현재 상태 대비</span></div><table class="tbl"><tbody>' + f.changes.map((c) => '<tr><td class="n chg-k ' + (c[0] === '+' ? 'd-add' : c[0] === '−' ? 'd-del' : 'd-chg') + '">' + c[0] + '</td><td class="muted">' + c[1] + '</td><td>' + esc(c[2]) + '</td></tr>').join('') + '</tbody></table></div>';
    const reset = needsReset(imp);
    const canApply = imp.selected.size > 0 && (!reset || imp.confirm);
    const body = '<div class="modal-b imp"><div class="imp-sum"><div class="kpis k4">' + R.kpi('시트', sheets.filter((s) => !s.ignored).length, '안내 시트 제외') + R.kpi('오류', totalErr, totalErr ? '고쳐야 적용' : '모두 해결', totalErr ? 'k-bad' : 'k-ok') + R.kpi('경고', totalWarn, '적용은 가능') + R.kpi('선택', imp.selected.size + '<small>시트</small>', '적용할 시트') + '</div></div>' +
      '<div class="imp-split"><div class="imp-l">' + left + '</div><div class="imp-r">' + right + '</div></div></div>';
    const foot = '<footer class="modal-f imp-f">' + (reset ? '<label class="confirm' + (imp.confirmFocus ? ' attn' : '') + '"><input type="checkbox" data-in="imp-confirm"' + (imp.confirm ? ' checked' : '') + '>' + R.icon('warn') + '<span><b>현재 배정(225 시리즈)이 초기화됩니다.</b> 슬롯·시리즈가 바뀌면 엔진을 다시 돌려야 합니다. 확인했습니다.</span></label>' : '<span class="hint">배정(plan)은 그대로 둡니다.</span>') +
      '<span class="grow"></span><span class="hint snapnote">적용 직전 상태를 “가져오기 전 — ' + nowHM() + '” 스냅샷으로 저장 · 실행 취소 1단계</span><button class="btn" data-act="modal-close">취소</button><button class="btn btn-primary" data-act="imp-apply"' + (canApply ? '' : ' disabled') + '>' + imp.selected.size + '개 시트 적용</button></footer>';
    return head + body + foot;
  }
  function nowHM() { const t = new Date(); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); }

  R.modals.import = { title: '가져오기 미리보기', cls: 'modal-imp', render };

  Object.assign(R.act, {
    import(el) { const src = el.getAttribute('data-src'); if (R.locked()) return R.toast('엔진 실행 중에는 가져올 수 없습니다.', 'warn'); R.startImport(src); },
    'imp-load'() { const imp = R.imp; R.ls.set('gsheet-url', imp.url); imp.stage = 'reading'; R.render(); setTimeout(() => { if (R.imp === imp) { imp.stage = 'preview'; R.render(); } }, 650); },
    'imp-focus'(el, e) { if (e && e.target.matches('input')) return; R.imp.focus = el.getAttribute('data-id'); R.render(); },
    'imp-fix'(el) {
      const s = R.imp.sheets.find((x) => x.id === el.getAttribute('data-id'));
      const i = +el.getAttribute('data-i');
      const iss = s.issues[i];
      s.issues.splice(i, 1);
      s.fixed = true;
      s.changes = s.changes.map((c) => [c[0], c[1], c[2].replace("LGG", iss.fix).replace('연전 3 → 5', '연전 3 → 4')]);
      if (!errCount(s)) R.imp.selected.add(s.id);
      R.toast(iss.loc + ' → \'' + iss.fix + '\'로 고쳤습니다 (미리보기 안에서만).', 'ok');
      R.render();
    },
    'imp-apply'() {
      const imp = R.imp;
      if (!imp || !imp.selected.size) return;
      if (needsReset(imp) && !imp.confirm) return;
      const label = '가져오기 전 — ' + nowHM();
      R.store.addSnapshot(label);
      const picked = Array.from(imp.selected);
      R.commit('가져오기 적용: ' + picked.map((id) => imp.sheets.find((s) => s.id === id).name).join('·'), (s) => {
        if (imp.selected.has('holidays') && !s.settings.holidays.some((h) => h.date === '2025-06-03')) { s.settings.holidays.push({ date: '2025-06-03', name: '임시공휴일' }); s.settings.holidays.sort((a, b) => (a.date < b.date ? -1 : 1)); }
        if (imp.selected.has('events') && !s.events.some((e) => e.id === 'ev-0815')) s.events.push({ id: 'ev-0815', type: 'CUSTOM', name: '광복절 매치', date: '2025-08-15', mode: 'MATCH', home: '삼성', away: '롯데' });
        if (needsReset(imp)) s.plan.forEach((p) => { p.calendar = -1; });
      });
      const t = new Date();
      R.lastImport = { file: imp.file, sheets: picked.length, at: (t.getMonth() + 1) + '/' + t.getDate() + ' ' + nowHM() };
      R.imp = null;
      R.closeModal();
      R.toast(picked.length + '개 시트를 적용했습니다' + (needsReset(imp) ? ' · 배정이 초기화되어 ②에서 엔진을 다시 돌려야 합니다' : '') + '. 실행 취소로 되돌릴 수 있습니다.', 'ok', 4500);
    }
  });
  R.inputs['imp-pick'] = (el) => { const id = el.getAttribute('data-id'); if (el.checked) R.imp.selected.add(id); else R.imp.selected.delete(id); R.render(); };
  R.inputs['imp-confirm'] = (el) => { R.imp.confirm = el.checked; R.render(); };
  R.inputs['gs-url'] = (el) => { R.imp.url = el.value; };
  void D;
})();
