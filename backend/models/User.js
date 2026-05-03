// backend/models/User.js
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

const treatmentLogSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    procedure: { type: String, required: true },
    tooth: { type: String },
    category: {
        type: String,
        enum: ['Restoration', 'Extraction', 'Prophylaxis', 'Orthodontics', 'Endodontics', 'Prosthodontics', 'Oral Surgery', 'Consultation', 'Other'],
        default: 'Other'
    },
    notes: { type: String },
    dentistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dentistName: { type: String },
    branch: { type: String },
}, { timestamps: true });

// ✅ PHASE 2: Radiograph subdocument schema
const radiographSchema = new mongoose.Schema({
    label: { type: String, required: true },
    date: { type: Date, required: true },
    radiographNumber: { type: String, default: '' },
    url: { type: String },       // base64 image data or external URL
    findings: { type: String, default: '' },
    notes: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
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
        required: true,
        enum: [
            'administrator',
            'branch-manager',
            'dentist',
            'secretary',
            'patient',
            'owner',       // keep during migration
            'co-owner'     // keep during migration
        ],
        default: 'patient'
    },

    permissions: {
        type: Object,
        default: {}
    },

    // Single-branch shortcut used by patient and branch-manager flows.
    assignedBranch: { type: String, default: '' },

    // ✅ PHASE 2: Branch assignment for staff members
    assignedBranches: [{ type: String }], 

    // 3. PERSONAL DETAILS
    contactNumber: { type: String },
    birthdate: { type: Date },
    gender: { type: String },
    profileImage: { type: String },

    suffix: { type: String },
    civilStatus: { type: String },
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
    homePhone: { type: String },
    occupation: { type: String },
    workPhone: { type: String },
    referredBy: { type: String },
    reasonForConsultation: { type: String },
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
        notes: { type: String },
        inGoodHealth: { type: Boolean },
        underMedicalTreatment: { type: Boolean },
        medicalTreatmentDetails: { type: String },
        hadSeriousIllnessOrSurgery: { type: Boolean },
        seriousIllnessOrSurgeryDetails: { type: String },
        hadHospitalization: { type: Boolean },
        hospitalizationDetails: { type: String },
        isTakingMedication: { type: Boolean },
        usesTobacco: { type: Boolean },
        usesAlcoholOrDrugs: { type: Boolean },
        hasAllergies: { type: Boolean },
        bleedingTime: { type: String },
        bloodPressure: { type: String },
        isPregnant: { type: Boolean },
        isNursing: { type: Boolean },
        takingBirthControl: { type: Boolean }
    },

    dentalHistory: {
        lastExamDate: { type: Date },
        chiefComplaint: { type: String },
        notes: { type: String },
        hadTreatmentReaction: { type: Boolean },
        reactionDetails: { type: String },
        hasConfidentialInfo: { type: Boolean, default: false }
    },

    physician: {
        name: { type: String },
        specialty: { type: String },
        officeAddress: { type: String },
        officeNumber: { type: String }
    },

    consentAcknowledgement: {
        acknowledged: { type: Boolean, default: false },
        signerName: { type: String },
        signerRole: { type: String },
        signedAt: { type: Date },
        version: { type: String, default: 'Dentime Patient Form v6.1' }
    },

    dataPrivacyConsent: {
        acknowledged: { type: Boolean, default: false },
        signerName: { type: String },
        signerRole: { type: String },
        signedAt: { type: Date },
        version: { type: String, default: 'Data Privacy Act of 2012' }
    },
    appConsentGiven: { type: Boolean, default: false },
    appConsentTimestamp: { type: Date, default: null },

    // 8. EMR DATA
    treatmentLogs: [treatmentLogSchema],

    odontogram: {
        type: Map,
        of: String,
        default: {}
    },

    // ✅ PHASE 2: Radiograph images embedded in patient document
    radiographs: [radiographSchema],

    // 9. SECURITY & VERIFICATION
    isVerified: { type: Boolean, default: false },
    activationToken: { type: String },
    isPasswordChanged: { type: Boolean, default: false },
    temporaryPasswordExpires: { type: Date },
    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },

    // 10. GUARDIAN
    guardian: {
        name: { type: String },
        relationship: { type: String },
        contactNumber: { type: String },
        occupation: { type: String }
    },

    // 11. LEAVE REQUESTS
    leaveRequests: [{
        startDate: { type: Date },
        endDate: { type: Date },
        reason: { type: String },
        status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' }
    }],

    status: { type: String, enum: ['active', 'inactive'], default: 'inactive' },
    isArchived: { type: Boolean, default: false },
    isAdminAccess: { type: Boolean, default: false },

    // ✅ PHASE 3: Owner-as-Dentist flag
    isDentist: { type: Boolean, default: false },

    // ✅ GAP 2: Notification preferences per user (staff)
    notificationPreferences: {
        emailAppointments: { type: Boolean, default: true },
        dailySummary:       { type: Boolean, default: false },
        criticalAlerts:     { type: Boolean, default: true }
    },

    // ✅ PATIENT MOBILE: Patient-specific preferences (Phase 3)
    educationConsent:   { type: Boolean, default: false }, // Allow personalized dental education
    notifAppointments:  { type: Boolean, default: true  }, // Appointment confirmation/reminder alerts
    notifVisitWindow:   { type: Boolean, default: true  }, // Predictive visit due/overdue alerts
    notifHealthTips:    { type: Boolean, default: true  }, // Weekly dental health tip notifications

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
