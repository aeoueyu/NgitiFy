import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaRegCircleCheck, FaRegClock } from 'react-icons/fa6';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import heroImage from '../../assets/images/dentime-dental-clinic-home.svg';
import clinicLifestyleImage from '../../assets/images/clinic-lifestyle-image.jpg';
import estheticsImage from '../../assets/images/esthetics-image.jpg';
import generalDentistryImage from '../../assets/images/general-dentistry-image.jpg';
import oralSurgeryImage from '../../assets/images/oral-surgery-image.jpg';
import orthodonticsImage from '../../assets/images/orthodontics-image.jpg';
import { clinicInfo, serviceHighlights } from '../../data/websiteContent';

const serviceImages = {
    'General Dentistry': generalDentistryImage,
    Orthodontics: orthodonticsImage,
    Esthetics: estheticsImage,
    'Oral Surgery': oralSurgeryImage,
};

export default function WebsiteHome() {
    const navigate = useNavigate();

    return (
        <WebsiteShell>
            <section className={styles.hero}>
                <div className={styles.heroCard}>
                    <p className={styles.eyebrow}>Specialized Dental Care</p>
                    <h1 className={styles.heroTitle}>
                        Bright smiles start with
                        <span className={styles.heroTitleAccent}> care that feels easy to trust.</span>
                    </h1>
                    <p className={styles.heroText}>
                        {clinicInfo.name} delivers approachable, affordable dental care for patients and families,
                        with services ranging from routine cleaning to braces, esthetics, and oral surgery.
                    </p>
                    <div className={styles.buttonRow}>
                        <button className={styles.primaryBtn} onClick={() => navigate('/appointment')} type="button">
                            Book an Appointment
                        </button>
                        <button className={styles.secondaryBtn} onClick={() => navigate('/services')} type="button">
                            View Services
                        </button>
                    </div>
                </div>

                <div className={styles.heroImageCard}>
                    <img src={heroImage} alt="Dentime Dental Clinic" className={styles.heroImage} />
                </div>
            </section>

            <section className={`${styles.section} ${styles.referenceIntroSection}`}>
                <div className={styles.referenceIntroGrid}>
                    <article className={styles.referenceImageCard}>
                        <div className={styles.referenceThumb}>
                            <img src={clinicLifestyleImage} alt="Clinic lifestyle at Dentime Dental Clinic" className={styles.placeholderImage} />
                        </div>
                        <div className={styles.referenceCopy}>
                            <p className={styles.referenceKicker}>Created for your comfort</p>
                            <p className={styles.bodyText}>
                                Gentle care, clear guidance, and a calm clinic experience designed for patients and families.
                            </p>
                        </div>
                    </article>

                    <article className={styles.referenceQuoteCard}>
                        <p className={styles.referenceQuote}>
                            Every smile is unique. Your treatment should feel just as personal.
                        </p>
                        <p className={styles.referenceMeta}>Approachable dental care guided by comfort, clarity, and real needs.</p>
                    </article>

                    <article className={styles.referenceActionCard}>
                        <div>
                            <p className={styles.eyebrow}>Quick Visit</p>
                            <h3 className={styles.cardTitle}>Book a consultation with ease</h3>
                        </div>
                        <button className={styles.consultChip} onClick={() => navigate('/appointment')} type="button">
                            Consultation <FaArrowRight />
                        </button>
                    </article>
                </div>
            </section>

            <section className={`${styles.section} ${styles.editorialSection}`}>
                <div className={styles.editorialIntro}>
                    <p className={styles.featureMiniCopy}>Modern dental care shaped around comfort, precision, and easier visits.</p>
                    <div className={styles.editorialHeadlineBlock}>
                        <h2 className={styles.editorialTitle}>Dental care that feels clearer, calmer, and easier to trust.</h2>
                        <p className={styles.featureDisplayText}>
                            Dentime focuses on approachable treatment planning, friendly communication, and practical care for
                            everyday needs, smile improvement, and more advanced dental concerns.
                        </p>
                    </div>
                </div>

                <div className={styles.editorialGrid}>
                    <article className={styles.editorialStatCard}>
                        <span className={styles.featureStatValue}>4</span>
                        <span className={styles.featureStatLabel}>Core Care Areas</span>
                        <p className={styles.featureStatText}>General Dentistry, Orthodontics, Esthetics, and Oral Surgery.</p>
                    </article>
                    <article className={styles.editorialStatCard}>
                        <span className={styles.featureStatValue}>2</span>
                        <span className={styles.featureStatLabel}>Active Branches</span>
                        <p className={styles.featureStatText}>Serving patients in both Marikina City and Rodriguez, Rizal.</p>
                    </article>
                    <article className={styles.editorialStatementCard}>
                        <p className={styles.editorialStatement}>
                            Clear steps, modern tools, and support that makes dental visits feel less overwhelming.
                        </p>
                    </article>
                </div>
            </section>

            <section className={`${styles.section} ${styles.servicesSpotlightSection}`}>
                <div className={styles.servicesSpotlightHeader}>
                    <div>
                        <p className={styles.eyebrow}>Orthodontic Services</p>
                        <h2 className={styles.sectionTitle}>Care options designed for modern smiles</h2>
                    </div>
                    <button className={styles.consultChip} onClick={() => navigate('/services')} type="button">
                        Explore Services <FaArrowRight />
                    </button>
                </div>

                <div className={styles.servicesShowcaseGrid}>
                    {serviceHighlights.map((service) => (
                        <article key={service.category} className={styles.serviceShowcaseCard}>
                            <div className={styles.serviceImageFrame}>
                                <img src={serviceImages[service.category]} alt={service.category} className={styles.placeholderImage} />
                            </div>
                            <div className={styles.serviceShowcaseBody}>
                                <span className={styles.serviceTag}>{service.category}</span>
                                <h3 className={styles.cardTitle}>{service.category}</h3>
                                <p>{service.description}</p>
                                <div className={styles.serviceMetaRow}>
                                    <span className={styles.serviceMetaBadge}>
                                        {service.items.length} services
                                    </span>
                                    <button className={styles.inlineLink} onClick={() => navigate('/services')} type="button">
                                        Learn More
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <section className={`${styles.section} ${styles.journeySection}`}>
                <div className={styles.journeyHeader}>
                    <div>
                        <p className={styles.eyebrow}>Why Patients Choose Dentime</p>
                        <h2 className={styles.sectionTitle}>A smoother path from first inquiry to in-clinic care</h2>
                    </div>
                    <div className={styles.journeyPills}>
                        <span className={styles.journeyPill}>Scan</span>
                        <span className={styles.journeyPill}>Plan</span>
                        <span className={styles.journeyPill}>Treat</span>
                        <span className={styles.journeyPill}>Follow-up</span>
                    </div>
                </div>

                <div className={styles.journeyGrid}>
                    <div className={styles.journeyStepsColumn}>
                        <h3 className={styles.journeyTitle}>Treatment support that stays clear and guided</h3>
                        <p className={styles.bodyText}>
                            We make it easier to understand what comes next, whether you are visiting for cleaning, braces,
                            restorative work, or a consultation for a bigger treatment plan.
                        </p>
                        <div className={styles.journeyHighlights}>
                            <div className={styles.journeyHighlightItem}>
                                <FaRegCircleCheck />
                                <span>Welcoming clinic experience</span>
                            </div>
                            <div className={styles.journeyHighlightItem}>
                                <FaRegClock />
                                <span>Flexible appointment requests</span>
                            </div>
                        </div>
                    </div>

                    <article className={styles.journeyImageCard}>
                        <div className={styles.journeyImageFrame}>
                            <img src={estheticsImage} alt="Dentime treatment planning" className={styles.placeholderImage} />
                        </div>
                        <p className={styles.journeyImageCaption}>
                            Each visit is handled with practical care, friendly support, and treatment planning that feels easier to follow.
                        </p>
                    </article>
                </div>
            </section>
        </WebsiteShell>
    );
}
