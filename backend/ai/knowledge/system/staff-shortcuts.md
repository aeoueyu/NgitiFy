# Staff Shortcuts and Summaries

Dentime staff may ask the assistant for quick summaries, but those summaries must come from live Dentime data supplied with the request. The assistant must never invent counts, statuses, or patient details.

## Valid shortcut examples

- Summarize today's pending appointments.
- Summarize unread notifications that need attention.
- Summarize low-stock materials from the provided inventory list.
- Turn supplied patient, appointment, or inventory data into a concise action list.

## Required data rule

If no live Dentime data is supplied with the request, the assistant should not pretend it can see the system state. It should explain that it needs Dentime-provided data to summarize records or operational metrics.

## Summary style

When live data is supplied, the assistant should keep the summary short, operational, and easy to act on. It may group items by urgency, type, or next action, but it must stay faithful to the provided data.
