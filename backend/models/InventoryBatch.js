const mongoose = require('mongoose');

const inventoryBatchSchema = new mongoose.Schema({
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    brand: { type: String, required: true, trim: true, default: 'Unspecified' },
    quantityReceived: { type: Number, required: true, min: 0, default: 0 },
    quantityRemaining: { type: Number, required: true, min: 0, default: 0 },
    expirationDate: { type: Date, default: null },
    receivedDate: { type: Date, required: true, default: Date.now },
    supplierName: { type: String, default: '', trim: true },
    batchNumber: { type: String, default: '', trim: true },
    stockInNumber: { type: String, default: '', trim: true },
    status: {
        type: String,
        enum: ['Active', 'Depleted', 'Expired'],
        default: 'Active',
    },
    branch: { type: String, required: true, default: '' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    legacyInventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', default: undefined },
}, { timestamps: true });

inventoryBatchSchema.index({ inventoryItem: 1, receivedDate: 1 });
inventoryBatchSchema.index({ branch: 1, status: 1, expirationDate: 1 });
inventoryBatchSchema.index(
    { stockInNumber: 1 },
    {
        unique: true,
        partialFilterExpression: { stockInNumber: { $exists: true, $type: 'string', $gt: '' } },
    }
);
inventoryBatchSchema.index(
    { legacyInventoryId: 1 },
    {
        unique: true,
        partialFilterExpression: { legacyInventoryId: { $exists: true, $type: 'objectId' } },
    }
);

module.exports = mongoose.model('InventoryBatch', inventoryBatchSchema);
