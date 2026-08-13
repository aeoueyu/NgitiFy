import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBook,
    FaCalendarAlt,
    FaChartLine,
    FaCheckCircle,
    FaInfoCircle,
    FaPlus,
    FaTooth,
    FaTimes,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { getStaticOralCarePreview } from '../../utils/oralCarePreview';
import { authFetch } from '../../utils/api';
import {
    formatDateDisplay,
    parseDateKey,
    toDateKey,
} from '../../utils/patientPortal';
import {
    PatientEmptyState,
    PatientPageFrame,
    PatientSectionHeader,
} from '../../components/patient/PatientFrame';
import PatientMonthCalendar from '../../components/patient/PatientMonthCalendar';
import styles from '../../styles/patient/PatientPortal.module.css';

const TRACKER_TABS = [
    { id: 'today', label: 'Today', icon: FaTooth },
    { id: 'calendar', label: 'Calendar', icon: FaCalendarAlt },
    { id: 'trends', label: 'Trends', icon: FaChartLine },
    { id: 'education', label: 'Dental Health Education', icon: FaBook },
];

const EMPTY_LIST = Object.freeze([]);
const DAILY_CARE_TREND_IDS = ['brushed-am', 'brushed-pm', 'flossed', 'mouthwash'];
const SYMPTOM_TREND_IDS = [
    'toothache',
    'bleeding-gums',
    'swelling',
    'bad-breath',
    'sensitivity',
    'jaw-pain',
    'mouth-sore',
];
const RISK_TREND_IDS = ['smoked', 'vaped', 'sugary-drinks', 'missed-brushing'];

function useVisitPrediction() {
    const [visitPrediction, setVisitPrediction] = useState(null);

    React.useEffect(() => {
        let isMounted = true;
        const fetchPrediction = async () => {
            try {
                const response = await authFetch('/my/visit-prediction');
                if (!response.ok) return;
                const payload = await response.json();
                if (isMounted) setVisitPrediction(payload?.prediction || null);
            } catch {
                if (isMounted) setVisitPrediction(null);
            }
        };

        fetchPrediction();
        return () => {
            isMounted = false;
        };
    }, []);

    return visitPrediction;
}

const getLabelMap = (groups = []) => {
    const map = new Map();
    groups.forEach((group) => {
        (group.items || []).forEach((item) => {
            map.set(item.id, item.label || item.id);
        });
    });
    return map;
};

const buildEditableLogGroups = (groups = [], log = null) => (
    groups.map((group) => ({
        ...group,
        items: (group.items || []).map((item) => ({
            ...item,
            selected: group.id === 'symptoms'
                ? (log?.symptoms || []).includes(item.id)
                : group.id === 'riskFactors'
                    ? (log?.riskFactors || []).includes(item.id)
                    : (log?.dailyCare || []).includes(item.id),
        })),
    }))
);

const summarizeLog = (log, labelMap) => {
    if (!log) return 'No information recorded for this date yet.';
    const dailyCare = (log.dailyCare || []).map((id) => labelMap.get(id) || id);
    const symptoms = (log.symptoms || []).map((id) => labelMap.get(id) || id);
    const riskFactors = (log.riskFactors || []).map((id) => labelMap.get(id) || id);
    const parts = [];
    if (dailyCare.length) parts.push(`Care: ${dailyCare.join(', ')}`);
    if (symptoms.length) parts.push(`Signals: ${symptoms.join(', ')}`);
    if (riskFactors.length) parts.push(`Other: ${riskFactors.join(', ')}`);
    if (log.notes) parts.push(`Note: ${log.notes}`);
    return parts.length ? parts.join('. ') : 'Saved entry with no visible selections.';
};

const isFutureDateKey = (key) => {
    const selected = parseDateKey(key);
    const today = parseDateKey(toDateKey(new Date()));
    return Boolean(selected && today && selected > today);
};

const getWeekDates = (date) => {
    const start = new Date(date);
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());

    return Array.from({ length: 7 }, (_, index) => {
        const item = new Date(start);
        item.setDate(start.getDate() + index);
        return item;
    });
};

const toAppointmentDate = (appointment) => {
    const raw = appointment?.date || appointment?.createdAt;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getDentistLabel = (appointment) => {
    if (appointment?.dentist?.name) {
        return `Dr. ${appointment.dentist.name.first || ''} ${appointment.dentist.name.last || ''}`.trim();
    }
    if (appointment?.dentistName) return appointment.dentistName;
    return 'Dentist to be assigned';
};

const getLogsInLastDays = (logs = [], days = 7) => {
    const end = parseDateKey(toDateKey(new Date()));
    const start = parseDateKey(toDateKey(new Date()));
    if (!start || !end) return [];
    start.setDate(start.getDate() - (days - 1));

    return logs.filter((log) => {
        const date = parseDateKey(log.logDateKey);
        return date && date >= start && date <= end;
    });
};

const buildTrendRows = (windowLogs, ids, field, labelMap, days) => ids.map((id) => {
    const count = windowLogs.filter((log) => (log[field] || []).includes(id)).length;
    return {
        id,
        label: labelMap.get(id) || id,
        count,
        value: `${count} of last ${days} days`,
    };
});

const buildOccurrenceRows = (windowLogs, ids, field, labelMap) => ids
    .map((id) => {
        const count = windowLogs.filter((log) => (log[field] || []).includes(id)).length;
        return {
            id,
            label: labelMap.get(id) || id,
            count,
            value: `${count} ${count === 1 ? 'day' : 'days'}`,
        };
    })
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

const getRelatedEducationForLog = (log, articles = []) => {
    if (!log) return [];
    const selections = new Set([
        ...(log.symptoms || []),
        ...(log.dailyCare || []),
        ...(log.riskFactors || []),
    ].filter((id) => id && id !== 'no-symptoms'));

    return (articles || []).filter((article) => (
        (article.relatedLogIds || []).some((id) => selections.has(id))
    ));
};

export default function PatientOralCare() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();
    const visitPrediction = useVisitPrediction();

    const [activeTab, setActiveTab] = useState('today');
    const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [oralHealth, setOralHealth] = useState(null);
    const [oralHealthError, setOralHealthError] = useState('');
    const [saving, setSaving] = useState(false);
    const [factors, setFactors] = useState([]);
    const [logGroups, setLogGroups] = useState([]);
    const [logNotes, setLogNotes] = useState('');
    const [symptomDetails, setSymptomDetails] = useState({});
    const [detailSymptomId, setDetailSymptomId] = useState('');
    const [monthExpanded, setMonthExpanded] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [treatmentLogs, setTreatmentLogs] = useState([]);

    const preview = useMemo(() => getStaticOralCarePreview(visitPrediction, oralHealth), [visitPrediction, oralHealth]);
    const baseLogGroups = useMemo(() => oralHealth?.logGroups || preview.logGroups, [oralHealth?.logGroups, preview.logGroups]);
    const labelMap = useMemo(() => getLabelMap(baseLogGroups), [baseLogGroups]);
    const logs = useMemo(() => oralHealth?.logs || [], [oralHealth?.logs]);
    const selectedLog = useMemo(
        () => logs.find((log) => log.logDateKey === selectedDateKey) || null,
        [logs, selectedDateKey]
    );
    const todayKey = toDateKey(new Date());
    const selectedDate = useMemo(() => parseDateKey(selectedDateKey) || new Date(), [selectedDateKey]);
    const selectedDateLabel = formatDateDisplay(selectedDate, { weekday: 'long', month: 'long' });
    const selectedDateIsFuture = isFutureDateKey(selectedDateKey);
    const selectedWeekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

    React.useEffect(() => {
        let isMounted = true;
        const fetchOralHealth = async () => {
            try {
                const response = await authFetch('/my/oral-health');
                const payload = await response.json().catch(() => ({}));
                if (!isMounted) return;
                if (!response.ok) {
                    setOralHealthError(payload.message || 'Could not load oral health data.');
                    return;
                }
                setOralHealth(payload);
                setOralHealthError('');
            } catch {
                if (isMounted) setOralHealthError('Unable to connect to the oral health service.');
            }
        };

        fetchOralHealth();
        return () => {
            isMounted = false;
        };
    }, []);

    React.useEffect(() => {
        let isMounted = true;
        const patientId = user?.id || user?._id || user?.userId;
        if (!patientId) return undefined;

        const fetchClinicEvents = async () => {
            const [appointmentsResponse, treatmentResponse] = await Promise.allSettled([
                authFetch(`/appointments?patientId=${patientId}`),
                authFetch('/my/treatment-logs'),
            ]);

            if (!isMounted) return;

            if (appointmentsResponse.status === 'fulfilled' && appointmentsResponse.value.ok) {
                const payload = await appointmentsResponse.value.json().catch(() => []);
                setAppointments(Array.isArray(payload) ? payload : []);
            } else {
                setAppointments([]);
            }

            if (treatmentResponse.status === 'fulfilled' && treatmentResponse.value.ok) {
                const payload = await treatmentResponse.value.json().catch(() => []);
                setTreatmentLogs(Array.isArray(payload) ? payload : []);
            } else {
                setTreatmentLogs([]);
            }
        };

        fetchClinicEvents();
        return () => {
            isMounted = false;
        };
    }, [user?.id, user?._id, user?.userId]);

    React.useEffect(() => {
        setFactors(preview.factors);
    }, [preview.factors]);

    React.useEffect(() => {
        setLogGroups(buildEditableLogGroups(baseLogGroups, selectedLog));
        setLogNotes(selectedLog?.notes || '');
        setSymptomDetails(selectedLog?.symptomDetails || {});
        setDetailSymptomId('');
    }, [baseLogGroups, selectedLog]);

    const activeFactors = factors.filter((item) => item.active && item.id !== 'none');
    const todayLog = logs.find((log) => log.logDateKey === todayKey) || null;
    const todaySummary = summarizeLog(todayLog, labelMap);
    const appointmentsByDate = useMemo(() => {
        const grouped = new Map();
        appointments.forEach((appointment) => {
            const date = toAppointmentDate(appointment);
            const key = toDateKey(date);
            if (!key) return;
            grouped.set(key, [...(grouped.get(key) || []), appointment]);
        });
        return grouped;
    }, [appointments]);

    const treatmentLogsByDate = useMemo(() => {
        const grouped = new Map();
        treatmentLogs.forEach((log) => {
            const key = toDateKey(log.date);
            if (!key) return;
            grouped.set(key, [...(grouped.get(key) || []), log]);
        });
        return grouped;
    }, [treatmentLogs]);

    const selectedAppointments = appointmentsByDate.get(selectedDateKey) || EMPTY_LIST;
    const selectedTreatmentLogs = treatmentLogsByDate.get(selectedDateKey) || EMPTY_LIST;
    const selectedDateHasRecommendation = visitPrediction?.recommendedDateKey === selectedDateKey;
    const selectedContextualEducation = useMemo(
        () => getRelatedEducationForLog(selectedLog, preview.education.articles),
        [preview.education.articles, selectedLog]
    );
    const selectedSourceEvents = useMemo(() => {
        const events = [];
        if (selectedLog) {
            events.push({
                id: 'patient-log',
                source: 'Patient Log',
                title: selectedLog.symptoms?.length ? 'Daily log with symptoms' : 'Daily log',
                body: summarizeLog(selectedLog, labelMap),
            });
        }
        selectedAppointments.forEach((appointment) => {
            events.push({
                id: `appointment-${appointment._id || appointment.id || appointment.date}`,
                source: 'Clinic Record',
                title: appointment.procedure || 'Dental appointment',
                body: `${appointment.time || 'Time pending'} - ${getDentistLabel(appointment)} - ${appointment.status || 'pending'}`,
            });
        });
        selectedTreatmentLogs.forEach((log) => {
            events.push({
                id: `treatment-${log._id || log.date || log.procedure}`,
                source: 'Clinic Record',
                title: log.procedure || 'Treatment record',
                body: [log.tooth ? `Tooth ${log.tooth}` : '', log.dentistName || '', log.notes || 'Clinic-entered treatment history.'].filter(Boolean).join(' - '),
            });
        });
        if (selectedDateHasRecommendation) {
            events.push({
                id: 'dentist-recommendation',
                source: 'Dentist Recommendation',
                title: 'Recommended visit date',
                body: visitPrediction?.recommendationReason || preview.hero.whyThisShowing,
            });
        }
        return events;
    }, [labelMap, preview.hero.whyThisShowing, selectedAppointments, selectedDateHasRecommendation, selectedLog, selectedTreatmentLogs, visitPrediction?.recommendationReason]);

    const lastSevenDays = useMemo(() => (
        Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - index));
            const key = toDateKey(date);
            const log = logs.find((item) => item.logDateKey === key) || null;
            return { key, date, log };
        })
    ), [logs]);

    const calendarMarks = useMemo(() => {
        const marks = {};
        logs.forEach((log) => {
            if (!log.logDateKey) return;
            marks[log.logDateKey] = {
                accent: true,
                dotColor: (log.symptoms || []).some((id) => id !== 'no-symptoms') ? '#6b8394' : '#01538b',
                metaLabel: (log.symptoms || []).some((id) => id !== 'no-symptoms') ? 'Patient log, symptom recorded' : 'Patient log',
            };
        });

        appointmentsByDate.forEach((items, key) => {
            marks[key] = {
                ...(marks[key] || {}),
                accent: true,
                dotColor: marks[key]?.dotColor || '#7c6f55',
                metaLabel: [marks[key]?.metaLabel, `${items.length} dental appointment${items.length === 1 ? '' : 's'}`].filter(Boolean).join(', '),
            };
        });

        treatmentLogsByDate.forEach((items, key) => {
            marks[key] = {
                ...(marks[key] || {}),
                accent: true,
                dotColor: marks[key]?.dotColor || '#7c6f55',
                metaLabel: [marks[key]?.metaLabel, `${items.length} clinic record${items.length === 1 ? '' : 's'}`].filter(Boolean).join(', '),
            };
        });

        if (visitPrediction?.windowStartKey && visitPrediction?.windowEndKey) {
            const cursor = parseDateKey(visitPrediction.windowStartKey);
            const end = parseDateKey(visitPrediction.windowEndKey);
            while (cursor && end && cursor <= end) {
                const key = toDateKey(cursor);
                marks[key] = {
                    ...(marks[key] || {}),
                    highlight: true,
                    metaLabel: marks[key]?.metaLabel || 'Dentist recommendation window',
                };
                cursor.setDate(cursor.getDate() + 1);
            }
        }

        if (visitPrediction?.recommendedDateKey) {
            marks[visitPrediction.recommendedDateKey] = {
                ...(marks[visitPrediction.recommendedDateKey] || {}),
                accent: true,
                dotColor: '#149fc5',
                metaLabel: [marks[visitPrediction.recommendedDateKey]?.metaLabel, 'Dentist recommendation'].filter(Boolean).join(', '),
            };
        }

        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day += 1) {
            const key = toDateKey(new Date(year, month, day));
            if (isFutureDateKey(key)) {
                marks[key] = { ...(marks[key] || {}), disabled: true, metaLabel: 'Future' };
            }
        }

        marks[todayKey] = {
            ...(marks[todayKey] || {}),
            highlight: true,
            metaLabel: marks[todayKey]?.metaLabel || 'Today',
        };

        return marks;
    }, [appointmentsByDate, calendarMonth, logs, todayKey, treatmentLogsByDate, visitPrediction?.recommendedDateKey, visitPrediction?.windowEndKey, visitPrediction?.windowStartKey]);

    const trendSummary = useMemo(() => {
        const sevenDayLogs = getLogsInLastDays(logs, 7);
        const thirtyDayLogs = getLogsInLastDays(logs, 30);
        const sevenLoggedDays = new Set(sevenDayLogs.map((log) => log.logDateKey)).size;
        const thirtyLoggedDays = new Set(thirtyDayLogs.map((log) => log.logDateKey)).size;
        const symptomRows7 = buildOccurrenceRows(sevenDayLogs, SYMPTOM_TREND_IDS, 'symptoms', labelMap);
        const symptomRows30 = buildOccurrenceRows(thirtyDayLogs, SYMPTOM_TREND_IDS, 'symptoms', labelMap);
        const riskRows30 = buildOccurrenceRows(thirtyDayLogs, RISK_TREND_IDS, 'riskFactors', labelMap);

        return {
            hasEnoughHistory: thirtyLoggedDays >= 2,
            sevenLoggedDays,
            thirtyLoggedDays,
            care7: buildTrendRows(sevenDayLogs, DAILY_CARE_TREND_IDS, 'dailyCare', labelMap, 7),
            care30: buildTrendRows(thirtyDayLogs, DAILY_CARE_TREND_IDS, 'dailyCare', labelMap, 30),
            symptoms7: symptomRows7,
            symptoms30: symptomRows30,
            risk30: riskRows30,
        };
    }, [labelMap, logs]);

    const selectDate = (key, cell = {}) => {
        const nextDate = parseDateKey(key) || cell.date;
        if (!nextDate) return;
        setSelectedDateKey(toDateKey(nextDate));
        setCalendarMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    };

    const toggleFactor = (factorId) => {
        setFactors((current) => {
            if (factorId === 'none') {
                return current.map((item) => ({ ...item, active: item.id === 'none' }));
            }
            const next = current.map((item) => (
                item.id === factorId
                    ? { ...item, active: !item.active }
                    : (item.id === 'none' ? { ...item, active: false } : item)
            ));
            const hasActiveFactor = next.some((item) => item.id !== 'none' && item.active);
            return next.map((item) => (
                item.id === 'none' ? { ...item, active: !hasActiveFactor && item.active } : item
            ));
        });
    };

    const toggleLogItem = (groupId, itemId) => {
        setLogGroups((current) => current.map((group) => (
            group.id !== groupId
                ? group
                : {
                    ...group,
                    items: group.items.map((item) => (
                        groupId === 'symptoms' && itemId === 'no-symptoms'
                            ? { ...item, selected: item.id === 'no-symptoms' ? !item.selected : false }
                            : groupId === 'symptoms' && itemId !== 'no-symptoms'
                                ? {
                                    ...item,
                                    selected: item.id === 'no-symptoms'
                                        ? false
                                        : item.id === itemId
                                            ? !item.selected
                                            : item.selected,
                                }
                                : item.id === itemId ? { ...item, selected: !item.selected } : item
                    )),
                }
        )));

        if (groupId === 'symptoms' && itemId !== 'no-symptoms') {
            setSymptomDetails((current) => {
                const nextGroup = logGroups.find((group) => group.id === 'symptoms');
                const target = nextGroup?.items.find((item) => item.id === itemId);
                if (!target?.selected) return current;
                const { [itemId]: _removed, ...rest } = current;
                return rest;
            });
        }

        if (groupId === 'symptoms' && itemId === 'no-symptoms') {
            setSymptomDetails({});
            setDetailSymptomId('');
        }
    };

    const updateSymptomDetail = (symptomId, field, value) => {
        setSymptomDetails((current) => ({
            ...current,
            [symptomId]: {
                ...(current[symptomId] || {}),
                [field]: value,
            },
        }));
    };

    const saveFactors = async () => {
        setSaving(true);
        try {
            const response = await authFetch('/my/oral-health/factors', {
                method: 'PATCH',
                body: JSON.stringify({ factors: factors.filter((item) => item.active).map((item) => item.id) }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Failed to save oral health factors.');
            setOralHealth(payload);
            addToast(payload.message || 'Oral health factors saved.', 'success');
        } catch (error) {
            addToast(error.message || 'Failed to save oral health factors.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveSelectedLog = async () => {
        const symptoms = logGroups.find((group) => group.id === 'symptoms')?.items.filter((item) => item.selected).map((item) => item.id) || [];
        const dailyCare = logGroups.find((group) => group.id === 'dailyCare')?.items.filter((item) => item.selected).map((item) => item.id) || [];
        const riskFactors = logGroups.find((group) => group.id === 'riskFactors')?.items.filter((item) => item.selected).map((item) => item.id) || [];

        setSaving(true);
        try {
            const response = await authFetch('/my/oral-health/logs', {
                method: 'POST',
                body: JSON.stringify({
                    logDate: selectedDateKey,
                    symptoms,
                    dailyCare,
                    riskFactors,
                    symptomDetails,
                    notes: logNotes,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Failed to save Oral Health Management entry.');
            setOralHealth(payload);
            addToast(payload.message || 'Oral Health Management entry saved.', 'success');
        } catch (error) {
            addToast(error.message || 'Failed to save Oral Health Management entry.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const getDateMarkerSummary = (key) => {
        const log = logs.find((item) => item.logDateKey === key);
        const hasSymptoms = Boolean(log?.symptoms?.some((id) => id !== 'no-symptoms'));
        const appointmentCount = appointmentsByDate.get(key)?.length || 0;
        const treatmentCount = treatmentLogsByDate.get(key)?.length || 0;
        const isRecommendation = visitPrediction?.recommendedDateKey === key;
        const labels = [
            log ? 'Patient Log' : '',
            hasSymptoms ? 'Symptom Recorded' : '',
            appointmentCount ? 'Dental Appointment' : '',
            treatmentCount ? 'Clinic Record' : '',
            isRecommendation ? 'Dentist Recommendation' : '',
        ].filter(Boolean);

        return {
            log,
            hasSymptoms,
            appointmentCount,
            treatmentCount,
            isRecommendation,
            labels,
        };
    };

    const renderSourceCards = () => (
        <section className={styles.summaryCard}>
            <PatientSectionHeader
                eyebrow="Selected Date"
                title={selectedDateLabel}
                action={(
                    <span className={selectedLog ? styles.ohmLoggedBadge : styles.ohmOpenBadge}>
                        {selectedLog ? 'Patient Log' : 'No Patient Log'}
                    </span>
                )}
            />
            {selectedSourceEvents.length ? (
                <div className={styles.ohmSourceList}>
                    {selectedSourceEvents.map((event) => (
                        <article key={event.id} className={styles.ohmSourceItem}>
                            <span className={styles.ohmSourceBadge}>{event.source}</span>
                            <div>
                                <h3>{event.title}</h3>
                                <p>{event.body}</p>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <PatientEmptyState
                    icon={<FaCalendarAlt />}
                    title="No information on this date"
                    message="Select another date or save a Patient Log for this day."
                />
            )}
            {!selectedDateIsFuture ? (
                <p className={styles.helpText} style={{ marginTop: '14px' }}>
                    Patient-entered data can be edited from the log form. Clinic Record and Dentist Recommendation items are shown as read-only context.
                </p>
            ) : null}
        </section>
    );

    const renderDateSelector = () => (
        <section className={styles.ohmDatePanel} aria-labelledby="ohm-date-selector-title">
            <div className={styles.sectionHeader}>
                <div>
                    <span className={styles.sectionEyebrow}>Date</span>
                    <h2 id="ohm-date-selector-title" className={styles.sectionTitle}>Choose a day</h2>
                    <p className={styles.sectionDescription}>The Oral Health Management content below updates when the selected date changes.</p>
                </div>
                <div className={styles.dashboardActionRow}>
                    <button type="button" className={styles.buttonSecondary} onClick={() => selectDate(todayKey)}>
                        Today
                    </button>
                    <button
                        type="button"
                        className={styles.buttonGhost}
                        onClick={() => setMonthExpanded((current) => !current)}
                        aria-expanded={monthExpanded}
                        aria-controls="ohm-expanded-month-calendar"
                    >
                        {monthExpanded ? 'Hide Month' : 'Show Month'}
                    </button>
                </div>
            </div>

            <div className={styles.ohmDateStrip} aria-label="Week date selector">
                {selectedWeekDates.map((date) => {
                    const key = toDateKey(date);
                    const marker = getDateMarkerSummary(key);
                    const isSelected = key === selectedDateKey;
                    return (
                        <button
                            key={key}
                            type="button"
                            className={`${styles.ohmDateButton} ${isSelected ? styles.ohmDateButtonActive : ''}`}
                            onClick={() => selectDate(key, { date })}
                            aria-pressed={isSelected}
                            aria-label={`${formatDateDisplay(date, { weekday: 'long', month: 'long' })}${marker.labels.length ? `, ${marker.labels.join(', ')}` : ', no information recorded'}`}
                        >
                            <span>{date.toLocaleDateString('en-PH', { weekday: 'short' })}</span>
                            <strong>{date.getDate()}</strong>
                            <small>{marker.labels.length ? `${marker.labels.length} source${marker.labels.length === 1 ? '' : 's'}` : 'Open'}</small>
                            <i className={styles.ohmDateMarkers} aria-hidden="true">
                                {marker.log ? <b className={styles.ohmMarkerLog} /> : null}
                                {marker.hasSymptoms ? <b className={styles.ohmMarkerSymptom} /> : null}
                                {marker.appointmentCount || marker.treatmentCount ? <b className={styles.ohmMarkerClinic} /> : null}
                                {marker.isRecommendation ? <b className={styles.ohmMarkerRecommendation} /> : null}
                            </i>
                        </button>
                    );
                })}
            </div>

            <div className={styles.ohmLegend} aria-label="Date marker legend">
                <span><i className={styles.ohmLegendLogged} /> Daily log exists</span>
                <span><i className={styles.ohmLegendSymptom} /> Symptom recorded</span>
                <span><i className={styles.ohmLegendClinic} /> Dental appointment or clinic record</span>
                <span><i className={styles.ohmLegendWindow} /> Dentist recommendation</span>
            </div>

            {monthExpanded ? (
                <div id="ohm-expanded-month-calendar" className={styles.ohmExpandedCalendar}>
                    <PatientMonthCalendar
                        currentMonth={calendarMonth}
                        selectedDate={selectedDateKey}
                        marks={calendarMarks}
                        onChangeMonth={(delta) => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))}
                        onSelectDate={selectDate}
                    />
                </div>
            ) : null}
        </section>
    );

    const renderTrackerForm = () => (
        <article className={styles.ohmTrackerCard}>
            <div className={styles.ohmTrackerHeader}>
                <div>
                    <span className={styles.sectionEyebrow}>Record Information</span>
                    <h3 className={styles.ohmTrackerTitle}>{selectedDateLabel}</h3>
                    <p className={styles.sectionDescription}>
                        {selectedLog ? 'This date already has a saved entry. Update it if anything changed.' : 'Select symptoms, care habits, or add a short note.'}
                    </p>
                </div>
                <span className={selectedLog ? styles.ohmLoggedBadge : styles.ohmOpenBadge}>
                    {selectedLog ? 'Logged' : 'Not logged'}
                </span>
            </div>

            {logGroups.map((group) => (
                <section key={group.id} className={styles.ohmChoiceGroup}>
                    <h4 className={styles.sectionTitle}>{group.title}</h4>
                    <div className={styles.ohmChoiceGrid}>
                        {group.items.map((item) => (
                            <span key={item.id} className={styles.ohmChoiceWrap}>
                                <button
                                    type="button"
                                    className={`${styles.ohmChoiceButton} ${item.selected ? styles.ohmChoiceButtonActive : ''}`}
                                    onClick={() => toggleLogItem(group.id, item.id)}
                                    aria-pressed={Boolean(item.selected)}
                                    aria-label={`${item.label}, ${item.selected ? 'selected' : 'not selected'}`}
                                >
                                    {item.selected ? <FaCheckCircle aria-hidden="true" focusable="false" /> : <FaPlus aria-hidden="true" focusable="false" />}
                                    <span>{item.label}</span>
                                </button>
                                {group.id === 'symptoms' && item.selected && item.detailFields?.length ? (
                                    <button
                                        type="button"
                                        className={styles.ohmDetailButton}
                                        onClick={() => setDetailSymptomId(item.id)}
                                        aria-label={`Add optional context for ${item.label}`}
                                    >
                                        Details
                                    </button>
                                ) : null}
                            </span>
                        ))}
                    </div>
                </section>
            ))}

            <label className={styles.field}>
                <span className={styles.label}>Notes</span>
                <textarea
                    className={styles.textarea}
                    value={logNotes}
                    onChange={(event) => setLogNotes(event.target.value)}
                    maxLength={500}
                    placeholder="Optional note for this date."
                    disabled={selectedDateIsFuture}
                />
            </label>

            {selectedDateIsFuture ? (
                <div className={styles.noticeBox} role="status">
                    Future dates can be reviewed on the calendar, but Oral Health Management entries can only be saved for today or a past date.
                </div>
            ) : null}

            <div className={styles.heroActions}>
                <button type="button" className={styles.buttonPrimary} onClick={saveSelectedLog} disabled={saving || selectedDateIsFuture}>
                    {saving ? 'Saving...' : selectedLog ? 'Save Changes' : 'Save Entry'}
                </button>
                <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/appointments?mode=book')}>
                    Book Preventive Visit
                </button>
            </div>
        </article>
    );

    const renderContextualEducation = () => (
        <section className={styles.summaryCard}>
            <PatientSectionHeader
                eyebrow="Contextual Dental Health Education"
                title={selectedContextualEducation.length ? 'Related to this date' : 'No related education for this date'}
                action={(
                    <button type="button" className={styles.buttonGhost} onClick={() => setActiveTab('education')}>
                        Open Library
                    </button>
                )}
            />
            {selectedContextualEducation.length ? (
                <div className={styles.cardGrid}>
                    {selectedContextualEducation.slice(0, 3).map((article) => (
                        <article key={article.id} className={styles.toolCard}>
                            <span className={styles.heroTag}>{article.category || 'Dental Health Education'}</span>
                            <h3 className={styles.toolTitle}>{article.title}</h3>
                            <p className={styles.toolText}>{article.summary}</p>
                            {article.action ? <div className={styles.noticeBox}>{article.action}</div> : null}
                        </article>
                    ))}
                </div>
            ) : (
                <PatientEmptyState
                    icon={<FaBook />}
                    title="No matching topic yet"
                    message="Save symptoms or care habits such as sensitivity, bleeding gums, flossing, or missed brushing to see related Dental Health Education."
                />
            )}
            <p className={styles.helpText} style={{ marginTop: '14px' }}>
                Dental Health Education is informational and non-diagnostic. It does not replace a dentist&apos;s evaluation.
            </p>
        </section>
    );

    const renderHistory = () => (
        <article className={styles.summaryCard}>
            <PatientSectionHeader eyebrow="Review History" title="Recent Oral Health Management entries" />
            {logs.length ? (
                <div className={styles.ohmHistoryList}>
                    {logs.slice(0, 8).map((log) => (
                        <button
                            key={log.logDateKey}
                            type="button"
                            className={styles.ohmHistoryItem}
                            onClick={() => {
                                selectDate(log.logDateKey);
                                setActiveTab('calendar');
                            }}
                        >
                            <span className={styles.ohmHistoryDate}>{formatDateDisplay(parseDateKey(log.logDateKey), { weekday: 'short' })}</span>
                            <span className={styles.ohmHistorySummary}>{summarizeLog(log, labelMap)}</span>
                        </button>
                    ))}
                </div>
            ) : (
                <PatientEmptyState
                    icon={<FaCalendarAlt />}
                    title="No history yet"
                    message="Saved entries will appear here and mark the calendar."
                />
            )}
        </article>
    );

    const renderToday = () => (
        <div className={styles.ohmContentGrid}>
            <section className={styles.summaryCard}>
                <PatientSectionHeader
                    eyebrow="Today"
                    title="Today's Oral Health Management"
                    action={(
                        <button type="button" className={styles.buttonGhost} onClick={() => selectDate(todayKey)}>
                            Use Today
                        </button>
                    )}
                />
                <div className={styles.dashboardSummaryPanel}>
                    <p className={styles.dashboardSummaryLead}>{todayLog ? 'Logged today' : 'Not logged yet'}</p>
                    <p className={styles.dashboardSummaryText}>{todaySummary}</p>
                </div>
                <div className={styles.detailPills}>
                    <span className={styles.detailPill}>{preview.hero.statusLabel}</span>
                    <span className={styles.detailPill}>Recommended: {preview.hero.recommendedDateLabel}</span>
                    {oralHealth?.summary?.lastLogDateKey ? <span className={styles.detailPill}>Last log: {oralHealth.summary.lastLogDateKey}</span> : null}
                </div>
                {oralHealthError ? <div className={styles.noticeBox}>{oralHealthError}</div> : null}
            </section>
            {renderHistory()}
        </div>
    );

    const renderCalendar = () => (
        <div className={styles.ohmCalendarGrid}>
            <section>
                <PatientMonthCalendar
                    currentMonth={calendarMonth}
                    selectedDate={selectedDateKey}
                    marks={calendarMarks}
                    onChangeMonth={(delta) => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))}
                    onSelectDate={selectDate}
                />
                <div className={styles.ohmLegend} aria-label="Calendar marker legend">
                    <span><i className={styles.ohmLegendLogged} /> Daily log exists</span>
                    <span><i className={styles.ohmLegendSymptom} /> Symptom recorded</span>
                    <span><i className={styles.ohmLegendClinic} /> Dental appointment or clinic record</span>
                    <span><i className={styles.ohmLegendWindow} /> Dentist recommendation</span>
                </div>
            </section>
            {renderHistory()}
        </div>
    );

    const renderTrendRows = (rows, emptyMessage) => (
        rows.length ? rows.map((item) => (
            <div key={item.id} className={styles.ohmTrendRow}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
            </div>
        )) : (
            <div className={styles.noticeBox}>{emptyMessage}</div>
        )
    );

    const renderTrends = () => (
        <div className={styles.ohmContentGrid}>
            <section className={styles.summaryCard}>
                <PatientSectionHeader eyebrow="Trends" title="Last 7 days" />
                <div className={styles.ohmWeekTrend} aria-label="Last seven days oral health entry status">
                    {lastSevenDays.map((day) => (
                        <button
                            key={day.key}
                            type="button"
                            className={`${styles.ohmWeekTrendDay} ${day.log ? styles.ohmWeekTrendDayLogged : ''}`}
                            onClick={() => {
                                selectDate(day.key);
                                setActiveTab('calendar');
                            }}
                            aria-label={`${formatDateDisplay(day.date, { weekday: 'long', month: 'long' })}, ${day.log ? 'logged' : 'not logged'}`}
                        >
                            <span>{day.date.toLocaleDateString('en-PH', { weekday: 'short' })}</span>
                            <strong>{day.date.getDate()}</strong>
                            <small>{day.log ? 'Logged' : 'Open'}</small>
                        </button>
                    ))}
                </div>
                <div className={styles.dashboardMiniList}>
                    <div className={styles.dashboardMiniRow}>
                        <span className={styles.dashboardMiniLabel}>Logged Days</span>
                        <strong className={styles.dashboardMiniValue}>{trendSummary.sevenLoggedDays} of last 7 days</strong>
                    </div>
                    <div className={styles.dashboardMiniRow}>
                        <span className={styles.dashboardMiniLabel}>30-Day History</span>
                        <span className={styles.dashboardMiniValue}>
                            {trendSummary.thirtyLoggedDays} logged day{trendSummary.thirtyLoggedDays === 1 ? '' : 's'} in the last 30 days
                        </span>
                    </div>
                </div>
            </section>

            <section className={styles.summaryCard}>
                <PatientSectionHeader eyebrow="Factual Summary" title="Recent saved Patient Logs" />
                {trendSummary.hasEnoughHistory ? (
                    <div className={styles.ohmTrendColumns}>
                        <div>
                            <h3 className={styles.sectionTitle}>Daily Care - 7 Days</h3>
                            {renderTrendRows(trendSummary.care7, 'No daily care habits recorded in the last 7 days.')}
                        </div>
                        <div>
                            <h3 className={styles.sectionTitle}>Daily Care - 30 Days</h3>
                            {renderTrendRows(trendSummary.care30, 'No daily care habits recorded in the last 30 days.')}
                        </div>
                        <div>
                            <h3 className={styles.sectionTitle}>Symptoms - 30 Days</h3>
                            {renderTrendRows(trendSummary.symptoms30, 'No symptoms recorded in the last 30 days.')}
                        </div>
                    </div>
                ) : (
                    <PatientEmptyState
                        icon={<FaChartLine />}
                        title="Insufficient history for trends"
                        message={`Trends need at least two logged dates. You currently have ${trendSummary.thirtyLoggedDays} logged day${trendSummary.thirtyLoggedDays === 1 ? '' : 's'} in the last 30 days.`}
                    />
                )}
            </section>

            {trendSummary.hasEnoughHistory ? (
                <section className={styles.summaryCard}>
                    <PatientSectionHeader eyebrow="Recorded Signals" title="Recent symptoms and other factors" />
                    <div className={styles.ohmTrendColumns}>
                        <div>
                            <h3 className={styles.sectionTitle}>Symptoms - 7 Days</h3>
                            {renderTrendRows(trendSummary.symptoms7, 'No symptoms recorded in the last 7 days.')}
                        </div>
                        <div>
                            <h3 className={styles.sectionTitle}>Symptoms - 30 Days</h3>
                            {renderTrendRows(trendSummary.symptoms30, 'No symptoms recorded in the last 30 days.')}
                        </div>
                        <div>
                            <h3 className={styles.sectionTitle}>Other / Risk Factors - 30 Days</h3>
                            {renderTrendRows(trendSummary.risk30, 'No other risk factors recorded in the last 30 days.')}
                        </div>
                    </div>
                    <p className={styles.helpText} style={{ marginTop: '14px' }}>
                        These are counts from saved Patient Logs only. They are not a clinical oral health score.
                    </p>
                </section>
            ) : null}
        </div>
    );

    const renderEducation = () => {
        const articles = preview.education.articles.length ? preview.education.articles : [
            {
                id: 'fallback',
                category: 'Dental Health Education',
                title: preview.education.title,
                summary: preview.education.body,
                action: 'Keep logging your daily care so recommendations stay useful.',
            },
        ];

        return (
            <section className={styles.summaryCard}>
                <PatientSectionHeader
                    eyebrow="Dental Health Education"
                    title="Approved topic library"
                />
                <p className={styles.toolText}>
                    Browse approved informational topics. Contextual suggestions above use this same Dental Health Education library.
                </p>
                <div className={styles.cardGrid} style={{ marginTop: '16px' }}>
                    {articles.map((article) => (
                        <article key={article.id} className={styles.summaryCard}>
                            <span className={styles.heroTag}>{article.category || 'Dental Health Education'}</span>
                            <h3 className={styles.toolTitle}>{article.title}</h3>
                            <p className={styles.toolText}>{article.summary}</p>
                            {article.action ? <div className={styles.noticeBox}>{article.action}</div> : null}
                        </article>
                    ))}
                </div>
                <p className={styles.helpText} style={{ marginTop: '14px' }}>
                    Dental Health Education is informational and non-diagnostic.
                </p>
            </section>
        );
    };

    const renderActiveTab = () => {
        if (activeTab === 'calendar') return renderCalendar();
        if (activeTab === 'trends') return renderTrends();
        if (activeTab === 'education') return renderEducation();
        return renderToday();
    };

    return (
        <PatientPageFrame
            title="Oral Health Management"
            subtitle={`Date-centered tracking, trends, recommended visit windows, and Dental Health Education for ${user?.assignedBranch || 'your assigned branch'}.`}
            actions={(
                <>
                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/ai-companion?tab=visit-window')}>
                        Open AI Companion
                    </button>
                    <button type="button" className={styles.buttonPrimary} onClick={() => navigate('/patient/appointments?mode=book')}>
                        Book Preventive Visit
                    </button>
                </>
            )}
        >
            <section className={styles.ohmHero}>
                <div>
                    <span className={styles.heroEyebrow}>Oral Health Management</span>
                    <h2 className={styles.heroTitle}>Select a date, record information, and watch your history become useful.</h2>
                    <p className={styles.heroText}>{preview.hero.whyThisShowing}</p>
                </div>
                <div className={styles.ohmRecommendationCard}>
                    <span className={styles.dashboardMiniLabel}>Recommended Visit Window</span>
                    <strong>{preview.hero.windowLabel}</strong>
                    <p>{preview.hero.suggestedNextAction}</p>
                    <div className={styles.detailPills} aria-label="Recommendation sources">
                        {(preview.hero.sourceLabels || []).map((source) => (
                            <span key={source} className={styles.detailPill}>{source}</span>
                        ))}
                    </div>
                </div>
            </section>

            {renderDateSelector()}

            <div className={styles.ohmSelectedDateGrid}>
                {renderSourceCards()}
                {renderTrackerForm()}
            </div>

            {renderContextualEducation()}

            <nav className={styles.tabs} role="tablist" aria-label="Oral Health Management sections">
                {TRACKER_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`}
                            onClick={() => {
                                if (tab.id === 'today') selectDate(todayKey);
                                setActiveTab(tab.id);
                            }}
                            role="tab"
                            aria-selected={isActive}
                        >
                            <Icon aria-hidden="true" focusable="false" /> {tab.label}
                        </button>
                    );
                })}
            </nav>

            <section role="tabpanel" aria-label={TRACKER_TABS.find((tab) => tab.id === activeTab)?.label || 'Today'}>
                {renderActiveTab()}
            </section>

            <section className={styles.summaryCard} style={{ marginTop: '20px' }}>
                <PatientSectionHeader
                    eyebrow="Care Context"
                    title="Health factors"
                    action={(
                        <button type="button" className={styles.buttonGhost} onClick={saveFactors} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Factors'}
                        </button>
                    )}
                />
                <p className={styles.toolText}>These factors help personalize watch signals without changing your clinical record.</p>
                <div className={styles.ohmChoiceGrid}>
                    {factors.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`${styles.ohmChoiceButton} ${item.active ? styles.ohmChoiceButtonActive : ''}`}
                            onClick={() => toggleFactor(item.id)}
                            aria-pressed={Boolean(item.active)}
                            aria-label={`${item.label}, ${item.active ? 'selected' : 'not selected'}`}
                        >
                            {item.active ? <FaCheckCircle aria-hidden="true" focusable="false" /> : <FaPlus aria-hidden="true" focusable="false" />}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
                <div className={styles.detailPills}>
                    {(activeFactors.length ? activeFactors : factors.filter((item) => item.id === 'none')).map((item) => (
                        <span key={item.id} className={styles.detailPill}>{item.label}</span>
                    ))}
                </div>
            </section>

            <div className={styles.noticeBox} style={{ marginTop: '20px' }}>
                <FaInfoCircle aria-hidden="true" focusable="false" /> Oral Health Management supports self-tracking and clinic visit timing. It does not diagnose dental disease or replace a dentist.
            </div>

            {detailSymptomId ? (
                <div className={styles.modalOverlay} role="presentation" onMouseDown={() => setDetailSymptomId('')}>
                    <div
                        className={styles.modalCard}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="symptom-detail-title"
                        aria-describedby="symptom-detail-description"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 id="symptom-detail-title" className={styles.modalTitle}>
                                    {labelMap.get(detailSymptomId) || 'Symptom'} Context
                                </h3>
                                <p id="symptom-detail-description" className={styles.modalSubtitle}>
                                    Optional context helps you describe the entry later. It does not diagnose or trigger frontend escalation rules.
                                </p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setDetailSymptomId('')} aria-label="Close symptom context dialog">
                                <FaTimes aria-hidden="true" focusable="false" />
                            </button>
                        </div>

                        <section className={styles.ohmChoiceGroup}>
                            <h4 className={styles.sectionTitle}>{oralHealth?.symptomDetailConfig?.severity?.label || 'Severity'}</h4>
                            <div className={styles.ohmChoiceGrid}>
                                {(oralHealth?.symptomDetailConfig?.severity?.options || []).map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`${styles.ohmChoiceButton} ${symptomDetails[detailSymptomId]?.severity === option.id ? styles.ohmChoiceButtonActive : ''}`}
                                        onClick={() => updateSymptomDetail(detailSymptomId, 'severity', option.id)}
                                        aria-pressed={symptomDetails[detailSymptomId]?.severity === option.id}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <label className={styles.field}>
                            <span className={styles.label}>{oralHealth?.symptomDetailConfig?.duration?.label || 'Duration'}</span>
                            <input
                                className={styles.input}
                                value={symptomDetails[detailSymptomId]?.duration || ''}
                                onChange={(event) => updateSymptomDetail(detailSymptomId, 'duration', event.target.value)}
                                maxLength={oralHealth?.symptomDetailConfig?.duration?.maxLength || 80}
                                placeholder="Optional duration in your own words."
                            />
                        </label>

                        <div className={styles.heroActions}>
                            <button type="button" className={styles.buttonSecondary} onClick={() => setDetailSymptomId('')}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </PatientPageFrame>
    );
}
