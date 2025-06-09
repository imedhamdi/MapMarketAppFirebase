// CHEMIN : public/js/auth.js

/**
 * =================================================================
 * MAPMARKET - GESTION DE L'AUTHENTIFICATION (auth.js)
 * =================================================================
 * @file Gère l'ensemble du cycle de vie de l'authentification utilisateur
 * avec Firebase Auth, et la synchronisation avec l'état global de l'application.
 */

import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile,
    updatePassword
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { auth } from './firebase.js';
import { setState, getState } from './state.js';
import { fetchUserProfile } from "./services.js";
import { showToast, showGlobalLoader, hideGlobalLoader } from './utils.js';

/**
 * Tente de récupérer un profil utilisateur plusieurs fois avant d'échouer.
 * Utile pour gérer le délai de création du document par la Cloud Function.
 * @param {string} userId - L'ID de l'utilisateur à récupérer.
 * @param {number} retries - Le nombre de tentatives.
 * @param {number} delay - Le délai entre les tentatives en ms.
 * @returns {Promise<object|null>} Le profil utilisateur ou null.
 */
async function retryFetchProfile(userId, retries = 5, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const profile = await fetchUserProfile(userId);
            if (profile) return profile;
            console.warn(`Profil pour ${userId} non trouvé, tentative ${i + 1}/${retries}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
            console.error(`Erreur lors de la tentative de récupération du profil:`, error);
        }
    }
    console.error(`Impossible de récupérer le profil pour ${userId} après ${retries} tentatives.`);
    return null;
}

/**
 * Met en place l'écouteur principal de Firebase Auth qui réagit aux changements
 * d'état de connexion de l'utilisateur (connexion, déconnexion).
 */
export function setupAuthListeners() {
    onAuthStateChanged(auth, async (user) => {
        if (user && getState().currentUser?.uid === user.uid && getState().isLoggedIn) {
            hideGlobalLoader();
            return;
        }

        showGlobalLoader("Vérification de la session...");
        try {
            if (user) {
                const userProfile = await retryFetchProfile(user.uid);
                if (userProfile) {
                    setState({ currentUser: user, userProfile, isLoggedIn: true });
                    if (!user.emailVerified) {
                        showToast("Vérifiez votre e-mail pour accéder à toutes les fonctionnalités.", "warning", 8000);
                    }
                } else {
                    showToast("Votre profil n'a pas pu être chargé. Déconnexion.", "error");
                    await signOut(auth);
                }
            } else {
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
 */
export async function handleSignUp(email, password, username) {
    showGlobalLoader("Création du compte...");
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: username });

        // La Cloud Function est déclenchée. onAuthStateChanged va gérer la suite.
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
 * Gère la connexion d'un utilisateur existant.
 */
export async function handleLogin(email, password) {
    showGlobalLoader("Connexion en cours...");
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged va gérer la mise à jour de l'état.
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
 * Gère la déconnexion de l'utilisateur.
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
 */
export async function handlePasswordReset(email) {
    showGlobalLoader("Envoi du lien...");
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Lien de réinitialisation envoyé ! Consultez votre boîte mail.", "success");
        return { success: true };
    } catch (error) {
        console.error("Erreur de réinitialisation:", error.code, error.message);
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Réenvoie l'e-mail de vérification à l'utilisateur actuellement connecté.
 */
export async function handleResendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) {
        showToast("Aucun utilisateur connecté.", "error");
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
 * Met à jour le mot de passe de l'utilisateur connecté.
 */
export async function handleUpdatePassword(newPassword) {
    const user = auth.currentUser;
    if (!user) {
        showToast("Utilisateur non connecté.", "error");
        return { success: false };
    }

    showGlobalLoader("Mise à jour du mot de passe...");
    try {
        await updatePassword(user, newPassword);
        showToast("Mot de passe mis à jour avec succès.", "success");
        return { success: true };
    } catch (error) {
        console.error("Erreur de mise à jour du mot de passe:", error.code);
        showToast(`Erreur : ${getAuthErrorMessage(error.code)}`, "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Traduit les codes d'erreur de Firebase Auth en messages clairs pour l'utilisateur.
 */
function getAuthErrorMessage(errorCode) {
    const messages = {
        'auth/invalid-email': "L'adresse e-mail est invalide.",
        'auth/user-disabled': "Ce compte a été désactivé.",
        'auth/user-not-found': "Aucun utilisateur trouvé avec cet e-mail.",
        'auth/wrong-password': "Mot de passe incorrect.",
        'auth/email-already-in-use': "Cette adresse e-mail est déjà utilisée.",
        'auth/weak-password': "Le mot de passe doit contenir au moins 6 caractères.",
        'auth/operation-not-allowed': "Cette opération n'est pas autorisée.",
        'auth/too-many-requests': "Trop de tentatives. Veuillez réessayer dans quelques instants.",
        'auth/requires-recent-login': "Cette action est sensible. Veuillez vous reconnecter avant de réessayer.",
    };
    return messages[errorCode] || "Une erreur inattendue est survenue. Veuillez réessayer.";
}