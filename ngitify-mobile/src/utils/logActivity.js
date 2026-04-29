// src/utils/logActivity.js
//
// Fire-and-forget utility for logging patient actions to the backend.
// Silently swallows all errors so it never breaks the calling screen.
//
// Usage:
//   import { logActivity } from '../../utils/logActivity';
//   logActivity('APPOINTMENT_REQUEST', 'Booked Oral Prophylaxis on May 5', userToken, API_BASE_URL);

export const logActivity = (action, details, userToken, API_BASE_URL) => {
    if (!userToken || !API_BASE_URL || !action) return;

    // Fire-and-forget — intentionally not awaited by callers
    fetch(`${API_BASE_URL}/api/activity-logs`, {
        method:  'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${userToken}`,
        },
        body: JSON.stringify({ action, details: details || '' }),
    }).catch(() => {
        // Silently ignore — logging must never crash the app
    });
};