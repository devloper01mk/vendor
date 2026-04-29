#!/usr/bin/env node

const {spawn, spawnSync} = require('node:child_process');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: node scripts/run-from-package.js <command> [args...]');
  process.exit(1);
}

function ensureAdbReverse() {
  const isRunAndroid = command.includes('react-native') && args.includes('run-android');
  if (!isRunAndroid) return;
  const reverse = (port) =>
    spawnSync('adb', ['reverse', `tcp:${port}`, `tcp:${port}`], {
      cwd: packageRoot,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  // Keep Metro and local backend reachable from physical devices.
  reverse(8081);
  reverse(4000);
}

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
