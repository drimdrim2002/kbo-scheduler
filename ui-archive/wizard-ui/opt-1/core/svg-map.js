/*
 * KBO 공통 코어 — 내장 한반도(남한) SVG 지도, 구장 사전 검색, 거리 추정, Kakao 로더/폴백 (D4).
 * 지도·검색·투영은 DOM에 의존하지 않는다. Kakao 로더만 호출 시 document를 인자로 받는다.
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).map = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  // 단순화한 해안선 (경도, 위도). 축척 표현용이며 측량 정확도는 없다.
  const MAINLAND = [
    [126.10, 37.74], [126.42, 37.82], [126.68, 37.96], [126.86, 38.06], [127.10, 38.27], [127.40, 38.32], [127.78, 38.33], [128.10, 38.30], [128.36, 38.62],
    [128.52, 38.36], [128.62, 38.15], [128.80, 37.94], [128.96, 37.76], [129.10, 37.55], [129.20, 37.38], [129.33, 37.10], [129.40, 36.80], [129.43, 36.55],
    [129.38, 36.30], [129.40, 36.10], [129.57, 36.05], [129.48, 35.85], [129.45, 35.62], [129.37, 35.43], [129.27, 35.27], [129.12, 35.10], [128.98, 35.05],
    [128.80, 35.08], [128.62, 34.98], [128.52, 34.86], [128.36, 34.84], [128.16, 34.92], [127.96, 34.86], [127.76, 34.82], [127.62, 34.70], [127.45, 34.56],
    [127.22, 34.62], [127.02, 34.54], [126.84, 34.42], [126.62, 34.30], [126.48, 34.36], [126.36, 34.52], [126.30, 34.74], [126.36, 34.98], [126.42, 35.22],
    [126.46, 35.45], [126.58, 35.66], [126.70, 35.86], [126.66, 36.02], [126.56, 36.22], [126.52, 36.44], [126.30, 36.60], [126.18, 36.78], [126.36, 36.92],
    [126.62, 36.96], [126.80, 37.02], [126.70, 37.20], [126.62, 37.38], [126.58, 37.52], [126.48, 37.62], [126.24, 37.66]
  ];
  const JEJU = [[126.16, 33.30], [126.32, 33.22], [126.56, 33.23], [126.84, 33.30], [126.95, 33.45], [126.76, 33.56], [126.50, 33.52], [126.26, 33.45]];
  const ISLANDS = [
    [[128.60, 34.90], [128.72, 34.96], [128.74, 34.80], [128.60, 34.74]], // 거제
    [[127.85, 34.82], [127.97, 34.86], [127.98, 34.74], [127.86, 34.72]], // 남해
    [[126.35, 37.64], [126.52, 37.68], [126.50, 37.80], [126.36, 37.78]]  // 강화
  ];
  const BOX = { lonMin: 125.6, lonMax: 130.2, latMin: 33.0, latMax: 38.75 };
  const COS = Math.cos(36 * Math.PI / 180);

  /** 투영기: 등장방형 + cos(36°) 보정 */
  function projection(width, box) {
    const b = box || BOX;
    const k = width / ((b.lonMax - b.lonMin) * COS);
    const height = Math.round((b.latMax - b.latMin) * k);
    return {
      width, height, box: b,
      project: (lat, lon) => [(lon - b.lonMin) * COS * k, (b.latMax - lat) * k],
      unproject: (x, y) => ({ lat: b.latMax - y / k, lon: b.lonMin + x / (COS * k) })
    };
  }

  function esc(s) { return KBO.Chart ? KBO.Chart.esc(s) : String(s); }

  function polyPath(points, proj) {
    return 'M' + points.map(([lon, lat]) => { const [x, y] = proj.project(lat, lon); return x.toFixed(1) + ' ' + y.toFixed(1); }).join('L') + 'Z';
  }

  /** 같은 좌표의 마커(공유 구장)를 살짝 벌린다 */
  function spreadMarkers(markers, proj, radius) {
    const groups = new Map();
    const out = markers.map((mk) => {
      const [x, y] = proj.project(mk.lat, mk.lon);
      const key = Math.round(x / 4) + ':' + Math.round(y / 4);
      if (!groups.has(key)) groups.set(key, []);
      const o = Object.assign({}, mk, { x, y });
      groups.get(key).push(o);
      return o;
    });
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      g.forEach((o, i) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / g.length; o.x += Math.cos(a) * radius; o.y += Math.sin(a) * radius; o.shared = true; });
    }
    return out;
  }

  /**
   * 지도 SVG.
   * opts: { width, markers:[{id, lat, lon, label, color, sub, size, ring, dim, draggable}],
   *         lines:[{from:{lat,lon}, to:{lat,lon}, color, width, dash, title, curve, arrow, dim}],
   *         labels: true, title, extraClass }
   * 반환: { svg, proj, markers(투영 좌표 포함) }
   */
  function render(opts) {
    const proj = projection(opts.width || 420, opts.box);
    const W = proj.width, H = proj.height;
    const markers = spreadMarkers(opts.markers || [], proj, opts.spread || 9);
    let s = '<svg class="kmap ' + (opts.extraClass || '') + '" viewBox="0 0 ' + W.toFixed(0) + ' ' + H + '" width="100%" role="img" aria-label="' + esc(opts.title || '전국 구장 지도') + '" style="max-width:' + (opts.maxWidth || W) + 'px">';
    s += '<defs><marker id="kmap-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>';
    s += '<rect class="kmap-sea" width="' + W.toFixed(0) + '" height="' + H + '"/>';
    if (opts.grid !== false) {
      for (let lat = 34; lat <= 38; lat++) { const y = proj.project(lat, 126)[1]; s += '<line class="kmap-grid" x1="0" x2="' + W.toFixed(0) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="kmap-gridlabel" x="3" y="' + (y - 2).toFixed(1) + '">' + lat + '°N</text>'; }
      for (let lon = 126; lon <= 130; lon++) { const x = proj.project(36, lon)[0]; s += '<line class="kmap-grid" y1="0" y2="' + H + '" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '"/>'; }
    }
    s += '<path class="kmap-land" d="' + polyPath(MAINLAND, proj) + polyPath(JEJU, proj) + ISLANDS.map((p) => polyPath(p, proj)).join('') + '"/>';
    for (const ln of opts.lines || []) {
      const [x1, y1] = proj.project(ln.from.lat, ln.from.lon);
      const [x2, y2] = proj.project(ln.to.lat, ln.to.lon);
      const dx = x2 - x1, dy = y2 - y1;
      const c = ln.curve == null ? 0.18 : ln.curve;
      const mx = (x1 + x2) / 2 - dy * c, my = (y1 + y2) / 2 + dx * c;
      s += '<path class="kmap-line' + (ln.dim ? ' kmap-dim' : '') + '" d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" stroke="' + (ln.color || 'var(--kmap-line, #364fc7)') + '" stroke-width="' + (ln.width || 2) + '" fill="none"' + (ln.dash ? ' stroke-dasharray="' + ln.dash + '"' : '') + (ln.arrow ? ' marker-end="url(#kmap-arrow)"' : '') + '>' + (ln.title ? '<title>' + esc(ln.title) + '</title>' : '') + '</path>';
    }
    for (const mk of markers) {
      const r = mk.size || 7;
      s += '<g class="kmap-marker' + (mk.dim ? ' kmap-dim' : '') + (mk.draggable ? ' kmap-drag' : '') + (mk.active ? ' kmap-active' : '') + '" data-id="' + esc(mk.id) + '" transform="translate(' + mk.x.toFixed(1) + ' ' + mk.y.toFixed(1) + ')"' + (mk.draggable ? ' tabindex="0" role="button" aria-label="' + esc((mk.label || '') + ' 마커, 화살표 키로 이동') + '"' : '') + '>';
      if (mk.ring) s += '<circle r="' + (r + 5) + '" class="kmap-ring" stroke="' + (mk.ringColor || mk.color || '#000') + '"/>';
      s += mk.shape === 'square'
        ? '<rect x="' + -r + '" y="' + -r + '" width="' + 2 * r + '" height="' + 2 * r + '" fill="' + (mk.color || '#333') + '" class="kmap-dot"/>'
        : '<circle r="' + r + '" fill="' + (mk.color || '#333') + '" class="kmap-dot"/>';
      if (mk.badge) s += '<text class="kmap-badge" y="4" text-anchor="middle">' + esc(mk.badge) + '</text>';
      if (opts.labels !== false && mk.label) s += '<text class="kmap-label" x="' + (r + 4) + '" y="4">' + esc(mk.label) + '</text>';
      if (mk.sub) s += '<text class="kmap-sub" x="' + (r + 4) + '" y="16">' + esc(mk.sub) + '</text>';
      s += '<title>' + esc((mk.label || '') + (mk.title ? ' — ' + mk.title : '')) + '</title></g>';
    }
    s += '</svg>';
    return { svg: s, proj, markers };
  }

  /** 하버사인 직선거리 (km) */
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371.0088;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** FR-T6 추정 도로거리 = 직선거리 × 도로계수, 소수 1자리 */
  function estimateRoadKm(a, b, roadFactor) {
    if (a.stadium && a.stadium === b.stadium) return 0;
    return Math.round(haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * (roadFactor || 1.25) * 10) / 10;
  }

  /** FR-T2 내장 구장 사전 부분 일치 검색 */
  function searchStadiums(query, dictionary) {
    const q = String(query || '').replace(/\s+/g, '').toLowerCase();
    if (!q) return [];
    const dict = dictionary || (KBO.Preset ? KBO.Preset.STADIUMS : []);
    const scored = [];
    for (const s of dict) {
      const keys = [s.name].concat(s.aliases || [], [s.city || '']).map((k) => k.replace(/\s+/g, '').toLowerCase());
      let best = -1;
      for (const k of keys) {
        if (!k) continue;
        if (k === q) best = Math.max(best, 3);
        else if (k.startsWith(q)) best = Math.max(best, 2);
        else if (k.includes(q) || (q.length >= 2 && q.includes(k))) best = Math.max(best, 1);
      }
      if (best >= 0) scored.push({ score: best, s });
    }
    scored.sort((a, b) => b.score - a.score || (a.s.tier || 9) - (b.s.tier || 9));
    return scored.map(({ s }) => ({ name: s.name, latitude: s.latitude, longitude: s.longitude, address: s.city, dome: !!s.dome, source: 'DICT' }));
  }

  /**
   * Kakao Maps SDK 동적 로더 (FR-T3). 실패하면 사유와 함께 reject한다 → 호출부가 SVG 지도로 복귀.
   * doc: document, win: window
   */
  function loadKakao(key, doc, win) {
    return new Promise((resolve, reject) => {
      if (!key) return reject(new Error('Kakao 키가 없습니다.'));
      if (win.location && win.location.protocol === 'file:') return reject(new Error('Kakao 지도는 file://에서 동작하지 않습니다. python3 -m http.server로 연 뒤 도메인을 Kakao 개발자 콘솔에 등록하세요.'));
      if (win.kakao && win.kakao.maps && win.kakao.maps.services) return resolve(win.kakao);
      const prev = doc.getElementById('kakao-sdk');
      if (prev) prev.remove();
      const sc = doc.createElement('script');
      sc.id = 'kakao-sdk';
      sc.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(key) + '&libraries=services&autoload=false';
      const timer = setTimeout(() => reject(new Error('Kakao SDK 응답 시간 초과(네트워크 또는 키 확인)')), 8000);
      sc.onerror = () => { clearTimeout(timer); reject(new Error('Kakao SDK 로드 실패: 키가 무효하거나 도메인이 등록되지 않았습니다.')); };
      sc.onload = () => {
        if (!win.kakao || !win.kakao.maps || !win.kakao.maps.load) { clearTimeout(timer); return reject(new Error('Kakao SDK 초기화 실패: 키 또는 도메인 등록을 확인하세요.')); }
        try {
          win.kakao.maps.load(() => { clearTimeout(timer); if (win.kakao.maps.services) resolve(win.kakao); else reject(new Error('services 라이브러리를 불러오지 못했습니다.')); });
        } catch (e) { clearTimeout(timer); reject(new Error('Kakao SDK 오류: ' + e.message)); }
      };
      doc.head.appendChild(sc);
    });
  }

  /** Kakao Places.keywordSearch 래퍼 */
  function kakaoSearch(kakao, query) {
    return new Promise((resolve, reject) => {
      try {
        const places = new kakao.maps.services.Places();
        places.keywordSearch(query, (data, status) => {
          if (status === kakao.maps.services.Status.OK) resolve(data.slice(0, 8).map((d) => ({ name: d.place_name, latitude: Number(d.y), longitude: Number(d.x), address: d.road_address_name || d.address_name, source: 'KAKAO' })));
          else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve([]);
          else reject(new Error('Kakao 검색 오류(' + status + ')'));
        });
      } catch (e) { reject(e); }
    });
  }

  KBO.MapKit = { MAINLAND, JEJU, BOX, projection, render, haversineKm, estimateRoadKm, searchStadiums, loadKakao, kakaoSearch };
});
