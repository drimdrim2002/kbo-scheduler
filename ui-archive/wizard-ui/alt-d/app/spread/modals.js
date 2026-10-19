/*
 * alt-d — 모달: 가져오기 미리보기(FR-X3~X5, 목업 파싱) · 구글 시트 연결(FR-X2, 목업) · 보조 생성 미리보기(FR-X9) · 설정(§3.6, FR-F)
 */
(function () {
  'use strict';
  const SP = window.SP;
  const KBO = window.KBO;
  const { Dates, CalendarGen } = KBO;
  const { esc, fmt } = SP;
  const app = SP.app;
  const ui = SP.ui;
  const URL_KEY = 'kbo-spread:gsheet-url';
  const DEMO_URL = 'https://docs.google.com/spreadsheets/d/1Kb0-2025sEaSoN-dRaFt7xQ/edit#gid=0';

  SP.sheetUrl = function () { try { return localStorage.getItem(URL_KEY) || ''; } catch (e) { return ''; } };
  function rememberUrl(u) { try { localStorage.setItem(URL_KEY, u); } catch (e) { /* 저장소 없음: 무시 */ } }

  // ───────────── 가져오기 미리보기 (목업 결과) ─────────────
  function mockImport(source) {
    const st = app.state;
    return {
      source,
      title: source === 'gsheet' ? '구글 시트 · 2025 KBO 시즌 데이터' : '2025_KBO_시즌데이터_v3.xlsx',
      sub: source === 'gsheet' ? '문서 ID 1Kb0-2025sEaSoN-dRaFt7xQ · 탭 7개 읽음 · 0.4초' : '파일 182KB · 시트 7개 · 0.3초',
      resetOk: false,
      sheets: [
        { name: '슬롯', rows: 45, add: 0, chg: 2, del: 0, sel: true, target: 'slots', issues: [
          { id: 's1', level: 'warn', loc: '슬롯 22행 E열(휴일가중치)', msg: '비어 있어 규칙으로 채웠습니다 → 2 (자동)' },
          { id: 's2', level: 'warn', loc: '슬롯 14~15행 A열(시작일)', msg: '시작일 순서가 바뀌어 있어 정렬했습니다.' }] },
        { name: '시리즈', rows: 225, add: 2, chg: 4, del: 2, sel: true, target: 'series', issues: [
          { id: 'e1', level: 'error', loc: '시리즈 12행 C열(원정)', msg: '알 수 없는 구단 \'LGG\' — \'LG\'인가요?', fix: 'LG', fixLabel: '\'LG\'(으)로 고치기' },
          { id: 'e2', level: 'error', loc: '시리즈 87행 B·C열(홈·원정)', msg: '홈과 원정이 같습니다 (\'KT\' = \'KT\'). 같은 행 메모: "KIA 원정"', fix: 'KIA', fixLabel: '원정을 \'KIA\'로' },
          { id: 'w1', level: 'warn', loc: '시리즈 F열(비고2)', msg: '모르는 열 \'비고2\'는 무시합니다.' }] },
        { name: '공휴일', rows: st.settings.holidays.length + 1, add: 1, chg: 0, del: 0, sel: true, target: 'season', issues: [
          { id: 'w2', level: 'warn', loc: '공휴일 4행', msg: '6/3(화) \'임시공휴일\' 추가 — 6/3(화) 3연전 슬롯의 휴일가중치가 0 → 2로 바뀝니다.' }] },
        { name: '휴식예외일', rows: (st.settings.restExceptions || []).length, add: 0, chg: 0, del: 0, sel: false, target: 'season', issues: [] },
        { name: '경기없는기간', rows: st.settings.blackouts.length, add: 0, chg: 0, del: 0, sel: false, target: 'season', issues: [] },
        { name: '이벤트', rows: st.events.length, add: 0, chg: 1, del: 0, sel: true, target: 'events', issues: [
          { id: 'w3', level: 'warn', loc: '이벤트 6행 G열(구장)', msg: '\'잠실, 고척, 대전, 창원, 사직\' 같은 이름·날짜 행 5개를 하나로 합쳤습니다.' }] },
        { name: '안내', rows: 12, add: 0, chg: 0, del: 0, sel: false, ignore: true, target: null, issues: [] }
      ]
    };
  }
  function draftPreview(kind) {
    const st = app.state;
    if (kind === 'slots') {
      const gen = CalendarGen.generateSlots(st.settings).slots;
      const cur = new Map(st.calendar.map((c) => [c.datetime, c]));
      const nw = new Map(gen.map((c) => [c.datetime, c]));
      let add = 0, chg = 0, del = 0;
      for (const g of gen) { const c = cur.get(g.datetime); if (!c) add++; else if (c.consecutive !== g.consecutive || c.weekend !== g.weekend || c.holiday !== g.holiday) chg++; }
      for (const c of st.calendar) if (!nw.has(c.datetime)) del++;
      return { source: 'draft-slots', title: '규칙으로 만든 슬롯 초안', sub: '§5.2.1 규칙 · 3연전 우선 · 개막 ' + fmt.date(st.settings.seasonStart) + ' ~ ' + fmt.date(st.settings.initialEnd), resetOk: false,
        sheets: [{ name: '슬롯 (초안)', rows: gen.length, add, chg, del, sel: true, target: 'slots', issues: add + chg + del ? [] : [{ id: 'i1', level: 'warn', loc: '슬롯 전체', msg: '현재 슬롯 45개와 날짜·연전 수·가중치가 모두 같습니다. 적용해도 바뀌지 않습니다.' }] }] };
    }
    const g = app.generateSeriesPreview();
    const key = (m) => m.home + '|' + m.away + '|' + m.consecutive;
    const cnt = (list) => { const o = {}; for (const m of list) o[key(m)] = (o[key(m)] || 0) + 1; return o; };
    const a = cnt(st.matches), b = cnt(g.matches);
    let add = 0, del = 0;
    for (const k of Object.keys(b)) add += Math.max(0, b[k] - (a[k] || 0));
    for (const k of Object.keys(a)) del += Math.max(0, a[k] - (b[k] || 0));
    return { source: 'draft-series', title: '구단쌍 규칙으로 만든 시리즈 초안', sub: '구단쌍 ' + st.settings.initialGamesPerPair + '경기 · 홈/원정 ' + st.settings.homeGamesMajor + ':' + (st.settings.initialGamesPerPair - st.settings.homeGamesMajor) + ' · 연전 분포는 슬롯과 같게', resetOk: false,
      sheets: [{ name: '시리즈 (초안)', rows: g.matches.length, add, chg: 0, del, sel: true, target: 'series', issues: (g.errors || []).map((e, i) => ({ id: 'g' + i, level: 'error', loc: '시리즈 생성', msg: e })).concat((g.warnings || []).map((w, i) => ({ id: 'w' + i, level: 'warn', loc: '시리즈 생성', msg: w }))) }] };
  }

  SP.act.importStart = (el) => {
    if (SP.isRunning()) { SP.toast('엔진 실행 중에는 가져올 수 없습니다.', 'warn'); return; }
    SP.imp = mockImport(el.dataset.arg || 'xlsx');
    SP.openModal('import');
  };
  SP.act.draft = (el) => { if (SP.isRunning()) { SP.toast('엔진 실행 중에는 바꿀 수 없습니다.', 'warn'); return; } SP.imp = draftPreview(el.dataset.arg); SP.openModal('import'); };
  SP.act.impSheet = (el) => { const s = SP.imp.sheets[Number(el.dataset.arg)]; if (!s.ignore) s.sel = el.checked; SP.render(); };
  SP.act.impFix = (el) => { for (const s of SP.imp.sheets) for (const i of s.issues) if (i.id === el.dataset.arg) i.done = true; SP.render(); };
  SP.act.impReset = (el) => { SP.imp.resetOk = el.checked; SP.render(); };
  SP.act.impApply = () => {
    const imp = SP.imp;
    const sel = imp.sheets.filter((s) => s.sel && !s.ignore);
    const needsReset = sel.some((s) => s.target === 'slots' || s.target === 'series');
    if (imp.source === 'draft-slots') { app.saveSnapshot('초안 적용 전 — ' + fmt.clock(new Date().toISOString())); app.regenerateSlots(); SP.closeModal(); return; }
    if (imp.source === 'draft-series') { app.saveSnapshot('초안 적용 전 — ' + fmt.clock(new Date().toISOString())); app.regenerateSeries(); SP.closeModal(); return; }
    const snapName = '가져오기 전 — ' + fmt.clock(new Date().toISOString());
    app.saveSnapshot(snapName);
    app.commit('가져오기 적용: 시트 ' + sel.length + '개', (s) => {
      if (sel.some((x) => x.name === '공휴일') && !s.settings.holidays.some((h) => h.date === '2025-06-03')) { s.settings.holidays.push({ date: '2025-06-03', name: '임시공휴일' }); s.settings.holidays.sort((a, b) => (a.date < b.date ? -1 : 1)); }
      if (needsReset) { for (const p of s.plan) if (!s.matches[p.match].pinned) p.calendar = -1; }
      s.meta.spread = s.meta.spread || {};
      s.meta.spread.lastImport = { at: new Date().toISOString(), source: imp.title, sheets: sel.length };
      if (needsReset) s.meta.spread.confirmed = Object.assign({}, s.meta.spread.confirmed, { 1: false, 2: false, 3: false });
    }, ['calendar', 'plan', 'settings']);
    SP.closeModal();
    SP.toast('가져오기 적용 (목업 파싱): 시트 ' + sel.length + '개 · 자동 스냅샷 \'' + snapName + '\'' + (needsReset ? ' · 배정 초기화 — 제2장에서 엔진을 다시 실행하세요' : ''), 'ok', 6000);
  };

  function importModal() {
    const imp = SP.imp || (SP.imp = mockImport('xlsx'));
    const draft = imp.source.indexOf('draft') === 0;
    const open = (s) => s.issues.filter((i) => i.level === 'error' && !i.done).length;
    const sel = imp.sheets.filter((s) => s.sel && !s.ignore);
    const blocked = sel.filter((s) => open(s) > 0);
    const needsReset = sel.some((s) => s.target === 'slots' || s.target === 'series');
    const canApply = sel.length && !blocked.length && (!needsReset || imp.resetOk);
    const cnt = (n, cls, sign) => '<span class="' + (n ? cls : 'sp-cnt-0') + '">' + sign + n + '</span>';
    let h = '<div class="sp-modal-h"><h2 id="sp-modal-t">' + (draft ? '보조 생성 미리보기' : '가져오기 미리보기') + '</h2><span class="sp-modal-s">' + esc(imp.title) + ' · ' + esc(imp.sub) + '</span> ' + SP.mock(draft ? '실제 규칙 계산' : '목업 파싱') +
      '<button type="button" class="sp-x" data-act="closeModal" aria-label="닫기">✕</button></div>';
    h += '<div class="sp-modal-b"><div class="sp-steps" aria-label="단계"><span>① ' + (draft ? '규칙으로 생성' : imp.source === 'gsheet' ? '구글 시트 읽기' : '파일 읽기') + ' ✔</span><span class="sp-on">② 미리보기 · 시트 고르기</span><span>③ 적용 (자동 스냅샷 + 실행 취소 1단계)</span></div>';
    h += '<div class="sp-imp"><div>' + SP.cap('표 P.1', '시트별 변경', '현재 상태 대비 · 시트 단위 전체 교체') +
      '<div class="sp-scroll" style="flex:1;background:var(--sheet);border-bottom:2px solid var(--ink)"><table class="sp-table"><thead><tr><th style="width:34px"><span class="sp-sr">적용</span></th><th>시트</th><th class="sp-num">행</th><th class="sp-num">추가</th><th class="sp-num">변경</th><th class="sp-num">삭제</th><th>상태</th></tr></thead><tbody>';
    imp.sheets.forEach((s, i) => {
      const e = open(s), w = s.issues.filter((x) => x.level === 'warn').length;
      const state = s.ignore ? '<span class="sp-muted">설명 시트 — 무시</span>' : e ? SP.chip('bad', '오류 ' + e + ' · 적용 불가') : w ? SP.chip('warn', '경고 ' + w) : (s.add + s.chg + s.del) ? SP.chip('ok', '적용 가능') : SP.chip('muted', '변경 없음');
      h += '<tr><td class="sp-c"><input type="checkbox" data-chg="impSheet" data-arg="' + i + '" aria-label="' + esc(s.name) + ' 적용"' + (s.sel && !s.ignore ? ' checked' : '') + (s.ignore ? ' disabled' : '') + '></td><td><b>' + esc(s.name) + '</b></td><td class="sp-num">' + s.rows + '</td><td class="sp-num">' + cnt(s.add, 'sp-cnt-add', '+') + '</td><td class="sp-num">' + cnt(s.chg, 'sp-cnt-chg', '~') + '</td><td class="sp-num">' + cnt(s.del, 'sp-cnt-del', '−') + '</td><td>' + state + '</td></tr>';
    });
    h += '</tbody></table></div><p class="sp-note-s">파일에 없는 시트는 바꾸지 않습니다. 오류가 있는 시트는 고치거나 선택을 해제해야 적용할 수 있습니다.</p></div>';
    const issues = [];
    imp.sheets.forEach((s) => s.issues.forEach((x) => issues.push([s, x])));
    issues.sort((a, b) => (a[1].level === b[1].level ? 0 : a[1].level === 'error' ? -1 : 1));
    const ne = issues.filter(([, x]) => x.level === 'error' && !x.done).length, nw = issues.filter(([, x]) => x.level === 'warn').length;
    h += '<div>' + SP.cap('표 P.2', '오류 · 경고', '✖ 오류 ' + ne + ' · ⚠ 경고 ' + nw + ' · 위치는 시트 · 행 · 열(머리글)') + '<div class="sp-scroll" style="flex:1" data-sk="issues">' +
      (issues.length ? issues.map(([s, x]) => '<div class="sp-issue' + (x.done ? ' sp-issue-done' : x.level === 'warn' ? ' sp-issue-warn' : '') + '"><span class="sp-issue-loc">' + esc(x.loc) + '</span>' + (x.done ? '<span aria-hidden="true">✔</span> 고침 — ' : x.level === 'error' ? '<b style="color:var(--bad)"><span aria-hidden="true">✖</span> 오류</b> ' : '<b style="color:var(--warn)"><span aria-hidden="true">⚠</span> 경고</b> ') + esc(x.msg) +
        (x.fix && !x.done ? '<div class="sp-issue-fix">' + SP.btn('impFix', esc(x.fixLabel || x.fix), { arg: x.id, cls: 'sp-mini' }) + '<span class="sp-note-s">원본 시트도 같이 고쳐 두면 다음 가져오기에서 다시 나오지 않습니다.</span></div>' : '') + '</div>').join('') : '<p class="sp-note">✔ 오류·경고가 없습니다.</p>') + '</div></div></div>';
    if (needsReset) h += '<label class="sp-resetbox"><input type="checkbox" data-chg="impReset"' + (imp.resetOk ? ' checked' : '') + '><span><b>⚠ 현재 배정이 초기화됩니다.</b> 슬롯 또는 시리즈가 바뀌면 제3장의 배정(고정한 시리즈 제외)이 무효가 됩니다. 적용 직전 상태는 스냅샷 <b>\'가져오기 전 — 시각\'</b>으로 자동 저장되고 실행 취소 한 번으로 되돌릴 수 있습니다. 확인했습니다.</span></label>';
    h += '</div><div class="sp-modal-f"><span class="sp-grow">' + (blocked.length ? '⛔ ' + blocked.map((s) => '\'' + s.name + '\'').join(', ') + ' 시트에 오류가 있어 적용할 수 없습니다.' : !sel.length ? '적용할 시트를 고르세요.' : needsReset && !imp.resetOk ? '배정 초기화를 확인하면 적용할 수 있습니다.' : '✔ 시트 ' + sel.length + '개를 적용합니다.') + '</span>' +
      SP.btn('closeModal', '취소') + SP.btn('impApply', '적용 (' + sel.length + '개 시트)', { kind: 'primary', disabled: !canApply }) + '</div>';
    return h;
  }
  SP.modals.import = { size: 'wide', render: importModal };

  // ───────────── 구글 시트 연결 ─────────────
  SP.act.gsLoad = () => {
    const inp = document.getElementById('gs-url');
    const u = (inp && inp.value.trim()) || '';
    const m = u.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
    if (!m) { ui.gsError = '구글 시트 공유 링크가 아닙니다. 주소에 /spreadsheets/d/{문서 ID}/ 가 있어야 합니다.'; SP.render(); return; }
    ui.gsError = null;
    rememberUrl(u);
    SP.imp = mockImport('gsheet');
    SP.openModal('import');
  };
  SP.modals.gsheet = {
    size: 'mid',
    render() {
      const last = SP.sheetUrl();
      const tabs = ['슬롯', '시리즈', '공휴일', '휴식예외일', '경기없는기간', '이벤트'];
      return '<div class="sp-modal-h"><h2 id="sp-modal-t">구글 시트 연결</h2><span class="sp-modal-s">공유 링크로 읽기 전용</span> ' + SP.mock() + '<button type="button" class="sp-x" data-act="closeModal" aria-label="닫기">✕</button></div>' +
        '<div class="sp-modal-b"><label class="sp-field"><span>시트 공유 링크</span><input class="sp-input" id="gs-url" data-fk="gs-url" data-autofocus value="' + esc(last || DEMO_URL) + '" style="width:100%"></label>' +
        (ui.gsError ? '<p class="sp-note" style="color:var(--bad)" role="alert">✖ ' + esc(ui.gsError) + '</p>' : '') +
        '<p class="sp-note"><span aria-hidden="true">ℹ</span> "링크가 있는 모든 사용자 보기"로 공유한 시트만 읽습니다. <b>링크를 아는 누구나 이 시트를 볼 수 있다는 점</b>에 주의하세요. 링크와 문서 ID는 이 브라우저에만 저장합니다.</p>' +
        SP.cap('표 G.1', '읽을 탭', '탭 이름별로 CSV를 받는다 (gviz/tq?tqx=out:csv&sheet={탭})') +
        '<table class="sp-table"><tbody>' + tabs.map((t) => '<tr><td>' + esc(t) + '</td><td class="sp-muted">sheet=' + encodeURIComponent(t) + '</td></tr>').join('') + '</tbody></table>' +
        '<p class="sp-note-s">비공개 시트, 없는 탭, 네트워크 오류는 원인별로 알려 줍니다. 자동 동기화는 하지 않으며 데이터 메뉴의 \'다시 불러오기\'로 다시 읽습니다. file://에서 CORS로 막히면 로컬 서버로 엽니다.</p></div>' +
        '<div class="sp-modal-f"><span class="sp-grow">' + (last ? '마지막 연결: ' + esc(last.slice(0, 60)) + '…' : '처음 연결합니다.') + '</span>' + SP.btn('closeModal', '취소') + SP.btn('gsLoad', '불러오기', { kind: 'primary' }) + '</div>';
    }
  };

  // ───────────── 설정 ─────────────
  SP.act.feature = (el) => {
    const id = el.dataset.arg;
    const f = KBO.Features.BY_ID[id];
    if (!f || f.must) return;
    const v = !SP.on(id);
    app.store.commit('기능 ' + (v ? '켜기' : '끄기') + ': ' + f.name, (s) => { s.meta.features = Object.assign({}, s.meta.features, { [id]: v }); }, { undo: false, tags: ['features'] });
    SP.toast(f.name + ' — ' + (v ? '켰습니다' : '껐습니다. 화면에서 사라졌습니다'), 'info');
  };
  SP.act.featureReset = () => { app.store.commit('기능 기본값', (s) => { s.meta.features = KBO.Features.defaults(); }, { undo: false, tags: ['features'] }); SP.toast('기능 목록을 기본값으로 되돌렸습니다.', 'info'); };
  SP.act.h0e = (el) => app.setH0eMode(el.dataset.arg);
  SP.act.engineKind = (el) => app.setEngineConfig({ kind: el.dataset.arg });
  SP.act.kakao = (el) => { app.setKakaoKey ? app.setKakaoKey(el.value.trim()) : null; SP.toast(el.value.trim() ? 'Kakao 키를 저장했습니다 (시안에서는 지도 로드 생략)' : 'Kakao 키를 지웠습니다 — 내장 SVG 지도', 'info'); };
  SP.act.refDate = (el) => app.updateSettings({ referenceDate: el.value }, '기준일 변경');
  SP.act.importJson = () => app.importFile();
  SP.act.resetAll = () => { SP.confirm('처음 상태로', '<p>작업 내용을 지우고 2025 프리셋(가상 위반 3건 포함)으로 되돌립니다.</p>', '되돌리기', 'bad').then((ok) => { if (ok) { try { localStorage.removeItem('kbo-opus:alt-d:v1'); } catch (e) { /* 무시 */ } location.reload(); } }); };

  SP.modals.settings = {
    size: 'wide',
    render() {
      const st = app.state;
      const groups = {};
      for (const f of KBO.Features.LIST) (groups[f.group] = groups[f.group] || []).push(f);
      let ft = '<table class="sp-table"><thead><tr><th style="width:48px">켜기</th><th>기능</th><th>설명</th><th style="width:64px">ID</th><th style="width:76px">기본값</th></tr></thead><tbody>';
      for (const g of Object.keys(groups)) {
        ft += '<tr><td colspan="5" style="background:var(--paper-2);font-family:var(--serif);font-weight:700;height:22px">' + esc(g) + '</td></tr>';
        for (const f of groups[g]) {
          const on = SP.on(f.id);
          ft += '<tr><td class="sp-c">' + (f.must ? '<span class="sp-lockmark" title="Must 기능은 끌 수 없습니다"><span aria-hidden="true">⊘</span> 잠금</span>' : '<button type="button" class="sp-switch" role="switch" aria-checked="' + on + '" aria-label="' + esc(f.name) + '" data-act="feature" data-arg="' + f.id + '"></button>') + '</td><td><b>' + esc(f.name) + '</b></td><td class="sp-muted" style="white-space:normal">' + esc(f.desc) + '</td><td class="sp-muted">' + esc(f.ref) + '</td><td>' + (f.must ? '<span class="sp-chip sp-chip-info">항상 켜짐</span>' : f.def ? '켜짐' : '꺼짐') + '</td></tr>';
        }
      }
      ft += '</tbody></table>';
      const mode = st.settings.h0eMode;
      const eng = app.engineConfig.kind;
      return '<div class="sp-modal-h"><h2 id="sp-modal-t">설정</h2><span class="sp-modal-s">이 프로젝트에 저장 · 자동 저장과 JSON 내보내기에 포함</span><button type="button" class="sp-x" data-act="closeModal" aria-label="닫기">✕</button></div>' +
        '<div class="sp-modal-b"><div class="sp-setgrid"><div>' + SP.cap('표 C.1', '기능 켜기·끄기', '끈 기능은 화면에서 사라지고 계산도 하지 않는다 · 채점에는 영향 없음') + '<div class="sp-scroll" style="flex:1;background:var(--sheet);border-bottom:2px solid var(--ink)" data-sk="features">' + ft + '</div></div>' +
        '<div style="overflow-y:auto" data-sk="settings-r">' +
        '<fieldset class="sp-fset"><legend>채점 · H0-e 이벤트 홈 의무</legend><div class="sp-seg" role="group">' + SP.btn('h0e', '구장 기준 <small>(기본)</small>', { arg: 'STADIUM', pressed: mode !== 'ENGINE' }).replace('sp-btn', 'sp-segb') + SP.btn('h0e', '엔진 호환', { arg: 'ENGINE', pressed: mode === 'ENGINE' }).replace('sp-btn', 'sp-segb') + '</div><p class="sp-note-s">구장 기준: 지정 구장의 연고 구단 중 하나만 홈이면 충족(잠실 = 두산·LG). 엔진 호환: Java Constants의 의무 구단 원정마다 1점. 현재 모드는 상단 배지 옆에 표시됩니다.</p></fieldset>' +
        '<fieldset class="sp-fset"><legend>엔진 연결</legend><div class="sp-seg" role="group">' + SP.btn('engineKind', 'Mock (브라우저)', { arg: 'MOCK', pressed: eng !== 'REST' }).replace('sp-btn', 'sp-segb') + SP.btn('engineKind', 'REST 서버', { arg: 'REST', pressed: eng === 'REST' }).replace('sp-btn', 'sp-segb') + '</div><div class="sp-row"><label class="sp-field sp-grow"><span>REST 주소</span><input class="sp-input" value="' + esc(app.engineConfig.baseUrl || 'http://localhost:8080') + '"' + (eng === 'REST' ? '' : ' disabled') + '></label></div><p class="sp-note-s">POST /api/v1/solve · SSE /events · 시안의 실행은 ' + SP.mock() + '</p></fieldset>' +
        '<fieldset class="sp-fset"><legend>지도 · Kakao</legend><label class="sp-field"><span>JavaScript 키 (없으면 내장 SVG 지도)</span><input class="sp-input" type="password" data-chg="kakao" value="' + esc(app.kakaoKey || '') + '" placeholder="키를 넣으면 Kakao 지도로 전환"></label></fieldset>' +
        '<fieldset class="sp-fset"><legend>운영</legend><div class="sp-row"><label class="sp-field"><span>결과 미입력 기준일</span><input class="sp-input" type="date" data-chg="refDate" value="' + esc(st.settings.referenceDate || '') + '"></label><label class="sp-field sp-grow"><span>구글 시트 URL 기억</span><input class="sp-input" value="' + esc(SP.sheetUrl() || '(연결 기록 없음)') + '" readonly></label></div></fieldset>' +
        '<fieldset class="sp-fset"><legend>데이터</legend><div class="sp-row" style="flex-wrap:wrap">' + SP.btn('exportProject', '프로젝트 JSON 내보내기') + SP.btn('importJson', '프로젝트 JSON 가져오기') + SP.btn('exportEngine', '엔진 JSON 내보내기') + SP.btn('resetAll', '처음 상태로', { kind: 'bad' }) + '</div></fieldset>' +
        '</div></div></div><div class="sp-modal-f"><span class="sp-grow">Must 기능 ' + KBO.Features.LIST.filter((f) => f.must).length + '개는 잠겨 있습니다 · 선택 기능 ' + KBO.Features.LIST.filter((f) => !f.must && SP.on(f.id)).length + '/' + KBO.Features.LIST.filter((f) => !f.must).length + '개 켜짐</span>' + SP.btn('featureReset', '기본값으로') + SP.btn('closeModal', '닫기', { kind: 'primary' }) + '</div>';
    }
  };
})();
