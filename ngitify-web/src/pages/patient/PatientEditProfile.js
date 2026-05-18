import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaCalendarAlt,
    FaCamera,
    FaEnvelope,
    FaMapMarkerAlt,
    FaPhoneAlt,
    FaSave,
    FaUserCircle,
} from 'react-icons/fa';
import UserAvatar from '../../components/common/UserAvatar';
import { PatientEmptyState, PatientPageFrame, PatientSectionHeader } from '../../components/patient/PatientFrame';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { barangays, cities, provinces, regions } from '../../utils/addressData';
import { getHomeAddress, normalizeAddressForForm } from '../../utils/addressHelpers';
import { calculateAge, getFullName } from '../../utils/patientPortal';
import styles from '../../styles/patient/PatientPortal.module.css';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Separated', 'Widowed', 'Prefer not to say'];
const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const arrayToCsv = (value) => (Array.isArray(value) ? value.join(', ') : String(value || '').trim());
const csvToArray = (value) => String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const cloneFormState = (value) => JSON.parse(JSON.stringify(value));

const getDisplayDate = (value) => {
    if (!value) return 'Not specified';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not specified';
    return parsed.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const buildInitialForm = (profile) => {
    const normalizedAddress = normalizeAddressForForm(getHomeAddress(profile));

    return {
        firstName: profile?.name?.first || '',
        middleName: profile?.name?.middle || '',
        lastName: profile?.name?.last || '',
        birthdate: profile?.birthdate ? new Date(profile.birthdate).toISOString().split('T')[0] : '',
        gender: profile?.gender || '',
        phone: profile?.contactNumber || '',
        occupation: profile?.occupation || '',
        civilStatus: profile?.civilStatus || '',
        bloodType: profile?.bloodType || profile?.medicalHistory?.bloodType || '',
        reasonForConsultation: profile?.reasonForConsultation || '',
        emergencyName: profile?.emergencyContact?.name || '',
        emergencyRelationship: profile?.emergencyContact?.relationship || '',
        emergencyPhone: profile?.emergencyContact?.contactNumber || '',
        allergies: arrayToCsv(profile?.medicalHistory?.allergies),
        conditions: arrayToCsv(profile?.medicalHistory?.conditions),
        medications: arrayToCsv(profile?.medicalHistory?.medications),
        region: normalizedAddress.region || '',
        province: normalizedAddress.province || '',
        city: normalizedAddress.city || '',
        barangay: normalizedAddress.barangay || '',
        street: normalizedAddress.street || '',
        houseNumber: normalizedAddress.houseNumber || '',
        profileImage: profile?.profileImage || '',
    };
};

export default function PatientEditProfile() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const { addToast } = useToast();
    const { user } = useAuth();

    const [profile, setProfile] = useState(null);
    const [formData, setFormData] = useState(null);
    const [initialFormData, setInitialFormData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saveError, setSaveError] = useState('');

    const availableProvinces = useMemo(
        () => (formData?.region ? (provinces[formData.region] || []) : []),
        [formData?.region]
    );
    const availableCities = useMemo(
        () => (formData?.province ? (cities[formData.province] || []) : []),
        [formData?.province]
    );
    const availableBarangays = useMemo(
        () => (formData?.city ? (barangays[formData.city] || []) : []),
        [formData?.city]
    );

    const fetchProfile = useCallback(async () => {
        if (!user?.id) return;

        try {
            setLoading(true);
            setError('');
            const response = await authFetch(`/user/${user.id}`);
            if (!response.ok) {
                throw new Error('Could not load your patient profile.');
            }
            const payload = await response.json();
            const nextForm = buildInitialForm(payload);
            setProfile(payload);
            setFormData(nextForm);
            setInitialFormData(cloneFormState(nextForm));
        } catch (fetchError) {
            setProfile(null);
            setFormData(null);
            setInitialFormData(null);
            setError(fetchError.message || 'Could not load your patient profile.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const hasChanges = useMemo(() => {
        if (!formData || !initialFormData) return false;
        return JSON.stringify(formData) !== JSON.stringify(initialFormData);
    }, [formData, initialFormData]);

    const handleFieldChange = (field, value) => {
        setSaveError('');
        setFormData((current) => ({ ...current, [field]: value }));
    };

    const handleAddressChange = (field, value) => {
        setSaveError('');
        setFormData((current) => {
            const next = { ...current, [field]: value };
            if (field === 'region') {
                next.province = '';
                next.city = '';
                next.barangay = '';
            }
            if (field === 'province') {
                next.city = '';
                next.barangay = '';
            }
            if (field === 'city') {
                next.barangay = '';
            }
            return next;
        });
    };

    const handleReset = () => {
        if (!initialFormData) return;
        setFormData(cloneFormState(initialFormData));
        setSaveError('');
    };

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const encoded = String(reader.result || '');
            if (encoded.length > 1.5 * 1024 * 1024) {
                setSaveError('Profile image must stay under 1.5MB.');
                return;
            }
            handleFieldChange('profileImage', encoded);
        };
        reader.readAsDataURL(file);
    };

    const getRegionName = (code) => regions.find((entry) => entry.code === code)?.name || '';
    const getProvinceName = (code) => availableProvinces.find((entry) => entry.code === code)?.name
        || Object.values(provinces).flat().find((entry) => entry.code === code)?.name
        || '';
    const getCityName = (code) => availableCities.find((entry) => entry.code === code)?.name
        || Object.values(cities).flat().find((entry) => entry.code === code)?.name
        || '';

    const handleSave = async () => {
        if (!formData || !user?.id) return;

        setSaveError('');

        if (!formData.firstName.trim() || !formData.lastName.trim()) {
            setSaveError('First name and last name are required.');
            return;
        }

        if (formData.phone && !/^[0-9+\s\-()]{7,20}$/.test(formData.phone.trim())) {
            setSaveError('Please enter a valid contact number.');
            return;
        }

        const homeAddress = {
            country: 'Philippines',
            region: getRegionName(formData.region),
            province: getProvinceName(formData.province),
            city: getCityName(formData.city),
            barangay: formData.barangay,
            street: formData.street.trim(),
            houseNumber: formData.houseNumber.trim(),
        };

        const payload = {
            name: {
                first: formData.firstName.trim(),
                middle: formData.middleName.trim(),
                last: formData.lastName.trim(),
            },
            contactNumber: formData.phone.trim() || undefined,
            birthdate: formData.birthdate || undefined,
            gender: formData.gender || undefined,
            occupation: formData.occupation.trim() || undefined,
            civilStatus: formData.civilStatus || undefined,
            bloodType: formData.bloodType || undefined,
            reasonForConsultation: formData.reasonForConsultation.trim() || undefined,
            emergencyContact: {
                name: formData.emergencyName.trim() || undefined,
                relationship: formData.emergencyRelationship.trim() || undefined,
                contactNumber: formData.emergencyPhone.trim() || undefined,
            },
            medicalHistory: {
                bloodType: formData.bloodType || undefined,
                allergies: csvToArray(formData.allergies),
                conditions: csvToArray(formData.conditions),
                medications: csvToArray(formData.medications),
            },
            homeAddress,
            profileImage: formData.profileImage || undefined,
        };

        setSaving(true);
        try {
            const response = await authFetch(`/user/update-profile/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            const payloadResponse = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payloadResponse.message || 'Failed to save your profile changes.');
            }

            const nextProfile = {
                ...(profile || {}),
                ...payloadResponse,
                name: payload.name,
                contactNumber: payload.contactNumber,
                birthdate: payload.birthdate,
                gender: payload.gender,
                occupation: payload.occupation,
                civilStatus: payload.civilStatus,
                bloodType: payload.bloodType,
                reasonForConsultation: payload.reasonForConsultation,
                emergencyContact: payload.emergencyContact,
                medicalHistory: payload.medicalHistory,
                homeAddress: payload.homeAddress,
                profileImage: payload.profileImage,
            };
            const nextForm = buildInitialForm(nextProfile);

            setProfile(nextProfile);
            setFormData(nextForm);
            setInitialFormData(cloneFormState(nextForm));
            window.dispatchEvent(new Event('ngitify-profile-updated'));
            addToast('Your patient profile has been updated.', 'success');
        } catch (saveFailure) {
            setSaveError(saveFailure.message || 'Failed to save your profile changes.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <PatientPageFrame
                title="Edit Profile"
                subtitle="Loading your patient information..."
            >
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Preparing your profile form...</span>
                </div>
            </PatientPageFrame>
        );
    }

    if (error || !formData) {
        return (
            <PatientPageFrame
                title="Edit Profile"
                subtitle="Update the same patient information used across web and mobile."
            >
                <PatientEmptyState
                    icon={<FaUserCircle />}
                    title="Could not open your profile form"
                    message={error || 'Your patient information could not be loaded.'}
                    action={(
                        <button type="button" className={styles.buttonSecondary} onClick={fetchProfile}>
                            Try Again
                        </button>
                    )}
                />
            </PatientPageFrame>
        );
    }

    const fullName = getFullName(profile || user);
    const age = calculateAge(formData.birthdate);

    return (
        <PatientPageFrame
            title="Edit Profile"
            subtitle="Update the same patient identity, contact, medical, and address details carried in the mobile app."
            actions={(
                <>
                    <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/profile')}>
                        Back to Profile
                    </button>
                    <button
                        type="button"
                        className={styles.buttonPrimary}
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                        style={{ opacity: !hasChanges || saving ? 0.65 : 1 }}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </>
            )}
        >
            <div className={styles.heroGrid}>
                <section className={styles.heroCard}>
                    <span className={styles.heroEyebrow}>Patient Identity</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center', marginBottom: '18px' }}>
                        <UserAvatar
                            user={{
                                name: {
                                    first: formData.firstName,
                                    last: formData.lastName,
                                },
                                profileImage: formData.profileImage,
                            }}
                            size={96}
                            style={{ border: '4px solid rgba(45, 204, 246, 0.22)' }}
                        />
                        <div style={{ flex: 1, minWidth: '240px' }}>
                            <h2 className={styles.heroTitle} style={{ color: '#17364a', fontSize: '28px', marginBottom: '10px' }}>
                                {fullName || 'Patient'}
                            </h2>
                            <div className={styles.detailPills}>
                                <span className={styles.detailPill}><FaEnvelope /> {profile?.email || user?.email || 'No email on file'}</span>
                                <span className={styles.detailPill}><FaPhoneAlt /> {formData.phone || 'No contact number'}</span>
                                <span className={styles.detailPill}><FaCalendarAlt /> {age !== null ? `${age} years old` : 'Age not set'}</span>
                            </div>
                            <div className={styles.heroActions}>
                                <button type="button" className={styles.buttonSecondary} onClick={() => fileInputRef.current?.click()}>
                                    <FaCamera style={{ marginRight: '8px' }} />
                                    Change Photo
                                </button>
                                <button type="button" className={styles.buttonGhost} onClick={handleReset} disabled={!hasChanges}>
                                    Reset Form
                                </button>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>
                    <p className={styles.heroText} style={{ color: '#5f7a8d' }}>
                        Keep your patient record accurate so appointment coordination, reminders, and clinic records stay aligned on both platforms.
                    </p>
                </section>

                <section className={styles.summaryCard}>
                    <PatientSectionHeader
                        eyebrow="Editing Guide"
                        title="What this page updates"
                    />
                    <div className={styles.timeline}>
                        <div>
                            <span className={styles.infoLabel}>Assigned Branch</span>
                            <p className={styles.infoValue}>{profile?.assignedBranch || profile?.assignedBranches?.[0] || user?.assignedBranch || 'Pending clinic assignment'}</p>
                        </div>
                        <div>
                            <span className={styles.infoLabel}>Birthdate on File</span>
                            <p className={styles.infoValue}>{getDisplayDate(formData.birthdate)}</p>
                        </div>
                        <div>
                            <span className={styles.infoLabel}>Reason for Consultation</span>
                            <p className={styles.infoValue}>{formData.reasonForConsultation || 'Not specified yet'}</p>
                        </div>
                        <div className={styles.noticeBox}>
                            This page mirrors the patient mobile edit flow: home address drives the permanent address copy, medical lists stay comma-separated, and email remains view-only here.
                        </div>
                    </div>
                </section>
            </div>

            <section className={styles.cardGrid} style={{ marginBottom: '24px' }}>
                <article className={styles.infoCard}>
                    <PatientSectionHeader eyebrow="Personal" title="Basic information" />
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className={styles.label}>First Name</span>
                            <input className={styles.input} value={formData.firstName} onChange={(event) => handleFieldChange('firstName', event.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Middle Name</span>
                            <input className={styles.input} value={formData.middleName} onChange={(event) => handleFieldChange('middleName', event.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Last Name</span>
                            <input className={styles.input} value={formData.lastName} onChange={(event) => handleFieldChange('lastName', event.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Contact Number</span>
                            <input className={styles.input} value={formData.phone} onChange={(event) => handleFieldChange('phone', event.target.value)} placeholder="e.g. +639123456789" />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Birthdate</span>
                            <input className={styles.input} type="date" max={new Date().toISOString().split('T')[0]} value={formData.birthdate} onChange={(event) => handleFieldChange('birthdate', event.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Gender</span>
                            <select className={styles.select} value={formData.gender} onChange={(event) => handleFieldChange('gender', event.target.value)}>
                                <option value="">Select gender</option>
                                {GENDER_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Civil Status</span>
                            <select className={styles.select} value={formData.civilStatus} onChange={(event) => handleFieldChange('civilStatus', event.target.value)}>
                                <option value="">Select civil status</option>
                                {CIVIL_STATUS_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Occupation</span>
                            <input className={styles.input} value={formData.occupation} onChange={(event) => handleFieldChange('occupation', event.target.value)} />
                        </label>
                        <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className={styles.label}>Reason for Consultation</span>
                            <textarea className={styles.textarea} value={formData.reasonForConsultation} onChange={(event) => handleFieldChange('reasonForConsultation', event.target.value)} placeholder="What the clinic should keep on file about your main dental concern." />
                        </label>
                    </div>
                </article>

                <article className={styles.infoCard}>
                    <PatientSectionHeader eyebrow="Emergency" title="Emergency contact" />
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className={styles.label}>Emergency Contact Name</span>
                            <input className={styles.input} value={formData.emergencyName} onChange={(event) => handleFieldChange('emergencyName', event.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Emergency Relationship</span>
                            <input className={styles.input} value={formData.emergencyRelationship} onChange={(event) => handleFieldChange('emergencyRelationship', event.target.value)} />
                        </label>
                        <label className={styles.field}>
                            <span className={styles.label}>Emergency Contact Number</span>
                            <input className={styles.input} value={formData.emergencyPhone} onChange={(event) => handleFieldChange('emergencyPhone', event.target.value)} />
                        </label>
                    </div>
                </article>

                <article className={styles.infoCard}>
                    <PatientSectionHeader eyebrow="Medical" title="Medical snapshot" />
                    <div className={styles.formGrid}>
                        <label className={styles.field}>
                            <span className={styles.label}>Blood Type</span>
                            <select className={styles.select} value={formData.bloodType} onChange={(event) => handleFieldChange('bloodType', event.target.value)}>
                                <option value="">Select blood type</option>
                                {BLOOD_TYPE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                        <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className={styles.label}>Allergies</span>
                            <textarea className={styles.textarea} value={formData.allergies} onChange={(event) => handleFieldChange('allergies', event.target.value)} placeholder="Comma-separated allergies" />
                        </label>
                        <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className={styles.label}>Medical Conditions</span>
                            <textarea className={styles.textarea} value={formData.conditions} onChange={(event) => handleFieldChange('conditions', event.target.value)} placeholder="Comma-separated conditions" />
                        </label>
                        <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className={styles.label}>Current Medications</span>
                            <textarea className={styles.textarea} value={formData.medications} onChange={(event) => handleFieldChange('medications', event.target.value)} placeholder="Comma-separated medications" />
                        </label>
                    </div>
                </article>
            </section>

            <article className={styles.infoCard}>
                <PatientSectionHeader
                    eyebrow="Address"
                    title="Home address"
                    description="Use the guided location fields to keep patient records consistent with the clinic database."
                />
                <div className={styles.formGrid}>
                    <label className={styles.field}>
                        <span className={styles.label}>Region</span>
                        <select className={styles.select} value={formData.region} onChange={(event) => handleAddressChange('region', event.target.value)}>
                            <option value="">Select region</option>
                            {regions.map((entry) => (
                                <option key={entry.code} value={entry.code}>{entry.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.field}>
                        <span className={styles.label}>Province</span>
                        <select className={styles.select} value={formData.province} onChange={(event) => handleAddressChange('province', event.target.value)} disabled={!formData.region}>
                            <option value="">Select province</option>
                            {availableProvinces.map((entry) => (
                                <option key={entry.code} value={entry.code}>{entry.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.field}>
                        <span className={styles.label}>City / Municipality</span>
                        <select className={styles.select} value={formData.city} onChange={(event) => handleAddressChange('city', event.target.value)} disabled={!formData.province}>
                            <option value="">Select city</option>
                            {availableCities.map((entry) => (
                                <option key={entry.code} value={entry.code}>{entry.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.field}>
                        <span className={styles.label}>Barangay</span>
                        <select className={styles.select} value={formData.barangay} onChange={(event) => handleAddressChange('barangay', event.target.value)} disabled={!formData.city}>
                            <option value="">Select barangay</option>
                            {availableBarangays.map((entry) => (
                                <option key={entry} value={entry}>{entry}</option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.field}>
                        <span className={styles.label}>House / Blk / Lot</span>
                        <input className={styles.input} value={formData.houseNumber} onChange={(event) => handleAddressChange('houseNumber', event.target.value)} />
                    </label>
                    <label className={styles.field}>
                        <span className={styles.label}>Street</span>
                        <input className={styles.input} value={formData.street} onChange={(event) => handleAddressChange('street', event.target.value)} />
                    </label>
                </div>

                <div className={styles.detailPills} style={{ marginTop: '18px' }}>
                    <span className={styles.detailPill}><FaMapMarkerAlt /> Permanent address follows the same home address on save</span>
                    <span className={styles.detailPill}><FaEnvelope /> Email changes remain handled separately by the clinic</span>
                </div>
            </article>

            {saveError ? (
                <section className={styles.alertCard} style={{ marginTop: '24px' }}>
                    <span className={styles.toolIcon} style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#b91c1c' }}>
                        <FaSave />
                    </span>
                    <div>
                        <h3 className={styles.alertTitle} style={{ color: '#991b1b' }}>Could not save changes</h3>
                        <p className={styles.alertText} style={{ color: '#7f1d1d' }}>{saveError}</p>
                    </div>
                </section>
            ) : null}
        </PatientPageFrame>
    );
}
