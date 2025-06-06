// /functions/src/storageTriggers.ts

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as path from "path";
import * as os from "os";
import * as fs from "fs-extra";
import sharp from "sharp";

const THUMB_PREFIX = "thumb@";
const THUMB_SIZES = [100, 400]; // Miniatures 100x100 et 400x400

/**
 * Génère automatiquement des miniatures pour les images d'annonces.
 */
export const onImageUpload = functions
  .region("europe-west1")
  .storage.object()
  .onFinalize(async (object) => {
    try {
      const { bucket, name, contentType, metadata, size } = object;

      if (!name || !contentType || metadata?.resized) {
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

        await sharp(tempFilePath)
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

    } catch (error) {
      functions.logger.error("❌ Erreur onImageUpload :", error);
      return null;
    }
  });
