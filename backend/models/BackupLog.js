const mongoose = require('mongoose');

const backupLogSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true,
        trim: true
    },

    // File size in bytes — stored as Number for easy formatting on the frontend
    size: {
        type: Number,
        default: 0
    },

    status: {
        type: String,
        enum: ['success', 'failed'],
        default: 'success'
    },

    // Optional error message if the backup failed
    errorMessage: {
        type: String,
        default: null
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdByName: {
        type: String,
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model('BackupLog', backupLogSchema);