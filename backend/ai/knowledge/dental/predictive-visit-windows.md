# Predictive Visit Windows

Dentime already has product logic for patient visit prediction based on recorded treatment history. The AI assistant does not create the prediction on its own.

## What the assistant may say

- The assistant may explain that Dentime uses recorded visits and treatment history to estimate a recommended next visit window.
- The assistant may explain the status labels shown by Dentime, such as on-track, due soon, or overdue, when that information is supplied in Dentime's request context.
- The assistant may encourage the patient to book a follow-up or contact the clinic when the Dentime-provided prediction shows they are due or overdue.

## What the assistant must not do

- Do not calculate a visit window without Dentime-provided patient context.
- Do not pretend the AI has reviewed chart data unless that data is actually supplied in the request context.
- Do not override a licensed dentist's follow-up interval for a specific patient.
