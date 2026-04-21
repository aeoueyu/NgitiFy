const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
    // Get the authorization header
    const authHeader = req.headers['authorization'];
    // Extract the token (format: "Bearer <token>")
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // Verify the token using the secret from .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach decoded payload { id, role } to the request

        // ── Session Invalidation Guard ───────────────────────────────────────
        // Check the user's live status from the database on every request.
        // This ensures that deactivating a Co-Admin (or any user) immediately
        // invalidates their active session without needing a token blacklist.
        const liveUser = await User.findById(decoded.id).select('status role').lean();

        if (!liveUser) {
            return res.status(401).json({ message: 'Account not found. Please log in again.' });
        }

        if (liveUser.status === 'inactive') {
            return res.status(401).json({
                message: 'Your account has been deactivated. Please contact your administrator.'
            });
        }
        // ────────────────────────────────────────────────────────────────────

        next(); // Proceed to the next middleware or route handler
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please log in again.' });
        }
        return res.status(403).json({ message: 'Invalid token.' });
    }
};

module.exports = verifyToken;