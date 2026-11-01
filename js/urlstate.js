import { reloadFromServer } from './catalog.js';
import { SHARE_BASE_URL } from './config.js';
import { searchInput } from './dom.js';
import { setFavoritesFilter } from './favorites.js';
import { state } from './state.js';
import { showToast } from './ui.js';

export function getAssetShareId(item) {
    return `${item.source || 'asset'}:${item.url}`;
}

export function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

export function applyUrlStateToInputs() {
    const params = getUrlParams();
    const searchFromUrl = params.get('q') || '';
    const sortFromUrl = params.get('sort');
    const skinlines = params.getAll('skinline');
    const categories = params.getAll('category');
    const games = params.getAll('game');
    const tags = params.getAll('tag');

    searchInput.value = searchFromUrl;

    if (sortFromUrl && ['newest', 'newest-skin', 'oldest', 'skinline-asc', 'none'].includes(sortFromUrl)) {
        state.currentSort = sortFromUrl;
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.value = sortFromUrl;
        }
    }

    state.activeFilters.skinlines = skinlines.filter(value => state.allAvailableFilterOptions.skinlines.includes(value));
    state.activeFilters.categories = categories.filter(value => state.allAvailableFilterOptions.categories.includes(value));
    state.activeFilters.games = games.filter(value => state.allAvailableFilterOptions.games.includes(value));
    state.activeFilters.tags = tags.filter(value => state.allAvailableFilterOptions.tags.includes(value));
}

export function syncCheckboxUIWithActiveFilters() {
    const groups = [
        { menuId: 'skinline-menu', key: 'skinlines' },
        { menuId: 'cat-menu', key: 'categories' },
        { menuId: 'game-menu', key: 'games' },
        { menuId: 'tag-menu', key: 'tags' }
    ];

    groups.forEach(group => {
        const menu = document.getElementById(group.menuId);
        const toggle = document.querySelector(`.filter-toggle[data-target="${group.menuId}"]`);

        if (toggle) {
            const hasActiveFilters = state.activeFilters[group.key].length > 0;
            toggle.classList.toggle('has-active', hasActiveFilters);
            toggle.setAttribute('aria-pressed', String(hasActiveFilters));
        }

        if (!menu) {
            return;
        }

        menu.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = state.activeFilters[group.key].includes(checkbox.value);
        });
    });
}

export function clearAllFilters() {
    state.activeFilters = { skinlines: [], categories: [], games: [], tags: [] };
    searchInput.value = '';
    state.currentSort = 'newest';
    setFavoritesFilter(false);

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.value = state.currentSort;
    }

    syncCheckboxUIWithActiveFilters();
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
    reloadFromServer();
    showToast('Filters cleared');
}

export function buildShareableUrl(item, useCustomBase = false) {
    const baseUrl = useCustomBase ? SHARE_BASE_URL : window.location.origin + window.location.pathname;
    const url = new URL(baseUrl);

    const searchTerm = searchInput.value.trim();
    if (searchTerm) {
        url.searchParams.set('q', searchTerm);
    }

    if (state.currentSort) {
        url.searchParams.set('sort', state.currentSort);
    }

    state.activeFilters.skinlines.forEach(value => url.searchParams.append('skinline', value));
    state.activeFilters.categories.forEach(value => url.searchParams.append('category', value));
    state.activeFilters.games.forEach(value => url.searchParams.append('game', value));
    state.activeFilters.tags.forEach(value => url.searchParams.append('tag', value));

    if (item) {
        url.searchParams.set('asset', getAssetShareId(item));
    }

    return url;
}

export function buildAssetOnlyShareUrl(item, useCustomBase = false) {
    const baseUrl = useCustomBase ? SHARE_BASE_URL : window.location.origin + window.location.pathname;
    const url = new URL(baseUrl);

    if (item) {
        url.searchParams.set('asset', getAssetShareId(item));
    }

    return url;
}

export function syncUrlWithState() {
    const nextUrl = buildShareableUrl(state.currentLightboxItem, false);
    const nextRelative = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    history.replaceState({}, '', nextRelative);
}
