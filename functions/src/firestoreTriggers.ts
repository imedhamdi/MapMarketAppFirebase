import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Importez uniquement les fonctions de notification et de validation nécessaires
import { sendAlertsForNewAd, sendNewMessageNotification, sendAdFavoritedNotification } from "./notifications";
import { validateAdData } from './utils/validation';

const db = admin.firestore();

/**
 * Trigger pour la CRÉATION d'une annonce.
 */
export const onAdCreated = onDocumentCreated({ document: "ads/{adId}", region: "europe-central2" }, async (event) => {
    const adId = event.params.adId;
    const adData = event.data?.data();

    if (!adData) {
        logger.error(`[onCreate Ad] Données manquantes pour l'annonce ${adId}.`);
        return;
    }

    const validation = validateAdData(adData);
    if (!validation.isValid) {
        logger.error(`[onCreate Ad] Données invalides pour ${adId}: ${validation.message}, suppression de l'annonce.`);
        await db.collection('ads').doc(adId).delete();
        return;
    }

    logger.info(`[onCreate Ad] Nouvelle annonce ${adId} créée et validée.`);

    const sellerRef = db.collection("users").doc(adData.sellerId);
    const categoryRef = db.collection("categories").doc(adData.categoryId);

    await Promise.all([
        sellerRef.update({ 'stats.adsCount': admin.firestore.FieldValue.increment(1) }),
        categoryRef.update({ adCount: admin.firestore.FieldValue.increment(1) }),
        sendAlertsForNewAd(adData, adId)
    ]);
});

/**
 * Trigger pour la MISE À JOUR d'une annonce.
 */
export const onAdUpdated = onDocumentWritten({ document: "ads/{adId}", region: "europe-central2" }, async (event) => {
    if (!event.data?.before.exists || !event.data?.after.exists) {
        return;
    }
    
    const adId = event.params.adId;
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    // CORRECTION : On vérifie que beforeData et afterData ne sont pas undefined
    if (!beforeData || !afterData) {
        logger.warn(`[onUpdate Ad] Données manquantes pour l'événement de mise à jour de l'annonce ${adId}.`);
        return;
    }

    logger.info(`[onUpdate Ad] Mise à jour détectée pour l'annonce ${adId}.`);

    if (beforeData.categoryId !== afterData.categoryId) {
        logger.info(`[onUpdate Ad] Changement de catégorie pour ${adId}.`);
        const batch = db.batch();
        batch.update(db.collection("categories").doc(beforeData.categoryId), { adCount: admin.firestore.FieldValue.increment(-1) });
        batch.update(db.collection("categories").doc(afterData.categoryId), { adCount: admin.firestore.FieldValue.increment(1) });
        await batch.commit();
    }
});

/**
 * Trigger pour la SUPPRESSION d'une annonce.
 */
export const onAdDeleted = onDocumentWritten({ document: "ads/{adId}", region: "europe-central2" }, async (event) => {
    if (event.data?.after.exists || !event.data?.before.exists) {
        return;
    }

    const adId = event.params.adId;
    const deletedAd = event.data.before.data();

    if (!deletedAd) return;

    logger.info(`[onDelete Ad] Suppression de l'annonce ${adId} et de ses ressources associées.`);

    const sellerRef = db.collection("users").doc(deletedAd.sellerId);
    const categoryRef = db.collection("categories").doc(deletedAd.categoryId);
    const bucket = admin.storage().bucket();
    const deleteFilesPromise = bucket.deleteFiles({ prefix: `ads/${deletedAd.sellerId}/${adId}/` })
        .catch(e => logger.error(`[onDelete Ad] Échec de la suppression des fichiers pour ${adId}`, e));

    await Promise.all([
        sellerRef.update({ 'stats.adsCount': admin.firestore.FieldValue.increment(-1) }),
        categoryRef.update({ adCount: admin.firestore.FieldValue.increment(-1) }),
        deleteFilesPromise
    ]);
});

/**
 * Trigger sur la création d'un message dans un chat.
 */
export const onMessageCreated = onDocumentCreated({ document: "chats/{chatId}/messages/{messageId}", region: "europe-central2" }, async (event) => {
    const messageData = event.data?.data();
    if (!messageData) return;
    
    const { chatId } = event.params;
    const chatRef = db.collection("chats").doc(chatId);
    
    logger.info(`[onMessageCreated] Nouveau message dans le chat ${chatId}.`);

    const updateChatPromise = chatRef.update({
        lastMessage: {
            text: messageData.text,
            senderId: messageData.senderId,
            sentAt: messageData.sentAt,
        },
        updatedAt: messageData.sentAt,
    });

    const chatDoc = await chatRef.get();
    const chatData = chatDoc.data();
    const sendNotificationPromise = (chatData?.participants) 
        ? sendNewMessageNotification(messageData, chatData.participants, chatId) 
        : Promise.resolve();

    await Promise.all([updateChatPromise, sendNotificationPromise]);
});

/**
 * Trigger sur la création d'un avis (review).
 */
export const onReviewCreated = onDocumentCreated({ document: "reviews/{reviewId}", region: "europe-central2" }, async (event) => {
    const reviewData = event.data?.data();
    if (!reviewData) return;
    
    const { targetType, targetId, rating } = reviewData;
    const targetRef = db.collection(targetType === 'user' ? 'users' : 'ads').doc(targetId);

    logger.info(`[onReviewCreated] Nouvel avis pour ${targetType} ${targetId}.`);

    return db.runTransaction(async (transaction) => {
        const targetDoc = await transaction.get(targetRef);
        if (!targetDoc.exists) {
            logger.warn(`[onReviewCreated] Cible ${targetId} non trouvée.`);
            return;
        }
        
        const data = targetDoc.data();
        if(!data?.stats) {
            logger.warn(`[onReviewCreated] La cible ${targetId} n'a pas de champ 'stats'.`);
            return;
        }

        const oldStats = data.stats.reviews || { count: 0, sum: 0 };
        const newCount = oldStats.count + 1;
        const newSum = oldStats.sum + rating;
        
        transaction.update(targetRef, {
            'stats.averageRating': newSum / newCount,
            'stats.reviews': { count: newCount, sum: newSum },
        });
    });
});

/**
 * Trigger sur l'ajout/suppression d'un favori.
 */
export const onFavoriteWritten = onDocumentWritten({ document: "users/{userId}/favorites/{adId}", region: 'europe-central2' }, async (event) => {
    const { userId, adId } = event.params;
    const adRef = db.collection('ads').doc(adId);
    const userRef = db.collection('users').doc(userId);

    // CORRECTION : On vérifie que event.data existe avant de l'utiliser.
    if (!event.data) {
        return;
    }

    // Cas 1 : Un favori est AJOUTÉ
    if (event.data.after.exists && !event.data.before.exists) {
        logger.info(`[onFavorite] ${userId} a ajouté ${adId} en favori.`);
        
        const updateCountsPromise = db.runTransaction(async tx => {
            tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(1) });
            tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(1) });
        });
        
        const adSnap = await adRef.get();
        const adData = adSnap.data();
        const sendNotificationPromise = (adData?.sellerId && adData.sellerId !== userId)
            ? sendAdFavoritedNotification(adData.sellerId, adData.title, adId)
            : Promise.resolve();

        await Promise.all([updateCountsPromise, sendNotificationPromise]);

    // Cas 2: Un favori est SUPPRIMÉ
    } else if (event.data.before.exists && !event.data.after.exists) {
        logger.info(`[onFavorite] ${userId} a retiré ${adId} de ses favoris.`);
        await db.runTransaction(async tx => {
            tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(-1) });
            tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(-1) });
        });
    }
});