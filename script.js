const API_URL = '/api/skins';
const ASSETS_BASE_URL = 'https://assets.timfernix.dev/';
const SHARE_BASE_URL = 'https://ezreal.timfernix.dev/';
const PAGE_SIZE = 50;
const EAGER_LOAD_COUNT = 15;
const PREVIEW_MARGIN = '500px 0px';
let allMediaItems = [];
let activeFilters = { skinlines: [], categories: [], games: [] };
let currentSort = 'newest';
let currentLightboxItem = null;
let serverOffset = 0;
let hasMoreServerData = true;
let isFetchingPage = false;
let totalAvailableItems = null;
let deferInitialGalleryRender = false;
let allAvailableFilterOptions = { skinlines: [], categories: [], games: [] };

const container = document.getElementById('gallery-container');
const searchInput = document.getElementById('searchInput');
const clearFiltersButton = document.getElementById('clear-filters-btn');
const noResultsIndicator = document.getElementById('no-results');
const loadingIndicator = document.getElementById('loading');
const archiveMeta = document.getElementById('archive-meta');
const archiveMetaText = document.getElementById('archive-meta-text');
const archiveMetaSpinner = document.getElementById('archive-meta-spinner');
const paginationControls = document.getElementById('pagination-controls');
const loadMoreButton = document.getElementById('load-more-btn');
const paginationStatus = document.getElementById('pagination-status');
const autoLoadSentinel = document.getElementById('auto-load-sentinel');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const originalLink = document.getElementById('original-link');
const shareAssetLinkButton = document.getElementById('share-asset-link');
const toastElement = document.getElementById('toast');
let toastTimeoutId = null;
const previewObserver = createPreviewObserver();

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

    const loadedItems = items.length;
    const totalSuffix = totalAvailableItems !== null ? ` / ${totalAvailableItems}` : '';

    if (archiveMetaText) {
        archiveMetaText.textContent = `Synced: ${syncedAt} | Loaded: ${loadedItems}${totalSuffix}`;
    } else {
        archiveMeta.textContent = `Synced: ${syncedAt} | Loaded: ${loadedItems}${totalSuffix}`;
    }

    updateArchiveMetaSpinner();
}

function updateArchiveMetaSpinner() {
    if (!archiveMetaSpinner) {
        return;
    }

    archiveMetaSpinner.classList.toggle('hidden', !isFetchingPage);
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

    if (sortFromUrl && ['newest', 'oldest', 'name-asc', 'skinline-asc', 'none'].includes(sortFromUrl)) {
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

function buildAssetOnlyShareUrl(item, useCustomBase = false) {
    const baseUrl = useCustomBase ? SHARE_BASE_URL : window.location.origin + window.location.pathname;
    const url = new URL(baseUrl);

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

    if (deferInitialGalleryRender) {
        deferInitialGalleryRender = false;
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
        deferInitialGalleryRender = Boolean(initialAssetId);

        // Fetch all available filter options first (cheap, single DB query)
        await fetchFilterOptions();

        // Then start pagination
        await fetchNextPage({ forceLegacyFullFetch: false });

        applyUrlStateToInputs();
        // Use the fetched filter options, not just what's in allMediaItems
        createCheckboxes('skinline-menu', allAvailableFilterOptions.skinlines, 'skinlines');
        createCheckboxes('cat-menu', allAvailableFilterOptions.categories, 'categories');
        createCheckboxes('game-menu', allAvailableFilterOptions.games, 'games');
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

        if (loadMoreButton) {
            loadMoreButton.addEventListener('click', () => loadNextPage());
        }

        setupAutoLoadObserver();

        if (initialAssetId) {
            await ensureAssetAvailable(initialAssetId);
            openAssetFromUrlParam(initialAssetId);
            if (!currentLightboxItem) {
                deferInitialGalleryRender = false;
                applyFilters({ syncUrl: false });
                showToast('Shared asset not found');
            } else {
                applyFilters({ syncUrl: false, deferRender: true });
            }
        } else {
            applyFilters({ syncUrl: false });
        }

        loadingIndicator.classList.add('hidden');
    } catch (error) {
        console.error('API Error:', error);
        loadingIndicator.textContent = 'Failed to load archive.';
    }
}

function createCheckboxes(menuId, options, filterType) {
    const menu = document.getElementById(menuId);
    if (!menu) {
        console.warn(`Menu not found: ${menuId}`);
        return;
    }

    console.log(`Creating checkboxes for ${menuId}:`, options);
    menu.innerHTML = '';

    if (!options || options.length === 0) {
        console.warn(`No options provided for ${menuId}`);
        return;
    }

    options.forEach(opt => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${opt}"> ${opt}`;
        const checkbox = label.querySelector('input');
        checkbox.checked = activeFilters[filterType].includes(opt);
        label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!activeFilters[filterType].includes(opt)) {
                    activeFilters[filterType].push(opt);
                }
            } else {
                activeFilters[filterType] = activeFilters[filterType].filter(item => item !== opt);
            }
            applyFilters(); // Trigger filtering whenever a box is toggled
        });
        menu.appendChild(label);
    });
}

function refreshFilterMenus() {
    // Filter options are now fetched from the backend and stored globally
    // Just validate and sync the active filters
    activeFilters.skinlines = activeFilters.skinlines.filter(value => allAvailableFilterOptions.skinlines.includes(value));
    activeFilters.categories = activeFilters.categories.filter(value => allAvailableFilterOptions.categories.includes(value));
    activeFilters.games = activeFilters.games.filter(value => allAvailableFilterOptions.games.includes(value));
}

async function fetchFilterOptions() {
    try {
        const response = await fetch('/api/filters');
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Filter options fetched:', data);
        
        if (data && data.skinlines && data.categories && data.games) {
            allAvailableFilterOptions = {
                skinlines: Array.isArray(data.skinlines) ? data.skinlines : [],
                categories: Array.isArray(data.categories) ? data.categories : [],
                games: Array.isArray(data.games) ? data.games : []
            };
            console.log('Filter options set:', allAvailableFilterOptions);
        } else {
            console.warn('Invalid filter response structure:', data);
        }
    } catch (err) {
        console.error('Failed to fetch filter options:', err);
        // Fallback: filters will be populated from items as they load
        allAvailableFilterOptions = { skinlines: [], categories: [], games: [] };
    }
}

function applyFilters(options = {}) {
    const { syncUrl = true, deferRender = false } = options;
    const searchTerm = searchInput.value.toLowerCase();
    const hasActiveFilters = Boolean(searchTerm) || activeFilters.skinlines.length > 0 || activeFilters.categories.length > 0 || activeFilters.games.length > 0;
    
    let filtered = allMediaItems.filter(item => {
        const matchesSearch = item.searchString.includes(searchTerm);
        const matchesSkinline = activeFilters.skinlines.length === 0 || activeFilters.skinlines.includes(item.skinline);
        const matchesGame = activeFilters.games.length === 0 || activeFilters.games.includes(item.game);
        const matchesCat = activeFilters.categories.length === 0 || activeFilters.categories.includes(item.category);
        
        return matchesSearch && matchesSkinline && matchesGame && matchesCat;
    });

    filtered = sortItems(filtered, currentSort);

    if (deferRender) {
        container.innerHTML = '';
        noResultsIndicator.classList.add('hidden');
    } else {
        renderGallery(filtered);
    }

    updatePaginationControls(filtered.length);

    if (syncUrl) {
        syncUrlWithState();
    }

    // When filtering/searching: auto-load more server pages if results are below PAGE_SIZE
    if (hasActiveFilters && filtered.length < PAGE_SIZE && hasMoreServerData && !isFetchingPage) {
        fetchNextPage({ forceLegacyFullFetch: false }).then(() => applyFilters({ syncUrl }));
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
        case 'oldest':
            sorted.sort((a, b) => {
                const yearDifference = getSortableReleaseYear(a.releaseYear) - getSortableReleaseYear(b.releaseYear);

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
        setCardPreviewPlaceholder(mediaWrapper);
        queueCardPreviewLoad(mediaWrapper, item);

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

    // Eager-load first N cards for faster initial scroll experience
    let eagerCount = 0;
    container.querySelectorAll('.card-media').forEach(mediaWrapper => {
        if (eagerCount < EAGER_LOAD_COUNT) {
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

function createPreviewObserver() {
    if (!('IntersectionObserver' in window)) {
        return null;
    }

    return new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return;
            }

            hydrateCardPreview(entry.target);
            previewObserver.unobserve(entry.target);
        });
    }, {
        rootMargin: PREVIEW_MARGIN
    });
}

function setCardPreviewPlaceholder(mediaWrapper) {
    const placeholder = document.createElement('div');
    placeholder.className = 'external-link-preview';
    placeholder.textContent = 'Loading preview...';
    mediaWrapper.appendChild(placeholder);
}

function queueCardPreviewLoad(mediaWrapper, item) {
    mediaWrapper.dataset.loaded = 'false';
    mediaWrapper.dataset.mediaUrl = resolveMediaUrl(item);
    mediaWrapper.dataset.itemType = item.type;
    mediaWrapper.dataset.isExternal = String(isExternalItem(item));
    mediaWrapper.dataset.externalPreviewUrl = getExternalPreviewImageUrl(item) || '';
    mediaWrapper.dataset.itemTitle = item.title;
    mediaWrapper.dataset.platform = item.platform || '';
}

function hydrateCardPreview(mediaWrapper) {
    if (mediaWrapper.dataset.loaded === 'true') {
        return;
    }

    mediaWrapper.innerHTML = '';

    const mediaUrl = mediaWrapper.dataset.mediaUrl;
    const itemType = mediaWrapper.dataset.itemType;
    const isExternal = mediaWrapper.dataset.isExternal === 'true';
    const previewImageUrl = mediaWrapper.dataset.externalPreviewUrl;
    const title = mediaWrapper.dataset.itemTitle;
    const platform = mediaWrapper.dataset.platform;

    if (isExternal) {
        if (previewImageUrl) {
            const img = document.createElement('img');
            img.src = previewImageUrl;
            img.alt = title;
            img.loading = 'eager';
            img.decoding = 'async';
            mediaWrapper.appendChild(img);
        } else {
            const externalPreview = document.createElement('div');
            externalPreview.className = 'external-link-preview';
            externalPreview.textContent = platform ? `External: ${platform}` : 'External Link';
            mediaWrapper.appendChild(externalPreview);
        }
    } else if (itemType === 'video') {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'none';
        mediaWrapper.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.alt = title;
        img.loading = 'eager';
        img.decoding = 'async';
        mediaWrapper.appendChild(img);
    }

    mediaWrapper.dataset.loaded = 'true';
}

function updatePaginationControls(filteredCount = null) {
    if (!paginationControls) {
        return;
    }

    const loadedCount = allMediaItems.length;
    const hasAnyData = loadedCount > 0 || hasMoreServerData;

    if (!hasAnyData) {
        paginationControls.classList.add('hidden');
        return;
    }

    paginationControls.classList.remove('hidden');

    const searchTerm = searchInput.value.toLowerCase();
    const hasActiveFilters = Boolean(searchTerm) || activeFilters.skinlines.length > 0 || activeFilters.categories.length > 0 || activeFilters.games.length > 0;

    // Hide manual "Load more" while auto-fetching for active filters/search
    const autoFetching = hasActiveFilters && (filteredCount === null || filteredCount < PAGE_SIZE) && hasMoreServerData;

    if (loadMoreButton) {
        loadMoreButton.disabled = isFetchingPage || !hasMoreServerData;
        loadMoreButton.textContent = isFetchingPage ? 'Loading...' : `Load ${PAGE_SIZE} more`;
        loadMoreButton.classList.toggle('hidden', !hasMoreServerData || autoFetching);
    }

    if (paginationStatus) {
        paginationStatus.textContent = autoFetching && isFetchingPage ? 'Loading more results...' : '';
    }
}

function mapSkinAssetToMediaItem(skin, asset) {
    const safeTags = Array.isArray(asset.tags) ? asset.tags.filter(Boolean) : [];
    const skinName = resolveSkinName(skin);
    const title = resolveAssetTitle(asset, skinName);
    const skinline = resolveSkinline(skin);
    const releaseYear = resolveReleaseYear(skin, asset);
    const skinReleaseYear = resolveSkinReleaseYear(skin);
    const source = normalizeValue(asset.source) || 'asset';
    const platform = normalizeValue(asset.platform) || '';
    const description = normalizeValue(skin.description) || '';

    return {
        title,
        skinName,
        description,
        type: normalizeValue(asset.type) || 'image',
        url: normalizeValue(asset.url) || '',
        category: normalizeValue(asset.category) || 'Uncategorized',
        game: normalizeValue(asset.game) || 'Generic',
        source,
        platform,
        skinline,
        releaseYear,
        skinReleaseYear,
        tags: safeTags,
        searchString: `${title} ${skinName} ${skinline} ${description} ${asset.category || ''} ${asset.game || ''} ${source} ${platform} ${releaseYear} ${skinReleaseYear} ${safeTags.join(' ')}`.toLowerCase()
    };
}

function mapFlatItemToMediaItem(item) {
    const safeTags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    const skinName = normalizeValue(item.skinName) || 'Unknown Skin';
    const skinline = normalizeValue(item.skinline) || deriveSkinlineFromName(skinName);
    const title = normalizeValue(item.title) || normalizeValue(item.url) || skinName;
    const description = normalizeValue(item.description) || '';
    const source = normalizeValue(item.source) || 'asset';
    const platform = normalizeValue(item.platform) || '';
    const releaseYear = normalizeValue(item.releaseYear) || 'Unknown';
    const skinReleaseYear = normalizeValue(item.skinReleaseYear) || 'Unknown';

    return {
        title,
        skinName,
        description,
        type: normalizeValue(item.type) || 'image',
        url: normalizeValue(item.url) || '',
        category: normalizeValue(item.category) || 'Uncategorized',
        game: normalizeValue(item.game) || 'Generic',
        source,
        platform,
        skinline,
        releaseYear,
        skinReleaseYear,
        tags: safeTags,
        searchString: `${title} ${skinName} ${skinline} ${description} ${item.category || ''} ${item.game || ''} ${source} ${platform} ${releaseYear} ${skinReleaseYear} ${safeTags.join(' ')}`.toLowerCase()
    };
}

function flattenSkinsToMediaItems(skins) {
    const mediaItems = [];

    skins.forEach(skin => {
        if (!Array.isArray(skin.media)) {
            return;
        }

        skin.media.forEach(asset => {
            mediaItems.push(mapSkinAssetToMediaItem(skin, asset));
        });
    });

    return mediaItems;
}

function normalizeApiPayload(data, limit, offset) {
    if (Array.isArray(data)) {
        return {
            items: flattenSkinsToMediaItems(data),
            hasMore: false,
            nextOffset: offset,
            total: null,
            backendSupportsPaging: false
        };
    }

    const payload = data && typeof data === 'object' ? data : {};
    const candidateItems = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.skins)
            ? payload.skins
            : Array.isArray(payload.data)
                ? payload.data
                : [];

    const hasSkinShape = candidateItems.some(item => Array.isArray(item.media));
    const normalizedItems = hasSkinShape
        ? flattenSkinsToMediaItems(candidateItems)
        : candidateItems.map(mapFlatItemToMediaItem).filter(item => item.url);

    const nextOffsetFromPayload = Number.isInteger(payload.nextOffset)
        ? payload.nextOffset
        : offset + normalizedItems.length;
    const hasMoreFromPayload = typeof payload.hasMore === 'boolean'
        ? payload.hasMore
        : normalizedItems.length >= limit;

    return {
        items: normalizedItems,
        hasMore: hasMoreFromPayload,
        nextOffset: nextOffsetFromPayload,
        total: Number.isInteger(payload.total) ? payload.total : null,
        backendSupportsPaging: true
    };
}

async function loadNextPage() {
    if (isFetchingPage || !hasMoreServerData) {
        return;
    }

    await fetchNextPage({ forceLegacyFullFetch: false });
    applyFilters();
}

function setupAutoLoadObserver() {
    if (!autoLoadSentinel || !('IntersectionObserver' in window)) {
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isFetchingPage && hasMoreServerData) {
                loadNextPage();
            }
        });
    }, { rootMargin: '400px 0px' });

    observer.observe(autoLoadSentinel);
}

async function fetchNextPage(options = {}) {
    const { forceLegacyFullFetch = false } = options;

    if (isFetchingPage || (!hasMoreServerData && !forceLegacyFullFetch)) {
        return;
    }

    isFetchingPage = true;
    updatePaginationControls();
    updateArchiveMetaSpinner();

    try {
        const requestUrl = new URL(API_URL, window.location.origin);
        requestUrl.searchParams.set('limit', String(PAGE_SIZE));
        requestUrl.searchParams.set('offset', String(serverOffset));

        const response = await fetch(requestUrl.toString());
        const data = await response.json();
        const normalized = normalizeApiPayload(data, PAGE_SIZE, serverOffset);

        if (!normalized.backendSupportsPaging && allMediaItems.length > 0) {
            hasMoreServerData = false;
            return;
        }

        const seenIds = new Set(allMediaItems.map(item => getAssetShareId(item)));
        const newItems = normalized.items.filter(item => {
            const id = getAssetShareId(item);
            if (seenIds.has(id)) {
                return false;
            }
            seenIds.add(id);
            return true;
        });

        allMediaItems.push(...newItems);
        totalAvailableItems = normalized.total;
        serverOffset = normalized.nextOffset;
        hasMoreServerData = normalized.backendSupportsPaging ? normalized.hasMore : false;

        updateArchiveMeta(allMediaItems);
    } catch (error) {
        console.error('Page fetch failed:', error);

        if (allMediaItems.length === 0) {
            // Fallback for older API implementations that only return complete arrays.
            const legacyResponse = await fetch(API_URL);
            const legacyData = await legacyResponse.json();
            const legacyNormalized = normalizeApiPayload(legacyData, PAGE_SIZE, serverOffset);
            allMediaItems = legacyNormalized.items;
            hasMoreServerData = false;
            totalAvailableItems = legacyNormalized.items.length;
            updateArchiveMeta(allMediaItems);
        }
    } finally {
        isFetchingPage = false;
        updatePaginationControls();
        updateArchiveMetaSpinner();
    }
}

async function ensureAssetAvailable(assetId) {
    const existing = allMediaItems.find(media => getAssetShareId(media) === assetId);
    if (existing) {
        return;
    }

    // Try the dedicated single-asset endpoint first (much cheaper than paging)
    try {
        const assetUrl = new URL('/api/asset', window.location.origin);
        assetUrl.searchParams.set('id', assetId);
        const response = await fetch(assetUrl.toString());

        if (response.ok) {
            const raw = await response.json();
            if (raw && !raw.error) {
                const item = mapFlatItemToMediaItem(raw);
                const alreadyIn = allMediaItems.some(m => getAssetShareId(m) === getAssetShareId(item));
                if (!alreadyIn) {
                    allMediaItems.unshift(item);
                    refreshFilterMenus();
                }
                return;
            }
        }
    } catch {
    }

    // Fallback
    while (!allMediaItems.find(media => getAssetShareId(media) === assetId) && hasMoreServerData) {
        await fetchNextPage({ forceLegacyFullFetch: false });
        refreshFilterMenus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    initScrollHideNav();
});

function initScrollHideNav() {
    const nav = document.querySelector('.glass-nav');
    if (!nav) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            // Only hide on mobile
            if (window.innerWidth > 768) {
                nav.classList.remove('nav-hidden');
                lastScrollY = window.scrollY;
                ticking = false;
                return;
            }

            const currentScrollY = window.scrollY;
            const scrolledDown = currentScrollY > lastScrollY;
            const pastThreshold = currentScrollY > 80;

            if (scrolledDown && pastThreshold) {
                nav.classList.add('nav-hidden');
            } else {
                nav.classList.remove('nav-hidden');
            }

            lastScrollY = currentScrollY;
            ticking = false;
        });
    }, { passive: true });
}

if (shareAssetLinkButton) {
    shareAssetLinkButton.addEventListener('click', async () => {
        if (!currentLightboxItem) {
            return;
        }

        const shareUrl = buildAssetOnlyShareUrl(currentLightboxItem, true).toString();
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