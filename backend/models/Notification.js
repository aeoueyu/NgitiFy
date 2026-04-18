const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    type: { 
        type: String, 
        required: true,
        enum: ['NEW_APPOINTMENT', 'APPOINTMENT_CANCELLED', 'LOW_INVENTORY', 'NEW_PATIENT_REGISTRATION', 'CHAT_TICKET_RAISED'] // Preparing for future phases
    },
    title: { 
        type: String, 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    recipientRole: { 
        type: String, 
        enum: ['administrator', 'co-administrator', 'branch-manager', 'dentist', 'secretary'] 
    },
    recipientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' // Optional: if targeting a specific user instead of a whole role
    },
    relatedId: { 
        type: mongoose.Schema.Types.ObjectId // e.g., the ID of the new surgery/appointment
    },
    isRead: { 
        type: Boolean, 
        default: false 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Notification', NotificationSchema);