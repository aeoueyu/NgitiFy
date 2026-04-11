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
    this.role = role; // 'owner', 'co-owner', 'dentist', 'secretary', 'patient'
    this.permissions = permissions; // Task 15 Fix: Assign permissions
    this.contactNumber = contactNumber;
    this.status = status;
    this.profileImage = profileImage; 
    this.createdAt = createdAt;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  isAdmin() {
    // Proactive Fix: Ensure co-owners are also treated as admins in the UI
    return this.role === 'owner' || this.role === 'co-owner';
  }
}