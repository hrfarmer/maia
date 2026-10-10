"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomCommandsPanel } from "@/components/CustomCommandsPanel";

interface RoleRow {
  id: string;
  name: string;
  color: number;
  managed: boolean;
}

interface MemberRow {
  user?: { id: string; username: string; global_name?: string | null };
  nick?: string | null;
  roles: string[];
}

interface AuditRow {
  id: string;
  action: string;
  source: string;
  actorLabel: string | null;
  targetType: string;
  targetId: string;
  success: boolean;
  createdAt: string;
  detail: string | null;
  errorMessage: string | null;
}

interface ApiKeyRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ServerManagePanelProps {
  guildId: string;
}

function displayName(member: MemberRow) {
  return (
    member.nick ??
    member.user?.global_name ??
    member.user?.username ??
    member.user?.id ??
    "Unknown"
  );
}

function roleColorHex(color: number) {
  if (color === 0) {
    return undefined;
  }
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function ServerManagePanel({ guildId }: ServerManagePanelProps) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberRoleIds, setMemberRoleIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLabel, setConfirmLabel] = useState("");
  const [confirmRun, setConfirmRun] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [addRoleValue, setAddRoleValue] = useState<string>("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("");
  const [newRoleHoist, setNewRoleHoist] = useState(false);
  const [newRoleMentionable, setNewRoleMentionable] = useState(false);

  const roleById = useMemo(() => {
    const map = new Map<string, RoleRow>();
    for (const role of roles) {
      map.set(role.id, role);
    }
    return map;
  }, [roles]);

  const loadRoles = useCallback(async () => {
    const res = await fetch(`/api/servers/${guildId}/roles`);
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { roles: RoleRow[] };
    setRoles(data.roles);
  }, [guildId]);

  const loadAudit = useCallback(async () => {
    const res = await fetch(`/api/servers/${guildId}/audit`);
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { entries: AuditRow[] };
    setAudit(
      data.entries.map((entry) => ({
        ...entry,
        createdAt:
          typeof entry.createdAt === "string"
            ? entry.createdAt
            : new Date(entry.createdAt).toISOString(),
      })),
    );
  }, [guildId]);

  const loadApiKeys = useCallback(async () => {
    const res = await fetch(`/api/servers/${guildId}/api-keys`);
    if (!res.ok) {
      return;
    }
    const data = (await res.json()) as { keys: ApiKeyRow[] };
    setApiKeys(data.keys);
  }, [guildId]);

  useEffect(() => {
    void loadRoles();
    void loadAudit();
    void loadApiKeys();
  }, [loadRoles, loadAudit, loadApiKeys]);

  function openConfirm(label: string, run: () => Promise<void>) {
    setConfirmLabel(label);
    setConfirmRun(() => run);
    setConfirmOpen(true);
  }

  async function searchMembers() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/members?q=${encodeURIComponent(query)}`,
      );
      const data = (await res.json()) as { members: MemberRow[] };
      setMembers(data.members ?? []);
      if ((data.members ?? []).length === 0) {
        setStatus("No members matched.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function selectMember(userId: string) {
    setSelectedMemberId(userId);
    const res = await fetch(
      `/api/servers/${guildId}/members/${userId}/roles`,
    );
    const data = (await res.json()) as { roleIds: string[] };
    setMemberRoleIds(data.roleIds ?? []);
  }

  async function mutateMemberRole(action: "add" | "remove", roleId: string) {
    if (!selectedMemberId) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/members/${selectedMemberId}/roles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, roleId }),
        },
      );
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setStatus(err.error ?? "Request failed");
        return;
      }
      await selectMember(selectedMemberId);
      await loadAudit();
      setStatus(action === "add" ? "Role added." : "Role removed.");
    } finally {
      setBusy(false);
    }
  }

  async function runMemberAction(payload: Record<string, unknown>) {
    if (!selectedMemberId) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/servers/${guildId}/members/${selectedMemberId}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setStatus(err.error ?? "Request failed");
        return;
      }
      await loadAudit();
      setStatus("Done.");
    } finally {
      setBusy(false);
    }
  }

  async function createRole() {
    const name = newRoleName.trim();
    if (!name) {
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const payload: Record<string, unknown> = {
        name,
        hoist: newRoleHoist,
        mentionable: newRoleMentionable,
      };
      const color = newRoleColor.trim();
      if (color) {
        payload.color = color;
      }
      const res = await fetch(`/api/servers/${guildId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setStatus(err.error ?? "Request failed");
        return;
      }
      setNewRoleName("");
      setNewRoleColor("");
      setNewRoleHoist(false);
      setNewRoleMentionable(false);
      await loadRoles();
      await loadAudit();
      setStatus("Role created.");
    } finally {
      setBusy(false);
    }
  }

  async function createApiKey() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/servers/${guildId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = (await res.json()) as {
        key?: { token: string };
        error?: string;
      };
      if (!res.ok) {
        setStatus(data.error ?? "Failed to create key");
        return;
      }
      setCreatedToken(data.key?.token ?? null);
      setNewKeyName("");
      await loadApiKeys();
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(keyId: string) {
    setBusy(true);
    try {
      await fetch(`/api/servers/${guildId}/api-keys/${keyId}`, {
        method: "DELETE",
      });
      await loadApiKeys();
    } finally {
      setBusy(false);
    }
  }

  const availableRoles = roles.filter(
    (role) => !memberRoleIds.includes(role.id),
  );

  return (
    <>
      {status ? (
        <p className="mb-4 rounded-sm border bg-muted/50 px-3 py-2 text-sm">
          {status}
        </p>
      ) : null}

      <Tabs defaultValue="members" data-testid="manage-tabs">
        <TabsList variant="line" className="mb-4 w-full justify-start">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="api-keys">API keys</TabsTrigger>
          <TabsTrigger value="custom-commands">Custom commands</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-0 py-0 shadow-none">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-base">Search</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Input
                    type="search"
                    placeholder="Username or nickname"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void searchMembers();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || query.trim().length === 0}
                    onClick={() => void searchMembers()}
                  >
                    Search
                  </Button>
                </div>
                <div data-testid="member-search-results">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No results.
                    </p>
                  ) : (
                    <Table>
                      <TableBody>
                        {members.map((member) => {
                          const id = member.user?.id ?? "";
                          const selected = selectedMemberId === id;
                          return (
                            <TableRow
                              key={id}
                              className={selected ? "bg-muted/50" : undefined}
                              onClick={() => void selectMember(id)}
                            >
                              <TableCell className="cursor-pointer font-medium">
                                {displayName(member)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0 shadow-none">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-base">Member</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 py-4">
                {!selectedMemberId ? (
                  <p className="text-sm text-muted-foreground">
                    Select a member.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {memberRoleIds.map((roleId) => (
                        <Badge
                          key={roleId}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          {roleById.get(roleId)?.name ?? roleId}
                          <button
                            type="button"
                            className="rounded-sm p-0.5 hover:bg-background/80"
                            disabled={busy}
                            aria-label="Remove role"
                            onClick={() =>
                              openConfirm(
                                `Remove role ${roleById.get(roleId)?.name ?? roleId}?`,
                                async () =>
                                  mutateMemberRole("remove", roleId),
                              )
                            }
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-role">Add role</Label>
                      <Select
                        value={addRoleValue}
                        onValueChange={(roleId) => {
                          setAddRoleValue("");
                          if (roleId) {
                            void mutateMemberRole("add", roleId);
                          }
                        }}
                      >
                        <SelectTrigger id="add-role" className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          openConfirm("Kick this member?", async () =>
                            runMemberAction({ action: "kick" }),
                          )
                        }
                      >
                        Kick
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          openConfirm("Ban this member?", async () =>
                            runMemberAction({ action: "ban" }),
                          )
                        }
                      >
                        Ban
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runMemberAction({ action: "timeout", minutes: 10 })
                        }
                      >
                        Timeout 10m
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runMemberAction({ action: "untimeout" })
                        }
                      >
                        Remove timeout
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">Roles</CardTitle>
            </CardHeader>
            <CardContent
              className="space-y-4 border-b p-4"
              data-testid="role-create-form"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="new-role-name">Name</Label>
                  <Input
                    id="new-role-name"
                    placeholder="Role name"
                    value={newRoleName}
                    onChange={(event) => setNewRoleName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-role-color">Color</Label>
                  <Input
                    id="new-role-color"
                    placeholder="#5865F2"
                    value={newRoleColor}
                    onChange={(event) => setNewRoleColor(event.target.value)}
                  />
                </div>
                <div className="flex flex-col justify-end gap-3 sm:flex-row sm:items-center lg:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded-sm border"
                      checked={newRoleHoist}
                      onChange={(event) => setNewRoleHoist(event.target.checked)}
                    />
                    Hoist
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded-sm border"
                      checked={newRoleMentionable}
                      onChange={(event) =>
                        setNewRoleMentionable(event.target.checked)
                      }
                    />
                    Mentionable
                  </label>
                  <Button
                    type="button"
                    disabled={busy || !newRoleName.trim()}
                    onClick={() => void createRole()}
                  >
                    Create role
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-4" />
                    <TableHead>Name</TableHead>
                    <TableHead className="pr-4 text-right">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="pl-4">
                        <span
                          className="inline-block size-2.5 rounded-sm border"
                          style={{
                            backgroundColor:
                              roleColorHex(role.color) ?? "transparent",
                          }}
                        />
                      </TableCell>
                      <TableCell>{role.name}</TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground">
                        {role.managed ? "Managed" : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="gap-0 py-0 shadow-none">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">Audit log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table data-testid="audit-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Action</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="pr-4 text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4 font-mono text-xs">
                        {entry.action}
                        {!entry.success ? (
                          <span className="ml-2 text-destructive">failed</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.source}
                        {entry.actorLabel ? ` · ${entry.actorLabel}` : ""}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.targetId}
                      </TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-commands">
          <CustomCommandsPanel guildId={guildId} />
        </TabsContent>

        <TabsContent value="api-keys">
          <Card className="shadow-none">
            <CardHeader className="border-b">
              <CardTitle className="text-base">API keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Key name"
                  value={newKeyName}
                  onChange={(event) => setNewKeyName(event.target.value)}
                />
                <Button
                  type="button"
                  disabled={busy || !newKeyName.trim()}
                  onClick={() => void createApiKey()}
                >
                  Create
                </Button>
              </div>
              {createdToken ? (
                <p className="rounded-sm border bg-muted/40 p-3 font-mono text-xs break-all">
                  {createdToken}
                </p>
              ) : null}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="pr-4 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="pl-4 font-medium">
                        {key.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            openConfirm(
                              `Revoke API key "${key.name}"?`,
                              async () => revokeKey(key.id),
                            )
                          }
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
