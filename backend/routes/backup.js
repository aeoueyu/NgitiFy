const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const verifyToken = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const AuditLog = require('../models/AuditLog');
const BackupLog = require('../models/BackupLog');
const SystemConfig = require('../models/SystemConfig');

const normalizeText = (value) => String(value || '').trim();

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MONGODUMP_BIN = normalizeText(process.env.MONGODUMP_BIN) || 'mongodump';
const MONGORESTORE_BIN = normalizeText(process.env.MONGORESTORE_BIN) || '';
const BACKUP_AUTO_ENABLED = String(process.env.BACKUP_AUTO_ENABLED || '').trim().toLowerCase() === 'true';
const BACKUP_AUTO_INTERVAL_HOURS = (() => {
    const parsed = Number(process.env.BACKUP_AUTO_INTERVAL_HOURS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
})();
const BACKUP_RETENTION_COUNT = (() => {
    const parsed = Number(process.env.BACKUP_RETENTION_COUNT);
    if (!Number.isFinite(parsed)) return 14;
    return Math.max(Math.floor(parsed), 0);
})();
const BACKUP_PROBE_CACHE_MS = 60 * 1000;
const SYSTEM_BACKUP_ACTOR = 'System Scheduler';
const DEFAULT_BACKUP_SETTINGS = Object.freeze({
    enabled: BACKUP_AUTO_ENABLED,
    intervalHours: BACKUP_AUTO_INTERVAL_HOURS,
    retentionCount: BACKUP_RETENTION_COUNT,
});

const backupRuntime = {
    isRunning: false,
    activeBackup: null,
    nextAutomaticBackupAt: null,
    schedulerTimer: null,
    probe: null,
    restoreProbe: null,
    interruptedRunsReconciled: false,
    settings: { ...DEFAULT_BACKUP_SETTINGS },
};

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const buildBackupFilename = (date = new Date()) => {
    const stamp = date.toISOString().replace(/[:.]/g, '-');
    return `backup-${stamp}.gz`;
};

const compareVersionLabelsDesc = (left, right) => {
    const leftParts = String(left || '').match(/\d+/g)?.map(Number) || [];
    const rightParts = String(right || '').match(/\d+/g)?.map(Number) || [];
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftPart = leftParts[index] || 0;
        const rightPart = rightParts[index] || 0;
        if (leftPart !== rightPart) {
            return rightPart - leftPart;
        }
    }

    return String(right || '').localeCompare(String(left || ''));
};

const listImmediateDirectories = (rootDir) => {
    if (!normalizeText(rootDir) || !fs.existsSync(rootDir)) {
        return [];
    }

    try {
        return fs.readdirSync(rootDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort(compareVersionLabelsDesc)
            .map((entryName) => path.join(rootDir, entryName));
    } catch {
        return [];
    }
};

const buildMongoToolCandidates = ({ executableBaseName, configuredPath = '' }) => {
    const executableName = process.platform === 'win32' ? `${executableBaseName}.exe` : executableBaseName;
    const localToolRoots = [
        path.join(__dirname, '..', 'tools', 'mongodb-database-tools'),
        path.join(__dirname, '..', 'tools', 'mongo-tools'),
    ];
    const windowsToolRoots = process.platform === 'win32'
        ? [
            path.join(process.env.ProgramFiles || '', 'MongoDB', 'Tools'),
            path.join(process.env.ProgramFiles || '', 'MongoDB', 'Database Tools'),
            path.join(process.env['ProgramFiles(x86)'] || '', 'MongoDB', 'Tools'),
            path.join(process.env['ProgramFiles(x86)'] || '', 'MongoDB', 'Database Tools'),
            path.join(process.env.LOCALAPPDATA || '', 'MongoDBDatabaseTools'),
            path.join(process.env.LOCALAPPDATA || '', 'MongoDB', 'Database Tools'),
        ]
        : [];

    const fileCandidates = [
        ...localToolRoots.flatMap((rootDir) => [
            path.join(rootDir, 'bin', executableName),
            ...listImmediateDirectories(rootDir).map((versionDir) => path.join(versionDir, 'bin', executableName)),
        ]),
        ...windowsToolRoots.flatMap((rootDir) => [
            path.join(rootDir, 'bin', executableName),
            ...listImmediateDirectories(rootDir).map((versionDir) => path.join(versionDir, 'bin', executableName)),
        ]),
    ];

    const commandCandidates = [
        configuredPath,
        executableBaseName,
        ...fileCandidates.filter((candidatePath) => fs.existsSync(candidatePath)),
    ];

    return [...new Set(commandCandidates.map(normalizeText).filter(Boolean))];
};

const buildMongodumpCandidates = () => buildMongoToolCandidates({
    executableBaseName: 'mongodump',
    configuredPath: MONGODUMP_BIN,
});

const buildMongorestoreCandidates = () => {
    const configuredPath = MONGORESTORE_BIN
        || (path.basename(MONGODUMP_BIN).toLowerCase() === (process.platform === 'win32' ? 'mongodump.exe' : 'mongodump')
            ? path.join(path.dirname(MONGODUMP_BIN), process.platform === 'win32' ? 'mongorestore.exe' : 'mongorestore')
            : '');

    return buildMongoToolCandidates({
        executableBaseName: 'mongorestore',
        configuredPath,
    });
};

const formatDurationLabel = (durationMs) => {
    const safeDuration = Math.max(Number(durationMs) || 0, 0);
    const totalSeconds = Math.round(safeDuration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
};

const normalizeIntegerInRange = (value, { fallback, min, max }) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.round(parsed), min), max);
};

const normalizeBackupSettings = (source = {}) => ({
    enabled: source?.enabled === true,
    intervalHours: normalizeIntegerInRange(source?.intervalHours, {
        fallback: DEFAULT_BACKUP_SETTINGS.intervalHours,
        min: 1,
        max: 168,
    }),
    retentionCount: normalizeIntegerInRange(source?.retentionCount, {
        fallback: DEFAULT_BACKUP_SETTINGS.retentionCount,
        min: 0,
        max: 90,
    }),
    updatedAt: source?.updatedAt || null,
    updatedBy: normalizeText(source?.updatedBy),
});

const getOrCreateSystemConfig = async () => {
    let config = await SystemConfig.findOne();
    if (!config) {
        config = await SystemConfig.create({});
    }
    return config;
};

const getPersistedBackupSettings = async () => {
    const config = await getOrCreateSystemConfig();
    const rawSettings = config.backupSettings;

    if (!rawSettings || !rawSettings.updatedAt) {
        return normalizeBackupSettings({
            ...DEFAULT_BACKUP_SETTINGS,
            updatedAt: null,
            updatedBy: '',
        });
    }

    return normalizeBackupSettings(rawSettings);
};

const persistBackupSettings = async ({ enabled, intervalHours, retentionCount, updatedBy = '' }) => {
    const config = await getOrCreateSystemConfig();
    const payload = normalizeBackupSettings({
        enabled,
        intervalHours,
        retentionCount,
        updatedAt: new Date(),
        updatedBy,
    });

    config.backupSettings = payload;
    await config.save();
    return payload;
};

const runProcess = (command, args = []) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
        if (code === 0) {
            resolve({ stdout, stderr });
            return;
        }

        const error = new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`);
        error.exitCode = code;
        reject(error);
    });
});

const probeMongodump = async (force = false) => {
    const now = Date.now();
    if (
        !force
        && backupRuntime.probe
        && now - new Date(backupRuntime.probe.checkedAt).getTime() < BACKUP_PROBE_CACHE_MS
    ) {
        return backupRuntime.probe;
    }

    const tried = [];
    let lastError = '';

    for (const candidate of buildMongodumpCandidates()) {
        tried.push(candidate);

        try {
            const { stdout, stderr } = await runProcess(candidate, ['--version']);
            const combined = `${stdout}\n${stderr}`.trim();
            const version = combined
                .split(/\r?\n/)
                .map((line) => line.trim())
                .find(Boolean) || 'mongodump available';

            backupRuntime.probe = {
                available: true,
                binary: candidate,
                version,
                checkedAt: new Date().toISOString(),
                error: '',
                searchedPaths: tried,
            };

            return backupRuntime.probe;
        } catch (error) {
            lastError = normalizeText(error.message) || 'Unable to execute mongodump.';
        }
    }

    backupRuntime.probe = {
        available: false,
        binary: MONGODUMP_BIN,
        version: '',
        checkedAt: new Date().toISOString(),
        error: lastError || 'Unable to execute mongodump.',
        searchedPaths: tried,
    };

    return backupRuntime.probe;
};

const probeMongorestore = async (force = false) => {
    const now = Date.now();
    if (
        !force
        && backupRuntime.restoreProbe
        && now - new Date(backupRuntime.restoreProbe.checkedAt).getTime() < BACKUP_PROBE_CACHE_MS
    ) {
        return backupRuntime.restoreProbe;
    }

    const tried = [];
    let lastError = '';

    for (const candidate of buildMongorestoreCandidates()) {
        tried.push(candidate);

        try {
            const { stdout, stderr } = await runProcess(candidate, ['--version']);
            const combined = `${stdout}\n${stderr}`.trim();
            const version = combined
                .split(/\r?\n/)
                .map((line) => line.trim())
                .find(Boolean) || 'mongorestore available';

            backupRuntime.restoreProbe = {
                available: true,
                binary: candidate,
                version,
                checkedAt: new Date().toISOString(),
                error: '',
                searchedPaths: tried,
            };

            return backupRuntime.restoreProbe;
        } catch (error) {
            lastError = normalizeText(error.message) || 'Unable to execute mongorestore.';
        }
    }

    backupRuntime.restoreProbe = {
        available: false,
        binary: MONGORESTORE_BIN || 'mongorestore',
        version: '',
        checkedAt: new Date().toISOString(),
        error: lastError || 'Unable to execute mongorestore.',
        searchedPaths: tried,
    };

    return backupRuntime.restoreProbe;
};

const computeFileChecksum = (filePath) => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
});

const runMongodumpArchive = ({ command, mongoUri, outputPath }) => new Promise((resolve, reject) => {
    if (!normalizeText(mongoUri)) {
        reject(new Error('MONGO_URI is not configured for backup operations.'));
        return;
    }

    const dump = spawn(
        command,
        [
            `--uri=${mongoUri}`,
            `--archive=${outputPath}`,
            '--gzip',
        ],
        { windowsHide: true }
    );

    let stderr = '';

    dump.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
    });

    dump.on('error', reject);
    dump.on('close', (code) => {
        if (code === 0) {
            resolve();
            return;
        }

        const error = new Error(stderr.trim() || `mongodump exited with code ${code}`);
        error.exitCode = code;
        reject(error);
    });
});

const parseMongoUriParts = (mongoUri) => {
    const sourceUri = normalizeText(mongoUri);
    if (!sourceUri) {
        throw new Error('MONGO_URI is not configured for backup operations.');
    }

    let parsed;
    try {
        parsed = new URL(sourceUri);
    } catch {
        throw new Error('MONGO_URI is not a valid MongoDB connection string.');
    }

    const databaseName = decodeURIComponent(parsed.pathname || '').replace(/^\/+/, '').split('/')[0];
    if (!databaseName) {
        throw new Error('MONGO_URI must include a database name before backups can be restore-tested.');
    }

    return { parsed, databaseName };
};

const buildMongoUriForDatabase = (mongoUri, databaseName) => {
    const { parsed } = parseMongoUriParts(mongoUri);
    parsed.pathname = `/${encodeURIComponent(databaseName)}`;
    return parsed.toString();
};

const buildRestoreVerificationDbName = (sourceDbName) => {
    const safeSource = normalizeText(sourceDbName).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 12) || 'ngitify';
    const suffix = new Date().toISOString().replace(/[^0-9]/g, '').slice(2, 12);
    const random = crypto.randomBytes(3).toString('hex');
    return `${safeSource}_bkverify_${suffix}_${random}`.slice(0, 38);
};

const runMongorestoreArchive = ({
    command,
    mongoUri,
    archivePath,
    sourceDbName,
    targetDbName,
}) => new Promise((resolve, reject) => {
    if (!normalizeText(mongoUri)) {
        reject(new Error('MONGO_URI is not configured for restore verification.'));
        return;
    }

    const restore = spawn(
        command,
        [
            `--uri=${mongoUri}`,
            `--archive=${archivePath}`,
            '--gzip',
            '--drop',
            `--nsFrom=${sourceDbName}.*`,
            `--nsTo=${targetDbName}.*`,
        ],
        { windowsHide: true }
    );

    let stderr = '';

    restore.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
    });

    restore.on('error', reject);
    restore.on('close', (code) => {
        if (code === 0) {
            resolve({ stderr });
            return;
        }

        const error = new Error(stderr.trim() || `mongorestore exited with code ${code}`);
        error.exitCode = code;
        reject(error);
    });
});

const countDocumentsInDatabase = async (mongoUri) => {
    const connection = await mongoose.createConnection(mongoUri).asPromise();
    try {
        const collections = await connection.db.listCollections().toArray();
        let documentCount = 0;

        for (const collection of collections) {
            documentCount += await connection.db.collection(collection.name).countDocuments({});
        }

        return {
            collectionCount: collections.length,
            documentCount,
        };
    } finally {
        await connection.close();
    }
};

const dropDatabaseIfExists = async (mongoUri) => {
    const connection = await mongoose.createConnection(mongoUri).asPromise();
    try {
        await connection.dropDatabase();
    } finally {
        await connection.close();
    }
};

const buildActiveBackupPayload = (log) => (
    log
        ? {
            logId: String(log._id),
            filename: log.filename,
            triggerType: log.triggerType,
            createdByName: log.createdByName,
            startedAt: log.startedAt,
        }
        : null
);

const reconcileInterruptedBackups = async () => {
    if (backupRuntime.interruptedRunsReconciled) {
        return;
    }

    backupRuntime.interruptedRunsReconciled = true;
    await BackupLog.updateMany(
        { status: 'running' },
        {
            $set: {
                status: 'failed',
                completedAt: new Date(),
                errorMessage: 'Backup did not complete. The server restarted or the process stopped during the backup run.',
            },
        }
    ).catch(() => {});
};

const applyRetentionPolicy = async () => {
    const retentionCount = backupRuntime.settings.retentionCount;

    if (retentionCount <= 0) {
        return {
            enabled: false,
            deletedCount: 0,
            deletedFilenames: [],
        };
    }

    const successfulBackups = await BackupLog.find({
        status: 'success',
        retentionDeletedAt: null,
    })
        .sort({ createdAt: -1 })
        .select('filename createdAt')
        .lean();

    const backupsToDelete = successfulBackups.slice(retentionCount);
    const deletedFilenames = [];

    for (const backup of backupsToDelete) {
        const filePath = path.join(BACKUP_DIR, backup.filename);
        if (!fs.existsSync(filePath)) {
            continue;
        }

        await fs.promises.unlink(filePath);
        deletedFilenames.push(backup.filename);
        await BackupLog.updateOne(
            { _id: backup._id },
            {
                $set: {
                    retentionDeletedAt: new Date(),
                    retentionReason: `Pruned automatically after exceeding the local retention limit of ${retentionCount} backups.`,
                },
            }
        );
    }

    return {
        enabled: retentionCount > 0,
        deletedCount: deletedFilenames.length,
        deletedFilenames,
    };
};

const finalizeBackupRuntime = () => {
    backupRuntime.isRunning = false;
    backupRuntime.activeBackup = null;
};

const createBackupRun = async ({
    createdBy = null,
    createdByName = SYSTEM_BACKUP_ACTOR,
    triggerType = 'manual',
}) => {
    await reconcileInterruptedBackups();

    if (backupRuntime.isRunning) {
        const error = new Error('A backup is already running.');
        error.code = 'BACKUP_BUSY';
        error.activeBackup = backupRuntime.activeBackup;
        throw error;
    }

    const startedAt = new Date();
    const filename = buildBackupFilename(startedAt);
    const outputPath = path.join(BACKUP_DIR, filename);
    const probe = await probeMongodump(true);

    let log = await BackupLog.create({
        filename,
        size: 0,
        status: 'running',
        triggerType,
        checksumSha256: '',
        durationMs: 0,
        startedAt,
        completedAt: null,
        toolVersion: probe.available ? probe.version : '',
        createdBy,
        createdByName,
    });

    backupRuntime.isRunning = true;
    backupRuntime.activeBackup = buildActiveBackupPayload(log);

    try {
        await runMongodumpArchive({
            command: probe.binary,
            mongoUri: process.env.MONGO_URI,
            outputPath,
        });

        const [stats, checksumSha256] = await Promise.all([
            fs.promises.stat(outputPath),
            computeFileChecksum(outputPath),
        ]);
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        log = await BackupLog.findByIdAndUpdate(
            log._id,
            {
                $set: {
                    size: stats.size,
                    status: 'success',
                    checksumSha256,
                    durationMs,
                    completedAt,
                    errorMessage: null,
                    toolVersion: probe.available ? probe.version : '',
                },
            },
            { new: true }
        );

        let retention = {
            enabled: backupRuntime.settings.retentionCount > 0,
            deletedCount: 0,
            deletedFilenames: [],
            error: '',
        };

        try {
            retention = {
                ...(await applyRetentionPolicy()),
                error: '',
            };
        } catch (retentionError) {
            retention = {
                ...retention,
                error: normalizeText(retentionError.message) || 'Automatic retention cleanup failed.',
            };
        }

        await AuditLog.create({
            action: 'BACKUP_CREATED',
            user: createdByName,
            role: triggerType === 'scheduled' ? 'system' : 'administrator',
            details: `Database backup created: ${filename} (${(stats.size / 1024).toFixed(1)} KB, ${formatDurationLabel(durationMs)}, ${triggerType}).${retention.deletedCount > 0 ? ` Retention pruned ${retention.deletedCount} older backup(s).` : ''}${retention.error ? ` Retention warning: ${retention.error}` : ''}`,
        }).catch(() => {});

        return {
            backup: log,
            retention,
        };
    } catch (error) {
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        await BackupLog.findByIdAndUpdate(log._id, {
            $set: {
                status: 'failed',
                completedAt,
                durationMs,
                errorMessage: normalizeText(error.message) || 'Backup failed.',
            },
        }).catch(() => {});

        if (fs.existsSync(outputPath)) {
            await fs.promises.unlink(outputPath).catch(() => {});
        }

        await AuditLog.create({
            action: 'BACKUP_FAILED',
            user: createdByName,
            role: triggerType === 'scheduled' ? 'system' : 'administrator',
            details: `Database backup failed for ${filename} (${triggerType}). ${normalizeText(error.message) || 'Unknown error.'}`,
        }).catch(() => {});

        throw error;
    } finally {
        finalizeBackupRuntime();
    }
};

const verifyBackupArchive = async ({ filename, verifiedBy = null, verifiedByName = 'Administrator' }) => {
    await reconcileInterruptedBackups();

    const safeFilename = path.basename(filename);
    const filePath = path.join(BACKUP_DIR, safeFilename);
    const backup = await BackupLog.findOne({ filename: safeFilename });

    if (!backup) {
        const error = new Error('Backup log not found.');
        error.statusCode = 404;
        throw error;
    }

    if (backup.status !== 'success') {
        const error = new Error('Only successful backups can be verified.');
        error.statusCode = 400;
        throw error;
    }

    if (!fs.existsSync(filePath)) {
        const error = new Error('Backup file is missing from local storage.');
        error.statusCode = 404;
        throw error;
    }

    const startedAt = new Date();
    const restoreProbe = await probeMongorestore(true);
    const { databaseName: sourceDbName } = parseMongoUriParts(process.env.MONGO_URI);
    const tempDbName = buildRestoreVerificationDbName(sourceDbName);
    const tempMongoUri = buildMongoUriForDatabase(process.env.MONGO_URI, tempDbName);

    try {
        const checksumSha256 = await computeFileChecksum(filePath);
        if (backup.checksumSha256 && checksumSha256 !== backup.checksumSha256) {
            throw new Error('Backup checksum mismatch. The archive may have been changed or corrupted.');
        }

        await runMongorestoreArchive({
            command: restoreProbe.binary,
            mongoUri: process.env.MONGO_URI,
            archivePath: filePath,
            sourceDbName,
            targetDbName: tempDbName,
        });

        const { collectionCount, documentCount } = await countDocumentsInDatabase(tempMongoUri);
        if (collectionCount <= 0) {
            throw new Error('Restore verification produced no collections.');
        }

        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        const updatedBackup = await BackupLog.findByIdAndUpdate(
            backup._id,
            {
                $set: {
                    verificationStatus: 'verified',
                    verifiedAt: completedAt,
                    verifiedBy,
                    verifiedByName,
                    verificationDurationMs: durationMs,
                    verificationCollections: collectionCount,
                    verificationDocuments: documentCount,
                    verificationTempDb: tempDbName,
                    verificationError: '',
                    restoreToolVersion: restoreProbe.available ? restoreProbe.version : '',
                },
            },
            { new: true }
        );

        await AuditLog.create({
            action: 'BACKUP_VERIFIED',
            user: verifiedByName,
            role: 'administrator',
            details: `Database backup verified by restore test: ${safeFilename} (${collectionCount} collection(s), ${documentCount} document(s), ${formatDurationLabel(durationMs)}). Temporary database ${tempDbName} was dropped after verification.`,
        }).catch(() => {});

        return updatedBackup;
    } catch (error) {
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        await BackupLog.findByIdAndUpdate(backup._id, {
            $set: {
                verificationStatus: 'failed',
                verifiedAt: completedAt,
                verifiedBy,
                verifiedByName,
                verificationDurationMs: durationMs,
                verificationTempDb: tempDbName,
                verificationError: normalizeText(error.message) || 'Restore verification failed.',
                restoreToolVersion: restoreProbe.available ? restoreProbe.version : '',
            },
        }).catch(() => {});

        await AuditLog.create({
            action: 'BACKUP_VERIFICATION_FAILED',
            user: verifiedByName,
            role: 'administrator',
            details: `Database backup restore verification failed for ${safeFilename}. ${normalizeText(error.message) || 'Unknown error.'}`,
        }).catch(() => {});

        throw error;
    } finally {
        await dropDatabaseIfExists(tempMongoUri).catch(() => {});
    }
};

const scheduleAutomaticBackups = (settings = backupRuntime.settings) => {
    backupRuntime.settings = normalizeBackupSettings(settings);

    if (backupRuntime.schedulerTimer) {
        clearTimeout(backupRuntime.schedulerTimer);
        backupRuntime.schedulerTimer = null;
    }

    if (!backupRuntime.settings.enabled) {
        backupRuntime.nextAutomaticBackupAt = null;
        return;
    }

    const delayMs = backupRuntime.settings.intervalHours * 60 * 60 * 1000;
    backupRuntime.nextAutomaticBackupAt = new Date(Date.now() + delayMs);

    backupRuntime.schedulerTimer = setTimeout(async () => {
        try {
            await createBackupRun({
                createdBy: null,
                createdByName: SYSTEM_BACKUP_ACTOR,
                triggerType: 'scheduled',
            });
        } catch (error) {
            if (error.code !== 'BACKUP_BUSY') {
                console.error('Automatic backup failed:', error);
            }
        } finally {
            scheduleAutomaticBackups();
        }
    }, delayMs);
};

const initializeBackupScheduler = async () => {
    scheduleAutomaticBackups(DEFAULT_BACKUP_SETTINGS);

    try {
        const persistedSettings = await getPersistedBackupSettings();
        scheduleAutomaticBackups(persistedSettings);
    } catch (error) {
        console.error('Error loading persisted backup settings:', error);
    }
};

initializeBackupScheduler().catch((error) => {
    console.error('Error initializing backup scheduler:', error);
});

const serializeBackupLog = (backup) => {
    const filePath = path.join(BACKUP_DIR, backup.filename);
    const fileExists = backup.status === 'success' ? fs.existsSync(filePath) : false;
    const fileState = backup.retentionDeletedAt
        ? 'pruned'
        : (backup.status === 'success'
            ? (fileExists ? 'available' : 'missing')
            : 'none');

    return {
        ...backup.toObject(),
        fileExists,
        fileState,
    };
};

router.get('/backup/status', verifyToken, isAdmin, async (req, res) => {
    try {
        await reconcileInterruptedBackups();

        const [
            probe,
            restoreProbe,
            totalRuns,
            successfulRuns,
            failedRuns,
            runningRuns,
            lastSuccessfulBackup,
            lastFailedBackup,
        ] = await Promise.all([
            probeMongodump(),
            probeMongorestore(),
            BackupLog.countDocuments({}),
            BackupLog.countDocuments({ status: 'success' }),
            BackupLog.countDocuments({ status: 'failed' }),
            BackupLog.countDocuments({ status: 'running' }),
            BackupLog.findOne({ status: 'success' }).sort({ createdAt: -1 }).select('filename createdAt completedAt'),
            BackupLog.findOne({ status: 'failed' }).sort({ createdAt: -1 }).select('filename createdAt completedAt errorMessage'),
        ]);

        res.json({
            backupDir: BACKUP_DIR,
            binary: probe.binary || MONGODUMP_BIN,
            mongodump: probe,
            mongorestore: restoreProbe,
            scheduler: {
                enabled: backupRuntime.settings.enabled,
                intervalHours: backupRuntime.settings.intervalHours,
                retentionCount: backupRuntime.settings.retentionCount,
                nextAutomaticBackupAt: backupRuntime.nextAutomaticBackupAt,
                updatedAt: backupRuntime.settings.updatedAt || null,
                updatedBy: backupRuntime.settings.updatedBy || '',
            },
            activeBackup: backupRuntime.activeBackup,
            summary: {
                totalRuns,
                successfulRuns,
                failedRuns,
                runningRuns,
                lastSuccessfulBackup,
                lastFailedBackup,
            },
        });
    } catch (error) {
        console.error('Error fetching backup status:', error);
        res.status(500).json({ message: 'Server error loading backup status.' });
    }
});

router.post('/backup/create', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await createBackupRun({
            createdBy: req.user.id || null,
            createdByName: req.user.email,
            triggerType: 'manual',
        });

        res.status(201).json({
            message: 'Backup created successfully.',
            backup: result.backup,
            retention: result.retention,
        });
    } catch (error) {
        if (error.code === 'BACKUP_BUSY') {
            return res.status(409).json({
                message: 'A backup is already running. Please wait for it to finish before starting another one.',
                activeBackup: error.activeBackup,
            });
        }

        console.error('Backup creation failed:', error);
        res.status(500).json({
            message: 'Backup failed. Ensure mongodump is installed and the server can access the database.',
        });
    }
});

router.put('/backup/settings', verifyToken, isAdmin, async (req, res) => {
    try {
        const savedSettings = await persistBackupSettings({
            enabled: req.body?.enabled,
            intervalHours: req.body?.intervalHours,
            retentionCount: req.body?.retentionCount,
            updatedBy: req.user?.email || 'Administrator',
        });

        scheduleAutomaticBackups(savedSettings);

        await AuditLog.create({
            action: 'BACKUP_SETTINGS_UPDATED',
            user: req.user?.email || 'Administrator',
            role: 'administrator',
            details: `Backup scheduler settings updated: enabled=${savedSettings.enabled}, intervalHours=${savedSettings.intervalHours}, retentionCount=${savedSettings.retentionCount}.`,
        }).catch(() => {});

        res.json({
            message: 'Backup settings saved successfully.',
            scheduler: {
                enabled: backupRuntime.settings.enabled,
                intervalHours: backupRuntime.settings.intervalHours,
                retentionCount: backupRuntime.settings.retentionCount,
                nextAutomaticBackupAt: backupRuntime.nextAutomaticBackupAt,
                updatedAt: backupRuntime.settings.updatedAt || null,
                updatedBy: backupRuntime.settings.updatedBy || '',
            },
        });
    } catch (error) {
        console.error('Error saving backup settings:', error);
        res.status(500).json({ message: 'Server error saving backup settings.' });
    }
});

router.get('/backup/list', verifyToken, isAdmin, async (req, res) => {
    try {
        await reconcileInterruptedBackups();
        const backups = await BackupLog.find({})
            .sort({ createdAt: -1 })
            .limit(100);

        res.json(backups.map(serializeBackupLog));
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ message: 'Server error loading backup history.' });
    }
});

router.post('/backup/verify/:filename', verifyToken, isAdmin, async (req, res) => {
    try {
        const backup = await verifyBackupArchive({
            filename: req.params.filename,
            verifiedBy: req.user.id || null,
            verifiedByName: req.user.email || 'Administrator',
        });

        res.json({
            message: 'Backup verified successfully by restore test.',
            backup,
        });
    } catch (error) {
        console.error('Backup verification failed:', error);
        res.status(error.statusCode || 500).json({
            message: normalizeText(error.message) || 'Backup verification failed.',
        });
    }
});

router.get('/backup/download/:filename', verifyToken, isAdmin, (req, res) => {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(BACKUP_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Backup file not found.' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
