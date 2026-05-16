const mongoose = require('mongoose');
const defaultWebsiteContent = require('../../ngitify-web/src/data/websiteContentDefaults.json');

const DEFAULT_CLINIC_PROCEDURES = [
    'General Check-up / Initial Consultation',
    'Prophylaxis / Dental Cleaning',
    'Oral Prophylaxis / Teeth Cleaning',
    'Periodontal Therapy',
    'Fluoride Application (with Free Cleaning)',
    'Pit and Fissure Sealant',
    'Metal Braces',
    'Ceramic Braces',
    'Self-Ligating Braces',
    'Digital Periapical X-Ray',
    'Fixed Partial Denture (Crown, Bridge, Inlay and Onlay)',
    'Removable Partial and Full Denture',
    'Root Canal Treatment',
    'Fiber Post Core',
    'Teeth Whitening',
    'Composite Filling/Bonding',
    'Composite Veneer/Direct Veneer',
    'Indirect Veneer',
    'Direct and Indirect Pulp Capping',
    'Tooth Extraction (Bunot)',
    'Odontectomy (Wisdom Tooth Removal)',
    'Pediatric Oral Prophylaxis',
    'Pediatric Fluoride Application',
    'Pediatric Pit and Fissure Sealants',
    'Pulpectomy',
    'Pulpotomy',
    'Crowns/Caps',
    'Anterior Veneers',
    'Composite Tooth Restoration',
];

const systemConfigSchema = new mongoose.Schema({
    clinicName: { type: String, default: 'Dentime Dental Clinic' },
    clinicLogo: { type: String, default: '' },
    clinicContact: { type: String, default: '' },
    clinicAddress: { type: String, default: '' },
    clinicEmail: { type: String, default: '' },
    maxAppointmentsPerDay: { type: Number, default: 20 },
    allowedTimeSlots: {
        type: [String],
        default: ['08:00','09:00','10:00','11:00','13:00','14:00','15:00','16:00']
    },
    onlineBookingProcedures: {
        type: [String],
        default: [
            'General Check-up / Initial Consultation',
            'Prophylaxis / Dental Cleaning',
        ],
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
    backupSettings: {
        enabled: { type: Boolean, default: false },
        intervalHours: { type: Number, default: 24 },
        retentionCount: { type: Number, default: 14 },
        updatedAt: { type: Date, default: null },
        updatedBy: { type: String, default: '' },
    },
    websiteContent: {
        type: mongoose.Schema.Types.Mixed,
        default: () => JSON.parse(JSON.stringify(defaultWebsiteContent)),
    },
    sessionTimeoutMinutes: { type: Number, default: 30 },
    updatedBy: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
