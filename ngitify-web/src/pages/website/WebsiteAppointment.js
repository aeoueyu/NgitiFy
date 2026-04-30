import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    fullName: '',
    phone: '',
    email: '',
    branch: locationCards[0]?.name || '',
    preferredDate: '',
    preferredTime: '',
    procedure: '',
    notes: '',
};

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

const fullNameRegex = /^[A-Za-z][A-Za-z\s.'-]{1,99}$/;
const phoneRegex = /^(?:\+63|0)\d{10}$/;
const normalizePhone = (value) => value.replace(/[^\d+]/g, '');

export default function WebsiteAppointment() {
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
        const trimmedName = data.fullName.trim().replace(/\s+/g, ' ');
        const trimmedEmail = data.email.trim();
        const trimmedNotes = data.notes.trim();

        if (!trimmedName) nextErrors.fullName = 'Full name is required.';
        else if (!fullNameRegex.test(trimmedName)) nextErrors.fullName = 'Enter a valid full name.';

        if (!data.phone.trim()) nextErrors.phone = 'Phone number is required.';
        else if (!phoneRegex.test(data.phone.trim())) nextErrors.phone = 'Enter a valid Philippine phone number.';

        if (!trimmedEmail) nextErrors.email = 'Email address is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) nextErrors.email = 'Enter a valid email address.';

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
        const { name, value } = event.target;
        const nextValue = name === 'phone' ? normalizePhone(value) : value;

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
        if (errors[name]) {
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
                    fullName: formData.fullName.trim().replace(/\s+/g, ' '),
                    phone: formData.phone.trim(),
                    email: formData.email.trim().toLowerCase(),
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
        } catch {
            setSubmittedMessage('Unable to connect to the server. Please try again.');
            setSubmitState('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <WebsiteShell>
            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <article className={styles.infoCard}>
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

                    <div className={styles.portraitPlaceholder}>
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
                                All fields are required. Time slots follow the same availability rules used in the patient booking flow.
                            </p>
                        </div>

                        {submittedMessage && (
                            <div className={submitState === 'error' ? styles.errorBanner : styles.successBanner}>
                                {submittedMessage}
                            </div>
                        )}

                        <div className={styles.formGrid}>
                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="fullName">Full Name</label>
                                <input
                                    id="fullName"
                                    name="fullName"
                                    className={`${styles.fieldInput} ${errors.fullName ? styles.errorBorder : ''}`}
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    placeholder="Enter your full name"
                                    required
                                />
                                {errors.fullName && <span className={styles.errorText}>{errors.fullName}</span>}
                            </div>

                            <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel} htmlFor="phone">Phone</label>
                                <input
                                    id="phone"
                                    name="phone"
                                    className={`${styles.fieldInput} ${errors.phone ? styles.errorBorder : ''}`}
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="09XXXXXXXXX"
                                    required
                                />
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
                        </div>

                        <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
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
