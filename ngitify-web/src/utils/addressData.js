// Ensure region.json, province.json, city.json, and barangay.json are inside src/utils/json/
import regions from './json/region.json';
import provinces from './json/province.json';
import cities from './json/city.json';
import barangays from './json/barangay.json';

export const getRegions = () => {
  return regions || [];
};

export const getProvincesByRegion = (regionCode) => {
  if (!provinces || !regionCode) return [];
  return provinces.filter(province => province.region_code === regionCode);
};

export const getCitiesByProvince = (provinceCode) => {
  if (!cities || !provinceCode) return [];
  return cities.filter(city => city.province_code === provinceCode);
};

export const getBarangaysByCity = (cityCode) => {
  if (!barangays || !cityCode) return [];
  return barangays.filter(barangay => barangay.city_code === cityCode);
};