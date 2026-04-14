require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const crypto = require('crypto'); 

// Import Middleware
const verifyToken = require('./middleware/auth');

// Import Model
const User = require('./models/User'); 
const AuditLog = require('./models/AuditLog'); 
const Patient = require('./models/Patient');
const Surgery = require('./models/Surgery');
const Inventory = require('./models/Inventory');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
    origin: ['http://localhost:3000', 'http://ngitify.com', 'https://ngitify.com', 'https://www.ngitify.com', 'https://ngitify.netlify.app'],
    credentials: true, 
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ Connected to Local MongoDB'))
.catch((err) => console.error('❌ Error connecting to MongoDB:', err));

// EMAIL CONFIG
const resend = new Resend(process.env.RESEND_API_KEY);
console.log('✅ Resend email client initialized');

// ================= PUBLIC ROUTES ================= //

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

        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

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

app.post('/api/activate-account', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: "No token provided." });

        const account = await User.findOne({ activationToken: token });

        if (!account) return res.status(400).json({ message: "Invalid or expired activation link." });

        account.isVerified = true;
        account.status = 'active';
        account.activationToken = undefined;
        await account.save();

        res.json({ 
            message: "Account activated successfully!",
            role: account.role
        });
    } catch (error) {
        console.error("Activation error:", error);
        res.status(500).json({ message: "Server error during activation." });
    }
});

const sendActivationEmail = async (email, role, tempPassword, activationLink) => {
    await resend.emails.send({
        from: 'NgitiFy Admin <noreply@ngitify.com>',
        to: email,
        subject: 'Welcome to NgitiFy! Activate Your Account',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #005466;">Welcome to NgitiFy!</h2>
                <p>Hello,</p>
                <p>Your <b>${role}</b> account has been successfully created.</p>
                ${tempPassword ? `
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Temporary Password:</strong> <span style="font-size: 18px; font-weight: bold; color: #000;">${tempPassword}</span></p>
                </div>
                ` : ''}
                <p>Please click the button below to activate your account:</p>
                <a href="${activationLink}" style="background-color: #005466; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Activate Account</a>
            </div>
        `
    });
};

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            user.resetPasswordOtp = code;
            user.resetPasswordExpires = Date.now() + 3600000; 
            await user.save();

            await resend.emails.send({
                from: 'NgitiFy Support <noreply@ngitify.com>',
                to: user.email,
                subject: 'Your Password Reset Code',
                text: `Your password reset code is: ${code}`,
            });
        }
        res.status(200).json({ message: 'If your email is registered, you will receive a password reset code.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(200).json({ message: 'If your email is registered, you will receive a password reset code.' });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ 
            email, 
            resetPasswordOtp: otp, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ message: "Invalid or expired OTP." });

        res.json({ message: "OTP Verified." });
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        const user = await User.findOne({ 
            email,
            resetPasswordOtp: { $exists: true, $ne: null },
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ message: "Reset session expired or invalid. Please request a new code." });

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

app.post('/api/check-email', async (req, res) => {
    try {
        const { email, excludeId } = req.body;
        
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


// ================= PROTECTED ROUTES ================= //

app.post('/api/add-dentist', verifyToken, async (req, res) => {
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
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

        const newUser = new User({
            ...otherData, 
            email,
            licenseNumber,
            password: hashedPassword,
            role: 'dentist',
            isVerified: false, 
            status: 'inactive', 
            activationToken,
            temporaryPasswordExpires
        });
        
        await newUser.save();

        await AuditLog.create({
            action: "CREATE_USER",
            user: req.user?.email || req.user?.id || "ADMIN", 
            role: req.user?.role || "owner",
            details: `Created new user: ${email}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(email, 'Dentist', tempPassword, activationLink);
            console.log(`✅ Dentist Added & Email Sent: ${email}`);
            res.status(201).json({ message: 'Dentist added successfully. Email sent.' });
        } catch (emailError) {
            console.error("Email failed:", emailError.message);
            res.status(201).json({ message: 'Dentist added, but activation email failed to send.' });
        }

    } catch (error) {
        console.error("Error adding dentist:", error);
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/add-secretary', verifyToken, async (req, res) => {
    try {
        const { email, ...otherData } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

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
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "owner",
            details: `Created new user: ${email}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(email, 'Secretary', tempPassword, activationLink);
            console.log(`✅ Secretary Added & Email Sent: ${email}`);
            res.status(201).json({ message: 'Secretary added successfully. Email sent.' });
        } catch (emailError) {
            console.error("Email failed:", emailError.message);
            res.status(201).json({ message: 'Secretary added, but activation email failed to send.' });
        }

    } catch (error) {
        console.error("Error adding secretary:", error);
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/add-patient', verifyToken, async (req, res) => {
    try {
        const { email, ...otherData } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const newUser = new User({
            ...otherData,
            email,
            password: hashedPassword,
            role: 'patient',
            isVerified: false,
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires
        });
        await newUser.save();

        await AuditLog.create({
            action: "CREATE_PATIENT",
            user: req.user?.email || req.user?.id || "SYSTEM",
            role: req.user?.role || "SYSTEM",
            details: `Created new patient: ${email}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        console.log(`📧 Attempting to send activation email to: ${email}`);
        console.log(`🔗 Activation link: ${activationLink}`);

        try {
            await sendActivationEmail(email, 'Patient', tempPassword, activationLink);
            console.log(`✅ Email sent successfully to: ${email}`);
            res.status(201).json({ message: 'Patient added successfully. Activation email sent.' });
        } catch (emailError) {
            console.error("Email failed:", emailError.message);
            res.status(201).json({ message: 'Patient added, but activation email failed to send.' });
        }

    } catch (error) {
        console.error("Error adding patient:", error);
        res.status(500).json({ message: "Error adding patient." });
    }
});

app.post('/api/add-co-owner', verifyToken, async (req, res) => {
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
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 

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

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(email, 'Co-Owner', tempPassword, activationLink);
            console.log(`✅ Co-Owner Added & Email Sent: ${email}`);
        } catch (emailError) {
            console.error("Email failed:", emailError.message);
        }
        
        res.status(201).json({ message: 'Co-Owner added successfully. Email sent.' });

    } catch (error) {
        console.error("Error adding co-owner:", error);
        res.status(500).json({ message: "User created, but failed to send activation email." });
    }
});

app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const { role } = req.query;
        let query = {};
        if (role) query.role = role;
        const users = await User.find(query).select('-password');
        res.json(users);
    } catch (error) { res.status(500).json({ message: "Server error." }); }
});

app.get('/api/patients', verifyToken, async (req, res) => {
    try {
        const patients = await User.find({ role: 'patient' }).select('-password');
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

app.get('/api/patients/:id', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id).select('-password');
        if (!patient) return res.status(404).json({ message: "Patient not found" });
        res.json(patient);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

app.put('/api/patients/:id', verifyToken, async (req, res) => {
    try {
        const updatedPatient = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
        if (!updatedPatient) return res.status(404).json({ message: "Patient not found" });

        await AuditLog.create({
            action: "UPDATE_PATIENT",
            user: req.user?.email || req.user?.id || "SYSTEM",
            role: req.user?.role || "SYSTEM",
            details: `Updated patient information for: ${updatedPatient.email}`
        });

        res.json(updatedPatient);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

app.get('/api/user/:id', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (error) { res.status(500).json({ message: "Server error." }); }
});

app.put('/api/user/toggle-status/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; 

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found." });

        if (status === 'active' && !user.isVerified) {
            return res.status(400).json({ 
                message: "Cannot activate user. Email is not yet verified." 
            });
        }

        user.status = status;
        await user.save();

        await AuditLog.create({
            action: "STATUS_CHANGE",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "owner",
            details: `Changed status of user ${user.email} to ${status}`
        });

        res.json({ message: `User marked as ${status}.`, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error." });
    }
});

app.put('/api/patient/toggle-status/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const patient = await User.findById(id);
        if (!patient) return res.status(404).json({ message: "Patient not found." });

        if (status === 'active' && !patient.isVerified) {
            return res.status(400).json({
                message: "Cannot activate patient. Email is not yet verified."
            });
        }

        patient.status = status;
        await patient.save();

        await AuditLog.create({
            action: "STATUS_CHANGE",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "owner",
            details: `Changed status of patient ${patient.email} to ${status}`
        });

        res.json({ message: `Patient marked as ${status}.`, patient });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/patient/resend-activation/:id', verifyToken, async (req, res) => {
    try {
        // ✅ CORRECT — use User model, consistent with where patients are stored
        const patient = await User.findById(req.params.id);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }

        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        patient.activationToken = activationToken;
        patient.temporaryPasswordExpires = temporaryPasswordExpires;
        patient.isVerified = false;
        patient.status = 'inactive';
        await patient.save();

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;
        await sendActivationEmail(patient.email, 'Patient', null, activationLink);

        await AuditLog.create({
            action: "RESEND_ACTIVATION",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "owner",
            details: `Resent activation email to patient ${patient.email}`
        });

        res.json({ message: "Activation email has been resent successfully." });

    } catch (error) {
        console.error("Error resending patient activation email:", error);
        res.status(500).json({ message: "Server error while resending activation email." });
    }
});

app.put('/api/user/:id', verifyToken, async (req, res) => {
    try {
        const { password, email, ...updateData } = req.body;
        const userId = req.params.id;
        const currentUser = await User.findById(userId);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

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
            updateData.status = 'inactive'; 

            const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
            
            const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;
            await sendActivationEmail(email, currentUser.role, tempPassword, activationLink);

            return res.json({ message: "User updated. Re-activation email sent.", user: updatedUser });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, { ...updateData, email }, { new: true });

        await AuditLog.create({
            action: "UPDATE_USER",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "owner",
            details: `Updated user information for: ${updatedUser.email}`
        });

        res.json(updatedUser);
    } catch (error) { res.status(500).json({ message: "Error updating user." }); }
});

app.put('/api/user/update-profile/:id', verifyToken, async (req, res) => {
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

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (name) {
            if (name.first !== undefined) user.name.first = name.first;
            if (name.middle !== undefined) user.name.middle = name.middle;
            if (name.last !== undefined) user.name.last = name.last;
        }

        if (contactNumber !== undefined) user.contactNumber = contactNumber;
        if (birthdate !== undefined) user.birthdate = birthdate;
        if (gender !== undefined) user.gender = gender;
        if (profileImage !== undefined) user.profileImage = profileImage;

        if (currentAddress) {
             user.currentAddress = {
                ...user.currentAddress,
                ...currentAddress
            };
        }

        await user.save();

        await AuditLog.create({
            action: "UPDATE_PROFILE",
            user: user.email,
            role: user.role,
            details: `User updated their personal profile.`
        });

        res.status(200).json({ 
            message: "Profile updated successfully.", 
            user 
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Server error updating profile." });
    }
});

app.post('/api/verify-current-password', verifyToken, async (req, res) => {
    try {
        const { userId, currentPassword } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        
        if (isMatch) {
            res.status(200).json({ success: true, message: "Password verified." });
        } else {
            res.status(400).json({ success: false, message: "Incorrect current password." });
        }
    } catch (error) {
        console.error("Error verifying current password:", error);
        res.status(500).json({ message: "Server error during verification." });
    }
});

app.post('/api/change-password', verifyToken, async (req, res) => {
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

app.post('/api/verify-password', verifyToken, async (req, res) => {
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

app.get('/api/audit-logs', verifyToken, async (req, res) => {
    try {
        const logs = await AuditLog.find().sort({ timestamp: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching logs." });
    }
});

app.post('/api/logout', verifyToken, async (req, res) => {
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

app.get('/api/inventory', verifyToken, async (req, res) => {
    try {
        const items = await Inventory.find().sort({ createdAt: -1 });
        res.status(200).json(items);
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({ message: "Server error fetching inventory" });
    }
});

app.post('/api/inventory', verifyToken, async (req, res) => {
    try {
        const newItem = new Inventory(req.body);
        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        console.error("Error adding inventory item:", error);
        res.status(500).json({ message: "Server error adding item" });
    }
});

app.get('/api/inventory/:id', verifyToken, async (req, res) => {
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

app.put('/api/inventory/:id', verifyToken, async (req, res) => {
    try {
        const updatedItem = await Inventory.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { returnDocument: 'after', runValidators: true } 
        );
        if (!updatedItem) return res.status(404).json({ message: "Item not found" });
        res.status(200).json(updatedItem);
    } catch (error) {
        console.error("Error updating inventory item:", error);
        res.status(500).json({ message: "Server error updating item" });
    }
});

app.delete('/api/inventory/:id', verifyToken, async (req, res) => {
    try {
        const deletedItem = await Inventory.findByIdAndDelete(req.params.id);
        if (!deletedItem) return res.status(404).json({ message: "Item not found" });
        res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error("Error deleting inventory item:", error);
        res.status(500).json({ message: "Server error deleting item" });
    }
});

app.post('/api/surgeries', verifyToken, async (req, res) => {
    try {
        const newSurgery = new Surgery(req.body);
        await newSurgery.save();

        await AuditLog.create({
            action: "CREATE_SURGERY",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "SYSTEM",
            details: `Created new surgery record for patient ID: ${newSurgery.patient}`
        });

        res.status(201).json(newSurgery);
    } catch (error) {
        console.error("Error creating surgery:", error);
        res.status(500).json({ message: "Error creating surgery." });
    }
});

app.get('/api/surgeries/:id', verifyToken, async (req, res) => {
    try {
        const surgery = await Surgery.findById(req.params.id)
            .populate('patient')
            .populate('dentist', 'name email role');
        if (!surgery) return res.status(404).json({ message: "Surgery not found" });
        res.json(surgery);
    } catch (error) {
        console.error("Error fetching single surgery:", error);
        res.status(500).json({ message: "Server error fetching surgery." });
    }
});

app.put('/api/surgeries/:id', verifyToken, async (req, res) => {
    try {
        const updatedSurgery = await Surgery.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedSurgery) return res.status(404).json({ message: "Surgery not found" });

        await AuditLog.create({
            action: "UPDATE_SURGERY",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "SYSTEM",
            details: `Updated surgery record ID: ${updatedSurgery._id}`
        });

        res.json(updatedSurgery);
    } catch (error) {
        console.error("Error updating surgery:", error);
        res.status(500).json({ message: "Error updating surgery." });
    }
});

app.delete('/api/surgeries/:id', verifyToken, async (req, res) => {
    try {
        const deletedSurgery = await Surgery.findByIdAndDelete(req.params.id);
        if (!deletedSurgery) return res.status(404).json({ message: "Surgery not found" });

        await AuditLog.create({
            action: "DELETE_SURGERY",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "SYSTEM",
            details: `Deleted surgery record ID: ${req.params.id}`
        });

        res.json({ message: "Surgery deleted successfully." });
    } catch (error) {
        console.error("Error deleting surgery:", error);
        res.status(500).json({ message: "Error deleting surgery." });
    }
});

// ============================================================
// PHASE 1 — NEW ROUTES FOR server.js
// INSTRUCTIONS: Paste all of this BEFORE the final app.listen()
// line at the bottom of your server.js file.
// ============================================================


// -------------------------------------------------------
// SURGERIES: FILTER BY QUERY PARAMS
// REPLACE your existing GET /api/surgeries route with this.
// Adds support for ?patientId= ?dentistId= ?status= ?date=
// -------------------------------------------------------

app.get('/api/surgeries', verifyToken, async (req, res) => {
    try {
        const { patientId, dentistId, status, date } = req.query;
        const query = {};

        if (patientId) query.patient = patientId;
        if (dentistId) query.dentist = dentistId;
        if (status) query.status = status;

        // Filter by a specific calendar date (matches any time within that day)
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }

        const surgeries = await Surgery.find(query)
            .populate('patient', 'name email contactNumber profileImage')
            .populate('dentist', 'name email role')
            .sort({ date: -1 });

        res.json(surgeries);
    } catch (error) {
        console.error('Error fetching surgeries:', error);
        res.status(500).json({ message: 'Server error fetching surgeries.' });
    }
});


// -------------------------------------------------------
// SURGERIES: UPDATE STATUS ONLY
// Used by secretary (confirm/cancel/reschedule) and
// dentist (mark complete).
// -------------------------------------------------------

app.put('/api/surgeries/:id/status', verifyToken, async (req, res) => {
    try {
        const { status, remarks, preOpInstructions, date, time } = req.body;

        const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const updateFields = { status };
        if (remarks !== undefined) updateFields.remarks = remarks;
        if (preOpInstructions !== undefined) updateFields.preOpInstructions = preOpInstructions;

        // Allow rescheduling a date/time in the same call
        if (date) updateFields.date = new Date(date);
        if (time) updateFields.time = time;

        const updatedSurgery = await Surgery.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        ).populate('patient', 'name email').populate('dentist', 'name email');

        if (!updatedSurgery) return res.status(404).json({ message: 'Surgery not found.' });

        await AuditLog.create({
            action: 'UPDATE_SURGERY_STATUS',
            user: req.user?.email || req.user?.id,
            role: req.user?.role,
            details: `Surgery ID ${updatedSurgery._id} status changed to '${status}'.`
        });

        res.json(updatedSurgery);
    } catch (error) {
        console.error('Error updating surgery status:', error);
        res.status(500).json({ message: 'Server error updating surgery status.' });
    }
});


// -------------------------------------------------------
// APPOINTMENT BOOKING REQUEST (from patient mobile app)
// Creates a 'pending' surgery entry visible to the secretary.
// -------------------------------------------------------

app.post('/api/appointments/request', verifyToken, async (req, res) => {
    try {
        const { date, time, procedure, notes, branch } = req.body;

        if (!date || !procedure) {
            return res.status(400).json({ message: 'Date and procedure are required.' });
        }

        // The patient making the request — from their JWT token
        const patientUser = await User.findById(req.user.id).select('name email role');
        if (!patientUser || patientUser.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can submit appointment requests.' });
        }

        const newSurgery = new Surgery({
            patient: req.user.id,
            dentist: req.body.dentistId || null, // optional — secretary can assign later
            branch: branch || 'Marikina Branch',
            date: new Date(date),
            time: time || '',
            procedure,
            notes: notes || '',
            status: 'pending',
            source: 'Smile Hub (Online)',
            requestedBy: req.user.id
        });

        // dentist is required on the schema — if not provided, use a placeholder check
        if (!req.body.dentistId) {
            // Temporarily allow null by removing required; we'll assign during confirmation
            newSurgery.dentist = undefined;
        }

        await newSurgery.save();

        await AuditLog.create({
            action: 'APPOINTMENT_REQUEST',
            user: patientUser.email,
            role: 'patient',
            details: `Patient ${patientUser.name.first} ${patientUser.name.last} requested an appointment for: ${procedure} on ${new Date(date).toDateString()}`
        });

        res.status(201).json({
            message: 'Appointment request submitted successfully. You will be notified once confirmed.',
            surgery: newSurgery
        });

    } catch (error) {
        console.error('Error submitting appointment request:', error);
        res.status(500).json({ message: 'Server error submitting appointment request.' });
    }
});


// -------------------------------------------------------
// TREATMENT LOGS: GET all logs for a patient
// -------------------------------------------------------

app.get('/api/patients/:id/treatment-logs', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id).select('treatmentLogs name');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        // Sort logs newest first
        const sorted = (patient.treatmentLogs || []).sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        res.json(sorted);
    } catch (error) {
        console.error('Error fetching treatment logs:', error);
        res.status(500).json({ message: 'Server error fetching treatment logs.' });
    }
});


// -------------------------------------------------------
// TREATMENT LOGS: ADD a new log entry (by dentist)
// -------------------------------------------------------

app.post('/api/patients/:id/treatment-logs', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const { date, procedure, tooth, category, notes, branch } = req.body;

        if (!date || !procedure) {
            return res.status(400).json({ message: 'Date and procedure are required.' });
        }

        // Fetch dentist name from the token's user id
        const dentist = await User.findById(req.user.id).select('name');
        const dentistName = dentist
            ? `Dr. ${dentist.name.first} ${dentist.name.last}`
            : 'Unknown Dentist';

        const newLog = {
            date: new Date(date),
            procedure,
            tooth: tooth || '',
            category: category || 'Other',
            notes: notes || '',
            dentistId: req.user.id,
            dentistName,
            branch: branch || 'Marikina Branch'
        };

        patient.treatmentLogs.push(newLog);
        await patient.save();

        await AuditLog.create({
            action: 'ADD_TREATMENT_LOG',
            user: req.user?.email,
            role: req.user?.role,
            details: `Added treatment log for patient ID ${req.params.id}: ${procedure}`
        });

        // Return the newly added log (last item in the array)
        const addedLog = patient.treatmentLogs[patient.treatmentLogs.length - 1];
        res.status(201).json(addedLog);

    } catch (error) {
        console.error('Error adding treatment log:', error);
        res.status(500).json({ message: 'Server error adding treatment log.' });
    }
});


// -------------------------------------------------------
// TREATMENT LOGS: DELETE a single log entry
// -------------------------------------------------------

app.delete('/api/patients/:id/treatment-logs/:logId', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const logIndex = patient.treatmentLogs.findIndex(
            (l) => l._id.toString() === req.params.logId
        );
        if (logIndex === -1) return res.status(404).json({ message: 'Log entry not found.' });

        patient.treatmentLogs.splice(logIndex, 1);
        await patient.save();

        res.json({ message: 'Treatment log deleted successfully.' });
    } catch (error) {
        console.error('Error deleting treatment log:', error);
        res.status(500).json({ message: 'Server error deleting treatment log.' });
    }
});


// -------------------------------------------------------
// ODONTOGRAM: GET the tooth chart for a patient
// -------------------------------------------------------

app.get('/api/patients/:id/odontogram', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id).select('odontogram name');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        // Convert Map to a plain object for JSON serialization
        const odontogramObj = patient.odontogram
            ? Object.fromEntries(patient.odontogram)
            : {};

        res.json(odontogramObj);
    } catch (error) {
        console.error('Error fetching odontogram:', error);
        res.status(500).json({ message: 'Server error fetching odontogram.' });
    }
});


// -------------------------------------------------------
// ODONTOGRAM: SAVE / UPDATE the tooth chart for a patient
// Body: { "18": "missing", "26": "crown", "45": "decayed" }
// -------------------------------------------------------

app.put('/api/patients/:id/odontogram', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        // Merge incoming changes into the existing map (don't overwrite untouched teeth)
        const updates = req.body;
        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ message: 'Odontogram data must be a key-value object.' });
        }

        if (!patient.odontogram) patient.odontogram = new Map();
        Object.entries(updates).forEach(([tooth, status]) => {
            patient.odontogram.set(tooth, status);
        });

        await patient.save();

        await AuditLog.create({
            action: 'UPDATE_ODONTOGRAM',
            user: req.user?.email,
            role: req.user?.role,
            details: `Odontogram updated for patient ID ${req.params.id}`
        });

        res.json({
            message: 'Odontogram saved successfully.',
            odontogram: Object.fromEntries(patient.odontogram)
        });
    } catch (error) {
        console.error('Error saving odontogram:', error);
        res.status(500).json({ message: 'Server error saving odontogram.' });
    }
});


// -------------------------------------------------------
// INVENTORY DEDUCTION: Reduce stock after treatment
// Body: { itemsUsed: [{ inventoryId, quantityUsed }] }
// -------------------------------------------------------

app.patch('/api/inventory/deduct', verifyToken, async (req, res) => {
    try {
        const { itemsUsed, patientId, surgeryId } = req.body;

        if (!itemsUsed || !Array.isArray(itemsUsed) || itemsUsed.length === 0) {
            return res.status(400).json({ message: 'itemsUsed array is required.' });
        }

        const results = [];
        const errors = [];

        for (const item of itemsUsed) {
            const { inventoryId, quantityUsed } = item;
            if (!inventoryId || !quantityUsed || quantityUsed <= 0) {
                errors.push({ inventoryId, error: 'Invalid item or quantity.' });
                continue;
            }

            const inventoryItem = await Inventory.findById(inventoryId);
            if (!inventoryItem) {
                errors.push({ inventoryId, error: 'Item not found.' });
                continue;
            }

            if (inventoryItem.quantity < quantityUsed) {
                errors.push({
                    inventoryId,
                    itemName: inventoryItem.itemName,
                    error: `Insufficient stock. Available: ${inventoryItem.quantity} ${inventoryItem.unit}.`
                });
                continue;
            }

            inventoryItem.quantity -= quantityUsed;
            await inventoryItem.save();

            results.push({
                inventoryId,
                itemName: inventoryItem.itemName,
                previousQty: inventoryItem.quantity + quantityUsed,
                deducted: quantityUsed,
                remainingQty: inventoryItem.quantity,
                isLowStock: inventoryItem.quantity <= inventoryItem.reorderLevel
            });
        }

        await AuditLog.create({
            action: 'INVENTORY_DEDUCTION',
            user: req.user?.email,
            role: req.user?.role,
            details: `Material usage logged${patientId ? ` for patient ID ${patientId}` : ''}. ${results.length} item(s) deducted.`
        });

        const statusCode = errors.length > 0 && results.length === 0 ? 400 : 200;
        res.status(statusCode).json({
            message: errors.length === 0
                ? 'All materials successfully deducted.'
                : `${results.length} item(s) deducted. ${errors.length} item(s) had errors.`,
            deducted: results,
            errors
        });

    } catch (error) {
        console.error('Error deducting inventory:', error);
        res.status(500).json({ message: 'Server error deducting inventory.' });
    }
});


// -------------------------------------------------------
// ARCHIVE USER: Move a dentist or secretary to archive
// Replaces toggle-status for Owner FR#7 and FR#11
// -------------------------------------------------------

app.put('/api/user/archive/:id', verifyToken, async (req, res) => {
    try {
        const { isArchived } = req.body; // true to archive, false to restore

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const archivableRoles = ['dentist', 'secretary', 'co-owner'];
        if (!archivableRoles.includes(user.role)) {
            return res.status(403).json({ message: 'Only dentists and secretaries can be archived.' });
        }

        user.isArchived = Boolean(isArchived);
        // Archived users are also set to inactive so they cannot log in
        if (user.isArchived) user.status = 'inactive';

        await user.save();

        await AuditLog.create({
            action: user.isArchived ? 'ARCHIVE_USER' : 'RESTORE_USER',
            user: req.user?.email,
            role: req.user?.role,
            details: `${user.role} ${user.email} was ${user.isArchived ? 'archived' : 'restored'}.`
        });

        res.json({
            message: `User ${user.isArchived ? 'archived' : 'restored'} successfully.`,
            user: { _id: user._id, email: user.email, isArchived: user.isArchived, status: user.status }
        });
    } catch (error) {
        console.error('Error archiving user:', error);
        res.status(500).json({ message: 'Server error archiving user.' });
    }
});


// -------------------------------------------------------
// DASHBOARD STATS: Real counts for owner/secretary widgets
// Returns: total patients, today's appointments, pending
// appointments, active dentists, low-stock items
// -------------------------------------------------------

app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const [
            totalPatients,
            activeDentists,
            todayAppointments,
            pendingAppointments,
            lowStockItems
        ] = await Promise.all([
            User.countDocuments({ role: 'patient', status: 'active' }),
            User.countDocuments({ role: 'dentist', status: 'active', isArchived: { $ne: true } }),
            Surgery.countDocuments({ date: { $gte: todayStart, $lte: todayEnd } }),
            Surgery.countDocuments({ status: 'pending' }),
            Inventory.countDocuments({ $expr: { $lte: ['$quantity', '$reorderLevel'] } })
        ]);

        res.json({
            totalPatients,
            activeDentists,
            todayAppointments,
            pendingAppointments,
            lowStockItems
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Server error fetching stats.' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));