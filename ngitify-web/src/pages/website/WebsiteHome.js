import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRight, FaRegCircleCheck, FaRegClock } from 'react-icons/fa6';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import { usePublicClinicConfig } from '../../hooks/usePublicClinicConfig';

export default function WebsiteHome() {
    const navigate = useNavigate();
    const { clinicInfo, locationCards, serviceHighlights, websiteContent } = usePublicClinicConfig();
    const homeContent = websiteContent.home;
    const media = websiteContent.media;
    const journeyIcons = [FaRegCircleCheck, FaRegClock];

    return (
        <WebsiteShell>
            <section className={styles.hero}>
                <div className={styles.heroCard}>
                    <p className={styles.eyebrow}>{homeContent.heroEyebrow}</p>
                    <h1 className={styles.heroTitle}>
                        {homeContent.heroTitleLead}
                        <span className={styles.heroTitleAccent}> {homeContent.heroTitleAccent}</span>
                    </h1>
                    <p className={styles.heroText}>{homeContent.heroDescription}</p>
                    <p className={styles.referenceMeta}>{clinicInfo.tagline}</p>
                    <div className={styles.buttonRow}>
                        <button className={styles.primaryBtn} onClick={() => navigate('/appointment')} type="button">
                            {homeContent.primaryCtaLabel}
                        </button>
                        <button className={styles.secondaryBtn} onClick={() => navigate('/services')} type="button">
                            {homeContent.secondaryCtaLabel}
                        </button>
                    </div>
                </div>

                <div className={styles.heroImageCard}>
                    <img src={media.homeHeroImageUrl} alt={clinicInfo.name} className={styles.heroImage} />
                </div>
            </section>

            <section className={`${styles.section} ${styles.referenceIntroSection}`}>
                <div className={styles.referenceIntroGrid}>
                    <article className={styles.referenceImageCard}>
                        <div className={styles.referenceThumb}>
                            <img src={media.homeIntroImageUrl} alt={`${clinicInfo.name} clinic lifestyle`} className={styles.placeholderImage} />
                        </div>
                        <div className={styles.referenceCopy}>
                            <p className={styles.referenceKicker}>{homeContent.introKicker}</p>
                            <p className={styles.bodyText}>{homeContent.introDescription}</p>
                        </div>
                    </article>

                    <article className={styles.referenceQuoteCard}>
                        <p className={styles.referenceQuote}>{homeContent.quoteText}</p>
                        <p className={styles.referenceMeta}>{homeContent.quoteMeta}</p>
                    </article>

                    <article className={styles.referenceActionCard}>
                        <div>
                            <p className={styles.eyebrow}>{homeContent.quickVisitEyebrow}</p>
                            <h3 className={styles.cardTitle}>{homeContent.quickVisitTitle}</h3>
                        </div>
                        <button className={styles.consultChip} onClick={() => navigate('/appointment')} type="button">
                            {homeContent.quickVisitCtaLabel} <FaArrowRight />
                        </button>
                    </article>
                </div>
            </section>

            <section className={`${styles.section} ${styles.editorialSection}`}>
                <div className={styles.editorialIntro}>
                    <p className={styles.featureMiniCopy}>{homeContent.editorialMiniCopy}</p>
                    <div className={styles.editorialHeadlineBlock}>
                        <h2 className={styles.editorialTitle}>{homeContent.editorialTitle}</h2>
                        <p className={styles.featureDisplayText}>{homeContent.editorialDescription}</p>
                    </div>
                </div>

                <div className={styles.editorialGrid}>
                    <article className={styles.editorialStatCard}>
                        <span className={styles.featureStatValue}>{serviceHighlights.length}</span>
                        <span className={styles.featureStatLabel}>{homeContent.coreCareAreasLabel}</span>
                        <p className={styles.featureStatText}>{homeContent.coreCareAreasDescription}</p>
                    </article>
                    <article className={styles.editorialStatCard}>
                        <span className={styles.featureStatValue}>{locationCards.length}</span>
                        <span className={styles.featureStatLabel}>{homeContent.activeBranchesLabel}</span>
                        <p className={styles.featureStatText}>{homeContent.activeBranchesDescription}</p>
                    </article>
                    <article className={styles.editorialStatementCard}>
                        <p className={styles.editorialStatement}>{homeContent.editorialStatement}</p>
                    </article>
                </div>
            </section>

            <section className={`${styles.section} ${styles.servicesSpotlightSection}`}>
                <div className={styles.servicesSpotlightHeader}>
                    <div>
                        <p className={styles.eyebrow}>{homeContent.servicesEyebrow}</p>
                        <h2 className={styles.sectionTitle}>{homeContent.servicesTitle}</h2>
                    </div>
                    <button className={styles.consultChip} onClick={() => navigate('/services')} type="button">
                        {homeContent.servicesCtaLabel} <FaArrowRight />
                    </button>
                </div>

                <div className={styles.servicesShowcaseGrid}>
                            {serviceHighlights.map((service) => (
                                <article key={service.category} className={styles.serviceShowcaseCard}>
                                    <div className={styles.serviceImageFrame}>
                                        <img src={service.imageUrl} alt={service.category} className={styles.placeholderImage} />
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
                        <p className={styles.eyebrow}>{homeContent.journeyEyebrow}</p>
                        <h2 className={styles.sectionTitle}>{homeContent.journeyTitle}</h2>
                    </div>
                    <div className={styles.journeyPills}>
                        {homeContent.journeyPills.map((pill) => (
                            <span key={pill} className={styles.journeyPill}>{pill}</span>
                        ))}
                    </div>
                </div>

                <div className={styles.journeyGrid}>
                    <div className={styles.journeyStepsColumn}>
                        <h3 className={styles.journeyTitle}>{homeContent.journeyCardTitle}</h3>
                        <p className={styles.bodyText}>{homeContent.journeyDescription}</p>
                        <div className={styles.journeyHighlights}>
                            {homeContent.journeyHighlights.map((highlight, index) => {
                                const Icon = journeyIcons[index] || FaRegCircleCheck;
                                return (
                                    <div key={highlight} className={styles.journeyHighlightItem}>
                                        <Icon />
                                        <span>{highlight}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <article className={styles.journeyImageCard}>
                        <div className={styles.journeyImageFrame}>
                            <img src={media.homeJourneyImageUrl} alt={`${clinicInfo.name} treatment planning`} className={styles.placeholderImage} />
                        </div>
                        <p className={styles.journeyImageCaption}>{homeContent.journeyCaption}</p>
                    </article>
                </div>
            </section>
        </WebsiteShell>
    );
}
