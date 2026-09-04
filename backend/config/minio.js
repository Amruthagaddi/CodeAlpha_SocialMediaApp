const Minio = require('minio');
const fs = require('fs');
const path = require('path');

const endpoint = process.env.MINIO_ENDPOINT || '127.0.0.1';
const port = parseInt(process.env.MINIO_PORT || '9000', 10);
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const bucketName = process.env.MINIO_BUCKET_NAME || 'mitra-media';
const useSSL = process.env.MINIO_USE_SSL === 'true';

const minioClient = new Minio.Client({
  endPoint: endpoint,
  port: port,
  useSSL: useSSL,
  accessKey: accessKey,
  secretKey: secretKey
});

let isMinioAvailable = false;

const initMinio = async () => {
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName, 'us-east-1');
      console.log(`MinIO bucket '${bucketName}' created successfully.`);
    }

    // Set public download policy for the bucket
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`]
        }
      ]
    };

    await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    console.log(`MinIO connected and bucket policy set for '${bucketName}'.`);
    isMinioAvailable = true;
  } catch (error) {
    console.warn(`Warning: Could not connect to MinIO server at ${endpoint}:${port} (${error.message}). Local media storage fallback enabled.`);
    isMinioAvailable = false;
  }
};

/**
 * Upload buffer to MinIO bucket (or local media fallback if MinIO server is offline)
 */
const uploadToMinio = async (fileBuffer, objectName, contentType) => {
  if (isMinioAvailable) {
    try {
      const metaData = {
        'Content-Type': contentType
      };
      await minioClient.putObject(bucketName, objectName, fileBuffer, fileBuffer.length, metaData);
      return `/api/media/${objectName}`;
    } catch (err) {
      console.error(`MinIO PutObject Error for ${objectName}:`, err.message);
    }
  }

  // Fallback storage inside uploads/ directory if MinIO connection fails
  const localDir = path.join(__dirname, '../../uploads', path.dirname(objectName));
  fs.mkdirSync(localDir, { recursive: true });
  const localFilePath = path.join(__dirname, '../../uploads', objectName);
  fs.writeFileSync(localFilePath, fileBuffer);
  return `/api/media/${objectName}`;
};

/**
 * Helper to get public URL / Object key reference
 */
const getMinioUrl = (objectName) => {
  if (!objectName) return null;
  if (objectName.startsWith('http://') || objectName.startsWith('https://')) {
    return objectName;
  }
  return `/api/media/${objectName.replace(/^\/+/, '')}`;
};

module.exports = {
  minioClient,
  initMinio,
  uploadToMinio,
  getMinioUrl,
  bucketName,
  isMinioAvailable: () => isMinioAvailable
};
