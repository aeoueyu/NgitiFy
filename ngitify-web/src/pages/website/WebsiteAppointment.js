import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import {
    appointmentProcedures,
    appointmentSteps,
    clinicInfo,
    locationCards,
} from '../../data/websiteContent';
import { publicFetch } from '../../utils/api';

const initialForm = {
    firstName: '',
    middleName: '',
    lastName: '',
    phone: '',
    email: '',
    birthdate: '',
    gender: '',
    privacyConsent: false,
    turnstileToken: '',
    branch: locationCards[0]?.name || '',
    preferredDate: '',
    preferredTime: '',
    procedure: '',
    notes: '',
};

const TURNSTILE_SITE_KEY = process.env.REACT_APP_TURNSTILE_SITE_KEY || '';

const getTodayString = () => new Date().toISOString().split('T')[0];
const toMonthString = (dateString) => (dateString ? dateString.slice(0, 7) : new Date().toISOString().slice(0, 7));
const to12h = (time24) => {
    if (!time24) return '';
    const [hourText, minute] = time24.split(':');
    const hour = Number(hourText);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
};

const isSlotPast = (slot24, dateStr) => {
    if (!slot24 || !dateStr || dateStr !== getTodayString()) return false;
    const now = new Date();
    const [hour, minute] = slot24.split(':').map(Number);
    const slotMinutes = hour * 60 + minute;
    const bufferMinutes = now.getHours() * 60 + now.getMinutes() + 30;
    return slotMinutes <= bufferMinutes;
};

const personNameRegex = /^[A-Za-z][A-Za-z\s.'-]{0,49}$/;
const phoneRegex = /^9\d{9}$/;
const normalizePhone = (value) => value.replace(/[^0-9]/g, '').slice(0, 10);
const toTitleCase = (value) => value.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());
const buildFullName = ({ firstName, middleName, lastName }) => (
    [firstName, middleName, lastName]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
);

export default function WebsiteAppointment() {
    const turnstileContainerRef = useRef(null);
    const turnstileWidgetIdRef = useRef(null);
    const [formData, setFormData] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [submittedMessage, setSubmittedMessage] = useState('');
    const [submitState, setSubmitState] = useState('idle');
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [slotsError, setSlotsError] = useState('');
    const [allowedSlots, setAllowedSlots] = useState([]);
    const [takenSlots, setTakenSlots] = useState([]);
    const [blockedDates, setBlockedDates] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [captchaReady, setCaptchaReady] = useState(false);

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

    const fetchBlockedDates = useCallback(async (branch, month) => {
        if (!branch) return;
        try {
            const response = await publicFetch(`/public/appointments/blocked-dates?branch=${encodeURIComponent(branch)}&month=${month}`);
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
        fetchBlockedDates(formData.branch, toMonthString(formData.preferredDate));
    }, [fetchBlockedDates, formData.branch, formData.preferredDate]);

    useEffect(() => {
        if (!formData.preferredDate) {
            setAllowedSlots([]);
            setTakenSlots([]);
            return;
        }
        fetchSlots(formData.preferredDate, formData.branch);
    }, [fetchSlots, formData.branch, formData.preferredDate]);

    const visibleSlots = useMemo(
        () => allowedSlots.filter((slot) => !takenSlots.includes(slot) && !isSlotPast(slot, formData.preferredDate)),
        [allowedSlots, formData.preferredDate, takenSlots]
    );

    const validate = useCallback((data) => {
        const nextErrors = {};
        const trimmedFirstName = data.firstName.trim();
        const trimmedMiddleName = data.middleName.trim();
        const trimmedLastName = data.lastName.trim();
        const trimmedEmail = data.email.trim();
        const trimmedNotes = data.notes.trim();

        if (!trimmedFirstName) nextErrors.firstName = 'First name is required.';
        else if (!personNameRegex.test(trimmedFirstName)) nextErrors.firstName = 'Enter a valid first name.';

        if (trimmedMiddleName && !personNameRegex.test(trimmedMiddleName)) nextErrors.middleName = 'Enter a valid middle name.';

        if (!trimmedLastName) nextErrors.lastName = 'Last name is required.';
        else if (!personNameRegex.test(trimmedLastName)) nextErrors.lastName = 'Enter a valid last name.';

        if (!data.phone.trim()) nextErrors.phone = 'Phone number is required.';
        else if (!phoneRegex.test(data.phone.trim())) nextErrors.phone = 'Use the same format as registration: 9xxxxxxxxx.';

        if (!trimmedEmail) nextErrors.email = 'Email address is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) nextErrors.email = 'Enter a valid email address.';

        if (!data.birthdate) nextErrors.birthdate = 'Birthdate is required.';
        else {
            const selectedBirthdate = new Date(`${data.birthdate}T12:00:00`);
            if (Number.isNaN(selectedBirthdate.getTime())) nextErrors.birthdate = 'Choose a valid birthdate.';
            else if (selectedBirthdate >= new Date()) nextErrors.birthdate = 'Birthdate must be in the past.';
        }

        if (!data.gender) nextErrors.gender = 'Gender is required.';

        if (!data.privacyConsent) nextErrors.privacyConsent = 'Please agree to the data privacy notice before submitting.';

        if (!TURNSTILE_SITE_KEY) nextErrors.turnstileToken = 'Captcha is not configured yet. Please contact the clinic.';
        else if (!data.turnstileToken) nextErrors.turnstileToken = 'Please complete the captcha before submitting.';

        if (!data.branch) nextErrors.branch = 'Branch is required.';

        if (!data.preferredDate) nextErrors.preferredDate = 'Preferred date is required.';
        else {
            const selectedDate = new Date(`${data.preferredDate}T12:00:00`);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (Number.isNaN(selectedDate.getTime())) nextErrors.preferredDate = 'Choose a valid date.';
            else if (selectedDate < today) nextErrors.preferredDate = 'Choose today or a future date.';
            else if (selectedDate.getDay() === 0) nextErrors.preferredDate = 'Sunday appointments are not available.';
            else if (blockedDates.includes(data.preferredDate)) nextErrors.preferredDate = 'That date is already fully booked.';
        }

        if (!data.preferredTime) nextErrors.preferredTime = 'Preferred time is required.';
        else if (!visibleSlots.includes(data.preferredTime)) nextErrors.preferredTime = 'Choose an available time slot.';

        if (!data.procedure) nextErrors.procedure = 'Procedure is required.';
        else if (!appointmentProcedures.includes(data.procedure)) nextErrors.procedure = 'Choose a valid procedure.';

        if (!trimmedNotes) nextErrors.notes = 'Please tell the clinic about your concern.';
        else if (trimmedNotes.length < 10) nextErrors.notes = 'Please provide a bit more detail.';

        return nextErrors;
    }, [blockedDates, visibleSlots]);

    const handleChange = (event) => {
        const { name, type, value, checked } = event.target;
        const nextValue = name === 'phone'
                ? normalizePhone(value)
                : ['firstName', 'middleName', 'lastName'].includes(name)
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
        if (name === 'phone') {
            setErrors((prev) => {
                const nextErrors = { ...prev };
                if (!nextValue) nextErrors.phone = '';
                else if (!nextValue.startsWith('9')) nextErrors.phone = 'Phone number must start with 9.';
                else if (nextValue.length === 10 && !phoneRegex.test(nextValue)) nextErrors.phone = 'Use the same format as registration: 9xxxxxxxxx.';
                else nextErrors.phone = '';
                return nextErrors;
            });
        } else if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
        if (name === 'branch' || name === 'preferredDate') {
            setErrors((prev) => ({ ...prev, preferredDate: '', preferredTime: '' }));
        }
    };

    const handleTimeSelect = (slot) => {
        setFormData((prev) => ({ ...prev, preferredTime: slot }));
        setErrors((prev) => ({ ...prev, preferredTime: '' }));
        setSubmittedMessage('');
    };

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
                    middleName: formData.middleName.trim(),
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
                setSubmittedMessage(data.message || 'Unable to submit your request right now.');
                setSubmitState('error');
                return;
            }

            setSubmittedMessage(
                `Your appointment request for ${formData.branch} on ${formData.preferredDate} at ${to12h(formData.preferredTime)} has been sent. The clinic will email you once it is confirmed.`
            );
            setSubmitState('success');
            setFormData(initialForm);
            setErrors({});
            setAllowedSlots([]);
            setTakenSlots([]);
            if (window.turnstile && turnstileWidgetIdRef.current !== null) {
                window.turnstile.reset(turnstileWidgetIdRef.current);
            }
        } catch {
            setSubmittedMessage('Unable to connect to the server. Please try again.');
            setSubmitState('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>Appointment</p>
                        <h1 className={styles.sectionTitle}>Send your appointment request</h1>
                        <p className={styles.bodyText}>
                            Guests can request an appointment here even if they are not yet official clinic patients.
                            Once the clinic confirms your schedule, a confirmation email will be sent to you automatically.
                        </p>
                        <div className={styles.buttonRow}>
                            <a href={clinicInfo.facebookUrl} target="_blank" rel="noreferrer" className={styles.secondaryBtn}>
                                Message on Facebook
                            </a>
                            <a href={`tel:${clinicInfo.contactNumber}`} className={styles.secondaryBtn}>
                                Call the Clinic
                            </a>
                        </div>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <span className={styles.placeholderLabel}>Appointment Hero Image Placeholder</span>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
                        <div>
                            <p className={styles.eyebrow}>Request Form</p>
                            <h2 className={styles.sectionTitle}>Book with Dentime</h2>
                            <p className={styles.bodyText}>
                                Required fields should match the same patient registration details used by the clinic.
                            </p>
                            {!TURNSTILE_SITE_KEY && (
                                <p className={styles.errorText}>
                                    Captcha is not configured yet. Add `REACT_APP_TURNSTILE_SITE_KEY` before using the public booking form.
                                </p>
                            )}
                        </div>

                        {submittedMessage && (
                            <div className={submitState === 'error' ? styles.errorBanner : styles.successBanner}>
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
                                    placeholder="Enter your first name"
                                    required
                                />
                                {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="middleName">Middle Name</label>
                                <input
                                    id="middleName"
                                    name="middleName"
                                    className={`${styles.fieldInput} ${errors.middleName ? styles.errorBorder : ''}`}
                                    value={formData.middleName}
                                    onChange={handleChange}
                                    placeholder="Enter your middle name"
                                />
                                {errors.middleName && <span className={styles.errorText}>{errors.middleName}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="lastName">Last Name</label>
                                <input
                                    id="lastName"
                                    name="lastName"
                                    className={`${styles.fieldInput} ${errors.lastName ? styles.errorBorder : ''}`}
                                    value={formData.lastName}
                                    onChange={handleChange}
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
                                    required
                                >
                                    <option value="" disabled>Select a branch</option>
                                    {locationCards.map((location) => (
                                        <option key={location.name} value={location.name}>{location.name}</option>
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
                                    min={getTodayString()}
                                    required
                                />
                                {errors.preferredDate && <span className={styles.errorText}>{errors.preferredDate}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="procedure">Procedure</label>
                                <select
                                    id="procedure"
                                    name="procedure"
                                    className={`${styles.fieldSelect} ${errors.procedure ? styles.errorBorder : ''}`}
                                    value={formData.procedure}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="" disabled>Select a procedure</option>
                                    {appointmentProcedures.map((procedure) => (
                                        <option key={procedure} value={procedure}>{procedure}</option>
                                    ))}
                                </select>
                                {errors.procedure && <span className={styles.errorText}>{errors.procedure}</span>}
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
                                <label className={styles.fieldLabel} htmlFor="notes">Concern / Message</label>
                                <textarea
                                    id="notes"
                                    name="notes"
                                    className={`${styles.fieldTextarea} ${errors.notes ? styles.errorBorder : ''}`}
                                    value={formData.notes}
                                    onChange={handleChange}
                                    placeholder="Tell the clinic about your concern, symptoms, or anything important for your visit."
                                    required
                                />
                                {errors.notes && <span className={styles.errorText}>{errors.notes}</span>}
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
                                        required
                                    />
                                    <span className={styles.consentText}>
                                        I agree to the collection and processing of my personal information for appointment scheduling,
                                        patient coordination, and clinic follow-up related to this request.
                                    </span>
                                </label>
                                <p className={styles.helperText}>
                                    This consent only covers the information needed to review and manage your appointment request.
                                </p>
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
                            {isSubmitting ? 'Sending Request...' : 'Send Appointment Request'}
                        </button>
                    </form>

                    <div className={styles.stack}>
                        <article className={styles.infoCard}>
                            <p className={styles.eyebrow}>How It Works</p>
                            <h2 className={styles.sectionTitle}>Guest appointment guide</h2>
                            <ul className={styles.bulletList}>
                                {appointmentSteps.map((step) => (
                                    <li key={step}>{step}</li>
                                ))}
                            </ul>
                        </article>

                        <div className={styles.bannerPlaceholder}>
                            <span className={styles.placeholderLabel}>Booking Guide Image Placeholder</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <p className={styles.eyebrow}>Choose a Branch</p>
                    <h2 className={styles.sectionTitle}>Where would you like to visit?</h2>
                </div>
                <div className={styles.gridTwo}>
                    {locationCards.map((location) => (
                        <article key={location.name} className={styles.locationCard}>
                            <div className={styles.bannerPlaceholder}>
                                <span className={styles.placeholderLabel}>{location.name} Placeholder</span>
                            </div>
                            <span className={styles.statusPill}>{location.status}</span>
                            <h3 className={styles.cardTitle}>{location.name}</h3>
                            <p>{location.address}</p>
                            <p>{location.note}</p>
                        </article>
                    ))}
                </div>
            </section>
        </WebsiteShell>
    );
}
