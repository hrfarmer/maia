"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Circle, Plus } from "lucide-react";
import { SignOutSidebarItem } from "@/components/SignOutSidebarItem";
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { botInviteUrl } from "@/lib/discord";
import type { ServerListItem } from "@/lib/servers";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  servers: ServerListItem[];
  userName: string | null | undefined;
  userImage: string | null | undefined;
}

export function AppSidebar({
  servers,
  userName,
  userImage,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { state, isMobile } = useSidebar();
  const iconRail = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader
        className={cn(
          "border-b border-sidebar-border",
          iconRail
            ? "flex flex-col items-center gap-2 py-2"
            : "flex flex-row items-center gap-2",
        )}
      >
        <SidebarMenu className={cn(iconRail ? "w-full" : "min-w-0 flex-1")}>
          <SidebarMenuItem className={cn(iconRail && "flex justify-center")}>
            <SidebarMenuButton size="lg" asChild tooltip="Maia">
              <Link href="/servers">
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-sm bg-primary text-sm font-semibold text-primary-foreground">
                  M
                </span>
                {!iconRail ? (
                  <span className="truncate font-semibold tracking-tight">Maia</span>
                ) : null}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!iconRail ? (
          <SidebarTrigger className="hidden shrink-0 md:inline-flex" />
        ) : (
          <SidebarTrigger className="shrink-0" />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Servers</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu data-testid="server-list">
              {servers.length === 0 ? (
                <p
                  className={cn(
                    "px-2 py-3 text-xs text-muted-foreground",
                    iconRail && "sr-only",
                  )}
                >
                  No servers with Manage Server permission.
                </p>
              ) : (
                servers.map((server) => {
                  const href = `/servers/${server.id}`;
                  const isActive =
                    pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <SidebarMenuItem
                      key={server.id}
                      className={cn(iconRail && "flex justify-center")}
                    >
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={server.name}
                        size="lg"
                        className={cn(
                          iconRail && "justify-center",
                          !iconRail &&
                            "gap-3 [&>span:last-child]:overflow-visible [&>span:last-child]:whitespace-normal",
                        )}
                      >
                        <Link href={href}>
                          <GuildAvatar
                            name={server.name}
                            iconUrl={server.iconUrl}
                            maiaPresent={server.maiaPresent}
                            className="size-8 shrink-0"
                          />
                          {!iconRail ? (
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                              <span className="truncate">{server.name}</span>
                              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                                <Circle
                                  className={cn(
                                    "size-2 shrink-0 fill-current",
                                    server.maiaPresent
                                      ? "text-foreground"
                                      : "text-muted-foreground/40",
                                  )}
                                  aria-hidden
                                />
                                {server.maiaPresent ? "Maia active" : "Not added"}
                              </span>
                            </span>
                          ) : null}
                        </Link>
                      </SidebarMenuButton>
                      {!server.maiaPresent && !iconRail ? (
                        <SidebarMenuAction asChild title="Add Maia">
                          <a
                            href={botInviteUrl(server.id)}
                            target="_blank"
                            rel="noreferrer"
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
          <SidebarMenuItem className={cn(iconRail && "flex justify-center")}>
            <SidebarMenuButton
              asChild
              tooltip="API docs"
              className={cn(iconRail && "justify-center")}
            >
              <Link href="/docs">
                <BookOpen className="size-4 shrink-0" />
                {!iconRail ? <span>API docs</span> : null}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className={cn(iconRail && "flex justify-center")}>
            <SidebarMenuButton
              tooltip={userName ?? "Signed in"}
              className={cn(iconRail && "justify-center")}
            >
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt=""
                  className="aspect-square size-8 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-xs font-medium">
                  {(userName ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              {!iconRail ? (
                <span className="truncate">{userName ?? "Signed in"}</span>
              ) : null}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className={cn(iconRail && "flex justify-center")}>
            <SignOutSidebarItem iconRail={iconRail} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
