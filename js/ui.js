import { archiveMeta, archiveMetaSpinner, archiveMetaText, changelogContent, changelogDetails, infoButton, infoModal, toastElement } from './dom.js';
import { state } from './state.js';

let toastTimeoutId = null;

let changelogRequest = null;

export function renderChangelog(markdown) {
    const fragment = document.createDocumentFragment();
    let list = null;
    let paragraph = [];

    const flushParagraph = () => {
        if (paragraph.length) {
            const element = document.createElement('p');
            element.textContent = paragraph.join(' ');
            fragment.append(element);
            paragraph = [];
        }
    };

    for (const rawLine of markdown.split(/\r?\n/)) {
        const line = rawLine.trim();
        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        const listItem = line.match(/^[-*]\s+(.+)$/);

        if (!listItem) {
            list = null;
        }
        if (heading || listItem || !line) {
            flushParagraph();
        }

        if (heading) {
            // The top-level title duplicates the collapsible's own heading.
            if (heading[1].length > 1) {
                const element = document.createElement(`h${Math.min(heading[1].length + 2, 6)}`);
                element.textContent = heading[2];
                fragment.append(element);
            }
        } else if (listItem) {
            if (!list) {
                list = document.createElement('ul');
                fragment.append(list);
            }
            const item = document.createElement('li');
            item.textContent = listItem[1];
            list.append(item);
        } else if (line) {
            paragraph.push(line);
        }
    }
    flushParagraph();

    changelogContent.replaceChildren(fragment);
}

export async function loadChangelog() {
    if (changelogRequest) {
        return changelogRequest;
    }

    changelogContent.textContent = 'Loading changelog...';
    changelogRequest = fetch(new URL('CHANGELOG.md', document.baseURI))
        .then(async response => {
            if (response.status === 404) {
                changelogContent.textContent = 'No changelog is available yet.';
                return;
            }
            if (!response.ok) {
                throw new Error(`Changelog request failed with status ${response.status}`);
            }

            const changelog = (await response.text()).trim();
            if (changelog) {
                renderChangelog(changelog);
            } else {
                changelogContent.textContent = 'The changelog file is empty.';
            }
        })
        .catch(error => {
            console.error('Unable to load CHANGELOG.md:', error);
            changelogContent.textContent = 'The changelog could not be loaded. Please try again later.';
            changelogRequest = null;
        });

    return changelogRequest;
}

infoButton.addEventListener('click', () => {
    infoModal.showModal();
});

changelogDetails.addEventListener('toggle', () => {
    if (changelogDetails.open) {
        loadChangelog();
    }
});

infoModal.addEventListener('click', event => {
    if (event.target === infoModal) {
        infoModal.close();
    }
});

export function updateArchiveMeta(items) {
    if (!archiveMeta) {
        return;
    }

    const generatedAt = state.catalogGeneratedAt
        ? new Date(state.catalogGeneratedAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Unknown';
    const version = state.catalogVersion ? state.catalogVersion.slice(0, 12) : 'Unknown';
    const totalItems = state.totalAvailableItems ?? items.length;

    if (archiveMetaText) {
        archiveMetaText.textContent = `Catalog: ${version} | Generated: ${generatedAt} | Items: ${totalItems}`;
    } else {
        archiveMeta.textContent = `Catalog: ${version} | Generated: ${generatedAt} | Items: ${totalItems}`;
    }

    updateArchiveMetaSpinner();
}

export function updateArchiveMetaSpinner() {
    if (!archiveMetaSpinner) {
        return;
    }

    archiveMetaSpinner.classList.toggle('hidden', !state.isFetchingPage);
}

export async function copyToClipboard(text, successMessage) {
    let copied = false;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            copied = true;
        }
    } catch {
        copied = false;
    }

    showToast(copied ? successMessage : 'Copy failed');
}

export function showToast(message) {
    if (!toastElement) {
        return;
    }

    if (toastTimeoutId) {
        clearTimeout(toastTimeoutId);
    }

    toastElement.textContent = message;
    toastElement.classList.remove('hidden');

    requestAnimationFrame(() => {
        toastElement.classList.add('show');
    });

    toastTimeoutId = setTimeout(() => {
        toastElement.classList.remove('show');
        setTimeout(() => {
            toastElement.classList.add('hidden');
        }, 220);
    }, 1800);
}
