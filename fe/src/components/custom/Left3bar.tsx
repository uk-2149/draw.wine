import { Button } from "../ui/button";
import { RxHamburgerMenu } from "react-icons/rx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { MdSaveAlt } from "react-icons/md";
import { MdOutlineImage } from "react-icons/md";
import { RiResetLeftFill } from "react-icons/ri";
import { LuBadgeHelp } from "react-icons/lu";
import { useState } from "react";
import { CreateRoomModal } from "./modals/CreateRoomModal";
import { JoinRoomModal } from "./modals/JoinRoomModal";
import { STORAGE_KEY } from "@/constants/canvas";
import { set } from "date-fns";

export const Left3bar = () => {
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);

  const gotoGithub = () => {
    const url = "https://github.com/pandarudra/draw.wine";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleTeamClick = () => {
    setShowCreateRoom(true);
  };

  const handleJoinRoomClick = () => {
    setShowJoinRoom(true);
  };

  const handleCanvasReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const onExportImg = () => {
    console.log("Export image");
  };

  const onSave = () => {
    console.log("Save Canvas");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <RxHamburgerMenu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onSave}>
              <MdSaveAlt className="mr-2" />
              Save to...
              <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportImg}>
              <MdOutlineImage className="mr-2" />
              Export image...
              <DropdownMenuShortcut>Ctrl+Shift+E</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={handleCanvasReset}>
              <RiResetLeftFill className="mr-2" />
              Reset the canvas
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleTeamClick}>
              Create Room
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleJoinRoomClick}>
              Join Room
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Invite users</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Email</DropdownMenuItem>
                  <DropdownMenuItem disabled={true}>
                    Message (Coming soon...)
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={gotoGithub}>GitHub</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateRoomModal
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
      />

      <JoinRoomModal
        isOpen={showJoinRoom}
        onClose={() => setShowJoinRoom(false)}
      />
    </>
  );
};
