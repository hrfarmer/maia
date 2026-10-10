"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const RESPONSE_MAX = 2000;

interface CustomCommandRow {
  id: string;
  name: string;
  description: string;
  responseText: string;
  enabled: boolean;
  ephemeral: boolean;
}

interface SyncState {
  syncedAt: string | null;
  syncError: string | null;
}

interface CustomCommandsPanelProps {
  guildId: string;
}

export function CustomCommandsPanel({ guildId }: CustomCommandsPanelProps) {
  const [commands, setCommands] = useState<CustomCommandRow[]>([]);
  const [sync, setSync] = useState<SyncState>({
    syncedAt: null,
    syncError: null,
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [responseText, setResponseText] = useState("");
  const [ephemeral, setEphemeral] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLabel, setConfirmLabel] = useState("");
  const [confirmRun, setConfirmRun] = useState<(() => Promise<void>) | null>(
    null,
  );

  const loadCommands = useCallback(async () => {
    const res = await fetch(`/api/servers/${guildId}/custom-commands`);
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as {
      commands: CustomCommandRow[];
      sync: SyncState;
    };
    setCommands(data.commands ?? []);
    setSync(data.sync ?? { syncedAt: null, syncError: null });
  }, [guildId]);

  useEffect(() => {
    void loadCommands();
  }, [loadCommands]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setResponseText("");
    setEphemeral(false);
  }

  function startEdit(command: CustomCommandRow) {
    setEditingId(command.id);
    setName(command.name);
    setDescription(command.description);
    setResponseText(command.responseText);
    setEphemeral(command.ephemeral);
    setStatus(null);
  }

  function openConfirm(label: string, run: () => Promise<void>) {
    setConfirmLabel(label);
    setConfirmRun(() => run);
    setConfirmOpen(true);
  }

  async function retrySync() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/servers/${guildId}/custom-commands/sync`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        sync?: { ok?: boolean; error?: string };
        error?: string;
      };
      if (!res.ok) {
        setStatus(data.sync?.error ?? data.error ?? "Sync failed");
      } else {
        setStatus("Commands synced with Discord.");
      }
      await loadCommands();
    } finally {
      setBusy(false);
    }
  }

  async function saveCommand() {
    setBusy(true);
    setStatus(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        responseText,
        ephemeral,
      };
      const url = editingId
        ? `/api/servers/${guildId}/custom-commands/${editingId}`
        : `/api/servers/${guildId}/custom-commands`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        sync?: { ok?: boolean; error?: string };
      };
      if (!res.ok) {
        setStatus(data.error ?? "Request failed");
        return;
      }
      if (data.sync && !data.sync.ok) {
        setStatus(
          `Saved, but Discord sync failed: ${data.sync.error ?? "unknown error"}`,
        );
      } else {
        setStatus(editingId ? "Command updated." : "Command created.");
        resetForm();
      }
      await loadCommands();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(command: CustomCommandRow) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/custom-commands/${command.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !command.enabled }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        sync?: { ok?: boolean; error?: string };
      };
      if (!res.ok) {
        setStatus(data.error ?? "Request failed");
        return;
      }
      if (data.sync && !data.sync.ok) {
        setStatus(
          `Updated locally, but Discord sync failed: ${data.sync.error ?? "unknown error"}`,
        );
      }
      await loadCommands();
    } finally {
      setBusy(false);
    }
  }

  async function deleteCommand(commandId: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/custom-commands/${commandId}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as {
        error?: string;
        sync?: { ok?: boolean; error?: string };
      };
      if (!res.ok) {
        setStatus(data.error ?? "Request failed");
        return;
      }
      if (editingId === commandId) {
        resetForm();
      }
      if (data.sync && !data.sync.ok) {
        setStatus(
          `Deleted locally, but Discord sync failed: ${data.sync.error ?? "unknown error"}`,
        );
      } else {
        setStatus("Command deleted.");
      }
      await loadCommands();
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    responseText.trim().length > 0 &&
    responseText.length <= RESPONSE_MAX;

  return (
    <>
      {sync.syncError ? (
        <div
          className="mb-4 rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
          data-testid="custom-command-sync-error"
        >
          <p className="text-destructive">
            Discord sync failed: {sync.syncError}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={busy}
            onClick={() => void retrySync()}
          >
            Retry sync
          </Button>
        </div>
      ) : sync.syncedAt ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Last synced with Discord:{" "}
          {new Date(sync.syncedAt).toLocaleString()}
        </p>
      ) : null}

      {status ? (
        <p className="mb-4 rounded-sm border bg-muted/50 px-3 py-2 text-sm">
          {status}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-4">
        <Card
          className="min-w-0 gap-0 py-0 shadow-none"
          data-testid="custom-commands-form"
        >
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">
              {editingId ? "Edit command" : "New command"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-cmd-name">Name</Label>
              <Input
                id="custom-cmd-name"
                placeholder="rules"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, hyphens, underscores. Max 32 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-cmd-description">Description</Label>
              <Input
                id="custom-cmd-description"
                placeholder="What this command does"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-sm border px-3 py-2">
              <Label htmlFor="custom-cmd-ephemeral">Only you</Label>
              <Switch
                id="custom-cmd-ephemeral"
                checked={ephemeral}
                onCheckedChange={setEphemeral}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-cmd-response">Response</Label>
              <textarea
                id="custom-cmd-response"
                className={cn(
                  "border-input bg-background flex min-h-28 w-full rounded-sm border px-3 py-2 text-sm",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
                maxLength={RESPONSE_MAX}
                value={responseText}
                onChange={(event) => setResponseText(event.target.value)}
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                {responseText.length}/{RESPONSE_MAX}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || !canSubmit}
                onClick={() => void saveCommand()}
              >
                {editingId ? "Save changes" : "Create command"}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={resetForm}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-0 py-0 shadow-none">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">Custom commands</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-x-auto p-0">
            <Table
              className="min-w-[40rem]"
              data-testid="custom-commands-table"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Command</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commands.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No custom commands yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  commands.map((command) => (
                    <TableRow key={command.id}>
                      <TableCell className="pl-4">
                        <div className="font-mono text-sm">/{command.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {command.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {command.ephemeral ? "Only you" : "Public"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={command.enabled ? "secondary" : "outline"}
                        >
                          {command.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-normal pr-4 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => startEdit(command)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void toggleEnabled(command)}
                          >
                            {command.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              openConfirm(
                                `Delete /${command.name}? This removes it from Discord for this server.`,
                                async () => deleteCommand(command.id),
                              )
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm</AlertDialogTitle>
            <AlertDialogDescription>{confirmLabel}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                setConfirmOpen(false);
                if (confirmRun) {
                  void confirmRun();
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
