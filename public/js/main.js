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
import { showToast, showGlobalLoader, hideGlobalLoader } from './utils.js';
import { fetchCategories } from './services.js';
import { setState } from './state.js';

/**
 * AJOUT : Charge les données initiales nécessaires pour l'application.
 * C'est l'étape clé qui manquait pour que les catégories soient disponibles partout.
 */
async function initializeAppState() {
    try {
        showGlobalLoader("Chargement des données initiales...");
        const categories = await fetchCategories();
        setState({ allCategories: categories });
    } catch (error) {
        console.error("Erreur critique lors du chargement des données de l'application:", error);
        showToast("Impossible de charger les données essentielles.", "error");
    } finally {
        hideGlobalLoader();
    }
}

async function main() {
    try {
        console.log("DOM chargé. Initialisation de MapMarket...");
        
        // 1. Initialise les gestionnaires d'UI (modales, boutons, etc.)
        // Doit être avant l'état pour que les écouteurs soient prêts.
        initUIManager();

        // 2. Met en place l'écouteur d'authentification. L'UI se mettra à jour
        //    automatiquement grâce au système d'état.
        setupAuthListeners();

        // 3. AJOUT : Étape cruciale pour charger les données partagées comme les catégories.
        await initializeAppState();

        // 4. Initialise la carte Leaflet et charge les annonces.
        initializeMap('map-view');
        
        // 5. Initialise les modules de fonctionnalités.
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