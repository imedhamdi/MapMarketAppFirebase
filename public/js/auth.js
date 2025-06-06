// public/js/auth.js

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
import { setState } from './state.js';
import { fetchUserProfile } from "./services.js";
import { showToast, showGlobalLoader, hideGlobalLoader } from './utils.js';

/**
 * L'écouteur principal. Il reste crucial pour maintenir la session
 * lors du rechargement de la page.
 */
export function setupAuthListeners() {
    onAuthStateChanged(auth, async (user) => {
        // Si l'état est déjà "loggé", c'est que handleLogin/handleSignUp vient de le faire.
        // On évite un re-rendu inutile pour rendre l'UI plus fluide.
        // Cette vérification est une micro-optimisation. Le code original fonctionne aussi.
        if (user && getState().isLoggedIn) {
             hideGlobalLoader();
             return;
        }

        showGlobalLoader("Vérification de la session...");
        try {
            if (user) {
                const userProfile = await fetchUserProfile(user.uid);
                // La logique de fallback est une bonne pratique, on la garde.
                if (!userProfile) {
                    console.warn(`Profil pour ${user.uid} non trouvé, nouvel essai dans 2s.`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const fallbackProfile = await fetchUserProfile(user.uid);
                    setState({ currentUser: user, userProfile: fallbackProfile, isLoggedIn: !!fallbackProfile });
                } else {
                    setState({ currentUser: user, userProfile: userProfile, isLoggedIn: true });
                }

                if (!user.emailVerified) {
                    showToast("Veuillez vérifier votre e-mail pour accéder à toutes les fonctionnalités.", "warning", 8000);
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
 * CORRIGÉ : Met à jour l'état immédiatement après la création.
 */
export async function handleSignUp(email, password, username) {
    showGlobalLoader("Création du compte...");
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: username });

        // On attend que la Cloud Function onUserCreate ait eu le temps de créer le profil
        // dans Firestore. 2.5 secondes est une attente pragmatique pour ce projet.
        await new Promise(resolve => setTimeout(resolve, 2500));
        const userProfile = await fetchUserProfile(user.uid);

        // Mise à jour de l'état IMMÉDIATE, avant de fermer la modale
        setState({ currentUser: user, userProfile: userProfile, isLoggedIn: true });

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
 * CORRIGÉ : Met à jour l'état immédiatement après la connexion.
 */
export async function handleLogin(email, password) {
    showGlobalLoader("Connexion en cours...");
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Récupération du profil et mise à jour de l'état IMMÉDIATE.
        const userProfile = await fetchUserProfile(user.uid);
        setState({ currentUser: user, userProfile: userProfile, isLoggedIn: true });

        showToast("Connexion réussie !", "success");
        return { success: true }; // L'état est maintenant à jour.
    } catch (error) {
        console.error("Erreur de connexion:", error.code, error.message);
        showToast(getAuthErrorMessage(error.code), "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}


// ... Le reste du fichier (handleLogout, handlePasswordReset, etc.) peut rester inchangé.
// J'inclus la fin du fichier pour être complet.

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
 * Gère la mise à jour du mot de passe de l'utilisateur connecté.
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
        console.error("Erreur de mise à jour du mot de passe:", error);
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
        'auth/invalid-email': "L'adresse e-mail n'est pas au bon format.",
        'auth/user-disabled': "Ce compte utilisateur a été désactivé.",
        'auth/user-not-found': "Aucun compte n'est associé à cet e-mail.",
        'auth/wrong-password': "Le mot de passe est incorrect.",
        'auth/email-already-in-use': "Cette adresse e-mail est déjà utilisée.",
        'auth/weak-password': "Le mot de passe doit contenir au moins 6 caractères.",
        'auth/operation-not-allowed': "Ce mode de connexion n'est pas activé.",
        'auth/too-many-requests': "L'accès à ce compte a été temporairement bloqué. Réessayez plus tard.",
        'auth/requires-recent-login': "Opération sensible. Veuillez vous déconnecter et vous reconnecter avant de réessayer.",
    };
    return messages[errorCode] || "Une erreur inattendue est survenue. Veuillez réessayer.";
}