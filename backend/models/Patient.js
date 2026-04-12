const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    country: { type: String, default: 'Philippines' },
    region: { type: String },
    province: { type: String },
    city: { type: String },
    barangay: { type: String },
    houseNumber: { type: String },
    street: { type: String }
}, { _id: false });

const patientSchema = new mongoose.Schema({
    name: {
        first: { type: String, required: true },
        middle: { type: String, default: '' },
        last: { type: String, required: true }
    },

    email: { type: String, unique: true, sparse: true },
    contactNumber: { type: String },
    birthdate: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    
    height: { type: String },
    weight: { type: String },
    bloodType: { type: String },

    address: addressSchema,

    medicalHistory: {
        allergies: [{ type: String }],
        conditions: [{ type: String }],
        medications: [{ type: String }]
    },

    occupation: { type: String },
    emergencyContact: {
        name: { type: String },
        relationship: { type: String },
        contactNumber: { type: String }
    },

    // ✅ FIX: Added activation/verification fields (same as User model)
    isVerified: { type: Boolean, default: false },
    activationToken: { type: String },
    temporaryPasswordExpires: { type: Date },

    status: { type: String, enum: ['active', 'inactive'], default: 'inactive' } // ✅ FIX: default changed to 'inactive'

}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);