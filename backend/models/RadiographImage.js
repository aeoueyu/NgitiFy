// backend/models/RadiographImage.js
// Standalone radiograph model for per-patient image management via the admin EMR.
// Note: User.js also contains an inline radiographSchema for embedded subdocs —
// this model is used for the dedicated /api/patients/:id/radiographs endpoints.
const mongoose = require('mongoose');

const radiographImageSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    label: {
        type: String,
        required: true,
        trim: true
        // e.g., "Periapical - Upper Left", "Panoramic", "Bitewing"
    },

    // Base64 encoded image data or a cloud storage URL (Cloudinary, S3, etc.)
    // Prefix with 'data:image/...' for base64, or plain URL for cloud storage.
    url: {
        type: String,
        required: true
    },

    notes: {
        type: String,
        trim: true,
        default: ''
    },

    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedByName: {
        type: String,
        required: true
    },

    uploadedAt: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

// Fast lookups: all radiographs for a given patient
radiographImageSchema.index({ patientId: 1, uploadedAt: -1 });

module.exports = mongoose.model('RadiographImage', radiographImageSchema);