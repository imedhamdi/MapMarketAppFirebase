// /functions/src/storageTriggers.ts

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as path from "path";
import * as os from "os";
import * as fs from "fs-extra";
import sharp from "sharp";

const THUMB_PREFIX = "thumb@";
const THUMB_SIZES = [100, 400]; // Génère des miniatures de 100x100 et 400x400

/**
 * Se déclenche lorsqu'une nouvelle image est uploadée dans le Storage.
 * Crée des miniatures optimisées pour chaque image d'annonce.
 */
export const onImageUpload = functions
    .region("europe-west1")
    .storage.object()
    .onFinalize(async (object) => {
        const { bucket, name, contentType, metadata } = object;

        // 1. Vérifications initiales
        if (!name || !contentType || metadata?.resized) {
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

            await sharp(tempFilePath).resize(size, size, { fit: 'inside' }).toFile(thumbFilePath);

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