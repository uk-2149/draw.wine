import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

interface AibuttonProps {
  onClick?: () => void;
}

export const Aibutton = ({ onClick }: AibuttonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={onClick}
          size="icon"
          variant="outline"
          className="relative group border-border bg-background hover:bg-accent/60 transition-colors"
        >
          <Sparkles className="h-4 w-4 text-primary group-hover:scale-110 transition-transform duration-300" />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="center"
        className="bg-popover text-popover-foreground border border-border"
      >
        <p className="font-medium text-xs">Open AI Chat</p>
      </TooltipContent>
    </Tooltip>
  );
};
