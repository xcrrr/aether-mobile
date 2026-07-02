#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
const isWindows = process.platform === 'win32';

const results = [];

function check(name, fn) {
  try {
    const result = fn();
    results.push({ name, ...result });
  } catch (error) {
    results.push({
      name,
      status: 'FAIL',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function pass(detail) {
  return { status: 'PASS', detail };
}

function fail(detail) {
  return { status: 'FAIL', detail };
}

function skipped(detail) {
  return { status: 'SKIPPED', detail };
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function run(command, args, options = {}) {
  const bin = isWindows && command === 'npm' ? 'npm.cmd' : command;
  const shellCommand = isWindows ? [bin, ...args].join(' ') : bin;
  return spawnSync(isWindows ? shellCommand : bin, isWindows ? [] : args, {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    shell: isWindows,
    ...options,
  });
}

function commandOutput(res) {
  const output = [res.stdout, res.stderr]
    .map((part) => {
      if (!part) return '';
      return Buffer.isBuffer(part) ? part.toString('utf8') : String(part);
    })
    .join('');
  return output || (res.error ? res.error.message : '');
}

check('config: app.json release identity', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  if (config.version !== '2.1.0') return fail(`Expected app.json version 2.1.0, found ${config.version}`);
  if (config.android?.package !== 'com.aether.app') return fail(`Unexpected android package ${config.android?.package}`);
  if (!config.android?.permissions?.includes('INTERNET')) return fail('INTERNET permission missing from Expo config');
  return pass('Aether 2.1.0 / com.aether.app');
});

check('config: native Android release identity', () => {
  const gradle = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf8');
  if (!/applicationId 'com\.aether\.app'/.test(gradle)) return fail('applicationId mismatch');
  if (!/versionName "2\.1\.0"/.test(gradle)) return fail('versionName mismatch');
  if (!/versionCode 4/.test(gradle)) return fail('versionCode 4 not found');
  return pass('versionName 2.1.0 / versionCode 4');
});

check('legal: document registry', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'legal', 'documents.ts'), 'utf8');
  for (const id of ['beta-terms', 'privacy-notice', 'research-disclosure', 'ai-safety-notice']) {
    if (!source.includes(`id: '${id}'`)) return fail(`${id} missing`);
  }
  if (!source.includes('requiredAcceptance: true')) return fail('No required acceptance document found');
  return pass('Required legal documents are registered');
});

check('docs: closed beta release docs', () => {
  const required = [
    'docs/aether-data-flow-map.md',
    'docs/aether-closed-beta-release.md',
    'docs/aether-device-beta-checklist.md',
    'docs/aether-legal-review-required.md',
  ];
  const missing = required.filter((rel) => !fs.existsSync(path.join(repoRoot, rel)));
  return missing.length ? fail(`Missing ${missing.join(', ')}`) : pass('Release docs present');
});

check('tests: jest', () => {
  if (!exists('node_modules/.bin/jest') && !exists('node_modules/jest')) {
    return skipped('node_modules is unavailable; run npm install first');
  }
  const res = run('npm', ['test', '--', '--runInBand']);
  return res.status === 0
    ? pass('Jest passed')
    : fail(commandOutput(res).trim().split('\n').slice(-12).join('\n') || 'Jest command failed without output');
});

check('types: strict TypeScript', () => {
  if (!exists('node_modules/.bin/tsc') && !exists('node_modules/typescript')) {
    return skipped('node_modules is unavailable; run npm install first');
  }
  const res = run('npm', ['run', 'typecheck', '--', '--pretty', 'false']);
  return res.status === 0
    ? pass('tsc --noEmit passed')
    : fail(commandOutput(res).trim().split('\n').slice(-12).join('\n') || 'TypeScript command failed without output');
});

check('android: Gradle wrapper', () => {
  return exists('android/gradlew') || exists('android/gradlew.bat')
    ? pass('Gradle wrapper present')
    : fail('Gradle wrapper missing');
});

check('android: Java toolchain availability', () => {
  const res = spawnSync('java', ['-version'], { stdio: 'pipe', encoding: 'utf8' });
  return res.status === 0
    ? pass('java is available')
    : skipped('java is not available on PATH; APK build not attempted');
});

console.log('\nAether closed beta preflight\n');
for (const result of results) {
  console.log(`${result.status.padEnd(7)} ${result.name} - ${result.detail}`);
}

const failed = results.filter((result) => result.status === 'FAIL');
if (failed.length) {
  console.error(`\n${failed.length} blocker(s) found.`);
  process.exit(1);
}

console.log('\nNo preflight blockers found. SKIPPED checks still need manual follow-up where noted.');
