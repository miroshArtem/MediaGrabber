import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const [, , inputArg = 'dist/main.bundle.cjs', outputArg = 'dist/coapp'] = process.argv;
const input = resolve(inputArg);
const output = resolve(outputArg + (process.platform === 'win32' && !outputArg.endsWith('.exe') ? '.exe' : ''));
const assets = {};
const gzipAssets = {};
for (const arg of process.argv.slice(4)) {
  const prefix = arg.startsWith('--gzip-asset=') ? '--gzip-asset=' : arg.startsWith('--asset=') ? '--asset=' : '';
  if (!prefix) continue;
  const [key, assetPath] = arg.slice(prefix.length).split('=', 2);
  if (!key || !assetPath) throw new Error(`Invalid asset argument: ${arg}`);
  if (prefix === '--gzip-asset=') gzipAssets[key] = resolve(assetPath);
  else assets[key] = resolve(assetPath);
}
const workDir = await mkdtemp(join(tmpdir(), 'mediagrabber-sea-'));
const configPath = join(workDir, 'sea-config.json');
const blobPath = join(workDir, 'sea-prep.blob');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: command.endsWith('.cmd'),
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? `signal ${result.signal}`}`);
  }
}

try {
  for (const [key, assetPath] of Object.entries(gzipAssets)) {
    const compressedPath = join(workDir, `${key}.gz`);
    await writeFile(compressedPath, gzipSync(await readFile(assetPath)));
    assets[key] = compressedPath;
  }
  const config = {
    main: input,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    ...(Object.keys(assets).length ? { assets } : {})
  };
  await writeFile(configPath, JSON.stringify(config, null, 2));
  run(process.execPath, ['--experimental-sea-config', configPath]);
  await rm(output, { force: true });
  await copyFile(process.execPath, output);

  if (process.platform === 'darwin') {
    run('codesign', ['--remove-signature', output]);
  }

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  run(npx, [
    '--yes',
    'postject@1.0.0-alpha.6',
    output,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
  ].concat(process.platform === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : []));

  if (process.platform === 'darwin') {
    run('codesign', ['--sign', '-', output]);
  }
  console.log(`Created ${output}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
