import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

// CORRECTION : Import des noms de fonctions corrects
import { onUserCreate } from "./auth.js";
import { 
  onAdCreated,
  onAdUpdated,
  onAdDeleted,
  onMessageCreated,
  onReviewCreated,
  onFavoriteWritten
} from "./firestoreTriggers.js";
import { compressUploadedImage } from "./storageTriggers.js";
import { cleanupOrphanedImages } from "./scheduled.js";

// CORRECTION : Export des fonctions avec les bons noms
export {
  // Auth
  onUserCreate,
  
  // Firestore
  onAdCreated,
  onAdUpdated,
  onAdDeleted,
  onMessageCreated,
  onReviewCreated,
  onFavoriteWritten,
  
  // Storage
  compressUploadedImage,
  
  // Scheduled
  cleanupOrphanedImages
};