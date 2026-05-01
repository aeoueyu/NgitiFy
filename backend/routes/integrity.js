// backend/routes/integrity.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Surgery = require('../models/Surgery');

const isAdmin = (req, res, next) => {
    if (!['administrator', 'co-administrator'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied. Admin tier only.' });
    }
    next();
};

// -------------------------------------------------------
// Individual check functions
// -------------------------------------------------------

// Check 1: Surgeries whose patient or dentist no longer exists
async function checkOrphanedSurgeries() {
    const surgeries = await Surgery.find({});
    const orphaned = [];

    for (const surgery of surgeries) {
        const patientExists = surgery.patient
            ? await User.exists({ _id: surgery.patient })
            : true; // no patient field — skip
        const dentistExists = surgery.dentist
            ? await User.exists({ _id: surgery.dentist })
            : true;

        if (!patientExists || !dentistExists) {
            orphaned.push({
                id: surgery._id,
                procedure: surgery.procedure,
                date: surgery.date,
                missingPatient: !patientExists,
                missingDentist: !dentistExists
            });
        }
    }

    return {
        checkName: 'orphaned_surgeries',
        label: 'Orphaned Surgeries',
        description: 'Appointments whose linked patient or dentist account no longer exists.',
        count: orphaned.length,
        status: orphaned.length === 0 ? 'pass' : 'fail',
        records: orphaned
    };
}

// Check 2: Users unverified for more than 14 days
async function checkUnverifiedUsers() {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const stale = await User.find({
        isVerified: false,
        createdAt: { $lt: cutoff }
    }).select('_id email role createdAt');

    return {
        checkName: 'unverified_users',
        label: 'Stale Unverified Accounts',
        description: 'User accounts that have been unverified for more than 14 days.',
        count: stale.length,
        status: stale.length === 0 ? 'pass' : 'warn',
        records: stale
    };
}

// Check 3: Duplicate email addresses
async function checkDuplicateEmails() {
    const dupes = await User.aggregate([
        { $group: { _id: '$email', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
        { $project: { email: '$_id', count: 1, ids: 1, _id: 0 } }
    ]);

    return {
        checkName: 'duplicate_emails',
        label: 'Duplicate Email Addresses',
        description: 'Email addresses that appear more than once in the users collection.',
        count: dupes.length,
        status: dupes.length === 0 ? 'pass' : 'fail',
        records: dupes
    };
}

// Check 4: Accounts still inactive with expired temporary passwords
async function checkExpiredTempPasswords() {
    const expired = await User.find({
        status: 'inactive',
        isPasswordChanged: false,
        temporaryPasswordExpires: { $lt: new Date() }
    }).select('_id email role temporaryPasswordExpires createdAt');

    return {
        checkName: 'expired_temp_passwords',
        label: 'Expired Temporary Passwords',
        description: 'Inactive accounts whose temporary passwords have expired and were never changed.',
        count: expired.length,
        status: expired.length === 0 ? 'pass' : 'warn',
        records: expired
    };
}

// -------------------------------------------------------
// GET /api/integrity/run-checks  — Run all checks
// -------------------------------------------------------
router.get('/integrity/run-checks', verifyToken, isAdmin, async (req, res) => {
    try {
        const results = await Promise.all([
            checkOrphanedSurgeries(),
            checkUnverifiedUsers(),
            checkDuplicateEmails(),
            checkExpiredTempPasswords()
        ]);

        const summary = {
            total: results.length,
            passed: results.filter(r => r.status === 'pass').length,
            warnings: results.filter(r => r.status === 'warn').length,
            failed: results.filter(r => r.status === 'fail').length,
            ranAt: new Date()
        };

        res.json({ summary, checks: results });

    } catch (error) {
        console.error('Integrity check error:', error);
        res.status(500).json({ message: 'Server error running integrity checks.' });
    }
});

// -------------------------------------------------------
// POST /api/integrity/fix/:checkName  — Auto-fix a specific issue
// -------------------------------------------------------
router.post('/integrity/fix/:checkName', verifyToken, isAdmin, async (req, res) => {
    const { checkName } = req.params;

    try {
        let fixResult = {};

        if (checkName === 'orphaned_surgeries') {
            // Archive orphaned surgeries by marking them inactive instead of deleting
            const surgeries = await Surgery.find({});
            const orphanedIds = [];

            for (const surgery of surgeries) {
                const patientExists = surgery.patient
                    ? await User.exists({ _id: surgery.patient })
                    : true;
                const dentistExists = surgery.dentist
                    ? await User.exists({ _id: surgery.dentist })
                    : true;
                if (!patientExists || !dentistExists) orphanedIds.push(surgery._id);
            }

            if (orphanedIds.length > 0) {
                await Surgery.updateMany(
                    { _id: { $in: orphanedIds } },
                    { $set: { status: 'archived', notes: 'Auto-archived: linked user no longer exists.' } }
                );
            }

            fixResult = { fixed: orphanedIds.length, action: 'Marked as archived' };

        } else if (checkName === 'unverified_users') {
            // Deactivate stale unverified accounts
            const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            const result = await User.updateMany(
                { isVerified: false, createdAt: { $lt: cutoff } },
                { $set: { status: 'inactive' } }
            );
            fixResult = { fixed: result.modifiedCount, action: 'Set status to inactive' };

        } else if (checkName === 'expired_temp_passwords') {
            // Clear stale credential fields so these accounts no longer appear in future checks
            const result = await User.updateMany(
                {
                    status: 'inactive',
                    isPasswordChanged: false,
                    temporaryPasswordExpires: { $lt: new Date() }
                },
                {
                    $unset: { temporaryPasswordExpires: '', activationToken: '' },
                    $set: { isPasswordChanged: true }
                }
            );
            fixResult = { fixed: result.modifiedCount, action: 'Cleared expired credential fields' };

        } else if (checkName === 'duplicate_emails') {
            return res.status(400).json({
                message: 'Duplicate email fix requires manual review. Auto-fix is disabled for this check to prevent unintended data loss.'
            });

        } else {
            return res.status(400).json({ message: `Unknown check: ${checkName}` });
        }

        await AuditLog.create({
            action: 'INTEGRITY_FIX',
            user: req.user.email,
            role: req.user.role,
            details: `Integrity fix applied for check: ${checkName}. ${fixResult.action}, ${fixResult.fixed} record(s) affected.`
        });

        res.json({ message: `Fix applied for "${checkName}".`, result: fixResult });

    } catch (error) {
        console.error('Integrity fix error:', error);
        res.status(500).json({ message: 'Server error applying fix.' });
    }
});

module.exports = router;
