import { TOOLBAR_ITEMS } from "@/constants/toolbar";
import { Menubar } from "../../ui/menubar";
import { CMenubtn } from "./menubtn";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useDrawing } from "@/contexts/drawing/useDrawing";
import type { ToolType } from "@/types/drawing";
import { useCollab } from "@/contexts/collab/useCollab";
import { cn } from "@/helpers/cn.h";

export const Toolbar = memo(() => {
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
    <Menubar className="flex-row w-full h-11 border-b bg-white/90 dark:bg-background/90 backdrop-blur-sm shadow-sm px-1 gap-1 items-center">
      {visibleItems.map((item, index) => {
        const isActive = selected === index;
        // const showDivider = index > 0 && !!item.before;
        return (
          <div key={item.tooltip} className="flex flex-row items-center h-full">
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