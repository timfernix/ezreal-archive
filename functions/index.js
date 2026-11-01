const ASSETS_BASE_URL = 'https://assets.timfernix.dev/';
const MANIFEST_URL = `${ASSETS_BASE_URL}catalog/catalog-manifest.json`;
const SHARE_BASE_URL = 'https://ezreal.timfernix.dev/';

async function fetchJsonCached(url, ttlSeconds, context) {
    const cache = caches.default;
    const cacheKey = new Request(url);
    const hit = await cache.match(cacheKey);
    if (hit) return hit.json();

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${url} (${response.status})`);
    const body = await response.text();
    const toCache = new Response(body, {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttlSeconds}` }
    });
    context.waitUntil(cache.put(cacheKey, toCache));
    return JSON.parse(body);
}

async function findAsset(assetId, context) {
    const manifest = await fetchJsonCached(MANIFEST_URL, 300, context);
    const catalogUrl = new URL(manifest.catalogUrl, MANIFEST_URL).href;
    // The catalog URL is content-hashed, so it can be cached for a long time.
    const catalog = await fetchJsonCached(catalogUrl, 86400, context);
    const items = Array.isArray(catalog.items) ? catalog.items : [];
    return items.find((item) => item.id === assetId) || items.find((item) => item.url === assetId) || null;
}

function isAbsoluteUrl(value) {
    return /^https?:\/\//i.test(value);
}

function pickImage(item) {
    if (item.thumbUrl) {
        return isAbsoluteUrl(item.thumbUrl) ? item.thumbUrl : `${ASSETS_BASE_URL}${item.thumbUrl}`;
    }
    if (item.type === 'image' && item.url && item.source !== 'external') {
        return isAbsoluteUrl(item.url) ? item.url : `${ASSETS_BASE_URL}${item.url}`;
    }
    return null;
}

function buildDescription(item) {
    const parts = [item.skinName, item.category, item.releaseYear].filter(Boolean);
    const base = parts.join(' · ');
    return base ? `${base} - Ezreal Media Archive` : 'Browse and explore all official Ezreal media content';
}

function setContent(value) {
    return { element: (el) => el.setAttribute('content', value) };
}

export async function onRequestGet(context) {
    const response = await context.next();
    try {
        const url = new URL(context.request.url);
        const assetId = url.searchParams.get('asset');
        const contentType = response.headers.get('content-type') || '';
        if (!assetId || !contentType.includes('text/html')) return response;

        const item = await findAsset(assetId, context);
        if (!item) return response;

        const title = item.title ? `${item.title} - Ezreal Media Archive` : 'Ezreal Media Archive';
        const description = buildDescription(item);
        const image = pickImage(item);
        const shareUrl = `${SHARE_BASE_URL}?asset=${encodeURIComponent(assetId)}`;
        const imageAlt = item.title || 'Ezreal Media Archive preview image';

        const rewriter = new HTMLRewriter()
            .on('title', { element: (el) => el.setInnerContent(title) })
            .on('meta[name="description"]', setContent(description))
            .on('meta[property="og:title"]', setContent(title))
            .on('meta[property="og:description"]', setContent(description))
            .on('meta[property="og:url"]', setContent(shareUrl))
            .on('meta[name="twitter:title"]', setContent(title))
            .on('meta[name="twitter:description"]', setContent(description));

        if (image) {
            rewriter
                .on('meta[property="og:image"]', setContent(image))
                .on('meta[name="twitter:image"]', setContent(image))
                .on('meta[property="og:image:alt"]', setContent(imageAlt))
                .on('meta[name="twitter:image:alt"]', setContent(imageAlt))
                .on('meta[property="og:image:type"]', { element: (el) => el.remove() })
                .on('meta[property="og:image:width"]', { element: (el) => el.remove() })
                .on('meta[property="og:image:height"]', { element: (el) => el.remove() });
        }

        return rewriter.transform(response);
    } catch (error) {
        return response;
    }
}
