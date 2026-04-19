const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        unique: true,
        enum: ['co-administrator', 'branch-manager', 'dentist', 'secretary']
    },
    permissions: {
        appointments:     { type: String, enum: ['full_access', 'read_only', 'no_access'], default: 'read_only' },
        patients:         { type: String, enum: ['full_access', 'read_only', 'no_access'], default: 'read_only' },
        inventory:        { type: String, enum: ['full_access', 'read_only', 'no_access'], default: 'read_only' },
        userManagement:   { type: String, enum: ['full_access', 'read_only', 'no_access'], default: 'no_access' },
        auditTrail:       { type: String, enum: ['full_access', 'read_only', 'no_access'], default: 'no_access' },
        queue:            { type: String, enum: ['full_access', 'read_only', 'no_access'], default: 'read_only' },
        systemConfig:     { type: String, enum: ['full_access', 'read_only', 'no_access'], default: 'no_access' },
    },
    updatedBy: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('RolePermission', rolePermissionSchema);