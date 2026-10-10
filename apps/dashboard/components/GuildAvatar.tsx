import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface GuildAvatarProps {
  name: string;
  iconUrl: string | null;
  className?: string;
  /** When false, icon is shown in grayscale (Maia not in server). */
  maiaPresent?: boolean;
}

export function GuildAvatar({
  name,
  iconUrl,
  className,
  maiaPresent = true,
}: GuildAvatarProps) {
  return (
    <Avatar
      className={cn(
        "size-11 rounded-sm",
        !maiaPresent && iconUrl && "opacity-85",
        className,
      )}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          className={cn(
            "aspect-square size-full rounded-sm object-cover",
            !maiaPresent && "grayscale",
          )}
        />
      ) : (
        <AvatarFallback
          className={cn(
            "rounded-sm font-medium",
            !maiaPresent && "grayscale opacity-80",
          )}
        >
          {name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
