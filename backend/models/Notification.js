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

            // ── Patient-facing (Phase 3 additions) ───────────────────────
            'APPOINTMENT_CONFIRMED',       // Admin/secretary confirmed booking
            'APPOINTMENT_DECLINED',        // Admin/secretary declined booking
            'APPOINTMENT_STATUS_UPDATED',  // Appointment status changed after booking
            'APPOINTMENT_REMINDER',        // Scheduled — 24 hrs before appointment
            'PREDICTIVE_VISIT_DUE',        // 14 days before predicted visit date
            'PREDICTIVE_VISIT_OVERDUE',    // Past predicted visit date
            'DENTAL_HEALTH_TIP',           // Weekly educational notification
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
        enum: ['administrator', 'branch-manager', 'dentist', 'secretary', 'owner', 'patient']
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
