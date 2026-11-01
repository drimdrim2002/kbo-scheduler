/*
 * 편성 스튜디오 — 저장소: 시즌 연도별 프로젝트를 읽고 쓰는 곳은 여기 한 곳뿐이다.
 * 지금은 이 브라우저(localStorage)에 연도마다 한 덩어리(S.KEY + 'season:2027')로 저장한다.
 * 나중에 DB로 옮길 때는 backend(get·set·del·keys)만 바꿔 끼운다 — 화면 코드는 S.repo의 함수만 쓴다.
 * 자동 저장: 사용자가 고치면(실행 취소·다시 실행 포함) 잠깐 뒤 지금 연도를 저장한다. 처음 불러온 기본 데이터는 고치기 전까지 저장하지 않는다.
 * 파일: 프로젝트 JSON 내려받기·올리기(올린 파일은 KBO.Store.validateProject로 검사한 뒤 그 연도로 연다).
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { KBO } = S;
  const PREFIX = S.KEY + 'season:';
  const LAST = S.KEY + 'year';
  const VERSION = 1;

  /** 이 브라우저 저장(localStorage). 실패하면 { ok:false, error } */
  S.localBackend = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) {
      try { window.localStorage.setItem(k, v); return { ok: true }; } catch (e) { return { ok: false, error: e && e.name === 'QuotaExceededError' ? '브라우저 저장 공간이 모자랍니다' : '저장하지 못했습니다' }; }
    },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* 무시 */ } },
    keys(prefix) {
      const out = [];
      try { for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); if (k && k.indexOf(prefix) === 0) out.push(k); } } catch (e) { /* 무시 */ }
      return out;
    }
  };

  const R = S.repo = {
    backend: S.localBackend,
    /** 저장된 연도 목록(오름차순): [{ year, savedAt, name, flow }] */
    list() {
      return R.backend.keys(PREFIX).map((k) => +k.slice(PREFIX.length)).filter(Number.isFinite).sort((a, b) => a - b)
        .map((y) => { const r = R.load(y); return r ? { year: y, savedAt: r.savedAt, name: r.project.meta && r.project.meta.name, flow: r.project.meta && r.project.meta.flow } : null; })
        .filter(Boolean);
    },
    /** 그 해 저장본: { year, savedAt, project } 또는 null(없거나 읽을 수 없음) */
    load(year) {
      const raw = R.backend.get(PREFIX + year);
      if (!raw) return null;
      try {
        const rec = JSON.parse(raw);
        const v = KBO.Store.validateProject(rec.project);
        if (!v.ok) return null;
        return { year: +year, savedAt: rec.savedAt || null, project: v.project };
      } catch (e) { return null; }
    },
    has(year) { return !!R.backend.get(PREFIX + year); },
    save(year, project) {
      const savedAt = new Date().toISOString();
      const res = R.backend.set(PREFIX + year, JSON.stringify({ v: VERSION, year: +year, savedAt, project }));
      return Object.assign({ savedAt }, res);
    },
    remove(year) { R.backend.del(PREFIX + year); },
    /** 마지막으로 연 연도(없으면 null) */
    lastYear() { const v = +(R.backend.get(LAST) || ''); return Number.isFinite(v) && v > 2000 ? v : null; },
    setLastYear(y) { R.backend.set(LAST, String(y)); }
  };

  // ───────── 자동 저장 ─────────
  // 지금 상태의 연도에 저장한다. 연도를 바꾸는 중(S.switchYear)에는 멈춘다.
  const A = S.autosave = { ms: 400, timer: null, savedAt: null, error: null, paused: false, dirty: false };
  A.yearOf = (st) => +(st.settings && st.settings.seasonYear) || +(st.meta && st.meta.season) || S.seasonYear();
  A.flush = function () {
    if (A.timer) { clearTimeout(A.timer); A.timer = null; }
    if (!A.dirty || !S.app) return null;
    A.dirty = false;
    const st = S.app.state, y = A.yearOf(st);
    const res = R.save(y, st);
    A.error = res.ok ? null : res.error;
    if (res.ok) { A.savedAt = res.savedAt; R.setLastYear(y); }
    return res;
  };
  A.touch = function () {
    if (A.paused) return;
    A.dirty = true;
    if (A.timer) clearTimeout(A.timer);
    A.timer = setTimeout(() => { A.timer = null; A.flush(); }, A.ms);
  };
  A.start = function () {
    S.app.subscribe((change) => { if (change && ['user', 'undo', 'redo'].includes(change.source)) A.touch(); });
    window.addEventListener('beforeunload', () => A.flush());
  };
  /** 저장 상태 한 줄: 「이 브라우저에 저장됨 · 10/29(목) 오후 3:05」 */
  S.savedText = function (iso) {
    const t = iso || A.savedAt;
    if (A.error) return A.error;
    if (!t) return '아직 저장하지 않음(고치면 이 브라우저에 자동 저장)';
    return '이 브라우저에 저장됨 · ' + S.whenText(t);
  };
  S.whenText = function (iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const h = d.getHours(), ap = h < 12 ? '오전' : '오후', hh = h % 12 || 12;
    return (d.getMonth() + 1) + '/' + d.getDate() + '(' + KBO.Dates.WEEKDAY_KO[d.getDay()] + ') ' + ap + ' ' + hh + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  // ───────── 파일로 내려받기·올리기(프로젝트 JSON) ─────────
  S.fileName = (y) => 'KBO ' + y + ' 시즌 데이터.json';
  R.exportFile = function () {
    const y = A.yearOf(S.app.state);
    KBO.UI.download(S.fileName(y), S.app.store.exportProject(), 'application/json');
    return S.fileName(y);
  };
  /** 올린 JSON 글 → { ok, year, project, errors } (엔진 입력 형식도 받는다) */
  R.parseFile = function (text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, errors: ['JSON 파일로 읽을 수 없습니다.'] }; }
    const v = KBO.Store.validateProject(obj);
    if (!v.ok) return { ok: false, errors: v.errors.slice(0, 5).map((x) => x.path + ': ' + x.message) };
    const p = v.project, m = /^(\d{4})/.exec(p.settings.seasonStart || '');
    const year = +(p.settings.seasonYear || (m && m[1]) || p.meta.season) || null;
    if (!year) return { ok: false, errors: ['시즌 연도를 알 수 없습니다(개막일이나 seasonYear가 필요합니다).'] };
    return { ok: true, year, project: p, warnings: v.warnings };
  };
  R.importFile = function () {
    KBO.UI.pickFile('.json,application/json').then((f) => { if (f) S.openProjectText(f.text, f.name); });
  };
  /** 올린 파일을 그 연도로 연다(지금 연도는 먼저 저장). 자가 점검도 이 함수를 부른다 */
  S.openProjectText = function (text, name) {
    const r = R.parseFile(text);
    if (!r.ok) { S.toast('파일을 열지 못했습니다' + (name ? ' (' + name + ')' : '') + ' — ' + r.errors.join(' / '), 'bad', 8000); return r; }
    S.switchYear(r.year, { project: r.project, save: true, to: 'resume' });
    S.toast((name ? name + ' — ' : '') + r.year + ' 시즌 데이터를 열고 이 브라우저에 저장했습니다.', 'ok', 5000);
    return r;
  };
})();
