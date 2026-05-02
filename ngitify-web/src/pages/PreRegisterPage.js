import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import WebsiteShell from '../components/website/WebsiteShell';
import styles from '../styles/website/WebsitePages.module.css';
import { publicFetch } from '../utils/api';
import { regions, provinces, cities, barangays } from '../utils/addressData';

const initialAddressState = { country: 'Philippines', region: '', province: '', city: '', barangay: '', houseNumber: '', street: '' };
const initialProfileState = {
    homePhone: '',
    workPhone: '',
    occupation: '',
    civilStatus: '',
    bloodType: '',
    nationality: 'Filipino',
    religion: '',
    referredBy: '',
    reasonForConsultation: '',
};
const initialEmergencyContact = { name: '', relationship: '', contactNumber: '' };
const initialGuardian = { name: '', relationship: '', contactNumber: '', occupation: '' };
const initialPhysician = { name: '', specialty: '', officeAddress: '', officeNumber: '' };
const initialDentalHistory = {
    lastExamDate: '',
    chiefComplaint: '',
    notes: '',
    hadTreatmentReaction: '',
    reactionDetails: '',
    hasConfidentialInfo: false,
};
const initialMedicalHistory = {
    inGoodHealth: '',
    underMedicalTreatment: '',
    medicalTreatmentDetails: '',
    hadSeriousIllnessOrSurgery: '',
    seriousIllnessOrSurgeryDetails: '',
    hadHospitalization: '',
    hospitalizationDetails: '',
    isTakingMedication: '',
    medications: '',
    usesTobacco: '',
    usesAlcoholOrDrugs: '',
    hasAllergies: '',
    allergies: [],
    allergyOther: '',
    conditions: [],
    conditionOther: '',
    notes: '',
    bleedingTime: '',
    bloodPressure: '',
    isPregnant: '',
    isNursing: '',
    takingBirthControl: '',
};

const allergyOptions = [
    'Local Anesthetic (ex. Lidocaine)',
    'Penicillin',
    'Aspirin',
    'Antibiotics',
    'Adrenaline',
    'Steroids',
    'Hormones',
    'Antacids',
    'Sulfa Drugs',
    'Alcohol',
    'Latex',
];

const medicalConditionOptions = [
    'High Blood Pressure',
    'Low Blood Pressure',
    'Epilepsy/Convulsions',
    'AIDS or HIV Infection',
    'Hay Fever/Allergies',
    'Respiratory Problems',
    'Fainting Seizure',
    'Rapid Weight Loss',
    'Swollen Ankles',
    'Kidney Disease',
    'Heart Surgery',
    'Heart Attack',
    'Stroke',
    'Heart Disease',
    'Heart Murmur',
    'Hepatitis/Liver Disease',
    'Rheumatic Fever',
    'Asthma',
    'Emphysema',
    'Bleeding Problems',
    'Hepatitis/Jaundice',
    'Tuberculosis',
    'Arthritis/Rheumatism',
    'Diabetes',
    'Chest Pain',
    'Cancer/Tumors',
    'Anemia',
    'Angina',
    'Sexually Transmitted Disease',
    'Stomach Troubles/Ulcers',
    'Blood Diseases',
    'Head Injuries',
    'Radiation Therapy',
    'Joint Replacement/Implant',
    'Thyroid Problem',
    'Other',
];

const yesNoOptions = [
    { value: '', label: 'Select' },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
];

const formatDate = (value) => {
    if (!value) return 'To be announced';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'To be announced'
        : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const stripPhonePrefix = (phone = '') => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length >= 12) return digits.slice(2, 12);
    if (digits.startsWith('0') && digits.length >= 11) return digits.slice(1, 11);
    if (digits.startsWith('9')) return digits.slice(0, 10);
    return digits.slice(-10);
};

const toPhonePayload = (phone = '') => {
    const digits = stripPhonePrefix(phone);
    return digits ? `+63${digits}` : '';
};

const getAge = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
};

const normalizeMedicalHistoryState = (history = {}) => ({
    ...initialMedicalHistory,
    ...history,
    medications: Array.isArray(history.medications) ? history.medications.join(', ') : (history.medications || ''),
    allergies: Array.isArray(history.allergies) ? history.allergies.filter((entry) => allergyOptions.includes(entry)) : [],
    allergyOther: Array.isArray(history.allergies) ? history.allergies.filter((entry) => !allergyOptions.includes(entry)).join(', ') : '',
    conditions: Array.isArray(history.conditions) ? history.conditions.filter((entry) => medicalConditionOptions.includes(entry)) : [],
    conditionOther: Array.isArray(history.conditions) ? history.conditions.filter((entry) => !medicalConditionOptions.includes(entry)).join(', ') : '',
    inGoodHealth: history.inGoodHealth === undefined ? '' : (history.inGoodHealth ? 'yes' : 'no'),
    underMedicalTreatment: history.underMedicalTreatment === undefined ? '' : (history.underMedicalTreatment ? 'yes' : 'no'),
    hadSeriousIllnessOrSurgery: history.hadSeriousIllnessOrSurgery === undefined ? '' : (history.hadSeriousIllnessOrSurgery ? 'yes' : 'no'),
    hadHospitalization: history.hadHospitalization === undefined ? '' : (history.hadHospitalization ? 'yes' : 'no'),
    isTakingMedication: history.isTakingMedication === undefined ? '' : (history.isTakingMedication ? 'yes' : 'no'),
    usesTobacco: history.usesTobacco === undefined ? '' : (history.usesTobacco ? 'yes' : 'no'),
    usesAlcoholOrDrugs: history.usesAlcoholOrDrugs === undefined ? '' : (history.usesAlcoholOrDrugs ? 'yes' : 'no'),
    hasAllergies: history.hasAllergies === undefined ? '' : (history.hasAllergies ? 'yes' : 'no'),
    isPregnant: history.isPregnant === undefined ? '' : (history.isPregnant ? 'yes' : 'no'),
    isNursing: history.isNursing === undefined ? '' : (history.isNursing ? 'yes' : 'no'),
    takingBirthControl: history.takingBirthControl === undefined ? '' : (history.takingBirthControl ? 'yes' : 'no'),
});

const normalizeDentalHistoryState = (history = {}) => ({
    ...initialDentalHistory,
    ...history,
    lastExamDate: history.lastExamDate ? new Date(history.lastExamDate).toISOString().split('T')[0] : '',
    hadTreatmentReaction: history.hadTreatmentReaction === undefined ? '' : (history.hadTreatmentReaction ? 'yes' : 'no'),
    hasConfidentialInfo: Boolean(history.hasConfidentialInfo),
});

export default function PreRegisterPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const [appointmentInfo, setAppointmentInfo] = useState(null);
    const [profile, setProfile] = useState({ ...initialProfileState });
    const [currentAddress, setCurrentAddress] = useState({ ...initialAddressState });
    const [permanentAddress, setPermanentAddress] = useState({ ...initialAddressState });
    const [emergencyContact, setEmergencyContact] = useState({ ...initialEmergencyContact });
    const [guardian, setGuardian] = useState({ ...initialGuardian });
    const [physician, setPhysician] = useState({ ...initialPhysician });
    const [dentalHistory, setDentalHistory] = useState({ ...initialDentalHistory });
    const [medicalHistory, setMedicalHistory] = useState({ ...initialMedicalHistory });
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
                setProfile({ ...initialProfileState, ...(data.guestProfile || {}) });
                const nextCurrentAddress = { ...initialAddressState, ...(data.currentAddress || {}) };
                const nextPermanentAddress = { ...initialAddressState, ...(data.permanentAddress || {}) };
                setCurrentAddress(nextCurrentAddress);
                setPermanentAddress(nextPermanentAddress);
                setEmergencyContact({
                    ...initialEmergencyContact,
                    ...(data.guestEmergencyContact || {}),
                    contactNumber: stripPhonePrefix(data.guestEmergencyContact?.contactNumber || ''),
                });
                setGuardian({
                    ...initialGuardian,
                    ...(data.guestGuardian || {}),
                    contactNumber: stripPhonePrefix(data.guestGuardian?.contactNumber || ''),
                });
                setPhysician({
                    ...initialPhysician,
                    ...(data.guestPhysician || {}),
                    officeNumber: stripPhonePrefix(data.guestPhysician?.officeNumber || ''),
                });
                setDentalHistory(normalizeDentalHistoryState(data.guestDentalHistory || {}));
                setMedicalHistory(normalizeMedicalHistoryState(data.guestMedicalHistory || {}));
                setIsSameAddress(JSON.stringify(nextCurrentAddress) === JSON.stringify(nextPermanentAddress));
                setState('ready');
            } catch (error) {
                setState('invalid');
                setMessage(error.message || 'This link has expired or is invalid. Please contact the clinic for assistance.');
            }
        };

        fetchData();
    }, [token]);

    const patientAge = useMemo(() => getAge(appointmentInfo?.guestBirthdate), [appointmentInfo?.guestBirthdate]);
    const isMinor = patientAge !== null && patientAge < 18;

    const validateAddress = (address, prefix) => {
        const nextErrors = {};
        ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach((field) => {
            if (!address[field]) nextErrors[`${prefix}_${field}`] = 'Required';
        });
        return nextErrors;
    };

    const validatePhoneField = (value, key, required = false) => {
        const digits = stripPhonePrefix(value);
        if (!digits) {
            return required ? { [key]: 'Required' } : {};
        }
        if (digits.length !== 10 || !digits.startsWith('9')) {
            return { [key]: 'Use 9xxxxxxxxx format.' };
        }
        return {};
    };

    const validateForm = () => {
        const nextErrors = {
            ...validateAddress(currentAddress, 'current'),
            ...validateAddress(isSameAddress ? currentAddress : permanentAddress, 'permanent'),
            ...validatePhoneField(emergencyContact.contactNumber, 'emergencyContact_contactNumber', true),
            ...validatePhoneField(profile.homePhone, 'profile_homePhone'),
            ...validatePhoneField(profile.workPhone, 'profile_workPhone'),
            ...validatePhoneField(guardian.contactNumber, 'guardian_contactNumber', isMinor),
            ...validatePhoneField(physician.officeNumber, 'physician_officeNumber'),
        };

        if (!profile.occupation.trim()) nextErrors.profile_occupation = 'Required';
        if (!profile.reasonForConsultation.trim()) nextErrors.profile_reasonForConsultation = 'Required';
        if (!emergencyContact.name.trim()) nextErrors.emergencyContact_name = 'Required';
        if (!emergencyContact.relationship.trim()) nextErrors.emergencyContact_relationship = 'Required';
        if (isMinor) {
            if (!guardian.name.trim()) nextErrors.guardian_name = 'Required';
            if (!guardian.relationship.trim()) nextErrors.guardian_relationship = 'Required';
        }
        if (!medicalHistory.inGoodHealth) nextErrors.medicalHistory_inGoodHealth = 'Required';

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

    const handleProfileChange = (field, value) => {
        setProfile((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next[`profile_${field}`];
            return next;
        });
    };

    const handleContactChange = (setter, prefix, field, value) => {
        setter((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next[`${prefix}_${field}`];
            return next;
        });
    };

    const handlePhoneChange = (setter, prefix, field, value) => {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        handleContactChange(setter, prefix, field, digits);
    };

    const handleMedicalChange = (field, value) => {
        setMedicalHistory((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => {
            const next = { ...prev };
            delete next[`medicalHistory_${field}`];
            return next;
        });
    };

    const handleMedicalArrayToggle = (field, option) => {
        setMedicalHistory((prev) => {
            const current = prev[field];
            const nextValues = current.includes(option)
                ? current.filter((entry) => entry !== option)
                : [...current, option];
            return { ...prev, [field]: nextValues };
        });
    };

    const handleDentalChange = (field, value) => {
        setDentalHistory((prev) => ({ ...prev, [field]: value }));
    };

    const handleSameAddressToggle = (event) => {
        const checked = event.target.checked;
        setIsSameAddress(checked);
        if (checked) setPermanentAddress({ ...currentAddress });
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
                <h3 className={styles.sectionTitle} style={{ fontSize: '1.2rem' }}>{title}</h3>
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
                    guestProfile: {
                        ...profile,
                        homePhone: toPhonePayload(profile.homePhone),
                        workPhone: toPhonePayload(profile.workPhone),
                    },
                    guestEmergencyContact: {
                        ...emergencyContact,
                        contactNumber: toPhonePayload(emergencyContact.contactNumber),
                    },
                    guestGuardian: {
                        ...guardian,
                        contactNumber: toPhonePayload(guardian.contactNumber),
                    },
                    guestPhysician: {
                        ...physician,
                        officeNumber: toPhonePayload(physician.officeNumber),
                    },
                    guestDentalHistory: {
                        ...dentalHistory,
                        chiefComplaint: dentalHistory.chiefComplaint || profile.reasonForConsultation,
                        hadTreatmentReaction: dentalHistory.hadTreatmentReaction === '' ? undefined : dentalHistory.hadTreatmentReaction === 'yes',
                    },
                    guestMedicalHistory: {
                        ...medicalHistory,
                        allergies: [...medicalHistory.allergies, ...medicalHistory.allergyOther.split(',').map((entry) => entry.trim()).filter(Boolean)],
                        conditions: [...medicalHistory.conditions, ...medicalHistory.conditionOther.split(',').map((entry) => entry.trim()).filter(Boolean)],
                        medications: medicalHistory.medications.split(',').map((entry) => entry.trim()).filter(Boolean),
                        inGoodHealth: medicalHistory.inGoodHealth === '' ? undefined : medicalHistory.inGoodHealth === 'yes',
                        underMedicalTreatment: medicalHistory.underMedicalTreatment === '' ? undefined : medicalHistory.underMedicalTreatment === 'yes',
                        hadSeriousIllnessOrSurgery: medicalHistory.hadSeriousIllnessOrSurgery === '' ? undefined : medicalHistory.hadSeriousIllnessOrSurgery === 'yes',
                        hadHospitalization: medicalHistory.hadHospitalization === '' ? undefined : medicalHistory.hadHospitalization === 'yes',
                        isTakingMedication: medicalHistory.isTakingMedication === '' ? undefined : medicalHistory.isTakingMedication === 'yes',
                        usesTobacco: medicalHistory.usesTobacco === '' ? undefined : medicalHistory.usesTobacco === 'yes',
                        usesAlcoholOrDrugs: medicalHistory.usesAlcoholOrDrugs === '' ? undefined : medicalHistory.usesAlcoholOrDrugs === 'yes',
                        hasAllergies: medicalHistory.hasAllergies === '' ? undefined : medicalHistory.hasAllergies === 'yes',
                        isPregnant: medicalHistory.isPregnant === '' ? undefined : medicalHistory.isPregnant === 'yes',
                        isNursing: medicalHistory.isNursing === '' ? undefined : medicalHistory.isNursing === 'yes',
                        takingBirthControl: medicalHistory.takingBirthControl === '' ? undefined : medicalHistory.takingBirthControl === 'yes',
                    },
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || 'Unable to save your details.');
            setState('success');
            setMessage('Thank you! Your registration details have been completed. The clinic can now prepare your patient record before your visit.');
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
                            <>
                                <p className={styles.bodyText}>
                                    Hello {appointmentInfo.guestName}, please complete the patient information below for your {appointmentInfo.procedure} appointment on {formatDate(appointmentInfo.appointmentDate)} at {appointmentInfo.branch}.
                                </p>
                                <div className={styles.formGrid} style={{ marginTop: '16px' }}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Birthdate</label>
                                        <div className={styles.fieldInput}>{formatDate(appointmentInfo.guestBirthdate)}</div>
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Gender</label>
                                        <div className={styles.fieldInput}>{appointmentInfo.guestGender || 'Not provided'}</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className={styles.bodyText}>{message || 'Loading your registration link...'}</p>
                        )}
                    </article>

                    {state === 'ready' && (
                        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
                            {message && <div className={styles.errorBanner}>{message}</div>}

                            <div className={styles.formCard} style={{ background: '#fff', border: '1px solid rgba(1, 83, 139, 0.08)' }}>
                                <h3 className={styles.sectionTitle} style={{ fontSize: '1.2rem' }}>Patient Details</h3>
                                <div className={styles.formGrid}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Occupation</label>
                                        <input className={`${styles.fieldInput} ${errors.profile_occupation ? styles.errorBorder : ''}`} value={profile.occupation} onChange={(e) => handleProfileChange('occupation', e.target.value)} />
                                        {errors.profile_occupation && <span className={styles.errorText}>{errors.profile_occupation}</span>}
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Civil Status</label>
                                        <select className={styles.fieldSelect} value={profile.civilStatus} onChange={(e) => handleProfileChange('civilStatus', e.target.value)}>
                                            <option value="">Select status</option>
                                            <option value="Single">Single</option>
                                            <option value="Married">Married</option>
                                            <option value="Widowed">Widowed</option>
                                            <option value="Separated">Separated</option>
                                            <option value="Divorced">Divorced</option>
                                        </select>
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Blood Type</label>
                                        <input className={styles.fieldInput} value={profile.bloodType} onChange={(e) => handleProfileChange('bloodType', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Nationality</label>
                                        <input className={styles.fieldInput} value={profile.nationality} onChange={(e) => handleProfileChange('nationality', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Religion</label>
                                        <input className={styles.fieldInput} value={profile.religion} onChange={(e) => handleProfileChange('religion', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Referred By</label>
                                        <input className={styles.fieldInput} value={profile.referredBy} onChange={(e) => handleProfileChange('referredBy', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Home Phone</label>
                                        <div className={`${styles.phoneInputGroup} ${errors.profile_homePhone ? styles.errorBorder : ''}`}>
                                            <span className={styles.phonePrefix}>+63</span>
                                            <input className={styles.phoneField} value={profile.homePhone} onChange={(e) => handlePhoneChange(setProfile, 'profile', 'homePhone', e.target.value)} maxLength={10} placeholder="9xxxxxxxxx" />
                                        </div>
                                        {errors.profile_homePhone && <span className={styles.errorText}>{errors.profile_homePhone}</span>}
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Work Phone</label>
                                        <div className={`${styles.phoneInputGroup} ${errors.profile_workPhone ? styles.errorBorder : ''}`}>
                                            <span className={styles.phonePrefix}>+63</span>
                                            <input className={styles.phoneField} value={profile.workPhone} onChange={(e) => handlePhoneChange(setProfile, 'profile', 'workPhone', e.target.value)} maxLength={10} placeholder="9xxxxxxxxx" />
                                        </div>
                                        {errors.profile_workPhone && <span className={styles.errorText}>{errors.profile_workPhone}</span>}
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Reason for Consultation</label>
                                        <textarea className={`${styles.fieldTextarea} ${errors.profile_reasonForConsultation ? styles.errorBorder : ''}`} value={profile.reasonForConsultation} onChange={(e) => { handleProfileChange('reasonForConsultation', e.target.value); handleDentalChange('chiefComplaint', e.target.value); }} />
                                        {errors.profile_reasonForConsultation && <span className={styles.errorText}>{errors.profile_reasonForConsultation}</span>}
                                    </div>
                                </div>
                            </div>

                            {renderAddressSection('current', 'Current Address', currentAddress)}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#536c7f', fontSize: '14px' }}>
                                <input id="sameAddress" type="checkbox" checked={isSameAddress} onChange={handleSameAddressToggle} />
                                <label htmlFor="sameAddress">Permanent address is the same as current address</label>
                            </div>

                            {renderAddressSection('permanent', 'Permanent Address', isSameAddress ? currentAddress : permanentAddress)}

                            <div className={styles.formCard} style={{ background: '#fff', border: '1px solid rgba(1, 83, 139, 0.08)' }}>
                                <h3 className={styles.sectionTitle} style={{ fontSize: '1.2rem' }}>Emergency Contact</h3>
                                <div className={styles.formGrid}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Contact Name</label>
                                        <input className={`${styles.fieldInput} ${errors.emergencyContact_name ? styles.errorBorder : ''}`} value={emergencyContact.name} onChange={(e) => handleContactChange(setEmergencyContact, 'emergencyContact', 'name', e.target.value)} />
                                        {errors.emergencyContact_name && <span className={styles.errorText}>{errors.emergencyContact_name}</span>}
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Relationship</label>
                                        <input className={`${styles.fieldInput} ${errors.emergencyContact_relationship ? styles.errorBorder : ''}`} value={emergencyContact.relationship} onChange={(e) => handleContactChange(setEmergencyContact, 'emergencyContact', 'relationship', e.target.value)} />
                                        {errors.emergencyContact_relationship && <span className={styles.errorText}>{errors.emergencyContact_relationship}</span>}
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Mobile Number</label>
                                        <div className={`${styles.phoneInputGroup} ${errors.emergencyContact_contactNumber ? styles.errorBorder : ''}`}>
                                            <span className={styles.phonePrefix}>+63</span>
                                            <input className={styles.phoneField} value={emergencyContact.contactNumber} onChange={(e) => handlePhoneChange(setEmergencyContact, 'emergencyContact', 'contactNumber', e.target.value)} maxLength={10} placeholder="9xxxxxxxxx" />
                                        </div>
                                        {errors.emergencyContact_contactNumber && <span className={styles.errorText}>{errors.emergencyContact_contactNumber}</span>}
                                    </div>
                                </div>
                            </div>

                            {isMinor && (
                                <div className={styles.formCard} style={{ background: '#fff', border: '1px solid rgba(1, 83, 139, 0.08)' }}>
                                    <h3 className={styles.sectionTitle} style={{ fontSize: '1.2rem' }}>Guardian Details</h3>
                                    <div className={styles.formGrid}>
                                        <div className={styles.fieldGroup}>
                                            <label className={styles.fieldLabel}>Guardian Name</label>
                                            <input className={`${styles.fieldInput} ${errors.guardian_name ? styles.errorBorder : ''}`} value={guardian.name} onChange={(e) => handleContactChange(setGuardian, 'guardian', 'name', e.target.value)} />
                                            {errors.guardian_name && <span className={styles.errorText}>{errors.guardian_name}</span>}
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label className={styles.fieldLabel}>Relationship</label>
                                            <input className={`${styles.fieldInput} ${errors.guardian_relationship ? styles.errorBorder : ''}`} value={guardian.relationship} onChange={(e) => handleContactChange(setGuardian, 'guardian', 'relationship', e.target.value)} />
                                            {errors.guardian_relationship && <span className={styles.errorText}>{errors.guardian_relationship}</span>}
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label className={styles.fieldLabel}>Contact Number</label>
                                            <div className={`${styles.phoneInputGroup} ${errors.guardian_contactNumber ? styles.errorBorder : ''}`}>
                                                <span className={styles.phonePrefix}>+63</span>
                                                <input className={styles.phoneField} value={guardian.contactNumber} onChange={(e) => handlePhoneChange(setGuardian, 'guardian', 'contactNumber', e.target.value)} maxLength={10} placeholder="9xxxxxxxxx" />
                                            </div>
                                            {errors.guardian_contactNumber && <span className={styles.errorText}>{errors.guardian_contactNumber}</span>}
                                        </div>
                                        <div className={styles.fieldGroup}>
                                            <label className={styles.fieldLabel}>Occupation</label>
                                            <input className={styles.fieldInput} value={guardian.occupation} onChange={(e) => handleContactChange(setGuardian, 'guardian', 'occupation', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={styles.formCard} style={{ background: '#fff', border: '1px solid rgba(1, 83, 139, 0.08)' }}>
                                <h3 className={styles.sectionTitle} style={{ fontSize: '1.2rem' }}>Dental History</h3>
                                <div className={styles.formGrid}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Last Dental Visit</label>
                                        <input type="date" className={styles.fieldInput} value={dentalHistory.lastExamDate} onChange={(e) => handleDentalChange('lastExamDate', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Treatment Reaction or Complication</label>
                                        <select className={styles.fieldSelect} value={dentalHistory.hadTreatmentReaction} onChange={(e) => handleDentalChange('hadTreatmentReaction', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>If Yes, Please Detail</label>
                                        <textarea className={styles.fieldTextarea} value={dentalHistory.reactionDetails} onChange={(e) => handleDentalChange('reactionDetails', e.target.value)} />
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Additional Dental Notes</label>
                                        <textarea className={styles.fieldTextarea} value={dentalHistory.notes} onChange={(e) => handleDentalChange('notes', e.target.value)} />
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.consentCard}>
                                            <input type="checkbox" className={styles.consentCheckbox} checked={dentalHistory.hasConfidentialInfo} onChange={(e) => handleDentalChange('hasConfidentialInfo', e.target.checked)} />
                                            <span className={styles.consentText}>I have private or confidential dental information that I prefer to discuss directly at the clinic.</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formCard} style={{ background: '#fff', border: '1px solid rgba(1, 83, 139, 0.08)' }}>
                                <h3 className={styles.sectionTitle} style={{ fontSize: '1.2rem' }}>Medical History</h3>
                                <div className={styles.formGrid}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Are you in good health?</label>
                                        <select className={`${styles.fieldSelect} ${errors.medicalHistory_inGoodHealth ? styles.errorBorder : ''}`} value={medicalHistory.inGoodHealth} onChange={(e) => handleMedicalChange('inGoodHealth', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                        {errors.medicalHistory_inGoodHealth && <span className={styles.errorText}>{errors.medicalHistory_inGoodHealth}</span>}
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Under medical treatment now?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.underMedicalTreatment} onChange={(e) => handleMedicalChange('underMedicalTreatment', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Condition Treated</label>
                                        <textarea className={styles.fieldTextarea} value={medicalHistory.medicalTreatmentDetails} onChange={(e) => handleMedicalChange('medicalTreatmentDetails', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Serious illness or surgery?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.hadSeriousIllnessOrSurgery} onChange={(e) => handleMedicalChange('hadSeriousIllnessOrSurgery', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Hospitalized before?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.hadHospitalization} onChange={(e) => handleMedicalChange('hadHospitalization', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Illness / Operation Details</label>
                                        <textarea className={styles.fieldTextarea} value={medicalHistory.seriousIllnessOrSurgeryDetails} onChange={(e) => handleMedicalChange('seriousIllnessOrSurgeryDetails', e.target.value)} />
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Hospitalization Details</label>
                                        <textarea className={styles.fieldTextarea} value={medicalHistory.hospitalizationDetails} onChange={(e) => handleMedicalChange('hospitalizationDetails', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Taking medication?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.isTakingMedication} onChange={(e) => handleMedicalChange('isTakingMedication', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Medications</label>
                                        <textarea className={styles.fieldTextarea} value={medicalHistory.medications} onChange={(e) => handleMedicalChange('medications', e.target.value)} placeholder="Comma-separated values" />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Uses tobacco?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.usesTobacco} onChange={(e) => handleMedicalChange('usesTobacco', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Uses alcohol or dangerous drugs?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.usesAlcoholOrDrugs} onChange={(e) => handleMedicalChange('usesAlcoholOrDrugs', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Has allergies?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.hasAllergies} onChange={(e) => handleMedicalChange('hasAllergies', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Bleeding Time</label>
                                        <input className={styles.fieldInput} value={medicalHistory.bleedingTime} onChange={(e) => handleMedicalChange('bleedingTime', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Blood Pressure</label>
                                        <input className={styles.fieldInput} value={medicalHistory.bloodPressure} onChange={(e) => handleMedicalChange('bloodPressure', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Pregnant?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.isPregnant} onChange={(e) => handleMedicalChange('isPregnant', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Nursing?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.isNursing} onChange={(e) => handleMedicalChange('isNursing', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Taking birth control pills?</label>
                                        <select className={styles.fieldSelect} value={medicalHistory.takingBirthControl} onChange={(e) => handleMedicalChange('takingBirthControl', e.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Allergies</label>
                                        <div className={styles.checkboxGrid}>
                                            {allergyOptions.map((option) => (
                                                <label key={option} className={styles.checkboxCard}>
                                                    <input type="checkbox" checked={medicalHistory.allergies.includes(option)} onChange={() => handleMedicalArrayToggle('allergies', option)} />
                                                    <span>{option}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <input className={styles.fieldInput} style={{ marginTop: '12px' }} value={medicalHistory.allergyOther} onChange={(e) => handleMedicalChange('allergyOther', e.target.value)} placeholder="Other allergy" />
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Medical Conditions</label>
                                        <div className={styles.checkboxGrid}>
                                            {medicalConditionOptions.map((option) => (
                                                <label key={option} className={styles.checkboxCard}>
                                                    <input type="checkbox" checked={medicalHistory.conditions.includes(option)} onChange={() => handleMedicalArrayToggle('conditions', option)} />
                                                    <span>{option}</span>
                                                </label>
                                            ))}
                                        </div>
                                        <input className={styles.fieldInput} style={{ marginTop: '12px' }} value={medicalHistory.conditionOther} onChange={(e) => handleMedicalChange('conditionOther', e.target.value)} placeholder="Other condition" />
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Medical Notes</label>
                                        <textarea className={styles.fieldTextarea} value={medicalHistory.notes} onChange={(e) => handleMedicalChange('notes', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formCard} style={{ background: '#fff', border: '1px solid rgba(1, 83, 139, 0.08)' }}>
                                <h3 className={styles.sectionTitle} style={{ fontSize: '1.2rem' }}>Physician Information</h3>
                                <div className={styles.formGrid}>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Physician Name</label>
                                        <input className={styles.fieldInput} value={physician.name} onChange={(e) => handleContactChange(setPhysician, 'physician', 'name', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Specialty</label>
                                        <input className={styles.fieldInput} value={physician.specialty} onChange={(e) => handleContactChange(setPhysician, 'physician', 'specialty', e.target.value)} />
                                    </div>
                                    <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                        <label className={styles.fieldLabel}>Office Address</label>
                                        <input className={styles.fieldInput} value={physician.officeAddress} onChange={(e) => handleContactChange(setPhysician, 'physician', 'officeAddress', e.target.value)} />
                                    </div>
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>Office Number</label>
                                        <div className={`${styles.phoneInputGroup} ${errors.physician_officeNumber ? styles.errorBorder : ''}`}>
                                            <span className={styles.phonePrefix}>+63</span>
                                            <input className={styles.phoneField} value={physician.officeNumber} onChange={(e) => handlePhoneChange(setPhysician, 'physician', 'officeNumber', e.target.value)} maxLength={10} placeholder="9xxxxxxxxx" />
                                        </div>
                                        {errors.physician_officeNumber && <span className={styles.errorText}>{errors.physician_officeNumber}</span>}
                                    </div>
                                </div>
                            </div>

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
