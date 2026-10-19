/*
 * alt-c 편성 워크북 — ① 데이터 준비.
 * 가져오기 띠(명령 띠), 시트 탭(시즌 골격 · 가져오기 시트 6종 · 구단과 거리), 한 건 편집, 검증 창 + 미리보기.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const KBO = window.KBO;
  const D = KBO.Dates;
  const B = () => WB.Book;
  const esc = WB.esc, icon = WB.icon;

  const S1 = WB.steps[1] = {};

  S1.status = function () {
    const c = B().counts();
    const b = WB.book;
    const sum = b.slots.length + ' 슬롯 · ' + b.series.length + ' 시리즈 · 이벤트 ' + b.events.length + ' · 공휴일 ' + b.holidays.length;
    if (c.error) return { kind: 'warn', label: '확인 필요', short: '⚠ 오류 ' + c.error, summary: '오류 ' + c.error + ' · 경고 ' + c.warn + ' — ' + sum };
    if (c.warn) return { kind: 'warn', label: '확인 필요', short: '⚠ 경고 ' + c.warn, summary: '경고 ' + c.warn + ' — ' + sum };
    return { kind: 'ok', label: '완료', short: '✔ 완료', summary: sum };
  };

  const sheetId = () => WB.ui.sheet[1];

  // ───────────── 명령 띠 ─────────────
  function renderCmd() {
    const id = sheetId();
    const def = B().DEFS[id];
    const rowOps = !def.ui;
    const H = WB.hist;
    const lock = WB.locked();
    let aux = '';
    if (id === 'slots') aux = '<button class="btn" data-act="gen-slots" title="시즌 골격·공휴일·예외일·경기 없는 기간으로 슬롯 초안을 만들고 미리보기로 비교합니다">' + icon('wand') + '규칙으로 초안 만들기</button>';
    else if (id === 'series') aux = '<button class="btn" data-act="gen-series" title="구단쌍 목표 경기 수와 홈/원정 분배로 시리즈 초안을 만듭니다">' + icon('wand') + '구단쌍 규칙으로 만들기</button>';
    const html =
      '<span class="grp"><span class="gl">가져오기</span>' +
      '<button class="btn" data-act="import-xlsx"' + (lock ? ' disabled' : '') + '>' + icon('up') + '.xlsx 업로드</button>' +
      '<button class="btn" data-act="import-gsheet"' + (lock ? ' disabled' : '') + '>' + icon('link') + '구글 시트 연결</button></span>' +
      '<span class="vr"></span><span class="grp"><span class="gl">양식</span>' +
      '<button class="btn" data-act="tpl-blank" title="머리글·안내 시트·예시 1행">' + icon('file') + '빈 양식</button>' +
      '<button class="btn" data-act="tpl-2025">' + icon('file') + '2025 예시</button>' +
      '<button class="btn" data-act="export-xlsx">' + icon('down') + '.xlsx 내보내기</button></span>' +
      '<span class="vr"></span><span class="grp">' +
      '<button class="btn" data-act="undo" title="실행 취소 (Ctrl+Z)' + (H.undo.length ? ': ' + esc(WB.undoLabel()) : '') + '"' + (H.undo.length && !lock ? '' : ' disabled') + ' aria-label="실행 취소">' + icon('undo') + '</button>' +
      '<button class="btn" data-act="redo" title="다시 실행 (Ctrl+Y)"' + (H.redo.length && !lock ? '' : ' disabled') + ' aria-label="다시 실행">' + icon('redo') + '</button>' +
      (rowOps ? '<button class="btn" data-act="row-above" title="선택 행 위에 삽입"' + (lock ? ' disabled' : '') + '>' + icon('rowins') + '위에 삽입</button>' +
        '<button class="btn" data-act="row-below" title="선택 행 아래에 삽입"' + (lock ? ' disabled' : '') + '>' + icon('rowins') + '아래 삽입</button>' +
        '<button class="btn" data-act="row-del" title="선택 행 삭제"' + (lock ? ' disabled' : '') + '>' + icon('rowdel') + '행 삭제</button>' : '') +
      '</span>' + (aux ? '<span class="vr"></span><span class="grp"><span class="gl">보조</span>' + aux + '</span>' : '') +
      '<span class="grow"></span><span class="note">마지막 가져오기: ' + esc(WB.ui.lastImport || '2025_일정입력_v3.xlsx · 10/17(금) 18:40') + '</span>';
    document.getElementById('cmd').innerHTML = html;
  }

  // ───────────── 시트 탭 ─────────────
  function renderTabs() {
    const id = sheetId();
    const tab = (sid) => {
      const def = B().DEFS[sid];
      const c = B().counts(sid);
      const n = sid === 'season' ? '' : sid === 'teams' ? WB.app.state.teams.length : WB.book[sid].length;
      const cnt = c.error ? '<span class="cnt error">' + icon('block') + c.error + '</span>' : c.warn ? '<span class="cnt warn">' + icon('warn') + c.warn + '</span>' : (n !== '' ? '<span class="cnt n">' + n + '</span>' : '');
      return '<button class="tab' + (sid === id ? ' on' : '') + '" role="tab" aria-selected="' + (sid === id) + '" data-sheet="' + sid + '">' + icon(def.ui ? 'grid' : 'sheet', 'tico') + esc(def.name) + cnt + (def.ui ? '<span class="ui" title="UI에서만 입력">UI</span>' : '') + '</button>';
    };
    document.getElementById('tabs').innerHTML =
      '<span class="grpl">시즌</span>' + tab('season') +
      '<span class="grpl" title="엑셀·구글 시트의 시트 이름과 같습니다">가져오기 시트 (.xlsx와 1:1)</span>' + B().IMPORT_SHEETS.map(tab).join('') +
      '<span class="grpl">구단</span>' + tab('teams');
  }

  // ───────────── 격자 ─────────────
  function headHtml(col) { return esc(col.label) + (col.req ? '<span style="color:var(--c-bad)">*</span>' : '') + ' <span style="color:var(--c-muted);font-weight:400;font-size:10.5px">' + esc(col.alias) + '</span>'; }

  function importGrid(id) {
    const def = B().DEFS[id];
    const rows = WB.book[id];
    const im = B().issueMap(id);
    const nC = def.cols.length;
    const cols = def.cols.map((c) => ({ label: c.label, h: headHtml(c), w: c.w, cls: c.cls, title: c.label + ' (' + c.alias + ')' + (c.req ? ' · 필수' : '') }))
      .concat(def.der.map((d) => ({ label: d.label, h: '<i style="font-family:Georgia,serif;color:var(--c-muted)">ƒ</i> ' + esc(d.label), w: d.w, cls: 'dv ' + (d.cls || ''), title: '계산 열 — 읽기 전용' })));
    const der = derivedFn(id);
    return {
      key: 's1-' + id, sheet: def.name, cols, rows: rows.length, fill: 2, frozen: 0,
      readOnly: WB.locked(),
      rowCls: (r) => (rows[r].__new ? 'draft' : ''),
      cell: (r, c) => {
        const row = rows[r];
        if (c >= nC) return der(r, c - nC, row);
        const col = def.cols[c];
        const v = row[col.key];
        const is = im.get(r + '|' + col.key);
        const mk = is ? { level: is.level, title: def.name + ' ' + (r + 2) + '행 ' + WB.colName(c) + '열(' + col.label + ')', text: is.msg } : null;
        if ((v === '' || v == null) && col.auto && id === 'slots') {
          const w = B().autoWeights(row);
          if (w) return { t: col.key === 'weekend' ? (w.weekend ? '예' : '아니오') : w.holiday, cls: 'auto', mk };
        }
        if ((v === '' || v == null) && row.__new && col.req) return { t: '필수 입력', cls: 'req-ph', mk };
        return { t: B().showText(col, v), mk };
      },
      edit: {
        can: (r, c) => c < nC,
        text: (r, c) => B().editText(def.cols[c], rows[r][def.cols[c].key]),
        validate: (r, c, text) => {
          const col = def.cols[c];
          const v = B().parseCell(col, text);
          const x = B().cellCheck(id, col, v);
          if (x) return x;
          if (col.type === 'date' && B().isISO(v)) return { level: 'info', msg: D.fmtDate(v) + '(으)로 읽습니다.' };
          return null;
        },
        onLive: (r, c, text, res) => fxFor(r, c, text, res),
        commit: (r, c, text) => { B().setCell(id, r, def.cols[c].key, text); WB.render(); }
      },
      onSelect: (r, c) => { fxFor(r, c); renderPane(); },
      menu: (r, c, onRowHead) => rowMenu(id, r, c, onRowHead)
    };
  }

  function derivedFn(id) {
    const rows = WB.book[id];
    if (id === 'slots') {
      let idx = 0; const num = rows.map((row) => (B().slotRange(row) ? ++idx : null));
      return (r, k, row) => {
        const rg = B().slotRange(row);
        if (!rg) return { t: '' };
        if (k === 0) return { t: D.fmtDate(rg[1]) };
        if (k === 1) return { t: D.WEEKDAY_KO[D.weekday(rg[0])] + '~' + D.WEEKDAY_KO[D.weekday(rg[1])] };
        return { t: '#' + num[r] };
      };
    }
    if (id === 'series') {
      const cum = new Map(); const out = []; const ha = new Map();
      rows.forEach((row) => {
        const k = [row.home, row.away].sort().join('|');
        const g = typeof row.games === 'number' ? row.games : 0;
        cum.set(k, (cum.get(k) || 0) + g);
        const h = ha.get(k) || {}; h[row.home] = (h[row.home] || 0) + g; ha.set(k, h);
        out.push({ cum: cum.get(k), h: Object.assign({}, h) });
      });
      const G = WB.book.season.initialGamesPerPair;
      return (r, k, row) => {
        if (k === 0) return { t: B().stadiumOf(row.home) };
        if (k === 1) return { t: row.home && row.away ? out[r].cum + ' / ' + G : '' };
        const o = out[r].h; return { t: row.home && row.away ? (o[row.home] || 0) + ':' + (o[row.away] || 0) : '' };
      };
    }
    if (id === 'holidays' || id === 'rest') {
      return (r, k, row) => {
        if (!B().isISO(row.date)) return { t: '' };
        if (k === 0) return { t: D.WEEKDAY_KO[D.weekday(row.date)] };
        const si = slotOfDate(row.date);
        return si >= 0 ? { t: D.fmtDate(WB.book.slots[si].start) + ' ' + WB.book.slots[si].games + '연전 (#' + (si + 1) + ')' } : { t: '슬롯 없음 (1차 기간 밖·휴식일)' };
      };
    }
    if (id === 'blackouts') return (r, k, row) => ({ t: B().isISO(row.start) && B().isISO(row.end) ? (D.dayNum(row.end) - D.dayNum(row.start) + 1) + '일' : '' });
    if (id === 'events') return (r, k, row) => { const si = B().isISO(row.date) ? slotOfDate(row.date) : -1; return { t: si >= 0 ? '#' + (si + 1) + ' ' + D.fmtShort(WB.book.slots[si].start) + ' ' + WB.book.slots[si].games + '연전' : '' }; };
    return () => ({ t: '' });
  }
  function slotOfDate(iso) {
    const s = WB.book.slots;
    for (let i = 0; i < s.length; i++) { const rg = B().slotRange(s[i]); if (rg && iso >= rg[0] && iso <= rg[1]) return i; }
    return -1;
  }

  function rowMenu(id, r, c, onRowHead) {
    if (WB.locked()) return [{ head: '엔진 실행 중 — 입력 잠금' }];
    const def = B().DEFS[id];
    return [
      { head: def.name + ' ' + (r + 2) + '행' },
      { label: '위에 행 삽입', icon: 'rowins', act: () => doInsert(id, r, false) },
      { label: '아래에 행 삽입', icon: 'rowins', act: () => doInsert(id, r, true) },
      { label: '행 삭제', icon: 'rowdel', act: () => doDelete(id, r) },
      '-',
      { label: '셀 편집', kb: 'F2', icon: 'sheet', disabled: c >= def.cols.length || onRowHead, act: () => { const g = document.getElementById('gridhost')._grid; if (g) g.startEdit(); } },
      { label: '셀 지우기', kb: 'Del', disabled: c >= def.cols.length || onRowHead, act: () => { B().setCell(id, r, def.cols[c].key, ''); WB.render(); } }
    ];
  }
  function doInsert(id, r, below) {
    const at = B().insertRow(id, r, below);
    WB.ui.sel['s1-' + id] = { r: at, c: 0 };
    WB.ui.flash = { key: 's1-' + id, r: at };
    WB.ui.gridFocus = 's1-' + id;
    WB.render();
    WB.toast((at + 2) + '행에 빈 행을 넣었습니다. 필수 값을 채우세요.', '', { label: '실행 취소', fn: WB.undo });
  }
  function doDelete(id, r) {
    B().deleteRow(id, r);
    WB.ui.gridFocus = 's1-' + id;
    WB.render();
    WB.toast((r + 2) + '행을 삭제했습니다.', '', { label: '실행 취소', fn: WB.undo });
  }
  S1.rowOp = function (op) {
    const id = sheetId();
    const g = document.getElementById('gridhost')._grid;
    const r = g ? g.sel.r : 0;
    if (op === 'above') doInsert(id, r, false);
    else if (op === 'below') doInsert(id, r, true);
    else doDelete(id, r);
  };

  function seasonGrid() {
    const rows = B().SEASON_ROWS;
    const im = B().issueMap('season');
    return {
      key: 's1-season', sheet: '시즌 골격', rows: rows.length, fill: 1, readOnly: WB.locked(),
      cols: [{ label: '항목', w: 190 }, { label: '값', w: 150, cls: 'n' }, { label: '단위·형식', w: 96 }, { label: '설명', w: 340 }],
      cell: (r, c) => {
        const row = rows[r];
        if (c === 0) return { t: row.label, cls: 'dv' };
        if (c === 1) { const is = im.get(r + '|value'); return { t: B().seasonText(row, WB.book.season[row.key]), mk: is ? { level: is.level, title: '시즌 골격 ' + row.label, text: is.msg } : null }; }
        if (c === 2) return { t: row.unit, cls: 'dv' };
        return { t: row.desc, cls: 'dv' };
      },
      edit: {
        can: (r, c) => c === 1,
        text: (r) => { const v = WB.book.season[rows[r].key]; return v == null ? '' : String(v); },
        validate: (r, c, text) => B().seasonValidate(rows[r], B().seasonParse(rows[r], text)),
        onLive: (r, c, text, res) => fxFor(r, c, text, res),
        commit: (r, c, text) => { B().setCell('season', r, 'value', text); WB.render(); }
      },
      onSelect: (r, c) => { fxFor(r, c); renderPane(); },
      after: '<div class="note" style="padding:8px 12px;border-top:1px solid var(--c-line)">' + icon('info') + ' 시즌 골격은 가져오기 대상이 아닙니다. 내보낸 .xlsx의 <b>안내</b> 시트에 참고값으로 적힙니다. 값을 바꾸면 오른쪽 미리보기에서 슬롯 재생성 결과가 바로 바뀝니다.</div>'
    };
  }

  function teamsGrid() {
    const app = WB.app;
    const teams = app.state.teams;
    const shared = app.sharedStadiums();
    const cols = [{ label: '구단', w: 70 }, { label: '구장', w: 150 }, { label: '위도', w: 92, cls: 'n' }, { label: '경도', w: 92, cls: 'n' }, { label: '색', w: 78 }, { label: 'ƒ 공유 구장', w: 120, cls: 'dv' }, { label: 'ƒ 평균 거리(km)', w: 110, cls: 'dv n' }];
    const keys = ['name', 'stadium', 'latitude', 'longitude', 'color'];
    let heat = '';
    if (WB.feature('T7')) {
      const names = teams.map((t) => t.name);
      const max = Math.max(...app.state.distanceMatrix.map((d) => d.distance));
      heat = '<details class="heat" id="heat"' + (WB.ui.heatOpen ? ' open' : '') + '><summary>' + icon('grid') + ' 거리 행렬 (km) — 히트맵 · 대칭 편집 <span class="note">접힘 · FR-T7</span></summary><div class="heatbody"><table class="mini heatt"><tr><th></th>' + names.map((n) => '<th>' + esc(n) + '</th>').join('') + '</tr>' +
        names.map((a) => '<tr><th>' + esc(a) + '</th>' + names.map((b) => { const km = app.distanceOf(a, b) || 0; const t = a === b ? 0 : km / max; return '<td class="n" style="background:' + (a === b ? '#f1f1ef' : 'rgba(30,122,76,' + (0.06 + t * 0.5).toFixed(2) + ')') + ';color:' + (t > 0.62 ? '#fff' : 'inherit') + '">' + (a === b ? '—' : WB.fmt.km(km)) + '</td>'; }).join('') + '</tr>').join('') +
        '</table><label class="chk" style="margin-top:6px"><input type="checkbox" checked> 대칭 편집 (A→B를 바꾸면 B→A도)</label></div></details>';
    }
    return {
      key: 's1-teams', sheet: '구단과 거리', rows: teams.length, cols, fill: 1, readOnly: WB.locked(),
      cell: (r, c) => {
        const t = teams[r];
        if (c === 0) return { h: '<span class="row"><span style="width:9px;height:9px;border-radius:1px;background:' + esc(t.color) + '"></span>' + esc(t.name) + '</span>' };
        if (c === 1) return { t: t.stadium };
        if (c === 2) return { t: t.latitude.toFixed(4) };
        if (c === 3) return { t: t.longitude.toFixed(4) };
        if (c === 4) return { t: t.color, cls: 'mono' };
        if (c === 5) { const s = shared.get(t.stadium); return { t: s ? '공유: ' + s.join('·') : '' }; }
        const ds = teams.filter((x) => x.name !== t.name).map((x) => app.distanceOf(t.name, x.name) || 0);
        return { t: WB.fmt.km(ds.reduce((a, b) => a + b, 0) / ds.length) };
      },
      edit: {
        can: (r, c) => c <= 4,
        text: (r, c) => String(teams[r][keys[c]]),
        validate: (r, c, text) => { if (c >= 2 && c <= 3 && !/^-?\d+(\.\d+)?$/.test(text.trim())) return { level: 'error', msg: '좌표는 숫자입니다.' }; if (!text.trim()) return { level: 'error', msg: '비울 수 없습니다.' }; return null; },
        commit: (r, c, text) => { const patch = {}; patch[keys[c]] = c >= 2 && c <= 3 ? Number(text) : text.trim(); WB.track('구단 ' + teams[r].name + ' 수정', () => app.updateTeam(r, patch)); WB.render(); }
      },
      onSelect: (r, c) => { fxFor(r, c); renderPane(); },
      after: heat
    };
  }

  // ───────────── 수식 줄 ─────────────
  function fxFor(r, c, liveText, liveRes) {
    const id = sheetId();
    const def = B().DEFS[id];
    if (id === 'season') {
      const row = B().SEASON_ROWS[r];
      const v = WB.book.season[row.key];
      const is = B().issueMap('season').get(r + '|value');
      const res = liveRes !== undefined ? liveRes : is;
      WB.fx({ addr: '시즌 골격!' + WB.colName(c) + (r + 2), value: c === 1 ? (liveText != null ? liveText : (v == null ? '' : String(v))) : (c === 0 ? row.label : c === 2 ? row.unit : row.desc), meta: row.label + ' · ' + row.unit + ' · UI 전용', msg: res ? esc(res.msg) : '', level: res ? res.level : '' });
      return;
    }
    if (id === 'teams') {
      const t = WB.app.state.teams[r];
      WB.fx({ addr: '구단과 거리!' + WB.colName(c) + (r + 2), value: [t.name, t.stadium, t.latitude, t.longitude, t.color][c] != null ? String([t.name, t.stadium, t.latitude, t.longitude, t.color][c]) : '', meta: c > 4 ? '계산 열 · 읽기 전용' : 'UI 전용 — 시트 가져오기 대상 아님' });
      return;
    }
    const rows = WB.book[id];
    const row = rows[r];
    if (!row) { WB.fx({ addr: def.name + '!' }); return; }
    const addr = def.name + '!' + WB.colName(c) + (r + 2);
    if (c >= def.cols.length) {
      const d = def.der[c - def.cols.length];
      const x = derivedFn(id)(r, c - def.cols.length, row);
      WB.fx({ addr, value: x.t, meta: '<i>ƒ ' + esc(d.label) + '</i> · 계산 열 · 읽기 전용' });
      return;
    }
    const col = def.cols[c];
    const is = B().issueMap(id).get(r + '|' + col.key);
    const res = liveRes !== undefined ? liveRes : is;
    let value = liveText != null ? liveText : B().editText(col, row[col.key]);
    let meta = esc(col.label + ' (' + col.alias + ')') + (col.req ? ' · 필수' : '') + ' · ' + ({ date: '날짜', int: '정수' + (col.min != null ? ' ' + col.min + '~' + col.max : ''), bool: '예/아니오', team: '구단명', enum: col.options ? col.options.join('/') : '', text: '글자' }[col.type] || '');
    if ((row[col.key] === '' || row[col.key] == null) && col.auto && liveText == null) { const w = B().autoWeights(row); if (w) { value = String(col.key === 'weekend' ? w.weekend : w.holiday); meta += ' · <b>자동</b> (빈 셀 → §5.2.1 규칙)'; } }
    WB.fx({ addr, value, meta, msg: res ? esc(res.msg) + (res.fix ? ' <button class="lnk" data-fix="' + esc(id + '|' + r + '|' + col.key + '|' + res.fix.value) + '">' + esc(res.fix.label) + '</button>' : '') : '', level: res ? res.level : '' });
    // 상태 표시줄: 열 집계
    if (col.type === 'int') {
      const nums = rows.map((x) => x[col.key]).filter((v) => typeof v === 'number');
      const s = nums.reduce((a, b) => a + b, 0);
      WB.setAgg('<span>' + WB.colName(c) + '열 ' + esc(col.label) + '</span><span>개수 <b>' + nums.length + '</b></span><span>합계 <b>' + s + '</b></span><span>평균 <b>' + (nums.length ? (s / nums.length).toFixed(2) : '-') + '</b></span>');
    } else WB.setAgg('<span>' + esc(def.name) + ' ' + rows.length + '행</span>');
  }

  // ───────────── 작업 창: 검증 + 미리보기 ─────────────
  function renderPane() {
    const pane = document.getElementById('pane');
    const id = sheetId();
    const all = B().issues();
    const f = WB.ui.issFilter || 'all';
    const list = all.filter((x) => f === 'all' || x.level === f);
    const order = B().ORDER;
    list.sort((a, b) => (a.sheet === id ? -1 : 0) - (b.sheet === id ? -1 : 0) || order.indexOf(a.sheet) - order.indexOf(b.sheet) || (a.r - b.r));
    const c = B().counts();
    const sel = (WB.ui.sel['s1-' + id] || {});
    let items = '';
    let lastSheet = null;
    for (const x of list.slice(0, 120)) {
      if (x.sheet !== lastSheet) { items += '<li class="grp">' + esc(B().DEFS[x.sheet].name) + '</li>'; lastSheet = x.sheet; }
      const ci = x.sheet === 'season' ? 1 : B().DEFS[x.sheet].cols.findIndex((k) => k.key === x.key);
      const label = x.sheet === 'season' ? B().SEASON_ROWS[x.r].label : B().DEFS[x.sheet].cols[ci].label;
      const ad = B().DEFS[x.sheet].name + ' ' + (x.r + 2) + '행 ' + WB.colName(ci) + '열(' + label + ')';
      const on = x.sheet === id && sel.r === x.r && sel.c === ci;
      items += '<li class="' + (on ? 'on' : '') + '" data-goto="' + x.sheet + '|' + WB.colName(ci) + (x.r + 2) + '"><span class="ii ' + x.level + '">' + icon(x.level === 'error' ? 'block' : x.level) + '</span><span><span class="ad">' + esc(ad) + '</span><span class="tx">' + esc(x.msg) + '</span>' +
        (x.fix ? '<button class="btn sm box fixb" data-fix="' + esc(x.sheet + '|' + x.r + '|' + x.key + '|' + x.fix.value) + '">' + icon('wand') + esc(x.fix.label) + '</button>' : '') + '</span></li>';
    }
    if (!list.length) items = '<li class="empty-note" style="cursor:default">' + icon('ok') + ' 문제가 없습니다. 셀을 고치면 바로 다시 검사합니다.</li>';
    const chip = (k, t, n) => '<button class="chip' + (f === k ? ' on' : '') + '" data-iss="' + k + '">' + t + ' ' + n + '</button>';
    pane.innerHTML =
      '<div class="sec" style="flex:0 1 46%;"><div class="sh">' + icon('ok') + '검증<span class="cnt">전체 시트</span><span class="grow"></span>' + WB.st(c.error ? 'bad' : c.warn ? 'warn' : 'ok', c.error ? '오류 ' + c.error : c.warn ? '경고 ' + c.warn : '통과') + '</div>' +
      '<div class="filt">' + chip('all', '전체', all.length) + chip('error', '오류', c.error) + chip('warn', '경고', c.warn) + chip('info', '정보', c.info) + '</div>' +
      '<div class="sb flush"><ul class="iss">' + items + '</ul></div></div>' +
      '<div class="sec grow"><div class="sh">' + icon('chart') + '미리보기<span class="cnt">' + esc(B().DEFS[id].name) + '</span><span class="grow"></span><span class="note">입력 즉시 갱신</span></div><div class="sb">' + preview(id) + '</div></div>';
  }
  S1.renderPane = renderPane;

  // 시즌 띠: 월별 일자 상자 (슬롯 교대색, 휴식·경기 없는 날, 공휴일)
  function seasonStrip(slotsList, hiIndex) {
    const b = WB.book;
    const dayInfo = new Map();
    slotsList.forEach((s, i) => { const rg = B().slotRange(s); if (!rg) return; for (let d = D.dayNum(rg[0]); d <= D.dayNum(rg[1]); d++) dayInfo.set(d, i); });
    const black = new Set(); b.blackouts.forEach((x) => { if (B().isISO(x.start) && B().isISO(x.end)) for (let d = D.dayNum(x.start); d <= D.dayNum(x.end); d++) black.add(d); });
    const hol = new Set(b.holidays.filter((h) => B().isISO(h.date)).map((h) => D.dayNum(h.date)));
    let h = '<div class="strip">';
    for (let mo = 3; mo <= 8; mo++) {
      h += '<div class="srow"><span class="sl">' + mo + '월</span>';
      const n = new Date(Date.UTC(2025, mo, 0)).getUTCDate();
      for (let dd = 1; dd <= n; dd++) {
        const d = D.dayNum('2025-' + String(mo).padStart(2, '0') + '-' + String(dd).padStart(2, '0'));
        const si = dayInfo.get(d);
        let cls = 'd';
        if (si != null) cls += si === hiIndex ? ' hi' : si % 2 ? ' s2' : ' s1';
        else if (black.has(d)) cls += ' bk';
        else if (D.weekday(d) === 1) cls += ' rs';
        if (hol.has(d)) cls += ' hol';
        h += '<i class="' + cls + '" title="' + D.fmtDate(d) + (si != null ? ' · 슬롯 #' + (si + 1) : black.has(d) ? ' · 경기 없는 기간' : ' · 휴식') + (hol.has(d) ? ' · 공휴일' : '') + '"></i>';
      }
      h += '</div>';
    }
    h += '</div><div class="legend"><span><i class="d s1"></i><i class="d s2"></i>슬롯(교대색)</span><span><i class="d hi"></i>선택</span><span><i class="d rs"></i>휴식</span><span><i class="d bk"></i>경기 없음</span><span><i class="d hol s1"></i>공휴일</span></div>';
    return h;
  }

  function histTable() {
    const b = WB.book;
    const sh = {}, mh = {};
    b.slots.forEach((s) => { if (typeof s.games === 'number') sh[s.games] = (sh[s.games] || 0) + 1; });
    b.series.forEach((s) => { if (typeof s.games === 'number') mh[s.games] = (mh[s.games] || 0) + 1; });
    const half = WB.app.state.teams.length / 2;
    let h = '<table class="mini"><tr><th>연전</th><th>슬롯</th><th>시리즈</th><th>수용 (슬롯×' + half + ')</th><th>상태</th></tr>';
    for (const k of [2, 3, 4]) {
      const s = sh[k] || 0, m = mh[k] || 0, cap = s * half;
      const st = m > cap ? WB.st('block', '부족') : m < cap ? WB.st('warn', '남음') : WB.st('ok', '일치');
      h += '<tr><td class="c">' + k + '연전</td><td class="n">' + s + '</td><td class="n">' + m + '</td><td class="n">' + cap + '</td><td>' + st + '</td></tr>';
    }
    return h + '</table>';
  }

  function preview(id) {
    const b = WB.book;
    if (id === 'slots' || id === 'season' || id === 'holidays' || id === 'rest' || id === 'blackouts') {
      const sel = WB.ui.sel['s1-slots'] || { r: 0 };
      let h = '';
      if (id === 'slots') {
        const row = b.slots[sel.r];
        const rg = row && B().slotRange(row);
        h += '<div class="ph">시즌 띠<small>선택 행 ' + (rg ? D.fmtShort(rg[0]) + '~' + D.fmtShort(rg[1]) : '-') + '</small></div>' + seasonStrip(b.slots, id === 'slots' ? sel.r : -1);
        h += '<div class="ph">연전 분포 ↔ 시리즈<small>사전 점검의 용량 검사</small></div>' + histTable();
        return h;
      }
      const g = B().regenSlots();
      const cur = b.slots.filter((s) => B().slotRange(s));
      const same = g.slots && g.slots.length === cur.length && g.slots.every((s, i) => s.datetime.slice(0, 10) === cur[i].start && s.consecutive === cur[i].games);
      let diff = 0; const diffs = [];
      if (g.slots) {
        const curKey = new Set(cur.map((s) => s.start + '|' + s.games));
        const genKey = new Set(g.slots.map((s) => s.datetime.slice(0, 10) + '|' + s.consecutive));
        for (const k of genKey) if (!curKey.has(k)) { diff++; if (diffs.length < 4) diffs.push('+ ' + D.fmtDate(k.split('|')[0]) + ' ' + k.split('|')[1] + '연전'); }
        for (const k of curKey) if (!genKey.has(k)) { diff++; if (diffs.length < 6) diffs.push('− ' + D.fmtDate(k.split('|')[0]) + ' ' + k.split('|')[1] + '연전'); }
      }
      h += '<div class="ph">규칙으로 다시 만들면<small>§5.2.1</small></div>' +
        (same ? '<div class="callout ok">' + WB.st('ok', '일치') + ' 슬롯 ' + g.slots.length + '개 — 현재 슬롯 시트와 날짜·연전 수가 같습니다.</div>'
          : '<div class="callout warn">' + WB.st('warn', '차이 ' + diff) + ' 규칙 결과 ' + (g.slots ? g.slots.length : 0) + '개 vs 시트 ' + cur.length + '개<br><span class="mono">' + diffs.map(esc).join('<br>') + '</span><br><button class="btn sm box" data-act="gen-slots" style="margin-top:4px">' + icon('wand') + '미리보기로 비교</button></div>');
      h += '<div class="ph">시즌 띠<small>규칙 결과 기준</small></div>' + seasonStrip(g.slots ? g.slots.map((s) => ({ start: s.datetime.slice(0, 10), games: s.consecutive })) : [], -1);
      if (id === 'season') {
        const s = b.season;
        const days = B().isISO(s.seasonStart) && B().isISO(s.initialEnd) ? D.dayNum(s.initialEnd) - D.dayNum(s.seasonStart) + 1 : '-';
        const gd = g.slots ? g.slots.reduce((a, x) => a + x.consecutive, 0) : 0;
        h += '<div class="ph">요약</div><dl class="kv"><dt>1차 편성 기간</dt><dd>' + days + '일</dd><dt>경기일</dt><dd>' + gd + '일</dd><dt>구단당 1차 경기</dt><dd>' + (s.initialGamesPerPair * (WB.app.state.teams.length - 1)) + '경기</dd><dt>휴식 요일</dt><dd>' + esc(s.restWeekdays) + '</dd></dl>';
      }
      return h;
    }
    if (id === 'series') {
      const teams = WB.app.state.teams.map((t) => t.name);
      const sel = WB.ui.sel['s1-series'] || { r: 0 };
      const row = b.series[sel.r] || {};
      const m = {};
      b.series.forEach((s) => { if (typeof s.games !== 'number') return; const k = s.home + '|' + s.away; m[k] = (m[k] || 0) + s.games; });
      let h = '<div class="ph">구단쌍 홈 경기 수<small>행 = 홈, 열 = 원정</small></div><table class="mini pm"><tr><th></th>' + teams.map((t) => '<th>' + esc(t) + '</th>').join('') + '</tr>';
      for (const a of teams) {
        h += '<tr><th>' + esc(a) + '</th>' + teams.map((x) => {
          if (a === x) return '<td class="c" style="background:#f1f1ef">·</td>';
          const v = m[a + '|' + x] || 0, w = m[x + '|' + a] || 0;
          const hi = (row.home === a && row.away === x) || (row.home === x && row.away === a);
          const bad = v + w !== b.season.initialGamesPerPair;
          return '<td class="c" style="' + (hi ? 'box-shadow:inset 0 0 0 2px var(--c-sel);font-weight:600;' : '') + (bad ? 'background:var(--c-warn-bg);color:var(--c-warn)' : '') + '">' + v + '</td>';
        }).join('') + '</tr>';
      }
      h += '</table><div class="note" style="margin-top:4px">칸 = 홈 경기 수. 두 칸의 합이 1차 편성 경기 수(' + b.season.initialGamesPerPair + ')가 아니면 노랑. 선택 행의 구단쌍은 녹색 테두리.</div>';
      h += '<div class="ph">연전 분포 ↔ 슬롯</div>' + histTable();
      return h;
    }
    if (id === 'events') {
      const rows = b.events;
      let h = '<div class="ph">슬롯별 이벤트<small>FR-E5 모순 검사</small></div>';
      const by = new Map();
      rows.forEach((e, r) => { const si = B().isISO(e.date) ? slotOfDate(e.date) : -1; if (!by.has(si)) by.set(si, []); by.get(si).push({ e, r }); });
      for (const [si, list] of by) {
        h += '<div class="evb"><div class="evh">' + (si >= 0 ? '#' + (si + 1) + ' ' + D.fmtDate(b.slots[si].start) + ' ' + b.slots[si].games + '연전' : '슬롯 없음') + '</div>';
        for (const { e, r } of list) h += '<div class="evr"><span class="mono">' + (r + 2) + '행</span> ' + esc(e.name) + ' · ' + (e.mode === '대진' ? esc(e.away + ' @ ' + e.home) + ' ' + icon('pin') + '고정' : '홈 의무: ' + esc(String(e.stadiums).split(',').map((s) => s.trim().replace(/(종합운동장|야구장|경기장|파크|돔야구장|챔피언스필드)$/, '')).join('·'))) + '</div>';
        h += '</div>';
      }
      h += '<div class="note">대진 = 그 슬롯에 시리즈를 핀 고정. 구장 = 연고 구단 중 하나가 홈이어야 함(잠실은 두산·LG 중 하나).</div>';
      return h;
    }
    if (id === 'teams') {
      const app = WB.app;
      const sel = WB.ui.sel['s1-teams'] || { r: 0 };
      const markers = app.state.teams.map((t, i) => ({ id: t.name, lat: t.latitude, lon: t.longitude, latitude: t.latitude, longitude: t.longitude, color: t.color, label: t.name, size: i === sel.r ? 7 : 5, ring: i === sel.r, draggable: WB.feature('T4') }));
      let svg = '';
      try { svg = KBO.MapKit.render({ width: 280, markers, title: '구장 지도', maxWidth: 280 }).svg; } catch (e) { svg = '<div class="note">지도를 그릴 수 없습니다.</div>'; }
      const shared = app.sharedStadiums();
      return '<div class="ph">구장 지도<small>내장 SVG · Kakao 키 없음</small></div><div class="mapbox">' + svg + '</div>' +
        (WB.feature('T4') ? '<div class="note">' + icon('info') + ' 마커를 끌어 좌표를 조정합니다 (FR-T4).</div>' : '') +
        '<div class="ph">공유 구장</div>' + (shared.size ? Array.from(shared).map(([s, n]) => '<div>' + WB.st('info', '공유') + ' ' + esc(s) + ' — ' + esc(n.join('·')) + '</div>').join('') : '<div class="note">없음</div>');
    }
    return '';
  }

  // ───────────── 렌더 ─────────────
  S1.render = function () {
    document.getElementById('main').classList.remove('nopane');
    renderCmd();
    renderTabs();
    const id = sheetId();
    const host = document.getElementById('gridhost');
    const spec = id === 'season' ? seasonGrid() : id === 'teams' ? teamsGrid() : importGrid(id);
    const g = WB.Grid.mount(host, spec);
    WB.lockOverlay(host);
    fxFor(g.sel.r, g.sel.c);
    renderPane();
    const heat = document.getElementById('heat');
    if (heat) heat.addEventListener('toggle', () => { WB.ui.heatOpen = heat.open; });
  };

  /** P3 시연 상태: 시리즈 6행 위에 빈 행을 넣고, 12행 원정 셀에 'LGG'를 입력 중 */
  S1.demoEdit = function () {
    WB.ui.sheet[1] = 'series';
    B().insertRow('series', 4, false);
    WB.ui.sel['s1-series'] = { r: 10, c: 1 };
    WB.ui.gridFocus = 's1-series';
    WB.render();
    const g = document.getElementById('gridhost')._grid;
    if (g) { g.select(10, 1); g.startEdit('LGG'); }
  };
})();
