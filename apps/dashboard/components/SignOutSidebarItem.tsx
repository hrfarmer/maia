"use client";

import { LogOut } from "lucide-react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { signOutAction } from "@/lib/actions/sign-out";

interface SignOutSidebarItemProps {
  iconRail?: boolean;
}

export function SignOutSidebarItem({ iconRail = false }: SignOutSidebarItemProps) {
  return (
    <form
      action={signOutAction}
      className={iconRail ? "flex w-full justify-center" : "w-full"}
    >
      <SidebarMenuButton
        tooltip="Sign out"
        asChild
        className={iconRail ? "justify-center" : undefined}
      >
        <button type="submit">
          <LogOut className="size-4 shrink-0" />
          {!iconRail ? <span>Sign out</span> : null}
        </button>
      </SidebarMenuButton>
    </form>
  );
}
