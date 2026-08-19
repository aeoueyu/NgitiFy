const mongoose =
    require('mongoose');

const patientAiMessageSchema =
    new mongoose.Schema(
        {
            role: {
                type: String,
                enum: [
                    'user',
                    'assistant',
                ],
                required: true,
            },

            content: {
                type: String,
                required: true,
                trim: true,
                maxlength: 12000,
            },

            createdAt: {
                type: Date,
                default: Date.now,
            },
        },
        {
            _id: true,
        }
    );

const patientAiConversationSchema =
    new mongoose.Schema(
        {
            patient: {
                type:
                    mongoose.Schema.Types
                        .ObjectId,

                ref: 'User',

                required: true,

                index: true,
            },

            title: {
                type: String,
                trim: true,
                maxlength: 100,
                default:
                    'New conversation',
            },

            titleSource: {
                type: String,

                enum: [
                    'derived',
                    'manual',
                ],

                default:
                    'derived',
            },

            messages: {
                type: [
                    patientAiMessageSchema,
                ],

                default: [],
            },

            isPinned: {
                type: Boolean,
                default: false,
            },

            isArchived: {
                type: Boolean,
                default: false,
            },

            archivedAt: {
                type: Date,
                default: null,
            },

            lastMessageAt: {
                type: Date,
                default: Date.now,
            },
        },
        {
            timestamps: true,
        }
    );

patientAiConversationSchema.index(
    {
        patient: 1,
        isArchived: 1,
        isPinned: -1,
        lastMessageAt: -1,
    }
);

patientAiConversationSchema.index(
    {
        patient: 1,
        updatedAt: -1,
    }
);

module.exports =
    mongoose.models
        .PatientAiConversation
    || mongoose.model(
        'PatientAiConversation',
        patientAiConversationSchema
    );