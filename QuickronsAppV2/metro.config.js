// Pin react-native-web peer-deps so the dev server resolver doesn't fail walking up.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  styleq:                  path.resolve(projectRoot, 'node_modules/styleq'),
  'inline-style-prefixer': path.resolve(projectRoot, 'node_modules/inline-style-prefixer'),
};

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
