import {
  fetchSpacelabEnabledGuildIds,
  type MaiaSpacelabPluginApiConfig,
} from "./maia-spacelab-plugin-api.js";
import type { GraphMailboxClient } from "./graph-mailbox.js";
import { runSpacelabGuildCycle } from "./run-spacelab-guild-cycle.js";

export const SPACELAB_POLL_INTERVAL_MS = 60_000;

export interface SpacelabMinutePollDeps {
  pluginUrl: string;
  pluginToken: string;
  fetchImpl?: typeof fetch;
  graph: GraphMailboxClient;
  now?: () => number;
  setIntervalImpl?: typeof setInterval;
  runCycle?: typeof runSpacelabGuildCycle;
}

export function startSpacelabMinutePoll(deps: SpacelabMinutePollDeps) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const runCycle = deps.runCycle ?? runSpacelabGuildCycle;
  const setIntervalImpl = deps.setIntervalImpl ?? setInterval;
  let running = false;

  async function tick() {
    if (running) {
      return;
    }
    running = true;
    try {
      const guildIds = await fetchSpacelabEnabledGuildIds({
        pluginUrl: deps.pluginUrl,
        pluginToken: deps.pluginToken,
        fetchImpl,
      });
      for (const guildId of guildIds) {
        const config: MaiaSpacelabPluginApiConfig = {
          pluginUrl: deps.pluginUrl,
          pluginToken: deps.pluginToken,
          guildId,
          fetchImpl,
        };
        await runCycle({ config, graph: deps.graph });
      }
    } finally {
      running = false;
    }
  }

  void tick();
  const timer = setIntervalImpl(() => {
    void tick();
  }, SPACELAB_POLL_INTERVAL_MS);
  timer.unref?.();
  return { tick, timer };
}
