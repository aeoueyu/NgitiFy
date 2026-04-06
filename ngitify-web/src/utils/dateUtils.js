// src/utils/dateUtils.js

/**
 * Helper to ensure we always have a valid Date object.
 * Returns null if the date is invalid.
 */
const getValidDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Formats a date to: "October 12, 2023"
 */
export const formatDateLong = (dateString) => {
    const date = getValidDate(dateString);
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

/**
 * Formats a date to: "Oct 12, 2023"
 */
export const formatDateShort = (dateString) => {
    const date = getValidDate(dateString);
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Formats a date with the weekday: "Monday, Oct 12, 2023"
 */
export const formatWeekdayDate = (dateString) => {
    const date = getValidDate(dateString);
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Formats time. 
 * Default: "09:00 AM"
 * With seconds: "09:00:00 AM"
 */
export const formatTime = (dateString, includeSeconds = false) => {
    const date = getValidDate(dateString);
    if (!date) return 'N/A';
    
    const options = { hour: '2-digit', minute: '2-digit' };
    if (includeSeconds) options.second = '2-digit';
    
    return date.toLocaleTimeString('en-US', options);
};

/**
 * Formats a date for HTML <input type="date"> fields: "YYYY-MM-DD"
 */
export const formatForInput = (dateString) => {
    const date = getValidDate(dateString);
    if (!date) return '';
    return date.toISOString().split('T')[0];
};