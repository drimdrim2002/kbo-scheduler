/*
 * KBO 공통 코어 — 상태 저장소.
 * 상태(§8 프로젝트 JSON), undo/redo, 스냅샷, localStorage 자동 저장, JSON/CSV 입출력, 가져오기 검증.
 * DOM에 의존하지 않는다. storage는 주입받는다(브라우저에서는 window.localStorage).
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).store = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const UNDO_LIMIT = 100;
  const WORKING_KEYS = ['meta', 'teams', 'distanceMatrix', 'settings', 'events', 'calendar', 'matches', 'plan', 'games', 'reschedule'];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function safeStorage(storage) {
    return {
      get(key) { try { return storage ? storage.getItem(key) : null; } catch (e) { return null; } },
      set(key, value) { try { if (!storage) return { ok: false, error: '저장소 없음' }; storage.setItem(key, value); return { ok: true }; } catch (e) { return { ok: false, error: (e && e.name === 'QuotaExceededError') ? '저장 용량 초과' : '저장 실패: ' + (e && e.message || e) }; } },
      remove(key) { try { if (storage) storage.removeItem(key); } catch (e) { /* 무시 */ } }
    };
  }

  /**
   * opts: { storageKey, storage, initial: () => project, autosaveMs }
   */
  function Store(opts) {
    this.key = opts.storageKey || 'kbo-opus:v1';
    this.storage = safeStorage(opts.storage === undefined ? null : opts.storage);
    this.initial = opts.initial;
    this.autosaveMs = opts.autosaveMs == null ? 400 : opts.autosaveMs;
    this.listeners = [];
    this.undoStack = [];
    this.redoStack = [];
    this.version = 0;
    this.persistError = null;
    this.lastSavedAt = null;
    this.restored = false;
    this._timer = null;
    const saved = this.storage.get(this.key);
    let state = null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const v = validateProject(parsed);
        if (v.ok) { state = v.project; this.restored = true; }
      } catch (e) { state = null; }
    }
    this.state = state || normalize(this.initial());
  }

  Store.prototype.subscribe = function (fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  };

  Store.prototype._notify = function (change) {
    this.version++;
    for (const fn of this.listeners.slice()) {
      try { fn(change, this); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
    }
  };

  Store.prototype._working = function () {
    const w = {};
    for (const k of WORKING_KEYS) w[k] = this.state[k];
    return JSON.stringify(w);
  };

  Store.prototype._restoreWorking = function (str) {
    const w = JSON.parse(str);
    for (const k of WORKING_KEYS) this.state[k] = w[k];
  };

  /** 실행 취소 지점 저장 (변경 직전 상태) */
  Store.prototype.checkpoint = function (label) {
    this.undoStack.push({ label: label || '변경', data: this._working() });
    if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
  };

  /**
   * 상태 변경. mutator(state)가 false를 돌려주면 변경을 취소한다.
   * options: { undo: true, tags: ['plan'], label }
   */
  Store.prototype.commit = function (label, mutator, options) {
    const o = options || {};
    const before = o.undo === false ? null : this._working();
    const result = mutator(this.state);
    if (result === false) return false;
    if (before) {
      this.undoStack.push({ label: label || '변경', data: before });
      if (this.undoStack.length > UNDO_LIMIT) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    this.state.meta.updatedAt = new Date().toISOString();
    this._notify({ label, tags: new Set(o.tags || ['all']), source: o.source || 'user' });
    this._scheduleSave();
    return true;
  };

  Store.prototype.undo = function () {
    const e = this.undoStack.pop();
    if (!e) return false;
    this.redoStack.push({ label: e.label, data: this._working() });
    this._restoreWorking(e.data);
    this._notify({ label: '실행 취소: ' + e.label, tags: new Set(['all']), source: 'undo' });
    this._scheduleSave();
    return true;
  };

  Store.prototype.redo = function () {
    const e = this.redoStack.pop();
    if (!e) return false;
    this.undoStack.push({ label: e.label, data: this._working() });
    this._restoreWorking(e.data);
    this._notify({ label: '다시 실행: ' + e.label, tags: new Set(['all']), source: 'redo' });
    this._scheduleSave();
    return true;
  };

  Store.prototype.canUndo = function () { return this.undoStack.length > 0; };
  Store.prototype.canRedo = function () { return this.redoStack.length > 0; };
  Store.prototype.undoLabel = function () { const e = this.undoStack[this.undoStack.length - 1]; return e ? e.label : ''; };
  Store.prototype.redoLabel = function () { const e = this.redoStack[this.redoStack.length - 1]; return e ? e.label : ''; };

  Store.prototype._scheduleSave = function () {
    if (this.autosaveMs < 0) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => { this._timer = null; this.save(); }, this.autosaveMs);
  };

  Store.prototype.save = function () {
    const res = this.storage.set(this.key, JSON.stringify(this.state));
    const prev = this.persistError;
    this.persistError = res.ok ? null : res.error;
    if (res.ok) this.lastSavedAt = new Date();
    if (prev !== this.persistError || res.ok) {
      for (const fn of this.listeners.slice()) { try { fn({ label: 'persist', tags: new Set(['persist']), source: 'persist' }, this); } catch (e) { /* 무시 */ } }
    }
    return res;
  };

  /** 전체 교체(가져오기·초기화). 실행 취소 가능. */
  Store.prototype.replace = function (project, label) {
    const v = validateProject(project);
    if (!v.ok) return v;
    this.commit(label || '프로젝트 교체', (s) => {
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, v.project);
    });
    return v;
  };

  Store.prototype.reset = function () {
    this.undoStack.length = 0; this.redoStack.length = 0;
    this.state = normalize(this.initial());
    this._notify({ label: '초기화', tags: new Set(['all']), source: 'reset' });
    this._scheduleSave();
  };

  // ───── 스냅샷 (FR-M7) ─────
  Store.prototype.addSnapshot = function (name, extra) {
    const s = this.state;
    const snap = Object.assign({
      id: 's' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: name || ('스냅샷 ' + (s.snapshots.length + 1)), createdAt: new Date().toISOString(),
      plan: clone(s.plan), pins: s.matches.map((m) => !!m.pinned), reschedulePlan: clone((s.reschedule && s.reschedule.plan) || []),
      matchCount: s.matches.length, slotCount: s.calendar.length
    }, extra || {});
    this.commit('스냅샷 저장', (st) => { st.snapshots.push(snap); }, { undo: false, tags: ['snapshots'] });
    return snap;
  };

  Store.prototype.restoreSnapshot = function (id) {
    const snap = this.state.snapshots.find((x) => x.id === id);
    if (!snap) return false;
    if (snap.matchCount !== this.state.matches.length || snap.slotCount !== this.state.calendar.length) return { ok: false, error: '현재 시리즈·슬롯 구성이 스냅샷과 달라 복원할 수 없습니다.' };
    this.commit('스냅샷 복원: ' + snap.name, (st) => {
      st.plan = clone(snap.plan);
      if (snap.pins) st.matches.forEach((m, i) => { m.pinned = !!snap.pins[i]; });
      if (snap.reschedulePlan && st.reschedule) st.reschedule.plan = clone(snap.reschedulePlan);
    }, { tags: ['plan', 'pins'] });
    return { ok: true };
  };

  Store.prototype.renameSnapshot = function (id, name) {
    this.commit('스냅샷 이름 변경', (st) => { const s = st.snapshots.find((x) => x.id === id); if (!s) return false; s.name = name; }, { undo: false, tags: ['snapshots'] });
  };

  Store.prototype.deleteSnapshot = function (id) {
    this.commit('스냅샷 삭제', (st) => { st.snapshots = st.snapshots.filter((x) => x.id !== id); }, { undo: false, tags: ['snapshots'] });
  };

  // ───── 입출력 ─────
  Store.prototype.exportProject = function () {
    const out = clone(this.state);
    out.meta.schemaVersion = SCHEMA_VERSION;
    out.meta.exportedAt = new Date().toISOString();
    return JSON.stringify(out, null, 2);
  };

  /** FR-D3 엔진 호환 JSON (input_2025.json 형식) */
  function exportEngine(project) {
    const plan = KBO.Score.planArrayFrom(project);
    const engine = {
      teams: project.teams.map((t, i) => ({ index: i, name: t.name, stadium: t.stadium, latitude: t.latitude, longitude: t.longitude })),
      distanceMatrix: project.distanceMatrix.map((d, i) => ({ index: i, from: d.from, to: d.to, distance: Number(d.distance) })),
      calendar: project.calendar.map((c, i) => ({ index: i, datetime: c.datetime, consecutive: c.consecutive, weekend: c.weekend, holiday: c.holiday })),
      matches: project.matches.map((m, i) => ({ index: i, home: m.home, away: m.away, consecutive: m.consecutive })),
      initialPlan: []
    };
    // 매치 인덱스 순으로 내보내면 BaseballApp.setInitialPlan의 FIFO 키 매칭이 같은 매치를 고른다.
    project.matches.forEach((m, i) => {
      const s = plan[i];
      if (s < 0) return;
      const c = project.calendar[s];
      engine.initialPlan.push({ index: engine.initialPlan.length, datetime: c.datetime, home: m.home, away: m.away, consecutive: m.consecutive, weekend: c.weekend, holiday: c.holiday });
    });
    return JSON.stringify(engine, null, 2);
  }

  /** FR-D4 CSV (날짜, 원정, 홈, 구장, 상태). 엑셀 호환을 위해 BOM을 붙인다. */
  function exportCSV(project, filterTeam) {
    const games = KBO.Reschedule.computeGames(project);
    const esc = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['날짜', '요일', '원정', '홈', '구장', '상태', '취소 사유', '구분', '더블헤더']];
    for (const g of games) {
      if (filterTeam && g.home !== filterTeam && g.away !== filterTeam) continue;
      rows.push([g.date, KBO.Dates.WEEKDAY_KO[KBO.Dates.weekday(g.day)], g.away, g.home, g.stadium,
        KBO.Reschedule.STATUS[g.status] || g.status, g.reason ? KBO.Reschedule.REASONS[g.reason] || g.reason : '', g.source === 'RESCHEDULE' ? '재편성' : '1차 편성', g.dh ? 'DH' : '']);
    }
    return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
  }

  // ───── 검증·정규화 ─────

  function normalize(p) {
    const preset = KBO.Preset;
    const project = clone(p);
    project.meta = Object.assign({ schemaVersion: SCHEMA_VERSION, season: 2025, name: '새 프로젝트', updatedAt: new Date().toISOString() }, project.meta || {});
    project.settings = Object.assign(clone(preset.DEFAULT_SETTINGS), project.settings || {});
    project.settings.solver = Object.assign(clone(preset.DEFAULT_SETTINGS.solver), (p.settings && p.settings.solver) || {});
    project.events = project.events || [];
    project.games = project.games || [];
    project.snapshots = project.snapshots || [];
    project.reschedule = Object.assign(clone(preset.DEFAULT_RESCHEDULE), project.reschedule || {});
    project.teams = (project.teams || []).map((t, i) => Object.assign({ color: (preset.TEAM_COLORS[t.name] || '#555555') }, t, { index: i }));
    project.distanceMatrix = (project.distanceMatrix || []).map((d) => ({ from: d.from, to: d.to, distance: Number(d.distance), estimated: !!d.estimated }));
    project.calendar = (project.calendar || []).map((c, i) => ({ index: i, datetime: c.datetime, consecutive: c.consecutive | 0, weekend: c.weekend | 0, holiday: c.holiday | 0 }));
    project.matches = (project.matches || []).map((m, i) => { const o = { index: i, home: m.home, away: m.away, consecutive: m.consecutive | 0, pinned: !!m.pinned }; if (m.eventId) o.eventId = m.eventId; return o; });
    const M = project.matches.length;
    const planArr = new Array(M).fill(-1);
    for (const e of project.plan || []) if (e && e.match >= 0 && e.match < M) planArr[e.match] = (e.calendar == null || e.calendar >= project.calendar.length) ? -1 : e.calendar;
    project.plan = planArr.map((c, m) => ({ match: m, calendar: c }));
    return project;
  }

  /** 엔진 입력 형식(input_2025.json) → 프로젝트 */
  function fromEngineFormat(engine) {
    const preset = KBO.Preset;
    const plan = preset.planFromInitialPlan(engine);
    const cal = engine.calendar || [];
    const first = cal.length ? cal[0].datetime.slice(0, 10) : preset.DEFAULT_SETTINGS.seasonStart;
    const lastSlot = cal[cal.length - 1];
    const lastDay = lastSlot ? KBO.Dates.addDays(lastSlot.datetime.slice(0, 10), lastSlot.consecutive - 1) : preset.DEFAULT_SETTINGS.initialEnd;
    const year = Number(first.slice(0, 4));
    const settings = clone(preset.DEFAULT_SETTINGS);
    settings.seasonStart = first;
    settings.initialEnd = lastDay;
    if (year !== 2025) {
      settings.seasonEnd = year + '-10-31';
      settings.restExceptions = [];
      settings.blackouts = [];
      settings.holidays = KBO.CalendarGen.builtinHolidays(year).filter((h) => h.date >= first && h.date <= settings.seasonEnd);
    }
    return {
      meta: { schemaVersion: SCHEMA_VERSION, season: year, name: '가져온 엔진 입력 ' + year, updatedAt: new Date().toISOString() },
      teams: engine.teams, distanceMatrix: engine.distanceMatrix, settings, events: year === 2025 ? preset.presetEvents() : [],
      calendar: engine.calendar, matches: (engine.matches || []).map((m) => ({ home: m.home, away: m.away, consecutive: m.consecutive, pinned: false })),
      plan: plan.map((c, m) => ({ match: m, calendar: c })), games: [], reschedule: Object.assign(clone(preset.DEFAULT_RESCHEDULE), { start: KBO.Dates.addDays(lastDay, 1), end: settings.seasonEnd }), snapshots: []
    };
  }

  /**
   * NFR-8 필드 단위 검증. 프로젝트 JSON 또는 엔진 입력 JSON을 받는다.
   * 반환: { ok, errors: [{path, message}], warnings, project, format }
   */
  function validateProject(obj) {
    const errors = [];
    const warnings = [];
    const err = (path, message) => errors.push({ path, message });
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: [{ path: '(루트)', message: 'JSON 객체여야 합니다.' }], warnings };
    let format = 'PROJECT';
    let src = obj;
    if (!obj.meta && Array.isArray(obj.initialPlan)) { format = 'ENGINE'; }
    const reqArray = (k) => { if (!Array.isArray(src[k])) { err(k, '배열이 필요합니다.'); return false; } return true; };
    for (const k of ['teams', 'distanceMatrix', 'calendar', 'matches']) reqArray(k);
    if (errors.length) return { ok: false, errors, warnings, format };
    const names = new Set();
    src.teams.forEach((t, i) => {
      if (!t || typeof t.name !== 'string' || !t.name.trim()) err('teams[' + i + '].name', '구단명이 비어 있습니다.');
      else if (names.has(t.name)) err('teams[' + i + '].name', '구단명 "' + t.name + '"이(가) 중복됩니다.');
      else names.add(t.name);
      if (!t || typeof t.stadium !== 'string' || !t.stadium.trim()) err('teams[' + i + '].stadium', '구장명이 비어 있습니다.');
      if (!t || !Number.isFinite(Number(t.latitude))) err('teams[' + i + '].latitude', '위도는 숫자여야 합니다.');
      if (!t || !Number.isFinite(Number(t.longitude))) err('teams[' + i + '].longitude', '경도는 숫자여야 합니다.');
      if (t && t.color != null && !/^#[0-9a-fA-F]{6}$/.test(t.color)) err('teams[' + i + '].color', '색상은 #RRGGBB 형식이어야 합니다.');
    });
    src.distanceMatrix.forEach((d, i) => {
      if (!d || !names.has(d.from)) err('distanceMatrix[' + i + '].from', '알 수 없는 구단 "' + (d && d.from) + '"');
      if (!d || !names.has(d.to)) err('distanceMatrix[' + i + '].to', '알 수 없는 구단 "' + (d && d.to) + '"');
      if (!d || !Number.isFinite(Number(d.distance)) || Number(d.distance) < 0) err('distanceMatrix[' + i + '].distance', '거리는 0 이상의 숫자여야 합니다.');
    });
    src.calendar.forEach((c, i) => {
      if (!c || !/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/.test(String(c.datetime))) err('calendar[' + i + '].datetime', '"YYYY-MM-DD 00:00:00" 형식이어야 합니다.');
      if (!c || !Number.isInteger(c.consecutive) || c.consecutive < 1 || c.consecutive > 7) err('calendar[' + i + '].consecutive', '연전 수는 1~7 정수여야 합니다.');
      if (c && c.weekend != null && !Number.isInteger(c.weekend)) err('calendar[' + i + '].weekend', '정수여야 합니다.');
      if (c && c.holiday != null && !Number.isInteger(c.holiday)) err('calendar[' + i + '].holiday', '정수여야 합니다.');
    });
    src.matches.forEach((m, i) => {
      if (!m || !names.has(m.home)) err('matches[' + i + '].home', '알 수 없는 홈 구단 "' + (m && m.home) + '"');
      if (!m || !names.has(m.away)) err('matches[' + i + '].away', '알 수 없는 원정 구단 "' + (m && m.away) + '"');
      if (m && m.home === m.away) err('matches[' + i + '].away', '홈과 원정이 같습니다.');
      if (!m || !Number.isInteger(m.consecutive) || m.consecutive < 1) err('matches[' + i + '].consecutive', '연전 수는 1 이상의 정수여야 합니다.');
    });
    if (format === 'PROJECT') {
      if (src.plan != null && !Array.isArray(src.plan)) err('plan', '배열이 필요합니다.');
      (src.plan || []).forEach((p, i) => {
        if (!p || !Number.isInteger(p.match) || p.match < 0 || p.match >= src.matches.length) err('plan[' + i + '].match', '매치 인덱스 범위를 벗어났습니다.');
        if (p && p.calendar != null && (!Number.isInteger(p.calendar) || p.calendar < -1 || p.calendar >= src.calendar.length)) err('plan[' + i + '].calendar', '슬롯 인덱스 범위를 벗어났습니다.');
      });
      if (src.events != null && !Array.isArray(src.events)) err('events', '배열이 필요합니다.');
      (src.events || []).forEach((e, i) => {
        if (!e || !['OPENING', 'CHILDREN', 'CUSTOM'].includes(e.type)) err('events[' + i + '].type', 'OPENING, CHILDREN, CUSTOM 중 하나여야 합니다.');
        if (!e || !['MATCH', 'STADIUM'].includes(e.mode)) err('events[' + i + '].mode', 'MATCH 또는 STADIUM이어야 합니다.');
        if (e && e.mode === 'MATCH' && (!names.has(e.home) || !names.has(e.away))) err('events[' + i + ']', '대진 지정 이벤트의 홈·원정 구단을 확인하세요.');
        if (e && e.mode === 'STADIUM' && !Array.isArray(e.stadiums)) err('events[' + i + '].stadiums', '배열이 필요합니다.');
      });
      if (src.games != null && !Array.isArray(src.games)) err('games', '배열이 필요합니다.');
      (src.games || []).forEach((g, i) => {
        if (!g || !['PLAYED', 'CANCELLED', 'SCHEDULED'].includes(g.status)) err('games[' + i + '].status', 'PLAYED, CANCELLED, SCHEDULED 중 하나여야 합니다.');
        if (!g || !/^\d{4}-\d{2}-\d{2}$/.test(String(g.date))) err('games[' + i + '].date', '"YYYY-MM-DD" 형식이어야 합니다.');
      });
      if (src.meta && src.meta.schemaVersion > SCHEMA_VERSION) warnings.push('schemaVersion ' + src.meta.schemaVersion + '은(는) 이 앱(' + SCHEMA_VERSION + ')보다 새 버전입니다.');
    }
    if (errors.length) return { ok: false, errors, warnings, format };
    const raw = format === 'ENGINE' ? fromEngineFormat(src) : src;
    if (format === 'ENGINE') warnings.push('엔진 입력 형식을 프로젝트로 변환했습니다. 일정 설정은 슬롯에서 추정했습니다.');
    // 구단쌍 거리 누락은 경고만 (사전 점검에서 차단)
    return { ok: true, errors, warnings, format, project: normalize(raw) };
  }

  KBO.Store = { Store, SCHEMA_VERSION, UNDO_LIMIT, clone, normalize, validateProject, fromEngineFormat, exportEngine, exportCSV, safeStorage };
});
