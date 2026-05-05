const mongoose = require('mongoose');

const DEFAULT_CLINIC_PROCEDURES = [
    'General Check-up / Initial Consultation',
    'Prophylaxis / Dental Cleaning',
    'Oral Prophylaxis (Teeth Cleaning)',
    'Fluoride Application',
    'Teeth Whitening',
    'Tooth Restoration/Filling (Pasta)',
    'Pit and Fissure Sealant Application',
    'Root Canal Treatment',
    'Tooth Extraction (Bunot)',
    'Odontectomy (Wisdom Tooth Removal)',
    'Orthodontics (Braces)',
    'Dentures/Crowns',
    'Retainers',
];

const systemConfigSchema = new mongoose.Schema({
    clinicName: { type: String, default: 'NgitiFy Dental Clinic' },
    clinicLogo: { type: String, default: '' },
    clinicContact: { type: String, default: '' },
    clinicAddress: { type: String, default: '' },
    clinicEmail: { type: String, default: '' },
    maxAppointmentsPerDay: { type: Number, default: 20 },
    allowedTimeSlots: {
        type: [String],
        default: ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00']
    },
    clinicProcedures: {
        type: [String],
        default: DEFAULT_CLINIC_PROCEDURES,
    },
    emailTemplates: {
        activation: {
            type: String,
            default: 'Welcome to NgitiFy! Please activate your account by clicking the link below.'
        },
        appointmentReminder: {
            type: String,
            default: 'This is a reminder for your upcoming appointment at NgitiFy Dental Clinic.'
        }
    },
    featureToggles: {
        queueManagement:   { type: Boolean, default: true },
        radiographUploads: { type: Boolean, default: true },
        chatSupport:       { type: Boolean, default: false },
        sessionTimeout:    { type: Boolean, default: true }
    },
    sessionTimeoutMinutes: { type: Number, default: 30 },
    updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
