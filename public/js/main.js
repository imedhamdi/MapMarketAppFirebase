/**
 * =================================================================
 * MAPMARKET - POINT D'ENTRÉE PRINCIPAL (main.js)
 * =================================================================
 * Rôle : Initialiser l'application entière dans le bon ordre.
 */
import { setupAuthListeners } from './auth.js';
import { initUIManager } from './ui.js';
import { initializeMap } from './map.js';
import { initAdManager } from './ad-manager.js';
import { initChat } from './chat.js';
import { showToast } from './utils.js';

function main() {
    try {
        console.log("DOM chargé. Initialisation de MapMarket...");
        
        // 1. Initialise les gestionnaires d'UI (modales, boutons, etc.)
        initUIManager();

        // 2. Met en place l'écouteur d'authentification. L'UI se mettra à jour
        //    automatiquement grâce au système d'état.
        setupAuthListeners();

        // 3. Initialise la carte Leaflet et charge les annonces.
        initializeMap('map-view');
        
        // 4. Initialise les modules de fonctionnalités.
        initAdManager();
        initChat();

        console.log("MapMarket initialisé avec succès.");
        showToast("Bienvenue sur MapMarket !", "info");

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .catch(err => console.error('SW registration failed', err));
        }

    } catch (error) {
        console.error("Erreur critique lors de l'initialisation :", error);
        document.body.innerHTML = `<div style="text-align:center; padding: 2rem;"><h1>Erreur critique</h1><p>L'application n'a pas pu démarrer.</p></div>`;
    }
}

// Lance l'application une fois que le DOM est prêt.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
