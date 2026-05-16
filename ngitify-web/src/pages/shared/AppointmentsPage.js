import { useAuth } from '../../hooks/useAuth';
import PatientAppointments from '../patient/PatientAppointments';
import SchedulePage from './SchedulePage';

export default function AppointmentsPage() {
    const { user } = useAuth();

    if (user?.role === 'patient') {
        return <PatientAppointments />;
    }

    return <SchedulePage />;
}
