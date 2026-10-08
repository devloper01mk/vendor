#!/usr/bin/env node

const {spawn, spawnSync} = require('node:child_process');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/run-from-package.js <command> [args...]');
  process.exit(1);
}

function syncDevApiHost() {
  const isAndroidCli = command.includes('react-native');
  const isRunAndroid = isAndroidCli && args.includes('run-android');
  const isMetroStart = isAndroidCli && args.includes('start');
  if (!isRunAndroid && !isMetroStart) return;
  spawnSync('node', [path.join(__dirname, 'sync-dev-api-host.js')], {
    cwd: packageRoot,
    stdio: 'inherit',
  });
}

function ensureAdbReverse() {
  const isAndroidCli = command.includes('react-native');
  const isRunAndroid = isAndroidCli && args.includes('run-android');
  const isMetroStart = isAndroidCli && args.includes('start');
  if (!isRunAndroid && !isMetroStart) return;
  const reverse = (port) =>
    spawnSync('adb', ['reverse', `tcp:${port}`, `tcp:${port}`], {
      cwd: packageRoot,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  reverse(8081);
  reverse(4000);
  reverse(4001);
  reverse(3000);
}

syncDevApiHost();
ensureAdbReverse();

const child = spawn(command, args, {
  cwd: packageRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', code => {
  process.exit(code ?? 1);
});

child.on('error', err => {
  console.error(err.message);
  process.exit(1);
});
