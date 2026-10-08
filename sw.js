/* =========================================================
   SHITSUB - Service Worker
   Saves the background video on the device so it loads
   instantly on every later open.

   If you ever replace assets/background.mp4, change
   CACHE_NAME below (v1 -> v2) so devices download the new one.
========================================================= */

const CACHE_NAME = "shitsub-media-v1";
const VIDEO_PATH = "assets/background.mp4";

function videoUrl() {
    return new URL(VIDEO_PATH, self.registration.scope).href;
}

// Download and save the video as soon as the worker installs
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.add(videoUrl()))
            .catch(() => {})
            .then(() => self.skipWaiting())
    );
});

// Remove old video caches and take control of the page
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) =>
                            key.startsWith("shitsub-media-") &&
                            key !== CACHE_NAME
                        )
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

// Serve the video from the saved copy
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);

    if (url.pathname.endsWith("/" + VIDEO_PATH)) {
        event.respondWith(serveVideo(event.request));
    }
});

async function serveVideo(request) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const key = videoUrl();

        let cached = await cache.match(key);

        // Not saved yet: download once and save
        if (!cached) {
            const network = await fetch(key);

            if (!network.ok) {
                return fetch(request);
            }

            await cache.put(key, network.clone());
            cached = await cache.match(key);
        }

        const rangeHeader = request.headers.get("range");

        if (!rangeHeader) {
            return cached;
        }

        // Video players ask for pieces (Range requests)
        const buffer = await cached.arrayBuffer();
        const size = buffer.byteLength;

        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);

        let start = match && match[1] ? parseInt(match[1], 10) : 0;
        let end = match && match[2] ? parseInt(match[2], 10) : size - 1;

        if (isNaN(start) || start < 0) {
            start = 0;
        }

        if (isNaN(end) || end >= size) {
            end = size - 1;
        }

        if (start > end) {
            return new Response(null, {
                status: 416,
                headers: {
                    "Content-Range": `bytes */${size}`
                }
            });
        }

        return new Response(buffer.slice(start, end + 1), {
            status: 206,
            statusText: "Partial Content",
            headers: {
                "Content-Type": "video/mp4",
                "Content-Range": `bytes ${start}-${end}/${size}`,
                "Content-Length": String(end - start + 1),
                "Accept-Ranges": "bytes"
            }
        });
    }
    catch (error) {
        return fetch(request);
    }
}
