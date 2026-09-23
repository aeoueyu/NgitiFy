import rawRegions from './json/region.json';
import rawProvinces from './json/province.json';
import rawCities from './json/city.json';

export const regions = rawRegions.map((region) => ({
    code: region.region_code,
    name: region.region_name,
}));

export const provinces = rawProvinces.reduce((result, province) => {
    const regionCode = province.region_code;
    if (!result[regionCode]) result[regionCode] = [];
    result[regionCode].push({
        code: province.province_code,
        name: province.province_name,
    });
    return result;
}, {});

if (!provinces.NCR) {
    provinces.NCR = [{ code: 'MM', name: 'Metro Manila' }];
}

export const cities = rawCities.reduce((result, city) => {
    const provinceCode = city.region_desc === 'National Capital Region (NCR)'
        ? 'MM'
        : city.province_code;
    if (!result[provinceCode]) result[provinceCode] = [];
    result[provinceCode].push({
        code: city.city_code,
        name: city.city_name,
    });
    return result;
}, {});

let barangayDatasetPromise;
const barangaysByCity = new Map();

export const loadBarangaysForCity = async (cityCode) => {
    const normalizedCityCode = String(cityCode || '').trim();
    if (!normalizedCityCode) return [];
    if (barangaysByCity.has(normalizedCityCode)) {
        return barangaysByCity.get(normalizedCityCode);
    }

    if (!barangayDatasetPromise) {
        barangayDatasetPromise = import(
            /* webpackChunkName: "philippine-barangays" */ './json/barangay.json'
        ).then((module) => module.default || module);
    }

    const dataset = await barangayDatasetPromise;
    const options = dataset
        .filter((barangay) => barangay.city_code === normalizedCityCode)
        .map((barangay) => barangay.brgy_name);
    barangaysByCity.set(normalizedCityCode, options);
    return options;
};
