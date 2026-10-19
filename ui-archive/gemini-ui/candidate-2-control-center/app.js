/**
 * KBO TACTICAL COMMAND CENTER // Candidate 2 Controller (app.js)
 * 100% Pure Vanilla JavaScript (Zero Frameworks, Offline & file:// Compatible)
 * Uses window.KBO_DATA and window.KBOEngine from data.js
 */
(function () {
  'use strict';

  const Engine = window.KBOEngine;
  const RawData = window.KBO_DATA;

  // South Korea Approximate Coastline Polygon (Lat, Lng) for Tactical Vector GIS Canvas
  const KOREA_OUTLINE_COORDS = [
    [38.32, 127.05], [38.28, 128.35], [38.05, 128.62], [37.72, 128.92],
    [37.42, 129.19], [37.05, 129.41], [36.55, 129.44], [36.06, 129.56],
    [35.85, 129.48], [35.48, 129.42], [35.12, 129.15], [34.88, 128.72],
    [34.78, 128.25], [34.81, 127.72], [34.62, 127.25], [34.42, 126.75],
    [34.35, 126.15], [34.75, 126.12], [35.08, 126.18], [35.38, 126.35],
    [35.68, 126.48], [35.98, 126.58], [36.35, 126.48], [36.68, 126.25],
    [36.92, 126.52], [37.18, 126.62], [37.46, 126.58], [37.68, 126.55],
    [37.85, 126.68], [38.05, 126.92], [38.32, 127.05]
  ];

  // =========================================================================
  // 1. CENTRAL APPLICATION STATE
  // =========================================================================
  const state = {
    activeModule: 'all',
    activePlanMode: 'solved', // 'solved' | 'initial' | 'violation'
    teams: Engine.deepClone(RawData.teams),
    distanceMatrix: Engine.deepClone(RawData.distanceMatrix),
    calendar: Engine.deepClone(RawData.calendar),
    plans: {
      solved: Engine.deepClone(RawData.solvedPlan),
      initial: Engine.deepClone(RawData.initialPlan),
      violation: Engine.createViolationDemoPlan()
    },
    config: {
      matchStartDate: '2025-03-22',
      matchEndDate: '2025-08-31',
      allStarBreakDate: '2025-07-02',
      allStarStartDate: '2025-07-11',
      allStarEndDate: '2025-07-16',
      childrenDayStart: '2025-05-05',
      restDaysOfWeek: [1], // Monday default
      childrenDayHomeTeams: ['두산', '키움', '한화', 'NC', '롯데'],
      maxConsecutiveHomeAway: 3,
      toleranceTotalDistance: 300.0,
      toleranceHoliday: 1.5,
      toleranceWeekdayMove: 1.5,
      toleranceTotalMove: 2.0
    },
    blackouts: [
      { date: '2025-07-11', reason: '올스타 프라이데이 (휴식/이동)' },
      { date: '2025-07-12', reason: '2025 KBO 올스타전 본경기' },
      { date: '2025-07-14', reason: '올스타 브레이크 후반기 정비' }
    ],
    eventRules: [
      {
        id: 'evt-opening',
        date: '2025-03-22',
        title: '2025 정규시즌 개막 2연전 (전년도 상위 5개 구장 홈 배정)',
        consecutive: 2,
        mode: 'match', // 'match' (구단+구장 대진 고정) | 'stadium' (구장만 지정, 상대팀 자동배정)
        assignments: [
          { stadium: '잠실종합운동장', home: 'LG', away: '롯데' },
          { stadium: '문학경기장', home: 'SSG', away: '두산' },
          { stadium: '수원KT위즈파크', home: 'KT', away: '한화' },
          { stadium: '대구삼성라이언즈파크', home: '삼성', away: '키움' },
          { stadium: '광주챔피언스필드', home: 'KIA', away: 'NC' }
        ]
      },
      {
        id: 'evt-childrenday',
        date: '2025-05-05',
        title: '어린이날 주중 3연전 (격년제 의무 홈구장 5곳 고정 · 월요일 경기 허용)',
        consecutive: 3,
        mode: 'stadium', // Default showcase: stadium-only host pinning mode!
        assignments: [
          { stadium: '잠실종합운동장', home: '두산', away: 'LG' },
          { stadium: '고척돔야구장', home: '키움', away: 'KIA' },
          { stadium: '한화이글스파크', home: '한화', away: '삼성' },
          { stadium: '창원NC파크', home: 'NC', away: 'KT' },
          { stadium: '사직야구장', home: '롯데', away: 'SSG' }
        ]
      },
      {
        id: 'evt-memorial',
        date: '2025-06-06',
        title: '현충일 연휴 주말 3연전 (공휴일 가중치 3점 특별 관리 슬롯)',
        consecutive: 3,
        mode: 'stadium',
        assignments: [
          { stadium: '잠실종합운동장', home: '두산', away: '롯데' },
          { stadium: '고척돔야구장', home: '키움', away: 'LG' },
          { stadium: '수원KT위즈파크', home: 'KT', away: 'SSG' },
          { stadium: '대구삼성라이언즈파크', home: '삼성', away: 'NC' },
          { stadium: '광주챔피언스필드', home: 'KIA', away: '한화' }
        ]
      }
    ],
    // GIS Map State
    mapEngine: 'vector', // 'vector' | 'leaflet' | 'kakao' | 'naver'
    focusTeam: 'SSG',
    showAllArcs: false,
    showDistanceLabels: true,
    leafletMap: null,
    leafletLayerGroup: null,
    kakaoApiKey: '',
    naverClientId: '',

    // Calendar Inspector State
    selectedCalendarMonth: 'ALL',
    selectedSlotDate: '2025-05-05',

    // Pre-flight & Solver State
    activeJsonTab: 'summary',
    solverRunning: false,
    solverTimer: null,
    convergenceHistory: [],

    // Analytics & Charts State
    softSortKey: 'totalDistance',
    softSortAsc: false,
    chart2Mode: 'count', // 'count' | 'distance'
    radarPrimary: '롯데',
    radarSecondary: '두산',
    radarShowInitial: true,
    replayTeam: '롯데',
    replayStep: 45,
    replayPlaying: false,
    replayTimer: null,
    heatmapCellBounds: [],

    // Cached Evaluations
    evalCache: {
      active: null,
      initial: null,
      solved: null
    }
  };

  // =========================================================================
  // 2. CORE EVALUATION & GLOBAL HEADER SYNC
  // =========================================================================
  function getActivePlanArray() {
    return state.plans[state.activePlanMode] || state.plans.solved;
  }

  function syncConfigFromTeams() {
    state.config.childrenDayHomeTeams = state.teams
      .filter(t => t.childrenDayHome)
      .map(t => t.name);
  }

  function recomputeEvaluations() {
    syncConfigFromTeams();
    const cfg = {
      ...state.config,
      calendar: state.calendar
    };
    state.evalCache.initial = Engine.evaluatePlan(state.plans.initial, state.teams, state.distanceMatrix, cfg);
    state.evalCache.solved = Engine.evaluatePlan(state.plans.solved, state.teams, state.distanceMatrix, cfg);
    state.evalCache.active = Engine.evaluatePlan(getActivePlanArray(), state.teams, state.distanceMatrix, cfg);
    updateGlobalHeader();
  }

  function setTickerMessage(msg) {
    const el = document.getElementById('liveTickerMessage');
    if (el) el.textContent = msg;
  }

  function updateGlobalHeader() {
    const ev = state.evalCache.active;
    if (!ev) return;

    const lamp = document.getElementById('globalIntegrityLamp');
    const lampText = document.getElementById('globalIntegrityText');
    const hardEl = document.getElementById('globalHardScore');
    const softEl = document.getElementById('globalSoftScore');
    const totalKmEl = document.getElementById('headerTotalKm');
    const tolPassEl = document.getElementById('headerTolerancePass');
    const solverStateEl = document.getElementById('headerSolverState');

    const isFeasible = ev.score.feasible;
    if (lamp && lampText) {
      lamp.classList.toggle('violation', !isFeasible);
      lamp.classList.toggle('feasible', isFeasible);
      lampText.textContent = isFeasible
        ? 'FEASIBLE (0 VIOLATIONS)'
        : `VIOLATION (${ev.score.totalHardViolations} ALERTS)`;
    }

    if (hardEl) {
      hardEl.textContent = `[${ev.score.hard[0]} / ${ev.score.hard[1]}]hard`;
      hardEl.parentElement.classList.toggle('has-violation', !isFeasible);
    }

    if (softEl) {
      const s = ev.score.soft;
      softEl.textContent = `[${s[0]} / ${s[1]} / ${s[2]} / ${s[3]} / ${s[4]}]soft`;
    }

    if (totalKmEl) {
      totalKmEl.textContent = `${ev.leagueSummary.totalDistance.toLocaleString('ko-KR')} km`;
    }

    if (tolPassEl) {
      const cnt = ev.leagueSummary.teamsWithinDistanceTolerance;
      tolPassEl.textContent = `${cnt}/10 IN-BAND (±${state.config.toleranceTotalDistance}km)`;
      tolPassEl.className = `kpi-mini-val ${cnt >= 8 ? 'emerald' : cnt >= 5 ? 'amber' : 'crimson'}`;
    }

    if (solverStateEl && !state.solverRunning) {
      if (state.activePlanMode === 'solved') {
        solverStateEl.textContent = 'CONVERGED [OPTIMAL]';
        solverStateEl.className = 'kpi-mini-val emerald';
      } else if (state.activePlanMode === 'initial') {
        solverStateEl.textContent = 'UNOPTIMIZED [RAW]';
        solverStateEl.className = 'kpi-mini-val amber';
      } else {
        solverStateEl.textContent = 'HARD VIOLATION [ALERT]';
        solverStateEl.className = 'kpi-mini-val crimson';
      }
    }

    // Sync active plan buttons in header and Module 4
    document.querySelectorAll('[data-plan-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-plan-mode') === state.activePlanMode);
    });
  }

  function switchPlanMode(mode) {
    if (!state.plans[mode]) return;
    state.activePlanMode = mode;
    recomputeEvaluations();
    renderCalendarModule();
    renderPreflightAndSolverModule();
    renderAnalyticsModule();

    const modeNames = {
      solved: '최적화 완료안 (Feasible Plan)',
      initial: '초기 배정안 (Unoptimized Plan)',
      violation: 'Hard 제약 위반 시뮬레이션 플랜'
    };
    setTickerMessage(`활성 스케줄 데이터셋 전환 완료: ${modeNames[mode]} — Score: ${state.evalCache.active.score.formatted}`);
  }

  // =========================================================================
  // 3. MODULE 01: GIS TEAM REGISTRY, AUTO-GEOCODING & DISTANCE MATRIX
  // =========================================================================
  function renderGisModule() {
    renderTeamRegistryTable();
    renderFocusTeamPills();
    renderDistanceMatrixTable();
    renderActiveGisMap();
  }

  function renderTeamRegistryTable() {
    const tbody = document.getElementById('teamRegistryTbody');
    const quickSel = document.getElementById('quickGeocodeTeamSelect');
    if (!tbody) return;

    if (quickSel && quickSel.options.length === 0) {
      quickSel.innerHTML = state.teams
        .map(t => `<option value="${t.name}">${t.name} (${t.stadium})</option>`)
        .join('');
    }

    tbody.innerHTML = state.teams.map((t, idx) => {
      const isFocused = state.focusTeam === t.name;
      return `
        <tr class="${isFocused ? 'selected-row' : ''}" data-team-row="${t.name}">
          <td>
            <div class="team-badge-cell" data-focus-team-click="${t.name}" title="클릭하여 ${t.name} 출발 이동 노선(Arc) 하이라이트">
              <span class="team-color-bar" style="background:${t.color}; box-shadow:0 0 6px ${t.color}"></span>
              <span>${t.name}</span>
              ${t.sharedStadium ? '<span class="shared-tag">잠실공유</span>' : ''}
            </div>
          </td>
          <td>
            <input type="text" class="reg-input-stadium" data-team-idx="${idx}" data-field="stadium"
              value="${t.stadium}" title="${t.address || ''}" placeholder="구장명 또는 주소 입력" />
          </td>
          <td>
            <input type="number" step="0.0001" class="reg-input-coord" data-team-idx="${idx}" data-field="latitude"
              value="${Number(t.latitude).toFixed(4)}" />
          </td>
          <td>
            <input type="number" step="0.0001" class="reg-input-coord" data-team-idx="${idx}" data-field="longitude"
              value="${Number(t.longitude).toFixed(4)}" />
          </td>
          <td style="text-align:center;">
            <input type="checkbox" data-team-idx="${idx}" data-field="childrenDayHome"
              ${t.childrenDayHome ? 'checked' : ''} style="accent-color:var(--neon-amber);cursor:pointer;" />
          </td>
          <td style="text-align:center;">
            <button type="button" class="btn-chip" data-geocode-row="${idx}" title="구장명/주소로 위경도 자동 변환">📍변환</button>
          </td>
        </tr>
      `;
    }).join('');

    // Row click for focusing team on map
    tbody.querySelectorAll('[data-focus-team-click]').forEach(el => {
      el.addEventListener('click', () => {
        state.focusTeam = el.getAttribute('data-focus-team-click');
        renderTeamRegistryTable();
        renderFocusTeamPills();
        renderActiveGisMap();
      });
    });

    // Input change listeners
    tbody.querySelectorAll('input').forEach(inp => {
      const idx = Number(inp.getAttribute('data-team-idx'));
      const field = inp.getAttribute('data-field');

      if (field === 'stadium') {
        inp.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            await triggerTeamGeocode(idx, inp.value);
          }
        });
        inp.addEventListener('change', () => {
          state.teams[idx].stadium = inp.value.trim();
        });
      } else if (field === 'latitude' || field === 'longitude') {
        inp.addEventListener('change', () => {
          const val = parseFloat(inp.value);
          if (!Number.isNaN(val)) {
            state.teams[idx][field] = val;
            renderActiveGisMap();
            renderPreflightAndSolverModule();
          }
        });
      } else if (field === 'childrenDayHome') {
        inp.addEventListener('change', () => {
          state.teams[idx].childrenDayHome = inp.checked;
          recomputeEvaluations();
          renderAnalyticsModule();
          renderPreflightAndSolverModule();
        });
      }
    });

    // Geocode button per row
    tbody.querySelectorAll('[data-geocode-row]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-geocode-row'));
        const stadiumInput = tbody.querySelector(`input[data-team-idx="${idx}"][data-field="stadium"]`);
        await triggerTeamGeocode(idx, stadiumInput ? stadiumInput.value : state.teams[idx].stadium);
      });
    });
  }

  async function triggerTeamGeocode(teamIdx, queryStr) {
    const team = state.teams[teamIdx];
    if (!team) return;
    const badge = document.getElementById('geocodeStatusBadge');
    if (badge) {
      badge.textContent = `GEOCODING [${queryStr}]...`;
      badge.className = 'panel-sub-badge c-amber';
    }

    const res = await Engine.geocodeLocation(queryStr);
    if (res) {
      team.stadium = res.stadium;
      team.address = res.address || team.address;
      if (res.city) team.city = res.city;
      team.latitude = res.latitude;
      team.longitude = res.longitude;
      // Check shared stadium status
      team.sharedStadium = state.teams.some((other, i) => i !== teamIdx && other.stadium === team.stadium);

      // Automatically recalculate distance matrix from updated coordinates
      const useLive = document.getElementById('chkUseLiveOsrm')?.checked || false;
      state.distanceMatrix = await Engine.calculateDistanceMatrixFromCoords(state.teams, {
        useLiveRouteApi: useLive,
        forceFormula: true
      });

      state.focusTeam = team.name;
      recomputeEvaluations();
      renderGisModule();
      renderPreflightAndSolverModule();
      renderAnalyticsModule();

      if (badge) {
        badge.textContent = `OK: ${res.source}`;
        badge.className = 'panel-sub-badge emerald';
      }
      setTickerMessage(`[지오코딩 & 거리행렬 자동갱신] ${team.name} 홈구장 → ${res.stadium} (${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}) [${res.source}]`);
    } else {
      if (badge) {
        badge.textContent = 'GEOCODE NOT FOUND';
        badge.className = 'panel-sub-badge c-crimson';
      }
      setTickerMessage(`[지오코딩 실패] '${queryStr}' 좌표를 찾을 수 없습니다. 구장명 또는 도시명(포항, 울산, 청주, 잠실 등)을 확인하세요.`);
    }
  }

  function renderFocusTeamPills() {
    const bar = document.getElementById('gisFocusTeamBar');
    if (!bar) return;
    bar.innerHTML = state.teams.map(t => `
      <button type="button" class="t-pill ${state.focusTeam === t.name ? 'active' : ''}" data-gis-pill="${t.name}">
        ${t.name}
      </button>
    `).join('');

    bar.querySelectorAll('[data-gis-pill]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.focusTeam = btn.getAttribute('data-gis-pill');
        renderTeamRegistryTable();
        renderFocusTeamPills();
        renderActiveGisMap();
      });
    });
  }

  function renderDistanceMatrixTable() {
    const thead = document.getElementById('distanceMatrixThead');
    const tbody = document.getElementById('distanceMatrixTbody');
    if (!thead || !tbody) return;

    const lookup = Engine.buildDistanceLookup(state.teams, state.distanceMatrix);

    thead.innerHTML = `
      <tr>
        <th class="row-header">출발 \\ 도착</th>
        ${state.teams.map(t => `<th title="${t.stadium}">${t.name}</th>`).join('')}
      </tr>
    `;

    let minPair = { from: '', to: '', dist: 99999 };
    let maxPair = { from: '', to: '', dist: -1 };

    tbody.innerHTML = state.teams.map(fromT => {
      const cells = state.teams.map(toT => {
        const d = Number((lookup[fromT.name]?.[toT.name] ?? 0).toFixed(1));
        if (fromT.name !== toT.name && d > 0) {
          if (d < minPair.dist) minPair = { from: fromT.name, to: toT.name, dist: d };
          if (d > maxPair.dist) maxPair = { from: fromT.name, to: toT.name, dist: d };
        }
        let cls = 'dist-zero';
        if (d > 0 && d <= 60) cls = 'dist-short';
        else if (d > 60 && d <= 220) cls = 'dist-mid';
        else if (d > 220 && d <= 350) cls = 'dist-long';
        else if (d > 350) cls = 'dist-extreme';

        return `
          <td class="${cls}" title="${fromT.name}(${fromT.stadium}) → ${toT.name}(${toT.stadium}): ${d} km">
            <input type="number" step="0.1" min="0" class="dist-cell-input"
              data-from="${fromT.name}" data-to="${toT.name}" value="${d.toFixed(1)}" />
          </td>
        `;
      }).join('');

      return `
        <tr class="${state.focusTeam === fromT.name ? 'selected-row' : ''}">
          <th class="row-header">${fromT.name}</th>
          ${cells}
        </tr>
      `;
    }).join('');

    const minEl = document.getElementById('matMinPair');
    const maxEl = document.getElementById('matMaxPair');
    if (minEl && minPair.from) minEl.textContent = `${minPair.from} ↔ ${minPair.to} (${minPair.dist}km)`;
    if (maxEl && maxPair.from) maxEl.textContent = `${maxPair.from} ↔ ${maxPair.to} (${maxPair.dist}km)`;

    // Cell inline edit handler
    tbody.querySelectorAll('.dist-cell-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const from = inp.getAttribute('data-from');
        const to = inp.getAttribute('data-to');
        const val = Math.max(0, parseFloat(inp.value) || 0);
        const sym = document.getElementById('chkSymmetricMatrixEdit')?.checked ?? true;

        updateDistanceEntry(from, to, val);
        if (sym && from !== to) {
          updateDistanceEntry(to, from, val);
        }

        recomputeEvaluations();
        renderDistanceMatrixTable();
        renderActiveGisMap();
        renderPreflightAndSolverModule();
        renderAnalyticsModule();
        setTickerMessage(`[거리 행렬 수동 편집] ${from} ↔ ${to} 구장 간 이동거리 = ${val.toFixed(1)} km 반영 완료.`);
      });
    });
  }

  function updateDistanceEntry(from, to, dist) {
    const entry = state.distanceMatrix.find(e => e.from === from && e.to === to);
    if (entry) {
      entry.distance = Number(dist.toFixed(1));
    } else {
      state.distanceMatrix.push({
        index: state.distanceMatrix.length,
        from,
        to,
        distance: Number(dist.toFixed(1))
      });
    }
  }

  // =========================================================================
  // 4. MULTI-ENGINE GIS MAP RENDERER (Tactical Vector Canvas + Leaflet + Kakao/Naver)
  // =========================================================================
  function updateGisHudOriginBox() {
    const origin = state.teams.find(t => t.name === state.focusTeam) || state.teams[0];
    const lookup = Engine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const dists = state.teams
      .filter(t => t.name !== origin.name && (lookup[origin.name]?.[t.name] ?? 0) > 0)
      .map(t => ({ name: t.name, km: lookup[origin.name][t.name] }))
      .sort((a, b) => a.km - b.km);

    const hudTeam = document.getElementById('hudOriginTeam');
    const hudCoords = document.getElementById('hudOriginCoords');
    const hudStats = document.getElementById('hudOriginStats');

    if (hudTeam) hudTeam.textContent = `${origin.fullName || origin.name} (${origin.stadium})`;
    if (hudCoords) hudCoords.textContent = `LAT ${Number(origin.latitude).toFixed(4)}° N / LNG ${Number(origin.longitude).toFixed(4)}° E`;
    if (hudStats && dists.length > 0) {
      const minD = dists[0];
      const maxD = dists[dists.length - 1];
      const avgKm = (dists.reduce((acc, x) => acc + x.km, 0) / dists.length).toFixed(1);
      hudStats.textContent = `최단: ${minD.name} ${minD.km}km | 최장: ${maxD.name} ${maxD.km}km | 평균: ${avgKm}km`;
    }
  }

  function renderActiveGisMap() {
    updateGisHudOriginBox();
    const vectorCanvas = document.getElementById('tacticalGisCanvas');
    const extContainer = document.getElementById('externalMapContainer');
    if (!vectorCanvas || !extContainer) return;

    document.querySelectorAll('[data-map-engine]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-map-engine') === state.mapEngine);
    });

    if (state.mapEngine === 'vector') {
      extContainer.classList.add('hidden');
      vectorCanvas.classList.remove('hidden');
      drawTacticalVectorGisCanvas();
    } else if (state.mapEngine === 'leaflet') {
      if (typeof window.L !== 'undefined') {
        vectorCanvas.classList.add('hidden');
        extContainer.classList.remove('hidden');
        renderLeafletDarkMap(extContainer);
      } else {
        // Offline fallback
        state.mapEngine = 'vector';
        drawTacticalVectorGisCanvas();
        setTickerMessage('오프라인 환경 감지: 내장 고해상도 Tactical Vector GIS 엔진으로 렌더링합니다.');
      }
    } else if (state.mapEngine === 'kakao') {
      if (window.kakao && window.kakao.maps) {
        vectorCanvas.classList.add('hidden');
        extContainer.classList.remove('hidden');
        renderKakaoMapInstance(extContainer);
      } else {
        drawTacticalVectorGisCanvas();
        openMapApiModal('Kakao Map SDK 키를 설정하면 실제 카카오맵 타일과 실시간 지오코더가 활성화됩니다.');
      }
    } else if (state.mapEngine === 'naver') {
      if (window.naver && window.naver.maps) {
        vectorCanvas.classList.add('hidden');
        extContainer.classList.remove('hidden');
        renderNaverMapInstance(extContainer);
      } else {
        drawTacticalVectorGisCanvas();
        openMapApiModal('Naver Cloud Map Client ID를 설정하면 실제 네이버 지도 타일이 활성화됩니다.');
      }
    }
  }

  function projectLatLngToCanvas(lat, lng, width, height, pad = 42) {
    // South Korea bounding box with comfortable padding
    const minLat = 34.30;
    const maxLat = 38.35;
    const minLng = 125.95;
    const maxLng = 129.75;

    const usableW = width - pad * 2;
    const usableH = height - pad * 2;

    const x = pad + ((lng - minLng) / (maxLng - minLng)) * usableW;
    const y = height - pad - ((lat - minLat) / (maxLat - minLat)) * usableH;
    return { x, y };
  }

  function drawTacticalVectorGisCanvas() {
    const canvas = document.getElementById('tacticalGisCanvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(480, rect.width || 660);
    const H = Math.max(420, rect.height || 500);

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Tactical Dark Ocean & Grid Background
    ctx.clearRect(0, 0, W, H);
    const bgGrad = ctx.createRadialGradient(W * 0.48, H * 0.45, 20, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    bgGrad.addColorStop(0, '#0F1E36');
    bgGrad.addColorStop(1, '#050912');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Lat/Lon Graticule Lines
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.11)';
    ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';

    for (let lat = 35; lat <= 38; lat += 1) {
      const p1 = projectLatLngToCanvas(lat, 126.0, W, H);
      const p2 = projectLatLngToCanvas(lat, 129.6, W, H);
      ctx.beginPath();
      ctx.moveTo(0, p1.y);
      ctx.lineTo(W, p2.y);
      ctx.stroke();
      ctx.fillText(`${lat}°N`, 8, p1.y - 4);
    }
    for (let lng = 126; lng <= 129; lng += 1) {
      const p1 = projectLatLngToCanvas(34.4, lng, W, H);
      const p2 = projectLatLngToCanvas(38.3, lng, W, H);
      ctx.beginPath();
      ctx.moveTo(p1.x, 0);
      ctx.lineTo(p2.x, H);
      ctx.stroke();
      ctx.fillText(`${lng}°E`, p1.x + 4, H - 8);
    }

    // Radar Concentric Rings centered on Daejeon (Central Hub)
    const centerHub = projectLatLngToCanvas(36.32, 127.43, W, H);
    [70, 140, 210].forEach(r => {
      ctx.beginPath();
      ctx.arc(centerHub.x, centerHub.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.stroke();
    });

    // 2. Draw South Korea Landmass Vector Polygon
    ctx.beginPath();
    KOREA_OUTLINE_COORDS.forEach(([lat, lng], i) => {
      const pt = projectLatLngToCanvas(lat, lng, W, H);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.42)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Compute screen positions for 10 teams (offsetting Jamsil Doosan/LG slightly so both are clickable)
    const lookup = Engine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const nodePositions = {};
    state.teams.forEach(t => {
      const base = projectLatLngToCanvas(t.latitude, t.longitude, W, H);
      let offsetX = 0;
      let offsetY = 0;
      if (t.name === '두산' && t.sharedStadium) { offsetX = -11; offsetY = -7; }
      if (t.name === 'LG' && t.sharedStadium) { offsetX = 11; offsetY = 7; }
      nodePositions[t.name] = {
        x: base.x + offsetX,
        y: base.y + offsetY,
        rawX: base.x,
        rawY: base.y,
        team: t
      };
    });

    // Store node positions on canvas for click detection
    canvas._nodePositions = nodePositions;

    // 3. Draw Background Network Mesh (if showAllArcs enabled or subtle mesh)
    state.teams.forEach((t1, i) => {
      state.teams.forEach((t2, j) => {
        if (i >= j) return;
        const p1 = nodePositions[t1.name];
        const p2 = nodePositions[t2.name];
        const dist = lookup[t1.name]?.[t2.name] ?? 0;
        if (dist <= 0) return;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = state.showAllArcs
          ? 'rgba(148, 163, 184, 0.24)'
          : 'rgba(148, 163, 184, 0.06)';
        ctx.lineWidth = state.showAllArcs ? 1.1 : 0.7;
        ctx.stroke();
      });
    });

    // 4. Draw Highlighted Quadratic Bezier Route Arcs from Focus Origin Team
    const originNode = nodePositions[state.focusTeam] || nodePositions[state.teams[0].name];
    if (originNode) {
      state.teams.forEach(targetTeam => {
        if (targetTeam.name === originNode.team.name) return;
        const targetNode = nodePositions[targetTeam.name];
        const dist = lookup[originNode.team.name]?.[targetTeam.name] ?? 0;

        // Curve control point
        const midX = (originNode.x + targetNode.x) / 2;
        const midY = (originNode.y + targetNode.y) / 2;
        const dx = targetNode.x - originNode.x;
        const dy = targetNode.y - originNode.y;
        const ctrlX = midX - dy * 0.14;
        const ctrlY = midY + dx * 0.14;

        let arcColor = '#06B6D4'; // short (<60km)
        if (dist > 60 && dist <= 220) arcColor = '#F59E0B';
        else if (dist > 220) arcColor = '#F43F5E';
        else if (dist === 0) arcColor = '#10B981';

        // Outer glow
        ctx.beginPath();
        ctx.moveTo(originNode.x, originNode.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, targetNode.x, targetNode.y);
        ctx.strokeStyle = arcColor;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 4.5;
        ctx.stroke();

        // Main tactical arc
        ctx.beginPath();
        ctx.setLineDash([5, 3]);
        ctx.moveTo(originNode.x, originNode.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, targetNode.x, targetNode.y);
        ctx.strokeStyle = arcColor;
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = 1.9;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Distance label badge along arc
        if (state.showDistanceLabels) {
          const labelX = 0.25 * originNode.x + 0.5 * ctrlX + 0.25 * targetNode.x;
          const labelY = 0.25 * originNode.y + 0.5 * ctrlY + 0.25 * targetNode.y;
          const labelText = dist === 0 ? '0km(공유)' : `${dist.toFixed(1)}km`;

          ctx.font = '600 10px "JetBrains Mono", monospace';
          const tw = ctx.measureText(labelText).width;
          ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
          ctx.fillRect(labelX - tw / 2 - 4, labelY - 8, tw + 8, 15);
          ctx.strokeStyle = arcColor;
          ctx.lineWidth = 0.8;
          ctx.strokeRect(labelX - tw / 2 - 4, labelY - 8, tw + 8, 15);

          ctx.fillStyle = '#F8FAFC';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, labelX, labelY);
        }
      });
    }

    // 5. Draw 10 Stadium Nodes
    state.teams.forEach(t => {
      const node = nodePositions[t.name];
      const isFocus = t.name === state.focusTeam;
      const radius = isFocus ? 9.5 : 6.8;

      if (isFocus) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 17, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
        ctx.fill();
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isFocus ? '#10B981' : (t.color || '#06B6D4');
      ctx.fill();
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = isFocus ? 2.2 : 1.4;
      ctx.stroke();

      // Team name & stadium tag
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const label = `${t.name} (${t.stadium.replace('종합운동장', '').replace('챔피언스필드', '').replace('라이언즈파크', '').replace('이글스파크', '').replace('위즈파크', '')})`;
      const lx = node.x + 11;
      const ly = node.y;

      const m = ctx.measureText(label).width;
      ctx.fillStyle = isFocus ? 'rgba(16, 185, 129, 0.25)' : 'rgba(8, 12, 20, 0.82)';
      ctx.fillRect(lx - 3, ly - 8, m + 6, 16);
      ctx.fillStyle = isFocus ? '#6EE7B7' : '#E2E8F0';
      ctx.fillText(label, lx, ly);
    });

    ctx.restore();
  }

  function renderLeafletDarkMap(container) {
    if (!state.leafletMap) {
      state.leafletMap = window.L.map(container, {
        center: [36.35, 127.75],
        zoom: 7,
        zoomControl: true
      });
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO DarkMatter',
        subdomains: 'abcd',
        maxZoom: 18
      }).addTo(state.leafletMap);
      state.leafletLayerGroup = window.L.layerGroup().addTo(state.leafletMap);
    }

    setTimeout(() => {
      state.leafletMap.invalidateSize();
    }, 60);

    state.leafletLayerGroup.clearLayers();
    const lookup = Engine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const origin = state.teams.find(t => t.name === state.focusTeam) || state.teams[0];

    // Draw route lines from origin
    state.teams.forEach(target => {
      if (target.name === origin.name) return;
      const dist = lookup[origin.name]?.[target.name] ?? 0;
      const color = dist <= 60 ? '#06B6D4' : dist <= 220 ? '#F59E0B' : '#F43F5E';
      const line = window.L.polyline(
        [[origin.latitude, origin.longitude], [target.latitude, target.longitude]],
        { color, weight: 2.5, opacity: 0.85, dashArray: '6, 4' }
      );
      if (state.showDistanceLabels) {
        line.bindTooltip(`${origin.name}→${target.name}: ${dist}km`, { permanent: false, direction: 'center' });
      }
      line.addTo(state.leafletLayerGroup);
    });

    // Draw markers
    state.teams.forEach(t => {
      const isFocus = t.name === state.focusTeam;
      const latOffset = t.name === '두산' && t.sharedStadium ? 0.008 : (t.name === 'LG' && t.sharedStadium ? -0.008 : 0);
      const marker = window.L.circleMarker([t.latitude + latOffset, t.longitude], {
        radius: isFocus ? 10 : 7,
        fillColor: isFocus ? '#10B981' : '#06B6D4',
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 0.9
      });
      marker.bindTooltip(`<b>${t.name}</b> (${t.stadium})`, { permanent: true, direction: 'right', offset: [8, 0] });
      marker.on('click', () => {
        state.focusTeam = t.name;
        renderTeamRegistryTable();
        renderFocusTeamPills();
        renderActiveGisMap();
      });
      marker.addTo(state.leafletLayerGroup);
    });
  }

  function renderKakaoMapInstance(container) {
    container.innerHTML = '';
    const center = new window.kakao.maps.LatLng(36.35, 127.75);
    const map = new window.kakao.maps.Map(container, { center, level: 12 });
    const lookup = Engine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const origin = state.teams.find(t => t.name === state.focusTeam) || state.teams[0];

    state.teams.forEach(t => {
      const pos = new window.kakao.maps.LatLng(t.latitude, t.longitude);
      const marker = new window.kakao.maps.Marker({ map, position: pos, title: `${t.name} (${t.stadium})` });
      window.kakao.maps.event.addListener(marker, 'click', () => {
        state.focusTeam = t.name;
        renderGisModule();
      });
      if (t.name !== origin.name) {
        const dist = lookup[origin.name]?.[t.name] ?? 0;
        const poly = new window.kakao.maps.Polyline({
          path: [new window.kakao.maps.LatLng(origin.latitude, origin.longitude), pos],
          strokeWeight: 3,
          strokeColor: dist <= 60 ? '#06B6D4' : dist <= 220 ? '#F59E0B' : '#F43F5E',
          strokeOpacity: 0.85,
          strokeStyle: 'shortdash'
        });
        poly.setMap(map);
      }
    });
  }

  function renderNaverMapInstance(container) {
    container.innerHTML = '';
    const map = new window.naver.maps.Map(container, {
      center: new window.naver.maps.LatLng(36.35, 127.75),
      zoom: 7
    });
    const lookup = Engine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const origin = state.teams.find(t => t.name === state.focusTeam) || state.teams[0];

    state.teams.forEach(t => {
      const pos = new window.naver.maps.LatLng(t.latitude, t.longitude);
      const marker = new window.naver.maps.Marker({ position: pos, map, title: `${t.name} (${t.stadium})` });
      window.naver.maps.Event.addListener(marker, 'click', () => {
        state.focusTeam = t.name;
        renderGisModule();
      });
      if (t.name !== origin.name) {
        const dist = lookup[origin.name]?.[t.name] ?? 0;
        new window.naver.maps.Polyline({
          map,
          path: [new window.naver.maps.LatLng(origin.latitude, origin.longitude), pos],
          strokeColor: dist <= 60 ? '#06B6D4' : dist <= 220 ? '#F59E0B' : '#F43F5E',
          strokeWeight: 3,
          strokeOpacity: 0.85
        });
      }
    });
  }

  function openMapApiModal(statusMsg) {
    const backdrop = document.getElementById('mapApiModalBackdrop');
    const msgEl = document.getElementById('mapSdkStatusMsg');
    if (statusMsg && msgEl) msgEl.textContent = statusMsg;
    if (backdrop) backdrop.classList.remove('hidden');
  }

  // =========================================================================
  // 5. MODULE 02: SEASON CALENDAR, REST DAYS & SPECIAL EVENT RULE BUILDER
  // =========================================================================
  function renderCalendarModule() {
    renderRestDaysAndBlackouts();
    renderEventRulesManager();
    renderVisualSeasonCalendar();
    renderSlotDetailInspector();
    renderSlotRibbon();
  }

  function renderRestDaysAndBlackouts() {
    const toggleGroup = document.getElementById('restDayToggleGroup');
    if (toggleGroup) {
      toggleGroup.querySelectorAll('.dow-btn').forEach(btn => {
        const dow = Number(btn.getAttribute('data-dow'));
        const isRest = state.config.restDaysOfWeek.includes(dow);
        btn.classList.toggle('active', isRest);
        const dayLabels = ['일 (SUN)', '월 (MON)', '화 (TUE)', '수 (WED)', '목 (THU)', '금 (FRI)', '토 (SAT)'];
        btn.textContent = isRest ? `${dayLabels[dow]} ✓` : dayLabels[dow];
      });
    }

    const chipList = document.getElementById('blackoutChipList');
    if (chipList) {
      chipList.innerHTML = state.blackouts.map((b, idx) => `
        <span class="blackout-chip">
          <span>🚫 ${b.date} (${Engine.getDayOfWeekKo(b.date)}) — ${b.reason}</span>
          <button type="button" data-del-blackout="${idx}" title="삭제">✕</button>
        </span>
      `).join('');

      chipList.querySelectorAll('[data-del-blackout]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.getAttribute('data-del-blackout'));
          state.blackouts.splice(i, 1);
          renderCalendarModule();
        });
      });
    }
  }

  function renderEventRulesManager() {
    const container = document.getElementById('eventRulesContainer');
    if (!container) return;

    const teamNames = state.teams.map(t => t.name);
    const stadiumList = state.teams.map(t => ({ name: t.name, stadium: t.stadium }));

    container.innerHTML = state.eventRules.map((evt, evtIdx) => {
      const isMatchMode = evt.mode === 'match';
      const slotsHtml = evt.assignments.map((asg, slotIdx) => {
        const homeOptions = stadiumList.map(st => `
          <option value="${st.name}" ${st.name === asg.home ? 'selected' : ''}>
            ${st.stadium} (${st.name} 홈)
          </option>
        `).join('');

        const awayControl = isMatchMode
          ? `<select class="tactical-select compact evt-away-select" data-evt-idx="${evtIdx}" data-slot-idx="${slotIdx}" aria-label="원정 구단">
              ${teamNames.filter(n => n !== asg.home).map(n => `<option value="${n}" ${n === asg.away ? 'selected' : ''}>vs ${n} (원정 고정)</option>`).join('')}
             </select>`
          : `<div class="auto-opponent-badge" title="구장(홈팀)만 고정하고 원정 상대팀은 OptaPlanner 솔버가 자동 배정합니다.">
              ⚡ 상대팀 솔버 자동배정 (현재: ${asg.away || 'AUTO'})
             </div>`;

        return `
          <div class="event-slot-box">
            <div class="slot-box-head">
              <span>GAME #${slotIdx + 1}</span>
              <span>${isMatchMode ? '📌 대진고정' : '🏟️ 구장고정'}</span>
            </div>
            <select class="tactical-select compact evt-home-select" data-evt-idx="${evtIdx}" data-slot-idx="${slotIdx}" aria-label="홈 구장 및 구단">
              ${homeOptions}
            </select>
            ${awayControl}
          </div>
        `;
      }).join('');

      return `
        <div class="event-rule-card" data-event-id="${evt.id}">
          <div class="event-rule-header">
            <div class="event-title-group">
              <input type="date" class="tactical-input compact evt-date-input" data-evt-idx="${evtIdx}" value="${evt.date}" />
              <input type="text" class="tactical-input compact evt-title-input" data-evt-idx="${evtIdx}" value="${evt.title}" style="min-width:250px;font-weight:700;" />
              <span class="mod-badge cyan">${evt.consecutive}연전</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <div class="event-mode-switch" role="group" aria-label="이벤트 고정 방식 선택">
                <button type="button" class="evt-mode-btn mode-match ${isMatchMode ? 'active' : ''}"
                  data-evt-idx="${evtIdx}" data-set-mode="match">
                  구단 + 구장 지정 (대진 고정)
                </button>
                <button type="button" class="evt-mode-btn mode-stadium ${!isMatchMode ? 'active' : ''}"
                  data-evt-idx="${evtIdx}" data-set-mode="stadium">
                  구장만 지정 (상대팀 자동배정)
                </button>
              </div>
              ${evtIdx >= 2 ? `<button type="button" class="btn-chip reset" data-del-evt="${evtIdx}" title="이벤트 규칙 삭제">삭제</button>` : ''}
            </div>
          </div>
          <div class="event-slots-grid">
            ${slotsHtml}
          </div>
        </div>
      `;
    }).join('');

    // Mode switch handlers (Matchup Pin vs Stadium-Only Host Pin)
    container.querySelectorAll('[data-set-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-evt-idx'));
        const newMode = btn.getAttribute('data-set-mode');
        state.eventRules[idx].mode = newMode;
        renderEventRulesManager();
        renderPreflightAndSolverModule();
        setTickerMessage(`[이벤트 룰 모드 전환] '${state.eventRules[idx].title}' → ${newMode === 'match' ? '구단+구장 지정 (대진 고정)' : '구장만 지정 (홈구장 고정, 상대팀 자동배정)'}`);
      });
    });

    // Date & Title edit
    container.querySelectorAll('.evt-date-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.getAttribute('data-evt-idx'));
        state.eventRules[idx].date = inp.value;
        if (state.eventRules[idx].id === 'evt-opening') state.config.matchStartDate = inp.value;
        if (state.eventRules[idx].id === 'evt-childrenday') state.config.childrenDayStart = inp.value;
        recomputeEvaluations();
        renderCalendarModule();
      });
    });

    container.querySelectorAll('.evt-title-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.getAttribute('data-evt-idx'));
        state.eventRules[idx].title = inp.value;
      });
    });

    // Home / Stadium select change
    container.querySelectorAll('.evt-home-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const evtIdx = Number(sel.getAttribute('data-evt-idx'));
        const slotIdx = Number(sel.getAttribute('data-slot-idx'));
        const homeName = sel.value;
        const teamObj = state.teams.find(t => t.name === homeName);
        state.eventRules[evtIdx].assignments[slotIdx].home = homeName;
        state.eventRules[evtIdx].assignments[slotIdx].stadium = teamObj ? teamObj.stadium : homeName;
        if (state.eventRules[evtIdx].id === 'evt-childrenday') {
          const chHomes = new Set(state.eventRules[evtIdx].assignments.map(a => a.home));
          state.teams.forEach(t => { t.childrenDayHome = chHomes.has(t.name); });
          renderTeamRegistryTable();
        }
        recomputeEvaluations();
        renderEventRulesManager();
        renderPreflightAndSolverModule();
        renderAnalyticsModule();
      });
    });

    // Away select change
    container.querySelectorAll('.evt-away-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const evtIdx = Number(sel.getAttribute('data-evt-idx'));
        const slotIdx = Number(sel.getAttribute('data-slot-idx'));
        state.eventRules[evtIdx].assignments[slotIdx].away = sel.value;
        renderPreflightAndSolverModule();
      });
    });

    // Delete custom event
    container.querySelectorAll('[data-del-evt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-del-evt'));
        state.eventRules.splice(idx, 1);
        renderEventRulesManager();
        renderPreflightAndSolverModule();
      });
    });
  }

  function applyEventRulesToActivePlan() {
    const plan = getActivePlanArray();
    state.eventRules.forEach(evt => {
      if (evt.id === 'evt-childrenday') {
        const chHomes = new Set(evt.assignments.map(a => a.home));
        state.teams.forEach(t => { t.childrenDayHome = chHomes.has(t.name); });
      }
      const dateMatches = plan.filter(m => String(m.datetime).slice(0, 10) === evt.date);
      if (dateMatches.length === 5) {
        if (evt.mode === 'match') {
          evt.assignments.forEach((asg, i) => {
            dateMatches[i].home = asg.home;
            dateMatches[i].away = asg.away;
            dateMatches[i].pinned = true;
          });
        } else {
          // Stadium-only host pin: ensure the 5 specified home teams are hosts on that date
          const usedAways = dateMatches.map(m => m.away);
          const homeSet = new Set(evt.assignments.map(a => a.home));
          const remainingAways = state.teams.map(t => t.name).filter(n => !homeSet.has(n));
          evt.assignments.forEach((asg, i) => {
            dateMatches[i].home = asg.home;
            dateMatches[i].away = remainingAways[i] || usedAways[i] || asg.away;
            dateMatches[i].pinned = true;
          });
        }
      }
    });

    recomputeEvaluations();
    renderGisModule();
    renderCalendarModule();
    renderPreflightAndSolverModule();
    renderAnalyticsModule();
    setTickerMessage(`[이벤트·휴일 규칙 적용 완료] 개막전·어린이날 및 지정 이벤트 규칙으로 스케줄 재검증 완료: ${state.evalCache.active.score.formatted}`);
  }

  function renderVisualSeasonCalendar() {
    const container = document.getElementById('visualCalendarContainer');
    if (!container) return;

    const ev = state.evalCache.active;
    const slotMap = {};
    ev.slotSummaries.forEach((s, idx) => {
      slotMap[s.date] = { ...s, slotNum: idx + 1 };
    });

    // Build map of every individual game day covered by a series (e.g. Tue, Wed, Thu for a 3-game series)
    const coveredDayMap = {};
    ev.slotSummaries.forEach((s, idx) => {
      const startObj = Engine.parseDateStr(s.date);
      for (let d = 0; d < s.consecutive; d++) {
        const cur = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate() + d);
        const dStr = Engine.formatDateStr(cur);
        coveredDayMap[dStr] = {
          slotDate: s.date,
          slotNum: idx + 1,
          dayOffset: d + 1,
          consecutive: s.consecutive,
          weekend: s.weekend,
          holiday: s.holiday,
          hasViolation: s.violations && s.violations.length > 0
        };
      }
    });

    const blackoutSet = new Set(state.blackouts.map(b => b.date));
    const eventDateMap = {};
    state.eventRules.forEach(e => { eventDateMap[e.date] = e; });

    const months = ['03', '04', '05', '06', '07', '08'].filter(m =>
      state.selectedCalendarMonth === 'ALL' || state.selectedCalendarMonth === m
    );

    const dowHeaders = ['일', '월', '화', '수', '목', '금', '토']
      .map(d => `<div class="cal-dow-hdr">${d}</div>`).join('');

    container.innerHTML = months.map(mStr => {
      const mNum = Number(mStr);
      const firstDay = new Date(2025, mNum - 1, 1);
      const daysInMonth = new Date(2025, mNum, 0).getDate();
      const startDow = firstDay.getDay();

      const cells = [];
      for (let i = 0; i < startDow; i++) {
        cells.push('<div class="cal-day-cell empty"></div>');
      }

      let seriesCountInMonth = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `2025-${mStr}-${String(day).padStart(2, '0')}`;
        const dow = new Date(2025, mNum - 1, day).getDay();
        const inSeason = dStr >= state.config.matchStartDate && dStr <= state.config.matchEndDate;
        const isAllStar = dStr >= state.config.allStarStartDate && dStr <= state.config.allStarEndDate;
        const isRestDow = state.config.restDaysOfWeek.includes(dow) && dStr !== state.config.childrenDayStart;
        const cov = coveredDayMap[dStr];
        const slot = slotMap[dStr];
        if (slot) seriesCountInMonth++;

        let cls = 'cal-day-cell';
        let tag = '';

        if (cov) {
          if (cov.hasViolation) {
            cls += ' has-violation';
            tag = `⚠ S${String(cov.slotNum).padStart(2, '0')} 위반`;
          } else if (eventDateMap[cov.slotDate] || cov.slotDate === state.config.childrenDayStart || cov.slotDate === state.config.matchStartDate) {
            cls += ' is-special-event';
            tag = slot ? `★S${String(cov.slotNum).padStart(2, '0')}(${cov.consecutive}연)` : `★G${cov.dayOffset}`;
          } else if (cov.weekend > 0 || cov.holiday > 0) {
            cls += ' is-weekend-series';
            tag = slot ? `S${String(cov.slotNum).padStart(2, '0')} 주말` : `G${cov.dayOffset}(휴)`;
          } else {
            cls += ' is-weekday-series';
            tag = slot ? `S${String(cov.slotNum).padStart(2, '0')} 주중` : `G${cov.dayOffset}`;
          }
        } else if (isAllStar || blackoutSet.has(dStr)) {
          cls += ' is-allstar';
          tag = 'ALL-STAR';
        } else if (inSeason && isRestDow) {
          cls += ' is-rest-day';
          tag = 'REST(휴)';
        }

        if (cov && cov.slotDate === state.selectedSlotDate) {
          cls += ' selected-date';
        }

        const targetSlotDate = cov ? cov.slotDate : dStr;
        cells.push(`
          <div class="${cls}" data-cal-slot="${targetSlotDate}" title="${dStr} (${Engine.getDayOfWeekKo(dStr)})">
            <span class="day-num">${day}</span>
            <span class="day-tag">${tag}</span>
          </div>
        `);
      }

      return `
        <div class="month-cal-card">
          <div class="month-cal-title">
            <span>2025.${mStr} MONTH</span>
            <span>${seriesCountInMonth} SERIES SLOTS</span>
          </div>
          <div class="month-cal-grid">
            ${dowHeaders}
            ${cells.join('')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-cal-slot]').forEach(cell => {
      cell.addEventListener('click', () => {
        const dt = cell.getAttribute('data-cal-slot');
        const hasSlot = state.evalCache.active.slotSummaries.some(s => s.date === dt);
        if (hasSlot) {
          state.selectedSlotDate = dt;
          renderVisualSeasonCalendar();
          renderSlotDetailInspector();
          renderSlotRibbon();
        }
      });
    });
  }

  function renderSlotDetailInspector() {
    const box = document.getElementById('slotDetailInspector');
    if (!box) return;
    const ev = state.evalCache.active;
    const idx = ev.slotSummaries.findIndex(s => s.date === state.selectedSlotDate);
    const slot = idx !== -1 ? ev.slotSummaries[idx] : ev.slotSummaries[0];
    if (!slot) return;

    const slotNum = (idx !== -1 ? idx : 0) + 1;
    const evtRule = state.eventRules.find(e => e.date === slot.date);
    const hasViol = slot.violations && slot.violations.length > 0;

    const matchCards = slot.matches.map((m, i) => {
      const homeTeam = state.teams.find(t => t.name === m.home);
      const stName = homeTeam ? homeTeam.stadium : m.home;
      return `
        <div class="insp-match-card">
          <div style="display:flex;justify-content:space-between;color:var(--text-muted);font-family:var(--font-mono);font-size:9.5px;">
            <span>MATCH #${i + 1}</span>
            <span>${slot.consecutive}연전</span>
          </div>
          <div style="font-weight:800;font-size:12px;color:var(--text-primary);">
            ${m.away} <span style="color:var(--neon-cyan);">@</span> ${m.home}
          </div>
          <div style="font-size:10px;color:var(--text-secondary);">🏟️ ${stName}</div>
        </div>
      `;
    }).join('');

    box.innerHTML = `
      <div class="inspector-top">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="panel-code">SLOT S${String(slotNum).padStart(2, '0')} / 45</span>
          <strong style="font-size:13px;">${slot.date} (${slot.dow}요일 시작 · ${slot.consecutive}연전)</strong>
          <span class="mod-badge ${slot.holiday > 0 ? 'emerald' : ''}">주말:${slot.weekend} / 휴일점수:+${slot.holiday}pt</span>
          ${evtRule ? `<span class="mode-badge ${evtRule.mode === 'match' ? 'match-pin' : 'stadium-pin'}">📌 ${evtRule.title} (${evtRule.mode === 'match' ? '대진고정' : '구장고정'})</span>` : ''}
        </div>
        <span class="hc-badge" style="${hasViol ? 'background:var(--neon-crimson-dim);color:var(--neon-crimson);' : ''}">
          ${hasViol ? `⚠ HARD 위반 ${slot.violations.length}건` : '✓ 5경기 10구단 무결성 PASS'}
        </span>
      </div>
      ${hasViol ? `<div class="hc-violation-list">${slot.violations.map(v => `<div>• ${v}</div>`).join('')}</div>` : ''}
      <div class="inspector-matches-row">
        ${matchCards}
      </div>
    `;
  }

  function renderSlotRibbon() {
    const track = document.getElementById('slotRibbonTrack');
    if (!track) return;
    const ev = state.evalCache.active;

    track.innerHTML = ev.slotSummaries.map((s, i) => {
      let cls = 'ribbon-slot';
      if (s.violations && s.violations.length > 0) cls += ' violation';
      else if (s.isOpeningDay || s.isChildrenDay || s.consecutive === 4) cls += ' special';
      else if (s.weekend > 0 || s.holiday > 0) cls += ' weekend';
      if (s.date === state.selectedSlotDate) cls += ' active';

      return `
        <div class="${cls}" data-ribbon-date="${s.date}" title="S${i + 1}: ${s.date}(${s.dow}) ${s.consecutive}연전 / 휴일+${s.holiday}">
          <strong>S${String(i + 1).padStart(2, '0')}</strong>
          <span>${s.date.slice(5)}</span>
          <span style="color:var(--neon-cyan);">${s.consecutive}G</span>
        </div>
      `;
    }).join('');

    track.querySelectorAll('[data-ribbon-date]').forEach(el => {
      el.addEventListener('click', () => {
        state.selectedSlotDate = el.getAttribute('data-ribbon-date');
        renderVisualSeasonCalendar();
        renderSlotDetailInspector();
        renderSlotRibbon();
      });
    });
  }

  // =========================================================================
  // 6. MODULE 03: PRE-FLIGHT DIAGNOSTICS & REAL-TIME SOLVER CONSOLE
  // =========================================================================
  function renderPreflightAndSolverModule() {
    renderPreflightChecklist();
    renderJsonPayloadViewer();
    if (!state.solverRunning) {
      drawSolverConvergenceChart();
    }
  }

  function renderPreflightChecklist() {
    const box = document.getElementById('preflightChecklist');
    const overallBadge = document.getElementById('preflightOverallBadge');
    if (!box) return;

    const validCoords = state.teams.every(t => t.latitude >= 33 && t.latitude <= 39 && t.longitude >= 125 && t.longitude <= 131);
    const sharedCount = state.teams.filter(t => t.sharedStadium).length;
    const matrixCount = state.distanceMatrix.length;
    const totalSeries = getActivePlanArray().length;
    const chHomeCount = state.teams.filter(t => t.childrenDayHome).length;

    const checks = [
      {
        title: '1. GIS 10개 구단 & 구장 위·경도 좌표계',
        sub: `유효 좌표 ${state.teams.length}/10구단 · 공동구장(잠실) ${sharedCount}구단`,
        ok: validCoords
      },
      {
        title: '2. 10×10 구장 간 도로 이동거리 행렬',
        sub: `총 ${matrixCount}/100 셀 로드 완료 (0.0km ~ 407.2km)`,
        ok: matrixCount === 100
      },
      {
        title: '3. 시즌 마스터 캘린더 & 정기 휴무일',
        sub: `${state.config.matchStartDate} ~ ${state.config.matchEndDate} (${state.calendar.length}슬롯 · ${totalSeries}시리즈)`,
        ok: state.calendar.length === 45
      },
      {
        title: '4. 특정 이벤트 Pinning & 어린이날 의무 홈',
        sub: `이벤트 규칙 ${state.eventRules.length}건 · 어린이날 홈 의무 ${chHomeCount}/5구단`,
        ok: chHomeCount === 5
      },
      {
        title: '5. Soft 제약 Tolerance 파라미터',
        sub: `거리 ±${state.config.toleranceTotalDistance}km · 휴일 ±${state.config.toleranceHoliday} · 이동 ±${state.config.toleranceTotalMove}`,
        ok: true
      },
      {
        title: '6. OptaPlanner BendableScore 계산기',
        sub: `Hard 2레벨 / Soft 5레벨 실시간 준비 완료`,
        ok: true
      }
    ];

    const allOk = checks.every(c => c.ok);
    if (overallBadge) {
      overallBadge.textContent = allOk ? 'ALL 6 SYSTEMS GO' : 'CHECK WARNING';
      overallBadge.className = `panel-sub-badge ${allOk ? 'emerald' : 'c-amber'}`;
    }

    box.innerHTML = checks.map(c => `
      <div class="preflight-item ${c.ok ? '' : 'warn'}">
        <div class="pf-left">
          <span class="pf-title">${c.title}</span>
          <span class="pf-sub">${c.sub}</span>
        </div>
        <span class="pf-status">${c.ok ? 'READY' : 'WARN'}</span>
      </div>
    `).join('');
  }

  function buildCurrentJsonPayload() {
    return {
      metadata: {
        season: 2025,
        engine: 'OptaPlanner 8.x BendableScore (2 Hard / 5 Soft)',
        activeDataset: state.activePlanMode,
        currentScore: state.evalCache.active?.score.formatted
      },
      solverConfig: state.config,
      pinnedEvents: state.eventRules,
      blackouts: state.blackouts,
      teams: state.teams,
      distanceMatrix: state.distanceMatrix,
      calendar: state.calendar
    };
  }

  function renderJsonPayloadViewer() {
    const viewer = document.getElementById('jsonPayloadViewer');
    if (!viewer) return;
    const full = buildCurrentJsonPayload();

    let target = full;
    if (state.activeJsonTab === 'summary') {
      target = {
        metadata: full.metadata,
        solverConfig: full.solverConfig,
        pinnedEventsCount: full.pinnedEvents.length,
        pinnedEventsPreview: full.pinnedEvents.map(e => ({
          date: e.date,
          title: e.title,
          mode: e.mode === 'match' ? 'TEAM_AND_STADIUM_PIN' : 'STADIUM_ONLY_HOST_PIN',
          games: e.assignments.length
        })),
        teamsCount: full.teams.length,
        distanceMatrixCells: full.distanceMatrix.length,
        calendarSlots: full.calendar.length
      };
    } else if (state.activeJsonTab === 'teams') {
      target = full.teams;
    } else if (state.activeJsonTab === 'distanceMatrix') {
      target = full.distanceMatrix.slice(0, 25);
    } else if (state.activeJsonTab === 'calendar') {
      target = full.calendar;
    } else if (state.activeJsonTab === 'events') {
      target = full.pinnedEvents;
    }

    viewer.textContent = JSON.stringify(target, null, 2);
  }

  function initDefaultConvergenceHistory() {
    const initEv = state.evalCache.initial;
    const solvedEv = state.evalCache.solved;
    const initS2 = Math.abs(initEv.score.soft[2]);
    const initKm = Math.abs(initEv.score.soft[4]);
    const solvedKm = Math.abs(solvedEv.score.soft[4]);

    state.convergenceHistory = [
      { step: 0, phase: 'INIT', hard: 18, s2: initS2 * 1.4, km: initKm + 1420 },
      { step: 1, phase: 'CH', hard: 9, s2: initS2 * 1.15, km: initKm + 680 },
      { step: 2, phase: 'CH', hard: 4, s2: initS2, km: initKm },
      { step: 3, phase: 'TABU', hard: 2, s2: 412000, km: 72810 },
      { step: 4, phase: 'TABU', hard: 0, s2: 268400, km: 72640 },
      { step: 5, phase: 'TABU', hard: 0, s2: 142900, km: 72490 },
      { step: 6, phase: 'TABU', hard: 0, s2: 64200, km: 72310 },
      { step: 7, phase: 'LA', hard: 0, s2: 19800, km: 72195 },
      { step: 8, phase: 'LA', hard: 0, s2: 4200, km: 72120 },
      { step: 9, phase: 'LA', hard: 0, s2: 620, km: 72088 },
      { step: 10, phase: 'OPTIMAL', hard: 0, s2: 0, km: solvedKm }
    ];
  }

  function appendSolverLog(level, phase, msg) {
    const out = document.getElementById('solverTerminalOutput');
    if (!out) return;
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const div = document.createElement('div');
    div.className = `log-line ${level}`;
    div.innerHTML = `<span class="ts">[${ts}]</span><span class="lvl">[${phase}]</span> ${msg}`;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  }

  function runSolverSimulation() {
    if (state.solverRunning) return;
    state.solverRunning = true;

    const speedMult = parseFloat(document.getElementById('solverSimSpeed')?.value || '1');
    const stepDelay = speedMult >= 10 ? 25 : Math.round(380 / speedMult);

    const out = document.getElementById('solverTerminalOutput');
    if (out) out.innerHTML = '';

    initDefaultConvergenceHistory();
    const fullSteps = state.convergenceHistory.slice();
    state.convergenceHistory = [fullSteps[0]];

    const headerState = document.getElementById('headerSolverState');
    const phaseBadge = document.getElementById('solverPhaseBadge');

    appendSolverLog('info', 'SOLVER-START', `Solving started: time spent (0 ms), 10 teams, 45 slots, 225 series entities, 100 distance pairs.`);

    let idx = 0;
    state.solverTimer = setInterval(() => {
      idx++;
      if (idx >= fullSteps.length) {
        clearInterval(state.solverTimer);
        state.solverRunning = false;
        state.activePlanMode = 'solved';
        recomputeEvaluations();
        renderCalendarModule();
        renderPreflightAndSolverModule();
        renderAnalyticsModule();

        if (phaseBadge) phaseBadge.textContent = 'PHASE: CONVERGED [OPTIMAL FEASIBLE]';
        document.querySelectorAll('#solverPhaseStepper .phase-step').forEach(el => {
          el.classList.remove('active');
          el.classList.add('completed');
        });
        appendSolverLog('best', 'SOLVER-DONE', `Solving ended: score (${state.evalCache.solved.score.formatted}), 9/10 teams within ±${state.config.toleranceTotalDistance}km tolerance.`);
        setTickerMessage(`OptaPlanner 엔진 최적화 완료! 최종 BendableScore: ${state.evalCache.solved.score.formatted}`);
        return;
      }

      const pt = fullSteps[idx];
      state.convergenceHistory.push(pt);
      drawSolverConvergenceChart();

      // Update stepper UI
      const phaseMap = { INIT: 'init', CH: 'ch', TABU: 'tabu', LA: 'la', OPTIMAL: 'la' };
      const activePhaseKey = phaseMap[pt.phase] || 'la';
      document.querySelectorAll('#solverPhaseStepper .phase-step').forEach(el => {
        const key = el.getAttribute('data-phase');
        el.classList.toggle('active', key === activePhaseKey);
      });

      if (headerState) {
        headerState.textContent = `SOLVING [${pt.phase} STEP ${idx * 140}]`;
        headerState.className = 'kpi-mini-val cyan';
      }
      if (phaseBadge) {
        phaseBadge.textContent = `PHASE: ${pt.phase} IN PROGRESS (${idx * 10}%)`;
      }

      // Update KPIs
      const elTime = document.getElementById('simElapsedTime');
      const elSpeed = document.getElementById('simMoveSpeed');
      const elMoves = document.getElementById('simTotalMoves');
      const elUpdates = document.getElementById('simBestUpdates');

      if (elTime) elTime.textContent = `00:0${(idx * 0.45).toFixed(2)}`;
      if (elSpeed) elSpeed.textContent = `${(14800 + idx * 135).toLocaleString()} /sec`;
      if (elMoves) elMoves.textContent = `${(idx * 6939).toLocaleString()}`;
      if (elUpdates) elUpdates.textContent = `${idx * 3} hits`;

      appendSolverLog(
        pt.hard === 0 ? 'best' : 'warn',
        pt.phase,
        `Step (${idx * 140}), hardViolations (${pt.hard}), distanceVariancePenalty (-${Math.round(pt.s2).toLocaleString()}), totalKm (${pt.km.toLocaleString()}km)`
      );
    }, stepDelay);
  }

  function drawSolverConvergenceChart() {
    const canvas = document.getElementById('solverConvergenceCanvas');
    if (!canvas) return;
    if (state.convergenceHistory.length === 0) initDefaultConvergenceHistory();

    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(460, (rect.width || 720) - 16);
    const H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const padL = 54;
    const padR = 54;
    const padT = 20;
    const padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
    }

    const pts = state.convergenceHistory;
    const maxS2 = 850000;
    const maxHard = 20;

    // Draw Hard Violation Curve (Crimson)
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = padL + (i / 10) * plotW;
      const y = padT + plotH - (Math.min(maxHard, p.hard) / maxHard) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Draw Soft S2 Distance Variance Penalty Curve (Cyan)
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = padL + (i / 10) * plotW;
      const y = padT + plotH - (Math.min(maxS2, p.s2) / maxS2) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Points & Feasibility Milestone Marker
    pts.forEach((p, i) => {
      const x = padL + (i / 10) * plotW;
      const yS2 = padT + plotH - (Math.min(maxS2, p.s2) / maxS2) * plotH;
      ctx.beginPath();
      ctx.arc(x, yS2, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = p.s2 === 0 ? '#10B981' : '#06B6D4';
      ctx.fill();

      if (i === 4 && p.hard === 0) {
        const yH = padT + plotH;
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fillRect(x - 42, yH - 22, 84, 16);
        ctx.fillStyle = '#10B981';
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FEASIBLE (H=0)', x, yH - 11);
      }
    });

    // Axis labels
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Penalty Max', padL - 6, padT + 6);
    ctx.fillText('0 (Optimal)', padL - 6, padT + plotH);

    ctx.textAlign = 'center';
    ['INIT', 'CH', 'TABU-1', 'TABU-2', 'FEASIBLE', 'LA-1', 'LA-2', 'OPTIMAL'].forEach((lbl, idx) => {
      const x = padL + (idx / 7) * plotW;
      ctx.fillText(lbl, x, H - 8);
    });

    ctx.restore();
  }

  // =========================================================================
  // 7. MODULE 04: HARD CONSTRAINT VERIFICATION, SOFT MATRIX & 5 CHARTS
  // =========================================================================
  function renderAnalyticsModule() {
    renderHardVerificationBoard();
    renderSoftComparisonTable();
    drawChart1DistanceTolerance();
    drawChart2MoveDecomposition();
    drawChart3HolidayFairness();
    drawChart4TeamRadar();
    drawChart5SeasonHeatmap();
    renderTrajectoryReplayer();
  }

  function renderHardVerificationBoard() {
    const grid = document.getElementById('hardCardsGrid');
    const summaryPill = document.getElementById('hardBoardSummaryPill');
    const repairBtn = document.getElementById('btnAutoRepairViolations');
    if (!grid) return;

    const ev = state.evalCache.active;
    const totalV = ev.score.totalHardViolations;

    if (summaryPill) {
      summaryPill.textContent = totalV === 0
        ? '✓ 전체 6개 핵심 Hard 제약 조건 PASS (위반 0건 · Feasible)'
        : `⚠ Hard 제약 위반 총 ${totalV}건 감지 (${ev.score.hard[0]} H0 / ${ev.score.hard[1]} H1)`;
      summaryPill.classList.toggle('has-viol', totalV > 0);
    }

    if (repairBtn) {
      repairBtn.classList.toggle('hidden', totalV === 0);
    }

    const codeLabels = {
      TEAM_SLOT: 'HARD-0 // 10 TEAMS 5 GAMES PER SLOT',
      STADIUM_DUP: 'HARD-0 // SHARED STADIUM COLLISION GUARD',
      CONSECUTIVE_MATCH: 'HARD-0 // SERIES LENGTH ALIGNMENT',
      SPECIAL_EVENT_REST: 'HARD-0 // OPENING · CHILDREN DAY · REST · ALL-STAR',
      HOME_AWAY_STREAK: 'HARD-0 // MAX CONSECUTIVE HOME/AWAY STREAK',
      SUCCESSIVE_MATCHUP: 'HARD-1 // NO BACK-TO-BACK OPPONENT REPEAT'
    };

    grid.innerHTML = ev.hardChecks.map(hc => {
      const violHtml = !hc.passed && hc.violations.length > 0
        ? `<div class="hc-violation-list">
            ${hc.violations.slice(0, 4).map(v => `<div>🚨 ${v.desc}</div>`).join('')}
           </div>`
        : '';

      return `
        <div class="hard-card ${hc.passed ? '' : 'violated'}">
          <div class="hc-top">
            <span class="hc-code">${codeLabels[hc.id] || hc.id}</span>
            <span class="hc-badge">${hc.passed ? '● PASS (0건)' : `▲ VIOLATION (${hc.violationCount}건)`}</span>
          </div>
          <div class="hc-title">${hc.title}</div>
          <div class="hc-desc">${hc.desc}</div>
          ${violHtml}
        </div>
      `;
    }).join('');
  }

  function renderSoftComparisonTable() {
    const tbody = document.getElementById('softComparisonTbody');
    const tfoot = document.getElementById('softComparisonTfoot');
    const meta = document.getElementById('softMatrixMetaSummary');
    if (!tbody || !tfoot) return;

    const ev = state.evalCache.active;
    const initEv = state.evalCache.initial;
    const initMap = {};
    initEv.teamAnalytics.forEach(a => { initMap[a.team] = a; });

    const list = ev.teamAnalytics.slice();
    const key = state.softSortKey;
    const dir = state.softSortAsc ? 1 : -1;

    list.sort((a, b) => {
      if (key === 'team') return a.team.localeCompare(b.team, 'ko') * dir;
      if (key === 'maxStreaks') return ((a.maxHomeStreak + a.maxAwayStreak) - (b.maxHomeStreak + b.maxAwayStreak)) * dir;
      return ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * dir;
    });

    if (meta) {
      meta.innerHTML = `
        <span class="mod-badge emerald">평균 이동거리: ${ev.leagueSummary.meanDistance.toLocaleString()}km</span>
        <span class="mod-badge cyan">최대-최소 격차: ${ev.leagueSummary.maxDistanceSpread.toLocaleString()}km</span>
        <span class="mod-badge">평균 이동횟수: ${ev.leagueSummary.meanMoveCount}회</span>
      `;
    }

    tbody.innerHTML = list.map(item => {
      const initItem = initMap[item.team] || item;
      const deltaKm = Number((item.totalDistance - initItem.totalDistance).toFixed(1));
      const deltaStr = deltaKm === 0
        ? '<span style="color:var(--text-muted);">0.0 km</span>'
        : deltaKm < 0
          ? `<span class="c-emerald">${deltaKm.toFixed(1)} km ▼</span>`
          : `<span class="c-amber">+${deltaKm.toFixed(1)} km ▲</span>`;

      const distSign = item.distanceDiffFromMean > 0 ? `+${item.distanceDiffFromMean}` : `${item.distanceDiffFromMean}`;
      const holSign = item.holidayDiffFromMean > 0 ? `+${item.holidayDiffFromMean}` : `${item.holidayDiffFromMean}`;
      const isSelected = state.replayTeam === item.team;

      return `
        <tr class="${isSelected ? 'selected-row' : ''}" data-soft-team="${item.team}" style="cursor:pointer;" title="클릭하여 ${item.team} 레이더 차트 및 시즌 이동 궤적 리플레이 연동">
          <td style="font-family:var(--font-sans);">
            <div class="team-badge-cell">
              <span class="team-color-bar" style="background:${item.color}"></span>
              <strong>${item.team}</strong>
              <span style="color:var(--text-muted);font-size:10.5px;">(${item.stadium.slice(0, 4)})</span>
            </div>
          </td>
          <td>
            <strong>${item.totalMoveCount}회</strong>
            <span style="color:var(--text-muted);font-size:10px;">(${item.moveDiffFromMean > 0 ? '+' : ''}${item.moveDiffFromMean})</span>
          </td>
          <td class="c-amber">${item.weekdayMoveCount}회</td>
          <td class="c-cyan">${item.weekendMoveCount}회</td>
          <td><strong>${item.totalDistance.toLocaleString()} km</strong></td>
          <td>
            <span class="tol-pill ${item.withinDistanceTolerance ? 'in-band' : 'out-band'}">
              ${distSign} km (${item.withinDistanceTolerance ? 'IN-BAND' : 'OUT'})
            </span>
          </td>
          <td>${item.weekdayDistance.toLocaleString()} km</td>
          <td>${item.weekendHomeGames}경기 (${item.weekendHomeSeries}시리즈)</td>
          <td>${item.holidayHomeGames}경기</td>
          <td>
            <strong>${item.holidayScore}pt</strong>
            <span class="tol-pill ${item.withinHolidayTolerance ? 'in-band' : 'out-band'}">${holSign}</span>
          </td>
          <td>
            홈 ${item.maxHomeStreak}연속 / 원정 ${item.maxAwayStreak}연속
          </td>
          <td>${deltaStr}</td>
        </tr>
      `;
    }).join('');

    const sum = ev.leagueSummary;
    tfoot.innerHTML = `
      <tr>
        <td>LEAGUE SUMMARY (10구단 평균/합계)</td>
        <td>평균 ${sum.meanMoveCount}회 (${sum.minMoveCount}~${sum.maxMoveCount})</td>
        <td>평균 ${(list.reduce((a, x) => a + x.weekdayMoveCount, 0) / 10).toFixed(1)}회</td>
        <td>평균 ${(list.reduce((a, x) => a + x.weekendMoveCount, 0) / 10).toFixed(1)}회</td>
        <td>총 ${sum.totalDistance.toLocaleString()} km (평균 ${sum.meanDistance.toLocaleString()} km)</td>
        <td>허용내 ${sum.teamsWithinDistanceTolerance}/10구단 (격차 ${sum.maxDistanceSpread}km)</td>
        <td>평균 ${(list.reduce((a, x) => a + x.weekdayDistance, 0) / 10).toFixed(1)} km</td>
        <td>평균 ${(list.reduce((a, x) => a + x.weekendHomeGames, 0) / 10).toFixed(1)}경기</td>
        <td>평균 ${(list.reduce((a, x) => a + x.holidayHomeGames, 0) / 10).toFixed(1)}경기</td>
        <td>평균 ${sum.meanHolidayScore}pt</td>
        <td>최대 ${state.config.maxConsecutiveHomeAway}연속 제한</td>
        <td>최적화 편차 수렴</td>
      </tr>
    `;

    tbody.querySelectorAll('[data-soft-team]').forEach(tr => {
      tr.addEventListener('click', () => {
        const tName = tr.getAttribute('data-soft-team');
        state.replayTeam = tName;
        state.radarPrimary = tName;
        const radSel = document.getElementById('radarPrimaryTeam');
        if (radSel) radSel.value = tName;
        renderSoftComparisonTable();
        drawChart4TeamRadar();
        drawChart5SeasonHeatmap();
        renderTrajectoryReplayer();
      });
    });
  }

  // -------------------------------------------------------------------------
  // CHART 1: Total Travel Distance Deviation & ±300km Tolerance Zone
  // -------------------------------------------------------------------------
  function drawChart1DistanceTolerance() {
    const canvas = document.getElementById('chartDistanceTolerance');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(460, (rect.width || 640) - 12);
    const H = 300;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const ev = state.evalCache.active;
    const initEv = state.evalCache.initial;
    const initMap = {};
    initEv.teamAnalytics.forEach(a => { initMap[a.team] = a; });

    const items = ev.teamAnalytics;
    const meanKm = ev.leagueSummary.meanDistance;
    const tolKm = state.config.toleranceTotalDistance;

    const minAxis = 5500;
    const maxAxis = 9000;
    const padL = 56;
    const padR = 24;
    const padT = 26;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const yForKm = (km) => padT + plotH - ((Math.max(minAxis, Math.min(maxAxis, km)) - minAxis) / (maxAxis - minAxis)) * plotH;

    // 1. Draw ±Tolerance Emerald Zone Band
    const yTolTop = yForKm(meanKm + tolKm);
    const yTolBot = yForKm(meanKm - tolKm);
    const yMean = yForKm(meanKm);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.13)';
    ctx.fillRect(padL, yTolTop, plotW, Math.max(2, yTolBot - yTolTop));

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yTolTop);
    ctx.lineTo(W - padR, yTolTop);
    ctx.moveTo(padL, yTolBot);
    ctx.lineTo(W - padR, yTolBot);
    ctx.stroke();

    // League Mean Line
    ctx.setLineDash([]);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(padL, yMean);
    ctx.lineTo(W - padR, yMean);
    ctx.stroke();

    // Horizontal Y grid
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'right';
    [6000, 6500, 7000, 7500, 8000, 8500].forEach(val => {
      const y = yForKm(val);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(`${val.toLocaleString()}`, padL - 6, y + 3);
    });

    // 2. Draw Bars for 10 Teams (Initial Ghost Bar + Active Plan Solid Bar)
    const slotW = plotW / items.length;
    items.forEach((item, i) => {
      const cx = padL + slotW * i + slotW / 2;
      const barW = Math.min(22, slotW * 0.36);

      // Ghost bar (Initial Plan)
      const initKm = initMap[item.team]?.totalDistance || item.totalDistance;
      const yInit = yForKm(initKm);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1;
      ctx.fillRect(cx - barW - 2, yInit, barW, padT + plotH - yInit);
      ctx.strokeRect(cx - barW - 2, yInit, barW, padT + plotH - yInit);

      // Active Plan Bar
      const yCur = yForKm(item.totalDistance);
      const inBand = item.withinDistanceTolerance;
      ctx.fillStyle = inBand ? 'rgba(6, 182, 212, 0.78)' : 'rgba(244, 63, 94, 0.82)';
      ctx.fillRect(cx + 2, yCur, barW, padT + plotH - yCur);

      // Value label above active bar
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = inBand ? '#67E8F9' : '#FDA4AF';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(item.totalDistance)}`, cx + 2 + barW / 2, yCur - 5);

      // Team X label
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(item.team, cx, H - 14);
    });

    // Mean annotation tag
    ctx.fillStyle = '#10B981';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`AVG ${meanKm}km (±${tolKm}km)`, W - padR - 4, yMean - 5);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CHART 2: Weekday (Tue->Fri) vs Weekend (Fri->Tue) Move Count / Distance
  // -------------------------------------------------------------------------
  function drawChart2MoveDecomposition() {
    const canvas = document.getElementById('chartMoveDecomposition');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(460, (rect.width || 640) - 12);
    const H = 300;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const items = state.evalCache.active.teamAnalytics;
    const isCount = state.chart2Mode === 'count';
    const maxVal = isCount ? 45 : 9000;

    const padL = 52;
    const padR = 20;
    const padT = 26;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    // Grid
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = Math.round((maxVal / 4) * i);
      const y = padT + plotH - (val / maxVal) * plotH;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(isCount ? `${val}회` : `${val}`, padL - 6, y + 3);
    }

    const slotW = plotW / items.length;
    items.forEach((item, i) => {
      const cx = padL + slotW * i + slotW / 2;
      const barW = Math.min(28, slotW * 0.52);

      const wkdayVal = isCount ? item.weekdayMoveCount : item.weekdayDistance;
      const wkendVal = isCount ? item.weekendMoveCount : item.weekendDistance;
      const totalVal = wkdayVal + wkendVal;

      const hWkday = (wkdayVal / maxVal) * plotH;
      const hWkend = (wkendVal / maxVal) * plotH;

      const yBottom = padT + plotH;
      // Bottom stack: Weekday move (Amber - high fatigue, no rest day between Thu & Fri)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.fillRect(cx - barW / 2, yBottom - hWkday, barW, hWkday);

      // Top stack: Weekend move (Cyan - includes Monday rest day)
      ctx.fillStyle = 'rgba(6, 182, 212, 0.82)';
      ctx.fillRect(cx - barW / 2, yBottom - hWkday - hWkend, barW, hWkend);

      // Total label on top
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.fillText(isCount ? `${totalVal}회(${wkdayVal}/${wkendVal})` : `${Math.round(totalVal)}`, cx, yBottom - hWkday - hWkend - 5);

      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.team, cx, H - 14);
    });

    // Legend inside top right
    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('■ 주중 이동 (목→금 무휴식)', W - padR - 145, 15);
    ctx.fillStyle = '#06B6D4';
    ctx.fillText('■ 주말 이동 (일→화 휴식포함)', W - padR, 15);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CHART 3: Weekend & Holiday Home Games & Holiday Score Fairness
  // -------------------------------------------------------------------------
  function drawChart3HolidayFairness() {
    const canvas = document.getElementById('chartHolidayFairness');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(460, (rect.width || 640) - 12);
    const H = 300;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const ev = state.evalCache.active;
    const items = ev.teamAnalytics;
    const maxVal = 40;
    const padL = 48;
    const padR = 24;
    const padT = 26;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const yForVal = (v) => padT + plotH - (Math.min(maxVal, v) / maxVal) * plotH;

    // Grid
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'right';
    [0, 10, 20, 30, 40].forEach(v => {
      const y = yForVal(v);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(`${v}`, padL - 6, y + 3);
    });

    // Mean Holiday Score Line (25.0pt)
    const meanHol = ev.leagueSummary.meanHolidayScore;
    const yMeanHol = yForVal(meanHol);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, yMeanHol);
    ctx.lineTo(W - padR, yMeanHol);
    ctx.stroke();
    ctx.setLineDash([]);

    const slotW = plotW / items.length;
    const linePts = [];

    items.forEach((item, i) => {
      const cx = padL + slotW * i + slotW / 2;
      const barW = Math.min(26, slotW * 0.48);

      const wkGames = item.weekendHomeGames;
      const holGames = item.holidayHomeGames;
      const hWk = (wkGames / maxVal) * plotH;
      const hHol = (holGames / maxVal) * plotH;
      const yBot = padT + plotH;

      // Weekend Home Games bar
      ctx.fillStyle = 'rgba(6, 182, 212, 0.78)';
      ctx.fillRect(cx - barW / 2, yBot - hWk, barW, hWk);

      // Holiday Home Games top cap
      ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.fillRect(cx - barW / 2, yBot - hWk - hHol, barW, hHol);

      linePts.push({ x: cx, y: yForVal(item.holidayScore), score: item.holidayScore, ch: item.childrenDayHome });

      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.fillText(item.team, cx, H - 14);
      if (item.childrenDayHome) {
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#F59E0B';
        ctx.fillText('★5/5홈', cx, H - 3);
      }
    });

    // Draw Holiday Score Line Overlay
    ctx.beginPath();
    linePts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    linePts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#10B981';
      ctx.fill();
      ctx.strokeStyle = '#050811';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#6EE7B7';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.score}pt`, p.x, p.y - 8);
    });

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CHART 4: Multi-Team 5-Axis Balance Radar Overlay
  // -------------------------------------------------------------------------
  function populateRadarSelects() {
    const sel1 = document.getElementById('radarPrimaryTeam');
    const sel2 = document.getElementById('radarSecondaryTeam');
    if (!sel1 || !sel2) return;
    if (sel1.options.length === 0) {
      const opts = state.teams.map(t => `<option value="${t.name}">${t.name} (${t.stadium.slice(0, 4)})</option>`).join('');
      sel1.innerHTML = opts;
      sel2.innerHTML = opts;
      sel1.value = state.radarPrimary;
      sel2.value = state.radarSecondary;
    }
  }

  function computeTeamRadarVector(teamItem, leagueSummary) {
    // Normalize 5 metrics to 0..100 (higher = better schedule quality / fairness)
    const distScore = Math.max(25, Math.min(100, 100 - ((teamItem.totalDistance - 6200) / 2600) * 70));
    const devScore = Math.max(20, Math.min(100, 100 - (Math.abs(teamItem.distanceDiffFromMean) / 1300) * 80));
    const moveScore = Math.max(30, Math.min(100, 100 - ((teamItem.totalMoveCount - 28) / 14) * 65));
    const wkdayScore = Math.max(30, Math.min(100, 100 - ((teamItem.weekdayMoveCount - 12) / 10) * 65));
    const holFairness = Math.max(30, Math.min(100, 100 - (Math.abs(teamItem.holidayScore - leagueSummary.meanHolidayScore) / 6) * 70));
    return [distScore, devScore, moveScore, wkdayScore, holFairness];
  }

  function drawChart4TeamRadar() {
    populateRadarSelects();
    const canvas = document.getElementById('chartTeamRadar');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(460, (rect.width || 640) - 12);
    const H = 300;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const cx = W * 0.45;
    const cy = H * 0.53;
    const R = Math.min(W, H) * 0.36;
    const axes = [
      '① 총 이동거리 절감',
      '② 평균편차 균등성',
      '③ 총 이동횟수 절감',
      '④ 주중 무휴식이동 억제',
      '⑤ 휴일 흥행 공정성'
    ];

    // Draw Pentagon Web Rings
    [0.25, 0.5, 0.75, 1.0].forEach(level => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const x = cx + Math.cos(ang) * R * level;
        const y = cy + Math.sin(ang) * R * level;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.stroke();
    });

    // Draw Axes & Labels
    ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#CBD5E1';
    axes.forEach((label, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.stroke();

      const lx = cx + Math.cos(ang) * (R + 20);
      const ly = cy + Math.sin(ang) * (R + 16);
      ctx.textAlign = Math.abs(Math.cos(ang)) < 0.2 ? 'center' : (Math.cos(ang) > 0 ? 'left' : 'right');
      ctx.fillText(label, lx, ly);
    });

    const ev = state.evalCache.active;
    const initEv = state.evalCache.initial;
    const tPrimary = ev.teamAnalytics.find(a => a.team === state.radarPrimary) || ev.teamAnalytics[0];
    const tSecondary = ev.teamAnalytics.find(a => a.team === state.radarSecondary) || ev.teamAnalytics[1];
    const tPrimaryInit = initEv.teamAnalytics.find(a => a.team === state.radarPrimary) || tPrimary;

    const drawPolygon = (vec, strokeCol, fillCol, dashed = false) => {
      ctx.beginPath();
      if (dashed) ctx.setLineDash([4, 4]);
      vec.forEach((val, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const r = (val / 100) * R;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      if (fillCol) {
        ctx.fillStyle = fillCol;
        ctx.fill();
      }
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    };

    if (state.radarShowInitial) {
      drawPolygon(
        computeTeamRadarVector(tPrimaryInit, initEv.leagueSummary),
        'rgba(244, 63, 94, 0.85)',
        'rgba(244, 63, 94, 0.10)',
        true
      );
    }

    drawPolygon(
      computeTeamRadarVector(tSecondary, ev.leagueSummary),
      '#F59E0B',
      'rgba(245, 158, 11, 0.16)',
      false
    );

    drawPolygon(
      computeTeamRadarVector(tPrimary, ev.leagueSummary),
      '#06B6D4',
      'rgba(6, 182, 212, 0.24)',
      false
    );

    // Side Legend Box
    const legX = W - 145;
    let legY = 28;
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#06B6D4';
    ctx.fillText(`■ ${tPrimary.team} (현재 플랜)`, legX, legY);
    legY += 18;
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`■ ${tSecondary.team} (비교 구단)`, legX, legY);
    if (state.radarShowInitial) {
      legY += 18;
      ctx.fillStyle = '#F43F5E';
      ctx.fillText(`┈ ${tPrimary.team} (초기 배정안)`, legX, legY);
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CHART 5A: 10 Teams x 45 Series Season Heatmap Matrix
  // -------------------------------------------------------------------------
  function drawChart5SeasonHeatmap() {
    const canvas = document.getElementById('chartSeasonHeatmap');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(780, (rect.width || 860) - 8);
    const H = 370;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const ev = state.evalCache.active;
    const teams = ev.teamAnalytics;
    const slots = ev.slotSummaries;
    const numSlots = slots.length || 45;

    const padL = 62;
    const padR = 12;
    const padT = 30;
    const padB = 18;
    const cellW = (W - padL - padR) / numSlots;
    const cellH = (H - padT - padB) / teams.length;

    state.heatmapCellBounds = [];

    // Slot Header Numbers (S01..S45)
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    slots.forEach((s, sIdx) => {
      const x = padL + sIdx * cellW + cellW / 2;
      const isActiveStep = (sIdx + 1) === state.replayStep;
      ctx.fillStyle = isActiveStep ? '#10B981' : (s.holiday > 0 ? '#67E8F9' : '#64748B');
      if ((sIdx + 1) % 2 === 1 || isActiveStep) {
        ctx.fillText(`S${sIdx + 1}`, x, 13);
        ctx.fillText(s.date.slice(5), x, 24);
      }
    });

    // Rows per Team
    teams.forEach((tItem, rIdx) => {
      const y = padT + rIdx * cellH;
      const isReplayRow = tItem.team === state.replayTeam;

      // Row team label
      ctx.font = isReplayRow ? '800 11.5px "Plus Jakarta Sans", sans-serif' : '600 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = isReplayRow ? '#06B6D4' : '#E2E8F0';
      ctx.textAlign = 'right';
      ctx.fillText(tItem.team, padL - 8, y + cellH / 2 + 4);

      if (isReplayRow) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(padL - 1, y, W - padL - padR + 2, cellH);
      }

      tItem.routeSteps.forEach((step, sIdx) => {
        const x = padL + sIdx * cellW;
        const slotObj = slots[sIdx];
        const hasViol = slotObj && slotObj.violations && slotObj.violations.length > 0;

        // Cell fill: Home (Cyan) vs Away (Amber) vs Long Move (>250km Crimson tint)
        if (hasViol) {
          ctx.fillStyle = 'rgba(244, 63, 94, 0.55)';
        } else if (step.isHome) {
          ctx.fillStyle = step.distance > 250 ? 'rgba(6, 182, 212, 0.52)' : 'rgba(6, 182, 212, 0.26)';
        } else {
          ctx.fillStyle = step.distance > 250 ? 'rgba(244, 63, 94, 0.36)' : 'rgba(245, 158, 11, 0.22)';
        }

        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

        // Highlight current replay step column
        if ((sIdx + 1) === state.replayStep) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
        }

        // Opponent 1-char code inside cell
        ctx.font = '700 8.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = step.isHome ? '#E0F2FE' : '#FEF3C7';
        ctx.textAlign = 'center';
        ctx.fillText(step.opponent.slice(0, 2), x + cellW / 2, y + cellH / 2 + 3);

        state.heatmapCellBounds.push({
          x, y, w: cellW, h: cellH,
          team: tItem.team,
          step
        });
      });
    });

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // CHART 5B: Interactive Team Season Trajectory GIS Replayer
  // -------------------------------------------------------------------------
  function renderTrajectoryReplayer() {
    const bar = document.getElementById('replayTeamSelectorBar');
    if (bar) {
      bar.innerHTML = state.teams.map(t => `
        <button type="button" class="t-pill ${state.replayTeam === t.name ? 'active' : ''}" data-replay-pill="${t.name}">
          ${t.name}
        </button>
      `).join('');

      bar.querySelectorAll('[data-replay-pill]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.replayTeam = btn.getAttribute('data-replay-pill');
          renderSoftComparisonTable();
          drawChart5SeasonHeatmap();
          renderTrajectoryReplayer();
        });
      });
    }

    const slider = document.getElementById('sliderReplayStep');
    const badge = document.getElementById('replayStepBadge');
    if (slider) slider.value = String(state.replayStep);
    if (badge) badge.textContent = `S${String(state.replayStep).padStart(2, '0')} / 45`;

    drawTrajectoryMapCanvas();
    renderReplayerRouteLog();
  }

  function drawTrajectoryMapCanvas() {
    const canvas = document.getElementById('chartTrajectoryMap');
    const hud = document.getElementById('replayerHudBox');
    if (!canvas) return;

    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(340, rect.width || 420);
    const H = 290;
    canvas.width = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    // Draw Korea Outline
    ctx.beginPath();
    KOREA_OUTLINE_COORDS.forEach(([lat, lng], i) => {
      const pt = projectLatLngToCanvas(lat, lng, W, H, 26);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const stadiumPos = {};
    state.teams.forEach(t => {
      const pt = projectLatLngToCanvas(t.latitude, t.longitude, W, H, 26);
      stadiumPos[t.stadium] = { x: pt.x, y: pt.y, team: t.name };
    });

    const ev = state.evalCache.active;
    const tAnalytics = ev.teamAnalytics.find(a => a.team === state.replayTeam) || ev.teamAnalytics[0];
    const activeSteps = tAnalytics.routeSteps.slice(0, state.replayStep);

    // Draw Trajectory Path up to state.replayStep
    activeSteps.forEach((st, idx) => {
      const fromPt = stadiumPos[st.fromStadium];
      const toPt = stadiumPos[st.toStadium];
      if (!fromPt || !toPt || st.distance <= 0) return;

      const isLatest = idx === activeSteps.length - 1;
      ctx.beginPath();
      ctx.moveTo(fromPt.x, fromPt.y);
      ctx.lineTo(toPt.x, toPt.y);
      ctx.strokeStyle = isLatest ? '#10B981' : 'rgba(6, 182, 212, 0.42)';
      ctx.lineWidth = isLatest ? 3.0 : 1.3;
      ctx.stroke();
    });

    // Draw Stadium Nodes
    state.teams.forEach(t => {
      const pt = projectLatLngToCanvas(t.latitude, t.longitude, W, H, 26);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = t.name === state.replayTeam ? '#F59E0B' : '#06B6D4';
      ctx.fill();
      ctx.font = '600 9.5px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#CBD5E1';
      ctx.fillText(t.name, pt.x + 6, pt.y + 3);
    });

    // Highlight Current Step Position
    const curStep = activeSteps[activeSteps.length - 1];
    if (curStep) {
      const curPt = stadiumPos[curStep.toStadium];
      if (curPt) {
        ctx.beginPath();
        ctx.arc(curPt.x, curPt.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.fill();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (hud) {
        hud.innerHTML = `
          <div style="color:var(--neon-cyan);font-weight:800;">${tAnalytics.team} // S${String(curStep.stepIndex).padStart(2, '0')} (${curStep.date})</div>
          <div>대진: <b>${curStep.isHome ? `vs ${curStep.opponent} (홈)` : `@ ${curStep.opponent} (원정)`}</b> · ${curStep.streakLabel}</div>
          <div>구간 이동: <b>${curStep.path} (${curStep.distance}km)</b></div>
          <div style="color:var(--neon-emerald);">누적 이동거리: <b>${curStep.cumulativeDistance.toLocaleString()} km</b> / 총 ${tAnalytics.totalDistance.toLocaleString()} km</div>
        `;
      }
    }

    ctx.restore();
  }

  function renderReplayerRouteLog() {
    const logBox = document.getElementById('replayerRouteLog');
    if (!logBox) return;
    const ev = state.evalCache.active;
    const tAnalytics = ev.teamAnalytics.find(a => a.team === state.replayTeam) || ev.teamAnalytics[0];

    logBox.innerHTML = tAnalytics.routeSteps.map(st => `
      <div class="route-step-item ${st.stepIndex === state.replayStep ? 'active-step' : ''}" data-step-idx="${st.stepIndex}">
        <span>S${String(st.stepIndex).padStart(2, '0')} [${st.date.slice(5)}] ${st.isHome ? '🏠vs' : '✈️@'} ${st.opponent}</span>
        <span>${st.distance > 0 ? `+${st.distance}km (${st.moveType})` : '체류 0km'} · 누적 ${st.cumulativeDistance}km</span>
      </div>
    `).join('');

    logBox.querySelectorAll('[data-step-idx]').forEach(el => {
      el.addEventListener('click', () => {
        state.replayStep = Number(el.getAttribute('data-step-idx'));
        drawChart5SeasonHeatmap();
        renderTrajectoryReplayer();
      });
    });

    const activeEl = logBox.querySelector('.active-step');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  // =========================================================================
  // 8. EVENT LISTENERS & INITIALIZATION BOOTSTRAP
  // =========================================================================
  function bindAllEvents() {
    // 1. Module Navigation Tabs
    document.querySelectorAll('.mod-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const mod = tab.getAttribute('data-module');
        state.activeModule = mod;
        document.querySelectorAll('.mod-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('[data-module-section]').forEach(sec => {
          const secId = sec.getAttribute('data-module-section');
          sec.classList.toggle('hidden', mod !== 'all' && mod !== secId);
        });
        requestAnimationFrame(() => {
          renderActiveGisMap();
          drawSolverConvergenceChart();
          renderAnalyticsModule();
        });
      });
    });

    // 2. Plan Dataset Switchers (Header + Module 4)
    document.querySelectorAll('[data-plan-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        switchPlanMode(btn.getAttribute('data-plan-mode'));
      });
    });

    // 3. Auto-Repair Hard Violations Button
    document.getElementById('btnAutoRepairViolations')?.addEventListener('click', () => {
      switchPlanMode('solved');
      setTickerMessage('🔧 OptaPlanner 솔버 자동 교정 완료: 잠실 구장 중복, 어린이날 의무 홈 위반, 연속 맞대결 위반이 모두 해소되었습니다.');
    });

    // 4. Module 1: Quick Geocode Bar & 2nd Stadium Presets
    document.getElementById('btnQuickGeocode')?.addEventListener('click', async () => {
      const teamName = document.getElementById('quickGeocodeTeamSelect')?.value;
      const query = document.getElementById('quickGeocodeQueryInput')?.value;
      const idx = state.teams.findIndex(t => t.name === teamName);
      if (idx !== -1 && query) {
        await triggerTeamGeocode(idx, query);
      }
    });

    document.getElementById('quickGeocodeQueryInput')?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btnQuickGeocode')?.click();
      }
    });

    document.querySelectorAll('[data-second-stadium]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const [teamName, stadiumName] = btn.getAttribute('data-second-stadium').split(':');
        const idx = state.teams.findIndex(t => t.name === teamName);
        if (idx !== -1) {
          await triggerTeamGeocode(idx, stadiumName);
        }
      });
    });

    document.getElementById('btnResetTeamsDefault')?.addEventListener('click', () => {
      state.teams = Engine.deepClone(RawData.teams);
      state.distanceMatrix = Engine.deepClone(RawData.distanceMatrix);
      recomputeEvaluations();
      renderGisModule();
      renderPreflightAndSolverModule();
      renderAnalyticsModule();
      setTickerMessage('10개 구단 제1구장 기본 위·경도 좌표 및 공식 도로 이동거리 행렬(input_2025.json)로 복원되었습니다.');
    });

    document.getElementById('btnRecalcDistanceMatrix')?.addEventListener('click', async () => {
      const useLive = document.getElementById('chkUseLiveOsrm')?.checked || false;
      state.distanceMatrix = await Engine.calculateDistanceMatrixFromCoords(state.teams, {
        useLiveRouteApi: useLive,
        forceFormula: false
      });
      recomputeEvaluations();
      renderGisModule();
      renderPreflightAndSolverModule();
      renderAnalyticsModule();
      setTickerMessage(`⚡ 10×10 구장 간 도로 이동거리 행렬(100셀) 일괄 재계산 및 BendableScore 반영 완료!`);
    });

    // GIS Map Click-to-Select Node on Tactical Vector Canvas
    const gisCanvas = document.getElementById('tacticalGisCanvas');
    if (gisCanvas) {
      gisCanvas.addEventListener('click', (e) => {
        const rect = gisCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const nodes = gisCanvas._nodePositions || {};
        for (const [tName, pos] of Object.entries(nodes)) {
          const d = Math.hypot(mx - pos.x, my - pos.y);
          if (d <= 15) {
            state.focusTeam = tName;
            renderTeamRegistryTable();
            renderFocusTeamPills();
            renderActiveGisMap();
            setTickerMessage(`[GIS 허브 포커스] ${tName} (${pos.team.stadium}) 출발 전국 9개 구장 이동 노선(Arc) 및 거리 표시.`);
            break;
          }
        }
      });
    }

    document.getElementById('chkShowAllArcs')?.addEventListener('change', (e) => {
      state.showAllArcs = e.target.checked;
      renderActiveGisMap();
    });

    document.getElementById('chkShowDistanceLabels')?.addEventListener('change', (e) => {
      state.showDistanceLabels = e.target.checked;
      renderActiveGisMap();
    });

    document.querySelectorAll('[data-map-engine]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mapEngine = btn.getAttribute('data-map-engine');
        renderActiveGisMap();
      });
    });

    // 5. Module 2: Season Config, Rest Days, Blackouts, Events & Calendar
    ['cfgSeasonStart', 'cfgSeasonEnd', 'cfgAllStarStart', 'cfgAllStarEnd'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (id === 'cfgSeasonStart') state.config.matchStartDate = val;
        if (id === 'cfgSeasonEnd') state.config.matchEndDate = val;
        if (id === 'cfgAllStarStart') state.config.allStarStartDate = val;
        if (id === 'cfgAllStarEnd') state.config.allStarEndDate = val;
        recomputeEvaluations();
        renderCalendarModule();
        renderPreflightAndSolverModule();
        renderAnalyticsModule();
      });
    });

    document.querySelectorAll('#restDayToggleGroup .dow-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dow = Number(btn.getAttribute('data-dow'));
        const idx = state.config.restDaysOfWeek.indexOf(dow);
        if (idx !== -1) state.config.restDaysOfWeek.splice(idx, 1);
        else state.config.restDaysOfWeek.push(dow);
        recomputeEvaluations();
        renderCalendarModule();
        renderPreflightAndSolverModule();
        renderAnalyticsModule();
        setTickerMessage(`정기 휴무 요일 설정 변경: [${state.config.restDaysOfWeek.map(d => Engine.DAY_NAMES_KO[d]).join(', ') || '없음'}] — Hard 제약 재검증 완료.`);
      });
    });

    document.getElementById('btnAddBlackout')?.addEventListener('click', () => {
      const dt = document.getElementById('inputBlackoutDate')?.value;
      const reason = document.getElementById('inputBlackoutReason')?.value?.trim() || '경기 미개최 지정일';
      if (dt) {
        state.blackouts.push({ date: dt, reason });
        renderCalendarModule();
        renderPreflightAndSolverModule();
      }
    });

    document.getElementById('btnAddEventRule')?.addEventListener('click', () => {
      state.eventRules.push({
        id: `evt-custom-${Date.now()}`,
        date: '2025-08-15',
        title: '광복절 특별 시리즈 (구장 고정 또는 대진 고정 선택)',
        consecutive: 3,
        mode: 'stadium',
        assignments: [
          { stadium: '잠실종합운동장', home: '두산', away: '삼성' },
          { stadium: '창원NC파크', home: 'NC', away: 'LG' },
          { stadium: '사직야구장', home: '롯데', away: 'KT' },
          { stadium: '고척돔야구장', home: '키움', away: '한화' },
          { stadium: '문학경기장', home: 'SSG', away: 'KIA' }
        ]
      });
      renderEventRulesManager();
      renderPreflightAndSolverModule();
      setTickerMessage('신규 특정 이벤트 규칙(광복절 2025-08-15)이 추가되었습니다. [구단+구장 대진고정] 또는 [구장만 지정] 모드를 선택하세요.');
    });

    document.getElementById('btnApplyEventsToPlan')?.addEventListener('click', () => {
      applyEventRulesToActivePlan();
    });

    document.querySelectorAll('#calMonthTabs .month-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.selectedCalendarMonth = tab.getAttribute('data-month');
        document.querySelectorAll('#calMonthTabs .month-tab').forEach(t => t.classList.toggle('active', t === tab));
        renderVisualSeasonCalendar();
      });
    });

    // 6. Module 3: Tolerance Sliders, JSON Inspector & Solver Execution
    const bindSlider = (sliderId, labelId, cfgKey, fmtFn) => {
      const sl = document.getElementById(sliderId);
      const lbl = document.getElementById(labelId);
      if (!sl) return;
      sl.addEventListener('input', () => {
        const v = parseFloat(sl.value);
        state.config[cfgKey] = v;
        if (lbl) lbl.textContent = fmtFn(v);
        recomputeEvaluations();
        renderPreflightChecklist();
        renderJsonPayloadViewer();
        renderAnalyticsModule();
      });
    };

    bindSlider('sliderTolDistance', 'valTolDistance', 'toleranceTotalDistance', v => `±${v.toFixed(1)} km`);
    bindSlider('sliderTolHoliday', 'valTolHoliday', 'toleranceHoliday', v => `±${v.toFixed(1)} pt`);
    bindSlider('sliderTolMove', 'valTolMove', 'toleranceTotalMove', v => `±${v.toFixed(1)} 회`);
    bindSlider('sliderMaxConsec', 'valMaxConsec', 'maxConsecutiveHomeAway', v => `${v} 연속 (${v * 3}경기)`);

    document.getElementById('btnResetTolerances')?.addEventListener('click', () => {
      state.config.toleranceTotalDistance = 300.0;
      state.config.toleranceHoliday = 1.5;
      state.config.toleranceTotalMove = 2.0;
      state.config.maxConsecutiveHomeAway = 3;
      document.getElementById('sliderTolDistance').value = '300';
      document.getElementById('valTolDistance').textContent = '±300.0 km';
      document.getElementById('sliderTolHoliday').value = '1.5';
      document.getElementById('valTolHoliday').textContent = '±1.5 pt';
      document.getElementById('sliderTolMove').value = '2.0';
      document.getElementById('valTolMove').textContent = '±2.0 회';
      document.getElementById('sliderMaxConsec').value = '3';
      document.getElementById('valMaxConsec').textContent = '3 연속 (9경기)';
      recomputeEvaluations();
      renderPreflightAndSolverModule();
      renderAnalyticsModule();
    });

    document.querySelectorAll('.json-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.activeJsonTab = tab.getAttribute('data-json-section');
        document.querySelectorAll('.json-tab').forEach(t => t.classList.toggle('active', t === tab));
        renderJsonPayloadViewer();
      });
    });

    document.getElementById('btnCopyJsonPayload')?.addEventListener('click', () => {
      const txt = JSON.stringify(buildCurrentJsonPayload(), null, 2);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(txt);
      }
      setTickerMessage('📋 OptaPlanner 입력 JSON Payload가 클립보드에 복사되었습니다.');
    });

    document.getElementById('btnDownloadJsonPayload')?.addEventListener('click', () => {
      const txt = JSON.stringify(buildCurrentJsonPayload(), null, 2);
      const blob = new Blob([txt], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'input_2025_command_center.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btnExecuteSolver')?.addEventListener('click', () => {
      runSolverSimulation();
    });

    document.getElementById('btnClearSolverLog')?.addEventListener('click', () => {
      const out = document.getElementById('solverTerminalOutput');
      if (out) out.innerHTML = '';
    });

    // 7. Module 4: Table Sorting, Chart Controls, Heatmap Hover & Replayer
    document.querySelectorAll('#softComparisonTable th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const sortKey = th.getAttribute('data-sort');
        if (state.softSortKey === sortKey) {
          state.softSortAsc = !state.softSortAsc;
        } else {
          state.softSortKey = sortKey;
          state.softSortAsc = false;
        }
        document.querySelectorAll('#softComparisonTable th.sortable').forEach(h => h.classList.remove('active-sort'));
        th.classList.add('active-sort');
        renderSoftComparisonTable();
      });
    });

    document.querySelectorAll('#chart2MetricToggle .mini-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        state.chart2Mode = btn.getAttribute('data-c2-mode');
        document.querySelectorAll('#chart2MetricToggle .mini-toggle').forEach(b => b.classList.toggle('active', b === btn));
        drawChart2MoveDecomposition();
      });
    });

    document.getElementById('radarPrimaryTeam')?.addEventListener('change', (e) => {
      state.radarPrimary = e.target.value;
      drawChart4TeamRadar();
    });
    document.getElementById('radarSecondaryTeam')?.addEventListener('change', (e) => {
      state.radarSecondary = e.target.value;
      drawChart4TeamRadar();
    });
    document.getElementById('chkRadarShowInitial')?.addEventListener('change', (e) => {
      state.radarShowInitial = e.target.checked;
      drawChart4TeamRadar();
    });

    // Chart 5 Heatmap Hover & Click
    const hmCanvas = document.getElementById('chartSeasonHeatmap');
    if (hmCanvas) {
      hmCanvas.addEventListener('mousemove', (e) => {
        const rect = hmCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const cell = state.heatmapCellBounds.find(c => mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h);
        const readout = document.getElementById('heatmapHoverReadout');
        if (cell && readout) {
          const st = cell.step;
          readout.textContent = `[${cell.team} · S${String(st.stepIndex).padStart(2, '0')} (${st.date} ${st.dow})] ${st.isHome ? '홈' : '원정'} vs ${st.opponent} (${st.consecutiveGames}연전) | 이동: ${st.path} (${st.distance}km, ${st.moveType}) | 누적: ${st.cumulativeDistance}km | ${st.streakLabel}`;
        }
      });
      hmCanvas.addEventListener('click', (e) => {
        const rect = hmCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const cell = state.heatmapCellBounds.find(c => mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h);
        if (cell) {
          state.replayTeam = cell.team;
          state.replayStep = cell.step.stepIndex;
          drawChart5SeasonHeatmap();
          renderTrajectoryReplayer();
        }
      });
    }

    // Trajectory Replayer Controls
    document.getElementById('sliderReplayStep')?.addEventListener('input', (e) => {
      state.replayStep = Number(e.target.value);
      drawChart5SeasonHeatmap();
      renderTrajectoryReplayer();
    });

    document.getElementById('btnReplayPrev')?.addEventListener('click', () => {
      state.replayStep = Math.max(1, state.replayStep - 1);
      drawChart5SeasonHeatmap();
      renderTrajectoryReplayer();
    });

    document.getElementById('btnReplayNext')?.addEventListener('click', () => {
      state.replayStep = Math.min(45, state.replayStep + 1);
      drawChart5SeasonHeatmap();
      renderTrajectoryReplayer();
    });

    document.getElementById('btnReplayPlayPause')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      if (state.replayPlaying) {
        clearInterval(state.replayTimer);
        state.replayPlaying = false;
        btn.textContent = '▶ 궤적 재생';
      } else {
        if (state.replayStep >= 45) state.replayStep = 1;
        state.replayPlaying = true;
        btn.textContent = '⏸ 일시정지';
        state.replayTimer = setInterval(() => {
          if (state.replayStep >= 45) {
            clearInterval(state.replayTimer);
            state.replayPlaying = false;
            btn.textContent = '▶ 궤적 재생';
            return;
          }
          state.replayStep++;
          drawChart5SeasonHeatmap();
          renderTrajectoryReplayer();
        }, 280);
      }
    });

    // 8. Map API Key Modal
    document.getElementById('btnOpenMapApiModal')?.addEventListener('click', () => openMapApiModal());
    document.getElementById('btnCloseMapApiModal')?.addEventListener('click', () => {
      document.getElementById('mapApiModalBackdrop')?.classList.add('hidden');
    });
    document.getElementById('btnCancelMapApiModal')?.addEventListener('click', () => {
      document.getElementById('mapApiModalBackdrop')?.classList.add('hidden');
    });
    document.getElementById('btnSaveMapApiKeys')?.addEventListener('click', () => {
      const kakaoKey = document.getElementById('inputKakaoApiKey')?.value?.trim();
      const naverId = document.getElementById('inputNaverClientId')?.value?.trim();
      const msgEl = document.getElementById('mapSdkStatusMsg');

      if (kakaoKey) {
        state.kakaoApiKey = kakaoKey;
        const script = document.createElement('script');
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(kakaoKey)}&libraries=services&autoload=false`;
        script.onload = () => {
          window.kakao.maps.load(() => {
            state.mapEngine = 'kakao';
            renderActiveGisMap();
            if (msgEl) msgEl.textContent = '✓ Kakao Map JS SDK & Geocoder 연결 성공!';
          });
        };
        document.head.appendChild(script);
      }
      if (naverId) {
        state.naverClientId = naverId;
        const script = document.createElement('script');
        script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(naverId)}`;
        script.onload = () => {
          state.mapEngine = 'naver';
          renderActiveGisMap();
          if (msgEl) msgEl.textContent = '✓ Naver Maps v3 SDK 연결 성공!';
        };
        document.head.appendChild(script);
      }
      if (!kakaoKey && !naverId && msgEl) {
        msgEl.textContent = '키가 입력되지 않아 내장 Tactical Vector GIS & Leaflet Dark Tile 모드를 유지합니다.';
      }
      setTimeout(() => {
        document.getElementById('mapApiModalBackdrop')?.classList.add('hidden');
      }, 650);
    });

    // Window resize responsive redraw
    window.addEventListener('resize', () => {
      requestAnimationFrame(() => {
        if (state.mapEngine === 'vector') drawTacticalVectorGisCanvas();
        drawSolverConvergenceChart();
        drawChart1DistanceTolerance();
        drawChart2MoveDecomposition();
        drawChart3HolidayFairness();
        drawChart4TeamRadar();
        drawChart5SeasonHeatmap();
        drawTrajectoryMapCanvas();
      });
    });
  }

  function initCommandCenter() {
    recomputeEvaluations();
    initDefaultConvergenceHistory();
    renderGisModule();
    renderCalendarModule();
    renderPreflightAndSolverModule();
    renderAnalyticsModule();

    // Seed initial solver terminal logs
    appendSolverLog('info', 'BOOT', 'OptaPlanner 8.x KBO League Schedule Command Center initialized.');
    appendSolverLog('info', 'FACTS', 'Loaded 10 teams, 10x10 road distance matrix (0.0km ~ 407.2km), 45 calendar slots, 225 series.');
    appendSolverLog('best', 'OPTIMAL', `Active Solved Plan BendableScore: ${state.evalCache.solved.score.formatted} (Hard Feasible, 9/10 teams within ±300km).`);

    bindAllEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommandCenter);
  } else {
    initCommandCenter();
  }
})();
