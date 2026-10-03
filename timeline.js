import { loadTimeline } from './timeline-common.js';
import { createOverviewView } from './timeline-overview.js';

const root = document.getElementById('view-root');
const stateMessage = document.getElementById('timeline-state');

const params = new URLSearchParams(location.search);
let lines = params.get('lines') ? params.get('lines').split(',').filter(Boolean) : null;

function syncUrl() {
    const query = lines && lines.length ? `?lines=${lines.join(',')}` : location.pathname;
    history.replaceState(null, '', `${query}${location.hash}`);
}

loadTimeline('timeline.json').then(model => {
    if (!model.skins.length) {
        stateMessage.textContent = 'The timeline has no entries yet.';
        return;
    }

    stateMessage.hidden = true;
    const focusId = decodeURIComponent(location.hash.slice(1));
    createOverviewView(root, model, {
        initialLines: lines,
        focusId: model.skins.some(skin => skin.id === focusId) ? focusId : null,
        onLinesChange: next => { lines = next; syncUrl(); }
    });
}).catch(error => {
    console.error(error);
    stateMessage.textContent = 'Could not load the timeline.';
});
