// ngitify-web/src/pages/admin/SystemConfig.js
import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { FaCog, FaClinicMedical, FaCalendarAlt, FaBell, FaSave } from 'react-icons/fa';
import styles from '../../styles/admin/SystemConfig.module.css';

export default function SystemConfig() {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeSection, setActiveSection] = useState('clinic');

    const [config, setConfig] = useState({
        clinicName: '',
        clinicEmail: '',
        clinicPhone: '',
        clinicAddress: '',
        clinicLogo: '',
        maxAppointmentsPerDay: 20,
        appointmentSlotMinutes: 30,
        allowWalkIns: true,
        enableInventoryAlerts: true,
        enableNotifications: true
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await authFetch('/system-config');
                if (res.ok) {
                    const data = await res.json();
                    setConfig({
                        clinicName: data.clinicName || '',
                        clinicEmail: data.clinicEmail || '',
                        clinicPhone: data.clinicPhone || '',
                        clinicAddress: data.clinicAddress || '',
                        clinicLogo: data.clinicLogo || '',
                        maxAppointmentsPerDay: data.maxAppointmentsPerDay || 20,
                        appointmentSlotMinutes: data.appointmentSlotMinutes || 30,
                        allowWalkIns: data.allowWalkIns !== false,
                        enableInventoryAlerts: data.enableInventoryAlerts !== false,
                        enableNotifications: data.enableNotifications !== false
                    });
                }
            } catch (e) {
                console.error('Failed to load system config:', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleChange = (field, value) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => handleChange('clinicLogo', reader.result);
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await authFetch('/system-config', {
                method: 'PUT',
                body: JSON.stringify(config)
            });
            if (res.ok) {
                addToast('System configuration saved successfully.', 'success');
            } else {
                addToast('Failed to save configuration.', 'error');
            }
        } catch (e) {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const sections = [
        { key: 'clinic', label: 'Clinic Information', icon: <FaClinicMedical /> },
        { key: 'appointments', label: 'Appointment Settings', icon: <FaCalendarAlt /> },
        { key: 'features', label: 'Feature Toggles', icon: <FaBell /> }
    ];

    if (isLoading) {
        return (
            <div className={styles.container}>
                <p style={{color: '#64748b', textAlign: 'center', padding: '60px'}}>Loading configuration...</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}><FaCog /> System Configuration</h1>
                    <p className={styles.subtitle}>Manage global system settings for the entire NgitiFy platform.</p>
                </div>
                <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
                    <FaSave /> {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </header>

            <div className={styles.layout}>
                {/* Sidebar navigation */}
                <div className={styles.sideNav}>
                    {sections.map(s => (
                        <button
                            key={s.key}
                            className={`${styles.sideNavBtn} ${activeSection === s.key ? styles.sideNavActive : ''}`}
                            onClick={() => setActiveSection(s.key)}
                        >
                            {s.icon} {s.label}
                        </button>
                    ))}
                </div>

                {/* Config panels */}
                <div className={styles.panel}>

                    {/* ── Clinic Information ── */}
                    {activeSection === 'clinic' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Clinic Information</h2>
                            <p className={styles.sectionDesc}>This information appears on emails and printouts sent to patients.</p>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Clinic Name</label>
                                    <input
                                        className={styles.inputField}
                                        value={config.clinicName}
                                        onChange={e => handleChange('clinicName', e.target.value)}
                                        placeholder="e.g. NgitiFy Dental Clinic"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Clinic Email</label>
                                    <input
                                        type="email"
                                        className={styles.inputField}
                                        value={config.clinicEmail}
                                        onChange={e => handleChange('clinicEmail', e.target.value)}
                                        placeholder="e.g. contact@ngitify.com"
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Contact Number</label>
                                    <input
                                        className={styles.inputField}
                                        value={config.clinicPhone}
                                        onChange={e => handleChange('clinicPhone', e.target.value)}
                                        placeholder="e.g. +63 917 123 4567"
                                    />
                                </div>
                                <div className={styles.formGroup} style={{gridColumn: '1 / -1'}}>
                                    <label>Clinic Address</label>
                                    <textarea
                                        className={styles.textareaField}
                                        value={config.clinicAddress}
                                        onChange={e => handleChange('clinicAddress', e.target.value)}
                                        placeholder="Full clinic address"
                                        rows={3}
                                    />
                                </div>
                                <div className={styles.formGroup} style={{gridColumn: '1 / -1'}}>
                                    <label>Clinic Logo</label>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
                                        {config.clinicLogo && (
                                            <img src={config.clinicLogo} alt="Clinic Logo" style={{height: '60px', borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                                        )}
                                        <label className={styles.uploadLabel}>
                                            Upload Logo
                                            <input type="file" accept="image/*" onChange={handleLogoChange} style={{display: 'none'}} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Appointment Settings ── */}
                    {activeSection === 'appointments' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Appointment Settings</h2>
                            <p className={styles.sectionDesc}>Configure how appointments are scheduled across all branches.</p>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Max Appointments Per Day</label>
                                    <input
                                        type="number"
                                        className={styles.inputField}
                                        value={config.maxAppointmentsPerDay}
                                        min={1}
                                        max={100}
                                        onChange={e => handleChange('maxAppointmentsPerDay', Number(e.target.value))}
                                    />
                                    <span className={styles.fieldHint}>Limit per branch per day</span>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Appointment Slot Duration (minutes)</label>
                                    <select
                                        className={styles.inputField}
                                        value={config.appointmentSlotMinutes}
                                        onChange={e => handleChange('appointmentSlotMinutes', Number(e.target.value))}
                                    >
                                        <option value={15}>15 minutes</option>
                                        <option value={30}>30 minutes</option>
                                        <option value={45}>45 minutes</option>
                                        <option value={60}>60 minutes</option>
                                        <option value={90}>90 minutes</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{gridColumn: '1 / -1'}}>
                                    <div className={styles.toggleRow}>
                                        <div>
                                            <p className={styles.toggleLabel}>Allow Walk-in Patients</p>
                                            <p className={styles.toggleDesc}>Enable the queue system for walk-in patients at branches.</p>
                                        </div>
                                        <label className={styles.toggle}>
                                            <input
                                                type="checkbox"
                                                checked={config.allowWalkIns}
                                                onChange={e => handleChange('allowWalkIns', e.target.checked)}
                                            />
                                            <span className={styles.toggleSlider}></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Feature Toggles ── */}
                    {activeSection === 'features' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Feature Toggles</h2>
                            <p className={styles.sectionDesc}>Enable or disable system modules globally.</p>

                            <div className={styles.toggleList}>
                                <div className={styles.toggleRow}>
                                    <div>
                                        <p className={styles.toggleLabel}>Inventory Low-Stock Alerts</p>
                                        <p className={styles.toggleDesc}>Show badge alerts in the sidebar when inventory items are below reorder level.</p>
                                    </div>
                                    <label className={styles.toggle}>
                                        <input
                                            type="checkbox"
                                            checked={config.enableInventoryAlerts}
                                            onChange={e => handleChange('enableInventoryAlerts', e.target.checked)}
                                        />
                                        <span className={styles.toggleSlider}></span>
                                    </label>
                                </div>

                                <div className={styles.toggleRow}>
                                    <div>
                                        <p className={styles.toggleLabel}>Notification Bell</p>
                                        <p className={styles.toggleDesc}>Show the notification bell in the header for new appointment alerts and system events.</p>
                                    </div>
                                    <label className={styles.toggle}>
                                        <input
                                            type="checkbox"
                                            checked={config.enableNotifications}
                                            onChange={e => handleChange('enableNotifications', e.target.checked)}
                                        />
                                        <span className={styles.toggleSlider}></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}