import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import sharp from 'sharp';

// ⚠️ Remplacer par le nom de votre bucket Storage !
const BUCKET_NAME = 'mapmarket-app.appspot.com'; 

// 3️⃣ Compression d'images
export const compressUploadedImage = functions
    .region('europe-west1')
    .runWith({ timeoutSeconds: 300, memory: '1GB' }) // Allouer plus de ressources pour le traitement d'image
    .storage.bucket(BUCKET_NAME)
    .object()
    .onFinalize(async (object) => {
        const filePath = object.name;
        const contentType = object.contentType;

        // 🔟 Log d'usage
        functions.logger.log(`[Storage Trigger] File detected: ${filePath}`);

        if (!filePath || !contentType?.startsWith('image/') || path.basename(filePath).startsWith('thumb_')) {
            functions.logger.log('Not an image or already a thumbnail. Exiting function.');
            return null;
        }

        const bucket = admin.storage().bucket(object.bucket);
        const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));

        try {
            await bucket.file(filePath).download({ destination: tempFilePath });
            functions.logger.log('Image downloaded to temporary directory.', tempFilePath);

            // Compresser l'image
            const compressedBuffer = await sharp(tempFilePath)
                .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80, progressive: true })
                .toBuffer();

            // Remplacer le fichier original par sa version compressée
            await bucket.file(filePath).save(compressedBuffer, { metadata: { contentType: 'image/jpeg' } });
            functions.logger.info(`[Image Compression] Successfully compressed ${filePath}.`);

        } catch (error) {
            functions.logger.error('[Image Compression] Failed.', error);
        } finally {
            // Nettoyer le fichier temporaire
             fs.unlinkSync(tempFilePath);
        }
        
        return null;
    });
