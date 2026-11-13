"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
  SpacelabRoleRemovalDecision,
  SpacelabRoleRemovalRow,
  SpacelabRoleRemovalsView,
} from "@/lib/plugins/spacelab-role-removals-view";

interface SpacelabRoleRemovalsCardProps {
  guildId: string;
}

export function SpacelabRoleRemovalsCard({
  guildId,
}: SpacelabRoleRemovalsCardProps) {
  const [view, setView] = useState<SpacelabRoleRemovalsView | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [denyTarget, setDenyTarget] = useState<SpacelabRoleRemovalRow | null>(
    null,
  );

  const loadView = useCallback(async () => {
    const res = await fetch(
      `/api/servers/${guildId}/plugins/spacelab-roster/role-removals`,
    );
    if (!res.ok) {
      setStatus("Could not load role removals");
      return;
    }
    setView((await res.json()) as SpacelabRoleRemovalsView);
  }, [guildId]);

  useEffect(() => {
    void loadView();
    const timer = setInterval(() => {
      void loadView();
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadView]);

  async function decide(
    discordUserId: string,
    decision: SpacelabRoleRemovalDecision,
  ) {
    setBusyUserId(discordUserId);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/plugins/spacelab-roster/role-removals/${discordUserId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(decision),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setStatus(body?.error ?? "Request failed");
        await loadView();
        return;
      }
      setView((await res.json()) as SpacelabRoleRemovalsView);
    } finally {
      setBusyUserId(null);
      setDenyTarget(null);
    }
  }

  if (!view) {
    return status ? (
      <p className="text-sm text-destructive">{status}</p>
    ) : (
      <p
        className="text-sm text-muted-foreground"
        data-testid="spacelab-role-removals-loading"
      >
        Loading role removals…
      </p>
    );
  }

  return (
    <div
      className="space-y-3 rounded-sm border p-3"
      data-testid="spacelab-role-removals"
    >
      <Label>Role removals</Label>
      {status ? (
        <p className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status}
        </p>
      ) : null}
      {view.flags.length === 0 ? (
        <p className="text-sm" data-testid="spacelab-role-removals-empty">
          None
        </p>
      ) : (
        <ul className="space-y-2">
          {view.flags.map((flag) => (
            <li
              key={flag.discordUserId}
              className="flex flex-col gap-2 rounded-sm border p-3 sm:flex-row sm:items-center sm:justify-between"
              data-testid={`spacelab-role-removal-${flag.discordUserId}`}
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">
                  {flag.discordHandle}
                </p>
                <div className="flex flex-wrap gap-2">
                  {flag.roles.map((role) => (
                    <Badge
                      key={role.id}
                      variant="outline"
                      className="rounded-sm"
                    >
                      {role.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="flex-1 rounded-sm sm:flex-none"
                  disabled={busyUserId !== null}
                  data-testid="spacelab-role-removal-confirm"
                  onClick={() =>
                    void decide(flag.discordUserId, { action: "confirm" })
                  }
                >
                  Remove roles
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-sm sm:flex-none"
                  disabled={busyUserId !== null}
                  data-testid="spacelab-role-removal-deny"
                  onClick={() => setDenyTarget(flag)}
                >
                  Keep roles
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AlertDialog
        open={denyTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDenyTarget(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Ignore {denyTarget?.discordHandle}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyUserId !== null}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              className="rounded-sm"
              disabled={busyUserId !== null}
              data-testid="spacelab-role-removal-ignore-week"
              onClick={() =>
                denyTarget &&
                void decide(denyTarget.discordUserId, {
                  action: "ignore",
                  duration: "week",
                })
              }
            >
              1 week
            </Button>
            <Button
              type="button"
              className="rounded-sm"
              disabled={busyUserId !== null}
              data-testid="spacelab-role-removal-ignore-forever"
              onClick={() =>
                denyTarget &&
                void decide(denyTarget.discordUserId, {
                  action: "ignore",
                  duration: "forever",
                })
              }
            >
              Forever
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
