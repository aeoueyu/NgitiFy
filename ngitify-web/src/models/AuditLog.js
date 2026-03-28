export class AuditLog {
    constructor({ 
      id = '', 
      userId = '', 
      action = '', 
      resource = '', 
      details = '', 
      timestamp = new Date().toISOString(), 
      ipAddress = '' 
    } = {}) {
      this.id = id;
      this.userId = userId; // ID of the user who performed the action
      this.action = action; // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
      this.resource = resource; // 'Patient', 'Surgery', 'Inventory', etc.
      this.details = details; 
      this.timestamp = timestamp;
      this.ipAddress = ipAddress;
    }
  
    getFormattedDate() {
      return new Date(this.timestamp).toLocaleString();
    }
  }