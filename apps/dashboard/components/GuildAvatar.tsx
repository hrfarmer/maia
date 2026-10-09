import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface GuildAvatarProps {
  name: string;
  iconUrl: string | null;
  className?: string;
}

export function GuildAvatar({ name, iconUrl, className }: GuildAvatarProps) {
  return (
    <Avatar className={cn("size-11 rounded-sm", className)}>
      {iconUrl ? <AvatarImage src={iconUrl} alt="" className="rounded-sm" /> : null}
      <AvatarFallback className="rounded-sm font-medium">
        {name.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
