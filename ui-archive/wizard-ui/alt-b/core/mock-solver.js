/*
 * KBO 공통 코어 — Mock 엔진 (브라우저 내 로컬서치, §7.2).
 * Worker와 메인 스레드가 같은 코드를 쓴다. 품질은 보장하지 않는다("시뮬레이션 엔진").
 *  - 변수: 시리즈의 슬롯 배정. 핀은 움직이지 않는다.
 *  - 이동: 슬롯 변경, 두 시리즈 슬롯 교환, 같은 길이 슬롯 간 시리즈 묶음 교환
 *  - 수락: Late Acceptance, Hard → Soft 사전식 비교
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).mockSolver = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  /** 시드 난수 (mulberry32) */
  function rng(seed) {
    let a = (seed >>> 0) || 0x9E3779B9;
    const next = function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (n) => Math.floor(next() * n);
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    return next;
  }

  function cmp(a, b) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    return 0;
  }

  /**
   * 완전 매칭 기반 구성 휴리스틱. 슬롯마다 같은 길이의 남은 시리즈로 완전 매칭을 찾는다.
   * 남은 시리즈가 많은 구단쌍을 먼저 쓰고, 같은 구장 중복과 직전 슬롯 동일 대진을 피한다.
   */
  function construct(ctx, plan, random) {
    const { N, S, M } = ctx;
    const free = [];
    for (let m = 0; m < M; m++) if (!ctx.pinned[m]) { plan[m] = -1; free.push(m); }
    const remainingByPair = new Map();
    for (const m of free) remainingByPair.set(ctx.pairKey[m], (remainingByPair.get(ctx.pairKey[m]) || 0) + 1);
    const used = new Uint8Array(M);
    let prevPairs = new Set();
    for (let s = 0; s < S; s++) {
      const L = ctx.slotLen[s];
      let blocked = 0;
      let stadiumBlocked = 0;
      let count = 0;
      for (let m = 0; m < M; m++) {
        if (ctx.pinned[m] && plan[m] === s) { blocked |= (1 << ctx.home[m]) | (1 << ctx.away[m]); stadiumBlocked |= 1 << ctx.stadiumOf[ctx.home[m]]; count++; }
      }
      const cands = free.filter((m) => !used[m] && ctx.len[m] === L);
      random.shuffle(cands);
      cands.sort((x, y) => (remainingByPair.get(ctx.pairKey[y]) || 0) - (remainingByPair.get(ctx.pairKey[x]) || 0));
      const byTeam = [];
      for (let t = 0; t < N; t++) byTeam.push([]);
      for (const m of cands) { byTeam[ctx.home[m]].push(m); byTeam[ctx.away[m]].push(m); }
      const target = ctx.seriesPerDay - count;
      let best = [];
      let budget = 4000;
      const chosen = [];
      function dfs(mask, stad, strict) {
        if (chosen.length > best.length) best = chosen.slice();
        if (chosen.length === target || budget-- <= 0) return chosen.length === target;
        let t = 0;
        while (t < N && (mask & (1 << t))) t++;
        if (t >= N) return false;
        for (const m of byTeam[t]) {
          if (used[m]) continue;
          const other = ctx.home[m] === t ? ctx.away[m] : ctx.home[m];
          if (mask & (1 << other)) continue;
          const st = 1 << ctx.stadiumOf[ctx.home[m]];
          if (strict && (stad & st)) continue;
          if (strict && prevPairs.has(ctx.pairKey[m])) continue;
          used[m] = 1; chosen.push(m);
          if (dfs(mask | (1 << t) | (1 << other), stad | st, strict)) return true;
          used[m] = 0; chosen.pop();
        }
        // 구단 t를 이번 슬롯에서 쉬게 하는 경우는 완전 매칭이 불가능할 때만 남는다
        return false;
      }
      function attempt(strict) {
        chosen.length = 0; best = []; budget = 4000;
        const ok = dfs(blocked, stadiumBlocked, strict);
        const res = ok ? chosen.slice() : best;
        for (const m of chosen) used[m] = 0;
        return { ok, res };
      }
      let pick = attempt(true);
      if (!pick.ok) { const loose = attempt(false); if (loose.ok || loose.res.length > pick.res.length) pick = loose; }
      chosen.length = 0;
      for (const m of pick.res) { used[m] = 1; chosen.push(m); }
      prevPairs = new Set();
      for (const m of chosen) {
        plan[m] = s;
        remainingByPair.set(ctx.pairKey[m], remainingByPair.get(ctx.pairKey[m]) - 1);
      }
      for (let m = 0; m < M; m++) if (plan[m] === s) prevPairs.add(ctx.pairKey[m]);
    }
    // 남은 시리즈는 같은 길이 슬롯 중 가장 덜 찬 곳에 넣는다
    const fill = new Int32Array(S);
    for (let m = 0; m < M; m++) if (plan[m] >= 0) fill[plan[m]]++;
    for (const m of free) {
      if (plan[m] >= 0) continue;
      let bestS = -1;
      for (let s = 0; s < S; s++) if (ctx.slotLen[s] === ctx.len[m] && (bestS < 0 || fill[s] < fill[bestS])) bestS = s;
      if (bestS < 0) bestS = random.int(S);
      plan[m] = bestS; fill[bestS]++;
    }
    return plan;
  }

  /**
   * 1차 편성(INITIAL) 탐색기.
   * input: Score.buildInput 결과 + plan(Int32Array 또는 배열), options: { seed, init: 'KEEP'|'SCRATCH', lateSize }
   */
  function createInitialSearch(input, options) {
    const Score = KBO.Score;
    const ctx = Score.createContext(input);
    const random = rng((options && options.seed) || 42);
    const M = ctx.M, S = ctx.S;
    const plan = new Int32Array(M).fill(-1);
    if (input.plan) for (let m = 0; m < M; m++) plan[m] = input.plan[m] == null ? -1 : input.plan[m];
    if (options && options.init === 'SCRATCH') construct(ctx, plan, random);
    const movable = [];
    for (let m = 0; m < M; m++) if (!ctx.pinned[m]) movable.push(m);
    const slotsByLen = new Map();
    for (let s = 0; s < S; s++) {
      const L = ctx.slotLen[s];
      if (!slotsByLen.has(L)) slotsByLen.set(L, []);
      slotsByLen.get(L).push(s);
    }
    const lateSize = (options && options.lateSize) || 600;
    const cur = Score.evaluate(ctx, plan, new Array(7));
    const best = cur.slice();
    const bestPlan = Int32Array.from(plan);
    const history = [];
    for (let i = 0; i < lateSize; i++) history.push(cur.slice());
    const cand = new Array(7);
    let iter = 0;
    let improvements = 0;
    const touched = [];
    const oldVals = [];

    function sameLenSlot(L) {
      const list = slotsByLen.get(L);
      return list ? list[random.int(list.length)] : random.int(S);
    }

    function propose() {
      touched.length = 0; oldVals.length = 0;
      if (!movable.length) return false;
      const r = random();
      if (r < 0.55) {
        // 교환: 같은 길이 다른 슬롯의 시리즈 우선
        const m1 = movable[random.int(movable.length)];
        if (plan[m1] < 0) { touched.push(m1); oldVals.push(-1); plan[m1] = sameLenSlot(ctx.len[m1]); return true; }
        let m2 = -1;
        if (random() < 0.7) {
          const s2 = sameLenSlot(ctx.len[m1]);
          if (s2 === plan[m1]) return false;
          const inSlot = [];
          for (const m of movable) if (plan[m] === s2) inSlot.push(m);
          if (!inSlot.length) return false;
          m2 = inSlot[random.int(inSlot.length)];
        } else {
          m2 = movable[random.int(movable.length)];
          if (plan[m2] === plan[m1] || plan[m2] < 0) return false;
        }
        touched.push(m1, m2); oldVals.push(plan[m1], plan[m2]);
        const t = plan[m1]; plan[m1] = plan[m2]; plan[m2] = t;
        return true;
      }
      if (r < 0.75) {
        // 변경
        const m = movable[random.int(movable.length)];
        const target = random() < 0.85 ? sameLenSlot(ctx.len[m]) : random.int(S);
        if (target === plan[m]) return false;
        touched.push(m); oldVals.push(plan[m]);
        plan[m] = target;
        return true;
      }
      // 묶음 교환: 같은 길이 두 슬롯의 비고정 시리즈 전체
      const s1 = random.int(S);
      const s2 = sameLenSlot(ctx.slotLen[s1]);
      if (s1 === s2) return false;
      for (const m of movable) {
        if (plan[m] === s1) { touched.push(m); oldVals.push(s1); plan[m] = s2; }
        else if (plan[m] === s2) { touched.push(m); oldVals.push(s2); plan[m] = s1; }
      }
      return touched.length > 0;
    }

    function undo() {
      for (let i = touched.length - 1; i >= 0; i--) plan[touched[i]] = oldVals[i];
    }

    return {
      mode: 'INITIAL',
      ctx,
      step(n) {
        let improved = false;
        for (let k = 0; k < n; k++) {
          if (!propose()) continue;
          Score.evaluate(ctx, plan, cand);
          const slot = iter % lateSize;
          iter++;
          if (cmp(cand, history[slot]) >= 0 || cmp(cand, cur) >= 0) {
            for (let i = 0; i < 7; i++) cur[i] = cand[i];
            if (cmp(cur, best) > 0) {
              for (let i = 0; i < 7; i++) best[i] = cur[i];
              bestPlan.set(plan);
              improvements++;
              improved = true;
            }
          } else {
            undo();
          }
          const h = history[slot];
          for (let i = 0; i < 7; i++) h[i] = cur[i];
        }
        return improved;
      },
      bestScore() { return best.slice(); },
      bestPlanArray() { return Int32Array.from(bestPlan); },
      bestPlanList() { return Score.planListFrom(bestPlan); },
      bestScoreObject() { return Score.toScore(best, 2); },
      improvements() { return improvements; },
      iterations() { return iter; }
    };
  }

  function createSearch(problem, options) {
    if (problem.mode === 'RESCHEDULE') return KBO.Reschedule.createSearch(problem.input, options);
    return createInitialSearch(problem.input, options);
  }

  /**
   * time-slicing 드라이버. 메인 스레드와 Worker 공용.
   * hooks: { onBest(payload), onDone(payload), onProgress(payload) }
   * options: { timeLimitSec, unimprovedSec, emitIntervalMs (250), chunkMs (12) }
   */
  function runDriver(search, options, hooks, timers) {
    const T = timers || { now: () => Date.now(), later: (fn) => setTimeout(fn, 0) };
    const timeLimitMs = Math.max(1, (options.timeLimitSec || 60) * 1000);
    const unimprovedMs = options.unimprovedSec ? options.unimprovedSec * 1000 : Infinity;
    const emitInterval = options.emitIntervalMs || 250;
    const chunkMs = options.chunkMs || 12;
    let elapsed = 0;
    let lastImproveAt = 0;
    let lastEmit = -Infinity;
    let dirty = true;
    let state = 'RUNNING';
    let finished = false;
    let batch = 64;

    function payload() {
      return { plan: search.bestPlanList(), score: search.bestScoreObject(), elapsedMs: Math.round(elapsed), improvementCount: search.improvements(), iterations: search.iterations(), mode: search.mode };
    }
    function finish(reason) {
      if (finished) return;
      finished = true;
      state = 'DONE';
      const p = payload();
      p.reason = reason;
      hooks.onDone && hooks.onDone(p);
    }
    function tick() {
      if (finished || state !== 'RUNNING') return;
      const t0 = T.now();
      let n = 0;
      while (T.now() - t0 < chunkMs) {
        if (search.step(batch)) { dirty = true; lastImproveAt = elapsed + (T.now() - t0); }
        n += batch;
      }
      elapsed += T.now() - t0;
      if (dirty && elapsed - lastEmit >= emitInterval) {
        dirty = false;
        lastEmit = elapsed;
        hooks.onBest && hooks.onBest(payload());
      }
      if (elapsed >= timeLimitMs) return finish('TIME_LIMIT');
      if (elapsed - lastImproveAt >= unimprovedMs) return finish('UNIMPROVED');
      T.later(tick);
    }
    // 첫 해는 바로 알린다(AC-5: 1초 안 갱신)
    hooks.onBest && hooks.onBest(payload());
    lastEmit = 0; dirty = false;
    T.later(tick);
    return {
      pause() { if (state === 'RUNNING') state = 'PAUSED'; },
      resume() { if (state === 'PAUSED') { state = 'RUNNING'; T.later(tick); } },
      stop() { if (!finished) { if (dirty) hooks.onBest && hooks.onBest(payload()); finish('STOPPED'); } },
      state() { return state; }
    };
  }

  /** Worker 진입점. self.onmessage로 solve/pause/resume/stop을 받는다. */
  function workerMain(self) {
    let driver = null;
    self.onmessage = function (e) {
      const msg = e.data || {};
      try {
        if (msg.type === 'solve') {
          if (driver) driver.stop();
          const search = createSearch(msg.problem, msg.options || {});
          driver = runDriver(search, msg.options || {}, {
            onBest: (p) => self.postMessage({ type: 'best', payload: p }),
            onDone: (p) => self.postMessage({ type: 'done', payload: p })
          });
        } else if (msg.type === 'pause' && driver) driver.pause();
        else if (msg.type === 'resume' && driver) driver.resume();
        else if (msg.type === 'stop' && driver) driver.stop();
        else if (msg.type === 'ping') self.postMessage({ type: 'pong' });
      } catch (err) {
        self.postMessage({ type: 'error', payload: { message: String(err && err.message || err), stack: String(err && err.stack || '') } });
      }
    };
    self.postMessage({ type: 'ready' });
  }

  KBO.MockSolver = { rng, cmp, construct, createInitialSearch, createSearch, runDriver, workerMain };
});
