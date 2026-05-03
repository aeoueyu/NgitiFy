export const NATIONALITY_OPTIONS = [
    'Filipino',
    'American',
    'Australian',
    'British',
    'Canadian',
    'Chinese',
    'Indian',
    'Japanese',
    'Korean',
    'Other',
];

export const RELIGION_OPTIONS = [
    'Roman Catholic',
    'Christian',
    'Iglesia ni Cristo',
    'Islam',
    'Buddhism',
    'Hinduism',
    'Born Again Christian',
    'Seventh-day Adventist',
    'None',
    'Other',
];

export const PHYSICIAN_SPECIALTY_OPTIONS = [
    'None',
    'General Practice',
    'Cardiology',
    'Dermatology',
    'Endocrinology',
    'Family Medicine',
    'Gastroenterology',
    'Internal Medicine',
    'Neurology',
    'Obstetrics and Gynecology',
    'Oncology',
    'Ophthalmology',
    'Orthopedics',
    'Pediatrics',
    'Psychiatry',
    'Pulmonology',
    'Surgery',
    'Urology',
    'Other',
];

export const ALLERGY_OPTIONS = [
    'Local Anesthetic (ex. Lidocaine)',
    'Penicillin',
    'Aspirin',
    'Antibiotics',
    'Adrenaline',
    'Steroids',
    'Hormones',
    'Antacids',
    'Sulfa Drugs',
    'Alcohol',
    'Latex',
];

export const MEDICAL_CONDITION_OPTIONS = [
    'High Blood Pressure',
    'Low Blood Pressure',
    'Epilepsy/Convulsions',
    'AIDS or HIV Infection',
    'Sexually Transmitted Disease',
    'Stomach Troubles/Ulcers',
    'Fainting Seizure',
    'Rapid Weight Loss',
    'Radiation Therapy',
    'Joint Replacement/Implant',
    'Heart Surgery',
    'Heart Attack',
    'Thyroid Problem',
    'Stroke',
    'Heart Disease',
    'Heart Murmur',
    'Hepatitis/Liver Disease',
    'Rheumatic Fever',
    'Hay Fever/Allergies',
    'Respiratory Problems',
    'Hepatitis/Jaundice',
    'Tuberculosis',
    'Swollen Ankles',
    'Kidney Disease',
    'Diabetes',
    'Chest Pain',
    'Cancer/Tumors',
    'Anemia',
    'Angina',
    'Asthma',
    'Emphysema',
    'Bleeding Problems',
    'Blood Diseases',
    'Head Injuries',
    'Arthritis/Rheumatism',
    'Other',
];

export const MOBILE_PREFIX = '+63';
export const LANDLINE_PREFIX = '+632';

export const isValidMobileNumber = (value = '') => /^[0-9]{10}$/.test(value) && value.startsWith('9');
export const isValidLandlineNumber = (value = '') => /^[0-9]{7,8}$/.test(value);

export const stripMobilePrefix = (value = '') => {
    const digits = String(value).replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length >= 12) return digits.slice(2, 12);
    if (digits.startsWith('0') && digits.length >= 11) return digits.slice(1, 11);
    if (digits.startsWith('9')) return digits.slice(0, 10);
    return digits.slice(-10);
};

export const stripLandlinePrefix = (value = '') => {
    const digits = String(value).replace(/\D/g, '');
    if (digits.startsWith('632')) return digits.slice(3, 11);
    if (digits.startsWith('02')) return digits.slice(2, 10);
    if (digits.startsWith('63') && digits.length > 3) return digits.slice(-8);
    if (digits.startsWith('0') && digits.length > 1) return digits.slice(-8);
    return digits.slice(-8);
};

export const toMobilePayload = (value = '') => value ? `${MOBILE_PREFIX}${value}` : undefined;
export const toLandlinePayload = (value = '') => value ? `${LANDLINE_PREFIX}${value}` : undefined;

export const getSelectValueWithOther = (value = '', options = []) => {
    if (!value) return '';
    return options.includes(value) ? value : 'Other';
};

export const getOtherTextValue = (value = '', options = []) => (
    value && !options.includes(value) ? value : ''
);

export const formatHomeAddress = (addr = {}) => {
    const parts = [addr.houseNumber, addr.street, addr.barangay, addr.city, addr.province, addr.region].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
};
