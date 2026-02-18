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

                        // Set default high quality
                        try {
                            const availableLevels = event.target.getAvailableQualityLevels();
                            if (availableLevels.includes('hd1080')) {
                                event.target.setPlaybackQuality('hd1080');
                            } else if (availableLevels.includes('hd720')) {
                                event.target.setPlaybackQuality('hd720');
                            }
                        } catch (err) {
                            console.warn('[YouTube] Quality set error:', err);
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

    mute: function (button) {
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content, .youtube-embed');
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

        document.querySelectorAll('.quality-dropdown').forEach(menu => menu.remove());

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

    updateMuteButtonIcon: function (container, isMuted) {
        if (!container) return;
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

        const iframe = document.createElement('iframe');
        iframe.id = 'pip-video-player';
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(startTime)}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1`;
        iframe.style.cssText = `width: 100%; height: 100%; border: none;`;
        iframe.setAttribute('allow', 'autoplay; encrypted-media');
        container.appendChild(iframe);

        const iframeBlocker = document.createElement('div');
        iframeBlocker.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; background: transparent; pointer-events: auto;`;
        iframeBlocker.addEventListener('contextmenu', (e) => e.preventDefault(), true);
        container.appendChild(iframeBlocker);

        const overlay = document.createElement('div');
        overlay.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.6) 100%); opacity: 1; transition: opacity 0.3s; pointer-events: none; z-index: 2;`;

        const topBar = document.createElement('div');
        topBar.style.cssText = `position: absolute; top: 0; left: 0; right: 0; padding: 12px; display: flex; justify-content: space-between; pointer-events: auto;`;

        const pipBtn = this.createButton(`<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></svg>`);
        pipBtn.onclick = () => { container.remove(); pipPlayerInstance = null; showToast('📺 Video reattached'); };

        const closeBtn = this.createButton('✕');
        closeBtn.style.fontSize = '20px';
        closeBtn.onclick = () => { container.remove(); pipPlayerInstance = null; showToast('📺 Video closed'); };

        topBar.appendChild(pipBtn);
        topBar.appendChild(closeBtn);

        const bottomBar = document.createElement('div');
        bottomBar.style.cssText = `position: absolute; bottom: 0; left: 0; right: 0; padding: 12px; pointer-events: auto;`;

        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; cursor: pointer; margin-bottom: 10px; position: relative;`;

        const progressBar = document.createElement('div');
        progressBar.style.cssText = `height: 100%; width: 0%; background: #2196F3; border-radius: 2px;`;
        progressContainer.appendChild(progressBar);

        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;

        const timeDisplay = document.createElement('div');
        timeDisplay.style.cssText = `color: white; font-size: 13px; font-family: Arial, sans-serif;`;
        timeDisplay.textContent = '0:00 / 0:00';

        const playBtn = this.createButton(`<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path id="pip-play-path" d="M8 5v14l11-7z"/></svg>`);

        controlsRow.appendChild(timeDisplay);
        controlsRow.appendChild(playBtn);

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
                                document.getElementById('pip-play-path').setAttribute('d', 'M8 5v14l11-7z');
                            } else {
                                player.playVideo();
                                document.getElementById('pip-play-path').setAttribute('d', 'M6 4h4v16H6V4zm8 0h4v16h-4V4z');
                            }
                        };
                        setInterval(() => {
                            const current = player.getCurrentTime();
                            const duration = player.getDuration();
                            if (duration > 0) {
                                progressBar.style.width = (current / duration * 100) + '%';
                                const fmt = (s) => Math.floor(s / 60) + ':' + (Math.floor(s % 60)).toString().padStart(2, '0');
                                timeDisplay.textContent = fmt(current) + ' / ' + fmt(duration);
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

        this.makeDraggable(container, overlay);
    },

    createButton: function (html) {
        const btn = document.createElement('button');
        btn.innerHTML = html;
        btn.style.cssText = `background: rgba(0,0,0,0.6); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s; padding: 0;`;
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
