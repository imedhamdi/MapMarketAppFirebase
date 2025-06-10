import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';

// 7️⃣ Nettoyage des fichiers orphelins du Storage
export const cleanupOrphanedImages = onSchedule({ region: 'europe-west1', schedule: 'every 24 hours' }, async () => {
        // 🔟 Log d'usage
        logger.info('[Scheduled Cleanup] Starting orphaned image cleanup job.');

        const bucket = admin.storage().bucket();
        const [files] = await bucket.getFiles({ prefix: 'ad-images/' }); // Assurez-vous que le préfixe est correct

        const activeImageUrls = new Set<string>();
        const adsSnapshot = await admin.firestore().collection('ads').select('imageUrl').get();
        adsSnapshot.forEach(doc => {
            const imageUrl = doc.data().imageUrl;
            if (imageUrl) {
                activeImageUrls.add(imageUrl);
            }
        });

        let deletedCount = 0;
        const deletionPromises = files.map(async (file) => {
            const fileUrl = file.publicUrl();
            if (!activeImageUrls.has(fileUrl)) {
                try {
                    await file.delete();
                    deletedCount++;
                    logger.log(`[Scheduled Cleanup] Deleted orphaned file: ${file.name}`);
                } catch (error) {
                    logger.error(`[Scheduled Cleanup] Failed to delete ${file.name}`, error);
                }
            }
        });

        await Promise.all(deletionPromises);
        logger.info(`[Scheduled Cleanup] Job finished. Deleted ${deletedCount} orphaned files.`);
        return null;
    });

// 8️⃣ Suppression des utilisateurs inactifs
export const cleanupInactiveUsers = onSchedule({ region: 'europe-west1', schedule: 'every 24 hours' }, async () => {
        logger.info('[Scheduled Cleanup] Starting inactive users cleanup.');
        const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 1000 * 60 * 60 * 24 * 30);
        const usersSnap = await admin.firestore().collection('users').where('lastSeen', '<', cutoff).get();

        let removed = 0;
        for (const doc of usersSnap.docs) {
            try {
                await admin.auth().deleteUser(doc.id);
                await doc.ref.delete();
                removed++;
                logger.log(`[Scheduled Cleanup] Removed inactive user ${doc.id}`);
            } catch (err) {
                logger.error(`[Scheduled Cleanup] Failed to remove user ${doc.id}`, err);
            }
        }
        logger.info(`[Scheduled Cleanup] Inactive users cleanup done. Deleted ${removed} users.`);
        return null;
    });
