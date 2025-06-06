/**
 * Fichier utilitaire pour la validation avancée des données côté serveur.
 * Ces fonctions peuvent être appelées depuis les Cloud Functions avant d'écrire en base.
 */

interface ValidationResult {
    isValid: boolean;
    message?: string;
}

/**
 * Valide les données d'une annonce.
 * @param {any} data Les données à valider.
 * @returns {ValidationResult} Le résultat de la validation.
 */
export function validateAdData(data: any): ValidationResult {
    if (!data.title || data.title.length < 5 || data.title.length > 100) {
        return { isValid: false, message: "Le titre est invalide." };
    }
    if (!data.price || typeof data.price !== "number" || data.price < 0) {
        return { isValid: false, message: "Le prix est invalide." };
    }
    if (!data.categoryId) {
        return { isValid: false, message: "La catégorie est requise." };
    }
    // ... autres validations ...
    return { isValid: true };
}

// Ajouter d'autres fonctions de validation au besoin...

