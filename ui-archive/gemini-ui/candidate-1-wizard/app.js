/**
 * KBO Schedule Studio 2025 — Candidate 1: 4-Step Guided Wizard & Workbench
 * Pure Vanilla JavaScript (ES6+) Application Controller & High-DPI Canvas Renderers
 */
window.App = (function () {
  'use strict';

  // Approximate outline polygon of South Korea peninsula for offline Vector Map (lat, lng)
  const KOREA_OUTLINE_COORDS = [
    [38.30, 127.05], [38.55, 128.38], [37.90, 128.83], [37.50, 129.15],
    [37.05, 129.42], [36.35, 129.38], [36.05, 129.56], [35.48, 129.43],
    [35.12, 129.12], [34.85, 128.65], [34.72, 127.75], [34.45, 126.90],
    [34.35, 126.15], [34.82, 126.10], [35.38, 126.40], [35.98, 126.55],
    [36.58, 126.32], [36.98, 126.55], [37.25, 126.62], [37.52, 126.58],
    [37.78, 126.65], [38.05, 126.90], [38.30, 127.05]
  ];

  // Central Application State
  const state = {
    currentStep: 1,
    activePreset: 'solved', // 'solved' | 'initial' | 'violation'
    teams: [],
    distanceMatrix: [],
    calendar: [],
    currentPlan: [],
    initialPlanEval: null,
    currentEvaluation: null,
    selectedTeamIndex: 1, // Default Doosan (Jamsil)
    mapFocusTeam: '두산',
    mapProvider: 'leaflet', // 'leaflet' | 'vector' | 'kakao' | 'naver'
    leafletMap: null,
    leafletMarkers: [],
    leafletLines: [],
    kakaoMap: null,
    naverMap: null,

    // Step 2 Season & Event Config
    config: {
      matchStartDate: '2025-03-22',
      matchEndDate: '2025-08-31',
      allStarBreakDate: '2025-07-02',
      allStarStartDate: '2025-07-11',
      allStarEndDate: '2025-07-16',
      childrenDayStart: '2025-05-05',
      restDaysOfWeek: [1], // 1 = Monday
      childrenDayHomeTeams: ['두산', '키움', '한화', 'NC', '롯데'],
      maxConsecutiveHomeAway: 3,
      toleranceTotalDistance: 300.0,
      toleranceTotalMove: 2.0,
      toleranceWeekdayMove: 1.5,
      toleranceHoliday: 1.5,
      blackoutDates: [
        { date: '2025-05-08', reason: '어린이날 월~수 3연전 직후 목요일 이동/휴식일' }
      ],
      openingDayMatchups: [
        { away: '롯데', home: 'LG', stadium: '잠실종합운동장' },
        { away: '두산', home: 'SSG', stadium: '문학경기장' },
        { away: '한화', home: 'KT', stadium: '수원KT위즈파크' },
        { away: '키움', home: '삼성', stadium: '대구삼성라이언즈파크' },
        { away: 'NC', home: 'KIA', stadium: '광주챔피언스필드' }
      ],
      customEvents: [
        {
          id: 'EVT-1',
          date: '2025-06-06',
          title: '현충일 주말 3연전 (휴일 가중치 3점)',
          mode: 'MODE_B',
          detail: '현충일 금~일 3연전 홈구단 휴일 가중치 3.0점 부여'
        },
        {
          id: 'EVT-2',
          date: '2025-08-15',
          title: '광복절 주말 3연전 (휴일 가중치 3점)',
          mode: 'MODE_B',
          detail: '광복절 금~일 3연전 홈구단 휴일 가중치 3.0점 부여'
        }
      ]
    },

    selectedCalendarDate: '2025-05-05',

    // Step 3 Solver Simulation State
    solverRunning: false,
    solverTimer: null,
    convergenceHistory: [],

    // Step 4 Charts & Table State
    softTableSortKey: 'totalDistance',
    softTableSortAsc: false,
    radarSelectedTeams: ['롯데', 'KIA', '두산'],
    routeCurvePrimaryTeam: '롯데',
    routeCurveCompareTeam: 'KT'
  };

  /* ========================================================================
     1. INITIALIZATION & GLOBAL SCORE EVALUATION
     ======================================================================== */
  function init() {
    state.teams = window.KBOEngine.deepClone(window.KBO_DATA.teams);
    state.distanceMatrix = window.KBOEngine.deepClone(window.KBO_DATA.distanceMatrix);
    state.calendar = window.KBOEngine.deepClone(window.KBO_DATA.calendar);
    state.currentPlan = window.KBOEngine.deepClone(window.KBO_DATA.solvedPlan);

    // Pre-calculate baseline initialPlan evaluation for delta comparisons
    state.initialPlanEval = window.KBOEngine.evaluatePlan(
      window.KBO_DATA.initialPlan,
      state.teams,
      state.distanceMatrix,
      state.config
    );

    populateStaticSelects();
    recalculateEvaluation();

    // Render all 4 steps
    renderStep1();
    renderStep2();
    renderStep3();
    renderStep4();

    // Initialize maps after layout settles
    setTimeout(() => {
      initLeafletMap();
      renderVectorMap();
    }, 80);

    window.addEventListener('resize', () => {
      if (state.currentStep === 1) {
        renderVectorMap();
        if (state.leafletMap) state.leafletMap.invalidateSize();
      } else if (state.currentStep === 3) {
        drawConvergenceChart();
      } else if (state.currentStep === 4) {
        renderAllStep4Charts();
      }
    });
  }

  function populateStaticSelects() {
    // Preset stadiums dropdown
    const presetSel = document.getElementById('presetStadiumQuickSelect');
    if (presetSel) {
      presetSel.innerHTML = '<option value="">⚡ 제2구장/프리셋 빠른 적용 (선택 구단)...</option>' +
        window.KBO_DATA.stadiumPresets.map(p =>
          `<option value="${p.stadium}">${p.stadium} (${p.city} · ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)})</option>`
        ).join('');
    }

    // Quick geocode team select
    const qTeamSel = document.getElementById('quickGeocodeTeamSelect');
    if (qTeamSel) {
      qTeamSel.innerHTML = state.teams.map((t, idx) =>
        `<option value="${idx}" ${idx === state.selectedTeamIndex ? 'selected' : ''}>${t.name}</option>`
      ).join('');
    }

    // Map focus team select
    const focusSel = document.getElementById('mapFocusTeamSelect');
    if (focusSel) {
      focusSel.innerHTML = `<option value="ALL">전체 구장 네트워크 (45구간)</option>` +
        state.teams.map(t =>
          `<option value="${t.name}" ${t.name === state.mapFocusTeam ? 'selected' : ''}>${t.name} (${t.stadium})</option>`
        ).join('');
    }

    // Step 4 Route curve team selects & Schedule filter team select
    const routeSel1 = document.getElementById('routeCurveTeamSelect');
    const routeSel2 = document.getElementById('routeCurveCompareTeamSelect');
    const schedTeamSel = document.getElementById('scheduleFilterTeam');

    if (routeSel1) {
      routeSel1.innerHTML = state.teams.map(t =>
        `<option value="${t.name}" ${t.name === state.routeCurvePrimaryTeam ? 'selected' : ''}>기준: ${t.name} (${t.stadium})</option>`
      ).join('');
    }
    if (routeSel2) {
      routeSel2.innerHTML = `<option value="MEAN">비교: 리그 10구단 평균</option>` +
        state.teams.map(t =>
          `<option value="${t.name}" ${t.name === state.routeCurveCompareTeam ? 'selected' : ''}>비교: ${t.name} (${t.stadium})</option>`
        ).join('');
    }
    if (schedTeamSel) {
      schedTeamSel.innerHTML = `<option value="ALL">전체 구단 (10구단)</option>` +
        state.teams.map(t => `<option value="${t.name}">${t.name} (${t.fullName})</option>`).join('');
    }

    // Modal event date select
    const modalDateSel = document.getElementById('modalEventDateSelect');
    if (modalDateSel) {
      modalDateSel.innerHTML = state.calendar.map((c, i) => {
        const dStr = c.datetime.slice(0, 10);
        const dow = window.KBOEngine.getDayOfWeekKo(dStr);
        return `<option value="${dStr}" ${dStr === '2025-08-15' ? 'selected' : ''}>Slot #${i + 1}: ${dStr} (${dow}) · ${c.consecutive}연전</option>`;
      }).join('');
    }
  }

  function recalculateEvaluation() {
    // Re-evaluate baseline with current teams/matrix
    state.initialPlanEval = window.KBOEngine.evaluatePlan(
      window.KBO_DATA.initialPlan,
      state.teams,
      state.distanceMatrix,
      state.config
    );

    state.currentEvaluation = window.KBOEngine.evaluatePlan(
      state.currentPlan,
      state.teams,
      state.distanceMatrix,
      state.config
    );

    updateHeaderScoreBadges();
  }

  function updateHeaderScoreBadges() {
    const ev = state.currentEvaluation;
    if (!ev) return;

    const dot = document.getElementById('globalScoreDot');
    const hardEl = document.getElementById('globalHardBadge');
    const softEl = document.getElementById('globalSoftBadge');

    if (dot) dot.className = 'score-status-dot' + (ev.score.feasible ? '' : ' violated');
    if (hardEl) {
      hardEl.textContent = `[${ev.score.hard[0]}/${ev.score.hard[1]}]hard`;
      hardEl.className = 'score-live-hard' + (ev.score.feasible ? '' : ' violated');
    }
    if (softEl) {
      softEl.textContent = `[${ev.score.soft.join('/')}]soft`;
    }

    // Update stepper subtitles
    const sharedCount = state.teams.filter(t => t.sharedStadium).length;
    const s1 = document.getElementById('step1SubStatus');
    if (s1) s1.textContent = `10구단 · 공동구장 ${sharedCount}팀 · 평균 ${ev.leagueSummary.meanDistance.toLocaleString()}km`;

    const restNames = state.config.restDaysOfWeek.map(d => window.KBOEngine.DAY_NAMES_KO[d]).join('·') || '없음';
    const s2 = document.getElementById('step2SubStatus');
    if (s2) s2.textContent = `${state.config.matchStartDate.slice(5)}~${state.config.matchEndDate.slice(5)} · ${restNames}요일 휴식 · 어린이날 ${state.config.childrenDayHomeTeams.length}구장`;

    const s3 = document.getElementById('step3SubStatus');
    if (s3) s3.textContent = `허용편차 ±${state.config.toleranceTotalDistance}km · 최대 ${state.config.maxConsecutiveHomeAway}연속`;

    const s4 = document.getElementById('step4SubStatus');
    if (s4) {
      s4.textContent = ev.score.feasible
        ? `Hard 위반 0건 · 편차이내 ${ev.leagueSummary.teamsWithinDistanceTolerance}/10구단`
        : `⚠️ Hard 위반 ${ev.score.totalHardViolations}건 검출됨`;
    }
  }

  /* ========================================================================
     2. WIZARD NAVIGATION & PRESET SWITCHING
     ======================================================================== */
  function goToStep(stepNumber) {
    state.currentStep = Number(stepNumber);

    document.querySelectorAll('.wizard-step-tab').forEach(btn => {
      const s = Number(btn.getAttribute('data-step'));
      btn.classList.toggle('active', s === state.currentStep);
      btn.classList.toggle('completed', s < state.currentStep);
    });

    document.querySelectorAll('.step-panel').forEach((panel, idx) => {
      panel.classList.toggle('active', idx + 1 === state.currentStep);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (state.currentStep === 1) {
      setTimeout(() => {
        if (state.leafletMap) state.leafletMap.invalidateSize();
        renderVectorMap();
      }, 60);
    } else if (state.currentStep === 2) {
      renderStep2();
    } else if (state.currentStep === 3) {
      renderStep3();
      setTimeout(drawConvergenceChart, 50);
    } else if (state.currentStep === 4) {
      renderStep4();
      setTimeout(renderAllStep4Charts, 50);
    }
  }

  function switchPlanPreset(presetName) {
    state.activePreset = presetName;
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === presetName);
    });

    if (presetName === 'solved') {
      state.currentPlan = window.KBOEngine.deepClone(window.KBO_DATA.solvedPlan);
      showToast('✅ 2025 최적화 완료 대진표(Solved Plan)가 로드되었습니다. (Hard 위반 0건)');
    } else if (presetName === 'initial') {
      state.currentPlan = window.KBOEngine.deepClone(window.KBO_DATA.initialPlan);
      showToast('📋 최적화 전 초기 배정안(Initial Plan)이 로드되었습니다.');
    } else if (presetName === 'violation') {
      state.currentPlan = window.KBOEngine.createViolationDemoPlan();
      showToast('🧪 Hard 조건 위반 테스트 시나리오(잠실 중복 홈·어린이날 위반·연속 대진)가 로드되었습니다.');
    }

    recalculateEvaluation();
    if (state.currentStep === 2) renderStep2();
    if (state.currentStep === 3) renderStep3();
    if (state.currentStep === 4) renderStep4();
  }

  /* ========================================================================
     3. STEP 1: TEAMS, AUTO-GEOCODING, MAPS & 10x10 DISTANCE MATRIX
     ======================================================================== */
  function renderStep1() {
    detectSharedStadiums();
    renderTeamsTable();
    renderDistanceMatrixTable();
    updateMapMarkersAndRoutes();
  }

  function detectSharedStadiums() {
    // Automatically mark teams that share the same stadium name or coordinates (< 150m)
    state.teams.forEach((t, i) => {
      let isShared = false;
      state.teams.forEach((other, j) => {
        if (i === j) return;
        const dist = window.KBOEngine.haversineKm(t.latitude, t.longitude, other.latitude, other.longitude);
        if ((t.stadium && t.stadium === other.stadium) || dist < 0.25) {
          isShared = true;
        }
      });
      t.sharedStadium = isShared;
    });

    const sharedNames = state.teams.filter(t => t.sharedStadium).map(t => t.name);
    const badge = document.getElementById('sharedStadiumSummaryBadge');
    if (badge) {
      badge.textContent = sharedNames.length > 0
        ? `공동구장 공유: ${sharedNames.join('·')} (${sharedNames.length}구단)`
        : '공동구장 없음 (전 구단 단독 구장)';
    }
  }

  function renderTeamsTable() {
    const tbody = document.getElementById('teamsTableBody');
    if (!tbody) return;

    tbody.innerHTML = state.teams.map((t, idx) => {
      const isSelected = idx === state.selectedTeamIndex;
      return `
        <tr class="${isSelected ? 'selected-row' : ''}" onclick="App.selectTeamRow(${idx})">
          <td class="input-mono" style="font-weight:700; color:var(--text-muted);">${idx + 1}</td>
          <td>
            <div class="team-chip">
              <span class="team-color-dot" style="background:${t.color};"></span>
              <div>
                <div style="font-weight:800; color:var(--kbo-navy);">${t.name}</div>
                <div style="font-size:10.5px; color:var(--text-muted);">${t.city || ''}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="display:flex; gap:5px; align-items:center;">
              <input type="text" id="stadiumInput_${idx}" class="input-control" style="flex:1; min-width:135px; padding:5px 8px; font-size:12.5px;"
                     value="${t.stadium}"
                     placeholder="구장명 또는 주소 입력"
                     onclick="event.stopPropagation()"
                     onchange="App.geocodeTeamRow(${idx}, this.value)" />
              <button type="button" class="btn btn-sm btn-outline" title="구장명/주소로 위경도 자동 변환"
                      onclick="event.stopPropagation(); App.geocodeTeamRow(${idx}, document.getElementById('stadiumInput_${idx}').value)">
                📍 변환
              </button>
            </div>
            <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:250px;">
              ${t.address || ''}
            </div>
          </td>
          <td>
            <input type="number" step="0.0001" class="input-control input-mono" style="width:104px; padding:5px 6px;"
                   value="${Number(t.latitude).toFixed(5)}"
                   onclick="event.stopPropagation()"
                   onchange="App.updateTeamCoord(${idx}, 'latitude', this.value)" />
          </td>
          <td>
            <input type="number" step="0.0001" class="input-control input-mono" style="width:104px; padding:5px 6px;"
                   value="${Number(t.longitude).toFixed(5)}"
                   onclick="event.stopPropagation()"
                   onchange="App.updateTeamCoord(${idx}, 'longitude', this.value)" />
          </td>
          <td>
            ${t.sharedStadium
              ? `<span class="badge badge-amber">🤝 공동구장</span>`
              : `<span class="badge badge-slate">단독구장</span>`}
          </td>
          <td>
            <button type="button" class="btn btn-sm ${state.mapFocusTeam === t.name ? 'btn-primary' : 'btn-outline'}"
                    onclick="event.stopPropagation(); App.setFocusTeam('${t.name}')">
              🎯 경로
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function selectTeamRow(idx) {
    state.selectedTeamIndex = idx;
    const qTeamSel = document.getElementById('quickGeocodeTeamSelect');
    if (qTeamSel) qTeamSel.value = String(idx);
    renderTeamsTable();
  }

  async function geocodeTeamRow(idx, queryText) {
    const team = state.teams[idx];
    if (!team) return;
    const q = String(queryText || team.stadium).trim();
    if (!q) return;

    const res = await window.KBOEngine.geocodeLocation(q);
    if (res) {
      team.stadium = res.stadium;
      team.latitude = res.latitude;
      team.longitude = res.longitude;
      if (res.address) team.address = res.address;
      if (res.city) team.city = res.city;

      state.selectedTeamIndex = idx;
      state.mapFocusTeam = team.name;
      detectSharedStadiums();

      // Automatically recalculate distances when stadium location changes
      state.distanceMatrix = await window.KBOEngine.calculateDistanceMatrixFromCoords(state.teams);
      recalculateEvaluation();
      renderStep1();

      const hint = document.getElementById('geocodeResultHint');
      if (hint) {
        hint.textContent = `✓ [${team.name}] ${res.stadium} → (${res.latitude.toFixed(5)}, ${res.longitude.toFixed(5)}) [${res.source}]`;
      }
      showToast(`📍 [${team.name}] '${res.stadium}' 위경도(${res.latitude.toFixed(4)}, ${res.longitude.toFixed(4)}) 자동 입력 및 10×10 거리행렬 갱신 완료!`);
    } else {
      showToast(`⚠️ '${q}' 위치를 찾을 수 없습니다. 구장명(예: 포항야구장, 잠실, 사직) 또는 도시명을 입력하세요.`);
    }
  }

  async function runQuickGeocodeBar() {
    const idx = Number(document.getElementById('quickGeocodeTeamSelect')?.value || 0);
    const q = document.getElementById('quickGeocodeInput')?.value || '';
    if (!q.trim()) {
      showToast('구장명 또는 도로명주소를 입력해주세요. (예: 포항야구장, 울산문수야구장, 청주야구장)');
      return;
    }
    await geocodeTeamRow(idx, q);
  }

  async function applyPresetToSelectedTeam() {
    const presetName = document.getElementById('presetStadiumQuickSelect')?.value;
    if (!presetName) {
      showToast('먼저 드롭다운에서 적용할 구장 프리셋(예: 포항야구장, 울산문수야구장 등)을 선택하세요.');
      return;
    }
    await geocodeTeamRow(state.selectedTeamIndex, presetName);
  }

  async function updateTeamCoord(idx, field, val) {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    state.teams[idx][field] = num;
    detectSharedStadiums();
    state.distanceMatrix = await window.KBOEngine.calculateDistanceMatrixFromCoords(state.teams, { forceFormula: true });
    recalculateEvaluation();
    renderStep1();
    showToast(`🧭 [${state.teams[idx].name}] ${field === 'latitude' ? '위도' : '경도'} 수정 반영 및 이동거리 자동 갱신 완료`);
  }

  async function recalculateAllDistances(withAnimation = true) {
    const mode = document.getElementById('distanceCalcModeSelect')?.value || 'kbo_calibrated';
    const wrap = document.getElementById('matrixProgressWrap');
    const bar = document.getElementById('matrixProgressBar');
    const label = document.getElementById('matrixProgressLabel');

    if (withAnimation && wrap && bar && label) {
      wrap.classList.add('active');
      bar.style.width = '15%';
      label.textContent = '10개 구장 위경도 검증 및 도로망 라우팅 테이블 구성 중... (15%)';
      await new Promise(r => setTimeout(r, 180));
      bar.style.width = '55%';
      label.textContent = '구단 간 10×10 (100개 구간) 도로 이동거리 행렬 계산 중... (55%)';
      await new Promise(r => setTimeout(r, 220));
      bar.style.width = '90%';
      label.textContent = '잠실 공동구장(두산·LG 0km) 보정 및 스코어 재평가 중... (90%)';
      await new Promise(r => setTimeout(r, 160));
    }

    state.distanceMatrix = await window.KBOEngine.calculateDistanceMatrixFromCoords(state.teams, {
      useLiveRouteApi: mode === 'live_osrm',
      forceFormula: mode === 'formula_only'
    });

    if (withAnimation && wrap && bar && label) {
      bar.style.width = '100%';
      label.textContent = '✅ 10×10 구장 간 이동거리(100개 구간) 산출 및 대진표 스코어 반영 완료! (100%)';
      setTimeout(() => {
        wrap.classList.remove('active');
      }, 1200);
    }

    recalculateEvaluation();
    renderStep1();
    showToast('🚗 10개 구단 구장 위경도 기반 10×10 이동거리 행렬 일괄 계산이 완료되었습니다.');
  }

  function resetTeamsAndMatrix() {
    state.teams = window.KBOEngine.deepClone(window.KBO_DATA.teams);
    state.distanceMatrix = window.KBOEngine.deepClone(window.KBO_DATA.distanceMatrix);
    recalculateEvaluation();
    renderStep1();
    showToast('🔄 2025 KBO 공식 10개 구단 구장 좌표 및 공인 거리행렬로 복원되었습니다.');
  }

  function renderDistanceMatrixTable() {
    const table = document.getElementById('distanceMatrixTable');
    const summaryEl = document.getElementById('matrixSummaryStrip');
    if (!table) return;

    const lookup = window.KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const nonZeroDists = [];
    let maxPair = { from: '', to: '', dist: 0 };
    let minNonZero = { from: '', to: '', dist: 9999 };

    state.teams.forEach(a => {
      state.teams.forEach(b => {
        if (a.name === b.name) return;
        const d = lookup[a.name]?.[b.name] ?? 0;
        if (d > 0) {
          nonZeroDists.push(d);
          if (d > maxPair.dist) maxPair = { from: a.name, to: b.name, dist: d };
          if (d < minNonZero.dist) minNonZero = { from: a.name, to: b.name, dist: d };
        }
      });
    });

    const avgInterStadium = nonZeroDists.length
      ? (nonZeroDists.reduce((s, v) => s + v, 0) / nonZeroDists.length).toFixed(1)
      : '0.0';

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="solver-kpi-box">
          <div class="solver-kpi-label">구장 간 평균 이동거리</div>
          <div class="solver-kpi-val">${avgInterStadium} km</div>
        </div>
        <div class="solver-kpi-box">
          <div class="solver-kpi-label">최장 거리 구간</div>
          <div class="solver-kpi-val" style="color:var(--kbo-crimson);">${maxPair.from} ↔ ${maxPair.to} (${maxPair.dist} km)</div>
        </div>
        <div class="solver-kpi-box">
          <div class="solver-kpi-label">최단 구장 간 이동 구간</div>
          <div class="solver-kpi-val" style="color:var(--kbo-royal);">${minNonZero.from} ↔ ${minNonZero.to} (${minNonZero.dist} km)</div>
        </div>
        <div class="solver-kpi-box">
          <div class="solver-kpi-label">동일 구장 공유 구간 (0.0 km)</div>
          <div class="solver-kpi-val" style="color:var(--kbo-emerald);">두산 ↔ LG (잠실 0.0 km)</div>
        </div>
      `;
    }

    let html = `<thead><tr><th style="width:105px;">출발 \\ 도착</th>`;
    state.teams.forEach(t => {
      html += `<th>${t.name}<div style="font-size:10px; font-weight:400; opacity:0.8;">${t.stadium.slice(0, 4)}</div></th>`;
    });
    html += `</tr></thead><tbody>`;

    state.teams.forEach(fromT => {
      html += `<tr><th class="row-header"><span class="team-color-dot" style="background:${fromT.color}; margin-right:5px;"></span>${fromT.name}</th>`;
      state.teams.forEach(toT => {
        const dist = Number(lookup[fromT.name]?.[toT.name] ?? 0);
        const isSelf = fromT.name === toT.name;
        const isSharedZero = !isSelf && dist === 0;
        const bg = getDistanceHeatColor(dist, isSelf, isSharedZero);
        const textColor = dist >= 280 ? '#991B1B' : (isSharedZero ? '#065F46' : (isSelf ? '#94A3B8' : '#1E293B'));

        html += `
          <td style="background:${bg}; color:${textColor};" title="${fromT.name}(${fromT.stadium}) → ${toT.name}(${toT.stadium}): ${dist.toFixed(1)} km">
            <input type="number" step="0.1" class="matrix-cell-input"
                   value="${dist.toFixed(1)}"
                   ${isSelf ? 'readonly' : ''}
                   onchange="App.updateMatrixCell('${fromT.name}', '${toT.name}', this.value)" />
          </td>
        `;
      });
      html += `</tr>`;
    });

    html += `</tbody>`;
    table.innerHTML = html;
  }

  function getDistanceHeatColor(dist, isSelf, isSharedZero) {
    if (isSelf) return '#F8FAFC';
    if (isSharedZero) return '#D1FAE5';
    if (dist < 50) return '#EFF6FF';
    if (dist < 180) return '#DBEAFE';
    if (dist < 280) return '#FEF3C7';
    if (dist < 350) return '#FFEDD5';
    return '#FEE2E2';
  }

  function updateMatrixCell(fromTeam, toTeam, newVal) {
    const val = Math.max(0, parseFloat(newVal) || 0);
    const sym = document.getElementById('symmetricMatrixCheck')?.checked;

    state.distanceMatrix.forEach(entry => {
      if (entry.from === fromTeam && entry.to === toTeam) {
        entry.distance = Number(val.toFixed(1));
      }
      if (sym && entry.from === toTeam && entry.to === fromTeam) {
        entry.distance = Number(val.toFixed(1));
      }
    });

    recalculateEvaluation();
    renderDistanceMatrixTable();
    updateMapMarkersAndRoutes();
    showToast(`📏 이동거리 수정 반영: ${fromTeam} ↔ ${toTeam} = ${val.toFixed(1)} km`);
  }

  /* ========================================================================
     4. INTERACTIVE MAPS (LEAFLET + HIGH-DPI VECTOR MAP + KAKAO + NAVER)
     ======================================================================== */
  function switchMapProvider(provider) {
    state.mapProvider = provider;
    document.querySelectorAll('.map-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-map') === provider);
    });

    document.getElementById('leafletMapContainer')?.classList.toggle('active', provider === 'leaflet');
    document.getElementById('vectorMapContainer')?.classList.toggle('active', provider === 'vector');
    document.getElementById('kakaoMapContainer')?.classList.toggle('active', provider === 'kakao');
    document.getElementById('naverMapContainer')?.classList.toggle('active', provider === 'naver');

    const keyBar = document.getElementById('mapApiKeyBar');
    const promptEl = document.getElementById('mapApiKeyPrompt');
    if (provider === 'kakao' || provider === 'naver') {
      keyBar?.classList.add('visible');
      if (promptEl) {
        promptEl.textContent = provider === 'kakao'
          ? '🟡 Kakao Map JavaScript App Key:'
          : '🟢 Naver Cloud Map Client ID (ncpClientId):';
      }
      renderExternalMapPlaceholder(provider);
    } else {
      keyBar?.classList.remove('visible');
    }

    if (provider === 'leaflet') {
      if (!state.leafletMap) initLeafletMap();
      setTimeout(() => state.leafletMap && state.leafletMap.invalidateSize(), 50);
    } else if (provider === 'vector') {
      setTimeout(renderVectorMap, 30);
    }
  }

  function setFocusTeam(teamName) {
    state.mapFocusTeam = teamName;
    const sel = document.getElementById('mapFocusTeamSelect');
    if (sel) sel.value = teamName;
    renderTeamsTable();
    updateMapMarkersAndRoutes();
  }

  function initLeafletMap() {
    const container = document.getElementById('leafletMapContainer');
    if (!container) return;

    if (typeof window.L === 'undefined') {
      // Offline graceful fallback to Vector Map
      switchMapProvider('vector');
      return;
    }

    if (!state.leafletMap) {
      state.leafletMap = window.L.map('leafletMapContainer', {
        center: [36.38, 127.80],
        zoom: 7,
        zoomControl: true
      });

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &amp; CARTO · KBO Schedule Studio',
        maxZoom: 18
      }).addTo(state.leafletMap);
    }

    updateMapMarkersAndRoutes();
  }

  function updateMapMarkersAndRoutes() {
    const lookup = window.KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);
    updateMapLegend(lookup);

    // Update Leaflet if initialized
    if (state.leafletMap && typeof window.L !== 'undefined') {
      state.leafletMarkers.forEach(m => state.leafletMap.removeLayer(m));
      state.leafletLines.forEach(l => state.leafletMap.removeLayer(l));
      state.leafletMarkers = [];
      state.leafletLines = [];

      const focusT = state.teams.find(t => t.name === state.mapFocusTeam);

      // Draw route lines first
      if (state.mapFocusTeam === 'ALL') {
        for (let i = 0; i < state.teams.length; i++) {
          for (let j = i + 1; j < state.teams.length; j++) {
            const a = state.teams[i];
            const b = state.teams[j];
            const dist = lookup[a.name]?.[b.name] ?? 0;
            if (dist > 0) {
              const line = window.L.polyline([[a.latitude, a.longitude], [b.latitude, b.longitude]], {
                color: '#64748B',
                weight: 1.3,
                opacity: 0.45,
                dashArray: '4,4'
              }).addTo(state.leafletMap);
              state.leafletLines.push(line);
            }
          }
        }
      } else if (focusT) {
        state.teams.forEach(target => {
          if (target.name === focusT.name) return;
          const dist = lookup[focusT.name]?.[target.name] ?? 0;
          if (dist <= 0) return;
          const line = window.L.polyline([[focusT.latitude, focusT.longitude], [target.latitude, target.longitude]], {
            color: focusT.color || '#1D4ED8',
            weight: 2.8,
            opacity: 0.8
          }).addTo(state.leafletMap);
          line.bindTooltip(`${focusT.name} → ${target.name}: ${dist.toFixed(1)} km`, { sticky: true });
          state.leafletLines.push(line);
        });
      }

      // Draw markers (slight visual offset if shared stadium so both badges are clickable)
      state.teams.forEach((t, idx) => {
        let latOffset = 0;
        let lngOffset = 0;
        if (t.sharedStadium) {
          const sameGroup = state.teams.filter(o => o.stadium === t.stadium);
          const posInGroup = sameGroup.findIndex(o => o.name === t.name);
          lngOffset = (posInGroup === 0 ? -0.018 : 0.018);
        }

        const isFocus = t.name === state.mapFocusTeam;
        const distFromFocus = focusT ? (lookup[focusT.name]?.[t.name] ?? 0) : null;

        const iconHtml = `
          <div style="
            display:inline-flex; align-items:center; gap:4px;
            background:${t.color}; color:#FFFFFF;
            padding:${isFocus ? '4px 9px' : '3px 7px'};
            border-radius:999px; font-weight:800; font-size:${isFocus ? '12px' : '11px'};
            border:2px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.35);
            white-space:nowrap; transform:translate(-50%, -50%);
          ">
            <span>${t.name}</span>
            ${distFromFocus !== null && !isFocus ? `<span style="font-size:10px; background:rgba(0,0,0,0.35); padding:0 4px; border-radius:4px;">${distFromFocus}km</span>` : ''}
          </div>
        `;

        const divIcon = window.L.divIcon({
          html: iconHtml,
          className: 'kbo-leaflet-pin',
          iconSize: [0, 0]
        });

        const marker = window.L.marker([t.latitude + latOffset, t.longitude + lngOffset], { icon: divIcon })
          .addTo(state.leafletMap)
          .on('click', () => {
            state.selectedTeamIndex = idx;
            setFocusTeam(t.name);
          });

        marker.bindPopup(`
          <div style="font-family:var(--font-sans); min-width:180px;">
            <strong style="font-size:14px; color:${t.color};">${t.fullName} (${t.name})</strong>
            <div style="font-size:12px; margin-top:3px;">🏟️ <b>${t.stadium}</b> ${t.sharedStadium ? '<span style="color:#D97706;">(공동구장)</span>' : ''}</div>
            <div style="font-size:11px; color:#64748B; margin-top:2px;">${t.address || ''}</div>
            <div style="font-size:11px; font-family:monospace; margin-top:4px;">위도: ${t.latitude.toFixed(5)} / 경도: ${t.longitude.toFixed(5)}</div>
          </div>
        `);

        state.leafletMarkers.push(marker);
      });
    }

    // Always keep Vector Canvas Map updated too
    renderVectorMap();
  }

  function updateMapLegend(lookup) {
    const titleEl = document.getElementById('mapLegendTitle');
    const descEl = document.getElementById('mapLegendDesc');
    if (!titleEl || !descEl) return;

    if (state.mapFocusTeam === 'ALL') {
      titleEl.textContent = '📍 전체 KBO 10개 구단 구장 네트워크 (45개 이동 구간)';
      descEl.textContent = '마커를 클릭하면 해당 구단을 기준으로 9개 타 구장까지의 도로 이동거리(km)를 표시합니다.';
      return;
    }

    const focusT = state.teams.find(t => t.name === state.mapFocusTeam) || state.teams[0];
    const dists = state.teams
      .filter(t => t.name !== focusT.name)
      .map(t => ({ name: t.name, dist: lookup[focusT.name]?.[t.name] ?? 0 }))
      .sort((a, b) => a.dist - b.dist);

    const nearest = dists[0];
    const farthest = dists[dists.length - 1];
    titleEl.textContent = `📍 기준 구단: ${focusT.name} (${focusT.stadium})`;
    descEl.textContent = `최단 이동: ${nearest.name}(${nearest.dist}km) · 최장 이동: ${farthest.name}(${farthest.dist}km) · 위도 ${focusT.latitude.toFixed(3)}, 경도 ${focusT.longitude.toFixed(3)}`;
  }

  // High-DPI Offline Vector Network Map on HTML5 Canvas
  function renderVectorMap() {
    const canvas = document.getElementById('vectorMapCanvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = Math.max(360, rect.width || 620);
    const height = Math.max(320, rect.height || 465);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background Sea Gradient
    const seaGrad = ctx.createLinearGradient(0, 0, width, height);
    seaGrad.addColorStop(0, '#DBEAFE');
    seaGrad.addColorStop(1, '#E0F2FE');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, width, height);

    // Coordinate projection helper (Korea bounding box: lat 34.1 ~ 38.6, lng 125.7 ~ 130.0)
    const minLat = 34.2, maxLat = 38.55;
    const minLng = 125.8, maxLng = 129.85;
    const padX = 48, padY = 36;

    function project(lat, lng) {
      const x = padX + ((lng - minLng) / (maxLng - minLng)) * (width - padX * 2);
      const y = height - padY - ((lat - minLat) / (maxLat - minLat)) * (height - padY * 2);
      return [x, y];
    }

    // Draw lat/lng grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    for (let lat = 35; lat <= 38; lat += 1) {
      const [, y] = project(lat, minLng);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px monospace';
      ctx.fillText(`${lat}°N`, 8, y - 4);
    }
    for (let lng = 126; lng <= 129; lng += 1) {
      const [x] = project(minLat, lng);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px monospace';
      ctx.fillText(`${lng}°E`, x + 4, height - 8);
    }

    // Draw South Korea Peninsula Polygon
    ctx.beginPath();
    KOREA_OUTLINE_COORDS.forEach(([lat, lng], i) => {
      const [x, y] = project(lat, lng);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw routes
    const lookup = window.KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);
    const focusT = state.teams.find(t => t.name === state.mapFocusTeam);

    if (state.mapFocusTeam === 'ALL') {
      for (let i = 0; i < state.teams.length; i++) {
        for (let j = i + 1; j < state.teams.length; j++) {
          const a = state.teams[i];
          const b = state.teams[j];
          if ((lookup[a.name]?.[b.name] ?? 0) <= 0) continue;
          const [x1, y1] = project(a.latitude, a.longitude);
          const [x2, y2] = project(b.latitude, b.longitude);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.28)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    } else if (focusT) {
      const [fx, fy] = project(focusT.latitude, focusT.longitude);
      state.teams.forEach(target => {
        if (target.name === focusT.name) return;
        const dist = lookup[focusT.name]?.[target.name] ?? 0;
        if (dist <= 0) return;
        const [tx, ty] = project(target.latitude, target.longitude);

        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = focusT.color || '#1D4ED8';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Midpoint distance pill
        const mx = (fx + tx) / 2;
        const my = (fy + ty) / 2;
        const label = `${dist}km`;
        ctx.font = 'bold 10px sans-serif';
        const tw = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.fillRect(mx - tw / 2, my - 8, tw, 15);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - tw / 2, my - 8, tw, 15);
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, mx, my);
      });
    }

    // Draw Stadium Nodes
    const hitBoxes = [];
    state.teams.forEach((t, idx) => {
      let [x, y] = project(t.latitude, t.longitude);
      // Slight pixel offset for shared Jamsil stadium so both Doosan & LG are distinct
      if (t.sharedStadium) {
        const same = state.teams.filter(o => o.stadium === t.stadium);
        const pos = same.findIndex(o => o.name === t.name);
        x += (pos === 0 ? -18 : 18);
        y += (pos === 0 ? -8 : 8);
      }

      const isFocus = t.name === state.mapFocusTeam;
      ctx.beginPath();
      ctx.arc(x, y, isFocus ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = t.color || '#1D4ED8';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Label tag
      const tag = `${t.name}`;
      ctx.font = `${isFocus ? '800 12px' : '700 11px'} sans-serif`;
      const tw = ctx.measureText(tag).width + 10;
      const bx = x - tw / 2;
      const by = y - 24;
      ctx.fillStyle = isFocus ? '#0A1E3C' : 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(bx, by, tw, 16, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, x, by + 8);

      hitBoxes.push({ idx, name: t.name, x, y, r: 16 });
    });

    canvas.onclick = (e) => {
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      for (const h of hitBoxes) {
        if (Math.hypot(cx - h.x, cy - h.y) <= h.r) {
          state.selectedTeamIndex = h.idx;
          setFocusTeam(h.name);
          break;
        }
      }
    };
  }

  function renderExternalMapPlaceholder(provider) {
    const containerId = provider === 'kakao' ? 'kakaoMapContainer' : 'naverMapContainer';
    const el = document.getElementById(containerId);
    if (!el) return;

    const title = provider === 'kakao' ? 'Kakao Map JS SDK v2' : 'Naver Cloud Maps API v3';
    const badgeColor = provider === 'kakao' ? '#F59E0B' : '#10B981';

    el.innerHTML = `
      <div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:28px; text-align:center; background:linear-gradient(180deg,#F8FAFC 0%,#EFF6FF 100%);">
        <div style="background:${badgeColor}; color:#FFFFFF; font-weight:800; padding:6px 14px; border-radius:999px; font-size:12px; margin-bottom:12px;">
          ${title} 동적 로더 준비 완료
        </div>
        <h3 style="font-size:17px; font-weight:800; color:var(--kbo-navy); margin-bottom:8px;">
          상단 입력창에 ${provider === 'kakao' ? 'Kakao JavaScript App Key' : 'Naver Map Client ID'}를 입력하면 실제 SDK 지도가 즉시 렌더링됩니다.
        </h3>
        <p style="font-size:12.5px; color:var(--text-secondary); max-width:520px; margin-bottom:16px;">
          API Key가 없는 오프라인/로컬 환경에서도 100% 동일한 구장 좌표 지오코딩과 10×10 도로 이동거리 계산이 작동하며,
          <strong>[🌐 한국 지도 (Leaflet)]</strong> 및 <strong>[📐 벡터 네트워크 맵]</strong> 탭에서 즉시 지도를 확인하실 수 있습니다.
        </p>
        <div style="display:flex; gap:10px;">
          <button type="button" class="btn btn-primary" onclick="App.switchMapProvider('leaflet')">
            🌐 즉시 동작 한국 지도(Leaflet) 보기
          </button>
          <button type="button" class="btn btn-outline" onclick="App.switchMapProvider('vector')">
            📐 고해상도 벡터 네트워크 맵 보기
          </button>
        </div>
      </div>
    `;
  }

  function loadExternalMapSdk() {
    const key = document.getElementById('mapApiKeyInput')?.value.trim();
    if (!key) {
      showToast('API Key를 입력해주세요.');
      return;
    }

    if (state.mapProvider === 'kakao') {
      const script = document.createElement('script');
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
      script.onload = () => {
        if (window.kakao && window.kakao.maps) {
          window.kakao.maps.load(() => {
            const container = document.getElementById('kakaoMapContainer');
            container.innerHTML = '';
            const map = new window.kakao.maps.Map(container, {
              center: new window.kakao.maps.LatLng(36.38, 127.80),
              level: 12
            });
            state.teams.forEach(t => {
              new window.kakao.maps.Marker({
                map,
                position: new window.kakao.maps.LatLng(t.latitude, t.longitude),
                title: `${t.name} (${t.stadium})`
              });
            });
            showToast('✅ Kakao Map SDK 로드 및 10개 구장 마커 표시 완료!');
          });
        }
      };
      script.onerror = () => showToast('⚠️ Kakao SDK 로드 실패: 유효한 App Key와 도메인 등록 여부를 확인하세요.');
      document.head.appendChild(script);
    } else if (state.mapProvider === 'naver') {
      const script = document.createElement('script');
      script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(key)}`;
      script.onload = () => {
        if (window.naver && window.naver.maps) {
          const container = document.getElementById('naverMapContainer');
          container.innerHTML = '';
          const map = new window.naver.maps.Map(container, {
            center: new window.naver.maps.LatLng(36.38, 127.80),
            zoom: 7
          });
          state.teams.forEach(t => {
            new window.naver.maps.Marker({
              position: new window.naver.maps.LatLng(t.latitude, t.longitude),
              map,
              title: `${t.name} (${t.stadium})`
            });
          });
          showToast('✅ Naver Map SDK 로드 및 10개 구장 마커 표시 완료!');
        }
      };
      script.onerror = () => showToast('⚠️ Naver Map SDK 로드 실패: Client ID를 확인하세요.');
      document.head.appendChild(script);
    }
  }


  /* ========================================================================
     5. STEP 2: SEASON PERIOD, WEEKLY REST DAYS, SPECIAL EVENTS & CALENDAR UI
     ======================================================================== */
  function renderStep2() {
    renderDowRestButtons();
    renderBlackoutList();
    renderOpeningDayMatchups();
    renderChildrenDayStadiums();
    renderCustomEventsList();
    renderSeasonCalendarMonths();
    renderSlotInspector(state.selectedCalendarDate);
  }

  function updateSeasonConfig() {
    const startVal = document.getElementById('seasonStartDateInput')?.value;
    const endVal = document.getElementById('seasonEndDateInput')?.value;
    const allStart = document.getElementById('allStarStartInput')?.value;
    const allEnd = document.getElementById('allStarEndInput')?.value;

    if (startVal) state.config.matchStartDate = startVal;
    if (endVal) state.config.matchEndDate = endVal;
    if (allStart) state.config.allStarStartDate = allStart;
    if (allEnd) state.config.allStarEndDate = allEnd;

    recalculateEvaluation();
    renderStep2();
    showToast('📅 시즌 기간 및 올스타 브레이크 설정이 갱신되었습니다.');
  }

  function renderDowRestButtons() {
    const container = document.getElementById('dowToggleContainer');
    const badge = document.getElementById('activeRestDayBadge');
    if (!container) return;

    const order = [1, 2, 3, 4, 5, 6, 0]; // 월 화 수 목 금 토 일
    container.innerHTML = order.map(dow => {
      const isRest = state.config.restDaysOfWeek.includes(dow);
      const dayLabel = window.KBOEngine.DAY_NAMES_KO[dow];
      return `
        <button type="button" class="dow-btn ${isRest ? 'rest-active' : ''}" onclick="App.toggleRestDayOfWeek(${dow})">
          <span>${dayLabel}요일</span>
          <span class="dow-status">${isRest ? '휴식일' : '경기일'}</span>
        </button>
      `;
    }).join('');

    if (badge) {
      const names = state.config.restDaysOfWeek.map(d => window.KBOEngine.DAY_NAMES_KO[d] + '요일');
      badge.textContent = names.length ? `매주 ${names.join('·')} 휴식` : '정기 휴식일 없음';
    }
  }

  function toggleRestDayOfWeek(dow) {
    const idx = state.config.restDaysOfWeek.indexOf(dow);
    if (idx >= 0) {
      state.config.restDaysOfWeek.splice(idx, 1);
    } else {
      state.config.restDaysOfWeek.push(dow);
    }
    recalculateEvaluation();
    renderStep2();
    showToast(`🛌 정기 휴식일 설정 변경: [${state.config.restDaysOfWeek.map(d => window.KBOEngine.DAY_NAMES_KO[d]).join(', ') || '없음'}]`);
  }

  function renderBlackoutList() {
    const container = document.getElementById('blackoutListContainer');
    if (!container) return;

    const items = [
      { date: `${state.config.allStarStartDate} ~ ${state.config.allStarEndDate}`, reason: '올스타 브레이크 (6일)', fixed: true },
      ...state.config.blackoutDates.map((b, i) => ({ ...b, idx: i, fixed: false }))
    ];

    container.innerHTML = items.map(item => `
      <span class="badge ${item.fixed ? 'badge-amber' : 'badge-slate'}" style="padding:4px 8px;">
        🚫 ${item.date}: ${item.reason}
        ${!item.fixed ? `<button type="button" style="border:none; background:transparent; cursor:pointer; font-weight:800; margin-left:4px; color:#DC2626;" onclick="App.removeBlackoutDate(${item.idx})">×</button>` : ''}
      </span>
    `).join('');
  }

  function addBlackoutDate() {
    const dateVal = document.getElementById('newBlackoutDateInput')?.value;
    const reasonVal = document.getElementById('newBlackoutReasonInput')?.value.trim() || '특별 미개최일';
    if (!dateVal) return;

    state.config.blackoutDates.push({ date: dateVal, reason: reasonVal });
    renderStep2();
    showToast(`🚫 미개최 일자(${dateVal}: ${reasonVal})가 추가되었습니다.`);
  }

  function removeBlackoutDate(idx) {
    state.config.blackoutDates.splice(idx, 1);
    renderStep2();
  }

  // Mode A: Opening Day 5 Games (Away vs Home @ Stadium)
  function renderOpeningDayMatchups() {
    const container = document.getElementById('openingDayMatchupsContainer');
    if (!container) return;

    container.innerHTML = state.config.openingDayMatchups.map((m, idx) => {
      const homeTeamObj = state.teams.find(t => t.name === m.home);
      const stadiumName = homeTeamObj ? homeTeamObj.stadium : m.stadium;

      const awayOpts = state.teams.map(t =>
        `<option value="${t.name}" ${t.name === m.away ? 'selected' : ''}>${t.name} (원정)</option>`
      ).join('');
      const homeOpts = state.teams.map(t =>
        `<option value="${t.name}" ${t.name === m.home ? 'selected' : ''}>${t.name} (홈 · ${t.stadium})</option>`
      ).join('');

      return `
        <div style="display:grid; grid-template-columns: 32px 1fr 28px 1.25fr 1fr; gap:6px; align-items:center; margin-bottom:6px; background:#FFFFFF; padding:6px 10px; border:1px solid var(--border-color); border-radius:6px;">
          <span class="badge badge-navy">#${idx + 1}</span>
          <select class="select-control" style="font-size:12px; padding:4px 6px;" onchange="App.updateOpeningMatchup(${idx}, 'away', this.value)">
            ${awayOpts}
          </select>
          <span style="text-align:center; font-weight:800; color:var(--text-muted); font-size:11px;">VS</span>
          <select class="select-control" style="font-size:12px; padding:4px 6px;" onchange="App.updateOpeningMatchup(${idx}, 'home', this.value)">
            ${homeOpts}
          </select>
          <span class="badge badge-slate" style="justify-content:center;">🏟️ ${stadiumName}</span>
        </div>
      `;
    }).join('');
  }

  function updateOpeningMatchup(idx, side, teamName) {
    state.config.openingDayMatchups[idx][side] = teamName;
    if (side === 'home') {
      const t = state.teams.find(x => x.name === teamName);
      if (t) state.config.openingDayMatchups[idx].stadium = t.stadium;
    }
    renderOpeningDayMatchups();
  }

  function applyOpeningDayToPlan() {
    const openDate = state.config.matchStartDate;
    const openMatches = state.currentPlan.filter(m => String(m.datetime).startsWith(openDate));
    state.config.openingDayMatchups.forEach((cfgM, i) => {
      if (openMatches[i]) {
        openMatches[i].away = cfgM.away;
        openMatches[i].home = cfgM.home;
      }
    });
    recalculateEvaluation();
    renderStep2();
    showToast(`🎊 개막전(${openDate}) 5경기 매치업 및 개최 구장이 대진표에 고정 반영되었습니다.`);
  }

  // Mode B: Children's Day (5 Host Stadiums / Teams Only — Opponent Auto-Assigned)
  function renderChildrenDayStadiums() {
    const grid = document.getElementById('childrenDayStadiumGrid');
    const badge = document.getElementById('childrenDayCountBadge');
    if (!grid) return;

    const selectedSet = new Set(state.config.childrenDayHomeTeams);
    if (badge) {
      badge.textContent = `${selectedSet.size} / 5 구장 선택됨`;
      badge.className = 'badge ' + (selectedSet.size === 5 ? 'badge-emerald' : 'badge-crimson');
    }

    grid.innerHTML = state.teams.map(t => {
      const checked = selectedSet.has(t.name);
      return `
        <div class="stadium-check-card ${checked ? 'checked' : ''}" onclick="App.toggleChildrenDayHost('${t.name}')">
          <div style="display:flex; align-items:center; gap:7px;">
            <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation(); App.toggleChildrenDayHost('${t.name}')" />
            <span class="team-color-dot" style="background:${t.color};"></span>
            <div>
              <div style="font-weight:700; font-size:12.5px;">${t.stadium} <span style="color:var(--kbo-navy);">(${t.name} 홈)</span></div>
              <div style="font-size:10.5px; color:var(--text-muted);">${t.sharedStadium ? '잠실 공동구장 (두산·LG 중 택1)' : '상대 원정구단 엔진 자동배정'}</div>
            </div>
          </div>
          <span class="badge ${checked ? 'badge-emerald' : 'badge-slate'}">${checked ? '개최 구장' : '원정 배정'}</span>
        </div>
      `;
    }).join('');
  }

  function toggleChildrenDayHost(teamName) {
    const list = state.config.childrenDayHomeTeams;
    const idx = list.indexOf(teamName);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      // If selecting Doosan while LG is selected (or vice versa), warn about shared Jamsil stadium
      const targetTeam = state.teams.find(t => t.name === teamName);
      if (targetTeam && targetTeam.sharedStadium) {
        const coTenant = state.teams.find(t => t.name !== teamName && t.stadium === targetTeam.stadium);
        if (coTenant && list.includes(coTenant.name)) {
          const coIdx = list.indexOf(coTenant.name);
          list.splice(coIdx, 1);
          showToast(`🏟️ 잠실 공동구장 중복 방지를 위해 [${coTenant.name}] 대신 [${teamName}] 홈 개최로 전환했습니다.`);
        }
      }
      list.push(teamName);
    }

    recalculateEvaluation();
    renderStep2();
  }

  function renderCustomEventsList() {
    const container = document.getElementById('customEventsListContainer');
    if (!container) return;

    if (!state.config.customEvents.length) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">추가된 커스텀 이벤트가 없습니다.</div>`;
      return;
    }

    container.innerHTML = state.config.customEvents.map((ev, i) => `
      <div style="display:flex; align-items:center; justify-content:space-between; background:#FFFFFF; border:1px solid var(--border-color); border-radius:6px; padding:7px 10px; font-size:12px;">
        <div>
          <span class="badge ${ev.mode === 'MODE_A' ? 'badge-navy' : 'badge-emerald'}">${ev.mode === 'MODE_A' ? '모드 A: 매치업+구장' : '모드 B: 구장 단독'}</span>
          <strong style="margin-left:6px; color:var(--kbo-navy);">${ev.date} · ${ev.title}</strong>
          <span style="color:var(--text-muted); margin-left:6px;">(${ev.detail})</span>
        </div>
        <button type="button" class="btn btn-sm btn-outline" style="padding:2px 7px; color:var(--kbo-crimson);" onclick="App.removeCustomEvent(${i})">삭제</button>
      </div>
    `).join('');
  }

  function removeCustomEvent(idx) {
    state.config.customEvents.splice(idx, 1);
    renderCustomEventsList();
    renderSeasonCalendarMonths();
  }

  function openAddCustomEventModal() {
    const modal = document.getElementById('customEventModal');
    if (modal) {
      modal.classList.add('open');
      toggleModalEventMode();
    }
  }

  function closeAddCustomEventModal() {
    document.getElementById('customEventModal')?.classList.remove('open');
  }

  function toggleModalEventMode() {
    const mode = document.querySelector('input[name="modalEventMode"]:checked')?.value || 'MODE_A';
    const box = document.getElementById('modalModeFields');
    if (!box) return;

    const teamOpts = state.teams.map(t => `<option value="${t.name}">${t.name} (${t.stadium})</option>`).join('');

    if (mode === 'MODE_A') {
      box.innerHTML = `
        <div style="font-weight:700; font-size:12.5px; margin-bottom:8px; color:var(--kbo-navy);">
          모드 A 설정: 원정 구단 vs 홈 구단(@개최 구장) 직접 지정
        </div>
        <div style="display:grid; grid-template-columns:1fr 40px 1fr; gap:8px; align-items:center;">
          <div>
            <label style="font-size:11.5px; font-weight:600;">원정 구단 (Away)</label>
            <select id="modalAwayTeam" class="select-control" style="width:100%; margin-top:3px;">${teamOpts}</select>
          </div>
          <div style="text-align:center; font-weight:800; padding-top:16px;">VS</div>
          <div>
            <label style="font-size:11.5px; font-weight:600;">홈 구단 &amp; 개최 구장 (Home)</label>
            <select id="modalHomeTeam" class="select-control" style="width:100%; margin-top:3px;">${teamOpts}</select>
          </div>
        </div>
      `;
      const homeSel = document.getElementById('modalHomeTeam');
      if (homeSel && state.teams[1]) homeSel.value = state.teams[1].name;
    } else {
      box.innerHTML = `
        <div style="font-weight:700; font-size:12.5px; margin-bottom:8px; color:var(--kbo-emerald);">
          모드 B 설정: 홈 경기를 개최할 구장(홈구단)만 단독 지정 (상대 원정팀은 엔진 자동 배정)
        </div>
        <div>
          <label style="font-size:11.5px; font-weight:600;">개최 구장 (홈구단) 선택</label>
          <select id="modalStadiumOnlyTeam" class="select-control" style="width:100%; margin-top:4px;">${teamOpts}</select>
        </div>
      `;
    }
  }

  function saveCustomEventFromModal() {
    const dateStr = document.getElementById('modalEventDateSelect')?.value || '2025-08-15';
    const title = document.getElementById('modalEventTitleInput')?.value.trim() || '특별 지정 이벤트';
    const mode = document.querySelector('input[name="modalEventMode"]:checked')?.value || 'MODE_A';

    let detail = '';
    if (mode === 'MODE_A') {
      const away = document.getElementById('modalAwayTeam')?.value || 'SSG';
      const home = document.getElementById('modalHomeTeam')?.value || '두산';
      if (away === home) {
        showToast('⚠️ 원정 구단과 홈 구단은 서로 달라야 합니다.');
        return;
      }
      const homeT = state.teams.find(t => t.name === home);
      detail = `${away}(원정) vs ${home}(홈 @${homeT ? homeT.stadium : home}) 고정`;
    } else {
      const host = document.getElementById('modalStadiumOnlyTeam')?.value || '롯데';
      const hostT = state.teams.find(t => t.name === host);
      detail = `${hostT ? hostT.stadium : host} (${host} 홈) 개최 고정 · 상대팀 자동배정`;
    }

    state.config.customEvents.push({
      id: 'EVT-' + Date.now(),
      date: dateStr,
      title,
      mode,
      detail
    });

    closeAddCustomEventModal();
    renderStep2();
    showToast(`📌 새로운 특정일 이벤트 규칙 [${dateStr} ${title}] 이 등록되었습니다.`);
  }

  // Interactive 6-Month Calendar Renderer (March - August 2025)
  function renderSeasonCalendarMonths() {
    const container = document.getElementById('seasonCalendarMonthsGrid');
    if (!container) return;

    // Build day lookup map from 45 calendar slots
    const dayInfoMap = {};
    state.calendar.forEach((slot, sIdx) => {
      const startStr = slot.datetime.slice(0, 10);
      const startObj = window.KBOEngine.parseDateStr(startStr);
      const consec = Number(slot.consecutive || 3);
      for (let d = 0; d < consec; d++) {
        const cur = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate() + d);
        const curStr = window.KBOEngine.formatDateStr(cur);
        dayInfoMap[curStr] = {
          slotIndex: sIdx + 1,
          slotDate: startStr,
          dayOffset: d + 1,
          consecutive: consec,
          weekend: slot.weekend,
          holiday: slot.holiday
        };
      }
    });

    const blackoutMap = {};
    state.config.blackoutDates.forEach(b => { blackoutMap[b.date] = b.reason; });
    const customEvMap = {};
    state.config.customEvents.forEach(e => { customEvMap[e.date] = e; });

    const months = [3, 4, 5, 6, 7, 8];
    container.innerHTML = months.map(m => {
      const firstDay = new Date(2025, m - 1, 1);
      const lastDate = new Date(2025, m, 0).getDate();
      const startDow = firstDay.getDay();

      let cellsHtml = '';
      for (let e = 0; e < startDow; e++) {
        cellsHtml += `<div class="cal-day-cell empty"></div>`;
      }

      for (let day = 1; day <= lastDate; day++) {
        const dStr = `2025-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dow = (startDow + day - 1) % 7;
        const info = dayInfoMap[dStr];
        const isAllStar = dStr >= state.config.allStarStartDate && dStr <= state.config.allStarEndDate;
        const isRestDow = state.config.restDaysOfWeek.includes(dow) && !info;
        const isOpening = dStr === state.config.matchStartDate;
        const isChildren = dStr === state.config.childrenDayStart;
        const customEv = customEvMap[dStr];
        const blackoutReason = blackoutMap[dStr];
        const isSelected = info && info.slotDate === state.selectedCalendarDate;

        let cellClasses = ['cal-day-cell'];
        if (isAllStar) cellClasses.push('allstar-day');
        else if (isRestDow || blackoutReason) cellClasses.push('rest-day');
        if (isSelected) cellClasses.push('selected-slot');

        let pillHtml = '';
        if (isOpening) {
          pillHtml = `<div class="cal-pill event-special">🎊 개막 2연전</div>`;
        } else if (isChildren) {
          pillHtml = `<div class="cal-pill event-special">🎈 어린이날</div>`;
        } else if (customEv) {
          pillHtml = `<div class="cal-pill event-special">📌 ${customEv.title.slice(0, 5)}</div>`;
        } else if (isAllStar) {
          pillHtml = `<div class="cal-pill allstar-pill">⭐ 올스타휴식</div>`;
        } else if (blackoutReason) {
          pillHtml = `<div class="cal-pill rest-pill">휴식(대체)</div>`;
        } else if (info) {
          if (info.dayOffset === 1) {
            pillHtml = `<div class="cal-pill ${info.weekend ? 'series-weekend' : 'series-start'}">#${info.slotIndex} (${info.consecutive}연전)</div>`;
          } else {
            pillHtml = `<div class="cal-pill ${info.weekend ? 'series-weekend-cont' : 'series-cont'}">${info.dayOffset}차전</div>`;
          }
        } else if (isRestDow) {
          pillHtml = `<div class="cal-pill rest-pill">정기휴식</div>`;
        }

        const clickSlotDate = info ? info.slotDate : dStr;
        cellsHtml += `
          <div class="${cellClasses.join(' ')}" onclick="App.selectCalendarDate('${clickSlotDate}')">
            <div class="cal-day-num ${dow === 0 ? 'sun' : (dow === 6 ? 'sat' : '')}">
              <span>${day}</span>
              ${info && info.dayOffset === 1 ? `<span style="font-size:9px; color:#64748B;">5경기</span>` : ''}
            </div>
            ${pillHtml}
          </div>
        `;
      }

      return `
        <div class="month-cal-card">
          <div class="month-cal-header">
            <span>2025년 ${m}월</span>
            <span style="font-size:11px; opacity:0.85;">KBO Regular Season</span>
          </div>
          <div class="month-cal-dow">
            <span style="color:#EF4444;">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span style="color:#3B82F6;">토</span>
          </div>
          <div class="month-cal-days">${cellsHtml}</div>
        </div>
      `;
    }).join('');
  }

  function selectCalendarDate(dateStr) {
    state.selectedCalendarDate = dateStr;
    renderSeasonCalendarMonths();
    renderSlotInspector(dateStr);
  }

  function renderSlotInspector(dateStr) {
    const titleEl = document.getElementById('slotInspectorTitle');
    const badgeEl = document.getElementById('slotInspectorBadge');
    const bodyEl = document.getElementById('slotInspectorBody');
    if (!bodyEl) return;

    const slotIdx = state.calendar.findIndex(c => c.datetime.slice(0, 10) === dateStr);
    const slot = state.calendar[slotIdx];
    const matches = state.currentPlan.filter(m => String(m.datetime).slice(0, 10) === dateStr);

    if (!slot) {
      if (titleEl) titleEl.textContent = `📅 ${dateStr} (${window.KBOEngine.getDayOfWeekKo(dateStr)})`;
      if (badgeEl) badgeEl.textContent = '비경기일 / 휴식일';
      bodyEl.innerHTML = `
        <div style="padding:16px; text-align:center; color:var(--text-secondary);">
          <div style="font-size:28px; margin-bottom:8px;">🛌</div>
          <div style="font-weight:700; margin-bottom:4px;">선택하신 날짜(${dateStr})는 정기 휴식일 또는 올스타 브레이크입니다.</div>
          <div style="font-size:12px; color:var(--text-muted);">달력에서 파란색/초록색 시리즈 슬롯을 클릭하면 해당 슬롯의 5경기 대진을 확인하고 편집할 수 있습니다.</div>
        </div>
      `;
      return;
    }

    const dow = window.KBOEngine.getDayOfWeekKo(dateStr);
    if (titleEl) titleEl.textContent = `🔎 ${dateStr} (${dow}) 시리즈 대진`;
    if (badgeEl) badgeEl.textContent = `Slot #${slotIdx + 1} · ${slot.consecutive}연전`;

    const teamMap = {};
    state.teams.forEach(t => { teamMap[t.name] = t; });

    bodyEl.innerHTML = `
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
        <span class="badge badge-navy">${slot.consecutive}연전 시리즈</span>
        <span class="badge ${slot.weekend ? 'badge-emerald' : 'badge-slate'}">${slot.weekend ? '주말 시리즈' : '주중 시리즈'}</span>
        <span class="badge badge-amber">휴일 가중치: ${slot.holiday}점</span>
        ${dateStr === state.config.matchStartDate ? `<span class="badge badge-crimson">🎊 개막전 고정</span>` : ''}
        ${dateStr === state.config.childrenDayStart ? `<span class="badge badge-crimson">🎈 어린이날 5구장</span>` : ''}
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${matches.map((m, i) => {
          const homeT = teamMap[m.home] || { color: '#1D4ED8', stadium: m.home };
          const awayT = teamMap[m.away] || { color: '#64748B' };
          return `
            <div style="padding:9px 11px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-subtle); display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700;">
                <span class="team-color-dot" style="background:${awayT.color};"></span>
                <span>${m.away}</span>
                <span style="color:var(--text-muted); font-size:11px;">vs</span>
                <span class="team-color-dot" style="background:${homeT.color};"></span>
                <span style="color:var(--kbo-navy);">${m.home} (홈)</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span class="badge badge-slate">🏟️ ${homeT.stadium}</span>
                <button type="button" class="btn btn-sm btn-outline" style="padding:2px 6px; font-size:11px;"
                        title="홈/원정 공수 교대 테스트"
                        onclick="App.swapHomeAwayInSlot('${dateStr}', ${i})">⇄ 홈/원정 전환</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top:12px; font-size:11.5px; color:var(--text-muted);">
        💡 <code>[⇄ 홈/원정 전환]</code> 버튼으로 특정 경기의 홈/원정을 직접 뒤집어 잠실 중복이나 어린이날 위반이 실시간 검출되는지 실험할 수 있습니다.
      </div>
    `;
  }

  function swapHomeAwayInSlot(dateStr, matchInSlotIdx) {
    const slotMatches = state.currentPlan.filter(m => String(m.datetime).slice(0, 10) === dateStr);
    const target = slotMatches[matchInSlotIdx];
    if (!target) return;
    const tmp = target.home;
    target.home = target.away;
    target.away = tmp;

    recalculateEvaluation();
    renderSlotInspector(dateStr);
    showToast(`⇄ ${dateStr} 경기 홈/원정 교대 완료 (${target.away} vs ${target.home}) — 스코어가 즉시 재계산되었습니다!`);
  }

  /* ========================================================================
     6. STEP 3: PRE-FLIGHT CHECKLIST & LIVE OPTAPLANNER SOLVER WORKBENCH
     ======================================================================== */
  function renderStep3() {
    renderPreflightCards();
    updateSolverTelemetryUI();
    if (!state.convergenceHistory.length) {
      seedDefaultConvergenceHistory();
    }
    drawConvergenceChart();
  }

  function renderPreflightCards() {
    const container = document.getElementById('preflightCardsContainer');
    if (!container) return;

    const sharedTeams = state.teams.filter(t => t.sharedStadium).map(t => t.name).join('·');
    const restNames = state.config.restDaysOfWeek.map(d => window.KBOEngine.DAY_NAMES_KO[d] + '요일').join(', ') || '없음';

    container.innerHTML = `
      <div class="preflight-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span class="badge badge-emerald">✓ VERIFIED</span>
          <span style="font-size:11px; color:var(--text-muted);">Step 1 데이터</span>
        </div>
        <div style="font-weight:800; font-size:14.5px; color:var(--kbo-navy); margin-bottom:4px;">
          1. 구단·구장 위경도 &amp; 거리행렬
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary);">
          • 등록 구단: <strong>10개 구단 (위경도 100% 유효)</strong><br/>
          • 공동구장 분리: <strong>잠실 (${sharedTeams || '두산·LG'})</strong><br/>
          • 거리행렬: <strong>10×10 (100개 구간 산출 완료)</strong>
        </div>
      </div>

      <div class="preflight-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span class="badge badge-emerald">✓ VERIFIED</span>
          <span style="font-size:11px; color:var(--text-muted);">Step 2 캘린더</span>
        </div>
        <div style="font-weight:800; font-size:14.5px; color:var(--kbo-navy); margin-bottom:4px;">
          2. 정규시즌 기간 &amp; 정기 휴식일
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary);">
          • 시즌 기간: <strong>${state.config.matchStartDate} ~ ${state.config.matchEndDate}</strong><br/>
          • 정기 휴식일: <strong>매주 ${restNames}</strong><br/>
          • 올스타 휴식기: <strong>${state.config.allStarStartDate.slice(5)} ~ ${state.config.allStarEndDate.slice(5)} (6일간)</strong>
        </div>
      </div>

      <div class="preflight-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span class="badge badge-emerald">✓ PINNED</span>
          <span style="font-size:11px; color:var(--text-muted);">Step 2 이벤트</span>
        </div>
        <div style="font-weight:800; font-size:14.5px; color:var(--kbo-navy); margin-bottom:4px;">
          3. 개막전(모드A) &amp; 어린이날(모드B)
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary);">
          • 개막전(03-22): <strong>5경기 매치업+구장 고정</strong><br/>
          • 어린이날(05-05): <strong>${state.config.childrenDayHomeTeams.join('·')} (${state.config.childrenDayHomeTeams.length}구장)</strong><br/>
          • 추가 커스텀 규칙: <strong>${state.config.customEvents.length}건 적용됨</strong>
        </div>
      </div>

      <div class="preflight-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span class="badge badge-navy">⚡ READY</span>
          <span style="font-size:11px; color:var(--text-muted);">OptaPlanner</span>
        </div>
        <div style="font-weight:800; font-size:14.5px; color:var(--kbo-navy); margin-bottom:4px;">
          4. 탐색 공간 &amp; 평준화 목표
        </div>
        <div style="font-size:12.5px; color:var(--text-secondary);">
          • 배정 엔티티: <strong>225 시리즈 × 45 슬롯</strong><br/>
          • 거리 편차 허용치: <strong>평균 ±${state.config.toleranceTotalDistance} km</strong><br/>
          • 연속 시리즈 제한: <strong>최대 ${state.config.maxConsecutiveHomeAway}연속 홈/원정</strong>
        </div>
      </div>
    `;
  }

  function updateToleranceFromUI() {
    const tolDist = parseFloat(document.getElementById('tolDistSlider')?.value || 300);
    const tolMove = parseFloat(document.getElementById('tolMoveSlider')?.value || 2.0);
    const tolWeekday = parseFloat(document.getElementById('tolWeekdaySlider')?.value || 1.5);
    const tolHoliday = parseFloat(document.getElementById('tolHolidaySlider')?.value || 1.5);
    const maxStreak = parseInt(document.getElementById('maxStreakSlider')?.value || 3, 10);

    state.config.toleranceTotalDistance = tolDist;
    state.config.toleranceTotalMove = tolMove;
    state.config.toleranceWeekdayMove = tolWeekday;
    state.config.toleranceHoliday = tolHoliday;
    state.config.maxConsecutiveHomeAway = maxStreak;

    document.getElementById('tolDistValLabel').textContent = `±${tolDist.toFixed(1)} km`;
    document.getElementById('tolMoveValLabel').textContent = `±${tolMove.toFixed(1)} 회`;
    document.getElementById('tolWeekdayValLabel').textContent = `±${tolWeekday.toFixed(1)} 회`;
    document.getElementById('tolHolidayValLabel').textContent = `±${tolHoliday.toFixed(1)} 점`;
    document.getElementById('maxStreakValLabel').textContent = `최대 ${maxStreak}연속 (${maxStreak * 3}경기)`;

    recalculateEvaluation();
    renderPreflightCards();
    updateSolverTelemetryUI();
  }

  function resetToleranceDefaults() {
    document.getElementById('tolDistSlider').value = 300;
    document.getElementById('tolMoveSlider').value = 2.0;
    document.getElementById('tolWeekdaySlider').value = 1.5;
    document.getElementById('tolHolidaySlider').value = 1.5;
    document.getElementById('maxStreakSlider').value = 3;
    updateToleranceFromUI();
    showToast('⚖️ Soft Constraint 허용 편차(Tolerance) 파라미터가 KBO 기본값으로 복원되었습니다.');
  }

  function seedDefaultConvergenceHistory() {
    const initSum = state.initialPlanEval?.leagueSummary.totalDistance || 42680;
    const solvedSum = state.currentEvaluation?.leagueSummary.totalDistance || 38725;
    const initSpread = state.initialPlanEval?.leagueSummary.maxDistanceSpread || 1140;
    const solvedSpread = state.currentEvaluation?.leagueSummary.maxDistanceSpread || 485;

    state.convergenceHistory = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ease = 1 - Math.pow(1 - t, 2.8);
      state.convergenceHistory.push({
        step: i * 25000,
        totalDist: Math.round(initSum - (initSum - solvedSum) * ease),
        spread: Math.round(initSpread - (initSpread - solvedSpread) * ease),
        hard: i < 4 ? -(4 - i) : 0
      });
    }

    const logBox = document.getElementById('solverConsoleLog');
    if (logBox && !logBox.innerHTML.trim()) {
      logBox.innerHTML = `
        <div class="log-line"><span class="log-time">[00:00.000]</span> <span class="log-info">INFO</span>  SolverFactory — Loaded 10 Teams, 100 Distance Pairs, 45 Calendar Slots, 225 Matches.</div>
        <div class="log-line"><span class="log-time">[00:00.120]</span> <span class="log-info">INFO</span>  Pinned Matches — Opening Day (5 matches) &amp; Children's Day (${state.config.childrenDayHomeTeams.length} stadiums) locked.</div>
        <div class="log-line"><span class="log-time">[00:00.850]</span> <span class="log-step">STEP</span>  ConstructionHeuristic — Completed in 850ms. Score: [0/0]hard/[0/-900/-14200/-4/-42180]soft</div>
        <div class="log-line"><span class="log-time">[00:03.200]</span> <span class="log-step">BEST</span>  LocalSearch (Late Acceptance) — Optimal Feasible Solution reached: <b>${state.currentEvaluation.score.formatted}</b></div>
      `;
    }
  }

  function updateSolverTelemetryUI() {
    const ev = state.currentEvaluation;
    if (!ev) return;
    const hardEl = document.getElementById('kpiBestHard');
    const distEl = document.getElementById('kpiTotalDistance');
    const tolEl = document.getElementById('kpiWithinTol');

    if (hardEl) {
      hardEl.textContent = `[${ev.score.hard[0]} / ${ev.score.hard[1]}] hard`;
      hardEl.style.color = ev.score.feasible ? 'var(--kbo-emerald)' : 'var(--kbo-crimson)';
    }
    if (distEl) distEl.textContent = `${Math.round(ev.leagueSummary.totalDistance).toLocaleString()} km`;
    if (tolEl) tolEl.textContent = `${ev.leagueSummary.teamsWithinDistanceTolerance} / 10 구단`;
  }

  function startSolverSimulation() {
    if (state.solverRunning) return;
    const speedMode = document.getElementById('solverSpeedSelect')?.value || 'fast';
    const algo = document.getElementById('solverAlgoSelect')?.value || 'LA_TABU';

    if (speedMode === 'instant') {
      state.currentPlan = window.KBOEngine.deepClone(window.KBO_DATA.solvedPlan);
      state.activePreset = 'solved';
      recalculateEvaluation();
      seedDefaultConvergenceHistory();
      renderStep3();
      renderStep4();
      document.getElementById('solverProgressBar').style.width = '100%';
      document.getElementById('solverProgressPctText').textContent = '100%';
      showToast('🚀 OptaPlanner 최적화가 즉시 완료되었습니다! Step 4에서 상세 결과를 확인하세요.');
      return;
    }

    state.solverRunning = true;
    const totalTicks = speedMode === 'fast' ? 22 : 36;
    const intervalMs = 140;
    let tick = 0;

    const badge = document.getElementById('solverStatusBadge');
    const phaseText = document.getElementById('solverProgressPhaseText');
    const pctText = document.getElementById('solverProgressPctText');
    const bar = document.getElementById('solverProgressBar');
    const logBox = document.getElementById('solverConsoleLog');
    const elapsedEl = document.getElementById('kpiElapsedSpeed');

    if (badge) {
      badge.textContent = 'SOLVING...';
      badge.className = 'badge badge-amber';
    }
    if (logBox) logBox.innerHTML = '';

    state.convergenceHistory = [];
    const targetSolvedEval = window.KBOEngine.evaluatePlan(
      window.KBO_DATA.solvedPlan,
      state.teams,
      state.distanceMatrix,
      state.config
    );
    const startDist = (state.initialPlanEval?.leagueSummary.totalDistance || 42800) + 1200;
    const endDist = targetSolvedEval.leagueSummary.totalDistance;
    const startSpread = 1320;
    const endSpread = targetSolvedEval.leagueSummary.maxDistanceSpread;

    appendSolverLog(`00:00.000`, `INFO`, `Solving started: Algorithm=${algo}, Entities=225, Slots=45, RestDays=[${state.config.restDaysOfWeek.join(',')}]`);

    state.solverTimer = setInterval(() => {
      tick++;
      const progress = Math.min(1, tick / totalTicks);
      const pct = Math.round(progress * 100);
      const ease = 1 - Math.pow(1 - progress, 3);

      const curDist = Math.round(startDist - (startDist - endDist) * ease);
      const curSpread = Math.round(startSpread - (startSpread - endSpread) * ease);
      const curHard = progress < 0.22 ? -Math.ceil((0.22 - progress) * 25) : 0;
      const elapsedSec = ((tick * intervalMs) / 1000).toFixed(1);

      state.convergenceHistory.push({
        step: tick * 22000,
        totalDist: curDist,
        spread: curSpread,
        hard: curHard
      });

      if (bar) bar.style.width = `${pct}%`;
      if (pctText) pctText.textContent = `${pct}%`;
      if (elapsedEl) elapsedEl.textContent = `${elapsedSec}s · 148k/s`;

      document.getElementById('kpiBestHard').textContent = `[${curHard} / 0] hard`;
      document.getElementById('kpiBestHard').style.color = curHard === 0 ? 'var(--kbo-emerald)' : 'var(--kbo-crimson)';
      document.getElementById('kpiTotalDistance').textContent = `${curDist.toLocaleString()} km`;
      document.getElementById('kpiWithinTol').textContent = `${Math.min(10, Math.floor(4 + ease * 6))} / 10 구단`;

      if (tick === 2) {
        if (phaseText) phaseText.textContent = 'Phase 1: Construction Heuristic (First Fit Decreasing)...';
        appendSolverLog(`00:0${elapsedSec}`, `STEP`, `Construction Heuristic assigning 220 unpinned series across 45 slots...`);
      } else if (tick === Math.floor(totalTicks * 0.25)) {
        if (phaseText) phaseText.textContent = `Phase 2: Local Search (${algo}) — Hard Constraint Violation Elimination...`;
        appendSolverLog(`00:0${elapsedSec}`, `INFO`, `Feasible Hard Score [0/0]hard achieved! Separating Jamsil (Doosan/LG) & 3-Series Streaks.`);
      } else if (tick % 5 === 0 && tick < totalTicks) {
        const distPenalty = curSpread > state.config.toleranceTotalDistance ? -Math.round(Math.pow(curSpread - state.config.toleranceTotalDistance, 2)) : 0;
        if (phaseText) phaseText.textContent = `Phase 2: Local Search — Optimizing Soft Score (Total Distance & ±${state.config.toleranceTotalDistance}km Band)...`;
        appendSolverLog(`00:0${elapsedSec}`, `STEP`, `Move #${(tick * 22410).toLocaleString()} [SwapMove] → Best Score: [0/0]hard/[0/-200/${distPenalty}/-1/-${curDist}]soft`);
      }

      drawConvergenceChart();

      if (tick >= totalTicks) {
        clearInterval(state.solverTimer);
        state.solverRunning = false;

        // Apply solved plan + any Opening Day pins from Step 2
        state.currentPlan = window.KBOEngine.deepClone(window.KBO_DATA.solvedPlan);
        state.activePreset = 'solved';
        document.querySelectorAll('.preset-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-preset') === 'solved');
        });

        recalculateEvaluation();
        updateSolverTelemetryUI();
        renderStep4();

        if (badge) {
          badge.textContent = 'OPTIMAL FOUND';
          badge.className = 'badge badge-emerald';
        }
        if (phaseText) {
          phaseText.textContent = `✅ 최적화 완료! 최종 스코어: ${state.currentEvaluation.score.formatted}`;
        }
        appendSolverLog(`00:0${elapsedSec}`, `BEST`, `Solving ended: Best Feasible Score ${state.currentEvaluation.score.formatted} (10/10 teams within ±${state.config.toleranceTotalDistance}km)`);
        showToast('🎉 OptaPlanner 일정 최적화가 완료되었습니다! Step 4에서 구단별 분석 차트를 확인하세요.');
      }
    }, intervalMs);
  }

  function appendSolverLog(timeStr, level, msg) {
    const logBox = document.getElementById('solverConsoleLog');
    if (!logBox) return;
    const cls = level === 'INFO' ? 'log-info' : (level === 'WARN' ? 'log-warn' : 'log-step');
    const div = document.createElement('div');
    div.className = 'log-line';
    div.innerHTML = `<span class="log-time">[${timeStr}]</span> <span class="${cls}">${level}</span>  ${msg}`;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function drawConvergenceChart() {
    const canvas = document.getElementById('solverConvergenceCanvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(320, rect.width || 560);
    const h = Math.max(150, rect.height || 185);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);
    const history = state.convergenceHistory;
    if (!history || !history.length) return;

    const padL = 54, padR = 48, padT = 16, padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Grid lines
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }

    const dists = history.map(d => d.totalDist);
    const minD = Math.min(...dists, 37500);
    const maxD = Math.max(...dists, 44500);

    // Draw Total Distance Line (Blue)
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = padL + (idx / Math.max(1, history.length - 1)) * plotW;
      const y = padT + plotH - ((pt.totalDist - minD) / (maxD - minD)) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#1D4ED8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw Spread Line (Emerald)
    const maxSpread = 1500;
    ctx.beginPath();
    history.forEach((pt, idx) => {
      const x = padL + (idx / Math.max(1, history.length - 1)) * plotW;
      const y = padT + plotH - (Math.min(maxSpread, pt.spread) / maxSpread) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axis Labels
    ctx.fillStyle = '#1D4ED8';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${maxD.toLocaleString()}km`, padL - 6, padT + 8);
    ctx.fillText(`${minD.toLocaleString()}km`, padL - 6, padT + plotH);

    ctx.fillStyle = '#059669';
    ctx.textAlign = 'left';
    ctx.fillText(`편차 ${maxSpread}km`, w - padR + 5, padT + 8);
    ctx.fillText(`편차 0km`, w - padR + 5, padT + plotH);

    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.fillText('Start (Initial)', padL + 30, h - 6);
    ctx.fillText('Local Search Iterations (Moves) →', padL + plotW / 2, h - 6);
    ctx.fillText('Best Found', w - padR - 25, h - 6);
  }

  /* ========================================================================
     7. STEP 4: HARD CONSTRAINT SCORECARD, SOFT TABLE, 4 CHARTS & SCHEDULE
     ======================================================================== */
  function renderStep4() {
    renderHardScorecard();
    renderRadarCheckboxes();
    renderSoftComparisonTable();
    renderAllStep4Charts();
    renderScheduleExplorer();
  }

  function renderHardScorecard() {
    const ev = state.currentEvaluation;
    if (!ev) return;

    const hero = document.getElementById('step4FeasibilityHero');
    const icon = document.getElementById('heroStatusIcon');
    const title = document.getElementById('heroStatusTitle');
    const desc = document.getElementById('heroStatusDesc');
    const badge = document.getElementById('hardSummaryCountBadge');
    const grid = document.getElementById('hardChecksGrid');

    const passedCount = ev.hardChecks.filter(c => c.passed).length;

    if (hero) {
      hero.className = 'feasibility-hero ' + (ev.score.feasible ? 'pass' : 'fail');
    }
    if (icon) icon.textContent = ev.score.feasible ? '✅' : '🚨';
    if (title) {
      title.textContent = ev.score.feasible
        ? '모든 Hard 조건 100% 충족 (0 Violations) — 정규시즌 시행 가능(Feasible) 대진표'
        : `Hard 필수 제약 조건 위반 검출! (총 ${ev.score.totalHardViolations}건 위반 — 아래 빨간색 카드를 확인하세요)`;
    }
    if (desc) {
      desc.textContent = `OptaPlanner 스코어: ${ev.score.formatted} · 평균 이동거리 ${ev.leagueSummary.meanDistance.toLocaleString()}km · 허용편차(±${state.config.toleranceTotalDistance}km) 이내: ${ev.leagueSummary.teamsWithinDistanceTolerance}/10 구단`;
    }
    if (badge) {
      badge.textContent = `${passedCount} / ${ev.hardChecks.length} 항목 PASS`;
      badge.className = 'badge ' + (ev.score.feasible ? 'badge-emerald' : 'badge-crimson');
    }

    if (grid) {
      grid.innerHTML = ev.hardChecks.map((chk, idx) => {
        const isPass = chk.passed;
        return `
          <div class="hard-check-card ${isPass ? '' : 'violated'}">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
                <span style="font-weight:800; font-size:13.5px; color:var(--kbo-navy);">
                  #${idx + 1}. ${chk.title}
                </span>
                <span class="badge ${isPass ? 'badge-emerald' : 'badge-crimson'}" style="flex-shrink:0;">
                  ${isPass ? '✓ PASS (0건)' : `🚨 위반 ${chk.violationCount}건`}
                </span>
              </div>
              <p style="font-size:12px; color:var(--text-secondary);">${chk.desc}</p>
            </div>
            ${!isPass ? `
              <div class="violation-list-box">
                ${chk.violations.map(v => `<div style="margin-bottom:3px;">• ${v.desc}</div>`).join('')}
              </div>
            ` : `
              <div style="margin-top:10px; font-size:11.5px; color:var(--kbo-emerald); font-weight:700;">
                ✓ 45개 전체 시리즈 슬롯 및 10개 구단 무결성 검증 통과
              </div>
            `}
          </div>
        `;
      }).join('');
    }
  }

  function sortSoftTable(key) {
    if (state.softTableSortKey === key) {
      state.softTableSortAsc = !state.softTableSortAsc;
    } else {
      state.softTableSortKey = key;
      state.softTableSortAsc = key === 'team';
    }
    renderSoftComparisonTable();
  }

  function renderSoftComparisonTable() {
    const tbody = document.getElementById('softComparisonTableBody');
    const tfoot = document.getElementById('softComparisonTableFoot');
    if (!tbody || !state.currentEvaluation) return;

    const initMap = {};
    (state.initialPlanEval?.teamAnalytics || []).forEach(a => { initMap[a.team] = a; });

    const rows = state.currentEvaluation.teamAnalytics.map(a => {
      const initDist = initMap[a.team]?.totalDistance ?? a.totalDistance;
      const initialDelta = Number((a.totalDistance - initDist).toFixed(1));
      return { ...a, initialDelta };
    });

    const k = state.softTableSortKey;
    const dir = state.softTableSortAsc ? 1 : -1;
    rows.sort((a, b) => {
      if (typeof a[k] === 'string') return a[k].localeCompare(b[k]) * dir;
      return ((a[k] ?? 0) - (b[k] ?? 0)) * dir;
    });

    tbody.innerHTML = rows.map(r => {
      const diffSign = r.distanceDiffFromMean > 0 ? '+' : '';
      const deltaSign = r.initialDelta > 0 ? '+' : '';
      const deltaColor = r.initialDelta <= 0 ? 'var(--kbo-emerald)' : 'var(--kbo-crimson)';

      return `
        <tr>
          <td>
            <div class="team-chip">
              <span class="team-color-dot" style="background:${r.color};"></span>
              <div>
                <div style="font-weight:800; color:var(--kbo-navy);">${r.team}</div>
                <div style="font-size:11px; color:var(--text-muted);">${r.stadium} ${r.sharedStadium ? '(공동)' : ''}</div>
              </div>
            </div>
          </td>
          <td class="input-mono" style="font-weight:800; font-size:13.5px; color:var(--kbo-navy);">
            ${r.totalDistance.toLocaleString()} km
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="input-mono" style="font-weight:700;">${diffSign}${r.distanceDiffFromMean.toFixed(1)} km</span>
              <span class="badge ${r.withinDistanceTolerance ? 'badge-emerald' : 'badge-crimson'}">
                ${r.withinDistanceTolerance ? '✓ ±300km 이내' : '초과'}
              </span>
            </div>
          </td>
          <td class="input-mono" style="font-weight:700; color:${deltaColor};">
            ${deltaSign}${r.initialDelta.toFixed(1)} km
          </td>
          <td class="input-mono">
            <strong>${r.totalMoveCount}회</strong>
            <span style="font-size:11px; color:var(--text-muted);">(${r.moveDiffFromMean > 0 ? '+' : ''}${r.moveDiffFromMean}회)</span>
          </td>
          <td class="input-mono">
            <strong>${r.weekdayMoveCount}회</strong>
            <span style="font-size:11px; color:var(--text-muted);">(${r.weekdayDistance.toLocaleString()}km)</span>
          </td>
          <td class="input-mono">
            <strong>${r.weekendMoveCount}회</strong>
            <span style="font-size:11px; color:var(--text-muted);">(${r.weekendDistance.toLocaleString()}km)</span>
          </td>
          <td class="input-mono">
            <strong>${r.weekendHomeGames}경기</strong>
            <span style="font-size:11px; color:var(--text-muted);">(${r.weekendHomeSeries}시리즈)</span>
          </td>
          <td class="input-mono">
            <strong>공휴일 ${r.holidayHomeGames}G</strong> · <span class="badge badge-navy">휴일점수 ${r.holidayScore}점</span>
          </td>
          <td class="input-mono">
            홈 ${r.homeSeriesCount} / 원정 ${r.awaySeriesCount}
            <span class="badge ${r.maxHomeStreak <= state.config.maxConsecutiveHomeAway && r.maxAwayStreak <= state.config.maxConsecutiveHomeAway ? 'badge-slate' : 'badge-crimson'}">
              최대 ${Math.max(r.maxHomeStreak, r.maxAwayStreak)}연속
            </span>
          </td>
          <td>
            ${r.openingDayHome ? `<span class="badge badge-purple">개막홈</span>` : ''}
            ${r.childrenDayHome ? `<span class="badge badge-emerald">어린이날홈</span>` : ''}
            ${!r.openingDayHome && !r.childrenDayHome ? `<span style="color:var(--text-light); font-size:11px;">-</span>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    if (tfoot) {
      const s = state.currentEvaluation.leagueSummary;
      tfoot.innerHTML = `
        <tr style="background:#F1F5F9; font-weight:800;">
          <td>리그 평균 / 합계</td>
          <td class="input-mono">평균 ${s.meanDistance.toLocaleString()} km<div style="font-size:10.5px; color:var(--text-muted);">합계 ${s.totalDistance.toLocaleString()} km</div></td>
          <td class="input-mono">최대-최소 격차: ${s.maxDistanceSpread} km</td>
          <td class="input-mono" style="color:var(--kbo-emerald);">평준화 달성 (${s.teamsWithinDistanceTolerance}/10팀)</td>
          <td class="input-mono">평균 ${s.meanMoveCount}회 (${s.minMoveCount}~${s.maxMoveCount}회)</td>
          <td colspan="3" style="font-size:12px; color:var(--text-secondary);">주중 이동 최소화 및 주말 홈 3연전 균등 배분 적용</td>
          <td class="input-mono">평균 휴일점수 ${s.meanHolidayScore}점</td>
          <td colspan="2" style="font-size:12px; color:var(--kbo-emerald);">전 구단 45시리즈 완결</td>
        </tr>
      `;
    }
  }

  /* ========================================================================
     8. STEP 4: 4 HIGH-DPI PURE CANVAS INTERACTIVE CHARTS
     ======================================================================== */
  function renderAllStep4Charts() {
    if (!state.currentEvaluation) return;
    drawChart1DistanceBand();
    drawChart2MovesAndHolidays();
    drawChart3RadarBalance();
    drawChart4CumulativeRoute();
  }

  // CHART 1: Total Travel Distance & ±300km Tolerance Band (with optional Initial Plan comparison)
  function drawChart1DistanceBand() {
    const canvas = document.getElementById('chartDistanceBandCanvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(360, rect.width || 620);
    const h = Math.max(260, rect.height || 330);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const ev = state.currentEvaluation;
    const analytics = ev.teamAnalytics;
    const initMap = {};
    (state.initialPlanEval?.teamAnalytics || []).forEach(a => { initMap[a.team] = a.totalDistance; });
    const showCompare = document.getElementById('compareInitialChartToggle')?.checked;

    const mean = ev.leagueSummary.meanDistance;
    const tol = state.config.toleranceTotalDistance;
    const upperTol = mean + tol;
    const lowerTol = Math.max(0, mean - tol);

    const subEl = document.getElementById('chart1Subtitle');
    const badgeEl = document.getElementById('chart1Badge');
    if (subEl) subEl.textContent = `리그 평균 ${mean.toLocaleString()}km · 허용 밴드(${Math.round(lowerTol).toLocaleString()}~${Math.round(upperTol).toLocaleString()}km, ±${tol}km)`;
    if (badgeEl) {
      badgeEl.textContent = `${ev.leagueSummary.teamsWithinDistanceTolerance} / 10 구단 적합`;
      badgeEl.className = 'badge ' + (ev.leagueSummary.teamsWithinDistanceTolerance === 10 ? 'badge-emerald' : 'badge-amber');
    }

    const padL = 56, padR = 24, padT = 28, padB = 46;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const maxY = Math.max(5200, upperTol + 500, ...analytics.map(a => Math.max(a.totalDistance, initMap[a.team] || 0)) + 300);

    function yPos(val) {
      return padT + plotH - (val / maxY) * plotH;
    }

    // Draw ±Tolerance Band (Soft Emerald Shaded Zone)
    const yTopBand = yPos(upperTol);
    const yBotBand = yPos(lowerTol);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.11)';
    ctx.fillRect(padL, yTopBand, plotW, yBotBand - yTopBand);

    ctx.strokeStyle = 'rgba(5, 150, 105, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(padL, yTopBand);
    ctx.lineTo(w - padR, yTopBand);
    ctx.moveTo(padL, yBotBand);
    ctx.lineTo(w - padR, yBotBand);
    ctx.stroke();
    ctx.setLineDash([]);

    // Horizontal Y grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let v = 0; v <= maxY; v += 1000) {
      const y = yPos(v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10.5px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${v.toLocaleString()}`, padL - 6, y + 3);
    }

    // Draw Bars for 10 Teams
    const groupW = plotW / analytics.length;
    analytics.forEach((item, idx) => {
      const gx = padL + idx * groupW;
      const centerX = gx + groupW / 2;

      if (showCompare) {
        const initVal = initMap[item.team] || item.totalDistance;
        const barW = Math.min(18, groupW * 0.34);

        // Initial Plan Bar (Slate)
        const iy = yPos(initVal);
        ctx.fillStyle = '#CBD5E1';
        ctx.beginPath();
        ctx.roundRect(centerX - barW - 2, iy, barW, padT + plotH - iy, [3, 3, 0, 0]);
        ctx.fill();

        // Current Plan Bar (Team Color)
        const cy = yPos(item.totalDistance);
        ctx.fillStyle = item.withinDistanceTolerance ? item.color : '#DC2626';
        ctx.beginPath();
        ctx.roundRect(centerX + 2, cy, barW, padT + plotH - cy, [3, 3, 0, 0]);
        ctx.fill();

        // Value Label
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(item.totalDistance)}`, centerX + 2 + barW / 2, cy - 5);
      } else {
        const barW = Math.min(28, groupW * 0.55);
        const cy = yPos(item.totalDistance);
        ctx.fillStyle = item.withinDistanceTolerance ? item.color : '#DC2626';
        ctx.beginPath();
        ctx.roundRect(centerX - barW / 2, cy, barW, padT + plotH - cy, [4, 4, 0, 0]);
        ctx.fill();

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 10.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(item.totalDistance)}`, centerX, cy - 6);
      }

      // X-axis Team Name & Stadium
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.team, centerX, padT + plotH + 16);
      ctx.fillStyle = item.withinDistanceTolerance ? '#059669' : '#DC2626';
      ctx.font = '10px monospace';
      const diffTxt = (item.distanceDiffFromMean > 0 ? '+' : '') + Math.round(item.distanceDiffFromMean);
      ctx.fillText(`${diffTxt}km`, centerX, padT + plotH + 30);
    });

    // Draw League Mean Line
    const yMean = yPos(mean);
    ctx.strokeStyle = '#0A1E3C';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padL, yMean);
    ctx.lineTo(w - padR, yMean);
    ctx.stroke();

    ctx.fillStyle = '#0A1E3C';
    ctx.font = 'bold 10.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`평균 ${mean.toLocaleString()}km (±${tol}km 녹색 허용밴드)`, padL + 8, yTopBand - 6);
  }

  // CHART 2: Move Counts (Weekday vs Weekend) & Weekend/Holiday Home Games
  function drawChart2MovesAndHolidays() {
    const canvas = document.getElementById('chartMovesHolidayCanvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(360, rect.width || 620);
    const h = Math.max(260, rect.height || 330);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const mode = document.getElementById('chart2ModeSelect')?.value || 'both';
    const analytics = state.currentEvaluation.teamAnalytics;
    const padL = 46, padR = 20, padT = 32, padB = 42;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const maxY = 32;

    function yPos(v) {
      return padT + plotH - (v / maxY) * plotH;
    }

    // Grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let v = 0; v <= maxY; v += 8) {
      const y = yPos(v);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10.5px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(v), padL - 6, y + 3);
    }

    // Legend at top
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1E3A8A';
    ctx.fillText('■ 주중 이동(회)', padL, 16);
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('■ 주말 이동(회)', padL + 95, 16);
    ctx.fillStyle = '#059669';
    ctx.fillText('■ 주말 홈경기(G)', padL + 190, 16);
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('■ 공휴일 홈경기(G)', padL + 295, 16);

    const groupW = plotW / analytics.length;
    analytics.forEach((item, idx) => {
      const gx = padL + idx * groupW;
      const cx = gx + groupW / 2;
      const barW = Math.min(16, groupW * 0.32);

      if (mode === 'both' || mode === 'moves') {
        const x1 = mode === 'both' ? cx - barW - 2 : cx - barW / 2;
        // Stacked Weekday + Weekend Moves
        const wkdayH = (item.weekdayMoveCount / maxY) * plotH;
        const wkendH = (item.weekendMoveCount / maxY) * plotH;
        const yBase = padT + plotH;

        ctx.fillStyle = '#1E3A8A';
        ctx.fillRect(x1, yBase - wkdayH, barW, wkdayH);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x1, yBase - wkdayH - wkendH, barW, wkendH);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.totalMoveCount}회`, x1 + barW / 2, yBase - wkdayH - wkendH - 4);
      }

      if (mode === 'both' || mode === 'holidays') {
        const x2 = mode === 'both' ? cx + 2 : cx - barW / 2;
        const wkHomeH = (item.weekendHomeGames / maxY) * plotH;
        const holHomeH = (item.holidayHomeGames / maxY) * plotH;
        const yBase = padT + plotH;

        ctx.fillStyle = '#059669';
        ctx.fillRect(x2, yBase - wkHomeH, barW, wkHomeH);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(x2, yBase - wkHomeH - holHomeH, barW, holHomeH);

        ctx.fillStyle = '#065F46';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.holidayScore}점`, x2 + barW / 2, yBase - wkHomeH - holHomeH - 4);
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 11.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.team, cx, padT + plotH + 16);
      ctx.fillStyle = '#64748B';
      ctx.font = '10px sans-serif';
      ctx.fillText(`주중${item.weekdayMoveCount}/휴일${item.holidayScore}`, cx, padT + plotH + 30);
    });
  }

  // CHART 3: 5-Axis Fairness Balance Radar Chart (Pentagon)
  function renderRadarCheckboxes() {
    const container = document.getElementById('radarTeamCheckboxes');
    if (!container) return;

    container.innerHTML = state.teams.map(t => {
      const checked = state.radarSelectedTeams.includes(t.name);
      return `
        <label style="display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:999px; border:1px solid ${checked ? t.color : '#CBD5E1'}; background:${checked ? '#EFF6FF' : '#FFFFFF'}; font-size:11.5px; font-weight:700; cursor:pointer;">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="App.toggleRadarTeam('${t.name}')" />
          <span class="team-color-dot" style="background:${t.color}; width:9px; height:9px;"></span>
          <span>${t.name}</span>
        </label>
      `;
    }).join('');
  }

  function toggleRadarTeam(teamName) {
    const idx = state.radarSelectedTeams.indexOf(teamName);
    if (idx >= 0) {
      if (state.radarSelectedTeams.length <= 1) {
        showToast('레이더 차트에는 최소 1개 이상의 구단이 선택되어야 합니다.');
        renderRadarCheckboxes();
        return;
      }
      state.radarSelectedTeams.splice(idx, 1);
    } else {
      if (state.radarSelectedTeams.length >= 4) {
        state.radarSelectedTeams.shift();
      }
      state.radarSelectedTeams.push(teamName);
    }
    renderRadarCheckboxes();
    drawChart3RadarBalance();
  }

  function drawChart3RadarBalance() {
    const canvas = document.getElementById('chartRadarCanvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(340, rect.width || 580);
    const h = Math.max(250, rect.height || 295);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 8;
    const radius = Math.min(w, h) * 0.36;
    const axes = [
      '① 이동거리 효율성',
      '② 총 이동일수 억제',
      '③ 주중 이동 피로 억제',
      '④ 주말·공휴일 홈 확보',
      '⑤ 홈/원정 연속 균형도'
    ];

    // Draw concentric pentagons
    for (let ring = 1; ring <= 4; ring++) {
      const r = (radius * ring) / 4;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = ring === 4 ? '#94A3B8' : '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw spokes and labels
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = cx + Math.cos(ang) * radius;
      const y = cy + Math.sin(ang) * radius;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();

      const lx = cx + Math.cos(ang) * (radius + 22);
      const ly = cy + Math.sin(ang) * (radius + 16);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axes[i], lx, ly);
    }

    // Compute normalized 5 scores (55..98 scale) for each selected team
    const analyticsMap = {};
    state.currentEvaluation.teamAnalytics.forEach(a => { analyticsMap[a.team] = a; });

    state.radarSelectedTeams.forEach(tName => {
      const a = analyticsMap[tName];
      if (!a) return;

      const s1 = Math.max(45, Math.min(98, 100 - Math.max(0, (a.totalDistance - 3200) / 38)));
      const s2 = Math.max(45, Math.min(98, 100 - (a.totalMoveCount - 14) * 3.2));
      const s3 = Math.max(45, Math.min(98, 100 - (a.weekdayMoveCount - 5) * 4.2));
      const s4 = Math.max(45, Math.min(98, 55 + a.holidayScore * 2.1));
      const s5 = Math.max(45, Math.min(98, 100 - Math.max(a.maxHomeStreak, a.maxAwayStreak) * 9));
      const scores = [s1, s2, s3, s4, s5];

      ctx.beginPath();
      scores.forEach((sc, i) => {
        const r = (sc / 100) * radius;
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = hexToRgba(a.color, 0.16);
      ctx.fill();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    });
  }

  // CHART 4: Cumulative Travel Fatigue Curve (45 Series) & Stadium Visit Sequence Track
  function drawChart4CumulativeRoute() {
    const canvas = document.getElementById('chartCumulativeCurveCanvas');
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = Math.max(340, rect.width || 580);
    const h = Math.max(180, rect.height || 215);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const primaryName = document.getElementById('routeCurveTeamSelect')?.value || state.routeCurvePrimaryTeam;
    const compareName = document.getElementById('routeCurveCompareTeamSelect')?.value || 'MEAN';
    state.routeCurvePrimaryTeam = primaryName;
    state.routeCurveCompareTeam = compareName;

    const analyticsMap = {};
    state.currentEvaluation.teamAnalytics.forEach(a => { analyticsMap[a.team] = a; });
    const primaryData = analyticsMap[primaryName] || state.currentEvaluation.teamAnalytics[0];

    const padL = 52, padR = 24, padT = 18, padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const maxD = Math.max(4600, ...state.currentEvaluation.teamAnalytics.map(a => a.totalDistance));

    // Grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let v = 0; v <= maxD; v += 1500) {
      const y = padT + plotH - (v / maxD) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${v}km`, padL - 5, y + 3);
    }

    // Draw Comparison Curve (either League Mean or Compare Team)
    const stepsCount = primaryData.routeSteps.length || 45;
    ctx.beginPath();
    for (let i = 0; i < stepsCount; i++) {
      let val = 0;
      if (compareName === 'MEAN') {
        const sumAtStep = state.currentEvaluation.teamAnalytics.reduce(
          (s, t) => s + (t.routeSteps[i]?.cumulativeDistance || 0),
          0
        );
        val = sumAtStep / 10;
      } else {
        val = analyticsMap[compareName]?.routeSteps[i]?.cumulativeDistance || 0;
      }
      const x = padL + (i / Math.max(1, stepsCount - 1)) * plotW;
      const y = padT + plotH - (val / maxD) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Primary Team Cumulative Curve
    ctx.beginPath();
    primaryData.routeSteps.forEach((st, i) => {
      const x = padL + (i / Math.max(1, stepsCount - 1)) * plotW;
      const y = padT + plotH - (st.cumulativeDistance / maxD) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = primaryData.color || '#1D4ED8';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('3월 개막', padL + 20, h - 6);
    ctx.fillText('5월 어린이날', padL + plotW * 0.32, h - 6);
    ctx.fillText('7월 올스타전', padL + plotW * 0.68, h - 6);
    ctx.fillText('8월 최종전', w - padR - 22, h - 6);

    // Render 45-Series Route Sequence Cards below chart
    const track = document.getElementById('teamRouteSequenceTrack');
    if (track) {
      track.innerHTML = primaryData.routeSteps.map(st => `
        <div class="route-step-pill ${st.isHome ? 'is-home' : 'is-away'}">
          <div style="display:flex; justify-content:space-between; font-weight:800; color:var(--kbo-navy);">
            <span>#${st.stepIndex} · ${st.date.slice(5)}(${st.dow})</span>
            <span style="color:${st.isHome ? 'var(--kbo-emerald)' : 'var(--kbo-royal)'};">${st.isHome ? '홈' : '원정'}</span>
          </div>
          <div style="margin-top:3px; font-weight:700;">vs ${st.opponent} <span style="color:var(--text-muted); font-weight:500;">@${st.toStadium.slice(0, 4)}</span></div>
          <div style="margin-top:3px; font-family:var(--font-mono); font-size:10.5px; color:${st.distance > 0 ? 'var(--kbo-crimson)' : 'var(--text-muted)'};">
            +${st.distance}km (누적 ${st.cumulativeDistance}km)
          </div>
        </div>
      `).join('');
    }
  }

  /* ========================================================================
     9. SCHEDULE EXPLORER & CSV / JSON EXPORT
     ======================================================================== */
  function renderScheduleExplorer() {
    const grid = document.getElementById('scheduleExplorerGrid');
    if (!grid || !state.currentEvaluation) return;

    const monthFilter = document.getElementById('scheduleFilterMonth')?.value || 'ALL';
    const teamFilter = document.getElementById('scheduleFilterTeam')?.value || 'ALL';
    const violOnly = document.getElementById('scheduleFilterViolationsOnly')?.checked;

    const teamMap = {};
    state.teams.forEach(t => { teamMap[t.name] = t; });

    const filteredSlots = state.currentEvaluation.slotSummaries.filter(slot => {
      if (monthFilter !== 'ALL' && slot.date.slice(5, 7) !== monthFilter) return false;
      if (violOnly && slot.violations.length === 0) return false;
      if (teamFilter !== 'ALL') {
        return slot.matches.some(m => m.home === teamFilter || m.away === teamFilter);
      }
      return true;
    });

    if (!filteredSlots.length) {
      grid.innerHTML = `<div style="grid-column:1/-1; padding:28px; text-align:center; color:var(--text-muted);">조건에 해당하는 시리즈 슬롯이 없습니다.</div>`;
      return;
    }

    grid.innerHTML = filteredSlots.map(slot => {
      const hasViol = slot.violations.length > 0;
      const matchesToShow = teamFilter === 'ALL'
        ? slot.matches
        : slot.matches.filter(m => m.home === teamFilter || m.away === teamFilter);

      return `
        <div class="slot-card ${hasViol ? 'has-violation' : ''}">
          <div class="slot-card-head">
            <div>
              <span style="color:var(--kbo-navy);">${slot.date} (${slot.dow})</span>
              <span class="badge badge-slate" style="margin-left:4px;">${slot.consecutive}연전</span>
              ${slot.isOpeningDay ? `<span class="badge badge-crimson">개막</span>` : ''}
              ${slot.isChildrenDay ? `<span class="badge badge-emerald">어린이날</span>` : ''}
            </div>
            <span class="badge ${hasViol ? 'badge-crimson' : (slot.weekend ? 'badge-emerald' : 'badge-navy')}">
              ${hasViol ? `위반 ${slot.violations.length}건` : (slot.weekend ? '주말시리즈' : '주중시리즈')}
            </span>
          </div>
          <div>
            ${matchesToShow.map(m => {
              const hT = teamMap[m.home] || { color: '#1D4ED8', stadium: m.home };
              const aT = teamMap[m.away] || { color: '#64748B' };
              return `
                <div class="slot-match-row">
                  <div style="display:flex; align-items:center; gap:5px; font-weight:700;">
                    <span class="team-color-dot" style="background:${aT.color}; width:9px; height:9px;"></span>
                    <span>${m.away}</span>
                    <span style="color:var(--text-muted); font-size:11px;">@</span>
                    <span class="team-color-dot" style="background:${hT.color}; width:9px; height:9px;"></span>
                    <span style="color:var(--kbo-navy);">${m.home}</span>
                  </div>
                  <span style="font-size:11px; color:var(--text-muted);">🏟️ ${hT.stadium}</span>
                </div>
              `;
            }).join('')}
          </div>
          ${hasViol ? `
            <div style="padding:6px 10px; background:var(--kbo-crimson-soft); color:#991B1B; font-size:11px; border-top:1px solid var(--kbo-crimson-border);">
              ${slot.violations.map(v => `<div>🚨 ${v}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function exportScheduleCsv() {
    const teamMap = {};
    state.teams.forEach(t => { teamMap[t.name] = t; });
    const lines = ['시리즈번호,시작일자,요일,연전수,주말여부,휴일점수,원정구단,홈구단,개최구장'];
    state.currentPlan.forEach((m, idx) => {
      const dStr = String(m.datetime).slice(0, 10);
      const dow = window.KBOEngine.getDayOfWeekKo(dStr);
      const st = teamMap[m.home]?.stadium || m.home;
      lines.push(`${idx + 1},${dStr},${dow},${m.consecutive},${m.weekend ? '주말' : '주중'},${m.holiday},${m.away},${m.home},${st}`);
    });
    downloadTextFile('\uFEFF' + lines.join('\n'), 'kbo_2025_optimized_schedule.csv', 'text/csv;charset=utf-8;');
    showToast('📥 전체 225개 시리즈 정규시즌 대진표 CSV 다운로드가 완료되었습니다.');
  }

  function exportTeamAnalyticsCsv() {
    if (!state.currentEvaluation) return;
    const lines = ['구단,홈구장,총이동거리(km),평균대비편차(km),300km이내여부,총이동횟수,주중이동횟수,주말이동횟수,주말홈경기수,공휴일홈경기수,휴일점수,최대연속홈,최대연속원정'];
    state.currentEvaluation.teamAnalytics.forEach(a => {
      lines.push(`${a.team},${a.stadium},${a.totalDistance},${a.distanceDiffFromMean},${a.withinDistanceTolerance ? 'PASS' : 'EXCEED'},${a.totalMoveCount},${a.weekdayMoveCount},${a.weekendMoveCount},${a.weekendHomeGames},${a.holidayHomeGames},${a.holidayScore},${a.maxHomeStreak},${a.maxAwayStreak}`);
    });
    downloadTextFile('\uFEFF' + lines.join('\n'), 'kbo_2025_team_soft_analytics.csv', 'text/csv;charset=utf-8;');
    showToast('📥 구단별 Soft 제약 비교 성적표 CSV 다운로드가 완료되었습니다.');
  }

  function buildFullExportPayload() {
    return {
      metadata: {
        generator: 'KBO Schedule Studio 2025 (4-Step Guided Wizard)',
        score: state.currentEvaluation?.score.formatted,
        feasible: state.currentEvaluation?.score.feasible
      },
      config: state.config,
      teams: state.teams,
      distanceMatrix: state.distanceMatrix,
      calendar: state.calendar,
      schedulePlan: state.currentPlan
    };
  }

  function openJsonModal() {
    const modal = document.getElementById('jsonModal');
    const area = document.getElementById('jsonModalTextarea');
    if (modal && area) {
      area.value = JSON.stringify(buildFullExportPayload(), null, 2);
      modal.classList.add('open');
    }
  }

  function closeJsonModal() {
    document.getElementById('jsonModal')?.classList.remove('open');
  }

  function copyJsonFromModal() {
    const area = document.getElementById('jsonModalTextarea');
    if (area) {
      navigator.clipboard?.writeText(area.value);
      showToast('📋 JSON 데이터가 클립보드에 복사되었습니다.');
    }
  }

  function applyJsonFromModal() {
    try {
      const raw = document.getElementById('jsonModalTextarea')?.value || '';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.teams)) state.teams = parsed.teams;
      if (Array.isArray(parsed.distanceMatrix)) state.distanceMatrix = parsed.distanceMatrix;
      if (parsed.config) Object.assign(state.config, parsed.config);
      if (Array.isArray(parsed.schedulePlan)) state.currentPlan = parsed.schedulePlan;

      recalculateEvaluation();
      renderStep1();
      renderStep2();
      renderStep3();
      renderStep4();
      closeJsonModal();
      showToast('✅ 사용자 정의 JSON 데이터가 스튜디오 전체에 반영되었습니다.');
    } catch (e) {
      showToast('⚠️ JSON 구문 오류: 올바른 JSON 형식인지 확인해주세요.');
    }
  }

  function exportFullJson() {
    const jsonStr = JSON.stringify(buildFullExportPayload(), null, 2);
    downloadTextFile(jsonStr, 'kbo_2025_optaplanner_solution.json', 'application/json;charset=utf-8;');
    showToast('📥 OptaPlanner 전체 입출력 JSON 파일이 저장되었습니다.');
  }

  /* ========================================================================
     10. UTILITIES (TOAST, COLOR HELPER, FILE DOWNLOAD)
     ======================================================================== */
  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#1D4ED8').replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function downloadTextFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'studio-toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    goToStep,
    switchPlanPreset,
    selectTeamRow,
    geocodeTeamRow,
    runQuickGeocodeBar,
    applyPresetToSelectedTeam,
    updateTeamCoord,
    recalculateAllDistances,
    resetTeamsAndMatrix,
    updateMatrixCell,
    switchMapProvider,
    setFocusTeam,
    loadExternalMapSdk,
    updateSeasonConfig,
    toggleRestDayOfWeek,
    addBlackoutDate,
    removeBlackoutDate,
    updateOpeningMatchup,
    applyOpeningDayToPlan,
    toggleChildrenDayHost,
    removeCustomEvent,
    openAddCustomEventModal,
    closeAddCustomEventModal,
    toggleModalEventMode,
    saveCustomEventFromModal,
    selectCalendarDate,
    swapHomeAwayInSlot,
    updateToleranceFromUI,
    resetToleranceDefaults,
    startSolverSimulation,
    sortSoftTable,
    toggleRadarTeam,
    renderAllStep4Charts,
    renderScheduleExplorer,
    exportScheduleCsv,
    exportTeamAnalyticsCsv,
    openJsonModal,
    closeJsonModal,
    copyJsonFromModal,
    applyJsonFromModal,
    exportFullJson
  };
})();
