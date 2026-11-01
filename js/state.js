export const state = {
    allMediaItems: [],
    activeFilters: { skinlines: [], categories: [], games: [], tags: [] },
    currentSort: 'newest',
    currentLightboxItem: null,
    currentFilteredItems: [],
    serverOffset: 0,
    isFetchingPage: false,
    totalAvailableItems: null,
    catalogVersion: null,
    catalogGeneratedAt: null,
    deferInitialGalleryRender: false,
    allAvailableFilterOptions: { skinlines: [], categories: [], games: [], tags: [] },
    showFavoritesOnly: false
};
