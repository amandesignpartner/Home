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
        showToast('ℹ️ Picture-in-Picture for YouTube embedded videos is limited. Please use fullscreen mode instead.');

        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content');
        const iframe = container.querySelector('iframe[src*="youtube.com"]');

        if (iframe) {
            // Request fullscreen as alternative to PiP
            if (iframe.requestFullscreen) {
                iframe.requestFullscreen().catch(err => {
                    console.error('Fullscreen failed:', err);
                    showToast('⚠️ Fullscreen not available');
                });
            } else if (iframe.webkitRequestFullscreen) {
                iframe.webkitRequestFullscreen();
            } else if (iframe.mozRequestFullScreen) {
                iframe.mozRequestFullScreen();
            } else if (iframe.msRequestFullscreen) {
                iframe.msRequestFullscreen();
            }
        }
    },

    quality: function (button) {
        const container = button.closest('.video-gallery-item, .intro-video-embed, .sticky-content');
        const player = getPlayerForContainer(container);

        if (!player) {
            showToast('⚠️ Video player not ready. Please wait...');
            return;
        }

        try {
            button.classList.add('pulse-orange');
            setTimeout(() => button.classList.remove('pulse-orange'), 600);

            // Get available quality levels
            const availableQualityLevels = player.getAvailableQualityLevels();

            if (!availableQualityLevels || availableQualityLevels.length === 0) {
                showToast('⚠️ Quality settings not available');
                console.warn('No quality levels available');
                return;
            }

            // Get current quality
            const currentQuality = player.getPlaybackQuality();

            // Quality levels in order of preference: hd1080, hd720, large (480p), medium (360p), small (240p), tiny (144p)
            const qualityOrder = ['hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
            const qualityLabels = {
                'hd1080': '1080p HD',
                'hd720': '720p HD',
                'large': '480p',
                'medium': '360p',
                'small': '240p',
                'tiny': '144p',
                'auto': 'Auto'
            };

            // Filter to only available qualities in our preferred order
            const availableQualities = qualityOrder.filter(q => availableQualityLevels.includes(q));

            // Add 'auto' as an option
            availableQualities.push('auto');

            // Find current index
            let currentIndex = availableQualities.indexOf(currentQuality);
            if (currentIndex === -1) currentIndex = 0;

            // Cycle to next quality
            const nextIndex = (currentIndex + 1) % availableQualities.length;
            const nextQuality = availableQualities[nextIndex];

            // Set the new quality
            player.setPlaybackQuality(nextQuality);

            // Show notification
            const qualityLabel = qualityLabels[nextQuality] || nextQuality;
            showToast(`📺 Quality: ${qualityLabel}`);
            console.log(`Quality changed to: ${qualityLabel}`);

        } catch (error) {
            console.error('Quality change failed:', error);
            showToast('⚠️ Unable to change quality');
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
