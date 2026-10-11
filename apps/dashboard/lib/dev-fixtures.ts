export const DEV_GUILD_ID = "987654321098765432";

export const devRoles = [
  {
    id: "111111111111111111",
    name: "Moderator",
    color: 5793266,
    managed: false,
    position: 3,
  },
  {
    id: "222222222222222222",
    name: "Member",
    color: 0,
    managed: false,
    position: 1,
  },
];

export const devMembers = [
  {
    user: { id: "333333333333333333", username: "alex", global_name: "Alex" },
    nick: null,
    roles: ["222222222222222222"],
    communication_disabled_until: null,
  },
  {
    user: { id: "444444444444444444", username: "jordan", global_name: "Jordan" },
    nick: "J",
    roles: ["111111111111111111", "222222222222222222"],
    communication_disabled_until: null,
  },
];

export const devCustomCommands = [
  {
    id: "custom-cmd-1",
    guildId: DEV_GUILD_ID,
    name: "rules",
    description: "Show server rules",
    responseText: "Be kind. No spam.",
    enabled: true,
    ephemeral: false,
    createdAt: new Date("2026-10-09T10:00:00Z"),
    updatedAt: new Date("2026-10-09T10:00:00Z"),
  },
  {
    id: "custom-cmd-2",
    guildId: DEV_GUILD_ID,
    name: "faq",
    description: "Frequently asked questions",
    responseText: "FAQ: ask a mod in #help.",
    enabled: false,
    ephemeral: true,
    createdAt: new Date("2026-10-08T10:00:00Z"),
    updatedAt: new Date("2026-10-08T10:00:00Z"),
  },
];

export const devAudit = [
  {
    id: "audit-1",
    action: "role.add",
    source: "dashboard",
    actorLabel: "Dev User",
    targetType: "member",
    targetId: "333333333333333333",
    success: true,
    createdAt: new Date("2026-10-09T12:00:00Z"),
    detail: JSON.stringify({ roleName: "Member" }),
    errorMessage: null,
  },
];

export const devPluginScan = {
  id: "dev-plugin-scan",
  startedAt: "2026-10-09T10:00:00.000Z",
  completedAt: "2026-10-09T10:00:01.000Z",
  trigger: "startup" as const,
  scanError: null,
  plugins: [
    {
      id: "dev-plugin-ok",
      directoryName: "welcome",
      status: "ok" as const,
      pluginId: "welcome",
      name: "Welcome",
      version: "1.0.0",
      errorMessage: null,
    },
    {
      id: "dev-plugin-error",
      directoryName: "broken",
      status: "error" as const,
      pluginId: null,
      name: null,
      version: null,
      errorMessage: "Missing maia.plugin.json",
    },
  ],
};

export function devHelpersEnabled() {
  return process.env.MAIA_ENABLE_DEV_HELPERS === "1";
}
