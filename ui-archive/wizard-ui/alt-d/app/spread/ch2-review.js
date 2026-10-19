/*
 * 제2장 검토·실행 — 사전 점검을 통과시키고 엔진을 돌린다.
 * 본문: 2.1 사전 점검(입력 요약 + 점검 표) · 2.2 엔진 실행(점수 추이 그림 + 진행 기록)
 * 여백: 엔진 옵션 · 실행 버튼(차단 시 잠금과 사유) · 입력 잠금 안내
 */
(function () {
  'use strict';
  const SP = window.SP;
  const KBO = window.KBO;
  const { Dates, CalendarGen } = KBO;
  const { esc, fmt } = SP;
  const app = SP.app;
  const ui = SP.ui;
  const TABS = [{ id: 'check', label: '사전 점검' }, { id: 'run', label: '엔진 실행' }];

  function counts() { return app.preflight().counts; }
  function lastRun() { return SP.meta().lastRun || null; }

  function keyfigs() {
    const st = app.state;
    const sh = app.sharedStadiums();
    const h = CalendarGen.lengthHistogram(st.calendar);
    const days = st.calendar.reduce((a, c) => a + c.consecutive, 0);
    const evOpen = st.events.filter((e) => e.type === 'OPENING').length, evCh = st.events.filter((e) => e.type === 'CHILDREN').length;
    const fig = (v, label, sub) => '<div><span>' + label + '</span><b>' + v + '</b><small>' + sub + '</small></div>';
    return '<div class="sp-keyfigs">' +
      fig(st.teams.length, '구단', '공유 구장 ' + (sh.size ? Array.from(sh.keys()).map((s) => s.replace('종합운동장', '')).join(', ') : '없음')) +
      fig(fmt.md(st.settings.seasonStart) + '–' + fmt.md(st.settings.initialEnd), '1차 편성 기간', '경기일 ' + days + '일') +
      fig(st.calendar.length, '슬롯', Object.keys(h).sort().map((k) => k + '연전 ' + h[k]).join(' · ')) +
      fig(st.matches.length, '시리즈', fmt.int(st.matches.reduce((a, m) => a + m.consecutive, 0)) + '경기 · 구단쌍 ' + st.settings.initialGamesPerPair + '경기') +
      fig(st.events.length, '이벤트', '개막전 ' + evOpen + ' · 어린이날 ' + evCh) +
      fig(st.settings.blackouts.length, '경기 없는 기간', st.settings.blackouts.map((b) => b.label).join(' · ')) +
      '</div>';
  }
  const TARGET_LABEL = { settings: '설정 › 채점', teams: '1.5 구단과 거리', distance: '1.5 구단과 거리', season: '1.1 시즌 골격', slots: '1.2 슬롯', series: '1.3 시리즈', events: '1.4 이벤트', result: '3.1 캘린더' };
  function checkTable() {
    const pf = app.preflight();
    const f = ui.checkFilter;
    const items = pf.items.filter((x) => f === 'all' || x.status === f);
    const order = { block: 0, warn: 1, pass: 2 };
    items.sort((a, b) => order[a.status] - order[b.status]);
    const seg = '<div class="sp-seg" role="group" aria-label="점검 결과 거르기">' +
      [['all', '전체 ' + pf.items.length], ['block', '⛔ 차단 ' + pf.counts.block], ['warn', '⚠ 경고 ' + pf.counts.warn], ['pass', '✔ 통과 ' + pf.counts.pass]].map(([k, l]) => '<button type="button" data-act="checkFilter" data-arg="' + k + '" aria-pressed="' + (f === k) + '">' + l + '</button>').join('') + '</div>';
    let h = '<div class="sp-toolbar">' + SP.cap('표 2.2', '사전 점검', '연전 길이 k마다 시리즈 수 ≤ 슬롯 수 × 구단 수/2') + '<span class="sp-grow"></span>' + seg + '</div>';
    h += '<div class="sp-scroll sp-grow" data-sk="pf" style="border-bottom:2px solid var(--ink)"><table class="sp-table sp-pf"><thead><tr><th style="width:96px">상태</th><th style="width:150px">항목</th><th>내용</th><th style="width:210px">입력 위치</th></tr></thead><tbody>';
    for (const it of items) {
      const kind = it.status === 'pass' ? 'pass' : it.status;
      h += '<tr class="sp-pf-' + it.status + '"><td class="sp-pf-st">' + SP.chip(kind, kind === 'pass' ? '통과' : kind === 'warn' ? '경고' : '차단') + '</td><td><b>' + esc(it.title) + '</b></td><td class="sp-pf-d">' + esc(it.detail) + '</td><td>' + (it.target ? '<button type="button" class="sp-link" data-act="nav" data-arg="' + esc(it.target) + '">' + esc(TARGET_LABEL[it.target] || it.target) + ' →</button>' : '') + (it.ack ? ' ' + SP.btn('ackImport', '확인함', { cls: 'sp-mini' }) : '') + '</td></tr>';
    }
    if (!items.length) h += '<tr><td colspan="4" class="sp-muted">해당 항목이 없습니다.</td></tr>';
    h += '</tbody></table></div>';
    return h;
  }
  SP.act.ackImport = () => { app.store.commit('가져오기 경고 확인', (s) => { s.meta.spread = Object.assign({}, s.meta.spread, { importAck: true }); }, { undo: false, tags: ['spread'] }); };
  SP.act.checkFilter = (el) => { ui.checkFilter = el.dataset.arg; SP.render(); };

  /** 그림 2.1 점수 추이 (Hard 계단 + Soft 선) */
  function trendSvg(hist, W, H) {
    const pad = { l: 54, r: 54, t: 16, b: 26 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const T = 60000;
    const x = (t) => pad.l + iw * Math.min(1, t / T);
    const hMin = -50, hMax = 0;
    const yh = (v) => pad.t + ih * (1 - (v - hMin) / (hMax - hMin));
    const sMin = -3000000, sMax = -1500000;
    const ys = (v) => pad.t + ih * (1 - (v - sMin) / (sMax - sMin));
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="점수 추이: Hard는 왼쪽 축, Soft S2는 오른쪽 축" preserveAspectRatio="xMidYMid meet">';
    for (let v = -50; v <= 0; v += 10) s += '<line class="sv-grid" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + yh(v) + '" y2="' + yh(v) + '"/><text class="sv-t" x="' + (pad.l - 6) + '" y="' + (yh(v) + 3) + '" text-anchor="end">' + v + '</text>';
    for (let v = -3000000; v <= -1500000; v += 500000) s += '<text class="sv-t" x="' + (W - pad.r + 6) + '" y="' + (ys(v) + 3) + '">' + (v / 1e6).toFixed(1) + 'M</text>';
    for (let t = 0; t <= 60; t += 10) s += '<text class="sv-t" x="' + x(t * 1000) + '" y="' + (H - 8) + '" text-anchor="middle">' + t + '초</text>';
    s += '<line class="sv-ax" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + (pad.t + ih) + '" y2="' + (pad.t + ih) + '"/>';
    s += '<text class="sv-tb" x="' + pad.l + '" y="10">Hard (위반 합)</text><text class="sv-tb" x="' + (W - pad.r) + '" y="10" text-anchor="end" fill="#8f3f0e">Soft S2 이동 거리 분산</text>';
    if (hist.length) {
      let dh = 'M' + x(hist[0].t) + ' ' + yh(hist[0].hard);
      for (let i = 1; i < hist.length; i++) dh += 'H' + x(hist[i].t).toFixed(1) + 'V' + yh(hist[i].hard).toFixed(1);
      s += '<path d="' + dh + '" fill="none" stroke="#1d3557" stroke-width="2.2"/>';
      const ds = hist.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + ys(p.soft).toFixed(1)).join('');
      s += '<path d="' + ds + '" fill="none" stroke="#8f3f0e" stroke-width="1.6" stroke-dasharray="5 3"/>';
      const last = hist[hist.length - 1];
      s += '<circle cx="' + x(last.t) + '" cy="' + yh(last.hard) + '" r="4" fill="#1d3557"/><text class="sv-tb" x="' + (x(last.t) + 7) + '" y="' + (yh(last.hard) - 6) + '">' + last.hard + '</text>';
      s += '<circle cx="' + x(last.t) + '" cy="' + ys(last.soft) + '" r="3.4" fill="#8f3f0e"/>';
    }
    return s + '</svg>';
  }
  function runMain() {
    const r = SP.run;
    const lr = lastRun();
    const live = r && r.status !== 'DONE' ? r : null;
    const hist = live ? r.history : SP.makeHistory(lr ? Math.min(1, lr.elapsedMs / 60000) : 1);
    const k = live ? r.progress : 1;
    const last = hist[hist.length - 1];
    const note = live ? (r.status === 'PAUSED' ? '일시정지 — 재개하면 이어서 탐색합니다' : '실행 중 — 개선 해를 찾을 때마다(250ms 이상 간격) 갱신') : lr ? '마지막 실행 ' + fmt.md(lr.at.slice(0, 10)) + ' ' + fmt.clock(lr.at) + ' · ' + (lr.elapsedMs / 1000).toFixed(1) + '초 · 개선 ' + lr.improvements + '회' : '아직 실행하지 않았습니다';
    const log = [];
    const step = Math.max(1, Math.floor(hist.length / 9));
    for (let i = hist.length - 1; i > 0 && log.length < 9; i -= step) log.push('<div class="sp-logline">' + fmt.time(hist[i].t) + '  개선 #' + Math.round(214 * hist[i].t / 60000) + '  Hard ' + hist[i].hard + '  S2 ' + fmt.int(hist[i].soft) + '</div>');
    return '<div class="sp-runpanel"><div class="sp-chartbox">' + SP.cap('그림 2.1', '점수 추이', esc(note) + ' ' + SP.mock('목업 실행')) + trendSvg(hist, Math.max(600, window.innerWidth - (window.innerWidth >= 1700 ? 344 : 300) - 296 - (window.innerWidth >= 1700 ? 56 : 44) - 26), Math.max(260, window.innerHeight - 172 - 60 - 92)) +
      '<div class="sp-legend"><span><i style="background:#1d3557"></i>Hard 위반 합 (왼쪽 축)</span><span><i style="background:#8f3f0e"></i>Soft S2 (오른쪽 축, 점선)</span><span class="sp-muted">Mock 엔진: 결과 품질을 보장하지 않는 시뮬레이션</span></div></div>' +
      '<div class="sp-chartbox">' + SP.cap('표 2.3', '실행 기록') +
      '<div class="sp-progress' + (live && r.status === 'PAUSED' ? ' sp-paused' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(k * 100) + '"><span style="width:' + (k * 100).toFixed(1) + '%"></span></div>' +
      '<dl class="sp-kv" style="margin-top:8px"><dt>경과</dt><dd>' + fmt.time(k * 60000) + ' / 01:00</dd><dt>개선 횟수</dt><dd>' + Math.round(214 * k) + '회</dd><dt>현재 Hard</dt><dd>' + last.hard + '</dd><dt>현재 Soft S2</dt><dd>' + fmt.int(last.soft) + '</dd><dt>종료 조건</dt><dd>' + app.state.settings.solver.timeLimitSec + '초 또는 ' + app.state.settings.solver.unimprovedSec + '초 개선 없음</dd></dl>' +
      '<h4 class="sp-mh" style="margin-top:10px">개선 기록</h4><div class="sp-scroll" style="flex:1">' + log.join('') + '</div></div></div>';
  }

  function marginReview() {
    const pf = app.preflight();
    const s = app.state.settings.solver;
    const r = SP.run;
    const running = SP.isRunning();
    const dis = running ? ' disabled' : '';
    let b = SP.mSec('점검 결과', '<div class="sp-figrow"><div><b>' + pf.counts.pass + '</b><span>✔ 통과</span></div><div><b>' + pf.counts.warn + '</b><span>⚠ 경고</span></div><div><b>' + pf.counts.block + '</b><span>⛔ 차단</span></div></div>' +
      '<p class="sp-note-s">경고는 실행을 막지 않습니다. 차단이 하나라도 있으면 실행 버튼이 잠깁니다.</p>');
    b += SP.mSec('엔진 옵션', '<div class="sp-opts">' +
      '<label class="sp-field"><span>최대 실행 시간</span><select class="sp-select" data-chg="solverOpt" data-arg="timeLimitSec"' + dis + '>' + [30, 60, 120, 300].map((v) => '<option value="' + v + '"' + (s.timeLimitSec === v ? ' selected' : '') + '>' + v + '초</option>').join('') + '</select></label>' +
      '<label class="sp-field"><span>개선 없음 종료</span><select class="sp-select" data-chg="solverOpt" data-arg="unimprovedSec"' + dis + '>' + [10, 15, 30, 60].map((v) => '<option value="' + v + '"' + (s.unimprovedSec === v ? ' selected' : '') + '>' + v + '초</option>').join('') + '</select></label>' +
      '<label class="sp-field" style="grid-column:1/-1"><span>초기해</span><select class="sp-select" data-chg="solverOpt" data-arg="init"' + dis + '><option value="KEEP"' + (s.init !== 'SCRATCH' ? ' selected' : '') + '>현재 배정 유지 (핀 고정 시리즈는 이동하지 않음)</option><option value="SCRATCH"' + (s.init === 'SCRATCH' ? ' selected' : '') + '>처음부터 (핀만 유지)</option></select></label>' +
      '<label class="sp-field"><span>시드</span><input class="sp-input" type="number" data-chg="solverOpt" data-arg="seed" value="' + s.seed + '"' + dis + '></label>' +
      '<div class="sp-field"><span>엔진</span><span style="font-weight:600;color:var(--ink);height:26px;display:flex;align-items:center;gap:4px">Mock ' + SP.mock() + '</span></div></div>' +
      '<p class="sp-note-s">REST 엔진 주소는 설정에서 바꿉니다. 고정 ' + app.state.matches.filter((m) => m.pinned).length + '개 시리즈는 움직이지 않습니다.</p>');
    if (running) b += SP.mSec('입력 잠금', '<p class="sp-note"><span class="sp-lock"><span aria-hidden="true">⊘</span> 입력 잠김</span> 엔진이 도는 동안 제1장 표 편집, 제3장 이동·고정, 가져오기가 잠깁니다. 중지하면 지금까지의 최선 해가 남습니다.</p>');
    let next;
    if (running) next = '<p>' + (r.status === 'PAUSED' ? '일시정지 중입니다.' : '엔진이 실행 중입니다 · ' + Math.round(r.progress * 100) + '%') + '</p><div class="sp-row">' + SP.btn('runPause', r.status === 'PAUSED' ? '▶ 재개' : '❚❚ 일시정지', { cls: 'sp-grow' }) + SP.btn('runStop', '■ 중지', { kind: 'bad', cls: 'sp-grow' }) + '</div>';
    else if (!pf.ok) { const bl = pf.items.filter((x) => x.status === 'block'); next = '<p>⛔ 차단 ' + bl.length + '건 때문에 실행할 수 없습니다: ' + esc(bl[0].title) + '</p>' + SP.btn('nav', '차단 위치로 가기 →', { arg: bl[0].target }) + SP.btn('runStart', '▶ 엔진 실행', { kind: 'primary', disabled: true }); }
    else next = '<p>' + (pf.counts.warn ? '⚠ 경고 ' + pf.counts.warn + '건을 확인했으면 실행합니다.' : '점검을 통과했습니다.') + ' 끝나면 제3장으로 넘어갑니다.</p>' + SP.btn('runStart', '▶ 엔진 실행 (목업)', { kind: 'primary' }) + (lastRun() ? SP.btn('go', '마지막 결과 보기 · 제3장', { arg: '3:calendar' }) : '');
    return { body: b, next };
  }
  SP.act.solverOpt = (el) => { const k = el.dataset.arg; const v = k === 'init' ? el.value : Number(el.value); app.updateSolverSettings({ [k]: v }); };

  SP.chapters[2] = {
    n: 2, id: 'review', title: '검토·실행', task: '사전 점검을 통과시키고 엔진을 돌린다', tabs: TABS,
    summary() { const c = counts(); if (SP.isRunning()) return '엔진 실행 중 ' + Math.round(SP.run.progress * 100) + '% · 개선 ' + SP.run.improvements + '회'; return '점검 통과 ' + c.pass + ' · 경고 ' + c.warn + ' · 차단 ' + c.block; },
    card() { const c = counts(); const lr = lastRun(); return '통과 ' + c.pass + ' · 경고 ' + c.warn + (lr ? ' · 엔진 ' + (lr.elapsedMs / 1000).toFixed(0) + '초 · 개선 ' + lr.improvements + '회' : ''); },
    status() {
      const c = counts();
      if (c.block) return { kind: 'block', text: '차단 ' + c.block, short: '차단 ' + c.block };
      if (SP.isRunning()) return { kind: 'draft', text: '실행 중', short: '실행 중' };
      if (c.warn) return { kind: 'warn', text: '경고 ' + c.warn, short: '경고 ' + c.warn };
      return { kind: 'draft', text: lastRun() ? '실행 완료' : '실행 전', short: '작성 중' };
    },
    main(tab) {
      const lead = tab === 'run' ? '엔진은 고정되지 않은 시리즈만 옮긴다. 실행 중에는 입력이 잠기고, 중지해도 최선 해가 남는다.' : '실행 전에 구조적으로 불가능한 입력을 찾는다. 항목을 누르면 제1장의 해당 표로 간다.';
      const body = tab === 'run' ? runMain() : keyfigs() + checkTable();
      return SP.subhead(2, TABS, tab, '', lead) + '<div class="sp-body">' + body + '</div>';
    },
    margin: marginReview
  };
})();
