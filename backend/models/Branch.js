const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    address: { type: String, trim: true, default: '' },
    addressDetails: {
        region: { type: String, default: '' },
        province: { type: String, default: '' },
        city: { type: String, default: '' },
        barangay: { type: String, default: '' },
        street: { type: String, default: '' },
        houseNumber: { type: String, default: '' },
    },
    contactNumber: { type: String, trim: true, default: '' },
    managerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);
