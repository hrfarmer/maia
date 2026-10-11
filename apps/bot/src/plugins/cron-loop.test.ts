import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runPluginCronTick } from "./cron-loop.js";

describe("runPluginCronTick", () => {
  it("enqueues cron-triggered run requests for due targets", async () => {
    const enqueued: Array<{
      guildId: string;
      pluginId: string;
      trigger: string;
    }> = [];
    await runPluginCronTick({} as never, { now: () => new Date("2026-03-02T09:00:00.000Z") }, {
      listTargets: async () => [
        {
          guildId: "111",
          pluginId: "role-sync",
          cronExpression: "0 * * * *",
          enabled: true,
          lifetime: "invocation",
        },
      ],
      enqueue: async (_db, guildId, pluginId, trigger = "run_now") => {
        enqueued.push({ guildId, pluginId, trigger });
        return "run-id";
      },
    });
    assert.deepEqual(enqueued, [
      { guildId: "111", pluginId: "role-sync", trigger: "cron" },
    ]);
  });

  it("does not route cron runs through event delivery (uses run request queue)", async () => {
    let usedRunRequestQueue = false;
    await runPluginCronTick({} as never, { now: () => new Date("2026-03-02T10:00:00.000Z") }, {
      listTargets: async () => [
        {
          guildId: "111",
          pluginId: "role-sync",
          cronExpression: "0 * * * *",
          enabled: true,
          lifetime: "invocation",
        },
      ],
      enqueue: async () => {
        usedRunRequestQueue = true;
        return "run-id";
      },
    });
    assert.equal(usedRunRequestQueue, true);
  });
});
