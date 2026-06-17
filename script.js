const API_URL = 'https://ezreal-api.timfernix-ce7.workers.dev/api/skins'; 

const ASSETS_BASE_URL = 'https://assets.timfernix.dev/'; 

async function initGallery() {
    const container = document.getElementById('gallery-container');
    
    try {
        const response = await fetch(API_URL);
        const skins = await response.json();
        
        skins.forEach(skin => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const title = document.createElement('h2');
            title.textContent = skin.name;
            card.appendChild(title);

            if (skin.description) {
                const desc = document.createElement('p');
                desc.textContent = skin.description;
                desc.style.fontSize = '0.9em';
                desc.style.color = '#94a3b8';
                card.appendChild(desc);
            }
            
            if (skin.media && skin.media.length > 0) {
                const img = document.createElement('img');
                // Setzt URL zusammen: https://assets.timfernix.dev/skins/star-guardian/base.png
                img.src = `${ASSETS_BASE_URL}${skin.media[0].r2_key}`;
                img.alt = skin.name;
                card.appendChild(img);
            }

            if (skin.tags && skin.tags.length > 0) {
                const tagContainer = document.createElement('div');
                tagContainer.style.marginTop = '10px';
                skin.tags.forEach(tag => {
                    const tagSpan = document.createElement('span');
                    tagSpan.textContent = `#${tag} `;
                    tagSpan.style.color = '#38bdf8';
                    tagSpan.style.fontSize = '0.8em';
                    tagContainer.appendChild(tagSpan);
                });
                card.appendChild(tagContainer);
            }
            
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Fehler beim Laden der API:', error);
        container.innerHTML = '<p>Konnte Archiv-Daten nicht laden.</p>';
    }
}

document.addEventListener('DOMContentLoaded', initGallery);