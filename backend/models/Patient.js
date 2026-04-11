const mongoose = require('mongoose');

// Sub-schema for Address consistency
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
    // Task 25 Fix: Aligned Name Structure
    name: {
        first: { type: String, required: true },
        middle: { type: String, default: '' },
        last: { type: String, required: true }
    },

    email: { type: String, unique: true, sparse: true }, // sparse allows multiple nulls if email is missing
    contactNumber: { type: String },
    birthdate: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    
    // Physical Metrics
    height: { type: String }, // e.g., "170 cm"
    weight: { type: String }, // e.g., "70 kg"
    bloodType: { type: String },

    // Address
    address: addressSchema,

    // Clinical Data
    medicalHistory: {
        allergies: [{ type: String }],
        conditions: [{ type: String }], // e.g., Diabetes, Hypertension
        medications: [{ type: String }]
    },

    // Occupation/Emergency Contact
    occupation: { type: String },
    emergencyContact: {
        name: { type: String },
        relationship: { type: String },
        contactNumber: { type: String }
    },

    // System Fields
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }

}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);