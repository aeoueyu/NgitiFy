// backend/routes/backup.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const verifyToken = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');
const BackupLog = require('../models/BackupLog');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Ensure /backups directory exists on startup
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'administrator') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
};

// -------------------------------------------------------
// POST /api/backup/create  — Trigger a mongodump backup
// -------------------------------------------------------
router.post('/backup/create', verifyToken, isAdmin, async (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.gz`;
    const outputPath = path.join(BACKUP_DIR, filename);
    const mongoUri = process.env.MONGO_URI;

    try {
        await new Promise((resolve, reject) => {
            // mongodump --uri=<URI> --archive=<path> --gzip
            const dump = spawn('mongodump', [
                `--uri=${mongoUri}`,
                `--archive=${outputPath}`,
                '--gzip'
            ]);

            dump.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`mongodump exited with code ${code}`));
            });

            dump.on('error', (err) => reject(err));
        });

        const stats = fs.statSync(outputPath);

        const log = await BackupLog.create({
            filename,
            size: stats.size,
            status: 'success',
            createdBy: req.user.id,
            createdByName: req.user.email
        });

        await AuditLog.create({
            action: 'BACKUP_CREATED',
            user: req.user.email,
            role: req.user.role,
            details: `Database backup created: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`
        });

        res.status(201).json({ message: 'Backup created successfully.', backup: log });

    } catch (error) {
        console.error('Backup creation failed:', error);

        // Log the failure
        await BackupLog.create({
            filename,
            size: 0,
            status: 'failed',
            errorMessage: error.message,
            createdBy: req.user.id,
            createdByName: req.user.email
        }).catch(() => {});

        res.status(500).json({ message: 'Backup failed. Ensure mongodump is installed on the server.' });
    }
});

// -------------------------------------------------------
// GET /api/backup/list  — List all backup records
// -------------------------------------------------------
router.get('/backup/list', verifyToken, isAdmin, async (req, res) => {
    try {
        const backups = await BackupLog.find()
            .sort({ createdAt: -1 })
            .limit(50);

        // Enrich each record: confirm file still exists on disk
        const enriched = backups.map(b => ({
            ...b.toObject(),
            fileExists: b.status === 'success'
                ? fs.existsSync(path.join(BACKUP_DIR, b.filename))
                : false
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// -------------------------------------------------------
// GET /api/backup/download/:filename  — Stream backup file
// -------------------------------------------------------
router.get('/backup/download/:filename', verifyToken, isAdmin, (req, res) => {
    // Sanitize: strip any path separators to prevent path traversal
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