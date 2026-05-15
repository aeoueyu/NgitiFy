import { regions, provinces, cities } from './addressData';

const findRegionByValue = (value = '') => {
    if (!value) return null;
    return regions.find((region) => region.code === value || region.name === value) || null;
};

const findProvinceByValue = (regionCode = '', value = '') => {
    if (!value) return null;
    const scoped = regionCode ? (provinces[regionCode] || []) : Object.values(provinces).flat();
    return scoped.find((province) => province.code === value || province.name === value) || null;
};

const findCityByValue = (provinceCode = '', value = '') => {
    if (!value) return null;
    const scoped = provinceCode ? (cities[provinceCode] || []) : Object.values(cities).flat();
    return scoped.find((city) => city.code === value || city.name === value) || null;
};

export const normalizeAddressForForm = (address = {}) => {
    const regionMatch = findRegionByValue(address.region || '');
    const provinceMatch = findProvinceByValue(regionMatch?.code || '', address.province || '');
    const cityMatch = findCityByValue(provinceMatch?.code || '', address.city || '');

    return {
        country: address.country || 'Philippines',
        region: regionMatch?.code || address.region || '',
        province: provinceMatch?.code || address.province || '',
        city: cityMatch?.code || address.city || '',
        barangay: address.barangay || '',
        houseNumber: address.houseNumber || '',
        street: address.street || '',
    };
};

export const getHomeAddress = (record = {}) => (
    record?.homeAddress || record?.currentAddress || record?.permanentAddress || {}
);

export const resolveAddressNames = (address = {}) => {
    const regionMatch = findRegionByValue(address.region || '');
    const provinceMatch = findProvinceByValue(regionMatch?.code || address.region || '', address.province || '');
    const cityMatch = findCityByValue(provinceMatch?.code || address.province || '', address.city || '');

    return {
        ...address,
        region: regionMatch?.name || address.region || '',
        province: provinceMatch?.name || address.province || '',
        city: cityMatch?.name || address.city || '',
    };
};

export const formatAddressDisplay = (address = {}) => {
    const resolved = resolveAddressNames(address);
    return [
        resolved.houseNumber,
        resolved.street,
        resolved.barangay,
        resolved.city,
        resolved.province,
        resolved.region,
    ].filter(Boolean).join(', ') || 'Not provided';
};

export const normalizeBranchLabel = (branch = '') => String(branch || '').replace(/\s+branch$/i, '').trim();
