import React, { useState, useCallback } from 'react';
import {
    FaShieldAlt, FaSyncAlt, FaCheckCircle, FaExclamationTriangle,
    FaTimesCircle, FaWrench, FaChevronDown, FaChevronUp, FaInfoCircle
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import styles from '../../styles/admin/IntegrityTools.module.css';
import tblStyles from '../../styles/wideTable.module.css';

// ── Constants ────────────────────────────────────────────────────────────────

// Maps checkName → whether auto-fix is allowed
const FIX_ALLOWED = {
    orphaned_surgeries:    true,
    unverified_users:      true,
    expired_temp_passwords: true,
    duplicate_emails:      false,   // manual review required
};

const STATUS_META = {
    pass: { label: 'Pass',    icon: FaCheckCircle,       color: '#16a34a', bg: '#dcfce7' },
    warn: { label: 'Warning', icon: FaExclamationTriangle, color: '#d97706', bg: '#fffbeb' },
    fail: { label: 'Failed',  icon: FaTimesCircle,        color: '#dc2626', bg: '#fee2e2' },
};

const formatDate = (iso) => iso
    ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

// ── Check Card ────────────────────────────────────────────────────────────────

function CheckCard({ check, onFix, fixing }) {
    const [expanded, setExpanded] = useState(false);
    const meta   = STATUS_META[check.status] || STATUS_META.warn;
    const Icon   = meta.icon;
    const canFix = FIX_ALLOWED[check.checkName];
    const hasIssues = check.count > 0;

    return (
        <div className={styles.checkCard} style={{ borderLeftColor: meta.color }}>

            {/* Card Header */}
            <div className={styles.checkHeader}>
                <div className={styles.checkLeft}>
                    <span className={styles.statusIcon} style={{ color: meta.color }}>
                        <Icon />
                    </span>
                    <div>
                        <h3 className={styles.checkLabel}>{check.label}</h3>
                        <p className={styles.checkDesc}>{check.description}</p>
                    </div>
                </div>

                <div className={styles.checkRight}>
                    {/* Issue count badge */}
                    <span
                        className={styles.countBadge}
                        style={{ background: meta.bg, color: meta.color }}
                    >
                        {check.count === 0 ? 'No issues' : `${check.count} issue${check.count !== 1 ? 's' : ''}`}
                    </span>

                    {/* Status pill */}
                    <span className={styles.statusPill} style={{ background: meta.bg, color: meta.color }}>
                        <Icon style={{ fontSize: 11 }} /> {meta.label}
                    </span>

                    {/* Fix button */}
                    {hasIssues && canFix && (
                        <button
                            className={styles.fixBtn}
                            onClick={() => onFix(check.checkName)}
                            disabled={fixing === check.checkName}
                        >
                            {fixing === check.checkName
                                ? <><FaSyncAlt className={styles.spinning} /> Fixing…</>
                                : <><FaWrench /> Auto-Fix</>
                            }
                        </button>
                    )}

                    {/* Manual review note */}
                    {hasIssues && !canFix && (
                        <span className={styles.manualTag}>
                            <FaInfoCircle /> Manual Review
                        </span>
                    )}

                    {/* Expand toggle */}
                    {hasIssues && (
                        <button
                            className={styles.expandBtn}
                            onClick={() => setExpanded(v => !v)}
                            title={expanded ? 'Collapse records' : 'View affected records'}
                        >
                            {expanded ? <FaChevronUp /> : <FaChevronDown />}
                        </button>
                    )}
                </div>
            </div>

            {/* Expanded Records Table */}
            {expanded && hasIssues && (
                <div className={`${styles.recordsWrapper} ${tblStyles.tableWrapper}`}>
                    <RecordsTable checkName={check.checkName} records={check.records} />
                </div>
            )}
        </div>
    );
}

// ── Records Table — renders differently per check type ────────────────────────

function RecordsTable({ checkName, records }) {
    if (!records || records.length === 0) return null;

    if (checkName === 'orphaned_surgeries') {
        return (
            <table className={`${styles.recordTable} ${tblStyles.table}`}>
                <thead>
                    <tr>
                        <th>Dental Treatment ID</th>
                        <th>Procedure</th>
                        <th>Date</th>
                        <th>Missing</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((r, i) => (
                        <tr key={r.id || i}>
                            <td className={styles.monoCell}>{r.id}</td>
                            <td>{r.procedure || '—'}</td>
                            <td>{formatDate(r.date)}</td>
                            <td>
                                {r.missingPatient && <span className={styles.missingTag}>Patient</span>}
                                {r.missingDentist && <span className={styles.missingTag}>Dentist</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    if (checkName === 'duplicate_emails') {
        return (
            <table className={`${styles.recordTable} ${tblStyles.table}`}>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Count</th>
                        <th>User IDs</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((r, i) => (
                        <tr key={i}>
                            <td>{r.email}</td>
                            <td>
                                <span className={styles.missingTag}>{r.count}×</span>
                            </td>
                            <td className={styles.monoCell}>
                                {(r.ids || []).join(', ')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

    // Default table for unverified_users / expired_temp_passwords
    return (
        <table className={`${styles.recordTable} ${tblStyles.table}`}>
            <thead>
                <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created At</th>
                    {checkName === 'expired_temp_passwords' && <th>Expired At</th>}
                </tr>
            </thead>
            <tbody>
                {records.map((r, i) => (
                    <tr key={r._id || i}>
                        <td>{r.email}</td>
                        <td>
                            <span className={styles.rolePill}>{r.role}</span>
                        </td>
                        <td>{formatDate(r.createdAt)}</td>
                        {checkName === 'expired_temp_passwords' && (
                            <td>{formatDate(r.temporaryPasswordExpires)}</td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function IntegrityTools() {
    const { addToast } = useToast();

    const [report, setReport]   = useState(null);   // { summary, checks }
    const [running, setRunning] = useState(false);
    const [fixing, setFixing]   = useState(null);   // checkName currently being fixed
    const [lastRan, setLastRan] = useState(null);

    // ── Run checks ────────────────────────────────────────────────────────────

    const runChecks = useCallback(async () => {
        setRunning(true);
        setReport(null);
        try {
            const res = await authFetch('/integrity/run-checks');
            if (res.ok) {
                const data = await res.json();
                setReport(data);
                setLastRan(new Date());

                const { passed, warnings, failed } = data.summary;
                if (failed > 0) {
                    addToast(`${failed} check${failed > 1 ? 's' : ''} failed. Review and fix the issues.`, 'error');
                } else if (warnings > 0) {
                    addToast(`${warnings} warning${warnings > 1 ? 's' : ''} found.`, 'warning');
                } else {
                    addToast(`All ${passed} checks passed.`, 'success');
                }
            } else {
                addToast('Failed to run integrity checks.', 'error');
            }
        } catch (err) {
            console.error('Integrity check error:', err);
            addToast('Network error running checks.', 'error');
        } finally {
            setRunning(false);
        }
    }, [addToast]);

    // ── Auto-fix ──────────────────────────────────────────────────────────────

    const handleFix = async (checkName) => {
        setFixing(checkName);
        try {
            const res = await authFetch(`/integrity/fix/${checkName}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                addToast(`Fix applied: ${data.result?.action || 'Done'}. ${data.result?.fixed ?? ''} record(s) affected.`, 'success');
                // Re-run checks to refresh the report
                runChecks();
            } else {
                addToast(data.message || 'Fix failed.', 'error');
            }
        } catch (err) {
            addToast('Network error applying fix.', 'error');
        } finally {
            setFixing(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const summary = report?.summary;

    return (
        <div className={styles.container}>

            {/* ── Page Header ──────────────────────────────────────────── */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div>
                        <h1 className={styles.pageTitle}>Integrity Tools</h1>
                        <p className={styles.pageSubtitle}>
                            Detect and fix data inconsistencies in the NgitiFy database.
                        </p>
                    </div>
                </div>
                <button
                    className={styles.runBtn}
                    onClick={runChecks}
                    disabled={running}
                >
                    {running
                        ? <><FaSyncAlt className={styles.spinning} /> Running Checks…</>
                        : <><FaSyncAlt /> Run All Checks</>
                    }
                </button>
            </div>

            {/* ── Last-ran note ─────────────────────────────────────────── */}
            {lastRan && (
                <p className={styles.lastRan}>
                    Last checked: {lastRan.toLocaleString('en-PH', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })}
                </p>
            )}

            {/* ── Idle State ───────────────────────────────────────────── */}
            {!report && !running && (
                <div className={styles.idleState}>
                    <FaShieldAlt className={styles.idleIcon} />
                    <p>Click <strong>Run All Checks</strong> to scan the database for issues.</p>
                    <p className={styles.idleHint}>
                        Checks run: orphaned appointments, stale unverified accounts,
                        duplicate emails, and expired temporary passwords.
                    </p>
                </div>
            )}

            {/* ── Running State ─────────────────────────────────────────── */}
            {running && (
                <div className={styles.runningState}>
                    <FaSyncAlt className={styles.spinning} style={{ fontSize: 32, color: '#01538b' }} />
                    <p>Scanning database…</p>
                </div>
            )}

            {/* ── Summary Bar ──────────────────────────────────────────── */}
            {report && !running && (
                <>
                    <div className={styles.summaryBar}>
                        <div className={styles.summaryItem}>
                            <span className={styles.summaryValue}>{summary.total}</span>
                            <span className={styles.summaryLabel}>Checks Run</span>
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
                        <div className={styles.summaryItem}>
                            <span className={styles.summaryValue} style={{ fontSize: 13 }}>
                                {new Date(summary.ranAt).toLocaleTimeString('en-PH', {
                                    hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                            <span className={styles.summaryLabel}>Ran At</span>
                        </div>
                    </div>

                    {/* ── Check Cards ──────────────────────────────────── */}
                    <div className={styles.checkList}>
                        {report.checks.map(check => (
                            <CheckCard
                                key={check.checkName}
                                check={check}
                                onFix={handleFix}
                                fixing={fixing}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
