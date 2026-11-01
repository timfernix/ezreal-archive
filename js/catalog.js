import { PAGE_SIZE } from './config.js';
import { autoLoadSentinel, container, loadMoreButton, noResultsIndicator, paginationControls, paginationStatus, searchInput } from './dom.js';
import { getFavoriteKey, readFavoriteKeys } from './favorites.js';
import { renderGallery } from './gallery.js';
import { compareSkinReleaseDates, deriveSkinlineFromName, normalizeValue, resolveSkinReleaseDate } from './items.js';
import { state } from './state.js';
import { updateArchiveMeta } from './ui.js';
import { syncUrlWithState } from './urlstate.js';

let hasMoreServerData = true;

// Renders whatever is currently in state.allMediaItems (already filtered/sorted server-side).
export function applyFilters(options = {}) {
    const { syncUrl = true, deferRender = false, append = false } = options;
    const searchTerm = searchInput.value.trim().toLowerCase();
    const favoriteKeySet = new Set(readFavoriteKeys());
    const matchingItems = state.allMediaItems
        .filter(item => {
            if (searchTerm && !item.searchString.includes(searchTerm)) {
                return false;
            }

            return (
                (!state.showFavoritesOnly || favoriteKeySet.has(getFavoriteKey(item))) &&
                (state.activeFilters.skinlines.length === 0 || state.activeFilters.skinlines.includes(item.skinline)) &&
                (state.activeFilters.categories.length === 0 || state.activeFilters.categories.includes(item.category)) &&
                (state.activeFilters.games.length === 0 || state.activeFilters.games.includes(item.game)) &&
                (state.activeFilters.tags.length === 0 || item.tags.some(tag => state.activeFilters.tags.includes(tag)))
            );
        })
        .sort((left, right) => {
            switch (state.currentSort) {
                case 'oldest':
                    return compareSkinReleaseDates(left.skinReleaseDate, right.skinReleaseDate) || Number(left.releaseYear) - Number(right.releaseYear) || String(left.databaseId).localeCompare(String(right.databaseId), undefined, {numeric: true}) || left.skinName.localeCompare(right.skinName) || left.title.localeCompare(right.title);
                case 'skinline-asc':
                    return left.skinline.localeCompare(right.skinline) || left.title.localeCompare(right.title);
                case 'none':
                    return 0;
                case 'newest-skin':
                    return compareSkinReleaseDates(left.skinReleaseDate, right.skinReleaseDate, true) || Number(right.releaseYear) - Number(left.releaseYear) || String(right.databaseId).localeCompare(String(left.databaseId), undefined, {numeric: true}) || left.skinName.localeCompare(right.skinName) || left.title.localeCompare(right.title);
                case 'newest':
                default:
                    return String(right.databaseId).localeCompare(String(left.databaseId), undefined, {numeric: true}) || left.skinName.localeCompare(right.skinName) || left.title.localeCompare(right.title);
            }
        });
    state.currentFilteredItems = matchingItems;

    state.totalAvailableItems = matchingItems.length;
    const displayedItems = matchingItems.slice(0, state.serverOffset);
    hasMoreServerData = displayedItems.length < matchingItems.length;

    if (deferRender) {
        container.innerHTML = '';
        noResultsIndicator.classList.add('hidden');
    } else {
        renderGallery(displayedItems, { append });
    }

    updateArchiveMeta(displayedItems);
    updatePaginationControls();

    if (syncUrl) {
        syncUrlWithState();
    }
}

// Resets pagination and re-fetches page 1 from the server using the current search/sort/filter state.
export async function reloadFromServer(options = {}) {
    const { syncUrl = true } = options;

    state.serverOffset = PAGE_SIZE;

    applyFilters({ syncUrl });
}

export function updatePaginationControls() {
    if (!paginationControls) {
        return;
    }

    const loadedCount = state.allMediaItems.length;
    const hasAnyData = loadedCount > 0 || hasMoreServerData;

    if (!hasAnyData) {
        paginationControls.classList.add('hidden');
        return;
    }

    paginationControls.classList.remove('hidden');

    if (loadMoreButton) {
        loadMoreButton.disabled = state.isFetchingPage || !hasMoreServerData;
        loadMoreButton.textContent = state.isFetchingPage ? 'Loading...' : `Load ${PAGE_SIZE} more`;
        loadMoreButton.classList.toggle('hidden', !hasMoreServerData);
    }

    if (paginationStatus) {
        paginationStatus.textContent = '';
    }
}

export function mapFlatItemToMediaItem(item) {
    const safeTags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    const skinName = normalizeValue(item.skinName) || 'Unknown Skin';
    const skinline = normalizeValue(item.skinline) || deriveSkinlineFromName(skinName);
    const title = normalizeValue(item.title) || normalizeValue(item.url) || skinName;
    const description = normalizeValue(item.description) || '';
    const source = normalizeValue(item.source) || 'asset';
    const platform = normalizeValue(item.platform) || '';
    const releaseYear = normalizeValue(item.releaseYear) || 'Unknown';
    const skinReleaseDate = resolveSkinReleaseDate(item);

    return {
        id: normalizeValue(item.id) || '',
        databaseId: item.databaseId ?? '',
        title,
        skinName,
        description,
        type: normalizeValue(item.type) || 'image',
        url: normalizeValue(item.url) || '',
        thumbUrl: normalizeValue(item.thumbUrl) || '',
        previewUrl: normalizeValue(item.previewUrl) || '',
        uploadedAt: normalizeValue(item.uploadedAt) || '',
        category: normalizeValue(item.category) || 'Uncategorized',
        game: normalizeValue(item.game) || 'Generic',
        source,
        platform,
        skinline,
        releaseYear,
        skinReleaseDate,
        tags: safeTags,
        searchString: `${title} ${skinName} ${skinline} ${description} ${item.category || ''} ${item.game || ''} ${source} ${platform} ${releaseYear} ${skinReleaseDate} ${safeTags.join(' ')}`.toLowerCase()
    };
}

export async function loadNextPage() {
    if (state.isFetchingPage || !hasMoreServerData) {
        return;
    }

    state.serverOffset += PAGE_SIZE;
    applyFilters({ append: true });
}

export function setupAutoLoadObserver() {
    if (!autoLoadSentinel || !('IntersectionObserver' in window)) {
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting || state.isFetchingPage || !hasMoreServerData) {
                return;
            }

            loadNextPage();
        });
    }, { rootMargin: '400px 0px' });

    observer.observe(autoLoadSentinel);
}
