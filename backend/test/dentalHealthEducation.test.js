const assert = require('node:assert/strict');
const test = require('node:test');

const {
    DENTAL_HEALTH_EDUCATION_CATEGORIES,
    DENTAL_HEALTH_EDUCATION_DISCLAIMER,
    EDUCATION_LIBRARY,
    buildContextualDentalHealthEducation,
    buildDentalHealthEducationPayload,
    getDentalHealthEducationArticleById,
    getDentalHealthEducationLibrary,
} = require('../utils/dentalHealthEducation');

test('loads the approved Dental Health Education library', () => {
    const articles = getDentalHealthEducationLibrary();

    assert.ok(Array.isArray(articles));
    assert.ok(articles.length > 0);
    assert.equal(articles.length, EDUCATION_LIBRARY.length);

    articles.forEach((article) => {
        assert.ok(article.id);
        assert.ok(article.title);
        assert.ok(article.categoryId);
        assert.ok(article.category);
        assert.ok(article.summary);
        assert.ok(article.body);
        assert.ok(article.action);
        assert.ok(Array.isArray(article.relatedLogIds));
        assert.ok(Array.isArray(article.keywords));
    });
});

test('provides browsable Dental Health Education categories', () => {
    const categoryIds = DENTAL_HEALTH_EDUCATION_CATEGORIES.map(
        (category) => category.id
    );

    assert.ok(categoryIds.includes('brushing'));
    assert.ok(categoryIds.includes('flossing'));
    assert.ok(categoryIds.includes('gum-care'));
    assert.ok(categoryIds.includes('tooth-sensitivity'));
    assert.ok(categoryIds.includes('toothache'));
    assert.ok(categoryIds.includes('preventive-care'));
    assert.ok(categoryIds.includes('diet-oral-health'));
    assert.ok(categoryIds.includes('smoking-vaping'));
    assert.ok(categoryIds.includes('dental-visits'));
});

test('filters Dental Health Education by category', () => {
    const articles = getDentalHealthEducationLibrary({
        categoryId: 'tooth-sensitivity',
    });

    assert.ok(articles.length > 0);
    assert.ok(
        articles.every(
            (article) => article.categoryId === 'tooth-sensitivity'
        )
    );
    assert.ok(
        articles.some((article) => article.id === 'sensitivity-triggers')
    );
});

test('searches the Dental Health Education library', () => {
    const articles = getDentalHealthEducationLibrary({
        query: 'sugary drinks',
    });

    assert.ok(articles.length > 0);
    assert.ok(articles.some((article) => article.id === 'sugar-exposure'));
});

test('returns unavailable-content state for an unknown education article', () => {
    const article = getDentalHealthEducationArticleById(
        'article-that-does-not-exist'
    );

    assert.equal(article, null);
});

test('returns an education article by id', () => {
    const article = getDentalHealthEducationArticleById(
        'sensitivity-triggers'
    );

    assert.ok(article);
    assert.equal(article.id, 'sensitivity-triggers');
    assert.equal(article.category, 'Tooth Sensitivity');
});

test('maps sensitivity logs to contextual Dental Health Education', () => {
    const articles = buildContextualDentalHealthEducation([
        {
            logDateKey: '2026-08-13',
            symptoms: ['sensitivity'],
            dailyCare: ['brushed-am', 'brushed-pm'],
            riskFactors: [],
        },
    ]);

    const ids = articles.map((article) => article.id);

    assert.ok(ids.includes('sensitivity-triggers'));
});

test('maps bleeding gums to Gum Care and Flossing education', () => {
    const articles = buildContextualDentalHealthEducation(
        [
            {
                logDateKey: '2026-08-13',
                symptoms: ['bleeding-gums'],
                dailyCare: [],
                riskFactors: [],
            },
        ],
        5
    );

    const ids = articles.map((article) => article.id);

    assert.ok(ids.includes('gum-bleeding'));
    assert.ok(ids.includes('interdental-cleaning'));
});

test('maps missed brushing to brushing routine education', () => {
    const articles = buildContextualDentalHealthEducation([
        {
            logDateKey: '2026-08-13',
            symptoms: [],
            dailyCare: [],
            riskFactors: ['missed-brushing'],
        },
    ]);

    const ids = articles.map((article) => article.id);

    assert.ok(ids.includes('brushing-routine'));
});

test('maps flossing to interdental cleaning education', () => {
    const articles = buildContextualDentalHealthEducation([
        {
            logDateKey: '2026-08-13',
            symptoms: [],
            dailyCare: ['flossed'],
            riskFactors: [],
        },
    ]);

    const ids = articles.map((article) => article.id);

    assert.ok(ids.includes('interdental-cleaning'));
});

test('maps sugary drinks to Diet and Oral Health education', () => {
    const articles = buildContextualDentalHealthEducation([
        {
            logDateKey: '2026-08-13',
            symptoms: [],
            dailyCare: [],
            riskFactors: ['sugary-drinks'],
        },
    ]);

    const ids = articles.map((article) => article.id);

    assert.ok(ids.includes('sugar-exposure'));
});

test('maps smoking to Smoking/Vaping and Oral Health education', () => {
    const articles = buildContextualDentalHealthEducation([
        {
            logDateKey: '2026-08-13',
            symptoms: [],
            dailyCare: [],
            riskFactors: ['smoked'],
        },
    ]);

    const ids = articles.map((article) => article.id);

    assert.ok(ids.includes('smoking-vaping-oral-health'));
});

test('maps vaping to Smoking/Vaping and Oral Health education', () => {
    const articles = buildContextualDentalHealthEducation([
        {
            logDateKey: '2026-08-13',
            symptoms: [],
            dailyCare: [],
            riskFactors: ['vaped'],
        },
    ]);

    const ids = articles.map((article) => article.id);

    assert.ok(ids.includes('smoking-vaping-oral-health'));
});

test('uses more recent logs when ordering contextual education', () => {
    const articles = buildContextualDentalHealthEducation(
        [
            {
                logDateKey: '2026-08-13',
                symptoms: ['sensitivity'],
                dailyCare: [],
                riskFactors: [],
            },
            {
                logDateKey: '2026-08-12',
                symptoms: ['sensitivity'],
                dailyCare: [],
                riskFactors: [],
            },
            {
                logDateKey: '2026-08-11',
                symptoms: [],
                dailyCare: [],
                riskFactors: ['sugary-drinks'],
            },
        ],
        2
    );

    assert.equal(articles[0].id, 'sensitivity-triggers');
});

test('returns no contextual education when no related information is logged', () => {
    const articles = buildContextualDentalHealthEducation([
        {
            logDateKey: '2026-08-13',
            symptoms: ['no-symptoms'],
            dailyCare: [],
            riskFactors: [],
        },
    ]);

    assert.deepEqual(articles, []);
});

test('returns no contextual education when log history is unavailable', () => {
    assert.deepEqual(buildContextualDentalHealthEducation([]), []);
    assert.deepEqual(buildContextualDentalHealthEducation(null), []);
});

test('respects contextual education result limit', () => {
    const articles = buildContextualDentalHealthEducation(
        [
            {
                logDateKey: '2026-08-13',
                symptoms: [
                    'sensitivity',
                    'bleeding-gums',
                    'toothache',
                ],
                dailyCare: ['flossed'],
                riskFactors: [
                    'sugary-drinks',
                    'missed-brushing',
                    'smoked',
                ],
            },
        ],
        3
    );

    assert.equal(articles.length, 3);
});

test('builds one shared Dental Health Education payload', () => {
    const payload = buildDentalHealthEducationPayload({
        logs: [
            {
                logDateKey: '2026-08-13',
                symptoms: ['sensitivity'],
                dailyCare: [],
                riskFactors: [],
            },
        ],
    });

    assert.equal(payload.title, 'Dental Health Education');
    assert.equal(
        payload.disclaimer,
        DENTAL_HEALTH_EDUCATION_DISCLAIMER
    );
    assert.ok(Array.isArray(payload.categories));
    assert.ok(Array.isArray(payload.articles));
    assert.ok(Array.isArray(payload.contextualEducation));
    assert.ok(
        payload.contextualEducation.some(
            (article) => article.id === 'sensitivity-triggers'
        )
    );
});

test('approved education content does not contain explicit diagnostic statements', () => {
    const forbiddenDiagnosticStatements = [
        'you have gingivitis',
        'you have cavities',
        'you have periodontal disease',
        'this means you have gingivitis',
        'this means you have cavities',
        'this means you have periodontal disease',
    ];

    EDUCATION_LIBRARY.forEach((article) => {
        const text = [
            article.title,
            article.summary,
            article.body,
            article.action,
        ]
            .join(' ')
            .toLowerCase();

        forbiddenDiagnosticStatements.forEach((statement) => {
            assert.equal(
                text.includes(statement),
                false,
                `${article.id} must not contain diagnostic statement: ${statement}`
            );
        });
    });
});

test('Dental Health Education includes a non-diagnostic disclaimer', () => {
    assert.match(
        DENTAL_HEALTH_EDUCATION_DISCLAIMER,
        /educational information only/i
    );
    assert.match(
        DENTAL_HEALTH_EDUCATION_DISCLAIMER,
        /does not diagnose/i
    );
    assert.match(
        DENTAL_HEALTH_EDUCATION_DISCLAIMER,
        /dentist/i
    );
});