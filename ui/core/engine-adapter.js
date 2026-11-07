/*
 * KBO 공통 코어 — 엔진 어댑터 (§7).
 * 화면 코드는 EngineAdapter 인터페이스만 쓴다. Mock과 REST를 구분하지 않는다(FR-R5).
 *
 *   engine.solve(problem, options) → SolveHandle
 *   handle.on('best' | 'done' | 'error', fn); handle.pause(); handle.resume(); handle.stop();
 *   engine.score(problem, plan, mode) → { score, violations, teamMetrics } (Mock: 동기 값, REST: Promise)
 *
 * problem은 §8 프로젝트 JSON(또는 그 부분집합), options는 { mode, timeLimitSec, unimprovedSec, seed, init }.
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).engineAdapter = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  function SolveHandle() {
    this.listeners = { best: [], done: [], error: [], status: [] };
    this.status = 'STARTING';
    this._controls = null;
  }
  SolveHandle.prototype.on = function (evt, fn) { (this.listeners[evt] || (this.listeners[evt] = [])).push(fn); return this; };
  SolveHandle.prototype._emit = function (evt, payload) {
    for (const fn of (this.listeners[evt] || []).slice()) { try { fn(payload); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }
  };
  SolveHandle.prototype._setStatus = function (s) { this.status = s; this._emit('status', s); };
  SolveHandle.prototype.pause = function () { if (this._controls && this.status === 'RUNNING') { this._controls.pause(); this._setStatus('PAUSED'); } };
  SolveHandle.prototype.resume = function () { if (this._controls && this.status === 'PAUSED') { this._controls.resume(); this._setStatus('RUNNING'); } };
  SolveHandle.prototype.stop = function () { if (this._controls && (this.status === 'RUNNING' || this.status === 'PAUSED' || this.status === 'STARTING')) this._controls.stop(); };

  /** 엔진 입력을 Mock 탐색기 문제로 바꾼다 */
  /** 날짜 단위 재편성 요청인가(reschedule.targets가 있다). 없으면 옛 묶음 방식(reschedule.js) */
  function isDaily(problem, mode) {
    return mode === 'RESCHEDULE' && !!(problem && problem.reschedule && Array.isArray(problem.reschedule.targets) && KBO.RescheduleDaily);
  }

  function toSolverProblem(problem, mode) {
    if (isDaily(problem, mode)) return { mode: 'RESCHEDULE_DAILY', input: { project: problem } };
    if (mode === 'RESCHEDULE') return { mode, input: KBO.Reschedule.buildInput(problem) };
    const input = KBO.Score.buildInput(problem);
    input.plan = Array.from(KBO.Score.planArrayFrom(problem));
    return { mode: 'INITIAL', input };
  }

  function scoreLocal(problem, plan, mode) {
    if (isDaily(problem, mode)) return KBO.RescheduleDaily.score(problem, plan || problem.reschedule.plan || []);
    const p = Object.assign({}, problem);
    if (mode === 'RESCHEDULE') {
      if (plan) p.reschedule = Object.assign({}, problem.reschedule, { plan });
      const ex = KBO.Reschedule.explain(p);
      return { score: ex.score, violations: ex.violations, teamMetrics: ex.teamMetrics, scoreString: KBO.Score.scoreString(ex.score) };
    }
    if (plan) p.plan = plan;
    const ex = KBO.Score.scoreProject(p);
    return { score: ex.score, violations: ex.violations, teamMetrics: ex.teamMetrics.map((t) => { const c = Object.assign({}, t); delete c.visits; delete c.runs; return c; }), scoreString: KBO.Score.scoreString(ex.score) };
  }

  /** Worker 소스: 코어 팩토리 함수 문자열을 이어 붙인다(file://에서도 fetch 없이 동작) */
  function workerSource() {
    const f = KBO.__factories;
    const parts = ['calendar', 'score', 'reschedule', 'rescheduleDaily', 'mockSolver'].map((n) => {
      if (!f[n]) throw new Error('코어 모듈 누락: ' + n);
      return '(' + f[n].toString() + ')(self.KBO);';
    });
    return 'self.KBO = {};\n' + parts.join('\n') + '\nself.KBO.MockSolver.workerMain(self);\n';
  }

  /**
   * MockEngineAdapter: 브라우저 내 로컬서치.
   * opts: { useWorker: true, WorkerCtor, BlobCtor, URLObj } — 테스트에서 주입 가능
   */
  function MockEngineAdapter(opts) {
    this.kind = 'MOCK';
    this.label = '시뮬레이션 엔진 (Mock)';
    this.opts = opts || {};
    this.lastTransport = null; // 'worker' | 'main'
  }

  MockEngineAdapter.prototype.solve = function (problem, options) {
    const o = Object.assign({ timeLimitSec: 60, unimprovedSec: 15, seed: 42, init: 'KEEP', mode: 'INITIAL' }, options || {});
    const handle = new SolveHandle();
    let solverProblem;
    try { solverProblem = toSolverProblem(problem, o.mode); } catch (e) {
      setTimeout(() => { handle._setStatus('ERROR'); handle._emit('error', { message: '문제 변환 실패: ' + e.message }); }, 0);
      return handle;
    }
    const self = this;
    const daily = solverProblem.mode === 'RESCHEDULE_DAILY';
    const decorate = (p) => Object.assign(p, { explanation: KBO.Score.scoreString(p.score) });
    // 날짜 단위 재편성: 끝난 결과를 서버 done과 같은 모양(평가 숫자·못 넣은 이유·engine: 'browser')으로
    const finish = (p) => (daily ? decorate(KBO.RescheduleDaily.finishPayload(problem, p)) : decorate(p));
    function runMain(note) {
      self.lastTransport = 'main';
      handle.transport = 'main';
      handle.transportNote = note || '';
      const search = KBO.MockSolver.createSearch(solverProblem, o);
      handle._controls = KBO.MockSolver.runDriver(search, o, {
        onBest: (p) => handle._emit('best', decorate(p)),
        onDone: (p) => { handle._setStatus('DONE'); handle._emit('done', finish(p)); }
      });
      handle._setStatus('RUNNING');
    }
    const W = this.opts.WorkerCtor || (typeof Worker !== 'undefined' ? Worker : null);
    const B = this.opts.BlobCtor || (typeof Blob !== 'undefined' ? Blob : null);
    const U = this.opts.URLObj || (typeof URL !== 'undefined' ? URL : null);
    if (this.opts.useWorker === false || !W || !B || !U || !U.createObjectURL) {
      setTimeout(() => runMain('Worker 미지원'), 0);
      return handle;
    }
    let worker = null;
    let url = null;
    let ready = false;
    let fellBack = false;
    const fallback = (why) => {
      if (fellBack || ready) return;
      fellBack = true;
      try { if (worker) worker.terminate(); } catch (e) { /* 무시 */ }
      try { if (url) U.revokeObjectURL(url); } catch (e) { /* 무시 */ }
      runMain('Worker 실패 → 메인 스레드: ' + why);
    };
    try {
      url = U.createObjectURL(new B([workerSource()], { type: 'text/javascript' }));
      worker = new W(url);
    } catch (e) {
      setTimeout(() => fallback(e.message || 'Worker 생성 실패'), 0);
      return handle;
    }
    const readyTimer = setTimeout(() => fallback('응답 없음'), 1500);
    worker.onerror = (e) => {
      if (!ready) { clearTimeout(readyTimer); fallback((e && e.message) || 'Worker 오류'); return; }
      handle._setStatus('ERROR');
      handle._emit('error', { message: (e && e.message) || 'Worker 오류' });
    };
    worker.onmessage = (e) => {
      const msg = e.data || {};
      if (msg.type === 'ready') {
        if (fellBack) return;
        ready = true;
        clearTimeout(readyTimer);
        self.lastTransport = 'worker';
        handle.transport = 'worker';
        worker.postMessage({ type: 'solve', problem: solverProblem, options: o });
        handle._setStatus('RUNNING');
      } else if (msg.type === 'best') handle._emit('best', decorate(msg.payload));
      else if (msg.type === 'done') {
        handle._setStatus('DONE');
        handle._emit('done', finish(msg.payload));
        try { worker.terminate(); U.revokeObjectURL(url); } catch (err) { /* 무시 */ }
      } else if (msg.type === 'error') { handle._setStatus('ERROR'); handle._emit('error', msg.payload); }
    };
    handle._controls = {
      pause: () => worker.postMessage({ type: 'pause' }),
      resume: () => worker.postMessage({ type: 'resume' }),
      stop: () => worker.postMessage({ type: 'stop' })
    };
    // 폴백되면 _controls는 runMain이 덮어쓴다
    return handle;
  };

  MockEngineAdapter.prototype.score = function (problem, plan, mode) { return scoreLocal(problem, plan, mode || 'INITIAL'); };
  /** 요구 사항 점검은 서버만 한다(엔진 점수와 따로 세는 서버 점검기). 서버가 없으면 그 사실을 돌려준다 — 화면이 「서버 점검을 할 수 없음」으로 정직하게 보인다 */
  MockEngineAdapter.prototype.verify = function () { return Promise.reject(Object.assign(new Error('서버에 연결되지 않아 요구 사항을 점검할 수 없습니다.'), { offline: true })); };

  /**
   * RestEngineAdapter: §7.3 REST 계약 (향후 Java 서버). 일시정지는 계약에 없어 화면 갱신만 멈춘다.
   * opts: { baseUrl: 'http://localhost:8080', fetchImpl, EventSourceCtor }
   */
  function RestEngineAdapter(opts) {
    this.kind = 'REST';
    this.opts = opts || {};
    this.baseUrl = (this.opts.baseUrl || '').replace(/\/$/, '');
    this.label = 'REST 엔진 (' + (this.baseUrl || '같은 출처') + ')';
  }

  RestEngineAdapter.prototype._fetch = function (path, body) {
    const f = this.opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!f) return Promise.reject(new Error('fetch를 쓸 수 없습니다.'));
    return f(this.baseUrl + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then((r) => {
        if (r.ok) return r.json();
        // 서버가 준 오류 문장(400 { error } 등)을 그대로 — 없으면 HTTP 상태
        const fallback = 'HTTP ' + r.status + ' ' + path;
        return r.text().then((t) => {
          let msg = '';
          try { const j = JSON.parse(t); msg = (j && (j.error || j.message)) || ''; } catch (e) { /* 본문이 JSON이 아님 */ }
          throw new Error(typeof msg === 'string' && msg ? msg : fallback);
        }, () => { throw new Error(fallback); });
      });
  };

  RestEngineAdapter.prototype.solve = function (problem, options) {
    const o = Object.assign({ mode: 'INITIAL' }, options || {});
    const handle = new SolveHandle();
    let paused = false;
    let pending = null;
    let es = null;
    let jobId = null;
    const ES = this.opts.EventSourceCtor || (typeof EventSource !== 'undefined' ? EventSource : null);
    const self = this;
    const withString = (p) => Object.assign(p, { explanation: p.score && p.score.hard ? KBO.Score.scoreString(p.score) : String(p.score || '') });
    this._fetch('/api/v1/solve', { problem, options: o, mode: o.mode }).then((res) => {
      jobId = res.jobId;
      handle.jobId = jobId;
      handle._setStatus('RUNNING');
      if (!ES) throw new Error('EventSource를 쓸 수 없습니다.');
      es = new ES(self.baseUrl + '/api/v1/solve/' + encodeURIComponent(jobId) + '/events');
      es.addEventListener('best', (e) => { const p = withString(JSON.parse(e.data)); if (paused) pending = p; else handle._emit('best', p); });
      es.addEventListener('queued', (e) => { handle.queue = JSON.parse(e.data); handle._emit('queued', handle.queue); });
      es.addEventListener('status', (e) => { handle.queue = null; handle._emit('server-status', JSON.parse(e.data)); });
      es.addEventListener('seed-best', (e) => handle._emit('seed-best', withString(JSON.parse(e.data))));
      es.addEventListener('error', (e) => { if (e && e.data) { es.close(); handle._setStatus('ERROR'); let msg = e.data; try { msg = JSON.parse(e.data).message || msg; } catch (err) { /* 그대로 */ } handle._emit('error', { message: msg }); } });
      es.addEventListener('done', (e) => {
        es.close();
        const p = withString(JSON.parse(e.data));
        // 서버와 브라우저 채점이 어긋나면 오류로 남긴다(화면 점검의 data-errors가 잡는다). 설계 §6.4의 6
        if (isDaily(problem, o.mode) && p.plan && p.scoreString) { const why = KBO.RescheduleDaily.crossCheck(problem, p); if (why) console.error(why); }
        handle._setStatus('DONE');
        handle._emit('done', p);
      });
      es.onerror = () => { if (handle.status === 'RUNNING' || handle.status === 'PAUSED') { es.close(); handle._setStatus('ERROR'); handle._emit('error', { message: '이벤트 스트림 연결이 끊어졌습니다.' }); } };
    }).catch((e) => { handle._setStatus('ERROR'); handle._emit('error', { message: e.message }); });
    handle._controls = {
      pause: () => { paused = true; },
      resume: () => { paused = false; if (pending) { handle._emit('best', pending); pending = null; } },
      stop: () => { if (jobId) self._fetch('/api/v1/solve/' + encodeURIComponent(jobId) + '/stop', {}).catch((e) => handle._emit('error', { message: e.message })); }
    };
    return handle;
  };

  /** 서버 점수에 브라우저 채점기의 위반 목록·구단 지표를 합친다(서버는 score·scoreString만 준다). */
  RestEngineAdapter.prototype.score = function (problem, plan, mode) {
    const m = mode || 'INITIAL';
    return this._fetch('/api/v1/score', { problem, plan, mode: m }).then((r) => {
      let local = null;
      try { local = scoreLocal(problem, plan, m); } catch (e) { local = null; }
      return Object.assign({}, local || {}, r);
    });
  };

  /** POST /api/v1/verify: 서버 요구 사항 점검표(항목별 판정·기준·근거 표·날짜별 출전표). plan이 없으면 problem.plan */
  RestEngineAdapter.prototype.verify = function (problem, plan) {
    return this._fetch('/api/v1/verify', { problem, plan: plan || problem.plan || null });
  };

  /**
   * 일정의 지문. 서버 점검표(RequirementChecker)의 planSig와 같은 식: 시리즈(홈>원정/연전) · 연전 기간(시작일/연전) · 배정(시리즈 번호 순 기간 번호,
   * 없으면 -1)을 한 줄로 잇고 FNV-1a 32비트(UTF-8)로 줄인 8자리 16진수. 화면은 점검표의 planSig와 지금 일정의 지문이 같을 때만
   * 「이 일정의 점검표」로 보여 주고, 다르면 숨기지 않고 「다른 일정의 점검표」라고 알린다.
   */
  function planSignature(problem, plan) {
    const matches = problem.matches || [], cal = problem.calendar || [], p = plan || problem.plan || [];
    const slotOf = new Array(matches.length).fill(-1);
    for (const x of p) { if (x && x.match >= 0 && x.match < matches.length && x.calendar != null && x.calendar >= 0) slotOf[x.match] = x.calendar; }
    const text = matches.map((m) => m.home + '>' + m.away + '/' + (m.consecutive | 0)).join(',') + '|' +
      cal.map((c) => String(c.datetime || c.date || '').slice(0, 10) + '/' + (c.consecutive | 0)).join(',') + '|' + slotOf.join(',');
    return fnv1a(text);
  }
  function fnv1a(text) {
    const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text) : Buffer.from(text, 'utf8');
    let h = 0x811c9dc5;
    for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function createEngine(config) {
    const c = config || {};
    if (c.kind === 'REST') return new RestEngineAdapter(c);
    return new MockEngineAdapter(c);
  }

  KBO.Engine = { SolveHandle, MockEngineAdapter, RestEngineAdapter, createEngine, toSolverProblem, workerSource, scoreLocal, planSignature, fnv1a };
});
