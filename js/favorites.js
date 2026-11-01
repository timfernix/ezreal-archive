import { applyFilters } from './catalog.js';
import { favoritesFilterButton, favoritesNotice, lightboxFavoriteButton } from './dom.js';
import { state } from './state.js';
import { showToast } from './ui.js';
import { getAssetShareId } from './urlstate.js';

export const FAVORITES_COOKIE = 'ezreal_favorites';

export const FAVORITES_NOTICE_COOKIE = 'ezreal_favorites_notice';

export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const FAVORITES_COOKIE_MAX_LENGTH = 3800;

export function readCookie(name) {
    const prefix = `${name}=`;
    const entry = document.cookie.split('; ').find(part => part.startsWith(prefix));
    return entry ? entry.slice(prefix.length) : '';
}

export function writeCookie(name, value) {
    document.cookie = `${name}=${value}; max-age=${COOKIE_MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
}

export function getFavoriteKey(item) {
    return item.databaseId !== '' && item.databaseId != null
        ? String(item.databaseId)
        : `a${getAssetShareId(item)}`;
}

export function readFavoriteKeys() {
    const raw = readCookie(FAVORITES_COOKIE);
    if (!raw) {
        return [];
    }

    try {
        return decodeURIComponent(raw).split(',').filter(Boolean);
    } catch {
        return [];
    }
}

export function isFavorite(item) {
    return readFavoriteKeys().includes(getFavoriteKey(item));
}

export function updateFavoriteButtons() {
    const keys = new Set(readFavoriteKeys());

    document.querySelectorAll('.card-favorite-btn').forEach(button => {
        const active = keys.has(button.dataset.favoriteKey);
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-label', active ? 'Remove from favorites' : 'Add to favorites');
    });

    if (lightboxFavoriteButton && state.currentLightboxItem) {
        const active = keys.has(getFavoriteKey(state.currentLightboxItem));
        lightboxFavoriteButton.classList.toggle('is-active', active);
        lightboxFavoriteButton.setAttribute('aria-pressed', String(active));
        lightboxFavoriteButton.textContent = active ? 'Remove from Favorites' : 'Add to Favorites';
    }

    if (favoritesFilterButton) {
        favoritesFilterButton.textContent = keys.size > 0 ? `Favorites (${keys.size})` : 'Favorites';
    }
}

export function toggleFavorite(item) {
    const key = getFavoriteKey(item);
    const keys = readFavoriteKeys();
    const index = keys.indexOf(key);

    if (index >= 0) {
        keys.splice(index, 1);
    } else {
        keys.push(key);
    }

    const value = encodeURIComponent(keys.join(','));
    if (value.length > FAVORITES_COOKIE_MAX_LENGTH) {
        showToast('Favorites limit reached');
        return;
    }

    writeCookie(FAVORITES_COOKIE, value);

    if (index < 0 && !readCookie(FAVORITES_NOTICE_COOKIE) && favoritesNotice) {
        favoritesNotice.classList.remove('hidden');
    }

    updateFavoriteButtons();

    if (state.showFavoritesOnly) {
        applyFilters({ syncUrl: false });
    }
}

export function setFavoritesFilter(enabled) {
    state.showFavoritesOnly = enabled;
    if (favoritesFilterButton) {
        favoritesFilterButton.classList.toggle('has-active', enabled);
        favoritesFilterButton.setAttribute('aria-pressed', String(enabled));
    }
}
