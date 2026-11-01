export const SKINLINE_ICON_URLS = {
    'Ace of Spades': 'https://assets.timfernix.dev/icons/Ezreal_8.ico',
    'Arcade': 'https://assets.timfernix.dev/icons/Ezreal_9.ico',
    'Base': 'https://assets.timfernix.dev/icons/Ezreal_0.ico',
    'Battle Academia': 'https://assets.timfernix.dev/icons/Ezreal_21.ico',
    'Crystal Rose': 'https://assets.timfernix.dev/icons/Ezreal_91.ico',
    'Debonair': 'https://assets.timfernix.dev/icons/Ezreal_7.ico',
    'Dream Of The Red Chamber': 'https://assets.timfernix.dev/icons/Dream_of_the_red_chamber.jpg',
    'Explorer': 'https://assets.timfernix.dev/icons/Ezreal_4.ico',
    'Faerie Court': 'https://assets.timfernix.dev/icons/Ezreal_33.ico',
    'Frosted': 'https://assets.timfernix.dev/icons/Ezreal_3.ico',
    'HEARTSTEEL': 'https://assets.timfernix.dev/icons/Ezreal_43.ico',
    'HEARTSTEEL Live My Life': 'https://assets.timfernix.dev/heartsteel-2026/ezreal_splash_tile_78.skins_ezreal_skin78.jpg',
    'Heavenscale': 'https://assets.timfernix.dev/icons/Ezreal_44.ico',
    'Hidden Dragon': 'https://assets.timfernix.dev/icons/Hidden_Dragon_Chibi.jpeg',
    'Ink Keeper': 'https://assets.timfernix.dev/icons/Ink_Keeper_Chibi.jpeg',
    'Jarro Lightfeather': 'https://assets.timfernix.dev/icons/Ezreal_99.ico',
    'Love Confession': 'https://assets.timfernix.dev/icons/Love-Confession.ico',
    'Lovestruck': 'https://assets.timfernix.dev/icons/Ezreal_90.ico',
    'Masque of the Black Rose': 'https://assets.timfernix.dev/icons/Ezreal_100.ico',
    'Nottingham': 'https://assets.timfernix.dev/icons/Ezreal_1.ico',
    'Other': 'https://assets.timfernix.dev/icons/model.png',
    'Pajama Guardian': 'https://assets.timfernix.dev/icons/Ezreal_20.ico',
    'Porcelain Protector': 'https://assets.timfernix.dev/icons/Ezreal_25.ico',
    'Prestige Heavenscale': 'https://assets.timfernix.dev/icons/Prestige_Heavenscale_Icon.jpg',
    'Prestige Love Confession': 'https://assets.timfernix.dev/icons/Love_Confession_Prestige.jpg',
    'Prestige Porcelain Protector': 'https://assets.timfernix.dev/icons/Prestige_Porcelain_Protector_Chibi.jpg',
    'Prestige PsyOps': 'https://assets.timfernix.dev/icons/Prestige_PsyOps_Icon.jpg',
    'Prestige Select Weather Entity': 'https://assets.timfernix.dev/icons/Prestige_Select_Weather_Entity.png',
    "Prosperous Chang'an": 'https://assets.timfernix.dev/prosperous-changan/Prosperous_Changan_Icon.jpg',
    'Psyops': 'https://assets.timfernix.dev/icons/Ezreal_22.ico',
    'Pulsefire': 'https://assets.timfernix.dev/icons/Ezreal_5.ico',
    'SSG': 'https://assets.timfernix.dev/icons/Ezreal_19.ico',
    'Star Guardian': 'https://assets.timfernix.dev/icons/Ezreal_18.ico',
    'Striker': 'https://assets.timfernix.dev/icons/Ezreal_2.ico',
    'TPA': 'https://assets.timfernix.dev/icons/Ezreal_6.ico',
    'Weather Entity': 'https://assets.timfernix.dev/icons/Weather-Entity.ico'
};
export const GAME_LOGO_URLS = {
    'Golden Spatula': 'https://assets.timfernix.dev/icons/golden_spatula.webp',
    'League of Legends': 'https://assets.timfernix.dev/icons/lol.png',
    'Legends of Runeterra': 'https://assets.timfernix.dev/icons/lor.png',
    'Project F': 'https://assets.timfernix.dev/icons/riot.webp',
    'Riftbound': 'https://assets.timfernix.dev/icons/riftbound.png',
    'Teamfight Tactics': 'https://assets.timfernix.dev/icons/tft.webp',
    'Valorant' : 'https://assets.timfernix.dev/icons/valorant.svg',
    'Wild Rift': 'https://assets.timfernix.dev/icons/wild_rift.svg'
};
export const CATEGORY_ICON_URLS = {
    'Abilities': 'https://assets.timfernix.dev/icons/abilities.png',
    'Card': 'https://assets.timfernix.dev/icons/card.png',
    'Concept': 'https://assets.timfernix.dev/icons/concept.png',
    'Emote': 'https://assets.timfernix.dev/icons/emote.png',
    'External': 'https://assets.timfernix.dev/icons/external.png',
    'Face': 'https://assets.timfernix.dev/icons/face.png',
    'Icon': 'https://assets.timfernix.dev/icons/icon.png',
    'Loadingscreen': 'https://assets.timfernix.dev/icons/Loadingscreen.png',
    'Merch': 'https://assets.timfernix.dev/icons/merch.png',
    'Model': 'https://assets.timfernix.dev/icons/model.png',
    'Promoart': 'https://assets.timfernix.dev/icons/promoart.png',
    'Splashart': 'https://assets.timfernix.dev/icons/splashart.png',
    'Video': 'https://assets.timfernix.dev/icons/video.png',
    'UI': 'https://assets.timfernix.dev/icons/ui.png'
};
export const CATEGORY_DISPLAY_NAMES = {
    'Promoart': 'Promo-/Artwork'
};
export const CHROMA_ICON_URL = 'https://assets.timfernix.dev/icons/chroma.png';

// Warm the browser cache with all UI icons at high priority so large gallery media can't delay them.
export function preloadUiIcons() {
    const urls = new Set([...Object.values(SKINLINE_ICON_URLS), ...Object.values(GAME_LOGO_URLS), ...Object.values(CATEGORY_ICON_URLS), CHROMA_ICON_URL]);
    urls.forEach(url => {
        const img = new Image();
        img.fetchPriority = 'high';
        img.src = url;
    });
}
