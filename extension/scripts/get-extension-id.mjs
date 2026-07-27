import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const manifestPath = process.argv[2] || 'manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!manifest.key) throw new Error(`Manifest has no public key: ${manifestPath}`);

const digest = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest();
const id = [...digest.subarray(0, 16)]
  .map(byte => [byte >> 4, byte & 15].map(nibble => String.fromCharCode(97 + nibble)).join(''))
  .join('');

console.log(id);
