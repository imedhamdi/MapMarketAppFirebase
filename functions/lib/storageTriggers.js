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
const THUMB_SIZES = [100, 400]; // Génère des miniatures de 100x100 et 400x400
/**
 * Se déclenche lorsqu'une nouvelle image est uploadée dans le Storage.
 * Crée des miniatures optimisées pour chaque image d'annonce.
 */
exports.onImageUpload = functions
    .region("europe-west1")
    .storage.object()
    .onFinalize(async (object) => {
    const { bucket, name, contentType, metadata } = object;
    // 1. Vérifications initiales
    if (!name || !contentType || (metadata === null || metadata === void 0 ? void 0 : metadata.resized)) {
        functions.logger.log("Sortie anticipée : Fichier invalide ou déjà redimensionné.");
        return null;
    }
    // Ne s'applique qu'aux images dans les dossiers d'annonces, pas aux avatars
    if (!name.startsWith("ads/") || !contentType.startsWith("image/")) {
        functions.logger.log("Ce n'est pas une image d'annonce, on ignore.");
        return null;
    }
    // 2. Téléchargement et préparation
    const storageBucket = admin.storage().bucket(bucket);
    const fileName = path.basename(name);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const fileDir = path.dirname(name);
    await storageBucket.file(name).download({ destination: tempFilePath });
    functions.logger.log(`Image ${fileName} téléchargée dans ${tempFilePath}`);
    // 3. Génération des miniatures
    const uploadPromises = THUMB_SIZES.map(async (size) => {
        const thumbFileName = `${THUMB_PREFIX}${size}_${fileName}`;
        const thumbFilePath = path.join(os.tmpdir(), thumbFileName);
        await (0, sharp_1.default)(tempFilePath).resize(size, size, { fit: 'inside' }).toFile(thumbFilePath);
        return storageBucket.upload(thumbFilePath, {
            destination: path.join(fileDir, "thumbs", thumbFileName),
            metadata: {
                contentType,
                metadata: { resized: true } // Marqueur pour éviter les boucles infinies
            },
        });
    });
    // 4. Exécution et nettoyage
    await Promise.all(uploadPromises);
    functions.logger.log("Toutes les miniatures ont été uploadées.");
    return fs.remove(tempFilePath);
});
//# sourceMappingURL=storageTriggers.js.map