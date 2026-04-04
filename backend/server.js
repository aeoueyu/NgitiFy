require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto'); 

// Import Model
const User = require('./models/User'); 
const AuditLog = require('./models/AuditLog'); // Import the new model
const Patient = require('./models/Patient');
const Surgery = require('./models/Surgery');
const Inventory = require('./models/Inventory');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection (LOCAL)
mongoose.connect('mongodb://127.0.0.1:27017/ngitify') 
.then(() => console.log('✅ Connected to Local MongoDB'))
.catch((err) => console.error('❌ Error connecting to MongoDB:', err));

// EMAIL CONFIG
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'garciaaeiounicole@gmail.com',
        pass: 'oxzmsxgfzhcgcnua'
    },
});

// ================= ROUTES ================= //

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "Invalid email or password" });

        if (!user.isPasswordChanged && user.temporaryPasswordExpires && new Date() > user.temporaryPasswordExpires) {
            user.status = 'inactive';
            await user.save();
            return res.status(403).json({ message: "Your temporary password has expired and your account has been deactivated. Please contact an administrator." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

        if (!user.isVerified) {
            return res.status(403).json({ message: "Account not verified. Please check your email." });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, 'your_jwt_secret', { expiresIn: '1h' });

        await AuditLog.create({
            action: "LOGIN",
            user: user.email,
            role: user.role,
            details: `User logged in successfully.`
        });

        res.json({ token, role: user.role, userId: user._id });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

// --- ACTIVATE ACCOUNT (UPDATED) ---
app.post('/api/activate-account', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: "No token provided." });

        const user = await User.findOne({ activationToken: token });
        if (!user) return res.status(400).json({ message: "Invalid or expired activation link." });

        // FIX: Verify AND Activate status simultaneously
        user.isVerified = true;
        user.status = 'active'; // Set status to active only when verified
        user.activationToken = undefined; 
        await user.save();

        res.json({ message: "Account activated successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Server error during activation." });
    }
});

// Helper Email Sender
const sendActivationEmail = async (email, role, tempPassword, activationLink) => {
    const mailOptions = {
        from: '"NgitiFy Admin" <garciaaeiounicole@gmail.com>',
        to: email,
        subject: 'Welcome to NgitiFy! Activate Your Account',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #005466;">Welcome to NgitiFy!</h2>
                <p>Hello,</p>
                <p>Your <b>${role}</b> account has been successfully created.</p>
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Temporary Password:</strong> <span style="font-size: 18px; font-weight: bold; color: #000;">${tempPassword}</span></p>
                </div>
                <p>Please click the button below to activate your account:</p>
                <a href="${activationLink}" style="background-color: #005466; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Activate Account</a>
            </div>
        `
    };
    await transporter.sendMail(mailOptions);
};

// --- ADD DENTIST (FIXED ORDER) ---
app.post('/api/add-dentist', async (req, res) => {
    try {
        const { email, licenseNumber, ...otherData } = req.body;
        
        const existingEmail = await User.findOne({ email });
        if (existingEmail) return res.status(409).json({ field: 'email', message: 'Email address is already registered.' });

        if (licenseNumber) {
            const existingLicense = await User.findOne({ licenseNumber });
            if (existingLicense) return res.status(409).json({ field: 'licenseNumber', message: 'License Number is already registered.' });
        }

        const tempPassword = crypto.randomBytes(4).toString('hex'); 
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

        // FIX: ...otherData is now FIRST to prevent overwriting security fields
        const newUser = new User({
            ...otherData, 
            email,
            licenseNumber,
            password: hashedPassword,
            role: 'dentist',
            isVerified: false, // Ensures unverified
            status: 'inactive', // Ensures inactive until verified
            activationToken,
            temporaryPasswordExpires
        });
        
        await newUser.save();

        await AuditLog.create({
            action: "CREATE_USER",
            user: "ADMIN", // Or pass the actual admin email from frontend if available
            role: "owner",
            details: `Created new user: ${email}`
        });

        const activationLink = `http://localhost:3000/activate-account/${activationToken}`;
        await sendActivationEmail(email, 'Dentist', tempPassword, activationLink);
        
        console.log(`✅ Dentist Added: ${email}`);
        res.status(201).json({ message: 'Dentist added successfully. Email sent.' });

    } catch (error) {
        console.error("Error adding dentist or sending email:", error);
        res.status(500).json({ message: "User created, but failed to send activation email." });
    }
});

// --- ADD SECRETARY (FIXED ORDER) ---
app.post('/api/add-secretary', async (req, res) => {
    try {
        const { email, ...otherData } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

        const newUser = new User({
            ...otherData,
            email, 
            password: hashedPassword,
            role: 'secretary',
            isVerified: false, 
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires
        });
        await newUser.save();

        await AuditLog.create({
            action: "CREATE_USER",
            user: "ADMIN",
            role: "owner",
            details: `Created new user: ${email}`
        });

        const activationLink = `http://localhost:3000/activate-account/${activationToken}`;
        await sendActivationEmail(email, 'Secretary', tempPassword, activationLink);

        console.log(`✅ Email sent to Secretary: ${email}`);
        res.status(201).json({ message: 'Secretary added successfully. Email sent.' });

    } catch (error) {
        console.error("Error adding secretary or sending email:", error);
        res.status(500).json({ message: "User created, but failed to send activation email." });
    }
});

// --- ADD PATIENT (FIXED ORDER) ---
app.post('/api/add-patient', async (req, res) => {
    try {
        const { email, ...otherData } = req.body;

        const existing = await Patient.findOne({ email });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        const newPatient = new Patient({
            ...otherData,
            email
        });
        await newPatient.save();

        await AuditLog.create({
            action: "CREATE_PATIENT",
            user: "SYSTEM", // Or pass the actual user email from frontend if available
            role: "SYSTEM",
            details: `Created new patient: ${email}`
        });

        console.log(`✅ Patient Added: ${email}`);
        res.status(201).json({ message: 'Patient added successfully.' });

    } catch (error) {
        console.error("Error adding patient:", error);
        res.status(500).json({ message: "Error adding patient." });
    }
});

// --- ADD CO-OWNER ---
app.post('/api/add-co-owner', async (req, res) => {
    try {
        const { email, licenseNumber, branch, ...otherData } = req.body;
        
        const existingEmail = await User.findOne({ email });
        if (existingEmail) return res.status(409).json({ field: 'email', message: 'Email address is already registered.' });

        if (licenseNumber) {
            const existingLicense = await User.findOne({ licenseNumber });
            if (existingLicense) return res.status(409).json({ field: 'licenseNumber', message: 'License Number is already registered.' });
        }

        const tempPassword = crypto.randomBytes(4).toString('hex'); 
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

        const newUser = new User({
            ...otherData, 
            email,
            licenseNumber,
            branch,
            password: hashedPassword,
            role: 'co-owner',
            isVerified: false,
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires
        });
        
        await newUser.save();

        try {
            const activationLink = `http://localhost:3000/activate-account/${activationToken}`;
            await sendActivationEmail(email, 'Co-Owner', tempPassword, activationLink);
        } catch (error) {
            console.error("Error sending activation email:", error);
        }
        
        console.log(`✅ Co-Owner Added: ${email}`);
        res.status(201).json({ message: 'Co-Owner added successfully. Email sent.' });

    } catch (error) {
        console.error("Error adding co-owner or sending email:", error);
        res.status(500).json({ message: "User created, but failed to send activation email." });
    }
});


// --- GENERIC GET USERS ---
app.get('/api/users', async (req, res) => {
    try {
        const { role } = req.query;
        let query = {};
        if (role) query.role = role;
        const users = await User.find(query).select('-password');
        res.json(users);
    } catch (error) { res.status(500).json({ message: "Server error." }); }
});

app.get('/api/patients', async (req, res) => {
    try {
        const patients = await Patient.find();
        res.json(patients);
    } catch (error) { 
        res.status(500).json({ message: "Server error." }); 
    }
});

app.get('/api/patients/:id', async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: "Patient not found" });
        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

app.put('/api/patients/:id', async (req, res) => {
    try {
        const updatedPatient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedPatient) return res.status(404).json({ message: "Patient not found" });

        await AuditLog.create({
            action: "UPDATE_PATIENT",
            user: "SYSTEM", // Or pass the actual user email from frontend if available
            role: "SYSTEM",
            details: `Updated patient information for: ${updatedPatient.email}`
        });

        res.json(updatedPatient);
    } catch (error) {
        res.status(500).json({ message: "Error updating patient." });
    }
});

// --- GET SINGLE USER ---
app.get('/api/user/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) { res.status(500).json({ message: "Server error." }); }
});

// --- TOGGLE STATUS (Soft Delete) ---
// --- TOGGLE STATUS (Soft Delete) ---
app.put('/api/user/toggle-status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active' or 'inactive'

        // 1. Kunin muna ang user para ma-check ang verification status
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found." });

        // 2. SECURITY CHECK: Bawal i-activate kung hindi pa verified
        if (status === 'active' && !user.isVerified) {
            return res.status(400).json({ 
                message: "Cannot activate user. Email is not yet verified." 
            });
        }

        // 3. Update Status
        user.status = status;
        await user.save();

        await AuditLog.create({
            action: "STATUS_CHANGE",
            user: "ADMIN", // Or pass the actual admin email from frontend if available
            role: "owner",
            details: `Changed status of user ${user.email} to ${status}`
        });

        res.json({ message: `User marked as ${status}.`, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/user/resend-activation/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // Generate new credentials
        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

        // Update user document
        user.password = hashedPassword;
        user.activationToken = activationToken;
        user.temporaryPasswordExpires = temporaryPasswordExpires;
        user.isVerified = false;
        user.status = 'inactive';
        await user.save();

        // Resend activation email
        const activationLink = `http://localhost:3000/activate-account/${activationToken}`;
        await sendActivationEmail(user.email, user.role, tempPassword, activationLink);

        await AuditLog.create({
            action: "RESEND_ACTIVATION",
            user: "ADMIN",
            role: "owner",
            details: `Resent activation email to ${user.email}`
        });

        res.json({ message: "Activation email has been resent successfully." });

    } catch (error) {
        console.error("Error resending activation email:", error);
        res.status(500).json({ message: "Server error while resending activation email." });
    }
});


// --- UPDATE USER (Re-activation logic) ---
app.put('/api/user/:id', async (req, res) => {
    try {
        const { password, email, ...updateData } = req.body;
        const userId = req.params.id;
        const currentUser = await User.findById(userId);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        // Email Change Logic
        if (email && email !== currentUser.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) return res.status(409).json({ message: "New email is already in use." });

            const tempPassword = crypto.randomBytes(4).toString('hex');
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            const activationToken = crypto.randomBytes(32).toString('hex');

            updateData.email = email;
            updateData.password = hashedPassword;
            updateData.activationToken = activationToken;
            updateData.isVerified = false;
            updateData.status = 'inactive'; // Set to inactive upon email change

            const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
            const activationLink = `http://localhost:3000/activate-account/${activationToken}`;
            await sendActivationEmail(email, currentUser.role, tempPassword, activationLink);

            return res.json({ message: "User updated. Re-activation email sent.", user: updatedUser });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, { ...updateData, email }, { new: true });

        await AuditLog.create({
            action: "UPDATE_USER",
            user: "ADMIN",
            role: "owner",
            details: `Updated user information for: ${updatedUser.email}`
        });

        res.json(updatedUser);
    } catch (error) { res.status(500).json({ message: "Error updating user." }); }
});

// --- UPDATE PROFILE (OWNER/USER OWN PROFILE) ---
// --- UPDATE PROFILE (OWNER/USER OWN PROFILE) ---
app.put('/api/user/update-profile/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { 
            name, 
            contactNumber, 
            birthdate, 
            gender, 
            currentAddress, 
            profileImage 
        } = req.body;

        // 1. Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        // 2. Safely update Name fields (including Middle Name)
        if (name) {
            if (name.first !== undefined) user.name.first = name.first;
            if (name.middle !== undefined) user.name.middle = name.middle;
            if (name.last !== undefined) user.name.last = name.last;
        }

        // 3. Safely update Personal Demographics
        if (contactNumber !== undefined) user.contactNumber = contactNumber;
        if (birthdate !== undefined) user.birthdate = birthdate;
        if (gender !== undefined) user.gender = gender;
        if (profileImage !== undefined) user.profileImage = profileImage;

        // 4. Safely update Address
        if (currentAddress) {
            user.currentAddress = {
                ...user.currentAddress,
                ...currentAddress
            };
        }

        // 5. Save to database
        await user.save();

        // 6. Log the action
        await AuditLog.create({
            action: "UPDATE_PROFILE",
            user: user.email,
            role: user.role,
            details: `User updated their personal profile.`
        });

        // 7. Return success
        res.status(200).json({ 
            message: "Profile updated successfully.", 
            user 
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Server error updating profile." });
    }
});

// --- FORGOT PASSWORD ---
// --- FORGOT PASSWORD (UPDATED) ---
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user) {
            // User exists, so we generate and send a code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            user.resetPasswordOtp = code;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
            await user.save();

            await transporter.sendMail({
                from: '"NgitiFy Support" <garciaaeiounicole@gmail.com>',
                to: user.email,
                subject: 'Your Password Reset Code',
                text: `Your password reset code is: ${code}`,
            });
        }

        // IMPORTANT: Always send a success response, even if the user was not found.
        // This prevents attackers from guessing which emails are registered.
        res.status(200).json({ message: 'If your email is registered, you will receive a password reset code.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        // Even in case of an internal error, send a generic success response
        // to avoid leaking system state information.
        res.status(200).json({ message: 'If your email is registered, you will receive a password reset code.' });
    }
});

// --- VERIFY OTP ---
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ 
            email, 
            resetPasswordOtp: otp, // <--- CHANGED FROM resetPasswordOtp
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ message: "Invalid or expired OTP." });

        res.json({ message: "OTP Verified." });
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

// --- RESET PASSWORD ---
app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ message: "User not found." });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpires = undefined;
        user.isPasswordChanged = true;
        await user.save();

        await AuditLog.create({
            action: "PASSWORD_RESET",
            user: user.email,
            role: user.role,
            details: `User reset their password.`
        });

        res.json({ message: "Password reset successful." });
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

// --- CHANGE PASSWORD ---
app.post('/api/change-password', async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ message: "User not found." });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect current password." });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.isPasswordChanged = true;
        await user.save();

        await AuditLog.create({
            action: "PASSWORD_CHANGE",
            user: user.email,
            role: user.role,
            details: `User changed their password.`
        });

        res.json({ message: "Password updated successfully." });
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

// --- VERIFY PASSWORD UI CHECK ---
app.post('/api/verify-password', async (req, res) => {
    try {
        const { userId, password } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, message: "Incorrect password." });
        }
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

// --- GET AUDIT LOGS ---
app.get('/api/audit-logs', async (req, res) => {
    try {
        // Sort by newest first
        const logs = await AuditLog.find().sort({ timestamp: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching logs." });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        const { email, role } = req.body;
        await AuditLog.create({
            action: "LOGOUT",
            user: email,
            role: role,
            details: `User logged out successfully.`
        });
        res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        res.status(500).json({ message: "Server error during logout." });
    }
});

// ... (sa loob ng src/server/server.js, bago ang app.listen)

// --- CHECK EMAIL AVAILABILITY ROUTE ---
app.post('/api/check-email', async (req, res) => {
    try {
        const { email, excludeId } = req.body;
        
        // Gumawa ng query: Hanapin ang email, pero ibukod ang current user kung nag-eedit (excludeId)
        const query = { email: email };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const user = await User.findOne(query);
        
        if (user) {
            return res.status(409).json({ message: "Email already exists" });
        }
        
        return res.status(200).json({ message: "Email available" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error checking email" });
    }
});

app.get('/api/inventory', async (req, res) => {
    try {
        const items = await Inventory.find().sort({ createdAt: -1 });
        res.status(200).json(items);
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({ message: "Server error fetching inventory" });
    }
});

// POST a new inventory item
app.post('/api/inventory', async (req, res) => {
    try {
        const newItem = new Inventory(req.body);
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        console.error("Error adding inventory item:", error);
        res.status(500).json({ message: "Server error adding item" });
    }
});

app.get('/api/inventory/:id', async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }
        res.status(200).json(item);
    } catch (error) {
        console.error("Error fetching single inventory item:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ message: "Invalid item ID format" });
        }
        res.status(500).json({ message: "Server error fetching item" });
    }
});

// PUT to update an existing inventory item
app.put('/api/inventory/:id', async (req, res) => {
    try {
        const updatedItem = await Inventory.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { returnDocument: 'after', runValidators: true } // FIXED: Mongoose Deprecation
        );
        if (!updatedItem) return res.status(404).json({ message: "Item not found" });
        res.status(200).json(updatedItem);
    } catch (error) {
        console.error("Error updating inventory item:", error);
        res.status(500).json({ message: "Server error updating item" });
    }
});

// DELETE an inventory item
app.delete('/api/inventory/:id', async (req, res) => {
    try {
        const deletedItem = await Inventory.findByIdAndDelete(req.params.id);
        if (!deletedItem) return res.status(404).json({ message: "Item not found" });
        res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error("Error deleting inventory item:", error);
        res.status(500).json({ message: "Server error deleting item" });
    }
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));