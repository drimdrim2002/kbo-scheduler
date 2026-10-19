/*
 * alt-1 편성 브리프 (Season Brief)
 * 하나의 긴 문서형 페이지. 좌측 목차·진행 체크, 입력 → 검토 → 결과 → 분석 → 운영이 문서 섹션으로 이어진다.
 * 확정한 섹션은 요약 카드로 접힌다. 인쇄하면 회의용 보고서가 된다.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const P = UI.panels;
  const { esc, fmt } = UI;
  const { Dates, Score, CalendarGen } = KBO;

  const app = new KBO.App({ appId: 'alt-1', appName: '편성 브리프' });
  window.app = app;

  /** 섹션 정의: id, 번호, 제목, 그룹, 내용 mount, 요약, 상태 */
  const SECTIONS = [
    { id: 'teams', group: '입력', title: '구단·구장', lead: '참가 구단과 연고 구장, 위치를 확인한다. 구장명을 검색하면 지도에 표시되고, 같은 구장을 쓰는 구단은 공유 구장으로 묶인다.',
      mount: (el) => P.teams(el, app),
      summary: () => { const sh = app.sharedStadiums(); return app.state.teams.length + '개 구단 · ' + new Set(app.state.teams.map((t) => t.stadium)).size + '개 구장' + (sh.size ? ' · 공유 구장 ' + Array.from(sh).map(([s, n]) => s + '(' + n.join('·') + ')').join(', ') : ''); },
      status: () => (app.state.teams.length % 2 ? 'block' : 'ok') },
    { id: 'distance', group: '입력', title: '이동거리 행렬', lead: '구단 간 이동거리(km). 프리셋 값은 실제 도로거리이고, 새 구장은 직선거리 × 도로계수로 추정한다(≈ 표시).',
      mount: (el) => P.distance(el, app),
      summary: () => { const est = app.state.distanceMatrix.filter((d) => d.estimated).length; const pf = app.preflight().items.find((x) => x.id === 'distance'); return (pf ? pf.detail : '') + (est ? '' : ''); },
      status: () => statusOf('distance') },
    { id: 'season', group: '입력', title: '시즌 일정 골격', lead: '개막일, 1차 편성 종료일, 휴식 요일과 예외일, 경기 없는 기간, 공휴일. 슬롯은 이 설정에서 자동으로 만든다.',
      mount: (el) => P.season(el, app),
      summary: () => { const s = app.state.settings; return fmt.date(s.seasonStart) + ' 개막 · 1차 편성 ~' + fmt.date(s.initialEnd) + ' · 시즌 ~' + fmt.date(s.seasonEnd) + ' · 휴식 ' + s.restWeekdays.map((w) => Dates.WEEKDAY_KO[w]).join('·') + ' · 경기 없는 기간 ' + s.blackouts.length + '개 · 공휴일 ' + s.holidays.length + '일'; },
      status: () => (app.slotsOutOfDate() ? 'warn' : 'ok') },
    { id: 'slots', group: '입력', title: '슬롯', lead: '시리즈가 열리는 연속 경기일 묶음. 3연전 우선으로 나누고, 남는 날은 첫 시리즈 2연전 또는 마지막 시리즈 4연전이 된다.',
      mount: (el) => P.slots(el, app),
      summary: () => { const h = CalendarGen.lengthHistogram(app.state.calendar); return app.state.calendar.length + '개 슬롯 · ' + Object.keys(h).sort().map((k) => k + '연전 ' + h[k]).join(' · '); },
      status: () => statusOf('slots') },
    { id: 'series', group: '입력', title: '시리즈', lead: '구단쌍 경기 수와 홈/원정 분배로 시리즈를 만든다. 시리즈 길이 분포는 슬롯 길이 분포와 정확히 맞아야 한다.',
      mount: (el) => P.series(el, app),
      summary: () => app.state.matches.length + '개 시리즈 · ' + app.state.matches.reduce((a, b) => a + b.consecutive, 0) + '경기 · 구단쌍 ' + app.state.settings.initialGamesPerPair + '경기',
      status: () => statusOf('series') },
    { id: 'events', group: '입력', title: '특별 이벤트', lead: '개막전 대진, 어린이날 홈 구장, 사용자 정의 이벤트. 대진 지정은 시리즈를 고정하고, 구장 지정은 홈 경기 의무가 된다.',
      mount: (el) => P.events(el, app),
      summary: () => { const ev = app.state.events; const names = Array.from(new Set(ev.map((e) => e.name))); return ev.length + '개 — ' + names.join(', ') + (app.checkEvents().length ? ' · 경고 ' + app.checkEvents().length : ''); },
      status: () => statusOf('events') },
    { id: 'review', group: '검토', title: '입력 검토와 엔진 실행', lead: '입력을 한 번에 검토하고 사전 점검을 통과하면 엔진을 실행한다. 실행 중에는 입력이 잠긴다.',
      mount: (el) => { el.innerHTML = '<div class="b-review"></div><h4 class="k-subhead">엔진 실행</h4><div class="b-solver"></div>'; P.review(el.querySelector('.b-review'), app); P.solver(el.querySelector('.b-solver'), app); },
      summary: () => { const pf = app.preflight(); return '사전 점검 통과 ' + pf.counts.pass + ' · 경고 ' + pf.counts.warn + ' · 차단 ' + pf.counts.block + (app.run ? ' · 마지막 실행 ' + (app.run.elapsedMs / 1000).toFixed(1) + '초' : ''); },
      status: () => (app.preflight().ok ? (app.preflight().counts.warn ? 'warn' : 'ok') : 'block') },
    { id: 'result', group: '결과', title: '편성 결과', lead: '캘린더에서 시리즈를 끌어 다른 날짜로 옮기거나, 다른 시리즈 위에 놓아 맞바꾼다. 놓기 전에 점수 변화(Δ)가 보인다. 위반은 빨간 테두리·빗금·⚠로 표시한다.',
      mount: (el) => {
        el.innerHTML = '<div class="b-result-top"><div class="b-badge"></div><div class="b-undo"></div></div><div class="b-result-grid"><div class="b-cal"></div><aside class="b-viol"><h4 class="k-subhead">위반 목록</h4><div class="b-viol-list"></div></aside></div><div class="b-pool"></div><details class="b-more"><summary>슬롯 목록 보기 (FR-V6)</summary><div class="b-slotlist"></div></details>';
        P.badge(el.querySelector('.b-badge'), app); P.undoBar(el.querySelector('.b-undo'), app);
        P.calendar(el.querySelector('.b-cal'), app, { onSeriesClick: (m) => P.seriesDialog(app, m) });
        P.violations(el.querySelector('.b-viol-list'), app, { autoOpen: true });
        P.pool(el.querySelector('.b-pool'), app);
        P.slotList(el.querySelector('.b-slotlist'), app);
      },
      summary: () => { const ex = app.derived().ex; return (ex.feasible ? '✔ 편성 가능' : '✖ Hard 위반 ' + ex.violations.length + '건') + ' · ' + Score.scoreString(ex.score) + ' · 미배정 ' + app.derived().pool.length + ' · 고정 ' + app.state.matches.filter((m) => m.pinned).length; },
      status: () => (app.derived().ex.feasible ? 'ok' : 'block') },
    { id: 'quality', group: '결과', title: '품질 확인', lead: '구단별 지표를 비교한다. "채점" 지표는 엔진 점수에 들어가고 "참고" 지표는 들어가지 않는다. Soft 점수를 단계별로 나눠 어떤 구단이 감점을 만드는지 본다.',
      mount: (el) => { el.innerHTML = '<div class="b-metrics"></div><div class="k-grid-2 b-q2"><div><h4 class="k-subhead">Soft 점수 분해 (S0~S4)</h4><div class="b-soft"></div></div><div><h4 class="k-subhead">스냅샷</h4><div class="b-snap"></div></div></div>'; P.metrics(el.querySelector('.b-metrics'), app); P.softBreakdown(el.querySelector('.b-soft'), app); P.snapshots(el.querySelector('.b-snap'), app); },
      summary: () => { const L = app.derived().ex.league; const over = app.derived().ex.teamMetrics.filter((t) => t.overDistance || t.overMoves || t.overHoliday).map((t) => t.name); return '평균 이동 ' + fmt.km(L.meanDistanceKm) + 'km · 리그 총 ' + fmt.int(L.totalKm) + 'km · 허용오차 초과 ' + (over.length ? over.join('·') : '없음') + ' · 스냅샷 ' + app.state.snapshots.length + '개'; },
      status: () => 'ok' },
    { id: 'analysis', group: '분석', title: '분석', lead: '이동 부담, 홈/원정 흐름, 공정성, 혹서기 부담을 차트로 본다. 막대를 누르면 그 구단을 강조한다.',
      mount: (el) => { el.innerHTML = '<div class="b-charts"></div><h4 class="k-subhead">이동 경로 (FR-A6)</h4><div class="b-route"></div>'; P.chartsPanel(el.querySelector('.b-charts'), app, { width: 460, wideWidth: 1000 }); P.routeMap(el.querySelector('.b-route'), app, { width: 460 }); },
      summary: () => '차트 12종 · 경로 재생',
      status: () => 'ok' },
    { id: 'ops', group: '운영', title: '시즌 운영: 경기 기록과 재편성', lead: '시즌 중 취소된 경기를 일자 단위로 기록하고, 잔여·취소 경기를 9~10월에 재편성한다.',
      mount: (el) => { el.innerHTML = '<h4 class="k-subhead">경기 기록</h4><div class="b-games"></div><h4 class="k-subhead">시즌 진행 현황</h4><div class="b-progress"></div><div class="b-resched"></div>'; P.games(el.querySelector('.b-games'), app); P.progress(el.querySelector('.b-progress'), app); P.reschedule(el.querySelector('.b-resched'), app); },
      summary: () => { const t = app.targets(); const rex = app.rescheduleExplain(); return '취소 ' + t.totals.cancelled + ' · 잔여 ' + t.totals.remaining + ' · 재편성 ' + (rex ? (rex.feasible ? '✔ 가능' : '✖ 위반 ' + rex.violations.length) : '미실행'); },
      status: () => { const rex = app.rescheduleExplain(); return rex && !rex.feasible ? 'warn' : 'ok'; } },
    { id: 'schedule', group: '배포', title: '구단별 일정표', lead: '구단 운영팀에 나눠 줄 일정표. 인쇄 버튼은 이 표만 출력한다.',
      mount: (el) => P.teamSchedule(el, app),
      summary: () => '구단별 ' + app.games().length / 5 * 0 + '일정표 · CSV',
      status: () => 'ok' },
    { id: 'settings', group: '배포', title: '설정과 데이터', lead: 'H0-e 채점 모드, 지도 키, 엔진 연결, 저장·내보내기.',
      mount: (el) => { el.innerHTML = '<div class="b-settings"></div><h4 class="k-subhead">데이터</h4><div class="b-data"></div>'; P.settings(el.querySelector('.b-settings'), app); P.data(el.querySelector('.b-data'), app); },
      summary: () => 'H0-e ' + (app.state.settings.h0eMode === 'ENGINE' ? '엔진 호환' : '구장 기준') + ' · ' + app.engine.label + ' · 지도 ' + (app.kakao ? 'Kakao' : '내장 SVG'),
      status: () => 'ok' }
  ];
  SECTIONS.find((s) => s.id === 'schedule').summary = () => app.state.teams.length + '개 구단 일정표 · 인쇄·CSV';

  function statusOf(target) {
    const items = app.preflight().items.filter((x) => x.target === target);
    if (items.some((x) => x.status === 'block')) return 'block';
    if (items.some((x) => x.status === 'warn')) return 'warn';
    return 'ok';
  }

  // 확정 상태는 프로젝트 meta에 둔다(내보내기에 포함)
  const confirmed = () => (app.state.meta.brief && app.state.meta.brief.confirmed) || {};
  function setConfirmed(id, v) {
    app.store.commit(v ? '섹션 확정' : '섹션 다시 열기', (s) => {
      s.meta.brief = s.meta.brief || { confirmed: {} };
      s.meta.brief.confirmed = Object.assign({}, s.meta.brief.confirmed, { [id]: v });
    }, { undo: false, tags: ['brief'] });
  }

  // ───── 레이아웃 ─────
  const root = document.getElementById('brief');
  const toc = document.getElementById('toc');
  toc.innerHTML = '<div class="b-toc-head"><div class="b-kicker">' + esc(app.state.meta.season) + ' KBO 정규시즌</div><div class="b-toc-title">편성 브리프</div><div class="b-toc-badge"></div></div><div class="b-toc-body"></div>';
  const tocBody = toc.querySelector('.b-toc-body');
  P.badge(toc.querySelector('.b-toc-badge'), app, { compact: true });
  let lastGroup = '';
  let html = '';
  SECTIONS.forEach((s, i) => {
    if (s.group !== lastGroup) { html += '<div class="b-part"><span>' + esc(s.group) + '</span></div>'; lastGroup = s.group; }
    html += '<section class="b-sec" id="s-' + s.id + '" data-id="' + s.id + '" aria-labelledby="h-' + s.id + '"><header class="b-sec-head"><span class="b-num">' + String(i + 1).padStart(2, '0') + '</span><div class="b-titles"><h2 id="h-' + s.id + '">' + esc(s.title) + '</h2><p class="b-lead">' + esc(s.lead) + '</p></div><div class="b-sec-actions"><span class="b-status"></span><button class="k-btn b-confirm"></button></div></header>' +
      '<div class="b-card" hidden><div class="b-card-text"></div><button class="k-link b-reopen">다시 열기</button></div><div class="b-body"></div></section>';
  });
  root.innerHTML = html;
  const mounted = new Set();
  function ensureMounted(s) {
    if (mounted.has(s.id)) return;
    mounted.add(s.id);
    s.mount(root.querySelector('#s-' + s.id + ' .b-body'));
  }

  function renderToc() {
    const c = confirmed();
    let h = '<ol class="b-toc-list">';
    let done = 0;
    lastGroup = '';
    SECTIONS.forEach((s, i) => {
      if (s.group !== lastGroup) { h += '<li class="b-toc-group">' + esc(s.group) + '</li>'; lastGroup = s.group; }
      const st = s.status();
      const isC = !!c[s.id];
      if (isC) done++;
      const icon = isC ? '✔' : st === 'block' ? '⛔' : st === 'warn' ? '⚠' : '○';
      h += '<li><a href="#s-' + s.id + '" class="b-toc-link b-st-' + (isC ? 'done' : st) + '" data-id="' + s.id + '"><span class="b-toc-ic" aria-label="' + (isC ? '확정' : st === 'block' ? '차단' : st === 'warn' ? '확인 필요' : '진행 중') + '">' + icon + '</span><span class="b-toc-n">' + String(i + 1).padStart(2, '0') + '</span> ' + esc(s.title) + '</a></li>';
    });
    h += '</ol><div class="b-progressbar" role="progressbar" aria-valuemin="0" aria-valuemax="' + SECTIONS.length + '" aria-valuenow="' + done + '"><span style="width:' + Math.round((done / SECTIONS.length) * 100) + '%"></span></div><div class="k-small k-muted">확정 ' + done + ' / ' + SECTIONS.length + ' 섹션</div>' +
      '<div class="b-toc-tools"><button class="k-btn" data-act="print">🖨 브리프 인쇄</button><button class="k-btn k-btn-ghost" data-act="expand">모두 펼치기</button></div>';
    tocBody.innerHTML = h;
  }

  function renderSections() {
    const c = confirmed();
    for (const s of SECTIONS) {
      const sec = root.querySelector('#s-' + s.id);
      const isC = !!c[s.id];
      const st = s.status();
      sec.classList.toggle('b-confirmed', isC);
      sec.querySelector('.b-card').hidden = !isC;
      sec.querySelector('.b-body').hidden = isC && !document.body.classList.contains('b-expand-all');
      sec.querySelector('.b-card-text').textContent = s.summary();
      sec.querySelector('.b-status').innerHTML = isC ? UI.stateChip('ok', '확정') : st === 'block' ? UI.stateChip('block', '차단 항목') : st === 'warn' ? UI.stateChip('warn', '확인 필요') : UI.stateChip('info', '작성 중');
      const btn = sec.querySelector('.b-confirm');
      btn.textContent = isC ? '수정' : '✔ 확정하고 접기';
      btn.classList.toggle('k-btn-primary', !isC);
      if (!sec.querySelector('.b-body').hidden) ensureMounted(s);
    }
  }

  // 지연 마운트: 화면 가까이 온 섹션만 그린다(초기 로딩을 가볍게)
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { const s = SECTIONS.find((x) => x.id === e.target.dataset.id); if (s && !e.target.querySelector('.b-body').hidden) ensureMounted(s); }
  }, { rootMargin: '600px 0px' });
  root.querySelectorAll('.b-sec').forEach((s) => io.observe(s));

  // 현재 읽는 섹션을 목차에 표시
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { toc.querySelectorAll('.b-toc-link').forEach((a) => a.classList.toggle('b-current', a.dataset.id === e.target.dataset.id)); }
  }, { rootMargin: '-30% 0px -60% 0px' });
  root.querySelectorAll('.b-sec').forEach((s) => spy.observe(s));

  root.addEventListener('click', (e) => {
    const sec = e.target.closest('.b-sec');
    if (!sec) return;
    if (e.target.closest('.b-confirm')) setConfirmed(sec.dataset.id, !confirmed()[sec.dataset.id]);
    else if (e.target.closest('.b-reopen')) setConfirmed(sec.dataset.id, false);
  });
  toc.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && b.dataset.act === 'print') printBrief();
    else if (b && b.dataset.act === 'expand') { document.body.classList.toggle('b-expand-all'); renderSections(); }
    const a = e.target.closest('.b-toc-link');
    if (a) { e.preventDefault(); goTo(a.dataset.id); }
  });

  function goTo(id, open) {
    const s = SECTIONS.find((x) => x.id === id);
    if (!s) return;
    if (open && confirmed()[id]) setConfirmed(id, false);
    ensureMounted(s);
    const el = document.getElementById('s-' + id);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('b-flash'); setTimeout(() => el.classList.remove('b-flash'), 1200);
  }

  function printBrief() {
    // 인쇄 전 모든 섹션을 그려 둔다
    for (const s of SECTIONS) ensureMounted(s);
    document.body.classList.add('b-printing');
    setTimeout(() => { window.print(); document.body.classList.remove('b-printing'); }, 150);
  }

  app.setNavigator((target) => {
    const map = { teams: 'teams', distance: 'distance', season: 'season', slots: 'slots', series: 'series', events: 'events', review: 'review', result: 'result', settings: 'settings' };
    goTo(map[target] || target, true);
  });
  // 위반·항목 클릭 → 결과 섹션으로
  app.subscribe((ch) => { if (ch.tags.has('focus') && ch.focus && (ch.focus.slot != null || ch.focus.match != null) && !ch.focus.units) { const el = document.getElementById('s-result'); if (confirmed().result) setConfirmed('result', false); ensureMounted(SECTIONS.find((x) => x.id === 'result')); const r = el.getBoundingClientRect(); if (r.top > window.innerHeight || r.bottom < 0) el.scrollIntoView({ behavior: 'smooth' }); } });

  let pend = null;
  app.subscribe((ch) => {
    if (ch.tags.has('live') && pend) return;
    clearTimeout(pend);
    pend = setTimeout(() => { pend = null; renderToc(); renderSections(); }, ch.tags.has('live') ? 300 : 30);
  });
  document.getElementById('masthead-meta').textContent = '작성 ' + new Date(app.state.meta.updatedAt).toLocaleString('ko-KR');
  app.bindShortcuts();
  renderToc();
  renderSections();
})();
