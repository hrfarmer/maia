export interface SpacelabAdaptRoleRowView {
  adaptValue: string;
  inCurrentRoster: boolean;
  linkedRoleId: string | null;
  linkedRoleMissing: boolean;
}

export function buildSpacelabAdaptRoleRows(input: {
  currentAdaptValues: string[];
  linkedRoles: Map<string, string>;
  guildRoleIds: Set<string>;
}): SpacelabAdaptRoleRowView[] {
  const current = new Set(input.currentAdaptValues);
  const values = new Set<string>(input.currentAdaptValues);
  for (const value of input.linkedRoles.keys()) {
    values.add(value);
  }

  return [...values]
    .sort((a, b) => a.localeCompare(b))
    .map((adaptValue) => {
      const linkedRoleId = input.linkedRoles.get(adaptValue) ?? null;
      const linkedRoleMissing =
        linkedRoleId !== null && !input.guildRoleIds.has(linkedRoleId);
      return {
        adaptValue,
        inCurrentRoster: current.has(adaptValue),
        linkedRoleId,
        linkedRoleMissing,
      };
    });
}
