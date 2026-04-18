import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/SystemConfig.module.css';

const DEFAULT_SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

const SystemConfig = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeSection, setActiveSection] = useState('clinic');
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const [config, setConfig] = useState({
        clinicName: '',
        clinicContact: '',
        clinicAddress: '',
        clinicEmail: '',
        maxAppointmentsPerDay: 20,
        allowedTimeSlots: [],
        emailTemplates: {
            activation: '',
            appointmentReminder: ''
        },
        featureToggles: {
            queueManagement: true,
            radiographUploads: true,
            chatSupport: false,
            sessionTimeout: true
        },
        sessionTimeoutMinutes: 30
    });

    useEffect(() => {
        const fetchConfig = async () => {
            setIsLoading(true);
            try {
                const res = await authFetch('/system-config');
                if (res.ok) {
                    const data = await res.json();
                    setConfig(prev => ({ ...prev, ...data }));
                }
            } catch (e) {
                setErrorMsg('Failed to load system configuration.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, []); // FIX: Removed authFetch from dependency array

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleTemplateChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({
            ...prev,
            emailTemplates: { ...prev.emailTemplates, [name]: value }
        }));
    };

    const handleToggleChange = (key) => {
        setConfig(prev => ({
            ...prev,
            featureToggles: { ...prev.featureToggles, [key]: !prev.featureToggles[key] }
        }));
    };

    const handleSlotToggle = (slot) => {
        setConfig(prev => {
            const has = prev.allowedTimeSlots.includes(slot);
            return {
                ...prev,
                allowedTimeSlots: has
                    ? prev.allowedTimeSlots.filter(s => s !== slot)
                    : [...prev.allowedTimeSlots, slot].sort()
            };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSuccessMsg('');
        setErrorMsg('');
        try {
            const res = await authFetch('/system-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                setSuccessMsg('System configuration saved successfully.');
                setTimeout(() => setSuccessMsg(''), 4000);
            } else {
                const d = await res.json();
                setErrorMsg(d.message || 'Failed to save configuration.');
            }
        } catch (e) {
            setErrorMsg('Network error. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className={styles.loadingContainer}><p>Loading system configuration...</p></div>;
    }

    const SECTIONS = [
        { key: 'clinic', label: 'Clinic Info' },
        { key: 'appointments', label: 'Appointment Settings' },
        { key: 'emails', label: 'Email Templates' },
        { key: 'features', label: 'Feature Toggles' }
    ];

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>System Configuration</h1>
                <p className={styles.pageSubtitle}>Manage global settings for NgitiFy Dental Management System.</p>
            </div>

            {successMsg && <div className={styles.successAlert}>{successMsg}</div>}
            {errorMsg && <div className={styles.errorAlert}>{errorMsg}</div>}

            <div className={styles.layout}>
                {/* Sidebar nav */}
                <nav className={styles.sectionNav}>
                    {SECTIONS.map(s => (
                        <button
                            key={s.key}
                            className={`${styles.navBtn} ${activeSection === s.key ? styles.navBtnActive : ''}`}
                            onClick={() => setActiveSection(s.key)}
                        >
                            {s.label}
                        </button>
                    ))}
                </nav>

                {/* Content */}
                <div className={styles.content}>

                    {/* ── CLINIC INFO ── */}
                    {activeSection === 'clinic' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Clinic Information</h2>
                            <p className={styles.sectionDesc}>Basic information about your dental clinic.</p>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Clinic Name</label>
                                <input type="text" name="clinicName" value={config.clinicName}
                                    onChange={handleChange} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Contact Number</label>
                                <input type="text" name="clinicContact" value={config.clinicContact}
                                    onChange={handleChange} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Email Address</label>
                                <input type="email" name="clinicEmail" value={config.clinicEmail}
                                    onChange={handleChange} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Address</label>
                                <textarea name="clinicAddress" value={config.clinicAddress}
                                    onChange={handleChange} className={styles.textarea} rows={3} />
                            </div>
                        </div>
                    )}

                    {/* ── APPOINTMENT SETTINGS ── */}
                    {activeSection === 'appointments' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Appointment Settings</h2>
                            <p className={styles.sectionDesc}>Control scheduling limits and available time slots.</p>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Max Appointments Per Day</label>
                                <input type="number" name="maxAppointmentsPerDay"
                                    value={config.maxAppointmentsPerDay}
                                    onChange={handleChange} className={styles.inputSmall}
                                    min={1} max={100} />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Allowed Time Slots</label>
                                <p className={styles.helpText}>Check the time slots patients can book appointments.</p>
                                <div className={styles.slotGrid}>
                                    {DEFAULT_SLOTS.map(slot => (
                                        <label key={slot} className={`${styles.slotChip} ${config.allowedTimeSlots.includes(slot) ? styles.slotChipActive : ''}`}>
                                            <input type="checkbox"
                                                checked={config.allowedTimeSlots.includes(slot)}
                                                onChange={() => handleSlotToggle(slot)}
                                                style={{ marginRight: '6px' }} />
                                            {slot}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── EMAIL TEMPLATES ── */}
                    {activeSection === 'emails' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Email Templates</h2>
                            <p className={styles.sectionDesc}>Customize the emails sent to users and patients.</p>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Account Activation Email</label>
                                <p className={styles.helpText}>Sent when a new staff account is created.</p>
                                <textarea name="activation"
                                    value={config.emailTemplates?.activation || ''}
                                    onChange={handleTemplateChange}
                                    className={styles.textarea} rows={5} />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Appointment Reminder Email</label>
                                <p className={styles.helpText}>Sent to patients before their scheduled appointment.</p>
                                <textarea name="appointmentReminder"
                                    value={config.emailTemplates?.appointmentReminder || ''}
                                    onChange={handleTemplateChange}
                                    className={styles.textarea} rows={5} />
                            </div>
                        </div>
                    )}

                    {/* ── FEATURE TOGGLES ── */}
                    {activeSection === 'features' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Feature Toggles</h2>
                            <p className={styles.sectionDesc}>Enable or disable system modules.</p>

                            {[
                                { key: 'queueManagement',   label: 'Queue Management',   desc: 'Walk-in patient queue module.' },
                                { key: 'radiographUploads', label: 'Radiograph Uploads', desc: 'Allow radiograph image uploads in patient EMR.' },
                                { key: 'chatSupport',       label: 'Chat Support',        desc: 'Enable the chat/ticket support system.' },
                                { key: 'sessionTimeout',    label: 'Session Timeout',     desc: 'Auto logout after inactivity.' }
                            ].map(f => (
                                <div key={f.key} className={styles.toggleRow}>
                                    <div className={styles.toggleInfo}>
                                        <span className={styles.toggleLabel}>{f.label}</span>
                                        <span className={styles.toggleDesc}>{f.desc}</span>
                                    </div>
                                    <button
                                        className={`${styles.toggleSwitch} ${config.featureToggles?.[f.key] ? styles.toggleOn : styles.toggleOff}`}
                                        onClick={() => handleToggleChange(f.key)}
                                    >
                                        {config.featureToggles?.[f.key] ? 'ON' : 'OFF'}
                                    </button>
                                </div>
                            ))}

                            {config.featureToggles?.sessionTimeout && (
                                <div className={styles.formGroup} style={{ marginTop: '20px' }}>
                                    <label className={styles.label}>Session Timeout Duration (minutes)</label>
                                    <input type="number" name="sessionTimeoutMinutes"
                                        value={config.sessionTimeoutMinutes}
                                        onChange={handleChange}
                                        className={styles.inputSmall} min={5} max={120} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Save Button */}
                    <div className={styles.saveRow}>
                        <button
                            className={styles.saveBtn}
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemConfig;