import { useEffect, useState } from "react";
import { cn } from "@/helpers/cn.h";
import { Clock, AlertTriangle } from "lucide-react";

interface RoomTimerProps {
  expiresAt: number | null;
}

/**
 * Countdown timer showing time remaining on a room session.
 * Transitions color as time runs low: green → yellow → red.
 */
export const RoomTimer = ({ expiresAt }: RoomTimerProps) => {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(diff);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt || remaining === null) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isExpired = remaining <= 0;
  const isWarning = remaining <= 300; // 5 min
  const isCritical = remaining <= 60; // 1 min

  return (
    <>
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border px-3 h-11 text-sm font-medium shadow-lg backdrop-blur-md select-none transition-all font-mono",
          isExpired
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : isCritical
              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse"
              : isWarning
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : "bg-background/80 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted",
        )}
      >
        <Clock className="h-4 w-4" />
        {isExpired
          ? "Expired"
          : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
      </div>

      {/* Warning banner at 5 minutes */}
      {isWarning && !isExpired && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 backdrop-blur-md px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 shadow-lg animate-in slide-in-from-top-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Room expires in {minutes}m {seconds}s
        </div>
      )}

      {/* Expiry overlay */}
      {isExpired && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center max-w-md p-8 bg-card border rounded-2xl shadow-2xl">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Room Session Ended</h2>
            <p className="text-muted-foreground mb-6">
              This free room has expired. Upgrade to Premium for extended or unlimited sessions.
            </p>
            <button
              onClick={() => (window.location.href = "/")}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      )}
    </>
  );
};
