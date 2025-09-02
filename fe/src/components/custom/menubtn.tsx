import { type FC } from "react";
import { MenubarMenu, MenubarTrigger } from "../ui/menubar";

interface IMenubtn {
  state: boolean;
  compoBefore: FC;
  compoAfter: FC;
  onClick: () => void;
}

export const CMenubtn = ({
  state,
  compoBefore: BeforeComponent,
  compoAfter: AfterComponent,
  onClick,
}: IMenubtn) => {
  return (
    <MenubarMenu>
      <MenubarTrigger
        onClick={onClick}
        className={`w-10 h-10 flex justify-center items-center hover:bg-[#E3E2FE] ${
          state ? "bg-[#E3E2FE]" : ""
        }`}
      >
        {state ? <AfterComponent /> : <BeforeComponent />}
      </MenubarTrigger>
    </MenubarMenu>
  );
};
