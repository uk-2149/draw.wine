# State Management

## Contexts

draw.wine uses React Context for global state, avoiding external state libraries.

### DrawingContext

**Purpose:** Active drawing tool and style properties.

| State | Type | Default | Description |
|-------|------|---------|-------------|
| `selectedTool` | `ToolType` | `"select"` | Currently active tool |
| `strokeColor` | `string` | `"#000000"` | Stroke color for new elements |
| `strokeWidth` | `number` | `1` | Stroke thickness |
| `strokePattern` | `StrokePattern` | `"solid"` | Dash pattern |
| `fillColor` | `string \| null` | `null` | Fill color (shapes only) |
| `activeElementTypes` | `ToolType[]` | `[]` | Types of currently selected elements |

**Key behavior:** When an element is selected, its properties are synced **to** this context so the PropertiesPanel reflects the element's current style. When the user changes a property in the panel, the new value is synced **from** the context back to the selected element(s).

### CollabContext

**Purpose:** WebSocket connection and room state management.

Uses `useReducer` for complex state transitions:

| State Field | Description |
|-------------|-------------|
| `isConnected` | Socket.IO connection alive |
| `isConnecting` | Connection in progress |
| `isCollaborating` | Actively in a room |
| `roomId` | Current room ID |
| `userId` | Current user's unique ID |
| `hostId` | Room creator's ID |
| `collaborators` | List of users with cursor positions |
| `settings` | Room permissions (host-only draw, require approval) |
| `isWaitingForApproval` | Guest is waiting for host to accept |
| `joinRejected` | Host denied entry |
| `pendingJoinRequests` | Guests waiting for host approval (host-side) |

### ThemeContext

**Purpose:** Light / dark / system theme toggle. Persisted to `localStorage`.

### GeneralContext

**Purpose:** App-level stage tracking (`"lobby"` vs `"cg"` — collaborative game/drawing).

## Component-Level State

### useCanvasBoardState

All mutable canvas state is centralized in this hook rather than scattered across the CanvasBoard component:

| State | Purpose |
|-------|---------|
| `localElements` / `collaborativeElements` | Element arrays |
| `drawing` | Whether user is actively drawing |
| `position` / `scale` | Pan & zoom transform |
| `currentElement` | Element being drawn right now |
| `selectedElement` / `selectedElements` | Selection state |
| `isDragging` / `dragOffset` | Drag-to-move state |
| `resizing` / `resizeStart` | Resize handle state |
| `isPanning` / `startPan` | Pan gesture state |
| `eraserPos` | Eraser cursor position |
| `selectionArea` | Rubber-band rectangle |
| `isEditingText` / `editingTextId` | Text editing overlay |
| `collaborativeLaserTrails` | Remote users' laser trails |

## Style Sync Flow

When an element is selected, there's a bidirectional sync between the element's stored properties and the DrawingContext:

```
                    ┌───────────────┐
                    │ PropertiesPanel│
                    │   (UI controls)│
                    └───────┬───────┘
                            │ setStrokePattern() etc.
                            ▼
                    ┌───────────────┐
                    │ DrawingContext  │
                    │ (strokeColor,  │
                    │  strokeWidth,  │
                    │  strokePattern)│
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │                           │
     useLayoutEffect                  useEffect
     (selection → context)        (context → elements)
              │                           │
              ▼                           ▼
     sync element props          apply changed props
     to context on select        to selected elements
```

**Important:** The `useEffect` that applies style changes compares values against each element's current properties. If the values already match (e.g., after selection sync), `hasChanges` is false and no mutation occurs. This eliminates the need for skip flags.

## History (Undo/Redo)

- Max 50 history entries
- Each entry is a full snapshot of the elements array (deep-cloned)
- History tracking uses a begin/mutate/commit pattern:
  1. `beginHistoryAction()` — captures pre-mutation snapshot
  2. `markHistoryActionMutated()` — flags that changes occurred
  3. `commitHistoryAction()` — pushes snapshot to undo stack if mutated
- Undo/redo is **disabled during collaboration** to prevent conflicts
