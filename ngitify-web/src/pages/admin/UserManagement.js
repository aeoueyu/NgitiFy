import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArchive, FaArrowRight, FaUserMd, FaUserNurse, FaUsers, FaUserTie } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import UserTabs from './UserTabs';
import styles from '../../styles/admin/UserManagement.module.css';
import {
    countAccountsByLifecycle,
    getAccountLifecycleKey,
} from '../../utils/accountStatus';
import { readUserListResponse } from '../../utils/userListResponse';

const buildSections = (role) => {
    if (role === 'branch-manager') {
        return [
            {
                key: 'dentist',
                label: 'Dentists',
                description: 'Manage dentists assigned to your branch and resolve activation issues quickly.',
                path: '/branch-manager/manage-staffs/dentists',
                icon: FaUserMd,
            },
            {
                key: 'secretary',
                label: 'Secretaries',
                description: 'Review front-desk accounts, branch coverage, and pending activation follow-ups.',
                path: '/branch-manager/manage-staffs/secretaries',
                icon: FaUserNurse,
            },
        ];
    }

    if (role === 'owner') {
        return [
            {
                key: 'dentist',
                label: 'Dentists',
                description: 'Review dentist availability, branch assignments, and activation status from one place.',
                path: '/owner/manage-staffs/dentists',
                icon: FaUserMd,
            },
            {
                key: 'secretary',
                label: 'Secretaries',
                description: 'Manage front-desk accounts and catch unverified users before they block daily operations.',
                path: '/owner/manage-staffs/secretaries',
                icon: FaUserNurse,
            },
            {
                key: 'branch-manager',
                label: 'Branch Managers',
                description: 'Track branch manager coverage and branch-level ownership without opening each table first.',
                path: '/owner/manage-staffs/branch-managers',
                icon: FaUsers,
            },
        ];
    }

    return [
        {
            key: 'dentist',
            label: 'Dentists',
            description: 'Manage dentists, assigned branches, and account availability.',
            path: '/admin/manage-staffs/dentists',
            icon: FaUserMd,
        },
        {
            key: 'secretary',
            label: 'Secretaries',
            description: 'Review secretary accounts, access, and branch coverage.',
            path: '/admin/manage-staffs/secretaries',
            icon: FaUserNurse,
        },
        {
            key: 'branch-manager',
            label: 'Branch Managers',
            description: 'Handle branch manager access and branch assignment records.',
            path: '/admin/manage-staffs/branch-managers',
            icon: FaUsers,
        },
        {
            key: 'owner',
            label: 'Owners',
            description: 'Maintain owner accounts and high-level visibility roles.',
            path: '/admin/manage-staffs/owners',
            icon: FaUserTie,
        },
    ];
};

export default function UserManagement() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [sectionCounts, setSectionCounts] = useState({});
    const [isLoadingCounts, setIsLoadingCounts] = useState(true);
    const [archiveSummary, setArchiveSummary] = useState({ total: 0, patients: 0, staff: 0 });

    const sections = useMemo(() => buildSections(user?.role), [user?.role]);
    const isBranchManager = user?.role === 'branch-manager';
    const roleLabel = isBranchManager ? 'branch staff' : 'staff accounts';

    useEffect(() => {
        let isCancelled = false;

        const fetchSectionCounts = async () => {
            setIsLoadingCounts(true);

            try {
                const responses = await Promise.all(
                    sections.map(async (section) => {
                        const response = await authFetch(`/users?role=${section.key}&includeArchived=true`);
                        if (!response.ok) {
                            return [section.key, { total: 0, pending: 0, active: 0 }];
                        }

                        const { users } = await readUserListResponse(response);
                        const records = users
                            .map((entry) => ({
                                rawStatus: entry.status || 'inactive',
                                isVerified: entry.isVerified,
                                isArchived: Boolean(entry.isArchived),
                            }));

                        return [section.key, {
                            total: records.length,
                            pending: countAccountsByLifecycle(records, 'needsActivation'),
                            active: countAccountsByLifecycle(records, 'active'),
                            lifecycle: records.reduce((acc, account) => {
                                const key = getAccountLifecycleKey(account);
                                acc[key] = (acc[key] || 0) + 1;
                                return acc;
                            }, {}),
                        }];
                    })
                );

                if (!isCancelled) {
                    setSectionCounts(Object.fromEntries(responses));
                }

                if (user?.role === 'administrator') {
                    const archivedResponse = await authFetch('/users?archivedOnly=true');
                    if (archivedResponse.ok) {
                        const archivedRecords = await archivedResponse.json();
                        const archivedList = Array.isArray(archivedRecords) ? archivedRecords : [];
                        if (!isCancelled) {
                            setArchiveSummary({
                                total: archivedList.length,
                                patients: archivedList.filter((entry) => entry.role === 'patient').length,
                                staff: archivedList.filter((entry) => entry.role !== 'patient').length,
                            });
                        }
                    }
                }
            } catch (error) {
                if (!isCancelled) {
                    setSectionCounts({});
                }
                console.error('Failed to load user management counts:', error);
            } finally {
                if (!isCancelled) {
                    setIsLoadingCounts(false);
                }
            }
        };

        fetchSectionCounts();

        return () => {
            isCancelled = true;
        };
    }, [sections, user?.role]);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>User Management</h1>
                    <p className={styles.subtitle}>
                        Start from one shared hub, check who still needs activation, then open the detailed table only when you need it.
                    </p>
                </div>
            </header>

            {!isBranchManager && <UserTabs activeTab="" />}

            <section
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: '12px',
                    marginTop: '4px',
                }}
            >
                <div style={{ padding: '16px 18px', borderRadius: '18px', background: '#f8fbff', border: '1px solid #dbe6f1' }}>
                    <strong style={{ display: 'block', color: '#123e63', marginBottom: '6px' }}>Quick flow</strong>
                    <span style={{ color: '#5f7384', fontSize: '13px', lineHeight: 1.5 }}>
                        Open the role table with the most pending follow-up first, especially accounts waiting for activation.
                    </span>
                </div>
                <div style={{ padding: '16px 18px', borderRadius: '18px', background: '#fffaf0', border: '1px solid #f4d8a5' }}>
                    <strong style={{ display: 'block', color: '#8a5b00', marginBottom: '6px' }}>Visible scope</strong>
                    <span style={{ color: '#7a5b20', fontSize: '13px', lineHeight: 1.5 }}>
                        {isBranchManager ? 'Only your branch staff appears here.' : `All ${roleLabel} are available from this hub.`}
                    </span>
                </div>
            </section>

            {user?.role === 'administrator' && (
                <section
                    style={{
                        marginTop: '14px',
                        marginBottom: '8px',
                        padding: '18px 20px',
                        borderRadius: '20px',
                        border: '1px solid #dbe6f1',
                        background: 'linear-gradient(180deg, #fbfdff 0%, #f7fbff 100%)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <div>
                        <strong style={{ display: 'block', color: '#123e63', marginBottom: '6px' }}>Archive review</strong>
                        <span style={{ color: '#5f7384', fontSize: '13px', lineHeight: 1.5 }}>
                            Review archived users and patients in one queue before restoring access or approving any permanent deletion.
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: '28px', padding: '0 10px', borderRadius: '999px', background: '#ebf5fc', color: '#0f5d92', fontSize: '12px', fontWeight: 800 }}>
                                {archiveSummary.total} archived total
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: '28px', padding: '0 10px', borderRadius: '999px', background: '#fff3d6', color: '#b66a12', fontSize: '12px', fontWeight: 800 }}>
                                {archiveSummary.patients} patients
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: '28px', padding: '0 10px', borderRadius: '999px', background: '#dcfce7', color: '#166534', fontSize: '12px', fontWeight: 800 }}>
                                {archiveSummary.staff} staff
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/archive-review')}
                        style={{
                            border: 'none',
                            borderRadius: '999px',
                            background: '#01538b',
                            color: '#ffffff',
                            minHeight: '42px',
                            padding: '0 18px',
                            font: 'inherit',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <FaArchive /> Open Archive Review
                    </button>
                </section>
            )}

            <section className={styles.grid}>
                {sections.map((section) => {
                    const Icon = section.icon;
                    const countData = sectionCounts[section.key];
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
                                <span
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '8px',
                                        marginTop: '8px',
                                    }}
                                >
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            minHeight: '28px',
                                            padding: '0 10px',
                                            borderRadius: '999px',
                                            background: '#ebf5fc',
                                            color: '#0f5d92',
                                            fontSize: '12px',
                                            fontWeight: 800,
                                        }}
                                    >
                                        {isLoadingCounts ? 'Loading...' : `${countData?.total || 0} accounts`}
                                    </span>
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            minHeight: '28px',
                                            padding: '0 10px',
                                            borderRadius: '999px',
                                            background: '#fff3d6',
                                            color: '#b66a12',
                                            fontSize: '12px',
                                            fontWeight: 800,
                                        }}
                                    >
                                        {isLoadingCounts ? 'Checking...' : `${countData?.pending || 0} pending activation`}
                                    </span>
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            minHeight: '28px',
                                            padding: '0 10px',
                                            borderRadius: '999px',
                                            background: '#f1f5f9',
                                            color: '#475569',
                                            fontSize: '12px',
                                            fontWeight: 800,
                                        }}
                                    >
                                        {isLoadingCounts ? 'Checking...' : `${countData?.lifecycle?.inactive || 0} inactive`}
                                    </span>
                                    <span
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            minHeight: '28px',
                                            padding: '0 10px',
                                            borderRadius: '999px',
                                            background: '#ffe4e6',
                                            color: '#be123c',
                                            fontSize: '12px',
                                            fontWeight: 800,
                                        }}
                                    >
                                        {isLoadingCounts ? 'Checking...' : `${countData?.lifecycle?.archived || 0} archived`}
                                    </span>
                                </span>
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
