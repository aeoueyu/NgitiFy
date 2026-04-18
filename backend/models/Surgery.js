const mongoose = require('mongoose');

const surgerySchema = new mongoose.Schema({
    // ✅ FIX: Changed ref from 'Patient' to 'User' — patients are stored in the User collection
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    branch: { type: String, required: true }, // e.g., 'Marikina Branch', 'Rizal Branch'
    date: { type: Date, required: true },
    time: { type: String }, // e.g., "09:00 AM"
    duration: { type: String }, // e.g., "60 min"

    procedure: { type: String, required: true }, // e.g., 'Wisdom Tooth Extraction'
    notes: { type: String },

    // Appointment lifecycle status
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    },

    // Where the appointment came from
    source: {
        type: String,
        enum: ['Smile Hub (Online)', 'Walk-in', 'Phone Call'],
        default: 'Walk-in'
    },

    // Pre-operative instructions written by the dentist for the patient to view on mobile
    preOpInstructions: { type: String },

    // The User (patient) who submitted the online booking request, if applicable
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Cancellation / rescheduling remarks from the secretary
    remarks: { type: String },

}, { timestamps: true });

module.exports = mongoose.model('Surgery', surgerySchema);