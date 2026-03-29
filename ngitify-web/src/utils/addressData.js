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