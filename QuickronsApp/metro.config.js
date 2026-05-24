// Metro config for Expo SDK 50.
//
// Why this file exists:
// `react-native-web@0.19.x` has internal modules that do `require('styleq')` and
// `require('inline-style-prefixer')`. On `expo export --platform web` Metro
// happily walks up to project-root `node_modules` and resolves these. But the
// `expo start --web` dev-server bundler occasionally fails the same walk and
// errors with:
//   Unable to resolve "styleq" from "node_modules/react-native-web/dist/exports/StyleSheet/index.js"
//
// Pinning `extraNodeModules` makes the resolution explicit and deterministic
// for both dev and production bundles. No other Metro behavior is altered.

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  styleq:                  path.resolve(projectRoot, 'node_modules/styleq'),
  'inline-style-prefixer': path.resolve(projectRoot, 'node_modules/inline-style-prefixer'),
};

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

module.exports = config;
