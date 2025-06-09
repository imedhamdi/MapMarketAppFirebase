"use strict";
// CHEMIN : functions/src/index.ts
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupinactiveusers = exports.onimageupload = exports.onfavoritewrite = exports.onreviewcreate = exports.onmessagecreate = exports.onadwrite = exports.onusercreate = void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// Importer toutes les fonctions pour les exporter
const auth_js_1 = require("./auth.js");
Object.defineProperty(exports, "onusercreate", { enumerable: true, get: function () { return auth_js_1.onusercreate; } });
const firestoreTriggers_js_1 = require("./firestoreTriggers.js");
Object.defineProperty(exports, "onadwrite", { enumerable: true, get: function () { return firestoreTriggers_js_1.onadwrite; } });
Object.defineProperty(exports, "onmessagecreate", { enumerable: true, get: function () { return firestoreTriggers_js_1.onmessagecreate; } });
Object.defineProperty(exports, "onreviewcreate", { enumerable: true, get: function () { return firestoreTriggers_js_1.onreviewcreate; } });
Object.defineProperty(exports, "onfavoritewrite", { enumerable: true, get: function () { return firestoreTriggers_js_1.onfavoritewrite; } });
const storageTriggers_js_1 = require("./storageTriggers.js");
Object.defineProperty(exports, "onimageupload", { enumerable: true, get: function () { return storageTriggers_js_1.onimageupload; } });
const scheduled_js_1 = require("./scheduled.js");
Object.defineProperty(exports, "cleanupinactiveusers", { enumerable: true, get: function () { return scheduled_js_1.cleanupinactiveusers; } });
//# sourceMappingURL=index.js.map