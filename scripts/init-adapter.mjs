// Cross-platform bootstrap for src/app-adapter.mjs.
// Windows `copy`, POSIX `cp` and OneDrive paths all behave differently, so do
// the work in Node instead of a shell one-liner.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = path.join(root, 'src', 'app-adapter.example.mjs');
const target = path.join(root, 'src', 'app-adapter.mjs');

if (fs.existsSync(target)) {
  console.log(`already exists, leaving it alone: ${target}`);
  process.exit(0);
}

fs.copyFileSync(source, target);
console.log(`created ${path.relative(root, target)}`);
console.log('');
console.log('Next: open it and replace the selectors with your staging app\'s.');
console.log('Then set BASE_URL in .env to that environment and run `npm start`.');
