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
