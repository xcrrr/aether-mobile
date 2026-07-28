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

/**
 * Known-incomplete work that must be finished before the app is distributed to
 * anyone outside this machine, but which is expected to be outstanding while
 * the beta is still being built. A plain run reports these and exits 0; a run
 * with `--public` treats every one of them as a hard blocker.
 *
 * This distinction exists because the preflight previously reported "no
 * blockers" for a build that was debug-signed and carried unreviewed draft
 * legal documents. Passing preflight has to mean something.
 */
function blocked(detail) {
  return { status: 'BLOCKED', detail };
}

const publicRelease = process.argv.includes('--public');

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

check('config: version consistency', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const gradle = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf8');
  const gradleVersion = gradle.match(/versionName "([^"]+)"/)?.[1];
  return config.version === gradleVersion
    ? pass(`app.json and build.gradle agree on ${gradleVersion}`)
    : fail(`app.json says ${config.version}, build.gradle says ${gradleVersion}`);
});

check('android: release signing', () => {
  const gradle = fs.readFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'utf8');
  if (!gradle.includes('keystore.properties')) {
    return fail('build.gradle no longer reads keystore.properties — release signing wiring was removed');
  }
  return exists('android/keystore.properties')
    ? pass('android/keystore.properties present; release builds are release-signed')
    : blocked('No android/keystore.properties — release APKs are DEBUG-SIGNED. See android/keystore.properties.example');
});

check('android: permission surface', () => {
  const manifest = fs.readFileSync(
    path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8',
  );
  const mustBeRemoved = ['READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'SYSTEM_ALERT_WINDOW'];
  const granted = mustBeRemoved.filter((name) => {
    const line = manifest.split('\n').find((l) => l.includes(`android.permission.${name}`));
    return line && !line.includes('tools:node="remove"');
  });
  return granted.length
    ? fail(`Permissions requested that Aether does not use: ${granted.join(', ')}`)
    : pass('No unused permissions requested');
});

check('legal: documents are review-complete', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'legal', 'documents.ts'), 'utf8');
  const drafts = (source.match(/version: '[^']*-draft[^']*'/g) ?? []).length;
  const unreviewed = (source.match(/status: 'draft-review-required'/g) ?? []).length;
  if (!drafts && !unreviewed) return pass('No draft legal documents remain');
  return blocked(
    `${drafts} document version(s) still marked draft and ${unreviewed} still status 'draft-review-required'. `
    + 'See docs/aether-legal-review-required.md',
  );
});

check('release: MVP scope flag', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'release', 'features.ts'), 'utf8');
  const match = source.match(/export const TASK_UI_ENABLED = (true|false)/);
  if (!match) return fail('TASK_UI_ENABLED not found in src/release/features.ts');
  return match[1] === 'false'
    ? pass('TASK_UI_ENABLED=false — Task and Library are hidden, matching the MVP scope')
    : blocked('TASK_UI_ENABLED=true — Task is exposed, which is outside the agreed MVP scope');
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
const pending = results.filter((result) => result.status === 'BLOCKED');

if (pending.length) {
  console.log('\nOutstanding before public distribution:');
  for (const result of pending) console.log(`  - ${result.name}: ${result.detail}`);
}

if (failed.length) {
  console.error(`\n${failed.length} blocker(s) found.`);
  process.exit(1);
}

if (publicRelease && pending.length) {
  console.error(`\n${pending.length} item(s) block public distribution. Re-run without --public for a development check.`);
  process.exit(1);
}

console.log(
  pending.length
    ? '\nNo development blockers. The items above still block public distribution — re-run with --public to gate on them.'
    : '\nNo preflight blockers found. SKIPPED checks still need manual follow-up where noted.',
);
