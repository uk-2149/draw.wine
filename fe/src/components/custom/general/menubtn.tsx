import { MenubarMenu, MenubarTrigger } from "../../ui/menubar";
import { useTheme } from "@/contexts/ThemeContext";
import type { IMenubtn } from "@/types/components";

export const CMenubtn = ({
  state,
  compoBefore: BeforeComponent,
  compoAfter: AfterComponent,
  onClick,
  shortcut,
}: IMenubtn) => {
  const { theme } = useTheme();
  return (
    <MenubarMenu>
      <MenubarTrigger
        onClick={onClick}
        className={`w-10 h-10 flex justify-center items-center relative group ${
          state
            ? theme === "light"
              ? "bg-[#E3E2FE] hover:bg-[#E3E2FE]"
              : "bg-[#2D2D2D] hover:bg-[#4A4A4A]"
            : ""
        }`}
        title={shortcut ? `${shortcut}` : ""}
      >
        {state ? <AfterComponent /> : <BeforeComponent />}
        {shortcut && (
          <span className="absolute bottom-0.5 right-0.5 flex items-center justify-center w-4 h-4 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold rounded-full opacity-80 group-hover:opacity-100 transition-opacity">
            {shortcut.charAt(0)}
          </span>
        )}
      </MenubarTrigger>
    </MenubarMenu>
  );
};
