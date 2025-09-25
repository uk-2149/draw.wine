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
import { MdSaveAlt, MdOutlineImage, MdOutlineFileUpload } from "react-icons/md";
import { RiResetLeftFill } from "react-icons/ri";
import { useState, useCallback } from "react";
import { CreateRoomModal } from "./modals/CreateRoomModal";
import { JoinRoomModal } from "./modals/JoinRoomModal";
import { ExportModal } from "./modals/ExportModal";
import { EmailInviteModal } from "./modals/EmailInviteModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { STORAGE_KEY } from "@/constants/canvas";
import {
  exportCanvasAsImage,
  saveCanvasAsJSON,
  loadCanvasFromJSON,
  type ExportOptions,
} from "@/utils/export";
import {
  getCanvasElement,
  getCanvasElements,
  getCanvasViewport,
  setCanvasElements,
} from "@/utils/canvasState";
import { useCollab } from "@/contexts/CollabContext";
import { toast } from "sonner";

export const Left3bar = () => {
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEmailInvite, setShowEmailInvite] = useState(false);

  // Get collaboration context for room information
  const { state } = useCollab();

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

  const handleEmailInviteClick = () => {
    setShowEmailInvite(true);
  };

  const handleCanvasReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const onExportImg = useCallback(() => {
    setShowExportModal(true);
  }, []);

  const handleExport = useCallback((options: ExportOptions) => {
    const canvas = getCanvasElement();
    if (!canvas) {
      toast.error("Canvas not available for export");
      return;
    }

    try {
      const elements = getCanvasElements();
      const viewport = getCanvasViewport();

      exportCanvasAsImage(
        { current: canvas },
        elements,
        viewport.position,
        viewport.scale,
        options
      );
      toast.success(`Drawing exported as ${options.format.toUpperCase()}`);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export drawing");
    }
  }, []);

  const onSave = useCallback(() => {
    try {
      const elements = getCanvasElements();
      saveCanvasAsJSON(elements);
      toast.success("Drawing saved successfully");
    } catch (error) {
      console.error("Save failed:", error);
      toast.error("Failed to save drawing");
    }
  }, []);

  const onImport = useCallback(async () => {
    try {
      const importedElements = await loadCanvasFromJSON();
      setCanvasElements(importedElements);
      // Trigger a re-render by dispatching a custom event
      window.dispatchEvent(new CustomEvent("canvas-elements-updated"));
      toast.success(`Loaded ${importedElements.length} elements`);
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Failed to import drawing");
    }
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave,
    onExport: onExportImg,
    onImport,
  });

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
            <DropdownMenuItem onClick={onImport}>
              <MdOutlineFileUpload className="mr-2" />
              Load from...
              <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
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
                  <DropdownMenuItem onClick={handleEmailInviteClick}>
                    Email
                  </DropdownMenuItem>
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

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
      />
      <EmailInviteModal
        isOpen={showEmailInvite}
        onClose={() => setShowEmailInvite(false)}
        roomId={state.roomId || undefined}
        roomName={state.roomId ? `Room ${state.roomId}` : undefined}
      />
    </>
  );
};
