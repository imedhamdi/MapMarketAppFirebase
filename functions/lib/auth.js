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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserCreate = void 0;
// src/auth.ts
const functions = __importStar(require("firebase-functions"));
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    var _a;
    logger.info(`Nouvel utilisateur créé: ${user.uid}, email: ${user.email}`);
    const newUserRef = db.collection("users").doc(user.uid);
    try {
        await newUserRef.set({
            uid: user.uid,
            username: user.displayName || ((_a = user.email) === null || _a === void 0 ? void 0 : _a.split("@")[0]) || `user_${user.uid.substring(0, 5)}`,
            email: user.email,
            avatarUrl: user.photoURL || "",
            registrationDate: admin.firestore.FieldValue.serverTimestamp(),
            stats: { adsCount: 0, favoritesCount: 0, averageRating: 0, reviews: { count: 0, sum: 0 } },
            settings: { darkMode: false, language: "fr", notifications: { pushEnabled: true, emailEnabled: true } },
            lastSeen: admin.firestore.FieldValue.serverTimestamp(),
            fcmTokens: [],
        });
        logger.info(`Document utilisateur créé avec succès pour ${user.uid}`);
    }
    catch (error) {
        logger.error(`Erreur lors de la création du document pour l'utilisateur ${user.uid}:`, error);
    }
});
//# sourceMappingURL=auth.js.map