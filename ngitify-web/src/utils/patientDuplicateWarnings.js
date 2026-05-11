export const getPatientDuplicateSections = (summary = null) => ([
    { key: 'exactEmailMatches', label: 'Same email address', items: summary?.exactEmailMatches || [] },
    { key: 'sameFullNameBirthdateMatches', label: 'Same full name and birthdate', items: summary?.sameFullNameBirthdateMatches || [] },
    { key: 'exactPhoneMatches', label: 'Same mobile number', items: summary?.exactPhoneMatches || [] },
    { key: 'sameLastNameBirthdateMatches', label: 'Same last name and birthdate', items: summary?.sameLastNameBirthdateMatches || [] },
]).filter((section) => Array.isArray(section.items) && section.items.length > 0);

export const formatPatientDuplicateLine = (patient = {}) => (
    [
        patient.name || 'Unknown Patient',
        patient.email || '',
        patient.assignedBranch ? `${patient.assignedBranch} Branch` : '',
        patient.status || '',
    ]
        .filter(Boolean)
        .join(' • ')
);
