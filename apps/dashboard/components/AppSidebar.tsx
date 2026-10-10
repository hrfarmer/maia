"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Circle, Plus } from "lucide-react";
import { GuildAvatar } from "@/components/GuildAvatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { botInviteUrl } from "@/lib/discord";
import type { ServerListItem } from "@/lib/servers";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  servers: ServerListItem[];
  userName: string | null | undefined;
  userImage: string | null | undefined;
  signOut: React.ReactNode;
}

export function AppSidebar({
  servers,
  userName,
  userImage,
  signOut,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-1">
          <SidebarMenu className="flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Maia">
                <Link href="/servers">
                  <span className="flex size-8 items-center justify-center rounded-sm bg-primary text-sm font-semibold text-primary-foreground">
                    M
                  </span>
                  <span className="font-semibold tracking-tight">Maia</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger className="hidden size-9 shrink-0 md:inline-flex" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Servers</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu data-testid="server-list">
              {servers.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No servers with Manage Server permission.
                </p>
              ) : (
                servers.map((server) => {
                  const href = `/servers/${server.id}`;
                  const isActive =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <SidebarMenuItem key={server.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        size="lg"
                        tooltip={server.name}
                        className="min-h-10"
                      >
                        <Link href={href}>
                          <GuildAvatar
                            name={server.name}
                            iconUrl={server.iconUrl}
                            className="size-8 shrink-0"
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate">{server.name}</span>
                            <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                              <Circle
                                className={cn(
                                  "size-2 fill-current",
                                  server.maiaPresent
                                    ? "text-foreground"
                                    : "text-muted-foreground/40",
                                )}
                                aria-hidden
                              />
                              {server.maiaPresent ? "Maia active" : "Not added"}
                            </span>
                          </span>
                        </Link>
                      </SidebarMenuButton>
                      {!server.maiaPresent ? (
                        <SidebarMenuAction asChild title="Add Maia">
                          <a
                            href={botInviteUrl(server.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="size-8 md:size-7"
                            aria-label={`Add Maia to ${server.name}`}
                          >
                            <Plus />
                          </a>
                        </SidebarMenuAction>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="API docs">
              <Link href="/docs">
                <BookOpen />
                <span>API docs</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <div className="flex items-center gap-2 px-2 py-1">
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userImage}
              alt=""
              className="size-8 shrink-0 rounded-sm bg-muted object-cover"
            />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-medium">
              {(userName ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm group-data-[collapsible=icon]:hidden">
            {userName ?? "Signed in"}
          </span>
        </div>
        {signOut}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
