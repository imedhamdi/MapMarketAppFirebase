"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onFavoriteWritten = exports.onReviewCreated = exports.onMessageCreated = exports.onAdDeleted = exports.onAdUpdated = exports.onAdCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
// Importez uniquement les fonctions de notification et de validation nécessaires
const notifications_1 = require("./notifications");
const validation_1 = require("./utils/validation");
const db = admin.firestore();
/**
 * Trigger pour la CRÉATION d'une annonce.
 */
exports.onAdCreated = (0, firestore_1.onDocumentCreated)({ document: "ads/{adId}", region: "europe-central2" }, async (event) => {
    var _a;
    const adId = event.params.adId;
    const adData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!adData) {
        logger.error(`[onCreate Ad] Données manquantes pour l'annonce ${adId}.`);
        return;
    }
    const validation = (0, validation_1.validateAdData)(adData);
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
        (0, notifications_1.sendAlertsForNewAd)(adData, adId)
    ]);
});
/**
 * Trigger pour la MISE À JOUR d'une annonce.
 */
exports.onAdUpdated = (0, firestore_1.onDocumentWritten)({ document: "ads/{adId}", region: "europe-central2" }, async (event) => {
    var _a, _b;
    if (!((_a = event.data) === null || _a === void 0 ? void 0 : _a.before.exists) || !((_b = event.data) === null || _b === void 0 ? void 0 : _b.after.exists)) {
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
exports.onAdDeleted = (0, firestore_1.onDocumentWritten)({ document: "ads/{adId}", region: "europe-central2" }, async (event) => {
    var _a, _b;
    if (((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.exists) || !((_b = event.data) === null || _b === void 0 ? void 0 : _b.before.exists)) {
        return;
    }
    const adId = event.params.adId;
    const deletedAd = event.data.before.data();
    if (!deletedAd)
        return;
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
exports.onMessageCreated = (0, firestore_1.onDocumentCreated)({ document: "chats/{chatId}/messages/{messageId}", region: "europe-central2" }, async (event) => {
    var _a;
    const messageData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!messageData)
        return;
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
    const sendNotificationPromise = (chatData === null || chatData === void 0 ? void 0 : chatData.participants)
        ? (0, notifications_1.sendNewMessageNotification)(messageData, chatData.participants, chatId)
        : Promise.resolve();
    await Promise.all([updateChatPromise, sendNotificationPromise]);
});
/**
 * Trigger sur la création d'un avis (review).
 */
exports.onReviewCreated = (0, firestore_1.onDocumentCreated)({ document: "reviews/{reviewId}", region: "europe-central2" }, async (event) => {
    var _a;
    const reviewData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!reviewData)
        return;
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
        if (!(data === null || data === void 0 ? void 0 : data.stats)) {
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
exports.onFavoriteWritten = (0, firestore_1.onDocumentWritten)({ document: "users/{userId}/favorites/{adId}", region: 'europe-central2' }, async (event) => {
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
        const updateCountsPromise = db.runTransaction(async (tx) => {
            tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(1) });
            tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(1) });
        });
        const adSnap = await adRef.get();
        const adData = adSnap.data();
        const sendNotificationPromise = ((adData === null || adData === void 0 ? void 0 : adData.sellerId) && adData.sellerId !== userId)
            ? (0, notifications_1.sendAdFavoritedNotification)(adData.sellerId, adData.title, adId)
            : Promise.resolve();
        await Promise.all([updateCountsPromise, sendNotificationPromise]);
        // Cas 2: Un favori est SUPPRIMÉ
    }
    else if (event.data.before.exists && !event.data.after.exists) {
        logger.info(`[onFavorite] ${userId} a retiré ${adId} de ses favoris.`);
        await db.runTransaction(async (tx) => {
            tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(-1) });
            tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(-1) });
        });
    }
});
//# sourceMappingURL=firestoreTriggers.js.map