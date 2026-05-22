import { useTier } from "@/contexts/tier/useTier";
import { cn } from "@/helpers/cn.h";
import { Crown, Zap } from "lucide-react";

/**
 * AI usage bar showing used / limit requests with a fill bar.
 * In premium mode shows a premium badge instead of a filling bar.
 */
export const AiUsageBar = () => {
  const { aiQuota, isPremium } = useTier();
  const { used, limit, remaining } = aiQuota;

  const ratio = limit > 0 ? used / limit : 0;
  const isExhausted = remaining <= 0;
  const isNearLimit = ratio >= 0.8;

  if (isPremium) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-gradient-to-r from-amber-400/10 to-yellow-500/10 px-3 py-2">
        <Crown className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Premium AI — Unlimited
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <Zap className="h-3 w-3" />
          AI Usage
        </span>
        <span
          className={cn(
            "font-semibold",
            isExhausted
              ? "text-destructive"
              : isNearLimit
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {used} / {limit}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isExhausted
              ? "bg-destructive"
              : isNearLimit
                ? "bg-amber-500"
                : "bg-primary",
          )}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      {isExhausted && (
        <p className="text-[10px] text-destructive font-medium">
          Monthly AI quota exhausted. Resets next month.
        </p>
      )}
    </div>
  );
};
