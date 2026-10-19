/*
 * alt-c 편성 워크북 — 차트 개체 (SVG 문자열). 오피스 차트풍: 얇은 축, 연한 눈금, 평균 점선, 허용 밴드.
 */
(function () {
  'use strict';
  const WB = window.WB;
  const esc = WB.esc;

  function nice(max) {
    if (max <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const m = max / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function ticks(lo, hi, n) {
    const step = nice((hi - lo) / n);
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }

  /** 막대 + 평균선 + 허용 밴드. o = {w,h, items:[{label,value,over,color}], avg, band:[lo,hi], fmt, yMin} */
  function bars(o) {
    const W = o.w, Hh = o.h, L = 46, R = 10, T = 14, Bm = 22;
    const vals = o.items.map((x) => x.value);
    const hi = Math.max(...vals, o.band ? o.band[1] : 0) * 1.04;
    const lo = o.yMin != null ? o.yMin : Math.max(0, Math.min(...vals, o.band ? o.band[0] : Infinity) * 0.9);
    const y = (v) => T + (Hh - T - Bm) * (1 - (v - lo) / (hi - lo || 1));
    const n = o.items.length, bw = (W - L - R) / n;
    let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" role="img" aria-label="' + esc(o.title || '') + '">';
    for (const t of ticks(lo, hi, 4)) s += '<line class="ch-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ch-lbl" x="' + (L - 4) + '" y="' + (y(t) + 3) + '" text-anchor="end">' + (o.tick ? o.tick(t) : t.toLocaleString('ko-KR')) + '</text>';
    if (o.band) s += '<rect class="ch-band" x="' + L + '" width="' + (W - L - R) + '" y="' + y(o.band[1]) + '" height="' + Math.max(0, y(o.band[0]) - y(o.band[1])) + '"/>';
    o.items.forEach((x, i) => {
      const x0 = L + i * bw + bw * 0.18, w = bw * 0.64;
      s += '<rect class="ch-bar' + (x.over ? ' over' : '') + '" x="' + x0.toFixed(1) + '" width="' + w.toFixed(1) + '" y="' + y(x.value).toFixed(1) + '" height="' + Math.max(0, y(lo) - y(x.value)).toFixed(1) + '"><title>' + esc(x.label + ' ' + (o.fmt ? o.fmt(x.value) : x.value)) + '</title></rect>';
      if (o.values !== false) s += '<text class="ch-val" x="' + (x0 + w / 2).toFixed(1) + '" y="' + (y(x.value) - 3).toFixed(1) + '" text-anchor="middle">' + (o.fmt ? o.fmt(x.value) : x.value) + (x.over ? ' ▲' : '') + '</text>';
      s += '<text class="' + (x.over ? 'ch-lbl-b' : 'ch-lbl') + '" x="' + (x0 + w / 2).toFixed(1) + '" y="' + (Hh - 7) + '" text-anchor="middle">' + esc(x.label) + '</text>';
    });
    if (o.avg != null) s += '<line class="ch-avg" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(o.avg) + '" y2="' + y(o.avg) + '"/><text class="ch-lbl" x="' + (W - R) + '" y="' + (y(o.avg) - 3) + '" text-anchor="end" style="fill:#17643f">평균 ' + (o.fmt ? o.fmt(o.avg) : o.avg) + '</text>';
    s += '<line class="ch-axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(lo) + '" y2="' + y(lo) + '"/></svg>';
    return s;
  }

  /** 점 차트 (가로 한 줄 = 지표 하나). o = {w,h, rows:[{title, items:[{label,value,over}], avg, tol, fmt}]} */
  function dots(o) {
    const W = o.w, Hh = o.h, L = 92, R = 14;
    const rh = Hh / o.rows.length;
    let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" role="img" aria-label="' + esc(o.title || '') + '">';
    o.rows.forEach((row, ri) => {
      const top = ri * rh, cy = top + rh * 0.52;
      const vals = row.items.map((x) => x.value);
      const lo = Math.min(...vals, row.avg - row.tol) - row.tol * 0.3, hi = Math.max(...vals, row.avg + row.tol) + row.tol * 0.3;
      const x = (v) => L + (W - L - R) * (v - lo) / (hi - lo || 1);
      s += '<text class="ch-lbl-b" x="4" y="' + (cy - 2) + '">' + esc(row.title) + '</text><text class="ch-lbl" x="4" y="' + (cy + 11) + '">평균 ' + (row.fmt ? row.fmt(row.avg) : row.avg.toFixed(1)) + ' ±' + row.tol + '</text>';
      s += '<rect class="ch-band" x="' + x(row.avg - row.tol) + '" width="' + (x(row.avg + row.tol) - x(row.avg - row.tol)) + '" y="' + (cy - 11) + '" height="22"/>';
      s += '<line class="ch-axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + cy + '" y2="' + cy + '"/><line class="ch-avg" x1="' + x(row.avg) + '" x2="' + x(row.avg) + '" y1="' + (cy - 13) + '" y2="' + (cy + 13) + '"/>';
      const used = [];
      row.items.slice().sort((a, b) => a.value - b.value).forEach((it) => {
        const px = x(it.value);
        let lane = 0; while (used.some((u) => u.lane === lane && Math.abs(u.x - px) < 30)) lane++;
        used.push({ x: px, lane });
        const ly = lane % 2 ? cy + 22 + Math.floor(lane / 2) * 11 : cy - 15 - Math.floor(lane / 2) * 11;
        s += '<circle class="ch-dot' + (it.over ? ' over' : '') + '" cx="' + px.toFixed(1) + '" cy="' + cy + '" r="' + (it.over ? 4.2 : 3.4) + '"><title>' + esc(it.label + ' ' + it.value) + '</title></circle>';
        s += '<text class="' + (it.over ? 'ch-lbl-b' : 'ch-lbl') + '" x="' + px.toFixed(1) + '" y="' + ly + '" text-anchor="middle"' + (it.over ? ' style="fill:#a3221a"' : '') + '>' + esc(it.label) + (it.over ? '▲' : '') + '</text>';
      });
      if (ri < o.rows.length - 1) s += '<line class="ch-grid" x1="0" x2="' + W + '" y1="' + (top + rh) + '" y2="' + (top + rh) + '"/>';
    });
    return s + '</svg>';
  }

  /** 선 차트. o = {w,h, series:[{label,color,values,bold}], xLabels:[...], fmt} */
  function lines(o) {
    const W = o.w, Hh = o.h, L = 50, R = 64, T = 10, Bm = 22;
    const all = [].concat(...o.series.map((s) => s.values));
    const hi = Math.max(...all) * 1.03, lo = 0;
    const n = o.series[0].values.length;
    const x = (i) => L + (W - L - R) * i / Math.max(1, n - 1);
    const y = (v) => T + (Hh - T - Bm) * (1 - (v - lo) / (hi - lo || 1));
    let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" role="img" aria-label="' + esc(o.title || '') + '">';
    for (const t of ticks(lo, hi, 5)) s += '<line class="ch-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text class="ch-lbl" x="' + (L - 4) + '" y="' + (y(t) + 3) + '" text-anchor="end">' + t.toLocaleString('ko-KR') + '</text>';
    (o.xLabels || []).forEach((lb, i) => { if (lb) s += '<text class="ch-lbl" x="' + x(i) + '" y="' + (Hh - 6) + '" text-anchor="middle">' + esc(lb) + '</text><line class="ch-grid" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + T + '" y2="' + y(lo) + '"/>'; });
    const ends = [];
    for (const se of o.series) {
      const d = se.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
      s += '<path class="ch-line" d="' + d + '" stroke="' + se.color + '" stroke-width="' + (se.bold ? 2.4 : 1.3) + '" opacity="' + (se.dim ? 0.35 : 1) + '"><title>' + esc(se.label) + '</title></path>';
      ends.push({ y: y(se.values[n - 1]), label: se.label + ' ' + (o.fmt ? o.fmt(se.values[n - 1]) : se.values[n - 1]), color: se.color, bold: se.bold });
    }
    ends.sort((a, b) => a.y - b.y);
    let last = -99;
    for (const e of ends) { const yy = Math.max(e.y, last + 10); last = yy; s += '<text class="' + (e.bold ? 'ch-lbl-b' : 'ch-lbl') + '" x="' + (W - R + 4) + '" y="' + (yy + 3) + '" style="fill:' + e.color + '">' + esc(e.label) + '</text>'; }
    s += '<line class="ch-axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(lo) + '" y2="' + y(lo) + '"/></svg>';
    return s;
  }

  /** 점수 추이 꺾은선 (작업 창용) */
  function spark(values, w, h, opts) {
    if (!values.length) return '<svg width="' + w + '" height="' + h + '"></svg>';
    const lo = Math.min(...values), hi = Math.max(...values);
    const x = (i) => 2 + (w - 4) * i / Math.max(1, values.length - 1);
    const y = (v) => 3 + (h - 6) * (1 - (v - lo) / (hi - lo || 1));
    const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"><rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#fafaf8" stroke="#dededa"/>' +
      '<path d="' + d + '" fill="none" stroke="' + ((opts && opts.color) || '#5b4a99') + '" stroke-width="1.5"/><circle cx="' + x(values.length - 1) + '" cy="' + y(values[values.length - 1]) + '" r="2.5" fill="' + ((opts && opts.color) || '#5b4a99') + '"/></svg>';
  }

  WB.Charts = { bars, dots, lines, spark, ticks };
})();
