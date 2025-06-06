/**
 * =================================================================
 * MAPMARKET - GESTIONNAIRE D'AUTHENTIFICATION (auth.js)
 * =================================================================
 * @file Ce module est le cœur de la gestion des utilisateurs. Il gère l'état
 * de la session, l'inscription, la connexion, la déconnexion, la vérification
 * par e-mail et la réinitialisation du mot de passe. Il communique avec
 * le module `state.js` pour mettre à jour l'état global de l'application.
 * @version 2.0.0
 * @exports setupAuthListeners - Fonction principale à appeler dans main.js.
 * @exports handleSignUp, handleLogin, handleLogout, handlePasswordReset, handleResendVerificationEmail
 */

import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { auth } from './firebase.js';
import { setState } from './state.js';
import { fetchUserProfile } from "./services.js";
import { showToast, showGlobalLoader, hideGlobalLoader } from './utils.js';

/**
 * Initialise l'écouteur principal qui réagit aux changements d'état de connexion de l'utilisateur.
 * C'est la fonction centrale qui pilote l'état d'authentification de l'application.
 */
export function setupAuthListeners() {
    onAuthStateChanged(auth, async (user) => {
        showGlobalLoader("Vérification de la session...");
        try {
            if (user) {
                // Un utilisateur est connecté.
                const userProfile = await fetchUserProfile(user.uid);

                // Si le profil n'existe pas encore dans Firestore (latence de la Cloud Function),
                // on attend un court instant et on réessaie.
                if (!userProfile) {
                    console.warn(`Profil pour ${user.uid} non trouvé, nouvel essai dans 2s.`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const fallbackProfile = await fetchUserProfile(user.uid);
                    setState({ currentUser: user, userProfile: fallbackProfile, isLoggedIn: true });
                } else {
                    setState({ currentUser: user, userProfile: userProfile, isLoggedIn: true });
                }

                if (!user.emailVerified) {
                    showToast("Veuillez vérifier votre e-mail pour accéder à toutes les fonctionnalités.", "warning", 8000);
                }
            } else {
                // Aucun utilisateur n'est connecté.
                setState({ currentUser: null, userProfile: null, isLoggedIn: false });
            }
        } catch (error) {
            console.error("Erreur critique dans onAuthStateChanged:", error);
            showToast("Impossible de vérifier votre session.", "error");
            setState({ currentUser: null, userProfile: null, isLoggedIn: false });
        } finally {
            hideGlobalLoader();
        }
    });
}

/**
 * Gère l'inscription d'un nouvel utilisateur.
 * @param {string} email - L'e-mail de l'utilisateur.
 * @param {string} password - Le mot de passe (6 caractères minimum).
 * @param {string} username - Le nom d'utilisateur choisi.
 * @returns {Promise<{success: boolean, error?: string}>} Un objet indiquant le succès ou l'échec.
 */
export async function handleSignUp(email, password, username) {
    showGlobalLoader("Création du compte...");
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Met à jour le profil Firebase Auth avec le nom d'utilisateur.
        // La Cloud Function onUserCreate utilisera cette information.
        await updateProfile(user, { displayName: username });

        // Envoie l'e-mail de vérification.
        await sendEmailVerification(user);
        
        showToast("Inscription réussie ! Un email de vérification vous a été envoyé.", "success");
        return { success: true };
    } catch (error) {
        console.error("Erreur d'inscription:", error.code, error.message);
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Gère la connexion d'un utilisateur.
 * @param {string} email - L'e-mail de l'utilisateur.
 * @param {string} password - Le mot de passe.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function handleLogin(email, password) {
    showGlobalLoader("Connexion en cours...");
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Connexion réussie !", "success");
        return { success: true };
    } catch (error) {
        console.error("Erreur de connexion:", error.code, error.message);
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Gère la déconnexion de l'utilisateur actuel.
 */
export async function handleLogout() {
    try {
        await signOut(auth);
        showToast("Vous avez été déconnecté.", "info");
    } catch (error) {
        console.error("Erreur de déconnexion:", error);
        showToast("Une erreur est survenue lors de la déconnexion.", "error");
    }
}

/**
 * Envoie un e-mail de réinitialisation de mot de passe.
 * @param {string} email - L'adresse e-mail de destination.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function handlePasswordReset(email) {
    showGlobalLoader("Envoi du lien...");
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Lien de réinitialisation envoyé ! Veuillez consulter votre boîte mail.", "success");
        return { success: true };
    } catch (error) {
        console.error("Erreur de réinitialisation:", error.code);
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Renvoie l'e-mail de vérification à l'utilisateur actuellement connecté.
 * @returns {Promise<{success: boolean}>}
 */
export async function handleResendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) {
        showToast("Aucun utilisateur n'est actuellement connecté.", "error");
        return { success: false };
    }

    showGlobalLoader("Envoi de l'e-mail...");
    try {
        await sendEmailVerification(user);
        showToast("Un nouvel e-mail de vérification a été envoyé.", "success");
        return { success: true };
    } catch (error) {
        console.error("Erreur de renvoi de la vérification:", error.code);
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Traduit les codes d'erreur de Firebase Auth en messages clairs pour l'utilisateur.
 * @param {string} errorCode - Le code d'erreur fourni par Firebase.
 * @returns {string} Un message d'erreur en français.
 */
function getAuthErrorMessage(errorCode) {
    const messages = {
        'auth/invalid-email': "L'adresse e-mail n'est pas au bon format.",
        'auth/user-disabled': "Ce compte utilisateur a été désactivé.",
        'auth/user-not-found': "Aucun compte n'est associé à cet e-mail.",
        'auth/wrong-password': "Le mot de passe est incorrect.",
        'auth/email-already-in-use': "Cette adresse e-mail est déjà utilisée.",
        'auth/weak-password': "Le mot de passe doit contenir au moins 6 caractères.",
        'auth/operation-not-allowed': "Ce mode de connexion n'est pas activé.",
        'auth/too-many-requests': "L'accès à ce compte a été temporairement bloqué suite à de trop nombreuses tentatives. Réessayez plus tard."
    };
    return messages[errorCode] || "Une erreur inattendue est survenue. Veuillez réessayer.";
}
