"use strict";
// CHEMIN : functions/src/scheduled.ts
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupinactiveusers = void 0;
const functions = __importStar(require("firebase-functions/v2/scheduler"));
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
exports.cleanupinactiveusers = functions.onSchedule({
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
        const userIdsToDelete = snapshot.docs.map(doc => doc.id);
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
            }
            catch (error) {
                logger.error(`Échec de la suppression du compte Auth de ${userId}`, error);
            }
        }
    }
    catch (error) {
        logger.error("Erreur lors du nettoyage des utilisateurs inactifs:", error);
    }
});
//# sourceMappingURL=scheduled.js.map