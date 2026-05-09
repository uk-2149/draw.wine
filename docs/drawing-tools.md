# Drawing Tools

## Available Tools

| Tool | Type Key | Description |
|------|----------|-------------|
| Select | `select` | Click to select, drag to move, area-select multiple elements |
| Rectangle | `Rectangle` | Draw rectangles / squares |
| Diamond | `Diamond` | Draw diamond / rhombus shapes |
| Circle | `Circle` | Draw ellipses / circles |
| Arrow | `Arrow` | Draw arrows with arrowheads |
| Line | `Line` | Draw straight lines |
| Pencil | `Pencil` | Freehand drawing with smooth quadratic Bézier curves |
| Text | `Text` | Click to place editable text |
| Image | `Image` | Upload and place images on canvas |
| Eraser | `Eraser` | Remove elements by proximity |
| Laser | `Laser` | Temporary laser pointer trail (useful in presentations) |
| Hand | `Hand` | Pan the canvas without drawing |

## Element Properties

Every drawn element is stored as an `Element` object:

```typescript
interface Element {
  id: string;            // Unique identifier
  type: string;          // Tool type that created it
  x: number;             // Origin X
  y: number;             // Origin Y
  width?: number;        // For shapes, lines, arrows
  height?: number;
  points?: Position[];   // For Pencil strokes
  strokeColor: string;   // Stroke/outline color
  fillColor?: string;    // Fill color (Rectangle, Diamond, Circle only)
  strokeWidth: number;   // Line thickness (1, 3, or 5)
  strokePattern?: StrokePattern; // solid | longDash | shortDash | dotted | bubbled
  roughness?: number;    // roughjs hand-drawn roughness
  seed?: number;         // roughjs random seed for consistent rendering
  text?: string;         // For Text elements
  fontSize?: number;
  fontFamily?: string;
  imageUrl?: string;     // For Image elements
  aspectRatio?: number;
  authorId?: string;     // Who created it (for collaboration)
  isTemporary?: boolean; // Element still being drawn
}
```

## Stroke Styles

Configurable via the **PropertiesPanel** on the left sidebar.

### Stroke Colors
10 curated pastel colors defined in `constants/ext.ts`:
`#495057`, `#ff8787`, `#8ce99a`, `#74c0fc`, `#ffd43b`, `#e599f7`, `#63e6be`, `#ced4da`, `#ffa94d`, `#66d9e8`

### Stroke Widths
Three options: **1px** (thin), **3px** (medium), **5px** (thick). Default: **1px**.

### Stroke Patterns
Defined in `helpers/stroke.h.ts`:

| Pattern | Description | Dash array formula |
|---------|-------------|--------------------|
| `solid` | Continuous line | None |
| `longDash` | Long dashes | `[width × 5, width × 3]` |
| `shortDash` | Short dashes | `[width × 2.5, width × 2]` |
| `dotted` | Dots | `[width × 0.6, width × 2.4]` |
| `bubbled` | Bubble chain | Custom circle rendering along path |

### Fill Colors
Available for Rectangle, Diamond, and Circle. Same 10 colors as stroke, rendered at 50% opacity (`+ "80"` hex suffix).

## Rendering Pipeline

1. **Canvas clear** → full rect clear
2. **Transform** → apply pan (`position.x/y`) and zoom (`scale`)
3. **roughjs canvas** → created per frame for hand-drawn rendering
4. **Theme-aware colors** → black ↔ white swap based on dark mode
5. **Element loop** → each element drawn by type:
   - Shapes (Rectangle, Diamond, Circle): `rc.rectangle()`, `rc.polygon()`, `rc.ellipse()`
   - Lines/Arrows: `rc.line()` with arrowhead geometry
   - Pencil: native Canvas quadratic Bézier curves
   - Text: `ctx.fillText()`
   - Image: `ctx.drawImage()` with lazy loading via `ImageLoader`
   - Bubbled pattern: custom `drawBubbledPolyline()` renders circles along path
6. **Selection UI** → dashed blue border + resize handles
7. **Eraser cursor** → translucent circle at pointer
8. **Laser trails** → fading polyline effect

## Selection & Multi-Select

- **Single click** → select one element, sync its properties to PropertiesPanel
- **Shift+click** → add to multi-selection
- **Area drag** → rubber-band select all elements within the box
- **Multi-drag** → all selected elements move together maintaining relative positions
- **Property changes** → applied to all selected elements simultaneously
- **Resize handles** → available for single selected shapes (corners: tl, tr, br, bl)
