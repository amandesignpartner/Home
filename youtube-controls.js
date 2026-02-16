/**
 * CUSTOM YOUTUBE VIDEO CONTROLS
 * Native HTML5-style player with custom overlay controls
 */

// Store all YouTube player instances
window.youtubePlayersMap = new Map();
let isYouTubeAPIReady = false;

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
            console.log(`Player ${iframe.id} already initialized`);
            return;
        }

        const videoId = extractVideoId(iframe.src);
        if (!videoId) {
            console.warn(`Could not extract video ID from: ${iframe.src}`);
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
                    },
                    'onError': (event) => {
                        console.error(`❌ Player ${iframe.id} error:`, event.data);
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
    if (!iframe) return null;
    if (!iframe.id) return null;

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
            showToast('⚠️ Unable to control video');
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
            showToast('📺 Video reattached');
            return;
        }

        this.createCustomPlayer(videoId, currentTime);
    },

    createCustomPlayer: function (videoId, startTime) {
        const pipContainer = document.createElement('div');
        pipContainer.id = 'custom-pip-container';
        pipContainer.className = 'player-container';
        pipContainer.style.cssText = `
            position: fixed;
            width: 480px;
            height: 270px;
            bottom: 20px;
            right: 20px;
            background: black;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            cursor: move;
            z-index: 999999;
            user-select: none;
        `;

        // YouTube iframe (no controls, hidden branding)
        const videoFrame = document.createElement('iframe');
        videoFrame.id = 'pip-youtube-player';
        videoFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(startTime)}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1`;
        videoFrame.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            pointer-events: none;
        `;
        videoFrame.setAttribute('frameborder', '0');
        videoFrame.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope');

        pipContainer.appendChild(videoFrame);

        // Overlay controls
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        overlay.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            pointer-events: none;
        `;

        // Top controls
        const topControls = document.createElement('div');
        topControls.className = 'top-controls';
        topControls.style.cssText = `
            display: flex;
            justify-content: space-between;
            padding: 10px;
            pointer-events: auto;
        `;

        const reattachBtn = this.createIconButton('↩', 'Reattach');
        reattachBtn.onclick = () => {
            pipContainer.remove();
            showToast('📺 Video reattached');
        };

        const closeBtn = this.createIconButton('✕', 'Close');
        closeBtn.onclick = () => {
            pipContainer.remove();
            showToast('📺 Video closed');
        };

        topControls.appendChild(reattachBtn);
        topControls.appendChild(closeBtn);

        // Center controls
        const centerControls = document.createElement('div');
        centerControls.className = 'center-controls';
        centerControls.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 40px;
            pointer-events: auto;
        `;

        const rewindBtn = this.createIconButton('⏪', 'Rewind 10s');
        const playBtn = this.createIconButton('▶', 'Play', true);
        playBtn.id = 'pip-play-btn';
        const forwardBtn = this.createIconButton('⏩', 'Forward 10s');

        centerControls.appendChild(rewindBtn);
        centerControls.appendChild(playBtn);
        centerControls.appendChild(forwardBtn);

        // Bottom controls
        const bottomControls = document.createElement('div');
        bottomControls.className = 'bottom-controls';
        bottomControls.style.cssText = `
            background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
            padding: 8px;
            pointer-events: auto;
        `;

        const progress = document.createElement('div');
        progress.className = 'progress';
        progress.id = 'pip-progress';
        progress.style.cssText = `
            width: 100%;
            height: 5px;
            background: rgba(255,255,255,0.3);
            border-radius: 4px;
            cursor: pointer;
            margin-bottom: 6px;
        `;

        const progressFilled = document.createElement('div');
        progressFilled.className = 'progress-filled';
        progressFilled.id = 'pip-progress-filled';
        progressFilled.style.cssText = `
            height: 100%;
            width: 0%;
            background: #ff0000;
            border-radius: 4px;
            transition: width 0.1s;
        `;
        progress.appendChild(progressFilled);

        const controlRow = document.createElement('div');
        controlRow.className = 'control-row';
        controlRow.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: white;
        `;

        const timeDisplay = document.createElement('span');
        timeDisplay.id = 'pip-time';
        timeDisplay.style.cssText = 'font-size: 12px;';
        timeDisplay.textContent = '0:00 / 0:00';

        const rightControls = document.createElement('div');
        rightControls.style.cssText = 'display: flex; gap: 8px;';

        const volumeBtn = this.createIconButton('🔊', 'Mute');
        volumeBtn.id = 'pip-volume-btn';
        const fullscreenBtn = this.createIconButton('⛶', 'Fullscreen');

        rightControls.appendChild(volumeBtn);
        rightControls.appendChild(fullscreenBtn);

        controlRow.appendChild(timeDisplay);
        controlRow.appendChild(rightControls);

        bottomControls.appendChild(progress);
        bottomControls.appendChild(controlRow);

        overlay.appendChild(topControls);
        overlay.appendChild(centerControls);
        overlay.appendChild(bottomControls);
        pipContainer.appendChild(overlay);

        // Disable right-click
        pipContainer.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };

        document.body.appendChild(pipContainer);

        // Initialize YouTube player for PiP window
        setTimeout(() => {
            const pipPlayer = new YT.Player('pip-youtube-player', {
                events: {
                    'onReady': (event) => {
                        const player = event.target;

                        // Play/Pause
                        playBtn.onclick = () => {
                            const state = player.getPlayerState();
                            if (state === 1) {
                                player.pauseVideo();
                                playBtn.textContent = '▶';
                            } else {
                                player.playVideo();
                                playBtn.textContent = '❚❚';
                            }
                        };

                        // Rewind
                        rewindBtn.onclick = () => {
                            player.seekTo(player.getCurrentTime() - 10, true);
                        };

                        // Forward
                        forwardBtn.onclick = () => {
                            player.seekTo(player.getCurrentTime() + 10, true);
                        };

                        // Volume
                        volumeBtn.onclick = () => {
                            if (player.isMuted()) {
                                player.unMute();
                                volumeBtn.textContent = '🔊';
                            } else {
                                player.mute();
                                volumeBtn.textContent = '🔇';
                            }
                        };

                        // Progress bar
                        setInterval(() => {
                            const current = player.getCurrentTime();
                            const duration = player.getDuration();
                            if (duration > 0) {
                                const percent = (current / duration) * 100;
                                progressFilled.style.width = percent + '%';
                                timeDisplay.textContent = this.formatTime(current) + ' / ' + this.formatTime(duration);
                            }
                        }, 200);

                        // Seek
                        progress.onclick = (e) => {
                            const rect = progress.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const width = progress.clientWidth;
                            const duration = player.getDuration();
                            const seekTime = (clickX / width) * duration;
                            player.seekTo(seekTime, true);
                        };

                        // Fullscreen
                        fullscreenBtn.onclick = () => {
                            if (!document.fullscreenElement) {
                                pipContainer.requestFullscreen();
                            } else {
                                document.exitFullscreen();
                            }
                        };
                    }
                }
            });
        }, 500);

        // Dragging
        this.makeDraggable(pipContainer);

        showToast('📺 Video detached');
    },

    createIconButton: function (text, title, isLarge = false) {
        const btn = document.createElement('button');
        btn.className = 'icon-btn';
        btn.textContent = text;
        btn.title = title;
        btn.style.cssText = `
            background: rgba(0,0,0,0.6);
            color: white;
            border: none;
            width: ${isLarge ? '60px' : '34px'};
            height: ${isLarge ? '60px' : '34px'};
            border-radius: 50%;
            cursor: pointer;
            font-size: ${isLarge ? '22px' : '16px'};
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        `;
        btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.2)';
        btn.onmouseleave = () => btn.style.background = 'rgba(0,0,0,0.6)';
        return btn;
    },

    formatTime: function (seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    },

    makeDraggable: function (element) {
        let isDragging = false;
        let offsetX, offsetY;

        element.onmousedown = (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'IFRAME') return;
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            element.style.cursor = 'grabbing';
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
            dropdown.style.cssText = `
                position: absolute;
                background: rgba(0, 0, 0, 0.95);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(210, 105, 30, 0.3);
                border-radius: 8px;
                padding: 8px 0;
                min-width: 120px;
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                font-family: 'Raleway', sans-serif;
            `;

            const buttonRect = button.getBoundingClientRect();
            dropdown.style.left = buttonRect.left + 'px';
            dropdown.style.top = (buttonRect.top - (sortedQualities.length * 36) - 10) + 'px';

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

                item.innerHTML = `
                    <span>${label}</span>
                    ${isActive ? '<span style="color: #D2691E;">✓</span>' : ''}
                `;

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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadYouTubeAPI());
} else {
    loadYouTubeAPI();
}

// Initialize when popups open
document.addEventListener('popupOpened', () => {
    setTimeout(() => {
        if (isYouTubeAPIReady) initializeAllYouTubePlayers();
    }, 300);
});

// Disable right-click globally
document.addEventListener('contextmenu', e => {
    if (e.target.closest('#custom-pip-container')) {
        e.preventDefault();
        return false;
    }
});

// Disable common devtools shortcuts on PiP
document.addEventListener('keydown', function (e) {
    const pipContainer = document.getElementById('custom-pip-container');
    if (!pipContainer) return;

    if (e.key === 'F12') e.preventDefault();
    if (e.ctrlKey && e.shiftKey && e.key === 'I') e.preventDefault();
    if (e.ctrlKey && e.key === 'u') e.preventDefault();
});

console.log('📺 Custom YouTube video controls loaded');
