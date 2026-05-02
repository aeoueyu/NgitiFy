const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true, default: 'pcs' },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 10 },
    branch: { type: String, required: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

inventoryItemSchema.index({ name: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
