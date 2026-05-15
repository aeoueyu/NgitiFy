export const ACCOUNT_LIFECYCLE = {
    active: 'Active',
    needsActivation: 'Needs Activation',
    inactive: 'Inactive',
    archived: 'Archived',
    all: 'All',
};

export const getAccountLifecycleKey = (account = {}) => {
    if (account.isArchived) return 'archived';
    if (!account.isVerified) return 'needsActivation';
    return account.rawStatus === 'active' ? 'active' : 'inactive';
};

export const getAccountLifecycleLabel = (account = {}) => ACCOUNT_LIFECYCLE[getAccountLifecycleKey(account)];

export const matchesAccountLifecycleFilter = (account = {}, filter = 'all') => (
    filter === 'all' || getAccountLifecycleKey(account) === filter
);

export const countAccountsByLifecycle = (accounts = [], filter = 'all') => (
    accounts.filter((account) => matchesAccountLifecycleFilter(account, filter)).length
);

export const hasExpiredTemporaryPassword = (account = {}) => {
    if (account?.isPasswordChanged) return false;
    if (!account?.temporaryPasswordExpires) return false;

    const expiresAt = new Date(account.temporaryPasswordExpires);
    if (Number.isNaN(expiresAt.getTime())) return false;

    return Date.now() > expiresAt.getTime();
};

export const shouldShowAccessRecovery = (account = {}) => (
    !account?.isArchived && (!account?.isVerified || hasExpiredTemporaryPassword(account))
);

export const getAccessRecoveryLabel = (account = {}) => (
    hasExpiredTemporaryPassword(account) ? 'Reissue Access Email' : 'Resend Activation Email'
);
