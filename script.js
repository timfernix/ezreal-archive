const API_URL = '/api/skins';
const ASSETS_BASE_URL = 'https://assets.timfernix.dev/';
const SHARE_BASE_URL = 'https://ezreal.timfernix.dev/';
let allMediaItems = [];
let activeFilters = { skinlines: [], categories: [], games: [] };
let currentSort = 'newest';
let currentLightboxItem = null;

const container = document.getElementById('gallery-container');
const searchInput = document.getElementById('searchInput');
const clearFiltersButton = document.getElementById('clear-filters-btn');
const noResultsIndicator = document.getElementById('no-results');
const loadingIndicator = document.getElementById('loading');
const archiveMeta = document.getElementById('archive-meta');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const originalLink = document.getElementById('original-link');
const shareAssetLinkButton = document.getElementById('share-asset-link');
const toastElement = document.getElementById('toast');
let toastTimeoutId = null;

function normalizeValue(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function deriveSkinlineFromName(skinName) {
    const normalizedName = normalizeValue(skinName);

    if (!normalizedName) {
        return 'No Skinline';
    }

    const withoutChampionName = normalizedName.replace(/\s+ezreal\s*$/i, '').trim();
    return withoutChampionName || normalizedName;
}

function resolveSkinName(skin) {
    return normalizeValue(skin.skinName) || 'Unknown Skin';
}

function resolveSkinline(skin) {
    return deriveSkinlineFromName(resolveSkinName(skin));
}

function resolveAssetTitle(asset, skinName) {
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

function resolveReleaseYear(skin, asset) {
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

function resolveSkinReleaseYear(skin) {
    const skinReleaseYear = normalizeValue(skin.releaseYear);

    if (skinReleaseYear !== undefined && skinReleaseYear !== null && skinReleaseYear !== '') {
        return String(skinReleaseYear);
    }

    return 'Unknown';
}

function getSortableReleaseYear(value) {
    const numericYear = Number.parseInt(value, 10);
    return Number.isNaN(numericYear) ? Number.NEGATIVE_INFINITY : numericYear;
}

function isExternalItem(item) {
    return item?.source === 'external_link' || item?.type === 'external';
}

function resolveMediaUrl(item) {
    if (isExternalItem(item)) {
        return item.url;
    }

    return `${ASSETS_BASE_URL}${item.url}`;
}

function getYouTubeVideoId(url) {
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

function getYouTubeEmbedUrl(url) {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

function getExternalPreviewImageUrl(item) {
    const url = resolveMediaUrl(item);

    if (item.platform === 'youtube') {
        const videoId = getYouTubeVideoId(url);
        return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
    }

    if (item.platform === 'tenor' || /\.gif($|\?)/i.test(url)) {
        return url;
    }

    return null;
}

function updateArchiveMeta(items) {
    if (!archiveMeta) {
        return;
    }

    const syncedAt = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });

    const totalItems = items.length;

    archiveMeta.textContent = `Synced: ${syncedAt} | Total: ${totalItems}`;
}

function getAssetShareId(item) {
    return `${item.source || 'asset'}:${item.url}`;
}

function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

function applyUrlStateToInputs() {
    const params = getUrlParams();
    const searchFromUrl = params.get('q') || '';
    const sortFromUrl = params.get('sort');
    const skinlines = params.getAll('skinline');
    const categories = params.getAll('category');
    const games = params.getAll('game');

    searchInput.value = searchFromUrl;

    if (sortFromUrl && ['newest', 'name-asc', 'skinline-asc', 'none'].includes(sortFromUrl)) {
        currentSort = sortFromUrl;
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = sortFromUrl;
        }
    }

    activeFilters.skinlines = skinlines.filter(value => allMediaItems.some(item => item.skinline === value));
    activeFilters.categories = categories.filter(value => allMediaItems.some(item => item.category === value));
    activeFilters.games = games.filter(value => allMediaItems.some(item => item.game === value));
}

function syncCheckboxUIWithActiveFilters() {
    const groups = [
        { menuId: 'skinline-menu', key: 'skinlines' },
        { menuId: 'cat-menu', key: 'categories' },
        { menuId: 'game-menu', key: 'games' }
    ];

    groups.forEach(group => {
        const menu = document.getElementById(group.menuId);
        if (!menu) {
            return;
        }

        menu.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = activeFilters[group.key].includes(checkbox.value);
        });
    });
}

function clearAllFilters() {
    activeFilters = { skinlines: [], categories: [], games: [] };
    searchInput.value = '';
    currentSort = 'newest';

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.value = currentSort;
    }

    syncCheckboxUIWithActiveFilters();
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
    applyFilters();
    showToast('Filters cleared');
}

function buildShareableUrl(item, useCustomBase = false) {
    const baseUrl = useCustomBase ? SHARE_BASE_URL : window.location.origin + window.location.pathname;
    const url = new URL(baseUrl);

    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        url.searchParams.set('q', searchTerm);
    }

    if (currentSort) {
        url.searchParams.set('sort', currentSort);
    }

    activeFilters.skinlines.forEach(value => url.searchParams.append('skinline', value));
    activeFilters.categories.forEach(value => url.searchParams.append('category', value));
    activeFilters.games.forEach(value => url.searchParams.append('game', value));

    if (item) {
        url.searchParams.set('asset', getAssetShareId(item));
    }

    return url;
}

function showToast(message) {
    if (!toastElement) {
        return;
    }

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }

    toastElement.textContent = message;
    toastElement.classList.remove('hidden');

    requestAnimationFrame(() => {
        toastElement.classList.add('show');
    });

    toastTimeoutId = setTimeout(() => {
        toastElement.classList.remove('show');
        setTimeout(() => {
            toastElement.classList.add('hidden');
        }, 220);
    }, 1800);
}

function syncUrlWithState() {
    const nextUrl = buildShareableUrl(currentLightboxItem, false);
    const nextRelative = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    history.replaceState({}, '', nextRelative);
}

function openAssetFromUrlParam(assetIdFromInit) {
    const params = getUrlParams();
    const assetId = assetIdFromInit || params.get('asset');

    if (!assetId) {
        return;
    }

    const item = allMediaItems.find(media => getAssetShareId(media) === assetId);
    if (item) {
        openLightbox(item, { syncUrl: false });
    }
}

function closeLightbox(syncUrl = true) {
    currentLightboxItem = null;
    lightbox.classList.add('hidden');

    if (syncUrl) {
        syncUrlWithState();
    }
}

// Close Lightbox Events
document.querySelector('.close-btn').addEventListener('click', () => closeLightbox());
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

function openLightbox(item, options = {}) {
    const { syncUrl = true } = options;
    const mediaContainer = document.querySelector('.lightbox-media');
    const assetUrl = resolveMediaUrl(item);
    const isExternal = isExternalItem(item);
    const detailsDiv = document.getElementById('lightbox-details');
    const tagsDiv = document.getElementById('lightbox-tags');

    currentLightboxItem = item;

    let existingVideo = mediaContainer.querySelector('video');
    if (existingVideo) {
        existingVideo.remove();
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
        mediaContainer.appendChild(video);
    } else {
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
            <span class="detail-value">${item.skinName}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Skin Release Year:</span>
            <span class="detail-value">${item.skinReleaseYear}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Game:</span>
            <span class="detail-value">${item.game !== 'Generic' ? item.game : 'N/A'}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Category:</span>
            <span class="detail-value">${item.category}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Asset Release Year:</span>
            <span class="detail-value">${item.releaseYear}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Type:</span>
            <span class="detail-value">${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Source:</span>
            <span class="detail-value">${item.source === 'external_link' ? 'External Link' : 'Asset'}</span>
        </div>
        ${item.platform ? `
        <div class="detail-item">
            <span class="detail-label">Platform:</span>
            <span class="detail-value">${item.platform}</span>
        </div>` : ''}
    `;
    
    if (item.tags.length > 0) {
        tagsDiv.innerHTML = '<div class="tags-label">Tags:</div>';
        const tagContainer = document.createElement('div');
        tagContainer.className = 'lightbox-tags';
        item.tags.forEach(tag => {
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

    if (syncUrl) {
        syncUrlWithState();
    }
}

async function init() {
    try {
        const initialAssetId = getUrlParams().get('asset');
        const response = await fetch(API_URL);
        const data = await response.json();
        
        data.forEach(skin => {
            skin.media.forEach(asset => {
                // Safely handle tags, even if the database returns null/undefined
                const safeTags = asset.tags ? asset.tags.filter(Boolean) : [];
                const skinName = resolveSkinName(skin);
                const title = resolveAssetTitle(asset, skinName);
                const skinline = resolveSkinline(skin);
                const releaseYear = resolveReleaseYear(skin, asset);
                const skinReleaseYear = resolveSkinReleaseYear(skin);
                const source = normalizeValue(asset.source) || 'asset';
                const platform = normalizeValue(asset.platform) || '';

                allMediaItems.push({
                    title,
                    skinName,
                    description: normalizeValue(skin.description) || '',
                    type: asset.type,
                    url: asset.url,
                    category: asset.category || 'Uncategorized',
                    game: asset.game || 'Generic',
                    source,
                    platform,
                    skinline,
                    releaseYear,
                    skinReleaseYear,
                    tags: safeTags,
                    // Use safeTags here so .join() never crashes
                    searchString: `${title} ${skinName} ${skinline} ${normalizeValue(skin.description) || ''} ${asset.category || ''} ${asset.game || ''} ${source} ${platform} ${releaseYear} ${skinReleaseYear} ${safeTags.join(' ')}`.toLowerCase()
                });
            });
        });

        createCheckboxes('skinline-menu', [...new Set(allMediaItems.map(m => m.skinline))].sort(), 'skinlines');
        createCheckboxes('cat-menu', [...new Set(allMediaItems.map(m => m.category))].sort(), 'categories');
        createCheckboxes('game-menu', [...new Set(allMediaItems.map(m => m.game))].sort(), 'games');
        applyUrlStateToInputs();
        syncCheckboxUIWithActiveFilters();
        updateArchiveMeta(allMediaItems);
        
        searchInput.addEventListener('input', applyFilters);
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            currentSort = e.target.value;
            applyFilters();
        });
        document.querySelectorAll('.filter-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById(e.target.dataset.target).classList.toggle('show');
            });
        });

        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', clearAllFilters);
        }

        applyFilters({ syncUrl: false });
        openAssetFromUrlParam(initialAssetId);
        loadingIndicator.classList.add('hidden');
    } catch (error) {
        console.error('API Error:', error);
    }
}

function createCheckboxes(menuId, options, filterType) {
    const menu = document.getElementById(menuId);
    options.forEach(opt => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${opt}"> ${opt}`;
        label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                activeFilters[filterType].push(opt);
            } else {
                activeFilters[filterType] = activeFilters[filterType].filter(item => item !== opt);
            }
            applyFilters(); // Trigger filtering whenever a box is toggled
        });
        menu.appendChild(label);
    });
}

function applyFilters(options = {}) {
    const { syncUrl = true } = options;
    const searchTerm = searchInput.value.toLowerCase();
    
    let filtered = allMediaItems.filter(item => {
        const matchesSearch = item.searchString.includes(searchTerm);
        const matchesSkinline = activeFilters.skinlines.length === 0 || activeFilters.skinlines.includes(item.skinline);
        const matchesGame = activeFilters.games.length === 0 || activeFilters.games.includes(item.game);
        const matchesCat = activeFilters.categories.length === 0 || activeFilters.categories.includes(item.category);
        
        return matchesSearch && matchesSkinline && matchesGame && matchesCat;
    });

    filtered = sortItems(filtered, currentSort);

    renderGallery(filtered);

    if (syncUrl) {
        syncUrlWithState();
    }
}

function sortItems(items, sortType) {
    const sorted = [...items];
    
    switch(sortType) {
        case 'name-asc':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'skinline-asc':
            sorted.sort((a, b) => a.skinline.localeCompare(b.skinline));
            break;
        case 'newest':
            sorted.sort((a, b) => {
                const yearDifference = getSortableReleaseYear(b.releaseYear) - getSortableReleaseYear(a.releaseYear);

                if (yearDifference !== 0) {
                    return yearDifference;
                }

                return a.title.localeCompare(b.title);
            });
            break;
        case 'none':
        default:
            break;
    }
    
    return sorted;
}

function renderGallery(items) {
    container.innerHTML = '';

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
        const mediaUrl = resolveMediaUrl(item);
        
        if (isExternalItem(item)) {
            const previewImageUrl = getExternalPreviewImageUrl(item);

            if (previewImageUrl) {
                const img = document.createElement('img');
                img.src = previewImageUrl;
                img.alt = item.title;
                img.loading = 'lazy';
                mediaWrapper.appendChild(img);
            } else {
                const externalPreview = document.createElement('div');
                externalPreview.className = 'external-link-preview';
                externalPreview.textContent = item.platform ? `External: ${item.platform}` : 'External Link';
                mediaWrapper.appendChild(externalPreview);
            }
        } else if (item.type === 'video') {
            const video = document.createElement('video');
            video.src = mediaUrl;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            mediaWrapper.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = mediaUrl;
            img.alt = item.title;
            img.loading = 'lazy';
            mediaWrapper.appendChild(img);
        }

        const info = document.createElement('div');
        info.className = 'card-info';

        const header = document.createElement('div');
        header.className = 'card-header';
        
        const textWrapper = document.createElement('div');
        textWrapper.className = 'card-text-wrap';
        const title = document.createElement('h3');
        title.className = 'card-title';
        title.textContent = item.title;
        const game = document.createElement('div');
        game.className = 'card-game';
        game.textContent = item.game !== 'Generic' ? item.game : '';
        
        textWrapper.appendChild(title);
        textWrapper.appendChild(game);

        const categoryBadge = document.createElement('span');
        categoryBadge.className = 'badge';
        categoryBadge.textContent = item.category;

        header.appendChild(textWrapper);
        header.appendChild(categoryBadge);
        info.appendChild(header);

        if (item.tags.length > 0) {
            const tagContainer = document.createElement('div');
            tagContainer.className = 'tag-container';
            item.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag';
                tagSpan.textContent = tag;
                tagContainer.appendChild(tagSpan);
            });
            info.appendChild(tagContainer);
        }

        card.appendChild(mediaWrapper);
        card.appendChild(info);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

document.addEventListener('DOMContentLoaded', init);

if (shareAssetLinkButton) {
    shareAssetLinkButton.addEventListener('click', async () => {
        if (!currentLightboxItem) {
            return;
        }

        const shareUrl = buildShareableUrl(currentLightboxItem, true).toString();
        let copied = false;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                copied = true;
            }
        } catch {
            copied = false;
        }

        showToast(copied ? 'Link copied' : 'Copy failed');
    });
}