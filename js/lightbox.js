import { applyFilters } from './catalog.js';
import { lightbox, lightboxImg, originalLink, shareAssetLinkButton } from './dom.js';
import { updateFavoriteButtons } from './favorites.js';
import { CATEGORY_DISPLAY_NAMES } from './icons.js';
import { escapeHtml, formatSkinReleaseDate, formatUploadedAt, getExternalPreviewImageUrl, getYouTubeEmbedUrl, isExternalItem, resolveMediaUrl } from './items.js';
import { state } from './state.js';
import { copyToClipboard } from './ui.js';
import { buildAssetOnlyShareUrl, getAssetShareId, getUrlParams, syncUrlWithState } from './urlstate.js';

let lightboxZoomed = false;

let lightboxPan = { x: 0, y: 0 };

let activeLightboxPan = null;

let suppressLightboxImageClick = false;

export const LIGHTBOX_ZOOM_SCALE = 2;

export function openAssetFromUrlParam(assetIdFromInit) {
    const params = getUrlParams();
    const assetId = assetIdFromInit || params.get('asset');

    if (!assetId) {
        return;
    }

    const item = state.allMediaItems.find(media => getAssetShareId(media) === assetId);
    if (item) {
        openLightbox(item, { syncUrl: false });
    }
}

export function closeLightbox(syncUrl = true) {
    state.currentLightboxItem = null;
    resetLightboxImageZoom();
    lightbox.classList.add('hidden');

    if (state.deferInitialGalleryRender) {
        state.deferInitialGalleryRender = false;
        applyFilters({ syncUrl: false });
    }

    if (syncUrl) {
        syncUrlWithState();
    }
}

// Close Lightbox Events
document.querySelector('.close-btn').addEventListener('click', () => closeLightbox());

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

export function navigateLightbox(direction) {
    if (!state.currentLightboxItem || state.currentFilteredItems.length === 0) {
        return;
    }

    const currentIndex = state.currentFilteredItems.findIndex(item => getAssetShareId(item) === getAssetShareId(state.currentLightboxItem));
    const startIndex = currentIndex < 0 ? (direction > 0 ? -1 : 0) : currentIndex;
    const nextIndex = (startIndex + direction + state.currentFilteredItems.length) % state.currentFilteredItems.length;
    openLightbox(state.currentFilteredItems[nextIndex]);
}

document.addEventListener('keydown', (event) => {
    if (lightbox.classList.contains('hidden')) {
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        closeLightbox();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        navigateLightbox(event.key === 'ArrowRight' ? 1 : -1);
    }
});

export const SWIPE_MIN_DISTANCE = 50;

let swipeStart = null;

export const lightboxMediaArea = document.querySelector('.lightbox-media');

lightboxMediaArea.addEventListener('touchstart', (event) => {
    const target = event.target;
    const isMediaControl = target instanceof Element && target.closest('video, audio, iframe');
    if (event.touches.length !== 1 || lightboxZoomed || isMediaControl) {
        swipeStart = null;
        return;
    }
    swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });

lightboxMediaArea.addEventListener('touchend', (event) => {
    if (!swipeStart || event.changedTouches.length === 0) {
        return;
    }

    const deltaX = event.changedTouches[0].clientX - swipeStart.x;
    const deltaY = event.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;

    if (Math.abs(deltaX) >= SWIPE_MIN_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        suppressLightboxImageClick = true;
        setTimeout(() => { suppressLightboxImageClick = false; }, 400);
        navigateLightbox(deltaX < 0 ? 1 : -1);
    }
});

lightboxMediaArea.addEventListener('touchcancel', () => { swipeStart = null; });

export function resetLightboxImageZoom() {
    lightboxZoomed = false;
    lightboxPan = { x: 0, y: 0 };
    activeLightboxPan = null;
    suppressLightboxImageClick = false;
    lightboxImg.style.transform = '';
    lightboxImg.classList.remove('is-zoomable', 'is-zoomed', 'is-panning');
}

export function updateLightboxImageTransform() {
    if (!lightboxZoomed) {
        lightboxImg.style.transform = '';
        lightboxImg.classList.remove('is-zoomed');
        return;
    }

    const mediaContainer = document.querySelector('.lightbox-media');
    const mediaStyles = window.getComputedStyle(mediaContainer);
    const availableWidth = mediaContainer.clientWidth - parseFloat(mediaStyles.paddingLeft) - parseFloat(mediaStyles.paddingRight);
    const availableHeight = mediaContainer.clientHeight - parseFloat(mediaStyles.paddingTop) - parseFloat(mediaStyles.paddingBottom);
    const maxPanX = Math.max(0, (lightboxImg.offsetWidth * LIGHTBOX_ZOOM_SCALE - availableWidth) / 2);
    const maxPanY = Math.max(0, (lightboxImg.offsetHeight * LIGHTBOX_ZOOM_SCALE - availableHeight) / 2);

    lightboxPan.x = Math.max(-maxPanX, Math.min(maxPanX, lightboxPan.x));
    lightboxPan.y = Math.max(-maxPanY, Math.min(maxPanY, lightboxPan.y));
    lightboxImg.style.transform = `translate3d(${lightboxPan.x}px, ${lightboxPan.y}px, 0) scale(${LIGHTBOX_ZOOM_SCALE})`;
    lightboxImg.classList.add('is-zoomed');
}

export function toggleLightboxImageZoom() {
    if (lightboxImg.classList.contains('hidden') || !lightboxImg.classList.contains('is-zoomable')) {
        return;
    }

    lightboxZoomed = !lightboxZoomed;
    if (!lightboxZoomed) {
        lightboxPan = { x: 0, y: 0 };
    }
    updateLightboxImageTransform();
}

export function updateLightboxImageZoomAvailability() {
    const hasHighResolution = lightboxImg.naturalWidth > lightboxImg.clientWidth * 1.2 ||
        lightboxImg.naturalHeight > lightboxImg.clientHeight * 1.2;
    lightboxImg.classList.toggle('is-zoomable', hasHighResolution);
}

lightboxImg.addEventListener('click', () => {
    if (suppressLightboxImageClick) {
        suppressLightboxImageClick = false;
        return;
    }
    toggleLightboxImageZoom();
});

lightboxImg.addEventListener('pointerdown', (event) => {
    if (!lightboxZoomed || event.button !== 0) {
        return;
    }

    event.preventDefault();
    activeLightboxPan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        panX: lightboxPan.x,
        panY: lightboxPan.y,
        moved: false
    };
    lightboxImg.classList.add('is-panning');
    lightboxImg.setPointerCapture(event.pointerId);
});

lightboxImg.addEventListener('pointermove', (event) => {
    if (!activeLightboxPan || activeLightboxPan.pointerId !== event.pointerId) {
        return;
    }

    const deltaX = event.clientX - activeLightboxPan.startX;
    const deltaY = event.clientY - activeLightboxPan.startY;
    activeLightboxPan.moved ||= Math.abs(deltaX) + Math.abs(deltaY) > 2;
    lightboxPan = {
        x: activeLightboxPan.panX + deltaX,
        y: activeLightboxPan.panY + deltaY
    };
    updateLightboxImageTransform();
});

export function finishLightboxPan(event) {
    if (!activeLightboxPan || activeLightboxPan.pointerId !== event.pointerId) {
        return;
    }

    suppressLightboxImageClick = activeLightboxPan.moved;
    activeLightboxPan = null;
    lightboxImg.classList.remove('is-panning');
    if (suppressLightboxImageClick) {
        requestAnimationFrame(() => {
            suppressLightboxImageClick = false;
        });
    }
}

lightboxImg.addEventListener('pointerup', finishLightboxPan);

lightboxImg.addEventListener('pointercancel', finishLightboxPan);

export function openLightbox(item, options = {}) {
    const { syncUrl = true } = options;
    const mediaContainer = document.querySelector('.lightbox-media');
    const assetUrl = resolveMediaUrl(item);
    const isExternal = isExternalItem(item);
    const detailsDiv = document.getElementById('lightbox-details');
    const tagsDiv = document.getElementById('lightbox-tags');
    const technicalDiv = document.getElementById('lightbox-technical');

    state.currentLightboxItem = item;
    resetLightboxImageZoom();

    const existingPlayer = mediaContainer.querySelector('video, audio');
    if (existingPlayer) {
        existingPlayer.remove();
        lightboxImg.classList.remove('hidden');
    }

    let existingEmbed = mediaContainer.querySelector('iframe');
    if (existingEmbed) {
        existingEmbed.remove();
    }

    let existingExternalHint = mediaContainer.querySelector('.external-link-preview');
    if (existingExternalHint) {
        existingExternalHint.remove();
    }

    lightboxImg.classList.remove('hidden');
    lightboxImg.removeAttribute('src');
    lightboxImg.alt = 'Full view';
    lightboxImg.onload = null;
    lightboxImg.onerror = () => {
        if (state.currentLightboxItem !== item) {
            return;
        }
        lightboxImg.classList.add('hidden');
        lightboxImg.classList.remove('is-zoomable');
        const errorHint = document.createElement('div');
        errorHint.className = 'external-link-preview';
        errorHint.textContent = 'Preview could not be loaded';
        mediaContainer.appendChild(errorHint);
    };

    if (technicalDiv) {
        technicalDiv.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">ID:</span>
                <span class="detail-value">${escapeHtml(item.databaseId || 'Unknown')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${escapeHtml(item.type)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Source:</span>
                <span class="detail-value">${escapeHtml(item.source)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Uploaded:</span>
                <span class="detail-value">${escapeHtml(item.source === 'asset' ? formatUploadedAt(item.uploadedAt) : 'N/A')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Resolution:</span>
                <span class="detail-value" data-resolution>${item.type === 'audio' || (isExternal && item.platform === 'youtube') ? 'Not available' : 'Loading...'}</span>
            </div>
        `;
    }

    if (isExternal) {
        const previewImageUrl = getExternalPreviewImageUrl(item);
        lightboxImg.classList.add('hidden');

        if (item.platform === 'youtube') {
            const embedUrl = getYouTubeEmbedUrl(assetUrl);

            if (embedUrl) {
                const iframe = document.createElement('iframe');
                iframe.src = embedUrl;
                iframe.title = item.title;
                iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                iframe.allowFullscreen = true;
                iframe.className = 'lightbox-embed';
                mediaContainer.appendChild(iframe);
            }
        }

        if (!mediaContainer.querySelector('iframe') && previewImageUrl) {
            lightboxImg.classList.remove('hidden');
            lightboxImg.src = previewImageUrl;
            lightboxImg.alt = item.title;
            lightboxImg.onload = () => updateLightboxResolution(item, lightboxImg.naturalWidth, lightboxImg.naturalHeight);
        }

        if (!mediaContainer.querySelector('iframe') && !previewImageUrl) {
            const externalHint = document.createElement('div');
            externalHint.className = 'external-link-preview';
            externalHint.textContent = `External ${item.platform ? `${item.platform} ` : ''}link`;
            mediaContainer.appendChild(externalHint);
        }
    } else if (item.type === 'video') {
        lightboxImg.classList.add('hidden');
        const video = document.createElement('video');
        video.src = assetUrl;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.controls = true;
        video.style.maxWidth = '100%';
        video.style.maxHeight = '100%';
        video.addEventListener('loadedmetadata', () => {
            updateLightboxResolution(item, video.videoWidth, video.videoHeight);
        }, { once: true });
        mediaContainer.appendChild(video);
    } else {
        lightboxImg.classList.remove('hidden');
        lightboxImg.onload = () => updateLightboxResolution(item, lightboxImg.naturalWidth, lightboxImg.naturalHeight);
        lightboxImg.src = assetUrl;
    }

    originalLink.href = assetUrl;
    originalLink.target = '_blank';
    originalLink.rel = 'noopener noreferrer';
    originalLink.textContent = isExternal ? 'Open External Link' : 'View Original';

    document.getElementById('lightbox-title').textContent = item.title;

    // Create details section
    detailsDiv.innerHTML = `
        <div class="detail-item">
            <span class="detail-label">Skin:</span>
            <span class="detail-value">${escapeHtml(item.skinName)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Skin Release Date:</span>
            <span class="detail-value">${escapeHtml(formatSkinReleaseDate(item.skinReleaseDate))}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Game:</span>
            <span class="detail-value">${escapeHtml(item.game !== 'Generic' ? item.game : 'N/A')}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Category:</span>
            <span class="detail-value">${escapeHtml(CATEGORY_DISPLAY_NAMES[item.category] || item.category)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Asset Release Year:</span>
            <span class="detail-value">${escapeHtml(item.releaseYear)}</span>
        </div>
        ${item.platform ? `
        <div class="detail-item">
            <span class="detail-label">Platform:</span>
            <span class="detail-value">${escapeHtml(item.platform)}</span>
        </div>` : ''}
    `;

    if (item.tags.length > 0) {
        tagsDiv.innerHTML = '<div class="tags-label">Tags:</div>';
        const tagContainer = document.createElement('div');
        tagContainer.className = 'lightbox-tags';
        item.tags.filter(tag => tag !== 'Chroma').forEach(tag => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'lightbox-tag';
            tagSpan.textContent = tag;
            tagContainer.appendChild(tagSpan);
        });
        tagsDiv.appendChild(tagContainer);
    } else {
        tagsDiv.innerHTML = '';
    }

    lightbox.classList.remove('hidden');
    updateFavoriteButtons();
    requestAnimationFrame(() => {
        if (state.currentLightboxItem === item) {
            updateLightboxImageZoomAvailability();
        }
    });

    if (syncUrl) {
        syncUrlWithState();
    }

    scheduleLightboxNeighborPreload(item);
}

let lightboxPreloadTimer = null;

export const lightboxPreloadCache = new Map();

export const LIGHTBOX_PRELOAD_CACHE_LIMIT = 6;

export function scheduleLightboxNeighborPreload(item) {
    clearTimeout(lightboxPreloadTimer);
    // Wait briefly so the current image gets the bandwidth first and rapid navigation doesn't queue downloads.
    lightboxPreloadTimer = setTimeout(() => {
        if (state.currentLightboxItem !== item || state.currentFilteredItems.length < 2) {
            return;
        }

        const currentIndex = state.currentFilteredItems.findIndex(entry => getAssetShareId(entry) === getAssetShareId(item));
        if (currentIndex < 0) {
            return;
        }

        [1, -1].forEach(direction => {
            const neighbor = state.currentFilteredItems[(currentIndex + direction + state.currentFilteredItems.length) % state.currentFilteredItems.length];
            if (!neighbor || neighbor.type !== 'image' || isExternalItem(neighbor)) {
                return;
            }

            const url = resolveMediaUrl(neighbor);
            if (!url || lightboxPreloadCache.has(url)) {
                return;
            }

            const preloader = new Image();
            preloader.decoding = 'async';
            preloader.fetchPriority = 'low';
            preloader.src = url;
            lightboxPreloadCache.set(url, preloader);

            if (lightboxPreloadCache.size > LIGHTBOX_PRELOAD_CACHE_LIMIT) {
                lightboxPreloadCache.delete(lightboxPreloadCache.keys().next().value);
            }
        });
    }, 250);
}

export function updateLightboxResolution(item, width, height) {
    if (state.currentLightboxItem !== item) {
        return;
    }

    const resolutionElement = document.querySelector('[data-resolution]');
    if (resolutionElement && width && height) {
        resolutionElement.textContent = `${width} x ${height}px`;
        updateLightboxImageZoomAvailability();
    }
}

if (shareAssetLinkButton) {
    shareAssetLinkButton.addEventListener('click', async () => {
        if (!state.currentLightboxItem) {
            return;
        }

        const shareUrl = buildAssetOnlyShareUrl(state.currentLightboxItem, true).toString();
        await copyToClipboard(shareUrl, 'Link copied');
    });
}
