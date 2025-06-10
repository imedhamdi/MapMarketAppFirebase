/**
 * =================================================================
 * MAPMARKET - COUCHE DE SERVICES (services.js)
 * =================================================================
 * @file Ce fichier est la seule porte d'entrée vers la base de données et le stockage.
 * Il abstrait toute la logique de communication avec Firebase pour que le reste de
 * l'application n'ait qu'à appeler des fonctions claires et explicites.
 * @version 2.1.0
 */

import { db, storage, auth } from './firebase.js';
import {
    doc, getDoc, setDoc, addDoc, collection, getDocs, onSnapshot,
    serverTimestamp, query, where, orderBy, deleteDoc,
    updateDoc, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// --- Services Utilisateur ---

/**
 * Récupère le profil d'un utilisateur depuis Firestore.
 * @param {string} userId - L'ID de l'utilisateur.
 * @returns {Promise<object|null>} Le profil de l'utilisateur (avec son ID) ou null.
 */
export const fetchUserProfile = async (userId) => {
    if (!userId) return null;
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    // CORRECTION : Inclure l'ID du document dans l'objet retourné.
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

/**
 * Met à jour les données d'un profil utilisateur.
 * @param {string} userId - L'ID de l'utilisateur.
 * @param {object} data - Les données à mettre à jour.
 */
export const updateUserProfile = (userId, data) => {
    const userDocRef = doc(db, "users", userId);
    return updateDoc(userDocRef, data);
};


// --- Services d'Annonces ---

export const fetchCategories = async () => {
    try {
        const q = query(collection(db, "categories"), orderBy("name_fr"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Erreur lors de la récupération des catégories :", error);
        return []; // Retourne un tableau vide en cas d'erreur pour éviter de planter l'app.
    }
};

// OPTIMISATION : Ajout d'une fonction paginée utilisant limit() et startAfter()
export const fetchAds = async (filters = {}, cursor = null, perPage = 20) => {
    let q = query(collection(db, "ads"), where("status", "==", "active"));
    if (filters.category) {
        q = query(q, where("categoryId", "==", filters.category));
    }

    const sortBy = filters.sortBy || "createdAt_desc";
    const [sortField, sortDirection] = sortBy.split('_');
    q = query(q, orderBy(sortField, sortDirection), limit(perPage));

    if (cursor) {
        q = query(q, startAfter(cursor));
    }

    const snapshot = await getDocs(q);
    return {
        ads: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
        lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
    };
};

/**
 * AJOUT : Récupère les annonces postées par un utilisateur spécifique.
 * @param {string} userId - L'ID de l'utilisateur.
 * @returns {Promise<Array>} Une liste des annonces de l'utilisateur.
 */
export const fetchUserAds = async (userId, cursor = null, perPage = 20) => {
    if (!userId) return { ads: [], lastVisible: null };
    let q = query(
        collection(db, "ads"),
        where("sellerId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(perPage)
    );

    if (cursor) {
        q = query(q, startAfter(cursor));
    }

    const snapshot = await getDocs(q);
    return {
        ads: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
        lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
    };
};

/**
 * CORRECTION : Ajout d'un paramètre pour contrôler l'incrémentation des vues.
 */
export const fetchAdById = async (adId, incrementView = true) => {
    if (!adId) return null;
    const docRef = doc(db, "ads", adId);
    if (incrementView) {
        // Géré côté client pour la simplicité, mais pourrait être une fonction cloud.
        await updateDoc(docRef, { "stats.views": increment(1) }).catch(e => console.warn("Impossible d'incrémenter la vue", e));
    }
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const createAd = (adData) => {
    return addDoc(collection(db, "ads"), {
        ...adData,
        stats: { views: 0, favorites: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
};

export const updateAd = (adId, adData) => {
    const adRef = doc(db, "ads", adId);
    return updateDoc(adRef, { ...adData, updatedAt: serverTimestamp() });
};

export const deleteAd = (adId) => {
    // La Cloud Function onAdWrite s'occupera de nettoyer les images et les compteurs.
    return deleteDoc(doc(db, "ads", adId));
};


// --- Services de Stockage (Upload) ---

export const uploadAdImage = (file, userId) => {
    const filePath = `ads/${userId}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, filePath);
    return uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
};

/**
 * CORRECTION : Utilise un nom de fichier fixe pour écraser l'ancien avatar.
 */
export const uploadAvatar = (file, userId) => {
    const filePath = `avatars/${userId}/avatar`;
    const storageRef = ref(storage, filePath);
    return uploadBytes(storageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
};


// --- Services de Messagerie ---

export const fetchUserChats = async (userId) => {
    const q = query(collection(db, "chats"), where("participants", "array-contains", userId), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const listenToMessages = (chatId, callback) => {
    const q = query(collection(db, `chats/${chatId}/messages`), orderBy("sentAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
};

export const sendMessage = (chatId, text, senderId) => {
    const messagesColRef = collection(db, `chats/${chatId}/messages`);
    return addDoc(messagesColRef, { text, senderId, sentAt: serverTimestamp(), read: false });
};

export const createChat = async (adId, sellerId) => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid === sellerId) throw new Error("Action non autorisée.");
    
    const participants = [currentUser.uid, sellerId].sort();
    const q = query(collection(db, "chats"), where("adId", "==", adId), where("participants", "==", participants));
    const existingChats = await getDocs(q);
    
    if (!existingChats.empty) return existingChats.docs[0].id;
    
    const newChatRef = await addDoc(collection(db, "chats"), {
        participants, adId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        lastMessage: { text: "Nouvelle conversation.", senderId: currentUser.uid, sentAt: serverTimestamp(), read: false }
    });
    return newChatRef.id;
};


// --- Services de Favoris ---

// OPTIMISATION : Remplacement de onSnapshot par une récupération ponctuelle
export const fetchFavorites = async (userId) => {
    const favsColRef = collection(db, `users/${userId}/favorites`);
    const snap = await getDocs(favsColRef);
    return snap.docs.map(doc => doc.id);
};

export const toggleFavorite = (userId, adId, isCurrentlyFavorite) => {
    const favRef = doc(db, `users/${userId}/favorites`, adId);
    const adRef = doc(db, "ads", adId);
    const userRef = doc(db, "users", userId);
    
    return runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const adDoc = await transaction.get(adRef);
        if (!userDoc.exists() || !adDoc.exists()) throw "Document non trouvé";
        
        const favIncrement = isCurrentlyFavorite ? -1 : 1;
        
        if (isCurrentlyFavorite) {
            transaction.delete(favRef);
        } else {
            transaction.set(favRef, { adId, addedAt: serverTimestamp() });
        }
        
        transaction.update(adRef, { "stats.favorites": increment(favIncrement) });
        transaction.update(userRef, { "stats.favoritesCount": increment(favIncrement) });
    });
};


// --- Services d'Alertes ---

export const fetchAlerts = async (userId) => {
    const alertsColRef = collection(db, `users/${userId}/alerts`);
    const snapshot = await getDocs(alertsColRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createOrUpdateAlert = (userId, alertData, alertId) => {
    const finalData = { ...alertData, createdAt: serverTimestamp(), active: true };
    if (alertId) {
        return setDoc(doc(db, `users/${userId}/alerts`, alertId), finalData, { merge: true });
    } else {
        return addDoc(collection(db, `users/${userId}/alerts`), finalData);
    }
};

export const deleteAlert = (userId, alertId) => {
    return deleteDoc(doc(db, `users/${userId}/alerts`, alertId));
};


// --- Services d'Avis (Reviews) ---

export const createReview = (reviewData) => {
    // La Cloud Function `onReviewCreate` gère la mise à jour des notes moyennes.
    return addDoc(collection(db, "reviews"), {
        ...reviewData,
        reviewerId: auth.currentUser.uid,
        createdAt: serverTimestamp()
    });
};