import { ASSETS_BASE_URL, EAGER_LOAD_COUNT, PREVIEW_MARGIN } from './config.js';
import { container, noResultsIndicator } from './dom.js';
import { getFavoriteKey, toggleFavorite, updateFavoriteButtons } from './favorites.js';
import { CATEGORY_DISPLAY_NAMES, CATEGORY_ICON_URLS, CHROMA_ICON_URL, GAME_LOGO_URLS } from './icons.js';
import { getExternalPreviewImageUrl, isExternalItem, isRecentlyUploaded, resolveMediaUrl } from './items.js';
import { openLightbox } from './lightbox.js';

let renderedItemCount = 0;

export const previewObserver = createPreviewObserver();

export function renderGallery(allItems, { append = false } = {}) {
    // Appending keeps existing cards in the DOM so the scroll position and loaded images stay untouched.
    const canAppend = append && renderedItemCount > 0 && renderedItemCount <= allItems.length;
    const items = canAppend ? allItems.slice(renderedItemCount) : allItems;
    if (!canAppend) {
        container.innerHTML = '';
    }
    renderedItemCount = allItems.length;

    if (canAppend && items.length === 0) {
        return;
    }

    if (items.length === 0) {
        noResultsIndicator.classList.remove('hidden');
        return;
    }
    noResultsIndicator.classList.add('hidden');

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        const mediaWrapper = document.createElement('div');
        mediaWrapper.className = 'card-media';
        mediaWrapper.style.cursor = 'pointer';
        mediaWrapper.addEventListener('click', () => openLightbox(item));
        setCardPreviewPlaceholder(mediaWrapper);
        queueCardPreviewLoad(mediaWrapper, item);

        const favoriteButton = document.createElement('button');
        favoriteButton.type = 'button';
        favoriteButton.className = 'card-favorite-btn';
        favoriteButton.dataset.favoriteKey = getFavoriteKey(item);
        favoriteButton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21C12 21 3 15.500 3 9.500A4.500 4.500 0 0 1 12 7.500A4.500 4.500 0 0 1 21 9.500C21 15.500 12 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
        favoriteButton.addEventListener('click', event => {
            event.stopPropagation();
            toggleFavorite(item);
        });

        const info = document.createElement('div');
        info.className = 'card-info';

        const header = document.createElement('div');
        header.className = 'card-header';

        const textWrapper = document.createElement('div');
        textWrapper.className = 'card-text-wrap';
        const title = document.createElement('h3');
        title.className = 'card-title';
        title.textContent = item.title;
        textWrapper.appendChild(title);

        const iconPanel = document.createElement('div');
        iconPanel.className = 'card-meta-icons';
        const categoryIconUrl = CATEGORY_ICON_URLS[item.category];
        if (categoryIconUrl) {
            iconPanel.appendChild(createCardMetaIcon(
                categoryIconUrl,
                CATEGORY_DISPLAY_NAMES[item.category] || item.category
            ));
        }

        const gameIconUrl = GAME_LOGO_URLS[item.game];
        if (gameIconUrl) {
            iconPanel.appendChild(createCardMetaIcon(gameIconUrl, item.game));
        }

        if (item.tags.includes('Chroma') && CHROMA_ICON_URL) {
            iconPanel.appendChild(createCardMetaIcon(CHROMA_ICON_URL, 'Chroma'));
        }

        header.appendChild(textWrapper);
        header.appendChild(iconPanel);
        info.appendChild(header);

        if (item.tags.length > 0) {
            const tagContainer = document.createElement('div');
            tagContainer.className = 'tag-container';
            item.tags.filter(tag => tag !== 'Chroma').forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag';
                tagSpan.textContent = tag;
                tagContainer.appendChild(tagSpan);
            });
            info.appendChild(tagContainer);
        }

        card.appendChild(mediaWrapper);
        if (isRecentlyUploaded(item)) {
            const badge = document.createElement('span');
            badge.className = 'card-new-badge';
            badge.textContent = 'New';
            card.appendChild(badge);
        }
        card.appendChild(favoriteButton);
        card.appendChild(info);
        fragment.appendChild(card);
    });

    const firstNewCardIndex = container.children.length;
    container.appendChild(fragment);
    updateFavoriteButtons();

    // Eager-load first N cards for faster initial scroll experience
    let eagerCount = 0;
    Array.from(container.children).slice(firstNewCardIndex).forEach(card => {
        const mediaWrapper = card.querySelector('.card-media');
        if (!mediaWrapper) return;
        if (!canAppend && eagerCount < EAGER_LOAD_COUNT) {
            hydrateCardPreview(mediaWrapper);
            eagerCount++;
        } else {
            if (previewObserver) {
                previewObserver.observe(mediaWrapper);
            } else {
                hydrateCardPreview(mediaWrapper);
            }
        }
    });
}

export function createCardMetaIcon(url, label) {
    const icon = document.createElement('img');
    icon.className = 'card-meta-icon';
    icon.src = url;
    icon.alt = label;
    icon.title = label;
    icon.fetchPriority = 'high';
    return icon;
}

export function createPreviewObserver() {
    if (!('IntersectionObserver' in window)) {
        return null;
    }

    return new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                hydrateCardPreview(entry.target);
            } else {
                cancelPendingCardPreview(entry.target);
            }
        });
    }, {
        rootMargin: PREVIEW_MARGIN
    });
}

// The shimmer skeleton is drawn by CSS on .card-media until it is marked ready.
export function setCardPreviewPlaceholder(mediaWrapper) {
    mediaWrapper.innerHTML = '';
    mediaWrapper.classList.remove('is-ready');
}

export function markCardMediaReady(mediaWrapper) {
    mediaWrapper.classList.add('is-ready');
}

export function markCardMediaFailed(mediaWrapper) {
    mediaWrapper.classList.add('is-ready', 'is-failed');
}

export function queueCardPreviewLoad(mediaWrapper, item) {
    mediaWrapper.dataset.loaded = 'false';
    mediaWrapper.dataset.mediaUrl = resolveMediaUrl(item);
    mediaWrapper.dataset.thumbUrl = item.thumbUrl ? `${ASSETS_BASE_URL}${item.thumbUrl}` : '';
    mediaWrapper.dataset.previewUrl = item.previewUrl ? `${ASSETS_BASE_URL}${item.previewUrl}` : '';
    mediaWrapper.dataset.itemType = item.type;
    mediaWrapper.dataset.isExternal = String(isExternalItem(item));
    mediaWrapper.dataset.externalPreviewUrl = getExternalPreviewImageUrl(item) || '';
    mediaWrapper.dataset.itemTitle = item.title;
    mediaWrapper.dataset.platform = item.platform || '';
}

// Aborts previews that are still downloading once they scroll out of range; they reload when scrolled back.
export function cancelPendingCardPreview(mediaWrapper) {
    if (mediaWrapper.dataset.loaded !== 'true') {
        return;
    }

    const media = mediaWrapper.querySelector('img, video');
    const isPending = media instanceof HTMLImageElement ? !media.complete : media instanceof HTMLVideoElement ? media.readyState < 3 : false;
    if (!isPending) {
        return;
    }

    media.removeAttribute('src');
    if (media instanceof HTMLVideoElement) {
        media.load();
    }
    setCardPreviewPlaceholder(mediaWrapper);
    mediaWrapper.dataset.loaded = 'false';
}

export function hydrateCardPreview(mediaWrapper) {
    if (mediaWrapper.dataset.loaded === 'true') {
        return;
    }

    setCardPreviewPlaceholder(mediaWrapper);

    const mediaUrl = mediaWrapper.dataset.mediaUrl;
    const thumbUrl = mediaWrapper.dataset.thumbUrl;
    const previewUrl = mediaWrapper.dataset.previewUrl;
    const itemType = mediaWrapper.dataset.itemType;
    const isExternal = mediaWrapper.dataset.isExternal === 'true';
    const previewImageUrl = mediaWrapper.dataset.externalPreviewUrl;
    const title = mediaWrapper.dataset.itemTitle;
    const platform = mediaWrapper.dataset.platform;

    if (isExternal) {
        if (previewImageUrl) {
            const img = document.createElement('img');
            img.addEventListener('load', () => markCardMediaReady(mediaWrapper), { once: true });
            img.addEventListener('error', () => markCardMediaReady(mediaWrapper), { once: true });
            img.src = previewImageUrl;
            img.alt = title;
            img.fetchPriority = 'low';
            img.loading = 'eager';
            img.decoding = 'async';
            mediaWrapper.appendChild(img);
        } else {
            const externalPreview = document.createElement('div');
            externalPreview.className = 'external-link-preview';
            externalPreview.textContent = platform ? `External: ${platform}` : 'External Link';
            mediaWrapper.appendChild(externalPreview);
            markCardMediaReady(mediaWrapper);
        }
    } else if (itemType === 'video') {
        const video = document.createElement('video');
        video.addEventListener('loadeddata', () => markCardMediaReady(mediaWrapper), { once: true });
        video.addEventListener('error', () => {
            if (video.src === mediaUrl || !previewUrl) {
                markCardMediaReady(mediaWrapper);
            }
        });
        // Small silent preview + poster for the grid; the lightbox still plays the original.
        video.src = previewUrl || mediaUrl;
        if (thumbUrl) {
            video.poster = thumbUrl;
        }
        if (previewUrl) {
            video.addEventListener('error', () => {
                if (video.src !== mediaUrl) {
                    video.src = mediaUrl;
                }
            }, { once: true });
        }
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'none';
        mediaWrapper.appendChild(video);
    } else if (itemType === 'audio') {
        const audioPreview = document.createElement('div');
        audioPreview.className = 'external-link-preview audio-preview';
        audioPreview.textContent = 'Audio file';
        mediaWrapper.appendChild(audioPreview);
        markCardMediaReady(mediaWrapper);
    } else {
        const img = document.createElement('img');
        img.addEventListener('load', () => {
            if (img.naturalWidth === 0) {
                markCardMediaFailed(mediaWrapper);
            } else {
                markCardMediaReady(mediaWrapper);
            }
        }, { once: true });
        // Registered before the fallback listener so a failed thumbnail keeps the skeleton until the original loads.
        img.addEventListener('error', () => {
            if (!thumbUrl || img.src === thumbUrl) {
                if (!thumbUrl) markCardMediaFailed(mediaWrapper);
                return;
            }
            markCardMediaFailed(mediaWrapper);
        });
        img.src = thumbUrl || mediaUrl;
        if (thumbUrl) {
            // A missing or broken thumbnail falls back to the original.
            img.addEventListener('error', () => {
                if (img.src !== mediaUrl) {
                    img.src = mediaUrl;
                }
            }, { once: true });
        }
        img.alt = title;
        img.fetchPriority = 'low';
        img.loading = 'eager';
        img.decoding = 'async';
        mediaWrapper.appendChild(img);
    }

    mediaWrapper.dataset.loaded = 'true';
}
