import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCronInvocationStdin,
  buildInvocationStdin,
  buildManualInvocationStdin,
  buildPluginProcessEnvironment,
  canEnableGuildPlugin,
  shouldDisableAfterValueChange,
} from "./guild-config.js";

describe("guild plugin enablement", () => {
  const environment = [
    { key: "WEBHOOK_URL", required: true, secret: false },
    { key: "API_SECRET", required: true, secret: true },
  ];

  it("cannot enable until required keys have values", () => {
    assert.equal(canEnableGuildPlugin(environment, new Map()), false);
    assert.equal(
      canEnableGuildPlugin(environment, new Map([["WEBHOOK_URL", "https://x"]])),
      false,
    );
    assert.equal(
      canEnableGuildPlugin(
        environment,
        new Map([
          ["WEBHOOK_URL", "https://x"],
          ["API_SECRET", "s"],
        ]),
      ),
      true,
    );
  });

  it("disables when a required value is cleared", () => {
    assert.equal(
      shouldDisableAfterValueChange(
        environment,
        new Map([["WEBHOOK_URL", "https://x"]]),
      ),
      true,
    );
  });
});

describe("plugin process contract", () => {
  it("builds a clean env with guild values and maia vars", () => {
    assert.deepEqual(
      buildPluginProcessEnvironment({
        guildValues: { WEBHOOK_URL: "https://example.com" },
        pluginToken: "mplg_test",
        pluginUrl: "http://127.0.0.1:3847",
      }),
      {
        WEBHOOK_URL: "https://example.com",
        MAIA_PLUGIN_TOKEN: "mplg_test",
        MAIA_PLUGIN_URL: "http://127.0.0.1:3847",
      },
    );
  });

  it("writes manual run stdin naming the guild", () => {
    assert.equal(
      buildManualInvocationStdin("123"),
      '{"guildId":"123","trigger":"run_now"}\n',
    );
  });

  it("writes cron run stdin with a distinct trigger", () => {
    assert.equal(
      buildCronInvocationStdin("123"),
      '{"guildId":"123","trigger":"cron"}\n',
    );
    assert.equal(
      buildInvocationStdin("123", "cron"),
      '{"guildId":"123","trigger":"cron"}\n',
    );
  });
});
