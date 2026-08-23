import {
    getAccountLifecycleKey,
    getAccountLifecycleLabel,
    matchesAccountLifecycleFilter,
} from './accountStatus';

describe('account lifecycle status', () => {
    test('unverified patients and staff consistently need activation', () => {
        for (const account of [
            { role: 'patient', status: 'inactive', isVerified: false },
            { role: 'secretary', rawStatus: 'inactive', isVerified: false },
        ]) {
            expect(getAccountLifecycleKey(account)).toBe('needsActivation');
            expect(getAccountLifecycleLabel(account)).toBe('Needs Activation');
            expect(matchesAccountLifecycleFilter(account, 'needsActivation')).toBe(true);
            expect(matchesAccountLifecycleFilter(account, 'inactive')).toBe(false);
        }
    });

    test('verified deactivated accounts remain inactive', () => {
        expect(getAccountLifecycleKey({ status: 'inactive', isVerified: true })).toBe('inactive');
        expect(getAccountLifecycleLabel({ status: 'inactive', isVerified: true })).toBe('Inactive');
    });

    test('archived state takes precedence over verification', () => {
        expect(getAccountLifecycleKey({ isArchived: true, isVerified: false })).toBe('archived');
        expect(getAccountLifecycleLabel({ isArchived: true, isVerified: false })).toBe('Archived');
    });
});
