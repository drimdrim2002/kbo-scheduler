/*
 * 화면 공통 — 앱 컨트롤러.
 * 저장소(Store) + 엔진 어댑터 + 파생 상태(채점 결과 캐시) + 화면 동작(수정·핀·이벤트·엔진 실행·재편성·기록·스냅샷).
 * 4개 대안이 같은 컨트롤러를 쓰고, 정보 구조와 주 화면만 다르게 구성한다.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const { Score, CalendarGen, Reschedule, Store, Engine, MapKit, Dates } = KBO;
  const UI = KBO.UI;

  const LS = Store.safeStorage((() => { try { return window.localStorage; } catch (e) { return null; } })());
  const ENGINE_KEY = 'kbo-opus:engine';
  const KAKAO_KEY = 'kbo-opus:kakao-key';

  function App(opts) {
    this.appId = opts.appId;
    this.appName = opts.appName || opts.appId;
    let storage = null;
    try { storage = window.localStorage; } catch (e) { storage = null; }
    this.store = new Store.Store({ storageKey: 'kbo-opus:' + opts.appId + ':v1', storage, initial: () => KBO.Preset.buildProject() });
    this.listeners = [];
    this.run = null;
    this.ui = { teamFilter: new Set(), selectedMatch: null, selectedUnit: null, month: null, focus: null, compare: [] };
    this.engineConfig = this._loadEngineConfig();
    this.engine = Engine.createEngine(this.engineConfig);
    this._probeServer();
    this.kakaoKeyLocal = LS.get(KAKAO_KEY) || ''; // 설정에 직접 넣은 키(이 브라우저)
    this.kakaoKeyEnv = ''; // 설정 파일(ui/config.local.json ← .env·서버 환경 파일)의 키
    this.kakaoKey = this.kakaoKeyLocal;
    this.kakao = null;
    this.kakaoError = null;
    this._cache = { version: -1 };
    this.navigator = null;
    this.store.subscribe((change) => this._emit(change));
    if (this.store.persistError) setTimeout(() => UI.toast('자동 저장을 쓸 수 없습니다: ' + this.store.persistError, 'warn'), 0);
  }

  App.prototype.subscribe = function (fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  };
  App.prototype._emit = function (change) {
    for (const fn of this.listeners.slice()) { try { fn(change, this); } catch (e) { console.error(e); } }
  };
  App.prototype.emitUI = function (tags, extra) {
    this._emit(Object.assign({ tags: new Set(tags || ['ui']), source: 'ui' }, extra || {}));
  };
  Object.defineProperty(App.prototype, 'state', { get() { return this.store.state; } });

  // ───────────── 파생 상태 ─────────────
  App.prototype.derived = function () {
    const c = this._cache;
    const v = this.store.version;
    if (c.version === v) return c;
    const st = this.state;
    c.version = v;
    c.teamIndex = new Map(st.teams.map((t, i) => [t.name, i]));
    c.teamByName = new Map(st.teams.map((t) => [t.name, t]));
    c.slots = st.calendar.map((s, i) => {
      const day = Dates.dayNum(s.datetime);
      const days = [];
      for (let k = 0; k < s.consecutive; k++) days.push(day + k);
      return { index: i, day, days, date: Dates.isoDate(day), consecutive: s.consecutive, weekend: s.weekend, holiday: s.holiday, label: Dates.fmtDate(day) + ' ' + s.consecutive + '연전', month: Dates.month(day) };
    });
    c.dayToSlot = new Map();
    c.slots.forEach((s) => s.days.forEach((d) => c.dayToSlot.set(d, s.index)));
    c.input = Score.buildInput(st);
    c.ctx = Score.createContext(c.input);
    c.plan = Score.planArrayFrom(st);
    c.ex = Score.explain(c.ctx, c.plan, st);
    c.bySlot = c.slots.map(() => []);
    c.pool = [];
    for (let m = 0; m < st.matches.length; m++) { const s = c.plan[m]; if (s >= 0) c.bySlot[s].push(m); else c.pool.push(m); }
    c._games = null; c._targets = null; c._rex = null; c._eventCheck = null; c._preflight = null;
    return c;
  };
  App.prototype.games = function () { const c = this.derived(); if (!c._games) c._games = Reschedule.computeGames(this.state); return c._games; };
  App.prototype.targets = function () { const c = this.derived(); if (!c._targets) c._targets = Reschedule.computeTargets(this.state, this.games()); return c._targets; };
  App.prototype.rescheduleExplain = function () {
    const c = this.derived();
    if (!c._rex) c._rex = (this.state.reschedule.units || []).length ? Reschedule.explain(this.state) : null;
    return c._rex;
  };
  App.prototype.team = function (name) { return this.derived().teamByName.get(name); };
  App.prototype.teamAt = function (i) { return this.state.teams[i]; };
  App.prototype.matchLabel = function (m) { const x = this.state.matches[m]; return x ? x.away + ' vs ' + x.home : '?'; };
  App.prototype.slotOfDate = function (date) { const s = this.derived().dayToSlot.get(Dates.dayNum(date)); return s == null ? -1 : s; };

  // ───────────── 잠금 (FR-R4) ─────────────
  App.prototype.isRunning = function () { return !!(this.run && ['STARTING', 'RUNNING', 'PAUSED'].includes(this.run.status)); };
  App.prototype.guard = function () {
    if (this.isRunning()) { UI.toast('자동 편성 중에는 입력과 일정을 바꿀 수 없습니다. 먼저 멈추세요.', 'warn'); return false; }
    return true;
  };
  App.prototype.commit = function (label, fn, tags, opts) {
    if (!(opts && opts.allowWhileRunning) && !this.guard()) return false;
    return this.store.commit(label, fn, Object.assign({ tags }, opts || {}));
  };

  // ───────────── 결과 수정 (FR-M) ─────────────
  App.prototype.moveMatch = function (m, slot) {
    const st = this.state;
    if (!st.matches[m]) return false;
    if (st.matches[m].pinned) { UI.toast('고정한 시리즈는 옮길 수 없습니다. 먼저 고정을 푸세요.', 'warn'); return false; }
    const from = this.derived().plan[m];
    if (from === slot) return false;
    return this.commit((slot < 0 ? '보관함으로: ' : '이동: ') + this.matchLabel(m), (s) => { s.plan[m].calendar = slot; }, ['plan']);
  };
  App.prototype.swapMatches = function (a, b) {
    const st = this.state;
    if (a === b) return false;
    if (st.matches[a].pinned || st.matches[b].pinned) { UI.toast('고정한 시리즈는 맞바꿀 수 없습니다.', 'warn'); return false; }
    return this.commit('교환: ' + this.matchLabel(a) + ' ↔ ' + this.matchLabel(b), (s) => {
      const t = s.plan[a].calendar; s.plan[a].calendar = s.plan[b].calendar; s.plan[b].calendar = t;
    }, ['plan']);
  };
  /** 드롭: 시리즈 위면 교환, 슬롯 위면 이동 */
  App.prototype.drop = function (m, slot, targetMatch) {
    if (targetMatch != null && targetMatch !== m) return this.swapMatches(m, targetMatch);
    return this.moveMatch(m, slot);
  };
  /** FR-M2 드롭 전 미리보기: Δ(점수) */
  App.prototype.previewDrop = function (m, slot, targetMatch) {
    const c = this.derived();
    const plan = Int32Array.from(c.plan);
    if (targetMatch != null && targetMatch !== m) { const t = plan[m]; plan[m] = plan[targetMatch]; plan[targetMatch] = t; }
    else plan[m] = slot;
    const before = Score.flat(c.ex.score);
    const after = Score.evaluate(c.ctx, plan, []);
    return { before, after, delta: after.map((v, i) => v - before[i]), hardDelta: (after[0] + after[1]) - (before[0] + before[1]) };
  };
  App.prototype.togglePin = function (m, value) {
    const cur = !!this.state.matches[m].pinned;
    const next = value == null ? !cur : !!value;
    if (cur === next) return false;
    return this.commit((next ? '고정: ' : '고정 해제: ') + this.matchLabel(m), (s) => { s.matches[m].pinned = next; }, ['pins']);
  };
  App.prototype.pinSlot = function (slot, value) {
    const ms = this.derived().bySlot[slot] || [];
    return this.commit((value ? '연전 기간 고정: ' : '연전 기간 고정 해제: ') + this.derived().slots[slot].label, (s) => { for (const m of ms) s.matches[m].pinned = !!value; }, ['pins']);
  };
  App.prototype.pinEventSeries = function (value) {
    return this.commit(value ? '특별 경기 시리즈 일괄 고정' : '특별 경기 시리즈 고정 해제', (s) => {
      for (const m of s.matches) if (m.eventId) m.pinned = !!value;
    }, ['pins']);
  };
  App.prototype.unpinAll = function () {
    return this.commit('모든 고정 해제', (s) => { for (const m of s.matches) m.pinned = false; }, ['pins']);
  };
  App.prototype.undo = function () { if (!this.guard()) return; if (!this.store.undo()) UI.toast('되돌릴 작업이 없습니다.', 'info'); };
  App.prototype.redo = function () { if (!this.guard()) return; if (!this.store.redo()) UI.toast('다시 실행할 작업이 없습니다.', 'info'); };

  // ───────────── 구단·구장 (FR-T) ─────────────
  App.prototype.sharedStadiums = function () {
    const by = new Map();
    for (const t of this.state.teams) { if (!by.has(t.stadium)) by.set(t.stadium, []); by.get(t.stadium).push(t.name); }
    const out = new Map();
    for (const [s, names] of by) if (names.length > 1) out.set(s, names);
    return out;
  };
  App.prototype._reestimate = function (s, names) {
    const rf = s.settings.roadFactor || 1.25;
    const set = new Set(names);
    const byName = new Map(s.teams.map((t) => [t.name, t]));
    const idx = new Map(s.distanceMatrix.map((d, i) => [d.from + '|' + d.to, i]));
    for (const a of s.teams) for (const b of s.teams) {
      if (!set.has(a.name) && !set.has(b.name)) continue;
      const km = a.name === b.name ? 0 : MapKit.estimateRoadKm(byName.get(a.name), byName.get(b.name), rf);
      const key = a.name + '|' + b.name;
      if (idx.has(key)) { const d = s.distanceMatrix[idx.get(key)]; d.distance = km; d.estimated = a.name !== b.name; }
      else { s.distanceMatrix.push({ from: a.name, to: b.name, distance: km, estimated: a.name !== b.name }); idx.set(key, s.distanceMatrix.length - 1); }
    }
  };
  App.prototype.updateTeam = function (i, patch) {
    const st = this.state;
    const old = st.teams[i];
    if (!old) return false;
    if (patch.name != null) {
      patch.name = String(patch.name).trim();
      if (!patch.name) { UI.toast('구단명은 비울 수 없습니다.', 'warn'); return false; }
      if (patch.name !== old.name && st.teams.some((t) => t.name === patch.name)) { UI.toast('이미 있는 구단명입니다.', 'warn'); return false; }
    }
    const locationChanged = ['stadium', 'latitude', 'longitude'].some((k) => patch[k] != null && patch[k] !== old[k]);
    return this.commit('구단 수정: ' + old.name, (s) => {
      const t = s.teams[i];
      const oldName = t.name;
      Object.assign(t, patch);
      if (patch.latitude != null) t.latitude = Number(patch.latitude);
      if (patch.longitude != null) t.longitude = Number(patch.longitude);
      if (patch.name != null && patch.name !== oldName) {
        const n = patch.name;
        for (const m of s.matches) { if (m.home === oldName) m.home = n; if (m.away === oldName) m.away = n; }
        for (const d of s.distanceMatrix) { if (d.from === oldName) d.from = n; if (d.to === oldName) d.to = n; }
        for (const e of s.events) { if (e.home === oldName) e.home = n; if (e.away === oldName) e.away = n; }
        s.settings.obligationTeams = (s.settings.obligationTeams || []).map((x) => (x === oldName ? n : x));
        for (const u of s.reschedule.units || []) { if (u.home === oldName) u.home = n; if (u.away === oldName) u.away = n; }
      }
      if (locationChanged) this._reestimate(s, [t.name]);
    }, ['teams', 'distance']);
  };
  App.prototype.addTeam = function (t) {
    const st = this.state;
    let name = (t && t.name) || '새 구단';
    let k = 2;
    while (st.teams.some((x) => x.name === name)) name = ((t && t.name) || '새 구단') + ' ' + (k++);
    return this.commit('구단 추가: ' + name, (s) => {
      s.teams.push({ index: s.teams.length, name, stadium: (t && t.stadium) || '', latitude: (t && t.latitude) || 36.35, longitude: (t && t.longitude) || 127.8, color: (t && t.color) || '#5f3dc4' });
      this._reestimate(s, [name]);
    }, ['teams', 'distance']);
  };
  App.prototype.removeTeam = function (i) {
    const st = this.state;
    const name = st.teams[i] && st.teams[i].name;
    if (!name) return false;
    return this.commit('구단 삭제: ' + name, (s) => {
      s.teams.splice(i, 1);
      s.teams.forEach((t, k) => { t.index = k; });
      s.distanceMatrix = s.distanceMatrix.filter((d) => d.from !== name && d.to !== name);
      s.events = s.events.filter((e) => e.home !== name && e.away !== name);
      s.settings.obligationTeams = (s.settings.obligationTeams || []).filter((x) => x !== name);
      // 시리즈 인덱스가 바뀌므로 시리즈·배정·경기 기록을 비운다(시리즈 재생성 필요)
      s.matches = []; s.plan = []; s.games = []; s.reschedule.units = []; s.reschedule.plan = [];
    }, ['teams', 'distance', 'matches', 'plan', 'events', 'games']);
  };
  App.prototype.setDistance = function (from, to, km, symmetric) {
    const v = Number(km);
    if (!Number.isFinite(v) || v < 0) { UI.toast('거리는 0 이상의 숫자여야 합니다.', 'warn'); return false; }
    return this.commit('거리 수정: ' + from + ' → ' + to, (s) => {
      const put = (a, b) => {
        const d = s.distanceMatrix.find((x) => x.from === a && x.to === b);
        if (d) { d.distance = Math.round(v * 10) / 10; d.estimated = false; } else s.distanceMatrix.push({ from: a, to: b, distance: Math.round(v * 10) / 10, estimated: false });
      };
      put(from, to);
      if (symmetric) put(to, from);
    }, ['distance']);
  };
  App.prototype.estimateMissingDistances = function () {
    const st = this.state;
    const have = new Set(st.distanceMatrix.map((d) => d.from + '|' + d.to));
    const missing = [];
    for (const a of st.teams) for (const b of st.teams) if (!have.has(a.name + '|' + b.name)) missing.push([a, b]);
    if (!missing.length) { UI.toast('누락된 거리가 없습니다.', 'ok'); return false; }
    return this.commit('누락 거리 추정 ' + missing.length + '건', (s) => {
      const rf = s.settings.roadFactor || 1.25;
      for (const [a, b] of missing) s.distanceMatrix.push({ from: a.name, to: b.name, distance: a.name === b.name ? 0 : MapKit.estimateRoadKm(a, b, rf), estimated: a.name !== b.name });
    }, ['distance']);
  };
  App.prototype.distanceOf = function (from, to) {
    const d = this.state.distanceMatrix.find((x) => x.from === from && x.to === to);
    return d || null;
  };

  // ───────────── 지도 검색 (FR-T2, T3) ─────────────
  App.prototype.setKakaoKey = function (key) {
    this.kakaoKeyLocal = String(key || '').trim();
    if (this.kakaoKeyLocal) LS.set(KAKAO_KEY, this.kakaoKeyLocal); else LS.remove(KAKAO_KEY);
    this.kakaoKey = this.kakaoKeyLocal || this.kakaoKeyEnv; // 비우면 설정 파일의 키로 돌아간다
    this.kakao = null; this.kakaoError = null;
    this.emitUI(['map']);
    if (this.kakaoKey) this.ensureKakao();
  };
  /**
   * 설정 파일(ui/config.local.json, scripts/ui-config.sh 가 .env·서버 환경 파일로 만든다)의 카카오 키를 읽는다.
   * 파일이 없거나(커밋하지 않음) file:// 이면 조용히 넘어간다. 설정에 직접 넣은 키가 있으면 그 키가 먼저다.
   */
  App.prototype.loadLocalConfig = function (url) {
    if (typeof fetch !== 'function' || (window.location && window.location.protocol === 'file:')) return Promise.resolve(null);
    return fetch(url || 'config.local.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((cfg) => {
      const key = cfg && typeof cfg.kakaoKey === 'string' ? cfg.kakaoKey.trim() : '';
      if (!key || key === this.kakaoKeyEnv) return cfg;
      this.kakaoKeyEnv = key;
      if (!this.kakaoKeyLocal) { this.kakaoKey = key; this.kakao = null; this.kakaoError = null; this.emitUI(['map']); this.ensureKakao(); }
      return cfg;
    });
  };
  App.prototype.ensureKakao = function () {
    if (!this.kakaoKey) return Promise.resolve(null);
    if (this.kakao) return Promise.resolve(this.kakao);
    if (this._kakaoPromise) return this._kakaoPromise;
    this._kakaoPromise = MapKit.loadKakao(this.kakaoKey, document, window).then((k) => { this.kakao = k; this.kakaoError = null; this._kakaoPromise = null; this.emitUI(['map']); return k; })
      .catch((e) => { this.kakao = null; this.kakaoError = e.message; this._kakaoPromise = null; UI.toast(e.message + ' — 기본 지도로 바꿉니다.', 'warn', 6000); this.emitUI(['map']); return null; });
    return this._kakaoPromise;
  };
  /** 구장 검색: Kakao가 준비되어 있으면 Kakao, 아니면(또는 실패 시) 내장 사전 */
  App.prototype.searchPlace = function (query) {
    const dict = () => MapKit.searchStadiums(query);
    if (!this.kakaoKey) return Promise.resolve({ source: 'DICT', results: dict() });
    return this.ensureKakao().then((k) => {
      if (!k) return { source: 'DICT', results: dict(), note: this.kakaoError };
      return MapKit.kakaoSearch(k, query).then((r) => ({ source: 'KAKAO', results: r.length ? r : dict(), note: r.length ? '' : '카카오 결과 없음 → 기본 구장 목록' }))
        .catch((e) => ({ source: 'DICT', results: dict(), note: e.message }));
    });
  };

  // ───────────── 일정 설정 (FR-S) ─────────────
  App.prototype.updateSettings = function (patch, label) {
    return this.commit(label || '일정 설정 변경', (s) => { Object.assign(s.settings, patch); }, ['settings']);
  };
  App.prototype.updateSolverSettings = function (patch) {
    return this.store.commit('자동 편성 옵션 변경', (s) => { Object.assign(s.settings.solver, patch); }, { tags: ['settings'], undo: false });
  };
  /**
   * 결과 공유 쪽 「스튜디오에서 이어서 다듬기」 링크의 쿼리(?tol=&hol=&cd=&seed=)를 settings에 싣는다.
   * 어린이날 홈 구단은 CHILDREN 이벤트의 구장도 함께 바꾼다(브라우저 채점기 구장 기준 모드가 이벤트 구장을 본다).
   * 실은 항목을 돌려준다(없으면 null).
   */
  App.prototype.applyLinkSettings = function (search) {
    const q = new URLSearchParams(search || '');
    const st = this.state;
    const tol = Number(q.get('tol')), hol = Number(q.get('hol')), seed = parseInt(q.get('seed'), 10);
    const teams = (q.get('cd') || '').split(',').map((x) => x.trim()).filter((x) => x && st.teams.some((t) => t.name === x));
    const patch = {};
    if (tol > 0) patch.distanceToleranceKm = tol;
    if (hol > 0) patch.holidayTolerance = hol;
    if (teams.length && teams.length === Math.floor(st.teams.length / 2) && new Set(teams).size === teams.length) patch.obligationTeams = teams;
    if (!Object.keys(patch).length && isNaN(seed)) return null;
    this.store.commit('공유 링크 조건 적용', (s) => {
      Object.assign(s.settings, patch);
      if (!isNaN(seed)) s.settings.solver.seed = seed;
      if (patch.obligationTeams) {
        const ev = (s.events || []).find((e) => e.type === 'CHILDREN');
        if (ev) ev.stadiums = patch.obligationTeams.map((n) => (s.teams.find((t) => t.name === n) || {}).stadium).filter((x, i, a) => x && a.indexOf(x) === i);
      }
    }, { undo: false, tags: ['settings', 'events'] });
    return Object.assign({}, patch, isNaN(seed) ? {} : { seed });
  };
  /** 설정으로 생성할 슬롯과 현재 슬롯이 다른가 */
  App.prototype.slotsOutOfDate = function () {
    const gen = CalendarGen.generateSlots(this.state.settings).slots;
    const cur = this.state.calendar;
    if (gen.length !== cur.length) return true;
    return gen.some((g, i) => g.datetime !== cur[i].datetime || g.consecutive !== cur[i].consecutive || g.weekend !== cur[i].weekend || g.holiday !== cur[i].holiday);
  };
  App.prototype.regenerateSlots = function () {
    const st = this.state;
    const gen = CalendarGen.generateSlots(st.settings);
    const oldCal = st.calendar;
    const map = new Map(gen.slots.map((s, i) => [s.datetime + '|' + s.consecutive, i]));
    const ok = this.commit('연전 기간 자동 생성 (' + gen.slots.length + '개)', (s) => {
      s.calendar = gen.slots;
      s.plan.forEach((p) => {
        if (p.calendar < 0) return;
        const o = oldCal[p.calendar];
        const n = o ? map.get(o.datetime + '|' + o.consecutive) : undefined;
        p.calendar = n == null ? -1 : n;
      });
      for (const e of s.events) { const idx = Score.resolveEventSlot(e, s.calendar); e.slot = idx; }
    }, ['calendar', 'plan', 'events']);
    if (ok && gen.warnings.length) UI.toast(gen.warnings[0].message, 'warn', 6000);
    return ok;
  };
  App.prototype.updateSlot = function (i, patch) {
    return this.commit('연전 기간 수정: ' + this.derived().slots[i].label, (s) => {
      const c = s.calendar[i];
      for (const k of ['consecutive', 'weekend', 'holiday']) if (patch[k] != null) c[k] = Math.max(0, parseInt(patch[k], 10) || 0);
      if (c.consecutive < 1) c.consecutive = 1;
    }, ['calendar']);
  };
  App.prototype.generateSeriesPreview = function () {
    const st = this.state;
    return CalendarGen.generateSeries(st.teams, st.calendar, { initialGamesPerPair: st.settings.initialGamesPerPair, homeGamesMajor: st.settings.homeGamesMajor });
  };
  App.prototype.regenerateSeries = function () {
    const g = this.generateSeriesPreview();
    if (g.errors.length) { UI.toast(g.errors[0], 'bad', 7000); return false; }
    const ok = this.commit('시리즈 자동 생성 (' + g.matches.length + '개)', (s) => {
      s.matches = g.matches.map((m) => Object.assign({ pinned: false }, m));
      s.plan = g.plan.map((c, m) => ({ match: m, calendar: c }));
      s.games = []; s.reschedule.units = []; s.reschedule.plan = [];
    }, ['matches', 'plan', 'games']);
    if (ok) { this.applyEvents({ silent: true, label: '특별 경기 대진 고정' }); if (g.warnings.length) UI.toast(g.warnings[0], 'warn'); }
    return ok;
  };
  App.prototype.loadPreset = function () {
    if (!this.guard()) return false;
    const v = this.store.replace(KBO.Preset.buildProject(), '2025 실제 일정 불러오기');
    if (v.ok) UI.toast('2025 실제 일정을 불러왔습니다.', 'ok');
    return v.ok;
  };

  // ───────────── 이벤트 (FR-E) ─────────────
  App.prototype.addEvent = function (ev) {
    const id = 'ev-' + Date.now().toString(36);
    return this.commit('특별 경기 추가: ' + (ev.name || ''), (s) => {
      const e = Object.assign({ id, type: 'CUSTOM', name: '사용자 지정 경기', mode: 'MATCH' }, ev, { id });
      e.slot = Score.resolveEventSlot(e, s.calendar);
      s.events.push(e);
    }, ['events']) && id;
  };
  App.prototype.updateEvent = function (id, patch) {
    return this.commit('특별 경기 수정', (s) => {
      const e = s.events.find((x) => x.id === id);
      if (!e) return false;
      Object.assign(e, patch);
      if (patch.date != null || patch.slot != null) e.slot = Score.resolveEventSlot(e, s.calendar);
      if (e.mode === 'STADIUM') { delete e.home; delete e.away; e.stadiums = e.stadiums || []; } else delete e.stadiums;
    }, ['events']);
  };
  App.prototype.removeEvent = function (id) {
    return this.commit('특별 경기 삭제', (s) => {
      s.events = s.events.filter((x) => x.id !== id);
      for (const m of s.matches) if (m.eventId === id) { delete m.eventId; m.pinned = false; }
    }, ['events', 'pins']);
  };
  /** FR-E5 이벤트 모순 검사 + FR-E2 대진 존재 검사 */
  App.prototype.checkEvents = function () {
    const c = this.derived();
    if (c._eventCheck) return c._eventCheck;
    const st = this.state;
    const issues = [];
    const bySlot = new Map();
    for (const e of st.events) {
      const s = Score.resolveEventSlot(e, st.calendar);
      if (s < 0) { issues.push({ level: 'warn', events: [e.id], message: e.name + ': ' + (e.date ? Dates.fmtDate(e.date) : '날짜 미지정') + '이(가) 어느 연전 기간에도 속하지 않습니다.' }); continue; }
      if (!bySlot.has(s)) bySlot.set(s, []);
      bySlot.get(s).push(e);
      if (e.mode === 'MATCH') {
        if (!c.teamByName.has(e.home) || !c.teamByName.has(e.away) || e.home === e.away) { issues.push({ level: 'block', events: [e.id], message: e.name + ': 홈·원정 구단이 올바르지 않습니다.' }); continue; }
        const cands = st.matches.filter((m) => m.home === e.home && m.away === e.away);
        if (!cands.length) issues.push({ level: 'warn', events: [e.id], message: e.name + ': ' + e.away + ' vs ' + e.home + ' 시리즈가 목록에 없습니다(홈/원정 조합 확인).' });
        else if (!cands.some((m) => m.consecutive === st.calendar[s].consecutive)) issues.push({ level: 'warn', events: [e.id], message: e.name + ': ' + st.calendar[s].consecutive + '연전 ' + e.away + ' vs ' + e.home + ' 시리즈가 없습니다(연전 수 불일치).' });
      } else {
        const unknown = (e.stadiums || []).filter((x) => !st.teams.some((t) => t.stadium === x));
        if (unknown.length) issues.push({ level: 'warn', events: [e.id], message: e.name + ': 연고 구단이 없는 구장 ' + unknown.join(', ') });
        if (!(e.stadiums || []).length) issues.push({ level: 'warn', events: [e.id], message: e.name + ': 지정한 구장이 없습니다.' });
      }
    }
    const half = st.teams.length >> 1;
    for (const [s, evs] of bySlot) {
      const label = c.slots[s] ? c.slots[s].label : '연전 기간 ' + (s + 1);
      const matchEvs = evs.filter((e) => e.mode === 'MATCH');
      const seen = new Map();
      for (const e of matchEvs) for (const t of [e.home, e.away]) {
        if (seen.has(t)) issues.push({ level: 'block', events: [seen.get(t), e.id], message: label + ': ' + t + '이(가) 대진 지정 두 곳에 등장합니다.' });
        else seen.set(t, e.id);
      }
      const stad = new Map();
      for (const e of matchEvs) {
        const st0 = (c.teamByName.get(e.home) || {}).stadium;
        if (stad.has(st0)) issues.push({ level: 'block', events: [stad.get(st0), e.id], message: label + ': ' + st0 + ' 구장을 두 대진이 함께 씁니다.' });
        else stad.set(st0, e.id);
      }
      if (matchEvs.length > half) issues.push({ level: 'block', events: matchEvs.map((e) => e.id), message: label + ': 대진 지정이 한 기간에 들어갈 시리즈 수(' + half + ')보다 많습니다.' });
      const designated = new Set();
      for (const e of evs.filter((x) => x.mode === 'STADIUM')) {
        for (const x of e.stadiums || []) {
          if (designated.has(x)) issues.push({ level: 'warn', events: [e.id], message: label + ': ' + x + ' 구장이 여러 특별 경기에 지정되었습니다.' });
          designated.add(x);
          const owners = st.teams.filter((t) => t.stadium === x).map((t) => t.name);
          const conflict = matchEvs.find((me) => owners.includes(me.away) && !matchEvs.some((o) => owners.includes(o.home)));
          if (conflict && owners.every((o) => matchEvs.some((me) => me.away === o))) {
            issues.push({ level: 'block', events: [e.id, conflict.id], message: label + ': 구장 지정(' + x + ')과 대진 지정(' + conflict.away + ' vs ' + conflict.home + ')이 충돌합니다 — 연고 구단이 모두 원정입니다.' });
          }
        }
      }
      if (designated.size > half) issues.push({ level: 'block', events: evs.map((e) => e.id), message: label + ': 지정 구장 수(' + designated.size + ')가 한 기간에 쓸 수 있는 구장 수(' + half + ')보다 많습니다.' });
    }
    c._eventCheck = issues;
    return issues;
  };
  /** FR-E2 대진 지정 이벤트를 슬롯에 고정 */
  App.prototype.applyEvents = function (opts) {
    const o = opts || {};
    const st = this.state;
    const notes = [];
    const ok = this.commit(o.label || '특별 경기 대진 고정', (s) => {
      for (const e of s.events) {
        if (e.mode !== 'MATCH') continue;
        const slot = Score.resolveEventSlot(e, s.calendar);
        if (slot < 0) continue;
        const L = s.calendar[slot].consecutive;
        const cands = s.matches.map((m, i) => i).filter((i) => s.matches[i].home === e.home && s.matches[i].away === e.away);
        if (!cands.length) { notes.push(e.name + ': ' + e.away + ' vs ' + e.home + ' 시리즈 없음'); continue; }
        let m = cands.find((i) => s.plan[i].calendar === slot);
        if (m == null) m = cands.find((i) => s.matches[i].consecutive === L && !s.matches[i].pinned);
        if (m == null) m = cands.find((i) => !s.matches[i].pinned);
        if (m == null) continue;
        const from = s.plan[m].calendar;
        if (from !== slot) {
          // 대상 슬롯에서 두 구단 중 하나가 걸린 비고정 시리즈를 원래 자리로 보낸다
          for (let n = 0; n < s.matches.length; n++) {
            if (n === m || s.plan[n].calendar !== slot || s.matches[n].pinned) continue;
            const mm = s.matches[n];
            if ([mm.home, mm.away].some((t) => t === e.home || t === e.away)) { s.plan[n].calendar = from; break; }
          }
          s.plan[m].calendar = slot;
        }
        s.matches[m].pinned = true;
        s.matches[m].eventId = e.id;
      }
    }, ['plan', 'pins']);
    if (!o.silent) UI.toast(notes.length ? '일부 특별 경기를 고정하지 못했습니다: ' + notes.join(', ') : '대진 지정 특별 경기를 고정했습니다.', notes.length ? 'warn' : 'ok', 5000);
    return ok;
  };

  // ───────────── 사전 점검 (FR-R2) ─────────────
  App.prototype.preflight = function () {
    const c = this.derived();
    if (c._preflight) return c._preflight;
    const st = this.state;
    const N = st.teams.length;
    const half = N >> 1;
    const items = [];
    const add = (id, status, title, detail, target) => items.push({ id, status, title, detail, target });
    add('teams-even', N % 2 === 0 && N >= 2 ? 'pass' : 'block', '구단 수 짝수', '현재 ' + N + '개 구단' + (N % 2 ? ' — 연전 기간마다 한 구단이 쉬게 되어 편성할 수 없습니다.' : ''), 'teams');
    if (N !== 10 && N % 2 === 0) add('teams-10', 'warn', '서버 자동 편성 설정', '구단 수가 10이 아니면 서버 자동 편성 설정도 함께 바꿔야 합니다. 이 화면은 ' + N + '개 구단 기준으로 채점합니다.', 'teams');
    const shared = this.sharedStadiums();
    add('shared', 'pass', '같이 쓰는 구장', shared.size ? Array.from(shared).map(([s, n]) => s + '(' + n.join('·') + ')').join(', ') : '없음', 'teams');
    const have = new Set(st.distanceMatrix.map((d) => d.from + '|' + d.to));
    let missing = 0, estimated = 0;
    for (const a of st.teams) for (const b of st.teams) if (a.name !== b.name && !have.has(a.name + '|' + b.name)) missing++;
    for (const d of st.distanceMatrix) if (d.estimated) estimated++;
    add('distance', missing ? 'block' : estimated ? 'warn' : 'pass', '구장 간 거리', missing ? '누락 ' + missing + '개 — 이동거리를 계산할 수 없습니다.' : estimated ? '추정 거리 ' + estimated + '개(직선거리 × 도로계수). 실제 도로거리로 바꾸면 정확해집니다.' : N * (N - 1) + '개 모두 입력됨', 'distance');
    add('slots', st.calendar.length ? 'pass' : 'block', '연전 기간', st.calendar.length + '개' + (this.slotsOutOfDate() ? ' — 시즌 기본 설정과 다릅니다(규칙대로 다시 채울지 확인)' : ''), 'slots');
    if (st.calendar.length && this.slotsOutOfDate()) items[items.length - 1].status = 'warn';
    const singles = st.calendar.filter((x) => x.consecutive === 1).length;
    if (singles) add('single', 'warn', '1연전 기간', singles + '개 — 1연전 시리즈가 없으면 비게 됩니다.', 'slots');
    const sh = CalendarGen.lengthHistogram(st.calendar), mh = CalendarGen.lengthHistogram(st.matches);
    const lens = Array.from(new Set(Object.keys(sh).concat(Object.keys(mh)))).map(Number).sort();
    for (const k of lens) {
      const series = mh[k] || 0, cap = (sh[k] || 0) * half;
      if (series > cap) add('cap-' + k, 'block', k + '연전 자리', '시리즈 ' + series + '개 > ' + k + '연전 기간 ' + (sh[k] || 0) + '개 × ' + half + ' = ' + cap + ' — 일정 미정 시리즈나 넘치는 기간이 생깁니다.', 'series');
      else if (series < cap) add('cap-' + k, 'warn', k + '연전 자리', '시리즈 ' + series + '개 < 자리 ' + cap + ' — 빈 자리는 추가 휴식이며 감점 없음.', 'series');
      else add('cap-' + k, 'pass', k + '연전 자리', '시리즈 ' + series + '개 = ' + k + '연전 기간 ' + (sh[k] || 0) + '개 × ' + half, 'series');
    }
    if (!st.matches.length) add('matches', 'block', '시리즈 목록', '시리즈가 없습니다. 시리즈를 자동 생성하세요.', 'series');
    // 공유 구장(잠실 두산·LG): 같은 날 두 구단이 모두 홈일 수 없으므로 홈 k연전 수가 k연전 슬롯 수를 넘으면 편성할 수 없다
    for (const [stadium, names] of this.sharedStadiums()) {
      const byLen = {};
      for (const m of st.matches) if (names.includes(m.home)) byLen[m.consecutive] = (byLen[m.consecutive] || 0) + 1;
      const over = Object.keys(byLen).map(Number).filter((k) => byLen[k] > (sh[k] || 0));
      const detail = Object.keys(byLen).map(Number).sort().map((k) => k + '연전 홈 ' + byLen[k] + '개 / 기간 ' + (sh[k] || 0) + '개').join(', ');
      if (over.length) add('shared-' + stadium, 'block', '같이 쓰는 구장 자리', stadium + ' — ' + detail + '. ' + names.join('·') + '가 같은 날 홈이 되는 시리즈가 생겨 편성할 수 없습니다.', 'series');
      else add('shared-' + stadium, 'pass', '같이 쓰는 구장 자리', stadium + ' — ' + detail, 'series');
    }
    // 구단쌍 경기 수
    const pair = new Map();
    for (const m of st.matches) { const k = [m.home, m.away].sort().join('|'); pair.set(k, (pair.get(k) || 0) + m.consecutive); }
    const G = st.settings.initialGamesPerPair;
    const off = Array.from(pair.values()).filter((v) => v !== G).length + Math.max(0, N * (N - 1) / 2 - pair.size);
    add('pairs', off ? 'warn' : 'pass', '맞대결 경기 수', off ? off + '개 맞대결이 ' + G + '경기가 아닙니다.' : '모든 맞대결 ' + G + '경기', 'series');
    const ev = this.checkEvents();
    const blocks = ev.filter((x) => x.level === 'block'), warns = ev.filter((x) => x.level === 'warn');
    add('events', blocks.length ? 'block' : warns.length ? 'warn' : 'pass', '특별 경기 충돌', blocks.length + warns.length ? ev.map((x) => x.message).join(' / ') : st.events.length + '개 모두 충돌 없음', 'events');
    const pinMis = st.matches.filter((m, i) => m.pinned && c.plan[i] >= 0 && m.consecutive !== st.calendar[c.plan[i]].consecutive).length;
    if (pinMis) add('pins', 'warn', '고정 시리즈 연전 불일치', pinMis + '개 고정 시리즈가 연전 수가 다른 기간에 있습니다(연전 수 불일치 위반이 남음).', 'result');
    const st0 = { block: 0, warn: 0, pass: 0 };
    for (const it of items) st0[it.status]++;
    c._preflight = { items, counts: st0, ok: st0.block === 0 };
    return c._preflight;
  };

  // ───────────── 엔진 실행 (FR-R3, R4, V1) ─────────────
  App.prototype._loadEngineConfig = function () {
    try { const v = JSON.parse(LS.get(ENGINE_KEY) || 'null'); if (v && (v.kind === 'MOCK' || v.kind === 'REST')) return v; } catch (e) { /* 무시 */ }
    return { kind: 'MOCK', baseUrl: 'http://localhost:8080' };
  };
  /** 서버(BaseballWebServer)가 UI를 내주고 있으면, 사용자가 따로 고르기 전까지 같은 출처의 REST 엔진을 쓴다. */
  App.prototype._probeServer = function () {
    if (LS.get(ENGINE_KEY)) return;
    if (typeof fetch !== 'function' || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
    fetch('/api/v1/info', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((info) => {
      if (!info || info.name !== 'kbo-scheduler' || LS.get(ENGINE_KEY)) return;
      this.engineConfig = { kind: 'REST', baseUrl: '', auto: true, info };
      this.engine = Engine.createEngine(this.engineConfig);
      this.emitUI(['run']);
    }).catch(() => { /* 서버 없음: Mock 유지 */ });
  };
  App.prototype.setEngineConfig = function (cfg) {
    if (!this.guard()) return;
    this.engineConfig = Object.assign({}, this.engineConfig, cfg);
    LS.set(ENGINE_KEY, JSON.stringify(this.engineConfig));
    this.engine = Engine.createEngine(this.engineConfig);
    this.emitUI(['run']);
  };
  App.prototype.solve = function (opts) {
    const o = opts || {};
    if (this.isRunning()) return false;
    const mode = o.mode || 'INITIAL';
    const st = this.state;
    if (mode === 'INITIAL') {
      const pf = this.preflight();
      if (!pf.ok && !o.force) { UI.toast('사전 점검에 진행 불가 항목이 있어 실행할 수 없습니다.', 'bad'); this.nav('review'); return false; }
      this.applyEvents({ silent: true, label: '자동 편성 전 특별 경기 고정' });
    } else if (!(st.reschedule.units || []).length) { UI.toast('재편성 대상 묶음이 없습니다. 먼저 대상을 계산하세요.', 'warn'); return false; }
    const solverOpts = Object.assign({}, st.settings.solver, o, { mode });
    this.store.checkpoint(mode === 'INITIAL' ? '자동 편성' : '재편성 실행');
    const handle = this.engine.solve(this.state, solverOpts);
    const run = this.run = { mode, status: 'STARTING', handle, history: [], startedAt: Date.now(), elapsedMs: 0, improvements: 0, iterations: 0, transport: null, reason: null, score: null, engineLabel: this.engine.label };
    handle.on('status', (s) => { run.status = s; run.transport = handle.transport || run.transport; this.emitUI(['run']); });
    handle.on('best', (p) => this._applyBest(run, p));
    handle.on('done', (p) => {
      this._applyBest(run, p);
      run.status = 'DONE'; run.reason = p.reason;
      if (p.trace) run.trace = p.trace; // 서버 엔진의 탐색 트레이스(§4.2 재생용)
      const why = { TIME_LIMIT: '최대 실행 시간 도달', UNIMPROVED: '개선 없음 종료', STOPPED: '사용자 중지' }[p.reason] || p.reason;
      if (!o.quiet) UI.toast('자동 편성 끝 (' + why + ') — ' + (window.Studio && window.Studio.dev() ? Score.scoreString(p.score) : Score.isFeasible(p.score) ? '필수 규칙 모두 지킴' : '필수 규칙 위반 남음'), Score.isFeasible(p.score) ? 'ok' : 'warn', 5000);
      this.emitUI(['run']);
    });
    handle.on('error', (e) => { run.status = 'ERROR'; run.reason = e.message; if (!o.quiet) UI.toast('자동 편성 오류: ' + e.message, 'bad', 7000); this.emitUI(['run']); });
    this.emitUI(['run']);
    return true;
  };
  App.prototype._applyBest = function (run, p) {
    if (this.run !== run) return;
    run.elapsedMs = p.elapsedMs; run.improvements = p.improvementCount; run.iterations = p.iterations || run.iterations; run.score = p.score;
    run.transport = run.handle.transport || run.transport;
    const flat = Score.flat(p.score);
    run.history.push({ t: p.elapsedMs, score: flat });
    if (run.history.length > 400) run.history.splice(1, 1);
    this.store.commit(run.mode === 'INITIAL' ? '자동 편성 결과' : '재편성 결과', (s) => {
      if (run.mode === 'INITIAL') s.plan = p.plan.map((x) => ({ match: x.match, calendar: x.calendar }));
      else s.reschedule.plan = p.plan;
    }, { undo: false, tags: run.mode === 'INITIAL' ? ['plan', 'live'] : ['reschedule', 'live'] });
  };
  App.prototype.pause = function () { if (this.run) this.run.handle.pause(); };
  App.prototype.resume = function () { if (this.run) this.run.handle.resume(); };
  App.prototype.stop = function () { if (this.run) this.run.handle.stop(); };
  App.prototype.setH0eMode = function (mode) {
    return this.store.commit('H0-e 모드: ' + (mode === 'ENGINE' ? '엔진 호환' : '구장 기준'), (s) => { s.settings.h0eMode = mode; }, { tags: ['settings', 'plan'] });
  };

  // ───────────── 경기 기록·재편성 (FR-P) ─────────────
  App.prototype.setGameStatus = function (game, status, reason) {
    return this.commit('경기 기록: ' + Dates.fmtDate(game.date) + ' ' + game.away + ' vs ' + game.home, (s) => { Reschedule.setGameStatus(s, game, status, reason); }, ['games']);
  };
  App.prototype.setDayStatus = function (date, status, reason) {
    const list = this.games().filter((g) => g.date === date);
    if (!list.length) return false;
    return this.commit('일괄 기록: ' + Dates.fmtDate(date) + ' ' + list.length + '경기', (s) => { for (const g of list) Reschedule.setGameStatus(s, g, status, reason); }, ['games']);
  };
  App.prototype.referenceDate = function () {
    const r = this.state.settings.referenceDate;
    return r && /^\d{4}-\d{2}-\d{2}$/.test(r) ? r : Dates.isoDate(Math.floor(Date.now() / Dates.DAY_MS));
  };
  /** FR-P2 결과 미입력: 기준일 이전 예정 경기 */
  App.prototype.overdueGames = function () {
    const ref = this.referenceDate();
    return this.games().filter((g) => g.status === 'SCHEDULED' && g.date < ref);
  };
  App.prototype.buildRescheduleUnits = function () {
    const t = this.targets();
    const units = Reschedule.buildUnits(t);
    return this.commit('재편성 대상 확정 (' + units.reduce((s, u) => s + u.games, 0) + '경기)', (s) => {
      const keep = new Map((s.reschedule.plan || []).map((p) => [p.unit, p]));
      const prevUnits = new Map((s.reschedule.units || []).map((u) => [u.id, u]));
      s.reschedule.units = units;
      s.reschedule.plan = units.map((u) => { const p = keep.get(u.id); const pu = prevUnits.get(u.id); return p && pu && pu.games === u.games ? p : { unit: u.id, start: null, dh: false }; });
    }, ['reschedule']);
  };
  App.prototype.updateReschedule = function (patch) {
    return this.commit('재편성 옵션 변경', (s) => { Object.assign(s.reschedule, patch); }, ['reschedule']);
  };
  App.prototype.moveUnit = function (unitId, start, dh) {
    return this.commit('재편성 묶음 이동: ' + unitId, (s) => {
      let p = s.reschedule.plan.find((x) => x.unit === unitId);
      if (!p) { p = { unit: unitId, start: null, dh: false }; s.reschedule.plan.push(p); }
      p.start = start || null;
      if (dh != null) p.dh = !!dh;
    }, ['reschedule']);
  };
  App.prototype.clearReschedulePlan = function () {
    return this.commit('재편성 배치 비우기', (s) => { s.reschedule.plan = (s.reschedule.units || []).map((u) => ({ unit: u.id, start: null, dh: false })); }, ['reschedule']);
  };

  // ───────────── 스냅샷 (FR-M7, Q4) ─────────────
  App.prototype.saveSnapshot = function (name) {
    const ex = this.derived().ex;
    const snap = this.store.addSnapshot(name, { score: Score.scoreString(ex.score), feasible: ex.feasible, h0eMode: this.state.settings.h0eMode });
    UI.toast('중간 저장: ' + snap.name, 'ok');
    return snap;
  };
  App.prototype.restoreSnapshot = function (id) {
    if (!this.guard()) return false;
    const r = this.store.restoreSnapshot(id);
    if (r && r.ok === false) UI.toast(r.error, 'bad');
    else UI.toast('중간 저장으로 되돌렸습니다.', 'ok');
    return r;
  };
  /** 스냅샷 배정을 현재 입력으로 채점 */
  App.prototype.explainSnapshot = function (id) {
    const c = this.derived();
    if (id === 'current') return c.ex;
    const snap = this.state.snapshots.find((x) => x.id === id);
    if (!snap || snap.matchCount !== this.state.matches.length) return null;
    const plan = new Int32Array(this.state.matches.length).fill(-1);
    for (const p of snap.plan) if (p.match < plan.length) plan[p.match] = p.calendar == null ? -1 : p.calendar;
    return Score.explain(c.ctx, plan, this.state);
  };

  // ───────────── 입출력 (FR-D) ─────────────
  App.prototype.fileBase = function () { return 'kbo-' + (this.state.meta.season || '') + '-' + this.appId; };
  App.prototype.exportProject = function () { UI.download(this.fileBase() + '-project.json', this.store.exportProject()); };
  App.prototype.exportEngine = function () { UI.download(this.fileBase() + '-engine-input.json', Store.exportEngine(this.state)); };
  App.prototype.exportCSV = function (team) { UI.download(this.fileBase() + (team ? '-' + team : '') + '-schedule.csv', Store.exportCSV(this.state, team), 'text/csv;charset=utf-8'); };
  App.prototype.importFile = function () {
    if (!this.guard()) return Promise.resolve(false);
    return UI.pickFile('.json,application/json').then((f) => {
      if (!f) return false;
      let obj;
      try { obj = JSON.parse(f.text); } catch (e) { UI.dialog({ title: '가져오기 실패', body: '<p>JSON 구문 오류: ' + UI.esc(e.message) + '</p>' }); return false; }
      const v = this.store.replace(obj, '가져오기: ' + f.name);
      if (!v.ok) {
        UI.dialog({ title: '가져오기 실패 — 필드 오류 ' + v.errors.length + '건', wide: true, body: '<ul class="k-errlist">' + v.errors.slice(0, 60).map((e) => '<li><code>' + UI.esc(e.path) + '</code> ' + UI.esc(e.message) + '</li>').join('') + '</ul>' + (v.errors.length > 60 ? '<p>… 외 ' + (v.errors.length - 60) + '건</p>' : '') });
        return false;
      }
      UI.toast((v.format === 'ENGINE' ? '엔진 입력' : '프로젝트') + ' 가져오기 완료' + (v.warnings.length ? ' — ' + v.warnings.join(' ') : ''), 'ok', 5000);
      return true;
    });
  };

  // ───────────── 탐색 (화면 이동) ─────────────
  App.prototype.setNavigator = function (fn) { this.navigator = fn; };
  App.prototype.nav = function (target, detail) { if (this.navigator) this.navigator(target, detail); };
  /** 위반·항목 클릭 → 해당 위치로 이동 */
  App.prototype.focus = function (f) { this.ui.focus = f; this.emitUI(['focus'], { focus: f }); };
  App.prototype.setTeamFilter = function (names) { this.ui.teamFilter = new Set(names); this.emitUI(['filter']); };
  App.prototype.toggleTeamFilter = function (name) { const f = new Set(this.ui.teamFilter); if (f.has(name)) f.delete(name); else f.add(name); this.setTeamFilter(Array.from(f)); };
  App.prototype.selectMatch = function (m) { this.ui.selectedMatch = m; this.emitUI(['select']); };

  /** 단축키: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z(또는 Y), Esc(선택 해제) */
  App.prototype.bindShortcuts = function () {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); }
      else if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); }
      else if (e.key === 'Escape' && this.ui.selectedMatch != null) { this.selectMatch(null); }
    });
  };

  KBO.App = App;
})();
