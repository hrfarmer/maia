"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AdaptRoleRow {
  adaptValue: string;
  inCurrentRoster: boolean;
  linkedRoleId: string | null;
  linkedRoleMissing: boolean;
}

interface GuildRoleOption {
  id: string;
  name: string;
}

interface AdaptRolesView {
  adaptRoleRows: AdaptRoleRow[];
  guildRoles: GuildRoleOption[];
  parsedAt: string | null;
}

interface SpacelabRosterAdaptRolesCardProps {
  guildId: string;
}

const UNLINKED_VALUE = "__none__";

export function SpacelabRosterAdaptRolesCard({
  guildId,
}: SpacelabRosterAdaptRolesCardProps) {
  const [view, setView] = useState<AdaptRolesView | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadView = useCallback(async () => {
    const res = await fetch(
      `/api/servers/${guildId}/plugins/spacelab-roster/adapt-roles`,
    );
    if (!res.ok) {
      setStatus("Could not load ADAPT Roles");
      return;
    }
    const data = (await res.json()) as AdaptRolesView;
    setView(data);
    setStatus(null);
  }, [guildId]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  async function saveLink(adaptValue: string, discordRoleId: string | null) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/plugins/spacelab-roster/adapt-roles`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            links: { [adaptValue]: discordRoleId },
          }),
        },
      );
      if (!res.ok) {
        setStatus("Save failed");
        return;
      }
      const data = (await res.json()) as AdaptRolesView;
      setView(data);
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="spacelab-adapt-roles">
        Loading ADAPT Roles…
      </p>
    );
  }

  if (view.adaptRoleRows.length === 0) {
    return (
      <div className="space-y-2" data-testid="spacelab-adapt-roles">
        <Label>ADAPT Roles</Label>
        <p className="text-sm text-muted-foreground">No roster values yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="spacelab-adapt-roles">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <Label>ADAPT Roles</Label>
        {view.parsedAt ? (
          <p className="text-xs text-muted-foreground">
            Parsed {new Date(view.parsedAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {status ? (
        <p className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status}
        </p>
      ) : null}

      <ul className="space-y-3">
        {view.adaptRoleRows.map((row) => (
          <li
            key={row.adaptValue}
            className="flex flex-col gap-2 rounded-sm border p-3 sm:flex-row sm:items-center sm:justify-between"
            data-testid={`adapt-role-row-${row.adaptValue}`}
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium">{row.adaptValue}</p>
              <div className="flex flex-wrap gap-2">
                {!row.inCurrentRoster ? (
                  <Badge variant="outline" className="rounded-sm">
                    Not in roster
                  </Badge>
                ) : null}
                {row.linkedRoleMissing ? (
                  <Badge variant="destructive" className="rounded-sm">
                    Role missing
                  </Badge>
                ) : null}
              </div>
            </div>
            <Select
              disabled={busy}
              value={row.linkedRoleId ?? UNLINKED_VALUE}
              onValueChange={(value) =>
                void saveLink(
                  row.adaptValue,
                  value === UNLINKED_VALUE ? null : value,
                )
              }
            >
              <SelectTrigger
                className={cn("w-full rounded-sm sm:w-[min(100%,16rem)]")}
                aria-label={`Discord role for ${row.adaptValue}`}
              >
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="rounded-sm">
                <SelectItem value={UNLINKED_VALUE} className="rounded-sm">
                  None
                </SelectItem>
                {view.guildRoles.map((role) => (
                  <SelectItem
                    key={role.id}
                    value={role.id}
                    className="rounded-sm"
                  >
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </div>
  );
}
