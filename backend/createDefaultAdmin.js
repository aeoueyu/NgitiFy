const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Siguraduhin na tama ang path papunta sa User model
const User = require('./models/User'); 

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
        const defaultContact = '+639123456789'; // Standardized backend format

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