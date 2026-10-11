"use client";

import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";

interface SpacelabCycleStatus {
  lastCycleAt: string | null;
  lastError: string | null;
  pendingMembers: Array<{ discordHandle: string }>;
  exhaustedMembers: Array<{ discordHandle: string }>;
}

interface SpacelabCycleStatusCardProps {
  guildId: string;
}

export function SpacelabCycleStatusCard({
  guildId,
}: SpacelabCycleStatusCardProps) {
  const [status, setStatus] = useState<SpacelabCycleStatus | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch(
      `/api/servers/${guildId}/plugins/spacelab-roster/cycle-status`,
    );
    if (!res.ok) {
      return;
    }
    setStatus((await res.json()) as SpacelabCycleStatus);
  }, [guildId]);

  useEffect(() => {
    void loadStatus();
    const timer = setInterval(() => {
      void loadStatus();
    }, 30_000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  if (!status) {
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid="spacelab-cycle-loading"
      >
        Loading sync status…
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-sm border p-3" data-testid="spacelab-cycle-status">
      <Label>Sync status</Label>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Last cycle</dt>
          <dd data-testid="spacelab-last-cycle">
            {status.lastCycleAt
              ? new Date(status.lastCycleAt).toLocaleString()
              : "Never"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last error</dt>
          <dd data-testid="spacelab-last-error">
            {status.lastError ?? "None"}
          </dd>
        </div>
      </dl>
      <div className="space-y-2 text-sm">
        <div>
          <p className="text-muted-foreground">Pending retry</p>
          {status.pendingMembers.length === 0 ? (
            <p data-testid="spacelab-pending-empty">None</p>
          ) : (
            <ul
              className="list-inside list-disc"
              data-testid="spacelab-pending-members"
            >
              {status.pendingMembers.map((member) => (
                <li key={member.discordHandle}>{member.discordHandle}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Exhausted (5 attempts)</p>
          {status.exhaustedMembers.length === 0 ? (
            <p data-testid="spacelab-exhausted-empty">None</p>
          ) : (
            <ul
              className="list-inside list-disc"
              data-testid="spacelab-exhausted-members"
            >
              {status.exhaustedMembers.map((member) => (
                <li key={member.discordHandle}>{member.discordHandle}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
