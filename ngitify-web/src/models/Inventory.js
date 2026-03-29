const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    itemName: { type: String, required: true, unique: true },
    category: { type: String, required: true }, // e.g., 'Anesthetics', 'Gloves', 'Dental Tools'
    quantity: { type: Number, required: true, default: 0 },
    unit: { type: String, required: true }, // e.g., 'box', 'piece', 'bottle'
    supplier: { type: String },
    reorderLevel: { type: Number, default: 10 } // Alert when quantity drops to this level
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);
