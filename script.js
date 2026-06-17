const API_URL = '/api'; 
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
            
            if (skin.media && skin.media.length > 0) {
                const img = document.createElement('img');
                img.src = `${ASSETS_BASE_URL}${skin.media[0].r2_key}`;
                img.alt = skin.name;
                img.loading = 'lazy';
                card.appendChild(img);
            }
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Infrastruktur-Fehler beim Abruf der D1-Daten:', error);
    }
}
document.addEventListener('DOMContentLoaded', initGallery);