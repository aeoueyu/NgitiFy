const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Siguraduhin na tama ang path papunta sa User model
const User = require('../backend/models/User'); 

// LOCAL Database Connection String
const MONGO_URI = 'mongodb://127.0.0.1:27017/ngitify';

const createAdmin = async () => {
    try {
        // Connect sa Local Database
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to Local MongoDB');

        const email = 'admin@gmail.com';
        const rawPassword = 'AdminUser_123';
        const role = 'owner'; // Important: Lowercase

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
            
            // Siguraduhin na may pangalan para hindi mag-error
            if (!user.name || !user.name.first) {
                user.name = { first: 'Admin', last: 'User' };
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
                contactNumber: '09123456789',
                isVerified: true
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