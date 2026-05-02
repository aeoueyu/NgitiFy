import SharedPatientEMR from '../admin/PatientEMR';

export default function DentistPatientEMR(props) {
    return <SharedPatientEMR {...props} roleOverride="dentist" />;
}
