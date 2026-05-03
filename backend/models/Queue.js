const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
    linkedAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    patientName:    { type: String, required: true, trim: true },
    patientId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    branch:         { type: String, required: true, trim: true },
    ticketNumber:   { type: Number, required: true },
    status:         { type: String, enum: ['pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'], default: 'pending' },
    assignedDentist:{ type: String, trim: true, default: '' },
    procedureType:  { type: String, trim: true, default: '' },
    contactNumber:  { type: String, trim: true, default: '' },
    calledAt:       { type: Date, default: null },
    completedAt:    { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Queue', queueSchema);
