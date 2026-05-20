import { TOOLBAR_ITEMS } from "@/constants/toolbar";
import { Menubar } from "../../ui/menubar";
import { CMenubtn } from "./menubtn";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useDrawing } from "@/contexts/drawing/useDrawing";
import type { ToolType } from "@/types/drawing";
import { useCollab } from "@/contexts/collab/useCollab";
import { cn } from "@/helpers/cn.h";

interface ToolbarProps {
  orientation?: "horizontal" | "vertical";
}

export const Toolbar = memo(({ orientation = "horizontal" }: ToolbarProps) => {
  const { selectedTool, setSelectedTool } = useDrawing();
  const { state } = useCollab();
  const [selected, setSelected] = useState<number | null>(0);

  const canDraw =
    !state.settings?.onlyHostCanDraw ||
    state.userId === state.hostId ||
    !state.isCollaborating;

  const visibleItems = useMemo(
    () =>
      TOOLBAR_ITEMS.filter((item) => {
        if (canDraw) return true;
        return ["Hand", "select", "Laser"].includes(item.tooltip);
      }),
    [canDraw],
  );

  const handleSelect = useCallback(
    (item: (typeof TOOLBAR_ITEMS)[0]) => {
      setSelectedTool(item.tooltip as ToolType);
    },
    [setSelectedTool],
  );

  useEffect(() => {
    const index = visibleItems.findIndex(
      (item) => item.tooltip === selectedTool,
    );
    setSelected(index);

    if (index === -1 && !canDraw) {
      setSelectedTool("Hand");
    }
  }, [selectedTool, visibleItems, canDraw, setSelectedTool]);

  return (
    <Menubar
      className={cn(
        "border bg-background/90 text-foreground backdrop-blur-sm shadow-sm gap-1 items-center",
        orientation === "vertical"
          ? "h-auto w-11 flex-col px-1 py-1"
          : "h-11 flex-row px-1",
      )}
    >
      {visibleItems.map((item, index) => {
        const isActive = selected === index;
        // const showDivider = index > 0 && !!item.before;
        return (
          <div key={item.tooltip} className="flex items-center">
            {/* {showDivider && (
              <div className="w-px h-5 bg-border/40 mx-1" aria-hidden />
            )} */}
            <div
              className={cn(
                "rounded-lg transition-all duration-100",
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                isActive &&
                  "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300",
              )}
            >
              <CMenubtn
                state={isActive}
                compoBefore={item.before}
                compoAfter={item.after}
                onClick={() => handleSelect(item)}
                shortcut={item.shortcut}
              />
            </div>
          </div>
        );
      })}
    </Menubar>
  );
});
