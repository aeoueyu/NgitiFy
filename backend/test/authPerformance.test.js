const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

test('parallel authenticated requests share one live-user lookup', async () => {
    const originalFindById = User.findById;
    const originalSecret = process.env.JWT_SECRET;
    const secret = 'auth-performance-test-secret';
    let lookupCount = 0;

    process.env.JWT_SECRET = secret;
    User.findById = () => ({
        select: () => ({
            lean: async () => {
                lookupCount += 1;
                await new Promise((resolve) => setTimeout(resolve, 10));
                return {
                    _id: '507f1f77bcf86cd799439011',
                    role: 'patient',
                    email: 'patient@example.test',
                    status: 'active',
                    isArchived: false,
                    assignedBranches: [],
                };
            },
        }),
    });

    delete require.cache[require.resolve('../middleware/auth')];
    const verifyToken = require('../middleware/auth');
    const token = jwt.sign({
        id: '507f1f77bcf86cd799439011',
        role: 'patient',
    }, secret);

    const authenticate = () => new Promise((resolve, reject) => {
        const req = {
            headers: { authorization: `Bearer ${token}` },
        };
        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                reject(new Error(payload?.message || `HTTP ${this.statusCode}`));
            },
        };

        verifyToken(req, res, () => resolve(req.user));
    });

    try {
        const users = await Promise.all(
            Array.from({ length: 8 }, authenticate)
        );

        assert.equal(lookupCount, 1);
        assert.ok(users.every((user) => user.role === 'patient'));
    } finally {
        User.findById = originalFindById;
        process.env.JWT_SECRET = originalSecret;
        delete require.cache[require.resolve('../middleware/auth')];
    }
});
