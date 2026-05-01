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
        req.user = decoded; // Start with token payload, then enrich from the live user record.

        // ── Session Invalidation Guard ───────────────────────────────────────
        // Check the user's live status from the database on every request.
        // This ensures that deactivating a Co-Admin (or any user) immediately
        // invalidates their active session without needing a token blacklist.
        const liveUser = await User.findById(decoded.id)
            .select('status role email assignedBranch assignedBranches isDentist')
            .lean();

        if (!liveUser) {
            return res.status(401).json({ message: 'Account not found. Please log in again.' });
        }

        if (liveUser.status === 'inactive') {
            return res.status(401).json({
                message: 'Your account has been deactivated. Please contact your administrator.'
            });
        }

        req.user = {
            ...decoded,
            role: liveUser.role,
            email: liveUser.email || decoded.email,
            assignedBranch: liveUser.assignedBranch || liveUser.assignedBranches?.[0] || decoded.assignedBranch || null,
            assignedBranches: Array.isArray(liveUser.assignedBranches) ? liveUser.assignedBranches : [],
            isDentist: typeof liveUser.isDentist === 'boolean' ? liveUser.isDentist : decoded.isDentist,
        };
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
