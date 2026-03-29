const mongoose = require('mongoose');

// Sub-schema para sa Address para malinis tignan
const addressSchema = new mongoose.Schema({
    country: { type: String, default: 'Philippines' },
    region: { type: String },
    province: { type: String },
    city: { type: String },
    barangay: { type: String },
    houseNumber: { type: String },
    street: { type: String }
}, { _id: false }); 

const userSchema = new mongoose.Schema({
    // 1. NESTED NAME OBJECT
    name: {
        first: { type: String, required: true },
        middle: { type: String, default: '' },
        last: { type: String, required: true }
    },

    // 2. CREDENTIALS
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['owner', 'dentist', 'secretary', 'patient'], 
        default: 'patient' 
    },

    // 3. PERSONAL DETAILS
    contactNumber: { type: String },
    birthdate: { type: Date },
    profileImage: { type: String }, // Base64 string
    
    // 4. DENTIST SPECIFIC
    licenseNumber: { type: String },
    specialization: { type: String },

    // 5. NESTED ADDRESS OBJECTS
    currentAddress: addressSchema,
    permanentAddress: addressSchema,

    // 6. MEDICAL HISTORY
    medicalHistory: {
        allergies: [{ type: String }],
        conditions: [{ type: String }]
    },

    // 7. SECURITY & VERIFICATION
    isVerified: { type: Boolean, default: false },
    activationToken: { type: String },
    isPasswordChanged: { type: Boolean, default: false },
    temporaryPasswordExpires: { type: Date },
    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },

    // 8. GUARDIAN (Optional for minors)
    guardian: {
        name: { type: String },
        relationship: { type: String },
        contactNumber: { type: String }
    }, 

    // 9. LEAVE REQUESTS (for staff)
    leaveRequests: [{
        startDate: { type: Date },
        endDate: { type: Date },
        reason: { type: String },
        status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' }
    }],

    // FIX: Default status is now 'inactive' until email verified
    status: { type: String, enum: ['active', 'inactive'], default: 'inactive' }

}, { timestamps: true }); 

module.exports = mongoose.model('User', userSchema);