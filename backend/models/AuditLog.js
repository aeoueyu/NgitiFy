const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    // ── Existing fields (preserved for backward compatibility) ──
    action:  { type: String, required: true }, // e.g., "LOGIN", "CREATE_USER", "OWNERSHIP_TRANSFER"
    user:    { type: String, required: true }, // Email or name of the actor (human-readable)
    role:    { type: String },                 // Role of the actor
    details: { type: String, required: true }, // Human-readable description

    // ── New fields (Co-Administrator plan spec) ──
    actorId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ObjectId of the actor
    actorRole:   { type: String },                                       // Explicit role string
    targetId:    { type: mongoose.Schema.Types.ObjectId },               // ObjectId of affected doc
    targetModel: { type: String },                                       // Collection name, e.g. "User"

    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);