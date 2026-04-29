require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: 'Too many attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Import Middleware
const verifyToken = require('./middleware/auth');

// Import Model
const User = require('./models/User'); 
const AuditLog = require('./models/AuditLog'); 
// Patient model removed — patients use the User model (role: 'patient')
const Surgery = require('./models/Surgery');
const Inventory = require('./models/Inventory');
const Notification = require('./models/Notification');
const Branch = require('./models/Branch');
const SystemConfig = require('./models/SystemConfig');
const RolePermission = require('./models/RolePermission');
const backupRoutes = require('./routes/backup');
const integrityRoutes = require('./routes/integrity');
// ADD this line with the other model imports (after the AuditLog import)
const MaterialUsageLog = require('./models/MaterialUsageLog');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
    origin: ['http://localhost:3000', 'http://ngitify.com', 'https://ngitify.com', 'https://www.ngitify.com', 'https://ngitify.netlify.app'],
    credentials: true, 
};
app.use(helmet());
app.use(cors(corsOptions));
app.use('/api', backupRoutes);
app.use('/api', integrityRoutes);

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

app.post('/api/login', loginLimiter, async (req, res) => {
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

        if (user.status === 'inactive') {
            return res.status(403).json({ message: "Your account is inactive. Please contact an administrator." });
        }

        const assignedBranch = user.role === 'branch-manager'
            ? (user.assignedBranches?.[0] || null)
            : null;

        // ✅ PHASE 3: Include isDentist flag for owner-role users
        const isDentist = user.role === 'owner' ? (user.isDentist || false) : undefined;

        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email, assignedBranch, isDentist },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        await AuditLog.create({
            action: "LOGIN",
            user: user.email,
            role: user.role,
            details: `User logged in successfully.`
        });

        res.json({ token, role: user.role, userId: user._id, assignedBranch, isDentist });

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

app.post('/api/forgot-password', otpLimiter, async (req, res) => {
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

app.post('/api/verify-otp', otpLimiter, async (req, res) => {
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

app.post('/api/reset-password', otpLimiter, async (req, res) => {
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
        const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'owner'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const { email, licenseNumber, ...otherData } = req.body;

        const existingEmail = await User.findOne({ email });
        if (existingEmail) return res.status(409).json({ field: 'email', message: 'Email address is already registered.' });

        if (licenseNumber) {
            const existingLicense = await User.findOne({ licenseNumber });
            if (existingLicense) return res.status(409).json({ field: 'licenseNumber', message: 'License Number is already registered.' });
        }

        // Branch managers must assign the new dentist to their own branch only
        const assignedBranches = req.user.role === 'branch-manager'
            ? [req.user.assignedBranch]
            : (otherData.assignedBranches || []);

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const newUser = new User({
            ...otherData,
            email,
            licenseNumber,
            assignedBranches,
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
            role: req.user?.role || "administrator",
            details: `Created new dentist: ${email}${req.user.role === 'branch-manager' ? ` (branch: ${req.user.assignedBranch})` : ''}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(email, 'Dentist', tempPassword, activationLink);
            console.log(`✅ Dentist Added & Email Sent: ${email}`);
            res.status(201).json({ message: 'Dentist added successfully. Activation email sent.' });
        } catch (emailError) {
            console.error("⚠️ Activation email failed for dentist:", emailError.message);
            res.status(207).json({ message: 'Dentist added, but activation email failed to send. Please resend manually.' });
        }

    } catch (error) {
        console.error("Error adding dentist:", error);
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/add-secretary', verifyToken, async (req, res) => {
    try {
        const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'owner'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const { email, ...otherData } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        // Branch managers must assign the new secretary to their own branch only
        const assignedBranches = req.user.role === 'branch-manager'
            ? [req.user.assignedBranch]
            : (otherData.assignedBranches || []);

        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const newUser = new User({
            ...otherData,
            email,
            assignedBranches,
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
            role: req.user?.role || "administrator",
            details: `Created new secretary: ${email}${req.user.role === 'branch-manager' ? ` (branch: ${req.user.assignedBranch})` : ''}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(email, 'Secretary', tempPassword, activationLink);
            console.log(`✅ Secretary Added & Email Sent: ${email}`);
            res.status(201).json({ message: 'Secretary added successfully. Activation email sent.' });
        } catch (emailError) {
            console.error("⚠️ Activation email failed for secretary:", emailError.message);
            res.status(207).json({ message: 'Secretary added, but activation email failed to send. Please resend manually.' });
        }

    } catch (error) {
        console.error("Error adding secretary:", error);
        res.status(500).json({ message: "Server error." });
    }
});

// -------------------------------------------------------
// ADD BRANCH MANAGER (Admin Only)
// -------------------------------------------------------
app.post('/api/add-branch-manager', verifyToken, async (req, res) => {
    try {
        // Security: Ensure only administrators can add branch managers
        if (req.user.role !== 'administrator') {
            return res.status(403).json({ message: "Access denied. Admin only." });
        }

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
            role: 'branch-manager', // Explicitly setting the role
            isVerified: false, 
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires
        });
        await newUser.save();

        await AuditLog.create({
            action: "CREATE_USER",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            details: `Created new branch manager: ${email}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(email, 'Branch Manager', tempPassword, activationLink);
            console.log(`✅ Branch Manager Added & Email Sent: ${email}`);
            res.status(201).json({ message: 'Branch Manager added successfully. Activation email sent.' });
        } catch (emailError) {
            console.error("⚠️ Activation email failed for branch manager:", emailError.message);
            res.status(207).json({ message: 'Branch Manager added, but activation email failed to send. Please resend manually.' });
        }

    } catch (error) {
        console.error("Error adding branch manager:", error);
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/add-patient', verifyToken, async (req, res) => {
    try {
        if (!['administrator', 'co-administrator', 'branch-manager', 'secretary', 'owner'].includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied." });
        }
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
            console.error("⚠️ Activation email failed for patient:", emailError.message);
            res.status(207).json({ message: 'Patient added, but activation email failed to send. Please resend manually.' });
        }

    } catch (error) {
        console.error("Error adding patient:", error);
        res.status(500).json({ message: "Error adding patient." });
    }
});

app.post('/api/add-co-administrator', verifyToken, async (req, res) => {
    try {
        // Both administrator and co-administrator can create co-admin accounts
        // (Plan §2.2: co-admin has same access as admin except ownership transfer)
        if (!['administrator', 'co-administrator'].includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied. Admin tier only." });
        }
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
            role: 'co-administrator',
            isVerified: false,
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires
        });
        
        await newUser.save();

        await AuditLog.create({
            action: "CREATE_USER",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            details: `Created new co-administrator: ${email}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(email, 'Co-Administrator', tempPassword, activationLink);
            console.log(`✅ Co-Administrator Added & Email Sent: ${email}`);
        } catch (emailError) {
            console.error("⚠️ Activation email failed for co-administrator:", emailError.message);
            return res.status(207).json({ message: 'Co-Administrator added, but activation email failed to send. Please resend manually.' });
        }

        res.status(201).json({ message: 'Co-Administrator added successfully. Activation email sent.' });

    } catch (error) {
        console.error("Error adding co-administrator:", error);
        res.status(500).json({ message: "Server error while creating co-administrator account." });
    }
});

// -------------------------------------------------------
// ✅ PHASE 3: ADD OWNER
// -------------------------------------------------------
app.post('/api/add-owner', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'administrator') {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }

        const { email, isDentist, ...otherData } = req.body;

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
            role: 'owner',
            isDentist: isDentist === true,
            isVerified: false,
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires
        });
        await newUser.save();

        await AuditLog.create({
            action: 'CREATE_USER',
            user: req.user?.email || 'ADMIN',
            role: req.user?.role || 'administrator',
            details: `Created new owner account: ${email}${isDentist ? ' (with Dentist access)' : ''}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(email, 'Owner', tempPassword, activationLink);
            res.status(201).json({ message: 'Owner added successfully. Activation email sent.' });
        } catch (emailError) {
            console.error('⚠️ Activation email failed for owner:', emailError.message);
            res.status(207).json({ message: 'Owner added, but activation email failed. Please resend manually.' });
        }

    } catch (error) {
        console.error('Error adding owner:', error);
        res.status(500).json({ message: 'Server error while creating owner account.' });
    }
});

// -------------------------------------------------------
// GET ALL USERS (With Role-Based Security)
// -------------------------------------------------------
// Explicit allowlists — any new roles added to the system are blocked by default
const SECRETARY_ALLOWED_ROLES = ['patient'];
const DENTIST_ALLOWED_ROLES   = ['patient', 'dentist', 'secretary'];

app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const { role } = req.query;

        // SECURITY CHECK: Restrict what secretaries can query
        if (req.user.role === 'secretary') {
            if (!role || !SECRETARY_ALLOWED_ROLES.includes(role)) {
                return res.status(403).json({
                    message: "Access denied. You do not have permission to view these staff accounts."
                });
            }
        }

        // SECURITY CHECK: Restrict what dentists can query
        if (req.user.role === 'dentist') {
            if (!role || !DENTIST_ALLOWED_ROLES.includes(role)) {
                return res.status(403).json({
                    message: "Access denied. You do not have permission to view management accounts."
                });
            }
        }

        let query = {};
        if (role) query.role = role;

        // Branch managers can only see users in their own branch
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            query.assignedBranches = { $in: [req.user.assignedBranch] };
        }

        const users = await User.find(query).select('-password');
        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Server error." });
    }
});

app.get('/api/patients', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'dentist', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const baseFilter = { role: 'patient' };

        // Branch managers only see patients in their branch
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            baseFilter.assignedBranches = { $in: [req.user.assignedBranch] };
        }

        const patients = await User.find(baseFilter)
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(baseFilter);

        res.json({ patients, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

app.get('/api/patients/:id', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'dentist', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
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
        const { email } = req.body;
        const patientId = req.params.id;

        const currentPatient = await User.findById(patientId);
        if (!currentPatient) return res.status(404).json({ message: "Patient not found" });

        // Phase 5: Secretary cannot escalate or modify sensitive user fields
        if (req.user.role === 'secretary') {
            const blockedFields = ['role', 'isVerified', 'password'];
            const hasBlockedField = blockedFields.some(f => req.body[f] !== undefined);
            if (hasBlockedField) {
                return res.status(403).json({ message: 'Access denied. Secretary cannot modify role, verification, or password fields.' });
            }
        }

        const {
            name,
            contactNumber,
            birthdate,
            gender,
            currentAddress,
            permanentAddress,
            medicalHistory,
            guardian
        } = req.body;

        const updateData = {
            name,
            contactNumber,
            birthdate,
            gender,
            currentAddress,
            permanentAddress,
            medicalHistory,
            guardian
        };

        if (email && email !== currentPatient.email) {
            const emailExists = await User.findOne({ email, _id: { $ne: patientId } });
            if (emailExists) return res.status(409).json({ message: "This email address is already in use by another account." });
            updateData.email = email;
        }

        const updatedPatient = await User.findByIdAndUpdate(
            patientId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        await AuditLog.create({
            action: "UPDATE_PATIENT",
            user: req.user?.email || req.user?.id || "SYSTEM",
            role: req.user?.role || "SYSTEM",
            details: `Updated patient information for: ${updatedPatient.email}`
        });

        res.json(updatedPatient);
    } catch (error) {
        console.error('Error updating patient:', error);
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

        // ── Co-Admin Security Guard ──────────────────────────────────────────
        // Co-administrator cannot activate or deactivate an administrator account
        if (user.role === 'administrator' && req.user.role === 'co-administrator') {
            await AuditLog.create({
                action: 'UNAUTHORIZED_ESCALATION_ATTEMPT',
                user: req.user.email,
                role: 'co-administrator',
                actorId: req.user.id,
                actorRole: 'co-administrator',
                targetId: user._id,
                targetModel: 'User',
                details: `Unauthorized attempt to change status of administrator account (${user.email}) by co-administrator.`
            });
            return res.status(403).json({ message: 'Access denied. Cannot modify the administrator account.' });
        }
        // ────────────────────────────────────────────────────────────────────

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
            role: req.user?.role || "administrator",
            actorId: req.user?.id,
            actorRole: req.user?.role,
            targetId: user._id,
            targetModel: 'User',
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
            role: req.user?.role || "administrator",
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
            role: req.user?.role || "administrator",
            details: `Resent activation email to patient ${patient.email}`
        });

        res.json({ message: "Activation email has been resent successfully." });

    } catch (error) {
        console.error("Error resending patient activation email:", error);
        res.status(500).json({ message: "Server error while resending activation email." });
    }
});

app.post('/api/user/resend-activation/:id', verifyToken, async (req, res) => {
    try {
        const staffUser = await User.findById(req.params.id);
        if (!staffUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const activationToken = crypto.randomBytes(32).toString('hex');
        const temporaryPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        staffUser.activationToken = activationToken;
        staffUser.temporaryPasswordExpires = temporaryPasswordExpires;
        staffUser.isVerified = false;
        staffUser.status = 'inactive';
        await staffUser.save();

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;
        await sendActivationEmail(staffUser.email, staffUser.role, null, activationLink);

        await AuditLog.create({
            action: 'RESEND_ACTIVATION',
            user: req.user?.email || req.user?.id || 'ADMIN',
            role: req.user?.role || 'administrator',
            details: `Resent activation email to ${staffUser.role} ${staffUser.email}`
        });

        res.json({ message: 'Activation email has been resent successfully.' });

    } catch (error) {
        console.error('Error resending staff activation email:', error);
        res.status(500).json({ message: 'Server error while resending activation email.' });
    }
});

// -------------------------------------------------------
// UPDATE NOTIFICATION PREFERENCES (GAP 2)
// -------------------------------------------------------
app.put('/api/user/notification-preferences', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { emailAppointments, dailySummary, criticalAlerts } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.notificationPreferences = {
            emailAppointments: emailAppointments ?? user.notificationPreferences?.emailAppointments ?? true,
            dailySummary:      dailySummary      ?? user.notificationPreferences?.dailySummary      ?? false,
            criticalAlerts:    criticalAlerts    ?? user.notificationPreferences?.criticalAlerts    ?? true,
        };

        await user.save();

        await AuditLog.create({
            action: 'UPDATE_NOTIFICATION_PREFERENCES',
            user: user.email,
            role: user.role,
            details: `Updated notification preferences.`
        });

        res.json({ message: 'Notification preferences saved.', notificationPreferences: user.notificationPreferences });
    } catch (error) {
        console.error('Error saving notification preferences:', error);
        res.status(500).json({ message: 'Server error saving preferences.' });
    }
});

app.put('/api/user/:id', verifyToken, async (req, res) => {
    try {
        const { password, email, role, isVerified, activationToken, isPasswordChanged, status, ...updateData } = req.body;
        const userId = req.params.id;
        const currentUser = await User.findById(userId);
        if (!currentUser) return res.status(404).json({ message: "User not found" });

        // Co-admin escalation guard
        if (req.user.role === 'co-administrator') {
            // Cannot modify an administrator account
            if (currentUser.role === 'administrator') {
                await AuditLog.create({
                    action: 'UNAUTHORIZED_ESCALATION_ATTEMPT',
                    user: req.user.email,
                    role: 'co-administrator',
                    details: 'Attempted to modify administrator account.'
                });
                return res.status(403).json({ message: 'Access denied. Cannot modify the administrator account.' });
            }
        }
        // Nobody below administrator can escalate a role to administrator
        if (role === 'administrator' && req.user.role !== 'administrator') {
            await AuditLog.create({
                action: 'UNAUTHORIZED_ESCALATION_ATTEMPT',
                user: req.user.email,
                role: req.user.role,
                details: 'Attempted to escalate role to administrator.'
            });
            return res.status(403).json({ message: 'Access denied. Cannot escalate role to administrator.' });
        }

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

            await AuditLog.create({
                action: 'EMAIL_CHANGE',
                user: req.user?.email,
                role: req.user?.role,
                details: `Changed email for user ID ${userId} to ${email}`
            });

            return res.json({ message: "User updated. Re-activation email sent.", user: updatedUser });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, { ...updateData }, { new: true });

        await AuditLog.create({
            action: "UPDATE_USER",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            details: `Updated user information for: ${updatedUser.email}`
        });

        res.json(updatedUser);
    } catch (error) { res.status(500).json({ message: "Error updating user." }); }
});

app.put('/api/user/update-profile/:id', verifyToken, async (req, res) => {
    const isAdminTier = ['administrator', 'co-administrator'].includes(req.user.role);
    if (req.params.id !== req.user.id && !isAdminTier) {
        return res.status(403).json({ message: 'Access denied.' });
    }
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
        if (profileImage !== undefined) {
            if (profileImage && profileImage.length > 1.5 * 1024 * 1024) {
                return res.status(413).json({ message: 'Profile image must be under 1.5MB.' });
            }
            user.profileImage = profileImage;
        }

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

// -------------------------------------------------------
// REQUEST EMAIL CHANGE (from profile page)
// Verifies current password, then triggers re-activation
// -------------------------------------------------------
app.post('/api/user/request-email-change', verifyToken, async (req, res) => {
    try {
        const { newEmail, currentPassword } = req.body;

        if (!newEmail || !currentPassword) {
            return res.status(400).json({ message: 'New email and current password are required.' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Verify current password before allowing email change
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Current password is incorrect.' });
        }

        // Check new email is not already taken
        if (newEmail === user.email) {
            return res.status(400).json({ message: 'New email must be different from your current email.' });
        }
        const emailExists = await User.findOne({ email: newEmail });
        if (emailExists) {
            return res.status(409).json({ message: 'This email address is already in use.' });
        }

        // Generate new activation token and temp password
        const tempPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        const activationToken = crypto.randomBytes(32).toString('hex');

        user.email = newEmail;
        user.password = hashedPassword;
        user.activationToken = activationToken;
        user.isVerified = false;
        user.status = 'inactive';
        await user.save();

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;
        await sendActivationEmail(newEmail, user.role, tempPassword, activationLink);

        await AuditLog.create({
            action: 'EMAIL_CHANGE_REQUESTED',
            user: newEmail,
            role: user.role,
            details: `User requested email change. Activation link sent to ${newEmail}.`
        });

        res.json({ message: 'Verification email sent. Please check your new inbox to reactivate your account.' });

    } catch (error) {
        console.error('Error requesting email change:', error);
        res.status(500).json({ message: 'Server error processing email change request.' });
    }
});

app.post('/api/verify-current-password', verifyToken, async (req, res) => {
    try {
        const { userId, currentPassword } = req.body;

        if (userId !== req.user.id && req.user.role !== 'administrator') {
            return res.status(403).json({ message: 'Access denied.' });
        }

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
        const { password } = req.body;
        const user = await User.findById(req.user.id);
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
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const { action, role, from, to, limit = 1000 } = req.query;

        const filter = {};

        // Branch managers only see logs generated by users in their assigned branch
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }

            // Resolve all staff emails assigned to this branch
            const branchUsers = await User.find({
                assignedBranches: { $in: [req.user.assignedBranch] }
            }).select('email');

            const branchEmails = branchUsers.map(u => u.email);

            // Always include the branch manager's own email
            if (req.user.email && !branchEmails.includes(req.user.email)) {
                branchEmails.push(req.user.email);
            }

            filter.user = { $in: branchEmails };
        }

        // Partial, case-insensitive match on the action field
        if (action && action.trim()) {
            filter.action = { $regex: action.trim(), $options: 'i' };
        }

        // Exact match on role
        if (role && role.trim() && role !== 'All') {
            filter.role = role.trim().toLowerCase();
        }

        // Date range on timestamp
        if (from || to) {
            filter.timestamp = {};
            if (from) filter.timestamp.$gte = new Date(from);
            if (to) {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999);
                filter.timestamp.$lte = toDate;
            }
        }

        const logs = await AuditLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(Number(limit));

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching logs." });
    }
});

app.post('/api/logout', verifyToken, async (req, res) => {
    try {
        const { email, role, reason = 'user_initiated' } = req.body;
        await AuditLog.create({
            action: "LOGOUT",
            user: email,
            role: role,
            details: reason === 'session_timeout'
                ? `User was automatically logged out due to 30-minute inactivity.`
                : `User logged out successfully.`
        });
        res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        res.status(500).json({ message: "Server error during logout." });
    }
});

app.get('/api/inventory', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const filter = {};

        // Branch managers only see inventory belonging to their assigned branch
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            filter.branch = req.user.assignedBranch;
        }

        const items = await Inventory.find(filter).sort({ createdAt: -1 });
        res.status(200).json(items);
    } catch (error) {
        console.error("Error fetching inventory:", error);
        res.status(500).json({ message: "Server error fetching inventory" });
    }
});

app.post('/api/inventory', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const itemData = { ...req.body };

        // Branch managers can only add inventory to their own branch
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            itemData.branch = req.user.assignedBranch;
        }

        const newItem = new Inventory(itemData);
        await newItem.save();

        await AuditLog.create({
            action: 'ADD_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Added inventory item: ${newItem.itemName}${newItem.branch ? ` (branch: ${newItem.branch})` : ''}`
        });
        res.status(201).json(newItem);
    } catch (error) {
        console.error("Error adding inventory item:", error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'An item with this name already exists.' });
        }
        res.status(500).json({ message: "Server error adding item" });
    }
});

app.get('/api/inventory/:id', verifyToken, async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: "Item not found" });
        }

        // Branch managers can only view items belonging to their branch
        if (req.user.role === 'branch-manager' && item.branch !== req.user.assignedBranch) {
            return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
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
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        // Branch managers can only edit items belonging to their branch
        if (req.user.role === 'branch-manager') {
            const existing = await Inventory.findById(req.params.id);
            if (!existing) return res.status(404).json({ message: "Item not found" });
            if (existing.branch !== req.user.assignedBranch) {
                return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
            }
            // Prevent branch-manager from changing the branch field
            delete req.body.branch;
        }

        const updatedItem = await Inventory.findByIdAndUpdate(
            req.params.id,
            req.body,
            { returnDocument: 'after', runValidators: true }
        );
        if (!updatedItem) return res.status(404).json({ message: "Item not found" });

        await AuditLog.create({
            action: 'UPDATE_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Updated inventory item: ${updatedItem.itemName}${updatedItem.branch ? ` (branch: ${updatedItem.branch})` : ''}`
        });
        res.status(200).json(updatedItem);
    } catch (error) {
        console.error("Error updating inventory item:", error);
        res.status(500).json({ message: "Server error updating item" });
    }
});

app.delete('/api/inventory/:id', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        // Branch managers can only delete items belonging to their branch
        if (req.user.role === 'branch-manager') {
            const existing = await Inventory.findById(req.params.id);
            if (!existing) return res.status(404).json({ message: "Item not found" });
            if (existing.branch !== req.user.assignedBranch) {
                return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
            }
        }

        const deletedItem = await Inventory.findByIdAndDelete(req.params.id);
        if (!deletedItem) return res.status(404).json({ message: "Item not found" });

        await AuditLog.create({
            action: 'DELETE_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Deleted inventory item: ${deletedItem.itemName}${deletedItem.branch ? ` (branch: ${deletedItem.branch})` : ''}`
        });
        res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
        console.error("Error deleting inventory item:", error);
        res.status(500).json({ message: "Server error deleting item" });
    }
});

// -------------------------------------------------------
// CREATE SURGERY / APPOINTMENT
// -------------------------------------------------------
app.post('/api/surgeries', verifyToken, async (req, res) => {
    const staffRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'owner'];
    if (!staffRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const surgeryData = { ...req.body };

        // Branch managers can only create appointments for their own branch
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            // Override whatever branch was sent from the frontend
            surgeryData.branch = req.user.assignedBranch;
        }

        const newSurgery = new Surgery(surgeryData);
        await newSurgery.save();

        await AuditLog.create({
            action: "CREATE_SURGERY",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "SYSTEM",
            details: `Created new surgery record for patient ID: ${newSurgery.patient} at branch: ${newSurgery.branch}`
        });

        // ✅ REMOVED the broken Notification.create() block — it used undefined variables.
        // Notifications are correctly handled in POST /api/appointments/request instead.

        res.status(201).json(newSurgery);
    } catch (error) {
        console.error("Error creating surgery:", error);
        res.status(500).json({ message: "Server error creating surgery." });
    }
});

app.get('/api/surgeries/:id', verifyToken, async (req, res) => {
    try {
        const surgery = await Surgery.findById(req.params.id)
            .populate('patient')
            .populate('dentist', 'name email role');
        if (!surgery) return res.status(404).json({ message: "Surgery not found" });

        // Branch managers can only view surgeries from their own branch
        if (req.user.role === 'branch-manager' && surgery.branch !== req.user.assignedBranch) {
            return res.status(403).json({ message: 'Access denied. This record belongs to a different branch.' });
        }

        res.json(surgery);
    } catch (error) {
        console.error("Error fetching single surgery:", error);
        res.status(500).json({ message: "Server error fetching surgery." });
    }
});

app.put('/api/surgeries/:id', verifyToken, async (req, res) => {
    try {
        // Branch managers can only edit surgeries in their own branch
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            const existing = await Surgery.findById(req.params.id);
            if (!existing) return res.status(404).json({ message: "Surgery not found" });
            if (existing.branch !== req.user.assignedBranch) {
                return res.status(403).json({ message: 'Access denied. This record belongs to a different branch.' });
            }
            // Prevent branch-manager from changing the branch field
            delete req.body.branch;
        }

        const updatedSurgery = await Surgery.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedSurgery) return res.status(404).json({ message: "Surgery not found" });

        await AuditLog.create({
            action: "UPDATE_SURGERY",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "SYSTEM",
            details: `Updated surgery record ID: ${updatedSurgery._id} at branch: ${updatedSurgery.branch}`
        });

        res.json(updatedSurgery);
    } catch (error) {
        console.error("Error updating surgery:", error);
        res.status(500).json({ message: "Error updating surgery." });
    }
});

app.delete('/api/surgeries/:id', verifyToken, async (req, res) => {
    const staffRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'owner'];
    if (!staffRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        // Branch managers can only delete surgeries in their own branch
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            const existing = await Surgery.findById(req.params.id);
            if (!existing) return res.status(404).json({ message: "Surgery not found" });
            if (existing.branch !== req.user.assignedBranch) {
                return res.status(403).json({ message: 'Access denied. This record belongs to a different branch.' });
            }
        }

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
// ============================================================


// -------------------------------------------------------
// SURGERIES: FILTER BY QUERY PARAMS
// -------------------------------------------------------

app.get('/api/surgeries', verifyToken, async (req, res) => {
    try {
        const { patientId, status, date } = req.query;
        const query = {};

        if (req.user.role === 'dentist') {
            // Dentists are always scoped to their own appointments only
            query.dentist = req.user.id;
        } else if (req.user.role === 'branch-manager') {
            // Branch managers are scoped to their assigned branch
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            query.branch = req.user.assignedBranch;
            if (req.query.dentistId) query.dentist = req.query.dentistId;
        } else {
            // Admin/co-admin roles can filter by dentistId via query param
            if (req.query.dentistId) query.dentist = req.query.dentistId;
        }

        if (patientId) query.patient = patientId;
        if (status) query.status = status;

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
// -------------------------------------------------------

app.put('/api/surgeries/:id/status', verifyToken, async (req, res) => {
    try {
        const { status, remarks, preOpInstructions, date, time } = req.body;

        const allowedStatuses = ['pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const TERMINAL_STATUSES = ['completed', 'cancelled'];
        const currentSurgery = await Surgery.findById(req.params.id);
        if (!currentSurgery) return res.status(404).json({ message: 'Surgery not found.' });

        if (TERMINAL_STATUSES.includes(currentSurgery.status) && req.user.role !== 'administrator') {
            return res.status(400).json({ message: 'Cannot change status of a completed or cancelled appointment.' });
        }

        const updateFields = { status };
        if (remarks !== undefined) updateFields.remarks = remarks;
        if (preOpInstructions !== undefined) updateFields.preOpInstructions = preOpInstructions;
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
// -------------------------------------------------------

app.post('/api/appointments/request', verifyToken, async (req, res) => {
    try {
        const { date, time, procedure, notes, branch } = req.body;

        if (!date || !procedure) {
            return res.status(400).json({ message: 'Date and procedure are required.' });
        }

        if (!branch) {
            return res.status(400).json({ message: 'Branch is required. Please select a clinic branch.' });
        }

        const patientUser = await User.findById(req.user.id).select('name email role');
        if (!patientUser || patientUser.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can submit appointment requests.' });
        }

        const newSurgery = new Surgery({
            patient: req.user.id,
            dentist: req.body.dentistId || null,
            branch: branch,
            date: new Date(date),
            time: time || '',
            procedure,
            notes: notes || '',
            status: 'pending',
            source: 'Smile Hub (Online)',
            requestedBy: req.user.id
        });

        await newSurgery.save();

        await AuditLog.create({
            action: 'APPOINTMENT_REQUEST',
            user: patientUser.email,
            role: 'patient',
            details: `Patient ${patientUser.name.first} ${patientUser.name.last} requested an appointment for: ${procedure} on ${new Date(date).toDateString()}`
        });

        await Notification.insertMany([
            {
                type: 'NEW_APPOINTMENT',
                title: 'New Appointment Request',
                message: `${patientUser.name.first} ${patientUser.name.last} requested an appointment for: ${procedure} on ${new Date(date).toDateString()}.`,
                recipientRole: 'administrator',
                relatedId: newSurgery._id
            },
            {
                type: 'NEW_APPOINTMENT',
                title: 'New Appointment Request',
                message: `${patientUser.name.first} ${patientUser.name.last} requested an appointment for: ${procedure} on ${new Date(date).toDateString()}.`,
                recipientRole: 'owner',
                relatedId: newSurgery._id
            }
        ]);

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
// APPOINTMENT SLOTS — patient: get taken slots for a date
// -------------------------------------------------------

app.get('/api/appointments/slots', verifyToken, async (req, res) => {
    try {
        const { date, branch } = req.query;

        if (!date) {
            return res.status(400).json({ message: 'date query parameter is required.' });
        }

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        // Find all active (non-terminal) appointments on this date
        const query = {
            date:   { $gte: start, $lte: end },
            status: { $in: ['pending', 'confirmed', 'in-clinic'] },
        };
        if (branch) query.branch = branch;

        const surgeries = await Surgery.find(query).select('time status');
        const takenSlots = surgeries.map(s => s.time).filter(Boolean);

        // Pull clinic's allowed time slots from SystemConfig
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({});
        const allowedSlots = config.allowedTimeSlots ||
            ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

        res.json({ allowedSlots, takenSlots });
    } catch (error) {
        console.error('Error fetching appointment slots:', error);
        res.status(500).json({ message: 'Server error fetching appointment slots.' });
    }
});

// -------------------------------------------------------
// APPOINTMENT BLOCKED DATES — fully booked days for calendar
// -------------------------------------------------------
app.get('/api/appointments/blocked-dates', verifyToken, async (req, res) => {
    try {
        const { branch, month } = req.query;
        // month = 'YYYY-MM' e.g. '2026-05'

        // Build date range: first to last day of requested month (or ±60 days if no month)
        let start, end;
        if (month && /^\d{4}-\d{2}$/.test(month)) {
            const [y, m] = month.split('-').map(Number);
            start = new Date(y, m - 1, 1, 0, 0, 0, 0);
            end   = new Date(y, m,     0, 23, 59, 59, 999); // last day of month
        } else {
            start = new Date();
            start.setHours(0, 0, 0, 0);
            end = new Date();
            end.setDate(end.getDate() + 60);
            end.setHours(23, 59, 59, 999);
        }

        // Get allowed time slots from SystemConfig
        let config = await SystemConfig.findOne();
        if (!config) config = await SystemConfig.create({});
        const allowedSlots = config.allowedTimeSlots ||
            ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
        const totalSlots = allowedSlots.length;

        // Build query for active appointments in range
        const query = {
            date:   { $gte: start, $lte: end },
            status: { $in: ['pending', 'confirmed', 'in-clinic'] },
        };
        if (branch) query.branch = branch;

        const appointments = await Surgery.find(query).select('date time');

        // Group taken slots by date string (YYYY-MM-DD)
        const slotsByDate = {};
        for (const appt of appointments) {
            const dateKey = appt.date.toISOString().split('T')[0];
            if (!slotsByDate[dateKey]) slotsByDate[dateKey] = new Set();
            if (appt.time) slotsByDate[dateKey].add(appt.time);
        }

        // A date is fully blocked when ALL allowed slots are taken
        const blockedDates = Object.entries(slotsByDate)
            .filter(([, slots]) => slots.size >= totalSlots)
            .map(([date]) => date);

        res.json({ blockedDates });
    } catch (error) {
        console.error('Error fetching blocked dates:', error);
        res.status(500).json({ message: 'Server error fetching blocked dates.' });
    }
});


// -------------------------------------------------------
// TREATMENT LOGS: GET all logs for a patient
// -------------------------------------------------------

app.get('/api/patients/:id/treatment-logs', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'dentist', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const patient = await User.findById(req.params.id).select('treatmentLogs name');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

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
    // Phase 5: Secretary has read-only access to EMR — block write
    if (req.user.role === 'secretary') {
        return res.status(403).json({ message: 'Access denied. Secretaries have read-only access to treatment logs.' });
    }
    try {
        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const { date, procedure, tooth, category, notes, branch } = req.body;

        if (!date || !procedure) {
            return res.status(400).json({ message: 'Date and procedure are required.' });
        }

        if (!branch) {
            return res.status(400).json({ message: 'Branch is required.' });
        }

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
            branch: branch
        };

        patient.treatmentLogs.push(newLog);
        await patient.save();

        await AuditLog.create({
            action: 'ADD_TREATMENT_LOG',
            user: req.user?.email,
            role: req.user?.role,
            details: `Added treatment log for patient ID ${req.params.id}: ${procedure}`
        });

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
// -------------------------------------------------------

app.put('/api/patients/:id/odontogram', verifyToken, async (req, res) => {
    // Phase 5: Secretary has read-only access to EMR — block write
    if (req.user.role === 'secretary') {
        return res.status(403).json({ message: 'Access denied. Secretaries have read-only access to odontogram.' });
    }
    try {
        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

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
// RADIOGRAPHS: GET all radiograph entries for a patient
// -------------------------------------------------------

app.get('/api/patients/:id/radiographs', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'co-administrator', 'branch-manager', 'secretary', 'dentist', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const patient = await User.findById(req.params.id).select('radiographs name');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const sorted = (patient.radiographs || []).sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        res.json(sorted);
    } catch (error) {
        console.error('Error fetching radiographs:', error);
        res.status(500).json({ message: 'Server error fetching radiographs.' });
    }
});


// -------------------------------------------------------
// RADIOGRAPHS: ADD a new radiograph entry
// Body: { label, date, url, notes }
// -------------------------------------------------------

app.post('/api/patients/:id/radiographs', verifyToken, async (req, res) => {
    // Phase 5: Secretary has read-only access to EMR — block upload
    if (req.user.role === 'secretary') {
        return res.status(403).json({ message: 'Access denied. Secretaries cannot upload radiographs.' });
    }
    try {
        const { label, date, url, notes } = req.body;

        if (!label || !date) {
            return res.status(400).json({ message: 'Label and date are required.' });
        }

        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        if (!patient.radiographs) patient.radiographs = [];

        const newEntry = {
            label,
            date: new Date(date),
            url: url || null,
            notes: notes || '',
            uploadedBy: req.user?.id || null,
        };

        patient.radiographs.push(newEntry);
        await patient.save();

        await AuditLog.create({
            action: 'ADD_RADIOGRAPH',
            user: req.user?.email,
            role: req.user?.role,
            details: `Added radiograph "${label}" for patient ID ${req.params.id}`
        });

        const added = patient.radiographs[patient.radiographs.length - 1];
        res.status(201).json(added);

    } catch (error) {
        console.error('Error adding radiograph:', error);
        res.status(500).json({ message: 'Server error adding radiograph.' });
    }
});


// -------------------------------------------------------
// RADIOGRAPHS: DELETE a radiograph entry
// -------------------------------------------------------

app.delete('/api/patients/:id/radiographs/:entryId', verifyToken, async (req, res) => {
    // Phase 5: Secretary has read-only access to EMR — block delete
    if (req.user.role === 'secretary') {
        return res.status(403).json({ message: 'Access denied. Secretaries cannot delete radiographs.' });
    }
    try {
        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const index = (patient.radiographs || []).findIndex(
            r => r._id.toString() === req.params.entryId
        );
        if (index === -1) return res.status(404).json({ message: 'Radiograph entry not found.' });

        patient.radiographs.splice(index, 1);
        await patient.save();

        await AuditLog.create({
            action: 'DELETE_RADIOGRAPH',
            user: req.user?.email,
            role: req.user?.role,
            details: `Deleted radiograph entry ID ${req.params.entryId} for patient ID ${req.params.id}`
        });

        res.json({ message: 'Radiograph entry deleted successfully.' });
    } catch (error) {
        console.error('Error deleting radiograph:', error);
        res.status(500).json({ message: 'Server error deleting radiograph.' });
    }
});

// -------------------------------------------------------
// PATIENT SELF-SERVICE EMR ROUTES
// Patients can only read their own records.
// Separate from the staff routes above which block role: 'patient'.
// -------------------------------------------------------

app.get('/api/my/treatment-logs', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const patient = await User.findById(req.user.id).select('treatmentLogs');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const sorted = (patient.treatmentLogs || []).sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );
        res.json(sorted);
    } catch (error) {
        console.error('Error fetching own treatment logs:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.get('/api/my/odontogram', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const patient = await User.findById(req.user.id).select('odontogram');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const odontogramObj = patient.odontogram
            ? Object.fromEntries(patient.odontogram)
            : {};
        res.json(odontogramObj);
    } catch (error) {
        console.error('Error fetching own odontogram:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.get('/api/my/radiographs', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const patient = await User.findById(req.user.id).select('radiographs');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const sorted = (patient.radiographs || []).sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );
        res.json(sorted);
    } catch (error) {
        console.error('Error fetching own radiographs:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});


// -------------------------------------------------------
// INVENTORY DEDUCTION: Reduce stock after treatment
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
// ARCHIVE USER
// -------------------------------------------------------

app.put('/api/user/archive/:id', verifyToken, async (req, res) => {
    try {
        const { isArchived } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const archivableRoles = ['dentist', 'secretary', 'co-administrator'];
        if (!archivableRoles.includes(user.role)) {
            return res.status(403).json({ message: 'Only dentists, secretaries, and co-administrators can be archived.' });
        }

        user.isArchived = Boolean(isArchived);
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
// DASHBOARD STATS
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
            lowStockItems,
            newRegistrations
        ] = await Promise.all([
            User.countDocuments({ role: 'patient', status: 'active' }),
            User.countDocuments({ role: 'dentist', status: 'active', isArchived: { $ne: true } }),
            Surgery.countDocuments({ date: { $gte: todayStart, $lte: todayEnd } }),
            Surgery.countDocuments({ status: 'pending' }),
            Inventory.countDocuments({ $expr: { $lte: ['$quantity', '$reorderLevel'] } }),
            User.countDocuments({ role: 'patient', createdAt: { $gte: todayStart, $lte: todayEnd } })
        ]);

        res.json({
            totalPatients,
            activeDentists,
            todayAppointments,
            pendingAppointments,
            lowStockItems,
            newRegistrations
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Server error fetching stats.' });
    }
});

// -------------------------------------------------------
// NOTIFICATION ROUTES
// -------------------------------------------------------

// Get notifications for the logged-in user's role
app.get('/api/notifications', verifyToken, async (req, res) => {
    try {
        // Find notifications meant specifically for this user's ID, OR their role
        const notifications = await Notification.find({
            $or: [
                { recipientRole: req.user.role },
                { recipientId: req.user.id }
            ]
        }).sort({ createdAt: -1 }).limit(50); // Get latest 50

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: "Server error." });
    }
});

// Mark all notifications as read for the user
app.patch('/api/notifications/read-all', verifyToken, async (req, res) => {
    try {
        await Notification.updateMany(
            { 
                $or: [{ recipientRole: req.user.role }, { recipientId: req.user.id }],
                isRead: false
            },
            { $set: { isRead: true } }
        );
        res.json({ message: "All notifications marked as read." });
    } catch (error) {
        console.error('Error marking all notifications read:', error);
        res.status(500).json({ message: "Server error." });
    }
});

// Mark a single notification as read
app.patch('/api/notifications/:id/read', verifyToken, async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id, 
            { isRead: true }, 
            { new: true }
        );
        res.json(notification);
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({ message: "Server error." });
    }
});

app.get('/api/branches', verifyToken, async (req, res) => {
    try {
        const filter = req.query.all === 'true' ? {} : { isActive: true };
        const branches = await Branch.find(filter).sort({ name: 1 });
        res.json(branches);
    } catch (error) {
        console.error('Error fetching branches:', error);
        res.status(500).json({ message: 'Server error fetching branches.' });
    }
});
 
app.post('/api/branches', verifyToken, async (req, res) => {
    try {
        if (!['administrator', 'owner'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const { name, address, contactNumber } = req.body;
        if (!name) return res.status(400).json({ message: 'Branch name is required.' });
 
        const existing = await Branch.findOne({ name: name.trim() });
        if (existing) return res.status(409).json({ message: 'A branch with this name already exists.' });
 
        const newBranch = new Branch({ name: name.trim(), address, contactNumber });
        await newBranch.save();
 
        await AuditLog.create({
            action: 'BRANCH_ADDED',
            user: req.user?.email,
            role: req.user?.role,
            details: `New branch created: ${name}`
        });
 
        res.status(201).json(newBranch);
    } catch (error) {
        console.error('Error creating branch:', error);
        res.status(500).json({ message: 'Server error creating branch.' });
    }
});
 
app.put('/api/branches/:id', verifyToken, async (req, res) => {
    try {
        if (!['administrator', 'owner'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const { name, address, contactNumber, isActive } = req.body;
        if (!name) return res.status(400).json({ message: 'Branch name is required.' });
        const updatedBranch = await Branch.findByIdAndUpdate(
            req.params.id,
            { name, address, contactNumber, isActive },
            { new: true }
        );
        if (!updatedBranch) return res.status(404).json({ message: 'Branch not found.' });
 
        await AuditLog.create({
            action: 'BRANCH_UPDATED',
            user: req.user?.email,
            role: req.user?.role,
            details: `Branch updated: ${updatedBranch.name}`
        });
 
        res.json(updatedBranch);
    } catch (error) {
        console.error('Error updating branch:', error);
        res.status(500).json({ message: 'Server error updating branch.' });
    }
});
 
 
// -------------------------------------------------------
// SYSTEM CONFIG ROUTES
// -------------------------------------------------------
 
app.get('/api/system-config', verifyToken, async (req, res) => {
    try {
        // Get the single config doc (or create a default one on first access)
        let config = await SystemConfig.findOne();
        if (!config) {
            config = await SystemConfig.create({});
        }
        res.json(config);
    } catch (error) {
        console.error('Error fetching system config:', error);
        res.status(500).json({ message: 'Server error fetching system config.' });
    }
});
 
app.put('/api/system-config', verifyToken, async (req, res) => {
    try {
        if (!['administrator', 'owner'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied. Admin only.' });
        }
 
        let config = await SystemConfig.findOne();
        if (!config) {
            config = new SystemConfig(req.body);
        } else {
            Object.assign(config, req.body, { updatedBy: req.user?.email });
        }
        await config.save();
 
        await AuditLog.create({
            action: 'CONFIG_CHANGED',
            user: req.user?.email,
            role: req.user?.role,
            details: 'System configuration updated.'
        });
 
        res.json(config);
    } catch (error) {
        console.error('Error updating system config:', error);
        res.status(500).json({ message: 'Server error updating system config.' });
    }
});

// -------------------------------------------------------
// DELETE USER (Admin only — for branch-managers, co-administrators)
// -------------------------------------------------------
app.delete('/api/users/:id', verifyToken, async (req, res) => {
    try {
        const ALLOWED_ROLES = ['administrator', 'co-administrator'];
        if (!ALLOWED_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Co-admin cannot delete administrator accounts — log the attempt
        if (user.role === 'administrator') {
            if (req.user.role === 'co-administrator') {
                await AuditLog.create({
                    action: 'UNAUTHORIZED_ESCALATION_ATTEMPT',
                    user: req.user.email,
                    role: 'co-administrator',
                    details: 'Attempted to delete administrator account.'
                });
            }
            return res.status(403).json({ message: 'Cannot delete an administrator account.' });
        }

        await User.findByIdAndDelete(req.params.id);

        await AuditLog.create({
            action: 'DELETE_USER',
            user: req.user?.email,
            role: req.user?.role,
            details: `Deleted user: ${user.email} (role: ${user.role})`
        });

        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error deleting user.' });
    }
});

// -------------------------------------------------------
// MATERIAL USAGE LOG — POST (create)
// -------------------------------------------------------
const MATERIAL_USAGE_ALLOWED = [
    'dentist', 'administrator', 'co-administrator', 'branch-manager', 'owner'
];
app.post('/api/material-usage', verifyToken, async (req, res) => {
    try {
        if (!MATERIAL_USAGE_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        // Owners without isDentist flag cannot create usage logs
        if (req.user.role === 'owner' && !req.user.isDentist) {
            return res.status(403).json({ message: 'Access denied. Dentist access required.' });
        }

        const { patientId, procedureType, materials, notes, branch, usedAt } = req.body;
        if (!procedureType || !materials || !Array.isArray(materials) || materials.length === 0) {
            return res.status(400).json({ message: 'Procedure type and at least one material are required.' });
        }

        const dentist = await User.findById(req.user.id);
        const dentistName = dentist
            ? `${dentist.name?.first || ''} ${dentist.name?.last || ''}`.trim()
            : '';

        let patientName = '';
        if (patientId) {
            const patient = await User.findById(patientId);
            patientName = patient
                ? `${patient.name?.first || ''} ${patient.name?.last || ''}`.trim()
                : '';
        }

        const log = await MaterialUsageLog.create({
            dentistId: req.user.id,
            dentistName,
            patientId: patientId || null,
            patientName,
            procedureType,
            materials,
            notes: notes || '',
            branch: branch || '',
            usedAt: usedAt ? new Date(usedAt) : new Date(),
        });

        await AuditLog.create({
            action: 'MATERIAL_USAGE_CREATED',
            user: req.user.email,
            role: req.user.role,
            details: `Material usage log created for procedure: ${procedureType}`,
        });

        res.status(201).json(log);
    } catch (error) {
        console.error('Error creating material usage log:', error);
        res.status(500).json({ message: 'Server error creating material usage log.' });
    }
});

// -------------------------------------------------------
// MATERIAL USAGE LOG — GET (list)
// -------------------------------------------------------
app.get('/api/material-usage', verifyToken, async (req, res) => {
    try {
        if (!MATERIAL_USAGE_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        let filter = {};

        // Dentists and owner-dentists only see their own logs
        if (req.user.role === 'dentist' ||
            (req.user.role === 'owner' && req.user.isDentist)) {
            filter.dentistId = req.user.id;
        }
        // Branch managers see only their branch
        if (req.user.role === 'branch-manager') {
            filter.branch = req.user.assignedBranch;
        }

        const logs = await MaterialUsageLog.find(filter)
            .sort({ usedAt: -1 })
            .limit(500);

        res.json(logs);
    } catch (error) {
        console.error('Error fetching material usage logs:', error);
        res.status(500).json({ message: 'Server error fetching logs.' });
    }
});

// -------------------------------------------------------
// MATERIAL USAGE LOG — DELETE
// -------------------------------------------------------
app.delete('/api/material-usage/:id', verifyToken, async (req, res) => {
    try {
        if (!MATERIAL_USAGE_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const log = await MaterialUsageLog.findById(req.params.id);
        if (!log) return res.status(404).json({ message: 'Log not found.' });

        // Dentists can only delete their own entries
        if (req.user.role === 'dentist' && log.dentistId.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. You can only delete your own entries.' });
        }

        await MaterialUsageLog.findByIdAndDelete(req.params.id);

        await AuditLog.create({
            action: 'MATERIAL_USAGE_DELETED',
            user: req.user.email,
            role: req.user.role,
            details: `Material usage log deleted: ${log.procedureType} on ${log.usedAt.toDateString()}`,
        });

        res.json({ message: 'Material usage log deleted.' });
    } catch (error) {
        console.error('Error deleting material usage log:', error);
        res.status(500).json({ message: 'Server error deleting log.' });
    }
});

// -------------------------------------------------------
// AI RADIOGRAPH ENHANCER
// -------------------------------------------------------
const ENHANCE_ALLOWED = [
    'dentist', 'administrator', 'co-administrator', 'branch-manager', 'owner'
];
app.post('/api/radiographs/enhance', verifyToken, async (req, res) => {
    try {
        if (!ENHANCE_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        if (req.user.role === 'owner' && !req.user.isDentist) {
            return res.status(403).json({ message: 'Access denied. Dentist access required.' });
        }

        const { imageBase64, mediaType = 'image/jpeg', patientId } = req.body;
        if (!imageBase64) {
            return res.status(400).json({ message: 'imageBase64 is required.' });
        }

        const response = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 1024,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: imageBase64,
                            },
                        },
                        {
                            type: 'text',
                            text: 'You are a dental radiology AI assistant. Analyze this dental radiograph and provide: 1) A detailed clinical description of what is visible, 2) Any notable findings (cavities, bone loss, root issues, calculus, etc.), 3) Recommendations for the dentist. Be concise and clinically precise. Format your response with clear sections.',
                        },
                    ],
                },
            ],
        });

        const analysis = response.content[0]?.text || 'No analysis available.';

        await AuditLog.create({
            action: 'RADIOGRAPH_ENHANCED',
            user: req.user.email,
            role: req.user.role,
            details: `AI radiograph analysis performed${patientId ? ` for patient ID: ${patientId}` : ''}.`,
        });

        res.json({ analysis, enhanced: true });
    } catch (error) {
        console.error('Radiograph enhance error:', error);
        res.status(500).json({ message: 'Server error during radiograph analysis.' });
    }
});

// -------------------------------------------------------
// AI PATIENT CARE COMPANION — Chat proxy
// -------------------------------------------------------
const aiChatLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: { message: 'Too many AI requests. Please wait before trying again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.post('/api/ai/chat', verifyToken, aiChatLimiter, async (req, res) => {
    try {
        const { messages, systemPrompt } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ message: 'Messages array is required.' });
        }

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: systemPrompt || 'You are NgitiFy\'s AI dental care companion. You help patients understand dental health, answer questions about dental procedures, and provide general oral health guidance. Always recommend consulting a dentist for specific medical advice. Be friendly, clear, and supportive.',
            messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        const reply = response.content[0]?.text || 'I could not generate a response. Please try again.';
        res.json({ reply });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ message: 'Server error processing AI request.' });
    }
});

// -------------------------------------------------------
// AI STAFF CHAT ASSISTANT — Streaming SSE (Phase 4)
// -------------------------------------------------------
const STAFF_CHAT_ALLOWED = ['dentist', 'administrator', 'co-administrator', 'branch-manager', 'secretary', 'owner'];

app.post('/api/ai/staff-chat', verifyToken, aiChatLimiter, async (req, res) => {
    try {
        if (!STAFF_CHAT_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { messages } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ message: 'Messages array is required.' });
        }

        const systemPrompt = `You are NgitiFy's AI Staff Assistant for Dentime Dental Clinic. You are a knowledgeable, professional, and helpful assistant designed exclusively for clinical and administrative staff.

Your capabilities:
- Answer questions about dental procedures, materials, and clinical protocols
- Guide staff on how to use NgitiFy modules (Dashboard, Patient EMR, Odontogram, Material Usage Log, Notifications, Activity Logs, Account Settings)
- Provide post-operative care instructions and patient preparation guidelines
- Answer questions about dental materials, their uses, and standard quantities
- Help with administrative questions about clinic operations

NgitiFy module guide:
- Dashboard: View today's schedule, KPI stats (Patients Today, Pending, Completed), and interactive calendar
- Patient EMR: Access patient medical history, treatment logs, odontogram, and radiographs via /dentist/emr
- Odontogram: Digital tooth chart — click a tooth to mark conditions (healthy, filled, decayed, crown, missing)
- Material Usage Log: Record dental supplies used during procedures; stock is automatically deducted from inventory
- Notifications: View appointment alerts, patient updates, and low-stock warnings
- Activity Logs: Read-only audit trail of all your actions in the system
- Account Settings: Update your profile photo and password

Strict rules:
- Only respond to work-related, clinic-related, or NgitiFy system-related questions
- Politely decline personal, financial, or off-topic queries and redirect the user to the appropriate resource
- Never provide medical diagnoses — always recommend professional clinical judgment for patient-specific decisions
- Keep responses concise, well-structured, and clinically appropriate
- When unsure about a specific clinical detail, say so and suggest consulting a senior clinician`;

        // Set SSE headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
        });

        stream.on('text', (text) => {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        });

        stream.on('error', (err) => {
            console.error('Staff chat stream error:', err);
            res.write(`data: ${JSON.stringify({ error: 'Stream error occurred.' })}\n\n`);
            res.end();
        });

        await stream.finalMessage();

        res.write('data: [DONE]\n\n');
        res.end();

        // Non-blocking audit log
        AuditLog.create({
            action: 'AI_STAFF_CHAT',
            user: req.user.email,
            role: req.user.role,
            details: `AI staff chat session — ${messages.length} message(s).`,
        }).catch(() => {});

    } catch (error) {
        console.error('Staff chat error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error processing AI request.' });
        } else {
            res.write(`data: ${JSON.stringify({ error: 'Server error.' })}\n\n`);
            res.end();
        }
    }
});

// -------------------------------------------------------
// AI DENTAL HEALTH EDUCATION
// -------------------------------------------------------
app.post('/api/ai/education', verifyToken, async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ message: 'Topic is required.' });

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: 'You are a dental health educator. Write clear, patient-friendly educational content about dental topics. Use simple language, avoid jargon, and include practical tips. Format with a short intro, key points, and a helpful tip at the end.',
            messages: [
                {
                    role: 'user',
                    content: `Write an educational article about: ${topic}`,
                },
            ],
        });

        const content = response.content[0]?.text || 'Content unavailable.';
        res.json({ content, topic });
    } catch (error) {
        console.error('AI education error:', error);
        res.status(500).json({ message: 'Server error generating educational content.' });
    }
});

// -------------------------------------------------------
// ACTIVITY LOGS — Patient self-view
// -------------------------------------------------------
app.get('/api/activity-logs/patient', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const logs = await AuditLog.find({ user: req.user.email })
            .sort({ timestamp: -1 })
            .limit(200);

        res.json(logs);
    } catch (error) {
        console.error('Error fetching patient activity logs:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'MONGO_URI', 'RESEND_API_KEY', 'FRONTEND_URL'];
REQUIRED_ENV_VARS.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ Missing required environment variable: ${key}`);
        process.exit(1);
    }
});

app.post('/api/queue', verifyToken, async (req, res) => {
    try {
        const allowed = ['administrator', 'co-administrator', 'branch-manager', 'secretary'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
 
        const { patientName, branch, assignedDentist, procedureType, contactNumber, patientId } = req.body;
        if (!patientName || !branch) {
            return res.status(400).json({ message: 'Patient name and branch are required.' });
        }
 
        // Auto-increment ticket number: max today's ticket + 1 per branch
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
 
        const last = await Queue.findOne({
            branch,
            createdAt: { $gte: startOfDay }
        }).sort({ ticketNumber: -1 });
 
        const ticketNumber = last ? last.ticketNumber + 1 : 1;
 
        const entry = await Queue.create({
            patientName: patientName.trim(),
            branch: branch.trim(),
            ticketNumber,
            assignedDentist: assignedDentist || '',
            procedureType: procedureType || '',
            contactNumber: contactNumber || '',
            patientId: patientId || null
        });
 
        await AuditLog.create({
            action: 'QUEUE_CREATE',
            user: req.user?.email,
            role: req.user?.role,
            details: `Walk-in ticket #${ticketNumber} created for ${patientName} at ${branch}.`
        });
 
        res.status(201).json(entry);
    } catch (error) {
        console.error('Error creating queue entry:', error);
        res.status(500).json({ message: 'Server error creating queue entry.' });
    }
});
 
// GET /api/queue — get all active queue entries, optionally filtered by branch
app.get('/api/queue', verifyToken, async (req, res) => {
    try {
        const allowed = ['administrator', 'co-administrator', 'branch-manager', 'secretary'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
 
        const filter = {};
 
        // Branch managers are locked to their own branch only
        if (req.user.role === 'branch-manager') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Branch manager has no assigned branch.' });
            }
            // Reject if they try to query a different branch
            if (req.query.branch && req.query.branch !== req.user.assignedBranch) {
                return res.status(403).json({ message: 'Access denied. You can only view your assigned branch queue.' });
            }
            filter.branch = req.user.assignedBranch;
        } else if (req.query.branch) {
            filter.branch = req.query.branch;
        }
 
        // Only return today's queue entries
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        filter.createdAt = { $gte: startOfDay };
 
        const entries = await Queue.find(filter).sort({ ticketNumber: 1 });
        res.json(entries);
    } catch (error) {
        console.error('Error fetching queue:', error);
        res.status(500).json({ message: 'Server error fetching queue.' });
    }
});
 
// PATCH /api/queue/:id/status — update queue entry status (call, done, skip)
app.patch('/api/queue/:id/status', verifyToken, async (req, res) => {
    try {
        const allowed = ['administrator', 'co-administrator', 'branch-manager', 'secretary'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
 
        const { status } = req.body;
        if (!['waiting', 'serving', 'done', 'skipped'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }
 
        const update = { status };
        if (status === 'serving') update.calledAt = new Date();
        if (status === 'done' || status === 'skipped') update.completedAt = new Date();
 
        const entry = await Queue.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!entry) return res.status(404).json({ message: 'Queue entry not found.' });
 
        await AuditLog.create({
            action: 'QUEUE_UPDATE',
            user: req.user?.email,
            role: req.user?.role,
            details: `Queue ticket #${entry.ticketNumber} status changed to ${status}.`
        });
 
        res.json(entry);
    } catch (error) {
        console.error('Error updating queue status:', error);
        res.status(500).json({ message: 'Server error updating queue.' });
    }
});
 
// DELETE /api/queue/:id — remove a queue entry
app.delete('/api/queue/:id', verifyToken, async (req, res) => {
    try {
        const allowed = ['administrator', 'co-administrator', 'branch-manager', 'secretary'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
 
        const entry = await Queue.findByIdAndDelete(req.params.id);
        if (!entry) return res.status(404).json({ message: 'Queue entry not found.' });
 
        res.json({ message: 'Queue entry removed successfully.' });
    } catch (error) {
        console.error('Error deleting queue entry:', error);
        res.status(500).json({ message: 'Server error deleting queue entry.' });
    }
});

// -------------------------------------------------------
// ROLE PERMISSIONS — GET all role configs
// -------------------------------------------------------
app.get('/api/role-permissions', verifyToken, async (req, res) => {
    if (!['administrator', 'co-administrator', 'owner'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const CONFIGURABLE_ROLES = ['co-administrator', 'branch-manager', 'dentist', 'secretary'];

        // Ensure a doc exists for every configurable role
        await Promise.all(
            CONFIGURABLE_ROLES.map(role =>
                RolePermission.findOneAndUpdate(
                    { role },
                    { $setOnInsert: { role } },
                    { upsert: true, new: true }
                )
            )
        );

        const configs = await RolePermission.find({ role: { $in: CONFIGURABLE_ROLES } });
        res.json(configs);
    } catch (error) {
        console.error('Error fetching role permissions:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// -------------------------------------------------------
// ROLE PERMISSIONS — UPDATE permissions for a role
// -------------------------------------------------------
// AFTER (co-admin can edit non-admin role permissions)
app.put('/api/role-permissions/:role', verifyToken, async (req, res) => {
    const isAdmin = req.user.role === 'administrator';
    const isCoAdmin = req.user.role === 'co-administrator';
    const isOwner = req.user.role === 'owner';

    if (!isAdmin && !isCoAdmin && !isOwner) {
        return res.status(403).json({ message: 'Access denied.' });
    }   

    // Co-admin cannot modify administrator-level permission entries
    if (isCoAdmin && req.params.role === 'administrator') {
        await AuditLog.create({
            action: 'UNAUTHORIZED_ESCALATION_ATTEMPT',
            user: req.user.email,
            role: 'co-administrator',
            details: 'Attempted to modify administrator role permissions.'
        });
        return res.status(403).json({ message: 'Access denied. Cannot modify administrator permissions.' });
    }
    try {
        const { role } = req.params;
        const { permissions } = req.body;

        const CONFIGURABLE_ROLES = ['co-administrator', 'branch-manager', 'dentist', 'secretary'];
        if (!CONFIGURABLE_ROLES.includes(role)) {
            return res.status(400).json({ message: 'Cannot configure permissions for this role.' });
        }

        const updated = await RolePermission.findOneAndUpdate(
            { role },
            { permissions, updatedBy: req.user.email },
            { new: true, upsert: true }
        );

        await AuditLog.create({
            action: 'ROLE_CHANGED',
            user: req.user.email,
            role: req.user.role,
            details: `Permissions updated for role: ${role}`
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating role permissions:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// -------------------------------------------------------
// GRANT ADMIN ACCESS — Override a specific user's permissions
// -------------------------------------------------------
app.post('/api/users/:id/grant-admin', verifyToken, async (req, res) => {
    if (req.user.role !== 'administrator') {
        if (req.user.role === 'co-administrator') {
            await AuditLog.create({
                action: 'UNAUTHORIZED_ESCALATION_ATTEMPT',
                user: req.user.email,
                role: 'co-administrator',
                details: 'Attempted to use Grant Admin Access feature.'
            });
        }
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    try {
        const { isAdminAccess } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.isAdminAccess = Boolean(isAdminAccess);
        await user.save();

        await AuditLog.create({
            action: 'ROLE_CHANGED',
            user: req.user.email,
            role: req.user.role,
            details: `Admin access ${isAdminAccess ? 'granted to' : 'revoked from'} user: ${user.email}`
        });

        res.json({ message: `Admin access ${isAdminAccess ? 'granted' : 'revoked'} successfully.`, user });
    } catch (error) {
        console.error('Error granting admin access:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// -------------------------------------------------------
// ANALYTICS — Per-branch aggregation
// -------------------------------------------------------
app.get('/api/analytics/branches', verifyToken, async (req, res) => {
    // ✅ PHASE 3: Owner has full cross-branch analytics access
    const analyticsAllowed = ['administrator', 'co-administrator', 'branch-manager', 'owner'];
    if (!analyticsAllowed.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const { from, to } = req.query;

        // Branch managers can only see their own branch analytics
        const branchFilter = req.user.role === 'branch-manager'
            ? { branch: req.user.assignedBranch }
            : {};

        const dateFilter = {};
        if (from) dateFilter.$gte = new Date(from);
        if (to)   dateFilter.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));

        const matchStage = {
            ...( Object.keys(dateFilter).length ? { date: dateFilter } : {} ),
            ...branchFilter
        };

        // Per-branch appointment counts
        const branchCounts = await Surgery.aggregate([
            { $match: matchStage },
            { $group: { _id: '$branch', total: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        // Month-over-month per branch (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const monthly = await Surgery.aggregate([
            { $match: { date: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        branch: '$branch',
                        year:  { $year:  '$date' },
                        month: { $month: '$date' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Procedure distribution
        const procedures = await Surgery.aggregate([
            { $match: matchStage },
            { $group: { _id: '$procedure', value: { $sum: 1 } } },
            { $sort: { value: -1 } },
            { $limit: 6 }
        ]);

        // Status breakdown per branch
        const statusBreakdown = await Surgery.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: { branch: '$branch', status: '$status' },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({ branchCounts, monthly, procedures, statusBreakdown });
    } catch (error) {
        console.error('Error fetching branch analytics:', error);
        res.status(500).json({ message: 'Server error fetching analytics.' });
    }
});

// ================= SUPPORT TICKETS ================= //

// POST /api/support-tickets — Patient or any authenticated user creates a ticket
app.post('/api/support-tickets', verifyToken, async (req, res) => {
    try {
        const { subject, message } = req.body;
        if (!subject || !message) {
            return res.status(400).json({ message: 'Subject and message are required.' });
        }

        const sender = await User.findById(req.user.id).select('name email role');
        if (!sender) return res.status(404).json({ message: 'User not found.' });

        const fullName = `${sender.name?.first || ''} ${sender.name?.last || ''}`.trim() || sender.email;

        const ticket = await SupportTicket.create({
            patientId: req.user.id,
            patientName: fullName,
            patientEmail: sender.email,
            subject,
            messages: [{
                sender: req.user.id,
                senderName: fullName,
                senderRole: sender.role,
                content: message
            }]
        });

        // Notify administrators
        await Notification.insertMany([
            {
                type: 'CHAT_TICKET_RAISED',
                title: 'New Support Ticket',
                message: `${fullName} submitted a ticket: \"${subject}\"`,
                recipientRole: 'administrator',
                relatedId: ticket._id
            },
            {
                type: 'CHAT_TICKET_RAISED',
                title: 'New Support Ticket',
                message: `${fullName} submitted a ticket: \"${subject}\"`,
                recipientRole: 'owner',
                relatedId: ticket._id
            }
        ]);

        await AuditLog.create({
            action: 'TICKET_CREATED',
            user: sender.email,
            role: sender.role,
            details: `Support ticket created: "${subject}" (ID: ${ticket._id})`
        });

        res.status(201).json(ticket);
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/support-tickets — Admin views all tickets with optional filters
app.get('/api/support-tickets', verifyToken, async (req, res) => {
    if (!['administrator', 'co-administrator', 'branch-manager', 'secretary'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const { status, priority, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status)   filter.status   = status;
        if (priority) filter.priority = priority;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [tickets, total] = await Promise.all([
            SupportTicket.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select('-messages'), // Exclude message thread from list view for performance
            SupportTicket.countDocuments(filter)
        ]);

        res.json({ tickets, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/support-tickets/:id — Full ticket with message thread
app.get('/api/support-tickets/:id', verifyToken, async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

        // Patients can only view their own tickets
        const isAdmin = ['administrator', 'co-administrator'].includes(req.user.role);
        const isOwner = ticket.patientId?.toString() === req.user.id;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        res.json(ticket);
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/support-tickets/:id/messages — Admin or patient adds a reply
app.post('/api/support-tickets/:id/messages', verifyToken, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content?.trim()) {
            return res.status(400).json({ message: 'Message content is required.' });
        }

        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

        if (ticket.status === 'closed') {
            return res.status(400).json({ message: 'Cannot reply to a closed ticket.' });
        }

        const sender = await User.findById(req.user.id).select('name email role');
        const fullName = `${sender.name?.first || ''} ${sender.name?.last || ''}`.trim() || sender.email;

        ticket.messages.push({
            sender: req.user.id,
            senderName: fullName,
            senderRole: sender.role,
            content: content.trim()
        });

        // Auto-set to in-progress when staff first replies
        if (['administrator', 'co-administrator', 'branch-manager', 'secretary'].includes(req.user.role) && ticket.status === 'open') {
            ticket.status = 'in-progress';
            if (!ticket.assignedTo) {
                ticket.assignedTo = req.user.id;
                ticket.assignedToName = fullName;
            }
        }

        await ticket.save();
        res.json(ticket);
    } catch (error) {
        console.error('Error adding message:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// PATCH /api/support-tickets/:id/status — Admin updates ticket status/priority/assignee
app.patch('/api/support-tickets/:id/status', verifyToken, async (req, res) => {
    if (!['administrator', 'co-administrator', 'branch-manager', 'secretary'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const { status, priority, assignedTo, assignedToName } = req.body;

        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });

        if (status)         ticket.status         = status;
        if (priority)       ticket.priority       = priority;
        if (assignedTo)     ticket.assignedTo     = assignedTo;
        if (assignedToName) ticket.assignedToName = assignedToName;

        if (status === 'resolved') ticket.resolvedAt = new Date();
        if (status === 'closed')   ticket.closedAt   = new Date();

        await ticket.save();

        await AuditLog.create({
            action: 'TICKET_RESOLVED',
            user: req.user.email,
            role: req.user.role,
            details: `Ticket ${ticket._id} updated — status: ${status || ticket.status}`
        });

        res.json(ticket);
    } catch (error) {
        console.error('Error updating ticket status:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// -------------------------------------------------------
// TRANSFER SYSTEM OWNERSHIP (Administrator Only)
// Co-Admin Plan — Phase 1, Section 5.2
// -------------------------------------------------------
app.post('/api/transfer-ownership', verifyToken, async (req, res) => {
    // Only a current administrator can initiate this action
    if (req.user.role !== 'administrator') {
        await AuditLog.create({
            action: 'UNAUTHORIZED_ESCALATION_ATTEMPT',
            user: req.user.email,
            role: req.user.role,
            actorId: req.user.id,
            actorRole: req.user.role,
            details: `Unauthorized attempt to initiate ownership transfer by non-administrator.`
        });
        return res.status(403).json({ message: 'Access denied. Only the Administrator can transfer system ownership.' });
    }

    const { targetCoAdminId, currentPassword } = req.body;

    if (!targetCoAdminId || !currentPassword) {
        return res.status(400).json({ message: 'Target Co-Administrator ID and current password are required.' });
    }

    try {
        // 1. Verify the current admin's password
        const adminUser = await User.findById(req.user.id);
        if (!adminUser) return res.status(404).json({ message: 'Administrator account not found.' });

        const isPasswordValid = await bcrypt.compare(currentPassword, adminUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Incorrect password. Ownership transfer cancelled.' });
        }

        // 2. Find and validate the target co-admin
        const targetUser = await User.findById(targetCoAdminId);
        if (!targetUser) return res.status(404).json({ message: 'Target user not found.' });
        if (targetUser.role !== 'co-administrator') {
            return res.status(400).json({ message: 'Target user must be a Co-Administrator.' });
        }
        if (targetUser.status !== 'active') {
            return res.status(400).json({ message: 'Target Co-Administrator account must be active.' });
        }

        // 3. Perform the atomic role swap
        adminUser.role = 'co-administrator';
        targetUser.role = 'administrator';

        await adminUser.save();
        await targetUser.save();

        // 4. Record the ownership transfer audit log entry
        await AuditLog.create({
            action: 'OWNERSHIP_TRANSFER',
            user: adminUser.email,
            role: 'administrator',
            actorId: adminUser._id,
            actorRole: 'administrator',
            targetId: targetUser._id,
            targetModel: 'User',
            details: `Ownership transferred from ${adminUser.email} (now Co-Administrator) to ${targetUser.email} (now Administrator).`
        });

        // 5. Notify both affected users via email
        const newAdminName = `${targetUser.name?.first || ''} ${targetUser.name?.last || ''}`.trim();
        const prevAdminName = `${adminUser.name?.first || ''} ${adminUser.name?.last || ''}`.trim();

        try {
            // Notify the new Administrator
            await resend.emails.send({
                from: 'NgitiFy Admin <noreply@ngitify.com>',
                to: targetUser.email,
                subject: 'NgitiFy: You are now the Administrator',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #005466;">Role Change Notification</h2>
                        <p>Hello ${newAdminName},</p>
                        <p>Your NgitiFy account role has been upgraded to <strong>Administrator</strong>.</p>
                        <p>This change was initiated by <strong>${prevAdminName}</strong> (${adminUser.email}).</p>
                        <p>You now hold full system ownership of NgitiFy for Dentime Dental Clinic.</p>
                        <p style="color: #6b7280; font-size: 12px;">If you did not expect this change, please contact your clinic immediately.</p>
                    </div>
                `
            });

            // Notify the previous Administrator (now Co-Admin)
            await resend.emails.send({
                from: 'NgitiFy Admin <noreply@ngitify.com>',
                to: adminUser.email,
                subject: 'NgitiFy: Your role has changed to Co-Administrator',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                        <h2 style="color: #005466;">Role Change Notification</h2>
                        <p>Hello ${prevAdminName},</p>
                        <p>You have successfully transferred Administrator ownership to <strong>${newAdminName}</strong> (${targetUser.email}).</p>
                        <p>Your account role is now <strong>Co-Administrator</strong>.</p>
                        <p style="color: #6b7280; font-size: 12px;">To reverse this change, the new Administrator must initiate a transfer back.</p>
                    </div>
                `
            });
        } catch (emailError) {
            // Email failure is non-critical — the role swap already succeeded
            console.error('⚠️ Ownership transfer email notification failed:', emailError.message);
        }

        res.json({
            message: `Ownership successfully transferred to ${newAdminName}. Your role is now Co-Administrator.`
        });

    } catch (error) {
        console.error('Error during ownership transfer:', error);
        res.status(500).json({ message: 'Server error during ownership transfer. No changes were made.' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));