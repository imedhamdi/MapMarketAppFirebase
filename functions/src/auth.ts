// CHEMIN : functions/src/auth.ts

import { onUserCreation, AuthEvent } from "firebase-functions/v2/auth";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const onusercreate = onUserCreation({ region: "europe-west1" }, async (event: AuthEvent): Promise<void> => {
    const user = event.data;
    logger.info(`Nouvel utilisateur créé: ${user.uid}, email: ${user.email}`);

    const newUserRef = db.collection("users").doc(user.uid);

    try {
        await newUserRef.set({
            uid: user.uid,
            username: user.displayName || user.email?.split("@")[0] || `user_${user.uid.substring(0, 5)}`,
            email: user.email,
            avatarUrl: user.photoURL || "",
            registrationDate: admin.firestore.FieldValue.serverTimestamp(),
            stats: { adsCount: 0, favoritesCount: 0, averageRating: 0, reviews: { count: 0, sum: 0 } },
            settings: { darkMode: false, language: "fr", notifications: { pushEnabled: true, emailEnabled: true } },
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            fcmTokens: [],
        });
        logger.info(`Document utilisateur créé avec succès pour ${user.uid}`);
    } catch (error) {
        logger.error(`Erreur lors de la création du document pour l'utilisateur ${user.uid}:`, error);
    }
});