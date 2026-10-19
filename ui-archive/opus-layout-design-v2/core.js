/* 2차 시안 공통 코어. data.js(window.KBO) 다음에 classic script로 불러온다.
   편성 상태, 엔진과 같은 식의 JS 채점기, 목업 솔버, 지도 투영, 와이어프레임 HUD를 담는다. */
(function () {
  const K = window.KBO;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const T = K.teams.map((t) => t.name);
  const idx = Object.fromEntries(T.map((t, i) => [t, i]));
  const SHORT = { "문학경기장": "문학", "잠실종합운동장": "잠실", "수원KT위즈파크": "수원", "고척돔야구장": "고척", "한화이글스파크": "대전", "대구삼성라이언즈파크": "대구", "광주챔피언스필드": "광주", "창원NC파크": "창원", "사직야구장": "사직" };
  const stadium = (t) => K.teams[idx[t]].stadium;
  const park = (t) => SHORT[stadium(t)];
  const color = (t) => K.colors[t] || "#888";
  const dist = (a, b) => K.dist[idx[a]][idx[b]];
  const chip = (t, extra = "") => `<span class="tchip ${extra}" style="--c:${color(t)}">${esc(t)}</span>`;

  // 슬롯 → 실제 경기 날짜들. 날짜 → 슬롯 역참조도 만든다.
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const day = (s) => new Date(s + "T00:00:00");
  const slotDays = K.slots.map((sl) => {
    const out = [];
    const d = day(sl.date);
    for (let k = 0; k < sl.len; k++) { out.push(iso(d)); d.setDate(d.getDate() + 1); }
    return out;
  });
  const dayToSlot = {};
  slotDays.forEach((ds, i) => ds.forEach((d) => { dayToSlot[d] = i; }));

  // ── 편성 상태 ─────────────────────────────────────────
  const base = K.series.map((s) => ({ ...s, pin: false }));
  const clone = (p) => p.map((s) => ({ ...s }));
  // input_2025의 엔진 해는 위반 0이다. 결과 확인 단계를 보여 주려고 실제 위반 3건을 만드는 가상 변형을 얹는다.
  const SEEDS = [
    { op: "flip", id: 93, why: "한화–롯데 5/27 홈·원정 뒤집기 (가상)" },
    { op: "flip", id: 88, why: "롯데–LG 5/20 홈·원정 뒤집기 (가상)" },
    { op: "swap", a: 3, b: 15, why: "4/1 ↔ 5/13 슬롯 통째 교환 (가상)" },
  ];
  function applyOp(plan, o) {
    if (o.op === "flip") {
      const s = plan.find((x) => x.id === o.id);
      [s.home, s.away] = [s.away, s.home];
    } else if (o.op === "swap") {
      for (const s of plan) {
        if (s.slot === o.a) s.slot = o.b; else if (s.slot === o.b) s.slot = o.a;
      }
    } else if (o.op === "move") {
      plan.find((x) => x.id === o.id).slot = o.slot;
    } else if (o.op === "pin") {
      const s = plan.find((x) => x.id === o.id);
      s.pin = !s.pin;
    }
    return plan;
  }
  function seeded() {
    const p = clone(base);
    SEEDS.forEach((o) => applyOp(p, o));
    // 개막전·광복절 대진 지정 이벤트는 핀으로 처리한다(§6.1).
    p.forEach((s) => {
      if (s.slot === 0) s.pin = true;
      if (s.slot === 40 && s.home === "두산" && s.away === "LG") s.pin = true;
    });
    return p;
  }

  // ── 채점기: ScoreFormulas.evaluate와 같은 정의 ─────────
  const avgOf = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  function teamSeq(plan, t) {
    return plan.filter((s) => s.home === t || s.away === t).sort((a, b) => a.slot - b.slot);
  }
  function evaluate(plan) {
    const hard = [];
    const bySlot = new Map();
    for (const s of plan) {
      if (!bySlot.has(s.slot)) bySlot.set(s.slot, []);
      bySlot.get(s.slot).push(s);
    }
    const N = T.length;
    for (const [i, ss] of bySlot) {
      const teams = new Set();
      ss.forEach((s) => { teams.add(s.home); teams.add(s.away); });
      const parks = new Set(ss.map((s) => stadium(s.home)));
      const label = K.slots[i] ? K.slots[i].label : `#${i}`;
      if (teams.size !== N) hard.push({ rule: "H0-a", name: "슬롯 구단 수 ≠ 10", slot: i, n: Math.abs(teams.size - N), detail: `${label} 구단 ${teams.size}개` });
      if (parks.size !== N / 2) {
        const dup = ss.filter((s) => ss.some((o) => o !== s && stadium(o.home) === stadium(s.home)));
        hard.push({ rule: "H0-b", name: "슬롯 구장 수 ≠ 5", slot: i, n: Math.abs(parks.size - N / 2), team: dup[0] && dup[0].home, ids: dup.map((s) => s.id), detail: `${label} ${dup.length ? park(dup[0].home) + " 중복 (" + dup.map((s) => s.home).join("·") + " 동시 홈)" : "구장 " + parks.size + "개"}` });
      }
      if (ss.length !== N / 2) hard.push({ rule: "H0-c", name: "슬롯 시리즈 수 ≠ 5", slot: i, n: Math.abs(ss.length - N / 2), detail: `${label} 시리즈 ${ss.length}개` });
      const mism = ss.filter((s) => K.slots[i] && s.len !== K.slots[i].len);
      if (mism.length) hard.push({ rule: "H0-d", name: "연전 수 불일치", slot: i, n: mism.length, ids: mism.map((s) => s.id), detail: `${label} ${mism.length}개 시리즈 연전 수 불일치` });
    }
    const per = {};
    for (const t of T) {
      const seq = teamSeq(plan, t);
      let km = 0, moves = 0, hol = 0, wkHome = 0, run = 0, prev = null, maxH = 0, maxA = 0;
      seq.forEach((s, k) => {
        const h = s.home === t;
        const sl = K.slots[s.slot];
        if (h && sl) { hol += sl.hol; wkHome += sl.wk; }
        const kind = h ? "H" : "A";
        run = kind === prev ? run + 1 : 1;
        prev = kind;
        if (kind === "H") maxH = Math.max(maxH, run); else maxA = Math.max(maxA, run);
        if (run > 3) hard.push({ rule: "H0-f", name: "홈/원정 연속 3시리즈 초과", slot: s.slot, team: t, n: 1, ids: [s.id], detail: `${t} ${h ? "홈" : "원정"} ${run}연속 (${sl ? sl.label : ""})` });
        if (k > 0) {
          const d = dist(seq[k - 1].home, s.home);
          km += d;
          if (d > 0) moves++;
        }
      });
      per[t] = { team: t, km: Math.floor(km), moves, hol, wkHome, maxH, maxA, games: seq.length };
    }
    // H1: 직전 슬롯이 비어 있으면 비교하지 않는다.
    for (const [i, ss] of bySlot) {
      const prevS = bySlot.get(i - 1);
      if (!prevS) continue;
      const keys = new Set(prevS.map((s) => [s.home, s.away].sort().join("|")));
      ss.forEach((s) => {
        if (keys.has([s.home, s.away].sort().join("|"))) hard.push({ rule: "H1", name: "인접 슬롯 같은 대진", slot: i, team: s.home, n: 1, ids: [s.id], detail: `${s.away}@${s.home} ${K.slots[i - 1].label}·${K.slots[i].label} 연속` });
      });
    }
    const vals = (k) => T.map((t) => per[t][k]);
    const aMoves = avgOf(vals("moves")), aKm = avgOf(vals("km")), aHol = avgOf(vals("hol"));
    const S0 = plan.filter((s) => s.slot == null || s.slot < 0).length;
    const S1 = T.reduce((a, t) => a + Math.floor(Math.abs(per[t].moves - aMoves) / 2) ** 2 * 100, 0);
    const S2 = T.reduce((a, t) => a + Math.max(0, Math.round(Math.abs(per[t].km - aKm) * 10) - 3000) ** 2, 0);
    const S3 = T.reduce((a, t) => a + Math.floor(Math.abs(per[t].hol - aHol) / 1.5) ** 2, 0);
    const S4 = T.reduce((a, t) => a + per[t].km, 0);
    const hardSum = hard.reduce((a, v) => a + v.n, 0);
    hard.sort((a, b) => a.slot - b.slot);
    return { hard, hardSum, per, avg: { km: aKm, moves: aMoves, hol: aHol, wkHome: avgOf(vals("wkHome")) }, soft: { S0, S1, S2, S3, S4 } };
  }
  const scoreText = (e) => `${-e.hardSum}hard / ${-e.soft.S0}·${-e.soft.S1}·${-e.soft.S2}·${-e.soft.S3}·${-e.soft.S4}soft`;
  const badge = (e) => e.hardSum === 0
    ? `<span class="hbadge ok" role="status">✓ 편성 가능 · Hard 0</span>`
    : `<span class="hbadge bad" role="status">⚠ Hard 위반 ${e.hard.length}건</span>`;

  // ── 상태 저장소: 변경 이력과 구독 ───────────────────────
  const store = {
    plan: seeded(),
    past: [],
    future: [],
    subs: [],
    ev: null,
    on(fn) { this.subs.push(fn); },
    emit(info) { this.ev = evaluate(this.plan); this.subs.forEach((f) => f(this.ev, info)); },
    apply(o, info) {
      const s = o.id != null && this.plan.find((x) => x.id === o.id);
      if (s && s.pin && o.op !== "pin") { toast("고정된 시리즈는 옮길 수 없습니다"); return false; }
      this.past.push(clone(this.plan));
      if (this.past.length > 60) this.past.shift();
      this.future = [];
      applyOp(this.plan, o);
      this.emit(info || o);
      return true;
    },
    undo() { if (!this.past.length) return; this.future.push(clone(this.plan)); this.plan = this.past.pop(); this.emit({ op: "undo" }); },
    redo() { if (!this.future.length) return; this.past.push(clone(this.plan)); this.plan = this.future.pop(); this.emit({ op: "redo" }); },
    reset() { this.past.push(clone(this.plan)); this.plan = seeded(); this.emit({ op: "reset" }); },
    get(id) { return this.plan.find((x) => x.id === id); },
    inSlot(i) { return this.plan.filter((s) => s.slot === i); },
  };
  store.ev = evaluate(store.plan);

  // 한 번 적용했을 때의 Δ를 미리 계산한다(드롭 전 미리보기, 명령 카드, 후보 순위에 쓴다).
  function preview(o) {
    const p = applyOp(clone(store.plan), o);
    const e = evaluate(p);
    const now = store.ev;
    return { ev: e, dHard: e.hardSum - now.hardSum, dKm: e.soft.S4 - now.soft.S4, dTeam: Object.fromEntries(T.map((t) => [t, e.per[t].km - now.per[t].km])) };
  }

  // ── 목업 솔버: 고정되지 않은 시리즈를 엔진 해(input_2025) 쪽으로 한 단계씩 되돌리며 점수를 개선한다 ──
  function solve({ onTick, onDone, interval = 140 } = {}) {
    let stop = false;
    let steps = 0;
    const started = performance.now();
    const tick = () => {
      if (stop) return;
      const diffs = store.plan.filter((s) => {
        if (s.pin) return false;
        const b = base.find((x) => x.id === s.id);
        return b.slot !== s.slot || b.home !== s.home;
      });
      if (!diffs.length) { onDone && onDone(store.ev, steps); return; }
      // 슬롯 교환은 쌍으로 되돌려야 Hard가 깨지지 않으므로 슬롯 단위로 묶는다.
      const groups = new Map();
      diffs.forEach((s) => {
        const b = base.find((x) => x.id === s.id);
        const key = b.slot !== s.slot ? "slot:" + [b.slot, s.slot].sort((x, y) => x - y).join("-") : "flip:" + s.id;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(s);
      });
      let best = null;
      for (const [key, g] of groups) {
        const p = clone(store.plan);
        const ids = key.startsWith("slot:") ? diffs.filter((s) => { const b = base.find((x) => x.id === s.id); return [b.slot, s.slot].sort((x, y) => x - y).join("-") === key.slice(5); }).map((s) => s.id) : g.map((s) => s.id);
        ids.forEach((id) => { const b = base.find((x) => x.id === id); const s = p.find((x) => x.id === id); s.slot = b.slot; s.home = b.home; s.away = b.away; });
        const e = evaluate(p);
        const val = e.hardSum * 1e9 + e.soft.S4;
        if (!best || val < best.val) best = { val, p };
      }
      store.past.push(clone(store.plan));
      store.plan = best.p;
      steps++;
      store.emit({ op: "solve", steps, ms: performance.now() - started });
      onTick && onTick(store.ev, steps);
      setTimeout(tick, interval);
    };
    setTimeout(tick, interval);
    return { stop() { stop = true; } };
  }

  // ── 지도: 남한 윤곽(근사)과 위경도 투영 ─────────────────
  const KOREA = [[37.75, 126.55], [37.95, 126.9], [38.25, 127.2], [38.3, 127.8], [38.35, 128.1], [38.6, 128.35], [38.2, 128.6], [37.75, 128.95], [37.4, 129.25], [37.0, 129.4], [36.5, 129.45], [36.0, 129.55], [35.5, 129.45], [35.3, 129.3], [35.1, 129.1], [35.05, 128.8], [34.9, 128.5], [34.85, 128.0], [34.7, 127.7], [34.55, 127.3], [34.45, 126.9], [34.3, 126.55], [34.6, 126.3], [35.0, 126.35], [35.4, 126.45], [35.75, 126.6], [36.0, 126.55], [36.4, 126.5], [36.8, 126.15], [37.0, 126.75], [37.25, 126.6], [37.45, 126.6]];
  function projector(w, h, pad = 12, box = { n: 38.7, s: 34.2, w: 125.9, e: 129.7 }) {
    const kx = Math.cos((36 * Math.PI) / 180);
    const spanX = (box.e - box.w) * kx, spanY = box.n - box.s;
    const sc = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    const ox = (w - spanX * sc) / 2, oy = (h - spanY * sc) / 2;
    return (lat, lng) => [ox + (lng - box.w) * kx * sc, oy + (box.n - lat) * sc];
  }
  // 잠실 공유 구장은 두 구단 점이 겹치지 않도록 살짝 벌린다.
  function teamXY(P, t) {
    const tm = K.teams[idx[t]];
    const [x, y] = P(tm.lat, tm.lng);
    return t === "두산" ? [x - 5, y] : t === "LG" ? [x + 5, y] : [x, y];
  }
  function mapBase(P, opts = {}) {
    const d = KOREA.map(([la, ln], k) => (k ? "L" : "M") + P(la, ln).map((v) => v.toFixed(1)).join(",")).join("") + "Z";
    const parks = new Map();
    K.teams.forEach((t) => { if (!parks.has(t.stadium)) parks.set(t.stadium, t); });
    const labels = opts.labels === false ? "" : [...parks.values()].map((t) => {
      const [x, y] = P(t.lat, t.lng);
      return `<text class="map-lbl" x="${(x + 7).toFixed(1)}" y="${(y + 3).toFixed(1)}">${SHORT[t.stadium]}</text>`;
    }).join("");
    return `<path class="map-land" d="${d}"/>${labels}`;
  }
  const arc = (a, b, bend = 0.18) => {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${(mx - dy * bend).toFixed(1)},${(my + dx * bend).toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
  };

  // §5.2.1 슬롯 자동 생성 규칙(1차 시안 common.js와 같은 구현). 입력 단계 미리보기에 쓴다.
  function generateSlots(o) {
    const inBlackout = (s) => o.blackouts.some((b) => s >= b.from && s <= b.to);
    const runs = [];
    let cur = [];
    for (let d = day(o.opening); iso(d) <= o.end; d.setDate(d.getDate() + 1)) {
      const s = iso(d);
      const play = (!o.restDays.includes(d.getDay()) || (o.exceptions || []).includes(s)) && !inBlackout(s);
      if (play) cur.push(new Date(d)); else if (cur.length) { runs.push(cur); cur = []; }
    }
    if (cur.length) runs.push(cur);
    const W = "일월화수목금토";
    const slots = [];
    for (const run of runs) {
      const L = run.length, r = L % 3;
      let parts = [];
      if (L < 2) parts = [L];
      else if (r === 0) parts = Array(L / 3).fill(3);
      else if (r === 1) parts = L === 4 ? [4] : [...Array((L - 4) / 3).fill(3), 4];
      else parts = [2, ...Array((L - 2) / 3).fill(3)];
      let k = 0;
      for (const len of parts) {
        const days = run.slice(k, k + len);
        k += len;
        const wk = days.some((d) => d.getDay() === 0 || d.getDay() === 6) ? 1 : 0;
        const hasHol = days.some((d) => o.holidays.includes(iso(d)));
        const hol = wk ? (hasHol ? 3 : 2) : (hasHol ? 2 : 0);
        const f = days[0];
        slots.push({ date: iso(f), days: days.map(iso), label: `${f.getMonth() + 1}/${f.getDate()}(${W[f.getDay()]})`, len, wk, hol, short: len < 2 });
      }
    }
    return slots;
  }
  const defaultSkeleton = () => ({ opening: "2025-03-22", end: "2025-08-31", restDays: [1], exceptions: ["2025-05-05"], holidays: K.holidays.slice(), blackouts: K.blackouts.map((b) => ({ ...b })) });

  // ── 우천 취소 재편성(목업): 9/2부터 날짜 순으로 넣되 하루에 구단 1경기·구장 1대진을 지킨다(RH-1·RH-2) ──
  function rebook(games, { monday = false, dh = false, from = "2025-09-02", to = "2025-10-31" } = {}) {
    const placed = [];
    const used = {};
    const left = games.slice();
    for (let d = day(from); iso(d) <= to && left.length; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 1 && !monday) continue;
      const key = iso(d);
      used[key] = used[key] || { teams: new Set(), parks: new Set() };
      const u = used[key];
      for (let k = 0; k < left.length; k++) {
        const g = left[k];
        if (u.teams.has(g.home) || u.teams.has(g.away) || u.parks.has(stadium(g.home))) continue;
        u.teams.add(g.home); u.teams.add(g.away); u.parks.add(stadium(g.home));
        placed.push({ ...g, date: key, dh: false });
        left.splice(k, 1); k--;
        // DH 허용 시 같은 대진의 다음 취소 경기를 같은 날 붙인다.
        if (dh) {
          const j = left.findIndex((x) => x.home === g.home && x.away === g.away);
          if (j >= 0) { placed.push({ ...left[j], date: key, dh: true }); left.splice(j, 1); }
        }
      }
    }
    const last = placed.reduce((a, g) => (g.date > a ? g.date : a), "");
    return { placed, unplaced: left, last };
  }

  // ── 작은 UI 도구 ─────────────────────────────────────
  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 1800);
  }
  // 와이어프레임 HUD: 갤러리 링크와 페이지 스크롤 점검. 화면 높이를 차지하지 않도록 떠 있는 알약으로 둔다.
  function hud(title, corner = "bl") {
    const el = document.createElement("div");
    el.className = "hud " + corner;
    el.title = `${title} · 와이어프레임 도구(앱의 일부가 아님)`;
    el.innerHTML = `<a href="index.html" title="시안 갤러리로">◀ 갤러리</a><span id="hudScroll">…</span>`;
    document.body.appendChild(el);
    const check = () => {
      const de = document.documentElement;
      const bad = de.scrollHeight > window.innerHeight + 1 || de.scrollWidth > window.innerWidth + 1;
      const s = $("#hudScroll");
      s.className = bad ? "bad" : "ok";
      s.textContent = bad ? `✗ 스크롤 ${de.scrollWidth}×${de.scrollHeight}` : `✓ ${window.innerWidth}×${window.innerHeight}`;
      s.title = bad ? "문서가 뷰포트보다 큽니다" : "페이지 스크롤 없음";
    };
    window.addEventListener("resize", check);
    window.addEventListener("load", check);
    document.addEventListener("click", () => setTimeout(check, 50));
    setTimeout(check, 0);
  }
  const fmt = (n) => Math.round(n).toLocaleString("ko-KR");
  const sign = (n, unit = "") => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmt(Math.abs(n)) + unit;

  window.KB = { K, $, $$, esc, T, idx, SHORT, stadium, park, color, dist, chip, iso, day, slotDays, dayToSlot, base, SEEDS, clone, applyOp, seeded, evaluate, teamSeq, scoreText, badge, store, preview, solve, KOREA, projector, teamXY, mapBase, arc, generateSlots, defaultSkeleton, rebook, toast, hud, fmt, sign };
})();
