import { mapFlatItemToMediaItem, reloadFromServer } from './catalog.js';
import { CATALOG_MANIFEST_URL, IS_LOCAL_HOST } from './config.js';
import { CATEGORY_DISPLAY_NAMES, CATEGORY_ICON_URLS, GAME_LOGO_URLS, SKINLINE_ICON_URLS } from './icons.js';
import { state } from './state.js';
import { syncCheckboxUIWithActiveFilters } from './urlstate.js';

export function createCheckboxes(menuId, options, filterType) {
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
        checkbox.checked = state.activeFilters[filterType].includes(opt);
        label.appendChild(checkbox);

        const iconUrl = iconMap ? iconMap[opt] : null;
        if (iconUrl) {
            const icon = document.createElement('img');
            icon.className = 'filter-option-icon';
            icon.src = iconUrl;
            icon.alt = '';
            icon.fetchPriority = 'high';
            label.appendChild(icon);
        }

        label.appendChild(document.createTextNode(CATEGORY_DISPLAY_NAMES[opt] || opt));

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!state.activeFilters[filterType].includes(opt)) {
                    state.activeFilters[filterType].push(opt);
                }
            } else {
                state.activeFilters[filterType] = state.activeFilters[filterType].filter(item => item !== opt);
            }
            syncCheckboxUIWithActiveFilters();
            reloadFromServer(); // Trigger filtering whenever a box is toggled
        });
        menu.appendChild(label);
    });
}

export function refreshFilterMenus() {
    // Filter options are now fetched from the backend and stored globally
    // Just validate and sync the active filters
    state.activeFilters.skinlines = state.activeFilters.skinlines.filter(value => state.allAvailableFilterOptions.skinlines.includes(value));
    state.activeFilters.categories = state.activeFilters.categories.filter(value => state.allAvailableFilterOptions.categories.includes(value));
    state.activeFilters.games = state.activeFilters.games.filter(value => state.allAvailableFilterOptions.games.includes(value));
    state.activeFilters.tags = state.activeFilters.tags.filter(value => state.allAvailableFilterOptions.tags.includes(value));
}

export async function fetchFilterOptions() {
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
            state.allMediaItems = catalogItems;
            state.catalogVersion = manifest.version || data.version || null;
            state.catalogGeneratedAt = manifest.generatedAt || null;
            state.allAvailableFilterOptions = {
                skinlines: Array.isArray(data.filters.skinlines) ? data.filters.skinlines : [],
                categories: Array.isArray(data.filters.categories) ? data.filters.categories : [],
                games: Array.isArray(data.filters.games) ? data.filters.games : [],
                tags: Array.isArray(data.filters.tags)
                    ? data.filters.tags
                    : [...new Set(catalogItems.flatMap(item => item.tags))].sort((left, right) => left.localeCompare(right))
            };
            console.log('Filter options set:', state.allAvailableFilterOptions);
        } else {
            throw new Error('Invalid catalog response structure');
        }
    } catch (err) {
        console.error('Failed to fetch catalog:', err);
        throw err;
    }
}

// Local-only hint: filter values without an icon-map entry silently render without an icon (keys must match exactly).
export function warnAboutMissingIcons() {
    if (!IS_LOCAL_HOST) {
        return;
    }

    const checks = [
        ['skinlines', state.allAvailableFilterOptions.skinlines, SKINLINE_ICON_URLS],
        ['games', state.allAvailableFilterOptions.games, GAME_LOGO_URLS],
        ['categories', state.allAvailableFilterOptions.categories, CATEGORY_ICON_URLS]
    ];
    checks.forEach(([label, options, iconMap]) => {
        const missing = (options || []).filter(option => !iconMap[option] && option !== 'Generic');
        if (missing.length > 0) {
            console.warn(`Missing ${label} icons (${missing.length}):`, missing);
        }
    });
}
