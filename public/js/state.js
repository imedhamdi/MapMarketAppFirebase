/**
 * =================================================================
 * MAPMARKET - GESTION DE L'ÉTAT GLOBAL (state.js)
 * =================================================================
 * Rôle : Centraliser l'état de l'application (données de l'utilisateur,
 * annonces chargées, etc.) pour qu'il soit accessible de manière
 * cohérente par tous les modules.
 */

const state = {
    currentUser: null,      // L'objet utilisateur de Firebase Auth
    userProfile: null,      // Le profil utilisateur depuis Firestore
    isLoggedIn: false,      // Un booléen simple pour des vérifications rapides
    currentAds: [],         // Le tableau des annonces actuellement affichées sur la carte
    allCategories: [],      // CORRECTION : La liste des catégories, chargée une fois au démarrage
    listeners: [],          // Un tableau pour les écouteurs de changement d'état
};

/**
 * Met à jour l'état et notifie tous les écouteurs.
 * @param {object} newState - Les nouvelles valeurs à fusionner avec l'état existant.
 */
export function setState(newState) {
    Object.assign(state, newState);
    // Notifie les écouteurs qu'un changement a eu lieu
    state.listeners.forEach(listener => listener(state));
    console.log("État mis à jour:", state);
}

/**
 * Permet à un module de s'abonner aux changements d'état.
 * @param {function} listener - La fonction à appeler lors d'un changement d'état.
 */
export function subscribe(listener) {
    state.listeners.push(listener);
}

/**
 * Renvoie une copie de l'état actuel pour éviter les mutations directes.
 * @returns {object} L'état actuel de l'application.
 */
export function getState() {
    return { ...state };
}