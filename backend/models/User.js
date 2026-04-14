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

// ✅ NEW: Embedded treatment log subdocument (used for patient EMR)
const treatmentLogSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    procedure: { type: String, required: true },
    tooth: { type: String }, // e.g., "45", "18, 28", "All"
    category: {
        type: String,
        enum: ['Restoration', 'Extraction', 'Prophylaxis', 'Orthodontics', 'Endodontics', 'Prosthodontics', 'Oral Surgery', 'Consultation', 'Other'],
        default: 'Other'
    },
    notes: { type: String },
    dentistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dentistName: { type: String }, // stored separately so it survives staff changes
    branch: { type: String },
}, { timestamps: true });

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
        enum: ['owner', 'co-owner', 'dentist', 'secretary', 'patient'],
        required: true
    },

    // Task 13 Fix: Added permissions field
    permissions: {
        type: Object,
        default: {}
    },

    // 3. PERSONAL DETAILS
    contactNumber: { type: String },
    birthdate: { type: Date },
    gender: { type: String },
    profileImage: { type: String },

    // ✅ NEW: Additional patient demographics required by FR#13 / Table 4
    suffix: { type: String },       // e.g., Jr., Sr., III
    civilStatus: { type: String },  // e.g., Single, Married, Widowed
    religion: { type: String },
    nationality: { type: String, default: 'Filipino' },
    birthplace: { type: String },

    // 4. STAFF-SPECIFIC
    licenseNumber: { type: String },
    specialization: { type: String },

    // 5. PATIENT-SPECIFIC FIELDS
    height: { type: String },
    weight: { type: String },
    bloodType: { type: String },
    occupation: { type: String },
    emergencyContact: {
        name: { type: String },
        relationship: { type: String },
        contactNumber: { type: String }
    },

    // 6. NESTED ADDRESS OBJECTS
    currentAddress: addressSchema,
    permanentAddress: addressSchema,

    // 7. MEDICAL HISTORY
    medicalHistory: {
        allergies: [{ type: String }],
        conditions: [{ type: String }],
        medications: [{ type: String }],
        // ✅ NEW: Free-text notes field for the dentist to fill in EMR
        notes: { type: String }
    },

    // ✅ NEW: DENTAL HISTORY (for EMR — general notes, last exam, etc.)
    dentalHistory: {
        lastExamDate: { type: Date },
        chiefComplaint: { type: String },
        notes: { type: String }
    },

    // ✅ NEW: TREATMENT LOGS — embedded array for dentist post-treatment entries
    treatmentLogs: [treatmentLogSchema],

    // ✅ NEW: ODONTOGRAM — map of tooth number (as string) → status string
    // e.g., { "18": "missing", "26": "crown", "45": "decayed" }
    odontogram: {
        type: Map,
        of: String,
        default: {}
    },

    // 8. SECURITY & VERIFICATION
    isVerified: { type: Boolean, default: false },
    activationToken: { type: String },
    isPasswordChanged: { type: Boolean, default: false },
    temporaryPasswordExpires: { type: Date },
    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },

    // 9. GUARDIAN (Optional for minors)
    guardian: {
        name: { type: String },
        relationship: { type: String },
        contactNumber: { type: String }
    },

    // 10. LEAVE REQUESTS (for staff)
    leaveRequests: [{
        startDate: { type: Date },
        endDate: { type: Date },
        reason: { type: String },
        status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' }
    }],

    // FIX: Default status is 'inactive' until email verified
    status: { type: String, enum: ['active', 'inactive'], default: 'inactive' },

    // ✅ NEW: Archive flag — replaces hard-delete for dentists and secretaries (Owner FR#7, FR#11)
    isArchived: { type: Boolean, default: false }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);