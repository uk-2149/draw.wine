import type { IMenubtn } from "@/types/components";

export const CMenubtn = ({
  state,
  compoBefore: BeforeComponent,
  compoAfter: AfterComponent,
  onClick,
  shortcut,
}: IMenubtn) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-10 h-10 flex justify-center items-center relative group rounded-sm outline-hidden flex items-center text-sm font-medium select-none ${
        state ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
      }`}
      title={shortcut ? `${shortcut}` : ""}
    >
      {state ? <AfterComponent /> : <BeforeComponent />}
    </button>
  );
};
