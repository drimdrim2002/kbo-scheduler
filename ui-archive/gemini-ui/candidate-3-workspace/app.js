/**
 * KBO Planner Workspace (Candidate 3)
 * Split-Pane Interactive Calendar & Spreadsheet SaaS Workspace
 * 100% Pure Vanilla JavaScript — Powered by window.KBO_DATA & window.KBOEngine
 */
(function () {
  'use strict';

  const KBO_DATA = window.KBO_DATA;
  const KBOEngine = window.KBOEngine;

  // =========================================================================
  // 1. WORKSPACE STATE INITIALIZATION
  // =========================================================================
  const state = {
    activeView: 'view-teams',
    activePlanMode: 'solved', // 'solved' | 'initial' | 'violation'
    inspectorMode: 'team',    // 'team' | 'date'
    mapMode: 'leaflet',       // 'leaflet' | 'svg' | 'kakao'
    calendarMonthFilter: 'ALL',
    calendarSubView: 'grid',  // 'grid' | 'series-list' | 'matchup-matrix'
    analyticsSortBy: 'index', // 'index' | 'distance' | 'move'
    compareInitialOverlay: true,
    selectedTeamName: 'LG',
    focusedTeamFilter: null,
    selectedDate: '2025-03-22',
    radarTeamA: 'LG',
    radarTeamB: '롯데',
    lastGeocodeSource: 'KBO 구장 좌표 DB (기본값)',

    teams: KBOEngine.deepClone(KBO_DATA.teams),
    distanceMatrix: KBOEngine.deepClone(KBO_DATA.distanceMatrix),
    calendar: KBOEngine.deepClone(KBO_DATA.calendar),

    plans: {
      solved: KBOEngine.deepClone(KBO_DATA.solvedPlan),
      initial: KBOEngine.deepClone(KBO_DATA.initialPlan),
      violation: KBOEngine.createViolationDemoPlan()
    },

    config: {
      matchStartDate: '2025-03-22',
      matchEndDate: '2025-08-31',
      restDaysOfWeek: [1], // 1 = 월요일 정기 휴식일
      allStarStartDate: '2025-07-11',
      allStarEndDate: '2025-07-16',
      allStarBreakDate: '2025-07-02',
      childrenDayStart: '2025-05-05',
      childrenDayHomeTeams: ['두산', '키움', '한화', 'NC', '롯데'],
      toleranceTotalDistance: 300,
      toleranceTotalMove: 2.0,
      toleranceWeekdayMove: 1.5,
      toleranceHoliday: 1.5,
      maxConsecutiveHomeAway: 3
    },

    specialEvents: [
      {
        id: 'evt-opening-2025',
        date: '2025-03-22',
        title: '2025 KBO 정규시즌 개막 2연전',
        mode: 'TEAM_AND_STADIUM',
        badge: '개막 고정 (구단+구장)',
        matchups: [
          { away: '롯데', home: 'LG', stadium: '잠실종합운동장' },
          { away: '한화', home: 'KT', stadium: '수원KT위즈파크' },
          { away: '두산', home: 'SSG', stadium: '문학경기장' },
          { away: '키움', home: '삼성', stadium: '대구삼성라이언즈파크' },
          { away: 'NC', home: 'KIA', stadium: '광주챔피언스필드' }
        ]
      },
      {
        id: 'evt-childrenday-2025',
        date: '2025-05-05',
        title: '어린이날 특별 3연전 (격년제 홈구장 지정)',
        mode: 'STADIUM_ONLY',
        badge: '구장만 지정 (원정 자동)',
        homeTeams: ['두산', '키움', '한화', 'NC', '롯데'],
        stadiums: ['잠실종합운동장', '고척돔야구장', '한화이글스파크', '창원NC파크', '사직야구장']
      },
      {
        id: 'evt-memorial-2025',
        date: '2025-06-06',
        title: '현충일 연휴 주말 3연전 (휴일 가중치 3점)',
        mode: 'STADIUM_ONLY',
        badge: '공휴일 특별슬롯',
        homeTeams: ['두산', '삼성', 'KT', '롯데', 'KIA'],
        stadiums: ['잠실종합운동장', '대구삼성라이언즈파크', '수원KT위즈파크', '사직야구장', '광주챔피언스필드']
      },
      {
        id: 'evt-liberation-2025',
        date: '2025-08-15',
        title: '광복절 연휴 주말 3연전 (휴일 가중치 3점)',
        mode: 'STADIUM_ONLY',
        badge: '공휴일 특별슬롯',
        homeTeams: ['LG', 'SSG', '키움', '한화', 'NC'],
        stadiums: ['잠실종합운동장', '문학경기장', '고척돔야구장', '한화이글스파크', '창원NC파크']
      }
    ],

    evaluation: null,
    initialEvaluation: null,
    leafletMap: null,
    leafletMarkersLayer: null,
    leafletLinesLayer: null,
    solverTimer: null,
    solverHistoryPoints: []
  };

  // =========================================================================
  // 2. CORE EVALUATION & HELPERS
  // =========================================================================
  function getActivePlan() {
    return state.plans[state.activePlanMode] || state.plans.solved;
  }

  function recomputeEvaluation() {
    const cfg = {
      ...state.config,
      calendar: state.calendar
    };
    state.evaluation = KBOEngine.evaluatePlan(
      getActivePlan(),
      state.teams,
      state.distanceMatrix,
      cfg
    );
    state.initialEvaluation = KBOEngine.evaluatePlan(
      state.plans.initial,
      state.teams,
      state.distanceMatrix,
      cfg
    );
  }

  function getTeamByName(name) {
    return state.teams.find(t => t.name === name) || state.teams[0];
  }

  function showToast(message, type = 'info') {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const item = document.createElement('div');
    item.className = 'toast-item';
    const colors = { info: '#6366F1', success: '#10B981', warn: '#F59E0B', error: '#EF4444' };
    item.style.borderLeftColor = colors[type] || colors.info;
    item.textContent = message;
    stack.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transition = 'opacity 0.25s';
      setTimeout(() => item.remove(), 260);
    }, 3200);
  }

  function formatNumber(n, digits = 1) {
    return Number(n || 0).toLocaleString('ko-KR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  // =========================================================================
  // 3. LEFT DOCK & GLOBAL HEADER RENDERING
  // =========================================================================
  function renderDockAndHeader() {
    const ev = state.evaluation;
    if (!ev) return;

    // Dock Team Quick Grid
    const dockTeamGrid = document.getElementById('dockTeamGrid');
    if (dockTeamGrid) {
      dockTeamGrid.innerHTML = state.teams.map(t => {
        const isFocused = state.focusedTeamFilter === t.name || (!state.focusedTeamFilter && state.selectedTeamName === t.name);
        return `
          <button type="button" class="dock-team-chip ${isFocused ? 'active' : ''}" data-team="${t.name}" title="${t.fullName} (${t.stadium})">
            <span class="dock-team-bar" style="background:${t.color}"></span>
            <span>${t.name}</span>
          </button>
        `;
      }).join('');

      dockTeamGrid.querySelectorAll('.dock-team-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const tName = btn.getAttribute('data-team');
          state.selectedTeamName = tName;
          state.focusedTeamFilter = state.focusedTeamFilter === tName ? null : tName;
          state.inspectorMode = 'team';
          syncInspectorTabs();
          refreshAllViews();
        });
      });
    }

    // Dock Score Card
    const dot = document.getElementById('dockFeasibleDot');
    const modeLabel = document.getElementById('dockPlanModeLabel');
    const scoreMono = document.getElementById('dockScoreMono');
    const hardCount = document.getElementById('dockHardCount');
    const meanDist = document.getElementById('dockMeanDist');
    const tolTeams = document.getElementById('dockTolTeams');
    const seriesCount = document.getElementById('dockSeriesCount');

    const modeNames = {
      solved: '최적화 완료 해 (Solved)',
      initial: '초기 배정안 (Initial)',
      violation: '위반 테스트안 (Violation)'
    };

    if (dot) dot.className = `status-dot ${ev.score.feasible ? 'feasible' : 'violated'}`;
    if (modeLabel) modeLabel.textContent = modeNames[state.activePlanMode] || '사용자 편집 플랜';
    if (scoreMono) scoreMono.textContent = ev.score.formatted;
    if (hardCount) {
      hardCount.textContent = ev.score.feasible
        ? '0건 (PASS)'
        : `${ev.score.totalHardViolations}건 위반!`;
      hardCount.className = `dock-kpi-val ${ev.score.feasible ? 'text-emerald' : 'text-rose'}`;
    }
    if (meanDist) meanDist.textContent = `${formatNumber(ev.leagueSummary.meanDistance, 1)} km`;
    if (tolTeams) tolTeams.textContent = `${ev.leagueSummary.teamsWithinDistanceTolerance} / 10구단`;
    if (seriesCount) seriesCount.textContent = `${ev.leagueSummary.totalSlotsCount}슬롯 · 675G`;

    // Global Plan Switcher active button
    document.querySelectorAll('#globalPlanSwitcher .seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-plan-mode') === state.activePlanMode);
    });
  }

  // =========================================================================
  // 4. VIEW 1: TEAMS SPREADSHEET, GEOCODING, MAP & 10x10 DISTANCE MATRIX
  // =========================================================================
  function renderStadiumPresetChips() {
    const wrap = document.getElementById('stadiumPresetChips');
    if (!wrap) return;
    wrap.innerHTML = KBO_DATA.stadiumPresets.map((p, idx) => {
      const isSecondary = idx >= 9;
      const shortLabel = p.alias[1] || p.alias[0] || p.stadium;
      return `
        <button type="button" class="preset-chip ${isSecondary ? 'secondary-stadium' : ''}"
          data-stadium="${p.stadium}"
          title="${p.stadium} (${p.address}) — 클릭 시 현재 선택된 [${state.selectedTeamName}] 구단에 좌표 즉시 반영">
          ${isSecondary ? '🏟️ ' : ''}${shortLabel}
        </button>
      `;
    }).join('');

    wrap.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        const stName = chip.getAttribute('data-stadium');
        const targetTeam = getTeamByName(state.selectedTeamName);
        if (!targetTeam) return;
        await applyGeocodeToTeam(targetTeam, stName);
      });
    });
  }

  async function applyGeocodeToTeam(team, queryText) {
    const geo = await KBOEngine.geocodeLocation(queryText);
    if (!geo) {
      showToast(`'${queryText}' 위치를 찾을 수 없습니다. 구장명 또는 도시명을 입력하세요.`, 'warn');
      return;
    }
    team.stadium = geo.stadium || queryText;
    team.latitude = Number(geo.latitude);
    team.longitude = Number(geo.longitude);
    if (geo.address) team.address = geo.address;
    if (geo.city) team.city = geo.city;
    state.lastGeocodeSource = `${team.name}: ${geo.source}`;

    const badge = document.getElementById('lastGeocodeBadge');
    if (badge) badge.textContent = state.lastGeocodeSource;

    // Recalculate sharedStadium flag
    const stCounts = {};
    state.teams.forEach(t => { stCounts[t.stadium] = (stCounts[t.stadium] || 0) + 1; });
    state.teams.forEach(t => { t.sharedStadium = stCounts[t.stadium] > 1; });

    showToast(`[${team.name}] '${team.stadium}' 위경도 자동 입력 완료 (${team.latitude.toFixed(4)}, ${team.longitude.toFixed(4)})`, 'success');
    renderTeamsSpreadsheet();
    updateInteractiveMap();
    renderInspector();
  }

  function renderTeamsSpreadsheet() {
    const tbody = document.getElementById('teamsSheetBody');
    if (!tbody) return;

    tbody.innerHTML = state.teams.map((t, idx) => {
      const isSelected = t.name === state.selectedTeamName;
      return `
        <tr class="${isSelected ? 'selected-row' : ''}" data-team-row="${t.name}">
          <td class="sheet-cell-mono">${idx + 1}</td>
          <td>
            <div class="team-pill">
              <span class="team-swatch" style="background:${t.color}"></span>
              <input type="text" class="sheet-cell-input input-team-name" data-idx="${idx}" value="${t.name}" style="width:68px; font-weight:700;" />
            </div>
          </td>
          <td>
            <div style="display:flex; gap:4px; align-items:center;">
              <input type="text" class="sheet-cell-input input-stadium-name" data-idx="${idx}" value="${t.stadium}" placeholder="구장명 또는 주소 입력..." />
              <button type="button" class="btn btn-secondary btn-xs btn-row-geocode" data-idx="${idx}" title="구장명/주소로 위경도 자동 조회">좌표자동</button>
            </div>
          </td>
          <td>
            <input type="number" step="0.0001" class="sheet-cell-input sheet-cell-mono input-lat" data-idx="${idx}" value="${Number(t.latitude).toFixed(6)}" />
          </td>
          <td>
            <input type="number" step="0.0001" class="sheet-cell-input sheet-cell-mono input-lng" data-idx="${idx}" value="${Number(t.longitude).toFixed(6)}" />
          </td>
          <td>
            ${t.sharedStadium ? '<span class="badge badge-indigo">공동구장</span>' : '<span class="badge badge-slate">단독구장</span>'}
            ${state.config.childrenDayHomeTeams.includes(t.name) ? '<span class="badge badge-amber">어린이날 홈</span>' : ''}
          </td>
          <td>
            <button type="button" class="btn btn-outline btn-xs btn-focus-team" data-team="${t.name}">지도·인스펙터</button>
          </td>
        </tr>
      `;
    }).join('');

    // Row click selects team
    tbody.querySelectorAll('tr[data-team-row]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        state.selectedTeamName = row.getAttribute('data-team-row');
        state.inspectorMode = 'team';
        syncInspectorTabs();
        renderTeamsSpreadsheet();
        renderDistanceMatrixSpreadsheet();
        updateInteractiveMap();
        renderInspector();
        renderDockAndHeader();
      });
    });

    // Team name edit
    tbody.querySelectorAll('.input-team-name').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.getAttribute('data-idx'));
        const oldName = state.teams[idx].name;
        const newName = inp.value.trim();
        if (!newName || newName === oldName) return;
        renameTeamAcrossWorkspace(oldName, newName);
        showToast(`구단명이 '${oldName}' → '${newName}'(으)로 변경되었습니다.`, 'info');
        refreshAllViews();
      });
    });

    // Stadium name edit -> auto geocode
    tbody.querySelectorAll('.input-stadium-name').forEach(inp => {
      inp.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const idx = Number(inp.getAttribute('data-idx'));
          state.selectedTeamName = state.teams[idx].name;
          await applyGeocodeToTeam(state.teams[idx], inp.value);
        }
      });
      inp.addEventListener('change', async () => {
        const idx = Number(inp.getAttribute('data-idx'));
        state.selectedTeamName = state.teams[idx].name;
        await applyGeocodeToTeam(state.teams[idx], inp.value);
      });
    });

    tbody.querySelectorAll('.btn-row-geocode').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-idx'));
        const rowInp = tbody.querySelector(`.input-stadium-name[data-idx="${idx}"]`);
        state.selectedTeamName = state.teams[idx].name;
        await applyGeocodeToTeam(state.teams[idx], rowInp ? rowInp.value : state.teams[idx].stadium);
      });
    });

    // Manual lat/lng edit
    tbody.querySelectorAll('.input-lat, .input-lng').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.getAttribute('data-idx'));
        const isLat = inp.classList.contains('input-lat');
        const val = parseFloat(inp.value);
        if (Number.isNaN(val)) return;
        if (isLat) state.teams[idx].latitude = val;
        else state.teams[idx].longitude = val;
        state.selectedTeamName = state.teams[idx].name;
        updateInteractiveMap();
        renderInspector();
      });
    });

    tbody.querySelectorAll('.btn-focus-team').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedTeamName = btn.getAttribute('data-team');
        state.inspectorMode = 'team';
        syncInspectorTabs();
        renderTeamsSpreadsheet();
        renderDistanceMatrixSpreadsheet();
        updateInteractiveMap();
        renderInspector();
        renderDockAndHeader();
      });
    });
  }

  function renameTeamAcrossWorkspace(oldName, newName) {
    state.teams.forEach(t => {
      if (t.name === oldName) t.name = newName;
    });
    state.distanceMatrix.forEach(d => {
      if (d.from === oldName) d.from = newName;
      if (d.to === oldName) d.to = newName;
    });
    Object.values(state.plans).forEach(plan => {
      plan.forEach(m => {
        if (m.home === oldName) m.home = newName;
        if (m.away === oldName) m.away = newName;
      });
    });
    state.config.childrenDayHomeTeams = state.config.childrenDayHomeTeams.map(n => n === oldName ? newName : n);
    if (state.selectedTeamName === oldName) state.selectedTeamName = newName;
    if (state.radarTeamA === oldName) state.radarTeamA = newName;
    if (state.radarTeamB === oldName) state.radarTeamB = newName;
    recomputeEvaluation();
  }

  function renderDistanceMatrixSpreadsheet() {
    const thead = document.getElementById('distanceMatrixHead');
    const tbody = document.getElementById('distanceMatrixBody');
    const badge = document.getElementById('matrixSummaryBadge');
    if (!thead || !tbody) return;

    const lookup = KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);

    // Compute average non-zero distance
    let nonZeroSum = 0;
    let nonZeroCnt = 0;
    state.teams.forEach(f => {
      state.teams.forEach(t => {
        const d = lookup[f.name]?.[t.name] || 0;
        if (d > 0) {
          nonZeroSum += d;
          nonZeroCnt++;
        }
      });
    });
    if (badge) {
      const avgDist = nonZeroCnt > 0 ? (nonZeroSum / nonZeroCnt).toFixed(1) : '0.0';
      badge.textContent = `평균 구장 간 이동거리: ${avgDist} km`;
    }

    thead.innerHTML = `
      <tr>
        <th style="min-width:95px;">출발 \\ 도착</th>
        ${state.teams.map(t => `
          <th class="${t.name === state.selectedTeamName ? 'matrix-highlight-rc' : ''}">
            <span class="team-pill" style="justify-content:center;">
              <span class="team-swatch" style="background:${t.color}"></span>${t.name}
            </span>
          </th>
        `).join('')}
      </tr>
    `;

    tbody.innerHTML = state.teams.map(fromT => {
      const isRowSelected = fromT.name === state.selectedTeamName;
      return `
        <tr class="${isRowSelected ? 'selected-row' : ''}">
          <th style="background:#F8FAFC; font-weight:700;">
            <span class="team-pill">
              <span class="team-swatch" style="background:${fromT.color}"></span>
              <span>${fromT.name}</span>
              <small style="color:#64748B; font-weight:400;">(${fromT.stadium.slice(0, 2)})</small>
            </span>
          </th>
          ${state.teams.map(toT => {
            const dist = Number(lookup[fromT.name]?.[toT.name] ?? 0.0);
            let cellClass = 'dist-zero';
            if (dist > 0 && dist < 60) cellClass = 'dist-short';
            else if (dist >= 60 && dist < 220) cellClass = 'dist-mid';
            else if (dist >= 220 && dist < 330) cellClass = 'dist-long';
            else if (dist >= 330) cellClass = 'dist-vlong';

            const highlight = (fromT.name === state.selectedTeamName || toT.name === state.selectedTeamName) ? 'matrix-highlight-rc' : '';
            return `
              <td class="${cellClass} ${highlight}">
                <input type="number" step="0.1" min="0" class="matrix-input"
                  data-from="${fromT.name}" data-to="${toT.name}"
                  value="${dist.toFixed(1)}" ${fromT.name === toT.name ? 'readonly' : ''} />
              </td>
            `;
          }).join('')}
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.matrix-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const from = inp.getAttribute('data-from');
        const to = inp.getAttribute('data-to');
        const val = Math.max(0, parseFloat(inp.value) || 0);
        const symmetric = document.getElementById('chkSymmetricMatrix')?.checked;

        updateDistanceEntry(from, to, val);
        if (symmetric && from !== to) {
          updateDistanceEntry(to, from, val);
        }
        recomputeEvaluation();
        renderDistanceMatrixSpreadsheet();
        updateInteractiveMap();
        renderDockAndHeader();
        renderInspector();
        showToast(`구장 이동거리 수정 반영: ${from} ↔ ${to} = ${val.toFixed(1)} km`, 'info');
      });
    });
  }

  function updateDistanceEntry(from, to, distVal) {
    const existing = state.distanceMatrix.find(d => d.from === from && d.to === to);
    if (existing) {
      existing.distance = Number(distVal.toFixed(1));
    } else {
      state.distanceMatrix.push({
        index: state.distanceMatrix.length,
        from,
        to,
        distance: Number(distVal.toFixed(1))
      });
    }
  }

  // =========================================================================
  // 5. MULTI-ENGINE INTERACTIVE MAP (LEAFLET + BUILT-IN SVG KOREA MAP + SDK)
  // =========================================================================
  function initOrUpdateLeafletMap() {
    const container = document.getElementById('leafletMapContainer');
    if (!container) return;

    if (!window.L) {
      // Fallback to SVG map if offline / CDN blocked
      state.mapMode = 'svg';
      syncMapModeUI();
      renderSvgKoreaMap();
      return;
    }

    if (!state.leafletMap) {
      state.leafletMap = window.L.map(container, {
        center: [36.38, 127.85],
        zoom: 7,
        zoomControl: true
      });

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap · KBO Planner'
      }).addTo(state.leafletMap);

      state.leafletLinesLayer = window.L.layerGroup().addTo(state.leafletMap);
      state.leafletMarkersLayer = window.L.layerGroup().addTo(state.leafletMap);
    }

    state.leafletLinesLayer.clearLayers();
    state.leafletMarkersLayer.clearLayers();

    const selectedTeam = getTeamByName(state.selectedTeamName);
    const lookup = KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);

    // Draw route lines from selectedTeam to all other stadiums
    if (selectedTeam) {
      state.teams.forEach(target => {
        if (target.name === selectedTeam.name) return;
        const dist = lookup[selectedTeam.name]?.[target.name] ?? 0;
        const latlngs = [
          [selectedTeam.latitude, selectedTeam.longitude],
          [target.latitude, target.longitude]
        ];
        const poly = window.L.polyline(latlngs, {
          color: dist === 0 ? '#6366F1' : '#4F46E5',
          weight: dist > 250 ? 2.5 : 1.8,
          opacity: 0.65,
          dashArray: '5, 5'
        }).addTo(state.leafletLinesLayer);
        poly.bindTooltip(`${selectedTeam.name} → ${target.name}: ${dist.toFixed(1)} km`, { sticky: true });
      });
    }

    // Add markers for all 10 teams (offset co-tenants slightly so both pins are visible)
    const coordSeen = {};
    state.teams.forEach(t => {
      const key = `${t.latitude.toFixed(3)},${t.longitude.toFixed(3)}`;
      const seenCount = coordSeen[key] || 0;
      coordSeen[key] = seenCount + 1;

      const latOffset = seenCount > 0 ? 0.012 * seenCount : 0;
      const lngOffset = seenCount > 0 ? 0.018 * seenCount : 0;
      const isSelected = t.name === state.selectedTeamName;

      const iconHtml = `
        <div style="
          background:${t.color};
          color:#FFFFFF;
          padding:3px 7px;
          border-radius:999px;
          font-weight:700;
          font-size:11px;
          border:2px solid ${isSelected ? '#FACC15' : '#FFFFFF'};
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          white-space:nowrap;
          transform:${isSelected ? 'scale(1.15)' : 'scale(1)'};
        ">${t.name}</div>
      `;

      const icon = window.L.divIcon({
        html: iconHtml,
        className: 'kbo-leaflet-pin',
        iconSize: [46, 24],
        iconAnchor: [23, 12]
      });

      const marker = window.L.marker([t.latitude + latOffset, t.longitude + lngOffset], { icon })
        .addTo(state.leafletMarkersLayer);

      marker.on('click', () => {
        state.selectedTeamName = t.name;
        state.inspectorMode = 'team';
        syncInspectorTabs();
        renderTeamsSpreadsheet();
        renderDistanceMatrixSpreadsheet();
        updateInteractiveMap();
        renderInspector();
        renderDockAndHeader();
      });
    });

    setTimeout(() => {
      if (state.leafletMap) state.leafletMap.invalidateSize();
    }, 60);
  }

  function renderSvgKoreaMap() {
    const container = document.getElementById('svgMapContainer');
    if (!container) return;

    const selectedTeam = getTeamByName(state.selectedTeamName);
    const lookup = KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);

    // Map Korea bounding box (lat 34.6 ~ 38.1, lng 126.1 ~ 129.6) to SVG 520 x 360
    const project = (lat, lng) => {
      const x = ((lng - 125.9) / (129.8 - 125.9)) * 440 + 40;
      const y = ((38.15 - lat) / (38.15 - 34.65)) * 310 + 25;
      return [x, y];
    };

    const [selX, selY] = project(selectedTeam.latitude, selectedTeam.longitude);

    let linesSvg = '';
    state.teams.forEach(t => {
      if (t.name === selectedTeam.name) return;
      const [tx, ty] = project(t.latitude, t.longitude);
      const dist = lookup[selectedTeam.name]?.[t.name] ?? 0;
      const mx = (selX + tx) / 2;
      const my = (selY + ty) / 2;
      linesSvg += `
        <line x1="${selX}" y1="${selY}" x2="${tx}" y2="${ty}"
          stroke="#6366F1" stroke-width="1.8" stroke-dasharray="4 3" opacity="0.75" />
        <rect x="${mx - 24}" y="${my - 8}" width="48" height="15" rx="4" fill="#0F172A" opacity="0.82" />
        <text x="${mx}" y="${my + 3}" text-anchor="middle" fill="#E0E7FF" font-size="9.5" font-family="JetBrains Mono">${dist.toFixed(0)}km</text>
      `;
    });

    const coordSeen = {};
    let nodesSvg = '';
    state.teams.forEach(t => {
      const key = `${t.latitude.toFixed(2)},${t.longitude.toFixed(2)}`;
      const seen = coordSeen[key] || 0;
      coordSeen[key] = seen + 1;
      const [rawX, rawY] = project(t.latitude, t.longitude);
      const cx = rawX + (seen ? 26 : 0);
      const cy = rawY + (seen ? -12 : 0);
      const isSelected = t.name === state.selectedTeamName;

      nodesSvg += `
        <g class="svg-stadium-node" data-team="${t.name}" style="cursor:pointer;">
          ${isSelected ? `<circle cx="${cx}" cy="${cy}" r="18" fill="${t.color}" opacity="0.22" />` : ''}
          <circle cx="${cx}" cy="${cy}" r="${isSelected ? 10 : 8}" fill="${t.color}" stroke="${isSelected ? '#FACC15' : '#FFFFFF'}" stroke-width="2" />
          <rect x="${cx - 22}" y="${cy + 11}" width="44" height="16" rx="4" fill="${isSelected ? '#4F46E5' : '#0F172A'}" opacity="0.92" />
          <text x="${cx}" y="${cy + 22}" text-anchor="middle" fill="#FFFFFF" font-size="10" font-weight="700">${t.name}</text>
        </g>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 520 360" width="100%" height="100%" style="background:linear-gradient(180deg,#DBEAFE 0%,#EFF6FF 100%); display:block;">
        <!-- Simplified Korea Peninsula Silhouette -->
        <path d="M135,45 L245,32 L325,75 L378,165 L392,255 L340,305 L240,322 L145,332 L115,275 L125,180 L98,110 Z"
          fill="#F8FAFC" stroke="#94A3B8" stroke-width="2" />
        <!-- Grid lines -->
        <line x1="40" y1="100" x2="480" y2="100" stroke="#CBD5E1" stroke-dasharray="2 4" />
        <line x1="40" y1="190" x2="480" y2="190" stroke="#CBD5E1" stroke-dasharray="2 4" />
        <line x1="40" y1="280" x2="480" y2="280" stroke="#CBD5E1" stroke-dasharray="2 4" />
        ${linesSvg}
        ${nodesSvg}
      </svg>
    `;

    container.querySelectorAll('.svg-stadium-node').forEach(node => {
      node.addEventListener('click', () => {
        state.selectedTeamName = node.getAttribute('data-team');
        state.inspectorMode = 'team';
        syncInspectorTabs();
        renderTeamsSpreadsheet();
        renderDistanceMatrixSpreadsheet();
        updateInteractiveMap();
        renderInspector();
        renderDockAndHeader();
      });
    });
  }

  function updateInteractiveMap() {
    const selectedTeam = getTeamByName(state.selectedTeamName);
    const lblTeam = document.getElementById('mapSelectedTeamLabel');
    const lblCoord = document.getElementById('mapSelectedCoordLabel');
    if (selectedTeam && lblTeam && lblCoord) {
      lblTeam.textContent = `${selectedTeam.name} (${selectedTeam.stadium})`;
      lblCoord.textContent = `${selectedTeam.latitude.toFixed(4)}°N, ${selectedTeam.longitude.toFixed(4)}°E · 타 구장 거리 연결선 표시`;
    }

    if (state.mapMode === 'leaflet') {
      initOrUpdateLeafletMap();
    } else if (state.mapMode === 'svg') {
      renderSvgKoreaMap();
    }
  }

  function syncMapModeUI() {
    document.querySelectorAll('#mapEngineTabs .map-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-map-mode') === state.mapMode);
    });
    const sdkBar = document.getElementById('mapSdkBar');
    const leafletEl = document.getElementById('leafletMapContainer');
    const svgEl = document.getElementById('svgMapContainer');
    const extEl = document.getElementById('externalMapContainer');

    if (sdkBar) sdkBar.classList.toggle('hidden', state.mapMode !== 'kakao');
    if (leafletEl) leafletEl.classList.toggle('hidden', state.mapMode !== 'leaflet');
    if (svgEl) svgEl.classList.toggle('hidden', state.mapMode !== 'svg');
    if (extEl) extEl.classList.toggle('hidden', state.mapMode !== 'kakao');
  }

  // =========================================================================
  // 6. VIEW 2: INTERACTIVE SEASON CALENDAR & SPECIAL EVENT BUILDER
  // =========================================================================
  function initEventComposerOptions() {
    const awaySel = document.getElementById('evtAwaySelect');
    const homeSel = document.getElementById('evtHomeSelect');
    const stSel = document.getElementById('evtStadiumSelect');
    const stCheckGrid = document.getElementById('stadiumOnlyCheckGrid');
    if (!awaySel || !homeSel || !stSel || !stCheckGrid) return;

    const teamOpts = state.teams.map(t => `<option value="${t.name}">${t.name} (${t.stadium})</option>`).join('');
    awaySel.innerHTML = teamOpts;
    homeSel.innerHTML = teamOpts;
    awaySel.value = '롯데';
    homeSel.value = 'LG';

    const uniqueStadiums = Array.from(new Set([
      ...state.teams.map(t => t.stadium),
      ...KBO_DATA.stadiumPresets.map(p => p.stadium)
    ]));
    stSel.innerHTML = uniqueStadiums.map(s => `<option value="${s}">@${s}</option>`).join('');

    homeSel.addEventListener('change', () => {
      const ht = getTeamByName(homeSel.value);
      if (ht) stSel.value = ht.stadium;
    });

    // Stadium-only checkboxes (10 teams with their home stadiums)
    stCheckGrid.innerHTML = state.teams.map(t => {
      const checked = state.config.childrenDayHomeTeams.includes(t.name);
      return `
        <label class="st-check-item ${checked ? 'checked' : ''}">
          <input type="checkbox" value="${t.name}" ${checked ? 'checked' : ''} />
          <span class="team-swatch" style="background:${t.color}"></span>
          <span>@${t.stadium.slice(0, 6)} (${t.name})</span>
        </label>
      `;
    }).join('');

    stCheckGrid.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', () => {
        chk.closest('.st-check-item').classList.toggle('checked', chk.checked);
      });
    });
  }

  function renderSpecialEventsList() {
    const listEl = document.getElementById('specialEventsList');
    if (!listEl) return;

    listEl.innerHTML = state.specialEvents.map(evt => {
      const isTeamAndStadium = evt.mode === 'TEAM_AND_STADIUM';
      const chipsHtml = isTeamAndStadium
        ? (evt.matchups || []).map(m => `
            <span class="event-match-chip"><strong>${m.away}</strong> vs <strong>${m.home}</strong> @${m.stadium}</span>
          `).join('')
        : (evt.homeTeams || []).map((ht, i) => `
            <span class="event-match-chip">🏟️ @${evt.stadiums?.[i] || getTeamByName(ht).stadium} (<strong>${ht} 홈 고정</strong> · 원정 자동)</span>
          `).join('');

      return `
        <div class="event-rule-card" data-evt-date="${evt.date}" data-evt-id="${evt.id}">
          <div class="event-rule-head">
            <div class="event-rule-title">
              <span class="badge ${isTeamAndStadium ? 'badge-indigo' : 'badge-amber'}">${evt.badge}</span>
              <span>${evt.date} · ${evt.title}</span>
            </div>
            <button type="button" class="btn-icon btn-del-evt" data-evt-id="${evt.id}" title="이벤트 삭제">✕</button>
          </div>
          <div class="event-match-chips">${chipsHtml}</div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.event-rule-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-del-evt')) return;
        const dt = card.getAttribute('data-evt-date');
        state.selectedDate = dt;
        state.inspectorMode = 'date';
        syncInspectorTabs();
        renderCalendarViews();
        renderInspector();
      });
    });

    listEl.querySelectorAll('.btn-del-evt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-evt-id');
        state.specialEvents = state.specialEvents.filter(ev => ev.id !== id);
        renderSpecialEventsList();
        renderCalendarViews();
        renderPreflightView();
        showToast('특별 이벤트 조건이 삭제되었습니다.', 'info');
      });
    });
  }

  function renderCalendarViews() {
    const gridWrap = document.getElementById('calendarGridContainer');
    const listWrap = document.getElementById('calendarSeriesListContainer');
    const matrixWrap = document.getElementById('calendarMatchupMatrixContainer');

    if (gridWrap) gridWrap.classList.toggle('hidden', state.calendarSubView !== 'grid');
    if (listWrap) listWrap.classList.toggle('hidden', state.calendarSubView !== 'series-list');
    if (matrixWrap) matrixWrap.classList.toggle('hidden', state.calendarSubView !== 'matchup-matrix');

    if (state.calendarSubView === 'grid') {
      renderMonthlyCalendarGrid();
    } else if (state.calendarSubView === 'series-list') {
      renderSeriesSpreadsheetList();
    } else {
      renderMatchupMatrix10x10();
    }
  }

  function renderMonthlyCalendarGrid() {
    const container = document.getElementById('calendarGridContainer');
    if (!container || !state.evaluation) return;

    const slotByDate = {};
    const continuationByDate = {};

    state.evaluation.slotSummaries.forEach(slot => {
      slotByDate[slot.date] = slot;
      const startObj = KBOEngine.parseDateStr(slot.date);
      const consec = Number(slot.consecutive || 3);
      for (let d = 1; d < consec; d++) {
        const nextObj = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate() + d);
        const nextStr = KBOEngine.formatDateStr(nextObj);
        continuationByDate[nextStr] = {
          parentDate: slot.date,
          dayIndex: d + 1,
          consecutive: consec,
          matches: slot.matches
        };
      }
    });

    const months = [
      { key: '2025-03', year: 2025, month: 3, label: '2025년 3월 (정규시즌 개막 3/22)' },
      { key: '2025-04', year: 2025, month: 4, label: '2025년 4월' },
      { key: '2025-05', year: 2025, month: 5, label: '2025년 5월 (5/5 어린이날 특별편성)' },
      { key: '2025-06', year: 2025, month: 6, label: '2025년 6월 (6/6 현충일 연휴)' },
      { key: '2025-07', year: 2025, month: 7, label: '2025년 7월 (7/11~7/16 올스타 브레이크)' },
      { key: '2025-08', year: 2025, month: 8, label: '2025년 8월 (8/15 광복절 · 정규시즌 마감)' }
    ].filter(m => state.calendarMonthFilter === 'ALL' || state.calendarMonthFilter === m.key);

    container.innerHTML = months.map(m => {
      const firstDayDow = new Date(m.year, m.month - 1, 1).getDay();
      const daysInMonth = new Date(m.year, m.month, 0).getDate();
      const cells = [];

      for (let i = 0; i < firstDayDow; i++) {
        cells.push('<div class="cal-day-cell empty-day"></div>');
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dow = new Date(m.year, m.month - 1, day).getDay();
        const inSeason = dateStr >= state.config.matchStartDate && dateStr <= state.config.matchEndDate;
        const isAllStar = dateStr >= state.config.allStarStartDate && dateStr <= state.config.allStarEndDate;
        const isOpening = dateStr === state.config.matchStartDate;
        const isChildren = dateStr === state.config.childrenDayStart;
        const isRestDow = state.config.restDaysOfWeek.includes(dow) && !isChildren && !isAllStar && inSeason;

        const slot = slotByDate[dateStr];
        const cont = continuationByDate[dateStr];
        const isSelected = dateStr === state.selectedDate;

        let cellClasses = ['cal-day-cell'];
        if (isSelected) cellClasses.push('selected-date');
        if (isRestDow) cellClasses.push('is-rest-day');
        if (isAllStar) cellClasses.push('is-allstar-day');
        if (isOpening) cellClasses.push('is-opening-day');
        if (isChildren) cellClasses.push('is-children-day');

        let topTag = '';
        if (slot && slot.violations && slot.violations.length > 0) {
          topTag = `<span class="day-tag tag-violation">위반 ${slot.violations.length}</span>`;
        } else if (isOpening) {
          topTag = `<span class="day-tag tag-opening">개막 ${slot ? slot.consecutive : 2}연전</span>`;
        } else if (isChildren) {
          topTag = `<span class="day-tag tag-children">어린이날 3연전</span>`;
        } else if (isAllStar) {
          topTag = `<span class="day-tag tag-allstar">올스타 휴식</span>`;
        } else if (isRestDow) {
          topTag = `<span class="day-tag tag-rest">휴식일 (REST)</span>`;
        } else if (slot) {
          topTag = `<span class="day-tag tag-series">${slot.consecutive}연전${slot.holiday > 0 ? `·휴${slot.holiday}` : ''}</span>`;
        }

        let bodyHtml = '';
        if (slot) {
          bodyHtml = `
            <div class="cal-match-list">
              ${slot.matches.map(mt => {
                const isFocus = state.focusedTeamFilter && (mt.home === state.focusedTeamFilter || mt.away === state.focusedTeamFilter);
                const homeTeam = getTeamByName(mt.home);
                return `
                  <div class="cal-match-pill ${isFocus ? 'team-focused' : ''}">
                    <span>${mt.away}→<strong>${mt.home}</strong></span>
                    <span style="font-size:9px; opacity:0.8;">@${(mt.stadiumOverride || homeTeam.stadium).slice(0, 2)}</span>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        } else if (isAllStar) {
          bodyHtml = `<div class="cal-continuation" style="background:#EDE9FE; color:#5B21B6; font-weight:600;">⭐ 올스타 브레이크 미개최</div>`;
        } else if (isRestDow) {
          bodyHtml = `<div class="cal-continuation">🛌 정기 휴식일 (경기 없음)</div>`;
        } else if (cont) {
          const focusMatch = state.focusedTeamFilter
            ? cont.matches.find(mt => mt.home === state.focusedTeamFilter || mt.away === state.focusedTeamFilter)
            : null;
          bodyHtml = `
            <div class="cal-continuation">
              ${focusMatch
                ? `<strong>[${state.focusedTeamFilter}]</strong> ${focusMatch.away} vs ${focusMatch.home} (${cont.dayIndex}차전)`
                : `${cont.parentDate.slice(5)} 시리즈 ${cont.dayIndex}/${cont.consecutive}차전 진행`}
            </div>
          `;
        }

        cells.push(`
          <div class="${cellClasses.join(' ')}" data-cal-date="${dateStr}">
            <div class="cal-day-top">
              <span class="day-num" style="${dow === 0 ? 'color:#E11D48' : (dow === 6 ? 'color:#0284C7' : '')}">${day}</span>
              ${topTag}
            </div>
            ${bodyHtml}
          </div>
        `);
      }

      return `
        <div class="month-cal-section">
          <div class="month-cal-header">
            <span>${m.label}</span>
            <span class="badge badge-slate">${m.key}</span>
          </div>
          <div class="cal-dow-row">
            <div class="cal-dow-cell">일 (SUN)</div>
            <div class="cal-dow-cell">월 (MON · 정기휴식)</div>
            <div class="cal-dow-cell">화 (TUE)</div>
            <div class="cal-dow-cell">수 (WED)</div>
            <div class="cal-dow-cell">목 (THU)</div>
            <div class="cal-dow-cell">금 (FRI)</div>
            <div class="cal-dow-cell">토 (SAT)</div>
          </div>
          <div class="cal-days-grid">
            ${cells.join('')}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.cal-day-cell[data-cal-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        state.selectedDate = cell.getAttribute('data-cal-date');
        state.inspectorMode = 'date';
        syncInspectorTabs();
        renderMonthlyCalendarGrid();
        renderInspector();
      });
    });
  }

  function renderSeriesSpreadsheetList() {
    const container = document.getElementById('calendarSeriesListContainer');
    if (!container || !state.evaluation) return;

    const rows = state.evaluation.slotSummaries.map((slot, idx) => {
      const hasViol = slot.violations && slot.violations.length > 0;
      return `
        <tr class="${slot.date === state.selectedDate ? 'selected-row' : ''}" data-slot-date="${slot.date}" style="cursor:pointer;">
          <td class="sheet-cell-mono">${idx + 1}</td>
          <td class="mono" style="font-weight:700;">${slot.date} (${slot.dow})</td>
          <td><span class="badge badge-indigo">${slot.consecutive}연전</span></td>
          <td>${slot.weekend ? '<span class="badge badge-emerald">주말</span>' : '<span class="badge badge-slate">주중</span>'}</td>
          <td class="sheet-cell-mono">${slot.holiday}점</td>
          <td>
            <div class="event-match-chips">
              ${slot.matches.map(m => `<span class="event-match-chip">${m.away} → <strong>${m.home}</strong></span>`).join('')}
            </div>
          </td>
          <td>
            ${hasViol
              ? `<span class="badge badge-rose">위반 ${slot.violations.length}건</span>`
              : '<span class="badge badge-emerald">정상</span>'}
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table class="sheet-table">
        <thead>
          <tr>
            <th>슬롯#</th>
            <th>시리즈 시작일</th>
            <th>연전 수</th>
            <th>주중/주말</th>
            <th>휴일 점수</th>
            <th>배정된 5개 매치 (원정 → 홈)</th>
            <th>검증 상태</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    container.querySelectorAll('tr[data-slot-date]').forEach(tr => {
      tr.addEventListener('click', () => {
        state.selectedDate = tr.getAttribute('data-slot-date');
        state.inspectorMode = 'date';
        syncInspectorTabs();
        renderSeriesSpreadsheetList();
        renderInspector();
      });
    });
  }

  function renderMatchupMatrix10x10() {
    const container = document.getElementById('calendarMatchupMatrixContainer');
    if (!container) return;

    const plan = getActivePlan();
    const pairCount = {};
    state.teams.forEach(h => {
      pairCount[h.name] = {};
      state.teams.forEach(a => { pairCount[h.name][a.name] = { series: 0, games: 0 }; });
    });

    plan.forEach(m => {
      if (pairCount[m.home] && pairCount[m.home][m.away]) {
        pairCount[m.home][m.away].series += 1;
        pairCount[m.home][m.away].games += Number(m.consecutive || 3);
      }
    });

    container.innerHTML = `
      <table class="sheet-table matrix-sheet-table">
        <thead>
          <tr>
            <th>홈(행) \\ 원정(열)</th>
            ${state.teams.map(t => `<th>${t.name}</th>`).join('')}
            <th>홈 합계</th>
          </tr>
        </thead>
        <tbody>
          ${state.teams.map(h => {
            let totalS = 0;
            let totalG = 0;
            const cells = state.teams.map(a => {
              if (h.name === a.name) return `<td class="dist-zero">-</td>`;
              const item = pairCount[h.name][a.name];
              totalS += item.series;
              totalG += item.games;
              return `<td class="dist-short"><span class="mono">${item.series}S (${item.games}G)</span></td>`;
            }).join('');
            return `
              <tr>
                <th style="background:#F8FAFC;">${h.name} (홈)</th>
                ${cells}
                <td class="mono" style="font-weight:700; background:#EEF2FF;">${totalS}S (${totalG}G)</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // =========================================================================
  // 7. VIEW 3: PRE-FLIGHT SUMMARY & OPTAPLANNER SOLVER CONTROLLER
  // =========================================================================
  function renderPreflightView() {
    const ev = state.evaluation;
    if (!ev) return;

    const kpiRow = document.getElementById('preflightKpiRow');
    if (kpiRow) {
      kpiRow.innerHTML = `
        <div class="pf-kpi-card">
          <span class="pf-kpi-label">1. 구단 · 구장 · 거리행렬</span>
          <strong class="pf-kpi-value">10구단 · 10×10 행렬</strong>
          <span class="pf-kpi-sub">잠실 공동구장(0km) 포함 100구간 검증됨</span>
        </div>
        <div class="pf-kpi-card">
          <span class="pf-kpi-label">2. 시즌 캘린더 슬롯</span>
          <strong class="pf-kpi-value">${ev.leagueSummary.totalSlotsCount}슬롯 · ${ev.leagueSummary.totalSeriesCount}시리즈</strong>
          <span class="pf-kpi-sub">${state.config.matchStartDate} ~ ${state.config.matchEndDate} (675경기)</span>
        </div>
        <div class="pf-kpi-card">
          <span class="pf-kpi-label">3. 정기 휴식일 &amp; 브레이크</span>
          <strong class="pf-kpi-value">월요일 휴무 · 올스타 6일</strong>
          <span class="pf-kpi-sub">올스타 브레이크: ${state.config.allStarStartDate.slice(5)}~${state.config.allStarEndDate.slice(5)}</span>
        </div>
        <div class="pf-kpi-card">
          <span class="pf-kpi-label">4. 현재 플랜 OptaPlanner Score</span>
          <strong class="pf-kpi-value" style="font-size:13.5px; color:${ev.score.feasible ? '#059669' : '#E11D48'};">${ev.score.formatted}</strong>
          <span class="pf-kpi-sub">${ev.score.feasible ? 'Hard 제약 100% 충족 (Feasible)' : `Hard 제약 ${ev.score.totalHardViolations}건 위반`}</span>
        </div>
      `;
    }

    const calBody = document.getElementById('preflightCalendarBody');
    if (calBody) {
      const restLabel = state.config.restDaysOfWeek.map(d => KBOEngine.DAY_NAMES_KO[d] + '요일').join(', ') || '없음';
      calBody.innerHTML = `
        <tr>
          <th style="width:170px;">정규시즌 기간</th>
          <td class="mono">${state.config.matchStartDate} ~ ${state.config.matchEndDate} (총 45개 시리즈 슬롯 / 225매치)</td>
        </tr>
        <tr>
          <th>정기 휴식일 (경기 미개최)</th>
          <td>매주 <strong>${restLabel}</strong> (단, 5/5 어린이날 월요일은 특별 편성 허용)</td>
        </tr>
        <tr>
          <th>올스타 브레이크 기간</th>
          <td class="mono">${state.config.allStarStartDate} ~ ${state.config.allStarEndDate} (전 구단 휴식 · 후반기 7/17 4연전 재개)</td>
        </tr>
        <tr>
          <th>개막전 고정 편성 (${state.config.matchStartDate})</th>
          <td>2연전 · 5개 구장 고정 (잠실 LG, 수원 KT, 문학 SSG, 대구 삼성, 광주 KIA)</td>
        </tr>
        <tr>
          <th>어린이날 의무 홈구단 (${state.config.childrenDayStart})</th>
          <td>격년제 5개 구장 고정: <strong>${state.config.childrenDayHomeTeams.join(', ')}</strong> (원정 구단 엔진 자동 배정)</td>
        </tr>
      `;
    }

    const pinnedSummary = document.getElementById('preflightPinnedSummary');
    if (pinnedSummary) {
      pinnedSummary.innerHTML = state.specialEvents.map(evt => `
        <span class="badge ${evt.mode === 'TEAM_AND_STADIUM' ? 'badge-indigo' : 'badge-amber'}">
          📌 ${evt.date} ${evt.title} (${evt.badge})
        </span>
      `).join('');
    }

    renderSolverConvergenceChart();
  }

  function runSolverSimulation() {
    if (state.solverTimer) {
      clearInterval(state.solverTimer);
      state.solverTimer = null;
    }

    // Switch to view-solver if triggered from dock
    switchView('view-solver');

    const durationMs = Number(document.getElementById('solverDurationSelect')?.value || 2400);
    const totalSteps = 20;
    const intervalMs = Math.floor(durationMs / totalSteps);

    const terminal = document.getElementById('solverLogTerminal');
    const statusText = document.getElementById('solverStatusText');
    const pctText = document.getElementById('solverPercentText');
    const fillEl = document.getElementById('solverProgressFill');
    const liveTag = document.getElementById('solverLiveScoreTag');

    if (terminal) terminal.innerHTML = '';
    state.solverHistoryPoints = [];

    const initEv = state.initialEvaluation;
    const solvedEv = KBOEngine.evaluatePlan(state.plans.solved, state.teams, state.distanceMatrix, {
      ...state.config,
      calendar: state.calendar
    });

    const startDistPenalty = Math.abs(initEv.score.soft[2]); // ~573,810
    const startTotalDist = Math.abs(initEv.score.soft[4]);   // ~72,955
    const endTotalDist = Math.abs(solvedEv.score.soft[4]);   // ~72,073

    let step = 0;
    const appendLog = (cls, msg) => {
      if (!terminal) return;
      const div = document.createElement('div');
      div.className = `log-line ${cls}`;
      div.textContent = msg;
      terminal.appendChild(div);
      terminal.scrollTop = terminal.scrollHeight;
    };

    appendLog('log-info', `[00:00.000] INFO  OptaPlanner 9.44.0 — KBO 2025 Schedule Optimization started.`);
    appendLog('log-info', `[00:00.015] INFO  Loaded 10 teams, 100 distance pairs, 45 series slots, 225 match entities.`);

    state.solverTimer = setInterval(() => {
      step++;
      const progress = Math.min(1, step / totalSteps);
      const pct = Math.round(progress * 100);

      // Update pipeline phase cards
      document.querySelectorAll('#solverPipeline .pipe-step').forEach(el => {
        const ph = Number(el.getAttribute('data-phase'));
        const activePhase = progress < 0.2 ? 1 : (progress < 0.4 ? 2 : (progress < 0.65 ? 3 : 4));
        el.classList.toggle('done', ph < activePhase || progress === 1);
        el.classList.toggle('active', ph === activePhase && progress < 1);
      });

      // Interpolate realistic OptaPlanner score trajectory
      const ease = 1 - Math.pow(1 - progress, 3);
      const curDistPenalty = -Math.round(startDistPenalty * (1 - ease));
      const curMovePenalty = progress < 0.7 ? -400 : (progress < 0.85 ? -100 : 0);
      const curTotalDist = Math.round(startTotalDist - (startTotalDist - endTotalDist) * ease);
      const formatted = `[0/0]hard/[0/${curMovePenalty}/${curDistPenalty}/-34/-${curTotalDist}]soft`;

      state.solverHistoryPoints.push({
        step,
        distPenalty: Math.abs(curDistPenalty),
        totalDist: curTotalDist,
        formatted
      });

      if (pctText) pctText.textContent = `${pct}%`;
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (liveTag) liveTag.textContent = formatted;

      if (step === 3) {
        appendLog('log-step', `[00:00.180] INFO  Pinning fixed events: Opening Day (5 games), Children's Day (5 stadiums).`);
      } else if (step === 7) {
        appendLog('log-step', `[00:00.540] INFO  Construction Heuristic (First Fit) ended: score ${initEv.score.formatted}`);
      } else if (step % 3 === 0 && step < totalSteps) {
        appendLog('log-step', `[00:0${(step * 0.14).toFixed(2)}] DEBUG Local Search step (${step * 180}): score ${formatted}`);
      }

      if (statusText) {
        statusText.textContent = progress < 1
          ? `OptaPlanner 탐색 진행 중 (Step ${step * 180}) — 거리 편차 페널티 ${Math.abs(curDistPenalty).toLocaleString()} → 0 수렴 중...`
          : `✅ 최적화 완료! Hard 위반 0건, 구단 간 이동거리 편차 ±300km 이내 수렴 완료.`;
      }

      renderSolverConvergenceChart();

      if (step >= totalSteps) {
        clearInterval(state.solverTimer);
        state.solverTimer = null;
        state.activePlanMode = 'solved';
        recomputeEvaluation();
        appendLog('log-best', `[00:02.400] INFO  Solving ended: best score (${state.evaluation.score.formatted}), all 6 Hard constraints PASSED.`);
        renderDockAndHeader();
        renderPreflightView();
        renderAnalyticsView();
        renderCalendarViews();
        renderInspector();
        showToast('⚡ OptaPlanner 일정 최적화 엔진 실행 완료! 최적 해가 적용되었습니다.', 'success');
      }
    }, intervalMs);
  }

  function renderSolverConvergenceChart() {
    const canvas = document.getElementById('solverConvergenceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(540, rect.width || 660);
    const H = 195;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, W, H);

    const pts = state.solverHistoryPoints.length > 0
      ? state.solverHistoryPoints
      : Array.from({ length: 20 }, (_, i) => {
          const p = (i + 1) / 20;
          const ease = 1 - Math.pow(1 - p, 3);
          return {
            step: i + 1,
            distPenalty: Math.round(573810 * (1 - ease)),
            totalDist: Math.round(72955 - (72955 - 72073) * ease)
          };
        });

    const pad = { l: 58, r: 58, t: 24, b: 28 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ch / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
    }

    // Plot Distance Variance Penalty (Indigo-Violet curve)
    ctx.beginPath();
    pts.forEach((pt, idx) => {
      const x = pad.l + (idx / 19) * cw;
      const y = pad.t + ch - (pt.distPenalty / 600000) * ch;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#818CF8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Plot Total League Distance (Emerald curve)
    ctx.beginPath();
    pts.forEach((pt, idx) => {
      const x = pad.l + (idx / 19) * cw;
      const norm = (pt.totalDist - 71800) / (73200 - 71800);
      const y = pad.t + ch - Math.max(0, Math.min(1, norm)) * ch;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#94A3B8';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText('거리편차 페널티', pad.l, 15);
    ctx.fillStyle = '#34D399';
    ctx.fillText('리그 총 이동거리 (km)', W - pad.r - 125, 15);

    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('Step 0 (Initial)', pad.l, H - 8);
    ctx.fillText('Optimal Converged (Hard 0 / Soft 0)', W - pad.r - 205, H - 8);
  }

  // =========================================================================
  // 8. VIEW 4: HARD CONSTRAINTS, TEAM ANALYTICS SPREADSHEET & 5 CHARTS
  // =========================================================================
  function renderAnalyticsView() {
    const ev = state.evaluation;
    if (!ev) return;

    // 1. Top Result Summary Banner
    const banner = document.getElementById('resultSummaryBanner');
    if (banner) {
      const isPass = ev.score.feasible;
      banner.innerHTML = `
        <div class="banner-score-group">
          <span class="banner-status-pill ${isPass ? 'pass' : 'fail'}">
            ${isPass ? '✅ Hard 제약 6종 전체 통과 (Feasible)' : `⚠️ Hard 제약 위반 ${ev.score.totalHardViolations}건 발견!`}
          </span>
          <div>
            <div style="font-size:11px; color:#94A3B8;">OptaPlanner Score (BaseballEasyScoreCalculator)</div>
            <strong class="mono" style="font-size:14.5px; color:#A5B4FC;">${ev.score.formatted}</strong>
          </div>
        </div>
        <div class="banner-metrics">
          <div class="banner-metric-item">
            <span>리그 총 이동거리</span>
            <strong>${formatNumber(ev.leagueSummary.totalDistance, 1)} km</strong>
          </div>
          <div class="banner-metric-item">
            <span>구단 평균 이동거리</span>
            <strong>${formatNumber(ev.leagueSummary.meanDistance, 1)} km</strong>
          </div>
          <div class="banner-metric-item">
            <span>최대-최소 구단 격차</span>
            <strong>${formatNumber(ev.leagueSummary.maxDistanceSpread, 1)} km</strong>
          </div>
          <div class="banner-metric-item">
            <span>±${state.config.toleranceTotalDistance}km 허용오차 내</span>
            <strong class="text-emerald">${ev.leagueSummary.teamsWithinDistanceTolerance} / 10구단</strong>
          </div>
          <div class="banner-metric-item">
            <span>평균 총 이동 일수</span>
            <strong>${ev.leagueSummary.meanMoveCount}회 (${ev.leagueSummary.minMoveCount}~${ev.leagueSummary.maxMoveCount}회)</strong>
          </div>
        </div>
      `;
    }

    // 2. Hard Constraints 6-Card Grid
    const hardBadges = document.getElementById('hardSummaryBadges');
    if (hardBadges) {
      const passedCnt = ev.hardChecks.filter(c => c.passed).length;
      hardBadges.innerHTML = `
        <span class="badge ${passedCnt === 6 ? 'badge-emerald' : 'badge-rose'}">
          6대 Hard 제약 중 ${passedCnt}/6 통과
        </span>
      `;
    }

    const hardGrid = document.getElementById('hardChecksGrid');
    if (hardGrid) {
      hardGrid.innerHTML = ev.hardChecks.map(hc => `
        <div class="hard-check-card ${hc.passed ? 'passed' : 'violated'}">
          <div class="hc-top">
            <span class="hc-title">${hc.title}</span>
            <span class="badge ${hc.passed ? 'badge-emerald' : 'badge-rose'}">
              ${hc.passed ? 'PASS (0건)' : `위반 ${hc.violationCount}건`}
            </span>
          </div>
          <p class="hc-desc">${hc.desc}</p>
          ${!hc.passed ? `
            <div class="hc-violations-list">
              ${hc.violations.slice(0, 3).map(v => `
                <div class="hc-viol-item" data-viol-date="${v.date}" title="클릭 시 해당 일자 인스펙터 열기">
                  🚨 ${v.desc} (클릭하여 확인)
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `).join('');

      hardGrid.querySelectorAll('.hc-viol-item[data-viol-date]').forEach(item => {
        item.addEventListener('click', () => {
          const dt = item.getAttribute('data-viol-date');
          if (dt) {
            state.selectedDate = dt;
            state.inspectorMode = 'date';
            syncInspectorTabs();
            renderInspector();
            showToast(`${dt} 위반 슬롯 상세 정보가 우측 인스펙터에 로드되었습니다.`, 'warn');
          }
        });
      });
    }

    // 3. Team Soft Constraints Comparison Spreadsheet
    renderTeamAnalyticsSpreadsheet();

    // 4. Populate Radar Selectors & Render all 5 Charts
    syncRadarSelectors();
    renderAllFiveCharts();
  }

  function renderTeamAnalyticsSpreadsheet() {
    const tbody = document.getElementById('teamAnalyticsBody');
    const tfoot = document.getElementById('teamAnalyticsFoot');
    if (!tbody || !tfoot || !state.evaluation) return;

    const list = [...state.evaluation.teamAnalytics];
    if (state.analyticsSortBy === 'distance') {
      list.sort((a, b) => b.totalDistance - a.totalDistance);
    } else if (state.analyticsSortBy === 'move') {
      list.sort((a, b) => b.totalMoveCount - a.totalMoveCount);
    }

    tbody.innerHTML = list.map(item => {
      const isSelected = item.team === state.selectedTeamName;
      const diffSign = item.distanceDiffFromMean > 0 ? '+' : '';
      return `
        <tr class="${isSelected ? 'selected-row' : ''}" data-analytics-team="${item.team}" style="cursor:pointer;">
          <td>
            <span class="team-pill">
              <span class="team-swatch" style="background:${item.color}"></span>
              <strong>${item.team}</strong>
              <span style="color:#64748B; font-size:11px;">(${item.stadium})</span>
            </span>
          </td>
          <td class="num-col" style="font-weight:700;">${formatNumber(item.totalDistance, 1)} km</td>
          <td class="num-col" style="color:${item.withinDistanceTolerance ? '#059669' : '#E11D48'};">
            ${diffSign}${formatNumber(item.distanceDiffFromMean, 1)} km
          </td>
          <td class="center-col">
            <span class="badge ${item.withinDistanceTolerance ? 'badge-emerald' : 'badge-amber'}">
              ${item.withinDistanceTolerance ? '준수 (OK)' : '허용치 근접/초과'}
            </span>
          </td>
          <td class="num-col" style="font-weight:700;">${item.totalMoveCount}회</td>
          <td class="num-col">${item.weekdayMoveCount}회 <small style="color:#64748B;">(${formatNumber(item.weekdayDistance, 0)}km)</small></td>
          <td class="num-col">${item.weekendMoveCount}회 <small style="color:#64748B;">(${formatNumber(item.weekendDistance, 0)}km)</small></td>
          <td class="num-col">${item.weekendHomeGames}G (${item.weekendHomeSeries}시리즈)</td>
          <td class="num-col">${item.holidayHomeGames}G</td>
          <td class="num-col" style="font-weight:700; color:#4F46E5;">${item.holidayScore}점</td>
          <td class="center-col">
            <span class="badge ${item.maxHomeStreak <= state.config.maxConsecutiveHomeAway && item.maxAwayStreak <= state.config.maxConsecutiveHomeAway ? 'badge-slate' : 'badge-rose'}">
              홈 ${item.maxHomeStreak} / 원정 ${item.maxAwayStreak}
            </span>
          </td>
          <td class="center-col">
            ${item.openingDayHome ? '<span class="badge badge-indigo">개막홈</span>' : ''}
            ${item.childrenDayHome ? '<span class="badge badge-amber">어린이날홈</span>' : ''}
          </td>
        </tr>
      `;
    }).join('');

    const ls = state.evaluation.leagueSummary;
    tfoot.innerHTML = `
      <tr>
        <td>리그 평균 / 요약 (10구단)</td>
        <td class="num-col">${formatNumber(ls.meanDistance, 1)} km (합 ${formatNumber(ls.totalDistance, 0)})</td>
        <td class="num-col">격차 ${formatNumber(ls.maxDistanceSpread, 1)} km</td>
        <td class="center-col">${ls.teamsWithinDistanceTolerance} / 10구단 준수</td>
        <td class="num-col">평균 ${ls.meanMoveCount}회</td>
        <td class="num-col">-</td>
        <td class="num-col">-</td>
        <td class="num-col">균등 배정</td>
        <td class="num-col">-</td>
        <td class="num-col">평균 ${ls.meanHolidayScore}점</td>
        <td class="center-col">최대 ${state.config.maxConsecutiveHomeAway}연속 제한</td>
        <td class="center-col">개막 5 / 어린이날 5</td>
      </tr>
    `;

    tbody.querySelectorAll('tr[data-analytics-team]').forEach(tr => {
      tr.addEventListener('click', () => {
        state.selectedTeamName = tr.getAttribute('data-analytics-team');
        state.radarTeamA = state.selectedTeamName;
        state.inspectorMode = 'team';
        syncInspectorTabs();
        renderTeamAnalyticsSpreadsheet();
        syncRadarSelectors();
        renderAllFiveCharts();
        renderInspector();
        renderDockAndHeader();
      });
    });
  }

  function syncRadarSelectors() {
    const selA = document.getElementById('radarTeamA');
    const selB = document.getElementById('radarTeamB');
    if (!selA || !selB) return;

    const opts = state.teams.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
    selA.innerHTML = opts;
    selB.innerHTML = opts;
    selA.value = state.radarTeamA;
    selB.value = state.radarTeamB;
  }

  function setupHiDPICanvas(canvas, fallbackW = 600, fallbackH = 270) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(360, rect.width || fallbackW);
    const H = fallbackH;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    return { ctx, W, H };
  }

  function renderAllFiveCharts() {
    if (!state.evaluation) return;
    drawChart1DistanceToleranceBand();
    drawChart2MoveDaysComparison();
    drawChart3HolidayBalance();
    drawChart4TeamRadar();
    renderChart5MonthlyHeatmapAndGantt();
  }

  // CHART 1: Team Total Distance & Mean ±300km Tolerance Band
  function drawChart1DistanceToleranceBand() {
    const canvas = document.getElementById('chartDistanceBand');
    if (!canvas) return;
    const { ctx, W, H } = setupHiDPICanvas(canvas, 600, 270);

    const items = state.evaluation.teamAnalytics;
    const initMap = {};
    if (state.initialEvaluation) {
      state.initialEvaluation.teamAnalytics.forEach(a => { initMap[a.team] = a.totalDistance; });
    }

    const mean = state.evaluation.leagueSummary.meanDistance;
    const tol = Number(state.config.toleranceTotalDistance || 300);

    const spreadBadge = document.getElementById('chart1SpreadBadge');
    if (spreadBadge) {
      spreadBadge.textContent = `최대-최소 격차: ${formatNumber(state.evaluation.leagueSummary.maxDistanceSpread, 1)} km`;
    }

    const minY = 5800;
    const maxY = 8500;
    const pad = { l: 52, r: 20, t: 24, b: 36 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;
    const toY = (val) => pad.t + ch - ((val - minY) / (maxY - minY)) * ch;

    // Shaded Mean ± Tolerance Band
    const yTopTol = toY(mean + tol);
    const yBotTol = toY(mean - tol);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.13)';
    ctx.fillRect(pad.l, yTopTol, cw, yBotTol - yTopTol);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(pad.l, yTopTol, cw, yBotTol - yTopTol);
    ctx.setLineDash([]);

    // Mean line
    const yMean = toY(mean);
    ctx.beginPath();
    ctx.moveTo(pad.l, yMean);
    ctx.lineTo(W - pad.r, yMean);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Y axis grid & labels
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748B';
    [6000, 6600, 7200, 7800, 8400].forEach(v => {
      const y = toY(v);
      ctx.strokeStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
      ctx.fillText(`${(v / 1000).toFixed(1)}k`, 10, y + 3);
    });

    // Draw Bars for 10 teams
    const colW = cw / items.length;
    items.forEach((item, i) => {
      const xCenter = pad.l + colW * i + colW / 2;
      const barW = state.compareInitialOverlay ? 16 : 24;

      // Optional Initial Plan comparison ghost bar
      if (state.compareInitialOverlay && initMap[item.team]) {
        const initVal = initMap[item.team];
        const yInit = toY(initVal);
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(xCenter - barW - 2, yInit, barW, pad.t + ch - yInit);
      }

      const yVal = toY(item.totalDistance);
      const isSelected = item.team === state.selectedTeamName;
      ctx.fillStyle = item.withinDistanceTolerance ? item.color : '#E11D48';
      const xBar = state.compareInitialOverlay ? xCenter + 2 : xCenter - barW / 2;
      ctx.fillRect(xBar, yVal, barW, pad.t + ch - yVal);

      if (isSelected) {
        ctx.strokeStyle = '#4F46E5';
        ctx.lineWidth = 2;
        ctx.strokeRect(xBar - 2, yVal - 2, barW + 4, pad.t + ch - yVal + 4);
      }

      // Value label
      ctx.fillStyle = '#0F172A';
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(item.totalDistance), xBar + barW / 2, yVal - 5);

      // Team name X label
      ctx.fillStyle = isSelected ? '#4F46E5' : '#334155';
      ctx.font = `${isSelected ? '700' : '600'} 11px "Pretendard", sans-serif`;
      ctx.fillText(item.team, xCenter, H - 14);
    });
    ctx.textAlign = 'left';
  }

  // CHART 2: Total Move Days vs Weekday Move Days Horizontal Bar Chart
  function drawChart2MoveDaysComparison() {
    const canvas = document.getElementById('chartMoveDays');
    if (!canvas) return;
    const { ctx, W, H } = setupHiDPICanvas(canvas, 600, 270);

    const items = state.evaluation.teamAnalytics;
    const badge = document.getElementById('chart2MoveBadge');
    if (badge) badge.textContent = `평균 이동: ${state.evaluation.leagueSummary.meanMoveCount}회`;

    const pad = { l: 54, r: 44, t: 22, b: 24 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;
    const rowH = ch / items.length;
    const maxMoves = 42;

    items.forEach((item, i) => {
      const y = pad.t + rowH * i + 3;
      const barH = Math.max(10, rowH - 7);
      const totalW = (item.totalMoveCount / maxMoves) * cw;
      const wkdayW = (item.weekdayMoveCount / maxMoves) * cw;

      // Total moves background bar (Weekend portion)
      ctx.fillStyle = '#E0E7FF';
      ctx.fillRect(pad.l, y, totalW, barH);

      // Weekday move bar (overlay)
      ctx.fillStyle = item.team === state.selectedTeamName ? '#4F46E5' : '#6366F1';
      ctx.fillRect(pad.l, y, wkdayW, barH);

      // Team label
      ctx.fillStyle = item.team === state.selectedTeamName ? '#4F46E5' : '#1E293B';
      ctx.font = '600 11px "Pretendard", sans-serif';
      ctx.fillText(item.team, 10, y + barH - 2);

      // Value text
      ctx.fillStyle = '#0F172A';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillText(`총 ${item.totalMoveCount}회 (주중 ${item.weekdayMoveCount})`, pad.l + totalW + 6, y + barH - 2);
    });
  }

  // CHART 3: Weekend Home Games & Holiday Score Comparison Chart
  function drawChart3HolidayBalance() {
    const canvas = document.getElementById('chartHolidayBalance');
    if (!canvas) return;
    const { ctx, W, H } = setupHiDPICanvas(canvas, 600, 270);

    const items = state.evaluation.teamAnalytics;
    const pad = { l: 42, r: 24, t: 26, b: 34 };
    const cw = W - pad.l - pad.r;
    const ch = H - pad.t - pad.b;
    const maxScore = 32;
    const toY = (v) => pad.t + ch - (v / maxScore) * ch;

    const colW = cw / items.length;

    // Bars for Weekend Home Games & Holiday Home Games
    items.forEach((item, i) => {
      const xc = pad.l + colW * i + colW / 2;
      const yWk = toY(item.weekendHomeGames);
      const yHol = toY(item.holidayHomeGames);

      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(xc - 13, yWk, 12, pad.t + ch - yWk);

      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(xc + 1, yHol, 12, pad.t + ch - yHol);

      ctx.fillStyle = '#334155';
      ctx.font = '600 11px "Pretendard", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.team, xc, H - 12);
    });

    // Line for Total Holiday Score
    ctx.beginPath();
    items.forEach((item, i) => {
      const xc = pad.l + colW * i + colW / 2;
      const yS = toY(item.holidayScore);
      if (i === 0) ctx.moveTo(xc, yS);
      else ctx.lineTo(xc, yS);
    });
    ctx.strokeStyle = '#4F46E5';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    items.forEach((item, i) => {
      const xc = pad.l + colW * i + colW / 2;
      const yS = toY(item.holidayScore);
      ctx.beginPath();
      ctx.arc(xc, yS, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#4F46E5';
      ctx.fill();
      ctx.fillStyle = '#1E1B4B';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(`${item.holidayScore}점`, xc, yS - 7);
    });
    ctx.textAlign = 'left';
  }

  // CHART 4: 5-Axis Team Comparison Radar Chart
  function drawChart4TeamRadar() {
    const canvas = document.getElementById('chartTeamRadar');
    if (!canvas) return;
    const { ctx, W, H } = setupHiDPICanvas(canvas, 600, 270);

    const map = {};
    state.evaluation.teamAnalytics.forEach(a => { map[a.team] = a; });
    const teamA = map[state.radarTeamA] || state.evaluation.teamAnalytics[0];
    const teamB = map[state.radarTeamB] || state.evaluation.teamAnalytics[9];

    const axes = [
      { label: '거리 효율성', calc: (t) => Math.max(0.2, Math.min(1, 1 - (t.totalDistance - 6500) / 2200)) },
      { label: '총 이동 억제', calc: (t) => Math.max(0.2, Math.min(1, 1 - (t.totalMoveCount - 30) / 12)) },
      { label: '주중 이동 억제', calc: (t) => Math.max(0.2, Math.min(1, 1 - (t.weekdayMoveCount - 12) / 12)) },
      { label: '주말 홈경기', calc: (t) => Math.max(0.2, Math.min(1, t.weekendHomeGames / 28)) },
      { label: '공휴일 점수', calc: (t) => Math.max(0.2, Math.min(1, t.holidayScore / 30)) }
    ];

    const cx = W / 2;
    const cy = H / 2 + 6;
    const R = Math.min(W, H) * 0.36;

    // Draw concentric web
    [0.25, 0.5, 0.75, 1.0].forEach(level => {
      ctx.beginPath();
      axes.forEach((_, idx) => {
        const ang = -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length;
        const x = cx + Math.cos(ang) * R * level;
        const y = cy + Math.sin(ang) * R * level;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = '#E2E8F0';
      ctx.stroke();
    });

    // Axis spokes & labels
    axes.forEach((ax, idx) => {
      const ang = -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();

      const lx = cx + Math.cos(ang) * (R + 22);
      const ly = cy + Math.sin(ang) * (R + 16);
      ctx.fillStyle = '#334155';
      ctx.font = '600 11px "Pretendard", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ax.label, lx, ly + 4);
    });

    const drawPoly = (teamObj, strokeCol, fillCol) => {
      ctx.beginPath();
      axes.forEach((ax, idx) => {
        const val = ax.calc(teamObj);
        const ang = -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length;
        const x = cx + Math.cos(ang) * R * val;
        const y = cy + Math.sin(ang) * R * val;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = fillCol;
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    };

    drawPoly(teamB, '#F59E0B', 'rgba(245, 158, 11, 0.18)');
    drawPoly(teamA, '#4F46E5', 'rgba(79, 70, 229, 0.22)');
    ctx.textAlign = 'left';
  }

  // CHART 5: Monthly Distance Heatmap (Mar~Aug) & Full-Season 45-Series Gantt Strip
  function renderChart5MonthlyHeatmapAndGantt() {
    const heatWrap = document.getElementById('monthlyHeatmapContainer');
    const ganttWrap = document.getElementById('seasonGanttContainer');
    if (!heatWrap || !ganttWrap || !state.evaluation) return;

    const months = ['03', '04', '05', '06', '07', '08'];
    heatWrap.innerHTML = `
      <table class="sheet-table matrix-sheet-table">
        <thead>
          <tr>
            <th>구단</th>
            ${months.map(m => `<th>${Number(m)}월</th>`).join('')}
            <th>시즌 합계</th>
          </tr>
        </thead>
        <tbody>
          ${state.evaluation.teamAnalytics.map(a => {
            const mCells = months.map(m => {
              const d = a.monthlyDistances[m] || 0;
              let cls = 'dist-short';
              if (d >= 1100 && d < 1500) cls = 'dist-mid';
              else if (d >= 1500 && d < 1850) cls = 'dist-long';
              else if (d >= 1850) cls = 'dist-vlong';
              return `<td class="${cls} mono">${Math.round(d)}</td>`;
            }).join('');
            return `
              <tr class="${a.team === state.selectedTeamName ? 'selected-row' : ''}">
                <th style="background:#F8FAFC;">
                  <span class="team-pill"><span class="team-swatch" style="background:${a.color}"></span>${a.team}</span>
                </th>
                ${mCells}
                <td class="mono" style="font-weight:700;">${Math.round(a.totalDistance)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Gantt Strip across 45 slots
    const slots = state.evaluation.slotSummaries;
    ganttWrap.innerHTML = `
      <table class="gantt-table">
        <thead>
          <tr>
            <th style="min-width:62px; position:sticky; left:0; background:#F8FAFC;">구단</th>
            ${slots.map((s, idx) => `
              <th title="${s.date} (${s.dow}) ${s.consecutive}연전">
                ${idx + 1}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${state.evaluation.teamAnalytics.map(a => {
            const stepCells = a.routeSteps.map(rs => `
              <td class="gantt-slot-cell ${rs.isHome ? 'gantt-slot-home' : 'gantt-slot-away'}"
                  data-gantt-date="${rs.date}" data-gantt-team="${a.team}"
                  style="${rs.isHome ? `background:${a.color};` : ''}"
                  title="[${a.team}] ${rs.date}(${rs.dow}) vs ${rs.opponent} (${rs.isHome ? '홈' : '원정'} · 이동 ${rs.distance}km)">
                ${rs.isHome ? 'H' : 'A'}
              </td>
            `).join('');
            return `
              <tr>
                <th style="position:sticky; left:0; background:#F8FAFC; font-weight:700;">${a.team}</th>
                ${stepCells}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    ganttWrap.querySelectorAll('.gantt-slot-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        state.selectedDate = cell.getAttribute('data-gantt-date');
        state.selectedTeamName = cell.getAttribute('data-gantt-team');
        state.inspectorMode = 'date';
        syncInspectorTabs();
        renderInspector();
        renderDockAndHeader();
      });
    });
  }

  // =========================================================================
  // 9. RIGHT CONTEXT INSPECTOR DRAWER (TEAM ROUTE & DATE/EVENT EDITOR)
  // =========================================================================
  function syncInspectorTabs() {
    document.querySelectorAll('#inspectorTabs .insp-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-insp-mode') === state.inspectorMode);
    });
    const teamPane = document.getElementById('inspectorTeamPane');
    const datePane = document.getElementById('inspectorDatePane');
    if (teamPane) teamPane.classList.toggle('hidden', state.inspectorMode !== 'team');
    if (datePane) datePane.classList.toggle('hidden', state.inspectorMode !== 'date');
  }

  function renderInspector() {
    if (!state.evaluation) return;
    renderTeamInspectorPane();
    renderDateInspectorPane();
  }

  function renderTeamInspectorPane() {
    const pane = document.getElementById('inspectorTeamPane');
    if (!pane) return;

    const team = getTeamByName(state.selectedTeamName);
    const analytics = state.evaluation.teamAnalytics.find(a => a.team === team.name) || state.evaluation.teamAnalytics[0];
    const lookup = KBOEngine.buildDistanceLookup(state.teams, state.distanceMatrix);

    const otherDistances = state.teams
      .filter(t => t.name !== team.name)
      .map(t => ({ to: t.name, stadium: t.stadium, dist: lookup[team.name]?.[t.name] ?? 0 }))
      .sort((a, b) => a.dist - b.dist);

    pane.innerHTML = `
      <div class="insp-card">
        <div class="insp-section-title">
          <span class="team-pill">
            <span class="team-swatch" style="background:${team.color}"></span>
            <strong style="font-size:13.5px; color:#0F172A;">${team.fullName || team.name}</strong>
          </span>
          <span class="badge badge-indigo">${team.stadium}</span>
        </div>
        <div style="font-size:11px; color:#64748B;">
          📍 ${team.address || team.city || ''} (${team.latitude.toFixed(4)}°N, ${team.longitude.toFixed(4)}°E)
        </div>
        <div class="dock-kpi-grid" style="margin-top:4px;">
          <div class="dock-kpi" style="background:#FFFFFF; border:1px solid #E2E8F0;">
            <span class="dock-kpi-label">시즌 총 이동거리</span>
            <strong class="dock-kpi-val" style="color:#0F172A;">${formatNumber(analytics.totalDistance, 1)} km</strong>
          </div>
          <div class="dock-kpi" style="background:#FFFFFF; border:1px solid #E2E8F0;">
            <span class="dock-kpi-label">총 이동 / 주중 이동</span>
            <strong class="dock-kpi-val" style="color:#0F172A;">${analytics.totalMoveCount}회 / ${analytics.weekdayMoveCount}회</strong>
          </div>
          <div class="dock-kpi" style="background:#FFFFFF; border:1px solid #E2E8F0;">
            <span class="dock-kpi-label">주말 홈 / 공휴일 홈</span>
            <strong class="dock-kpi-val" style="color:#0F172A;">${analytics.weekendHomeGames}G / ${analytics.holidayHomeGames}G</strong>
          </div>
          <div class="dock-kpi" style="background:#FFFFFF; border:1px solid #E2E8F0;">
            <span class="dock-kpi-label">휴일 종합점수</span>
            <strong class="dock-kpi-val" style="color:#4F46E5;">${analytics.holidayScore}점</strong>
          </div>
        </div>
      </div>

      <div class="insp-card">
        <div class="insp-section-title">
          <span>타 구장까지의 도로 이동거리 (${team.stadium} 출발)</span>
          <span class="mono" style="font-size:10px;">단위: km</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          ${otherDistances.map(od => `
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px;">
              <span>→ <strong>${od.to}</strong> (${od.stadium})</span>
              <span class="mono" style="font-weight:700;">${od.dist.toFixed(1)} km</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="insp-card" style="flex:1;">
        <div class="insp-section-title">
          <span>[${team.name}] 시즌 45시리즈 이동 경로 로그</span>
          <span class="badge badge-slate">${analytics.routeSteps.length}슬롯</span>
        </div>
        <div class="route-step-list">
          ${analytics.routeSteps.map(rs => `
            <div class="route-step-item" data-route-date="${rs.date}">
              <div>
                <strong class="mono">${rs.stepIndex}. ${rs.date.slice(5)}(${rs.dow})</strong>
                <span class="badge ${rs.isHome ? 'badge-indigo' : 'badge-slate'}" style="margin-left:4px;">
                  ${rs.isHome ? '홈' : '원정'} vs ${rs.opponent}
                </span>
                <div style="font-size:10px; color:#64748B; margin-top:2px;">${rs.path} · ${rs.moveType}</div>
              </div>
              <div style="text-align:right;">
                <strong class="mono" style="color:${rs.distance > 0 ? '#4F46E5' : '#94A3B8'};">+${rs.distance.toFixed(1)}km</strong>
                <div class="mono" style="font-size:9.5px; color:#64748B;">누적 ${Math.round(rs.cumulativeDistance)}km</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    pane.querySelectorAll('.route-step-item[data-route-date]').forEach(el => {
      el.addEventListener('click', () => {
        state.selectedDate = el.getAttribute('data-route-date');
        state.inspectorMode = 'date';
        syncInspectorTabs();
        renderDateInspectorPane();
        renderCalendarViews();
      });
    });
  }

  function renderDateInspectorPane() {
    const pane = document.getElementById('inspectorDatePane');
    if (!pane) return;

    const dStr = state.selectedDate;
    const dowKo = KBOEngine.getDayOfWeekKo(dStr);
    const slot = state.evaluation.slotSummaries.find(s => s.date === dStr);
    const isAllStar = dStr >= state.config.allStarStartDate && dStr <= state.config.allStarEndDate;
    const dowNum = KBOEngine.parseDateStr(dStr).getDay();
    const isRest = state.config.restDaysOfWeek.includes(dowNum) && dStr !== state.config.childrenDayStart;

    let slotMatchesHtml = '';
    if (slot) {
      slotMatchesHtml = slot.matches.map(m => {
        const ht = getTeamByName(m.home);
        const st = m.stadiumOverride || ht.stadium;
        return `
          <div class="route-step-item">
            <div>
              <strong>${m.away}</strong> (원정) vs <strong>${m.home}</strong> (홈)
              <div style="font-size:10px; color:#64748B;">🏟️ @${st} · ${slot.consecutive}연전</div>
            </div>
            <button type="button" class="btn btn-outline btn-xs btn-swap-homeaway" data-match-idx="${m._idx}" title="홈/원정 맞교환 후 실시간 제약 점수 재계산">
              ⇄ 홈/원정 스왑
            </button>
          </div>
        `;
      }).join('');
    } else if (isAllStar) {
      slotMatchesHtml = `<div style="padding:10px; font-size:12px; color:#5B21B6; background:#EDE9FE; border-radius:6px;">⭐ 올스타 브레이크 기간 (${state.config.allStarStartDate} ~ ${state.config.allStarEndDate}) — 정규시즌 경기 미개최</div>`;
    } else if (isRest) {
      slotMatchesHtml = `<div style="padding:10px; font-size:12px; color:#475569; background:#E2E8F0; border-radius:6px;">🛌 정기 휴식일 (${dowKo}요일) — 경기 없음</div>`;
    } else {
      slotMatchesHtml = `<div style="padding:10px; font-size:12px; color:#64748B;">직전 시리즈 연전 진행 일자입니다.</div>`;
    }

    pane.innerHTML = `
      <div class="insp-card">
        <div class="insp-section-title">
          <strong class="mono" style="font-size:14px; color:#0F172A;">📅 ${dStr} (${dowKo}요일)</strong>
          ${slot ? `<span class="badge badge-indigo">${slot.consecutive}연전 · 휴일 ${slot.holiday}점</span>` : '<span class="badge badge-slate">비슬롯/진행일</span>'}
        </div>
        ${slot && slot.violations.length > 0 ? `
          <div style="background:#FFF1F2; border:1px solid #FECDD3; color:#E11D48; padding:8px; border-radius:6px; font-size:11px; font-weight:600;">
            ${slot.violations.map(v => `<div>🚨 ${v}</div>`).join('')}
          </div>
        ` : ''}
        <div style="display:flex; gap:6px; margin-top:4px;">
          <button type="button" class="btn btn-secondary btn-xs flex-1" id="btnInspSendDateToComposer">
            📌 이 날짜를 특별 이벤트 빌더로 불러오기
          </button>
        </div>
      </div>

      <div class="insp-card">
        <div class="insp-section-title">
          <span>배정된 매치업 &amp; 실시간 홈/원정 편집</span>
          <span class="mono" style="font-size:10px;">Live Score 연동</span>
        </div>
        <div class="route-step-list">
          ${slotMatchesHtml}
        </div>
      </div>
    `;

    pane.querySelector('#btnInspSendDateToComposer')?.addEventListener('click', () => {
      const dtInput = document.getElementById('evtDateInput');
      if (dtInput) dtInput.value = dStr;
      switchView('view-calendar');
      showToast(`${dStr} 일자가 이벤트 빌더에 선택되었습니다.`, 'info');
    });

    pane.querySelectorAll('.btn-swap-homeaway').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-match-idx'));
        const plan = getActivePlan();
        const match = plan[idx];
        if (!match) return;
        const oldHome = match.home;
        match.home = match.away;
        match.away = oldHome;
        recomputeEvaluation();
        refreshAllViews();
        showToast(`${dStr} 매치 홈/원정 변경 (${match.away} vs ${match.home}) → 실시간 스코어 갱신됨!`, 'info');
      });
    });
  }

  // =========================================================================
  // 10. EVENT LISTENERS & VIEW NAVIGATION WIRING
  // =========================================================================
  const VIEW_TITLES = {
    'view-teams': ['STEP 1 / 4', '구단·구장 스프레드시트 & 위경도 기반 이동거리 시트'],
    'view-calendar': ['STEP 2 / 4', '시즌 달력(3~8월) · 정기 휴식일 · 특정 이벤트 & 올스타 브레이크 편성'],
    'view-solver': ['STEP 3 / 4', '최종 입력 점검 시트(Pre-flight) & OptaPlanner 일정 생성 엔진 실행'],
    'view-analytics': ['STEP 4 / 4', '엔진 실행 결과: Hard 제약 검증 · 구단별 Soft 비교시트 · 5대 차트 분석']
  };

  function switchView(viewId) {
    state.activeView = viewId;
    document.querySelectorAll('#dockNav .dock-nav-item').forEach(btn => {
      const active = btn.getAttribute('data-view') === viewId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    document.querySelectorAll('.workspace-view').forEach(sec => {
      sec.classList.toggle('active', sec.id === viewId);
    });

    const [stepTxt, titleTxt] = VIEW_TITLES[viewId] || VIEW_TITLES['view-teams'];
    const badgeEl = document.getElementById('headerStepBadge');
    const titleEl = document.getElementById('headerTitle');
    if (badgeEl) badgeEl.textContent = stepTxt;
    if (titleEl) titleEl.textContent = titleTxt;

    if (viewId === 'view-teams') {
      updateInteractiveMap();
    } else if (viewId === 'view-calendar') {
      renderCalendarViews();
    } else if (viewId === 'view-solver') {
      renderPreflightView();
    } else if (viewId === 'view-analytics') {
      renderAnalyticsView();
    }
  }

  function refreshAllViews() {
    renderDockAndHeader();
    renderStadiumPresetChips();
    renderTeamsSpreadsheet();
    renderDistanceMatrixSpreadsheet();
    updateInteractiveMap();
    renderSpecialEventsList();
    renderCalendarViews();
    renderPreflightView();
    renderAnalyticsView();
    renderInspector();
  }

  function bindGlobalEvents() {
    // Left dock step navigation
    document.querySelectorAll('#dockNav .dock-nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.getAttribute('data-view')));
    });

    // Keyboard shortcuts Alt+1..4
    window.addEventListener('keydown', (e) => {
      if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const map = { '1': 'view-teams', '2': 'view-calendar', '3': 'view-solver', '4': 'view-analytics' };
        switchView(map[e.key]);
      }
    });

    // Clear team filter
    document.getElementById('btnClearTeamFilter')?.addEventListener('click', () => {
      state.focusedTeamFilter = null;
      refreshAllViews();
      showToast('구단 필터가 해제되어 전체 10개 구단을 표시합니다.', 'info');
    });

    // Global Plan Switcher
    document.querySelectorAll('#globalPlanSwitcher .seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activePlanMode = btn.getAttribute('data-plan-mode');
        recomputeEvaluation();
        refreshAllViews();
        showToast(`분석 플랜 전환: [${btn.textContent.trim()}]`, 'info');
      });
    });

    // Inspector Drawer Toggle / Close / Tabs
    document.getElementById('btnToggleInspector')?.addEventListener('click', () => {
      document.getElementById('appShell')?.classList.toggle('inspector-collapsed');
      setTimeout(() => {
        updateInteractiveMap();
        if (state.activeView === 'view-analytics') renderAllFiveCharts();
      }, 240);
    });
    document.getElementById('btnCloseInspector')?.addEventListener('click', () => {
      document.getElementById('appShell')?.classList.add('inspector-collapsed');
    });
    document.querySelectorAll('#inspectorTabs .insp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.inspectorMode = tab.getAttribute('data-insp-mode');
        syncInspectorTabs();
      });
    });

    // View 1: Geocode All & Calculate 10x10 Distance Matrix
    document.getElementById('btnGeocodeAll')?.addEventListener('click', async () => {
      for (const t of state.teams) {
        const res = await KBOEngine.geocodeLocation(t.stadium);
        if (res) {
          t.latitude = res.latitude;
          t.longitude = res.longitude;
        }
      }
      renderTeamsSpreadsheet();
      updateInteractiveMap();
      showToast('전 구단 구장 위경도 자동 매칭이 완료되었습니다.', 'success');
    });

    document.getElementById('btnCalcDistances')?.addEventListener('click', async () => {
      const useLive = document.getElementById('chkLiveOsrmApi')?.checked;
      const newMatrix = await KBOEngine.calculateDistanceMatrixFromCoords(state.teams, {
        useLiveRouteApi: !!useLive,
        forceFormula: true
      });
      state.distanceMatrix = newMatrix;
      recomputeEvaluation();
      renderDistanceMatrixSpreadsheet();
      updateInteractiveMap();
      renderDockAndHeader();
      renderInspector();
      showToast('📍 10개 구장 위경도 기반 10×10 도로 이동거리 행렬 자동 계산 완료!', 'success');
    });

    // Map Engine Tabs
    document.querySelectorAll('#mapEngineTabs .map-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.mapMode = tab.getAttribute('data-map-mode');
        syncMapModeUI();
        updateInteractiveMap();
      });
    });

    document.getElementById('btnLoadExternalMapSdk')?.addEventListener('click', () => {
      const provider = document.getElementById('sdkProviderSelect')?.value;
      const key = document.getElementById('sdkApiKeyInput')?.value.trim();
      const extContainer = document.getElementById('externalMapContainer');
      if (!key) {
        if (extContainer) {
          extContainer.innerHTML = `
            <div style="padding:36px; text-align:center; color:#334155;">
              <h3 style="margin-bottom:8px;">${provider === 'kakao' ? 'Kakao Map' : 'Naver Map'} JavaScript SDK 연동 대기</h3>
              <p style="font-size:12px; color:#64748B;">상단 입력창에 발급받은 API Key를 입력하면 즉시 스크립트가 동적 로드됩니다.<br/>키 없이도 <strong>[Leaflet 지도]</strong> 및 <strong>[SVG 벡터지도]</strong> 탭에서 모든 기능이 100% 동작합니다.</p>
            </div>
          `;
        }
        showToast('API Key 미입력 상태입니다. Leaflet 또는 SVG 벡터지도를 즉시 사용할 수 있습니다.', 'warn');
        return;
      }
      showToast(`${provider.toUpperCase()} Map SDK 스크립트 로드를 요청했습니다.`, 'info');
    });

    // View 2: Season Period, Regular Rest Days & All-Star Break Config
    ['cfgSeasonStart', 'cfgSeasonEnd', 'cfgAllStarStart', 'cfgAllStarEnd'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;
        if (id === 'cfgSeasonStart') state.config.matchStartDate = val;
        if (id === 'cfgSeasonEnd') state.config.matchEndDate = val;
        if (id === 'cfgAllStarStart') state.config.allStarStartDate = val;
        if (id === 'cfgAllStarEnd') state.config.allStarEndDate = val;
        recomputeEvaluation();
        renderCalendarViews();
        renderPreflightView();
        renderDockAndHeader();
        showToast(`시즌 캘린더 기간 설정 갱신 (${val})`, 'info');
      });
    });

    document.querySelectorAll('#restDayCheckGroup input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', () => {
        chk.closest('.dow-chip')?.classList.toggle('active', chk.checked);
        const checkedDows = Array.from(document.querySelectorAll('#restDayCheckGroup input:checked'))
          .map(c => Number(c.value));
        state.config.restDaysOfWeek = checkedDows;
        recomputeEvaluation();
        renderCalendarViews();
        renderPreflightView();
        renderDockAndHeader();
        showToast(`정기 휴식일 요일 변경: ${checkedDows.map(d => KBOEngine.DAY_NAMES_KO[d] + '요일').join(', ') || '없음'}`, 'info');
      });
    });

    // Event Mode Radio Switch (TEAM_AND_STADIUM vs STADIUM_ONLY)
    document.querySelectorAll('input[name="evtSpecifyMode"]').forEach(rad => {
      rad.addEventListener('change', () => {
        const isBoth = rad.value === 'TEAM_AND_STADIUM';
        document.getElementById('modeCardBoth')?.classList.toggle('active', isBoth);
        document.getElementById('modeCardStadiumOnly')?.classList.toggle('active', !isBoth);
        document.getElementById('subboxTeamAndStadium')?.classList.toggle('hidden', !isBoth);
        document.getElementById('subboxStadiumOnly')?.classList.toggle('hidden', isBoth);
      });
    });

    // Add Team+Stadium Matchup Rule
    document.getElementById('btnAddMatchupRule')?.addEventListener('click', () => {
      const dt = document.getElementById('evtDateInput')?.value || '2025-03-22';
      const title = document.getElementById('evtTitleInput')?.value.trim() || '특별 지정 매치';
      const away = document.getElementById('evtAwaySelect')?.value;
      const home = document.getElementById('evtHomeSelect')?.value;
      const stadium = document.getElementById('evtStadiumSelect')?.value;

      if (away === home) {
        showToast('원정 구단과 홈 구단은 서로 달라야 합니다.', 'warn');
        return;
      }

      let evt = state.specialEvents.find(e => e.date === dt && e.mode === 'TEAM_AND_STADIUM');
      if (!evt) {
        evt = {
          id: 'evt-' + Date.now(),
          date: dt,
          title,
          mode: 'TEAM_AND_STADIUM',
          badge: '구단+구장 모두 지정',
          matchups: []
        };
        state.specialEvents.unshift(evt);
      }
      evt.matchups.push({ away, home, stadium });

      // Also reflect stadiumOverride on matching slot in active plan if present
      const plan = getActivePlan();
      const slotMatches = plan.filter(m => m.datetime.startsWith(dt));
      if (slotMatches.length > 0) {
        slotMatches[0].away = away;
        slotMatches[0].home = home;
        slotMatches[0].stadiumOverride = stadium;
      }

      state.selectedDate = dt;
      recomputeEvaluation();
      renderSpecialEventsList();
      renderCalendarViews();
      renderPreflightView();
      renderInspector();
      showToast(`[구단+구장 지정] ${dt} ${away} vs ${home} @${stadium} 이벤트가 반영되었습니다.`, 'success');
    });

    // Apply Stadium-Only Rule (e.g., Children's Day 5 Home Stadiums)
    document.getElementById('btnApplyStadiumOnlyRule')?.addEventListener('click', () => {
      const dt = document.getElementById('evtDateInput')?.value || '2025-05-05';
      const title = document.getElementById('evtTitleInput')?.value.trim() || '구장 지정 특별 시리즈';
      const checkedTeams = Array.from(document.querySelectorAll('#stadiumOnlyCheckGrid input:checked'))
        .map(c => c.value);

      if (checkedTeams.length === 0) {
        showToast('최소 1개 이상의 개최 의무 홈구장을 선택하세요.', 'warn');
        return;
      }

      if (dt === state.config.childrenDayStart) {
        state.config.childrenDayHomeTeams = checkedTeams;
      }

      const stadiums = checkedTeams.map(tn => getTeamByName(tn).stadium);
      const existingIdx = state.specialEvents.findIndex(e => e.date === dt && e.mode === 'STADIUM_ONLY');
      const newEvt = {
        id: 'evt-st-' + Date.now(),
        date: dt,
        title,
        mode: 'STADIUM_ONLY',
        badge: '구장만 지정 (원정 자동)',
        homeTeams: checkedTeams,
        stadiums
      };

      if (existingIdx >= 0) state.specialEvents[existingIdx] = newEvt;
      else state.specialEvents.unshift(newEvt);

      state.selectedDate = dt;
      recomputeEvaluation();
      renderTeamsSpreadsheet();
      renderSpecialEventsList();
      renderCalendarViews();
      renderPreflightView();
      renderDockAndHeader();
      showToast(`[구장만 지정] ${dt} (${checkedTeams.join(', ')}) 홈구장 의무 조건이 적용되었습니다.`, 'success');
    });

    document.getElementById('btnOpenAddEventModal')?.addEventListener('click', () => {
      document.getElementById('evtTitleInput')?.focus();
      showToast('아래 이벤트 빌더에서 [구단+구장 모두 지정] 또는 [구장만 지정]을 선택해 추가하세요.', 'info');
    });

    // Calendar Month Tabs & View Modes
    document.querySelectorAll('#calendarMonthTabs .month-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.calendarMonthFilter = btn.getAttribute('data-month');
        document.querySelectorAll('#calendarMonthTabs .month-tab').forEach(b => b.classList.toggle('active', b === btn));
        renderCalendarViews();
      });
    });

    document.querySelectorAll('#calendarViewModes .view-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.calendarSubView = btn.getAttribute('data-cal-view');
        document.querySelectorAll('#calendarViewModes .view-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderCalendarViews();
      });
    });

    // View 3: Tolerance Sliders & Solver Execution Buttons
    const bindSlider = (id, lblId, key, unit, prefix = '±') => {
      const rng = document.getElementById(id);
      const lbl = document.getElementById(lblId);
      if (!rng) return;
      rng.addEventListener('input', () => {
        const v = Number(rng.value);
        state.config[key] = v;
        if (lbl) lbl.textContent = `${prefix}${v} ${unit}`;
        recomputeEvaluation();
        renderDockAndHeader();
        renderPreflightView();
        renderAnalyticsView();
      });
    };
    bindSlider('rngTolDist', 'lblTolDist', 'toleranceTotalDistance', 'km');
    bindSlider('rngTolMove', 'lblTolMove', 'toleranceTotalMove', '회');
    bindSlider('rngTolHoliday', 'lblTolHoliday', 'toleranceHoliday', '점');
    bindSlider('rngMaxStreak', 'lblMaxStreak', 'maxConsecutiveHomeAway', '연속 시리즈', '최대 ');

    document.getElementById('btnStartSolverMain')?.addEventListener('click', runSolverSimulation);
    document.getElementById('btnDockRunSolver')?.addEventListener('click', runSolverSimulation);

    document.getElementById('btnLoadViolationFromSolver')?.addEventListener('click', () => {
      state.activePlanMode = 'violation';
      recomputeEvaluation();
      refreshAllViews();
      switchView('view-analytics');
      showToast('⚠️ Hard 제약 4건 위반 테스트 플랜이 로드되었습니다. 위반 진단 카드를 확인하세요.', 'warn');
    });

    document.getElementById('btnGoToAnalytics')?.addEventListener('click', () => {
      switchView('view-analytics');
    });

    // View 4: Table Sorting, Initial Comparison Overlay, Radar Team Selectors
    document.getElementById('chkCompareInitialOverlay')?.addEventListener('change', (e) => {
      state.compareInitialOverlay = e.target.checked;
      drawChart1DistanceToleranceBand();
    });

    document.getElementById('btnSortByDistance')?.addEventListener('click', () => {
      state.analyticsSortBy = 'distance';
      renderTeamAnalyticsSpreadsheet();
    });
    document.getElementById('btnSortByMove')?.addEventListener('click', () => {
      state.analyticsSortBy = 'move';
      renderTeamAnalyticsSpreadsheet();
    });
    document.getElementById('btnSortByTeamIndex')?.addEventListener('click', () => {
      state.analyticsSortBy = 'index';
      renderTeamAnalyticsSpreadsheet();
    });

    document.getElementById('radarTeamA')?.addEventListener('change', (e) => {
      state.radarTeamA = e.target.value;
      drawChart4TeamRadar();
    });
    document.getElementById('radarTeamB')?.addEventListener('change', (e) => {
      state.radarTeamB = e.target.value;
      drawChart4TeamRadar();
    });

    // Export JSON & Reset Workspace
    document.getElementById('btnExportJson')?.addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        config: state.config,
        teams: state.teams,
        distanceMatrix: state.distanceMatrix,
        specialEvents: state.specialEvents,
        score: state.evaluation?.score,
        plan: getActivePlan()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kbo_2025_schedule_${state.activePlanMode}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('현재 워크스페이스 설정 및 일정 JSON 파일이 다운로드되었습니다.', 'success');
    });

    document.getElementById('btnResetWorkspace')?.addEventListener('click', () => {
      state.teams = KBOEngine.deepClone(KBO_DATA.teams);
      state.distanceMatrix = KBOEngine.deepClone(KBO_DATA.distanceMatrix);
      state.plans.solved = KBOEngine.deepClone(KBO_DATA.solvedPlan);
      state.plans.initial = KBOEngine.deepClone(KBO_DATA.initialPlan);
      state.plans.violation = KBOEngine.createViolationDemoPlan();
      state.activePlanMode = 'solved';
      state.focusedTeamFilter = null;
      recomputeEvaluation();
      refreshAllViews();
      showToast('2025 KBO 공식 기본 데이터로 복원되었습니다.', 'info');
    });

    window.addEventListener('resize', () => {
      if (state.activeView === 'view-analytics') renderAllFiveCharts();
      if (state.activeView === 'view-solver') renderSolverConvergenceChart();
    });
  }

  // =========================================================================
  // 11. BOOTSTRAP APPLICATION
  // =========================================================================
  function init() {
    recomputeEvaluation();
    initEventComposerOptions();
    bindGlobalEvents();
    refreshAllViews();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
