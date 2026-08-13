const mongoose = require('mongoose');

const symptomDetailSchema = new mongoose.Schema({
    severity: { type: String, default: '' },
    duration: { type: String, default: '' },
}, { _id: false });

const oralHealthLogSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    logDate: { type: Date, required: true },
    logDateKey: { type: String, required: true },
    symptoms: [{ type: String }],
    dailyCare: [{ type: String }],
    riskFactors: [{ type: String }],
    symptomDetails: {
        type: Map,
        of: symptomDetailSchema,
        default: {},
    },
    notes: { type: String, default: '' },
}, { timestamps: true });

oralHealthLogSchema.index({ patient: 1, logDateKey: 1 }, { unique: true });

module.exports = mongoose.models.OralHealthLog || mongoose.model('OralHealthLog', oralHealthLogSchema);
