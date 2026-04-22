# Xiangqi (Chinese Chess)

A web-based Xiangqi (Chinese Chess) application with a React frontend and a Node.js/Express backend API.

## About

This project is an online Xiangqi platform featuring:

- Interactive game board with real-time gameplay via SignalR
- User authentication (login, register, password recovery)
- Dark/light theme support
- Internationalization (English and Vietnamese)
- REST API with Swagger documentation

## Tech Stack

**Frontend**
- React 19, TypeScript, Vite
- MUI (Material UI), Bootstrap, SCSS
- Redux Toolkit for state management
- React Router DOM for routing
- i18next for internationalization
- SignalR (`@microsoft/signalr`) for real-time communication

**Backend**
- Node.js, Express 5, TypeScript
- Swagger UI for API documentation
- CORS enabled

## Project Structure

```
xiangqi/
├── backend/                  # Express API server
│   ├── src/
│   │   ├── server.ts         # Entry point
│   │   ├── app.ts            # Express app setup
│   │   ├── swagger.ts        # Swagger configuration
│   │   └── routes/
│   │       └── health.ts     # Health check route
│   ├── package.json
│   └── tsconfig.json
├── frontend/                 # React SPA
│   ├── src/
│   │   ├── App.tsx           # Root component & routing
│   │   ├── main.tsx          # App entry point
│   │   ├── common/           # Constants & helpers
│   │   ├── components/       # Shared UI components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── locales/          # i18n translation files (en, vi)
│   │   ├── pages/            # Page components (Home, Login, Register, ...)
│   │   ├── styles/           # Global SCSS styles
│   │   ├── toolkit/          # Redux store & slices
│   │   └── types/            # TypeScript type definitions
│   ├── package.json
│   └── vite.config.ts
└── Tools/                    # Utility scripts
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Install & Run Backend

```bash
cd backend
npm install
npm run dev
```

The API server starts at **http://localhost:8000**.  
Swagger docs are available at **http://localhost:8000/docs**.

### Install & Run Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server starts at **http://localhost:3001**.

### Build for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```
