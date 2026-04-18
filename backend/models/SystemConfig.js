// backend/models/SystemConfig.js
const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
    clinicName:    { type: String, default: 'NgitiFy Dental Clinic' },
    clinicEmail:   { type: String, default: '' },
    clinicPhone:   { type: String, default: '' },
    clinicAddress: { type: String, default: '' },
    clinicLogo:    { type: String, default: '' }, // base64 or URL
    maxAppointmentsPerDay: { type: Number, default: 20 },
    appointmentSlotMinutes: { type: Number, default: 30 },
    allowWalkIns:  { type: Boolean, default: true },
    enableInventoryAlerts: { type: Boolean, default: true },
    enableNotifications:   { type: Boolean, default: true },
    updatedBy: { type: String, default: 'system' }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);