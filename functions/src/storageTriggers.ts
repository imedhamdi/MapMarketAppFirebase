import { onObjectFinalized } from 'firebase-functions/v2/storage';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import sharp from 'sharp';

// ⚠️ Remplacer par le nom de votre bucket Storage !
const BUCKET_NAME = 'mapmarket-app.appspot.com'; 

// 3️⃣ Compression d'images
export const compressUploadedImage = onObjectFinalized({
        region: 'europe-west1',
        memory: '1GiB',
        timeoutSeconds: 300,
        bucket: BUCKET_NAME
    }, async (event) => {
        const object = event.data;
        const filePath = object.name;
        const contentType = object.contentType;

        // 🔟 Log d'usage
        logger.log(`[Storage Trigger] File detected: ${filePath}`);

        if (!filePath || !contentType?.startsWith('image/') || path.basename(filePath).startsWith('thumb_')) {
            logger.log('Not an image or already a thumbnail. Exiting function.');
            return null;
        }

        const bucket = admin.storage().bucket(object.bucket);
        const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));

        try {
            await bucket.file(filePath).download({ destination: tempFilePath });
            logger.log('Image downloaded to temporary directory.', tempFilePath);

            // Compresser l'image
            const compressedBuffer = await sharp(tempFilePath)
                .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80, progressive: true })
                .toBuffer();

            // Remplacer le fichier original par sa version compressée
            await bucket.file(filePath).save(compressedBuffer, { metadata: { contentType: 'image/jpeg' } });
            logger.info(`[Image Compression] Successfully compressed ${filePath}.`);

        } catch (error) {
            logger.error('[Image Compression] Failed.', error);
        } finally {
            // Nettoyer le fichier temporaire
             fs.unlinkSync(tempFilePath);
        }
        
        return null;
    });
