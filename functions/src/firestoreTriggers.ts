// /functions/src/firestoreTriggers.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { indexAd, updateAd, deleteAd } from "./algolia";
import { sendAlertsForNewAd, sendNewMessageNotification, sendAdFavoritedNotification } from "./notifications";
import { validateAdData } from './utils/validation';

const db = admin.firestore();
const storage = admin.storage();

export const onAdWrite = functions
    .region("europe-west1")
    .firestore.document("ads/{adId}")
    .onWrite(async (change, context) => {
        const adId = context.params.adId;
        const beforeData = change.before.data();
        const afterData = change.after.data();

        // Suppression
        if (!change.after.exists) {
            if (!beforeData) return null; // Retourne null pour la cohérence
            await Promise.all([
                deleteAd(adId),
                db.collection("categories").doc(beforeData.categoryId).update({ adCount: admin.firestore.FieldValue.increment(-1) }),
                db.collection("users").doc(beforeData.sellerId).update({ 'stats.adsCount': admin.firestore.FieldValue.increment(-1) }),
                storage.bucket().deleteFiles({ prefix: `ads/${beforeData.sellerId}/${adId}/` })
            ]);
            functions.logger.info(`Annonce ${adId} et fichiers associés supprimés.`);
            return null;
        }

        // Création
        if (!change.before.exists) {
            if (!afterData) return null;

            const validation = validateAdData(afterData);
            if (!validation.isValid) {
                functions.logger.error(`Données de l'annonce ${adId} invalides:`, validation.message);
                return db.collection('ads').doc(adId).delete();
            }

            await Promise.all([
                indexAd(afterData, adId),
                db.collection("users").doc(afterData.sellerId).update({ 'stats.adsCount': admin.firestore.FieldValue.increment(1) }),
                db.collection("categories").doc(afterData.categoryId).update({ adCount: admin.firestore.FieldValue.increment(1) }),
                sendAlertsForNewAd(afterData, adId)
            ]);
            return null;
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

        // AJOUT: Le retour manquant qui corrige l'erreur
        return null;
    });

// ... (onMessageCreate et onReviewCreate restent identiques)
export const onMessageCreate = functions
    .region("europe-west1")
    .firestore.document("chats/{chatId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
        // Le code existant est correct
        const messageData = snap.data();
        if (!messageData) return;
        
        const { chatId } = context.params;
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

export const onReviewCreate = functions
    .region("europe-west1")
    .firestore.document("reviews/{reviewId}")
    .onCreate(async (snap) => {
        // Le code existant est correct
        const reviewData = snap.data();
        if (!reviewData) return;
        
        const { targetType, targetId, rating } = reviewData;
        const targetRef = db.collection(targetType === 'user' ? 'users' : 'ads').doc(targetId);

        return db.runTransaction(async (transaction) => {
            const targetDoc = await transaction.get(targetRef);
            if (!targetDoc.exists) return;
            
            const data = targetDoc.data();
            if(!data) return;

            const oldStats = data.stats.reviews || { count: 0, sum: 0 };
            const newCount = oldStats.count + 1;
            const newSum = oldStats.sum + rating;
            
            transaction.update(targetRef, {
                'stats.averageRating': newSum / newCount,
                'stats.reviews': { count: newCount, sum: newSum },
            });
        });
    });

// AJOUT COMPLET: Le trigger manquant pour les favoris
export const onFavoriteWrite = functions
    .region('europe-west1')
    .firestore.document('users/{userId}/favorites/{adId}')
    .onWrite(async (change, context) => {
        const { userId, adId } = context.params;
        const adRef = db.collection('ads').doc(adId);
        const userRef = db.collection('users').doc(userId);

        // Cas 1 : Un favori est AJOUTÉ
        if (!change.before.exists && change.after.exists) {
            functions.logger.info(`Utilisateur ${userId} a ajouté l'annonce ${adId} en favori.`);
            // Utilise une transaction pour garantir que les deux compteurs sont mis à jour
            await db.runTransaction(async tx => {
                tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(1) });
                tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(1) });
            });
            // Notifie le vendeur de l'annonce
            const adSnap = await adRef.get();
            const adData = adSnap.data();
            if (adData && adData.sellerId && adData.sellerId !== userId) {
                await sendAdFavoritedNotification(adData.sellerId, adData.title, adId);
            }
        // Cas 2: Un favori est SUPPRIMÉ
        } else if (change.before.exists && !change.after.exists) {
            functions.logger.info(`Utilisateur ${userId} a retiré l'annonce ${adId} de ses favoris.`);
            await db.runTransaction(async tx => {
                tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(-1) });
                tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(-1) });
            });
        }
    });