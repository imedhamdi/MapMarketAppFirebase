// CHEMIN : functions/src/scheduled.ts

import * as functions from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

export const cleanupinactiveusers = functions.onSchedule({
    schedule: "every 30 days",
    region: "europe-west1",
}, async (event) => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const inactiveThreshold = admin.firestore.Timestamp.fromDate(sixMonthsAgo);

    logger.info(`Lancement du nettoyage des utilisateurs inactifs avant ${sixMonthsAgo.toISOString()}`);

    const inactiveUsersQuery = admin.firestore()
        .collection("users")
        .where("lastSeen", "<", inactiveThreshold);

    try {
        const snapshot = await inactiveUsersQuery.get();
        if (snapshot.empty) {
            logger.info("Aucun utilisateur inactif à nettoyer.");
            return;
        }

        const userIdsToDelete: string[] = snapshot.docs.map(doc => doc.id);

        // Supprimer les documents Firestore en batch
        const batch = admin.firestore().batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        logger.info(`${userIdsToDelete.length} documents utilisateur Firestore supprimés.`);

        // Supprimer les comptes Firebase Auth
        for (const userId of userIdsToDelete) {
            try {
                await admin.auth().deleteUser(userId);
                logger.info(`Compte Auth de ${userId} supprimé.`);
            } catch (error) {
                logger.error(`Échec de la suppression du compte Auth de ${userId}`, error);
            }
        }
    } catch (error) {
        logger.error("Erreur lors du nettoyage des utilisateurs inactifs:", error);
    }
});