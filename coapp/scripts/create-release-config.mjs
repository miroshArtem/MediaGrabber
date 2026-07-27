import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const [output, repository, tag, extensionId, ffmpegPath, ffprobePath, ytdlpPath] = process.argv.slice(2);
if (!output || !repository || !tag || !extensionId || !ffmpegPath || !ffprobePath || !ytdlpPath) {
  throw new Error('Usage: node create-release-config.mjs OUTPUT REPOSITORY TAG EXTENSION_ID FFMPEG FFPROBE YTDLP');
}

async function checksum(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

const baseUrl = `https://github.com/${repository}/releases/download/${tag}`;
const files = [
  ['ffmpeg', ffmpegPath],
  ['ffprobe', ffprobePath],
  ['ytdlp', ytdlpPath]
];
const runtime = {};
for (const [kind, filePath] of files) {
  const fileName = filePath.split(/[\\/]/).pop();
  runtime[kind] = {
    url: `${baseUrl}/${fileName}`,
    sha256: await checksum(filePath)
  };
}

await writeFile(output, `${JSON.stringify({ extensionId, tag, runtime }, null, 2)}\n`);
console.log(`Created ${output}`);
