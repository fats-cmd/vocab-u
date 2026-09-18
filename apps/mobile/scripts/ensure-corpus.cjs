/**
 * Guarantees the corpus asset exists before Metro bundles.
 *
 * `vocab.db` is a build artifact compiled from open datasets, not a binary
 * checked into git — that is what keeps the validation gate meaningful, since a
 * committed database could carry content that never passed it. The cost is that
 * a fresh clone has no asset until something builds one, and a static
 * `require()` of a missing file fails at bundle time with a message that says
 * nothing about corpora:
 *
 *     Unable to resolve "../../assets/corpus/vocab.db"
 *
 * Metro loads this config on every bundle — `expo start`, `expo export`,
 * `expo run:android`, EAS — so building here covers every path in one place.
 * Clone, install, run: no separate step to remember.
 */
const { execFileSync } = require('node:child_process');
const { copyFileSync, existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '../..');

const ASSET = path.join(projectRoot, 'assets/corpus/vocab.db');
const BUILT = path.join(workspaceRoot, 'tools/corpus/out/vocab.db');

function copyIntoAssets() {
  mkdirSync(path.dirname(ASSET), { recursive: true });
  copyFileSync(BUILT, ASSET);
}

function ensureCorpus() {
  if (existsSync(ASSET)) return;

  if (!existsSync(BUILT)) {
    console.log('[vocab-u] No corpus found — building it (one-off, a few seconds)…');

    // Two ways in, because build environments differ: pnpm is what a contributor
    // has, but a CI or EAS image may not put it on PATH. The tsx binary in the
    // workspace is always there once dependencies are installed.
    const attempts = [
      { cmd: 'pnpm', args: ['--filter', '@vocab-u/corpus', 'build'], cwd: workspaceRoot },
      {
        cmd: process.execPath,
        args: [
          path.join(workspaceRoot, 'node_modules/tsx/dist/cli.mjs'),
          path.join(workspaceRoot, 'tools/corpus/src/build.ts'),
        ],
        cwd: path.join(workspaceRoot, 'tools/corpus'),
      },
    ];

    let built = false;
    for (const { cmd, args, cwd } of attempts) {
      try {
        execFileSync(cmd, args, { cwd, stdio: 'inherit' });
        built = true;
        break;
      } catch {
        // Try the next way in; the error only matters if every one fails.
      }
    }

    if (!built) {
      throw new Error(
        [
          '',
          'The word database is missing and could not be built automatically.',
          '',
          'It is compiled from the datasets rather than committed, so a fresh',
          'clone has to build it once:',
          '',
          '    pnpm install',
          '    pnpm bootstrap',
          '',
          'If that fails, the corpus build prints exactly which content rule',
          'rejected the data.',
        ].join('\n'),
      );
    }
  }

  if (!existsSync(BUILT)) {
    throw new Error('[vocab-u] Corpus build reported success but produced no vocab.db.');
  }

  copyIntoAssets();
  console.log(`[vocab-u] Corpus ready: ${path.relative(workspaceRoot, ASSET)}`);
}

module.exports = { ensureCorpus };
