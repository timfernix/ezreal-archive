const API_URL = '/api/skins';
const ASSETS_BASE_URL = 'https://assets.timfernix.dev/';
let allMediaItems = [];
let activeFilters = { skinlines: [], categories: [], games: [] };
let currentSort = 'none';

const container = document.getElementById('gallery-container');
const searchInput = document.getElementById('searchInput');
const noResultsIndicator = document.getElementById('no-results');
const loadingIndicator = document.getElementById('loading');
const archiveMeta = document.getElementById('archive-meta');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const originalLink = document.getElementById('original-link');

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

function getSortableReleaseYear(value) {
    const numericYear = Number.parseInt(value, 10);
    return Number.isNaN(numericYear) ? Number.NEGATIVE_INFINITY : numericYear;
}

function getNewestItem(items) {
    if (!items.length) {
        return null;
    }

    return [...items].sort((a, b) => {
        const yearDifference = getSortableReleaseYear(b.releaseYear) - getSortableReleaseYear(a.releaseYear);

        if (yearDifference !== 0) {
            return yearDifference;
        }

        return a.title.localeCompare(b.title);
    })[0];
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

    const newest = getNewestItem(items);

    if (!newest) {
        archiveMeta.textContent = `Last synced: ${syncedAt} | Newest item: -`;
        return;
    }

    archiveMeta.textContent = `Last synced: ${syncedAt} | Newest archive item: ${newest.title} (${newest.releaseYear})`;
}

// Close Lightbox Events
document.querySelector('.close-btn').addEventListener('click', () => lightbox.classList.add('hidden'));
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.classList.add('hidden');
});

function openLightbox(item) {
    lightboxImg.src = `${ASSETS_BASE_URL}${item.url}`;
    originalLink.href = `${ASSETS_BASE_URL}${item.url}`;
    
    document.getElementById('lightbox-title').textContent = item.title;
    
    // Create details section
    const detailsDiv = document.getElementById('lightbox-details');
    detailsDiv.innerHTML = `
        <div class="detail-item">
            <span class="detail-label">Skin:</span>
            <span class="detail-value">${item.skinName}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Skinline:</span>
            <span class="detail-value">${item.skinline}</span>
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
            <span class="detail-label">Release Year:</span>
            <span class="detail-value">${item.releaseYear}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Type:</span>
            <span class="detail-value">${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</span>
        </div>
    `;
    
    const tagsDiv = document.getElementById('lightbox-tags');
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
}

async function init() {
    try {
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

                allMediaItems.push({
                    title,
                    skinName,
                    description: normalizeValue(skin.description) || '',
                    type: asset.type,
                    url: asset.url,
                    category: asset.category || 'Uncategorized',
                    game: asset.game || 'Generic',
                    skinline,
                    releaseYear,
                    tags: safeTags,
                    // Use safeTags here so .join() never crashes
                    searchString: `${title} ${skinName} ${skinline} ${normalizeValue(skin.description) || ''} ${asset.category || ''} ${asset.game || ''} ${releaseYear} ${safeTags.join(' ')}`.toLowerCase()
                });
            });
        });

        createCheckboxes('skinline-menu', [...new Set(allMediaItems.map(m => m.skinline))].sort(), 'skinlines');
        createCheckboxes('cat-menu', [...new Set(allMediaItems.map(m => m.category))].sort(), 'categories');
        createCheckboxes('game-menu', [...new Set(allMediaItems.map(m => m.game))].sort(), 'games');
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

        renderGallery(allMediaItems);
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

function applyFilters() {
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
        
        if (item.type === 'video') {
            const video = document.createElement('video');
            video.src = `${ASSETS_BASE_URL}${item.url}`;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            mediaWrapper.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = `${ASSETS_BASE_URL}${item.url}`;
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