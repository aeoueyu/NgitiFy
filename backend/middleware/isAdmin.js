module.exports = function isAdmin(req, res, next) {
    if (!['administrator', 'co-administrator'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied. Admin tier only.' });
    }
    next();
};
