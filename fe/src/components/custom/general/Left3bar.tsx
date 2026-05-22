import { Button } from "../../ui/button";
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
} from "../../ui/dropdown-menu";
import {
  MdSaveAlt,
  MdOutlineImage,
  MdOutlineFileUpload,
  MdOutlineColorLens,
} from "react-icons/md";
import { RiResetLeftFill } from "react-icons/ri";
import { IoWalletOutline } from "react-icons/io5";
import {
  IoCopyOutline,
  IoSwapHorizontalOutline,
  IoLogOutOutline,
} from "react-icons/io5";
import { useState, useCallback } from "react";
import { CreateRoomModal } from "../modals/CreateRoomModal";
import { JoinRoomModal } from "../modals/JoinRoomModal";
import { ExportModal } from "../modals/ExportModal";
import { EmailInviteModal } from "../modals/EmailInviteModal";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { STORAGE_KEY } from "@/constants/canvas";
import {
  exportCanvasAsImage,
  saveCanvasAsJSON,
  loadCanvasFromJSON,
  type ExportOptions,
} from "@/helpers/export.h";
import {
  getCanvasElement,
  getCanvasElements,
  getCanvasViewport,
  setCanvasElements,
} from "@/helpers/canvasState.h";
import { useCollab } from "@/contexts/collab/useCollab";
import { toast } from "sonner";
import { cn } from "@/helpers/cn.h";
import { useTheme } from "@/contexts/theme/useTheme";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWalletAuth } from "@/hooks/useWalletAuth";

interface Left3barProps {
  bgColor: string;
  setBgColor: (c: string) => void;
  bgOpacity: number;
  setBgOpacity: (o: number) => void;
  bgPattern: "none" | "dots" | "grid" | "lines";
  setBgPattern: (p: "none" | "dots" | "grid" | "lines") => void;
}

export const Left3bar = ({
  bgColor,
  setBgColor,
  bgOpacity,
  setBgOpacity,
  bgPattern,
  setBgPattern,
}: Left3barProps) => {
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEmailInvite, setShowEmailInvite] = useState(false);

  // Wallet auth
  useWalletAuth();

  // Wallet state
  const { publicKey, wallet, connected, disconnect } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const truncatedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}..${publicKey.toBase58().slice(-4)}`
    : null;

  const handleCopyAddress = useCallback(() => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      toast.success("Address copied to clipboard");
    }
  }, [publicKey]);

  const handleChangeWallet = useCallback(() => {
    setWalletModalVisible(true);
  }, [setWalletModalVisible]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // Get collaboration context for room information
  const { state, isUserInCurrentRoom, leaveRoom } = useCollab();

  // Check if user is in a room to enable/disable invite functionality
  const isInRoom =
    state.isCollaborating && state.roomId && isUserInCurrentRoom();

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
    if (!isInRoom) {
      toast.error("You need to be in a room to invite users");
      return;
    }
    setShowEmailInvite(true);
  };

  const { theme } = useTheme();
  const isDarkTheme =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Mirror CanvasBoard's invertHexColor logic for bg
  const displayBgColor = (color: string) => {
    if (isDarkTheme && (color === "#000000" || color === "#000"))
      return "#ffffff";
    if (!isDarkTheme && (color === "#ffffff" || color === "#fff"))
      return "#000000";
    // For non-pure-black/white, CanvasBoard fully inverts in dark mode
    if (isDarkTheme) {
      const hex = color.replace("#", "");
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return color;
      const channels = hex.match(/.{2}/g);
      if (!channels) return color;
      return (
        "#" +
        channels
          .map((ch) => (255 - parseInt(ch, 16)).toString(16).padStart(2, "0"))
          .join("")
      );
    }
    return color;
  };

  // When user picks a swatch, store the inverse so canvas renders it correctly
  const setBgColorThemed = (color: string) => {
    if (!isDarkTheme) {
      setBgColor(color);
      return;
    }
    const hex = color.replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
      setBgColor(color);
      return;
    }
    const channels = hex.match(/.{2}/g);
    if (!channels) {
      setBgColor(color);
      return;
    }
    const inverted =
      "#" +
      channels
        .map((ch) => (255 - parseInt(ch, 16)).toString(16).padStart(2, "0"))
        .join("");
    setBgColor(inverted);
  };

  const displayedBgColor = displayBgColor(bgColor);

  const handleLeaveRoomClick = () => {
    console.log("Leaving room:", state.roomId);
    console.log("Current state:", {
      isCollaborating: state.isCollaborating,
      roomId: state.roomId,
      hasSocket: !!state.socket,
    });

    if (!state.socket || !state.roomId) {
      toast.error("Cannot leave room: not properly connected");
      return;
    }

    // Set up event listeners for room leave responses
    const handleSuccess = () => {
      toast.success("Left the room successfully");
      window.removeEventListener("room_left_success", handleSuccess);
      window.removeEventListener(
        "room_left_error",
        handleError as EventListener,
      );
    };

    const handleError = (event: Event) => {
      const customEvent = event as CustomEvent;
      toast.error(
        "Failed to leave room: " +
          (customEvent.detail?.error || "Unknown error"),
      );
      window.removeEventListener("room_left_success", handleSuccess);
      window.removeEventListener(
        "room_left_error",
        handleError as EventListener,
      );
    };

    window.addEventListener("room_left_success", handleSuccess);
    window.addEventListener("room_left_error", handleError as EventListener);

    try {
      leaveRoom();
      toast.info("Leaving room...");
      console.log("Leave room called successfully");
    } catch (error) {
      console.error("Error leaving room:", error);
      toast.error("Failed to leave room");
      // Clean up event listeners
      window.removeEventListener("room_left_success", handleSuccess);
      window.removeEventListener(
        "room_left_error",
        handleError as EventListener,
      );
    }

    window.location.href = "/";
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
        options,
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

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MdOutlineColorLens className="mr-2" />
                Canvas background
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="p-3 w-64">
                  {/* Color swatches */}
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    Background color
                  </p>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {[
                      "#f8f5f0",
                      "#e8e8e8",
                      "#dbeafe",
                      "#fefce8",
                      "#fce7f3",
                      "#ffffff",
                      "#1a1a2e",
                      "#0f172a",
                    ].map((c) => (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setBgColorThemed(c);
                        }}
                        className={cn(
                          "w-7 h-7 ...",
                          displayedBgColor === c
                            ? "border-ring ring-2 ring-ring/30"
                            : "border-border hover:border-ring/60",
                        )}
                        style={{
                          backgroundColor: c,
                          transform:
                            displayedBgColor === c ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                    ))}

                    {/* Custom input */}
                    <label
                      className="relative mb-3 flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-sm border-2 border-border/50 hover:border-border/80 transition-all"
                      style={{
                        background:
                          "conic-gradient(from 180deg at 50% 50%, #ff4d4d, #ffcc4d, #7dff7d, #4dd2ff, #7a7aff, #d84dff, #ff4d4d)",
                      }}
                      title="Custom background color"
                      aria-label="Pick custom background color"
                    >
                      <span style={{ backgroundColor: displayedBgColor }} />
                      <input
                        type="color"
                        value={displayedBgColor}
                        onChange={(e) => {
                          setBgColorThemed(e.target.value);
                        }}
                      />
                    </label>
                  </div>
                  {/* Opacity slider */}
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Pattern opacity — {bgOpacity}%
                  </p>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={bgOpacity}
                    className="w-full mb-3 accent-primary"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      setBgOpacity(Number(e.target.value));
                    }}
                  />

                  {/* Pattern picker */}
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    Pattern
                  </p>
                  <div className="grid grid-cols-4 gap-1">
                    {(["none", "dots", "grid", "lines"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBgPattern(p);
                        }}
                        className={cn(
                          "py-1 px-2 text-xs rounded border transition-all",
                          bgPattern === p
                            ? "border-ring bg-accent text-accent-foreground font-semibold"
                            : "border-border bg-transparent text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
                        )}
                      >
                        {p === "none"
                          ? "None"
                          : p === "dots"
                            ? "Dotted"
                            : p === "grid"
                              ? "Grid"
                              : "Lines"}
                      </button>
                    ))}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {/* Room Status Indicator */}
            {isInRoom ? (
              <DropdownMenuItem
                disabled
                className="text-green-700 dark:text-green-400 font-medium"
              >
                ✓ In Room {state.roomId}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled className="text-muted-foreground">
                ○ Not in a room
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />

            {!isInRoom && (
              <>
                <DropdownMenuItem onClick={handleTeamClick}>
                  Create Room
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleJoinRoomClick}>
                  Join Room
                </DropdownMenuItem>
              </>
            )}
            {isInRoom && (
              <DropdownMenuItem
                onClick={handleLeaveRoomClick}
                className="text-destructive focus:text-destructive"
              >
                Leave Room
              </DropdownMenuItem>
            )}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                disabled={!isInRoom}
                className={!isInRoom ? "opacity-50" : ""}
              >
                Invite Users
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={handleEmailInviteClick}
                    disabled={!isInRoom}
                  >
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
          {/* Wallet Connection */}
          <DropdownMenuGroup>
            {connected && publicKey ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <IoWalletOutline className="mr-2" />
                  <span className="flex items-center gap-2">
                    {wallet?.adapter?.icon && (
                      <img
                        src={wallet.adapter.icon}
                        alt={wallet.adapter.name}
                        className="w-4 h-4 rounded-sm"
                      />
                    )}
                    {truncatedAddress}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={handleCopyAddress}>
                      <IoCopyOutline className="mr-2" />
                      Copy address
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleChangeWallet}>
                      <IoSwapHorizontalOutline className="mr-2" />
                      Change wallet
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDisconnect}
                      className="text-destructive focus:text-destructive"
                    >
                      <IoLogOutOutline className="mr-2" />
                      Disconnect
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem onClick={handleChangeWallet}>
                <IoWalletOutline className="mr-2" />
                Connect Wallet
              </DropdownMenuItem>
            )}
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
