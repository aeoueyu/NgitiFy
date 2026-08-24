const mongoose = require('mongoose');

const backupLogSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true,
        trim: true,
    },

    size: {
        type: Number,
        default: 0,
    },

    storageProvider: {
        type: String,
        enum: ['local', 'r2'],
        default: 'local',
    },

    storageKey: {
        type: String,
        default: '',
        trim: true,
    },

    status: {
        type: String,
        enum: ['running', 'success', 'failed'],
        default: 'running',
    },

    triggerType: {
        type: String,
        enum: ['manual', 'scheduled'],
        default: 'manual',
    },

    checksumSha256: {
        type: String,
        default: '',
        trim: true,
    },

    durationMs: {
        type: Number,
        default: 0,
        min: 0,
    },

    startedAt: {
        type: Date,
        default: Date.now,
    },

    completedAt: {
        type: Date,
        default: null,
    },

    toolVersion: {
        type: String,
        default: '',
        trim: true,
    },

    retentionDeletedAt: {
        type: Date,
        default: null,
    },

    retentionReason: {
        type: String,
        default: '',
        trim: true,
    },

    errorMessage: {
        type: String,
        default: null,
    },

    verificationStatus: {
        type: String,
        enum: ['unverified', 'verified', 'failed'],
        default: 'unverified',
    },

    verifiedAt: {
        type: Date,
        default: null,
    },

    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },

    verifiedByName: {
        type: String,
        default: '',
        trim: true,
    },

    verificationDurationMs: {
        type: Number,
        default: 0,
        min: 0,
    },

    verificationCollections: {
        type: Number,
        default: 0,
        min: 0,
    },

    verificationDocuments: {
        type: Number,
        default: 0,
        min: 0,
    },

    verificationTempDb: {
        type: String,
        default: '',
        trim: true,
    },

    verificationError: {
        type: String,
        default: '',
        trim: true,
    },

    restoreToolVersion: {
        type: String,
        default: '',
        trim: true,
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },

    createdByName: {
        type: String,
        required: true,
        trim: true,
    },
}, { timestamps: true });

backupLogSchema.index({ createdAt: -1 });
backupLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('BackupLog', backupLogSchema);
