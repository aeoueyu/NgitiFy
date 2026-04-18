const mongoose = require('mongoose');

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