import React, { useCallback, useState } from 'react';
import {
    FaCheckCircle,
    FaChevronDown,
    FaChevronUp,
    FaExclamationTriangle,
    FaInfoCircle,
    FaPlay,
    FaShieldAlt,
    FaSyncAlt,
    FaTimesCircle,
    FaWrench,
} from 'react-icons/fa';

import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import styles from '../../styles/admin/IntegrityTools.module.css';
import tblStyles from '../../styles/wideTable.module.css';

const GROUP_ORDER = ['Appointments', 'Patients', 'Branches', 'Inventory', 'Support', 'Security'];

const STATUS_META = {
    pass: { label: 'Pass', icon: FaCheckCircle, color: '#16a34a', bg: '#dcfce7' },
    warn: { label: 'Warning', icon: FaExclamationTriangle, color: '#d97706', bg: '#fffbeb' },
    fail: { label: 'Failed', icon: FaTimesCircle, color: '#dc2626', bg: '#fee2e2' },
};

const FIX_MODE_META = {
    safe: { label: 'Safe Auto-Fix', icon: FaWrench, className: styles.safeTag },
    manual: { label: 'Manual Review', icon: FaInfoCircle, className: styles.manualTag },
};

const normalizeText = (value) => String(value || '').trim();

const formatDate = (value, includeTime = false) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';

    return parsed.toLocaleString('en-PH', includeTime
        ? {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }
        : {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
};

const summarizeChecks = (checks = [], ranAt = new Date()) => ({
    total: checks.length,
    issues: checks.reduce((total, check) => total + (check.count || 0), 0),
    passed: checks.filter((check) => check.status === 'pass').length,
    warnings: checks.filter((check) => check.status === 'warn').length,
    failed: checks.filter((check) => check.status === 'fail').length,
    ranAt,
});

const sortChecks = (checks = []) => (
    [...checks].sort((left, right) => {
        const groupDiff = GROUP_ORDER.indexOf(left.category) - GROUP_ORDER.indexOf(right.category);
        if (groupDiff !== 0) return groupDiff;
        return left.label.localeCompare(right.label);
    })
);

const renderTagList = (items, className = styles.issueTag) => {
    const values = Array.isArray(items)
        ? items.map((item) => normalizeText(item)).filter(Boolean)
        : [];

    if (values.length === 0) {
        return <span className={styles.mutedText}>-</span>;
    }

    return (
        <div className={styles.tagList}>
            {values.map((item, index) => (
                <span key={`${item}-${index}`} className={className}>
                    {item}
                </span>
            ))}
        </div>
    );
};

const renderMonoList = (items) => {
    const values = Array.isArray(items)
        ? items.map((item) => normalizeText(item)).filter(Boolean)
        : [];

    if (values.length === 0) {
        return <span className={styles.mutedText}>-</span>;
    }

    return (
        <div className={styles.stackedMono}>
            {values.map((item, index) => (
                <span key={`${item}-${index}`} className={styles.monoCell}>
                    {item}
                </span>
            ))}
        </div>
    );
};

const renderPill = (value, className = styles.neutralTag) => {
    const text = normalizeText(value);
    return text ? <span className={className}>{text}</span> : <span className={styles.mutedText}>-</span>;
};

const CHECK_TABLES = {
    orphaned_surgeries: [
        { key: 'id', label: 'Appointment ID', render: (value) => <span className={styles.monoCell}>{value}</span> },
        { key: 'branch', label: 'Branch' },
        { key: 'procedure', label: 'Procedure' },
        { key: 'date', label: 'Date', render: (value) => formatDate(value) },
        { key: 'issueTypes', label: 'Issues', render: (value) => renderTagList(value) },
    ],
    queue_appointment_mismatches: [
        { key: 'queueId', label: 'Queue ID', render: (value) => <span className={styles.monoCell}>{value}</span> },
        { key: 'linkedAppointment', label: 'Appointment ID', render: (value) => <span className={styles.monoCell}>{value || '-'}</span> },
        { key: 'patientName', label: 'Patient' },
        { key: 'branch', label: 'Queue Branch' },
        { key: 'appointmentBranch', label: 'Appointment Branch' },
        { key: 'queueStatus', label: 'Queue Status', render: (value) => renderPill(value) },
        { key: 'appointmentStatus', label: 'Appointment Status', render: (value) => renderPill(value, styles.goodTag) },
        { key: 'source', label: 'Source' },
        { key: 'issueTypes', label: 'Issues', render: (value) => renderTagList(value) },
    ],
    unverified_users: [
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (value) => <span className={styles.rolePill}>{value}</span> },
        { key: 'status', label: 'Status', render: (value) => renderPill(value) },
        { key: 'createdAt', label: 'Created At', render: (value) => formatDate(value) },
    ],
    duplicate_emails: [
        { key: 'email', label: 'Email' },
        { key: 'count', label: 'Count', render: (value) => <span className={styles.issueTag}>{value}x</span> },
        { key: 'ids', label: 'User IDs', render: (value) => renderMonoList(value) },
    ],
    normalized_email_collisions: [
        { key: 'normalizedEmail', label: 'Normalized Email' },
        { key: 'count', label: 'Count', render: (value) => <span className={styles.issueTag}>{value}x</span> },
        { key: 'variants', label: 'Stored Variants', render: (value) => renderTagList(value, styles.neutralTag) },
        { key: 'ids', label: 'User IDs', render: (value) => renderMonoList(value) },
    ],
    expired_temp_passwords: [
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (value) => <span className={styles.rolePill}>{value}</span> },
        { key: 'createdAt', label: 'Created At', render: (value) => formatDate(value) },
        { key: 'temporaryPasswordExpires', label: 'Expired At', render: (value) => formatDate(value, true) },
    ],
    patient_branch_assignment_issues: [
        { key: 'patientName', label: 'Patient' },
        { key: 'email', label: 'Email' },
        { key: 'assignedBranch', label: 'Primary Branch' },
        { key: 'assignedBranches', label: 'Branch Array', render: (value) => renderTagList(value, styles.neutralTag) },
        { key: 'invalidBranches', label: 'Unknown Branches', render: (value) => renderTagList(value) },
        { key: 'issueTypes', label: 'Issues', render: (value) => renderTagList(value) },
    ],
    assigned_dentist_mismatches: [
        { key: 'patientName', label: 'Patient' },
        { key: 'email', label: 'Email' },
        { key: 'assignedDentistName', label: 'Stored Dentist' },
        { key: 'expectedDentistName', label: 'Expected Dentist' },
        { key: 'assignedDentistId', label: 'Dentist ID', render: (value) => <span className={styles.monoCell}>{value || '-'}</span> },
        { key: 'issueTypes', label: 'Issues', render: (value) => renderTagList(value) },
    ],
    branch_staff_mismatches: [
        { key: 'recordType', label: 'Scope', render: (value) => renderPill(value) },
        { key: 'branchName', label: 'Branch' },
        { key: 'managerName', label: 'Manager' },
        { key: 'linkedManagerName', label: 'Linked Manager' },
        { key: 'email', label: 'Email' },
        { key: 'managerAssignedBranch', label: 'Assigned Branch' },
        { key: 'managerId', label: 'Manager ID', render: (value) => <span className={styles.monoCell}>{value || '-'}</span> },
        { key: 'linkedManagerId', label: 'Linked ID', render: (value) => <span className={styles.monoCell}>{value || '-'}</span> },
        { key: 'issueTypes', label: 'Issues', render: (value) => renderTagList(value) },
    ],
    inventory_batch_issues: [
        { key: 'itemName', label: 'Item' },
        { key: 'batchNumber', label: 'Batch No.' },
        { key: 'branch', label: 'Batch Branch' },
        { key: 'itemBranch', label: 'Item Branch' },
        { key: 'quantityReceived', label: 'Received' },
        { key: 'quantityRemaining', label: 'Remaining' },
        { key: 'status', label: 'Current Status', render: (value) => renderPill(value) },
        { key: 'expectedStatus', label: 'Expected Status', render: (value) => renderPill(value, styles.goodTag) },
        { key: 'expirationDate', label: 'Expiration', render: (value) => formatDate(value) },
        { key: 'issueTypes', label: 'Issues', render: (value) => renderTagList(value) },
    ],
    support_ticket_integrity: [
        { key: 'subject', label: 'Subject' },
        { key: 'patientName', label: 'Patient' },
        { key: 'patientEmail', label: 'Patient Email' },
        { key: 'status', label: 'Status', render: (value) => renderPill(value) },
        { key: 'assignedToName', label: 'Assignee' },
        { key: 'messageCount', label: 'Messages' },
        { key: 'resolvedAt', label: 'Resolved At', render: (value) => formatDate(value, true) },
        { key: 'closedAt', label: 'Closed At', render: (value) => formatDate(value, true) },
        { key: 'issueTypes', label: 'Issues', render: (value) => renderTagList(value) },
    ],
};

function RecordsTable({ check }) {
    const { records, checkName } = check;
    if (!records || records.length === 0) return null;

    const columns = CHECK_TABLES[checkName] || Object.keys(records[0] || {}).map((key) => ({
        key,
        label: key,
    }));

    return (
        <table className={`${styles.recordTable} ${tblStyles.table}`}>
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {records.map((record, index) => (
                    <tr key={record.id || record._id || record.ticketId || record.queueId || record.batchId || record.patientId || `${checkName}-${index}`}>
                        {columns.map((column) => {
                            const value = record[column.key];
                            const content = column.render
                                ? column.render(value, record)
                                : (normalizeText(value) || <span className={styles.mutedText}>-</span>);

                            return <td key={column.key}>{content}</td>;
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function CheckCard({ check, onFix, onRun, fixing, running, runningAll }) {
    const [expanded, setExpanded] = useState(false);
    const meta = STATUS_META[check.status] || STATUS_META.warn;
    const fixMeta = FIX_MODE_META[check.fixMode] || FIX_MODE_META.manual;
    const StatusIcon = meta.icon;
    const FixIcon = fixMeta.icon;
    const hasIssues = check.count > 0;
    const canFix = check.fixMode === 'safe';
    const busy = running === check.checkName;

    return (
        <div className={styles.checkCard} style={{ borderLeftColor: meta.color }}>
            <div className={styles.checkHeader}>
                <div className={styles.checkLeft}>
                    <span className={styles.statusIcon} style={{ color: meta.color }}>
                        <StatusIcon />
                    </span>
                    <div>
                        <h3 className={styles.checkLabel}>{check.label}</h3>
                        <p className={styles.checkDesc}>{check.description}</p>
                    </div>
                </div>

                <div className={styles.checkRight}>
                    <span className={styles.countBadge} style={{ background: meta.bg, color: meta.color }}>
                        {check.count === 0 ? 'No issues' : `${check.count} issue${check.count !== 1 ? 's' : ''}`}
                    </span>

                    <span className={styles.statusPill} style={{ background: meta.bg, color: meta.color }}>
                        <StatusIcon style={{ fontSize: 11 }} />
                        {meta.label}
                    </span>

                    <span className={fixMeta.className}>
                        <FixIcon />
                        {fixMeta.label}
                    </span>

                    <button
                        className={styles.secondaryBtn}
                        onClick={() => onRun(check.checkName)}
                        disabled={runningAll || Boolean(fixing) || busy}
                    >
                        {busy
                            ? <><FaSyncAlt className={styles.spinning} /> Running...</>
                            : <><FaPlay /> Run This Check</>
                        }
                    </button>

                    {hasIssues && canFix && (
                        <button
                            className={styles.fixBtn}
                            onClick={() => onFix(check)}
                            disabled={runningAll || busy || fixing === check.checkName}
                        >
                            {fixing === check.checkName
                                ? <><FaSyncAlt className={styles.spinning} /> Fixing...</>
                                : <><FaWrench /> Auto-Fix</>
                            }
                        </button>
                    )}

                    {hasIssues && (
                        <button
                            className={styles.expandBtn}
                            onClick={() => setExpanded((value) => !value)}
                            title={expanded ? 'Collapse records' : 'View affected records'}
                        >
                            {expanded ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                    )}
                </div>
            </div>

            {expanded && hasIssues && (
                <div className={`${styles.recordsWrapper} ${tblStyles.tableWrapper}`}>
                    <p className={styles.recordsHint}>
                        Safe auto-fix only updates deterministic fields. Anything still listed after a fix needs manual review.
                    </p>
                    <RecordsTable check={check} />
                </div>
            )}
        </div>
    );
}

export default function IntegrityTools() {
    const { addToast } = useToast();

    const [report, setReport] = useState(null);
    const [runningAll, setRunningAll] = useState(false);
    const [runningCheck, setRunningCheck] = useState(null);
    const [fixing, setFixing] = useState(null);
    const [lastRan, setLastRan] = useState(null);

    const applyCheckToReport = useCallback((nextCheck, ranAt = new Date()) => {
        setReport((current) => {
            const mergedChecks = sortChecks([
                ...(current?.checks || []).filter((check) => check.checkName !== nextCheck.checkName),
                nextCheck,
            ]);

            return {
                summary: summarizeChecks(mergedChecks, ranAt),
                checks: mergedChecks,
            };
        });
        setLastRan(new Date(ranAt));
    }, []);

    const runSingleCheck = useCallback(async (checkName, options = {}) => {
        const { quiet = false } = options;
        setRunningCheck(checkName);

        try {
            const res = await authFetch(`/integrity/run-checks/${checkName}`);
            const data = await res.json();

            if (!res.ok) {
                addToast(data.message || 'Failed to run the selected integrity check.', 'error');
                return null;
            }

            const ranAt = new Date();
            applyCheckToReport(data.check, ranAt);

            if (!quiet) {
                if (data.check.count === 0) {
                    addToast(`${data.check.label} passed.`, 'success');
                } else if (data.check.status === 'fail') {
                    addToast(`${data.check.label} found ${data.check.count} issue${data.check.count !== 1 ? 's' : ''} that need review.`, 'error');
                } else {
                    addToast(`${data.check.label} found ${data.check.count} issue${data.check.count !== 1 ? 's' : ''}.`, 'warning');
                }
            }

            return data.check;
        } catch (error) {
            console.error('Integrity single-check error:', error);
            addToast('Network error running the selected check.', 'error');
            return null;
        } finally {
            setRunningCheck(null);
        }
    }, [addToast, applyCheckToReport]);

    const runChecks = useCallback(async () => {
        setRunningAll(true);
        setReport(null);

        try {
            const res = await authFetch('/integrity/run-checks');
            const data = await res.json();

            if (!res.ok) {
                addToast(data.message || 'Failed to run integrity checks.', 'error');
                return;
            }

            const checks = sortChecks(data.checks || []);
            const ranAt = data.summary?.ranAt ? new Date(data.summary.ranAt) : new Date();
            setReport({
                summary: summarizeChecks(checks, ranAt),
                checks,
            });
            setLastRan(ranAt);

            const summary = summarizeChecks(checks, ranAt);
            if (summary.failed > 0) {
                addToast(`${summary.failed} check${summary.failed > 1 ? 's' : ''} failed. Review the flagged records.`, 'error');
            } else if (summary.warnings > 0) {
                addToast(`${summary.warnings} warning check${summary.warnings > 1 ? 's were' : ' was'} found.`, 'warning');
            } else {
                addToast(`All ${summary.passed} integrity checks passed.`, 'success');
            }
        } catch (error) {
            console.error('Integrity run error:', error);
            addToast('Network error running integrity checks.', 'error');
        } finally {
            setRunningAll(false);
        }
    }, [addToast]);

    const handleFix = useCallback(async (check) => {
        const confirmed = window.confirm(
            `Apply the safe auto-fix for "${check.label}"?\n\nThis only updates deterministic fields. Any remaining issues will still need manual review.`
        );

        if (!confirmed) return;

        setFixing(check.checkName);
        try {
            const res = await authFetch(`/integrity/fix/${check.checkName}`, { method: 'POST' });
            const data = await res.json();

            if (!res.ok) {
                addToast(data.message || 'Auto-fix failed.', 'error');
                return;
            }

            addToast(
                `${data.result?.action || 'Fix applied'}. ${data.result?.fixed ?? 0} record(s) updated.`,
                'success'
            );

            await runSingleCheck(check.checkName, { quiet: true });
        } catch (error) {
            console.error('Integrity fix error:', error);
            addToast('Network error applying auto-fix.', 'error');
        } finally {
            setFixing(null);
        }
    }, [addToast, runSingleCheck]);

    const summary = report?.summary;
    const checksByGroup = GROUP_ORDER.map((category) => ({
        category,
        checks: (report?.checks || []).filter((check) => check.category === category),
    })).filter((group) => group.checks.length > 0);

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div>
                        <h1 className={styles.pageTitle}>Integrity Tools</h1>
                        <p className={styles.pageSubtitle}>
                            Run domain-based integrity checks, review affected records, and apply safe auto-fixes for deterministic cleanup only.
                        </p>
                    </div>
                </div>

                <button className={styles.runBtn} onClick={runChecks} disabled={runningAll}>
                    {runningAll
                        ? <><FaSyncAlt className={styles.spinning} /> Running Checks...</>
                        : <><FaSyncAlt /> Run All Checks</>
                    }
                </button>
            </div>

            <div className={styles.legendPanel}>
                <span className={styles.safeTag}>
                    <FaWrench />
                    Safe Auto-Fix
                </span>
                <span className={styles.manualTag}>
                    <FaInfoCircle />
                    Manual Review
                </span>
                <p className={styles.legendCopy}>
                    Safe fixes only touch fields where the correct value can be inferred from existing records. Conflicts, missing owners, and ambiguous links stay visible for human review.
                </p>
            </div>

            {lastRan && (
                <p className={styles.lastRan}>
                    Last checked: {formatDate(lastRan, true)}
                </p>
            )}

            {!report && !runningAll && (
                <div className={styles.idleState}>
                    <FaShieldAlt className={styles.idleIcon} />
                    <p>Run the integrity suite to scan appointments, patients, branches, inventory, support tickets, and security records.</p>
                    <p className={styles.idleHint}>
                        The report now checks orphaned appointments, queue mismatches, branch shortcuts, assigned dentists, branch manager links, inventory batches, support tickets, stale accounts, and email collisions.
                    </p>
                </div>
            )}

            {runningAll && (
                <div className={styles.runningState}>
                    <FaSyncAlt className={styles.spinning} style={{ fontSize: 32, color: '#01538b' }} />
                    <p>Scanning database relationships...</p>
                </div>
            )}

            {report && !runningAll && (
                <>
                    <div className={styles.summaryBar}>
                        <div className={styles.summaryItem}>
                            <span className={styles.summaryValue}>{summary.total}</span>
                            <span className={styles.summaryLabel}>Checks Run</span>
                        </div>
                        <div className={`${styles.summaryItem} ${styles.summaryBlue}`}>
                            <FaShieldAlt />
                            <span className={styles.summaryValue}>{summary.issues}</span>
                            <span className={styles.summaryLabel}>Issues Found</span>
                        </div>
                        <div className={`${styles.summaryItem} ${styles.summaryGreen}`}>
                            <FaCheckCircle />
                            <span className={styles.summaryValue}>{summary.passed}</span>
                            <span className={styles.summaryLabel}>Passed</span>
                        </div>
                        <div className={`${styles.summaryItem} ${styles.summaryYellow}`}>
                            <FaExclamationTriangle />
                            <span className={styles.summaryValue}>{summary.warnings}</span>
                            <span className={styles.summaryLabel}>Warnings</span>
                        </div>
                        <div className={`${styles.summaryItem} ${styles.summaryRed}`}>
                            <FaTimesCircle />
                            <span className={styles.summaryValue}>{summary.failed}</span>
                            <span className={styles.summaryLabel}>Failed</span>
                        </div>
                    </div>

                    <div className={styles.groupList}>
                        {checksByGroup.map((group) => {
                            const issueCount = group.checks.reduce((total, check) => total + check.count, 0);

                            return (
                                <section key={group.category} className={styles.groupSection}>
                                    <div className={styles.groupHeader}>
                                        <div>
                                            <h2 className={styles.groupTitle}>{group.category}</h2>
                                            <p className={styles.groupMeta}>
                                                {group.checks.length} check{group.checks.length !== 1 ? 's' : ''} in this group
                                            </p>
                                        </div>
                                        <span className={styles.groupCount}>
                                            {issueCount} issue{issueCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    <div className={styles.checkList}>
                                        {group.checks.map((check) => (
                                            <CheckCard
                                                key={check.checkName}
                                                check={check}
                                                onFix={handleFix}
                                                onRun={runSingleCheck}
                                                fixing={fixing}
                                                running={runningCheck}
                                                runningAll={runningAll}
                                            />
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
