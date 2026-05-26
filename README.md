# Xiangqi (Chinese Chess)

A web-based Xiangqi (Chinese Chess) application with a React frontend and a Node.js/Express backend API.

## About

This project is an online Xiangqi (Chinese Chess) platform featuring:

- **Interactive game board** with real-time multiplayer gameplay via Socket.IO
- **User authentication** (login, register, password recovery with email verification)
- **Real-time synchronization** for piece movements and game state
- **Dark/Light theme support** with persistent user preferences
- **Internationalization** (English and Vietnamese) with automatic locale management
- **Responsive design** for desktop and tablet devices
- **REST API** with comprehensive Swagger documentation
- **Secure authentication** using JWT tokens with refresh mechanism
- **Rate limiting & CORS protection** for API security

## Tech Stack

**Frontend**
- React 19, TypeScript, Vite
- MUI (Material UI), Bootstrap, SCSS
- Redux Toolkit for state management
- React Router DOM for routing
- i18next for internationalization
- Socket.IO client for real-time communication

**Backend**
- Node.js, Express 5, TypeScript
- Prisma ORM with PostgreSQL/MongoDB
- Socket.IO server for real-time gameplay
- Redis for caching
- JWT authentication
- Swagger UI for API documentation
- CORS enabled with configurable origins

## Project Structure

```
xiangqi/
├── backend/                      # Express.js API server
│   ├── src/
│   │   ├── server.ts             # Entry point & HTTP server setup
│   │   ├── app.ts                # Express app configuration & CORS
│   │   ├── env.ts                # Environment variable loading
│   │   ├── swagger.ts            # Swagger/OpenAPI documentation
│   │   ├── prisma.ts             # Prisma client initialization
│   │   ├── common/
│   │   │   ├── board-helper.ts   # Xiangqi board logic
│   │   │   ├── socket.ts         # Socket.IO server setup & handlers
│   │   │   ├── mongodb.ts        # MongoDB connection
│   │   │   ├── redis.ts          # Redis cache initialization
│   │   │   ├── constant.ts       # Game constants
│   │   │   └── helper.ts         # Utility functions
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT authentication middleware
│   │   ├── routes/
│   │   │   ├── auth/             # Authentication endpoints (login, register, tokens)
│   │   │   ├── game/             # Game endpoints (moves, surrender)
│   │   │   ├── room/             # Room endpoints (create, join, leave)
│   │   │   └── tool/             # Tool endpoints
│   │   ├── templates/            # Email templates (HTML)
│   │   └── types/
│   │       ├── auth.type.ts      # Auth type definitions
│   │       ├── game.type.ts      # Game type definitions
│   │       └── room.type.ts      # Room type definitions
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   ├── generated/                # Generated Prisma client & types
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── Dockerfile
│   └── Makefile
│
├── frontend/                     # React SPA
│   ├── src/
│   │   ├── main.tsx              # App entry point
│   │   ├── App.tsx               # Root component & routing
│   │   ├── App.scss              # Global styles
│   │   ├── common/
│   │   │   ├── browser.ts        # Browser detection utilities
│   │   │   ├── constant.ts       # Application constants & paths
│   │   │   ├── helper.ts         # Utility functions
│   │   │   └── browser.types.ts  # Browser type definitions
│   │   ├── components/
│   │   │   ├── AlertProvider/    # Global alert provider
│   │   │   ├── AuthProvider/     # Authentication provider
│   │   │   ├── ConfirmProvider/  # Confirmation dialog provider
│   │   │   ├── Layout/           # Main layout wrapper
│   │   │   ├── LayoutUnAuth/     # Unauthenticated layout
│   │   │   ├── ProtectedRoute/   # Route protection HOC
│   │   │   ├── TranslationTag/   # i18n tag component
│   │   │   ├── TranslationText/  # i18n text component
│   │   │   ├── Common.tsx        # Shared components
│   │   │   ├── Opponent/         # Opponent info component
│   │   │   └── ...               # Other UI components
│   │   ├── hooks/
│   │   │   ├── useSocket.ts      # Socket.IO hook for real-time updates
│   │   │   ├── useAPI.ts         # API request hook
│   │   │   ├── useAppContext.ts  # App context hook
│   │   │   ├── useGameToolkit.ts # Game state hook
│   │   │   ├── useAutoTitle.ts   # Page title hook
│   │   │   └── useToolkit.ts     # Redux store hook
│   │   ├── locales/
│   │   │   ├── en.json           # English translations (generated)
│   │   │   ├── vi.json           # Vietnamese translations (generated)
│   │   ├── pages/
│   │   │   ├── Dashboard/        # Home/dashboard page
│   │   │   ├── Login/            # Login page
│   │   │   ├── Register/         # Registration page
│   │   │   ├── LostPassword/     # Password recovery page
│   │   │   ├── ResetPassword/    # Password reset page
│   │   │   ├── Room/             # Game room page
│   │   │   └── NotFound/         # 404 page
│   │   ├── styles/
│   │   │   ├── common.scss       # Global styles
│   │   │   └── responsive.scss   # Responsive breakpoints
│   │   ├── toolkit/
│   │   │   ├── store.ts          # Redux store configuration
│   │   │   └── slice/            # Redux slices
│   │   └── types/
│   │       ├── Common.ts         # Common type definitions
│   │       ├── Entities.ts       # Entity models
│   │       ├── GameState.ts      # Game state types
│   │       └── ReduxState.ts     # Redux state types
│   ├── public/                   # Static assets
│   ├── deploy/
│   │   ├── nginx.conf            # Nginx configuration for production
│   │   └── frontend-docker-log.md
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── Makefile
│   └── README.md
│
├── database/
│   ├── data.sql                  # Database seed/initial data
│   └── game_history.json         # Game history sample data
│
├── tools/
│   ├── generate-locales.sh       # Script to generate i18n JSON from Excel
│   ├── languages.xlsx            # Source of truth for translations
│   ├── convert-to-csv.py         # Utility scripts
│   ├── convert-to-json.py
│   ├── update-excel.py
│   ├── change.sh / change.ps1
│   └── pre-commit                # Git pre-commit hook
│
├── .github/
│   ├── instructions/
│   │   ├── localization.instructions.md  # Localization workflow rules
│   │   └── ...
│   └── copilot-instructions.md   # Copilot/IDE AI customization
│
├── docker-compose.yml            # Docker services (PostgreSQL, MongoDB, Redis)
└── README.md
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher (or [yarn](https://yarnpkg.com/))
- [PostgreSQL](https://www.postgresql.org/) 14+ (for user database)
- [MongoDB](https://www.mongodb.com/) 5+ (for game data, optional)
- [Redis](https://redis.io/) (for caching)
- [Docker & Docker Compose](https://www.docker.com/) (for containerized setup)

### Install & Run Backend

```bash
cd backend
yarn
yarn dev
```

The API server starts at **http://localhost:8000**.  
Swagger docs are available at **http://localhost:8000/docs**.  
Socket.IO server is ready for real-time connections at **http://localhost:8000/socket.io**.

### Install & Run Frontend

```bash
cd frontend
yarn
yarn dev
```

The frontend dev server starts at **http://localhost:3004**.

### Environment Variables

**Backend** (`.env.backend` or `.env`)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/xiangqi
JWT_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:3004,https://your-domain.com
REDIS_HOST=localhost
MONGO_CONNECTION_STRING=mongodb://root:pass@localhost:27017/?authSource=admin
MONGODB_DB_NAME=xiangqi
API_HOST=http://localhost:5001
APP_EMAIL=your-email@gmail.com
APP_PASSWORD=your-app-password
```

**Frontend** (`.env.frontend`)
```
VITE_BACKEND_BASE_URL=http://localhost:8000
VITE_PUBLIC_DISTRIBUTION=https://your-cdn-domain.com
```

### Docker Compose Setup

```bash
docker-compose up -d
```

This starts PostgreSQL, MongoDB, and Redis containers with all necessary configurations.

## Build for Production

### Backend

```bash
cd backend
yarn
yarn build
npm start
```

### Frontend

```bash
cd frontend
yarn
yarn build
yarn preview
```

## Real-time Features

The application uses **Socket.IO** for real-time multiplayer gameplay:
- Real-time piece movement synchronization
- Instant game state updates
- Player connection status
- Live room notifications

## Game Rules

### Piece Placement & Board Orientation

When creating a game room, you have the option to select **"Red First"**:

- **If "Red First" is selected:** Red pieces are positioned at the **bottom** of the board, Black pieces at the top
- **If "Red First" is NOT selected:** Black pieces are positioned at the **bottom** of the board, Red pieces at the top

The player information cards (showing player names and captured pieces) are always positioned on the **same side as their pieces**:
- If your pieces are at the bottom, your player card appears at the bottom
- If your pieces are at the top, your player card appears at the top

### Move Order

The side with pieces positioned at the **bottom of the board always moves first**, regardless of which color they are. The opponent with pieces at the top moves second.

### Socket.IO Configuration

- **Default path:** `/socket.io`
- **Transports:** WebSocket (preferred) + Polling (fallback)
- **CORS origins:** Configured via `CORS_ORIGINS` environment variable
- **Credentials:** Enabled for cross-origin requests

**For production with nginx reverse proxy**, ensure the following configuration:
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

⚠️ **Never edit the generated JSON files directly** – they are auto-generated.

## Testing

### Backend Tests
```bash
cd backend
yarn test
```

### Frontend Build Validation
```bash
cd frontend
yarn build
```

## Troubleshooting

### WebSocket Connection Issues

**Problem:** Frontend can't connect to Socket.IO on remote domain (CORS 400 error)

**Solution:** 
1. Verify `CORS_ORIGINS` environment variable includes the frontend domain:
   ```bash
   CORS_ORIGINS=http://localhost:3004,https://your-domain.com
   ```

2. For reverse proxy setups, ensure nginx has proper WebSocket upgrade configuration (see Socket.IO nginx config above)

3. Frontend automatically falls back to polling if WebSocket fails (check browser console for transport type)

### Database Connection Issues

**PostgreSQL connection refused:**
- Ensure PostgreSQL is running: `docker-compose up -d postgres`
- Check DATABASE_URL format and credentials

**MongoDB connection issues:**
- Verify MongoDB is running: `docker-compose up -d mongodb`
- Check MONGO_CONNECTION_STRING environment variable

### Port Already in Use

If ports 3004 (frontend), 8000 (backend), or 5432 (PostgreSQL) are already in use:
```bash
# Find process using port (macOS/Linux)
lsof -i :PORT_NUMBER

# Or kill directly (use with caution)
kill -9 PID
```

## Contributing

When working with the codebase, please follow:
- Check `.github/copilot-instructions.md` for AI assistant guidelines
- Follow localization workflow in `.github/instructions/localization.instructions.md`
- Use provided Makefile commands in backend/ and frontend/ for common tasks

## License

This project is created for educational and entertainment purposes.

