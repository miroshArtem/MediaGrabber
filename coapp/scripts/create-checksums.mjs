import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [directory, output] = process.argv.slice(2);
if (!directory || !output) throw new Error('Usage: node create-checksums.mjs DIRECTORY OUTPUT');

const names = (await readdir(directory, { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name !== output)
  .map(entry => entry.name)
  .sort();
const lines = [];
for (const name of names) {
  const hash = createHash('sha256').update(await readFile(join(directory, name))).digest('hex');
  lines.push(`${hash}  ${name}`);
}
await writeFile(join(directory, output), `${lines.join('\n')}\n`);
console.log(`Created ${join(directory, output)}`);
