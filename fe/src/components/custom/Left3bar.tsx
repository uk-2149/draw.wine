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
import { useCollab } from "@/contexts/CollabContext";
import { CreateRoomModal } from "../modals/CreateRoomModal";

export const Left3bar = () => {
  const [ showCreateRoom, setShowCreateRoom ] = useState(false);
  const { state, dispatch } = useCollab();

  const gotoGithub = () => {
    const url = "https://github.com/pandarudra/draw.wine";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleTeamClick = () => {
    setShowCreateRoom(true);
  }

  const handleRoomCreated = (room: any, user: any, isCreator: boolean) => {
    console.log("Room created:", room, "User:", user, isCreator);
    dispatch({
      type: 'START_COLLABORATION',
      payload: { room, user, isCreator }
    })
  }

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
          <DropdownMenuItem>
            <MdSaveAlt className="mr-2" />
            Save to...
            <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <MdOutlineImage className="mr-2" />
            Export image...
            <DropdownMenuShortcut>Ctrl+Shift+E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LuBadgeHelp className="mr-2" />
            Help
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <RiResetLeftFill className="mr-2" />
            Reset the canvas
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleTeamClick}>Team</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Invite users</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Email</DropdownMenuItem>
                <DropdownMenuItem>Message</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>More...</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuItem>
            New Team
            <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={gotoGithub}>GitHub</DropdownMenuItem>
        <DropdownMenuItem>Support</DropdownMenuItem>
        <DropdownMenuItem disabled>API</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Log out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <CreateRoomModal
      isOpen={showCreateRoom}
      onClose={() => setShowCreateRoom(false)}
      onRoomCreated={handleRoomCreated}
    />
    </>
  );
};
