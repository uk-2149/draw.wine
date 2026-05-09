# draw.wine

draw.wine is a real-time collaborative whiteboard built with React, TypeScript, Express, and Socket.IO.
It supports multiplayer drawing sessions, live cursors, room invitations, and a rich set of canvas tools.

## Highlights

- Real-time collaboration with room-based sessions
- Live cursor presence and drawing synchronization over Socket.IO
- Drawing tools: selection, pencil, text, rectangle, circle, diamond, line, arrow, eraser, laser
- Rough.js powered sketch-style rendering
- Invite collaborators by email via backend API
- PWA-enabled frontend build

## Monorepo Layout

```text
.
├── be/   # Express + Socket.IO backend
├── fe/   # React + Vite frontend
└── docs/ # Product and architecture notes
```

## Prerequisites

- Node.js 18+
- npm 9+

## Quick Start

1. Clone and install dependencies.

```bash
git clone https://github.com/pandarudra/draw.wine.git
cd draw.wine

cd be && npm install
cd ../fe && npm install
```

2. Create backend environment file at `be/.env`.

```env
PORT=3000
NODE_ENV=development
FE_URL_DEV=http://localhost:5173
FE_URL_PROD=https://your-frontend-domain.com

# Optional: enable real email sending in production mode
RESEND_API_KEY=
RESEND_FROM_EMAIL=draw.wine <onboarding@resend.dev>
```

3. (Optional) Create frontend environment file at `fe/.env` for production API routing.

```env
VITE_ENV=prod
VITE_BE_URL=https://your-backend-domain.com
```

4. Start both apps in separate terminals.

```bash
# Terminal 1
cd be
npm run dev

# Terminal 2
cd fe
npm run dev
```

5. Open:

- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health

## Run Scripts

Backend (`be`):

```bash
npm run dev    # nodemon + ts-node
npm run build  # compile TypeScript to dist/
npm run start  # run dist/index.js
```

Frontend (`fe`):

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Runtime Notes

- Backend CORS allow-list is composed from `FE_URL_DEV` and `FE_URL_PROD`.
- Frontend uses `http://localhost:3000` in non-prod mode.
- Invitation emails are simulated in development mode and actually sent via Resend only when properly configured in production mode.
- On small screens (`<768px`), the frontend currently shows a mobile fallback screen instead of the full board UI.

## API Overview

### REST

- `GET /health`: service status + socket connection stats
- `POST /api/rooms/send-invitations`: send room invitation emails

### Socket Events (high level)

- Room lifecycle: join/leave room
- Collaboration state: collaborators updates, cursor updates
- Drawing synchronization: element operations and laser pointer activity

## Routes

- `/`: landing page
- `/board/:id`: drawing board
- `/collab`: collaborative room view

## Documentation

Additional implementation docs are available in `docs/`:

- `architecture.md`
- `canvas-interactions.md`
- `collaboration.md`
- `drawing-tools.md`
- `export-import.md`
- `pwa.md`
- `state-management.md`

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4, Radix UI, Rough.js, Socket.IO client
- Backend: Express 5, Socket.IO, TypeScript, Helmet, CORS, compression, express-rate-limit, Resend

## Contributing

1. Create a feature branch.
2. Make and test your changes.
3. Open a pull request with a clear description.

## License

ISC
