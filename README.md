# draw.wine

draw.wine is a real-time collaborative whiteboard built with React, TypeScript, Express, and Socket.IO.
It supports multiplayer drawing sessions, live cursor sync, room invitations, and AI-assisted drawing generation.

## Features

- Real-time collaboration with room-based sessions
- Live cursor presence and drawing synchronization over Socket.IO
- Drawing tools: select, pencil, text, rectangle, circle, diamond, line, arrow, eraser, laser
- Rough.js powered sketch-style rendering
- Invite collaborators by email via backend API
- Gemini-powered AI drawing generation (`vector` and `raster` modes)
- PWA-enabled frontend build

## Monorepo Layout

```text
.
├── be/   # Express + Socket.IO backend
├── fe/   # React + Vite frontend
├── docs/ # Product and architecture notes
└── Makefile
```

## Prerequisites

- Node.js 18+
- npm 9+

## Quick Start

1. Clone the repository.

```bash
git clone https://github.com/pandarudra/draw.wine.git
cd draw.wine
```

2. Install dependencies (recommended).

```bash
make install
```

Alternative manual install:

```bash
cd be && npm install
cd ../fe && npm install
```

3. Create backend environment file: `be/.env`

```env
PORT=3000
NODE_ENV=development
FE_URL_DEV=http://localhost:5173
FE_URL_PROD=https://your-frontend-domain.com

# Optional: enable real email sending in production mode
RESEND_API_KEY=
RESEND_FROM_EMAIL=Draw Wine <onboarding@resend.dev>

# Required for AI generation endpoints
GEMINI_API_KEY=your_google_gemini_api_key_here
```

4. Optional frontend environment file: `fe/.env`

```env
# If omitted, frontend uses http://localhost:3000 in development
VITE_ENV=prod
VITE_BE_URL=https://your-backend-domain.com
```

5. Start both apps.

```bash
make dev
```

Alternative manual start:

```bash
# Terminal 1
cd be
npm run dev

# Terminal 2
cd fe
npm run dev
```

6. Open the app:

- Frontend: http://localhost:5173

## Scripts

### Root (Makefile)

```bash
make install      # install frontend + backend dependencies
make dev          # run frontend and backend together
make build        # build frontend and backend
make lint         # lint frontend
make typecheck    # typecheck frontend and backend
make check        # lint + typecheck
```

### Backend (`be`)

```bash
npm run dev       # nodemon + ts-node (src/app.ts)
npm run build     # compile TypeScript to dist/
npm run start     # run dist/app.js
```

### Frontend (`fe`)

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## API Overview

### REST Endpoints

- `POST /api/rooms/send-invitations`: send invitation emails
- `POST /api/ai/generate`: generate drawing layout from prompt
- `POST /api/ai/chat`: chat endpoint for AI assistant features

Note: there is currently no `/health` endpoint in the backend.

### Socket Collaboration (High Level)

- Room lifecycle: join and leave room
- Presence: collaborators and cursor updates
- Canvas sync: drawing element operations and laser pointer activity

## Frontend Routes

- `/`: landing page
- `/board/:id`: drawing board
- `/collab`: collaborative room view

## Runtime Notes

- Backend CORS allow-list is composed from `FE_URL_DEV` and `FE_URL_PROD`.
- Frontend API base URL defaults to `http://localhost:3000` unless `VITE_ENV=prod`.
- Invitation emails are simulated in development mode and sent with Resend in production mode when configured.
- On small screens (`<768px`), the app currently renders a mobile fallback screen instead of the full board UI.

## Documentation

Detailed notes are available in `docs/`:

- `architecture.md`
- `canvas-interactions.md`
- `collaboration.md`
- `drawing-tools.md`
- `export-import.md`
- `pwa.md`
- `state-management.md`

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, Rough.js, Socket.IO client
- Backend: Express 5, Socket.IO, TypeScript, Helmet, CORS, compression, express-rate-limit, Resend, Google Generative AI SDK

## Contributing

1. Create a feature branch.
2. Make and test your changes.
3. Open a pull request with a clear description.

## License

ISC
