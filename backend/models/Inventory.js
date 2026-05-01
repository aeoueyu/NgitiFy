const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    itemName: { type: String, required: true },
    category: { type: String, required: true }, // e.g., 'Anesthetics', 'Gloves', 'Dental Tools'
    quantity: { type: Number, required: true, default: 0 },
    unit: { type: String, required: true }, // e.g., 'box', 'piece', 'bottle'
    supplier: { type: String },
    reorderLevel: { type: Number, default: 10 }, // Alert when quantity drops to this level
    branch: { type: String, default: '' } // Branch this item belongs to; empty = shared/unassigned
}, { timestamps: true });

inventorySchema.index({ itemName: 1, branch: 1 }, { unique: true });

module.exports = mongoose.model('Inventory', inventorySchema);
