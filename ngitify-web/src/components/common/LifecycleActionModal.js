import React, { useEffect, useMemo, useState } from 'react';
import { FaExclamationTriangle, FaShieldAlt, FaSyncAlt } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import {
    buildLifecycleReason,
    getLifecycleReasonOptions,
    isLifecycleReasonValid,
    requiresLifecycleReason,
} from '../../utils/lifecycleActionHelpers';
import styles from './LifecycleActionModal.module.css';

const buildGuidanceSteps = ({ impact, action, entityType }) => {
    if (!impact) return [];

    const normalizedAction = String(action || '').trim().toLowerCase();
    const role = String(impact?.target?.role || '').trim().toLowerCase();
    const metrics = impact?.metrics || {};
    const looksLikeDentistLifecycle = entityType === 'staff'
        && (role === 'dentist' || Number(metrics.dentistMaterialUsage || 0) > 0 || (role === 'owner' && Number(metrics.totalAppointments || 0) > 0));
    const steps = [];

    if (normalizedAction === 'restore') {
        steps.push('Restoring returns this record as inactive. Review the profile first, then activate or resend activation only when access should return.');
    }

    if (['deactivate', 'archive', 'delete'].includes(normalizedAction) && Number(metrics.upcomingAppointments || 0) > 0) {
        steps.push(`Review ${metrics.upcomingAppointments} upcoming appointment${metrics.upcomingAppointments === 1 ? '' : 's'} and reassign or follow up before offboarding this account.`);
    }

    if (role === 'branch-manager' && ['deactivate', 'archive', 'delete'].includes(normalizedAction)) {
        if (Number(metrics.soleManagedBranchesCount || 0) > 0) {
            steps.push('Assign another active branch manager to every blocked branch before continuing so branch coverage does not break.');
        }
        if (Number(metrics.managedBranchesCount || 0) > 0) {
            steps.push('After reassignment, double-check branch ownership and staff visibility from the branch records.');
        }
    }

    if (['deactivate', 'archive', 'delete'].includes(normalizedAction) && Number(metrics.dentistMaterialUsage || 0) > 0) {
        steps.push('Keep inventory and material usage history intact. Offboarding should not remove dentist-linked usage records.');
    }

    if (looksLikeDentistLifecycle && ['deactivate', 'archive'].includes(normalizedAction)) {
        steps.push('If this is a dentist offboarding action, confirm patient handoff and schedule continuity before removing access.');
    }

    if ((entityType === 'patient' || role === 'patient') && ['archive', 'delete'].includes(normalizedAction)) {
        steps.push('Use archive for long-term record retention. Permanent deletion should stay exceptional because EMR and treatment history usually need to be preserved.');
    }

    if (normalizedAction === 'delete') {
        steps.push('Permanent deletion is irreversible. Leave the record archived unless the account was created by mistake and all blockers are cleared.');
    }

    return [...new Set(steps)];
};

export default function LifecycleActionModal({
    isOpen,
    scope = 'user',
    entityType = 'staff',
    targetId = '',
    action = 'archive',
    title = 'Confirm action',
    message = '',
    subjectName = '',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    onCancel,
    onConfirm,
}) {
    const [impact, setImpact] = useState(null);
    const [impactError, setImpactError] = useState('');
    const [loadingImpact, setLoadingImpact] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reasonCode, setReasonCode] = useState('');
    const [reasonNotes, setReasonNotes] = useState('');

    const reasonOptions = useMemo(
        () => getLifecycleReasonOptions({ entityType, action }),
        [entityType, action]
    );
    const needsReason = requiresLifecycleReason(action);

    useEffect(() => {
        if (!isOpen) {
            setImpact(null);
            setImpactError('');
            setLoadingImpact(false);
            setSubmitting(false);
            setReasonCode('');
            setReasonNotes('');
            return;
        }

        if (!targetId) {
            setImpact(null);
            setImpactError('No account was selected for this lifecycle action.');
            setLoadingImpact(false);
            return;
        }

        let cancelled = false;

        const loadImpact = async () => {
            setLoadingImpact(true);
            setImpactError('');

            try {
                const res = await authFetch(`/${scope}/lifecycle-impact/${targetId}?action=${encodeURIComponent(action)}`);
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    if (!cancelled) {
                        setImpact(null);
                        setImpactError(data.message || 'Failed to load lifecycle impact preview.');
                    }
                    return;
                }

                if (!cancelled) {
                    setImpact(data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Lifecycle impact load error:', error);
                    setImpact(null);
                    setImpactError('Network error loading lifecycle impact preview.');
                }
            } finally {
                if (!cancelled) {
                    setLoadingImpact(false);
                }
            }
        };

        loadImpact();

        return () => {
            cancelled = true;
        };
    }, [action, isOpen, scope, targetId]);

    if (!isOpen) return null;

    const hasBlockers = Array.isArray(impact?.blockers) && impact.blockers.length > 0;
    const hasWarnings = Array.isArray(impact?.warnings) && impact.warnings.length > 0;
    const reasonValid = isLifecycleReasonValid({ action, reasonCode, reasonNotes });
    const confirmDisabled = loadingImpact || submitting || Boolean(impactError) || hasBlockers || !reasonValid;
    const guidanceSteps = buildGuidanceSteps({ impact, action, entityType });

    const handleConfirm = async () => {
        if (confirmDisabled) return;

        const reason = buildLifecycleReason({
            entityType,
            action,
            reasonCode,
            reasonNotes,
        });

        setSubmitting(true);
        try {
            await onConfirm?.({ reason, impact });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={onCancel}>
            <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.iconShell}>
                        {hasBlockers ? <FaExclamationTriangle /> : <FaShieldAlt />}
                    </div>
                    <div>
                        <h3 className={styles.modalTitle}>{title}</h3>
                        <p className={styles.modalMessage}>
                            {message || `Review the lifecycle impact for ${subjectName || 'this account'} before continuing.`}
                        </p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Impact Preview</h4>

                    {loadingImpact ? (
                        <div className={styles.loadingBox}>
                            <FaSyncAlt className={styles.spinning} />
                            <span>Loading linked records and operational impact...</span>
                        </div>
                    ) : impactError ? (
                        <div className={styles.errorBox}>{impactError}</div>
                    ) : (
                        <>
                            {hasBlockers && (
                                <div className={styles.blockerBox}>
                                    <strong>Action blocked</strong>
                                    <ul className={styles.messageList}>
                                        {impact.blockers.map((entry) => (
                                            <li key={entry}>{entry}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {hasWarnings && (
                                <div className={styles.warningBox}>
                                    <strong>Review carefully</strong>
                                    <ul className={styles.messageList}>
                                        {impact.warnings.map((entry) => (
                                            <li key={entry}>{entry}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {Array.isArray(impact?.impactItems) && impact.impactItems.length > 0 ? (
                                <div className={styles.impactGrid}>
                                    {impact.impactItems.map((item) => (
                                        <div key={item.key} className={styles.impactCard}>
                                            <span className={styles.impactLabel}>{item.label}</span>
                                            {item.valueType === 'list' ? (
                                                <div className={styles.tagList}>
                                                    {item.value.map((entry) => (
                                                        <span key={`${item.key}-${entry}`} className={styles.tag}>
                                                            {entry}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <strong className={styles.impactValue}>{item.value}</strong>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : !hasBlockers && !hasWarnings ? (
                                <div className={styles.clearBox}>
                                    No linked operational impact was found for this action.
                                </div>
                            ) : null}

                            {guidanceSteps.length > 0 && (
                                <div className={styles.guidanceBox}>
                                    <strong>Recommended next steps</strong>
                                    <ul className={styles.messageList}>
                                        {guidanceSteps.map((entry) => (
                                            <li key={entry}>{entry}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {needsReason && (
                    <div className={styles.section}>
                        <h4 className={styles.sectionTitle}>Reason</h4>
                        <label className={styles.label}>
                            Select a reason
                            <select
                                className={styles.selectField}
                                value={reasonCode}
                                onChange={(event) => setReasonCode(event.target.value)}
                            >
                                <option value="">Select a reason</option>
                                {reasonOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className={styles.label}>
                            {reasonCode === 'other' ? 'Required details' : 'Additional notes'}
                            <textarea
                                className={styles.textareaField}
                                value={reasonNotes}
                                onChange={(event) => setReasonNotes(event.target.value)}
                                placeholder={reasonCode === 'other'
                                    ? 'Tell the team exactly why this action is needed.'
                                    : 'Optional extra context for audit history and future review.'}
                            />
                        </label>

                        {needsReason && !reasonValid && (
                            <p className={styles.validationText}>
                                {reasonCode === 'other'
                                    ? 'Please add the required details for "Other".'
                                    : 'Please select a reason before continuing.'}
                            </p>
                        )}
                    </div>
                )}

                <div className={styles.modalButtonGroup}>
                    <button className={styles.cancelBtn} onClick={onCancel} disabled={submitting}>
                        {cancelText}
                    </button>
                    <button
                        className={isDestructive ? styles.destructiveBtn : styles.primaryBtn}
                        onClick={handleConfirm}
                        disabled={confirmDisabled}
                    >
                        {submitting ? 'Working...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
