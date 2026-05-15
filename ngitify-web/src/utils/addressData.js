// Import raw JSON data
// FIX: Updated filenames to match your actual files (singular names)
import rawRegions from './json/region.json';
import rawProvinces from './json/province.json';
import rawCities from './json/city.json';
import rawBarangays from './json/barangay.json';

// --- 1. REGIONS ---
// Format: [{ code: '01', name: 'Region I' }, ...]
export const regions = rawRegions.map(region => ({
    code: region.region_code,
    name: region.region_name
}));

// --- 2. PROVINCES ---
// Gusto natin: { 'REGION_CODE': [ { code: 'PROV_CODE', name: 'Prov Name' }, ... ] }
export const provinces = rawProvinces.reduce((acc, prov) => {
    const regionCode = prov.region_code;
    
    if (!acc[regionCode]) {
        acc[regionCode] = [];
    }
    
    acc[regionCode].push({
        code: prov.province_code,
        name: prov.province_name
    });
    
    return acc;
}, {});

// --- SPECIAL CASE: METRO MANILA (NCR) ---
// Sa ibang data, walang "Province" ang NCR. Gagawa tayo ng fake province para gumana ang dropdown logic.
if (!provinces['NCR']) {
    provinces['NCR'] = [
        { code: 'MM', name: 'Metro Manila' }
    ];
}

// --- 3. CITIES ---
// Gusto natin: { 'PROV_CODE': [ { code: 'CITY_CODE', name: 'City Name' }, ... ] }
export const cities = rawCities.reduce((acc, city) => {
    // Check kung NCR city ito, i-assign natin sa fake 'MM' province code
    const provCode = city.region_desc === 'National Capital Region (NCR)' ? 'MM' : city.province_code;
    
    if (!acc[provCode]) {
        acc[provCode] = [];
    }
    
    acc[provCode].push({
        code: city.city_code,
        name: city.city_name
    });
    
    return acc;
}, {});

// --- 4. BARANGAYS ---
// Gusto natin: { 'CITY_CODE': [ 'Brgy 1', 'Brgy 2', ... ] }
export const barangays = rawBarangays.reduce((acc, brgy) => {
    const cityCode = brgy.city_code;
    
    if (!acc[cityCode]) {
        acc[cityCode] = [];
    }
    
    // Push string name directly
    acc[cityCode].push(brgy.brgy_name);
    
    return acc;
}, {});

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const findRegionCode = (value) => {
    if (!value) return '';
    const normalized = normalizeText(value);
    const match = rawRegions.find((region) => (
        normalizeText(region.region_code) === normalized
        || normalizeText(region.region_name) === normalized
        || normalizeText(region.region_name.replace(/\(.*?\)/g, '').trim()) === normalized
    ));
    return match?.region_code || '';
};

const findProvinceCode = (value, regionCode = '') => {
    if (!value) return '';
    const normalized = normalizeText(value);
    const match = rawProvinces.find((province) => {
        const matchesRegion = !regionCode || province.region_code === regionCode;
        return matchesRegion && (
            normalizeText(province.province_code) === normalized
            || normalizeText(province.province_name) === normalized
        );
    });
    return match?.province_code || '';
};

const findCityCode = (value, provinceCode = '', regionCode = '') => {
    if (!value) return '';
    const normalized = normalizeText(value);
    const match = rawCities.find((city) => {
        const derivedProvinceCode = city.region_desc === 'National Capital Region (NCR)' ? 'MM' : city.province_code;
        const matchesProvince = !provinceCode || derivedProvinceCode === provinceCode || city.province_code === provinceCode;
        const matchesRegion = !regionCode || normalizeText(city.region_desc) === normalizeText(regionCode) || normalizeText(city.region_desc) === normalizeText(rawRegions.find((region) => region.region_code === regionCode)?.region_name);
        return matchesProvince && matchesRegion && (
            normalizeText(city.city_code) === normalized
            || normalizeText(city.city_name) === normalized
        );
    });
    return match?.city_code || '';
};

const findBarangayValue = (value, cityCode = '') => {
    if (!value) return '';
    const normalized = normalizeText(value);
    const match = rawBarangays.find((barangay) => {
        const matchesCity = !cityCode || barangay.city_code === cityCode;
        return matchesCity && (
            normalizeText(barangay.brgy_code) === normalized
            || normalizeText(barangay.brgy_name) === normalized
        );
    });
    return match?.brgy_name || '';
};

export const normalizeStoredAddressToCodes = (address = {}) => {
    const region = findRegionCode(address.region);
    const province = findProvinceCode(address.province, region) || (normalizeText(address.province) === 'metro manila' ? 'MM' : '');
    const city = findCityCode(address.city, province, region);
    const barangay = findBarangayValue(address.barangay, city);

    return {
        country: String(address.country || 'Philippines').trim() || 'Philippines',
        region,
        province,
        city,
        barangay,
        houseNumber: String(address.houseNumber || '').trim(),
        street: String(address.street || '').trim(),
    };
};
