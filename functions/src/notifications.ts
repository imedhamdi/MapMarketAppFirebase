// CHEMIN : functions/src/notifications.ts

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getDistance } from "./utils/geo";
import { MulticastMessage } from "firebase-admin/messaging";

const db = admin.firestore();
const messaging = admin.messaging();

export async function sendNewMessageNotification(
    messageData: admin.firestore.DocumentData,
    participants: string[],
    chatId: string
) {
    const senderId = messageData.senderId;
    const recipients = participants.filter((p) => p !== senderId);

    if (recipients.length === 0) return;

    const senderDoc = await db.collection("users").doc(senderId).get();
    const senderName = senderDoc.data()?.username || "Quelqu'un";

    const tokens: string[] = [];
    for (const recipientId of recipients) {
        const userDoc = await db.collection("users").doc(recipientId).get();
        const userData = userDoc.data();
        if (userData?.fcmTokens && userData.settings?.notifications?.pushEnabled) {
            tokens.push(...userData.fcmTokens);
        }
    }

    if (tokens.length === 0) {
        functions.logger.info("Aucun token FCM trouvé pour les destinataires.");
        return;
    }

    const payload: MulticastMessage = {
        tokens,
        notification: {
            title: `Nouveau message de ${senderName}`,
            body: messageData.text.length > 100 ? `${messageData.text.substring(0, 97)}...` : messageData.text,
        },
        webpush: {
            notification: {
                icon: senderDoc.data()?.avatarUrl || "/assets/icons/icon-192x192.png",
            },
            fcmOptions: {
                link: `/messages?chatId=${chatId}`
            }
        },
        data: { type: "NEW_MESSAGE", chatId },
    };
    
    await messaging.sendEachForMulticast(payload).catch((error: Error) => {
        functions.logger.error("Erreur d'envoi de notif message:", error);
    });
}

export async function sendAlertsForNewAd(adData: admin.firestore.DocumentData, adId: string) {
    const usersSnapshot = await db.collection("users").get();
    if (usersSnapshot.empty) return;

    for (const userDoc of usersSnapshot.docs) {
        const alertsSnapshot = await userDoc.ref.collection("alerts").where("active", "==", true).get();
        if (alertsSnapshot.empty) continue;

        const userData = userDoc.data();
        if (!userData.fcmTokens || userData.fcmTokens.length === 0 || !userData.settings?.notifications?.pushEnabled) {
            continue;
        }

        for (const alertDoc of alertsSnapshot.docs) {
            const alert = alertDoc.data();
            if (doesAdMatchAlert(adData, alert)) {
                const payload: MulticastMessage = {
                    tokens: userData.fcmTokens,
                    notification: {
                        title: "Nouvelle annonce pour votre alerte !",
                        body: adData.title,
                    },
                    webpush: {
                        notification: {
                           icon: adData.images?.[0] || "/assets/icons/icon-192x192.png",
                        },
                        fcmOptions: {
                            link: `/ad/${adId}`
                        }
                    },
                    data: { type: "NEW_AD_ALERT", adId: adId },
                };
                
                await messaging.sendEachForMulticast(payload).catch((error: Error) => {
                     functions.logger.error(`Erreur d'envoi notif alerte à ${userDoc.id}`, error);
                });
                break; 
            }
        }
    }
}

function doesAdMatchAlert(ad: any, alert: any): boolean {
    if (alert.categoryId && ad.categoryId !== alert.categoryId) {
        return false;
    }

    const adText = `${ad.title.toLowerCase()} ${ad.description.toLowerCase()}`;
    const keywordsMatch = alert.keywords.some((kw: string) => adText.includes(kw.toLowerCase()));
    if (alert.keywords && alert.keywords.length > 0 && !keywordsMatch) {
        return false;
    }

    if (alert.location && alert.radius && ad.location?.coordinates) {
        const distance = getDistance(ad.location.coordinates, alert.location);
        if (distance > alert.radius) {
            return false;
        }
    }
    
    return true;
}

export async function sendAdFavoritedNotification(sellerId: string, adTitle: string, adId: string) {
    const sellerDoc = await db.collection('users').doc(sellerId).get();
    const sellerData = sellerDoc.data();
    if (!sellerData?.fcmTokens || sellerData.fcmTokens.length === 0 || !sellerData.settings?.notifications?.pushEnabled) return;

    const payload: MulticastMessage = {
        tokens: sellerData.fcmTokens,
        notification: {
            title: 'Nouveau favori',
            body: `${adTitle} a été ajouté aux favoris par un utilisateur`,
        },
        webpush: {
            notification: {
                icon: sellerData.avatarUrl || '/assets/icons/icon-192x192.png',
            },
            fcmOptions: {
                link: `/ad/${adId}`
            }
        },
        data: { type: 'FAVORITED', adId }
    };

    await messaging.sendEachForMulticast(payload).catch((err: Error) => {
        functions.logger.error('Erreur envoi notif favori', err);
    });
}