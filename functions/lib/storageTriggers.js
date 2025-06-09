"use strict";
// CHEMIN : functions/src/storageTriggers.ts
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onimageupload = void 0;
const functions = __importStar(require("firebase-functions/v2/storage"));
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs-extra"));
const sharp_1 = __importDefault(require("sharp"));
const THUMB_PREFIX = "thumb@";
const THUMB_SIZES = [100, 400];
exports.onimageupload = functions.onObjectFinalized({ region: "europe-west1" }, async (event) => {
    const { bucket, name, contentType, metadata } = event.data;
    if (!name || !contentType || (metadata === null || metadata === void 0 ? void 0 : metadata.resized)) {
        logger.log("⛔ Fichier invalide ou déjà redimensionné.");
        return;
    }
    if (!name.startsWith("ads/") || !contentType.startsWith("image/")) {
        logger.log(`ℹ️ Ignoré : ${name} n'est pas une image d'annonce.`);
        return;
    }
    const storageBucket = admin.storage().bucket(bucket);
    const fileName = path.basename(name);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    const fileDir = path.dirname(name);
    try {
        await storageBucket.file(name).download({ destination: tempFilePath });
        logger.log(`📥 Téléchargé dans ${tempFilePath}`);
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
                    metadata: { resized: "true" }, // Marqueur pour éviter les boucles
                },
            });
            logger.log(`✅ Miniature ${s}px uploadée : ${dest}`);
        });
        await Promise.all(uploadPromises);
    }
    finally {
        // Nettoyage du fichier temporaire
        await fs.remove(tempFilePath);
    }
});
//# sourceMappingURL=storageTriggers.js.map