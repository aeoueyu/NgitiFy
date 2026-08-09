require('dotenv').config();

// ── Fail fast: crash at startup if any required env var is missing ──
const REQUIRED_ENV_VARS = ['JWT_SECRET', 'MONGO_URI', 'RESEND_API_KEY', 'FRONTEND_URL'];
REQUIRED_ENV_VARS.forEach(key => {
    if (!process.env[key]) {
        console.error(`❌ Missing required environment variable: ${key}`);
        process.exit(1);
    }
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');
const { InferenceClient } = require('@huggingface/inference');
const defaultWebsiteContent = require('../ngitify-web/src/data/websiteContentDefaults.json');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttemptState = new Map();

const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    max: 100,
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
const Appointment = require('./models/Appointment');
const Surgery = Appointment;
const LegacyInventory = require('./models/Inventory');
const InventoryItem = require('./models/InventoryItem');
const InventoryBatch = require('./models/InventoryBatch');
const Notification = require('./models/Notification');
const Branch = require('./models/Branch');
const Queue = require('./models/Queue');
const SystemConfig = require('./models/SystemConfig');
const RolePermission = require('./models/RolePermission');
const backupRoutes = require('./routes/backup');
const integrityRoutes = require('./routes/integrity');
// ADD this line with the other model imports (after the AuditLog import)
const MaterialUsageLog = require('./models/MaterialUsageLog');
const RADIOGRAPH_ENHANCER_SCRIPT = path.join(__dirname, 'python', 'radiograph_enhance.py');
const RADIOGRAPH_ENHANCER_ENGINES = Object.freeze({
    basic: {
        key: 'basic',
        variantKey: 'basic',
        label: 'Basic Enhance',
        storageEngine: 'basic',
    },
    'self-hosted': {
        key: 'self-hosted',
        variantKey: 'selfHosted',
        label: 'Self-Hosted AI',
        storageEngine: 'self-hosted',
    },
    'hugging-face': {
        key: 'hugging-face',
        variantKey: 'huggingFace',
        label: 'Hugging Face AI',
        storageEngine: 'hugging-face',
    },
});
const DEFAULT_HF_RADIOGRAPH_MODEL = String(process.env.HF_RADIOGRAPH_MODEL || '').trim();
const DEFAULT_HF_RADIOGRAPH_PROVIDER = String(process.env.HF_RADIOGRAPH_PROVIDER || 'hf-inference').trim();
const GEMINI_SERVICE_PATH = pathToFileURL(path.join(__dirname, 'ai', 'geminiService.mjs')).href;
let geminiServicePromise = null;
const LIFECYCLE_ACTOR_POPULATE = [
    { path: 'archivedBy', select: 'name email role' },
    { path: 'restoredBy', select: 'name email role' },
    { path: 'deactivatedBy', select: 'name email role' },
];

const loadGeminiService = () => {
    if (!geminiServicePromise) {
        geminiServicePromise = import(GEMINI_SERVICE_PATH);
    }
    return geminiServicePromise;
};

const ensureAiConfigured = async (res) => {
    const geminiService = await loadGeminiService();
    if (geminiService.isAiConfigured()) {
        return geminiService;
    }
    res.status(503).json({ message: 'AI features are not enabled.' });
    return null;
};

const parseBase64ImageDataUrl = (value) => {
    const match = String(value || '').trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
        throw Object.assign(new Error('The stored radiograph image is not a supported base64 data URL.'), { statusCode: 400 });
    }
    return {
        mediaType: match[1],
        imageBase64: match[2],
    };
};

const getRadiographEnhancementConfig = (engine = '') => {
    const normalized = String(engine || '').trim().toLowerCase();
    return RADIOGRAPH_ENHANCER_ENGINES[normalized] || RADIOGRAPH_ENHANCER_ENGINES.basic;
};

const buildEnhancementVariantRecord = (variant = {}) => ({
    url: String(variant?.url || '').trim(),
    engine: String(variant?.engine || '').trim(),
    label: String(variant?.label || '').trim(),
    generatedAt: variant?.generatedAt ? new Date(variant.generatedAt) : null,
    generatedBy: variant?.generatedBy || null,
    provider: String(variant?.provider || '').trim(),
    model: String(variant?.model || '').trim(),
});

const getNormalizedEnhancementVariants = (radiograph = {}) => {
    const stored = radiograph?.enhancementVariants || {};
    const variants = {
        basic: buildEnhancementVariantRecord(stored.basic),
        selfHosted: buildEnhancementVariantRecord(stored.selfHosted),
        huggingFace: buildEnhancementVariantRecord(stored.huggingFace),
    };

    if (!variants.basic.url && radiograph?.enhancedUrl) {
        variants.basic = buildEnhancementVariantRecord({
            url: radiograph.enhancedUrl,
            engine: radiograph.lastEnhancementEngine || 'basic',
            label: 'Basic Enhance',
            generatedAt: radiograph.enhancedAt || null,
            generatedBy: radiograph.enhancedBy || null,
        });
    }

    return variants;
};

const buildRadiographPayload = (radiograph = {}) => {
    const variants = getNormalizedEnhancementVariants(radiograph);
    return {
        _id: radiograph._id,
        label: radiograph.label,
        date: radiograph.date,
        radiographNumber: radiograph.radiographNumber || '',
        url: radiograph.url || '',
        enhancedUrl: radiograph.enhancedUrl || '',
        findings: radiograph.findings || '',
        notes: radiograph.notes || '',
        enhancedAt: radiograph.enhancedAt || null,
        enhancedBy: radiograph.enhancedBy || null,
        lastEnhancementEngine: radiograph.lastEnhancementEngine || '',
        enhancementVariants: variants,
    };
};

const buildTreatmentLogPayload = (entry = {}) => ({
    _id: entry._id,
    id: entry._id || entry.id,
    date: entry.date,
    procedure: entry.procedure || '',
    tooth: entry.tooth || '',
    category: entry.category || 'Other',
    notes: entry.notes || '',
    dentistId: entry.dentistId || null,
    dentistName: entry.dentistName || '',
    branch: entry.branch || '',
    amountCharged: entry.amountCharged ?? 0,
    amountPaid: entry.amountPaid ?? 0,
    balance: entry.balance ?? 0,
    nextAppointment: entry.nextAppointment || null,
    createdAt: entry.createdAt || null,
    updatedAt: entry.updatedAt || null,
});

const getRadiographEnhancerCommands = () => {
    const configuredCommand = String(process.env.OPENCV_PYTHON_BIN || '').trim();
    if (configuredCommand) {
        return [{
            command: configuredCommand,
            args: [],
        }];
    }
    if (process.platform === 'win32') {
        return [
            { command: 'python', args: [] },
            { command: 'py', args: ['-3'] },
        ];
    }
    return [
        { command: 'python3', args: [] },
        { command: 'python', args: [] },
    ];
};

const spawnRadiographEnhancer = ({ command, args, payload }) => {
    return new Promise((resolve, reject) => {
        const child = spawn(command, [...args, RADIOGRAPH_ENHANCER_SCRIPT], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('error', (error) => {
            reject(Object.assign(
                new Error(`Could not start the radiograph enhancer with "${command}". Install Python dependencies or set OPENCV_PYTHON_BIN.`),
                { cause: error }
            ));
        });
        child.on('close', (code) => {
            if (code !== 0) {
                const detail = stderr.trim() || stdout.trim() || `Enhancer exited with code ${code}.`;
                if (
                    detail.includes("ModuleNotFoundError: No module named 'cv2'")
                    || detail.includes('No module named \'cv2\'')
                ) {
                    return reject(new Error('OpenCV is not installed on the server. Redeploy after installing backend/python/requirements.txt during the backend build step.'));
                }
                if (
                    detail.includes("ModuleNotFoundError: No module named 'realesrgan'")
                    || detail.includes("ModuleNotFoundError: No module named 'basicsr'")
                    || detail.includes("ModuleNotFoundError: No module named 'torch'")
                ) {
                    return reject(new Error('Self-hosted AI enhancement dependencies are not installed. Install backend/python/requirements-ai.txt to enable Real-ESRGAN.'));
                }
                return reject(new Error(`Radiograph enhancement failed. ${detail}`));
            }
            try {
                const parsed = JSON.parse(stdout);
                if (!parsed?.imageBase64 || !parsed?.mediaType) {
                    throw new Error('Enhancer returned an incomplete payload.');
                }
                resolve({
                    mediaType: parsed.mediaType,
                    imageBase64: parsed.imageBase64,
                });
            } catch (error) {
                reject(new Error(`Could not parse enhancer output. ${error.message}`));
            }
        });

        child.stdin.end(JSON.stringify(payload));
    });
};

const runPythonRadiographEnhancer = async (imageDataUrl, options = {}) => {
    const { mediaType, imageBase64 } = parseBase64ImageDataUrl(imageDataUrl);
    const commands = getRadiographEnhancerCommands();
    let lastError = null;

    for (const commandConfig of commands) {
        try {
            return await spawnRadiographEnhancer({
                ...commandConfig,
                payload: {
                    imageBase64,
                    mediaType,
                    engine: options.engine || 'basic',
                    upscale: Number.isFinite(options.upscale) ? options.upscale : undefined,
                },
            });
        } catch (error) {
            lastError = error;
            if (!String(error.message || '').startsWith('Could not start the radiograph enhancer')) {
                throw error;
            }
        }
    }

    throw lastError || new Error('Could not start the radiograph enhancer.');
};

const runHuggingFaceRadiographEnhancer = async (imageDataUrl, options = {}) => {
    const hfToken = String(process.env.HF_TOKEN || '').trim();
    if (!hfToken) {
        throw new Error('HF_TOKEN is not configured for the Hugging Face test harness.');
    }

    const model = String(options.model || DEFAULT_HF_RADIOGRAPH_MODEL || '').trim();
    const provider = String(options.provider || DEFAULT_HF_RADIOGRAPH_PROVIDER || 'hf-inference').trim();
    if (!model) {
        throw new Error('HF_RADIOGRAPH_MODEL is not configured.');
    }

    const { imageBase64 } = parseBase64ImageDataUrl(imageDataUrl);
    const imageBlob = new Blob([Buffer.from(imageBase64, 'base64')], { type: 'image/png' });
    const prompt = 'Enhance this dental radiograph for clearer inspection. Preserve anatomy exactly, avoid adding or removing structures, and improve clarity conservatively.';
    const client = new InferenceClient(hfToken);

    try {
        const enhancedImageBlob = await client.imageToImage({
            model,
            provider,
            inputs: imageBlob,
            parameters: {
                prompt,
                num_inference_steps: 18,
                guidance_scale: 2.2,
            },
        });

        const buffer = Buffer.from(await enhancedImageBlob.arrayBuffer());
        return {
            mediaType: enhancedImageBlob.type || 'image/png',
            imageBase64: buffer.toString('base64'),
            provider,
            model,
        };
    } catch (error) {
        throw new Error(`Hugging Face enhancement failed. ${error?.message || 'Unknown error.'}`);
    }
};

const runRadiographEnhancer = async (imageDataUrl, options = {}) => {
    const engineConfig = getRadiographEnhancementConfig(options.engine);
    if (engineConfig.key === 'hugging-face') {
        return runHuggingFaceRadiographEnhancer(imageDataUrl, options);
    }

    const pythonEngine = engineConfig.key === 'self-hosted' ? 'realesrgan' : 'basic';
    return runPythonRadiographEnhancer(imageDataUrl, {
        ...options,
        engine: pythonEngine,
    });
};

const INVENTORY_READ_ROLES = ['administrator', 'branch-manager', 'secretary', 'owner', 'dentist'];
const INVENTORY_EDIT_ROLES = ['administrator', 'branch-manager', 'secretary', 'owner'];
const INVENTORY_USAGE_ROLES = ['administrator', 'branch-manager', 'dentist', 'owner'];

let inventoryMigrationPromise = null;

const getScopedInventoryBranch = async (reqUser) => {
    if (reqUser.role === 'branch-manager') {
        if (!reqUser.assignedBranch) {
            throw Object.assign(new Error('Branch manager has no assigned branch.'), { statusCode: 403 });
        }
        return reqUser.assignedBranch;
    }

    if (reqUser.role === 'dentist') {
        const dentistUser = await User.findById(reqUser.id).select('assignedBranch assignedBranches');
        const dentistBranch = dentistUser?.assignedBranch || dentistUser?.assignedBranches?.[0] || '';
        if (!dentistBranch) {
            throw Object.assign(new Error('Dentist has no assigned branch.'), { statusCode: 403 });
        }
        return dentistBranch;
    }

    return '';
};

const getLoginAttemptKey = (email = '', req) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const ipKey = ipKeyGenerator(req?.ip || req?.socket?.remoteAddress || '');
    return `${normalizedEmail}::${ipKey}`;
};

const getLoginLockMinutes = (state, now = Date.now()) => {
    if (!state?.lockUntil || state.lockUntil <= now) return 0;
    return Math.max(1, Math.ceil((state.lockUntil - now) / 60000));
};

const getActiveLoginLockState = (email = '', req) => {
    const key = getLoginAttemptKey(email, req);
    const state = loginAttemptState.get(key);
    if (!state) return { key, state: null, lockMinutes: 0 };

    const now = Date.now();
    const lockMinutes = getLoginLockMinutes(state, now);
    if (!lockMinutes && state.lockUntil) {
        loginAttemptState.set(key, {
            failures: 0,
            lockUntil: null,
            lockMultiplier: state.lockMultiplier || 1,
        });
        return { key, state: loginAttemptState.get(key), lockMinutes: 0 };
    }

    return { key, state, lockMinutes };
};

const registerFailedLoginAttempt = (email = '', req) => {
    const { key, state } = getActiveLoginLockState(email, req);
    const now = Date.now();
    const nextState = state || { failures: 0, lockUntil: null, lockMultiplier: 1 };

    if (nextState.lockUntil && nextState.lockUntil > now) {
        return { lockMinutes: getLoginLockMinutes(nextState, now), multiplier: nextState.lockMultiplier || 1 };
    }

    nextState.failures = (nextState.failures || 0) + 1;

    if (nextState.failures >= LOGIN_MAX_ATTEMPTS) {
        const multiplier = Math.max(nextState.lockMultiplier || 1, 1);
        nextState.failures = 0;
        nextState.lockUntil = now + (LOGIN_WINDOW_MS * multiplier);
        nextState.lockMultiplier = Math.min(multiplier * 2, 16);
        loginAttemptState.set(key, nextState);
        return { lockMinutes: getLoginLockMinutes(nextState, now), multiplier };
    }

    loginAttemptState.set(key, nextState);
    return { lockMinutes: 0, multiplier: nextState.lockMultiplier || 1 };
};

const clearLoginAttemptState = (email = '', req) => {
    const key = getLoginAttemptKey(email, req);
    loginAttemptState.delete(key);
};

const normalizeBranchKey = (value = '') => String(value || '').trim().toLowerCase();

const syncBranchManagerAssignments = async (managerId, branchName = '') => {
    if (!managerId) return;

    await Branch.updateMany(
        { managerIds: managerId },
        { $pull: { managerIds: managerId } }
    );

    const normalizedBranch = String(branchName || '').trim();
    if (!normalizedBranch) return;

    await Branch.findOneAndUpdate(
        { name: normalizedBranch },
        { $addToSet: { managerIds: managerId } }
    );
};

const computeBatchStatus = (batch) => {
    if ((batch.quantityRemaining || 0) <= 0) return 'Depleted';
    if (batch.expirationDate && new Date(batch.expirationDate) < new Date()) return 'Expired';
    return 'Active';
};

const syncBatchStatus = (batch) => {
    batch.status = computeBatchStatus(batch);
    return batch.status;
};

const INVENTORY_STOCK_IN_PREFIX = 'SI';
const INVENTORY_STOCK_IN_SEQUENCE_WIDTH = 3;

const formatInventoryStockInDateToken = (value = new Date()) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

const buildInventoryStockInPrefix = (value = new Date()) => `${INVENTORY_STOCK_IN_PREFIX}-${formatInventoryStockInDateToken(value)}`;

const getNextInventoryStockInNumber = async (receivedDate = new Date()) => {
    const prefix = buildInventoryStockInPrefix(receivedDate);
    const stockInPattern = new RegExp(`^${prefix}-(\\d+)$`);
    const existing = await InventoryBatch.find({ stockInNumber: stockInPattern })
        .select('stockInNumber')
        .lean();

    const maxSequence = existing.reduce((highest, batch) => {
        const match = String(batch.stockInNumber || '').match(stockInPattern);
        if (!match) return highest;
        return Math.max(highest, Number(match[1] || 0));
    }, 0);

    return `${prefix}-${String(maxSequence + 1).padStart(INVENTORY_STOCK_IN_SEQUENCE_WIDTH, '0')}`;
};

const isDuplicateStockInNumberError = (error) => (
    error?.code === 11000
    && Object.prototype.hasOwnProperty.call(error?.keyPattern || {}, 'stockInNumber')
);

const saveInventoryBatchWithStockInNumber = async (batch, { maxAttempts = 5 } = {}) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!String(batch.stockInNumber || '').trim()) {
            batch.stockInNumber = await getNextInventoryStockInNumber(batch.receivedDate || batch.createdAt || new Date());
        }
        try {
            await batch.save();
            return batch;
        } catch (error) {
            if (isDuplicateStockInNumberError(error)) {
                batch.stockInNumber = '';
                continue;
            }
            throw error;
        }
    }

    throw new Error('Could not generate a unique stock-in reference number.');
};

const flattenBatch = (batchDoc) => {
    const batch = batchDoc.toObject ? batchDoc.toObject() : batchDoc;
    const item = batch.inventoryItem || {};
    const threshold = Number(item.lowStockThreshold || 0);
    const quantityRemaining = Number(batch.quantityRemaining || 0);
    const expiryDate = batch.expirationDate ? new Date(batch.expirationDate) : null;
    const msUntilExpiry = expiryDate ? expiryDate.getTime() - Date.now() : null;
    const daysUntilExpiry = expiryDate ? Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24)) : null;

    return {
        _id: batch._id,
        id: batch._id,
        itemId: item._id || batch.inventoryItem,
        itemName: item.name || 'Unknown Item',
        name: item.name || 'Unknown Item',
        category: item.category || 'Uncategorized',
        brand: batch.brand || 'Unspecified',
        quantity: quantityRemaining,
        stock: quantityRemaining,
        currentStock: quantityRemaining,
        quantityReceived: Number(batch.quantityReceived || 0),
        reorderLevel: threshold,
        threshold,
        unit: item.unit || 'pcs',
        branch: batch.branch || item.branch || '',
        status: computeBatchStatus(batch),
        expirationDate: batch.expirationDate || null,
        receivedDate: batch.receivedDate || null,
        supplierName: batch.supplierName || '',
        batchNumber: batch.batchNumber || '',
        stockInNumber: batch.stockInNumber || '',
        isLowStock: quantityRemaining <= threshold,
        isExpired: Boolean(expiryDate && expiryDate < new Date()),
        isExpiringSoon: Boolean(expiryDate && daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30),
        daysUntilExpiry,
    };
};

const ensureInventoryMigration = async () => {
    if (inventoryMigrationPromise) {
        return inventoryMigrationPromise;
    }

    inventoryMigrationPromise = (async () => {
        const legacyDocs = await LegacyInventory.find({}).lean();
        if (legacyDocs.length === 0) {
            return;
        }

        for (const legacy of legacyDocs) {
            const item = await InventoryItem.findOneAndUpdate(
                { name: legacy.itemName, branch: legacy.branch || '' },
                {
                    $setOnInsert: {
                        name: legacy.itemName,
                        category: legacy.category || 'Uncategorized',
                        unit: legacy.unit || 'pcs',
                        lowStockThreshold: Number(legacy.reorderLevel || 0),
                        branch: legacy.branch || '',
                        createdBy: null,
                    },
                    $set: {
                        category: legacy.category || 'Uncategorized',
                        unit: legacy.unit || 'pcs',
                        lowStockThreshold: Number(legacy.reorderLevel || 0),
                    }
                },
                { upsert: true, new: true }
            );

            const existingBatch = await InventoryBatch.findOne({ legacyInventoryId: legacy._id });
            if (existingBatch) {
                continue;
            }

            const batch = new InventoryBatch({
                inventoryItem: item._id,
                brand: 'Unspecified',
                quantityReceived: Number(legacy.quantity || 0),
                quantityRemaining: Number(legacy.quantity || 0),
                expirationDate: null,
                receivedDate: legacy.createdAt || new Date(),
                supplierName: legacy.supplier || '',
                batchNumber: '',
                branch: legacy.branch || '',
                receivedBy: null,
                legacyInventoryId: legacy._id,
            });

            syncBatchStatus(batch);
            await saveInventoryBatchWithStockInNumber(batch);
        }
    })().catch((error) => {
        inventoryMigrationPromise = null;
        throw error;
    });

    return inventoryMigrationPromise;
};

const upsertInventoryItemForBatch = async (reqUser, payload) => {
    let inventoryItemId = payload.inventoryItem || payload.inventoryItemId || payload.itemId || '';
    let item;

    if (inventoryItemId) {
        item = await InventoryItem.findById(inventoryItemId);
    } else {
        const branch = reqUser.role === 'branch-manager'
            ? await getScopedInventoryBranch(reqUser)
            : (payload.branch || '');

        item = await InventoryItem.findOneAndUpdate(
            { name: (payload.name || payload.itemName || '').trim(), branch },
            {
                $setOnInsert: {
                    name: (payload.name || payload.itemName || '').trim(),
                    branch,
                    createdBy: reqUser.id || null,
                },
                $set: {
                    category: (payload.category || 'Uncategorized').trim(),
                    unit: (payload.unit || 'pcs').trim(),
                    lowStockThreshold: Number(payload.lowStockThreshold ?? payload.reorderLevel ?? payload.threshold ?? 0),
                }
            },
            { new: true, upsert: true }
        );
    }

    if (!item) {
        throw Object.assign(new Error('Inventory item category not found.'), { statusCode: 404 });
    }

    const scopedBranch = await getScopedInventoryBranch(reqUser);
    if (scopedBranch && item.branch !== scopedBranch) {
        throw Object.assign(new Error('Access denied. This item belongs to a different branch.'), { statusCode: 403 });
    }

    return item;
};

const normalizeInventoryText = (value) => String(value || '').trim();

const normalizeInventoryNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const validateInventoryPayload = (payload, { requireIdentity = true, requireBrand = true, requireQuantity = true } = {}) => {
    const errors = {};
    const hasExistingItem = !!(payload.inventoryItem || payload.inventoryItemId || payload.itemId);
    const itemName = normalizeInventoryText(payload.name || payload.itemName);
    const category = normalizeInventoryText(payload.category);
    const unit = normalizeInventoryText(payload.unit || 'pcs');
    const brand = normalizeInventoryText(payload.brand);
    const quantityReceived = normalizeInventoryNumber(payload.quantityReceived ?? payload.quantity ?? payload.currentStock);
    const lowStockThreshold = normalizeInventoryNumber(payload.lowStockThreshold ?? payload.reorderLevel ?? payload.threshold);

    if (requireIdentity && !hasExistingItem && !itemName) {
        errors.itemName = 'Item name is required.';
    }
    if (!hasExistingItem && !category) {
        errors.category = 'Category is required.';
    }
    if (!unit) {
        errors.unit = 'Unit is required.';
    }
    if (requireBrand && !brand) {
        errors.brand = 'Brand is required.';
    }
    if (requireQuantity && quantityReceived === null) {
        errors.quantity = 'Quantity is required.';
    } else if (quantityReceived !== null && quantityReceived < 0) {
        errors.quantity = 'Quantity cannot be negative.';
    }
    if (lowStockThreshold !== null && lowStockThreshold < 0) {
        errors.lowStockThreshold = 'Low stock threshold cannot be negative.';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        normalized: {
            itemName,
            category,
            unit,
            brand,
            quantityReceived,
            lowStockThreshold,
        },
    };
};

const createInventoryBatchRecord = async (reqUser, payload) => {
    const item = await upsertInventoryItemForBatch(reqUser, payload);
    const scopedBranch = await getScopedInventoryBranch(reqUser);
    const resolvedBranch = item.branch || payload.branch || scopedBranch || '';
    const quantityReceived = Number(payload.quantityReceived ?? payload.quantity ?? payload.currentStock ?? 0);
    const quantityRemaining = Number(payload.quantityRemaining ?? payload.quantity ?? payload.currentStock ?? quantityReceived);

    const batch = new InventoryBatch({
        inventoryItem: item._id,
        brand: (payload.brand || 'Unspecified').trim() || 'Unspecified',
        quantityReceived,
        quantityRemaining,
        expirationDate: payload.expirationDate || null,
        receivedDate: payload.receivedDate || new Date(),
        supplierName: (payload.supplierName || payload.supplier || '').trim(),
        batchNumber: (payload.batchNumber || '').trim(),
        branch: resolvedBranch,
        receivedBy: reqUser.id || null,
    });

    syncBatchStatus(batch);
    await saveInventoryBatchWithStockInNumber(batch);
    await batch.populate('inventoryItem');

    return batch;
};

const app = express();
const PORT = process.env.PORT || 5000;
const defaultJsonParser = express.json({ limit: '1mb' });
const defaultFormParser = express.urlencoded({ limit: '1mb', extended: true });
const largeJsonParser = express.json({ limit: '50mb' });
const isLargePayloadRoute = (req) => {
    if (req.method === 'POST' && /^\/api\/patients\/[^/]+\/radiographs$/.test(req.path)) {
        return true;
    }
    if (req.method === 'POST' && req.path === '/api/radiographs/enhance') {
        return true;
    }
    if (req.method === 'PUT' && req.path === '/api/system-config') {
        return true;
    }
    return false;
};

// Middleware
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://ngitify.com',
        'https://www.ngitify.com',
        'https://ngitify.netlify.app'
    ],
    credentials: true, 
};
app.use(helmet());
app.use(cors(corsOptions));
app.use((req, res, next) => {
    const parser = isLargePayloadRoute(req) ? largeJsonParser : defaultJsonParser;
    parser(req, res, next);
});
app.use(defaultFormParser);
app.use('/api', backupRoutes);
app.use('/api', integrityRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ Connected to Local MongoDB'))
.catch((err) => console.error('❌ Error connecting to MongoDB:', err));

// EMAIL CONFIG
const resend = new Resend(process.env.RESEND_API_KEY);
console.log('✅ Resend email client initialized');

mongoose.connection.once('open', async () => {
    await ensureInventoryBatchIndexes();
    await ensureInventoryStockInNumbers();
});

// ================= PUBLIC ROUTES ================= //

app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const { lockMinutes } = getActiveLoginLockState(normalizedEmail, req);
        if (lockMinutes > 0) {
            return res.status(429).json({
                message: `Too many login attempts. Please try again in ${lockMinutes} minute${lockMinutes === 1 ? '' : 's'}.`,
            });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            const failed = registerFailedLoginAttempt(normalizedEmail, req);
            return res.status(failed.lockMinutes > 0 ? 429 : 404).json({
                message: failed.lockMinutes > 0
                    ? `Too many login attempts. Please try again in ${failed.lockMinutes} minute${failed.lockMinutes === 1 ? '' : 's'}.`
                    : "Invalid email or password",
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            const failed = registerFailedLoginAttempt(normalizedEmail, req);
            return res.status(failed.lockMinutes > 0 ? 429 : 400).json({
                message: failed.lockMinutes > 0
                    ? `Too many login attempts. Please try again in ${failed.lockMinutes} minute${failed.lockMinutes === 1 ? '' : 's'}.`
                    : "Invalid email or password",
            });
        }

        clearLoginAttemptState(normalizedEmail, req);

        if (!user.isVerified) {
            return res.status(403).json({ message: "Account not verified. Please check your email." });
        }

        if (user.status === 'inactive') {
            return res.status(403).json({ message: "Your account is inactive. Please contact an administrator." });
        }

        const assignedBranch = user.assignedBranch || user.assignedBranches?.[0] || null;
        const assignedBranches = Array.isArray(user.assignedBranches)
            ? user.assignedBranches
            : (assignedBranch ? [assignedBranch] : []);

        // ✅ PHASE 3: Include isDentist flag for owner-role users
        const isDentist = user.role === 'owner' ? (user.isDentist || false) : undefined;

        const token = jwt.sign(
            { id: user._id, role: user.role, email: user.email, assignedBranch, assignedBranches, isDentist },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        await AuditLog.create({
            action: "LOGIN",
            user: user.email,
            role: user.role,
            details: `User logged in successfully.`
        });

        res.json({ token, role: user.role, userId: user._id, assignedBranch, assignedBranches, isDentist });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

app.get('/api/activate-account/:token', async (req, res) => {
    try {
        const { token } = req.params;
        if (!token) return res.status(400).json({ message: "No token provided." });

        const account = await User.findOne({ activationToken: token });

        if (!account) return res.status(400).json({ message: "Invalid or expired activation link." });

        res.json({
            message: 'Activation link is valid.',
            email: account.email,
            role: account.role,
        });
    } catch (error) {
        console.error("Activation validation error:", error);
        res.status(500).json({ message: "Server error during activation validation." });
    }
});

app.post('/api/activate-account', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token) return res.status(400).json({ message: "No token provided." });
        if (!newPassword) return res.status(400).json({ message: "A new password is required." });

        const passwordChecks = {
            length: newPassword.length >= 8,
            upper: /[A-Z]/.test(newPassword),
            lower: /[a-z]/.test(newPassword),
            number: /[0-9]/.test(newPassword),
            special: /[!@#$%^&*(),.?\":{}|<>]/.test(newPassword),
        };

        if (!Object.values(passwordChecks).every(Boolean)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
            });
        }

        const account = await User.findOne({ activationToken: token });

        if (!account) return res.status(400).json({ message: "Invalid or expired activation link." });

        account.isVerified = true;
        account.status = 'active';
        account.password = await bcrypt.hash(newPassword, 10);
        account.isPasswordChanged = true;
        account.temporaryPasswordExpires = null;
        account.resetPasswordOtp = undefined;
        account.resetPasswordExpires = undefined;
        if (account.assignedBranch && (!Array.isArray(account.assignedBranches) || account.assignedBranches.length === 0)) {
            account.assignedBranches = [account.assignedBranch];
        }
        if (!account.assignedBranch && Array.isArray(account.assignedBranches) && account.assignedBranches.length > 0) {
            account.assignedBranch = account.assignedBranches[0];
        }
        account.activationToken = undefined;
        await account.save();

        res.json({ 
            message: "Account activated successfully. Your password is now set.",
            role: account.role
        });
    } catch (error) {
        console.error("Activation error:", error);
        res.status(500).json({ message: "Server error during activation." });
    }
});

const getFrontendBaseUrl = () => String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
const getDentimeLogoUrl = () => `${getFrontendBaseUrl()}/logo.svg`;
const formatEmailDateLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'To be coordinated by the clinic';
    return date.toDateString();
};

const addDaysToDate = (value, days) => {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
};

const addMonthsToDate = (value, months) => {
    const date = new Date(value);
    date.setMonth(date.getMonth() + months);
    return date;
};

const toValidTreatmentLogs = (logs = []) => (
    (Array.isArray(logs) ? logs : [])
        .filter((log) => log?.date && !Number.isNaN(new Date(log.date).getTime()))
        .sort((left, right) => new Date(right.date) - new Date(left.date))
);

const buildDentimeEmailTemplate = ({
    clinic = {},
    title = '',
    intro = '',
    bodyHtml = '',
    ctaLabel = '',
    ctaUrl = '',
}) => {
    const clinicName = clinic.clinicName || 'Dentime Dental Clinic';
    const clinicContact = clinic.clinicContact || '-';
    const clinicEmail = clinic.clinicEmail || '-';
    const clinicAddress = clinic.clinicAddress || '-';

    return `
        <div style="margin:0;padding:24px;background:#eef7fb;font-family:Arial,sans-serif;color:#1f2937;">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #d9edf7;box-shadow:0 10px 28px rgba(1,83,139,0.08);">
                <div style="background:linear-gradient(135deg,#01538b 0%,#2dccf6 100%);padding:28px 28px 22px 28px;color:#ffffff;">
                    <img src="${getDentimeLogoUrl()}" alt="${clinicName}" style="width:64px;height:64px;display:block;margin-bottom:16px;background:#ffffff;border-radius:18px;padding:8px;" />
                    <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.92;margin-bottom:8px;">${clinicName}</div>
                    <h1 style="margin:0;font-size:28px;line-height:1.2;">${title}</h1>
                    ${intro ? `<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.92);">${intro}</p>` : ''}
                </div>
                <div style="padding:28px;">
                    ${bodyHtml}
                    ${ctaLabel && ctaUrl ? `
                        <div style="margin:24px 0 0 0;">
                            <a href="${ctaUrl}" style="display:inline-block;padding:13px 22px;background:#01538b;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;font-size:14px;">
                                ${ctaLabel}
                            </a>
                        </div>
                    ` : ''}
                </div>
                <div style="padding:22px 28px;background:#f8fcff;border-top:1px solid #d9edf7;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#01538b;margin-bottom:10px;">Clinic Contact Details</div>
                    <p style="margin:0 0 6px 0;"><strong>Clinic:</strong> ${clinicName}</p>
                    <p style="margin:0 0 6px 0;"><strong>Contact Number:</strong> ${clinicContact}</p>
                    <p style="margin:0 0 6px 0;"><strong>Email:</strong> ${clinicEmail}</p>
                    <p style="margin:0;"><strong>Address:</strong> ${clinicAddress}</p>
                </div>
            </div>
        </div>
    `;
};

const escapeHtml = (value = '') => String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character] || character));

const formatConfiguredEmailCopy = (value = '', fallback = '') => {
    const text = String(value || fallback || '').trim() || String(fallback || '').trim();
    if (!text) return '';
    return escapeHtml(text).replace(/\r?\n/g, '<br />');
};

const getSystemEmailTemplates = async () => (await getNormalizedSystemConfig()).emailTemplates;

const sendActivationEmail = async (email, role, tempPasswordOrActivationLink, activationLink = '', options = {}) => {
    const clinic = options?.clinic || await getClinicContactDetails();
    const emailTemplates = await getSystemEmailTemplates();
    const activationCopy = formatConfiguredEmailCopy(
        emailTemplates?.activation,
        DEFAULT_SYSTEM_EMAIL_TEMPLATES.activation
    );
    const resolvedActivationLink = activationLink || tempPasswordOrActivationLink || '';
    const procedureSummary = options?.procedure
        ? `
                <div style="background:#f7fbfe;border:1px solid #d9edf7;border-radius:18px;padding:18px;margin:18px 0;">
                    ${options?.branch ? `<p style="margin:0 0 8px 0;"><strong>Branch:</strong> ${options.branch}</p>` : ''}
                    <p style="margin:0;"><strong>Procedure:</strong> ${options.procedure}</p>
                </div>
        `
        : '';
    const closingMessage = options?.closingMessage
        || 'If you have questions, you may contact the clinic through the details below.';

    await resend.emails.send({
        from: 'NgitiFy Admin <noreply@ngitify.com>',
        to: email,
        subject: 'Welcome to NgitiFy! Activate Your Account',
        html: buildDentimeEmailTemplate({
            clinic,
            title: 'Welcome to NgitiFy',
            intro: 'Please activate your account and create your password to continue.',
            bodyHtml: `
                <p style="margin:0 0 14px 0;">Hello,</p>
                ${activationCopy ? `<p style="margin:0 0 14px 0;">${activationCopy}</p>` : ''}
                <p style="margin:0 0 14px 0;">Your <strong>${role}</strong> account has been successfully created.</p>
                ${procedureSummary}
                <p style="margin:0 0 14px 0;">Use the button below to verify your email address and set your own password.</p>
                <p style="margin:0;">${closingMessage}</p>
            `,
            ctaLabel: 'Activate Account',
            ctaUrl: resolvedActivationLink,
        }),
    });
};

const TEMP_PASSWORD_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const hasExpiredTemporaryPassword = (account = {}) => {
    if (account?.isPasswordChanged) return false;
    if (!account?.temporaryPasswordExpires) return false;

    const expiresAt = new Date(account.temporaryPasswordExpires);
    if (Number.isNaN(expiresAt.getTime())) return false;

    return Date.now() > expiresAt.getTime();
};

const issueTemporaryPasswordForAccount = async (account) => {
    const tempPassword = crypto.randomBytes(4).toString('hex');
    account.password = await bcrypt.hash(tempPassword, 10);
    account.isPasswordChanged = false;
    account.temporaryPasswordExpires = new Date(Date.now() + TEMP_PASSWORD_EXPIRY_MS);
    account.resetPasswordOtp = undefined;
    account.resetPasswordExpires = undefined;

    return {
        tempPassword,
        temporaryPasswordExpires: account.temporaryPasswordExpires,
    };
};

const issueActivationSetupForAccount = async (account) => {
    const seededPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    const activationToken = crypto.randomBytes(32).toString('hex');
    account.password = seededPassword;
    account.activationToken = activationToken;
    account.isVerified = false;
    account.status = 'inactive';
    account.isPasswordChanged = false;
    account.temporaryPasswordExpires = null;
    account.resetPasswordOtp = undefined;
    account.resetPasswordExpires = undefined;

    return {
        activationToken,
        activationLink: `${process.env.FRONTEND_URL}/activate-account/${activationToken}`,
    };
};

const sendAccessReissueEmail = async (email, role, tempPassword, activationLink = '', options = {}) => {
    const clinic = options?.clinic || await getClinicContactDetails();
    const needsActivation = Boolean(activationLink);
    const procedureSummary = options?.procedure
        ? `
                <div style="background:#f7fbfe;border:1px solid #d9edf7;border-radius:18px;padding:18px;margin:18px 0;">
                    ${options?.branch ? `<p style="margin:0 0 8px 0;"><strong>Branch:</strong> ${options.branch}</p>` : ''}
                    <p style="margin:0;"><strong>Procedure:</strong> ${options.procedure}</p>
                </div>
        `
        : '';
    const closingMessage = options?.closingMessage
        || 'If you have questions, you may contact the clinic through the details below.';

    await resend.emails.send({
        from: 'NgitiFy Admin <noreply@ngitify.com>',
        to: email,
        subject: needsActivation
            ? 'NgitiFy Access Reissued - Set Your Password'
            : 'NgitiFy Access Reissued',
        html: buildDentimeEmailTemplate({
            clinic,
            title: 'Access Reissued',
            intro: needsActivation
                ? 'An administrator reissued your account access. Please activate your account again and create a new password.'
                : 'An administrator reissued your account access. Please use the button below to create a new password.',
            bodyHtml: `
                <p style="margin:0 0 14px 0;">Hello,</p>
                <p style="margin:0 0 14px 0;">Your <strong>${role}</strong> account access has been reissued.</p>
                ${procedureSummary}
                <p style="margin:0 0 14px 0;">Use the button below to verify your email and set a fresh password.</p>
                <p style="margin:0;">${closingMessage}</p>
            `,
            ctaLabel: activationLink ? 'Set Password' : '',
            ctaUrl: activationLink,
        }),
    });
};

const PRIVACY_POLICY_VERSION = 'v1.0';
const DEFAULT_DIRECT_BOOKING_PROCEDURE = 'General Check-up / Initial Consultation';
const DIRECT_BOOKING_PROCEDURES = [
    DEFAULT_DIRECT_BOOKING_PROCEDURE,
    'Prophylaxis / Dental Cleaning',
];
const LEGACY_DEFAULT_CLINIC_PROCEDURES = [
    ...DIRECT_BOOKING_PROCEDURES,
    'Oral Prophylaxis (Teeth Cleaning)',
    'Fluoride Application',
    'Root Canal Treatment',
    'Teeth Whitening',
    'Tooth Restoration/Filling (Pasta)',
    'Pit and Fissure Sealant Application',
    'Tooth Extraction (Bunot)',
    'Odontectomy (Wisdom Tooth Removal)',
    'Orthodontics (Braces)',
    'Dentures/Crowns',
    'Retainers',
];
const DEFAULT_CLINIC_PROCEDURES = [
    ...DIRECT_BOOKING_PROCEDURES,
    'Oral Prophylaxis / Teeth Cleaning',
    'Periodontal Therapy',
    'Fluoride Application (with Free Cleaning)',
    'Pit and Fissure Sealant',
    'Metal Braces',
    'Ceramic Braces',
    'Self-Ligating Braces',
    'Digital Periapical X-Ray',
    'Fixed Partial Denture (Crown, Bridge, Inlay and Onlay)',
    'Removable Partial and Full Denture',
    'Root Canal Treatment',
    'Fiber Post Core',
    'Teeth Whitening',
    'Composite Filling/Bonding',
    'Composite Veneer/Direct Veneer',
    'Indirect Veneer',
    'Direct and Indirect Pulp Capping',
    'Tooth Extraction (Bunot)',
    'Odontectomy (Wisdom Tooth Removal)',
    'Pediatric Oral Prophylaxis',
    'Pediatric Fluoride Application',
    'Pediatric Pit and Fissure Sealants',
    'Pulpectomy',
    'Pulpotomy',
    'Crowns/Caps',
    'Anterior Veneers',
    'Composite Tooth Restoration',
];
const DEFAULT_ALLOWED_TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const DEFAULT_SYSTEM_FEATURE_TOGGLES = {
    queueManagement: true,
    radiographUploads: true,
    sessionTimeout: true,
};
const DEFAULT_SYSTEM_EMAIL_TEMPLATES = {
    activation: 'Your Dentime Dental Clinic account is ready. Please activate it to continue.',
    appointmentReminder: 'This is a reminder for your upcoming appointment at Dentime Dental Clinic.',
};
const SYSTEM_FEATURE_DISABLED_MESSAGES = {
    queueManagement: 'Queue management is currently disabled in System Configuration.',
    radiographUploads: 'Radiograph uploads are currently disabled in System Configuration.',
    sessionTimeout: 'Session timeout is currently disabled in System Configuration.',
};
const AUTO_CANCELLATION_REASON = 'Auto-cancelled: patient did not check in within 15 minutes of the appointment time.';
const APPOINTMENT_CHECKIN_GRACE_MINUTES = 15;
const PREDICTIVE_VISIT_DEFAULT_MONTHS = 6;
const PREDICTIVE_VISIT_WINDOW_DAYS = 7;
const PREDICTIVE_VISIT_DUE_SOON_DAYS = 14;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const IN_CLINIC_COMPLETION_REMINDER_MS = DAY_IN_MS;

const getAppointmentGraceDeadline = (appointment) => {
    if (!appointment?.date || !appointment?.time) return null;

    const baseDate = new Date(appointment.date);
    if (Number.isNaN(baseDate.getTime())) return null;

    const normalizedTime = String(appointment.time).trim();
    const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/);
    if (!timeMatch) return null;

    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const meridiem = timeMatch[3] ? timeMatch[3].toUpperCase() : '';

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

    if (meridiem) {
        if (hours === 12) hours = 0;
        if (meridiem === 'PM') hours += 12;
    }

    const scheduledDateTime = new Date(baseDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);
    if (Number.isNaN(scheduledDateTime.getTime())) return null;

    return new Date(scheduledDateTime.getTime() + (APPOINTMENT_CHECKIN_GRACE_MINUTES * 60 * 1000));
};

const normalizeCurrencyAmount = (value) => {
    if (value === '' || value === null || value === undefined) return 0;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) return null;
    return Number(numericValue.toFixed(2));
};

const GUEST_FULL_NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{1,99}$/;
const GUEST_PERSON_NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{0,49}$/;
const PATIENT_PERSON_NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]{0,69}$/;
const GUEST_PHONE_REGEX = /^9\d{9}$/;
const GUEST_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cloneWebsiteContentDefaults = () => JSON.parse(JSON.stringify(defaultWebsiteContent));

const toTitleCasePersonName = (value = '') => value
    .toLowerCase()
    .replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());

const normalizePersonName = (value = '') => {
    const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
    return normalized ? toTitleCasePersonName(normalized) : '';
};

const getInvalidPersonNameMessage = (entries = []) => {
    for (const [label, value, required = false] of entries) {
        const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
        if (!normalized) {
            if (required) return `${label} is required.`;
            continue;
        }
        if (!PATIENT_PERSON_NAME_REGEX.test(normalized)) {
            return `Please enter a valid ${label.toLowerCase()}.`;
        }
    }
    return '';
};

const normalizeProcedureList = (procedures = []) => {
    const seen = new Set();
    return procedures
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .filter((entry) => {
            const key = entry.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const normalizeTimeSlotList = (slots = []) => Array.from(
    new Set(
        (Array.isArray(slots) ? slots : [])
            .map((entry) => String(entry || '').trim())
            .filter((entry) => /^\d{2}:\d{2}$/.test(entry))
    )
).sort();

const normalizeIntegerInRange = (value, { fallback, min, max }) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return fallback;
    const roundedValue = Math.round(numericValue);
    return Math.min(Math.max(roundedValue, min), max);
};

const normalizeBooleanValue = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }
    if (value === undefined || value === null) return fallback;
    return Boolean(value);
};

const normalizeEmailTemplateMap = (templates = {}) => ({
    activation: String(templates?.activation || DEFAULT_SYSTEM_EMAIL_TEMPLATES.activation).trim()
        || DEFAULT_SYSTEM_EMAIL_TEMPLATES.activation,
    appointmentReminder: String(templates?.appointmentReminder || DEFAULT_SYSTEM_EMAIL_TEMPLATES.appointmentReminder).trim()
        || DEFAULT_SYSTEM_EMAIL_TEMPLATES.appointmentReminder,
});

const normalizeFeatureToggleMap = (featureToggles = {}) => ({
    queueManagement: normalizeBooleanValue(featureToggles?.queueManagement, DEFAULT_SYSTEM_FEATURE_TOGGLES.queueManagement),
    radiographUploads: normalizeBooleanValue(featureToggles?.radiographUploads, DEFAULT_SYSTEM_FEATURE_TOGGLES.radiographUploads),
    sessionTimeout: normalizeBooleanValue(featureToggles?.sessionTimeout, DEFAULT_SYSTEM_FEATURE_TOGGLES.sessionTimeout),
});

const normalizeRequiredText = (value, fallback = '') => {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
};

const normalizeStringList = (entries = [], fallback = []) => {
    const normalized = (Array.isArray(entries) ? entries : [])
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean);

    return normalized.length > 0 ? normalized : [...fallback];
};

const WEBSITE_MEDIA_FIELDS = [
    'logoUrl',
    'logoIconUrl',
    'homeHeroImageUrl',
    'homeIntroImageUrl',
    'homeJourneyImageUrl',
    'aboutHeroImageUrl',
    'servicesHeroImageUrl',
    'locationsHeroImageUrl',
    'locationCardImageUrl',
    'contactHeroImageUrl',
    'contactPhoneImageUrl',
    'contactFacebookImageUrl',
    'contactInstagramImageUrl',
    'contactMapImageUrl',
    'appointmentHeroImageUrl',
    'appointmentGuideImageUrl',
    'appointmentBranchImageUrl',
];

const normalizeWebsiteMedia = (media = {}) => {
    const normalized = {};
    WEBSITE_MEDIA_FIELDS.forEach((field) => {
        normalized[field] = String(media?.[field] || '').trim();
    });
    normalized.aboutHighlightImageUrls = normalizeStringList(media?.aboutHighlightImageUrls, []).slice(0, 12);
    return normalized;
};

const cloneServiceHighlightList = (services = []) => services.map((service) => ({
    category: String(service?.category ?? '').trim(),
    description: String(service?.description ?? '').trim(),
    imageUrl: String(service?.imageUrl || '').trim(),
    items: Array.isArray(service?.items) ? [...service.items] : [],
}));

const LEGACY_DEFAULT_SERVICE_HIGHLIGHTS = [
    {
        category: 'General Dentistry',
        description: 'Routine and restorative care for day-to-day dental health.',
        items: [
            'Free consultation',
            'Free digital X-ray',
            'Oral prophylaxis (teeth cleaning)',
            'Fluoride application',
            'Tooth restoration / filling',
            'Pit and fissure sealant',
            'Root canal treatment',
            'Dentures / crowns',
        ],
    },
    {
        category: 'Orthodontics',
        description: 'Treatment options for bite alignment and smile correction.',
        items: [
            'Braces',
            'Retainers',
            'Orthodontic follow-up care',
        ],
    },
    {
        category: 'Esthetics',
        description: 'Smile-focused services for brighter, more confident results.',
        items: [
            'Teeth whitening',
            'Smile-enhancing treatment planning',
        ],
    },
    {
        category: 'Oral Surgery',
        description: 'Treatment support for extraction and surgical dental needs.',
        items: [
            'Tooth extraction',
            'Odontectomy (wisdom tooth removal)',
        ],
    },
];

const normalizeComparisonStringList = (entries = []) => normalizeStringList(entries, []).map((entry) => entry.toLowerCase());

const matchesStringList = (value = [], expected = []) => {
    const normalizedValue = normalizeComparisonStringList(value);
    const normalizedExpected = normalizeComparisonStringList(expected);

    return normalizedValue.length === normalizedExpected.length
        && normalizedValue.every((entry, index) => entry === normalizedExpected[index]);
};

const matchesServiceHighlightList = (value = [], expected = []) => {
    const normalizedValue = cloneServiceHighlightList(value);
    const normalizedExpected = cloneServiceHighlightList(expected);

    if (normalizedValue.length !== normalizedExpected.length) {
        return false;
    }

    return normalizedValue.every((service, index) => (
        service.category.toLowerCase() === normalizedExpected[index].category.toLowerCase()
        && service.description.toLowerCase() === normalizedExpected[index].description.toLowerCase()
        && matchesStringList(service.items, normalizedExpected[index].items)
    ));
};

const normalizeServiceHighlightList = (services = [], fallback = []) => {
    const normalized = (Array.isArray(services) ? services : [])
        .map((service, index) => {
            const fallbackService = fallback[index] || { category: '', description: '', items: [] };
            const items = normalizeStringList(service?.items, fallbackService.items || []);
            return {
                category: normalizeRequiredText(service?.category, fallbackService.category || ''),
                description: normalizeRequiredText(service?.description, fallbackService.description || ''),
                imageUrl: String(service?.imageUrl || '').trim(),
                items,
            };
        })
        .filter((service) => service.category || service.description || service.items.length > 0);

    return normalized.length > 0 ? normalized : cloneServiceHighlightList(fallback);
};

const normalizeWebsiteContent = (content = {}) => {
    const fallback = cloneWebsiteContentDefaults();
    const resolvedContent = matchesServiceHighlightList(content?.serviceHighlights, LEGACY_DEFAULT_SERVICE_HIGHLIGHTS)
        ? { ...content, serviceHighlights: fallback.serviceHighlights }
        : content;

    return {
        branding: {
            tagline: normalizeRequiredText(resolvedContent?.branding?.tagline, fallback.branding.tagline),
            owner: normalizeRequiredText(resolvedContent?.branding?.owner, fallback.branding.owner),
            facebookUrl: normalizeRequiredText(resolvedContent?.branding?.facebookUrl, fallback.branding.facebookUrl),
            facebookName: normalizeRequiredText(resolvedContent?.branding?.facebookName, fallback.branding.facebookName),
            instagramHandle: normalizeRequiredText(
                String(resolvedContent?.branding?.instagramHandle ?? '').replace(/^@+/, ''),
                fallback.branding.instagramHandle
            ),
        },
        home: {
            heroEyebrow: normalizeRequiredText(resolvedContent?.home?.heroEyebrow, fallback.home.heroEyebrow),
            heroTitleLead: normalizeRequiredText(resolvedContent?.home?.heroTitleLead, fallback.home.heroTitleLead),
            heroTitleAccent: normalizeRequiredText(resolvedContent?.home?.heroTitleAccent, fallback.home.heroTitleAccent),
            heroDescription: normalizeRequiredText(resolvedContent?.home?.heroDescription, fallback.home.heroDescription),
            primaryCtaLabel: normalizeRequiredText(resolvedContent?.home?.primaryCtaLabel, fallback.home.primaryCtaLabel),
            secondaryCtaLabel: normalizeRequiredText(resolvedContent?.home?.secondaryCtaLabel, fallback.home.secondaryCtaLabel),
            introKicker: normalizeRequiredText(resolvedContent?.home?.introKicker, fallback.home.introKicker),
            introDescription: normalizeRequiredText(resolvedContent?.home?.introDescription, fallback.home.introDescription),
            quoteText: normalizeRequiredText(resolvedContent?.home?.quoteText, fallback.home.quoteText),
            quoteMeta: normalizeRequiredText(resolvedContent?.home?.quoteMeta, fallback.home.quoteMeta),
            quickVisitEyebrow: normalizeRequiredText(resolvedContent?.home?.quickVisitEyebrow, fallback.home.quickVisitEyebrow),
            quickVisitTitle: normalizeRequiredText(resolvedContent?.home?.quickVisitTitle, fallback.home.quickVisitTitle),
            quickVisitCtaLabel: normalizeRequiredText(resolvedContent?.home?.quickVisitCtaLabel, fallback.home.quickVisitCtaLabel),
            editorialMiniCopy: normalizeRequiredText(resolvedContent?.home?.editorialMiniCopy, fallback.home.editorialMiniCopy),
            editorialTitle: normalizeRequiredText(resolvedContent?.home?.editorialTitle, fallback.home.editorialTitle),
            editorialDescription: normalizeRequiredText(resolvedContent?.home?.editorialDescription, fallback.home.editorialDescription),
            coreCareAreasLabel: normalizeRequiredText(resolvedContent?.home?.coreCareAreasLabel, fallback.home.coreCareAreasLabel),
            coreCareAreasDescription: normalizeRequiredText(resolvedContent?.home?.coreCareAreasDescription, fallback.home.coreCareAreasDescription),
            activeBranchesLabel: normalizeRequiredText(resolvedContent?.home?.activeBranchesLabel, fallback.home.activeBranchesLabel),
            activeBranchesDescription: normalizeRequiredText(resolvedContent?.home?.activeBranchesDescription, fallback.home.activeBranchesDescription),
            editorialStatement: normalizeRequiredText(resolvedContent?.home?.editorialStatement, fallback.home.editorialStatement),
            servicesEyebrow: normalizeRequiredText(resolvedContent?.home?.servicesEyebrow, fallback.home.servicesEyebrow),
            servicesTitle: normalizeRequiredText(resolvedContent?.home?.servicesTitle, fallback.home.servicesTitle),
            servicesCtaLabel: normalizeRequiredText(resolvedContent?.home?.servicesCtaLabel, fallback.home.servicesCtaLabel),
            journeyEyebrow: normalizeRequiredText(resolvedContent?.home?.journeyEyebrow, fallback.home.journeyEyebrow),
            journeyTitle: normalizeRequiredText(resolvedContent?.home?.journeyTitle, fallback.home.journeyTitle),
            journeyPills: normalizeStringList(resolvedContent?.home?.journeyPills, fallback.home.journeyPills),
            journeyCardTitle: normalizeRequiredText(resolvedContent?.home?.journeyCardTitle, fallback.home.journeyCardTitle),
            journeyDescription: normalizeRequiredText(resolvedContent?.home?.journeyDescription, fallback.home.journeyDescription),
            journeyHighlights: normalizeStringList(resolvedContent?.home?.journeyHighlights, fallback.home.journeyHighlights),
            journeyCaption: normalizeRequiredText(resolvedContent?.home?.journeyCaption, fallback.home.journeyCaption),
        },
        about: {
            eyebrow: normalizeRequiredText(resolvedContent?.about?.eyebrow, fallback.about.eyebrow),
            title: normalizeRequiredText(resolvedContent?.about?.title, fallback.about.title),
            description: normalizeRequiredText(resolvedContent?.about?.description, fallback.about.description),
            highlightCardTitle: normalizeRequiredText(resolvedContent?.about?.highlightCardTitle, fallback.about.highlightCardTitle),
            highlights: normalizeStringList(resolvedContent?.about?.highlights, fallback.about.highlights),
        },
        servicesPage: {
            eyebrow: normalizeRequiredText(resolvedContent?.servicesPage?.eyebrow, fallback.servicesPage.eyebrow),
            title: normalizeRequiredText(resolvedContent?.servicesPage?.title, fallback.servicesPage.title),
            description: normalizeRequiredText(resolvedContent?.servicesPage?.description, fallback.servicesPage.description),
        },
        serviceHighlights: normalizeServiceHighlightList(resolvedContent?.serviceHighlights, fallback.serviceHighlights),
        locationsPage: {
            eyebrow: normalizeRequiredText(resolvedContent?.locationsPage?.eyebrow, fallback.locationsPage.eyebrow),
            title: normalizeRequiredText(resolvedContent?.locationsPage?.title, fallback.locationsPage.title),
            description: normalizeRequiredText(resolvedContent?.locationsPage?.description, fallback.locationsPage.description),
            bookCtaLabel: normalizeRequiredText(resolvedContent?.locationsPage?.bookCtaLabel, fallback.locationsPage.bookCtaLabel),
            callCtaLabel: normalizeRequiredText(resolvedContent?.locationsPage?.callCtaLabel, fallback.locationsPage.callCtaLabel),
            mapCtaLabel: normalizeRequiredText(resolvedContent?.locationsPage?.mapCtaLabel, fallback.locationsPage.mapCtaLabel),
        },
        contactPage: {
            eyebrow: normalizeRequiredText(resolvedContent?.contactPage?.eyebrow, fallback.contactPage.eyebrow),
            title: normalizeRequiredText(resolvedContent?.contactPage?.title, fallback.contactPage.title),
            description: normalizeRequiredText(resolvedContent?.contactPage?.description, fallback.contactPage.description),
            primaryCtaLabel: normalizeRequiredText(resolvedContent?.contactPage?.primaryCtaLabel, fallback.contactPage.primaryCtaLabel),
            secondaryCtaLabel: normalizeRequiredText(resolvedContent?.contactPage?.secondaryCtaLabel, fallback.contactPage.secondaryCtaLabel),
            phoneCardTitle: normalizeRequiredText(resolvedContent?.contactPage?.phoneCardTitle, fallback.contactPage.phoneCardTitle),
            phoneCardCtaLabel: normalizeRequiredText(resolvedContent?.contactPage?.phoneCardCtaLabel, fallback.contactPage.phoneCardCtaLabel),
            facebookCardTitle: normalizeRequiredText(resolvedContent?.contactPage?.facebookCardTitle, fallback.contactPage.facebookCardTitle),
            facebookCardCtaLabel: normalizeRequiredText(resolvedContent?.contactPage?.facebookCardCtaLabel, fallback.contactPage.facebookCardCtaLabel),
            instagramCardTitle: normalizeRequiredText(resolvedContent?.contactPage?.instagramCardTitle, fallback.contactPage.instagramCardTitle),
            instagramCardCtaLabel: normalizeRequiredText(resolvedContent?.contactPage?.instagramCardCtaLabel, fallback.contactPage.instagramCardCtaLabel),
            locationPrimaryCtaLabel: normalizeRequiredText(resolvedContent?.contactPage?.locationPrimaryCtaLabel, fallback.contactPage.locationPrimaryCtaLabel),
            locationSecondaryCtaLabel: normalizeRequiredText(resolvedContent?.contactPage?.locationSecondaryCtaLabel, fallback.contactPage.locationSecondaryCtaLabel),
        },
        media: normalizeWebsiteMedia(resolvedContent?.media),
        appointmentPage: {
            eyebrow: normalizeRequiredText(resolvedContent?.appointmentPage?.eyebrow, fallback.appointmentPage.eyebrow),
            title: normalizeRequiredText(resolvedContent?.appointmentPage?.title, fallback.appointmentPage.title),
            description: normalizeRequiredText(resolvedContent?.appointmentPage?.description, fallback.appointmentPage.description),
            facebookCtaLabel: normalizeRequiredText(resolvedContent?.appointmentPage?.facebookCtaLabel, fallback.appointmentPage.facebookCtaLabel),
            callCtaLabel: normalizeRequiredText(resolvedContent?.appointmentPage?.callCtaLabel, fallback.appointmentPage.callCtaLabel),
            formEyebrow: normalizeRequiredText(resolvedContent?.appointmentPage?.formEyebrow, fallback.appointmentPage.formEyebrow),
            formTitle: normalizeRequiredText(resolvedContent?.appointmentPage?.formTitle, fallback.appointmentPage.formTitle),
            formDescription: normalizeRequiredText(resolvedContent?.appointmentPage?.formDescription, fallback.appointmentPage.formDescription),
            procedureHelperText: normalizeRequiredText(resolvedContent?.appointmentPage?.procedureHelperText, fallback.appointmentPage.procedureHelperText),
            notesHelperText: normalizeRequiredText(resolvedContent?.appointmentPage?.notesHelperText, fallback.appointmentPage.notesHelperText),
            submitButtonLabel: normalizeRequiredText(resolvedContent?.appointmentPage?.submitButtonLabel, fallback.appointmentPage.submitButtonLabel),
            submittingButtonLabel: normalizeRequiredText(resolvedContent?.appointmentPage?.submittingButtonLabel, fallback.appointmentPage.submittingButtonLabel),
            guideEyebrow: normalizeRequiredText(resolvedContent?.appointmentPage?.guideEyebrow, fallback.appointmentPage.guideEyebrow),
            guideTitle: normalizeRequiredText(resolvedContent?.appointmentPage?.guideTitle, fallback.appointmentPage.guideTitle),
            steps: normalizeStringList(resolvedContent?.appointmentPage?.steps, fallback.appointmentPage.steps),
            branchEyebrow: normalizeRequiredText(resolvedContent?.appointmentPage?.branchEyebrow, fallback.appointmentPage.branchEyebrow),
            branchTitle: normalizeRequiredText(resolvedContent?.appointmentPage?.branchTitle, fallback.appointmentPage.branchTitle),
        },
    };
};

const normalizeOnlineBookingProcedures = ({ clinicProcedures = [], onlineBookingProcedures = [] }) => {
    const clinicProcedureMap = new Map(
        clinicProcedures.map((procedure) => [String(procedure || '').trim().toLowerCase(), procedure])
    );

    const requestedProcedures = normalizeProcedureList(
        Array.isArray(onlineBookingProcedures) && onlineBookingProcedures.length
            ? onlineBookingProcedures
            : DIRECT_BOOKING_PROCEDURES
    );

    const matchedRequestedProcedures = requestedProcedures
        .map((procedure) => clinicProcedureMap.get(String(procedure || '').trim().toLowerCase()) || null)
        .filter(Boolean);

    if (matchedRequestedProcedures.length > 0) {
        return matchedRequestedProcedures;
    }

    const fallbackProcedures = DIRECT_BOOKING_PROCEDURES
        .map((procedure) => clinicProcedureMap.get(String(procedure || '').trim().toLowerCase()) || null)
        .filter(Boolean);

    if (fallbackProcedures.length > 0) {
        return fallbackProcedures;
    }

    return clinicProcedures.slice(0, 2);
};

const normalizeSystemConfigPayload = (source = {}) => {
    const rawClinicProcedures = Array.isArray(source?.clinicProcedures) && source.clinicProcedures.length
        ? source.clinicProcedures
        : DEFAULT_CLINIC_PROCEDURES;
    const clinicProcedures = normalizeProcedureList(
        matchesStringList(rawClinicProcedures, LEGACY_DEFAULT_CLINIC_PROCEDURES)
            ? DEFAULT_CLINIC_PROCEDURES
            : rawClinicProcedures
    );
    const allowedTimeSlots = normalizeTimeSlotList(
        Array.isArray(source?.allowedTimeSlots) && source.allowedTimeSlots.length
            ? source.allowedTimeSlots
            : DEFAULT_ALLOWED_TIME_SLOTS
    );

    return {
        clinicName: String(source?.clinicName || 'Dentime Dental Clinic').trim() || 'Dentime Dental Clinic',
        clinicLogo: String(source?.clinicLogo || '').trim(),
        clinicContact: String(source?.clinicContact || '').trim(),
        clinicAddress: String(source?.clinicAddress || '').trim(),
        clinicEmail: String(source?.clinicEmail || '').trim(),
        maxAppointmentsPerDay: normalizeIntegerInRange(source?.maxAppointmentsPerDay, {
            fallback: 20,
            min: 1,
            max: 200,
        }),
        allowedTimeSlots: allowedTimeSlots.length > 0 ? allowedTimeSlots : [...DEFAULT_ALLOWED_TIME_SLOTS],
        clinicProcedures: clinicProcedures.length > 0 ? clinicProcedures : [...DEFAULT_CLINIC_PROCEDURES],
        onlineBookingProcedures: normalizeOnlineBookingProcedures({
            clinicProcedures: clinicProcedures.length > 0 ? clinicProcedures : [...DEFAULT_CLINIC_PROCEDURES],
            onlineBookingProcedures: source?.onlineBookingProcedures,
        }),
        emailTemplates: normalizeEmailTemplateMap(source?.emailTemplates),
        featureToggles: normalizeFeatureToggleMap(source?.featureToggles),
        websiteContent: normalizeWebsiteContent(source?.websiteContent),
        sessionTimeoutMinutes: normalizeIntegerInRange(source?.sessionTimeoutMinutes, {
            fallback: 30,
            min: 5,
            max: 240,
        }),
        updatedBy: String(source?.updatedBy || '').trim(),
    };
};

const normalizeSystemConfigResponse = (source = {}) => {
    const normalized = normalizeSystemConfigPayload(
        typeof source?.toObject === 'function' ? source.toObject() : source
    );
    return {
        ...normalized,
        _id: source?._id || undefined,
        createdAt: source?.createdAt || undefined,
        updatedAt: source?.updatedAt || undefined,
    };
};

const getOrCreateSystemConfig = async () => {
    let config = await SystemConfig.findOne();
    if (!config) {
        config = await SystemConfig.create({});
    }
    return config;
};

const getNormalizedSystemConfig = async () => normalizeSystemConfigResponse(await getOrCreateSystemConfig());

const getClinicAllowedSlots = async () => (await getNormalizedSystemConfig()).allowedTimeSlots;

const getClinicMaxAppointmentsPerDay = async () => (await getNormalizedSystemConfig()).maxAppointmentsPerDay;

const getClinicProcedureCatalog = async () => (await getNormalizedSystemConfig()).clinicProcedures;

const getOnlineBookingProcedures = async () => (await getNormalizedSystemConfig()).onlineBookingProcedures;

const getSystemFeatureToggles = async () => (await getNormalizedSystemConfig()).featureToggles;

const isSystemFeatureEnabled = async (featureKey) => {
    const featureToggles = await getSystemFeatureToggles();
    return featureToggles?.[featureKey] !== false;
};

const assertSystemFeatureEnabled = async (res, featureKey) => {
    if (await isSystemFeatureEnabled(featureKey)) {
        return true;
    }
    res.status(503).json({
        message: SYSTEM_FEATURE_DISABLED_MESSAGES[featureKey] || 'This feature is currently disabled in System Configuration.',
    });
    return false;
};

const isClinicProcedureAllowed = async (procedure = '') => {
    const normalizedProcedure = String(procedure || '').trim().toLowerCase();
    if (!normalizedProcedure) return false;
    const procedures = await getClinicProcedureCatalog();
    return procedures.some((entry) => String(entry || '').trim().toLowerCase() === normalizedProcedure);
};

const isOnlineBookingProcedureAllowed = async (procedure = '') => {
    const normalizedProcedure = String(procedure || '').trim().toLowerCase();
    if (!normalizedProcedure) return false;
    const procedures = await getOnlineBookingProcedures();
    return procedures.some((entry) => String(entry || '').trim().toLowerCase() === normalizedProcedure);
};

const MANILA_TIME_ZONE = 'Asia/Manila';

const getManilaDateParts = (value = new Date()) => Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
        timeZone: MANILA_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(new Date(value)).map((part) => [part.type, part.value])
);

const getManilaDateKey = (value = new Date()) => {
    const parts = getManilaDateParts(value);
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const getManilaWeekday = (value) => new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    weekday: 'short',
}).format(new Date(value));

const parseScheduleDateKey = (dateKey, time = '12:00') => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '').trim())) return null;
    if (!/^\d{2}:\d{2}$/.test(String(time || '').trim())) return null;
    const parsed = new Date(`${dateKey}T${time}:00+08:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getScheduleDateTime = (appointment) => {
    if (!appointment?.date || !appointment?.time) return null;

    const dateKey = getManilaDateKey(appointment.date);
    const normalizedTime = String(appointment.time || '').trim();
    const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/);
    if (!timeMatch) return null;

    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const meridiem = timeMatch[3] ? timeMatch[3].toUpperCase() : '';

    if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes > 59) return null;
    if (hours === 24 && minutes === 0 && !meridiem) hours = 0;
    if (hours < 0 || hours > 23 || (meridiem && hours > 12)) return null;

    if (meridiem) {
        if (hours === 12) hours = 0;
        if (meridiem === 'PM') hours += 12;
    }

    return parseScheduleDateKey(
        dateKey,
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    );
};

const timeToMinutes = (time = '') => {
    const [hourText, minuteText] = String(time || '').split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return (hour * 60) + minute;
};

const getBookableAllowedSlotsForDate = ({ date, allowedSlots = [], leadMinutes = 30 }) => {
    const dateKey = typeof date === 'string' ? String(date || '').trim() : getManilaDateKey(date);
    const safeSlots = Array.isArray(allowedSlots) ? allowedSlots.filter(Boolean) : [];
    if (!dateKey || safeSlots.length === 0) return [];

    const nowParts = getManilaDateParts(new Date());
    const todayKey = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
    if (dateKey !== todayKey) return safeSlots;

    const cutoffMinutes = (Number(nowParts.hour) * 60) + Number(nowParts.minute) + leadMinutes;
    return safeSlots.filter((slot) => {
        const slotMinutes = timeToMinutes(slot);
        return slotMinutes !== null && slotMinutes > cutoffMinutes;
    });
};

const validateBookableAppointmentSlot = async ({
    date,
    time,
    branch = '',
    excludeAppointmentId = '',
    allowCurrentSlot = false,
}) => {
    const dateKey = typeof date === 'string' ? String(date || '').trim() : getManilaDateKey(date);
    const normalizedTime = String(time || '').trim();

    if (!dateKey) {
        return { ok: false, statusCode: 400, message: 'Please select a valid appointment date.' };
    }

    const parsedDate = parseScheduleDateKey(dateKey, '12:00');
    if (!parsedDate) {
        return { ok: false, statusCode: 400, message: 'Please select a valid appointment date.' };
    }

    if (getManilaWeekday(parsedDate) === 'Sun') {
        return { ok: false, statusCode: 400, message: 'Appointments cannot be requested on Sundays.' };
    }

    if (dateKey < getManilaDateKey(new Date())) {
        return { ok: false, statusCode: 400, message: 'Please select today or a future date.' };
    }

    const allowedSlots = await getClinicAllowedSlots();
    if (!allowedSlots.includes(normalizedTime)) {
        return { ok: false, statusCode: 400, message: 'Please select a valid appointment time.' };
    }

    const bookableSlots = getBookableAllowedSlotsForDate({ date: dateKey, allowedSlots });
    if (!bookableSlots.includes(normalizedTime) && !allowCurrentSlot) {
        return { ok: false, statusCode: 400, message: 'Please choose a later appointment time.' };
    }

    const takenSlots = await getTakenSlotsForDate({ date: dateKey, branch, excludeAppointmentId });
    if (takenSlots.includes(normalizedTime) && !allowCurrentSlot) {
        return { ok: false, statusCode: 409, message: 'That time slot is no longer available. Please choose another time.' };
    }

    const maxAppointmentsPerDay = await getClinicMaxAppointmentsPerDay();
    const appointmentCount = await getActiveAppointmentCountForDate({ date: dateKey, branch, excludeAppointmentId });
    if (appointmentCount >= maxAppointmentsPerDay) {
        return {
            ok: false,
            statusCode: 409,
            message: `This date has already reached the maximum of ${maxAppointmentsPerDay} appointments. Please choose another date.`,
        };
    }

    return {
        ok: true,
        dateKey,
        normalizedTime,
        parsedDate,
        allowedSlots,
        takenSlots,
        maxAppointmentsPerDay,
        appointmentCount,
    };
};

const getTakenSlotsForDate = async ({ date, branch, excludeAppointmentId = '' }) => {
    const dateKey = typeof date === 'string' ? String(date || '').trim() : getManilaDateKey(date);
    const start = parseScheduleDateKey(dateKey, '00:00');
    const end = parseScheduleDateKey(dateKey, '23:59');
    if (!start || !end) return [];

    const query = {
        date: { $gte: start, $lte: end },
        status: { $in: ['pending', 'confirmed', 'in-clinic'] },
        isArchived: false,
    };
    if (branch) query.branch = branch;
    if (excludeAppointmentId && mongoose.Types.ObjectId.isValid(excludeAppointmentId)) {
        query._id = { $ne: excludeAppointmentId };
    }

    const surgeries = await Surgery.find(query).select('time status');
    return surgeries.map((s) => s.time).filter(Boolean);
};

const getActiveAppointmentCountForDate = async ({ date, branch, excludeAppointmentId = '' }) => {
    const dateKey = typeof date === 'string' ? String(date || '').trim() : getManilaDateKey(date);
    const start = parseScheduleDateKey(dateKey, '00:00');
    const end = parseScheduleDateKey(dateKey, '23:59');
    if (!start || !end) return 0;

    const query = {
        date: { $gte: start, $lte: end },
        status: { $in: ['pending', 'confirmed', 'in-clinic'] },
        isArchived: false,
    };
    if (branch) query.branch = branch;
    if (excludeAppointmentId && mongoose.Types.ObjectId.isValid(excludeAppointmentId)) {
        query._id = { $ne: excludeAppointmentId };
    }

    return Surgery.countDocuments(query);
};

const getBlockedDatesForMonth = async ({ branch, month }) => {
    let start;
    let end;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [y, m] = month.split('-').map(Number);
        start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        end = new Date(y, m, 0, 23, 59, 59, 999);
    } else {
        start = new Date();
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setDate(end.getDate() + 60);
        end.setHours(23, 59, 59, 999);
    }

    const [allowedSlots, maxAppointmentsPerDay] = await Promise.all([
        getClinicAllowedSlots(),
        getClinicMaxAppointmentsPerDay(),
    ]);

    const query = {
        date: { $gte: start, $lte: end },
        status: { $in: ['pending', 'confirmed', 'in-clinic'] },
        isArchived: false,
    };
    if (branch) query.branch = branch;

    const appointments = await Surgery.find(query).select('date time');
    const takenByDate = new Map();
    const countByDate = new Map();

    for (const appt of appointments) {
        const key = getManilaDateKey(appt.date);
        const nextSet = takenByDate.get(key) || new Set();
        if (appt.time) nextSet.add(appt.time);
        takenByDate.set(key, nextSet);
        countByDate.set(key, (countByDate.get(key) || 0) + 1);
    }

    const blockedDates = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        const dateKey = getManilaDateKey(cursor);
        if (getManilaWeekday(cursor) === 'Sun') {
            blockedDates.push(dateKey);
        } else {
            const bookableSlots = getBookableAllowedSlotsForDate({ date: dateKey, allowedSlots });
            const takenSet = takenByDate.get(dateKey) || new Set();
            const appointmentCount = countByDate.get(dateKey) || 0;
            const hasOpenSlot = bookableSlots.some((slot) => !takenSet.has(slot));
            if (!hasOpenSlot || appointmentCount >= maxAppointmentsPerDay) blockedDates.push(dateKey);
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return blockedDates;
};

const getScopedBranchForUser = (user) => {
    if (!user) return null;
    return user.assignedBranch || user.assignedBranches?.[0] || null;
};

const isBranchScopedStaff = (role) => ['branch-manager', 'secretary'].includes(role);

const getAssignedBranchList = (user) => {
    if (!user) return [];
    if (Array.isArray(user.assignedBranches) && user.assignedBranches.length > 0) {
        return user.assignedBranches.filter(Boolean);
    }
    return user.assignedBranch ? [user.assignedBranch] : [];
};

const userBelongsToBranch = (user, branch) => {
    if (!branch) return false;
    return getAssignedBranchList(user).includes(branch);
};

const buildBranchOwnershipFilter = (branch) => {
    const normalizedBranch = String(branch || '').trim();
    if (!normalizedBranch) return {};

    return {
        $or: [
            { assignedBranch: normalizedBranch },
            { assignedBranches: { $in: [normalizedBranch] } },
        ],
    };
};

const applyBranchOwnershipFilter = (query = {}, branch) => {
    const branchFilter = buildBranchOwnershipFilter(branch);
    if (!branchFilter.$or) return { ...query };

    if (!query || Object.keys(query).length === 0) {
        return branchFilter;
    }

    return {
        $and: [
            query,
            branchFilter,
        ],
    };
};

const parseBooleanQueryFlag = (value) => ['true', '1', 'yes'].includes(String(value || '').trim().toLowerCase());

const applyArchiveVisibilityFilter = (query = {}, { includeArchived = false, archivedOnly = false } = {}) => {
    if (archivedOnly) {
        return { ...query, isArchived: true };
    }

    if (includeArchived) {
        return { ...query };
    }

    return { ...query, isArchived: { $ne: true } };
};

const canManageStaffLifecycle = ({ actor, target }) => {
    if (!actor || !target) {
        return { allowed: false, message: 'Access denied.' };
    }

    if (target.role === 'administrator') {
        return { allowed: false, message: 'Administrator accounts cannot be modified here.' };
    }

    if (target.role === 'patient') {
        return { allowed: false, message: 'Use the patient lifecycle controls for patient accounts.' };
    }

    if (actor.role === 'administrator') {
        return { allowed: true };
    }

    if (actor.role === 'owner') {
        if (!['dentist', 'secretary', 'branch-manager'].includes(target.role)) {
            return { allowed: false, message: 'Owners can only manage dentists, secretaries, and branch managers.' };
        }
        return { allowed: true };
    }

    if (actor.role === 'branch-manager') {
        if (!['dentist', 'secretary'].includes(target.role)) {
            return { allowed: false, message: 'Branch managers can only manage dentists and secretaries assigned to their branch.' };
        }

        const scopedBranch = getScopedBranchForUser(actor);
        if (!scopedBranch) {
            return { allowed: false, message: 'Branch manager has no assigned branch.' };
        }

        if (!userBelongsToBranch(target, scopedBranch)) {
            return { allowed: false, message: 'Access denied. This staff account belongs to a different branch.' };
        }

        return { allowed: true };
    }

    return { allowed: false, message: 'Access denied.' };
};

const canManagePatientLifecycle = ({ actor, patient }) => {
    if (!actor || !patient || patient.role !== 'patient') {
        return { allowed: false, message: 'Patient not found.' };
    }

    if (['administrator', 'owner'].includes(actor.role)) {
        return { allowed: true };
    }

    if (isBranchScopedStaff(actor.role)) {
        const scopedBranch = getScopedBranchForUser(actor);
        if (!scopedBranch) {
            return { allowed: false, message: `${actor.role} has no assigned branch.` };
        }

        if (!patientBelongsToBranch(patient, scopedBranch)) {
            return { allowed: false, message: 'Access denied. This patient belongs to a different branch.' };
        }

        return { allowed: true };
    }

    return { allowed: false, message: 'Access denied.' };
};

const canTransferPatientBranch = ({ actor, patient }) => {
    const lifecyclePermission = canManagePatientLifecycle({ actor, patient });
    if (!lifecyclePermission.allowed) {
        return lifecyclePermission;
    }

    if (!['administrator', 'owner', 'branch-manager', 'secretary'].includes(actor.role)) {
        return { allowed: false, message: 'Access denied.' };
    }

    return { allowed: true };
};

const patientBelongsToBranch = (patient, branch) => {
    if (!patient || !branch) return false;
    const patientBranches = patient.assignedBranches || (patient.assignedBranch ? [patient.assignedBranch] : []);
    return patientBranches.includes(branch);
};

const LIFECYCLE_ACTIONS = new Set(['activate', 'deactivate', 'archive', 'restore', 'delete']);
const UPCOMING_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'in-clinic'];
const ACCOUNT_DELETE_RETENTION_DAYS = 30;

const normalizeLifecycleAction = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase();
    return LIFECYCLE_ACTIONS.has(normalized) ? normalized : 'archive';
};

const getLifecycleDisplayName = (user = {}) => {
    const first = String(user?.name?.first || '').trim();
    const middle = String(user?.name?.middle || '').trim();
    const last = String(user?.name?.last || '').trim();
    return [first, middle, last].filter(Boolean).join(' ') || String(user?.email || '').trim() || 'Unknown User';
};

const getLifecycleAssignedBranches = (user = {}) => {
    const assignedBranches = Array.isArray(user?.assignedBranches) ? user.assignedBranches : [];
    const fallbackBranch = String(user?.assignedBranch || '').trim();
    return [...new Set([
        ...(fallbackBranch ? [fallbackBranch] : []),
        ...assignedBranches.map((branch) => String(branch || '').trim()).filter(Boolean),
    ])];
};

const getOdontogramEntryCount = (odontogram) => {
    if (!odontogram) return 0;
    if (odontogram instanceof Map) return odontogram.size;
    if (typeof odontogram === 'object') return Object.keys(odontogram).length;
    return 0;
};

const buildLifecycleImpactItem = (key, label, value) => {
    if (Array.isArray(value)) {
        const items = value.map((entry) => String(entry || '').trim()).filter(Boolean);
        if (!items.length) return null;
        return { key, label, valueType: 'list', value: items };
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return null;
    }

    return { key, label, valueType: 'count', value: numericValue };
};

const getBranchManagerCoverageImpact = async (user) => {
    if (!user || user.role !== 'branch-manager') {
        return { managedBranches: [], soleManagedBranches: [] };
    }

    const branches = await Branch.find({ managerIds: user._id })
        .select('name isActive managerIds')
        .lean();

    if (!branches.length) {
        return { managedBranches: [], soleManagedBranches: [] };
    }

    const otherManagerIds = [...new Set(
        branches
            .flatMap((branch) => Array.isArray(branch.managerIds) ? branch.managerIds : [])
            .map((managerId) => String(managerId))
            .filter((managerId) => managerId !== String(user._id))
    )];

    const activeManagers = otherManagerIds.length > 0
        ? await User.find({
            _id: { $in: otherManagerIds },
            role: 'branch-manager',
            status: 'active',
            isArchived: { $ne: true },
        }).select('_id')
            .lean()
        : [];
    const activeManagerIdSet = new Set(activeManagers.map((manager) => String(manager._id)));

    const soleManagedBranches = branches
        .filter((branch) => Boolean(branch.isActive))
        .filter((branch) => {
            const otherIds = (Array.isArray(branch.managerIds) ? branch.managerIds : [])
                .map((managerId) => String(managerId))
                .filter((managerId) => managerId !== String(user._id));
            return !otherIds.some((managerId) => activeManagerIdSet.has(managerId));
        })
        .map((branch) => branch.name)
        .filter(Boolean);

    return {
        managedBranches: branches.map((branch) => branch.name).filter(Boolean),
        soleManagedBranches,
    };
};

const collectLifecycleImpact = async ({ actor, targetUser, action = 'archive' }) => {
    const normalizedAction = normalizeLifecycleAction(action);
    const now = new Date();
    const assignedBranches = getLifecycleAssignedBranches(targetUser);
    const targetRole = String(targetUser?.role || '').trim();
    const displayName = getLifecycleDisplayName(targetUser);

    const metrics = {
        upcomingAppointments: 0,
        totalAppointments: 0,
        treatmentLogs: 0,
        radiographs: 0,
        odontogramEntries: 0,
        auditLogs: 0,
        queueEntries: 0,
        patientMaterialUsage: 0,
        dentistMaterialUsage: 0,
        assignedBranchesCount: assignedBranches.length,
        managedBranchesCount: 0,
        soleManagedBranchesCount: 0,
    };

    const [branchCoverage, ...counts] = await Promise.all([
        getBranchManagerCoverageImpact(targetUser),
        (async () => {
            if (targetRole !== 'patient') return 0;
            return Surgery.countDocuments({ patient: targetUser._id });
        })(),
        (async () => {
            if (targetRole !== 'patient') return 0;
            return Surgery.countDocuments({
                patient: targetUser._id,
                status: { $in: UPCOMING_APPOINTMENT_STATUSES },
                isArchived: { $ne: true },
                date: { $gte: now },
            });
        })(),
        (async () => {
            if (targetRole !== 'patient') return 0;
            return Queue.countDocuments({ patientId: targetUser._id });
        })(),
        (async () => {
            if (targetRole !== 'patient') return 0;
            return MaterialUsageLog.countDocuments({ patientId: targetUser._id });
        })(),
        (async () => {
            if (targetRole !== 'dentist' && !targetUser?.isDentist) return 0;
            return Surgery.countDocuments({ dentist: targetUser._id });
        })(),
        (async () => {
            if (targetRole !== 'dentist' && !targetUser?.isDentist) return 0;
            return Surgery.countDocuments({
                dentist: targetUser._id,
                status: { $in: UPCOMING_APPOINTMENT_STATUSES },
                isArchived: { $ne: true },
                date: { $gte: now },
            });
        })(),
        (async () => {
            if (targetRole !== 'dentist' && !targetUser?.isDentist) return 0;
            return MaterialUsageLog.countDocuments({ dentistId: targetUser._id });
        })(),
        (async () => {
            const auditQueries = [];
            if (targetUser?._id) {
                auditQueries.push({ targetId: targetUser._id, targetModel: 'User' });
            }
            if (targetUser?.email) {
                auditQueries.push({ user: targetUser.email });
            }
            if (!auditQueries.length) return 0;
            return AuditLog.countDocuments({ $or: auditQueries });
        })(),
    ]);

    if (targetRole === 'patient') {
        metrics.totalAppointments = counts[0];
        metrics.upcomingAppointments = counts[1];
        metrics.queueEntries = counts[2];
        metrics.patientMaterialUsage = counts[3];
        metrics.treatmentLogs = Array.isArray(targetUser.treatmentLogs) ? targetUser.treatmentLogs.length : 0;
        metrics.radiographs = Array.isArray(targetUser.radiographs) ? targetUser.radiographs.length : 0;
        metrics.odontogramEntries = getOdontogramEntryCount(targetUser.odontogram);
        metrics.auditLogs = counts[7];
    } else {
        metrics.totalAppointments = counts[4];
        metrics.upcomingAppointments = counts[5];
        metrics.dentistMaterialUsage = counts[6];
        metrics.auditLogs = counts[7];
    }

    metrics.managedBranchesCount = branchCoverage.managedBranches.length;
    metrics.soleManagedBranchesCount = branchCoverage.soleManagedBranches.length;

    const impactItems = [
        buildLifecycleImpactItem('upcomingAppointments', 'Upcoming Appointments', metrics.upcomingAppointments),
        buildLifecycleImpactItem('totalAppointments', 'Linked Appointment History', metrics.totalAppointments),
        buildLifecycleImpactItem('treatmentLogs', 'Treatment Logs', metrics.treatmentLogs),
        buildLifecycleImpactItem('radiographs', 'Radiograph Records', metrics.radiographs),
        buildLifecycleImpactItem('odontogramEntries', 'Odontogram Entries', metrics.odontogramEntries),
        buildLifecycleImpactItem('queueEntries', 'Queue History Entries', metrics.queueEntries),
        buildLifecycleImpactItem('patientMaterialUsage', 'Material Usage Links', metrics.patientMaterialUsage),
        buildLifecycleImpactItem('dentistMaterialUsage', 'Material Usage Logs', metrics.dentistMaterialUsage),
        buildLifecycleImpactItem('auditLogs', 'Audit Log References', metrics.auditLogs),
        buildLifecycleImpactItem('assignedBranches', 'Assigned Branches', assignedBranches),
        buildLifecycleImpactItem('managedBranches', 'Managed Branches', branchCoverage.managedBranches),
        buildLifecycleImpactItem('soleManagedBranches', 'Branches Needing Reassignment First', branchCoverage.soleManagedBranches),
    ].filter(Boolean);

    const warnings = [];
    const blockers = [];

    if (metrics.upcomingAppointments > 0 && ['deactivate', 'archive', 'delete'].includes(normalizedAction)) {
        warnings.push(`${displayName} still has ${metrics.upcomingAppointments} upcoming appointment${metrics.upcomingAppointments === 1 ? '' : 's'} that may need reassignment or follow-up.`);
    }
    if (targetRole === 'patient' && metrics.totalAppointments > 0 && ['archive', 'delete'].includes(normalizedAction)) {
        warnings.push('This patient already has appointment history linked to the EMR timeline.');
    }
    if (targetRole === 'patient' && (metrics.treatmentLogs > 0 || metrics.radiographs > 0 || metrics.odontogramEntries > 0) && ['archive', 'delete'].includes(normalizedAction)) {
        warnings.push('This patient has stored EMR content that should stay preserved as history.');
    }
    if (branchCoverage.managedBranches.length > 0 && ['deactivate', 'archive', 'delete'].includes(normalizedAction)) {
        warnings.push(`${displayName} is still linked to ${branchCoverage.managedBranches.length} branch manager assignment${branchCoverage.managedBranches.length === 1 ? '' : 's'}.`);
    }

    if (
        targetRole === 'branch-manager'
        && ['deactivate', 'archive'].includes(normalizedAction)
        && branchCoverage.soleManagedBranches.length > 0
    ) {
        blockers.push(`Reassign active branch manager coverage first for: ${branchCoverage.soleManagedBranches.join(', ')}.`);
    }

    if (normalizedAction === 'delete') {
        if (targetRole === 'administrator') {
            blockers.push('Administrator accounts cannot be permanently deleted.');
        }
        if (!targetUser.isArchived) {
            blockers.push('Archive the account before permanently deleting it.');
        } else {
            const archivedAt = targetUser.archivedAt ? new Date(targetUser.archivedAt) : null;
            if (!archivedAt || Number.isNaN(archivedAt.getTime())) {
                blockers.push('Archived timestamp is missing. This account cannot be permanently deleted safely.');
            } else {
                const retentionMs = ACCOUNT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
                const remainingMs = retentionMs - (now.getTime() - archivedAt.getTime());
                if (remainingMs > 0) {
                    const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
                    blockers.push(`Keep archived accounts for at least ${ACCOUNT_DELETE_RETENTION_DAYS} days before permanent deletion (${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining).`);
                }
            }
        }
        if (metrics.totalAppointments > 0) {
            blockers.push(`This account still has ${metrics.totalAppointments} linked appointment record${metrics.totalAppointments === 1 ? '' : 's'}.`);
        }
        if (targetRole === 'patient') {
            if (metrics.treatmentLogs > 0) blockers.push('Patient treatment logs must be preserved.');
            if (metrics.radiographs > 0) blockers.push('Patient radiograph records must be preserved.');
            if (metrics.odontogramEntries > 0) blockers.push('Patient odontogram history must be preserved.');
            if (metrics.queueEntries > 0) blockers.push('Patient queue history still exists.');
            if (metrics.patientMaterialUsage > 0) blockers.push('Material usage history still references this patient.');
        } else {
            if (branchCoverage.managedBranches.length > 0) blockers.push(`Branch records still reference this branch manager: ${branchCoverage.managedBranches.join(', ')}.`);
            if (metrics.dentistMaterialUsage > 0) blockers.push('Material usage logs still reference this dentist account.');
        }
        if (metrics.auditLogs > 0) {
            blockers.push(`Audit trail references still exist for this account (${metrics.auditLogs}).`);
        }
    }

    if (normalizedAction === 'activate' && !targetUser.isVerified) {
        blockers.push('Email verification is still pending. Activate only after verification is complete.');
    }

    return {
        action: normalizedAction,
        allowed: blockers.length === 0,
        target: {
            id: String(targetUser._id),
            role: targetRole,
            name: displayName,
            email: String(targetUser.email || '').trim(),
            status: String(targetUser.status || 'inactive'),
            isArchived: Boolean(targetUser.isArchived),
            assignedBranches,
        },
        impactItems,
        metrics,
        warnings,
        blockers,
    };
};

const collectPatientBranchTransferImpact = async ({ patient, targetBranch = '' }) => {
    const normalizedTargetBranch = String(targetBranch || '').trim();
    const currentBranch = String(patient?.assignedBranch || patient?.assignedBranches?.[0] || '').trim();
    const now = new Date();
    const treatmentLogsCount = Array.isArray(patient?.treatmentLogs) ? patient.treatmentLogs.length : 0;
    const radiographsCount = Array.isArray(patient?.radiographs) ? patient.radiographs.length : 0;
    const odontogramEntries = getOdontogramEntryCount(patient?.odontogram);

    const [upcomingCurrentBranchAppointments, totalUpcomingAppointments, totalAppointments, queueEntries] = await Promise.all([
        currentBranch
            ? Surgery.countDocuments({
                patient: patient._id,
                branch: currentBranch,
                status: { $in: UPCOMING_APPOINTMENT_STATUSES },
                isArchived: { $ne: true },
                date: { $gte: now },
            })
            : 0,
        Surgery.countDocuments({
            patient: patient._id,
            status: { $in: UPCOMING_APPOINTMENT_STATUSES },
            isArchived: { $ne: true },
            date: { $gte: now },
        }),
        Surgery.countDocuments({ patient: patient._id }),
        Queue.countDocuments({ patientId: patient._id }),
    ]);

    const impactItems = [
        buildLifecycleImpactItem('currentBranch', 'Current Assigned Branch', currentBranch ? [currentBranch] : []),
        buildLifecycleImpactItem('targetBranch', 'Requested Target Branch', normalizedTargetBranch ? [normalizedTargetBranch] : []),
        buildLifecycleImpactItem('upcomingCurrentBranchAppointments', 'Upcoming Appointments In Current Branch', upcomingCurrentBranchAppointments),
        buildLifecycleImpactItem('totalUpcomingAppointments', 'Total Upcoming Appointments', totalUpcomingAppointments),
        buildLifecycleImpactItem('totalAppointments', 'Linked Appointment History', totalAppointments),
        buildLifecycleImpactItem('queueEntries', 'Queue History Entries', queueEntries),
        buildLifecycleImpactItem('treatmentLogs', 'Treatment Logs', treatmentLogsCount),
        buildLifecycleImpactItem('radiographs', 'Radiograph Records', radiographsCount),
        buildLifecycleImpactItem('odontogramEntries', 'Odontogram Entries', odontogramEntries),
    ].filter(Boolean);

    const blockers = [];
    const warnings = [];

    if (!currentBranch) {
        blockers.push('This patient does not have a current assigned branch yet. Fix the patient branch assignment first before transferring.');
    }

    if (normalizedTargetBranch && currentBranch && normalizedTargetBranch === currentBranch) {
        blockers.push('Select a different target branch before submitting the transfer.');
    }

    if (upcomingCurrentBranchAppointments > 0) {
        blockers.push(`This patient still has ${upcomingCurrentBranchAppointments} upcoming appointment${upcomingCurrentBranchAppointments === 1 ? '' : 's'} in ${currentBranch}. Resolve or move those appointments first.`);
    }

    if (totalAppointments > 0) {
        warnings.push('Appointment history will stay tied to its original branch records. This transfer only changes future branch ownership.');
    }

    if (queueEntries > 0) {
        warnings.push('Queue history is preserved as branch history and will not be rewritten during transfer.');
    }

    if (treatmentLogsCount > 0 || radiographsCount > 0 || odontogramEntries > 0) {
        warnings.push('Stored EMR history stays preserved. Only the active patient branch changes.');
    }

    if (normalizedTargetBranch) {
        warnings.push(`After transfer, patient self-booking and branch-scoped staff access will follow ${normalizedTargetBranch}.`);
    }

    return {
        target: {
            id: String(patient._id),
            role: patient.role,
            name: getLifecycleDisplayName(patient),
            email: String(patient.email || '').trim(),
        },
        currentBranch,
        targetBranch: normalizedTargetBranch,
        metrics: {
            upcomingCurrentBranchAppointments,
            totalUpcomingAppointments,
            totalAppointments,
            queueEntries,
            treatmentLogs: treatmentLogsCount,
            radiographs: radiographsCount,
            odontogramEntries,
        },
        impactItems,
        warnings,
        blockers,
    };
};

const PATIENT_AI_SCHEDULING_KEYWORDS = [
    'appointment', 'appointments', 'schedule', 'scheduled', 'booking', 'book', 'reschedule',
    'cancel', 'slot', 'slots', 'available', 'availability', 'calendar',
    'open time', 'visit', 'checkup', 'cleaning', 'iskedyul', 'oras', 'bakante', 'libre',
    'appointment ko', 'appointment nako', 'schedule ko', 'schedule nako', 'available ba',
];

const PATIENT_AI_TODAY_KEYWORDS = ['today', 'ngayon', 'karon'];
const PATIENT_AI_TOMORROW_KEYWORDS = ['tomorrow', 'bukas', 'ugma'];
const PATIENT_AI_THIS_WEEK_KEYWORDS = ['this week', 'ngayong linggo', 'karong semanaha'];
const PATIENT_AI_NEXT_WEEK_KEYWORDS = ['next week', 'susunod na linggo', 'sunod na linggo', 'sunod semana'];

const includesKeyword = (text, keywords = []) => {
    const lowerText = String(text || '').toLowerCase();
    return keywords.some((keyword) => lowerText.includes(String(keyword || '').toLowerCase()));
};

const shiftManilaDateKey = (dateKey, days = 0) => {
    const parsedDate = parseScheduleDateKey(dateKey, '12:00');
    if (!parsedDate) return '';
    parsedDate.setUTCDate(parsedDate.getUTCDate() + Number(days || 0));
    return getManilaDateKey(parsedDate);
};

const getManilaDateLabel = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-PH', {
        timeZone: MANILA_TIME_ZONE,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
};

const formatPatientAiAppointment = (appointment) => {
    if (!appointment) return null;

    const dateKey = getManilaDateKey(appointment.date);
    return {
        id: String(appointment._id || ''),
        procedure: appointment.procedure || '',
        status: appointment.status || '',
        branch: appointment.branch || '',
        time: appointment.time || '',
        date: dateKey,
        dateLabel: dateKey ? getManilaDateLabel(parseScheduleDateKey(dateKey, '12:00')) : '',
    };
};

const getTakenSlotsMapForRange = async ({ branch, startDateKey, endDateKey }) => {
    const start = parseScheduleDateKey(startDateKey, '00:00');
    const end = parseScheduleDateKey(endDateKey, '23:59');
    if (!start || !end) return new Map();

    const query = {
        date: { $gte: start, $lte: end },
        status: { $in: ['pending', 'confirmed', 'in-clinic'] },
        isArchived: false,
    };
    if (branch) query.branch = branch;

    const appointments = await Surgery.find(query).select('date time').lean();
    const takenSlotsMap = new Map();

    for (const appointment of appointments) {
        const dateKey = getManilaDateKey(appointment.date);
        const nextSet = takenSlotsMap.get(dateKey) || new Set();
        if (appointment.time) nextSet.add(appointment.time);
        takenSlotsMap.set(dateKey, nextSet);
    }

    return takenSlotsMap;
};

const summarizeAvailabilityForDate = ({ dateKey, allowedSlots, takenSlotsMap, maxPreviewSlots = 4 }) => {
    const parsedDate = parseScheduleDateKey(dateKey, '12:00');
    if (!parsedDate) return null;

    const weekday = getManilaWeekday(parsedDate);
    const todayKey = getManilaDateKey(new Date());
    const isPastDate = dateKey < todayKey;
    const takenSlots = Array.from(takenSlotsMap.get(dateKey) || []);
    const bookableSlots = weekday === 'Sun' || isPastDate
        ? []
        : getBookableAllowedSlotsForDate({ date: dateKey, allowedSlots });
    const openSlots = bookableSlots.filter((slot) => !takenSlots.includes(slot));

    return {
        date: dateKey,
        dateLabel: getManilaDateLabel(parsedDate),
        weekday,
        isSunday: weekday === 'Sun',
        isPastDate,
        openSlotCount: openSlots.length,
        firstOpenSlots: openSlots.slice(0, maxPreviewSlots),
        takenSlotCount: takenSlots.length,
        fullyBooked: !isPastDate && weekday !== 'Sun' && openSlots.length === 0,
        closed: weekday === 'Sun',
    };
};

const getWeekRangeFromDateKey = (dateKey, weekOffset = 0) => {
    const parsedDate = parseScheduleDateKey(dateKey, '12:00');
    if (!parsedDate) return null;

    const utcDay = parsedDate.getUTCDay();
    const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1;
    const startDate = new Date(parsedDate);
    startDate.setUTCDate(startDate.getUTCDate() - daysFromMonday + (weekOffset * 7));

    const startDateKey = getManilaDateKey(startDate);
    return {
        startDateKey,
        endDateKey: shiftManilaDateKey(startDateKey, 6),
    };
};

const buildPatientAiAvailabilitySnapshot = async ({ queryText, branch }) => {
    if (!branch) {
        return {
            unavailableReason: 'This patient does not have an assigned branch yet. They must contact the clinic before booking an appointment.',
        };
    }

    const todayKey = getManilaDateKey(new Date());
    const nextTwoWeeksEndKey = shiftManilaDateKey(todayKey, 13);
    const [allowedSlots, nextTwoWeeksTakenSlots] = await Promise.all([
        getClinicAllowedSlots(),
        getTakenSlotsMapForRange({
            branch,
            startDateKey: todayKey,
            endDateKey: nextTwoWeeksEndKey,
        }),
    ]);

    const nextOpenDates = [];
    for (let offset = 0; offset < 14 && nextOpenDates.length < 7; offset += 1) {
        const dateKey = shiftManilaDateKey(todayKey, offset);
        const daySummary = summarizeAvailabilityForDate({
            dateKey,
            allowedSlots,
            takenSlotsMap: nextTwoWeeksTakenSlots,
        });
        if (daySummary && daySummary.openSlotCount > 0) {
            nextOpenDates.push(daySummary);
        }
    }

    const requestedDateKeys = [];
    const isoDateMatches = String(queryText || '').match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
    isoDateMatches.forEach((value) => requestedDateKeys.push(value));

    if (includesKeyword(queryText, PATIENT_AI_TODAY_KEYWORDS)) {
        requestedDateKeys.push(todayKey);
    }
    if (includesKeyword(queryText, PATIENT_AI_TOMORROW_KEYWORDS)) {
        requestedDateKeys.push(shiftManilaDateKey(todayKey, 1));
    }

    const requestedAvailability = [];
    const uniqueRequestedDateKeys = [...new Set(requestedDateKeys)].filter(Boolean).slice(0, 3);
    let requestedTakenSlotsMap = nextTwoWeeksTakenSlots;
    if (uniqueRequestedDateKeys.length > 0) {
        const sortedRequestedDates = [...uniqueRequestedDateKeys].sort();
        const requestedStartDateKey = sortedRequestedDates[0];
        const requestedEndDateKey = sortedRequestedDates[sortedRequestedDates.length - 1];
        const needsCustomRange = requestedStartDateKey < todayKey || requestedEndDateKey > nextTwoWeeksEndKey;

        if (needsCustomRange) {
            requestedTakenSlotsMap = await getTakenSlotsMapForRange({
                branch,
                startDateKey: requestedStartDateKey,
                endDateKey: requestedEndDateKey,
            });
        }
    }

    uniqueRequestedDateKeys.forEach((dateKey) => {
        const summary = summarizeAvailabilityForDate({
            dateKey,
            allowedSlots,
            takenSlotsMap: requestedTakenSlotsMap,
        });
        if (summary) requestedAvailability.push(summary);
    });

    const requestedAvailabilityWindows = [];
    const weekWindows = [];
    if (includesKeyword(queryText, PATIENT_AI_THIS_WEEK_KEYWORDS)) {
        weekWindows.push({ label: 'This week', range: getWeekRangeFromDateKey(todayKey, 0) });
    }
    if (includesKeyword(queryText, PATIENT_AI_NEXT_WEEK_KEYWORDS)) {
        weekWindows.push({ label: 'Next week', range: getWeekRangeFromDateKey(todayKey, 1) });
    }

    for (const windowInfo of weekWindows) {
        if (!windowInfo.range) continue;
        const takenSlotsMap = await getTakenSlotsMapForRange({
            branch,
            startDateKey: windowInfo.range.startDateKey,
            endDateKey: windowInfo.range.endDateKey,
        });

        const days = [];
        for (let offset = 0; offset < 7; offset += 1) {
            const dateKey = shiftManilaDateKey(windowInfo.range.startDateKey, offset);
            const daySummary = summarizeAvailabilityForDate({
                dateKey,
                allowedSlots,
                takenSlotsMap,
                maxPreviewSlots: 3,
            });
            if (daySummary) {
                days.push(daySummary);
            }
        }

        requestedAvailabilityWindows.push({
            label: windowInfo.label,
            startDate: windowInfo.range.startDateKey,
            endDate: windowInfo.range.endDateKey,
            days,
        });
    }

    return {
        branch,
        asOfDate: todayKey,
        bookingRules: {
            directBookableProcedures: await getOnlineBookingProcedures(),
            oneActiveAppointmentLimit: true,
            note: 'Patients may only request appointments through their assigned branch, and slot availability can change before booking is confirmed.',
        },
        nextOpenDates,
        requestedAvailability,
        requestedAvailabilityWindows,
    };
};

const buildPatientAiLiveContext = async ({ userId, messages, assistantContext }) => {
    const queryText = String(messages?.at(-1)?.content || '').trim();
    const patient = await User.findById(userId)
        .select('name email assignedBranch assignedBranches')
        .lean();

    const assignedBranch = patient?.assignedBranch || patient?.assignedBranches?.[0] || '';
    const [branch, activeAppointment, recentAppointments] = await Promise.all([
        assignedBranch
            ? Branch.findOne({ name: assignedBranch }).select('name address addressDetails contactNumber isActive').lean()
            : Promise.resolve(null),
        Surgery.findOne({
            patient: userId,
            status: { $in: ['pending', 'confirmed', 'in-clinic'] },
            isArchived: false,
        })
            .select('date time procedure status branch')
            .sort({ date: 1 })
            .lean(),
        Surgery.find({
            patient: userId,
            isArchived: false,
        })
            .select('date time procedure status branch')
            .sort({ date: -1 })
            .limit(5)
            .lean(),
    ]);

    const liveContext = {
        patientSession: {
            requestedAt: new Date().toISOString(),
            todayDate: getManilaDateKey(new Date()),
            patientName: patient?.name
                ? `${patient.name.first || ''} ${patient.name.last || ''}`.trim()
                : '',
            assignedBranch,
        },
        branchInfo: branch
            ? {
                name: branch.name || '',
                contactNumber: branch.contactNumber || '',
                address: branch.address || '',
                addressDetails: branch.addressDetails || {},
                isActive: branch.isActive !== false,
            }
            : {
                name: assignedBranch,
                isActive: false,
            },
        appointmentsSnapshot: {
            activeAppointment: formatPatientAiAppointment(activeAppointment),
            recentAppointments: recentAppointments.map(formatPatientAiAppointment).filter(Boolean),
        },
    };

    if (includesKeyword(queryText, PATIENT_AI_SCHEDULING_KEYWORDS)) {
        liveContext.appointmentAvailability = await buildPatientAiAvailabilitySnapshot({
            queryText,
            branch: assignedBranch,
        });
    }

    if (!assistantContext) {
        return liveContext;
    }

    if (typeof assistantContext !== 'object' || Array.isArray(assistantContext)) {
        return {
            ...liveContext,
            clientSuppliedContext: assistantContext,
        };
    }

    return {
        ...liveContext,
        ...assistantContext,
    };
};

const dentistCanAccessPatient = async (dentistId, patientId) => {
    if (!dentistId || !patientId) return false;

    const directlyAssignedPatient = await User.exists({
        _id: patientId,
        role: 'patient',
        assignedDentistId: dentistId,
    });

    if (directlyAssignedPatient) return true;

    const assignedAppointment = await Surgery.exists({
        dentist: dentistId,
        patient: patientId,
    });

    return Boolean(assignedAppointment);
};

const getClinicContactDetails = async () => {
    const config = await getNormalizedSystemConfig();
    return {
        clinicName: config?.clinicName || 'Dentime Dental Clinic',
        clinicContact: config?.clinicContact || 'N/A',
        clinicEmail: config?.clinicEmail || 'N/A',
        clinicAddress: config?.clinicAddress || 'N/A',
    };
};

const getClinicContactDetailsForBranch = async (branchName = '') => {
    const clinic = await getClinicContactDetails();
    const normalizedBranch = String(branchName || '').trim();
    if (!normalizedBranch) return clinic;

    const branchRecord = await Branch.findOne({ name: normalizedBranch, isActive: true })
        .select('name address contactNumber')
        .lean();

    if (!branchRecord) {
        return {
            ...clinic,
            clinicName: normalizedBranch || clinic.clinicName,
        };
    }

    return {
        clinicName: branchRecord.name || clinic.clinicName,
        clinicContact: branchRecord.contactNumber || clinic.clinicContact || 'N/A',
        clinicEmail: clinic.clinicEmail || 'N/A',
        clinicAddress: branchRecord.address || clinic.clinicAddress || 'N/A',
    };
};

const getDentistDisplayName = (dentist) => {
    if (!dentist) return 'To be assigned by the clinic';
    const fullName = dentist?.name
        ? `${dentist.name.first || ''} ${dentist.name.last || ''}`.trim()
        : '';
    return fullName ? `Dr. ${fullName}` : 'To be assigned by the clinic';
};

const getPatientDisplayName = (appointment) => {
    if (appointment?.patient?.name) {
        return `${appointment.patient.name.first || ''} ${appointment.patient.name.last || ''}`.trim() || 'Patient';
    }
    return appointment?.guestName || 'Patient';
};

const normalizePersonNameValue = (value = '') => (
    String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
);

const doesPatientIdentityMatchWebsiteRequest = (patientUser, {
    firstName = '',
    lastName = '',
    birthdate = '',
}) => {
    if (!patientUser) return false;

    const patientFirst = normalizePersonNameValue(patientUser?.name?.first);
    const patientLast = normalizePersonNameValue(patientUser?.name?.last);
    const requestFirst = normalizePersonNameValue(firstName);
    const requestLast = normalizePersonNameValue(lastName);

    if (!patientFirst || !patientLast || patientFirst !== requestFirst || patientLast !== requestLast) {
        return false;
    }

    const patientBirthdate = patientUser?.birthdate ? new Date(patientUser.birthdate) : null;
    const requestBirthdate = birthdate ? new Date(`${birthdate}T12:00:00`) : null;
    if (!patientBirthdate || !requestBirthdate || Number.isNaN(patientBirthdate.getTime()) || Number.isNaN(requestBirthdate.getTime())) {
        return false;
    }

    return isSameCalendarDay(patientBirthdate, requestBirthdate);
};

const GUEST_PRE_REGISTRATION_SOURCES = new Set(['Smile Hub (Online)', 'Phone Call']);

const isGuestPreRegistrationAppointment = (appointment) => (
    Boolean(appointment)
    && GUEST_PRE_REGISTRATION_SOURCES.has(String(appointment?.source || '').trim())
    && Boolean(appointment?.guestEmail || appointment?.patient?.email)
);

const PRE_REGISTRATION_TOKEN_LIFETIME_MS = 72 * 60 * 60 * 1000;

const buildGuestPreRegistrationFields = () => ({
    preRegistrationToken: crypto.randomBytes(32).toString('hex'),
    preRegistrationTokenExpiry: new Date(Date.now() + PRE_REGISTRATION_TOKEN_LIFETIME_MS),
    preRegistrationCompleted: false,
});

const isPreRegistrationTokenStillActive = (appointment) => (
    Boolean(String(appointment?.preRegistrationToken || '').trim())
    && Boolean(appointment?.preRegistrationTokenExpiry)
    && new Date(appointment.preRegistrationTokenExpiry) >= new Date()
);

const getGuestPreRegistrationFields = (appointment, { forceRefresh = false } = {}) => {
    if (!forceRefresh && isPreRegistrationTokenStillActive(appointment)) {
        return {
            preRegistrationToken: appointment.preRegistrationToken,
            preRegistrationTokenExpiry: appointment.preRegistrationTokenExpiry,
            preRegistrationCompleted: false,
            reusedExistingToken: true,
        };
    }

    return {
        ...buildGuestPreRegistrationFields(),
        reusedExistingToken: false,
    };
};

const summarizePendingGuestPreRegistration = (appointment = {}) => ({
    appointmentId: appointment?._id?.toString?.() || String(appointment?._id || ''),
    branch: appointment?.branch || '',
    procedure: appointment?.procedure || '',
    source: appointment?.source || '',
    date: appointment?.date || null,
    time: appointment?.time || '',
    tokenExpiresAt: appointment?.preRegistrationTokenExpiry || null,
});

const buildPendingGuestPreRegistrationMap = async (patientIds = []) => {
    const uniquePatientIds = [...new Set(
        patientIds
            .map((patientId) => String(patientId || '').trim())
            .filter(Boolean)
    )];
    if (uniquePatientIds.length === 0) return new Map();

    const pendingAppointments = await Surgery.find({
        isArchived: false,
        patient: { $in: uniquePatientIds },
        source: { $in: [...GUEST_PRE_REGISTRATION_SOURCES] },
        preRegistrationCompleted: false,
        preRegistrationToken: { $exists: true, $ne: null },
        status: { $in: ['confirmed', 'pending', 'in-clinic'] },
    })
        .select('_id patient branch procedure source date time preRegistrationTokenExpiry')
        .sort({ date: -1, createdAt: -1 })
        .lean();

    const pendingMap = new Map();
    pendingAppointments.forEach((appointment) => {
        const patientId = String(appointment?.patient || '').trim();
        if (!patientId || pendingMap.has(patientId)) return;
        pendingMap.set(patientId, summarizePendingGuestPreRegistration(appointment));
    });

    return pendingMap;
};

const attachPendingGuestPreRegistrationToPatientRecords = async (records = []) => {
    if (!Array.isArray(records) || records.length === 0) return [];

    const pendingMap = await buildPendingGuestPreRegistrationMap(records.map((record) => record?._id));
    return records.map((record) => {
        const normalizedRecord = typeof record?.toObject === 'function' ? record.toObject() : { ...record };
        normalizedRecord.pendingPreRegistration = pendingMap.get(String(record?._id || '')) || null;
        return normalizedRecord;
    });
};

const provisionGuestPatientAccountForAppointment = async ({ surgery, actor }) => {
    if (!surgery || surgery.patient || !isGuestPreRegistrationAppointment(surgery)) {
        return { patient: null, linkedExisting: false, requiresPreRegistration: false };
    }

    const guestEmail = normalizeEmail(surgery.guestEmail || '');
    const guestPhone = normalizePhoneNumber(surgery.guestPhone || '');
    const guestBirthdate = surgery.guestBirthdate ? new Date(surgery.guestBirthdate).toISOString().split('T')[0] : '';
    const guestName = splitGuestFullName(surgery.guestName || '');

    if (!guestName.first || !guestName.last) {
        return { errorStatus: 400, errorMessage: 'Guest first and last name are required before confirming this appointment.' };
    }
    if (!guestEmail || !isValidEmailAddress(guestEmail)) {
        return { errorStatus: 400, errorMessage: 'A valid guest email is required before confirming this appointment.' };
    }
    if (!guestPhone) {
        return { errorStatus: 400, errorMessage: 'Guest contact number is required before confirming this appointment.' };
    }
    if (!guestBirthdate || !surgery.guestGender) {
        return { errorStatus: 400, errorMessage: 'Guest birthdate and gender are required before confirming this appointment.' };
    }
    if (!surgery.branch) {
        return { errorStatus: 400, errorMessage: 'Appointment branch is required before confirming this appointment.' };
    }

    const existingUser = await User.findOne({ email: guestEmail })
        .select('name email birthdate role assignedBranch assignedBranches isVerified status');

    if (existingUser) {
        if (existingUser.role !== 'patient') {
            return {
                errorStatus: 409,
                errorMessage: 'This guest email already belongs to a non-patient account. Update the appointment email before confirming.',
            };
        }

        const existingPatientBranches = existingUser.assignedBranches?.length
            ? existingUser.assignedBranches
            : (existingUser.assignedBranch ? [existingUser.assignedBranch] : []);
        if (existingPatientBranches.length > 0 && !existingPatientBranches.includes(surgery.branch)) {
            return {
                errorStatus: 409,
                errorMessage: 'This guest email already belongs to a patient assigned to a different branch.',
            };
        }

        if (!doesPatientIdentityMatchWebsiteRequest(existingUser, {
            firstName: guestName.first,
            lastName: guestName.last,
            birthdate: guestBirthdate,
        })) {
            return {
                errorStatus: 409,
                errorMessage: 'This guest email already belongs to an existing patient, but the guest name or birthdate does not match that record.',
            };
        }

        return { patient: existingUser, linkedExisting: true, requiresPreRegistration: false };
    }

    const patientPayload = buildPatientPayload({
        body: {},
        fallbackGuest: {
            ...surgery.toObject?.(),
            guestPhone,
            guestEmail,
        },
        assignedBranchOverride: surgery.branch,
    });

    const seededPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
    const newUser = new User({
        ...patientPayload,
        password: seededPassword,
        role: 'patient',
        status: 'inactive',
        isVerified: false,
        activationToken: undefined,
        temporaryPasswordExpires: null,
        isPasswordChanged: false,
    });
    await newUser.save();

    await AuditLog.create({
        action: 'AUTO_CREATE_GUEST_PATIENT',
        user: actor?.email || actor?.id || 'SYSTEM',
        role: actor?.role || 'SYSTEM',
        details: `Created inactive patient ${newUser.email} from confirmed guest appointment ${surgery._id}.`,
    });

    return { patient: newUser, linkedExisting: false, requiresPreRegistration: true };
};

const sendPatientActivationLink = async (patient, options = {}) => {
    if (!patient || patient.role !== 'patient') return null;

    const { activationToken, activationLink } = await issueActivationSetupForAccount(patient);
    await patient.save();

    const clinic = options?.branch ? await getClinicContactDetailsForBranch(options.branch) : await getClinicContactDetails();
    await sendActivationEmail(patient.email, 'Patient', activationLink, '', {
        clinic,
        branch: options?.branch || '',
        procedure: options?.procedure || '',
        closingMessage: 'If you have questions, you may contact the clinic through the details below.',
    });

    return {
        activationToken,
        temporaryPasswordExpires: null,
    };
};

const buildPatientAppointmentStatusNotification = ({ appointment, status, dentistName = '' }) => {
    const normalizedStatus = String(status || appointment?.status || '').trim().toLowerCase();
    const procedure = appointment?.performedProcedure || appointment?.procedure || 'appointment';
    const dateLabel = appointment?.date ? formatEmailDateLabel(appointment.date) : 'the scheduled date';
    const timeLabel = appointment?.time || 'the scheduled time';
    const nextDentistName = dentistName || getDentistDisplayName(appointment?.dentist);

    switch (normalizedStatus) {
        case 'confirmed':
            return {
                type: 'APPOINTMENT_CONFIRMED',
                title: 'Appointment Confirmed',
                message: `Your appointment for ${procedure} on ${dateLabel} at ${timeLabel} has been confirmed. Assigned dentist: ${nextDentistName}.`,
            };
        case 'in-clinic':
            return {
                type: 'APPOINTMENT_STATUS_UPDATED',
                title: 'Appointment In Clinic',
                message: `Your appointment for ${procedure} has been checked in and is now in clinic.`,
            };
        case 'completed':
            return {
                type: 'APPOINTMENT_STATUS_UPDATED',
                title: 'Appointment Completed',
                message: `Your appointment for ${procedure} has been marked completed.`,
            };
        case 'cancelled':
            return {
                type: 'APPOINTMENT_CANCELLED',
                title: 'Appointment Cancelled',
                message: `Your appointment for ${procedure} on ${dateLabel} at ${timeLabel} has been cancelled.`,
            };
        case 'pending':
        default:
            return {
                type: 'APPOINTMENT_STATUS_UPDATED',
                title: 'Appointment Updated',
                message: `Your appointment for ${procedure} is now marked ${normalizedStatus || 'pending'}.`,
            };
    }
};

const createPatientNotification = async ({
    patientId,
    type,
    title,
    message,
    relatedId = null,
}) => {
    if (!patientId) return null;

    const patient = await User.findById(patientId).select(
        'notifAppointments notifVisitWindow notifHealthTips isArchived role'
    );
    if (!patient || patient.role !== 'patient' || patient.isArchived) {
        return null;
    }
    if (!isPatientNotificationEnabled(patient, type)) {
        return null;
    }

    await Notification.create({
        type,
        title,
        message,
        recipientId: patient._id,
        recipientRole: 'patient',
        relatedId,
    });

    return true;
};

const notifyPatientAppointmentStatusChange = async ({ appointment, status, dentistName = '' }) => {
    if (!appointment?.patient?._id) return;
    const notification = buildPatientAppointmentStatusNotification({ appointment, status, dentistName });
    await createPatientNotification({
        patientId: appointment.patient._id,
        relatedId: appointment._id,
        ...notification,
    });
};

const notifyPatientQueueStatusChange = async ({ queueEntry, status, title = '' }) => {
    if (!queueEntry?.patientId) return;

    const normalizedStatus = String(status || queueEntry.status || '').trim().toLowerCase();
    const procedure = queueEntry.procedureType || 'walk-in appointment';
    const branch = queueEntry.branch || 'the clinic';

    let notificationTitle = title || 'Walk-in Appointment Updated';
    let message = `Your walk-in appointment for ${procedure} is now marked ${normalizedStatus || 'pending'}.`;

    if (normalizedStatus === 'in-clinic') {
        notificationTitle = title || 'Walk-in Appointment In Clinic';
        message = `Your walk-in appointment for ${procedure} has been checked in at ${branch}.`;
    } else if (normalizedStatus === 'completed') {
        notificationTitle = title || 'Walk-in Appointment Completed';
        message = `Your walk-in appointment for ${procedure} has been marked completed.`;
    } else if (normalizedStatus === 'cancelled') {
        notificationTitle = title || 'Walk-in Appointment Cancelled';
        message = `Your walk-in appointment for ${procedure} has been cancelled.`;
    }

    await createPatientNotification({
        type: normalizedStatus === 'cancelled' ? 'APPOINTMENT_CANCELLED' : 'APPOINTMENT_STATUS_UPDATED',
        title: notificationTitle,
        message,
        patientId: queueEntry.patientId,
        relatedId: queueEntry.linkedAppointment || queueEntry._id,
    });
};

const runPostSaveSideEffect = async (label, work) => {
    try {
        await work();
    } catch (error) {
        console.error(`Post-save side effect failed (${label}):`, error);
    }
};

const buildAppointmentDateTime = (dateValue, timeValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    const [hoursText = '0', minutesText = '0'] = String(timeValue || '').split(':');
    date.setHours(Number(hoursText), Number(minutesText), 0, 0);
    return date;
};

const STATUS_TRANSITIONS = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['in-clinic', 'cancelled'],
    'in-clinic': ['completed'],
    completed: [],
    cancelled: [],
};

const canTransitionAppointmentStatus = ({ currentStatus = '', nextStatus = '' }) => {
    const current = String(currentStatus || '').trim().toLowerCase();
    const next = String(nextStatus || '').trim().toLowerCase();
    if (!current || !next) return false;
    if (current === next) return true;
    return (STATUS_TRANSITIONS[current] || []).includes(next);
};

const getCurrentScheduleStamp = () => {
    const parts = getManilaDateParts(new Date());

    return {
        date: parseScheduleDateKey(`${parts.year}-${parts.month}-${parts.day}`, '12:00'),
        time: `${parts.hour}:${parts.minute}`,
    };
};

const getManilaDayKey = (value = new Date()) => getManilaDateKey(value);

const getStartOfManilaDay = (value = new Date()) => {
    const dayKey = getManilaDayKey(value);
    return new Date(`${dayKey}T00:00:00+08:00`);
};

const getWholeDayDiff = (targetDate, baseDate = new Date()) => {
    const targetStart = getStartOfManilaDay(targetDate);
    const baseStart = getStartOfManilaDay(baseDate);
    return Math.round((targetStart - baseStart) / DAY_IN_MS);
};

const getPredictiveVisitPalette = (label = '') => {
    switch (String(label || '').trim()) {
        case 'Overdue':
            return { color: '#d32f2f', bg: '#ffebee' };
        case 'Window Open':
            return { color: '#01538b', bg: '#dceffc' };
        case 'Due Soon':
            return { color: '#e65100', bg: '#fff3e0' };
        case 'On Track':
        default:
            return { color: '#2e7d32', bg: '#e8f5e9' };
    }
};

const getPredictiveVisitWindowFromTreatmentHistory = (treatmentLogs = [], today = new Date()) => {
    const validLogs = toValidTreatmentLogs(treatmentLogs);
    if (!validLogs.length) return null;

    const latest = validLogs[0];
    const latestDate = new Date(latest.date);
    if (Number.isNaN(latestDate.getTime())) return null;

    const loggedFollowUpDate = latest.nextAppointment ? new Date(latest.nextAppointment) : null;
    const hasLoggedFollowUpDate = Boolean(loggedFollowUpDate && !Number.isNaN(loggedFollowUpDate.getTime()));
    const recommendedDate = hasLoggedFollowUpDate
        ? loggedFollowUpDate
        : addMonthsToDate(latestDate, PREDICTIVE_VISIT_DEFAULT_MONTHS);

    const windowStart = addDaysToDate(recommendedDate, -PREDICTIVE_VISIT_WINDOW_DAYS);
    const windowEnd = addDaysToDate(recommendedDate, PREDICTIVE_VISIT_WINDOW_DAYS);
    const daysUntilWindowStart = getWholeDayDiff(windowStart, today);
    const daysUntilWindowEnd = getWholeDayDiff(windowEnd, today);
    const daysUntilRecommendedDate = getWholeDayDiff(recommendedDate, today);
    const daysPastWindow = daysUntilWindowEnd < 0 ? Math.abs(daysUntilWindowEnd) : 0;

    let label = 'On Track';
    if (daysUntilWindowEnd < 0) {
        label = 'Overdue';
    } else if (daysUntilWindowStart <= 0) {
        label = 'Window Open';
    } else if (daysUntilWindowStart <= PREDICTIVE_VISIT_DUE_SOON_DAYS) {
        label = 'Due Soon';
    }

    const palette = getPredictiveVisitPalette(label);
    const intervalLabel = hasLoggedFollowUpDate
        ? 'Clinic follow-up date'
        : `Every ${PREDICTIVE_VISIT_DEFAULT_MONTHS} months`;
    const recommendationReason = hasLoggedFollowUpDate
        ? 'Based on the follow-up date recorded after your latest treatment.'
        : 'Based on your most recent recorded treatment and the clinic standard preventive follow-up interval.';

    return {
        label,
        color: palette.color,
        bg: palette.bg,
        days: label === 'Overdue' ? daysPastWindow : Math.max(daysUntilRecommendedDate, 0),
        daysPastWindow,
        daysUntilWindowStart,
        daysUntilWindowEnd,
        daysUntilRecommendedDate,
        nextDate: recommendedDate.toDateString(),
        recommendedDate: recommendedDate.toISOString(),
        recommendedDateLabel: formatEmailDateLabel(recommendedDate),
        recommendedDateKey: getManilaDayKey(recommendedDate),
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        windowStartLabel: formatEmailDateLabel(windowStart),
        windowEndLabel: formatEmailDateLabel(windowEnd),
        windowLabel: `${formatEmailDateLabel(windowStart)} - ${formatEmailDateLabel(windowEnd)}`,
        windowStartKey: getManilaDayKey(windowStart),
        windowEndKey: getManilaDayKey(windowEnd),
        historyCount: validLogs.length,
        lastVisitDate: latest.date,
        lastProcedure: latest.procedure || null,
        recommendationBasis: hasLoggedFollowUpDate ? 'dentist-follow-up' : 'preventive-care',
        recommendationReason,
        intervalLabel,
        isFollowUpRecommendation: hasLoggedFollowUpDate,
        recentProcedures: validLogs.slice(0, 5).map((log, index) => ({
            id: log._id || `${log.date}-${log.procedure || 'procedure'}-${index}`,
            date: log.date,
            procedure: log.procedure || 'Treatment recorded',
        })),
    };
};

const isSameCalendarDay = (leftDate, rightDate) => {
    const left = new Date(leftDate);
    const right = new Date(rightDate);
    if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false;
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
};

const mapAppointmentStatusToQueueStatus = (status) => {
    switch (status) {
        case 'confirmed':
            return 'confirmed';
        case 'completed':
            return 'completed';
        case 'cancelled':
            return 'cancelled';
        case 'in-clinic':
            return 'in-clinic';
        default:
            return 'pending';
    }
};

const APPOINTMENT_NOTIFICATION_TYPES = new Set([
    'NEW_APPOINTMENT',
    'APPOINTMENT_CONFIRMED',
    'APPOINTMENT_DECLINED',
    'APPOINTMENT_STATUS_UPDATED',
    'APPOINTMENT_REMINDER',
    'APPOINTMENT_CANCELLED',
]);

const SUPPORT_NOTIFICATION_TYPES = new Set([
]);

const INVENTORY_NOTIFICATION_TYPES = new Set([
    'LOW_INVENTORY',
]);

const PATIENT_RECORD_NOTIFICATION_TYPES = new Set([
    'NEW_PATIENT_REGISTRATION',
    'NEW_RADIOGRAPH',
]);

const QUEUE_NOTIFICATION_TYPES = new Set([
    'QUEUE_EVENT',
]);

const getDefaultNotificationPreferences = (role = '') => {
    const normalizedRole = String(role || '').trim().toLowerCase();

    if (normalizedRole === 'dentist') {
        return {
            emailAppointments: true,
            dailySummary: false,
            criticalAlerts: true,
            scheduleAlerts: true,
            materialAlerts: true,
            patientAlerts: true,
        };
    }

    if (normalizedRole === 'secretary') {
        return {
            emailAppointments: true,
            dailySummary: false,
            criticalAlerts: true,
            appointmentAlerts: true,
            chatAlerts: true,
            queueAlerts: true,
            patientAlerts: true,
        };
    }

    return {
        emailAppointments: true,
        dailySummary: false,
        criticalAlerts: true,
    };
};

const normalizeNotificationPreferences = (role = '', current = {}, updates = {}) => {
    const defaults = getDefaultNotificationPreferences(role);
    const normalized = { ...defaults };

    Object.keys(defaults).forEach((key) => {
        if (typeof current?.[key] === 'boolean') {
            normalized[key] = current[key];
        }
        if (typeof updates?.[key] === 'boolean') {
            normalized[key] = updates[key];
        }
    });

    return normalized;
};

const getStaffNotificationPreferenceKey = (role = '', type = '') => {
    const normalizedRole = String(role || '').trim().toLowerCase();
    const normalizedType = String(type || '').trim();

    if (normalizedRole === 'dentist') {
        if (APPOINTMENT_NOTIFICATION_TYPES.has(normalizedType)) return 'scheduleAlerts';
        if (INVENTORY_NOTIFICATION_TYPES.has(normalizedType)) return 'materialAlerts';
        if (PATIENT_RECORD_NOTIFICATION_TYPES.has(normalizedType)) return 'patientAlerts';
        return 'criticalAlerts';
    }

    if (normalizedRole === 'secretary') {
        if (APPOINTMENT_NOTIFICATION_TYPES.has(normalizedType)) return 'appointmentAlerts';
        if (SUPPORT_NOTIFICATION_TYPES.has(normalizedType)) return 'chatAlerts';
        if (QUEUE_NOTIFICATION_TYPES.has(normalizedType)) return 'queueAlerts';
        if (PATIENT_RECORD_NOTIFICATION_TYPES.has(normalizedType)) return 'patientAlerts';
        return 'criticalAlerts';
    }

    if (['administrator', 'branch-manager', 'owner'].includes(normalizedRole)) {
        if (APPOINTMENT_NOTIFICATION_TYPES.has(normalizedType)) return 'emailAppointments';
        if (
            SUPPORT_NOTIFICATION_TYPES.has(normalizedType)
            || INVENTORY_NOTIFICATION_TYPES.has(normalizedType)
            || PATIENT_RECORD_NOTIFICATION_TYPES.has(normalizedType)
            || QUEUE_NOTIFICATION_TYPES.has(normalizedType)
        ) {
            return 'criticalAlerts';
        }
    }

    return '';
};

const isPatientNotificationEnabled = (patient = null, type = '') => {
    if (!patient) return false;
    const normalizedType = String(type || '').trim();

    if (APPOINTMENT_NOTIFICATION_TYPES.has(normalizedType)) {
        return patient.notifAppointments !== false;
    }
    if (['PREDICTIVE_VISIT_DUE', 'PREDICTIVE_VISIT_OVERDUE'].includes(normalizedType)) {
        return patient.notifVisitWindow !== false;
    }
    if (normalizedType === 'DENTAL_HEALTH_TIP') {
        return patient.notifHealthTips !== false;
    }

    return true;
};

const isNotificationVisibleToUser = (userDoc = null, notification = null) => {
    if (!userDoc || !notification) return false;

    const normalizedRole = String(userDoc.role || '').trim().toLowerCase();
    const normalizedType = String(notification.type || '').trim();

    if (normalizedRole === 'patient') {
        return isPatientNotificationEnabled(userDoc, normalizedType);
    }

    const preferences = normalizeNotificationPreferences(
        normalizedRole,
        userDoc.notificationPreferences || {}
    );
    const preferenceKey = getStaffNotificationPreferenceKey(normalizedRole, normalizedType);

    if (!preferenceKey) {
        return true;
    }

    return preferences[preferenceKey] !== false;
};

const buildNotificationAudienceQuery = (user = null) => {
    if (!user?.id || !user?.role) {
        return null;
    }

    const normalizedRole = String(user.role || '').trim().toLowerCase();
    if (normalizedRole === 'patient') {
        return { recipientId: user.id };
    }

    return {
        $or: [
            { recipientRole: user.role },
            { recipientId: user.id }
        ]
    };
};

const createBranchScopedNotifications = async ({ type, title, message, branch, relatedId, includeOwners = false }) => {
    const notifications = [
        {
            type,
            title,
            message,
            recipientRole: 'administrator',
            relatedId,
        },
    ];

    if (includeOwners) {
        notifications.push({
            type,
            title,
            message,
            recipientRole: 'owner',
            relatedId,
        });
    }

    if (branch) {
        const branchScopedStaff = await User.find({
            role: { $in: ['secretary', 'branch-manager'] },
            status: 'active',
            isArchived: { $ne: true },
            $or: [
                { assignedBranch: branch },
                { assignedBranches: branch },
            ],
        }).select('_id');

        branchScopedStaff.forEach((staff) => {
            notifications.push({
                type,
                title,
                message,
                recipientId: staff._id,
                relatedId,
            });
        });
    }

    await Notification.insertMany(notifications);
};

const getNextQueueTicketNumber = async ({ branch, day }) => {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const last = await Queue.findOne({
        branch,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ ticketNumber: -1 });

    return last ? last.ticketNumber + 1 : 1;
};

const syncQueueEntryForAppointment = async (appointmentLike) => {
    if (!appointmentLike?._id) return null;

    const appointment = appointmentLike.populate
        ? appointmentLike
        : await Surgery.findById(appointmentLike._id)
            .populate('patient', 'name contactNumber')
            .populate('dentist', 'name');

    if (!appointment) return null;

    const normalizedSource = String(appointment.source || '').trim();
    const nextStatus = mapAppointmentStatusToQueueStatus(appointment.status);
    const existingEntry = await Queue.findOne({ linkedAppointment: appointment._id });
    const shouldKeepQueueEntry = (
        normalizedSource === 'Walk-in'
        || (normalizedSource === 'Phone Call' && ['in-clinic', 'completed', 'cancelled'].includes(nextStatus))
    );

    if (!shouldKeepQueueEntry) {
        if (existingEntry) {
            await Queue.findByIdAndDelete(existingEntry._id);
        }
        return null;
    }

    const patientName = appointment.patient?.name
        ? `${appointment.patient.name.first || ''} ${appointment.patient.name.last || ''}`.trim()
        : (appointment.guestName || 'Walk-in Patient');
    const contactNumber = appointment.patient?.contactNumber
        || appointment.guestPhone
        || '';
    const assignedDentist = appointment.dentist && appointment.dentist.name
        ? getDentistDisplayName(appointment.dentist)
        : '';

    const basePayload = {
        linkedAppointment: appointment._id,
        patientName,
        patientId: appointment.patient?._id || appointment.patient || null,
        branch: appointment.branch,
        status: nextStatus,
        assignedDentist,
        procedureType: appointment.procedure || '',
        contactNumber,
    };

    if (!existingEntry) {
        const ticketNumber = await getNextQueueTicketNumber({
            branch: appointment.branch,
            day: appointment.date || new Date(),
        });

        return Queue.create({
            ...basePayload,
            ticketNumber,
            calledAt: nextStatus === 'in-clinic' ? new Date() : null,
            completedAt: ['completed', 'cancelled'].includes(nextStatus) ? new Date() : null,
        });
    }

    const update = {
        ...basePayload,
        ticketNumber: existingEntry.ticketNumber,
    };
    if (nextStatus === 'in-clinic' && !existingEntry.calledAt) update.calledAt = new Date();
    if (['completed', 'cancelled'].includes(nextStatus) && !existingEntry.completedAt) {
        update.completedAt = new Date();
    }

    return Queue.findByIdAndUpdate(existingEntry._id, update, { new: true });
};

const removeQueueEntryForAppointment = async (appointmentId) => {
    if (!appointmentId) return null;
    return Queue.findOneAndDelete({ linkedAppointment: appointmentId });
};

const ensureInventoryBatchIndexes = async () => {
    try {
        const existingIndexes = await InventoryBatch.collection.indexes();
        const legacyIndex = existingIndexes.find((index) => index.name === 'legacyInventoryId_1');

        if (legacyIndex) {
            const isLegacyUniqueNullIndex = legacyIndex.unique
                && !legacyIndex.partialFilterExpression;

            if (isLegacyUniqueNullIndex) {
                await InventoryBatch.collection.dropIndex('legacyInventoryId_1');
            }
        }

        await InventoryBatch.syncIndexes();
    } catch (error) {
        console.error('Failed to ensure InventoryBatch indexes:', error.message);
    }
};

const ensureInventoryStockInNumbers = async () => {
    try {
        const batchesMissingStockInNumbers = await InventoryBatch.find({
            $or: [
                { stockInNumber: { $exists: false } },
                { stockInNumber: null },
                { stockInNumber: '' },
            ],
        }).sort({ receivedDate: 1, createdAt: 1, _id: 1 });

        for (const batch of batchesMissingStockInNumbers) {
            syncBatchStatus(batch);
            await saveInventoryBatchWithStockInNumber(batch);
        }
    } catch (error) {
        console.error('Failed to backfill inventory stock-in numbers:', error.message);
    }
};

const RESERVED_APPOINTMENT_ROUTE_IDS = new Set(['slots', 'blocked-dates', 'my-active', 'request']);

const appendRescheduleHistoryEntry = ({ appointment, nextDate, nextTime, actor, reason = '' }) => {
    const history = Array.isArray(appointment.rescheduleHistory)
        ? [...appointment.rescheduleHistory]
        : [];
    history.push({
        originalDate: appointment.date,
        originalTime: appointment.time || '',
        newDate: nextDate,
        newTime: nextTime || '',
        rescheduledBy: actor?.id || null,
        rescheduledByName: actor?.email || actor?.id || '',
        rescheduledAt: new Date(),
        reason: String(reason || '').trim(),
    });
    return history;
};

const TREATMENT_LOG_CATEGORIES = new Set([
    'General',
    'Restoration',
    'Extraction',
    'Prophylaxis',
    'Orthodontics',
    'Endodontics',
    'Prosthodontics',
    'Oral Surgery',
    'Consultation',
    'Other',
]);

const normalizeTreatmentCategory = (value) => {
    const normalized = String(value || '').trim();
    return TREATMENT_LOG_CATEGORIES.has(normalized) ? normalized : 'Other';
};

const inferTreatmentCategoryFromProcedure = (procedure = '') => {
    const value = String(procedure || '').toLowerCase();
    if (!value) return 'Other';
    if (value.includes('consult') || value.includes('check-up') || value.includes('checkup') || value.includes('general')) return 'Consultation';
    if (value.includes('prophy') || value.includes('cleaning') || value.includes('fluoride') || value.includes('sealant')) return 'Prophylaxis';
    if (value.includes('fill') || value.includes('restoration') || value.includes('pasta')) return 'Restoration';
    if (value.includes('root canal')) return 'Endodontics';
    if (value.includes('braces') || value.includes('orthodont')) return 'Orthodontics';
    if (value.includes('denture') || value.includes('crown') || value.includes('retainer')) return 'Prosthodontics';
    if (value.includes('wisdom') || value.includes('odontectomy')) return 'Oral Surgery';
    if (value.includes('extract') || value.includes('bunot')) return 'Extraction';
    return 'Other';
};

const appendAutomaticTreatmentLogIfMissing = async ({
    patientId,
    procedure,
    branch,
    dentistId = null,
    dentistName = '',
    date = new Date(),
    tooth = '',
    category = 'Other',
    notes = '',
    amountCharged = 0,
    amountPaid = 0,
    balance = 0,
    nextAppointment = null,
    sourceKey = '',
}) => {
    if (!patientId || !procedure || !branch) return;

    const patient = await User.findById(patientId).select('treatmentLogs');
    if (!patient) return;

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    const metadataToken = String(sourceKey || notes || '').trim();

    const duplicate = (patient.treatmentLogs || []).find((log) => {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);
        const matchesAutoSource = metadataToken && String(log.notes || '').includes(metadataToken);
        const matchesSameTreatment = logDate.getTime() === normalizedDate.getTime()
            && String(log.procedure || '').trim().toLowerCase() === String(procedure).trim().toLowerCase()
            && String(log.branch || '').trim().toLowerCase() === String(branch).trim().toLowerCase()
            && (!metadataToken || String(log.notes || '').includes(metadataToken));
        return matchesAutoSource || matchesSameTreatment;
    });

    if (duplicate) {
        let changed = false;
        const normalizedCategory = normalizeTreatmentCategory(category);
        const normalizedAmountCharged = normalizeCurrencyAmount(amountCharged) ?? 0;
        const normalizedAmountPaid = normalizeCurrencyAmount(amountPaid) ?? 0;
        const normalizedBalance = normalizeCurrencyAmount(balance) ?? 0;
        const normalizedNextAppointment = nextAppointment ? new Date(nextAppointment) : null;

        if (!String(duplicate.procedure || '').trim() || duplicate.procedure === 'Not specified') {
            duplicate.procedure = procedure;
            changed = true;
        }
        if (!String(duplicate.branch || '').trim()) {
            duplicate.branch = branch;
            changed = true;
        }
        if (!String(duplicate.tooth || '').trim() && tooth) {
            duplicate.tooth = tooth;
            changed = true;
        }
        if ((!duplicate.category || duplicate.category === 'Other') && normalizedCategory !== 'Other') {
            duplicate.category = normalizedCategory;
            changed = true;
        }
        if (!duplicate.dentistId && dentistId) {
            duplicate.dentistId = dentistId;
            changed = true;
        }
        if (!String(duplicate.dentistName || '').trim() && dentistName) {
            duplicate.dentistName = dentistName;
            changed = true;
        }
        if ((duplicate.amountCharged ?? 0) === 0 && normalizedAmountCharged > 0) {
            duplicate.amountCharged = normalizedAmountCharged;
            changed = true;
        }
        if ((duplicate.amountPaid ?? 0) === 0 && normalizedAmountPaid > 0) {
            duplicate.amountPaid = normalizedAmountPaid;
            changed = true;
        }
        if ((duplicate.balance ?? 0) === 0 && normalizedBalance > 0) {
            duplicate.balance = normalizedBalance;
            changed = true;
        }
        if (!duplicate.nextAppointment && normalizedNextAppointment && !Number.isNaN(normalizedNextAppointment.getTime())) {
            duplicate.nextAppointment = normalizedNextAppointment;
            changed = true;
        }
        if (metadataToken && !String(duplicate.notes || '').includes(metadataToken)) {
            duplicate.notes = [duplicate.notes, metadataToken].filter(Boolean).join(' ');
            changed = true;
        }

        if (changed) {
            await patient.save();
        }
        return;
    }

    patient.treatmentLogs.push({
        date,
        procedure,
        tooth: tooth || '',
        category: normalizeTreatmentCategory(category),
        notes: metadataToken,
        dentistId: dentistId || undefined,
        dentistName: dentistName || undefined,
        branch,
        amountCharged: normalizeCurrencyAmount(amountCharged) ?? 0,
        amountPaid: normalizeCurrencyAmount(amountPaid) ?? 0,
        balance: normalizeCurrencyAmount(balance) ?? 0,
        nextAppointment: nextAppointment ? new Date(nextAppointment) : null,
    });

    if (dentistId || dentistName) {
        patient.assignedDentistId = dentistId || patient.assignedDentistId || null;
        patient.assignedDentistName = dentistName || patient.assignedDentistName || '';
    }

    await patient.save();
};

const reconcilePatientTreatmentLogsFromCompletedAppointments = async (patientId) => {
    if (!patientId) return;

    const completedAppointments = await Surgery.find({
        patient: patientId,
        status: 'completed',
        isArchived: { $ne: true },
    }).populate('dentist', 'name');

    for (const appointment of completedAppointments) {
        await appendAutomaticTreatmentLogIfMissing({
            patientId,
            procedure: appointment.performedProcedure || appointment.procedure,
            branch: appointment.branch,
            dentistId: appointment.dentist?._id || appointment.dentist || null,
            dentistName: getDentistDisplayName(appointment.dentist),
            date: appointment.date || appointment.updatedAt || new Date(),
            category: normalizeTreatmentCategory(
                inferTreatmentCategoryFromProcedure(appointment.performedProcedure || appointment.procedure)
            ),
            sourceKey: `[AUTO-APPOINTMENT:${appointment._id}]`,
        });
    }
};

const sendAppointmentReceivedEmail = async ({ email, name, branch, date, time, procedure }) => {
    if (!email) return;

    const safeName = name || 'Patient';
    const clinic = await getClinicContactDetailsForBranch(branch);

    await resend.emails.send({
        from: 'NgitiFy Appointments <noreply@ngitify.com>',
        to: email,
        subject: 'Your Dentime appointment request is in process',
        html: buildDentimeEmailTemplate({
            clinic,
            title: 'Appointment Request Received',
            intro: 'Your appointment request is now in process. Please wait for confirmation from the clinic.',
            bodyHtml: `
                <p style="margin:0 0 14px 0;">Hello ${safeName},</p>
                <div style="background:#f7fbfe;border:1px solid #d9edf7;border-radius:18px;padding:18px;margin:18px 0;">
                    <p style="margin:0 0 8px 0;"><strong>Branch:</strong> ${branch}</p>
                    <p style="margin:0 0 8px 0;"><strong>Date:</strong> ${formatEmailDateLabel(date)}</p>
                    <p style="margin:0 0 8px 0;"><strong>Time:</strong> ${time || 'To be coordinated by the clinic'}</p>
                    <p style="margin:0;"><strong>Procedure:</strong> ${procedure}</p>
                </div>
                <p style="margin:0;">If you have questions, you may contact the clinic through the details below.</p>
            `,
        }),
    });
};

const sendAppointmentConfirmedEmail = async ({ email, name, branch, date, time, procedure, dentistName }) => {
    if (!email) return;

    const safeName = name || 'Patient';
    const clinic = await getClinicContactDetailsForBranch(branch);
    const emailTemplates = await getSystemEmailTemplates();
    const reminderCopy = formatConfiguredEmailCopy(
        emailTemplates?.appointmentReminder,
        DEFAULT_SYSTEM_EMAIL_TEMPLATES.appointmentReminder
    );

    await resend.emails.send({
        from: 'NgitiFy Appointments <noreply@ngitify.com>',
        to: email,
        subject: 'Your Dentime appointment is confirmed',
        html: buildDentimeEmailTemplate({
            clinic,
            title: 'Appointment Confirmed',
            intro: 'Your appointment request at Dentime Dental Clinic has been confirmed.',
            bodyHtml: `
                <p style="margin:0 0 14px 0;">Hello ${safeName},</p>
                <div style="background:#f7fbfe;border:1px solid #d9edf7;border-radius:18px;padding:18px;margin:18px 0;">
                    <p style="margin:0 0 8px 0;"><strong>Branch:</strong> ${branch}</p>
                    <p style="margin:0 0 8px 0;"><strong>Date:</strong> ${formatEmailDateLabel(date)}</p>
                    <p style="margin:0 0 8px 0;"><strong>Time:</strong> ${time || 'To be coordinated by the clinic'}</p>
                    <p style="margin:0 0 8px 0;"><strong>Procedure:</strong> ${procedure}</p>
                    <p style="margin:0;"><strong>Assigned Dentist:</strong> ${dentistName || 'To be assigned by the clinic'}</p>
                </div>
                ${reminderCopy ? `<p style="margin:0 0 14px 0;">${reminderCopy}</p>` : ''}
                <p style="margin:0;">If you have questions, you may contact the clinic through the details below.</p>
            `,
        }),
    });
};

const sendAppointmentDeclinedEmail = async ({ email, name, branch, date, time, procedure }) => {
    if (!email) return;

    const safeName = name || 'Patient';
    const clinic = await getClinicContactDetailsForBranch(branch);

    await resend.emails.send({
        from: 'NgitiFy Appointments <noreply@ngitify.com>',
        to: email,
        subject: 'Your Dentime appointment request was declined',
        html: buildDentimeEmailTemplate({
            clinic,
            title: 'Appointment Request Declined',
            intro: 'We were unable to confirm this appointment request at this time.',
            bodyHtml: `
                <p style="margin:0 0 14px 0;">Hello ${safeName},</p>
                <p style="margin:0 0 14px 0;">Thank you for your interest in Dentime Dental Clinic.</p>
                <div style="background:#fff8f8;border:1px solid #f4d4d4;border-radius:18px;padding:18px;margin:18px 0;">
                    <p style="margin:0 0 8px 0;"><strong>Branch:</strong> ${branch}</p>
                    <p style="margin:0 0 8px 0;"><strong>Date:</strong> ${formatEmailDateLabel(date)}</p>
                    <p style="margin:0 0 8px 0;"><strong>Time:</strong> ${time || 'To be coordinated by the clinic'}</p>
                    <p style="margin:0;"><strong>Procedure:</strong> ${procedure}</p>
                </div>
                <p style="margin:0;">If you have questions, you may contact the clinic through the details below.</p>
            `,
        }),
    });
};

const sendAppointmentRescheduledEmail = async ({ email, name, branch, date, time, procedure }) => {
    if (!email) return;

    const safeName = name || 'Patient';
    const clinic = await getClinicContactDetailsForBranch(branch);
    const emailTemplates = await getSystemEmailTemplates();
    const reminderCopy = formatConfiguredEmailCopy(
        emailTemplates?.appointmentReminder,
        DEFAULT_SYSTEM_EMAIL_TEMPLATES.appointmentReminder
    );

    await resend.emails.send({
        from: 'NgitiFy Appointments <noreply@ngitify.com>',
        to: email,
        subject: 'Your Dentime appointment has been rescheduled',
        html: buildDentimeEmailTemplate({
            clinic,
            title: 'Appointment Rescheduled',
            intro: 'Your appointment schedule has been updated by the clinic.',
            bodyHtml: `
                <p style="margin:0 0 14px 0;">Hello ${safeName},</p>
                <div style="background:#f7fbfe;border:1px solid #d9edf7;border-radius:18px;padding:18px;margin:18px 0;">
                    <p style="margin:0 0 8px 0;"><strong>Branch:</strong> ${branch}</p>
                    <p style="margin:0 0 8px 0;"><strong>Date:</strong> ${formatEmailDateLabel(date)}</p>
                    <p style="margin:0 0 8px 0;"><strong>Time:</strong> ${time || 'To be coordinated by the clinic'}</p>
                    <p style="margin:0;"><strong>Procedure:</strong> ${procedure}</p>
                </div>
                ${reminderCopy ? `<p style="margin:0 0 14px 0;">${reminderCopy}</p>` : ''}
                <p style="margin:0;">If you have questions, you may contact the clinic through the details below.</p>
            `,
        }),
    });
};

const sendPasswordResetOtpEmail = async ({ email, code }) => {
    if (!email || !code) return;
    const clinic = await getClinicContactDetails();

    await resend.emails.send({
        from: 'NgitiFy Support <noreply@ngitify.com>',
        to: email,
        subject: 'Your Dentime Password Reset Code',
        html: buildDentimeEmailTemplate({
            clinic,
            title: 'Password Reset Code',
            intro: 'Use the verification code below to continue resetting your password.',
            bodyHtml: `
                <div style="background:#f4fbff;border:1px solid #cfeffc;border-radius:18px;padding:18px;margin:18px 0;text-align:center;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#01538b;margin-bottom:10px;">One-Time Password</div>
                    <div style="font-size:28px;font-weight:800;letter-spacing:0.24em;color:#0f172a;">${code}</div>
                </div>
                <p style="margin:0;">This code will expire in 1 hour. If you did not request a password reset, you may safely ignore this email.</p>
            `,
        }),
    });
};

const normalizeEmail = (email = '') => email.trim().toLowerCase();
const isValidEmailAddress = (email = '') => GUEST_EMAIL_REGEX.test(normalizeEmail(email));

const normalizePhoneNumber = (phone = '') => {
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('63') && digits.length === 12) return `+${digits}`;
    if (digits.startsWith('0') && digits.length === 11) return `+63${digits.slice(1)}`;
    if (digits.startsWith('9') && digits.length === 10) return `+63${digits}`;
    return phone.trim();
};

const normalizeComparableText = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const normalizeComparableBirthdate = (value = '') => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return new Date(parsed.getTime() - (parsed.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const getPhoneDigits = (value = '') => String(value || '').replace(/\D/g, '');

const formatDuplicatePatientSummary = (patient) => ({
    id: patient._id,
    name: [patient.name?.first || '', patient.name?.last || ''].filter(Boolean).join(' ').trim() || patient.email || 'Unknown Patient',
    email: patient.email || '',
    contactNumber: patient.contactNumber || '',
    birthdate: patient.birthdate ? new Date(patient.birthdate).toISOString().split('T')[0] : '',
    assignedBranch: patient.assignedBranch || patient.assignedBranches?.[0] || '',
    status: patient.isArchived ? 'archived' : (patient.status || ''),
    isArchived: Boolean(patient.isArchived),
});

const buildDuplicatePatientSummary = async ({
    email = '',
    contactNumber = '',
    firstName = '',
    lastName = '',
    birthdate = '',
    excludePatientId = '',
    branchScope = '',
}) => {
    const normalizedEmail = normalizeEmail(email || '');
    const normalizedContactNumber = normalizePhoneNumber(contactNumber || '');
    const normalizedPhoneDigits = getPhoneDigits(normalizedContactNumber);
    const normalizedFirstName = normalizeComparableText(firstName || '');
    const normalizedLastName = normalizeComparableText(lastName || '');
    const normalizedBirthdate = normalizeComparableBirthdate(birthdate || '');
    const trimmedBranchScope = String(branchScope || '').trim();

    const emptyResponse = {
        hasStrongMatch: false,
        hasAnyMatch: false,
        softPhoneDuplicate: false,
        requiresManualSelection: false,
        exactEmailMatchCount: 0,
        exactPhoneMatchCount: 0,
        sameFullNameBirthdateMatchCount: 0,
        sameLastNameBirthdateMatchCount: 0,
        exactEmailMatches: [],
        exactPhoneMatches: [],
        sameFullNameBirthdateMatches: [],
        sameLastNameBirthdateMatches: [],
    };

    const shouldCheckIdentity = normalizedLastName && normalizedBirthdate;
    const shouldCheckFullIdentity = normalizedFirstName && normalizedLastName && normalizedBirthdate;
    if (!normalizedEmail && !normalizedPhoneDigits && !shouldCheckIdentity) {
        return emptyResponse;
    }

    const candidateFilter = { role: 'patient' };
    const branchOwnershipFilter = trimmedBranchScope ? buildBranchOwnershipFilter(trimmedBranchScope) : null;
    if (excludePatientId && mongoose.Types.ObjectId.isValid(excludePatientId)) {
        candidateFilter._id = { $ne: excludePatientId };
    }

    const candidateClauses = [];
    if (normalizedEmail) {
        candidateClauses.push({ email: normalizedEmail });
    }
    if (normalizedPhoneDigits) {
        candidateClauses.push({ contactNumber: { $regex: `${normalizedPhoneDigits}$` } });
    }
    if (normalizedBirthdate) {
        const birthdateStart = new Date(`${normalizedBirthdate}T00:00:00.000Z`);
        const birthdateEnd = new Date(`${normalizedBirthdate}T23:59:59.999Z`);
        candidateClauses.push({ birthdate: { $gte: birthdateStart, $lte: birthdateEnd } });
    }

    const candidates = await User.find({
        ...candidateFilter,
        ...(branchOwnershipFilter ? { $and: [branchOwnershipFilter] } : {}),
        $or: candidateClauses,
    })
        .select('name email contactNumber birthdate assignedBranch assignedBranches status isArchived')
        .limit(30)
        .lean();

    const exactEmailMatches = normalizedEmail
        ? candidates.filter((patient) => normalizeEmail(patient.email || '') === normalizedEmail)
        : [];
    const exactPhoneMatches = normalizedPhoneDigits
        ? candidates.filter((patient) => getPhoneDigits(patient.contactNumber || '') === normalizedPhoneDigits)
        : [];
    const sameFullNameBirthdateMatches = shouldCheckFullIdentity
        ? candidates.filter((patient) => (
            normalizeComparableText(patient.name?.first || '') === normalizedFirstName
            && normalizeComparableText(patient.name?.last || '') === normalizedLastName
            && normalizeComparableBirthdate(patient.birthdate) === normalizedBirthdate
        ))
        : [];
    const sameLastNameBirthdateMatches = shouldCheckIdentity
        ? candidates.filter((patient) => (
            normalizeComparableText(patient.name?.last || '') === normalizedLastName
            && normalizeComparableBirthdate(patient.birthdate) === normalizedBirthdate
        ))
        : [];

    const hasExactEmailMatch = exactEmailMatches.length > 0;
    const hasExactPhoneMatch = exactPhoneMatches.length > 0;
    const hasIdentityMatch = sameFullNameBirthdateMatches.length > 0;

    return {
        hasStrongMatch: hasExactEmailMatch || hasIdentityMatch,
        hasAnyMatch: hasExactEmailMatch
            || hasExactPhoneMatch
            || hasIdentityMatch
            || sameLastNameBirthdateMatches.length > 0,
        softPhoneDuplicate: hasExactPhoneMatch && !hasExactEmailMatch && !hasIdentityMatch,
        requiresManualSelection: exactPhoneMatches.length > 1,
        exactEmailMatchCount: exactEmailMatches.length,
        exactPhoneMatchCount: exactPhoneMatches.length,
        sameFullNameBirthdateMatchCount: sameFullNameBirthdateMatches.length,
        sameLastNameBirthdateMatchCount: sameLastNameBirthdateMatches.length,
        exactEmailMatches: exactEmailMatches.map(formatDuplicatePatientSummary),
        exactPhoneMatches: exactPhoneMatches.map(formatDuplicatePatientSummary),
        sameFullNameBirthdateMatches: sameFullNameBirthdateMatches.map(formatDuplicatePatientSummary),
        sameLastNameBirthdateMatches: sameLastNameBirthdateMatches.map(formatDuplicatePatientSummary),
    };
};

const verifyTurnstileToken = async ({ token, remoteIp }) => {
    if (!process.env.TURNSTILE_SECRET_KEY) {
        return { success: false, 'error-codes': ['missing-input-secret'] };
    }

    const formData = new FormData();
    formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (remoteIp) formData.append('remoteip', remoteIp);

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        });

        return await response.json();
    } catch (error) {
        console.error('Turnstile validation error:', error);
        return { success: false, 'error-codes': ['internal-error'] };
    }
};

const normalizeGuestAddress = (address = {}) => {
    if (!address || typeof address !== 'object') return undefined;
    return {
        country: String(address.country || 'Philippines').trim() || 'Philippines',
        region: String(address.region || '').trim(),
        province: String(address.province || '').trim(),
        city: String(address.city || '').trim(),
        barangay: String(address.barangay || '').trim(),
        houseNumber: String(address.houseNumber || '').trim(),
        street: String(address.street || '').trim(),
    };
};

const pickCanonicalAddress = (...addresses) => {
    for (const address of addresses) {
        const normalized = normalizeGuestAddress(address);
        if (normalized) return normalized;
    }
    return undefined;
};

const withLegacyAddressMirrors = (payload = {}, homeAddress) => {
    if (!homeAddress) return payload;
    return {
        ...payload,
        homeAddress,
        currentAddress: homeAddress,
        permanentAddress: homeAddress,
    };
};

const withLegacyGuestAddressMirrors = (payload = {}, homeAddress) => {
    if (!homeAddress) return payload;
    return {
        ...payload,
        guestHomeAddress: homeAddress,
        guestCurrentAddress: homeAddress,
        guestPermanentAddress: homeAddress,
    };
};

const normalizeGuestText = (value = '') => String(value || '').trim();

const normalizeGuestPhoneMaybe = (value = '') => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    return normalizePhoneNumber(trimmed);
};

const normalizeGuestBoolean = (value) => {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'yes' || normalized === 'true') return true;
        if (normalized === 'no' || normalized === 'false') return false;
    }
    return undefined;
};

const normalizeGuestStringArray = (value) => {
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        return value.split(',').map((entry) => entry.trim()).filter(Boolean);
    }
    return [];
};

const normalizeGuestProfile = (profile = {}) => {
    if (!profile || typeof profile !== 'object') return undefined;
    return {
        homePhone: normalizeGuestPhoneMaybe(profile.homePhone),
        workPhone: normalizeGuestPhoneMaybe(profile.workPhone),
        occupation: normalizeGuestText(profile.occupation),
        civilStatus: normalizeGuestText(profile.civilStatus),
        bloodType: normalizeGuestText(profile.bloodType),
        nationality: normalizeGuestText(profile.nationality) || 'Filipino',
        religion: normalizeGuestText(profile.religion),
        referredBy: normalizeGuestText(profile.referredBy),
        reasonForConsultation: normalizeGuestText(profile.reasonForConsultation),
    };
};

const normalizeGuestEmergencyContact = (contact = {}) => {
    if (!contact || typeof contact !== 'object') return undefined;
    return {
        name: normalizePersonName(contact.name),
        relationship: normalizeGuestText(contact.relationship),
        contactNumber: normalizeGuestPhoneMaybe(contact.contactNumber),
    };
};

const normalizeGuestGuardian = (guardian = {}) => {
    if (!guardian || typeof guardian !== 'object') return undefined;
    return {
        name: normalizePersonName(guardian.name),
        relationship: normalizeGuestText(guardian.relationship),
        contactNumber: normalizeGuestPhoneMaybe(guardian.contactNumber),
        occupation: normalizeGuestText(guardian.occupation),
    };
};

const normalizeGuestPhysician = (physician = {}) => {
    if (!physician || typeof physician !== 'object') return undefined;
    return {
        name: normalizePersonName(physician.name),
        specialty: normalizeGuestText(physician.specialty),
        officeAddress: normalizeGuestText(physician.officeAddress),
        officeNumber: normalizeGuestPhoneMaybe(physician.officeNumber),
    };
};

const normalizeGuestMedicalHistory = (history = {}) => {
    if (!history || typeof history !== 'object') return undefined;
    return {
        allergies: normalizeGuestStringArray(history.allergies),
        conditions: normalizeGuestStringArray(history.conditions),
        medications: normalizeGuestStringArray(history.medications),
        notes: normalizeGuestText(history.notes),
        inGoodHealth: normalizeGuestBoolean(history.inGoodHealth),
        underMedicalTreatment: normalizeGuestBoolean(history.underMedicalTreatment),
        medicalTreatmentDetails: normalizeGuestText(history.medicalTreatmentDetails),
        hadSeriousIllnessOrSurgery: normalizeGuestBoolean(history.hadSeriousIllnessOrSurgery),
        seriousIllnessOrSurgeryDetails: normalizeGuestText(history.seriousIllnessOrSurgeryDetails),
        hadHospitalization: normalizeGuestBoolean(history.hadHospitalization),
        hospitalizationDetails: normalizeGuestText(history.hospitalizationDetails),
        isTakingMedication: normalizeGuestBoolean(history.isTakingMedication),
        usesTobacco: normalizeGuestBoolean(history.usesTobacco),
        usesAlcoholOrDrugs: normalizeGuestBoolean(history.usesAlcoholOrDrugs),
        hasAllergies: normalizeGuestBoolean(history.hasAllergies),
        bleedingTime: normalizeGuestText(history.bleedingTime),
        bloodPressure: normalizeGuestText(history.bloodPressure),
        isPregnant: normalizeGuestBoolean(history.isPregnant),
        isNursing: normalizeGuestBoolean(history.isNursing),
        takingBirthControl: normalizeGuestBoolean(history.takingBirthControl),
    };
};

const normalizeGuestDentalHistory = (history = {}) => {
    if (!history || typeof history !== 'object') return undefined;
    const lastExamDateText = normalizeGuestText(history.lastExamDate);
    const lastExamDate = lastExamDateText ? new Date(`${lastExamDateText}T12:00:00`) : null;
    return {
        lastExamDate: lastExamDate && !Number.isNaN(lastExamDate.getTime()) ? lastExamDate : null,
        chiefComplaint: normalizeGuestText(history.chiefComplaint),
        notes: normalizeGuestText(history.notes),
        hadTreatmentReaction: normalizeGuestBoolean(history.hadTreatmentReaction),
        reactionDetails: normalizeGuestText(history.reactionDetails),
        hasConfidentialInfo: Boolean(history.hasConfidentialInfo),
    };
};

const normalizeGuestConsentRecord = (consent = {}, defaultVersion = '') => {
    if (!consent || typeof consent !== 'object') return undefined;
    const signedAtText = normalizeGuestText(consent.signedAt);
    const signedAt = signedAtText ? new Date(signedAtText) : null;
    return {
        acknowledged: Boolean(consent.acknowledged),
        signerName: normalizePersonName(consent.signerName),
        signerRole: normalizeGuestText(consent.signerRole),
        signedAt: signedAt && !Number.isNaN(signedAt.getTime()) ? signedAt : null,
        version: normalizeGuestText(consent.version) || defaultVersion,
    };
};

const isGuestIntakeComplete = (appointment) => {
    const profile = appointment?.guestProfile || {};
    const emergencyContact = appointment?.guestEmergencyContact || {};
    const dentalHistory = appointment?.guestDentalHistory || {};
    const medicalHistory = appointment?.guestMedicalHistory || {};
    const guestHomeAddress = pickCanonicalAddress(
        appointment?.guestHomeAddress,
        appointment?.guestCurrentAddress,
        appointment?.guestPermanentAddress,
    );

    return Boolean(appointment?.guestBirthdate) &&
        Boolean(appointment?.guestGender) &&
        isAddressComplete(guestHomeAddress) &&
        Boolean(profile?.nationality || 'Filipino') &&
        Boolean(profile?.occupation) &&
        Boolean(emergencyContact?.name) &&
        Boolean(emergencyContact?.relationship) &&
        Boolean(emergencyContact?.contactNumber) &&
        Boolean(dentalHistory?.chiefComplaint) &&
        medicalHistory?.inGoodHealth !== undefined;
};

const isAddressComplete = (address = {}) => (
    ['region', 'province', 'city', 'barangay', 'street', 'houseNumber']
        .every((field) => Boolean(String(address?.[field] || '').trim()))
);

const hasGuestRegistrationData = (appointment) => (
    isGuestIntakeComplete(appointment)
);

const buildPreRegistrationUrl = (token) => `${process.env.FRONTEND_URL}/pre-register?token=${token}`;

const sendPreRegistrationEmail = async ({ email, name, branch, date, time, procedure, token }) => {
    if (!email || !token) return;

    const safeName = name || 'Patient';
    const clinic = await getClinicContactDetailsForBranch(branch);
    const emailTemplates = await getSystemEmailTemplates();
    const reminderCopy = formatConfiguredEmailCopy(
        emailTemplates?.appointmentReminder,
        DEFAULT_SYSTEM_EMAIL_TEMPLATES.appointmentReminder
    );
    const preRegistrationUrl = buildPreRegistrationUrl(token);

    await resend.emails.send({
        from: 'NgitiFy Appointments <noreply@ngitify.com>',
        to: email,
        subject: `Complete Your Registration - ${clinic.clinicName} Appointment Confirmed`,
        html: buildDentimeEmailTemplate({
            clinic,
            title: 'Appointment Confirmed',
            intro: 'Please complete your registration so the clinic can prepare your patient record in advance.',
            bodyHtml: `
                <p style="margin:0 0 14px 0;">Hello ${safeName},</p>
                <div style="background:#f7fbfe;border:1px solid #d9edf7;border-radius:18px;padding:18px;margin:18px 0;">
                    <p style="margin:0 0 8px 0;"><strong>Branch:</strong> ${branch}</p>
                    <p style="margin:0 0 8px 0;"><strong>Date:</strong> ${formatEmailDateLabel(date)}</p>
                    <p style="margin:0 0 8px 0;"><strong>Time:</strong> ${time || 'To be coordinated by the clinic'}</p>
                    <p style="margin:0;"><strong>Procedure:</strong> ${procedure}</p>
                </div>
                ${reminderCopy ? `<p style="margin:0 0 14px 0;">${reminderCopy}</p>` : ''}
                <p style="margin:0 0 14px 0;">This secure link will expire in 72 hours.</p>
                <p style="margin:0;">If you have questions, you may contact the clinic through the details below.</p>
            `,
            ctaLabel: 'Complete Your Registration',
            ctaUrl: preRegistrationUrl,
        }),
    });
};

const splitGuestFullName = (fullName = '') => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { first: '', middle: '', last: '' };
    if (parts.length === 1) return { first: parts[0], middle: '', last: parts[0] };
    if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
    return {
        first: parts[0],
        middle: parts.slice(1, -1).join(' '),
        last: parts[parts.length - 1],
    };
};

const buildPatientPayload = ({ body = {}, fallbackGuest = null, assignedBranchOverride = '' }) => {
    const fallbackName = splitGuestFullName(fallbackGuest?.guestName || '');
    const email = normalizeEmail(body.email || fallbackGuest?.guestEmail || '');
    const contactNumber = normalizePhoneNumber(body.contactNumber || body.phone || fallbackGuest?.guestPhone || '');

    const name = {
        first: normalizePersonName(body.name?.first || body.firstName || fallbackName.first),
        middle: normalizePersonName(body.name?.middle || body.middleName || fallbackName.middle || ''),
        last: normalizePersonName(body.name?.last || body.lastName || fallbackName.last),
    };

    const assignedBranch = assignedBranchOverride || body.assignedBranch || '';
    const assignedBranches = assignedBranch ? [assignedBranch] : (
        Array.isArray(body.assignedBranches) ? body.assignedBranches.filter(Boolean) : []
    );

    const fallbackGuestProfile = fallbackGuest?.guestProfile || {};
    const fallbackEmergencyContact = fallbackGuest?.guestEmergencyContact || {};
    const fallbackGuardian = fallbackGuest?.guestGuardian || {};
    const fallbackPhysician = fallbackGuest?.guestPhysician || {};
    const fallbackMedicalHistory = fallbackGuest?.guestMedicalHistory || {};
    const fallbackDentalHistory = fallbackGuest?.guestDentalHistory || {};
    const fallbackConsentAcknowledgement = fallbackGuest?.guestConsentAcknowledgement || {};
    const fallbackDataPrivacyConsent = fallbackGuest?.guestDataPrivacyConsent || {};
    const fallbackHomeAddress = pickCanonicalAddress(
        fallbackGuest?.guestHomeAddress,
        fallbackGuest?.guestCurrentAddress,
        fallbackGuest?.guestPermanentAddress,
    );
    const homeAddress = pickCanonicalAddress(
        body.homeAddress,
        body.currentAddress,
        body.permanentAddress,
        fallbackHomeAddress,
    );

    return withLegacyAddressMirrors({
        name,
        email,
        contactNumber,
        birthdate: body.birthdate || fallbackGuest?.guestBirthdate || undefined,
        gender: body.gender || fallbackGuest?.guestGender || undefined,
        profileImage: body.profileImage || undefined,
        assignedBranch,
        assignedBranches,
        guardian: body.guardian ? normalizeGuestGuardian(body.guardian) : (fallbackGuardian || undefined),
        emergencyContact: body.emergencyContact ? normalizeGuestEmergencyContact(body.emergencyContact) : (fallbackEmergencyContact || undefined),
        homePhone: body.homePhone || fallbackGuestProfile.homePhone || undefined,
        workPhone: body.workPhone || fallbackGuestProfile.workPhone || undefined,
        referredBy: body.referredBy || fallbackGuestProfile.referredBy || undefined,
        reasonForConsultation: body.reasonForConsultation || fallbackGuestProfile.reasonForConsultation || body.dentalHistory?.chiefComplaint || fallbackDentalHistory?.chiefComplaint || undefined,
        nationality: body.nationality || fallbackGuestProfile.nationality || undefined,
        religion: body.religion || fallbackGuestProfile.religion || undefined,
        occupation: body.occupation || fallbackGuestProfile.occupation || undefined,
        civilStatus: body.civilStatus || fallbackGuestProfile.civilStatus || undefined,
        bloodType: body.bloodType || fallbackGuestProfile.bloodType || undefined,
        medicalHistory: body.medicalHistory || fallbackMedicalHistory || undefined,
        dentalHistory: body.dentalHistory || fallbackDentalHistory || undefined,
        physician: body.physician ? normalizeGuestPhysician(body.physician) : (fallbackPhysician || undefined),
        consentAcknowledgement: body.consentAcknowledgement ? normalizeGuestConsentRecord(body.consentAcknowledgement, 'Dentime Patient Form v6.1') : (fallbackConsentAcknowledgement || undefined),
        dataPrivacyConsent: body.dataPrivacyConsent ? normalizeGuestConsentRecord(body.dataPrivacyConsent, 'Data Privacy Act of 2012') : (fallbackDataPrivacyConsent || undefined),
        role: 'patient',
        isVerified: false,
        status: 'inactive',
    }, homeAddress);
};

const notifyAppointmentManagers = async ({ appointmentId, patientName, procedure, date, branch }) => {
    const message = `${patientName} requested an appointment for: ${procedure} on ${new Date(date).toDateString()} at ${branch}.`;
    await createBranchScopedNotifications({
        type: 'NEW_APPOINTMENT',
        title: 'New Appointment Request',
        message,
        branch,
        relatedId: appointmentId,
        includeOwners: true,
    });
};

app.post('/api/forgot-password', otpLimiter, async (req, res) => {
    const { email, source } = req.body;

    try {
        const normalizedEmail = normalizeEmail(email || '');
        const user = await User.findOne({ email: normalizedEmail });

        // Mobile requests: only send OTP to patient accounts.
        // Non-patient roles silently skip — no code is sent, no error is shown.
        // This mirrors the behavior of a non-existent email (prevents role enumeration).
        const isMobileNonPatient = source === 'mobile' && user && user.role !== 'patient';

        if (user && !isMobileNonPatient) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            user.resetPasswordOtp = code;
            user.resetPasswordExpires = Date.now() + 3600000;
            await user.save();

            await sendPasswordResetOtpEmail({ email: user.email, code });
        }

        // Always return 200 — prevents email/role enumeration regardless of outcome.
        res.status(200).json({ message: 'If your email is registered, you will receive a password reset code.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(200).json({ message: 'If your email is registered, you will receive a password reset code.' });
    }
});

// Mobile-only forgot password — enforces patient-role restriction server-side
app.post('/api/mobile/forgot-password', otpLimiter, async (req, res) => {
    const { email } = req.body;

    try {
        const normalizedEmail = normalizeEmail(email || '');
        const user = await User.findOne({ email: normalizedEmail });

        // Only patient accounts receive an OTP via the mobile app.
        // Non-patient roles silently skip — no code is sent, no error is shown.
        // This mirrors the behavior of a non-existent email (prevents role enumeration).
        if (user && user.role === 'patient') {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            user.resetPasswordOtp = code;
            user.resetPasswordExpires = Date.now() + 3600000;
            await user.save();

            await sendPasswordResetOtpEmail({ email: user.email, code });
        }

        // Non-existent emails still get a 200 to prevent enumeration
        res.status(200).json({ message: 'If your email is registered, you will receive a password reset code.' });

    } catch (error) {
        console.error('Mobile Forgot Password Error:', error);
        res.status(200).json({ message: 'If your email is registered, you will receive a password reset code.' });
    }
});

app.post('/api/verify-otp', otpLimiter, async (req, res) => {
    try {
        const { email, otp } = req.body;
        const normalizedEmail = normalizeEmail(email || '');
        const user = await User.findOne({ 
            email: normalizedEmail, 
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
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) {
            return res.status(400).json({ message: "Email, OTP, and new password are required." });
        }

        const normalizedEmail = normalizeEmail(email || '');
        const user = await User.findOne({ 
            email: normalizedEmail,
            resetPasswordOtp: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ message: "Reset session expired or invalid. Please request a new code." });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordOtp = undefined;
        user.resetPasswordExpires = undefined;
        user.isPasswordChanged = true;
        user.temporaryPasswordExpires = null;
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
        const normalizedEmail = normalizeEmail(email || '');
        if (!normalizedEmail) {
            return res.status(400).json({ message: "A valid email is required" });
        }

        const query = { email: normalizedEmail };
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
        const allowedRoles = ['administrator', 'branch-manager', 'owner'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const { email, licenseNumber, ...otherData } = req.body;
        const normalizedEmail = normalizeEmail(email || '');

        if (!normalizedEmail || !isValidEmailAddress(normalizedEmail)) {
            return res.status(400).json({ field: 'email', message: 'A valid email address is required.' });
        }

        const existingEmail = await User.findOne({ email: normalizedEmail });
        if (existingEmail) return res.status(409).json({ field: 'email', message: 'Email address is already registered.' });

        if (licenseNumber) {
            const existingLicense = await User.findOne({ licenseNumber });
            if (existingLicense) return res.status(409).json({ field: 'licenseNumber', message: 'License Number is already registered.' });
        }

        // Branch managers must assign the new dentist to their own branch only
        const assignedBranches = req.user.role === 'branch-manager'
            ? [req.user.assignedBranch]
            : (otherData.assignedBranches || []);

        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        const activationToken = crypto.randomBytes(32).toString('hex');

        const normalizedOtherData = withLegacyAddressMirrors(
            { ...otherData },
            pickCanonicalAddress(otherData.homeAddress, otherData.currentAddress, otherData.permanentAddress),
        );

        const newUser = new User({
            ...normalizedOtherData,
            email: normalizedEmail,
            licenseNumber,
            assignedBranches,
            password: hashedPassword,
            role: 'dentist',
            isVerified: false,
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires: null,
            isPasswordChanged: false,
        });

        await newUser.save();

        await AuditLog.create({
            action: "CREATE_USER",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            details: `Created new dentist: ${normalizedEmail}${req.user.role === 'branch-manager' ? ` (branch: ${req.user.assignedBranch})` : ''}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(normalizedEmail, 'Dentist', activationLink);
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
        const allowedRoles = ['administrator', 'branch-manager', 'owner'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const { email, ...otherData } = req.body;
        const normalizedEmail = normalizeEmail(email || '');

        if (!normalizedEmail || !isValidEmailAddress(normalizedEmail)) {
            return res.status(400).json({ field: 'email', message: 'A valid email address is required.' });
        }

        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        // Branch managers must assign the new secretary to their own branch only
        const assignedBranches = req.user.role === 'branch-manager'
            ? [req.user.assignedBranch]
            : (otherData.assignedBranches || []);

        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        const activationToken = crypto.randomBytes(32).toString('hex');

        const normalizedOtherData = withLegacyAddressMirrors(
            { ...otherData },
            pickCanonicalAddress(otherData.homeAddress, otherData.currentAddress, otherData.permanentAddress),
        );

        const newUser = new User({
            ...normalizedOtherData,
            email: normalizedEmail,
            assignedBranches,
            password: hashedPassword,
            role: 'secretary',
            isVerified: false,
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires: null,
            isPasswordChanged: false,
        });
        await newUser.save();

        await AuditLog.create({
            action: "CREATE_USER",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            details: `Created new secretary: ${normalizedEmail}${req.user.role === 'branch-manager' ? ` (branch: ${req.user.assignedBranch})` : ''}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(normalizedEmail, 'Secretary', activationLink);
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
// ADD BRANCH MANAGER (Administrator or Owner)
// -------------------------------------------------------
app.post('/api/add-branch-manager', verifyToken, async (req, res) => {
    try {
        if (!['administrator', 'owner'].includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied. Administrator or owner only." });
        }

        const { email, assignedBranch = '', ...otherData } = req.body;
        const normalizedEmail = normalizeEmail(email || '');

        if (!normalizedEmail || !isValidEmailAddress(normalizedEmail)) {
            return res.status(400).json({ field: 'email', message: 'A valid email address is required.' });
        }

        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        const activationToken = crypto.randomBytes(32).toString('hex');

        const normalizedOtherData = withLegacyAddressMirrors(
            { ...otherData },
            pickCanonicalAddress(otherData.homeAddress, otherData.currentAddress, otherData.permanentAddress),
        );

        const newUser = new User({
            ...normalizedOtherData,
            email: normalizedEmail, 
            assignedBranch,
            assignedBranches: assignedBranch ? [assignedBranch] : [],
            password: hashedPassword,
            role: 'branch-manager', // Explicitly setting the role
            isVerified: false, 
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires: null,
            isPasswordChanged: false,
        });
        await newUser.save();
        await syncBranchManagerAssignments(newUser._id, assignedBranch);

        await AuditLog.create({
            action: "CREATE_USER",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            details: `Created new branch manager: ${normalizedEmail}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(normalizedEmail, 'Branch Manager', activationLink);
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
        if (!['administrator', 'branch-manager', 'secretary', 'owner'].includes(req.user.role)) {
            return res.status(403).json({ message: "Access denied." });
        }
        const { email, assignedBranch = '', assignedBranches = [], ...otherData } = req.body;
        const normalizedEmail = normalizeEmail(email || '');
        const scopedBranch = getScopedBranchForUser(req.user);

        if (!normalizedEmail || !isValidEmailAddress(normalizedEmail)) {
            return res.status(400).json({ field: 'email', message: 'A valid email address is required before registering a patient.' });
        }

        let normalizedAssignedBranch = assignedBranch;
        let normalizedAssignedBranches = assignedBranch ? [assignedBranch] : assignedBranches;

        if (isBranchScopedStaff(req.user.role)) {
            if (!scopedBranch) {
                return res.status(403).json({ message: 'Assigned branch is required for this account.' });
            }
            normalizedAssignedBranch = scopedBranch;
            normalizedAssignedBranches = [scopedBranch];
        }

        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        const duplicateSummary = await buildDuplicatePatientSummary({
            email: normalizedEmail,
            contactNumber: otherData.contactNumber || '',
            firstName: otherData.name?.first || '',
            lastName: otherData.name?.last || '',
            birthdate: otherData.birthdate || '',
            branchScope: isBranchScopedStaff(req.user.role) ? scopedBranch : '',
        });
        if (duplicateSummary.hasStrongMatch) {
            return res.status(409).json({
                field: 'duplicateCheck',
                message: 'Possible existing patient found. Review the duplicate warning before creating a new record.',
                duplicateSummary,
            });
        }

        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        const activationToken = crypto.randomBytes(32).toString('hex');

        const normalizedOtherData = withLegacyAddressMirrors(
            { ...otherData },
            pickCanonicalAddress(otherData.homeAddress, otherData.currentAddress, otherData.permanentAddress),
        );
        const invalidPersonNameMessage = getInvalidPersonNameMessage([
            ['Patient first name', normalizedOtherData.name?.first, true],
            ['Patient middle name', normalizedOtherData.name?.middle],
            ['Patient last name', normalizedOtherData.name?.last, true],
            ['Emergency contact name', normalizedOtherData.emergencyContact?.name],
            ['Guardian name', normalizedOtherData.guardian?.name],
            ['Physician name', normalizedOtherData.physician?.name],
            ['Consent signer name', normalizedOtherData.consentAcknowledgement?.signerName],
            ['Data privacy signer name', normalizedOtherData.dataPrivacyConsent?.signerName],
        ]);
        if (invalidPersonNameMessage) {
            return res.status(400).json({ message: invalidPersonNameMessage });
        }

        const newUser = new User({
            ...normalizedOtherData,
            email: normalizedEmail,
            assignedBranch: normalizedAssignedBranch,
            assignedBranches: normalizedAssignedBranches,
            password: hashedPassword,
            role: 'patient',
            isVerified: false,
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires: null,
            isPasswordChanged: false,
        });
        await newUser.save();

        await AuditLog.create({
            action: "CREATE_PATIENT",
            user: req.user?.email || req.user?.id || "SYSTEM",
            role: req.user?.role || "SYSTEM",
            details: `Created new patient: ${normalizedEmail}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        console.log(`📧 Attempting to send activation email to: ${email}`);
        console.log(`🔗 Activation link: ${activationLink}`);

        try {
            await sendActivationEmail(normalizedEmail, 'Patient', activationLink);
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
    return res.status(410).json({ message: 'Co-Administrator accounts have been removed in Phase 2.' });
});

// -------------------------------------------------------
// ✅ PHASE 3: ADD OWNER
// -------------------------------------------------------
app.post('/api/add-owner', verifyToken, async (req, res) => {
    try {
        if (!['administrator', 'owner'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied. Admin tier or owner only.' });
        }

        const { email, isDentist, ...otherData } = req.body;
        const normalizedEmail = normalizeEmail(email || '');

        if (!normalizedEmail || !isValidEmailAddress(normalizedEmail)) {
            return res.status(400).json({ field: 'email', message: 'A valid email address is required.' });
        }

        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) return res.status(409).json({ field: 'email', message: 'Email already exists.' });

        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        const activationToken = crypto.randomBytes(32).toString('hex');

        const normalizedOtherData = withLegacyAddressMirrors(
            { ...otherData },
            pickCanonicalAddress(otherData.homeAddress, otherData.currentAddress, otherData.permanentAddress),
        );

        const newUser = new User({
            ...normalizedOtherData,
            email: normalizedEmail,
            password: hashedPassword,
            role: 'owner',
            isDentist: isDentist === true,
            isVerified: false,
            status: 'inactive',
            activationToken,
            temporaryPasswordExpires: null,
            isPasswordChanged: false,
        });
        await newUser.save();

        await AuditLog.create({
            action: 'CREATE_USER',
            user: req.user?.email || 'ADMIN',
            role: req.user?.role || 'administrator',
            details: `Created new owner account: ${normalizedEmail}${isDentist ? ' (with Dentist access)' : ''}`
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

        try {
            await sendActivationEmail(normalizedEmail, 'Owner', activationLink);
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
const SECRETARY_ALLOWED_ROLES = ['patient', 'dentist'];
const DENTIST_ALLOWED_ROLES   = ['patient', 'dentist', 'secretary'];
const BRANCH_MANAGER_ALLOWED_ROLES = ['patient', 'dentist', 'secretary'];

app.get('/api/assignable-dentists', verifyToken, async (req, res) => {
    try {
        const includeArchived = parseBooleanQueryFlag(req.query.includeArchived);
        const archivedOnly = parseBooleanQueryFlag(req.query.archivedOnly);
        let query = applyArchiveVisibilityFilter({
            $or: [
                { role: 'dentist' },
                { role: 'owner', isDentist: true },
            ],
        }, { includeArchived, archivedOnly });

        if (req.user.role === 'branch-manager' || req.user.role === 'secretary') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }
            query = applyBranchOwnershipFilter(query, req.user.assignedBranch);
        }

        const dentists = await User.find(query).select('-password');
        res.json(dentists);
    } catch (error) {
        console.error('Error fetching assignable dentists:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const { role } = req.query;
        const includeArchived = parseBooleanQueryFlag(req.query.includeArchived);
        const archivedOnly = parseBooleanQueryFlag(req.query.archivedOnly);

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

        if (req.user.role === 'branch-manager') {
            if (!role || !BRANCH_MANAGER_ALLOWED_ROLES.includes(role)) {
                return res.status(403).json({
                    message: "Access denied. You do not have permission to view these user accounts."
                });
            }
        }

        let query = applyArchiveVisibilityFilter(role ? { role } : {}, { includeArchived, archivedOnly });

        // Branch managers and secretaries can only see users in their own branch
        if (req.user.role === 'branch-manager' || req.user.role === 'secretary') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }
            query = applyBranchOwnershipFilter(query, req.user.assignedBranch);
        }

        const users = await User.find(query).select('-password');
        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Server error." });
    }
});

app.get('/api/patients', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'branch-manager', 'secretary', 'dentist', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const includeArchived = parseBooleanQueryFlag(req.query.includeArchived);
        const archivedOnly = parseBooleanQueryFlag(req.query.archivedOnly);
        let baseFilter = applyArchiveVisibilityFilter({ role: 'patient' }, { includeArchived, archivedOnly });

        // Branch-scoped staff only see patients in their assigned branch
        if (req.user.role === 'branch-manager' || req.user.role === 'secretary') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }
            baseFilter = applyBranchOwnershipFilter(baseFilter, req.user.assignedBranch);
        }

        if (req.user.role === 'dentist') {
            const dentistUser = await User.findById(req.user.id).select('name');
            const assignedPatientIds = await Surgery.distinct('patient', {
                dentist: req.user.id,
                patient: { $ne: null },
            });
            const dentistDisplayName = dentistUser?.name
                ? [dentistUser.name.first, dentistUser.name.middle, dentistUser.name.last].filter(Boolean).join(' ').trim()
                : '';
            baseFilter.$or = [
                { assignedDentistId: req.user.id },
                ...(dentistDisplayName ? [{ assignedDentistName: dentistDisplayName }] : []),
                { _id: { $in: assignedPatientIds } },
            ];
        }

        const patients = await User.find(baseFilter)
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(baseFilter);

        const patientsWithPendingPreRegistration = await attachPendingGuestPreRegistrationToPatientRecords(patients);

        res.json({ patients: patientsWithPendingPreRegistration, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/patients/duplicate-check', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'branch-manager', 'secretary', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        const scopedBranch = isBranchScopedStaff(req.user.role) ? getScopedBranchForUser(req.user) : '';
        if (isBranchScopedStaff(req.user.role) && !scopedBranch) {
            return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
        }

        const responsePayload = await buildDuplicatePatientSummary({
            email: req.body.email || '',
            contactNumber: req.body.contactNumber || req.body.phone || '',
            firstName: req.body.firstName || req.body.name?.first || '',
            lastName: req.body.lastName || req.body.name?.last || '',
            birthdate: req.body.birthdate || '',
            excludePatientId: String(req.body.excludePatientId || req.body.patientId || '').trim(),
            branchScope: scopedBranch,
        });

        return res.json(responsePayload);
    } catch (error) {
        console.error('Error checking patient duplicates:', error);
        return res.status(500).json({ message: 'Server error checking patient duplicates.' });
    }
});

app.get('/api/patients/:id', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'branch-manager', 'secretary', 'dentist', 'owner', 'patient'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const patient = await User.findById(req.params.id)
            .select('-password')
            .populate(LIFECYCLE_ACTOR_POPULATE);
        if (!patient) return res.status(404).json({ message: "Patient not found" });

        if (req.user.role === 'patient' && String(req.params.id) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Access denied. Patients can only view their own record.' });
        }

        if (req.user.role === 'branch-manager' || req.user.role === 'secretary') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }

            const patientBranches = patient.assignedBranches || (patient.assignedBranch ? [patient.assignedBranch] : []);
            if (!patientBranches.includes(req.user.assignedBranch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        const [patientWithPendingPreRegistration] = await attachPendingGuestPreRegistrationToPatientRecords([patient]);
        res.json(patientWithPendingPreRegistration);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

app.put('/api/patients/:id', verifyToken, async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedRequestedEmail = email !== undefined ? normalizeEmail(email) : undefined;
        const patientId = req.params.id;

        const currentPatient = await User.findById(patientId);
        if (!currentPatient) return res.status(404).json({ message: "Patient not found" });
        if (currentPatient.isArchived) {
            return res.status(409).json({ message: 'Restore this archived patient before editing the record.' });
        }

        if (req.user.role === 'branch-manager' || req.user.role === 'secretary') {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }

            const patientBranches = currentPatient.assignedBranches || (currentPatient.assignedBranch ? [currentPatient.assignedBranch] : []);
            if (!patientBranches.includes(req.user.assignedBranch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, currentPatient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        const currentAssignedBranch = String(currentPatient.assignedBranch || currentPatient.assignedBranches?.[0] || '').trim();
        const requestedAssignedBranch = req.body.assignedBranch !== undefined
            ? String(req.body.assignedBranch || '').trim()
            : (Array.isArray(req.body.assignedBranches) ? String(req.body.assignedBranches[0] || '').trim() : currentAssignedBranch);
        if (requestedAssignedBranch !== currentAssignedBranch) {
            return res.status(409).json({
                field: 'assignedBranch',
                message: 'Patient branch reassignment must be done through the dedicated Transfer Branch action so upcoming appointments and branch ownership can be reviewed first.',
            });
        }

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
            emergencyContact,
            homeAddress,
            currentAddress,
            permanentAddress,
            medicalHistory,
            dentalHistory,
             guardian,
             physician,
             homePhone,
             workPhone,
             referredBy,
             reasonForConsultation,
            nationality,
            religion,
            occupation,
            civilStatus,
             bloodType,
             profileImage,
             consentAcknowledgement,
             dataPrivacyConsent,
             assignedBranch,
             assignedBranches
         } = req.body;
        const resolvedHomeAddress = pickCanonicalAddress(homeAddress, currentAddress, permanentAddress);

        const updateData = withLegacyAddressMirrors({
            name,
            contactNumber,
            birthdate,
            gender,
            emergencyContact,
            medicalHistory,
            dentalHistory,
             guardian,
             physician,
             homePhone,
             workPhone,
             referredBy,
             reasonForConsultation,
            nationality,
            religion,
            occupation,
             civilStatus,
             bloodType,
             profileImage
             ,
             consentAcknowledgement,
             dataPrivacyConsent
          }, resolvedHomeAddress);
        const invalidPersonNameMessage = getInvalidPersonNameMessage([
            ['Patient first name', updateData.name?.first],
            ['Patient middle name', updateData.name?.middle],
            ['Patient last name', updateData.name?.last],
            ['Emergency contact name', updateData.emergencyContact?.name],
            ['Guardian name', updateData.guardian?.name],
            ['Physician name', updateData.physician?.name],
            ['Consent signer name', updateData.consentAcknowledgement?.signerName],
            ['Data privacy signer name', updateData.dataPrivacyConsent?.signerName],
        ]);
        if (invalidPersonNameMessage) {
            return res.status(400).json({ message: invalidPersonNameMessage });
        }

        if (req.user.role === 'secretary' && req.user.assignedBranch) {
            updateData.assignedBranch = req.user.assignedBranch;
            updateData.assignedBranches = [req.user.assignedBranch];
        } else if (assignedBranch !== undefined) {
            updateData.assignedBranch = assignedBranch;
            updateData.assignedBranches = assignedBranch ? [assignedBranch] : [];
        } else if (Array.isArray(assignedBranches)) {
            updateData.assignedBranches = assignedBranches;
            updateData.assignedBranch = assignedBranches[0] || '';
        }

        if (email !== undefined) {
            if (!normalizedRequestedEmail || !isValidEmailAddress(normalizedRequestedEmail)) {
                return res.status(400).json({ message: 'A valid patient email address is required.' });
            }
        }

        if (normalizedRequestedEmail && normalizedRequestedEmail !== currentPatient.email) {
            const emailExists = await User.findOne({ email: normalizedRequestedEmail, _id: { $ne: patientId } });
            if (emailExists) return res.status(409).json({ message: "This email address is already in use by another account." });
            updateData.email = normalizedRequestedEmail;
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

app.get('/api/patients/:id/branch-transfer-preview', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id)
            .select('name email role assignedBranch assignedBranches treatmentLogs radiographs odontogram isArchived');
        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ message: 'Patient not found.' });
        }
        if (patient.isArchived) {
            return res.status(409).json({ message: 'Restore this archived patient before transferring branches.' });
        }

        const permission = canTransferPatientBranch({ actor: req.user, patient });
        if (!permission.allowed) {
            return res.status(403).json({ message: permission.message });
        }

        const impact = await collectPatientBranchTransferImpact({
            patient,
            targetBranch: req.query.targetBranch,
        });
        res.json(impact);
    } catch (error) {
        console.error('Error loading patient branch transfer preview:', error);
        res.status(500).json({ message: 'Server error loading patient branch transfer preview.' });
    }
});

app.put('/api/patients/:id/transfer-branch', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id)
            .select('name email role assignedBranch assignedBranches treatmentLogs radiographs odontogram isArchived');
        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ message: 'Patient not found.' });
        }
        if (patient.isArchived) {
            return res.status(409).json({ message: 'Restore this archived patient before transferring branches.' });
        }

        const permission = canTransferPatientBranch({ actor: req.user, patient });
        if (!permission.allowed) {
            return res.status(403).json({ message: permission.message });
        }

        const targetBranch = String(req.body.targetBranch || '').trim();
        const reason = String(req.body.reason || '').trim();
        const currentBranch = String(patient.assignedBranch || patient.assignedBranches?.[0] || '').trim();

        if (!targetBranch) {
            return res.status(400).json({ field: 'targetBranch', message: 'Target branch is required.' });
        }
        if (!reason) {
            return res.status(400).json({ field: 'reason', message: 'Transfer reason is required.' });
        }
        if (!currentBranch) {
            return res.status(409).json({ message: 'This patient does not have a current assigned branch yet. Fix the patient branch assignment first before transferring.' });
        }
        if (targetBranch === currentBranch) {
            return res.status(409).json({ field: 'targetBranch', message: 'Select a different target branch before submitting the transfer.' });
        }

        const targetBranchRecord = await Branch.findOne({ name: targetBranch }).select('name isActive').lean();
        if (!targetBranchRecord) {
            return res.status(404).json({ field: 'targetBranch', message: 'The selected target branch does not exist.' });
        }
        if (!targetBranchRecord.isActive) {
            return res.status(409).json({ field: 'targetBranch', message: 'The selected target branch is inactive and cannot receive patient transfers.' });
        }

        const impact = await collectPatientBranchTransferImpact({ patient, targetBranch });
        if (impact.blockers.length > 0) {
            return res.status(409).json({
                message: 'This patient branch transfer is blocked until the listed branch issues are resolved.',
                blockers: impact.blockers,
                impact,
            });
        }

        patient.assignedBranch = targetBranch;
        patient.assignedBranches = [targetBranch];
        await patient.save();

        await AuditLog.create({
            action: 'TRANSFER_PATIENT_BRANCH',
            user: req.user?.email || req.user?.id || 'SYSTEM',
            role: req.user?.role || 'SYSTEM',
            details: `Transferred patient ${patient.email} from ${currentBranch} to ${targetBranch}. Reason: ${reason}`,
            metadata: {
                patientId: String(patient._id),
                previousBranch: currentBranch,
                newBranch: targetBranch,
                transferredBy: req.user?.email || req.user?.id || 'SYSTEM',
                transferredAt: new Date().toISOString(),
                reason,
            },
        });

        const updatedPatient = await User.findById(patient._id).select('-password');
        res.json({
            message: `Patient branch transferred from ${currentBranch} to ${targetBranch}.`,
            patient: updatedPatient,
            previousBranch: currentBranch,
            newBranch: targetBranch,
        });
    } catch (error) {
        console.error('Error transferring patient branch:', error);
        res.status(500).json({ message: 'Server error transferring patient branch.' });
    }
});

app.get('/api/user/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role === 'patient' && String(req.params.id) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const user = await User.findById(req.params.id)
            .select('-password')
            .populate(LIFECYCLE_ACTOR_POPULATE);
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.role === 'patient') {
            const [userWithPendingPreRegistration] = await attachPendingGuestPreRegistrationToPatientRecords([user]);
            return res.json(userWithPendingPreRegistration);
        }
        res.json(user);
    } catch (error) { res.status(500).json({ message: "Server error." }); }
});

app.get('/api/user/lifecycle-impact/:id', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const lifecyclePermission = canManageStaffLifecycle({ actor: req.user, target: user });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }

        const impact = await collectLifecycleImpact({
            actor: req.user,
            targetUser: user,
            action: req.query.action,
        });

        res.json(impact);
    } catch (error) {
        console.error('Error loading user lifecycle impact:', error);
        res.status(500).json({ message: 'Server error loading lifecycle impact.' });
    }
});

app.get('/api/patient/lifecycle-impact/:id', verifyToken, async (req, res) => {
    try {
        const allowedRoles = ['administrator', 'owner', 'branch-manager', 'secretary'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const patient = await User.findById(req.params.id);
        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ message: 'Patient not found.' });
        }

        const lifecyclePermission = canManagePatientLifecycle({ actor: req.user, patient });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }

        const impact = await collectLifecycleImpact({
            actor: req.user,
            targetUser: patient,
            action: req.query.action,
        });

        res.json(impact);
    } catch (error) {
        console.error('Error loading patient lifecycle impact:', error);
        res.status(500).json({ message: 'Server error loading lifecycle impact.' });
    }
});

app.put('/api/user/toggle-status/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const normalizedStatus = String(status || '').trim().toLowerCase();

        if (!['active', 'inactive'].includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Status must be either active or inactive.' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found." });
        const lifecyclePermission = canManageStaffLifecycle({ actor: req.user, target: user });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }
        if (user.isArchived) {
            return res.status(409).json({ message: 'Restore this archived account before changing activation status.' });
        }

        // ── Administrator Account Guard ──────────────────────────────────────
        // Only an administrator may activate or deactivate the administrator account.
        if (user.role === 'administrator' && req.user.role !== 'administrator') {
            return res.status(403).json({ message: 'Access denied. Cannot modify the administrator account.' });
        }
        // ────────────────────────────────────────────────────────────────────

        if (normalizedStatus === 'active' && !user.isVerified) {
            return res.status(400).json({
                message: "Cannot activate user. Email is not yet verified."
            });
        }

        if (normalizedStatus === 'inactive') {
            const reason = String(req.body.reason || '').trim();
            if (!reason) {
                return res.status(400).json({ message: 'A reason is required when deactivating an account.' });
            }

            const impact = await collectLifecycleImpact({
                actor: req.user,
                targetUser: user,
                action: 'deactivate',
            });
            if (!impact.allowed) {
                return res.status(409).json({
                    message: impact.blockers[0] || 'This account cannot be deactivated yet.',
                    blockers: impact.blockers,
                    impact,
                });
            }
        }

        user.status = normalizedStatus;
        if (normalizedStatus === 'inactive') {
            user.deactivatedAt = new Date();
            user.deactivatedBy = req.user.id;
            user.deactivationReason = String(req.body.reason || '').trim();
        } else {
            user.deactivatedAt = null;
            user.deactivatedBy = null;
            user.deactivationReason = '';
        }
        await user.save();

        const userStatusDetails = normalizedStatus === 'inactive' && user.deactivationReason
            ? `Changed status of user ${user.email} to ${normalizedStatus}. Reason: ${user.deactivationReason}`
            : `Changed status of user ${user.email} to ${normalizedStatus}`;

        await AuditLog.create({
            action: "STATUS_CHANGE",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            actorId: req.user?.id,
            actorRole: req.user?.role,
            targetId: user._id,
            targetModel: 'User',
            details: userStatusDetails
        });

        res.json({ message: `User marked as ${normalizedStatus}.`, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error." });
    }
});

app.put('/api/patient/toggle-status/:id', verifyToken, async (req, res) => {
    try {
        const allowedRoles = ['administrator', 'owner', 'branch-manager', 'secretary'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { id } = req.params;
        const { status } = req.body;
        const normalizedStatus = String(status || '').trim().toLowerCase();

        if (!['active', 'inactive'].includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Status must be either active or inactive.' });
        }

        const patient = await User.findById(id);
        if (!patient) return res.status(404).json({ message: "Patient not found." });
        if (patient.role !== 'patient') return res.status(404).json({ message: 'Patient not found.' });
        const lifecyclePermission = canManagePatientLifecycle({ actor: req.user, patient });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }
        if (patient.isArchived) {
            return res.status(409).json({ message: 'Restore this archived patient before changing activation status.' });
        }

        if (normalizedStatus === 'active' && !patient.isVerified) {
            return res.status(400).json({
                message: "Cannot activate patient. Email is not yet verified."
            });
        }

        if (normalizedStatus === 'inactive') {
            const reason = String(req.body.reason || '').trim();
            if (!reason) {
                return res.status(400).json({ message: 'A reason is required when deactivating a patient account.' });
            }

            const impact = await collectLifecycleImpact({
                actor: req.user,
                targetUser: patient,
                action: 'deactivate',
            });
            if (!impact.allowed) {
                return res.status(409).json({
                    message: impact.blockers[0] || 'This patient account cannot be deactivated yet.',
                    blockers: impact.blockers,
                    impact,
                });
            }
        }

        patient.status = normalizedStatus;
        if (normalizedStatus === 'inactive') {
            patient.deactivatedAt = new Date();
            patient.deactivatedBy = req.user.id;
            patient.deactivationReason = String(req.body.reason || '').trim();
        } else {
            patient.deactivatedAt = null;
            patient.deactivatedBy = null;
            patient.deactivationReason = '';
        }
        await patient.save();

        const patientStatusDetails = normalizedStatus === 'inactive' && patient.deactivationReason
            ? `Changed status of patient ${patient.email} to ${normalizedStatus}. Reason: ${patient.deactivationReason}`
            : `Changed status of patient ${patient.email} to ${normalizedStatus}`;

        await AuditLog.create({
            action: "STATUS_CHANGE",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            actorId: req.user?.id,
            actorRole: req.user?.role,
            targetId: patient._id,
            targetModel: 'User',
            details: patientStatusDetails
        });

        res.json({ message: `Patient marked as ${normalizedStatus}.`, patient });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error." });
    }
});

app.post('/api/patient/resend-activation/:id', verifyToken, async (req, res) => {
    try {
        const allowedRoles = ['administrator', 'owner', 'branch-manager', 'secretary'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const patient = await User.findById(req.params.id);
        if (!patient) {
            return res.status(404).json({ message: "Patient not found." });
        }
        if (patient.role !== 'patient') {
            return res.status(404).json({ message: 'Patient not found.' });
        }
        const lifecyclePermission = canManagePatientLifecycle({ actor: req.user, patient });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }
        if (patient.isArchived) {
            return res.status(409).json({ message: 'Restore this archived patient before resending activation.' });
        }
        if (patient.isVerified) {
            return res.status(400).json({ message: 'This patient account is already verified.' });
        }

        const { activationToken, activationLink } = await issueActivationSetupForAccount(patient);
        await patient.save();

        await sendActivationEmail(patient.email, 'Patient', activationLink);

        await AuditLog.create({
            action: "RESEND_ACTIVATION",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "administrator",
            details: `Resent activation email to patient ${patient.email}`
        });

        res.json({
            message: "Activation email has been resent successfully.",
            account: {
                _id: patient._id,
                status: patient.status,
                isVerified: patient.isVerified,
                isPasswordChanged: patient.isPasswordChanged,
                temporaryPasswordExpires: null,
            },
        });

    } catch (error) {
        console.error("Error resending patient activation email:", error);
        res.status(500).json({ message: "Server error while resending activation email." });
    }
});

app.post('/api/patient/reissue-access/:id', verifyToken, async (req, res) => {
    try {
        const allowedRoles = ['administrator', 'owner', 'branch-manager', 'secretary'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const patient = await User.findById(req.params.id);
        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ message: 'Patient not found.' });
        }

        const lifecyclePermission = canManagePatientLifecycle({ actor: req.user, patient });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }
        if (patient.isArchived) {
            return res.status(409).json({ message: 'Restore this archived patient before reissuing access.' });
        }
        if (patient.isVerified) {
            return res.status(400).json({ message: 'This patient already activated their account. Use the normal password reset flow instead.' });
        }

        const { activationLink } = await issueActivationSetupForAccount(patient);
        await patient.save();
        await sendAccessReissueEmail(patient.email, 'Patient', null, activationLink);

        await AuditLog.create({
            action: 'REISSUE_ACCESS',
            user: req.user?.email || req.user?.id || 'ADMIN',
            role: req.user?.role || 'administrator',
            details: `Reissued password setup email for patient ${patient.email}.`
        });

        res.json({
            message: 'A new activation email has been sent so the patient can set their password.',
            account: {
                _id: patient._id,
                status: patient.status,
                isVerified: patient.isVerified,
                isPasswordChanged: patient.isPasswordChanged,
                temporaryPasswordExpires: null,
            },
        });
    } catch (error) {
        console.error('Error reissuing patient access:', error);
        res.status(500).json({ message: 'Server error while reissuing patient access.' });
    }
});

app.post('/api/user/resend-activation/:id', verifyToken, async (req, res) => {
    try {
        const staffUser = await User.findById(req.params.id);
        if (!staffUser) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const lifecyclePermission = canManageStaffLifecycle({ actor: req.user, target: staffUser });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }
        if (staffUser.isArchived) {
            return res.status(409).json({ message: 'Restore this archived account before resending activation.' });
        }
        if (staffUser.isVerified) {
            return res.status(400).json({ message: 'This account is already verified.' });
        }

        const { activationLink } = await issueActivationSetupForAccount(staffUser);
        await staffUser.save();

        await sendActivationEmail(staffUser.email, staffUser.role, activationLink);

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

app.post('/api/user/reissue-access/:id', verifyToken, async (req, res) => {
    try {
        const staffUser = await User.findById(req.params.id);
        if (!staffUser || staffUser.role === 'patient') {
            return res.status(404).json({ message: 'User not found.' });
        }

        const lifecyclePermission = canManageStaffLifecycle({ actor: req.user, target: staffUser });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }
        if (staffUser.isArchived) {
            return res.status(409).json({ message: 'Restore this archived account before reissuing access.' });
        }
        if (staffUser.isVerified) {
            return res.status(400).json({ message: 'This account already activated. Use the normal password reset flow instead.' });
        }

        const { activationLink } = await issueActivationSetupForAccount(staffUser);
        await staffUser.save();
        await sendAccessReissueEmail(staffUser.email, staffUser.role, null, activationLink);

        await AuditLog.create({
            action: 'REISSUE_ACCESS',
            user: req.user?.email || req.user?.id || 'ADMIN',
            role: req.user?.role || 'administrator',
            details: `Reissued password setup email for ${staffUser.role} ${staffUser.email}.`
        });

        res.json({
            message: 'A new activation email has been sent so the user can set their password.',
            account: {
                _id: staffUser._id,
                status: staffUser.status,
                isVerified: staffUser.isVerified,
                isPasswordChanged: staffUser.isPasswordChanged,
                temporaryPasswordExpires: null,
            },
        });
    } catch (error) {
        console.error('Error reissuing staff access:', error);
        res.status(500).json({ message: 'Server error while reissuing user access.' });
    }
});

// -------------------------------------------------------
// UPDATE NOTIFICATION PREFERENCES (GAP 2)
// -------------------------------------------------------
app.put('/api/user/notification-preferences', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.notificationPreferences = normalizeNotificationPreferences(
            user.role,
            user.notificationPreferences || {},
            req.body || {}
        );

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

app.put('/api/user/app-consent', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.appConsentGiven = true;
        user.appConsentTimestamp = new Date();
        await user.save();

        return res.json({
            message: 'App privacy consent saved.',
            appConsentGiven: user.appConsentGiven,
            appConsentTimestamp: user.appConsentTimestamp,
        });
    } catch (error) {
        console.error('Error saving app consent:', error);
        return res.status(500).json({ message: 'Server error saving app consent.' });
    }
});

app.put('/api/user/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role === 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { password, email, role, isVerified, activationToken, isPasswordChanged, status, ...updateData } = req.body;
        const userId = req.params.id;
        const currentUser = await User.findById(userId);
        if (!currentUser) return res.status(404).json({ message: "User not found" });
        if (currentUser.isArchived) {
            return res.status(409).json({ message: 'Restore this archived account before editing the record.' });
        }
        const resolvedHomeAddress = pickCanonicalAddress(
            updateData.homeAddress,
            updateData.currentAddress,
            updateData.permanentAddress,
        );
        const normalizedUpdateData = withLegacyAddressMirrors(updateData, resolvedHomeAddress);

        if (normalizedUpdateData.assignedBranch !== undefined) {
            normalizedUpdateData.assignedBranches = normalizedUpdateData.assignedBranch ? [normalizedUpdateData.assignedBranch] : [];
        } else if (Array.isArray(normalizedUpdateData.assignedBranches)) {
            normalizedUpdateData.assignedBranch = normalizedUpdateData.assignedBranches[0] || '';
        }

        if (normalizedUpdateData.licenseNumber) {
            const normalizedLicense = String(normalizedUpdateData.licenseNumber).trim();
            if (!/^\d{7}$/.test(normalizedLicense)) {
                return res.status(400).json({ field: 'licenseNumber', message: 'License Number must be exactly 7 digits.' });
            }
            const existingLicense = await User.findOne({ _id: { $ne: userId }, licenseNumber: normalizedLicense });
            if (existingLicense) {
                return res.status(409).json({ field: 'licenseNumber', message: 'License Number is already registered.' });
            }
            normalizedUpdateData.licenseNumber = normalizedLicense;
        }

        const resolvedAssignedBranch = normalizedUpdateData.assignedBranch !== undefined
            ? normalizedUpdateData.assignedBranch
            : (Array.isArray(normalizedUpdateData.assignedBranches)
                ? (normalizedUpdateData.assignedBranches[0] || '')
                : (currentUser.assignedBranch || currentUser.assignedBranches?.[0] || ''));

        if (currentUser.role === 'administrator' && req.user.role !== 'administrator') {
            return res.status(403).json({ message: 'Access denied. Cannot modify the administrator account.' });
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

        if (email) {
            const normalizedEmail = normalizeEmail(email);
            if (!normalizedEmail || !isValidEmailAddress(normalizedEmail)) {
                return res.status(400).json({ field: 'email', message: 'A valid email address is required.' });
            }

            if (normalizedEmail !== currentUser.email) {
                const emailExists = await User.findOne({ email: normalizedEmail });
                if (emailExists) return res.status(409).json({ field: 'email', message: "New email is already in use." });

                const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
                const activationToken = crypto.randomBytes(32).toString('hex');

                normalizedUpdateData.email = normalizedEmail;
                normalizedUpdateData.password = hashedPassword;
                normalizedUpdateData.activationToken = activationToken;
                normalizedUpdateData.isVerified = false;
                normalizedUpdateData.status = 'inactive';
                normalizedUpdateData.isPasswordChanged = false;
                normalizedUpdateData.temporaryPasswordExpires = null;

                const updatedUser = await User.findByIdAndUpdate(userId, normalizedUpdateData, { new: true });
                if (currentUser.role === 'branch-manager') {
                    await syncBranchManagerAssignments(updatedUser._id, resolvedAssignedBranch);
                }

                const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;
                try {
                    await sendActivationEmail(normalizedEmail, currentUser.role, activationLink);
                } catch (emailError) {
                    console.error('Activation email failed after user update:', emailError.message);
                    return res.status(207).json({ message: 'User updated, but activation email failed to send.' });
                }

                await AuditLog.create({
                    action: 'EMAIL_CHANGE',
                    user: req.user?.email,
                    role: req.user?.role,
                    details: `Changed email for user ID ${userId} to ${normalizedEmail}`
                });

                return res.json({ message: "User updated. Re-activation email sent.", user: updatedUser });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(userId, { ...normalizedUpdateData }, { new: true });
        if (currentUser.role === 'branch-manager') {
            await syncBranchManagerAssignments(updatedUser._id, resolvedAssignedBranch);
        }

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
    const isAdminTier = req.user.role === 'administrator';
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
            homePhone,
            workPhone,
            occupation,
            civilStatus,
            nationality,
            religion,
            bloodType,
            referredBy,
            reasonForConsultation,
            emergencyContact,
            guardian,
            physician,
            medicalHistory,
            dentalHistory,
            consentAcknowledgement,
            homeAddress,
            currentAddress,
            permanentAddress,
            profileImage,
            licenseNumber,
            specialization,
            bio,
        } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const invalidPersonNameMessage = getInvalidPersonNameMessage([
            ['First name', name?.first],
            ['Middle name', name?.middle],
            ['Last name', name?.last],
            ['Emergency contact name', emergencyContact?.name],
        ]);
        if (invalidPersonNameMessage) {
            return res.status(400).json({ message: invalidPersonNameMessage });
        }

        if (name) {
            if (name.first !== undefined) user.name.first = name.first;
            if (name.middle !== undefined) user.name.middle = name.middle;
            if (name.last !== undefined) user.name.last = name.last;
        }

        if (contactNumber !== undefined) user.contactNumber = contactNumber;
        if (birthdate !== undefined) user.birthdate = birthdate;
        if (gender !== undefined) user.gender = gender;
        if (homePhone !== undefined) user.homePhone = homePhone;
        if (workPhone !== undefined) user.workPhone = workPhone;
        if (occupation !== undefined) user.occupation = occupation;
        if (civilStatus !== undefined) user.civilStatus = civilStatus;
        if (nationality !== undefined) user.nationality = nationality;
        if (religion !== undefined) user.religion = religion;
        if (bloodType !== undefined) user.bloodType = bloodType;
        if (referredBy !== undefined) user.referredBy = referredBy;
        if (reasonForConsultation !== undefined) user.reasonForConsultation = reasonForConsultation;
        if (licenseNumber !== undefined) user.licenseNumber = licenseNumber;
        if (specialization !== undefined) user.specialization = specialization;
        if (bio !== undefined) user.bio = bio;
        if (profileImage !== undefined) {
            if (profileImage && profileImage.length > 1.5 * 1024 * 1024) {
                return res.status(413).json({ message: 'Profile image must be under 1.5MB.' });
            }
            user.profileImage = profileImage;
        }

        if (emergencyContact) {
            user.emergencyContact = {
                ...user.emergencyContact?.toObject?.(),
                ...user.emergencyContact,
                ...emergencyContact
            };
        }

        if (guardian) {
            user.guardian = {
                ...user.guardian?.toObject?.(),
                ...user.guardian,
                ...guardian
            };
        }

        if (physician) {
            user.physician = {
                ...user.physician?.toObject?.(),
                ...user.physician,
                ...physician
            };
        }

        if (medicalHistory) {
            user.medicalHistory = {
                ...user.medicalHistory?.toObject?.(),
                ...user.medicalHistory,
                ...medicalHistory
            };
        }

        if (dentalHistory) {
            user.dentalHistory = {
                ...user.dentalHistory?.toObject?.(),
                ...user.dentalHistory,
                ...dentalHistory
            };
        }

        if (consentAcknowledgement) {
            user.consentAcknowledgement = {
                ...user.consentAcknowledgement?.toObject?.(),
                ...user.consentAcknowledgement,
                ...consentAcknowledgement
            };
        }

        const resolvedHomeAddress = pickCanonicalAddress(homeAddress, currentAddress, permanentAddress);
        if (resolvedHomeAddress) {
            const mergedHomeAddress = {
                ...user.homeAddress?.toObject?.(),
                ...user.homeAddress,
                ...resolvedHomeAddress,
            };
            user.homeAddress = mergedHomeAddress;
            user.currentAddress = mergedHomeAddress;
            user.permanentAddress = mergedHomeAddress;
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
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        const normalizedNewEmail = normalizeEmail(newEmail || '');
        if (!normalizedNewEmail || !isValidEmailAddress(normalizedNewEmail)) {
            return res.status(400).json({ message: 'A valid email address is required.' });
        }

        // Check new email is not already taken
        if (normalizedNewEmail === user.email) {
            return res.status(400).json({ message: 'New email must be different from your current email.' });
        }
        const emailExists = await User.findOne({ email: normalizedNewEmail });
        if (emailExists) {
            return res.status(409).json({ message: 'This email address is already in use.' });
        }

        // Generate a fresh activation token and seeded password placeholder
        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        const activationToken = crypto.randomBytes(32).toString('hex');

        user.email = normalizedNewEmail;
        user.password = hashedPassword;
        user.activationToken = activationToken;
        user.isVerified = false;
        user.status = 'inactive';
        user.isPasswordChanged = false;
        user.temporaryPasswordExpires = null;
        await user.save();

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;
        await sendActivationEmail(normalizedNewEmail, user.role, activationLink);

        await AuditLog.create({
            action: 'EMAIL_CHANGE_REQUESTED',
            user: normalizedNewEmail,
            role: user.role,
            details: `User requested email change. Activation link sent to ${normalizedNewEmail}.`
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
        if (userId !== req.user.id && req.user.role !== 'administrator') {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ message: "User not found." });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ message: "Incorrect current password." });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.isPasswordChanged = true;
        user.temporaryPasswordExpires = null;
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
    const allowedRoles = ['administrator', 'branch-manager', 'owner', 'dentist', 'secretary'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const { action, role, from, to, limit = 1000, userId } = req.query;

        const filter = {};

        if (req.user.role === 'secretary') {
            filter.user = req.user.email;
        }

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

        if (req.user.role === 'dentist') {
            filter.user = req.user.email;
        }

        if (userId && ['administrator', 'owner', 'branch-manager'].includes(req.user.role)) {
            const targetUser = await User.findById(userId).select('email assignedBranch assignedBranches');
            if (!targetUser?.email) {
                return res.status(404).json({ message: 'User not found.' });
            }

            if (req.user.role === 'branch-manager') {
                const targetBranches = targetUser.assignedBranches?.length
                    ? targetUser.assignedBranches
                    : (targetUser.assignedBranch ? [targetUser.assignedBranch] : []);

                if (!targetBranches.includes(req.user.assignedBranch) && targetUser.email !== req.user.email) {
                    return res.status(403).json({ message: 'Access denied.' });
                }
            }

            filter.user = targetUser.email;
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
    if (!INVENTORY_READ_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const branch = await getScopedInventoryBranch(req.user);
        const filter = branch ? { branch } : {};

        const batches = await InventoryBatch.find(filter)
            .populate('inventoryItem')
            .sort({ receivedDate: 1, createdAt: 1 });

        res.status(200).json(batches.map(flattenBatch));
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error fetching inventory.' });
    }
});

app.get('/api/inventory/items', verifyToken, async (req, res) => {
    if (!INVENTORY_READ_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const branch = await getScopedInventoryBranch(req.user);
        const filter = branch ? { branch } : {};
        const items = await InventoryItem.find(filter).sort({ name: 1 });
        res.status(200).json(items);
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error fetching inventory items.' });
    }
});

app.post('/api/inventory/items', verifyToken, async (req, res) => {
    if (!INVENTORY_EDIT_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const validation = validateInventoryPayload(req.body, { requireBrand: false, requireQuantity: false });
        if (!validation.isValid) {
            return res.status(400).json({ message: 'Please correct the highlighted inventory fields.', errors: validation.errors });
        }
        const branch = req.user.role === 'branch-manager'
            ? await getScopedInventoryBranch(req.user)
            : (req.body.branch || '');

        const item = await InventoryItem.create({
            name: validation.normalized.itemName,
            category: validation.normalized.category,
            unit: validation.normalized.unit || 'pcs',
            lowStockThreshold: validation.normalized.lowStockThreshold ?? 0,
            branch,
            createdBy: req.user.id || null,
        });

        await AuditLog.create({
            action: 'ADD_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Added inventory item category: ${item.name}${branch ? ` (branch: ${branch})` : ''}`
        });

        res.status(201).json(item);
    } catch (error) {
        console.error('Error adding inventory item category:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'An item with this name already exists for this branch.' });
        }
        res.status(500).json({ message: 'Server error adding item category.' });
    }
});

app.get('/api/inventory/items/:id', verifyToken, async (req, res) => {
    if (!INVENTORY_READ_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const item = await InventoryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Inventory item not found.' });
        }

        const branch = await getScopedInventoryBranch(req.user);
        if (branch && item.branch !== branch) {
            return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
        }

        res.status(200).json(item);
    } catch (error) {
        console.error('Error fetching inventory item category:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error fetching inventory item category.' });
    }
});

app.put('/api/inventory/items/:id', verifyToken, async (req, res) => {
    if (!INVENTORY_EDIT_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const validation = validateInventoryPayload(req.body, { requireBrand: false, requireQuantity: false });
        if (!validation.isValid) {
            return res.status(400).json({ message: 'Please correct the highlighted inventory fields.', errors: validation.errors });
        }

        const item = await InventoryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Inventory item not found.' });
        }

        const branch = await getScopedInventoryBranch(req.user);
        if (branch && item.branch !== branch) {
            return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
        }

        item.name = validation.normalized.itemName || item.name;
        item.category = validation.normalized.category || item.category;
        item.unit = validation.normalized.unit || item.unit;
        item.lowStockThreshold = validation.normalized.lowStockThreshold ?? item.lowStockThreshold;
        await item.save();

        await AuditLog.create({
            action: 'UPDATE_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Updated inventory item category: ${item.name}${item.branch ? ` (branch: ${item.branch})` : ''}`
        });

        res.status(200).json(item);
    } catch (error) {
        console.error('Error updating inventory item category:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'An item with this name already exists for this branch.' });
        }
        res.status(500).json({ message: 'Server error updating inventory item category.' });
    }
});

app.get('/api/inventory/items/:id/batches', verifyToken, async (req, res) => {
    if (!INVENTORY_READ_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const item = await InventoryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Inventory item not found.' });
        }

        const branch = await getScopedInventoryBranch(req.user);
        if (branch && item.branch !== branch) {
            return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
        }

        const batches = await InventoryBatch.find({ inventoryItem: item._id })
            .populate('inventoryItem')
            .sort({ receivedDate: 1, createdAt: 1 });

        res.status(200).json(batches.map(flattenBatch));
    } catch (error) {
        console.error('Error fetching inventory batches:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error fetching inventory batches.' });
    }
});

app.post('/api/inventory/batches', verifyToken, async (req, res) => {
    if (!INVENTORY_EDIT_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const validation = validateInventoryPayload(req.body);
        if (!validation.isValid) {
            return res.status(400).json({ message: 'Please correct the highlighted inventory fields.', errors: validation.errors });
        }
        const batch = await createInventoryBatchRecord(req.user, req.body);
        const item = batch.inventoryItem;

        await AuditLog.create({
            action: 'ADD_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Added inventory batch for ${item.name}${item.branch ? ` (branch: ${item.branch})` : ''}`
        });

        res.status(201).json(flattenBatch(batch));
    } catch (error) {
        console.error('Error adding inventory batch:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error adding inventory batch.' });
    }
});

app.get('/api/inventory/alerts', verifyToken, async (req, res) => {
    if (!INVENTORY_READ_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const branch = await getScopedInventoryBranch(req.user);
        const filter = branch ? { branch } : {};
        const batches = await InventoryBatch.find(filter).populate('inventoryItem');
        const flattened = batches.map(flattenBatch);

        res.status(200).json({
            lowStock: flattened.filter((entry) => entry.isLowStock),
            expiringSoon: flattened.filter((entry) => entry.isExpiringSoon),
            expired: flattened.filter((entry) => entry.isExpired),
        });
    } catch (error) {
        console.error('Error fetching inventory alerts:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error fetching inventory alerts.' });
    }
});

app.get('/api/inventory/:id', verifyToken, async (req, res) => {
    if (!INVENTORY_READ_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const batch = await InventoryBatch.findById(req.params.id).populate('inventoryItem');
        if (!batch) {
            return res.status(404).json({ message: 'Item not found.' });
        }

        const branch = await getScopedInventoryBranch(req.user);
        if (branch && batch.branch !== branch) {
            return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
        }

        res.status(200).json(flattenBatch(batch));
    } catch (error) {
        console.error('Error fetching single inventory item:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error fetching inventory item.' });
    }
});

app.post('/api/inventory', verifyToken, async (req, res) => {
    if (!INVENTORY_EDIT_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const validation = validateInventoryPayload(req.body);
        if (!validation.isValid) {
            return res.status(400).json({ message: 'Please correct the highlighted inventory fields.', errors: validation.errors });
        }
        const payload = {
            ...req.body,
            quantityReceived: req.body.quantityReceived ?? req.body.quantity ?? req.body.currentStock ?? 0,
            quantityRemaining: req.body.quantityRemaining ?? req.body.quantity ?? req.body.currentStock ?? 0,
            lowStockThreshold: req.body.lowStockThreshold ?? req.body.reorderLevel ?? req.body.threshold ?? 0,
        };
        const batch = await createInventoryBatchRecord(req.user, payload);
        const item = batch.inventoryItem;

        await AuditLog.create({
            action: 'ADD_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Added inventory batch for ${item.name}${item.branch ? ` (branch: ${item.branch})` : ''}`
        });

        res.status(201).json(flattenBatch(batch));
    } catch (error) {
        console.error('Error adding inventory item:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error adding inventory item.' });
    }
});

app.put('/api/inventory/:id', verifyToken, async (req, res) => {
    if (!INVENTORY_EDIT_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const validation = validateInventoryPayload(req.body);
        if (!validation.isValid) {
            return res.status(400).json({ message: 'Please correct the highlighted inventory fields.', errors: validation.errors });
        }
        const batch = await InventoryBatch.findById(req.params.id).populate('inventoryItem');
        if (!batch) {
            return res.status(404).json({ message: 'Item not found.' });
        }

        const branch = req.user.role === 'branch-manager' ? await getScopedInventoryBranch(req.user) : '';
        if (branch && batch.branch !== branch) {
            return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
        }

        const item = await InventoryItem.findById(batch.inventoryItem._id);
        if (!item) {
            return res.status(404).json({ message: 'Inventory item category not found.' });
        }

        item.name = validation.normalized.itemName || item.name;
        item.category = validation.normalized.category || item.category;
        item.unit = validation.normalized.unit || item.unit;
        item.lowStockThreshold = validation.normalized.lowStockThreshold ?? item.lowStockThreshold;
        await item.save();

        batch.brand = validation.normalized.brand || batch.brand || 'Unspecified';
        batch.quantityRemaining = Number(req.body.quantity ?? req.body.currentStock ?? batch.quantityRemaining);
        batch.quantityReceived = Number(req.body.quantityReceived ?? req.body.quantity ?? req.body.currentStock ?? batch.quantityReceived);
        batch.expirationDate = req.body.expirationDate === '' ? null : (req.body.expirationDate ?? batch.expirationDate);
        batch.receivedDate = req.body.receivedDate || batch.receivedDate;
        batch.supplierName = (req.body.supplierName ?? req.body.supplier ?? batch.supplierName ?? '').trim();
        batch.batchNumber = (req.body.batchNumber ?? batch.batchNumber ?? '').trim();
        syncBatchStatus(batch);
        await batch.save();
        await batch.populate('inventoryItem');

        await AuditLog.create({
            action: 'UPDATE_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Updated inventory batch for ${item.name}${item.branch ? ` (branch: ${item.branch})` : ''}`
        });

        res.status(200).json(flattenBatch(batch));
    } catch (error) {
        console.error('Error updating inventory item:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error updating inventory item.' });
    }
});

app.delete('/api/inventory/:id', verifyToken, async (req, res) => {
    if (!INVENTORY_EDIT_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        await ensureInventoryMigration();
        const batch = await InventoryBatch.findById(req.params.id).populate('inventoryItem');
        if (!batch) {
            return res.status(404).json({ message: 'Item not found.' });
        }

        const branch = req.user.role === 'branch-manager' ? await getScopedInventoryBranch(req.user) : '';
        if (branch && batch.branch !== branch) {
            return res.status(403).json({ message: 'Access denied. This item belongs to a different branch.' });
        }

        const item = batch.inventoryItem;
        await InventoryBatch.findByIdAndDelete(req.params.id);
        const remaining = await InventoryBatch.countDocuments({ inventoryItem: item._id });
        if (remaining === 0) {
            await InventoryItem.findByIdAndDelete(item._id);
        }

        await AuditLog.create({
            action: 'DELETE_INVENTORY',
            user: req.user?.email,
            role: req.user?.role,
            details: `Deleted inventory batch for ${item.name}${item.branch ? ` (branch: ${item.branch})` : ''}`
        });

        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting inventory item:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error deleting inventory item.' });
    }
});

// -------------------------------------------------------
// CREATE SURGERY / APPOINTMENT
// -------------------------------------------------------
app.post(['/api/surgeries', '/api/appointments'], verifyToken, async (req, res) => {
    const staffRoles = ['administrator', 'branch-manager', 'secretary', 'owner', 'dentist'];
    if (!staffRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const surgeryData = { ...req.body };
        const normalizedSource = String(surgeryData.source || 'Walk-in').trim();

        if (normalizedSource === 'Walk-in') {
            surgeryData.source = 'Walk-in';
            surgeryData.status = 'in-clinic';
        } else if (normalizedSource === 'Phone Call') {
            surgeryData.source = 'Phone Call';
            surgeryData.status = 'confirmed';
        } else {
            surgeryData.source = 'Appointment';
            surgeryData.status = 'pending';
        }

        if (surgeryData.source === 'Phone Call' && !surgeryData.patient) {
            const guestName = String(surgeryData.guestName || '').trim();
            const guestEmail = normalizeEmail(surgeryData.guestEmail || '');
            const guestPhone = normalizePhoneNumber(surgeryData.guestPhone || surgeryData.contactNumber || '');
            const guestPhoneDigits = guestPhone.replace(/\D/g, '');

            if (!guestName) {
                return res.status(400).json({ message: 'Guest name is required for a phone call booking without a linked patient.' });
            }
            if (!guestEmail || !GUEST_EMAIL_REGEX.test(guestEmail)) {
                return res.status(400).json({ message: 'A valid guest email is required for a phone call booking without a linked patient.' });
            }
            if (!guestPhone || !/^(63\d{10}|9\d{9})$/.test(guestPhoneDigits)) {
                return res.status(400).json({ message: 'A valid guest contact number is required for a phone call booking without a linked patient.' });
            }

            const duplicateSummary = await buildDuplicatePatientSummary({
                email: guestEmail,
                contactNumber: guestPhone,
                branchScope: isBranchScopedStaff(req.user.role) ? getScopedBranchForUser(req.user) : '',
            });
            if (duplicateSummary.exactEmailMatches.length > 0 || duplicateSummary.exactPhoneMatches.length > 0) {
                return res.status(409).json({
                    field: 'patient',
                    message: 'This phone number or email already belongs to an existing patient. Select that patient account instead of creating a guest phone call booking.',
                    duplicateSummary,
                });
            }

            surgeryData.guestName = guestName;
            surgeryData.guestEmail = guestEmail;
            surgeryData.guestPhone = guestPhone;
        }

        if (!(await isClinicProcedureAllowed(surgeryData.procedure))) {
            return res.status(400).json({ message: 'Please select a valid clinic procedure.' });
        }
        if (surgeryData.source !== 'Walk-in' && !(await isOnlineBookingProcedureAllowed(surgeryData.procedure))) {
            return res.status(400).json({
                message: 'Booked appointments may only use one of the configured online-booking procedures.',
            });
        }

        // Branch-scoped staff can only create appointments for their own branch
        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }
            surgeryData.branch = scopedBranch;
        }

        if (req.user.role === 'secretary' && surgeryData.patient) {
            const patient = await User.findById(surgeryData.patient).select('assignedBranch assignedBranches');
            if (!patientBelongsToBranch(patient, surgeryData.branch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist') {
            const dentistUser = await User.findById(req.user.id).select('assignedBranch assignedBranches');
            const dentistBranches = dentistUser?.assignedBranches?.length
                ? dentistUser.assignedBranches
                : (dentistUser?.assignedBranch ? [dentistUser.assignedBranch] : []);

            if (!surgeryData.branch || !dentistBranches.includes(surgeryData.branch)) {
                return res.status(403).json({ message: 'Access denied. Dentists can only create appointments in their assigned branch.' });
            }

            surgeryData.dentist = req.user.id;

            if (surgeryData.patient) {
                const patient = await User.findById(surgeryData.patient).select('assignedBranch assignedBranches');
                if (!patientBelongsToBranch(patient, surgeryData.branch)) {
                    return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
                }
            }
        }

        if (surgeryData.source !== 'Walk-in') {
            const slotCheck = await validateBookableAppointmentSlot({
                date: surgeryData.date,
                time: surgeryData.time,
                branch: surgeryData.branch,
            });
            if (!slotCheck.ok) {
                return res.status(slotCheck.statusCode).json({ message: slotCheck.message });
            }
            surgeryData.date = slotCheck.parsedDate;
            surgeryData.time = slotCheck.normalizedTime;
        }

        const newSurgery = new Surgery(surgeryData);
        await newSurgery.save();

        if (['Walk-in', 'Phone Call'].includes(newSurgery.source)) {
            await runPostSaveSideEffect('syncQueueEntryForAppointment:create', () => syncQueueEntryForAppointment(newSurgery));
        }

        if (newSurgery.source === 'Phone Call' && isGuestPreRegistrationAppointment(newSurgery) && !newSurgery.preRegistrationCompleted) {
            const preRegistrationFields = getGuestPreRegistrationFields(newSurgery);
            Object.assign(newSurgery, {
                preRegistrationToken: preRegistrationFields.preRegistrationToken,
                preRegistrationTokenExpiry: preRegistrationFields.preRegistrationTokenExpiry,
                preRegistrationCompleted: preRegistrationFields.preRegistrationCompleted,
            });
            await newSurgery.save();

            await runPostSaveSideEffect('audit:preRegistrationLinkSent:phoneCall', () => AuditLog.create({
                action: 'PRE_REGISTRATION_LINK_SENT',
                user: req.user?.email || req.user?.id || 'SYSTEM',
                role: req.user?.role || 'SYSTEM',
                details: `Pre-registration link sent for phone call appointment ${newSurgery._id}.`,
            }));

            await runPostSaveSideEffect('email:preRegistration:phoneCall', () => sendPreRegistrationEmail({
                email: newSurgery.guestEmail,
                name: newSurgery.guestName,
                branch: newSurgery.branch,
                date: newSurgery.date,
                time: newSurgery.time,
                procedure: newSurgery.procedure,
                token: newSurgery.preRegistrationToken,
            }));
        }

        await runPostSaveSideEffect('audit:createSurgery', () => AuditLog.create({
            action: "CREATE_SURGERY",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "SYSTEM",
            details: `Created new dental treatment record for patient ID: ${newSurgery.patient} at branch: ${newSurgery.branch}`
        }));

        if (newSurgery.dentist) {
            await runPostSaveSideEffect('notifyDentist:newAppointment', () => Notification.create({
                type: 'NEW_APPOINTMENT',
                title: 'New Appointment Assigned',
                message: `You have a new ${newSurgery.procedure} appointment on ${new Date(newSurgery.date).toDateString()} at ${newSurgery.time || 'the scheduled time'}.`,
                recipientId: newSurgery.dentist,
                recipientRole: 'dentist',
                relatedId: newSurgery._id,
            }));
        }

        if (newSurgery.patient) {
            await runPostSaveSideEffect('notifyPatient:createAppointment', async () => {
                const populatedAppointment = await Surgery.findById(newSurgery._id)
                    .populate('patient', 'name email')
                    .populate('dentist', 'name email');
                if (populatedAppointment?.patient?._id) {
                    await notifyPatientAppointmentStatusChange({
                        appointment: populatedAppointment,
                        status: populatedAppointment.status,
                    });
                }
            });
        }

        res.status(201).json(newSurgery);
    } catch (error) {
        console.error("Error creating dental treatment:", error);
        res.status(500).json({ message: "Server error creating dental treatment." });
    }
});

app.post(['/api/admin/appointments/:surgeryId/register-guest', '/api/admin/appointments/:appointmentId/register-guest'], verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'branch-manager', 'secretary', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        const appointmentId = req.params.appointmentId || req.params.surgeryId;
        const surgery = await Surgery.findById(appointmentId).populate('dentist', 'name');
        if (!surgery || surgery.isArchived) {
            return res.status(404).json({ message: 'Guest appointment not found.' });
        }

        if (surgery.patient) {
            return res.status(400).json({ message: 'This appointment is already linked to a patient account.' });
        }

        if (!GUEST_PRE_REGISTRATION_SOURCES.has(String(surgery.source || '').trim())) {
            return res.status(400).json({ message: 'Only guest website and phone call appointments can be registered through this flow.' });
        }

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch || surgery.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This appointment belongs to a different branch.' });
            }
        }

        const registrationMode = String(req.body.registrationMode || '').trim().toLowerCase();
        const requestedExistingPatientId = String(req.body.existingPatientId || '').trim();
        const duplicateCheckEmail = normalizeEmail(req.body.email || surgery.guestEmail || '');

        let existingUser = null;
        if (requestedExistingPatientId && mongoose.Types.ObjectId.isValid(requestedExistingPatientId)) {
            existingUser = await User.findById(requestedExistingPatientId)
                .select('name email birthdate role assignedBranch assignedBranches');
        }
        if (!existingUser && duplicateCheckEmail) {
            existingUser = await User.findOne({ email: duplicateCheckEmail })
                .select('name email birthdate role assignedBranch assignedBranches');
        }

        if (requestedExistingPatientId && !existingUser) {
            return res.status(404).json({
                field: 'existingPatientId',
                message: 'The selected patient account could not be found. Choose a valid existing patient or create a new patient record instead.',
            });
        }

        if (existingUser) {
            if (existingUser.role !== 'patient') {
                return res.status(409).json({
                    field: requestedExistingPatientId ? 'existingPatientId' : 'email',
                    message: requestedExistingPatientId
                        ? 'The selected account is not a patient account.'
                        : 'This email is already used by a non-patient account.',
                });
            }

            const existingPatientBranches = existingUser.assignedBranches?.length
                ? existingUser.assignedBranches
                : (existingUser.assignedBranch ? [existingUser.assignedBranch] : []);
            if (existingPatientBranches.length > 0 && !existingPatientBranches.includes(surgery.branch)) {
                return res.status(409).json({
                    field: requestedExistingPatientId ? 'existingPatientId' : 'email',
                    message: 'The selected patient belongs to a different branch. Choose a patient account assigned to this appointment branch.',
                });
            }

            if (registrationMode === 'create-new') {
                return res.status(409).json({
                    field: requestedExistingPatientId ? 'existingPatientId' : 'email',
                    message: requestedExistingPatientId
                        ? 'The selected patient already exists. Use the link existing patient flow instead of creating a new patient.'
                        : 'An existing patient already uses this email. Use the link existing patient flow instead.',
                });
            }

            const fallbackName = splitGuestFullName(surgery.guestName || '');
            const requestFirstName = req.body.name?.first || req.body.firstName || fallbackName.first;
            const requestLastName = req.body.name?.last || req.body.lastName || fallbackName.last;
            const requestBirthdate = req.body.birthdate
                || (surgery.guestBirthdate ? new Date(surgery.guestBirthdate).toISOString().split('T')[0] : '');

            if (!doesPatientIdentityMatchWebsiteRequest(existingUser, {
                firstName: requestFirstName,
                lastName: requestLastName,
                birthdate: requestBirthdate,
            })) {
                return res.status(409).json({
                    message: 'This email belongs to an existing patient, but the provided name or birthdate does not match that patient account.',
                });
            }

            surgery.patient = existingUser._id;
            surgery.guestName = undefined;
            surgery.guestEmail = undefined;
            surgery.guestPhone = undefined;
            surgery.guestBirthdate = undefined;
            surgery.guestGender = undefined;
            surgery.guestHomeAddress = undefined;
            surgery.guestCurrentAddress = undefined;
            surgery.guestPermanentAddress = undefined;
            surgery.guestProfile = undefined;
            surgery.guestEmergencyContact = undefined;
            surgery.guestGuardian = undefined;
            surgery.guestPhysician = undefined;
            surgery.guestMedicalHistory = undefined;
            surgery.guestDentalHistory = undefined;
            surgery.guestConsentAcknowledgement = undefined;
            surgery.guestDataPrivacyConsent = undefined;
            surgery.preRegistrationToken = undefined;
            surgery.preRegistrationTokenExpiry = undefined;
            surgery.preRegistrationCompleted = false;
            surgery.status = 'confirmed';
            await surgery.save();

            await AuditLog.create({
                action: 'LINK_GUEST_APPOINTMENT',
                user: req.user?.email || req.user?.id || 'SYSTEM',
                role: req.user?.role || 'SYSTEM',
                details: `Linked guest appointment ${surgery._id} to existing patient ${existingUser.email}`,
            });

            await sendAppointmentConfirmedEmail({
                email: existingUser.email,
                name: `${existingUser.name?.first || ''} ${existingUser.name?.last || ''}`.trim(),
                branch: surgery.branch,
                date: surgery.date,
                time: surgery.time,
                procedure: surgery.procedure,
                dentistName: getDentistDisplayName(surgery.dentist),
            });

            const linkedPatient = await User.findById(existingUser._id).select('-password');
            return res.status(200).json({
                message: 'Guest appointment linked to existing patient.',
                patient: linkedPatient,
                surgery,
                linkedExisting: true,
            });
        }

        if (registrationMode === 'link-existing') {
            return res.status(404).json({ message: 'No existing patient account was found for this email. Create a new patient account instead.' });
        }

        const assignedBranchOverride = isBranchScopedStaff(req.user.role)
            ? getScopedBranchForUser(req.user)
            : (req.body.assignedBranch || surgery.branch);

        const patientPayload = buildPatientPayload({
            body: req.body,
            fallbackGuest: surgery,
            assignedBranchOverride,
        });
        const invalidPersonNameMessage = getInvalidPersonNameMessage([
            ['Patient first name', patientPayload.name?.first, true],
            ['Patient middle name', patientPayload.name?.middle],
            ['Patient last name', patientPayload.name?.last, true],
            ['Emergency contact name', patientPayload.emergencyContact?.name],
            ['Guardian name', patientPayload.guardian?.name],
            ['Physician name', patientPayload.physician?.name],
            ['Consent signer name', patientPayload.consentAcknowledgement?.signerName],
            ['Data privacy signer name', patientPayload.dataPrivacyConsent?.signerName],
        ]);
        if (invalidPersonNameMessage) {
            return res.status(400).json({ message: invalidPersonNameMessage });
        }

        if (!patientPayload.name.first || !patientPayload.name.last) {
            return res.status(400).json({ message: 'Patient first and last name are required.' });
        }
        if (!patientPayload.email) {
            return res.status(400).json({ message: 'Patient email is required.' });
        }
        if (!isValidEmailAddress(patientPayload.email)) {
            return res.status(400).json({ message: 'A valid patient email address is required.' });
        }
        if (!patientPayload.contactNumber) {
            return res.status(400).json({ message: 'Patient contact number is required.' });
        }
        if (!patientPayload.birthdate || !patientPayload.gender) {
            return res.status(400).json({ message: 'Birthdate and gender are required.' });
        }
        if (!patientPayload.assignedBranch) {
            return res.status(400).json({ message: 'Assigned branch is required.' });
        }

        const duplicateSummary = await buildDuplicatePatientSummary({
            email: patientPayload.email,
            contactNumber: patientPayload.contactNumber || '',
            firstName: patientPayload.name?.first || '',
            lastName: patientPayload.name?.last || '',
            birthdate: patientPayload.birthdate || '',
            branchScope: isBranchScopedStaff(req.user.role) ? assignedBranchOverride : '',
        });
        if (duplicateSummary.hasStrongMatch) {
            return res.status(409).json({
                field: 'duplicateCheck',
                message: 'Possible existing patient found. Review the duplicate warning before creating a new record.',
                duplicateSummary,
            });
        }

        const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        const activationToken = crypto.randomBytes(32).toString('hex');

        const newUser = new User({
            ...patientPayload,
            password: hashedPassword,
            activationToken,
            temporaryPasswordExpires: null,
            isPasswordChanged: false,
        });
        await newUser.save();

        surgery.patient = newUser._id;
        surgery.guestName = undefined;
        surgery.guestEmail = undefined;
        surgery.guestPhone = undefined;
        surgery.guestBirthdate = undefined;
        surgery.guestGender = undefined;
        surgery.guestHomeAddress = undefined;
        surgery.guestCurrentAddress = undefined;
        surgery.guestPermanentAddress = undefined;
        surgery.guestProfile = undefined;
        surgery.guestEmergencyContact = undefined;
        surgery.guestGuardian = undefined;
        surgery.guestPhysician = undefined;
        surgery.guestMedicalHistory = undefined;
        surgery.guestDentalHistory = undefined;
        surgery.guestConsentAcknowledgement = undefined;
        surgery.guestDataPrivacyConsent = undefined;
        surgery.preRegistrationToken = undefined;
        surgery.preRegistrationTokenExpiry = undefined;
        surgery.preRegistrationCompleted = false;
        surgery.status = 'confirmed';
        await surgery.save();

        await AuditLog.create({
            action: 'REGISTER_GUEST_PATIENT',
            user: req.user?.email || req.user?.id || 'SYSTEM',
            role: req.user?.role || 'SYSTEM',
            details: `Registered guest appointment ${surgery._id} as patient ${newUser.email}`,
        });

        const activationLink = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;
        let message = 'Guest registered as patient and activation email sent.';
        let statusCode = 201;

        try {
            await sendActivationEmail(newUser.email, 'Patient', activationLink);
        } catch (emailError) {
            console.error('Activation email failed for registered guest patient:', emailError.message);
            message = 'Guest registered as patient, but activation email failed to send.';
            statusCode = 207;
        }

        const createdPatient = await User.findById(newUser._id).select('-password');
        return res.status(statusCode).json({
            message,
            patient: createdPatient,
            surgery,
            linkedExisting: false,
        });
    } catch (error) {
        console.error('Error registering guest appointment as patient:', error);
        return res.status(500).json({ message: 'Server error registering guest appointment.' });
    }
});

app.get(['/api/surgeries/:id', '/api/appointments/:id'], verifyToken, async (req, res, next) => {
    try {
        if (req.path.startsWith('/api/appointments/') && RESERVED_APPOINTMENT_ROUTE_IDS.has(String(req.params.id || '').trim())) {
            return next();
        }
        const surgery = await Surgery.findById(req.params.id)
            .populate('patient')
            .populate('dentist', 'name email role');
        if (!surgery) return res.status(404).json({ message: "Dental treatment not found" });

        if (isBranchScopedStaff(req.user.role) && surgery.branch !== getScopedBranchForUser(req.user)) {
            return res.status(403).json({ message: 'Access denied. This record belongs to a different branch.' });
        }

        if (req.user.role === 'dentist' && surgery.dentist?._id?.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. This appointment is not assigned to this dentist.' });
        }

        res.json(surgery);
    } catch (error) {
        console.error("Error fetching single dental treatment:", error);
        res.status(500).json({ message: "Server error fetching dental treatment." });
    }
});

app.put(['/api/surgeries/:id', '/api/appointments/:id'], verifyToken, async (req, res) => {
    try {
        const existing = await Surgery.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Dental treatment not found" });

        if (['in-clinic', 'completed', 'cancelled'].includes(String(existing.status || '').toLowerCase())) {
            return res.status(400).json({ message: 'In-clinic, completed, and cancelled schedules can no longer be edited.' });
        }

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }
            if (existing.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This record belongs to a different branch.' });
            }
            // Prevent branch-scoped staff from changing the branch field
            delete req.body.branch;
        }

        if (req.user.role === 'dentist') {
            if (existing.dentist?.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Access denied. This appointment is not assigned to this dentist.' });
            }
            delete req.body.dentist;
        }

        const updateData = { ...req.body };
        delete updateData.patient;
        delete updateData.source;
        delete updateData.branch;
        const currentDateKey = getManilaDayKey(existing.date);
        const requestedDateKey = updateData.date ? String(updateData.date).trim() : currentDateKey;
        const nextDate = updateData.date ? parseScheduleDateKey(requestedDateKey, '12:00') : existing.date;
        const nextTime = updateData.time !== undefined ? updateData.time : existing.time;
        const nextDateTime = buildAppointmentDateTime(nextDate, nextTime);

        if (updateData.procedure !== undefined && !(await isClinicProcedureAllowed(updateData.procedure))) {
            return res.status(400).json({ message: 'Please select a valid clinic procedure.' });
        }
        if (
            updateData.procedure !== undefined
            && String(existing.source || '').trim() !== 'Walk-in'
            && String(updateData.procedure || '').trim() !== String(existing.procedure || '').trim()
            && !(await isOnlineBookingProcedureAllowed(updateData.procedure))
        ) {
            return res.status(400).json({
                message: 'Booked appointments may only use one of the configured online-booking procedures.',
            });
        }

        if (updateData.status === 'completed' && existing.status !== 'in-clinic' && nextDateTime && nextDateTime > new Date()) {
            return res.status(400).json({ message: 'Appointments can only be marked completed after their scheduled date and time.' });
        }
        if (updateData.status !== undefined) {
            if (['completed', 'cancelled'].includes(String(existing.status || '').toLowerCase())) {
                return res.status(400).json({ message: 'Cannot change status of a completed or cancelled appointment.' });
            }
            if (!canTransitionAppointmentStatus({ currentStatus: existing.status, nextStatus: updateData.status })) {
                const nextAllowedStatuses = STATUS_TRANSITIONS[String(existing.status || '').toLowerCase()] || [];
                return res.status(400).json({
                    message: nextAllowedStatuses.length > 0
                        ? `Status can only be updated to ${nextAllowedStatuses.join(' or ')} from ${existing.status}.`
                        : 'This appointment status can no longer be updated.',
                });
            }
            updateData.statusReminderSentAt = null;
            updateData.statusReminderDayKey = '';
        }

        if (updateData.status === 'in-clinic') {
            const currentStamp = getCurrentScheduleStamp();
            updateData.date = currentStamp.date;
            updateData.time = currentStamp.time;
        }

        const touchesScheduleSlot = (updateData.date !== undefined || updateData.time !== undefined) && updateData.status !== 'in-clinic';
        if (String(existing.source || '').trim() !== 'Walk-in' && touchesScheduleSlot) {
            const slotCheck = await validateBookableAppointmentSlot({
                date: requestedDateKey,
                time: nextTime,
                branch: existing.branch,
                excludeAppointmentId: existing._id,
                allowCurrentSlot: requestedDateKey === currentDateKey && String(nextTime || '') === String(existing.time || ''),
            });
            if (!slotCheck.ok) {
                return res.status(slotCheck.statusCode).json({ message: slotCheck.message });
            }
            updateData.date = slotCheck.parsedDate;
            updateData.time = slotCheck.normalizedTime;
        }

        const isUnlinkedGuestAppointment = GUEST_PRE_REGISTRATION_SOURCES.has(String(existing.source || '').trim()) && !existing.patient;
        const touchesGuestIdentity = ['guestName', 'guestEmail', 'guestPhone', 'contactNumber'].some((field) => updateData[field] !== undefined);
        if (isUnlinkedGuestAppointment && touchesGuestIdentity) {
            const nextGuestName = String(updateData.guestName !== undefined ? updateData.guestName : existing.guestName || '').trim();
            const nextGuestEmail = normalizeEmail(updateData.guestEmail !== undefined ? updateData.guestEmail : existing.guestEmail || '');
            const nextGuestPhone = normalizePhoneNumber(
                updateData.guestPhone !== undefined
                    ? updateData.guestPhone
                    : (updateData.contactNumber !== undefined ? updateData.contactNumber : existing.guestPhone || '')
            );
            const nextGuestPhoneDigits = nextGuestPhone.replace(/\D/g, '');

            if (!nextGuestName) {
                return res.status(400).json({ message: 'Guest name is required for an unlinked guest appointment.' });
            }
            if (!nextGuestEmail || !GUEST_EMAIL_REGEX.test(nextGuestEmail)) {
                return res.status(400).json({ message: 'A valid guest email is required for an unlinked guest appointment.' });
            }
            if (!nextGuestPhone || !/^(63\d{10}|9\d{9})$/.test(nextGuestPhoneDigits)) {
                return res.status(400).json({ message: 'A valid guest contact number is required for an unlinked guest appointment.' });
            }

            const duplicateSummary = await buildDuplicatePatientSummary({
                email: nextGuestEmail,
                contactNumber: nextGuestPhone,
                branchScope: isBranchScopedStaff(req.user.role) ? getScopedBranchForUser(req.user) : '',
            });
            if (duplicateSummary.exactEmailMatches.length > 0 || duplicateSummary.exactPhoneMatches.length > 0) {
                return res.status(409).json({
                    field: 'patient',
                    message: 'This phone number or email already belongs to an existing patient. Select that patient account instead of keeping this as a guest phone call booking.',
                    duplicateSummary,
                });
            }

            updateData.guestName = nextGuestName;
            updateData.guestEmail = nextGuestEmail;
            updateData.guestPhone = nextGuestPhone;
            delete updateData.contactNumber;
        }

        const updatedSurgery = await Surgery.findByIdAndUpdate(req.params.id, updateData, { new: true })
            .populate('patient', 'name email')
            .populate('dentist', 'name email');
        if (!updatedSurgery) return res.status(404).json({ message: "Dental treatment not found" });

        const dentistChanged = String(existing.dentist || '') !== String(updatedSurgery.dentist?._id || updatedSurgery.dentist || '');
        const dateChanged = !!(updateData.date && !isSameCalendarDay(existing.date, nextDate));
        const timeChanged = updateData.time !== undefined && (existing.time || '') !== (nextTime || '');
        const scheduleChanged = dateChanged || timeChanged;
        const statusChanged = updateData.status !== undefined && (existing.status || '') !== (updatedSurgery.status || '');

        if (scheduleChanged) {
            updatedSurgery.statusReminderSentAt = null;
            updatedSurgery.statusReminderDayKey = '';
            await updatedSurgery.save();
        }

        if (['Walk-in', 'Phone Call'].includes(updatedSurgery.source)) {
            await runPostSaveSideEffect('syncQueueEntryForAppointment:update', () => syncQueueEntryForAppointment(updatedSurgery));
        } else if (['Walk-in', 'Phone Call'].includes(existing.source)) {
            await runPostSaveSideEffect('removeQueueEntryForAppointment:update', () => removeQueueEntryForAppointment(updatedSurgery._id));
        }

        if (updatedSurgery.dentist?._id && req.user.role !== 'dentist') {
            const dentistMessage = dentistChanged
                ? `You have been assigned to ${getPatientDisplayName(updatedSurgery)} for ${updatedSurgery.procedure} on ${new Date(updatedSurgery.date).toDateString()} at ${updatedSurgery.time || 'the scheduled time'}.`
                : statusChanged
                    ? `Your appointment for ${updatedSurgery.procedure} on ${new Date(updatedSurgery.date).toDateString()} is now marked ${updatedSurgery.status}.`
                    : scheduleChanged
                    ? `${updatedSurgery.procedure} was updated to ${new Date(updatedSurgery.date).toDateString()} at ${updatedSurgery.time || 'the scheduled time'}.`
                    : `Your appointment for ${updatedSurgery.procedure} on ${new Date(updatedSurgery.date).toDateString()} has been updated.`;

            await runPostSaveSideEffect('notifyDentist:updateAppointment', () => Notification.create({
                type: 'NEW_APPOINTMENT',
                title: dentistChanged
                    ? 'New Appointment Assigned'
                    : statusChanged
                        ? 'Appointment Status Updated'
                        : 'Appointment Schedule Updated',
                message: dentistMessage,
                recipientId: updatedSurgery.dentist._id,
                recipientRole: 'dentist',
                relatedId: updatedSurgery._id,
            }));
        }

        if (updatedSurgery.patient?._id) {
            if (statusChanged) {
                await runPostSaveSideEffect('notifyPatient:appointmentStatusUpdate', () => notifyPatientAppointmentStatusChange({
                    appointment: updatedSurgery,
                    status: updatedSurgery.status,
                }));
            } else if (scheduleChanged) {
                await runPostSaveSideEffect('notifyPatient:appointmentScheduleUpdate', () => createPatientNotification({
                    type: 'APPOINTMENT_STATUS_UPDATED',
                    title: 'Appointment Schedule Updated',
                    message: `Your appointment for ${updatedSurgery.procedure} was updated to ${formatEmailDateLabel(updatedSurgery.date)} at ${updatedSurgery.time || 'the scheduled time'}.`,
                    patientId: updatedSurgery.patient._id,
                    relatedId: updatedSurgery._id,
                }));
            }
        }

        await runPostSaveSideEffect('audit:updateSchedule', () => AuditLog.create({
            action: "UPDATE_SCHEDULE",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "SYSTEM",
            details: `Updated dental treatment record ID: ${updatedSurgery._id} at branch: ${updatedSurgery.branch}`
        }));

        res.json(updatedSurgery);
    } catch (error) {
        console.error("Error updating dental treatment:", error);
        if (error?.name === 'CastError' || error?.name === 'ValidationError') {
            return res.status(400).json({ message: error.message || 'Please review the updated schedule details and try again.' });
        }
        res.status(500).json({ message: "Error updating dental treatment." });
    }
});

app.delete(['/api/surgeries/:id', '/api/appointments/:id'], verifyToken, async (req, res) => {
    const staffRoles = ['administrator', 'branch-manager', 'secretary', 'owner', 'dentist'];
    if (!staffRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }
            const existing = await Surgery.findById(req.params.id);
            if (!existing) return res.status(404).json({ message: "Dental treatment not found" });
            if (existing.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This record belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist') {
            const existing = await Surgery.findById(req.params.id);
            if (!existing) return res.status(404).json({ message: "Dental treatment not found" });
            if (existing.dentist?.toString() !== req.user.id) {
                return res.status(403).json({ message: 'Access denied. This appointment is not assigned to this dentist.' });
            }
        }

        const archivedSurgery = await Surgery.findByIdAndUpdate(
            req.params.id,
            {
                isArchived: true,
                archivedAt: new Date(),
                archivedBy: req.user.id,
                status: 'cancelled',
            },
            { new: true }
        );
        if (!archivedSurgery) return res.status(404).json({ message: "Dental treatment not found" });

        await syncQueueEntryForAppointment(archivedSurgery);

        await AuditLog.create({
            action: "ARCHIVE_SURGERY",
            user: req.user?.email || req.user?.id || "ADMIN",
            role: req.user?.role || "SYSTEM",
            details: `Archived dental treatment record ID: ${req.params.id}`
        });

        res.json({ message: "Appointment archived successfully.", surgery: archivedSurgery });
    } catch (error) {
        console.error("Error deleting dental treatment:", error);
        res.status(500).json({ message: "Error deleting dental treatment." });
    }
});

// ============================================================
// PHASE 1 — NEW ROUTES FOR server.js
// ============================================================


// -------------------------------------------------------
// SURGERIES: FILTER BY QUERY PARAMS
// -------------------------------------------------------

app.get(['/api/surgeries', '/api/appointments'], verifyToken, async (req, res) => {
    try {
        const { patientId, status, date, dateFrom, dateTo } = req.query;
        const query = { isArchived: { $ne: true } };
        const isPatientRequest = req.user.role === 'patient';
        const requestedPatientId = patientId ? String(patientId) : '';
        const isPatientSelfRequest = isPatientRequest && (!requestedPatientId || requestedPatientId === String(req.user.id));

        if (isPatientRequest) {
            query.patient = req.user.id;
        } else if (req.user.role === 'dentist') {
            // Dentists are always scoped to their own appointments only
            query.dentist = req.user.id;
        } else if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }
            query.branch = scopedBranch;
            if (req.query.dentistId) query.dentist = req.query.dentistId;
        } else {
            // Admin-level viewers can filter by dentistId via query param
            if (req.query.dentistId) query.dentist = req.query.dentistId;
        }

        if (!isPatientRequest && patientId) query.patient = patientId;
        if (status) query.status = status;

        if (dateFrom || dateTo) {
            const start = new Date(dateFrom || dateTo);
            const end = new Date(dateTo || dateFrom);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                return res.status(400).json({ message: 'Invalid appointment date range.' });
            }
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        } else if (date) {
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

        if (!isPatientSelfRequest) {
            return res.json(surgeries);
        }

        const queueDateFilter = {};
        if (dateFrom || dateTo) {
            const start = new Date(dateFrom || dateTo);
            const end = new Date(dateTo || dateFrom);
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                queueDateFilter.createdAt = { $gte: start, $lte: end };
            }
        } else if (date) {
            const start = new Date(date);
            const end = new Date(date);
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                queueDateFilter.createdAt = { $gte: start, $lte: end };
            }
        }

        const queueEntries = await Queue.find({
            patientId: req.user.id,
            linkedAppointment: null,
            ...(status ? { status } : {}),
            ...queueDateFilter,
        }).sort({ createdAt: -1 });

        const queueAsAppointments = queueEntries.map((entry) => ({
            _id: entry._id,
            patient: req.user.id,
            dentist: null,
            dentistName: entry.assignedDentist || '',
            date: entry.completedAt || entry.calledAt || entry.createdAt,
            time: '',
            branch: entry.branch || '',
            procedure: entry.procedureType || 'Walk-in Appointment',
            notes: '',
            status: entry.status || 'pending',
            source: 'Walk-in',
            isQueueEntry: true,
        }));

        return res.json([...surgeries, ...queueAsAppointments]);
    } catch (error) {
        console.error('Error fetching surgeries:', error);
        res.status(500).json({ message: 'Server error fetching surgeries.' });
    }
});


// -------------------------------------------------------
// SURGERIES: UPDATE STATUS ONLY
// -------------------------------------------------------

app.put(['/api/surgeries/:id/status', '/api/appointments/:id/status'], verifyToken, async (req, res) => {
    try {
        const { status, remarks, preOpInstructions, date, time, dentistId, cancellationReason, performedProcedure, tooth, category, amountCharged, amountPaid, nextAppointment } = req.body;

        const allowedStatuses = ['pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const TERMINAL_STATUSES = ['completed', 'cancelled'];
        const currentSurgery = await Surgery.findById(req.params.id);
        if (!currentSurgery) return res.status(404).json({ message: 'Dental treatment not found.' });
        const shouldSendGuestDeclineEmail = (
            status === 'cancelled' &&
            isGuestPreRegistrationAppointment(currentSurgery)
        );

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch || currentSurgery.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This appointment belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist' && currentSurgery.dentist?.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. This appointment is not assigned to this dentist.' });
        }

        if (TERMINAL_STATUSES.includes(currentSurgery.status)) {
            return res.status(400).json({ message: 'Cannot change status of a completed or cancelled appointment.' });
        }
        if (!canTransitionAppointmentStatus({ currentStatus: currentSurgery.status, nextStatus: status })) {
            const nextAllowedStatuses = STATUS_TRANSITIONS[String(currentSurgery.status || '').toLowerCase()] || [];
            return res.status(400).json({
                message: nextAllowedStatuses.length > 0
                    ? `Status can only be updated to ${nextAllowedStatuses.join(' or ')} from ${currentSurgery.status}.`
                    : 'This appointment status can no longer be updated.',
            });
        }

        const nextDate = date ? (parseScheduleDateKey(String(date).trim(), '12:00') || new Date(date)) : currentSurgery.date;
        const nextTime = time !== undefined ? time : currentSurgery.time;
        const nextDateTime = buildAppointmentDateTime(nextDate, nextTime);
        const updateFields = { status };
        const isGuestPreRegistrationEntry = isGuestPreRegistrationAppointment(currentSurgery);
        if (status === 'completed' && currentSurgery.status !== 'in-clinic' && nextDateTime && nextDateTime > new Date()) {
            return res.status(400).json({ message: 'Appointments can only be marked completed after their scheduled date and time.' });
        }
        if (remarks !== undefined) updateFields.remarks = remarks;
        if (preOpInstructions !== undefined) updateFields.preOpInstructions = preOpInstructions;
        if (date) updateFields.date = nextDate;
        if (time !== undefined) updateFields.time = nextTime;
        if (dentistId !== undefined && req.user.role !== 'dentist') updateFields.dentist = dentistId || null;
        if (status === 'in-clinic') {
            const currentStamp = getCurrentScheduleStamp();
            updateFields.date = currentStamp.date;
            updateFields.time = currentStamp.time;
        }
        if (performedProcedure !== undefined) {
            updateFields.performedProcedure = String(performedProcedure || '').trim();
            if (updateFields.performedProcedure && !(await isClinicProcedureAllowed(updateFields.performedProcedure))) {
                return res.status(400).json({ message: 'Please select a valid performed procedure.' });
            }
        }
        const normalizedAmountCharged = amountCharged === undefined ? null : normalizeCurrencyAmount(amountCharged);
        const normalizedAmountPaid = amountPaid === undefined ? null : normalizeCurrencyAmount(amountPaid);
        if ((amountCharged !== undefined && normalizedAmountCharged === null) || (amountPaid !== undefined && normalizedAmountPaid === null)) {
            return res.status(400).json({ message: 'Amount charged and amount paid must be valid positive numbers.' });
        }
        const normalizedNextAppointment = nextAppointment ? new Date(nextAppointment) : null;
        if (nextAppointment && Number.isNaN(normalizedNextAppointment.getTime())) {
            return res.status(400).json({ message: 'Next appointment must be a valid date.' });
        }
        const normalizedBalance = normalizedAmountCharged !== null && normalizedAmountPaid !== null
            ? Number(Math.max(normalizedAmountCharged - normalizedAmountPaid, 0).toFixed(2))
            : 0;
        if (status === 'cancelled') {
            updateFields.cancellationReason = String(cancellationReason || currentSurgery.cancellationReason || 'Cancelled by clinic staff.').trim();
            updateFields.autoCancelledAt = null;
        } else if (cancellationReason !== undefined) {
            updateFields.cancellationReason = String(cancellationReason || '').trim();
        }
        if (status !== currentSurgery.status) {
            updateFields.statusReminderSentAt = null;
            updateFields.statusReminderDayKey = '';
        }
        if (status === 'completed' && !String(updateFields.performedProcedure || currentSurgery.performedProcedure || currentSurgery.procedure || '').trim()) {
            return res.status(400).json({ message: 'Please select the procedure performed before completing the appointment.' });
        }
        if (status === 'completed') {
            if (!String(category || '').trim()) {
                return res.status(400).json({ message: 'Please select a treatment category before completing the appointment.' });
            }
            if (normalizedAmountCharged === null || normalizedAmountPaid === null) {
                return res.status(400).json({ message: 'Please provide the amount charged and amount paid before completing the appointment.' });
            }
        }

        const scheduleChanged = (
            (date && !isSameCalendarDay(currentSurgery.date, nextDate))
            || (time !== undefined && (currentSurgery.time || '') !== (nextTime || ''))
        );
        if (scheduleChanged) {
            updateFields.rescheduleHistory = appendRescheduleHistoryEntry({
                appointment: currentSurgery,
                nextDate,
                nextTime,
                actor: req.user,
                reason: cancellationReason || remarks || '',
            });
            updateFields.statusReminderSentAt = null;
            updateFields.statusReminderDayKey = '';
        }
        let guestProvisioning = { patient: null, linkedExisting: false, requiresPreRegistration: false };
        if (currentSurgery.status !== 'confirmed' && status === 'confirmed' && isGuestPreRegistrationEntry) {
            if (!currentSurgery.patient) {
                guestProvisioning = await provisionGuestPatientAccountForAppointment({
                    surgery: currentSurgery,
                    actor: req.user,
                });
                if (guestProvisioning.errorMessage) {
                    return res.status(guestProvisioning.errorStatus || 400).json({ message: guestProvisioning.errorMessage });
                }
                if (guestProvisioning.patient?._id) {
                    updateFields.patient = guestProvisioning.patient._id;
                }
            }

            if (guestProvisioning.requiresPreRegistration && !currentSurgery.preRegistrationCompleted) {
                const preRegistrationFields = getGuestPreRegistrationFields(currentSurgery);
                Object.assign(updateFields, {
                    preRegistrationToken: preRegistrationFields.preRegistrationToken,
                    preRegistrationTokenExpiry: preRegistrationFields.preRegistrationTokenExpiry,
                    preRegistrationCompleted: preRegistrationFields.preRegistrationCompleted,
                });
            }
        }

        const updatedSurgery = await Surgery.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        ).populate('patient', 'name email').populate('dentist', 'name email');

        if (!updatedSurgery) return res.status(404).json({ message: 'Dental treatment not found.' });

        const wasConfirmedNow = currentSurgery.status !== 'confirmed' && status === 'confirmed';
        const dentistChanged = String(currentSurgery.dentist || '') !== String(updatedSurgery.dentist?._id || '');
        const statusChanged = String(currentSurgery.status || '') !== String(updatedSurgery.status || '');
        if (wasConfirmedNow) {
            const patientName = getPatientDisplayName(updatedSurgery);
            const patientEmail = updatedSurgery.patient?.email || updatedSurgery.guestEmail || '';
            const dentistName = getDentistDisplayName(updatedSurgery.dentist);

            if (updatedSurgery.patient?._id) {
                await runPostSaveSideEffect('notifyPatient:appointmentConfirmed', () => createPatientNotification({
                    type: 'APPOINTMENT_CONFIRMED',
                    title: 'Appointment Confirmed',
                    message: `Your appointment for ${updatedSurgery.procedure} on ${formatEmailDateLabel(updatedSurgery.date)} has been confirmed. Assigned dentist: ${dentistName}.`,
                    patientId: updatedSurgery.patient._id,
                    relatedId: updatedSurgery._id,
                }));
            }

            if (guestProvisioning.requiresPreRegistration && updatedSurgery.preRegistrationToken) {
                await runPostSaveSideEffect('email:preRegistration', () => sendPreRegistrationEmail({
                    email: updatedSurgery.guestEmail,
                    name: updatedSurgery.guestName,
                    branch: updatedSurgery.branch,
                    date: updatedSurgery.date,
                    time: updatedSurgery.time,
                    procedure: updatedSurgery.procedure,
                    token: updatedSurgery.preRegistrationToken,
                }));
                await runPostSaveSideEffect('audit:preRegistrationLinkSent', () => AuditLog.create({
                    action: 'PRE_REGISTRATION_LINK_SENT',
                    user: req.user?.email || req.user?.id || 'SYSTEM',
                    role: req.user?.role || 'SYSTEM',
                    details: `Pre-registration link sent for appointment ${updatedSurgery._id}.`,
                }));
            } else if (patientEmail) {
                await runPostSaveSideEffect('email:appointmentConfirmed', () => sendAppointmentConfirmedEmail({
                    email: patientEmail,
                    name: patientName,
                    branch: updatedSurgery.branch,
                    date: updatedSurgery.date,
                    time: updatedSurgery.time,
                    procedure: updatedSurgery.procedure,
                    dentistName,
                }));
            }
        }

        if (!wasConfirmedNow && dentistChanged) {
            if (updatedSurgery.patient?._id) {
                await runPostSaveSideEffect('notifyPatient:dentistAssigned', () => createPatientNotification({
                    type: 'APPOINTMENT_CONFIRMED',
                    title: 'Dentist Assigned',
                    message: `Your appointment for ${updatedSurgery.procedure} is assigned to ${getDentistDisplayName(updatedSurgery.dentist)}.`,
                    patientId: updatedSurgery.patient._id,
                    relatedId: updatedSurgery._id,
                }));
            }

            const followUpEmail = updatedSurgery.patient?.email || updatedSurgery.guestEmail || '';
            if (followUpEmail && currentSurgery.status === 'confirmed') {
                await runPostSaveSideEffect('email:dentistAssignment', () => sendAppointmentConfirmedEmail({
                    email: followUpEmail,
                    name: getPatientDisplayName(updatedSurgery),
                    branch: updatedSurgery.branch,
                    date: updatedSurgery.date,
                    time: updatedSurgery.time,
                    procedure: updatedSurgery.procedure,
                    dentistName: getDentistDisplayName(updatedSurgery.dentist),
                }));
            }
        }

        if (updatedSurgery.patient?._id) {
            if (statusChanged && !wasConfirmedNow) {
                await runPostSaveSideEffect('notifyPatient:statusChanged', () => notifyPatientAppointmentStatusChange({
                    appointment: updatedSurgery,
                    status: updatedSurgery.status,
                }));
            } else if (scheduleChanged) {
                await runPostSaveSideEffect('notifyPatient:scheduleChanged', () => createPatientNotification({
                    type: 'APPOINTMENT_STATUS_UPDATED',
                    title: 'Appointment Schedule Updated',
                    message: `Your appointment for ${updatedSurgery.procedure} was updated to ${formatEmailDateLabel(updatedSurgery.date)} at ${updatedSurgery.time || 'the scheduled time'}.`,
                    patientId: updatedSurgery.patient._id,
                    relatedId: updatedSurgery._id,
                }));
            }
        }

        if (updatedSurgery.dentist?._id && req.user.role !== 'dentist') {
            let dentistMessage = `Your appointment for ${updatedSurgery.procedure} on ${new Date(updatedSurgery.date).toDateString()} is now marked ${status}.`;
            if (scheduleChanged) {
                dentistMessage = `${updatedSurgery.procedure} was rescheduled to ${new Date(updatedSurgery.date).toDateString()} at ${updatedSurgery.time || 'the scheduled time'}.`;
            }

            await runPostSaveSideEffect('notifyDentist:statusOrScheduleChanged', () => Notification.create({
                type: status === 'cancelled' ? 'APPOINTMENT_CANCELLED' : 'NEW_APPOINTMENT',
                title: scheduleChanged ? 'Appointment Schedule Updated' : 'Appointment Status Updated',
                message: dentistMessage,
                recipientId: updatedSurgery.dentist._id,
                recipientRole: 'dentist',
                relatedId: updatedSurgery._id,
            }));
        }

        if (scheduleChanged) {
            const patientEmail = updatedSurgery.patient?.email || updatedSurgery.guestEmail || '';
            if (patientEmail) {
                await runPostSaveSideEffect('email:appointmentRescheduled', () => sendAppointmentRescheduledEmail({
                    email: patientEmail,
                    name: getPatientDisplayName(updatedSurgery),
                    branch: updatedSurgery.branch,
                    date: updatedSurgery.date,
                    time: updatedSurgery.time,
                    procedure: updatedSurgery.procedure,
                }));
            }
        }

        await runPostSaveSideEffect('audit:updateSurgeryStatus', () => AuditLog.create({
            action: 'UPDATE_SURGERY_STATUS',
            user: req.user?.email || req.user?.id,
            role: req.user?.role,
            details: `Dental treatment ID ${updatedSurgery._id} status changed to '${status}'.`
        }));

        await runPostSaveSideEffect('notifyBranchScopedStaff:appointmentStatus', () => createBranchScopedNotifications({
            type: 'APPOINTMENT_STATUS_UPDATED',
            title: 'Appointment Status Updated',
            message: `${getPatientDisplayName(updatedSurgery)}'s appointment for ${updatedSurgery.procedure} is now ${updatedSurgery.status}.`,
            branch: updatedSurgery.branch,
            relatedId: updatedSurgery._id,
            includeOwners: true,
        }));

        await runPostSaveSideEffect('syncQueueEntryForAppointment:statusUpdate', () => syncQueueEntryForAppointment(updatedSurgery));

        if (status === 'completed' && updatedSurgery.patient?._id) {
            await runPostSaveSideEffect('appendAutomaticTreatmentLog:appointmentCompleted', () => appendAutomaticTreatmentLogIfMissing({
                patientId: updatedSurgery.patient._id,
                procedure: updatedSurgery.performedProcedure || updatedSurgery.procedure,
                branch: updatedSurgery.branch,
                dentistId: updatedSurgery.dentist?._id || updatedSurgery.dentist || null,
                dentistName: getDentistDisplayName(updatedSurgery.dentist),
                date: updatedSurgery.date || new Date(),
                tooth: String(tooth || '').trim(),
                category: normalizeTreatmentCategory(category),
                amountCharged: normalizedAmountCharged ?? 0,
                amountPaid: normalizedAmountPaid ?? 0,
                balance: normalizedBalance,
                nextAppointment: normalizedNextAppointment,
                sourceKey: `[AUTO-APPOINTMENT:${updatedSurgery._id}]`,
            }));
        }

        if (shouldSendGuestDeclineEmail) {
            try {
                await sendAppointmentDeclinedEmail({
                    email: currentSurgery.guestEmail,
                    name: currentSurgery.guestName,
                    branch: currentSurgery.branch,
                    date: currentSurgery.date,
                    time: currentSurgery.time,
                    procedure: currentSurgery.procedure,
                });
            } catch (emailError) {
                console.error('Failed to send guest decline email:', emailError.message);
            }
        }

        res.json(updatedSurgery);
    } catch (error) {
        console.error('Error updating dental treatment status:', error);
        res.status(500).json({ message: 'Server error updating dental treatment status.' });
    }
});

app.get('/api/pre-register/:token', async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        if (!token) return res.status(400).json({ message: 'Pre-registration token is required.' });

        const surgery = await Surgery.findOne({ preRegistrationToken: token, isArchived: false }).lean();
        if (!surgery) return res.status(404).json({ message: 'This link is invalid.' });
        if (surgery.preRegistrationCompleted) return res.status(409).json({ message: 'You have already completed your registration.' });
        if (!surgery.preRegistrationTokenExpiry || new Date(surgery.preRegistrationTokenExpiry) < new Date()) {
            return res.status(410).json({ message: 'This link has expired.' });
        }

        return res.json({
            guestName: surgery.guestName || 'Guest',
            guestBirthdate: surgery.guestBirthdate || null,
            guestGender: surgery.guestGender || '',
            source: surgery.source || '',
            appointmentDate: surgery.date,
            procedure: surgery.procedure,
            branch: surgery.branch,
            guestProfile: surgery.guestProfile || null,
            guestEmergencyContact: surgery.guestEmergencyContact || null,
            guestGuardian: surgery.guestGuardian || null,
            guestPhysician: surgery.guestPhysician || null,
            guestMedicalHistory: surgery.guestMedicalHistory || null,
            guestDentalHistory: surgery.guestDentalHistory || null,
            guestConsentAcknowledgement: surgery.guestConsentAcknowledgement || null,
            guestDataPrivacyConsent: surgery.guestDataPrivacyConsent || null,
            homeAddress: surgery.guestHomeAddress || surgery.guestCurrentAddress || surgery.guestPermanentAddress || null,
            currentAddress: surgery.guestCurrentAddress || null,
            permanentAddress: surgery.guestPermanentAddress || null,
        });
    } catch (error) {
        console.error('Error fetching pre-registration data:', error);
        return res.status(500).json({ message: 'Server error fetching pre-registration data.' });
    }
});

app.post('/api/appointments/:id/reschedule', verifyToken, async (req, res) => {
    try {
        const allowedRoles = ['administrator', 'branch-manager', 'secretary', 'owner', 'dentist'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { newDate, newTime, reason = '' } = req.body;
        if (!newDate || !newTime) {
            return res.status(400).json({ message: 'New date and time are required.' });
        }

        const appointment = await Surgery.findById(req.params.id).populate('patient', 'name email').populate('dentist', 'name email');
        if (!appointment || appointment.isArchived) {
            return res.status(404).json({ message: 'Appointment not found.' });
        }

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch || appointment.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This appointment belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist' && appointment.dentist?._id?.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. This appointment is not assigned to this dentist.' });
        }

        const currentDateKey = getManilaDayKey(appointment.date);
        const normalizedTime = String(newTime || '').trim();
        const isSameSlot = currentDateKey === String(newDate).trim() && (appointment.time || '') === normalizedTime;
        const slotCheck = await validateBookableAppointmentSlot({
            date: newDate,
            time: normalizedTime,
            branch: appointment.branch,
            excludeAppointmentId: appointment._id,
            allowCurrentSlot: isSameSlot,
        });
        if (!slotCheck.ok) {
            return res.status(slotCheck.statusCode).json({ message: slotCheck.message });
        }

        appointment.rescheduleHistory = appendRescheduleHistoryEntry({
            appointment,
            nextDate: slotCheck.parsedDate,
            nextTime: slotCheck.normalizedTime,
            actor: req.user,
            reason,
        });
        appointment.date = slotCheck.parsedDate;
        appointment.time = slotCheck.normalizedTime;
        appointment.status = appointment.status === 'cancelled' ? 'confirmed' : appointment.status;
        appointment.autoCancelledAt = null;
        appointment.cancellationReason = '';
        await appointment.save();

        const patientEmail = appointment.patient?.email || appointment.guestEmail || '';
        if (patientEmail) {
            await sendAppointmentRescheduledEmail({
                email: patientEmail,
                name: getPatientDisplayName(appointment),
                branch: appointment.branch,
                date: appointment.date,
                time: appointment.time,
                procedure: appointment.procedure,
            });
        }

        if (appointment.dentist?._id && appointment.dentist.email) {
            await Notification.create({
                type: 'NEW_APPOINTMENT',
                title: 'Appointment Schedule Updated',
                message: `${appointment.procedure} was rescheduled to ${new Date(appointment.date).toDateString()} at ${appointment.time}.`,
                recipientId: appointment.dentist._id,
                recipientRole: 'dentist',
                relatedId: appointment._id,
            });
        }

        await AuditLog.create({
            action: 'APPOINTMENT_RESCHEDULED',
            user: req.user?.email || req.user?.id || 'SYSTEM',
            role: req.user?.role || 'SYSTEM',
            details: `Appointment ${appointment._id} rescheduled to ${new Date(appointment.date).toDateString()} at ${appointment.time}.`,
        });

        await syncQueueEntryForAppointment(appointment);

        return res.json({ message: 'Appointment rescheduled successfully.', appointment });
    } catch (error) {
        console.error('Error rescheduling appointment:', error);
        return res.status(500).json({ message: 'Server error rescheduling appointment.' });
    }
});

const autoCancelOverdueAppointments = async () => {
    const now = new Date();
    const candidates = await Surgery.find({
        status: { $in: ['pending', 'confirmed'] },
        isArchived: false,
    }).populate('patient', 'name email');

    for (const appointment of candidates) {
        const graceDeadline = getAppointmentGraceDeadline(appointment);
        if (!graceDeadline || graceDeadline >= now) continue;

        appointment.status = 'cancelled';
        appointment.autoCancelledAt = new Date();
        appointment.cancellationReason = AUTO_CANCELLATION_REASON;
        appointment.remarks = appointment.remarks || AUTO_CANCELLATION_REASON;
        await appointment.save();
        await syncQueueEntryForAppointment(appointment);

        await AuditLog.create({
            action: 'APPOINTMENT_AUTO_CANCELLED',
            user: 'SYSTEM',
            role: 'SYSTEM',
            details: `Appointment ${appointment._id} auto-cancelled after the ${APPOINTMENT_CHECKIN_GRACE_MINUTES}-minute check-in grace period passed.`,
        });

        await createBranchScopedNotifications({
            type: 'APPOINTMENT_CANCELLED',
            title: 'Appointment Auto-cancelled',
            message: `${getPatientDisplayName(appointment)}'s appointment was auto-cancelled after no check-in was recorded within ${APPOINTMENT_CHECKIN_GRACE_MINUTES} minutes.`,
            branch: appointment.branch,
            relatedId: appointment._id,
        });

        const recipientEmail = appointment.patient?.email || appointment.guestEmail || '';
        if (recipientEmail) {
            await sendAppointmentDeclinedEmail({
                email: recipientEmail,
                name: getPatientDisplayName(appointment),
                branch: appointment.branch,
                date: appointment.date,
                time: appointment.time,
                procedure: appointment.procedure,
            });
        }

        await syncQueueEntryForAppointment(appointment);
    }
};

const remindIncompleteSchedulesForStaff = async () => {
    const now = new Date();
    const reminderCutoff = new Date(now.getTime() - IN_CLINIC_COMPLETION_REMINDER_MS);
    const reminderCutoffDayStart = getStartOfManilaDay(reminderCutoff);
    const reminderCutoffDayEnd = new Date(reminderCutoffDayStart.getTime() + DAY_IN_MS - 1);
    const todayKey = getManilaDayKey();
    const candidates = await Surgery.find({
        status: 'in-clinic',
        isArchived: false,
        date: { $lte: reminderCutoffDayEnd },
        $or: [
            { statusReminderDayKey: { $ne: todayKey } },
            { statusReminderDayKey: { $exists: false } },
        ],
    }).populate('patient', 'name').populate('dentist', 'name email');

    for (const appointment of candidates) {
        const checkInDateTime = getScheduleDateTime(appointment);
        if (!checkInDateTime || now.getTime() - checkInDateTime.getTime() <= IN_CLINIC_COMPLETION_REMINDER_MS) {
            continue;
        }

        const scheduleDateLabel = formatEmailDateLabel(appointment.date);
        const reminderMessage = `${getPatientDisplayName(appointment)} has been in clinic since ${scheduleDateLabel} at ${appointment.time || 'the recorded check-in time'}, but the schedule is not marked complete yet. Please review and mark the schedule as completed when appropriate.`;

        await createBranchScopedNotifications({
            type: 'APPOINTMENT_STATUS_UPDATED',
            title: 'In-Clinic Schedule Overdue',
            message: reminderMessage,
            branch: appointment.branch,
            relatedId: appointment._id,
            includeOwners: true,
        });

        if (appointment.dentist?._id) {
            await Notification.create({
                type: 'APPOINTMENT_STATUS_UPDATED',
                title: 'In-Clinic Schedule Overdue',
                message: reminderMessage,
                recipientId: appointment.dentist._id,
                recipientRole: 'dentist',
                relatedId: appointment._id,
            });
        }

        appointment.statusReminderDayKey = todayKey;
        appointment.statusReminderSentAt = new Date();
        await appointment.save();

        await AuditLog.create({
            action: 'SCHEDULE_STATUS_REMINDER_SENT',
            user: 'SYSTEM',
            role: 'SYSTEM',
            details: `Sent in-clinic completion reminder for appointment ${appointment._id}; checked in at ${checkInDateTime.toISOString()} and still not completed.`,
        });
    }
};

const remindPatientsAboutUpcomingAppointments = async () => {
    const todayStart = getStartOfManilaDay();
    const dayAfterTomorrowStart = getStartOfManilaDay(new Date(todayStart.getTime() + (2 * DAY_IN_MS)));

    const appointments = await Surgery.find({
        status: 'confirmed',
        isArchived: false,
        patient: { $ne: null },
        date: {
            $gte: todayStart,
            $lt: dayAfterTomorrowStart,
        },
    }).populate('patient', 'name email');

    for (const appointment of appointments) {
        if (!appointment.patient?._id) continue;

        const wholeDayDiff = getWholeDayDiff(appointment.date);
        if (![0, 1].includes(wholeDayDiff)) continue;

        const reminderWindowStart = getStartOfManilaDay();
        const alreadySent = await Notification.exists({
            type: 'APPOINTMENT_REMINDER',
            recipientId: appointment.patient._id,
            relatedId: appointment._id,
            createdAt: { $gte: reminderWindowStart },
        });
        if (alreadySent) continue;

        const reminderLabel = wholeDayDiff === 0 ? 'today' : 'tomorrow';
        await createPatientNotification({
            patientId: appointment.patient._id,
            type: 'APPOINTMENT_REMINDER',
            title: wholeDayDiff === 0 ? 'Appointment Reminder Today' : 'Appointment Reminder Tomorrow',
            message: `Reminder: you have a confirmed ${appointment.procedure} appointment ${reminderLabel} (${formatEmailDateLabel(appointment.date)}) at ${appointment.time || 'the scheduled time'} in ${appointment.branch}.`,
            relatedId: appointment._id,
        });
    }
};

const remindPatientsAboutPredictiveVisitWindows = async () => {
    const patients = await User.find({
        role: 'patient',
        isArchived: false,
        notifVisitWindow: { $ne: false },
        'treatmentLogs.0': { $exists: true },
    }).select('name treatmentLogs predictiveVisitReminder');

    for (const patient of patients) {
        const prediction = getPredictiveVisitWindowFromTreatmentHistory(patient.treatmentLogs || []);
        if (!prediction) continue;

        const hasUpcomingAppointment = await Surgery.exists({
            patient: patient._id,
            status: { $in: ['pending', 'confirmed', 'in-clinic'] },
            isArchived: false,
            date: { $gte: getStartOfManilaDay() },
        });
        if (hasUpcomingAppointment) continue;

        const reminderState = patient.predictiveVisitReminder || {};
        let dueWindowKey = reminderState.dueWindowKey || '';
        let overdueWindowKey = reminderState.overdueWindowKey || '';
        let shouldSaveState = false;

        if ((prediction.label === 'Due Soon' || prediction.label === 'Window Open')
            && dueWindowKey !== prediction.recommendedDateKey) {
            const title = prediction.label === 'Window Open'
                ? 'Your visit window is now open'
                : 'Your visit window is coming up';
            const message = prediction.isFollowUpRecommendation
                ? `The clinic recommended a follow-up visit around ${prediction.recommendedDateLabel}. Your ideal visit window is ${prediction.windowLabel}.`
                : `Based on your recent treatment history, your next recommended clinic visit window is ${prediction.windowLabel}.`;

            await createPatientNotification({
                type: 'PREDICTIVE_VISIT_DUE',
                title,
                message,
                patientId: patient._id,
                relatedId: patient._id,
            });

            dueWindowKey = prediction.recommendedDateKey;
            shouldSaveState = true;

            await AuditLog.create({
                action: 'PREDICTIVE_VISIT_DUE_SENT',
                user: 'SYSTEM',
                role: 'SYSTEM',
                details: `Sent predictive visit due reminder to patient ${patient._id} for window ${prediction.windowLabel}.`,
            });
        }

        if (prediction.label === 'Overdue' && overdueWindowKey !== prediction.recommendedDateKey) {
            const message = prediction.isFollowUpRecommendation
                ? `Your clinic follow-up window (${prediction.windowLabel}) has passed. Please contact the clinic to schedule your visit.`
                : `Your recommended clinic visit window (${prediction.windowLabel}) has passed. Please book your next check-up.`;

            await createPatientNotification({
                type: 'PREDICTIVE_VISIT_OVERDUE',
                title: 'Your visit window is overdue',
                message,
                patientId: patient._id,
                relatedId: patient._id,
            });

            overdueWindowKey = prediction.recommendedDateKey;
            shouldSaveState = true;

            await AuditLog.create({
                action: 'PREDICTIVE_VISIT_OVERDUE_SENT',
                user: 'SYSTEM',
                role: 'SYSTEM',
                details: `Sent predictive visit overdue reminder to patient ${patient._id} for window ${prediction.windowLabel}.`,
            });
        }

        if (shouldSaveState) {
            await User.findByIdAndUpdate(patient._id, {
                $set: {
                    predictiveVisitReminder: {
                        dueWindowKey,
                        overdueWindowKey,
                    },
                },
            });
        }
    }
};

app.post('/api/pre-register/:token', async (req, res) => {
    try {
        const token = String(req.params.token || '').trim();
        if (!token) return res.status(400).json({ message: 'Pre-registration token is required.' });

        const surgery = await Surgery.findOne({ preRegistrationToken: token, isArchived: false });
        if (!surgery) return res.status(404).json({ message: 'This link is invalid.' });
        if (surgery.preRegistrationCompleted) return res.status(409).json({ message: 'You have already completed your registration.' });
        if (!surgery.preRegistrationTokenExpiry || new Date(surgery.preRegistrationTokenExpiry) < new Date()) {
            return res.status(410).json({ message: 'This link has expired.' });
        }

        const homeAddress = pickCanonicalAddress(req.body.homeAddress, req.body.currentAddress, req.body.permanentAddress);
        const guestProfile = normalizeGuestProfile(req.body.guestProfile);
        const guestEmergencyContact = normalizeGuestEmergencyContact(req.body.guestEmergencyContact);
        const guestGuardian = normalizeGuestGuardian(req.body.guestGuardian);
        const guestPhysician = normalizeGuestPhysician(req.body.guestPhysician);
        const guestMedicalHistory = normalizeGuestMedicalHistory(req.body.guestMedicalHistory);
        const guestDentalHistory = normalizeGuestDentalHistory(req.body.guestDentalHistory);
        const guestConsentAcknowledgement = normalizeGuestConsentRecord(req.body.consentAcknowledgement, 'Dentime Patient Form v6.1');
        const guestDataPrivacyConsent = normalizeGuestConsentRecord(req.body.dataPrivacyConsent, 'Data Privacy Act of 2012');
        const invalidPersonNameMessage = getInvalidPersonNameMessage([
            ['Emergency contact name', guestEmergencyContact?.name, true],
            ['Guardian name', guestGuardian?.name],
            ['Physician name', guestPhysician?.name],
            ['Consent signer name', guestConsentAcknowledgement?.signerName],
            ['Data privacy signer name', guestDataPrivacyConsent?.signerName],
        ]);
        if (invalidPersonNameMessage) {
            return res.status(400).json({ message: invalidPersonNameMessage });
        }
        if (!isAddressComplete(homeAddress)) {
            return res.status(400).json({ message: 'Home address is required.' });
        }
        const isPhoneCallPreRegistration = String(surgery.source || '').trim() === 'Phone Call';
        if (!guestProfile?.occupation || !guestEmergencyContact?.name || !guestEmergencyContact?.relationship || !guestEmergencyContact?.contactNumber) {
            return res.status(400).json({ message: 'Occupation and emergency contact details are required.' });
        }
        if (!isPhoneCallPreRegistration && !guestDentalHistory?.chiefComplaint) {
            return res.status(400).json({ message: 'Reason for consultation is required.' });
        }
        if (!isPhoneCallPreRegistration && guestMedicalHistory?.inGoodHealth === undefined) {
            return res.status(400).json({ message: 'Please complete the basic medical history section.' });
        }
        if (!isPhoneCallPreRegistration && (
            !guestConsentAcknowledgement?.acknowledged
            || !guestConsentAcknowledgement?.signerName
            || !guestDataPrivacyConsent?.acknowledged
            || !guestDataPrivacyConsent?.signerName
        )) {
            return res.status(400).json({ message: 'Please complete the consent and data privacy acknowledgements.' });
        }

        surgery.guestHomeAddress = homeAddress;
        surgery.guestCurrentAddress = homeAddress;
        surgery.guestPermanentAddress = homeAddress;
        surgery.guestProfile = guestProfile;
        surgery.guestEmergencyContact = guestEmergencyContact;
        surgery.guestGuardian = guestGuardian;
        surgery.guestPhysician = guestPhysician;
        surgery.guestMedicalHistory = guestMedicalHistory;
        surgery.guestDentalHistory = guestDentalHistory;
        surgery.guestConsentAcknowledgement = guestConsentAcknowledgement;
        surgery.guestDataPrivacyConsent = guestDataPrivacyConsent;
        surgery.preRegistrationCompleted = true;
        surgery.preRegistrationToken = undefined;
        surgery.preRegistrationTokenExpiry = undefined;

        let linkedPatient = null;
        if (surgery.patient) {
            linkedPatient = await User.findById(surgery.patient);
            if (linkedPatient && linkedPatient.role === 'patient') {
                const patientPayload = buildPatientPayload({
                    body: req.body,
                    fallbackGuest: surgery,
                    assignedBranchOverride: linkedPatient.assignedBranch || linkedPatient.assignedBranches?.[0] || surgery.branch,
                });

                Object.assign(linkedPatient, patientPayload, {
                    role: 'patient',
                    status: 'inactive',
                    isVerified: false,
                });
                if (linkedPatient.assignedBranch && (!Array.isArray(linkedPatient.assignedBranches) || linkedPatient.assignedBranches.length === 0)) {
                    linkedPatient.assignedBranches = [linkedPatient.assignedBranch];
                }
                await linkedPatient.save();
            }
        }

        await surgery.save();

        await AuditLog.create({
            action: 'PRE_REGISTRATION_COMPLETED',
            user: surgery.guestEmail || surgery.guestName || 'guest',
            role: 'guest',
            details: `Guest pre-registration completed for appointment ${surgery._id}.`,
        });
        await createBranchScopedNotifications({
            type: 'NEW_APPOINTMENT',
            title: 'Guest Pre-registration Completed',
            message: `${surgery.guestName || 'Guest'} has completed pre-registration for ${surgery.procedure}.`,
            branch: surgery.branch,
            relatedId: surgery._id,
        });

        let responseMessage = 'Pre-registration completed successfully.';
        if (linkedPatient && !linkedPatient.isVerified) {
            try {
                await sendPatientActivationLink(linkedPatient, {
                    branch: surgery.branch,
                    procedure: surgery.procedure,
                });
                responseMessage = 'Pre-registration completed successfully. An activation email has been sent.';
                await AuditLog.create({
                    action: 'PATIENT_ACTIVATION_SENT',
                    user: linkedPatient.email || surgery.guestEmail || 'guest',
                    role: 'system',
                    details: `Activation email sent after pre-registration for appointment ${surgery._id}.`,
                });
            } catch (emailError) {
                console.error('Error sending post-pre-registration activation email:', emailError);
                responseMessage = 'Pre-registration completed successfully, but the activation email could not be sent. Staff can resend it from Manage Patients.';
            }
        }

        return res.status(200).json({ message: responseMessage });
    } catch (error) {
        console.error('Error saving pre-registration data:', error);
        return res.status(500).json({ message: 'Server error saving pre-registration data.' });
    }
});

app.post(['/api/admin/appointments/:surgeryId/resend-pre-register', '/api/admin/appointments/:appointmentId/resend-pre-register'], verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'branch-manager', 'secretary', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }

    try {
        const appointmentId = req.params.appointmentId || req.params.surgeryId;
        const surgery = await Surgery.findById(appointmentId);
        if (!surgery || surgery.isArchived) return res.status(404).json({ message: 'Guest appointment not found.' });
        if (!isGuestPreRegistrationAppointment(surgery)) {
            return res.status(400).json({ message: 'Only guest website and phone call appointments can receive a pre-registration link.' });
        }
        if (surgery.preRegistrationCompleted) {
            return res.status(409).json({ message: 'This guest has already completed pre-registration.' });
        }
        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch || surgery.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This appointment belongs to a different branch.' });
            }
        }

        const preRegistrationFields = getGuestPreRegistrationFields(surgery);
        Object.assign(surgery, {
            preRegistrationToken: preRegistrationFields.preRegistrationToken,
            preRegistrationTokenExpiry: preRegistrationFields.preRegistrationTokenExpiry,
            preRegistrationCompleted: preRegistrationFields.preRegistrationCompleted,
        });
        await surgery.save();

        await AuditLog.create({
            action: 'PRE_REGISTRATION_LINK_SENT',
            user: req.user?.email || req.user?.id || 'SYSTEM',
            role: req.user?.role || 'SYSTEM',
            details: `Pre-registration link resent for appointment ${surgery._id}.`,
        });

        await sendPreRegistrationEmail({
            email: surgery.guestEmail,
            name: surgery.guestName,
            branch: surgery.branch,
            date: surgery.date,
            time: surgery.time,
            procedure: surgery.procedure,
            token: surgery.preRegistrationToken,
        });

        return res.json({
            message: preRegistrationFields.reusedExistingToken
                ? 'Pre-registration email resent with the same active link.'
                : 'Pre-registration email resent with a new link.',
            reusedExistingToken: preRegistrationFields.reusedExistingToken,
        });
    } catch (error) {
        console.error('Error resending pre-registration email:', error);
        return res.status(500).json({ message: 'Server error resending pre-registration email.' });
    }
});

app.get('/api/public/branches', async (req, res) => {
    try {
        const branches = await Branch.find({ isActive: true })
            .sort({ name: 1 })
            .select('name address contactNumber')
            .lean();
        res.json(branches);
    } catch (error) {
        console.error('Error fetching public branches:', error);
        res.status(500).json({ message: 'Server error fetching public branches.' });
    }
});

app.get('/api/public/system-config', async (req, res) => {
    try {
        const [config, branches] = await Promise.all([
            getNormalizedSystemConfig(),
            Branch.find({ isActive: true }).sort({ name: 1 }).select('name address contactNumber').lean(),
        ]);

        res.json({
            clinicInfo: {
                name: config.clinicName,
                contactNumber: config.clinicContact,
                email: config.clinicEmail,
                address: config.clinicAddress,
            },
            appointmentProcedures: config.onlineBookingProcedures,
            featureToggles: {},
            websiteContent: config.websiteContent,
            branches: branches.map((branch) => ({
                name: branch.name,
                address: branch.address || '',
                contactNumber: branch.contactNumber || '',
                status: 'Now Open',
            })),
        });
    } catch (error) {
        console.error('Error fetching public system config:', error);
        res.status(500).json({ message: 'Server error fetching public system config.' });
    }
});

app.get('/api/public/appointments/slots', async (req, res) => {
    try {
        const { date, branch } = req.query;

        if (!date) {
            return res.status(400).json({ message: 'date query parameter is required.' });
        }

        const [rawAllowedSlots, takenSlots, appointmentCount, maxAppointmentsPerDay] = await Promise.all([
            getClinicAllowedSlots(),
            getTakenSlotsForDate({ date, branch }),
            getActiveAppointmentCountForDate({ date, branch }),
            getClinicMaxAppointmentsPerDay(),
        ]);

        const dayCapacityReached = appointmentCount >= maxAppointmentsPerDay;
        const allowedSlots = dayCapacityReached
            ? []
            : getBookableAllowedSlotsForDate({
                date,
                allowedSlots: rawAllowedSlots,
            });

        res.json({ allowedSlots, takenSlots, dayCapacityReached, maxAppointmentsPerDay, appointmentCount });
    } catch (error) {
        console.error('Error fetching public appointment slots:', error);
        res.status(500).json({ message: 'Server error fetching appointment slots.' });
    }
});

app.get('/api/public/appointments/blocked-dates', async (req, res) => {
    try {
        const { branch, month } = req.query;
        const blockedDates = await getBlockedDatesForMonth({ branch, month });
        res.json({ blockedDates });
    } catch (error) {
        console.error('Error fetching public blocked dates:', error);
        res.status(500).json({ message: 'Server error fetching blocked dates.' });
    }
});

app.post('/api/public/appointments/request', async (req, res) => {
    try {
        const {
            fullName,
            firstName,
            middleName,
            lastName,
            phone,
            email,
            branch,
            date,
            time,
            procedure,
            notes,
            birthdate,
            gender,
            privacyConsent,
            turnstileToken,
        } = req.body;

        const normalizedFirstName = String(firstName || '').trim().replace(/\s+/g, ' ');
        const normalizedMiddleName = String(middleName || '').trim().replace(/\s+/g, ' ');
        const normalizedLastName = String(lastName || '').trim().replace(/\s+/g, ' ');
        const fallbackFullName = String(fullName || '').trim().replace(/\s+/g, ' ');
        const normalizedName = [normalizedFirstName, normalizedMiddleName, normalizedLastName].filter(Boolean).join(' ') || fallbackFullName;

        if (!normalizedName || !phone || !email || !branch || !date || !time || !procedure || !birthdate || !gender) {
            return res.status(400).json({ message: 'All appointment request fields are required.' });
        }
        if (!turnstileToken) {
            return res.status(400).json({ message: 'Please complete the captcha before submitting.' });
        }
        if (!privacyConsent) {
            return res.status(400).json({ message: 'Please agree to the Privacy Policy before submitting.' });
        }

        const normalizedPhone = String(phone).trim();
        const normalizedEmail = String(email).trim().toLowerCase();
        const normalizedBranch = String(branch).trim();
        const normalizedProcedure = String(procedure).trim();
        const normalizedNotes = String(notes || '').trim();
        const normalizedGender = String(gender).trim();
        const matchedPatient = await User.findOne({
            email: normalizedEmail,
            role: 'patient',
            isArchived: { $ne: true },
        }).select('name birthdate email');

        if ((normalizedFirstName || normalizedLastName || normalizedMiddleName) && (!normalizedFirstName || !normalizedLastName)) {
            return res.status(400).json({ message: 'First name and last name are required.' });
        }

        if (normalizedFirstName && !GUEST_PERSON_NAME_REGEX.test(normalizedFirstName)) {
            return res.status(400).json({ message: 'Please enter a valid first name.' });
        }

        if (normalizedMiddleName && !GUEST_PERSON_NAME_REGEX.test(normalizedMiddleName)) {
            return res.status(400).json({ message: 'Please enter a valid middle name.' });
        }

        if (normalizedLastName && !GUEST_PERSON_NAME_REGEX.test(normalizedLastName)) {
            return res.status(400).json({ message: 'Please enter a valid last name.' });
        }

        if (!GUEST_FULL_NAME_REGEX.test(normalizedName)) {
            return res.status(400).json({ message: 'Please enter a valid full name.' });
        }

        if (!GUEST_PHONE_REGEX.test(normalizedPhone)) {
            return res.status(400).json({ message: 'Please enter a valid contact number in 9xxxxxxxxx format.' });
        }

        if (!GUEST_EMAIL_REGEX.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }

        if (!(await isOnlineBookingProcedureAllowed(normalizedProcedure))) {
            return res.status(400).json({ message: 'Please select a valid procedure.' });
        }

        if (!['Male', 'Female', 'Other', 'Prefer not to say'].includes(normalizedGender)) {
            return res.status(400).json({ message: 'Please select a valid gender.' });
        }

        const escapedBranchName = normalizedBranch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const branchRecord = await Branch.findOne({
            name: { $regex: `^${escapedBranchName}$`, $options: 'i' },
            isActive: true,
        }).select('name');
        if (!branchRecord) {
            return res.status(400).json({ message: 'Selected branch is not available.' });
        }
        const resolvedBranchName = branchRecord.name;

        const remoteIpHeader = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
        const remoteIp = Array.isArray(remoteIpHeader)
            ? remoteIpHeader[0]
            : String(remoteIpHeader || req.socket?.remoteAddress || '').split(',')[0].trim();
        const turnstileResult = await verifyTurnstileToken({ token: String(turnstileToken).trim(), remoteIp });
        if (!turnstileResult.success) {
            console.warn('Turnstile verification failed:', turnstileResult['error-codes'] || []);
            if ((turnstileResult['error-codes'] || []).includes('missing-input-secret')) {
                return res.status(500).json({ message: 'Captcha verification is not configured on the server.' });
            }
            return res.status(400).json({ message: 'Captcha verification failed. Please try again.' });
        }

        const guestBirthdate = new Date(`${birthdate}T12:00:00`);
        if (Number.isNaN(guestBirthdate.getTime())) {
            return res.status(400).json({ message: 'Please provide a valid birthdate.' });
        }
        if (guestBirthdate >= new Date()) {
            return res.status(400).json({ message: 'Birthdate must be in the past.' });
        }

        if (matchedPatient && !doesPatientIdentityMatchWebsiteRequest(matchedPatient, {
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            birthdate,
        })) {
            return res.status(409).json({
                message: 'This email already belongs to a registered patient, but the submitted personal details do not match. Please log in with the patient account or contact the clinic.',
            });
        }

        const slotCheck = await validateBookableAppointmentSlot({
            date,
            time,
            branch: resolvedBranchName,
        });
        if (!slotCheck.ok) {
            return res.status(slotCheck.statusCode).json({ message: slotCheck.message });
        }

        const newSurgery = new Surgery({
            patient: matchedPatient?._id || undefined,
            guestName: matchedPatient ? undefined : normalizedName,
            guestPhone: matchedPatient ? undefined : normalizePhoneNumber(normalizedPhone),
            guestEmail: matchedPatient ? undefined : normalizedEmail,
            guestBirthdate: matchedPatient ? undefined : guestBirthdate,
            guestGender: matchedPatient ? undefined : normalizedGender,
            guestProfile: matchedPatient ? undefined : {
                nationality: 'Filipino',
                reasonForConsultation: normalizedNotes || normalizedProcedure,
            },
            guestDentalHistory: matchedPatient ? undefined : {
                chiefComplaint: normalizedNotes || normalizedProcedure,
            },
            branch: resolvedBranchName,
            date: slotCheck.parsedDate,
            time: slotCheck.normalizedTime,
            procedure: normalizedProcedure,
            notes: normalizedNotes,
            status: 'pending',
            source: 'Smile Hub (Online)',
            consentGiven: true,
            consentTimestamp: new Date(),
            consentVersion: PRIVACY_POLICY_VERSION,
            consentIpAddress: remoteIp,
        });

        await newSurgery.save();

        await AuditLog.create({
            action: 'GUEST_APPOINTMENT_REQUEST',
            user: normalizedEmail,
            role: 'guest',
            details: `Guest ${normalizedName} requested ${normalizedProcedure} on ${formatEmailDateLabel(slotCheck.parsedDate)} at ${resolvedBranchName}.`,
        });

        await notifyAppointmentManagers({
            appointmentId: newSurgery._id,
            patientName: normalizedName,
            procedure: normalizedProcedure,
            date: slotCheck.dateKey,
            branch: resolvedBranchName,
        });

        await sendAppointmentReceivedEmail({
            email: normalizedEmail,
            name: normalizedName,
            branch: resolvedBranchName,
            date: slotCheck.parsedDate,
            time: slotCheck.normalizedTime,
            procedure: normalizedProcedure,
        });

        if (matchedPatient?._id) {
            await notifyPatientAppointmentStatusChange({
                appointment: {
                    ...newSurgery.toObject(),
                    patient: {
                        _id: matchedPatient._id,
                        name: matchedPatient.name,
                    },
                },
                status: newSurgery.status,
            });
        }

        res.status(201).json({
            message: 'Appointment request submitted successfully. The clinic will email you once it is confirmed.',
            existingPatientMatched: Boolean(matchedPatient?._id),
            surgery: newSurgery,
        });
    } catch (error) {
        console.error('Error submitting public appointment request:', error);
        res.status(500).json({ message: 'Server error submitting appointment request.' });
    }
});


// -------------------------------------------------------
// APPOINTMENT BOOKING REQUEST (from patient mobile app)
// -------------------------------------------------------

app.post('/api/appointments/request', verifyToken, async (req, res) => {
    try {
        const { date, time, procedure, notes, branch } = req.body;

        if (!date || !time || !procedure) {
            return res.status(400).json({ message: 'Date, time, and procedure are required.' });
        }

        const patientUser = await User.findById(req.user.id).select('name email role assignedBranch assignedBranches');
        if (!patientUser || patientUser.role !== 'patient') {
            return res.status(403).json({ message: 'Only patients can submit appointment requests.' });
        }

        const resolvedBranch = patientUser.assignedBranch || patientUser.assignedBranches?.[0] || '';
        if (!resolvedBranch) {
            return res.status(400).json({ message: 'Your patient account does not have an assigned branch yet. Please contact the clinic before booking an appointment.' });
        }

        if (branch && String(branch).trim() !== resolvedBranch) {
            return res.status(400).json({ message: 'Your booking branch does not match your assigned clinic branch.' });
        }

        const duplicateAppointment = await Surgery.findOne({
            patient: req.user.id,
            status: { $in: ['pending', 'confirmed', 'in-clinic'] },
            isArchived: false,
        }).select('_id date time procedure status');
        if (duplicateAppointment) {
            return res.status(409).json({
                code: 'ACTIVE_APPOINTMENT_EXISTS',
                message: 'You already have an active appointment request. Please wait for it to be completed or cancelled before booking another one.',
                appointment: duplicateAppointment,
            });
        }

        if (!(await isOnlineBookingProcedureAllowed(procedure))) {
            return res.status(400).json({ message: 'Patients may only book one of the configured online-booking procedures. Additional procedures are recorded by the clinic after assessment or treatment.' });
        }

        const slotCheck = await validateBookableAppointmentSlot({
            date,
            time,
            branch: resolvedBranch,
        });
        if (!slotCheck.ok) {
            return res.status(slotCheck.statusCode).json({ message: slotCheck.message });
        }

        const newSurgery = new Surgery({
            patient: req.user.id,
            dentist: req.body.dentistId || null,
            branch: resolvedBranch,
            date: slotCheck.parsedDate,
            time: slotCheck.normalizedTime,
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
            details: `Patient ${patientUser.name.first} ${patientUser.name.last} requested an appointment for: ${procedure} on ${formatEmailDateLabel(slotCheck.parsedDate)}`
        });

        await notifyAppointmentManagers({
            appointmentId: newSurgery._id,
            patientName: `${patientUser.name.first} ${patientUser.name.last}`.trim(),
            procedure,
            date: slotCheck.dateKey,
            branch: resolvedBranch,
        });

        if (patientUser.email) {
            await sendAppointmentReceivedEmail({
                email: patientUser.email,
                name: `${patientUser.name.first} ${patientUser.name.last}`.trim(),
                branch: resolvedBranch,
                date: slotCheck.parsedDate,
                time: slotCheck.normalizedTime,
                procedure,
            });
        }

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

        let resolvedBranch = String(branch || '').trim();

        if (req.user.role === 'patient') {
            const patient = await User.findById(req.user.id).select('assignedBranch assignedBranches');
            resolvedBranch = patient?.assignedBranch || patient?.assignedBranches?.[0] || resolvedBranch;

            if (!resolvedBranch) {
                return res.status(400).json({
                    message: 'Your patient account does not have an assigned branch yet. Please contact the clinic before booking an appointment.',
                });
            }
        } else if (isBranchScopedStaff(req.user.role)) {
            resolvedBranch = getScopedBranchForUser(req.user) || resolvedBranch;
        }

        const [rawAllowedSlots, takenSlots, appointmentCount, maxAppointmentsPerDay] = await Promise.all([
            getClinicAllowedSlots(),
            getTakenSlotsForDate({ date, branch: resolvedBranch }),
            getActiveAppointmentCountForDate({ date, branch: resolvedBranch }),
            getClinicMaxAppointmentsPerDay(),
        ]);

        const dayCapacityReached = appointmentCount >= maxAppointmentsPerDay;
        const allowedSlots = dayCapacityReached
            ? []
            : getBookableAllowedSlotsForDate({
                date,
                allowedSlots: rawAllowedSlots,
            });

        res.json({
            allowedSlots,
            takenSlots,
            branch: resolvedBranch,
            dayCapacityReached,
            maxAppointmentsPerDay,
            appointmentCount,
        });
    } catch (error) {
        console.error('Error fetching appointment slots:', error);
        res.status(500).json({ message: 'Server error fetching appointment slots.' });
    }
});

// -------------------------------------------------------
// APPOINTMENT DUPLICATE CHECK — patient: check for active booking
// -------------------------------------------------------
app.get('/api/appointments/my-active', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const activeAppointment = await Surgery.findOne({
            patient: req.user.id,
            status: { $in: ['pending', 'confirmed', 'in-clinic'] },
            isArchived: false,
        })
            .select('date time procedure status branch')
            .sort({ date: 1 })
            .lean();

        res.json({ hasActive: !!activeAppointment, appointment: activeAppointment || null });
    } catch (error) {
        console.error('Error checking active appointments:', error);
        res.status(500).json({ message: 'Server error checking appointments.' });
    }
});

// -------------------------------------------------------
// APPOINTMENT BLOCKED DATES — fully booked days for calendar
// -------------------------------------------------------
app.get('/api/appointments/blocked-dates', verifyToken, async (req, res) => {
    try {
        const { branch, month } = req.query;
        let resolvedBranch = String(branch || '').trim();

        if (req.user.role === 'patient') {
            const patient = await User.findById(req.user.id).select('assignedBranch assignedBranches');
            resolvedBranch = patient?.assignedBranch || patient?.assignedBranches?.[0] || resolvedBranch;

            if (!resolvedBranch) {
                return res.status(400).json({
                    message: 'Your patient account does not have an assigned branch yet. Please contact the clinic before booking an appointment.',
                });
            }
        } else if (isBranchScopedStaff(req.user.role)) {
            resolvedBranch = getScopedBranchForUser(req.user) || resolvedBranch;
        }

        const blockedDates = await getBlockedDatesForMonth({ branch: resolvedBranch, month });

        res.json({ blockedDates, branch: resolvedBranch });
    } catch (error) {
        console.error('Error fetching blocked dates:', error);
        res.status(500).json({ message: 'Server error fetching blocked dates.' });
    }
});


// -------------------------------------------------------
// TREATMENT LOGS: GET all logs for a patient
// -------------------------------------------------------

app.get('/api/patients/:id/treatment-logs', verifyToken, async (req, res) => {
    const allowedRoles = ['administrator', 'branch-manager', 'secretary', 'dentist', 'owner', 'patient'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const patient = await User.findById(req.params.id).select('treatmentLogs name assignedBranch assignedBranches');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        if (req.user.role === 'patient' && String(req.params.id) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Access denied. Patients can only view their own treatment logs.' });
        }

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!patientBelongsToBranch(patient, scopedBranch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        await reconcilePatientTreatmentLogsFromCompletedAppointments(patient._id);

        const refreshedPatient = await User.findById(req.params.id).select('treatmentLogs');
        if (!refreshedPatient) return res.status(404).json({ message: 'Patient not found.' });

        const sorted = (refreshedPatient.treatmentLogs || []).sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        res.json(sorted.map((entry) => buildTreatmentLogPayload(entry)));
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

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        const { date, procedure, tooth, category, branch, notes, amountCharged, amountPaid, nextAppointment } = req.body;

        if (!date || !procedure) {
            return res.status(400).json({ message: 'Date and procedure are required.' });
        }

        if (!branch) {
            return res.status(400).json({ message: 'Branch is required.' });
        }

        const normalizedAmountCharged = normalizeCurrencyAmount(amountCharged);
        const normalizedAmountPaid = normalizeCurrencyAmount(amountPaid);
        if (normalizedAmountCharged === null || normalizedAmountPaid === null) {
            return res.status(400).json({ message: 'Amount charged and amount paid must be valid positive numbers.' });
        }

        const normalizedNextAppointment = nextAppointment ? new Date(nextAppointment) : null;
        if (normalizedNextAppointment && Number.isNaN(normalizedNextAppointment.getTime())) {
            return res.status(400).json({ message: 'Next appointment must be a valid date.' });
        }

        const normalizedBalance = Number(Math.max(normalizedAmountCharged - normalizedAmountPaid, 0).toFixed(2));

        const dentist = await User.findById(req.user.id).select('name');
        const dentistName = dentist
            ? `Dr. ${dentist.name.first} ${dentist.name.last}`
            : 'Unknown Dentist';

        const newLog = {
            date: new Date(date),
            procedure,
            tooth: tooth || '',
            category: normalizeTreatmentCategory(category),
            notes: notes || '',
            dentistId: req.user.id,
            dentistName,
            branch: branch,
            amountCharged: normalizedAmountCharged,
            amountPaid: normalizedAmountPaid,
            balance: normalizedBalance,
            nextAppointment: normalizedNextAppointment,
        };

        patient.treatmentLogs.push(newLog);
        patient.assignedDentistId = req.user.id;
        patient.assignedDentistName = dentistName;
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
    const allowedRoles = ['administrator', 'branch-manager', 'dentist', 'owner'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

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


const ODONTOGRAM_SURFACE_CODES = ['M', 'D', 'O', 'B', 'L'];
const ODONTOGRAM_STATUS_ALIASES = {
    '': 'healthy',
    healthy: 'healthy',
    normal: 'healthy',
    sound: 'healthy',
    filled: 'filled',
    filling: 'filled',
    decayed: 'decayed',
    caries: 'decayed',
    crown: 'crown',
    crowned: 'crown',
    implant: 'implant',
    bridge: 'bridge',
    pontic: 'bridge',
    missing: 'missing',
    extracted: 'missing',
    'extraction site': 'extraction-site',
    'extraction-site': 'extraction-site',
    mobility: 'mobility',
    fracture: 'fractured',
    fractured: 'fractured',
    'root canal': 'root-canal',
    'root-canal': 'root-canal',
    'under observation': 'under-observation',
    'under-observation': 'under-observation',
};
const ODONTOGRAM_STAGE_ALIASES = {
    '': 'existing',
    existing: 'existing',
    current: 'existing',
    planned: 'planned',
    proposed: 'planned',
    completed: 'completed',
    done: 'completed',
};
const ODONTOGRAM_STAGE_ORDER = ['existing', 'planned', 'completed'];
const ODONTOGRAM_TOOTH_KEY_REGEX = /^[1-4][1-8]$/;

const normalizeOdontogramStatus = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return ODONTOGRAM_STATUS_ALIASES[normalized] || normalized.replace(/\s+/g, '-');
};

const normalizeOdontogramStage = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return ODONTOGRAM_STAGE_ALIASES[normalized] || 'existing';
};

const sanitizeOdontogramSurfaces = (surfaces) => {
    if (!Array.isArray(surfaces)) return [];
    const normalized = new Set(
        surfaces
            .map((surface) => String(surface || '').trim().toUpperCase())
            .filter((surface) => ODONTOGRAM_SURFACE_CODES.includes(surface))
    );
    return ODONTOGRAM_SURFACE_CODES.filter((surface) => normalized.has(surface));
};

const createOdontogramFindingId = () => `finding_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const buildHealthyOdontogramEntry = (stage = 'existing') => ({
    status: 'healthy',
    surfaces: [],
    stage,
    activeFindingId: null,
    findings: [],
});

const normalizeOdontogramFinding = (raw, fallbackStage = 'existing') => {
    if (!raw) return null;

    const rawStatus = typeof raw === 'string' ? raw : raw.status;
    const status = normalizeOdontogramStatus(rawStatus);
    if (!status || status === 'healthy') return null;

    const stage = normalizeOdontogramStage(typeof raw === 'string' ? fallbackStage : raw.stage || fallbackStage);
    const updatedAtCandidate = typeof raw === 'object' && raw !== null && raw.updatedAt
        ? new Date(raw.updatedAt)
        : new Date();
    const updatedAt = Number.isNaN(updatedAtCandidate.getTime()) ? new Date() : updatedAtCandidate;

    return {
        id: typeof raw === 'object' && raw !== null && raw.id
            ? String(raw.id)
            : createOdontogramFindingId(),
        status,
        surfaces: sanitizeOdontogramSurfaces(typeof raw === 'string' ? [] : raw.surfaces),
        stage,
        note: typeof raw === 'object' && raw !== null && raw.note ? String(raw.note).trim() : '',
        updatedAt,
    };
};

const getLatestFindingForStage = (findings, stageKey) => (
    [...findings].reverse().find((finding) => finding.stage === stageKey) || null
);

const pickPreferredOdontogramFinding = (findings, activeFindingId) => {
    if (!Array.isArray(findings) || findings.length === 0) return null;
    const activeFinding = findings.find((finding) => finding.id === activeFindingId);
    if (activeFinding) return activeFinding;
    for (const stageKey of ODONTOGRAM_STAGE_ORDER) {
        const finding = getLatestFindingForStage(findings, stageKey);
        if (finding) return finding;
    }
    return findings[findings.length - 1] || null;
};

const buildOdontogramFindingSnapshot = (finding) => {
    if (!finding || !finding.status || finding.status === 'healthy') return null;

    return {
        id: finding.id ? String(finding.id) : '',
        status: normalizeOdontogramStatus(finding.status),
        stage: normalizeOdontogramStage(finding.stage || 'existing'),
        surfaces: sanitizeOdontogramSurfaces(finding.surfaces),
        note: typeof finding.note === 'string' ? finding.note.trim() : '',
        updatedAt: finding.updatedAt ? new Date(finding.updatedAt) : new Date(),
    };
};

const areSameOdontogramFindings = (left, right) => {
    const leftSnapshot = buildOdontogramFindingSnapshot(left);
    const rightSnapshot = buildOdontogramFindingSnapshot(right);

    if (!leftSnapshot && !rightSnapshot) return true;
    if (!leftSnapshot || !rightSnapshot) return false;

    return leftSnapshot.status === rightSnapshot.status
        && leftSnapshot.stage === rightSnapshot.stage
        && leftSnapshot.note === rightSnapshot.note
        && leftSnapshot.surfaces.join('|') === rightSnapshot.surfaces.join('|');
};

const mergeOdontogramEntryWithPrevious = (previousEntry, nextEntry) => {
    const normalizedPreviousEntry = normalizeOdontogramEntry(previousEntry);
    const normalizedNextEntry = normalizeOdontogramEntry(nextEntry);

    const previousFindingsByStage = Object.fromEntries(
        ODONTOGRAM_STAGE_ORDER.map((stageKey) => [stageKey, getLatestFindingForStage(normalizedPreviousEntry.findings || [], stageKey)])
    );

    const mergedFindings = ODONTOGRAM_STAGE_ORDER
        .map((stageKey) => {
            const nextFinding = getLatestFindingForStage(normalizedNextEntry.findings || [], stageKey);
            if (!nextFinding) return null;

            const previousFinding = previousFindingsByStage[stageKey];
            if (previousFinding && areSameOdontogramFindings(previousFinding, nextFinding)) {
                return {
                    ...nextFinding,
                    id: previousFinding.id,
                    updatedAt: previousFinding.updatedAt,
                };
            }

            return {
                ...nextFinding,
                updatedAt: nextFinding.updatedAt ? new Date(nextFinding.updatedAt) : new Date(),
            };
        })
        .filter(Boolean);

    const activeFinding = pickPreferredOdontogramFinding(mergedFindings, normalizedNextEntry.activeFindingId);
    if (!activeFinding) return buildHealthyOdontogramEntry();

    return {
        status: activeFinding.status,
        surfaces: activeFinding.surfaces,
        stage: activeFinding.stage,
        activeFindingId: activeFinding.id,
        findings: mergedFindings.map((finding) => ({
            id: finding.id,
            status: finding.status,
            surfaces: finding.surfaces,
            stage: finding.stage,
            note: finding.note,
            updatedAt: finding.updatedAt,
        })),
    };
};

const formatOdontogramActorName = (actor) => {
    if (!actor) return 'Unknown user';
    if (actor.name?.first || actor.name?.last) {
        return [actor.name.first, actor.name.middle, actor.name.last].filter(Boolean).join(' ');
    }
    if (typeof actor.name === 'string' && actor.name.trim()) return actor.name.trim();
    return actor.email || actor.id || 'Unknown user';
};

const buildOdontogramLogsFromDiff = ({ tooth, previousEntry, nextEntry, actor }) => {
    const previousNormalized = normalizeOdontogramEntry(previousEntry);
    const nextNormalized = normalizeOdontogramEntry(nextEntry);
    const logs = [];

    ODONTOGRAM_STAGE_ORDER.forEach((stageKey) => {
        const previousFinding = buildOdontogramFindingSnapshot(
            getLatestFindingForStage(previousNormalized.findings || [], stageKey)
        );
        const nextFinding = buildOdontogramFindingSnapshot(
            getLatestFindingForStage(nextNormalized.findings || [], stageKey)
        );

        if (!previousFinding && !nextFinding) return;
        if (areSameOdontogramFindings(previousFinding, nextFinding)) return;

        let eventType = 'updated';
        if (!previousFinding && nextFinding) eventType = 'created';
        if (previousFinding && !nextFinding) eventType = 'cleared';

        logs.push({
            tooth: String(tooth),
            stage: stageKey,
            eventType,
            statusBefore: previousFinding?.status || '',
            statusAfter: nextFinding?.status || '',
            surfacesBefore: previousFinding?.surfaces || [],
            surfacesAfter: nextFinding?.surfaces || [],
            noteBefore: previousFinding?.note || '',
            noteAfter: nextFinding?.note || '',
            updatedById: actor?.id || null,
            updatedByName: formatOdontogramActorName(actor),
            updatedByRole: actor?.role || '',
        });
    });

    return logs;
};

const normalizeOdontogramEntry = (raw) => {
    if (!raw) return buildHealthyOdontogramEntry();

    let findings = [];

    if (typeof raw === 'string') {
        const legacyFinding = normalizeOdontogramFinding({ status: raw, stage: 'existing', surfaces: [] }, 'existing');
        findings = legacyFinding ? [legacyFinding] : [];
    } else if (Array.isArray(raw.findings) && raw.findings.length > 0) {
        findings = raw.findings
            .map((finding, index) => normalizeOdontogramFinding(
                finding,
                finding?.stage || raw.stage || ODONTOGRAM_STAGE_ORDER[Math.min(index, ODONTOGRAM_STAGE_ORDER.length - 1)]
            ))
            .filter(Boolean);
    } else if (raw.status || raw.stage || Array.isArray(raw.surfaces)) {
        const singleFinding = normalizeOdontogramFinding(raw, raw.stage || 'existing');
        findings = singleFinding ? [singleFinding] : [];
    }

    const activeFinding = pickPreferredOdontogramFinding(findings, raw.activeFindingId);
    if (!activeFinding) return buildHealthyOdontogramEntry();

    return {
        status: activeFinding.status,
        surfaces: activeFinding.surfaces,
        stage: activeFinding.stage,
        activeFindingId: activeFinding.id,
        findings: findings.map((finding) => ({
            id: finding.id,
            status: finding.status,
            surfaces: finding.surfaces,
            stage: finding.stage,
            note: finding.note,
            updatedAt: finding.updatedAt,
        })),
    };
};

const normalizeOdontogramPayload = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { error: 'Odontogram data must be a key-value object.' };
    }

    const normalized = {};

    for (const [rawTooth, rawEntry] of Object.entries(payload)) {
        const tooth = String(rawTooth || '').trim();
        if (!ODONTOGRAM_TOOTH_KEY_REGEX.test(tooth)) {
            return { error: `Invalid tooth number "${tooth}". Use adult FDI numbers like 11, 26, or 48.` };
        }

        normalized[tooth] = normalizeOdontogramEntry(rawEntry);
    }

    return { value: normalized };
};

const serializeOdontogramMap = (odontogramMap) => {
    if (!odontogramMap) return {};
    return Object.fromEntries(
        Object.entries(Object.fromEntries(odontogramMap)).map(([tooth, entry]) => [tooth, normalizeOdontogramEntry(entry)])
    );
};

// -------------------------------------------------------
// ODONTOGRAM: GET the tooth chart for a patient
// -------------------------------------------------------

app.get('/api/patients/:id/odontogram', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id).select('odontogram name assignedBranch assignedBranches');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        if (req.user.role === 'patient' && String(req.params.id) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Access denied. Patients can only view their own odontogram.' });
        }

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!patientBelongsToBranch(patient, scopedBranch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        const odontogramObj = serializeOdontogramMap(patient.odontogram);

        res.json(odontogramObj);
    } catch (error) {
        console.error('Error fetching odontogram:', error);
        res.status(500).json({ message: 'Server error fetching odontogram.' });
    }
});

app.get('/api/patients/:id/odontogram-logs', verifyToken, async (req, res) => {
    try {
        const patient = await User.findById(req.params.id).select('odontogramLogs name assignedBranch assignedBranches');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        if (req.user.role === 'patient' && String(req.params.id) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Access denied. Patients can only view their own odontogram history.' });
        }

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!patientBelongsToBranch(patient, scopedBranch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        const sortedLogs = [...(patient.odontogramLogs || [])].sort(
            (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
        );

        res.json(sortedLogs);
    } catch (error) {
        console.error('Error fetching odontogram logs:', error);
        res.status(500).json({ message: 'Server error fetching odontogram history.' });
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

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        const normalizedPayload = normalizeOdontogramPayload(req.body);
        if (normalizedPayload.error) {
            return res.status(400).json({ message: normalizedPayload.error });
        }

        if (!patient.odontogram) patient.odontogram = new Map();
        if (!Array.isArray(patient.odontogramLogs)) patient.odontogramLogs = [];
        const newLogs = [];

        Object.entries(normalizedPayload.value).forEach(([tooth, entry]) => {
            const previousEntry = normalizeOdontogramEntry(patient.odontogram.get(tooth));
            const mergedEntry = mergeOdontogramEntryWithPrevious(previousEntry, entry);

            newLogs.push(...buildOdontogramLogsFromDiff({
                tooth,
                previousEntry,
                nextEntry: mergedEntry,
                actor: req.user,
            }));

            if (!mergedEntry.findings || mergedEntry.findings.length === 0) {
                patient.odontogram.delete(tooth);
                return;
            }
            patient.odontogram.set(tooth, mergedEntry);
        });

        if (newLogs.length > 0) {
            patient.odontogramLogs.push(...newLogs);
        }

        patient.markModified('odontogram');
        patient.markModified('odontogramLogs');
        await patient.save();

        await AuditLog.create({
            action: 'UPDATE_ODONTOGRAM',
            user: req.user?.email,
            role: req.user?.role,
            details: `Odontogram updated for patient ID ${req.params.id}`
        });

        res.json({
            message: 'Odontogram saved successfully.',
            odontogram: serializeOdontogramMap(patient.odontogram)
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
    const allowedRoles = ['administrator', 'branch-manager', 'secretary', 'dentist', 'owner', 'patient'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const patient = await User.findById(req.params.id).select('radiographs name assignedBranch assignedBranches');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        if (req.user.role === 'patient' && String(req.params.id) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Access denied. Patients can only view their own radiographs.' });
        }

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!patientBelongsToBranch(patient, scopedBranch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        const sorted = (patient.radiographs || []).sort(
            (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
        );

        res.json(sorted.map((entry) => buildRadiographPayload(entry)));
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
    if (!(await assertSystemFeatureEnabled(res, 'radiographUploads'))) {
        return;
    }
    try {
        const { label, date, url, notes, findings, radiographNumber } = req.body;

        if (!label || !date) {
            return res.status(400).json({ message: 'Label and date are required.' });
        }

        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

        if (!patient.radiographs) patient.radiographs = [];

        const newEntry = {
            label,
            date: new Date(date),
            radiographNumber: String(radiographNumber || '').trim(),
            url: url || null,
            enhancedUrl: '',
            enhancedAt: null,
            enhancedBy: null,
            enhancementVariants: {
                basic: {},
                selfHosted: {},
                huggingFace: {},
            },
            lastEnhancementEngine: '',
            findings: String(findings || '').trim(),
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
        await createPatientNotification({
            patientId: patient._id,
            type: 'NEW_RADIOGRAPH',
            title: 'New Radiograph Available',
            message: `A new radiograph record "${label}" dated ${formatEmailDateLabel(date)} is now available in your patient records.`,
            relatedId: patient._id,
        });
        res.status(201).json(buildRadiographPayload(added));

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
    if (!(await assertSystemFeatureEnabled(res, 'radiographUploads'))) {
        return;
    }
    try {
        const patient = await User.findById(req.params.id);
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        if (req.user.role === 'dentist') {
            const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
            if (!canAccess) {
                return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
            }
        }

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
        await reconcilePatientTreatmentLogsFromCompletedAppointments(req.user.id);

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

app.get('/api/my/visit-prediction', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        await reconcilePatientTreatmentLogsFromCompletedAppointments(req.user.id);

        const patient = await User.findById(req.user.id).select('treatmentLogs notifVisitWindow');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const prediction = getPredictiveVisitWindowFromTreatmentHistory(patient.treatmentLogs || []);

        return res.json({
            prediction,
            notificationsEnabled: patient.notifVisitWindow ?? true,
        });
    } catch (error) {
        console.error('Error fetching predictive visit window:', error);
        return res.status(500).json({ message: 'Server error.' });
    }
});

app.get('/api/my/odontogram', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const patient = await User.findById(req.user.id).select('odontogram');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const odontogramObj = serializeOdontogramMap(patient.odontogram);
        res.json(odontogramObj);
    } catch (error) {
        console.error('Error fetching own odontogram:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.get('/api/my/odontogram-logs', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const patient = await User.findById(req.user.id).select('odontogramLogs');
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        const sortedLogs = [...(patient.odontogramLogs || [])].sort(
            (left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)
        );
        res.json(sortedLogs);
    } catch (error) {
        console.error('Error fetching own odontogram logs:', error);
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

// ─── PATIENT MOBILE: Patient settings (notification prefs + privacy consent) ───

// GET /api/my/settings — return patient's current preferences
app.get('/api/my/settings', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const patient = await User.findById(req.user.id).select(
            'educationConsent notifAppointments notifVisitWindow notifHealthTips'
        );
        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        res.json({
            educationConsent:  patient.educationConsent  ?? false,
            notifAppointments: patient.notifAppointments ?? true,
            notifVisitWindow:  patient.notifVisitWindow  ?? true,
            notifHealthTips:   patient.notifHealthTips   ?? true,
        });
    } catch (error) {
        console.error('Error fetching patient settings:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// PATCH /api/my/settings — update patient's preferences
app.patch('/api/my/settings', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const allowed = ['educationConsent', 'notifAppointments', 'notifVisitWindow', 'notifHealthTips'];
        const updates = {};
        for (const key of allowed) {
            if (typeof req.body[key] === 'boolean') {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided.' });
        }

        const patient = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updates },
            { new: true, select: 'educationConsent notifAppointments notifVisitWindow notifHealthTips' }
        );

        if (!patient) return res.status(404).json({ message: 'Patient not found.' });

        await AuditLog.create({
            action:  'UPDATE_PATIENT_SETTINGS',
            user:    req.user.email,
            role:    req.user.role,
            details: `Patient updated settings: ${JSON.stringify(updates)}`,
            actorId: req.user.id,
        });

        res.json({
            message:           'Settings saved.',
            educationConsent:  patient.educationConsent,
            notifAppointments: patient.notifAppointments,
            notifVisitWindow:  patient.notifVisitWindow,
            notifHealthTips:   patient.notifHealthTips,
        });
    } catch (error) {
        console.error('Error saving patient settings:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// -------------------------------------------------------
// INVENTORY DEDUCTION: Reduce stock after treatment
// -------------------------------------------------------

app.patch('/api/inventory/deduct', verifyToken, async (req, res) => {
    if (!INVENTORY_USAGE_ROLES.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        await ensureInventoryMigration();
        const { itemsUsed, patientId } = req.body;

        if (!itemsUsed || !Array.isArray(itemsUsed) || itemsUsed.length === 0) {
            return res.status(400).json({ message: 'itemsUsed array is required.' });
        }

        const branch = await getScopedInventoryBranch(req.user);
        const results = [];
        const errors = [];

        for (const item of itemsUsed) {
            const { inventoryId, itemId, quantityUsed } = item;
            const targetId = inventoryId || itemId;
            const requiredQty = Number(quantityUsed || 0);

            if (!targetId || requiredQty <= 0) {
                errors.push({ inventoryId: targetId, error: 'Invalid item or quantity.' });
                continue;
            }

            let inventoryItem = await InventoryItem.findById(targetId);
            let selectedBatch = null;
            let itemBranch = inventoryItem?.branch || '';

            if (!inventoryItem) {
                const batchHit = await InventoryBatch.findById(targetId).populate('inventoryItem');
                selectedBatch = batchHit || null;
                inventoryItem = batchHit?.inventoryItem || null;
                itemBranch = batchHit?.branch || inventoryItem?.branch || '';
            }

            if (!inventoryItem) {
                errors.push({ inventoryId: targetId, error: 'Item not found.' });
                continue;
            }

            if (branch && itemBranch !== branch) {
                errors.push({ inventoryId: targetId, itemName: inventoryItem.name, error: 'Access denied for this branch inventory.' });
                continue;
            }

            let activeBatches = await InventoryBatch.find({
                inventoryItem: inventoryItem._id,
                branch: inventoryItem.branch,
                quantityRemaining: { $gt: 0 },
            }).sort({ expirationDate: 1, receivedDate: 1, createdAt: 1 });

            if (selectedBatch) {
                const selectedBatchId = String(selectedBatch._id);
                activeBatches = activeBatches.sort((left, right) => {
                    const leftIsSelected = String(left._id) === selectedBatchId ? 1 : 0;
                    const rightIsSelected = String(right._id) === selectedBatchId ? 1 : 0;
                    return rightIsSelected - leftIsSelected;
                });
            }

            const availableQty = activeBatches.reduce((sum, batch) => sum + Number(batch.quantityRemaining || 0), 0);
            if (availableQty < requiredQty) {
                errors.push({
                    inventoryId: targetId,
                    itemName: inventoryItem.name,
                    error: `Insufficient stock. Available: ${availableQty} ${inventoryItem.unit}.`
                });
                continue;
            }

            let remainingToDeduct = requiredQty;
            const consumedBatches = [];

            for (const batch of activeBatches) {
                if (remainingToDeduct <= 0) break;

                const usableQty = Math.min(Number(batch.quantityRemaining || 0), remainingToDeduct);
                batch.quantityRemaining -= usableQty;
                syncBatchStatus(batch);
                await batch.save();

                remainingToDeduct -= usableQty;
                consumedBatches.push({
                    batchId: batch._id,
                    brand: batch.brand || 'Unspecified',
                    batchNumber: batch.batchNumber || '',
                    quantity: usableQty,
                    expirationDate: batch.expirationDate || null,
                    receivedDate: batch.receivedDate || null,
                });
            }

            results.push({
                requestedInventoryId: targetId,
                inventoryId: inventoryItem._id,
                itemName: inventoryItem.name,
                previousQty: availableQty,
                deducted: requiredQty,
                remainingQty: availableQty - requiredQty,
                isLowStock: (availableQty - requiredQty) <= Number(inventoryItem.lowStockThreshold || 0),
                consumedBatches,
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
        const { isArchived, reason } = req.body;
        const nextArchivedState = Boolean(isArchived);

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const lifecyclePermission = canManageStaffLifecycle({ actor: req.user, target: user });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }

        if (Boolean(user.isArchived) === nextArchivedState) {
            return res.json({
                message: `User is already ${nextArchivedState ? 'archived' : 'restored'}.`,
                user: {
                    _id: user._id,
                    email: user.email,
                    isArchived: user.isArchived,
                    status: user.status,
                    archivedAt: user.archivedAt,
                    restoredAt: user.restoredAt,
                }
            });
        }

        if (nextArchivedState) {
            const trimmedReason = String(reason || '').trim();
            if (!trimmedReason) {
                return res.status(400).json({ message: 'A reason is required when archiving an account.' });
            }

            const impact = await collectLifecycleImpact({
                actor: req.user,
                targetUser: user,
                action: 'archive',
            });
            if (!impact.allowed) {
                return res.status(409).json({
                    message: impact.blockers[0] || 'This account cannot be archived yet.',
                    blockers: impact.blockers,
                    impact,
                });
            }
        }

        user.isArchived = nextArchivedState;
        user.status = 'inactive';
        if (nextArchivedState) {
            user.archivedAt = new Date();
            user.archivedBy = req.user.id;
            user.archiveReason = String(reason || '').trim();
            user.restoredAt = null;
            user.restoredBy = null;
            user.deactivatedAt = new Date();
            user.deactivatedBy = req.user.id;
            user.deactivationReason = String(reason || '').trim();
        } else {
            user.restoredAt = new Date();
            user.restoredBy = req.user.id;
            user.deactivatedAt = null;
            user.deactivatedBy = null;
            user.deactivationReason = '';
        }

        await user.save();

        const archiveDetails = nextArchivedState && user.archiveReason
            ? `${user.role} ${user.email} was archived. Reason: ${user.archiveReason}`
            : `${user.role} ${user.email} was restored.`;

        await AuditLog.create({
            action: nextArchivedState ? 'ARCHIVE_USER' : 'RESTORE_USER',
            user: req.user?.email,
            role: req.user?.role,
            actorId: req.user?.id,
            actorRole: req.user?.role,
            targetId: user._id,
            targetModel: 'User',
            details: archiveDetails
        });

        res.json({
            message: `User ${nextArchivedState ? 'archived' : 'restored'} successfully.`,
            user: {
                _id: user._id,
                email: user.email,
                isArchived: user.isArchived,
                status: user.status,
                archivedAt: user.archivedAt,
                restoredAt: user.restoredAt,
            }
        });
    } catch (error) {
        console.error('Error archiving user:', error);
        res.status(500).json({ message: 'Server error archiving user.' });
    }
});

app.put('/api/patient/archive/:id', verifyToken, async (req, res) => {
    try {
        const allowedRoles = ['administrator', 'owner', 'branch-manager', 'secretary'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { isArchived, reason } = req.body;
        const nextArchivedState = Boolean(isArchived);
        const patient = await User.findById(req.params.id);
        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ message: 'Patient not found.' });
        }

        const lifecyclePermission = canManagePatientLifecycle({ actor: req.user, patient });
        if (!lifecyclePermission.allowed) {
            return res.status(403).json({ message: lifecyclePermission.message });
        }

        if (Boolean(patient.isArchived) === nextArchivedState) {
            return res.json({
                message: `Patient is already ${nextArchivedState ? 'archived' : 'restored'}.`,
                patient: {
                    _id: patient._id,
                    email: patient.email,
                    isArchived: patient.isArchived,
                    status: patient.status,
                    archivedAt: patient.archivedAt,
                    restoredAt: patient.restoredAt,
                }
            });
        }

        if (nextArchivedState) {
            const trimmedReason = String(reason || '').trim();
            if (!trimmedReason) {
                return res.status(400).json({ message: 'A reason is required when archiving a patient account.' });
            }

            const impact = await collectLifecycleImpact({
                actor: req.user,
                targetUser: patient,
                action: 'archive',
            });
            if (!impact.allowed) {
                return res.status(409).json({
                    message: impact.blockers[0] || 'This patient account cannot be archived yet.',
                    blockers: impact.blockers,
                    impact,
                });
            }
        }

        patient.isArchived = nextArchivedState;
        patient.status = 'inactive';
        if (nextArchivedState) {
            patient.archivedAt = new Date();
            patient.archivedBy = req.user.id;
            patient.archiveReason = String(reason || '').trim();
            patient.restoredAt = null;
            patient.restoredBy = null;
            patient.deactivatedAt = new Date();
            patient.deactivatedBy = req.user.id;
            patient.deactivationReason = String(reason || '').trim();
        } else {
            patient.restoredAt = new Date();
            patient.restoredBy = req.user.id;
            patient.deactivatedAt = null;
            patient.deactivatedBy = null;
            patient.deactivationReason = '';
        }

        await patient.save();

        const patientArchiveDetails = nextArchivedState && patient.archiveReason
            ? `Patient ${patient.email} was archived. Reason: ${patient.archiveReason}`
            : `Patient ${patient.email} was restored.`;

        await AuditLog.create({
            action: nextArchivedState ? 'ARCHIVE_PATIENT' : 'RESTORE_PATIENT',
            user: req.user?.email,
            role: req.user?.role,
            actorId: req.user?.id,
            actorRole: req.user?.role,
            targetId: patient._id,
            targetModel: 'User',
            details: patientArchiveDetails
        });

        res.json({
            message: `Patient ${nextArchivedState ? 'archived' : 'restored'} successfully.`,
            patient: {
                _id: patient._id,
                email: patient.email,
                isArchived: patient.isArchived,
                status: patient.status,
                archivedAt: patient.archivedAt,
                restoredAt: patient.restoredAt,
            }
        });
    } catch (error) {
        console.error('Error archiving patient:', error);
        res.status(500).json({ message: 'Server error archiving patient.' });
    }
});


// -------------------------------------------------------
// DASHBOARD STATS
// -------------------------------------------------------

app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
    try {
        const STATS_ALLOWED = ['administrator', 'branch-manager', 'dentist', 'secretary', 'owner'];
        if (!STATS_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
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
            InventoryBatch.aggregate([
                {
                    $lookup: {
                        from: 'inventoryitems',
                        localField: 'inventoryItem',
                        foreignField: '_id',
                        as: 'item',
                    }
                },
                { $unwind: '$item' },
                {
                    $group: {
                        _id: '$inventoryItem',
                        quantityRemaining: { $sum: '$quantityRemaining' },
                        lowStockThreshold: { $first: '$item.lowStockThreshold' },
                    }
                },
                {
                    $match: {
                        $expr: { $lte: ['$quantityRemaining', '$lowStockThreshold'] }
                    }
                },
                { $count: 'count' }
            ]),
            User.countDocuments({ role: 'patient', createdAt: { $gte: todayStart, $lte: todayEnd } })
        ]);

        res.json({
            totalPatients,
            activeDentists,
            todayAppointments,
            pendingAppointments,
            lowStockItems: lowStockItems?.[0]?.count || 0,
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
        const currentUser = await User.findById(req.user.id).select(
            'role notificationPreferences notifAppointments notifVisitWindow notifHealthTips'
        );
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const notificationQuery = buildNotificationAudienceQuery(req.user);
        if (!notificationQuery) {
            return res.status(400).json({ message: 'Invalid notification audience.' });
        }

        const rawNotifications = await Notification.find(notificationQuery)
            .sort({ createdAt: -1 })
            .limit(200);

        const notifications = rawNotifications
            .filter((notification) => isNotificationVisibleToUser(currentUser, notification))
            .slice(0, 50);

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: "Server error." });
    }
});

// Mark all notifications as read for the user
app.patch('/api/notifications/read-all', verifyToken, async (req, res) => {
    try {
        const notificationQuery = buildNotificationAudienceQuery(req.user);
        if (!notificationQuery) {
            return res.status(400).json({ message: 'Invalid notification audience.' });
        }

        await Notification.updateMany(
            {
                ...notificationQuery,
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
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        const recipientId = notification.recipientId?.toString?.();
        const roleMatches = notification.recipientRole === req.user.role;
        const userMatches = recipientId === req.user.id;
        if (recipientId && !userMatches) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        if (notification.recipientRole && !roleMatches) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        notification.isRead = true;
        await notification.save();
        res.json(notification);
    } catch (error) {
        console.error('Error marking notification read:', error);
        res.status(500).json({ message: "Server error." });
    }
});

app.patch('/api/notifications/:id/unread', verifyToken, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        const recipientId = notification.recipientId?.toString?.();
        const roleMatches = notification.recipientRole === req.user.role;
        const userMatches = recipientId === req.user.id;
        if (recipientId && !userMatches) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        if (notification.recipientRole && !roleMatches) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        notification.isRead = false;
        await notification.save();
        res.json(notification);
    } catch (error) {
        console.error('Error marking notification unread:', error);
        res.status(500).json({ message: "Server error." });
    }
});

app.get('/api/branches', verifyToken, async (req, res) => {
    try {
        const BRANCH_ALLOWED = ['administrator', 'branch-manager', 'owner', 'secretary', 'dentist'];
        if (!BRANCH_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        let filter = {};

        const isPatientTransferContext = req.query.context === 'patient-transfer';
        if (req.user.role === 'branch-manager' && !isPatientTransferContext) {
            if (!req.user.assignedBranch) {
                return res.status(403).json({ message: 'Access denied. No assigned branch found.' });
            }
            filter = { name: req.user.assignedBranch };
        } else if (req.query.all !== 'true') {
            filter.isActive = true;
        }

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
        const { name, address, addressDetails, contactNumber } = req.body;
        if (!name) return res.status(400).json({ message: 'Branch name is required.' });
        if (contactNumber && !/^\+639\d{9}$/.test(String(contactNumber).trim())) {
            return res.status(400).json({ message: 'Invalid contact number format.' });
        }
 
        const existing = await Branch.findOne({ name: name.trim() });
        if (existing) return res.status(409).json({ message: 'A branch with this name already exists.' });
 
        const newBranch = new Branch({
            name: name.trim(),
            address,
            addressDetails: addressDetails || undefined,
            contactNumber: contactNumber?.trim() || '',
        });
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
        const { name, address, addressDetails, contactNumber, isActive } = req.body;
        if (!name) return res.status(400).json({ message: 'Branch name is required.' });
        if (contactNumber && !/^\+639\d{9}$/.test(String(contactNumber).trim())) {
            return res.status(400).json({ message: 'Invalid contact number format.' });
        }
        const updatedBranch = await Branch.findByIdAndUpdate(
            req.params.id,
            {
                name: name.trim(),
                address,
                addressDetails: addressDetails || undefined,
                contactNumber: contactNumber?.trim() || '',
                isActive,
            },
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

app.get('/api/procedures', verifyToken, async (req, res) => {
    try {
        const procedures = await getClinicProcedureCatalog();
        res.json({ procedures });
    } catch (error) {
        console.error('Error fetching clinic procedures:', error);
        res.status(500).json({ message: 'Server error fetching clinic procedures.' });
    }
});
 
app.get('/api/system-config', verifyToken, async (req, res) => {
    try {
        const CONFIG_ALLOWED = ['administrator', 'owner', 'branch-manager', 'secretary', 'dentist'];
        if (!CONFIG_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        res.json(await getNormalizedSystemConfig());
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
 
        const payload = normalizeSystemConfigPayload({
            ...req.body,
            updatedBy: req.user?.email,
        });

        let config = await SystemConfig.findOne();
        if (!config) {
            config = new SystemConfig(payload);
        } else {
            Object.assign(config, payload);
        }
        await config.save();
 
        await AuditLog.create({
            action: 'CONFIG_CHANGED',
            user: req.user?.email,
            role: req.user?.role,
            details: 'System configuration updated.'
        });
 
        res.json(normalizeSystemConfigResponse(config));
    } catch (error) {
        console.error('Error updating system config:', error);
        res.status(500).json({ message: 'Server error updating system config.' });
    }
});

// -------------------------------------------------------
// DELETE USER (Administrator only)
// -------------------------------------------------------
app.delete('/api/users/:id', verifyToken, async (req, res) => {
    try {
        const ALLOWED_ROLES = ['administrator'];
        if (!ALLOWED_ROLES.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        // Co-admin cannot delete administrator accounts — log the attempt
        if (user.role === 'administrator') {
            return res.status(403).json({ message: 'Cannot delete an administrator account.' });
        }

        const impact = await collectLifecycleImpact({
            actor: req.user,
            targetUser: user,
            action: 'delete',
        });
        if (!impact.allowed) {
            return res.status(409).json({
                message: impact.blockers[0] || 'This account cannot be permanently deleted.',
                blockers: impact.blockers,
                impact,
            });
        }

        await User.findByIdAndDelete(req.params.id);

        await AuditLog.create({
            action: 'DELETE_USER',
            user: req.user?.email,
            role: req.user?.role,
            actorId: req.user?.id,
            actorRole: req.user?.role,
            targetId: user._id,
            targetModel: 'User',
            details: `Permanently deleted archived user: ${user.email} (role: ${user.role})`
        });

        res.json({ message: 'Archived user deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error deleting user.' });
    }
});

// -------------------------------------------------------
// MATERIAL USAGE LOG — POST (create)
// -------------------------------------------------------
const MATERIAL_USAGE_ALLOWED = [
    'dentist', 'administrator', 'branch-manager', 'owner'
];

// -------------------------------------------------------
// MATERIAL USAGE — GET completed appointments for dentist
// Returns Surgery records that are 'completed' and
// assigned to this dentist's branch, for the current dentist.
// -------------------------------------------------------
app.get('/api/material-usage/appointments', verifyToken, async (req, res) => {
    try {
        if (!['dentist', 'owner'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const dentistUser = await User.findById(req.user.id).select('assignedBranch assignedBranches');
        const dentistBranch = dentistUser?.assignedBranch || dentistUser?.assignedBranches?.[0] || '';

        const filter = {
            status: 'completed',
            dentist: req.user.id,
        };
        if (dentistBranch) filter.branch = dentistBranch;

        const appointments = await Surgery.find(filter)
            .populate('patient', 'name')
            .sort({ updatedAt: -1 })
            .limit(200);

        const result = appointments.map(appt => ({
            _id: appt._id,
            patientId: appt.patient?._id || null,
            patientName: appt.patient
                ? `${appt.patient.name?.first || ''} ${appt.patient.name?.last || ''}`.trim()
                : (appt.guestName || 'Guest'),
            procedure: appt.procedure,
            completedAt: appt.updatedAt, // updatedAt reflects when status was last changed to 'completed'
            branch: appt.branch,
        }));

        res.json(result);
    } catch (error) {
        console.error('Error fetching appointments for material usage:', error);
        res.status(500).json({ message: 'Server error fetching appointments.' });
    }
});

app.post('/api/material-usage', verifyToken, async (req, res) => {
    try {
        if (!MATERIAL_USAGE_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        // Owners without isDentist flag cannot create usage logs
        if (req.user.role === 'owner' && !req.user.isDentist) {
            return res.status(403).json({ message: 'Access denied. Dentist access required.' });
        }

        const { patientId, procedureType, materials, notes, usedAt } = req.body;
        if (!procedureType || !materials || !Array.isArray(materials) || materials.length === 0) {
            return res.status(400).json({ message: 'Procedure type and at least one material are required.' });
        }

        const dentist = await User.findById(req.user.id).select('name assignedBranch assignedBranches');
        const dentistName = dentist
            ? `${dentist.name?.first || ''} ${dentist.name?.last || ''}`.trim()
            : '';
        // Auto-resolve branch from dentist's profile — no branch input accepted from client
        const resolvedBranch = dentist?.assignedBranch || dentist?.assignedBranches?.[0] || '';

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
            branch: resolvedBranch,
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
// RADIOGRAPH ENHANCER
// -------------------------------------------------------
const ENHANCE_ALLOWED = ['dentist'];
app.post('/api/radiographs/enhance', verifyToken, async (req, res) => {
    try {
        if (!(await assertSystemFeatureEnabled(res, 'radiographUploads'))) {
            return;
        }
        if (!ENHANCE_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied. Only dentists can enhance radiographs.' });
        }

        const { patientId, radiographId, engine, model, provider } = req.body;
        if (!patientId || !radiographId) {
            return res.status(400).json({ message: 'patientId and radiographId are required.' });
        }
        const engineConfig = getRadiographEnhancementConfig(engine);

        const patient = await User.findById(patientId).select('role radiographs');
        if (!patient || patient.role !== 'patient') {
            return res.status(404).json({ message: 'Patient not found.' });
        }

        const canAccess = await dentistCanAccessPatient(req.user.id, patient._id);
        if (!canAccess) {
            return res.status(403).json({ message: 'Access denied. This patient is not assigned to this dentist.' });
        }

        const radiograph = (patient.radiographs || []).find(
            (entry) => String(entry._id) === String(radiographId)
        );
        if (!radiograph) {
            return res.status(404).json({ message: 'Radiograph entry not found.' });
        }
        if (!radiograph.url) {
            return res.status(400).json({ message: 'This radiograph does not have an image to enhance.' });
        }

        const result = await runRadiographEnhancer(radiograph.url, {
            engine: engineConfig.key,
            model,
            provider,
            upscale: engineConfig.key === 'self-hosted' ? 2 : undefined,
        });
        const enhancedUrl = `data:${result.mediaType};base64,${result.imageBase64}`;
        const generatedAt = new Date();
        const variants = getNormalizedEnhancementVariants(radiograph);

        variants[engineConfig.variantKey] = buildEnhancementVariantRecord({
            url: enhancedUrl,
            engine: engineConfig.storageEngine,
            label: engineConfig.label,
            generatedAt,
            generatedBy: req.user.id,
            provider: result.provider || provider || '',
            model: result.model || model || '',
        });

        radiograph.enhancedUrl = enhancedUrl;
        radiograph.enhancedAt = generatedAt;
        radiograph.enhancedBy = req.user.id;
        radiograph.enhancementVariants = variants;
        radiograph.lastEnhancementEngine = engineConfig.storageEngine;
        patient.markModified('radiographs');
        await patient.save();

        await AuditLog.create({
            action: 'RADIOGRAPH_ENHANCED',
            user: req.user.email,
            role: req.user.role,
            details: `${engineConfig.label} radiograph enhancement saved for radiograph ID ${radiographId} on patient ID ${patientId}.`,
        });

        await createPatientNotification({
            patientId,
            type: 'NEW_RADIOGRAPH',
            title: 'Enhanced Radiograph Ready',
            message: `An enhanced radiograph for "${radiograph.label}" is now available in your patient records.`,
            relatedId: patientId,
        });

        res.json({
            message: `${engineConfig.label} saved successfully.`,
            enhanced: true,
            engine: engineConfig.key,
            radiograph: buildRadiographPayload(radiograph),
        });
    } catch (error) {
        console.error('Radiograph enhance error:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Server error during radiograph enhancement.' });
    }
});

// -------------------------------------------------------
// AI PATIENT CARE COMPANION — Chat proxy
// -------------------------------------------------------

const aiChatLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
    message: { message: 'Too many AI requests. Please wait before trying again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const handlePatientAiChat = async (req, res) => {
    try {
        const geminiService = await ensureAiConfigured(res);
        if (!geminiService) return;

        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { messages, assistantContext } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ message: 'Messages array is required.' });
        }

        const mergedAssistantContext = await buildPatientAiLiveContext({
            userId: req.user.id,
            messages,
            assistantContext,
        });

        const reply = await geminiService.generateScopedReply({
            scope: 'patient',
            messages,
            additionalContext: mergedAssistantContext,
        });

        res.json({ reply });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ message: 'Server error processing AI request.' });
    }
};

app.post('/api/ai/chat', verifyToken, aiChatLimiter, handlePatientAiChat);
app.post('/api/chatbot/message', verifyToken, aiChatLimiter, handlePatientAiChat);

// -------------------------------------------------------
// AI STAFF CHAT ASSISTANT — Streaming SSE (Phase 4)
// -------------------------------------------------------
const STAFF_CHAT_ALLOWED = ['dentist', 'administrator', 'branch-manager', 'secretary', 'owner'];

app.post('/api/ai/staff-chat', verifyToken, aiChatLimiter, async (req, res) => {
    try {
        const geminiService = await ensureAiConfigured(res);
        if (!geminiService) return;
        if (!STAFF_CHAT_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { messages, assistantContext } = req.body;
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

        const stream = await geminiService.generateScopedStream({
            scope: 'staff',
            messages,
            additionalContext: assistantContext,
        });

        if (!stream) {
            res.write(`data: ${JSON.stringify({ text: geminiService.getRefusalText() })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        for await (const chunk of stream) {
            if (chunk?.text) {
                res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
            }
        }

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
        const geminiService = await ensureAiConfigured(res);
        if (!geminiService) return;
        const EDU_ALLOWED = ['dentist', 'administrator', 'branch-manager', 'secretary', 'owner'];
        if (!EDU_ALLOWED.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ message: 'Topic is required.' });

        const content = await geminiService.generateScopedReply({
            scope: 'education',
            messages: [
                { role: 'user', content: `Write a patient-friendly educational article about: ${topic}` },
            ],
        });
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

// POST /api/activity-logs — Patient client logs an in-app action
app.post('/api/activity-logs', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'patient') {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const { action, details } = req.body;
        if (!action) {
            return res.status(400).json({ message: 'action is required.' });
        }

        await AuditLog.create({
            action:   action.toUpperCase(),
            user:     req.user.email,
            role:     req.user.role,
            details:  details || '',
            actorId:  req.user.id,
            actorRole: req.user.role,
        });

        res.status(201).json({ message: 'Activity logged.' });
    } catch (error) {
        console.error('Error creating activity log:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

app.post('/api/queue', verifyToken, async (req, res) => {
    if (!(await assertSystemFeatureEnabled(res, 'queueManagement'))) {
        return;
    }
    try {
        const allowed = ['administrator', 'branch-manager', 'secretary'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
 
        const scopedBranch = isBranchScopedStaff(req.user.role) ? getScopedBranchForUser(req.user) : null;
        const { patientName, branch, assignedDentist, procedureType, contactNumber, patientId, status } = req.body;
        const normalizedBranch = (scopedBranch || branch || '').trim();
        const allowedQueueStatuses = ['pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'];
        const legacyStatusMap = {
            waiting: 'pending',
            serving: 'in-clinic',
            done: 'completed',
            skipped: 'cancelled',
        };
        const normalizedStatus = legacyStatusMap[status] || status || 'pending';

        if (!patientName || !normalizedBranch) {
            return res.status(400).json({ message: 'Patient name and branch are required.' });
        }

        if (!allowedQueueStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        if (patientId) {
            const patient = await User.findById(patientId).select('assignedBranch assignedBranches');
            if (!patient || !patientBelongsToBranch(patient, normalizedBranch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }
 
        // Auto-increment ticket number: max today's ticket + 1 per branch
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
 
        const last = await Queue.findOne({
            branch: normalizedBranch,
            createdAt: { $gte: startOfDay }
        }).sort({ ticketNumber: -1 });
 
        const ticketNumber = last ? last.ticketNumber + 1 : 1;
 
        const entry = await Queue.create({
            patientName: patientName.trim(),
            branch: normalizedBranch,
            ticketNumber,
            status: normalizedStatus,
            assignedDentist: assignedDentist || '',
            procedureType: procedureType || '',
            contactNumber: contactNumber || '',
            patientId: patientId || null
        });

        if (entry.patientId) {
            await notifyPatientQueueStatusChange({
                queueEntry: entry,
                status: entry.status,
                title: 'Walk-in Appointment Created',
            });
        }
 
        await AuditLog.create({
            action: 'QUEUE_CREATE',
            user: req.user?.email,
            role: req.user?.role,
            details: `Walk-in ticket #${ticketNumber} created for ${patientName} at ${normalizedBranch}.`
        });
 
        res.status(201).json(entry);
    } catch (error) {
        console.error('Error creating queue entry:', error);
        res.status(500).json({ message: 'Server error creating queue entry.' });
    }
});
 
// GET /api/queue — get all active queue entries, optionally filtered by branch
app.get('/api/queue', verifyToken, async (req, res) => {
    if (!(await assertSystemFeatureEnabled(res, 'queueManagement'))) {
        return;
    }
    try {
        const allowed = ['administrator', 'branch-manager', 'secretary', 'dentist'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
 
        const filter = {};
 
        if (req.user.role === 'dentist') {
            const dentistUser = await User.findById(req.user.id).select('name assignedBranch assignedBranches');
            const dentistBranch = dentistUser?.assignedBranch || dentistUser?.assignedBranches?.[0] || '';
            if (!dentistBranch) {
                return res.status(403).json({ message: 'Dentist has no assigned branch.' });
            }
            filter.branch = dentistBranch;
        } else if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch) {
                return res.status(403).json({ message: `${req.user.role} has no assigned branch.` });
            }
            if (req.query.branch && req.query.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. You can only view your assigned branch queue.' });
            }
            filter.branch = scopedBranch;
        } else if (req.query.branch) {
            filter.branch = req.query.branch;
        }
 
        const includeHistory = String(req.query.includeHistory || '').trim().toLowerCase() === 'true';

        if (req.query.dateFrom || req.query.dateTo) {
            const createdAtFilter = {};

            if (req.query.dateFrom) {
                const startDate = new Date(req.query.dateFrom);
                startDate.setHours(0, 0, 0, 0);
                if (!Number.isNaN(startDate.getTime())) {
                    createdAtFilter.$gte = startDate;
                }
            }

            if (req.query.dateTo) {
                const endDate = new Date(req.query.dateTo);
                endDate.setHours(23, 59, 59, 999);
                if (!Number.isNaN(endDate.getTime())) {
                    createdAtFilter.$lte = endDate;
                }
            }

            if (Object.keys(createdAtFilter).length > 0) {
                filter.createdAt = createdAtFilter;
            }
        } else if (!includeHistory) {
            // Keep today's queue as the default behavior for queue-only screens.
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            filter.createdAt = { $gte: startOfDay };
        }
 
        let entries = await Queue.find(filter).sort({ createdAt: 1, ticketNumber: 1 });

        if (req.user.role === 'dentist') {
            const dentistUser = await User.findById(req.user.id).select('name');
            const bareName = dentistUser?.name
                ? `${dentistUser.name.first || ''} ${dentistUser.name.last || ''}`.trim().toLowerCase()
                : '';
            const prefixedName = bareName ? `dr. ${bareName}` : '';

            entries = entries.filter((entry) => {
                if (entry.linkedAppointment) return false;
                const assignedDentist = String(entry.assignedDentist || '').trim().toLowerCase();
                return assignedDentist && [bareName, prefixedName].includes(assignedDentist);
            });
        }

        res.json(entries);
    } catch (error) {
        console.error('Error fetching queue:', error);
        res.status(500).json({ message: 'Server error fetching queue.' });
    }
});

app.put('/api/queue/:id', verifyToken, async (req, res) => {
    if (!(await assertSystemFeatureEnabled(res, 'queueManagement'))) {
        return;
    }
    try {
        const allowed = ['administrator', 'branch-manager', 'secretary'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        const existingEntry = await Queue.findById(req.params.id);
        if (!existingEntry) {
            return res.status(404).json({ message: 'Queue entry not found.' });
        }

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch || existingEntry.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This queue entry belongs to a different branch.' });
            }
        }

        if (['completed', 'cancelled'].includes(String(existingEntry.status || '').toLowerCase())) {
            return res.status(400).json({ message: 'Completed and cancelled schedules can no longer be edited.' });
        }

        const {
            patientName,
            patientId,
            branch,
            assignedDentist,
            procedureType,
            contactNumber,
            status,
            tooth,
            category,
            amountCharged,
            amountPaid,
            nextAppointment,
        } = req.body;
        const allowedQueueStatuses = ['pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'];
        const legacyStatusMap = {
            waiting: 'pending',
            serving: 'in-clinic',
            done: 'completed',
            skipped: 'cancelled',
        };

        const normalizedBranch = isBranchScopedStaff(req.user.role)
            ? existingEntry.branch
            : (branch || existingEntry.branch || '').trim();

        if (!patientName || !normalizedBranch) {
            return res.status(400).json({ message: 'Patient name and branch are required.' });
        }

        if (patientId) {
            const patient = await User.findById(patientId).select('assignedBranch assignedBranches');
            if (!patient || !patientBelongsToBranch(patient, normalizedBranch)) {
                return res.status(403).json({ message: 'Access denied. This patient belongs to a different branch.' });
            }
        }

        const nextStatus = legacyStatusMap[status] || status || existingEntry.status;
        if (!allowedQueueStatuses.includes(nextStatus)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }
        const normalizedAmountCharged = amountCharged === undefined ? null : normalizeCurrencyAmount(amountCharged);
        const normalizedAmountPaid = amountPaid === undefined ? null : normalizeCurrencyAmount(amountPaid);
        if ((amountCharged !== undefined && normalizedAmountCharged === null) || (amountPaid !== undefined && normalizedAmountPaid === null)) {
            return res.status(400).json({ message: 'Amount charged and amount paid must be valid positive numbers.' });
        }
        const normalizedNextAppointment = nextAppointment ? new Date(nextAppointment) : null;
        if (nextAppointment && Number.isNaN(normalizedNextAppointment.getTime())) {
            return res.status(400).json({ message: 'Next appointment must be a valid date.' });
        }
        const normalizedBalance = normalizedAmountCharged !== null && normalizedAmountPaid !== null
            ? Number(Math.max(normalizedAmountCharged - normalizedAmountPaid, 0).toFixed(2))
            : 0;
        if (nextStatus === 'completed') {
            if (!String(category || '').trim()) {
                return res.status(400).json({ message: 'Please select a treatment category before completing the schedule.' });
            }
            if (normalizedAmountCharged === null || normalizedAmountPaid === null) {
                return res.status(400).json({ message: 'Please provide the amount charged and amount paid before completing the schedule.' });
            }
        }

        const update = {
            patientName: patientName.trim(),
            patientId: patientId || null,
            branch: normalizedBranch,
            assignedDentist: assignedDentist || '',
            procedureType: procedureType || '',
            contactNumber: contactNumber || '',
            status: nextStatus,
        };

        if (nextStatus === 'in-clinic' && !existingEntry.calledAt) update.calledAt = new Date();
        if ((nextStatus === 'completed' || nextStatus === 'cancelled') && !existingEntry.completedAt) {
            update.completedAt = new Date();
        }

        const entry = await Queue.findByIdAndUpdate(req.params.id, update, { new: true });

        await AuditLog.create({
            action: 'QUEUE_UPDATE',
            user: req.user?.email,
            role: req.user?.role,
            details: `Queue ticket #${entry.ticketNumber} details updated for ${entry.patientName}.`
        });

        if (entry.status === 'completed' && entry.patientId) {
            await appendAutomaticTreatmentLogIfMissing({
                patientId: entry.patientId,
                procedure: entry.procedureType || 'Walk-in Treatment',
                branch: entry.branch,
                dentistName: entry.assignedDentist || '',
                date: entry.completedAt || new Date(),
                tooth: String(tooth || '').trim(),
                category: normalizeTreatmentCategory(category),
                amountCharged: normalizedAmountCharged ?? 0,
                amountPaid: normalizedAmountPaid ?? 0,
                balance: normalizedBalance,
                nextAppointment: normalizedNextAppointment,
                sourceKey: `[AUTO-QUEUE:${entry._id}]`,
            });
        }

        if (entry.patientId) {
            await notifyPatientQueueStatusChange({
                queueEntry: entry,
                status: entry.status,
            });
        }

        res.json(entry);
    } catch (error) {
        console.error('Error updating queue entry:', error);
        res.status(500).json({ message: 'Server error updating queue entry.' });
    }
});
 
// PATCH /api/queue/:id/status — update queue entry status
app.patch('/api/queue/:id/status', verifyToken, async (req, res) => {
    if (!(await assertSystemFeatureEnabled(res, 'queueManagement'))) {
        return;
    }
    try {
        const allowed = ['administrator', 'branch-manager', 'secretary'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
 
        const { status, tooth, category, amountCharged, amountPaid, nextAppointment } = req.body;
        const allowedQueueStatuses = ['pending', 'confirmed', 'in-clinic', 'completed', 'cancelled'];
        const legacyStatusMap = {
            waiting: 'pending',
            serving: 'in-clinic',
            done: 'completed',
            skipped: 'cancelled',
        };
        const normalizedStatus = legacyStatusMap[status] || status;
        if (!allowedQueueStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }
        const normalizedAmountCharged = amountCharged === undefined ? null : normalizeCurrencyAmount(amountCharged);
        const normalizedAmountPaid = amountPaid === undefined ? null : normalizeCurrencyAmount(amountPaid);
        if ((amountCharged !== undefined && normalizedAmountCharged === null) || (amountPaid !== undefined && normalizedAmountPaid === null)) {
            return res.status(400).json({ message: 'Amount charged and amount paid must be valid positive numbers.' });
        }
        const normalizedNextAppointment = nextAppointment ? new Date(nextAppointment) : null;
        if (nextAppointment && Number.isNaN(normalizedNextAppointment.getTime())) {
            return res.status(400).json({ message: 'Next appointment must be a valid date.' });
        }
        const normalizedBalance = normalizedAmountCharged !== null && normalizedAmountPaid !== null
            ? Number(Math.max(normalizedAmountCharged - normalizedAmountPaid, 0).toFixed(2))
            : 0;
        if (normalizedStatus === 'completed') {
            if (!String(category || '').trim()) {
                return res.status(400).json({ message: 'Please select a treatment category before completing the schedule.' });
            }
            if (normalizedAmountCharged === null || normalizedAmountPaid === null) {
                return res.status(400).json({ message: 'Please provide the amount charged and amount paid before completing the schedule.' });
            }
        }
 
        const existingEntry = await Queue.findById(req.params.id);
        if (!existingEntry) return res.status(404).json({ message: 'Queue entry not found.' });

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch || existingEntry.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This queue entry belongs to a different branch.' });
            }
        }

        const update = { status: normalizedStatus };
        if (normalizedStatus === 'in-clinic') update.calledAt = new Date();
        if (normalizedStatus === 'completed' || normalizedStatus === 'cancelled') update.completedAt = new Date();
 
        const entry = await Queue.findByIdAndUpdate(req.params.id, update, { new: true });
 
        await AuditLog.create({
            action: 'QUEUE_UPDATE',
            user: req.user?.email,
            role: req.user?.role,
            details: `Queue ticket #${entry.ticketNumber} status changed to ${normalizedStatus}.`
        });

        if (entry.status === 'completed' && entry.patientId) {
            await appendAutomaticTreatmentLogIfMissing({
                patientId: entry.patientId,
                procedure: entry.procedureType || 'Walk-in Treatment',
                branch: entry.branch,
                dentistName: entry.assignedDentist || '',
                date: entry.completedAt || new Date(),
                tooth: String(tooth || '').trim(),
                category: normalizeTreatmentCategory(category),
                amountCharged: normalizedAmountCharged ?? 0,
                amountPaid: normalizedAmountPaid ?? 0,
                balance: normalizedBalance,
                nextAppointment: normalizedNextAppointment,
                sourceKey: `[AUTO-QUEUE:${entry._id}]`,
            });
        }

        if (entry.patientId) {
            await notifyPatientQueueStatusChange({
                queueEntry: entry,
                status: entry.status,
            });
        }
 
        res.json(entry);
    } catch (error) {
        console.error('Error updating queue status:', error);
        res.status(500).json({ message: 'Server error updating queue.' });
    }
});
 
// DELETE /api/queue/:id — remove a queue entry
app.delete('/api/queue/:id', verifyToken, async (req, res) => {
    if (!(await assertSystemFeatureEnabled(res, 'queueManagement'))) {
        return;
    }
    try {
        const allowed = ['administrator', 'branch-manager', 'secretary'];
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied.' });
        }
 
        const existingEntry = await Queue.findById(req.params.id);
        if (!existingEntry) return res.status(404).json({ message: 'Queue entry not found.' });

        if (isBranchScopedStaff(req.user.role)) {
            const scopedBranch = getScopedBranchForUser(req.user);
            if (!scopedBranch || existingEntry.branch !== scopedBranch) {
                return res.status(403).json({ message: 'Access denied. This queue entry belongs to a different branch.' });
            }
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
    if (!['administrator', 'owner'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const CONFIGURABLE_ROLES = ['branch-manager', 'dentist', 'secretary'];

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
app.put('/api/role-permissions/:role', verifyToken, async (req, res) => {
    const isAdmin = req.user.role === 'administrator';
    const isOwner = req.user.role === 'owner';

    if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: 'Access denied.' });
    }
    try {
        const { role } = req.params;
        const { permissions } = req.body;

        const CONFIGURABLE_ROLES = ['branch-manager', 'dentist', 'secretary'];
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
    const analyticsAllowed = ['administrator', 'branch-manager', 'owner'];
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
            {
                $match: {
                    date: { $gte: sixMonthsAgo },
                    ...branchFilter
                }
            },
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
// Retired: chat/ticket support has been removed from the system.
const retiredSupportTicketHandler = (req, res) => {
    res.status(410).json({ message: 'Chat and ticket support has been removed from the system.' });
};

app.all('/api/support-tickets', verifyToken, retiredSupportTicketHandler);
app.all('/api/support-tickets/:id', verifyToken, retiredSupportTicketHandler);
app.all('/api/support-tickets/:id/messages', verifyToken, retiredSupportTicketHandler);
app.all('/api/support-tickets/:id/status', verifyToken, retiredSupportTicketHandler);

// -------------------------------------------------------
// TRANSFER SYSTEM OWNERSHIP
// Disabled for Phase 2 role cleanup
// -------------------------------------------------------
app.post('/api/transfer-ownership', verifyToken, async (req, res) => {
    return res.status(410).json({ message: 'Ownership transfer is not available in Phase 2.' });
});

setInterval(() => {
    autoCancelOverdueAppointments().catch((error) => {
        console.error('Auto-cancellation worker error:', error);
    });
    remindIncompleteSchedulesForStaff().catch((error) => {
        console.error('Schedule reminder worker error:', error);
    });
    remindPatientsAboutUpcomingAppointments().catch((error) => {
        console.error('Appointment reminder worker error:', error);
    });
    remindPatientsAboutPredictiveVisitWindows().catch((error) => {
        console.error('Predictive visit reminder worker error:', error);
    });
}, 60 * 1000);

autoCancelOverdueAppointments().catch((error) => {
    console.error('Initial auto-cancellation worker error:', error);
});
remindIncompleteSchedulesForStaff().catch((error) => {
    console.error('Initial schedule reminder worker error:', error);
});
remindPatientsAboutUpcomingAppointments().catch((error) => {
    console.error('Initial appointment reminder worker error:', error);
});
remindPatientsAboutPredictiveVisitWindows().catch((error) => {
    console.error('Initial predictive visit reminder worker error:', error);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
