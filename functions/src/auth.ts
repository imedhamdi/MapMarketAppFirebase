import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Se déclenche à la création d'un nouvel utilisateur Firebase Auth.
 * 1. Crée un document utilisateur correspondant dans Firestore avec des valeurs par défaut.
 * 2. L'envoi de l'email de vérification est géré côté client ou automatiquement par Firebase.
 */
export const onUserCreate = functions
    .region("europe-west1")
    .auth.user()
    .onCreate(async (user) => {
        functions.logger.info(`Nouvel utilisateur créé: ${user.uid}, email: ${user.email}`);

        const newUserRef = db.collection("users").doc(user.uid);

        try {
            await newUserRef.set({
                uid: user.uid,
                username: user.displayName || user.email?.split("@")[0] || `user_${user.uid.substring(0, 5)}`,
                email: user.email,
                avatarUrl: user.photoURL || "", // Peut être vide initialement
                registrationDate: admin.firestore.FieldValue.serverTimestamp(),
                stats: {
                    adsCount: 0,
                    favoritesCount: 0,
                    averageRating: 0,
                },
                settings: {
                    darkMode: false,
                    language: "fr",
                    notifications: {
                        pushEnabled: true,
                        emailEnabled: true,
                    },
                },
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                fcmTokens: [], // Pour stocker les jetons de notification
            });
            functions.logger.info(`Document utilisateur créé avec succès pour ${user.uid}`);
        } catch (error) {
            functions.logger.error(`Erreur lors de la création du document pour l'utilisateur ${user.uid}:`, error);
        }
    });

