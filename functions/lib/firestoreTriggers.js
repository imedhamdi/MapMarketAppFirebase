"use strict";
// CHEMIN : functions/src/firestoreTriggers.ts
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onfavoritewrite = exports.onreviewcreate = exports.onmessagecreate = exports.onadwrite = void 0;
const functions = __importStar(require("firebase-functions/v2/firestore"));
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const algolia_1 = require("./algolia");
const notifications_1 = require("./notifications");
const validation_1 = require("./utils/validation");
const db = admin.firestore();
const storage = admin.storage();
exports.onadwrite = functions.onDocumentWritten({ document: "ads/{adId}", region: "europe-west1" }, async (event) => {
    var _a, _b, _c, _d;
    const adId = event.params.adId;
    const beforeData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const afterData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    // Suppression
    if (!((_c = event.data) === null || _c === void 0 ? void 0 : _c.after.exists)) {
        if (!beforeData)
            return;
        await Promise.all([
            (0, algolia_1.deleteAd)(adId),
            db.collection("categories").doc(beforeData.categoryId).update({ adCount: admin.firestore.FieldValue.increment(-1) }),
            db.collection("users").doc(beforeData.sellerId).update({ 'stats.adsCount': admin.firestore.FieldValue.increment(-1) }),
            storage.bucket().deleteFiles({ prefix: `ads/${beforeData.sellerId}/${adId}/` }).catch(e => logger.error(`Echec de la suppression des fichiers pour l'annonce ${adId}`, e))
        ]);
        logger.info(`Annonce ${adId} et fichiers associés supprimés.`);
        return;
    }
    // Création
    if (!((_d = event.data) === null || _d === void 0 ? void 0 : _d.before.exists)) {
        if (!afterData)
            return;
        const validation = (0, validation_1.validateAdData)(afterData);
        if (!validation.isValid) {
            logger.error(`Données de l'annonce ${adId} invalides:`, validation.message);
            await db.collection('ads').doc(adId).delete();
            return;
        }
        await Promise.all([
            (0, algolia_1.indexAd)(afterData, adId),
            db.collection("users").doc(afterData.sellerId).update({ 'stats.adsCount': admin.firestore.FieldValue.increment(1) }),
            db.collection("categories").doc(afterData.categoryId).update({ adCount: admin.firestore.FieldValue.increment(1) }),
            (0, notifications_1.sendAlertsForNewAd)(afterData, adId)
        ]);
        return;
    }
    // Mise à jour
    if (beforeData && afterData) {
        await (0, algolia_1.updateAd)(afterData, adId);
        if (beforeData.categoryId !== afterData.categoryId) {
            const batch = db.batch();
            batch.update(db.collection("categories").doc(beforeData.categoryId), { adCount: admin.firestore.FieldValue.increment(-1) });
            batch.update(db.collection("categories").doc(afterData.categoryId), { adCount: admin.firestore.FieldValue.increment(1) });
            await batch.commit();
        }
    }
});
exports.onmessagecreate = functions.onDocumentCreated({ document: "chats/{chatId}/messages/{messageId}", region: "europe-west1" }, async (event) => {
    var _a;
    const messageData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!messageData)
        return;
    const { chatId } = event.params;
    const chatRef = db.collection("chats").doc(chatId);
    const chatDoc = await chatRef.get();
    const chatData = chatDoc.data();
    if (chatData === null || chatData === void 0 ? void 0 : chatData.participants) {
        await (0, notifications_1.sendNewMessageNotification)(messageData, chatData.participants, chatId);
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
exports.onreviewcreate = functions.onDocumentCreated({ document: "reviews/{reviewId}", region: "europe-west1" }, async (event) => {
    var _a;
    const reviewData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!reviewData)
        return;
    const { targetType, targetId, rating } = reviewData;
    const targetRef = db.collection(targetType === 'user' ? 'users' : 'ads').doc(targetId);
    return db.runTransaction(async (transaction) => {
        const targetDoc = await transaction.get(targetRef);
        if (!targetDoc.exists)
            return;
        const data = targetDoc.data();
        if (!data || !data.stats)
            return;
        const oldStats = data.stats.reviews || { count: 0, sum: 0 };
        const newCount = oldStats.count + 1;
        const newSum = oldStats.sum + rating;
        transaction.update(targetRef, {
            'stats.averageRating': newSum / newCount,
            'stats.reviews': { count: newCount, sum: newSum },
        });
    });
});
exports.onfavoritewrite = functions.onDocumentWritten({ document: "users/{userId}/favorites/{adId}", region: 'europe-west1' }, async (event) => {
    var _a, _b, _c, _d;
    const { userId, adId } = event.params;
    const adRef = db.collection('ads').doc(adId);
    const userRef = db.collection('users').doc(userId);
    // Cas 1 : Un favori est AJOUTÉ
    if (!((_a = event.data) === null || _a === void 0 ? void 0 : _a.before.exists) && ((_b = event.data) === null || _b === void 0 ? void 0 : _b.after.exists)) {
        logger.info(`Utilisateur ${userId} a ajouté l'annonce ${adId} en favori.`);
        await db.runTransaction(async (tx) => {
            tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(1) });
            tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(1) });
        });
        const adSnap = await adRef.get();
        const adData = adSnap.data();
        if (adData && adData.sellerId && adData.sellerId !== userId) {
            await (0, notifications_1.sendAdFavoritedNotification)(adData.sellerId, adData.title, adId);
        }
        // Cas 2: Un favori est SUPPRIMÉ
    }
    else if (((_c = event.data) === null || _c === void 0 ? void 0 : _c.before.exists) && !((_d = event.data) === null || _d === void 0 ? void 0 : _d.after.exists)) {
        logger.info(`Utilisateur ${userId} a retiré l'annonce ${adId} de ses favoris.`);
        await db.runTransaction(async (tx) => {
            tx.update(adRef, { 'stats.favorites': admin.firestore.FieldValue.increment(-1) });
            tx.update(userRef, { 'stats.favoritesCount': admin.firestore.FieldValue.increment(-1) });
        });
    }
});
//# sourceMappingURL=firestoreTriggers.js.map