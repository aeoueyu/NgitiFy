async function triggerBackup(env) {
    const endpoint = env.BACKUP_API_URL || 'https://api.ngitify.com/api/backup/cron';
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.BACKUP_CRON_SECRET}`,
            'User-Agent': 'NgitiFy-Cloudflare-Backup-Scheduler/1.0',
        },
    });

    if (!response.ok && response.status !== 409) {
        const responseText = await response.text();
        throw new Error(`Backup endpoint returned ${response.status}: ${responseText.slice(0, 300)}`);
    }
}

export default {
    async scheduled(_controller, env, ctx) {
        ctx.waitUntil(triggerBackup(env));
    },
};
