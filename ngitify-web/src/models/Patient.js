export class Patient {
    constructor({ 
      id = '', 
      userId = '', 
      dob = '', 
      gender = '', 
      address = {}, 
      emergencyContact = {}, 
      medicalHistory = [], 
      registeredAt = new Date().toISOString() 
    } = {}) {
      this.id = id;
      this.userId = userId; // Links to a User account if they use the patient app
      this.dob = dob;
      this.gender = gender;
      this.address = {
        street: address.street || '',
        barangay: address.barangay || '',
        city: address.city || '',
        province: address.province || '',
        region: address.region || ''
      };
      this.emergencyContact = {
        name: emergencyContact.name || '',
        relation: emergencyContact.relation || '',
        contactNumber: emergencyContact.contactNumber || ''
      };
      this.medicalHistory = medicalHistory;
      this.registeredAt = registeredAt;
    }
  
    get age() {
      if (!this.dob) return 0;
      const diff = Date.now() - new Date(this.dob).getTime();
      return Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }
  }