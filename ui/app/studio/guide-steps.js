/*
 * 편성 스튜디오 — ① 데이터 준비: 단계별 화면 (표준)
 * ①에 들어오면 먼저 묻는다: 「데이터를 새로 입력할게요」 / 「기존 데이터를 볼게요」. 그 밖의 것은 보이지 않는다.
 *  - 새로 입력: 표를 비우고(실행 취소 가능) 1단계부터. 한 화면에 그 단계의 표(또는 입력 칸)·짧은 설명·그 단계의 단추·「다음」만 보인다.
 *  - 기존 데이터 보기: 지금 데이터로 같은 순서의 1단계부터. 입력 대신 「이 표에 무엇이 들어 있는지 · 바꿀 거면 어디서」를 보여 준다.
 * 단계 순서는 S.GUIDE_TASKS(guide-base.js) 9개: 구단 정보(구장이 바뀌었는지 먼저 확인) → 시즌 기본 설정 → 공휴일 → 휴식일 경기 → 휴식기 → 연전 기간 → 시리즈 → 특별 경기 → 다음. 상단 스테퍼의 ①은 그대로 두고, ① 안에서 작은 단계로 넘긴다(위쪽 띠에 「3 / 9」, 아래 「다음」).
 * 전문가용: 「모든 표 보기」(지금까지의 ① 전체 화면: 가져오기 띠·왼콍 목록·오른쪽 자세히)로 언제든 갈 수 있고, 단계별 안내는 「안내 끄기」로 끌 수 있다(저장 S.ls).
 * 주소: #step=1&g=ask | g=new&gs=3 | g=view&gs=3 | g=all. 예전 주소 #step=1&tab=… 는 그대로 그 표(모든 표 보기)를 연다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { esc, icon, fmt } = S;
  const store = S.guideStore('steps');
  // mode: undefined(아직 정하지 않음 → 저장값으로 정함) · null(묻는 중) · 'new' · 'view' · 'all'(모든 표 보기)
  const G = S.g1 = { mode: undefined, i: 1, justReset: false, lastTab: null }; // lastTab: 단계별 화면이 마지막으로 맞춘 표. null이면 단계(i)가 우선
  const tasks = () => S.GUIDE_TASKS;
  const N = () => tasks().length;
  const app = () => S.app;
  const blank = () => S.isBlank();
  const T = (x) => S.gtxt(x);
  const Gen = () => S.KBO.CalendarGen;
  const clamp = (i) => Math.max(1, Math.min(N(), parseInt(i, 10) || 1));
  const cur = () => tasks()[G.i - 1];
  const stepwise = () => G.mode === 'new' || G.mode === 'view';
  const indexOf = (id) => tasks().findIndex((t) => t.id === id) + 1;
  const MODE_NAME = { new: '새로 입력하기', view: '기존 데이터 보기' };

  /** 저장값으로 처음 상태를 정한다: 안내를 꺼 두었으면 모든 표 보기, 하던 단계가 있으면 그 단계, 아니면 묻는다 */
  function ensureMode() {
    if (G.mode !== undefined) return;
    const st = store.get();
    if (st.off) G.mode = 'all';
    else if ((st.mode === 'new' || st.mode === 'view') && st.at > 0) { G.mode = st.mode; G.i = clamp(st.at); }
    else G.mode = null;
  }
  function setMode(m, i) {
    G.mode = m;
    if (i) G.i = clamp(i);
    if (m === 'new' || m === 'view') store.set({ mode: m, at: G.i, seen: true });
    else if (m === 'all') store.set({ seen: true });
  }
  /** 단계 i로 간다(표도 그 단계의 표로) */
  function show(i) {
    G.i = clamp(i); G.lastTab = null;
    store.set({ at: G.i });
    const t = cur();
    S.go({ step: 1, ops: null, tab: t.tab || S.ui.tab, cell: null, edit: null, vizChanged: null, modal: null, drawer: null });
  }
  /** 주소에서: g=ask|new|view|all, gs=단계. g가 없고 표(tab)가 적혀 있으면 그 표를 그대로 연다(모든 표 보기) */
  S.g1Route = function (o) {
    const g = o.g || (o.guide != null ? 'ask' : null);
    if (g === 'ask') { G.mode = null; G.i = 1; }
    else if (g === 'new' || g === 'view') { G.mode = g; G.i = clamp(o.gs || store.get().at || 1); G.lastTab = null; }
    else if (g === 'all') G.mode = 'all';
    else if (o.tab && (!o.step || +o.step === 1)) G.mode = 'all';
  };
  /** 주소에 적을 것 */
  S.g1Hash = function (o) {
    if (G.mode === undefined) return;
    if (G.mode === null) { o.g = 'ask'; delete o.tab; }
    else if (stepwise()) { o.g = G.mode; o.gs = G.i; delete o.tab; }
  };
  /** 다른 화면(사전 점검 등)에서 「①의 이 표로」: 단계별이면 그 표의 단계로, 아니면 모든 표 보기로 그 표를 연다 */
  S.g1Open = function (tab, extra) {
    ensureMode();
    const k = tasks().findIndex((t) => t.tab === tab);
    if (stepwise() && k >= 0) { G.i = k + 1; G.lastTab = null; store.set({ at: G.i }); }
    else if (!stepwise()) G.mode = 'all';
    S.go(Object.assign({ step: 1, tab, ops: null, sel: null }, extra || {}));
  };

  // ───────── 카드 안 요약 줄 ─────────
  const line = (label, value, right) => '<div class="gs-line"><span class="gs-k">' + esc(label) + '</span><span class="gs-v">' + value + '</span>' + (right || '') + '</div>';
  function gameDaysLine() {
    const set = app().state.settings;
    if (!set.seasonStart || !set.initialEnd) return line('경기일 합', '<span class="muted">개막일·1차 편성 종료일을 적으면 셉니다</span>');
    const gd = S.gameDaysCheck(Gen().generateSlots(set).slots);
    return line('경기일 합', gd.have + '일 / 필요 ' + gd.need + '일', gd.ok ? S.stat('ok', '맞음') : S.stat('warn', gd.have < gd.need ? (gd.need - gd.have) + '일 부족' : (gd.have - gd.need) + '일 많음')) +
      (gd.ok ? '' : '<div class="gs-hint">' + (gd.have < gd.need ? '1차 편성 종료일을 늦추거나 휴식기를 줄이세요.' : '1차 편성 종료일을 당기거나, 휴식기 화면에서 올스타 휴식기 같은 경기 없는 기간을 넣으세요.') + ' 맞대결 ' + set.initialGamesPerPair + '경기 × 상대 ' + (app().state.teams.length - 1) + '구단 = ' + gd.need + '일이어야 시리즈가 빈 자리 없이 들어갑니다.</div>');
  }
  function balanceLines() {
    const st = app().state, half = st.teams.length >> 1;
    const sh = Gen().lengthHistogram(st.calendar), mh = Gen().lengthHistogram(st.matches);
    let s = '';
    for (const k of [2, 3, 4]) {
      const cap = (sh[k] || 0) * half, need = mh[k] || 0;
      if (!cap && !need) continue;
      s += line(k + '연전', '기간 ' + (sh[k] || 0) + '개 × ' + half + ' = ' + cap + ' · 시리즈 ' + need, cap === need ? S.stat('ok', '맞음') : S.stat('warn', need > cap ? '부족 ' + (need - cap) : '여유 ' + (cap - need)));
    }
    return s;
  }
  function pairLine() {
    const st = app().state;
    if (!st.matches.length) return '';
    const off = S.guidePairOff();
    return line('맞대결 경기 수', '모두 ' + st.settings.initialGamesPerPair + '경기여야 함', off ? S.stat('warn', off + '곳 다름') : S.stat('ok', '맞음'));
  }
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
    if (i < 0 || !st.teams[i]) return '<div class="gs-sub">고치기</div><div class="gs-hint">표나 지도에서 구단을 누르면 여기서 구단명·구장을 고치고, 구장 위치와 다른 구장까지 거리를 봅니다. 구장이 바뀌지 않았으면 그대로 「다음」을 누릅니다.</div>';
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
  const EXTRA = {
    teams: () => teamEditor(),
    season: () => gameDaysLine(),
    blackouts: () => gameDaysLine(),
    slots: () => { const st = app().state; return st.calendar.length ? '<div class="gs-sub">연전 수 맞추기 <small>연전 기간마다 ' + (st.teams.length >> 1) + '시리즈</small></div>' + balanceLines() + (st.matches.length ? '' : '<div class="gs-hint">시리즈를 아직 안 만들었으면 「여유」로 보이는 게 정상입니다. 다음 단계에서 시리즈를 만들면 모두 「맞음」이 됩니다.</div>') : gameDaysLine(); },
    series: () => { const st = app().state; return st.matches.length ? pairLine() + '<div class="gs-sub">연전 수 맞추기</div>' + balanceLines() : ''; }
  };

  // ───────── 묻는 화면 ─────────
  function askScreen() {
    const st = app().state, saved = store.get();
    const li = S.ui.lastImport;
    const isBlank = blank();
    const now = isBlank ? '지금은 표가 비어 있고 구단 정보만 들어 있습니다.' : '지금 데이터: ' + esc(li ? li.source : '2025 실제 일정(기본 제공)') + ' · 연전 기간 ' + st.calendar.length + ' · 시리즈 ' + st.matches.length + ' · 특별 경기 ' + st.events.length + ' · 공휴일 ' + st.settings.holidays.length + '일';
    const pick = (v, ic, title, sub, cls) => '<button class="gs-pick' + (cls ? ' ' + cls : '') + '" data-act="g1-pick" data-v="' + v + '">' + icon(ic) + '<b>' + esc(title) + '</b><span>' + esc(sub) + '</span></button>';
    const resume = (saved.mode === 'new' || saved.mode === 'view') && saved.at > 1 && saved.at <= N()
      ? '<button class="btn sm" data-act="g1-resume">' + icon('redo') + '이어서 할게요 — ' + esc(MODE_NAME[saved.mode]) + ' ' + saved.at + ' / ' + N() + ' ' + esc(tasks()[saved.at - 1].title) + '</button>' : '';
    return '<div class="stepview gs-ask"><div class="gs-ask-card" role="group" aria-labelledby="gsAskTitle">' +
      '<div class="gs-ask-kicker">① 데이터 준비</div><h2 id="gsAskTitle">어떻게 시작할까요?</h2>' +
      '<p class="gs-ask-sub">편성에 필요한 시즌 정보를 ' + N() + '단계로 하나씩 보여 드립니다. 한 화면에 하나씩만 나옵니다.</p>' +
      '<div class="gs-picks">' +
        pick('new', 'plus', '데이터를 새로 입력할게요', isBlank ? '비어 있는 표를 시즌 기본 설정부터 차례로 채웁니다. 직접 적는 것은 날짜 몇 개뿐이고, 큰 표는 단추로 만듭니다.' : '표를 비우고 시즌 기본 설정부터 차례로 적습니다. 직접 적는 것은 날짜 몇 개뿐이고, 큰 표는 단추로 만듭니다. 구단 정보는 남고, 실행 취소로 되돌릴 수 있습니다.', 'rec') +
        pick('view', 'eye', isBlank ? '2025 예시 데이터를 볼게요' : '기존 데이터를 볼게요', isBlank ? '2025 실제 일정을 불러와 같은 순서로 하나씩 보여 드립니다. 무엇이 들어 있고 어디서 바꾸는지 알 수 있습니다.' : '지금 들어 있는 데이터를 같은 순서로 하나씩 보여 드립니다. 무엇이 들어 있고 어디서 바꾸는지 알 수 있습니다.') +
      '</div>' +
      '<div class="gs-ask-now">' + icon('db') + '<span>' + now + '</span></div>' +
      '<div class="gs-ask-foot">' + resume + '<span class="gs-sp"></span><button class="btn sm ghost" data-act="g1-all" title="가져오기·표 목록·자세히가 모두 보이는 화면입니다">' + icon('table') + '모든 표 보기</button></div>' +
      '</div></div>';
  }

  // ───────── 단계별 화면 ─────────
  function strip() {
    const t = cur();
    let items = '';
    tasks().forEach((x, k) => {
      // 새로 입력할 때는 아직 가지 않은 단계에 「됨」 표시를 하지 않는다(비어 있어도 「없어도 됨」인 단계가 미리 체크되면 헷갈린다)
      const st = x.id === 'next' || (G.mode === 'new' && k + 1 > G.i) ? null : x.status();
      const cls = k + 1 === G.i ? 'on' : st && st.ok ? 'done' : st && st.kind === 'warn' ? 'warn' : '';
      items += '<li class="' + cls + '"><button data-act="g1-go" data-i="' + (k + 1) + '" title="' + esc((k + 1) + ' / ' + N() + ' ' + x.title + (st ? ' — ' + st.text : '')) + '"><i>' + (st && st.ok && k + 1 !== G.i ? icon('check') : k + 1) + '</i><span>' + esc(x.title) + '</span></button></li>';
    });
    return '<div class="gs-strip"><span class="gs-mode">' + icon(G.mode === 'new' ? 'plus' : 'eye') + esc(MODE_NAME[G.mode]) + '</span><span class="gs-pos">' + G.i + ' / ' + N() + '</span>' +
      '<ol class="gs-steps" aria-label="입력 단계">' + items + '</ol>' +
      '<span class="gs-right"><button class="btn xs ghost" data-act="g1-ask" title="처음 질문(새로 입력 / 기존 데이터 보기)으로 돌아갑니다">' + icon('left') + '처음 질문으로</button>' +
      '<button class="btn xs" data-act="g1-all" title="가져오기·표 목록·자세히가 모두 보이는 화면으로 갑니다. 단계는 기억합니다">' + icon('table') + '모든 표 보기</button>' +
      '<button class="btn xs ghost" data-act="g1-off" title="①에 들어올 때 묻지 않고 바로 모든 표를 보여 줍니다. 띠의 「단계별 안내 켜기」로 다시 켭니다">' + icon('x') + '안내 끄기</button></span></div>';
  }
  function card(t) {
    const st = t.id === 'next' ? S.guideTask('next').status() : t.status();
    const isNew = G.mode === 'new';
    const chip = t.id === 'next' ? '' : isNew
      ? S.stat(st.kind, st.ok ? '됨' : st.todo ? '아직' : '확인 필요')
      : S.stat(st.kind === 'todo' ? 'warn' : st.kind, st.ok ? '문제 없음' : st.todo ? '비어 있음' : '확인 필요');
    const extra = EXTRA[t.id] ? EXTRA[t.id]() : '';
    const acts = isNew || t.id === 'next' ? S.guideActButtons(t, 'sm') : '';
    const nowT = S.guideNext(), nowI = indexOf(nowT.id);
    return '<aside class="gs-card" aria-label="이 단계 안내" data-page="' + t.id + '" data-status="' + st.kind + '">' +
      '<div class="gs-head"><span class="gs-no">' + G.i + ' / ' + N() + '</span><h3>' + esc(t.title) + '</h3>' + chip + '</div>' +
      '<div class="gs-body" data-sk="gs-card">' +
        (G.justReset && G.i === 1 ? '<div class="gs-note ok">' + icon('check') + '<span>표를 모두 비웠습니다. 구단 정보만 남아 있습니다. 실행 취소(<span class="kbd">Ctrl</span>+<span class="kbd">Z</span>)로 되돌릴 수 있습니다.</span></div>' : '') +
        '<p class="gs-why">' + esc(T(t.why)) + '</p>' +
        (isNew
          ? '<div class="gs-how">' + icon('bolt') + '<span>' + esc(T(t.how)) + '</span></div>'
          : '<div class="gs-view"><b>' + icon('eye') + '들어 있는 것</b><span>' + esc(T(t.view)) + '</span></div><div class="gs-edit"><b>' + icon('rule') + '바꾸려면</b><span>' + esc(T(t.edit)) + '</span></div>') +
        extra +
        (acts ? '<div class="gs-acts">' + acts + '</div>' : '') +
        (t.id === 'next' ? '' : '<div class="gs-status ' + st.kind + '">' + S.stat(st.kind, isNew ? (st.ok ? '지금 상태' : st.todo ? '아직' : '확인 필요') : (st.ok ? '지금 상태' : '확인 필요')) + '<span>' + esc(st.text) + '</span></div>') +
        (isNew && nowI !== G.i && nowT.id !== 'next' && t.id !== 'next' ? '<div class="gs-now">' + icon('info') + '<span>지금 할 일: <b>' + esc(nowT.title) + '</b></span><button class="btn xs" data-act="g1-go" data-i="' + nowI + '">그 단계로' + icon('right') + '</button></div>' : '') +
      '</div></aside>';
  }
  function nextMain() {
    const isNew = G.mode === 'new';
    const rows = tasks().filter((t) => t.id !== 'next').map((t, k) => {
      const st = t.status();
      return '<tr class="' + st.kind + '"><td class="rn">' + (k + 1) + '</td><td><b>' + esc(t.title) + '</b></td><td class="small">' + esc(isNew ? st.text : T(t.view)) + '</td><td>' + (st.ok ? S.stat('ok', '문제 없음') : S.stat(st.kind === 'todo' ? 'todo' : 'warn', st.todo ? (isNew ? '아직' : '비어 있음') : '확인 필요')) + '</td><td><button class="btn xs" data-act="g1-go" data-i="' + (k + 1) + '">' + (st.ok ? '보기' : '고치기') + icon('right') + '</button></td></tr>';
    }).join('');
    const all = S.guideTask('next').status();
    return '<div class="pane-head"><span class="pane-title">정리</span><span class="pane-desc">' + N() + '단계를 모두 지났습니다. ' + (all.ok ? '다음은 ② 검토·실행입니다.' : '남은 곳을 먼저 확인하세요.') + '</span></div>' +
      '<div class="pane-body pad" data-sk="gs-next"><div class="blk"><table class="sheet gs-sum"><colgroup><col style="width:44px"><col style="width:150px"><col><col style="width:110px"><col style="width:90px"></colgroup><thead><tr><th class="rn">번호</th><th>단계</th><th>' + (isNew ? '지금 상태' : '들어 있는 것') + '</th><th>확인</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="gs-next-foot">' + (all.ok ? S.stat('ok', '모두 확인됨') + '<span>② 검토·실행에서 편성할 수 없는 입력이 있는지 한 번 더 점검하고 자동 편성을 돌립니다.</span>' : S.stat(all.kind, all.todo ? '아직' : '확인 필요') + '<span>' + esc(all.text) + ' — 그래도 ②로 넘어갈 수 있고, ②의 사전 점검이 다시 알려 줍니다.</span>') +
      '<button class="btn primary" data-act="go-step" data-step="2">다음: 검토·실행' + icon('right') + '</button></div></div>';
  }

  /** step-data.js의 S.steps[1].render가 부른다. null이면 지금까지의 ① 전체 화면(모든 표 보기). R = { sheet(key, opts), season(opts), teams() } */
  S.guideUI = {
    renderStep1(R) {
      ensureMode();
      if (G.mode === 'all') return null;
      if (G.mode === null) return askScreen();
      // 다른 곳에서 표(tab)만 바꿨으면(단추 동작 뒤 S.go({tab}) 등) 그 표의 단계로 맞춘다. 단계를 내가 정했으면(lastTab=null) 단계가 우선
      if (G.lastTab != null && S.ui.tab !== G.lastTab) { const k = tasks().findIndex((x) => x.tab === S.ui.tab); if (k >= 0) { G.i = k + 1; store.set({ at: G.i }); } }
      const t = cur();
      if (t.tab) S.ui.tab = t.tab;
      // 구단 정보: 처음부터 첫 구단을 골라 카드에 고치는 칸이 보이게 한다(「여기서 고친다」가 바로 보이도록)
      if (t.tab === 'teams' && app().state.teams.length) { const c = S.ui.cell; if (!c || c.sheet !== 'teams' || !app().state.teams[c.row]) S.ui.cell = { sheet: 'teams', row: 0, col: 'name' }; }
      G.lastTab = S.ui.tab;
      let main;
      if (t.id === 'next') main = nextMain();
      else if (t.tab === 'season') main = R.season({ subs: false });
      else if (t.tab === 'teams') main = R.teams();
      else main = R.sheet(t.tab, { assist: G.mode === 'view' });
      return '<div class="stepview gs" data-mode="' + G.mode + '">' + strip() + '<div class="gs-work">' + card(t) + '<section class="pane main">' + main + '</section></div></div>';
    },
    /** 하단: 이전 · 단계 이름 · 다음 (단계별 화면일 때만) */
    footer() {
      if (S.ui.step !== 1 || S.ui.ops) return null;
      ensureMode();
      if (G.mode === null) return '<button class="btn" disabled>' + icon('left') + '이전 단계</button><span class="hint"><b>① 데이터 준비</b> — 먼저 새로 입력할지, 기존 데이터를 볼지 고르세요.</span><button class="btn" data-act="g1-all">' + icon('table') + '모든 표 보기' + icon('right') + '</button>';
      if (!stepwise()) return null;
      const t = cur(), last = G.i === N();
      const prev = G.i > 1 ? '<button class="btn" data-act="g1-go" data-i="' + (G.i - 1) + '">' + icon('left') + '이전: ' + esc(tasks()[G.i - 2].title) + '</button>' : '<button class="btn" data-act="g1-ask">' + icon('left') + '처음 질문으로</button>';
      const next = last
        ? '<button class="btn primary" data-act="go-step" data-step="2">다음: 검토·실행' + icon('right') + '</button>'
        : '<button class="btn primary" data-act="g1-next">다음: ' + esc(tasks()[G.i].title) + icon('right') + '</button>';
      return prev + '<span class="hint"><b>① 데이터 준비 · ' + esc(MODE_NAME[G.mode]) + ' · ' + G.i + ' / ' + N() + ' ' + esc(t.title) + '</b> — ' + esc(T(t.short)) + '</span><span class="kbd-hint"><span class="kbd">Ctrl</span>+<span class="kbd">Z</span> 실행 취소</span>' + next;
    },
    /** 스테퍼 ①의 요약 줄 */
    stepSummary() {
      ensureMode();
      if (G.mode === null) return '어떻게 시작할지 고르는 중';
      if (!stepwise()) return null;
      return MODE_NAME[G.mode] + ' · ' + G.i + ' / ' + N() + ' ' + cur().title;
    },
    /** 띠(모든 표 보기)의 단추 */
    button() {
      const off = store.get().off;
      return off
        ? '<button class="btn sm" data-act="g1-on" title="①에 들어올 때 새로 입력할지, 기존 데이터를 볼지 묻고 단계별로 보여 줍니다">' + icon('list') + '단계별 안내 켜기</button>'
        : '<button class="btn sm gs-open" data-act="g1-steps" title="① 데이터 준비를 한 단계씩 보여 줍니다">' + icon('list') + '단계별로 보기</button>';
    },
    after() { /* 띠 위에 그릴 것 없음 */ },
    onKey(e) {
      if (S.ui.step !== 1 || !stepwise() || S.guideBlocked()) return false;
      if (e.key === 'Escape' && S.ui.mapPick) { S.ui.mapPick = null; S.render(); return true; }
      // 카드의 구장 칸: Enter = 구장 위치 찾기(이름 저장과 위치 채우기를 한 번에 → 실행 취소 한 번)
      // 한글 입력 중(마지막 글자 조합 중)의 Enter는 조합을 끝내는 키라 건너뛴다 — 맥 Chrome은 조합 Enter 뒤에 보통 Enter를 한 번 더 보낸다
      if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && e.target.matches && e.target.matches('.gs-team input[data-k="stadium"]')) { e.preventDefault(); G.findP = findStadium(+e.target.dataset.row, e.target.value); return true; }
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || S.ui.edit || (S.ui.cell && S.ui.cell.sheet !== 'teams')) return false; // 구단 정보는 늘 한 구단이 골라져 있으니 막지 않는다
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); if (G.i < N()) show(G.i + 1); return true; }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); if (G.i > 1) show(G.i - 1); return true; }
      return false;
    },
    /** 「처음부터 입력하기(초기화)」 직후: S.resetAll이 시즌 기본 설정 표로 가므로 표 동기화가 1단계로 맞춘다. 점검용 demo=blank(stay)는 단계를 그대로 둔다 */
    onReset() { /* 할 일 없음 */ },
    close() { G.mode = 'all'; },
    state: () => ({ mode: G.mode, i: G.i }),
    /** 금지어 검사용 화면 목록 */
    screens() {
      const out = [];
      out.push({ where: '묻는 화면(예시 데이터)', patch: {}, fn: () => { G.mode = null; store.set({ mode: 'view', at: 4 }); } });
      for (let k = 1; k <= N(); k++) out.push({ where: '기존 데이터 보기 ' + k, patch: {}, fn: () => { G.mode = 'view'; G.i = k; S.ui.tab = tasks()[k - 1].tab || S.ui.tab; } });
      out.push({ where: '묻는 화면(빈 상태)', patch: {}, fn: () => { S.resetAll({ quiet: true, stay: true }); G.mode = null; } });
      for (let k = 1; k <= N(); k++) out.push({ where: '새로 입력하기 빈 ' + k, patch: {}, fn: () => { G.mode = 'new'; G.i = k; G.justReset = k === 1; S.ui.tab = tasks()[k - 1].tab || S.ui.tab; } });
      out.push({ where: '구단 정보 — 구단 고름·구장 찾기 결과', patch: {}, fn: () => { G.mode = 'new'; G.i = 1; G.justReset = false; S.ui.tab = 'teams'; S.ui.cell = { sheet: 'teams', row: 2, col: 'name' }; S.ui.teamFind = { row: 2, q: '대전', busy: false, src: '기본 구장 목록', results: S.KBO.MapKit.searchStadiums('대전') }; } });
      out.push({ where: '구단 정보 — 구장을 찾지 못함', patch: {}, fn: () => { G.mode = 'view'; G.i = 1; S.ui.tab = 'teams'; S.ui.cell = { sheet: 'teams', row: 2, col: 'name' }; S.ui.teamFind = { row: 2, q: '없는 구장', busy: false, src: '기본 구장 목록', results: [] }; } });
      out.push({ where: '구단 정보 — 도로거리 받기 단추(편성 서버)', patch: {}, fn: () => { G.mode = 'view'; G.i = 1; S.ui.tab = 'teams'; S.ui.cell = { sheet: 'teams', row: 2, col: 'name' }; S.ui.teamFind = null; app().roadApi = true; } });
      out.push({ where: '모든 표 보기 복귀', patch: { tab: 'slots' }, fn: () => { G.justReset = false; G.mode = 'all'; S.ui.cell = null; S.ui.teamFind = null; app().roadApi = false; S.loadExample({ quiet: true, stay: true }); } });
      return out;
    },
    async selftest({ ok, click, flush }) {
      const settle = async () => { if (G.findP) await G.findP; G.findP = null; flush(); };
      const st = () => app().state;
      const q = (sel) => document.querySelector(sel);
      const qa = (sel) => document.querySelectorAll(sel);
      const card0 = () => q('.gs-card');
      const enter = (sheet, row, col, v) => { S.startEdit(sheet, row, col, v); document.getElementById('cellEditor').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); flush(); };
      const noExtras = () => !q('.band') && !q('.pane.list') && !q('.pane.insp') && !q('.insp-rail');
      // 주소 글자: 자가 점검은 렌더가 많아 브라우저가 history.replaceState를 잠시 막을 수 있으므로 location.hash 대신 적을 값을 본다
      const hashOf = () => { const o = { step: 1, tab: S.ui.tab }; S.g1Hash(o); return Object.keys(o).map((k) => k + '=' + o[k]).join('&'); };
      const I = (id) => indexOf(id);
      // 0. 주소에 표가 적혀 있으면 모든 표 보기(기존 주소 호환)
      ok('단계별: 주소 #step=1&tab=… 는 지금까지의 ① 전체 화면(모든 표 보기)', G.mode === 'all' && !!q('.band') && !!q('.pane.list') && !!q('.band [data-act="g1-steps"]'));
      ok('단계별: 순서 = 구단 정보 → 시즌 기본 설정 → 공휴일 → 휴식일 경기 → 휴식기 → 연전 기간 → 시리즈 → 특별 경기 → 다음', tasks().map((t) => t.id).join(',') === 'teams,season,holidays,restex,blackouts,slots,series,events,next');
      // 1. 처음 방문: 묻는 화면 — 두 선택만
      store.reset(); G.mode = undefined; G.i = 1; S.go({ step: 1 });
      ok('단계별: 처음 방문 → 「어떻게 시작할까요?」 두 선택(새로 입력 / 기존 데이터 보기), 그 밖의 것은 없음', G.mode === null && qa('.gs-pick').length === 2 && !!q('.gs-pick[data-v="new"]') && !!q('.gs-pick[data-v="view"]') && noExtras() && !q('.gs-card') && /g=ask/.test(hashOf()) && /어떻게 시작할지/.test(q('.step[data-step="1"] .step-sum').textContent), 'mode ' + G.mode + ' · picks ' + qa('.gs-pick').length + ' · extras ' + !noExtras() + ' · hash ' + hashOf() + ' · sum ' + q('.step[data-step="1"] .step-sum').textContent);
      // 2. 기존 데이터 보기 → 1 / 9 구단 정보 → 2 시즌 기본 설정(예시 데이터 값 그대로)
      click('.gs-pick[data-v="view"]'); flush();
      ok('단계별: 「기존 데이터를 볼게요」 → 1 / ' + N() + ' 구단 정보 · 10구단 · 들어 있는 것/바꾸려면 · 표 안내', G.mode === 'view' && G.i === 1 && !S.isBlank() && S.ui.tab === 'teams' && card0().getAttribute('data-page') === 'teams' && !!q('.gs-view') && !!q('.gs-edit') && /10구단/.test(card0().textContent) && /구장이 바뀌었는지/.test(document.body.textContent) && !!q('.gs-team') && /고치기 SSG/.test(card0().textContent) && noExtras() && /g=view&gs=1/.test(hashOf()), 'mode ' + G.mode + ' · i ' + G.i + ' · tab ' + S.ui.tab + ' · hash ' + hashOf());
      // 카드에서 바로 고르기: 첫 구단이 골라져 있고, 구단 단추 10개 · 표 줄에 「눌러서 고치기」(고른 줄은 「고치는 중」)
      const btns = () => qa('.gs-card .gs-pickteam .gs-tbtn');
      const pick0 = btns().length === 10 && btns()[0].classList.contains('on') && q('.pane.main tbody tr.sel') === qa('.pane.main tbody tr')[0] && qa('.pane.main .tm-edit-hint').length === 10 && /왼쪽 카드에서 고치는 중/.test(q('.pane.main tbody tr.sel .tm-edit-hint').textContent) && /눌러서 고치기/.test(qa('.pane.main .tm-edit-hint')[1].textContent) && q('#teamMapHost .kmap-active').getAttribute('data-id') === '0';
      click('.gs-card .gs-pickteam .gs-tbtn[data-row="3"]'); flush();
      const pick3 = /고치기 KT/.test(card0().textContent) && btns()[3].classList.contains('on') && q('.pane.main tbody tr.sel') === qa('.pane.main tbody tr')[3];
      click('.pane.main tbody tr[data-row="5"] td.rn'); flush();
      const rowPick = /고치기 한화/.test(card0().textContent);
      ok('단계별: 구단 정보 — 첫 구단이 골라진 채 시작 · 카드의 구단 단추 10개로 바꿈 · 표 줄(번호 칸 포함) 눌러도 바뀜 · 줄에 「눌러서 고치기」', pick0 && pick3 && rowPick, 'pick0 ' + pick0 + ' · pick3 ' + pick3 + ' · row ' + rowPick);
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true })); flush();
      const altOk = G.i === I('season');
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true })); flush();
      ok('단계별: 구단이 골라져 있어도 Alt+→ / Alt+← 로 단계 이동', altOk && G.i === 1, 'i ' + G.i);
      click('.footer [data-act="g1-next"]'); flush();
      ok('단계별: 다음 → 2 시즌 기본 설정 · 2025 값 그대로 · 요약 상자 없음 · 「다음: 공휴일」', G.i === I('season') && S.ui.tab === 'season' && /개막 3\/22\(토\)/.test(card0().textContent) && q('.form-grid input[data-k="seasonStart"]').value === fmt.date('2025-03-22') && !q('.season-subs') && !q('.gs-card .gs-acts') && qa('.gs-steps li').length === N() && /다음: 공휴일/.test(q('.footer .btn.primary').textContent) && /2 \/ 9/.test(q('.gs-pos').textContent));
      const order = [];
      for (let k = I('season'); k < N(); k++) { click('.footer [data-act="g1-next"]'); flush(); order.push(S.ui.tab); }
      ok('단계별: 「다음」으로 공휴일·휴식일 경기·휴식기·연전 기간·시리즈·특별 경기·정리 순서', order.join(',') === 'holidays,restex,blackouts,slots,series,events,events' && G.i === N() && !!q('.gs-sum') && qa('.gs-sum tbody tr').length === N() - 1 && /다음: 검토·실행/.test(q('.footer .btn.primary').textContent), order.join(','));
      ok('단계별: 보기 모드 정리 표 — 모두 「문제 없음」, 첫 줄이 구단 정보', qa('.gs-sum tbody tr .st.ok').length === N() - 1 && /구단 정보/.test(q('.gs-sum tbody tr').textContent));
      // 3. 모든 표 보기 ↔ 단계별로 보기(기억한 단계)
      click('.gs-strip [data-act="g1-all"]'); flush();
      ok('단계별: 「모든 표 보기」 → 띠·목록·자세히가 있는 전체 화면, 표는 특별 경기', G.mode === 'all' && !!q('.band') && !!q('.pane.list') && S.ui.tab === 'events' && !q('.gs-card') && /tab=events/.test(hashOf()) && !/g=/.test(hashOf()), 'mode ' + G.mode + ' · tab ' + S.ui.tab + ' · hash ' + hashOf());
      click('.band [data-act="g1-steps"]'); flush();
      ok('단계별: 띠 「단계별로 보기」 → 기억한 단계(' + N() + ' / ' + N() + ')로', G.mode === 'view' && G.i === N() && !!q('.gs-sum'));
      // 4. 처음 질문으로 → 새로 입력 → 표 비움(확인 창 없이, 실행 취소 가능) → 1 구단 정보
      click('.gs-strip [data-act="g1-ask"]'); flush();
      ok('단계별: 「처음 질문으로」 → 두 선택 + 「이어서 할게요」', G.mode === null && qa('.gs-pick').length === 2 && !!q('[data-act="g1-resume"]') && /이어서/.test(q('[data-act="g1-resume"]').textContent));
      click('.gs-pick[data-v="new"]'); flush();
      ok('단계별: 「데이터를 새로 입력할게요」 → 확인 창 없이 표를 비우고 1 / ' + N() + ' 구단 정보(남아 있음) · 비웠다는 안내 · 어떻게', G.mode === 'new' && G.i === 1 && S.isBlank() && !S.ui.modal && S.ui.tab === 'teams' && st().teams.length === 10 && /비웠습니다/.test(card0().textContent) && !!q('.gs-how') && noExtras());
      app().undo(); flush();
      const undone = !S.isBlank() && st().calendar.length === 45 && G.mode === 'new';
      app().redo(); flush();
      ok('단계별: 새로 입력의 비움은 실행 취소·다시 실행이 됨', undone && S.isBlank());
      // 구단 고치기: 표에서 구단을 누르면 카드에 칸 4개, 구장·위도를 바꾸면 거리가 추정값으로
      const li = st().teams.findIndex((t) => t.name === 'LG');
      click('.pane.main [data-act="team-sel"][data-row="' + li + '"]'); flush();
      ok('단계별: 표에서 LG를 누르면 카드에 구단명·구장 칸(고칠 수 있음) · 위도·경도(읽기만) · 거리 칸 9개', qa('.gs-card .gs-team input[data-in="team-field"]').length === 2 && qa('.gs-card .gs-team input[data-ro][readonly]').length === 2 && !q('.gs-card input[data-k="latitude"]') && qa('.gs-card .gs-dist input[data-in="team-dist"]').length === 9);
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
      ok('단계별: 구장 이름만 바꾸면 거리 그대로 · 거리 칸 LG→KT 31.5 → 양쪽 방향 · 잘못된 값 거부 · 실행 취소로 복귀', renamed && kmSet && kmRejected && app().distanceOf('LG', 'KT').distance === ktKm0 && app().distanceOf('KT', 'LG').distance === ktKm0 && st().teams[li].stadium !== '고척스카이돔(임시)', 'renamed ' + renamed + ' · kmSet ' + kmSet + ' · rejected ' + kmRejected);
      // 구장 지도: 키가 없으면 내장 지도(구장 10개, 고른 구단 강조) + 설정 안내 한 줄, 지도에서 구단을 눌러 고르기
      const mk = () => qa('#teamMapHost .tm-map svg.kmap .kmap-marker');
      ok('단계별: 구장 지도 — 키 없음 → 내장 지도 · 표시 10개 · 고른 LG 강조 · 「설정 › 카카오 지도 키」 안내 · 개발 글줄 없음', mk().length === 10 && qa('#teamMapHost .kmap-active').length === 1 && q('#teamMapHost .kmap-active').getAttribute('data-id') === String(li) && /설정 › 카카오 지도 키를 넣으면 카카오 지도로 보입니다/.test(q('.tm-foot').textContent) && !!q('.tm-foot [data-act="open-settings"]') && !q('#teamMapHost .k-map-caption') && q('.tm-mapblk').getBoundingClientRect().width >= q('.tm-left').getBoundingClientRect().width * 0.5, 'markers ' + mk().length + ' · map ' + Math.round(q('.tm-mapblk').getBoundingClientRect().width) + ' · table ' + Math.round(q('.tm-left').getBoundingClientRect().width));
      const ki = st().teams.findIndex((t) => t.name === 'KIA');
      q('#teamMapHost .kmap-marker[data-id="' + ki + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); flush();
      const mapPick = S.ui.cell && S.ui.cell.row === ki && /고치기 KIA/.test(card0().textContent) && q('#teamMapHost .kmap-active').getAttribute('data-id') === String(ki);
      click('.pane.main [data-act="team-sel"][data-row="' + li + '"]'); flush();
      ok('단계별: 지도에서 KIA 표시를 누르면 카드가 KIA로 · 다시 표에서 LG', mapPick && /고치기 LG/.test(card0().textContent));
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
      ok('단계별: 구장 칸에 「고척」 + Enter(한글 조합 중 Enter는 건너뜀) → 고척돔야구장 위도·경도를 채움 · 이름은 적은 그대로 · LG 거리 18개 추정 · 실행 취소 한 번으로 복귀', imeSkip && oneUndo && one && back() && !q('.gs-card .gs-find.ok'), 'ime ' + imeSkip + ' · oneUndo ' + oneUndo + ' · one ' + one + ' · back ' + back());
      await findT('대전');
      const many = qa('.gs-card .gs-cand').length === 2 && st().teams[li].stadium === lg0.stadium && q('.gs-card input[data-k="stadium"]').value === '대전';
      click('.gs-card .gs-cand[data-k="1"]'); flush();
      const picked = st().teams[li].stadium === '대전' && st().teams[li].latitude === 36.3166 && !q('.gs-card .gs-cand') && /대전한화생명볼파크/.test(q('.gs-card .gs-find.ok').textContent);
      app().undo(); flush();
      ok('단계별: 「대전」 + Enter → 결과 2곳을 카드에 · 고르면 채움 · 실행 취소 한 번으로 복귀', many && picked && back(), 'many ' + many + ' · picked ' + picked + ' · back ' + back());
      await findT('마산');
      const onMap = qa('#teamMapHost .kmap-marker[data-id^="c"]').length === 2 && /파란 번호 표시/.test(q('.tm-foot').textContent) && /1창원NC파크/.test(q('.gs-card .gs-cand').textContent.replace(/\s+/g, '')) && !q('.gs-card [data-act="g1-map-pick"]');
      q('#teamMapHost .kmap-marker[data-id="c0"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); flush();
      const mapPicked = st().teams[li].stadium === '마산' && st().teams[li].latitude === 35.222564 && !q('#teamMapHost .kmap-marker[data-id^="c"]') && /창원NC파크/.test(q('.gs-card .gs-find.ok').textContent);
      app().undo(); flush();
      ok('단계별: 「마산」 + Enter → 결과 2곳이 지도에도 파란 번호로 · 지도의 1번을 누르면 채움 · 키가 없으면 「지도에서 찍기」 없음 · 실행 취소로 복귀', onMap && mapPicked && back(), 'onMap ' + onMap + ' · mapPicked ' + mapPicked + ' · back ' + back());
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
      ok('단계별: 도로거리 받기(서버 중계 흉내) → 8쌍 양쪽 방향 「도로」 · 못 받은 1쌍은 그대로 · 실행 취소 한 번으로 복귀 · 서버가 없으면 단추 없음', roadUi && roadOk && !st().distanceMatrix.some((d) => d.source === 'ROAD') && back() && !q('.gs-card [data-act="g1-road"]'), 'ui ' + roadUi + ' · ok ' + rr.ok + ' · failed ' + rr.failed + ' · pairs ' + roadPairs.length + ' · calls ' + calls);
      const topN = us()[us().length - 1];
      await findT('없는구장이름');
      const none = !!q('.gs-card .gs-find.warn') && /찾지 못했습니다 — 다른 이름으로 다시 찾아 주세요/.test(q('.gs-card .gs-find.warn').textContent) && st().teams[li].stadium === lg0.stadium && q('.gs-card input[data-k="stadium"]').value === '없는구장이름' && us()[us().length - 1] === topN;
      ok('단계별: 없는 이름 + Enter → 「찾지 못했습니다 — 다른 이름으로 다시 찾아 주세요」 · 아무것도 바꾸지 않음(실행 취소 항목 없음)', none && back(), 'none ' + none + ' · back ' + back());
      S.ui.teamFind = null;
      click('.footer [data-act="g1-next"]'); flush();
      ok('단계별: 다음 → 2 시즌 기본 설정 · 날짜 칸 3개 비어 있음 · 「아직」', G.i === I('season') && S.ui.tab === 'season' && card0().getAttribute('data-status') === 'todo' && qa('.form-grid input[data-k]').length === 3 && Array.from(qa('.form-grid input[data-k]')).every((i) => i.value === '') && !!q('.gs-how'));
      const put = (k, v) => { const i = q('.form-grid input[data-k="' + k + '"]'); i.value = v; i.dispatchEvent(new Event('change', { bubbles: true })); flush(); };
      put('seasonStart', '2025-03-22'); put('initialEnd', '8/31'); put('seasonEnd', '2025-10-31');
      ok('단계별: 날짜 3개 입력 → 카드에 경기일 합 140 / 135 「5일 많음」', st().settings.initialEnd === '2025-08-31' && /140일 \/ 필요 135일/.test(card0().textContent) && /5일 많음/.test(card0().textContent) && card0().getAttribute('data-status') === 'warn');
      click('.footer [data-act="g1-next"]'); flush();
      ok('단계별: 다음 → 3 공휴일 · 빈 표 · 카드에 「법정 공휴일 채우기」만', G.i === I('holidays') && S.ui.tab === 'holidays' && !!q('.sheet-empty') && qa('.gs-card .gs-acts .btn').length === 1 && !!q('.gs-card .gs-acts [data-act="fill-holidays"]') && !q('.toolbar [data-act="fill-holidays"]'));
      click('.gs-card .gs-acts [data-act="fill-holidays"]'); flush();
      ok('단계별: 법정 공휴일 채우기 → 10일 · 같은 단계 · 「됨」', st().settings.holidays.length === 10 && G.i === I('holidays') && card0().getAttribute('data-status') === 'ok');
      click('.footer [data-act="g1-next"]'); flush();
      ok('단계별: 4 휴식일 경기 — 표 하나·첫 줄 추가', G.i === I('restex') && S.ui.tab === 'restex' && !!q('.sheet-empty [data-act="row-ins"]') && !q('.gs-card .gs-acts'));
      click('.sheet-empty [data-act="row-ins"]'); flush(); enter('restex', 0, 'date', '5/5');
      click('.footer [data-act="g1-next"]'); flush();
      ok('단계별: 5 휴식기 — 경기일 합 안내(6일 많음 → 휴식기로 빼기)', G.i === I('blackouts') && S.ui.tab === 'blackouts' && /휴식기로 6일을 빼세요/.test(card0().textContent), card0().textContent.slice(0, 160));
      click('.sheet-empty [data-act="row-ins"]'); flush(); enter('blackouts', 0, 'start', '5/8'); enter('blackouts', 0, 'end', '5/8'); enter('blackouts', 0, 'name', '어린이날 3연전 뒤 휴식');
      S.ui.cell = null; flush(); click('.toolbar [data-act="row-ins"][data-pos="below"]'); flush(); enter('blackouts', 1, 'start', '7/11'); enter('blackouts', 1, 'end', '7/16'); enter('blackouts', 1, 'name', '올스타 브레이크');
      ok('단계별: 휴식기 2개 → 경기일 합 135 / 135 맞음 · 「됨」', st().settings.blackouts.length === 2 && /135일 \/ 필요 135일/.test(card0().textContent) && card0().getAttribute('data-status') === 'ok');
      click('.footer [data-act="g1-next"]'); flush();
      ok('단계별: 6 연전 기간 · 「아직」 · 카드의 「규칙대로 자동 채우기」', G.i === I('slots') && S.ui.tab === 'slots' && card0().getAttribute('data-status') === 'todo' && !!q('.gs-card .gs-acts [data-act="draft-slots"]'));
      click('.gs-card .gs-acts [data-act="draft-slots"]'); flush();
      const previewOpen = S.ui.modal === 'import' && S.ui.imp && S.ui.imp.kind === 'draft-slots';
      click('.modal [data-act="imp-apply"]'); flush();
      ok('단계별: 자동 채우기 → 미리보기 → 적용 → 45개 · 같은 단계 「됨」 · 연전 수 「여유」 안내', previewOpen && !S.ui.modal && st().calendar.length === 45 && G.i === I('slots') && card0().getAttribute('data-status') === 'ok' && /여유/.test(card0().textContent));
      click('.footer [data-act="g1-next"]'); flush();
      click('.gs-card .gs-acts [data-act="draft-series"]'); flush();
      click('.modal [data-act="imp-apply"]'); flush();
      ok('단계별: 7 시리즈 → 자동 채우기 → 225개 · 맞대결 경기 수·연전 수 모두 「맞음」', G.i === I('series') && st().matches.length === 225 && card0().getAttribute('data-status') === 'ok' && (card0().textContent.match(/맞음/g) || []).length >= 4);
      click('.footer [data-act="g1-next"]'); flush();
      click('.gs-card .gs-acts [data-act="add-opening"]'); flush();
      click('.gs-card .gs-acts [data-act="add-children"]'); flush();
      ok('단계별: 8 특별 경기 → 개막전 5·어린이날 1 · 「됨」', G.i === I('events') && S.ui.tab === 'events' && st().events.length === 6 && card0().getAttribute('data-status') === 'ok');
      click('.footer [data-act="g1-next"]'); flush();
      ok('단계별: 9 정리 — 8단계 모두 「문제 없음」 · 「다음: 검토·실행」 · 사전 점검 진행 불가 0', G.i === N() && qa('.gs-sum tbody tr .st.ok').length === N() - 1 && !!q('.gs-next-foot [data-act="go-step"][data-step="2"]') && app().preflight().counts.block === 0);
      // 모든 단계가 화면 안 · 페이지 스크롤 0 (새로 입력·기존 보기 둘 다, 구단 고른 채로도)
      const bad = [];
      for (const m of ['new', 'view']) for (let k = 1; k <= N(); k++) {
        G.mode = m; show(k);
        if (k === 1) { S.ui.cell = { sheet: 'teams', row: 0, col: 'name' }; flush(); }
        const c = card0(), r = c && c.getBoundingClientRect(), sc = S.checkScroll();
        if (!r || r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight || !sc.ok || !noExtras() || !q('.pane.main') || qa('.gs-steps li.on').length !== 1) bad.push(m + k + (sc.ok ? '' : ':scroll'));
      }
      ok('단계별: ' + N() * 2 + '화면 모두 카드·표만 · 페이지 스크롤 0', !bad.length, bad.join(','));
      G.mode = 'new'; show(N());
      click('.footer [data-act="go-step"][data-step="2"]'); flush();
      ok('단계별: 「다음: 검토·실행」 → ② · 사전 점검 통과', S.ui.step === 2 && app().preflight().counts.block === 0);
      // 5. ②에서 ①로 돌아오면 하던 단계 그대로 · 사전 점검 링크는 그 표의 단계로
      click('.step[data-step="1"]'); flush();
      ok('단계별: ①로 돌아오면 하던 단계(' + N() + ' / ' + N() + ') 그대로', G.mode === 'new' && G.i === N() && !!q('.gs-sum'));
      S.navTarget('slots'); flush();
      ok('단계별: 사전 점검 「입력 위치로」 → 그 표의 단계(6 연전 기간)', G.mode === 'new' && G.i === I('slots') && S.ui.tab === 'slots' && !!card0());
      // 6. 안내 끄기 → 모든 표 보기 · 저장 · 띠 「단계별 안내 켜기」 · 처음 방문처럼 열어도 묻지 않음
      click('.gs-strip [data-act="g1-off"]'); flush();
      let savedOff = null; try { savedOff = JSON.parse(localStorage.getItem(S.KEY + 'guide-steps')).off; } catch (e) { savedOff = null; }
      ok('단계별: 「안내 끄기」 → 모든 표 보기 · 저장 · 띠 「단계별 안내 켜기」', G.mode === 'all' && savedOff === true && !!q('.band [data-act="g1-on"]'));
      G.mode = undefined; S.go({ step: 1 });
      ok('단계별: 안내를 꺼 두면 ①에 들어와도 묻지 않음', G.mode === 'all' && !!q('.band'));
      click('.band [data-act="g1-on"]'); flush();
      ok('단계별: 「단계별 안내 켜기」 → 다시 묻는 화면', G.mode === null && qa('.gs-pick').length === 2);
      // 7. 빈 상태의 묻는 화면: 둘째 선택은 「2025 예시 데이터를 볼게요」 → 불러와서 보기 1단계
      ok('단계별: 빈 상태에서는 「2025 예시 데이터를 볼게요」', /2025 예시 데이터/.test(q('.gs-pick[data-v="view"]').textContent) && /비어 있고/.test(q('.gs-ask-now').textContent));
      click('.gs-pick[data-v="view"]'); flush();
      ok('단계별: → 2025 예시 데이터를 불러와 기존 데이터 보기 1단계', G.mode === 'view' && G.i === 1 && !S.isBlank() && st().calendar.length === 45);
      // 8. 주소 g=new&gs=3 · guide=1(예전 키) → 묻는 화면 · tab= → 모든 표 보기
      S.g1Route({ g: 'new', gs: '3' }); S.render();
      ok('단계별: 주소 g=new&gs=3 → 새로 입력 3 / ' + N() + ' 공휴일', G.mode === 'new' && G.i === 3 && S.ui.tab === 'holidays');
      S.g1Route({ guide: '1' }); S.render();
      ok('단계별: 예전 주소 guide=1 → 묻는 화면', G.mode === null && qa('.gs-pick').length === 2);
      S.g1Route({ tab: 'series', step: '1' }); S.ui.tab = 'series'; S.render();
      ok('단계별: 주소 tab=series → 모든 표 보기의 시리즈 표', G.mode === 'all' && S.ui.tab === 'series' && !!q('.band'));
      G.justReset = false; store.reset(); G.mode = 'all'; S.go({ step: 1, tab: 'slots' });
    }
  };

  Object.assign(S.actions, {
    'g1-pick': (el) => {
      if (S.run && (S.run.status === 'RUNNING' || S.run.status === 'PAUSED')) { S.toast('자동 편성 중에는 데이터를 바꿀 수 없습니다. 먼저 중지하세요.', 'warn'); return; }
      const v = el.dataset.v;
      if (v === 'new') {
        setMode('new', 1); G.justReset = false;
        if (!blank()) { G.justReset = true; S.resetAll({ quiet: true }); S.toast('표를 모두 비웠습니다. 시즌 기본 설정부터 차례로 적어 주세요. 실행 취소로 되돌릴 수 있습니다.', 'ok', 6000); }
        show(1);
      } else {
        if (blank()) S.loadExample({ quiet: true, stay: true });
        setMode('view', 1); G.justReset = false; show(1);
      }
    },
    'g1-resume': () => { const s = store.get(); setMode(s.mode === 'view' ? 'view' : 'new', s.at || 1); G.justReset = false; show(G.i); },
    'g1-all': () => { setMode('all'); const tab = S.SHEETS[S.ui.tab] || S.ui.tab === 'season' || S.ui.tab === 'teams' ? S.ui.tab : 'slots'; S.go({ step: 1, ops: null, tab, modal: null, drawer: null }); },
    'g1-steps': () => { const s = store.get(); if ((s.mode === 'new' || s.mode === 'view') && s.at > 0) { setMode(s.mode, s.at); show(G.i); } else { G.mode = null; S.go({ step: 1, ops: null, modal: null, drawer: null }); } },
    'g1-ask': () => { G.mode = null; G.justReset = false; S.go({ step: 1, ops: null, modal: null, drawer: null, cell: null, edit: null }); },
    'g1-find-pick': (el) => { if (S.locked()) return; pickStadium(+el.dataset.row, +el.dataset.k); S.render(); },
    'g1-road': (el) => { if (S.locked()) return; app().fetchRoadDistances([el.dataset.name]).then(S.roadToast); },
    'g1-find-close': () => { S.ui.teamFind = null; S.render(); },
    'g1-map-pick': (el) => { if (S.locked()) return; S.ui.mapPick = { row: +el.dataset.row }; S.ui.teamFind = null; S.render(); },
    'g1-map-pick-off': () => { S.ui.mapPick = null; S.render(); },
    'g1-go': (el) => { G.justReset = false; show(+el.dataset.i); },
    'g1-next': () => { G.justReset = false; if (G.i < N()) show(G.i + 1); else S.go({ step: 2, ops: null, sel: null, edit: null }); },
    'g1-off': () => { store.set({ off: true, seen: true }); setMode('all'); S.go({ step: 1, ops: null, tab: S.ui.tab && S.ui.tab !== 'next' ? S.ui.tab : 'slots' }); S.toast('단계별 안내를 껐습니다. ①에 들어오면 바로 모든 표가 보입니다. 띠의 「단계별 안내 켜기」로 다시 켭니다.', 'info', 6000); },
    'g1-on': () => { store.set({ off: false }); G.mode = null; S.go({ step: 1, ops: null }); }
  });
})();
