/*
 * 탐색 과정 재생기 — DOM 렌더 (제품 정의서 §4.2).
 * 왼쪽 일정판(슬롯 격자 + 시리즈 카드 이동 애니메이션), 오른쪽 점수 곡선(소프트 단계별), 아래 해설 한 줄과 컨트롤.
 * 상태 계산은 core/replay-model.js(KBO.ReplayModel)가 하고, 여기서는 그리기만 한다. 외부 라이브러리 없음.
 *
 *   KBO.Replay.open(trace, { host, embedded, autoplay, speed, t }) → player
 *   KBO.Replay.load(url, cb)  /  KBO.Replay.boot()  (replay.html?src=<json url>&t=<초>&autoplay=0&speed=2)
 */
(function () {
  'use strict';
  const KBO = window.KBO || (window.KBO = {});
  const M = KBO.ReplayModel;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtInt = M.fmtInt;
  /** 스튜디오 개발자 모드일 때만 시드 등 엔진 표기를 보인다(단독 replay.html은 늘 보인다). */
  const dev = () => !!(window.Studio && window.Studio.dev && window.Studio.dev());
  const fmtClock = (ms) => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fmtDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return iso || '';
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return (+m[2]) + '/' + (+m[3]) + ' ' + '일월화수목금토'[d.getUTCDay()];
  };
  const P = {
    first: '<path d="M4.2 3.5v9" stroke="currentColor" stroke-width="1.8"/><path d="M12.5 3.5L6.5 8l6 4.5z" fill="currentColor"/>',
    back: '<path d="M11 3.5L5.5 8l5.5 4.5z" fill="currentColor"/>',
    play: '<path d="M5 3.2v9.6L12.6 8z" fill="currentColor"/>',
    pause: '<path d="M5.2 3.5v9M10.8 3.5v9" stroke="currentColor" stroke-width="2"/>',
    fwd: '<path d="M5 3.5L10.5 8 5 12.5z" fill="currentColor"/>',
    x: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.6"/>'
  };
  const icon = (n) => '<svg class="rp-i" viewBox="0 0 16 16" aria-hidden="true">' + P[n] + '</svg>';
  const SPEEDS = [0.5, 1, 2];
  const HOT_MS = 900;

  function Player(trace, opts) {
    this.o = Object.assign({ embedded: false, autoplay: true, speed: 1, t: 0 }, opts || {});
    this.trace = trace;
    this.model = M.build(trace);
    this.t = 0; this.idx = 0; this.playing = false; this.speed = SPEEDS.includes(this.o.speed) ? this.o.speed : 1;
    this.geo = []; this.scales = []; this.hot = []; this._hotTimer = null; this._raf = 0;
    this.el = document.createElement('div');
    this.el.className = 'rp' + (this.o.embedded ? ' rp-embedded' : '');
    this.el.tabIndex = 0;
    this.el.setAttribute('aria-label', '편성 과정 다시 보기');
    this.el.innerHTML = this.html();
    this.q = (s) => this.el.querySelector(s);
    this.buildCards();
    this.bind();
    this._onResize = () => { if (this.el.isConnected) this.layout(); };
    window.addEventListener('resize', this._onResize);
    if (this.o.host) this.attach(this.o.host);
  }

  Player.prototype.html = function () {
    const m = this.model;
    const lastMs = m.n ? m.states[m.n].elapsedMs : 0;
    const meta = (m.seed != null && (!this.o.embedded || dev()) ? '시드 ' + esc(m.seed) + ' · ' : '') + m.n + '번 나아짐 · 실제 ' + (lastMs / 1000).toFixed(1) + '초 → ' + Math.round(m.durationMs / 1000) + '초로 늘려 보기';
    const legend = m.teams.map((t) => '<span class="rp-chip"><i style="background:' + m.teamColor(t.index) + '"></i>' + esc(t.name) + '</span>').join('');
    const slots = m.slots.map((s, i) => '<div class="rp-slot' + (s.weekend ? ' wk' : '') + '" data-s="' + i + '" title="' + esc(s.start) + '"><div class="rp-slot-h"><span>' + esc(fmtDate(s.start)) + '</span><span class="rp-g">' + s.games + '연전</span></div></div>').join('');
    const levels = m.states[0].soft.map((_, l) => {
      const L = M.LEVELS[l] || { label: '공정성 ' + (l + 1), unit: '' };
      return '<div class="rp-lv" data-l="' + l + '"><div class="rp-lv-h"><span class="rp-lv-name">' + esc(L.label) + '</span><span class="rp-lv-val"></span></div><svg class="rp-lv-svg" role="img" aria-label="' + esc(L.label) + ' 추이"></svg></div>';
    }).join('');
    const dur = Math.round(m.durationMs / 1000);
    const axis = [0, 0.25, 0.5, 0.75, 1].map((k) => '<span>' + Math.round(dur * k) + '초</span>').join('');
    return (this.o.embedded ? '' :
      '<header class="rp-top"><div class="rp-brand"><span class="rp-mark">KBO</span><b>편성 과정 다시 보기</b></div><span class="rp-meta">' + meta + '</span>' +
      '<a class="rp-link" href="index.html">편성 스튜디오로</a></header>') +
      '<div class="rp-main">' +
      '<section class="rp-board-wrap"><div class="rp-board-h"><b>편성 보드</b><span class="rp-muted">연전 기간 ' + m.slots.length + '개 · 카드 1장 = 시리즈 1개, 색은 홈 구단</span><span class="rp-pool" hidden></span><span class="rp-legend">' + legend + '</span></div>' +
      '<div class="rp-board"><div class="rp-grid">' + slots + '</div><div class="rp-cards"></div></div></section>' +
      '<aside class="rp-score"><div class="rp-score-h"><b>점수 변화</b><span class="rp-muted">' + (this.o.embedded ? meta : '재생 시간에 따른 공정성·이동 부담') + '</span></div><div class="rp-levels">' + levels + '</div><div class="rp-axis">' + axis + '</div></aside>' +
      '</div>' +
      '<div class="rp-cap" aria-live="polite"></div>' +
      '<div class="rp-ctrl">' +
      '<button class="rp-btn" data-rp="first" title="처음으로">' + icon('first') + '</button>' +
      '<button class="rp-btn" data-rp="back" title="한 단계 뒤">' + icon('back') + '</button>' +
      '<button class="rp-btn rp-play" data-rp="toggle" aria-label="재생">' + icon('play') + '<span>재생</span></button>' +
      '<button class="rp-btn" data-rp="fwd" title="한 단계 앞">' + icon('fwd') + '</button>' +
      '<span class="rp-spd" role="group" aria-label="재생 속도">' + SPEEDS.map((v) => '<button class="rp-btn' + (v === this.speed ? ' on' : '') + '" data-rp="speed" data-v="' + v + '" aria-pressed="' + (v === this.speed) + '">' + v + '×</button>').join('') + '</span>' +
      '<input type="range" class="rp-range" min="0" max="' + m.durationMs + '" step="50" value="0" aria-label="재생 위치">' +
      '<span class="rp-time"><b class="rp-now">0:00</b> / ' + fmtClock(m.durationMs) + ' · 나아짐 <b class="rp-ev">0</b>/' + m.n + '</span>' +
      '</div>';
  };

  Player.prototype.buildCards = function () {
    const m = this.model, layer = this.q('.rp-cards');
    this.cards = m.series.map((s) => {
      const home = m.teams[s.home], away = m.teams[s.away];
      const d = document.createElement('div');
      d.className = 'rp-card';
      d.style.setProperty('--c', m.teamColor(s.home));
      d.innerHTML = '<b>' + esc(home ? home.name : s.home) + '</b><span>vs ' + esc(away ? away.name : s.away) + '</span>';
      layer.appendChild(d);
      return d;
    });
  };

  /** 호스트에 붙이고(또는 다시 붙이고) 배치한다. 모달이 다시 그려져도 같은 플레이어를 이어 쓴다. */
  Player.prototype.attach = function (host) {
    if (this.el.parentNode !== host) host.appendChild(this.el);
    this.layout();
    this.applyState(this.model.indexAt(this.t), false);
    this.update();
    return this;
  };

  Player.prototype.layout = function () {
    const board = this.q('.rp-board');
    const b = board.getBoundingClientRect();
    if (!b.width) return;
    this.geo = Array.from(board.querySelectorAll('.rp-slot')).map((cell) => {
      const r = cell.getBoundingClientRect(), h = cell.firstElementChild.getBoundingClientRect();
      return { x: r.left - b.left + 3, y: h.bottom - b.top + 2, w: Math.max(20, r.width - 6), h: Math.max(10, r.bottom - h.bottom - 4) };
    });
    const rows = this.model.perSlot, gap = 2;
    this.gap = gap;
    this.cardH = this.geo.length ? Math.max(11, Math.min(24, Math.floor((this.geo[0].h - (rows - 1) * gap) / rows))) : 18;
    this.el.classList.toggle('rp-tight', this.cardH < 16);
    this.el.classList.add('rp-nomotion');
    this.place(this.idx);
    this.el.getBoundingClientRect();
    this.el.classList.remove('rp-nomotion');
    this.drawCharts();
  };

  /** 상태 i의 배정대로 카드를 놓는다(transform). 미배정 카드는 숨기고 머리글에 수를 적는다. */
  Player.prototype.place = function (i) {
    const st = this.model.states[i];
    let pool = 0;
    for (let k = 0; k < this.cards.length; k++) {
      const a = st.assign[k], card = this.cards[k];
      if (a < 0 || !this.geo[a]) { card.hidden = true; pool++; continue; }
      const g = this.geo[a], row = st.row[k];
      card.hidden = false;
      card.style.width = g.w + 'px'; card.style.height = this.cardH + 'px';
      card.style.transform = 'translate(' + g.x + 'px,' + (g.y + row * (this.cardH + this.gap)) + 'px)';
      card.title = fmtDate(this.model.slots[a].start) + ' 연전 기간';
    }
    const pe = this.q('.rp-pool');
    pe.hidden = !pool; pe.textContent = pool ? '일정 미정 ' + pool + '개' : '';
  };

  Player.prototype.applyState = function (i, animate) {
    this.idx = i;
    if (!animate) this.el.classList.add('rp-nomotion');
    this.place(i);
    if (!animate) { this.el.getBoundingClientRect(); this.el.classList.remove('rp-nomotion'); }
    for (const c of this.hot) c.classList.remove('rp-hot');
    this.hot = [];
    clearTimeout(this._hotTimer);
    if (animate) {
      for (const k of this.model.states[i].changed) { this.cards[k].classList.add('rp-hot'); this.hot.push(this.cards[k]); }
      this._hotTimer = setTimeout(() => { for (const c of this.hot) c.classList.remove('rp-hot'); this.hot = []; }, HOT_MS);
    }
  };

  // ───────── 점수 곡선 ─────────
  Player.prototype.drawCharts = function () {
    const m = this.model, total = M.LEVELS.length - 1;
    this.scales = [];
    this.el.querySelectorAll('.rp-lv').forEach((box) => {
      const l = +box.dataset.l, svg = box.querySelector('svg');
      const W = Math.max(40, svg.clientWidth || box.clientWidth), H = Math.max(24, svg.clientHeight || 40);
      svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      const vals = m.states.map((s) => s.soft[l] || 0);
      const max = Math.max(...vals), min = Math.min(...vals);
      let lo = l === total ? min - Math.max(1, (max - min) * 0.15) : 0;
      let hi = max + Math.max(1, (max - lo) * 0.08);
      if (hi <= lo) hi = lo + 1;
      const padL = 4, padR = 6, padT = 4, padB = 3;
      const x = (t) => padL + (W - padL - padR) * Math.min(1, Math.max(0, t / m.durationMs));
      const y = (v) => padT + (H - padT - padB) * (hi - v) / (hi - lo);
      this.scales[l] = { x, y, vals };
      let d = 'M' + x(0).toFixed(1) + ' ' + y(vals[0]).toFixed(1);
      for (let i = 1; i <= m.n; i++) d += 'H' + x(m.times[i]).toFixed(1) + 'V' + y(vals[i]).toFixed(1);
      d += 'H' + x(m.durationMs).toFixed(1);
      const base = (H - padB).toFixed(1);
      const area = d + 'V' + base + 'H' + x(0).toFixed(1) + 'Z';
      const gridY = [y(hi), y((hi + lo) / 2), y(lo)];
      svg.innerHTML =
        gridY.map((gy) => '<line class="rp-gl" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/>').join('') +
        '<path class="rp-area" d="' + area + '"/><path class="rp-line" d="' + d + '"/>' +
        '<text class="rp-tick" x="' + (W - padR) + '" y="' + (padT + 8) + '" text-anchor="end">' + esc(fmtInt(max)) + '</text>' +
        '<text class="rp-tick" x="' + (W - padR) + '" y="' + (H - padB - 2) + '" text-anchor="end">' + esc(fmtInt(l === total ? min : 0)) + '</text>' +
        '<g class="rp-cur"><line y1="' + padT + '" y2="' + (H - padB) + '"/><circle r="3.5"/></g>';
    });
    this.updateCursor();
  };

  Player.prototype.updateCursor = function () {
    const m = this.model, st = m.states[this.idx];
    this.el.querySelectorAll('.rp-lv').forEach((box) => {
      const l = +box.dataset.l, sc = this.scales[l];
      const L = M.LEVELS[l] || { unit: '' };
      const v = st.soft[l] || 0, v0 = m.states[0].soft[l] || 0;
      box.querySelector('.rp-lv-val').innerHTML = '<b>' + esc(fmtInt(v)) + esc(L.unit) + '</b>' + (this.idx ? '<small>시작 ' + esc(fmtInt(v0)) + '</small>' : '');
      box.classList.toggle('zero', v === 0 && l !== M.LEVELS.length - 1);
      if (!sc) return;
      const cur = box.querySelector('.rp-cur');
      if (!cur) return;
      const cx = sc.x(this.t).toFixed(1), cy = sc.y(v).toFixed(1);
      const line = cur.firstElementChild, dot = cur.lastElementChild;
      line.setAttribute('x1', cx); line.setAttribute('x2', cx);
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
    });
  };

  // ───────── 재생 ─────────
  Player.prototype.setTime = function (ms, opts) {
    const o = opts || {};
    const m = this.model;
    this.t = Math.max(0, Math.min(m.durationMs, ms));
    const i = m.indexAt(this.t);
    if (i !== this.idx) this.applyState(i, o.animate !== false && Math.abs(i - this.idx) === 1);
    this.update();
  };
  Player.prototype.update = function () {
    const m = this.model;
    const cap = m.captions[this.idx];
    const k = cap.indexOf(' · ');
    this.q('.rp-cap').innerHTML = k > 0 ? '<b>' + esc(cap.slice(0, k)) + '</b>' + esc(cap.slice(k)) : '<b>' + esc(cap) + '</b>';
    const range = this.q('.rp-range');
    if (document.activeElement !== range || !this._scrubbing) range.value = String(Math.round(this.t));
    this.q('.rp-now').textContent = fmtClock(this.t);
    this.q('.rp-ev').textContent = String(this.idx);
    const btn = this.q('.rp-play');
    btn.innerHTML = icon(this.playing ? 'pause' : 'play') + '<span>' + (this.playing ? '일시정지' : (this.t >= m.durationMs ? '다시 재생' : '재생')) + '</span>';
    btn.setAttribute('aria-label', this.playing ? '일시정지' : '재생');
    this.q('[data-rp="back"]').disabled = this.idx <= 0;
    this.q('[data-rp="fwd"]').disabled = this.idx >= m.n;
    this.el.classList.toggle('rp-playing', this.playing);
    this.updateCursor();
  };
  Player.prototype.tick = function (now) {
    this._raf = 0;
    if (!this.playing) return;
    if (!this.el.isConnected) { this.pause(); return; }
    const dt = Math.min(200, now - this._last);
    this._last = now;
    this.setTime(this.t + dt * this.speed, { animate: true });
    if (this.t >= this.model.durationMs) { this.playing = false; this.update(); return; }
    this._raf = requestAnimationFrame((n) => this.tick(n));
  };
  Player.prototype.play = function () {
    if (this.playing) return;
    if (this.t >= this.model.durationMs) this.setTime(0, { animate: false });
    this.playing = true;
    this._last = performance.now();
    this.update();
    if (!this._raf) this._raf = requestAnimationFrame((n) => this.tick(n));
  };
  Player.prototype.pause = function () { this.playing = false; if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } this.update(); };
  Player.prototype.toggle = function () { if (this.playing) this.pause(); else this.play(); };
  Player.prototype.stepFwd = function () { if (this.playing) this.pause(); if (this.idx < this.model.n) this.setTime(this.model.times[this.idx + 1], { animate: true }); };
  Player.prototype.stepBack = function () { if (this.playing) this.pause(); if (this.idx > 0) this.setTime(this.model.times[this.idx - 1], { animate: true }); };
  Player.prototype.restart = function () { this.setTime(0, { animate: false }); if (this.playing) this._last = performance.now(); };
  Player.prototype.setSpeed = function (v) {
    this.speed = SPEEDS.includes(v) ? v : 1;
    this.el.querySelectorAll('[data-rp="speed"]').forEach((b) => { const on = +b.dataset.v === this.speed; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  };

  Player.prototype.bind = function () {
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rp]');
      if (!b || !this.el.contains(b)) return;
      const act = b.dataset.rp;
      if (act === 'toggle') this.toggle();
      else if (act === 'first') this.restart();
      else if (act === 'back') this.stepBack();
      else if (act === 'fwd') this.stepFwd();
      else if (act === 'speed') this.setSpeed(+b.dataset.v);
      else if (act === 'close' && this.o.onClose) this.o.onClose();
    });
    const range = this.q('.rp-range');
    range.addEventListener('pointerdown', () => { this._scrubbing = true; this._wasPlaying = this.playing; if (this.playing) this.pause(); });
    range.addEventListener('input', () => { this.setTime(+range.value, { animate: false }); });
    const endScrub = () => { if (!this._scrubbing) return; this._scrubbing = false; if (this._wasPlaying) this.play(); };
    range.addEventListener('pointerup', endScrub);
    range.addEventListener('change', () => { this.setTime(+range.value, { animate: false }); endScrub(); });
    this.el.addEventListener('keydown', (e) => {
      if (e.target !== this.el && e.target.tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.stepFwd(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.stepBack(); }
      else if (e.key === 'Home') { e.preventDefault(); this.restart(); }
    });
  };

  Player.prototype.destroy = function () {
    this.pause();
    clearTimeout(this._hotTimer);
    window.removeEventListener('resize', this._onResize);
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  };

  // ───────── 공개 API ─────────
  function open(trace, opts) {
    const o = opts || {};
    const p = new Player(trace, o);
    if (o.t > 0) p.setTime(o.t, { animate: false });
    if (o.autoplay !== false && !(o.t > 0)) p.play();
    return p;
  }

  /** JSON 트레이스 읽기. file://에서도 되도록 XMLHttpRequest를 쓴다(fetch는 file 스킴을 거부한다). */
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

  /** 독립 페이지 점검용: 페이지 스크롤 여부를 <html data-scroll>에 적는다(스튜디오 S.checkScroll과 같은 형식). */
  function checkScroll() {
    const de = document.documentElement;
    const w = window.innerWidth, h = window.innerHeight;
    const sw = Math.max(de.scrollWidth, document.body.scrollWidth), sh = Math.max(de.scrollHeight, document.body.scrollHeight);
    const ok = !(sw > w + 1 || sh > h + 1);
    de.setAttribute('data-scroll', (ok ? 'OK' : 'SCROLL') + ' ' + w + 'x' + h + ' doc ' + sw + 'x' + sh);
    return ok;
  }

  /** replay.html 진입점 */
  function boot() {
    const q = new URLSearchParams(location.search);
    const src = q.get('src') || 'core/trace-sample.json';
    const host = document.getElementById('replay');
    if (!host) return;
    host.innerHTML = '<div class="rp-msg">트레이스를 불러오는 중…</div>';
    load(src, (err, trace) => {
      if (err) {
        host.innerHTML = '<div class="rp-msg rp-err"><b>트레이스를 불러올 수 없습니다.</b><br>' + esc(err) + '<br><small>replay.html?src=&lt;trace.json 주소&gt; 형식으로 열거나, 편성 서버(scripts/run-server.sh)에서 http로 여세요.</small></div>';
        document.documentElement.setAttribute('data-replay', 'load-error');
        checkScroll();
        return;
      }
      host.innerHTML = '';
      const t = parseFloat(q.get('t'));
      let p;
      try {
        p = open(trace, { host, autoplay: q.get('autoplay') !== '0' && !(t >= 0), speed: parseFloat(q.get('speed')) || 1, t: t >= 0 ? t * 1000 : 0 });
      } catch (e) {
        host.innerHTML = '<div class="rp-msg rp-err"><b>트레이스 형식이 맞지 않습니다.</b><br>' + esc(e.message) + '</div>';
        document.documentElement.setAttribute('data-replay', 'format-error');
        checkScroll();
        return;
      }
      window.replayPlayer = p;
      document.documentElement.setAttribute('data-replay', 'ready ' + p.model.n + ' ' + p.idx);
      try { p.el.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
      checkScroll();
      window.addEventListener('resize', checkScroll);
    });
  }

  KBO.Replay = { open, load, boot, checkScroll, Player, SPEEDS };
})();
