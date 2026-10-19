/*
 * 화면 공통 — 지도 위젯. 기본은 내장 SVG 지도, Kakao 키가 있고 SDK가 준비되면 Kakao 지도(D4, FR-T3).
 * 마커 드래그(FR-T4)와 키보드 이동(화살표, NFR-7)을 지원한다.
 */
(function () {
  'use strict';
  const KBO = window.KBO;
  const UI = KBO.UI;
  const { MapKit } = KBO;

  /**
   * opts: { markers: () => [...], lines: () => [...], onDragEnd(id, lat, lon), onMarkerClick(id),
   *         width, allowKakao, tags, caption, extraClass }
   */
  function mapWidget(el, app, opts) {
    el.classList.add('k-map');
    let kakaoMap = null;
    let kakaoObjs = [];
    let drag = null;

    function renderSvg(body) {
      const r = MapKit.render({ width: opts.width || 420, markers: opts.markers(), lines: opts.lines ? opts.lines() : [], labels: opts.labels !== false, extraClass: opts.extraClass, maxWidth: opts.maxWidth || 9999, grid: opts.grid });
      body.innerHTML = r.svg;
      body._proj = r.proj;
    }

    function renderKakao(body) {
      const kakao = app.kakao;
      const markers = opts.markers();
      if (!kakaoMap || kakaoMap.__host !== body) {
        body.innerHTML = '';
        kakaoMap = new kakao.maps.Map(body, { center: new kakao.maps.LatLng(36.3, 127.8), level: 13 });
        kakaoMap.__host = body;
      }
      for (const o of kakaoObjs) o.setMap(null);
      kakaoObjs = [];
      for (const ln of opts.lines ? opts.lines() : []) {
        const pl = new kakao.maps.Polyline({ path: [new kakao.maps.LatLng(ln.from.lat, ln.from.lon), new kakao.maps.LatLng(ln.to.lat, ln.to.lon)], strokeWeight: ln.width || 2, strokeColor: ln.color && ln.color.startsWith('#') ? ln.color : '#364fc7', strokeOpacity: ln.dim ? 0.25 : 0.85, strokeStyle: ln.dash ? 'shortdash' : 'solid' });
        pl.setMap(kakaoMap); kakaoObjs.push(pl);
      }
      for (const mk of markers) {
        const pos = new kakao.maps.LatLng(mk.lat, mk.lon);
        const marker = new kakao.maps.Marker({ position: pos, draggable: !!mk.draggable, title: mk.label });
        marker.setMap(kakaoMap); kakaoObjs.push(marker);
        const label = new kakao.maps.CustomOverlay({ position: pos, yAnchor: 2.4, content: '<div class="k-kakao-label" style="--tc:' + UI.esc(mk.color || '#333') + '">' + UI.esc(mk.label || '') + '</div>' });
        label.setMap(kakaoMap); kakaoObjs.push(label);
        if (mk.draggable && opts.onDragEnd) kakao.maps.event.addListener(marker, 'dragend', () => { const p = marker.getPosition(); opts.onDragEnd(mk.id, p.getLat(), p.getLng()); });
        if (opts.onMarkerClick) kakao.maps.event.addListener(marker, 'click', () => opts.onMarkerClick(mk.id));
      }
    }

    function render() {
      const useKakao = opts.allowKakao !== false && app.kakao && app.kakaoKey;
      let body = el.querySelector('.k-map-body');
      let cap = el.querySelector('.k-map-caption');
      if (!body) {
        el.innerHTML = '<div class="k-map-body"></div><div class="k-map-caption"></div>';
        body = el.querySelector('.k-map-body'); cap = el.querySelector('.k-map-caption');
      }
      const mode = useKakao ? 'Kakao 지도' : '내장 SVG 지도';
      cap.innerHTML = '<span class="k-map-mode">' + mode + '</span>' + (app.kakaoError ? ' <span class="k-chip k-chip-warn">⚠ ' + UI.esc(app.kakaoError) + '</span>' : '') + (opts.caption ? ' <span class="k-muted">' + opts.caption() + '</span>' : '');
      if (useKakao) {
        try { renderKakao(body); return; } catch (e) { app.kakaoError = 'Kakao 지도 오류: ' + e.message; kakaoMap = null; }
      }
      kakaoMap = null;
      renderSvg(body);
    }

    // SVG 마커 드래그
    function svgPoint(svg, evt) {
      const pt = svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }
    el.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.kmap-drag');
      if (!g || !opts.onDragEnd) return;
      const svg = g.ownerSVGElement;
      drag = { g, svg, id: g.dataset.id, moved: false };
      g.setPointerCapture && g.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = svgPoint(drag.svg, e);
      drag.g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')');
      drag.moved = true; drag.p = p;
    });
    const end = () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.moved && d.p) {
        const body = el.querySelector('.k-map-body');
        const ll = body._proj.unproject(d.p.x, d.p.y);
        opts.onDragEnd(d.id, Math.round(ll.lat * 1e5) / 1e5, Math.round(ll.lon * 1e5) / 1e5);
      } else if (opts.onMarkerClick) opts.onMarkerClick(d.id);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', () => { drag = null; render(); });
    el.addEventListener('click', (e) => {
      const g = e.target.closest('.kmap-marker');
      if (g && !g.classList.contains('kmap-drag') && opts.onMarkerClick) opts.onMarkerClick(g.dataset.id);
    });
    el.addEventListener('keydown', (e) => {
      const g = e.target.closest && e.target.closest('.kmap-drag');
      if (!g || !opts.onDragEnd) return;
      const step = e.shiftKey ? 0.05 : 0.005;
      const d = { ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      const mk = opts.markers().find((x) => String(x.id) === g.dataset.id);
      if (mk) opts.onDragEnd(mk.id, Math.round((mk.lat + d[0]) * 1e5) / 1e5, Math.round((mk.lon + d[1]) * 1e5) / 1e5);
      setTimeout(() => { const n = el.querySelector('.kmap-drag[data-id="' + CSS.escape(g.dataset.id) + '"]'); if (n) n.focus(); }, 0);
    });

    if (app.kakaoKey && !app.kakao) app.ensureKakao();
    return UI.mount(el, app, render, opts.tags || ['teams', 'map']);
  }

  UI.mapWidget = mapWidget;
})();
