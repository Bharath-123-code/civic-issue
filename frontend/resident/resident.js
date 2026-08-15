// frontend/resident/resident.js
/**
 * CIVICFIX — RESIDENT CLIENT APPLICATION
 * Safe, scoped architecture for the Citizen / Resident flow.
 */

const CivicFixResident = (() => {
  'use strict';

  // --- Application State ---
  const state = {
    selectedFile: null,
    imageDataUrl: '',
    latitude: null,
    longitude: null,
    category: '',
    title: '',
    description: '',
    isSubmitting: false,
    map: null,
    marker: null,
    hasCustomLocation: false
  };

  // --- Neutral Fallback Coordinates (Default Map Center) ---
  const DEFAULT_LAT = 14.681888;
  const DEFAULT_LNG = 77.600591;
  const DEFAULT_ZOOM = 13;

  // --- DOM Elements Cache ---
  const DOM = {
    form: null,
    dropzone: null,
    imageInput: null,
    dropzonePrompt: null,
    previewContainer: null,
    previewImg: null,
    previewFilename: null,
    previewFilesize: null,
    changeImageBtn: null,
    removeImageBtn: null,
    browseBtn: null,
    categoryInput: null,
    categoryCards: null,
    titleInput: null,
    descInput: null,
    charCounter: null,
    charCount: null,
    charProgress: null,
    submitBtn: null,
    submitBtnText: null,
    submitSpinner: null,
    leafletMap: null,
    locateMeBtn: null,
    locationBar: null,
    locStatusText: null,
    latDisplay: null,
    lngDisplay: null,
    successModal: null,
    modalReportId: null,
    modalCategory: null,
    modalCoords: null,
    modalPriorityBadge: null,
    modalAiDesc: null,
    reportAnotherBtn: null,
    toastContainer: null,
    stepIndicators: [],
    confettiWrap: null,
    snapCard: null,
    describeCard: null,
    mapCard: null,
    desktopMapColumn: null,
    mobileMapSlot: null
  };

  // =========================================================================
  // 1. Toast Notification Manager
  // =========================================================================
  function showToast(message, type = 'info', duration = 3800) {
    if (!DOM.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon selection
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'warning') icon = '⚠';

    toast.innerHTML = `
      <span class="toast-icon" style="font-weight: 800;">${icon}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
    `;

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 250);
    }, duration);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // =========================================================================
  // 2. Leaflet Map & Geolocation Initialization
  // =========================================================================
  function initMap() {
    if (!window.L) {
      console.error('Leaflet is not loaded.');
      return;
    }

    // Initialize Map
    state.map = L.map('cfLeafletMap', {
      zoomControl: true,
      attributionControl: true
    }).setView([DEFAULT_LAT, DEFAULT_LNG], DEFAULT_ZOOM);

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(state.map);

    // Define Custom CivicFix Marker Icon
    const customIcon = L.divIcon({
      className: 'cf-custom-marker',
      html: `
        <div class="cf-marker-pulse"></div>
        <div class="cf-marker-pin"></div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 38],
      popupAnchor: [0, -38]
    });

    // Map Click Handler: Set / Move Marker
    state.map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setLocation(lat, lng, true);
    });

    // Attempt Initial Browser Geolocation gracefully
    tryBrowserGeolocation(false);

    // Reposition map between desktop & mobile layouts if needed
    handleResponsiveMapPlacement();
    window.addEventListener('resize', () => {
      handleResponsiveMapPlacement();
      if (state.map) {
        state.map.invalidateSize();
      }
    });
  }

  function handleResponsiveMapPlacement() {
    if (!DOM.mapCard || !DOM.desktopMapColumn || !DOM.mobileMapSlot) return;

    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      if (!DOM.mobileMapSlot.contains(DOM.mapCard)) {
        DOM.mobileMapSlot.appendChild(DOM.mapCard);
        setTimeout(() => state.map && state.map.invalidateSize(), 150);
      }
    } else {
      if (!DOM.desktopMapColumn.contains(DOM.mapCard)) {
        DOM.desktopMapColumn.appendChild(DOM.mapCard);
        setTimeout(() => state.map && state.map.invalidateSize(), 150);
      }
    }
  }

  function setLocation(lat, lng, isManual = true) {
    state.latitude = lat;
    state.longitude = lng;
    state.hasCustomLocation = true;

    const customIcon = L.divIcon({
      className: 'cf-custom-marker',
      html: `
        <div class="cf-marker-pulse"></div>
        <div class="cf-marker-pin"></div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 38]
    });

    if (state.marker) {
      state.marker.setLatLng([lat, lng]);
    } else {
      state.marker = L.marker([lat, lng], {
        icon: customIcon,
        draggable: true
      }).addTo(state.map);

      // Listen for marker dragend
      state.marker.on('dragend', (event) => {
        const position = event.target.getLatLng();
        setLocation(position.lat, position.lng, true);
      });
    }

    // Update Coordinate Badges
    DOM.latDisplay.textContent = lat.toFixed(6);
    DOM.lngDisplay.textContent = lng.toFixed(6);
    DOM.locStatusText.textContent = '✓ Location selected';
    DOM.locationBar.classList.add('active');

    updateStepper();

    if (isManual) {
      showToast(`Location set (${lat.toFixed(4)}, ${lng.toFixed(4)})`, 'info', 2200);
    }
  }

  function tryBrowserGeolocation(isExplicitUserClick = false) {
    if (!navigator.geolocation) {
      if (isExplicitUserClick) {
        showToast('Geolocation is not supported by your browser.', 'warning');
      }
      return;
    }

    if (isExplicitUserClick && DOM.locateMeBtn) {
      DOM.locateMeBtn.classList.add('locating');
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (state.map) {
          state.map.flyTo([latitude, longitude], 16, {
            animate: true,
            duration: 1.2
          });
        }
        setLocation(latitude, longitude, false);
        showToast('✓ Location detected', 'success');

        if (DOM.locateMeBtn) {
          DOM.locateMeBtn.classList.remove('locating');
        }
      },
      (error) => {
        if (DOM.locateMeBtn) {
          DOM.locateMeBtn.classList.remove('locating');
        }
        if (isExplicitUserClick) {
          showToast("We couldn't access your location. Tap the map to choose it manually.", 'warning', 4500);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  // =========================================================================
  // 3. Image Upload & Drag & Drop Handling
  // =========================================================================
  function initImageUpload() {
    const dropzone = DOM.dropzone;
    const fileInput = DOM.imageInput;

    // Trigger browse on click/keypress
    dropzone.addEventListener('click', (e) => {
      // Don't trigger if clicked on preview action buttons
      if (e.target.closest('.civic-resident-preview-actions')) return;
      fileInput.click();
    });

    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // File Input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileSelected(file);
    });

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      if (file) handleFileSelected(file);
    });

    // Change / Remove actions
    DOM.changeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    DOM.removeImageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resetImageUpload();
    });
  }

  function handleFileSelected(file) {
    // Validate File Type
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file (JPEG, PNG, WebP).', 'warning');
      return;
    }

    // Validate File Size (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast('Please choose an image under 5 MB.', 'warning', 4500);
      return;
    }

    state.selectedFile = file;

    // Read Image for preview & submission Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      state.imageDataUrl = e.target.result;
      
      // Update UI Preview
      DOM.previewImg.src = state.imageDataUrl;
      DOM.previewFilename.textContent = file.name;
      DOM.previewFilesize.textContent = formatBytes(file.size);

      DOM.dropzonePrompt.style.display = 'none';
      DOM.previewContainer.style.display = 'flex';

      showToast('✓ Image selected', 'success', 2000);
      updateStepper();
    };
    reader.readAsDataURL(file);
  }

  function resetImageUpload() {
    state.selectedFile = null;
    state.imageDataUrl = '';
    DOM.imageInput.value = '';
    DOM.previewImg.src = '';
    DOM.previewContainer.style.display = 'none';
    DOM.dropzonePrompt.style.display = 'flex';
    updateStepper();
  }

  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // =========================================================================
  // 4. Category Selector & Description Logic
  // =========================================================================
  function initCategoriesAndInputs() {
    // Category Cards
    DOM.categoryCards.forEach(card => {
      card.addEventListener('click', () => {
        const cat = card.getAttribute('data-category');
        selectCategory(cat);
      });
    });

    // Character Counter & Progress Bar
    DOM.descInput.addEventListener('input', () => {
      const len = DOM.descInput.value.length;
      state.description = DOM.descInput.value;
      DOM.charCount.textContent = len;

      const progressPercent = Math.min((len / 500) * 100, 100);
      DOM.charProgress.style.width = `${progressPercent}%`;

      // Color thresholds
      if (len > 450) {
        DOM.charCounter.className = 'civic-resident-char-counter danger';
        DOM.charProgress.className = 'civic-resident-progress-fill danger';
      } else if (len > 350) {
        DOM.charCounter.className = 'civic-resident-char-counter warning';
        DOM.charProgress.className = 'civic-resident-progress-fill warning';
      } else {
        DOM.charCounter.className = 'civic-resident-char-counter';
        DOM.charProgress.className = 'civic-resident-progress-fill';
      }

      updateStepper();
    });

    // Title input
    DOM.titleInput.addEventListener('input', () => {
      state.title = DOM.titleInput.value;
      updateStepper();
    });

    // Locate Me click
    DOM.locateMeBtn.addEventListener('click', () => {
      tryBrowserGeolocation(true);
    });
  }

  function selectCategory(cat) {
    state.category = cat;
    DOM.categoryInput.value = cat;

    DOM.categoryCards.forEach(card => {
      const cardCat = card.getAttribute('data-category');
      const isSelected = cardCat === cat;
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    // Auto-suggest title if empty
    if (!DOM.titleInput.value.trim()) {
      DOM.titleInput.value = `${cat} issue reported`;
      state.title = DOM.titleInput.value;
    }

    updateStepper();
  }

  // =========================================================================
  // 5. Journey Stepper Progress Tracker
  // =========================================================================
  function updateStepper() {
    const s1 = Boolean(state.selectedFile || state.imageDataUrl);
    const s2 = Boolean(state.latitude && state.longitude && state.hasCustomLocation);
    const s3 = Boolean(state.category && state.description.trim().length > 0);
    const s4 = s1 && s2 && s3;

    setStepStatus(1, s1);
    setStepStatus(2, s2);
    setStepStatus(3, s3);
    setStepStatus(4, s4);
  }

  function setStepStatus(stepNum, isCompleted) {
    const el = DOM.stepIndicators[stepNum - 1];
    if (!el) return;

    if (isCompleted) {
      el.classList.add('completed');
      el.classList.remove('active');
    } else {
      el.classList.remove('completed');
      // Highlight current working step
      const isCurrent = (stepNum === 1 && !state.selectedFile) ||
                        (stepNum === 2 && state.selectedFile && !state.hasCustomLocation) ||
                        (stepNum === 3 && state.hasCustomLocation && (!state.category || !state.description.trim()));
      el.classList.toggle('active', isCurrent);
    }
  }

  // =========================================================================
  // 6. Form Validation & Submission
  // =========================================================================
  function initFormSubmission() {
    DOM.form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (state.isSubmitting) return;

      // Smart Validation
      if (!state.selectedFile && !state.imageDataUrl) {
        shakeElement(DOM.snapCard);
        showToast('Please add a photo of the issue.', 'warning');
        DOM.snapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!state.latitude || !state.longitude || !state.hasCustomLocation) {
        shakeElement(DOM.mapCard);
        showToast('Choose the issue location on the map.', 'warning');
        DOM.mapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!state.category) {
        shakeElement(DOM.describeCard);
        showToast('Please select an issue category.', 'warning');
        DOM.describeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!state.description.trim()) {
        shakeElement(DOM.describeCard);
        DOM.descInput.focus();
        showToast('Please describe what happened.', 'warning');
        return;
      }

      // Ensure valid title for backend contract
      let finalTitle = DOM.titleInput.value.trim();
      if (!finalTitle) {
        finalTitle = `${state.category} at ${state.latitude.toFixed(4)}, ${state.longitude.toFixed(4)}`;
      }

      await submitReport({
        title: finalTitle,
        description: state.description.trim(),
        category: state.category,
        latitude: parseFloat(state.latitude.toFixed(6)),
        longitude: parseFloat(state.longitude.toFixed(6)),
        image_url: state.imageDataUrl || null
      });
    });

    // Success Modal Close / Report Another
    DOM.reportAnotherBtn.addEventListener('click', () => {
      closeSuccessModal();
      resetForm();
    });
  }

  function shakeElement(el) {
    if (!el) return;
    el.classList.remove('civic-resident-shake');
    void el.offsetWidth; // Trigger reflow
    el.classList.add('civic-resident-shake');
    setTimeout(() => el.classList.remove('civic-resident-shake'), 600);
  }

  async function submitReport(payload) {
    setSubmitting(true);

    // Determine Backend URL dynamically
    const apiUrl = determineApiEndpoint();

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errDetail = 'Unable to submit report.';
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errDetail = Array.isArray(errData.detail)
              ? errData.detail.map(d => d.msg || d).join(', ')
              : errData.detail;
          }
        } catch (_) {}
        throw new Error(errDetail);
      }

      const responseData = await response.json();
      handleSubmissionSuccess(responseData, payload);
    } catch (err) {
      console.error('Submission error:', err);
      showToast(err.message || 'Something went wrong. Your report wasn’t submitted. Please try again.', 'error', 5500);
    } finally {
      setSubmitting(false);
    }
  }

  function determineApiEndpoint() {
    // If frontend is served from FastAPI on port 8000
    if (window.location.port === '8000' || window.location.port === '80' || (window.location.protocol === 'http:' && !window.location.port)) {
      return '/api/reports/';
    }
    // Fallback if accessed via Live Server (e.g. 5500, 3000) or file://
    return 'http://127.0.0.1:8000/api/reports/';
  }

  function setSubmitting(isSubmitting) {
    state.isSubmitting = isSubmitting;
    DOM.submitBtn.disabled = isSubmitting;
    if (isSubmitting) {
      DOM.submitBtnText.textContent = '◌ Sending to CivicFix...';
      DOM.submitSpinner.style.display = 'inline-block';
    } else {
      DOM.submitBtnText.textContent = 'REPORT ISSUE';
      DOM.submitSpinner.style.display = 'none';
    }
  }

  function handleSubmissionSuccess(data, payload) {
    const reportId = data.id ? `#CF-${data.id}` : '#CF-NEW';
    const priority = data.ai_priority || 'Medium';

    DOM.modalReportId.textContent = reportId;
    DOM.modalCategory.textContent = data.category || payload.category;
    DOM.modalCoords.textContent = `${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}`;

    // AI Feedback
    DOM.modalPriorityBadge.textContent = `Priority: ${priority}`;
    if (priority === 'High') {
      DOM.modalPriorityBadge.className = 'badge-neon badge-neon-rose';
      DOM.modalAiDesc.textContent = 'High priority civic issue detected. Dispatched for expedited resolution.';
    } else if (priority === 'Low') {
      DOM.modalPriorityBadge.className = 'badge-neon';
      DOM.modalAiDesc.textContent = 'Standard routine maintenance issue scheduled with local operations.';
    } else {
      DOM.modalPriorityBadge.className = 'badge-neon badge-neon-amber';
      DOM.modalAiDesc.textContent = 'Analyzing your report and routing it to the appropriate civic dispatch team...';
    }

    // Trigger celebration confetti
    spawnConfetti();

    // Show modal
    DOM.successModal.classList.add('active');
  }

  function spawnConfetti() {
    if (!DOM.confettiWrap) return;
    DOM.confettiWrap.innerHTML = '';
    const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
    
    for (let i = 0; i < 30; i++) {
      const piece = document.createElement('div');
      piece.className = 'civic-resident-confetti-piece';
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      DOM.confettiWrap.appendChild(piece);
    }
  }

  function closeSuccessModal() {
    DOM.successModal.classList.remove('active');
    if (DOM.confettiWrap) {
      DOM.confettiWrap.innerHTML = '';
    }
  }

  function resetForm() {
    DOM.form.reset();
    resetImageUpload();
    state.category = '';
    state.title = '';
    state.description = '';
    DOM.categoryInput.value = '';
    DOM.categoryCards.forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-checked', 'false');
    });
    DOM.charCount.textContent = '0';
    DOM.charProgress.style.width = '0%';
    DOM.charCounter.className = 'civic-resident-char-counter';

    updateStepper();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Ready for your next report ✨', 'info');
  }

  // =========================================================================
  // 7. Initialization
  // =========================================================================
  function init() {
    // Cache DOM references
    DOM.form = document.getElementById('civicResidentForm');
    DOM.dropzone = document.getElementById('cfDropzone');
    DOM.imageInput = document.getElementById('cfImageInput');
    DOM.dropzonePrompt = document.getElementById('cfDropzonePrompt');
    DOM.previewContainer = document.getElementById('cfPreviewContainer');
    DOM.previewImg = document.getElementById('cfPreviewImg');
    DOM.previewFilename = document.getElementById('cfPreviewFilename');
    DOM.previewFilesize = document.getElementById('cfPreviewFilesize');
    DOM.changeImageBtn = document.getElementById('cfChangeImageBtn');
    DOM.removeImageBtn = document.getElementById('cfRemoveImageBtn');
    DOM.browseBtn = document.getElementById('cfBrowseBtn');
    DOM.categoryInput = document.getElementById('cfCategoryInput');
    DOM.categoryCards = document.querySelectorAll('.civic-resident-category-card');
    DOM.titleInput = document.getElementById('cfTitleInput');
    DOM.descInput = document.getElementById('cfDescInput');
    DOM.charCounter = document.getElementById('cfCharCounter');
    DOM.charCount = document.getElementById('cfCharCount');
    DOM.charProgress = document.getElementById('cfCharProgress');
    DOM.submitBtn = document.getElementById('cfSubmitBtn');
    DOM.submitBtnText = document.getElementById('cfSubmitBtnText');
    DOM.submitSpinner = document.getElementById('cfSubmitSpinner');
    DOM.leafletMap = document.getElementById('cfLeafletMap');
    DOM.locateMeBtn = document.getElementById('cfLocateMeBtn');
    DOM.locationBar = document.querySelector('.civic-resident-location-bar');
    DOM.locStatusText = document.getElementById('cfLocStatusText');
    DOM.latDisplay = document.getElementById('cfLatDisplay');
    DOM.lngDisplay = document.getElementById('cfLngDisplay');
    DOM.successModal = document.getElementById('cfSuccessModal');
    DOM.modalReportId = document.getElementById('cfModalReportId');
    DOM.modalCategory = document.getElementById('cfModalCategory');
    DOM.modalCoords = document.getElementById('cfModalCoords');
    DOM.modalPriorityBadge = document.getElementById('cfModalPriorityBadge');
    DOM.modalAiDesc = document.getElementById('cfModalAiDesc');
    DOM.reportAnotherBtn = document.getElementById('cfReportAnotherBtn');
    DOM.toastContainer = document.getElementById('cfToastContainer');
    DOM.confettiWrap = document.getElementById('cfConfettiWrap');
    DOM.snapCard = document.getElementById('cfSnapSection');
    DOM.describeCard = document.getElementById('cfDescribeSection');
    DOM.mapCard = document.getElementById('cfMapCard');
    DOM.desktopMapColumn = document.getElementById('cfDesktopMapColumn');
    DOM.mobileMapSlot = document.getElementById('cfMobileMapSlot');

    DOM.stepIndicators = [
      document.getElementById('cfStepIndicator1'),
      document.getElementById('cfStepIndicator2'),
      document.getElementById('cfStepIndicator3'),
      document.getElementById('cfStepIndicator4')
    ];

    // Initialize Components
    initImageUpload();
    initCategoriesAndInputs();
    initMap();
    initFormSubmission();
    updateStepper();
  }

  // Public API / Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init,
    showToast,
    setLocation,
    getState: () => ({ ...state })
  };
})();
