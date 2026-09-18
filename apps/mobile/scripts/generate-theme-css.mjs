/**
 * Generates `global.css` from `src/design/theme.json`.
 *
 * NativeWind classes resolve colours through CSS variables, and `useTheme()`
 * reads the same JSON directly. Generating the stylesheet rather than
 * hand-writing it means a colour cannot be right in one and stale in the other —
 * which would quietly defeat the contrast tests, since they assert against the
 * JSON.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const theme = JSON.parse(readFileSync(join(root, 'src/design/theme.json'), 'utf8'));

/** camelCase token name -> kebab-case CSS custom property. */
const cssVar = (name) => `--c-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

const block = (scheme, indent) =>
  Object.entries(theme.colors[scheme])
    .map(([name, value]) => `${indent}${cssVar(name)}: ${value};`)
    .join('\n');

const css = `/*
 * GENERATED FILE - do not edit.
 * Run \`pnpm --filter @vocab-u/mobile theme:css\` after changing
 * src/design/theme.json. CI regenerates it and fails if the result differs.
 */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Dark is the default: this app is dark-first, and a light flash on launch is
     worse than the reverse. */
  :root {
${block('dark', '    ')}
  }

  @media (prefers-color-scheme: light) {
    :root {
${block('light', '      ')}
    }
  }
}
`;

writeFileSync(join(root, 'global.css'), css);
console.log(`global.css written (${Object.keys(theme.colors.dark).length} colours x 2 schemes)`);
