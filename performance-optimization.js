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
        const slides = document.querySelectorAll('.slide');
        if (slides.length === 0) return;

        // Preload all slider images proactively
        slides.forEach((slide, index) => {
            const bg = slide.style.backgroundImage;
            if (bg) {
                const url = bg.slice(4, -1).replace(/"/g, "").replace(/'/g, "");
                const img = new Image();
                img.src = url;

                // Keep hardware acceleration for the active (first) slide
                if (slide.classList.contains('active') || index === 0) {
                    slide.style.willChange = 'opacity';
                }
            }
        });

        // Add observer to manage hardware acceleration during slide changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('active')) {
                        target.style.willChange = 'opacity';
                    } else {
                        // Delay clearing to ensure animation completes
                        setTimeout(() => {
                            if (!target.classList.contains('active')) {
                                target.style.willChange = 'auto';
                            }
                        }, 2000);
                    }
                }
            });
        });

        slides.forEach(slide => observer.observe(slide, { attributes: true }));
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

        if (!loader || !bar) return;

        const loadingPhases = [
            { threshold: 35, status: 'Calibrating Workspace' },
            { threshold: 65, status: 'Synchronizing Assets' },
            { threshold: 90, status: 'Illuminating Textures' },
            { threshold: 100, status: 'Interface Ready' }
        ];

        let progress = 0;
        let isFullyLoaded = false;

        // Start from 0 immediately and show progress
        updateUI();

        // Initialize simulation
        const loaderInterval = setInterval(() => {
            if (!isFullyLoaded) {
                let increment = progress < 40 ? 0.8 : (progress < 75 ? 0.4 : 0.15);
                progress += increment;

                if (progress >= 92) {
                    progress = 92;
                    clearInterval(loaderInterval);
                }
                updateUI();
            }
        }, 50);

        // --- Intelligence Layer: Double-Safety Trigger ---

        // 1. Check if window is already loaded (for instant cache hits)
        if (document.readyState === 'complete') {
            triggerFinish();
        } else {
            // 2. Listen for the actual signal
            window.addEventListener('load', triggerFinish);

            // 3. Fail-safe: Force completion after 3 seconds (no user likes waiting for one slow pixel)
            setTimeout(() => {
                if (!isFullyLoaded) {
                    console.log('Loader Intelligence: Fail-safe triggered.');
                    triggerFinish();
                }
            }, 3000);
        }

        function triggerFinish() {
            if (isFullyLoaded) return;
            isFullyLoaded = true;
            clearInterval(loaderInterval);

            let finishProgress = progress;
            const fastFinish = setInterval(() => {
                finishProgress += 2;
                if (finishProgress >= 100) {
                    finishProgress = 100;
                    clearInterval(fastFinish);
                    updateUI(100);
                    dismissLoader();
                } else {
                    updateUI(finishProgress);
                }
            }, 30);
        }

        function updateUI(customVal) {
            const currentVal = customVal !== undefined ? customVal : progress;
            const floorVal = Math.floor(currentVal);

            bar.style.width = `${floorVal}%`;
            percentText.textContent = `${floorVal}%`;

            // Dynamic Status Update
            const phase = loadingPhases.find(p => currentVal <= p.threshold) || loadingPhases[loadingPhases.length - 1];
            if (statusText.textContent !== phase.status) {
                statusText.style.opacity = '0';
                setTimeout(() => {
                    statusText.textContent = phase.status;
                    statusText.style.opacity = '1';
                }, 200);
            }
        }

        function dismissLoader() {
            setTimeout(() => {
                loader.style.opacity = '0';
                setTimeout(() => {
                    loader.style.display = 'none';
                    document.body.style.overflow = ''; // Restore scroll
                }, 1000);
            }, 600); // Premium hold at 100%
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

    // Clean up will-change after animations complete (selective)
    setTimeout(() => {
        document.querySelectorAll('[style*="will-change"]').forEach(el => {
            // Keep will-change for active slides and critical UI
            if (el.classList.contains('slide') && el.classList.contains('active')) return;
            if (el.id === 'site-loader') return;

            if (!el.classList.contains('animating')) {
                el.style.willChange = 'auto';
            }
        });
    }, 5000);

})();
