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
exports.onReviewCreate = exports.onMessageCreate = exports.onAdWrite = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const algolia_1 = require("./algolia");
const notifications_1 = require("./notifications");
const db = admin.firestore();
const storage = admin.storage();
exports.onAdWrite = functions
    .region("europe-west1")
    .firestore.document("ads/{adId}")
    .onWrite(async (change, context) => {
    const adId = context.params.adId;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    // Suppression
    if (!change.after.exists) {
        if (!beforeData)
            return;
        await Promise.all([
            (0, algolia_1.deleteAd)(adId),
            db.collection("categories").doc(beforeData.categoryId).update({ adCount: admin.firestore.FieldValue.increment(-1) }),
            storage.bucket().deleteFiles({ prefix: `ads/${adId}/` })
        ]);
        return;
    }
    // Création
    if (!change.before.exists) {
        if (!afterData)
            return;
        await Promise.all([
            (0, algolia_1.indexAd)(afterData, adId),
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
exports.onMessageCreate = functions
    .region("europe-west1")
    .firestore.document("chats/{chatId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
    const messageData = snap.data();
    if (!messageData)
        return;
    const { chatId } = context.params;
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
exports.onReviewCreate = functions
    .region("europe-west1")
    .firestore.document("reviews/{reviewId}")
    .onCreate(async (snap) => {
    const reviewData = snap.data();
    if (!reviewData)
        return;
    const { targetType, targetId, rating } = reviewData;
    const targetRef = db.collection(targetType === 'user' ? 'users' : 'ads').doc(targetId);
    return db.runTransaction(async (transaction) => {
        const targetDoc = await transaction.get(targetRef);
        if (!targetDoc.exists)
            return;
        const data = targetDoc.data();
        if (!data)
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
//# sourceMappingURL=firestoreTriggers.js.map