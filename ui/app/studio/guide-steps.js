/*
 * 편성 스튜디오 — ① 데이터 준비: 보여 주는 방식 (추천안 R · 입력은 모두 시즌 달력 한 화면)
 * ①에 들어오면 바로 시즌 달력 한 화면(season-calendar.js)이 뜬다. 묻는 화면·① 안의 작은 단계 띠는 없다.
 *  - 시즌 달력: 왼쪽 구단 정보(접힌 요약)·시즌 기간·연전 규칙·공휴일 / 가운데 달력 / 오른쪽 고른 날·확인·엑셀.
 *  - 구단 정보 「펼쳐서 고치기」: 왼쪽 카드(구단명·구장·위치 찾기·거리) + 구단 표·구장 지도(예전 1단계 화면 그대로).
 *  - 모든 표 보기(전문가용): 지금까지의 ① 전체 화면(가져오기 띠·왼쪽 목록·오른쪽 자세히).
 * 주소: #step=1 → 시즌 달력 · &open=teams → 구단 정보 펼침 · &day=YYYY-MM-DD → 고른 날 · &tab=… → 모든 표 보기. 예전 g=·gs=는 무시(시즌 달력).
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { esc, icon } = S;
  // mode: 'cal'(시즌 달력 한 화면) · 'all'(모든 표 보기). open: null | 'teams'(구단 정보 펼침)
  const G = S.g1 = { mode: 'cal', open: null };
  const app = () => S.app;

  /** 주소에서: tab=이 있으면 모든 표 보기(g=all도), 아니면 시즌 달력. open=teams는 구단 정보 펼침 */
  S.g1Route = function (o) {
    if (o.step && +o.step !== 1) return;
    if (o.g === 'all' || (o.tab && !o.g)) G.mode = 'all';
    else G.mode = 'cal';
    G.open = o.open === 'teams' ? 'teams' : null;
    if (S.calRoute) S.calRoute(o);
  };
  /** 주소에 적을 것 */
  S.g1Hash = function (o) {
    if (G.mode !== 'cal') return;
    delete o.tab;
    if (G.open) o.open = G.open;
    if (S.calHash) S.calHash(o);
  };
  /**
   * 다른 화면(사전 점검 「입력 위치로」 등)에서 「①의 이 입력으로」: 시즌 달력의 그 부분으로 간다.
   * teams·distance → 구단 정보 펼침, season → 시즌 기간, holidays → 공휴일 표, slots → 달력, events → 홈 구장 지정(첫 지정일), series → 확인.
   * 모든 표 보기에서 왔으면 그 표를 그대로 연다.
   */
  S.g1Open = function (tab, extra) {
    if (G.mode === 'all') { S.go(Object.assign({ step: 1, tab, ops: null, sel: null }, extra || {})); return; }
    G.open = tab === 'teams' || tab === 'distance' ? 'teams' : null;
    if (S.calFocus) S.calFocus(tab);
    S.go({ step: 1, ops: null, sel: null, modal: null, drawer: null });
  };

  /** 구단 정보 단계: 표에서 고른 구단의 구단명·구장·위도·경도를 카드에서 고친다. 구장 칸에서 Enter = 구장 위치 찾기 */
  const findState = (i) => { const f = S.ui.teamFind; return f && f.row === i ? f : null; };
  /**
   * 구장 이름으로 위도·경도를 찾는다(app.searchPlace: 카카오 지도 키가 있으면 카카오 장소 검색, 없으면 기본 구장 목록).
   * 하나면 바로 채우고, 여럿이면 카드에 목록, 없으면 직접 적으라고 안내한다. 구장 이름은 적은 그대로 둔다(특별 경기의 구장 이름이 이 이름을 쓴다).
   */
  function findStadium(i, q) {
    q = String(q || '').trim();
    const t = app().state.teams[i];
    if (!t || !q || S.locked()) return Promise.resolve(null);
    const cur0 = S.ui.teamFind;
    if (cur0 && cur0.busy && cur0.row === i && cur0.q === q && G.findP) return G.findP; // 같은 검색이 진행 중
    const f = S.ui.teamFind = { row: i, q, busy: true };
    S.render();
    return app().searchPlace(q).then((r) => {
      if (S.ui.teamFind !== f) return null; // 그 사이 다른 구단을 골랐다
      const kakao = r.source === 'KAKAO' && !r.note;
      Object.assign(f, { busy: false, src: kakao ? '카카오 장소 검색' : '기본 구장 목록' + (app().kakaoKey ? '(카카오 검색을 쓰지 못함)' : ''), results: r.results.slice(0, 6) });
      if (f.results.length === 1) pickStadium(i, 0);
      S.render();
      return f;
    });
  }
  function pickStadium(i, k) {
    const f = findState(i), x = f && f.results && f.results[k];
    if (!x) return false;
    const t = app().state.teams[i];
    const lat = Math.round(Number(x.latitude) * 1e6) / 1e6, lon = Math.round(Number(x.longitude) * 1e6) / 1e6;
    f.done = { name: x.name, address: x.address || '', lat, lon };
    f.results = null;
    if (t.stadium === f.q && t.latitude === lat && t.longitude === lon) { f.done.same = true; return true; }
    return app().updateTeam(i, { stadium: f.q, latitude: lat, longitude: lon });
  }
  /** 지도의 파란 번호 표시를 눌렀을 때(step-data.js 지도가 부른다) */
  S.teamFindPick = function (k) { const f = S.ui.teamFind; if (!f || S.locked()) return; pickStadium(f.row, k); S.render(); };
  /** 「지도에서 찍기」: 카카오 지도에서 누른 곳의 위도·경도로 채우고, 그 자리의 주소를 카카오 주소 변환으로 찾아 보여 준다 */
  S.teamMapPicked = function (i, lat, lon) {
    const t = app().state.teams[i];
    if (!t || S.locked()) return;
    lat = Math.round(lat * 1e6) / 1e6; lon = Math.round(lon * 1e6) / 1e6;
    S.ui.mapPick = null;
    const f = S.ui.teamFind = { row: i, q: t.stadium, src: '지도에서 직접 찍음', done: { name: '지도에서 찍은 곳', address: '', lat, lon } };
    app().updateTeam(i, { latitude: lat, longitude: lon });
    S.render();
    const k = app().kakao;
    if (!k || !k.maps.services || !k.maps.services.Geocoder) return;
    try {
      new k.maps.services.Geocoder().coord2Address(lon, lat, (res, status) => {
        if (status !== k.maps.services.Status.OK || !res || !res[0] || S.ui.teamFind !== f) return;
        f.done.address = (res[0].road_address && res[0].road_address.address_name) || (res[0].address && res[0].address.address_name) || '';
        S.render();
      });
    } catch (e) { /* 주소는 없어도 된다 */ }
  };
  function findBox(i, t) {
    const f = findState(i);
    if (!f) return '';
    if (f.busy) return '<div class="gs-find">' + icon('search') + ' 「' + esc(f.q) + '」 위치를 찾는 중입니다…</div>';
    if (f.done) {
      if (t.latitude !== f.done.lat || t.longitude !== f.done.lon) return ''; // 실행 취소 등으로 위치가 달라졌다
      return '<div class="gs-find ok">' + icon('check') + ' 「' + esc(f.done.name) + '」' + (f.done.address ? '(' + esc(f.done.address) + ')' : '') + (f.src === '지도에서 직접 찍음' ? ' ' + f.done.lat.toFixed(4) + ', ' + f.done.lon.toFixed(4) : '') + (f.done.same ? ' — 이미 이 위치입니다.' : ' 위치로 위도·경도를 채웠습니다. 이 구단의 거리는 직선거리로 다시 추정했습니다.') + '<span class="gs-find-src">찾은 곳: ' + esc(f.src) + (f.done.same ? '' : ' · 실행 취소(Ctrl+Z)로 되돌릴 수 있습니다') + '</span></div>';
    }
    if (!f.results || !f.results.length) return '<div class="gs-find warn">' + icon('warn') + ' 「' + esc(f.q) + '」을(를) 찾지 못했습니다 — ' + (app().kakao && app().kakaoKey ? '다른 이름(예: 「○○야구장」)으로 다시 찾거나 「지도에서 찍기」로 자리를 골라 주세요.' : '다른 이름으로 다시 찾아 주세요. 기본 구장 목록에 없는 구장은 설정 › 카카오 지도 키를 넣으면 카카오 장소 검색과 지도에서 찍기로 찾을 수 있습니다.') + '<span class="gs-find-src">찾아본 곳: ' + esc(f.src) + ' · 구장 이름은 아직 바꾸지 않았습니다</span></div>';
    return '<div class="gs-find">「' + esc(f.q) + '」 검색 결과 ' + f.results.length + '곳 — 맞는 곳을 누르면 위도·경도를 채웁니다. 오른쪽 지도의 파란 번호 표시를 눌러도 됩니다.<div class="gs-cands" role="listbox" aria-label="구장 검색 결과">' +
      f.results.map((x, k) => '<button class="gs-cand" data-act="g1-find-pick" data-row="' + i + '" data-k="' + k + '" role="option"><b><span class="gs-cand-no">' + (k + 1) + '</span>' + esc(x.name) + '</b><small>' + esc((x.address ? x.address + ' · ' : '') + Number(x.latitude).toFixed(4) + ', ' + Number(x.longitude).toFixed(4)) + '</small></button>').join('') +
      '</div><span class="gs-find-src">찾아본 곳: ' + esc(f.src) + ' <button class="lnk" data-act="g1-find-close">닫기</button></span></div>';
  }
  function teamEditor() {
    const st = app().state, i = S.ui.cell && S.ui.cell.sheet === 'teams' ? S.ui.cell.row : -1;
    if (i < 0 || !st.teams[i]) return '<div class="gs-sub">고치기</div><div class="gs-hint">표나 지도에서 구단을 누르면 여기서 구단명·구장을 고치고, 구장 위치와 다른 구장까지 거리를 봅니다. 구장이 바뀌지 않았으면 「달력으로 돌아가기」를 누릅니다.</div>';
    const t = st.teams[i], f = findState(i);
    const kakaoMap = !!(app().kakao && app().kakaoKey), picking = kakaoMap && S.ui.mapPick && S.ui.mapPick.row === i;
    const inp = (k, label, v, ph) => '<label class="field"><span>' + esc(label) + '</span><input class="input sm" data-in="team-field" data-row="' + i + '" data-k="' + k + '" value="' + esc(v) + '" aria-label="' + esc(t.name + ' ' + label) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '></label>';
    // 위도·경도는 직접 고치지 않는다: 구장 칸 Enter(장소 검색)·지도에서 찍기로만 바뀐다
    const ro = (label, v) => '<label class="field"><span>' + esc(label) + '</span><input class="input sm ro" data-ro="1" value="' + esc(v) + '" readonly tabindex="-1" aria-label="' + esc(t.name + ' ' + label + '(구장을 찾으면 채워짐)') + '" title="구장 칸에서 Enter로 찾' + (kakaoMap ? '거나 「지도에서 찍기」로 고르' : '') + '면 채워집니다"></label>';
    const stdV = f && !f.done ? f.q : t.stadium; // 고르는 중이면 적은 이름 그대로
    const others = st.teams.filter((x) => x.name !== t.name).map((x) => { const d = app().distanceOf(t.name, x.name) || {}; return { n: x.name, d: d.distance, est: !!d.estimated, road: d.source === 'ROAD' }; }).sort((a, b) => a.d - b.d);
    const a = app(), busy = a.roadBusy && (a.roadBusy === 'all' || a.roadBusy.has(t.name));
    const dist = (o) => '<div class="gs-line gs-dist">' + S.team(o.n) + '<span class="gs-v">' + (o.est ? '<span class="tag ref" title="직선거리 × 도로계수로 추정한 값">추정</span>' : o.road ? '<span class="tag road" title="카카오모빌리티 길찾기(자동차)로 받은 도로거리">도로</span>' : '') +
      '<input class="input xs mono gs-km" data-in="team-dist" data-from="' + esc(t.name) + '" data-to="' + esc(o.n) + '" value="' + (o.d == null ? '' : Number(o.d).toFixed(1)) + '" inputmode="decimal" aria-label="' + esc(t.name + ' → ' + o.n + ' 거리(km)') + '"></span></div>';
    const pickRow = '<div class="gs-pickteam" role="radiogroup" aria-label="고칠 구단">' + st.teams.map((x, k) => '<button class="gs-tbtn' + (k === i ? ' on' : '') + '" data-act="team-sel" data-row="' + k + '" role="radio" aria-checked="' + (k === i) + '" style="--tc:' + esc(x.color || '#555') + '"><i></i>' + esc(x.name) + '</button>').join('') + '</div>';
    return '<div class="gs-sub">고칠 구단 <small>단추나 가운데 표·지도에서 고릅니다</small></div>' + pickRow +
      '<div class="gs-sub">고치기 <small>' + esc(t.name) + '</small></div>' +
      '<div class="gs-form gs-team"><div class="gs-form-row">' + inp('name', '구단명', t.name) + inp('stadium', '구장 (Enter = 위치 찾기)', stdV, '구장 이름') + '</div><div class="gs-form-row">' + ro('위도', t.latitude.toFixed(4)) + ro('경도', t.longitude.toFixed(4)) + '</div></div>' +
      (kakaoMap ? (picking
        ? '<div class="gs-find pick">' + icon('move') + ' 오른쪽 지도에서 새 구장 자리를 누르세요. 누른 곳의 위도·경도로 채웁니다. <button class="btn xs" data-act="g1-map-pick-off">취소</button></div>'
        : '<div class="gs-mappick"><button class="btn xs" data-act="g1-map-pick" data-row="' + i + '">' + icon('move') + '지도에서 찍기</button><span>카카오 지도에서 자리를 눌러 위도·경도를 넣습니다</span></div>') : '') +
      (picking ? '' : findBox(i, t)) +
      '<div class="gs-hint">위도·경도는 직접 고치지 않습니다. 구장 칸에 이름을 적고 Enter를 누르면 ' + (app().kakaoKey ? '카카오 장소 검색' : '기본 구장 목록') + '에서 찾아 채우고' + (kakaoMap ? ', 「지도에서 찍기」로도 고를 수 있습니다' : '') + '. 위치가 바뀌면 이 구단의 구장 간 거리를 직선거리로 다시 추정합니다.</div>' +
      '<div class="gs-sub gs-sub-row">다른 구장까지 거리 <small>km · 고치면 반대 방향도 함께</small>' + (a.roadApi ? (busy ? '<span class="gs-road-busy">' + icon('clock') + '도로거리 받는 중…</span>' : '<button class="btn xs" data-act="g1-road" data-name="' + esc(t.name) + '" title="카카오모빌리티 길찾기로 이 구단의 9개 거리를 도로거리로 받습니다">' + icon('map') + '도로거리 받기</button>') : '') + '</div>' + others.map(dist).join('') +
      '<div class="gs-hint">' + (a.roadApi ? '「도로」는 카카오모빌리티 길찾기(자동차)로 받은 도로거리, 「추정」은 직선거리 × 도로계수입니다. 구장 위치가 바뀌면 도로거리를 자동으로 다시 받습니다. 숫자를 고치고 Enter를 누르면 직접 적은 값이 됩니다.' : '「추정」은 직선거리 × 도로계수로 계산한 값입니다. 실제 도로거리를 알면 숫자를 고치고 Enter를 누릅니다.' + (a.roadChecked ? ' 도로거리 자동 계산은 편성 서버에서만 됩니다.' : '')) + '</div>';
  }

  // ───────── 구단 정보 펼침 ─────────
  function teamsScreen(R) {
    const st = app().state;
    if (st.teams.length) { const c = S.ui.cell; if (!c || c.sheet !== 'teams' || !st.teams[c.row]) S.ui.cell = { sheet: 'teams', row: 0, col: 'name' }; }
    S.ui.tab = 'teams';
    const est = st.distanceMatrix.filter((d) => d.estimated).length;
    return '<div class="stepview gs" data-mode="teams"><div class="gs-strip"><span class="gs-mode">' + icon('team') + '구단 정보 · 펼쳐서 고치기</span>' +
      '<span class="gs-pos">' + st.teams.length + '구단 · 거리 ' + st.teams.length * (st.teams.length - 1) + '개' + (est ? ' (추정 ' + est + ')' : '') + '</span><span class="gs-sp"></span>' +
      '<span class="gs-right"><button class="btn sm primary" data-act="g1-teams-close">' + icon('left') + '달력으로 돌아가기</button></span></div>' +
      '<div class="gs-work"><aside class="gs-card" aria-label="구단 정보 고치기" data-page="teams"><div class="gs-head"><h3>구단 정보</h3>' + S.stat('ok', '확인') + '</div><div class="gs-body" data-sk="gs-card">' +
      '<p class="gs-why">구단 이름과 구장, 구장 위치(위도·경도)입니다. 구장 사이 이동거리는 이 위치로 계산합니다. 구장이 바뀌는 해(예: 잠실 공사로 임시 구장을 쓸 때)에는 여기부터 고쳐야 시리즈·공정성 계산이 맞습니다.</p>' +
      teamEditor() + '</div></aside><section class="pane main">' + R.teams() + '</section></div></div>';
  }

  /** step-data.js의 S.steps[1].render가 부른다. null이면 지금까지의 ① 전체 화면(모든 표 보기). R = { sheet, season, teams, calendar } */
  S.guideUI = {
    renderStep1(R) {
      if (G.mode === 'all') return null;
      if (G.open === 'teams') return teamsScreen(R);
      return R.calendar();
    },
    /** 하단: 시즌 달력이면 안내 한 줄 · 실행 취소 · 「다음: 검토·실행」 */
    footer() {
      if (S.ui.step !== 1 || S.ui.ops || G.mode !== 'cal') return null;
      return S.calFooter ? S.calFooter() : null;
    },
    /** 스테퍼 ①의 요약 줄 */
    stepSummary() {
      if (G.mode !== 'cal' || !S.calSummary) return null;
      return S.calSummary();
    },
    /** 띠(모든 표 보기)의 단추 */
    button() { return '<button class="btn sm gs-open" data-act="g1-cal" title="입력을 모두 한 화면(시즌 달력)에서 합니다">' + icon('cal') + '시즌 달력으로</button>'; },
    after(el) { if (S.calAfter) S.calAfter(el); else if (el) el.innerHTML = ''; },
    onKey(e) {
      if (S.ui.step !== 1 || G.mode !== 'cal' || S.guideBlocked()) return false;
      if (G.open === 'teams') {
        if (e.key === 'Escape' && S.ui.mapPick) { S.ui.mapPick = null; S.render(); return true; }
        // 카드의 구장 칸: Enter = 구장 위치 찾기(이름 저장과 위치 채우기를 한 번에 → 실행 취소 한 번)
        // 한글 입력 중(마지막 글자 조합 중)의 Enter는 조합을 끝내는 키라 건너뛴다 — 맥 Chrome은 조합 Enter 뒤에 보통 Enter를 한 번 더 보낸다
        if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && e.target.matches && e.target.matches('.gs-team input[data-k="stadium"]')) { e.preventDefault(); G.findP = findStadium(+e.target.dataset.row, e.target.value); return true; }
        return false;
      }
      return S.calOnKey ? S.calOnKey(e) : false;
    },
    onReset() { G.open = null; if (S.calOnReset) S.calOnReset(); },
    /** 자가 점검이 끝나면 모든 표 보기로(점검 도구가 표 화면을 이어서 본다) */
    close() { G.mode = 'all'; G.open = null; },
    state: () => ({ mode: G.mode, open: G.open }),
    findSettle: async () => { if (G.findP) await G.findP; G.findP = null; },
    async selftest({ ok, click, flush }) {
      const settle = async () => { if (G.findP) await G.findP; G.findP = null; flush(); };
      const st = () => app().state;
      const q = (sel) => document.querySelector(sel);
      const qa = (sel) => document.querySelectorAll(sel);
      const card0 = () => q('.gs-card');
      // 구단 정보: 시즌 달력의 접힌 요약 → 「펼쳐서 고치기」 → 예전 1단계 화면(왼쪽 카드 + 구단 표·지도) → 「달력으로 돌아가기」
      G.mode = 'cal'; G.open = null; S.go({ step: 1, ops: null, cell: null, edit: null });
      ok('구단 정보: 시즌 달력 왼쪽 위 접힌 요약(10구단 · 거리 90개) + 「펼쳐서 고치기」', !!q('.sc-teams') && /10구단/.test(q('.sc-teams').textContent) && /거리 90개/.test(q('.sc-teams').textContent) && !!q('.sc-teams [data-act="g1-teams"]'));
      click('.sc-teams [data-act="g1-teams"]'); flush();
      ok('구단 정보: 펼치면 왼쪽 카드 + 구단 표·구장 지도 · 주소 open=teams · 「달력으로 돌아가기」', G.open === 'teams' && !!card0() && !!q('.pane.main .tm-table') && !!q('#teamMapHost') && !!q('[data-act="g1-teams-close"]') && (() => { const o = { step: 1, tab: S.ui.tab }; S.g1Hash(o); return o.open === 'teams' && !o.tab; })());
      // 카드에서 바로 고르기: 첫 구단이 골라져 있고, 구단 단추 10개 · 표 줄에 「눌러서 고치기」(고른 줄은 「고치는 중」)
      const btns = () => qa('.gs-card .gs-pickteam .gs-tbtn');
      const pick0 = btns().length === 10 && btns()[0].classList.contains('on') && q('.pane.main tbody tr.sel') === qa('.pane.main tbody tr')[0] && qa('.pane.main .tm-edit-hint').length === 10 && /왼쪽 카드에서 고치는 중/.test(q('.pane.main tbody tr.sel .tm-edit-hint').textContent) && /눌러서 고치기/.test(qa('.pane.main .tm-edit-hint')[1].textContent) && q('#teamMapHost .kmap-active').getAttribute('data-id') === '0';
      click('.gs-card .gs-pickteam .gs-tbtn[data-row="3"]'); flush();
      const pick3 = /고치기 KT/.test(card0().textContent) && btns()[3].classList.contains('on') && q('.pane.main tbody tr.sel') === qa('.pane.main tbody tr')[3];
      click('.pane.main tbody tr[data-row="5"] td.rn'); flush();
      const rowPick = /고치기 한화/.test(card0().textContent);
      ok('구단 정보 펼침: 구단 정보 — 첫 구단이 골라진 채 시작 · 카드의 구단 단추 10개로 바꿈 · 표 줄(번호 칸 포함) 눌러도 바뀜 · 줄에 「눌러서 고치기」', pick0 && pick3 && rowPick, 'pick0 ' + pick0 + ' · pick3 ' + pick3 + ' · row ' + rowPick);
      // 구단 고치기: 표에서 구단을 누르면 카드에 칸 4개, 구장·위도를 바꾸면 거리가 추정값으로
      const li = st().teams.findIndex((t) => t.name === 'LG');
      click('.pane.main [data-act="team-sel"][data-row="' + li + '"]'); flush();
      ok('구단 정보 펼침: 표에서 LG를 누르면 카드에 구단명·구장 칸(고칠 수 있음) · 위도·경도(읽기만) · 거리 칸 9개', qa('.gs-card .gs-team input[data-in="team-field"]').length === 2 && qa('.gs-card .gs-team input[data-ro][readonly]').length === 2 && !q('.gs-card input[data-k="latitude"]') && qa('.gs-card .gs-dist input[data-in="team-dist"]').length === 9);
      const putT = (k, v) => { const i = q('.gs-card input[data-in="team-field"][data-k="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      const est0 = st().distanceMatrix.filter((d) => d.estimated).length;
      // 구장 이름만 바꾸면 거리는 그대로(직접 적은 거리를 지우지 않음)
      putT('stadium', '고척스카이돔(임시)');
      const renamed = st().teams[li].stadium === '고척스카이돔(임시)' && st().distanceMatrix.filter((d) => d.estimated).length === est0;
      app().undo(); flush();
      // 거리 칸: LG → KT 를 31.5로 → 양쪽 방향 31.5 · 추정 아님, 잘못된 값은 거부
      const kmIn = () => q('.gs-card input[data-in="team-dist"][data-to="KT"]');
      const putKm = (v) => { const i = kmIn(); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      const ktKm0 = app().distanceOf('LG', 'KT').distance;
      putKm('31.5');
      const kmSet = app().distanceOf('LG', 'KT').distance === 31.5 && app().distanceOf('KT', 'LG').distance === 31.5 && !app().distanceOf('LG', 'KT').estimated && kmIn().value === '31.5';
      putKm('먼 거리');
      const kmRejected = app().distanceOf('LG', 'KT').distance === 31.5;
      app().undo(); flush();
      ok('구단 정보 펼침: 구장 이름만 바꾸면 거리 그대로 · 거리 칸 LG→KT 31.5 → 양쪽 방향 · 잘못된 값 거부 · 실행 취소로 복귀', renamed && kmSet && kmRejected && app().distanceOf('LG', 'KT').distance === ktKm0 && app().distanceOf('KT', 'LG').distance === ktKm0 && st().teams[li].stadium !== '고척스카이돔(임시)', 'renamed ' + renamed + ' · kmSet ' + kmSet + ' · rejected ' + kmRejected);
      // 구장 지도: 키가 없으면 내장 지도(구장 10개, 고른 구단 강조) + 설정 안내 한 줄, 지도에서 구단을 눌러 고르기
      const mk = () => qa('#teamMapHost .tm-map svg.kmap .kmap-marker');
      ok('구단 정보 펼침: 구장 지도 — 키 없음 → 내장 지도 · 표시 10개 · 고른 LG 강조 · 「설정 › 카카오 지도 키」 안내 · 개발 글줄 없음', mk().length === 10 && qa('#teamMapHost .kmap-active').length === 1 && q('#teamMapHost .kmap-active').getAttribute('data-id') === String(li) && /설정 › 카카오 지도 키를 넣으면 카카오 지도로 보입니다/.test(q('.tm-foot').textContent) && !!q('.tm-foot [data-act="open-settings"]') && !q('#teamMapHost .k-map-caption') && q('.tm-mapblk').getBoundingClientRect().width >= q('.tm-left').getBoundingClientRect().width * 0.5, 'markers ' + mk().length + ' · map ' + Math.round(q('.tm-mapblk').getBoundingClientRect().width) + ' · table ' + Math.round(q('.tm-left').getBoundingClientRect().width));
      const ki = st().teams.findIndex((t) => t.name === 'KIA');
      q('#teamMapHost .kmap-marker[data-id="' + ki + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); flush();
      const mapPick = S.ui.cell && S.ui.cell.row === ki && /고치기 KIA/.test(card0().textContent) && q('#teamMapHost .kmap-active').getAttribute('data-id') === String(ki);
      click('.pane.main [data-act="team-sel"][data-row="' + li + '"]'); flush();
      ok('구단 정보 펼침: 지도에서 KIA 표시를 누르면 카드가 KIA로 · 다시 표에서 LG', mapPick && /고치기 LG/.test(card0().textContent));
      // 구장 칸 Enter = 구장 위치 찾기(키가 없으면 기본 구장 목록): 하나 → 바로 채움 · 여럿 → 카드에서 고름 · 없음 → 직접 적으라는 안내. 매번 실행 취소 한 번으로 복귀
      const lg0 = Object.assign({}, st().teams[li]);
      // 실제 브라우저는 Enter 뒤 칸을 다시 그릴 때 그 칸의 change도 보낸다 → 같은 칸의 change를 한 번 더 보내 실행 취소가 한 번으로 남는지 본다
      const findT = async (v) => {
        const i = q('.gs-card .gs-team input[data-k="stadium"]'); i.value = v; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const ghost = document.createElement('input'); ghost.setAttribute('data-in', 'team-field'); ghost.dataset.row = i.dataset.row; ghost.dataset.k = 'stadium'; ghost.value = v; document.body.appendChild(ghost); ghost.dispatchEvent(new Event('change', { bubbles: true })); ghost.remove();
        await settle();
      };
      const back = () => { const t = st().teams[li]; return t.stadium === lg0.stadium && t.latitude === lg0.latitude && t.longitude === lg0.longitude && st().distanceMatrix.filter((d) => d.estimated).length === est0; };
      { const i0 = q('.gs-card .gs-team input[data-k="stadium"]'); i0.value = '고척'; i0.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true })); }
      const imeSkip = !S.ui.teamFind && !G.findP && st().teams[li].stadium === lg0.stadium;
      const us = () => app().store.undoStack, top0 = us()[us().length - 1];
      await findT('고척');
      const oneUndo = us()[us().length - 2] === top0; // 새 항목이 딱 하나(실행 취소 개수 상한에서도 맞도록 맨 위 항목으로 본다)
      const one = st().teams[li].stadium === '고척' && Math.abs(st().teams[li].latitude - 37.498293) < 1e-5 && Math.abs(st().teams[li].longitude - 126.867137) < 1e-5 && st().distanceMatrix.filter((d) => d.estimated && (d.from === 'LG' || d.to === 'LG')).length === 18 && !!q('.gs-card .gs-find.ok') && /고척돔야구장/.test(q('.gs-card .gs-find').textContent) && /기본 구장 목록/.test(q('.gs-card .gs-find').textContent) && q('.gs-card .gs-team input[data-ro]').value === '37.4983';
      app().undo(); flush();
      ok('구단 정보 펼침: 구장 칸에 「고척」 + Enter(한글 조합 중 Enter는 건너뜀) → 고척돔야구장 위도·경도를 채움 · 이름은 적은 그대로 · LG 거리 18개 추정 · 실행 취소 한 번으로 복귀', imeSkip && oneUndo && one && back() && !q('.gs-card .gs-find.ok'), 'ime ' + imeSkip + ' · oneUndo ' + oneUndo + ' · one ' + one + ' · back ' + back());
      await findT('대전');
      const many = qa('.gs-card .gs-cand').length === 2 && st().teams[li].stadium === lg0.stadium && q('.gs-card input[data-k="stadium"]').value === '대전';
      click('.gs-card .gs-cand[data-k="1"]'); flush();
      const picked = st().teams[li].stadium === '대전' && st().teams[li].latitude === 36.3166 && !q('.gs-card .gs-cand') && /대전한화생명볼파크/.test(q('.gs-card .gs-find.ok').textContent);
      app().undo(); flush();
      ok('구단 정보 펼침: 「대전」 + Enter → 결과 2곳을 카드에 · 고르면 채움 · 실행 취소 한 번으로 복귀', many && picked && back(), 'many ' + many + ' · picked ' + picked + ' · back ' + back());
      await findT('마산');
      const onMap = qa('#teamMapHost .kmap-marker[data-id^="c"]').length === 2 && /파란 번호 표시/.test(q('.tm-foot').textContent) && /1창원NC파크/.test(q('.gs-card .gs-cand').textContent.replace(/\s+/g, '')) && !q('.gs-card [data-act="g1-map-pick"]');
      q('#teamMapHost .kmap-marker[data-id="c0"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); flush();
      const mapPicked = st().teams[li].stadium === '마산' && st().teams[li].latitude === 35.222564 && !q('#teamMapHost .kmap-marker[data-id^="c"]') && /창원NC파크/.test(q('.gs-card .gs-find.ok').textContent);
      app().undo(); flush();
      ok('구단 정보 펼침: 「마산」 + Enter → 결과 2곳이 지도에도 파란 번호로 · 지도의 1번을 누르면 채움 · 키가 없으면 「지도에서 찍기」 없음 · 실행 취소로 복귀', onMap && mapPicked && back(), 'onMap ' + onMap + ' · mapPicked ' + mapPicked + ' · back ' + back());
      // 도로거리 받기(편성 서버 중계): file:// 점검이라 서버 대신 가짜 응답으로 — 9쌍 양쪽 방향 「도로」, 실패 쌍은 그대로, 실행 취소 한 번
      const realFetch = window.fetch;
      let calls = 0;
      window.fetch = (url, o) => {
        if (url !== '/api/v1/road-distance') return realFetch(url, o);
        calls++;
        const ps = JSON.parse(o.body).pairs;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ results: ps.map((p, k) => (k === 0 ? { error: '길을 찾지 못했습니다' } : { km: 100 + k })) }) });
      };
      app().roadApi = true; flush();
      const roadUi = !!q('.gs-card [data-act="g1-road"]') && !!q('.tm-road [data-act="road-all"]') && /도로 0쌍/.test(q('.tm-road').textContent);
      const top0r = us()[us().length - 1];
      const rr = await app().fetchRoadDistances(['LG']); flush();
      const roadPairs = st().distanceMatrix.filter((d) => d.source === 'ROAD' && (d.from === 'LG' || d.to === 'LG'));
      const roadOk = calls === 1 && rr.ok === 8 && rr.failed === 1 && roadPairs.length === 16 && roadPairs.every((d) => !d.estimated && d.distance >= 101) && qa('.gs-card .gs-dist .tag.road').length === 8 && /도로 8쌍/.test(q('.tm-road').textContent) && us()[us().length - 2] === top0r;
      app().undo(); flush();
      window.fetch = realFetch; app().roadApi = false; flush();
      ok('구단 정보 펼침: 도로거리 받기(서버 중계 흉내) → 8쌍 양쪽 방향 「도로」 · 못 받은 1쌍은 그대로 · 실행 취소 한 번으로 복귀 · 서버가 없으면 단추 없음', roadUi && roadOk && !st().distanceMatrix.some((d) => d.source === 'ROAD') && back() && !q('.gs-card [data-act="g1-road"]'), 'ui ' + roadUi + ' · ok ' + rr.ok + ' · failed ' + rr.failed + ' · pairs ' + roadPairs.length + ' · calls ' + calls);
      const topN = us()[us().length - 1];
      await findT('없는구장이름');
      const none = !!q('.gs-card .gs-find.warn') && /찾지 못했습니다 — 다른 이름으로 다시 찾아 주세요/.test(q('.gs-card .gs-find.warn').textContent) && st().teams[li].stadium === lg0.stadium && q('.gs-card input[data-k="stadium"]').value === '없는구장이름' && us()[us().length - 1] === topN;
      ok('구단 정보 펼침: 없는 이름 + Enter → 「찾지 못했습니다 — 다른 이름으로 다시 찾아 주세요」 · 아무것도 바꾸지 않음(실행 취소 항목 없음)', none && back(), 'none ' + none + ' · back ' + back());
      S.ui.teamFind = null;
      S.ui.teamFind = null;
      click('[data-act="g1-teams-close"]'); flush();
      ok('구단 정보: 「달력으로 돌아가기」 → 시즌 달력', G.open === null && !!q('.sc-strip') && !q('.gs-card'));
      if (S.calSelftest) await S.calSelftest({ ok, click, flush });
      G.mode = 'all'; G.open = null; S.go({ step: 1, tab: 'slots', cell: null, edit: null });
    },
    /** 금지어 검사용 화면 목록 */
    screens() {
      const out = [];
      out.push({ where: '구단 정보 펼침 — 구단 고름·구장 찾기 결과', patch: {}, fn: () => { G.mode = 'cal'; G.open = 'teams'; S.ui.cell = { sheet: 'teams', row: 2, col: 'name' }; S.ui.teamFind = { row: 2, q: '대전', busy: false, src: '기본 구장 목록', results: S.KBO.MapKit.searchStadiums('대전') }; } });
      out.push({ where: '구단 정보 펼침 — 구장을 찾지 못함', patch: {}, fn: () => { G.open = 'teams'; S.ui.cell = { sheet: 'teams', row: 2, col: 'name' }; S.ui.teamFind = { row: 2, q: '없는 구장', busy: false, src: '기본 구장 목록', results: [] }; } });
      out.push({ where: '구단 정보 펼침 — 도로거리 받기 단추(편성 서버)', patch: {}, fn: () => { G.open = 'teams'; S.ui.cell = { sheet: 'teams', row: 2, col: 'name' }; S.ui.teamFind = null; app().roadApi = true; } });
      out.push({ where: '모든 표 보기 복귀', patch: { tab: 'slots' }, fn: () => { G.open = null; G.mode = 'all'; S.ui.cell = null; S.ui.teamFind = null; app().roadApi = false; } });
      return (S.calScreens ? S.calScreens() : []).concat(out);
    }
  };

  Object.assign(S.actions, {
    'g1-all': (el) => { G.mode = 'all'; G.open = null; const t = el && el.dataset.tab; const tab = t || (S.SHEETS[S.ui.tab] || S.ui.tab === 'season' || S.ui.tab === 'teams' ? S.ui.tab : 'slots'); S.go({ step: 1, ops: null, tab, cell: null, edit: null, modal: null, drawer: null }); },
    'g1-cal': () => { G.mode = 'cal'; G.open = null; S.go({ step: 1, ops: null, cell: null, edit: null, modal: null, drawer: null }); },
    'g1-teams': () => { G.mode = 'cal'; G.open = 'teams'; S.ui.teamFind = null; S.go({ step: 1, ops: null, cell: null, edit: null }); },
    'g1-teams-close': () => { G.open = null; S.ui.teamFind = null; S.ui.mapPick = null; S.go({ step: 1, cell: null, edit: null }); },
    'g1-find-pick': (el) => { if (S.locked()) return; pickStadium(+el.dataset.row, +el.dataset.k); S.render(); },
    'g1-road': (el) => { if (S.locked()) return; app().fetchRoadDistances([el.dataset.name]).then(S.roadToast); },
    'g1-find-close': () => { S.ui.teamFind = null; S.render(); },
    'g1-map-pick': (el) => { if (S.locked()) return; S.ui.mapPick = { row: +el.dataset.row }; S.ui.teamFind = null; S.render(); },
    'g1-map-pick-off': () => { S.ui.mapPick = null; S.render(); }
  });
})();
