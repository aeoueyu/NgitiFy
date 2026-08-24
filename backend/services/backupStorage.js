const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const normalizeText = (value) => String(value || '').trim();
const provider = normalizeText(process.env.BACKUP_STORAGE_PROVIDER || 'local').toLowerCase();
const localBackupDir = path.resolve(
    normalizeText(process.env.BACKUP_DIR) || path.join(__dirname, '..', 'backups')
);
const workingDirectory = provider === 'r2'
    ? path.join(os.tmpdir(), 'ngitify-database-backups')
    : localBackupDir;

const r2Config = {
    accountId: normalizeText(process.env.R2_ACCOUNT_ID),
    accessKeyId: normalizeText(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: normalizeText(process.env.R2_SECRET_ACCESS_KEY),
    bucket: normalizeText(process.env.R2_BUCKET_NAME),
    prefix: normalizeText(process.env.R2_BACKUP_PREFIX || 'database-backups').replace(/^\/+|\/+$/g, ''),
};

let r2Client;

const assertSupportedProvider = () => {
    if (!['local', 'r2'].includes(provider)) {
        throw new Error('BACKUP_STORAGE_PROVIDER must be either local or r2.');
    }
};

const getR2Client = () => {
    const missing = Object.entries(r2Config)
        .filter(([key, value]) => key !== 'prefix' && !value)
        .map(([key]) => key);
    if (missing.length > 0) {
        throw new Error(`R2 backup storage is missing configuration: ${missing.join(', ')}.`);
    }

    if (!r2Client) {
        r2Client = new S3Client({
            region: 'auto',
            endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: r2Config.accessKeyId,
                secretAccessKey: r2Config.secretAccessKey,
            },
        });
    }
    return r2Client;
};

const buildObjectKey = (filename) => (
    r2Config.prefix ? `${r2Config.prefix}/${filename}` : filename
);

const isNotFoundError = (error) => (
    error?.$metadata?.httpStatusCode === 404
    || ['NoSuchKey', 'NotFound'].includes(error?.name)
);

const resolveStorageProvider = (backup) => normalizeText(backup?.storageProvider || 'local').toLowerCase();
const resolveStorageKey = (backup) => normalizeText(backup?.storageKey) || buildObjectKey(backup.filename);

const ensureWorkingDirectory = () => {
    assertSupportedProvider();
    fs.mkdirSync(workingDirectory, { recursive: true });
    if (provider === 'r2') getR2Client();
};

const uploadArchive = async (filePath, filename) => {
    if (provider === 'local') {
        return { storageProvider: 'local', storageKey: filename };
    }

    const storageKey = buildObjectKey(filename);
    const stats = await fs.promises.stat(filePath);
    await getR2Client().send(new PutObjectCommand({
        Bucket: r2Config.bucket,
        Key: storageKey,
        Body: fs.createReadStream(filePath),
        ContentLength: stats.size,
        ContentType: 'application/gzip',
        Metadata: { source: 'ngitify-database-backup' },
    }));
    return { storageProvider: 'r2', storageKey };
};

const archiveExists = async (backup) => {
    if (resolveStorageProvider(backup) === 'local') {
        return fs.existsSync(path.join(localBackupDir, backup.filename));
    }

    try {
        await getR2Client().send(new HeadObjectCommand({
            Bucket: r2Config.bucket,
            Key: resolveStorageKey(backup),
        }));
        return true;
    } catch (error) {
        if (isNotFoundError(error)) return false;
        throw error;
    }
};

const materializeArchive = async (backup) => {
    if (resolveStorageProvider(backup) === 'local') {
        return {
            filePath: path.join(localBackupDir, backup.filename),
            cleanup: async () => {},
        };
    }

    const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ngitify-restore-'));
    const filePath = path.join(temporaryDirectory, path.basename(backup.filename));
    try {
        const response = await getR2Client().send(new GetObjectCommand({
            Bucket: r2Config.bucket,
            Key: resolveStorageKey(backup),
        }));
        await pipeline(response.Body, fs.createWriteStream(filePath));
        return {
            filePath,
            cleanup: () => fs.promises.rm(temporaryDirectory, { recursive: true, force: true }),
        };
    } catch (error) {
        await fs.promises.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
};

const getArchiveStream = async (backup) => {
    if (resolveStorageProvider(backup) === 'local') {
        return fs.createReadStream(path.join(localBackupDir, backup.filename));
    }

    const response = await getR2Client().send(new GetObjectCommand({
        Bucket: r2Config.bucket,
        Key: resolveStorageKey(backup),
    }));
    return response.Body;
};

const deleteArchive = async (backup) => {
    if (resolveStorageProvider(backup) === 'local') {
        const filePath = path.join(localBackupDir, backup.filename);
        if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
        return;
    }

    await getR2Client().send(new DeleteObjectCommand({
        Bucket: r2Config.bucket,
        Key: resolveStorageKey(backup),
    }));
};

const getStorageStatus = () => ({
    provider,
    location: provider === 'r2'
        ? `r2://${r2Config.bucket}/${r2Config.prefix}`
        : localBackupDir,
    durable: provider === 'r2',
});

module.exports = {
    archiveExists,
    deleteArchive,
    ensureWorkingDirectory,
    getArchiveStream,
    getStorageStatus,
    isNotFoundError,
    materializeArchive,
    provider,
    uploadArchive,
    workingDirectory,
};
