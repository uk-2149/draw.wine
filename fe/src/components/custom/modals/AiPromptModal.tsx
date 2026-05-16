import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Textarea } from "../../ui/textarea";
import { useAi } from "@/contexts/ai/useAi";
import { generateAiDrawing } from "@/helpers/aiApi";
import { insertAiElementsIntoCanvas } from "@/helpers/aiInsertion.h";
import { toast } from "sonner";
import { Sparkles, Loader2, Zap } from "lucide-react";
import type { AiMode } from "@/contexts/ai/types";

interface AiPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_PROMPTS = [
  "Flowchart for User Login & Authentication",
  "Cloud Architecture Layout with servers and database",
  "Mindmap of Web App Features with nodes and arrows",
];

export const AiPromptModal = ({ isOpen, onClose }: AiPromptModalProps) => {
  const {
    mode,
    setMode,
    prompt,
    startRequest,
    finishRequest,
    failRequest,
    state,
  } = useAi();
  const [localPrompt, setLocalPrompt] = useState(prompt);

  // Sync local state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setLocalPrompt(prompt);
    }
  }, [isOpen, prompt]);

  const handlePromptClick = (sample: string) => {
    setLocalPrompt(sample);
  };

  const handleGenerate = useCallback(async () => {
    if (!localPrompt || !localPrompt.trim()) {
      toast.error("Please enter a description for your drawing");
      return;
    }

    startRequest(localPrompt, mode);
    toast.info("Generating AI drawing layout...");

    try {
      const response = await generateAiDrawing(localPrompt.trim(), mode);

      if (!response || !response.elements || response.elements.length === 0) {
        throw new Error("Received empty canvas structure from model");
      }

      insertAiElementsIntoCanvas(response.elements);
      finishRequest(response);
      toast.success(
        `Successfully added ${response.elements.length} elements to your board!`,
      );
      onClose();
    } catch (error: unknown) {
      console.error("AI Generation failed:", error);
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to generate layout via Gemini AI.";
      failRequest(msg);
      toast.error(msg);
    }
  }, [localPrompt, mode, startRequest, finishRequest, failRequest, onClose]);

  const isLoading = state === "loading";

  return (
    <Dialog open={isOpen} onOpenChange={isLoading ? () => {} : onClose}>
      <DialogContent className="sm:max-w-[520px] border-border bg-card text-card-foreground shadow-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              Generate Canvas with AI
            </DialogTitle>
          </div>
          <DialogDescription className="pt-1">
            Transform natural language descriptions into interactive layout
            designs instantly. Fully local insertion.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {/* Output Mode Selection */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              Output Style
            </Label>
            <RadioGroup
              value={mode}
              onValueChange={(val) => setMode(val as AiMode)}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="mode-vector"
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  mode === "vector"
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">Vector Elements</span>
                  <RadioGroupItem
                    value="vector"
                    id="mode-vector"
                    className="sr-only"
                  />
                  <Zap className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground font-normal">
                  Fully editable individual shapes, text, and connector lines.
                </span>
              </Label>

              <Label
                htmlFor="mode-raster"
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  mode === "raster"
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-medium">Detailed SVG / Image</span>
                  <RadioGroupItem
                    value="raster"
                    id="mode-raster"
                    className="sr-only"
                  />
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs text-muted-foreground font-normal">
                  Rendered graphic artwork embedded cleanly as a single
                  resizable layer.
                </span>
              </Label>
            </RadioGroup>
          </div>

          {/* Prompt input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label
                htmlFor="ai-prompt"
                className="font-semibold text-xs uppercase tracking-wider text-muted-foreground"
              >
                Description Prompt
              </Label>
              <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-mono">
                ⚡ Gemini Flash
              </span>
            </div>
            <Textarea
              id="ai-prompt"
              rows={4}
              placeholder="E.g., Draw a multi-tier database layout with load balancer at top, linking to web nodes and primary replicas below."
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              className="resize-none focus-visible:ring-primary/50 text-sm placeholder:text-muted-foreground/50"
              disabled={isLoading}
            />
          </div>

          {/* Suggested options */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Inspiration shortcuts:
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePromptClick(sample)}
                  disabled={isLoading}
                  className="text-left text-xs bg-muted hover:bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md transition-colors truncate max-w-[480px]"
                >
                  <Sparkles className="w-3 h-3 inline-block mr-1 text-primary" />

                  {sample}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading || !localPrompt.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Canvas...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Create Layout
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
