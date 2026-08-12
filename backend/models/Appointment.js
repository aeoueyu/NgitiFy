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

const guestEmergencyContactSchema = new mongoose.Schema({
    name: { type: String, trim: true, default: '' },
    relationship: { type: String, trim: true, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
}, { _id: false });

const guestGuardianSchema = new mongoose.Schema({
    name: { type: String, trim: true, default: '' },
    relationship: { type: String, trim: true, default: '' },
    contactNumber: { type: String, trim: true, default: '' },
    occupation: { type: String, trim: true, default: '' },
}, { _id: false });

const guestPhysicianSchema = new mongoose.Schema({
    name: { type: String, trim: true, default: '' },
    specialty: { type: String, trim: true, default: '' },
    officeAddress: { type: String, trim: true, default: '' },
    officeNumber: { type: String, trim: true, default: '' },
}, { _id: false });

const guestMedicalHistorySchema = new mongoose.Schema({
    allergies: [{ type: String, trim: true }],
    conditions: [{ type: String, trim: true }],
    medications: [{ type: String, trim: true }],
    notes: { type: String, trim: true, default: '' },
    inGoodHealth: { type: Boolean, default: undefined },
    underMedicalTreatment: { type: Boolean, default: undefined },
    medicalTreatmentDetails: { type: String, trim: true, default: '' },
    hadSeriousIllnessOrSurgery: { type: Boolean, default: undefined },
    seriousIllnessOrSurgeryDetails: { type: String, trim: true, default: '' },
    hadHospitalization: { type: Boolean, default: undefined },
    hospitalizationDetails: { type: String, trim: true, default: '' },
    isTakingMedication: { type: Boolean, default: undefined },
    usesTobacco: { type: Boolean, default: undefined },
    usesAlcoholOrDrugs: { type: Boolean, default: undefined },
    hasAllergies: { type: Boolean, default: undefined },
    bleedingTime: { type: String, trim: true, default: '' },
    bloodPressure: { type: String, trim: true, default: '' },
    isPregnant: { type: Boolean, default: undefined },
    isNursing: { type: Boolean, default: undefined },
    takingBirthControl: { type: Boolean, default: undefined },
}, { _id: false });

const guestDentalHistorySchema = new mongoose.Schema({
    lastExamDate: { type: Date, default: null },
    chiefComplaint: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    hadTreatmentReaction: { type: Boolean, default: undefined },
    reactionDetails: { type: String, trim: true, default: '' },
    hasConfidentialInfo: { type: Boolean, default: undefined },
}, { _id: false });

const guestConsentSchema = new mongoose.Schema({
    acknowledged: { type: Boolean, default: false },
    signerName: { type: String, trim: true, default: '' },
    signerRole: { type: String, trim: true, default: '' },
    signedAt: { type: Date, default: null },
    version: { type: String, trim: true, default: '' },
}, { _id: false });

const guestProfileSchema = new mongoose.Schema({
    homePhone: { type: String, trim: true, default: '' },
    workPhone: { type: String, trim: true, default: '' },
    occupation: { type: String, trim: true, default: '' },
    civilStatus: { type: String, trim: true, default: '' },
    bloodType: { type: String, trim: true, default: '' },
    nationality: { type: String, trim: true, default: 'Filipino' },
    religion: { type: String, trim: true, default: '' },
    referredBy: { type: String, trim: true, default: '' },
    reasonForConsultation: { type: String, trim: true, default: '' },
}, { _id: false });

const appointmentSchema = new mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dentist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    guestName: { type: String, trim: true },
    guestEmail: { type: String, trim: true, lowercase: true },
    guestPhone: { type: String, trim: true },
    guestBirthdate: { type: Date },
    guestGender: { type: String },
    guestHomeAddress: addressSchema,
    guestCurrentAddress: addressSchema,
    guestPermanentAddress: addressSchema,
    guestProfile: guestProfileSchema,
    guestEmergencyContact: guestEmergencyContactSchema,
    guestGuardian: guestGuardianSchema,
    guestPhysician: guestPhysicianSchema,
    guestMedicalHistory: guestMedicalHistorySchema,
    guestDentalHistory: guestDentalHistorySchema,
    guestConsentAcknowledgement: guestConsentSchema,
    guestDataPrivacyConsent: guestConsentSchema,
    preRegistrationToken: { type: String },
    preRegistrationTokenExpiry: { type: Date },
    preRegistrationCompleted: { type: Boolean, default: false },
    consentGiven: { type: Boolean, default: false },
    consentTimestamp: { type: Date, default: null },
    consentVersion: { type: String, default: '' },
    consentIpAddress: { type: String, default: '' },

    branch: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String },
    duration: { type: String },

    procedure: { type: String, required: true },
    performedProcedure: { type: String, trim: true, default: '' },
    notes: { type: String },

    status: {
        type: String,
        enum: ['pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'],
        default: 'pending',
    },

    source: {
        type: String,
        enum: ['Smile Hub (Online)', 'Walk-in', 'Phone Call', 'Appointment'],
        default: 'Walk-in',
    },

    preOpInstructions: { type: String },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String },
    autoCancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: '' },
    statusReminderSentAt: { type: Date, default: null },
    statusReminderDayKey: { type: String, default: '' },
    rescheduleHistory: [{
        originalDate: { type: Date },
        originalTime: { type: String, default: '' },
        newDate: { type: Date },
        newTime: { type: String, default: '' },
        rescheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rescheduledByName: { type: String, default: '' },
        rescheduledAt: { type: Date, default: Date.now },
        reason: { type: String, default: '' },
    }],
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, {
    timestamps: true,
    collection: 'surgeries',
});

appointmentSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        const canonicalHomeAddress = ret.guestHomeAddress || ret.guestCurrentAddress || ret.guestPermanentAddress || null;
        if (canonicalHomeAddress) {
            ret.guestHomeAddress = canonicalHomeAddress;
        }
        return ret;
    },
});

module.exports = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema);
