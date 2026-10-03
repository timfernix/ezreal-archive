import { el, formatDate, isSafeImageUrl, openViewer, prefersReducedMotion } from './timeline-common.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const NODE_SIZE = 44;
const MIN_NODE_GAP = 54;
const MAIN_PAD = 56;
const MIN_PPY = 40;
const MAX_PPY = 360;
const mobileQuery = window.matchMedia('(max-width: 768px)');

export function createOverviewView(root, model, options = {}) {
    const { initialLines = null, focusId = null, onLinesChange = () => {} } = options;

    const knownLines = new Set(model.lines.map(line => line.id));
    const active = new Set((initialLines || []).filter(id => knownLines.has(id)));
    if (active.size === 0) {
        const defaultLine = model.lines.find(line => line.id === 'base') || model.lines[0];
        if (defaultLine) active.add(defaultLine.id);
    }

    let vertical = mobileQuery.matches;
    let ppy = vertical ? 90 : 120;
    let selected = null;
    let frontLayer = 0;
    let pendingLaneId = null;

    root.replaceChildren();

    const controls = el('div', 'ov-controls');
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'ov-search';
    search.placeholder = 'Find skinline or skin...';
    search.setAttribute('aria-label', 'Find skinline or skin');
    const status = el('span', 'ov-status');
    const matchButton = toolButton('Show only matches');
    matchButton.classList.add('hidden');
    const chipBar = el('div', 'ov-chips');
    const tools = el('div', 'ov-tools');
    const allButton = toolButton('All lines');
    const noneButton = toolButton('None');
    const zoomOut = toolButton('\u2212');
    const zoomIn = toolButton('+');
    zoomOut.setAttribute('aria-label', 'Zoom out');
    zoomIn.setAttribute('aria-label', 'Zoom in');
    tools.append(allButton, noneButton, zoomOut, zoomIn);
    const filterRow = el('div', 'ov-filter-row');
    filterRow.append(search, matchButton, status);
    const topRow = el('div', 'ov-top-row');
    topRow.append(filterRow, tools);
    controls.append(topRow, chipBar);

    const scroller = el('div', 'ov-scroller');
    const canvas = el('div', 'ov-canvas');
    scroller.appendChild(canvas);

    const detail = createDetail();
    root.append(controls, scroller, detail.root);

    function toolButton(text) {
        const button = el('button', 'ov-tool-btn', text);
        button.type = 'button';
        return button;
    }

    function matchingLines() {
        const query = search.value.trim().toLowerCase();
        if (!query) {
            return model.lines;
        }

        return model.lines.filter(line => line.name.toLowerCase().includes(query)
            || line.skins.some(skin => skin.name.toLowerCase().includes(query)));
    }

    function renderChips() {
        chipBar.replaceChildren();
        const matches = new Set(matchingLines().map(line => line.id));
        model.lines.forEach(line => {
            const chip = el('button', 'ov-chip', line.name);
            chip.type = 'button';
            chip.style.setProperty('--line-color', line.color);
            chip.setAttribute('aria-pressed', String(active.has(line.id)));
            chip.title = `${line.skins.length} skin${line.skins.length === 1 ? '' : 's'} \u00b7 Shift+click to show only this line`;
            chip.hidden = !matches.has(line.id);
            chip.addEventListener('click', event => event.shiftKey ? soloLine(line.id) : toggleLine(line.id));
            chipBar.appendChild(chip);
        });

        status.textContent = `${active.size} of ${model.lines.length} lines shown`;
        matchButton.classList.toggle('hidden', !search.value.trim());
    }

    function soloLine(id) {
        active.clear();
        active.add(id);
        renderChips();
        notifyLines();
        render();
    }
    function notifyLines() {
        onLinesChange(active.size === knownLines.size ? null : [...active]);
    }

    function toggleLine(id) {
        if (active.has(id)) {
            active.delete(id);
            const laneElement = canvas.querySelector(`[data-line="${id}"]`);
            if (laneElement && !prefersReducedMotion) {
                laneElement.classList.add('is-leaving');
                renderChips();
                notifyLines();
                setTimeout(render, 220);
                return;
            }
        } else {
            active.add(id);
            pendingLaneId = id;
        }

        renderChips();
        notifyLines();
        render();
    }

    function setAllLines(enabled) {
        active.clear();
        if (enabled) {
            knownLines.forEach(id => active.add(id));
        }
        renderChips();
        notifyLines();
        render();
    }

    function mainScroll() {
        return vertical ? scroller.scrollTop : scroller.scrollLeft;
    }

    function setZoom(next) {
        const clamped = Math.min(MAX_PPY, Math.max(MIN_PPY, next));
        if (clamped === ppy) {
            return;
        }

        const viewport = vertical ? scroller.clientHeight : scroller.clientWidth;
        const centerYears = (mainScroll() + viewport / 2 - MAIN_PAD) / ppy;
        ppy = clamped;
        render();
        const target = centerYears * ppy + MAIN_PAD - viewport / 2;
        scroller.scrollTo(vertical ? { top: target } : { left: target });
    }

    function svgPath(d, className, index, skinId) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('pathLength', '1');
        path.setAttribute('class', className);
        path.dataset.skin = skinId;
        path.style.setProperty('--i', String(index));
        return path;
    }

    function render() {
        vertical = mobileQuery.matches;
        const scrollLeft = scroller.scrollLeft;
        const scrollTop = scroller.scrollTop;

        canvas.replaceChildren();
        canvas.classList.toggle('is-vertical', vertical);
        canvas.classList.remove('is-drawn');

        const lines = model.lines.filter(line => active.has(line.id));
        const t0 = Math.floor(model.minT);
        const t1 = Math.ceil(model.maxT) + 1;
        const axisCross = vertical ? 56 : 28;
        const headSize = vertical ? 0 : 32;
        const labelMain = vertical ? 44 : 150;

        let crossCursor = axisCross;
        let mainMax = MAIN_PAD + (t1 - t0) * ppy;
        const lanes = [];

        lines.forEach(line => {
            const showLabels = line.skins.length > 1;
            const rowSize = showLabels ? (vertical ? 150 : 128) : (vertical ? 84 : 78);
            const rowEnds = [];
            const items = [];

            [...line.skins].sort((left, right) => left.start - right.start || left.order - right.order).forEach(skin => {
                const positions = [];
                skin.events.forEach((ev, index) => {
                    let main = MAIN_PAD + (ev.t - t0) * ppy;
                    if (index > 0) {
                        main = Math.max(main, positions[index - 1] + MIN_NODE_GAP);
                    }
                    positions.push(main);
                });

                const startExtent = positions[0] - NODE_SIZE / 2 - 4;
                const endExtent = Math.max(positions[positions.length - 1] + NODE_SIZE / 2 + 4, positions[0] - NODE_SIZE / 2 + labelMain);

                let row = rowEnds.findIndex(end => end + 10 <= startExtent);
                if (row < 0) {
                    row = rowEnds.length;
                    rowEnds.push(0);
                }

                rowEnds[row] = endExtent;
                mainMax = Math.max(mainMax, endExtent + 40);
                items.push({ skin, positions, row });
            });

            const rows = Math.max(1, rowEnds.length);
            const size = headSize + rows * rowSize + (vertical ? 12 : 16);
            lanes.push({ line, items, size, cross: crossCursor, showLabels, rowSize });
            crossCursor += size + (vertical ? 8 : 10);
        });

        canvas.style.width = `${vertical ? crossCursor : mainMax}px`;
        canvas.style.height = `${vertical ? mainMax : crossCursor}px`;

        const place = (node, main, cross) => {
            node.style.left = `${vertical ? cross : main}px`;
            node.style.top = `${vertical ? main : cross}px`;
        };

        const step = ppy < 60 ? 5 : ppy < 90 ? 2 : 1;
        for (let year = t0; year <= t1; year += step) {
            const tick = el('div', 'ov-tick');
            tick.style[vertical ? 'top' : 'left'] = `${MAIN_PAD + (year - t0) * ppy}px`;
            tick.appendChild(el('span', 'ov-tick-label', String(year)));
            canvas.appendChild(tick);
        }

        if (lanes.length === 0) {
            canvas.style.width = '100%';
            canvas.style.height = '160px';
            canvas.appendChild(el('p', 'ov-empty', 'Select at least one skinline above to see it on the timeline.'));
        }

        lanes.forEach(({ line, items, size, cross, showLabels, rowSize }) => {
            const lane = el('section', 'ov-lane');
            lane.dataset.line = line.id;
            lane.style.setProperty('--line-color', line.color);
            if (vertical) {
                lane.style.cssText += `left:${cross}px;top:0;width:${size}px;height:${mainMax}px;`;
            } else {
                lane.style.cssText += `left:0;top:${cross}px;width:${mainMax}px;height:${size}px;`;
            }

            if (pendingLaneId === line.id) {
                lane.classList.add('is-entering');
            }

            const head = el('header', 'ov-lane-head');
            head.append(el('span', 'ov-lane-dot'), line.name);
            lane.appendChild(head);

            const svg = document.createElementNS(SVG_NS, 'svg');
            svg.setAttribute('class', 'ov-links');
            svg.setAttribute('width', String(vertical ? size : mainMax));
            svg.setAttribute('height', String(vertical ? mainMax : size));
            lane.appendChild(svg);

            items.forEach(({ skin, positions, row }) => {
                const base = headSize + row * rowSize;
                const nodeCross = base + (showLabels ? (vertical ? 38 : 76) : (vertical ? 36 : 44));
                const crosses = positions.map((_, index) => positions.length > 1 ? nodeCross + (index % 2 === 0 ? -10 : 10) : nodeCross);

                const span = el('span', 'ov-span');
                span.style.setProperty('--skin-color', skin.color);
                const length = positions[positions.length - 1] - positions[0];
                place(span, positions[0], nodeCross);
                span.style.width = vertical ? '4px' : `${length}px`;
                span.style.height = vertical ? `${length}px` : '4px';
                lane.appendChild(span);

                if (showLabels) {
                const label = el('button', 'ov-skin-label');
                label.type = 'button';
                label.style.setProperty('--skin-color', skin.color);
                label.dataset.skin = skin.id;
                label.append(el('span', 'ov-skin-name', skin.name));
                place(label, vertical ? positions[0] - 14 : positions[0] - NODE_SIZE / 2, vertical ? nodeCross + 34 : base + 4);
                label.addEventListener('click', () => select(skin, skin.coverIndex));
                lane.appendChild(label);
                }

                for (let index = 0; index < positions.length - 1; index += 1) {
                    const [x1, y1] = vertical ? [crosses[index], positions[index]] : [positions[index], crosses[index]];
                    const [x2, y2] = vertical ? [crosses[index + 1], positions[index + 1]] : [positions[index + 1], crosses[index + 1]];
                    const d = vertical
                        ? `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`
                        : `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
                    const path = svgPath(d, 'ov-link', index, skin.id);
                    path.style.setProperty('--skin-color', skin.color);
                    svg.appendChild(path);
                }

                skin.events.forEach((ev, index) => {
                    const node = el('button', `ov-node`);
                    node.type = 'button';
                    node.style.setProperty('--skin-color', skin.color);
                    node.dataset.skin = skin.id;
                    node.dataset.index = String(index);
                    node.title = `${skin.name}: ${ev.label}${ev.date ? ` (${ev.date})` : ''}`;
                    node.setAttribute('aria-label', node.title);

                    if (isSafeImageUrl(ev.image)) {
                        const image = document.createElement('img');
                        image.src = ev.image;
                        image.alt = '';
                        image.loading = 'lazy';
                        image.decoding = 'async';
                        node.appendChild(image);
                    } else {
                        node.textContent = String(index + 1);
                    }

                    if (ev.caption) {
                        const note = el('span', 'ov-node-caption', ev.caption);
                        note.style.setProperty('--skin-color', skin.color);
                        const nodeX = vertical ? crosses[index] : positions[index];
                        const nodeY = vertical ? positions[index] : crosses[index];
                        note.style.left = `${nodeX + NODE_SIZE / 2 - 10}px`;
                        note.style.top = `${nodeY - NODE_SIZE / 2 - 2}px`;
                        lane.appendChild(note);
                    }

                    place(node, positions[index], crosses[index]);
                    node.addEventListener('click', () => select(skin, index));
                    lane.appendChild(node);
                });
            });

            canvas.appendChild(lane);
        });

        pendingLaneId = null;
        scroller.scrollLeft = scrollLeft;
        scroller.scrollTop = scrollTop;
        applySelectionClasses();

        requestAnimationFrame(() => requestAnimationFrame(() => canvas.classList.add('is-drawn')));
    }

    function applySelectionClasses() {
        canvas.querySelectorAll('.is-selected').forEach(node => node.classList.remove('is-selected'));
        if (!selected) {
            return;
        }

        canvas.querySelectorAll(`[data-skin="${CSS.escape(selected.skin.id)}"]`).forEach(node => {
            if (node.classList.contains('ov-node')) {
                node.classList.toggle('is-selected', Number(node.dataset.index) === selected.index);
            } else {
                node.classList.add('is-selected');
            }
        });
    }

    function select(skin, index, scroll = true) {
        selected = { skin, index };
        if (!active.has(skin.lineId)) {
            active.add(skin.lineId);
            renderChips();
            notifyLines();
            render();
        }

        applySelectionClasses();
        detail.show(skin, index);

        if (scroll) {
            const node = canvas.querySelector(`.ov-node[data-skin="${CSS.escape(skin.id)}"][data-index="${index}"]`);
            node?.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                inline: vertical ? 'nearest' : 'center',
                block: vertical ? 'center' : 'nearest'
            });
        }
    }

    function step(delta) {
        if (!selected) {
            return;
        }

        const next = selected.index + delta;
        if (next >= 0 && next < selected.skin.events.length) {
            select(selected.skin, next);
        }
    }

    function clearSelection() {
        selected = null;
        applySelectionClasses();
        detail.hide();
    }

    function createDetail() {
        const aside = el('aside', 'ov-detail is-empty');
        aside.setAttribute('aria-live', 'polite');
        aside.appendChild(el('p', 'ov-detail-hint', 'Select a stage on the timeline to see its details. Use the arrow keys to move between stages of a skin.'));

        const content = el('div', 'ov-detail-content');
        const close = el('button', 'ov-detail-close', '\u00d7');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close details');
        close.addEventListener('click', clearSelection);

        const media = el('button', 'ov-detail-media');
        media.type = 'button';
        const layers = [document.createElement('img'), document.createElement('img')];
        layers.forEach(layer => {
            layer.alt = '';
            layer.decoding = 'async';
            media.appendChild(layer);
        });
        media.appendChild(el('span', 'ov-detail-empty', 'No image yet'));

        const text = el('div', 'ov-detail-text');
        const skinLine = el('div', 'ov-detail-skin');
        const label = el('h3', 'ov-detail-label');
        const date = el('div', 'timeline-date');
        const caption = el('p', 'timeline-description');
        const steps = el('div', 'ov-steps');
        const nav = el('div', 'ov-detail-nav');
        const prev = toolButton('\u2039 Previous');
        const counter = el('span', 'ov-counter');
        const next = toolButton('Next \u203a');
        prev.addEventListener('click', () => step(-1));
        next.addEventListener('click', () => step(1));
        nav.append(prev, counter, next);
        text.append(skinLine, label, date, caption, steps, nav);

        content.append(close, media, text);
        aside.appendChild(content);

        let currentSrc = '';
        media.addEventListener('click', () => {
            if (currentSrc) {
                openViewer(currentSrc, label.textContent);
            }
        });

        function showImage(src, alt) {
            if (!isSafeImageUrl(src)) {
                currentSrc = '';
                media.classList.add('is-empty');
                layers.forEach(layer => layer.classList.remove('is-front'));
                return;
            }

            currentSrc = src;
            media.classList.remove('is-empty');
            const incoming = layers[1 - frontLayer];
            const outgoing = layers[frontLayer];
            incoming.onload = () => {
                if (currentSrc !== src) {
                    return;
                }
                incoming.classList.add('is-front');
                outgoing.classList.remove('is-front');
                frontLayer = 1 - frontLayer;
            };
            incoming.alt = alt;
            incoming.src = src;
        }

        return {
            root: aside,
            show(skin, index) {
                const ev = skin.events[index];
                aside.classList.remove('is-empty');
                aside.style.setProperty('--skin-color', skin.color);
                skinLine.replaceChildren(el('span', 'ov-lane-dot'), `${skin.name}`);
                label.textContent = ev.label;
                date.textContent = formatDate(ev.date) || 'Date unknown';
                caption.textContent = ev.caption;
                caption.classList.toggle('hidden', !ev.caption);
                counter.textContent = `${index + 1} / ${skin.events.length}`;
                prev.disabled = index === 0;
                next.disabled = index === skin.events.length - 1;

                steps.replaceChildren();
                skin.events.forEach((stage, stageIndex) => {
                    const dot = el('button', `ov-step${stageIndex === index ? ' is-current' : ''}`);
                    dot.type = 'button';
                    dot.title = stage.label;
                    dot.setAttribute('aria-label', stage.label);
                    dot.addEventListener('click', () => select(skin, stageIndex));
                    steps.appendChild(dot);
                });

                showImage(ev.image, `${skin.name} - ${ev.label}`);
            },
            hide() {
                aside.classList.add('is-empty');
            }
        };
    }

    function onKeydown(event) {
        if (!selected || event.defaultPrevented || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) {
            return;
        }

        if (event.key === 'ArrowLeft') {
            step(-1);
        } else if (event.key === 'ArrowRight') {
            step(1);
        } else if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
            clearSelection();
        }
    }

    function onOrientationChange() {
        ppy = mobileQuery.matches ? 90 : 120;
        render();
    }

    search.addEventListener('input', renderChips);
    matchButton.addEventListener('click', () => {
        active.clear();
        matchingLines().forEach(line => active.add(line.id));
        renderChips();
        notifyLines();
        render();
    });
    allButton.addEventListener('click', () => setAllLines(true));
    noneButton.addEventListener('click', () => setAllLines(false));
    zoomIn.addEventListener('click', () => setZoom(ppy * 1.35));
    zoomOut.addEventListener('click', () => setZoom(ppy / 1.35));
    document.addEventListener('keydown', onKeydown);
    mobileQuery.addEventListener('change', onOrientationChange);

    renderChips();
    render();

    if (focusId) {
        const skin = model.skins.find(candidate => candidate.id === focusId);
        if (skin) {
            select(skin, skin.coverIndex);
        }
    }

    return {
        destroy() {
            document.removeEventListener('keydown', onKeydown);
            mobileQuery.removeEventListener('change', onOrientationChange);
            root.replaceChildren();
        }
    };
}
