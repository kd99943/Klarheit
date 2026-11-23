# Klarheit Frontend (`front_end`)

React 19 + TypeScript + Vite storefront for the **Klarheit** D2C optical and WebAR virtual try-on platform.

## Tech Stack

- **Framework**: React 19, TypeScript 5.8, Vite 6
- **Styling**: Tailwind CSS 4
- **3D & WebAR**: Three.js + `@mediapipe/tasks-vision` (Face Landmarker with local `/wasm` and model assets, GPU-first with automatic CPU fallback)
- **Routing & i18n**: React Router 7, `i18next` + `react-i18next` (`en` / `zh`)
- **Testing**: Vitest 4 + Testing Library

## Prerequisites

- Node.js 22+
- Backend API running locally on `http://localhost:8081` (or configured via `VITE_API_BASE_URL`)

## Available Scripts

```bash
# Install dependencies (also localizes MediaPipe WASM/model assets into public/wasm)
npm install

# Start local dev server on http://localhost:3000
npm run dev

# Type-check with TypeScript
npm run lint

# Scan for bare untranslated UI strings
npm run check-i18n

# Run Vitest unit test suite
npm run test

# Build production bundle into dist/
npm run build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8081/api/v1` | Backend API base URL (can also be injected at container startup via `public/env-config.js`) |
| `VITE_ENABLE_MOCK_PAYMENT` | Enabled in Vite `DEV`, disabled in production build | Controls whether the sandbox mock payment simulation button is rendered |
