const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com'];
const NAME_INPUT_REGEX = /^[a-zA-Z\s.-]+$/;

export const REQUIRED_MESSAGE = 'Required';
export const INVALID_EMAIL_MESSAGE = 'Invalid email domain (e.g. gmail.com)';
export const INVALID_PHONE_MESSAGE = 'Invalid format (9xxxxxxxxx)';
export const INVALID_LICENSE_MESSAGE = 'Must be 7 digits';

export const isValidStaffEmail = (email = '') => {
    if (!EMAIL_FORMAT_REGEX.test(email)) return false;
    return ALLOWED_EMAIL_DOMAINS.includes(email.split('@')[1].toLowerCase());
};

export const isAllowedPersonNameInput = (value = '') => value === '' || NAME_INPUT_REGEX.test(value);

export const toTitleCaseName = (value = '') => (
    value.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase())
);

export const sanitizeStaffPhone = (value = '') => String(value).replace(/[^0-9]/g, '').slice(0, 10);

export const isValidStaffPhone = (value = '') => /^[0-9]{10}$/.test(value) && value.startsWith('9');

export const sanitizeLicenseNumber = (value = '') => String(value).replace(/[^0-9]/g, '').slice(0, 7);

export const isValidStaffLicenseNumber = (value = '') => /^[0-9]{7}$/.test(String(value));

export const calculateAgeFromDate = (dateValue) => {
    const today = new Date();
    const birthdate = new Date(dateValue);
    let age = today.getFullYear() - birthdate.getFullYear();
    const monthDifference = today.getMonth() - birthdate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthdate.getDate())) {
        age -= 1;
    }

    return age;
};

export const meetsMinimumAge = (dateValue, minimumAge) => calculateAgeFromDate(dateValue) >= minimumAge;

export const getMaxDateForMinimumAge = (minimumAge) => {
    const today = new Date();
    today.setFullYear(today.getFullYear() - minimumAge);
    return today.toISOString().split('T')[0];
};

export const getStaffFieldError = (name, value, options = {}) => {
    const { emailRequired = true, phoneRequired = true, licenseRequired = true } = options;

    switch (name) {
        case 'email':
            if (!value) return emailRequired ? REQUIRED_MESSAGE : '';
            return isValidStaffEmail(value) ? '' : INVALID_EMAIL_MESSAGE;
        case 'phone':
            if (!value) return phoneRequired ? REQUIRED_MESSAGE : '';
            return isValidStaffPhone(value) ? '' : INVALID_PHONE_MESSAGE;
        case 'licenseNumber':
            if (!value) return licenseRequired ? REQUIRED_MESSAGE : '';
            return isValidStaffLicenseNumber(value) ? '' : INVALID_LICENSE_MESSAGE;
        default:
            return '';
    }
};

export const addRequiredAddressErrors = (errors, address = {}, prefix) => {
    ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach((field) => {
        if (!address[field]) {
            errors[`${prefix}_${field}`] = REQUIRED_MESSAGE;
        }
    });

    return errors;
};

export const scrollToFirstInvalidField = (errors = {}) => {
    if (typeof document === 'undefined') return;

    const [firstKey] = Object.keys(errors);
    if (!firstKey) return;

    const field = document.getElementsByName(firstKey)[0];
    if (!field) return;

    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.focus();
};
