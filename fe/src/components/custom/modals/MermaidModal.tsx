import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseMermaidToElements } from "@/helpers/mermaidParser.h";
import { insertAiElementsIntoCanvas } from "@/helpers/aiInsertion.h";
import { toast } from "sonner";

interface MermaidModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MermaidModal = ({ isOpen, onClose }: MermaidModalProps) => {
  const [mermaidCode, setMermaidCode] = useState("");

  const handleInsert = () => {
    if (!mermaidCode.trim()) {
      toast.error("Please enter some Mermaid code");
      return;
    }

    try {
      const elements = parseMermaidToElements(mermaidCode);
      if (elements.length > 0) {
        insertAiElementsIntoCanvas(elements);
        toast.success(`Inserted ${elements.length} elements from Mermaid code`);
        setMermaidCode("");
        onClose();
      } else {
        toast.error("Could not parse any shapes from the Mermaid syntax.");
      }
    } catch (err: unknown) {
      toast.error(
        `Failed to parse Mermaid diagram: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Mermaid Diagram</DialogTitle>
          <DialogDescription>
            Paste your Mermaid syntax below. We currently support basic flowcharts and graphs.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            value={mermaidCode}
            onChange={(e) => setMermaidCode(e.target.value)}
            placeholder="graph TD&#10;  A[Start] --> B{Decision}&#10;  B -- Yes --> C[Process]&#10;  B -- No --> D[End]"
            className="font-mono min-h-[200px]"
            onKeyDownCapture={(e) => e.stopPropagation()}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert}>Insert Diagram</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
