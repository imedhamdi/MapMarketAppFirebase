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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressUploadedImage = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const sharp_1 = __importDefault(require("sharp"));
// ⚠️ Remplacer par le nom de votre bucket Storage !
const BUCKET_NAME = 'mapmarket-app.appspot.com';
// 3️⃣ Compression d'images
exports.compressUploadedImage = functions
    .region('europe-west1')
    .runWith({ timeoutSeconds: 300, memory: '1GB' }) // Allouer plus de ressources pour le traitement d'image
    .storage.bucket(BUCKET_NAME)
    .object()
    .onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;
    // 🔟 Log d'usage
    functions.logger.log(`[Storage Trigger] File detected: ${filePath}`);
    if (!filePath || !(contentType === null || contentType === void 0 ? void 0 : contentType.startsWith('image/')) || path.basename(filePath).startsWith('thumb_')) {
        functions.logger.log('Not an image or already a thumbnail. Exiting function.');
        return null;
    }
    const bucket = admin.storage().bucket(object.bucket);
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
    try {
        await bucket.file(filePath).download({ destination: tempFilePath });
        functions.logger.log('Image downloaded to temporary directory.', tempFilePath);
        // Compresser l'image
        const compressedBuffer = await (0, sharp_1.default)(tempFilePath)
            .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toBuffer();
        // Remplacer le fichier original par sa version compressée
        await bucket.file(filePath).save(compressedBuffer, { metadata: { contentType: 'image/jpeg' } });
        functions.logger.info(`[Image Compression] Successfully compressed ${filePath}.`);
    }
    catch (error) {
        functions.logger.error('[Image Compression] Failed.', error);
    }
    finally {
        // Nettoyer le fichier temporaire
        fs.unlinkSync(tempFilePath);
    }
    return null;
});
//# sourceMappingURL=storageTriggers.js.map