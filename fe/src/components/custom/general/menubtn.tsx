import { MenubarMenu, MenubarTrigger } from "../../ui/menubar";
import type { IMenubtn } from "@/types/components";

export const CMenubtn = ({
  state,
  compoBefore: BeforeComponent,
  compoAfter: AfterComponent,
  onClick,
  shortcut,
}: IMenubtn) => {
  return (
    <MenubarMenu>
      <MenubarTrigger
        onClick={onClick}
        className={`w-10 h-10 flex justify-center items-center relative group ${
          state ? "bg-accent text-accent-foreground" : ""
        }`}
        title={shortcut ? `${shortcut}` : ""}
      >
        {state ? <AfterComponent /> : <BeforeComponent />}
      </MenubarTrigger>
    </MenubarMenu>
  );
};
