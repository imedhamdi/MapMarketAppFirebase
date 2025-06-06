/**
 * Fichier utilitaire pour les fonctions géographiques.
 */
import { GeoPoint } from "firebase-admin/firestore";

/**
 * Calcule la distance en kilomètres entre deux points GeoPoint (formule de Haversine).
 * @param {GeoPoint} coords1 Premier point.
 * @param {GeoPoint} coords2 Second point.
 * @returns {number} Distance en kilomètres.
 */
export function getDistance(coords1: GeoPoint, coords2: GeoPoint): number {
    if (!coords1 || !coords2) {
        return Infinity;
    }

    const R = 6371; // Rayon de la Terre en km
    const dLat = toRad(coords2.latitude - coords1.latitude);
    const dLon = toRad(coords2.longitude - coords1.longitude);
    const lat1 = toRad(coords1.latitude);
    const lat2 = toRad(coords2.latitude);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

/**
 * Convertit des degrés en radians.
 * @param {number} value Valeur en degrés.
 * @returns {number} Valeur en radians.
 */
function toRad(value: number): number {
    return (value * Math.PI) / 180;
}

