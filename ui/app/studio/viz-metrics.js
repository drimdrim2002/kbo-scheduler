/*
 * std 편성 스튜디오 — ④ 지표 간략 차트 (W18). 순수 함수: SVG 문자열을 돌려준다.
 *   S.mchart.distanceBars(o)  구단별 총 이동거리 가로 막대 — 평균 점선, ±300km 띠, 초과는 빗금 + ▲
 *                             출처: alt-b app/rail/charts.js bars(), alt-c wb-step4.js "차트 1"
 *   S.mchart.dotRows(o)       이동 횟수 · 휴일 가중치 · 주말 홈 점 차트 3줄 — 평균선, 허용오차 띠, 점마다 구단 이름, 초과는 ▲
 *                             출처: alt-c wb-charts.js dots()
 * 막대·점은 role=button + data-act="q-team"이라 누르면(또는 Enter) 같은 구단이 표·차트·카드에서 함께 강조된다.
 */
(function () {
  'use strict';
  const S = window.Studio;
  const { esc, fmt } = S;
  const M = S.mchart = {};
  let uid = 0;

  function nice(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p;
    return 10 * p;
  }

  /**
   * o: { items:[{name, value, over, color}], mean, tol, sel, width, rowH, fmt, title }
   * 축은 최솟값 근처에서 시작한다(차이를 보이려고). 시작 값은 축 왼쪽 끝에 적는다.
   */
  M.distanceBars = function (o) {
    const items = o.items.slice().sort((a, b) => b.value - a.value);
    const W = o.width || 420, rowH = o.rowH || 18, left = 46, right = 70, top = 18, bottom = o.ticks === false ? 6 : 18;
    const H = top + items.length * rowH + bottom;
    const f = o.fmt || ((v) => fmt.km(v));
    const vals = items.map((x) => x.value);
    const lo0 = Math.min(...vals, o.mean - o.tol), hi0 = Math.max(...vals, o.mean + o.tol);
    const step = nice((hi0 - lo0) / (o.tickN || 4));
    const lo = Math.floor((lo0 - step * 0.5) / step) * step, hi = Math.ceil((hi0 + step * 0.2) / step) * step;
    const x = (v) => left + (W - left - right) * ((v - lo) / (hi - lo || 1));
    const pid = 'mch' + (++uid);
    let s = '<svg class="mc" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || '구단별 총 이동거리') + '">';
    s += '<defs><pattern id="' + pid + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#FCEBEA"/><line x1="0" y1="0" x2="0" y2="5" stroke="#B3261E" stroke-width="2.2"/></pattern></defs>';
    const yb = top + items.length * rowH;
    s += '<rect class="mc-band" x="' + x(o.mean - o.tol).toFixed(1) + '" y="' + (top - 4) + '" width="' + (x(o.mean + o.tol) - x(o.mean - o.tol)).toFixed(1) + '" height="' + (yb - top + 6) + '"/>';
    for (let v = lo; v <= hi + 1e-6; v += step) {
      s += '<line class="mc-grid" x1="' + x(v).toFixed(1) + '" x2="' + x(v).toFixed(1) + '" y1="' + (top - 4) + '" y2="' + yb + '"/>';
      if (o.ticks !== false) s += '<text class="mc-tick" x="' + x(v).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + esc(fmt.int(v)) + '</text>';
    }
    items.forEach((it, i) => {
      const y = top + i * rowH;
      const w = Math.max(1, x(it.value) - x(lo));
      const sel = o.sel === it.name;
      s += '<g class="mc-item' + (sel ? ' sel' : '') + (it.over ? ' over' : '') + '" data-act="q-team" data-team="' + esc(it.name) + '" role="button" tabindex="0" aria-label="' + esc(it.name + ' 총 이동거리 ' + f(it.value) + 'km' + (it.over ? ', 허용 범위 밖' : '')) + '">';
      if (sel) s += '<rect class="mc-selrow" x="0" y="' + y + '" width="' + W + '" height="' + rowH + '"/>';
      s += '<rect class="mc-hit" x="0" y="' + y + '" width="' + W + '" height="' + rowH + '"/>';
      s += '<text class="mc-label" x="' + (left - 6) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end">' + esc(it.name) + '</text>';
      s += '<rect x="' + x(lo).toFixed(1) + '" y="' + (y + 3) + '" width="' + w.toFixed(1) + '" height="' + (rowH - 6) + '" rx="1.5" fill="' + (it.over ? 'url(#' + pid + ')' : sel ? '#0A1E3C' : '#7E9FDB') + '"' + (it.over ? ' stroke="#B3261E" stroke-width="1"' : '') + '/>';
      s += '<text class="mc-val' + (it.over ? ' over' : '') + '" x="' + (x(lo) + w + 5).toFixed(1) + '" y="' + (y + rowH / 2 + 4) + '">' + esc(f(it.value)) + (it.over ? ' ▲' : '') + '</text>';
      s += '<title>' + esc(it.name + ' ' + f(it.value) + 'km · 평균 대비 ' + fmt.signed1(it.value - o.mean) + (it.over ? ' · 허용 범위 밖' : '')) + '</title></g>';
    });
    s += '<line class="mc-mean" x1="' + x(o.mean).toFixed(1) + '" x2="' + x(o.mean).toFixed(1) + '" y1="' + (top - 6) + '" y2="' + (yb + 2) + '"/>';
    s += '<text class="mc-mean-lbl" x="' + (x(o.mean) - 3).toFixed(1) + '" y="' + (top - 7) + '" text-anchor="end">평균 ' + esc(f(o.mean)) + '</text>';
    return s + '</svg>';
  };

  /**
   * o: { rows:[{title, sub, items:[{name, value, over}], mean, tol, fmt}], sel, width, rowH, bare }
   * 점 위·아래로 구단 이름을 번갈아 적어 겹침을 피한다(alt-c 방식).
   * opt-2: bare = true면 지표 하나짜리 차트로 그린다. 줄 제목은 상자 머리글로 옮기고(왼쪽 여백 없음),
   *        아래에 눈금, 위에 평균 글자를 적는다. 대시보드 2×2 격자의 점 차트 3개가 이 모양이다.
   */
  M.dotRows = function (o) {
    const bare = !!o.bare;
    const W = o.width || 420, rowH = o.rowH || 66, left = bare ? 14 : 96, right = 14;
    const H = o.rows.length * rowH;
    let s = '<svg class="mc" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.title || '이동 횟수 · 휴일 경기 점수 · 주말 홈') + '">';
    o.rows.forEach((row, ri) => {
      const top = ri * rowH, cy = bare ? top + Math.round((rowH - 14) * 0.52) : top + rowH * 0.5;
      const f = row.fmt || ((v) => fmt.num1(v));
      const vals = row.items.map((x) => x.value);
      const pad = Math.max(row.tol * 0.35, 0.5);
      const lo = Math.min(...vals, row.mean - row.tol) - pad, hi = Math.max(...vals, row.mean + row.tol) + pad;
      const x = (v) => left + (W - left - right) * ((v - lo) / (hi - lo || 1));
      const bh = bare ? 24 : 20;
      if (!bare) {
        s += '<text class="mc-row-title" x="4" y="' + (cy - 3) + '">' + esc(row.title) + '</text>';
        s += '<text class="mc-tick" x="4" y="' + (cy + 11) + '">평균 ' + esc(f(row.mean)) + ' ±' + row.tol + '</text>';
      } else {
        // 눈금: 정수 간격(값 범위가 좁아 1·2·5 단위)
        const span = hi - lo, want = Math.max(2, Math.floor((W - left - right) / 46));
        let st = nice(span / want); if (st < 1) st = 1;
        for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-6; v += st) {
          s += '<line class="mc-grid" x1="' + x(v).toFixed(1) + '" x2="' + x(v).toFixed(1) + '" y1="' + (top + 16) + '" y2="' + (top + rowH - 16) + '"/>';
          s += '<text class="mc-tick" x="' + x(v).toFixed(1) + '" y="' + (top + rowH - 4) + '" text-anchor="middle">' + esc(fmt.int(v)) + '</text>';
        }
      }
      s += '<rect class="mc-band" x="' + x(row.mean - row.tol).toFixed(1) + '" y="' + (cy - bh / 2) + '" width="' + (x(row.mean + row.tol) - x(row.mean - row.tol)).toFixed(1) + '" height="' + bh + '"/>';
      s += '<line class="mc-axis" x1="' + left + '" x2="' + (W - right) + '" y1="' + cy + '" y2="' + cy + '"/>';
      s += '<line class="mc-mean" x1="' + x(row.mean).toFixed(1) + '" x2="' + x(row.mean).toFixed(1) + '" y1="' + (bare ? top + 16 : cy - 13) + '" y2="' + (bare ? top + rowH - 16 : cy + 13) + '"/>';
      if (bare) {
        const mx = x(row.mean), anchor = mx > W - 70 ? 'end' : mx < 70 ? 'start' : 'middle';
        s += '<text class="mc-mean-lbl" x="' + mx.toFixed(1) + '" y="' + (top + 11) + '" text-anchor="' + anchor + '">평균 ' + esc(f(row.mean)) + ' · 범위 ±' + row.tol + '</text>';
      }
      const used = [];
      row.items.slice().sort((a, b) => a.value - b.value).forEach((it) => {
        const px = x(it.value);
        let lane = 0;
        while (used.some((u) => u.lane === lane && Math.abs(u.x - px) < 28)) lane++;
        used.push({ x: px, lane });
        const up = lane % 2 === 0;
        const ly = up ? cy - 12 - Math.floor(lane / 2) * 10 : cy + 20 + Math.floor(lane / 2) * 10;
        const sel = o.sel === it.name;
        s += '<g class="mc-item' + (sel ? ' sel' : '') + (it.over ? ' over' : '') + '" data-act="q-team" data-team="' + esc(it.name) + '" role="button" tabindex="0" aria-label="' + esc(row.title + ' ' + it.name + ' ' + f(it.value) + (it.over ? ', 허용 범위 밖' : '')) + '">';
        s += '<circle class="mc-hit" cx="' + px.toFixed(1) + '" cy="' + cy + '" r="9"/>';
        if (sel) s += '<circle cx="' + px.toFixed(1) + '" cy="' + cy + '" r="7.5" fill="none" stroke="#0A1E3C" stroke-width="2"/>';
        s += it.over
          ? '<path d="M' + px.toFixed(1) + ' ' + (cy - 5.5) + 'L' + (px + 5.2).toFixed(1) + ' ' + (cy + 4) + 'L' + (px - 5.2).toFixed(1) + ' ' + (cy + 4) + 'Z" fill="#B3261E" stroke="#fff" stroke-width="1"/>'
          : '<circle cx="' + px.toFixed(1) + '" cy="' + cy + '" r="4" fill="' + (sel ? '#0A1E3C' : '#1F5FD6') + '" stroke="#fff" stroke-width="1.2"/>';
        s += '<text class="mc-dot-lbl' + (it.over ? ' over' : '') + (sel ? ' sel' : '') + '" x="' + px.toFixed(1) + '" y="' + ly + '" text-anchor="middle">' + esc(it.name) + (it.over ? '▲' : '') + '</text>';
        s += '<title>' + esc(it.name + ' ' + row.title + ' ' + f(it.value) + ' · 평균 대비 ' + fmt.signed1(it.value - row.mean) + (it.over ? ' · 허용 범위 밖' : '')) + '</title></g>';
      });
      if (ri < o.rows.length - 1) s += '<line class="mc-grid" x1="0" x2="' + W + '" y1="' + (top + rowH) + '" y2="' + (top + rowH) + '"/>';
    });
    return s + '</svg>';
  };
})();
