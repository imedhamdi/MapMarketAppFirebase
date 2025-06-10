// CHEMIN : public/js/main.js

/**
 * =================================================================
 * MAPMARKET - POINT D'ENTRÉE PRINCIPAL (main.js) - v2 (Robuste)
 * =================================================================
 * Rôle : Orchestrer l'initialisation de l'application dans un ordre
 * précis et gérer les erreurs critiques de démarrage.
 */

// --- Import des modules ---
// Core
import { setupAuthListeners } from './auth.js';
import { initUIManager } from './ui.js';
import { setState } from './state.js';
import { showToast, showGlobalLoader, hideGlobalLoader } from './utils.js';
import { fetchCategories } from './services.js';

// Features
import { initializeMap } from './map.js';
import { initAdManager } from './ad-manager.js';
import { initAdDetail } from './ad-detail.js';
import { initChat } from './chat.js';

/**
 * Charge les données initiales critiques pour le fonctionnement de l'application.
 * En cas d'échec, cette fonction lève une erreur pour interrompre le démarrage.
 * @throws {Error} Si les données essentielles ne peuvent être chargées.
 */
async function initializeAppState() {
    try {
        showGlobalLoader("Chargement des données de l'application...");
        let categories = [];
        const cached = sessionStorage.getItem('categoriesCache');
        if (cached) {
            categories = JSON.parse(cached);
        } else {
            categories = await fetchCategories();
            sessionStorage.setItem('categoriesCache', JSON.stringify(categories));
        }
        setState({ allCategories: categories });
        console.log("État initial de l'application chargé (catégories, etc.).");
    } catch (error) {
        console.error("Erreur critique lors du chargement des données de l'application:", error);
        // On propage l'erreur pour que le bloc catch principal de main() l'intercepte.
        // Cela arrête l'initialisation de l'application.
        throw new Error("Impossible de charger les données essentielles de l'application.");
    } finally {
        // Le loader est masqué dans tous les cas.
        hideGlobalLoader();
    }
}

/**
 * Fonction principale d'initialisation de l'application.
 * Orchestre le chargement des modules dans le bon ordre.
 */
async function main() {
    try {
        console.log("🚀 DOM chargé. Initialisation de MapMarket...");

        // --- ÉTAPE 1 : Initialisation de l'interface utilisateur de base ---
        // Met en place les listeners pour les modales, les boutons globaux et s'abonne
        // aux changements d'état pour les mises à jour visuelles.
        // Doit être exécuté tôt pour que l'UI puisse réagir aux étapes suivantes.
        initUIManager();

        // --- ÉTAPE 2 : Mise en place de l'authentification ---
        // Lance l'écouteur Firebase qui détecte les changements de connexion/déconnexion.
        // L'UI se mettra à jour en conséquence grâce au travail fait à l'étape 1.
        setupAuthListeners();

        // --- ÉTAPE 3 : Chargement des données critiques ---
        // On attend que les données comme les catégories soient chargées avant de continuer.
        // Si cette étape échoue, l'application s'arrête ici.
        await initializeAppState();

        // --- ÉTAPE 4 : Initialisation des fonctionnalités principales ---
        // Maintenant que l'UI est prête, l'auth est écoutée et les données sont là,
        // on peut initialiser les modules qui en dépendent.
        initializeMap('map-view');
        initAdManager();
        initAdDetail();
        initChat();

        // --- ÉTAPE 5 : Finalisation et Service Worker ---
        console.log("✅ MapMarket initialisé avec succès.");
        showToast("Bienvenue sur MapMarket !", "info");

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => console.log('Service Worker enregistré avec succès:', registration))
                .catch(err => console.error('Échec de l\'enregistrement du Service Worker:', err));
        }

    } catch (error) {
        // --- GESTION DES ERREURS CRITIQUES ---
        // Si une erreur est survenue dans l'une des étapes ci-dessus, on l'affiche
        // à l'utilisateur et on arrête complètement le processus.
        console.error("❌ Erreur critique lors de l'initialisation de l'application :", error);
        document.body.innerHTML = `
            <div style="text-align:center; padding: 2rem; font-family: sans-serif; color: #333;">
                <h1>Erreur Critique</h1>
                <p>L'application n'a pas pu démarrer correctement.</p>
                <p style="color: #888; font-size: 0.9rem;">Détail : ${error.message}</p>
            </div>`;
    }
}

// --- Point d'entrée ---
// Lance l'application une fois que le DOM est complètement chargé et prêt.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    // Le DOM est déjà prêt.
    main();
}
