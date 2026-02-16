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

        // Try to get the video element from the iframe
        try {
            // For YouTube iframes, we need to open the video in a new window for PiP
            const videoId = extractVideoId(iframe.src);

            if (!videoId) {
                showToast('⚠️ Unable to detach video');
                return;
            }

            // Get current playback time
            let currentTime = 0;
            if (player) {
                try {
                    currentTime = player.getCurrentTime();
                } catch (e) {
                    console.warn('Could not get current time:', e);
                }
            }

            // Create a floating window with YouTube embed optimized for PiP
            const pipWidth = 480;
            const pipHeight = 270;
            const screenWidth = window.screen.width;
            const screenHeight = window.screen.height;
            const left = screenWidth - pipWidth - 20;
            const top = screenHeight - pipHeight - 80;

            const pipWindow = window.open(
                '',
                'YouTube PiP',
                `width=${pipWidth},height=${pipHeight},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=yes`
            );

            if (pipWindow) {
                // Build the PiP window content
                pipWindow.document.write(`
                    <!DOCTYPE html>
                    <html style="margin:0;padding:0;overflow:hidden;">
                    <head>
                        <title>Video - Picture in Picture</title>
                        <style>
                            body { margin: 0; padding: 0; overflow: hidden; background: #000; }
                            iframe { width: 100vw; height: 100vh; border: none; }
                        </style>
                    </head>
                    <body>
                        <iframe 
                            src="https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(currentTime)}&controls=1&modestbranding=1&rel=0&enablejsapi=1"
                            frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowfullscreen>
                        </iframe>
                    </body>
                    </html>
                `);
                pipWindow.document.close();

                showToast('📺 Video detached to floating window');
                console.log('✅ Video detached successfully');
            } else {
                showToast('⚠️ Please allow pop-ups to detach video');
            }
        } catch (error) {
            console.error('Detach failed:', error);
            showToast('⚠️ Unable to detach video');
        }
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
