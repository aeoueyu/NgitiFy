import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import WebsiteShell from '../components/website/WebsiteShell';
import styles from '../styles/website/WebsitePages.module.css';
import { publicFetch } from '../utils/api';
import { regions, provinces, cities, barangays } from '../utils/addressData';

const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };

const formatDate = (value) => {
    if (!value) return 'To be announced';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'To be announced'
        : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function PreRegisterPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [appointmentInfo, setAppointmentInfo] = useState(null);
    const [currentAddress, setCurrentAddress] = useState({ ...initialAddressState });
    const [permanentAddress, setPermanentAddress] = useState({ ...initialAddressState });
    const [isSameAddress, setIsSameAddress] = useState(false);
    const [errors, setErrors] = useState({});
    const [state, setState] = useState('loading');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) {
                setState('invalid');
                setMessage('This link has expired or is invalid. Please contact the clinic for assistance.');
                return;
            }

            try {
                const response = await publicFetch(`/pre-register/${token}`);
                const data = await response.json().catch(() => ({}));

                if (response.status === 409) {
                    setState('used');
                    setMessage('You have already completed your registration. No further action is needed.');
                    return;
                }
                if (response.status === 410 || response.status === 404) {
                    setState('invalid');
                    setMessage('This link has expired or is invalid. Please contact the clinic for assistance.');
                    return;
                }
                if (!response.ok) {
                    throw new Error(data.message || 'Unable to load your registration link.');
                }

                setAppointmentInfo(data);
                setCurrentAddress({ ...initialAddressState, ...(data.currentAddress || {}) });
                setPermanentAddress({ ...initialAddressState, ...(data.permanentAddress || {}) });
                setState('ready');
            } catch (error) {
                setState('invalid');
                setMessage(error.message || 'This link has expired or is invalid. Please contact the clinic for assistance.');
            }
        };

        fetchData();
    }, [token]);

    const validateAddress = (address, prefix) => {
        const nextErrors = {};
        ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach((field) => {
            if (!address[field]) nextErrors[`${prefix}_${field}`] = 'Required';
        });
        return nextErrors;
    };

    const validateForm = () => {
        const nextErrors = {
            ...validateAddress(currentAddress, 'current'),
            ...validateAddress(permanentAddress, 'permanent'),
        };
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleAddressChange = (type, field, value) => {
        const setter = type === 'current' ? setCurrentAddress : setPermanentAddress;
        setter((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'region') { next.province = ''; next.city = ''; next.barangay = ''; }
            if (field === 'province') { next.city = ''; next.barangay = ''; }
            if (field === 'city') { next.barangay = ''; }
            return next;
        });

        if (type === 'current' && isSameAddress) {
            setPermanentAddress((prev) => {
                const next = { ...prev, [field]: value };
                if (field === 'region') { next.province = ''; next.city = ''; next.barangay = ''; }
                if (field === 'province') { next.city = ''; next.barangay = ''; }
                if (field === 'city') { next.barangay = ''; }
                return next;
            });
        }

        setErrors((prev) => {
            const next = { ...prev };
            delete next[`${type}_${field}`];
            if (type === 'current' && isSameAddress) delete next[`permanent_${field}`];
            return next;
        });
    };

    const handleSameAddressToggle = (event) => {
        const checked = event.target.checked;
        setIsSameAddress(checked);
        if (checked) {
            setPermanentAddress({ ...currentAddress });
            setErrors((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((key) => {
                    if (key.startsWith('permanent_')) delete next[key];
                });
                return next;
            });
        }
    };

    const renderAddressSection = (type, title, address) => {
        const prefix = type === 'current' ? 'current' : 'permanent';
        const availableProvinces = address.region ? provinces[address.region] || [] : [];
        const availableCities = address.province ? cities[address.province] || [] : [];
        const availableBarangays = address.city ? barangays[address.city] || [] : [];
        const errorFor = (field) => errors[`${prefix}_${field}`];
        const classFor = (field) => errorFor(field) ? styles.errorBorder : '';

        return (
            <div className={styles.formCard} style={{ background: '#fff', border: '1px solid rgba(1, 83, 139, 0.08)' }}>
                <h3 className={styles.sectionTitle} style={{ fontSize: '1.3rem' }}>{title}</h3>
                <div className={styles.formGrid}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Region</label>
                        <select className={`${styles.fieldSelect} ${classFor('region')}`} value={address.region} onChange={(e) => handleAddressChange(type, 'region', e.target.value)}>
                            <option value="">Select region</option>
                            {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
                        </select>
                        {errorFor('region') && <span className={styles.errorText}>{errorFor('region')}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Province</label>
                        <select className={`${styles.fieldSelect} ${classFor('province')}`} value={address.province} onChange={(e) => handleAddressChange(type, 'province', e.target.value)} disabled={!address.region}>
                            <option value="">Select province</option>
                            {availableProvinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
                        </select>
                        {errorFor('province') && <span className={styles.errorText}>{errorFor('province')}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>City / Municipality</label>
                        <select className={`${styles.fieldSelect} ${classFor('city')}`} value={address.city} onChange={(e) => handleAddressChange(type, 'city', e.target.value)} disabled={!address.province}>
                            <option value="">Select city</option>
                            {availableCities.map((city) => <option key={city.code} value={city.code}>{city.name}</option>)}
                        </select>
                        {errorFor('city') && <span className={styles.errorText}>{errorFor('city')}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Barangay</label>
                        <select className={`${styles.fieldSelect} ${classFor('barangay')}`} value={address.barangay} onChange={(e) => handleAddressChange(type, 'barangay', e.target.value)} disabled={!address.city}>
                            <option value="">Select barangay</option>
                            {availableBarangays.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}
                        </select>
                        {errorFor('barangay') && <span className={styles.errorText}>{errorFor('barangay')}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Street</label>
                        <input className={`${styles.fieldInput} ${classFor('street')}`} value={address.street} onChange={(e) => handleAddressChange(type, 'street', e.target.value)} />
                        {errorFor('street') && <span className={styles.errorText}>{errorFor('street')}</span>}
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>House Number</label>
                        <input className={`${styles.fieldInput} ${classFor('houseNumber')}`} value={address.houseNumber} onChange={(e) => handleAddressChange(type, 'houseNumber', e.target.value)} />
                        {errorFor('houseNumber') && <span className={styles.errorText}>{errorFor('houseNumber')}</span>}
                    </div>
                </div>
            </div>
        );
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const finalPermanentAddress = isSameAddress ? currentAddress : permanentAddress;
        if (isSameAddress) setPermanentAddress({ ...currentAddress });
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            const response = await publicFetch(`/pre-register/${token}`, {
                method: 'POST',
                body: JSON.stringify({
                    currentAddress,
                    permanentAddress: finalPermanentAddress,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Unable to save your details.');
            setState('success');
            setMessage('Thank you! Your details have been saved. The clinic will be in touch with any further instructions.');
        } catch (error) {
            setMessage(error.message || 'Unable to save your details.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pageTitle = useMemo(() => {
        if (state === 'success') return 'Registration completed';
        if (state === 'used') return 'Registration already completed';
        if (state === 'invalid') return 'Registration link unavailable';
        return 'Complete your registration';
    }, [state]);

    return (
        <WebsiteShell>
            <section className={styles.section}>
                <div className={styles.splitSection} style={{ gridTemplateColumns: '1fr' }}>
                    <article className={styles.infoCard}>
                        <p className={styles.eyebrow}>Pre-Registration</p>
                        <h1 className={styles.sectionTitle}>{pageTitle}</h1>
                        {state === 'ready' && appointmentInfo ? (
                            <p className={styles.bodyText}>
                                Hello {appointmentInfo.guestName}, please complete your address details for your {appointmentInfo.procedure} appointment on {formatDate(appointmentInfo.appointmentDate)} at {appointmentInfo.branch}.
                            </p>
                        ) : (
                            <p className={styles.bodyText}>{message || 'Loading your registration link...'}</p>
                        )}
                    </article>

                    {state === 'ready' && (
                        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
                            {message && <div className={styles.errorBanner}>{message}</div>}
                            {renderAddressSection('current', 'Current Address', currentAddress)}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#536c7f', fontSize: '14px' }}>
                                <input id="sameAddress" type="checkbox" checked={isSameAddress} onChange={handleSameAddressToggle} />
                                <label htmlFor="sameAddress">Permanent address is the same as current address</label>
                            </div>

                            {renderAddressSection('permanent', 'Permanent Address', isSameAddress ? currentAddress : permanentAddress)}

                            <div className={styles.buttonRow}>
                                <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving...' : 'Save Registration Details'}
                                </button>
                            </div>
                        </form>
                    )}

                    {state === 'success' && (
                        <div className={styles.successBanner}>{message}</div>
                    )}

                    {(state === 'invalid' || state === 'used') && (
                        <div className={state === 'used' ? styles.successBanner : styles.errorBanner}>{message}</div>
                    )}
                </div>
            </section>
        </WebsiteShell>
    );
}
