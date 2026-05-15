import React, { useEffect, useState } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/SystemConfig.module.css';
import { invalidateSystemConfigCache, SYSTEM_CONFIG_UPDATED_EVENT } from '../../hooks/useSystemConfig';
import { invalidatePublicClinicConfigCache } from '../../hooks/usePublicClinicConfig';
import { cloneWebsiteContentDefaults } from '../../data/websiteContent';
import { getDefaultServiceImage, websiteMediaDefaults } from '../../data/websiteMediaDefaults';

const DEFAULT_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const DEFAULT_ONLINE_BOOKING_PROCEDURES = [
    'General Check-up / Initial Consultation',
    'Prophylaxis / Dental Cleaning',
];
const MAX_WEBSITE_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_WEBSITE_SVG_UPLOAD_BYTES = 512 * 1024;
const DEFAULT_PROCEDURES = [
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
];

const buildInitialConfig = () => ({
    clinicName: '',
    clinicContact: '',
    clinicAddress: '',
    clinicEmail: '',
    maxAppointmentsPerDay: 20,
    allowedTimeSlots: [],
    onlineBookingProcedures: DEFAULT_ONLINE_BOOKING_PROCEDURES,
    clinicProcedures: DEFAULT_PROCEDURES,
    emailTemplates: {
        activation: '',
        appointmentReminder: '',
    },
    featureToggles: {
        queueManagement: true,
        radiographUploads: true,
        chatSupport: false,
        sessionTimeout: true,
    },
    websiteContent: cloneWebsiteContentDefaults(),
    sessionTimeoutMinutes: 30,
});

const splitMultilineValue = (value) => String(value || '').split(/\r?\n/);
const joinMultilineValue = (list = []) => (Array.isArray(list) ? list.join('\n') : '');

const buildEmptyServiceHighlight = () => ({
    category: '',
    description: '',
    imageUrl: '',
    items: [''],
});

const formatUploadSize = (bytes) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.ceil(bytes / 1024)} KB`;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read the selected image.'));
    reader.readAsDataURL(file);
});

const mergeWebsiteContent = (value = {}) => {
    const fallback = cloneWebsiteContentDefaults();
    return {
        branding: {
            ...fallback.branding,
            ...(value?.branding || {}),
        },
        home: {
            ...fallback.home,
            ...(value?.home || {}),
            journeyPills: Array.isArray(value?.home?.journeyPills) ? value.home.journeyPills : fallback.home.journeyPills,
            journeyHighlights: Array.isArray(value?.home?.journeyHighlights) ? value.home.journeyHighlights : fallback.home.journeyHighlights,
        },
        about: {
            ...fallback.about,
            ...(value?.about || {}),
            highlights: Array.isArray(value?.about?.highlights) ? value.about.highlights : fallback.about.highlights,
        },
        servicesPage: {
            ...fallback.servicesPage,
            ...(value?.servicesPage || {}),
        },
        serviceHighlights: Array.isArray(value?.serviceHighlights) && value.serviceHighlights.length
            ? value.serviceHighlights.map((service) => ({
                category: service?.category || '',
                description: service?.description || '',
                imageUrl: service?.imageUrl || getDefaultServiceImage(service?.category),
                items: Array.isArray(service?.items) && service.items.length ? service.items : [''],
            }))
            : fallback.serviceHighlights,
        locationsPage: {
            ...fallback.locationsPage,
            ...(value?.locationsPage || {}),
        },
        contactPage: {
            ...fallback.contactPage,
            ...(value?.contactPage || {}),
        },
        media: {
            ...fallback.media,
            ...(value?.media || {}),
            aboutHighlightImageUrls: Array.isArray(value?.media?.aboutHighlightImageUrls) && value.media.aboutHighlightImageUrls.length
                ? value.media.aboutHighlightImageUrls
                : fallback.media.aboutHighlightImageUrls,
        },
        appointmentPage: {
            ...fallback.appointmentPage,
            ...(value?.appointmentPage || {}),
            steps: Array.isArray(value?.appointmentPage?.steps) ? value.appointmentPage.steps : fallback.appointmentPage.steps,
        },
    };
};

const SystemConfig = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [websiteActionMessage, setWebsiteActionMessage] = useState('');
    const [activeSection, setActiveSection] = useState('clinic');
    const [activeWebsiteTab, setActiveWebsiteTab] = useState('branding');
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [config, setConfig] = useState(buildInitialConfig);

    useEffect(() => {
        const fetchConfig = async () => {
            setIsLoading(true);
            try {
                const res = await authFetch('/system-config');
                if (res.ok) {
                    const data = await res.json();
                    setConfig((prev) => ({
                        ...prev,
                        ...data,
                        onlineBookingProcedures: Array.isArray(data?.onlineBookingProcedures) && data.onlineBookingProcedures.length
                            ? data.onlineBookingProcedures
                            : prev.onlineBookingProcedures,
                        clinicProcedures: Array.isArray(data?.clinicProcedures) && data.clinicProcedures.length
                            ? data.clinicProcedures
                            : prev.clinicProcedures,
                        emailTemplates: { ...prev.emailTemplates, ...(data?.emailTemplates || {}) },
                        featureToggles: { ...prev.featureToggles, ...(data?.featureToggles || {}) },
                        websiteContent: mergeWebsiteContent(data?.websiteContent || prev.websiteContent),
                    }));
                }
            } catch {
                setErrorMsg('Failed to load system configuration.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchConfig();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleTemplateChange = (e) => {
        const { name, value } = e.target;
        setConfig((prev) => ({
            ...prev,
            emailTemplates: { ...prev.emailTemplates, [name]: value },
        }));
    };

    const handleToggleChange = (key) => {
        setConfig((prev) => ({
            ...prev,
            featureToggles: { ...prev.featureToggles, [key]: !prev.featureToggles[key] },
        }));
    };

    const handleSlotToggle = (slot) => {
        setConfig((prev) => {
            const hasSlot = prev.allowedTimeSlots.includes(slot);
            return {
                ...prev,
                allowedTimeSlots: hasSlot
                    ? prev.allowedTimeSlots.filter((entry) => entry !== slot)
                    : [...prev.allowedTimeSlots, slot].sort(),
            };
        });
    };

    const handleListInputChange = (listKey, index, value) => {
        setConfig((prev) => ({
            ...prev,
            [listKey]: (prev[listKey] || []).map((entry, entryIndex) => (entryIndex === index ? value : entry)),
        }));
    };

    const handleAddListItem = (listKey) => {
        setConfig((prev) => ({
            ...prev,
            [listKey]: [...(prev[listKey] || []), ''],
        }));
    };

    const handleRemoveListItem = (listKey, index) => {
        setConfig((prev) => ({
            ...prev,
            [listKey]: (prev[listKey] || []).filter((_, entryIndex) => entryIndex !== index),
        }));
    };

    const handleWebsiteFieldChange = (section, field, value) => {
        setConfig((prev) => ({
            ...prev,
            websiteContent: {
                ...prev.websiteContent,
                [section]: {
                    ...prev.websiteContent[section],
                    [field]: value,
                },
            },
        }));
    };

    const handleWebsiteMultilineChange = (section, field, value) => {
        handleWebsiteFieldChange(section, field, splitMultilineValue(value));
    };

    const handleWebsiteServiceChange = (index, field, value) => {
        setConfig((prev) => ({
            ...prev,
            websiteContent: {
                ...prev.websiteContent,
                serviceHighlights: prev.websiteContent.serviceHighlights.map((service, serviceIndex) => (
                    serviceIndex === index
                        ? { ...service, [field]: value }
                        : service
                )),
            },
        }));
    };

    const handleWebsiteServiceItemsChange = (index, value) => {
        setConfig((prev) => ({
            ...prev,
            websiteContent: {
                ...prev.websiteContent,
                serviceHighlights: prev.websiteContent.serviceHighlights.map((service, serviceIndex) => (
                    serviceIndex === index
                        ? { ...service, items: splitMultilineValue(value) }
                        : service
                )),
            },
        }));
    };

    const handleWebsiteMediaFieldChange = (field, value) => {
        setConfig((prev) => ({
            ...prev,
            websiteContent: {
                ...prev.websiteContent,
                media: {
                    ...prev.websiteContent.media,
                    [field]: value,
                },
            },
        }));
    };

    const handleWebsiteMediaListItemChange = (field, index, value) => {
        setConfig((prev) => ({
            ...prev,
            websiteContent: {
                ...prev.websiteContent,
                media: {
                    ...prev.websiteContent.media,
                    [field]: (prev.websiteContent.media?.[field] || []).map((entry, entryIndex) => (
                        entryIndex === index ? value : entry
                    )),
                },
            },
        }));
    };

    const handleImageUpload = async ({ file, onChange, label = 'image' }) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrorMsg('Please select a valid image file.');
            return;
        }

        const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name || '');
        const sizeLimit = isSvg ? MAX_WEBSITE_SVG_UPLOAD_BYTES : MAX_WEBSITE_IMAGE_UPLOAD_BYTES;
        if (file.size > sizeLimit) {
            setErrorMsg(
                isSvg
                    ? `${label} is too large at ${formatUploadSize(file.size)}. Please optimize the SVG to ${formatUploadSize(sizeLimit)} or smaller before uploading.`
                    : `${label} is too large at ${formatUploadSize(file.size)}. Please use an image that is ${formatUploadSize(sizeLimit)} or smaller.`
            );
            return;
        }

        try {
            setWebsiteActionMessage('Uploading image...');
            const dataUrl = await readFileAsDataUrl(file);
            onChange(dataUrl);
            setErrorMsg('');
        } catch (error) {
            setErrorMsg(error.message || 'Failed to read the selected image.');
        } finally {
            setWebsiteActionMessage('');
        }
    };

    const handleWebsiteMediaUpload = async (field, file, label) => {
        await handleImageUpload({
            file,
            label,
            onChange: (value) => handleWebsiteMediaFieldChange(field, value),
        });
    };

    const handleAboutHighlightUpload = async (index, file) => {
        await handleImageUpload({
            file,
            label: `About highlight image ${index + 1}`,
            onChange: (value) => handleWebsiteMediaListItemChange('aboutHighlightImageUrls', index, value),
        });
    };

    const handleWebsiteMediaReset = (field) => {
        handleWebsiteMediaFieldChange(field, websiteMediaDefaults[field] || '');
    };

    const handleAboutHighlightReset = (index) => {
        handleWebsiteMediaListItemChange('aboutHighlightImageUrls', index, websiteMediaDefaults.aboutHighlightImageUrls[index] || websiteMediaDefaults.aboutHighlightImageUrls[0] || '');
    };

    const handleAddServiceHighlight = () => {
        setConfig((prev) => ({
            ...prev,
            websiteContent: {
                ...prev.websiteContent,
                serviceHighlights: [...prev.websiteContent.serviceHighlights, buildEmptyServiceHighlight()],
            },
        }));
    };

    const handleRemoveServiceHighlight = (index) => {
        setConfig((prev) => ({
            ...prev,
            websiteContent: {
                ...prev.websiteContent,
                serviceHighlights: prev.websiteContent.serviceHighlights.filter((_, serviceIndex) => serviceIndex !== index),
            },
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSuccessMsg('');
        setErrorMsg('');
        setWebsiteActionMessage('Saving website changes...');

        try {
            const normalizedProcedures = Array.from(
                new Set((config.clinicProcedures || []).map((procedure) => String(procedure || '').trim()).filter(Boolean))
            );
            const normalizedOnlineBookingProcedures = Array.from(
                new Set((config.onlineBookingProcedures || []).map((procedure) => String(procedure || '').trim()).filter(Boolean))
            );

            if (normalizedProcedures.length === 0) {
                setErrorMsg('Add at least one clinic procedure before saving.');
                setIsSaving(false);
                setWebsiteActionMessage('');
                return;
            }
            if (normalizedOnlineBookingProcedures.length === 0) {
                setErrorMsg('Add at least one online-booking procedure before saving.');
                setIsSaving(false);
                setWebsiteActionMessage('');
                return;
            }

            const res = await authFetch('/system-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...config,
                    onlineBookingProcedures: normalizedOnlineBookingProcedures,
                    clinicProcedures: normalizedProcedures,
                }),
            });

            if (res.ok) {
                const savedConfig = await res.json();
                invalidateSystemConfigCache();
                invalidatePublicClinicConfigCache();
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event(SYSTEM_CONFIG_UPDATED_EVENT));
                }
                setConfig((prev) => ({
                    ...prev,
                    ...savedConfig,
                    websiteContent: mergeWebsiteContent(savedConfig?.websiteContent || prev.websiteContent),
                }));
                setSuccessMsg('System configuration saved successfully.');
                setTimeout(() => setSuccessMsg(''), 4000);
            } else {
                const data = await res.json().catch(() => ({}));
                setErrorMsg(data.message || 'Failed to save configuration.');
            }
        } catch {
            setErrorMsg('Network error. Please try again.');
        } finally {
            setIsSaving(false);
            setWebsiteActionMessage('');
        }
    };

    const renderTextField = ({
        label,
        value,
        onChange,
        helpText = '',
        textarea = false,
        rows = 3,
        placeholder = '',
    }) => (
        <div className={styles.formGroup}>
            <label className={styles.label}>{label}</label>
            {helpText ? <p className={styles.helpText}>{helpText}</p> : null}
            {textarea ? (
                <textarea
                    className={styles.textarea}
                    rows={rows}
                    value={value || ''}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                />
            ) : (
                <input
                    type="text"
                    className={styles.input}
                    value={value || ''}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                />
            )}
        </div>
    );

    const renderWebsiteTextField = (section, field, options) => renderTextField({
        ...options,
        value: config.websiteContent?.[section]?.[field] || '',
        onChange: (value) => handleWebsiteFieldChange(section, field, value),
    });

    const renderWebsiteListField = (section, field, options) => renderTextField({
        ...options,
        textarea: true,
        value: joinMultilineValue(config.websiteContent?.[section]?.[field] || []),
        onChange: (value) => handleWebsiteMultilineChange(section, field, value),
    });

    const renderMediaField = ({ label, field, helpText = '', placeholder = 'Paste an image URL or upload a file.' }) => {
        const value = config.websiteContent?.media?.[field] || '';
        return (
            <div className={styles.mediaFieldCard}>
                <div className={styles.mediaPreviewFrame}>
                    {value ? (
                        <img src={value} alt={label} className={styles.mediaPreviewImage} />
                    ) : (
                        <div className={styles.mediaPreviewFallback}>No image selected</div>
                    )}
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>{label}</label>
                    {helpText ? <p className={styles.helpText}>{helpText}</p> : null}
                    <input
                        type="text"
                        className={styles.input}
                        value={value}
                        onChange={(event) => handleWebsiteMediaFieldChange(field, event.target.value)}
                        placeholder={placeholder}
                    />
                </div>
                <div className={styles.mediaActions}>
                    <label className={styles.mediaUploadBtn}>
                        Upload Image
                        <input
                            type="file"
                            accept="image/*"
                            className={styles.hiddenFileInput}
                            onChange={(event) => {
                                handleWebsiteMediaUpload(field, event.target.files?.[0], label);
                                event.target.value = '';
                            }}
                        />
                    </label>
                    <button type="button" className={styles.mediaResetBtn} onClick={() => handleWebsiteMediaReset(field)}>
                        Reset Default
                    </button>
                </div>
            </div>
        );
    };

    const renderAboutHighlightMediaField = (index) => {
        const value = config.websiteContent?.media?.aboutHighlightImageUrls?.[index] || '';
        return (
            <div className={styles.mediaFieldCard}>
                <div className={styles.mediaPreviewFrame}>
                    {value ? (
                        <img src={value} alt={`About highlight ${index + 1}`} className={styles.mediaPreviewImage} />
                    ) : (
                        <div className={styles.mediaPreviewFallback}>No image selected</div>
                    )}
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label}>About Highlight Image {index + 1}</label>
                    <input
                        type="text"
                        className={styles.input}
                        value={value}
                        onChange={(event) => handleWebsiteMediaListItemChange('aboutHighlightImageUrls', index, event.target.value)}
                        placeholder="Paste an image URL or upload a file."
                    />
                </div>
                <div className={styles.mediaActions}>
                    <label className={styles.mediaUploadBtn}>
                        Upload Image
                        <input
                            type="file"
                            accept="image/*"
                            className={styles.hiddenFileInput}
                            onChange={(event) => {
                                handleAboutHighlightUpload(index, event.target.files?.[0]);
                                event.target.value = '';
                            }}
                        />
                    </label>
                    <button type="button" className={styles.mediaResetBtn} onClick={() => handleAboutHighlightReset(index)}>
                        Reset Default
                    </button>
                </div>
            </div>
        );
    };

    const renderWebsiteBrandingSection = () => (
        <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Branding and Social Links</h3>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('branding', 'tagline', {
                    label: 'Website Tagline',
                    helpText: 'Short supporting line for the brand.',
                })}
                {renderWebsiteTextField('branding', 'owner', {
                    label: 'Owner / Lead Dentist',
                    helpText: 'Shown on the About page intro.',
                })}
                {renderWebsiteTextField('branding', 'facebookName', {
                    label: 'Facebook Page Name',
                })}
                {renderWebsiteTextField('branding', 'instagramHandle', {
                    label: 'Instagram Handle',
                    helpText: 'Enter without the @ symbol if possible.',
                })}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('branding', 'facebookUrl', {
                    label: 'Facebook Page URL',
                    helpText: 'Used by the website contact and appointment pages.',
                })}
            </div>
            <div className={styles.mediaGrid}>
                {renderMediaField({
                    label: 'Website Logo',
                    field: 'logoUrl',
                    helpText: 'Used in the public website header.',
                })}
            </div>
        </div>
    );

    const renderWebsiteHomeSection = () => (
        <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Home Page</h3>
            <div className={styles.mediaGrid}>
                {renderMediaField({ label: 'Home Hero Image', field: 'homeHeroImageUrl' })}
                {renderMediaField({ label: 'Comfort Section Image', field: 'homeIntroImageUrl' })}
                {renderMediaField({ label: 'Journey Section Image', field: 'homeJourneyImageUrl' })}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('home', 'heroEyebrow', { label: 'Hero Eyebrow' })}
                {renderWebsiteTextField('home', 'heroTitleLead', { label: 'Hero Title Line 1' })}
                {renderWebsiteTextField('home', 'heroTitleAccent', { label: 'Hero Title Accent' })}
                {renderWebsiteTextField('home', 'primaryCtaLabel', { label: 'Primary CTA Label' })}
                {renderWebsiteTextField('home', 'secondaryCtaLabel', { label: 'Secondary CTA Label' })}
                {renderWebsiteTextField('home', 'quickVisitEyebrow', { label: 'Quick Visit Eyebrow' })}
                {renderWebsiteTextField('home', 'quickVisitTitle', { label: 'Quick Visit Title' })}
                {renderWebsiteTextField('home', 'quickVisitCtaLabel', { label: 'Quick Visit CTA Label' })}
                {renderWebsiteTextField('home', 'servicesEyebrow', { label: 'Services Eyebrow' })}
                {renderWebsiteTextField('home', 'servicesTitle', { label: 'Services Section Title' })}
                {renderWebsiteTextField('home', 'servicesCtaLabel', { label: 'Services CTA Label' })}
                {renderWebsiteTextField('home', 'journeyEyebrow', { label: 'Journey Eyebrow' })}
                {renderWebsiteTextField('home', 'journeyTitle', { label: 'Journey Section Title' })}
                {renderWebsiteTextField('home', 'journeyCardTitle', { label: 'Journey Card Title' })}
                {renderWebsiteTextField('home', 'coreCareAreasLabel', { label: 'Core Care Areas Label' })}
                {renderWebsiteTextField('home', 'activeBranchesLabel', { label: 'Active Branches Label' })}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('home', 'heroDescription', { label: 'Hero Description', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'introDescription', { label: 'Comfort Description', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'quoteText', { label: 'Quote Text', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'quoteMeta', { label: 'Quote Meta', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'editorialMiniCopy', { label: 'Editorial Mini Copy', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'editorialTitle', { label: 'Editorial Title', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'editorialDescription', { label: 'Editorial Description', textarea: true, rows: 4 })}
                {renderWebsiteTextField('home', 'coreCareAreasDescription', { label: 'Core Care Areas Description', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'activeBranchesDescription', { label: 'Active Branches Description', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'editorialStatement', { label: 'Editorial Statement', textarea: true, rows: 3 })}
                {renderWebsiteTextField('home', 'journeyDescription', { label: 'Journey Description', textarea: true, rows: 4 })}
                {renderWebsiteTextField('home', 'journeyCaption', { label: 'Journey Image Caption', textarea: true, rows: 3 })}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('home', 'introKicker', {
                    label: 'Comfort Kicker',
                    textarea: true,
                    rows: 2,
                })}
                {renderWebsiteListField('home', 'journeyPills', {
                    label: 'Journey Pills',
                    helpText: 'One pill label per line.',
                    rows: 4,
                })}
                {renderWebsiteListField('home', 'journeyHighlights', {
                    label: 'Journey Highlights',
                    helpText: 'One highlight per line.',
                    rows: 4,
                })}
            </div>
        </div>
    );

    const renderWebsiteAboutSection = () => (
        <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>About Page and Locations</h3>
            <div className={styles.mediaGrid}>
                {renderMediaField({ label: 'About Hero Image', field: 'aboutHeroImageUrl' })}
                {renderMediaField({ label: 'Location Card Image', field: 'locationCardImageUrl' })}
                {renderMediaField({ label: 'Locations Hero Image', field: 'locationsHeroImageUrl' })}
                {renderAboutHighlightMediaField(0)}
                {renderAboutHighlightMediaField(1)}
                {renderAboutHighlightMediaField(2)}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('about', 'eyebrow', { label: 'About Eyebrow' })}
                {renderWebsiteTextField('about', 'highlightCardTitle', { label: 'Highlight Card Title' })}
                {renderWebsiteTextField('about', 'title', { label: 'About Title', textarea: true, rows: 3 })}
                {renderWebsiteTextField('about', 'description', { label: 'About Description', textarea: true, rows: 4 })}
                {renderWebsiteTextField('locationsPage', 'eyebrow', { label: 'Locations Eyebrow' })}
                {renderWebsiteTextField('locationsPage', 'bookCtaLabel', { label: 'Book CTA Label' })}
                {renderWebsiteTextField('locationsPage', 'callCtaLabel', { label: 'Call CTA Label' })}
                {renderWebsiteTextField('locationsPage', 'mapCtaLabel', { label: 'Map CTA Label' })}
                {renderWebsiteTextField('locationsPage', 'title', { label: 'Locations Title', textarea: true, rows: 3 })}
                {renderWebsiteTextField('locationsPage', 'description', { label: 'Locations Description', textarea: true, rows: 4 })}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteListField('about', 'highlights', {
                    label: 'Highlights',
                    helpText: 'One highlight per line.',
                    rows: 6,
                })}
            </div>
        </div>
    );

    const renderWebsiteServicesSection = () => (
        <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Services Page</h3>
            <div className={styles.mediaGrid}>
                {renderMediaField({ label: 'Services Hero Image', field: 'servicesHeroImageUrl' })}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('servicesPage', 'eyebrow', { label: 'Eyebrow' })}
                {renderWebsiteTextField('servicesPage', 'title', { label: 'Title', textarea: true, rows: 3 })}
                {renderWebsiteTextField('servicesPage', 'description', { label: 'Description', textarea: true, rows: 4 })}
            </div>

            <div className={styles.serviceHighlightList}>
                {config.websiteContent.serviceHighlights.map((service, index) => (
                    <div key={`service-highlight-${index}`} className={styles.serviceHighlightCard}>
                        <div className={styles.serviceHighlightHeader}>
                            <h4 className={styles.cardEditorTitle}>Service Card {index + 1}</h4>
                            <button
                                type="button"
                                className={styles.removeProcedureBtn}
                                onClick={() => handleRemoveServiceHighlight(index)}
                                disabled={config.websiteContent.serviceHighlights.length <= 1}
                            >
                                Remove Card
                            </button>
                        </div>
                        <div className={styles.fieldsGrid}>
                            {renderTextField({
                                label: 'Category',
                                value: service.category,
                                onChange: (value) => handleWebsiteServiceChange(index, 'category', value),
                            })}
                            {renderTextField({
                                label: 'Description',
                                value: service.description,
                                onChange: (value) => handleWebsiteServiceChange(index, 'description', value),
                                textarea: true,
                                rows: 3,
                            })}
                            {renderTextField({
                                label: 'Service Image URL',
                                helpText: 'You can paste a URL or use the upload button below.',
                                value: service.imageUrl,
                                onChange: (value) => handleWebsiteServiceChange(index, 'imageUrl', value),
                            })}
                            {renderTextField({
                                label: 'Items',
                                helpText: 'One service item per line.',
                                value: joinMultilineValue(service.items),
                                onChange: (value) => handleWebsiteServiceItemsChange(index, value),
                                textarea: true,
                                rows: 6,
                            })}
                        </div>
                        <div className={styles.mediaFieldCard}>
                            <div className={styles.mediaPreviewFrame}>
                                {service.imageUrl ? (
                                    <img src={service.imageUrl} alt={service.category || `Service ${index + 1}`} className={styles.mediaPreviewImage} />
                                ) : (
                                    <div className={styles.mediaPreviewFallback}>No image selected</div>
                                )}
                            </div>
                            <div className={styles.mediaActions}>
                                <label className={styles.mediaUploadBtn}>
                                    Upload Image
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className={styles.hiddenFileInput}
                                        onChange={(event) => {
                                            handleImageUpload({
                                                                    file: event.target.files?.[0],
                                                                    label: `${service.category || `Service ${index + 1}`} image`,
                                                                    onChange: (value) => handleWebsiteServiceChange(index, 'imageUrl', value),
                                                                });
                                                                event.target.value = '';
                                        }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className={styles.mediaResetBtn}
                                    onClick={() => handleWebsiteServiceChange(index, 'imageUrl', getDefaultServiceImage(service.category))}
                                >
                                    Reset Default
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button type="button" className={styles.addProcedureBtn} onClick={handleAddServiceHighlight}>
                Add Service Card
            </button>
        </div>
    );

    const renderWebsiteContactSection = () => (
        <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Contact Page</h3>
            <div className={styles.mediaGrid}>
                {renderMediaField({ label: 'Contact Hero Image', field: 'contactHeroImageUrl' })}
                {renderMediaField({ label: 'Phone Card Image', field: 'contactPhoneImageUrl' })}
                {renderMediaField({ label: 'Facebook Card Image', field: 'contactFacebookImageUrl' })}
                {renderMediaField({ label: 'Instagram Card Image', field: 'contactInstagramImageUrl' })}
                {renderMediaField({ label: 'Map / Clinic Front Image', field: 'contactMapImageUrl' })}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('contactPage', 'eyebrow', { label: 'Eyebrow' })}
                {renderWebsiteTextField('contactPage', 'primaryCtaLabel', { label: 'Primary CTA Label' })}
                {renderWebsiteTextField('contactPage', 'secondaryCtaLabel', { label: 'Secondary CTA Label' })}
                {renderWebsiteTextField('contactPage', 'phoneCardTitle', { label: 'Phone Card Title' })}
                {renderWebsiteTextField('contactPage', 'phoneCardCtaLabel', { label: 'Phone Card CTA Label' })}
                {renderWebsiteTextField('contactPage', 'facebookCardTitle', { label: 'Facebook Card Title' })}
                {renderWebsiteTextField('contactPage', 'facebookCardCtaLabel', { label: 'Facebook Card CTA Label' })}
                {renderWebsiteTextField('contactPage', 'instagramCardTitle', { label: 'Instagram Card Title' })}
                {renderWebsiteTextField('contactPage', 'instagramCardCtaLabel', { label: 'Instagram Card CTA Label' })}
                {renderWebsiteTextField('contactPage', 'locationPrimaryCtaLabel', { label: 'Location Primary CTA Label' })}
                {renderWebsiteTextField('contactPage', 'locationSecondaryCtaLabel', { label: 'Location Secondary CTA Label' })}
                {renderWebsiteTextField('contactPage', 'title', { label: 'Title', textarea: true, rows: 3 })}
                {renderWebsiteTextField('contactPage', 'description', { label: 'Description', textarea: true, rows: 4 })}
            </div>
        </div>
    );

    const renderWebsiteAppointmentSection = () => (
        <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Appointment Page</h3>
            <div className={styles.mediaGrid}>
                {renderMediaField({ label: 'Appointment Hero Image', field: 'appointmentHeroImageUrl' })}
                {renderMediaField({ label: 'Booking Guide Image', field: 'appointmentGuideImageUrl' })}
                {renderMediaField({ label: 'Appointment Branch Image', field: 'appointmentBranchImageUrl' })}
            </div>
            <div className={styles.fieldsGrid}>
                {renderWebsiteTextField('appointmentPage', 'eyebrow', { label: 'Hero Eyebrow' })}
                {renderWebsiteTextField('appointmentPage', 'facebookCtaLabel', { label: 'Facebook CTA Label' })}
                {renderWebsiteTextField('appointmentPage', 'callCtaLabel', { label: 'Call CTA Label' })}
                {renderWebsiteTextField('appointmentPage', 'formEyebrow', { label: 'Form Eyebrow' })}
                {renderWebsiteTextField('appointmentPage', 'formTitle', { label: 'Form Title' })}
                {renderWebsiteTextField('appointmentPage', 'submitButtonLabel', { label: 'Submit Button Label' })}
                {renderWebsiteTextField('appointmentPage', 'submittingButtonLabel', { label: 'Submitting Button Label' })}
                {renderWebsiteTextField('appointmentPage', 'guideEyebrow', { label: 'Guide Eyebrow' })}
                {renderWebsiteTextField('appointmentPage', 'guideTitle', { label: 'Guide Title' })}
                {renderWebsiteTextField('appointmentPage', 'branchEyebrow', { label: 'Branch Eyebrow' })}
                {renderWebsiteTextField('appointmentPage', 'branchTitle', { label: 'Branch Title', textarea: true, rows: 2 })}
                {renderWebsiteTextField('appointmentPage', 'title', { label: 'Hero Title', textarea: true, rows: 3 })}
                {renderWebsiteTextField('appointmentPage', 'description', { label: 'Hero Description', textarea: true, rows: 4 })}
                {renderWebsiteTextField('appointmentPage', 'formDescription', { label: 'Form Description', textarea: true, rows: 3 })}
                {renderWebsiteTextField('appointmentPage', 'procedureHelperText', { label: 'Procedure Helper Text', textarea: true, rows: 4 })}
                {renderWebsiteTextField('appointmentPage', 'notesHelperText', { label: 'Notes Helper Text', textarea: true, rows: 3 })}
                {renderWebsiteListField('appointmentPage', 'steps', {
                    label: 'Guest Appointment Steps',
                    helpText: 'One step per line.',
                    rows: 6,
                })}
            </div>
        </div>
    );

    if (isLoading) {
        return <div className={styles.loadingContainer}><p>Loading system configuration...</p></div>;
    }

    const SECTIONS = [
        { key: 'clinic', label: 'Clinic Info' },
        { key: 'appointments', label: 'Appointment Settings' },
        { key: 'emails', label: 'Email Templates' },
        { key: 'features', label: 'Feature Toggles' },
        { key: 'website', label: 'Website Content' },
    ];
    const WEBSITE_EDITOR_TABS = [
        { key: 'branding', label: 'Branding' },
        { key: 'home', label: 'Home' },
        { key: 'about', label: 'About + Locations' },
        { key: 'services', label: 'Services' },
        { key: 'contact', label: 'Contact' },
        { key: 'appointment', label: 'Appointment' },
    ];
    const showWebsiteActionOverlay = Boolean(websiteActionMessage);

    return (
        <div className={styles.container}>
            {showWebsiteActionOverlay && (
                <div className={styles.actionOverlay} role="status" aria-live="polite" aria-busy="true">
                    <div className={styles.actionOverlayCard}>
                        <div className={styles.actionSpinner} />
                        <h2 className={styles.actionOverlayTitle}>{websiteActionMessage}</h2>
                        <p className={styles.actionOverlayText}>Please wait while Dentime updates the website editor.</p>
                    </div>
                </div>
            )}
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>System Configuration</h1>
                <p className={styles.pageSubtitle}>Manage global settings for NgitiFy Dental Management System.</p>
            </div>

            {successMsg && <div className={styles.successAlert}>{successMsg}</div>}
            {errorMsg && <div className={styles.errorAlert}>{errorMsg}</div>}

            <div className={styles.layout}>
                <nav className={styles.sectionNav}>
                    {SECTIONS.map((section) => (
                        <button
                            key={section.key}
                            className={`${styles.navBtn} ${activeSection === section.key ? styles.navBtnActive : ''}`}
                            onClick={() => setActiveSection(section.key)}
                        >
                            {section.label}
                        </button>
                    ))}
                </nav>

                <div className={styles.content}>
                    {activeSection === 'clinic' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Clinic Information</h2>
                            <p className={styles.sectionDesc}>Basic information about your dental clinic.</p>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Clinic Name</label>
                                <input type="text" name="clinicName" value={config.clinicName} onChange={handleChange} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Contact Number</label>
                                <input type="text" name="clinicContact" value={config.clinicContact} onChange={handleChange} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Email Address</label>
                                <input type="email" name="clinicEmail" value={config.clinicEmail} onChange={handleChange} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Address</label>
                                <textarea name="clinicAddress" value={config.clinicAddress} onChange={handleChange} className={styles.textarea} rows={3} />
                            </div>
                        </div>
                    )}

                    {activeSection === 'appointments' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Appointment Settings</h2>
                            <p className={styles.sectionDesc}>Control scheduling limits and available time slots.</p>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Max Appointments Per Day</label>
                                <input
                                    type="number"
                                    name="maxAppointmentsPerDay"
                                    value={config.maxAppointmentsPerDay}
                                    onChange={handleChange}
                                    className={styles.inputSmall}
                                    min={1}
                                    max={100}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Allowed Time Slots</label>
                                <p className={styles.helpText}>Check the time slots patients can book appointments.</p>
                                <div className={styles.slotGrid}>
                                    {DEFAULT_SLOTS.map((slot) => (
                                        <label key={slot} className={`${styles.slotChip} ${config.allowedTimeSlots.includes(slot) ? styles.slotChipActive : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={config.allowedTimeSlots.includes(slot)}
                                                onChange={() => handleSlotToggle(slot)}
                                                style={{ marginRight: '6px' }}
                                            />
                                            {slot}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Online Booking Procedures</label>
                                <p className={styles.helpText}>Only these procedures will appear in the public website, patient web portal, and patient mobile booking flow.</p>
                                <div className={styles.procedureList}>
                                    {(config.onlineBookingProcedures || []).map((procedure, index) => (
                                        <div key={`online-procedure-${index}`} className={styles.procedureRow}>
                                            <input
                                                type="text"
                                                value={procedure}
                                                onChange={(e) => handleListInputChange('onlineBookingProcedures', index, e.target.value)}
                                                className={styles.input}
                                                placeholder="Enter bookable procedure name"
                                            />
                                            <button
                                                type="button"
                                                className={styles.removeProcedureBtn}
                                                onClick={() => handleRemoveListItem('onlineBookingProcedures', index)}
                                                disabled={(config.onlineBookingProcedures || []).length <= 1}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" className={styles.addProcedureBtn} onClick={() => handleAddListItem('onlineBookingProcedures')}>
                                    Add Online Booking Procedure
                                </button>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Clinic Procedures</label>
                                <p className={styles.helpText}>These populate the internal service menus for staff booking, walk-in queueing, and treatment-performed records.</p>
                                <div className={styles.procedureList}>
                                    {(config.clinicProcedures || []).map((procedure, index) => (
                                        <div key={`procedure-${index}`} className={styles.procedureRow}>
                                            <input
                                                type="text"
                                                value={procedure}
                                                onChange={(e) => handleListInputChange('clinicProcedures', index, e.target.value)}
                                                className={styles.input}
                                                placeholder="Enter procedure name"
                                            />
                                            <button
                                                type="button"
                                                className={styles.removeProcedureBtn}
                                                onClick={() => handleRemoveListItem('clinicProcedures', index)}
                                                disabled={(config.clinicProcedures || []).length <= 1}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" className={styles.addProcedureBtn} onClick={() => handleAddListItem('clinicProcedures')}>
                                    Add Procedure
                                </button>
                            </div>
                        </div>
                    )}

                    {activeSection === 'emails' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Email Templates</h2>
                            <p className={styles.sectionDesc}>Customize the emails sent to users and patients.</p>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Account Activation Email</label>
                                <p className={styles.helpText}>Sent when a new staff account is created.</p>
                                <textarea
                                    name="activation"
                                    value={config.emailTemplates?.activation || ''}
                                    onChange={handleTemplateChange}
                                    className={styles.textarea}
                                    rows={5}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Appointment Reminder Email</label>
                                <p className={styles.helpText}>Sent to patients before their scheduled appointment.</p>
                                <textarea
                                    name="appointmentReminder"
                                    value={config.emailTemplates?.appointmentReminder || ''}
                                    onChange={handleTemplateChange}
                                    className={styles.textarea}
                                    rows={5}
                                />
                            </div>
                        </div>
                    )}

                    {activeSection === 'features' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Feature Toggles</h2>
                            <p className={styles.sectionDesc}>Enable or disable system modules.</p>

                            {[
                                { key: 'queueManagement', label: 'Queue Management', desc: 'Walk-in patient queue module.' },
                                { key: 'radiographUploads', label: 'Radiograph Uploads', desc: 'Allow radiograph image uploads in patient EMR.' },
                                { key: 'chatSupport', label: 'Chat Support', desc: 'Enable the chat/ticket support system.' },
                                { key: 'sessionTimeout', label: 'Session Timeout', desc: 'Auto logout after inactivity.' },
                            ].map((feature) => (
                                <div key={feature.key} className={styles.toggleRow}>
                                    <div className={styles.toggleInfo}>
                                        <span className={styles.toggleLabel}>{feature.label}</span>
                                        <span className={styles.toggleDesc}>{feature.desc}</span>
                                    </div>
                                    <button
                                        className={`${styles.toggleSwitch} ${config.featureToggles?.[feature.key] ? styles.toggleOn : styles.toggleOff}`}
                                        onClick={() => handleToggleChange(feature.key)}
                                    >
                                        {config.featureToggles?.[feature.key] ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            ))}

                            {config.featureToggles?.sessionTimeout && (
                                <div className={styles.formGroup} style={{ marginTop: '20px' }}>
                                    <label className={styles.label}>Session Timeout Duration (minutes)</label>
                                    <input
                                        type="number"
                                        name="sessionTimeoutMinutes"
                                        value={config.sessionTimeoutMinutes}
                                        onChange={handleChange}
                                        className={styles.inputSmall}
                                        min={5}
                                        max={120}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {activeSection === 'website' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Website Content</h2>
                            <p className={styles.sectionDesc}>
                                Manage the copy shown on the public website. Clinic name, phone number, email, and address still come from the Clinic Info section above.
                            </p>
                            <div className={styles.websiteTabBar}>
                                {WEBSITE_EDITOR_TABS.map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        className={`${styles.websiteTabBtn} ${activeWebsiteTab === tab.key ? styles.websiteTabBtnActive : ''}`}
                                        onClick={() => setActiveWebsiteTab(tab.key)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {activeWebsiteTab === 'branding' && renderWebsiteBrandingSection()}
                            {activeWebsiteTab === 'home' && renderWebsiteHomeSection()}
                            {activeWebsiteTab === 'about' && renderWebsiteAboutSection()}
                            {activeWebsiteTab === 'services' && renderWebsiteServicesSection()}
                            {activeWebsiteTab === 'contact' && renderWebsiteContactSection()}
                            {activeWebsiteTab === 'appointment' && renderWebsiteAppointmentSection()}
                        </div>
                    )}

                    <div className={styles.saveRow}>
                        <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemConfig;
