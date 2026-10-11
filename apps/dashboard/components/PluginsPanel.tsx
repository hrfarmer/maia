"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface PluginEnvironmentField {
  key: string;
  required: boolean;
  secret: boolean;
  value: string | null;
  hasSecretValue: boolean;
}

interface PluginRow {
  id: string;
  directoryName: string;
  status: "ok" | "error";
  pluginId: string | null;
  displayName: string | null;
  lifetime: string | null;
  subscribedEvents: string[];
  errorMessage: string | null;
  environment: PluginEnvironmentField[];
  enabled: boolean;
  canEnable: boolean;
  canRunNow: boolean;
  showCronControl: boolean;
  cronExpression: string | null;
  slashCommands: Array<{ name: string; description: string }>;
  slashCommandsEnabled: boolean;
  showSlashControl: boolean;
  slashPublishError: string | null;
  slashCollisionNotes: Array<{ name: string; reason: string }>;
}

interface ScanState {
  completedAt: string | null;
  scanError: string | null;
  plugins: PluginRow[];
}

interface PluginsPanelProps {
  guildId: string;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function formatEvents(events: string[]) {
  if (events.length === 0) {
    return "—";
  }
  return events.join(", ");
}

function errorRowLabel(plugin: PluginRow) {
  if (plugin.displayName) {
    return plugin.displayName;
  }
  if (plugin.pluginId) {
    return plugin.pluginId;
  }
  return plugin.directoryName;
}

export function PluginsPanel({ guildId }: PluginsPanelProps) {
  const [scan, setScan] = useState<ScanState>({
    completedAt: null,
    scanError: null,
    plugins: [],
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftCron, setDraftCron] = useState("");
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    const res = await fetch(`/api/servers/${guildId}/plugins`);
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as {
      scan: {
        completedAt: string | null;
        scanError: string | null;
        plugins?: PluginRow[];
      } | null;
      plugins?: PluginRow[];
    };
    const pluginRows = data.plugins ?? data.scan?.plugins ?? [];
    if (!data.scan) {
      setScan({ completedAt: null, scanError: null, plugins: pluginRows });
      return;
    }
    setScan({
      completedAt: data.scan.completedAt,
      scanError: data.scan.scanError,
      plugins: pluginRows,
    });
  }, [guildId]);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const selectedPlugin = useMemo(
    () => scan.plugins.find((plugin) => plugin.pluginId === selectedPluginId),
    [scan.plugins, selectedPluginId],
  );

  useEffect(() => {
    if (!selectedPlugin) {
      setDraftValues({});
      setDraftCron("");
      return;
    }
    setDraftCron(selectedPlugin.cronExpression ?? "");
    const next: Record<string, string> = {};
    for (const field of selectedPlugin.environment) {
      if (!field.secret && field.value) {
        next[field.key] = field.value;
      }
    }
    setDraftValues(next);
  }, [selectedPlugin]);

  async function requestRefresh() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/servers/${guildId}/plugins/refresh`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        refresh?: { requestedAt: string; pending: boolean };
        error?: string;
      };
      if (!res.ok) {
        setStatus(data.error ?? "Refresh failed");
        return;
      }
      setStatus("Refresh requested");
      await loadPlugins();
    } finally {
      setBusy(false);
    }
  }

  async function savePluginConfig(input: {
    pluginId: string;
    enabled?: boolean;
    values?: Record<string, string | null>;
    cronExpression?: string | null;
    slashCommandsEnabled?: boolean;
  }) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/plugins/${input.pluginId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: input.enabled,
            values: input.values,
            cronExpression: input.cronExpression,
            slashCommandsEnabled: input.slashCommandsEnabled,
          }),
        },
      );
      const data = (await res.json()) as { error?: string; plugin?: PluginRow };
      if (!res.ok) {
        setStatus(data.error ?? "Save failed");
        return;
      }
      setStatus("Saved");
      await loadPlugins();
    } finally {
      setBusy(false);
    }
  }

  async function runPlugin(pluginId: string) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/plugins/${pluginId}/run`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus(data.error ?? "Run failed");
        return;
      }
      setStatus("Run started");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Last scan: {formatTimestamp(scan.completedAt)}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-sm"
          disabled={busy}
          onClick={() => void requestRefresh()}
        >
          Refresh
        </Button>
      </div>

      {status ? (
        <p className="rounded-sm border bg-muted/50 px-3 py-2 text-sm">{status}</p>
      ) : null}

      {scan.scanError ? (
        <p className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {scan.scanError}
        </p>
      ) : null}

      <div
        className="overflow-x-auto rounded-sm border"
        data-testid="plugins-table"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display name</TableHead>
              <TableHead>Folder</TableHead>
              <TableHead>Lifetime</TableHead>
              <TableHead>Subscribed events</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scan.plugins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No plugins found.
                </TableCell>
              </TableRow>
            ) : (
              scan.plugins.map((plugin) => (
                <TableRow key={plugin.id || plugin.directoryName}>
                  <TableCell className="font-medium">
                    {plugin.status === "ok"
                      ? (plugin.displayName ?? plugin.pluginId ?? "—")
                      : errorRowLabel(plugin)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {plugin.directoryName}
                  </TableCell>
                  <TableCell>{plugin.lifetime ?? "—"}</TableCell>
                  <TableCell className="max-w-[14rem] whitespace-normal text-xs sm:max-w-md sm:text-sm">
                    {plugin.status === "ok"
                      ? formatEvents(plugin.subscribedEvents)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={plugin.status === "ok" ? "secondary" : "destructive"}
                      className={cn(
                        "rounded-sm",
                        plugin.status === "ok" ? "bg-secondary" : undefined,
                      )}
                    >
                      {plugin.status === "ok" ? "runnable" : "error"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[12rem] whitespace-normal text-destructive sm:max-w-xs">
                    {plugin.errorMessage ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 rounded-sm border p-3" data-testid="plugin-config">
        <Label htmlFor="plugin-select">Configure plugin</Label>
        <select
          id="plugin-select"
          className="h-9 w-full rounded-sm border bg-background px-2 text-sm"
          value={selectedPluginId ?? ""}
          onChange={(event) =>
            setSelectedPluginId(event.target.value || null)
          }
        >
          <option value="">Select a plugin</option>
          {scan.plugins
            .filter((plugin) => plugin.status === "ok" && plugin.pluginId)
            .map((plugin) => (
              <option key={plugin.pluginId!} value={plugin.pluginId!}>
                {plugin.displayName ?? plugin.pluginId}
              </option>
            ))}
        </select>

        {selectedPlugin?.pluginId ? (
          <div className="space-y-4">
            {selectedPlugin.environment.length > 0 ? (
              <div className="space-y-3">
                {selectedPlugin.environment.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={`env-${field.key}`}>
                      {field.key}
                      {field.required ? " *" : ""}
                    </Label>
                    <Input
                      id={`env-${field.key}`}
                      className="rounded-sm"
                      type={field.secret ? "password" : "text"}
                      placeholder={
                        field.secret
                          ? field.hasSecretValue
                            ? "Saved (enter to replace)"
                            : "Secret value"
                          : undefined
                      }
                      value={
                        field.secret
                          ? (draftValues[field.key] ?? "")
                          : (draftValues[field.key] ?? field.value ?? "")
                      }
                      onChange={(event) =>
                        setDraftValues((prev) => ({
                          ...prev,
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No environment keys declared.
              </p>
            )}

            {selectedPlugin.showSlashControl ? (
              <div
                className="space-y-2"
                data-testid="plugin-slash-control"
              >
                <div className="flex items-center gap-2">
                  <Switch
                    id="plugin-slash"
                    checked={selectedPlugin.slashCommandsEnabled}
                    disabled={!selectedPlugin.enabled}
                    onCheckedChange={(checked) =>
                      void savePluginConfig({
                        pluginId: selectedPlugin.pluginId!,
                        slashCommandsEnabled: checked,
                      })
                    }
                  />
                  <Label htmlFor="plugin-slash">Slash commands</Label>
                </div>
                {selectedPlugin.slashPublishError ? (
                  <p className="text-sm text-destructive">
                    {selectedPlugin.slashPublishError}
                  </p>
                ) : null}
                {selectedPlugin.slashCollisionNotes.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {selectedPlugin.slashCollisionNotes.map((note) => (
                      <li key={note.name}>
                        /{note.name}: {note.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {selectedPlugin.showCronControl ? (
              <div
                className="space-y-2"
                data-testid="plugin-cron-control"
              >
                <Label htmlFor="plugin-cron">Cron (UTC)</Label>
                <Input
                  id="plugin-cron"
                  className="rounded-sm font-mono text-sm"
                  placeholder="minute hour day month weekday"
                  value={draftCron}
                  onChange={(event) => setDraftCron(event.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-sm"
                  disabled={busy}
                  onClick={() =>
                    void savePluginConfig({
                      pluginId: selectedPlugin.pluginId!,
                      cronExpression: draftCron.trim() === "" ? null : draftCron.trim(),
                    })
                  }
                >
                  Save cron
                </Button>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="plugin-enabled"
                  checked={selectedPlugin.enabled}
                  disabled={!selectedPlugin.canEnable && !selectedPlugin.enabled}
                  onCheckedChange={(checked) =>
                    void savePluginConfig({
                      pluginId: selectedPlugin.pluginId!,
                      enabled: checked,
                    })
                  }
                />
                <Label htmlFor="plugin-enabled">Enabled</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-sm"
                  disabled={busy}
                  onClick={() => {
                    const values: Record<string, string | null> = {};
                    for (const field of selectedPlugin.environment) {
                      const draft = draftValues[field.key];
                      if (field.secret) {
                        if (draft !== undefined && draft !== "") {
                          values[field.key] = draft;
                        }
                        continue;
                      }
                      values[field.key] =
                        draft === undefined || draft === "" ? null : draft;
                    }
                    void savePluginConfig({
                      pluginId: selectedPlugin.pluginId!,
                      values,
                    });
                  }}
                >
                  Save values
                </Button>
                {selectedPlugin.canRunNow ? (
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-sm"
                    disabled={busy}
                    data-testid="run-plugin-now"
                    onClick={() => void runPlugin(selectedPlugin.pluginId!)}
                  >
                    Run now
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
