// backend/models/User.js
const mongoose = require('mongoose');
const { ACCOUNT_SECRET_FIELDS } = require('../utils/healthcareAccess');

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
        enum: ['General', 'Restoration', 'Extraction', 'Prophylaxis', 'Orthodontics', 'Endodontics', 'Prosthodontics', 'Oral Surgery', 'Consultation', 'Other'],
        default: 'Other'
    },
    notes: { type: String },
    dentistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dentistName: { type: String },
    branch: { type: String },
    amountCharged: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    nextAppointment: { type: Date, default: null },
}, { timestamps: true });

// ✅ PHASE 2: Radiograph subdocument schema
const radiographEnhancementVariantSchema = new mongoose.Schema({
    url: { type: String, default: '' },
    engine: { type: String, default: '' },
    label: { type: String, default: '' },
    generatedAt: { type: Date, default: null },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    provider: { type: String, default: '' },
    model: { type: String, default: '' },
}, { _id: false });

const radiographGeometrySchema = new mongoose.Schema({
    type: { type: String, enum: ['point', 'rectangle', 'region'], default: 'rectangle' },
    x: { type: Number, min: 0, max: 1, required: true },
    y: { type: Number, min: 0, max: 1, required: true },
    width: { type: Number, min: 0, max: 1, default: 0 },
    height: { type: Number, min: 0, max: 1, default: 0 },
}, { _id: false });

const toothDetectionSchema = new mongoose.Schema({
    predictedToothNumber: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    confidenceLevel: { type: String, enum: ['high', 'medium', 'low'], required: true },
    geometry: { type: radiographGeometrySchema, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'corrected', 'ignored'], default: 'pending' },
    confirmedToothNumber: { type: String, default: '' },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    confirmedAt: { type: Date, default: null },
    modelVersion: { type: String, required: true },
    inferenceTimestamp: { type: Date, required: true },
    predictionType: { type: String, default: 'tooth-region-and-fdi-suggestion' },
}, { timestamps: true });

const radiographAnnotationSchema = new mongoose.Schema({
    toothNumber: { type: String, default: '' },
    geometry: { type: radiographGeometrySchema, required: true },
    findingType: { type: String, default: '' },
    note: { type: String, default: '' },
    linkToOdontogram: { type: Boolean, default: false },
    treatmentLogId: { type: mongoose.Schema.Types.ObjectId, default: null },
    visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const radiographAnalysisSchema = new mongoose.Schema({
    status: { type: String, enum: ['not-analyzed', 'processing', 'ready', 'failed'], default: 'not-analyzed' },
    verificationState: { type: String, enum: ['requires-verification', 'verified'], default: 'requires-verification' },
    modelVersion: { type: String, default: '' },
    predictionType: { type: String, default: '' },
    qualityAssessment: { type: mongoose.Schema.Types.Mixed, default: null },
    detections: { type: [toothDetectionSchema], default: [] },
    limitations: { type: String, default: '' },
    analyzedAt: { type: Date, default: null },
    errorMessage: { type: String, default: '' },
}, { _id: false });

const radiographSummarySchema = new mongoose.Schema({
    draft: { type: String, default: '' },
    approvedText: { type: String, default: '' },
    status: { type: String, enum: ['none', 'draft', 'approved'], default: 'none' },
    generatedAt: { type: Date, default: null },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    provenance: { type: String, default: '' },
}, { _id: false });

const radiographManualReviewSchema = new mongoose.Schema({
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: false });

const radiographSchema = new mongoose.Schema({
    label: { type: String, required: true },
    date: { type: Date, required: true },
    radiographNumber: { type: String, default: '' },
    url: { type: String },       // base64 image data or external URL
    enhancedUrl: { type: String, default: '' },
    enhancedAt: { type: Date, default: null },
    enhancedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    enhancementVariants: {
        basic: { type: radiographEnhancementVariantSchema, default: () => ({}) },
        selfHosted: { type: radiographEnhancementVariantSchema, default: () => ({}) },
        huggingFace: { type: radiographEnhancementVariantSchema, default: () => ({}) },
    },
    lastEnhancementEngine: { type: String, default: '' },
    findings: { type: String, default: '' },
    notes: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    branch: { type: String, default: '' },
    visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    analysis: { type: radiographAnalysisSchema, default: () => ({}) },
    analysisHistory: { type: [radiographAnalysisSchema], default: [] },
    annotations: { type: [radiographAnnotationSchema], default: [] },
    manualReview: { type: radiographManualReviewSchema, default: () => ({}) },
    reviewSummary: { type: radiographSummarySchema, default: () => ({}) },
}, { timestamps: true });

const odontogramLogSchema = new mongoose.Schema({
    tooth: { type: String, required: true },
    stage: {
        type: String,
        enum: ['existing', 'planned', 'completed'],
        required: true,
    },
    eventType: {
        type: String,
        enum: ['created', 'updated', 'cleared'],
        required: true,
    },
    statusBefore: { type: String, default: '' },
    statusAfter: { type: String, default: '' },
    surfacesBefore: [{ type: String }],
    surfacesAfter: [{ type: String }],
    noteBefore: { type: String, default: '' },
    noteAfter: { type: String, default: '' },
    updatedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, default: '' },
    updatedByRole: { type: String, default: '' },
}, { timestamps: true });

const oralHealthFactorSchema = new mongoose.Schema({
    id: { type: String, required: true },
    label: { type: String, required: true },
    active: { type: Boolean, default: false },
    recordedAt: { type: Date, default: null },
}, { _id: false });

const oralHealthLogSchema = new mongoose.Schema({
    logDate: { type: Date, required: true },
    logDateKey: { type: String, required: true },
    symptoms: [{ type: String }],
    dailyCare: [{ type: String }],
    riskFactors: [{ type: String }],
    symptomDetails: {
        type: Map,
        of: new mongoose.Schema({
            severity: { type: String, default: '' },
            duration: { type: String, default: '' },
        }, { _id: false }),
        default: {},
    },
    notes: { type: String, default: '' },
}, { timestamps: true });

const patientOnboardingSchema = new mongoose.Schema({
    version: {
        type: Number,
        required: true,
        min: 1,
    },

    completed: {
        type: Boolean,
        default: false,
    },

    completedAt: {
        type: Date,
        default: null,
    },

    currentStep: {
        type: Number,
        default: 0,
        min: 0,
        max: 8,
    },

    preferredName: {
        type: String,
        default: '',
        maxlength: 60,
    },

    educationInterests: [{
        type: String,
        enum: [
            'better-brushing-routine',
            'consistent-flossing',
            'gum-care',
            'tooth-sensitivity',
            'oral-health-symptoms',
            'appointment-reminders',
            'recommended-visits',
            'preventive-dental-care',
        ],
    }],

    oralCareRoutine: {
        brushing: {
            type: String,
            enum: [
                '',
                'twice-daily',
                'once-daily',
                'varies',
                'prefer-not-to-say',
            ],
            default: '',
        },

        flossing: {
            type: String,
            enum: [
                '',
                'most-days',
                'sometimes',
                'rarely',
                'prefer-not-to-say',
            ],
            default: '',
        },
    },

    experiencePreferences: {
        oralHealthManagement: {
            type: Boolean,
            default: true,
        },

        dentalHealthEducation: {
            type: Boolean,
            default: true,
        },

        visitRecommendations: {
            type: Boolean,
            default: true,
        },

        appointmentUpdates: {
            type: Boolean,
            default: true,
        },
    },

    startedAt: {
        type: Date,
        default: null,
    },

    updatedAt: {
        type: Date,
        default: null,
    },
}, {
    _id: false,
});

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
    homeAddress: addressSchema,
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
        hasConfidentialInfo: { type: Boolean, default: undefined }
    },

    physician: {
        name: { type: String },
        specialty: { type: String },
        officeAddress: { type: String },
        officeNumber: { type: String }
    },

    assignedDentistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedDentistName: { type: String, default: '' },

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
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },

    odontogramLogs: [odontogramLogSchema],

    // ✅ PHASE 2: Radiograph images embedded in patient document
    radiographs: [radiographSchema],

    oralHealthFactors: [oralHealthFactorSchema],
    oralHealthLogs: [oralHealthLogSchema],

    // 9. SECURITY & VERIFICATION
    isVerified: { type: Boolean, default: false },
    activationToken: { type: String },
    activationTokenExpires: { type: Date, default: null },
    lastEmailChangeRequestedAt: { type: Date, default: null },
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
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    archiveReason: { type: String, default: '' },
    restoredAt: { type: Date, default: null },
    restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deactivatedAt: { type: Date, default: null },
    deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deactivationReason: { type: String, default: '' },
    isAdminAccess: { type: Boolean, default: false },

    // ✅ PHASE 3: Owner-as-Dentist flag
    isDentist: { type: Boolean, default: false },

    // ✅ GAP 2: Notification preferences per user (staff)
    notificationPreferences: {
        emailAppointments: { type: Boolean, default: true },
        dailySummary:       { type: Boolean, default: false },
        criticalAlerts:     { type: Boolean, default: true },
        appointmentAlerts:  { type: Boolean, default: true },
        chatAlerts:         { type: Boolean, default: true },
        queueAlerts:        { type: Boolean, default: true },
        patientAlerts:      { type: Boolean, default: true },
        scheduleAlerts:     { type: Boolean, default: true },
        materialAlerts:     { type: Boolean, default: true },
    },

    // ✅ PATIENT MOBILE: Patient-specific preferences (Phase 3)
    /*
     * First-time Patient Mobile onboarding.
     *
     * IMPORTANT:
     * Do not give this field a schema default.
     * Existing Patients created before onboarding intentionally
     * have no patientOnboarding value and are treated as legacy
     * established accounts rather than being blocked.
     */
    patientOnboarding: {
        type: patientOnboardingSchema,
        default: undefined,
    },

    educationConsent:   { type: Boolean, default: false }, // Allow personalized Dental Health Education
    notifAppointments:  { type: Boolean, default: true  }, // Appointment Alerts
    notifVisitWindow:   { type: Boolean, default: true  }, // Recommended Visit Window reminders
    notifOralHealthDaily: { type: Boolean, default: true }, // Daily Oral Health Management reminder
    notifSymptomFollowUp: { type: Boolean, default: true }, // Approved deterministic symptom follow-up reminders
    notifHealthTips:    { type: Boolean, default: true  }, // Dental Health Education / dental-health tips
    oralHealthReminderTime: {
        type: String,
        default: '20:00',
        match: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    },
    predictiveVisitReminder: {
        dueWindowKey: { type: String, default: '' },
        overdueWindowKey: { type: String, default: '' },
    },

}, { timestamps: true });

userSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        ACCOUNT_SECRET_FIELDS.forEach((field) => delete ret[field]);
        const canonicalHomeAddress = ret.homeAddress || ret.currentAddress || ret.permanentAddress || null;
        if (canonicalHomeAddress) {
            ret.homeAddress = canonicalHomeAddress;
        }
        return ret;
    },
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
