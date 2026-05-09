# Export & Import

## Export Formats

### PNG / JPG (Raster)

- A temporary off-screen canvas is created
- All elements are redrawn at the export scale with padding (50px)
- Minimum canvas size: 800×600
- Optional background color fill
- JPG supports quality setting (default: 0.9)
- File is downloaded as `drawing-{timestamp}.{format}`

### SVG (Vector)

- Elements are converted to SVG markup via `elementToSVG()`
- Supported elements: Rectangle (`<rect>`), Diamond (`<polygon>`), Circle (`<ellipse>`), Line (`<line>`), Text (`<text>`), Pencil (`<path>`)
- Fill colors use 50% transparency (hex `80` suffix)
- Coordinates are offset to fit within the SVG viewBox

### JSON (Project File)

- Full element data exported with metadata:
  ```json
  {
    "version": "1.0",
    "timestamp": "...",
    "elements": [...],
    "metadata": {
      "totalElements": 5,
      "elementTypes": ["Rectangle", "Pencil"]
    }
  }
  ```
- Can be re-imported to restore the entire drawing

## Import

### JSON Import
- Opens a file picker for `.json` files
- Parses the file and validates the `elements` array
- Replaces current canvas content with imported elements
- Dispatches `canvas-elements-updated` CustomEvent so CanvasBoard reloads from localStorage

### Image Import
- Via the **Image** tool: opens a file picker
- Image is placed on the canvas at the clicked position
- Stored as `imageUrl` (base64 data URL) on the element
- Supports resize via corner handles (aspect ratio preserved via `aspectRatio` property)

## Export Options Interface

```typescript
interface ExportOptions {
  format: "png" | "jpg" | "svg";
  quality?: number;          // JPG quality (0-1)
  backgroundColor?: string;  // Canvas background
  scale?: number;            // Resolution multiplier
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save as JSON |
| `Ctrl + Shift + E` | Open export modal |
| `Ctrl + O` | Import from JSON |
