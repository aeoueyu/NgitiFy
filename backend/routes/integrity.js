const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');

const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Branch = require('../models/Branch');
const Queue = require('../models/Queue');
const InventoryItem = require('../models/InventoryItem');
const InventoryBatch = require('../models/InventoryBatch');
const { hasDentistClinicalAccess } = require('../utils/healthcareAccess');

const Surgery = Appointment;

const normalizeText = (value) => String(value || '').trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();
const uniqueStrings = (values = []) => [...new Set(values.map(normalizeText).filter(Boolean))];
const uniqueIds = (values = []) => [...new Set(values.filter(Boolean).map((value) => String(value)))];

const arraysEqual = (left = [], right = []) => (
    left.length === right.length && left.every((value, index) => value === right[index])
);

const buildUserDisplayName = (user = {}) => {
    const first = normalizeText(user?.name?.first);
    const middle = normalizeText(user?.name?.middle);
    const last = normalizeText(user?.name?.last);
    return [first, middle, last].filter(Boolean).join(' ') || normalizeText(user?.email) || 'Unknown User';
};

const mapAppointmentStatusToQueueStatus = (status) => {
    const normalized = normalizeKey(status);
    const legacyStatusMap = {
        waiting: 'pending',
        serving: 'in-clinic',
        done: 'completed',
        skipped: 'cancelled',
    };

    return legacyStatusMap[normalized] || normalized || 'pending';
};

const resolveInventoryBatchStatus = ({ quantityRemaining, expirationDate }, now = new Date()) => {
    const remaining = Number(quantityRemaining);
    if (!Number.isFinite(remaining) || remaining <= 0) return 'Depleted';

    if (expirationDate) {
        const parsed = new Date(expirationDate);
        if (!Number.isNaN(parsed.getTime()) && parsed < now) {
            return 'Expired';
        }
    }

    return 'Active';
};

const buildCheckSummary = (checks) => ({
    total: checks.length,
    issues: checks.reduce((total, check) => total + check.count, 0),
    passed: checks.filter((check) => check.status === 'pass').length,
    warnings: checks.filter((check) => check.status === 'warn').length,
    failed: checks.filter((check) => check.status === 'fail').length,
    ranAt: new Date(),
});

const buildCheckResult = (definition, payload = {}) => {
    const records = Array.isArray(payload.records) ? payload.records : [];

    return {
        checkName: definition.checkName,
        label: definition.label,
        description: definition.description,
        category: definition.category,
        fixMode: definition.fixMode,
        count: records.length,
        status: records.length === 0 ? 'pass' : (payload.status || definition.issueStatus || 'warn'),
        records,
    };
};

const getBranchNameSet = async () => {
    const branches = await Branch.find({}).select('name').lean();
    return new Set(branches.map((branch) => normalizeKey(branch.name)).filter(Boolean));
};

const analyzePatientBranchAssignment = (patient, validBranchNames) => {
    const assignedBranch = normalizeText(patient.assignedBranch);
    const assignedBranches = uniqueStrings(Array.isArray(patient.assignedBranches) ? patient.assignedBranches : []);
    const allReferencedBranches = uniqueStrings([assignedBranch, ...assignedBranches]);
    const invalidBranches = allReferencedBranches.filter((branch) => !validBranchNames.has(normalizeKey(branch)));
    const issueTypes = [];

    if (!assignedBranch && assignedBranches.length === 0) {
        issueTypes.push('Missing branch assignment');
    }
    if (assignedBranch && assignedBranches.length === 0) {
        issueTypes.push('Missing assignedBranches mirror');
    }
    if (!assignedBranch && assignedBranches.length > 0) {
        issueTypes.push('Missing primary assignedBranch');
    }
    if (assignedBranch && assignedBranches.length > 0 && assignedBranches[0] !== assignedBranch) {
        issueTypes.push('Primary branch mismatch');
    }
    if (invalidBranches.length > 0) {
        issueTypes.push('Unknown branch reference');
    }

    let safeUpdate = null;
    if (!invalidBranches.length) {
        const nextAssignedBranch = assignedBranch || assignedBranches[0] || '';
        const nextAssignedBranches = nextAssignedBranch
            ? uniqueStrings([nextAssignedBranch, ...assignedBranches])
            : [];

        if (
            nextAssignedBranch !== assignedBranch
            || !arraysEqual(nextAssignedBranches, assignedBranches)
        ) {
            safeUpdate = {
                assignedBranch: nextAssignedBranch,
                assignedBranches: nextAssignedBranches,
            };
        }
    }

    return {
        patientId: patient._id,
        patientName: buildUserDisplayName(patient),
        email: normalizeText(patient.email),
        assignedBranch,
        assignedBranches,
        invalidBranches,
        issueTypes,
        safeUpdate,
    };
};

const analyzeAssignedDentist = (patient, dentistsById) => {
    const assignedDentistId = patient.assignedDentistId ? String(patient.assignedDentistId) : '';
    const assignedDentistName = normalizeText(patient.assignedDentistName);
    const issueTypes = [];
    let expectedDentistName = '';
    let safeUpdate = null;

    if (!assignedDentistId && !assignedDentistName) {
        return null;
    }

    const dentist = assignedDentistId ? dentistsById.get(assignedDentistId) : null;

    if (assignedDentistId && !dentist) {
        issueTypes.push('Missing dentist account');
        safeUpdate = { assignedDentistId: null, assignedDentistName: '' };
    } else if (dentist && !hasDentistClinicalAccess(dentist)) {
        issueTypes.push('Referenced user is not a dentist');
        safeUpdate = { assignedDentistId: null, assignedDentistName: '' };
    } else if (dentist && dentist.isArchived) {
        issueTypes.push('Assigned dentist is archived');
    } else if (dentist && dentist.status !== 'active') {
        issueTypes.push('Assigned dentist is inactive');
    } else if (dentist) {
        expectedDentistName = buildUserDisplayName(dentist);
        if (!assignedDentistName) {
            issueTypes.push('Assigned dentist name missing');
            safeUpdate = { assignedDentistId: dentist._id, assignedDentistName: expectedDentistName };
        } else if (assignedDentistName !== expectedDentistName) {
            issueTypes.push('Assigned dentist name is out of sync');
            safeUpdate = { assignedDentistId: dentist._id, assignedDentistName: expectedDentistName };
        }
    } else if (assignedDentistName) {
        issueTypes.push('Assigned dentist name has no linked account');
        safeUpdate = { assignedDentistId: null, assignedDentistName: '' };
    }

    if (issueTypes.length === 0) {
        return null;
    }

    return {
        patientId: patient._id,
        patientName: buildUserDisplayName(patient),
        email: normalizeText(patient.email),
        assignedDentistId,
        assignedDentistName,
        expectedDentistName,
        issueTypes,
        safeUpdate,
    };
};

const analyzeInventoryBatch = (batch, item, now = new Date()) => {
    const issueTypes = [];
    const quantityReceived = Number(batch.quantityReceived);
    const quantityRemaining = Number(batch.quantityRemaining);

    let nextQuantityReceived = Number.isFinite(quantityReceived) ? quantityReceived : 0;
    let nextQuantityRemaining = Number.isFinite(quantityRemaining) ? quantityRemaining : 0;
    let nextBranch = normalizeText(batch.branch);

    if (!Number.isFinite(quantityReceived) || quantityReceived < 0) {
        issueTypes.push('Invalid received quantity');
        nextQuantityReceived = Math.max(nextQuantityReceived, 0);
    }
    if (!Number.isFinite(quantityRemaining) || quantityRemaining < 0) {
        issueTypes.push('Invalid remaining quantity');
        nextQuantityRemaining = Math.max(nextQuantityRemaining, 0);
    }
    if (nextQuantityRemaining > nextQuantityReceived) {
        issueTypes.push('Remaining quantity exceeds received quantity');
        nextQuantityRemaining = nextQuantityReceived;
    }
    if (!item) {
        issueTypes.push('Missing inventory item');
    } else if (normalizeKey(batch.branch) !== normalizeKey(item.branch)) {
        issueTypes.push('Batch branch does not match item branch');
        nextBranch = item.branch;
    }

    const expectedStatus = resolveInventoryBatchStatus({
        quantityRemaining: nextQuantityRemaining,
        expirationDate: batch.expirationDate,
    }, now);

    if (normalizeText(batch.status) !== expectedStatus) {
        if (expectedStatus === 'Expired' && normalizeText(batch.status) === 'Active') {
            issueTypes.push('Expired batch still marked active');
        } else if (expectedStatus === 'Depleted') {
            issueTypes.push('Batch should be marked depleted');
        } else if (expectedStatus === 'Active') {
            issueTypes.push('Batch should be marked active');
        } else {
            issueTypes.push(`Batch status should be ${expectedStatus}`);
        }
    }

    const safeUpdate = {};
    if (nextQuantityReceived !== batch.quantityReceived) {
        safeUpdate.quantityReceived = nextQuantityReceived;
    }
    if (nextQuantityRemaining !== batch.quantityRemaining) {
        safeUpdate.quantityRemaining = nextQuantityRemaining;
    }
    if (nextBranch !== normalizeText(batch.branch)) {
        safeUpdate.branch = nextBranch;
    }
    if (expectedStatus !== normalizeText(batch.status)) {
        safeUpdate.status = expectedStatus;
    }

    if (issueTypes.length === 0) {
        return null;
    }

    return {
        batchId: batch._id,
        itemId: item?._id || batch.inventoryItem || null,
        itemName: item?.name || 'Missing Item',
        batchNumber: normalizeText(batch.batchNumber),
        branch: normalizeText(batch.branch),
        itemBranch: item?.branch || '',
        quantityReceived: batch.quantityReceived,
        quantityRemaining: batch.quantityRemaining,
        status: normalizeText(batch.status),
        expectedStatus,
        expirationDate: batch.expirationDate || null,
        issueTypes,
        safeUpdate: Object.keys(safeUpdate).length > 0 ? safeUpdate : null,
    };
};

async function collectOrphanedSurgeries() {
    const surgeries = await Surgery.find({ isArchived: { $ne: true } })
        .select('_id patient dentist procedure date branch')
        .lean();

    const userIds = uniqueIds(surgeries.flatMap((surgery) => [surgery.patient, surgery.dentist]));
    const users = userIds.length > 0
        ? await User.find({ _id: { $in: userIds } }).select('_id').lean()
        : [];
    const existingUserIds = new Set(users.map((user) => String(user._id)));

    const records = surgeries
        .map((surgery) => {
            const missingPatient = surgery.patient && !existingUserIds.has(String(surgery.patient));
            const missingDentist = surgery.dentist && !existingUserIds.has(String(surgery.dentist));

            if (!missingPatient && !missingDentist) {
                return null;
            }

            return {
                id: surgery._id,
                branch: normalizeText(surgery.branch),
                procedure: normalizeText(surgery.procedure),
                date: surgery.date || null,
                missingPatient,
                missingDentist,
                issueTypes: [
                    ...(missingPatient ? ['Missing patient'] : []),
                    ...(missingDentist ? ['Missing dentist'] : []),
                ],
            };
        })
        .filter(Boolean);

    return { records };
}

async function collectQueueAppointmentMismatches() {
    const queueEntries = await Queue.find({ linkedAppointment: { $ne: null } })
        .select('_id linkedAppointment patientName branch status assignedDentist procedureType')
        .lean();

    const appointmentIds = uniqueIds(queueEntries.map((entry) => entry.linkedAppointment));
    const appointments = appointmentIds.length > 0
        ? await Surgery.find({ _id: { $in: appointmentIds } })
            .select('_id branch status source')
            .lean()
        : [];
    const appointmentsById = new Map(appointments.map((appointment) => [String(appointment._id), appointment]));

    const records = [];
    for (const entry of queueEntries) {
        const issueTypes = [];
        const appointment = entry.linkedAppointment
            ? appointmentsById.get(String(entry.linkedAppointment))
            : null;

        let appointmentBranch = '';
        let appointmentStatus = '';
        let source = '';

        if (!appointment) {
            issueTypes.push('Linked appointment no longer exists');
        } else {
            appointmentBranch = normalizeText(appointment.branch);
            appointmentStatus = normalizeText(appointment.status);
            source = normalizeText(appointment.source);

            if (normalizeKey(entry.branch) !== normalizeKey(appointment.branch)) {
                issueTypes.push('Queue branch does not match appointment branch');
            }

            const expectedQueueStatus = mapAppointmentStatusToQueueStatus(appointment.status);
            if (normalizeKey(entry.status) !== expectedQueueStatus) {
                issueTypes.push('Queue status is out of sync with appointment status');
            }

            if (!['walk-in', 'phone call'].includes(normalizeKey(appointment.source))) {
                issueTypes.push('Linked appointment source should not keep a queue entry');
            }
        }

        if (issueTypes.length > 0) {
            records.push({
                queueId: entry._id,
                linkedAppointment: entry.linkedAppointment,
                patientName: normalizeText(entry.patientName),
                branch: normalizeText(entry.branch),
                appointmentBranch,
                queueStatus: normalizeText(entry.status),
                appointmentStatus,
                source,
                issueTypes,
            });
        }
    }

    return { records };
}

async function collectUnverifiedUsers() {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const records = await User.find({
        isArchived: { $ne: true },
        isVerified: false,
        createdAt: { $lt: cutoff },
    })
        .select('_id email role status createdAt')
        .lean();

    return { records };
}

async function collectDuplicateEmails() {
    const records = await User.aggregate([
        { $match: { email: { $type: 'string', $ne: '' } } },
        {
            $group: {
                _id: '$email',
                count: { $sum: 1 },
                ids: { $push: '$_id' },
            },
        },
        { $match: { count: { $gt: 1 } } },
        {
            $project: {
                _id: 0,
                email: '$_id',
                count: 1,
                ids: 1,
            },
        },
    ]);

    return { records };
}

async function collectNormalizedEmailCollisions() {
    const records = await User.aggregate([
        { $match: { email: { $type: 'string', $ne: '' } } },
        {
            $project: {
                email: 1,
                normalizedEmail: {
                    $toLower: {
                        $trim: { input: '$email' },
                    },
                },
            },
        },
        {
            $group: {
                _id: '$normalizedEmail',
                count: { $sum: 1 },
                ids: { $push: '$_id' },
                variants: { $addToSet: '$email' },
            },
        },
        { $match: { count: { $gt: 1 } } },
        {
            $project: {
                _id: 0,
                normalizedEmail: '$_id',
                count: 1,
                ids: 1,
                variants: 1,
            },
        },
    ]);

    return { records };
}

async function collectExpiredTempPasswords() {
    const records = await User.find({
        status: 'inactive',
        isPasswordChanged: false,
        temporaryPasswordExpires: { $lt: new Date() },
    })
        .select('_id email role temporaryPasswordExpires createdAt')
        .lean();

    return { records };
}

async function scanPatientBranchAssignmentIssues() {
    const validBranchNames = await getBranchNameSet();
    const patients = await User.find({
        role: 'patient',
        isArchived: { $ne: true },
    })
        .select('_id name email assignedBranch assignedBranches')
        .lean();

    return patients
        .map((patient) => analyzePatientBranchAssignment(patient, validBranchNames))
        .filter((record) => record.issueTypes.length > 0);
}

async function collectPatientBranchAssignmentIssues() {
    const records = await scanPatientBranchAssignmentIssues();
    return {
        records: records.map(({ safeUpdate, ...record }) => record),
    };
}

async function scanAssignedDentistMismatches() {
    const patients = await User.find({
        role: 'patient',
        isArchived: { $ne: true },
        $or: [
            { assignedDentistId: { $ne: null } },
            { assignedDentistName: { $nin: ['', null] } },
        ],
    })
        .select('_id name email assignedDentistId assignedDentistName')
        .lean();

    const dentistIds = uniqueIds(patients.map((patient) => patient.assignedDentistId));
    const dentists = dentistIds.length > 0
        ? await User.find({ _id: { $in: dentistIds } })
            .select('_id name email role isDentist status isArchived')
            .lean()
        : [];
    const dentistsById = new Map(dentists.map((dentist) => [String(dentist._id), dentist]));

    return patients
        .map((patient) => analyzeAssignedDentist(patient, dentistsById))
        .filter(Boolean);
}

async function collectAssignedDentistMismatches() {
    const records = await scanAssignedDentistMismatches();
    return {
        records: records.map(({ safeUpdate, ...record }) => record),
    };
}

async function scanBranchStaffMismatches() {
    const [branches, branchManagers] = await Promise.all([
        Branch.find({}).select('_id name managerIds').lean(),
        User.find({ role: 'branch-manager', isArchived: { $ne: true } })
            .select('_id name email assignedBranch assignedBranches role')
            .lean(),
    ]);

    const managerIds = uniqueIds(branches.flatMap((branch) => branch.managerIds || []));
    const linkedUsers = managerIds.length > 0
        ? await User.find({ _id: { $in: managerIds } })
            .select('_id name email assignedBranch assignedBranches role')
            .lean()
        : [];

    const branchesByKey = new Map(branches.map((branch) => [normalizeKey(branch.name), branch]));
    const linkedUsersById = new Map(linkedUsers.map((user) => [String(user._id), user]));
    const records = [];

    for (const manager of branchManagers) {
        const assignedBranch = normalizeText(manager.assignedBranch || manager.assignedBranches?.[0] || '');
        const issueTypes = [];
        let branchName = assignedBranch;

        if (!assignedBranch) {
            issueTypes.push('Branch manager has no assigned branch');
        } else {
            const branch = branchesByKey.get(normalizeKey(assignedBranch));
            if (!branch) {
                issueTypes.push('Assigned branch no longer exists');
            } else if (!(branch.managerIds || []).map(String).includes(String(manager._id))) {
                issueTypes.push('Branch manager is not linked on the branch record');
                branchName = branch.name;
            }
        }

        if (issueTypes.length > 0) {
            records.push({
                recordType: 'branch-manager',
                branchName,
                managerName: buildUserDisplayName(manager),
                email: normalizeText(manager.email),
                managerAssignedBranch: assignedBranch,
                managerId: manager._id,
                linkedManagerId: '',
                linkedManagerName: '',
                issueTypes,
            });
        }
    }

    for (const branch of branches) {
        for (const managerId of branch.managerIds || []) {
            const linkedUser = linkedUsersById.get(String(managerId));
            const issueTypes = [];
            let linkedManagerName = '';
            let linkedAssignedBranch = '';

            if (!linkedUser) {
                issueTypes.push('Branch references a missing manager account');
            } else {
                linkedManagerName = buildUserDisplayName(linkedUser);
                linkedAssignedBranch = normalizeText(linkedUser.assignedBranch || linkedUser.assignedBranches?.[0] || '');

                if (linkedUser.role !== 'branch-manager') {
                    issueTypes.push('Branch references a non-manager account');
                }
                if (
                    linkedAssignedBranch
                    && normalizeKey(linkedAssignedBranch) !== normalizeKey(branch.name)
                ) {
                    issueTypes.push('Linked manager is assigned to a different branch');
                }
            }

            if (issueTypes.length > 0) {
                records.push({
                    recordType: 'branch',
                    branchName: branch.name,
                    managerName: '',
                    email: normalizeText(linkedUser?.email),
                    managerAssignedBranch: linkedAssignedBranch,
                    managerId: '',
                    linkedManagerId: managerId,
                    linkedManagerName,
                    issueTypes,
                });
            }
        }
    }

    return records;
}

async function collectBranchStaffMismatches() {
    const records = await scanBranchStaffMismatches();
    return { records };
}

async function scanInventoryBatchIssues() {
    const batches = await InventoryBatch.find({})
        .select('_id inventoryItem quantityReceived quantityRemaining expirationDate status branch batchNumber')
        .lean();

    const itemIds = uniqueIds(batches.map((batch) => batch.inventoryItem));
    const items = itemIds.length > 0
        ? await InventoryItem.find({ _id: { $in: itemIds } })
            .select('_id name branch')
            .lean()
        : [];
    const itemsById = new Map(items.map((item) => [String(item._id), item]));
    const now = new Date();

    return batches
        .map((batch) => analyzeInventoryBatch(batch, itemsById.get(String(batch.inventoryItem)), now))
        .filter(Boolean);
}

async function collectInventoryBatchIssues() {
    const records = await scanInventoryBatchIssues();
    return {
        records: records.map(({ safeUpdate, ...record }) => record),
    };
}

async function fixOrphanedSurgeries() {
    const scan = await collectOrphanedSurgeries();
    const ids = scan.records.map((record) => record.id);

    if (ids.length === 0) {
        return { fixed: 0, action: 'No orphaned appointments required archiving' };
    }

    const result = await Surgery.updateMany(
        { _id: { $in: ids } },
        {
            $set: {
                isArchived: true,
                archivedAt: new Date(),
                status: 'cancelled',
                notes: 'Auto-archived by Integrity Tools: linked user no longer exists.',
            },
        }
    );

    return { fixed: result.modifiedCount, action: 'Archived orphaned appointments' };
}

async function fixUnverifiedUsers() {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = await User.updateMany(
        {
            isArchived: { $ne: true },
            isVerified: false,
            createdAt: { $lt: cutoff },
        },
        { $set: { status: 'inactive' } }
    );

    return { fixed: result.modifiedCount, action: 'Set stale unverified accounts to inactive' };
}

async function fixExpiredTempPasswords() {
    const result = await User.updateMany(
        {
            status: 'inactive',
            isPasswordChanged: false,
            temporaryPasswordExpires: { $lt: new Date() },
        },
        {
            $unset: {
                temporaryPasswordExpires: '',
                activationToken: '',
            },
        }
    );

    return { fixed: result.modifiedCount, action: 'Cleared expired temporary-password fields' };
}

async function fixPatientBranchAssignmentIssues() {
    const records = await scanPatientBranchAssignmentIssues();
    let fixed = 0;

    for (const record of records) {
        if (!record.safeUpdate) continue;

        const result = await User.updateOne(
            { _id: record.patientId },
            { $set: record.safeUpdate }
        );

        if (result.modifiedCount > 0) {
            fixed += 1;
        }
    }

    return {
        fixed,
        action: 'Synchronized patient branch shortcut fields where the source branch was unambiguous',
    };
}

async function fixAssignedDentistMismatches() {
    const records = await scanAssignedDentistMismatches();
    let fixed = 0;

    for (const record of records) {
        if (!record.safeUpdate) continue;

        const result = await User.updateOne(
            { _id: record.patientId },
            { $set: record.safeUpdate }
        );

        if (result.modifiedCount > 0) {
            fixed += 1;
        }
    }

    return {
        fixed,
        action: 'Synchronized assigned dentist names and cleared invalid dentist references',
    };
}

async function fixBranchStaffMismatches() {
    const [branches, branchManagers] = await Promise.all([
        Branch.find({}).select('_id name managerIds').lean(),
        User.find({ role: 'branch-manager', isArchived: { $ne: true } })
            .select('_id assignedBranch assignedBranches')
            .lean(),
    ]);

    const managerIds = uniqueIds(branches.flatMap((branch) => branch.managerIds || []));
    const linkedUsers = managerIds.length > 0
        ? await User.find({ _id: { $in: managerIds } }).select('_id role').lean()
        : [];

    const branchesByKey = new Map(branches.map((branch) => [normalizeKey(branch.name), branch]));
    const linkedUsersById = new Map(linkedUsers.map((user) => [String(user._id), user]));
    const actionKeys = new Set();
    let fixed = 0;

    for (const manager of branchManagers) {
        const assignedBranch = normalizeText(manager.assignedBranch || manager.assignedBranches?.[0] || '');
        if (!assignedBranch) continue;

        const branch = branchesByKey.get(normalizeKey(assignedBranch));
        if (!branch) continue;

        if (!(branch.managerIds || []).map(String).includes(String(manager._id))) {
            const actionKey = `add:${branch._id}:${manager._id}`;
            if (actionKeys.has(actionKey)) continue;
            actionKeys.add(actionKey);

            const result = await Branch.updateOne(
                { _id: branch._id },
                { $addToSet: { managerIds: manager._id } }
            );

            if (result.modifiedCount > 0) {
                fixed += 1;
            }
        }
    }

    for (const branch of branches) {
        for (const managerId of branch.managerIds || []) {
            const linkedUser = linkedUsersById.get(String(managerId));
            if (linkedUser && linkedUser.role === 'branch-manager') continue;

            const actionKey = `pull:${branch._id}:${managerId}`;
            if (actionKeys.has(actionKey)) continue;
            actionKeys.add(actionKey);

            const result = await Branch.updateOne(
                { _id: branch._id },
                { $pull: { managerIds: managerId } }
            );

            if (result.modifiedCount > 0) {
                fixed += 1;
            }
        }
    }

    return {
        fixed,
        action: 'Synchronized branch manager links and removed invalid branch manager references',
    };
}

async function fixInventoryBatchIssues() {
    const records = await scanInventoryBatchIssues();
    let fixed = 0;

    for (const record of records) {
        if (!record.safeUpdate) continue;

        const result = await InventoryBatch.updateOne(
            { _id: record.batchId },
            { $set: record.safeUpdate }
        );

        if (result.modifiedCount > 0) {
            fixed += 1;
        }
    }

    return {
        fixed,
        action: 'Normalized inventory batch quantities, branch links, and lifecycle status values',
    };
}

const INTEGRITY_CHECKS = [
    {
        checkName: 'orphaned_surgeries',
        label: 'Orphaned Appointments',
        description: 'Appointments whose linked patient or dentist account no longer exists.',
        category: 'Appointments',
        fixMode: 'safe',
        issueStatus: 'fail',
        run: collectOrphanedSurgeries,
        fix: fixOrphanedSurgeries,
    },
    {
        checkName: 'queue_appointment_mismatches',
        label: 'Queue / Appointment Mismatches',
        description: 'Queue records that no longer line up with their linked appointment source, branch, or status.',
        category: 'Appointments',
        fixMode: 'manual',
        issueStatus: 'warn',
        run: collectQueueAppointmentMismatches,
    },
    {
        checkName: 'patient_branch_assignment_issues',
        label: 'Patient Branch Assignment Issues',
        description: 'Patients whose branch shortcut fields are missing, out of sync, or point to unknown branches.',
        category: 'Patients',
        fixMode: 'safe',
        issueStatus: 'warn',
        run: collectPatientBranchAssignmentIssues,
        fix: fixPatientBranchAssignmentIssues,
    },
    {
        checkName: 'assigned_dentist_mismatches',
        label: 'Assigned Dentist Mismatches',
        description: 'Patients whose assigned dentist fields are stale, missing, or linked to the wrong account type.',
        category: 'Patients',
        fixMode: 'safe',
        issueStatus: 'warn',
        run: collectAssignedDentistMismatches,
        fix: fixAssignedDentistMismatches,
    },
    {
        checkName: 'branch_staff_mismatches',
        label: 'Branch Staff Link Mismatches',
        description: 'Branch manager assignments that do not match the branch record, or branch records that reference invalid manager accounts.',
        category: 'Branches',
        fixMode: 'safe',
        issueStatus: 'warn',
        run: collectBranchStaffMismatches,
        fix: fixBranchStaffMismatches,
    },
    {
        checkName: 'inventory_batch_issues',
        label: 'Inventory Batch Issues',
        description: 'Inventory batches with bad quantities, wrong lifecycle status, missing item references, or branch mismatches.',
        category: 'Inventory',
        fixMode: 'safe',
        issueStatus: 'warn',
        run: collectInventoryBatchIssues,
        fix: fixInventoryBatchIssues,
    },
    {
        checkName: 'unverified_users',
        label: 'Stale Unverified Accounts',
        description: 'User accounts that have been unverified for more than 14 days.',
        category: 'Security',
        fixMode: 'safe',
        issueStatus: 'warn',
        run: collectUnverifiedUsers,
        fix: fixUnverifiedUsers,
    },
    {
        checkName: 'duplicate_emails',
        label: 'Duplicate Email Addresses',
        description: 'Email addresses that appear more than once in the users collection.',
        category: 'Security',
        fixMode: 'manual',
        issueStatus: 'fail',
        run: collectDuplicateEmails,
    },
    {
        checkName: 'normalized_email_collisions',
        label: 'Normalized Email Collisions',
        description: 'Emails that collide after trim and lowercase normalization and should be reviewed before they become account conflicts.',
        category: 'Security',
        fixMode: 'manual',
        issueStatus: 'fail',
        run: collectNormalizedEmailCollisions,
    },
    {
        checkName: 'expired_temp_passwords',
        label: 'Expired Temporary Passwords',
        description: 'Inactive accounts whose temporary passwords expired before the user changed them.',
        category: 'Security',
        fixMode: 'safe',
        issueStatus: 'warn',
        run: collectExpiredTempPasswords,
        fix: fixExpiredTempPasswords,
    },
];

const CHECK_MAP = new Map(INTEGRITY_CHECKS.map((definition) => [definition.checkName, definition]));

const runIntegrityCheck = async (definition) => {
    const payload = await definition.run();
    return buildCheckResult(definition, payload);
};

router.get('/integrity/run-checks', verifyToken, isAdmin, async (req, res) => {
    try {
        const checks = await Promise.all(INTEGRITY_CHECKS.map((definition) => runIntegrityCheck(definition)));
        res.json({
            summary: buildCheckSummary(checks),
            checks,
        });
    } catch (error) {
        console.error('Integrity check error:', error);
        res.status(500).json({ message: 'Server error running integrity checks.' });
    }
});

router.get('/integrity/run-checks/:checkName', verifyToken, isAdmin, async (req, res) => {
    try {
        const definition = CHECK_MAP.get(req.params.checkName);
        if (!definition) {
            return res.status(400).json({ message: `Unknown check: ${req.params.checkName}` });
        }

        const check = await runIntegrityCheck(definition);
        res.json({ check });
    } catch (error) {
        console.error('Integrity single-check error:', error);
        res.status(500).json({ message: 'Server error running the selected integrity check.' });
    }
});

router.post('/integrity/fix/:checkName', verifyToken, isAdmin, async (req, res) => {
    try {
        const definition = CHECK_MAP.get(req.params.checkName);
        if (!definition) {
            return res.status(400).json({ message: `Unknown check: ${req.params.checkName}` });
        }
        if (definition.fixMode !== 'safe' || typeof definition.fix !== 'function') {
            return res.status(400).json({
                message: 'This integrity check requires manual review. Auto-fix is disabled to avoid unintended data changes.',
            });
        }

        const result = await definition.fix();

        await AuditLog.create({
            action: 'INTEGRITY_FIX',
            user: req.user.email,
            role: req.user.role,
            details: `Integrity fix applied for check: ${definition.checkName}. ${result.action}. ${result.fixed} record(s) affected.`,
        });

        res.json({
            message: `Fix applied for "${definition.checkName}".`,
            result,
        });
    } catch (error) {
        console.error('Integrity fix error:', error);
        res.status(500).json({ message: 'Server error applying fix.' });
    }
});

module.exports = router;
