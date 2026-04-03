export class User {
  constructor({ 
    id = '', 
    firstName = '', 
    lastName = '', 
    email = '', 
    role = '', 
    contactNumber = '', 
    status = 'Active', 
    profileImage = '', // <-- DAGDAG ITO
    createdAt = new Date().toISOString() 
  } = {}) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.role = role; // 'owner', 'dentist', 'secretary', 'patient'
    this.contactNumber = contactNumber;
    this.status = status;
    this.profileImage = profileImage; // <-- DAGDAG ITO
    this.createdAt = createdAt;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  isAdmin() {
    return this.role === 'owner';
  }
}