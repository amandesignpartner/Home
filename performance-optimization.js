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

    // Run optimizations after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            lazyLoadImages();
            optimizeBackgrounds();
            optimizeAnimations();
        });
    } else {
        lazyLoadImages();
        optimizeBackgrounds();
        optimizeAnimations();
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
