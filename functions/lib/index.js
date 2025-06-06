"use strict";
/**
 * Fichier d'entrée principal pour les Cloud Functions de MapMarket.
 * Ce fichier importe et ré-exporte toutes les fonctions depuis leurs modules respectifs.
 */
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupInactiveUsers = exports.onReviewCreate = exports.onMessageCreate = exports.onAdWrite = exports.onUserCreate = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialise l'application Firebase Admin une seule fois.
admin.initializeApp();
// --- Import et Export des Fonctions ---
// Fonctions liées à l'authentification (création d'utilisateur)
const auth_1 = require("./auth");
Object.defineProperty(exports, "onUserCreate", { enumerable: true, get: function () { return auth_1.onUserCreate; } });
// Fonctions déclenchées par Firestore (annonces, messages, avis)
const firestoreTriggers_1 = require("./firestoreTriggers");
Object.defineProperty(exports, "onAdWrite", { enumerable: true, get: function () { return firestoreTriggers_1.onAdWrite; } });
Object.defineProperty(exports, "onMessageCreate", { enumerable: true, get: function () { return firestoreTriggers_1.onMessageCreate; } });
Object.defineProperty(exports, "onReviewCreate", { enumerable: true, get: function () { return firestoreTriggers_1.onReviewCreate; } });
// Fonctions planifiées (cron jobs)
const scheduled_1 = require("./scheduled");
Object.defineProperty(exports, "cleanupInactiveUsers", { enumerable: true, get: function () { return scheduled_1.cleanupInactiveUsers; } });
//# sourceMappingURL=index.js.map