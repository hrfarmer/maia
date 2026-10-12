/** Synthetic Lab Roster export (tab-separated). No real personal data. */
export const SYNTHETIC_LAB_ROSTER_EXPORT = [
  "DiscordHandle\tStatus\tSubteam\tSubteam#Id\tRole\tRole#Id",
  'user.a\tActive\t{"Value":"Alpha"}\t1\t{"Value":"IgnoreRole"}\t9',
  'USER.A\tInactive\t{"Value":"Beta"}\t2\t{"Value":"IgnoreRole2"}\t10',
  'user.b\tActive\t[{"Value":"Gamma"},{"Value":"Delta"}]\t3\t{"Value":"IgnoreRole3"}\t11',
].join("\n");

/** Power Automate–style CSV (comma-separated, quoted fields, extra columns). */
export const SYNTHETIC_LAB_ROSTER_EXPORT_CSV = [
  "@odata.etag,ItemInternalId,ID,Title,DiscordHandle,Status,Subteam,Subteam#Id,Role,Role#Id",
  '"etag-a","internal-a","1","Row A",user.a,Active,"{""Value"":""Alpha""}",1,"{""Value"":""IgnoreRole""}",9',
  '"etag-b","internal-b","2","Row B",USER.A,Inactive,"{""Value"":""Beta""}",2,"{""Value"":""IgnoreRole2""}",10',
  '"etag-c","internal-c","3","Row C",user.b,Active,"[{""Value"":""Gamma""},{""Value"":""Delta""}]",3,"{""Value"":""IgnoreRole3""}",11',
].join("\r\n");

export const SYNTHETIC_LAB_ROSTER_EXPORT_INVALID_ROW = [
  "DiscordHandle\tStatus\tSubteam\tSubteam#Id",
  "user.a\tActive\tnot-json\t1",
].join("\n");

export const SYNTHETIC_LAB_ROSTER_EXPORT_CSV_INVALID_ROW = [
  "@odata.etag,DiscordHandle,Status,Subteam,Subteam#Id",
  '"e1",user.a,Active,not-json,1',
].join("\n");

/** Power Automate CSV with header and rows separated by whitespace only (Graph text body). */
export const SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED =
  SYNTHETIC_LAB_ROSTER_EXPORT_CSV.replace(/\r?\n/g, " ").trim();

/** Same export with an unquoted multi-word Title to guard record-boundary splitting. */
export const SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED_MULTIWORD_TITLE = [
  "@odata.etag,ItemInternalId,ID,Title,DiscordHandle,Status,Subteam,Subteam#Id,Role,Role#Id",
  '"etag-a","internal-a","1",Jane Example,user.a,Active,"{""Value"":""Alpha""}",1,"{""Value"":""IgnoreRole""}",9',
  '"etag-b","internal-b","2",Other Person,USER.A,Inactive,"{""Value"":""Beta""}",2,"{""Value"":""IgnoreRole2""}",10',
  '"etag-c","internal-c","3",Row C,user.b,Active,"[{""Value"":""Gamma""},{""Value"":""Delta""}]",3,"{""Value"":""IgnoreRole3""}",11',
]
  .join(" ")
  .trim();
