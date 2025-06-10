import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// 7️⃣ Nettoyage des fichiers orphelins du Storage
export const cleanupOrphanedImages = functions
    .region('europe-west1')
    .pubsub.schedule('every 24 hours') // S'exécute tous les jours
    .onRun(async (context) => {
        // 🔟 Log d'usage
        functions.logger.info('[Scheduled Cleanup] Starting orphaned image cleanup job.');

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
                    functions.logger.log(`[Scheduled Cleanup] Deleted orphaned file: ${file.name}`);
                } catch (error) {
                    functions.logger.error(`[Scheduled Cleanup] Failed to delete ${file.name}`, error);
                }
            }
        });

        await Promise.all(deletionPromises);
        functions.logger.info(`[Scheduled Cleanup] Job finished. Deleted ${deletedCount} orphaned files.`);
        return null;
    });