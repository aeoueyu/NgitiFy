export class User {
  constructor({ 
    id = '', 
    firstName = '', 
    lastName = '', 
    email = '', 
    role = '', 
    permissions = {},
    contactNumber = '', 
    status = 'Active', 
    profileImage = '', 
    createdAt = new Date().toISOString(),
    assignedBranch = null,
    isDentist = false   // ✅ PHASE 3: Owner-as-Dentist flag
  } = {}) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.email = email;
    this.role = role;
    this.permissions = permissions;
    this.contactNumber = contactNumber;
    this.status = status;
    this.profileImage = profileImage;
    this.createdAt = createdAt;
    this.assignedBranch = assignedBranch;
    this.isDentist = isDentist;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  get isAdmin() {
    return this.role === 'administrator' || this.role === 'co-administrator';
  }

  get isBranchManager() {
    return this.role === 'branch-manager';
  }

  // ✅ PHASE 3
  get isOwner() {
    return this.role === 'owner';
  }
}