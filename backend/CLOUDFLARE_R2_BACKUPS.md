# Cloudflare R2 database backups

R2 stores the private backup archives. The existing Cloudflare Pages frontend does not need an R2 binding because the Render backend accesses R2 through its S3-compatible API.

## 1. Create the private bucket

1. In Cloudflare, open **Storage & databases > R2 > Overview**.
2. Complete the R2 subscription setup if prompted. R2 includes a monthly free tier, but Cloudflare might require a payment method.
3. Select **Create bucket**.
4. Name it `ngitify-database-backups`, select **Standard** storage, and create it.
5. Do not enable public development access or attach a public custom domain. Downloads go through the authenticated NgitiFy backend.

## 2. Create narrowly scoped R2 credentials

1. On the R2 Overview page, select **Manage** next to API Tokens.
2. Create an account or user API token with **Object Read & Write** permission.
3. Apply it only to the `ngitify-database-backups` bucket.
4. Copy the Account ID, Access Key ID, and Secret Access Key. Cloudflare shows the secret only once.

Never put these credentials in the frontend, mobile app, Git, or any variable prefixed with `REACT_APP_` or `EXPO_PUBLIC_`.

## 3. Configure the Render backend

In the Render backend service, open **Environment** and add:

```text
BACKUP_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_ACCESS_KEY_ID=<R2 access key ID>
R2_SECRET_ACCESS_KEY=<R2 secret access key>
R2_BUCKET_NAME=ngitify-database-backups
R2_BACKUP_PREFIX=production
BACKUP_CRON_SECRET=<a unique random secret of at least 32 characters>
```

`BACKUP_DIR` is not required in R2 mode. Select **Save, rebuild, and deploy** after the code changes are pushed. The Database Backup page should then say **Stored in Cloudflare R2**.

Create one manual backup, verify it, and download it before configuring the schedule.

## 4. Schedule backups while Render Free sleeps

The scheduler inside a Render Free process cannot reliably remain alive. Create a separate Cloudflare Worker:

1. Open **Workers & Pages**, create a Worker, and paste `cloudflare/backup-cron-worker.js` into its editor.
2. Add a Worker secret named `BACKUP_CRON_SECRET` with exactly the same value used in Render.
3. Optionally add a text variable named `BACKUP_API_URL`; the default is `https://api.ngitify.com/api/backup/cron`.
4. Deploy the Worker.
5. Open the Worker **Settings > Triggers > Cron Triggers** and add `5 17 * * *`. Cloudflare uses UTC, so this runs daily at 1:05 AM in the Philippines.
6. Disable the built-in automatic schedule on the NgitiFy backup page to prevent duplicate runs. The Cloudflare trigger now owns the daily schedule; the saved retention count still controls R2 cleanup.

After the first scheduled run, inspect the Worker's logs, the NgitiFy backup history, and the objects under the bucket's `production/` prefix.
