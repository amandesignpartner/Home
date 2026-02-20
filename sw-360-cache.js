// Service Worker for 360 View Aggressive Caching
const CACHE_NAME = '360-view-cache-v3';
const IFRAME_URL = 'https://amandesignpartner.github.io/360views/';

// Install event - preload and cache the 360 view and all its resources
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing and aggressively caching 360 view...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching 360 view page');
            // Cache the main page first
            return cache.add(IFRAME_URL).catch(err => {
                console.log('Service Worker: Error caching main page:', err);
            });
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Fetch event - aggressive caching for all 360 view resources
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Aggressive cache strategy for 360 view domain
    if (url.includes('amandesignpartner.github.io/360views')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        console.log('Service Worker: Serving from cache:', url);
                        // Return cached version immediately
                        // Update cache in background for next time
                        fetch(event.request).then((response) => {
                            if (response && response.status === 200) {
                                cache.put(event.request, response.clone());
                            }
                        }).catch(() => {
                            // Network failed, cached version is still good
                        });
                        return cachedResponse;
                    }

                    // Not in cache, fetch from network and cache it
                    console.log('Service Worker: Fetching and caching:', url);
                    return fetch(event.request).then((response) => {
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }

                        // Cache ALL resources from 360 views domain
                        const responseToCache = response.clone();
                        cache.put(event.request, responseToCache);
                        console.log('Service Worker: Cached new resource:', url);

                        return response;
                    }).catch((error) => {
                        console.log('Service Worker: Fetch failed:', url, error);
                        return new Response('Offline - resource not cached', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
                });
            })
        );
    } else {
        // For all other requests, just use network
        event.respondWith(
            fetch(event.request).catch(() => {
                // If network fails for non-360 resources, just fail
                return new Response('Network error', { status: 408 });
            })
        );
    }
});

// Message event - force cache update and clear when requested
self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }

    if (event.data.action === 'clearCache') {
        event.waitUntil(
            caches.delete(CACHE_NAME).then(() => {
                console.log('Service Worker: Cache cleared');
            })
        );
    }

    if (event.data.action === 'cacheAll') {
        // Force cache all resources from the 360 view page
        event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
                console.log('Service Worker: Force caching all resources...');
                return cache.add(IFRAME_URL);
            })
        );
    }
});
