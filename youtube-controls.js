/**
 * CUSTOM YOUTUBE VIDEO CONTROLS
 * Direct YouTube IFrame API implementation
 * Works without Plyr - simpler and more reliable
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

    // Initialize any existing iframes that are waiting
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

        // Check if already initialized
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
            // Update iframe src to ensure enablejsapi is set
            const currentSrc = iframe.src;
            if (!currentSrc.includes('enablejsapi=1')) {
                iframe.src = currentSrc + (currentSrc.includes('?') ? '&' : '?') + 'enablejsapi=1';
            }

            // Create YT.Player instance
            const player = new YT.Player(iframe.id, {
                events: {
                    'onReady': (event) => {
                        console.log(`✅ Player ${iframe.id} is ready`);
                        window.youtubePlayersMap.set(iframe.id, event.target);

                        // Set default quality to 1080p HD
                        try {
                            const availableLevels = event.target.getAvailableQualityLevels();
                            if (availableLevels.includes('hd1080')) {
                                event.target.setPlaybackQuality('hd1080');
                                console.log(`📺 Set default quality to 1080p HD for ${iframe.id}`);
                            } else if (availableLevels.includes('hd720')) {
                                event.target.setPlaybackQuality('hd720');
                                console.log(`📺 Set default quality to 720p HD for ${iframe.id}`);
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

// Get player for a specific video container
function getPlayerForContainer(container) {
    const iframe = container.querySelector('iframe[src*="youtube.com"]');
    if (!iframe) {
        console.error('No YouTube iframe found in container');
        return null;
    }

    if (!iframe.id) {
        console.error('Iframe has no ID');
        return null;
    }

    const player = window.youtubePlayersMap.get(iframe.id);
    if (!player) {
        console.warn(`Player not found for ${iframe.id}, attempting to initialize...`);
        // Try to initialize this specific player
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
            setTimeout(() => {
                initializeAllYouTubePlayers();
            }, 500);
            return;
        }

        try {
            const state = player.getPlayerState();

            // Update button visual
            button.classList.add('pulse-orange');
            setTimeout(() => button.classList.remove('pulse-orange'), 600);

            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            if (state === 1) {
                // Currently playing, so pause
                player.pauseVideo();
                this.updatePlayButtonIcon(container, false);
                console.log('⏸ Video paused');
            } else {
                // Not playing, so play
                player.playVideo();
                this.updatePlayButtonIcon(container, true);
                console.log('▶ Video playing');
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
                // Currently muted, so unmute
                player.unMute();
                player.setVolume(100);
                this.updateMuteButtonIcon(container, false);
                console.log('🔊 Video unmuted');
            } else {
                // Not muted, so mute
                player.mute();
                this.updateMuteButtonIcon(container, true);
                console.log('🔇 Video muted');
            }
        } catch (error) {
            console.error('Mute/Unmute failed:', error);
            showToast('⚠️ Unable to control audio');
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

        // Create or toggle custom PiP window
        let pipContainer = document.getElementById('custom-pip-container');

        if (pipContainer) {
            // Toggle off if already open
            pipContainer.remove();
            showToast('📺 Video reattached');
            return;
        }

        this.createPiPWindow(videoId, currentTime);
    },

    createPiPWindow: function (videoId, startTime) {
        const pipContainer = document.createElement('div');
        pipContainer.id = 'custom-pip-container';
        pipContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 480px;
            height: 300px;
            z-index: 999999;
            background: #000;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
            resize: both;
            min-width: 320px;
            min-height: 200px;
            max-width: 800px;
            max-height: 500px;
            display: flex;
            flex-direction: column;
        `;

        // Video container (YouTube iframe without branding)
        const videoContainer = document.createElement('div');
        videoContainer.style.cssText = `
            position: relative;
            flex: 1;
            background: #000;
            overflow: hidden;
        `;

        const pipIframe = document.createElement('iframe');
        // Remove YouTube branding and controls - we'll add custom ones
        pipIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(startTime)}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&enablejsapi=1`;
        pipIframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            pointer-events: auto;
        `;
        pipIframe.setAttribute('frameborder', '0');
        pipIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope');
        pipIframe.setAttribute('allowfullscreen', '');

        // Disable right-click on iframe
        pipIframe.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };

        videoContainer.appendChild(pipIframe);

        // Top control bar with reattach and close buttons
        const topBar = document.createElement('div');
        topBar.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 40px;
            background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            opacity: 0;
            transition: opacity 0.3s;
            z-index: 10;
            cursor: move;
        `;

        // Reattach button (left)
        const reattachBtn = document.createElement('button');
        reattachBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/>
            </svg>
        `;
        reattachBtn.title = 'Reattach to page';
        reattachBtn.style.cssText = `
            background: rgba(0, 0, 0, 0.6);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        `;
        reattachBtn.onmouseenter = () => reattachBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        reattachBtn.onmouseleave = () => reattachBtn.style.background = 'rgba(0, 0, 0, 0.6)';
        reattachBtn.onclick = (e) => {
            e.stopPropagation();
            pipContainer.remove();
            showToast('📺 Video reattached');
        };

        // Close button (right)
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.title = 'Close';
        closeBtn.style.cssText = `
            background: rgba(0, 0, 0, 0.6);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 24px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255, 0, 0, 0.8)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(0, 0, 0, 0.6)';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            pipContainer.remove();
            showToast('📺 Video closed');
        };

        topBar.appendChild(reattachBtn);
        topBar.appendChild(closeBtn);
        videoContainer.appendChild(topBar);

        // Show controls on hover
        pipContainer.onmouseenter = () => {
            topBar.style.opacity = '1';
        };
        pipContainer.onmouseleave = () => {
            topBar.style.opacity = '0';
        };

        // Dragging functionality
        let isDragging = false;
        let initialX, initialY;

        topBar.onmousedown = (e) => {
            if (e.target === closeBtn || e.target === reattachBtn || e.target.closest('button')) return;
            isDragging = true;
            initialX = e.clientX - pipContainer.offsetLeft;
            initialY = e.clientY - pipContainer.offsetTop;
            pipContainer.style.cursor = 'grabbing';
        };

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const newLeft = e.clientX - initialX;
                const newTop = e.clientY - initialY;

                // Keep within viewport
                const maxLeft = window.innerWidth - pipContainer.offsetWidth;
                const maxTop = window.innerHeight - pipContainer.offsetHeight;

                pipContainer.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
                pipContainer.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
                pipContainer.style.bottom = 'auto';
                pipContainer.style.right = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                pipContainer.style.cursor = 'default';
            }
        });

        // Disable right-click on entire container
        pipContainer.oncontextmenu = (e) => {
            e.preventDefault();
            return false;
        };

        pipContainer.appendChild(videoContainer);
        document.body.appendChild(pipContainer);

        showToast('📺 Video detached');
        console.log('✅ PiP window activated');
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

        // Remove any existing quality menus
        document.querySelectorAll('.quality-dropdown').forEach(menu => menu.remove());

        try {
            // Get available quality levels
            const availableQualityLevels = player.getAvailableQualityLevels();

            if (!availableQualityLevels || availableQualityLevels.length === 0) {
                showToast('⚠️ Quality settings not available');
                console.warn('No quality levels available');
                return;
            }

            // Get current quality
            const currentQuality = player.getPlaybackQuality();

            // Quality labels
            const qualityLabels = {
                'hd1080': '1080p',
                'hd720': '720p',
                'large': '480p',
                'medium': '360p',
                'small': '240p',
                'tiny': '144p',
                'auto': 'Auto'
            };

            // Quality order for display (highest to lowest)
            const qualityOrder = ['hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
            const sortedQualities = qualityOrder.filter(q => availableQualityLevels.includes(q));
            sortedQualities.push('auto'); // Add auto at the end

            // Create dropdown menu
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

            // Position the dropdown near the button
            const buttonRect = button.getBoundingClientRect();
            dropdown.style.left = buttonRect.left + 'px';
            dropdown.style.top = (buttonRect.top - (sortedQualities.length * 36) - 10) + 'px';

            // Create menu items
            sortedQualities.forEach(quality => {
                const item = document.createElement('div');
                const label = qualityLabels[quality] || quality;
                const isActive = quality === currentQuality;

                item.className = 'quality-item';
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

                // Hover effect
                item.onmouseenter = () => {
                    if (!isActive) {
                        item.style.background = 'rgba(255, 255, 255, 0.1)';
                    }
                };
                item.onmouseleave = () => {
                    if (!isActive) {
                        item.style.background = 'transparent';
                    }
                };

                // Click handler
                item.onclick = () => {
                    try {
                        player.setPlaybackQuality(quality);
                        showToast(`📺 Quality: ${label}`);
                        console.log(`Quality changed to: ${label}`);
                        dropdown.remove();
                    } catch (err) {
                        console.error('Failed to set quality:', err);
                        showToast('⚠️ Failed to change quality');
                    }
                };

                dropdown.appendChild(item);
            });

            // Add to document
            document.body.appendChild(dropdown);

            // Close dropdown when clicking outside
            const closeDropdown = (e) => {
                if (!dropdown.contains(e.target) && e.target !== button) {
                    dropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            };
            setTimeout(() => {
                document.addEventListener('click', closeDropdown);
            }, 100);

        } catch (error) {
            console.error('Quality menu failed:', error);
            showToast('⚠️ Unable to show quality settings');
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
    document.addEventListener('DOMContentLoaded', () => {
        loadYouTubeAPI();
    });
} else {
    loadYouTubeAPI();
}

// Also initialize when popups open
document.addEventListener('popupOpened', () => {
    setTimeout(() => {
        if (isYouTubeAPIReady) {
            initializeAllYouTubePlayers();
        }
    }, 300);
});

console.log('📺 Custom YouTube video controls loaded');
