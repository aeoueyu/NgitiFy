const formatBirthdateLabel = (value = '') => {
    const trimmed = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `DOB ${trimmed}` : '';
};

const formatMobileLabel = (value = '') => {
    const trimmed = String(value || '').trim();
    return trimmed ? `Mobile ${trimmed}` : '';
};

export const getPatientDuplicateSections = (summary = null) => ([
    { key: 'exactEmailMatches', label: 'Same email address', items: summary?.exactEmailMatches || [] },
    { key: 'sameFullNameBirthdateMatches', label: 'Same full name and birthdate', items: summary?.sameFullNameBirthdateMatches || [] },
    { key: 'exactPhoneMatches', label: 'Same mobile number', items: summary?.exactPhoneMatches || [] },
    { key: 'sameLastNameBirthdateMatches', label: 'Same last name and birthdate', items: summary?.sameLastNameBirthdateMatches || [] },
]).filter((section) => Array.isArray(section.items) && section.items.length > 0);

export const getPatientDuplicateCandidates = (summary = null) => {
    const candidateMap = new Map();

    getPatientDuplicateSections(summary).forEach((section) => {
        section.items.forEach((patient) => {
            if (!patient?.id) return;

            const existingEntry = candidateMap.get(patient.id);
            if (existingEntry) {
                candidateMap.set(patient.id, {
                    ...existingEntry,
                    matchLabels: [...new Set([...existingEntry.matchLabels, section.label])],
                });
                return;
            }

            candidateMap.set(patient.id, {
                ...patient,
                matchLabels: [section.label],
            });
        });
    });

    return Array.from(candidateMap.values());
};

const formatLifecycleLabel = (patient = {}) => {
    if (patient.isArchived) return 'Archived record - restore instead of creating duplicate';
    return patient.status || '';
};

export const formatPatientDuplicateLine = (patient = {}) => (
    [
        patient.name || 'Unknown Patient',
        patient.email || '',
        formatMobileLabel(patient.contactNumber),
        formatBirthdateLabel(patient.birthdate),
        patient.assignedBranch ? `${patient.assignedBranch} Branch` : '',
        formatLifecycleLabel(patient),
    ]
        .filter(Boolean)
        .join(' | ')
);
