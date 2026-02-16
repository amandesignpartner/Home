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

    // Check for form success flag in URL
    checkFormSuccess();

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

    // Define Default MINIMIZED Elements (all except sketch, intro, profile, and projects)
    const defaultMinimized = [
        'note-contact',
        'note-collaborate',
        'note-feedback',
        'note-pricing',
        'btn-360'
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

    // Handle tracking button click
    const handleTrack = () => {
        const rawVal = mainTrackInput.value.trim();
        const cleanVal = rawVal.replace(/-/g, ''); // Remove dashes for lookup
        const inputContainer = mainTrackInput.parentElement;

        // Lookup in projectData (loaded from project-data.js)
        const project = window.projectData && window.projectData[cleanVal];

        if (rawVal && project) {
            window.originalTrackerKey = cleanVal; // Save original key for "Update Existing" logic
            // Found project!
            openPopup('track-status');
            inputContainer.classList.remove('error');

            // Wait brief moment for popup to render then populate
            setTimeout(() => {
                // IMPORTANT: Work on a CLONE so we don't accidentally mutate the live window.projectData
                // until the user specifically clicks "Update Existing" or "Download New".
                const projectClone = JSON.parse(JSON.stringify(project));
                populateTrackerPopup(projectClone);
            }, 50);

            // Clear error
            const errorMsg = document.getElementById('tracker-error-msg');
            if (errorMsg) errorMsg.remove();
        } else {
            // Error handling
            inputContainer.classList.add('error');
            let errorMsg = document.getElementById('tracker-error-msg');
            if (!errorMsg) {
                errorMsg = document.createElement('div');
                errorMsg.id = 'tracker-error-msg';
                errorMsg.style.cssText = 'color: #ff4d4d; font-size: 11px; margin-top: 8px; font-weight: 500; transition: all 0.3s;';
                inputContainer.parentElement.appendChild(errorMsg);
            }
            errorMsg.textContent = '❌ Invalid Project ID. Please check and try again.';
            errorMsg.style.opacity = '1';

            // Shake effect
            inputContainer.style.animation = 'none';
            inputContainer.offsetHeight; // trigger reflow
            inputContainer.style.animation = 'shake 0.4s ease';
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

// Function to populate popup with data
function populateTrackerPopup(data) {
    window.lastTrackedProject = data;
    const isEditMode = localStorage.getItem('tracker_edit_mode_active') === 'true';

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
                // Form Date (trk-start) should not be editable manually
                if (id !== 'trk-start') {
                    el.contentEditable = "true";
                    el.style.outline = "1px dashed orange";
                } else {
                    el.contentEditable = "false";
                    el.style.outline = "none";
                }
                el.oninput = () => {
                    const fieldMap = {
                        'trk-id': 'id', 'trk-cost': 'cost', 'trk-client': 'client',
                        'trk-project': 'project', 'trk-start': 'startDate',
                        'trk-phase': 'phase', 'trk-updated': 'lastUpdated', 'trk-deadline': 'deadline',
                        'trk-milestone': 'nextMilestone', 'trk-pending': 'pendingAmount'
                    };
                    if (fieldMap[id]) data[fieldMap[id]] = el.textContent.trim();
                };
            }
        }
    };

    setSafe('trk-id', data.id);
    setSafe('trk-cost', data.cost);
    setSafe('trk-client', data.client);
    setSafe('trk-project', data.project);
    setSafe('trk-start', data.startDate);
    setSafe('trk-phase', data.phase);
    setSafe('trk-updated', data.lastUpdated);
    setSafe('trk-deadline', data.deadline);
    setSafe('trk-milestone', data.nextMilestone);
    setSafe('trk-pending', data.pendingAmount);

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
                };
            }
        }
    });

    // Download Button & Link Input
    const downloadBtn = document.getElementById('btn-download');
    if (downloadBtn) {
        downloadBtn.innerHTML = '<span style="margin-right: 8px;">📥</span> Download Latest Project Files';
        downloadBtn.href = (data.downloadLink && data.downloadLink !== '#') ? data.downloadLink : 'https://aman3dpartner.netlify.app/';

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
            linkInput.oninput = () => { data.downloadLink = linkInput.value.trim(); };

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
            <button id="btn-create-new" style="width: 100%; padding: 10px; background: #a855f7; color: #fff; border: none; border-radius: 8px; font-size: 10px; font-weight: 700; cursor: pointer;">🆕 Create New Client Entry (Clear Form)</button>
        `;

            const btnSaveNew = document.getElementById('btn-save-new');
            if (btnSaveNew) btnSaveNew.onclick = () => downloadTrackerData(data, 'new');

            const btnUpdate = document.getElementById('btn-update-existing');
            if (btnUpdate) btnUpdate.onclick = () => downloadTrackerData(data, 'update');

            const btnCreate = document.getElementById('btn-create-new');
            if (btnCreate) btnCreate.onclick = () => {
                const baseSetup = window.projectData && window.projectData["AMAN00Z"] ? window.projectData["AMAN00Z"] : {};

                // Generate Project ID Sequence
                let lastNum = parseInt(localStorage.getItem('tracker_id_sequence')) || 124;
                const nextNum = lastNum + 1;
                localStorage.setItem('tracker_id_sequence', nextNum);
                const newID = `VMC-26H${nextNum}-A`;

                // Calculate Dates
                const now = new Date();
                const formDate = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
                const updateDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); // D MMM YYYY

                const deliveryDateObj = new Date();
                deliveryDateObj.setDate(now.getDate() + 7);
                const deliveryDate = deliveryDateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY

                const resetData = {
                    ...baseSetup,
                    id: newID,
                    startDate: formDate,
                    lastUpdated: updateDate,
                    deadline: deliveryDate,
                    // Ensure other AMAN00Z basics are kept (status, phase, milestone, etc.)
                    status: baseSetup.status || "progress",
                };

                populateTrackerPopup(resetData);
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

    const feedbackBtn = document.querySelector('button[onclick="openPopup(\'feedback\')"]');
    if (feedbackBtn) {
        feedbackBtn.onclick = function () {
            openPopup('feedback');
            setTimeout(() => {
                const pInput = document.getElementById('fb-project'), cInput = document.getElementById('fb-client'), pidInput = document.getElementById('fb-pid');
                if (pInput) pInput.value = data.project; if (cInput) cInput.value = data.client; if (pidInput) pidInput.value = data.id;
            }, 50);
        };
    }
}

function downloadTrackerData(editedData, mode) {
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

    // Close popup and cleanup
    setTimeout(() => {
        closePopup();
        URL.revokeObjectURL(url);

        // Force refresh of the popup state if user re-opens immediately
        if (window.lastTrackedProject && document.getElementById('popup-track-status')) {
            // If we didn't close it properly or if we want to ensure UI cleanliness
            // We can re-render it in non-edit mode, but closePopup() hides it anyway.
        }
    }, 500);
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
            if (el.classList.contains('minimized')) return;
            if (el.classList.contains('pinned')) return;

            minimizeElement(el);
        });
    }

    function minimizeElement(el) {
        const id = el.id;
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

    // Use delegated listener for all data-popup elements for maximum reliability
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-popup]');
        if (!btn || btn.classList.contains('was-dragged')) return;

        e.stopPropagation();
        const popupId = btn.getAttribute('data-popup');
        const options = {
            hideDiscuss: btn.getAttribute('data-hide-discuss') === 'true'
        };

        // Check if current popup has a save function (specifically for the brief)
        if (window._saveBriefData) {
            window._saveBriefData();
        }

        openPopup(popupId, false, options);
    });

    // Handle Detached Video button click
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-detach-video');
        if (!btn) return;

        e.stopPropagation();
        const targetType = btn.getAttribute('data-target-player');
        let playerIframe;

        if (targetType === 'intro') {
            playerIframe = document.querySelector('#note-intro .js-player');
        }

        if (playerIframe && playerIframe.plyr) {
            playerIframe.plyr.pip = true;
        }
    });

    if (closeBtn) closeBtn.addEventListener('click', closePopup);
    // Overlay click and Escape key closing disabled per user request
}

function openPopup(id, isBack = false, options = {}) {
    const overlay = document.getElementById('popupOverlay');
    const content = document.getElementById('popupContent');

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

    // Pause background intro video if it exists
    const backgroundVideo = document.querySelector('.sticky-content .js-player');
    if (backgroundVideo && window.Plyr) {
        // Try to find Plyr instance
        const player = Plyr.setup('.sticky-content .js-player')[0];
        if (player) player.pause();
    }

    const template = document.getElementById('popup-' + id);

    if (!template) {
        content.innerHTML = `<div class="popup-inner"><h2>Coming Soon</h2><p>This content is being prepared.</p></div>`;
    } else {
        content.innerHTML = template.innerHTML;

        // Initialize Plyr for dynamic content
        if (window.initPlyr) { window.initPlyr(content); }



        // Custom logic to hide "Discuss Hourly" button if requested
        if (id === 'hourly-more' && options.hideDiscuss) {
            const discussBtn = content.querySelector('button[onclick*="Hourly Rate Inquiry"]');
            if (discussBtn) {
                discussBtn.style.display = 'none';
            }
        }
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

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

    // Re-bind all data-popup items in the new content
    // Use a small timeout to ensure DOM is ready and any dynamic rendering is finished
    setTimeout(() => {
        content.querySelectorAll('[data-popup]').forEach(item => {
            // Remove previous listener if any to avoid double binding (though innerHTML usually clears it)
            const newHandler = (e) => {
                const popupId = item.getAttribute('data-popup');
                const options = {
                    hideDiscuss: item.getAttribute('data-hide-discuss') === 'true'
                };

                // Check if current popup has a save function (specifically for the brief)
                if (window._saveBriefData) {
                    window._saveBriefData();
                }

                openPopup(popupId, false, options);
            };
            item.onclick = newHandler; // Using .onclick for maximum reliability in nested popups
        });
    }, 10);

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

            unlockBtn.addEventListener('click', () => {
                const rawVal = orderInput.value.trim();
                const cleanVal = rawVal.replace(/-/g, '');

                // Dynamic unlock: Check if Project ID exists in global projectData
                const project = window.projectData && window.projectData[cleanVal];

                if (rawVal && project) {
                    lockedSection.style.display = 'block';
                    errorMsg.style.display = 'none';
                    orderInput.style.borderColor = 'var(--primary-green)';
                    // Fill the Project ID in the form
                    if (formOrderNumber) {
                        formOrderNumber.value = rawVal;
                    }
                    // Scroll to Western Union section
                    setTimeout(() => {
                        lockedSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                } else {
                    errorMsg.style.display = 'block';
                    errorMsg.textContent = '❌ Invalid Project ID. Please contact Aman for assistance.';
                    orderInput.style.borderColor = '#ff4d4d';

                    // Simple shake for feedback
                    orderInput.parentElement.style.animation = 'none';
                    orderInput.parentElement.offsetHeight;
                    orderInput.parentElement.style.animation = 'shake 0.4s ease';
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
    const toggleCode = '778899a';
    const trackerCode = '778899b';
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
            alert('File is too large. FormSubmit allows up to 10MB. Please use WeTransfer for larger files.');
            e.target.value = ''; // Clear input
        }
    }
});

// Consolidated Form Submission Handler
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'contactForm') {
        const form = e.target;
        const submitBtn = form.querySelector('.btn-submit');
        const statusEl = document.getElementById('form-status');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
        }

        // --- Step 1: Handle Tawk.to Copy (Internal Message) ---
        try {
            if (typeof Tawk_API !== 'undefined' && Tawk_API.sendMessage) {
                const formData = new FormData(form);
                const getVal = (name) => {
                    const val = formData.get(name);
                    return (val && val.trim() !== "") ? val.trim() : "Not provided";
                };

                let budget = getVal('budget');
                if (budget === 'custom') budget = getVal('budget_custom');
                let timeline = getVal('timeline');
                if (timeline === 'custom') timeline = getVal('timeline_custom');

                const summaryMessage = `
🚀 --- NEW PROJECT BRIEF SUMMARY ---
Client: ${getVal('name')}
Email: ${getVal('email')}
Phone: ${getVal('phone')}

Project Title: ${getVal('project_title')}
Billing Type: ${getVal('billing_type')}
Budget: ${budget}
Timeline: ${timeline}

Quick Pick Services: ${getVal('Quick_Pick_Services')}
Project Focus: ${getVal('Work_Type')}
Interior Requirements: ${getVal('Interior_Requirements')}
Exterior Requirements: ${getVal('Exterior_Requirements')}

Message:
${getVal('message')}

File Link: ${getVal('file_link')}
-----------------------------------------
`.trim();

                Tawk_API.sendMessage(summaryMessage, function (error) { });
                Tawk_API.setAttributes({
                    'name': getVal('name'),
                    'email': getVal('email'),
                    'phone': getVal('phone')
                }, function (error) { });
            }
        } catch (err) {
            console.warn("Failed to send message copy to chat:", err);
        }

        // --- Step 2: Handle Protocol Check (Better Fallback for local files) ---
        if (window.location.protocol === 'file:') {
            e.preventDefault();
            if (statusEl) {
                statusEl.innerHTML = `⚠️ <strong>Local Testing Mode:</strong> FormSubmit.co requires a live server. <br>
                    <button id="send-local-whatsapp" class="btn-outline" style="margin-top:10px; border-color:#4ade80; color:#4ade80;">
                        Submit via WhatsApp Instead
                    </button>`;
                statusEl.style.color = '#ff9f43';

                document.getElementById('send-local-whatsapp').onclick = (btnE) => {
                    btnE.preventDefault();
                    // Get data again just in case
                    const getVal = (id) => {
                        const el = form.querySelector(`[name="${id}"]`) || form.querySelector(`#${id}`);
                        const val = el ? el.value : "";
                        return (val && val.trim() !== "") ? val.trim() : "Not provided";
                    };
                    let budget = getVal('budget');
                    if (budget === 'custom') budget = getVal('budget_custom');
                    let timeline = getVal('timeline');
                    if (timeline === 'custom') timeline = getVal('timeline_custom');

                    const waMessage = encodeURIComponent(`*--- NEW PROJECT BRIEF ---*\n\n*Client:* ${getVal('name')}\n*Email:* ${getVal('email')}\n*Phone:* ${getVal('phone')}\n\n*Project Title:* ${getVal('project_title')}\n*Billing Type:* ${getVal('billing_type')}\n*Budget:* ${budget}\n*Timeline:* ${timeline}\n\n*Focus:* ${getVal('Work_Type')}\n*Services:* ${getVal('Quick_Pick_Services')}\n\n*Message:* ${getVal('message')}\n\n*File Link:* ${getVal('file_link')}`);
                    window.open(`https://wa.me/923010003011?text=${waMessage}`, '_blank');
                };
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.originalText || 'Send Message';
            }
            return;
        }

        // --- Step 3: AJAX Submit to FormSubmit.co ---
        e.preventDefault();
        try {
            const formData = new FormData(form);
            // FormSubmit AJAX endpoint
            const response = await fetch('https://formsubmit.co/ajax/aman.designpartner@gmail.com', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                if (statusEl) {
                    statusEl.textContent = '✅ Success! Your brief has been sent.';
                    statusEl.style.color = '#4ade80';
                }
                form.reset();
                setTimeout(() => {
                    // Redirect to ?sent=true which is handled by checkFormSuccess()
                    const currentUrl = new URL(window.location.href);
                    currentUrl.searchParams.set('sent', 'true');
                    window.location.href = currentUrl.toString();
                }, 1500);
            } else {
                const result = await response.json();
                throw new Error(result.message || 'Submission failed');
            }
        } catch (err) {
            if (statusEl) {
                statusEl.textContent = '❌ Error: ' + err.message + '. Please use WhatsApp.';
                statusEl.style.color = '#ff4d4d';
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.originalText || 'Send Message';
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
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    try {
        const formData = new FormData(form);

        // --- Tawk.to Copy for Payment ---
        try {
            if (typeof Tawk_API !== 'undefined' && Tawk_API.sendMessage) {
                const getVal = (name) => {
                    const val = formData.get(name);
                    return (val && val.trim() !== "") ? val.trim() : "Not provided";
                };
                const paymentSummary = `
💰 --- NEW PAYMENT SUBMISSION ---
Client: ${getVal('name')}
Email: ${getVal('email')}
MTCN/Reference: ${getVal('mtcn')}
Amount: ${getVal('amount')}
Project: ${getVal('project_name')}
-----------------------------------------
`.trim();
                Tawk_API.sendMessage(paymentSummary, function (error) { });
            }
        } catch (e) { console.warn("Tawk error:", e); }

        formData.append("_subject", "New Payment Submission - MTCN");
        formData.append("_captcha", "false");
        const response = await fetch('https://formsubmit.co/ajax/aman.designpartner@gmail.com', {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            statusEl.textContent = '✅ Payment details submitted successfully!';
            statusEl.style.color = '#4CAF50';
            form.reset();
            setTimeout(() => {
                if (confirm('Payment details sent! Inform Aman via WhatsApp?')) {
                    window.open('https://wa.me/923010003011', '_blank');
                }
            }, 1000);
        }
    } catch (error) {
        statusEl.textContent = '❌ Error. Please try WhatsApp.';
        statusEl.style.color = '#f44336';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Payment Details';
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

function downloadTrackerData(editedData, mode, shouldClose = true) {
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

// Global function to initiate chat for a specific plan
window.initiatePlanChat = function (planName) {
    if (typeof Tawk_API !== 'undefined' && Tawk_API.maximize) {
        // Open the chat window
        Tawk_API.maximize();

        // Construct the message we *would* type if we could access the iframe
        const contextMessage = `Hi Aman, I'm interested in the ${planName}.`;

        // Pass this context to the agent view via attributes and tags
        if (Tawk_API.setAttributes) {
            Tawk_API.setAttributes({
                'interest': planName,
                'starting_message': contextMessage
            }, function (error) { });
        }

        // Add a specialized event
        if (Tawk_API.addEvent) {
            Tawk_API.addEvent('payment_initiation', {
                'plan': planName,
                'message': contextMessage
            }, function (error) { });
        }

        // Also add a Tag for filtering
        if (Tawk_API.addTags) {
            Tawk_API.addTags(['pricing_inquiry', planName], function (error) { });
        }

        // Close our popup to clear the view for the chat
        const overlay = document.getElementById('popupOverlay');
        if (overlay && overlay.classList.contains('active')) {
            const closeBtn = document.querySelector('.popup-close');
            if (closeBtn) closeBtn.click();
        }

    } else {
        alert("Chat widget is loading... Please wait a moment or try again.");
    }
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
        };

        // Expose save function globally while the brief is open
        window._saveBriefData = saveAllData;

        // Helper to restore all form data
        const restoreAllData = () => {
            const stored = localStorage.getItem('aman_contact_form_data');
            const data = stored ? JSON.parse(stored) : window.savedContactFormData;
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
                    } else {
                        el.value = value;
                    }

                    // Trigger events to update dynamic UI (like budget or billing detail visibility)
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));

                    // Explicitly call inline onchange if present (as dispatchEvent doesn't always trigger it)
                    if (typeof el.onchange === 'function') {
                        el.onchange({ target: el });
                    }
                });
            });

            // Ensure all dynamic sections are updated based on restored values
            setTimeout(updateVisibility, 0);
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

        // Initial restoration
        restoreAllData();

        // Form submission - ensure Quick Pick data is included
        if (contactForm) {
            contactForm.addEventListener('submit', function (e) {
                // Collect selected services
                const selectedServices = [];
                const serviceCheckboxes = qpContainer.querySelectorAll('input[name="services[]"]:checked');
                serviceCheckboxes.forEach(checkbox => {
                    if (checkbox.value === 'Other') {
                        const parentItem = checkbox.closest('.qp-option-item');
                        const otherInput = parentItem.querySelector('.qp-other-input');
                        if (otherInput && otherInput.value.trim()) {
                            selectedServices.push('Other Service: ' + otherInput.value.trim());
                        }
                    } else {
                        let serviceName = checkbox.value;
                        // If it's the concept plan, check if sub-options are selected
                        if (serviceName === '2D Architecture Concept Plan' && conceptPlanDetails) {
                            const subOptions = conceptPlanDetails.querySelectorAll('input:checked');
                            if (subOptions.length > 0) {
                                const details = Array.from(subOptions).map(opt => opt.value).join(', ');
                                serviceName += ` (${details})`;
                            }
                        }
                        selectedServices.push(serviceName);
                    }
                });

                // Collect Work Type
                const workType = workTypeSelect ? workTypeSelect.value : '';

                // Collect Interior Items
                const selectedInterior = [];
                if (interiorChecklist && interiorChecklist.style.display !== 'none') {
                    const interiorCheckboxes = interiorChecklist.querySelectorAll('input[name="interior_items[]"]:checked');
                    interiorCheckboxes.forEach(checkbox => {
                        if (checkbox.value === 'Other') {
                            const customInput = interiorChecklist.querySelector('input[name="interior_custom"]');
                            if (customInput && customInput.value.trim()) {
                                selectedInterior.push('Other Interior: ' + customInput.value.trim());
                            }
                        } else {
                            selectedInterior.push(checkbox.value);
                        }
                    });
                }

                // Collect Exterior Items
                const selectedExterior = [];
                if (exteriorChecklist && exteriorChecklist.style.display !== 'none') {
                    const exteriorCheckboxes = exteriorChecklist.querySelectorAll('input[name="exterior_items[]"]:checked');
                    exteriorCheckboxes.forEach(checkbox => {
                        if (checkbox.value === 'Other') {
                            const customInput = exteriorChecklist.querySelector('input[name="exterior_custom"]');
                            if (customInput && customInput.value.trim()) {
                                selectedExterior.push('Other Exterior: ' + customInput.value.trim());
                            }
                        } else {
                            selectedExterior.push(checkbox.value);
                        }
                    });
                }

                // Collect Billing Type
                const billingRadio = container.querySelector('input[name="billing_type"]:checked');
                const billingType = billingRadio ? billingRadio.value : '';

                // Create hidden fields
                const existingFields = contactForm.querySelectorAll('.quick-pick-hidden');
                existingFields.forEach(field => field.remove());

                const addHidden = (name, value) => {
                    if (!value) return;
                    const field = document.createElement('input');
                    field.type = 'hidden';
                    field.name = name;
                    field.value = value;
                    field.className = 'quick-pick-hidden';
                    contactForm.appendChild(field);
                };

                addHidden('Quick_Pick_Services', selectedServices.join(', '));
                addHidden('Work_Type', workType);
                addHidden('Interior_Requirements', selectedInterior.join(', '));
                addHidden('Exterior_Requirements', selectedExterior.join(', '));
                addHidden('Billing_Type', billingType);

                // Clear saved form data on successful submission
                window.savedContactFormData = null;
                localStorage.removeItem('aman_contact_form_data');
            });
        }

        // Initial check
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

    // Cleanup function when popup closes
    window.addEventListener('popupClosed', () => {
        document.removeEventListener('keydown', handleKeyboard);
        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    });
}

// ===== Fullscreen Functions for Comparison Slider =====
function toggleComparisonFullscreen() {
    const wrapper = document.querySelector('.comparison-wrapper');
    const closeBtn = document.querySelector('.comparison-close-btn');
    const fullscreenBtn = document.querySelector('.comparison-fullscreen-btn');

    if (!wrapper) return;

    if (!document.fullscreenElement) {
        // Enter fullscreen
        wrapper.requestFullscreen().then(() => {
            wrapper.style.height = '100vh';
            wrapper.style.borderRadius = '0';
            if (closeBtn) closeBtn.style.display = 'flex';
            if (fullscreenBtn) fullscreenBtn.style.display = 'none';
        }).catch(err => {
            console.log('Error entering fullscreen:', err);
        });
    } else {
        exitComparisonFullscreen();
    }
}

function exitComparisonFullscreen() {
    const wrapper = document.querySelector('.comparison-wrapper');
    const closeBtn = document.querySelector('.comparison-close-btn');
    const fullscreenBtn = document.querySelector('.comparison-fullscreen-btn');

    if (document.fullscreenElement) {
        document.exitFullscreen().then(() => {
            if (wrapper) {
                wrapper.style.height = '600px';
                wrapper.style.borderRadius = '16px';
            }
            if (closeBtn) closeBtn.style.display = 'none';
            if (fullscreenBtn) fullscreenBtn.style.display = 'flex';
        });
    }
}

// Listen for fullscreen changes (e.g., ESC key pressed)
document.addEventListener('fullscreenchange', () => {
    const wrapper = document.querySelector('.comparison-wrapper');
    const closeBtn = document.querySelector('.comparison-close-btn');
    const fullscreenBtn = document.querySelector('.comparison-fullscreen-btn');

    if (!document.fullscreenElement) {
        // Exited fullscreen
        if (wrapper) {
            wrapper.style.height = '600px';
            wrapper.style.borderRadius = '16px';
        }
        if (closeBtn) closeBtn.style.display = 'none';
        if (fullscreenBtn) fullscreenBtn.style.display = 'flex';
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
    const projectName = document.getElementById('fb-project')?.value || 'General Feedback';
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
📊 Project Number: ${projectName}
⭐ Rating: ${ratingEmojis[rating] || rating}/5

💬 Message:
${message}

---
Sent via Website Feedback Form
`;

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

    // Show thank you message
    const formContainer = form.parentElement;
    const thankYouDiv = document.getElementById('feedback-thank-you');
    const reviewLink = document.getElementById('feedback-review-link');
    const submitBtn = document.getElementById('feedback-submit-btn');

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
                if (submitBtn) submitBtn.style.display = '';
                if (reviewLink) reviewLink.style.display = '';
                thankYouDiv.style.display = 'none';
            }, 500);
        }, 4000);
    }

    return false;
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

        if (fbClient && clientName && clientName !== '...') {
            fbClient.value = clientName;
        }

        if (fbProject && projectId && projectId !== '...') {
            fbProject.value = projectId;
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

    // We no longer remove shields; they are part of the strict protection layer
    // const shields = container.querySelectorAll('.video-protection-shield');
    // shields.forEach(s => s.style.display = 'none');

    const players = Array.from(container.querySelectorAll('.js-player')).map(p => {
        const isIntro = p.classList.contains('js-intro-player');

        const config = {
            controls: [
                'play-large',
                'play',
                'mute',
                'volume'
            ],
            seekTime: 5,
            youtube: { noCookie: false, rel: 0, showinfo: 0, iv_load_policy: 3, modestbranding: 1 },
            tooltips: { controls: false, seek: false },
            displayDuration: false,
            invertTime: false,
            quality: { default: 1080, options: [4320, 2880, 2160, 1440, 1080, 720, 576, 480, 360, 240] }
        };

        // ONLY allow Picture-in-Picture (detached mode) for the intro video
        if (isIntro) {
            config.controls.push('pip');
        }

        const player = new Plyr(p, config);
        p.plyr = player; // Store instance on element for external access
        return player;
    });

    players.forEach(player => {
        const plyrContainer = player.elements.container;

        // Find the associated protection shield
        const shield = plyrContainer.parentElement.querySelector('.video-protection-shield');

        if (shield) {
            // Enable Left-Click to toggle Play/Pause
            shield.style.cursor = 'pointer';
            shield.addEventListener('click', (e) => {
                if (e.button === 0) { // Left click only
                    player.togglePlay();
                }
            });

            // Re-enforce Right-Click block on the shield specifically
            shield.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                return false;
            };
        }

        player.on('ready', event => {
            const container = event.detail.plyr.elements.container;
            container.oncontextmenu = (e) => { e.preventDefault(); return false; };
            container.addEventListener('contextmenu', (e) => { e.preventDefault(); }, true);
        });
    });
};
document.addEventListener('DOMContentLoaded', () => { window.initPlyr(); });
