import React, { useEffect, useState } from 'react';
import { PublicClinicConfigPreviewProvider } from '../../hooks/usePublicClinicConfig';
import WebsiteHome from './WebsiteHome';
import WebsiteAbout from './WebsiteAbout';
import WebsiteServices from './WebsiteServices';
import WebsiteContact from './WebsiteContact';
import WebsiteAppointment from './WebsiteAppointment';

export const WEBSITE_PREVIEW_MESSAGE = 'ngitify:website-preview';

const previewPages = {
    home: WebsiteHome,
    about: WebsiteAbout,
    services: WebsiteServices,
    contact: WebsiteContact,
    appointment: WebsiteAppointment,
};

export default function WebsitePreview() {
    const [preview, setPreview] = useState(null);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type !== WEBSITE_PREVIEW_MESSAGE) return;
            setPreview(event.data.payload || null);
        };

        window.addEventListener('message', handleMessage);
        window.parent.postMessage({ type: `${WEBSITE_PREVIEW_MESSAGE}:ready` }, window.location.origin);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    if (!preview?.publicConfig) {
        return (
            <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f9fd', color: '#1f5286', fontFamily: 'sans-serif' }}>
                Loading website preview...
            </div>
        );
    }

    const PreviewPage = previewPages[preview.page] || WebsiteHome;

    const blockPreviewNavigation = (event) => {
        if (event.target.closest('a, button, input, select, textarea')) {
            event.preventDefault();
        }
    };

    return (
        <PublicClinicConfigPreviewProvider value={{ ...preview.publicConfig, loading: false }}>
            <div onClickCapture={blockPreviewNavigation}>
                <PreviewPage />
            </div>
        </PublicClinicConfigPreviewProvider>
    );
}
