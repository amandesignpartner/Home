/**
 * YOUTUBE VIDEO PROTECTION
 * Enables default YouTube controls while blocking:
 * - Right-click context menu
 * - YouTube logo clicks
 * - "Copy video URL" option
 * - Navigation to YouTube
 */

(function () {
    'use strict';

    console.log('🔒 YouTube video protection loaded');

    // Block all right-clicks on video containers
    function blockRightClick(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    // Block YouTube logo clicks and other unwanted navigation
    function blockYouTubeNavigation(e) {
        const target = e.target;

        // Check if click is on YouTube logo or branding
        if (target.classList.contains('ytp-youtube-button') ||
            target.classList.contains('ytp-watermark') ||
            target.closest('.ytp-youtube-button') ||
            target.closest('.ytp-watermark')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🚫 Blocked YouTube logo click');
            return false;
        }
    }

    // Apply protection to all video containers
    function protectAllVideos() {
        // Find all video containers
        const containers = document.querySelectorAll(
            '.intro-video-embed, .video-gallery-item, .youtube-embed, [class*="video"]'
        );

        containers.forEach(container => {
            // Block right-click on container
            container.addEventListener('contextmenu', blockRightClick, true);

            // Find iframes in container
            const iframe = container.querySelector('iframe[src*="youtube"]');
            if (iframe) {
                // Block right-click on iframe
                iframe.addEventListener('contextmenu', blockRightClick, true);

                // Add click listener to block logo clicks
                iframe.addEventListener('click', blockYouTubeNavigation, true);

                console.log('✅ Protected YouTube video:', iframe.src.substring(0, 50) + '...');
            }
        });
    }

    // Apply protection when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', protectAllVideos);
    } else {
        protectAllVideos();
    }

    // Also re-apply when popups open (for dynamically loaded videos)
    document.addEventListener('popupOpened', () => {
        setTimeout(protectAllVideos, 100);
    });

    // Global right-click prevention on all iframes
    document.addEventListener('contextmenu', function (e) {
        if (e.target.tagName === 'IFRAME' || e.target.closest('iframe')) {
            blockRightClick(e);
        }
    }, true);

    console.log('🔒 YouTube protection active - Right-click blocked, Logo clicks blocked');
})();
