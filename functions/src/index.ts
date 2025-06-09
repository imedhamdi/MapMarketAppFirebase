// CHEMIN : functions/src/index.ts

import * as admin from "firebase-admin";

admin.initializeApp();

// Importer toutes les fonctions pour les exporter
import { onusercreate } from "./auth.js";
import { onadwrite, onmessagecreate, onreviewcreate, onfavoritewrite } from "./firestoreTriggers.js";
import { onimageupload } from "./storageTriggers.js";
import { cleanupinactiveusers } from "./scheduled.js";

// Exporter toutes les fonctions pour le déploiement
export {
    onusercreate,
    onadwrite,
    onmessagecreate,
    onreviewcreate,
    onfavoritewrite,
    onimageupload,
    cleanupinactiveusers
};