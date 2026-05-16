import { useAuth } from '../../hooks/useAuth';
import PatientEMR from '../admin/PatientEMR';

export default function PatientRecordsPage() {
    const { user } = useAuth();
    const patientId = user?.userId || user?.id || user?._id || '';

    return (
        <PatientEMR
            patientId={patientId}
            roleOverride="patient"
            forceReadOnly
        />
    );
}
