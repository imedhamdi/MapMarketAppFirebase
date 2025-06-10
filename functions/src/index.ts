import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

// CORRECTION : Import des noms de fonctions corrects
import { onUserCreate } from "./auth";
import { 
  onAdCreated,
  onAdUpdated,
  onAdDeleted,
  onMessageCreated,
  onReviewCreated,
  onFavoriteWritten
} from "./firestoreTriggers";
import { compressUploadedImage } from "./storageTriggers";
import { cleanupOrphanedImages } from "./scheduled";

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
