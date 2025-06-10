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
exports.cleanupOrphanedImages = exports.compressUploadedImage = exports.onFavoriteWritten = exports.onReviewCreated = exports.onMessageCreated = exports.onAdDeleted = exports.onAdUpdated = exports.onAdCreated = exports.onUserCreate = void 0;
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
// CORRECTION : Import des noms de fonctions corrects
const auth_1 = require("./auth");
Object.defineProperty(exports, "onUserCreate", { enumerable: true, get: function () { return auth_1.onUserCreate; } });
const firestoreTriggers_1 = require("./firestoreTriggers");
Object.defineProperty(exports, "onAdCreated", { enumerable: true, get: function () { return firestoreTriggers_1.onAdCreated; } });
Object.defineProperty(exports, "onAdUpdated", { enumerable: true, get: function () { return firestoreTriggers_1.onAdUpdated; } });
Object.defineProperty(exports, "onAdDeleted", { enumerable: true, get: function () { return firestoreTriggers_1.onAdDeleted; } });
Object.defineProperty(exports, "onMessageCreated", { enumerable: true, get: function () { return firestoreTriggers_1.onMessageCreated; } });
Object.defineProperty(exports, "onReviewCreated", { enumerable: true, get: function () { return firestoreTriggers_1.onReviewCreated; } });
Object.defineProperty(exports, "onFavoriteWritten", { enumerable: true, get: function () { return firestoreTriggers_1.onFavoriteWritten; } });
const storageTriggers_1 = require("./storageTriggers");
Object.defineProperty(exports, "compressUploadedImage", { enumerable: true, get: function () { return storageTriggers_1.compressUploadedImage; } });
const scheduled_1 = require("./scheduled");
Object.defineProperty(exports, "cleanupOrphanedImages", { enumerable: true, get: function () { return scheduled_1.cleanupOrphanedImages; } });
//# sourceMappingURL=index.js.map