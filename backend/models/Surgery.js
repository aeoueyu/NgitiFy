// backend/models/Surgery.js

const mongoose = require('mongoose');

const surgerySchema = new mongoose.Schema({
    // ✅ FIX: Changed ref from 'Patient' to 'User' — patients are stored in the User collection
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    guestName:  { type: String, trim: true },
    guestEmail: { type: String, trim: true, lowercase: true },
    guestPhone: { type: String, trim: true },

    branch: { type: String, required: true },
    date:   { type: Date,   required: true },
    time:   { type: String },
    duration: { type: String },

    procedure: { type: String, required: true },
    notes:     { type: String },

    // ✅ FIX Bug 27: Added 'in-clinic' to match the check-in action from the secretary UI
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'],
        default: 'pending',
    },

    source: {
        type: String,
        enum: ['Smile Hub (Online)', 'Walk-in', 'Phone Call'],
        default: 'Walk-in',
    },

    preOpInstructions: { type: String },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks:     { type: String },

}, { timestamps: true });

module.exports = mongoose.model('Surgery', surgerySchema);
