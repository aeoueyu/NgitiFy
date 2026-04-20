import { useAuth } from './useAuth';

export const usePermissions = () => {
    const { user } = useAuth();

    // Graceful fallback to localStorage in case the React context drops on a hard refresh
    const getActiveUser = () => {
        if (user && Object.keys(user).length > 0) return user;
        const storedUser = localStorage.getItem('ngitify_user');
        return storedUser ? JSON.parse(storedUser) : null;
    };

    const activeUser = getActiveUser();

    /**
     * Core validation function to check a specific module and required access level.
     * @param {string} module - The module name (e.g., 'patients', 'inventory')
     * @param {string} requiredLevel - The required access level ('read' or 'edit')
     * @returns {boolean} - True if access is granted, False if denied
     */
    const checkPermission = (module, requiredLevel) => {
        if (!activeUser || !activeUser.role) return false;
        if (activeUser.role === 'administrator') return true;
        const userPermission = activeUser.permissions?.[module] || 'none';
        if (requiredLevel === 'edit') return userPermission === 'edit';
        if (requiredLevel === 'read') return userPermission === 'read' || userPermission === 'edit';
        return false;
    };

    /**
     * Returns false if the current user is a co-administrator and the target role is 'administrator'.
     * Used to gate Edit/Delete actions on user rows.
     * @param {string} targetRole - The role of the user being acted upon
     * @returns {boolean}
     */
    const canModifyRole = (targetRole) => {
        if (!activeUser) return false;
        if (activeUser.role === 'co-administrator' && targetRole === 'administrator') return false;
        return true;
    };

    return {
        checkPermission,
        canModifyRole,

        // ==========================================
        // CONVENIENCE BOOLEANS FOR CLEAN UI RENDERING
        // ==========================================

        // Patients Module
        canReadPatients: checkPermission('patients', 'read'),
        canEditPatients: checkPermission('patients', 'edit'),

        // Appointments Module
        canReadAppointments: checkPermission('appointments', 'read'),
        canEditAppointments: checkPermission('appointments', 'edit'),

        // Inventory Module
        canReadInventory: checkPermission('inventory', 'read'),
        canEditInventory: checkPermission('inventory', 'edit'),

        // Co-admin specific
        isCoAdmin: activeUser?.role === 'co-administrator',
    };
};