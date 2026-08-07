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

export const EDUCATION_ARTICLES = [
    {
        id: '1',
        iconName: 'toothbrush',
        iconLib: 'MaterialCommunityIcons',
        iconColor: '#01538b',
        title: 'Proper Brushing Technique',
        summary: 'Brush for 2 minutes, twice a day using circular motions at a 45 degree angle.',
        body: 'Use a soft-bristled toothbrush and fluoride toothpaste. Hold the brush at a 45 degree angle to your gums. Use short, gentle circular strokes instead of scrubbing. Brush outer surfaces, inner surfaces, and chewing surfaces of all teeth, and clean your tongue too. Replace your toothbrush every 3 to 4 months.',
    },
    {
        id: '2',
        iconName: 'tooth-outline',
        iconLib: 'MaterialCommunityIcons',
        iconColor: '#00897b',
        title: 'Why Flossing Matters',
        summary: 'Flossing removes plaque from areas your toothbrush cannot reach.',
        body: 'Floss at least once a day, ideally before bed. Break off about 45 cm of floss and wind it around your middle fingers. Gently slide it between teeth in a C-shape motion and go just below the gumline. Floss picks and water flossers can also help. Skipping flossing leaves many tooth surfaces uncleaned.',
    },
    {
        id: '3',
        iconName: 'nutrition-outline',
        iconLib: 'Ionicons',
        iconColor: '#2e7d32',
        title: 'Foods That Protect Your Teeth',
        summary: 'Cheese, leafy greens, and crunchy vegetables naturally support enamel.',
        body: 'Dairy products provide calcium and phosphates that help remineralize enamel. Crunchy fruits and vegetables increase saliva production, which helps wash away bacteria. Leafy greens are rich in calcium and folic acid. Water, especially fluoridated water, is still one of the best drinks for oral health.',
    },
    {
        id: '4',
        iconName: 'cafe-outline',
        iconLib: 'Ionicons',
        iconColor: '#c62828',
        title: 'Habits That Harm Your Teeth',
        summary: 'Coffee, soda, tobacco, and grinding can speed up dental problems.',
        body: 'Sugary and acidic drinks erode enamel over time, especially if sipped throughout the day. Tobacco increases the risk of gum disease, tooth loss, and oral cancer. Grinding your teeth damages enamel and can cause jaw pain. Using your teeth to open objects can chip or fracture them.',
    },
];

export const ORAL_HEALTH_TIPS = [
    { id: '1', iconName: 'sunny-outline', iconLib: 'Ionicons', iconColor: '#f57f17', title: 'Morning Routine', tip: 'Brush and rinse before breakfast to remove overnight bacteria buildup.' },
    { id: '2', iconName: 'moon-outline', iconLib: 'Ionicons', iconColor: '#5c6bc0', title: 'Night Routine', tip: 'Brush and floss before bed. This is the most important brushing session.' },
    { id: '3', iconName: 'water-outline', iconLib: 'Ionicons', iconColor: '#0288d1', title: 'Stay Hydrated', tip: 'Drink water after meals to rinse away food particles and acid.' },
    { id: '4', iconName: 'flask-outline', iconLib: 'Ionicons', iconColor: '#00897b', title: 'Mouthwash', tip: 'Use fluoride or antibacterial mouthwash to reach areas brushing misses.' },
    { id: '5', iconName: 'calendar-outline', iconLib: 'Ionicons', iconColor: '#01538b', title: 'Regular Check-ups', tip: 'Visit your dentist every 6 months for cleaning and early detection.' },
    { id: '6', iconName: 'toothbrush', iconLib: 'MaterialCommunityIcons', iconColor: '#6a1b9a', title: 'Change Your Brush', tip: 'Replace your toothbrush every 3 months or after any illness.' },
];

export const NOTIFICATION_META = {
    NEW_APPOINTMENT: { icon: 'calendar-outline', library: 'Ionicons', color: '#1e88e5', label: 'Appointment' },
    APPOINTMENT_CONFIRMED: { icon: 'checkmark-circle-outline', library: 'Ionicons', color: '#2e7d32', label: 'Confirmed' },
    APPOINTMENT_DECLINED: { icon: 'close-circle-outline', library: 'Ionicons', color: '#c62828', label: 'Declined' },
    APPOINTMENT_REMINDER: { icon: 'alarm-outline', library: 'Ionicons', color: '#f57f17', label: 'Reminder' },
    APPOINTMENT_CANCELLED: { icon: 'ban-outline', library: 'Ionicons', color: '#757575', label: 'Cancelled' },
    APPOINTMENT_STATUS_UPDATED: { icon: 'sync-outline', library: 'Ionicons', color: '#01538b', label: 'Updated' },
    PREDICTIVE_VISIT_DUE: { icon: 'warning-outline', library: 'Ionicons', color: '#e65100', label: 'Visit Due' },
    PREDICTIVE_VISIT_OVERDUE: { icon: 'alert-circle-outline', library: 'Ionicons', color: '#b71c1c', label: 'Visit Overdue' },
    DENTAL_HEALTH_TIP: { icon: 'tooth-outline', library: 'MaterialCommunityIcons', color: '#00897b', label: 'Dental Tip' },
    NEW_RADIOGRAPH: { icon: 'bone', library: 'MaterialCommunityIcons', color: '#4527a0', label: 'Radiograph' },
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
    if (type.includes('APPOINTMENT')) return '/patient/appointments';
    if (type.includes('RADIOGRAPH')) return '/patient/records?tab=radiographs';
    if (type.includes('TICKET') || type.includes('INQUIRY')) return '/patient/ai-companion?tab=inquiry';
    if (type.includes('VISIT')) return '/patient/oral-care';
    return '';
};
