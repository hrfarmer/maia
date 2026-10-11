import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dueCronTargets } from "./cron-schedule.js";

describe("dueCronTargets", () => {
  const baseTarget = {
    guildId: "111",
    pluginId: "role-sync",
    cronExpression: "0 * * * *",
    enabled: true,
    lifetime: "invocation",
  };

  it("includes enabled invocation plugins when the minute matches", () => {
    const at = new Date("2026-03-02T09:00:00.000Z");
    assert.deepEqual(dueCronTargets([baseTarget], at), [
      { guildId: "111", pluginId: "role-sync" },
    ]);
  });

  it("skips disabled plugins and non-invocation lifetimes", () => {
    const at = new Date("2026-03-02T09:00:00.000Z");
    assert.deepEqual(
      dueCronTargets(
        [
          { ...baseTarget, enabled: false },
          { ...baseTarget, lifetime: "always-on" },
        ],
        at,
      ),
      [],
    );
  });

  it("does not replay minutes that passed while the scheduler was offline", () => {
    const missed = new Date("2026-03-02T09:00:00.000Z");
    const afterDowntime = new Date("2026-03-02T09:05:00.000Z");
    assert.deepEqual(dueCronTargets([baseTarget], missed), [
      { guildId: "111", pluginId: "role-sync" },
    ]);
    assert.deepEqual(dueCronTargets([baseTarget], afterDowntime), []);
  });
});
