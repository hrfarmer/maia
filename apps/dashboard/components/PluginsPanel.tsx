"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface PluginRow {
  id: string;
  directoryName: string;
  status: "ok" | "error";
  pluginId: string | null;
  name: string | null;
  version: string | null;
  errorMessage: string | null;
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

export function PluginsPanel({ guildId }: PluginsPanelProps) {
  const [scan, setScan] = useState<ScanState>({
    completedAt: null,
    scanError: null,
    plugins: [],
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    const res = await fetch(`/api/servers/${guildId}/plugins`);
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as {
      scan: {
        completedAt: string | null;
        scanError: string | null;
        plugins: PluginRow[];
      } | null;
    };
    if (!data.scan) {
      setScan({ completedAt: null, scanError: null, plugins: [] });
      return;
    }
    setScan({
      completedAt: data.scan.completedAt,
      scanError: data.scan.scanError,
      plugins: data.scan.plugins ?? [],
    });
  }, [guildId]);

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

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
              <TableHead>Folder</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
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
                  <TableCell className="font-mono text-xs sm:text-sm">
                    {plugin.directoryName}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={plugin.status === "ok" ? "secondary" : "destructive"}
                      className={cn(
                        "rounded-sm",
                        plugin.status === "ok" ? "bg-secondary" : undefined,
                      )}
                    >
                      {plugin.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{plugin.pluginId ?? "—"}</TableCell>
                  <TableCell>{plugin.name ?? "—"}</TableCell>
                  <TableCell>{plugin.version ?? "—"}</TableCell>
                  <TableCell className="max-w-[12rem] truncate text-destructive sm:max-w-xs">
                    {plugin.errorMessage ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
