import { TOOLBAR_ITEMS } from "@/constants/toolbar";
import { Menubar } from "../ui/menubar";
import { CMenubtn } from "./menubtn";
import { memo, useCallback, useState } from "react";
import { useDrawing, type ToolType } from "@/contexts/DrawingContext";

export const Toolbar = memo(() => {
  const { selectedTool, setSelectedTool } = useDrawing();
  const [selected, setSelected] = useState<number | null>(0);

  const handleSelect = useCallback(
    (index: number) => {
      setSelected((prev) => (prev === index ? null : index));
      const toolType = TOOLBAR_ITEMS[index]?.tooltip || "select";
      setSelectedTool(toolType as ToolType);
    },
    [setSelectedTool]
  );

  return (
    <Menubar className="w-full border-b h-12">
      {TOOLBAR_ITEMS.map((item, index) => (
        <CMenubtn
          key={index}
          state={selected === index}
          compoBefore={item.before}
          compoAfter={item.after}
          onClick={() => handleSelect(index)}
        />
      ))}
    </Menubar>
  );
});
