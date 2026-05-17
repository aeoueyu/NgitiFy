const { spawnSync } = require('child_process');
const path = require('path');

const requirementsPath = path.join(__dirname, '..', 'python', 'requirements-ai.txt');

const getCandidateCommands = () => {
    const configured = String(process.env.OPENCV_PYTHON_BIN || '').trim();
    if (configured) {
        return [{ command: configured, args: [] }];
    }

    if (process.platform === 'win32') {
        return [
            { command: 'python', args: [] },
            { command: 'py', args: ['-3'] },
        ];
    }

    return [
        { command: 'python3', args: [] },
        { command: 'python', args: [] },
    ];
};

const candidates = getCandidateCommands();
let lastFailure = null;

for (const candidate of candidates) {
    const args = [...candidate.args, '-m', 'pip', 'install', '-r', requirementsPath];
    const result = spawnSync(candidate.command, args, {
        stdio: 'inherit',
    });

    if (!result.error && result.status === 0) {
        process.exit(0);
    }

    lastFailure = result.error
        ? `${candidate.command}: ${result.error.message}`
        : `${candidate.command}: exited with status ${result.status}`;
}

console.error(`Failed to install optional Python AI dependencies for radiograph enhancement. Last error: ${lastFailure}`);
process.exit(1);
