import React from 'react';
import { useLocation } from 'react-router-dom';
import PatientAiCompanion from '../../pages/patient/PatientAiCompanion';
import { PATIENT_AI_OPEN_EVENT } from '../../utils/patientAiChat';
import NgitiBotFloatingChat from '../common/NgitiBotFloatingChat';

export default function PatientAIChat() {
    const location = useLocation();
    return (
        <NgitiBotFloatingChat
            openEventName={PATIENT_AI_OPEN_EVENT}
            openRequestKey={location.state?.openPatientAi ? location.key : ''}
        >
            {({ isOpen, onClose }) => <PatientAiCompanion embedded isOpen={isOpen} onClose={onClose} />}
        </NgitiBotFloatingChat>
    );
}
