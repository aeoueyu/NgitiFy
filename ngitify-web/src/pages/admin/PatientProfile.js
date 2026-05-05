import React from 'react';
import PatientEMR from './PatientEMR';

export default function PatientProfile({ patientId, onClose }) {
    return (
        <PatientEMR
            patientId={patientId}
            onClose={onClose}
            embedded
            forceReadOnly
        />
    );
}
