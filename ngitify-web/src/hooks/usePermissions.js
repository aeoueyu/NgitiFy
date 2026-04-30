import { useAuth } from './useAuth';

export const usePermissions = () => {
    const { user } = useAuth();

    const getActiveUser = () => {
        if (user && Object.keys(user).length > 0) return user;
        const storedUser = localStorage.getItem('ngitify_user');
        return storedUser ? JSON.parse(storedUser) : null;
    };

    const activeUser = getActiveUser();

    const normalizePermission = (permissionValue) => {
        switch (permissionValue) {
            case 'edit':
            case 'full_access':
                return 'edit';
            case 'read':
            case 'read_only':
                return 'read';
            case 'none':
            case 'no_access':
            default:
                return 'none';
        }
    };

    const checkPermission = (module, requiredLevel) => {
        if (!activeUser || !activeUser.role) return false;

        if (activeUser.role === 'administrator' || activeUser.role === 'owner') {
            return true;
        }

        const fallbackRolePermissions = {
            secretary: {
                patients: 'edit',
                appointments: 'edit',
            },
            'branch-manager': {
                patients: 'read',
                appointments: 'edit',
                inventory: 'read',
            },
        };

        const rawPermission =
            activeUser.permissions?.[module] ??
            fallbackRolePermissions[activeUser.role]?.[module] ??
            'none';

        const userPermission = normalizePermission(rawPermission);

        if (requiredLevel === 'edit') return userPermission === 'edit';
        if (requiredLevel === 'read') return userPermission === 'read' || userPermission === 'edit';
        return false;
    };

    const canModifyRole = (targetRole) => {
        if (!activeUser) return false;
        if (activeUser.role === 'co-administrator' && targetRole === 'administrator') return false;
        return true;
    };

    return {
        checkPermission,
        canModifyRole,
        canReadPatients: checkPermission('patients', 'read'),
        canEditPatients: checkPermission('patients', 'edit'),
        canReadAppointments: checkPermission('appointments', 'read'),
        canEditAppointments: checkPermission('appointments', 'edit'),
        canReadInventory: checkPermission('inventory', 'read'),
        canEditInventory: checkPermission('inventory', 'edit'),
        isCoAdmin: activeUser?.role === 'co-administrator',
    };
};
