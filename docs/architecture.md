# Architecture Overview

## Monorepo Structure

```
draw.wine/
├── fe/          # Frontend — React + Vite + TypeScript
├── be/          # Backend  — Express + Socket.IO + TypeScript
├── docs/        # Documentation
└── README.md
```

## Frontend (`fe/`)

### Tech Stack
- **Framework:** React 18 with TypeScript
- **Build:** Vite
- **Canvas Rendering:** HTML5 Canvas + [roughjs](https://roughjs.com/) (hand-drawn style)
- **Styling:** Tailwind CSS + shadcn/ui
- **Real-time:** Socket.IO client
- **PWA:** Service worker for installable desktop/mobile app

### Source Layout

```
fe/src/
├── components/
│   ├── custom/
│   │   ├── canvas/       # CanvasBoard, CollabCursor, ConnectionStatus
│   │   ├── general/      # Toolbar, PropertiesPanel, Left3bar, LaserTrail
│   │   ├── collaboration/ # Room join/create modals
│   │   ├── modals/       # Export modal
│   │   ├── ai/           # AI features
│   │   └── fallbacks/    # Error/loading states
│   └── ui/               # shadcn primitives (Button, Dialog, etc.)
├── contexts/
│   ├── DrawingContext.tsx  # Active tool, stroke props, fill color
│   ├── CollabContext.tsx   # Socket.IO connection, room state
│   ├── ThemeContext.tsx    # Light/dark/system theme
│   └── GeneralContext.tsx  # App-level stage tracking
├── hooks/
│   ├── useCanvasBoardState.ts   # All canvas-level state (elements, selection, etc.)
│   ├── useKeyboardShortcuts.ts  # Ctrl+S, Ctrl+Shift+E, Ctrl+O
│   ├── useCollabRoom.ts         # Room joining logic
│   ├── useCreateRoomModal.ts    # Room creation logic
│   ├── useExportModal.ts        # Export dialog state
│   ├── usePWAInstall.ts         # PWA install prompt
│   └── useRoomStatus.ts         # Room health checking
├── helpers/
│   ├── canvas.h.ts        # Resize handles, eraser logic
│   ├── stroke.h.ts        # Stroke patterns (dash, dotted, bubbled)
│   ├── export.h.ts        # PNG/JPG/SVG/JSON export
│   ├── viewport.h.ts      # Element visibility culling
│   ├── imageLoader.h.ts   # Cached image loading
│   └── storeProgress.h.ts # localStorage persistence
├── types/
│   ├── element.ts         # Element & Position interfaces
│   ├── drawing.ts         # ToolType & DrawingContextType
│   └── collaboration.ts   # Collaborative operation types
├── constants/
│   ├── canvas.ts          # Auto-save interval, eraser radius, storage key
│   ├── ext.ts             # Stroke colors & widths
│   └── toolbar.ts         # Toolbar item definitions
└── pages/
    └── PlayGround.tsx     # Main drawing page
```

## Backend (`be/`)

### Tech Stack
- **Framework:** Express.js with TypeScript
- **Real-time:** Socket.IO server
- **Security:** Helmet, CORS, rate limiting
- **Compression:** Express compression middleware

### Source Layout

```
be/src/
├── index.ts                # Express + HTTP server + Socket.IO bootstrap
├── services/
│   └── socket.service.ts   # CollabDrawingServer singleton
├── events/
│   └── socket.event.ts     # Socket event handlers
├── routes/
│   └── rooms.routes.ts     # REST API for room management
├── controllers/            # Route handlers
├── types/                  # Backend type definitions
├── env/                    # Environment configuration
└── utils/                  # Shared utilities
```

## Data Flow

```
┌─────────────┐     Canvas Events      ┌──────────────┐
│  CanvasBoard │◄──────────────────────►│  DrawingCtx   │
│  (rendering) │                        │  (tool state) │
└──────┬───────┘                        └───────────────┘
       │
       │ element_start / element_update / element_complete
       ▼
┌──────────────┐    Socket.IO     ┌──────────────┐
│  CollabCtx    │◄───────────────►│  Backend      │
│  (socket mgr) │                 │  (relay ops)  │
└──────────────┘                  └──────────────┘
       │
       │ CustomEvent: collab_operation
       ▼
┌──────────────┐
│  CanvasBoard │  (applies remote operations)
└──────────────┘
```

Communication between `CollabContext` and `CanvasBoard` uses **DOM CustomEvents** (`collab_operation`, `room_joined`, `collab_laser_point`, `collab_laser_clear`) rather than direct prop drilling, keeping the two decoupled.
