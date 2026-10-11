/** Synthetic Lab Roster export (tab-separated). No real personal data. */
export const SYNTHETIC_LAB_ROSTER_EXPORT = [
  "DiscordHandle\tStatus\tSubteam\tSubteam#Id\tRole\tRole#Id",
  'user.a\tActive\t{"Value":"Alpha"}\t1\t{"Value":"IgnoreRole"}\t9',
  'USER.A\tInactive\t{"Value":"Beta"}\t2\t{"Value":"IgnoreRole2"}\t10',
  'user.b\tActive\t[{"Value":"Gamma"},{"Value":"Delta"}]\t3\t{"Value":"IgnoreRole3"}\t11',
].join("\n");

export const SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW = [
  "DiscordHandle\tStatus\tSubteam\tSubteam#Id",
  'user.a\tActive\tnot-json\t1',
].join("\n");
