import { getAccountLifecycleLabel } from './accountStatus';

export const ACCOUNT_DELETE_RETENTION_DAYS = 30;

export const formatLifecycleActor = (actor) => {
    if (!actor) return 'System';
    if (typeof actor === 'string') return actor;

    const first = String(actor?.name?.first || actor?.firstName || '').trim();
    const last = String(actor?.name?.last || actor?.lastName || '').trim();
    const fullName = [first, last].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    return String(actor?.email || '').trim() || 'System';
};

export const formatLifecycleDateTime = (value) => {
    if (!value) return 'Not recorded';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Not recorded';

    return parsed.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const getArchiveRetentionInfo = (account = {}, now = new Date()) => {
    if (!account?.isArchived || !account?.archivedAt) {
        return {
            isArchived: false,
            daysRemaining: 0,
            daysElapsed: 0,
            isRetentionSatisfied: false,
            statusLabel: 'Not archived',
        };
    }

    const archivedAt = new Date(account.archivedAt);
    if (Number.isNaN(archivedAt.getTime())) {
        return {
            isArchived: true,
            daysRemaining: ACCOUNT_DELETE_RETENTION_DAYS,
            daysElapsed: 0,
            isRetentionSatisfied: false,
            statusLabel: 'Archived date missing',
        };
    }

    const elapsedMs = Math.max(0, now.getTime() - archivedAt.getTime());
    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    const remainingDays = Math.max(0, ACCOUNT_DELETE_RETENTION_DAYS - elapsedDays);
    const isRetentionSatisfied = remainingDays === 0;

    return {
        isArchived: true,
        daysElapsed: elapsedDays,
        daysRemaining: remainingDays,
        isRetentionSatisfied,
        statusLabel: isRetentionSatisfied
            ? 'Eligible for delete review'
            : `${remainingDays} day${remainingDays === 1 ? '' : 's'} left in retention`,
    };
};

const shouldHideDuplicateDeactivateEvent = (account = {}) => {
    if (!account?.isArchived || !account?.archivedAt || !account?.deactivatedAt) return false;
    const archivedAt = new Date(account.archivedAt);
    const deactivatedAt = new Date(account.deactivatedAt);
    if (Number.isNaN(archivedAt.getTime()) || Number.isNaN(deactivatedAt.getTime())) return false;

    const sameMoment = Math.abs(archivedAt.getTime() - deactivatedAt.getTime()) < 60 * 1000;
    const sameReason = String(account.archiveReason || '').trim() === String(account.deactivationReason || '').trim();
    return sameMoment && sameReason;
};

export const buildLifecycleHistoryEntries = (account = {}) => {
    const entries = [];

    if (account?.archivedAt) {
        entries.push({
            key: 'archived',
            label: 'Archived',
            date: account.archivedAt,
            actor: formatLifecycleActor(account.archivedBy),
            reason: String(account.archiveReason || '').trim(),
            tone: 'archive',
        });
    }

    if (account?.restoredAt) {
        entries.push({
            key: 'restored',
            label: 'Restored',
            date: account.restoredAt,
            actor: formatLifecycleActor(account.restoredBy),
            reason: '',
            tone: 'restore',
        });
    }

    if (account?.deactivatedAt && !shouldHideDuplicateDeactivateEvent(account)) {
        entries.push({
            key: 'deactivated',
            label: 'Access Deactivated',
            date: account.deactivatedAt,
            actor: formatLifecycleActor(account.deactivatedBy),
            reason: String(account.deactivationReason || '').trim(),
            tone: 'deactivate',
        });
    }

    return entries.sort((left, right) => new Date(right.date) - new Date(left.date));
};

export const getLifecycleSnapshot = (account = {}) => {
    const lifecycleLabel = getAccountLifecycleLabel({
        isArchived: Boolean(account?.isArchived),
        isVerified: Boolean(account?.isVerified),
        rawStatus: String(account?.status || 'inactive'),
    });

    const verificationLabel = account?.isArchived
        ? 'Archived record'
        : account?.isVerified
            ? 'Verified email'
            : 'Pending activation';

    return {
        lifecycleLabel,
        verificationLabel,
        retention: getArchiveRetentionInfo(account),
        historyEntries: buildLifecycleHistoryEntries(account),
    };
};
