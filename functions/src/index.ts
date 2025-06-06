/**
 * Fichier d'entrée principal pour les Cloud Functions de MapMarket.
 * Ce fichier importe et ré-exporte toutes les fonctions depuis leurs modules respectifs.
 */

import * as admin from "firebase-admin";

// Initialise l'application Firebase Admin une seule fois.
admin.initializeApp();

// --- Import et Export des Fonctions ---

// Fonctions liées à l'authentification (création d'utilisateur)
import { onUserCreate } from "./auth";
export { onUserCreate };

// Fonctions déclenchées par Firestore (annonces, messages, avis)
import { onAdWrite, onMessageCreate, onReviewCreate, onFavoriteWrite } from "./firestoreTriggers";
export { onAdWrite, onMessageCreate, onReviewCreate, onFavoriteWrite };

// Fonctions planifiées (cron jobs)
import { cleanupInactiveUsers } from "./scheduled";
export { cleanupInactiveUsers };

