// CHEMIN : functions/src/firestoreTriggers.ts

import * as functions from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { indexAd, updateAd, deleteAd } from "./algolia";
import { sendAlertsForNewAd, sendNewMessageNotification, sendAdFavoritedNotification } from "./notifications";
import { validateAdData } from './utils/validation';

const db = admin.firestore();
const storage = admin.storage();

export const onadwrite = functions.onDocumentWritten({ document: "ads/{adId}", region: "europe-west1" }, async (event) => {
    const adId = event.params.adId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // Suppression
    if (!event.data?.after.exists) {
        if (!beforeData) return;
        await Promise.all([
            deleteAd(adId),
            db.collection("categories").doc(beforeData.categoryId).update({ adCount: admin.firestore.FieldValue.increment(-1) }),
            db.collection("users").doc(beforeData.sellerId).update({ 'stats.adsCount': admin.firestore.FieldValue.increment(-1) }),
            storage.bucket().deleteFiles({ prefix: `ads/${beforeData.sellerId}/${adId}/` }).catch(e => logger.error(`Echec de la suppression des fichiers pour l'annonce ${adId}`, e))
        ]);
        logger.info(`Annonce ${adId} et fichiers associés supprimés.`);
        return;
    }

    // Création
    if (!event.data?.before.exists) {
        if (!afterData) return;
        const validation = validateAdData(afterData);
        if (!validation.isValid) {
            logger.error(`Données de l'annonce ${adId} invalides:`, validation.message);
            await db.collection('ads').doc(adId).delete();
            return;
        }
        await Promise.all([
            indexAd(afterData, adId),
            db.collection("users").doc(afterData.sellerId).update({ 'stats.adsCount': admin.firestore.FieldValue.increment(1) }),
            db.collection("categories").doc(afterData.categoryId).update({ adCount: admin.firestore.FieldValue.increment(1) }),
            sendAlertsForNewAd(afterData, adId)
        ]);
        return;
    }
    
    // Mise à jour
    if(beforeData && afterData) {
        await updateAd(afterData, adId);
        if (beforeData.categoryId !== afterData.categoryId) {
            const batch = db.batch();
            batch.update(db.collection("categories").doc(beforeData.categoryId), { adCount: admin.firestore.FieldValue.increment(-1) });
            batch.update(db.collection("categories").doc(afterData.categoryId), { adCount: admin.firestore.FieldValue.increment(1) });
            await batch.commit();
        }
    }
});

export const onmessagecreate = functions.onDocumentCreated({ document: "chats/{chatId}/messages/{messageId}", region: "europe-west1" }, async (event) => {
    const messageData = event.data?.data();
    if (!messageData) return;
    
    const { chatId } = event.params;
    const chatRef = db.collection("chats").doc(chatId);
    
    const chatDoc = await chatRef.get();
    const chatData = chatDoc.data();

    if (chatData?.participants) {
        await sendNewMessageNotification(messageData, chatData.participants, chatId);
    }

    await chatRef.update({
        lastMessage: {
            text: messageData.text,
            senderId: messageData.senderId,
            sentAt: messageData.sentAt,
            read: false,
        },
        updatedAt: messageData.sentAt,
    });
});

export const onreviewcreate = functions.onDocumentCreated({ document: "reviews/{reviewId}", region: "europe-west1" }, async (event) => {
    const reviewData = event.data?.data();
    if (!reviewData) return;
    
    const { targetType, targetId, rating } = reviewData;
    const targetRef = db.collection(targetType === 'user' ? 'users' : 'ads').doc(targetId);

    return db.runTransaction(async (transaction) => {
        const targetDoc = await transaction.get(targetRef);
        if (!targetDoc.exists) return;
        
        const data = targetDoc.data();
        if(!data || !data.stats) return;

        const oldStats = data.stats.reviews || { count: 0, sum: 0 };
        const newCount = oldStats.count + 1;
        const newSum = oldStats.sum + rating;
        
        transaction.update(targetRef, {
            'stats.averageRating': newSum / newCount,
            'stats.reviews': { count: newCount, sum: newSum },
        });
    });
});

export const onfavoritewrite = functions.onDocumentWritten({ document: "users/{userId}/favorites/{adId}", region: 'europe-west1' }, async (event) => {
    const { userId, adId } = event.params;
    const adRef = db.collection('ads').doc(adId);
    const userRef = db.collection('users').doc(userId);

    // Cas 1 : Un favori est AJOUTÉ
    if (!event.data?.before.exists && event.data?.after.exists) {
        logger.info(`Utilisateur ${userId} a ajouté l'annonce ${adId} en favori.`);
        await db.runTransaction(async tx => {
            tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(1) });
            tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(1) });
        });
        const adSnap = await adRef.get();
        const adData = adSnap.data();
        if (adData && adData.sellerId && adData.sellerId !== userId) {
            await sendAdFavoritedNotification(adData.sellerId, adData.title, adId);
        }
    // Cas 2: Un favori est SUPPRIMÉ
    } else if (event.data?.before.exists && !event.data?.after.exists) {
        logger.info(`Utilisateur ${userId} a retiré l'annonce ${adId} de ses favoris.`);
        await db.runTransaction(async tx => {
            tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(-1) });
            tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(-1) });
        });
    }
});