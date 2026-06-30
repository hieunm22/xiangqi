# User Presence (online / inactive / offline)

How the app determines whether a user is **online**, **inactive** (away), or **offline**.

## Definition

Three states, derived from how long ago the user last sent a heartbeat:

| State | Meaning | Badge on avatar |
|---|---|---|
| **online** | Heartbeat is fresh — a visible tab is actively pinging. | 🟢 green dot |
| **busy** | A **player** (has a team, not a spectator) in a room whose game is in progress (`room.status = 2`). Overrides online/inactive. | 🔴 red dot |
| **inactive** | Recently active but no longer present (last tab closed, hidden, socket dropped, network lost) and still within the grace window. | 🕐 yellow clock |
| **offline** | No heartbeat for over 5 minutes — dropped from presence. | (no badge) |

`online` / `inactive` / `offline` are **heartbeat-derived** (Redis). `busy` is **game-derived**
(Postgres) and layered on top: a player in a started game shows red regardless of heartbeat.

A tab only reports presence while `document.visibilityState === "visible"`, so a
backgrounded/hidden tab stops heartbeating and the user decays online → inactive →
offline just as if they had left.

## Mechanism: heartbeat + two thresholds

Presence is driven by a periodic **heartbeat** from the client and stored in Redis.
A user's status is derived from the **age** of their last heartbeat:

```
age = now − lastHeartbeat
  age < ACTIVE_THRESHOLD (2min)   → online
  age < OFFLINE_THRESHOLD (5min)  → inactive
  otherwise                       → offline
```

Redis structures:

```
presence-online  (sorted set)  member = userId, score = last heartbeat (ms epoch)
                                 — storage + "who is present" index
presence-status  (hash)        member = userId, value = last broadcast status
                                 — lets the sweeper emit each transition once
```

There is **no presence field in Postgres/Prisma** — presence lives only in Redis.

### Closing the last tab → inactive immediately

Heartbeat age alone can't tell "between two pings" from "tab closed", so on its own a
closed tab would keep showing online until the 2-minute active threshold. To fix that,
when a user's **last socket disconnects** the server forces them to inactive after a
short grace (`PRESENCE_DISCONNECT_GRACE_MS`, 5s — long enough to absorb a refresh or
brief drop). `markInactive` backdates the heartbeat to the active boundary so the
status derives as inactive everywhere; a reconnecting/heartbeating tab cancels the
pending transition.

### Busy (in a started game)

`busy` is not heartbeat-derived — it reflects Postgres game state. A user is busy only when
they are a **player** (a `room_users` row with a non-null `team`, i.e. not a spectator) in a
room whose game is in progress (`room.status = 2`). It is applied in two ways:

- **Real-time:** game start broadcasts `busy` for the players; every game-end path broadcasts
  their heartbeat status again (back to online/inactive). See
  [presence-sync.ts](../../backend/src/common/game/presence-sync.ts) — one function
  `syncPlayersPresence(gameId, busy)` (`true` on start, `false` on end), wired into start-game,
  surrender, draw, leave-room, and bot checkmate.
- **Seed:** `GET /api/game/online` overrides each present user's status with `busy` if they are
  a player (team set) in a `status = 2` room (and includes such players even if their heartbeat
  isn't fresh). Spectators and bots are excluded.

## Tunable parameters

| Constant | Location | Value | Meaning |
|---|---|---|---|
| `HEARTBEAT_INTERVAL_MS` | [frontend/src/hooks/usePresenceHeartbeat.ts](../../frontend/src/hooks/usePresenceHeartbeat.ts) | `60s` | How often a visible tab pings |
| `PRESENCE_ACTIVE_THRESHOLD_MS` | [backend/src/common/presence.ts](../../backend/src/common/presence.ts) | `2min` | Online while heartbeat is newer than this |
| `PRESENCE_OFFLINE_THRESHOLD_MS` | [backend/src/common/presence.ts](../../backend/src/common/presence.ts) | `5min` | Offline once heartbeat is older than this (inactive in between) |
| `PRESENCE_SWEEP_INTERVAL_MS` | [backend/src/common/presence.ts](../../backend/src/common/presence.ts) | `30s` | How often the sweeper re-derives state |
| `PRESENCE_DISCONNECT_GRACE_MS` | [backend/src/common/presence.ts](../../backend/src/common/presence.ts) | `5s` | Grace after the last socket closes before forcing inactive |

The 60s heartbeat vs 2min active threshold tolerates one missed ping before a user
flips to inactive.

## Components

### Frontend

- **[usePresenceHeartbeat.ts](../../frontend/src/hooks/usePresenceHeartbeat.ts)** — mounted once in
  [Layout](../../frontend/src/components/Layout/index.tsx). Emits a heartbeat immediately when
  the tab becomes visible, repeats every `HEARTBEAT_INTERVAL_MS` while visible, and stops
  while hidden (`visibilitychange`).
- **[useOnlinePresence.tsx](../../frontend/src/hooks/useOnlinePresence.tsx)** — context provider mounted
  in Layout. Seeds a `Map<userId, status>` from the REST endpoint and keeps it live via
  `presence-changed`. Exposes `getStatus(userId)` and `isOnline(userId)` to the subtree.
- **[useSocket.tsx](../../frontend/src/hooks/useSocket.tsx)** — `emitPresencePing(userId)` plus
  `onPresenceChanged` / `offPresenceChanged`.
- **[UserAvatar.tsx](../../frontend/src/pages/Dashboard/components/UserAvatar.tsx)** — renders the badge:
  green dot for `online`, yellow clock for `inactive`, nothing otherwise. Consumed by the
  conversation list, private/room chat, announcements, and user search.

### Backend

- **[presence.ts](../../backend/src/common/presence.ts)** — the Redis logic:
  - `recordHeartbeat(userId)` → `ZADD` now + mark status online; returns `true` when the user
    transitioned into online (so the caller can broadcast it).
  - `getStatus(userId)` → derive online/inactive/offline from heartbeat age.
  - `getActiveUserStatuses()` → every present user with their status (read-only).
  - `markInactive(userId)` → force a currently-online user to inactive (last tab closed).
  - `markOffline(userId)` → drop from both structures; returns whether they were present.
  - `startPresenceSweeper(emit)` → every `PRESENCE_SWEEP_INTERVAL_MS`, emit each transition
    once: online → inactive, and inactive/online → offline (evicting offline users).
- **[socket.ts](../../backend/src/common/socket.ts)** — the `presence-ping` handler calls
  `recordHeartbeat`; on the **last** socket disconnect it schedules the grace timer that calls
  `markInactive`; reconnects/heartbeats cancel it.
- **[server.ts](../../backend/src/server.ts)** — starts the sweeper, wiring its emitter to
  `emitPresenceChanged`.
- **[get-online.ts](../../backend/src/routes/game/get-online.ts)** — `GET /api/game/online` returns
  present users (online + inactive) enriched from Postgres, each carrying its `status`, with
  players in a started game overridden to `busy`.
- **[presence-sync.ts](../../backend/src/common/game/presence-sync.ts)** —
  `syncPlayersPresence(gameId, busy)`: broadcast busy on game start (`busy=true`) and clear it
  on every game-end path (`busy=false`).
- **[logout.ts](../../backend/src/routes/auth/logout.ts)** — calls `markOffline` so a logout drops
  presence immediately instead of waiting out the threshold.

## Flows

### Going online

```
visible tab → emitPresencePing(userId)
            → socket "presence-ping" → recordHeartbeat(userId)   // ZADD now, status=online
            → if was not online: emitPresenceChanged(userId, "online")
            → all clients receive "presence-changed" { userId, status: "online" }
```

### Closing the last tab → inactive (fast path)

```
last socket "disconnect"
  → wait PRESENCE_DISCONNECT_GRACE_MS (5s; cancelled if a tab reconnects/heartbeats)
  → markInactive(userId)  // backdate heartbeat to the active boundary
  → emitPresenceChanged(userId, "inactive")
```

### Online → inactive → offline (passive — hidden tab / network loss)

When pings stop without a clean disconnect (hidden tab, asleep, network drop) the
heartbeat ages and the **sweeper** drives the transitions, each emitted once:

```
sweeper tick (every 30s)
  → heartbeat age ≥ 2min  → status "inactive"  → emit { userId, status: "inactive" }
  → heartbeat age ≥ 5min  → ZREM + status drop → emit { userId, status: "offline" }
```

### Busy (game start) → back to live status (game end)

```
start-game            → syncPlayersPresence(gameId, true)  → presence-changed { userId, status: "busy" }
surrender / draw /    → syncPlayersPresence(gameId, false) → presence-changed { userId, status: <heartbeat> }
leave / bot checkmate
```

### Going offline (active — logout)

```
DELETE /api/auth/logout → markOffline(userId)
  → if was present: emitPresenceChanged(userId, "offline")
```

### Querying current presence (seed)

```
GET /api/game/online
  → getActiveUserStatuses()    // ZRANGEBYSCORE within 5min, status by age
  → override status with "busy" for players (team set, not spectators) in a status=2 room
  → enrich from Postgres (id, display_name, avatar_seq, avatar_url)
  → { count, users: [{ ...user, status }] }   // status ∈ online | busy | inactive
```

## Real-time events

| Event | Direction | Payload | When |
|---|---|---|---|
| `presence-ping` | client → server | `{ userId }` | Every 60s while a tab is visible |
| `presence-changed` | server → all clients | `{ userId, status }` | On any online / inactive / offline transition |

## Design notes & edge cases

- **Closing the last tab marks inactive within ~5s** via the disconnect grace timer, rather
  than lingering as online until the 2-minute threshold.
- **Refresh / brief drops don't flicker.** The 5s grace plus the reconnect/heartbeat cancel
  means a quick reload reconnects before the inactive transition fires.
- **Hidden tab / silent drop** has no clean disconnect, so it decays via heartbeat age
  (online → inactive at 2min → offline at 5min) through the sweeper instead of the fast path.
- **Self-healing.** Status is a function of a timestamp, so a crashed client, dead network,
  or server restart simply stops refreshing the score and the user decays naturally — no
  stale "ghost online".
- **Exactly-once transitions.** The `presence-status` hash records the last broadcast status,
  so the sweeper emits each online → inactive → offline change only once.
- **Multi-instance.** Heartbeat-derived state lives entirely in Redis (multi-instance safe).
  The disconnect fast path uses the in-memory socket map, so — like the socket broadcast
  layer — it is single-instance; a Socket.io Redis adapter would be a separate change.
- **Multiple tabs / devices.** Any visible tab keeps the user online; the fast path only fires
  when the **last** socket closes.
- **Logout on one of several devices.** Logout only forces offline when it is the user's
  **last** connected device (`getConnectedDeviceCount(userId) <= 1`). With another device still
  connected, presence is left untouched so that device keeps the user online — no offline flash.

## Tests

- [backend/src/common/presence.test.ts](../../backend/src/common/presence.test.ts) — the Redis logic,
  status derivation, `markInactive`, and sweeper transitions.
- [backend/src/routes/game/get-online.test.ts](../../backend/src/routes/game/get-online.test.ts) — the REST endpoint.
