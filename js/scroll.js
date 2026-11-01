import { container, lightbox } from './dom.js';
import { state } from './state.js';

export const SCROLL_STATE_KEY = 'ezreal-scroll-state';

export function saveScrollState() {
    if (!container || container.children.length === 0 || !lightbox.classList.contains('hidden')) {
        return;
    }

    try {
        sessionStorage.setItem(SCROLL_STATE_KEY, JSON.stringify({
            search: window.location.search,
            y: Math.round(window.scrollY),
            offset: state.serverOffset
        }));
    } catch {
        // Storage can be unavailable (private mode); losing the position is harmless.
    }
}

// The default sort is added to the URL after load, so "" and "?sort=newest" describe the same view.
export function normalizeSearchForScroll(search) {
    const params = new URLSearchParams(search);
    if (params.get('sort') === 'newest') {
        params.delete('sort');
    }
    return params.toString();
}

// Only restore when the visitor is coming back (history navigation, reload, or from the timeline page) to the same search.
export function readSavedScrollState() {
    let saved;
    try {
        saved = JSON.parse(sessionStorage.getItem(SCROLL_STATE_KEY) || 'null');
    } catch {
        return null;
    }

    if (!saved || normalizeSearchForScroll(saved.search) !== normalizeSearchForScroll(window.location.search) || !(saved.y > 0)) {
        return null;
    }

    const navigationType = performance.getEntriesByType('navigation')[0]?.type;
    const cameFromTimeline = /\/timeline(\.html)?$/.test(document.referrer.split(/[?#]/)[0]);
    return navigationType === 'back_forward' || navigationType === 'reload' || cameFromTimeline ? saved : null;
}

export function restoreScrollPosition(y) {
    const apply = () => window.scrollTo(0, y);
    apply();
    requestAnimationFrame(() => {
        apply();
        setTimeout(apply, 150);
    });
}

if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

let scrollSaveTimer = null;

window.addEventListener('scroll', () => {
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(saveScrollState, 200);
}, { passive: true });

window.addEventListener('pagehide', saveScrollState);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        saveScrollState();
    }
});
