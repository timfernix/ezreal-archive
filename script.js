import { applyFilters, loadNextPage, reloadFromServer, setupAutoLoadObserver } from './js/catalog.js';
import { PAGE_SIZE, SEARCH_DEBOUNCE_MS } from './js/config.js';
import { clearFiltersButton, favoritesFilterButton, favoritesNotice, favoritesNoticeClose, lightboxFavoriteButton, loadMoreButton, loadingIndicator, mobileFilterToggle, searchInput, shareSearchButton } from './js/dom.js';
import { FAVORITES_NOTICE_COOKIE, setFavoritesFilter, toggleFavorite, updateFavoriteButtons, writeCookie } from './js/favorites.js';
import { createCheckboxes, fetchFilterOptions, warnAboutMissingIcons } from './js/filters.js';
import { preloadUiIcons } from './js/icons.js';
import { openAssetFromUrlParam } from './js/lightbox.js';
import { readSavedScrollState, restoreScrollPosition } from './js/scroll.js';
import { state } from './js/state.js';
import { copyToClipboard, showToast } from './js/ui.js';
import { applyUrlStateToInputs, buildShareableUrl, clearAllFilters, getUrlParams, syncCheckboxUIWithActiveFilters } from './js/urlstate.js';

let searchDebounceTimer = null;

async function init() {
    preloadUiIcons();
    try {
        const initialAssetId = getUrlParams().get('asset');
        state.deferInitialGalleryRender = Boolean(initialAssetId);

        // Fetch the full static catalog once; all later gallery operations are local.
        await fetchFilterOptions();

        // Restore search/sort/filters from the URL before the first page fetch so it's queried server-side from the start.
        applyUrlStateToInputs();
        createCheckboxes('skinline-menu', state.allAvailableFilterOptions.skinlines, 'skinlines');
        createCheckboxes('cat-menu', state.allAvailableFilterOptions.categories, 'categories');
        createCheckboxes('game-menu', state.allAvailableFilterOptions.games, 'games');
        createCheckboxes('tag-menu', state.allAvailableFilterOptions.tags, 'tags');
        warnAboutMissingIcons();
        syncCheckboxUIWithActiveFilters();

        state.serverOffset = PAGE_SIZE;

        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => reloadFromServer(), SEARCH_DEBOUNCE_MS);
        });
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            state.currentSort = e.target.value;
            reloadFromServer();
        });
        document.querySelectorAll('.filter-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (btn === favoritesFilterButton) {
                    setFavoritesFilter(!state.showFavoritesOnly);
                    reloadFromServer({ syncUrl: false });
                    return;
                }
                document.getElementById(e.target.dataset.target).classList.toggle('show');
            });
        });

        if (shareSearchButton) {
            shareSearchButton.addEventListener('click', () => {
                copyToClipboard(buildShareableUrl(null, true).toString(), 'Search link copied');
            });
        }

        if (lightboxFavoriteButton) {
            lightboxFavoriteButton.addEventListener('click', () => {
                if (state.currentLightboxItem) {
                    toggleFavorite(state.currentLightboxItem);
                }
            });
        }

        if (favoritesNoticeClose) {
            favoritesNoticeClose.addEventListener('click', () => {
                writeCookie(FAVORITES_NOTICE_COOKIE, '1');
                favoritesNotice.classList.add('hidden');
            });
        }

        updateFavoriteButtons();

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
            if (!state.currentLightboxItem) {
                state.deferInitialGalleryRender = false;
                applyFilters({ syncUrl: false });
                showToast('Shared asset not found');
            } else {
                applyFilters({ syncUrl: false, deferRender: true });
            }
        } else {
            const savedScroll = readSavedScrollState();
            if (savedScroll) {
                state.serverOffset = Math.max(PAGE_SIZE, savedScroll.offset);
            }
            applyFilters({ syncUrl: false });
            if (savedScroll) {
                restoreScrollPosition(savedScroll.y);
            }
        }

        loadingIndicator.classList.add('hidden');
    } catch (error) {
        console.error('API Error:', error);
        loadingIndicator.textContent = 'Failed to load archive.';
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
