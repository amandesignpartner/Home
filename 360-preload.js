// 360 View Security and Audio Control System (Simplified)
(function () {
    'use strict';


    // NUCLEAR STOP & EXPLICIT START SYSTEM
    const open360Btn = document.getElementById('open360Popup');
    const close360Btn = document.getElementById('close360Popup');
    const overlay360 = document.getElementById('popup360Overlay');
    const iframeContainer = document.getElementById('popup360Content');
    const originalSrc = "https://amandesignpartner.github.io/360views/";

    if (open360Btn && overlay360 && iframeContainer) {
        const loader360 = document.getElementById('loader360');
        const statusText = document.getElementById('loader360-status');
        const percentText = document.getElementById('loader360-percent');
        let progressInterval;

        // 1. OPEN: Explictly set src and show
        open360Btn.addEventListener('click', () => {
            const iframe = document.getElementById('iframe360View');
            if (iframe && !overlay360.classList.contains('active')) {
                console.log('360 View: Launching environment...');

                // Reset and Show Loader
                if (loader360) {
                    loader360.style.opacity = '1';
                    loader360.style.visibility = 'visible';
                    loader360.classList.remove('in-corner'); // Start in center
                    if (percentText) {
                        percentText.style.display = 'block';
                        percentText.textContent = '0%';
                    }
                    if (statusText) statusText.textContent = 'Optimizing 360° Environments...';

                    // Start Animation
                    let progress = 0;
                    progressInterval = setInterval(() => {
                        progress += Math.random() * 3.5;
                        if (progress >= 95) {
                            progress = 95;
                            clearInterval(progressInterval);
                            if (statusText) statusText.textContent = 'Almost Ready...';
                        }
                        if (percentText) percentText.textContent = Math.floor(progress) + '%';
                    }, 100);
                }

                // Pause background intro video to prevent double audio (Nuclear Pause)
                const bgVideo = document.querySelector('.sticky-content .js-player');
                if (bgVideo && window.Plyr) {
                    try {
                        const player = Plyr.setup('.sticky-content .js-player')[0];
                        if (player) player.pause();
                    } catch (e) { }
                }

                // Only set src if it's currently at the blank state
                if (iframe.src.includes('about:blank') || iframe.src === '') {
                    iframe.src = originalSrc + "?autoplay=1&muted=0";
                }

                overlay360.classList.add('active');
                document.body.style.overflow = 'hidden';

                // Listen for ready signal from 360 View
                const handleReady = (event) => {
                    if (event.data === 'ready' || event.data.type === '360-ready') {
                        finishLoading();
                        window.removeEventListener('message', handleReady);
                    }
                };
                window.addEventListener('message', handleReady);

                // Fail-safe to hide loader if no message received
                setTimeout(() => {
                    if (loader360 && loader360.style.visibility !== 'hidden') {
                        finishLoading();
                    }
                }, 8000);
            }
        });

        const finishLoading = () => {
            clearInterval(progressInterval);
            if (percentText) percentText.textContent = '100%';
            if (statusText) statusText.textContent = 'Optimization Complete';

            setTimeout(() => {
                if (loader360) {
                    loader360.style.opacity = '0';
                    setTimeout(() => {
                        loader360.style.visibility = 'hidden';
                    }, 800);
                }
                const iframe = document.getElementById('iframe360View');
                if (iframe) iframe.style.opacity = '1';
            }, 500);
        };

        // 2. CLOSE: Nuclear Option (Remove and Recreate)
        const nuclearStop = () => {
            const iframe = document.getElementById('iframe360View');
            clearInterval(progressInterval);
            if (iframe) {
                console.log('360 View: Nuclear Stop - Destroying iframe to kill music');
                iframe.style.opacity = '0';
                iframe.src = "about:blank";

                setTimeout(() => {
                    const newIframe = iframe.cloneNode(true);
                    newIframe.src = "about:blank";
                    iframe.parentNode.replaceChild(newIframe, iframe);
                    overlay360.classList.remove('active');
                }, 50);
            } else {
                overlay360.classList.remove('active');
            }
            document.body.style.overflow = '';
        };

        if (close360Btn) close360Btn.addEventListener('click', nuclearStop);
        overlay360.addEventListener('click', (e) => { if (e.target === overlay360) nuclearStop(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay360.classList.contains('active')) nuclearStop();
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
