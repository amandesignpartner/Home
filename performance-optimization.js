// Performance Optimization Script - Auto-loads after page is ready
(function () {
    'use strict';

    // Lazy load images for better performance
    function lazyLoadImages() {
        const images = document.querySelectorAll('img:not([loading])');
        images.forEach(img => {
            img.loading = 'lazy';
        });
    }

    // Optimize background images and slider performance
    function optimizeBackgrounds() {
        const elements = document.querySelectorAll('.slide');
        elements.forEach((el, index) => {
            // Give higher priority and hardware acceleration to the first slide
            if (index === 0) {
                el.style.willChange = 'opacity';
            } else {
                el.style.willChange = 'auto';
            }
        });
    }

    // Reduce repaints and reflows
    function optimizeAnimations() {
        const animatedElements = document.querySelectorAll('.sticky-note, .tab, .popup');
        animatedElements.forEach(el => {
            el.style.willChange = 'transform, opacity';
        });
    }

    // Proactive Cache Removal (except 360-view-cache)
    function purgeOldCaches() {
        if ('caches' in window) {
            caches.keys().then(names => {
                for (let name of names) {
                    if (name !== '360-view-cache-v2') {
                        console.log('Purging old cache:', name);
                        caches.delete(name);
                    }
                }
            });
        }
        // Clear session storage to reset tracker/chat states if needed
        // sessionStorage.clear(); 
    }

    // === Premium Loader Logic (Dynamic Load Synchronization) ===
    function initPremiumLoader() {
        const loader = document.getElementById('site-loader');
        const bar = document.getElementById('loader-bar-fill');
        const percentText = document.getElementById('loader-percent');
        const statusText = document.getElementById('loader-status-text');
        const narrativeText = document.getElementById('loader-narrative');

        if (!loader || !bar) return;

        const loadingPhases = [
            { threshold: 30, status: 'Calibrating Workspace', narrative: 'Preparing the digital canvas...' },
            { threshold: 60, status: 'Synchronizing Assets', narrative: 'Loading Photorealistic modules...' },
            { threshold: 85, status: 'Rendering Experience', narrative: 'Illuminating textures and dimensions...' },
            { threshold: 99, status: 'Finalizing Interface', narrative: 'Your trusted design partner is ready.' }
        ];

        let progress = 0;
        let isFullyLoaded = false;
        let isManualComplete = false;

        // Expose manual completion trigger to window for script-level synchronization
        window.triggerManualLoadComplete = function () {
            if (!isManualComplete) {
                console.log('Loader: Critical UI settled. Triggering completion...');
                isManualComplete = true;
                finishSequence();
            }
        };

        // Artificial progress simulation to 90%
        const loaderInterval = setInterval(() => {
            if (!isFullyLoaded) {
                // Slower progress as it nears 90% to feel more realistic
                let increment = progress < 70 ? 1.5 : 0.5;
                progress += increment;

                if (progress >= 90) {
                    progress = 90;
                    clearInterval(loaderInterval);
                }
                updateUI();
            }
        }, 80);

        // Fail-safe: If window.load takes too long, or to catch all assets
        window.addEventListener('load', () => {
            if (!isManualComplete) {
                finishSequence();
            }
        });

        function finishSequence() {
            if (isFullyLoaded) return;
            isFullyLoaded = true;
            clearInterval(loaderInterval);

            // Fast jump to 100%
            const fastFinish = setInterval(() => {
                progress += 10;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(fastFinish);
                    updateUI();
                    finishLoading();
                }
                updateUI();
            }, 20);
        }

        function updateUI() {
            bar.style.width = `${progress}%`;
            percentText.textContent = `${Math.floor(progress)}%`;

            // Update status messages
            const currentPhase = loadingPhases.find(p => progress <= p.threshold);
            if (currentPhase) {
                statusText.textContent = currentPhase.status;
                if (narrativeText.textContent !== currentPhase.narrative) {
                    narrativeText.style.opacity = '0';
                    setTimeout(() => {
                        narrativeText.textContent = currentPhase.narrative;
                        narrativeText.style.opacity = '1';
                    }, 400);
                }
            }
        }

        function finishLoading() {
            setTimeout(() => {
                loader.style.opacity = '0';
                document.body.style.overflow = ''; // Restore scroll
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 1000);
            }, 800); // 800ms "Hold" at 100% for premium feel
        }
    }

    // Run optimizations and purge after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initPremiumLoader();
            lazyLoadImages();
            optimizeBackgrounds();
            optimizeAnimations();
            purgeOldCaches();
        });
    } else {
        initPremiumLoader();
        lazyLoadImages();
        optimizeBackgrounds();
        optimizeAnimations();
        purgeOldCaches();
    }

    // Clean up will-change after animations complete
    setTimeout(() => {
        document.querySelectorAll('[style*="will-change"]').forEach(el => {
            if (!el.classList.contains('animating')) {
                el.style.willChange = 'auto';
            }
        });
    }, 5000);

})();
