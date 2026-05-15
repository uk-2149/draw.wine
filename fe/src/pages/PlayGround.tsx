import { useState } from "react";
import { CanvasBoard } from "@/components/custom/canvas/CanvasBoard";
import { Toolbar } from "@/components/custom/general/Toolbar";
import { DrawingProvider } from "@/contexts/drawing/DrawingContext";
import { ThemeToggle } from "@/components/custom/ThemeToggle";
import { PropertiesPanel } from "@/components/custom/general/PropertiesPanel";
import { Left3bar } from "@/components/custom/general/Left3bar";
import { InstallButton } from "@/components/custom/general/InstallButton";
import { JoinRequestsSidebar } from "@/components/custom/general/JoinRequestsSidebar";
import { HelpButton } from "@/components/custom/general/HelpButton";
import { Aibutton } from "@/components/custom/ai/Aibutton";
import { AiChatSidebar } from "@/components/custom/ai/AiChatSidebar";
import { useGeneral } from "@/contexts/general/useGeneral";

export const PlayGround = () => {
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const { currentStage } = useGeneral();

  return (
    <DrawingProvider>
      <div className="h-screen w-full relative overflow-hidden bg-background text-foreground">
        <div className="absolute top-0 left-0 p-4 z-10">
          <Left3bar />
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 p-4 z-10">
          <Toolbar />
        </div>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3">
          {currentStage === "lobby" && (
            <Aibutton onClick={() => setIsAiSidebarOpen(true)} />
          )}
          <ThemeToggle />
          <JoinRequestsSidebar />
          <InstallButton />
        </div>
        <div className="absolute top-[88px] left-4 z-10">
          <PropertiesPanel />
        </div>
        <CanvasBoard />
        <HelpButton />
        <AiChatSidebar
          isOpen={isAiSidebarOpen}
          onClose={() => setIsAiSidebarOpen(false)}
        />
      </div>
    </DrawingProvider>
  );
};
