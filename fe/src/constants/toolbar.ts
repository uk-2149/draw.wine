import { BiPointer, BiSolidPointer } from "react-icons/bi";
import {
  TbRectangle,
  TbRectangleFilled,
  TbSquareRotated,
  TbSquareRotatedFilled,
} from "react-icons/tb";
import { FaRegCircle, FaCircle, FaArrowRightLong } from "react-icons/fa6";
import { MdOutlineHorizontalRule, MdFormatColorText } from "react-icons/md";
import { LuPencil, LuHand } from "react-icons/lu";
import { CiImageOn, CiEraser } from "react-icons/ci";
import { ImMagicWand } from "react-icons/im";

export const TEXT_FONT_FAMILIES = [
  { label: "Virgil (Hand)", value: "Virgil" },
  { label: "Tosh", value: "Tosh" },
  { label: "Caveat", value: "Caveat" },
  { label: "Comic Neue", value: "Comic Neue" },
  { label: "Cascadia Code", value: "Cascadia Code" },
] as const;

export const TOOLBAR_ITEMS = [
  { before: LuHand, after: LuHand, tooltip: "Hand", shortcut: "Space" },
  {
    before: BiPointer,
    after: BiSolidPointer,
    tooltip: "select",
    shortcut: "S",
  },
  {
    before: TbRectangle,
    after: TbRectangleFilled,
    tooltip: "Rectangle",
    shortcut: "R",
  },
  {
    before: TbSquareRotated,
    after: TbSquareRotatedFilled,
    tooltip: "Diamond",
    shortcut: "D",
  },
  { before: FaRegCircle, after: FaCircle, tooltip: "Circle", shortcut: "C" },
  {
    before: FaArrowRightLong,
    after: FaArrowRightLong,
    tooltip: "Arrow",
    shortcut: "A",
  },
  {
    before: MdOutlineHorizontalRule,
    after: MdOutlineHorizontalRule,
    tooltip: "Line",
    shortcut: "L",
  },
  { before: LuPencil, after: LuPencil, tooltip: "Pencil", shortcut: "P" },
  {
    before: MdFormatColorText,
    after: MdFormatColorText,
    tooltip: "Text",
    shortcut: "T",
  },
  { before: CiImageOn, after: CiImageOn, tooltip: "Image", shortcut: "I" },
  { before: CiEraser, after: CiEraser, tooltip: "Eraser", shortcut: "E" },
  { before: ImMagicWand, after: ImMagicWand, tooltip: "Laser", shortcut: "Q" },
];
