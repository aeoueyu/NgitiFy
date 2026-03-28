export class Surgery {
    constructor({ 
      id = '', 
      patientId = '', 
      dentistId = '', 
      procedureName = '', 
      scheduledDate = '', 
      status = 'Scheduled', 
      notes = '', 
      durationMinutes = 60 
    } = {}) {
      this.id = id;
      this.patientId = patientId;
      this.dentistId = dentistId;
      this.procedureName = procedureName;
      this.scheduledDate = scheduledDate; // ISO string
      this.status = status; // 'Scheduled', 'Completed', 'Cancelled', 'In Progress'
      this.notes = notes;
      this.durationMinutes = durationMinutes;
    }
  
    isUpcoming() {
      return new Date(this.scheduledDate) > new Date() && this.status === 'Scheduled';
    }
  }