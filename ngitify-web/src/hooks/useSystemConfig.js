import { useEffect, useState } from 'react';
import { authFetch } from '../utils/api';
import {
    cloneWebsiteContentDefaults,
} from '../data/websiteContent';

const SYSTEM_CONFIG_UPDATED_EVENT = 'ngitify-system-config-updated';

const DEFAULT_SYSTEM_CONFIG = {
    clinicName: '',
    clinicContact: '',
    clinicAddress: '',
    clinicEmail: '',
    clinicLogo: '',
    maxAppointmentsPerDay: 20,
    allowedTimeSlots: ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'],
    onlineBookingProcedures: [
        'General Check-up / Initial Consultation',
        'Prophylaxis / Dental Cleaning',
    ],
    clinicProcedures: [
        'General Check-up / Initial Consultation',
        'Prophylaxis / Dental Cleaning',
        'Oral Prophylaxis (Teeth Cleaning)',
        'Fluoride Application',
        'Teeth Whitening',
        'Tooth Restoration/Filling (Pasta)',
        'Pit and Fissure Sealant Application',
        'Root Canal Treatment',
        'Tooth Extraction (Bunot)',
        'Odontectomy (Wisdom Tooth Removal)',
        'Orthodontics (Braces)',
        'Dentures/Crowns',
        'Retainers',
    ],
    emailTemplates: {
        activation: 'Your Dentime Dental Clinic account is ready. Please activate it to continue.',
        appointmentReminder: 'This is a reminder for your upcoming appointment at Dentime Dental Clinic.',
    },
    featureToggles: {
        queueManagement: true,
        radiographUploads: true,
        chatSupport: false,
        sessionTimeout: true,
    },
    websiteContent: cloneWebsiteContentDefaults(),
    sessionTimeoutMinutes: 30,
};

const normalizeStringList = (entries = [], fallback = []) => {
    const normalized = (Array.isArray(entries) ? entries : [])
        .map((entry) => String(entry ?? '').trim())
        .filter(Boolean);

    return normalized.length > 0 ? normalized : [...fallback];
};

const cloneServiceHighlightList = (services = []) => services.map((service) => ({
    ...service,
    items: Array.isArray(service?.items) ? [...service.items] : [],
}));

const normalizeServiceHighlightList = (services = [], fallback = []) => {
    const normalized = (Array.isArray(services) ? services : [])
        .map((service, index) => {
            const fallbackService = fallback[index] || { category: '', description: '', items: [] };
            return {
                category: String(service?.category ?? '').trim() || fallbackService.category || '',
                description: String(service?.description ?? '').trim() || fallbackService.description || '',
                items: normalizeStringList(service?.items, fallbackService.items || []),
            };
        })
        .filter((service) => service.category || service.description || service.items.length > 0);

    return normalized.length > 0 ? normalized : cloneServiceHighlightList(fallback);
};

const normalizeWebsiteContent = (value = {}) => {
    const fallback = cloneWebsiteContentDefaults();
    return {
        branding: {
            ...fallback.branding,
            ...(value?.branding || {}),
            instagramHandle: String(value?.branding?.instagramHandle ?? fallback.branding.instagramHandle).replace(/^@+/, '').trim(),
        },
        home: {
            ...fallback.home,
            ...(value?.home || {}),
            journeyPills: normalizeStringList(value?.home?.journeyPills, fallback.home.journeyPills),
            journeyHighlights: normalizeStringList(value?.home?.journeyHighlights, fallback.home.journeyHighlights),
        },
        about: {
            ...fallback.about,
            ...(value?.about || {}),
            highlights: normalizeStringList(value?.about?.highlights, fallback.about.highlights),
        },
        servicesPage: {
            ...fallback.servicesPage,
            ...(value?.servicesPage || {}),
        },
        serviceHighlights: normalizeServiceHighlightList(value?.serviceHighlights, fallback.serviceHighlights),
        locationsPage: {
            ...fallback.locationsPage,
            ...(value?.locationsPage || {}),
        },
        contactPage: {
            ...fallback.contactPage,
            ...(value?.contactPage || {}),
        },
        appointmentPage: {
            ...fallback.appointmentPage,
            ...(value?.appointmentPage || {}),
            steps: normalizeStringList(value?.appointmentPage?.steps, fallback.appointmentPage.steps),
        },
    };
};

let cachedSystemConfig = null;
let pendingSystemConfigRequest = null;

const normalizeSystemConfig = (value = {}) => ({
    ...DEFAULT_SYSTEM_CONFIG,
    ...value,
    allowedTimeSlots: Array.isArray(value?.allowedTimeSlots) && value.allowedTimeSlots.length
        ? value.allowedTimeSlots
        : DEFAULT_SYSTEM_CONFIG.allowedTimeSlots,
    onlineBookingProcedures: Array.isArray(value?.onlineBookingProcedures) && value.onlineBookingProcedures.length
        ? value.onlineBookingProcedures
        : DEFAULT_SYSTEM_CONFIG.onlineBookingProcedures,
    clinicProcedures: Array.isArray(value?.clinicProcedures) && value.clinicProcedures.length
        ? value.clinicProcedures
        : DEFAULT_SYSTEM_CONFIG.clinicProcedures,
    emailTemplates: {
        ...DEFAULT_SYSTEM_CONFIG.emailTemplates,
        ...(value?.emailTemplates || {}),
    },
    featureToggles: {
        ...DEFAULT_SYSTEM_CONFIG.featureToggles,
        ...(value?.featureToggles || {}),
    },
    websiteContent: normalizeWebsiteContent(value?.websiteContent || DEFAULT_SYSTEM_CONFIG.websiteContent),
});

const fetchSystemConfig = async () => {
    const response = await authFetch('/system-config');
    if (!response.ok) {
        throw new Error('Failed to load system configuration.');
    }
    const payload = await response.json();
    const normalized = normalizeSystemConfig(payload);
    cachedSystemConfig = normalized;
    return normalized;
};

const loadSystemConfig = async () => {
    if (cachedSystemConfig) {
        return cachedSystemConfig;
    }
    if (!pendingSystemConfigRequest) {
        pendingSystemConfigRequest = fetchSystemConfig().finally(() => {
            pendingSystemConfigRequest = null;
        });
    }
    return pendingSystemConfigRequest;
};

export const invalidateSystemConfigCache = () => {
    cachedSystemConfig = null;
    pendingSystemConfigRequest = null;
};

export const useSystemConfig = ({ enabled = true } = {}) => {
    const [config, setConfig] = useState(cachedSystemConfig || DEFAULT_SYSTEM_CONFIG);
    const [loading, setLoading] = useState(enabled && !cachedSystemConfig);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return undefined;
        }

        let isMounted = true;

        loadSystemConfig()
            .then((nextConfig) => {
                if (!isMounted) return;
                setConfig(nextConfig);
                setLoading(false);
            })
            .catch(() => {
                if (!isMounted) return;
                setConfig(DEFAULT_SYSTEM_CONFIG);
                setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return undefined;
        }

        let isMounted = true;
        const handleRefresh = () => {
            setLoading(true);
            loadSystemConfig()
                .then((nextConfig) => {
                    if (!isMounted) return;
                    setConfig(nextConfig);
                    setLoading(false);
                })
                .catch(() => {
                    if (!isMounted) return;
                    setConfig(DEFAULT_SYSTEM_CONFIG);
                    setLoading(false);
                });
        };

        window.addEventListener(SYSTEM_CONFIG_UPDATED_EVENT, handleRefresh);
        return () => {
            isMounted = false;
            window.removeEventListener(SYSTEM_CONFIG_UPDATED_EVENT, handleRefresh);
        };
    }, [enabled]);

    return { config, loading };
};

export { SYSTEM_CONFIG_UPDATED_EVENT };

export default useSystemConfig;
