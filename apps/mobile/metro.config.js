// Monorepo-aware Metro config: the app imports @vocab-u/core from the workspace
// root, so Metro has to watch it and resolve modules from both node_modules trees.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

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

module.exports = config;
