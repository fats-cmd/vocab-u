// Monorepo-aware Metro config: the app imports @vocab-u/core from the workspace
// root, so Metro has to watch it and resolve modules from both node_modules trees.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { ensureCorpus } = require('./scripts/ensure-corpus.cjs');
const path = require('node:path');

// Build the corpus before anything tries to resolve it. Metro loads this file
// on every bundle, so this covers expo start, export, run:android and EAS alike.
ensureCorpus();

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Deliberately NOT setting `disableHierarchicalLookup`: it is the recommended
// setting for npm/yarn monorepos but breaks resolution of transitive deps under
// pnpm, which is what this workspace uses.
// The corpus ships as a bundled asset; `.wasm` is required by expo-sqlite's
// web build, which runs SQLite through wa-sqlite in a worker.
config.resolver.assetExts.push('db', 'wasm');

// `global.css` is generated from src/design/theme.json — see scripts/generate-theme-css.mjs.
module.exports = withNativeWind(config, { input: './global.css' });
