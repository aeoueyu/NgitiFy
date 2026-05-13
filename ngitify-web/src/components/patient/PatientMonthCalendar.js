import React, { useMemo } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { toDateKey } from '../../utils/patientPortal';
import styles from '../../styles/patient/PatientPortal.module.css';

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

    return (
        <div className={styles.calendarShell}>
            <div className={styles.calendarHeader}>
                <h3 className={styles.calendarMonth}>
                    {currentMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
                </h3>
                <div className={styles.calendarNav}>
                    <button
                        type="button"
                        className={styles.calendarNavButton}
                        onClick={() => onChangeMonth(-1)}
                    >
                        <FaChevronLeft />
                    </button>
                    <button
                        type="button"
                        className={styles.calendarNavButton}
                        onClick={() => onChangeMonth(1)}
                    >
                        <FaChevronRight />
                    </button>
                </div>
            </div>

            <div className={styles.calendarGrid}>
                {DAY_NAMES.map((dayName) => (
                    <div key={dayName} className={styles.dayName}>{dayName}</div>
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

                    return (
                        <button
                            key={cell.key}
                            type="button"
                            className={classNames}
                            onClick={() => onSelectDate(cell.key, cell)}
                            disabled={cell.disabled}
                        >
                            <span className={styles.dateNumber}>{cell.label}</span>
                            {cell.dotColor ? (
                                <span
                                    className={styles.dateMarker}
                                    style={{ backgroundColor: cell.selected ? '#ffffff' : cell.dotColor }}
                                />
                            ) : null}
                            {cell.metaLabel ? <small className={styles.dateMeta}>{cell.metaLabel}</small> : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

