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
exports.sendAdFavoritedNotification = exports.sendAlertsForNewAd = exports.sendNewMessageNotification = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const geo_1 = require("./utils/geo");
const db = admin.firestore();
const messaging = admin.messaging();
/**
 * Envoie une notification push pour un nouveau message.
 * @param messageData Données du message.
 * @param participants IDs des participants au chat.
 * @param chatId L'ID du chat pour le lien profond.
 */
async function sendNewMessageNotification(messageData, participants, chatId) {
    var _a, _b, _c, _d;
    const senderId = messageData.senderId;
    const recipients = participants.filter((p) => p !== senderId);
    if (recipients.length === 0)
        return;
    const senderDoc = await db.collection("users").doc(senderId).get();
    const senderName = ((_a = senderDoc.data()) === null || _a === void 0 ? void 0 : _a.username) || "Quelqu'un";
    const tokens = [];
    for (const recipientId of recipients) {
        const userDoc = await db.collection("users").doc(recipientId).get();
        const userData = userDoc.data();
        if ((userData === null || userData === void 0 ? void 0 : userData.fcmTokens) && ((_c = (_b = userData.settings) === null || _b === void 0 ? void 0 : _b.notifications) === null || _c === void 0 ? void 0 : _c.pushEnabled)) {
            tokens.push(...userData.fcmTokens);
        }
    }
    if (tokens.length === 0) {
        functions.logger.info("Aucun token FCM trouvé pour les destinataires.");
        return;
    }
    const payload = {
        notification: {
            title: `Nouveau message de ${senderName}`,
            body: messageData.text.length > 100 ? `${messageData.text.substring(0, 97)}...` : messageData.text,
            icon: ((_d = senderDoc.data()) === null || _d === void 0 ? void 0 : _d.avatarUrl) || "/assets/icons/icon-192x192.png",
            click_action: `/messages?chatId=${chatId}`,
        },
        data: { type: "NEW_MESSAGE", chatId: chatId },
    };
    await messaging.sendToDevice(tokens, payload).catch(error => {
        functions.logger.error("Erreur d'envoi de notif message:", error);
    });
}
exports.sendNewMessageNotification = sendNewMessageNotification;
/**
 * Cherche les alertes correspondantes à une nouvelle annonce et notifie les utilisateurs.
 * @param adData Données de la nouvelle annonce.
 * @param adId ID de la nouvelle annonce.
 */
async function sendAlertsForNewAd(adData, adId) {
    var _a, _b, _c;
    const usersSnapshot = await db.collection("users").get();
    if (usersSnapshot.empty)
        return;
    for (const userDoc of usersSnapshot.docs) {
        const alertsSnapshot = await userDoc.ref.collection("alerts").where("active", "==", true).get();
        if (alertsSnapshot.empty)
            continue;
        const userData = userDoc.data();
        if (!userData.fcmTokens || userData.fcmTokens.length === 0 || !((_b = (_a = userData.settings) === null || _a === void 0 ? void 0 : _a.notifications) === null || _b === void 0 ? void 0 : _b.pushEnabled)) {
            continue;
        }
        for (const alertDoc of alertsSnapshot.docs) {
            const alert = alertDoc.data();
            if (doesAdMatchAlert(adData, alert)) {
                const payload = {
                    notification: {
                        title: "Nouvelle annonce pour votre alerte !",
                        body: adData.title,
                        icon: ((_c = adData.images) === null || _c === void 0 ? void 0 : _c[0]) || "/assets/icons/icon-192x192.png",
                        click_action: `/ad/${adId}`,
                    },
                    data: { type: "NEW_AD_ALERT", adId: adId },
                };
                await messaging.sendToDevice(userData.fcmTokens, payload).catch(error => {
                    functions.logger.error(`Erreur d'envoi notif alerte à ${userDoc.id}`, error);
                });
                break;
            }
        }
    }
}
exports.sendAlertsForNewAd = sendAlertsForNewAd;
function doesAdMatchAlert(ad, alert) {
    var _a;
    if (alert.categoryId && ad.categoryId !== alert.categoryId) {
        return false;
    }
    const adText = `${ad.title.toLowerCase()} ${ad.description.toLowerCase()}`;
    const keywordsMatch = alert.keywords.some((kw) => adText.includes(kw.toLowerCase()));
    if (alert.keywords && alert.keywords.length > 0 && !keywordsMatch) {
        return false;
    }
    if (alert.location && alert.radius && ((_a = ad.location) === null || _a === void 0 ? void 0 : _a.coordinates)) {
        const distance = (0, geo_1.getDistance)(ad.location.coordinates, alert.location);
        if (distance > alert.radius) {
            return false;
        }
    }
    return true;
}
/**
 * Notifie le vendeur lorsqu'une annonce est ajoutée aux favoris.
 */
async function sendAdFavoritedNotification(sellerId, adTitle, adId) {
    var _a, _b;
    const sellerDoc = await db.collection('users').doc(sellerId).get();
    const sellerData = sellerDoc.data();
    if (!(sellerData === null || sellerData === void 0 ? void 0 : sellerData.fcmTokens) || !((_b = (_a = sellerData.settings) === null || _a === void 0 ? void 0 : _a.notifications) === null || _b === void 0 ? void 0 : _b.pushEnabled))
        return;
    const payload = {
        notification: {
            title: 'Nouveau favori',
            body: `${adTitle} a été ajouté à un favori`,
            icon: sellerData.avatarUrl || '/assets/icons/icon-192x192.png',
            click_action: `/ad/${adId}`
        },
        data: { type: 'FAVORITED', adId }
    };
    await messaging.sendToDevice(sellerData.fcmTokens, payload).catch(err => {
        functions.logger.error('Erreur envoi notif favori', err);
    });
}
exports.sendAdFavoritedNotification = sendAdFavoritedNotification;
//# sourceMappingURL=notifications.js.map