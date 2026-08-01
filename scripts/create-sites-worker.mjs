import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';

const buildEntries = await readdir('dist');
await mkdir('dist/client', { recursive: true });
for (const entry of buildEntries) {
  if (entry === 'client' || entry === 'server' || entry === '.openai') continue;
  await cp(`dist/${entry}`, `dist/client/${entry}`, { recursive: true });
}
await mkdir('dist/server', { recursive: true });
await writeFile(
  'dist/server/index.js',
  `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
`,
);
