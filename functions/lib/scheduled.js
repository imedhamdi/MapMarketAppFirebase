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
exports.cleanupOrphanedImages = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// 7️⃣ Nettoyage des fichiers orphelins du Storage
exports.cleanupOrphanedImages = functions
    .region('europe-west1')
    .pubsub.schedule('every 24 hours') // S'exécute tous les jours
    .onRun(async (context) => {
    // 🔟 Log d'usage
    functions.logger.info('[Scheduled Cleanup] Starting orphaned image cleanup job.');
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'ad-images/' }); // Assurez-vous que le préfixe est correct
    const activeImageUrls = new Set();
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
            }
            catch (error) {
                functions.logger.error(`[Scheduled Cleanup] Failed to delete ${file.name}`, error);
            }
        }
    });
    await Promise.all(deletionPromises);
    functions.logger.info(`[Scheduled Cleanup] Job finished. Deleted ${deletedCount} orphaned files.`);
    return null;
});
//# sourceMappingURL=scheduled.js.map