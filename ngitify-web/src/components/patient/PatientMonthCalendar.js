import React, { useMemo } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { toDateKey } from '../../utils/patientPortal';
import styles from '../../styles/patient/PatientPortal.module.css';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const buildCalendarCells = (currentMonth, selectedDate, marks, disableSundays) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const selectedKey = String(selectedDate || '').trim();
    const cells = [];

    for (let index = firstDay - 1; index >= 0; index -= 1) {
        const date = new Date(year, month - 1, daysInPrevMonth - index);
        cells.push({
            date,
            key: toDateKey(date),
            label: daysInPrevMonth - index,
            muted: true,
        });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day);
        const key = toDateKey(date);
        const mark = marks[key] || {};
        cells.push({
            date,
            key,
            label: day,
            selected: key === selectedKey || mark.selected,
            disabled: Boolean(mark.disabled) || (disableSundays && date.getDay() === 0),
            accent: Boolean(mark.accent),
            highlight: Boolean(mark.highlight),
            dotColor: mark.dotColor || '',
            metaLabel: mark.metaLabel || '',
        });
    }

    const totalCells = cells.length > 35 ? 42 : 35;
    const extraCells = totalCells - cells.length;
    for (let day = 1; day <= extraCells; day += 1) {
        const date = new Date(year, month + 1, day);
        cells.push({
            date,
            key: toDateKey(date),
            label: day,
            muted: true,
        });
    }

    return cells;
};

export default function PatientMonthCalendar({
    currentMonth,
    selectedDate,
    marks = {},
    disableSundays = false,
    onChangeMonth,
    onSelectDate,
}) {
    const cells = useMemo(
        () => buildCalendarCells(currentMonth, selectedDate, marks, disableSundays),
        [currentMonth, marks, selectedDate, disableSundays]
    );

    const monthLabel = currentMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

    return (
        <div className={styles.calendarShell} aria-label={`${monthLabel} calendar`}>
            <div className={styles.calendarHeader}>
                <h3 className={styles.calendarMonth}>
                    {monthLabel}
                </h3>
                <div className={styles.calendarNav}>
                    <button
                        type="button"
                        className={styles.calendarNavButton}
                        onClick={() => onChangeMonth(-1)}
                        aria-label={`Show previous month before ${monthLabel}`}
                    >
                        <FaChevronLeft aria-hidden="true" focusable="false" />
                    </button>
                    <button
                        type="button"
                        className={styles.calendarNavButton}
                        onClick={() => onChangeMonth(1)}
                        aria-label={`Show next month after ${monthLabel}`}
                    >
                        <FaChevronRight aria-hidden="true" focusable="false" />
                    </button>
                </div>
            </div>

            <div className={styles.calendarGrid} role="grid" aria-label={monthLabel}>
                {DAY_NAMES.map((dayName, index) => (
                    <div key={dayName} className={styles.dayName} role="columnheader" aria-label={FULL_DAY_NAMES[index]}>
                        {dayName}
                    </div>
                ))}
                {cells.map((cell) => {
                    const classNames = [
                        styles.dateCell,
                        cell.muted ? styles.dateCellMuted : '',
                        cell.disabled ? styles.dateCellDisabled : '',
                        cell.selected ? styles.dateCellSelected : '',
                        cell.accent ? styles.dateCellAccent : '',
                        cell.highlight ? styles.dateCellHighlight : '',
                    ].filter(Boolean).join(' ');

                    const readableDate = cell.date.toLocaleDateString('en-PH', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                    });
                    const stateLabels = [
                        cell.selected ? 'selected' : '',
                        cell.highlight ? 'in recommended window' : '',
                        cell.accent ? 'important' : '',
                        cell.disabled ? 'unavailable' : '',
                        cell.metaLabel || '',
                    ].filter(Boolean);

                    return (
                        <button
                            key={cell.key}
                            type="button"
                            className={classNames}
                            onClick={() => onSelectDate(cell.key, cell)}
                            disabled={cell.disabled}
                            role="gridcell"
                            aria-selected={Boolean(cell.selected)}
                            aria-label={`${readableDate}${stateLabels.length ? `, ${stateLabels.join(', ')}` : ''}`}
                        >
                            <span className={styles.dateNumber}>{cell.label}</span>
                            {cell.dotColor ? (
                                <span
                                    className={styles.dateMarker}
                                    style={{ backgroundColor: cell.selected ? '#ffffff' : cell.dotColor }}
                                    aria-hidden="true"
                                />
                            ) : null}
                            {cell.metaLabel ? <small className={styles.dateMeta}>{cell.metaLabel}</small> : null}
                            {stateLabels.length ? <span className={styles.srOnly}>{stateLabels.join(', ')}</span> : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
