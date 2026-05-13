const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const verifyToken = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const AuditLog = require('../models/AuditLog');
const BackupLog = require('../models/BackupLog');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MONGODUMP_BIN = String(process.env.MONGODUMP_BIN || 'mongodump').trim() || 'mongodump';
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

const backupRuntime = {
    isRunning: false,
    activeBackup: null,
    nextAutomaticBackupAt: null,
    schedulerTimer: null,
    probe: null,
    interruptedRunsReconciled: false,
};

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const normalizeText = (value) => String(value || '').trim();

const buildBackupFilename = (date = new Date()) => {
    const stamp = date.toISOString().replace(/[:.]/g, '-');
    return `backup-${stamp}.gz`;
};

const formatDurationLabel = (durationMs) => {
    const safeDuration = Math.max(Number(durationMs) || 0, 0);
    const totalSeconds = Math.round(safeDuration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
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

    try {
        const { stdout, stderr } = await runProcess(MONGODUMP_BIN, ['--version']);
        const combined = `${stdout}\n${stderr}`.trim();
        const version = combined
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(Boolean) || 'mongodump available';

        backupRuntime.probe = {
            available: true,
            binary: MONGODUMP_BIN,
            version,
            checkedAt: new Date().toISOString(),
            error: '',
        };
    } catch (error) {
        backupRuntime.probe = {
            available: false,
            binary: MONGODUMP_BIN,
            version: '',
            checkedAt: new Date().toISOString(),
            error: normalizeText(error.message) || 'Unable to execute mongodump.',
        };
    }

    return backupRuntime.probe;
};

const computeFileChecksum = (filePath) => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
});

const runMongodumpArchive = ({ mongoUri, outputPath }) => new Promise((resolve, reject) => {
    const dump = spawn(
        MONGODUMP_BIN,
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
    if (BACKUP_RETENTION_COUNT <= 0) {
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

    const backupsToDelete = successfulBackups.slice(BACKUP_RETENTION_COUNT);
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
                    retentionReason: `Pruned automatically after exceeding the local retention limit of ${BACKUP_RETENTION_COUNT} backups.`,
                },
            }
        );
    }

    return {
        enabled: true,
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
            enabled: BACKUP_RETENTION_COUNT > 0,
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

const scheduleAutomaticBackups = () => {
    if (!BACKUP_AUTO_ENABLED) {
        backupRuntime.nextAutomaticBackupAt = null;
        return;
    }

    const delayMs = BACKUP_AUTO_INTERVAL_HOURS * 60 * 60 * 1000;
    backupRuntime.nextAutomaticBackupAt = new Date(Date.now() + delayMs);

    if (backupRuntime.schedulerTimer) {
        clearTimeout(backupRuntime.schedulerTimer);
    }

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

scheduleAutomaticBackups();

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
            totalRuns,
            successfulRuns,
            failedRuns,
            runningRuns,
            lastSuccessfulBackup,
            lastFailedBackup,
        ] = await Promise.all([
            probeMongodump(),
            BackupLog.countDocuments({}),
            BackupLog.countDocuments({ status: 'success' }),
            BackupLog.countDocuments({ status: 'failed' }),
            BackupLog.countDocuments({ status: 'running' }),
            BackupLog.findOne({ status: 'success' }).sort({ createdAt: -1 }).select('filename createdAt completedAt'),
            BackupLog.findOne({ status: 'failed' }).sort({ createdAt: -1 }).select('filename createdAt completedAt errorMessage'),
        ]);

        res.json({
            backupDir: BACKUP_DIR,
            binary: MONGODUMP_BIN,
            mongodump: probe,
            scheduler: {
                enabled: BACKUP_AUTO_ENABLED,
                intervalHours: BACKUP_AUTO_INTERVAL_HOURS,
                retentionCount: BACKUP_RETENTION_COUNT,
                nextAutomaticBackupAt: backupRuntime.nextAutomaticBackupAt,
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
