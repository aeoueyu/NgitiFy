import React, { useState } from 'react';
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
        <div className={styles.pageShell}>
            <div className={styles.pageIntro}>
                <h1 className={styles.pageTitle}>User Management</h1>
                <p className={styles.pageSubtitle}>Manage staff and patients in your branch.</p>
            </div>

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

            <div className={styles.tabPanel}>
                {activeTab === 'dentists'    && <ManageDentists />}
                {activeTab === 'secretaries' && <ManageSecretaries />}
                {activeTab === 'patients'    && <ManagePatients />}
            </div>
        </div>
    );
}
