"use client";

import { AppSidebar } from "@/components/AppSidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { ServerListItem } from "@/lib/servers";

interface DashboardShellProps {
  servers: ServerListItem[];
  userName: string | null | undefined;
  userImage: string | null | undefined;
  children: React.ReactNode;
}

export function DashboardShell({
  servers,
  userName,
  userImage,
  children,
}: DashboardShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar
        servers={servers}
        userName={userName}
        userImage={userImage}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger className="size-10" />
          <span className="text-base font-semibold tracking-tight">Maia</span>
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden p-4 md:p-6">
          <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
