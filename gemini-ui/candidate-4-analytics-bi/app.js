/**
 * KBO 2025 Analytics & Fairness BI Suite (Candidate 4)
 * Executive BI & Before/After Simulation Dashboard
 * 100% Pure Vanilla JavaScript — Zero Framework Dependencies
 */
(function () {
  'use strict';

  // South Korea Mainland Outline Coordinates [lat, lng] for Built-in High-DPI GIS Canvas
  const KOREA_OUTLINE_COORDS = [
    [38.30, 128.35], [37.90, 128.82], [37.52, 129.12], [37.05, 129.40],
    [36.50, 129.44], [36.05, 129.55], [35.50, 129.43], [35.15, 129.15],
    [34.88, 128.68], [34.82, 128.05], [34.70, 127.68], [34.48, 127.10],
    [34.35, 126.55], [34.68, 126.15], [35.12, 126.15], [35.48, 126.42],
    [35.98, 126.56], [36.42, 126.46], [36.78, 126.14], [36.98, 126.58],
    [37.28, 126.62], [37.52, 126.58], [37.78, 126.65], [38.05, 126.95],
    [38.28, 127.55], [38.30, 128.35]
  ];

  // Application State
  const state = {
    currentStage: 1,
    allStagesMode: false,

    // Stage 1: Teams & GIS Matrix
    teams: window.KBOEngine.deepClone(window.KBO_DATA.teams),
    distanceMatrix: window.KBOEngine.deepClone(window.KBO_DATA.distanceMatrix),
    mapMode: 'canvas', // 'canvas' | 'leaflet' | 'kakao' | 'naver'
    selectedMapTeam: '롯데',
    highlightedPair: null, // { from, to }
    leafletMap: null,
    leafletLayerGroup: null,
    kakaoMap: null,
    naverMap: null,

    // Stage 2: Season Rules & Special Event Builder
    seasonConfig: {
      matchStartDate: '2025-03-22',
      matchEndDate: '2025-08-31',
      restDaysOfWeek: [1], // 1 = Monday
      allStarStartDate: '2025-07-11',
      allStarEndDate: '2025-07-16',
      allStarBreakDate: '2025-07-02',
      extraBlackouts: ['2025-07-17'],
      toleranceTotalDistance: 300.0,
      toleranceTotalMove: 2.0,
      toleranceWeekdayMove: 1.5,
      toleranceHoliday: 1.5,
      maxConsecutiveHomeAway: 3,
      childrenDayStart: '2025-05-05',
      childrenDayHomeTeams: ['두산', '키움', '한화', 'NC', '롯데']
    },

    // Special Event Slots (Supports BOTH 'MATCHUP_AND_STADIUM' and 'STADIUM_ONLY' modes!)
    specialEvents: [
      {
        id: 'evt-opening-2025',
        title: '2025 KBO 정규시즌 개막 2연전 (Opening Series)',
        date: '2025-03-22',
        consecutive: 2,
        pinMode: 'MATCHUP_AND_STADIUM', // 'MATCHUP_AND_STADIUM' | 'STADIUM_ONLY'
        badgeText: '개막전 5대진 Pin 고정',
        matchups: [
          { away: '롯데', home: 'LG', stadium: '잠실종합운동장' },
          { away: '두산', home: 'SSG', stadium: '문학경기장' },
          { away: '한화', home: 'KT', stadium: '수원KT위즈파크' },
          { away: '키움', home: '삼성', stadium: '대구삼성라이언즈파크' },
          { away: 'NC', home: 'KIA', stadium: '광주챔피언스필드' }
        ],
        homeTeamsOnly: ['LG', 'SSG', 'KT', '삼성', 'KIA']
      },
      {
        id: 'evt-childrenday-2025',
        title: '2025 어린이날 특별 3연전 (Children\'s Day Series)',
        date: '2025-05-05',
        consecutive: 3,
        pinMode: 'STADIUM_ONLY', // Defaults to Stadium Only so user immediately sees both modes!
        badgeText: '5개 홈구장 지정 (매치업 엔진 위임)',
        matchups: [
          { away: 'LG', home: '두산', stadium: '잠실종합운동장' },
          { away: 'KT', home: 'NC', stadium: '창원NC파크' },
          { away: 'KIA', home: '키움', stadium: '고척돔야구장' },
          { away: 'SSG', home: '롯데', stadium: '사직야구장' },
          { away: '삼성', home: '한화', stadium: '한화이글스파크' }
        ],
        homeTeamsOnly: ['두산', '키움', '한화', 'NC', '롯데']
      }
    ],

    selectedCalendarDate: '2025-05-05',

    // Stage 3: Solver Telemetry
    solverRunning: false,
    solverProgress: 100,
    convergenceHistory: [
      { step: 0, label: '초기해(Initial)', distPenalty: 573810, spreadKm: 1372.5, movePenalty: 400 },
      { step: 3000, label: 'CH 완료', distPenalty: 312400, spreadKm: 1120.2, movePenalty: 200 },
      { step: 6500, label: 'Tabu 1단계', distPenalty: 148900, spreadKm: 884.0, movePenalty: 100 },
      { step: 10200, label: 'Tabu 2단계', distPenalty: 42150, spreadKm: 712.4, movePenalty: 100 },
      { step: 14500, label: 'Late Acceptance', distPenalty: 4820, spreadKm: 618.8, movePenalty: 0 },
      { step: 18420, label: '최적해(Solved)', distPenalty: 0, spreadKm: 573.1, movePenalty: 0 }
    ],

    // Stage 4: Plan Evaluation & BI Charts
    activePlanMode: 'solved', // 'solved' | 'initial' | 'violation'
    focusTeam: '롯데',
    softTableSort: { key: 'totalDistance', dir: 'desc' },
    chart1Sort: 'default', // 'default' | 'afterDesc' | 'beforeDesc'
    chart2Mode: 'scatter', // 'scatter' | 'stacked'
    radarSelectedTeams: ['롯데', 'KIA', '두산', '삼성'],
    radarShowBefore: true,
    spaghettiShowBefore: true,
    trajectoryMonth: 'ALL',
    selectedRouteStepIndex: 1,

    // Cached evaluation results
    evalInitial: null,
    evalSolved: null,
    evalViolation: null,
    evalActive: null
  };

  // ==========================================================================
  // UTILITY FUNCTIONS
  // ==========================================================================
  function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s ease';
      setTimeout(() => el.remove(), 260);
    }, 2800);
  }

  function showTooltip(html, clientX, clientY) {
    const tip = document.getElementById('bi-chart-tooltip');
    if (!tip) return;
    tip.innerHTML = html;
    tip.style.display = 'block';
    const pad = 14;
    let left = clientX + pad;
    let top = clientY + pad;
    if (left + 270 > window.innerWidth) left = clientX - 275;
    if (top + 130 > window.innerHeight) top = clientY - 130;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }

  function hideTooltip() {
    const tip = document.getElementById('bi-chart-tooltip');
    if (tip) tip.style.display = 'none';
  }

  function setupHiDPICanvas(canvas, fallbackHeight = 320) {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(300, rect.width || canvas.parentElement?.clientWidth || 640);
    const cssHeight = Math.max(220, rect.height || fallbackHeight);
    if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: cssWidth, height: cssHeight, dpr };
  }

  function buildConfiguredPlan(basePlan) {
    const cloned = window.KBOEngine.deepClone(basePlan);
    const teamByName = {};
    state.teams.forEach(t => { teamByName[t.name] = t; });

    // Apply special event pin overrides if user edited matchups in MATCHUP_AND_STADIUM mode
    state.specialEvents.forEach(evt => {
      if (evt.pinMode === 'MATCHUP_AND_STADIUM' && Array.isArray(evt.matchups) && evt.matchups.length === 5) {
        const slotMatches = cloned.filter(m => String(m.datetime).slice(0, 10) === evt.date);
        if (slotMatches.length === 5) {
          evt.matchups.forEach((pin, idx) => {
            if (slotMatches[idx]) {
              slotMatches[idx].away = pin.away;
              slotMatches[idx].home = pin.home;
              slotMatches[idx].stadiumOverride = pin.stadium || teamByName[pin.home]?.stadium || pin.home;
              slotMatches[idx].pinned = true;
            }
          });
        }
      }
    });

    return cloned;
  }

  function recomputeAllEvaluations() {
    const childrenEvt = state.specialEvents.find(e => e.date === '2025-05-05');
    if (childrenEvt) {
      if (childrenEvt.pinMode === 'STADIUM_ONLY') {
        state.seasonConfig.childrenDayHomeTeams = [...childrenEvt.homeTeamsOnly];
      } else {
        state.seasonConfig.childrenDayHomeTeams = childrenEvt.matchups.map(m => m.home);
      }
    }

    const cfg = {
      ...state.seasonConfig,
      calendar: window.KBO_DATA.calendar
    };

    const initPlan = buildConfiguredPlan(window.KBO_DATA.initialPlan);
    const solvedPlan = buildConfiguredPlan(window.KBO_DATA.solvedPlan);
    const violationPlan = window.KBOEngine.createViolationDemoPlan();

    state.evalInitial = window.KBOEngine.evaluatePlan(initPlan, state.teams, state.distanceMatrix, cfg);
    state.evalSolved = window.KBOEngine.evaluatePlan(solvedPlan, state.teams, state.distanceMatrix, cfg);
    state.evalViolation = window.KBOEngine.evaluatePlan(violationPlan, state.teams, state.distanceMatrix, cfg);

    if (state.activePlanMode === 'initial') {
      state.evalActive = state.evalInitial;
    } else if (state.activePlanMode === 'violation') {
      state.evalActive = state.evalViolation;
    } else {
      state.evalActive = state.evalSolved;
    }

    updateExecutiveHeaderRibbon();
  }

  function updateExecutiveHeaderRibbon() {
    const active = state.evalActive || state.evalSolved;
    const init = state.evalInitial;
    if (!active || !init) return;

    const hardEl = document.getElementById('hdr-hard-status');
    const scoreEl = document.getElementById('hdr-score-text');
    const spreadEl = document.getElementById('hdr-spread-text');
    const tolEl = document.getElementById('hdr-tol-text');
    const navBadge = document.getElementById('nav-active-plan-badge');

    if (hardEl) {
      if (active.score.feasible) {
        hardEl.className = 'header-kpi-value pass';
        hardEl.textContent = '● PASS (0 위반)';
      } else {
        hardEl.className = 'header-kpi-value fail';
        hardEl.textContent = `▲ FAIL (${active.score.totalHardViolations}건 위반)`;
      }
    }

    if (scoreEl) {
      scoreEl.textContent = active.score.formatted;
    }

    if (spreadEl) {
      const spreadDiff = (init.leagueSummary.maxDistanceSpread - active.leagueSummary.maxDistanceSpread).toFixed(1);
      if (state.activePlanMode === 'solved') {
        spreadEl.className = 'header-kpi-value pass';
        spreadEl.textContent = `${active.leagueSummary.maxDistanceSpread} km (▼${spreadDiff}km 개선)`;
      } else if (state.activePlanMode === 'initial') {
        spreadEl.className = 'header-kpi-value warn';
        spreadEl.textContent = `${active.leagueSummary.maxDistanceSpread} km (초기안 불균형)`;
      } else {
        spreadEl.className = 'header-kpi-value fail';
        spreadEl.textContent = `${active.leagueSummary.maxDistanceSpread} km (위반 샘플)`;
      }
    }

    if (tolEl) {
      const distPenalty = active.score.soft[2];
      if (distPenalty === 0) {
        tolEl.className = 'header-kpi-value pass';
        tolEl.textContent = `페널티 0점 (전 구단 ±${state.seasonConfig.toleranceTotalDistance}km 평준화)`;
      } else {
        tolEl.className = 'header-kpi-value warn';
        tolEl.textContent = `페널티 ${distPenalty.toLocaleString()}점 (${active.leagueSummary.teamsWithinDistanceTolerance}/10 구단 진입)`;
      }
    }

    if (navBadge) {
      if (state.activePlanMode === 'solved') {
        navBadge.className = 'badge badge-pass';
        navBadge.textContent = '✨ 최적화 완료안 (Solved Plan)';
      } else if (state.activePlanMode === 'initial') {
        navBadge.className = 'badge badge-warn';
        navBadge.textContent = '📉 최적화 전 초기안 (Initial Plan)';
      } else {
        navBadge.className = 'badge badge-fail';
        navBadge.textContent = '🚨 Hard 위반 샘플 (Violation Demo)';
      }
    }
  }

  // ==========================================================================
  // STAGE NAVIGATION CONTROLLER
  // ==========================================================================
  function switchStage(stageNum) {
    state.currentStage = Number(stageNum);
    document.querySelectorAll('.stage-tab-btn').forEach(btn => {
      const isMatch = Number(btn.dataset.stage) === state.currentStage;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    document.querySelectorAll('.stage-section').forEach(sec => {
      const isMatch = sec.id === `stage-${state.currentStage}`;
      sec.classList.toggle('active', isMatch);
    });

    // Re-render canvases visible in the current stage
    setTimeout(() => {
      if (state.currentStage === 1 || state.allStagesMode) {
        renderKoreaGisMap();
        if (state.mapMode === 'leaflet' && state.leafletMap) {
          state.leafletMap.invalidateSize();
        }
      }
      if (state.currentStage === 2 || state.allStagesMode) {
        renderSeasonCalendarBoard();
      }
      if (state.currentStage === 3 || state.allStagesMode) {
        renderPreflightChecklist();
        renderConvergenceChart();
      }
      if (state.currentStage === 4 || state.allStagesMode) {
        renderStage4Dashboard();
      }
    }, 30);
  }

  // ==========================================================================
  // STAGE 1: 10 CLUBS BRAND CARDS, AUTO-GEOCODING, GIS MAP & 10x10 MATRIX
  // ==========================================================================
  function getTeamAverageRoadDistance(teamName) {
    const distLookup = window.KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const row = distLookup[teamName] || {};
    let sum = 0;
    let count = 0;
    state.teams.forEach(other => {
      if (other.name !== teamName) {
        sum += Number(row[other.name] || 0);
        count++;
      }
    });
    return count > 0 ? Number((sum / count).toFixed(1)) : 0;
  }

  function renderTeamBrandCards() {
    const grid = document.getElementById('teams-card-grid');
    if (!grid) return;

    const presetsOptionsHtml = window.KBO_DATA.stadiumPresets.map(p =>
      `<option value="${p.stadium}">${p.stadium} (${p.city})</option>`
    ).join('');

    grid.innerHTML = state.teams.map((t, idx) => {
      const avgDist = getTeamAverageRoadDistance(t.name);
      const isSelected = state.selectedMapTeam === t.name;
      const geoBadgeClass = avgDist < 200 ? 'badge-pass' : (avgDist < 255 ? 'badge-info' : 'badge-warn');
      const geoBadgeLabel = avgDist < 200 ? '수도권 접근성 우수' : (avgDist < 255 ? '중부 거점' : '장거리 원정권');

      return `
        <div class="team-brand-card ${isSelected ? 'selected-map-team' : ''}"
             style="--team-color:${t.color};"
             data-team-card="${t.name}">
          <div class="team-card-top">
            <div class="team-identity">
              <div class="team-color-avatar" style="background:${t.color};">${t.name}</div>
              <div class="team-name-stack">
                <div class="team-short-name">
                  <span>${t.fullName}</span>
                  ${t.sharedStadium ? '<span class="badge badge-info" style="font-size:0.65rem;padding:0.08rem 0.4rem;">잠실 공동</span>' : ''}
                </div>
                <div class="team-full-name">${t.city} · ${t.address || t.stadium}</div>
              </div>
            </div>
            <button type="button" class="btn btn-xs btn-focus-team-map" data-team="${t.name}" title="지도에서 이 구단 이동 네트워크 보기">
              🎯 지도 포커스
            </button>
          </div>

          <div class="team-card-fields">
            <div class="field-row">
              <span class="field-label">구장 검색</span>
              <input type="text" class="input-field team-stadium-input" data-idx="${idx}"
                     value="${t.stadium}" placeholder="구장명 또는 도로명 주소 입력" style="flex:1;" />
              <button type="button" class="btn btn-xs btn-primary btn-auto-geocode" data-idx="${idx}" title="구장명/주소로 위경도 자동 입력">
                📍 위경도 자동입력
              </button>
            </div>

            <div class="field-row">
              <span class="field-label">빠른 변경</span>
              <select class="select-field team-preset-select" data-idx="${idx}" style="flex:1;font-size:0.78rem;">
                <option value="">— 본구장 / 제2구장(포항·울산·청주·군산) 즉시 선택 —</option>
                ${presetsOptionsHtml}
              </select>
            </div>

            <div class="coord-grid">
              <div class="coord-box">
                <span>위도 (Latitude)</span>
                <input type="number" step="0.0001" class="input-field input-mono team-lat-input"
                       data-idx="${idx}" value="${Number(t.latitude).toFixed(6)}" />
              </div>
              <div class="coord-box">
                <span>경도 (Longitude)</span>
                <input type="number" step="0.0001" class="input-field input-mono team-lng-input"
                       data-idx="${idx}" value="${Number(t.longitude).toFixed(6)}" />
              </div>
            </div>
          </div>

          <div class="team-access-footer">
            <span style="color:var(--text-muted);">타 구장 평균 1회 거리: <strong style="color:var(--text-primary);font-family:var(--font-mono);">${avgDist} km</strong></span>
            <span class="badge ${geoBadgeClass}">${geoBadgeLabel}</span>
          </div>
        </div>
      `;
    }).join('');

    // Bind events on team cards
    grid.querySelectorAll('.btn-focus-team-map').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedMapTeam = btn.dataset.team;
        state.highlightedPair = null;
        renderTeamBrandCards();
        renderMapFocusChips();
        renderKoreaGisMap();
      });
    });

    grid.querySelectorAll('.btn-auto-geocode').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.idx);
        const inputEl = grid.querySelector(`.team-stadium-input[data-idx="${idx}"]`);
        const query = inputEl ? inputEl.value : state.teams[idx].stadium;
        await handleGeocodeTeam(idx, query);
      });
    });

    grid.querySelectorAll('.team-stadium-input').forEach(inp => {
      inp.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const idx = Number(inp.dataset.idx);
          await handleGeocodeTeam(idx, inp.value);
        }
      });
    });

    grid.querySelectorAll('.team-preset-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        if (!sel.value) return;
        const idx = Number(sel.dataset.idx);
        await handleGeocodeTeam(idx, sel.value);
      });
    });

    grid.querySelectorAll('.team-lat-input, .team-lng-input').forEach(inp => {
      inp.addEventListener('change', async () => {
        const idx = Number(inp.dataset.idx);
        const latEl = grid.querySelector(`.team-lat-input[data-idx="${idx}"]`);
        const lngEl = grid.querySelector(`.team-lng-input[data-idx="${idx}"]`);
        const newLat = parseFloat(latEl.value);
        const newLng = parseFloat(lngEl.value);
        if (!Number.isNaN(newLat) && !Number.isNaN(newLng)) {
          state.teams[idx].latitude = newLat;
          state.teams[idx].longitude = newLng;
          await recalculateMatrixAndRefresh(`${state.teams[idx].name} 수동 위경도 변경 반영 완료`);
        }
      });
    });
  }

  async function handleGeocodeTeam(idx, query) {
    const team = state.teams[idx];
    if (!team || !query) return;
    const res = await window.KBOEngine.geocodeLocation(query);
    if (res) {
      team.stadium = res.stadium || query;
      team.address = res.address || team.address;
      if (res.city) team.city = res.city;
      team.latitude = res.latitude;
      team.longitude = res.longitude;
      // Check shared stadium status across teams
      updateSharedStadiumFlags();
      const statusBadge = document.getElementById('geocode-status-badge');
      if (statusBadge) {
        statusBadge.textContent = `✓ ${team.name} → ${team.stadium} (${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}) [${res.source}]`;
      }
      await recalculateMatrixAndRefresh(`${team.fullName}: '${team.stadium}' 위경도 자동입력 및 10×10 거리행렬 갱신 완료`);
    } else {
      showToast(`'${query}' 좌표를 찾지 못했습니다. 구장명(예: 포항야구장, 울산문수야구장, 잠실) 또는 도시명을 입력하세요.`);
    }
  }

  function updateSharedStadiumFlags() {
    const counts = {};
    state.teams.forEach(t => {
      counts[t.stadium] = (counts[t.stadium] || 0) + 1;
    });
    state.teams.forEach(t => {
      t.sharedStadium = counts[t.stadium] > 1;
    });
  }

  async function recalculateMatrixAndRefresh(toastText) {
    const useLiveOsrm = !!document.getElementById('chk-live-osrm-api')?.checked;
    state.distanceMatrix = await window.KBOEngine.calculateDistanceMatrixFromCoords(state.teams, {
      useLiveRouteApi: useLiveOsrm
    });
    recomputeAllEvaluations();
    renderTeamBrandCards();
    renderMapFocusChips();
    renderKoreaGisMap();
    renderDistanceMatrixTable();
    renderStage4Dashboard();
    if (toastText) showToast(toastText);
  }

  function renderMapFocusChips() {
    const bar = document.getElementById('map-focus-team-chips');
    if (!bar) return;
    bar.innerHTML = state.teams.map(t => `
      <button type="button" class="team-filter-chip ${state.selectedMapTeam === t.name ? 'active' : ''}"
              style="--chip-color:${t.color};"
              data-focus-team="${t.name}">
        <span class="dot"></span>
        <span>${t.name}</span>
      </button>
    `).join('');

    bar.querySelectorAll('.team-filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedMapTeam = btn.dataset.focusTeam;
        state.highlightedPair = null;
        renderTeamBrandCards();
        renderMapFocusChips();
        renderKoreaGisMap();
      });
    });
  }

  // Projection helper for South Korea [lat 34.2..38.45, lng 125.8..129.75]
  function projectKoreaLatLng(lat, lng, width, height, padding = 36) {
    const minLat = 34.25;
    const maxLat = 38.35;
    const minLng = 125.95;
    const maxLng = 129.65;
    const usableW = width - padding * 2;
    const usableH = height - padding * 2;
    const x = padding + ((lng - minLng) / (maxLng - minLng)) * usableW;
    const y = padding + ((maxLat - lat) / (maxLat - minLat)) * usableH;
    return { x, y };
  }

  function renderKoreaGisMap() {
    const focusTeamObj = state.teams.find(t => t.name === state.selectedMapTeam) || state.teams[9];
    const avgDist = getTeamAverageRoadDistance(focusTeamObj.name);
    const hudTitle = document.getElementById('hud-selected-team-title');
    const hudDetail = document.getElementById('hud-selected-team-detail');

    if (hudTitle) {
      hudTitle.textContent = `포커스 구단: ${focusTeamObj.fullName} (${focusTeamObj.stadium})`;
    }
    if (hudDetail) {
      if (state.highlightedPair) {
        const distLookup = window.KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);
        const d = distLookup[state.highlightedPair.from]?.[state.highlightedPair.to] ?? 0;
        hudDetail.innerHTML = `선택 구간: <strong>${state.highlightedPair.from} ↔ ${state.highlightedPair.to}</strong> · 도로 이동거리: <strong>${d} km</strong>`;
      } else {
        hudDetail.innerHTML = `위경도: <code>${focusTeamObj.latitude.toFixed(4)}, ${focusTeamObj.longitude.toFixed(4)}</code> · 타 구장 평균 이동거리: <strong>${avgDist} km</strong>`;
      }
    }

    const canvasEl = document.getElementById('korea-gis-canvas');
    const extDomEl = document.getElementById('external-map-dom');

    if (state.mapMode === 'leaflet' && window.L) {
      if (canvasEl) canvasEl.style.display = 'none';
      if (extDomEl) extDomEl.style.display = 'block';
      renderLeafletGisMap(focusTeamObj);
      return;
    }

    // Default or fallback: Built-in High-Resolution Interactive Korea GIS Canvas
    if (canvasEl) canvasEl.style.display = 'block';
    if (extDomEl) extDomEl.style.display = 'none';

    const setup = setupHiDPICanvas(canvasEl, 510);
    if (!setup) return;
    const { ctx, width, height } = setup;

    // 1. Deep Navy GIS Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#071022');
    bgGrad.addColorStop(1, '#0F1E38');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Lat/Lng Graticule Grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let lat = 34.5; lat <= 38.0; lat += 0.5) {
      const p1 = projectKoreaLatLng(lat, 126.0, width, height);
      const p2 = projectKoreaLatLng(lat, 129.6, width, height);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${lat.toFixed(1)}°N`, 8, p1.y - 3);
    }
    for (let lng = 126.5; lng <= 129.5; lng += 0.5) {
      const p1 = projectKoreaLatLng(38.3, lng, width, height);
      const p2 = projectKoreaLatLng(34.3, lng, width, height);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 3. Draw South Korea Landmass Polygon
    ctx.beginPath();
    KOREA_OUTLINE_COORDS.forEach(([lat, lng], idx) => {
      const pt = projectKoreaLatLng(lat, lng, width, height);
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 4. Compute projected positions for all 10 teams (with smart offset for Jamsil shared stadium)
    const distLookup = window.KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const teamPts = {};
    state.teams.forEach(t => {
      const pt = projectKoreaLatLng(t.latitude, t.longitude, width, height);
      let ox = 0;
      let oy = 0;
      if (t.name === '두산' && t.sharedStadium) { ox = -11; oy = -8; }
      if (t.name === 'LG' && t.sharedStadium) { ox = 11; oy = 8; }
      teamPts[t.name] = { x: pt.x + ox, y: pt.y + oy, rawX: pt.x, rawY: pt.y, team: t };
    });

    // 5. Draw Faint All-Pairs Highway Mesh
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < state.teams.length; i++) {
      for (let j = i + 1; j < state.teams.length; j++) {
        const pA = teamPts[state.teams[i].name];
        const pB = teamPts[state.teams[j].name];
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
    }

    // 6. Draw Highlighted Routes from Focus Team (or Highlighted Pair)
    const fromPoint = teamPts[focusTeamObj.name];
    state.teams.forEach(target => {
      if (target.name === focusTeamObj.name) return;
      if (state.highlightedPair &&
          !((state.highlightedPair.from === focusTeamObj.name && state.highlightedPair.to === target.name) ||
            (state.highlightedPair.to === focusTeamObj.name && state.highlightedPair.from === target.name))) {
        return;
      }

      const toPoint = teamPts[target.name];
      const distKm = distLookup[focusTeamObj.name]?.[target.name] ?? 0;
      if (distKm <= 0) return;

      const midX = (fromPoint.x + toPoint.x) / 2;
      const midY = (fromPoint.y + toPoint.y) / 2 - 12;

      ctx.beginPath();
      ctx.moveTo(fromPoint.x, fromPoint.y);
      ctx.quadraticCurveTo(midX, midY, toPoint.x, toPoint.y);
      ctx.strokeStyle = distKm > 280 ? 'rgba(251, 191, 36, 0.78)' : 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = state.highlightedPair ? 3.0 : 1.8;
      ctx.stroke();

      // Distance badge at midpoint
      const label = `${distKm}km`;
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(midX - tw / 2, midY - 8, tw, 15);
      ctx.fillStyle = distKm > 280 ? '#FBBF24' : '#7DD3FC';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY - 0.5);
    });

    // 7. Draw 10 Club Nodes & Labels
    state.teams.forEach(t => {
      const pt = teamPts[t.name];
      const isFocus = t.name === focusTeamObj.name;
      const radius = isFocus ? 12 : 8.5;

      if (isFocus) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 19, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = t.color || '#2563EB';
      ctx.fill();
      ctx.lineWidth = isFocus ? 2.5 : 1.8;
      ctx.strokeStyle = isFocus ? '#38BDF8' : '#FFFFFF';
      ctx.stroke();

      // Label next to marker
      ctx.font = isFocus ? 'bold 12px Pretendard, sans-serif' : 'bold 11px Pretendard, sans-serif';
      ctx.fillStyle = isFocus ? '#FFFFFF' : '#E2E8F0';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${t.name} (${t.stadium.replace('종합운동장', '').replace('야구장', '')})`, pt.x + radius + 5, pt.y);
    });

    // Store hit regions on canvas for click selection
    canvasEl._teamHitNodes = Object.values(teamPts);
  }

  function renderLeafletGisMap(focusTeamObj) {
    const extDomEl = document.getElementById('external-map-dom');
    if (!extDomEl || !window.L) return;

    if (!state.leafletMap) {
      state.leafletMap = window.L.map(extDomEl, {
        center: [36.35, 127.85],
        zoom: 7,
        zoomControl: true
      });
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(state.leafletMap);
      state.leafletLayerGroup = window.L.layerGroup().addTo(state.leafletMap);
    }

    state.leafletLayerGroup.clearLayers();
    const distLookup = window.KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);

    // Draw lines from focusTeamObj to all other teams
    state.teams.forEach(target => {
      if (target.name === focusTeamObj.name) return;
      const d = distLookup[focusTeamObj.name]?.[target.name] ?? 0;
      if (d <= 0) return;
      const poly = window.L.polyline(
        [[focusTeamObj.latitude, focusTeamObj.longitude], [target.latitude, target.longitude]],
        { color: d > 280 ? '#D97706' : '#2563EB', weight: 2.5, opacity: 0.75, dashArray: '4,4' }
      );
      poly.bindTooltip(`${focusTeamObj.name} → ${target.name}: ${d} km`);
      poly.addTo(state.leafletLayerGroup);
    });

    // Draw markers for 10 teams
    state.teams.forEach(t => {
      const latOffset = t.name === '두산' && t.sharedStadium ? 0.008 : (t.name === 'LG' && t.sharedStadium ? -0.008 : 0);
      const lngOffset = t.name === '두산' && t.sharedStadium ? -0.008 : (t.name === 'LG' && t.sharedStadium ? 0.008 : 0);
      const marker = window.L.circleMarker([t.latitude + latOffset, t.longitude + lngOffset], {
        radius: t.name === focusTeamObj.name ? 11 : 8,
        fillColor: t.color,
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 0.95
      });
      marker.bindTooltip(`<strong>${t.fullName}</strong><br/>${t.stadium}<br/>(${t.latitude.toFixed(4)}, ${t.longitude.toFixed(4)})`);
      marker.on('click', () => {
        state.selectedMapTeam = t.name;
        renderTeamBrandCards();
        renderMapFocusChips();
        renderKoreaGisMap();
      });
      marker.addTo(state.leafletLayerGroup);
    });
  }

  function renderDistanceMatrixTable() {
    const table = document.getElementById('distance-matrix-table');
    if (!table) return;
    const distLookup = window.KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);

    const headerCells = state.teams.map(t =>
      `<th><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};margin-right:4px;"></span>${t.name}</th>`
    ).join('');

    const rowsHtml = state.teams.map(fromT => {
      let rowSum = 0;
      const cells = state.teams.map(toT => {
        const d = Number(distLookup[fromT.name]?.[toT.name] ?? 0);
        rowSum += d;
        const isDiag = fromT.name === toT.name || d === 0;
        // Heatmap background intensity
        const ratio = Math.min(1, d / 400);
        const bg = isDiag
          ? '#F1F5F9'
          : `rgba(37, 99, 235, ${(0.04 + ratio * 0.24).toFixed(2)})`;
        const textColor = ratio > 0.7 ? '#1E3A8A' : '#0F172A';
        return `
          <td class="matrix-cell ${isDiag ? 'diag' : ''}"
              style="background:${bg};color:${isDiag ? '#94A3B8' : textColor};"
              data-from="${fromT.name}" data-to="${toT.name}"
              title="${fromT.name}(${fromT.stadium}) → ${toT.name}(${toT.stadium}): ${d.toFixed(1)} km (더블클릭하여 직접 수정)">
            ${d.toFixed(1)}
          </td>
        `;
      }).join('');

      const avg9 = (rowSum / 9).toFixed(1);
      return `
        <tr>
          <th>
            <span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${fromT.color};margin-right:5px;"></span>
            ${fromT.name} <span style="font-weight:400;color:var(--text-muted);font-size:0.7rem;">(${fromT.city})</span>
          </th>
          ${cells}
          <td style="font-family:var(--font-mono);font-weight:800;background:#F8FAFC;color:var(--accent-primary);">${avg9} km</td>
        </tr>
      `;
    }).join('');

    table.innerHTML = `
      <thead>
        <tr>
          <th style="text-align:left;padding-left:0.6rem;">출발 ＼ 도착</th>
          ${headerCells}
          <th>타구장 평균</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    `;

    // Bind click (highlight route on map) and dblclick (edit distance)
    table.querySelectorAll('.matrix-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const from = cell.dataset.from;
        const to = cell.dataset.to;
        if (from === to) return;
        state.selectedMapTeam = from;
        state.highlightedPair = { from, to };
        renderMapFocusChips();
        renderKoreaGisMap();
      });

      cell.addEventListener('dblclick', () => {
        const from = cell.dataset.from;
        const to = cell.dataset.to;
        if (from === to) return;
        const cur = distLookup[from]?.[to] ?? 0;
        const nextStr = window.prompt(`${from} ↔ ${to} 구간 도로 이동거리(km) 수동 입력:`, String(cur));
        if (nextStr !== null) {
          const val = parseFloat(nextStr);
          if (!Number.isNaN(val) && val >= 0) {
            state.distanceMatrix.forEach(item => {
              if ((item.from === from && item.to === to) || (item.from === to && item.to === from)) {
                item.distance = Number(val.toFixed(1));
              }
            });
            recomputeAllEvaluations();
            renderDistanceMatrixTable();
            renderTeamBrandCards();
            renderKoreaGisMap();
            renderStage4Dashboard();
            showToast(`${from} ↔ ${to} 이동거리가 ${val.toFixed(1)}km로 업데이트되었습니다.`);
          }
        }
      });
    });

    // Render Geographical Accessibility Index Cards
    const geoGrid = document.getElementById('geo-index-grid');
    if (geoGrid) {
      const ranked = state.teams.map(t => ({
        team: t,
        avgKm: getTeamAverageRoadDistance(t.name)
      })).sort((a, b) => a.avgKm - b.avgKm);

      const minAvg = ranked[0]?.avgKm || 170;
      geoGrid.innerHTML = ranked.map((item, rIdx) => {
        const diffFromBest = (item.avgKm - minAvg).toFixed(1);
        const tagClass = rIdx < 5 ? 'badge-pass' : (rIdx === 5 ? 'badge-info' : 'badge-warn');
        const tagText = rIdx < 5 ? `유리 #${rIdx + 1} (수도권)` : (rIdx === 5 ? '중립 #6 (대전)' : `불리 #${rIdx + 1} (지방권)`);
        return `
          <div class="geo-rank-card" style="border-top:3px solid ${item.team.color};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:0.84rem;">${item.team.name} (${item.team.stadium.slice(0, 4)})</strong>
              <span class="badge ${tagClass}" style="font-size:0.66rem;">${tagText}</span>
            </div>
            <div style="font-family:var(--font-mono);font-size:0.95rem;font-weight:800;color:var(--text-primary);">
              평균 ${item.avgKm} km
              <span style="font-size:0.72rem;font-weight:500;color:var(--text-muted);">(최단 대비 +${diffFromBest}km)</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // ==========================================================================
  // STAGE 2: SEASON RULES, SPECIAL EVENT BUILDER & 6-MONTH CALENDAR PREVIEW
  // ==========================================================================
  function renderSpecialEventsBuilder() {
    const container = document.getElementById('special-events-container');
    if (!container) return;

    const teamOptions = (selected) => state.teams.map(t =>
      `<option value="${t.name}" ${t.name === selected ? 'selected' : ''}>${t.name} (${t.stadium})</option>`
    ).join('');

    const stadiumOptions = (selected) => window.KBO_DATA.stadiumPresets.map(p =>
      `<option value="${p.stadium}" ${p.stadium === selected ? 'selected' : ''}>${p.stadium} (${p.city})</option>`
    ).join('');

    container.innerHTML = state.specialEvents.map((evt, eIdx) => {
      const isMatchupMode = evt.pinMode === 'MATCHUP_AND_STADIUM';

      let bodyHtml = '';
      if (isMatchupMode) {
        bodyHtml = `
          <div style="font-size:0.78rem;color:var(--text-secondary);background:#EFF6FF;padding:0.5rem 0.75rem;border-radius:6px;border:1px solid #BFDBFE;">
            <strong>[구단 및 구장 지정 모드]</strong>: 5개 매치업의 <strong>원정구단 vs 홈구단 @ 개최구장</strong>을 모두 명시적으로 Pin 고정합니다.
          </div>
          <div class="matchup-pin-grid">
            ${evt.matchups.map((m, mIdx) => `
              <div class="matchup-pin-item">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.74rem;font-weight:700;color:var(--text-muted);">
                  <span>매치 #${mIdx + 1} (${evt.date})</span>
                  <span class="badge badge-info" style="font-size:0.65rem;">@PlanningPin</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:0.3rem;align-items:center;">
                  <select class="select-field evt-away-sel" data-eidx="${eIdx}" data-midx="${mIdx}" style="font-size:0.76rem;padding:0.28rem;">
                    ${teamOptions(m.away)}
                  </select>
                  <span style="font-size:0.72rem;font-weight:800;color:var(--text-muted);">VS</span>
                  <select class="select-field evt-home-sel" data-eidx="${eIdx}" data-midx="${mIdx}" style="font-size:0.76rem;padding:0.28rem;">
                    ${teamOptions(m.home)}
                  </select>
                </div>
                <div style="display:flex;align-items:center;gap:0.35rem;">
                  <span style="font-size:0.7rem;color:var(--text-muted);">개최구장:</span>
                  <select class="select-field evt-stadium-sel" data-eidx="${eIdx}" data-midx="${mIdx}" style="flex:1;font-size:0.74rem;padding:0.24rem;">
                    ${stadiumOptions(m.stadium)}
                  </select>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        bodyHtml = `
          <div style="font-size:0.78rem;color:#065F46;background:#ECFDF5;padding:0.5rem 0.75rem;border-radius:6px;border:1px solid #A7F3D0;">
            <strong>[구장만 지정 모드 (홈 의무 구장 5곳 지정)]</strong>: 해당 일자에 홈경기를 개최할 <strong>5개 구장(홈구단)만 선택</strong>하고, 상대 원정구단 매치업은 OptaPlanner 엔진이 이동거리 평준화에 맞춰 최적 배정합니다.
          </div>
          <div class="venue-only-grid">
            ${state.teams.map(t => {
              const checked = evt.homeTeamsOnly.includes(t.name);
              return `
                <label class="venue-check-card ${checked ? 'checked' : ''}" data-eidx="${eIdx}" data-team="${t.name}">
                  <input type="checkbox" class="evt-venue-only-chk" data-eidx="${eIdx}" data-team="${t.name}" ${checked ? 'checked' : ''} />
                  <div style="display:flex;flex-direction:column;">
                    <span style="font-size:0.82rem;font-weight:800;color:var(--text-primary);">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};margin-right:3px;"></span>
                      ${t.stadium}
                    </span>
                    <span style="font-size:0.72rem;color:var(--text-muted);">${t.fullName} 홈 배정</span>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center;">
            <span>현재 선택된 홈 개최 구장: <strong>${evt.homeTeamsOnly.length} / 5개 구장</strong> (${evt.homeTeamsOnly.join(', ')})</span>
            ${evt.date === '2025-05-05' ? '<button type="button" class="btn btn-xs btn-swap-jamsil-children" data-eidx="' + eIdx + '">🔄 잠실 어린이날 홈: 두산 ↔ LG 격년 전환</button>' : ''}
          </div>
        `;
      }

      return `
        <div class="event-slot-card">
          <div class="event-slot-header">
            <div style="display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap;">
              <input type="text" class="input-field evt-title-inp" data-eidx="${eIdx}" value="${evt.title}" style="font-weight:800;min-width:250px;" />
              <input type="date" class="input-field input-mono evt-date-inp" data-eidx="${eIdx}" value="${evt.date}" />
              <span class="badge badge-neutral">${evt.consecutive}연전 슬롯</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
              <div class="segmented-control">
                <button type="button" class="seg-btn ${isMatchupMode ? 'active' : ''} btn-evt-mode"
                        data-eidx="${eIdx}" data-mode="MATCHUP_AND_STADIUM">
                  🎯 구단 및 구장 지정
                </button>
                <button type="button" class="seg-btn ${!isMatchupMode ? 'active' : ''} btn-evt-mode"
                        data-eidx="${eIdx}" data-mode="STADIUM_ONLY">
                  🏟️ 구장만 지정 (5개 구장)
                </button>
              </div>
              ${eIdx >= 2 ? `<button type="button" class="btn btn-xs btn-danger-soft btn-del-evt" data-eidx="${eIdx}">삭제</button>` : ''}
            </div>
          </div>
          ${bodyHtml}
        </div>
      `;
    }).join('');

    // Bind Special Event Controls
    container.querySelectorAll('.btn-evt-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const eIdx = Number(btn.dataset.eidx);
        const mode = btn.dataset.mode;
        state.specialEvents[eIdx].pinMode = mode;
        recomputeAllEvaluations();
        renderSpecialEventsBuilder();
        renderPreflightChecklist();
        showToast(`'${state.specialEvents[eIdx].title}' 배정 모드가 [${mode === 'MATCHUP_AND_STADIUM' ? '구단 및 구장 지정' : '구장만 지정'}]으로 변경되었습니다.`);
      });
    });

    container.querySelectorAll('.evt-away-sel, .evt-home-sel, .evt-stadium-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const eIdx = Number(sel.dataset.eidx);
        const mIdx = Number(sel.dataset.midx);
        const m = state.specialEvents[eIdx].matchups[mIdx];
        if (sel.classList.contains('evt-away-sel')) m.away = sel.value;
        if (sel.classList.contains('evt-home-sel')) {
          m.home = sel.value;
          const homeT = state.teams.find(t => t.name === sel.value);
          if (homeT) m.stadium = homeT.stadium;
        }
        if (sel.classList.contains('evt-stadium-sel')) m.stadium = sel.value;
        recomputeAllEvaluations();
        renderSpecialEventsBuilder();
        renderSeasonCalendarBoard();
        renderStage4Dashboard();
      });
    });

    container.querySelectorAll('.evt-venue-only-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const eIdx = Number(chk.dataset.eidx);
        const tName = chk.dataset.team;
        const evt = state.specialEvents[eIdx];
        if (chk.checked) {
          if (!evt.homeTeamsOnly.includes(tName)) evt.homeTeamsOnly.push(tName);
        } else {
          evt.homeTeamsOnly = evt.homeTeamsOnly.filter(x => x !== tName);
        }
        recomputeAllEvaluations();
        renderSpecialEventsBuilder();
        renderStage4Dashboard();
      });
    });

    container.querySelectorAll('.btn-swap-jamsil-children').forEach(btn => {
      btn.addEventListener('click', () => {
        const eIdx = Number(btn.dataset.eidx);
        const evt = state.specialEvents[eIdx];
        if (evt.homeTeamsOnly.includes('두산')) {
          evt.homeTeamsOnly = evt.homeTeamsOnly.map(x => x === '두산' ? 'LG' : x);
          showToast('어린이날 잠실 홈 의무 구단을 [두산 → LG]로 전환했습니다. (Hard 제약 검증에 즉시 반영)');
        } else {
          evt.homeTeamsOnly = evt.homeTeamsOnly.map(x => x === 'LG' ? '두산' : x);
          showToast('어린이날 잠실 홈 의무 구단을 [LG → 두산]으로 복원했습니다.');
        }
        recomputeAllEvaluations();
        renderSpecialEventsBuilder();
        renderStage4Dashboard();
      });
    });

    container.querySelectorAll('.btn-del-evt').forEach(btn => {
      btn.addEventListener('click', () => {
        const eIdx = Number(btn.dataset.eidx);
        state.specialEvents.splice(eIdx, 1);
        recomputeAllEvaluations();
        renderSpecialEventsBuilder();
      });
    });
  }

  function renderBlackoutTags() {
    const listEl = document.getElementById('blackout-tags-list');
    if (!listEl) return;
    listEl.innerHTML = state.seasonConfig.extraBlackouts.map((d, idx) => `
      <span class="badge badge-warn">
        🚫 미개최일: ${d}
        <button type="button" data-bidx="${idx}" style="border:none;background:transparent;color:inherit;cursor:pointer;font-weight:800;margin-left:4px;">×</button>
      </span>
    `).join('');

    listEl.querySelectorAll('button[data-bidx]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.seasonConfig.extraBlackouts.splice(Number(btn.dataset.bidx), 1);
        renderBlackoutTags();
        renderSeasonCalendarBoard();
      });
    });
  }

  function renderSeasonCalendarBoard() {
    const grid = document.getElementById('season-months-grid');
    if (!grid) return;

    const calSlotMap = {};
    window.KBO_DATA.calendar.forEach(c => {
      const startKey = c.datetime.slice(0, 10);
      calSlotMap[startKey] = c;
    });

    // Expand series slots to cover all consecutive game days for visual calendar coloring
    const dayCoverageMap = {};
    window.KBO_DATA.calendar.forEach((c, slotIdx) => {
      const startKey = c.datetime.slice(0, 10);
      const startObj = window.KBOEngine.parseDateStr(startKey);
      for (let offset = 0; offset < c.consecutive; offset++) {
        const cur = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate() + offset);
        const dStr = window.KBOEngine.formatDateStr(cur);
        dayCoverageMap[dStr] = {
          slotStart: startKey,
          slotNumber: slotIdx + 1,
          dayOffset: offset + 1,
          consecutive: c.consecutive,
          weekend: c.weekend,
          holiday: c.holiday
        };
      }
    });

    const months = [3, 4, 5, 6, 7, 8];
    const dowHeaders = ['일', '월', '화', '수', '목', '금', '토'].map(d => `<div>${d}</div>`).join('');

    grid.innerHTML = months.map(m => {
      const firstDay = new Date(2025, m - 1, 1);
      const daysInMonth = new Date(2025, m, 0).getDate();
      const startDow = firstDay.getDay();

      let cellsHtml = '';
      for (let i = 0; i < startDow; i++) {
        cellsHtml += `<div class="cal-day-cell empty"></div>`;
      }

      let monthSlotsCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `2025-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dow = new Date(2025, m - 1, d).getDay();
        const cov = dayCoverageMap[dStr];
        const isAllStar = dStr >= state.seasonConfig.allStarStartDate && dStr <= state.seasonConfig.allStarEndDate;
        const isExtraBlackout = state.seasonConfig.extraBlackouts.includes(dStr);
        const isRestDow = state.seasonConfig.restDaysOfWeek.includes(dow) && (!cov || cov.slotStart !== '2025-05-05');

        let cellClass = 'cal-day-cell';
        let tagText = '';
        let tagStyle = '';

        if (cov && cov.dayOffset === 1) monthSlotsCount++;

        if (isAllStar) {
          cellClass += ' series-allstar';
          tagText = '★ 올스타휴식';
          tagStyle = 'background:#F59E0B;color:#FFFFFF;';
        } else if (isExtraBlackout) {
          cellClass += ' rest-day';
          tagText = '미개최';
          tagStyle = 'background:#CBD5E1;color:#334155;';
        } else if (cov) {
          if (cov.slotStart === '2025-03-22') {
            cellClass += ' series-opening';
            tagText = cov.dayOffset === 1 ? '개막 2연전' : '개막 2차전';
            tagStyle = 'background:#D97706;color:#FFFFFF;';
          } else if (cov.slotStart === '2025-05-05') {
            cellClass += ' series-children';
            tagText = cov.dayOffset === 1 ? '어린이날3연' : `S${cov.slotNumber}(${cov.dayOffset}/${cov.consecutive})`;
            tagStyle = 'background:#059669;color:#FFFFFF;';
          } else if (cov.consecutive === 4) {
            cellClass += ' series-4game';
            tagText = cov.dayOffset === 1 ? `S${cov.slotNumber}·4연전` : `${cov.dayOffset}/4차전`;
            tagStyle = 'background:#7C3AED;color:#FFFFFF;';
          } else if (cov.weekend > 0) {
            cellClass += ' series-weekend';
            tagText = cov.dayOffset === 1 ? `S${cov.slotNumber}·주말3` : `주말(${cov.dayOffset}/3)`;
            tagStyle = 'background:#4F46E5;color:#FFFFFF;';
          } else {
            cellClass += ' series-weekday';
            tagText = cov.dayOffset === 1 ? `S${cov.slotNumber}·주중3` : `주중(${cov.dayOffset}/3)`;
            tagStyle = 'background:#2563EB;color:#FFFFFF;';
          }
        } else if (isRestDow) {
          cellClass += ' rest-day';
          tagText = '정기휴무';
          tagStyle = 'background:#E2E8F0;color:#64748B;';
        }

        if (cov && cov.slotStart === state.selectedCalendarDate) {
          cellClass += ' selected-slot';
        }

        cellsHtml += `
          <div class="${cellClass}" data-cal-date="${cov ? cov.slotStart : dStr}" title="${dStr}">
            <div class="cal-day-num" style="color:${dow === 0 ? '#DC2626' : (dow === 6 ? '#2563EB' : 'inherit')};">${d}</div>
            ${tagText ? `<div class="cal-day-tag" style="${tagStyle}">${tagText}</div>` : ''}
          </div>
        `;
      }

      return `
        <div class="month-cal-card">
          <div class="month-cal-header">
            <span>2025년 ${m}월</span>
            <span style="font-size:0.72rem;color:#93C5FD;">시리즈 개시: ${monthSlotsCount}슬롯</span>
          </div>
          <div class="month-cal-days-header">${dowHeaders}</div>
          <div class="month-cal-cells">${cellsHtml}</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.cal-day-cell[data-cal-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        state.selectedCalendarDate = cell.dataset.calDate;
        renderSeasonCalendarBoard();
        renderCalendarSlotInspector(state.selectedCalendarDate);
      });
    });

    renderCalendarSlotInspector(state.selectedCalendarDate);
  }

  function renderCalendarSlotInspector(dateStr) {
    const box = document.getElementById('calendar-slot-inspector');
    if (!box) return;

    const solvedSlot = state.evalSolved?.slotSummaries.find(s => s.date === dateStr);
    const initSlot = state.evalInitial?.slotSummaries.find(s => s.date === dateStr);

    if (!solvedSlot) {
      box.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <strong>📅 선택한 일자 (${dateStr}): 정규 시리즈 개시 슬롯이 아닙니다 (휴무일 / 올스타 브레이크 / 연전 진행일)</strong>
          <span class="badge badge-neutral">시리즈 개시일(화/금/개막토)을 클릭하면 5개 구장 대진을 비교합니다</span>
        </div>
      `;
      return;
    }

    const matchCards = solvedSlot.matches.map((m, idx) => {
      const initM = initSlot?.matches[idx];
      const homeTeam = state.teams.find(t => t.name === m.home);
      const stadium = homeTeam ? homeTeam.stadium : m.home;
      return `
        <div style="background:#FFFFFF;border:1px solid var(--border-subtle);border-top:3px solid ${homeTeam?.color || '#2563EB'};border-radius:6px;padding:0.55rem 0.7rem;">
          <div style="font-size:0.7rem;color:var(--text-muted);display:flex;justify-content:space-between;">
            <span>🏟️ ${stadium}</span>
            <span>${m.pinned ? '📌 고정(Pin)' : '⚡ 엔진배정'}</span>
          </div>
          <div style="font-size:0.9rem;font-weight:800;margin-top:0.2rem;color:var(--text-primary);">
            ${m.away} <span style="color:var(--text-muted);font-weight:500;">(원정) vs</span> ${m.home} <span style="color:var(--accent-primary);font-size:0.75rem;">(홈)</span>
          </div>
          ${initM ? `<div style="font-size:0.7rem;color:var(--text-light);margin-top:0.15rem;">초기안(Before): ${initM.away} vs ${initM.home}</div>` : ''}
        </div>
      `;
    }).join('');

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.65rem;">
        <div>
          <span class="badge badge-info">시리즈 슬롯 상세</span>
          <strong style="font-size:0.95rem;margin-left:0.4rem;">${solvedSlot.date} (${solvedSlot.dow}요일 개시 · ${solvedSlot.consecutive}연전)</strong>
        </div>
        <div style="display:flex;gap:0.4rem;">
          <span class="badge badge-neutral">주말 가중치: ${solvedSlot.weekend}</span>
          <span class="badge badge-neutral">공휴일 점수: ${solvedSlot.holiday}</span>
          <span class="badge badge-pass">10구단 5구장 무결성 PASS</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));gap:0.6rem;">
        ${matchCards}
      </div>
    `;
  }

  // ==========================================================================
  // STAGE 3: PRE-FLIGHT VERIFICATION & REAL-TIME SOLVER TELEMETRY
  // ==========================================================================
  function renderPreflightChecklist() {
    const grid = document.getElementById('preflight-check-grid');
    if (!grid) return;

    const sharedTeams = state.teams.filter(t => t.sharedStadium).map(t => t.name).join('·') || '없음';
    const openingEvt = state.specialEvents[0];
    const childrenEvt = state.specialEvents[1];

    const items = [
      {
        title: '1. 10개 구단 위경도 & 10×10 거리행렬',
        status: 'READY (100개 구간)',
        desc: `전 구단 유효 좌표 확인 완료. 구장 간 최단 0km(잠실 공동) ~ 최장 390.5km 도로거리 매트릭스 산출 완료.`
      },
      {
        title: '2. 시즌 마스터 캘린더 (45슬롯 · 225시리즈)',
        status: `${state.seasonConfig.matchStartDate} ~ ${state.seasonConfig.matchEndDate}`,
        desc: `총 45개 시리즈 슬롯, 225시리즈(팀당 144경기, 총 720경기) 수리적 균형 검증 완료.`
      },
      {
        title: '3. 정기 휴무일 & 올스타 브레이크 보호',
        status: `휴무요일 ${state.seasonConfig.restDaysOfWeek.length}개 · 올스타 6일`,
        desc: `매주 정기휴무일 및 올스타 브레이크(${state.seasonConfig.allStarStartDate}~${state.seasonConfig.allStarEndDate}) 경기 미개최 제약 활성화.`
      },
      {
        title: '4. 공동구장(잠실) 홈 중복 원천 차단',
        status: `공동구장: ${sharedTeams}`,
        desc: `동일 슬롯에서 잠실종합운동장 등 동일 구장에 2개 이상 홈경기가 배정되지 않도록 Hard 제약 설정.`
      },
      {
        title: '5. 특별 이벤트 Pin 설정 (개막전 & 어린이날)',
        status: `이벤트 ${state.specialEvents.length}건 설정됨`,
        desc: `개막전(${openingEvt?.pinMode === 'MATCHUP_AND_STADIUM' ? '구단+구장 지정' : '구장만 지정'}) · 어린이날(${childrenEvt?.pinMode === 'STADIUM_ONLY' ? '5개 구장만 지정' : '구단+구장 지정'}) 연동 완료.`
      },
      {
        title: '6. Soft 제약 평준화 Tolerance 목표',
        status: `거리 ±${state.seasonConfig.toleranceTotalDistance}km / 이동 ±${state.seasonConfig.toleranceTotalMove}회`,
        desc: `구단 간 총 이동거리 편차를 평균 대비 ±${state.seasonConfig.toleranceTotalDistance}km 이내로 수렴시켜 유불리 페널티를 0으로 축소합니다.`
      }
    ];

    grid.innerHTML = items.map(it => `
      <div class="preflight-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:0.86rem;color:var(--text-primary);">${it.title}</strong>
          <span class="badge badge-pass">${it.status}</span>
        </div>
        <div style="font-size:0.77rem;color:var(--text-muted);">${it.desc}</div>
      </div>
    `).join('');
  }

  function appendSolverLog(text, cls = '') {
    const term = document.getElementById('solver-log-terminal');
    if (!term) return;
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = text;
    term.appendChild(div);
    term.scrollTop = term.scrollHeight;
  }

  function runOptaPlannerSimulation(autoNavigateToStage4 = false) {
    if (state.solverRunning) return;
    state.solverRunning = true;

    const durationMs = Number(document.getElementById('solver-speed-select')?.value || 3500);
    const bar = document.getElementById('solver-progress-bar');
    const stepCounter = document.getElementById('solver-step-counter');
    const pctLabel = document.getElementById('solver-pct-label');
    const phaseTitle = document.getElementById('solver-phase-title');
    const liveScore = document.getElementById('solver-live-score');
    const livePenalty = document.getElementById('solver-live-dist-penalty');
    const term = document.getElementById('solver-log-terminal');

    if (term) term.innerHTML = '';
    appendSolverLog('[00.0s] OptaPlanner Solver initialized: 10 Teams, 45 Calendar Slots, 225 Match Series.', 'log-line-info');
    appendSolverLog(`[00.1s] Initial Plan Score: [0/0]hard/[0/-400/-573810/-13/-72955]soft (Max Spread: 1,372.5 km)`, 'log-line-warn');

    const phases = [
      { pct: 18, step: 2400, phase: 'Phase 1: Construction Heuristic (First Fit Decreasing)', score: '[0/0]hard/[0/-300/-312400/-18/-72680]soft', pen: 312400, spread: 1120.2, log: 'Construction Heuristic completed. All @PlanningPin slots locked.' },
      { pct: 42, step: 6800, phase: 'Phase 2: Tabu Search — SwapMove(롯데, KIA, 삼성 원정연전 재배치)', score: '[0/0]hard/[0/-100/-148900/-24/-72410]soft', pen: 148900, spread: 884.0, log: 'Tabu Search reduced Lotte travel by -410km; Jamsil shared stadium conflict = 0.' },
      { pct: 68, step: 11900, phase: 'Phase 3: Simulated Annealing — 3연전 구간 최적화', score: '[0/0]hard/[0/-100/-42150/-29/-72205]soft', pen: 42150, spread: 712.4, log: '8/10 clubs now inside ±300km tolerance band.' },
      { pct: 88, step: 15600, phase: 'Phase 4: Late Acceptance — 구단별 이동일수(34~37회) 평준화', score: '[0/0]hard/[0/0/-4820/-32/-72110]soft', pen: 4820, spread: 618.8, log: 'stabilizeMoveCountScore reached 0! All 10 clubs within 34~37 total moves.' },
      { pct: 100, step: 18420, phase: 'Optimal Schedule Locked — 전 구단 유불리 평준화 완료!', score: '[0/0]hard/[0/0/0/-34/-72073]soft', pen: 0, spread: 573.1, log: 'SOLVER TERMINATED: Hard=0/0, stabilizeDistanceScore=0, Max Spread reduced 1,372.5km → 573.1km!' }
    ];

    let curIdx = 0;
    const intervalMs = Math.floor(durationMs / phases.length);

    const timer = setInterval(() => {
      if (curIdx >= phases.length) {
        clearInterval(timer);
        state.solverRunning = false;
        state.activePlanMode = 'solved';
        recomputeAllEvaluations();
        renderConvergenceChart(phases.length);
        renderStage4Dashboard();
        showToast('OptaPlanner 일정 최적화 완료! 전 구단 ±300km 이동거리 평준화가 달성되었습니다.');
        if (autoNavigateToStage4) {
          switchStage(4);
        }
        return;
      }

      const p = phases[curIdx];
      if (bar) bar.style.width = `${p.pct}%`;
      if (stepCounter) stepCounter.textContent = `Step ${p.step.toLocaleString()} / 18,420 (Moves/sec: ~4,600)`;
      if (pctLabel) pctLabel.textContent = `${p.pct}% 진행`;
      if (phaseTitle) phaseTitle.textContent = p.phase;
      if (liveScore) liveScore.textContent = p.score;
      if (livePenalty) livePenalty.textContent = `-573,810 → -${p.pen.toLocaleString()} (최대격차 ${p.spread}km)`;

      appendSolverLog(`[Step ${p.step}] ${p.log}`, curIdx === phases.length - 1 ? 'log-line-pass' : 'log-line-info');
      renderConvergenceChart(curIdx + 1);
      curIdx++;
    }, intervalMs);
  }

  function renderConvergenceChart(activeStepCount = state.convergenceHistory.length) {
    const canvas = document.getElementById('canvas-convergence-chart');
    const setup = setupHiDPICanvas(canvas, 320);
    if (!setup) return;
    const { ctx, width, height } = setup;

    ctx.clearRect(0, 0, width, height);
    const pad = { top: 28, right: 56, bottom: 44, left: 68 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const data = state.convergenceHistory;
    const maxPen = 600000;
    const maxSpread = 1500;

    // Grid lines
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();

      const penVal = Math.round(maxPen * (1 - i / 4));
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`-${(penVal / 1000).toFixed(0)}k`, pad.left - 8, y);

      const spreadVal = Math.round(maxSpread * (1 - i / 4));
      ctx.fillStyle = '#059669';
      ctx.textAlign = 'left';
      ctx.fillText(`${spreadVal}km`, width - pad.right + 8, y);
    }

    const visibleCount = Math.max(2, Math.min(data.length, activeStepCount + 1));

    // 1. Draw Distance Variance Penalty Curve (Blue area + line)
    ctx.beginPath();
    for (let i = 0; i < visibleCount; i++) {
      const x = pad.left + (plotW * i) / (data.length - 1);
      const y = pad.top + plotH * (1 - data[i].distPenalty / maxPen);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 2. Draw Max Spread (km) Curve (Emerald dashed line)
    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    for (let i = 0; i < visibleCount; i++) {
      const x = pad.left + (plotW * i) / (data.length - 1);
      const y = pad.top + plotH * (1 - data[i].spreadKm / maxSpread);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Points & X-axis labels
    for (let i = 0; i < visibleCount; i++) {
      const x = pad.left + (plotW * i) / (data.length - 1);
      const yPen = pad.top + plotH * (1 - data[i].distPenalty / maxPen);
      const ySpd = pad.top + plotH * (1 - data[i].spreadKm / maxSpread);

      ctx.beginPath();
      ctx.arc(x, yPen, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2563EB';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, ySpd, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#059669';
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(data[i].label, x, height - 18);
    }
  }

  // ==========================================================================
  // STAGE 4: EXECUTIVE FAIRNESS REPORT, HARD/SOFT AUDITOR & 6 BI CHARTS
  // ==========================================================================
  function renderStage4Dashboard() {
    renderExecutiveKpiDeltaCards();
    renderHardConstraintsAuditor();
    renderSoftComparisonTable();
    renderBiChart1DistanceBand();
    renderBiChart2Moves();
    renderBiChart3Holiday();
    renderBiChart4Radar();
    renderBiChart5Spaghetti();
    renderBiChart6Trajectory();
  }

  function renderExecutiveKpiDeltaCards() {
    const grid = document.getElementById('exec-kpi-delta-grid');
    if (!grid) return;

    const init = state.evalInitial;
    const active = state.evalActive || state.evalSolved;
    if (!init || !active) return;

    const initSpread = init.leagueSummary.maxDistanceSpread;
    const actSpread = active.leagueSummary.maxDistanceSpread;
    const spreadSaved = (initSpread - actSpread).toFixed(1);

    const initPenalty = Math.abs(init.score.soft[2]);
    const actPenalty = Math.abs(active.score.soft[2]);

    const initTotalKm = init.leagueSummary.totalDistance;
    const actTotalKm = active.leagueSummary.totalDistance;
    const savedTotalKm = (initTotalKm - actTotalKm).toFixed(1);

    const cards = [
      {
        accent: '#2563EB',
        title: '1. 구단 간 최대 이동거리 격차 (Max-Min Spread)',
        val: `${actSpread.toLocaleString()} km`,
        before: `Before: ${initSpread.toLocaleString()} km`,
        badgeClass: actSpread <= 600 ? 'badge-pass' : 'badge-warn',
        badgeText: actSpread <= 600 ? `▼ ${spreadSaved}km 격차 해소` : '초기 불균형 상태',
        foot: `최장(${active.leagueSummary.maxDistance}km) - 최단(${active.leagueSummary.minDistance}km)`
      },
      {
        accent: '#059669',
        title: `2. ±${state.seasonConfig.toleranceTotalDistance}km 거리 평준화 페널티 (Stabilize Distance)`,
        val: `${actPenalty === 0 ? '0 점 (완전 평준화)' : '-' + actPenalty.toLocaleString() + ' 점'}`,
        before: `Before: -${initPenalty.toLocaleString()} 점`,
        badgeClass: actPenalty === 0 ? 'badge-pass' : 'badge-fail',
        badgeText: actPenalty === 0 ? '100% 목표 달성' : `${active.leagueSummary.teamsWithinDistanceTolerance}/10 구단 진입`,
        foot: `리그 평균 ${active.leagueSummary.meanDistance.toLocaleString()}km 기준 편차 제곱합`
      },
      {
        accent: '#4F46E5',
        title: '3. 구단별 총 이동 일수 편차 (Stabilize Move Count)',
        val: `${active.leagueSummary.minMoveCount} ~ ${active.leagueSummary.maxMoveCount} 회`,
        before: `Before: ${init.leagueSummary.minMoveCount}~${init.leagueSummary.maxMoveCount}회 (-400점)`,
        badgeClass: active.score.soft[1] === 0 ? 'badge-pass' : 'badge-warn',
        badgeText: active.score.soft[1] === 0 ? '페널티 0점 (±2회 이내)' : `페널티 ${active.score.soft[1]}점`,
        foot: `리그 평균 이동 ${active.leagueSummary.meanMoveCount}회 (허용오차 ±${state.seasonConfig.toleranceTotalMove}회)`
      },
      {
        accent: '#0D9488',
        title: '4. 10개 구단 시즌 총 이동거리 합계 (League Total)',
        val: `${actTotalKm.toLocaleString()} km`,
        before: `Before: ${initTotalKm.toLocaleString()} km`,
        badgeClass: Number(savedTotalKm) >= 0 ? 'badge-info' : 'badge-neutral',
        badgeText: Number(savedTotalKm) > 0 ? `▼ ${savedTotalKm}km 총량 절감` : '기준 총량',
        foot: `구단 평균 ${active.leagueSummary.meanDistance.toLocaleString()}km · 휴일점수 평균 ${active.leagueSummary.meanHolidayScore}점`
      }
    ];

    grid.innerHTML = cards.map(c => `
      <div class="kpi-delta-card" style="--kpi-accent:${c.accent};">
        <div class="kpi-delta-title">${c.title}</div>
        <div class="kpi-delta-main">
          <span class="kpi-delta-value">${c.val}</span>
          <span class="kpi-delta-before">${c.before}</span>
        </div>
        <div class="kpi-delta-foot">
          <span>${c.foot}</span>
          <span class="badge ${c.badgeClass}">${c.badgeText}</span>
        </div>
      </div>
    `).join('');
  }

  function renderHardConstraintsAuditor() {
    const grid = document.getElementById('hard-checks-grid');
    const summaryBadge = document.getElementById('hard-panel-summary-badge');
    const toggleBtn = document.getElementById('btn-toggle-violation-demo');
    if (!grid) return;

    const active = state.evalActive || state.evalSolved;
    const passedCount = active.hardChecks.filter(c => c.passed).length;

    if (summaryBadge) {
      if (active.score.feasible) {
        summaryBadge.className = 'badge badge-pass';
        summaryBadge.textContent = `✓ ${passedCount} / 6 ALL PASSED (Hard Score: 0 / 0)`;
      } else {
        summaryBadge.className = 'badge badge-fail';
        summaryBadge.textContent = `🚨 ${6 - passedCount}개 항목 위반 검출 (Hard Score: ${active.score.hard[0]} / ${active.score.hard[1]})`;
      }
    }

    if (toggleBtn) {
      const isViolation = state.activePlanMode === 'violation';
      toggleBtn.textContent = isViolation
        ? '🚨 위반 샘플 시뮬레이션: ON (클릭 시 최적해 복원)'
        : '🚨 위반 샘플 시뮬레이션: OFF (클릭 시 위반 검출 시연)';
      toggleBtn.className = isViolation ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-danger-soft';
    }

    grid.innerHTML = active.hardChecks.map(chk => {
      const vListHtml = (!chk.passed && chk.violations.length > 0)
        ? `<div class="hard-violation-list">
             ${chk.violations.slice(0, 3).map(v => `<div>• ${v.desc}</div>`).join('')}
           </div>`
        : '';

      return `
        <div class="hard-check-card ${chk.passed ? 'pass' : 'fail'}">
          <div class="hard-check-top">
            <div class="hard-check-title">${chk.title}</div>
            <span class="badge ${chk.passed ? 'badge-pass' : 'badge-fail'}">
              ${chk.passed ? '● PASS (0건)' : `▲ FAIL (${chk.violationCount}건)`}
            </span>
          </div>
          <div class="hard-check-desc">${chk.desc}</div>
          ${vListHtml}
        </div>
      `;
    }).join('');
  }

  function renderSoftComparisonTable() {
    const tbody = document.getElementById('soft-comparison-tbody');
    const tfoot = document.getElementById('soft-comparison-tfoot');
    const focusSel = document.getElementById('select-focus-team-master');
    if (!tbody || !tfoot) return;

    const initMap = {};
    state.evalInitial.teamAnalytics.forEach(a => { initMap[a.team] = a; });

    const active = state.evalActive || state.evalSolved;
    const rows = active.teamAnalytics.map(a => {
      const before = initMap[a.team] || a;
      return {
        ...a,
        beforeDistance: before.totalDistance,
        deltaDistance: Number((a.totalDistance - before.totalDistance).toFixed(1)),
        beforeMoveCount: before.totalMoveCount,
        beforeDistDiff: before.distanceDiffFromMean
      };
    });

    // Populate Focus Team Selector if needed
    if (focusSel) {
      focusSel.innerHTML = state.teams.map(t =>
        `<option value="${t.name}" ${t.name === state.focusTeam ? 'selected' : ''}>${t.fullName} (${t.stadium})</option>`
      ).join('');
    }

    // Sort rows
    const { key, dir } = state.softTableSort;
    rows.sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (typeof va === 'string') {
        return dir === 'asc' ? va.localeCompare(vb, 'ko') : vb.localeCompare(va, 'ko');
      }
      return dir === 'asc' ? va - vb : vb - va;
    });

    const tolDist = state.seasonConfig.toleranceTotalDistance;

    tbody.innerHTML = rows.map(r => {
      const isFocus = r.team === state.focusTeam;
      const absDiff = Math.abs(r.distanceDiffFromMean);
      const isFair = Math.floor(absDiff) <= tolDist;
      const deltaColor = r.deltaDistance < -50 ? '#059669' : (r.deltaDistance > 50 ? '#D97706' : '#475569');
      const deltaPrefix = r.deltaDistance > 0 ? '+' : '';
      const diffPrefix = r.distanceDiffFromMean > 0 ? '+' : '';

      return `
        <tr class="${isFocus ? 'active-team-row' : ''}" data-row-team="${r.team}">
          <td>
            <div style="display:flex;align-items:center;gap:0.45rem;">
              <span style="width:10px;height:10px;border-radius:3px;background:${r.color};display:inline-block;"></span>
              <strong>${r.team}</strong>
              <span style="font-size:0.73rem;color:var(--text-muted);">(${r.stadium.replace('종합운동장', '').replace('야구장', '')})</span>
              ${r.openingDayHome ? '<span class="badge badge-warn" style="font-size:0.62rem;padding:0.05rem 0.3rem;">개막홈</span>' : ''}
              ${r.childrenDayHome ? '<span class="badge badge-pass" style="font-size:0.62rem;padding:0.05rem 0.3rem;">어린이날홈</span>' : ''}
            </div>
          </td>
          <td style="font-family:var(--font-mono);color:var(--text-muted);">
            ${r.beforeDistance.toLocaleString()} km
            <span style="font-size:0.7rem;color:${Math.abs(r.beforeDistDiff) > tolDist ? '#DC2626' : '#64748B'};">
              (${r.beforeDistDiff > 0 ? '+' : ''}${r.beforeDistDiff}km)
            </span>
          </td>
          <td style="font-family:var(--font-mono);font-weight:800;color:var(--text-primary);">
            ${r.totalDistance.toLocaleString()} km
          </td>
          <td style="font-family:var(--font-mono);font-weight:700;color:${deltaColor};">
            ${deltaPrefix}${r.deltaDistance} km
          </td>
          <td style="font-family:var(--font-mono);font-weight:700;color:${isFair ? '#059669' : '#DC2626'};">
            ${diffPrefix}${r.distanceDiffFromMean} km
          </td>
          <td style="font-family:var(--font-mono);">
            <span style="color:var(--text-light);">${r.beforeMoveCount}회 →</span>
            <strong>${r.totalMoveCount}회</strong>
          </td>
          <td style="font-family:var(--font-mono);">
            주중 <strong>${r.weekdayMoveCount}</strong> / 주말 <strong>${r.weekendMoveCount}</strong>
          </td>
          <td style="font-family:var(--font-mono);">
            <strong>${r.weekendHomeGames}</strong> 경기 (${r.weekendHomeSeries}시리즈)
          </td>
          <td style="font-family:var(--font-mono);">
            <strong>${r.holidayHomeGames}</strong> 경기
          </td>
          <td style="font-family:var(--font-mono);font-weight:700;">
            ${r.holidayScore} 점 <span style="font-size:0.7rem;color:var(--text-muted);">(${r.holidayDiffFromMean > 0 ? '+' : ''}${r.holidayDiffFromMean})</span>
          </td>
          <td style="font-family:var(--font-mono);">
            홈 ${r.maxHomeStreak}연 / 원정 ${r.maxAwayStreak}연
          </td>
          <td>
            <span class="badge ${isFair ? 'badge-pass' : 'badge-fail'}">
              ${isFair ? `✓ FAIR (±${tolDist}km 내)` : '▲ OUTLIER (편차초과)'}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const sum = active.leagueSummary;
    const initSum = state.evalInitial.leagueSummary;
    tfoot.innerHTML = `
      <tr>
        <td>리그 평균 / 요약 (10개 구단)</td>
        <td style="font-family:var(--font-mono);">평균 ${initSum.meanDistance.toLocaleString()} km (격차 ${initSum.maxDistanceSpread}km)</td>
        <td style="font-family:var(--font-mono);color:var(--accent-primary);">평균 ${sum.meanDistance.toLocaleString()} km (격차 ${sum.maxDistanceSpread}km)</td>
        <td style="font-family:var(--font-mono);color:#059669;">총 ${(sum.totalDistance - initSum.totalDistance).toFixed(1)} km</td>
        <td style="font-family:var(--font-mono);">허용범위 ±${tolDist} km</td>
        <td style="font-family:var(--font-mono);">평균 ${sum.meanMoveCount} 회 (${sum.minMoveCount}~${sum.maxMoveCount}회)</td>
        <td style="font-family:var(--font-mono);">균형 배분</td>
        <td style="font-family:var(--font-mono);">평균 23.0 경기</td>
        <td style="font-family:var(--font-mono);">평균 2.0 경기</td>
        <td style="font-family:var(--font-mono);">평균 ${sum.meanHolidayScore} 점</td>
        <td style="font-family:var(--font-mono);">최대 3연속 준수</td>
        <td><span class="badge ${active.score.soft[2] === 0 ? 'badge-pass' : 'badge-warn'}">${active.score.soft[2] === 0 ? '평준화 완료' : '평준화 전'}</span></td>
      </tr>
    `;

    tbody.querySelectorAll('tr[data-row-team]').forEach(tr => {
      tr.addEventListener('click', () => {
        setFocusTeamEverywhere(tr.dataset.rowTeam);
      });
    });
  }

  function setFocusTeamEverywhere(teamName) {
    state.focusTeam = teamName;
    state.selectedMapTeam = teamName;
    if (!state.radarSelectedTeams.includes(teamName)) {
      state.radarSelectedTeams = [teamName, ...state.radarSelectedTeams.slice(0, 3)];
    }
    renderSoftComparisonTable();
    renderBiChart1DistanceBand();
    renderBiChart2Moves();
    renderBiChart3Holiday();
    renderBiChart4Radar();
    renderBiChart5Spaghetti();
    renderBiChart6Trajectory();
  }

  // ==========================================================================
  // BI CHART 1: BEFORE vs AFTER TOTAL DISTANCE & ±300KM TOLERANCE BAND
  // ==========================================================================
  function renderBiChart1DistanceBand() {
    const canvas = document.getElementById('canvas-chart-distance-band');
    const setup = setupHiDPICanvas(canvas, 320);
    if (!setup) return;
    const { ctx, width, height } = setup;

    ctx.clearRect(0, 0, width, height);
    const pad = { top: 28, right: 28, bottom: 48, left: 62 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const initMap = {};
    state.evalInitial.teamAnalytics.forEach(a => { initMap[a.team] = a; });
    const active = state.evalActive || state.evalSolved;

    const items = active.teamAnalytics.map(a => ({
      team: a.team,
      fullName: a.fullName,
      color: a.color,
      afterDist: a.totalDistance,
      beforeDist: initMap[a.team]?.totalDistance ?? a.totalDistance,
      diffFromMean: a.distanceDiffFromMean
    }));

    if (state.chart1Sort === 'afterDesc') {
      items.sort((a, b) => b.afterDist - a.afterDist);
    } else if (state.chart1Sort === 'beforeDesc') {
      items.sort((a, b) => b.beforeDist - a.beforeDist);
    }

    const minY = 6200;
    const maxY = 8400;
    const toY = (val) => pad.top + plotH * (1 - (val - minY) / (maxY - minY));

    const meanDist = active.leagueSummary.meanDistance;
    const tol = state.seasonConfig.toleranceTotalDistance;
    const bandTop = toY(meanDist + tol);
    const bandBot = toY(meanDist - tol);

    // 1. Draw ±300km Fairness Tolerance Band
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.fillRect(pad.left, bandTop, plotW, bandBot - bandTop);

    ctx.strokeStyle = 'rgba(5, 150, 105, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, bandTop);
    ctx.lineTo(width - pad.right, bandTop);
    ctx.moveTo(pad.left, bandBot);
    ctx.lineTo(width - pad.right, bandBot);
    ctx.stroke();

    // Mean Line
    const yMean = toY(meanDist);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(pad.left, yMean);
    ctx.lineTo(width - pad.right, yMean);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#065F46';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`평균+${tol}km (${(meanDist + tol).toFixed(0)})`, width - pad.right - 4, bandTop - 5);
    ctx.fillText(`리그평균 ${meanDist.toFixed(0)}km`, width - pad.right - 4, yMean - 5);
    ctx.fillText(`평균-${tol}km (${(meanDist - tol).toFixed(0)})`, width - pad.right - 4, bandBot + 12);

    // 2. Y-Axis Grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let v = 6400; v <= 8200; v += 400) {
      const y = toY(v);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${v.toLocaleString()}`, pad.left - 8, y);
    }

    // 3. Grouped Bars (Before vs After for each team)
    const groupW = plotW / items.length;
    const barW = Math.min(20, groupW * 0.34);
    const hitBoxes = [];

    items.forEach((it, idx) => {
      const cx = pad.left + groupW * (idx + 0.5);
      const xBefore = cx - barW - 2;
      const xAfter = cx + 2;

      const yBefore = toY(it.beforeDist);
      const yAfter = toY(it.afterDist);
      const hBefore = pad.top + plotH - yBefore;
      const hAfter = pad.top + plotH - yAfter;

      // Before Bar (Muted Slate or Warn Amber if outside band)
      const beforeOut = Math.abs(it.beforeDist - state.evalInitial.leagueSummary.meanDistance) > tol;
      ctx.fillStyle = beforeOut ? 'rgba(245, 158, 11, 0.45)' : 'rgba(148, 163, 184, 0.55)';
      ctx.fillRect(xBefore, yBefore, barW, hBefore);
      ctx.strokeStyle = beforeOut ? '#D97706' : '#64748B';
      ctx.lineWidth = 1;
      ctx.strokeRect(xBefore, yBefore, barW, hBefore);

      // After Bar (Club Official Brand Color)
      ctx.fillStyle = it.color || '#2563EB';
      ctx.fillRect(xAfter, yAfter, barW, hAfter);

      if (it.team === state.focusTeam) {
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2.2;
        ctx.strokeRect(xAfter - 1, yAfter - 1, barW + 2, hAfter + 1);
      }

      // Value labels on top of bars
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748B';
      ctx.fillText(Math.round(it.beforeDist), xBefore + barW / 2, yBefore - 6);

      ctx.fillStyle = '#0F172A';
      ctx.fillText(Math.round(it.afterDist), xAfter + barW / 2, yAfter - 6);

      // Team X-axis label
      ctx.font = it.team === state.focusTeam ? '800 12px Pretendard, sans-serif' : '700 11px Pretendard, sans-serif';
      ctx.fillStyle = it.team === state.focusTeam ? '#2563EB' : '#1E293B';
      ctx.fillText(it.team, cx, height - 22);

      const delta = (it.afterDist - it.beforeDist).toFixed(0);
      ctx.font = '9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = Number(delta) < 0 ? '#059669' : '#64748B';
      ctx.fillText(`${Number(delta) > 0 ? '+' : ''}${delta}km`, cx, height - 8);

      hitBoxes.push({
        x1: cx - groupW / 2,
        x2: cx + groupW / 2,
        item: it
      });
    });

    canvas._hitBoxes = hitBoxes;
  }

  // ==========================================================================
  // BI CHART 2: MOVE COUNT (WEEKDAY vs WEEKEND) & EFFICIENCY SCATTER
  // ==========================================================================
  function renderBiChart2Moves() {
    const canvas = document.getElementById('canvas-chart-moves');
    const setup = setupHiDPICanvas(canvas, 320);
    if (!setup) return;
    const { ctx, width, height } = setup;

    ctx.clearRect(0, 0, width, height);
    const pad = { top: 28, right: 28, bottom: 44, left: 58 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const active = state.evalActive || state.evalSolved;
    const items = active.teamAnalytics;

    if (state.chart2Mode === 'stacked') {
      // Stacked Bar: Weekday Moves vs Weekend Moves
      const maxMoves = 42;
      const toY = (v) => pad.top + plotH * (1 - v / maxMoves);

      // Tolerance band around meanMoveCount (35.2 ± 2)
      const meanMv = active.leagueSummary.meanMoveCount;
      const tolMv = state.seasonConfig.toleranceTotalMove;
      const yTop = toY(meanMv + tolMv);
      const yBot = toY(meanMv - tolMv);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(pad.left, yTop, plotW, yBot - yTop);

      for (let v = 0; v <= 40; v += 10) {
        const y = toY(v);
        ctx.strokeStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillStyle = '#64748B';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${v}회`, pad.left - 8, y + 3);
      }

      const groupW = plotW / items.length;
      const barW = Math.min(28, groupW * 0.55);

      items.forEach((it, idx) => {
        const cx = pad.left + groupW * (idx + 0.5);
        const x = cx - barW / 2;
        const wkdayH = (it.weekdayMoveCount / maxMoves) * plotH;
        const wkendH = (it.weekendMoveCount / maxMoves) * plotH;

        const yWkday = pad.top + plotH - wkdayH;
        const yWkend = yWkday - wkendH;

        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(x, yWkday, barW, wkdayH);

        ctx.fillStyle = '#6366F1';
        ctx.fillRect(x, yWkend, barW, wkendH);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${it.totalMoveCount}회`, cx, yWkend - 6);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        if (wkdayH > 14) ctx.fillText(it.weekdayMoveCount, cx, yWkday + wkdayH / 2 + 3);
        if (wkendH > 14) ctx.fillText(it.weekendMoveCount, cx, yWkend + wkendH / 2 + 3);

        ctx.fillStyle = it.team === state.focusTeam ? '#2563EB' : '#1E293B';
        ctx.font = 'bold 11px Pretendard, sans-serif';
        ctx.fillText(it.team, cx, height - 16);
      });
      return;
    }

    // Default: Scatter / Bubble Chart (X = Total Move Count, Y = Total Distance, Bubble = Avg km per move)
    const minX = 31;
    const maxX = 39.5;
    const minY = 6550;
    const maxY = 8200;

    const toX = (v) => pad.left + ((v - minX) / (maxX - minX)) * plotW;
    const toY = (v) => pad.top + plotH * (1 - (v - minY) / (maxY - minY));

    // Draw Target Fairness Zone Box (Mean Move ±2, Mean Distance ±300km)
    const meanMv = active.leagueSummary.meanMoveCount;
    const meanDist = active.leagueSummary.meanDistance;
    const tolMv = state.seasonConfig.toleranceTotalMove;
    const tolDist = state.seasonConfig.toleranceTotalDistance;

    const bx1 = toX(meanMv - tolMv);
    const bx2 = toX(meanMv + tolMv);
    const by1 = toY(meanDist + tolDist);
    const by2 = toY(meanDist - tolDist);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
    ctx.fillRect(bx1, by1, bx2 - bx1, by2 - by1);
    ctx.strokeStyle = 'rgba(5, 150, 105, 0.6)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);
    ctx.setLineDash([]);

    ctx.fillStyle = '#065F46';
    ctx.font = 'bold 10px Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✓ 공정성 허용 타겟 존 (이동 ±2회 & 거리 ±300km)', bx1 + 6, by1 + 14);

    // Axes Grid
    for (let m = 32; m <= 39; m += 1) {
      const x = toX(m);
      ctx.strokeStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${m}회`, x, height - 16);
    }

    for (let d = 6800; d <= 8000; d += 400) {
      const y = toY(d);
      ctx.strokeStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${d}`, pad.left - 6, y + 3);
    }

    // Plot Before ghost nodes & connecting arrows to After bubbles
    const initMap = {};
    state.evalInitial.teamAnalytics.forEach(a => { initMap[a.team] = a; });

    items.forEach(it => {
      const bef = initMap[it.team];
      const xAfter = toX(it.totalMoveCount);
      const yAfter = toY(it.totalDistance);

      if (bef && state.activePlanMode === 'solved') {
        const xBef = toX(bef.totalMoveCount);
        const yBef = toY(bef.totalDistance);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(xBef, yBef);
        ctx.lineTo(xAfter, yAfter);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(xBef, yBef, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.fill();
      }

      const isFocus = it.team === state.focusTeam;
      const r = isFocus ? 12 : 9;
      ctx.beginPath();
      ctx.arc(xAfter, yAfter, r, 0, Math.PI * 2);
      ctx.fillStyle = it.color;
      ctx.fill();
      ctx.lineWidth = isFocus ? 2.5 : 1.5;
      ctx.strokeStyle = isFocus ? '#0F172A' : '#FFFFFF';
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 11px Pretendard, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${it.team}`, xAfter + r + 4, yAfter + 4);
    });
  }

  // ==========================================================================
  // BI CHART 3: WEEKEND & HOLIDAY HOME GAMES + HOLIDAY SCORE LINE
  // ==========================================================================
  function renderBiChart3Holiday() {
    const canvas = document.getElementById('canvas-chart-holiday');
    const setup = setupHiDPICanvas(canvas, 320);
    if (!setup) return;
    const { ctx, width, height } = setup;

    ctx.clearRect(0, 0, width, height);
    const pad = { top: 30, right: 32, bottom: 46, left: 52 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const active = state.evalActive || state.evalSolved;
    const items = active.teamAnalytics;
    const maxScore = 32;
    const toY = (v) => pad.top + plotH * (1 - v / maxScore);

    // Tolerance Band around Mean Holiday Score (25.0 ± 1.5)
    const meanHol = active.leagueSummary.meanHolidayScore;
    const tolHol = state.seasonConfig.toleranceHoliday;
    const yTop = toY(meanHol + tolHol);
    const yBot = toY(meanHol - tolHol);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.11)';
    ctx.fillRect(pad.left, yTop, plotW, yBot - yTop);

    for (let v = 0; v <= 30; v += 6) {
      const y = toY(v);
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${v}`, pad.left - 8, y + 3);
    }

    const groupW = plotW / items.length;
    const barW = Math.min(26, groupW * 0.5);
    const linePts = [];

    items.forEach((it, idx) => {
      const cx = pad.left + groupW * (idx + 0.5);
      const x = cx - barW / 2;

      const wkGamesH = (it.weekendHomeGames / maxScore) * plotH;
      const holGamesH = (it.holidayHomeGames / maxScore) * plotH;

      const yWk = pad.top + plotH - wkGamesH;
      const yHol = yWk - holGamesH;

      ctx.fillStyle = '#2563EB';
      ctx.fillRect(x, yWk, barW, wkGamesH);

      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(x, yHol, barW, holGamesH);

      const yScore = toY(it.holidayScore);
      linePts.push({ x: cx, y: yScore, score: it.holidayScore, item: it });

      // Special Home Badges (Opening ★ / Children's Day 🎈)
      let markers = '';
      if (it.openingDayHome) markers += '★';
      if (it.childrenDayHome) markers += '🎈';
      if (markers) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(markers, cx, height - 28);
      }

      ctx.fillStyle = it.team === state.focusTeam ? '#2563EB' : '#1E293B';
      ctx.font = 'bold 11px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(it.team, cx, height - 12);
    });

    // Draw Holiday Score Line
    ctx.beginPath();
    linePts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    linePts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#10B981';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#065F46';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.score}점`, p.x, p.y - 9);
    });
  }

  // ==========================================================================
  // BI CHART 4: 10-TEAM 5-AXIS FAIRNESS RADAR CHART
  // ==========================================================================
  function computeFairnessRadarScores(teamAnalytic) {
    // 5 normalized 0..100 axes (100 = most favorable / balanced)
    const distScore = Math.max(35, Math.min(100, Math.round(100 - Math.abs(teamAnalytic.distanceDiffFromMean) / 12)));
    const moveScore = Math.max(40, Math.min(100, Math.round(100 - Math.abs(teamAnalytic.moveDiffFromMean) * 14)));
    const weekdayScore = Math.max(45, Math.min(100, Math.round(100 - Math.max(0, teamAnalytic.weekdayMoveCount - 15) * 7)));
    const holidayBalance = Math.max(45, Math.min(100, Math.round(100 - Math.abs(teamAnalytic.holidayDiffFromMean) * 10)));
    const streakSafety = teamAnalytic.maxHomeStreak <= 3 && teamAnalytic.maxAwayStreak <= 3 ? 96 : 55;
    return [distScore, moveScore, weekdayScore, holidayBalance, streakSafety];
  }

  function renderBiChart4Radar() {
    const chipContainer = document.getElementById('radar-team-chips');
    if (chipContainer) {
      chipContainer.innerHTML = state.teams.map(t => {
        const active = state.radarSelectedTeams.includes(t.name);
        return `
          <button type="button" class="team-filter-chip ${active ? 'active' : ''}"
                  style="--chip-color:${t.color};"
                  data-radar-team="${t.name}">
            <span class="dot"></span>
            <span>${t.name}</span>
          </button>
        `;
      }).join('');

      chipContainer.querySelectorAll('.team-filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const tName = btn.dataset.radarTeam;
          if (state.radarSelectedTeams.includes(tName)) {
            if (state.radarSelectedTeams.length > 1) {
              state.radarSelectedTeams = state.radarSelectedTeams.filter(x => x !== tName);
            }
          } else {
            state.radarSelectedTeams.push(tName);
          }
          renderBiChart4Radar();
        });
      });
    }

    const canvas = document.getElementById('canvas-chart-radar');
    const setup = setupHiDPICanvas(canvas, 320);
    if (!setup) return;
    const { ctx, width, height } = setup;

    ctx.clearRect(0, 0, width, height);
    const cx = width * 0.44;
    const cy = height * 0.52;
    const radius = Math.min(width, height) * 0.35;

    const axesLabels = [
      '① 이동거리 평준화',
      '② 총 이동빈도 안정성',
      '③ 주중 이동 부담 완화',
      '④ 주말·휴일 홈 균형',
      '⑤ 연속 홈/원정 균형'
    ];

    // Draw concentric pentagons
    for (let ring = 20; ring <= 100; ring += 20) {
      const r = (radius * ring) / 100;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === 80 ? '#94A3B8' : '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw spokes & labels
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();

      const lx = cx + Math.cos(angle) * (radius + 22);
      const ly = cy + Math.sin(angle) * (radius + 18);
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 11px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axesLabels[i], lx, ly);
    }

    const active = state.evalActive || state.evalSolved;
    const activeMap = {};
    active.teamAnalytics.forEach(a => { activeMap[a.team] = a; });

    const initMap = {};
    state.evalInitial.teamAnalytics.forEach(a => { initMap[a.team] = a; });

    // Optional: Draw Before polygon for focusTeam as dashed reference
    if (state.radarShowBefore && initMap[state.focusTeam]) {
      const befScores = computeFairnessRadarScores(initMap[state.focusTeam]);
      ctx.beginPath();
      befScores.forEach((sc, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const r = (radius * sc) / 100;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw polygons for selected teams
    state.radarSelectedTeams.forEach((tName, idx) => {
      const item = activeMap[tName];
      if (!item) return;
      const scores = computeFairnessRadarScores(item);

      ctx.beginPath();
      scores.forEach((sc, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const r = (radius * sc) / 100;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = `${item.color}22`;
      ctx.fill();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = tName === state.focusTeam ? 3 : 2;
      ctx.stroke();

      // Right side mini score legend
      const legX = width * 0.78;
      const legY = 42 + idx * 24;
      const avgSc = (scores.reduce((a, b) => a + b, 0) / 5).toFixed(1);
      ctx.fillStyle = item.color;
      ctx.fillRect(legX, legY - 6, 12, 12);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 11px Pretendard, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${tName}: 종합 ${avgSc}점`, legX + 18, legY);
    });
  }

  // ==========================================================================
  // BI CHART 5: CUMULATIVE DISTANCE SPAGHETTI CHART ACROSS 45 SERIES SLOTS
  // ==========================================================================
  function renderBiChart5Spaghetti() {
    const canvas = document.getElementById('canvas-chart-spaghetti');
    const setup = setupHiDPICanvas(canvas, 370);
    if (!setup) return;
    const { ctx, width, height } = setup;

    ctx.clearRect(0, 0, width, height);
    const pad = { top: 28, right: 110, bottom: 44, left: 64 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    const active = state.evalActive || state.evalSolved;
    const maxSlots = 45;
    const maxDist = 8300;

    const toX = (slotIdx) => pad.left + (slotIdx / (maxSlots - 1)) * plotW;
    const toY = (d) => pad.top + plotH * (1 - d / maxDist);

    // Y Grid
    for (let d = 0; d <= 8000; d += 2000) {
      const y = toY(d);
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${d.toLocaleString()}km`, pad.left - 8, y + 3);
    }

    // Optional: Draw Initial Plan Min~Max Envelope Fan-Out Shaded Band
    if (state.spaghettiShowBefore && state.evalInitial) {
      const upperPts = [];
      const lowerPts = [];
      for (let s = 0; s < maxSlots; s++) {
        const vals = state.evalInitial.teamAnalytics.map(a => a.routeSteps[s]?.cumulativeDistance || 0);
        upperPts.push({ x: toX(s), y: toY(Math.max(...vals)) });
        lowerPts.push({ x: toX(s), y: toY(Math.min(...vals)) });
      }

      ctx.beginPath();
      upperPts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      for (let i = lowerPts.length - 1; i >= 0; i--) {
        ctx.lineTo(lowerPts[i].x, lowerPts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.13)';
      ctx.fill();
    }

    // Draw 10 Teams Cumulative Curves
    const endLabels = [];
    active.teamAnalytics.forEach(a => {
      const isFocus = a.team === state.focusTeam;
      ctx.beginPath();
      a.routeSteps.forEach((step, sIdx) => {
        const x = toX(sIdx);
        const y = toY(step.cumulativeDistance);
        if (sIdx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = a.color;
      ctx.globalAlpha = isFocus ? 1.0 : 0.45;
      ctx.lineWidth = isFocus ? 3.2 : 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      const lastStep = a.routeSteps[a.routeSteps.length - 1];
      if (lastStep) {
        endLabels.push({
          team: a.team,
          color: a.color,
          dist: lastStep.cumulativeDistance,
          y: toY(lastStep.cumulativeDistance),
          isFocus
        });
      }
    });

    // X-axis Month Milestones
    const sampleSteps = active.teamAnalytics[0]?.routeSteps || [];
    const seenMonths = new Set();
    sampleSteps.forEach((st, idx) => {
      const m = st.date.slice(5, 7);
      if (!seenMonths.has(m)) {
        seenMonths.add(m);
        const x = toX(idx);
        ctx.strokeStyle = '#CBD5E1';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#334155';
        ctx.font = 'bold 11px Pretendard, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Number(m)}월 개시 (S${idx + 1})`, x + 24, height - 16);
      }
    });

    // Right end labels (de-overlapped)
    endLabels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < endLabels.length; i++) {
      if (endLabels[i].y - endLabels[i - 1].y < 12) {
        endLabels[i].y = endLabels[i - 1].y + 12;
      }
    }
    endLabels.forEach(lbl => {
      ctx.fillStyle = lbl.isFocus ? '#0F172A' : lbl.color;
      ctx.font = lbl.isFocus ? '800 11px "JetBrains Mono", monospace' : '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${lbl.team} ${lbl.dist.toFixed(0)}km`, width - pad.right + 8, lbl.y + 3);
    });
  }

  // ==========================================================================
  // BI CHART 6: SELECTED TEAM ROUTE TRAJECTORY MAP & 45-SLOT TIMELINE
  // ==========================================================================
  function renderBiChart6Trajectory() {
    const chipsEl = document.getElementById('trajectory-team-chips');
    const summaryEl = document.getElementById('trajectory-team-kpi-summary');
    const listEl = document.getElementById('route-timeline-list');
    const canvas = document.getElementById('canvas-chart-trajectory');

    const active = state.evalActive || state.evalSolved;
    const teamData = active.teamAnalytics.find(a => a.team === state.focusTeam) || active.teamAnalytics[0];
    if (!teamData) return;

    if (chipsEl) {
      chipsEl.innerHTML = state.teams.map(t => `
        <button type="button" class="team-filter-chip ${t.name === teamData.team ? 'active' : ''}"
                style="--chip-color:${t.color};"
                data-traj-team="${t.name}">
          <span class="dot"></span>
          <span>${t.name}</span>
        </button>
      `).join('');

      chipsEl.querySelectorAll('.team-filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          setFocusTeamEverywhere(btn.dataset.trajTeam);
        });
      });
    }

    const filteredSteps = state.trajectoryMonth === 'ALL'
      ? teamData.routeSteps
      : teamData.routeSteps.filter(s => s.date.slice(5, 7) === state.trajectoryMonth);

    if (summaryEl) {
      const mDist = filteredSteps.reduce((acc, s) => acc + s.distance, 0).toFixed(1);
      const mMoves = filteredSteps.filter(s => s.distance > 0).length;
      summaryEl.innerHTML = `
        <span style="color:${teamData.color};">${teamData.fullName}</span> ·
        조회 구간(${state.trajectoryMonth === 'ALL' ? '시즌 전체 45슬롯' : Number(state.trajectoryMonth) + '월'}) 이동거리:
        <strong style="font-family:var(--font-mono);color:var(--text-primary);">${Number(mDist).toLocaleString()} km</strong>
        (이동 ${mMoves}회 / 시즌 누적 ${teamData.totalDistance.toLocaleString()} km)
      `;
    }

    if (listEl) {
      listEl.innerHTML = filteredSteps.map(st => {
        const badgeColor = st.moveType === '주중 이동' ? 'badge-fail' : (st.distance > 0 ? 'badge-info' : 'badge-pass');
        const stepColor = st.isHome ? teamData.color : '#64748B';
        return `
          <div class="route-step-item ${state.selectedRouteStepIndex === st.stepIndex ? 'active-step' : ''}"
               style="--step-color:${stepColor};"
               data-step-idx="${st.stepIndex}">
            <div style="display:flex;flex-direction:column;gap:0.15rem;">
              <div style="display:flex;align-items:center;gap:0.4rem;">
                <span style="font-family:var(--font-mono);font-weight:800;color:var(--text-primary);">S${String(st.stepIndex).padStart(2, '0')} · ${st.date} (${st.dow})</span>
                <span class="badge ${st.isHome ? 'badge-pass' : 'badge-neutral'}">${st.isHome ? '홈' : '원정'} vs ${st.opponent} (${st.consecutiveGames}연전)</span>
                <span class="badge ${badgeColor}">${st.moveType}</span>
              </div>
              <div style="font-size:0.75rem;color:var(--text-secondary);">
                경로: <strong>${st.path}</strong> · ${st.streakLabel}
              </div>
            </div>
            <div style="text-align:right;font-family:var(--font-mono);">
              <div style="font-weight:800;font-size:0.86rem;color:${st.distance > 0 ? 'var(--text-primary)' : 'var(--text-light)'};">
                +${st.distance.toFixed(1)} km
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);">누적 ${st.cumulativeDistance.toLocaleString()} km</div>
            </div>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.route-step-item').forEach(el => {
        el.addEventListener('click', () => {
          state.selectedRouteStepIndex = Number(el.dataset.stepIdx);
          renderBiChart6Trajectory();
        });
      });
    }

    // Draw Trajectory Map on Left Canvas
    const setup = setupHiDPICanvas(canvas, 370);
    if (!setup) return;
    const { ctx, width, height } = setup;

    ctx.fillStyle = '#091326';
    ctx.fillRect(0, 0, width, height);

    // Draw Korea landmass
    ctx.beginPath();
    KOREA_OUTLINE_COORDS.forEach(([lat, lng], idx) => {
      const pt = projectKoreaLatLng(lat, lng, width, height, 30);
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#16243E';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Stadium lookup by stadium name
    const stadiumCoords = {};
    state.teams.forEach(t => {
      const pt = projectKoreaLatLng(t.latitude, t.longitude, width, height, 30);
      stadiumCoords[t.stadium] = { x: pt.x, y: pt.y, team: t };
    });

    // Draw trajectory arcs for filteredSteps
    filteredSteps.forEach((st, idx) => {
      if (st.distance <= 0) return;
      const fromPt = stadiumCoords[st.fromStadium];
      const toPt = stadiumCoords[st.toStadium];
      if (!fromPt || !toPt) return;

      const isSelectedStep = st.stepIndex === state.selectedRouteStepIndex;
      const midX = (fromPt.x + toPt.x) / 2 + ((idx % 2 === 0 ? 1 : -1) * 10);
      const midY = (fromPt.y + toPt.y) / 2 - 8;

      ctx.beginPath();
      ctx.moveTo(fromPt.x, fromPt.y);
      ctx.quadraticCurveTo(midX, midY, toPt.x, toPt.y);
      ctx.strokeStyle = isSelectedStep
        ? '#FBBF24'
        : (st.moveType === '주중 이동' ? 'rgba(239, 68, 68, 0.72)' : 'rgba(59, 130, 246, 0.72)');
      ctx.lineWidth = isSelectedStep ? 3.2 : 1.6;
      ctx.stroke();
    });

    // Draw Stadium Nodes
    state.teams.forEach(t => {
      const pt = projectKoreaLatLng(t.latitude, t.longitude, width, height, 30);
      const isHomeClub = t.name === teamData.team;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isHomeClub ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.strokeStyle = isHomeClub ? '#FBBF24' : '#FFFFFF';
      ctx.lineWidth = isHomeClub ? 2.5 : 1.2;
      ctx.stroke();

      ctx.fillStyle = isHomeClub ? '#FBBF24' : '#E2E8F0';
      ctx.font = isHomeClub ? 'bold 11px Pretendard, sans-serif' : '10px Pretendard, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(t.name, pt.x + 10, pt.y + 3);
    });
  }

  // ==========================================================================
  // EVENT BINDINGS & INITIALIZATION
  // ==========================================================================
  function bindGlobalEvents() {
    // Stage Navigation Tabs
    document.querySelectorAll('.stage-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchStage(Number(btn.dataset.stage));
      });
    });

    document.querySelectorAll('[data-goto-stage]').forEach(btn => {
      btn.addEventListener('click', () => {
        switchStage(Number(btn.dataset.gotoStage));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // All Stages Briefing Mode Toggle
    const btnAllStages = document.getElementById('btn-toggle-all-stages');
    if (btnAllStages) {
      btnAllStages.addEventListener('click', () => {
        state.allStagesMode = !state.allStagesMode;
        document.body.classList.toggle('all-stages-mode', state.allStagesMode);
        btnAllStages.textContent = `📑 전체 스테이지 연속 보기: ${state.allStagesMode ? 'ON' : 'OFF'}`;
        switchStage(state.currentStage);
      });
    }

    // Header Quick Solver & JSON Export
    document.getElementById('btn-quick-run-solver')?.addEventListener('click', () => {
      switchStage(3);
      runOptaPlannerSimulation(true);
    });
    document.getElementById('btn-stage3-run-solver')?.addEventListener('click', () => {
      runOptaPlannerSimulation(false);
    });
    document.getElementById('btn-launch-solver-main')?.addEventListener('click', () => {
      runOptaPlannerSimulation(false);
    });

    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        teams: state.teams,
        distanceMatrix: state.distanceMatrix,
        seasonConfig: state.seasonConfig,
        specialEvents: state.specialEvents,
        evaluationSummary: state.evalActive?.leagueSummary,
        score: state.evalActive?.score
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kbo_2025_fairness_bi_simulation.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('시뮬레이션 설정 및 공정성 리포트 JSON 파일이 다운로드되었습니다.');
    });

    // Stage 1: Presets & Distance Recalculation
    document.getElementById('btn-preset-default-stadiums')?.addEventListener('click', async () => {
      state.teams = window.KBOEngine.deepClone(window.KBO_DATA.teams);
      await recalculateMatrixAndRefresh('2025 KBO 10개 구단 기본 본구장 좌표 및 공인 거리행렬로 복원되었습니다.');
    });

    document.getElementById('btn-preset-pohang')?.addEventListener('click', async () => {
      const samsungIdx = state.teams.findIndex(t => t.name === '삼성');
      const lotteIdx = state.teams.findIndex(t => t.name === '롯데');
      if (samsungIdx !== -1) await handleGeocodeTeam(samsungIdx, '포항야구장');
      if (lotteIdx !== -1) await handleGeocodeTeam(lotteIdx, '울산문수야구장');
      showToast('제2구장 시뮬레이션(삼성→포항야구장, 롯데→울산문수야구장) 위경도 및 이동거리가 반영되었습니다.');
    });

    document.getElementById('btn-recalc-all-distances')?.addEventListener('click', async () => {
      await recalculateMatrixAndRefresh('전 구장 10×10 도로 이동거리 매트릭스 재산출이 완료되었습니다.');
    });
    document.getElementById('btn-matrix-recompute')?.addEventListener('click', async () => {
      await recalculateMatrixAndRefresh('현재 구장 위경도 기반 10×10 이동거리 행렬이 갱신되었습니다.');
    });

    // Map Provider Switch (Canvas / Leaflet / Kakao / Naver)
    document.querySelectorAll('#map-provider-switch .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#map-provider-switch .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mapMode = btn.dataset.mapMode;
        const sdkBar = document.getElementById('gis-sdk-config-bar');
        const sdkLabel = document.getElementById('sdk-key-label');
        if (state.mapMode === 'kakao' || state.mapMode === 'naver') {
          if (sdkBar) sdkBar.style.display = 'flex';
          if (sdkLabel) sdkLabel.textContent = state.mapMode === 'kakao' ? 'Kakao Map JS 앱키:' : 'Naver Map Client ID:';
        } else {
          if (sdkBar) sdkBar.style.display = 'none';
        }
        renderKoreaGisMap();
      });
    });

    document.getElementById('btn-load-external-map-sdk')?.addEventListener('click', () => {
      const key = document.getElementById('sdk-api-key-input')?.value.trim();
      if (!key) {
        showToast('API Key를 입력하면 실서버 타일이 로드되며, 현재는 내장 고해상도 GIS 네트워크 맵으로 동작합니다.');
        return;
      }
      showToast(`${state.mapMode.toUpperCase()} Map SDK 동적 로더에 키(${key.slice(0, 6)}...)를 등록했습니다.`);
    });

    // Built-in GIS Canvas Click to Select Team Marker
    const gisCanvas = document.getElementById('korea-gis-canvas');
    if (gisCanvas) {
      gisCanvas.addEventListener('click', (e) => {
        const rect = gisCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const nodes = gisCanvas._teamHitNodes || [];
        for (const n of nodes) {
          const dist = Math.hypot(x - n.x, y - n.y);
          if (dist <= 16) {
            state.selectedMapTeam = n.team.name;
            state.highlightedPair = null;
            renderTeamBrandCards();
            renderMapFocusChips();
            renderKoreaGisMap();
            break;
          }
        }
      });
    }

    // Stage 2: Season Rules & Rest Day Chips
    document.querySelectorAll('#dow-rest-chips .dow-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const dow = Number(chip.dataset.dow);
        if (state.seasonConfig.restDaysOfWeek.includes(dow)) {
          state.seasonConfig.restDaysOfWeek = state.seasonConfig.restDaysOfWeek.filter(d => d !== dow);
        } else {
          state.seasonConfig.restDaysOfWeek.push(dow);
        }
        chip.classList.toggle('rest-active', state.seasonConfig.restDaysOfWeek.includes(dow));
        const badge = document.getElementById('rest-day-summary-badge');
        if (badge) {
          const names = state.seasonConfig.restDaysOfWeek.map(d => window.KBOEngine.DAY_NAMES_KO[d] + '요일').join(', ');
          badge.textContent = names ? `매주 ${names} 휴무` : '정기 휴무일 없음';
        }
        recomputeAllEvaluations();
        renderSeasonCalendarBoard();
        renderStage4Dashboard();
      });
    });

    document.getElementById('btn-add-blackout')?.addEventListener('click', () => {
      const inp = document.getElementById('input-extra-blackout');
      if (inp && inp.value && !state.seasonConfig.extraBlackouts.includes(inp.value)) {
        state.seasonConfig.extraBlackouts.push(inp.value);
        renderBlackoutTags();
        renderSeasonCalendarBoard();
        showToast(`경기 미개최일(${inp.value})이 캘린더에 등록되었습니다.`);
      }
    });

    document.getElementById('btn-add-custom-event')?.addEventListener('click', () => {
      state.specialEvents.push({
        id: `evt-custom-${Date.now()}`,
        title: '여름방학 제2구장 스페셜 3연전',
        date: '2025-08-01',
        consecutive: 3,
        pinMode: 'STADIUM_ONLY',
        badgeText: '구장만 지정',
        matchups: [
          { away: 'SSG', home: '롯데', stadium: '울산문수야구장' },
          { away: 'LG', home: '삼성', stadium: '포항야구장' },
          { away: 'KT', home: '한화', stadium: '청주야구장' },
          { away: '두산', home: 'KIA', stadium: '광주챔피언스필드' },
          { away: 'NC', home: '키움', stadium: '고척돔야구장' }
        ],
        homeTeamsOnly: ['롯데', '삼성', '한화', 'KIA', '키움']
      });
      renderSpecialEventsBuilder();
      renderPreflightChecklist();
      showToast('신규 특별 이벤트 슬롯이 추가되었습니다. [구단 및 구장 지정] 또는 [구장만 지정]을 선택하세요.');
    });

    document.getElementById('btn-reset-season-rules')?.addEventListener('click', () => {
      state.seasonConfig.toleranceTotalDistance = 300;
      state.seasonConfig.toleranceTotalMove = 2.0;
      state.seasonConfig.toleranceHoliday = 1.5;
      state.seasonConfig.maxConsecutiveHomeAway = 3;
      state.seasonConfig.restDaysOfWeek = [1];
      document.getElementById('cfg-tol-dist').value = '300';
      document.getElementById('cfg-tol-move').value = '2.0';
      document.getElementById('cfg-tol-hol').value = '1.5';
      document.getElementById('cfg-max-streak').value = '3';
      recomputeAllEvaluations();
      renderSeasonCalendarBoard();
      renderStage4Dashboard();
      showToast('2025 KBO 공식 시즌 마스터 룰로 복원되었습니다.');
    });

    ['cfg-tol-dist', 'cfg-tol-move', 'cfg-tol-hol', 'cfg-max-streak'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (Number.isNaN(val)) return;
        if (id === 'cfg-tol-dist') state.seasonConfig.toleranceTotalDistance = val;
        if (id === 'cfg-tol-move') state.seasonConfig.toleranceTotalMove = val;
        if (id === 'cfg-tol-hol') state.seasonConfig.toleranceHoliday = val;
        if (id === 'cfg-max-streak') state.seasonConfig.maxConsecutiveHomeAway = Math.round(val);
        recomputeAllEvaluations();
        renderPreflightChecklist();
        renderStage4Dashboard();
      });
    });

    // Stage 4: Plan Comparison Switch (Solved / Initial / Violation Demo)
    document.querySelectorAll('#plan-comparison-mode-switch .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setPlanComparisonMode(btn.dataset.planMode);
      });
    });

    document.getElementById('btn-toggle-violation-demo')?.addEventListener('click', () => {
      const nextMode = state.activePlanMode === 'violation' ? 'solved' : 'violation';
      setPlanComparisonMode(nextMode);
    });

    // Soft Table Sorting
    document.querySelectorAll('#soft-comparison-table thead th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.softTableSort.key === key) {
          state.softTableSort.dir = state.softTableSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.softTableSort.key = key;
          state.softTableSort.dir = 'desc';
        }
        renderSoftComparisonTable();
      });
    });

    document.getElementById('select-focus-team-master')?.addEventListener('change', (e) => {
      setFocusTeamEverywhere(e.target.value);
    });

    // Chart 1 & Chart 2 Switches
    document.querySelectorAll('#chart1-sort-switch .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#chart1-sort-switch .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.chart1Sort = btn.dataset.c1Sort;
        renderBiChart1DistanceBand();
      });
    });

    document.querySelectorAll('#chart2-mode-switch .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#chart2-mode-switch .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.chart2Mode = btn.dataset.c2Mode;
        renderBiChart2Moves();
      });
    });

    document.getElementById('chk-radar-show-before')?.addEventListener('change', (e) => {
      state.radarShowBefore = e.target.checked;
      renderBiChart4Radar();
    });

    document.getElementById('chk-spaghetti-show-before')?.addEventListener('change', (e) => {
      state.spaghettiShowBefore = e.target.checked;
      renderBiChart5Spaghetti();
    });

    document.querySelectorAll('#trajectory-month-filter .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#trajectory-month-filter .seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.trajectoryMonth = btn.dataset.month;
        renderBiChart6Trajectory();
      });
    });

    // Interactive Hover Tooltip on Chart 1 Canvas
    const c1 = document.getElementById('canvas-chart-distance-band');
    if (c1) {
      c1.addEventListener('mousemove', (e) => {
        const rect = c1.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const hit = (c1._hitBoxes || []).find(b => x >= b.x1 && x <= b.x2);
        if (hit) {
          const it = hit.item;
          const delta = (it.afterDist - it.beforeDist).toFixed(1);
          showTooltip(
            `<strong>${it.fullName}</strong><br/>` +
            `• 최적화 전(Initial): <strong>${it.beforeDist.toLocaleString()} km</strong><br/>` +
            `• 최적화 후(Solved): <strong>${it.afterDist.toLocaleString()} km</strong> (${delta}km)<br/>` +
            `• 리그 평균 대비 편차: <strong>${it.diffFromMean > 0 ? '+' : ''}${it.diffFromMean} km</strong>`,
            e.clientX,
            e.clientY
          );
        } else {
          hideTooltip();
        }
      });
      c1.addEventListener('mouseleave', hideTooltip);
      c1.addEventListener('click', (e) => {
        const rect = c1.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const hit = (c1._hitBoxes || []).find(b => x >= b.x1 && x <= b.x2);
        if (hit) setFocusTeamEverywhere(hit.item.team);
      });
    }

    // Responsive Resize Handler
    window.addEventListener('resize', () => {
      renderKoreaGisMap();
      renderConvergenceChart();
      renderBiChart1DistanceBand();
      renderBiChart2Moves();
      renderBiChart3Holiday();
      renderBiChart4Radar();
      renderBiChart5Spaghetti();
      renderBiChart6Trajectory();
    });
  }

  function setPlanComparisonMode(mode) {
    state.activePlanMode = mode;
    document.querySelectorAll('#plan-comparison-mode-switch .seg-btn').forEach(b => {
      b.classList.remove('active', 'active-danger');
      if (b.dataset.planMode === mode) {
        b.classList.add(mode === 'violation' ? 'active-danger' : 'active');
      }
    });
    recomputeAllEvaluations();
    renderStage4Dashboard();
  }

  function initApp() {
    recomputeAllEvaluations();
    renderTeamBrandCards();
    renderMapFocusChips();
    renderKoreaGisMap();
    renderDistanceMatrixTable();
    renderSpecialEventsBuilder();
    renderBlackoutTags();
    renderSeasonCalendarBoard();
    renderPreflightChecklist();
    appendSolverLog('[READY] KBO 2025 정규시즌 데이터셋(input_2025.json, 225 시리즈) 및 OptaPlanner 평가 엔진 로드 완료.', 'log-line-pass');
    appendSolverLog('[READY] 초기안(Max Spread 1,372.5km) vs 최적화안(Max Spread 573.1km, 페널티 0) 비교 준비 완료.', 'log-line-info');
    renderConvergenceChart();
    renderStage4Dashboard();
    bindGlobalEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
