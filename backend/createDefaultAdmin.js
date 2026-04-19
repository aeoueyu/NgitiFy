const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Siguraduhin na tama ang path papunta sa User model
const User = require('./models/User'); 

// LOCAL Database Connection String
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI;

const createAdmin = async () => {
    const email          = process.env.ADMIN_EMAIL;
    const rawPassword    = process.env.ADMIN_INIT_PASSWORD;
    const defaultContact = process.env.ADMIN_CONTACT || '+639000000000';

    if (!email || !rawPassword) {
        console.error('❌ Missing required env vars: ADMIN_EMAIL and ADMIN_INIT_PASSWORD');
        console.error('   Set them before running this script:');
        console.error('   ADMIN_EMAIL=you@example.com ADMIN_INIT_PASSWORD=YourPassword node createDefaultAdmin.js');
        process.exit(1);
    }

    try {
        // Connect sa Local Database
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to Local MongoDB');

        const role = 'administrator'; // Important: Lowercase

        // 1. Hash ang password
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // 2. Hanapin kung may existing user na
        let user = await User.findOne({ email });

        if (user) {
            // Update existing user
            console.log('🔄 Updating existing admin account...');
            user.password = hashedPassword;
            user.role = role;
            user.isVerified = true;
            user.status = 'active'; // Siguraduhing active
            
            // Fail-safe updates para sa existing document
            if (!user.name || !user.name.first) {
                user.name = { first: 'Admin', last: 'User' };
            }
            if (!user.contactNumber) {
                user.contactNumber = defaultContact;
            }
            
            await user.save();
            console.log('🎉 Admin updated successfully! Pwede ka na mag-login.');
        } else {
            // Create new user
            console.log('🆕 Creating new admin account...');
            const newAdmin = new User({
                name: { first: 'Admin', last: 'User' },
                email,
                password: hashedPassword,
                role,
                contactNumber: defaultContact,
                isVerified: true,
                status: 'active'
            });
            await newAdmin.save();
            console.log('🎉 Admin created successfully! Pwede ka na mag-login.');
        }

        process.exit();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

createAdmin();