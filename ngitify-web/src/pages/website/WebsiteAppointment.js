import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import {
    privacyPolicySections,
    privacyPolicyUpdatedAt,
    privacyPolicyVersion,
} from '../../data/consentDocument';
import { publicFetch } from '../../utils/api';
import { usePublicClinicConfig } from '../../hooks/usePublicClinicConfig';

const buildInitialForm = ({ branchOptions = [], appointmentProcedureOptions = [] } = {}) => ({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    birthdate: '',
    gender: '',
    privacyConsent: false,
    turnstileToken: '',
    branch: branchOptions[0] || '',
    preferredDate: '',
    preferredTime: '',
    procedure: appointmentProcedureOptions[0] || '',
    notes: '',
});

const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '';

const MANILA_TIME_ZONE = 'Asia/Manila';
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
const formatDateKey = (value = new Date()) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = Object.fromEntries(
        dateKeyFormatter.formatToParts(date).map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
};
const getTodayString = () => formatDateKey(new Date());
const toMonthString = (dateString) => (dateString ? dateString.slice(0, 7) : getTodayString().slice(0, 7));
const addDaysToDateString = (dateString, daysToAdd) => {
    const baseDate = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(baseDate.getTime())) return dateString;
    baseDate.setDate(baseDate.getDate() + daysToAdd);
    return formatDateKey(baseDate);
};
const findNextAvailableDate = (startDate, blockedDateList = [], maxDaysToCheck = 90) => {
    const blockedSet = new Set(Array.isArray(blockedDateList) ? blockedDateList : []);
    let candidate = startDate || getTodayString();
    for (let index = 0; index <= maxDaysToCheck; index += 1) {
        if (!blockedSet.has(candidate)) return candidate;
        candidate = addDaysToDateString(candidate, 1);
    }
    return startDate || getTodayString();
};
const to12h = (time24) => {
    if (!time24) return '';
    const [hourText, minute] = time24.split(':');
    const hour = Number(hourText);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
};
const formatReadableDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-PH', {
        timeZone: MANILA_TIME_ZONE,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const personNameRegex = /^[A-Za-z][A-Za-z\s.'-]{0,49}$/;
const phoneRegex = /^9\d{9}$/;
const normalizePhone = (value) => value.replace(/[^0-9]/g, '').slice(0, 10);
const toTitleCase = (value) => value.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());
const buildFullName = ({ firstName, lastName }) => (
    [firstName, lastName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
);

export default function WebsiteAppointment() {
    const {
        clinicInfo,
        locationCards,
        appointmentProcedures: appointmentProcedureOptions,
        websiteContent,
    } = usePublicClinicConfig();
    const appointmentContent = websiteContent.appointmentPage;
    const media = websiteContent.media;
    const branchOptions = useMemo(
        () => locationCards.map((location) => location.name).filter(Boolean),
        [locationCards]
    );
    const turnstileContainerRef = useRef(null);
    const turnstileWidgetIdRef = useRef(null);
    const [formData, setFormData] = useState(() => buildInitialForm({ branchOptions, appointmentProcedureOptions }));
    const [errors, setErrors] = useState({});
    const [submittedMessage, setSubmittedMessage] = useState('');
    const [submitState, setSubmitState] = useState('idle');
    const [successModalMessage, setSuccessModalMessage] = useState('');
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [errorModalMessage, setErrorModalMessage] = useState('');
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [slotsError, setSlotsError] = useState('');
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [blockedDates, setBlockedDates] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [captchaReady, setCaptchaReady] = useState(false);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

    const renderTurnstile = useCallback(() => {
        if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current || !window.turnstile) return;
        if (turnstileWidgetIdRef.current !== null) return;

        turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token) => {
                setFormData((prev) => ({ ...prev, turnstileToken: token }));
                setErrors((prev) => ({ ...prev, turnstileToken: '' }));
            },
            'expired-callback': () => {
                setFormData((prev) => ({ ...prev, turnstileToken: '' }));
            },
            'error-callback': () => {
                setFormData((prev) => ({ ...prev, turnstileToken: '' }));
            },
        });
        setCaptchaReady(true);
    }, []);

    useEffect(() => {
        if (!TURNSTILE_SITE_KEY) return;

        if (window.turnstile) {
            renderTurnstile();
            return;
        }

        const existingScript = document.querySelector('script[data-turnstile-script="true"]');
        if (existingScript) {
            existingScript.addEventListener('load', renderTurnstile);
            return () => existingScript.removeEventListener('load', renderTurnstile);
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.turnstileScript = 'true';
        script.addEventListener('load', renderTurnstile);
        document.body.appendChild(script);

        return () => script.removeEventListener('load', renderTurnstile);
    }, [renderTurnstile]);

    useEffect(() => {
        if (branchOptions.length === 0 && appointmentProcedureOptions.length === 0) return;

        setFormData((prev) => ({
            ...prev,
            branch: branchOptions.includes(prev.branch) ? prev.branch : (branchOptions[0] || ''),
            procedure: appointmentProcedureOptions.includes(prev.procedure)
                ? prev.procedure
                : (appointmentProcedureOptions[0] || ''),
        }));
    }, [appointmentProcedureOptions, branchOptions]);

    const fetchBlockedDates = useCallback(async (branch, month) => {
        if (!branch) return;
        try {
            const blockedDatesUrl = month
                ? `/public/appointments/blocked-dates?branch=${encodeURIComponent(branch)}&month=${month}`
                : `/public/appointments/blocked-dates?branch=${encodeURIComponent(branch)}`;
            const response = await publicFetch(blockedDatesUrl);
            if (response.status === 404) {
                setBlockedDates([]);
                return;
            }
            if (!response.ok) throw new Error();
            const data = await response.json();
            setBlockedDates(Array.isArray(data.blockedDates) ? data.blockedDates : []);
        } catch {
            setBlockedDates([]);
        }
    }, []);

    const fetchSlots = useCallback(async (date, branch) => {
        if (!date || !branch) return;
        setLoadingSlots(true);
        setSlotsError('');
        try {
            const response = await publicFetch(`/public/appointments/slots?date=${date}&branch=${encodeURIComponent(branch)}`);
            if (response.status === 404) {
                throw new Error('The website appointment service is not yet available on the live server. Please redeploy the backend first.');
            }
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Could not load appointment slots.');
            }
            const data = await response.json();
            setAllowedSlots(Array.isArray(data.allowedSlots) ? data.allowedSlots : []);
            setTakenSlots(Array.isArray(data.takenSlots) ? data.takenSlots : []);
        } catch (error) {
            setAllowedSlots([]);
            setTakenSlots([]);
            setSlotsError(error.message || 'Could not load appointment slots. Please try again.');
        } finally {
            setLoadingSlots(false);
        }
    }, []);

    useEffect(() => {
        fetchBlockedDates(formData.branch, formData.preferredDate ? toMonthString(formData.preferredDate) : '');
    }, [fetchBlockedDates, formData.branch, formData.preferredDate]);

    useEffect(() => {
        if (!formData.preferredDate) {
            setAllowedSlots([]);
            setTakenSlots([]);
            return;
        }
        fetchSlots(formData.preferredDate, formData.branch);
    }, [fetchSlots, formData.branch, formData.preferredDate]);

    const minBookableDate = useMemo(
        () => findNextAvailableDate(getTodayString(), blockedDates),
        [blockedDates]
    );

    useEffect(() => {
        if (!formData.preferredDate) return;
        if (formData.preferredDate < minBookableDate) {
            setFormData((prev) => ({ ...prev, preferredDate: minBookableDate, preferredTime: '' }));
        }
    }, [formData.preferredDate, minBookableDate]);

    const visibleSlots = useMemo(
        () => allowedSlots.filter((slot) => !takenSlots.includes(slot)),
        [allowedSlots, takenSlots]
    );

    const getFieldError = useCallback((fieldName, data, { live = false } = {}) => {
        const trimmedFirstName = data.firstName.trim();
        const trimmedLastName = data.lastName.trim();
        const trimmedEmail = data.email.trim();
        const trimmedPhone = data.phone.trim();
        const trimmedNotes = data.notes.trim();

        switch (fieldName) {
        case 'firstName':
            if (!trimmedFirstName) return 'First name is required.';
            if (!personNameRegex.test(trimmedFirstName)) return 'Enter a valid first name.';
            return '';
        case 'lastName':
            if (!trimmedLastName) return 'Last name is required.';
            if (!personNameRegex.test(trimmedLastName)) return 'Enter a valid last name.';
            return '';
        case 'phone':
            if (!trimmedPhone) return 'Phone number is required.';
            if (live && !trimmedPhone.startsWith('9')) return 'Phone number must start with 9.';
            if (live && trimmedPhone.startsWith('9') && trimmedPhone.length < 10) return '';
            if (!phoneRegex.test(trimmedPhone)) return 'Use the same format as registration: 9xxxxxxxxx.';
            return '';
        case 'email':
            if (!trimmedEmail) return 'Email address is required.';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return 'Enter a valid email address.';
            return '';
        case 'birthdate': {
            if (!data.birthdate) return 'Birthdate is required.';
            const selectedBirthdate = new Date(`${data.birthdate}T12:00:00`);
            if (Number.isNaN(selectedBirthdate.getTime())) return 'Choose a valid birthdate.';
            if (selectedBirthdate >= new Date()) return 'Birthdate must be in the past.';
            return '';
        }
        case 'gender':
            return data.gender ? '' : 'Gender is required.';
        case 'privacyConsent':
            return data.privacyConsent ? '' : 'Please agree to the data privacy notice before submitting.';
        case 'turnstileToken':
            if (!TURNSTILE_SITE_KEY) return 'Captcha is not configured yet. Please contact the clinic.';
            return data.turnstileToken ? '' : 'Please complete the captcha before submitting.';
        case 'branch':
            return data.branch ? '' : 'Branch is required.';
        case 'preferredDate': {
            if (!data.preferredDate) return 'Preferred date is required.';
            const selectedDate = new Date(`${data.preferredDate}T12:00:00`);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (Number.isNaN(selectedDate.getTime())) return 'Choose a valid date.';
            if (selectedDate < today) return 'Choose today or a future date.';
            if (selectedDate.getDay() === 0) return 'Sunday appointments are not available.';
            if (data.preferredDate < minBookableDate) return 'Choose the next available appointment date.';
            if (blockedDates.includes(data.preferredDate)) {
                return data.preferredDate === getTodayString()
                    ? 'Same-day booking is no longer available for today. Please choose another date.'
                    : 'That date is already fully booked.';
            }
            return '';
        }
        case 'preferredTime':
            if (!data.preferredTime) return 'Preferred time is required.';
            if (!visibleSlots.includes(data.preferredTime)) return 'Choose an available time slot.';
            return '';
        case 'procedure':
            if (!data.procedure) return 'Procedure is required.';
            if (!appointmentProcedureOptions.includes(data.procedure)) return 'Choose a valid procedure.';
            return '';
        case 'notes':
            if (trimmedNotes && trimmedNotes.length < 10) return 'Please provide a bit more detail or leave this blank.';
            return '';
        default:
            return '';
        }
    }, [appointmentProcedureOptions, blockedDates, minBookableDate, visibleSlots]);

    const validate = useCallback((data) => {
        const nextErrors = {};
        [
            'firstName',
            'lastName',
            'phone',
            'email',
            'birthdate',
            'gender',
            'privacyConsent',
            'turnstileToken',
            'branch',
            'preferredDate',
            'preferredTime',
            'procedure',
            'notes',
        ].forEach((fieldName) => {
            const fieldError = getFieldError(fieldName, data);
            if (fieldError) {
                nextErrors[fieldName] = fieldError;
            }
        });
        return nextErrors;
    }, [getFieldError]);

    const handleChange = (event) => {
        const { name, type, value, checked } = event.target;
        const nextValue = name === 'phone'
                ? normalizePhone(value)
                : ['firstName', 'lastName'].includes(name)
                    ? (value === '' || /^[A-Za-z\s.'-]+$/.test(value) ? toTitleCase(value) : formData[name])
                : type === 'checkbox'
                    ? checked
                    : value;

        setFormData((prev) => {
            const nextState = { ...prev, [name]: nextValue };

            if (name === 'branch') {
                nextState.preferredDate = '';
                nextState.preferredTime = '';
            }

            if (name === 'preferredDate') {
                nextState.preferredTime = '';
            }

            return nextState;
        });

        setSubmittedMessage('');
        setSubmitState('idle');
        setIsSuccessModalOpen(false);
        setIsErrorModalOpen(false);

        setErrors((prev) => {
            const nextErrors = { ...prev };
            const liveError = getFieldError(name, {
                ...formData,
                ...(name === 'branch' ? { branch: nextValue, preferredDate: '', preferredTime: '' } : {}),
                ...(name === 'preferredDate' ? { preferredDate: nextValue, preferredTime: '' } : {}),
                [name]: nextValue,
            }, { live: true });

            if (liveError) nextErrors[name] = liveError;
            else delete nextErrors[name];

            if (name === 'branch' || name === 'preferredDate') {
                delete nextErrors.preferredDate;
                delete nextErrors.preferredTime;
            }

            return nextErrors;
        });
    };

    const handleBlur = (event) => {
        const { name } = event.target;
        setErrors((prev) => {
            const nextErrors = { ...prev };
            const fieldError = getFieldError(name, formData, { live: true });
            if (fieldError) nextErrors[name] = fieldError;
            else delete nextErrors[name];
            return nextErrors;
        });
    };

    const handleTimeSelect = (slot) => {
        const nextState = { ...formData, preferredTime: slot };
        setFormData(nextState);
        setErrors((prev) => {
            const nextErrors = { ...prev };
            const fieldError = getFieldError('preferredTime', nextState, { live: true });
            if (fieldError) nextErrors.preferredTime = fieldError;
            else delete nextErrors.preferredTime;
            return nextErrors;
        });
        setSubmittedMessage('');
        setIsSuccessModalOpen(false);
        setIsErrorModalOpen(false);
    };

    useEffect(() => {
        const liveValidationState = {
            preferredDate: formData.preferredDate,
            preferredTime: formData.preferredTime,
        };

        setErrors((prev) => {
            const nextErrors = { ...prev };
            const nextPreferredDateError = getFieldError('preferredDate', liveValidationState, { live: true });
            const nextPreferredTimeError = getFieldError('preferredTime', liveValidationState, { live: true });

            if (formData.preferredDate || prev.preferredDate) {
                if (nextPreferredDateError) nextErrors.preferredDate = nextPreferredDateError;
                else delete nextErrors.preferredDate;
            }

            if (formData.preferredTime || prev.preferredTime) {
                if (nextPreferredTimeError) nextErrors.preferredTime = nextPreferredTimeError;
                else delete nextErrors.preferredTime;
            }

            const changedKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(nextErrors)]));
            const hasChanges = changedKeys.some((key) => prev[key] !== nextErrors[key]);
            return hasChanges ? nextErrors : prev;
        });
    }, [blockedDates, formData.preferredDate, formData.preferredTime, getFieldError, minBookableDate, visibleSlots]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const nextErrors = validate(formData);
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) return;

        setIsSubmitting(true);
        setSubmittedMessage('');
        setSubmitState('idle');

        try {
            const response = await publicFetch('/public/appointments/request', {
                method: 'POST',
                body: JSON.stringify({
                    fullName: buildFullName(formData),
                    firstName: formData.firstName.trim(),
                    lastName: formData.lastName.trim(),
                    phone: formData.phone.trim(),
                    email: formData.email.trim().toLowerCase(),
                    birthdate: formData.birthdate,
                    gender: formData.gender,
                    privacyConsent: formData.privacyConsent,
                    turnstileToken: formData.turnstileToken,
                    branch: formData.branch,
                    date: formData.preferredDate,
                    time: formData.preferredTime,
                    procedure: formData.procedure,
                    notes: formData.notes.trim(),
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (response.status === 404) {
                setSubmittedMessage('The website appointment service is not yet available on the live server. Please redeploy the backend first.');
                setSubmitState('error');
                return;
            }
            if (!response.ok) {
                const conflictMessage = String(data.message || '');
                if (
                    response.status === 409
                    && conflictMessage.includes('This email already belongs to a registered patient')
                ) {
                    setErrorModalMessage(conflictMessage);
                    setIsErrorModalOpen(true);
                    setSubmittedMessage('');
                    setSubmitState('error');
                    if (window.turnstile && turnstileWidgetIdRef.current !== null) {
                        window.turnstile.reset(turnstileWidgetIdRef.current);
                        setFormData((prev) => ({ ...prev, turnstileToken: '' }));
                    }
                    return;
                }
                setSubmittedMessage(data.message || 'Unable to submit your request right now.');
                setSubmitState('error');
                if (window.turnstile && turnstileWidgetIdRef.current !== null) {
                    window.turnstile.reset(turnstileWidgetIdRef.current);
                    setFormData((prev) => ({ ...prev, turnstileToken: '' }));
                }
                return;
            }

            setSuccessModalMessage(
                data.existingPatientMatched
                    ? `Your appointment request for ${formData.branch} on ${formatReadableDate(formData.preferredDate)} at ${to12h(formData.preferredTime)} has been sent using your existing patient record. The clinic will email you once it is confirmed.`
                    : `Your appointment request for ${formData.branch} on ${formatReadableDate(formData.preferredDate)} at ${to12h(formData.preferredTime)} has been sent. The clinic will email you once it is confirmed.`
            );
            setSubmitState('success');
            setIsSuccessModalOpen(true);
            setSubmittedMessage('');
            setFormData(buildInitialForm({ branchOptions, appointmentProcedureOptions }));
            setErrors({});
            setAllowedSlots([]);
            setTakenSlots([]);
            if (window.turnstile && turnstileWidgetIdRef.current !== null) {
                window.turnstile.reset(turnstileWidgetIdRef.current);
            }
        } catch {
            setSubmittedMessage('Unable to connect to the server. Please try again.');
            setSubmitState('error');
            if (window.turnstile && turnstileWidgetIdRef.current !== null) {
                window.turnstile.reset(turnstileWidgetIdRef.current);
                setFormData((prev) => ({ ...prev, turnstileToken: '' }));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>{appointmentContent.eyebrow}</p>
                        <h1 className={styles.sectionTitle}>{appointmentContent.title}</h1>
                        <p className={styles.bodyText}>{appointmentContent.description}</p>
                        <div className={styles.buttonRow}>
                            <a href={clinicInfo.facebookUrl} target="_blank" rel="noreferrer" className={styles.secondaryBtn}>
                                {appointmentContent.facebookCtaLabel}
                            </a>
                            <a href={`tel:${clinicInfo.contactNumber}`} className={styles.secondaryBtn}>
                                {appointmentContent.callCtaLabel}
                            </a>
                        </div>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <img src={media.appointmentHeroImageUrl} alt={`${clinicInfo.name} appointment`} className={styles.placeholderImage} />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
                        <div>
                            <p className={styles.eyebrow}>{appointmentContent.formEyebrow}</p>
                            <h2 className={styles.sectionTitle}>{appointmentContent.formTitle}</h2>
                            <p className={styles.bodyText}>{appointmentContent.formDescription}</p>
                            {!TURNSTILE_SITE_KEY && (
                                <p className={styles.errorText}>
                                    Captcha is not configured yet. Add `REACT_APP_TURNSTILE_SITE_KEY` before using the public booking form.
                                </p>
                            )}
                        </div>

                        {submittedMessage && submitState === 'error' && (
                            <div className={styles.errorBanner}>
                                {submittedMessage}
                            </div>
                        )}

                        <div className={styles.formGrid}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="firstName">First Name</label>
                                <input
                                    id="firstName"
                                    name="firstName"
                                    className={`${styles.fieldInput} ${errors.firstName ? styles.errorBorder : ''}`}
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Enter your first name"
                                    required
                                />
                                {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="lastName">Last Name</label>
                                <input
                                    id="lastName"
                                    name="lastName"
                                    className={`${styles.fieldInput} ${errors.lastName ? styles.errorBorder : ''}`}
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Enter your last name"
                                    required
                                />
                                {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="phone">Phone</label>
                                <div className={`${styles.phoneInputGroup} ${errors.phone ? styles.errorBorder : ''}`}>
                                    <span className={styles.phonePrefix}>+63</span>
                                    <input
                                        id="phone"
                                        name="phone"
                                        className={styles.phoneField}
                                        value={formData.phone}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        inputMode="numeric"
                                        maxLength={10}
                                        placeholder="9xxxxxxxxx"
                                        required
                                    />
                                </div>
                                {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    className={`${styles.fieldInput} ${errors.email ? styles.errorBorder : ''}`}
                                    value={formData.email}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="name@example.com"
                                    required
                                />
                                {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="birthdate">Date of Birth</label>
                                <input
                                    id="birthdate"
                                    type="date"
                                    name="birthdate"
                                    className={`${styles.fieldInput} ${errors.birthdate ? styles.errorBorder : ''}`}
                                    value={formData.birthdate}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    max={getTodayString()}
                                    required
                                />
                                {errors.birthdate && <span className={styles.errorText}>{errors.birthdate}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="gender">Gender</label>
                                <select
                                    id="gender"
                                    name="gender"
                                    className={`${styles.fieldSelect} ${errors.gender ? styles.errorBorder : ''}`}
                                    value={formData.gender}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                >
                                    <option value="" disabled>Select gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                                {errors.gender && <span className={styles.errorText}>{errors.gender}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="branch">Branch</label>
                                <select
                                    id="branch"
                                    name="branch"
                                    className={`${styles.fieldSelect} ${errors.branch ? styles.errorBorder : ''}`}
                                    value={formData.branch}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                >
                                    <option value="" disabled>Select a branch</option>
                                    {branchOptions.map((branchName) => (
                                        <option key={branchName} value={branchName}>{branchName}</option>
                                    ))}
                                </select>
                                {errors.branch && <span className={styles.errorText}>{errors.branch}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="preferredDate">Preferred Date</label>
                                <input
                                    id="preferredDate"
                                    type="date"
                                    name="preferredDate"
                                    className={`${styles.fieldInput} ${errors.preferredDate ? styles.errorBorder : ''}`}
                                    value={formData.preferredDate}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    min={minBookableDate}
                                    required
                                />
                                {errors.preferredDate && <span className={styles.errorText}>{errors.preferredDate}</span>}
                                {blockedDates.includes(getTodayString()) && minBookableDate !== getTodayString() && (
                                    <span className={styles.helperText}>Same-day online booking is no longer available for today. Please choose the next available date.</span>
                                )}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="procedure">Procedure</label>
                                <select
                                    id="procedure"
                                    name="procedure"
                                    className={`${styles.fieldSelect} ${errors.procedure ? styles.errorBorder : ''}`}
                                    value={formData.procedure}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                >
                                    {appointmentProcedureOptions.map((procedure) => (
                                        <option key={procedure} value={procedure}>{procedure}</option>
                                    ))}
                                </select>
                                {errors.procedure && <span className={styles.errorText}>{errors.procedure}</span>}
                                <p className={styles.helperText}>{appointmentContent.procedureHelperText}</p>
                            </div>

                            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                <label className={styles.fieldLabel}>Preferred Time</label>
                                {!formData.preferredDate ? (
                                    <p className={styles.helperText}>Select a date first to view available time slots.</p>
                                ) : loadingSlots ? (
                                    <p className={styles.helperText}>Loading available time slots...</p>
                                ) : slotsError ? (
                                    <p className={styles.errorText}>{slotsError}</p>
                                ) : visibleSlots.length === 0 ? (
                                    <p className={styles.helperText}>No available slots for the selected date. Please choose another date.</p>
                                ) : (
                                    <div className={styles.slotGrid}>
                                        {visibleSlots.map((slot) => {
                                            const isSelected = formData.preferredTime === slot;
                                            return (
                                                <button
                                                    key={slot}
                                                    type="button"
                                                    className={`${styles.slotChip} ${isSelected ? styles.slotChipSelected : ''}`}
                                                    onClick={() => handleTimeSelect(slot)}
                                                >
                                                    {to12h(slot)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {errors.preferredTime && <span className={styles.errorText}>{errors.preferredTime}</span>}
                            </div>

                            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                <label className={styles.fieldLabel} htmlFor="notes">Concern / Message (Optional)</label>
                                <textarea
                                    id="notes"
                                    name="notes"
                                    className={`${styles.fieldTextarea} ${errors.notes ? styles.errorBorder : ''}`}
                                    value={formData.notes}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    placeholder="Tell the clinic about your concern, symptoms, or anything important for your visit."
                                />
                                {errors.notes && <span className={styles.errorText}>{errors.notes}</span>}
                                <span className={styles.helperText}>{appointmentContent.notesHelperText}</span>
                            </div>

                            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                <label
                                    className={`${styles.consentCard} ${errors.privacyConsent ? styles.errorBorder : ''}`}
                                    htmlFor="privacyConsent"
                                >
                                    <input
                                        id="privacyConsent"
                                        type="checkbox"
                                        name="privacyConsent"
                                        className={styles.consentCheckbox}
                                        checked={formData.privacyConsent}
                                        onChange={handleChange}
                                        onBlur={handleBlur}
                                        required
                                    />
                                    <span className={styles.consentText}>
                                        I have read and agree to the Privacy Policy of Dentime Dental Clinic. By submitting this form,
                                        I consent to the collection, use, and processing of my personal data for appointment scheduling,
                                        patient care coordination, and related clinic communications, in accordance with Republic Act No. 10173,
                                        or the Data Privacy Act of 2012.
                                    </span>
                                </label>
                                <button type="button" className={styles.inlineLinkBtn} onClick={() => setIsPrivacyModalOpen(true)}>
                                    View Privacy Policy
                                </button>
                                {errors.privacyConsent && <span className={styles.errorText}>{errors.privacyConsent}</span>}
                            </div>

                            <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                                <label className={styles.fieldLabel}>Captcha Verification</label>
                                <div className={`${styles.captchaCard} ${errors.turnstileToken ? styles.errorBorder : ''}`}>
                                    <div ref={turnstileContainerRef} />
                                    {!captchaReady && TURNSTILE_SITE_KEY && (
                                        <p className={styles.helperText}>Loading captcha verification...</p>
                                    )}
                                </div>
                                {errors.turnstileToken && <span className={styles.errorText}>{errors.turnstileToken}</span>}
                            </div>
                        </div>

                        <button type="submit" className={styles.primaryBtn} disabled={isSubmitting || (!TURNSTILE_SITE_KEY)}>
                            {isSubmitting ? appointmentContent.submittingButtonLabel : appointmentContent.submitButtonLabel}
                        </button>
                    </form>

                    <div className={styles.stack}>
                        <article className={styles.infoCard}>
                            <p className={styles.eyebrow}>{appointmentContent.guideEyebrow}</p>
                            <h2 className={styles.sectionTitle}>{appointmentContent.guideTitle}</h2>
                            <ul className={styles.bulletList}>
                                {appointmentContent.steps.map((step) => (
                                    <li key={step}>{step}</li>
                                ))}
                            </ul>
                        </article>

                        <div className={styles.bannerPlaceholder}>
                            <img src={media.appointmentGuideImageUrl} alt="Booking guide" className={styles.placeholderImage} />
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <p className={styles.eyebrow}>{appointmentContent.branchEyebrow}</p>
                    <h2 className={styles.sectionTitle}>{appointmentContent.branchTitle}</h2>
                </div>
                <div className={styles.gridTwo}>
                    {locationCards.map((location) => (
                        <article key={location.name} className={styles.locationCard}>
                            <div className={styles.bannerPlaceholder}>
                                <img src={media.appointmentBranchImageUrl} alt={location.name} className={styles.placeholderImage} />
                            </div>
                            <span className={styles.statusPill}>{location.status}</span>
                            <h3 className={styles.cardTitle}>{location.name}</h3>
                            <p>{location.address}</p>
                            <p>{location.note}</p>
                        </article>
                    ))}
                </div>
            </section>

            {isPrivacyModalOpen && (
                <div className={styles.privacyModalOverlay} role="dialog" aria-modal="true" aria-labelledby="privacy-policy-title">
                    <div className={styles.privacyModal}>
                        <div className={styles.privacyModalHeader}>
                            <div>
                                <p className={styles.eyebrow}>Privacy Policy</p>
                                <h3 id="privacy-policy-title" className={styles.privacyModalTitle}>Dentime Dental Clinic Privacy Policy</h3>
                                <p className={styles.bodyText}>Version {privacyPolicyVersion} • Last updated {privacyPolicyUpdatedAt}</p>
                            </div>
                            <button type="button" className={styles.inlineLinkBtn} onClick={() => setIsPrivacyModalOpen(false)}>
                                Close
                            </button>
                        </div>
                        <div className={styles.privacyModalBody}>
                            {privacyPolicySections.map((section) => (
                                <article key={section.heading} className={styles.privacyPolicyCard}>
                                    <h4>{section.heading}</h4>
                                    <p>{section.body}</p>
                                </article>
                            ))}
                        </div>
                        <div className={styles.privacyModalFooter}>
                            <button type="button" className={styles.primaryBtn} onClick={() => setIsPrivacyModalOpen(false)}>
                                I Understand
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSuccessModalOpen && successModalMessage && (
                <div className={styles.bookingSuccessOverlay} role="dialog" aria-modal="true" aria-labelledby="booking-success-title">
                    <div className={styles.bookingSuccessModal}>
                        <p className={styles.eyebrow}>Appointment Sent</p>
                        <h3 id="booking-success-title" className={styles.privacyModalTitle}>Request received</h3>
                        <p className={styles.bodyText}>{successModalMessage}</p>
                        <div className={styles.bookingSuccessActions}>
                            <button type="button" className={styles.secondaryBtn} onClick={() => setIsSuccessModalOpen(false)}>
                                Close
                            </button>
                            <button type="button" className={styles.primaryBtn} onClick={() => setIsSuccessModalOpen(false)}>
                                Book Another Appointment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isErrorModalOpen && errorModalMessage && (
                <div className={styles.bookingSuccessOverlay} role="dialog" aria-modal="true" aria-labelledby="booking-conflict-title">
                    <div className={styles.bookingSuccessModal}>
                        <p className={styles.eyebrow}>Booking Conflict</p>
                        <h3 id="booking-conflict-title" className={styles.privacyModalTitle}>Existing patient details do not match</h3>
                        <p className={styles.bodyText}>{errorModalMessage}</p>
                        <div className={styles.bookingSuccessActions}>
                            <button type="button" className={styles.primaryBtn} onClick={() => setIsErrorModalOpen(false)}>
                                I Understand
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </WebsiteShell>
    );
}
