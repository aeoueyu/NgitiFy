# Database backup deployment

The backend installs `mongodump` and `mongorestore` during `npm install` on Render's Debian 12 Linux runtime. The installed executables are discovered automatically from `backend/tools/mongodb-database-tools`.

## Required Render storage configuration

The backup archive must be written to durable storage. In the Render dashboard:

1. Open the backend web service and add a persistent disk.
2. Use `/var/data` as the disk mount path.
3. Add the environment variable `BACKUP_DIR=/var/data/backups`.
4. Ensure the service build command runs `npm install` from the `backend` directory so its `postinstall` script provisions the MongoDB tools.
5. Redeploy the backend and check the Database Backup page. Both tool checks should be available and the displayed storage location should be `/var/data/backups`.
6. Create a new backup, verify it, then restart the service and confirm that the file remains available.

Only files beneath the configured disk mount survive a Render restart or deployment. A disk cannot recover archives that disappeared before the disk was attached.
Render's free web services do not support persistent disks. Follow `CLOUDFLARE_R2_BACKUPS.md` to use the implemented R2 storage and external scheduling path instead.

## Optional environment variables

- `MONGODB_TOOLS_VERSION`: pins another MongoDB Database Tools release. The default is `100.18.0`.
- `MONGODB_TOOLS_SKIP_INSTALL=true`: skips the automatic Linux installation when both tools are provided another way.
- `MONGODUMP_BIN` and `MONGORESTORE_BIN`: explicitly select externally installed executable paths.

Do not point `BACKUP_DIR` at the repository directory in production. For stronger disaster recovery, copy backups to object storage or another off-server location as well.
