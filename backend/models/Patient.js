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
    // Personal Information
    name: {
        first: { type: String, required: true },
        middle: { type: String, default: '' },
        last: { type: String, required: true }
    },
    birthdate: { type: Date, required: true },
    
    // FIXED: Added 'Prefer not to say' to the enum
    gender: { type: String, enum: ['Male', 'Female', 'Other', 'Prefer not to say'], required: true },
    
    contactNumber: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    currentAddress: addressSchema,
    permanentAddress: addressSchema,

    // Medical Information
    medicalHistory: {
        allergies: [{ type: String }],
        conditions: [{ type: String }]
    },
    
    // Dental Information
    treatmentHistory: [{
        date: { type: Date, default: Date.now },
        tooth: String, // e.g., 'Upper Right 1'
        procedure: String,
        notes: String,
        dentist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],

    // Link to the main user account if they have one
    userAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },

    // Guardian Information (For Minors)
    guardian: {
        name: { type: String },
        relationship: { type: String },
        contactNumber: { type: String }
    }

}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);