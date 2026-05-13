import { useEffect, useState } from 'react';
import { publicFetch } from '../utils/api';
import {
    appointmentProcedures as fallbackAppointmentProcedures,
    clinicInfo as fallbackClinicInfo,
    cloneWebsiteContentDefaults,
    locationCards as fallbackLocationCards,
} from '../data/websiteContent';
import { SYSTEM_CONFIG_UPDATED_EVENT } from './useSystemConfig';

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

const cloneServiceHighlightList = (services = []) => services.map((service) => ({
    ...service,
    items: Array.isArray(service?.items) ? [...service.items] : [],
}));

const normalizeServiceHighlightList = (services = [], fallback = []) => {
    const normalized = (Array.isArray(services) ? services : [])
        .map((service, index) => {
            const fallbackService = fallback[index] || { category: '', description: '', items: [] };
            return {
                category: normalizeRequiredText(service?.category, fallbackService.category || ''),
                description: normalizeRequiredText(service?.description, fallbackService.description || ''),
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
            tagline: normalizeRequiredText(value?.branding?.tagline, fallback.branding.tagline),
            owner: normalizeRequiredText(value?.branding?.owner, fallback.branding.owner),
            facebookUrl: normalizeRequiredText(value?.branding?.facebookUrl, fallback.branding.facebookUrl),
            facebookName: normalizeRequiredText(value?.branding?.facebookName, fallback.branding.facebookName),
            instagramHandle: normalizeRequiredText(
                String(value?.branding?.instagramHandle ?? '').replace(/^@+/, ''),
                fallback.branding.instagramHandle
            ),
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

const FALLBACK_PUBLIC_CONFIG = {
    clinicInfo: {
        ...fallbackClinicInfo,
        name: fallbackClinicInfo.name,
        contactNumber: fallbackClinicInfo.contactNumber,
        email: '',
        address: fallbackLocationCards[0]?.address || '',
    },
    appointmentProcedures: fallbackAppointmentProcedures,
    featureToggles: {
        chatSupport: false,
    },
    websiteContent: cloneWebsiteContentDefaults(),
    branches: fallbackLocationCards.map((branch) => ({
        name: branch.name,
        address: branch.address,
        contactNumber: fallbackClinicInfo.contactNumber,
        status: branch.status || 'Now Open',
    })),
};

let cachedPublicClinicConfig = null;
let pendingPublicClinicRequest = null;

const normalizePublicClinicConfig = (value = {}) => {
    const websiteContent = normalizeWebsiteContent(value?.websiteContent || {});
    const clinicInfo = {
        ...FALLBACK_PUBLIC_CONFIG.clinicInfo,
        ...(value?.clinicInfo || {}),
        tagline: websiteContent.branding.tagline,
        owner: websiteContent.branding.owner,
        facebookUrl: websiteContent.branding.facebookUrl,
        facebookName: websiteContent.branding.facebookName,
        instagramHandle: websiteContent.branding.instagramHandle,
    };

    const branches = Array.isArray(value?.branches) && value.branches.length
        ? value.branches
            .map((branch) => ({
                name: String(branch?.name || '').trim(),
                address: String(branch?.address || '').trim(),
                contactNumber: String(branch?.contactNumber || clinicInfo.contactNumber || '').trim(),
                status: String(branch?.status || 'Now Open').trim() || 'Now Open',
            }))
            .filter((branch) => branch.name)
        : FALLBACK_PUBLIC_CONFIG.branches;

    return {
        clinicInfo,
        appointmentProcedures: Array.isArray(value?.appointmentProcedures) && value.appointmentProcedures.length
            ? value.appointmentProcedures
            : FALLBACK_PUBLIC_CONFIG.appointmentProcedures,
        featureToggles: {
            ...FALLBACK_PUBLIC_CONFIG.featureToggles,
            ...(value?.featureToggles || {}),
        },
        websiteContent,
        serviceHighlights: websiteContent.serviceHighlights,
        branches,
        locationCards: branches.map((branch) => ({
            name: branch.name,
            status: branch.status,
            address: branch.address,
            note: branch.contactNumber
                ? `Contact this branch through ${branch.contactNumber}.`
                : 'Active Dentime branch.',
        })),
    };
};

const fetchPublicClinicConfig = async () => {
    const response = await publicFetch('/public/system-config');
    if (!response.ok) {
        throw new Error('Failed to load public clinic configuration.');
    }
    const payload = await response.json();
    const normalized = normalizePublicClinicConfig(payload);
    cachedPublicClinicConfig = normalized;
    return normalized;
};

const loadPublicClinicConfig = async () => {
    if (cachedPublicClinicConfig) {
        return cachedPublicClinicConfig;
    }
    if (!pendingPublicClinicRequest) {
        pendingPublicClinicRequest = fetchPublicClinicConfig().finally(() => {
            pendingPublicClinicRequest = null;
        });
    }
    return pendingPublicClinicRequest;
};

export const invalidatePublicClinicConfigCache = () => {
    cachedPublicClinicConfig = null;
    pendingPublicClinicRequest = null;
};

export const usePublicClinicConfig = () => {
    const [config, setConfig] = useState(cachedPublicClinicConfig || normalizePublicClinicConfig());
    const [loading, setLoading] = useState(!cachedPublicClinicConfig);

    useEffect(() => {
        let isMounted = true;

        loadPublicClinicConfig()
            .then((nextConfig) => {
                if (!isMounted) return;
                setConfig(nextConfig);
                setLoading(false);
            })
            .catch(() => {
                if (!isMounted) return;
                setConfig(normalizePublicClinicConfig());
                setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        let isMounted = true;
        const handleRefresh = () => {
            setLoading(true);
            loadPublicClinicConfig()
                .then((nextConfig) => {
                    if (!isMounted) return;
                    setConfig(nextConfig);
                    setLoading(false);
                })
                .catch(() => {
                    if (!isMounted) return;
                    setConfig(normalizePublicClinicConfig());
                    setLoading(false);
                });
        };

        window.addEventListener(SYSTEM_CONFIG_UPDATED_EVENT, handleRefresh);
        return () => {
            isMounted = false;
            window.removeEventListener(SYSTEM_CONFIG_UPDATED_EVENT, handleRefresh);
        };
    }, []);

    return { ...config, loading };
};

export default usePublicClinicConfig;
