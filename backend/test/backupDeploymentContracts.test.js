const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.join(__dirname, '..');
const backupRouteSource = fs.readFileSync(path.join(backendRoot, 'routes', 'backup.js'), 'utf8');
const backupStorageSource = fs.readFileSync(path.join(backendRoot, 'services', 'backupStorage.js'), 'utf8');
const installerSource = fs.readFileSync(path.join(backendRoot, 'scripts', 'install_mongodb_tools.js'), 'utf8');
const packageJson = require('../package.json');

test('backup storage can be placed on a persistent mount', () => {
    assert.match(backupStorageSource, /process\.env\.BACKUP_DIR/);
    assert.match(backupStorageSource, /path\.resolve/);
});

test('R2 storage covers upload, availability, download, verification materialization, and deletion', () => {
    assert.match(backupStorageSource, /PutObjectCommand/);
    assert.match(backupStorageSource, /HeadObjectCommand/);
    assert.match(backupStorageSource, /GetObjectCommand/);
    assert.match(backupStorageSource, /DeleteObjectCommand/);
    assert.match(backupRouteSource, /backupStorage\.uploadArchive/);
    assert.match(backupRouteSource, /backupStorage\.materializeArchive/);
});

test('external backup scheduler requires a timing-safe shared secret', () => {
    assert.match(backupRouteSource, /router\.post\('\/backup\/cron'/);
    assert.match(backupRouteSource, /crypto\.timingSafeEqual/);
    assert.match(backupRouteSource, /BACKUP_CRON_SECRET/);
});

test('production install provisions both MongoDB backup executables', () => {
    assert.match(packageJson.scripts.postinstall, /install_mongodb_tools\.js/);
    assert.match(installerSource, /mongodump/);
    assert.match(installerSource, /mongorestore/);
    assert.match(installerSource, /mongodb-database-tools-debian12/);
});

test('backup creation and restore verification expose phase progress', () => {
    assert.match(backupRouteSource, /router\.get\('\/backup\/progress'/);
    assert.match(backupRouteSource, /activeBackup/);
    assert.match(backupRouteSource, /activeVerification/);
    assert.match(backupRouteSource, /progressPercent/);
    assert.match(backupRouteSource, /Restoring into temporary database/);
});
