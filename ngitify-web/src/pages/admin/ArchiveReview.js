import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FaShieldAlt,
    FaSyncAlt,
    FaTrashAlt,
    FaUndo,
} from 'react-icons/fa';

import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { getArchiveRetentionInfo, formatLifecycleDateTime } from '../../utils/lifecycleHistory';
import LifecycleActionModal from '../../components/common/LifecycleActionModal';
import scheduleStyles from '../../styles/shared/SchedulePage.module.css';
import wideTable from '../../styles/wideTable.module.css';
import styles from '../../styles/admin/ArchiveReview.module.css';

const ROLE_LABELS = {
    patient: 'Patient',
    dentist: 'Dentist',
    secretary: 'Secretary',
    'branch-manager': 'Branch Manager',
    owner: 'Owner',
    administrator: 'Administrator',
};

const getDisplayName = (record = {}) => {
    const first = String(record?.name?.first || record?.firstName || '').trim();
    const last = String(record?.name?.last || record?.lastName || '').trim();
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    return fullName || String(record?.email || '').trim() || 'Unknown User';
};

const buildRecordEntry = (record = {}, impact = null) => {
    const retention = getArchiveRetentionInfo(record);
    const role = String(record?.role || '').trim().toLowerCase();
    const blockerList = Array.isArray(impact?.blockers) ? impact.blockers : [];
    let reviewState = 'blocked';

    if (!record?.isArchived) {
        reviewState = 'blocked';
    } else if (!retention.isRetentionSatisfied) {
        reviewState = 'retention';
    } else if (impact?.allowed) {
        reviewState = 'ready';
    }

    return {
        id: String(record?._id || ''),
        name: getDisplayName(record),
        email: String(record?.email || '').trim(),
        role,
        roleLabel: ROLE_LABELS[role] || role || 'User',
        scope: role === 'patient' ? 'patient' : 'user',
        entityType: role === 'patient' ? 'patient' : 'staff',
        archivedAt: record?.archivedAt || null,
        archiveReason: String(record?.archiveReason || '').trim(),
        retention,
        impact,
        blockerList,
        reviewState,
        reviewLabel: reviewState === 'ready'
            ? 'Ready for delete review'
            : reviewState === 'retention'
                ? retention.statusLabel
                : blockerList[0] || 'Additional cleanup is still required.',
    };
};

export default function ArchiveReview() {
    const { addToast } = useToast();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [reviewFilter, setReviewFilter] = useState('all');
    const [lifecycleConfig, setLifecycleConfig] = useState(null);

    const loadArchivedRecords = useCallback(async ({ silent = false } = {}) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const response = await authFetch('/users?archivedOnly=true');
            if (!response.ok) {
                addToast('Failed to load archived records.', 'error');
                return;
            }

            const archivedUsers = await response.json();
            const rows = Array.isArray(archivedUsers) ? archivedUsers.filter((entry) => entry?.isArchived) : [];

            const impacts = await Promise.all(rows.map(async (record) => {
                try {
                    const scope = record.role === 'patient' ? 'patient' : 'user';
                    const res = await authFetch(`/${scope}/lifecycle-impact/${record._id}?action=delete`);
                    const data = await res.json().catch(() => ({}));
                    return [String(record._id), res.ok ? data : null];
                } catch (error) {
                    console.error('Failed to load archive review impact:', error);
                    return [String(record._id), null];
                }
            }));

            const impactMap = Object.fromEntries(impacts);
            const nextRecords = rows
                .map((record) => buildRecordEntry(record, impactMap[String(record._id)]))
                .sort((left, right) => new Date(right.archivedAt || 0) - new Date(left.archivedAt || 0));

            setRecords(nextRecords);
            if (silent) {
                addToast('Archive review refreshed.', 'success');
            }
        } catch (error) {
            console.error('Error loading archive review:', error);
            addToast('Network error loading archive review.', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadArchivedRecords();
    }, [loadArchivedRecords]);

    const filteredRecords = useMemo(() => records.filter((record) => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const matchesSearch = !normalizedQuery
            || record.name.toLowerCase().includes(normalizedQuery)
            || record.email.toLowerCase().includes(normalizedQuery)
            || record.archiveReason.toLowerCase().includes(normalizedQuery)
            || record.roleLabel.toLowerCase().includes(normalizedQuery);

        const matchesRole = roleFilter === 'all'
            || (roleFilter === 'patient' && record.role === 'patient')
            || (roleFilter === 'staff' && record.role !== 'patient')
            || record.role === roleFilter;

        const matchesReview = reviewFilter === 'all' || record.reviewState === reviewFilter;
        return matchesSearch && matchesRole && matchesReview;
    }), [records, reviewFilter, roleFilter, searchQuery]);

    const summary = useMemo(() => ({
        total: records.length,
        ready: records.filter((record) => record.reviewState === 'ready').length,
        retention: records.filter((record) => record.reviewState === 'retention').length,
        blocked: records.filter((record) => record.reviewState === 'blocked').length,
    }), [records]);

    const openDeleteReview = (record) => {
        setLifecycleConfig({
            scope: record.scope,
            entityType: record.entityType,
            targetId: record.id,
            action: 'delete',
            title: 'Permanent Delete Review',
            message: `Review the permanent deletion blockers for ${record.name}. Delete should stay exceptional and should only happen after archive retention and linked-record cleanup are complete.`,
            subjectName: record.name,
            confirmText: 'Permanently Delete',
            isDestructive: true,
            onConfirm: () => handleDelete(record),
        });
    };

    const openRestore = (record) => {
        setLifecycleConfig({
            scope: record.scope,
            entityType: record.entityType,
            targetId: record.id,
            action: 'restore',
            title: 'Restore Archived Record',
            message: `Restore ${record.name} from archive? The record will return as inactive so the team can review it before reactivating access.`,
            subjectName: record.name,
            confirmText: 'Restore Record',
            isDestructive: false,
            onConfirm: () => handleRestore(record),
        });
    };

    const handleRestore = async (record) => {
        try {
            const endpoint = `${record.scope === 'patient' ? '/patient' : '/user'}/archive/${record.id}`;
            const response = await authFetch(endpoint, {
                method: 'PUT',
                body: JSON.stringify({ isArchived: false }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                addToast(data.message || 'Failed to restore record.', 'error');
                return;
            }

            setRecords((prev) => prev.filter((entry) => entry.id !== record.id));
            setLifecycleConfig(null);
            addToast(`${record.name} was restored from archive.`, 'success');
        } catch (error) {
            console.error('Restore error:', error);
            addToast('Network error restoring archived record.', 'error');
        }
    };

    const handleDelete = async (record) => {
        try {
            const response = await authFetch(`/users/${record.id}`, { method: 'DELETE' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                addToast(data.message || 'Permanent deletion failed.', 'error');
                return;
            }

            setRecords((prev) => prev.filter((entry) => entry.id !== record.id));
            setLifecycleConfig(null);
            addToast(`${record.name} was permanently deleted.`, 'success');
        } catch (error) {
            console.error('Delete error:', error);
            addToast('Network error deleting archived record.', 'error');
        }
    };

    return (
        <div className={scheduleStyles.page}>
            <div className={scheduleStyles.headerRow}>
                <div>
                    <h1 className={scheduleStyles.pageTitle}>Archive Review</h1>
                    <p className={scheduleStyles.pageSubtitle}>
                        Restore archived patient and staff records, monitor retention, and review permanent deletion blockers from one admin-only queue.
                    </p>
                </div>
                <button
                    type="button"
                    className={scheduleStyles.secondaryButton}
                    onClick={() => loadArchivedRecords({ silent: true })}
                    disabled={refreshing}
                >
                    {refreshing ? <FaSyncAlt /> : <FaShieldAlt />}
                    {refreshing ? 'Refreshing...' : 'Refresh Review'}
                </button>
            </div>

            <section className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Archived Records</span>
                    <span className={styles.summaryValue}>{summary.total}</span>
                    <p className={styles.summaryMeta}>All archived patient and staff records currently waiting for review.</p>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Ready For Delete Review</span>
                    <span className={styles.summaryValue}>{summary.ready}</span>
                    <p className={styles.summaryMeta}>Retention is satisfied and no current delete blockers were found.</p>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Still In Retention</span>
                    <span className={styles.summaryValue}>{summary.retention}</span>
                    <p className={styles.summaryMeta}>These records must stay archived longer before any permanent delete review.</p>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Blocked By History</span>
                    <span className={styles.summaryValue}>{summary.blocked}</span>
                    <p className={styles.summaryMeta}>These records still have linked history or other blockers that must be preserved.</p>
                </div>
            </section>

            <section className={styles.toolbarCard}>
                <div className={styles.filterRow}>
                    <div className={scheduleStyles.searchWrapper} style={{ minWidth: '280px', flex: '1 1 280px' }}>
                        <input
                            className={scheduleStyles.searchInput}
                            type="text"
                            placeholder="Search by name, email, role, or archive reason..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>

                    <select className={styles.selectField} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                        <option value="all">All Roles</option>
                        <option value="patient">Patients</option>
                        <option value="staff">All Staff</option>
                        <option value="dentist">Dentists</option>
                        <option value="secretary">Secretaries</option>
                        <option value="branch-manager">Branch Managers</option>
                        <option value="owner">Owners</option>
                    </select>

                    <select className={styles.selectField} value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>
                        <option value="all">All Review States</option>
                        <option value="ready">Ready To Delete</option>
                        <option value="retention">Waiting Retention</option>
                        <option value="blocked">Blocked By History</option>
                    </select>
                </div>
            </section>

            <div className={scheduleStyles.tableSection}>
                <table className={wideTable.table}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Archived On</th>
                            <th>Archive Reason</th>
                            <th>Retention</th>
                            <th>Delete Review</th>
                            <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                                    Loading archive review...
                                </td>
                            </tr>
                        ) : filteredRecords.length > 0 ? (
                            filteredRecords.map((record) => (
                                <tr key={record.id}>
                                    <td>
                                        <div style={{ display: 'grid', gap: '4px' }}>
                                            <strong>{record.name}</strong>
                                            <span className={styles.mutedText}>{record.email || 'No email on file'}</span>
                                        </div>
                                    </td>
                                    <td><span className={styles.neutralBadge}>{record.roleLabel}</span></td>
                                    <td>
                                        <div style={{ display: 'grid', gap: '4px' }}>
                                            <span>{formatLifecycleDateTime(record.archivedAt)}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.reasonText}>
                                            {record.archiveReason || 'No archive reason recorded.'}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={record.retention.isRetentionSatisfied ? styles.successBadge : styles.warningBadge}>
                                            {record.retention.statusLabel}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'grid', gap: '6px' }}>
                                            <span className={
                                                record.reviewState === 'ready'
                                                    ? styles.successBadge
                                                    : record.reviewState === 'retention'
                                                        ? styles.warningBadge
                                                        : styles.dangerBadge
                                            }>
                                                {record.reviewState === 'ready'
                                                    ? 'Ready'
                                                    : record.reviewState === 'retention'
                                                        ? 'Retention'
                                                        : 'Blocked'}
                                            </span>
                                            <span className={styles.mutedText}>{record.reviewLabel}</span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={styles.actionRow}>
                                            <button
                                                type="button"
                                                className={styles.actionButton}
                                                onClick={() => openRestore(record)}
                                                title="Restore archived record"
                                            >
                                                <FaUndo /> Restore
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.dangerActionButton}
                                                onClick={() => openDeleteReview(record)}
                                                title="Review permanent delete blockers"
                                            >
                                                <FaTrashAlt /> Delete Review
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                                    No archived records matched the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <LifecycleActionModal
                isOpen={!!lifecycleConfig}
                scope={lifecycleConfig?.scope}
                entityType={lifecycleConfig?.entityType}
                targetId={lifecycleConfig?.targetId}
                action={lifecycleConfig?.action}
                title={lifecycleConfig?.title}
                message={lifecycleConfig?.message}
                subjectName={lifecycleConfig?.subjectName}
                confirmText={lifecycleConfig?.confirmText}
                isDestructive={lifecycleConfig?.isDestructive}
                onConfirm={lifecycleConfig?.onConfirm}
                onCancel={() => setLifecycleConfig(null)}
            />
        </div>
    );
}
