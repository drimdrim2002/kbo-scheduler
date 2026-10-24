/*
 * 보여주는 문(ui/show/) 공통 스크립트. 소개·비교·결과 3쪽이 이 파일 하나를 쓰고 body[data-page]로 갈린다.
 * 데이터 경로는 SHOW.api 한 곳에만 둔다: http(s)면 서버 API('/api/v1/compare', '/api/v1/results/' + id), file://면 fixtures/.
 * 외부 라이브러리·빌드 없음. file://로 열어도 되도록 JSON은 XMLHttpRequest로 읽는다(fetch는 file 스킴을 거부한다).
 * 화면 글자는 일반 용어만 쓴다(필수 규칙·공정성, 점수 원문 없음).
 */
(function () {
  'use strict';
  const SHOW = window.SHOW = window.SHOW || {};

  // ───────── 데이터 경로 (한 곳) ─────────
  // http(s)로 열면 서버 API, 서버 없이 file://로 열면 같은 모양의 고정 JSON(fixtures/)로 떨어진다.
  const isFile = location.protocol === 'file:';
  SHOW.api = isFile ? {
    compare: 'fixtures/compare.json',
    result: (id) => 'fixtures/result-' + id + '.json'
  } : {
    compare: '/api/v1/compare',
    result: (id) => '/api/v1/results/' + encodeURIComponent(id)
  };
  SHOW.replayScripts = ['../core/replay-model.js?v=20261024p', '../app/replay/replay.js?v=20261024p']; // ?v=: 캐시 버스터. 2026-10-24부터 서버 ETag·304 + Cloudflare가 no-cache를 전달하므로 필수는 아니지만, 옛 캐시가 남은 브라우저를 위해 큰 변경 때는 올린다
  SHOW.studioHref = { file: '../index.html', http: '/studio/' }; // 위저드 주소 (D7: 서버에서는 /studio/)
  SHOW.PREVIEW_MS = 15000;      // 소개 쪽 미리보기 재생 시간
  // 「편성 시작」 생각 시간 3단계. wait = 누르고 결과가 나오기까지 실측(정한 시간 + 첫 일정 만들기·정리 3.5~4.5초, docs/STATUS.md)
  SHOW.THINK = { 3: { word: '빠르게', wait: 7 }, 10: { word: '보통', wait: 15 }, 30: { word: '꼼꼼하게', wait: 35 } };
  SHOW.THINK_DEFAULT = 10;
  SHOW.SEOUL_BUSAN_KM = 400;   // '서울–부산 N번 거리' 비유에 쓰는 어림값(도로 기준 약 400km)
  SHOW.REAL_KM = 72955;         // 실제 2025 1차 일정 총 이동거리. 소개 쪽은 비교 API 값으로 덮어쓴다
  SHOW.TEAMS = ['SSG', '두산', 'LG', 'KT', '키움', '한화', '삼성', 'KIA', 'NC', '롯데'];
  SHOW.SITE = '매치봇'; // 솔루션 이름(2026-10-23 브랜드). 사이트 설명은 상단 띠의 'KBO 일정 플레이그라운드'
  // 구장 좌표(data/baseball/input_2025.json teams). 롯데 원정길 카카오맵에 쓴다
  SHOW.STADIUMS = { SSG: [37.4351, 126.6909, '인천'], 두산: [37.5122, 127.072, '잠실'], LG: [37.5122, 127.072, '잠실'], KT: [37.2998, 127.0097, '수원'], 키움: [37.4983, 126.8671, '고척'], 한화: [36.3172, 127.4292, '대전'], 삼성: [35.8413, 128.6811, '대구'], KIA: [35.1681, 126.8891, '광주'], NC: [35.2226, 128.5823, '창원'], 롯데: [35.1941, 129.0616, '사직'] };
  // 롯데 8/1~8/15 동선(정적; 실제 일정 input_2025.json, 매치봇 기본 결과 result-default.json에서 확인). [출발, 도착, km]
  SHOW.LOTTE_AUG = {
    real: [['롯데', '키움', 407], ['키움', '롯데', 407], ['롯데', '한화', 262], ['한화', '롯데', 262]],
    engine: [['NC', '롯데', 57], ['롯데', 'KIA', 255], ['KIA', '롯데', 255]]
  };

  // ───────── 도우미 ─────────
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtInt = (n) => {
    if (n == null || isNaN(n)) return '–';
    const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '−' : '') + s;
  };
  const query = new URLSearchParams(location.search);
  const html = document.documentElement;
  const mark = (k, v) => html.setAttribute('data-' + k, String(v));

  /** JSON 읽기. file://에서도 되도록 XHR. */
  function load(url, cb) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = () => {
        if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) { cb('HTTP ' + xhr.status); return; }
        try { cb(null, JSON.parse(xhr.responseText)); } catch (e) { cb('JSON 해석 실패: ' + e.message); }
      };
      xhr.onerror = () => cb('읽기 실패 (' + url + ')');
      xhr.send();
    } catch (e) { cb(e.message); }
  }

  /** data-n="키" 요소에 값을 넣는다. HTML에 박힌 기본 숫자를 fetch 뒤에 덮어쓰는 용도. */
  function bind(map) {
    $$('[data-n]').forEach((el) => {
      const k = el.getAttribute('data-n');
      if (map[k] != null) el.textContent = map[k];
    });
  }

  function range(teams, key, fmt) {
    if (!teams || !teams.length) return null;
    const vals = teams.map((t) => t[key]).filter((v) => v != null);
    if (!vals.length) return null;
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const f = fmt || ((v) => String(v));
    return lo === hi ? f(lo) : f(lo) + '~' + f(hi);
  }
  /** 조사 고르기: 이름 끝 글자에 받침이 있으면 withB, 없으면 noB. 영문 구단명(SSG·LG·KT·KIA·NC)은 읽을 때 모두 받침 없이 끝난다(지·지·티·에이·씨) */
  const josa = (name, withB, noB) => { const c = String(name).charCodeAt(String(name).length - 1) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0 ? withB : noB; };
  const findTeam = (teams, name) => (teams || []).find((t) => t.name === name);
  const spread = (teams, key) => { const xs = teams.map((t) => t[key]).filter((x) => typeof x === 'number'); return xs.length ? Math.max(...xs) - Math.min(...xs) : null; };

  /** 실제·매치봇 지표(같은 모양)에서 화면에 쓰는 문자열 묶음을 만든다. */
  function view(real, engine, extra) {
    const o = extra || {};
    const v = {};
    const rt = real.teams || [], et = engine.teams || [];
    v['real.totalKm'] = fmtInt(real.totalKm); v['engine.totalKm'] = fmtInt(engine.totalKm);
    const pct = real.totalKm ? Math.round((1 - engine.totalKm / real.totalKm) * 100) : null;
    v['diff.totalKmPct'] = pct == null ? '–' : String(Math.abs(pct));
    v['diff.totalKmWord'] = pct == null ? '' : (pct >= 0 ? '적음' : '많음');
    v['real.spreadKm'] = fmtInt(real.spreadKm); v['engine.spreadKm'] = fmtInt(engine.spreadKm);
    const ratio = real.spreadKm ? engine.spreadKm / real.spreadKm : null;
    v['diff.spreadText'] = ratio == null ? '–' : (ratio < 1 ? Math.round((1 - ratio) * 100) + '% 적음' : Math.round((ratio - 1) * 100) + '% 많음');
    v['diff.spreadRatio'] = ratio == null ? '–' : ratio.toFixed(2);
    v['real.maxTeam'] = real.maxTeam || ''; v['real.minTeam'] = real.minTeam || '';
    v['engine.maxTeam'] = engine.maxTeam || ''; v['engine.minTeam'] = engine.minTeam || '';
    const rmax = findTeam(rt, real.maxTeam), rmin = findTeam(rt, real.minTeam), emax = findTeam(et, engine.maxTeam), emin = findTeam(et, engine.minTeam);
    if (rmax) v['real.maxKm'] = fmtInt(rmax.distanceKm); if (rmin) v['real.minKm'] = fmtInt(rmin.distanceKm);
    if (emax) v['engine.maxKm'] = fmtInt(emax.distanceKm); if (emin) v['engine.minKm'] = fmtInt(emin.distanceKm);
    const r1 = (teams, key) => range(teams, key);
    const put = (k, val) => { if (val != null) v[k] = val; };
    put('real.moves', r1(rt, 'moves')); put('engine.moves', r1(et, 'moves'));
    put('real.holiday', r1(rt, 'holidayWeight')); put('engine.holiday', r1(et, 'holidayWeight'));
    put('real.weekend', rt.length ? r1(rt, 'weekendHome') : (real.weekendHomeMin != null ? real.weekendHomeMin + '~' + real.weekendHomeMax : null));
    put('engine.weekend', et.length ? r1(et, 'weekendHome') : (engine.weekendHomeMin != null ? engine.weekendHomeMin + '~' + engine.weekendHomeMax : null));
    put('real.awayRun', r1(rt, 'maxAwayRun')); put('engine.awayRun', r1(et, 'maxAwayRun'));
    // 메시지 한 줄 + 아래 숫자: 통계 용어 대신 뜻을 말한다
    const kmRange = (teams) => { const xs = teams.map((t) => t.distanceKm).filter((x) => typeof x === 'number'); return xs.length ? fmtInt(Math.min(...xs)) + '~' + fmtInt(Math.max(...xs)) : null; };
    put('real.rangeKm', kmRange(rt)); put('engine.rangeKm', kmRange(et));
    const meanOf = (teams) => { const xs = teams.map((t) => t.distanceKm).filter((x) => typeof x === 'number'); return xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : null; };
    const rm = real.meanDistanceKm != null ? real.meanDistanceKm : meanOf(rt);
    if (rm != null) { v['real.meanKm'] = fmtInt(rm); v['real.meanTrips'] = String(Math.round(rm / SHOW.SEOUL_BUSAN_KM)); }
    v['msg.total'] = pct == null ? '이동거리를 비교해요' : pct > 0 ? '이동거리를 ' + pct + '% 줄였어요' : pct === 0 ? '이동거리는 같아요' : '이동거리가 ' + (-pct) + '% 늘었어요';
    v['msg.fair'] = ratio == null ? '구단별 이동거리를 비교해요' : ratio < 0.6 ? '구단별 이동거리 차이가 훨씬 줄었어요' : ratio < 0.9 ? '구단별 이동거리 차이가 줄었어요' : ratio <= 1.1 ? '구단별 이동거리 차이는 비슷해요' : '구단별 이동거리 차이는 실제가 더 작아요';
    v['diff.spreadTag'] = ratio == null ? '' : ratio < 0.6 ? '훨씬 공정' : ratio < 0.9 ? '더 공정' : ratio <= 1.1 ? '비슷' : '실제가 공정';
    const hs = (teams) => spread(teams, 'holidayWeight');
    const rh = rt.length ? hs(rt) : null, eh = et.length ? hs(et) : null;
    if (eh != null) v['engine.holidayText'] = eh === 0 ? '모두 ' + et[0].holidayWeight : r1(et, 'holidayWeight');
    if (rh != null) v['real.holidayText'] = rh === 0 ? '모두 ' + rt[0].holidayWeight : r1(rt, 'holidayWeight');
    if (rh != null && eh != null) {
      v['msg.weekend'] = eh === 0 ? '주말·공휴일 홈 경기를 똑같이 나눴어요' : eh < rh ? '주말·공휴일 홈 경기를 더 고르게 나눴어요' : eh === rh ? '주말·공휴일 홈 경기는 실제처럼 나눴어요' : '주말·공휴일 홈 경기는 실제가 더 고르게 나눴어요';
      v['diff.holidayTag'] = eh === 0 ? '똑같이' : eh < rh ? '더 고름' : eh === rh ? '비슷' : '실제가 고름';
    }
    // 주말 홈 시리즈 수: 편차(최대−최소)로 어느 쪽이 더 고른지 판정한다. 같으면 "같은 수준"
    const rw = real.weekendHomeMin != null ? real.weekendHomeMax - real.weekendHomeMin : (rt.length ? spread(rt, 'weekendHome') : null);
    const ew = engine.weekendHomeMin != null ? engine.weekendHomeMax - engine.weekendHomeMin : (et.length ? spread(et, 'weekendHome') : null);
    if (rw != null && ew != null) {
      v['diff.weekendCmp'] = ew > rw ? 'real' : (ew < rw ? 'engine' : 'even');
      v['diff.weekendWord'] = ew > rw ? '실제 일정이 더 고릅니다' : (ew < rw ? '매치봇이 더 고릅니다' : '같은 수준입니다');
      v['diff.weekendTag'] = ew > rw ? '실제가 더 고름' : (ew < rw ? '매치봇이 고름' : '같음');
    }
    const sec = o.seconds != null ? o.seconds : (engine.options && engine.options.timeLimitSec) || (engine.elapsedMs ? Math.round(engine.elapsedMs / 1000) : null);
    if (sec != null) v['engine.seconds'] = String(sec);
    if (engine.seed != null) v['engine.seed'] = String(engine.seed);
    if (engine.options && engine.options.seeds != null) v['engine.seeds'] = String(engine.options.seeds);
    if (engine.improvementCount != null) v['engine.improvements'] = fmtInt(engine.improvementCount);
    v.pct = pct; v.ratio = ratio;
    return v;
  }

  // ───────── 막대 ─────────
  /** 총 이동거리 가로 막대 2개 */
  function totalBars(el, real, engine) {
    const max = Math.max(real.totalKm, engine.totalKm) || 1;
    const row = (name, val, cls) => '<div class="sh-bar-row"><span class="sh-bar-name">' + name + '</span><div class="sh-bar-track"><div class="sh-bar ' + cls + '" style="width:' + (val / max * 100).toFixed(1) + '%"></div></div><span class="sh-bar-val">' + fmtInt(val) + '<small> km</small></span></div>';
    el.innerHTML = row('KBO', real.totalKm, 'sh-bar-real') + row('매치봇', engine.totalKm, 'sh-bar-engine');
    el.setAttribute('aria-label', '10구단 총 이동거리: KBO ' + fmtInt(real.totalKm) + 'km, 매치봇 ' + fmtInt(engine.totalKm) + 'km');
  }
  /** 구단별 작은 막대(실제·매치봇 2줄 × 10구단) */
  function teamBars(el, realTeams, engineTeams, key, opts) {
    const o = Object.assign({ unit: '', fmt: fmtInt, max: null }, opts || {});
    const names = SHOW.TEAMS.filter((n) => findTeam(engineTeams, n) || findTeam(realTeams, n));
    const all = [];
    names.forEach((n) => { const a = findTeam(realTeams, n), b = findTeam(engineTeams, n); if (a) all.push(a[key]); if (b) all.push(b[key]); });
    const max = o.max || Math.max(...all) || 1;
    const bar = (t, cls) => '<div class="sh-bar ' + cls + '" style="width:' + (t ? (t[key] / max * 100).toFixed(1) : 0) + '%"></div>';
    el.innerHTML = names.map((n) => {
      const a = findTeam(realTeams, n), b = findTeam(engineTeams, n);
      const title = n + ' — 실제 ' + (a ? o.fmt(a[key]) + o.unit : '–') + ', 매치봇 ' + (b ? o.fmt(b[key]) + o.unit : '–');
      return '<div class="sh-team" title="' + esc(title) + '"><span class="sh-team-name">' + esc(n) + '</span><div class="sh-team-bars">' + bar(a, 'sh-bar-real') + bar(b, 'sh-bar-engine') + '</div>' +
        '<span class="sh-team-val">' + (a ? o.fmt(a[key]) : '–') + ' → <b>' + (b ? o.fmt(b[key]) : '–') + '</b>' + esc(o.unit) + '</span></div>';
    }).join('');
    el.setAttribute('aria-label', '구단별 ' + (o.label || key) + ' (실제 → 매치봇): ' + names.map((n) => { const a = findTeam(realTeams, n), b = findTeam(engineTeams, n); return n + ' ' + (a ? o.fmt(a[key]) : '–') + ' → ' + (b ? o.fmt(b[key]) : '–'); }).join(', '));
  }

  // ───────── 재생기 (ui/app/replay 모듈 재사용, 뷰포트에 들어올 때 로드) ─────────
  function loadScripts(list, cb) {
    if (window.KBO && window.KBO.Replay) { cb(null); return; }
    let i = 0;
    (function next() {
      if (i >= list.length) { cb(window.KBO && window.KBO.Replay ? null : '재생기 모듈을 읽지 못했어요'); return; }
      const s = document.createElement('script');
      s.src = list[i++];
      s.onload = next;
      s.onerror = () => cb('스크립트 읽기 실패: ' + s.src);
      document.head.appendChild(s);
    })();
  }
  function whenVisible(el, cb) {
    if (query.get('replay') === 'now' || !('IntersectionObserver' in window)) { cb(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); cb(); }
    }, { rootMargin: '240px 0px' });
    io.observe(el);
  }
  /**
   * box(.sh-replay) 안에 트레이스를 재생한다. opts.preview면 15초만 2배속으로 돌리고 멈추며, 탭하면 처음부터 전체 재생.
   * cb(err, player). <html data-replay="ready n idx">로 점검 스크립트가 확인한다.
   */
  function mountReplay(box, traceUrl, opts, cb) {
    const o = opts || {};
    const host = $('.sh-replay-host', box) || box;
    host.innerHTML = '<div class="sh-replay-msg">탐색 과정을 불러오는 중…</div>';
    const fail = (msg) => { host.innerHTML = '<div class="sh-replay-msg sh-err">' + esc(msg) + '</div>'; mark('replay', 'load-error'); checkScroll(); if (cb) cb(msg); };
    whenVisible(box, () => loadScripts(SHOW.replayScripts, (err) => {
      if (err) { fail(err); return; }
      load(traceUrl, (err2, data) => {
        if (err2) { fail('탐색 과정을 불러올 수 없어요. ' + err2); return; }
        const trace = data && data.trace ? data.trace : data;
        if (!trace || !trace.events) { fail('이 결과에는 탐색 과정 기록이 없어요.'); return; }
        // 상자가 화면 위쪽 밖에 있을 때(예: #try로 들어와 폼을 보는 중) 재생기가 커지면 보던 자리가 밀린다. 커진 만큼 스크롤을 따라 옮긴다
        const before = box.getBoundingClientRect();
        host.innerHTML = '';
        let p;
        try {
          p = window.KBO.Replay.open(trace, { host, embedded: true, autoplay: o.autoplay !== false, speed: o.preview ? 2 : 1 });
        } catch (e) { fail('탐색 과정 형식이 맞지 않아요. ' + e.message); return; }
        if (o.preview) preview(box, p);
        fitBoard(box, p);
        if (before.bottom <= 0) { const grown = box.getBoundingClientRect().height - before.height; if (grown) window.scrollBy(0, grown); }
        mark('replay', 'ready ' + p.model.n + ' ' + p.idx);
        checkScroll();
        if (cb) cb(null, p);
      });
    }));
  }
  /**
   * 휴대폰(show.css ≤700px)에서 일정판은 380px 창 안에서 스크롤된다. 지금 옮겨진 카드(.rp-hot)가 창 안에 보이도록 따라간다.
   * 판이 스크롤되지 않는 폭(넓은 화면·「크게 보기」)에서는 아무것도 하지 않는다.
   */
  /**
   * 보여주는 문의 해설은 "어떤 수로 총 이동거리가 얼마에서 얼마가 됐나"만 말한다.
   * 모듈 기본 해설(ui/core/replay-model.js caption)은 슬롯 없는 시리즈·구단 간 차이 같은 단계까지 적는데, 여기서는 개념만 보여 주면 된다.
   */
  function simpleCaptions(p) {
    const m = p.model, RM = window.KBO.ReplayModel, km = (st) => (st.soft && st.soft.length >= 5 ? fmtInt(st.soft[4]) + 'km' : null);
    m.captions = m.states.map((st, i) => {
      if (i === 0) return '시작 상태' + (km(st) ? ' · 10개 팀 전체 이동거리 ' + km(st) : '');
      const prev = m.states[i - 1], a = km(prev), b = km(st);
      const dist = a && b ? (a === b ? '전체 이동거리 ' + b + ' 그대로' : '전체 이동거리 ' + a + ' → ' + b + ' (' + (prev.soft[4] > st.soft[4] ? '−' : '+') + fmtInt(Math.abs(prev.soft[4] - st.soft[4])) + ')') : ''; // 가끔 일부러 나빠지는 수는 +
      const names = [];
      for (const idx of st.changed) { const t = m.teams[m.series[idx].home]; const nm = t ? t.name : String(m.series[idx].home); if (names.indexOf(nm) < 0) names.push(nm); }
      const who = names.slice(0, 3).join('·') + (names.length > 3 ? ' 외 ' + (names.length - 3) : '');
      // 총 이동거리가 늘어도 위쪽 단계(홈 경기·구단별 이동거리·이동 횟수)가 좋아지면 개선으로 친다. 그 까닭을 붙여 "개선인데 +"가 어색하게 읽히지 않게 한다
      let why = '';
      if (prev.soft && st.soft && st.soft[4] > prev.soft[4]) why = st.soft[3] < prev.soft[3] ? '대신 주말·공휴일 홈 경기가 더 고르게 됐어요' : st.soft[2] < prev.soft[2] ? '대신 구단별 이동거리 차이가 줄었어요' : st.soft[1] < prev.soft[1] ? '대신 구단별 이동 횟수가 더 고르게 됐어요' : '';
      return i + '번째 개선 · ' + RM.moveWord(m, prev, m.events[i - 1].changes) + (dist ? ' · ' + dist : '') + (why ? ' · ' + why : '') + (who ? ' · ' + who : '');
    });
    p.update();
  }
  /**
   * 보여주는 문에 맞게 재생기를 손본다: 해설을 단순하게(simpleCaptions), 그리고 show.css가 숨긴 날짜 칸(휴대폰은 앞 12칸만 펼침)에
   * 놓인 카드는 같이 숨긴다. 모듈의 place()는 보이지 않는 칸의 자리를 0으로 재서 카드를 왼쪽 위에 겹쳐 놓기 때문이다.
   */
  // 점수판 지표 이름(팬 말). 마지막은 곡선, 나머지는 칩(show.css)
  const LEVEL_NAMES = { 1: '이동 횟수 맞추기', 2: '구단별 이동거리 맞추기', 3: '주말·공휴일 홈 맞추기', 4: '10개 팀 전체 이동거리' };
  function fitBoard(box, p) {
    simpleCaptions(p);
    const bh = $('.rp-board-h .rp-muted', box); if (bh) bh.textContent = bh.textContent.replace(/슬롯 (\d+)개/, '날짜 $1칸'); // 모듈 기본은 "슬롯 45개"
    const sh = $('.rp-score-h b', box); if (sh) sh.textContent = '이동거리 곡선'; // 모듈 기본은 "점수 곡선"
    $$('.rp-lv', box).forEach((el) => { const nm = el.querySelector('.rp-lv-name'), l = Number(el.getAttribute('data-l')); if (nm && LEVEL_NAMES[l]) nm.textContent = LEVEL_NAMES[l]; });
    // 칩 값: 0이면 "다 맞췄어요 ✓", 아니면 "아직 N"
    const uc = p.updateCursor.bind(p);
    p.updateCursor = () => {
      uc();
      $$('.rp-lv:not(:last-child) .rp-lv-val b', box).forEach((b) => { const n = Number(String(b.textContent).replace(/[^\d.-]/g, '')); b.textContent = n === 0 ? '다 맞췄어요 ✓' : '맞추는 중'; }); // 숫자(어긋난 정도의 합)는 팬에게 뜻이 없어 글로만
    };
    p.updateCursor();
    const slots = $$('.rp-slot', box);
    const place = p.place.bind(p);
    p.place = (i) => {
      place(i);
      const st = p.model.states[i];
      for (let k = 0; k < p.cards.length; k++) { const a = st.assign[k]; if (a >= 0 && slots[a] && slots[a].offsetParent === null) p.cards[k].hidden = true; }
    };
    p.place(p.idx);
  }
  function preview(box, p) {
    box.classList.add('sh-preview');
    p.layout();
    const veil = document.createElement('button');
    veil.type = 'button'; veil.className = 'sh-veil';
    veil.setAttribute('aria-label', '15초 미리보기 중입니다. 누르면 처음부터 전체 재생합니다');
    veil.innerHTML = '<span>▶ 15초 미리보기 · 탭하면 전체 재생</span>';
    box.appendChild(veil);
    const timer = setTimeout(() => { p.pause(); veil.innerHTML = '<span>▶ 처음부터 전체 재생 (' + Math.round(p.model.durationMs / 1000) + '초)</span>'; veil.setAttribute('aria-label', '처음부터 전체 재생'); }, SHOW.PREVIEW_MS);
    veil.addEventListener('click', () => {
      clearTimeout(timer);
      veil.remove();
      box.classList.remove('sh-preview');
      p.setSpeed(1); p.layout(); p.restart(); p.play();
      mark('replay', 'full ' + p.model.n);
      try { p.el.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
      checkScroll();
    });
  }

  // ───────── 공유 ─────────
  function toast(msg) {
    let t = $('.sh-toast');
    if (!t) { t = document.createElement('div'); t.className = 'sh-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200);
  }
  function copyText(text, cb) {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => cb(true), () => cb(fallback())); return; }
    cb(fallback());
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); return ok;
    }
  }
  SHOW.PUBLIC = 'https://schedulelab.kr'; // 공유 링크는 보는 곳(localhost·휴대폰 IP)과 상관없이 공개 주소로(2026-10-24)
  /** 공유할 공개 주소: 소개 / · 비교 /compare · 결과 /r/<id>. 서버 경로 규칙(BaseballWebServer.resolveStatic)과 같다. */
  function shareUrl() {
    const page = document.body.getAttribute('data-page');
    if (page === 'index') return SHOW.PUBLIC + '/';
    if (page === 'compare') return SHOW.PUBLIC + '/compare';
    if (page === 'r') { const id = query.get('id'); if (id) return SHOW.PUBLIC + '/r/' + encodeURIComponent(id); }
    return location.href.replace(/[?&]replay=now/, '').replace(/#.*$/, '');
  }
  function shareText() { return document.title; }
  function shareDesc() { const m = document.querySelector('meta[property="og:description"]'); return m ? m.getAttribute('content') : ''; }
  SHOW.KAKAO_KEY = 'dd04ee384353180b67c19cfab63bb763'; // JavaScript 키(카카오맵과 같은 앱, 도메인 제한이 보호). 카카오톡 공유 카드에 쓴다
  /** 카카오톡 공유: 누를 때만 SDK를 읽고(이 사이트의 외부 요청은 Jua·카카오맵·이 SDK 셋) 제목·설명·OG 이미지 카드를 보낸다. 실패하면 cb(false) → 공유 창·링크 복사로 대체 */
  function kakaoShare(url, title, desc, cb) {
    const send = () => {
      try {
        const K = window.Kakao;
        if (!K.isInitialized()) K.init(SHOW.KAKAO_KEY);
        const id = document.body.getAttribute('data-page') === 'r' ? (query.get('id') || 'default') : 'default';
        K.Share.sendDefault({ objectType: 'feed', content: { title, description: desc, imageUrl: SHOW.PUBLIC + '/og/' + id + '.png', link: { mobileWebUrl: url, webUrl: url } }, buttons: [{ title: '보러 가기', link: { mobileWebUrl: url, webUrl: url } }] });
        cb(true);
      } catch (e) { cb(false); }
    };
    if (window.Kakao && window.Kakao.Share) { send(); return; }
    const sc = document.createElement('script');
    sc.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
    sc.onload = send; sc.onerror = () => cb(false);
    document.head.appendChild(sc);
  }
  SHOW.share = function (kind) {
    const url = shareUrl(), text = shareText();
    if (kind === 'copy') { copyText(url, (ok) => toast(ok ? '링크를 복사했어요' : '복사가 막혀 있어요. 주소창의 주소를 직접 복사해 주세요')); return; }
    if (kind === 'x') { window.open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank', 'noopener'); return; }
    if (kind === 'threads') { window.open('https://www.threads.net/intent/post?text=' + encodeURIComponent(text + ' ' + url), '_blank', 'noopener'); return; }
    if (kind === 'kakao') {
      // 1) 카카오 SDK 공유(제목·설명·이미지 카드) 2) 안 되면 휴대폰 공유 창 3) 그것도 없으면 링크 복사
      kakaoShare(url, text, shareDesc(), (ok) => {
        if (ok) return;
        if (navigator.share) { navigator.share({ title: text, url }).catch(() => { /* 취소 */ }); return; }
        copyText(url, (ok2) => toast(ok2 ? '링크를 복사했어요. 카카오톡 대화창에 붙여 넣어 보내세요' : '복사가 막혀 있어요. 주소를 직접 복사해 카카오톡에 붙여 넣어 주세요'));
      });
    }
  };
  function bindShare() {
    $$('[data-share]').forEach((b) => b.addEventListener('click', () => SHOW.share(b.getAttribute('data-share'))));
  }
  /** 위저드 링크: file://이면 ../index.html, 서버면 /studio/ (해시는 유지) */
  function fixStudioLinks() {
    $$('a[data-studio]').forEach((a) => {
      const hash = (a.getAttribute('href') || '').replace(/^[^#]*/, '');
      a.setAttribute('href', (isFile ? SHOW.studioHref.file : SHOW.studioHref.http) + hash);
    });
  }

  /** 점검용: 페이지 가로 스크롤 여부를 <html data-scroll>에 적는다(재생기 checkScroll과 같은 형식, 세로는 허용). */
  function checkScroll() {
    const w = window.innerWidth, h = window.innerHeight;
    const sw = Math.max(html.scrollWidth, document.body.scrollWidth), sh = Math.max(html.scrollHeight, document.body.scrollHeight);
    const ok = !(sw > w + 1);
    mark('scroll', (ok ? 'OK' : 'SCROLL') + ' ' + w + 'x' + h + ' doc ' + sw + 'x' + sh);
    return ok;
  }
  SHOW.checkScroll = checkScroll;

  // ───────── 쪽별 ─────────
  const pages = {};

  /** 소개 / */
  pages.index = function () {
    load(SHOW.api.compare, (err, cmp) => {
      if (err || !cmp || !cmp.real || !cmp.engine) { mark('show', 'compare-error'); checkScroll(); return; }
      const v = view(cmp.real, cmp.engine);
      bind(v);
      if (cmp.real.totalKm) SHOW.REAL_KM = cmp.real.totalKm;
      const tb = $('#cmp-total'); if (tb) totalBars(tb, cmp.real, cmp.engine);
      const tt = $('#cmp-teams'); if (tt) teamBars(tt, cmp.real.teams, cmp.engine.teams, 'distanceKm', { unit: ' km', label: '이동거리' });
      scatterViz(cmp);
      mark('show', 'compare-ok');
      checkScroll();
    });
    const box = $('#replay-box');
    if (box) mountReplay(box, SHOW.api.result('default'), { preview: true });
    routeMap();
    tryForm();
    bindShare();
    fixStudioLinks();
  };

  const meanBy = (teams, key) => { const xs = teams.map((t) => t[key]).filter((x) => typeof x === 'number'); return xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : null; };
  /**
   * 점 지도(#h1-sc): 가로 = 시즌 이동거리 − 평균, 세로 = 주말·공휴일 홈 − 평균. 구단 하나가 점 하나.
   * 오른쪽 아래(더 다니고 휴일 홈 적음)일수록 손해. 「매치봇이 만들면?」을 누르면 점이 매치봇 값 자리로 움직인다(같은 눈금).
   */
  function scatterViz(cmp) {
    const box = $('#h1-sc'); if (!box) return;
    const rt = cmp.real.teams || [], et = cmp.engine.teams || [];
    if (rt.length < 2) return;
    const W = 360, H = 300, L = 10, R = 10, T = 26, B = 26, cx = (L + (W - R)) / 2, cy = (T + (H - B)) / 2;
    const dev = (teams) => { const mk = meanBy(teams, 'distanceKm'), mh = meanBy(teams, 'holidayWeight'); return teams.map((t) => ({ name: t.name, x: t.distanceKm - mk, y: (t.holidayWeight != null && mh != null) ? t.holidayWeight - mh : 0, km: t.distanceKm, hol: t.holidayWeight })); };
    const D = { real: dev(rt), engine: et.length ? dev(et) : null };
    const all = D.real.concat(D.engine || []);
    const xm = Math.max(...all.map((d) => Math.abs(d.x))) * 1.18 || 1, ym = Math.max(3, ...all.map((d) => Math.abs(d.y))) + 0.8;
    const X = (x) => cx + x / xm * (cx - L), Y = (y) => cy - y / ym * (cy - T);
    const tickX = xm > 1200 ? 1000 : 500, tickY = ym > 5 ? 2 : 1;
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    svg += '<rect class="sc-q-good" x="' + L + '" y="' + T + '" width="' + (cx - L) + '" height="' + (cy - T) + '" rx="8"/>';
    svg += '<rect class="sc-q-bad" x="' + cx + '" y="' + cy + '" width="' + (W - R - cx) + '" height="' + (H - B - cy) + '" rx="8"/>';
    svg += '<line class="sc-axis" x1="' + L + '" y1="' + cy + '" x2="' + (W - R) + '" y2="' + cy + '"/><line class="sc-axis" x1="' + cx + '" y1="' + T + '" x2="' + cx + '" y2="' + (H - B) + '"/>';
    for (let v = tickX; v < xm; v += tickX) { [-v, v].forEach((u) => { svg += '<line class="sc-tick" x1="' + X(u) + '" y1="' + (cy - 4) + '" x2="' + X(u) + '" y2="' + (cy + 4) + '"/><text class="sc-tick-t" x="' + X(u) + '" y="' + (H - B - 5) + '" text-anchor="middle">' + (u > 0 ? '+' : '−') + fmtInt(Math.abs(u)) + 'km</text>'; }); }
    for (let v = tickY; v < ym; v += tickY) { [-v, v].forEach((u) => { svg += '<line class="sc-tick" x1="' + (cx - 4) + '" y1="' + Y(u) + '" x2="' + (cx + 4) + '" y2="' + Y(u) + '"/><text class="sc-tick-t" x="' + (L + 3) + '" y="' + (Y(u) + 3.5) + '">' + (u > 0 ? '+' : '−') + Math.abs(u) + '경기</text>'; }); }
    // 축 표시는 축 끝에 바로: 가로 축 양끝(덜/더 다님), 세로 축 위아래(휴일 홈 많음/적음). 모서리에는 유리·손해만
    svg += '<text class="sc-ax" x="' + (L + 2) + '" y="' + (cy - 6) + '">← 덜 다님</text><text class="sc-ax" x="' + (W - R - 2) + '" y="' + (cy - 6) + '" text-anchor="end">더 다님 →</text>';
    svg += '<text class="sc-ax" x="' + (cx + 6) + '" y="' + (T + 10) + '">↑ 주말·공휴일 홈 많음</text><text class="sc-ax" x="' + (cx + 6) + '" y="' + (H - B - 19) + '">↓ 주말·공휴일 홈 적음</text>';
    svg += '<text class="sc-cap good" x="' + (L + 6) + '" y="' + (T + 14) + '">유리</text>';
    svg += '<text class="sc-cap bad" x="' + (W - R - 6) + '" y="' + (H - B - 6) + '" text-anchor="end">손해</text>';
    svg += '<g id="h1-sc-pts"></g></svg>';
    box.innerHTML = svg;
    const g = box.querySelector('#h1-sc-pts');
    // 이름표 자리: 기본은 점 오른쪽. 오른쪽 가장자리면 왼쪽, 같은 높이에 오른쪽 가까이 다른 점이 있으면 위
    // 단계 0: 점 오른쪽(가장자리면 왼쪽). 같은 높이에서 가까운 점이 이어지면 위·아래·더 위·더 아래로 번갈아 비킨다
    const SLOT = [{ x: 0, y: -12, anchor: 'middle' }, { x: 0, y: 19, anchor: 'middle' }, { x: 0, y: -25, anchor: 'middle' }, { x: 0, y: 32, anchor: 'middle' }];
    function labelPlan(list) {
      const plan = {}, sorted = list.slice().sort((a, b) => X(a.x) - X(b.x)), last = [];
      sorted.forEach((d) => {
        const px = X(d.x), py = Y(d.y);
        const near = sorted.filter((o) => o !== d && Math.abs(Y(o.y) - py) < 14 && Math.abs(X(o.x) - px) < 46);
        if (!near.length) { plan[d.name] = px > W - R - 48 ? { x: -10, y: 4, anchor: 'end' } : { x: 10, y: 4, anchor: 'start' }; return; }
        let k = 0; while (k < SLOT.length - 1 && last[k] != null && px - last[k] < 34) k++;
        last[k] = px; plan[d.name] = SLOT[k];
      });
      return plan;
    }
    const order = D.real.map((d) => d.name);
    g.innerHTML = order.map((n) => '<g class="sc-t" data-t="' + esc(n) + '"><circle r="6"/><text></text><text class="sc-tag"></text></g>').join('');
    // 우리 팀 칩: 누르면 그 점이 커지고 아래에 문장으로 풀어 준다
    const pick = $('#h1-sc-pick'), say = $('#h1-sc-say');
    let picked = null, curKind = 'real';
    if (pick) {
      pick.insertAdjacentHTML('beforeend', order.map((n) => '<button type="button" data-pick="' + esc(n) + '" aria-pressed="false">' + esc(n) + '</button>').join(''));
      $$('[data-pick]', pick).forEach((b) => b.addEventListener('click', () => { picked = picked === b.getAttribute('data-pick') ? null : b.getAttribute('data-pick'); applyPick(); }));
    }
    function applyPick() {
      const list = D[curKind] || D.real;
      box.classList.toggle('has-pick', !!picked);
      $$('.sc-t', g).forEach((el) => el.classList.toggle('is-pick', el.getAttribute('data-t') === picked));
      if (pick) $$('[data-pick]', pick).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-pick') === picked)));
      if (!say) return;
      if (!picked) { say.textContent = ''; return; }
      const d = list.find((o) => o.name === picked); if (!d) { say.textContent = ''; return; }
      const kmW = Math.abs(d.x) < 50 ? '이동거리는 평균 수준이고' : '평균보다 ' + fmtInt(Math.abs(d.x)) + 'km ' + (d.x > 0 ? '더' : '덜') + ' 다니고';
      const hy = Math.round(d.y * 10) / 10, hW = Math.abs(hy) < 0.5 ? '주말·공휴일 홈 경기는 평균만큼이에요.' : '주말·공휴일 홈 경기는 ' + Math.abs(hy) + '경기 ' + (hy > 0 ? '많아요.' : '적어요.');
      say.textContent = (curKind === 'engine' ? '매치봇 일정에서 ' : '2025 실제 일정에서 ') + picked + josa(picked, '은', '는') + ' ' + kmW + ', ' + hW;
    }
    function place(kind) {
      const list = D[kind] || D.real, plan = labelPlan(list);
      order.forEach((n) => {
        const d = list.find((o) => o.name === n) || { name: n, x: 0, y: 0 };
        const el = g.querySelector('[data-t="' + CSS.escape(n) + '"]'); if (!el) return;
        el.style.transform = 'translate(' + X(d.x).toFixed(1) + 'px,' + Y(d.y).toFixed(1) + 'px)';
        const lp = plan[n] || { x: 10, y: 4, anchor: 'start' }, tx = el.querySelector('text');
        tx.setAttribute('x', lp.x); tx.setAttribute('y', lp.y); tx.setAttribute('text-anchor', lp.anchor); tx.textContent = n;
        el.querySelector('circle').innerHTML = '<title>' + esc(n + ' · 이동거리 ' + fmtInt(d.km) + 'km(' + (d.x >= 0 ? '+' : '−') + fmtInt(Math.abs(d.x)) + ') · 주말·공휴일 홈 ' + d.hol + '경기(' + (d.y >= 0 ? '+' : '−') + Math.abs(Math.round(d.y * 10) / 10) + ')') + '</title>';
      });
      // 꼬리표: 실제 일정에서 가장 손해·유리한 구단에만
      const score = (d) => d.x / xm - d.y / ym;
      const worst = list.reduce((a, b) => (score(b) > score(a) ? b : a)), best = list.reduce((a, b) => (score(b) < score(a) ? b : a));
      $$('.sc-t', g).forEach((el) => {
        const n = el.getAttribute('data-t'), tag = el.querySelector('.sc-tag'), lp = plan[n] || { x: 10, y: 4, anchor: 'start' };
        let txt = '', cls = 'sc-tag';
        if (kind !== 'engine' && n === worst.name) { txt = '가장 손해'; cls += ' bad'; }
        if (kind !== 'engine' && n === best.name) { txt = '가장 유리'; cls += ' good'; }
        tag.setAttribute('class', cls); tag.textContent = txt;
        tag.setAttribute('x', lp.x); tag.setAttribute('y', lp.y + (lp.y < 0 ? -11 : 12)); tag.setAttribute('text-anchor', lp.anchor);
      });
      curKind = kind;
      box.classList.toggle('sh-engine-on', kind === 'engine');
      applyPick();
      box.setAttribute('aria-label', (kind === 'engine' ? '매치봇 일정' : '실제 2025 일정') + ' 구단별 이동거리·휴일 홈 점 지도: ' + list.map((d) => d.name + ' ' + fmtInt(d.km) + 'km·' + d.hol + '경기').join(', '));
      const note = $('#h1-sc-note');
      if (note) {
        if (kind === 'engine' && D.engine) {
          const ks = D.engine.map((d) => d.km), hs = D.engine.map((d) => d.hol);
          const rks = D.real.map((d) => d.km);
          note.textContent = '열 개 구단이 가운데로 모여요. 가장 많이 다닌 구단과 적게 다닌 구단의 차이는 ' + fmtInt(Math.max(...ks) - Math.min(...ks)) + 'km(실제 ' + fmtInt(Math.max(...rks) - Math.min(...rks)) + 'km), 주말·공휴일 홈 경기는 ' + (Math.max(...hs) === Math.min(...hs) ? '모두 ' + hs[0] + '경기' : Math.min(...hs) + '~' + Math.max(...hs) + '경기') + '예요.';
        } else {
          note.textContent = '2025년엔 ' + worst.name + josa(worst.name, '이', '가') + ' 가장 많이 다니면서 주말·공휴일 홈 경기도 적어서 가장 손해였고, ' + best.name + josa(best.name, '은', '는') + ' 그 반대였어요.';
        }
      }
      $$('[data-sc]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-sc') === kind)));
    }
    $$('[data-sc]').forEach((b) => b.addEventListener('click', () => place(b.getAttribute('data-sc'))));
    place('real');
  }
  /**
   * 롯데 원정길 카카오맵. 「카카오맵으로 보기」를 누를 때만 SDK를 읽는다(autoload=false → kakao.maps.load).
   * 같은 길을 오가는 구간이 겹치지 않게 각 구간을 살짝 휜 곡선(2차 베지어를 24점으로)으로 그리고, 가운데에 번호 표지를 올린다.
   */
  function routeMap() {
    const btn = $('#rt-kmap-btn'), wrap = $('#rt-kmap'), box = $('#rt-kmap-box'); if (!btn || !wrap || !box) return;
    const key = btn.getAttribute('data-kakao-key');
    let map = null, layer = [], kind = 'real';
    function clear() { layer.forEach((o) => o.setMap(null)); layer = []; }
    function curve(a, b, side) {
      // 위도·경도 평면에서 수직 방향으로 구간 길이의 10%만큼 휘게. 경도는 cos(위도)로 보정
      const k = Math.cos((a[0] + b[0]) / 2 * Math.PI / 180);
      const dx = (b[1] - a[1]) * k, dy = b[0] - a[0], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len, bulge = len * 0.2 * side;
      const cx = (a[1] + b[1]) / 2 + nx * bulge / k, cy = (a[0] + b[0]) / 2 + ny * bulge;
      const pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * cy + t * t * b[0], u * u * a[1] + 2 * u * t * cx + t * t * b[1]]); }
      return pts;
    }
    function draw() {
      if (!map) return;
      clear();
      const K = window.kakao.maps, legs = SHOW.LOTTE_AUG[kind], color = kind === 'engine' ? '#2f5bd3' : '#b54708';
      const used = {}; legs.forEach((l) => { used[l[0]] = true; used[l[1]] = true; });
      const seen = {};
      Object.keys(SHOW.STADIUMS).forEach((n) => {
        const st = SHOW.STADIUMS[n], id = st[0] + ',' + st[1]; if (seen[id]) return; seen[id] = true;
        const cls = n === '롯데' ? 'km-pin home' : (used[n] ? 'km-pin' : 'km-pin faint');
        const ov = new K.CustomOverlay({ position: new K.LatLng(st[0], st[1]), content: '<div class="' + cls + '">' + esc(st[2]) + '</div>', yAnchor: 1.3, zIndex: used[n] ? 3 : 1 });
        ov.setMap(map); layer.push(ov);
      });
      const pair = {};
      legs.forEach((l, i) => {
        const a = SHOW.STADIUMS[l[0]], b = SHOW.STADIUMS[l[1]], keyAB = [l[0], l[1]].sort().join('|');
        pair[keyAB] = (pair[keyAB] || 0) + 1;
        // 오가는 구간은 방향이 반대라 수직 방향도 반대로 잡히므로 휘는 쪽은 늘 같은 부호를 준다(그래야 서로 반대로 휜다)
        const nth = pair[keyAB], pts = curve(a, b, 1);
        const line = new K.Polyline({ path: pts.map((q) => new K.LatLng(q[0], q[1])), strokeWeight: 3.5, strokeColor: color, strokeOpacity: .95, strokeStyle: 'solid', endArrow: true });
        line.setMap(map); layer.push(line);
        const m = pts[nth % 2 ? 10 : 14]; // 가는 길·오는 길 표지가 서로 다른 자리에 놓이게
        const badge = new K.CustomOverlay({ position: new K.LatLng(m[0], m[1]), content: '<div class="km-badge ' + (kind === 'engine' ? 'eng' : 'real') + '" title="' + esc(l[0] + '→' + l[1] + ' ' + l[2] + 'km') + '">' + (i + 1) + '</div>', zIndex: 10 });
        badge.setMap(map); layer.push(badge);
      });
      $$('[data-km]', wrap).forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-km') === kind)));
    }
    function init() {
      const K = window.kakao.maps;
      // 눈금은 13으로 고정(14면 북한까지 보여 너무 멀고, 12면 대전~대구만 보인다; setBounds는 단계가 띄엄띄엄이라 14로 튄다). 고척~부산이 세로로 들어오게 가운데를 잡는다
      map = new K.Map(box, { center: new K.LatLng(36.38, 127.9), level: 13, draggable: false, scrollwheel: false, disableDoubleClickZoom: true, keyboardShortcuts: false });
      draw();
    }
    function fail(msg) { box.innerHTML = '<div class="sh-kmap-msg">' + esc(msg) + '</div>'; }
    btn.addEventListener('click', () => {
      wrap.hidden = false; btn.disabled = true; btn.textContent = '지도를 불러오는 중…';
      const done = () => { btn.hidden = true; try { window.kakao.maps.load(init); } catch (e) { fail('지도를 불러오지 못했어요. ' + e.message); } };
      if (window.kakao && window.kakao.maps) { done(); return; }
      const sc = document.createElement('script');
      sc.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&autoload=false';
      sc.onload = done;
      sc.onerror = () => { btn.hidden = true; fail('지도를 불러오지 못했어요. 카카오 개발자 콘솔에 이 주소(' + location.host + ')가 등록돼 있는지 확인해 주세요.'); };
      document.head.appendChild(sc);
    });
    $$('[data-km]', wrap).forEach((b) => b.addEventListener('click', () => { kind = b.getAttribute('data-km'); draw(); }));
  }

  /** ④ 직접 해보기 — 손잡이 2개 + 생각 시간. 서버면 실제 편성(POST /api/v1/solve → SSE → /r/<id>), file://이면 목업 진행 */
  function tryForm() {
    const form = $('#try-form'); if (!form) return;
    const tolOf = () => { const r = $('input[name="tol"]:checked', form); return r ? r.value : '300'; };
    const thinks = $$('input[name="t"]', form);
    const thinkOf = () => { const r = thinks.find((x) => x.checked); return r ? Number(r.value) : SHOW.THINK_DEFAULT; };
    const boxes = $$('input[name="cd"]', form), count = $('#cd-count');
    const btn = form.querySelector('[type="submit"]');
    const btnLabel = () => '편성 시작 (약 ' + (SHOW.THINK[thinkOf()] || SHOW.THINK[SHOW.THINK_DEFAULT]).wait + '초)';
    const prog = $('#try-progress'), bar = $('#try-bar'), txt = $('#try-txt'), err = $('#try-err'), news = $('#try-news');
    const MAXSEL = 5;
    // 두산·LG는 잠실을 같이 쓴다: 어린이날 홈 5구단에 둘 중 정확히 하나가 있어야 매치봇이 첫 일정을 만든다
    const SHARED = ['두산', 'LG'];
    const mock = $('.sh-mock', form); if (mock) mock.hidden = !isFile;
    // 결과 쪽 「더 오래 다시 해 보기」가 넘긴 조건(?t=&tol=&cd=&seed=)을 미리 골라 둔다. 바로 돌리지는 않는다
    let presetSeed = null;
    (function prefill() {
      const t = query.get('t'), tol = query.get('tol'), cd = query.get('cd'), sd = query.get('seed');
      if (t) thinks.forEach((x) => { if (x.value === t) x.checked = true; });
      if (tol) $$('input[name="tol"]', form).forEach((x) => { if (Number(x.value) === Number(tol)) x.checked = true; });
      if (cd) {
        const names = cd.split(',').filter((n, i, a) => SHOW.TEAMS.indexOf(n) >= 0 && a.indexOf(n) === i);
        if (names.length === MAXSEL && SHARED.filter((n) => names.indexOf(n) >= 0).length === 1) boxes.forEach((b) => { b.checked = names.indexOf(b.value) >= 0; });
      }
      if (sd && /^\d{1,15}$/.test(sd)) presetSeed = Number(sd);
    })();
    // 서버 정보: 출발점 수, 최대 시간, 대기 줄. 한 번에 작업 1개라 기다리는 분이 있으면 30초는 쉬게 한다
    let seeds = null, maxSec = null, waiting = 0, infoAt = 0;
    function getInfo() {
      if (isFile || Date.now() - infoAt < 5000) return;
      infoAt = Date.now();
      load('/api/v1/info', (e, info) => {
        if (e || !info) return;
        if (info.defaultSeeds) { seeds = info.defaultSeeds; const ts = $('#t-seeds'); if (ts) ts.textContent = String(seeds); }
        if (info.maxSeconds) maxSec = info.maxSeconds;
        waiting = info.queueLength || 0;
        refreshThink();
      });
    }
    function refreshThink() {
      let bumped = false;
      thinks.forEach((x) => {
        const v = Number(x.value);
        x.disabled = (maxSec != null && v > maxSec) || (v >= 30 && waiting > 0);
        if (x.disabled && x.checked) { x.checked = false; bumped = true; }
      });
      if (!thinks.some((x) => x.checked)) { const d = thinks.find((x) => !x.disabled && Number(x.value) === SHOW.THINK_DEFAULT) || thinks.find((x) => !x.disabled); if (d) d.checked = true; }
      const busy = $('#t-busy');
      if (busy) {
        busy.hidden = !(waiting > 0);
        busy.textContent = '지금 기다리는 분이 있어서 꼼꼼하게(30초)는 잠시 쉬어요.' + (bumped ? ' 보통으로 바꿔 뒀어요.' : '') + ' 대기 줄이 비면 다시 고를 수 있어요.';
      }
      if (!form.classList.contains('sh-running')) btn.textContent = btnLabel();
    }
    thinks.forEach((x) => x.addEventListener('change', () => { refreshThink(); getInfo(); }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') getInfo(); });
    refreshThink();
    getInfo();
    function refresh() {
      const picked = boxes.filter((b) => b.checked).map((b) => b.value), n = picked.length;
      const shared = SHARED.filter((t) => picked.indexOf(t) >= 0).length;
      // 잠실 자리가 남아 있어야 하면 마지막 한 칸은 두산·LG 몫으로 남긴다
      const full = (b) => n >= MAXSEL || (shared === 0 && n === MAXSEL - 1 && SHARED.indexOf(b.value) < 0);
      boxes.forEach((b) => { b.disabled = !b.checked && (full(b) || (shared >= 1 && SHARED.indexOf(b.value) >= 0)); });
      if (count) count.textContent = n + '/' + MAXSEL;
      const ok = n === MAXSEL && shared === 1;
      btn.disabled = !ok || form.classList.contains('sh-running');
      const help = $('#cd-help');
      if (help) help.textContent = (ok ? '5개 구단이 어린이날 홈에서 경기해요. 바꾸려면 하나를 풀고 다른 구단을 고르세요.' : (MAXSEL - n) + '개 더 고르세요. 어린이날에는 꼭 5개 구단이 홈이어야 해요.') +
        ' 두산과 LG는 잠실을 같이 써서 둘 중 하나만, 꼭 하나는 골라야 해요.';
    }
    boxes.forEach((b) => b.addEventListener('change', refresh));
    refresh();
    function setBar(k) {
      bar.style.width = (Math.max(0, Math.min(1, k)) * 100).toFixed(1) + '%';
      prog.setAttribute('aria-valuenow', String(Math.round(Math.max(0, Math.min(1, k)) * 100)));
    }
    // 진행·오류가 화면 밖에 생기지 않게 보이는 곳까지만 끌어온다
    const show = (el) => { try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); } };
    function reset(message) {
      form.classList.remove('sh-running');
      btn.textContent = btnLabel();
      prog.hidden = true; setBar(0);
      if (news) news.textContent = '';
      if (err) { err.textContent = message || ''; err.hidden = !message; if (message) show(err); }
      refresh();
    }
    // 결과 쪽에서 뒤로 왔을 때(bfcache) "편성 중…"에 멈춰 있지 않게 한다
    window.addEventListener('pageshow', (e) => { if (e.persisted) reset(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (form.classList.contains('sh-running')) return;
      form.classList.add('sh-running');
      btn.disabled = true; btn.textContent = '편성 중…';
      if (err) err.hidden = true;
      prog.hidden = false; setBar(0);
      txt.textContent = '준비 중';
      if (news) news.textContent = '';
      show(prog);
      const teams = boxes.filter((b) => b.checked).map((b) => b.value);
      if (isFile) mockSolve(teams, thinkOf()); else serverSolve(Number(tolOf()), teams, thinkOf());
    });

    /** 서버 없이 열었을 때: 고른 생각 시간만큼 진행 막대 뒤 기본 결과로 이동한다 */
    function mockSolve(teams, sec) {
      const total = sec * 1000, t0 = Date.now();
      const tick = () => {
        const el = Math.min(total, Date.now() - t0), k = el / total;
        setBar(k);
        txt.textContent = (k < 0.3 ? '여러 출발점에서 동시에 만드는 중' : k < 0.7 ? '이동거리를 줄이는 중' : '구단 간 차이를 고르는 중') + ' · ' + Math.round(el / 1000) + '/' + Math.round(total / 1000) + '초';
        if (el < total) { setTimeout(tick, 250); return; }
        const p = new URLSearchParams({ id: 'default', tol: tolOf(), cd: teams.join(',') });
        location.href = 'r.html?' + p.toString();
      };
      tick();
    }

    /** 실제 편성: 프리셋 문제에 조건 2개를 덮어써 서버에 보내고, SSE로 진행을 받다가 끝나면 결과 쪽으로 간다 */
    function serverSolve(tol, teams, timeLimitSec) {
      loadPreset((e0) => {
        if (e0) { reset('편성 준비 파일을 읽지 못했어요. 새로고침 뒤 다시 해 보세요.'); return; }
        const problem = window.KBO.Preset.buildProject();
        problem.settings.distanceToleranceKm = tol;
        problem.settings.obligationTeams = teams.slice();
        // 어린이날 이벤트의 구장도 고른 구단의 홈구장으로 맞춘다(서버는 obligationTeams를, 브라우저 채점기는 구장을 본다)
        const ev = problem.events.find((x) => x.type === 'CHILDREN');
        if (ev) ev.stadiums = teams.map((n) => (problem.teams.find((t) => t.name === n) || {}).stadium).filter((s, i, a) => s && a.indexOf(s) === i);
        const options = { timeLimitSec, init: 'SCRATCH', seed: presetSeed != null ? presetSeed : Math.floor(Math.random() * 1e9) };
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/v1/solve', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = () => {
          let body = null; try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
          if (xhr.status === 429) { reset('이 인터넷 주소에서 이미 편성이 돌고 있어요. 그게 끝난 뒤 다시 눌러 주세요.'); return; }
          if (xhr.status === 400) { reset('조건을 받아들이지 못했어요' + (body && body.error ? ': ' + body.error : '.')); return; }
          if (xhr.status < 200 || xhr.status >= 300 || !body || !body.jobId) { reset('서버가 편성을 받지 못했어요(' + xhr.status + '). 잠시 뒤 다시 해 보세요.'); return; }
          follow(body.jobId, timeLimitSec, tol);
        };
        xhr.onerror = () => reset('서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 해 보세요.');
        xhr.send(JSON.stringify({ problem, options, mode: 'INITIAL' }));
      });
    }

    /** SSE: queued(대기 순번) → status(RUNNING) → best(지금까지 가장 좋은 일정) → done(id) / error */
    function follow(jobId, timeLimitSec, tol) {
      if (typeof EventSource === 'undefined') { reset('이 브라우저는 진행 상황을 받을 수 없어요. 다른 브라우저로 해 보세요.'); return; }
      const es = new EventSource('/api/v1/solve/' + encodeURIComponent(jobId) + '/events');
      let t0 = null, bestKm = null, finished = false, timer = null;
      const limit = timeLimitSec * 1000, total = ((SHOW.THINK[timeLimitSec] || {}).wait || timeLimitSec + 4) * 1000;
      // 진행 중 소식: 같은 종류는 최신 것만 남기고, 하나를 1.5초는 보여 준 뒤 다음으로 넘긴다
      let pending = [], shownAt = 0, saidFair = false, lastStep = -1;
      const say = (kind, msg) => { pending = pending.filter((p) => p.kind !== kind); pending.push({ kind, msg }); };
      const sayNext = () => { if (news && pending.length && Date.now() - shownAt >= 1500) { news.textContent = pending.shift().msg; shownAt = Date.now(); } };
      const finish = (message) => { finished = true; es.close(); clearTimeout(timer); if (message !== undefined) reset(message); };
      const running = () => {
        if (finished) return;
        const el = Date.now() - t0;
        setBar(Math.min(0.97, el / total));
        const head = bestKm != null ? '지금까지 가장 좋은 일정: ' + fmtInt(bestKm) + ' km' : (seeds ? '출발점 ' + seeds + '개에서 동시에 만드는 중' : '여러 출발점에서 동시에 만드는 중');
        txt.textContent = head + ' · ' + (el < limit ? Math.floor(el / 1000) + '/' + timeLimitSec + '초 생각' : '거의 다 됐어요');
        sayNext();
        timer = setTimeout(running, 250);
      };
      const start = () => { if (t0 == null) { t0 = Date.now(); running(); } };
      es.addEventListener('queued', (e) => {
        let pos = null; try { pos = JSON.parse(e.data).position; } catch (x) { pos = null; }
        txt.textContent = '다른 분의 편성이 끝나길 기다리는 중' + (pos ? ' · 대기 ' + pos + '번째' : '');
      });
      es.addEventListener('status', start);
      es.addEventListener('best', (e) => {
        start();
        try {
          const p = JSON.parse(e.data), s = p.score;
          // 점수의 마지막 소프트 단계가 10구단 총 이동거리(km, 음수)다. 필수 규칙 위반이 남아 있으면 아직 보여 주지 않는다
          if (s && s.hard && s.hard.every((h) => h === 0) && s.soft && s.soft.length) {
            bestKm = -s.soft[s.soft.length - 1];
            const sec = Math.max(1, Math.round((Date.now() - t0) / 1000));
            // soft[2] = 구단 간 이동거리 차이(정한 범위를 넘은 만큼, ui/core/replay-model.js LEVELS)
            if (!saidFair && s.soft.length >= 5 && s.soft[2] === 0) { saidFair = true; say('fair', sec + '초 만에 구단 간 이동거리 차이를 ±' + fmtInt(tol) + 'km 안으로 맞췄어요'); }
            // 총 이동거리: 실제보다 짧아진 순간, 그 뒤로는 2%씩 더 짧아질 때마다
            const pct = (1 - bestKm / SHOW.REAL_KM) * 100;
            const step = pct > 0 ? Math.floor(pct / 2) * 2 : -1;
            if (step > lastStep) { lastStep = step; say('km', step === 0 ? '총 이동거리가 실제 일정보다 짧아졌어요' : '총 이동거리가 실제보다 ' + step + '% 짧아졌어요 · ' + sec + '초'); }
            sayNext();
          }
        } catch (x) { /* 무시 */ }
      });
      es.addEventListener('done', (e) => {
        let p = null; try { p = JSON.parse(e.data); } catch (x) { p = null; }
        if (!p || !p.id) { finish('편성이 중간에 멈췄어요. 다시 눌러 주세요.'); return; }
        finish();
        setBar(1);
        txt.textContent = '다 짰어요. 결과로 이동해요';
        location.href = '/r/' + encodeURIComponent(p.id);
      });
      es.addEventListener('error', (e) => {
        if (finished) return;
        if (e && e.data) {
          let msg = ''; try { msg = JSON.parse(e.data).message || ''; } catch (x) { msg = ''; }
          finish('편성 중에 문제가 생겼어요' + (msg ? ': ' + msg : '.') + ' 다시 해 보세요.');
          return;
        }
        // 서버가 아무 이벤트 없이 끊었다(재시작·네트워크). 자동 재연결은 쓰지 않는다
        finish('서버와 연결이 끊겼어요. 다시 눌러 주세요.');
      });
    }
  }
  /** 「편성 시작」에서 쓸 2025 프리셋(ui/core/preset-2025.js, 약 60KB). 누를 때 한 번만 읽는다 */
  function loadPreset(cb) {
    if (window.KBO && window.KBO.Preset) { cb(null); return; }
    const s = document.createElement('script');
    s.src = '../core/preset-2025.js';
    s.onload = () => cb(window.KBO && window.KBO.Preset ? null : 'preset');
    s.onerror = () => cb('preset');
    document.head.appendChild(s);
  }

  /** 비교 쪽 구장 간 거리표: 프리셋(매치봇 입력 그대로)의 distanceMatrix를 9구장 표로. 잠실은 두산·LG 한 칸 */
  function distTable(el) {
    loadPreset((err) => {
      const inp = !err && window.KBO.Preset && window.KBO.Preset.ENGINE_INPUT_2025;
      if (!inp || !inp.distanceMatrix) { el.innerHTML = '<p class="sh-small" style="margin:0">거리표를 불러오지 못했어요.</p>'; return; }
      const d = {}; inp.distanceMatrix.forEach((x) => { d[x.from + '|' + x.to] = x.distance; });
      // 구장 하나에 구단 하나씩(잠실은 두산·LG). 순서는 SHOW.TEAMS, 이름은 연고지
      const cols = [];
      SHOW.TEAMS.forEach((n) => { const st = SHOW.STADIUMS[n]; if (!st) return; const hit = cols.find((c) => c.city === st[2]); if (hit) hit.teams.push(n); else cols.push({ city: st[2], team: n, teams: [n] }); });
      const head = '<tr><th scope="col" class="sh-dist-c">출발 ＼ 도착</th>' + cols.map((c) => '<th scope="col">' + esc(c.city) + '<small>' + esc(c.teams.join('·')) + '</small></th>').join('') + '</tr>';
      const rows = cols.map((a) => '<tr><th scope="row" class="sh-dist-c">' + esc(a.city) + '<small>' + esc(a.teams.join('·')) + '</small></th>' + cols.map((b) => { if (a === b) return '<td class="sh-dist-diag">–</td>'; const v = d[a.team + '|' + b.team]; return '<td>' + (v == null ? '–' : fmtInt(v)) + '</td>'; }).join('') + '</tr>').join('');
      el.innerHTML = '<table class="sh-dist"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>';
      checkScroll();
    });
  }

  /** 비교 /compare */
  pages.compare = function () {
    const dt = $('#dist-table'); if (dt) whenVisible(dt, () => distTable(dt));
    load(SHOW.api.compare, (err, cmp) => {
      if (err || !cmp || !cmp.real || !cmp.engine) { mark('show', 'compare-error'); checkScroll(); return; }
      const vv = view(cmp.real, cmp.engine);
      bind(vv);
      // 주말 홈 행: 더 고른 쪽을 노란 줄·태그로 표시한다
      const row = $('#row-weekend'), tag = $('#weekend-tag');
      if (row && tag && vv['diff.weekendCmp']) {
        row.classList.toggle('sh-row-real', vv['diff.weekendCmp'] === 'real');
        tag.textContent = vv['diff.weekendTag'];
        tag.className = 'sh-tag ' + (vv['diff.weekendCmp'] === 'real' ? 'sh-tag-real' : vv['diff.weekendCmp'] === 'engine' ? 'sh-tag-engine' : 'sh-tag-even');
        const realCell = $('#weekend-real-cell'), engCell = $('#weekend-engine-cell');
        if (realCell && engCell) (vv['diff.weekendCmp'] === 'real' ? realCell : engCell).appendChild(tag);
      }
      const d = $('#chart-dist'); if (d) teamBars(d, cmp.real.teams, cmp.engine.teams, 'distanceKm', { unit: ' km', label: '이동거리' });
      const w = $('#chart-weekend'); if (w) teamBars(w, cmp.real.teams, cmp.engine.teams, 'weekendHome', { unit: '회', label: '주말 홈 시리즈 수', max: Math.max(14, ...cmp.real.teams.map((t) => t.weekendHome), ...cmp.engine.teams.map((t) => t.weekendHome)) });
      if (cmp.range) bind({ 'range.from': cmp.range.from, 'range.to': cmp.range.to, 'range.slots': String(cmp.range.slots), 'range.series': String(cmp.range.series) });
      mark('show', 'compare-ok');
      checkScroll();
    });
    bindShare();
    fixStudioLinks();
  };

  /** 결과 공유 /r/<id> (r.html?id=<id>) */
  pages.r = function () {
    const id = (query.get('id') || (location.pathname.match(/\/r\/([A-Za-z0-9_-]+)/) || [])[1] || 'default').replace(/[^A-Za-z0-9_-]/g, '');
    setOg(id);
    load(SHOW.api.result(id), (err, res) => {
      if (err || !res || !res.metrics) {
        mark('show', 'result-error');
        const m = $('#result-missing'); if (m) m.hidden = false;
        const main = $('#result-main'); if (main) main.hidden = true;
        checkScroll();
        return;
      }
      // 저장된 결과의 real에는 합계만 있다. 구단별 줄(주말·공휴일 홈 비교에 필요)은 비교 API에서 채운다
      if (res.real && res.real.teams && res.real.teams.length) { render(res); return; }
      load(SHOW.api.compare, (e2, cmp) => {
        if (!e2 && cmp && cmp.real) res.real = Object.assign({}, cmp.real, res.real, { teams: cmp.real.teams });
        render(res);
      });
    });
    function render(res) {
      const real = res.real || {}, engine = res.metrics;
      const v = view(real, Object.assign({}, engine, { options: res.options, seed: res.seed, elapsedMs: res.elapsedMs, improvementCount: res.improvementCount }));
      bind(v);
      const title = knobsTitle(res.knobs) || res.title || '편성 결과';
      // 머리글은 제목(조건)을 되풀이하지 않고 결과 번호만 단다
      bind({ 'result.title': title, 'result.sub': id === 'default' ? '기본 결과' : '번호 ' + id, 'result.id': id });
      const kb = res.knobs || {};
      bind({
        'knob.tol': kb.distanceToleranceKm != null ? tolWord(kb.distanceToleranceKm) + ' (±' + fmtInt(kb.distanceToleranceKm) + 'km)' : '–',
        'knob.holiday': kb.holidayTolerance != null ? (kb.holidayTolerance <= 1 ? '똑같이 나누기' : '한두 번 차이는 괜찮게') : '–',
        'knob.cd': (kb.childrenDayHomeTeams || []).join('·') || '–',
        'knob.unavail': (kb.unavailableHomeSlots || []).length ? kb.unavailableHomeSlots.map((u) => (u.date || u.slot || '') + ' ' + (u.team || '') + (u.reason ? ' (' + u.reason + ')' : '')).join(', ') : '없음',
        'knob.run': (res.options ? (res.options.timeLimitSec || '–') + '초 · 시드 ' + (res.options.seeds || '–') + '개 동시' : '–') + (res.seed != null ? ' · 고른 시드 ' + res.seed : ''),
        'knob.improve': res.improvementCount != null ? fmtInt(res.improvementCount) + '번 개선' : '–'
      });
      document.title = title + ' — ' + SHOW.SITE;
      const ogd = (v.pct == null ? '이동거리를 비교해요' : v.pct > 0 ? '이동거리 ' + v.pct + '% 줄었어요' : v.pct === 0 ? '이동거리는 같아요' : '이동거리 ' + (-v.pct) + '% 늘었어요') + ' · ' + fmtInt(engine.totalKm) + 'km (실제 ' + fmtInt(real.totalKm) + 'km) · 구단별 이동거리 차이 ' + fmtInt(engine.spreadKm) + 'km (실제 ' + fmtInt(real.spreadKm) + 'km)';
      setMeta('og:title', title + ' — ' + SHOW.SITE); setMeta('og:description', ogd); setMeta('description', ogd);
      const tb = $('#cmp-total'); if (tb) totalBars(tb, real, engine);
      const trend = $('#weekend-note');
      if (trend && real.weekendHomeMin != null) {
        const rw2 = real.weekendHomeMax - real.weekendHomeMin, ew2 = engine.weekendHomeMax - engine.weekendHomeMin;
        trend.textContent = '홈에서 치르는 주말 3연전: KBO ' + real.weekendHomeMin + '~' + real.weekendHomeMax + '번, 매치봇 ' + engine.weekendHomeMin + '~' + engine.weekendHomeMax + '번 — ' + (ew2 > rw2 ? 'KBO 일정이 더 고르게 나뉘었어요.' : ew2 < rw2 ? '매치봇이 더 고르게 나눴어요.' : '같은 수준이에요.');
      }
      const sl = $('#studio-link');
      if (sl) sl.setAttribute('href', (isFile ? SHOW.studioHref.file : SHOW.studioHref.http) + studioQuery(kb, res.seed) + '#step=2');
      thinkBox(kb, res.options || {});
      mark('show', 'result-ok');
      const box = $('#replay-box');
      if (box) {
        const host = $('.sh-replay-host', box);
        if (res.trace && res.trace.events) {
          host.innerHTML = '';
          loadScripts(SHOW.replayScripts, (e2) => {
            if (e2) { host.innerHTML = '<div class="sh-replay-msg sh-err">' + esc(e2) + '</div>'; mark('replay', 'load-error'); checkScroll(); return; }
            const auto = query.get('autoplay') !== '0';
            try {
              const p = window.KBO.Replay.open(res.trace, { host, embedded: true, autoplay: auto, speed: 1 });
              window.replayPlayer = p;
              // 휴대폰 축소판(색 막대) ↔ 큰 판(구단 이름). 바꾼 뒤 카드 자리를 다시 잰다
              const sz = $('#replay-size');
              if (sz) sz.addEventListener('click', () => {
                const big = box.classList.toggle('sh-big');
                sz.setAttribute('aria-pressed', String(big));
                sz.textContent = big ? '앞 12칸만 보기' : '판 전체 펼치기 (45칸)';
                p.layout();
              });
              fitBoard(box, p);
              mark('replay', 'ready ' + p.model.n + ' ' + p.idx);
            } catch (e) { host.innerHTML = '<div class="sh-replay-msg sh-err">탐색 과정 형식이 맞지 않아요. ' + esc(e.message) + '</div>'; mark('replay', 'format-error'); }
            checkScroll();
          });
        } else { host.innerHTML = '<div class="sh-replay-msg">이 결과에는 탐색 과정 기록이 없어요.</div>'; mark('replay', 'none'); }
      }
      checkScroll();
    }
    bindShare();
    fixStudioLinks();
  };
  /**
   * 결과 쪽 생각 시간 상자: 다음 단계(3→10→30초)가 있으면 같은 조건·같은 출발점(options.seed, 출발점 seed+0..n-1)으로
   * 더 오래 다시 해 보기, 가장 긴 단계면 다른 출발점에서 다시 해 보기. 소개 쪽 tryForm prefill이 ?t=&tol=&cd=&seed=를 읽는다.
   */
  function thinkBox(k, opt) {
    const note = $('#think-note'), more = $('#think-more');
    if (!note || !more) return;
    const sec = opt.timeLimitSec, steps = Object.keys(SHOW.THINK).map(Number).sort((a, b) => a - b);
    const next = sec != null ? steps.find((x) => x > sec) : null;
    const p = new URLSearchParams();
    if (k.distanceToleranceKm != null) p.set('tol', String(Math.round(k.distanceToleranceKm)));
    if (k.childrenDayHomeTeams && k.childrenDayHomeTeams.length) p.set('cd', k.childrenDayHomeTeams.join(','));
    if (next) {
      p.set('t', String(next));
      if (opt.seed != null) p.set('seed', String(opt.seed));
      note.textContent = '같은 출발점에서 ' + next + '초 동안 생각하면 이동거리가 더 줄 때가 많아요. 다만 막다른 길에 들면 거의 그대로일 수도 있어요.';
      more.textContent = '더 오래(' + SHOW.THINK[next].word + ' ' + next + '초) 다시 해 보기';
    } else {
      p.set('t', String(steps[steps.length - 1]));
      note.textContent = sec != null ? '가장 오래(' + sec + '초) 생각한 결과예요. 다른 출발점에서 다시 만들면 결과가 달라질 수 있어요.' : '다른 출발점에서 다시 만들면 결과가 달라질 수 있어요.';
      more.textContent = '다른 출발점에서 다시 해 보기';
    }
    more.setAttribute('href', 'index.html?' + p.toString() + '#try');
  }
  /** 결과의 조건·시드를 위저드로 넘기는 쿼리. 위저드(app.js applyLinkSettings)가 읽어 settings에 싣는다 */
  function studioQuery(k, seed) {
    const p = new URLSearchParams();
    if (k.distanceToleranceKm != null) p.set('tol', String(k.distanceToleranceKm));
    if (k.holidayTolerance != null) p.set('hol', String(k.holidayTolerance));
    if (k.childrenDayHomeTeams && k.childrenDayHomeTeams.length) p.set('cd', k.childrenDayHomeTeams.join(','));
    if (seed != null) p.set('seed', String(seed));
    const q = p.toString();
    return q ? '?' + q : '';
  }
  /** 손잡이 값 → 일상어. 서버 JobManager.titleOf와 같은 구간 */
  function tolWord(km) { return km <= 150 ? '이동거리 거의 똑같게' : km <= 450 ? '이동거리 비슷하게' : '이동거리 달라도 괜찮게'; }
  function knobsTitle(k) {
    if (!k) return '';
    const parts = [];
    if (k.distanceToleranceKm != null) parts.push(tolWord(k.distanceToleranceKm));
    if (k.childrenDayHomeTeams && k.childrenDayHomeTeams.length) parts.push('어린이날 홈 ' + k.childrenDayHomeTeams.join('·'));
    if (k.unavailableHomeSlots && k.unavailableHomeSlots.length) parts.push('홈 불가 ' + k.unavailableHomeSlots.length + '건');
    return parts.join(' · ');
  }
  function setMeta(name, content) {
    let m = $('meta[property="' + name + '"]') || $('meta[name="' + name + '"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute(name.indexOf('og:') === 0 ? 'property' : 'name', name); document.head.appendChild(m); }
    m.setAttribute('content', content);
  }
  function setOg(id) {
    const origin = isFile ? '' : location.origin;
    setMeta('og:image', origin + '/og/' + id + '.png');
    setMeta('og:url', isFile ? location.href : location.origin + '/r/' + id);
  }

  // ───────── 시작 ─────────
  function boot() {
    const page = document.body.getAttribute('data-page');
    mark('page', page || '');
    if (pages[page]) pages[page]();
    else { bindShare(); fixStudioLinks(); }
    checkScroll();
    window.addEventListener('resize', checkScroll);
    window.addEventListener('load', checkScroll);
  }
  SHOW.load = load; SHOW.fmtInt = fmtInt; SHOW.view = view; SHOW.mountReplay = mountReplay;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
