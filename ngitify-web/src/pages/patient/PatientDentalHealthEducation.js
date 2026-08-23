import React, { useEffect, useMemo, useState } from 'react';
import { FaBook, FaInfoCircle } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { openPatientAiChat } from '../../utils/patientAiChat';
import {
    PatientEmptyState,
    PatientPageFrame,
    PatientSectionHeader,
} from '../../components/patient/PatientFrame';
import styles from '../../styles/patient/PatientPortal.module.css';

const toCategoryId = (article = {}) => {
    const label = String(article.category || 'Dental Health Education').trim();
    return String(
        article.categoryId
        || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        || 'dental-health-education'
    );
};

export default function PatientDentalHealthEducation() {
    const { user } = useAuth();
    const [oralHealth, setOralHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [educationCategory, setEducationCategory] = useState('all');
    const [educationQuery, setEducationQuery] = useState('');
    const [selectedEducationId, setSelectedEducationId] = useState('');

    useEffect(() => {
        let isMounted = true;

        const fetchEducation = async () => {
            try {
                const response = await authFetch('/my/oral-health');
                const payload = await response.json().catch(() => ({}));
                if (!isMounted) return;

                if (!response.ok) {
                    setError(payload.message || 'Could not load Dental Health Education.');
                    return;
                }

                setOralHealth(payload);
                setError('');
            } catch {
                if (isMounted) setError('Unable to connect to Dental Health Education.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchEducation();
        return () => { isMounted = false; };
    }, []);

    const educationArticles = useMemo(
        () => Array.isArray(oralHealth?.education) ? oralHealth.education : [],
        [oralHealth?.education]
    );

    const recommendedEducation = useMemo(
        () => Array.isArray(oralHealth?.contextualEducation)
            ? oralHealth.contextualEducation.slice(0, 3)
            : [],
        [oralHealth?.contextualEducation]
    );

    const educationCategories = useMemo(() => {
        const categoryMap = new Map();
        educationArticles.forEach((article) => {
            const id = toCategoryId(article);
            if (!categoryMap.has(id)) {
                categoryMap.set(id, {
                    id,
                    label: String(article.category || 'Dental Health Education').trim(),
                });
            }
        });
        return Array.from(categoryMap.values());
    }, [educationArticles]);

    const filteredEducationArticles = useMemo(() => {
        const query = educationQuery.trim().toLowerCase();
        return educationArticles.filter((article) => {
            if (educationCategory !== 'all' && toCategoryId(article) !== educationCategory) return false;
            if (!query) return true;

            return [
                article.title,
                article.category,
                article.summary,
                article.body,
                article.action,
                ...(Array.isArray(article.keywords) ? article.keywords : []),
            ].filter(Boolean).join(' ').toLowerCase().includes(query);
        });
    }, [educationArticles, educationCategory, educationQuery]);

    const selectedEducationArticle = useMemo(() => {
        if (!filteredEducationArticles.length) return null;
        return filteredEducationArticles.find((article) => article.id === selectedEducationId)
            || filteredEducationArticles[0];
    }, [filteredEducationArticles, selectedEducationId]);

    const openArticle = (articleId) => {
        setEducationCategory('all');
        setEducationQuery('');
        setSelectedEducationId(articleId || '');
    };

    return (
        <PatientPageFrame
            title="Dental Health Education"
            subtitle={`Approved oral-health information and practical guidance for ${user?.assignedBranch || 'your assigned branch'}.`}
            actions={(
                <button type="button" className={styles.buttonSecondary} onClick={openPatientAiChat}>
                    Open NgitiBot
                </button>
            )}
        >
            <div className={styles.educationShell}>
                <section className={styles.summaryCard}>
                    <PatientSectionHeader
                        eyebrow="Dental Health Education"
                        title="Learn from approved oral-health topics"
                    />
                    <p className={styles.toolText}>
                        Browse information about everyday oral care, symptoms to discuss with your dentist,
                        preventive care, diet, smoking or vaping, and dental visits.
                    </p>
                    <div className={styles.educationDisclaimer}>
                        <FaInfoCircle aria-hidden="true" focusable="false" />
                        <p>
                            This information is educational and does not diagnose a dental condition.
                            Contact your dentist or clinic about persistent, worsening, or concerning symptoms.
                        </p>
                    </div>
                    {error ? <div className={styles.noticeBox}>{error}</div> : null}
                </section>

                {!loading && recommendedEducation.length ? (
                    <section className={styles.summaryCard}>
                        <PatientSectionHeader
                            eyebrow="Recommended for You"
                            title="Related to your recent Oral Health Management logs"
                        />
                        <p className={styles.toolText}>
                            These educational topics match information you recorded. This matching does not determine a diagnosis.
                        </p>
                        <div className={styles.educationRecommendations} style={{ marginTop: '16px' }}>
                            {recommendedEducation.map((article) => (
                                <button
                                    key={article.id}
                                    type="button"
                                    className={styles.educationRecommendationCard}
                                    onClick={() => openArticle(article.id)}
                                >
                                    <span className={styles.heroTag}>{article.category || 'Dental Health Education'}</span>
                                    <strong>{article.title}</strong>
                                    <span>{article.summary}</span>
                                    <small>Read topic</small>
                                </button>
                            ))}
                        </div>
                    </section>
                ) : null}

                <section className={styles.summaryCard}>
                    <PatientSectionHeader eyebrow="Education Library" title="Browse Dental Health Education" />

                    <div className={styles.educationControls}>
                        <label className={styles.educationSearchLabel} htmlFor="dental-health-education-search">
                            Search topics
                        </label>
                        <input
                            id="dental-health-education-search"
                            type="search"
                            className={styles.educationSearchInput}
                            value={educationQuery}
                            onChange={(event) => {
                                setEducationQuery(event.target.value);
                                setSelectedEducationId('');
                            }}
                            placeholder="Search brushing, sensitivity, gum care..."
                            autoComplete="off"
                        />
                        <div className={styles.educationCategoryRow} aria-label="Dental Health Education categories">
                            <button
                                type="button"
                                className={`${styles.educationCategoryButton} ${educationCategory === 'all' ? styles.educationCategoryButtonActive : ''}`}
                                onClick={() => {
                                    setEducationCategory('all');
                                    setSelectedEducationId('');
                                }}
                                aria-pressed={educationCategory === 'all'}
                            >
                                All Topics
                            </button>
                            {educationCategories.map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    className={`${styles.educationCategoryButton} ${educationCategory === category.id ? styles.educationCategoryButtonActive : ''}`}
                                    onClick={() => {
                                        setEducationCategory(category.id);
                                        setSelectedEducationId('');
                                    }}
                                    aria-pressed={educationCategory === category.id}
                                >
                                    {category.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className={styles.noticeBox}>Loading education topics...</div>
                    ) : filteredEducationArticles.length ? (
                        <div className={styles.educationLibraryLayout}>
                            <div className={styles.educationArticleList} aria-label="Dental Health Education topics">
                                {filteredEducationArticles.map((article) => {
                                    const isSelected = selectedEducationArticle?.id === article.id;
                                    return (
                                        <button
                                            key={article.id}
                                            type="button"
                                            className={`${styles.educationArticleCard} ${isSelected ? styles.educationArticleCardActive : ''}`}
                                            onClick={() => setSelectedEducationId(article.id)}
                                            aria-pressed={isSelected}
                                        >
                                            <span className={styles.heroTag}>{article.category || 'Dental Health Education'}</span>
                                            <strong>{article.title}</strong>
                                            <span>{article.summary}</span>
                                            <small>{isSelected ? 'Currently selected' : 'View article'}</small>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedEducationArticle ? (
                                <article className={styles.educationArticleDetail} aria-labelledby="selected-education-title">
                                    <span className={styles.heroTag}>{selectedEducationArticle.category || 'Dental Health Education'}</span>
                                    <h3 id="selected-education-title" className={styles.educationDetailTitle}>
                                        {selectedEducationArticle.title}
                                    </h3>
                                    <p className={styles.educationDetailSummary}>{selectedEducationArticle.summary}</p>
                                    <div className={styles.educationDetailBody}>
                                        <p>{selectedEducationArticle.body || selectedEducationArticle.summary}</p>
                                    </div>
                                    {selectedEducationArticle.action ? (
                                        <div className={styles.educationDetailAction}>
                                            <strong>What you can do</strong>
                                            <p>{selectedEducationArticle.action}</p>
                                        </div>
                                    ) : null}
                                    <div className={styles.educationDisclaimer}>
                                        <FaInfoCircle aria-hidden="true" focusable="false" />
                                        <p>
                                            This topic is educational and is not a diagnosis. Consider contacting the clinic if symptoms continue, worsen, or concern you.
                                        </p>
                                    </div>
                                </article>
                            ) : null}
                        </div>
                    ) : (
                        <PatientEmptyState
                            icon={<FaBook />}
                            title="No education topics found"
                            message={error
                                ? 'Education topics are currently unavailable. Please try again later.'
                                : 'Try another category or clear your search to browse the full library.'}
                            action={!error ? (
                                <button
                                    type="button"
                                    className={styles.buttonSecondary}
                                    onClick={() => {
                                        setEducationCategory('all');
                                        setEducationQuery('');
                                        setSelectedEducationId('');
                                    }}
                                >
                                    Show All Topics
                                </button>
                            ) : null}
                        />
                    )}
                </section>
            </div>
        </PatientPageFrame>
    );
}
