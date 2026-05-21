import { cn } from "@/helpers/cn.h";
import { Users } from "lucide-react";

interface RoomCapacityBadgeProps {
  currentUsers: number;
  maxUsers: number;
}

/**
 * Badge showing X / Y users with a progress fill bar.
 */
export const RoomCapacityBadge = ({ currentUsers, maxUsers }: RoomCapacityBadgeProps) => {
  const ratio = maxUsers > 0 ? currentUsers / maxUsers : 0;
  const isNearCapacity = ratio >= 0.8;
  const isAtCapacity = currentUsers >= maxUsers;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 h-11 text-sm font-medium shadow-lg backdrop-blur-md select-none transition-all",
        isAtCapacity
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : isNearCapacity
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            : "bg-background/80 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted",
      )}
    >
      <Users className="h-4 w-4" />
      <span>
        {currentUsers} / {maxUsers}
      </span>
      {/* Tiny progress bar */}
      <div className="w-10 h-1.5 rounded-full bg-muted-foreground/20 overflow-hidden ml-1">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isAtCapacity
              ? "bg-destructive"
              : isNearCapacity
                ? "bg-amber-500"
                : "bg-primary",
          )}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
};
