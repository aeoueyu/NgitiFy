import SharedPatientEMR from '../admin/PatientEMR';

export default function BranchManagerPatientEMR(props) {
    return <SharedPatientEMR {...props} roleOverride="branch-manager" />;
}
