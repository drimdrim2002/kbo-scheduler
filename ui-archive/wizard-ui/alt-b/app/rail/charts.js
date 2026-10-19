/*
 * alt-b 단계 레일 — 자체 SVG 차트. 따뜻한 회색 지면 + 청록 강조에 맞춘 얇은 선, 큰 숫자 중심.
 */
(function () {
  'use strict';
  const R = window.R;
  const esc = R.esc;
  let uid = 0;
  const id = (p) => p + '-' + (++uid);

  function hatch(pid, color) {
    return '<pattern id="' + pid + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="' + (color || 'var(--bad-bg)') + '"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--bad)" stroke-width="2.4"/></pattern>';
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p;
    return 10 * p;
  }

  /** 가로 막대 + 평균선 + 허용오차 밴드. items: [{label, value, color, over, sel}] */
  function bars(o) {
    const items = o.items;
    const W = o.width || 520, rowH = o.rowH || 22, top = 18, left = o.labelW || 52, right = 64;
    const H = top + items.length * rowH + 22;
    const maxV = niceMax(Math.max(...items.map((x) => x.value), (o.mean || 0) + (o.tol || 0)) * 1.02);
    const minV = o.min != null ? o.min : 0;
    const x = (v) => left + (W - left - right) * ((v - minV) / (maxV - minV));
    const pid = id('h');
    let s = '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(o.title || '') + '"><defs>' + hatch(pid) + '</defs>';
    if (o.mean != null && o.tol) s += '<rect class="ch-band" x="' + x(o.mean - o.tol).toFixed(1) + '" y="' + (top - 6) + '" width="' + (x(o.mean + o.tol) - x(o.mean - o.tol)).toFixed(1) + '" height="' + (items.length * rowH + 8) + '"/>';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = minV + (maxV - minV) * i / ticks;
      s += '<line class="ch-grid" x1="' + x(v).toFixed(1) + '" x2="' + x(v).toFixed(1) + '" y1="' + (top - 6) + '" y2="' + (top + items.length * rowH) + '"/>';
      s += '<text class="ch-tick" x="' + x(v).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc((o.tickFmt || R.fmt.int)(v)) + '</text>';
    }
    items.forEach((it, i) => {
      const y = top + i * rowH;
      const w = Math.max(1, x(it.value) - x(minV));
      s += '<g class="ch-row' + (it.sel ? ' sel' : '') + '"' + (it.act ? ' data-act="' + it.act + '" data-v="' + esc(it.label) + '" tabindex="0" role="button"' : '') + '>';
      s += '<text class="ch-label" x="' + (left - 8) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end">' + esc(it.label) + '</text>';
      s += '<rect x="' + x(minV) + '" y="' + (y + 4) + '" width="' + w.toFixed(1) + '" height="' + (rowH - 8) + '" rx="2" fill="' + (it.over ? 'url(#' + pid + ')' : (it.sel ? 'var(--teal)' : 'var(--bar)')) + '"' + (it.over ? ' stroke="var(--bad)" stroke-width="1"' : '') + '/>';
      s += '<text class="ch-val' + (it.over ? ' over' : '') + '" x="' + (x(minV) + w + 6).toFixed(1) + '" y="' + (y + rowH / 2 + 4) + '">' + esc((o.fmt || R.fmt.int)(it.value)) + (it.over ? ' ▲' : '') + '</text>';
      s += '</g>';
    });
    if (o.mean != null) s += '<line class="ch-mean" x1="' + x(o.mean).toFixed(1) + '" x2="' + x(o.mean).toFixed(1) + '" y1="' + (top - 10) + '" y2="' + (top + items.length * rowH + 2) + '"/><text class="ch-meanlbl" x="' + x(o.mean).toFixed(1) + '" y="' + (top - 10) + '" text-anchor="middle">평균 ' + esc((o.fmt || R.fmt.int)(o.mean)) + '</text>';
    return s + '</svg>';
  }

  /** 점 차트 한 줄 (FR-A2 소형 다중). items: [{label, value, color, over}] */
  function dotRow(o) {
    const W = o.width || 360, H = o.height || 64, pad = 14;
    const vals = o.items.map((x) => x.value);
    const lo = Math.min(...vals, o.mean - (o.tol || 0)), hi = Math.max(...vals, o.mean + (o.tol || 0));
    const span = (hi - lo) || 1;
    const x = (v) => pad + (W - 2 * pad) * ((v - lo + span * 0.06) / (span * 1.12));
    const yMid = 30;
    let s = '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(o.title || '') + '">';
    if (o.tol) s += '<rect class="ch-band" x="' + x(o.mean - o.tol).toFixed(1) + '" y="12" width="' + (x(o.mean + o.tol) - x(o.mean - o.tol)).toFixed(1) + '" height="36"/>';
    s += '<line class="ch-axis" x1="' + pad + '" x2="' + (W - pad) + '" y1="' + yMid + '" y2="' + yMid + '"/>';
    s += '<line class="ch-mean" x1="' + x(o.mean).toFixed(1) + '" x2="' + x(o.mean).toFixed(1) + '" y1="8" y2="52"/>';
    const placed = [];
    o.items.slice().sort((a, b) => a.value - b.value).forEach((it) => {
      const cx = x(it.value);
      let lane = 0;
      while (placed.some((p) => p.lane === lane && Math.abs(p.x - cx) < 9)) lane++;
      placed.push({ x: cx, lane });
      const cy = yMid + (lane % 2 ? 1 : -1) * Math.ceil(lane / 2) * 8;
      s += it.over
        ? '<rect x="' + (cx - 4.5).toFixed(1) + '" y="' + (cy - 4.5).toFixed(1) + '" width="9" height="9" fill="var(--bad)" transform="rotate(45 ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')"><title>' + esc(it.label + ' ' + it.value + ' (허용오차 초과)') + '</title></rect>'
        : '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.6" fill="' + esc(it.color || 'var(--teal)') + '" stroke="var(--panel)" stroke-width="1.2"><title>' + esc(it.label + ' ' + it.value) + '</title></circle>';
    });
    s += '<text class="ch-tick" x="' + pad + '" y="' + (H - 2) + '">' + esc(R.fmt.int(lo)) + '</text><text class="ch-tick" x="' + (W - pad) + '" y="' + (H - 2) + '" text-anchor="end">' + esc(R.fmt.int(hi)) + '</text>';
    s += '<text class="ch-meanlbl" x="' + x(o.mean).toFixed(1) + '" y="' + (H - 2) + '" text-anchor="middle">평균 ' + esc(R.fmt.num1(o.mean)) + '</text>';
    return s + '</svg>';
  }

  /** 홈/원정 흐름 스트립 (FR-A3). rows: [{name, color, cells:[{home, run, over, slot}]}] */
  function flow(o) {
    const rows = o.rows, S = o.slots;
    const W = o.width || 900, left = 48, top = 16, rowH = o.rowH || 20;
    const cw = (W - left - 8) / S;
    const H = top + rows.length * rowH + 18;
    let s = '<svg class="ch ch-flow" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="구단별 홈/원정 흐름">';
    (o.months || []).forEach((m) => { const xx = left + m.slot * cw; s += '<line class="ch-grid" x1="' + xx.toFixed(1) + '" x2="' + xx.toFixed(1) + '" y1="' + (top - 4) + '" y2="' + (top + rows.length * rowH) + '"/><text class="ch-tick" x="' + (xx + 3).toFixed(1) + '" y="' + (top - 5) + '">' + m.label + '</text>'; });
    rows.forEach((r, i) => {
      const y = top + i * rowH;
      s += '<text class="ch-label" x="' + (left - 6) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end">' + esc(r.name) + '</text>';
      r.cells.forEach((c) => {
        if (!c) return;
        const xx = left + c.slot * cw + 0.75;
        const w = Math.max(1, cw - 1.5);
        if (c.home) s += '<rect x="' + xx.toFixed(1) + '" y="' + (y + 3) + '" width="' + w.toFixed(1) + '" height="' + (rowH - 6) + '" rx="1.5" fill="var(--home)"><title>' + esc(r.name + ' 홈 · ' + c.title) + '</title></rect>';
        else s += '<rect x="' + (xx + 0.6).toFixed(1) + '" y="' + (y + 3.6) + '" width="' + Math.max(0.5, w - 1.2).toFixed(1) + '" height="' + (rowH - 7.2) + '" rx="1.5" fill="var(--away-bg)" stroke="var(--away)" stroke-width="1.1"><title>' + esc(r.name + ' 원정 · ' + c.title) + '</title></rect>';
        if (c.over) s += '<rect x="' + (xx - 0.8).toFixed(1) + '" y="' + (y + 1) + '" width="' + (w + 1.6).toFixed(1) + '" height="' + (rowH - 2) + '" rx="2" fill="none" stroke="var(--bad)" stroke-width="2"/><text class="ch-flag" x="' + (xx + w / 2).toFixed(1) + '" y="' + (y + rowH / 2 + 3.5) + '" text-anchor="middle">!</text>';
      });
    });
    return s + '</svg>';
  }

  /** 스파크라인 (점수 추이) */
  function spark(values, o) {
    o = o || {};
    const W = o.width || 260, H = o.height || 56, p = 4;
    if (!values.length) return '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" width="100%"></svg>';
    const lo = Math.min(...values), hi = Math.max(...values);
    const n = Math.max(o.n || values.length, 2);
    const x = (i) => p + (W - 2 * p) * (i / (n - 1));
    const y = (v) => p + (H - 2 * p) * (1 - (v - lo) / ((hi - lo) || 1));
    const pts = values.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1));
    let s = '<svg class="ch ch-spark" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" role="img" aria-label="' + esc(o.title || '추이') + '">';
    s += '<polyline points="' + pts.join(' ') + ' ' + x(values.length - 1).toFixed(1) + ',' + H + ' ' + p + ',' + H + '" fill="var(--teal-50)" stroke="none"/>';
    s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + (o.color || 'var(--teal)') + '" stroke-width="2" vector-effect="non-scaling-stroke"/>';
    s += '<circle cx="' + x(values.length - 1).toFixed(1) + '" cy="' + y(values[values.length - 1]).toFixed(1) + '" r="3" fill="' + (o.color || 'var(--teal)') + '"/>';
    return s + '</svg>';
  }

  /** 선 차트 (FR-A4). series: [{name, color, values:[...]}] */
  function lines(o) {
    const W = o.width || 640, H = o.height || 260, left = 46, bottom = 22, top = 10, right = 54;
    const n = Math.max(...o.series.map((s) => s.values.length));
    const hi = niceMax(Math.max(...o.series.map((s) => Math.max(...s.values, 0))));
    const x = (i) => left + (W - left - right) * (i / Math.max(1, n - 1));
    const y = (v) => top + (H - top - bottom) * (1 - v / hi);
    let s = '<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(o.title || '') + '">';
    for (let i = 0; i <= 4; i++) { const v = hi * i / 4; s += '<line class="ch-grid" x1="' + left + '" x2="' + (W - right) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="ch-tick" x="' + (left - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + R.fmt.int(v) + '</text>'; }
    (o.xLabels || []).forEach((l) => { s += '<text class="ch-tick" x="' + x(l.i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(l.label) + '</text>'; });
    o.series.forEach((se) => {
      s += '<polyline points="' + se.values.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + '" fill="none" stroke="' + esc(se.color) + '" stroke-width="' + (se.sel ? 2.6 : 1.4) + '" stroke-opacity="' + (se.dim ? 0.25 : 1) + '"/>';
      const last = se.values.length - 1;
      if (!se.dim) s += '<text class="ch-lineend" x="' + (x(last) + 4).toFixed(1) + '" y="' + (y(se.values[last]) + 4).toFixed(1) + '" fill="' + esc(se.color) + '">' + esc(se.name) + '</text>';
    });
    return s + '</svg>';
  }

  /** 행렬(히트맵). cell(i,j) → {v, text, title} */
  function matrix(o) {
    const rows = o.rows, cols = o.cols;
    const cs = o.cell || 30, left = o.labelW || 44, top = 22;
    const W = left + cols.length * cs + 2, H = top + rows.length * cs + 2;
    let maxV = 0;
    const data = rows.map((r, i) => cols.map((c, j) => { const d = o.value(i, j); if (d && d.v > maxV) maxV = d.v; return d; }));
    let s = '<svg class="ch ch-matrix" viewBox="0 0 ' + W + ' ' + H + '" width="' + (o.fit ? '100%' : W) + '" role="img" aria-label="' + esc(o.title || '') + '">';
    cols.forEach((c, j) => { s += '<text class="ch-tick" x="' + (left + j * cs + cs / 2) + '" y="14" text-anchor="middle">' + esc(c) + '</text>'; });
    rows.forEach((r, i) => {
      s += '<text class="ch-label" x="' + (left - 6) + '" y="' + (top + i * cs + cs / 2 + 4) + '" text-anchor="end">' + esc(r) + '</text>';
      cols.forEach((c, j) => {
        const d = data[i][j];
        const xx = left + j * cs, yy = top + i * cs;
        if (!d) { s += '<rect x="' + xx + '" y="' + yy + '" width="' + (cs - 2) + '" height="' + (cs - 2) + '" rx="2" class="ch-cell-none"/>'; return; }
        const k = maxV ? d.v / maxV : 0;
        const fill = d.tone === 'bad' ? 'var(--bad-bg)' : 'color-mix(in srgb, var(--teal) ' + Math.round(8 + k * 72) + '%, var(--panel))';
        s += '<rect x="' + xx + '" y="' + yy + '" width="' + (cs - 2) + '" height="' + (cs - 2) + '" rx="2" fill="' + fill + '"' + (d.sel ? ' stroke="var(--ink)" stroke-width="2"' : d.tone === 'bad' ? ' stroke="var(--bad)" stroke-width="1.4"' : '') + '><title>' + esc(d.title || '') + '</title></rect>';
        if (d.text != null) s += '<text class="ch-celltext' + (k > 0.55 && d.tone !== 'bad' ? ' inv' : '') + '" x="' + (xx + cs / 2 - 1) + '" y="' + (yy + cs / 2 + 3) + '" text-anchor="middle">' + esc(d.text) + '</text>';
      });
    });
    return s + '</svg>';
  }

  /** 가로 수용 게이지. 값/용량, 초과 시 빗금 */
  function meter(value, max, o) {
    o = o || {};
    const k = max > 0 ? value / max : 0;
    const pid = id('m');
    const W = 400, H = 22;
    const w = Math.min(1, k) * (W - 2);
    const over = k > 1;
    return '<svg class="ch ch-meter" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" role="img" aria-label="' + esc(o.title || '게이지') + '"><defs>' + hatch(pid, 'var(--bad-bg)') + '</defs>' +
      '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="5" fill="var(--sunk)" stroke="var(--line)"/>' +
      '<rect x="1" y="1" width="' + w.toFixed(1) + '" height="' + (H - 2) + '" rx="5" fill="' + (over ? 'url(#' + pid + ')' : (o.color || 'var(--teal)')) + '"/>' +
      (o.mark != null ? '<line x1="' + (1 + o.mark * (W - 2)).toFixed(1) + '" x2="' + (1 + o.mark * (W - 2)).toFixed(1) + '" y1="0" y2="' + H + '" stroke="var(--ink)" stroke-width="2"/>' : '') + '</svg>';
  }

  R.chart = { bars, dotRow, flow, spark, lines, matrix, meter, niceMax };
})();
