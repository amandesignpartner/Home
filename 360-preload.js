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
        const loader360 = document.getElementById('loader360');
        const statusText = document.getElementById('loader360-status');
        const percentText = document.getElementById('loader360-percent');

        if (iframe360 && loader360) {
            console.log('360 View: Initializing Intelligence-Driven Loading...');

            let sequenceFinished = false;
            let progressValue = 0;
            let isCached = false; // "Guess" flag for cached assets

            // --- Cache Sensing Logics ---
            // If the iframe fires 'load' before our 3s center phase ends, it's highly likely cached.
            const cacheSensorTimeout = setTimeout(() => {
                // If we reach this point and iframe is already ready, it's cached
                try {
                    // Check if iframe is ready via basic property or previous event
                    if (iframe360.contentWindow && iframe360.contentWindow.document.readyState === 'complete') {
                        isCached = true;
                        console.log('360 View Intelligence: Cache detected (Early resolution).');
                    }
                } catch (e) { /* Cross-origin fallback below */ }
            }, 2500);

            iframe360.addEventListener('load', () => {
                // If it loads faster than 3s, it's a "cached" guess
                if (performance.now() < 3000) {
                    isCached = true;
                    console.log('360 View Intelligence: Cache guessed via rapid resolution.');
                }

                // Background silencing
                try {
                    if (iframe360.contentWindow) {
                        iframe360.contentWindow.postMessage({ action: 'mute' }, '*');
                        iframe360.contentWindow.postMessage({ action: 'pause' }, '*');
                    }
                } catch (e) { }
            });

            // --- Phase 1: 3 Seconds Center (The optimization phase) ---
            setTimeout(() => {
                if (sequenceFinished) return;

                // --- Phase 2: Move to Corner ---
                loader360.classList.add('in-corner');
                if (statusText) statusText.textContent = 'Loading Videos...';
                if (percentText) {
                    percentText.style.display = 'block';
                    percentText.textContent = '0%';
                }

                // Show iframe in background
                iframe360.style.opacity = '1';

                // --- Phase 3: Dynamic Progress Completion ---
                // If cached, we finish in 5 seconds. If not, we take the 1-minute path.
                const duration = isCached ? 5000 : 60000;
                const interval = 100;
                const increment = 100 / (duration / interval);

                const progressTimer = setInterval(() => {
                    progressValue += increment;
                    if (progressValue >= 100) {
                        progressValue = 100;
                        clearInterval(progressTimer);
                        setTimeout(finishSequence, 500);
                    }
                    if (percentText) percentText.textContent = `${Math.floor(progressValue)}%`;
                }, interval);

                // Intelligence Layer: Listen for "TRUE READY" messages from the source
                window.addEventListener('message', (event) => {
                    if (event.data === 'ready' || event.data.type === '360-ready') {
                        console.log('360 View Intelligence: True ready signal received. Ending sequence.');
                        progressValue = 100;
                        if (percentText) percentText.textContent = '100%';
                        clearInterval(progressTimer);
                        finishSequence();
                    }
                });

            }, 3000); // 3 seconds center delay

            function finishSequence() {
                if (sequenceFinished) return;
                sequenceFinished = true;

                loader360.style.opacity = '0';
                setTimeout(() => {
                    loader360.style.visibility = 'hidden';
                }, 800);

                console.log('360 View: Loading sequence finalized.');
            }

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
