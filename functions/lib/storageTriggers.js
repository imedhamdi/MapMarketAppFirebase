"use strict";
// /functions/src/storageTriggers.ts
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onImageUpload = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs-extra"));
const sharp_1 = __importDefault(require("sharp"));
const THUMB_PREFIX = "thumb@";
const THUMB_SIZES = [100, 400]; // Miniatures 100x100 et 400x400
/**
 * Génère automatiquement des miniatures pour les images d'annonces.
 */
exports.onImageUpload = functions
    .region("europe-west1")
    .storage.object()
    .onFinalize(async (object) => {
    try {
        const { bucket, name, contentType, metadata, size } = object;
        if (!name || !contentType || (metadata === null || metadata === void 0 ? void 0 : metadata.resized)) {
            functions.logger.log("⛔ Fichier invalide ou déjà redimensionné.");
            return null;
        }
        if (!name.startsWith("ads/") || !contentType.startsWith("image/")) {
            functions.logger.log(`ℹ️ Ignoré : ${name} n'est pas une image d'annonce.`);
            return null;
        }
        const fileSize = Number(size);
        if (fileSize && fileSize > 10 * 1024 * 1024) {
            functions.logger.warn(`⚠️ Fichier trop volumineux (${fileSize} octets), ignoré.`);
            return null;
        }
        const storageBucket = admin.storage().bucket(bucket);
        const fileName = path.basename(name);
        const fileDir = path.dirname(name);
        const tempFilePath = path.join(os.tmpdir(), fileName);
        await storageBucket.file(name).download({ destination: tempFilePath });
        functions.logger.log(`📥 Téléchargé dans ${tempFilePath}`);
        const uploadPromises = THUMB_SIZES.map(async (s) => {
            const thumbFileName = `${THUMB_PREFIX}${s}_${fileName}`;
            const thumbFilePath = path.join(os.tmpdir(), thumbFileName);
            await (0, sharp_1.default)(tempFilePath)
                .resize(s, s, { fit: "inside" })
                .toFile(thumbFilePath);
            const dest = path.join(fileDir, "thumbs", thumbFileName);
            await storageBucket.upload(thumbFilePath, {
                destination: dest,
                metadata: {
                    contentType,
                    metadata: { resized: "true" },
                },
            });
            functions.logger.log(`✅ Miniature ${s}px uploadée : ${dest}`);
        });
        await Promise.all(uploadPromises);
        await fs.remove(tempFilePath);
        functions.logger.log(`🧹 Nettoyage terminé : ${tempFilePath}`);
        return null;
    }
    catch (error) {
        functions.logger.error("❌ Erreur onImageUpload :", error);
        return null;
    }
});
//# sourceMappingURL=storageTriggers.js.map