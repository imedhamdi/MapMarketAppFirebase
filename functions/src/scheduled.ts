import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Fonction planifiée pour s'exécuter tous les 30 jours.
 * Identifie et supprime les utilisateurs inactifs depuis plus de 6 mois.
 * ATTENTION: Action destructive. À utiliser avec précaution.
 */
export const cleanupInactiveUsers = functions
    .region("europe-west1")
    .pubsub.schedule("every 30 days")
    .onRun(async (context) => {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const inactiveThreshold = admin.firestore.Timestamp.fromDate(sixMonthsAgo);

        functions.logger.info(`Lancement du nettoyage des utilisateurs inactifs avant ${sixMonthsAgo.toISOString()}`);

        const inactiveUsersQuery = admin.firestore()
            .collection("users")
            .where("lastSeen", "<", inactiveThreshold);

        try {
            const snapshot = await inactiveUsersQuery.get();
            if (snapshot.empty) {
                functions.logger.info("Aucun utilisateur inactif à nettoyer.");
                return null;
            }

            const batch = admin.firestore().batch();
            const userIdsToDelete: string[] = [];

            snapshot.forEach((doc) => {
                const userId = doc.id;
                functions.logger.warn(`Utilisateur ${userId} marqué pour suppression.`);
                userIdsToDelete.push(userId);
                // On pourrait ici archiver les données avant de les supprimer
                batch.delete(doc.ref);
            });

            // Supprimer les documents Firestore
            await batch.commit();
            functions.logger.info(`${userIdsToDelete.length} documents utilisateur Firestore supprimés.`);

            // Supprimer les comptes Firebase Auth
            // Note: Ceci ne déclenche PAS les onDelete triggers de Firestore/Storage.
            // Le nettoyage des données associées doit être fait manuellement.
            for (const userId of userIdsToDelete) {
                try {
                    await admin.auth().deleteUser(userId);
                    functions.logger.info(`Compte Auth de ${userId} supprimé.`);
                } catch (error) {
                    functions.logger.error(`Échec de la suppression du compte Auth de ${userId}`, error);
                }
            }

            return {
                message: `Nettoyage terminé. ${userIdsToDelete.length} utilisateurs inactifs traités.`
            };
        } catch (error) {
            functions.logger.error("Erreur lors du nettoyage des utilisateurs inactifs:", error);
            return null;
        }
    });

