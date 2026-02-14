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
                console.log('360 View Preload: All resources are now being cached automatically');

                // Try to force resource loading inside iframe AND mute everything
                try {
                    const iframeDoc = iframe360.contentDocument || iframe360.contentWindow.document;

                    // Preload all videos AND mute them to prevent autoplay
                    const videos = iframeDoc.querySelectorAll('video');
                    videos.forEach((video, index) => {
                        console.log(`360 View Preload: Preloading video ${index + 1}`);
                        video.preload = 'auto';
                        video.muted = true; // Mute to prevent autoplay
                        video.pause(); // Ensure paused
                        video.load();
                    });

                    // Preload all audio AND mute them to prevent autoplay
                    const audios = iframeDoc.querySelectorAll('audio');
                    audios.forEach((audio, index) => {
                        console.log(`360 View Preload: Preloading audio ${index + 1}`);
                        audio.preload = 'auto';
                        audio.muted = true; // Mute to prevent autoplay
                        audio.pause(); // Ensure paused
                        audio.load();
                    });

                    // Preload all images
                    const images = iframeDoc.querySelectorAll('img');
                    images.forEach((img, index) => {
                        if (!img.complete) {
                            console.log(`360 View Preload: Preloading image ${index + 1}`);
                        }
                    });

                    console.log('360 View Preload: All media muted to prevent autoplay');
                } catch (e) {
                    // Cross-origin restriction - this is expected
                    // Service worker will still cache everything
                    console.log('360 View Preload: Cross-origin iframe (Service Worker handles caching)');
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

                // Resume media playback via postMessage
                try {
                    if (iframe360.contentWindow) {
                        iframe360.contentWindow.postMessage({ action: 'resume' }, '*');
                    }
                } catch (e) {
                    console.log('360 View: Could not send resume message');
                }
            }
        });

        // When closing popup - STOP ALL MEDIA
        const closePopup = () => {
            const iframe360 = document.getElementById('iframe360View');
            if (iframe360 && iframe360.contentWindow) {
                console.log('360 View: Closing popup - stopping all media');

                // Method 1: Try to pause media via postMessage
                try {
                    iframe360.contentWindow.postMessage({ action: 'pause' }, '*');
                } catch (e) {
                    console.log('360 View: Could not send pause message');
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
