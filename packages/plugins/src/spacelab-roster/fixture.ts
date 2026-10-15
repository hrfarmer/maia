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
/** CSV row with a line break between a closing quote and the following comma (Graph wrap). */
export const SYNTHETIC_LAB_ROSTER_EXPORT_CSV_WRAPPED_QUOTE_BEFORE_COMMA = [
  "@odata.etag,ItemInternalId,ID,Title,DiscordHandle,Status,Subteam,Subteam#Id,Role,Role#Id",
  '"etag-a","internal-a"\n,"1","Row A",user.a,Active,"{""Value"":""Alpha""}",1,"{""Value"":""IgnoreRole""}",9',
  '"etag-b","internal-b","2","Row B",USER.A,Inactive,"{""Value"":""Beta""}",2,"{""Value"":""IgnoreRole2""}",10',
  '"etag-c","internal-c","3","Row C",user.b,Active,"[{""Value"":""Gamma""},{""Value"":""Delta""}]",3,"{""Value"":""IgnoreRole3""}",11',
]
  .join("\n")
  .trim();

/** CSV row with a wrapped unquoted field (line break mid Title). */
export const SYNTHETIC_LAB_ROSTER_EXPORT_CSV_WRAPPED_UNQUOTED_FIELD = [
  "@odata.etag,ItemInternalId,ID,Title,DiscordHandle,Status,Subteam,Subteam#Id,Role,Role#Id",
  '"etag-a","internal-a","1",Jane\nExample,user.a,Active,"{""Value"":""Alpha""}",1,"{""Value"":""IgnoreRole""}",9',
  '"etag-b","internal-b","2",Other Person,USER.A,Inactive,"{""Value"":""Beta""}",2,"{""Value"":""IgnoreRole2""}",10',
  '"etag-c","internal-c","3",Row C,user.b,Active,"[{""Value"":""Gamma""},{""Value"":""Delta""}]",3,"{""Value"":""IgnoreRole3""}",11',
]
  .join("\n")
  .trim();

export const SYNTHETIC_LAB_ROSTER_EXPORT_CSV_SPACE_SEPARATED_MULTIWORD_TITLE = [
  "@odata.etag,ItemInternalId,ID,Title,DiscordHandle,Status,Subteam,Subteam#Id,Role,Role#Id",
  '"etag-a","internal-a","1",Jane Example,user.a,Active,"{""Value"":""Alpha""}",1,"{""Value"":""IgnoreRole""}",9',
  '"etag-b","internal-b","2",Other Person,USER.A,Inactive,"{""Value"":""Beta""}",2,"{""Value"":""IgnoreRole2""}",10',
  '"etag-c","internal-c","3",Row C,user.b,Active,"[{""Value"":""Gamma""},{""Value"":""Delta""}]",3,"{""Value"":""IgnoreRole3""}",11',
]
  .join(" ")
  .trim();

/** Production-width header row (42 columns); last column matches Graph text exports. */
export const PRODUCTION_SHAPE_LAB_ROSTER_HEADERS = [
  "@odata.etag",
  "ItemInternalId",
  "ID",
  "Title",
  "Member",
  "GitHubHandle",
  "TXSTEmail",
  "DiscordHandle",
  "Status",
  "Subteam",
  "Subteam#Id",
  "Role",
  "Role#Id",
  "Created",
  "Modified",
  "AuthorLookupId",
  "EditorLookupId",
  "OData__UIVersionString",
  "Attachments",
  "Edit",
  "LinkTitleNoMenu",
  "LinkTitle",
  "DocIcon",
  "ItemChildCount",
  "FolderChildCount",
  "ComplianceAssetId",
  "Exp_x002e_Advisor",
  "Exp_x002e_Advisor#Id",
  "Exp_x002e_LabRole",
  "Exp_x002e_LabRole#Id",
  "Exp_x002e_ProjectSite",
  "Exp_x002e_Notes",
  "Exp_x002e_StartDate",
  "Exp_x002e_EndDate",
  "Exp_x002e_GraduationYear",
  "Exp_x002e_CourseCredit",
  "Exp_x002e_CourseCredit#Id",
  "Exp_x002e_Pronouns",
  "Exp_x002e_LinkedinURL",
  "Exp_x002e_ResearchArea",
  "Exp_x002e_GraduationSemester",
  "Exp_x002e_GraduationSemester#Id",
] as const;

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Power Automate etag cells: quoted field whose decoded value is `"<digits>"`. */
function productionEtagField(recordIndex: number): string {
  return `"""${recordIndex}"""`;
}

function productionStatusField(active: boolean): string {
  const label = active ? "Active" : "Inactive";
  return csvField(`{"Value":"${label}"}`);
}

function productionSubteamField(recordIndex: number): string {
  const primary = `Team${String.fromCharCode(65 + (recordIndex % 26))}`;
  if (recordIndex % 11 === 0) {
    const secondary = `Team${String.fromCharCode(65 + ((recordIndex + 1) % 26))}`;
    return csvField(
      `[{"Value":"${primary}"},{"Value":"${secondary}"}]`,
    );
  }
  return csvField(`{"Value":"${primary}"}`);
}

export interface ProductionShapeLabRosterExportOptions {
  emptyDiscordHandleAt?: number[];
  emptyGitHubHandleAt?: number[];
}

/** One-line export: 42 columns, 36 records, space-separated rows, empty last field on most rows. */
export function buildProductionShapeLabRosterExport(
  options: ProductionShapeLabRosterExportOptions = {},
): string {
  const emptyDiscord = new Set(options.emptyDiscordHandleAt ?? []);
  const emptyGitHub = new Set(options.emptyGitHubHandleAt ?? []);
  const header = PRODUCTION_SHAPE_LAB_ROSTER_HEADERS.join(",");
  const records: string[] = [];
  for (let index = 0; index < 36; index += 1) {
    const active = index % 3 !== 1;
    const fields: string[] = new Array(PRODUCTION_SHAPE_LAB_ROSTER_HEADERS.length);
    fields[0] = productionEtagField(index + 5);
    fields[1] = csvField(`internal-${index}`);
    fields[2] = String(1000 + index);
    fields[3] = index === 0 ? "Professor Example" : `Member ${index}`;
    fields[4] = csvField(`Member Name ${index}`);
    fields[5] = emptyGitHub.has(index) ? "" : `labuser${index}`;
    fields[6] = `labuser${index}@example.edu`;
    fields[7] = emptyDiscord.has(index) ? "" : `synthetic.user.${index}`;
    fields[8] = productionStatusField(active);
    fields[9] = productionSubteamField(index);
    fields[10] = String((index % 7) + 1);
    fields[11] = csvField(`{"Value":"Role${index % 4}"}`);
    fields[12] = String(index % 5);
    fields[13] = "2024-01-15T12:00:00Z";
    fields[14] = "2025-06-01T08:30:00Z";
    fields[15] = "12";
    fields[16] = "34";
    fields[17] = "1.0";
    fields[18] = "0";
    fields[19] = "0";
    fields[20] = csvField(`Member ${index}`);
    fields[21] = csvField(`Member ${index}`);
    fields[22] = "0";
    fields[23] = "0";
    fields[24] = "0";
    fields[25] = "";
    fields[26] = csvField(`{"Value":"Advisor ${index % 3}"}`);
    fields[27] = String(index % 3);
    fields[28] = csvField(`{"Value":"LabRole${index % 2}"}`);
    fields[29] = String(index % 2);
    fields[30] = `https://example.edu/project/${index}?ref=lab&team=${index}`;
    fields[31] = csvField(`Note ${index}`);
    fields[32] = "2023-08-20";
    fields[33] = "";
    fields[34] = String(2024 + (index % 3));
    fields[35] = csvField(`{"Value":"Credit ${index % 2}"}`);
    fields[36] = String(index % 2);
    fields[37] = "they/them";
    fields[38] = `https://linkedin.com/in/labuser${index}`;
    fields[39] = csvField(`{"Value":"Area ${index % 4}"}`);
    fields[40] = csvField(`{"Value":"Fall ${2024 + (index % 2)}"}`);
    const lastNumeric = index % 9 === 4;
    fields[41] = lastNumeric ? String(5 + (index % 3)) : "";
    records.push(fields.join(","));
  }
  return `${header} ${records.join(" ")}`.trim();
}

export const SYNTHETIC_LAB_ROSTER_EXPORT_PRODUCTION_SHAPE =
  buildProductionShapeLabRosterExport();

/** Simulates Graph/Outlook soft wraps outside quoted CSV regions. */
export function injectGraphLikeLineWraps(
  body: string,
  width: number,
  insert = "\r\n",
): string {
  let out = "";
  let lineLen = 0;
  let inQuotes = false;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]!;
    if (char === '"') {
      if (inQuotes && body[index + 1] === '"') {
        out += '""';
        lineLen += 2;
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
    }
    if (!inQuotes && lineLen >= width) {
      out += insert;
      lineLen = 0;
    }
    out += char;
    lineLen += 1;
  }
  return out;
}

/** Inserts a wrap at a single index (for targeted regression cases). */
export function injectTextAt(body: string, index: number, insert: string): string {
  return `${body.slice(0, index)}${insert}${body.slice(index)}`;
}

export const SYNTHETIC_LAB_ROSTER_EXPORT_PRODUCTION_SHAPE_WITH_SKIPPED_ROWS =
  buildProductionShapeLabRosterExport({
    emptyDiscordHandleAt: [17],
    emptyGitHubHandleAt: [2, 5, 8, 11, 14, 20],
  });
