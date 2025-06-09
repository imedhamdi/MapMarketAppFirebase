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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexAd = indexAd;
exports.updateAd = updateAd;
exports.deleteAd = deleteAd;
const functions = __importStar(require("firebase-functions"));
const algoliasearch_1 = __importDefault(require("algoliasearch"));
// Récupérer la configuration Algolia depuis les variables d'environnement des fonctions
// `firebase functions:config:set algolia.app_id="VOTRE_ID" algolia.api_key="VOTRE_CLE" ...`
const APP_ID = functions.config().algolia.app_id;
const ADMIN_KEY = functions.config().algolia.api_key;
const INDEX_NAME = functions.config().algolia.index_name;
const client = (0, algoliasearch_1.default)(APP_ID, ADMIN_KEY);
const index = client.initIndex(INDEX_NAME);
/**
 * Formate les données d'une annonce pour Algolia.
 * @param {FirebaseFirestore.DocumentData} adData Données de l'annonce depuis Firestore.
 * @returns {object} Objet formaté pour Algolia.
 */
function formatAdForAlgolia(adData) {
    const algoliaRecord = {
        title: adData.title,
        description: adData.description,
        categoryId: adData.categoryId,
        price: adData.price,
        imageUrl: adData.images ? adData.images[0] : null, // On indexe juste la première image
        status: adData.status,
        sellerId: adData.sellerId,
        createdAt: adData.createdAt.toMillis(), // Algolia préfère les timestamps numériques
    };
    // Ajoute les coordonnées géographiques si elles existent
    if (adData.location && adData.location.coordinates) {
        algoliaRecord._geoloc = {
            lat: adData.location.coordinates.latitude,
            lng: adData.location.coordinates.longitude,
        };
    }
    return algoliaRecord;
}
/**
 * Indexe une nouvelle annonce dans Algolia.
 * @param {FirebaseFirestore.DocumentData} adData Données de l'annonce.
 * @param {string} adId ID de l'annonce.
 */
async function indexAd(adData, adId) {
    functions.logger.info(`Indexation de l'annonce ${adId} dans Algolia.`);
    const record = formatAdForAlgolia(adData);
    record.objectID = adId;
    try {
        await index.saveObject(record);
        functions.logger.info(`Annonce ${adId} indexée avec succès.`);
    }
    catch (error) {
        functions.logger.error(`Erreur lors de l'indexation de l'annonce ${adId}:`, error);
    }
}
/**
 * Met à jour une annonce dans l'index Algolia.
 * @param {FirebaseFirestore.DocumentData} adData Données de l'annonce.
 * @param {string} adId ID de l'annonce.
 */
async function updateAd(adData, adId) {
    functions.logger.info(`Mise à jour de l'annonce ${adId} dans Algolia.`);
    const record = formatAdForAlgolia(adData);
    record.objectID = adId;
    try {
        await index.partialUpdateObject(record, { createIfNotExists: true });
        functions.logger.info(`Annonce ${adId} mise à jour avec succès.`);
    }
    catch (error) {
        functions.logger.error(`Erreur lors de la mise à jour de l'annonce ${adId}:`, error);
    }
}
/**
 * Supprime une annonce de l'index Algolia.
 * @param {string} adId ID de l'annonce.
 */
async function deleteAd(adId) {
    functions.logger.info(`Suppression de l'annonce ${adId} d'Algolia.`);
    try {
        await index.deleteObject(adId);
        functions.logger.info(`Annonce ${adId} supprimée avec succès de l'index.`);
    }
    catch (error) {
        functions.logger.error(`Erreur lors de la suppression de l'annonce ${adId}:`, error);
    }
}
//# sourceMappingURL=algolia.js.map