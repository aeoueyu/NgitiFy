const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TOOLS_VERSION = String(process.env.MONGODB_TOOLS_VERSION || '100.18.0').trim();
const SKIP_INSTALL = String(process.env.MONGODB_TOOLS_SKIP_INSTALL || '').trim().toLowerCase() === 'true';
const TOOLS_ROOT = path.join(__dirname, '..', 'tools', 'mongodb-database-tools', TOOLS_VERSION);
const BIN_DIR = path.join(TOOLS_ROOT, 'bin');
const MONGODUMP_PATH = path.join(BIN_DIR, 'mongodump');
const MONGORESTORE_PATH = path.join(BIN_DIR, 'mongorestore');

const commandWorks = (command) => {
    if (!command) return false;
    const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
    return !result.error && result.status === 0;
};

const download = (url, destination, redirectCount = 0) => new Promise((resolve, reject) => {
    if (redirectCount > 5) {
        reject(new Error('Too many redirects while downloading MongoDB Database Tools.'));
        return;
    }

    const request = https.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            response.resume();
            download(new URL(response.headers.location, url).toString(), destination, redirectCount + 1)
                .then(resolve, reject);
            return;
        }

        if (response.statusCode !== 200) {
            response.resume();
            reject(new Error(`MongoDB Database Tools download returned HTTP ${response.statusCode}.`));
            return;
        }

        const output = fs.createWriteStream(destination, { flags: 'wx' });
        response.pipe(output);
        output.on('finish', () => output.close(resolve));
        output.on('error', reject);
    });

    request.on('error', reject);
});

const removeIfPresent = (targetPath) => {
    if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    }
};

const main = async () => {
    if (SKIP_INSTALL) {
        console.log('Skipping MongoDB Database Tools installation because MONGODB_TOOLS_SKIP_INSTALL=true.');
        return;
    }

    if (
        (commandWorks(process.env.MONGODUMP_BIN) && commandWorks(process.env.MONGORESTORE_BIN))
        || (commandWorks('mongodump') && commandWorks('mongorestore'))
        || (commandWorks(MONGODUMP_PATH) && commandWorks(MONGORESTORE_PATH))
    ) {
        console.log('MongoDB Database Tools are already available.');
        return;
    }

    if (process.platform !== 'linux') {
        console.log('Skipping automatic MongoDB Database Tools installation outside Linux.');
        return;
    }

    if (process.arch !== 'x64') {
        throw new Error(`Automatic MongoDB Database Tools installation does not support Linux ${process.arch}.`);
    }

    const archiveName = `mongodb-database-tools-debian12-x86_64-${TOOLS_VERSION}.tgz`;
    const downloadUrl = `https://fastdl.mongodb.org/tools/db/${archiveName}`;
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ngitify-mongodb-tools-'));
    const archivePath = path.join(temporaryRoot, archiveName);
    const extractPath = path.join(temporaryRoot, 'extract');

    try {
        fs.mkdirSync(extractPath, { recursive: true });
        console.log(`Downloading MongoDB Database Tools ${TOOLS_VERSION} for Debian 12...`);
        await download(downloadUrl, archivePath);

        const extraction = spawnSync('tar', ['-xzf', archivePath, '-C', extractPath], {
            stdio: 'inherit',
        });
        if (extraction.error || extraction.status !== 0) {
            throw extraction.error || new Error(`tar exited with status ${extraction.status}`);
        }

        const extractedBinDir = path.join(extractPath, archiveName.replace(/\.tgz$/, ''), 'bin');
        for (const executableName of ['mongodump', 'mongorestore']) {
            const sourcePath = path.join(extractedBinDir, executableName);
            if (!fs.existsSync(sourcePath)) {
                throw new Error(`${executableName} was not found in the downloaded archive.`);
            }
        }

        removeIfPresent(TOOLS_ROOT);
        fs.mkdirSync(BIN_DIR, { recursive: true });
        fs.copyFileSync(path.join(extractedBinDir, 'mongodump'), MONGODUMP_PATH);
        fs.copyFileSync(path.join(extractedBinDir, 'mongorestore'), MONGORESTORE_PATH);
        fs.chmodSync(MONGODUMP_PATH, 0o755);
        fs.chmodSync(MONGORESTORE_PATH, 0o755);

        if (!commandWorks(MONGODUMP_PATH) || !commandWorks(MONGORESTORE_PATH)) {
            throw new Error('Installed MongoDB Database Tools did not pass their version checks.');
        }

        console.log(`MongoDB Database Tools installed in ${BIN_DIR}.`);
    } finally {
        removeIfPresent(temporaryRoot);
    }
};

main().catch((error) => {
    console.error(`Failed to install MongoDB Database Tools: ${error.message}`);
    process.exit(1);
});
