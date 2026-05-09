# Real-Time Collaboration

## Overview

draw.wine supports real-time collaborative drawing using **Socket.IO** for bidirectional communication. Multiple users can join a shared room, see each other's cursors, and draw on the same canvas simultaneously.

## Room Lifecycle

```
┌────────┐  join_room   ┌────────────┐  room_joined  ┌────────────┐
│ Lobby  │─────────────►│  Joining   │──────────────►│ In Room    │
└────────┘              └────────────┘               └─────┬──────┘
                              │                            │
                    (if requireApproval)              leave_room
                              ▼                            │
                     ┌──────────────┐                      ▼
                     │ Waiting for  │               ┌────────────┐
                     │  Approval    │               │  room_left │
                     └──────┬───────┘               └────────────┘
                            │
                   accept / reject
                     ▼          ▼
              room_joined   join_rejected
```

## Socket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ roomId, user: { id, name, color }, settings? }` | Join or create a room |
| `leave_room` | `{ roomId }` | Leave current room |
| `drawing_operation` | `{ roomId, operation }` | Broadcast a drawing operation |
| `cursor_update` | `{ roomId, position: { x, y } }` | Update cursor position (throttled: 50ms) |
| `handle_join_request` | `{ roomId, guestId, action }` | Host accepts/rejects a guest |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room_joined` | `{ collaborators, elements, hostId, settings }` | Successfully joined room |
| `waiting_for_approval` | — | Room requires host approval |
| `join_rejected` | — | Host denied entry |
| `join_request` | `{ roomId, guest: { id, name, color } }` | Notify host of pending request |
| `collaborators_updated` | `Collaborator[]` | Updated list of room members |
| `operation_applied` | `CollaborativeOperation` | Relayed drawing operation |
| `cursor_moved` | `{ userId, position }` | Another user's cursor moved |
| `laser_point` | `{ userId, point, timestamp }` | Laser pointer data |
| `laser_clear` | `{ userId }` | Laser trail cleared |
| `room_left` | `{ success, error? }` | Confirmation of room departure |

## Collaborative Operations

Operations are the core unit of real-time sync. Each operation has a `type` and associated data:

| Operation Type | Trigger | Data |
|---------------|---------|------|
| `element_start` | User begins drawing | `{ element, tool }` |
| `element_create` | Element finalized | `{ element }` |
| `element_update` | Element modified (drag, resize, style change) | Partial element data |
| `element_complete` | Drawing finished | `{ element }` |
| `element_delete` | Element erased | Element ID |

Every operation includes `authorId` and `timestamp` for deduplication and ordering.

## Element State Management

- **Local elements** (`localElements`): Elements created by the current user in solo mode
- **Collaborative elements** (`collaborativeElements`): Elements received from remote users
- **Combined view**: `[...localElements, ...collaborativeElements]` displayed on canvas
- Elements are separated so local undo/redo only affects the user's own work

## Room Settings

| Setting | Description |
|---------|-------------|
| `onlyHostCanDraw` | Only the room creator can draw; others can only view, select, and use laser |
| `requireApproval` | New users must be approved by the host before joining |

## Cursor Tracking

Each collaborator's cursor is displayed as a colored dot with their name label. Updates are throttled to every 50ms to avoid network flooding.

## Auto-Reconnection

If the socket disconnects, the client automatically attempts to reconnect. On successful reconnect, it re-emits `join_room` with the stored userId from `sessionStorage` to maintain identity.

## Identity Persistence

User identity is stored in `sessionStorage` per room:
- `draw_userId_{roomId}` — Unique user ID
- `draw_userName_{roomId}` — Display name
- `draw_userColor_{roomId}` — Cursor/avatar color

This ensures refreshing the page preserves the user's identity in the room.
