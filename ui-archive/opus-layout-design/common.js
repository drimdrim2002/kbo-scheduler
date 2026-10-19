/* 레이아웃 와이어프레임 공통 헬퍼. data.js(window.KBO) 다음에 classic script로 불러온다. */
(function () {
  const K = window.KBO;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const teamNames = K.teams.map((t) => t.name);
  const teamOf = (name) => K.teams.find((t) => t.name === name);
  const color = (name) => K.colors[name] || "#888";
  const team = (name) => `<span class="team" style="--c:${color(name)}">${esc(name)}</span>`;
  const seriesInSlot = (i) => K.series.filter((s) => s.slot === i);
  const seriesOfTeam = (name) => K.series.filter((s) => s.home === name || s.away === name).sort((a, b) => a.slot - b.slot);
  const violationsAtSlot = (i) => state.violations.filter((v) => v.slot === i);

  const state = {
    violations: K.violations.slice(),
  };

  function hardBadge() {
    const n = state.violations.length;
    return n === 0
      ? `<span class="hard-badge ok" role="status"><span class="ico">✓</span>편성 가능 · Hard 0</span>`
      : `<span class="hard-badge bad" role="status"><span class="ico">⚠</span>Hard 위반 ${n}건</span>`;
  }

  // 구단별 홈(■)/원정(□) 스트립. 위반이 걸린 슬롯은 빨간 테두리로 표시한다.
  function haStrip(name, opts = {}) {
    const mine = seriesOfTeam(name);
    const bySlot = new Map(mine.map((s) => [s.slot, s]));
    let html = "";
    for (const sl of K.slots) {
      const s = bySlot.get(sl.i);
      if (!s) { html += `<span class="ha" title="${sl.label} 경기 없음"></span>`; continue; }
      const k = s.home === name ? "H" : "A";
      const v = state.violations.some((x) => x.slot === sl.i && x.team === name);
      const opp = k === "H" ? s.away : s.home;
      html += `<span class="ha ${k}${v ? " v" : ""}" title="${sl.label} ${k === "H" ? "홈" : "원정"} vs ${opp}"></span>`;
      if (opts.limit && sl.i + 1 >= opts.limit) break;
    }
    return html;
  }

  const avg = (key) => K.metrics.reduce((a, m) => a + m[key], 0) / K.metrics.length;
  const metricCols = [
    { key: "km", label: "이동거리(km)", tol: 300, scored: true },
    { key: "moves", label: "이동 횟수", tol: 2, scored: true },
    { key: "hol", label: "휴일 가중치", tol: 1.5, scored: true },
    { key: "wkHome", label: "주말 홈", ref: true },
    { key: "maxA", label: "최장 연속 원정", ref: true },
  ];

  // 구단별 지표 표. 채점 지표는 평균 ± 허용오차를 넘으면 ▲로 표시하고, 참고 지표는 '참고' 라벨을 단다.
  function metricsTable(container, opts = {}) {
    let sortKey = opts.sortKey || "km";
    let dir = -1;
    const cols = opts.cols ? metricCols.filter((c) => opts.cols.includes(c.key)) : metricCols;
    function render() {
      const rows = K.metrics.slice().sort((a, b) => (a[sortKey] - b[sortKey]) * dir);
      const head = cols.map((c) => `<th class="num" data-sort="${c.key}">${c.label}${c.ref ? ' <span class="tag ref">참고</span>' : ""}</th>`).join("");
      const body = rows.map((m) => {
        const tds = cols.map((c) => {
          const a = avg(c.key);
          const over = c.tol && Math.abs(m[c.key] - a) > c.tol;
          return `<td class="num${over ? " over" : ""}">${m[c.key].toLocaleString()}</td>`;
        }).join("");
        return `<tr data-pick="${m.team}"${opts.selected === m.team ? ' class="sel"' : ""}><td>${team(m.team)}</td>${tds}</tr>`;
      }).join("");
      const foot = cols.map((c) => `<td class="num faint">${avg(c.key).toFixed(c.key === "km" ? 0 : 1)}</td>`).join("");
      container.innerHTML = `<table class="grid"><thead><tr><th>구단</th>${head}</tr></thead><tbody>${body}</tbody>
        <tfoot><tr><td class="faint">리그 평균</td>${foot}</tr></tfoot></table>`;
      $$("th[data-sort]", container).forEach((th) => th.addEventListener("click", () => {
        dir = th.dataset.sort === sortKey ? -dir : -1;
        sortKey = th.dataset.sort;
        render();
      }));
      $$("tr[data-pick]", container).forEach((tr) => tr.addEventListener("click", () => {
        opts.selected = tr.dataset.pick;
        render();
        opts.onPick && opts.onPick(tr.dataset.pick);
      }));
    }
    render();
    return { render, select(name) { opts.selected = name; render(); } };
  }

  // §5.2.1 슬롯 자동 생성 규칙. 입력이 바뀌면 바로 다시 계산해 미리보기에 쓴다.
  function generateSlots(o) {
    const day = (s) => new Date(s + "T00:00:00");
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const inBlackout = (s) => o.blackouts.some((b) => s >= b.from && s <= b.to);
    const runs = [];
    let cur = [];
    for (let d = day(o.opening); iso(d) <= o.end; d.setDate(d.getDate() + 1)) {
      const s = iso(d);
      const play = (!o.restDays.includes(d.getDay()) || o.exceptions.includes(s)) && !inBlackout(s);
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
        slots.push({ date: iso(f), label: `${f.getMonth() + 1}/${f.getDate()}(${W[f.getDay()]})`, len, wk, hol, short: len < 2 });
      }
    }
    return slots;
  }

  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 1600);
  }

  // 와이어프레임 상단 띠, 주석 핀, 페이지 스크롤 점검 표시를 붙인다.
  function wire(title, notes) {
    const bar = document.createElement("div");
    bar.className = "wirebar";
    bar.innerHTML = '<a href="index.html" target="_top">← 레이아웃 목록</a><span class="wb-title">' + esc(title) + '</span>'
      + '<span class="wb-spacer"></span>'
      + '<span class="wb-scroll" id="wbScroll" title="문서 전체가 뷰포트보다 커지면 빨간색으로 바뀝니다">페이지 스크롤 점검…</span>'
      + '<button type="button" id="wbNotes" aria-pressed="false">주석 보기 (N)</button>';
    document.body.prepend(bar);
    const panel = document.createElement("aside");
    panel.className = "note-panel";
    panel.innerHTML = `<button class="btn sm close" type="button">닫기</button><strong>화면 영역 설명</strong>
      <ol>${notes.map((n) => `<li>${n}</li>`).join("")}</ol>`;
    document.body.appendChild(panel);
    // 화면이 다시 그려져도 주석 핀이 붙도록 DOM 변경을 지켜본다.
    const pinAll = () => $$("[data-note]:not(.has-pin)").forEach((el) => {
      const n = Number(el.dataset.note);
      const pin = document.createElement("span");
      pin.className = "note-pin";
      pin.textContent = n;
      pin.title = notes[n - 1] ? notes[n - 1].replace(/<[^>]+>/g, "") : "";
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      if (el.dataset.notePos === "right") pin.style.right = "4px"; else pin.style.left = "4px";
      pin.style.top = "4px";
      el.classList.add("has-pin");
      el.appendChild(pin);
    });
    pinAll();
    let pending = 0;
    new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; pinAll(); check(); }); })
      .observe(document.body, { childList: true, subtree: true });
    const btn = $("#wbNotes");
    const toggle = () => {
      const on = document.body.classList.toggle("notes-on");
      btn.setAttribute("aria-pressed", String(on));
    };
    btn.addEventListener("click", toggle);
    $(".close", panel).addEventListener("click", toggle);
    document.addEventListener("keydown", (e) => {
      if ((e.key === "n" || e.key === "N") && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) toggle();
    });
    const check = () => {
      const de = document.documentElement;
      const v = de.scrollHeight > window.innerHeight + 1 || de.scrollWidth > window.innerWidth + 1;
      de.dataset.overflow = v ? "yes" : "no";
      const el = $("#wbScroll");
      el.className = "wb-scroll " + (v ? "bad" : "ok");
      el.textContent = v
        ? `페이지 스크롤 발생 ${de.scrollWidth}×${de.scrollHeight}`
        : `페이지 스크롤 없음 ✓ ${window.innerWidth}×${window.innerHeight}`;
    };
    window.addEventListener("resize", check);
    document.addEventListener("click", () => setTimeout(check, 60));
    window.addEventListener("load", check);
    setTimeout(check, 0);
    return check;
  }

  // 탭 묶음: [role=tab][data-tab] 버튼이 [data-pane] 영역을 전환한다.
  function tabs(root, onChange) {
    const btns = $$("[data-tab]", root);
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      const scope = root.dataset.scope ? document.querySelector(root.dataset.scope) : document;
      $$("[data-pane]", scope).forEach((p) => {
        if (btns.some((x) => x.dataset.tab === p.dataset.pane)) p.hidden = p.dataset.pane !== b.dataset.tab;
      });
      onChange && onChange(b.dataset.tab);
    }));
  }

  window.W = { K, $, $$, esc, state, teamNames, teamOf, color, team, seriesInSlot, seriesOfTeam, violationsAtSlot, hardBadge, haStrip, avg, metricCols, metricsTable, generateSlots, toast, wire, tabs };
})();
