import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAi } from "@/contexts/ai/useAi";
import type { AiMode, AiModel } from "@/contexts/ai/types";
import { generateAiChat, generateAiDrawing } from "@/helpers/aiApi";
import { insertAiElementsIntoCanvas } from "@/helpers/aiInsertion.h";
import { cn } from "@/helpers/cn.h";
import { Loader2, Sparkles, X, Zap } from "lucide-react";

interface AiChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status?: "loading" | "success" | "error" | "info";
};

const SAMPLE_PROMPTS = [
  "Flowchart for User Login and Authentication",
  "Cloud architecture layout with servers and database",
  "Mind map of web app features with nodes and arrows",
];

const MODEL_OPTIONS: Array<{ value: AiModel; label: string }> = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

const DRAWING_KEYWORDS = [
  "draw",
  "diagram",
  "flow",
  "flowchart",
  "chart",
  "layout",
  "wireframe",
  "mind map",
  "mindmap",
  "architecture",
  "process",
  "sequence",
  "timeline",
  "board",
  "canvas",
  "design",
  "sketch",
  "illustration",
  "create",
];

const isLikelyDrawingPrompt = (prompt: string) => {
  const lower = prompt.toLowerCase();
  return DRAWING_KEYWORDS.some((keyword) => lower.includes(keyword));
};

export const AiChatSidebar = ({ isOpen, onClose }: AiChatSidebarProps) => {
  const {
    mode,
    setMode,
    model,
    setModel,
    startRequest,
    finishRequest,
    failRequest,
    state,
  } = useAi();
  const [localPrompt, setLocalPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Describe what you want to draw and I will add it to the canvas.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLoading = state === "loading";
  const currentModel = model ?? MODEL_OPTIONS[0].value;

  useEffect(() => {
    if (!isOpen) return;
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen]);

  const updateMessage = useCallback(
    (id: string, next: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === id ? { ...message, ...next } : message,
        ),
      );
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const trimmed = localPrompt.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const assistantId = `assistant-${Date.now()}`;

    const isDrawingPrompt = isLikelyDrawingPrompt(trimmed);
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: isDrawingPrompt ? "Generating layout..." : "Thinking...",
      status: "loading",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setLocalPrompt("");

    startRequest(trimmed, mode);

    try {
      if (isDrawingPrompt) {
        const response = await generateAiDrawing(trimmed, mode, currentModel);

        if (!response || !response.elements || response.elements.length === 0) {
          finishRequest(response || { elements: [] });
          updateMessage(assistantId, {
            content:
              "I couldn't turn that into shapes yet. Try a more detailed drawing prompt (e.g., 'flowchart for user login with 4 steps').",
            status: "info",
          });
          return;
        }

        insertAiElementsIntoCanvas(response.elements);
        finishRequest(response);

        updateMessage(assistantId, {
          content: `Added ${response.elements.length} elements to the canvas.`,
          status: "success",
        });
        return;
      }

      const chatResponse = await generateAiChat(trimmed, currentModel);
      finishRequest(null);
      updateMessage(assistantId, {
        content:
          chatResponse.message ||
          "Tell me what you want to draw and I will add it to the canvas.",
        status: "success",
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : isDrawingPrompt
            ? "Failed to generate layout via Gemini AI."
            : "Failed to generate response via Gemini AI.";
      failRequest(msg);
      updateMessage(assistantId, { content: msg, status: "error" });
    }
  }, [
    localPrompt,
    isLoading,
    mode,
    currentModel,
    startRequest,
    finishRequest,
    failRequest,
    updateMessage,
  ]);

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    event.stopPropagation();
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <aside
      className={cn(
        "fixed top-0 right-0 z-50 flex h-full w-[360px] flex-col border-l bg-background/95 backdrop-blur-md shadow-2xl transition-transform duration-200",
        isOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
      )}
      aria-hidden={!isOpen}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-primary/10 p-1.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Chat</h3>
            <p className="text-xs text-muted-foreground">
              Describe a layout to add it to the board.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          aria-label="Close AI chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b px-4 py-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Output Style
        </Label>
        <RadioGroup
          value={mode}
          onValueChange={(val) => setMode(val as AiMode)}
          className="mt-2 grid grid-cols-2 gap-2"
        >
          <Label
            htmlFor="ai-mode-vector"
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs font-medium transition-colors",
              mode === "vector"
                ? "border-primary/50 bg-primary/5 text-foreground"
                : "border-border hover:border-primary/40",
            )}
          >
            <span>Vector</span>
            <RadioGroupItem
              value="vector"
              id="ai-mode-vector"
              className="sr-only"
            />
            <Zap className="h-3.5 w-3.5 text-primary" />
          </Label>
          <Label
            htmlFor="ai-mode-raster"
            className={cn(
              "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs font-medium transition-colors",
              mode === "raster"
                ? "border-primary/50 bg-primary/5 text-foreground"
                : "border-border hover:border-primary/40",
            )}
          >
            <span>SVG Image</span>
            <RadioGroupItem
              value="raster"
              id="ai-mode-raster"
              className="sr-only"
            />
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </Label>
        </RadioGroup>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 pb-6">
        <div className="min-h-full flex flex-col justify-end gap-3">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isError = message.status === "error";
            const isInfo = message.status === "info";
            return (
              <div
                key={message.id}
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                    isError
                      ? "border border-destructive/40 bg-destructive/10 text-destructive"
                      : isInfo
                        ? "border border-border/80 bg-card text-muted-foreground"
                        : "border border-transparent",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {message.status === "loading" && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    <span>{message.content}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {messages.length <= 1 && (
            <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Try a quick prompt</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SAMPLE_PROMPTS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setLocalPrompt(sample)}
                    className="rounded-md border bg-background px-2 py-1 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <Label
          htmlFor="ai-chat-input"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Prompt
        </Label>
        <Textarea
          id="ai-chat-input"
          rows={3}
          placeholder="Describe the layout you want to draw..."
          value={localPrompt}
          onChange={(event) => setLocalPrompt(event.target.value)}
          onKeyDownCapture={(event) => event.stopPropagation()}
          onKeyDown={handleInputKeyDown}
          disabled={isLoading}
          className="mt-2 resize-none"
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label className="sr-only" htmlFor="ai-model-select">
              Model
            </Label>
            <Select
              value={currentModel}
              onValueChange={(value) => setModel(value as AiModel)}
            >
              <SelectTrigger
                id="ai-model-select"
                size="sm"
                className="w-[180px]"
              >
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSend}
            disabled={isLoading || !localPrompt.trim()}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Working
              </>
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
};
