import assert from "node:assert/strict";
import { before, describe, it, mock } from "node:test";
import { MOCK_GUILD_ID } from "../moderation/discord-fetch-mock.js";

const PLUGIN_ID = "spacelab-roster";
const INVOCATION_PLUGIN_ID = "role-sync";

type SettingsRow = {
  guildId: string;
  pluginId: string;
  enabled: boolean;
  cronExpression: string | null;
  slashCommandsEnabled: boolean;
  slashPublishError: string | null;
  slashCollisionNotes: string | null;
};

const settingsByKey = new Map<string, SettingsRow>();
const envValues = new Map<string, Map<string, string>>();
const notifications: Array<{ changeType: string; pluginId: string }> = [];

function settingsKey(guildId: string, pluginId: string) {
  return `${guildId}:${pluginId}`;
}

function getSettings(guildId: string, pluginId: string) {
  return settingsByKey.get(settingsKey(guildId, pluginId));
}

mock.module("@/lib/guild-application-commands/sync", {
  namedExports: {
    syncGuildApplicationCommandsToDiscord: async () => undefined,
  },
});

mock.module("@/lib/session-auth", {
  namedExports: {
    requireSessionGuildAccess: async (guildId: string) => ({
      session: { accessToken: "token", user: { id: "u1", name: "Mgr" } },
      actor: { source: "dashboard" as const, id: "u1", label: "Mgr" },
      guildId,
    }),
  },
});

mock.module("@maia/db", {
  namedExports: {
    getDb: () => ({}),
    getLatestPluginScan: async () => ({
      plugins: [
        {
          id: "p1",
          directoryName: "spacelab-plugins",
          status: "ok" as const,
          pluginId: PLUGIN_ID,
          displayName: "Space Lab roster",
          lifetime: "always-on",
          subscribedEvents: [],
          errorMessage: null,
          environment: [{ key: "ROSTER_COLUMN", required: true, secret: false }],
          slashCommands: [],
        },
        {
          id: "p2",
          directoryName: "role-sync",
          status: "ok" as const,
          pluginId: INVOCATION_PLUGIN_ID,
          displayName: "Role sync",
          lifetime: "invocation",
          subscribedEvents: [],
          errorMessage: null,
          environment: [],
          slashCommands: [
            {
              name: "ping",
              description: "Ping",
              visibility: "public",
              defaultPermission: null,
              options: [],
            },
          ],
        },
      ],
    }),
    getGuildPluginSettings: async (
      _db: unknown,
      guildId: string,
      pluginId: string,
    ) => getSettings(guildId, pluginId) ?? null,
    listGuildPluginSettingsForGuild: async (_db: unknown, guildId: string) =>
      [...settingsByKey.values()].filter((row) => row.guildId === guildId),
    listGuildPluginEnvValuesForGuild: async (_db: unknown, guildId: string) => {
      const map = envValues.get(guildId);
      if (!map) {
        return [];
      }
      return [...map.entries()].map(([envKey, value]) => ({
        guildId,
        pluginId: PLUGIN_ID,
        envKey,
        value,
      }));
    },
    upsertGuildPluginEnvValue: async (
      _db: unknown,
      input: { guildId: string; pluginId: string; envKey: string; value: string },
    ) => {
      const map =
        envValues.get(input.guildId) ?? new Map<string, string>();
      map.set(input.envKey, input.value);
      envValues.set(input.guildId, map);
    },
    deleteGuildPluginEnvValue: async (
      _db: unknown,
      guildId: string,
      _pluginId: string,
      envKey: string,
    ) => {
      envValues.get(guildId)?.delete(envKey);
    },
    setGuildPluginEnabled: async (
      _db: unknown,
      guildId: string,
      pluginId: string,
      enabled: boolean,
    ) => {
      const key = settingsKey(guildId, pluginId);
      const existing = settingsByKey.get(key);
      settingsByKey.set(key, {
        guildId,
        pluginId,
        enabled,
        cronExpression: existing?.cronExpression ?? null,
        slashCommandsEnabled: existing?.slashCommandsEnabled ?? false,
        slashPublishError: existing?.slashPublishError ?? null,
        slashCollisionNotes: existing?.slashCollisionNotes ?? null,
      });
    },
    setGuildPluginCronExpression: async (
      _db: unknown,
      guildId: string,
      pluginId: string,
      cronExpression: string | null,
    ) => {
      const key = settingsKey(guildId, pluginId);
      const existing = settingsByKey.get(key) ?? {
        guildId,
        pluginId,
        enabled: false,
        slashCommandsEnabled: false,
        slashPublishError: null,
        slashCollisionNotes: null,
        cronExpression: null,
      };
      settingsByKey.set(key, { ...existing, cronExpression });
    },
    setGuildPluginSlashCommandsEnabled: async (
      _db: unknown,
      guildId: string,
      pluginId: string,
      slashCommandsEnabled: boolean,
    ) => {
      const key = settingsKey(guildId, pluginId);
      const existing = settingsByKey.get(key) ?? {
        guildId,
        pluginId,
        enabled: false,
        cronExpression: null,
        slashPublishError: null,
        slashCollisionNotes: null,
        slashCommandsEnabled: false,
      };
      settingsByKey.set(key, { ...existing, slashCommandsEnabled });
    },
    guildPluginOauthTokenConnected: async () => true,
    enqueuePluginGuildConfigNotification: async (
      _db: unknown,
      input: { pluginId: string; changeType: string },
    ) => {
      notifications.push({
        pluginId: input.pluginId,
        changeType: input.changeType,
      });
    },
  },
});

describe("guild plugin config PATCH semantics", () => {
  before(() => {
    settingsByKey.clear();
    envValues.clear();
    notifications.length = 0;
    envValues.set(
      MOCK_GUILD_ID,
      new Map([["ROSTER_COLUMN", "Role"]]),
    );
  });

  it("keeps spacelab-roster enabled when saving cron on another plugin", async () => {
    const { updateGuildPluginConfig, getGuildPluginsView } = await import(
      "./service.js"
    );

    const enable = await updateGuildPluginConfig({} as never, MOCK_GUILD_ID, PLUGIN_ID, {
      enabled: true,
    });
    assert.equal("ok" in enable && enable.ok, true);

    const saveCron = await updateGuildPluginConfig(
      {} as never,
      MOCK_GUILD_ID,
      INVOCATION_PLUGIN_ID,
      { cronExpression: "0 * * * *" },
    );
    assert.equal("ok" in saveCron && saveCron.ok, true);
    assert.equal(getSettings(MOCK_GUILD_ID, PLUGIN_ID)?.enabled, true);

    const view = await getGuildPluginsView({} as never, MOCK_GUILD_ID);
    const spaceLab = view.plugins.find((row) => row.pluginId === PLUGIN_ID);
    assert.equal(spaceLab?.enabled, true);
  });

  it("keeps enabled true when saving values without sending enabled", async () => {
    const { updateGuildPluginConfig } = await import("./service.js");

    await updateGuildPluginConfig({} as never, MOCK_GUILD_ID, PLUGIN_ID, {
      enabled: true,
    });

    const saveValues = await updateGuildPluginConfig(
      {} as never,
      MOCK_GUILD_ID,
      PLUGIN_ID,
      { values: { ROSTER_COLUMN: "Role" } },
    );
    assert.equal("ok" in saveValues && saveValues.ok, true);
    assert.equal(getSettings(MOCK_GUILD_ID, PLUGIN_ID)?.enabled, true);
  });

  it("keeps enabled true when toggling slash commands without enabled in body", async () => {
    const { updateGuildPluginConfig } = await import("./service.js");

    await updateGuildPluginConfig({} as never, MOCK_GUILD_ID, PLUGIN_ID, {
      enabled: true,
    });
    await updateGuildPluginConfig({} as never, MOCK_GUILD_ID, INVOCATION_PLUGIN_ID, {
      enabled: true,
    });

    const slash = await updateGuildPluginConfig(
      {} as never,
      MOCK_GUILD_ID,
      INVOCATION_PLUGIN_ID,
      { slashCommandsEnabled: true },
    );
    assert.equal("ok" in slash && slash.ok, true);
    assert.equal(getSettings(MOCK_GUILD_ID, INVOCATION_PLUGIN_ID)?.enabled, true);
    assert.equal(
      getSettings(MOCK_GUILD_ID, INVOCATION_PLUGIN_ID)?.slashCommandsEnabled,
      true,
    );
  });

  it("records enabled then stays enabled across a follow-up partial PATCH (route sequence)", async () => {
    const { PATCH } = await import(
      "../../app/api/servers/[guildId]/plugins/[pluginId]/route.js"
    );

    notifications.length = 0;

    const enableRes = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      }),
      { params: Promise.resolve({ guildId: MOCK_GUILD_ID, pluginId: PLUGIN_ID }) },
    );
    assert.ok(enableRes);
    assert.equal(enableRes.status, 200);
    const enableBody = (await enableRes.json()) as { plugin?: { enabled: boolean } };
    assert.equal(enableBody.plugin?.enabled, true);

    const valuesRes = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: { ROSTER_COLUMN: "Role" } }),
      }),
      { params: Promise.resolve({ guildId: MOCK_GUILD_ID, pluginId: PLUGIN_ID }) },
    );
    assert.ok(valuesRes);
    assert.equal(valuesRes.status, 200);
    const valuesBody = (await valuesRes.json()) as { plugin?: { enabled: boolean } };
    assert.equal(valuesBody.plugin?.enabled, true);
    assert.equal(getSettings(MOCK_GUILD_ID, PLUGIN_ID)?.enabled, true);
  });
});
