const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbysauQgAlIVSxE4xXSbFgyTTlsfln2szdRqrqbszkHJNKZsQxl_Ua1eQy-e9JJXqK70FQ/exec';
const TRACKER_SYNC_URL = 'https://script.google.com/macros/s/AKfycbysauQgAlIVSxE4xXSbFgyTTlsfln2szdRqrqbszkHJNKZsQxl_Ua1eQy-e9JJXqK70FQ/exec';

// Helper to convert File object to Base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

document.addEventListener('DOMContentLoaded', () => {
    // Check for first visit and set default layout
    checkFirstVisit();
    initGlobalPersistence();

    initDraggableElements();
    initCarousel();
    initBackgroundSlider();
    initPopups();
    initMobileMenu();
    initMinimize();
    initCopyButtons();
    initShareButtons();
    initCollaborationUnlock();
    initProjectTracker(); // Initialize project status tracker
    initLogoLock(); // Initialize logo lock logic
    init360Popup(); // Initialize 360 view popup
    window.initPlyr(); // Initialize all video players
    initPandaShowcase(); // Start the panda illustration storyline sequence
    initBriefAdmin(); // Initialize Admin Briefs access logic

    // Check for form success flag in URL
    checkFormSuccess();

    // Deep-link: auto-open popup from ?popup= URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const popupParam = urlParams.get('popup');
    if (popupParam) {
        setTimeout(() => {
            if (typeof openPopup === 'function') openPopup(popupParam);
        }, 600); // Small delay to let page fully render first
    }

    // CRITICAL: Signal to loader that all UI components and tab positions are settled
    // This allows the website to reveal itself immediately without waiting for heavy external assets
    if (window.triggerManualLoadComplete) {
        window.triggerManualLoadComplete();
    }
});

function initShareButtons() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.share-btn');
        if (!btn || btn.classList.contains('was-dragged')) return;

        e.stopPropagation();
        const section = btn.closest('.sticky-note, .profile-card, #note-sketch-image');
        const isSketchShare = btn.classList.contains('sketch-share');
        const title = isSketchShare ? "AMAN | Your Trusted e-Design Partner" : (section ? (section.dataset.title || "Aman's Portfolio") : "Aman's Portfolio");
        const url = "https://amandesignpartner.netlify.app/";

        if (navigator.share) {
            navigator.share({
                title: title,
                text: isSketchShare ? "Check out AMAN | Your Trusted e-Design Partner" : `Check out ${title} on Aman's 3D Portfolio!`,
                url: url
            }).catch(err => {
                console.log('Error sharing:', err);
                // Fallback if sharing is cancelled or fails
                copyToClipboard(url);
            });
        } else {
            // Fallback: Copy link to clipboard
            copyToClipboard(url);
        }
    });

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Website link copied to clipboard!');
        });
    }
}

// ===== Utility: Toast Notifications =====
function showToast(message) {
    let toast = document.querySelector('.toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }

    toast.innerHTML = `
        <span class="toast-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </span>
        <span class="toast-message">${message}</span>
    `;

    // Trigger reflow
    toast.offsetHeight;
    toast.classList.add('active');

    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

function checkFirstVisit() {
    // ALWAYS reset to default layout on page load/refresh
    // This ensures the same tabs are shown in the same positions every time
    console.log('Setting default layout.');

    // Clear saved positions to use HTML defaults
    // Only keep positions for elements that should maintain their user-defined positions
    const positions = JSON.parse(localStorage.getItem('stickyPositions') || '{}');
    const defaultElements = ['note-sketch-image', 'note-intro', 'profile-card', 'note-projects'];

    // Remove default elements from saved positions so they use HTML defaults
    defaultElements.forEach(id => {
        delete positions[id];
    });
    localStorage.setItem('stickyPositions', JSON.stringify(positions));

    const defaultMinimized = [
        'note-contact',
        'note-collaborate',
        'note-feedback',
        'note-pricing'
    ];

    localStorage.setItem('minimizedElements', JSON.stringify(defaultMinimized));

    // Mark as visited (keep this for any other first-visit logic you might have)
    if (!localStorage.getItem('hasVisited')) {
        localStorage.setItem('hasVisited', 'true');
    }
}

// ===== Draggable Elements =====
function initDraggableElements() {
    const draggables = document.querySelectorAll('.draggable');
    let activeElement = null;
    let offsetX = 0, offsetY = 0, isDragging = false;
    let startMouseX = 0, startMouseY = 0;
    let hasDragged = false;
    const dragThreshold = 5;

    draggables.forEach(el => {
        el.addEventListener('mousedown', startDrag);
        el.addEventListener('touchstart', startDrag, { passive: false });
    });

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);

    function startDrag(e) {
        // Handle logo locking logic
        if (this.id === 'logo' && (window.logoLocked === undefined || window.logoLocked)) {
            return;
        }

        // Handle panda locking logic
        if (this.id === 'panda-showcase-container' && (window.pandaLocked === undefined || window.pandaLocked)) {
            return;
        }

        // Only allow left-click drag (button 0)
        if (e.type === 'mousedown' && e.button !== 0) return;

        // Mobile performance and UX: Disable drag for most content on mobile to allow scrolling and clean clicks
        if (window.innerWidth <= 768) {
            // Only allow dragging via the specific drag-handle on mobile to prevent accidental shaking/jumps
            if (!e.target.closest('.drag-handle') && !e.target.closest('#sketch-mobile-handle')) {
                return;
            }
        }

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startMouseX = clientX;
        startMouseY = clientY;
        hasDragged = false;

        // If clicking a draggable child, stop propagation to parent draggable
        // This ensures moving a button doesn't drag the whole sketch note
        if (e.target.closest('.draggable') && e.target.closest('.draggable') !== this) {
            return;
        }

        // Don't drag if clicking buttons, links, or inputs (except drag-handle, sketch-share, or chat-btn-inline)
        // Removed .sticky-btn-tab from handles to allow clean click events for popups
        const isDragHandle = e.target.closest('.drag-handle, #sketch-mobile-handle, .sketch-share, .chat-btn-inline');
        if (!isDragHandle) {
            if (e.target.closest('button') ||
                e.target.closest('a') ||
                e.target.closest('input') ||
                e.target.closest('textarea') ||
                e.target.closest('.sticky-btn-tab') ||
                e.target.tagName === 'BUTTON' ||
                e.target.tagName === 'A' ||
                e.target.tagName === 'INPUT' ||
                e.target.tagName === 'TEXTAREA') return;
        }

        e.preventDefault();
        activeElement = this;
        isDragging = true;

        const rect = activeElement.getBoundingClientRect();
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;
        bringToFrontLocal(activeElement);
        activeElement.classList.add('dragging');

        // Convert right/bottom positioning to left/top for proper dragging
        if (activeElement.style.right && !activeElement.style.left) {
            activeElement.style.left = rect.left + 'px';
            activeElement.style.right = 'auto';
        }
        if (activeElement.style.bottom && !activeElement.style.top) {
            activeElement.style.top = rect.top + 'px';
            activeElement.style.bottom = 'auto';
        }
        // Handle computed styles for elements with CSS positioning
        const computedStyle = getComputedStyle(activeElement);
        if (computedStyle.bottom !== 'auto' && computedStyle.top === 'auto') {
            activeElement.style.top = rect.top + 'px';
            activeElement.style.bottom = 'auto';
        }
        if (computedStyle.right !== 'auto' && computedStyle.left === 'auto') {
            activeElement.style.left = rect.left + 'px';
            activeElement.style.right = 'auto';
        }
    }

    function drag(e) {
        if (!isDragging || !activeElement) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = activeElement.getBoundingClientRect();

        let newX = clientX - offsetX;
        let newY = clientY - offsetY;

        // Dynamic hit-testing boundaries:
        let xMin, xMax, yMin, yMax;

        if (activeElement.id === 'note-sketch-image' || activeElement.id === 'logo' || activeElement.id === 'sketchy-tagline') {
            // Hard stop at edges (100% visible)
            xMin = 0;
            xMax = vw - rect.width;
            yMin = 0;
            yMax = vh - rect.height;
        } else if (activeElement.classList.contains('sticky-btn-tab') || activeElement.classList.contains('sketch-share')) {
            // Restrict to parent boundaries (Sketch Note interior)
            const parent = activeElement.offsetParent;
            if (parent) {
                const parentRect = parent.getBoundingClientRect();
                const parentX = parentRect.left;
                const parentY = parentRect.top;

                // Adjust newX/newY to be relative to the parent for nested draggables
                newX = clientX - parentX - offsetX;
                newY = clientY - parentY - offsetY;

                xMin = 0;
                xMax = parentRect.width - rect.width;
                yMin = 0;
                yMax = parentRect.height - rect.height;
            } else {
                xMin = 0; xMax = vw - rect.width;
                yMin = 0; yMax = vh - rect.height;
            }
        } else {
            // Keep at least 30% visible for smaller cards (flexible tucking)
            const xSafety = rect.width * 0.3;
            const ySafety = rect.height * 0.3;
            xMin = -(rect.width - xSafety);
            xMax = vw - xSafety;
            yMin = -(rect.height - ySafety);
            yMax = vh - ySafety;
        }

        newX = Math.max(xMin, Math.min(newX, xMax));
        newY = Math.max(yMin, Math.min(newY, yMax));

        if (Math.sqrt(Math.pow(clientX - startMouseX, 2) + Math.pow(clientY - startMouseY, 2)) > dragThreshold) {
            hasDragged = true;
        }

        activeElement.style.left = newX + 'px';
        activeElement.style.top = newY + 'px';
        activeElement.style.right = 'auto';
        activeElement.style.bottom = 'auto';
    }

    function stopDrag() {
        if (activeElement) {
            activeElement.classList.remove('dragging');
            if (hasDragged) {
                // Add a temporary class to prevent click event
                activeElement.classList.add('was-dragged');
                setTimeout(() => {
                    const el = document.querySelector('.was-dragged');
                    if (el) el.classList.remove('was-dragged');
                }, 100);
            }
            savePosition(activeElement);
        }
        isDragging = false;
        activeElement = null;
    }

    // Shared function to bring an element to the front
    window.bringToFront = function (el) {
        const draggables = document.querySelectorAll('.draggable');
        let maxZ = 10;
        draggables.forEach(d => {
            const z = parseInt(getComputedStyle(d).zIndex);
            if (!isNaN(z)) maxZ = Math.max(maxZ, z);
        });
        el.style.zIndex = maxZ + 1;
    };

    function bringToFrontLocal(el) {
        window.bringToFront(el);
    }

    function savePosition(el) {
        if (!el.id) return;
        const positions = JSON.parse(localStorage.getItem('stickyPositions') || '{}');
        positions[el.id] = { left: el.style.left, top: el.style.top, zIndex: el.style.zIndex };
        localStorage.setItem('stickyPositions', JSON.stringify(positions));
    }

    loadSavedPositions(draggables);
}

function initLogoLock() {
    const logo = document.getElementById('logo');
    if (!logo) return;

    // Default state: Always Locked on page load per user request
    window.logoLocked = true;
    localStorage.setItem('logoLocked', 'true');

    // Update cursor and visual state based on lock state
    logo.style.cursor = 'default';
    logo.style.filter = 'none';
    logo.style.boxShadow = 'none';

    let lastRightClick = 0;
    const doubleClickThreshold = 500; // ms

    logo.addEventListener('contextmenu', (e) => {
        const now = Date.now();
        if (now - lastRightClick < doubleClickThreshold) {
            e.preventDefault(); // Prevent context menu
            window.logoLocked = !window.logoLocked;

            // Save state
            localStorage.setItem('logoLocked', window.logoLocked);

            // Update UI
            logo.style.cursor = window.logoLocked ? 'default' : 'move';

            // Visual feedback
            if (window.logoLocked) {
                logo.style.filter = 'none';
                logo.style.boxShadow = 'none';
            } else {
                logo.style.boxShadow = '0 0 20px rgba(210, 105, 30, 0.4)';
            }

            // Log for debugging
            console.log(`Logo ${window.logoLocked ? 'Locked' : 'Unlocked'}`);
        } else {
            // Optional: prevent single right click menu if desired, 
            // but usually we just allow it on the first click.
            // However, to catch the double click reliably without the menu popping up,
            // it's better to prevent it always on the logo.
            e.preventDefault();
        }
        lastRightClick = now;
    });
}

function loadSavedPositions(elements) {
    const positions = JSON.parse(localStorage.getItem('stickyPositions') || '{}');
    elements.forEach(el => {
        // Skip logo position loading to ensure it stays at the default CSS location on refresh
        if (el.id === 'logo') return;

        if (el.id && positions[el.id]) {
            el.style.left = positions[el.id].left;
            el.style.top = positions[el.id].top;
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            if (positions[el.id].zIndex) el.style.zIndex = positions[el.id].zIndex;
        }
    });
}

// ===== 360 View Full-Screen Popup (Handled by 360-preload.js) =====
function init360Popup() {
    // Logic moved to 360-preload.js for absolute audio control
}



/**
 * Shared logic to format Project ID (e.g. VMC-26H125-W)
 */
function formatProjectID(val) {
    // 1. Clean input: Uppercase and allow only Alphanumeric
    let cleanVal = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let formatted = cleanVal;

    if (cleanVal.length > 0) {
        // Find first transition: Letter -> Number
        let firstDashIdx = -1;
        for (let i = 0; i < cleanVal.length - 1; i++) {
            if (/[A-Z]/.test(cleanVal[i]) && /[0-9]/.test(cleanVal[i + 1])) {
                firstDashIdx = i;
                break;
            }
        }

        // Find last transition: Number -> Letter
        let secondDashIdx = -1;
        for (let i = cleanVal.length - 1; i > 0; i--) {
            if (/[0-9]/.test(cleanVal[i - 1]) && /[A-Z]/.test(cleanVal[i])) {
                secondDashIdx = i - 1;
                break;
            }
        }

        // Apply formatting based on found transitions
        if (firstDashIdx !== -1 && secondDashIdx !== -1 && secondDashIdx > firstDashIdx) {
            formatted = cleanVal.slice(0, firstDashIdx + 1) + '-' +
                cleanVal.slice(firstDashIdx + 1, secondDashIdx + 1) + '-' +
                cleanVal.slice(secondDashIdx + 1);
        } else if (firstDashIdx !== -1) {
            formatted = cleanVal.slice(0, firstDashIdx + 1) + '-' + cleanVal.slice(firstDashIdx + 1);
        } else if (secondDashIdx !== -1) {
            formatted = cleanVal.slice(0, secondDashIdx + 1) + '-' + cleanVal.slice(secondDashIdx + 1);
        }
    }

    return formatted.slice(0, 20);
}

function initProjectTracker() {
    const mainTrackInput = document.getElementById('main-track-input');
    const mainTrackBtn = document.getElementById('btn-track-main');

    if (!mainTrackInput || !mainTrackBtn) return;

    // Real-time polling reference
    window.trackerPollInterval = null;

    // Handle tracking button click
    const handleTrack = async () => {
        const rawVal = mainTrackInput.value.trim();
        if (!rawVal) return;

        const cleanVal = rawVal.replace(/-/g, '');
        const inputContainer = mainTrackInput.parentElement;

        // Show loading state on button
        const originalBtnText = mainTrackBtn.textContent;
        mainTrackBtn.innerHTML = '<span class="anim-dot">.</span><span class="anim-dot dot-2">.</span><span class="anim-dot dot-3">.</span>';
        mainTrackBtn.style.pointerEvents = 'none';

        try {
            // Priority 1: Fetch from Live Google Sheet (V2 API)
            const response = await fetch(`${TRACKER_SYNC_URL}?action=getProject&id=${rawVal}`);
            const result = await response.json();

            if (result.status === "success") {
                window.originalTrackerKey = cleanVal;
                openPopup('track-status');
                inputContainer.classList.remove('error');

                setTimeout(() => {
                    populateTrackerPopup(result.project);
                }, 50);

                const errorMsg = document.getElementById('tracker-error-msg');
                if (errorMsg) errorMsg.remove();
            } else {
                // Priority 2: Fallback to local project-data.js (for legacy or offline)
                const project = window.projectData && window.projectData[cleanVal];
                if (project) {
                    window.originalTrackerKey = cleanVal;
                    openPopup('track-status');
                    inputContainer.classList.remove('error');
                    setTimeout(() => populateTrackerPopup(JSON.parse(JSON.stringify(project))), 50);
                    const errorMsg = document.getElementById('tracker-error-msg');
                    if (errorMsg) errorMsg.remove();
                } else {
                    throw new Error("Not Found");
                }
            }
        } catch (err) {
            inputContainer.classList.add('error');
            let errorMsg = document.getElementById('tracker-error-msg');
            if (!errorMsg) {
                errorMsg = document.createElement('div');
                errorMsg.id = 'tracker-error-msg';
                errorMsg.style.cssText = 'color: #ff4d4d; font-size: 11px; margin-top: 8px; font-weight: 500; transition: all 0.3s;';
                inputContainer.parentElement.appendChild(errorMsg);
            }
            errorMsg.textContent = '❌ Invalid Project ID. Please check with Aman.';
            errorMsg.style.opacity = '1';
        } finally {
            mainTrackBtn.textContent = originalBtnText;
            mainTrackBtn.style.pointerEvents = 'auto';
        }
    };

    mainTrackBtn.addEventListener('click', handleTrack);

    mainTrackInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleTrack();
    });

    // Auto-format input as user types & Validate
    mainTrackInput.addEventListener('input', () => {
        mainTrackInput.parentElement.classList.remove('error');
        const errorMsg = document.getElementById('tracker-error-msg');
        if (errorMsg) {
            errorMsg.style.opacity = '0';
            setTimeout(() => errorMsg.remove(), 300);
        }
        mainTrackInput.value = formatProjectID(mainTrackInput.value);

        // Real-time Validation
        const rawVal = mainTrackInput.value.trim();
        const cleanVal = rawVal.replace(/-/g, '');

        if (rawVal.length === 0) {
            mainTrackInput.classList.remove('valid', 'invalid');
        } else if (window.projectData && window.projectData[cleanVal]) {
            mainTrackInput.classList.add('valid');
            mainTrackInput.classList.remove('invalid');
        } else {
            mainTrackInput.classList.add('invalid');
            mainTrackInput.classList.remove('valid');
        }
    });
}

/**
 * Universal Sync Function (Frontend -> Google Sheet)
 * Debounced to prevent excessive API calls during typing
 */
let syncTimeout = null;
async function syncProjectToSheet(data) {
    if (!data || !data.id) return;

    // Clear existing timeout
    if (syncTimeout) clearTimeout(syncTimeout);

    syncTimeout = setTimeout(async () => {
        console.log("Syncing to Sheet:", data.id);
        try {
            await fetch(TRACKER_SYNC_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    project: data
                })
            });
            console.log("Sync Dispatched successfully");
        } catch (err) {
            console.error("Sync failed:", err);
        }
    }, 1000);
}

function startTrackerPolling(projectId) {
    if (window.trackerPollInterval) clearInterval(window.trackerPollInterval);

    window.trackerPollInterval = setInterval(async () => {
        const isPopupOpen = document.getElementById('popup-track-status');
        if (!isPopupOpen || !projectId) {
            stopTrackerPolling();
            return;
        }

        try {
            // Polling getAll updates the entire site's local cache
            const response = await fetch(`${TRACKER_SYNC_URL}?action=getAll`);
            const result = await response.json();

            if (result.status === "success" && result.data) {
                // 1. Update Global Cache
                const newDataMap = {};
                result.data.forEach(proj => {
                    const cleanKey = proj.id.toString().replace(/-/g, '').toUpperCase();
                    newDataMap[cleanKey] = proj;
                });
                window.projectData = newDataMap;

                // 2. Update Current Popup if applicable
                const currentData = window.lastTrackedProject;
                const incomingData = newDataMap[projectId.replace(/-/g, '').toUpperCase()];

                if (incomingData) {
                    const currentVersion = (currentData && currentData.version) ? currentData.version : 0;
                    const incomingVersion = incomingData.version || 0;

                    if (incomingVersion > currentVersion) {
                        console.log(`Global Poll: Live Update for ${projectId} (V${currentVersion} -> V${incomingVersion})`);
                        populateTrackerPopup(incomingData, true);
                    }
                }
            }
        } catch (err) {
            console.warn("Polling error:", err);
        }
    }, 5000);
}

function startCountdownTimer(startDateStr, deadlineStr) {
    if (window.trackerCountdownInterval) clearInterval(window.trackerCountdownInterval);

    const card = document.getElementById('premium-countdown');
    const daysEl = document.getElementById('timer-days');
    const hoursEl = document.getElementById('timer-hours');
    const minsEl = document.getElementById('timer-mins');
    const secsEl = document.getElementById('timer-secs');
    const progressEl = document.getElementById('timer-progress');
    const displayEl = document.getElementById('main-timer-display');

    if (!card || !hoursEl || !minsEl || !secsEl || !progressEl || !displayEl) return;

    const parseProjectDate = (str, isDeadline = false) => {
        if (!str || str === '...') return null;
        let d = new Date(str);
        if (isNaN(d.getTime())) {
            const parts = str.split('/');
            if (parts.length === 3) d = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
        }
        if (isNaN(d.getTime())) return null;

        // If it's a deadline string like "27 Feb 2026" without time, 
        // treat it as the END of that day (23:59:59)
        if (isDeadline && str.length < 15) {
            d.setHours(23, 59, 59, 999);
        }
        return d;
    };

    const start = parseProjectDate(startDateStr);
    const deadline = parseProjectDate(deadlineStr, true);

    if (!start || !deadline) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';

    const updateTimer = () => {
        const now = new Date();
        const totalWorkDuration = deadline - start;

        let remaining;
        let elapsed;

        card.classList.remove('countdown-card-amber', 'countdown-card-late');

        if (now > deadline) {
            // LATE State
            clearInterval(window.trackerCountdownInterval);
            card.classList.add('countdown-card-late');
            if (daysEl) daysEl.textContent = "00";
            hoursEl.textContent = "00";
            minsEl.textContent = "00";
            secsEl.textContent = "00";
            progressEl.style.width = '100%';
            return;
        } else if (now < start) {
            // Not started yet
            remaining = totalWorkDuration;
            elapsed = 0;
        } else {
            // In Progress
            remaining = deadline - now;
            elapsed = now - start;
        }

        // Segment Calculations
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remaining % (1000 * 60)) / 1000);

        if (daysEl) daysEl.textContent = days.toString().padStart(2, '0');
        hoursEl.textContent = hours.toString().padStart(2, '0');
        minsEl.textContent = mins.toString().padStart(2, '0');
        secsEl.textContent = secs.toString().padStart(2, '0');

        const progressPercent = Math.min(100, Math.max(0, (elapsed / totalWorkDuration) * 100));
        progressEl.style.width = progressPercent.toFixed(2) + '%';

        if (now >= start && days === 0 && hours < 24) {
            card.classList.add('countdown-card-amber');
        }
    };

    updateTimer();
    window.trackerCountdownInterval = setInterval(updateTimer, 1000);
}

function stopTrackerPolling() {
    if (window.trackerPollInterval) {
        clearInterval(window.trackerPollInterval);
        window.trackerPollInterval = null;
    }
    if (window.trackerCountdownInterval) {
        clearInterval(window.trackerCountdownInterval);
        window.trackerCountdownInterval = null;
    }
}

// Function to populate popup with data
function populateTrackerPopup(data, skipSync = false) {
    window.lastTrackedProject = data;
    const isEditMode = localStorage.getItem('tracker_edit_mode_active') === 'true';

    // Start polling for this project
    startTrackerPolling(data.id);

    // Timeline only runs when project is "In Progress"
    const countdownCard = document.getElementById('premium-countdown');
    if (data.status === 'progress') {
        startCountdownTimer(data.startDate, data.deadline);
        if (countdownCard) countdownCard.style.display = 'block';
    } else {
        if (countdownCard) countdownCard.style.display = 'none';
        if (window.trackerCountdownInterval) {
            clearInterval(window.trackerCountdownInterval);
            window.trackerCountdownInterval = null;
        }
    }

    // Status Title and Subtitle Data
    const statusTitles = {
        'awaiting': {
            title: 'Awaiting Payment',
            subtitle: 'Waiting for client payment to start work.',
            printColorTitle: '#3b82f6 !important',
            printColorSubtitle: '#60a5fa !important'
        },
        'progress': {
            title: 'In Progress',
            subtitle: 'Work has started and is ongoing.',
            printColorTitle: '#10b981 !important',
            printColorSubtitle: '#059669 !important'
        },
        'waiting': {
            title: 'Project Submitted',
            subtitle: 'Project submitted for client review',
            printColorTitle: '#f59e0b !important',
            printColorSubtitle: '#d97706 !important'
        },
        'completed': {
            title: 'Completed',
            subtitle: 'Project finished and delivered.',
            printColorTitle: '#10b981 !important',
            printColorSubtitle: '#059669 !important'
        }
    };

    // Update Display Area
    const statusInfo = statusTitles[data.status] || { title: 'Status Unknown', subtitle: 'Please check project details.' };
    const titleEl = document.getElementById('trk-status-title');
    const subtitleEl = document.getElementById('trk-status-subtitle');

    if (titleEl) {
        titleEl.textContent = statusInfo.title;
        if (statusInfo.printColorTitle) {
            titleEl.style.cssText += `; color: ${statusInfo.printColorTitle};`;
        }
    }
    if (subtitleEl) {
        subtitleEl.textContent = statusInfo.subtitle;
        if (statusInfo.printColorSubtitle) {
            subtitleEl.style.cssText += `; color: ${statusInfo.printColorSubtitle};`;
        }
    }

    // Handle Admin Dropdowns Visibility and Logic
    const statusSelect = document.getElementById('admin-status-select');
    const phaseSelect = document.getElementById('admin-phase-select');
    const milestoneSelect = document.getElementById('admin-milestone-select');

    if (isEditMode) {
        if (statusSelect) {
            statusSelect.style.display = 'block';
            statusSelect.value = data.status || "";
            statusSelect.onchange = (e) => {
                const newStatus = e.target.value;
                data.status = newStatus;

                // Update UI immediately
                const info = statusTitles[newStatus];
                if (titleEl) {
                    titleEl.textContent = info.title;
                    if (info.printColorTitle) titleEl.style.cssText += `; color: ${info.printColorTitle};`;
                }
                if (subtitleEl) {
                    subtitleEl.textContent = info.subtitle;
                    if (info.printColorSubtitle) subtitleEl.style.cssText += `; color: ${info.printColorSubtitle};`;
                }

                // Highlight pill
                const pillIDs = ['status-awaiting', 'status-progress', 'status-waiting', 'status-completed'];
                pillIDs.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.opacity = '1';
                });
                const activePill = document.getElementById('status-' + newStatus);
                if (activePill) activePill.style.opacity = '1';

                // Sync change
                if (!skipSync) syncProjectToSheet(data);
            };
        }
        if (phaseSelect) {
            phaseSelect.style.display = 'block';
            phaseSelect.onchange = (e) => {
                const trkPhase = document.getElementById('trk-phase');
                if (trkPhase) {
                    let textToInsert = e.target.value;

                    // Handle Shortcuts
                    if (textToInsert === 'shortcut-step-1') {
                        textToInsert = "1/4\n● Preparing Architectural 2D Concept Plan\n● Refining 2D Plan for 3D Modeling";
                    } else if (textToInsert === 'shortcut-step-2') {
                        textToInsert = "2/4\n● Preparing 3D Model\n● Working on Lighting & Furniture\n● Working on Texturing\n● Setting Up the Environment";
                    } else if (textToInsert === 'shortcut-step-3' || textToInsert === 'shortcut-step-4') {
                        textToInsert = "3/4\n● Finalizing the Rendering Setup\n● Rendering Images\n● Rendering Walkthrough Video\n● Working on Add-on\n● Finalizing Video for Review";
                    } else if (textToInsert === 'shortcut-step-final') {
                        textToInsert = "4/4\n● Project Completed\n● Project in Revision";
                    }

                    const currentText = trkPhase.textContent.trim();
                    const newText = currentText ? `${currentText}\n\n${textToInsert}` : textToInsert;
                    trkPhase.textContent = newText;
                    data.phase = newText;
                    e.target.selectedIndex = 0;

                    // Sync change
                    if (!skipSync) syncProjectToSheet(data);
                }
            };
        }
        if (milestoneSelect) {
            milestoneSelect.style.display = 'block';
            milestoneSelect.onchange = (e) => {
                const trkMilestone = document.getElementById('trk-milestone');
                if (trkMilestone) {
                    let textToInsert = e.target.value;

                    // Handle Shortcuts
                    if (textToInsert === 'shortcut-step-1') {
                        textToInsert = "1/4\n● Preparing Architectural 2D Concept Plan\n● Refining 2D Plan for 3D Modeling";
                    } else if (textToInsert === 'shortcut-step-2') {
                        textToInsert = "2/4\n● Preparing 3D Model\n● Working on Lighting & Furniture\n● Working on Texturing\n● Setting Up the Environment";
                    } else if (textToInsert === 'shortcut-step-3' || textToInsert === 'shortcut-step-4') {
                        textToInsert = "3/4\n● Finalizing the Rendering Setup\n● Rendering Images\n● Rendering Walkthrough Video\n● Working on Add-on\n● Finalizing Video for Review";
                    } else if (textToInsert === 'shortcut-step-final') {
                        textToInsert = "4/4\n● Project Completed\n● Project in Revision";
                    }

                    const currentText = trkMilestone.textContent.trim();
                    const newText = currentText ? `${currentText}\n\n${textToInsert}` : textToInsert;
                    trkMilestone.textContent = newText;
                    data.nextMilestone = newText;
                    e.target.selectedIndex = 0;

                    // Sync change
                    if (!skipSync) syncProjectToSheet(data);
                }
            };
        }
    } else {
        if (phaseSelect) phaseSelect.style.display = 'none';
        if (milestoneSelect) milestoneSelect.style.display = 'none';
    }

    // Text Fields
    const header = document.getElementById('tracker-results-container')?.previousElementSibling;
    if (header) {
        let adminLabel = header.querySelector('.admin-edit-label');
        if (isEditMode) {
            if (!adminLabel) {
                adminLabel = document.createElement('div');
                adminLabel.className = 'admin-edit-label';
                adminLabel.style.cssText = 'color: orange; font-size: 10px; font-weight: bold; margin-bottom: 5px;';
                adminLabel.textContent = '● ADMIN EDIT MODE ACTIVE';
                header.appendChild(adminLabel);
            }
        } else if (adminLabel) {
            adminLabel.remove();
        }
    }

    const setSafe = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = val;
            if (isEditMode) {
                // ALL Fields are now editable in Admin Mode
                el.contentEditable = "true";
                el.style.outline = "1px dashed orange";
                el.style.minWidth = "20px";
                el.style.display = "inline-block"; // Ensure it takes space even if empty
                el.style.cursor = "text";

                el.oninput = () => {
                    const fieldMap = {
                        'trk-id': 'id', 'trk-cost': 'cost', 'trk-client': 'client',
                        'trk-project': 'project', 'trk-start': 'startDate',
                        'trk-phase': 'phase', 'trk-updated': 'lastUpdated', 'trk-deadline': 'deadline',
                        'trk-milestone': 'nextMilestone', 'trk-pending': 'pendingAmount',
                        'trk-amount-pay': 'amountToPay'
                    };
                    if (fieldMap[id]) {
                        data[fieldMap[id]] = el.textContent.trim();
                        if (!skipSync) syncProjectToSheet(data);
                    }
                };
            }
        }
    };

    const cleanDate = (d) => {
        if (!d || typeof d !== 'string') return d;
        if (d.includes('T') && d.includes('Z')) {
            // Convert ISO string to D MMM YYYY
            const date = new Date(d);
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        return d;
    };

    setSafe('trk-id', data.id);
    setSafe('trk-cost', data.cost);
    setSafe('trk-client', data.client);
    setSafe('trk-project', data.project);
    setSafe('trk-start', cleanDate(data.startDate));
    setSafe('trk-phase', data.phase);
    setSafe('trk-updated', cleanDate(data.lastUpdated));
    setSafe('trk-deadline', cleanDate(data.deadline));
    setSafe('trk-milestone', data.nextMilestone);
    setSafe('trk-pending', data.pendingAmount);
    setSafe('trk-amount-pay', data.amountToPay);

    // Status Highlighting
    const statuses = ['awaiting', 'progress', 'waiting', 'completed'];
    statuses.forEach(status => {
        const el = document.getElementById('status-' + status);
        if (el) {
            if (data.status === status) {
                el.classList.add('active-status');
                el.style.opacity = '1';
                el.style.transform = 'scale(1.05)';
                el.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';

                // Color coding
                if (status === 'awaiting') { el.style.border = '1px solid #3b82f6'; el.style.background = 'rgba(59, 130, 246, 0.1)'; }
                else if (status === 'progress') { el.style.border = '1px solid var(--primary-green)'; el.style.background = 'rgba(16, 185, 129, 0.1)'; }
                else if (status === 'waiting') { el.style.border = '1px solid #ffc107'; el.style.background = 'rgba(255, 193, 7, 0.1)'; }
                else if (status === 'completed') { el.style.border = '1px solid var(--primary-green)'; el.style.background = 'rgba(16, 185, 129, 0.1)'; }
            } else {
                el.classList.remove('active-status');
                el.style.opacity = '1';
                el.style.transform = 'scale(1)';
                el.style.boxShadow = 'none';
                el.style.border = '1px solid #efefef';
                el.style.background = 'rgba(0,0,0,0.02)';
            }

            if (isEditMode) {
                el.style.cursor = 'pointer';
                el.onclick = () => {
                    data.status = status;
                    populateTrackerPopup(data);
                    if (!skipSync) syncProjectToSheet(data);
                };
            }
        }
    });

    // Download Button & Link Input
    const downloadBtn = document.getElementById('btn-download');
    if (downloadBtn) {
        downloadBtn.innerHTML = '<span style="margin-right: 8px;">📥</span> Download Latest Project Files';
        downloadBtn.href = (data.downloadLink && data.downloadLink !== '#') ? data.downloadLink : 'https://aman3dpartner.netlify.app/';

        // --- NEW: Track when client clicks download ---
        downloadBtn.onclick = () => {
            console.log("Logging file view for ID:", data.id);
            fetch(TRACKER_SYNC_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'logDownload',
                    id: data.id
                })
            }).catch(e => console.warn("Log failed:", e));
        };

        // Admin Buttons and Link Input for Tracker
        const btnContainer = downloadBtn ? downloadBtn.parentElement : null;

        if (isEditMode && btnContainer) {
            // 1. Link Input
            let linkInput = document.getElementById('trk-link-edit');
            if (!linkInput) {
                linkInput = document.createElement('input');
                linkInput.id = 'trk-link-edit';
                linkInput.placeholder = 'Paste download link here...';
                linkInput.style.cssText = 'width: 100%; margin-top: 8px; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.3); border: 1px dashed orange; color: #fff; font-size: 11px; outline: none; box-sizing: border-box;';
                // Insert after download button
                if (downloadBtn.nextSibling) {
                    btnContainer.insertBefore(linkInput, downloadBtn.nextSibling);
                } else {
                    btnContainer.appendChild(linkInput);
                }
            }
            linkInput.value = data.downloadLink || '';
            linkInput.oninput = () => {
                const newLink = linkInput.value.trim();
                data.downloadLink = newLink;
                if (downloadBtn) downloadBtn.href = newLink || 'https://aman3dpartner.netlify.app/';
                if (!skipSync) syncProjectToSheet(data);
            };

            // 2. Admin Buttons
            let adminGroup = document.getElementById('trk-admin-btns');
            if (!adminGroup) {
                adminGroup = document.createElement('div');
                adminGroup.id = 'trk-admin-btns';
                adminGroup.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 15px; border-top: 1px dashed orange; padding-top: 15px;';
                btnContainer.appendChild(adminGroup);
            }
            adminGroup.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button id="btn-save-new" style="padding: 10px; background: #22c55e; color: #fff; border: none; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;" title="Saves as a NEW record in the list">💾 Download New Client Form</button>
                <button id="btn-update-existing" style="padding: 10px; background: #3b82f6; color: #fff; border: none; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;" title="Overwrites the original record you opened">📝 Update Existing Client</button>
            </div>
            <button id="btn-reset" style="width: 100%; padding: 10px; background: #a855f7; color: #fff; border: none; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;">🔄 Reset Tracker (Generate New Branded ID)</button>
        `;

            const btnSaveNew = document.getElementById('btn-save-new');
            if (btnSaveNew) btnSaveNew.onclick = () => downloadTrackerData(data, 'new');

            const btnUpdate = document.getElementById('btn-update-existing');
            if (btnUpdate) btnUpdate.onclick = () => downloadTrackerData(data, 'update');

            const btnReset = document.getElementById('btn-reset');
            if (btnReset) btnReset.onclick = async () => {
                const confirmReset = confirm("Are you sure? This will generate a fresh Project ID and reset all progress.");
                if (!confirmReset) return;

                btnReset.innerHTML = 'Fetching Next ID...';

                try {
                    const response = await fetch(`${TRACKER_SYNC_URL}?action=getNextID`);
                    const res = await response.json();

                    const nextNum = res.nextNum;
                    const newID = res.nextID;

                    // Calculate Dates
                    const now = new Date();
                    const formDate = now.toLocaleDateString('en-GB');
                    const updateDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                    const deliveryDateObj = new Date();
                    deliveryDateObj.setDate(now.getDate() + 7);
                    const deliveryDate = deliveryDateObj.toLocaleDateString('en-GB');

                    const baseSetup = window.projectData && window.projectData["AMAN00Z"] ? window.projectData["AMAN00Z"] : {};

                    const resetData = {
                        ...baseSetup,
                        id: newID,
                        startDate: formDate,
                        lastUpdated: updateDate,
                        deadline: deliveryDate,
                        status: "progress",
                    };

                    populateTrackerPopup(resetData);

                    // PROMPT SYNC IMMEDIATELY ON RESET
                    syncProjectToSheet(resetData);

                } catch (e) {
                    alert("Error reaching server for Next ID.");
                } finally {
                    btnReset.textContent = '🔄 Reset Tracker (New ID Generated)';
                }
            };
        } else {
            // CLEANUP: Remove admin elements if NOT in edit mode
            const linkInput = document.getElementById('trk-link-edit');
            if (linkInput) linkInput.remove();

            const adminGroup = document.getElementById('trk-admin-btns');
            if (adminGroup) adminGroup.remove();
        }
    }

    // Print & Feedback (Hide if editing, or keep)
    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.onclick = () => window.print();

}


// ===== Minimize/Maximize =====
function initMinimize() {
    const minimizedBar = document.getElementById('minimizedBar');

    // Add click handlers to all minimize buttons
    document.querySelectorAll('.minimize-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const parent = btn.closest('.sticky-note, .profile-card, .logo, .btn-360-wrapper');
            if (parent) minimizeElement(parent);
        });
    });

    // Initialize Pinning
    initPinning();

    function initPinning() {
        document.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const parent = btn.closest('.sticky-note, .profile-card, .logo, .btn-360-wrapper');
                if (parent) {
                    parent.classList.toggle('pinned');
                    btn.classList.toggle('pinned-active');
                }
            });
        });
    }

    function autoMinimizeOthers(activeId) {
        // Find all potentially open sections
        const sections = document.querySelectorAll('.sticky-note, .profile-card, .logo, .btn-360-wrapper');
        sections.forEach(el => {
            // Rules for auto-minimizing:
            // 1. Don't minimize the section we just opened
            // 2. Don't minimize the Sketch Note (Let's Get Started) or Logo
            // 3. Don't minimize if it's already minimized
            // 4. Don't minimize if it's PINNED
            if (el.id === activeId) return;
            if (el.id === 'note-sketch-image' || el.id === 'logo') return;
            if (el.id === 'btn-360') return; // Never auto-minimize 360 into the bar
            if (el.classList.contains('minimized')) return;
            if (el.classList.contains('pinned')) return;

            minimizeElement(el);
        });
    }

    function minimizeElement(el) {
        const id = el.id;
        if (id === 'btn-360') return; // Never add 360 to the minimized bar
        const title = el.dataset.title || el.querySelector('.header-title')?.textContent || 'Tab';

        // Hide the element
        el.classList.add('minimized');

        // Create tab in minimized bar
        const tab = document.createElement('button');
        tab.className = 'minimized-tab';
        tab.dataset.targetId = id;
        tab.innerHTML = `<span class="restore-icon"><svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg></span> ${title}`;
        tab.addEventListener('click', () => restoreElement(id, tab));

        minimizedBar.appendChild(tab);

        // Save minimized state
        saveMinimizedState();
    }

    function restoreElement(id, tab) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('minimized');

            // Position restored tabs at intro video location (right of logo)
            // Don't reposition sketch note, logo, profile, or intro video itself
            const skipPositioning = ['note-sketch-image', 'logo', 'profile-card', 'note-intro'];
            if (!skipPositioning.includes(id)) {
                el.style.left = '1100px';  // Intro video position - right of logo, no overlap
                el.style.top = '100px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
                // Save this new position
                const positions = JSON.parse(localStorage.getItem('stickyPositions') || '{}');
                positions[id] = { left: el.style.left, top: el.style.top, zIndex: el.style.zIndex };
                localStorage.setItem('stickyPositions', JSON.stringify(positions));
            }

            // Bring to front when restored
            if (window.bringToFront) window.bringToFront(el);
            // Auto-minimize others when this one is restored
            autoMinimizeOthers(id);
        }
        tab.remove();
        saveMinimizedState();
    }

    function saveMinimizedState() {
        const minimized = [];
        document.querySelectorAll('.minimized').forEach(el => {
            if (el.id) minimized.push(el.id);
        });
        localStorage.setItem('minimizedElements', JSON.stringify(minimized));
    }

    // Restore minimized state on load
    function loadMinimizedState() {
        const minimized = JSON.parse(localStorage.getItem('minimizedElements') || '[]');
        minimized.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const btn = el.querySelector('.minimize-btn');
                if (btn) btn.click();
            }
        });
    }

    // Delay to ensure elements are ready
    setTimeout(loadMinimizedState, 100);
}

// ===== Project Carousel =====
function initCarousel() {
    const images = Array.from({ length: 24 }, (_, i) => `images/project (${i + 1}).webp`);
    let currentIndex = 0;
    const img = document.querySelector('.project-image img');
    const prev = document.querySelector('.carousel-btn.prev');
    const next = document.querySelector('.carousel-btn.next');
    const projectImage = document.querySelector('.project-image');

    if (!img || !prev || !next) return;

    prev.addEventListener('click', (e) => { e.stopPropagation(); currentIndex = (currentIndex - 1 + images.length) % images.length; updateImage(); });
    next.addEventListener('click', (e) => { e.stopPropagation(); currentIndex = (currentIndex + 1) % images.length; updateImage(); });

    if (projectImage) {
        projectImage.addEventListener('click', (e) => {
            e.stopPropagation();
            openPopup('project-' + (currentIndex + 1));
        });
    }

    function updateImage() {
        img.style.opacity = '0';
        setTimeout(() => { img.src = images[currentIndex]; img.style.opacity = '1'; }, 200);
        if (projectImage) projectImage.setAttribute('data-popup', 'project-' + (currentIndex + 1));
    }
    img.style.transition = 'opacity 0.2s ease';
}

// ===== Background Slider =====
function initBackgroundSlider() {
    const slides = document.querySelectorAll('.slide');
    const indicators = document.querySelectorAll('.indicator');
    const prevBtn = document.querySelector('.prev-slide');
    const nextBtn = document.querySelector('.next-slide');
    let currentSlide = 0;
    let autoSlideInterval;

    if (slides.length === 0) return;

    function showSlide(index) {
        slides.forEach(s => s.classList.remove('active'));
        indicators.forEach(i => i.classList.remove('active'));
        currentSlide = (index + slides.length) % slides.length;
        slides[currentSlide].classList.add('active');
        if (indicators[currentSlide]) indicators[currentSlide].classList.add('active');
    }

    function nextSlide() { showSlide(currentSlide + 1); }
    function prevSlide() { showSlide(currentSlide - 1); }

    function startAutoSlide() { autoSlideInterval = setInterval(nextSlide, 5000); }
    function resetAutoSlide() { clearInterval(autoSlideInterval); startAutoSlide(); }

    if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); resetAutoSlide(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); resetAutoSlide(); });

    indicators.forEach((ind, i) => {
        ind.addEventListener('click', () => { showSlide(i); resetAutoSlide(); });
    });

    startAutoSlide();
}

// ===== Popups =====
let popupStack = [];
let isConfirmingClose = false;

function initPopups() {
    const overlay = document.getElementById('popupOverlay');
    const content = document.getElementById('popupContent');
    const closeBtn = document.querySelector('.popup-close');

    if (!overlay || !content) return;

    // Use a single robust delegated listener for ALL interactive buttons
    document.addEventListener('click', (e) => {
        // Find the interactive element that was clicked
        const btn = e.target.closest('[data-popup]');

        // Basic guards
        if (!btn || btn.classList.contains('was-dragged')) return;

        // Handle Regular Popups
        if (btn.hasAttribute('data-popup')) {
            e.preventDefault();
            const popupId = btn.getAttribute('data-popup');
            const options = {
                hideDiscuss: btn.getAttribute('data-hide-discuss') === 'true'
            };
            if (window._saveBriefData) window._saveBriefData();
            openPopup(popupId, false, options);
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
}

// === Universal Video Actions (Play, Pause, Sound, PiP) ===
window.handleVideoAction = function (action, event, btnElement) {
    if (event) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    // Direct element reference is most reliable
    const btn = btnElement || (event ? event.currentTarget : null);
    if (!btn) {
        console.error('handleVideoAction: No button element found');
        return;
    }

    // 1. Find the associated player instance
    const container = btn.closest('.video-gallery-item, .intro-video-embed, .youtube-embed, .playlist-container');
    if (!container) {
        console.error('handleVideoAction: No video container found');
        return;
    }

    // Find iframe first
    const iframe = container.querySelector('.js-player');
    if (!iframe) {
        console.error('handleVideoAction: No iframe found in container');
        return;
    }

    // Check if player exists
    let player = iframe.plyr || iframe._plyr;

    // If no player, try to initialize
    if (!player) {
        console.log('handleVideoAction: Player not found, initializing...');

        // Check if Plyr library is loaded
        if (typeof Plyr === 'undefined') {
            console.error('handleVideoAction: Plyr library not loaded!');
            showToast('⚠️ Video player library not loaded. Please refresh the page.');
            return;
        }

        // Initialize Plyr for this specific iframe
        try {
            const config = {
                controls: ['play-large', 'play', 'mute', 'volume', 'pip'],
                seekTime: 5,
                youtube: {
                    noCookie: true,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    modestbranding: 1
                },
                tooltips: { controls: false, seek: false },
                displayDuration: false,
                invertTime: false,
                quality: {
                    default: 1080,
                    options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240]
                }
            };

            player = new Plyr(iframe, config);
            iframe.plyr = player;

            console.log('handleVideoAction: Plyr initialized successfully');

            // Wait a moment for player to be fully ready before executing action
            player.on('ready', () => {
                console.log('handleVideoAction: Player ready, executing action');
                executeVideoAction(player, action, btn);
            });

            return; // Exit and let the ready event handle the action

        } catch (e) {
            console.error('handleVideoAction: Plyr initialization failed:', e);
            showToast('⚠️ Failed to initialize video player');
            return;
        }
    }

    // Player exists, execute action immediately
    executeVideoAction(player, action, btn);
};

// Separate function to execute the actual video action
function executeVideoAction(player, action, btn) {
    if (!player) {
        console.error('executeVideoAction: No player provided');
        return;
    }

    // Visual feedback
    btn.classList.add('pulse-orange');
    setTimeout(() => btn.classList.remove('pulse-orange'), 600);

    try {
        const row = btn.closest('.video-controls-row') || btn.parentElement;

        if (action === 'play') {
            // Toggle play/pause
            if (player.playing) {
                player.pause();
            } else {
                player.play().catch(err => {
                    console.error('Play failed:', err);
                    showToast('⚠️ Unable to play video. Please try again.');
                });
            }

            // Update button icons
            const playIcons = row.querySelectorAll('.play-icon');
            const pauseIcons = row.querySelectorAll('.pause-icon');

            setTimeout(() => {
                const isPlaying = player.playing;
                playIcons.forEach(i => i.style.display = isPlaying ? 'none' : 'block');
                pauseIcons.forEach(i => i.style.display = isPlaying ? 'block' : 'none');
            }, 100);

        } else if (action === 'sound') {
            // Toggle mute/unmute
            player.muted = !player.muted;

            // If unmuting and volume is too low, set to full
            if (!player.muted && player.volume < 0.1) {
                player.volume = 1;
            }

            // Update button icons
            const soundOnIcons = row.querySelectorAll('.sound-on');
            const soundOffIcons = row.querySelectorAll('.sound-off');

            soundOnIcons.forEach(i => i.style.display = player.muted ? 'none' : 'block');
            soundOffIcons.forEach(i => i.style.display = player.muted ? 'block' : 'none');

        } else if (action === 'detach') {
            // Start playing and unmute before PiP
            player.play().catch(err => {
                console.error('Play before PiP failed:', err);
            });

            player.muted = false;
            if (player.volume < 0.1) player.volume = 1;

            // Small delay to ensure video is playing
            setTimeout(() => {
                try {
                    // Try Plyr's PiP API first
                    if (typeof player.pip !== 'undefined') {
                        player.pip = true;
                    }
                    // Fallback to native PiP API
                    else if (player.elements && player.elements.wrapper) {
                        const video = player.elements.wrapper.querySelector('video');
                        if (video && document.pictureInPictureEnabled) {
                            if (document.pictureInPictureElement) {
                                document.exitPictureInPicture().catch(err => {
                                    console.error('Exit PiP failed:', err);
                                });
                            } else {
                                video.requestPictureInPicture().catch(err => {
                                    console.error('Request PiP failed:', err);
                                    showToast('⚠️ Picture-in-Picture not supported');
                                });
                            }
                        } else {
                            showToast('⚠️ Picture-in-Picture not available');
                        }
                    } else {
                        showToast('⚠️ Picture-in-Picture not supported');
                    }
                } catch (err) {
                    console.error('PiP error:', err);
                    showToast('⚠️ Picture-in-Picture failed');
                }
            }, 200);
        }
    } catch (err) {
        console.error('Video action failed:', err);
        showToast('⚠️ Video control failed');
    }
}

function openPopup(id, isBack = false, options = {}) {
    const overlay = document.getElementById('popupOverlay');
    const content = document.getElementById('popupContent');

    if (!overlay || !content) return;

    // IMMEDIATE VISIBILITY: Show overlay first to provide instant feedback
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Update URL to reflect current popup (deep-link support)
    const skipUrlPopups = ['confirm-close', 'pdf-viewer'];
    if (!skipUrlPopups.includes(id)) {
        history.replaceState({ popup: id }, '', window.location.pathname + '?popup=' + encodeURIComponent(id));
    }

    // CRITICAL: Save brief data BEFORE we overwrite the innerHTML
    if (!isBack && popupStack.length > 0) {
        const currentPopup = popupStack[popupStack.length - 1];
        if (currentPopup.id === 'contact' && window._saveBriefData) {
            window._saveBriefData();
        }
    }

    // Save scroll position of current popup if we're opening a new one
    if (!isBack && popupStack.length > 0) {
        const currentTop = popupStack[popupStack.length - 1];
        currentTop.scrollPos = content.scrollTop;
    }

    // Add to stack if not going back
    if (!isBack) {
        if (popupStack.length === 0 || popupStack[popupStack.length - 1].id !== id) {
            popupStack.push({ id: id, scrollPos: 0 });
        }
    }

    // Securely pause background videos
    document.querySelectorAll('.js-player').forEach(p => {
        if (p.plyr && !p.closest('.popup-modal')) {
            p.plyr.pause();
        }
    });

    const template = document.getElementById('popup-' + id);

    if (!template) {
        content.innerHTML = `<div class="popup-inner"><h2>Coming Soon</h2><p>This content is being prepared.</p></div>`;
    } else {
        content.innerHTML = template.innerHTML;

        // Trigger YouTube player initialization for video popups
        if (id === 'videos' || id.includes('video')) {
            console.log(`openPopup: Dispatching event to initialize YouTube players for popup '${id}'`);

            // Dispatch custom event that youtube-controls.js listens for
            document.dispatchEvent(new CustomEvent('popupOpened', {
                detail: { popupId: id }
            }));
        }

        // Keep Plyr for other video content if needed
        if (window.initPlyr && id !== 'videos') {
            window.initPlyr(content);
        }



        // Custom logic to hide "Discuss Hourly" button if requested
        if (id === 'hourly-more' && options.hideDiscuss) {
            const discussBtn = content.querySelector('button[onclick*="Hourly Rate Inquiry"]');
            if (discussBtn) {
                discussBtn.style.display = 'none';
            }
        }

        if (id === 'client-reviews') {
            renderAutoReviews();
        }
    }

    // Media loading and setup proceeds while overlay is visible

    // Restore scroll position if going back
    if (isBack) {
        const current = popupStack[popupStack.length - 1];
        if (current && current.scrollPos) {
            // Slight delay to ensure content is fully rendered before scrolling
            setTimeout(() => {
                content.scrollTop = current.scrollPos;
            }, 50);
        }
    } else {
        content.scrollTop = 0;
    }

    // Clear save function if we are leaving the brief and NOT going to a sub-popup
    // This prevents other popups from accidentally calling save on their own content
    if (id !== 'contact' && !['hourly-more', 'portfolio-examples', 'confirm-close', 'qr-code'].includes(id)) {
        window._saveBriefData = null;
    }

    // Dynamic Content Rendering
    if (id === 'reviews') {
        renderReviews(content);
    } else if (id === 'contact') {
        initQuickPickLogic(content);
    } else if (id === '3d-comparison' || id === 'pricing-pro') {
        init3DComparisonSlider(content);
    }

    // Hide close button for confirmation dialog
    const closeTrigger = document.querySelector('.popup-close');
    if (closeTrigger) {
        closeTrigger.style.display = (id === 'confirm-close') ? 'none' : 'block';
    }



    // Handle Payment Popup Logic
    if (id === 'payment') {
        const unlockBtn = content.querySelector('#btnUnlockPayment');
        const orderInput = content.querySelector('#orderNumberInput');
        const lockedSection = content.querySelector('#paymentLockedContent');
        const errorMsg = content.querySelector('#paymentError');
        const formOrderNumber = content.querySelector('#formOrderNumber');

        if (unlockBtn && orderInput) {
            // Apply shared formatting to payment input
            orderInput.addEventListener('input', () => {
                errorMsg.style.display = 'none';
                orderInput.style.borderColor = 'rgba(255,255,255,0.15)';
                orderInput.value = formatProjectID(orderInput.value);
            });

            unlockBtn.addEventListener('click', async () => {
                const rawVal = orderInput.value.trim();
                const cleanVal = rawVal.replace(/-/g, '');

                if (!rawVal) return;

                // Visual Feedback: Loading
                const originalText = unlockBtn.textContent;
                unlockBtn.innerHTML = '<span class="anim-dot">.</span><span class="anim-dot dot-2">.</span><span class="anim-dot dot-3">.</span>';
                unlockBtn.style.pointerEvents = 'none';

                try {
                    // 1. Primary: Verify against LIVE Google Sheet Tracker
                    console.log("Verifying Project ID against Sheet:", rawVal);
                    const response = await fetch(`${TRACKER_SYNC_URL}?action=getProject&id=${rawVal}`);
                    const result = await response.json();

                    let project = null;
                    if (result.status === "success" && result.project) {
                        project = result.project;
                        console.log("ID Verified via Sheet:", project.id);
                    } else {
                        // 2. Secondary: Fallback to local projectData (legacy/offline)
                        project = window.projectData && window.projectData[cleanVal];
                        if (project) console.log("ID Verified via Local Data");
                    }

                    if (project) {
                        lockedSection.style.display = 'block';
                        errorMsg.style.display = 'none';
                        orderInput.style.borderColor = 'var(--primary-green)';

                        // Fill the Project Details in the form
                        if (formOrderNumber) formOrderNumber.value = rawVal;

                        const formClientName = content.querySelector('#formClientName');
                        const formProjectTitle = content.querySelector('#formProjectTitle');
                        const formAmount = content.querySelector('#formAmount');

                        if (formClientName) formClientName.value = project.client || '';
                        if (formProjectTitle) formProjectTitle.value = project.project || '';
                        if (formAmount) formAmount.value = project.amountToPay || '';

                        // Scroll to Western Union section
                        setTimeout(() => {
                            lockedSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 100);
                    } else {
                        throw new Error("Invalid ID");
                    }
                } catch (err) {
                    console.error("Payment Unlock Error:", err);
                    errorMsg.style.display = 'block';
                    errorMsg.textContent = '❌ Invalid Project ID. Please check with Aman.';
                    orderInput.style.borderColor = '#ff4d4d';

                    // Simple shake for feedback
                    orderInput.parentElement.style.animation = 'none';
                    orderInput.parentElement.offsetHeight;
                    orderInput.parentElement.style.animation = 'shake 0.4s ease';
                } finally {
                    unlockBtn.textContent = originalText;
                    unlockBtn.style.pointerEvents = 'auto';
                }
            });

            orderInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') unlockBtn.click();
            });
        }
    }


    // Handle Persistence for Compare & Pricing Popups
    if (['compare', 'pricing-basic', 'pricing-pro', 'pricing-premium', 'pricing-masterpiece'].includes(id)) {
        // Shared edit mode key
        initContentPersistence(content, id);
    }
}

// Shared source of truth for ALL text elements that should be editable in Admin Mode
const SHARED_EDITABLE_SELECTORS = '.popup-inner h2, .popup-inner h3, .popup-inner h4, .popup-inner h5, .popup-inner p, .popup-inner li, .popup-inner td, .popup-inner th, .feature-label, .tier-price, .tier-name, .tier-desc, .tier-req, .total-price, .popup-inner div[style*="font-size"]';

// Helper to handle persistence of editable content
function initContentPersistence(container, id) {
    const potentialEditables = container.querySelectorAll(SHARED_EDITABLE_SELECTORS);

    // Unique storage key per popup
    const storageKey = `cms_data_${id}_v2`;
    const editModeKey = 'global_edit_mode_active';

    // Helper to clean HTML (Strips administrative attributes to keep updates.js clean)
    function cleanHTML(html) {
        if (!html) return "";
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Strip everything that shouldn't be in the saved JSON
        temp.querySelectorAll('*').forEach(el => {
            el.removeAttribute('contenteditable');
            el.removeAttribute('data-edit-id');
            el.removeAttribute('spellcheck');
            // Remove style only if it looks like an admin-injected style (e.g., the outline)
            if (el.style.outline && el.style.outline.includes('dashed')) {
                el.style.outline = "";
            }
        });

        return temp.innerHTML;
    }

    // Strip formatting on paste
    function handlePaste(e) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    }

    // Save on input/blur
    function saveData(el) {
        const dataId = el.getAttribute('data-edit-id');
        if (!dataId) return;

        console.log(`CMS Saving [${id}]: ${dataId}`); // Debug log
        const savedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        savedData[dataId] = cleanHTML(el.innerHTML);
        localStorage.setItem(storageKey, JSON.stringify(savedData));

        // Also fire a custom event to notify other potential listeners
        window.dispatchEvent(new CustomEvent('cms-data-saved', { detail: { id, dataId } }));
    }

    // 1. Assign IDs to ALL matched elements (Only if they don't have a hardcoded one)
    potentialEditables.forEach((el, index) => {
        // Broaden the check: if it's already got an ID, fine. Otherwise, assign one.
        let dataId = el.getAttribute('data-edit-id');
        if (!dataId) {
            // We use a prefix to avoid collisions between different popups
            dataId = `cms_${index}`;
            el.setAttribute('data-edit-id', dataId);
        }

        // Attach listeners for saving
        el.addEventListener('input', () => saveData(el));
        el.addEventListener('blur', () => saveData(el));
        el.addEventListener('paste', handlePaste);
    });

    // 2. Load saved content data
    try {
        const savedData = JSON.parse(localStorage.getItem(storageKey) || '{}');
        potentialEditables.forEach((el) => {
            const dataId = el.getAttribute('data-edit-id');
            if (savedData[dataId]) {
                el.innerHTML = cleanHTML(savedData[dataId]);
            }
        });
    } catch (e) {
        console.error(`Error loading data for ${id}`, e);
    }

    // 3. Apply Edit Mode status
    const isEditModeActive = localStorage.getItem(editModeKey) === 'true';
    potentialEditables.forEach(el => {
        if (isEditModeActive) {
            el.contentEditable = "true";
            el.style.outline = "1px dashed rgba(255, 165, 0, 0.3)";
        } else {
            el.contentEditable = "false";
            el.style.outline = "none";
        }
    });

    // Cheat Code Listener is now Global (see initGlobalCheatCode)
}

// ===== Global Persistence & Admin Tools =====

function initGlobalPersistence() {
    loadUpdates();
    initGlobalCheatCode();
}

function loadUpdates() {
    // Sync global content from updates.js (window.CMS_DATA)
    if (typeof window.CMS_DATA === 'object') {
        const keys = Object.keys(window.CMS_DATA);
        console.log(`Syncing ${keys.length} content groups from updates.js...`);
        keys.forEach(key => {
            if (key.startsWith('cms_')) {
                localStorage.setItem(key, JSON.stringify(window.CMS_DATA[key]));
            }
        });
    } else {
        console.warn('updates.js loaded but window.CMS_DATA is missing!');
    }
}

function initGlobalCheatCode() {
    let keyBuffer = '';

    // Obfuscated keys to prevent easy discovery in Inspect Element
    // These are reversed Base64 strings of the actual codes
    const _secK1 = "YTk5ODg3Nw=="; // 778899a
    const _secK2 = "Yjk5ODg3Nw=="; // 778899b

    const _getK = (s) => atob(s).split('').reverse().join('');

    const toggleCode = _getK(_secK1);
    const trackerCode = _getK(_secK2);

    const maxLen = 8;
    const editModeKey = 'global_edit_mode_active';
    const trackerEditModeKey = 'tracker_edit_mode_active';

    // Check initial state for toolbar
    if (localStorage.getItem(editModeKey) === 'true') {
        toggleAdminToolbar(true);
    }

    document.addEventListener('keydown', (e) => {
        // Only track letters/numbers
        if (e.key.length === 1) {
            keyBuffer += e.key;
            if (keyBuffer.length > maxLen) {
                keyBuffer = keyBuffer.slice(-maxLen);
            }

            // Global Edit Mode (778899a)
            if (keyBuffer.includes(toggleCode)) {
                const currentMode = localStorage.getItem(editModeKey) === 'true';
                const container = document.getElementById('popupContent');

                if (currentMode) {
                    localStorage.setItem(editModeKey, 'false');
                    toggleAdminToolbar(false);
                    const allEditables = document.querySelectorAll('[contenteditable]');
                    allEditables.forEach(el => {
                        el.contentEditable = "false";
                        el.style.outline = "none";
                    });

                    // Force a small delay to ensure last edits are captured
                    setTimeout(() => {
                        downloadUpdates();
                        alert('ADMIN MODE: DISABLED\n\nSUCCESS: Your changes have been captured!\n\nIMPORTANT: To make these changes permanent for all visitors, you MUST replace the "updates.js" file in your project folder with the one just downloaded.');
                    }, 100);
                } else {
                    localStorage.setItem(editModeKey, 'true');
                    toggleAdminToolbar(true);
                    const relevantEditables = container ? container.querySelectorAll(SHARED_EDITABLE_SELECTORS) : [];
                    relevantEditables.forEach(el => {
                        el.contentEditable = "true";
                        el.style.outline = "1px dashed rgba(255, 165, 0, 0.4)";
                    });
                    // Feedback
                    alert('ADMIN MODE: ENABLED\n\nClick any text to edit. Changes save automatically to local browser storage.');
                }
                keyBuffer = '';
            }
            // Tracker Edit Mode (778899b)
            else if (keyBuffer.includes(trackerCode)) {
                const currentMode = localStorage.getItem(trackerEditModeKey) === 'true';
                if (currentMode) {
                    // Auto-download before disabling
                    if (window.lastTrackedProject) {
                        downloadTrackerData(window.lastTrackedProject, 'update', false);
                    }
                    localStorage.setItem(trackerEditModeKey, 'false');
                    alert('Tracker Edit Mode: DISABLED\nChanges downloaded automatically.');
                } else {
                    localStorage.setItem(trackerEditModeKey, 'true');
                    alert('Tracker Edit Mode: ENABLED\nTracking popup now editable.');
                }
                // Refresh popup if open
                if (window.lastTrackedProject && document.getElementById('popup-track-status')) {
                    populateTrackerPopup(window.lastTrackedProject);
                }
                keyBuffer = '';
            }
        }
    });
}

function downloadUpdates() {
    const exportData = {};
    // Collect all CMS data
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cms_')) {
            try {
                exportData[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
                console.warn('Skipping invalid JSON key:', key);
            }
        }
    }

    // Create JS Blob for local file:// compatibility
    const dataStr = 'window.CMS_DATA = ' + JSON.stringify(exportData, null, 2) + ';';
    const blob = new Blob([dataStr], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = "updates.js";

    // Explicitly set properties for better cross-browser compatibility
    link.setAttribute('download', 'updates.js');
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    // Cleanup with a small delay
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

function toggleAdminToolbar(show) {
    let toolbar = document.getElementById('admin-toolbar');
    let banner = document.getElementById('admin-mode-banner');
    let statusLabel = document.getElementById('global-admin-status');

    if (!show) {
        if (toolbar) toolbar.remove();
        if (banner) banner.remove();
        if (statusLabel) statusLabel.remove();
        return;
    }

    // 1. Top Screen Line Banner
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'admin-mode-banner';
        Object.assign(banner.style, {
            position: 'fixed', top: '0', left: '0', right: '0', height: '4px',
            background: 'var(--primary-orange)', zIndex: '10001',
            boxShadow: '0 2px 10px rgba(210, 105, 30, 0.4)'
        });
        document.body.appendChild(banner);
    }

    // 2. Visible "ADMIN MODE ACTIVE" text (Top Left)
    if (!statusLabel) {
        statusLabel = document.createElement('div');
        statusLabel.id = 'global-admin-status';
        statusLabel.innerHTML = `<span style="color: var(--primary-orange); margin-right: 8px;">●</span> ADMIN MODE ACTIVE`;
        Object.assign(statusLabel.style, {
            position: 'fixed', top: '15px', left: '20px', zIndex: '10002',
            background: 'rgba(0,0,0,0.85)', color: 'white', padding: '8px 15px',
            borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', border: '1px solid var(--primary-orange)',
            letterSpacing: '1px', pointerEvents: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            fontFamily: 'sans-serif'
        });
        document.body.appendChild(statusLabel);
    }

    // 3. Right Side Toolbar
    if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'admin-toolbar';
        Object.assign(toolbar.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999',
            background: 'rgba(26, 26, 26, 0.98)', padding: '10px', borderRadius: '8px',
            border: '1px solid var(--primary-orange)',
            boxShadow: '0 5px 20px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '8px',
            minWidth: '150px'
        });

        const header = document.createElement('div');
        header.innerHTML = '<strong style="color:var(--primary-orange); font-size: 10px;">CMS TOOLS</strong>';
        toolbar.appendChild(header);

        const btnSave = document.createElement('button');
        btnSave.innerText = '💾 Export updates.js';
        Object.assign(btnSave.style, {
            background: 'var(--primary-orange)', color: 'white', border: 'none',
            padding: '6px 10px', borderRadius: '4px', cursor: 'pointer',
            fontWeight: 'bold', fontSize: '11px', transition: 'all 0.2s'
        });

        btnSave.onclick = downloadUpdates;
        toolbar.appendChild(btnSave);

        const hint = document.createElement('div');
        hint.innerHTML = 'Auto-saves. Download for project.';
        hint.style.fontSize = '8px';
        hint.style.color = 'rgba(255,255,255,0.4)';
        hint.style.lineHeight = '1.2';
        toolbar.appendChild(hint);

        document.body.appendChild(toolbar);
    }
}

// ===== Form Handlers =====

// Handle Success Message from URL
function checkFormSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('sent') === 'true') {
        // Explicitly open the contact popup
        openPopup('contact');

        setTimeout(() => {
            const statusEl = document.getElementById('form-status');
            if (statusEl) {
                statusEl.textContent = '✅ Thank you! Your message and attachments have been sent successfully. Aman will review the project brief and be in touch with you shortly.';
                statusEl.style.color = '#4CAF50';
                statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 800); // Slightly longer delay for mobile rendering

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Attachment change listener for size validation
document.addEventListener('change', (e) => {
    if (e.target.id === 'attachmentInput' || e.target.id === 'paymentProofInput') {
        const file = e.target.files[0];
        if (file && file.size > 10 * 1024 * 1024) { // 10MB limit
            alert('File is too large! Max allowed is 10MB. For larger submissions, please use the WeTransfer link provided in the form.');
            e.target.value = ''; // Clear input
        }
    }
});

// Consolidated Form Submission Handler
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'contactForm') {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('.btn-submit');
        const statusEl = document.getElementById('form-status');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.textContent;
            submitBtn.textContent = 'Preparing secure delivery...';
        }

        try {
            // --- Step 1: Collect Dynamic "Quick Pick" Data ---
            const qpContainer = form.closest('.popup-content')?.querySelector('.quick-pickup-container');
            const formData = {};
            const rawFields = new FormData(form);

            // Detailed Service Collection
            const selectedServices = [];
            const serviceCheckboxes = qpContainer ? qpContainer.querySelectorAll('input[name="Services[]"]:checked') : [];
            serviceCheckboxes.forEach(checkbox => {
                if (checkbox.value === 'Other') {
                    const otherInput = qpContainer.querySelector('input[name="Other_Service"]');
                    if (otherInput && otherInput.value.trim()) {
                        selectedServices.push('Other Service: ' + otherInput.value.trim());
                    }
                } else if (checkbox.value === '2D Architecture Concept Plan') {
                    let serviceName = checkbox.value;
                    const conceptDetails = qpContainer.querySelector('#conceptPlanDetails');
                    if (conceptDetails) {
                        const subOptions = conceptDetails.querySelectorAll('input[name="Concept_Details[]"]:checked');
                        if (subOptions.length > 0) {
                            const details = Array.from(subOptions).map(opt => opt.value).join(', ');
                            serviceName += ` (${details})`;
                        }
                    }
                    selectedServices.push(serviceName);
                } else {
                    selectedServices.push(checkbox.value);
                }
            });

            // Work Type, Interior, Exterior Collection
            const workTypeSelect = qpContainer ? qpContainer.querySelector('#workTypeSelect') : null;
            const workType = workTypeSelect ? workTypeSelect.value : '';

            const selectedInterior = [];
            const selectedExterior = [];
            if (qpContainer && (workType === 'Interior only' || workType === 'Interior and Exterior both')) {
                qpContainer.querySelectorAll('input[name="Interior_Items[]"]:checked').forEach(cb => {
                    selectedInterior.push(cb.value === 'Other' ? (qpContainer.querySelector('input[name="Interior_Custom"]')?.value || 'Other Interior') : cb.value);
                });
            }
            if (qpContainer && (workType === 'Exterior only' || workType === 'Interior and Exterior both')) {
                qpContainer.querySelectorAll('input[name="Exterior_Items[]"]:checked').forEach(cb => {
                    selectedExterior.push(cb.value === 'Other' ? (qpContainer.querySelector('input[name="Exterior_Custom"]')?.value || 'Other Exterior') : cb.value);
                });
            }

            // Assemble Main Data Object
            for (let [key, value] of rawFields.entries()) {
                if (key !== 'Attachment' && !key.includes('[]')) {
                    formData[key] = value;
                }
            }

            // Sync budget and timeline custom values
            if (formData.Budget === 'custom') formData.Budget = formData.Budget_Custom;
            if (formData.Timeline === 'custom') formData.Timeline = formData.Timeline_Custom;

            formData.formType = 'contact';
            formData.Quick_Pick_Services = selectedServices.join(', ');
            formData.Work_Type = workType;
            formData.Interior_Requirements = selectedInterior.join(', ');
            formData.Exterior_Requirements = selectedExterior.join(', ');
            formData.Timestamp = new Date().toLocaleString();

            // --- Step 2: Handle Attachment ---
            let fileToAttach = form.querySelector('input[type="file"]')?.files[0] || window._pendingBriefAttachment;

            if (fileToAttach) {
                if (submitBtn) submitBtn.textContent = 'Encoding attachment...';
                formData.fileName = fileToAttach.name;
                formData.fileType = fileToAttach.type;
                formData.fileData = await fileToBase64(fileToAttach);
                formData.File_Attached_Status = `YES - ${fileToAttach.name}`;
            } else {
                formData.File_Attached_Status = "NO - No file attached";
            }

            // --- Step 3: Tawk.to Copy (Internal Message) ---
            try {
                const tawkApi = window.Tawk_API || Tawk_API;
                if (typeof tawkApi !== 'undefined') {
                    const summaryMessage = `🚀 NEW PROJECT BRIEF\nClient: ${formData.Name}\nTitle: ${formData.Project_Title}\nServices: ${formData.Quick_Pick_Services}\nBudget: ${formData.Budget}\nAttachment: ${formData.File_Attached_Status}`.trim();
                    if (tawkApi.setAttributes) tawkApi.setAttributes({ 'name': formData.Name, 'email': formData.Email });
                    if (tawkApi.sendChatMessage) tawkApi.sendChatMessage(summaryMessage);
                    if (tawkApi.maximize) tawkApi.maximize();
                }
            } catch (err) { console.warn("Tawk.to copy failed:", err); }

            // --- Step 4: Unified Submission (Sheets + Email + Attachments) ---
            const briefSyncData = {
                action: 'submitBrief',
                brief: {
                    name: formData.Name,
                    email: formData.Email,
                    phone: formData.Phone,
                    projectTitle: formData.Project_Title,
                    services: selectedServices,
                    otherService: qpContainer?.querySelector('input[name="Other_Service"]')?.value || '',
                    workType: workType,
                    interiorItems: selectedInterior,
                    interiorCustom: qpContainer?.querySelector('input[name="Interior_Custom"]')?.value || '',
                    exteriorItems: selectedExterior,
                    exteriorCustom: qpContainer?.querySelector('input[name="Exterior_Custom"]')?.value || '',
                    billingType: formData.Billing_Type,
                    budget: formData.Budget,
                    budgetCustom: formData.Budget_Custom,
                    timeline: formData.Timeline,
                    timelineCustom: formData.Timeline_Custom,
                    message: formData.Message,
                    attachment: fileToAttach ? { name: fileToAttach.name, data: formData.fileData } : null,
                    fileLink: formData.File_Link
                }
            };

            if (submitBtn) submitBtn.textContent = 'Delivering to Aman...';

            console.log("SENDING UNIFIED BRIEF DATA:", formData.Project_Title);

            // Using await here to ensure we know it's SENT before showing success
            await fetch(TRACKER_SYNC_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(briefSyncData)
            });

            console.log("UNIFIED HUB DISPATCHED");

            if (statusEl) {
                statusEl.textContent = '✅ Success! Your brief has been delivered. Aman will contact you soon.';
                statusEl.style.color = '#4ade80';
            }

            form.reset();
            window.savedContactFormData = null;
            window._pendingBriefAttachment = null;
            localStorage.removeItem('aman_contact_form_data');

            setTimeout(() => {
                window.location.href = window.location.origin + window.location.pathname + '?sent=true';
            }, 2500);

        } catch (err) {
            console.error("Submission Error:", err);
            if (statusEl) {
                statusEl.innerHTML = `❌ ${err.message === 'Apps Script URL not configured.' ? 'System Error: Form is not connected to backend.' : 'Delivery Error. Please try again or use WhatsApp.'}`;
                statusEl.style.color = '#ff4d4d';
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Retry Submission';
            }
        }
    }

    // Restore logic for payment form
    if (e.target.id === 'paymentForm') {
        handlePaymentFormSubmit(e);
    }
});

async function handlePaymentFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const statusEl = document.getElementById('paymentFormStatus');
    const submitBtn = form.querySelector('.btn-submit');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
    }

    try {
        const rawFields = new FormData(form);
        const paymentData = {
            action: 'submitPayment',
            timestamp: new Date().toISOString()
        };

        for (let [key, value] of rawFields.entries()) {
            if (key !== 'payment_proof') {
                paymentData[key] = value;
            }
        }

        // Handle Payment Proof Attachment
        const fileInput = form.querySelector('#paymentProofInput');
        if (fileInput && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (submitBtn) submitBtn.textContent = 'Encoding proof...';
            paymentData.proofFile = {
                name: file.name,
                type: file.type,
                data: await fileToBase64(file)
            };
        }

        // --- Tawk.to Copy for Payment ---
        try {
            if (typeof Tawk_API !== 'undefined') {
                const summary = `💰 NEW PAYMENT\nClient: ${paymentData.name}\nID: ${paymentData.project_id}\nMTCN: ${paymentData.mtcn}\nAmount: ${paymentData.amount}`;
                if (Tawk_API.sendChatMessage) Tawk_API.sendChatMessage(summary);
                if (Tawk_API.addEvent) Tawk_API.addEvent('payment_submitted', { id: paymentData.project_id });
            }
        } catch (e) { }

        if (submitBtn) submitBtn.textContent = 'Sending to Aman...';

        console.log("SENDING PAYMENT DATA TO GAS:", paymentData.project_id);

        const response = await fetch(TRACKER_SYNC_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(paymentData)
        });

        if (statusEl) {
            statusEl.textContent = '✅ Payment details submitted successfully!';
            statusEl.style.color = '#4CAF50';
        }

        form.reset();
        if (submitBtn) {
            submitBtn.textContent = 'Submitted Successfully';
            submitBtn.style.background = '#4CAF50';
        }

        setTimeout(() => {
            if (confirm('Payment details logged! Inform Aman via WhatsApp for faster verification?')) {
                window.open('https://wa.me/923010003011', '_blank');
            }
        }, 1500);

    } catch (error) {
        console.error("Payment Submission Error:", error);
        if (statusEl) {
            statusEl.textContent = '❌ Delivery Error. Please try again or use WhatsApp.';
            statusEl.style.color = '#ff4d4d';
        }
    } finally {
        if (submitBtn && submitBtn.textContent !== 'Submitted Successfully') {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Retry Submission';
        }
    }
}

function closePopup() {
    const current = popupStack[popupStack.length - 1];

    // Block close button for confirmation popup
    if (current && current.id === 'confirm-close') return;

    // Show confirmation only for the project brief form and if we're not already in the confirmation popup
    if (current && current.id === 'contact' && !isConfirmingClose) {
        isConfirmingClose = true;
        openPopup('confirm-close');
        return;
    }

    // Fix for "not fully closed admin mood": Ensure Tracker Admin Mode exits when popup closes
    if (current && current.id === 'track-status') {
        const wasEditMode = localStorage.getItem('tracker_edit_mode_active') === 'true';
        if (wasEditMode && window.lastTrackedProject) {
            // Auto-download update on close, don't trigger recursive close (3rd arg false)
            downloadTrackerData(window.lastTrackedProject, 'update', false);
        }
        localStorage.setItem('tracker_edit_mode_active', 'false');
        stopTrackerPolling();
        // Force clear countdown
        if (window.trackerCountdownInterval) {
            clearInterval(window.trackerCountdownInterval);
            window.trackerCountdownInterval = null;
        }
    }

    const overlay = document.getElementById('popupOverlay');

    if (popupStack.length > 1) {
        // Go back to previous popup
        popupStack.pop();
        const previous = popupStack[popupStack.length - 1];
        openPopup(previous.id, true);
    } else {
        // Close overlay completely
        popupStack = [];
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';

            // Restore clean URL when popup closes
            history.replaceState(null, '', window.location.pathname);

            // CRITICAL: Clear content to stop all background media/videos
            const content = document.getElementById('popupContent');
            if (content) {
                // Remove Plyr instances if they exist to prevent memory leaks
                if (window.Plyr && typeof window.destroyPlyr === 'function') {
                    window.destroyPlyr(content);
                }
                content.innerHTML = '';
            }
        }
    }

    // Reset confirmation flag when closing completely or switching focus
    if (popupStack.length === 0 || (popupStack[popupStack.length - 1].id !== 'confirm-close' && popupStack[popupStack.length - 1].id !== 'contact')) {
        isConfirmingClose = false;
    }
}

window.confirmClosePopup = function (confirm) {
    if (confirm) {
        // Pop the 'confirm-close' and proceed to actual close (which will pop 'contact')
        popupStack.pop();
        isConfirmingClose = true; // Keep true so closePopup skips the check
        closePopup();
        isConfirmingClose = false;
    } else {
        // Pop 'confirm-close' and restore 'contact'
        popupStack.pop();
        isConfirmingClose = false;
        const previous = popupStack[popupStack.length - 1];
        if (previous) openPopup(previous.id, true);
    }
};

async function downloadTrackerData(editedData, mode, shouldClose = true) {
    // 1. Sync with Google Sheet first
    try {
        await fetch(TRACKER_SYNC_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                project: editedData
            })
        });
        console.log("Tracker Two-Way Sync Dispatched");
    } catch (err) {
        console.error("Sync Error (Non-Critical):", err);
    }
    // Exit edit mode first
    localStorage.setItem('tracker_edit_mode_active', 'false');

    // 1. Get a deep clone of the current global project data
    // This ensures we have a "clean" starting point
    const freshGlobalData = JSON.parse(JSON.stringify(window.projectData));

    let finalKey;
    if (mode === 'update') {
        // Use the original key used to open this record
        // This ensures the record is overwritten correctly
        finalKey = window.originalTrackerKey || editedData.id.replace(/-/g, '').toUpperCase();
    } else {
        // Use the current ID in the form as the new key (for "Download New Client Form")
        finalKey = editedData.id.replace(/-/g, '').toUpperCase();
    }

    // 2. Add or Overwrite the record in our fresh global copy
    freshGlobalData[finalKey] = editedData;

    // 3. Create the file content
    const content = `// Project Data Replacement File\n// Replace the contents of project-data.js with this:\n\nconst projectData = ${JSON.stringify(freshGlobalData, null, 4)};\n\nwindow.projectData = projectData;`;

    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = mode === 'new' ? "project-data-NEW.js" : "project-data-UPDATED.js";

    // CRITICAL FIX: Link must be part of the DOM for click to work in some environments
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (shouldClose) {
        // Close popup and cleanup
        setTimeout(() => {
            closePopup();
            URL.revokeObjectURL(url);

            // Force refresh of the popup state if user re-opens immediately
            if (window.lastTrackedProject && document.getElementById('popup-track-status')) {
                // re-render not needed as closePopup hides it, but good practice
            }
        }, 500);
    } else {
        // Just cleanup
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 500);
    }
}

// ===== Mobile Menu =====
function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        document.body.classList.toggle('notes-visible');
    });

    // Show notes by default on mobile
    if (window.innerWidth <= 768) {
        document.body.classList.add('notes-visible');
    }
}

// Reset all positions and minimized states
window.resetPositions = function () {
    localStorage.removeItem('stickyPositions');
    localStorage.removeItem('minimizedElements');
    location.reload();
};

// ===== Copy to Clipboard =====
function initCopyButtons() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-btn');
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const targetId = btn.getAttribute('data-clipboard-target');
        // If target exists, get its text; otherwise use data-clipboard-text attr
        const textToCopy = targetId
            ? document.querySelector(targetId)?.textContent
            : btn.getAttribute('data-clipboard-text');

        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                // Visual feedback
                const originalIcon = btn.innerHTML;
                // Check mark icon
                btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                btn.classList.add('copied');

                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
            });
        }
    });
}

// ===== Collaboration Unlock =====
function initCollaborationUnlock() {
    const unlockBtn = document.getElementById('btn-unlock-collaboration');
    const input = document.getElementById('collaboration-passkey');
    const errorMsg = document.getElementById('collaboration-error');

    if (unlockBtn && input) {
        unlockBtn.addEventListener('click', () => {
            const passkey = input.value.trim();
            if (passkey === '552200') {
                openPopup('collaborate');
                input.value = '';
                if (errorMsg) errorMsg.style.display = 'none';
                input.style.borderColor = 'rgba(255,255,255,0.1)';
            } else {
                if (errorMsg) errorMsg.style.display = 'block';
                input.style.borderColor = '#ff4d4d';
                input.value = '';
            }
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') unlockBtn.click();
        });
    }
}

// Global function to toggle main chat (Tawk.to)
window.toggleMainChat = function () {
    if (typeof Tawk_API !== 'undefined' && Tawk_API.maximize) {
        Tawk_API.maximize();
    } else {
        console.warn('Chat widget not loaded yet.');
    }
};

// Global function to initiate plan inquiry — opens chat on CURRENT page so triggers fire correctly
window.initiatePlanChat = function (planName) {
    // 1. Close the pricing popup first
    // This is CRITICAL because closePopup() clears the URL parameters
    const overlay = document.getElementById('popupOverlay');
    if (overlay && overlay.classList.contains('active')) {
        if (typeof closePopup === 'function') {
            closePopup();
        }
    }

    // 2. Temporarily add ?plan= to the page URL so Tawk.to Trigger conditions can match it
    const originalUrl = window.location.href;
    const planKey = planName.split(' ')[0]; // Extract keyword e.g. "Foundation", "Structure"
    const newUrl = window.location.pathname + '?plan=' + encodeURIComponent(planKey);

    // Use replaceState twice to ensure Tawk.to's watcher detects the change
    history.replaceState(null, '', newUrl);

    // 3. Open the embedded Tawk.to chat widget on this page
    try {
        if (typeof Tawk_API !== 'undefined') {
            if (Tawk_API.setAttributes) {
                Tawk_API.setAttributes({ 'Interested_In': planName, 'Status': 'Pricing_Inquiry' }, function () { });
            }
            if (Tawk_API.maximize) Tawk_API.maximize();
        }
    } catch (e) { }

    // 4. Restore the original URL after 5 seconds (more time for trigger to fire)
    setTimeout(() => {
        // Only restore if the current URL still contains our plan parameter (to avoid overwriting new navigations)
        if (window.location.search.includes('plan=')) {
            history.replaceState(null, '', window.location.pathname);
        }
    }, 5000);
};

// ===== Quick Pick Logic (Global) =====
// ===== Quick Pick Logic (Global) =====
function initQuickPickLogic(container) {
    try {
        const qpContainer = container.querySelector('.quick-pickup-container');
        if (!qpContainer) return;

        const workTypeSelect = qpContainer.querySelector('#workTypeSelect');
        const interiorChecklist = qpContainer.querySelector('#interiorChecklist');
        const exteriorChecklist = qpContainer.querySelector('#exteriorChecklist');
        const conceptPlanMain = qpContainer.querySelector('#conceptPlanMain');
        const conceptPlanDetails = qpContainer.querySelector('#conceptPlanDetails');
        const contactForm = container.querySelector('#contactForm');

        // Helper to save all form data from the ENTIRE container using localStorage
        const saveAllData = () => {
            const data = {};
            const allInputs = container.querySelectorAll('input, select, textarea');

            allInputs.forEach(inp => {
                if (!inp.name) return; // Skip unnamed inputs

                if (inp.type === 'checkbox' || inp.type === 'radio') {
                    if (inp.checked) {
                        if (inp.name.endsWith('[]')) {
                            if (!data[inp.name]) data[inp.name] = [];
                            data[inp.name].push(inp.value);
                        } else {
                            data[inp.name] = inp.value;
                        }
                    } else if (inp.name.endsWith('[]') && !data[inp.name]) {
                        data[inp.name] = [];
                    }
                } else {
                    data[inp.name] = inp.value;
                }
            });

            // Persist to both memory and localStorage for maximum safety
            window.savedContactFormData = data;
            localStorage.setItem('aman_contact_form_data', JSON.stringify(data));

            // CRITICAL: Preserve actual File object in memory (since localStorage can't store Files)
            const fileInput = container.querySelector('input[type="file"]');
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                window._pendingBriefAttachment = fileInput.files[0];
            }
        };

        // Expose save function globally while the brief is open
        window._saveBriefData = saveAllData;

        // Helper to restore all form data
        const restoreAllData = () => {
            const stored = localStorage.getItem('aman_contact_form_data');
            const data = stored ? JSON.parse(stored) : window.savedContactFormData;

            // CRITICAL: Restore File object FIRST before triggering events
            const fileInput = container.querySelector('input[type="file"]');
            if (fileInput && window._pendingBriefAttachment) {
                try {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(window._pendingBriefAttachment);
                    fileInput.files = dataTransfer.files;
                    console.log("Restored attachment in restoreAllData:", window._pendingBriefAttachment.name);

                    // Update visual feedback if present
                    const label = fileInput.parentElement.querySelector('.file-name-label');
                    if (label) label.textContent = "Selected: " + window._pendingBriefAttachment.name;
                } catch (e) {
                    console.warn("Failed to restore attachment:", e);
                }
            }

            if (!data) return;

            Object.keys(data).forEach(key => {
                const elements = container.querySelectorAll(`[name="${key}"]`);
                const value = data[key];

                elements.forEach(el => {
                    if (el.type === 'checkbox' || el.type === 'radio') {
                        if (Array.isArray(value)) {
                            el.checked = value.includes(el.value);
                        } else {
                            el.checked = (el.value === value);
                        }
                    } else if (el.type !== 'file') {
                        el.value = value;
                    }

                    // Trigger events to update dynamic UI (but skip file inputs to avoid clearing)
                    if (el.type !== 'file') {
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        if (typeof el.onchange === 'function') {
                            el.onchange({ target: el });
                        }
                    }
                });
            });

            // Ensure sections are visible
            setTimeout(updateVisibility, 10);
        };

        // Helper to toggle input visibility
        const updateVisibility = () => {
            const otherItems = qpContainer.querySelectorAll('.qp-option-item.has-other');

            otherItems.forEach(item => {
                const input = item.querySelector('input[type="checkbox"], input[type="radio"]');
                const textInput = item.querySelector('.qp-other-input');

                if (input && textInput) {
                    if (input.checked) {
                        textInput.classList.add('active');
                        textInput.style.display = 'block';
                        // textInput.required = true; // Optional per user request
                    } else {
                        textInput.classList.remove('active');
                        textInput.style.display = 'none';
                        textInput.required = false;
                        textInput.value = '';
                    }
                }
            });

            // Handle Work Type Checklists
            if (workTypeSelect && interiorChecklist && exteriorChecklist) {
                const val = workTypeSelect.value;
                interiorChecklist.style.display = (val === 'Interior only' || val === 'Interior and Exterior both') ? 'block' : 'none';
                exteriorChecklist.style.display = (val === 'Exterior only' || val === 'Interior and Exterior both') ? 'block' : 'none';
            }

            // Handle Concept Plan Sub-Checklist
            if (conceptPlanMain && conceptPlanDetails) {
                conceptPlanDetails.style.display = conceptPlanMain.checked ? 'block' : 'none';
            }
        };

        // Attach listener to ALL inputs in the container
        const allInputs = container.querySelectorAll('input, select, textarea');
        allInputs.forEach(inp => {
            // Special handling for file input visual feedback
            if (inp.type === 'file') {
                inp.addEventListener('change', () => {
                    const label = inp.parentElement.querySelector('.file-name-label');
                    const progressContainer = document.getElementById('briefUploadProgressContainer');
                    const progressBar = document.getElementById('briefUploadProgressBar');
                    const progressStatus = document.getElementById('briefUploadStatus');

                    // Clear previous simulation if any
                    if (window._briefProgressInterval) {
                        clearInterval(window._briefProgressInterval);
                        window._briefProgressInterval = null;
                    }

                    if (inp.files.length > 0) {
                        const file = inp.files[0];

                        // Check size (10MB)
                        if (file.size > 10 * 1024 * 1024) {
                            alert("⚠️ File is too large! Max is 10MB. Please use the WeTransfer link below.");
                            inp.value = '';
                            if (label) label.textContent = "";
                            if (progressContainer) progressContainer.style.display = 'none';
                            return;
                        }

                        if (label) label.textContent = "Selected: " + file.name;

                        // Show "Immediate Progress" bar Simulation
                        if (progressContainer && progressBar && progressStatus) {
                            progressContainer.style.display = 'block';
                            progressStatus.style.display = 'block';
                            progressStatus.textContent = "⏱️ Uploading to local cache: 0%";
                            progressStatus.style.color = 'var(--text-muted)';
                            progressBar.style.width = '0%';

                            let p = 0;
                            window._briefProgressInterval = setInterval(() => {
                                // Fast at start, slower at end
                                const step = p < 70 ? 15 : 5;
                                p += Math.floor(Math.random() * step) + 5;

                                if (p >= 100) {
                                    p = 100;
                                    clearInterval(window._briefProgressInterval);
                                    progressStatus.textContent = "✅ File Ready for Submission";
                                    progressStatus.style.color = "#4ade80";
                                }
                                progressBar.style.width = p + '%';
                                if (p < 100) progressStatus.textContent = `⏱️ Uploading to local cache: ${p}%`;
                            }, 50);
                        }
                    } else {
                        if (label) label.textContent = "";
                        if (progressContainer) progressContainer.style.display = 'none';
                    }
                });
            }

            // Save on change
            inp.addEventListener('change', () => {
                updateVisibility();
                saveAllData();
            });

            // Save on input for real-time text backup
            if (inp.tagName === 'TEXTAREA' || (inp.tagName === 'INPUT' && (inp.type === 'text' || inp.type === 'email' || inp.type === 'tel'))) {
                inp.addEventListener('input', saveAllData);
            }

            // Save on click for checkboxes/radios
            if (inp.type === 'checkbox' || inp.type === 'radio') {
                inp.addEventListener('click', () => {
                    updateVisibility();
                    saveAllData();
                });
            }
        });

        // Initial setup
        restoreAllData();
        updateVisibility();
    } catch (err) {
        console.error("Error in Quick Pick Logic:", err);
    }
}

/**
 * Enhanced PDF Viewer Logic
 * Opens the PDF in a popup using an iframe
 */
window.openPDFPopup = function (url, title) {
    // Open the PDF viewer template
    openPopup('pdf-viewer');

    // Wait for the popup to render then inject source
    setTimeout(() => {
        const iframe = document.getElementById('pdf-iframe');
        const titleEl = document.getElementById('pdf-viewer-title');

        if (iframe) {
            // Updated to allow internal PDF controls (Zoom + -)
            // toolbar=1 shows the native bar, which we will shield selectively in HTML
            iframe.src = url + '#toolbar=1&navpanes=0&view=FitH&scrollbar=1';
        }
        if (titleEl) titleEl.textContent = title || 'PDF Document';
    }, 50);
};

// Global listener to disable right-click specifically when the PDF viewer is active
document.addEventListener('contextmenu', (e) => {
    // Check if the current visible popup is the PDF viewer
    const pdfViewer = document.getElementById('pdf-fullscreen-wrapper');
    if (pdfViewer && pdfViewer.offsetParent !== null) {
        // If the context menu is triggered over the PDF or its wrapper, block it
        if (e.target.closest('#pdf-fullscreen-wrapper') || e.target.id === 'popupOverlay') {
            e.preventDefault();
            return false;
        }
    }
}, true);

/**
 * Toggles fullscreen mode for the PDF wrapper
 */
window.toggleFullscreenPDF = function () {
    const wrapper = document.getElementById('pdf-fullscreen-wrapper');
    if (!wrapper) return;

    if (wrapper.requestFullscreen) {
        wrapper.requestFullscreen();
    } else if (wrapper.mozRequestFullScreen) { /* Firefox */
        wrapper.mozRequestFullScreen();
    } else if (wrapper.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        wrapper.webkitRequestFullscreen();
    } else if (wrapper.msRequestFullscreen) { /* IE/Edge */
        wrapper.msRequestFullscreen();
    }
};

/**
 * Exits fullscreen mode for the PDF
 */
window.exitFullscreenPDF = function () {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
};

// ===== 3D Modeling and Rendering Comparison Slider =====
function init3DComparisonSlider(container) {
    // Image paths from the local project directory
    const imagePaths = [
        'images/3d-comparison/0 B (1).webp',
        'images/3d-comparison/0 B (2).webp',
        'images/3d-comparison/0 B (3).webp',
        'images/3d-comparison/1.webp',
        'images/3d-comparison/112.webp',
        'images/3d-comparison/14.webp',
        'images/3d-comparison/15.webp',
        'images/3d-comparison/16.webp',
        'images/3d-comparison/17.webp',
        'images/3d-comparison/18.webp',
        'images/3d-comparison/2.webp',
        'images/3d-comparison/3.3.webp',
        'images/3d-comparison/4.1.webp',
        'images/3d-comparison/4.webp',
        'images/3d-comparison/8.webp',
        'images/3d-comparison/A (1.1).webp',
        'images/3d-comparison/A (4).webp',
        'images/3d-comparison/B. Stadium (6).webp',
        'images/3d-comparison/C (15).webp',
        'images/3d-comparison/C (17).webp',
        'images/3d-comparison/C (19).webp',
        'images/3d-comparison/C (25).webp',
        'images/3d-comparison/C (26).webp',
        'images/3d-comparison/C. Kitchen  (1).webp',
        'images/3d-comparison/C. Kitchen  (11).webp',
        'images/3d-comparison/C. Kitchen  (13).webp',
        'images/3d-comparison/C. Kitchen  (14).webp',
        'images/3d-comparison/C. Kitchen  (4).webp',
        'images/3d-comparison/C. Kitchen  (5).webp',
        'images/3d-comparison/C. Kitchen  (6).webp',
        'images/3d-comparison/cccccfinal.webp',
        'images/3d-comparison/D (2).webp',
        'images/3d-comparison/D (3).webp',
        'images/3d-comparison/DE.webp',
        'images/3d-comparison/E (2).webp',
        'images/3d-comparison/Enscape_2024-09-11-15-33-14.webp',
        'images/3d-comparison/F (2.8).webp',
        'images/3d-comparison/F (5).webp',
        'images/3d-comparison/F (6.1).webp',
        'images/3d-comparison/F. Comercial Market 9.webp',
        'images/3d-comparison/G. Kitchen (1).webp',
        'images/3d-comparison/H (2).webp',
        'images/3d-comparison/H (3).webp',
        'images/3d-comparison/H. Boxing Club  (1).webp',
        'images/3d-comparison/H. Boxing Club  (2).webp',
        'images/3d-comparison/H. Boxing Club  (6).webp',
        'images/3d-comparison/I. Sports Gym (14).webp',
        'images/3d-comparison/I. Sports Gym (15).webp',
        'images/3d-comparison/I. Sports Gym (16).webp',
        'images/3d-comparison/I. Sports Gym (3).webp',
        'images/3d-comparison/I. Sports Gym (4).webp',
        'images/3d-comparison/J (1).webp',
        'images/3d-comparison/J (2).webp',
        'images/3d-comparison/J (3).webp',
        'images/3d-comparison/J. Township (1).webp',
        'images/3d-comparison/J. Township (2).webp',
        'images/3d-comparison/K  (2).webp',
        'images/3d-comparison/K  (6).webp',
        'images/3d-comparison/K  (8).webp',
        'images/3d-comparison/L (1).webp',
        'images/3d-comparison/L (11).webp',
        'images/3d-comparison/L (2).webp',
        'images/3d-comparison/L (4).webp',
        'images/3d-comparison/L (6).webp',
        'images/3d-comparison/M (1).webp',
        'images/3d-comparison/Photos_t1Og1Oa9oi.webp'
    ];

    let currentIndex = 0;
    const baseImage = container.querySelector('.comparison-base-image');
    const overlayImage = container.querySelector('.comparison-overlay-image');
    const comparisonLine = container.querySelector('.comparison-line');
    const wrapper = container.querySelector('.comparison-wrapper');
    const prevBtn = container.querySelector('.prev-comparison');
    const nextBtn = container.querySelector('.next-comparison');
    const counter = container.querySelector('.comparison-counter');
    const total = container.querySelector('.comparison-total');

    if (!baseImage || !overlayImage || !comparisonLine || !wrapper) return;

    // Update total count
    if (total) total.textContent = imagePaths.length;

    // Function to load and display image
    function loadImage(index) {
        const imagePath = imagePaths[index];
        baseImage.style.backgroundImage = `url("${imagePath}")`;
        // Apply the modeling viewport style to the overlay
        if (typeof applyModellingStyle === 'function') {
            applyModellingStyle(imagePath);
        } else {
            overlayImage.style.backgroundImage = `url("${imagePath}")`;
        }
        if (counter) counter.textContent = index + 1;
    }

    // Navigation functions
    function showPrevious() {
        currentIndex = (currentIndex - 1 + imagePaths.length) % imagePaths.length;
        loadImage(currentIndex);
    }

    function showNext() {
        currentIndex = (currentIndex + 1) % imagePaths.length;
        loadImage(currentIndex);
    }

    // Event listeners for navigation
    if (prevBtn) prevBtn.addEventListener('click', showPrevious);
    if (nextBtn) nextBtn.addEventListener('click', showNext);

    // Keyboard navigation
    const handleKeyboard = (e) => {
        if (e.key === 'ArrowLeft') showPrevious();
        if (e.key === 'ArrowRight') showNext();
    };
    document.addEventListener('keydown', handleKeyboard);

    // Comparison line dragging functionality
    let isDragging = false;

    // Apply the "Safe Light Grey Style" effect
    function applyModellingStyle(imagePath) {
        // Guaranteed Light Grey look (Positive Image):
        // 1. Light Grey Base (#e0e0e0)
        // 2. Multiply Mode keeps details
        // 3. High Brightness (1.3) pushes blacks to grey
        // 4. Low Contrast (0.8) flattens the image tone
        overlayImage.style.backgroundColor = '#e0e0e0';
        overlayImage.style.backgroundImage = `url("${imagePath}")`;
        overlayImage.style.backgroundBlendMode = 'multiply';
        overlayImage.style.backgroundSize = 'cover';
        overlayImage.style.filter = 'grayscale(1) brightness(1.3) contrast(0.8)';
    }

    function updateComparison(clientX) {
        const rect = wrapper.getBoundingClientRect();
        let x = clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));

        const percentage = (x / rect.width) * 100;

        // Update line position
        comparisonLine.style.left = percentage + '%';

        // Update overlay width and clip-path
        overlayImage.style.width = percentage + '%';
        overlayImage.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
    }

    function startDrag(e) {
        isDragging = true;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        updateComparison(clientX);
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        updateComparison(clientX);
    }

    function stopDrag() {
        isDragging = false;
    }

    // Mouse events
    comparisonLine.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);

    // Touch events
    comparisonLine.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', stopDrag);

    // Click anywhere on wrapper to move comparison line
    wrapper.addEventListener('click', (e) => {
        if (e.target === wrapper || e.target === baseImage || e.target === overlayImage) {
            updateComparison(e.clientX);
        }
    });

    // Hover effects for navigation buttons
    [prevBtn, nextBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(210, 105, 30, 1)';
                btn.style.transform = 'translateY(-50%) scale(1.1)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(210, 105, 30, 0.9)';
                btn.style.transform = 'translateY(-50%) scale(1)';
            });
        }
    });

    // Load first image
    loadImage(0);

    // Grid View Toggle Logic
    window.toggleComparisonView = function () {
        const sliderView = container.querySelector('#comparison-slider-ui');
        const gridView = container.querySelector('#comparison-grid-view');
        const grid = container.querySelector('.comparison-render-grid');
        const toggleBtn = container.querySelector('#comparison-view-toggle');
        const toggleText = toggleBtn.querySelector('.toggle-text');
        const toggleIcon = toggleBtn.querySelector('.toggle-icon');

        if (!sliderView || !gridView || !grid) return;

        if (gridView.style.display === 'none') {
            // SWITCH TO GRID VIEW
            sliderView.style.display = 'none';
            gridView.style.display = 'block';
            if (toggleText) toggleText.textContent = 'Slider';
            if (toggleIcon) {
                toggleIcon.innerHTML = `
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <polyline points="5 9 2 12 5 15"></polyline>
                        <polyline points="19 9 22 12 19 15"></polyline>
                    </svg>
                `;
            }

            // Populate Grid only if needed
            if (grid.children.length === 0) {
                imagePaths.forEach((path, idx) => {
                    const imgWrapper = document.createElement('div');
                    imgWrapper.style.cssText = `
                        position: relative;
                        overflow: hidden;
                        border-radius: 12px;
                        aspect-ratio: 16/9;
                        background: #000;
                        border: 1px solid rgba(255,140,0,0.2);
                        cursor: pointer;
                        transition: all 0.3s ease;
                    `;

                    const img = document.createElement('img');
                    img.src = path;
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;';

                    imgWrapper.appendChild(img);

                    // Add "View in Slider" hover overlay
                    const overlay = document.createElement('div');
                    overlay.style.cssText = `
                        position: absolute;
                        inset: 0;
                        background: rgba(210, 105, 30, 0.4);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        opacity: 0;
                        transition: opacity 0.3s ease;
                        color: white;
                        font-family: 'Raleway', sans-serif;
                        font-weight: 600;
                        font-size: 12px;
                    `;
                    overlay.innerHTML = 'VIEW IN SLIDER';
                    imgWrapper.appendChild(overlay);

                    imgWrapper.onmouseenter = () => {
                        imgWrapper.style.transform = 'translateY(-5px)';
                        imgWrapper.style.boxShadow = '0 10px 25px rgba(210, 105, 30, 0.3)';
                        imgWrapper.style.borderColor = 'var(--primary-orange)';
                        img.style.transform = 'scale(1.1)';
                        overlay.style.opacity = '1';
                    };
                    imgWrapper.onmouseleave = () => {
                        imgWrapper.style.transform = 'translateY(0)';
                        imgWrapper.style.boxShadow = 'none';
                        imgWrapper.style.borderColor = 'rgba(255,140,0,0.2)';
                        img.style.transform = 'scale(1)';
                        overlay.style.opacity = '0';
                    };

                    imgWrapper.onclick = () => {
                        currentIndex = idx;
                        loadImage(currentIndex);
                        window.toggleComparisonView();
                    };

                    grid.appendChild(imgWrapper);
                });
            }
        } else {
            // SWITCH BACK TO SLIDER VIEW
            sliderView.style.display = 'block';
            gridView.style.display = 'none';
            if (toggleText) toggleText.textContent = 'Grid';
            if (toggleIcon) {
                toggleIcon.innerHTML = `
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                `;
            }
        }
    };

    // Cleanup function when popup closes
    window.addEventListener('popupClosed', () => {
        document.removeEventListener('keydown', handleKeyboard);
        // Reset view to slider for next time
        if (typeof window.toggleComparisonView === 'function' && container.querySelector('#comparison-grid-view')?.style.display === 'block') {
            // we don't call it here to avoid logic flashes, openPopup logic naturally resets popups usually 
        }
        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    });
}

// ===== Fullscreen Functions for Comparison Slider =====
function toggleComparisonFullscreen() {
    const container = document.querySelector('.comparison-slider-container');
    const wrapper = document.querySelector('.comparison-wrapper');
    const gridView = document.querySelector('#comparison-grid-view');
    const toggleBtn = document.querySelector('#comparison-view-toggle');
    const closeBtn = document.querySelector('.comparison-close-btn');
    const fullscreenBtn = document.querySelector('.comparison-fullscreen-btn');

    if (!container) return;

    if (!document.fullscreenElement) {
        // Enter fullscreen
        container.requestFullscreen().then(() => {
            container.style.maxWidth = 'none';
            container.style.height = '100vh';
            container.style.backgroundColor = '#000';
            container.style.padding = '20px';

            if (wrapper) {
                wrapper.style.height = 'calc(100vh - 140px)';
                wrapper.style.borderRadius = '0';
            }
            if (gridView) {
                gridView.style.height = 'calc(100vh - 140px)';
                gridView.style.borderRadius = '0';
            }
            if (toggleBtn) {
                toggleBtn.style.right = '20px';
            }
            if (closeBtn) {
                closeBtn.style.display = 'flex';
                closeBtn.style.right = '20px';
                closeBtn.style.top = '20px';
            }
            if (fullscreenBtn) fullscreenBtn.style.display = 'none';
        }).catch(err => {
            console.log('Error entering fullscreen:', err);
        });
    } else {
        exitComparisonFullscreen();
    }
}

function exitComparisonFullscreen() {
    const container = document.querySelector('.comparison-slider-container');
    const wrapper = document.querySelector('.comparison-wrapper');
    const gridView = document.querySelector('#comparison-grid-view');
    const toggleBtn = document.querySelector('#comparison-view-toggle');
    const closeBtn = document.querySelector('.comparison-close-btn');
    const fullscreenBtn = document.querySelector('.comparison-fullscreen-btn');

    if (document.fullscreenElement) {
        document.exitFullscreen().then(() => {
            if (container) {
                container.style.maxWidth = '1400px';
                container.style.height = 'auto';
                container.style.backgroundColor = 'transparent';
                container.style.padding = '0';
            }
            if (wrapper) {
                wrapper.style.height = '600px';
                wrapper.style.borderRadius = '16px';
            }
            if (gridView) {
                gridView.style.height = '600px';
                gridView.style.borderRadius = '16px';
            }
            if (toggleBtn) {
                toggleBtn.style.right = '-50px';
            }
            if (closeBtn) {
                closeBtn.style.display = 'none';
                closeBtn.style.right = '20px';
                closeBtn.style.top = '20px';
            }
            if (fullscreenBtn) {
                fullscreenBtn.style.display = 'flex';
                fullscreenBtn.style.right = '-50px';
            }
        });
    }
}

// Listen for fullscreen changes (e.g., ESC key pressed)
document.addEventListener('fullscreenchange', () => {
    const container = document.querySelector('.comparison-slider-container');
    const wrapper = document.querySelector('.comparison-wrapper');
    const gridView = document.querySelector('#comparison-grid-view');
    const toggleBtn = document.querySelector('#comparison-view-toggle');
    const closeBtn = document.querySelector('.comparison-close-btn');
    const fullscreenBtn = document.querySelector('.comparison-fullscreen-btn');

    if (!document.fullscreenElement) {
        // Exited fullscreen
        if (container) {
            container.style.maxWidth = '1400px';
            container.style.height = 'auto';
            container.style.backgroundColor = 'transparent';
            container.style.padding = '0';
        }
        if (wrapper) {
            wrapper.style.height = '600px';
            wrapper.style.borderRadius = '16px';
        }
        if (gridView) {
            gridView.style.height = '600px';
            gridView.style.borderRadius = '16px';
        }
        if (toggleBtn) {
            toggleBtn.style.right = '-50px';
        }
        if (closeBtn) {
            closeBtn.style.display = 'none';
        }
        if (fullscreenBtn) {
            fullscreenBtn.style.display = 'flex';
            fullscreenBtn.style.right = '-50px';
        }
    }
});


// ===== Feedback Form Handler =====
document.addEventListener('DOMContentLoaded', () => {
    // Wait for form to be loaded in popup
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-popup="feedback"]') || e.target.closest('button[onclick*="feedback"]')) {
            setTimeout(initFeedbackForm, 500);
        }
    });
});

function initFeedbackForm() {
    const form = document.getElementById('feedback-form');
    if (!form || form.dataset.initialized) return;

    form.dataset.initialized = 'true';
    form.addEventListener('submit', handleFeedbackSubmit);
}

function handleFeedbackSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const formContainer = form.parentElement;
    const thankYouDiv = document.getElementById('feedback-thank-you');
    const reviewLink = document.getElementById('feedback-review-link');
    const submitBtn = document.getElementById('feedback-submit-btn');

    // MAPPING FIX: fb-project (Visible) is the ID, fb-pid (Hidden) is the Name
    const projectID = document.getElementById('fb-project')?.value || 'N/A';
    const projectName = document.getElementById('fb-pid')?.value || 'General Feedback';
    const clientName = document.getElementById('fb-client')?.value || 'Website Visitor';
    const rating = form.querySelector('input[name="rating"]:checked')?.value || 'Not rated';
    const message = document.getElementById('feedback-msg')?.value || '';

    // Build feedback message
    const ratingEmojis = {
        '5': '😍',
        '4': '🙂',
        '3': '😐',
        '2': '🙁',
        '1': '😠'
    };

    const feedbackMessage = `
📝 NEW FEEDBACK RECEIVED

👤 Client: ${clientName}
🆔 ID: ${projectID}
📋 Project: ${projectName}
⭐ Rating: ${ratingEmojis[rating] || rating}/5

💬 Message:
${message}

---
Sent via Website Feedback Form
`;

    // Show loading state on button
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Submitting <span class="anim-dot">.</span><span class="anim-dot dot-2">.</span><span class="anim-dot dot-3">.</span>';
    }

    // Prepare data for Google Sheets
    const feedbackData = {
        projectID: projectID,
        projectName: projectName,
        clientName: clientName,
        rating: rating,
        message: message
    };

    // Send to Google Sheets
    fetch(TRACKER_SYNC_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'submitFeedback',
            feedback: feedbackData
        })
    }).catch(err => console.error("Feedback Sheet Sync failed:", err));

    // SAVE TO LOCAL FEEDBACK (Dynamic UI Update)
    try {
        const stored = JSON.parse(localStorage.getItem('user_feedback_list') || '[]');
        stored.unshift({
            name: clientName,
            project: projectName,
            rating: rating,
            message: message,
            date: new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        });
        localStorage.setItem('user_feedback_list', JSON.stringify(stored.slice(0, 10))); // Keep last 10
    } catch (e) { console.error("Local Feedback Save Fail", e); }

    // Send via Tawk.to chat (hidden)
    if (window.Tawk_API && window.Tawk_API.addEvent) {
        window.Tawk_API.addEvent('Feedback Submission', {
            client: clientName,
            project: projectName,
            rating: rating,
            message: message
        }, function (error) {
            if (error) {
                console.log('Tawk error:', error);
            }
        });
    }

    // Send as hidden message to chat
    if (window.Tawk_API && window.Tawk_API.sendChatMessage) {
        window.Tawk_API.sendChatMessage(feedbackMessage, function (error) {
            if (error) {
                console.log('Chat message error:', error);
            }
        });
    }

    // Show thank you message (with a small delay for aesthetic)
    setTimeout(() => {
        if (thankYouDiv && formContainer) {
            // Hide form inputs
            Array.from(form.elements).forEach(el => {
                if (el.type !== 'hidden') {
                    el.style.display = 'none';
                }
            });

            // Hide submit button and review link
            if (submitBtn) submitBtn.style.display = 'none';
            if (reviewLink) reviewLink.style.display = 'none';

            // Show thank you message
            thankYouDiv.style.display = 'block';

            // Auto-close popup after 4 seconds
            setTimeout(() => {
                const closeBtn = document.querySelector('.popup-overlay.active .popup-close');
                if (closeBtn) closeBtn.click();

                // Reset form after closing
                setTimeout(() => {
                    form.reset();
                    Array.from(form.elements).forEach(el => {
                        if (el.type !== 'hidden') {
                            el.style.display = '';
                        }
                    });
                    if (submitBtn) {
                        submitBtn.style.display = '';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit Feedback';
                    }
                    if (reviewLink) reviewLink.style.display = '';
                    thankYouDiv.style.display = 'none';
                }, 500);
            }, 4000);
        }
    }, 800);

    return false;
}

// ===== Live Render Feedback from Google Sheets =====
async function renderAutoReviews() {
    const container = document.getElementById('auto-reviews-container');
    if (!container) return;

    // Show loading state
    container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 14px;">
            Reviews are loading<span class="anim-dot">.</span><span class="anim-dot dot-2">.</span><span class="anim-dot dot-3">.</span>
        </div>
    `;

    try {
        const response = await fetch(`${TRACKER_SYNC_URL}?action=getFeedback`);
        const res = await response.json();

        if (res.status === "success" && res.data && res.data.length > 0) {
            let html = '';
            res.data.forEach(fb => {
                const initial = (fb.clientName || '?').charAt(0).toUpperCase();
                const stars = '⭐'.repeat(parseInt(fb.rating) || 5);

                // Format Date
                let dateStr = fb.timestamp;
                try {
                    const d = new Date(fb.timestamp);
                    if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                    }
                } catch (e) { }

                html += `
                    <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; animation: fadeIn 0.5s ease;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 45px; height: 45px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-orange), #ff8c42); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; color: #fff;">
                                    ${initial}
                                </div>
                                <div>
                                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 3px;">${fb.clientName}</div>
                                    <div style="color: var(--primary-green); font-size: 12px;">${stars}</div>
                                </div>
                            </div>
                            <div style="font-size: 11px; color: var(--text-muted);">${dateStr}</div>
                        </div>
                        <p style="margin: 0; font-size: 13px; line-height: 1.6; color: var(--text-light);">
                            "${fb.message}"
                        </p>
                    </div>
                `;
            });
            container.innerHTML = html;
        } else {
            container.innerHTML = ''; // No live feedback yet
        }
    } catch (e) {
        console.error("Live Feedback Fetch Fail", e);
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 20px;">Live reviews offline. Showing static reviews only.</div>';
    }
}

// ===== Open Feedback From Tracker (Auto-Fill) =====
function openFeedbackFromTracker() {
    // Get tracker data
    const clientName = document.getElementById('trk-client')?.textContent?.trim() || '';
    const projectId = document.getElementById('trk-id')?.textContent?.trim() || '';
    const projectName = document.getElementById('trk-project')?.textContent?.trim() || '';
    const phase = document.getElementById('trk-phase')?.textContent?.trim() || '';
    const cost = document.getElementById('trk-cost')?.textContent?.trim() || '';
    const date = document.getElementById('trk-date')?.textContent?.trim() || '';
    const statusTitle = document.getElementById('trk-status-title')?.textContent?.trim() || '';
    const statusSubtitle = document.getElementById('trk-status-subtitle')?.textContent?.trim() || '';

    // Save ALL tracker fields to sessionStorage to preserve them
    if (clientName && clientName !== '...') sessionStorage.setItem('temp_tracker_client', clientName);
    if (projectId && projectId !== '...') sessionStorage.setItem('temp_tracker_project', projectId);
    if (projectName && projectName !== '...') sessionStorage.setItem('temp_tracker_projectname', projectName);
    if (phase && phase !== '...') sessionStorage.setItem('temp_tracker_phase', phase);
    if (cost && cost !== '...') sessionStorage.setItem('temp_tracker_cost', cost);
    if (date && date !== '...') sessionStorage.setItem('temp_tracker_date', date);
    if (statusTitle && statusTitle !== '...') sessionStorage.setItem('temp_tracker_statustitle', statusTitle);
    if (statusSubtitle && statusSubtitle !== '...') sessionStorage.setItem('temp_tracker_statussubtitle', statusSubtitle);

    // Open the feedback popup
    openPopup('feedback');

    // Wait for popup to be opened and rendered
    setTimeout(() => {
        // Reset form to ensure it's visible (only if thank you is showing)
        const formReset = document.getElementById('feedback-form');
        const thankYouReset = document.getElementById('feedback-thank-you');
        const reviewLinkReset = document.getElementById('feedback-review-link');
        const submitBtnReset = document.getElementById('feedback-submit-btn');

        // Only reset if form was submitted (thank you message is visible)
        if (thankYouReset && thankYouReset.style.display === 'block') {
            if (formReset) {
                Array.from(formReset.elements).forEach(el => {
                    if (el.type !== 'hidden') el.style.display = '';
                });
                if (submitBtnReset) submitBtnReset.style.display = '';
                if (reviewLinkReset) reviewLinkReset.style.display = '';
                thankYouReset.style.display = 'none';
            }
        }

        // Auto-fill the form fields
        const fbClient = document.getElementById('fb-client');
        const fbProject = document.getElementById('fb-project');
        const fbPid = document.getElementById('fb-pid');

        if (fbClient && clientName && clientName !== '...') {
            fbClient.value = clientName;
        }

        // Project Number (Visible Field) -> ID
        if (fbProject && projectId && projectId !== '...') {
            fbProject.value = projectId;
        }

        // Project Name (Hidden Field) -> Name
        if (fbPid && projectName && projectName !== '...') {
            fbPid.value = projectName;
        }

        // Initialize form if not already done
        initFeedbackForm();
    }, 300);
}

// Preserve tracker data when popup closes
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('popup-close') || e.target.closest('.popup-close') || e.target.classList.contains('popup-overlay')) {
        // Immediately restore tracker data
        restoreAllTrackerData();
        // Also restore after a brief delay to catch any async clears
        setTimeout(restoreAllTrackerData, 50);
        setTimeout(restoreAllTrackerData, 200);
    }
});

// Restore all tracker form data
function restoreAllTrackerData() {
    const savedClient = sessionStorage.getItem('temp_tracker_client');
    const savedProject = sessionStorage.getItem('temp_tracker_project');
    const savedProjectName = sessionStorage.getItem('temp_tracker_projectname');
    const savedPhase = sessionStorage.getItem('temp_tracker_phase');
    const savedCost = sessionStorage.getItem('temp_tracker_cost');
    const savedDate = sessionStorage.getItem('temp_tracker_date');
    const savedStatusTitle = sessionStorage.getItem('temp_tracker_statustitle');
    const savedStatusSubtitle = sessionStorage.getItem('temp_tracker_statussubtitle');

    const trkClient = document.getElementById('trk-client');
    const trkId = document.getElementById('trk-id');
    const trkProject = document.getElementById('trk-project');
    const trkPhase = document.getElementById('trk-phase');
    const trkCost = document.getElementById('trk-cost');
    const trkDate = document.getElementById('trk-date');
    const trkStatusTitle = document.getElementById('trk-status-title');
    const trkStatusSubtitle = document.getElementById('trk-status-subtitle');

    // Restore each field if it's empty or "..."
    if (trkClient && savedClient && (trkClient.textContent.trim() === '...' || trkClient.textContent.trim() === '' || trkClient.textContent.trim() === 'null')) {
        trkClient.textContent = savedClient;
    }

    if (trkId && savedProject && (trkId.textContent.trim() === '...' || trkId.textContent.trim() === '' || trkId.textContent.trim() === 'null')) {
        trkId.textContent = savedProject;
    }

    if (trkProject && savedProjectName && (trkProject.textContent.trim() === '...' || trkProject.textContent.trim() === '' || trkProject.textContent.trim() === 'null')) {
        trkProject.textContent = savedProjectName;
    }

    if (trkPhase && savedPhase && (trkPhase.textContent.trim() === '...' || trkPhase.textContent.trim() === '' || trkPhase.textContent.trim() === 'null')) {
        trkPhase.textContent = savedPhase;
    }

    if (trkCost && savedCost && (trkCost.textContent.trim() === '...' || trkCost.textContent.trim() === '' || trkCost.textContent.trim() === 'null')) {
        trkCost.textContent = savedCost;
    }

    if (trkDate && savedDate && (trkDate.textContent.trim() === '...' || trkDate.textContent.trim() === '' || trkDate.textContent.trim() === 'null')) {
        trkDate.textContent = savedDate;
    }

    if (trkStatusTitle && savedStatusTitle && (trkStatusTitle.textContent.trim() === '...' || trkStatusTitle.textContent.trim() === '' || trkStatusTitle.textContent.trim() === 'null')) {
        trkStatusTitle.textContent = savedStatusTitle;
    }

    if (trkStatusSubtitle && savedStatusSubtitle && (trkStatusSubtitle.textContent.trim() === '...' || trkStatusSubtitle.textContent.trim() === '' || trkStatusSubtitle.textContent.trim() === 'null')) {
        trkStatusSubtitle.textContent = savedStatusSubtitle;
    }
}

// === Global Right-Click Protection (High Priority) ===
(function () {
    const blockContextMenu = (e) => {
        // Find if any parent has our protection classes or if it's a direct iframe/video touch
        const path = e.composedPath ? e.composedPath() : [];
        const isProtected = path.some(el =>
            el.classList && (
                el.classList.contains('plyr') ||
                el.classList.contains('video-protection-shield') ||
                el.classList.contains('intro-video-embed') ||
                el.classList.contains('youtube-embed') ||
                el.classList.contains('playlist-container')
            )
        ) || e.target.tagName === 'IFRAME' || e.target.tagName === 'VIDEO';

        if (isProtected) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    };
    // Capture phase (true) intercepts event before it can reach the internal iframe context
    window.addEventListener('contextmenu', blockContextMenu, true);
})();

// === Plyr Initialization (Custom YouTube-like) ===
window.initPlyr = function (container = document) {
    if (typeof Plyr === 'undefined') return;

    const players = Array.from(container.querySelectorAll('.js-player')).map(p => {
        if (p.plyr) return p.plyr;

        const isIntro = p.classList.contains('js-intro-player');
        const config = {
            controls: ['play-large', 'play', 'mute', 'volume'],
            seekTime: 5,
            youtube: { noCookie: true, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1 },
            tooltips: { controls: false, seek: false },
            displayDuration: false,
            invertTime: false,
            quality: { default: 1080, options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240] }
        };

        if (isIntro) config.controls.push('pip');

        try {
            const player = new Plyr(p, config);
            p.plyr = player;

            if (isIntro) {
                window.introPlayer = player;
            }

            return player;
        } catch (e) {
            console.error('Plyr init failed:', e);
            return null;
        }
    });

    players.forEach(player => {
        if (!player || !player.elements || !player.elements.container) return;
        const plyrContainer = player.elements.container;

        const shield = plyrContainer.closest('.intro-video-embed, .youtube-embed, .playlist-container, .video-gallery-item')?.querySelector('.video-protection-shield');

        if (shield) {
            shield.style.cursor = 'pointer';
            shield.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (player.playing) player.pause();
                else player.play();
                return false;
            };
        }

        player.on('ready', event => {
            const container = event.detail.plyr.elements.container;
            if (!container) return;
            container.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
        });
    });
};

// Consistently initialized in main DOMContentLoaded in header

// ==========================================
// Panda Animation Showcase Sequence
// ==========================================
function initPandaShowcase() {
    const pandaContainer = document.getElementById('panda-showcase-container');
    const pandaChar = document.getElementById('panda-character');
    const pandaImg = document.getElementById('panda-img');
    const pandaSignboard = document.getElementById('panda-signboard');
    const textContainer = document.getElementById('signboard-text-container');
    if (!pandaContainer || !pandaChar || !pandaImg || !pandaSignboard || !textContainer) return;

    // Default state: Always Locked on page load unless specifically unlocked in localStorage
    window.pandaLocked = localStorage.getItem('pandaLocked') !== 'false';
    pandaChar.style.cursor = window.pandaLocked ? 'default' : 'move';

    let lastPandaRightClick = 0;
    const pandaDoubleClickThreshold = 500; // ms

    pandaContainer.addEventListener('contextmenu', (e) => {
        const now = Date.now();
        if (now - lastPandaRightClick < pandaDoubleClickThreshold) {
            e.preventDefault(); // Prevent context menu
            window.pandaLocked = !window.pandaLocked;

            // Save state
            localStorage.setItem('pandaLocked', window.pandaLocked);

            // Update UI cursor
            pandaChar.style.cursor = window.pandaLocked ? 'default' : 'move';

            // Visual feedback
            if (window.pandaLocked) {
                pandaContainer.style.filter = 'none';
            } else {
                pandaContainer.style.filter = 'drop-shadow(0 0 15px rgba(210, 105, 30, 0.4))';
            }
        } else {
            e.preventDefault();
        }
        lastPandaRightClick = now;
    });

    const phrases = [
        { main: "✓ 4K Ultra HD Walkthroughs", sub: "Stunning, lifelike environments with exceptional detail." },
        { main: "✓ AI Enhanced Rendering", sub: "Optimized visuals powered by cutting edge AI." },
        { main: "✓ 360° VR Rendering", sub: "Immersive, interactive virtual spaces with panoramic views." },
        { main: "✓ Interactive Walkthroughs", sub: "Control your experience online or offline with keyboard and mouse navigation." },
        { main: "✓ 2D and 3D Interior and Exterior Design", sub: "Precise modeling and realistic rendering for interiors and exteriors." },
        { main: "✓ 3D Walkthroughs and Animations", sub: "Engaging animations that bring spaces to life." },
        { main: "✓ Landscape and Environment Design", sub: "Realistic 3D landscapes and natural environments." },
        { main: "✓ 3D Floor Plans and Birds eye Views", sub: "Detailed views from all angles." },
        { main: "✓ Realistic 3D Visualization", sub: "Turning concepts into vivid, realistic environments." },
        { main: "✓ Expertise You Can Trust", sub: "700+ successfully completed projects in diverse categories." },
        { main: "✓ Versatile Portfolio", sub: "From homes and apartments to airports and data centers, I've got you covered." },
        { main: "✓ Fast Turnaround", sub: "Whether it's a long-term project or a tight deadline, I deliver results." },
        { main: "✓ Proposal & Presentations", sub: "Clear and professional proposals that communicate ideas effectively." },
        { main: "✓ Permit Layouts", sub: "Accurate layouts prepared to meet approval requirements." },
        { main: "✓ Concept Plans", sub: "Creative and functional plans tailored to project needs." },
        { main: "✓ Real Time Project Tracking", sub: "Daily updates with the latest files shared at every stage." }
    ];

    let currentServiceIndex = 0;
    let pandaLoopCount = 0;

    // Function to render a single service in the signboard
    function renderService(index) {
        const phrase = phrases[index];
        // Only apply tighter margins for the specific long phrases that overlap the border
        const needsAdjustment = [3, 4, 5, 6].includes(index);
        const paddingTop = needsAdjustment ? '8px' : '0px';
        const dotsStyle = needsAdjustment
            ? 'margin-top: 5px; transform: translateY(-5px);'
            : 'margin-top: 15px; transform: translateY(0);';

        textContainer.innerHTML = `
            <div class="sign-point active" style="border: none; margin-bottom: 0; padding-top: ${paddingTop};">
                <div style="text-align: center; margin-bottom: 8px; padding: 0 10px;">
                    <div style="color: var(--primary-orange); font-weight: 700; font-size: 13px; line-height: 1.4; text-transform: uppercase; display: inline;">
                        <span style="font-size: 15px; margin-right: 2px;">${phrase.main.charAt(0)}</span> ${phrase.main.slice(2)}
                    </div>
                </div>
                <div class="sign-subtitle" style="font-size: 11.5px; margin-top: 8px; color: #ffffff; text-align: center; padding: 0 15px; line-height: 1.4;">${phrase.sub}</div>
                <div style="${dotsStyle} display: flex; justify-content: center; gap: 6px;">
                    ${phrases.map((_, idx) => `<div onclick="if(window.jumpToPandaSlide) window.jumpToPandaSlide(${idx});" style="width: 8px; height: 8px; border-radius: 50%; cursor: pointer; transition: background 0.3s, transform 0.2s; background: ${idx === index ? 'var(--primary-orange)' : (idx < index ? '#10b981' : '#e5e7eb')}" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></div>`).join('')}
                </div>
            </div>
        `;
    }

    // Sequence Choreography using the images
    function runPandaSequence() {
        // Setup initial styles overrides
        pandaChar.style.transition = "all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        pandaSignboard.style.top = "25%"; // Move signboard up 
        pandaSignboard.style.left = "65%"; // Shift right 
        pandaSignboard.style.width = "270px";

        // 1. Emerging (pops up) - Initial position Left
        pandaImg.src = "images/panda-character.webp";
        pandaImg.style.width = "100px"; // Reset width from loop
        pandaChar.style.width = "auto"; // Reset width from loop
        pandaChar.style.display = "block"; // Reset from flex
        pandaChar.style.top = "auto";
        pandaChar.style.right = "20px";
        pandaChar.style.left = "auto";
        pandaChar.style.bottom = "0px";
        pandaChar.style.transform = "translateY(150px) scale(1.05)"; // 20% bigger than 0.85
        pandaChar.style.opacity = "0";

        // trigger reflow
        void pandaChar.offsetWidth;

        pandaChar.style.transform = "translateY(-40px) scale(1.05)"; // 20% bigger than 0.85
        pandaChar.style.opacity = "1";

        // 2. Sitting & Waving
        setTimeout(() => {
            pandaImg.classList.add('panda-img-wave');
        }, 1500);

        // 3. Handshake - Sliding in
        setTimeout(() => {
            pandaImg.classList.remove('panda-img-wave');
            pandaImg.src = "images/panda-handshake.webp";

            // Snap position, then animate in
            pandaChar.style.transition = "none";
            pandaChar.style.top = "auto";
            pandaChar.style.left = "auto";
            pandaChar.style.right = "20px";
            pandaChar.style.bottom = "0px";
            pandaChar.style.transform = "translateX(200px) scale(1.05)"; // 20% bigger than 0.85
            pandaChar.style.opacity = "0";

            // trigger reflow
            void pandaChar.offsetWidth;

            pandaChar.style.transition = "all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
            pandaChar.style.transform = "translate(-60px, -66px) scale(1.35)"; // Nudged up another 10% from -54px
            pandaChar.style.opacity = "1";

            pandaImg.classList.add('panda-img-bounce');
        }, 3000);

        // 4. Hiding
        setTimeout(() => {
            pandaChar.style.opacity = "0";
            pandaChar.style.transform = "translateY(150px) scale(1.35)"; // Dropping down with consistent handshake scale
            pandaImg.classList.remove('panda-img-bounce');
        }, 5500);

        // 5. Signboard Loop
        setTimeout(() => {
            // Swap to signboard panda BEFORE coming up
            pandaImg.src = "images/panda-signboard.webp";
            pandaImg.style.width = "100%";
            pandaImg.style.height = "auto"; // Auto height for correct aspect ratio in fixed widget
            pandaImg.style.objectFit = "contain";

            // Setup position - Signboard over the belly
            pandaSignboard.style.transition = "all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
            pandaSignboard.style.top = "65%";
            pandaSignboard.style.left = "50%";
            pandaSignboard.style.width = "250px";
            pandaSignboard.style.transform = "translate(-50%, -50%) scale(0.85)"; // Hidden low (scaled down)

            // Setup position - Panda centered, Full Height to overlap top and bottom
            pandaChar.style.transition = "none";
            pandaChar.style.top = "auto";
            pandaChar.style.bottom = "-20px";
            pandaChar.style.height = "auto";
            pandaChar.style.width = "100%";
            pandaChar.style.left = "0px";
            pandaChar.style.right = "0px";
            pandaChar.style.display = "flex";
            pandaChar.style.justifyContent = "center";
            pandaChar.style.alignItems = "center";
            pandaChar.style.transform = "translateY(150px) scale(0.85)"; // Unified scale
            pandaChar.style.opacity = "0";

            // trigger reflow
            void pandaChar.offsetWidth;

            pandaChar.style.transition = "all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)";

            let isHovered = false;

            pandaContainer.addEventListener('mouseenter', () => {
                isHovered = true;
            });

            pandaContainer.addEventListener('mouseleave', () => {
                isHovered = false;
            });

            function cycleServices() {
                // Slide up from bottom
                pandaChar.style.transform = "translateY(0%) scale(0.85)"; // Unified scale
                pandaChar.style.opacity = "1";

                pandaChar.classList.add('panda-img-bounce');

                // Update text
                renderService(currentServiceIndex);

                // Show signboard box (Animated in place)
                setTimeout(() => {
                    pandaSignboard.style.opacity = "1";
                    pandaSignboard.style.transform = "translate(-50%, -50%) scale(1)"; // Sitting on belly
                    pandaSignboard.style.pointerEvents = "auto";
                }, 400);

                // Wait 8.5s then hide, but pause timer if hovered
                let elapsed = 0;
                const checkInterval = 200;
                const displayDuration = 8500;
                let checkTimerId;
                let isInterrupting = false;

                function checkTime() {
                    if (isInterrupting) return;
                    if (!isHovered) {
                        elapsed += checkInterval;
                    }
                    if (elapsed >= displayDuration) {
                        hideAndNext();
                    } else {
                        checkTimerId = setTimeout(checkTime, checkInterval);
                    }
                }
                checkTimerId = setTimeout(checkTime, checkInterval);

                // Global jump hook for pagination dots
                window.jumpToPandaSlide = function (idx) {
                    if (isInterrupting || idx === currentServiceIndex) return;
                    isInterrupting = true;
                    clearTimeout(checkTimerId);

                    // Manually assign index 1 step backward since hideAndNext() instantly increments it forward
                    currentServiceIndex = idx - 1;
                    hideAndNext();
                };

                function hideAndNext() {
                    // Pop board down and fade
                    pandaSignboard.style.opacity = "0";
                    pandaSignboard.style.transform = "translate(-50%, -50%) scale(0.85)";
                    pandaSignboard.style.pointerEvents = "none";

                    // Slide panda down and fade
                    pandaChar.style.transform = "translateY(150px) scale(0.85)";
                    pandaChar.style.opacity = "0";

                    pandaChar.classList.remove('panda-img-bounce');

                    // Increment and loop
                    currentServiceIndex++;
                    if (currentServiceIndex >= phrases.length) {
                        currentServiceIndex = 0; // Loop back around
                        pandaLoopCount++;
                        // If loop count is 1, 3... we just finished a LEFT loop, so exit LEFT and enter RIGHT
                        const exitedLeft = pandaLoopCount % 2 !== 0;

                        // Wait for signboard to fully hide (800ms), then do an overarching slide transition
                        setTimeout(() => {
                            const exitTransform = exitedLeft ? "translateX(-100vw)" : "translateX(100vw)";
                            const enterTransform = exitedLeft ? "translateX(100vw)" : "translateX(-100vw)";
                            const targetTransform = exitedLeft ? "translateX(584px)" : "translateX(0)";

                            pandaContainer.style.transition = "transform 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
                            pandaContainer.style.transform = exitTransform;

                            setTimeout(() => {
                                // Teleport to the opposite edge
                                pandaContainer.style.transition = "none";
                                pandaContainer.style.transform = enterTransform;

                                // Reset internal panda visuals for a fresh start
                                pandaChar.style.transition = "none";
                                pandaChar.style.opacity = "0";
                                pandaChar.style.transform = "translateY(150px) scale(0.85)"; // Reset state
                                pandaImg.src = "images/panda-character.webp";

                                setTimeout(() => {
                                    // Slide back to the alternating origin point depending on the loop
                                    pandaContainer.style.transition = "transform 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
                                    pandaContainer.style.transform = targetTransform;

                                    setTimeout(() => {
                                        runPandaSequence();
                                    }, 1500); // Start the animation sequences again once returned to center
                                }, 50);
                            }, 1500); // Wait for the slide out to finish
                        }, 800);
                        return; // Halt inner cycle to restart outer sequence
                    }

                    // Recursively call for next service after hiding completely (800ms)
                    setTimeout(() => {
                        cycleServices();
                    }, 800);
                }
            }

            cycleServices();

        }, 6500); // Trigger board shortly after panda disappears

    }

    setTimeout(() => {
        runPandaSequence();
    }, 3000); // Wait 3 seconds after page load before starting
}

// ===== Client Brief Admin Logic =====
let adminCredentials = null;
let currentBriefs = [];
let currentYearFilter = new Date().getFullYear().toString();

const SIMULATED_TITLES = [
    "Modern Villa Interior Visualization", "Architectural Rendering - City Hub",
    "3D Walkthrough for Luxury Apartments", "Minimalist Studio Design Concept",
    "Commercial Complex Exterior View", "Residential 3D Modeling Project",
    "Photorealistic Kitchen Rendering", "Executive Office Space Visualization",
    "Eco-Friendly Home Concept Design", "Skyrise Penthouse Walkthrough",
    "Traditional Heritage Site Restoration 3D", "Contemporary Art Gallery Rendering",
    "Lush Landscape & Garden 3D Plan", "Smart City Infrastructure Model",
    "Hotel Lobby Interior Design", "Modern Farmhouse Concept Walkthrough",
    "Industrial Warehouse 3D Plan", "Urban Playground Visualization",
    "Co-working Space Interior Rendering", "Coastal Beach Resort Concept",
    "Sustainable School Architecture 3D", "Fitness Center Interior Modeling",
    "Boutique Retail Store Visualization", "High-Tech Lab Concept Rendering",
    "Public Library 3D Walkthrough", "Airport Terminal Expansion Model"
];

function initBriefAdmin() {
    const loginBtn = document.getElementById('adminLoginBtn');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    const refreshBtn = document.getElementById('adminRefreshBtn');

    if (loginBtn) loginBtn.addEventListener('click', loginAdmin);
    if (logoutBtn) logoutBtn.addEventListener('click', logoutAdmin);
    if (refreshBtn) refreshBtn.addEventListener('click', () => fetchBriefs(true));

    // Initial check for session
    const saved = localStorage.getItem('aman_admin_session');
    if (saved) {
        try {
            adminCredentials = JSON.parse(saved);
            toggleAdminUI(true);
        } catch (e) {
            localStorage.removeItem('aman_admin_session');
        }
    }

    // Fetch initial list (public mode)
    fetchBriefs();
}

async function loginAdmin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    const errorEl = document.getElementById('adminLoginError');
    const loginBtn = document.getElementById('adminLoginBtn');

    if (!user || !pass) {
        if (errorEl) {
            errorEl.textContent = "Please enter credentials";
            errorEl.style.display = "block";
        }
        return;
    }

    loginBtn.textContent = "Authenticating...";
    loginBtn.disabled = true;

    try {
        const result = await adminAuthFetch('adminLogin', { user, pass });

        if (result.status === "success") {
            adminCredentials = { user, pass };
            localStorage.setItem('aman_admin_session', JSON.stringify(adminCredentials));
            toggleAdminUI(true);
            fetchBriefs(true);
            showToast("Admin access granted");
            if (errorEl) errorEl.style.display = "none";
        } else {
            if (errorEl) {
                errorEl.textContent = result.message || "Invalid Username or Password";
                errorEl.style.display = "block";
            }
        }
    } catch (error) {
        console.error("Login error:", error);
    } finally {
        loginBtn.textContent = "Login to View Briefs";
        loginBtn.disabled = false;
    }
}

function logoutAdmin() {
    adminCredentials = null;
    localStorage.removeItem('aman_admin_session');
    toggleAdminUI(false);
    showToast("Logged out");
    fetchBriefs(); // Refresh to public view
}

function toggleAdminUI(isLoggedIn) {
    const loginForm = document.getElementById('adminLoginForm');
    const logoutSection = document.getElementById('adminLogoutSection');
    if (loginForm) loginForm.style.display = isLoggedIn ? 'none' : 'block';
    if (logoutSection) logoutSection.style.display = isLoggedIn ? 'block' : 'none';
}

async function fetchBriefs(forceAdmin = false) {
    const container = document.getElementById('briefListContainer');
    if (container && container.innerHTML.includes('Synchronizing')) return;

    if (container) container.innerHTML = '<p style="font-size: 11px; text-align: center; color: var(--primary-orange); padding: 20px;">Synchronizing Workspace...</p>';

    const defaultYears = [];
    for (let y = 2026; y >= 2006; y--) defaultYears.push(y.toString());

    try {
        const yearsRes = await fetch(`${TRACKER_SYNC_URL}?action=getYears&t=${Date.now()}`);
        const yearsData = await yearsRes.json();
        const availableYears = yearsData.status === "success" ? yearsData.years : defaultYears;

        let url;
        if (adminCredentials && (forceAdmin || adminCredentials)) {
            url = `${TRACKER_SYNC_URL}?action=getBriefs&user=${encodeURIComponent(adminCredentials.user)}&pass=${encodeURIComponent(adminCredentials.pass)}&t=${Date.now()}`;
        } else {
            url = `${TRACKER_SYNC_URL}?action=getPublicBriefs&year=${currentYearFilter}&t=${Date.now()}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (result.status === "success") {
            currentBriefs = result.data;
            renderBriefs(currentBriefs, availableYears);
        } else {
            renderBriefs([], availableYears);
        }
    } catch (e) {
        renderBriefs([], defaultYears);
    }
}

window.toggleNoteFullScreen = function (noteId) {
    const note = document.getElementById(noteId);
    if (!note) return;

    const isFull = note.classList.toggle('fullscreen-note');
    if (isFull) {
        note.style.width = "90vw";
        note.style.height = "85vh";
        note.style.position = "fixed";
        note.style.top = "7.5vh";
        note.style.left = "5vw";
        note.style.zIndex = "10000";
        note.style.transition = "all 0.3s ease";
        const content = note.querySelector('.sticky-content');
        if (content) {
            content.style.maxHeight = "none";
            const briefList = document.getElementById('briefListContainer');
            if (briefList) briefList.style.maxHeight = "calc(85vh - 150px)";
        }
    } else {
        note.style.width = "";
        note.style.height = "";
        note.style.position = "";
        note.style.top = "460px";
        note.style.left = "100px";
        note.style.zIndex = "";
        const briefList = document.getElementById('briefListContainer');
        if (briefList) briefList.style.maxHeight = "200px";
    }
};

function generateSimulatedData(year) {
    const projects = [];
    const seed = parseInt(year);
    const count = (seed % 15) + 12; // 12-27 projects

    for (let i = 0; i < count; i++) {
        const titleIdx = (seed + i) % SIMULATED_TITLES.length;
        projects.push({
            rowId: `sim_${year}_${i}`,
            projectTitle: SIMULATED_TITLES[titleIdx],
            status: (seed + i) % 7 === 0 ? 'Unread' : 'Read',
            year: year.toString(),
            isSimulated: true,
            clientName: "Archived Record"
        });
    }
    return projects;
}

function renderBriefs(briefs, yearsList = []) {
    const container = document.getElementById('briefListContainer');
    if (!container) return;

    const currentYears = yearsList.length > 0 ? yearsList : ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009", "2008", "2007", "2006"];

    // Premium Dropdown Header
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 5px 12px 5px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 15px; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                 <label style="font-size: 10px; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Archive:</label>
                 <select onchange="setBriefYear(this.value)" 
                    style="flex: 1; min-width: 120px; background: rgba(0,0,0,0.4); border: 1px solid rgba(210,105,30,0.5); color: var(--primary-orange); font-size: 12px; padding: 6px 12px; border-radius: 6px; outline: none; cursor: pointer; font-family: inherit; font-weight: 700;">
                    ${currentYears.map(y => `<option value="${y}" ${currentYearFilter === y ? 'selected' : ''}>${y === '2006' ? '06 Historical' : 'Year ' + y}</option>`).join('')}
                </select>
            </div>
        </div>
    `;

    // Mix real and simulated
    const realBriefs = briefs.filter(b => b.year === currentYearFilter);
    const simulatedBriefs = (realBriefs.length < 5) ? generateSimulatedData(currentYearFilter) : [];

    const displayList = [...realBriefs, ...simulatedBriefs].slice(0, 50);

    html += '<div style="display: flex; flex-direction: column; gap: 10px; padding: 2px;">';
    displayList.forEach(b => {
        const isRead = b.status === 'Read';
        html += `
            <div class="brief-item" onclick="viewBriefDetails('${b.rowId}')"
                style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: rgba(255,255,255,0.02); border: 1px solid ${isRead ? 'rgba(255,255,255,0.05)' : 'rgba(210,105,30,0.4)'}; border-radius: 10px; cursor: pointer; transition: all 0.2s ease;">
                <div style="min-width: 0; flex: 1; padding-right: 25px;">
                    <p style="font-size: 13px; font-weight: 600; margin: 0; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${b.projectTitle}</p>
                    <p style="font-size: 9.5px; color: ${b.isSimulated ? '#555' : 'var(--text-muted)'}; margin-top: 5px; letter-spacing: 0.5px;">${b.isSimulated ? 'HISTORICAL ASSET' : (b.clientName || 'LIVE INQUIRY')}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                     <span style="font-size: 9px; padding: 3px 8px; border-radius: 4px; background: ${isRead ? 'rgba(34,197,94,0.1)' : 'rgba(210,105,30,0.1)'}; color: ${isRead ? '#22c55e' : 'var(--primary-orange)'}; border: 1px solid ${isRead ? 'rgba(34,197,94,0.3)' : 'rgba(210,105,30,0.3)'}; font-weight: 800; text-transform: uppercase;">
                        ${b.status}
                    </span>
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" opacity="0.3">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            </div>
        `;
    });

    if (displayList.length === 0) {
        html += `<p style="font-size: 10px; color: var(--text-muted); text-align: center; padding: 20px;">No records synced for ${currentYearFilter}.</p>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

window.setBriefYear = function (year) {
    currentYearFilter = year;
    fetchBriefs();
};

window.viewBriefDetails = function (rowId) {
    if (!adminCredentials) {
        showToast("Login to view full real-time brief from sheet", "info");
        const loginSection = document.getElementById('adminLoginForm');
        if (loginSection) loginSection.scrollIntoView({ behavior: 'smooth' });
        const userField = document.getElementById('adminUser');
        if (userField) userField.focus();
        return;
    }

    const brief = currentBriefs.find(b => b.rowId.toString() === rowId.toString());
    if (!brief || brief.isSimulated) {
        if (brief && brief.isSimulated) showToast("This is a historical archive placeholder.");
        return;
    }

    // Open detail popup
    if (typeof openPopup === 'function') {
        openPopup('brief-detail');

        // Give template time to inject
        setTimeout(() => {
            const detailContainer = document.getElementById('briefDetailContent');
            if (!detailContainer) return;

            // Fill details
            if (document.getElementById('detail-name')) document.getElementById('detail-name').textContent = brief.clientName || "N/A";
            if (document.getElementById('detail-email')) document.getElementById('detail-email').textContent = brief.email || "N/A";
            if (document.getElementById('detail-phone')) document.getElementById('detail-phone').textContent = brief.phone || "N/A";
            if (document.getElementById('detail-project-title')) document.getElementById('detail-project-title').textContent = brief.projectTitle || "N/A";
            if (document.getElementById('detail-services')) document.getElementById('detail-services').textContent = brief.services || "None";
            if (document.getElementById('detail-work-type')) document.getElementById('detail-work-type').textContent = brief.workType || "N/A";
            if (document.getElementById('detail-interior')) document.getElementById('detail-interior').textContent = (brief.interiorItems || "") + (brief.interiorOther ? " (" + brief.interiorOther + ")" : "");
            if (document.getElementById('detail-exterior')) document.getElementById('detail-exterior').textContent = (brief.exteriorItems || "") + (brief.exteriorOther ? " (" + brief.exteriorOther + ")" : "");
            if (document.getElementById('detail-billing')) document.getElementById('detail-billing').textContent = brief.billingType || "N/A";
            if (document.getElementById('detail-budget')) document.getElementById('detail-budget').textContent = brief.budget || "N/A";
            if (document.getElementById('detail-timeline')) document.getElementById('detail-timeline').textContent = brief.timeline || "N/A";
            if (document.getElementById('detail-message')) document.getElementById('detail-message').textContent = brief.message || "No description provided.";

            // Links
            const attachLink = document.getElementById('detail-attachment');
            const noAttach = document.getElementById('no-attachment');
            if (attachLink && noAttach) {
                if (brief.attachment && brief.attachment !== "" && brief.attachment !== "Error saving file:") {
                    attachLink.href = brief.attachment;
                    attachLink.style.display = "inline";
                    noAttach.style.display = "none";
                } else {
                    attachLink.style.display = "none";
                    noAttach.style.display = "inline";
                }
            }

            const extLink = document.getElementById('detail-external-link');
            const noExt = document.getElementById('no-external-link');
            if (extLink && noExt) {
                if (brief.fileLink && brief.fileLink !== "") {
                    extLink.href = brief.fileLink;
                    extLink.style.display = "inline";
                    noExt.style.display = "none";
                } else {
                    extLink.style.display = "none";
                    noExt.style.display = "inline";
                }
            }

            // Mark as read in backend
            if (brief.status !== 'Read') {
                markBriefRead(brief.rowId);
            }
        }, 300);
    }
};

async function markBriefRead(rowId) {
    if (!adminCredentials) return;

    try {
        await adminAuthFetch('markBriefRead', {
            user: adminCredentials.user,
            pass: adminCredentials.pass,
            rowId: rowId
        });

        // Update local state
        const brief = currentBriefs.find(b => b.rowId.toString() === rowId.toString());
        if (brief) {
            brief.status = 'Read';
            renderBriefs(currentBriefs);
        }
    } catch (e) { }
}

// Special fetch helper for POST actions to GAS
async function adminAuthFetch(action, data) {
    const response = await fetch(TRACKER_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: action, ...data })
    });
    return await response.json();
}
