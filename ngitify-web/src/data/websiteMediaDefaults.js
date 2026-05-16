import aboutHeroImage from '../assets/images/about-hero-image.jpg';
import clinicLifestyleImage from '../assets/images/clinic-lifestyle-image.jpg';
import heroImage from '../assets/images/dentime-dental-clinic-home.svg';
import estheticsImage from '../assets/images/esthetics-image.jpg';
import featureImage1 from '../assets/images/feature-image-1.jpg';
import featureImage2 from '../assets/images/feature-image-2.jpg';
import featureImage3 from '../assets/images/feature-image-3.jpg';
import generalDentistryImage from '../assets/images/general-dentistry-image.jpg';
import locationsHeroImage from '../assets/images/locations-hero-image.jpg';
import logoIconImage from '../assets/images/logo.svg';
import logoWordmarkImage from '../assets/images/logo-dentime.svg';
import oralSurgeryImage from '../assets/images/oral-surgery-image.jpg';
import orthodonticsImage from '../assets/images/orthodontics-image.jpg';
import servicesHeroImage from '../assets/images/services-hero-image.jpg';

export const websiteMediaDefaults = {
    logoUrl: logoWordmarkImage,
    logoIconUrl: logoIconImage,
    homeHeroImageUrl: heroImage,
    homeIntroImageUrl: clinicLifestyleImage,
    homeJourneyImageUrl: estheticsImage,
    aboutHeroImageUrl: aboutHeroImage,
    aboutHighlightImageUrls: [featureImage1, featureImage2, featureImage3],
    servicesHeroImageUrl: servicesHeroImage,
    locationsHeroImageUrl: locationsHeroImage,
    locationCardImageUrl: locationsHeroImage,
    contactHeroImageUrl: clinicLifestyleImage,
    contactPhoneImageUrl: featureImage1,
    contactFacebookImageUrl: featureImage2,
    contactInstagramImageUrl: featureImage3,
    contactMapImageUrl: locationsHeroImage,
    appointmentHeroImageUrl: clinicLifestyleImage,
    appointmentGuideImageUrl: featureImage1,
    appointmentBranchImageUrl: locationsHeroImage,
};

export const serviceImageDefaults = {
    'Preventive Dentistry': generalDentistryImage,
    'Orthodontics (Most Popular!)': orthodonticsImage,
    'Diagnostic Services': generalDentistryImage,
    Prosthodontic: generalDentistryImage,
    Endodontics: generalDentistryImage,
    'Cosmetic and Restorative Dentistry': estheticsImage,
    'Oral Surgery': oralSurgeryImage,
    'Pediatric Dentistry': generalDentistryImage,
};

export const getDefaultServiceImage = (category = '') => (
    serviceImageDefaults[category] || generalDentistryImage
);
