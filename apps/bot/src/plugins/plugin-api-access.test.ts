import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Db } from "@maia/db";
import { loadGuildPluginValuesForApi } from "./plugin-api-access.js";

describe("loadGuildPluginValuesForApi", () => {
  it("includes roster sender email for Space Lab roster guild values", async () => {
    const db = {
      query: {
        guildPluginEnvValues: {
          findMany: async () => [
            { envKey: "ROSTER_COLUMN", value: "Subteam" },
          ],
        },
        spacelabGuildAdaptSettings: {
          findFirst: async () => ({
            rosterSenderEmail: "roster@lab.edu",
          }),
        },
      },
    } as unknown as Db;

    const values = await loadGuildPluginValuesForApi(
      db,
      "guild-1",
      "spacelab-roster",
    );
    assert.equal(values.ROSTER_COLUMN, "Subteam");
    assert.equal(values.ROSTER_SENDER_EMAIL, "roster@lab.edu");
  });
});
