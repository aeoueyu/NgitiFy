import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaUserMd, FaUserNurse } from 'react-icons/fa';
import styles from '../../styles/admin/UserManagement.module.css';

const USER_SECTIONS = [
    {
        key: 'dentists',
        label: 'Dentists',
        description: 'Manage dentists, assigned branches, and account availability.',
        path: '/branch-manager/manage-users/dentists',
        icon: FaUserMd,
    },
    {
        key: 'secretaries',
        label: 'Secretaries',
        description: 'Review secretary accounts, access, and branch coverage.',
        path: '/branch-manager/manage-users/secretaries',
        icon: FaUserNurse,
    },
];

export default function BranchManagerManageUsers() {
    const navigate = useNavigate();

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>User Management</h1>
                    <p className={styles.subtitle}>
                        Manage branch staff accounts from one shared hub before opening the detailed tables.
                    </p>
                </div>
            </header>

            <section className={styles.grid}>
                {USER_SECTIONS.map((section) => {
                    const Icon = section.icon;
                    return (
                        <button
                            key={section.key}
                            type="button"
                            className={styles.card}
                            onClick={() => navigate(section.path)}
                        >
                            <span className={styles.cardIcon}>
                                <Icon />
                            </span>
                            <span className={styles.cardContent}>
                                <span className={styles.cardTitle}>{section.label}</span>
                                <span className={styles.cardDescription}>{section.description}</span>
                            </span>
                            <span className={styles.cardArrow}>
                                <FaArrowRight />
                            </span>
                        </button>
                    );
                })}
            </section>
        </div>
    );
}
