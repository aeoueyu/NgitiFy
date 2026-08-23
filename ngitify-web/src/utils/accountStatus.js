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
    const status = account.rawStatus ?? account.status;
    return status === 'active' ? 'active' : 'inactive';
};

export const getAccountLifecycleLabel = (account = {}) => ACCOUNT_LIFECYCLE[getAccountLifecycleKey(account)];

export const matchesAccountLifecycleFilter = (account = {}, filter = 'all') => (
    filter === 'all' || getAccountLifecycleKey(account) === filter
);

export const countAccountsByLifecycle = (accounts = [], filter = 'all') => (
    accounts.filter((account) => matchesAccountLifecycleFilter(account, filter)).length
);

export const hasExpiredTemporaryPassword = (account = {}) => {
    return false;
};

export const shouldShowAccessRecovery = (account = {}) => (
    !account?.isArchived && !account?.isVerified
);

export const getAccessRecoveryLabel = (account = {}) => (
    'Resend Activation Email'
);
