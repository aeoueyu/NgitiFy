import websiteContentDefaults from './websiteContentDefaults.json';

const cloneWebsiteContentDefaults = () => JSON.parse(JSON.stringify(websiteContentDefaults));

export const clinicInfo = {
    name: 'Dentime Dental Clinic',
    tagline: websiteContentDefaults.branding.tagline,
    owner: websiteContentDefaults.branding.owner,
    contactNumber: '09524417533',
    email: '',
    address: '2/F JN Terraces Bldg., 881 J. P. Rizal Street, Brgy. Concepcion Uno, Marikina City, Philippines, 1807',
    facebookUrl: websiteContentDefaults.branding.facebookUrl,
    facebookName: websiteContentDefaults.branding.facebookName,
    instagramHandle: websiteContentDefaults.branding.instagramHandle,
};

export const locationCards = [
    {
        name: 'Marikina Branch',
        status: 'Now Open',
        address: '2/F JN Terraces Bldg., 881 J. P. Rizal Street, Brgy. Concepcion Uno, Marikina City, Philippines, 1807',
        note: 'Current active branch for regular appointments and walk-in visits.',
    },
    {
        name: 'Rodriguez, Rizal Branch',
        status: 'Now Open',
        address: '2/F Arquilos Commercial Bldg., Phase 1 Block 12 Lot 3 Eastwood Residences, San Isidro, Rodriguez, Rizal',
        note: 'Now operating and ready to serve more patients in Rizal.',
    },
];

export const defaultWebsiteContent = cloneWebsiteContentDefaults();
export const aboutHighlights = [...defaultWebsiteContent.about.highlights];
export const serviceHighlights = defaultWebsiteContent.serviceHighlights.map((service) => ({
    ...service,
    items: [...service.items],
}));
export const appointmentSteps = [...defaultWebsiteContent.appointmentPage.steps];

export const appointmentProcedures = [
    'General Check-up / Initial Consultation',
    'Prophylaxis / Dental Cleaning',
];

export { cloneWebsiteContentDefaults };
