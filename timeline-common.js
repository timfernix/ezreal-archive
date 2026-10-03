export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const LINE_PALETTE = ['#e1b85e', '#5fb4d6', '#d9728b', '#7fc38a', '#b190e0', '#e69a58', '#6fd0c4', '#c9d46a'];

export function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (text !== undefined) {
        node.textContent = text;
    }
    return node;
}

export function isSafeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) {
        return false;
    }

    try {
        const url = new URL(value, document.baseURI);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

function slugify(value) {
    return String(value || 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'other';
}

// Accepts YYYY, YYYY-MM and YYYY-MM-DD and returns a decimal year.
export function parseDate(value) {
    const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(value ?? '').trim());
    if (!match) {
        return null;
    }

    const month = match[2] ? Number(match[2]) - 1 : 0;
    const day = match[3] ? Number(match[3]) - 1 : 0;
    return Number(match[1]) + month / 12 + day / 365;
}

export function formatDate(value) {
    if (!value) {
        return '';
    }

    const parts = String(value).split('-');
    if (parts.length === 3) {
        const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    }

    if (parts.length === 2) {
        const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, 1));
        return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }

    return String(value);
}

export function yearOf(t) {
    return Math.floor(t + 1e-9);
}

export function buildModel(rawSkins) {
    const currentYear = new Date().getFullYear();

    const skins = rawSkins
        .filter(skin => skin && skin.id && skin.name)
        .map((raw, order) => {
            let stages = Array.isArray(raw.stages) ? raw.stages : [];
            if (stages.length === 0) {
                stages = [{ label: raw.name, date: raw.releaseDate, image: raw.image }];
            }

            const firstStageT = stages.map(stage => parseDate(stage.date)).find(value => value !== null);
            let previousT = parseDate(raw.releaseDate) ?? firstStageT ?? currentYear;

            const events = stages.map((stage, index) => {
                const t = parseDate(stage.date) ?? previousT;
                previousT = t;
                return {
                    label: stage.label || `Version ${index + 1}`,
                    date: stage.date || '',
                    t,
                    image: stage.image,
                    caption: stage.caption || '',
                    order: index
                };
            });
            events.sort((left, right) => left.t - right.t || left.order - right.order);
            events.forEach((event, index) => { event.index = index; });

            return {
                id: String(raw.id),
                name: String(raw.name),
                skinline: raw.skinline ? String(raw.skinline) : 'Other',
                lineId: slugify(raw.skinline),
                colorOverride: /^#[0-9a-f]{3,8}$/i.test(raw.color || '') ? raw.color : null,
                order,
                events,
                start: events[0].t,
                end: events[events.length - 1].t,
                coverIndex: events.reduce((best, event, index) => (isSafeImageUrl(event.image) ? index : best), events.length - 1)
            };
        });

    const lineMap = new Map();
    skins.forEach(skin => {
        if (!lineMap.has(skin.lineId)) {
            lineMap.set(skin.lineId, { id: skin.lineId, name: skin.skinline, skins: [], start: Infinity });
        }
        const line = lineMap.get(skin.lineId);
        line.skins.push(skin);
        line.start = Math.min(line.start, skin.start);
    });

    const lines = [...lineMap.values()].sort((left, right) => left.start - right.start || left.name.localeCompare(right.name));
    lines.forEach((line, index) => {
        line.color = LINE_PALETTE[index % LINE_PALETTE.length];
        line.skins.forEach(skin => {
            skin.line = line;
            skin.color = skin.colorOverride || line.color;
        });
    });

    const allTimes = skins.flatMap(skin => skin.events.map(event => event.t));
    return {
        skins,
        lines,
        minT: allTimes.length ? Math.min(...allTimes) : currentYear,
        maxT: allTimes.length ? Math.max(...allTimes) : currentYear
    };
}

export async function loadTimeline(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Timeline request failed: ${response.status}`);
    }

    const data = await response.json();
    return buildModel(Array.isArray(data?.skins) ? data.skins : []);
}

const viewer = document.getElementById('timeline-viewer');
const viewerImage = document.getElementById('timeline-viewer-img');
const viewerCaption = document.getElementById('timeline-viewer-caption');

if (viewer) {
    viewer.addEventListener('click', event => {
        if (event.target === viewer) {
            viewer.close();
        }
    });
}

export function openViewer(src, caption) {
    if (!viewer || !isSafeImageUrl(src)) {
        return;
    }

    viewerImage.src = src;
    viewerImage.alt = caption;
    viewerCaption.textContent = caption;
    viewer.showModal();
}

export function createImage(src, alt, className) {
    if (!isSafeImageUrl(src)) {
        return el('div', `${className} is-empty`, 'No image yet');
    }

    const wrapper = el('button', className);
    wrapper.type = 'button';
    wrapper.setAttribute('aria-label', `View ${alt}`);

    const image = document.createElement('img');
    image.src = src;
    image.alt = alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    wrapper.appendChild(image);
    wrapper.addEventListener('click', () => openViewer(src, alt));
    return wrapper;
}
