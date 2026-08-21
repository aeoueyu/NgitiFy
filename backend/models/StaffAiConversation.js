const mongoose = require('mongoose');

const staffAiMessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, trim: true, maxlength: 12000 },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });

const staffAiConversationSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerRole: {
        type: String,
        enum: ['administrator', 'owner', 'branch-manager', 'dentist', 'secretary'],
        required: true,
    },
    title: { type: String, trim: true, maxlength: 100, default: 'New conversation' },
    titleSource: { type: String, enum: ['derived', 'manual'], default: 'derived' },
    messages: { type: [staffAiMessageSchema], default: [] },
    isPinned: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    lastMessageAt: { type: Date, default: Date.now },
}, { timestamps: true });

staffAiConversationSchema.index({ owner: 1, isArchived: 1, isPinned: -1, lastMessageAt: -1 });

module.exports = mongoose.models.StaffAiConversation
    || mongoose.model('StaffAiConversation', staffAiConversationSchema);
