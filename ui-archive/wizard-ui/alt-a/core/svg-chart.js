/*
 * KBO 공통 코어 — SVG 차트 최소 구현 (막대·점·선·히트맵·레이더·스파크라인·게이지).
 * 모든 함수는 SVG 문자열을 돌려준다. DOM에 의존하지 않는다.
 * 색은 CSS 변수(--kc-*)로 받아 대안마다 테마를 바꾼다. 허용오차 초과는 색 + 빗금 + ▲ 기호로 함께 표시한다(NFR-7).
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).chart = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  let uid = 0;
  const nextId = (p) => p + '-' + (++uid).toString(36);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function niceStep(range, count) {
    const raw = range / Math.max(1, count);
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  }

  function ticks(min, max, count) {
    if (max === min) { max = min + 1; }
    const step = niceStep(max - min, count || 4);
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return { lo, hi, step, values: out };
  }

  const fmtDefault = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ko-KR') : (Math.round(v * 10) / 10).toString());

  function hatchDef(id) {
    return '<pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--kc-warn, #c92a2a)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--kc-warn-stripe, rgba(255,255,255,.55))" stroke-width="2.5"/></pattern>';
  }

  function svgOpen(w, h, label, cls) {
    return '<svg class="kc ' + (cls || '') + '" viewBox="0 0 ' + w + ' ' + h + '" width="100%" role="img" aria-label="' + esc(label || '차트') + '" preserveAspectRatio="xMidYMid meet" style="max-width:' + w + 'px">';
  }

  /**
   * 막대 차트.
   * opts: { items:[{label, value, color, flag, note}], width, height, mean, band:{lo,hi}, unit, format, title, yZero }
   * flag가 true인 막대는 빗금 + ▲로 표시한다.
   */
  function bar(opts) {
    const items = opts.items || [];
    const W = opts.width || 640, H = opts.height || 260;
    const m = { l: 52, r: 14, t: 18, b: opts.rotateLabels ? 52 : 34 };
    const fmt = opts.format || fmtDefault;
    const vals = items.map((i) => i.value);
    let lo = opts.yZero === false ? Math.min(...vals) : Math.min(0, ...vals);
    let hi = Math.max(...vals, opts.band ? opts.band.hi : -Infinity, opts.mean != null ? opts.mean : -Infinity);
    if (opts.band && opts.yZero === false) lo = Math.min(lo, opts.band.lo);
    if (!Number.isFinite(hi)) hi = 1;
    if (opts.yZero === false) lo = lo - (hi - lo) * 0.08;
    const t = ticks(lo, hi * 1.05, 4);
    const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - t.lo) / (t.hi - t.lo || 1));
    const bw = (W - m.l - m.r) / Math.max(1, items.length);
    const hid = nextId('hatch');
    let s = svgOpen(W, H, opts.title || '막대 차트', 'kc-bar') + '<defs>' + hatchDef(hid) + '</defs>';
    for (const v of t.values) {
      s += '<line class="kc-grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>';
      s += '<text class="kc-tick" x="' + (m.l - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(fmt(v)) + '</text>';
    }
    if (opts.band) {
      const y1 = y(Math.min(opts.band.hi, t.hi)), y2 = y(Math.max(opts.band.lo, t.lo));
      s += '<rect class="kc-band" x="' + m.l + '" width="' + (W - m.l - m.r) + '" y="' + y1.toFixed(1) + '" height="' + Math.max(0, y2 - y1).toFixed(1) + '"><title>' + esc(opts.band.label || '허용오차') + '</title></rect>';
      s += '<text class="kc-band-label" x="' + (W - m.r - 4) + '" y="' + (y1 + 11).toFixed(1) + '" text-anchor="end">' + esc(opts.band.label || '허용오차') + '</text>';
    }
    items.forEach((it, i) => {
      const x = m.l + i * bw + bw * 0.18;
      const w = bw * 0.64;
      const y0 = y(Math.max(t.lo, 0)), y1 = y(it.value);
      const top = Math.min(y0, y1), h = Math.abs(y0 - y1);
      const fill = it.flag ? 'url(#' + hid + ')' : (it.color || 'var(--kc-bar, #4263eb)');
      s += '<g class="kc-item' + (it.flag ? ' kc-flag' : '') + '"' + (it.key != null ? ' data-key="' + esc(it.key) + '"' : '') + '>';
      s += '<rect x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(0.5, h).toFixed(1) + '" rx="2" fill="' + fill + '"' + (it.flag && it.color ? ' stroke="' + it.color + '" stroke-width="1.5"' : '') + '><title>' + esc(it.label + ': ' + fmt(it.value) + (opts.unit || '') + (it.note ? ' — ' + it.note : '')) + '</title></rect>';
      s += '<text class="kc-value" x="' + (x + w / 2).toFixed(1) + '" y="' + (top - 4).toFixed(1) + '" text-anchor="middle">' + (it.flag ? '▲ ' : '') + esc(fmt(it.value)) + '</text>';
      const lx = (x + w / 2).toFixed(1), ly = (H - m.b + 15);
      s += opts.rotateLabels
        ? '<text class="kc-label" transform="translate(' + lx + ',' + (ly - 4) + ') rotate(-35)" text-anchor="end">' + esc(it.label) + '</text>'
        : '<text class="kc-label" x="' + lx + '" y="' + ly + '" text-anchor="middle">' + esc(it.label) + '</text>';
      s += '</g>';
    });
    if (opts.mean != null) {
      const ym = y(opts.mean).toFixed(1);
      s += '<line class="kc-mean" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + ym + '" y2="' + ym + '"/>';
      s += '<text class="kc-mean-label" x="' + (m.l + 4) + '" y="' + (ym - 4) + '">평균 ' + esc(fmt(opts.mean)) + (opts.unit || '') + '</text>';
    }
    s += '<line class="kc-axis" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(Math.max(t.lo, 0)).toFixed(1) + '" y2="' + y(Math.max(t.lo, 0)).toFixed(1) + '"/>';
    return s + '</svg>';
  }

  /**
   * 점 차트 (구단별 여러 계열). opts: { rows:[{label, values:[number], flag}], series:[{label, color, shape}], mean, band, width, height, format, unit }
   */
  function dot(opts) {
    const rows = opts.rows || [];
    const series = opts.series || [{ label: '값', color: 'var(--kc-bar, #4263eb)' }];
    const W = opts.width || 640, H = opts.height || 240;
    const m = { l: 52, r: 14, t: 26, b: 34 };
    const fmt = opts.format || fmtDefault;
    const all = [].concat(...rows.map((r) => r.values)).filter(Number.isFinite);
    let lo = Math.min(...all, opts.band ? opts.band.lo : Infinity, opts.mean != null ? opts.mean : Infinity);
    let hi = Math.max(...all, opts.band ? opts.band.hi : -Infinity, opts.mean != null ? opts.mean : -Infinity);
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.12 || 1;
    const t = ticks(Math.max(0, lo - pad), hi + pad, 4);
    const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - t.lo) / (t.hi - t.lo || 1));
    const cw = (W - m.l - m.r) / Math.max(1, rows.length);
    let s = svgOpen(W, H, opts.title || '점 차트', 'kc-dot');
    for (const v of t.values) {
      s += '<line class="kc-grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>';
      s += '<text class="kc-tick" x="' + (m.l - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(fmt(v)) + '</text>';
    }
    if (opts.band) {
      const y1 = y(Math.min(opts.band.hi, t.hi)), y2 = y(Math.max(opts.band.lo, t.lo));
      s += '<rect class="kc-band" x="' + m.l + '" width="' + (W - m.l - m.r) + '" y="' + y1.toFixed(1) + '" height="' + Math.max(0, y2 - y1).toFixed(1) + '"/>';
      s += '<text class="kc-band-label" x="' + (W - m.r - 4) + '" y="' + (y1 + 11).toFixed(1) + '" text-anchor="end">' + esc(opts.band.label || '허용오차') + '</text>';
    }
    if (opts.mean != null) {
      const ym = y(opts.mean).toFixed(1);
      s += '<line class="kc-mean" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + ym + '" y2="' + ym + '"/><text class="kc-mean-label" x="' + (m.l + 4) + '" y="' + (ym - 4) + '">평균 ' + esc(fmt(opts.mean)) + (opts.unit || '') + '</text>';
    }
    const shapes = ['circle', 'square', 'diamond'];
    rows.forEach((r, i) => {
      const cx = m.l + cw * (i + 0.5);
      s += '<line class="kc-stem" x1="' + cx.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y1="' + y(Math.min(...r.values)).toFixed(1) + '" y2="' + y(Math.max(...r.values)).toFixed(1) + '"/>';
      r.values.forEach((v, k) => {
        if (!Number.isFinite(v)) return;
        const sr = series[k] || series[0];
        const shape = sr.shape || shapes[k % shapes.length];
        const cy = y(v);
        const tip = '<title>' + esc(r.label + ' · ' + sr.label + ': ' + fmt(v) + (opts.unit || '')) + '</title>';
        const col = sr.color;
        if (shape === 'square') s += '<rect x="' + (cx - 5).toFixed(1) + '" y="' + (cy - 5).toFixed(1) + '" width="10" height="10" fill="' + col + '" class="kc-pt">' + tip + '</rect>';
        else if (shape === 'diamond') s += '<path d="M' + cx.toFixed(1) + ' ' + (cy - 6).toFixed(1) + 'l6 6-6 6-6-6z" fill="' + col + '" class="kc-pt">' + tip + '</path>';
        else s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="5.5" fill="' + col + '" class="kc-pt">' + tip + '</circle>';
      });
      s += '<text class="kc-label" x="' + cx.toFixed(1) + '" y="' + (H - m.b + 15) + '" text-anchor="middle">' + (r.flag ? '▲ ' : '') + esc(r.label) + '</text>';
    });
    // 범례
    let lx = m.l;
    series.forEach((sr, k) => {
      const shape = sr.shape || shapes[k % shapes.length];
      const mark = shape === 'square' ? '<rect x="' + lx + '" y="6" width="9" height="9" fill="' + sr.color + '"/>' : shape === 'diamond' ? '<path d="M' + (lx + 5) + ' 5l5 5-5 5-5-5z" fill="' + sr.color + '"/>' : '<circle cx="' + (lx + 4.5) + '" cy="10.5" r="4.5" fill="' + sr.color + '"/>';
      s += mark + '<text class="kc-legend" x="' + (lx + 14) + '" y="14">' + esc(sr.label) + '</text>';
      lx += 22 + sr.label.length * 11;
    });
    return s + '</svg>';
  }

  /**
   * 선 차트. opts: { series:[{label, color, values:[number], emphasis}], xLabels:[string], width, height, format, unit, xEvery }
   */
  function line(opts) {
    const series = opts.series || [];
    const W = opts.width || 720, H = opts.height || 280;
    const m = { l: 56, r: opts.endLabels === false ? 14 : 70, t: 14, b: 30 };
    const fmt = opts.format || fmtDefault;
    const n = Math.max(1, ...series.map((s) => s.values.length));
    const all = [].concat(...series.map((s) => s.values)).filter(Number.isFinite);
    const t = ticks(Math.min(0, ...all), Math.max(1, ...all), 4);
    const x = (i) => m.l + (W - m.l - m.r) * (n === 1 ? 0.5 : i / (n - 1));
    const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - t.lo) / (t.hi - t.lo || 1));
    let s = svgOpen(W, H, opts.title || '선 차트', 'kc-line');
    for (const v of t.values) {
      s += '<line class="kc-grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>';
      s += '<text class="kc-tick" x="' + (m.l - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + esc(fmt(v)) + '</text>';
    }
    const every = opts.xEvery || Math.ceil(n / 10);
    (opts.xLabels || []).forEach((lab, i) => {
      if (i % every !== 0) return;
      s += '<text class="kc-tick" x="' + x(i).toFixed(1) + '" y="' + (H - m.b + 16) + '" text-anchor="middle">' + esc(lab) + '</text>';
    });
    const ends = [];
    series.forEach((sr) => {
      const pts = sr.values.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
      s += '<polyline class="kc-series' + (sr.emphasis ? ' kc-emph' : '') + (sr.dim ? ' kc-dim' : '') + '" points="' + pts + '" fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.emphasis ? 3 : 1.6) + '"' + (sr.dash ? ' stroke-dasharray="' + sr.dash + '"' : '') + '><title>' + esc(sr.label) + '</title></polyline>';
      const lastV = sr.values[sr.values.length - 1];
      if (Number.isFinite(lastV)) ends.push({ y: y(lastV), label: sr.label + ' ' + fmt(lastV), color: sr.color, dim: sr.dim });
    });
    if (opts.endLabels !== false) {
      ends.sort((a, b) => a.y - b.y);
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 11) ends[i].y = ends[i - 1].y + 11;
      for (const e of ends) s += '<text class="kc-endlabel' + (e.dim ? ' kc-dim' : '') + '" x="' + (W - m.r + 4) + '" y="' + (e.y + 4).toFixed(1) + '" fill="' + e.color + '">' + esc(e.label) + '</text>';
    }
    return s + '</svg>';
  }

  /**
   * 히트맵. opts: { rows:[label], cols:[label], values:[[number]], format, cellW, cellH, scale: (v, max) => css색, titles:[[string]] }
   */
  function heatmap(opts) {
    const rows = opts.rows || [], cols = opts.cols || [];
    const cw = opts.cellW || 34, ch = opts.cellH || 24;
    const lw = opts.labelW || 56, th = opts.headerH || 24;
    const W = lw + cw * cols.length + 4, H = th + ch * rows.length + 4;
    const fmt = opts.format || ((v) => (v == null ? '' : String(Math.round(v * 10) / 10)));
    const vals = [].concat(...opts.values).filter(Number.isFinite);
    const max = opts.max != null ? opts.max : Math.max(1, ...vals);
    const min = opts.min != null ? opts.min : Math.min(0, ...vals);
    const scale = opts.scale || ((v) => {
      const k = (v - min) / ((max - min) || 1);
      return 'color-mix(in srgb, var(--kc-heat-hi, #1c7ed6) ' + Math.round(k * 100) + '%, var(--kc-heat-lo, #f1f3f5))';
    });
    let s = svgOpen(W, H, opts.title || '히트맵', 'kc-heat');
    cols.forEach((c, j) => { s += '<text class="kc-tick" x="' + (lw + cw * j + cw / 2) + '" y="' + (th - 8) + '" text-anchor="middle">' + esc(c) + '</text>'; });
    rows.forEach((r, i) => {
      s += '<text class="kc-label" x="' + (lw - 6) + '" y="' + (th + ch * i + ch / 2 + 4) + '" text-anchor="end">' + esc(r) + '</text>';
      cols.forEach((c, j) => {
        const v = opts.values[i][j];
        const x = lw + cw * j, yy = th + ch * i;
        if (v == null) { s += '<rect x="' + x + '" y="' + yy + '" width="' + (cw - 2) + '" height="' + (ch - 2) + '" class="kc-heat-empty"/>'; return; }
        const k = (v - min) / ((max - min) || 1);
        const title = opts.titles && opts.titles[i] ? opts.titles[i][j] : r + ' · ' + c + ': ' + fmt(v);
        s += '<g class="kc-cell"' + (opts.keys ? ' data-key="' + esc(opts.keys[i][j]) + '"' : '') + '><rect x="' + x + '" y="' + yy + '" width="' + (cw - 2) + '" height="' + (ch - 2) + '" rx="2" fill="' + scale(v, max, min) + '"><title>' + esc(title) + '</title></rect>';
        s += '<text x="' + (x + cw / 2 - 1) + '" y="' + (yy + ch / 2 + 3) + '" text-anchor="middle" class="kc-cell-text' + (k > 0.6 ? ' kc-on-dark' : '') + '">' + esc(fmt(v)) + '</text></g>';
      });
    });
    return s + '</svg>';
  }

  /**
   * 레이더. opts: { axes:[label], series:[{label, color, values:[0..1]}], size }
   */
  function radar(opts) {
    const axes = opts.axes || [];
    const size = opts.size || 300;
    const cx = size / 2, cy = size / 2 + 6, R = size / 2 - 52;
    const ang = (i) => -Math.PI / 2 + (2 * Math.PI * i) / axes.length;
    let s = svgOpen(size, size + 10, opts.title || '레이더 차트', 'kc-radar');
    for (const k of [0.25, 0.5, 0.75, 1]) {
      const pts = axes.map((a, i) => (cx + R * k * Math.cos(ang(i))).toFixed(1) + ',' + (cy + R * k * Math.sin(ang(i))).toFixed(1)).join(' ');
      s += '<polygon class="kc-grid" points="' + pts + '" fill="none"/>';
    }
    axes.forEach((a, i) => {
      const x = cx + R * Math.cos(ang(i)), y = cy + R * Math.sin(ang(i));
      s += '<line class="kc-grid" x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
      const lx = cx + (R + 16) * Math.cos(ang(i)), ly = cy + (R + 16) * Math.sin(ang(i));
      s += '<text class="kc-label" x="' + lx.toFixed(1) + '" y="' + (ly + 4).toFixed(1) + '" text-anchor="' + (Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end') + '">' + esc(a) + '</text>';
    });
    (opts.series || []).forEach((sr) => {
      const pts = sr.values.map((v, i) => (cx + R * Math.max(0, Math.min(1, v)) * Math.cos(ang(i))).toFixed(1) + ',' + (cy + R * Math.max(0, Math.min(1, v)) * Math.sin(ang(i))).toFixed(1)).join(' ');
      s += '<polygon class="kc-radar-shape' + (sr.dim ? ' kc-dim' : '') + '" points="' + pts + '" fill="' + sr.color + '" fill-opacity="' + (sr.dim ? 0.04 : 0.18) + '" stroke="' + sr.color + '" stroke-width="' + (sr.dim ? 1 : 2) + '"><title>' + esc(sr.label) + '</title></polygon>';
    });
    return s + '</svg>';
  }

  function sparkline(values, opts) {
    const o = opts || {};
    const W = o.width || 160, H = o.height || 36;
    if (!values.length) return svgOpen(W, H, '추이') + '</svg>';
    const lo = Math.min(...values), hi = Math.max(...values);
    const x = (i) => 2 + (W - 4) * (values.length === 1 ? 1 : i / (values.length - 1));
    const y = (v) => 3 + (H - 6) * (1 - (v - lo) / ((hi - lo) || 1));
    const pts = values.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
    return svgOpen(W, H, o.title || '점수 추이', 'kc-spark') + '<polyline points="' + pts + '" fill="none" stroke="' + (o.color || 'var(--kc-bar, #4263eb)') + '" stroke-width="1.8"/>' +
      '<circle cx="' + x(values.length - 1).toFixed(1) + '" cy="' + y(values[values.length - 1]).toFixed(1) + '" r="2.6" fill="' + (o.color || 'var(--kc-bar, #4263eb)') + '"/></svg>';
  }

  /** 가로 게이지 (FR-P7). value/max, 초과 시 빗금 */
  function gauge(value, max, opts) {
    const o = opts || {};
    const W = o.width || 220, H = o.height || 18;
    const k = max > 0 ? value / max : 0;
    const hid = nextId('hatch');
    const over = k > 1;
    const w = Math.min(1, k) * (W - 2);
    return svgOpen(W, H, o.title || '게이지', 'kc-gauge') + '<defs>' + hatchDef(hid) + '</defs><rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="4" class="kc-gauge-bg"/>' +
      '<rect x="1" y="1" width="' + w.toFixed(1) + '" height="' + (H - 2) + '" rx="4" fill="' + (over ? 'url(#' + hid + ')' : (o.color || 'var(--kc-ok, #2b8a3e)')) + '"/>' +
      '<text x="' + (W / 2) + '" y="' + (H / 2 + 4) + '" text-anchor="middle" class="kc-gauge-text">' + esc(o.label || Math.round(k * 100) + '%') + '</text></svg>';
  }

  KBO.Chart = { esc, ticks, bar, dot, line, heatmap, radar, sparkline, gauge, fmtDefault };
});
