export class User {
  constructor({ 
    id = '', 
    firstName = '', 
    lastName = '', 
    email = '', 
    role = '', 
    permissions = {}, // Task 15 Fix: Added permissions object
    contactNumber = '', 
    status = 'Active', 
    profileImage = '', 
    createdAt = new Date().toISOString() 
  } = {}) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.role = role;
    this.permissions = permissions; // Task 15 Fix: Assign permissions
    this.contactNumber = contactNumber;
    this.status = status;
    this.profileImage = profileImage; 
    this.createdAt = createdAt;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  get isAdmin() {
    return this.role === 'administrator' || this.role === 'co-administrator' || this.role === 'branch-manager';
  }
}