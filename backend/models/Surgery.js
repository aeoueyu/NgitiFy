const mongoose = require('mongoose');

const surgerySchema = new mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branch: { type: String, required: true }, // e.g., 'Main Clinic', 'Downtown Branch'
    date: { type: Date, required: true },
    procedure: { type: String, required: true }, // e.g., 'Wisdom Tooth Extraction'
    notes: { type: String }
    // Removed 'fee' and 'isPaid' to strictly enforce non-financial constraints
}, { timestamps: true });

module.exports = mongoose.model('Surgery', surgerySchema);