# Resend delivery webhook

The email-change flow treats a successful Resend API response as `accepted` and
uses a signed webhook to track later delivery, delay, bounce, or failure events.

In the Resend dashboard, create a webhook pointing to:

`https://<backend-host>/api/webhooks/resend`

Subscribe it to these events:

- `email.delivered`
- `email.delivery_delayed`
- `email.failed`
- `email.bounced`

Set the endpoint's signing secret as `RESEND_WEBHOOK_SECRET` in the backend
environment. The handler rejects unsigned or invalid webhook requests.
