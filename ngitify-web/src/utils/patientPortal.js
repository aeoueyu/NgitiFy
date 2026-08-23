import regionsData from './json/region.json';
import provincesData from './json/province.json';
import citiesData from './json/city.json';
import barangaysData from './json/barangay.json';

export const DIRECT_BOOKING_PROCEDURES = [
    'General Check-up / Initial Consultation',
    'Prophylaxis / Dental Cleaning',
];

export const CHATBOT_SUGGESTIONS = [
    'Do I have an active appointment?',
    'What slots are available tomorrow?',
    'When should I visit again?',
];

export const INQUIRY_CATEGORIES = ['General', 'Treatment', 'Schedule', 'Billing'];

export const NOTIFICATION_META = {
    NEW_APPOINTMENT: {
        icon: 'calendar-outline',
        library: 'Ionicons',
        color: '#1e88e5',
        label: 'Appointment',
    },
    APPOINTMENT_CONFIRMED: {
        icon: 'checkmark-circle-outline',
        library: 'Ionicons',
        color: '#2e7d32',
        label: 'Confirmed',
    },
    APPOINTMENT_DECLINED: {
        icon: 'close-circle-outline',
        library: 'Ionicons',
        color: '#c62828',
        label: 'Declined',
    },
    APPOINTMENT_REMINDER: {
        icon: 'alarm-outline',
        library: 'Ionicons',
        color: '#f57f17',
        label: 'Appointment Reminder',
    },
    APPOINTMENT_CANCELLED: {
        icon: 'ban-outline',
        library: 'Ionicons',
        color: '#757575',
        label: 'Cancelled',
    },
    APPOINTMENT_STATUS_UPDATED: {
        icon: 'sync-outline',
        library: 'Ionicons',
        color: '#01538b',
        label: 'Appointment Updated',
    },
    PREDICTIVE_VISIT_DUE: {
        icon: 'calendar-outline',
        library: 'Ionicons',
        color: '#e65100',
        label: 'Recommended Visit Window',
    },
    PREDICTIVE_VISIT_OVERDUE: {
        icon: 'alert-circle-outline',
        library: 'Ionicons',
        color: '#b71c1c',
        label: 'Recommended Visit Window',
    },
    ORAL_HEALTH_DAILY_REMINDER: {
        icon: 'toothbrush',
        library: 'MaterialCommunityIcons',
        color: '#01538b',
        label: 'Oral Health Management',
    },
    ORAL_HEALTH_SYMPTOM_FOLLOW_UP: {
        icon: 'alert-circle-outline',
        library: 'Ionicons',
        color: '#d97706',
        label: 'Oral Health Management Follow-Up',
    },
    DENTAL_HEALTH_TIP: {
        icon: 'book-open-page-variant-outline',
        library: 'MaterialCommunityIcons',
        color: '#00897b',
        label: 'Dental Health Education',
    },
    NEW_RADIOGRAPH: {
        icon: 'bone',
        library: 'MaterialCommunityIcons',
        color: '#4527a0',
        label: 'Radiograph',
    },
};

export const getTodayDateKey = () => new Date().toISOString().split('T')[0];

export const toDateKey = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const parseDateKey = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const toMonthKey = (value = new Date()) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const formatDateDisplay = (value, options = {}) => {
    if (!value) return 'Not specified';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not specified';
    return date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...options,
    });
};

export const formatWeekdayDateDisplay = (value) => formatDateDisplay(value, {
    weekday: 'short',
});

export const formatTime24 = (value) => {
    if (!value) return 'Time to be assigned';
    const [hourText, minute = '00'] = String(value).split(':');
    const hour = Number(hourText);
    if (Number.isNaN(hour)) return value;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
};

export const formatRelativeTimestamp = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDateDisplay(date);
};

export const calculateAge = (value) => {
    if (!value) return null;
    const birthDate = new Date(value);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (
        today.getMonth() < birthDate.getMonth()
        || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
    ) {
        age -= 1;
    }
    return age;
};

export const getFullName = (record = {}) => {
    if (record?.name?.first || record?.name?.last) {
        return [record.name.first, record.name.middle, record.name.last].filter(Boolean).join(' ').trim();
    }
    if (record?.firstName || record?.lastName) {
        return [record.firstName, record.middleName, record.lastName].filter(Boolean).join(' ').trim();
    }
    if (typeof record?.name === 'string') return record.name;
    return '';
};

export const getInitials = (record = {}) => {
    const first = record?.name?.first || record?.firstName || '';
    const last = record?.name?.last || record?.lastName || '';
    return `${first.charAt(0)}${last.charAt(0)}`.trim().toUpperCase() || 'P';
};

const resolveAddressName = (list, codeKey, nameKey, value) => {
    if (!value) return '';
    const normalized = String(value).toLowerCase();
    const byName = list.find((item) => String(item[nameKey] || '').toLowerCase() === normalized);
    if (byName) return byName[nameKey];
    const byCode = list.find((item) => item[codeKey] === value);
    return byCode ? byCode[nameKey] : value;
};

export const resolveToCode = (list, nameKey, codeKey, value) => {
    if (!value) return '';
    const byCode = list.find((item) => item[codeKey] === value);
    if (byCode) return value;
    const byName = list.find((item) => String(item[nameKey] || '').toLowerCase() === String(value).toLowerCase());
    return byName ? byName[codeKey] : '';
};

export const nameFromCode = (list, codeKey, nameKey, value) => {
    if (!value) return '';
    const byCode = list.find((item) => item[codeKey] === value);
    return byCode ? byCode[nameKey] : value;
};

export const formatAddress = (address = {}) => {
    const regionName = resolveAddressName(regionsData, 'region_code', 'region_name', address.region);
    const provinceName = resolveAddressName(provincesData, 'province_code', 'province_name', address.province);
    const cityName = resolveAddressName(citiesData, 'city_code', 'city_name', address.city);
    const barangayName = resolveAddressName(barangaysData, 'brgy_code', 'brgy_name', address.barangay);
    const parts = [
        address.houseNumber,
        address.street,
        barangayName,
        cityName,
        provinceName,
        regionName,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Not specified';
};

export const getNotificationTarget = (type = '') => {
    const normalizedType =
        String(type || '').trim();

    if (
        normalizedType.includes('APPOINTMENT')
    ) {
        return '/patient/appointments';
    }

    if (
        normalizedType.includes('RADIOGRAPH')
    ) {
        return '/patient/records?tab=radiographs';
    }

    if (
        normalizedType.includes('TICKET')
        || normalizedType.includes('INQUIRY')
    ) {
        return '/patient/ai-companion';
    }

    if (normalizedType === 'DENTAL_HEALTH_TIP') {
        return '/patient/dental-health-education';
    }

    if (
        [
            'PREDICTIVE_VISIT_DUE',
            'PREDICTIVE_VISIT_OVERDUE',
            'ORAL_HEALTH_DAILY_REMINDER',
            'ORAL_HEALTH_SYMPTOM_FOLLOW_UP',
        ].includes(normalizedType)
    ) {
        return '/patient/oral-care';
    }

    return '';
};
