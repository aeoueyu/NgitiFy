const jwt = require('jsonwebtoken');
const User = require('../models/User');

const LIVE_USER_CACHE_TTL_MS = Math.max(
    1000,
    Number.parseInt(process.env.AUTH_LIVE_USER_CACHE_TTL_MS || '5000', 10) || 5000
);
const MAX_LIVE_USER_CACHE_ENTRIES = 1000;
const liveUserCache = new Map();

const loadLiveUser = (userId) => {
    const cacheKey = String(userId || '');
    const now = Date.now();
    const cached = liveUserCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
        return cached.promise;
    }

    const promise = User.findById(userId)
        .select('status isArchived role email assignedBranch assignedBranches isDentist')
        .lean()
        .catch((error) => {
            liveUserCache.delete(cacheKey);
            throw error;
        });

    liveUserCache.set(cacheKey, {
        expiresAt: now + LIVE_USER_CACHE_TTL_MS,
        promise,
    });

    if (liveUserCache.size > MAX_LIVE_USER_CACHE_ENTRIES) {
        for (const [key, entry] of liveUserCache) {
            if (entry.expiresAt <= now || liveUserCache.size > MAX_LIVE_USER_CACHE_ENTRIES) {
                liveUserCache.delete(key);
            }
        }
    }

    return promise;
};

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
        // Reuse a very short-lived lookup so parallel mobile screen requests do
        // not all perform the same database query. Account changes still take
        // effect within a few seconds without requiring a token blacklist.
        const liveUser = await loadLiveUser(decoded.id);

        if (!liveUser) {
            return res.status(401).json({ message: 'Account not found. Please log in again.' });
        }

        if (liveUser.isArchived) {
            return res.status(401).json({
                message: 'This account has been archived. Please contact your administrator.'
            });
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
