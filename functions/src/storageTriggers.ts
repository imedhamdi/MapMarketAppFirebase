// CHEMIN : functions/src/storageTriggers.ts

import * as functions from "firebase-functions/v2/storage";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as path from "path";
import * as os from "os";
import * as fs from "fs-extra";
import sharp from "sharp";

const THUMB_PREFIX = "thumb@";
const THUMB_SIZES = [100, 400];

export const onimageupload = functions.onObjectFinalized({ region: "europe-west1" }, async (event) => {
    const { bucket, name, contentType, metadata } = event.data;

    if (!name || !contentType || metadata?.resized) {
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

            await sharp(tempFilePath)
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
    } finally {
        // Nettoyage du fichier temporaire
        await fs.remove(tempFilePath);
    }
});