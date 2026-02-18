/**
 * CUSTOM YOUTUBE VIDEO CONTROLS
 * Native PiP-style player with auto-hiding overlay controls
 */

// Store all YouTube player instances and user preferences
window.youtubePlayersMap = window.youtubePlayersMap || new Map();
window.userSelectedQualities = window.userSelectedQualities || new Map();
window.initializingPlayers = window.initializingPlayers || new Set();

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
    console.log(`[YouTube] Found ${iframes.length} iframes to initialize`);

    iframes.forEach((iframe, index) => {
        // 1. Ensure unique, stable ID
        if (!iframe.id) {
            iframe.id = `yt-player-${index}-${Math.random().toString(36).substr(2, 9)}`;
        }

        const playerID = iframe.id;

        // 2. Skip if already fully initialized
        if (window.youtubePlayersMap.has(playerID)) {
            return;
        }

        // 3. Skip if currently in process of initializing
        if (window.initializingPlayers.has(playerID)) {
            return;
        }

        const videoId = extractVideoId(iframe.src);
        if (!videoId) return;

        try {
            // Ensure enablejsapi=1 is present (required for API)
            const currentSrc = iframe.src;
            if (!currentSrc.includes('enablejsapi=1')) {
                iframe.src = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 'enablejsapi=1';
            }

            console.log(`[YouTube] Initializing player: ${playerID}`);
            window.initializingPlayers.add(playerID);

            const player = new YT.Player(playerID, {
                events: {
                    'onReady': (event) => {
                        console.log(`✅ [YouTube] Player Ready: ${playerID}`);
                        window.youtubePlayersMap.set(playerID, event.target);
                        window.initializingPlayers.delete(playerID);

                        // Set default high quality (1080p)
                        try {
                            if (event.target.setPlaybackQualityRange) {
                                event.target.setPlaybackQualityRange('hd1080', 'hd1080');
                            } else {
                                event.target.setPlaybackQuality('hd1080');
                            }
                            window.userSelectedQualities.set(playerID, 'hd1080');
                        } catch (err) {
                            console.warn('[YouTube] Initial quality set error:', err);
                        }
                    },
                    'onStateChange': (event) => {
                        // When video starts playing (YT.PlayerState.PLAYING = 1)
                        if (event.data === 1) {
                            try {
                                const current = event.target.getPlaybackQuality();
                                console.log(`[YouTube] Player ${playerID} started playing. Current quality: ${current}`);

                                // Re-enforce 1080p if it's not already set or defaulted
                                if (current !== 'hd1080') {
                                    console.log(`[YouTube] Re-enforcing 1080p for ${playerID}`);
                                    if (event.target.setPlaybackQualityRange) {
                                        event.target.setPlaybackQualityRange('hd1080', 'hd1080');
                                    } else {
                                        event.target.setPlaybackQuality('hd1080');
                                    }
                                }
                            } catch (err) {
                                console.warn('[YouTube] State change quality error:', err);
                            }
                        }
                    },
                    'onError': (event) => {
                        console.error(`❌ [YouTube] Player Error (${playerID}):`, event.data);
                        window.initializingPlayers.delete(playerID);
                    }
                }
            });
        } catch (error) {
            console.error(`[YouTube] Constructor failed for ${playerID}:`, error);
            window.initializingPlayers.delete(playerID);
        }
    });
}

function getPlayerForContainer(container) {
    if (!container) return null;
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
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content, .youtube-embed');
        let player = getPlayerForContainer(container);

        if (!player) {
            const iframe = container?.querySelector('iframe');
            const isInitializing = iframe && iframe.id && window.initializingPlayers.has(iframe.id);

            if (isInitializing) {
                showToast('⏳ Video player still loading... one moment');
                return;
            }

            console.log('[YouTube] Player not found, forcing init...');
            initializeAllYouTubePlayers();

            // Try one more time after a short delay
            setTimeout(() => {
                player = getPlayerForContainer(container);
                if (player) {
                    this.executePlay(player, button, container);
                } else {
                    showToast('⚠️ Player failed to start. Please wait...');
                }
            }, 800);
            return;
        }

        this.executePlay(player, button, container);
    },

    executePlay: function (player, button, container) {
        try {
            const state = player.getPlayerState();
            button.classList.add('pulse-orange');
            setTimeout(() => button.classList.remove('pulse-orange'), 600);

            if (state === 1) { // Playing
                player.pauseVideo();
                this.updatePlayButtonIcon(container, false);
            } else {
                player.playVideo();
                this.updatePlayButtonIcon(container, true);
            }
        } catch (error) {
            console.error('[YouTube] Play/Pause action failed:', error);
            initializeAllYouTubePlayers();
        }
    },


    volume: function (button) {
        let container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content, .youtube-embed');
        let player = getPlayerForContainer(container);
        let isPiP = false;

        // Handle PiP case
        if (!player && (button.id === 'pip-volume-btn' || button.closest('#custom-pip-container'))) {
            player = pipPlayerInstance;
            container = document.getElementById('custom-pip-container');
            isPiP = true;
        }

        if (!player) {
            showToast('⚠️ Video player not ready. Please wait...');
            return;
        }

        button.classList.add('pulse-orange');
        setTimeout(() => button.classList.remove('pulse-orange'), 600);

        // Remove any existing dropdowns first
        document.querySelectorAll('.quality-dropdown, .volume-dropdown').forEach(menu => menu.remove());

        try {
            const currentVolume = player.isMuted() ? 0 : player.getVolume();

            const dropdown = document.createElement('div');
            dropdown.className = 'volume-dropdown';

            const buttonRect = button.getBoundingClientRect();
            // Taller for vertical slider
            const dropdownHeight = 180;
            const dropdownWidth = 46;

            let topPosition = buttonRect.top - dropdownHeight - 10;
            if (topPosition < 10) topPosition = buttonRect.bottom + 10;

            dropdown.style.cssText = `
                position: fixed;
                background: rgba(15, 15, 15, 0.98);
                backdrop-filter: blur(25px);
                border: 1px solid rgba(210, 105, 30, 0.4);
                border-radius: 20px;
                padding: 15px 0;
                width: ${dropdownWidth}px;
                height: ${dropdownHeight}px;
                z-index: 2147483647;
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.7);
                left: ${buttonRect.left + (buttonRect.width / 2) - (dropdownWidth / 2)}px;
                top: ${topPosition}px;
                animation: qualityFadeIn 0.2s ease-out;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: space-between;
            `;

            // Volume Icon at top of slider
            const iconDiv = document.createElement('div');
            iconDiv.style.color = '#fff';
            iconDiv.style.fontSize = '18px';
            iconDiv.style.marginBottom = '8px';
            iconDiv.innerHTML = currentVolume === 0 ? '🔇' : (currentVolume < 50 ? '🔈' : '🔊');

            // Slider Wrapper (for vertical layout)
            const sliderWrapper = document.createElement('div');
            sliderWrapper.style.cssText = `
                height: 120px;
                width: 4px;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                position: relative;
                cursor: pointer;
            `;

            const fillBar = document.createElement('div');
            fillBar.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: ${currentVolume}%;
                background: #D2691E;
                border-radius: 2px;
                transition: height 0.1s ease;
            `;

            const sliderKnob = document.createElement('div');
            sliderKnob.style.cssText = `
                position: absolute;
                left: 50%;
                bottom: ${currentVolume}%;
                transform: translate(-50%, 50%);
                width: 12px;
                height: 12px;
                background: #fff;
                border-radius: 50%;
                box-shadow: 0 0 10px rgba(210, 105, 30, 0.8);
                transition: bottom 0.1s ease;
            `;

            sliderWrapper.appendChild(fillBar);
            sliderWrapper.appendChild(sliderKnob);

            const updateVolume = (e) => {
                const rect = sliderWrapper.getBoundingClientRect();
                let percentage = (rect.bottom - e.clientY) / rect.height;
                percentage = Math.max(0, Math.min(1, percentage));
                const vol = Math.round(percentage * 100);

                player.unMute();
                player.setVolume(vol);
                if (vol === 0) player.mute();

                fillBar.style.height = vol + '%';
                sliderKnob.style.bottom = vol + '%';
                iconDiv.innerHTML = vol === 0 ? '🔇' : (vol < 50 ? '🔈' : '🔊');

                // Update main UI button icon
                const volBtnSvg = button.querySelector('svg');
                if (volBtnSvg) {
                    if (vol === 0) {
                        // Muted icon
                        volBtnSvg.innerHTML = `
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"></line>
                            <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"></line>
                        `;
                    } else {
                        // Active icon
                        volBtnSvg.innerHTML = `
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            ${vol > 50 ? '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>' : ''}
                        `;
                    }
                }

                // Update UI icons for PiP
                if (isPiP) {
                    const pipVolIcon = document.getElementById('pip-volume-icon');
                    if (pipVolIcon) {
                        if (vol === 0) pipVolIcon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
                        else pipVolIcon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
                    }
                }
            };

            let isDraggingSlider = false;
            sliderWrapper.onmousedown = (e) => {
                isDraggingSlider = true;
                updateVolume(e);
                e.preventDefault();
            };

            window.addEventListener('mousemove', (e) => {
                if (isDraggingSlider) updateVolume(e);
            });

            window.addEventListener('mouseup', () => {
                isDraggingSlider = false;
            });

            dropdown.appendChild(iconDiv);
            dropdown.appendChild(sliderWrapper);

            // Volume % label at bottom
            const percentLabel = document.createElement('div');
            percentLabel.style.cssText = `
                color: rgba(255,255,255,0.6);
                font-size: 10px;
                margin-top: 5px;
            `;
            const updatePercentLabel = () => {
                const vol = player.isMuted() ? 0 : player.getVolume();
                percentLabel.textContent = vol + '%';
            };
            setInterval(updatePercentLabel, 200);
            dropdown.appendChild(percentLabel);

            document.body.appendChild(dropdown);

            const closeDropdown = (e) => {
                if (!isDraggingSlider && !dropdown.contains(e.target) && e.target !== button) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            };
            setTimeout(() => document.addEventListener('click', closeDropdown), 100);

        } catch (error) {
            console.error('[YouTube] Volume menu error:', error);
            showToast('⚠️ Unable to load volume bar');
        }
    },

    detach: function (button) {
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content, .youtube-embed');
        const iframe = container?.querySelector('iframe[src*="youtube.com"]');
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
                player.pauseVideo();
                this.updatePlayButtonIcon(container, false);
            } catch (e) {
                console.warn('Could not interact with original player:', e);
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

    quality: function (button) {
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content, .youtube-embed');
        const player = getPlayerForContainer(container);
        const iframe = container?.querySelector('iframe');
        const playerID = iframe?.id;

        if (!player) {
            showToast('⚠️ Video player not ready. Please wait...');
            return;
        }

        button.classList.add('pulse-orange');
        setTimeout(() => button.classList.remove('pulse-orange'), 600);

        document.querySelectorAll('.quality-dropdown, .volume-dropdown').forEach(menu => menu.remove());

        try {
            const availableQualityLevels = player.getAvailableQualityLevels();
            console.log(`[YouTube] Available qualities for ${playerID}:`, availableQualityLevels);

            if (!availableQualityLevels || availableQualityLevels.length === 0) {
                showToast('⏳ Video still loading quality options...');
                return;
            }

            const currentQuality = window.userSelectedQualities.get(playerID) || player.getPlaybackQuality();

            const qualityLabels = {
                'highres': '4K / Original',
                'hd2160': '2160p (4K)',
                'hd1440': '1440p (2K)',
                'hd1080': '1080p (HD)',
                'hd720': '720p (HD)',
                'large': '480p',
                'medium': '360p',
                'small': '240p',
                'tiny': '144p',
                'auto': 'Auto'
            };

            const qualityOrder = ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
            const sortedQualities = qualityOrder.filter(q => availableQualityLevels.includes(q));
            if (!sortedQualities.includes('auto')) sortedQualities.push('auto');

            const dropdown = document.createElement('div');
            dropdown.className = 'quality-dropdown';

            const buttonRect = button.getBoundingClientRect();
            const dropdownHeight = (sortedQualities.length * 44) + 16;

            let topPosition = buttonRect.top - dropdownHeight - 10;
            if (topPosition < 10) topPosition = buttonRect.bottom + 10;

            dropdown.style.cssText = `
                position: fixed;
                background: rgba(15, 15, 15, 0.98);
                backdrop-filter: blur(25px);
                border: 1px solid rgba(210, 105, 30, 0.4);
                border-radius: 12px;
                padding: 10px 0;
                min-width: 170px;
                z-index: 2147483647;
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.7);
                font-family: 'Raleway', sans-serif;
                left: ${Math.max(10, Math.min(buttonRect.left, window.innerWidth - 180))}px;
                top: ${topPosition}px;
                animation: qualityFadeIn 0.2s ease-out;
            `;

            if (!document.getElementById('quality-animation-style')) {
                const style = document.createElement('style');
                style.id = 'quality-animation-style';
                style.textContent = `
                    @keyframes qualityFadeIn {
                        from { opacity: 0; transform: translateY(10px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }

            sortedQualities.forEach(quality => {
                const item = document.createElement('div');
                const label = qualityLabels[quality] || quality;
                const isActive = quality === currentQuality;

                item.style.cssText = `
                    padding: 12px 20px;
                    cursor: pointer;
                    color: ${isActive ? '#D2691E' : '#fff'};
                    font-size: 14px;
                    font-weight: ${isActive ? '700' : '500'};
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: all 0.2s ease;
                    background: ${isActive ? 'rgba(210, 105, 30, 0.15)' : 'transparent'};
                `;

                item.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 10px;">
                        ${isActive ? '<span style="width: 4px; height: 4px; background: #D2691E; border-radius: 50%;"></span>' : '<span style="width: 4px;"></span>'}
                        ${label}
                    </span>
                    ${isActive ? '<span style="color: #D2691E; font-size: 18px;">✓</span>' : ''}
                `;

                item.onmouseenter = () => { if (!isActive) { item.style.background = 'rgba(255, 255, 255, 0.1)'; item.style.color = '#D2691E'; } };
                item.onmouseleave = () => { if (!isActive) { item.style.background = 'transparent'; item.style.color = '#fff'; } };

                item.onclick = () => {
                    try {
                        player.setPlaybackQuality(quality);
                        if (quality !== 'auto' && player.setPlaybackQualityRange) {
                            player.setPlaybackQualityRange(quality, quality);
                        }
                        window.userSelectedQualities.set(playerID, quality);
                        showToast(`📺 Quality set to ${label}`);
                        dropdown.remove();
                    } catch (err) {
                        showToast('⚠️ Quality restricted by YouTube');
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
            console.error('[YouTube] Quality menu error:', error);
            showToast('⚠️ Unable to load quality settings');
        }
    },

    updatePlayButtonIcon: function (container, isPlaying) {
        if (!container) return;
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
            box-shadow: 0 12px 48px rgba(0,0,0,0.6);
            z-index: 2147483647;
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

        // Overlay to block iframe right-click
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
        iframeBlocker.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
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

        // Top bar
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

        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

        const timeDisplay = document.createElement('div');
        timeDisplay.id = 'pip-time-display';
        timeDisplay.style.cssText = `
            color: white;
            font-size: 13px;
            font-family: Arial, sans-serif;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        `;
        timeDisplay.textContent = '0:00 / 0:00';

        const centerControls = document.createElement('div');
        centerControls.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        const rewindBtn = this.createButton(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.1 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s-.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/>
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
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8zm-.86 11h-.85v-3.26l-1.01.31v-.69l1.77-.63h.09V16zm4.28-1.76c0 .32-.03.6-.1.82s-.17.42-.29.57-.28.26-.45.33-.37.1-.59.1-.41-.03-.59-.1-.33-.18-.46-.33-.23-.34-.3-.57-.11-.5-.11-.82v-.74c0-.32.03-.6.1-.82s.17-.42.29-.57.28-.26.45-.33.37-.1.59-.1.41.03.59.1.33.18.46.33.23.34.3.57.11.5.11.82v.74zm-.85-.86c0-.19-.01-.35-.04-.48s-.07-.23-.12-.31-.11-.14-.19-.17-.16-.05-.25-.05-.18.02-.25.05-.14.09-.19.17-.09.18-.12.31-.04.29-.04.48v.97c0 .19.01.35.04.48s-.07.24.12.32.11.14.19.17.16.05.25.05.18-.02.25-.05.14-.09.19-.17.09-.19.11-.32.04-.29.04-.48v-.97z"/>
            </svg>
        `);

        centerControls.appendChild(rewindBtn);
        centerControls.appendChild(playBtn);
        centerControls.appendChild(forwardBtn);

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

        document.body.appendChild(container);

        setTimeout(() => {
            pipPlayerInstance = new YT.Player('pip-video-player', {
                events: {
                    'onReady': (event) => {
                        const player = event.target;

                        playBtn.onclick = () => {
                            if (player.getPlayerState() === 1) {
                                player.pauseVideo();
                                document.getElementById('pip-play-icon').innerHTML = '<path d="M8 5v14l11-7z"/>';
                            } else {
                                player.playVideo();
                                document.getElementById('pip-play-icon').innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
                            }
                        };

                        rewindBtn.onclick = () => player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
                        forwardBtn.onclick = () => player.seekTo(Math.min(player.getDuration(), player.getCurrentTime() + 10), true);

                        volumeBtn.onclick = () => {
                            window.customVideoControls.volume(volumeBtn);
                        };

                        fullscreenBtn.onclick = () => {
                            if (!document.fullscreenElement) container.requestFullscreen();
                            else document.exitFullscreen();
                        };

                        setInterval(() => {
                            const cur = player.getCurrentTime();
                            const dur = player.getDuration();
                            if (dur > 0) {
                                progressBar.style.width = (cur / dur * 100) + '%';
                                const fmt = (s) => Math.floor(s / 60) + ':' + (Math.floor(s % 60)).toString().padStart(2, '0');
                                timeDisplay.textContent = `${fmt(cur)} / ${fmt(dur)}`;
                            }
                        }, 200);

                        progressContainer.onclick = (e) => {
                            const rect = progressContainer.getBoundingClientRect();
                            player.seekTo(player.getDuration() * ((e.clientX - rect.left) / rect.width), true);
                        };
                    }
                }
            });
        }, 500);

        // Auto-hide controls
        container.onmousemove = () => {
            overlay.style.opacity = '1';
            clearTimeout(hideControlsTimeout);
            hideControlsTimeout = setTimeout(() => overlay.style.opacity = '0', 3000);
        };

        this.makeDraggable(container, overlay);
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
            if (e.target.closest('button')) return;
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            element.style.cursor = 'grabbing';
            if (overlay) overlay.style.opacity = '1';
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
    }
};

// Global initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadYouTubeAPI());
} else {
    loadYouTubeAPI();
}

document.addEventListener('popupOpened', () => {
    setTimeout(() => {
        if (isYouTubeAPIReady) initializeAllYouTubePlayers();
    }, 400);
});

console.log('📺 Custom YouTube video controls loaded');
