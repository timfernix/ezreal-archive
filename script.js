const CATALOG_MANIFEST_URL = ['127.0.0.1', 'localhost'].includes(window.location.hostname)
    ? '/catalog/catalog-manifest.json'
    : 'https://assets.timfernix.dev/catalog/catalog-manifest.json';
const ASSETS_BASE_URL = 'https://assets.timfernix.dev/';
const SHARE_BASE_URL = 'https://ezreal.timfernix.dev/';
const PAGE_SIZE = 50;
const EAGER_LOAD_COUNT = 15;
const PREVIEW_MARGIN = '500px 0px';
const SEARCH_DEBOUNCE_MS = 350;
let allMediaItems = [];
let activeFilters = { skinlines: [], categories: [], games: [], tags: [] };
let currentSort = 'newest';
let currentLightboxItem = null;
let serverOffset = 0;
let hasMoreServerData = true;
let isFetchingPage = false;
let totalAvailableItems = null;
let catalogVersion = null;
let catalogGeneratedAt = null;
let deferInitialGalleryRender = false;
let allAvailableFilterOptions = { skinlines: [], categories: [], games: [], tags: [] };
let searchDebounceTimer = null;

// Icons
const SKINLINE_ICON_URLS = {
    'Ace of Spades': 'https://assets.timfernix.dev/icons/Ezreal_8.ico',
    'Arcade': 'https://assets.timfernix.dev/icons/Ezreal_9.ico',
    'Base': 'https://assets.timfernix.dev/icons/Ezreal_0.ico',
    'Battle Academia': 'https://assets.timfernix.dev/icons/Ezreal_21.ico',
    'Crystal Rose': 'https://assets.timfernix.dev/icons/Ezreal_91.ico',
    'Debonair': 'https://assets.timfernix.dev/icons/Ezreal_7.ico',
    'Dream Of The Red Chamber': 'https://assets.timfernix.dev/icons/Dream_of_the_red_chamber.jpg',
    'Explorer': 'https://assets.timfernix.dev/icons/Ezreal_4.ico',
    'Faerie Court': 'https://assets.timfernix.dev/icons/Ezreal_33.ico',
    'Frosted': 'https://assets.timfernix.dev/icons/Ezreal_3.ico',
    'HEARTSTEEL': 'https://assets.timfernix.dev/icons/Ezreal_43.ico',
    'Heavenscale': 'https://assets.timfernix.dev/icons/Ezreal_44.ico',
    'Hidden Dragon': 'https://assets.timfernix.dev/icons/Hidden_Dragon_Chibi.jpeg',
    'Ink Keeper': 'https://assets.timfernix.dev/icons/Ink_Keeper_Chibi.jpeg',
    'Jarro Lightfeather': 'https://assets.timfernix.dev/icons/Ezreal_99.ico',
    'Love Confession': 'https://assets.timfernix.dev/icons/Love-Confession.ico',
    'Lovestruck': 'https://assets.timfernix.dev/icons/Ezreal_90.ico',
    'Masque of the Black Rose': 'https://assets.timfernix.dev/icons/Ezreal_100.ico',
    'Nottingham': 'https://assets.timfernix.dev/icons/Ezreal_1.ico',
    'Other': 'https://assets.timfernix.dev/icons/model.png',
    'Pajama Guardian': 'https://assets.timfernix.dev/icons/Ezreal_20.ico',
    'Porcelain Protector': 'https://assets.timfernix.dev/icons/Ezreal_25.ico',
    'Prestige Heavenscale': 'https://assets.timfernix.dev/icons/Prestige_Heavenscale_Icon.jpg',
    'Prestige Love Confession': 'https://assets.timfernix.dev/icons/Love_Confession_Prestige.jpg',
    'Prestige Porcelain Protector': 'https://assets.timfernix.dev/icons/Prestige_Porcelain_Protector_Chibi.jpg',
    'Prestige PsyOps': 'https://assets.timfernix.dev/icons/Prestige_PsyOps_Icon.jpg',
    'Prestige Select Weather Entity': 'https://assets.timfernix.dev/icons/Prestige_Select_Weather_Entity.png',
    'Psyops': 'https://assets.timfernix.dev/icons/Ezreal_22.ico',
    'Pulsefire': 'https://assets.timfernix.dev/icons/Ezreal_5.ico',
    'SSG': 'https://assets.timfernix.dev/icons/Ezreal_19.ico',
    'Star Guardian': 'https://assets.timfernix.dev/icons/Ezreal_18.ico',
    'Striker': 'https://assets.timfernix.dev/icons/Ezreal_2.ico',
    'TPA': 'https://assets.timfernix.dev/icons/Ezreal_6.ico',
    'Weather Entity': 'https://assets.timfernix.dev/icons/Weather-Entity.ico'
};
const GAME_LOGO_URLS = {
    'Golden Spatula': 'https://assets.timfernix.dev/icons/golden_spatula.webp',
    'League of Legends': 'https://assets.timfernix.dev/icons/lol.png',
    'Legends of Runeterra': 'https://assets.timfernix.dev/icons/lor.png',
    'Project F': 'https://assets.timfernix.dev/icons/riot.webp',
    'Riftbound': 'https://assets.timfernix.dev/icons/riftbound.png',
    'Teamfight Tactics': 'https://assets.timfernix.dev/icons/tft.webp',
    'Valorant' : 'https://assets.timfernix.dev/icons/valorant.svg',
    'Wild Rift': 'https://assets.timfernix.dev/icons/wild_rift.svg'
};
const CATEGORY_ICON_URLS = {
    'Abilities': 'https://assets.timfernix.dev/icons/abilities.png',
    'Card': 'https://assets.timfernix.dev/icons/card.png',
    'Concept': 'https://assets.timfernix.dev/icons/concept.png',
    'Emote': 'https://assets.timfernix.dev/icons/emote.png',
    'External': 'https://assets.timfernix.dev/icons/external.png',
    'Face': 'https://assets.timfernix.dev/icons/face.png',
    'Icon': 'https://assets.timfernix.dev/icons/icon.png',
    'Loadingscreen': 'https://assets.timfernix.dev/icons/Loadingscreen.png',
    'Merch': 'https://assets.timfernix.dev/icons/merch.png',
    'Model': 'https://assets.timfernix.dev/icons/model.png',
    'Promoart': 'https://assets.timfernix.dev/icons/promoart.png',
    'Splashart': 'https://assets.timfernix.dev/icons/splashart.png',
    'Video': 'https://assets.timfernix.dev/icons/video.png'
};
const CATEGORY_DISPLAY_NAMES = {
    'Promoart': 'Promo/Artwork'
};

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
const mobileFilterToggle = document.getElementById('mobile-filter-toggle');

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

    const generatedAt = catalogGeneratedAt
        ? new Date(catalogGeneratedAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Unknown';
    const version = catalogVersion ? catalogVersion.slice(0, 12) : 'Unknown';
    const totalItems = totalAvailableItems ?? items.length;

    if (archiveMetaText) {
        archiveMetaText.textContent = `Catalog: ${version} | Generated: ${generatedAt} | Items: ${totalItems}`;
    } else {
        archiveMeta.textContent = `Catalog: ${version} | Generated: ${generatedAt} | Items: ${totalItems}`;
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
    const tags = params.getAll('tag');

    searchInput.value = searchFromUrl;

    if (sortFromUrl && ['newest', 'oldest', 'name-asc', 'skinline-asc', 'none'].includes(sortFromUrl)) {
        currentSort = sortFromUrl;
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = sortFromUrl;
        }
    }

    activeFilters.skinlines = skinlines.filter(value => allAvailableFilterOptions.skinlines.includes(value));
    activeFilters.categories = categories.filter(value => allAvailableFilterOptions.categories.includes(value));
    activeFilters.games = games.filter(value => allAvailableFilterOptions.games.includes(value));
    activeFilters.tags = tags.filter(value => allAvailableFilterOptions.tags.includes(value));
}

function syncCheckboxUIWithActiveFilters() {
    const groups = [
        { menuId: 'skinline-menu', key: 'skinlines' },
        { menuId: 'cat-menu', key: 'categories' },
        { menuId: 'game-menu', key: 'games' },
        { menuId: 'tag-menu', key: 'tags' }
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
    activeFilters = { skinlines: [], categories: [], games: [], tags: [] };
    searchInput.value = '';
    currentSort = 'newest';

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.value = currentSort;
    }

    syncCheckboxUIWithActiveFilters();
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
    reloadFromServer();
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
    activeFilters.tags.forEach(value => url.searchParams.append('tag', value));

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

    lightboxImg.classList.remove('hidden');
    lightboxImg.removeAttribute('src');
    lightboxImg.alt = 'Full view';
    lightboxImg.onload = null;
    lightboxImg.onerror = () => {
        lightboxImg.classList.add('hidden');
        const errorHint = document.createElement('div');
        errorHint.className = 'external-link-preview';
        errorHint.textContent = 'Preview could not be loaded';
        mediaContainer.appendChild(errorHint);
    };

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
        lightboxImg.classList.remove('hidden');
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
            <span class="detail-value">${CATEGORY_DISPLAY_NAMES[item.category] || item.category}</span>
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

        // Fetch the full static catalog once; all later gallery operations are local.
        await fetchFilterOptions();

        // Restore search/sort/filters from the URL before the first page fetch so it's queried server-side from the start.
        applyUrlStateToInputs();
        createCheckboxes('skinline-menu', allAvailableFilterOptions.skinlines, 'skinlines');
        createCheckboxes('cat-menu', allAvailableFilterOptions.categories, 'categories');
        createCheckboxes('game-menu', allAvailableFilterOptions.games, 'games');
        createCheckboxes('tag-menu', allAvailableFilterOptions.tags, 'tags');
        syncCheckboxUIWithActiveFilters();

        serverOffset = PAGE_SIZE;

        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => reloadFromServer(), SEARCH_DEBOUNCE_MS);
        });
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            currentSort = e.target.value;
            reloadFromServer();
        });
        document.querySelectorAll('.filter-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById(e.target.dataset.target).classList.toggle('show');
            });
        });

        if (mobileFilterToggle) {
            mobileFilterToggle.addEventListener('click', () => {
                const isExpanded = mobileFilterToggle.getAttribute('aria-expanded') === 'true';
                mobileFilterToggle.setAttribute('aria-expanded', String(!isExpanded));
                document.getElementById('filter-controls').classList.toggle('mobile-expanded', !isExpanded);
            });
        }

        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', clearAllFilters);
        }

        if (loadMoreButton) {
            loadMoreButton.addEventListener('click', () => loadNextPage());
        }

        setupAutoLoadObserver();

        if (initialAssetId) {
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

    const iconMap = filterType === 'skinlines' ? SKINLINE_ICON_URLS
        : filterType === 'games' ? GAME_LOGO_URLS
        : filterType === 'categories' ? CATEGORY_ICON_URLS
        : null;

    options.forEach(opt => {
        const label = document.createElement('label');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = opt;
        checkbox.checked = activeFilters[filterType].includes(opt);
        label.appendChild(checkbox);

        const iconUrl = iconMap ? iconMap[opt] : null;
        if (iconUrl) {
            const icon = document.createElement('img');
            icon.className = 'filter-option-icon';
            icon.src = iconUrl;
            icon.alt = '';
            icon.loading = 'lazy';
            label.appendChild(icon);
        }

        label.appendChild(document.createTextNode(CATEGORY_DISPLAY_NAMES[opt] || opt));

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!activeFilters[filterType].includes(opt)) {
                    activeFilters[filterType].push(opt);
                }
            } else {
                activeFilters[filterType] = activeFilters[filterType].filter(item => item !== opt);
            }
            reloadFromServer(); // Trigger filtering whenever a box is toggled
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
    activeFilters.tags = activeFilters.tags.filter(value => allAvailableFilterOptions.tags.includes(value));
}

async function fetchFilterOptions() {
    try {
        const manifestResponse = await fetch(CATALOG_MANIFEST_URL);
        if (!manifestResponse.ok) {
            throw new Error(`Manifest request failed: ${manifestResponse.status}`);
        }

        const manifest = await manifestResponse.json();
        const manifestUrl = new URL(CATALOG_MANIFEST_URL, window.location.origin);
        const catalogUrl = new URL(manifest.catalogUrl, manifestUrl).toString();
        const response = await fetch(catalogUrl);
        if (!response.ok) {
            throw new Error(`Catalog request failed: ${response.status}`);
        }

        const data = await response.json();
        const catalogItems = Array.isArray(data?.items) ? data.items.map(mapFlatItemToMediaItem).filter(item => item.url) : [];
        console.log('Catalog fetched:', { items: catalogItems.length, version: manifest.version });

        if (data?.filters?.skinlines && data.filters.categories && data.filters.games) {
            allMediaItems = catalogItems;
            catalogVersion = manifest.version || data.version || null;
            catalogGeneratedAt = manifest.generatedAt || null;
            allAvailableFilterOptions = {
                skinlines: Array.isArray(data.filters.skinlines) ? data.filters.skinlines : [],
                categories: Array.isArray(data.filters.categories) ? data.filters.categories : [],
                games: Array.isArray(data.filters.games) ? data.filters.games : [],
                tags: Array.isArray(data.filters.tags)
                    ? data.filters.tags
                    : [...new Set(catalogItems.flatMap(item => item.tags))].sort((left, right) => left.localeCompare(right))
            };
            console.log('Filter options set:', allAvailableFilterOptions);
        } else {
            throw new Error('Invalid catalog response structure');
        }
    } catch (err) {
        console.error('Failed to fetch catalog:', err);
        throw err;
    }
}

// Renders whatever is currently in allMediaItems (already filtered/sorted server-side).
function applyFilters(options = {}) {
    const { syncUrl = true, deferRender = false } = options;
    const searchTerm = searchInput.value.trim().toLowerCase();
    const matchingItems = allMediaItems
        .filter(item => {
            if (searchTerm && !item.searchString.includes(searchTerm)) {
                return false;
            }

            return (
                (activeFilters.skinlines.length === 0 || activeFilters.skinlines.includes(item.skinline)) &&
                (activeFilters.categories.length === 0 || activeFilters.categories.includes(item.category)) &&
                (activeFilters.games.length === 0 || activeFilters.games.includes(item.game)) &&
                (activeFilters.tags.length === 0 || item.tags.some(tag => activeFilters.tags.includes(tag)))
            );
        })
        .sort((left, right) => {
            switch (currentSort) {
                case 'oldest':
                    return Number(left.releaseYear) - Number(right.releaseYear) || left.skinName.localeCompare(right.skinName) || left.title.localeCompare(right.title);
                case 'name-asc':
                    return left.title.localeCompare(right.title);
                case 'skinline-asc':
                    return left.skinline.localeCompare(right.skinline) || left.title.localeCompare(right.title);
                case 'none':
                    return 0;
                case 'newest':
                default:
                    return Number(right.releaseYear) - Number(left.releaseYear) || left.skinName.localeCompare(right.skinName) || left.title.localeCompare(right.title);
            }
        });

    totalAvailableItems = matchingItems.length;
    const displayedItems = matchingItems.slice(0, serverOffset);
    hasMoreServerData = displayedItems.length < matchingItems.length;

    if (deferRender) {
        container.innerHTML = '';
        noResultsIndicator.classList.add('hidden');
    } else {
        renderGallery(displayedItems);
    }

    updateArchiveMeta(displayedItems);
    updatePaginationControls();

    if (syncUrl) {
        syncUrlWithState();
    }
}

// Resets pagination and re-fetches page 1 from the server using the current search/sort/filter state.
async function reloadFromServer(options = {}) {
    const { syncUrl = true } = options;

    serverOffset = PAGE_SIZE;

    applyFilters({ syncUrl });
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
        const categoryIconUrl = CATEGORY_ICON_URLS[item.category];
        if (categoryIconUrl) {
            categoryBadge.classList.add('badge-icon-only');
            const categoryIcon = document.createElement('img');
            categoryIcon.className = 'badge-icon';
            categoryIcon.src = categoryIconUrl;
            categoryIcon.alt = CATEGORY_DISPLAY_NAMES[item.category] || item.category;
            categoryIcon.title = CATEGORY_DISPLAY_NAMES[item.category] || item.category;
            categoryIcon.loading = 'lazy';
            categoryBadge.appendChild(categoryIcon);
        } else {
            categoryBadge.textContent = CATEGORY_DISPLAY_NAMES[item.category] || item.category;
        }

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

function updatePaginationControls() {
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

    if (loadMoreButton) {
        loadMoreButton.disabled = isFetchingPage || !hasMoreServerData;
        loadMoreButton.textContent = isFetchingPage ? 'Loading...' : `Load ${PAGE_SIZE} more`;
        loadMoreButton.classList.toggle('hidden', !hasMoreServerData);
    }

    if (paginationStatus) {
        paginationStatus.textContent = '';
    }
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

async function loadNextPage() {
    if (isFetchingPage || !hasMoreServerData) {
        return;
    }

    serverOffset += PAGE_SIZE;
    applyFilters();
}

function setupAutoLoadObserver() {
    if (!autoLoadSentinel || !('IntersectionObserver' in window)) {
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting || isFetchingPage || !hasMoreServerData) {
                return;
            }

            loadNextPage();
        });
    }, { rootMargin: '400px 0px' });

    observer.observe(autoLoadSentinel);
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