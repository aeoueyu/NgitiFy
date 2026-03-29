const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g., "LOGIN", "STATUS_UPDATE"
    user: { type: String, required: true }, // Email or Name of the user who performed the action
    role: { type: String }, // Role of the user
    details: { type: String, required: true }, // Description of what happened
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);