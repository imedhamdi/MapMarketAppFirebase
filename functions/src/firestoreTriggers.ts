import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { indexAd, updateAd, deleteAd } from "./algolia";
import { sendAlertsForNewAd, sendNewMessageNotification } from "./notifications";

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
            if (!beforeData) return;
            await Promise.all([
                deleteAd(adId),
                db.collection("categories").doc(beforeData.categoryId).update({ adCount: admin.firestore.FieldValue.increment(-1) }),
                storage.bucket().deleteFiles({ prefix: `ads/${adId}/` })
            ]);
            return;
        }

        // Création
        if (!change.before.exists) {
            if (!afterData) return;
            await Promise.all([
                indexAd(afterData, adId),
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

export const onMessageCreate = functions
    .region("europe-west1")
    .firestore.document("chats/{chatId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
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
