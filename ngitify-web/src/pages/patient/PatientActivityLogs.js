import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaClock, FaHistory } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { PatientEmptyState, PatientPageFrame, PatientSectionHeader } from '../../components/patient/PatientFrame';
import PatientIcon from '../../components/patient/PatientIcon';
import styles from '../../styles/patient/PatientPortal.module.css';

const PAGE_SIZE = 10;

const getActionIconName = (action = '') => {
    const normalized = action.toUpperCase();
    if (normalized === 'LOGIN') return 'lock-closed-outline';
    if (normalized === 'LOGOUT') return 'ban-outline';
    if (normalized.includes('APPOINTMENT')) return 'calendar-outline';
    if (normalized.includes('TREATMENT')) return 'tooth-outline';
    if (normalized.includes('RADIOGRAPH')) return 'bone';
    if (normalized.includes('PROFILE') || normalized.includes('UPDATE')) return 'person-outline';
    if (normalized.includes('PASSWORD')) return 'lock-closed-outline';
    if (normalized.includes('TICKET') || normalized.includes('INQUIRY')) return 'chatbubble-outline';
    if (normalized.includes('NOTIFICATION')) return 'notifications-outline';
    return 'document-text-outline';
};

const formatTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

const formatActionLabel = (action = '') => action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function PatientActivityLogs() {
    const [logs, setLogs] = useState([]);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchLogs = useCallback(async () => {
        try {
            setError('');
            const response = await authFetch('/activity-logs/patient');
            if (!response.ok) {
                throw new Error('Could not load activity logs.');
            }
            const payload = await response.json();
            const safeLogs = Array.isArray(payload) ? payload : [];
            setLogs(safeLogs);
            setVisibleCount(PAGE_SIZE);
        } catch {
            setLogs([]);
            setError('Could not load activity logs. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const visibleLogs = useMemo(() => logs.slice(0, visibleCount), [logs, visibleCount]);
    const hasMore = visibleLogs.length < logs.length;

    return (
        <PatientPageFrame
            title="Activity Logs"
            subtitle="A read-only timeline of your patient account actions across the web and mobile experience."
        >
            <PatientSectionHeader
                eyebrow="Timeline"
                title={logs.length ? `${logs.length} total record${logs.length === 1 ? '' : 's'}` : 'No activity yet'}
                description="Newest first. These logs help you review recent logins, booking requests, profile edits, and other in-app actions."
            />

            {loading ? (
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Loading activity logs...</span>
                </div>
            ) : error ? (
                <PatientEmptyState
                    icon={<FaHistory />}
                    title="Could not load activity logs"
                    message={error}
                    action={(
                        <button type="button" className={styles.buttonSecondary} onClick={fetchLogs}>
                            Try Again
                        </button>
                    )}
                />
            ) : visibleLogs.length ? (
                <>
                    <div className={styles.timelineCard}>
                        <div className={styles.timeline}>
                            {visibleLogs.map((item, index) => (
                                <div key={item._id || `${item.action}-${index}`} className={styles.timelineItem}>
                                    <span className={styles.toolIcon} style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                                        <PatientIcon name={getActionIconName(item.action)} />
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <h3 className={styles.timelineTitle}>{formatActionLabel(item.action)}</h3>
                                        <p className={styles.timelineMeta}>{formatTimestamp(item.timestamp)}</p>
                                        <p className={styles.timelineText}>{item.details || 'No additional details recorded.'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {hasMore ? (
                        <div style={{ marginTop: '18px' }}>
                            <button type="button" className={styles.buttonSecondary} onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                                Load More ({logs.length - visibleCount} remaining)
                            </button>
                        </div>
                    ) : null}
                </>
            ) : (
                <PatientEmptyState
                    icon={<FaClock />}
                    title="No activity yet"
                    message="Your logins, appointment actions, EMR views, support requests, and other patient activity will appear here automatically."
                />
            )}
        </PatientPageFrame>
    );
}

