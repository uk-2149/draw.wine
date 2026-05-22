import {
  useState,
  useEffect,
  useCallback,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { ScrollArea } from "../../ui/scroll-area";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface IconModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (svgString: string) => void;
}

const ICON_DRAG_MIME = "application/x-draw-wine-icon";

export const IconModal = ({ isOpen, onClose, onSelectIcon }: IconModalProps) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("home");
  const [icons, setIcons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim() || "home"); // default to 'home' if empty
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch icons from Iconify API
  useEffect(() => {
    if (!isOpen) return;
    
    let active = true;
    setLoading(true);

    fetch(`https://api.iconify.design/search?query=${encodeURIComponent(debouncedSearch)}&limit=100`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setIcons(data.icons || []);
      })
      .catch((err) => {
        console.error("Failed to fetch icons:", err);
        if (active) setIcons([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, isOpen]);

  const handleSelect = useCallback(async (iconId: string) => {
    try {
      setSelecting(iconId);
      const res = await fetch(`https://api.iconify.design/${iconId}.svg`);
      if (!res.ok) throw new Error("Failed to fetch SVG");
      const svgText = await res.text();
      onSelectIcon(svgText);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to load icon");
    } finally {
      setSelecting(null);
    }
  }, [onSelectIcon, onClose]);

  const handleDragStart = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>, iconId: string) => {
      event.dataTransfer.setData(ICON_DRAG_MIME, iconId);
      event.dataTransfer.setData("text/plain", iconId);
      event.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] h-[75vh] flex flex-col border-border bg-card text-card-foreground shadow-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Add Icon
          </DialogTitle>
          <DialogDescription>
            Search and select an icon to add to the canvas. Powered by Iconify.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search icons (e.g., user, database, react)..."
            className="pl-9 w-full bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 min-h-0 relative mt-4">
          <ScrollArea className="h-full pr-4">
            {loading && icons.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 pb-4">
                {icons.map((iconId) => (
                  <button
                    key={iconId}
                    type="button"
                    draggable
                    onDragStart={(event) => handleDragStart(event, iconId)}
                    onClick={() => handleSelect(iconId)}
                    disabled={selecting !== null}
                    className="flex flex-col items-center justify-center aspect-square rounded-xl border border-border bg-background hover:bg-primary/10 hover:border-primary/50 transition-colors group relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing"
                    title={iconId}
                  >
                    {selecting === iconId ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <img
                        src={`https://api.iconify.design/${iconId}.svg`}
                        alt={iconId}
                        className="w-6 h-6 text-muted-foreground group-hover:opacity-80 transition-opacity dark:invert"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {!loading && icons.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                No icons found for "{debouncedSearch}"
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
