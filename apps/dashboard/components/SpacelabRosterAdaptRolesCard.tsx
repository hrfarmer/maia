"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ForceSyncView {
  pending: boolean;
  requestedAt: string | null;
  completedAt: string | null;
  ok: boolean | null;
  error: string | null;
}

interface AdaptRolesView {
  adaptRoleRows: AdaptRoleRow[];
  guildRoles: GuildRoleOption[];
  parsedAt: string | null;
  generalMemberRoleId: string | null;
  generalMemberRoleMissing: boolean;
  rosterSenderEmail: string | null;
  forceSync: ForceSyncView;
}

interface SpacelabRosterAdaptRolesCardProps {
  guildId: string;
}

const UNLINKED_VALUE = "__none__";

export function SpacelabRosterAdaptRolesCard({
  guildId,
}: SpacelabRosterAdaptRolesCardProps) {
  const [view, setView] = useState<AdaptRolesView | null>(null);
  const [rosterSenderDraft, setRosterSenderDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forceSyncOpen, setForceSyncOpen] = useState(false);

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
    setRosterSenderDraft(data.rosterSenderEmail ?? "");
    setStatus(null);
  }, [guildId]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  async function patchSettings(body: Record<string, unknown>) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/plugins/spacelab-roster/adapt-roles`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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

  async function saveLink(adaptValue: string, discordRoleId: string | null) {
    await patchSettings({ links: { [adaptValue]: discordRoleId } });
  }

  async function saveGeneralMemberRole(discordRoleId: string | null) {
    await patchSettings({ generalMemberRoleId: discordRoleId });
  }

  async function saveRosterSenderEmail() {
    const trimmed = rosterSenderDraft.trim();
    await patchSettings({ rosterSenderEmail: trimmed === "" ? null : trimmed });
  }

  async function requestForceSync() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/plugins/spacelab-roster/force-sync`,
        { method: "POST" },
      );
      if (!res.ok) {
        setStatus("Save failed");
        return;
      }
      const data = (await res.json()) as AdaptRolesView;
      setView(data);
    } finally {
      setBusy(false);
      setForceSyncOpen(false);
    }
  }

  function forceSyncStatusLine(forceSync: ForceSyncView) {
    if (forceSync.pending) {
      return forceSync.requestedAt
        ? `Pending since ${new Date(forceSync.requestedAt).toLocaleString()}`
        : "Pending";
    }
    if (!forceSync.completedAt) {
      return null;
    }
    const when = new Date(forceSync.completedAt).toLocaleString();
    if (forceSync.ok === true) {
      return `Last force sync: ${when} (ok)`;
    }
    if (forceSync.ok === false) {
      return `Last force sync: ${when} (${forceSync.error ?? "failed"})`;
    }
    return `Last force sync: ${when}`;
  }

  const forceSyncControls = view ? (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      data-testid="spacelab-force-sync"
    >
      <p className="text-xs text-muted-foreground">
        {forceSyncStatusLine(view.forceSync) ?? "No force sync yet"}
      </p>
      <AlertDialog open={forceSyncOpen} onOpenChange={setForceSyncOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-sm sm:w-auto"
            disabled={busy || view.forceSync.pending}
            data-testid="spacelab-force-sync-button"
          >
            Force sync
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Force sync</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void requestForceSync();
              }}
            >
              Force sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ) : null;

  if (!view) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="spacelab-adapt-roles-loading"
      >
        Loading ADAPT Roles…
      </p>
    );
  }

  const rosterSenderField = (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      data-testid="spacelab-roster-sender"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="spacelab-roster-sender-input">Roster sender</Label>
        <Input
          id="spacelab-roster-sender-input"
          type="email"
          className="rounded-sm"
          disabled={busy}
          value={rosterSenderDraft}
          onChange={(event) => setRosterSenderDraft(event.target.value)}
          autoComplete="email"
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full rounded-sm sm:w-auto"
        disabled={busy}
        data-testid="spacelab-roster-sender-save"
        onClick={() => void saveRosterSenderEmail()}
      >
        Save
      </Button>
    </div>
  );

  const generalMemberRoleField = (
    <div
      className="flex flex-col gap-2 rounded-sm border p-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="spacelab-general-member-role"
    >
      <div className="min-w-0 space-y-1">
        <Label htmlFor="spacelab-general-member-role-select">
          All ADAPT members
        </Label>
        {view.generalMemberRoleMissing ? (
          <Badge variant="destructive" className="rounded-sm">
            Role missing
          </Badge>
        ) : null}
      </div>
      <Select
        disabled={busy}
        value={view.generalMemberRoleId ?? UNLINKED_VALUE}
        onValueChange={(value) =>
          void saveGeneralMemberRole(
            value === UNLINKED_VALUE ? null : value,
          )
        }
      >
        <SelectTrigger
          id="spacelab-general-member-role-select"
          className={cn("w-full rounded-sm sm:w-[min(100%,16rem)]")}
          aria-label="All ADAPT members role"
        >
          <SelectValue placeholder="Select role" />
        </SelectTrigger>
        <SelectContent className="rounded-sm">
          <SelectItem value={UNLINKED_VALUE} className="rounded-sm">
            None
          </SelectItem>
          {view.guildRoles.map((role) => (
            <SelectItem key={role.id} value={role.id} className="rounded-sm">
              {role.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (view.adaptRoleRows.length === 0) {
    return (
      <div className="space-y-3" data-testid="spacelab-adapt-roles">
        <Label>ADAPT Roles</Label>
        {status ? (
          <p className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {status}
          </p>
        ) : null}
        {rosterSenderField}
        {generalMemberRoleField}
        {forceSyncControls}
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

      {rosterSenderField}
      {generalMemberRoleField}
      {forceSyncControls}

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
