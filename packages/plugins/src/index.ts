export {
  discoverPlugins,
  type DiscoveredPluginEntry,
  type DiscoveredPluginStatus,
  type DiscoverPluginsOptions,
} from "./discover.js";
export {
  PLUGIN_MANIFEST_FILENAME,
  PluginManifestError,
  parsePluginManifest,
  type PluginManifest,
} from "./manifest.js";
export {
  DEFAULT_DOCKER_PLUGINS_DIR,
  resolvePluginsDirectory,
} from "./paths.js";
