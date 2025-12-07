# RadiusChat Web Frontend

React-based frontend for RadiusChat real-time location-based chat application.

## Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env.production
   ```

2. Update `.env.production` with your backend URL:
   ```
   VITE_BACKEND_URL=wss://your-backend-url.onrender.com/ws
   ```

## Local Development

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000` and connects to `ws://localhost:8080/ws`

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

## Deploy to Vercel

### Using Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Using Vercel Dashboard

1. Connect your GitHub repository
2. Set root directory to `web`
3. Add environment variable:
   - Name: `VITE_BACKEND_URL`
   - Value: `wss://your-backend.onrender.com/ws`

## Environment Variables

- `VITE_BACKEND_URL` - WebSocket URL for backend connection

## Technologies

- React 19
- TypeScript
- Vite
- React Leaflet
- Tailwind CSS
