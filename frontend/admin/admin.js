/**
 * CIVICFIX — ADMIN COMMAND CENTER CONTROLLER
 * Full-featured real-time admin interface for civic issue monitoring and triage.
 */

// -----------------------------------------------------------------------------
// 1. Configuration & Global State
// -----------------------------------------------------------------------------
const CONFIG = {
  // Auto-detect base API URL (handles both relative hosting and standalone dev servers)
  API_BASE: (window.location.port === '8000' || window.location.port === '80')
    ? '' 
    : 'http://127.0.0.1:8000',
  POLL_INTERVAL_MS: 6000, // Background polling every 6 seconds
  DEFAULT_MAP_CENTER: [28.6139, 77.2090], // Default coordinates (e.g. New Delhi)
  DEFAULT_MAP_ZOOM: 12
};

const state = {
  reports: [],
  filteredReports: [],
  selectedReportId: null,
  knownReportIds: new Set(),
  isInitialLoad: true,
  soundEnabled: true,
  filters: {
    search: '',
    status: 'ALL',
    priority: 'ALL',
    category: 'ALL'
  },
  map: null,
  markers: new Map(), // reportId -> Leaflet marker
  pollTimer: null,
  isUpdatingStatus: false
};

// -----------------------------------------------------------------------------
// 2. Category Icon & Helper Dictionaries
// -----------------------------------------------------------------------------
const CATEGORY_ICONS = {
  'roads': 'fa-solid fa-road',
  'road damage': 'fa-solid fa-road-barrier',
  'electricity': 'fa-solid fa-bolt',
  'water supply': 'fa-solid fa-faucet-drip',
  'water': 'fa-solid fa-droplet',
  'garbage': 'fa-solid fa-trash-can',
  'sanitation': 'fa-solid fa-broom',
  'drainage': 'fa-solid fa-water',
  'vandalism': 'fa-solid fa-spray-can',
  'public safety': 'fa-solid fa-shield-halved',
  'parks': 'fa-solid fa-tree',
  'traffic': 'fa-solid fa-traffic-light',
  'street light': 'fa-solid fa-lightbulb'
};

function getCategoryIcon(category) {
  if (!category) return 'fa-solid fa-triangle-exclamation';
  const key = category.toLowerCase().trim();
  for (const [name, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(name)) return icon;
  }
  return 'fa-solid fa-map-pin';
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
}

function formatExactDateTime(isoString) {
  if (!isoString) return 'Date unknown';
  try {
    const date = new Date(isoString);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

// -----------------------------------------------------------------------------
// 3. Web Audio API Notification Chime
// -----------------------------------------------------------------------------
function playAlertChime() {
  if (!state.soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.18); // A5

    osc2.frequency.setValueAtTime(880, now + 0.18);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.2);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.45);
  } catch (e) {
    // Audio context may be restricted by browser policy before first user interaction
  }
}

// -----------------------------------------------------------------------------
// 4. Toast Notification Hub
// -----------------------------------------------------------------------------
function showToast(type, title, message, duration = 4500, actionCallback = null, actionText = 'View Report') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-xmark',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info',
    'new-report': 'fa-solid fa-bell'
  };

  const iconClass = iconMap[type] || 'fa-solid fa-circle-info';

  let actionButtonHtml = '';
  if (actionCallback && typeof actionCallback === 'function') {
    actionButtonHtml = `<button class="toast-cta-btn" type="button">${actionText}</button>`;
  }

  toast.innerHTML = `
    <div class="toast-icon">
      <i class="${iconClass}"></i>
    </div>
    <div class="toast-content">
      <span class="toast-title">${escapeHtml(title)}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      ${actionButtonHtml}
    </div>
    <button class="toast-close" aria-label="Close notification" type="button">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  // Attach action button listener
  if (actionCallback) {
    const ctaBtn = toast.querySelector('.toast-cta-btn');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        actionCallback();
        dismissToast(toast);
      });
    }
  }

  // Attach close listener
  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => dismissToast(toast));
  }

  container.appendChild(toast);

  // Auto dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toast);
    }, duration);
  }
}

function dismissToast(toastElement) {
  if (!toastElement || toastElement.classList.contains('hiding')) return;
  toastElement.classList.add('hiding');
  setTimeout(() => {
    if (toastElement.parentNode) {
      toastElement.parentNode.removeChild(toastElement);
    }
  }, 250);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -----------------------------------------------------------------------------
// 5. Leaflet Map Engine
// -----------------------------------------------------------------------------
function initializeMap() {
  const mapElement = document.getElementById('civic-map');
  if (!mapElement || state.map) return;

  try {
    state.map = L.map('civic-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);

    // Invalidate size on load to avoid gray tiles
    setTimeout(() => {
      if (state.map) state.map.invalidateSize();
    }, 250);
  } catch (err) {
    console.error('Error initializing Leaflet map:', err);
  }
}

function createMarkerIcon(priority, status, isSelected = false) {
  const pClass = (priority || 'medium').toLowerCase();
  const isResolved = (status === 'Resolved');
  const pinColorClass = isResolved ? 'pin-resolved' : `pin-${pClass}`;
  const iconClass = isResolved ? 'fa-solid fa-check' : (priority === 'High' ? 'fa-solid fa-exclamation' : 'fa-solid fa-location-dot');

  const selectedClass = isSelected ? 'selected' : '';
  const rippleHtml = isSelected ? '<div class="pin-ripple-pulse"></div>' : '';

  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div class="pin-marker-wrapper ${selectedClass}">
        ${rippleHtml}
        <div class="pin-bubble ${pinColorClass}">
          <i class="${iconClass}"></i>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

function renderMarkers() {
  if (!state.map) return;

  // Clear existing markers
  state.markers.forEach(marker => marker.remove());
  state.markers.clear();

  const validReports = state.filteredReports.filter(r => 
    typeof r.latitude === 'number' && !isNaN(r.latitude) &&
    typeof r.longitude === 'number' && !isNaN(r.longitude)
  );

  const markerCountBadge = document.getElementById('map-pin-count');
  if (markerCountBadge) {
    markerCountBadge.textContent = `${validReports.length} pin${validReports.length === 1 ? '' : 's'}`;
  }

  if (validReports.length === 0) return;

  const latLngList = [];

  validReports.forEach(report => {
    const isSelected = (report.id === state.selectedReportId);
    const icon = createMarkerIcon(report.ai_priority, report.status, isSelected);

    const marker = L.marker([report.latitude, report.longitude], { icon });

    // Popup content
    const popupHtml = `
      <div class="map-popup-card">
        <div class="popup-top-row">
          <span class="popup-category">${escapeHtml(report.category || 'General')}</span>
          <span class="priority-pill priority-${(report.ai_priority || 'medium').toLowerCase()}">${escapeHtml(report.ai_priority || 'Medium')}</span>
        </div>
        <h4 class="popup-title">${escapeHtml(report.title)}</h4>
        <p class="popup-desc">${escapeHtml(report.description)}</p>
        <button class="popup-action-btn" onclick="window.civicAdmin.selectReport(${report.id})">
          <i class="fa-solid fa-arrow-right"></i> View Details
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);

    // Marker click event
    marker.on('click', () => {
      selectReport(report.id, true);
    });

    marker.addTo(state.map);
    state.markers.set(report.id, marker);
    latLngList.push([report.latitude, report.longitude]);
  });

  // Fit bounds if on initial load or reset
  if (latLngList.length > 0 && (state.isInitialLoad || !state.selectedReportId)) {
    try {
      const bounds = L.latLngBounds(latLngList);
      state.map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
    } catch (e) {}
  }
}

function updateMarkerHighlight(reportId) {
  if (!state.map) return;

  state.markers.forEach((marker, id) => {
    const report = state.reports.find(r => r.id === id);
    if (!report) return;
    const isSelected = (id === reportId);
    marker.setIcon(createMarkerIcon(report.ai_priority, report.status, isSelected));
    if (isSelected) {
      marker.openPopup();
    }
  });
}

// -----------------------------------------------------------------------------
// 6. Data Fetching & Real-time Polling
// -----------------------------------------------------------------------------
async function fetchReports(isBackgroundPoll = false) {
  const loadingState = document.getElementById('feed-loading-state');
  const errorState = document.getElementById('feed-error-state');
  const emptyState = document.getElementById('feed-empty-state');
  const reportsList = document.getElementById('reports-list');
  const syncLabel = document.getElementById('last-sync-time');

  try {
    // If first manual load, show skeleton
    if (state.isInitialLoad && loadingState) {
      loadingState.style.display = 'flex';
      if (reportsList) reportsList.style.display = 'none';
      if (errorState) errorState.style.display = 'none';
      if (emptyState) emptyState.style.display = 'none';
    }

    const response = await fetch(`${CONFIG.API_BASE}/api/reports/`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const reports = await response.json();

    // Update last sync label
    if (syncLabel) {
      const now = new Date();
      syncLabel.innerHTML = `<i class="fa-solid fa-rotate"></i> <span>Synced: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>`;
    }

    // Hide error & loading states
    if (errorState) errorState.style.display = 'none';
    if (loadingState) loadingState.style.display = 'none';
    if (reportsList) reportsList.style.display = 'flex';

    if (state.isInitialLoad) {
      // First load: seed known report IDs without false "new" notifications
      reports.forEach(r => state.knownReportIds.add(r.id));
      state.reports = reports;
      populateCategoryFilter(reports);
      updateKPIStatistics();
      applyFilters();

      // Auto-select first or highest priority report on initial load
      if (reports.length > 0) {
        const topReport = reports.find(r => r.ai_priority === 'High') || reports[0];
        selectReport(topReport.id);
      }

      state.isInitialLoad = false;
    } else {
      // Background poll: detect genuine new reports
      if (isBackgroundPoll) {
        checkForNewReports(reports);
      }
      state.reports = reports;
      populateCategoryFilter(reports);
      updateKPIStatistics();
      applyFilters();

      // Refresh currently selected report details if it's still present
      if (state.selectedReportId) {
        renderSelectedReportDetails();
      }
    }

  } catch (err) {
    console.error('Error fetching reports from backend:', err);

    if (state.isInitialLoad) {
      if (loadingState) loadingState.style.display = 'none';
      if (reportsList) reportsList.style.display = 'none';
      if (errorState) errorState.style.display = 'flex';
      showToast('error', 'Backend Disconnected', 'Could not fetch civic reports from FastAPI backend. Please check server.', 6000);
    }
  }
}

// -----------------------------------------------------------------------------
// 7. New Report Experience
// -----------------------------------------------------------------------------
function checkForNewReports(incomingReports) {
  const newReports = incomingReports.filter(r => !state.knownReportIds.has(r.id));

  if (newReports.length > 0) {
    // Play alert sound
    playAlertChime();

    newReports.forEach(newReport => {
      state.knownReportIds.add(newReport.id);
      newReport._isNewArrival = true;

      // Show high-priority Toast alert
      showToast(
        'new-report',
        `🔔 NEW CIVIC REPORT: #${newReport.id}`,
        `[${newReport.category || 'Issue'}] ${newReport.title} (${newReport.ai_priority || 'Medium'} Priority)`,
        8000,
        () => {
          selectReport(newReport.id);
        },
        'VIEW REPORT'
      );

      // Auto clear temporary glow badge after 15 seconds
      setTimeout(() => {
        delete newReport._isNewArrival;
        const cardEl = document.getElementById(`report-card-${newReport.id}`);
        if (cardEl) {
          cardEl.classList.remove('is-brand-new');
          const badge = cardEl.querySelector('.new-indicator-badge');
          if (badge) badge.remove();
        }
      }, 15000);
    });
  }
}

// -----------------------------------------------------------------------------
// 8. KPI Metric Calculations
// -----------------------------------------------------------------------------
function updateKPIStatistics() {
  const reports = state.reports;
  const total = reports.length;
  const critical = reports.filter(r => r.ai_priority === 'High').length;
  const inReview = reports.filter(r => r.status === 'In Review').length;
  const resolved = reports.filter(r => r.status === 'Resolved').length;

  animateCounter('count-total', total);
  animateCounter('count-critical', critical);
  animateCounter('count-review', inReview);
  animateCounter('count-resolved', resolved);
}

function animateCounter(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const startValue = parseInt(el.textContent, 10) || 0;
  if (startValue === targetValue) return;

  const duration = 400;
  const startTime = performance.now();

  function updateNumber(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOutProgress = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (targetValue - startValue) * easeOutProgress);
    el.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    } else {
      el.textContent = targetValue;
    }
  }

  requestAnimationFrame(updateNumber);
}

// -----------------------------------------------------------------------------
// 9. Filtering & Search Logic
// -----------------------------------------------------------------------------
function populateCategoryFilter(reports) {
  const categorySelect = document.getElementById('filter-category');
  if (!categorySelect) return;

  const currentSelection = categorySelect.value;
  const categories = new Set();
  reports.forEach(r => {
    if (r.category && r.category.trim()) {
      categories.add(r.category.trim());
    }
  });

  // Preserve existing options while updating dynamically
  const sortedCategories = Array.from(categories).sort();
  let html = '<option value="ALL">All Categories</option>';
  sortedCategories.forEach(cat => {
    html += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
  });

  categorySelect.innerHTML = html;
  if (categories.has(currentSelection)) {
    categorySelect.value = currentSelection;
  }
}

function applyFilters() {
  const { search, status, priority, category } = state.filters;
  const searchLower = search.toLowerCase().trim();

  state.filteredReports = state.reports.filter(report => {
    // Search match
    if (searchLower) {
      const matchTitle = (report.title || '').toLowerCase().includes(searchLower);
      const matchDesc = (report.description || '').toLowerCase().includes(searchLower);
      const matchCat = (report.category || '').toLowerCase().includes(searchLower);
      const matchId = String(report.id) === searchLower;
      if (!matchTitle && !matchDesc && !matchCat && !matchId) return false;
    }

    // Status filter
    if (status !== 'ALL' && report.status !== status) {
      return false;
    }

    // Priority filter
    if (priority !== 'ALL' && report.ai_priority !== priority) {
      return false;
    }

    // Category filter
    if (category !== 'ALL' && report.category !== category) {
      return false;
    }

    return true;
  });

  // Update visible count badge
  const visibleBadge = document.getElementById('visible-count-badge');
  if (visibleBadge) {
    visibleBadge.textContent = `${state.filteredReports.length} of ${state.reports.length} visible`;
  }

  renderReportsList();
  renderMarkers();

  // If selected report is no longer in filtered list, select first available
  if (state.filteredReports.length > 0) {
    const isSelectedVisible = state.filteredReports.some(r => r.id === state.selectedReportId);
    if (!isSelectedVisible && state.selectedReportId !== null) {
      selectReport(state.filteredReports[0].id);
    }
  }
}

// -----------------------------------------------------------------------------
// 10. Report Feed Rendering
// -----------------------------------------------------------------------------
function renderReportsList() {
  const reportsList = document.getElementById('reports-list');
  const emptyState = document.getElementById('feed-empty-state');
  if (!reportsList) return;

  if (state.filteredReports.length === 0) {
    reportsList.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  reportsList.innerHTML = state.filteredReports.map(report => {
    const isSelected = (report.id === state.selectedReportId);
    const pClass = (report.ai_priority || 'medium').toLowerCase();
    const statusClass = (report.status || 'Reported').toLowerCase().replace(/\s+/g, '-');
    const catIcon = getCategoryIcon(report.category);
    const timeAgo = formatRelativeTime(report.created_at);
    const isNew = report._isNewArrival ? 'is-brand-new' : '';

    return `
      <div 
        class="report-card priority-${pClass} ${isSelected ? 'selected' : ''} ${isNew}" 
        id="report-card-${report.id}"
        tabindex="0"
        role="button"
        onclick="window.civicAdmin.selectReport(${report.id})"
        onkeydown="if(event.key==='Enter'||event.key===' '){window.civicAdmin.selectReport(${report.id});event.preventDefault();}"
      >
        <div class="card-top-row">
          <span class="card-category-tag">
            <i class="${catIcon}"></i> ${escapeHtml(report.category || 'General')}
          </span>
          <div class="card-badges-group">
            ${report._isNewArrival ? '<span class="new-indicator-badge">NEW</span>' : ''}
            <span class="priority-pill priority-${pClass}">
              ${escapeHtml(report.ai_priority || 'Medium')}
            </span>
          </div>
        </div>

        <h3 class="card-title">${escapeHtml(report.title)}</h3>
        <p class="card-description-preview">${escapeHtml(report.description)}</p>

        <div class="card-footer-row">
          <span class="card-status-pill status-${statusClass}">
            <i class="fa-solid fa-circle" style="font-size: 0.45rem;"></i> ${escapeHtml(report.status || 'Reported')}
          </span>
          <div class="card-meta-right">
            ${report.image_url ? '<i class="fa-solid fa-camera card-has-photo" title="Has photo attachment"></i>' : ''}
            <span class="card-time"><i class="fa-regular fa-clock"></i> ${timeAgo}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------------------------------------------------------
// 11. Report Selection & Detail Inspection
// -----------------------------------------------------------------------------
function selectReport(reportId, fromMap = false) {
  state.selectedReportId = reportId;
  const report = state.reports.find(r => r.id === reportId);
  if (!report) return;

  // Highlight card in feed
  document.querySelectorAll('.report-card').forEach(card => {
    card.classList.toggle('selected', card.id === `report-card-${reportId}`);
  });

  // Scroll card into view if clicked from map
  if (fromMap) {
    const cardEl = document.getElementById(`report-card-${reportId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Update map marker selection & pan to location
  updateMarkerHighlight(reportId);

  if (!fromMap && state.map && typeof report.latitude === 'number' && typeof report.longitude === 'number') {
    state.map.flyTo([report.latitude, report.longitude], 15, {
      duration: 0.8,
      easeLinearity: 0.25
    });
  }

  // Render detail panel
  renderSelectedReportDetails();
}

function generateAIRecommendation(category, priority) {
  const cat = (category || '').toLowerCase();
  const prio = (priority || '').toLowerCase();

  if (cat.includes('road') || cat.includes('pothole')) {
    if (prio === 'high') {
      return 'Immediate dispatch of municipal road repair crew recommended. Place road hazard barriers and caution signage to avert vehicular damage and transit disruptions.';
    }
    return 'Schedule asphalt filling and road leveling with the zonal maintenance unit during next maintenance cycle.';
  }

  if (cat.includes('water') || cat.includes('leak')) {
    if (prio === 'high') {
      return 'High-urgency pipeline fault. Dispatch emergency water utility technician to isolate main valve and prevent flooding/water wastage.';
    }
    return 'Assign municipal plumbing inspection team to diagnose supply pressure drop and repair piping joint.';
  }

  if (cat.includes('electric') || cat.includes('light') || cat.includes('wire')) {
    if (prio === 'high') {
      return 'Critical electrical hazard. Alert city power board team immediately. Cordon off live wire vicinity to ensure public safety.';
    }
    return 'Log replacement request for street luminaire and schedule electric unit inspection within 48 hours.';
  }

  if (cat.includes('garbage') || cat.includes('waste') || cat.includes('sanitation')) {
    return 'Dispatch sanitation carrier truck for immediate waste removal and sanitize surrounding area with disinfectant spray.';
  }

  if (cat.includes('vandalism') || cat.includes('graffiti')) {
    return 'Issue work order to municipal beautification crew for graffiti removal and surface repainting.';
  }

  if (cat.includes('safety') || cat.includes('hazard')) {
    return 'Deploy local field safety officer for immediate on-ground verification and hazard containment.';
  }

  return 'Review incident report parameters and assign designated zonal officer for on-site assessment and resolution.';
}

function calculateUrgencyScore(priority) {
  switch ((priority || '').toLowerCase()) {
    case 'high': return '9.5 / 10 (Critical)';
    case 'low': return '3.8 / 10 (Minor)';
    default: return '6.8 / 10 (Moderate)';
  }
}

function renderSelectedReportDetails() {
  const noSelectionView = document.getElementById('no-selection-view');
  const activeView = document.getElementById('active-inspection-view');
  if (!noSelectionView || !activeView) return;

  const report = state.reports.find(r => r.id === state.selectedReportId);
  if (!report) {
    noSelectionView.style.display = 'flex';
    activeView.style.display = 'none';
    return;
  }

  noSelectionView.style.display = 'none';
  activeView.style.display = 'flex';

  // Basic Header Info
  document.getElementById('inspect-id').textContent = `#${report.id}`;
  document.getElementById('inspect-category').textContent = report.category || 'General';
  
  const priorityEl = document.getElementById('inspect-priority');
  priorityEl.textContent = report.ai_priority || 'Medium';
  priorityEl.className = `priority-badge priority-${(report.ai_priority || 'medium').toLowerCase()}`;

  const statusEl = document.getElementById('inspect-status');
  statusEl.textContent = report.status || 'Reported';
  statusEl.className = `status-badge status-${(report.status || 'reported').toLowerCase().replace(/\s+/g, '-')}`;

  document.getElementById('inspect-title').textContent = report.title;
  document.getElementById('inspect-time').textContent = formatExactDateTime(report.created_at);

  const coordsEl = document.getElementById('inspect-coords');
  if (typeof report.latitude === 'number' && typeof report.longitude === 'number') {
    coordsEl.textContent = `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`;
  } else {
    coordsEl.textContent = 'Coordinates unavailable';
  }

  // Description
  document.getElementById('inspect-desc').textContent = report.description || 'No description provided.';

  // Photo Attachment
  const photoContainer = document.getElementById('photo-container');
  const noPhotoNotice = document.getElementById('no-photo-notice');
  const inspectPhoto = document.getElementById('inspect-photo');

  if (report.image_url && report.image_url.trim()) {
    inspectPhoto.src = report.image_url;
    photoContainer.style.display = 'block';
    noPhotoNotice.style.display = 'none';

    // Lightbox modal click
    photoContainer.onclick = () => openPhotoModal(report.image_url, report.title);
  } else {
    photoContainer.style.display = 'none';
    noPhotoNotice.style.display = 'flex';
  }

  // AI Intelligence Section
  document.getElementById('ai-val-priority').textContent = report.ai_priority || 'Medium';
  document.getElementById('ai-val-category').textContent = report.category || 'General';
  document.getElementById('ai-val-urgency').textContent = calculateUrgencyScore(report.ai_priority);
  document.getElementById('ai-val-action').textContent = generateAIRecommendation(report.category, report.ai_priority);

  // Status & Admin Notes Form
  const statusSelect = document.getElementById('update-status-select');
  if (statusSelect) {
    statusSelect.value = report.status || 'Reported';
  }

  const notesTextarea = document.getElementById('update-admin-notes');
  if (notesTextarea) {
    notesTextarea.value = report.admin_notes || '';
  }
}

// -----------------------------------------------------------------------------
// 12. Administrator Status & Notes Update (PATCH)
// -----------------------------------------------------------------------------
async function handleUpdateReportStatus(newStatusOverride = null) {
  if (state.isUpdatingStatus) return;
  const report = state.reports.find(r => r.id === state.selectedReportId);
  if (!report) return;

  const statusSelect = document.getElementById('update-status-select');
  const notesTextarea = document.getElementById('update-admin-notes');
  const saveBtn = document.getElementById('btn-save-status');
  const btnText = document.getElementById('btn-save-text');
  const btnSpinner = document.getElementById('btn-save-spinner');

  const newStatus = newStatusOverride || (statusSelect ? statusSelect.value : report.status);
  const newNotes = notesTextarea ? notesTextarea.value.trim() : (report.admin_notes || '');

  state.isUpdatingStatus = true;
  if (saveBtn) saveBtn.disabled = true;
  if (btnText) btnText.textContent = 'Saving Changes...';
  if (btnSpinner) btnSpinner.style.display = 'inline-block';

  try {
    const payload = {
      status: newStatus,
      admin_notes: newNotes || null
    };

    const response = await fetch(`${CONFIG.API_BASE}/api/reports/${report.id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const updatedReport = await response.json();

    // Update local state
    const index = state.reports.findIndex(r => r.id === report.id);
    if (index !== -1) {
      state.reports[index] = updatedReport;
    }

    // Refresh UI
    updateKPIStatistics();
    applyFilters();
    renderSelectedReportDetails();
    updateMarkerHighlight(report.id);

    showToast(
      'success',
      'Status Updated Successfully',
      `Report #${report.id} status changed to "${newStatus}".`,
      4000
    );

  } catch (err) {
    console.error('Error updating report status:', err);
    showToast(
      'error',
      'Update Failed',
      'Could not update issue status. Please check backend connection.',
      5000
    );
  } finally {
    state.isUpdatingStatus = false;
    if (saveBtn) saveBtn.disabled = false;
    if (btnText) btnText.textContent = 'Save Changes & Dispatch';
    if (btnSpinner) btnSpinner.style.display = 'none';
  }
}

// -----------------------------------------------------------------------------
// 13. Lightbox Photo Modal
// -----------------------------------------------------------------------------
function openPhotoModal(imageUrl, title) {
  const modal = document.getElementById('photo-modal');
  const modalImg = document.getElementById('modal-img');
  const modalCaption = document.getElementById('modal-caption');
  if (!modal || !modalImg) return;

  modalImg.src = imageUrl;
  if (modalCaption) modalCaption.textContent = title || 'Issue Photo Attachment';
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closePhotoModal() {
  const modal = document.getElementById('photo-modal');
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

// -----------------------------------------------------------------------------
// 14. Event Listeners & UI Wire-up
// -----------------------------------------------------------------------------
function setupEventListeners() {
  // Search Input
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('btn-clear-search');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.style.display = e.target.value ? 'block' : 'none';
      }
      applyFilters();
    });
  }

  if (clearSearchBtn && searchInput) {
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.filters.search = '';
      clearSearchBtn.style.display = 'none';
      applyFilters();
      searchInput.focus();
    });
  }

  // Filter Dropdowns
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      applyFilters();
    });
  }

  const priorityFilter = document.getElementById('filter-priority');
  if (priorityFilter) {
    priorityFilter.addEventListener('change', (e) => {
      state.filters.priority = e.target.value;
      applyFilters();
    });
  }

  const categoryFilter = document.getElementById('filter-category');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      applyFilters();
    });
  }

  // Reset Filters Buttons
  const resetFiltersBtn = document.getElementById('btn-reset-filters');
  const emptyResetBtn = document.getElementById('btn-empty-reset');

  const resetAllFilters = () => {
    state.filters = { search: '', status: 'ALL', priority: 'ALL', category: 'ALL' };
    if (searchInput) searchInput.value = '';
    if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    if (statusFilter) statusFilter.value = 'ALL';
    if (priorityFilter) priorityFilter.value = 'ALL';
    if (categoryFilter) categoryFilter.value = 'ALL';

    document.querySelectorAll('.kpi-card').forEach(card => card.classList.remove('active-filter'));
    applyFilters();
    showToast('info', 'Filters Reset', 'Showing all civic issues.', 2500);
  };

  if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetAllFilters);
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);

  // KPI Metric Cards Filter Triggers
  document.querySelectorAll('.kpi-card').forEach(card => {
    card.addEventListener('click', () => {
      const filterType = card.dataset.filterType;
      const filterValue = card.dataset.filterValue;

      document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active-filter'));
      card.classList.add('active-filter');

      if (filterType === 'all') {
        resetAllFilters();
      } else if (filterType === 'priority' && priorityFilter) {
        state.filters.priority = filterValue;
        priorityFilter.value = filterValue;
        applyFilters();
      } else if (filterType === 'status' && statusFilter) {
        state.filters.status = filterValue;
        statusFilter.value = filterValue;
        applyFilters();
      }
    });
  });

  // Refresh Button
  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('.fa-arrows-rotate');
      if (icon) icon.classList.add('fa-spin');
      fetchReports(false).finally(() => {
        setTimeout(() => {
          if (icon) icon.classList.remove('fa-spin');
        }, 500);
      });
      showToast('info', 'Refreshing Feed', 'Syncing live civic intelligence...', 2000);
    });
  }

  // Sound Toggle
  const soundToggleBtn = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  if (soundToggleBtn && soundIcon) {
    soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      if (state.soundEnabled) {
        soundIcon.className = 'fa-solid fa-volume-high';
        soundToggleBtn.title = 'Alert sounds enabled';
        playAlertChime();
        showToast('info', 'Sound Enabled', 'Audible alerts for new incoming reports are ON.', 2500);
      } else {
        soundIcon.className = 'fa-solid fa-volume-xmark';
        soundToggleBtn.title = 'Alert sounds muted';
        showToast('info', 'Sound Muted', 'Audible alerts are now muted.', 2500);
      }
    });
  }

  // Retry on error button
  const retryBtn = document.getElementById('btn-error-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      state.isInitialLoad = true;
      fetchReports(false);
    });
  }

  // Location link pan in details
  const locLink = document.getElementById('inspect-loc-link');
  if (locLink) {
    locLink.addEventListener('click', () => {
      const report = state.reports.find(r => r.id === state.selectedReportId);
      if (report && state.map && typeof report.latitude === 'number' && typeof report.longitude === 'number') {
        state.map.flyTo([report.latitude, report.longitude], 16, { duration: 0.8 });
        const marker = state.markers.get(report.id);
        if (marker) marker.openPopup();
      }
    });
  }

  // Map Fit View & Center Buttons
  const fitMapBtn = document.getElementById('btn-fit-map');
  if (fitMapBtn) {
    fitMapBtn.addEventListener('click', () => {
      if (!state.map) return;
      const validReports = state.filteredReports.filter(r => typeof r.latitude === 'number' && typeof r.longitude === 'number');
      if (validReports.length > 0) {
        const bounds = L.latLngBounds(validReports.map(r => [r.latitude, r.longitude]));
        state.map.fitBounds(bounds.pad(0.15));
      } else {
        state.map.setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);
      }
    });
  }

  const resetMapBtn = document.getElementById('btn-reset-map');
  if (resetMapBtn) {
    resetMapBtn.addEventListener('click', () => {
      if (state.map) {
        state.map.setView(CONFIG.DEFAULT_MAP_CENTER, CONFIG.DEFAULT_MAP_ZOOM);
      }
    });
  }

  // Status Action Station Buttons
  const saveStatusBtn = document.getElementById('btn-save-status');
  if (saveStatusBtn) {
    saveStatusBtn.addEventListener('click', () => handleUpdateReportStatus());
  }

  const quickInReviewBtn = document.getElementById('btn-quick-in-review');
  if (quickInReviewBtn) {
    quickInReviewBtn.addEventListener('click', () => {
      const statusSelect = document.getElementById('update-status-select');
      if (statusSelect) statusSelect.value = 'In Review';
      handleUpdateReportStatus('In Review');
    });
  }

  const quickResolveBtn = document.getElementById('btn-quick-resolve');
  if (quickResolveBtn) {
    quickResolveBtn.addEventListener('click', () => {
      const statusSelect = document.getElementById('update-status-select');
      if (statusSelect) statusSelect.value = 'Resolved';
      handleUpdateReportStatus('Resolved');
    });
  }

  // Lightbox Modal events
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalBackdrop = document.getElementById('modal-backdrop');

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closePhotoModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closePhotoModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePhotoModal();
  });
}

// -----------------------------------------------------------------------------
// 15. Initialization Lifecycle
// -----------------------------------------------------------------------------
function initApp() {
  initializeMap();
  setupEventListeners();

  // Initial data load
  fetchReports(false);

  // Background polling for real-time updates
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    fetchReports(true);
  }, CONFIG.POLL_INTERVAL_MS);
}

// Expose public methods for inline handlers
window.civicAdmin = {
  selectReport,
  handleUpdateReportStatus
};

// Bootstrap application on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
