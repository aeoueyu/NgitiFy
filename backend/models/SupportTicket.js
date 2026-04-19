const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true },
    content: { type: String, required: true, trim: true },
    sentAt: { type: Date, default: Date.now }
}, { _id: true });

const supportTicketSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    patientName: { type: String, required: true, trim: true },
    patientEmail: { type: String, trim: true },

    subject: { type: String, required: true, trim: true },

    status: {
        type: String,
        enum: ['open', 'in-progress', 'resolved', 'closed'],
        default: 'open'
    },

    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },

    messages: [messageSchema],

    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    assignedToName: { type: String, default: null },

    resolvedAt: { type: Date, default: null },
    closedAt:   { type: Date, default: null }

}, { timestamps: true });

// Index for fast status/priority lookups from the admin inbox
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ patientId: 1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);