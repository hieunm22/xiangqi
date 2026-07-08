# Xiangqi (Chinese Chess)

A web-based Xiangqi (Chinese Chess) platform with a React frontend and a Node.js/Express backend API. Play online against other players in real time or challenge a bot opponent across 5 difficulty levels.

## About

This project is an online Xiangqi (Chinese Chess) platform featuring:

- **Real-time multiplayer (PvP)** — play against other players with live piece-movement and game-state synchronization via Socket.IO
- **Play vs. Bot (PvE)** — challenge a [Fairy-Stockfish](https://github.com/fairy-stockfish/Fairy-Stockfish) UCI engine across 5 tunable difficulty tiers (Beginner → Master)
- **Full in-game actions** — move, surrender, offer/accept draw, request undo, and reset
- **Rooms** — create rooms, join as a player or spectator, leave, kick users, and update room settings (red-first, PvE mode, bet amount)
- **Player profiles & ranking** — point-based scoring, per-player game history, profile popups, and avatar upload (S3)
- **Authentication** — register, login, logout, and password recovery with email verification; JWT access + refresh tokens with protected routes
- **Social login** — sign in with Google and Facebook; link/unlink social providers from existing accounts
- **In-app messaging** — room chat, private conversations, and system announcements
- **Rewards** — daily bonus, lucky spins, achievements, and point reconciliation
- **Polish** — sound effects on game events, win confetti, an in-app guide popup, and avatar groups
- **Dark / Light theme** with persistent user preferences
- **Internationalization** (English & Vietnamese) with an Excel-driven locale generation workflow
- **Responsive design** for desktop, tablet, and mobile
- **REST API** with comprehensive Swagger documentation
- **CI/CD** — automated deploy via GitHub Actions with Telegram notifications

## Tech Stack

**Frontend**
- React 19, TypeScript, Vite 8
- MUI 9, Bootstrap 5, SCSS, styled-components
- Redux Toolkit for state management
- React Router 7 for routing
- i18next / react-i18next for internationalization
- Socket.IO client for real-time gameplay and communication
- wretch for HTTP requests, FontAwesome Pro icons, react-confetti-boom for win effects

**Backend**
- Node.js, Express 5, TypeScript
- Prisma 7 ORM with PostgreSQL (multi-schema: `auth` + `game`)
- MongoDB driver and Redis (ioredis) for supplemental storage and caching
- Socket.IO server for real-time gameplay and communication
- Fairy-Stockfish UCI engine integration for the bot opponent
- JWT authentication (access + refresh tokens via cookies)
- Google Auth Library + Facebook Graph API for social login (OAuth)
- AWS S3 (`@aws-sdk/client-s3`) for avatar uploads
- Nodemailer for transactional email (password recovery)
- Swagger UI for API documentation
- CORS enabled with configurable origins

## Project Structure

```
xiangqi/
├── backend/                    # Express.js API server
│   ├── src/
│   │   ├── common/             # Board logic, socket, bot engine, DB connections, helpers
│   │   ├── middleware/         # JWT auth middleware
│   │   ├── routes/             # auth / game / room / message / user / tool endpoints
│   │   ├── templates/          # Email templates (HTML)
│   │   ├── types/              # Type definitions
│   │   └── generated/prisma/   # Generated Prisma client
│   ├── prisma/                 # Database schema & migrations
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── Dockerfile
│   └── Makefile
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── common/             # Browser utils, constants, helpers, enums
│   │   ├── components/         # Shared UI components & providers
│   │   ├── hooks/              # Custom hooks (socket, API, store, ...)
│   │   ├── locales/            # en.json / vi.json (generated)
│   │   ├── pages/              # Dashboard, Login, Register, Room, ...
│   │   ├── styles/             # Global & responsive SCSS
│   │   ├── toolkit/            # Redux store & slices
│   │   └── types/              # Type definitions
│   ├── public/                 # Static assets
│   ├── deploy/                 # Nginx configuration for production
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── Makefile
│
├── database/                   # Seed data & sample game history
├── tools/                      # Locale generation scripts & Excel source
├── docs/                       # Agent workflow, localization & coding convention docs
├── .github/                    # CI/CD workflows & AI instruction files
├── docker-compose.yml          # Docker services (PostgreSQL, MongoDB, mongo-express, API)
├── CLAUDE.md                   # Project instructions for AI agents
└── README.md
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [Yarn](https://yarnpkg.com/) (or npm v9+)
- [PostgreSQL](https://www.postgresql.org/) 14+ (primary database)
- [MongoDB](https://www.mongodb.com/) 5+ (game data, optional)
- [Redis](https://redis.io/) (caching, optional)
- [Fairy-Stockfish](https://github.com/fairy-stockfish/Fairy-Stockfish) binary on `PATH` (required for the bot / PvE mode)
- [Docker & Docker Compose](https://www.docker.com/) (for containerized setup)

### Install & Run Backend

```bash
cd backend
yarn
yarn dev
```

The API server starts at **http://localhost:8000**.
Swagger docs are available at **http://localhost:8000/docs** (the root `/` redirects there).
The Socket.IO server is ready for real-time connections at **http://localhost:8000/socket.io**.

### Install & Run Frontend

```bash
cd frontend
yarn
yarn dev
```

The frontend dev server starts at **http://localhost:3004**.

### Environment Variables

The backend loads env files in order: `.env.local`, `.env.backend`, `.env`. `DATABASE_URL` and `JWT_SECRET` are required (the server throws on startup if missing).

**Backend** (`.env.local` / `.env.backend` / `.env`)
```
# Core (required)
DATABASE_URL=postgresql://user:pass@localhost:5432/xiangqi
JWT_SECRET=your-secret-key
JWT_ISSUER=localhost:8000

# Server
PORT=8000
API_HOST=http://localhost:8000

# CORS & frontend
CORS_ORIGINS=http://localhost:3004,https://your-domain.com
FRONTEND_BASE_URL=http://localhost:3004

# Cookies
COOKIE_DOMAIN=localhost
COOKIE_SAMESITE=lax
COOKIE_SECURE=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# MongoDB
MONGO_CONNECTION_STRING=mongodb://root:pass@localhost:27017/?authSource=admin
MONGODB_DB_NAME=xiangqi

# Email (password recovery)
APP_EMAIL=your-email@gmail.com
APP_PASSWORD=your-app-password

# Social login
GOOGLE_CLIENT_ID=your-google-client-id
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# S3 (avatar uploads)
AWS_ACCESS_ID=your-aws-access-key-id
AWS_SECRET_KEY=your-aws-secret-access-key
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=your-bucket-name

# Bot engine
FAIRY_STOCKFISH_PATH=fairy-stockfish

# Point reconciliation (optional)
AMOUNT_RECONCILE_CRON=0 23 * * 0
AMOUNT_RECONCILE_AUTOFIX=false
```

**Frontend** (`.env.frontend`)
```
VITE_BACKEND_BASE_URL=http://localhost:8000
VITE_PUBLIC_DISTRIBUTION=https://your-cdn-domain.com
```

### Database Migrations

```bash
cd backend
yarn migrate:new          # create & apply a new migration (dev)
yarn migrate:deploy       # apply pending migrations (production)
yarn migrate:export-sql   # export schema diff to ../database/schema.sql
```

### Docker Compose Setup

```bash
docker-compose up -d
```

This starts PostgreSQL, MongoDB, mongo-express (DB admin UI on **http://localhost:8081**), and the backend API container. Update the placeholder passwords in `docker-compose.yml` and provide `backend/.env.local` before running. The Redis service is included as a commented template.

## Build for Production

### Backend

```bash
cd backend
yarn
yarn build       # tsc + tsc-alias
yarn start       # node dist/server.js
```

### Frontend

```bash
cd frontend
yarn
yarn build       # tsc -b + vite build
yarn preview
```

## Game Rules & Behavior

### Game Modes

- **PvP** — two human players in a room synchronize moves in real time.
- **PvE** — a single player faces the Fairy-Stockfish bot. Difficulty is selectable from 5 tiers (Beginner, Amateur, Intermediate, Advanced, Master), each tuned with a distinct UCI skill level, search depth, and per-move time budget. Each PvE game owns a dedicated engine process that is released after the game ends or a long idle period.

### Piece Placement & Board Orientation

When creating a room you can toggle **"Red First"**:

- **Red First enabled:** Red pieces sit at the **bottom** of the board, Black at the top.
- **Red First disabled:** Black pieces sit at the **bottom**, Red at the top.

Player info cards (names, scores, captured pieces) always appear on the **same side as that player's pieces**.

### Move Order

The side with pieces at the **bottom of the board moves first**, regardless of color. The opponent at the top moves second.

### In-Game Actions

- **Move** — only your assigned team's pieces are controllable; the last-moved piece is highlighted.
- **Surrender** — concede the game.
- **Draw** — offer a draw; the opponent accepts or declines.
- **Undo** — request to take back the last move.
- **Reset** — restart the game in the room.

## Real-time Communication

Socket.IO powers all live updates. Key events include:

- `join-room`, `leave-room` — room presence
- `player-move` / `piece-moved` — move synchronization
- `game-started`, `surrender` / `game-surrendered`, `draw-request` / `draw-response` — game lifecycle
- `room-users-updated`, `user-kicked`, `room-created`, `room-deleted`, `dashboard-room-users-updated` — room & lobby updates

### Socket.IO Configuration

- **Default path:** `/socket.io`
- **Transports:** WebSocket (preferred) + Polling (fallback)
- **CORS origins:** Configured via `CORS_ORIGINS` environment variable
- **Credentials:** Enabled for cross-origin requests

**For production behind an nginx reverse proxy:**
```nginx
location /socket.io {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Localization (i18n)

Translations are managed via Excel source and auto-generated to JSON files.

**Source of truth:** `tools/languages.xlsx`

### Adding/Updating Translations

1. Edit `tools/languages.xlsx` (columns: key | English | Vietnamese)
2. Run:
   ```bash
   ./tools/generate-locales.sh
   ```
3. Verify generated files: `frontend/src/locales/en.json` and `vi.json`

⚠️ **Never edit the generated JSON files directly** — they are overwritten on regeneration. See `docs/language-generation.md` for the full workflow.

## Testing

### Backend Tests

The backend ships with Vitest coverage across auth, room, game, and bot-engine modules.

```bash
cd backend
yarn test          # run once
yarn test:watch    # watch mode
```

### Frontend Build Validation

```bash
cd frontend
yarn lint
yarn build
```

## Troubleshooting

### Bot / PvE Not Responding

- Ensure the Fairy-Stockfish binary is installed and on your `PATH`, or set `FAIRY_STOCKFISH_PATH` to its absolute path.
- Each PvE game spawns one engine process; check backend logs for `[bot-engine]` errors.

### WebSocket Connection Issues

**Problem:** Frontend can't connect to Socket.IO on a remote domain (CORS 400 error).

1. Verify `CORS_ORIGINS` includes the frontend domain:
   ```bash
   CORS_ORIGINS=http://localhost:3004,https://your-domain.com
   ```
2. For reverse proxy setups, ensure nginx has the WebSocket upgrade configuration shown above.
3. The frontend falls back to polling automatically if WebSocket fails (check the browser console for the transport type).

### Database Connection Issues

**PostgreSQL connection refused:**
- Ensure PostgreSQL is running: `docker-compose up -d postgres`
- Check the `DATABASE_URL` format and credentials.

**MongoDB connection issues:**
- Verify MongoDB is running: `docker-compose up -d mongodb`
- Check the `MONGO_CONNECTION_STRING` environment variable.

### Port Already in Use

If ports 3004 (frontend), 8000 (backend), 5432 (PostgreSQL), 27017 (MongoDB), or 8081 (mongo-express) are in use:
```bash
# Find the process using a port (macOS/Linux)
lsof -i :PORT_NUMBER

# Or kill directly (use with caution)
kill -9 PID
```

## Contributing

When working with the codebase, please follow:
- `CLAUDE.md` and `docs/agent-workflow.md` for the agent/contribution workflow
- `docs/react-guidelines.md` for frontend coding conventions
- `docs/language-generation.md` for the localization workflow
- `.github/copilot-instructions.md` for AI assistant guidelines
- Use the provided Makefile commands in `backend/` and `frontend/` for common tasks

## License

This project is created for educational and entertainment purposes.
