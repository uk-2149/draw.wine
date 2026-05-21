import { cn } from "@/helpers/cn.h";
import { Crown } from "lucide-react";

interface UpgradeBannerProps {
  message: string;
  className?: string;
}

/**
 * Contextual upgrade banner shown when a user hits a free-mode limit.
 * No checkout flow — just informational messaging.
 */
export const UpgradeBanner = ({ message, className }: UpgradeBannerProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-amber-400/30 bg-gradient-to-r from-amber-400/5 to-yellow-500/5 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      <span>{message}</span>
    </div>
  );
};
