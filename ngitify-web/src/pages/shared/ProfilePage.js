import { useAuth } from '../../hooks/useAuth';
import AdminProfile from '../admin/AdminProfile';
import PatientProfile from '../patient/PatientProfile';

export default function ProfilePage() {
    const { user } = useAuth();

    if (user?.role === 'patient') {
        return <PatientProfile />;
    }

    return <AdminProfile />;
}
