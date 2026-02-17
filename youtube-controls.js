/**
 * CUSTOM YOUTUBE VIDEO CONTROLS
 * Native PiP-style player with auto-hiding overlay controls
 */

// Store all YouTube player instances
window.youtubePlayersMap = new Map();
let isYouTubeAPIReady = false;
let pipPlayerInstance = null;
let hideControlsTimeout = null;

// Load YouTube IFrame API
function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
        isYouTubeAPIReady = true;
        return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// YouTube API Ready Callback
window.onYouTubeIframeAPIReady = function () {
    console.log('✅ YouTube IFrame API is ready');
    isYouTubeAPIReady = true;
    initializeAllYouTubePlayers();
};

// Extract video ID from YouTube URL
function extractVideoId(url) {
    const match = url.match(/embed\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

// Initialize all YouTube players on the page
function initializeAllYouTubePlayers() {
    const iframes = document.querySelectorAll('iframe[src*="youtube.com"]');
    console.log(`Found ${iframes.length} YouTube iframes`);

    iframes.forEach((iframe, index) => {
        if (!iframe.id) {
            iframe.id = `youtube-player-${index}-${Date.now()}`;
        }

        if (window.youtubePlayersMap.has(iframe.id)) {
            return;
        }

        const videoId = extractVideoId(iframe.src);
        if (!videoId) {
            return;
        }

        try {
            const currentSrc = iframe.src;
            if (!currentSrc.includes('enablejsapi=1')) {
                iframe.src = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 'enablejsapi=1';
            }

            const player = new YT.Player(iframe.id, {
                events: {
                    'onReady': (event) => {
                        console.log(`✅ Player ${iframe.id} is ready`);
                        window.youtubePlayersMap.set(iframe.id, event.target);

                        try {
                            const availableLevels = event.target.getAvailableQualityLevels();
                            if (availableLevels.includes('hd1080')) {
                                event.target.setPlaybackQuality('hd1080');
                            } else if (availableLevels.includes('hd720')) {
                                event.target.setPlaybackQuality('hd720');
                            }
                        } catch (err) {
                            console.warn('Could not set default quality:', err);
                        }
                    }
                }
            });
        } catch (error) {
            console.error(`Failed to initialize player ${iframe.id}:`, error);
        }
    });
}

function getPlayerForContainer(container) {
    const iframe = container.querySelector('iframe[src*="youtube.com"]');
    if (!iframe || !iframe.id) return null;

    const player = window.youtubePlayersMap.get(iframe.id);
    if (!player) {
        initializeAllYouTubePlayers();
        return null;
    }
    return player;
}

// Custom video control actions
window.customVideoControls = {
    play: function (button) {
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content');
        const player = getPlayerForContainer(container);

        if (!player) {
            showToast('⚠️ Video player not ready. Please wait...');
            setTimeout(() => initializeAllYouTubePlayers(), 500);
            return;
        }

        try {
            const state = player.getPlayerState();
            button.classList.add('pulse-orange');
            setTimeout(() => button.classList.remove('pulse-orange'), 600);

            if (state === 1) {
                player.pauseVideo();
                this.updatePlayButtonIcon(container, false);
            } else {
                player.playVideo();
                this.updatePlayButtonIcon(container, true);
            }
        } catch (error) {
            console.error('Play/Pause failed:', error);
        }
    },

    mute: function (button) {
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content');
        const player = getPlayerForContainer(container);

        if (!player) {
            showToast('⚠️ Video player not ready. Please wait...');
            return;
        }

        try {
            button.classList.add('pulse-orange');
            setTimeout(() => button.classList.remove('pulse-orange'), 600);

            if (player.isMuted()) {
                player.unMute();
                player.setVolume(100);
                this.updateMuteButtonIcon(container, false);
            } else {
                player.mute();
                this.updateMuteButtonIcon(container, true);
            }
        } catch (error) {
            console.error('Mute/Unmute failed:', error);
        }
    },

    detach: function (button) {
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content');
        const iframe = container.querySelector('iframe[src*="youtube.com"]');
        const player = getPlayerForContainer(container);

        if (!iframe) {
            showToast('⚠️ Video not found');
            return;
        }

        button.classList.add('pulse-orange');
        setTimeout(() => button.classList.remove('pulse-orange'), 600);

        const videoId = extractVideoId(iframe.src);
        if (!videoId) {
            showToast('⚠️ Unable to detach video');
            return;
        }

        let currentTime = 0;
        if (player) {
            try {
                currentTime = player.getCurrentTime();
            } catch (e) {
                console.warn('Could not get current time:', e);
            }
        }

        let pipContainer = document.getElementById('custom-pip-container');
        if (pipContainer) {
            pipContainer.remove();
            pipPlayerInstance = null;
            showToast('📺 Video reattached');
            return;
        }

        this.createPiPPlayer(videoId, currentTime);
    },

    createPiPPlayer: function (videoId, startTime) {
        const container = document.createElement('div');
        container.id = 'custom-pip-container';
        container.style.cssText = `
            position: fixed;
            width: 512px;
            height: 288px;
            bottom: 20px;
            right: 20px;
            background: #000;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            z-index: 999999;
            cursor: move;
        `;

        // YouTube iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'pip-video-player';
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(startTime)}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1`;
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
        `;
        iframe.setAttribute('allow', 'autoplay; encrypted-media');

        container.appendChild(iframe);

        // CRITICAL: Add transparent overlay to block iframe right-click (cross-origin fix)
        const iframeBlocker = document.createElement('div');
        iframeBlocker.id = 'iframe-blocker';
        iframeBlocker.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
            background: transparent;
            pointer-events: auto;
        `;

        // Block all right-clicks on the blocker overlay
        iframeBlocker.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }, true);

        container.appendChild(iframeBlocker);

        // Controls overlay
        const overlay = document.createElement('div');
        overlay.id = 'pip-controls-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.6) 100%);
            opacity: 1;
            transition: opacity 0.3s;
            pointer-events: none;
            z-index: 2;
        `;

        // Top bar with PiP and close buttons
        const topBar = document.createElement('div');
        topBar.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            padding: 12px;
            display: flex;
            justify-content: space-between;
            pointer-events: auto;
        `;

        const pipBtn = this.createButton(`
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/>
            </svg>
        `);
        pipBtn.onclick = () => {
            container.remove();
            pipPlayerInstance = null;
            showToast('📺 Video reattached');
        };

        const closeBtn = this.createButton('✕');
        closeBtn.style.fontSize = '20px';
        closeBtn.onclick = () => {
            container.remove();
            pipPlayerInstance = null;
            showToast('📺 Video closed');
        };

        topBar.appendChild(pipBtn);
        topBar.appendChild(closeBtn);

        // Bottom controls
        const bottomBar = document.createElement('div');
        bottomBar.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 12px;
            pointer-events: auto;
        `;

        // Progress bar
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            cursor: pointer;
            margin-bottom: 10px;
            position: relative;
        `;

        const progressBar = document.createElement('div');
        progressBar.id = 'pip-progress-bar';
        progressBar.style.cssText = `
            height: 100%;
            width: 0%;
            background: #2196F3;
            border-radius: 2px;
            position: relative;
        `;

        const scrubber = document.createElement('div');
        scrubber.style.cssText = `
            position: absolute;
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        progressBar.appendChild(scrubber);
        progressContainer.appendChild(progressBar);

        // Control buttons row
        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        // Time display
        const timeDisplay = document.createElement('div');
        timeDisplay.id = 'pip-time-display';
        timeDisplay.style.cssText = `
            color: white;
            font-size: 13px;
            font-family: Arial, sans-serif;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        timeDisplay.textContent = '0:00 / 0:00';

        // Center controls
        const centerControls = document.createElement('div');
        centerControls.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        const rewindBtn = this.createButton(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/>
            </svg>
        `);

        const playBtn = this.createButton(`
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white" id="pip-play-icon">
                <path d="M8 5v14l11-7z"/>
            </svg>
        `);
        playBtn.id = 'pip-play-btn';

        const forwardBtn = this.createButton(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8zm-.86 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/>
            </svg>
        `);

        centerControls.appendChild(rewindBtn);
        centerControls.appendChild(playBtn);
        centerControls.appendChild(forwardBtn);

        // Right controls
        const rightControls = document.createElement('div');
        rightControls.style.cssText = 'display: flex; gap: 8px;';

        const volumeBtn = this.createButton(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white" id="pip-volume-icon">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
            </svg>
        `);
        volumeBtn.id = 'pip-volume-btn';

        const fullscreenBtn = this.createButton(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
        `);

        rightControls.appendChild(volumeBtn);
        rightControls.appendChild(fullscreenBtn);

        controlsRow.appendChild(timeDisplay);
        controlsRow.appendChild(centerControls);
        controlsRow.appendChild(rightControls);

        bottomBar.appendChild(progressContainer);
        bottomBar.appendChild(controlsRow);

        overlay.appendChild(topBar);
        overlay.appendChild(bottomBar);
        container.appendChild(overlay);

        // Comprehensive right-click prevention for PiP window
        const preventRightClick = (e) => {
            const pipContainer = document.getElementById('custom-pip-container');
            if (pipContainer && pipContainer.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        };

        // Block right-click at multiple levels
        container.addEventListener("contextmenu", preventRightClick, true);
        document.addEventListener("contextmenu", preventRightClick, true);
        window.addEventListener("contextmenu", preventRightClick, true);

        // Block on iframe specifically
        iframe.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }, true);

        // Re-apply on fullscreen changes
        const applyFullscreenProtection = () => {
            document.addEventListener("contextmenu", preventRightClick, true);
            window.addEventListener("contextmenu", preventRightClick, true);
        };

        document.addEventListener("fullscreenchange", applyFullscreenProtection);
        document.addEventListener("webkitfullscreenchange", applyFullscreenProtection);
        document.addEventListener("mozfullscreenchange", applyFullscreenProtection);
        document.addEventListener("MSFullscreenChange", applyFullscreenProtection);

        // Clean up event listeners when PiP is closed
        const originalRemove = container.remove.bind(container);
        container.remove = function () {
            document.removeEventListener("contextmenu", preventRightClick, true);
            window.removeEventListener("contextmenu", preventRightClick, true);
            document.removeEventListener("fullscreenchange", applyFullscreenProtection);
            document.removeEventListener("webkitfullscreenchange", applyFullscreenProtection);
            document.removeEventListener("mozfullscreenchange", applyFullscreenProtection);
            document.removeEventListener("MSFullscreenChange", applyFullscreenProtection);
            originalRemove();
        };

        document.body.appendChild(container);

        // Initialize YouTube player
        setTimeout(() => {
            pipPlayerInstance = new YT.Player('pip-video-player', {
                events: {
                    'onReady': (event) => {
                        const player = event.target;

                        // Play/Pause
                        playBtn.onclick = () => {
                            const state = player.getPlayerState();
                            if (state === 1) {
                                player.pauseVideo();
                                document.getElementById('pip-play-icon').innerHTML = '<path d="M8 5v14l11-7z"/>';
                            } else {
                                player.playVideo();
                                document.getElementById('pip-play-icon').innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
                            }
                        };

                        // Rewind 10s
                        rewindBtn.onclick = () => {
                            const current = player.getCurrentTime();
                            player.seekTo(Math.max(0, current - 10), true);
                        };

                        // Forward 10s
                        forwardBtn.onclick = () => {
                            const current = player.getCurrentTime();
                            const duration = player.getDuration();
                            player.seekTo(Math.min(duration, current + 10), true);
                        };

                        // Volume toggle
                        volumeBtn.onclick = () => {
                            if (player.isMuted()) {
                                player.unMute();
                                document.getElementById('pip-volume-icon').innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
                            } else {
                                player.mute();
                                document.getElementById('pip-volume-icon').innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
                            }
                        };

                        // Fullscreen
                        fullscreenBtn.onclick = () => {
                            if (!document.fullscreenElement) {
                                container.requestFullscreen().catch(err => {
                                    console.error('Fullscreen error:', err);
                                });
                            } else {
                                document.exitFullscreen();
                            }
                        };

                        // Progress bar update
                        const updateProgress = () => {
                            const current = player.getCurrentTime();
                            const duration = player.getDuration();

                            if (duration > 0) {
                                const percent = (current / duration) * 100;
                                progressBar.style.width = percent + '%';

                                const formatTime = (sec) => {
                                    const mins = Math.floor(sec / 60);
                                    const secs = Math.floor(sec % 60);
                                    return mins + ':' + (secs < 10 ? '0' : '') + secs;
                                };

                                timeDisplay.textContent = formatTime(current) + ' / ' + formatTime(duration);
                            }
                        };

                        setInterval(updateProgress, 200);

                        // Seeking
                        progressContainer.onclick = (e) => {
                            const rect = progressContainer.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percent = clickX / rect.width;
                            const duration = player.getDuration();
                            player.seekTo(duration * percent, true);
                        };
                    }
                }
            });
        }, 500);

        // Auto-hide controls
        const showControls = () => {
            overlay.style.opacity = '1';
            clearTimeout(hideControlsTimeout);
            hideControlsTimeout = setTimeout(() => {
                overlay.style.opacity = '0';
            }, 3000);
        };

        container.onmouseenter = showControls;
        container.onmousemove = showControls;

        // Initial hide after 3s
        hideControlsTimeout = setTimeout(() => {
            overlay.style.opacity = '0';
        }, 3000);

        // Dragging
        this.makeDraggable(container, overlay);

        showToast('📺 Video detached');
    },

    createButton: function (html) {
        const btn = document.createElement('button');
        btn.innerHTML = html;
        btn.style.cssText = `
            background: rgba(0,0,0,0.6);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            padding: 0;
        `;
        btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.2)';
        btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,0.6)';
        return btn;
    },

    makeDraggable: function (element, overlay) {
        let isDragging = false;
        let offsetX, offsetY;

        element.onmousedown = (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'svg' || e.target.tagName === 'path' || e.target.closest('button')) {
                return;
            }
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            element.style.cursor = 'grabbing';
            overlay.style.opacity = '1';
        };

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            element.style.left = e.clientX - offsetX + 'px';
            element.style.top = e.clientY - offsetY + 'px';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'move';
            }
        });
    },

    quality: function (button) {
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content');
        const player = getPlayerForContainer(container);

        if (!player) {
            showToast('⚠️ Video player not ready. Please wait...');
            return;
        }

        button.classList.add('pulse-orange');
        setTimeout(() => button.classList.remove('pulse-orange'), 600);

        document.querySelectorAll('.quality-dropdown').forEach(menu => menu.remove());

        try {
            const availableQualityLevels = player.getAvailableQualityLevels();

            if (!availableQualityLevels || availableQualityLevels.length === 0) {
                showToast('⚠️ Quality settings not available');
                return;
            }

            const currentQuality = player.getPlaybackQuality();

            const qualityLabels = {
                'hd1080': '1080p',
                'hd720': '720p',
                'large': '480p',
                'medium': '360p',
                'small': '240p',
                'tiny': '144p',
                'auto': 'Auto'
            };

            const qualityOrder = ['hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
            const sortedQualities = qualityOrder.filter(q => availableQualityLevels.includes(q));
            sortedQualities.push('auto');

            const dropdown = document.createElement('div');
            dropdown.className = 'quality-dropdown';

            const buttonRect = button.getBoundingClientRect();
            const dropdownHeight = (sortedQualities.length * 36) + 16; // 36px per item + padding

            // Check if there is enough space above the button
            let topPosition = buttonRect.top - dropdownHeight - 10;
            if (topPosition < 10) {
                // If not enough space above, show it below the button
                topPosition = buttonRect.bottom + 10;
            }

            dropdown.style.cssText = `
                position: fixed;
                background: rgba(0, 0, 0, 0.95);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(210, 105, 30, 0.3);
                border-radius: 8px;
                padding: 8px 0;
                min-width: 140px;
                z-index: 2147483647;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                font-family: 'Raleway', sans-serif;
                left: ${Math.min(buttonRect.left, window.innerWidth - 150)}px;
                top: ${topPosition}px;
            `;

            sortedQualities.forEach(quality => {
                const item = document.createElement('div');
                const label = qualityLabels[quality] || quality;
                const isActive = quality === currentQuality;

                item.style.cssText = `
                    padding: 10px 20px;
                    cursor: pointer;
                    color: ${isActive ? '#D2691E' : '#fff'};
                    font-size: 14px;
                    font-weight: ${isActive ? '600' : '400'};
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: all 0.2s ease;
                    background: ${isActive ? 'rgba(210, 105, 30, 0.1)' : 'transparent'};
                `;

                item.innerHTML = `<span>${label}</span>${isActive ? '<span style="color: #D2691E;">✓</span>' : ''}`;

                item.onmouseenter = () => {
                    if (!isActive) item.style.background = 'rgba(255, 255, 255, 0.1)';
                };
                item.onmouseleave = () => {
                    if (!isActive) item.style.background = 'transparent';
                };

                item.onclick = () => {
                    try {
                        player.setPlaybackQuality(quality);
                        showToast(`📺 Quality: ${label}`);
                        dropdown.remove();
                    } catch (err) {
                        showToast('⚠️ Failed to change quality');
                    }
                };

                dropdown.appendChild(item);
            });

            document.body.appendChild(dropdown);

            const closeDropdown = (e) => {
                if (!dropdown.contains(e.target) && e.target !== button) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            };
            setTimeout(() => document.addEventListener('click', closeDropdown), 100);

        } catch (error) {
            console.error('Quality menu failed:', error);
        }
    },

    updatePlayButtonIcon: function (container, isPlaying) {
        const playIcon = container.querySelector('.play-icon');
        const pauseIcon = container.querySelector('.pause-icon');

        if (playIcon && pauseIcon) {
            if (isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        }
    },

    updateMuteButtonIcon: function (container, isMuted) {
        const soundOn = container.querySelector('.sound-on');
        const soundOff = container.querySelector('.sound-off');

        if (soundOn && soundOff) {
            if (isMuted) {
                soundOn.style.display = 'none';
                soundOff.style.display = 'block';
            } else {
                soundOn.style.display = 'block';
                soundOff.style.display = 'none';
            }
        }
    }
};

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadYouTubeAPI());
} else {
    loadYouTubeAPI();
}

document.addEventListener('popupOpened', () => {
    setTimeout(() => {
        if (isYouTubeAPIReady) initializeAllYouTubePlayers();
    }, 300);
});

console.log('📺 Custom YouTube video controls loaded');
