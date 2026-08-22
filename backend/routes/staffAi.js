const express = require('express');
const mongoose = require('mongoose');
const StaffAiConversation = require('../models/StaffAiConversation');
const {
    deriveConversationTitle,
    normalizeConversationMessage,
    normalizeConversationTitle,
    serializeConversation,
    serializeConversationSummary,
} = require('../utils/patientAiConversations');
const {
    STAFF_AI_ROLES,
    buildStaffSystemContext,
    getManilaDayRange,
    summarizeAppointments,
    summarizeInventory,
    summarizeRadiographRecords,
    wantsTodayAppointments,
    wantsOperationalContext,
} = require('../utils/staffAi');

const MAX_HISTORY_MESSAGES = 40;

module.exports = function createStaffAiRouter({
    verifyToken,
    aiChatLimiter,
    ensureAiConfigured,
    Appointment,
    Inventory,
    User,
    AuditLog,
    getScopedBranchForUser,
    dentistCanAccessPatient,
    patientBelongsToBranch,
}) {
    const router = express.Router();
    router.use(verifyToken);

    const assertStaff = (req, res) => {
        if (!STAFF_AI_ROLES.includes(req.user?.role)) {
            res.status(403).json({ message: 'Access denied.' });
            return false;
        }
        return true;
    };

    const getOwned = async (req) => {
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id || ''))) {
            const error = new Error('Conversation not found.');
            error.statusCode = 404;
            throw error;
        }
        const conversation = await StaffAiConversation.findOne({ _id: req.params.id, owner: req.user.id });
        if (!conversation) {
            const error = new Error('Conversation not found.');
            error.statusCode = 404;
            throw error;
        }
        return conversation;
    };

    const buildAuthorizedContext = async (req, messages) => {
        const role = req.user.role;
        const branch = ['branch-manager', 'secretary'].includes(role)
            ? getScopedBranchForUser(req.user)
            : '';
        const ownerBranches = role === 'owner' && Array.isArray(req.user.assignedBranches)
            ? req.user.assignedBranches.filter(Boolean)
            : [];
        const requested = wantsOperationalContext(messages);
        const aggregates = {};

        if (requested.appointments) {
            const query = { isArchived: { $ne: true } };
            const todayRange = wantsTodayAppointments(messages) ? getManilaDayRange() : null;
            if (branch) query.branch = branch;
            else if (ownerBranches.length) query.branch = { $in: ownerBranches };
            if (role === 'dentist') query.dentist = req.user.id;
            if (todayRange) query.date = { $gte: todayRange.start, $lte: todayRange.end };
            const appointments = await Appointment.find(query).select('date status branch').lean();
            aggregates.appointments = {
                ...summarizeAppointments(appointments),
                period: todayRange ? 'today' : 'all-authorized-appointments',
                ...(todayRange ? { date: todayRange.dateKey, timeZone: 'Asia/Manila' } : {}),
            };
        }

        if (requested.inventory && role !== 'secretary') {
            const query = branch ? { branch } : ownerBranches.length ? { branch: { $in: ownerBranches } } : {};
            const inventory = await Inventory.find(query)
                .select('itemName name quantity currentStock reorderLevel threshold unit branch')
                .lean();
            aggregates.inventory = summarizeInventory(inventory);
        }

        const requestedPatientId = String(req.body?.assistantContext?.patientId || '').trim();
        if (requestedPatientId) {
            if (role === 'secretary') {
                const error = new Error('Clinical patient information is not available for the Secretary role.');
                error.statusCode = 403;
                throw error;
            }
            if (role === 'dentist' && !(await dentistCanAccessPatient(req.user.id, requestedPatientId))) {
                const error = new Error('Access denied for this patient.');
                error.statusCode = 403;
                throw error;
            }
            if (role === 'branch-manager') {
                const patient = await User.findById(requestedPatientId).select('assignedBranch assignedBranches').lean();
                if (!patient || !patientBelongsToBranch(patient, branch)) {
                    const error = new Error('Access denied for this patient.');
                    error.statusCode = 403;
                    throw error;
                }
            }
            aggregates.patientAccess = { patientId: requestedPatientId, verified: true };
            if (role === 'dentist') {
                const patientRecord = await User.findById(requestedPatientId).select('radiographs treatmentLogs').lean();
                aggregates.radiographReview = summarizeRadiographRecords(patientRecord?.radiographs || [], patientRecord?.treatmentLogs || []);
            }
        }

        return buildStaffSystemContext({
            role,
            branch,
            currentModule: req.body?.assistantContext?.currentModule,
            currentRoute: req.body?.assistantContext?.currentRoute,
            aggregates,
        });
    };

    const streamReply = async ({ req, res, messages, conversation = null }) => {
        const geminiService = await ensureAiConfigured(res);
        if (!geminiService) return;
        const context = await buildAuthorizedContext(req, messages);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = await geminiService.generateScopedStream({
            scope: 'staff', messages: messages.slice(-MAX_HISTORY_MESSAGES), additionalContext: context,
        });
        let reply = '';
        if (stream) {
            for await (const chunk of stream) {
                if (!chunk?.text) continue;
                reply += chunk.text;
                res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
            }
        } else {
            reply = geminiService.getRefusalText();
            res.write(`data: ${JSON.stringify({ text: reply })}\n\n`);
        }

        if (conversation) {
            const userMessage = messages[messages.length - 1];
            if (!conversation.messages.some((item) => item.role === 'user') && conversation.titleSource !== 'manual') {
                conversation.title = deriveConversationTitle(userMessage.content);
            }
            const now = new Date();
            conversation.messages.push({ ...userMessage, createdAt: now }, { role: 'assistant', content: reply, createdAt: now });
            conversation.lastMessageAt = now;
            await conversation.save();
            res.write(`data: ${JSON.stringify({ conversation: serializeConversation(conversation) })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
        AuditLog.create({
            action: 'AI_STAFF_CHAT', user: req.user.email, role: req.user.role,
            actorId: req.user.id, actorRole: req.user.role,
            details: `Staff AI used (${messages.length} message(s)); conversation content was not logged.`,
        }).catch(() => {});
    };

    router.get('/conversations', async (req, res) => {
        try {
            if (!assertStaff(req, res)) return;
            const archived = String(req.query.archived || '').toLowerCase() === 'true';
            const conversations = await StaffAiConversation.find({ owner: req.user.id, isArchived: archived })
                .sort({ isPinned: -1, lastMessageAt: -1, updatedAt: -1 });
            res.json({ conversations: conversations.map(serializeConversationSummary) });
        } catch (error) {
            res.status(500).json({ message: 'Server error loading AI conversations.' });
        }
    });

    router.post('/conversations', async (req, res) => {
        try {
            if (!assertStaff(req, res)) return;
            const title = String(req.body?.title || '').trim();
            const conversation = await StaffAiConversation.create({
                owner: req.user.id, ownerRole: req.user.role,
                title: title ? normalizeConversationTitle(title) : 'New conversation',
                titleSource: title ? 'manual' : 'derived',
            });
            res.status(201).json({ conversation: serializeConversation(conversation) });
        } catch (error) {
            res.status(error.statusCode || 500).json({ message: error.message || 'Server error creating AI conversation.' });
        }
    });

    router.get('/conversations/:id', async (req, res) => {
        try {
            if (!assertStaff(req, res)) return;
            res.json({ conversation: serializeConversation(await getOwned(req)) });
        } catch (error) {
            res.status(error.statusCode || 500).json({ message: error.message || 'Server error loading AI conversation.' });
        }
    });

    router.patch('/conversations/:id', async (req, res) => {
        try {
            if (!assertStaff(req, res)) return;
            const conversation = await getOwned(req);
            const supported = ['title', 'isPinned', 'isArchived'].filter((key) => Object.hasOwn(req.body || {}, key));
            if (!supported.length) return res.status(400).json({ message: 'No supported conversation changes were provided.' });
            if (supported.includes('title')) {
                conversation.title = normalizeConversationTitle(req.body.title);
                conversation.titleSource = 'manual';
            }
            for (const field of ['isPinned', 'isArchived']) {
                if (!supported.includes(field)) continue;
                if (typeof req.body[field] !== 'boolean') return res.status(400).json({ message: `${field} must be a boolean.` });
                conversation[field] = req.body[field];
            }
            if (supported.includes('isArchived')) conversation.archivedAt = conversation.isArchived ? new Date() : null;
            await conversation.save();
            res.json({ conversation: serializeConversation(conversation) });
        } catch (error) {
            res.status(error.statusCode || 500).json({ message: error.message || 'Server error updating AI conversation.' });
        }
    });

    router.delete('/conversations/:id', async (req, res) => {
        try {
            if (!assertStaff(req, res)) return;
            const conversation = await getOwned(req);
            await StaffAiConversation.deleteOne({ _id: conversation._id, owner: req.user.id });
            res.json({ message: 'AI conversation deleted.' });
        } catch (error) {
            res.status(error.statusCode || 500).json({ message: error.message || 'Server error deleting AI conversation.' });
        }
    });

    router.post('/conversations/:id/messages', aiChatLimiter, async (req, res) => {
        try {
            if (!assertStaff(req, res)) return;
            const conversation = await getOwned(req);
            if (conversation.isArchived) return res.status(409).json({ message: 'Restore this conversation before sending a message.' });
            const userMessage = normalizeConversationMessage({ role: 'user', content: req.body?.message?.content });
            const history = conversation.messages.map(({ role, content }) => ({ role, content }));
            await streamReply({ req, res, messages: [...history, userMessage], conversation });
        } catch (error) {
            if (!res.headersSent) res.status(error.statusCode || 500).json({ message: error.message || 'Server error processing AI request.' });
            else res.end();
        }
    });

    router.post('/chat', aiChatLimiter, async (req, res) => {
        try {
            if (!assertStaff(req, res)) return;
            if (!Array.isArray(req.body?.messages) || !req.body.messages.length) return res.status(400).json({ message: 'Messages array is required.' });
            const messages = req.body.messages.map(normalizeConversationMessage);
            await streamReply({ req, res, messages });
        } catch (error) {
            if (!res.headersSent) res.status(error.statusCode || 500).json({ message: error.message || 'Server error processing AI request.' });
            else res.end();
        }
    });

    return router;
};
