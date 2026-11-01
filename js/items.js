import { ASSETS_BASE_URL } from './config.js';

export function normalizeValue(value) {
    return typeof value === 'string' ? value.trim() : value;
}

export function deriveSkinlineFromName(skinName) {
    const normalizedName = normalizeValue(skinName);

    if (!normalizedName) {
        return 'No Skinline';
    }

    const withoutChampionName = normalizedName.replace(/\s+ezreal\s*$/i, '').trim();
    return withoutChampionName || normalizedName;
}

export function resolveSkinName(skin) {
    return normalizeValue(skin.skinName) || 'Unknown Skin';
}

export function resolveSkinline(skin) {
    return deriveSkinlineFromName(resolveSkinName(skin));
}

export function resolveAssetTitle(asset, skinName) {
    const explicitTitle = normalizeValue(asset.title);

    if (explicitTitle) {
        return explicitTitle;
    }

    const fallbackFromUrl = normalizeValue(asset.url);

    if (fallbackFromUrl) {
        return fallbackFromUrl;
    }

    return skinName;
}

export function resolveReleaseYear(skin, asset) {
    const assetReleaseYear = normalizeValue(asset.assetReleaseYear);
    const skinReleaseYear = normalizeValue(skin.releaseYear);

    if (assetReleaseYear !== undefined && assetReleaseYear !== null && assetReleaseYear !== '') {
        return String(assetReleaseYear);
    }

    if (skinReleaseYear !== undefined && skinReleaseYear !== null && skinReleaseYear !== '') {
        return String(skinReleaseYear);
    }

    return 'Unknown';
}

export function resolveSkinReleaseDate(item) {
    const skinReleaseDate = normalizeValue(item.skinReleaseDate) || normalizeValue(item.skinReleaseYear);
    return skinReleaseDate ? String(skinReleaseDate) : 'Unknown';
}

export function parseSkinReleaseDate(value) {
    const match = /^(\d{4})(?:-(\d{2})-(\d{2}))?$/.exec(String(normalizeValue(value) || ''));
    if (!match) {
        return null;
    }

    return {
        year: Number(match[1]),
        exactDate: match[2] ? String(value) : null
    };
}

export function compareSkinReleaseDates(leftValue, rightValue, descending = false) {
    const leftDate = parseSkinReleaseDate(leftValue);
    const rightDate = parseSkinReleaseDate(rightValue);

    if (!leftDate || !rightDate) {
        return leftDate ? -1 : rightDate ? 1 : 0;
    }

    const direction = descending ? -1 : 1;
    if (leftDate.year !== rightDate.year) {
        return (leftDate.year - rightDate.year) * direction;
    }

    const leftSortDate = leftDate.exactDate || `${leftDate.year}-01-01`;
    const rightSortDate = rightDate.exactDate || `${rightDate.year}-01-01`;
    return leftSortDate.localeCompare(rightSortDate) * direction;
}

export const NEW_BADGE_DAYS = 7;

export function isRecentlyUploaded(item) {
    const uploaded = new Date(item.uploadedAt).getTime();
    return Number.isFinite(uploaded) && Date.now() - uploaded >= 0 && Date.now() - uploaded <= NEW_BADGE_DAYS * 86400000;
}

export function formatUploadedAt(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export function formatSkinReleaseDate(value) {
    const releaseDate = String(normalizeValue(value) || 'Unknown');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
        return releaseDate;
    }

    const date = new Date(`${releaseDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== releaseDate) {
        return releaseDate;
    }

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    }).format(date);
}

export function isExternalItem(item) {
    return item?.source === 'external_link' || item?.type === 'external';
}

export function resolveMediaUrl(item) {
    if (isExternalItem(item)) {
        return item.url;
    }

    return `${ASSETS_BASE_URL}${item.url}`;
}

export function getYouTubeVideoId(url) {
    if (!url) {
        return null;
    }

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();

        if (host === 'youtu.be') {
            const videoId = parsed.pathname.replace('/', '').trim();
            return videoId || null;
        }

        if (host.includes('youtube.com')) {
            const videoId = parsed.searchParams.get('v');
            if (videoId) {
                return videoId;
            }

            const pathParts = parsed.pathname.split('/').filter(Boolean);
            const embedIndex = pathParts.indexOf('embed');

            if (embedIndex !== -1 && pathParts[embedIndex + 1]) {
                return pathParts[embedIndex + 1];
            }
        }
    } catch {
        return null;
    }

    return null;
}

export function getYouTubeEmbedUrl(url) {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

export function getExternalPreviewImageUrl(item) {
    const url = resolveMediaUrl(item);

    if (item.platform === 'youtube') {
        const videoId = getYouTubeVideoId(url);
        return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
    }

    if (item.platform === 'tenor' || item.platform === 'giphy' || item.platform === 'klipy' || /\.(gif|webp)($|\?)/i.test(url)) {
        return url;
    }

    return null;
}

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
