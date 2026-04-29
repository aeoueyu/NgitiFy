const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    type: { 
        type: String, 
        required: true,
        enum: [
            // ── Staff-facing (existing) ──────────────────────────────────
            'NEW_APPOINTMENT',
            'APPOINTMENT_CANCELLED',
            'LOW_INVENTORY',
            'NEW_PATIENT_REGISTRATION',
            'CHAT_TICKET_RAISED',

            // ── Patient-facing (Phase 3 additions) ───────────────────────
            'APPOINTMENT_CONFIRMED',       // Admin/secretary confirmed booking
            'APPOINTMENT_DECLINED',        // Admin/secretary declined booking
            'APPOINTMENT_REMINDER',        // Scheduled — 24 hrs before appointment
            'PREDICTIVE_VISIT_DUE',        // 14 days before predicted visit date
            'PREDICTIVE_VISIT_OVERDUE',    // Past predicted visit date
            'DENTAL_HEALTH_TIP',           // Weekly educational notification
            'INQUIRY_ESCALATED',           // Chatbot escalation acknowledged
            'NEW_RADIOGRAPH',              // Dentist uploaded a new X-ray
        ]
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
        enum: ['administrator', 'co-administrator', 'branch-manager', 'dentist', 'secretary', 'owner', 'patient']
    },
    recipientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User'
    },
    relatedId: { 
        type: mongoose.Schema.Types.ObjectId
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