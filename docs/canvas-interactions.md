# Canvas Interactions

## Pan & Zoom

### Panning
- **Middle mouse button** drag
- **Alt + left click** drag
- **Hand tool** (`H`) + left click drag
- **Tab + mouse** movement (alternative pan mode)

### Zooming
- **Mouse wheel** (Ctrl + scroll): Zoom in/out centered on viewport center
- **Zoom buttons**: `+` / `-` in the bottom toolbar
- **Zoom range**: 10% – 500%
- **Pinch zoom**: Supported via wheel events

The canvas uses a transformation matrix: `ctx.translate(position.x, position.y)` + `ctx.scale(scale, scale)`. All mouse coordinates are inverse-transformed via `getTransformedPoint()` to convert screen space → canvas space.

## Element Selection

### Single Selection
1. Click on an element with the **Select** tool
2. Element is highlighted with a dashed blue border
3. Resize handles appear at corners (shapes) or endpoints (lines/arrows)
4. PropertiesPanel syncs to show the element's current style

### Multi-Selection
- **Shift + click**: Add/toggle elements in the selection
- **Area selection**: Click and drag on empty space to create a rubber-band selection rectangle; all enclosed elements are selected

### Hit Testing (`getElementAtPoint`)
Elements are tested back-to-front (last drawn = highest priority):

| Element Type | Hit Test Method |
|-------------|-----------------|
| Rectangle, Diamond, Circle | Bounding box containment |
| Line, Arrow | Point-to-segment distance < 10px |
| Pencil | Any point within 10px tolerance |
| Text | Bounding box from text metrics |
| Image | Bounding box containment |

## Dragging

### Single Element Drag
1. Click on a selected element
2. `dragOffset` = click position – element origin
3. On each mousemove: `element.x = mousePos.x - dragOffset.x`

### Multi-Element Drag
1. Click on any element within the multi-selection
2. `dragOffset` captured relative to the clicked element
3. On each mousemove, a **movement delta** is computed from the first selected element's position
4. Delta is applied to **all** selected elements, preserving their relative positions
5. Pencil strokes: all points are translated by the same delta

## Resizing

Available for single-selected shapes (Rectangle, Diamond, Circle, Image) and line endpoints.

### Shape Resize Handles
Four corner handles: `tl` (top-left), `tr`, `br`, `bl`. Dragging a handle adjusts `width` and `height` accordingly:

- `br` corner: directly changes width/height
- `bl` corner: adjusts x and width
- `tr` corner: adjusts y and height
- `tl` corner: adjusts x, y, width, and height

### Line/Arrow Endpoint Handles
Two handles: `start` and `end`. Dragging repositions the corresponding endpoint.

## Text Editing

1. Select **Text** tool and click on canvas
2. A text element is created with placeholder "Type here..."
3. A `<textarea>` overlay appears at the element's position
4. Type to edit; the overlay auto-resizes
5. Click outside or press Escape to finalize
6. Empty text elements are automatically deleted

## Eraser

- Select **Eraser** tool
- Elements within `ERASER_RADIUS` (10px) of the cursor are removed
- A translucent circle indicates the erase area
- Works on mousedown and continuous mousemove while held

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save (trigger save callback) |
| `Ctrl + Shift + E` | Export drawing |
| `Ctrl + O` | Import drawing |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo |
| `Delete` / `Backspace` | Delete selected elements |
| Tool shortcuts | Each tool has a single-key shortcut shown in the toolbar |

## Undo / Redo

- History is stored as snapshots of the full element array (max 50 entries)
- **Begin**: Snapshot taken before a mutating action starts
- **Mutate**: Flag set when actual changes occur
- **Commit**: If mutations happened, the snapshot is pushed to the undo stack
- Undo/redo is disabled during collaboration to avoid conflicts

## Viewport Culling

Images are only loaded and drawn when they fall within the visible viewport (`isElementInViewport`). This prevents unnecessary network requests and rendering for off-screen images.

## Auto-Save

In local (non-collaborative) mode, elements are saved to `localStorage` every `AUTO_SAVE_INTERVAL` milliseconds. On page load, saved elements are restored automatically.
