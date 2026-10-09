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

export function devHelpersEnabled() {
  return process.env.MAIA_ENABLE_DEV_HELPERS === "1";
}
