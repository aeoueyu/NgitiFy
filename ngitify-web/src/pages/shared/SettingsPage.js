import { useAuth } from '../../hooks/useAuth';
import AdminSettings from '../admin/AdminSettings';
import DentistSettings from '../dentist/DentistSettings';
import PatientSettings from '../patient/PatientSettings';
import SecretarySettings from '../secretary/SecretarySettings';

export default function SettingsPage() {
    const { user } = useAuth();

    if (user?.role === 'patient') {
        return <PatientSettings />;
    }

    if (user?.role === 'secretary') {
        return <SecretarySettings />;
    }

    if (user?.role === 'dentist') {
        return <DentistSettings />;
    }

    return <AdminSettings />;
}
