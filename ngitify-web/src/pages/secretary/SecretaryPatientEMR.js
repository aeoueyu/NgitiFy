import SharedPatientEMR from '../admin/PatientEMR';

export default function SecretaryPatientEMR(props) {
    return <SharedPatientEMR {...props} roleOverride="secretary" />;
}
