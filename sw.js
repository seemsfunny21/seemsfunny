/* ==========================================================================
   PEGASUS PWA SERVICE WORKER - v3.15 (PERMANENT LOCAL STORAGE BOOT)
   Protocol: Cache-first after full local download, persistent same-origin assets
   Status: FINAL STABLE | ZERO WARMUP FALLBACK | FULL PROGRESS BRIDGE
   ========================================================================== */

const PEGASUS_STORAGE_VERSION = '290';
const CACHE_NAME = `pegasus-permanent-local-v${PEGASUS_STORAGE_VERSION}`;
const CACHE_META_URL = './__pegasus_permanent_cache_meta__.json';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './manifest.js',
    './dialogs.js',
    './i18n.js',
    './data.js',
    './settings.js',
    './optimizer.js',
    './pegasusBrain.js',
    './dynamic.js',
    './progressUI.js',
    './weather.js',
    './backup.js',
    './inventoryHandler.js',
    './pegasusCore.js',
    './cloudSync.js',
    './protcrea.js',
    './food.js',
    './foodRegistry.js',
    './slotRegistry.js',
    './dietAdvisor.js',
    './dietVariation.js',
    './extensions.js',
    './ems.js',
    './cardio.js',
    './calendar.js',
    './gallery.js',
    './partner.js',
    './achievements.js',
    './dragDrop.js',
    './reporting.js',
    './metabolicEngine.js',
    './weightTracker.js',
    './app.js',
    './debug.js',
    './auditUI.js',
    './aiHandler.js',
    './mobile/mobile.html',
    './mobile/style.css',
    './mobile/diet-mobile.js',
    './mobile/cardio-mobile.js',
    './mobile/profile-mobile.js',
    './mobile/car-mobile.js',
    './mobile/parking-mobile.js',
    './mobile/inventory-mobile.js',
    './mobile/ems-mobile.js',
    './mobile/supplies-mobile.js',
    './mobile/finance-mobile.js',
    './mobile/social-mobile.js',
    './mobile/movies-mobile.js',
    './mobile/youtube-mobile.js',
    './mobile/weather-mobile.js',
    './mobile/shell-layout-mobile.js',
    './mobile/missions-mobile.js',
    './mobile/biometrics-mobile.js',
    './mobile/biometric-unlock-mobile.js',
    './mobile/maintenance-mobile.js',
    './mobile/oracle-mobile.js',
    './mobile/lifting-mobile.js',
    './README.md',
    './RELEASE_NOTES.txt'
];

/* =========================
   HELPERS
========================= */
function isSameOrigin(url) {
    return url.origin === self.location.origin;
}

function isBypassHost(url) {
    return (
        url.hostname.includes('jsonbin.io') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('emailjs.com') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')
    );
}

function isMediaAsset(pathname) {
    return /\.(mp4|webm|mov|mp3|png|jpg|jpeg|svg|woff2|gif|webp)$/i.test(pathname);
}

function isVideoAsset(pathname) {
    return /\.(mp4|webm|mov)$/i.test(pathname);
}

function isRangeRequest(request) {
    return !!request.headers.get('range');
}

function cleanCacheUrl(urlString) {
    const url = new URL(urlString, self.location.href);
    url.search = '';
    url.hash = '';
    return url;
}

function makeCacheRequest(urlString) {
    const url = cleanCacheUrl(urlString);
    return new Request(url.href, { credentials: 'same-origin' });
}

function isCacheableResponse(response) {
    return !!response && response.status === 200 && response.type === 'basic';
}

async function notifyPegasusClients(message) {
    try {
        const allClients = await self.clients.matchAll({ includeUncontrolled: true });
        allClients.forEach(client => client.postMessage(message));
    } catch (_) {}
}

async function createRangeResponse(request, cachedResponse) {
    const rangeHeader = request.headers.get('range');
    const match = rangeHeader && rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) return cachedResponse.clone();

    const blob = await cachedResponse.blob();
    const size = blob.size;
    let start;
    let end;

    if (match[1] === '' && match[2] !== '') {
        const suffixLength = parseInt(match[2], 10);
        start = Math.max(size - suffixLength, 0);
        end = size - 1;
    } else {
        start = match[1] ? parseInt(match[1], 10) : 0;
        end = match[2] ? parseInt(match[2], 10) : size - 1;
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
        return new Response('', {
            status: 416,
            statusText: 'Range Not Satisfiable',
            headers: { 'Content-Range': `bytes */${size}` }
        });
    }

    end = Math.min(end, size - 1);
    const sliced = blob.slice(start, end + 1);
    const headers = new Headers(cachedResponse.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(sliced.size));
    if (!headers.get('Content-Type')) headers.set('Content-Type', 'video/mp4');

    return new Response(sliced, {
        status: 206,
        statusText: 'Partial Content',
        headers
    });
}

function looksLikeValidAsset(url, response, blob) {
    if (!isCacheableResponse(response)) return false;
    if (!blob || blob.size <= 0) return false;

    const pathname = url.pathname.toLowerCase();
    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    if (isVideoAsset(pathname)) {
        return blob.size > 1024 && (contentType.includes('video') || pathname.endsWith('.mp4'));
    }

    if (isMediaAsset(pathname)) {
        if (/\.(png|jpg|jpeg|gif|webp)$/i.test(pathname)) return contentType.startsWith('image/');
        if (/\.svg$/i.test(pathname)) return contentType.includes('svg') || contentType.startsWith('image/');
        if (/\.(mp3)$/i.test(pathname)) return contentType.includes('audio');
        if (/\.woff2$/i.test(pathname)) return contentType.includes('font') || contentType.includes('octet-stream');
        return false;
    }

    return true;
}

async function cacheOnePermanentAsset(cache, urlString) {
    const url = cleanCacheUrl(urlString);
    if (!isSameOrigin(url) || isBypassHost(url)) {
        return { ok: false, skipped: true, reason: 'external' };
    }

    const request = makeCacheRequest(url.href);
    const existing = await cache.match(request, { ignoreSearch: true });
    if (existing) {
        return { ok: true, cached: true, size: Number(existing.headers.get('content-length') || 0) };
    }

    const response = await fetch(request, { cache: 'reload' });
    const blob = await response.clone().blob();

    if (!looksLikeValidAsset(url, response, blob)) {
        return { ok: false, skipped: true, status: response.status, size: blob ? blob.size : 0 };
    }

    const headers = new Headers(response.headers);
    headers.set('Content-Length', String(blob.size));
    if (isVideoAsset(url.pathname.toLowerCase())) {
        headers.set('Accept-Ranges', 'bytes');
        if (!headers.get('Content-Type')) headers.set('Content-Type', 'video/mp4');
    }

    await cache.put(request, new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers
    }));

    return { ok: true, cached: false, size: blob.size };
}

async function getPermanentCacheMeta(cache) {
    try {
        const response = await cache.match(makeCacheRequest(CACHE_META_URL), { ignoreSearch: true });
        if (!response) return null;
        const meta = await response.clone().json();
        if (!meta || meta.version !== PEGASUS_STORAGE_VERSION || meta.completed !== true) return null;
        return meta;
    } catch (_) {
        return null;
    }
}

async function setPermanentCacheMeta(cache, meta) {
    try {
        await cache.put(makeCacheRequest(CACHE_META_URL), new Response(JSON.stringify({
            ...meta,
            version: PEGASUS_STORAGE_VERSION,
            completed: true,
            completedAt: Date.now()
        }), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        }));
    } catch (_) {}
}

async function runPermanentLocalDownload(extraUrls = []) {
    const cache = await caches.open(CACHE_NAME);
    const urls = Array.from(new Set([
        ...ASSETS_TO_CACHE,
        ...(Array.isArray(extraUrls) ? extraUrls : [])
    ].filter(Boolean)));

    const total = urls.length || 1;
    const existingMeta = await getPermanentCacheMeta(cache);
    if (existingMeta && Number(existingMeta.total || 0) >= total) {
        await notifyPegasusClients({
            type: 'PEGASUS_PERMANENT_CACHE_COMPLETE',
            percent: 100,
            done: existingMeta.done || existingMeta.total || total,
            total: existingMeta.total || total,
            ok: existingMeta.ok || existingMeta.total || total,
            skipped: existingMeta.skipped || 0,
            bytes: existingMeta.bytes || 0,
            cache: CACHE_NAME,
            status: 'already-local'
        });
        console.log(`✅ PEGASUS SW: permanent local storage already ready (${existingMeta.ok || existingMeta.total || total}/${existingMeta.total || total}).`);
        return;
    }

    let done = 0;
    let ok = 0;
    let skipped = 0;
    let bytes = 0;

    await notifyPegasusClients({
        type: 'PEGASUS_PERMANENT_CACHE_PROGRESS',
        percent: 0,
        done,
        total,
        ok,
        skipped,
        bytes,
        status: 'starting'
    });

    for (const urlString of urls) {
        let result = { ok: false, skipped: true };
        try {
            result = await cacheOnePermanentAsset(cache, urlString);
        } catch (err) {
            result = { ok: false, skipped: true, reason: err && err.message ? err.message : 'error' };
            console.warn(`PEGASUS SW: local storage skipped: ${urlString}`, err);
        }

        done++;
        if (result.ok) ok++;
        else skipped++;
        if (result.size) bytes += result.size;

        const percent = Math.min(100, Math.round((done / total) * 100));
        await notifyPegasusClients({
            type: 'PEGASUS_PERMANENT_CACHE_PROGRESS',
            percent,
            done,
            total,
            ok,
            skipped,
            bytes,
            url: urlString,
            status: percent >= 100 ? 'complete' : 'downloading'
        });
    }

    await setPermanentCacheMeta(cache, { done, total, ok, skipped, bytes });

    await notifyPegasusClients({
        type: 'PEGASUS_PERMANENT_CACHE_COMPLETE',
        percent: 100,
        done,
        total,
        ok,
        skipped,
        bytes,
        cache: CACHE_NAME
    });

    console.log(`✅ PEGASUS SW: permanent local storage complete ${ok}/${total} assets (${skipped} skipped).`);
}

async function getCachedResponseForRequest(request, url) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (!cached) return null;

    if (isVideoAsset(url.pathname.toLowerCase()) && isRangeRequest(request)) {
        return createRangeResponse(request, cached);
    }

    return cached.clone();
}

async function cacheNetworkResponse(request, response, url) {
    if (!isCacheableResponse(response)) return;

    const clone = response.clone();
    const blob = await clone.blob();
    if (!looksLikeValidAsset(url, response, blob)) return;

    const headers = new Headers(response.headers);
    headers.set('Content-Length', String(blob.size));
    if (isVideoAsset(url.pathname.toLowerCase())) headers.set('Accept-Ranges', 'bytes');

    const cache = await caches.open(CACHE_NAME);
    await cache.put(makeCacheRequest(url.href), new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers
    }));
}

async function getOfflineNavigationFallback(pathname) {
    const cache = await caches.open(CACHE_NAME);
    const isMobileRoute = pathname.includes('/mobile') || pathname.endsWith('/mobile.html');
    const candidates = isMobileRoute
        ? ['./mobile/mobile.html', './index.html']
        : ['./index.html', './mobile/mobile.html'];

    for (const candidate of candidates) {
        const cached = await cache.match(makeCacheRequest(candidate), { ignoreSearch: true });
        if (cached) return cached.clone();
    }

    return new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

/* =========================
   INSTALL / ACTIVATE
========================= */
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        // Keep installation instant: only shell entries that already arrive during page boot
        // are allowed to be cached here. The full permanent download is started by the page
        // so the user sees exact progress on the PEGASUS loader.
        for (const assetUrl of ['./', './index.html', './style.css', './manifest.js', './app.js', './sw.js']) {
            try {
                await cacheOnePermanentAsset(cache, assetUrl);
            } catch (_) {}
        }
        console.log('✅ PEGASUS SW: shell installed; waiting for permanent local download command.');
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => {
            const isPegasusCache =
                key.startsWith('pegasus-shield') ||
                key.startsWith('pegasus-videos-') ||
                key.startsWith('pegasus-permanent-local-');

            if (isPegasusCache && key !== CACHE_NAME) {
                console.log(`🧹 PEGASUS SW: deleting old cache: ${key}`);
                return caches.delete(key);
            }
            return Promise.resolve();
        }));

        await self.clients.claim();
        console.log('✅ PEGASUS SW: clients claimed; cache-first local runtime active.');
    })());
});

/* =========================
   PERMANENT LOCAL STORAGE MESSAGES
========================= */
self.addEventListener('message', (event) => {
    const data = event.data || {};

    if (
        data.type === 'PEGASUS_PERMANENT_CACHE_ALL' ||
        data.type === 'PEGASUS_BACKGROUND_CACHE_ALL'
    ) {
        event.waitUntil(runPermanentLocalDownload(data.mediaUrls || data.urls || []));
        return;
    }

    if (
        data.type === 'PEGASUS_PERMANENT_CACHE_MEDIA' ||
        data.type === 'PEGASUS_BACKGROUND_CACHE_MEDIA'
    ) {
        event.waitUntil(runPermanentLocalDownload(data.mediaUrls || data.urls || []));
    }
});

/* =========================
   FETCH ENGINE - CACHE FIRST / THEN NETWORK
========================= */
self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    if (!request.url.startsWith('http')) return;

    const url = new URL(request.url);
    if (!isSameOrigin(url) || isBypassHost(url)) return;

    const pathname = url.pathname.toLowerCase();

    event.respondWith((async () => {
        const cached = await getCachedResponseForRequest(request, url);
        if (cached) return cached;

        try {
            const networkResponse = await fetch(request, { cache: 'reload' });
            event.waitUntil(cacheNetworkResponse(request, networkResponse.clone(), url));
            return networkResponse;
        } catch (err) {
            console.warn(`[PEGASUS SW]: local fallback for ${url.pathname}`, err);

            const lateCached = await getCachedResponseForRequest(request, url);
            if (lateCached) return lateCached;

            if (request.mode === 'navigate') {
                return getOfflineNavigationFallback(pathname);
            }

            return new Response('', { status: 404 });
        }
    })());
});
