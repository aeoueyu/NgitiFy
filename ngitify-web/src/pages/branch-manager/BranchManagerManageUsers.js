import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ManageDentists from '../admin/ManageDentists';
import ManageSecretaries from '../admin/ManageSecretaries';
import ManagePatients from '../admin/ManagePatients';
import styles from '../../styles/admin/UserTabs.module.css';

const TABS = [
    { key: 'dentists',    label: 'Dentists' },
    { key: 'secretaries', label: 'Secretaries' },
    { key: 'patients',    label: 'Patients' },
];

export default function BranchManagerManageUsers() {
    const [activeTab, setActiveTab] = useState('dentists');

    return (
        <div style={{ padding: '24px', background: '#f4f7fa', minHeight: '100vh', fontFamily: "'Lexend Deca', sans-serif" }}>
            <h1 style={{ color: '#01538b', fontSize: '24px', fontWeight: '800', margin: '0 0 4px' }}>User Management</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>Manage staff and patients in your branch.</p>

            <div className={styles.tabContainer}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`${styles.tabButton} ${activeTab === tab.key ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ marginTop: '20px' }}>
                {activeTab === 'dentists'    && <ManageDentists />}
                {activeTab === 'secretaries' && <ManageSecretaries />}
                {activeTab === 'patients'    && <ManagePatients />}
            </div>
        </div>
    );
}