const API_URL = '/api/skins'; // Relativer Pfad durch Cloudflare Route
const ASSETS_BASE_URL = 'https://assets.timfernix.dev/';

// DOM Elements
const container = document.getElementById('gallery-container');
const loadingIndicator = document.getElementById('loading');
const noResultsIndicator = document.getElementById('no-results');
const searchInput = document.getElementById('searchInput');
const skinFilter = document.getElementById('skinFilter');
const gameFilter = document.getElementById('gameFilter');
const categoryFilter = document.getElementById('categoryFilter');

let allMediaItems = [];

async function init() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        data.forEach(skin => {
            skin.media.forEach(asset => {
                allMediaItems.push({
                    skinName: skin.skinName,
                    skinCodename: skin.skinCodename,
                    type: asset.type,
                    url: asset.url,
                    category: asset.category || 'Unkategorisiert',
                    game: asset.game || 'Generisch',
                    tags: asset.tags || [],
                    searchString: `${skin.skinName} ${asset.category} ${asset.game} ${asset.tags.join(' ')}`.toLowerCase()
                });
            });
        });

        populateDropdowns();
        setupEventListeners();
        renderGallery(allMediaItems);

        loadingIndicator.classList.add('hidden');
        container.classList.remove('hidden');
    } catch (error) {
        console.error('API Error:', error);
        loadingIndicator.textContent = 'Fehler beim Laden der Datenbank-Ressourcen.';
    }
}

function populateDropdowns() {
    const uniqueSkins = [...new Set(allMediaItems.map(m => m.skinName))].sort();
    const uniqueGames = [...new Set(allMediaItems.map(m => m.game))].sort();
    const uniqueCategories = [...new Set(allMediaItems.map(m => m.category))].sort();

    const createOptions = (arr, element) => {
        arr.forEach(item => {
            if (item !== 'Unkategorisiert' && item !== 'Generisch') {
                const opt = document.createElement('option');
                opt.value = item;
                opt.textContent = item;
                element.appendChild(opt);
            }
        });
    };

    createOptions(uniqueSkins, skinFilter);
    createOptions(uniqueGames, gameFilter);
    createOptions(uniqueCategories, categoryFilter);
}

function setupEventListeners() {
    const filterData = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedSkin = skinFilter.value;
        const selectedGame = gameFilter.value;
        const selectedCat = categoryFilter.value;

        const filtered = allMediaItems.filter(item => {
            const matchesSearch = item.searchString.includes(searchTerm);
            const matchesSkin = selectedSkin === 'all' || item.skinName === selectedSkin;
            const matchesGame = selectedGame === 'all' || item.game === selectedGame;
            const matchesCat = selectedCat === 'all' || item.category === selectedCat;

            return matchesSearch && matchesSkin && matchesGame && matchesCat;
        });

        renderGallery(filtered);
    };

    searchInput.addEventListener('input', filterData);
    skinFilter.addEventListener('change', filterData);
    gameFilter.addEventListener('change', filterData);
    categoryFilter.addEventListener('change', filterData);
}

function renderGallery(items) {
    container.innerHTML = '';

    if (items.length === 0) {
        noResultsIndicator.classList.remove('hidden');
        return;
    }
    noResultsIndicator.classList.add('hidden');

    // Um DOM-Reflows zu minimieren, DocumentFragment nutzen
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';

        // Media Element (Bild oder Video)
        const mediaWrapper = document.createElement('div');
        mediaWrapper.className = 'card-media';
        
        if (item.type === 'video') {
            const video = document.createElement('video');
            video.src = `${ASSETS_BASE_URL}${item.url}`;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            mediaWrapper.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = `${ASSETS_BASE_URL}${item.url}`;
            img.alt = item.skinName;
            img.loading = 'lazy';
            mediaWrapper.appendChild(img);
        }

        // Info Bereich
        const info = document.createElement('div');
        info.className = 'card-info';

        const header = document.createElement('div');
        header.className = 'card-header';
        
        const textWrapper = document.createElement('div');
        const title = document.createElement('h3');
        title.className = 'card-title';
        title.textContent = item.skinName;
        const game = document.createElement('div');
        game.className = 'card-game';
        game.textContent = item.game !== 'Generisch' ? item.game : '';
        
        textWrapper.appendChild(title);
        textWrapper.appendChild(game);

        const categoryBadge = document.createElement('span');
        categoryBadge.className = 'badge';
        categoryBadge.textContent = item.category;

        header.appendChild(textWrapper);
        header.appendChild(categoryBadge);
        info.appendChild(header);

        // Tags
        if (item.tags.length > 0) {
            const tagContainer = document.createElement('div');
            tagContainer.className = 'tag-container';
            item.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'tag';
                tagSpan.textContent = tag;
                tagContainer.appendChild(tagSpan);
            });
            info.appendChild(tagContainer);
        }

        card.appendChild(mediaWrapper);
        card.appendChild(info);
        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

document.addEventListener('DOMContentLoaded', init);