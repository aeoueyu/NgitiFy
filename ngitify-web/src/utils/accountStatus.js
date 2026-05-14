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
