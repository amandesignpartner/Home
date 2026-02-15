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

    // Optimize background images
    function optimizeBackgrounds() {
        const elements = document.querySelectorAll('[style*="background-image"]');
        elements.forEach(el => {
            el.style.willChange = 'auto';
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

    // Run optimizations and purge after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            lazyLoadImages();
            optimizeBackgrounds();
            optimizeAnimations();
            purgeOldCaches();
        });
    } else {
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
