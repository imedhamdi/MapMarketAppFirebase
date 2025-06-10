/**
 * =================================================================
 * MAPMARKET - GESTION DE L'AUTHENTIFICATION (auth.js) - VERSION ROBUSTE
 * =================================================================
 * @file Gère le cycle complet de l'authentification avec Firebase Auth.
 * Fonctionnalités clés :
 * - Gestion des sessions avec cache local (sessionStorage)
 * - Synchronisation en arrière-plan avec Firestore
 * - Vérification d'e-mail améliorée
 * - Gestion des tokens FCM pour les notifications
 * - Protection contre les attaques de force brute
 * - Journalisation détaillée
 */

import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile,
    updatePassword,
    updateEmail,
    deleteUser as firebaseDeleteUser,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-functions.js";
import { getMessaging, getToken, deleteToken } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging.js";
import { app } from './firebase.js';
import { setState, getState } from './state.js';
import { fetchUserProfile, updateUserProfile } from "./services.js";
import { showToast, showGlobalLoader, hideGlobalLoader, debounce } from './utils.js';

const auth = getAuth(app);
const db = getFirestore(app);
const messaging = getMessaging(app);
const functions = getFunctions(app, 'europe-central2');

// Configuration de la persistance
const PERSISTENCE_TYPE = browserLocalPersistence; // ou browserSessionPersistence

// Initialisation de l'authentification
(async function initAuth() {
    try {
        await setPersistence(auth, PERSISTENCE_TYPE);
        console.log("Auth: Persistence configurée avec succès");
    } catch (error) {
        console.error("Erreur de configuration de la persistance:", error);
    }
})();

/**
 * Écouteur principal d'état d'authentification avec stratégie Cache-Then-Network
 */
export function setupAuthListeners() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Utilisateur connecté
            await handleUserLoggedIn(user);
        } else {
            // Utilisateur déconnecté
            await handleUserLoggedOut();
        }
    });
}

async function handleUserLoggedIn(user) {
    console.log("Auth: Utilisateur détecté", user.uid);
    
    // 1. Mise à jour immédiate depuis le cache
    const cachedProfile = sessionStorage.getItem(`userProfile_${user.uid}`);
    if (cachedProfile) {
        console.log("Auth: Profil trouvé dans le cache");
        setState({ 
            currentUser: user, 
            userProfile: JSON.parse(cachedProfile), 
            isLoggedIn: true 
        });
    } else {
        showGlobalLoader("Chargement de votre profil...");
    }

    try {
        // 2. Récupération du profil à jour
        const freshProfile = await fetchUserProfile(user.uid);
        
        if (!freshProfile) {
            throw new Error("Profil Firestore introuvable");
        }

        // 3. Mise à jour des FCM Tokens pour les notifications
        await manageFcmTokens(user.uid, freshProfile);

        // 4. Mise à jour de l'état et du cache
        sessionStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(freshProfile));
        setState({ 
            currentUser: user, 
            userProfile: freshProfile, 
            isLoggedIn: true 
        });

        // Vérification d'e-mail
        if (!user.emailVerified) {
            handleUnverifiedEmail(user);
        }

        console.log("Auth: Session synchronisée avec succès");
    } catch (error) {
        console.error("Auth: Erreur de synchronisation:", error);
        showToast("Problème de synchronisation. Veuillez rafraîchir.", "error");
        await handleLogout();
    } finally {
        hideGlobalLoader();
    }
}

async function handleUserLoggedOut() {
    console.log("Auth: Utilisateur déconnecté");
    
    // Nettoyage du cache et de l'état
    const currentState = getState();
    if (currentState.userProfile) {
        sessionStorage.removeItem(`userProfile_${currentState.userProfile.uid}`);
    }
    
    setState({ 
        currentUser: null, 
        userProfile: null, 
        isLoggedIn: false 
    });
    
    // Suppression des tokens FCM
    try {
        if (messaging) {
            const token = await getToken(messaging);
            if (token) await deleteToken(messaging);
        }
    } catch (error) {
        console.error("Erreur de nettoyage FCM:", error);
    }
}

/**
 * Gestion des tokens FCM pour les notifications push
 */
async function manageFcmTokens(userId, userProfile) {
    if (!messaging) return;
    
    try {
        const currentToken = await getToken(messaging, {
            vapidKey: "VOTRE_CLE_VAPID" // À remplacer par votre clé
        });

        if (currentToken) {
            const tokens = userProfile.fcmTokens || [];
            
            if (!tokens.includes(currentToken)) {
                const updatedTokens = [...tokens, currentToken];
                await updateUserProfile(userId, { fcmTokens: updatedTokens });
                console.log("Auth: Token FCM mis à jour");
            }
        } else {
            console.log("Auth: Aucun token FCM disponible");
        }
    } catch (error) {
        console.error("Erreur de gestion FCM:", error);
    }
}

/**
 * Gestion des e-mails non vérifiés
 */
function handleUnverifiedEmail(user) {
    // Vérification périodique de l'état de vérification
    const checkInterval = setInterval(async () => {
        await user.reload();
        if (user.emailVerified) {
            clearInterval(checkInterval);
            showToast("E-mail vérifié avec succès !", "success");
            setState({ currentUser: user });
        }
    }, 30000); // Toutes les 30 secondes

    // Message à l'utilisateur
    showToast(
        "Veuillez vérifier votre e-mail pour accéder à toutes les fonctionnalités.", 
        "warning", 
        10000
    );
}

/**
 * Inscription d'un nouvel utilisateur
 */
export async function handleSignUp(email, password, username, avatarUrl = "") {
    showGlobalLoader("Création de votre compte...");
    
    try {
        // Création du compte Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Mise à jour du profil Auth
        await updateProfile(user, { 
            displayName: username,
            photoURL: avatarUrl || ""
        });
        
        // Envoi de la vérification d'e-mail
        await sendEmailVerification(user);
        
        // La Cloud Function onUserCreate va créer le document Firestore
        
        showToast(
            `Bienvenue ${username} ! Un e-mail de vérification a été envoyé à ${email}.`, 
            "success"
        );
        
        return { success: true, user };
    } catch (error) {
        console.error("Erreur d'inscription:", error);
        const errorMsg = getAuthErrorMessage(error.code);
        showToast(errorMsg, "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Connexion de l'utilisateur avec protection contre les attaques de force brute
 */
export const handleLogin = debounce(async (email, password) => {
    showGlobalLoader("Connexion en cours...");
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Vérification supplémentaire pour s'assurer que le profil Firestore existe
        const profile = await fetchUserProfile(user.uid);
        if (!profile) {
            throw new Error("Profil utilisateur introuvable");
        }
        
        showToast(`Bienvenue ${user.displayName || ''} !`, "success");
        return { success: true, user };
    } catch (error) {
        console.error("Erreur de connexion:", error);
        const errorMsg = getAuthErrorMessage(error.code);
        showToast(errorMsg, "error");
        
        // En cas de trop de tentatives, suggérer une réinitialisation
        if (error.code === 'auth/too-many-requests') {
            showToast("Voulez-vous réinitialiser votre mot de passe ?", "info", 5000, {
                action: "Réinitialiser",
                handler: () => handlePasswordReset(email)
            });
        }
        
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}, 500); // Délai anti-spam de 500ms

/**
 * Déconnexion de l'utilisateur
 */
export async function handleLogout() {
    showGlobalLoader("Déconnexion...");
    
    try {
        // Suppression du token FCM avant déconnexion
        if (messaging) {
            try {
                const token = await getToken(messaging);
                if (token) await deleteToken(messaging);
            } catch (fcmError) {
                console.error("Erreur de suppression FCM:", fcmError);
            }
        }
        
        await signOut(auth);
        showToast("Vous avez été déconnecté avec succès.", "info");
        return { success: true };
    } catch (error) {
        console.error("Erreur de déconnexion:", error);
        showToast("Échec de la déconnexion. Veuillez réessayer.", "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Réinitialisation du mot de passe
 */
export async function handlePasswordReset(email) {
    showGlobalLoader("Envoi du lien de réinitialisation...");
    
    try {
        await sendPasswordResetEmail(auth, email);
        showToast(
            `Un lien de réinitialisation a été envoyé à ${email}.`, 
            "success"
        );
        return { success: true };
    } catch (error) {
        console.error("Erreur de réinitialisation:", error);
        const errorMsg = getAuthErrorMessage(error.code);
        showToast(errorMsg, "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Suppression du compte utilisateur
 */
export async function handleDeleteAccount() {
    showGlobalLoader("Suppression de votre compte...");
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Aucun utilisateur connecté");
        
        // Appel à la Cloud Function pour une suppression propre
        const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
        const result = await deleteUserAccount();
        
        // Suppression locale si la fonction cloud réussit
        await firebaseDeleteUser(user);
        
        showToast(
            result.data.message || "Votre compte a été supprimé avec succès.", 
            "success"
        );
        return { success: true };
    } catch (error) {
        console.error("Erreur de suppression:", error);
        const errorMsg = error.message || getAuthErrorMessage(error.code);
        showToast(`Échec de la suppression: ${errorMsg}`, "error");
        return { success: false, error: error.code || error.message };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Mise à jour du profil utilisateur
 */
export async function handleUpdateProfile(updates) {
    showGlobalLoader("Mise à jour du profil...");
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Aucun utilisateur connecté");
        
        // Mise à jour Firebase Auth si nécessaire
        const authUpdates = {};
        if (updates.displayName) authUpdates.displayName = updates.displayName;
        if (updates.photoURL) authUpdates.photoURL = updates.photoURL;
        
        if (Object.keys(authUpdates).length > 0) {
            await updateProfile(user, authUpdates);
        }
        
        // Mise à jour Firestore
        await updateUserProfile(user.uid, updates);
        
        // Mise à jour du cache local
        const freshProfile = await fetchUserProfile(user.uid);
        sessionStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(freshProfile));
        
        showToast("Profil mis à jour avec succès !", "success");
        return { success: true, profile: freshProfile };
    } catch (error) {
        console.error("Erreur de mise à jour:", error);
        showToast("Échec de la mise à jour du profil.", "error");
        return { success: false, error: error.message };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Mise à jour de l'e-mail de l'utilisateur
 */
export async function handleUpdateEmail(newEmail) {
    showGlobalLoader("Mise à jour de l'e-mail...");
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Aucun utilisateur connecté");
        
        await updateEmail(user, newEmail);
        await sendEmailVerification(user);
        
        // Mise à jour Firestore si nécessaire
        await updateUserProfile(user.uid, { email: newEmail });
        
        showToast(
            `E-mail mis à jour. Un lien de vérification a été envoyé à ${newEmail}.`, 
            "success"
        );
        return { success: true };
    } catch (error) {
        console.error("Erreur de mise à jour:", error);
        const errorMsg = getAuthErrorMessage(error.code);
        showToast(errorMsg, "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Mise à jour du mot de passe
 */
export async function handleUpdatePassword(newPassword) {
    showGlobalLoader("Mise à jour du mot de passe...");
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Aucun utilisateur connecté");
        
        await updatePassword(user, newPassword);
        showToast("Mot de passe mis à jour avec succès.", "success");
        return { success: true };
    } catch (error) {
        console.error("Erreur de mise à jour:", error);
        const errorMsg = getAuthErrorMessage(error.code);
        
        // Solution pour l'erreur de reconnexion requise
        if (error.code === 'auth/requires-recent-login') {
            showToast(
                "Pour des raisons de sécurité, veuillez vous reconnecter avant de changer votre mot de passe.",
                "warning",
                10000
            );
        } else {
            showToast(errorMsg, "error");
        }
        
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Renvoi de l'e-mail de vérification
 */
export async function resendVerificationEmail() {
    showGlobalLoader("Envoi du lien de vérification...");
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Aucun utilisateur connecté");
        
        await sendEmailVerification(user);
        showToast(
            `Un nouveau lien de vérification a été envoyé à ${user.email}.`, 
            "success"
        );
        return { success: true };
    } catch (error) {
        console.error("Erreur d'envoi:", error);
        const errorMsg = getAuthErrorMessage(error.code);
        showToast(errorMsg, "error");
        return { success: false, error: error.code };
    } finally {
        hideGlobalLoader();
    }
}

/**
 * Traduction des codes d'erreur Firebase
 */
function getAuthErrorMessage(errorCode) {
    const messages = {
        // Erreurs d'inscription/connexion
        'auth/invalid-email': "L'adresse e-mail est invalide.",
        'auth/user-disabled': "Ce compte a été désactivé.",
        'auth/user-not-found': "Aucun compte trouvé avec cet e-mail.",
        'auth/wrong-password': "Mot de passe incorrect.",
        'auth/email-already-in-use': "Cette adresse e-mail est déjà utilisée.",
        'auth/operation-not-allowed': "Cette opération n'est pas autorisée.",
        'auth/weak-password': "Le mot de passe doit contenir au moins 6 caractères.",
        'auth/too-many-requests': "Trop de tentatives. Veuillez réessayer plus tard.",
        
        // Erreurs de vérification
        'auth/requires-recent-login': "Cette action nécessite une reconnexion récente.",
        
        // Erreurs de suppression
        'auth/account-exists-with-different-credential': "Un compte existe déjà avec les mêmes informations.",
        
        // Erreurs réseau
        'auth/network-request-failed': "Erreur réseau. Vérifiez votre connexion.",
        
        // Erreurs diverses
        'auth/invalid-user-token': "Session invalide. Veuillez vous reconnecter.",
        'auth/user-token-expired': "Session expirée. Veuillez vous reconnecter.",
        'auth/null-user': "Aucun utilisateur n'est connecté.",
        'auth/invalid-credential': "Identifiants invalides.",
        'auth/invalid-verification-code': "Code de vérification invalide.",
        'auth/invalid-verification-id': "ID de vérification invalide.",
    };
    
    return messages[errorCode] || "Une erreur inattendue est survenue. Veuillez réessayer.";
}

/**
 * Vérification du cache de session au chargement
 */
export function checkSessionCache() {
    const user = auth.currentUser;
    if (!user) return;

    const cachedProfile = sessionStorage.getItem(`userProfile_${user.uid}`);
    if (cachedProfile) {
        console.log("Cache: Session initialisée depuis le cache");
        setState({ 
            currentUser: user, 
            userProfile: JSON.parse(cachedProfile), 
            isLoggedIn: true 
        });
    }
}