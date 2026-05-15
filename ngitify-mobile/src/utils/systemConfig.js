const DEFAULT_DIRECT_BOOKING_PROCEDURES = [
    'General Check-up / Initial Consultation',
    'Prophylaxis / Dental Cleaning',
];

const normalizeProcedureList = (entries = [], fallback = DEFAULT_DIRECT_BOOKING_PROCEDURES) => {
    const normalized = (Array.isArray(entries) ? entries : [])
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean);

    return normalized.length > 0 ? normalized : [...fallback];
};

let cachedAppointmentProcedures = null;
let pendingAppointmentProcedureRequest = null;

const buildPublicSystemConfigUrl = (apiBaseUrl = '') => `${String(apiBaseUrl || '').replace(/\/+$/, '')}/api/public/system-config`;

export const loadPublicAppointmentProcedures = async (apiBaseUrl, { forceRefresh = false } = {}) => {
    if (forceRefresh) {
        cachedAppointmentProcedures = null;
        pendingAppointmentProcedureRequest = null;
    }

    if (cachedAppointmentProcedures) {
        return cachedAppointmentProcedures;
    }

    if (!pendingAppointmentProcedureRequest) {
        pendingAppointmentProcedureRequest = fetch(buildPublicSystemConfigUrl(apiBaseUrl))
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Failed to load public system configuration.');
                }
                const payload = await response.json();
                const procedures = normalizeProcedureList(payload?.appointmentProcedures);
                cachedAppointmentProcedures = procedures;
                return procedures;
            })
            .finally(() => {
                pendingAppointmentProcedureRequest = null;
            });
    }

    return pendingAppointmentProcedureRequest;
};

export const invalidateMobileSystemConfigCache = () => {
    cachedAppointmentProcedures = null;
    pendingAppointmentProcedureRequest = null;
};

export { DEFAULT_DIRECT_BOOKING_PROCEDURES };
