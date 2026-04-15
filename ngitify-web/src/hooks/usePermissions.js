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
        // 1. Block access immediately if no user is found
        if (!activeUser || !activeUser.role) return false;

        // 2. Owners and Co-owners bypass all checks (Full System Access)
        if (activeUser.role === 'administrator' || activeUser.role === 'co-administrator') {
            return true; 
        }

        // 3. Extract the staff member's specific permission for this module
        // Safely fall back to 'none' if the permissions object is missing or undefined
        const userPermission = activeUser.permissions?.[module] || 'none';

        // 4. Evaluate against the required level
        if (requiredLevel === 'edit') {
            return userPermission === 'edit';
        }

        if (requiredLevel === 'read') {
            // 'edit' level implicitly grants 'read' level access
            return userPermission === 'read' || userPermission === 'edit';
        }

        return false;
    };

    return {
        // Raw dynamic function if you need to do custom checks on the fly
        checkPermission,

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
        canEditInventory: checkPermission('inventory', 'edit')
    };
};