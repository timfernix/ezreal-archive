const HOSTNAME = globalThis.location?.hostname ?? '';
export const IS_LOCAL_HOST = HOSTNAME === 'localhost' || /^127\./.test(HOSTNAME);
export const CATALOG_MANIFEST_URL = IS_LOCAL_HOST
    ? '/catalog/catalog-manifest.json'
    : 'https://assets.timfernix.dev/catalog/catalog-manifest.json';
export const ASSETS_BASE_URL = 'https://assets.timfernix.dev/';
export const SHARE_BASE_URL = 'https://ezreal.timfernix.dev/';
export const PAGE_SIZE = 50;
export const EAGER_LOAD_COUNT = 15;
export const PREVIEW_MARGIN = '500px 0px';
export const SEARCH_DEBOUNCE_MS = 350;
