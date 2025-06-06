// /functions/src/index.ts
import * as admin from "firebase-admin";

admin.initializeApp();

// --- Triggers d'Authentification ---
import { onUserCreate } from "./auth";
export { onUserCreate };

// --- Triggers Firestore ---
import { onAdWrite, onMessageCreate, onReviewCreate, onFavoriteWrite } from "./firestoreTriggers";
export { onAdWrite, onMessageCreate, onReviewCreate, onFavoriteWrite };

// --- Triggers Storage (NOUVEAU) ---
import { onImageUpload } from "./storageTriggers";
export { onImageUpload };

// --- Fonctions Planifiées ---
import { cleanupInactiveUsers } from "./scheduled";
export { cleanupInactiveUsers };