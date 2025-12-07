# Deployment Guide

This guide covers deploying RadiusChat with a separated frontend (Vercel) and backend (Render).

## Architecture

- **Frontend**: React app deployed on Vercel
- **Backend**: Go WebSocket server deployed on Render
- **Communication**: WebSocket connection from frontend to backend

## Backend Deployment (Render)

### Step 1: Deploy to Render

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Separate frontend and backend deployments"
   git push origin master
   ```

2. **Create a new Web Service on Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `radiuschat-backend`
     - **Runtime**: Go
     - **Build Command**: `go build -o app main.go`
     - **Start Command**: `./app`
     - **Plan**: Free

3. **Note your backend URL**
   - After deployment, you'll get a URL like: `https://radiuschat-backend.onrender.com`
   - The WebSocket endpoint will be: `wss://radiuschat-backend.onrender.com/ws`

4. **Test the backend**
   - Visit: `https://radiuschat-backend.onrender.com/health`
   - You should see: `{"status":"ok","service":"radiuschat-backend"}`

## Frontend Deployment (Vercel)

### Step 2: Configure Frontend

1. **Update the backend URL** in `web/.env.production`:
   ```bash
   VITE_BACKEND_URL=wss://radiuschat-backend.onrender.com/ws
   ```
   Replace with your actual Render backend URL.

2. **Navigate to web directory**:
   ```bash
   cd web
   ```

### Step 3: Deploy to Vercel

**Option A: Using Vercel CLI (Recommended)**

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Set environment variable** (if not using .env.production):
   ```bash
   vercel env add VITE_BACKEND_URL production
   # Enter: wss://radiuschat-backend.onrender.com/ws
   ```

**Option B: Using Vercel Dashboard**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Add Environment Variable:
   - **Name**: `VITE_BACKEND_URL`
   - **Value**: `wss://radiuschat-backend.onrender.com/ws`
6. Click "Deploy"

### Step 4: Test the Application

1. Visit your Vercel URL (e.g., `https://radiuschat.vercel.app`)
2. Open browser console to see WebSocket connection logs
3. Try logging in with a username
4. Open multiple browser tabs to test chat functionality

## Local Development

### Running Backend Locally

```bash
# From project root
go run main.go
```
Backend runs on: `http://localhost:8080`

### Running Frontend Locally

```bash
# From web directory
cd web
npm install
npm run dev
```
Frontend runs on: `http://localhost:3000`

The frontend will automatically connect to `ws://localhost:8080/ws` in development mode.

## Environment Variables

### Frontend (.env files)

- `.env.development` - Local development settings
- `.env.production` - Production (Vercel) settings
- `.env.example` - Template for environment variables

### Backend

- `PORT` - Server port (automatically set by Render)

## Troubleshooting

### WebSocket Connection Failed

1. **Check backend URL** in `.env.production`
2. **Verify backend is running**: Visit `/health` endpoint
3. **Check browser console** for connection errors
4. **Ensure using `wss://`** (not `ws://`) for HTTPS frontend

### CORS Issues

The backend is configured to accept connections from any origin. If you need to restrict:

```go
// In main.go, update the upgrader
var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        origin := r.Header.Get("Origin")
        return origin == "https://radiuschat.vercel.app"
    },
}
```

### Render Backend Not Starting

1. Check Render logs for build/runtime errors
2. Ensure `go.mod` is committed to repository
3. Verify Go version compatibility

### Vercel Build Fails

1. Ensure `package.json` is in the `web` directory
2. Check environment variables are set correctly
3. Verify build command: `npm run build`

## Updating the Application

### Update Backend

```bash
# Make changes to main.go
git add main.go
git commit -m "Update backend"
git push origin master
```
Render will automatically redeploy.

### Update Frontend

```bash
cd web
# Make changes
git add .
git commit -m "Update frontend"
git push origin master
```

**If using Vercel CLI**:
```bash
cd web
vercel --prod
```

**If using Vercel GitHub integration**: Vercel will automatically redeploy.

## Cost

- **Render Free Tier**: Backend sleeps after 15 minutes of inactivity
- **Vercel Free Tier**: Unlimited deployments, bandwidth limits apply

## Production Considerations

1. **Keep Backend Awake**: Use a service like UptimeRobot to ping the backend every 14 minutes
2. **Monitoring**: Set up logging and error tracking
3. **Security**: Add rate limiting and authentication
4. **Scaling**: Consider upgrading to paid tiers for better performance

## Support

For issues:
1. Check browser console for frontend errors
2. Check Render logs for backend errors
3. Verify WebSocket URL matches deployed backend URL
