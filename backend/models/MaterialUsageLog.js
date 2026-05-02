// backend/models/MaterialUsageLog.js
const mongoose = require('mongoose');

const materialItemSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit:     { type: String, required: true, default: 'piece' },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
    consumedBatches: [{
        batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryBatch', required: true },
        brand: { type: String, default: '' },
        quantity: { type: Number, required: true, min: 0 },
    }],
}, { _id: false });

const materialUsageLogSchema = new mongoose.Schema({
    dentistId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dentistName:   { type: String },
    patientId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    patientName:   { type: String, default: '' },
    procedureType: { type: String, required: true },
    materials:     [materialItemSchema],
    usedAt:        { type: Date, default: Date.now },
    notes:         { type: String, default: '' },
    branch:        { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('MaterialUsageLog', materialUsageLogSchema);
