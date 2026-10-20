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
  SHOW.replayScripts = ['../core/replay-model.js', '../app/replay/replay.js'];
  SHOW.studioHref = { file: '../index.html', http: '/studio/' }; // 위저드 주소 (D7: 서버에서는 /studio/)
  SHOW.PREVIEW_MS = 15000;      // 소개 쪽 미리보기 재생 시간
  SHOW.MOCK_SOLVE_MS = 10000;   // 「편성 시작」 목업 진행 시간
  SHOW.TEAMS = ['SSG', '두산', 'LG', 'KT', '키움', '한화', '삼성', 'KIA', 'NC', '롯데'];
  SHOW.SITE = 'KBO 일정 편성 플레이그라운드';

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
  const findTeam = (teams, name) => (teams || []).find((t) => t.name === name);
  const spread = (teams, key) => { const xs = teams.map((t) => t[key]).filter((x) => typeof x === 'number'); return xs.length ? Math.max(...xs) - Math.min(...xs) : null; };

  /** 실제·엔진 지표(같은 모양)에서 화면에 쓰는 문자열 묶음을 만든다. */
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
    v['msg.total'] = pct == null ? '이동거리를 비교해요' : pct > 0 ? '이동거리를 ' + pct + '% 줄였어요' : pct === 0 ? '이동거리는 같아요' : '이동거리가 ' + (-pct) + '% 늘었어요';
    v['msg.fair'] = ratio == null ? '구단별 이동거리를 비교해요' : ratio < 0.6 ? '구단별 이동거리가 훨씬 공정해졌어요' : ratio < 0.9 ? '구단별 이동거리가 더 공정해졌어요' : ratio <= 1.1 ? '구단별 이동거리는 비슷하게 공정해요' : '구단별 이동거리는 실제가 더 공정해요';
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
      v['diff.weekendWord'] = ew > rw ? '실제 일정이 더 고릅니다' : (ew < rw ? '엔진이 더 고릅니다' : '같은 수준입니다');
      v['diff.weekendTag'] = ew > rw ? '실제가 더 고름' : (ew < rw ? '엔진이 고름' : '같음');
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
    el.innerHTML = row('실제', real.totalKm, 'sh-bar-real') + row('엔진', engine.totalKm, 'sh-bar-engine');
    el.setAttribute('aria-label', '10구단 총 이동거리: 실제 ' + fmtInt(real.totalKm) + 'km, 엔진 ' + fmtInt(engine.totalKm) + 'km');
  }
  /** 구단별 작은 막대(실제·엔진 2줄 × 10구단) */
  function teamBars(el, realTeams, engineTeams, key, opts) {
    const o = Object.assign({ unit: '', fmt: fmtInt, max: null }, opts || {});
    const names = SHOW.TEAMS.filter((n) => findTeam(engineTeams, n) || findTeam(realTeams, n));
    const all = [];
    names.forEach((n) => { const a = findTeam(realTeams, n), b = findTeam(engineTeams, n); if (a) all.push(a[key]); if (b) all.push(b[key]); });
    const max = o.max || Math.max(...all) || 1;
    const bar = (t, cls) => '<div class="sh-bar ' + cls + '" style="width:' + (t ? (t[key] / max * 100).toFixed(1) : 0) + '%"></div>';
    el.innerHTML = names.map((n) => {
      const a = findTeam(realTeams, n), b = findTeam(engineTeams, n);
      const title = n + ' — 실제 ' + (a ? o.fmt(a[key]) + o.unit : '–') + ', 엔진 ' + (b ? o.fmt(b[key]) + o.unit : '–');
      return '<div class="sh-team" title="' + esc(title) + '"><span class="sh-team-name">' + esc(n) + '</span><div class="sh-team-bars">' + bar(a, 'sh-bar-real') + bar(b, 'sh-bar-engine') + '</div>' +
        '<span class="sh-team-val">' + (a ? o.fmt(a[key]) : '–') + ' → <b>' + (b ? o.fmt(b[key]) : '–') + '</b>' + esc(o.unit) + '</span></div>';
    }).join('');
    el.setAttribute('aria-label', '구단별 ' + (o.label || key) + ' (실제 → 엔진): ' + names.map((n) => { const a = findTeam(realTeams, n), b = findTeam(engineTeams, n); return n + ' ' + (a ? o.fmt(a[key]) : '–') + ' → ' + (b ? o.fmt(b[key]) : '–'); }).join(', '));
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
        host.innerHTML = '';
        let p;
        try {
          p = window.KBO.Replay.open(trace, { host, embedded: true, autoplay: o.autoplay !== false, speed: o.preview ? 2 : 1 });
        } catch (e) { fail('탐색 과정 형식이 맞지 않아요. ' + e.message); return; }
        if (o.preview) preview(box, p);
        mark('replay', 'ready ' + p.model.n + ' ' + p.idx);
        checkScroll();
        if (cb) cb(null, p);
      });
    }));
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
  function shareUrl() { return location.href.replace(/[?&]replay=now/, '').replace(/#.*$/, ''); }
  function shareText() { return document.title; }
  SHOW.share = function (kind) {
    const url = shareUrl(), text = shareText();
    if (kind === 'copy') { copyText(url, (ok) => toast(ok ? '링크를 복사했어요' : '복사가 막혀 있어요. 주소창의 주소를 직접 복사해 주세요')); return; }
    if (kind === 'x') { window.open('https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank', 'noopener'); return; }
    if (kind === 'threads') { window.open('https://www.threads.net/intent/post?text=' + encodeURIComponent(text + ' ' + url), '_blank', 'noopener'); return; }
    if (kind === 'kakao') {
      // 카카오 SDK 없이: 모바일 공유 시트가 있으면 그것(카카오톡 선택 가능), 없으면 링크 복사로 대체.
      if (navigator.share) { navigator.share({ title: text, url }).catch(() => { /* 취소 */ }); return; }
      copyText(url, (ok) => toast(ok ? '링크를 복사했어요. 카카오톡 대화창에 붙여 넣어 보내세요' : '복사가 막혀 있어요. 주소를 직접 복사해 카카오톡에 붙여 넣어 주세요'));
    }
  };
  function bindShare() {
    $$('[data-share]').forEach((b) => b.addEventListener('click', () => SHOW.share(b.getAttribute('data-share'))));
    const u = $('.sh-share-url'); if (u) u.textContent = shareUrl();
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
      const tb = $('#cmp-total'); if (tb) totalBars(tb, cmp.real, cmp.engine);
      const tt = $('#cmp-teams'); if (tt) teamBars(tt, cmp.real.teams, cmp.engine.teams, 'distanceKm', { unit: ' km', label: '이동거리' });
      mark('show', 'compare-ok');
      checkScroll();
    });
    const box = $('#replay-box');
    if (box) mountReplay(box, SHOW.api.result('default'), { preview: true });
    tryForm();
    bindShare();
    fixStudioLinks();
  };

  /** ④ 직접 해보기 — 손잡이 2개 + 목업 진행(서버 연결 전) */
  function tryForm() {
    const form = $('#try-form'); if (!form) return;
    const tolOf = () => { const r = $('input[name="tol"]:checked', form); return r ? r.value : '300'; };
    const boxes = $$('input[name="cd"]', form), count = $('#cd-count');
    const MAXSEL = 5;
    function refresh() {
      const n = boxes.filter((b) => b.checked).length;
      boxes.forEach((b) => { b.disabled = !b.checked && n >= MAXSEL; });
      if (count) count.textContent = n + '/' + MAXSEL;
      form.querySelector('[type="submit"]').disabled = n !== MAXSEL;
      const help = $('#cd-help'); if (help) help.textContent = n === MAXSEL ? '5개 구단이 어린이날 홈에서 경기해요. 바꾸려면 하나를 풀고 다른 구단을 고르세요.' : (MAXSEL - n) + '개 더 고르세요. 어린이날에는 꼭 5개 구단이 홈이어야 해요.';
    }
    boxes.forEach((b) => b.addEventListener('change', refresh));
    refresh();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (form.classList.contains('sh-running')) return;
      form.classList.add('sh-running');
      const btn = form.querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = '편성 중…';
      const prog = $('#try-progress'), bar = $('#try-bar'), txt = $('#try-txt');
      prog.hidden = false;
      const total = SHOW.MOCK_SOLVE_MS, t0 = Date.now();
      const teams = boxes.filter((b) => b.checked).map((b) => b.value);
      const tick = () => {
        const el = Math.min(total, Date.now() - t0), k = el / total;
        bar.style.width = (k * 100).toFixed(1) + '%';
        prog.setAttribute('aria-valuenow', String(Math.round(k * 100)));
        txt.textContent = (k < 0.3 ? '시드 8개로 동시에 짜는 중' : k < 0.7 ? '이동거리를 줄이는 중' : '구단 간 차이를 고르는 중') + ' · ' + Math.round(el / 1000) + '/' + Math.round(total / 1000) + '초';
        if (el < total) { setTimeout(tick, 250); return; }
        // 서버 연결 뒤: POST /api/v1/solve → SSE → /r/<id>. 지금은 기본 결과로 이동한다(목업).
        const p = new URLSearchParams({ id: 'default', tol: tolOf(), cd: teams.join(',') });
        location.href = 'r.html?' + p.toString();
      };
      tick();
    });
  }

  /** 비교 /compare */
  pages.compare = function () {
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
      const real = res.real || {}, engine = res.metrics;
      const v = view(real, Object.assign({}, engine, { options: res.options, seed: res.seed, elapsedMs: res.elapsedMs, improvementCount: res.improvementCount }));
      bind(v);
      const title = knobsTitle(res.knobs) || res.title || '편성 결과';
      bind({ 'result.title': title, 'result.sub': res.title || '', 'result.id': id });
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
      const ogd = '총 이동거리 ' + fmtInt(engine.totalKm) + 'km (실제 ' + fmtInt(real.totalKm) + 'km, ' + v['diff.totalKmPct'] + '% ' + v['diff.totalKmWord'] + ') · 구단 간 차이 ' + fmtInt(engine.spreadKm) + 'km (실제 ' + fmtInt(real.spreadKm) + 'km)';
      setMeta('og:title', title + ' — ' + SHOW.SITE); setMeta('og:description', ogd); setMeta('description', ogd);
      const tb = $('#cmp-total'); if (tb) totalBars(tb, real, engine);
      const trend = $('#weekend-note');
      if (trend && real.weekendHomeMin != null) {
        const rw2 = real.weekendHomeMax - real.weekendHomeMin, ew2 = engine.weekendHomeMax - engine.weekendHomeMin;
        trend.textContent = '주말 홈 경기 수: 실제 ' + real.weekendHomeMin + '~' + real.weekendHomeMax + '회, 이 결과 ' + engine.weekendHomeMin + '~' + engine.weekendHomeMax + '회 — ' + (ew2 > rw2 ? '실제 일정이 더 고릅니다.' : ew2 < rw2 ? '이 결과가 더 고릅니다.' : '같은 수준입니다.');
      }
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
              mark('replay', 'ready ' + p.model.n + ' ' + p.idx);
            } catch (e) { host.innerHTML = '<div class="sh-replay-msg sh-err">탐색 과정 형식이 맞지 않아요. ' + esc(e.message) + '</div>'; mark('replay', 'format-error'); }
            checkScroll();
          });
        } else { host.innerHTML = '<div class="sh-replay-msg">이 결과에는 탐색 과정 기록이 없어요.</div>'; mark('replay', 'none'); }
      }
      checkScroll();
    });
    bindShare();
    fixStudioLinks();
  };
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
