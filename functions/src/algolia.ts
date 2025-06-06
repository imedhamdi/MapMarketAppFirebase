import * as functions from "firebase-functions";
import algoliasearch from "algoliasearch";

// Récupérer la configuration Algolia depuis les variables d'environnement des fonctions
// `firebase functions:config:set algolia.app_id="VOTRE_ID" algolia.api_key="VOTRE_CLE" ...`
const APP_ID = functions.config().algolia.app_id;
const ADMIN_KEY = functions.config().algolia.api_key;
const INDEX_NAME = functions.config().algolia.index_name;

const client = algoliasearch(APP_ID, ADMIN_KEY);
const index = client.initIndex(INDEX_NAME);

/**
 * Formate les données d'une annonce pour Algolia.
 * @param {FirebaseFirestore.DocumentData} adData Données de l'annonce depuis Firestore.
 * @returns {object} Objet formaté pour Algolia.
 */
function formatAdForAlgolia(adData: FirebaseFirestore.DocumentData) {
    const algoliaRecord: any = {
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
export async function indexAd(adData: FirebaseFirestore.DocumentData, adId: string) {
    functions.logger.info(`Indexation de l'annonce ${adId} dans Algolia.`);
    const record = formatAdForAlgolia(adData);
    record.objectID = adId;

    try {
        await index.saveObject(record);
        functions.logger.info(`Annonce ${adId} indexée avec succès.`);
    } catch (error) {
        functions.logger.error(`Erreur lors de l'indexation de l'annonce ${adId}:`, error);
    }
}

/**
 * Met à jour une annonce dans l'index Algolia.
 * @param {FirebaseFirestore.DocumentData} adData Données de l'annonce.
 * @param {string} adId ID de l'annonce.
 */
export async function updateAd(adData: FirebaseFirestore.DocumentData, adId: string) {
    functions.logger.info(`Mise à jour de l'annonce ${adId} dans Algolia.`);
    const record = formatAdForAlgolia(adData);
    record.objectID = adId;
    
    try {
        await index.partialUpdateObject(record, { createIfNotExists: true });
        functions.logger.info(`Annonce ${adId} mise à jour avec succès.`);
    } catch (error) {
        functions.logger.error(`Erreur lors de la mise à jour de l'annonce ${adId}:`, error);
    }
}

/**
 * Supprime une annonce de l'index Algolia.
 * @param {string} adId ID de l'annonce.
 */
export async function deleteAd(adId: string) {
    functions.logger.info(`Suppression de l'annonce ${adId} d'Algolia.`);
    try {
        await index.deleteObject(adId);
        functions.logger.info(`Annonce ${adId} supprimée avec succès de l'index.`);
    } catch (error) {
        functions.logger.error(`Erreur lors de la suppression de l'annonce ${adId}:`, error);
    }
}
