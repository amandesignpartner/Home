// 360 View Aggressive Preloading and Caching System
(function () {
    'use strict';

    // Register Service Worker for aggressive caching
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw-360-cache.js')
                .then((registration) => {
                    console.log('360 View Cache: Service Worker registered successfully');

                    // Force immediate caching of all resources
                    if (registration.active) {
                        registration.active.postMessage({ action: 'cacheAll' });
                    }

                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                console.log('360 View Cache: New service worker activated');
                                // Force cache all resources again
                                newWorker.postMessage({ action: 'cacheAll' });
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.log('360 View Cache: Service Worker registration failed:', error);
                });
        });
    }

    // Aggressively preload iframe and all its resources immediately
    window.addEventListener('load', () => {
        const iframe360 = document.getElementById('iframe360View');

        if (iframe360) {
            console.log('360 View Preload: Starting aggressive preload...');

            // Monitor iframe loading
            iframe360.addEventListener('load', () => {
                console.log('360 View Preload: Iframe loaded successfully');

                // 1. Immediately send MUTE and PAUSE messages via postMessage (Cross-origin safe)
                try {
                    if (iframe360.contentWindow) {
                        iframe360.contentWindow.postMessage({ action: 'mute' }, '*');
                        iframe360.contentWindow.postMessage({ action: 'pause' }, '*');
                        console.log('360 View Preload: Sent initial silence commands');
                    }
                } catch (e) {
                    console.log('360 View Preload: Could not send initial silence commands');
                }

                // 2. Try direct access (only works if same-origin)
                try {
                    const iframeDoc = iframe360.contentDocument || iframe360.contentWindow.document;

                    // Preload all videos AND mute them to prevent autoplay
                    const videos = iframeDoc.querySelectorAll('video');
                    videos.forEach((video) => {
                        video.preload = 'auto';
                        video.muted = true;
                        video.pause();
                        video.load();
                    });

                    // Preload all audio AND mute them to prevent autoplay
                    const audios = iframeDoc.querySelectorAll('audio');
                    audios.forEach((audio) => {
                        audio.preload = 'auto';
                        audio.muted = true;
                        audio.pause();
                        audio.load();
                    });
                } catch (e) {
                    // This will happen on cross-origin, which is expected
                }
            });

            // Force eager loading
            iframe360.loading = 'eager';
        }
    });

    // Enhanced popup controls with media pause on close
    const open360Btn = document.getElementById('open360Popup');
    const close360Btn = document.getElementById('close360Popup');
    const overlay360 = document.getElementById('popup360Overlay');

    if (open360Btn && overlay360) {
        // When opening popup - UNMUTE and allow playback
        open360Btn.addEventListener('click', () => {
            const iframe360 = document.getElementById('iframe360View');
            if (iframe360) {
                console.log('360 View: Opening popup - enabling audio/video playback');
                iframe360.importance = 'high';

                // Unmute all media to allow playback
                try {
                    const iframeDoc = iframe360.contentDocument || iframe360.contentWindow.document;

                    // Unmute all videos
                    const videos = iframeDoc.querySelectorAll('video');
                    videos.forEach((video) => {
                        video.muted = false; // Unmute
                    });

                    // Unmute all audio
                    const audios = iframeDoc.querySelectorAll('audio');
                    audios.forEach((audio) => {
                        audio.muted = false; // Unmute
                    });

                    console.log('360 View: Media unmuted and ready to play');
                } catch (e) {
                    console.log('360 View: Cross-origin - cannot unmute directly');
                }

                // Unmute and play media via postMessage
                try {
                    if (iframe360.contentWindow) {
                        iframe360.contentWindow.postMessage({ action: 'unmute' }, '*');
                        iframe360.contentWindow.postMessage({ action: 'resume' }, '*');
                        console.log('360 View: Sent unmute/resume commands');
                    }
                } catch (e) {
                    console.log('360 View: Could not send resume commands');
                }
            }
        });

        // When closing popup - STOP ALL MEDIA
        const closePopup = () => {
            const iframe360 = document.getElementById('iframe360View');
            if (iframe360 && iframe360.contentWindow) {
                console.log('360 View: Closing popup - stopping all media');

                // Method 1: STOP media via postMessage (Cross-origin safe)
                try {
                    iframe360.contentWindow.postMessage({ action: 'pause' }, '*');
                    iframe360.contentWindow.postMessage({ action: 'mute' }, '*');
                } catch (e) {
                    console.log('360 View: Could not send stop commands');
                }

                // Method 2: Try direct access (if same-origin)
                try {
                    const iframeDoc = iframe360.contentDocument || iframe360.contentWindow.document;

                    // Pause all videos
                    const videos = iframeDoc.querySelectorAll('video');
                    videos.forEach((video) => {
                        video.pause();
                        video.muted = true; // Mute as backup
                    });

                    // Pause all audio
                    const audios = iframeDoc.querySelectorAll('audio');
                    audios.forEach((audio) => {
                        audio.pause();
                        audio.muted = true; // Mute as backup
                    });

                    console.log('360 View: Successfully stopped all media');
                } catch (e) {
                    // Cross-origin restriction - iframe will stay loaded for instant reopen
                    console.log('360 View: Cross-origin - iframe stays loaded for instant reopen');
                }
            }
        };

        // Attach close handlers
        if (close360Btn) {
            close360Btn.addEventListener('click', closePopup);
        }

        overlay360.addEventListener('click', (e) => {
            if (e.target === overlay360) {
                closePopup();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay360.classList.contains('active')) {
                closePopup();
            }
        });
    }

    // Prefetch on hover for extra speed
    if (open360Btn) {
        let prefetched = false;
        open360Btn.addEventListener('mouseenter', () => {
            if (!prefetched) {
                console.log('360 View Preload: Prefetching on hover...');
                prefetched = true;

                const iframe360 = document.getElementById('iframe360View');
                if (iframe360 && iframe360.contentWindow) {
                    try {
                        iframe360.contentWindow.postMessage({ action: 'prefetch' }, '*');
                    } catch (e) {
                        console.log('360 View Preload: Could not signal iframe');
                    }
                }
            }
        }, { once: true });
    }

})();
